/** Prompts for the floating editor assist bar. The model returns text; the bar applies it. */

export type EditorAssistKind =
  | "edit"
  | "continue"
  | "image"
  | "review-selection"
  | "review-document"
  | "format-selection";

export interface EditorAssistAgentNames {
  writerName?: string;
  reviewerName?: string;
  imageName?: string;
  formatterName?: string;
}

export type EditorAssistSeat = "writer" | "reviewer" | "formatter" | "illustrator";

/** `.teams/<team>/agents/` filenames for each bubble seat. */
export const ASSIST_TEAM_AGENT_FILES: Record<EditorAssistSeat, string> = {
  writer: "writer.md",
  reviewer: "chief.md",
  formatter: "publisher.md",
  illustrator: "illustrator.md",
};

export function assistSeatForKind(kind: EditorAssistKind): EditorAssistSeat {
  if (kind === "image") return "illustrator";
  if (kind === "review-selection" || kind === "review-document") return "reviewer";
  if (kind === "format-selection") return "formatter";
  return "writer";
}

export function assistTeamAgentFile(kind: EditorAssistKind): string {
  return ASSIST_TEAM_AGENT_FILES[assistSeatForKind(kind)];
}

export interface AssistRangeSnapshot {
  from: number;
  to: number;
  text: string;
}

/** Keep the last editor range so clicking the floating bar does not need editor focus. */
export function isWholeArticleSelection(selected: string, document: string): boolean {
  const a = selected.replace(/\s+/g, "");
  const b = document.replace(/\s+/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 80 && b.includes(a) && a.length / b.length >= 0.9;
}

export function resolveAssistRange(input: {
  from: number;
  to: number;
  empty: boolean;
  blockFrom: number;
  blockTo: number;
  selectedText: string;
  blockText: string;
}): AssistRangeSnapshot {
  if (!input.empty && input.selectedText.trim()) {
    return { from: input.from, to: input.to, text: input.selectedText };
  }
  return { from: input.blockFrom, to: input.blockTo, text: input.blockText };
}

export interface EditorAssistRequest {
  kind: EditorAssistKind;
  /** Passage under the cursor, or the selected text. */
  target: string;
  /** Full manuscript, used when the action covers the whole article. */
  document: string;
  instruction: string;
  /** `.teams/<teamId>/agents/` — article editor defaults to content. */
  teamId?: string;
  /** Team roster names; used to pick the matching `.teams` agent file. */
  agentNames?: EditorAssistAgentNames;
}

export function preferredAssistAgentName(
  kind: EditorAssistKind,
  names: EditorAssistAgentNames = {},
): string | undefined {
  if (kind === "image") return names.imageName?.trim() || names.writerName?.trim();
  if (kind === "review-selection" || kind === "review-document") {
    return names.reviewerName?.trim() || names.writerName?.trim();
  }
  if (kind === "format-selection") {
    return names.formatterName?.trim() || names.writerName?.trim();
  }
  return names.writerName?.trim();
}

export function pickAssistAgent<T extends { name: string }>(
  agents: T[],
  kind: EditorAssistKind,
  names: EditorAssistAgentNames = {},
): T | undefined {
  const preferred = preferredAssistAgentName(kind, names);
  const fallbacks = [preferred, names.writerName?.trim()].filter(Boolean) as string[];
  for (const name of fallbacks) {
    const hit = agents.find((agent) => agent.name.trim() === name);
    if (hit) return hit;
  }
  return undefined;
}

function agentPathInTeam(sourcePath: string | undefined, teamId: string, file?: string): boolean {
  const path = (sourcePath ?? "").replace(/\\/g, "/").toLowerCase();
  const folder = `/.teams/${teamId.toLowerCase()}/agents/`;
  if (!path.includes(folder)) return false;
  if (!file) return true;
  return path.endsWith(`${folder}${file.toLowerCase()}`);
}

/** Prefer `.teams/<team>/agents/<seat>.md` over hired-store copies. */
export function pickAssistTeamAgent<T extends { file: string; name: string; sourcePath?: string }>(
  agents: T[],
  kind: EditorAssistKind,
  options: { teamId?: string; names?: EditorAssistAgentNames } = {},
): T | undefined {
  const teamId = (options.teamId ?? "content").trim() || "content";
  const file = assistTeamAgentFile(kind);
  const inTeam = agents.filter((agent) => agentPathInTeam(agent.sourcePath, teamId));
  const pool = inTeam.length > 0 ? inTeam : agents;
  const byFile = pool.find((agent) => agent.file.toLowerCase() === file.toLowerCase());
  if (byFile) return byFile;
  return pickAssistAgent(pool, kind, options.names ?? {});
}

const LIMITS: Record<EditorAssistKind, { target: number; document: number }> = {
  edit: { target: 4000, document: 2000 },
  continue: { target: 2000, document: 4000 },
  image: { target: 1500, document: 1500 },
  "review-selection": { target: 4000, document: 2000 },
  "review-document": { target: 0, document: 12000 },
  "format-selection": { target: 4000, document: 2000 },
};

function clip(text: string, max: number): string {
  const value = text.trim();
  if (!max || value.length <= max) return value;
  return `${value.slice(0, max)}\n…（后文已截断）`;
}

export function editorAssistMessages(request: EditorAssistRequest): { system: string; user: string } {
  const limits = LIMITS[request.kind];
  const target = clip(request.target, limits.target);
  const document = clip(request.document, limits.document);
  const instruction = request.instruction.trim();
  const note = instruction ? `\n\n用户补充：${instruction}` : "";

  const seat = preferredAssistAgentName(request.kind, request.agentNames);
  const system = [
    seat
      ? `你就是 .teams 里的「${seat}」。用户在选区旁的图标气泡点了你的职责，沿用该角色的职责和文风，不要让用户再选 Agent 或再配模型。`
      : "你是选区旁的写作助手。只处理用户给出的这一处或这一篇。",
    "现在只处理用户给出的这一处或这一篇。不要提斜杠命令，不要要求换一个 Agent。",
    "修改、续写、排版选区时只返回 Markdown 正文，不要代码围栏，不要前后说明，不要改磁盘文件。",
    "审稿时用中文列出三遍结论（内容/风格/细节）、5 维质量分（满分 50，低于 35 阻断）、问题与建议。不要输出改写稿。暴露 AI 参与写作为硬约束。",
    "配图时只返回一行，以「配图：」开头，后面是可直接拿去生图的画面说明。沿用全文已锁定的一种 Style（见 illustration-plan.md / style-anchor）；不要每张换风格。产品界面不要画成假截图。",
  ].join("\n");

  const user = (() => {
    switch (request.kind) {
      case "edit":
        return `改写下面这一段，保留原意，按用户补充调整语气和句子。只返回替换后的 Markdown。\n\n【这一段】\n${target}${note}`;
      case "continue":
        return `从下面这段后面续写，接得上前文，不要重复已有句子。只返回要插入的新段落。\n\n【光标前】\n${target}\n\n【全文摘录】\n${document}${note}`;
      case "image":
        return instruction.includes("主题封面")
          ? `为整篇文章出主题封面配图（只出封面这一张的画面说明）。正文插图必须另按 illustration-plan：含封面共 3–5 张、全文一种 Style，不能只靠封面交差。只返回一行「配图：」加画面说明，包含主体、场景、用途、锁定 Style。\n\n【全文摘录】\n${document}${note}`
          : `为下面这段配一张图。Type 按段落选，Style 必须与全文锁定的那一种一致（不要另起风格）。流程/架构/对比用结构化画面（短中文标签），产品界面不要假截图。只返回一行「配图：」加画面说明。\n\n【这一段】\n${target}${note}`;
      case "review-selection":
        return `审下面这一段。用中文列出：问题、建议；若暴露 AI 参与写作标 🔴。不要输出改写稿。\n\n【这一段】\n${target}${note}`;
      case "review-document":
        return `审整篇文章。先做三遍审校（内容/风格/细节），再给 5 维分数（直接性、节奏、信任度、真实性、精炼度，各 1–10，满分 50；<35 阻断）。再列结构、事实与语气、最值得改的三处。暴露 AI 参与写作为硬约束。不要输出改写稿。\n\n【全文】\n${document}${note}`;
      case "format-selection":
        return `整理下面这一段的 Markdown：标题、列表、段落空行。不改变事实。只返回整理后的 Markdown。\n\n【这一段】\n${target}${note}`;
    }
  })();

  return { system, user };
}

export function unwrapAssistText(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:markdown|md|text)?\s*([\s\S]*?)```$/i);
  return (fence ? fence[1] : trimmed).trim();
}

export function extractImagePrompt(text: string): string {
  const unwrapped = unwrapAssistText(text);
  const line = unwrapped
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith("配图：") || item.startsWith("配图:"));
  const raw = line ?? unwrapped.split(/\r?\n/).find((item) => item.trim()) ?? "";
  return raw.replace(/^配图[:：]\s*/, "").trim();
}
