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
            "Mozilla/5.0 (compatible; niuma-app/1.0; +https://niuma.com)",
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
    let link_re =
        Regex::new(r#"(?s)<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>"#)
            .expect("valid regex");
    let snippet_re = Regex::new(r#"(?s)<a[^>]*class="result__snippet"[^>]*>(.*?)</a>"#)
        .expect("valid regex");

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
        .map(|((url, title), snippet)| WebSearchResultItem { title, url, snippet })
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
