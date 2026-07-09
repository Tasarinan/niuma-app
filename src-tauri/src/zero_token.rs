//! Zero-token WebView manager
//!
//! Maintains a hidden WebviewWindow per platform (doubao, deepseek, qwen).
//! The frontend can:
//!   - Ensure the window exists (created invisibly)
//!   - Open it for user login
//!   - Hide it after login
//!   - Evaluate JavaScript inside it (for API relay)
//!
//! JavaScript injected via `zt_eval_script` runs in the platform origin and
//! carries the user's browser cookies automatically — no extraction needed.

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

// ─── State ────────────────────────────────────────────────────────────────────

pub struct ZeroTokenState {
    /// platform id → WebviewWindow label (e.g. "zt-doubao")
    pub windows: Mutex<HashMap<String, String>>,
}

impl Default for ZeroTokenState {
    fn default() -> Self {
        Self {
            windows: Mutex::new(HashMap::new()),
        }
    }
}

// ─── Platform config ──────────────────────────────────────────────────────────

struct PlatformConfig {
    url: &'static str,
    title: &'static str,
}

fn platform_config(platform: &str) -> Option<PlatformConfig> {
    match platform {
        "doubao" => Some(PlatformConfig {
            url: "https://www.doubao.com/chat/",
            title: "豆包 Doubao (zero-token)",
        }),
        "deepseek" => Some(PlatformConfig {
            url: "https://chat.deepseek.com",
            title: "DeepSeek (zero-token)",
        }),
        "qwen" => Some(PlatformConfig {
            url: "https://chat.qwen.ai",
            title: "Qwen (zero-token)",
        }),
        _ => None,
    }
}

fn window_label(platform: &str) -> String {
    format!("zt-{}", platform)
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Ensure the WebView window for a platform exists.
/// Creates it hidden in the background if it doesn't exist yet.
#[tauri::command]
pub async fn zt_ensure_window(
    platform: String,
    state: State<'_, ZeroTokenState>,
    app: AppHandle,
) -> Result<(), String> {
    let label = window_label(&platform);
    let cfg =
        platform_config(&platform).ok_or_else(|| format!("Unknown platform: {}", platform))?;

    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let url = WebviewUrl::External(
        cfg.url
            .parse()
            .map_err(|e| format!("Bad URL: {}", e))?,
    );

    WebviewWindowBuilder::new(&app, label.clone(), url)
        .title(cfg.title)
        .inner_size(1280.0, 800.0)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    let mut map = state.windows.lock().unwrap();
    map.insert(platform, label);

    Ok(())
}

/// Show the WebView window so the user can log in.
#[tauri::command]
pub async fn zt_open_auth_window(
    platform: String,
    url: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    let label = window_label(&platform);

    if app.get_webview_window(&label).is_none() {
        let cfg = platform_config(&platform)
            .ok_or_else(|| format!("Unknown platform: {}", platform))?;
        let nav_url = url.as_deref().unwrap_or(cfg.url);
        let webview_url =
            WebviewUrl::External(nav_url.parse().map_err(|e| format!("Bad URL: {}", e))?);

        WebviewWindowBuilder::new(&app, label.clone(), webview_url)
            .title(cfg.title)
            .inner_size(1280.0, 800.0)
            .visible(true)
            .build()
            .map_err(|e| format!("Failed to create window: {}", e))?;
    } else {
        let win = app
            .get_webview_window(&label)
            .ok_or_else(|| format!("Window {} not found", label))?;
        win.show()
            .map_err(|e| format!("Failed to show window: {}", e))?;
        win.set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;
    }

    Ok(())
}

/// Hide the WebView window (keeps session alive in background).
#[tauri::command]
pub async fn zt_hide_window(platform: String, app: AppHandle) -> Result<(), String> {
    let label = window_label(&platform);
    if let Some(win) = app.get_webview_window(&label) {
        win.hide()
            .map_err(|e| format!("Failed to hide window: {}", e))?;
    }
    Ok(())
}

/// Fire-and-forget script injection.
/// Use `zt_eval_script` together with Tauri events to retrieve return values.
#[tauri::command]
pub async fn zt_eval_script(
    platform: String,
    script: String,
    app: AppHandle,
) -> Result<(), String> {
    let label = window_label(&platform);
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window {} not found — call zt_ensure_window first", label))?;

    win.eval(&script)
        .map_err(|e| format!("eval failed: {}", e))?;

    Ok(())
}

/// Check whether the platform window exists and is visible.
#[tauri::command]
pub async fn zt_window_exists(platform: String, app: AppHandle) -> bool {
    let label = window_label(&platform);
    app.get_webview_window(&label).is_some()
}

/// Receive a result from an injected script running in an external webview and
/// re-broadcast it as a Tauri event to all windows (including the main window).
///
/// External webviews cannot reliably call `plugin:event|emit` directly, but
/// they CAN call custom Tauri commands via `window.__TAURI_INTERNALS__.invoke`.
/// This command acts as the relay.
#[tauri::command]
pub async fn zt_report_result(
    app: AppHandle,
    request_id: String,
    result_json: String,
) -> Result<(), String> {
    #[derive(Clone, serde::Serialize)]
    struct Payload {
        #[serde(rename = "requestId")]
        request_id: String,
        result: serde_json::Value,
    }

    let result: serde_json::Value = serde_json::from_str(&result_json).unwrap_or_else(|_| {
        serde_json::json!({ "ok": false, "error": "Browser window returned invalid JSON" })
    });

    app.emit("zero-token-result", Payload { request_id, result })
        .map_err(|e| format!("Failed to broadcast zero-token-result: {}", e))?;

    Ok(())
}
