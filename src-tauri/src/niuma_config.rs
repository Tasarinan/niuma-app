//! Workspace-local app configuration under `<workspace>/.niumaconfig` (sibling of `.teams`).
//! Replaces `%AppData%/com.niuma.desktop` for portable, user-owned data.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub const CONFIG_DIR_NAME: &str = ".niumaconfig";
pub const SETTINGS_FILE_NAME: &str = "setting.json";
pub const LEGACY_APP_ID: &str = "com.niuma.desktop";

/// `.teams` in dev sits at `<root>/.teams`. Bundled apps may use `$RESOURCE/.teams/`
/// or legacy `$RESOURCE/_up_/.teams/`.
pub fn find_teams_dir(base: &Path) -> Option<PathBuf> {
    [base.join(".teams"), base.join("_up_").join(".teams")]
        .into_iter()
        .find(|candidate| candidate.is_dir())
}

fn workspace_root_from_teams(teams_dir: &Path) -> Option<PathBuf> {
    teams_dir.parent().map(|parent| parent.to_path_buf())
}

fn process_env_workspace_root() -> Option<PathBuf> {
    for key in ["NIUMA_CONTENT_DIR", "NIUMA_HOME", "NIUMA_ROOT_DIR"] {
        let Ok(value) = std::env::var(key) else { continue };
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }
        let configured_path = PathBuf::from(trimmed);
        let points_at_teams = configured_path
            .file_name()
            .and_then(|s| s.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case(".teams"));
        if points_at_teams {
            if let Some(parent) = configured_path.parent() {
                return Some(parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf()));
            }
        }
        if configured_path.join(".teams").is_dir() {
            return Some(configured_path.canonicalize().unwrap_or(configured_path));
        }
    }
    None
}

fn dev_workspace_root() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_root = manifest_dir.join("..");
    if dev_root.join(".teams").is_dir() {
        return Some(dev_root.canonicalize().unwrap_or(dev_root));
    }
    None
}

fn cwd_workspace_root() -> Option<PathBuf> {
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join(".teams").is_dir() {
            return Some(cwd.canonicalize().unwrap_or(cwd));
        }
    }
    None
}

fn exe_workspace_root() -> Option<PathBuf> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            if let Some(teams) = find_teams_dir(exe_dir) {
                if let Some(root) = workspace_root_from_teams(&teams) {
                    return Some(root.canonicalize().unwrap_or(root));
                }
            }
        }
    }
    None
}

fn app_workspace_root(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(exe_dir) = app.path().executable_dir() {
        if let Some(teams) = find_teams_dir(&exe_dir) {
            if let Some(root) = workspace_root_from_teams(&teams) {
                return Some(root.canonicalize().unwrap_or(root));
            }
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        if let Some(teams) = find_teams_dir(&res) {
            if let Some(root) = workspace_root_from_teams(&teams) {
                return Some(root.canonicalize().unwrap_or(root));
            }
        }
    }
    None
}

/// Workspace root containing `.teams`.
/// Portable/release: prefer the folder next to the exe when it has `.teams`.
/// Dev (`tauri dev`): exe has no sibling `.teams`, so fall back to cwd / crate parent.
pub fn resolve_workspace_root(app: Option<&AppHandle>) -> Option<PathBuf> {
    process_env_workspace_root()
        .or_else(|| app.and_then(app_workspace_root))
        .or_else(exe_workspace_root)
        .or_else(cwd_workspace_root)
        .or_else(dev_workspace_root)
}

pub fn niuma_config_dir_for_root(workspace_root: &Path) -> PathBuf {
    workspace_root.join(CONFIG_DIR_NAME)
}

pub fn ensure_niuma_config_dir(workspace_root: &Path) -> Result<PathBuf, String> {
    let dir = niuma_config_dir_for_root(workspace_root);
    fs::create_dir_all(&dir).map_err(|e| format!("create {CONFIG_DIR_NAME} failed: {e}"))?;
    Ok(dir)
}

pub fn settings_json_path(workspace_root: &Path) -> PathBuf {
    niuma_config_dir_for_root(workspace_root).join(SETTINGS_FILE_NAME)
}

pub fn ensure_workspace_runtime_dirs(workspace_root: &Path) -> Result<(), String> {
    ensure_niuma_config_dir(workspace_root)?;
    let artifacts = workspace_root.join(".artifacts").join("drafts");
    fs::create_dir_all(&artifacts).map_err(|e| format!("create .artifacts/drafts failed: {e}"))?;
    let sqlite = sqlite_file_path(workspace_root);
    if let Some(parent) = sqlite.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create .niumaconfig/sqlite failed: {e}"))?;
    }
    Ok(())
}

pub fn sqlite_file_path(workspace_root: &Path) -> PathBuf {
    niuma_config_dir_for_root(workspace_root)
        .join("sqlite")
        .join("niuma.db")
}

fn move_sqlite_family(src_db: &Path, dest_db: &Path) -> Result<(), String> {
    move_entry(src_db, dest_db)?;
    for suffix in ["-wal", "-shm"] {
        let from = PathBuf::from(format!("{}{suffix}", src_db.display()));
        if from.is_file() {
            let to = PathBuf::from(format!("{}{suffix}", dest_db.display()));
            move_entry(&from, &to)?;
        }
    }
    Ok(())
}

/// Move `.artifacts/sqlite/niuma.db` (and flat legacy paths) into `.niumaconfig/sqlite/`.
pub fn migrate_sqlite_into_config_dir(workspace_root: &Path) -> Result<(), String> {
    ensure_niuma_config_dir(workspace_root)?;
    let dest = sqlite_file_path(workspace_root);
    if dest.is_file() {
        return Ok(());
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir sqlite dir: {e}"))?;
    }

    let config_dir = niuma_config_dir_for_root(workspace_root);
    let candidates = [
        workspace_root.join(".artifacts").join("sqlite").join("niuma.db"),
        config_dir.join("niuma.db"),
    ];

    for src in candidates {
        if !src.is_file() {
            continue;
        }
        if move_sqlite_family(&src, &dest).is_ok() {
            let legacy_sqlite_dir = workspace_root.join(".artifacts").join("sqlite");
            if legacy_sqlite_dir.is_dir()
                && fs::read_dir(&legacy_sqlite_dir)
                    .map(|mut d| d.next().is_none())
                    .unwrap_or(false)
            {
                let _ = fs::remove_dir(&legacy_sqlite_dir);
            }
            break;
        }
    }
    Ok(())
}

pub fn legacy_app_data_dir(app: Option<&AppHandle>) -> Option<PathBuf> {
    if let Some(handle) = app {
        if let Ok(path) = handle.path().app_data_dir() {
            return Some(path);
        }
    }
    legacy_app_data_dir_from_env()
}

pub fn legacy_app_data_dir_from_env() -> Option<PathBuf> {
    if cfg!(target_os = "windows") {
        return std::env::var_os("APPDATA")
            .map(|base| PathBuf::from(base).join(LEGACY_APP_ID));
    }
    if cfg!(target_os = "macos") {
        return std::env::var_os("HOME").map(|home| {
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join(LEGACY_APP_ID)
        });
    }
    std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
        .map(|base| base.join(LEGACY_APP_ID))
}

fn move_entry(src: &Path, dest: &Path) -> Result<(), String> {
    if dest.exists() {
        return Ok(());
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir {parent:?}: {e}"))?;
    }
    match fs::rename(src, dest) {
        Ok(()) => Ok(()),
        Err(_) => {
            if src.is_dir() {
                copy_dir_recursive(src, dest)?;
                fs::remove_dir_all(src).map_err(|e| format!("remove old dir {src:?}: {e}"))?;
            } else {
                fs::copy(src, dest).map_err(|e| format!("copy {src:?} -> {dest:?}: {e}"))?;
                fs::remove_file(src).map_err(|e| format!("remove old file {src:?}: {e}"))?;
            }
            Ok(())
        }
    }
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("mkdir {dest:?}: {e}"))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read_dir {src:?}: {e}"))? {
        let entry = entry.map_err(|e| format!("read_dir entry: {e}"))?;
        let from = entry.path();
        let to = dest.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if !to.exists() {
            fs::copy(&from, &to).map_err(|e| format!("copy {from:?} -> {to:?}: {e}"))?;
        }
    }
    Ok(())
}

/// Move legacy `%AppData%/com.niuma.desktop` (etc.) into `<workspace>/.niumaconfig` once.
pub fn migrate_legacy_app_data_if_needed(app: Option<&AppHandle>) -> Result<(), String> {
    let workspace = match resolve_workspace_root(app) {
        Some(root) => root,
        None => return Ok(()),
    };
    ensure_workspace_runtime_dirs(&workspace)?;
    let config_dir = ensure_niuma_config_dir(&workspace)?;

    let legacy = legacy_app_data_dir(app).or_else(legacy_app_data_dir_from_env);
    if let Some(legacy_dir) = legacy {
        if legacy_dir.is_dir() {
            for entry in fs::read_dir(&legacy_dir)
                .map_err(|e| format!("read legacy app data {legacy_dir:?}: {e}"))?
            {
                let entry = entry.map_err(|e| format!("legacy entry: {e}"))?;
                let name = entry.file_name();
                let dest = config_dir.join(name);
                move_entry(&entry.path(), &dest)?;
            }
            // Remove legacy dir if empty
            if fs::read_dir(&legacy_dir)
                .map(|mut d| d.next().is_none())
                .unwrap_or(false)
            {
                let _ = fs::remove_dir(&legacy_dir);
            }
        }
    }

    migrate_sqlite_into_config_dir(&workspace)?;
    Ok(())
}

pub fn secure_storage_path(app: &AppHandle) -> Result<PathBuf, String> {
    let workspace = resolve_workspace_root(Some(app))
        .ok_or_else(|| format!("无法定位工作区（需要与 .teams 同级的 {CONFIG_DIR_NAME}）"))?;
    migrate_legacy_app_data_if_needed(Some(app))?;
    let config_dir = ensure_niuma_config_dir(&workspace)?;
    Ok(config_dir.join("secure_storage.json"))
}

#[tauri::command]
pub fn get_niuma_config_dir(app: AppHandle) -> Result<String, String> {
    migrate_legacy_app_data_if_needed(Some(&app))?;
    let workspace = resolve_workspace_root(Some(&app))
        .ok_or_else(|| "无法定位 Niuma 工作区：请把 .teams 放在应用目录旁，或设置 NIUMA_ROOT_DIR".to_string())?;
    let config_dir = ensure_niuma_config_dir(&workspace)?;
    Ok(config_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_workspace_settings(app: AppHandle) -> Result<Option<String>, String> {
    migrate_legacy_app_data_if_needed(Some(&app))?;
    let workspace = resolve_workspace_root(Some(&app))
        .ok_or_else(|| "无法定位 Niuma 工作区：请把 .teams 放在应用目录旁，或设置 NIUMA_ROOT_DIR".to_string())?;
    let path = settings_json_path(&workspace);
    if !path.is_file() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("read {SETTINGS_FILE_NAME}: {e}"))
}

#[tauri::command]
pub fn write_workspace_settings(app: AppHandle, contents: String) -> Result<(), String> {
    migrate_legacy_app_data_if_needed(Some(&app))?;
    let workspace = resolve_workspace_root(Some(&app))
        .ok_or_else(|| "无法定位 Niuma 工作区：请把 .teams 放在应用目录旁，或设置 NIUMA_ROOT_DIR".to_string())?;
    let path = settings_json_path(&workspace);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("create {CONFIG_DIR_NAME} failed: {e}"))?;
    }
    fs::write(&path, contents).map_err(|e| format!("write {SETTINGS_FILE_NAME}: {e}"))
}
