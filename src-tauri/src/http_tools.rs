//! Generic HTTP request tool for the in-app Pi agent's `run_skill` capability.
//!
//! Skills can embed a `curl` command in their SKILL.md; the frontend parses
//! that into a plain `{ url, method, headers, data }` description and calls
//! `http_request` here to actually perform it. Unlike `web_search`, this is a
//! generic client usable against any HTTP API a skill points at.

use std::collections::HashMap;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;

const DEFAULT_TIMEOUT_MS: u64 = 15_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequestArgs {
    pub url: String,
    #[serde(default = "default_method")]
    pub method: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub params: Option<HashMap<String, String>>,
    #[serde(default)]
    pub data: Option<Value>,
    #[serde(default)]
    pub timeout: Option<u64>,
}

fn default_method() -> String {
    "GET".to_string()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

/// Perform a generic HTTP request on behalf of a skill's curl template.
/// Always resolves `Ok` — network/timeout failures are reported via the
/// `success: false` + `error`/`code` fields rather than a Tauri command error,
/// so the calling agent tool can surface a clear message either way.
#[tauri::command]
pub async fn http_request(args: HttpRequestArgs) -> Result<HttpResponse, String> {
    let timeout_ms = args.timeout.unwrap_or(DEFAULT_TIMEOUT_MS);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;

    let method = args.method.to_uppercase();
    let mut builder = match method.as_str() {
        "GET" => client.get(&args.url),
        "POST" => client.post(&args.url),
        "PUT" => client.put(&args.url),
        "DELETE" => client.delete(&args.url),
        "PATCH" => client.patch(&args.url),
        "HEAD" => client.head(&args.url),
        other => client.request(
            other
                .parse()
                .unwrap_or(reqwest::Method::GET),
            &args.url,
        ),
    };

    for (key, value) in &args.headers {
        builder = builder.header(key, value);
    }
    if let Some(params) = &args.params {
        builder = builder.query(params);
    }
    if let Some(data) = &args.data {
        builder = builder.json(data);
    }

    let sent = builder.send().await;
    let resp = match sent {
        Ok(r) => r,
        Err(e) => {
            let code = if e.is_timeout() {
                Some("ETIMEDOUT".to_string())
            } else if e.is_connect() {
                Some("ECONNREFUSED".to_string())
            } else {
                None
            };
            return Ok(HttpResponse {
                success: false,
                data: None,
                text: None,
                status: None,
                status_text: None,
                headers: None,
                error: Some(format!("请求失败: {e}")),
                code,
            });
        }
    };

    let status = resp.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let mut headers = HashMap::new();
    for (name, value) in resp.headers().iter() {
        if let Ok(v) = value.to_str() {
            headers.insert(name.to_string(), v.to_string());
        }
    }

    let text = match resp.text().await {
        Ok(t) => t,
        Err(e) => {
            return Ok(HttpResponse {
                success: false,
                data: None,
                text: None,
                status: Some(status.as_u16()),
                status_text: Some(status_text),
                headers: Some(headers),
                error: Some(format!("读取响应内容失败: {e}")),
                code: None,
            });
        }
    };
    let data = serde_json::from_str::<Value>(&text).ok();

    Ok(HttpResponse {
        success: status.is_success(),
        data,
        text: Some(text),
        status: Some(status.as_u16()),
        status_text: Some(status_text),
        headers: Some(headers),
        error: if status.is_success() {
            None
        } else {
            Some(format!("HTTP {status}"))
        },
        code: None,
    })
}
