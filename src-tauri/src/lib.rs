// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod activate;
mod api;
mod capture;
mod db;
mod fs_tools;
mod health;
mod http_tools;
mod mcp;
mod sandbox;
mod search_tools;
mod shortcuts;
mod speaker;
mod unified;
mod window;
mod zero_token;

use capture::CaptureState;
use speaker::VadConfig;
use std::sync::{Arc, Mutex};
use tauri::Manager;
#[cfg(target_os = "macos")]
use tauri::{AppHandle, WebviewWindow};
use tauri_plugin_posthog::{init as posthog_init, PostHogConfig, PostHogOptions};
use tokio::task::JoinHandle;

/// Set or clear the HTTP/HTTPS proxy for all outbound reqwest HTTP clients.
#[tauri::command]
fn set_proxy_url(proxy_url: String) {
    if proxy_url.trim().is_empty() {
        unsafe {
            std::env::remove_var("HTTP_PROXY");
            std::env::remove_var("HTTPS_PROXY");
            std::env::remove_var("http_proxy");
            std::env::remove_var("https_proxy");
        }
    } else {
        let url = proxy_url.trim().to_string();
        unsafe {
            std::env::set_var("HTTP_PROXY", &url);
            std::env::set_var("HTTPS_PROXY", &url);
            std::env::set_var("http_proxy", &url);
            std::env::set_var("https_proxy", &url);
        }
    }
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
use tauri_nspanel::{cocoa::appkit::NSWindowCollectionBehavior, panel_delegate, WebviewWindowExt};

#[derive(Default)]
pub struct AudioState {
    stream_task: Arc<Mutex<Option<JoinHandle<()>>>>,
    vad_config: Arc<Mutex<VadConfig>>,
    is_capturing: Arc<Mutex<bool>>,
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn runtime_or_build_env(keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    for key in keys {
        let value = match *key {
            "NIUMA_CONTENT_DIR" => option_env!("NIUMA_CONTENT_DIR"),
            "NIUMA_HOME" => option_env!("NIUMA_HOME"),
            "NIUMA_ROOT_DIR" => option_env!("NIUMA_ROOT_DIR"),
            "NIUMA_ARTIFACT_DIR" => option_env!("NIUMA_ARTIFACT_DIR"),
            "NIUMA_ARTICLES_DIR" => option_env!("NIUMA_ARTICLES_DIR"),
            _ => None,
        };
        if let Some(found) = value {
            let trimmed = found.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}

fn resolve_existing_dir(candidates: Vec<std::path::PathBuf>) -> String {
    for candidate in candidates {
        if candidate.exists() {
            let normalized = candidate.canonicalize().unwrap_or(candidate);
            return normalized.to_string_lossy().to_string();
        }
    }
    String::new()
}

/// Return the base project root that contains `.teams`.
/// Priority: env override -> dev manifest parent -> CWD -> resource dir.
#[tauri::command]
fn get_niuma_root_dir(app: tauri::AppHandle) -> String {
    // If env points directly at `.teams`, return its parent.
    if let Some(configured) =
        runtime_or_build_env(&["NIUMA_CONTENT_DIR", "NIUMA_HOME", "NIUMA_ROOT_DIR"])
    {
        let configured_path = std::path::PathBuf::from(configured);
        let file_name = configured_path
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case(".teams"))
            .unwrap_or(false);

        if file_name {
            if let Some(parent) = configured_path.parent() {
                return parent
                    .canonicalize()
                    .unwrap_or_else(|_| parent.to_path_buf())
                    .to_string_lossy()
                    .to_string();
            }
        }

        // If env points at project root, accept it as-is.
        if configured_path.join(".teams").is_dir() {
            return configured_path
                .canonicalize()
                .unwrap_or(configured_path)
                .to_string_lossy()
                .to_string();
        }
    }

    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_root = manifest_dir.join("..");
    if dev_root.join(".teams").is_dir() {
        return dev_root
            .canonicalize()
            .unwrap_or(dev_root)
            .to_string_lossy()
            .to_string();
    }

    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join(".teams").is_dir() {
            return cwd
                .canonicalize()
                .unwrap_or(cwd)
                .to_string_lossy()
                .to_string();
        }
    }

    if let Ok(res) = app.path().resource_dir() {
        if res.join(".teams").is_dir() {
            return res
                .canonicalize()
                .unwrap_or(res)
                .to_string_lossy()
                .to_string();
        }
    }

    String::new()
}

fn yaml_scalar(raw: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}:");
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some(rest) = trimmed.strip_prefix(&prefix) {
            let value = rest.trim().trim_matches('"').trim_matches('\'').trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn is_catalog_team_yaml(raw: &str) -> bool {
    yaml_scalar(raw, "surface").as_deref() == Some("catalog")
        || yaml_scalar(raw, "workbench").as_deref() == Some("false")
}

fn catalog_team_dir(root: &std::path::Path) -> Option<std::path::PathBuf> {
    let teams = root.join(".teams");
    let mut dirs: Vec<std::path::PathBuf> = std::fs::read_dir(&teams)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect();
    dirs.sort();
    for dir in dirs {
        let team_yaml = dir.join("team.yaml");
        let config_yaml = dir.join("config.yaml");
        let path = if team_yaml.is_file() {
            team_yaml
        } else {
            config_yaml
        };
        let Ok(raw) = std::fs::read_to_string(path) else {
            continue;
        };
        if is_catalog_team_yaml(&raw) {
            return Some(dir);
        }
    }
    None
}

fn niuma_catalog_subdir(root: &str, sub: &str) -> Option<std::path::PathBuf> {
    catalog_team_dir(std::path::Path::new(root)).map(|dir| dir.join(sub))
}

fn resolve_catalog_subdir(app: tauri::AppHandle, sub: &str) -> String {
    let root = get_niuma_root_dir(app);
    if root.is_empty() {
        return String::new();
    }
    let Some(dir) = niuma_catalog_subdir(&root, sub) else {
        return String::new();
    };
    resolve_existing_dir(vec![dir])
}

/// Return the catalog pack's commands directory (`commandDir` team folder).
#[tauri::command]
fn get_niuma_commands_dir(app: tauri::AppHandle) -> String {
    resolve_catalog_subdir(app, "commands")
}

/// Return the catalog pack's agents directory.
#[tauri::command]
fn get_niuma_agents_dir(app: tauri::AppHandle) -> String {
    resolve_catalog_subdir(app, "agents")
}

/// Return the catalog pack's skills directory.
#[tauri::command]
fn get_niuma_skills_dir(app: tauri::AppHandle) -> String {
    resolve_catalog_subdir(app, "skills")
}

/// Return candidate artifact directories.
/// Priority: `<root>/.artifacts/drafts` -> configured env dir -> dev/cwd/resources -> document_dir/.artifacts.
#[tauri::command]
fn get_artifact_dirs(app: tauri::AppHandle) -> Vec<String> {
    let mut results: Vec<String> = Vec::new();

    let normalize = |candidate: std::path::PathBuf| {
        candidate
            .canonicalize()
            .unwrap_or(candidate)
            .to_string_lossy()
            .to_string()
    };

    let push_unique = |results: &mut Vec<String>, value: String| {
        if !results.iter().any(|item| item.eq_ignore_ascii_case(&value)) {
            results.push(value);
        }
    };

    let push_if_exists = |results: &mut Vec<String>, candidate: std::path::PathBuf| {
        if candidate.exists() {
            push_unique(results, normalize(candidate));
        }
    };

    // Content team co-edit root: <niuma_root>/.artifacts/drafts
    let niuma_root = get_niuma_root_dir(app.clone());
    if !niuma_root.is_empty() {
        let drafts = std::path::PathBuf::from(&niuma_root)
            .join(".artifacts")
            .join("drafts");
        let _ = std::fs::create_dir_all(&drafts);
        push_unique(&mut results, normalize(drafts));
    }

    if let Some(configured) = runtime_or_build_env(&["NIUMA_ARTIFACT_DIR", "NIUMA_ARTICLES_DIR"]) {
        let configured_path = std::path::PathBuf::from(configured);
        if configured_path.exists() {
            push_unique(&mut results, normalize(configured_path));
        }
    }

    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    push_if_exists(
        &mut results,
        manifest_dir.join("..").join(".artifacts"),
    );

    if let Ok(cwd) = std::env::current_dir() {
        push_if_exists(&mut results, cwd.join(".artifacts"));
    }

    if let Ok(res) = app.path().resource_dir() {
        push_if_exists(&mut results, res.join(".artifacts"));
    }

    if let Ok(doc) = app.path().document_dir() {
        push_if_exists(&mut results, doc.join(".artifacts"));
    }

    if results.is_empty() {
        if let Ok(doc) = app.path().document_dir() {
            let candidate = doc.join(".artifacts");
            push_unique(&mut results, normalize(candidate));
        }
    }

    results
}

#[tauri::command]
fn get_articles_dirs(app: tauri::AppHandle) -> Vec<String> {
    get_artifact_dirs(app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Get PostHog API key
    let posthog_api_key = option_env!("POSTHOG_API_KEY").unwrap_or("").to_string();
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:niuma.db", db::migrations())
                .build(),
        )
        .manage(AudioState::default())
        .manage(CaptureState::default())
        .manage(mcp::McpSessions::default())
        .manage(unified::UnifiedManager::default())
        .manage(shortcuts::RegisteredShortcuts::default())
        .manage(shortcuts::LicenseState::default())
        .manage(shortcuts::MoveWindowState::default())
        .manage(zero_token::ZeroTokenState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_keychain::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init()) // Add shell plugin
        .plugin(posthog_init(PostHogConfig {
            api_key: posthog_api_key,
            options: Some(PostHogOptions {
                // disable session recording
                disable_session_recording: Some(true),
                // disable pageview
                capture_pageview: Some(false),
                // disable pageleave
                capture_pageleave: Some(false),
                ..Default::default()
            }),
            ..Default::default()
        }))
        .plugin(tauri_plugin_machine_uid::init());
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }
    #[cfg(target_os = "windows")]
    {
        builder = builder.manage(shortcuts::WindowVisibility {
            is_hidden: Mutex::new(false),
        });
    }
    #[allow(unused_mut)]
    let mut builder = builder
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            window::set_window_height,
            window::open_dashboard,
            window::open_dashboard_at,
            window::toggle_dashboard,
            window::open_agent_chat_window,
            window::hide_agent_chat_window,
            window::toggle_agent_chat_maximize,
            window::move_window,
            capture::capture_to_base64,
            capture::start_screen_capture,
            capture::capture_selected_area,
            capture::save_capture_snapshot,
            capture::save_transcript_file,
            capture::close_overlay_window,
            shortcuts::check_shortcuts_registered,
            shortcuts::get_registered_shortcuts,
            shortcuts::update_shortcuts,
            shortcuts::validate_shortcut_key,
            shortcuts::set_license_status,
            shortcuts::set_app_icon_visibility,
            shortcuts::set_always_on_top,
            shortcuts::exit_app,
            window::set_content_protected,
            activate::activate_license_api,
            activate::deactivate_license_api,
            activate::validate_license_api,
            activate::mask_license_key_cmd,
            activate::get_checkout_url,
            activate::secure_storage_save,
            activate::secure_storage_get,
            activate::secure_storage_remove,
            api::transcribe_audio,
            api::chat_stream_response,
            api::fetch_models,
            api::create_system_prompt,
            api::check_license_status,
            api::get_activity,
            speaker::start_system_audio_capture,
            speaker::stop_system_audio_capture,
            speaker::manual_stop_continuous,
            speaker::check_system_audio_access,
            speaker::request_system_audio_access,
            speaker::get_vad_config,
            speaker::update_vad_config,
            speaker::get_capture_status,
            speaker::get_audio_sample_rate,
            sandbox::run_sandboxed_command,
            fs_tools::fs_read,
            fs_tools::fs_write,
            fs_tools::fs_edit,
            fs_tools::fs_list,
            fs_tools::fs_grep,
            fs_tools::read_text_file,
            fs_tools::write_text_file,
            fs_tools::write_binary_file,
            fs_tools::read_binary_file,
            fs_tools::list_directory,
            fs_tools::remove_file,
            search_tools::search_local_files,
            search_tools::quick_search_local,
            search_tools::web_search,
            http_tools::http_request,
            get_niuma_agents_dir,
            get_niuma_skills_dir,
            get_niuma_root_dir,
            get_niuma_commands_dir,
            get_artifact_dirs,
            get_articles_dirs,
            mcp::mcp_inspect,
            mcp::mcp_call_tool,
            mcp::mcp_read_resource,
            mcp::mcp_get_prompt,
            unified::unified_api_set_config,
            unified::unified_api_start,
            unified::unified_api_stop,
            unified::unified_api_get_status,
            unified::unified_api_log,
            unified::unified_api_get_logs,
            unified::unified_api_clear_logs,
            unified::unified_api_get_stats,
            zero_token::zt_ensure_window,
            zero_token::zt_open_auth_window,
            zero_token::zt_hide_window,
            zero_token::zt_eval_script,
            zero_token::zt_window_exists,
            zero_token::zt_report_result,
            health::health_save_attachment,
            set_proxy_url,
        ])
        .setup(|app| {
            // Setup main window positioning
            window::setup_main_window(app).expect("Failed to setup main window");
            #[cfg(target_os = "macos")]
            init(app.app_handle());

            let app_handle = app.handle();
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;

                #[allow(deprecated, unexpected_cfgs)]
                if let Err(e) = app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    Some(vec![]),
                )) {
                    eprintln!("Failed to initialize autostart plugin: {}", e);
                }
            }

            // Initialize global shortcut plugin with centralized handler
            app.handle()
                .plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};

                            let action_id = {
                                let state = app.state::<shortcuts::RegisteredShortcuts>();
                                let registered = match state.shortcuts.lock() {
                                    Ok(guard) => guard,
                                    Err(poisoned) => {
                                        eprintln!("Mutex poisoned in handler, recovering...");
                                        poisoned.into_inner()
                                    }
                                };

                                registered.iter().find_map(|(action_id, shortcut_str)| {
                                    if let Ok(s) = shortcut_str.parse::<Shortcut>() {
                                        if &s == shortcut {
                                            return Some(action_id.clone());
                                        }
                                    }
                                    None
                                })
                            };

                            if let Some(action_id) = action_id {
                                match event.state() {
                                    ShortcutState::Pressed => {
                                        if let Some(direction) =
                                            action_id.strip_prefix("move_window_")
                                        {
                                            shortcuts::start_move_window(app, direction);
                                        } else {
                                            eprintln!("Shortcut triggered: {}", action_id);
                                            shortcuts::handle_shortcut_action(app, &action_id);
                                        }
                                    }
                                    ShortcutState::Released => {
                                        if let Some(direction) =
                                            action_id.strip_prefix("move_window_")
                                        {
                                            shortcuts::stop_move_window(app, direction);
                                        }
                                    }
                                }
                            }
                        })
                        .build(),
                )
                .expect("Failed to initialize global shortcut plugin");
            if let Err(e) = shortcuts::setup_global_shortcuts(app.handle()) {
                eprintln!("Failed to setup global shortcuts: {}", e);
            }
            // Create both secondary windows AFTER global_shortcut plugin is managed.
            // Creating them earlier causes a panic: the second WebView2 init
            // pumps the message loop, which fires the first window's IPC and
            // hits GlobalShortcut state before it has been registered.
            if app_handle.get_webview_window("dashboard").is_none() {
                if let Err(e) = window::create_dashboard_window(app_handle, false) {
                    eprintln!("Failed to create dashboard window on startup: {}", e);
                }
            }
            if app_handle.get_webview_window("agent-chat").is_none() {
                if let Err(e) = window::create_agent_chat_window(app_handle, false) {
                    eprintln!("Failed to create agent-chat window on startup: {}", e);
                }
            }
            Ok(())
        });

    // Add macOS-specific permissions plugin
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_plugin_macos_permissions::init());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_os = "macos")]
#[allow(deprecated, unexpected_cfgs)]
fn init(app_handle: &AppHandle) {
    let window: WebviewWindow = app_handle.get_webview_window("main").unwrap();

    let panel = window.to_panel().unwrap();

    let delegate = panel_delegate!(MyPanelDelegate {
        window_did_become_key,
        window_did_resign_key
    });

    let handle = app_handle.to_owned();

    delegate.set_listener(Box::new(move |delegate_name: String| {
        match delegate_name.as_str() {
            "window_did_become_key" => {
                let app_name = handle.package_info().name.to_owned();

                println!("[info]: {:?} panel becomes key window!", app_name);
            }
            "window_did_resign_key" => {
                println!("[info]: panel resigned from key window!");
            }
            _ => (),
        }
    }));

    // Set the window to float level
    #[allow(non_upper_case_globals)]
    const NSFloatWindowLevel: i32 = 4;
    panel.set_level(NSFloatWindowLevel);

    #[allow(non_upper_case_globals)]
    const NSWindowStyleMaskNonActivatingPanel: i32 = 1 << 7;
    panel.set_style_mask(NSWindowStyleMaskNonActivatingPanel);

    #[allow(deprecated)]
    panel.set_collection_behaviour(
        NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces,
    );

    panel.set_delegate(delegate);
}
