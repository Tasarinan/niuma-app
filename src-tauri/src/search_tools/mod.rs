//! Search tools for the in-app Pi agent.
//!
//! - `search_local_files` : whole-disk, filename-only search (best effort,
//!   bounded by a time budget and result cap — not a content/full-text index).
//! - `web_search`         : online search via DuckDuckGo's HTML endpoint
//!   (no API key required).

use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use regex::Regex;
use serde::{Deserialize, Serialize};

/// Hard cap on results returned by `search_local_files`.
const MAX_FILE_SEARCH_RESULTS: usize = 200;
const DEFAULT_FILE_SEARCH_RESULTS: usize = 50;
/// Time budget for a single `search_local_files` call.
const FILE_SEARCH_TIME_BUDGET: Duration = Duration::from_secs(8);
/// Directories never descended into (system/noise dirs, in addition to hidden dirs).
const SKIP_DIR_NAMES: [&str; 9] = [
    ".git",
    "node_modules",
    "target",
    "dist",
    ".next",
    ".turbo",
    "$RECYCLE.BIN",
    "System Volume Information",
    "Windows",
];

/// Hard cap on results returned by `web_search`.
const MAX_WEB_SEARCH_RESULTS: usize = 20;
const DEFAULT_WEB_SEARCH_RESULTS: usize = 8;

// ─── Local file search ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchRequest {
    query: String,
    max_results: Option<usize>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResponse {
    pub entries: Vec<FileSearchEntry>,
    pub truncated: bool,
    pub scanned_roots: Vec<String>,
}

fn search_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let root = PathBuf::from(format!("{}:\\", letter as char));
            if root.exists() {
                roots.push(root);
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        roots.push(PathBuf::from("/"));
    }
    roots
}

/// Best-effort, whole-disk filename search. Bounded by `FILE_SEARCH_TIME_BUDGET`
/// and the result cap; returns `truncated: true` when either limit was hit.
#[tauri::command]
pub fn search_local_files(req: FileSearchRequest) -> Result<FileSearchResponse, String> {
    let query = req.query.trim().to_lowercase();
    if query.is_empty() {
        return Err("缺少搜索关键词".to_string());
    }
    let limit = req
        .max_results
        .unwrap_or(DEFAULT_FILE_SEARCH_RESULTS)
        .clamp(1, MAX_FILE_SEARCH_RESULTS);

    let roots = search_roots();
    let started = Instant::now();
    let mut entries: Vec<FileSearchEntry> = Vec::new();
    let mut truncated = false;
    let mut stack: Vec<PathBuf> = roots.clone();

    'outer: while let Some(dir) = stack.pop() {
        if started.elapsed() > FILE_SEARCH_TIME_BUDGET {
            truncated = true;
            break;
        }
        let Ok(read_dir) = fs::read_dir(&dir) else {
            continue;
        };
        for item in read_dir.flatten() {
            if started.elapsed() > FILE_SEARCH_TIME_BUDGET {
                truncated = true;
                break 'outer;
            }
            let name = item.file_name().to_string_lossy().to_string();
            let Ok(file_type) = item.file_type() else {
                continue;
            };
            // `file_type()` does not follow symlinks, so symlinked directories
            // are naturally excluded from traversal (avoids link cycles).
            let is_dir = file_type.is_dir();
            if is_dir {
                let skip = name.starts_with('.')
                    || SKIP_DIR_NAMES.iter().any(|s| s.eq_ignore_ascii_case(&name));
                if !skip {
                    stack.push(item.path());
                }
            }
            if name.to_lowercase().contains(&query) {
                let size = item.metadata().map(|m| m.len()).unwrap_or(0);
                entries.push(FileSearchEntry {
                    name,
                    path: item.path().display().to_string(),
                    is_dir,
                    size,
                });
                if entries.len() >= limit {
                    truncated = true;
                    break 'outer;
                }
            }
        }
    }

    Ok(FileSearchResponse {
        entries,
        truncated,
        scanned_roots: roots.iter().map(|p| p.display().to_string()).collect(),
    })
}

// ─── Toolbar quick search: installed apps + user files ───────────────────────

const QUICK_SEARCH_FILE_BUDGET: Duration = Duration::from_millis(2000);
const QUICK_SEARCH_MAX_DEPTH: usize = 3;
const QUICK_SEARCH_MAX_READ_BYTES: u64 = 512 * 1024;
const TEXT_FILE_EXTENSIONS: [&str; 12] = [
    "txt", "md", "markdown", "json", "yaml", "yml", "html", "htm", "csv", "log", "xml", "toml",
];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QuickSearchEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// `app`, `file`, or `dir`.
    pub kind: String,
    /// `name` when the file name matched, `content` when the body matched.
    pub match_kind: String,
    /// Short excerpt around the match. Empty for apps and non-text files.
    pub excerpt: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickSearchResponse {
    pub entries: Vec<QuickSearchEntry>,
}

fn rank_name(name: &str, query: &str) -> Option<u8> {
    let name = name.to_lowercase();
    let query = query.to_lowercase();
    if query.is_empty() {
        return None;
    }
    if name.starts_with(&query) {
        Some(0)
    } else if name.contains(&query) {
        Some(1)
    } else {
        None
    }
}

fn home_dir() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
}

fn app_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            roots.push(PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu"));
        }
        if let Ok(programdata) = std::env::var("ProgramData") {
            roots.push(PathBuf::from(programdata).join(r"Microsoft\Windows\Start Menu"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        roots.push(PathBuf::from("/Applications"));
        if let Some(home) = home_dir() {
            roots.push(home.join("Applications"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        roots.push(PathBuf::from("/usr/share/applications"));
        if let Some(home) = home_dir() {
            roots.push(home.join(".local/share/applications"));
        }
    }
    roots.into_iter().filter(|path| path.is_dir()).collect()
}

fn user_file_roots() -> Vec<PathBuf> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };
    let mut roots = Vec::new();
    for name in ["Desktop", "Documents", "Downloads", "Pictures", "桌面", "文档", "下载"] {
        let path = home.join(name);
        if path.is_dir() {
            roots.push(path);
        }
    }
    if let Ok(entries) = fs::read_dir(&home) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.to_lowercase().starts_with("onedrive") || !entry.path().is_dir() {
                continue;
            }
            for sub in ["Desktop", "Documents", "桌面", "文档"] {
                let path = entry.path().join(sub);
                if path.is_dir() {
                    roots.push(path);
                }
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        for base in [cwd.clone(), cwd.join("..")] {
            let artifacts = base.join(".artifacts");
            if artifacts.is_dir() {
                roots.push(artifacts);
            }
        }
    }
    roots
}

fn consider_entry(bucket: &mut [Vec<QuickSearchEntry>; 2], name: &str, path: String, is_dir: bool, kind: &str, query: &str) {
    let Some(rank) = rank_name(name, query) else {
        return;
    };
    bucket[rank as usize].push(QuickSearchEntry {
        name: name.to_string(),
        path,
        is_dir,
        kind: kind.to_string(),
        match_kind: "name".to_string(),
        excerpt: String::new(),
    });
}

fn is_text_file_name(name: &str) -> bool {
    let ext = name.rsplit_once('.').map(|(_, ext)| ext.to_lowercase());
    ext.is_some_and(|ext| TEXT_FILE_EXTENSIONS.contains(&ext.as_str()))
}

fn char_floor(text: &str, mut index: usize) -> usize {
    if index >= text.len() {
        return text.len();
    }
    while index > 0 && !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn excerpt_around(text: &str, query: &str) -> Option<String> {
    let lower = text.to_lowercase();
    let needle = query.to_lowercase();
    let index = lower.find(&needle)?;
    let start = char_floor(text, index.saturating_sub(80));
    let mut end = (index + needle.len() + 160).min(text.len());
    while end < text.len() && !text.is_char_boundary(end) {
        end += 1;
    }
    let snippet = text[start..end].replace(['\r', '\n'], " ").trim().to_string();
    if snippet.is_empty() {
        None
    } else {
        Some(snippet)
    }
}

fn read_text_excerpt(path: &std::path::Path, query: &str) -> Option<String> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() == 0 || meta.len() > QUICK_SEARCH_MAX_READ_BYTES {
        return None;
    }
    let bytes = fs::read(path).ok()?;
    if bytes.iter().take(8000).any(|byte| *byte == 0) {
        return None;
    }
    let text = String::from_utf8_lossy(&bytes);
    excerpt_around(&text, query)
}

fn collect_apps(query: &str, limit: usize) -> Vec<QuickSearchEntry> {
    let mut ranked: [Vec<QuickSearchEntry>; 2] = [Vec::new(), Vec::new()];
    let mut stack = app_roots();
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_type.is_dir() {
                if file_name.to_lowercase().ends_with(".app") {
                    let display = file_name.rsplit_once('.').map(|(stem, _)| stem).unwrap_or(&file_name);
                    consider_entry(
                        &mut ranked,
                        display,
                        entry.path().display().to_string(),
                        false,
                        "app",
                        query,
                    );
                } else {
                    stack.push(entry.path());
                }
                continue;
            }
            let lower = file_name.to_lowercase();
            let display = if lower.ends_with(".lnk") || lower.ends_with(".app") || lower.ends_with(".desktop") {
                file_name
                    .rsplit_once('.')
                    .map(|(stem, _)| stem.to_string())
                    .unwrap_or(file_name)
            } else {
                continue;
            };
            consider_entry(
                &mut ranked,
                &display,
                entry.path().display().to_string(),
                false,
                "app",
                query,
            );
            if ranked[0].len() + ranked[1].len() >= limit.saturating_mul(4) {
                break;
            }
        }
    }
    ranked.into_iter().flatten().take(limit).collect()
}

fn walk_user_files(
    dir: &std::path::Path,
    query: &str,
    depth: usize,
    deadline: Instant,
    ranked: &mut [Vec<QuickSearchEntry>; 2],
    seen: &mut usize,
    limit: usize,
) {
    if Instant::now() > deadline || *seen >= limit {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if Instant::now() > deadline || *seen >= limit {
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || SKIP_DIR_NAMES.iter().any(|skip| skip.eq_ignore_ascii_case(&name)) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let is_dir = file_type.is_dir();
        let path = entry.path();
        if !is_dir && is_text_file_name(&name) {
            if let Some(excerpt) = read_text_excerpt(&path, query) {
                ranked[0].push(QuickSearchEntry {
                    name: name.clone(),
                    path: path.display().to_string(),
                    is_dir: false,
                    kind: "file".to_string(),
                    match_kind: "content".to_string(),
                    excerpt,
                });
                *seen += 1;
                continue;
            }
        }
        let before = ranked[0].len() + ranked[1].len();
        consider_entry(
            ranked,
            &name,
            path.display().to_string(),
            is_dir,
            if is_dir { "dir" } else { "file" },
            query,
        );
        if ranked[0].len() + ranked[1].len() > before {
            *seen += 1;
        }
        if is_dir && depth < QUICK_SEARCH_MAX_DEPTH {
            walk_user_files(&path, query, depth + 1, deadline, ranked, seen, limit);
        }
    }
}

fn collect_user_files(query: &str, limit: usize) -> Vec<QuickSearchEntry> {
    let mut ranked: [Vec<QuickSearchEntry>; 2] = [Vec::new(), Vec::new()];
    let deadline = Instant::now() + QUICK_SEARCH_FILE_BUDGET;
    let mut seen = 0usize;
    for root in user_file_roots() {
        walk_user_files(&root, query, 0, deadline, &mut ranked, &mut seen, limit.saturating_mul(3));
        if Instant::now() > deadline {
            break;
        }
    }
    ranked.into_iter().flatten().take(limit).collect()
}

/// Local materials for the toolbar summary: file-name hits and text excerpts
/// from Desktop, Documents, and Downloads. Apps fill any remaining slots.
#[tauri::command]
pub fn quick_search_local(req: FileSearchRequest) -> Result<QuickSearchResponse, String> {
    let query = req.query.trim().to_string();
    if query.is_empty() {
        return Err("缺少搜索关键词".to_string());
    }
    let limit = req
        .max_results
        .unwrap_or(8)
        .clamp(1, 20);
    let mut entries = collect_user_files(&query, limit);
    if entries.len() < limit {
        let mut apps = collect_apps(&query, limit - entries.len());
        entries.append(&mut apps);
    }
    Ok(QuickSearchResponse {
        entries: entries.into_iter().take(limit).collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::{excerpt_around, rank_name};

    #[test]
    fn prefix_ranks_ahead_of_contains() {
        assert_eq!(rank_name("Notepad", "note"), Some(0));
        assert_eq!(rank_name("Untitled note", "note"), Some(1));
        assert_eq!(rank_name("Calculator", "note"), None);
    }

    #[test]
    fn excerpt_keeps_the_matching_sentence() {
        let text = "前文无关。这里提到零信任网络的入口。后面还有别的话。";
        let excerpt = excerpt_around(text, "零信任").expect("match");
        assert!(excerpt.contains("零信任"));
    }
}

// ─── Web search (DuckDuckGo HTML endpoint) ────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchRequest {
    query: String,
    max_results: Option<usize>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResultItem {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResponse {
    pub results: Vec<WebSearchResultItem>,
}

/// Online web search via DuckDuckGo's no-JS HTML endpoint. No API key needed.
#[tauri::command]
pub async fn web_search(req: WebSearchRequest) -> Result<WebSearchResponse, String> {
    let query = req.query.trim().to_string();
    if query.is_empty() {
        return Err("缺少搜索关键词".to_string());
    }
    let limit = req
        .max_results
        .unwrap_or(DEFAULT_WEB_SEARCH_RESULTS)
        .clamp(1, MAX_WEB_SEARCH_RESULTS);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;

    let resp = client
        .get("https://html.duckduckgo.com/html/")
        .query(&[("q", query.as_str())])
        .header(
            "User-Agent",
            "Mozilla/5.0 (compatible; niuma-app/1.0; +https://niuma-app.com)",
        )
        .send()
        .await
        .map_err(|e| format!("联网搜索请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("联网搜索请求失败: HTTP {}", resp.status()));
    }

    let body = resp
        .text()
        .await
        .map_err(|e| format!("读取搜索结果失败: {e}"))?;

    Ok(WebSearchResponse {
        results: parse_duckduckgo_html(&body, limit),
    })
}

fn parse_duckduckgo_html(html: &str, limit: usize) -> Vec<WebSearchResultItem> {
    let link_re = Regex::new(r#"(?s)<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>"#)
        .expect("valid regex");
    let snippet_re =
        Regex::new(r#"(?s)<a[^>]*class="result__snippet"[^>]*>(.*?)</a>"#).expect("valid regex");

    let links: Vec<(String, String)> = link_re
        .captures_iter(html)
        .map(|c| (clean_result_url(&c[1]), strip_html_tags(&c[2])))
        .filter(|(_, title)| !title.is_empty())
        .collect();
    let mut snippets: Vec<String> = snippet_re
        .captures_iter(html)
        .map(|c| strip_html_tags(&c[1]))
        .collect();
    snippets.resize(links.len(), String::new());

    links
        .into_iter()
        .zip(snippets)
        .take(limit)
        .map(|((url, title), snippet)| WebSearchResultItem {
            title,
            url,
            snippet,
        })
        .collect()
}

fn strip_html_tags(fragment: &str) -> String {
    let tag_re = Regex::new(r"<[^>]+>").expect("valid regex");
    decode_html_entities(tag_re.replace_all(fragment, "").trim())
}

fn decode_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
}

/// DuckDuckGo's HTML endpoint wraps result links in a redirect
/// (`//duckduckgo.com/l/?uddg=<percent-encoded-url>&rut=...`). Extract and
/// percent-decode the real target when present.
fn clean_result_url(href: &str) -> String {
    if let Some(idx) = href.find("uddg=") {
        let rest = &href[idx + 5..];
        let end = rest.find('&').unwrap_or(rest.len());
        return percent_decode(&rest[..end]);
    }
    href.to_string()
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                if let Ok(byte) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                    out.push(byte);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}
