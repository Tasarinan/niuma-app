//! Sandboxed command execution for the in-app Pi agent's `bash` tool.
//!
//! Runs an arbitrary command under one of three sandbox modes:
//! - `read-only`          : reads allowed, writes confined to temp dirs.
//! - `workspace-write`    : writes allowed inside the execution root + temp.
//! - `danger-full-access` : no restrictions.
//!
//! On macOS the confinement is enforced with `sandbox-exec` (Seatbelt). On
//! other platforms the process boundary + cleared environment provide a weaker
//! guarantee, and the mode is advertised via `NIUMA_SANDBOX_MODE` so tools can
//! self-restrict. Output is capped by a wall-clock timeout.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant};
use wait_timeout::ChildExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxRunRequest {
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    sandbox_mode: String,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SandboxRunResponse {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    timed_out: bool,
    duration_ms: u128,
    sandbox_backend: String,
}

/// Managed working directory used by the sandbox when no workspace is selected.
pub fn default_sandbox_dir() -> Result<PathBuf, String> {
    let mut dir = std::env::temp_dir();
    dir.push("niuma");
    dir.push("agent-sandbox");
    fs::create_dir_all(&dir).map_err(|e| format!("创建沙箱目录失败: {e}"))?;
    Ok(dir.canonicalize().unwrap_or(dir))
}

fn sandbox_temp_dir() -> Result<PathBuf, String> {
    let mut dir = default_sandbox_dir()?;
    dir.push("tmp");
    fs::create_dir_all(&dir).map_err(|e| format!("创建沙箱临时目录失败: {e}"))?;
    Ok(dir.canonicalize().unwrap_or(dir))
}

#[tauri::command]
pub fn run_sandboxed_command(req: SandboxRunRequest) -> Result<SandboxRunResponse, String> {
    if req.command.trim().is_empty() {
        return Err("缺少命令".to_string());
    }
    if !matches!(
        req.sandbox_mode.as_str(),
        "read-only" | "workspace-write" | "danger-full-access"
    ) {
        return Err(format!("未知沙箱模式: {}", req.sandbox_mode));
    }

    let timeout = Duration::from_millis(req.timeout_ms.unwrap_or(30_000).clamp(1_000, 120_000));
    let started = Instant::now();
    // Fall back to a managed sandbox directory when no workspace path is set,
    // so command execution works even before the user picks a workspace.
    let cwd_path = match req.cwd.as_deref().map(str::trim) {
        Some(c) if !c.is_empty() && c != "." => PathBuf::from(c),
        _ => default_sandbox_dir()?,
    };
    let cwd = cwd_path
        .canonicalize()
        .unwrap_or(cwd_path)
        .display()
        .to_string();
    let temp_dir = sandbox_temp_dir()?;
    let temp_dir_str = temp_dir.display().to_string();
    let mut command = build_platform_command(&req, &cwd, &temp_dir_str)?;
    command.current_dir(&cwd);
    command.env_clear();
    command.env("PATH", std::env::var("PATH").unwrap_or_default());
    command.env("HOME", std::env::var("HOME").unwrap_or_default());
    preserve_platform_runtime_env(&mut command);
    command.env("TMPDIR", &temp_dir_str);
    command.env("TMP", &temp_dir_str);
    command.env("TEMP", &temp_dir_str);
    command.env("NIUMA_SANDBOX_MODE", &req.sandbox_mode);
    if let Some(env) = req.env.as_ref() {
        for (key, value) in env {
            if is_safe_env_key(key) {
                command.env(key, value);
            }
        }
    }
    command.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|e| format!("启动命令失败: {e}"))?;
    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();
    let stdout_handle = thread::spawn(move || read_pipe(stdout.take()));
    let stderr_handle = thread::spawn(move || read_pipe(stderr.take()));

    let (exit_code, timed_out) = match child
        .wait_timeout(timeout)
        .map_err(|e| format!("等待命令失败: {e}"))?
    {
        Some(status) => (status.code(), false),
        None => {
            let _ = child.kill();
            let _ = child.wait();
            (None, true)
        }
    };

    let stdout = stdout_handle
        .join()
        .unwrap_or_else(|_| Err("读取 stdout 失败".to_string()))?;
    let stderr = stderr_handle
        .join()
        .unwrap_or_else(|_| Err("读取 stderr 失败".to_string()))?;

    Ok(SandboxRunResponse {
        stdout,
        stderr,
        exit_code,
        timed_out,
        duration_ms: started.elapsed().as_millis(),
        sandbox_backend: sandbox_backend(&req.sandbox_mode).to_string(),
    })
}

fn read_pipe(pipe: Option<impl Read>) -> Result<String, String> {
    let Some(mut pipe) = pipe else {
        return Ok(String::new());
    };
    let mut bytes = Vec::new();
    pipe.read_to_end(&mut bytes)
        .map_err(|e| format!("读取命令输出失败: {e}"))?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

fn is_safe_env_key(key: &str) -> bool {
    key.chars()
        .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
        && !key.contains("KEY")
        && !key.contains("SECRET")
        && !key.contains("TOKEN")
        && !key.contains("PASSWORD")
}

fn preserve_platform_runtime_env(command: &mut Command) {
    #[cfg(not(target_os = "windows"))]
    let _ = command;

    #[cfg(target_os = "windows")]
    {
        for key in [
            "SYSTEMROOT",
            "SystemRoot",
            "WINDIR",
            "ComSpec",
            "COMSPEC",
            "PATHEXT",
            "USERPROFILE",
            "APPDATA",
            "LOCALAPPDATA",
            "PROGRAMDATA",
            "PROGRAMFILES",
            "ProgramFiles",
            "PROGRAMFILES(X86)",
            "ProgramFiles(x86)",
            "PROCESSOR_ARCHITECTURE",
            "PROCESSOR_IDENTIFIER",
            "NUMBER_OF_PROCESSORS",
            "OS",
            // Python / conda runtime vars
            "PYTHONHOME",
            "PYTHONPATH",
            "CONDA_PREFIX",
            "CONDA_DEFAULT_ENV",
            "CONDA_EXE",
            "VIRTUAL_ENV",
            // Node.js
            "NODE_PATH",
            // PowerShell
            "PSModulePath",
            // User identity (some scripts need these)
            "USERNAME",
            "USERDOMAIN",
        ] {
            if let Ok(value) = std::env::var(key) {
                command.env(key, value);
            }
        }

        if std::env::var("HOME").unwrap_or_default().is_empty() {
            if let Ok(user_profile) = std::env::var("USERPROFILE") {
                command.env("HOME", user_profile);
            }
        }
    }
}

fn sandbox_backend(mode: &str) -> &'static str {
    if mode == "danger-full-access" {
        "none"
    } else if cfg!(target_os = "macos") {
        "seatbelt-compatible"
    } else {
        "process-boundary"
    }
}

// ── Windows runtime helpers ──────────────────────────────────────────────────

/// Cached path of bash.exe on Windows (found once, reused).
#[cfg(target_os = "windows")]
static WINDOWS_BASH: OnceLock<Option<String>> = OnceLock::new();

/// Search for bash.exe in known locations and PATH on Windows.
/// Result is cached in a static so the filesystem walk only happens once.
#[cfg(target_os = "windows")]
fn find_bash_windows() -> Option<String> {
    WINDOWS_BASH
        .get_or_init(|| {
            // Well-known installation paths (Git for Windows, WSL interop)
            let fixed: &[&str] = &[
                r"C:\Program Files\Git\bin\bash.exe",
                r"C:\Program Files (x86)\Git\bin\bash.exe",
                r"C:\Windows\System32\bash.exe",
            ];
            for path in fixed {
                if std::path::Path::new(path).exists() {
                    return Some(path.to_string());
                }
            }
            // Walk PATH directories
            if let Ok(path_var) = std::env::var("PATH") {
                for dir in path_var.split(';') {
                    let dir = dir.trim();
                    if dir.is_empty() {
                        continue;
                    }
                    let candidate = format!("{}\\bash.exe", dir);
                    if std::path::Path::new(&candidate).exists() {
                        return Some(candidate);
                    }
                }
            }
            None
        })
        .clone()
}

/// Return true if `name.exe` (or `name`) exists in any PATH directory on Windows.
#[cfg(target_os = "windows")]
fn command_on_path_windows(name: &str) -> bool {
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in path_var.split(';') {
            let dir = dir.trim();
            if dir.is_empty() {
                continue;
            }
            if std::path::Path::new(&format!("{}\\{}.exe", dir, name)).exists() {
                return true;
            }
            if std::path::Path::new(&format!("{}\\{}", dir, name)).exists() {
                return true;
            }
        }
    }
    false
}

/// Build the platform Command for Windows with automatic runtime fallbacks:
///
/// - `bash`/`sh`  → Git Bash / WSL bash if on PATH, otherwise PowerShell 5/7.
///   Args `["-lc", "<script>"]` are translated to `[-NonInteractive, -NoProfile, -Command, <script>]`.
/// - `python3`    → `python3` if on PATH, otherwise `python`.
/// - `pwsh`       → `pwsh` (PowerShell 7) if on PATH, otherwise `powershell.exe` (Windows PS 5).
/// - anything else → passed through unchanged.
#[cfg(target_os = "windows")]
fn build_windows_command(req: &SandboxRunRequest) -> Result<Command, String> {
    match req.command.as_str() {
        "bash" | "sh" => {
            if let Some(bash_path) = find_bash_windows() {
                let mut cmd = Command::new(bash_path);
                cmd.args(&req.args);
                return Ok(cmd);
            }
            // No bash found – fall back to PowerShell.
            // Translate bash flag args: skip leading flags (e.g. -l, -c, -lc, --) and
            // treat the first non-flag argument as the script to run.
            let mut cmd = Command::new("powershell.exe");
            cmd.args(["-NonInteractive", "-NoProfile"]);
            if let Some(script) = req
                .args
                .iter()
                .skip_while(|a| a.starts_with('-'))
                .next()
            {
                cmd.args(["-Command", script.as_str()]);
            } else {
                cmd.args(&req.args);
            }
            Ok(cmd)
        }
        "python3" => {
            // Windows typically ships as 'python', not 'python3'.
            if command_on_path_windows("python3") {
                let mut cmd = Command::new("python3");
                cmd.args(&req.args);
                Ok(cmd)
            } else {
                let mut cmd = Command::new("python");
                cmd.args(&req.args);
                Ok(cmd)
            }
        }
        "pwsh" => {
            // Prefer PowerShell 7 (pwsh); fall back to Windows PowerShell 5 (powershell.exe).
            if command_on_path_windows("pwsh") {
                let mut cmd = Command::new("pwsh");
                cmd.args(&req.args);
                Ok(cmd)
            } else {
                let mut cmd = Command::new("powershell.exe");
                cmd.args(&req.args);
                Ok(cmd)
            }
        }
        _ => {
            let mut cmd = Command::new(&req.command);
            cmd.args(&req.args);
            Ok(cmd)
        }
    }
}

fn build_platform_command(
    req: &SandboxRunRequest,
    _cwd: &str,
    _temp_dir: &str,
) -> Result<Command, String> {
    #[cfg(target_os = "macos")]
    {
        if req.sandbox_mode != "danger-full-access" {
            let mut command = Command::new("sandbox-exec");
            command
                .arg("-p")
                .arg(seatbelt_profile(&req.sandbox_mode, _cwd, _temp_dir));
            command.arg(&req.command).args(&req.args);
            return Ok(command);
        }
    }

    #[cfg(target_os = "windows")]
    return build_windows_command(req);

    #[cfg(not(target_os = "windows"))]
    {
        let mut command = Command::new(&req.command);
        command.args(&req.args);
        Ok(command)
    }
}

#[cfg(target_os = "macos")]
fn seatbelt_profile(mode: &str, cwd: &str, temp_dir: &str) -> String {
    let mut profile = String::from("(version 1)\n(allow default)\n");
    if mode == "read-only" {
        profile.push_str("(deny file-write*)\n");
        profile.push_str(&format!(
            "(allow file-write* (subpath \"{}\"))\n",
            escape_seatbelt_path(temp_dir)
        ));
        profile.push_str("(allow file-write* (subpath \"/tmp\"))\n");
        profile.push_str("(allow file-write* (subpath \"/private/tmp\"))\n");
    } else if mode == "workspace-write" {
        profile.push_str("(deny file-write*)\n");
        profile.push_str(&format!(
            "(allow file-write* (subpath \"{}\"))\n",
            escape_seatbelt_path(cwd)
        ));
        profile.push_str(&format!(
            "(allow file-write* (subpath \"{}\"))\n",
            escape_seatbelt_path(temp_dir)
        ));
        profile.push_str("(allow file-write* (subpath \"/tmp\"))\n");
        profile.push_str("(allow file-write* (subpath \"/private/tmp\"))\n");
    }
    profile
}

#[cfg(target_os = "macos")]
fn escape_seatbelt_path(path: &str) -> String {
    path.replace('\\', "\\\\").replace('"', "\\\"")
}
