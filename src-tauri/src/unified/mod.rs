//! Unified API control-plane shell.
//!
//! Mirrors the architecture of LLMToolForge's `unified/` supervisor: it owns the
//! routing table (`exposedModel -> upstream`), local-key config, run state, and
//! an in-memory ring buffer of call logs that the monitoring UI consumes via the
//! `CALL_LOG_EVENT`.
//!
//! NOTE: niuma does not bundle the Portkey gateway binary (out of scope), so the
//! data-plane still flows through niuma's direct cURL-provider transport on the
//! frontend. This module is the control plane: it holds config/routes/logs and
//! the frontend reports each model call via `unified_api_log`. When a gateway
//! binary is later added, `unified_api_start` can spawn it using this same state.

use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

pub const CALL_LOG_EVENT: &str = "unified://call-log";
const LOG_CAPACITY: usize = 2000;
const DEFAULT_PORT: u16 = 4141;

/// niuma does not bundle a gateway sidecar binary.
const GATEWAY_BUNDLED: bool = false;

/// An upstream target a given exposed model id routes to.
///
/// Fields are retained for when a gateway sidecar binary is bundled and needs to
/// forward requests; the control-plane shell only reads the model keys today.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Upstream {
    pub base_url: String,
    pub api_key: String,
    pub real_model: String,
    pub provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteInput {
    pub exposed_model: String,
    pub base_url: String,
    pub api_key: String,
    pub real_model: String,
    pub provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedConfigInput {
    pub port: u16,
    pub local_key: Option<String>,
    #[serde(default)]
    pub routes: Vec<RouteInput>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallLogRecord {
    pub id: u64,
    pub ts: u64,
    pub exposed_model: String,
    pub real_model: String,
    pub provider: String,
    /// `openai-completions` or `anthropic-messages`.
    pub protocol: String,
    pub stream: bool,
    pub status: u16,
    pub duration_ms: u64,
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallLogInput {
    pub exposed_model: String,
    pub real_model: String,
    pub provider: String,
    pub protocol: String,
    #[serde(default)]
    pub stream: bool,
    pub status: u16,
    pub duration_ms: u64,
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedStatus {
    pub running: bool,
    pub port: u16,
    pub route_count: usize,
    pub has_local_key: bool,
    pub models: Vec<String>,
    /// Whether an actual gateway sidecar binary is bundled (false for niuma).
    pub gateway_bundled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStat {
    pub model: String,
    pub count: u64,
    pub errors: u64,
    pub total_tokens: u64,
    pub avg_duration_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedStats {
    pub total: u64,
    pub success: u64,
    pub errors: u64,
    pub avg_duration_ms: u64,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub total_tokens: u64,
    pub by_model: Vec<ModelStat>,
}

#[derive(Default)]
struct Inner {
    routes: HashMap<String, Upstream>,
    local_key: Option<String>,
    port: u16,
    running: bool,
    logs: VecDeque<CallLogRecord>,
    seq: u64,
}

impl Inner {
    fn status(&self) -> UnifiedStatus {
        let mut models: Vec<String> = self.routes.keys().cloned().collect();
        models.sort();
        UnifiedStatus {
            running: self.running,
            port: self.port,
            route_count: self.routes.len(),
            has_local_key: self.local_key.as_deref().is_some_and(|k| !k.is_empty()),
            models,
            gateway_bundled: GATEWAY_BUNDLED,
        }
    }

    fn push_log(&mut self, mut rec: CallLogRecord) -> CallLogRecord {
        self.seq += 1;
        rec.id = self.seq;
        if self.logs.len() >= LOG_CAPACITY {
            self.logs.pop_front();
        }
        self.logs.push_back(rec.clone());
        rec
    }
}

/// Tauri-managed handle for the unified control plane.
pub struct UnifiedManager {
    inner: Mutex<Inner>,
}

impl Default for UnifiedManager {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                port: DEFAULT_PORT,
                ..Inner::default()
            }),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn lock<'a>(
    state: &'a State<'_, UnifiedManager>,
) -> Result<std::sync::MutexGuard<'a, Inner>, String> {
    state
        .inner
        .lock()
        .map_err(|_| "统一 API 状态锁被污染".to_string())
}

#[tauri::command]
pub fn unified_api_set_config(
    state: State<'_, UnifiedManager>,
    config: UnifiedConfigInput,
) -> Result<UnifiedStatus, String> {
    let mut inner = lock(&state)?;
    if config.port != 0 {
        inner.port = config.port;
    }
    inner.local_key = config.local_key.filter(|k| !k.is_empty());
    inner.routes = config
        .routes
        .into_iter()
        .map(|r| {
            (
                r.exposed_model,
                Upstream {
                    base_url: r.base_url,
                    api_key: r.api_key,
                    real_model: r.real_model,
                    provider: r.provider,
                },
            )
        })
        .collect();
    Ok(inner.status())
}

#[tauri::command]
pub fn unified_api_start(state: State<'_, UnifiedManager>) -> Result<UnifiedStatus, String> {
    let mut inner = lock(&state)?;
    inner.running = true;
    Ok(inner.status())
}

#[tauri::command]
pub fn unified_api_stop(state: State<'_, UnifiedManager>) -> Result<UnifiedStatus, String> {
    let mut inner = lock(&state)?;
    inner.running = false;
    Ok(inner.status())
}

#[tauri::command]
pub fn unified_api_get_status(state: State<'_, UnifiedManager>) -> Result<UnifiedStatus, String> {
    let inner = lock(&state)?;
    Ok(inner.status())
}

#[tauri::command]
pub fn unified_api_log(
    app: tauri::AppHandle,
    state: State<'_, UnifiedManager>,
    record: CallLogInput,
) -> Result<CallLogRecord, String> {
    let rec = {
        let mut inner = lock(&state)?;
        inner.push_log(CallLogRecord {
            id: 0,
            ts: now_ms(),
            exposed_model: record.exposed_model,
            real_model: record.real_model,
            provider: record.provider,
            protocol: record.protocol,
            stream: record.stream,
            status: record.status,
            duration_ms: record.duration_ms,
            prompt_tokens: record.prompt_tokens,
            completion_tokens: record.completion_tokens,
            total_tokens: record.total_tokens,
            error: record.error,
        })
    };
    let _ = app.emit(CALL_LOG_EVENT, &rec);
    Ok(rec)
}

#[tauri::command]
pub fn unified_api_get_logs(
    state: State<'_, UnifiedManager>,
) -> Result<Vec<CallLogRecord>, String> {
    let inner = lock(&state)?;
    Ok(inner.logs.iter().cloned().collect())
}

#[tauri::command]
pub fn unified_api_clear_logs(state: State<'_, UnifiedManager>) -> Result<(), String> {
    let mut inner = lock(&state)?;
    inner.logs.clear();
    inner.seq = 0;
    Ok(())
}

#[tauri::command]
pub fn unified_api_get_stats(state: State<'_, UnifiedManager>) -> Result<UnifiedStats, String> {
    let inner = lock(&state)?;
    let total = inner.logs.len() as u64;
    let mut success = 0u64;
    let mut errors = 0u64;
    let mut total_duration = 0u64;
    let mut prompt_tokens = 0u64;
    let mut completion_tokens = 0u64;
    let mut total_tokens = 0u64;

    let mut by_model: HashMap<String, ModelStat> = HashMap::new();
    for rec in &inner.logs {
        if rec.error.is_none() && rec.status < 400 {
            success += 1;
        } else {
            errors += 1;
        }
        total_duration += rec.duration_ms;
        prompt_tokens += rec.prompt_tokens.unwrap_or(0);
        completion_tokens += rec.completion_tokens.unwrap_or(0);
        total_tokens += rec.total_tokens.unwrap_or(0);

        let entry = by_model
            .entry(rec.exposed_model.clone())
            .or_insert(ModelStat {
                model: rec.exposed_model.clone(),
                count: 0,
                errors: 0,
                total_tokens: 0,
                avg_duration_ms: 0,
            });
        entry.count += 1;
        if rec.error.is_some() || rec.status >= 400 {
            entry.errors += 1;
        }
        entry.total_tokens += rec.total_tokens.unwrap_or(0);
        // Reuse avg_duration_ms field as running sum until we normalize below.
        entry.avg_duration_ms += rec.duration_ms;
    }

    let mut by_model: Vec<ModelStat> = by_model
        .into_values()
        .map(|mut s| {
            s.avg_duration_ms = if s.count > 0 {
                s.avg_duration_ms / s.count
            } else {
                0
            };
            s
        })
        .collect();
    by_model.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(UnifiedStats {
        total,
        success,
        errors,
        avg_duration_ms: if total > 0 { total_duration / total } else { 0 },
        prompt_tokens,
        completion_tokens,
        total_tokens,
        by_model,
    })
}
