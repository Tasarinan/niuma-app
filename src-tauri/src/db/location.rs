use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

const APP_ID: &str = "com.niuma.desktop";

fn plain_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    text.strip_prefix(r"\\?\")
        .unwrap_or(text.as_ref())
        .to_string()
}

/// Workspace root that contains `.teams`, without the installed-app resource fallback.
fn workspace_root() -> Option<PathBuf> {
    if let Some(configured) =
        crate::runtime_or_build_env(&["NIUMA_CONTENT_DIR", "NIUMA_HOME", "NIUMA_ROOT_DIR"])
    {
        let configured_path = PathBuf::from(configured);
        let is_teams = configured_path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case(".teams"));
        if is_teams {
            if let Some(parent) = configured_path.parent() {
                return Some(parent.to_path_buf());
            }
        }
        if configured_path.join(".teams").is_dir() {
            return Some(configured_path);
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_root = manifest_dir.join("..");
    if dev_root.join(".teams").is_dir() {
        return Some(dev_root);
    }

    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join(".teams").is_dir() {
            return Some(cwd);
        }
    }

    None
}

fn sqlite_file_path(root: &Path) -> PathBuf {
    root.join(".artifacts").join("sqlite").join("niuma.db")
}

fn legacy_sqlite_file() -> Option<PathBuf> {
    let base = if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|home| {
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
        })
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
    }?;
    let path = base.join(APP_ID).join("niuma.db");
    path.is_file().then_some(path)
}

fn copy_sqlite_family(src: &Path, dest: &Path) -> std::io::Result<()> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(src, dest)?;
    for suffix in ["-wal", "-shm"] {
        let from = PathBuf::from(format!("{}{suffix}", src.display()));
        if !from.is_file() {
            continue;
        }
        let to = PathBuf::from(format!("{}{suffix}", dest.display()));
        fs::copy(&from, &to)?;
    }
    Ok(())
}

fn prepare_sqlite_url() -> String {
    let Some(root) = workspace_root() else {
        return "sqlite:niuma.db".to_string();
    };
    let dest = sqlite_file_path(&root);
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let dest = dest
        .parent()
        .and_then(|dir| dir.canonicalize().ok())
        .map(|dir| dir.join("niuma.db"))
        .unwrap_or(dest);

    if !dest.is_file() {
        if let Some(legacy) = legacy_sqlite_file() {
            match copy_sqlite_family(&legacy, &dest) {
                Ok(()) => eprintln!("Copied SQLite database to {}", plain_path(&dest)),
                Err(err) => {
                    eprintln!(
                        "Could not copy SQLite database to {} ({err}); still using {}",
                        plain_path(&dest),
                        plain_path(&legacy)
                    );
                    let _ = fs::remove_file(&dest);
                    return format!("sqlite:{}", plain_path(&legacy));
                }
            }
        }
    }

    format!("sqlite:{}", plain_path(&dest))
}

/// Connection string registered with tauri-plugin-sql. Absolute paths are opened as-is.
pub fn sqlite_connection_url() -> String {
    static URL: OnceLock<String> = OnceLock::new();
    URL.get_or_init(prepare_sqlite_url).clone()
}

#[cfg(test)]
mod tests {
    use super::sqlite_file_path;
    use std::path::Path;

    #[test]
    fn sqlite_file_lives_under_artifacts() {
        let path = sqlite_file_path(Path::new("C:/repo/niuma-app"));
        let text = path.to_string_lossy().replace('\\', "/");
        assert!(text.ends_with(".artifacts/sqlite/niuma.db"));
    }
}
