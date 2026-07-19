use std::path::{Path, PathBuf};

fn find_env_file() -> Option<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }
    roots.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".."));

    for root in roots {
        let mut current = Some(root.as_path());
        while let Some(dir) = current {
            for file_name in [".env.local", ".env"] {
                let candidate = dir.join(file_name);
                if candidate.exists() {
                    return Some(candidate);
                }
            }
            current = dir.parent();
        }
    }

    None
}

fn resolve_env_relative(env_dir: &Path, value: &str) -> PathBuf {
    let candidate = PathBuf::from(value);
    if candidate.is_absolute() {
        candidate
    } else {
        env_dir.join(candidate)
    }
}

fn main() {
    let env_file = find_env_file();
    if let Some(path) = env_file.as_ref() {
        let _ = dotenv::from_path(path);
        println!("cargo:rerun-if-changed={}", path.display());
    } else {
        dotenv::dotenv().ok();
    }

    println!("cargo:rerun-if-env-changed=NIUMA_ARTIFACT_DIR");
    println!("cargo:rerun-if-env-changed=NIUMA_ARTICLES_DIR");
    println!("cargo:rerun-if-env-changed=NIUMA_CLAWPACKS_DIR");

    let configured_artifact_dir = std::env::var("NIUMA_ARTIFACT_DIR")
        .or_else(|_| std::env::var("NIUMA_ARTICLES_DIR"));

    if let (Some(env_file), Ok(artifact_dir)) = (env_file.as_ref(), configured_artifact_dir) {
        if let Some(env_dir) = env_file.parent() {
            let resolved = resolve_env_relative(env_dir, &artifact_dir);
            println!("cargo:rustc-env=NIUMA_ARTIFACT_DIR={}", resolved.to_string_lossy());
        }
    }

    if let (Some(env_file), Ok(clawpacks_dir)) = (env_file.as_ref(), std::env::var("NIUMA_CLAWPACKS_DIR")) {
        if let Some(env_dir) = env_file.parent() {
            let resolved = resolve_env_relative(env_dir, &clawpacks_dir);
            println!("cargo:rustc-env=NIUMA_CLAWPACKS_DIR={}", resolved.to_string_lossy());
        }
    }

    if let Ok(payment_endpoint) = std::env::var("PAYMENT_ENDPOINT") {
        println!("cargo:rustc-env=PAYMENT_ENDPOINT={}", payment_endpoint);
    }

    if let Ok(api_access_key) = std::env::var("API_ACCESS_KEY") {
        println!("cargo:rustc-env=API_ACCESS_KEY={}", api_access_key);
    }

    if let Ok(app_endpoint) = std::env::var("APP_ENDPOINT") {
        println!("cargo:rustc-env=APP_ENDPOINT={}", app_endpoint);
    }

    if let Ok(posthog_api_key) = std::env::var("POSTHOG_API_KEY") {
        println!("cargo:rustc-env=POSTHOG_API_KEY={}", posthog_api_key);
    }

    tauri_build::build()
}
