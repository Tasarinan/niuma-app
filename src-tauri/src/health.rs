//! Health attachment file storage.
//! Saves base64-encoded health images/documents to the app data directory and
//! returns the local file path + metadata for recording in the health DB.

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveHealthAttachmentRequest {
    /// Pure base64 data (no data-URL prefix).
    pub base64_data: String,
    /// MIME type, e.g. "image/jpeg".
    pub mime_type: String,
    /// Original file extension (without dot), e.g. "jpg".
    pub extension: String,
    /// When provided, save under `<workspace_root>/.niuma/artifacts/health/attachments/<YYYY>/<MM>/`
    /// instead of the app data directory.
    pub workspace_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveHealthAttachmentResponse {
    /// Stable UUID used as the primary key in health_attachments.
    pub id: String,
    /// Absolute path to the saved file.
    pub file_path: String,
    /// Bytes written.
    pub size_bytes: usize,
}

fn ext_from_mime(mime: &str) -> &str {
    match mime {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "application/pdf" => "pdf",
        _ => "bin",
    }
}

/// Save a base64-encoded health attachment to:
///   `<appData>/health/attachments/<YYYY>/<MM>/<uuid>.<ext>`
///
/// Returns the UUID, absolute path, and byte count.
#[tauri::command]
pub async fn health_save_attachment(
    app: tauri::AppHandle,
    request: SaveHealthAttachmentRequest,
) -> Result<SaveHealthAttachmentResponse, String> {
    // Decode base64 (strip data-URL prefix if present)
    let payload = request
        .base64_data
        .split_once(',')
        .map(|(_, v)| v)
        .unwrap_or(request.base64_data.as_str());

    let bytes = general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| format!("base64 decode error: {e}"))?;

    // Determine target directory
    let now = chrono_lite_yyyymm();

    let target_dir: PathBuf = match request
        .workspace_root
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        Some(root) => PathBuf::from(root)
            .join(".niuma")
            .join("artifacts")
            .join("health")
            .join("attachments")
            .join(&now.0)
            .join(&now.1),
        None => {
            let app_data = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir error: {e}"))?;
            app_data
                .join("health")
                .join("attachments")
                .join(&now.0)
                .join(&now.1)
        }
    };
    fs::create_dir_all(&target_dir).map_err(|e| format!("create_dir_all error: {e}"))?;

    // Generate unique filename
    let id = Uuid::new_v4().to_string();
    let ext = if request.extension.is_empty() {
        ext_from_mime(&request.mime_type)
    } else {
        request.extension.as_str()
    };
    let file_name = format!("{}.{}", id, ext);
    let file_path = target_dir.join(&file_name);

    let size_bytes = bytes.len();
    fs::write(&file_path, bytes).map_err(|e| format!("write error: {e}"))?;

    Ok(SaveHealthAttachmentResponse {
        id,
        file_path: file_path.to_string_lossy().to_string(),
        size_bytes,
    })
}

/// Returns (year, month) as zero-padded strings using the system clock without
/// pulling in a full datetime crate.
fn chrono_lite_yyyymm() -> (String, String) {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Rough year/month from epoch seconds (good enough for directory naming)
    // 86400 * 365.2425 ≈ 31_556_952
    let days = secs / 86400;
    let mut year = 1970u32;
    let mut remaining_days = days;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }
    let month_days: [u64; 12] = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1u32;
    for &md in &month_days {
        if remaining_days < md {
            break;
        }
        remaining_days -= md;
        month += 1;
    }
    (format!("{:04}", year), format!("{:02}", month))
}

fn is_leap(year: u32) -> bool {
    (year.is_multiple_of(4) && !year.is_multiple_of(100)) || year.is_multiple_of(400)
}
