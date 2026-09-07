/**
 * Pi-style skill support.
 *
 * Enabled skills are advertised in the system prompt as an
 * `<available_skills>` block, and a single `load_skill` tool returns a skill's
 * full markdown content on demand. This mirrors how Pi/Claude skills work:
 * the model first sees names + descriptions, then loads a skill when relevant.
 */

import { Type } from "@earendil-works/pi-ai";
import type { Static, TSchema } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Skill } from "@/types";
import { invoke, text, normalizeTauriPath } from "./shared";
import { canonicalNiumaSkillSlug, expandNiumaSkillSlug } from "../skill-slugs";

/** Identity helper that preserves TypeBox param inference for `execute`. */
function defineTool<P extends TSchema>(def: {
  name: string;
  label: string;
  description: string;
  parameters: P;
  execute: (
    id: string,
    params: Static<P>,
    signal?: AbortSignal
  ) => Promise<AgentToolResult<unknown>>;
}): AgentTool {
  return def as unknown as AgentTool;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Format enabled skills as an `<available_skills>` XML block. */
export function formatSkillsPrompt(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const items = skills
    .map((s) => {
      const name = escapeXml(canonicalNiumaSkillSlug(s.name || s.id));
      const desc = escapeXml(s.description || "");
      return `  <skill>\n    <name>${name}</name>\n    <description>${desc}</description>\n  </skill>`;
    })
    .join("\n");
  return [
    "<available_skills>",
    "The following skills are available. Workflow:",
    "1. Call `load_skill` with the exact skill name to read its instructions.",
    "2a. If the skill contains a curl/HTTP call: call `run_skill` to execute it directly.",
    "2b. If the skill contains a node.js script (ima_api.cjs etc.): call `run_skill` with",
    '    args={"apiPath":"openapi/...","body":"{...}"}. Do NOT use the `bash` tool for skills —',
    "    script paths and working directories are managed automatically by `run_skill`.",
    "2c. Instruction-only skills: follow the loaded instructions yourself.",
    "Writing uses the current chat Provider text model (Settings → API 提供商). " +
      "Do not run write.py and do not use WRITING_MODEL_API_KEY.",
    "Images: call `generate_image` for original illustrations, or `search_images` then `save_web_image` for similar photos found on the web. Always write PNG under the draft imgs/ folder. " +
      "If a source image is not PNG, convert it to imgs/<name>.png first. WeChat 公众号 does not accept jfif/webp. " +
      "Do not run image_create.py and do not use IMAGE_MODEL_API_KEY.",
    "IMPORTANT: Never call `bash` to run a skill's node/python script. Always use `run_skill`.",
    "When speaking to the user, name the skill you are using (use wechat-article-* ids, never aws-wechat-*). Do not list files you read or wrote.",
    items,
    "</available_skills>",
  ].join("\n");
}

/** Build the `load_skill` tool over the enabled skills. */
export function buildLoadSkillTool(skills: Skill[]): AgentTool {
  const byName = new Map<string, Skill>();
  for (const s of skills) {
    const canonical = canonicalNiumaSkillSlug(s.name || s.id);
    const skill = s.name === canonical ? s : { ...s, name: canonical };
    const keys = new Set<string>();
    for (const key of [s.id, s.name, s.source, canonical]) {
      if (key) keys.add(key);
    }
    for (const alias of expandNiumaSkillSlug(canonical)) keys.add(alias);
    if (s.source) {
      for (const alias of expandNiumaSkillSlug(s.source)) keys.add(alias);
    }
    for (const key of keys) byName.set(key, skill);
  }
  return defineTool({
    name: "load_skill",
    label: "Load skill",
    description:
      "Load the full instructions for an available skill by its exact name. " +
      "Returns the skill's markdown content.",
    parameters: Type.Object({
      name: Type.String({ description: "Exact skill name to load." }),
    }),
    execute: async (_id, params) => {
      const skill = byName.get(params.name);
      if (!skill) {
        const available = [...byName.keys()].join(", ") || "(none)";
        throw new Error(
          `未找到 skill "${params.name}"。可用 skills: ${available}`
        );
      }
      const content = skill.content?.trim();
      if (!content) {
        throw new Error(`Skill "${skill.name}" 没有内容`);
      }
      return {
        content: [text(content)],
        details: { skill: canonicalNiumaSkillSlug(skill.name) },
      };
    },
  });
}

// ─── curl-template execution ("run_skill") ────────────────────────────────────

/** Matches fenced ```bash/```sh (or unlabeled) code blocks in a SKILL.md body. */
const CURL_BLOCK_RE = /```(?:bash|sh)?\s*\n([\s\S]*?)```/g;

interface SandboxRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/**
 * Extract a node.js script name from a bash code block, e.g.:
 *   node "$SKILL_DIR/ima_api.cjs" ...  →  "ima_api.cjs"
 */
function extractNodeScript(markdown: string): string | null {
  CURL_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CURL_BLOCK_RE.exec(markdown)) !== null) {
    const block = match[1];
    // Match: node [anything/]<script.cjs|.js|.mjs>
    const m = block.match(/\bnode\b[\s\S]*?[/\\"']([A-Za-z0-9_\-]+\.(?:cjs|mjs|js))/);
    if (m) return m[1];
  }
  return null;
}

/** Placeholder syntaxes supported in curl templates: {x}, {{x}}, <x>. */
const PLACEHOLDER_RE =
  /\{([A-Za-z_][A-Za-z0-9_]*)\}|\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}|<([a-zA-Z_][a-zA-Z0-9_]*)>/g;

/** Extract the first fenced code block that contains a `curl` command. */
function extractCurlTemplate(markdown: string): string | null {
  CURL_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CURL_BLOCK_RE.exec(markdown)) !== null) {
    if (/\bcurl\b/.test(match[1])) return match[1].trim();
  }
  return null;
}

/** Substitute `{x}` / `{{x}}` / `<x>` placeholders with values from `args` (case-insensitive keys). */
function substituteArgs(template: string, args: Record<string, unknown>): string {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) lower[k.toLowerCase()] = v;
  return template.replace(PLACEHOLDER_RE, (whole, p1, p2, p3) => {
    const key = (p1 ?? p2 ?? p3) as string;
    const val = lower[key.toLowerCase()];
    return val != null ? String(val) : whole;
  });
}

interface ParsedCurlRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const char of command) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

/** Parse a (substituted) curl command line into a plain HTTP request description. */
function parseCurlToHttpRequest(curl: string): ParsedCurlRequest {
  const oneLine = curl.replace(/\\\r?\n\s*/g, " ").trim();
  const parts = tokenizeCommand(oneLine);

  let url = "";
  let method = "GET";
  const headers: Record<string, string> = {};
  let body: string | undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "curl") continue;
    if (part === "-X" || part === "--request") {
      method = parts[++i] ?? "GET";
      continue;
    }
    if (part === "-H" || part === "--header") {
      const header = stripQuotes(parts[++i] ?? "");
      const colon = header.indexOf(":");
      if (colon !== -1) {
        headers[header.slice(0, colon).trim()] = header.slice(colon + 1).trim();
      }
      continue;
    }
    if (part === "-d" || part === "--data" || part === "--data-raw") {
      body = stripQuotes(parts[++i] ?? "");
      if (method === "GET") method = "POST";
      continue;
    }
    if (!part.startsWith("-") && !url) {
      url = stripQuotes(part);
    }
  }
  return { url, method, headers, body };
}

interface HttpRequestResponse {
  success: boolean;
  data?: unknown;
  text?: string;
  status?: number;
  error?: string;
}

/**
 * Build the `run_skill` tool: executes a skill's embedded curl template (if
 * any) as a real HTTP request via the Tauri `http_request` command.
 */
export function buildRunSkillTool(skills: Skill[]): AgentTool {
  const byName = new Map<string, Skill>();
  for (const s of skills) {
    byName.set(s.name || s.id, s);
  }
  return defineTool({
    name: "run_skill",
    label: "Run skill",
    description:
      "Execute an available skill's HTTP call with the given named arguments. " +
      "For curl-based skills: pass named args to substitute into the curl template placeholders. " +
      "For node.js-based skills (e.g. ima-skill): pass {\"apiPath\":\"openapi/...\",\"body\":\"{}\",\"options\":\"{}\"} — " +
      "apiPath is the IMA API path, body and options are JSON strings. " +
      "Only works for skills whose instructions include a curl or node command; for " +
      "instruction-only skills use `load_skill` instead.",
    parameters: Type.Object({
      name: Type.String({ description: "Exact skill name to run." }),
      args: Type.Optional(
        Type.String({
          description:
            'JSON object string of named arguments to substitute into the curl template placeholders, e.g. {"location":"Tokyo"}.',
        })
      ),
    }),
    execute: async (_id, params) => {
      const skill = byName.get(params.name);
      if (!skill) {
        const available = [...byName.keys()].join(", ") || "(none)";
        throw new Error(
          `未找到 skill "${params.name}"。可用 skills: ${available}`
        );
      }
      const curlTemplate = extractCurlTemplate(skill.content ?? "");

      // ── Node.js execution path (for skills like ima-skill that use node scripts) ──
      if (!curlTemplate) {
        const nodeScript = extractNodeScript(skill.content ?? "");
        if (nodeScript && skill.sourceType === "niuma") {
          const rawSkillsDir = await invoke<string>("get_niuma_skills_dir", {}).catch(() => "");
          const skillsDir = normalizeTauriPath(rawSkillsDir);
          if (!skillsDir) {
            throw new Error(`Skill "${skill.name}": 无法解析 skills 目录，请确认工作区路径已配置。`);
          }
          const sep = skillsDir.includes("/") ? "/" : "\\";
          const slug = skill.source || skill.name || skill.id;
          const skillDir = `${skillsDir}${sep}${slug}`;
          const scriptPath = `${skillDir}${sep}${nodeScript}`;

          let parsedArgs: Record<string, unknown> = {};
          if (params.args) {
            try { parsedArgs = JSON.parse(params.args); } catch {}
          }
          const apiPath = String(parsedArgs.apiPath ?? parsedArgs.api_path ?? "");
          const bodyArg = String(parsedArgs.body ?? "{}");
          const optionsArg = String(parsedArgs.options ?? "{}");
          const scriptArgs = apiPath ? [scriptPath, apiPath, bodyArg, optionsArg] : [scriptPath];

          const res = await invoke<SandboxRunResponse>("run_sandboxed_command", {
            req: {
              command: "node",
              args: scriptArgs,
              cwd: skillDir,  // ← run inside the skill's own directory
              sandboxMode: "read-only",
            },
          });

          if (res.timedOut) {
            throw new Error(`Skill "${skill.name}": 执行超时`);
          }
          if (res.exitCode !== 0) {
            let errMsg = res.stderr || "(无错误信息)";
            try { errMsg = (JSON.parse(res.stderr) as { msg?: string }).msg ?? errMsg; } catch {}
            throw new Error(`IMA API 错误: ${errMsg}`);
          }
          return {
            content: [text(res.stdout || "(空响应)")],
            details: { skill: skill.name, script: nodeScript, exitCode: res.exitCode },
          };
        }

        throw new Error(
          `Skill "${skill.name}" 没有可执行的 curl 或 node 指令，请改用 load_skill 读取说明后手动处理。`
        );
      }

      let args: Record<string, unknown> = {};
      if (params.args) {
        try {
          args = JSON.parse(params.args);
        } catch {
          throw new Error('`args` 必须是合法的 JSON 对象字符串，例如 {"location":"Tokyo"}');
        }
      }

      const populated = substituteArgs(curlTemplate, args);
      const req = parseCurlToHttpRequest(populated);
      if (!req.url) {
        throw new Error(`Skill "${skill.name}": 无法从 curl 模板中解析出 URL。`);
      }

      let data: unknown;
      if (req.body) {
        try {
          data = JSON.parse(req.body);
        } catch {
          data = req.body;
        }
      }

      const result = await invoke<HttpRequestResponse>("http_request", {
        args: {
          url: req.url,
          method: req.method,
          headers: req.headers,
          data,
          timeout: 30000,
        },
      });

      if (!result.success) {
        throw new Error(
          `请求失败 (${result.status ?? "?"}): ${result.error ?? "unknown error"}`
        );
      }

      const content =
        typeof result.data !== "undefined"
          ? typeof result.data === "string"
            ? result.data
            : JSON.stringify(result.data, null, 2)
          : result.text ?? "";

      return {
        content: [text(content || "(空响应)")],
        details: { skill: skill.name, url: req.url, status: result.status },
      };
    },
  });
}
