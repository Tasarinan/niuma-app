/**
 * Zero-token WebView service for niuma-app.
 *
 * Ported from niuma (Vue) — manages platform WebView windows via Tauri commands
 * and injects JavaScript to relay AI requests through the user's browser session.
 *
 * Supported platforms: doubao | deepseek | qwen
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ZeroTokenPlatform = "doubao" | "deepseek" | "qwen";

export interface ZeroTokenPlatformOption {
  id: ZeroTokenPlatform;
  name: string;
  loginUrl: string;
}

export interface ZeroTokenCredentials {
  platform: ZeroTokenPlatform;
  cookie: string;
  bearer: string;
  userAgent: string;
  capturedAt: number;
  sourceUrl: string;
}

// ─── Platform catalog ─────────────────────────────────────────────────────────

export const ZERO_TOKEN_PLATFORMS: ZeroTokenPlatformOption[] = [
  { id: "doubao", name: "豆包 Doubao", loginUrl: "https://www.doubao.com/chat/" },
  { id: "deepseek", name: "DeepSeek", loginUrl: "https://chat.deepseek.com" },
  { id: "qwen", name: "Qwen", loginUrl: "https://chat.qwen.ai" },
];

const CREDENTIAL_STORAGE_KEY = "niuma-zero-token-credentials";

export function getZeroTokenPlatform(
  platform: string | undefined
): ZeroTokenPlatformOption {
  return (
    ZERO_TOKEN_PLATFORMS.find((p) => p.id === platform) ??
    ZERO_TOKEN_PLATFORMS[0]
  );
}

// ─── Window management ────────────────────────────────────────────────────────

export async function openZeroTokenLogin(platform: string, url?: string) {
  const cfg = getZeroTokenPlatform(platform);
  await invoke("zt_open_auth_window", {
    platform: cfg.id,
    url: url ?? cfg.loginUrl,
  });
  await installZeroTokenCredentialCapture(cfg.id).catch(() => {});
}

export async function ensureZeroTokenWindow(platform: string) {
  const cfg = getZeroTokenPlatform(platform);
  await invoke("zt_ensure_window", { platform: cfg.id });
}

export async function hideZeroTokenWindow(platform: string) {
  const cfg = getZeroTokenPlatform(platform);
  await invoke("zt_hide_window", { platform: cfg.id });
}

// ─── Session check ────────────────────────────────────────────────────────────

export async function checkZeroTokenSession(
  platform: string
): Promise<{ ok: boolean; message: string }> {
  const cfg = getZeroTokenPlatform(platform);
  await ensureZeroTokenWindow(cfg.id);
  await installZeroTokenCredentialCapture(cfg.id).catch(() => {});

  const result = await evalZeroTokenScript(
    cfg.id,
    buildSessionCheckScript(cfg.id)
  );
  const loggedIn = Boolean(result?.loggedIn);
  const credentials = normalizeCredentials(cfg.id, result?.credentials);
  if (credentials && (credentials.bearer || credentials.cookie)) {
    saveZeroTokenCredentials(credentials);
  }

  const saved = loadZeroTokenCredentials(cfg.id);
  const credParts = [saved?.cookie ? "cookie" : "", saved?.bearer ? "bearer" : ""]
    .filter(Boolean)
    .join(" + ");

  return {
    ok: loggedIn,
    message: loggedIn
      ? `浏览器会话可用${credParts ? ` (${credParts} 已保存)` : ""}`
      : "请在弹出的浏览器窗口中完成登录",
  };
}

// ─── Send prompt ──────────────────────────────────────────────────────────────

function stripThinkingContent(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, "")
    .replace(/\[think\][\s\S]*?\[\/think\]\s*/gi, "")
    .replace(/\[thinking\][\s\S]*?\[\/thinking\]\s*/gi, "")
    .replace(/<!--\s*think(?:ing)?\s*-->[\s\S]*?<!--\s*\/think(?:ing)?\s*-->\s*/gi, "")
    .replace(/<\/?think(?:ing)?>\s*/gi, "")
    .replace(/\[\/?think(?:ing)?\]\s*/gi, "")
    .trim();
}

export async function sendZeroTokenPrompt(
  platform: string,
  prompt: string
): Promise<string> {
  const cfg = getZeroTokenPlatform(platform);
  const showThinking = false; // not yet exposed in UI
  await ensureZeroTokenWindow(cfg.id);

  await installZeroTokenCredentialCapture(cfg.id).catch(() => {});
  const captured = await captureZeroTokenCredentials(cfg.id).catch(() => null);
  const credentials =
    captured ??
    loadZeroTokenCredentials(cfg.id) ??
    buildCookieOnlyCredentials(cfg.id);

  const result = await evalZeroTokenScript(
    cfg.id,
    buildApiChatScript(cfg.id, prompt, credentials, showThinking),
    120_000
  );
  if (!result?.ok) {
    if (cfg.id === "deepseek") {
      const fallback = await evalZeroTokenScript(cfg.id, buildSendPromptScript(prompt), 120_000);
      if (fallback?.ok && String(fallback.content || "").trim()) {
        const fbText = String(fallback.content || "").trim();
        return showThinking ? fbText : stripThinkingContent(fbText);
      }
      throw new Error(String(fallback?.error || result?.error || "DeepSeek browser request failed"));
    }
    if (cfg.id === "qwen") {
      const fallback = await evalZeroTokenScript(cfg.id, buildQwenSendPromptScript(prompt), 120_000);
      if (fallback?.ok && String(fallback.content || "").trim()) {
        const fbText = String(fallback.content || "").trim();
        return showThinking ? fbText : stripThinkingContent(fbText);
      }
      throw new Error(String(fallback?.error || result?.error || "Qwen browser request failed"));
    }
    throw new Error(String(result?.error ?? "Zero-token browser request failed"));
  }

  const content = String(result.content || "").trim();
  if (!content) {
    if (cfg.id === "deepseek") {
      const fallback = await evalZeroTokenScript(cfg.id, buildSendPromptScript(prompt), 120_000);
      const fbContent = String(fallback?.content || "").trim();
      if (fallback?.ok && fbContent) return showThinking ? fbContent : stripThinkingContent(fbContent);
    }
    if (cfg.id === "qwen") {
      const fallback = await evalZeroTokenScript(cfg.id, buildQwenSendPromptScript(prompt), 120_000);
      const fbContent = String(fallback?.content || "").trim();
      if (fallback?.ok && fbContent) return showThinking ? fbContent : stripThinkingContent(fbContent);
    }
    throw new Error("Zero-token browser request returned an empty response");
  }
  return showThinking ? content : stripThinkingContent(content);
}

// ─── Credential helpers ───────────────────────────────────────────────────────

function buildCookieOnlyCredentials(
  platform: ZeroTokenPlatform
): ZeroTokenCredentials {
  return {
    platform,
    cookie: "",
    bearer: "",
    userAgent: navigator.userAgent,
    capturedAt: Date.now(),
    sourceUrl: "",
  };
}

export function loadZeroTokenCredentials(
  platform: string
): ZeroTokenCredentials | null {
  const cfg = getZeroTokenPlatform(platform);
  try {
    const saved = JSON.parse(
      localStorage.getItem(CREDENTIAL_STORAGE_KEY) ?? "{}"
    );
    return normalizeCredentials(cfg.id, saved[cfg.id]);
  } catch {
    return null;
  }
}

function saveZeroTokenCredentials(credentials: ZeroTokenCredentials): void {
  try {
    const saved = JSON.parse(
      localStorage.getItem(CREDENTIAL_STORAGE_KEY) ?? "{}"
    );
    saved[credentials.platform] = credentials;
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(saved));
  } catch (e) {
    console.warn("[zeroTokenService] Failed to save credentials:", e);
  }
}

function normalizeCredentials(
  platform: ZeroTokenPlatform,
  value: unknown
): ZeroTokenCredentials | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const cookie = String(v.cookie ?? "");
  const bearer = String(v.bearer ?? "").replace(/^Bearer\s+/i, "");
  const userAgent = String(v.userAgent ?? navigator.userAgent);
  const sourceUrl = String(v.sourceUrl ?? v.url ?? "");
  if (!cookie && !bearer) return null;
  return {
    platform,
    cookie,
    bearer,
    userAgent,
    sourceUrl,
    capturedAt: Number(v.capturedAt ?? Date.now()),
  };
}

async function captureZeroTokenCredentials(
  platform: ZeroTokenPlatform
): Promise<ZeroTokenCredentials | null> {
  const result = await evalZeroTokenScript(
    platform,
    buildCredentialCaptureScript(platform),
    20_000
  );
  const credentials = normalizeCredentials(platform, result?.credentials);
  if (credentials && (credentials.bearer || credentials.cookie)) {
    saveZeroTokenCredentials(credentials);
  }
  return credentials;
}

async function installZeroTokenCredentialCapture(
  platform: ZeroTokenPlatform
): Promise<void> {
  await evalZeroTokenScript(platform, buildCredentialHookScript(), 5_000);
}

// ─── Script evaluation bridge ─────────────────────────────────────────────────

async function evalZeroTokenScript(
  platform: ZeroTokenPlatform,
  body: string,
  timeoutMs = 15_000
): Promise<Record<string, unknown>> {
  const requestId = `${platform}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let timerId = 0;
    let unlistenFn: UnlistenFn | null = null;

    const cleanup = () => {
      window.clearTimeout(timerId);
      unlistenFn?.();
      unlistenFn = null;
    };

    // Register the result listener first, then inject the script.
    listen<{ requestId: string; result: Record<string, unknown> }>(
      "zero-token-result",
      (event) => {
        const { requestId: rid, result } = event.payload ?? ({} as { requestId?: string; result?: Record<string, unknown> });
        if (rid !== requestId) return;
        cleanup();
        resolve(result ?? {});
      }
    )
      .then((fn) => {
        unlistenFn = fn;

        timerId = window.setTimeout(() => {
          cleanup();
          reject(new Error("Timed out waiting for browser session result"));
        }, timeoutMs);

        // Build the script with an emitResult that routes through zt_report_result.
        // External webviews cannot reliably call plugin:event|emit directly, but they
        // CAN invoke custom Tauri commands. zt_report_result re-emits the event from
        // Rust to all windows, including this main window's listener above.
        const script = `
(async () => {
  const requestId = ${JSON.stringify(requestId)};
  const emitResult = async (result) => {
    const payload = { requestId, resultJson: JSON.stringify(result) };
    // Primary: zt_report_result relay via custom Tauri command (works in all webviews)
    if (window.__TAURI_INTERNALS__?.invoke) {
      try {
        await window.__TAURI_INTERNALS__.invoke('zt_report_result', payload);
        return;
      } catch (_e) { /* fall through to other methods */ }
    }
    // Fallback A: Tauri v2 event plugin emit
    if (window.__TAURI_INTERNALS__?.invoke) {
      try {
        await window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {
          event: 'zero-token-result',
          payload: { requestId, result },
        });
        return;
      } catch (_e) { /* fall through */ }
    }
    // Fallback B: Tauri v2 global emit
    if (window.__TAURI__?.event?.emit) {
      try { await window.__TAURI__.event.emit('zero-token-result', { requestId, result }); return; } catch (_e) {}
    }
    // Fallback C: store in window for polling (last resort)
    window.__NIUMA_ZERO_TOKEN_RESULT__ = { requestId, result };
  };
  try {
${body}
  } catch (error) {
    await emitResult({ ok: false, error: String(error?.message || error) });
  }
})();`;

        invoke("zt_eval_script", { platform, script }).catch((err) => {
          cleanup();
          reject(new Error(`Failed to inject script into browser window: ${String(err)}`));
        });
      })
      .catch((err) => {
        reject(new Error(`Failed to set up result listener: ${String(err)}`));
      });
  });
}

// ─── Script builders ──────────────────────────────────────────────────────────

function buildSessionCheckScript(platform: ZeroTokenPlatform): string {
  return `
    ${buildCredentialCaptureHelpers()}
    await installCredentialHook();
    const credentials = await captureCredentials(${JSON.stringify(platform)});
    const hasEditor = Boolean(document.querySelector('textarea, [contenteditable="true"], [role="textbox"]'));
    const loginText = /log in|sign in|登录|登入/i.test(document.body?.innerText || '');
    const apiLoggedIn = Boolean(credentials.authenticated || credentials.bearer || credentials.cookie) && !loginText;
    await emitResult({ ok: true, loggedIn: apiLoggedIn || (hasEditor && !loginText), credentials, url: location.href });
  `;
}

function buildCredentialHookScript(): string {
  return `
    ${buildCredentialCaptureHelpers()}
    await installCredentialHook();
    await emitResult({ ok: true, credentials: readCapturedCredentials() });
  `;
}

function buildCredentialCaptureScript(platform: ZeroTokenPlatform): string {
  return `
    ${buildCredentialCaptureHelpers()}
    await installCredentialHook();
    const credentials = await captureCredentials(${JSON.stringify(platform)});
    await emitResult({ ok: true, credentials });
  `;
}

function buildCredentialCaptureHelpers(): string {
  return `
    const saveCapturedAuthorization = (value) => {
      if (!value) return;
      const raw = String(value);
      const bearer = raw.replace(/^Bearer\\s+/i, '').trim();
      if (!bearer) return;
      window.__NIUMA_ZERO_TOKEN_CREDENTIALS__ = {
        ...(window.__NIUMA_ZERO_TOKEN_CREDENTIALS__ || {}),
        bearer,
        capturedAt: Date.now(),
        sourceUrl: location.href,
      };
    };

    const extractBearerFromHeaders = (headers) => {
      if (!headers) return '';
      try {
        if (headers instanceof Headers) return headers.get('authorization') || headers.get('Authorization') || '';
        if (Array.isArray(headers)) {
          const item = headers.find(([key]) => String(key).toLowerCase() === 'authorization');
          return item ? item[1] : '';
        }
        return headers.authorization || headers.Authorization || '';
      } catch { return ''; }
    };

    const findStoredBearer = () => {
      const stores = [localStorage, sessionStorage];
      for (const store of stores) {
        for (let index = 0; index < store.length; index++) {
          const key = store.key(index) || '';
          const value = store.getItem(key) || '';
          const bearerMatch = value.match(/Bearer\\s+([A-Za-z0-9._~+\\/\\-]+=*)/i);
          if (bearerMatch?.[1]) return bearerMatch[1];
          const jwtMatch = value.match(/eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/);
          if (jwtMatch?.[0] && /token|auth|session|access/i.test(key + ' ' + value.slice(0, 120))) return jwtMatch[0];
          if (/token|auth|session|access/i.test(key)) {
            try {
              const parsed = JSON.parse(value);
              const token = parsed?.token || parsed?.access_token || parsed?.accessToken || parsed?.authToken;
              if (typeof token === 'string' && token.length > 20) return token.replace(/^Bearer\\s+/i, '');
            } catch {
              if (value.length > 20) return value.replace(/^Bearer\\s+/i, '');
            }
          }
        }
      }
      return '';
    };

    const readCapturedCredentials = () => ({
      cookie: document.cookie || '',
      bearer: (window.__NIUMA_ZERO_TOKEN_CREDENTIALS__?.bearer || findStoredBearer() || '').replace(/^Bearer\\s+/i, ''),
      userAgent: navigator.userAgent || '',
      capturedAt: window.__NIUMA_ZERO_TOKEN_CREDENTIALS__?.capturedAt || Date.now(),
      sourceUrl: location.href,
      authenticated: Boolean(window.__NIUMA_ZERO_TOKEN_CREDENTIALS__?.authenticated),
    });

    const installCredentialHook = async () => {
      if (window.__NIUMA_ZERO_TOKEN_HOOK_INSTALLED__) return;
      window.__NIUMA_ZERO_TOKEN_HOOK_INSTALLED__ = true;
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        saveCapturedAuthorization(extractBearerFromHeaders(init.headers));
        if (input instanceof Request) saveCapturedAuthorization(input.headers.get('authorization'));
        const response = await originalFetch(input, init);
        try {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url || '';
          if (url.includes('/api/v0/users/current') && response.ok) {
            response.clone().json().then((body) => {
              const token = body?.data?.biz_data?.token;
              if (typeof token === 'string' && token.length > 0) saveCapturedAuthorization('Bearer ' + token);
            }).catch(() => {});
          }
        } catch {}
        return response;
      };
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.open = function (...args) {
        this.__niumaRequestHeaders = {};
        return originalOpen.apply(this, args);
      };
      XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        if (String(name).toLowerCase() === 'authorization') saveCapturedAuthorization(value);
        this.__niumaRequestHeaders[String(name).toLowerCase()] = value;
        return originalSetRequestHeader.apply(this, arguments);
      };
    };

    const captureCredentials = async (platform) => {
      await installCredentialHook();
      const probes = {
        deepseek: ['/api/v0/users/current', '/api/v0/client/settings?did=&scope=banner'],
        claude: ['/api/organizations'],
        qwen: ['/api/v2/user/profile', '/api/v2/chats'],
      }[platform] || [];
      for (const path of probes) {
        try {
          const response = await fetch(path, { credentials: 'include', headers: { Accept: 'application/json' } });
          if (response.ok) {
            if (platform === 'deepseek' && path.includes('/api/v0/users/current')) {
              try {
                const data = await response.clone().json();
                const token = data?.data?.biz_data?.token;
                if (typeof token === 'string' && token.length > 0) saveCapturedAuthorization('Bearer ' + token);
              } catch {}
            }
            window.__NIUMA_ZERO_TOKEN_CREDENTIALS__ = {
              ...(window.__NIUMA_ZERO_TOKEN_CREDENTIALS__ || {}),
              authenticated: true,
              capturedAt: Date.now(),
              sourceUrl: location.href,
            };
          }
        } catch {}
      }
      return readCapturedCredentials();
    };
  `;
}

function buildApiChatScript(
  platform: ZeroTokenPlatform,
  prompt: string,
  credentials: ZeroTokenCredentials,
  showThinking: boolean
): string {
  const payload = JSON.stringify({ prompt, credentials, showThinking });
  if (platform === "doubao") return buildDoubaoApiChatScript(payload);
  if (platform === "qwen") return buildQwenApiChatScript(payload);
  return buildDeepSeekApiChatScript(payload);
}

function buildAuthHeadersExpression(): string {
  return `{
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json, */*',
    ...(credentials.bearer ? { Authorization: 'Bearer ' + credentials.bearer } : {}),
  }`;
}

function buildDeepSeekHeadersExpression(): string {
  return `{
    'Content-Type': 'application/json',
    Accept: '*/*',
    ...(credentials.bearer ? { Authorization: 'Bearer ' + credentials.bearer } : {}),
    'x-client-platform': 'web',
    'x-client-version': '1.7.0',
    'x-app-version': '20241129.1',
    'x-client-locale': 'zh_CN',
    'x-client-timezone-offset': String(-new Date().getTimezoneOffset() * 60),
  }`;
}

function buildReadStreamHelper(): string {
  return `
    const readResponseText = async (response) => {
      const reader = response.body?.getReader();
      if (!reader) return response.text();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      return text;
    };

    const parseSseText = (raw, showThinking = false) => {
      const output = [];
      for (const line of raw.split('\\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if ((event.p?.includes?.('reasoning') || event.type === 'thinking') && typeof event.v === 'string') {
            if (!showThinking) continue;
            output.push(event.v);
            continue;
          }
          if (event.type === 'thinking' && typeof event.content === 'string') {
            if (!showThinking) continue;
            output.push(event.content);
            continue;
          }
          if (typeof event.v === 'string' && (!event.p || event.p.includes('content') || event.p.includes('choices'))) {
            output.push(event.v);
            continue;
          }
          if (event.type === 'text' && typeof event.content === 'string') {
            output.push(event.content);
            continue;
          }
          if (Array.isArray(event.v)) {
            for (const fragment of event.v) {
              if (typeof fragment?.content === 'string') output.push(fragment.content);
            }
            continue;
          }
          const fragments = event.v?.response?.fragments;
          if (Array.isArray(fragments)) {
            for (const fragment of fragments) {
              if (typeof fragment?.content === 'string') output.push(fragment.content);
            }
            continue;
          }
          const delta =
            event.delta?.text ||
            event.delta?.content ||
            event.choices?.[0]?.delta?.content ||
            (showThinking ? event.choices?.[0]?.delta?.reasoning_content : '') ||
            event.v?.choices?.[0]?.delta?.content ||
            event.data?.message?.content ||
            event.message?.content ||
            event.content ||
            event.text ||
            '';
          if (delta) output.push(delta);
        } catch {}
      }
      return output.join('');
    };
  `;
}

function buildDoubaoApiChatScript(payload: string): string {
  return `
    const { prompt, credentials, showThinking } = ${payload};
    ${buildReadStreamHelper()}
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json, */*',
      'agw-js-conv': 'str, str',
      ...(credentials.bearer ? { Authorization: 'Bearer ' + credentials.bearer } : {}),
    };
    const fullPrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const body = {
      messages: [{
        content: JSON.stringify({ text: fullPrompt }),
        content_type: 2001,
        attachments: [],
        references: [],
      }],
      completion_option: {
        is_regen: false,
        with_suggest: false,
        need_create_conversation: true,
        launch_stage: 1,
        is_replace: false,
        is_delete: false,
        message_from: 0,
        use_deep_think: false,
        use_auto_cot: false,
        resend_for_regen: false,
        enable_commerce_credit: false,
      },
      evaluate_option: { web_ab_params: '' },
      conversation_id: '0',
      local_conversation_id: 'local_' + crypto.randomUUID().replace(/-/g, ''),
      local_message_id: crypto.randomUUID(),
    };
    const params = 'aid=497858&device_platform=web&language=zh&pc_version=2.41.0&pkg_type=release_version&real_aid=497858&region=CN&samantha_web=1&sys_region=CN&use-olympus-account=1&version_code=20800';
    const paths = ['/samantha/chat/completion', '/chat/completion'];
    let compRes = null;
    for (const path of paths) {
      compRes = await fetch(path + '?' + params, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      });
      if (compRes.ok || compRes.status !== 404) break;
    }
    if (!compRes?.ok) {
      const detail = await compRes.text().catch(() => '');
      throw new Error('Doubao chat/completion failed: ' + (compRes?.status ?? 'no-response') + ' ' + detail.slice(0, 180));
    }
    const raw = await readResponseText(compRes);
    const pullText = (content) => {
      if (!content) return '';
      if (typeof content === 'string') {
        try { return pullText(JSON.parse(content)); } catch { return content; }
      }
      if (typeof content.text === 'string') return content.text;
      if (content.text_block && typeof content.text_block.text === 'string') return content.text_block.text;
      if (typeof content.content === 'string') return pullText(content.content);
      return '';
    };
    let combined = '';
    for (const line of raw.split('\\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const chunk = trimmed.slice(5).trim();
      if (!chunk || chunk === '[DONE]') continue;
      try {
        const evt = JSON.parse(chunk);
        if (evt.event_type === 2005) {
          const err = typeof evt.event_data === 'string' ? evt.event_data : JSON.stringify(evt.event_data || evt);
          throw new Error('Doubao stream error: ' + err.slice(0, 240));
        }
        if (evt.event_type != null && evt.event_type !== 2001) continue;
        let eventData = evt.event_data ?? evt.data ?? evt;
        if (typeof eventData === 'string') {
          try { eventData = JSON.parse(eventData); } catch { eventData = {}; }
        }
        const message = eventData.message || eventData;
        const contentType = Number(message.content_type || 0);
        if (!showThinking && (contentType === 10040 || contentType === 2008 || contentType === 2003)) continue;
        if (contentType === 2002) continue;
        const text = pullText(message.content);
        if (text) combined += text;
      } catch (err) {
        if (String(err?.message || err).startsWith('Doubao stream error')) throw err;
      }
    }
    if (!combined.trim()) throw new Error('Doubao chat/completion returned no text');
    await emitResult({ ok: true, content: combined });
  `;
}

function buildQwenApiChatScript(payload: string): string {
  return `
    const { prompt, credentials, showThinking } = ${payload};
    ${buildReadStreamHelper()}
    const headers = ${buildAuthHeadersExpression()};
    let contentArr = [];
    if (Array.isArray(prompt)) {
      for (const part of prompt) {
        if (part.type === 'app_text' && part.text) contentArr.push({ type: 'text', text: part.text });
        else if (part.type === 'app_image_uri' && part.uri) contentArr.push({ type: 'image_url', image_url: { url: part.uri } });
      }
    } else if (typeof prompt === 'string') {
      contentArr.push({ type: 'text', text: prompt });
    }
    console.log('[niuma-qwen] Starting API chat, url:', location.href);
    const chatRes = await fetch('/api/v2/chats/new', { method: 'POST', credentials: 'include', headers, body: JSON.stringify({}) });
    if (!chatRes.ok) {
      const errText = await chatRes.text();
      console.error('[niuma-qwen] create chat failed:', chatRes.status, errText.slice(0, 300));
      throw new Error('Qwen create chat failed: ' + chatRes.status + ' ' + errText);
    }
    const chatData = await chatRes.json();
    console.log('[niuma-qwen] chat data:', JSON.stringify(chatData).slice(0, 200));
    const chatId = chatData.data?.id || chatData.chat_id || chatData.id || chatData.chatId;
    if (!chatId) throw new Error('Qwen chat id not found in: ' + JSON.stringify(chatData).slice(0, 200));
    const fid = crypto.randomUUID();
    // Try current model; fall back to older names if needed
    const modelName = 'qwen3-235b-a22b';
    const completionRes = await fetch('/api/v2/chat/completions?chat_id=' + encodeURIComponent(chatId), {
      method: 'POST', credentials: 'include', headers,
      body: JSON.stringify({
        stream: true,
        version: '2.1',
        incremental_output: true,
        chat_id: chatId,
        chat_mode: 'normal',
        model: modelName,
        parent_id: null,
        messages: [{
          fid, parentId: null, childrenIds: [], role: 'user', content: contentArr,
          user_action: 'chat', files: [], timestamp: Math.floor(Date.now() / 1000),
          models: [modelName], chat_type: 't2t',
          feature_config: { thinking_enabled: showThinking, output_schema: 'phase' },
        }],
      }),
    });
    if (!completionRes.ok) {
      const errText = await completionRes.text();
      console.error('[niuma-qwen] completion failed:', completionRes.status, errText.slice(0, 300));
      throw new Error('Qwen completion failed: ' + completionRes.status + ' ' + errText);
    }
    const raw = await readResponseText(completionRes);
    console.log('[niuma-qwen] raw SSE length:', raw.length, 'first 200:', raw.slice(0, 200));
    const parsed = parseSseText(raw, showThinking);
    console.log('[niuma-qwen] parsed content length:', parsed.length);
    await emitResult({ ok: true, content: parsed || raw });
  `;
}

function buildQwenSendPromptScript(prompt: string): string {
  return `
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const text = ${JSON.stringify(prompt)};

    const visible = (el) => {
      const rect = el.getBoundingClientRect?.();
      const style = window.getComputedStyle(el);
      return rect && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const findInput = () => {
      const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'));
      return candidates.reverse().find(visible);
    };

    const setInputText = (el, value) => {
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
          || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(el, value);
        el.value = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.textContent = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      }
    };

    const findSendButton = () => {
      const candidates = Array.from(document.querySelectorAll('button'));
      return candidates.find(b => visible(b) && (/send|submit|发送/i.test(b.textContent || '') || b.querySelector('svg[data-icon*="send"], [class*="send"]')));
    };

    const waitForResponse = async (timeoutMs = 90000) => {
      const start = Date.now();
      let lastText = '';
      let stableCount = 0;
      await sleep(2000);
      while (Date.now() - start < timeoutMs) {
        const msgBlocks = Array.from(document.querySelectorAll('[class*="message"],[class*="chat"],[class*="response"],[class*="assistant"]'));
        const lastBlock = msgBlocks.filter(el => visible(el)).pop();
        const currentText = lastBlock?.innerText?.trim() || '';
        if (currentText && currentText !== lastText) {
          lastText = currentText;
          stableCount = 0;
        } else if (currentText && currentText === lastText) {
          stableCount++;
          if (stableCount >= 3) break;
        }
        await sleep(1000);
      }
      return lastText;
    };

    const inputEl = findInput();
    if (!inputEl) throw new Error('Qwen: no input element found');
    setInputText(inputEl, text);
    await sleep(300);
    const sendBtn = findSendButton();
    if (sendBtn) {
      sendBtn.click();
    } else {
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    }
    const content = await waitForResponse();
    if (!content) throw new Error('Qwen DOM: no response text found');
    await emitResult({ ok: true, content });
  `;
}

function buildDeepSeekApiChatScript(payload: string): string {
  return `
    const { prompt, credentials, showThinking } = ${payload};
    ${buildReadStreamHelper()}
    const isMissingHeaderError = (text) => /MISSING_HEADER|missing[_ -]?header/i.test(String(text || ''));
    const solveSha256Pow = async (challenge) => {
      const encoder = new TextEncoder();
      const targetDifficulty = challenge.difficulty > 1000 ? Math.floor(Math.log2(challenge.difficulty)) : challenge.difficulty;
      for (let nonce = 0; nonce < 1000000; nonce++) {
        const input = String(challenge.salt || '') + String(challenge.challenge || '') + nonce;
        const hash = await crypto.subtle.digest('SHA-256', encoder.encode(input));
        const bytes = new Uint8Array(hash);
        let zeroBits = 0;
        for (const byte of bytes) {
          if (byte === 0) { zeroBits += 8; } else { zeroBits += Math.clz32(byte) - 24; break; }
        }
        if (zeroBits >= targetDifficulty) return nonce;
      }
      throw new Error('DeepSeek PoW timeout');
    };
    const createPowResponse = async () => {
      try {
        const targetPath = '/api/v0/chat/completion';
        const powRes = await fetch('/api/v0/chat/create_pow_challenge', {
          method: 'POST', credentials: 'include', headers, referrer: location.origin + '/',
          body: JSON.stringify({ target_path: targetPath }),
        });
        if (!powRes.ok) {
          const errorText = await powRes.text();
          if (isMissingHeaderError(errorText)) throw new Error('DeepSeek API requires a browser-only header: ' + errorText);
          return '';
        }
        const powData = await powRes.json();
        const challenge = powData.data?.biz_data?.challenge || powData.data?.challenge || powData.challenge || powData.data?.biz_data;
        if (!challenge) return '';
        let answer = null;
        if (window.DeepSeekHash?.solve) {
          answer = await window.DeepSeekHash.solve(challenge);
        } else if (challenge.algorithm === 'sha256') {
          answer = await solveSha256Pow(challenge);
        }
        if (answer === null || answer === undefined) return '';
        return btoa(JSON.stringify({ ...challenge, answer, target_path: targetPath }));
      } catch (error) {
        console.warn('[zero-token] DeepSeek PoW unavailable:', error);
        return '';
      }
    };
    const headers = ${buildDeepSeekHeadersExpression()};
    if (!credentials.bearer) throw new Error('DeepSeek browser API requires captured bearer token');
    await fetch('/api/v0/client/settings?did=&scope=banner', { credentials: 'include', headers, referrer: location.origin + '/' }).catch(() => null);
    const sessionRes = await fetch('/api/v0/chat_session/create', {
      method: 'POST', credentials: 'include', headers, referrer: location.origin + '/', body: JSON.stringify({}),
    });
    if (!sessionRes.ok) {
      const errorText = await sessionRes.text();
      if (isMissingHeaderError(errorText)) throw new Error('DeepSeek API requires a browser-only header: ' + errorText);
      throw new Error('DeepSeek create session failed: ' + sessionRes.status + ' ' + errorText);
    }
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.data?.biz_data?.id || sessionData.data?.biz_data?.chat_session_id;
    if (!sessionId) throw new Error('DeepSeek session id not found');
    const powResponse = await createPowResponse();
    const completionRes = await fetch('/api/v0/chat/completion', {
      method: 'POST', credentials: 'include',
      headers: { ...headers, ...(powResponse ? { 'x-ds-pow-response': powResponse } : {}) },
      referrer: location.origin + '/',
      body: JSON.stringify({
        chat_session_id: sessionId,
        parent_message_id: null,
        prompt,
        ref_file_ids: [],
        thinking_enabled: showThinking,
        search_enabled: true,
        preempt: false,
      }),
    });
    if (!completionRes.ok) {
      const errorText = await completionRes.text();
      if (isMissingHeaderError(errorText)) throw new Error('DeepSeek API requires a browser-only header: ' + errorText);
      throw new Error('DeepSeek completion failed: ' + completionRes.status + ' ' + errorText);
    }
    const raw = await readResponseText(completionRes);
    await emitResult({ ok: true, content: parseSseText(raw, showThinking) || raw });
  `;
}

function buildSendPromptScript(prompt: string): string {
  return `
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const text = ${JSON.stringify(prompt)};
    const visible = (el) => {
      const rect = el.getBoundingClientRect?.();
      const style = window.getComputedStyle(el);
      return rect && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const findInput = () => {
      const candidates = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'));
      return candidates.reverse().find(visible);
    };
    const setInputText = (el, value) => {
      el.focus();
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        el.value = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        el.textContent = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      }
    };
    const findSendButton = () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.reverse().find((button) => {
        if (!visible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
        const label = [button.getAttribute('aria-label'), button.title, button.innerText].filter(Boolean).join(' ');
        return /send|submit|发送|送出|arrow|paper/i.test(label) || button.querySelector('svg');
      });
    };
    const beforeText = document.body?.innerText || '';
    const input = findInput();
    if (!input) throw new Error('No chat input found. Please finish login first.');
    setInputText(input, text);
    await sleep(300);
    const button = findSendButton();
    if (button) {
      button.click();
    } else {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    }
    let stableText = '';
    let stableCount = 0;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 85000) {
      await sleep(1200);
      const currentText = document.body?.innerText || '';
      const delta = currentText.length > beforeText.length ? currentText.slice(beforeText.length).trim() : '';
      const inputStillBusy = Boolean(document.querySelector('[aria-busy="true"], [data-testid*="stop"], button[aria-label*="Stop"], button[aria-label*="停止"]'));
      if (delta && delta === stableText && !inputStillBusy) { stableCount++; } else { stableText = delta; stableCount = 0; }
      if (stableText && stableCount >= 2) break;
    }
    const clean = stableText.split('\\n').map(line => line.trim()).filter(Boolean).join('\\n');
    await emitResult({ ok: true, content: clean || stableText, url: location.href, title: document.title });
  `;
}
