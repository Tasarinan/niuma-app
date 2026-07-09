import { useMemo, useState } from "react";
import { PageLayout } from "@/layouts";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  ScrollArea,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Badge,
} from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/contexts";
import { useAgents, useSkills, useMcpServers, useAgentRuntime } from "@/hooks";
import { AGENT_INTERNAL_TOOL_IDS } from "@/types";
import type {
  AgentDefinition,
  AgentInternalToolId,
  McpServer,
  McpTransport,
  SandboxMode,
  Skill,
} from "@/types";
import { Bot, Plus, Send, Trash2, Wrench, Puzzle, Server } from "lucide-react";

const SANDBOX_MODES: { value: SandboxMode; label: string }[] = [
  { value: "read-only", label: "只读 (read-only)" },
  { value: "workspace-write", label: "工作区可写 (workspace-write)" },
  { value: "danger-full-access", label: "完全访问 (danger-full-access)" },
];

function emptyAgent(providerId: string, modelId: string): Omit<
  AgentDefinition,
  "id" | "createdAt" | "updatedAt"
> {
  return {
    name: "新建 Agent",
    description: "",
    systemPrompt: "You are a helpful assistant.",
    providerId,
    modelId,
    enabledInternalTools: ["read", "ls", "grep"],
    enabledSkillIds: [],
    enabledMcpServerIds: [],
    sandboxMode: "workspace-write",
    temperature: 0.7,
    maxTokens: 4096,
    workspacePath: "",
  };
}

const Agents = () => {
  const { selectedAIProvider } = useApp();
  const agentsApi = useAgents();
  const skillsApi = useSkills();
  const mcpApi = useMcpServers();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAgent = useMemo(
    () => agentsApi.agents.find((a) => a.id === selectedId) ?? null,
    [agentsApi.agents, selectedId]
  );

  const handleCreate = async () => {
    const modelId = selectedAIProvider.variables.MODEL ?? "";
    const agent = await agentsApi.create(
      emptyAgent(selectedAIProvider.provider, modelId)
    );
    setSelectedId(agent.id);
  };

  return (
    <PageLayout
      title="Agents"
      description="基于 Pi 的多 Agent 运行时：配置系统提示词、工具、技能与 MCP 服务器，并直接使用已选择的 AI 提供商运行。"
    >
      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents">
            <Bot className="mr-1 size-4" /> Agents
          </TabsTrigger>
          <TabsTrigger value="skills">
            <Puzzle className="mr-1 size-4" /> Skills
          </TabsTrigger>
          <TabsTrigger value="mcp">
            <Server className="mr-1 size-4" /> MCP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            <AgentList
              agents={agentsApi.agents}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={handleCreate}
              onDelete={(id) => {
                agentsApi.remove(id);
                if (selectedId === id) setSelectedId(null);
              }}
            />
            {selectedAgent ? (
              <AgentEditor
                key={selectedAgent.id}
                agent={selectedAgent}
                skills={skillsApi.skills}
                servers={mcpApi.servers}
                onSave={(updates) => agentsApi.update(selectedAgent.id, updates)}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  选择或新建一个 Agent 以开始配置
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <SkillsPanel skillsApi={skillsApi} />
        </TabsContent>

        <TabsContent value="mcp" className="mt-4">
          <McpPanel mcpApi={mcpApi} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

function AgentList({
  agents,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
}: {
  agents: AgentDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Agents</CardTitle>
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {agents.length === 0 && (
          <p className="text-xs text-muted-foreground">还没有 Agent</p>
        )}
        {agents.map((a) => (
          <div
            key={a.id}
            className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer ${
              selectedId === a.id ? "bg-accent" : "hover:bg-accent/50"
            }`}
            onClick={() => onSelect(a.id)}
          >
            <span className="truncate">{a.name}</span>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(a.id);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AgentEditor({
  agent,
  skills,
  servers,
  onSave,
}: {
  agent: AgentDefinition;
  skills: Skill[];
  servers: McpServer[];
  onSave: (updates: Partial<AgentDefinition>) => void;
}) {
  const [draft, setDraft] = useState<AgentDefinition>(agent);

  const patch = (updates: Partial<AgentDefinition>) => {
    const next = { ...draft, ...updates };
    setDraft(next);
    onSave(updates);
  };

  const toggleTool = (id: AgentInternalToolId) => {
    const set = new Set(draft.enabledInternalTools);
    set.has(id) ? set.delete(id) : set.add(id);
    patch({ enabledInternalTools: Array.from(set) });
  };

  const toggleId = (
    key: "enabledSkillIds" | "enabledMcpServerIds",
    id: string
  ) => {
    const set = new Set(draft[key]);
    set.has(id) ? set.delete(id) : set.add(id);
    patch({ [key]: Array.from(set) } as Partial<AgentDefinition>);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">配置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>名称</Label>
              <Input
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>模型 ID</Label>
              <Input
                value={draft.modelId}
                placeholder="gpt-4o"
                onChange={(e) => patch({ modelId: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>描述</Label>
            <Input
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>系统提示词</Label>
            <Textarea
              rows={5}
              value={draft.systemPrompt}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>沙箱模式</Label>
              <Select
                value={draft.sandboxMode}
                onValueChange={(v) => patch({ sandboxMode: v as SandboxMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SANDBOX_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>最大 Tokens</Label>
              <Input
                type="number"
                value={draft.maxTokens}
                onChange={(e) =>
                  patch({ maxTokens: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>工作目录 (可选)</Label>
              <Input
                value={draft.workspacePath}
                placeholder="留空使用临时沙箱"
                onChange={(e) => patch({ workspacePath: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1">
              <Wrench className="size-4" /> 内置工具
            </Label>
            <div className="flex flex-wrap gap-2">
              {AGENT_INTERNAL_TOOL_IDS.map((id) => {
                const on = draft.enabledInternalTools.includes(id);
                return (
                  <Badge
                    key={id}
                    variant={on ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTool(id)}
                  >
                    {id}
                  </Badge>
                );
              })}
            </div>
          </div>

          {skills.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>技能</Label>
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => {
                  const on = draft.enabledSkillIds.includes(s.id);
                  return (
                    <Badge
                      key={s.id}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleId("enabledSkillIds", s.id)}
                    >
                      {s.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {servers.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>MCP 服务器</Label>
              <div className="flex flex-wrap gap-2">
                {servers.map((s) => {
                  const on = draft.enabledMcpServerIds.includes(s.id);
                  return (
                    <Badge
                      key={s.id}
                      variant={on ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleId("enabledMcpServerIds", s.id)}
                    >
                      {s.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AgentRunner agent={draft} />
    </div>
  );
}

function AgentRunner({ agent }: { agent: AgentDefinition }) {
  const { messages, isRunning, error, send, reset } = useAgentRuntime(agent);
  const [input, setInput] = useState("");

  const submit = () => {
    const text = input;
    setInput("");
    void send(text);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">运行</CardTitle>
        <Button size="sm" variant="ghost" onClick={reset}>
          清空
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ScrollArea className="h-64 rounded-md border p-3">
          <div className="flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground">
                发送一条消息开始与 Agent 对话
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {m.role === "user" ? "你" : agent.name}
                </span>
                {m.text && (
                  <p className="whitespace-pre-wrap text-sm">{m.text}</p>
                )}
                {m.tools?.map((t) => (
                  <div
                    key={t.toolCallId}
                    className="rounded border bg-muted/40 p-2 text-xs"
                  >
                    <div className="font-mono">
                      {t.done ? (t.isError ? "❌" : "✅") : "⏳"} {t.toolName}
                    </div>
                    {t.resultText && (
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                        {t.resultText}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Input
            value={input}
            placeholder="输入消息…"
            disabled={isRunning}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button onClick={submit} disabled={isRunning || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SkillsPanel({
  skillsApi,
}: {
  skillsApi: ReturnType<typeof useSkills>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  const add = () => {
    if (!name.trim()) return;
    skillsApi.create({
      name: name.trim(),
      description: description.trim(),
      enabled: true,
      tags: [],
      content,
    });
    setName("");
    setDescription("");
    setContent("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">新建技能</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>描述 (提供给模型选择技能)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>内容 (按需通过 load_skill 加载)</Label>
            <Textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <Button onClick={add}>
            <Plus className="mr-1 size-4" /> 添加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">已有技能</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {skillsApi.skills.length === 0 && (
            <p className="text-xs text-muted-foreground">还没有技能</p>
          )}
          {skillsApi.skills.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.description}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) =>
                    skillsApi.update(s.id, { enabled: v })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => skillsApi.remove(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function McpPanel({ mcpApi }: { mcpApi: ReturnType<typeof useMcpServers> }) {
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<McpTransport>("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!name.trim()) return;
    mcpApi.create({
      name: name.trim(),
      transport,
      command: transport === "stdio" ? command.trim() : undefined,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      url: transport === "stdio" ? undefined : url.trim(),
      env: {},
      enabled: true,
    });
    setName("");
    setCommand("");
    setArgs("");
    setUrl("");
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">新建 MCP 服务器</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>传输方式</Label>
            <Select
              value={transport}
              onValueChange={(v) => setTransport(v as McpTransport)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">stdio</SelectItem>
                <SelectItem value="http">http</SelectItem>
                <SelectItem value="sse">sse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {transport === "stdio" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>命令</Label>
                <Input
                  value={command}
                  placeholder="npx"
                  onChange={(e) => setCommand(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>参数 (空格分隔)</Label>
                <Input
                  value={args}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path"
                  onChange={(e) => setArgs(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>URL</Label>
              <Input
                value={url}
                placeholder="https://example.com/mcp"
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}
          <Button onClick={add}>
            <Plus className="mr-1 size-4" /> 添加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">已有服务器</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {mcpApi.servers.length === 0 && (
            <p className="text-xs text-muted-foreground">还没有 MCP 服务器</p>
          )}
          {mcpApi.servers.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.transport} · {s.command ?? s.url ?? ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(v) => mcpApi.update(s.id, { enabled: v })}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => mcpApi.remove(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default Agents;
