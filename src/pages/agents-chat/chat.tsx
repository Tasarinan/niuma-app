/**
 * Workstation › Chat
 *
 * Design reference: Ima ChatPage.
 *
 * Agent selection in channels comes from the **Agents page** "hired" catalog:
 *   - catalog loaded via loadAgentCatalog()
 *   - hired state tracked in localStorage under "niuma-hired-agents"
 *
 * When saving a channel, hired CatalogAgents are bridged to AgentDefinition
 * objects (auto-created if not found by name) so that useGroupChat can send
 * messages using the existing provider/model config.
 *
 * Layout:
 *   Left   (180px)  – Channel list
 *   Center – Window toolbar (对话/编辑 stays here). 对话 = messages; 编辑 = manuscript.
 *   Right  – Members (对话) or 稿件信息 + 配图 (编辑)
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  ScrollArea,
  Textarea,
} from "@/components/ui";
import { Markdown } from "@/components";
import { useAgents, useGroupChat } from "@/hooks";
import type { AgentInput } from "@/hooks";
import { MeetingChannelView, type MeetingParticipant } from "./components/meeting";
import { AgentTurnProgress } from "./components/AgentTurnProgress";
import { loadAgentCatalog, type CatalogAgent } from "@/lib/data/agent-loader";
import { fetchNiumaSkillCatalog, type NiumaSkill } from "@/lib/data";
import { loadHiredAgentFiles, loadDisabledSkillSlugs } from "@/lib/storage";
import { getImaKbConfig } from "@/lib/storage/ima.storage";
import { normalizeTauriPath } from "@/lib/agent/tools/shared";
import {
  ensureWorkbenchDefaultTeams,
  getWorkbenchTeamPreset,
  getWorkbenchTeamPresetById,
  loadWorkbenchTeamPresets,
  syncWorkbenchTeamChannel,
  WORKBENCH_TEAM_PRESETS,
  type WorkbenchTeamAccent,
  type WorkbenchTeamPreset,
} from "@/lib/agent/workbench-defaults";
import {
  getSeedSlashCommands,
  getSlashArgumentCompletion,
  loadSlashCommands,
  parseSlashInvocation,
  parseSlashQuery,
  rankSlashCommands,
  resolveSlashInvocation,
  type SlashCommandDefinition,
} from "@/lib/slash-commands";
import { formatDigestFeedContext, loadCentralFeeds } from "@/lib/digest/central-feeds";
import { formatReadyWechatContext, loadWechatReadyPack } from "@/lib/wechat/accounts";
import { formatImaTopicContext, loadImaTopicPack } from "@/lib/ima/openapi";
import {
  isAssistantPublishRequest,
  isEditArticleCommand,
  isFormatCommand,
  isNewArticleCommand,
  isPublishWorkflowCommand,
  isResumeArticleCommand,
  shouldInjectWechatSlots,
  splitPlatformAndRest,
} from "@/lib/content/workflow-command";
import { formatUnpublishedDraftsContext, loadUnpublishedDrafts, pickDefaultDraftOpenPath } from "@/lib/artifact/unpublished-drafts";
import { injectOpenDraftContext } from "@/lib/artifact/draft-workspace";
import { injectDraftTodayContext } from "@/lib/artifact/drafts";
import { formatContentTeamConfigContext, loadContentTeamConfigRaw } from "@/lib/artifact/content-team-config";
import { readLastOpenDraftPath } from "@/lib/artifact/article-storage";
import { requestOpenWorkbenchArticle } from "@/lib/artifact/open-workbench-article";
import { runImaApi } from "@/lib/functions/ima.api";
import type { AgentDefinition, AgentInternalToolId, GroupChannel, GroupMessage, SandboxMode } from "@/types";
import type { ImageContent } from "@earendil-works/pi-ai";
import { MAX_FILES } from "@/config";
import {
  AtSign,
  BookOpen,
  Download,
  Edit2,
  FilePenLine,
  Globe2,
  Hash,
  Heart,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  MessageSquareText,
  Mic,
  MoreVertical,
  Trash2,
  Paperclip,
  Plus,
  Search,
  Send,
  Square,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";
import { getActiveProvider } from "@/lib/providers/storage";
import { HealthImportReviewDialog } from "@/components/health/HealthImportReviewDialog";
import { resolveHealthSlashIntegration } from "@/lib/health/health-slash-integration";
import { runMinimalHealthUploadUsecase } from "@/lib/health/health-minimal-usecase";

// ─── Channel icon set ─────────────────────────────────────────────────────────
const ICON_MODULES = import.meta.glob<{ default: string }>(
  "../../assets/chat_icon/chat_avatar_item_*.jpeg",
  { eager: true }
);
const CHANNEL_ICONS: string[] = Object.values(ICON_MODULES).map((m) => m.default);
const DEFAULT_ICON = CHANNEL_ICONS[0] ?? "";

function randomIcon() {
  return CHANNEL_ICONS[Math.floor(Math.random() * CHANNEL_ICONS.length)] ?? DEFAULT_ICON;
}

function commandArgumentHint(command: SlashCommandDefinition): string {
  if (command.argumentHint) return command.argumentHint;
  return command.arguments
    .map((argument) =>
      argument.required ? `<${argument.name}>` : `[${argument.name}]`
    )
    .join(" ");
}

function isIconUrl(s: string) {
  return (
    s.startsWith("/") ||
    s.startsWith("http") ||
    s.startsWith("data:") ||
    s.includes("assets/")
  );
}

const HEALTH_AGENT_MARKERS = [
  "心内科",
  "心血管",
  "会诊协调",
  "皮肤科",
  "内分泌",
  "消化科",
  "全科",
  "老年科",
  "妇科",
  "血液科",
  "肾内科",
  "神经内科",
  "肿瘤科",
  "骨科",
  "儿科",
  "精神科",
  "心理科",
  "呼吸科",
  "泌尿科",
  "cardiology",
  "consultation",
  "dermatology",
  "endocrinology",
  "gastroenterology",
  "general",
  "geriatrics",
  "gynecology",
  "hematology",
  "nephrology",
  "neurology",
  "oncology",
  "orthopedics",
  "pediatrics",
  "psychiatry",
  "respiratory",
  "urology",
];

function looksLikeHealthAgent(agent: Pick<AgentDefinition, "name" | "role"> | null | undefined) {
  if (!agent) return false;
  const text = `${agent.name} ${agent.role ?? ""}`.toLowerCase();
  return HEALTH_AGENT_MARKERS.some((marker) => text.includes(marker.toLowerCase()));
}

function AvatarTile({
  src,
  label,
  className,
}: {
  src?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex size-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f3c98f]", className)}>
      {src && isIconUrl(src) ? (
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-slate-700">{label.slice(0, 1)}</span>
      )}
    </div>
  );
}

// ─── Hired-agents helpers ─────────────────────────────────────────────────────

/** Event emitted by the main toolbar (Toolbar.tsx) when the user submits plain
 *  text via the "Ask me anything" input. Payload carries the raw text; this
 *  page owns the actual single-agent "main chat" channel + sending logic. */
const TOOLBAR_MESSAGE_EVENT = "agent-chat:incoming-message";

/**
 * For a given CatalogAgent, find the matching AgentDefinition by name,
 * or create a new one from the catalog data.
 *
 * IMPORTANT: `createAgent` must be the store-backed `create` from useAgents()
 * (not agentDefinitionRepo.create directly) so the shared agents list updates
 * immediately - otherwise useGroupChat's sendMessage can't resolve the newly
 * created agent and silently sends no AI response.
 */
async function bridgeCatalogAgent(
  ca: CatalogAgent,
  existingDefs: AgentDefinition[],
  createAgent: (input: AgentInput) => Promise<AgentDefinition>
): Promise<string> {
  const match = existingDefs.find(
    (d) => d.name.trim().toLowerCase() === ca.name.trim().toLowerCase()
  );
  if (match) return match.id;

  const created = await createAgent({
    name: ca.name,
    role: ca.role ?? "",
    avatar: ca.avatar ?? "",
    description: ca.description ?? "",
    systemPrompt: ca.systemPrompt ?? "",
    providerId: ca.providerId ?? "",
    modelId: ca.modelId ?? "",
    enabledInternalTools: (ca.enabledInternalTools ?? []) as AgentInternalToolId[],
    enabledSkillIds: ca.enabledSkillIds ?? [],
    enabledMcpServerIds: ca.enabledMcpServerIds ?? [],
    sandboxMode: (ca.sandboxMode ?? "read-only") as SandboxMode,
    temperature: ca.temperature ?? 0.7,
    maxTokens: ca.maxTokens ?? 2000,
    workspacePath: ca.workspacePath ?? "",
  });
  return created.id;
}

const TEAM_STYLES: Record<
  WorkbenchTeamAccent,
  {
    border: string;
    icon: string;
    rail: string;
    soft: string;
    solid: string;
    text: string;
    tint: string;
    send: string;
  }
> = {
  rose: {
    border: "border-rose-200",
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
    rail: "bg-rose-500",
    soft: "bg-rose-50 text-rose-700 ring-rose-100",
    solid: "bg-rose-600",
    text: "text-rose-600",
    tint: "bg-rose-50/60",
    send: "bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-200",
  },
  emerald: {
    border: "border-emerald-200",
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    rail: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    solid: "bg-emerald-600",
    text: "text-emerald-600",
    tint: "bg-emerald-50/60",
    send: "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-200",
  },
  sky: {
    border: "border-sky-200",
    icon: "bg-sky-50 text-sky-600 ring-sky-100",
    rail: "bg-sky-500",
    soft: "bg-sky-50 text-sky-700 ring-sky-100",
    solid: "bg-sky-600",
    text: "text-sky-600",
    tint: "bg-sky-50/60",
    send: "bg-sky-600 hover:bg-sky-500 focus-visible:ring-sky-200",
  },
  violet: {
    border: "border-violet-200",
    icon: "bg-violet-50 text-violet-600 ring-violet-100",
    rail: "bg-violet-500",
    soft: "bg-violet-50 text-violet-700 ring-violet-100",
    solid: "bg-violet-600",
    text: "text-violet-600",
    tint: "bg-violet-50/60",
    send: "bg-violet-600 hover:bg-violet-500 focus-visible:ring-violet-200",
  },
  amber: {
    border: "border-amber-200",
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    rail: "bg-amber-500",
    soft: "bg-amber-50 text-amber-700 ring-amber-100",
    solid: "bg-amber-600",
    text: "text-amber-600",
    tint: "bg-amber-50/60",
    send: "bg-amber-600 hover:bg-amber-500 focus-visible:ring-amber-200",
  },
};

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportToMarkdown(
  channel: GroupChannel,
  msgs: GroupMessage[],
  agentMap: Record<string, AgentDefinition>
): string {
  const lines: string[] = [
    `# ${channel.name}`,
    "",
    `> 导出时间：${new Date().toLocaleString("zh-CN")}  `,
    `> 成员：${channel.agentIds.map((id) => agentMap[id]?.name ?? id).join("、")}`,
    "",
    "---",
    "",
  ];
  for (const msg of msgs) {
    if (msg.role === "user") {
      lines.push(
        `**用户**  `,
        `*${moment(msg.timestamp).format("MM/DD HH:mm")}*`,
        "",
        msg.content,
        "",
        "---",
        ""
      );
    } else {
      const agent = msg.agentId ? agentMap[msg.agentId] : undefined;
      lines.push(
        `**${msg.agentName ?? agent?.name ?? "Agent"}**  `,
        `*${moment(msg.timestamp).format("MM/DD HH:mm")}*`,
        "",
        msg.content,
        "",
        "---",
        ""
      );
    }
  }
  return lines.join("\n");
}

function downloadMarkdown(filename: string, content: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
  a.download = filename;
  a.click();
}

// ─── Channel Modal ────────────────────────────────────────────────────────────

/**
 * ChannelModal shows hired CatalogAgents (from the Agents page) for selection.
 * onSave receives the selected CatalogAgent IDs so the caller can bridge
 * to AgentDefinition IDs.
 */
function ChannelModal({
  open,
  onClose,
  initial,
  existingDefs,
  availableTeams,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** Channel being edited, or null for create. */
  initial?: GroupChannel | null;
  /** Current AgentDefinition list, used to reverse-map agentIds → catalog agents. */
  existingDefs: AgentDefinition[];
  /** Teams available for binding. */
  availableTeams: WorkbenchTeamPreset[];
  /** Receives (name, selectedCatalogIds, avatar, kind, tags, teamId). */
  onSave: (name: string, selectedCatalogIds: string[], avatar: string, kind: "chat" | "meeting", tags: string[], teamId?: string) => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(CHANNEL_ICONS[0] ?? "");
  const [kind, setKind] = useState<"chat" | "meeting">("chat");
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [hiredCatalog, setHiredCatalog] = useState<CatalogAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");

  // Reset form fields only when the modal opens or the target channel changes.
  // Must NOT depend on `existingDefs` — agent-list refreshes (from background sync)
  // would otherwise wipe whatever the user is currently typing.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setAvatar(
      initial?.avatar && isIconUrl(initial.avatar)
        ? initial.avatar
        : (CHANNEL_ICONS[0] ?? "")
    );
    setKind(initial?.kind ?? "chat");
    setTeamId(initial?.teamId);
  }, [open, initial]);

  // Load catalog + pre-select agents separately. Capture existingDefs in a ref
  // so we can read the latest value without adding it as a trigger dependency.
  const existingDefsRef = useRef(existingDefs);
  useEffect(() => { existingDefsRef.current = existingDefs; });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const hiredSet = loadHiredAgentFiles();
    loadAgentCatalog()
      .then((all) => {
        const hired = all.filter((a) => hiredSet.has(a.file));
        setHiredCatalog(hired);

        // For edit mode: reverse-map existing agentIds → catalog file names
        if (initial) {
          const preSelected: string[] = [];
          for (const agentId of initial.agentIds) {
            const def = existingDefsRef.current.find((d) => d.id === agentId);
            if (def) {
              const match = hired.find(
                (ca) => ca.name.trim().toLowerCase() === def.name.trim().toLowerCase()
              );
              if (match) preSelected.push(match.id);
            }
          }
          setSelectedCatalogIds(preSelected);
        } else {
          setSelectedCatalogIds([]);
        }
      })
      .finally(() => setLoading(false));
  }, [open, initial]);

  const toggleCatalogAgent = (id: string) =>
    setSelectedCatalogIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );

  const isImg = (av?: string) =>
    !!av && (av.startsWith("/") || av.startsWith("http") || av.startsWith("data:"));

  const handleTeamSelect = (id: string | undefined) => {
    setTeamId(id);
    if (id) {
      const preset = availableTeams.find((t) => t.id === id);
      if (preset) {
        if (!initial && !name.trim()) setName(preset.name);
        // Auto-set channel kind to match the team preset (e.g. meeting team → "meeting")
        if (preset.kind === "meeting" || preset.kind === "chat") setKind(preset.kind);
        // Auto-select team agents that exist in the hired catalog
        if (hiredCatalog.length > 0 && preset.agentFiles.length > 0) {
          const teamIds = hiredCatalog
            .filter((a) => preset.agentFiles.includes(a.file))
            .map((a) => a.id);
          if (teamIds.length > 0) setSelectedCatalogIds(teamIds);
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden rounded-xl p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6">
          <DialogTitle className="text-base">
            {initial ? t("chatPage.editChannel") : t("chatPage.createChannel")}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("chatPage.channelNameLabel")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("chatPage.channelNamePlaceholder")}
              className="rounded-xl"
            />
          </div>

          {/* Channel type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("chatPage.channelTypeLabel")}</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("chat")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  kind === "chat"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {t("chatPage.channelTypeChat")}
              </button>
              <button
                type="button"
                onClick={() => setKind("meeting")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  kind === "meeting"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {t("chatPage.channelTypeMeeting")}
              </button>
            </div>
          </div>

          {/* Team binding — above icon picker */}
          {availableTeams.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">绑定团队</Label>
              <div className="flex flex-wrap gap-2">
                {availableTeams.map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => handleTeamSelect(teamId === tp.id ? undefined : tp.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      teamId === tp.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    )}
                  >
                    <span>{tp.avatar}</span>
                    {tp.name}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">绑定后自动加载该团队的智能体、技能和命令</p>
            </div>
          )}

          {/* Icon picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">{t("chatPage.channelIcon")}</Label>
            <ScrollArea className="h-36 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
              <div className="grid grid-cols-6 gap-2">
                {CHANNEL_ICONS.map((ic, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(ic)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg border-2 transition-all hover:scale-105",
                      avatar === ic
                        ? "border-slate-900 shadow-md shadow-slate-200"
                        : "border-transparent hover:border-slate-200"
                    )}
                  >
                    <img src={ic} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Hired agent picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">
              {t("chatPage.activeAgents")}
              {selectedCatalogIds.length > 0 && (
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {selectedCatalogIds.length}
                </span>
              )}
            </Label>

            {loading ? (
              <div className="flex items-center justify-center rounded-lg border border-slate-100 bg-slate-50/60 py-6">
                <Loader2 className="size-4 animate-spin text-slate-400" />
                <span className="ml-2 text-xs text-slate-400">{t("chatPage.loadingAgents")}</span>
              </div>
            ) : hiredCatalog.length === 0 ? (
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-5 text-center">
                <p className="text-xs text-slate-400">
                  {t("chatPage.noHiredAgents")}
                  <span className="font-semibold text-slate-700">{t("chatPage.noHiredAgentsLink")}</span>
                  {t("chatPage.noHiredAgentsSuffix")}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-48 rounded-lg border border-slate-100 bg-slate-50/60">
                {hiredCatalog.map((a) => {
                  const selected = selectedCatalogIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleCatalogAgent(a.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-xs transition-colors hover:bg-white",
                        selected ? "bg-slate-100/80" : ""
                      )}
                    >
                      {/* Agent avatar */}
                      <div className="size-9 flex-shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                        {isImg(a.avatar) ? (
                          <img
                            src={a.avatar}
                            alt={a.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl">
                            {a.avatar || "🤖"}
                          </div>
                        )}
                      </div>

                      {/* Name / role */}
                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-semibold text-slate-800 truncate">{a.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{a.role}</p>
                      </div>

                      {/* Check */}
                      {selected && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </ScrollArea>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            {tCommon("actions.cancel")}
          </button>
          <Button
            size="sm"
            className="rounded-md px-5"
            onClick={() => {
              onSave(name, selectedCatalogIds, avatar, kind, [], teamId);
              onClose();
            }}
            disabled={!name.trim()}
          >
            {tCommon("actions.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface AttachedImage {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  size: number;
}

type MemberDisplayAgent = Pick<AgentDefinition, "id" | "name" | "avatar" | "role">;
type WorkbenchView = "chat" | "editor";

interface SandboxRunResponse {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

const IMA_DEFAULT_KB_ID_KEY = "niuma:ima:knowledge-base-id";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstArray(value: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const item = value[key];
    if (Array.isArray(item)) return item.map(asRecord);
  }
  return [];
}

function compactImaError(value: unknown) {
  if (value instanceof Error) return value.message;
  return String(value || "未知错误");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string)?.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

export default function ChatPage({
  activeView = "chat",
  openFilePath,
  onViewChange,
  onExternalActivate,
  onOpenEditor,
  onToggleMaximize,
  onClose,
  children,
}: {
  activeView?: WorkbenchView;
  /** Disk path of the manuscript open in the editor; injected into agent input, not the bubble. */
  openFilePath?: string;
  onViewChange?: (view: WorkbenchView) => void;
  /** Called when an external source (e.g. the main toolbar) routes a message
   *  into this page, so the parent can bring the "chat" section into view. */
  onExternalActivate?: () => void;
  /** Switches the floating workbench into the embedded editor view. */
  onOpenEditor?: () => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  /** Editor pane rendered in place of the conversation body when 编辑 is selected. */
  children?: ReactNode;
} = {}) {
  const { agents, create: createAgent, update: updateAgent, refresh: refreshAgents } = useAgents();
  const {
    channels,
    messages,
    selectedId,
    selectChannel,
    createChannel,
    editChannel: hookEditChannel,
    removeChannel,
    clearChannelMessages,
    sendMessage,
    isSending,
    streamingIds,
    stopGeneration,
  } = useGroupChat();

  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [healthImportOpen, setHealthImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editChannelState, setEditChannelState] = useState<GroupChannel | null>(null);
  const [showChannels, setShowChannels] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [meetingParticipants, setMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const meetingAssignSpeakerRef = useRef<(speakerId: string, label: string, profileId?: string) => void>(() => {});
  const [imaEnabled, setImaEnabled] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [isAugmenting, setIsAugmenting] = useState(false);
  const [workbenchTeamPresets, setWorkbenchTeamPresets] = useState(() => WORKBENCH_TEAM_PRESETS);
  const defaultTeamsSeedStartedRef = useRef(false);
  const activeTeamSyncKeyRef = useRef("");
  const activeTeamSyncingKeyRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("pages");
  const sidecar = activeView === "editor";

  const activeChannel = channels.find((c) => c.id === selectedId) ?? null;
  const activeMessages: GroupMessage[] = messages;
  const agentMap = useMemo(
    () => Object.fromEntries(agents.map((a) => [a.id, a])),
    [agents]
  );
  const activeTeamPreset = useMemo(
    () => {
      const preset = getWorkbenchTeamPreset(activeChannel, workbenchTeamPresets);
      if (preset) return preset;

      const channelAgents = activeChannel?.agentIds.map((id) => agentMap[id]).filter(Boolean) ?? [];
      return channelAgents.some(looksLikeHealthAgent)
        ? getWorkbenchTeamPresetById("health", workbenchTeamPresets)
        : null;
    },
    [activeChannel, agentMap, workbenchTeamPresets],
  );
  const activeTeamStyle = activeTeamPreset ? TEAM_STYLES[activeTeamPreset.accent] : null;
  const isHealthChannel = activeTeamPreset?.id === "health";
  const activeAgents = useMemo<MemberDisplayAgent[]>(() => {
    return activeChannel?.agentIds.map((id) => {
      const agent = agentMap[id];
      return agent
        ? {
            id: agent.id,
            name: agent.name,
            avatar: agent.avatar,
            role: agent.role,
          }
        : {
            id,
            name: id,
            avatar: "",
            role: "",
          };
    }) ?? [];
  }, [activeChannel, agentMap]);

  const syncTeamForChannel = useCallback(
    async (channel: GroupChannel) => {
      const presets = await loadWorkbenchTeamPresets();
      setWorkbenchTeamPresets(presets);
      const channelAgents = channel.agentIds.map((id) => agentMap[id]).filter(Boolean);
      const preset = getWorkbenchTeamPreset(channel, presets)
        ?? (channelAgents.some(looksLikeHealthAgent) ? getWorkbenchTeamPresetById("health", presets) : null);
      if (!preset) return;

      activeTeamSyncKeyRef.current = "";
      activeTeamSyncingKeyRef.current = "";
      await syncWorkbenchTeamChannel(preset, {
        channel,
        createAgent,
        updateAgent,
        editChannel: hookEditChannel,
        refreshAgents,
      });
    },
    [agentMap, createAgent, updateAgent, hookEditChannel, refreshAgents],
  );

  const activateChannel = useCallback(
    (channel: GroupChannel) => {
      selectChannel(channel.id);
      void syncTeamForChannel(channel).catch((error) => {
        console.warn("Failed to activate workbench channel:", error);
      });
    },
    [selectChannel, syncTeamForChannel],
  );

  const activateEditor = useCallback(() => {
    onViewChange?.("editor");
    onOpenEditor?.();
  }, [onOpenEditor, onViewChange]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkbenchTeamPresets().then((presets) => {
      if (!cancelled) setWorkbenchTeamPresets(presets);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (defaultTeamsSeedStartedRef.current) return;
    defaultTeamsSeedStartedRef.current = true;

    void ensureWorkbenchDefaultTeams({
      createAgent,
      updateAgent,
      refreshAgents,
      createChannel,
    }).catch((error) => {
      defaultTeamsSeedStartedRef.current = false;
      console.warn("Failed to seed default workbench teams:", error);
    });
  }, [createAgent, updateAgent, refreshAgents, createChannel]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages]);

  useEffect(() => {
    if (!activeChannel || !activeTeamPreset) return;
    const syncKey = [
      activeChannel.id,
      activeTeamPreset.id,
      activeTeamPreset.name,
      activeTeamPreset.kind,
      activeTeamPreset.commandDir ?? "",
      activeTeamPreset.agentFiles.join(","),
      (activeTeamPreset.legacyAgentFiles ?? []).join(","),
      activeTeamPreset.skillSlugs.join(","),
      activeChannel.agentIds.join(","),
    ].join(":");
    const hasAllManifestAgents = activeChannel.agentIds.length >= activeTeamPreset.agentFiles.length;
    if (hasAllManifestAgents && activeTeamSyncKeyRef.current === syncKey) return;
    if (activeTeamSyncingKeyRef.current === syncKey) return;
    activeTeamSyncingKeyRef.current = syncKey;

    void syncWorkbenchTeamChannel(activeTeamPreset, {
      channel: activeChannel,
      createAgent,
      updateAgent,
      editChannel: hookEditChannel,
      refreshAgents,
    })
      .then((members) => {
        activeTeamSyncingKeyRef.current = "";
        if (members.length >= activeTeamPreset.agentFiles.length) {
          activeTeamSyncKeyRef.current = syncKey;
        } else {
          activeTeamSyncKeyRef.current = "";
        }
      })
      .catch((error) => {
        activeTeamSyncKeyRef.current = "";
        activeTeamSyncingKeyRef.current = "";
        console.warn("Failed to activate workbench team:", error);
      });
  }, [activeChannel, activeTeamPreset, createAgent, updateAgent, hookEditChannel, refreshAgents]);

  // ─── PI-style "/" command picker (compose box) ─────────────────────────────
  // Command-name completion is active only at the start of the input. Selecting
  // a command inserts "/name ", leaving the remainder of the input for args.
  const [slashCommands, setSlashCommands] = useState<SlashCommandDefinition[]>(
    () => getSeedSlashCommands()
  );
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [slashMenuDismissed, setSlashMenuDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const commandDir = activeTeamPreset?.commandDir;

    const loadCommands = async () => {
      let scopedCommandsDir: string | undefined;
      if (commandDir) {
        if (commandDir.startsWith("teams/")) {
          const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
          if (root) {
            const separator = root.includes("/") ? "/" : "\\";
            scopedCommandsDir = `${root}${separator}.niuma${separator}${commandDir.replace(/\//g, separator)}`;
          }
        } else {
          const root = await invoke<string>("get_niuma_commands_dir").catch(() => "");
          if (root) {
            const separator = root.includes("/") ? "/" : "\\";
            scopedCommandsDir = `${root}${separator}${commandDir}`;
          }
        }
      }

      const commands = await loadSlashCommands(scopedCommandsDir);
      if (!cancelled) setSlashCommands(commands);
    };

    void loadCommands();
    return () => {
      cancelled = true;
    };
  }, [activeTeamPreset?.commandDir]);

  // ─── Skills catalog for /skills: picker ────────────────────────────────────
  const [niumaSkills, setNiumaSkills] = useState<NiumaSkill[]>([]);
  useEffect(() => {
    fetchNiumaSkillCatalog()
      .then((s) => setNiumaSkills(s))
      .catch(() => {});
  }, []);

  const slashQuery = useMemo(() => parseSlashQuery(input), [input]);
  const slashCommandSuggestions = useMemo(
    () =>
      slashQuery === null
        ? []
        : rankSlashCommands(slashCommands, slashQuery),
    [slashCommands, slashQuery]
  );
  const slashArgumentCompletion = useMemo(
    () => getSlashArgumentCompletion(input, slashCommands),
    [input, slashCommands]
  );

  // Detects "/skills:<filter>" prefix for the skills picker.
  const skillsQuery = useMemo(() => {
    const m = input.match(/^\/skills:(.*)$/i);
    return m !== null ? m[1].toLowerCase() : null;
  }, [input]);

  const skillPickerItems = useMemo(() => {
    if (skillsQuery === null) return [];
    const q = skillsQuery.trim();
    const disabledSlugs = loadDisabledSkillSlugs();
    const enabled = niumaSkills.filter((s) => !disabledSlugs.has(s.slug));
    if (!q) return enabled;
    return enabled.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [niumaSkills, skillsQuery]);

  const isCommandMenuOpen =
    !slashMenuDismissed && slashQuery !== null && skillsQuery === null && slashCommandSuggestions.length > 0;
  const isArgumentMenuOpen =
    !slashMenuDismissed &&
    slashArgumentCompletion !== null &&
    slashArgumentCompletion.choices.length > 0;
  const isSkillPickerOpen =
    !slashMenuDismissed && skillsQuery !== null;
  const isSlashMenuOpen = isCommandMenuOpen || isArgumentMenuOpen || isSkillPickerOpen;

  // ─── @ mention picker ────────────────────────────────────────────────────────
  const [mentionMenuDismissed, setMentionMenuDismissed] = useState(false);
  const [mentionMenuIndex, setMentionMenuIndex] = useState(0);

  const mentionState = useMemo(() => {
    const match = /@(\S*)$/.exec(input);
    if (!match) return null;
    return { query: match[1], atIndex: match.index };
  }, [input]);

  const mentionSuggestions = useMemo(() => {
    if (!mentionState) return [];
    const q = mentionState.query.toLowerCase();
    return activeAgents.filter((a) => q === "" || a.name.toLowerCase().includes(q));
  }, [mentionState, activeAgents]);

  const isMentionMenuOpen =
    !mentionMenuDismissed &&
    !isSlashMenuOpen &&
    mentionState !== null &&
    mentionSuggestions.length > 0;

  const activeInvocationCommand = useMemo(() => {
    const invocation = parseSlashInvocation(input);
    if (!invocation) return null;
    return slashCommands.find((command) => command.name === invocation.command) ?? null;
  }, [input, slashCommands]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setSlashMenuDismissed(false);
    setSlashMenuIndex(0);
    setMentionMenuDismissed(false);
    setMentionMenuIndex(0);
  };

  const selectSlashCommand = (command: SlashCommandDefinition) => {
    const inserted = `/${command.name} `;
    setInput(inserted);
    setSlashMenuIndex(0);
    setSlashMenuDismissed(false);
    requestAnimationFrame(() => {
      const pos = inserted.length;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    });
  };

  const selectSlashArgument = (value: string) => {
    if (!slashArgumentCompletion) return;
    const prefixLength = slashArgumentCompletion.prefix.length;
    const beforePrefix = prefixLength > 0 ? input.slice(0, -prefixLength) : input;
    const inserted = `${beforePrefix}${value} `;
    setInput(inserted);
    setSlashMenuIndex(0);
    setSlashMenuDismissed(false);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(inserted.length, inserted.length);
      textareaRef.current?.focus();
    });
  };

  const selectSkillFromPicker = (skill: NiumaSkill) => {
    const inserted = `/${skill.command} `;
    setInput(inserted);
    setSlashMenuIndex(0);
    setSlashMenuDismissed(false);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(inserted.length, inserted.length);
      textareaRef.current?.focus();
    });
  };

  const selectMention = (agent: MemberDisplayAgent) => {
    if (!mentionState) return;
    const before = input.slice(0, mentionState.atIndex);
    const inserted = `${before}@${agent.name} `;
    setInput(inserted);
    setMentionMenuIndex(0);
    setMentionMenuDismissed(true);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(inserted.length, inserted.length);
      textareaRef.current?.focus();
    });
  };

  const formatKnowledgeResults = (items: Record<string, unknown>[]) =>
    items
      .slice(0, 3)
      .map((item, index) => {
        const title = String(item.title ?? "未命名内容");
        const fetchedContent = String(item._fetched_content ?? "").trim();
        const url = String(item._url ?? "");
        const mediaType = Number(item.media_type ?? 0);
        const lines = [
          `${index + 1}. 《${title}》`,
        ];
        if (fetchedContent) {
          lines.push(`   正文摘要：${fetchedContent.slice(0, 600)}`);
        } else if (mediaType === 1) {
          lines.push(`   （PDF 文件，建议在 IMA 内打开阅读）`);
        } else {
          lines.push(`   （内容无法获取）`);
        }
        if (url) lines.push(`   来源：${url}`);
        lines.push(`   [标注: IMA 文章资产 · 《${title}》]`);
        return lines.join("\n");
      })
      .join("\n\n");

  /**
   * Fetch the readable text content of an IMA media item.
   * - WeChat articles (type=6): fetch HTML with browser UA, strip tags
   * - Others: return empty (PDF needs special parsing)
   */
  const fetchArticleContent = async (mediaType: number, url: string, _headers?: Record<string, string>): Promise<string> => {
    if (!url || mediaType !== 6) return "";
    try {
      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
      const resp = await tauriFetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Referer": "https://mp.weixin.qq.com/",
        },
      });
      if (!resp.ok) return "";
      const html = await resp.text();
      return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);
    } catch {
      return "";
    }
  };

  const searchImaKnowledge = async (query: string, knowledgeBaseId: string) => {
    const searchData = await runImaApi("openapi/wiki/v1/search_knowledge", {
      query,
      cursor: "",
      knowledge_base_id: knowledgeBaseId,
    });
    const items = firstArray(searchData, ["info_list", "infoList"]);

    // Enrich top 3 results: get actual URL + fetch content
    const enriched = await Promise.all(
      items.slice(0, 3).map(async (item) => {
        const mediaId = String(item.media_id ?? "");
        if (!mediaId) return item;
        try {
          const infoData = await runImaApi("openapi/wiki/v1/get_media_info", { media_id: mediaId });
          const urlInfo = asRecord(infoData.url_info ?? {});
          const url = String(urlInfo.url ?? "");
          const rawHeaders = urlInfo.headers;
          const hdrs = rawHeaders && typeof rawHeaders === "object"
            ? (rawHeaders as Record<string, string>)
            : {};
          const content = await fetchArticleContent(Number(item.media_type ?? 0), url, hdrs);
          return { ...item, _url: url, _fetched_content: content };
        } catch {
          return item;
        }
      })
    );
    return enriched;
  };

  const searchWeb = async (query: string): Promise<string> => {
    const skillsDir = normalizeTauriPath(await invoke<string>("get_niuma_skills_dir"));
    const sep = skillsDir.includes("/") ? "/" : "\\";
    const skillDir = `${skillsDir}${sep}web-access`;

    // Detect Xiaohongshu intent → route to xiaohongshu_search.mjs (requires CDP)
    const isXhsQuery = /小红书|xhs|xiaohongshu/i.test(query);
    if (isXhsQuery) {
      // Extract keywords: strip "小红书上" / "小红书" / "调研" etc., keep subject nouns
      const keywords = query
        .replace(/调研|小红书(?:上)?|风评|口碑|评价|评论|怎么样|怎样|如何|搜索|查询|找|看看/g, " ")
        .replace(/[，。？！、\s]+/g, " ")
        .trim();
      const result = await invoke<SandboxRunResponse>("run_sandboxed_command", {
        req: {
          command: "node",
          args: [`scripts${sep}xiaohongshu_search.mjs`, keywords, "8"],
          cwd: skillDir,
          sandboxMode: "read-only",
          timeoutMs: 60000,
        },
      });
      if (result.timedOut) throw new Error("小红书搜索超时");
      if (result.exitCode !== 0) {
        const stderr = result.stderr.trim();
        let msg = "";
        try { msg = (JSON.parse(stderr) as { msg?: string }).msg ?? ""; } catch { msg = ""; }
        throw new Error(msg || stderr || "小红书搜索失败");
      }
      interface XhsPost { title: string; desc: string; url: string; likes: string }
      const parsed = JSON.parse(result.stdout || "{}") as { results?: Record<string, XhsPost[]> };
      const sections: string[] = [];
      for (const [kw, posts] of Object.entries(parsed.results ?? {})) {
        if (posts.length === 0) continue;
        const items = posts.map((p, i) =>
          `${i + 1}. ${p.title}${p.desc ? `\n   ${p.desc}` : ""}${p.likes ? ` 👍${p.likes}` : ""}${p.url ? `\n   ${p.url}` : ""}`
        ).join("\n\n");
        sections.push(`【${kw}】\n${items}`);
      }
      return sections.join("\n\n");
    }

    // Default: Bing general web search
    const result = await invoke<SandboxRunResponse>("run_sandboxed_command", {
      req: {
        command: "node",
        args: [`scripts${sep}web_search.mjs`, query, "6"],
        cwd: skillDir,
        sandboxMode: "read-only",
        timeoutMs: 30000,
      },
    });
    if (result.timedOut) throw new Error("Web 搜索超时");
    if (result.exitCode !== 0) {
      const stderr = result.stderr.trim();
      let msg = "";
      try { msg = (JSON.parse(stderr) as { msg?: string }).msg ?? ""; } catch { msg = ""; }
      throw new Error(msg || stderr || result.stdout.trim() || "Web 搜索失败");
    }
    interface WebSearchItem { title: string; url: string; snippet: string }
    const parsed = JSON.parse(result.stdout || "{}") as { results?: WebSearchItem[] };
    return (parsed.results ?? [])
      .map((r, i) => `${i + 1}. ${r.title}${r.snippet ? `\n   ${r.snippet}` : ""}\n   ${r.url}`)
      .join("\n\n");
  };

  const gatherImaResults = async (query: string): Promise<string> => {
    // Prefer the 文章资产 KB from config (covers both 蜜粉 + 飞鸟 folders).
    const imaConfig = getImaKbConfig();
    if (imaConfig.kbId) {
      const results = await searchImaKnowledge(query, imaConfig.kbId);
      if (results.length === 0) return "";
      return `[文章资产 · 蜜粉+飞鸟]\n${formatKnowledgeResults(results)}`;
    }

    // Fallback: enumerate all accessible knowledge bases.
    const knowledgeBaseData = await runImaApi("openapi/wiki/v1/search_knowledge_base", {
      query: "",
      cursor: "",
      limit: 10,
    });
    const knowledgeBases = firstArray(knowledgeBaseData, ["info_list", "infoList"]);

    let knowledgeBaseId = window.localStorage.getItem(IMA_DEFAULT_KB_ID_KEY) || "";
    if (knowledgeBaseId && !knowledgeBases.some((item) => String(item.kb_id ?? item.id ?? "") === knowledgeBaseId)) {
      knowledgeBaseId = "";
      window.localStorage.removeItem(IMA_DEFAULT_KB_ID_KEY);
    }
    if (!knowledgeBaseId && knowledgeBases.length === 1) {
      knowledgeBaseId = String(knowledgeBases[0].kb_id ?? knowledgeBases[0].id ?? "");
      if (knowledgeBaseId) window.localStorage.setItem(IMA_DEFAULT_KB_ID_KEY, knowledgeBaseId);
    }

    const searchableBases = knowledgeBaseId
      ? knowledgeBases.filter((item) => String(item.kb_id ?? item.id ?? "") === knowledgeBaseId)
      : knowledgeBases;
    const groups: string[] = [];
    for (const knowledgeBase of searchableBases.slice(0, 10)) {
      const id = String(knowledgeBase.kb_id ?? knowledgeBase.id ?? "");
      if (!id) continue;
      const results = await searchImaKnowledge(query, id);
      if (results.length === 0) continue;
      const kbName = String(knowledgeBase.kb_name ?? knowledgeBase.name ?? "Ima 知识库");
      groups.push(`[${kbName}]\n${formatKnowledgeResults(results)}`);
    }
    return groups.join("\n\n");
  };

  const send = async () => {
    if ((!input.trim() && attachedImages.length === 0) || !selectedId || isSending) return;
    const text = input.trim();
    const images: ImageContent[] | undefined = attachedImages.length
      ? attachedImages.map((f) => ({ type: "image" as const, data: f.data, mimeType: f.mimeType }))
      : undefined;
    const resolution = resolveSlashInvocation(text, slashCommands);
    setInput("");
    setAttachedImages([]);
    setSlashMenuDismissed(true);

    let agentInput = resolution?.kind === "prompt" ? resolution.text : text;
    // Visible bubble stays as the user's typed text. Hidden draft/platform
    // context is only attached to agentInput so it does not inflate history.

    // Allow image-only send by supplying a minimal fallback prompt.
    if (!agentInput.trim() && images && images.length > 0) {
      agentInput = "请分析我上传的图片。";
    }

    const _slashForRouting = parseSlashInvocation(text);
    if (_slashForRouting && isEditArticleCommand(_slashForRouting.command)) {
      let path = openFilePath || readLastOpenDraftPath();
      if (!path) {
        try {
          const drafts = await loadUnpublishedDrafts();
          path = pickDefaultDraftOpenPath(drafts);
        } catch {
          path = undefined;
        }
      }
      if (path) {
        requestOpenWorkbenchArticle({ filePath: path, focus: "editor", switchView: true });
      }
      activateEditor();
      return;
    }
    const publishRequested = isAssistantPublishRequest(text);
    const commandAgentNames: string[] | undefined = (() => {
      if (_slashForRouting) {
        const cmd = slashCommands.find((c) => c.name === _slashForRouting.command);
        if (cmd?.agent) return [cmd.agent];
      }
      if (publishRequested) return ["发行"];
      return undefined;
    })();

    // /new: inject feeds + IMA + drafts(new) for 主理人. /resume: unpublished drafts only.
    if (_slashForRouting && isNewArticleCommand(_slashForRouting.command)) {
      setIsAugmenting(true);
      try {
        try {
          const pack = await loadCentralFeeds();
          agentInput = `${agentInput}\n\n${formatDigestFeedContext(pack)}`;
        } catch (err) {
          agentInput = `${agentInput}\n\n${formatDigestFeedContext({
            status: "error",
            x: [],
            podcasts: [],
            blogs: [],
            errors: [err instanceof Error ? err.message : String(err)],
          })}`;
        }
        try {
          const pack = await loadImaTopicPack({ query: _slashForRouting.args || "选题" });
          agentInput = `${agentInput}\n\n${formatImaTopicContext(pack)}`;
        } catch (err) {
          agentInput = `${agentInput}\n\n${formatImaTopicContext({
            status: "error",
            query: _slashForRouting.args || "选题",
            items: [],
            errors: [err instanceof Error ? err.message : String(err)],
          })}`;
        }
        try {
          const drafts = await loadUnpublishedDrafts();
          agentInput = `${agentInput}\n\n${formatUnpublishedDraftsContext(drafts, _slashForRouting.args, "new")}`;
        } catch (err) {
          agentInput = `${agentInput}\n\n${formatUnpublishedDraftsContext([], _slashForRouting.args, "new")}\n- 列举草稿失败：${err instanceof Error ? err.message : String(err)}`;
        }
        try {
          const configRaw = await loadContentTeamConfigRaw();
          agentInput = `${agentInput}\n\n${formatContentTeamConfigContext(configRaw)}`;
        } catch (err) {
          agentInput = `${agentInput}\n\n${formatContentTeamConfigContext("")}\n- 读取团队配置失败：${err instanceof Error ? err.message : String(err)}`;
        }
      } finally {
        setIsAugmenting(false);
      }
    }

    if (_slashForRouting && isResumeArticleCommand(_slashForRouting.command)) {
      setIsAugmenting(true);
      try {
        try {
          const drafts = await loadUnpublishedDrafts();
          agentInput = `${agentInput}\n\n${formatUnpublishedDraftsContext(drafts, _slashForRouting.args, "resume")}`;
        } catch (err) {
          agentInput = `${agentInput}\n\n${formatUnpublishedDraftsContext([], _slashForRouting.args, "resume")}\n- 列举草稿失败：${err instanceof Error ? err.message : String(err)}`;
        }
        try {
          const configRaw = await loadContentTeamConfigRaw();
          agentInput = `${agentInput}\n\n${formatContentTeamConfigContext(configRaw)}`;
        } catch (err) {
          agentInput = `${agentInput}\n\n${formatContentTeamConfigContext("")}\n- 读取团队配置失败：${err instanceof Error ? err.message : String(err)}`;
        }
      } finally {
        setIsAugmenting(false);
      }
    }

    if (
      _slashForRouting &&
      (isFormatCommand(_slashForRouting.command) || isPublishWorkflowCommand(_slashForRouting.command))
    ) {
      const { platform, rest } = splitPlatformAndRest(_slashForRouting.args);
      const isFormat = isFormatCommand(_slashForRouting.command);
      agentInput = [
        agentInput,
        "",
        "[内容平台]",
        `command: /${_slashForRouting.command}`,
        `platform: ${platform ?? "unset"}`,
        rest ? `rest: ${rest}` : "",
        platform
          ? isFormat
            ? "- 只排版，不要推草稿箱。"
            : "- 推到该平台草稿箱；XHS/ZHIHU 未接通时禁止假装已发。"
          : "- 先让用户选择 WECHAT、XHS 或 ZHIHU。未选定不要跑微信 format.py / publish.py。",
      ]
        .filter(Boolean)
        .join("\n");
    }

    const injectWechatSlots =
      (_slashForRouting && shouldInjectWechatSlots(_slashForRouting.command, _slashForRouting.args))
      || (!_slashForRouting && /(发到公众号|推送到公众号|发布到微信)/i.test(text));
    if (injectWechatSlots) {
      setIsAugmenting(true);
      try {
        const pack = await loadWechatReadyPack({
          args: _slashForRouting ? splitPlatformAndRest(_slashForRouting.args).rest : "",
        });
        agentInput = `${agentInput}\n\n${formatReadyWechatContext(pack)}`;
      } catch (err) {
        agentInput = `${agentInput}\n\n${formatReadyWechatContext({
          status: "error",
          slots: [],
          sources: [],
          errors: [err instanceof Error ? err.message : String(err)],
        })}`;
      } finally {
        setIsAugmenting(false);
      }
    }

    // In health channel, keep UI minimal: run local DB integration for key commands
    // and append structured context so skills/agents can continue with analysis.
    if (isHealthChannel) {
      if (attachedImages.length > 0) {
        const upload = await runMinimalHealthUploadUsecase({
          images: attachedImages,
          note: text,
        });
        agentInput = [
          agentInput || "请基于健康图片给出记录建议。",
          "",
          "[Health Minimal Upload Context]",
          upload.prompt,
        ].join("\n");
      }

      const slash = parseSlashInvocation(text);
      if (slash) {
        const healthContext = await resolveHealthSlashIntegration({
          command: slash.command,
          args: slash.args,
        });
        if (healthContext) {
          agentInput = [
            agentInput,
            "",
            "[Health DB Integration Context]",
            healthContext.prompt,
          ].join("\n");
        }
      }
    }

    // Augment with web/IMA search results when toggles are on
    if ((webEnabled || imaEnabled) && agentInput.trim()) {
      setIsAugmenting(true);
      const parts: string[] = [];
      const searchDate = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
      try {
        if (webEnabled) {
          try {
            const webResults = await searchWeb(text);
            if (webResults.trim()) {
              parts.push(`[实时网络搜索结果 · ${searchDate}]\n请优先参考以下搜索结果回答用户问题，这是最新的网络信息：\n\n${webResults}`);
            }
          } catch (e) {
            parts.push(`[Web 搜索失败: ${compactImaError(e)}]`);
          }
        }
        if (imaEnabled && !(_slashForRouting && isNewArticleCommand(_slashForRouting.command))) {
          try {
            const imaResults = await gatherImaResults(text);
            if (imaResults.trim()) {
              parts.push(
                `[IMA 文章资产参考内容]\n请优先参考以下文章资料回答，并在回复中标注「《文章标题》 \u00b7 IMA文章资产」格式的来源：\n\n${imaResults}`
              );
            }
          } catch (e) {
            parts.push(`[Ima 搜索失败: ${compactImaError(e)}]`);
          }
        }
        if (parts.length > 0) {
          agentInput = `${agentInput}\n\n${parts.join("\n\n")}`;
        }
      } finally {
        setIsAugmenting(false);
      }
    }

    const lastOpenPath = readLastOpenDraftPath();
    agentInput = injectDraftTodayContext(agentInput);
    if (!(_slashForRouting && isNewArticleCommand(_slashForRouting.command))) {
      agentInput = injectOpenDraftContext(agentInput, { openFilePath, lastOpenPath });
    }

    await sendMessage(agentInput, images, undefined, commandAgentNames, text.trim() ? text : undefined);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      void fileToBase64(file).then((data) => {
        setAttachedImages((prev) =>
          prev.length >= MAX_FILES
            ? prev
            : [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  name: file.name,
                  mimeType: file.type,
                  data,
                  size: file.size,
                },
              ]
        );
      });
    });
    e.target.value = "";
  };

  const removeAttachedImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((f) => f.id !== id));
  };

  const handleExport = () => {
    if (!activeChannel) return;
    const md = exportToMarkdown(activeChannel, activeMessages, agentMap);
    downloadMarkdown(`${activeChannel.name}-${Date.now()}.md`, md);
  };

  const openCreate = () => {
    setEditChannelState(null);
    setModalOpen(true);
  };

  /**
  * Bridge: convert selected CatalogAgent IDs → AgentDefinition IDs.
   * Creates AgentDefinitions on-the-fly for any hired agent not yet in the repo.
   */
  const handleChannelSave = useCallback(
    async (name: string, selectedCatalogIds: string[], avatar: string, kind: "chat" | "meeting", tags: string[], teamId?: string) => {
      const hiredSet = loadHiredAgentFiles();
      const all = await loadAgentCatalog();
      const hired = all.filter((a) => hiredSet.has(a.file));

      const agentIds: string[] = [];
      for (const catalogId of selectedCatalogIds) {
        const ca = hired.find((a) => a.id === catalogId);
        if (!ca) continue;
        const id = await bridgeCatalogAgent(ca, agents, createAgent);
        agentIds.push(id);
      }

      if (editChannelState) {
        hookEditChannel(editChannelState.id, { name, agentIds, avatar, kind, tags, teamId: teamId ?? undefined });
      } else {
        createChannel(name, agentIds, avatar || randomIcon(), kind, tags, teamId);
      }
    },
    [agents, editChannelState, hookEditChannel, createChannel, createAgent]
  );

  /**
   * Finds (or lazily creates) the single-agent "main chat" channel used by the
   * main toolbar's "Ask me anything" input, and sends `text` into it.
  * Default agent = the built-in "Assistant" (assistant.md), falling back
   * to the first hired agent, then the first catalog agent, if it's missing.
   */
  const ensureMainChannelAndSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const mainName = t("chatPage.mainChannelName");
      let channel = channels.find((c) => c.name === mainName);

      if (!channel) {
        const hiredSet = loadHiredAgentFiles();
        const all = await loadAgentCatalog();
        const hired = all.filter((a) => hiredSet.has(a.file));
        // Default agent for the main chat is always the built-in "Assistant"
        // (general Q&A + local/web search), regardless of what's hired.
        const defaultAgent = all.find((a) => a.file === "assistant.md");
        const candidate = defaultAgent ?? hired[0] ?? all[0];

        const agentIds: string[] = [];
        if (candidate) {
          const id = await bridgeCatalogAgent(candidate, agents, createAgent);
          agentIds.push(id);
        }
        channel = createChannel(mainName, agentIds, randomIcon(), "chat");
      } else {
        selectChannel(channel.id);
      }

      onExternalActivate?.();
      await sendMessage(trimmed, undefined, channel.id);
    },
    [channels, agents, createAgent, createChannel, selectChannel, sendMessage, onExternalActivate, t]
  );

  // Listen for text routed in from the main toolbar's input.
  useEffect(() => {
    const unlisten = listen<{ text: string }>(TOOLBAR_MESSAGE_EVENT, (event) => {
      void ensureMainChannelAndSend(event.payload?.text ?? "");
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [ensureMainChannelAndSend]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#f3f4f8] text-slate-950">
      <aside className={cn(
        "w-[180px] flex-shrink-0 flex-col border-r border-[#d9dce8] bg-[#e7e8f5]",
        showChannels ? "flex" : "hidden"
      )}>
        <div className="flex h-[72px] items-center gap-2 py-4 pl-3 pr-1">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#d8daf0] px-3 text-slate-500">
            <Search className="size-4" />
            <span className="text-xs">搜索</span>
          </div>
          <button
            type="button"
            onClick={openCreate}
            title={t("chatPage.newChannel")}
            className="relative z-20 flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#e7e8f5] text-slate-600 transition-colors hover:bg-white/80 hover:text-slate-950"
          >
            <Plus className="size-5" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-3 pb-3">
          {channels.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
              <MessageSquarePlus className="size-4" />
              准备中
            </div>
          ) : channels.map((channel, index) => {
            const selected = selectedId === channel.id;
            const channelAvatar = channel.avatar && isIconUrl(channel.avatar)
              ? channel.avatar
              : CHANNEL_ICONS[index % CHANNEL_ICONS.length];
            const memberCount = channel.agentIds.length;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => activateChannel(channel)}
                className={cn(
                  "mb-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors",
                  selected ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-950"
                )}
              >
                <AvatarTile src={channelAvatar} label={channel.name} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold">{channel.name}</span>
                  <span className="mt-0.5 block truncate text-[9px] font-medium text-slate-400">
                    {t("chatPage.memberCount", { count: memberCount })}
                  </span>
                </span>
              </button>
            );
          })}
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8fb]">
        <div
          className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-[#e7e9f0] bg-white px-3"
          data-tauri-drag-region
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex min-w-0 items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {activeTeamPreset?.id === "content" && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => onViewChange?.("chat")}
                title="对话"
                aria-label="对话"
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  activeView === "chat"
                    ? "bg-white text-[#7771e8] shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <MessageSquareText className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={activateEditor}
                title="编辑"
                aria-label="编辑"
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  activeView === "editor"
                    ? "bg-white text-[#7771e8] shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <FilePenLine className="size-3.5" />
              </button>
            </div>
            )}
            <p className="ml-1 truncate text-base font-bold text-slate-950">
              {activeChannel?.name ?? "Channel"}
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => setShowChannels((value) => !value)}
              title={showChannels ? "关闭左侧频道" : "展开左侧频道"}
              aria-label={showChannels ? "关闭左侧频道" : "展开左侧频道"}
              className={cn(
                "relative z-20 flex size-8 flex-shrink-0 items-center justify-center rounded-md transition-colors",
                showChannels
                  ? "bg-[#eeedff] text-[#7771e8]"
                  : "bg-slate-100 text-slate-400 hover:text-slate-700"
              )}
            >
              <Hash className="size-3.5" />
            </button>
            {!sidecar && activeChannel && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMembers((value) => !value)}
                  title={showMembers ? "关闭参与人员" : "打开参与人员"}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors",
                    showMembers
                      ? "bg-[#eeedff] text-[#7771e8]"
                      : "bg-slate-100 text-slate-400 hover:text-slate-700"
                  )}
                >
                  <UserPlus className="size-3.5" />
                  {activeAgents.length}
                </button>
              </>
            )}
            {onToggleMaximize && (
              <button
                type="button"
                onClick={onToggleMaximize}
                title="放大 / 还原"
                aria-label="放大 / 还原"
                className="flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Maximize2 className="size-4" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="关闭"
                aria-label="关闭"
                className="flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="size-4" />
              </button>
            )}
            {activeChannel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    title="More"
                    aria-label="More"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="size-4" />
                    {t("chatPage.export")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditChannelState(activeChannel);
                      setModalOpen(true);
                    }}
                  >
                    <Edit2 className="size-4" />
                    {t("chatPage.editChannel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(`确定删除频道「${activeChannel.name}」？此操作不可恢复。`)) {
                        removeChannel(activeChannel.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                    删除频道
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm("清除当前频道所有对话记录？")) {
                        clearChannelMessages(activeChannel.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                    清除对话
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className={cn("min-h-0 min-w-0 flex-1", sidecar ? "flex" : "hidden")}>
            {children}
          </div>
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
              sidecar && "hidden",
            )}
          >
        {!activeChannel ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            {t("chatPage.selectChannel")}
          </div>
        ) : activeChannel.kind === "meeting" ? (
          <MeetingChannelView
            key={activeChannel.id}
            channel={activeChannel}
            onParticipantsChange={(ps, assign) => {
              setMeetingParticipants(ps);
              meetingAssignSpeakerRef.current = assign;
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  ref={scrollRef}
                  className={cn(
                    "flex-1 space-y-6 overflow-x-hidden overflow-y-auto py-6",
                    sidecar ? "px-3" : "px-6",
                  )}
                >
                  {activeMessages.length === 0 ? (
                <div className="mx-auto flex min-h-full max-w-xl items-center text-sm text-slate-400">
                  {t("chatPage.startMessaging")}
                      </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const agent = msg.agentId ? agentMap[msg.agentId] : undefined;
                      const isUser = msg.role === "user";
                      const streaming = streamingIds.has(msg.id);
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex gap-3",
                            isUser ? "flex-row-reverse" : "flex-row"
                          )}
                        >
                          {!isUser && (
                            <AvatarTile
                              src={agent?.avatar ?? msg.agentAvatar}
                              label={msg.agentName ?? agent?.name ?? "AI"}
                              className="size-9 rounded-full"
                            />
                          )}
                          <div
                            className={cn(
                              "flex max-w-[68%] flex-col gap-2",
                              isUser ? "items-end" : "items-start"
                            )}
                          >
                            {!isUser && (
                              <span className="text-sm font-semibold text-slate-700">
                                {msg.agentName ?? agent?.name}
                              </span>
                            )}
                            <div
                              className={cn(
                                "overflow-x-auto rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm",
                                isUser
                                  ? cn("rounded-tr-md text-white", activeTeamStyle?.solid ?? "bg-[#7771e8]")
                                  : "rounded-tl-md bg-white text-slate-800 ring-1 ring-slate-100"
                              )}
                            >
                              {isUser && msg.images && msg.images.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                  {msg.images.map((img, i) => (
                                    <img
                                      key={i}
                                      src={`data:${img.mimeType};base64,${img.data}`}
                                      alt=""
                                      className="size-16 rounded-lg object-cover ring-1 ring-white/30"
                                    />
                                  ))}
                                </div>
                              )}
                              {!isUser && (
                                <AgentTurnProgress
                                  steps={msg.toolProgress}
                                  streaming={streaming && !msg.content}
                                />
                              )}
                              {msg.content && <Markdown>{msg.content}</Markdown>}
                            </div>
                            <span className="text-xs text-slate-400">
                              {moment(msg.timestamp).format("HH:mm")}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

            <div className={cn("flex-shrink-0 bg-transparent pb-4", sidecar ? "px-3" : "px-6")}>
                  {attachedImages.length > 0 && (
                <div className="mx-auto mb-2 flex max-w-4xl flex-wrap gap-2">
                      {attachedImages.map((img) => (
                        <div key={img.id} className="group relative">
                          <img
                            src={`data:${img.mimeType};base64,${img.data}`}
                            alt={img.name}
                            className="size-14 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                          <button
                            type="button"
                            title={t("chatPage.removeImage")}
                            onClick={() => removeAttachedImage(img.id)}
                            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeInvocationCommand && !isCommandMenuOpen && (
                <div className="mx-auto mb-2 max-w-4xl rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className={cn("text-xs font-semibold", activeTeamStyle?.text ?? "text-slate-700")}>
                          /{activeInvocationCommand.name}
                        </span>
                        {commandArgumentHint(activeInvocationCommand) && (
                          <span className={cn("font-mono text-[10px]", activeTeamStyle?.text ?? "text-slate-500")}>
                            {commandArgumentHint(activeInvocationCommand)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {activeInvocationCommand.description}
                        </span>
                      </div>
                      {activeInvocationCommand.arguments.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {activeInvocationCommand.arguments.map((argument) => (
                            <span
                              key={argument.name}
                              title={argument.description}
                              className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200"
                            >
                              {argument.required ? `<${argument.name}>` : `[${argument.name}]`}
                              {argument.description ? ` · ${argument.description}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* PI-style inline command/mention/argument menu — no floating popover */}
                  {(isSlashMenuOpen || isMentionMenuOpen) && (
                    <div className="mx-auto mb-2 max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {/* Header row */}
                      {isMentionMenuOpen ? (
                        <div className="border-b border-slate-100 px-3 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 flex items-center gap-1">
                          <AtSign className="size-3" />
                          <span>提及成员</span>
                        </div>
                      ) : isSkillPickerOpen ? (
                        <div className="border-b border-slate-100 px-3 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 flex items-center gap-2">
                          <Zap className="size-3" />
                          <span>选择技能</span>
                          {skillPickerItems.length === 0 && <span className="text-slate-300">（无匹配）</span>}
                        </div>
                      ) : (
                        <div className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-3 border-b border-slate-100 px-3 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          <span>
                            {isCommandMenuOpen
                              ? "Command"
                              : slashArgumentCompletion
                                ? `${slashArgumentCompletion.argument.required ? "Required" : "Optional"} · ${slashArgumentCompletion.argument.name}`
                                : "Argument"}
                          </span>
                          <span>Description</span>
                        </div>
                      )}
                      {/* Items */}
                      <div className="max-h-48 space-y-0.5 overflow-y-auto p-1">
                        {isMentionMenuOpen ? mentionSuggestions.map((agent, idx) => (
                          <button
                            key={agent.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectMention(agent); }}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                              idx === mentionMenuIndex ? "bg-slate-100 text-slate-950" : "hover:bg-slate-100"
                            )}
                          >
                            {agent.avatar ? (
                              <img src={agent.avatar} alt={agent.name} className="size-6 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                                {agent.name.slice(0, 1)}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-800">{agent.name}</span>
                              {agent.role && <span className="block truncate text-[10px] text-slate-400">{agent.role}</span>}
                            </span>
                          </button>
                        )) : isSkillPickerOpen ? skillPickerItems.map((skill, idx) => (
                          <button
                            key={skill.slug}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectSkillFromPicker(skill); }}
                            className={cn(
                              "grid w-full grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                              idx === slashMenuIndex ? "bg-slate-100 text-slate-950" : "hover:bg-slate-100"
                            )}
                          >
                            <span className="min-w-0 flex items-center gap-1.5">
                              {skill.icon && <span className="text-sm leading-none">{skill.icon}</span>}
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-800">{skill.name}</span>
                                <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">/{skill.command}</span>
                              </span>
                            </span>
                            <span className="min-w-0 text-[11px] leading-4 text-slate-500">
                              <span className="line-clamp-2">{skill.description || "No description"}</span>
                              {skill.category && <span className="mt-0.5 block text-[9px] uppercase text-slate-300">{skill.category}</span>}
                            </span>
                          </button>
                        )) : isCommandMenuOpen ? slashCommandSuggestions.map((command, idx) => (
                          <button
                            key={command.name}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectSlashCommand(command); }}
                            className={cn(
                              "grid w-full grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-3 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                              idx === slashMenuIndex ? "bg-slate-100 text-slate-950" : "hover:bg-slate-100"
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-800">/{command.name}</span>
                              {commandArgumentHint(command) && (
                                <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">
                                  {commandArgumentHint(command)}
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 text-[11px] leading-4 text-slate-500">
                              <span className="line-clamp-2">{command.description || "No description"}</span>
                              <span className="mt-0.5 block text-[9px] uppercase text-slate-300">{command.sourceLabel}</span>
                            </span>
                          </button>
                        )) : slashArgumentCompletion?.choices.map((choice, idx) => (
                          <button
                            key={choice.value}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectSlashArgument(choice.value); }}
                            className={cn(
                              "grid w-full grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-3 rounded-lg px-2 py-2 text-left text-xs transition-colors",
                              idx === slashMenuIndex ? "bg-slate-100 text-slate-950" : "hover:bg-slate-100"
                            )}
                          >
                            <span className="truncate font-mono font-medium text-slate-800">{choice.value}</span>
                            <span className="text-[11px] text-slate-500">
                              {choice.description || slashArgumentCompletion.argument.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mx-auto flex max-w-5xl items-end gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-xl shadow-slate-200/80 transition-all focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-300">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          title={
                            attachedImages.length >= MAX_FILES
                              ? t("chatPage.maxImagesReached", { max: MAX_FILES })
                              : t("chatPage.attachImage")
                          }
                          disabled={attachedImages.length >= MAX_FILES}
                          onClick={() => fileInputRef.current?.click()}
                          className="relative flex size-8 flex-shrink-0 items-center justify-center rounded-md text-[#8b82ff] transition-colors hover:bg-[#f0efff] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Paperclip className="size-3.5" />
                          {attachedImages.length > 0 && (
                            <span className={cn("absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold text-white", activeTeamStyle?.solid ?? "bg-slate-900")}>
                              {attachedImages.length}
                            </span>
                          )}
                        </button>
                        {attachedImages.length > 0 && !isHealthChannel && (
                          <button
                            type="button"
                            title="保存为健康记录"
                            onClick={() => setHealthImportOpen(true)}
                            className="flex size-8 flex-shrink-0 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50"
                          >
                            <Heart className="size-3.5" />
                          </button>
                        )}
                        <Textarea
                          ref={textareaRef}
                          value={input}
                          onChange={handleInputChange}
                          onKeyDown={(e) => {
                            if (isMentionMenuOpen) {
                              const count = mentionSuggestions.length;
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setMentionMenuIndex((i) => (i + 1) % count);
                                return;
                              }
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setMentionMenuIndex((i) => (i - 1 + count) % count);
                                return;
                              }
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                selectMention(mentionSuggestions[mentionMenuIndex]);
                                return;
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setMentionMenuDismissed(true);
                                return;
                              }
                            }
                            if (isSlashMenuOpen) {
                              const suggestionCount = isSkillPickerOpen
                                ? skillPickerItems.length
                                : isCommandMenuOpen
                                  ? slashCommandSuggestions.length
                                  : slashArgumentCompletion?.choices.length ?? 0;
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setSlashMenuIndex(
                                  (i) => suggestionCount > 0 ? (i + 1) % suggestionCount : 0
                                );
                                return;
                              }
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setSlashMenuIndex(
                                  (i) =>
                                    suggestionCount > 0 ? (i - 1 + suggestionCount) % suggestionCount : 0
                                );
                                return;
                              }
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                if (isSkillPickerOpen && skillPickerItems[slashMenuIndex]) {
                                  selectSkillFromPicker(skillPickerItems[slashMenuIndex]);
                                } else if (isCommandMenuOpen) {
                                  selectSlashCommand(slashCommandSuggestions[slashMenuIndex]);
                                } else if (slashArgumentCompletion) {
                                  selectSlashArgument(
                                    slashArgumentCompletion.choices[slashMenuIndex].value
                                  );
                                }
                                return;
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setSlashMenuDismissed(true);
                                return;
                              }
                            }
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void send();
                            }
                          }}
                          placeholder={t("chatPage.inputPlaceholder", { name: activeChannel.name })}
                          rows={2}
                          className="min-h-[52px] max-h-48 flex-1 resize-none border-0 bg-transparent p-0 text-[15px] leading-7 shadow-none focus-visible:ring-0 caret-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => setImaEnabled((v) => !v)}
                          disabled={isAugmenting}
                          title={imaEnabled ? "禁用 Ima 知识库" : "启用 Ima 知识库"}
                          className={cn(
                            "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-bold transition-colors disabled:opacity-60",
                            imaEnabled
                              ? "bg-[#f0efff] text-[#8b82ff]"
                              : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          )}
                        >
                          {isAugmenting && imaEnabled ? <Loader2 className="size-3.5 animate-spin" /> : <BookOpen className="size-3.5" />}
                          Ima
                        </button>
                        <button
                          type="button"
                          onClick={() => setWebEnabled((v) => !v)}
                          disabled={isAugmenting}
                          title={webEnabled ? "禁用网络搜索" : "启用网络搜索"}
                          className={cn(
                            "flex size-8 flex-shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-60",
                            webEnabled
                              ? "bg-[#e8f4fd] text-[#2196f3]"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          {isAugmenting && webEnabled ? <Loader2 className="size-4 animate-spin" /> : <Globe2 className="size-4" />}
                        </button>
                        <button
                          type="button"
                          title="Mic"
                          className="flex size-8 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Mic className="size-4" />
                        </button>
                        {isSending ? (
                          <button
                            type="button"
                            onClick={() => stopGeneration()}
                            className="flex size-8 flex-shrink-0 items-center justify-center rounded-md bg-red-100 text-red-500 transition-colors hover:bg-red-200"
                          >
                            <Square className="size-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void send()}
                            disabled={!input.trim() && attachedImages.length === 0}
                            className={cn(
                              "flex size-8 flex-shrink-0 items-center justify-center rounded-md text-white shadow transition-all disabled:opacity-40 disabled:shadow-none",
                              activeTeamStyle?.send ?? "bg-slate-900 hover:bg-slate-700"
                            )}
                          >
                            <Send className="size-3.5" />
                          </button>
                        )}
                      </div>

            </div>
          </div>
        )}
          </div>
        </div>
      </main>

      {showMembers && !sidecar && (
      <aside className="flex w-[180px] flex-shrink-0 flex-col border-l border-[#e7e9f0] bg-white">
        <div className="flex h-14 items-center justify-between px-5">
          <p className="text-[11px] font-bold text-slate-950">成员 · {activeAgents.length}</p>
          <button
            type="button"
            onClick={() => setShowMembers(false)}
            className="text-slate-300 transition-colors hover:text-slate-600"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => {
              if (!activeChannel) return;
              setEditChannelState(activeChannel);
              setModalOpen(true);
            }}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 text-[10px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          >
            <UserPlus className="size-3.5" />
            添加成员
          </button>
        </div>
        <ScrollArea className="flex-1 px-4 pb-3">
          {activeAgents.length === 0 ? (
            <div className="px-2 py-3 text-xs text-slate-400">暂无</div>
          ) : activeAgents.map((agent) => (
            <div key={agent.id} className="mb-2.5 flex items-center gap-2">
              <AvatarTile src={agent.avatar} label={agent.name} className="size-8 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-slate-800">{agent.name}</span>
                <span className="block truncate text-[9px] text-slate-400">{agent.role ?? "专家"}</span>
              </span>
            </div>
          ))}
          {activeChannel?.kind === "meeting" && meetingParticipants.length > 0 && (
            <>
              <div className="mb-2 mt-4 border-t border-slate-100 pt-3">
                <p className="px-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  参会人 · {meetingParticipants.length}
                </p>
              </div>
              {meetingParticipants.map((p) => (
                <button
                  key={p.speakerId}
                  type="button"
                  onClick={() => meetingAssignSpeakerRef.current(p.speakerId, p.label)}
                  className="mb-2 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50"
                >
                  <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-500">
                    {p.label.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-slate-800">{p.label}</span>
                    <span className="block truncate text-[9px] text-slate-400">{p.messageCount} 条发言</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </ScrollArea>
      </aside>
      )}

      {/* Channel modal */}
      <ChannelModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditChannelState(null);
        }}
        initial={editChannelState}
        existingDefs={agents}
        availableTeams={workbenchTeamPresets}
        onSave={(name, selectedCatalogIds, avatar, kind, tags, teamId) => {
          void handleChannelSave(name, selectedCatalogIds, avatar, kind, tags, teamId);
        }}
      />
      {(() => {
        const activeProvider = getActiveProvider();
        return (
          <HealthImportReviewDialog
            open={healthImportOpen}
            onClose={() => setHealthImportOpen(false)}
            onSuccess={() => setAttachedImages([])}
            images={attachedImages}
            providerId={activeProvider?.providerId ?? ""}
            modelId={activeProvider?.model ?? ""}
          />
        );
      })()}
    </div>
  );
}
