/**
 * WeChat official-account slots injected when /publish WECHAT starts.
 * Secrets (APPSECRET / API keys) never appear in the formatted chat context.
 * Account names and AppIDs come from `.env.local` only — no `.aws-article` config.
 */

export interface WechatSlot {
  slot: number;
  name: string;
  hasAppId: boolean;
  hasSecret: boolean;
  appIdMasked: string;
}

export interface WechatReadyPack {
  status: "ok" | "error";
  slots: WechatSlot[];
  sources: string[];
  selectedSlot?: number;
  errors: string[];
}

const SLOT_KEY = /^WECHAT_(\d+)_(APPID|APPSECRET|NAME|API_BASE)$/i;

export function isReadyCommand(name: string): boolean {
  return name.trim().toLowerCase() === "ready";
}

export function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    let value = body.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === value[value.length - 1]) && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    out[body.slice(0, eq).trim()] = value;
  }
  return out;
}

export function maskWechatAppId(appid: string): string {
  const value = appid.trim();
  if (!value) return "(未填)";
  if (value.length <= 8) return `${value.slice(0, 2)}****`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function slotIndexes(env: Record<string, string>): number[] {
  const found = new Set<number>();
  for (const key of Object.keys(env)) {
    const match = key.match(SLOT_KEY);
    if (match) found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
}

export function wechatSlotsFromEnv(env: Record<string, string>): WechatSlot[] {
  return slotIndexes(env).map((slot) => {
    const appId = String(env[`WECHAT_${slot}_APPID`] ?? "").trim();
    const secret = String(env[`WECHAT_${slot}_APPSECRET`] ?? "").trim();
    const name = String(env[`WECHAT_${slot}_NAME`] ?? "").trim();
    return {
      slot,
      name,
      hasAppId: Boolean(appId),
      hasSecret: Boolean(secret),
      appIdMasked: maskWechatAppId(appId),
    };
  });
}

export function parseReadyAccountArg(
  args: string,
  slots: WechatSlot[],
): WechatSlot | undefined {
  const raw = args.trim();
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) {
    const slot = Number(raw);
    return slots.find((item) => item.slot === slot);
  }
  const needle = raw.toLowerCase();
  return slots.find((item) => item.name && item.name.toLowerCase().includes(needle));
}

export function formatReadyWechatContext(pack: WechatReadyPack): string {
  const lines = [
    "[微信公众号槽位]",
    `status: ${pack.status}`,
    pack.sources.length > 0 ? `来源: ${pack.sources.join("、")}` : "来源: (未找到 .env.local)",
    pack.selectedSlot ? `本次指定槽位: ${pack.selectedSlot}` : "",
    "",
    "规则：",
    "- 你是发行（由主理人在发布阶段点名）。列出下列公众号，让用户选一个槽位（序号或名称）。",
    "- 不要打印 APPSECRET、API key 或完整 AppID。",
    "- 选定后在回复里确认槽位序号。不要写任何 yaml 配置文件。",
    "- 文风和排版风格在写手 / 发行的 Agent 个性里。",
    "- 不要改 .env.local。发布时用对话里确认的槽位序号（`--account N`）。",
    "- 发布必须用 `publish.py ... full <草稿目录>/`：`full` 会先对磁盘 article.md 跑 format.py 再上传；不要只传旧 article.html。",
    "- 只有一个可用槽位时直接确认。",
    pack.status === "error" || pack.slots.length === 0
      ? "- 找不到账号时说明要在工作区 `.env.local` 填写 WECHAT_1_APPID / WECHAT_1_APPSECRET，不要编造 AppID。"
      : "",
    "",
    "## 可选公众号",
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "");

  if (pack.slots.length === 0) {
    lines.push("(无)");
  } else {
    for (const slot of pack.slots) {
      const name = slot.name || "(未命名)";
      const secret = slot.hasSecret ? "密钥已填" : "密钥未填";
      const app = slot.hasAppId ? `AppID ${slot.appIdMasked}` : "AppID 未填";
      lines.push(`- 槽位 ${slot.slot}：${name} · ${app} · ${secret}`);
    }
  }

  if (pack.errors.length > 0) {
    lines.push("", "## 错误", ...pack.errors.map((err) => `- ${err}`));
  }
  return lines.filter(Boolean).join("\n");
}

function joinPath(root: string, ...parts: string[]): string {
  const sep = root.includes("\\") ? "\\" : "/";
  let out = root.replace(/[\\/]+$/, "");
  for (const part of parts) {
    out += sep + part.replace(/^[\\/]+/, "").replace(/\//g, sep);
  }
  return out;
}

function displaySource(abs: string, root: string): string {
  const norm = (value: string) => value.replace(/\\/g, "/").toLowerCase();
  const a = abs.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (norm(a).startsWith(norm(r) + "/")) return a.slice(r.length).replace(/^[/\\]/, "");
  const bits = a.split("/").filter(Boolean);
  return bits.slice(-2).join("/");
}

async function readText(path: string): Promise<string | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const text = await invoke<string>("read_text_file", { path });
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

export function envCandidatePaths(root: string): string[] {
  return [joinPath(root, ".env.local")];
}

export async function loadWechatReadyPack(options?: {
  root?: string;
  args?: string;
}): Promise<WechatReadyPack> {
  const { invoke } = await import("@tauri-apps/api/core");
  const root =
    options?.root ??
    (await invoke<string>("get_niuma_root_dir").catch(() => "")) ??
    "";
  if (!root) {
    return {
      status: "error",
      slots: [],
      sources: [],
      errors: ["无法解析工作区根目录，读不到 .env.local"],
    };
  }

  const env: Record<string, string> = {};
  const sources: string[] = [];
  for (const path of envCandidatePaths(root)) {
    const text = await readText(path);
    if (!text) continue;
    Object.assign(env, parseDotenv(text));
    sources.push(displaySource(path, root));
  }

  const slots = wechatSlotsFromEnv(env);
  const selected = parseReadyAccountArg(options?.args ?? "", slots);
  const errors: string[] = [];
  if (sources.length === 0) errors.push("未找到工作区 `.env.local`");
  if (slots.length === 0) errors.push("没有解析到 WECHAT_N_APPID 槽位");

  return {
    status: slots.some((slot) => slot.hasAppId) ? "ok" : "error",
    slots,
    sources,
    selectedSlot: selected?.slot,
    errors,
  };
}
