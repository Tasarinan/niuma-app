use crate::niuma_config;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

fn plain_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    text.strip_prefix(r"\\?\")
        .unwrap_or(text.as_ref())
        .to_string()
}

fn workspace_root() -> Option<PathBuf> {
    niuma_config::resolve_workspace_root(None)
}

fn legacy_sqlite_candidates(workspace: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    paths.push(niuma_config::niuma_config_dir_for_root(workspace).join("niuma.db"));
    paths.push(workspace.join(".artifacts").join("sqlite").join("niuma.db"));
    if let Some(legacy) = niuma_config::legacy_app_data_dir_from_env() {
        paths.push(legacy.join("niuma.db"));
    }
    paths
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

    let _ = niuma_config::ensure_workspace_runtime_dirs(&root);
    let _ = niuma_config::migrate_legacy_app_data_if_needed(None);
    let _ = niuma_config::migrate_sqlite_into_config_dir(&root);

    let dest = niuma_config::sqlite_file_path(&root);
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let dest = dest
        .parent()
        .and_then(|dir| dir.canonicalize().ok())
        .map(|dir| dir.join("niuma.db"))
        .unwrap_or(dest);

    if !dest.is_file() {
        for legacy in legacy_sqlite_candidates(&root) {
            if !legacy.is_file() || legacy == dest {
                continue;
            }
            match copy_sqlite_family(&legacy, &dest) {
                Ok(()) => {
                    eprintln!(
                        "Copied SQLite database from {} to {}",
                        plain_path(&legacy),
                        plain_path(&dest)
                    );
                    break;
                }
                Err(err) => {
                    eprintln!(
                        "Could not copy SQLite database from {} to {} ({err})",
                        plain_path(&legacy),
                        plain_path(&dest),
                    );
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
    use super::*;
    use std::path::Path;

    #[test]
    fn sqlite_file_lives_under_niumaconfig() {
        let path = niuma_config::sqlite_file_path(Path::new("C:/repo/niuma-app"));
        let text = path.to_string_lossy().replace('\\', "/");
        assert!(text.ends_with(".niumaconfig/sqlite/niuma.db"));
    }
}
