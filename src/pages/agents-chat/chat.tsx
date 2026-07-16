/**
 * Workstation › Chat
 *
 * Design reference: DeDeClaw ChatPage.
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
 *   Left   (280px)  – Conversation list with 3D cartoon icon avatars
 *   Center (flex-1) – Message stream
 *   Right  (220px, optional) – Members panel
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverAnchor,
  PopoverContent,
  ScrollArea,
  Textarea,
} from "@/components/ui";
import { Markdown } from "@/components";
import { useAgents, useGroupChat } from "@/hooks";
import type { AgentInput } from "@/hooks";
import { MeetingChannelView } from "./components/meeting";
import { loadAgentCatalog, type CatalogAgent } from "@/lib/data/agent-loader";
import { fetchClawpackSkillCatalog, type ClawpackSkill } from "@/lib/data";
import { loadDisabledSkillSlugs, loadHiredAgentFiles } from "@/lib/storage";
import type { AgentDefinition, AgentInternalToolId, GroupChannel, GroupMessage, SandboxMode } from "@/types";
import type { ImageContent } from "@earendil-works/pi-ai";
import { MAX_FILES } from "@/config";
import {
  Download,
  Edit2,
  Hash,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Send,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";

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

function isIconUrl(s: string) {
  return (
    s.startsWith("/") ||
    s.startsWith("http") ||
    s.startsWith("data:") ||
    s.includes("assets/")
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

// ─── Shared sub-components ────────────────────────────────────────────────────

function Av({
  src,
  name,
  size = "md",
}: {
  src?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const dims = { xs: "size-5", sm: "size-7", md: "size-9", lg: "size-11" }[size];
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100",
        dims
      )}
    >
      {src ? (
        <img src={src} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-semibold leading-none text-slate-500">
          {name?.[0]?.toUpperCase() ?? "?"}
        </span>
      )}
    </div>
  );
}

function ChannelAv({
  channel,
  size = "md",
}: {
  channel: GroupChannel;
  size?: "sm" | "md" | "lg";
}) {
  const dims = { sm: "size-9", md: "size-11", lg: "size-14" }[size];
  if (channel.avatar && isIconUrl(channel.avatar)) {
    return (
      <div className={cn("flex-shrink-0 overflow-hidden rounded-2xl shadow-sm", dims)}>
        <img src={channel.avatar} alt={channel.name} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-2xl shadow-sm",
        dims
      )}
    >
      {channel.avatar ?? "#"}
    </div>
  );
}

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
 * onSave receives the selected CatalogAgent file names so the caller can bridge
 * to AgentDefinition IDs.
 */
function ChannelModal({
  open,
  onClose,
  initial,
  existingDefs,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** Channel being edited, or null for create. */
  initial?: GroupChannel | null;
  /** Current AgentDefinition list, used to reverse-map agentIds → catalog agents. */
  existingDefs: AgentDefinition[];
  /** Receives (name, selectedCatalogFiles, avatar, kind). */
  onSave: (name: string, selectedFiles: string[], avatar: string, kind: "chat" | "meeting") => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(CHANNEL_ICONS[0] ?? "");
  const [kind, setKind] = useState<"chat" | "meeting">("chat");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [hiredCatalog, setHiredCatalog] = useState<CatalogAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation("pages");
  const { t: tCommon } = useTranslation("common");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setAvatar(
      initial?.avatar && isIconUrl(initial.avatar)
        ? initial.avatar
        : (CHANNEL_ICONS[0] ?? "")
    );
    setKind(initial?.kind ?? "chat");
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
            const def = existingDefs.find((d) => d.id === agentId);
            if (def) {
              const match = hired.find(
                (ca) => ca.name.trim().toLowerCase() === def.name.trim().toLowerCase()
              );
              if (match) preSelected.push(match.file);
            }
          }
          setSelectedFiles(preSelected);
        } else {
          setSelectedFiles([]);
        }
      })
      .finally(() => setLoading(false));
  }, [open, initial, existingDefs]);

  const toggleFile = (file: string) =>
    setSelectedFiles((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]
    );

  const isImg = (av?: string) =>
    !!av && (av.startsWith("/") || av.startsWith("http") || av.startsWith("data:"));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            {initial ? t("chatPage.editChannel") : t("chatPage.createChannel")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
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
                  "flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                  kind === "chat"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {t("chatPage.channelTypeChat")}
              </button>
              <button
                type="button"
                onClick={() => setKind("meeting")}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                  kind === "meeting"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {t("chatPage.channelTypeMeeting")}
              </button>
            </div>
          </div>

          {/* Icon picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">{t("chatPage.channelIcon")}</Label>
            <ScrollArea className="h-36 rounded-2xl border border-slate-100 bg-slate-50/60 p-2">
              <div className="grid grid-cols-6 gap-2">
                {CHANNEL_ICONS.map((ic, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(ic)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-xl border-2 transition-all hover:scale-105",
                      avatar === ic
                        ? "border-indigo-500 shadow-md shadow-indigo-200"
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
              {selectedFiles.length > 0 && (
                <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                  {selectedFiles.length}
                </span>
              )}
            </Label>

            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/60 py-6">
                <Loader2 className="size-4 animate-spin text-slate-400" />
                <span className="ml-2 text-xs text-slate-400">{t("chatPage.loadingAgents")}</span>
              </div>
            ) : hiredCatalog.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-5 text-center">
                <p className="text-xs text-slate-400">
                  {t("chatPage.noHiredAgents")}
                  <span className="font-semibold text-indigo-500">{t("chatPage.noHiredAgentsLink")}</span>
                  {t("chatPage.noHiredAgentsSuffix")}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-52 rounded-2xl border border-slate-100 bg-slate-50/60">
                {hiredCatalog.map((a) => {
                  const selected = selectedFiles.includes(a.file);
                  return (
                    <button
                      key={a.file}
                      type="button"
                      onClick={() => toggleFile(a.file)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-xs transition-colors hover:bg-white",
                        selected ? "bg-indigo-50/60" : ""
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
                        <span className="flex size-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white">
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

        <div className="mt-1 flex items-center justify-between border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            {tCommon("actions.cancel")}
          </button>
          <Button
            size="sm"
            className="rounded-full px-5"
            onClick={() => {
              onSave(name, selectedFiles, avatar, kind);
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
  onExternalActivate,
}: {
  /** Called when an external source (e.g. the main toolbar) routes a message
   *  into this page, so the parent can bring the "chat" section into view. */
  onExternalActivate?: () => void;
} = {}) {
  const { agents, create: createAgent } = useAgents();
  const {
    channels,
    messages,
    selectedId,
    selectChannel,
    createChannel,
    editChannel: hookEditChannel,
    removeChannel,
    sendMessage,
    isSending,
    stopGeneration,
  } = useGroupChat();

  const [input, setInput] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editChannelState, setEditChannelState] = useState<GroupChannel | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("pages");

  const activeChannel = channels.find((c) => c.id === selectedId) ?? null;
  const activeMessages: GroupMessage[] = messages;
  const agentMap = useMemo(
    () => Object.fromEntries(agents.map((a) => [a.id, a])),
    [agents]
  );

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages]);

  // ─── "/" skill picker (compose box) ────────────────────────────────────────
  // Lists every installed clawpack skill (from the Skills page's catalog,
  // minus anything the user disabled there) so it can be referenced by typing
  // "/" followed by a few characters.
  const [installedSkills, setInstalledSkills] = useState<ClawpackSkill[]>([]);
  const [skillMenu, setSkillMenu] = useState<{ query: string; start: number } | null>(null);
  const [skillMenuIndex, setSkillMenuIndex] = useState(0);

  useEffect(() => {
    fetchClawpackSkillCatalog()
      .then(setInstalledSkills)
      .catch(() => setInstalledSkills([]));
  }, []);

  const enabledInstalledSkills = useMemo(() => {
    const disabled = loadDisabledSkillSlugs();
    return installedSkills.filter((s) => s.enabled !== false && !disabled.has(s.slug));
  }, [installedSkills]);

  const filteredSkillMenu = useMemo(() => {
    if (!skillMenu) return [];
    const q = skillMenu.query.toLowerCase();
    return enabledInstalledSkills
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          (s.command || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [skillMenu, enabledInstalledSkills]);

  const SKILL_TRIGGER_RE = /(^|\s)\/([a-zA-Z0-9_-]*)$/;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    const cursor = e.target.selectionStart ?? value.length;
    const match = SKILL_TRIGGER_RE.exec(value.slice(0, cursor));
    setSkillMenu(match ? { query: match[2], start: match.index + match[1].length } : null);
    setSkillMenuIndex(0);
  };

  const selectSkillMenuItem = (skill: ClawpackSkill) => {
    if (!skillMenu) return;
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, skillMenu.start);
    const after = input.slice(cursor);
    const inserted = `/${skill.command || skill.slug} `;
    setInput(`${before}${inserted}${after}`);
    setSkillMenu(null);
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    });
  };

  const send = async () => {
    if ((!input.trim() && attachedImages.length === 0) || !selectedId || isSending) return;
    const text = input.trim();
    const images: ImageContent[] | undefined = attachedImages.length
      ? attachedImages.map((f) => ({ type: "image" as const, data: f.data, mimeType: f.mimeType }))
      : undefined;
    setInput("");
    setAttachedImages([]);
    setSkillMenu(null);
    await sendMessage(text, images);
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
   * Bridge: convert selected CatalogAgent file names → AgentDefinition IDs.
   * Creates AgentDefinitions on-the-fly for any hired agent not yet in the repo.
   */
  const handleChannelSave = useCallback(
    async (name: string, selectedFiles: string[], avatar: string, kind: "chat" | "meeting") => {
      // Load hired catalog to get full CatalogAgent objects
      const hiredSet = loadHiredAgentFiles();
      const all = await loadAgentCatalog();
      const hired = all.filter((a) => hiredSet.has(a.file));

      const agentIds: string[] = [];
      for (const file of selectedFiles) {
        const ca = hired.find((a) => a.file === file);
        if (!ca) continue;
        const id = await bridgeCatalogAgent(ca, agents, createAgent);
        agentIds.push(id);
      }

      if (editChannelState) {
        hookEditChannel(editChannelState.id, { name, agentIds, avatar, kind });
      } else {
        createChannel(name, agentIds, avatar || randomIcon(), kind);
      }
    },
    [agents, editChannelState, hookEditChannel, createChannel, createAgent]
  );

  /**
   * Finds (or lazily creates) the single-agent "main chat" channel used by the
   * main toolbar's "Ask me anything" input, and sends `text` into it.
   * Default agent = the built-in "Assistant" (assistant.json), falling back
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
        const defaultAgent = all.find((a) => a.file === "assistant.json");
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
    <div className="flex h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.06),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      {/* ── Left: conversation list ─────────────────────────────────────── */}
      <aside className="flex w-[187px] flex-shrink-0 flex-col border-r border-slate-100 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {t("chatPage.channels")}
            </p>
            <p className="text-base font-bold text-slate-900">
              {channels.length > 0 ? t("chatPage.channelCount", { count: channels.length }) : t("chatPage.none")}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            title={t("chatPage.newChannel")}
            className="flex size-8 items-center justify-center rounded-full bg-indigo-600 text-white shadow hover:bg-indigo-500 transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <ScrollArea className="flex-1 px-3 pb-4">
          {channels.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
              <MessageSquarePlus className="size-10 opacity-25" />
              <p className="text-xs">{t("chatPage.noChannels")}</p>
            </div>
          ) : (
            channels.map((ch) => {
              const isActive = selectedId === ch.id;
              return (
                <div
                  key={ch.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectChannel(ch.id)}
                  onKeyDown={(e) => e.key === "Enter" && selectChannel(ch.id)}
                  className={cn(
                    "group relative mb-1 flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all",
                    isActive
                      ? "bg-indigo-600 shadow-md shadow-indigo-200/60"
                      : "hover:bg-slate-100"
                  )}
                >
                  <div
                    className={cn(
                      "size-10 flex-shrink-0 overflow-hidden rounded-xl border",
                      isActive ? "border-white/30" : "border-slate-100"
                    )}
                  >
                    {ch.avatar && isIconUrl(ch.avatar) ? (
                      <img src={ch.avatar} alt={ch.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 text-xl">
                        {ch.avatar ?? "#"}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold truncate",
                        isActive ? "text-white" : "text-slate-800"
                      )}
                    >
                      {ch.name}
                    </p>
                    <p
                      className={cn(
                        "text-[11px] truncate",
                        isActive ? "text-indigo-200" : "text-slate-400"
                      )}
                    >
                      {t("chatPage.memberCount", { count: ch.agentIds.length })}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "flex gap-0.5 transition-opacity",
                      "opacity-0 group-hover:opacity-100",
                      isActive && "opacity-100"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditChannelState(ch);
                        setModalOpen(true);
                      }}
                      className={cn(
                        "rounded-lg p-1 transition-colors",
                        isActive
                          ? "text-indigo-200 hover:bg-white/20 hover:text-white"
                          : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      )}
                    >
                      <Edit2 className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeChannel(ch.id);
                      }}
                      className={cn(
                        "rounded-lg p-1 transition-colors",
                        isActive
                          ? "text-indigo-200 hover:bg-white/20 hover:text-red-300"
                          : "text-slate-400 hover:bg-slate-200 hover:text-red-500"
                      )}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </aside>

      {/* ── Main: chat area ─────────────────────────────────────────────── */}
      {!activeChannel ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
          <div className="flex size-24 items-center justify-center rounded-3xl bg-white shadow-lg shadow-slate-200">
            <Hash className="size-10 opacity-30" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-600">{t("chatPage.selectChannel")}</p>
            <p className="mt-1 text-xs text-slate-400">
              {t("chatPage.orCreateChannel")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 rounded-full"
            onClick={openCreate}
          >
            <Plus className="mr-1.5 size-3.5" />
            {t("chatPage.newChannel")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Chat header */}
          <div className="flex flex-shrink-0 items-center gap-4 border-b border-slate-100 bg-white/80 px-5 py-3 backdrop-blur">
            <ChannelAv channel={activeChannel} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">{activeChannel.name}</p>
              <p className="text-[11px] text-slate-400">
                {t("chatPage.memberCount", { count: activeChannel.agentIds.length })}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExport}
                title={t("chatPage.exportMarkdown")}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                <Download className="size-3.5" />
                {t("chatPage.export")}
              </button>
              <button
                type="button"
                onClick={() => setShowMembers((v) => !v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border transition-colors",
                  showMembers
                    ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                )}
              >
                <Users className="size-4" />
              </button>
            </div>
          </div>

          {activeChannel.kind === "meeting" ? (
            <MeetingChannelView key={activeChannel.id} channel={activeChannel} />
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <div
                  ref={scrollRef}
                  className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
                >
                  {activeMessages.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-20 text-slate-400">
                      <ChannelAv channel={activeChannel} size="lg" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-600">
                          {activeChannel.name}
                        </p>
                        <p className="mt-1 text-xs">
                          {t("chatPage.startMessaging")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const agent = msg.agentId ? agentMap[msg.agentId] : undefined;
                      const isUser = msg.role === "user";
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex gap-3",
                            isUser ? "flex-row-reverse" : "flex-row"
                          )}
                        >
                          {!isUser && (
                            <Av
                              src={agent?.avatar ?? msg.agentAvatar}
                              name={msg.agentName}
                              size="sm"
                            />
                          )}
                          <div
                            className={cn(
                              "flex max-w-[68%] flex-col gap-1",
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
                                "rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm",
                                isUser
                                  ? "bg-indigo-600 text-white rounded-tr-sm"
                                  : "bg-white text-slate-800 rounded-tl-sm ring-1 ring-slate-100"
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

                {/* Input */}
                <div className="flex-shrink-0 border-t border-slate-100 bg-white/80 px-5 py-4 backdrop-blur">
                  {attachedImages.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
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
                  <Popover
                    open={!!skillMenu && filteredSkillMenu.length > 0}
                    onOpenChange={(open) => {
                      if (!open) setSkillMenu(null);
                    }}
                  >
                    <PopoverAnchor asChild>
                      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
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
                          className="relative flex size-8 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Paperclip className="size-3.5" />
                          {attachedImages.length > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-semibold text-white">
                              {attachedImages.length}
                            </span>
                          )}
                        </button>
                        <Textarea
                          ref={textareaRef}
                          value={input}
                          onChange={handleInputChange}
                          onKeyDown={(e) => {
                            if (skillMenu && filteredSkillMenu.length > 0) {
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setSkillMenuIndex((i) => (i + 1) % filteredSkillMenu.length);
                                return;
                              }
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setSkillMenuIndex(
                                  (i) => (i - 1 + filteredSkillMenu.length) % filteredSkillMenu.length
                                );
                                return;
                              }
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                selectSkillMenuItem(filteredSkillMenu[skillMenuIndex]);
                                return;
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setSkillMenu(null);
                                return;
                              }
                            }
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void send();
                            }
                          }}
                          placeholder={t("chatPage.inputPlaceholder", { name: activeChannel.name })}
                          rows={1}
                          className="min-h-[28px] max-h-40 flex-1 resize-none border-0 bg-transparent p-0 text-[15px] shadow-none focus-visible:ring-0"
                        />
                        {isSending ? (
                          <button
                            type="button"
                            onClick={() => stopGeneration()}
                            className="flex size-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-500 transition-colors hover:bg-red-200"
                          >
                            <Square className="size-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void send()}
                            disabled={!input.trim() && attachedImages.length === 0}
                            className="flex size-8 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow transition-all hover:bg-indigo-500 disabled:opacity-40 disabled:shadow-none"
                          >
                            <Send className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </PopoverAnchor>
                    <PopoverContent
                      side="top"
                      align="start"
                      sideOffset={8}
                      className="w-72 p-1"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        {t("chatPage.skillMenuTitle")}
                      </p>
                      <div className="max-h-56 space-y-0.5 overflow-y-auto">
                        {filteredSkillMenu.map((skill, idx) => (
                          <button
                            key={skill.slug}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectSkillMenuItem(skill);
                            }}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors",
                              idx === skillMenuIndex ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-100"
                            )}
                          >
                            <span className="text-sm leading-none">{skill.icon || "⚡"}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-slate-800">
                                /{skill.command || skill.slug}
                              </span>
                              <span className="block truncate text-[11px] text-slate-400">
                                {skill.description}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="mt-2 text-center text-[10px] text-slate-400">
                    {t("chatPage.inputHint")}
                  </p>
                </div>
              </div>

              {/* Members panel */}
              {showMembers && (
                <aside className="flex w-56 flex-shrink-0 flex-col border-l border-slate-100 bg-white/80 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-xs font-semibold text-slate-500">
                      {t("chatPage.members", { count: activeChannel.agentIds.length })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMembers(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <ScrollArea className="flex-1 px-3 py-3">
                    {activeChannel.agentIds.map((id) => {
                      const a = agentMap[id];
                      if (!a) return null;
                      return (
                        <div
                          key={id}
                          className="mb-1 flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50"
                        >
                          <Av src={a.avatar} name={a.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-700">
                              {a.name}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">
                              {a.role ?? ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </ScrollArea>
                </aside>
              )}
            </div>
          )}
        </div>
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
        onSave={(name, selectedFiles, avatar, kind) => {
          void handleChannelSave(name, selectedFiles, avatar, kind);
        }}
      />
    </div>
  );
}
