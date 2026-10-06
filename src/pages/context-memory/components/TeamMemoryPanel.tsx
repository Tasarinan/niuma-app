/**
 * TeamMemoryPanel — Browse and manage file-based PI memory for each team.
 *
 * Shows:
 *  - A team selector (all known team presets)
 *  - MEMORY.md index for the selected team
 *  - List of topic files with content preview
 *  - Quick "Add entry" form
 *  - "Clear team memory" button
 */
import { useState, useEffect, useCallback } from "react";
import { loadWorkbenchTeamPresets, type WorkbenchTeamPreset } from "@/lib/agent/workbench-defaults";
import {
  readMemoryIndex,
  listTopicFiles,
  readTopicFile,
  addMemoryEntry,
  deleteAllTeamMemory,
} from "@/lib/agent/memory/file-memory";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Trash2, Plus, ChevronDown, ChevronRight, Brain } from "lucide-react";

export function TeamMemoryPanel() {
  const [teams, setTeams] = useState<WorkbenchTeamPreset[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  useEffect(() => {
    void loadWorkbenchTeamPresets().then((presets) => {
      setTeams(presets);
      setSelectedTeam((current) => current || presets[0]?.id || "");
    });
  }, []);
  const [memoryIndex, setMemoryIndex] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicContent, setTopicContent] = useState<Record<string, string>>({});
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTopic, setAddTopic] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async (teamId: string) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [idx, tList] = await Promise.all([
        readMemoryIndex(teamId),
        listTopicFiles(teamId),
      ]);
      setMemoryIndex(idx);
      setTopics(tList);
      setTopicContent({});
      setExpandedTopics(new Set());
    } catch (e) {
      console.error("Failed to load team memory:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(selectedTeam); }, [selectedTeam, load]);

  const toggleTopic = async (topic: string) => {
    const next = new Set(expandedTopics);
    if (next.has(topic)) {
      next.delete(topic);
    } else {
      next.add(topic);
      if (!topicContent[topic]) {
        const content = await readTopicFile(selectedTeam, topic).catch(() => "");
        setTopicContent((prev) => ({ ...prev, [topic]: content }));
      }
    }
    setExpandedTopics(next);
  };

  const handleClear = async () => {
    if (!window.confirm(`清除团队「${selectedTeam}」的全部记忆？`)) return;
    setIsClearing(true);
    try {
      await deleteAllTeamMemory(selectedTeam);
      await load(selectedTeam);
    } finally {
      setIsClearing(false);
    }
  };

  const handleAdd = async () => {
    if (!addTopic.trim() || !addTitle.trim() || !addContent.trim()) return;
    setIsSaving(true);
    try {
      await addMemoryEntry(selectedTeam, {
        topic: addTopic.trim(),
        title: addTitle.trim(),
        content: addContent.trim(),
      });
      setAddTopic("");
      setAddTitle("");
      setAddContent("");
      setShowAddForm(false);
      await load(selectedTeam);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <span className="text-sm font-semibold">团队记忆 (PI Memory)</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load(selectedTeam)}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            刷新
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="size-3" />
            添加记忆
          </button>
        </div>
      </div>

      {/* Team selector */}
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTeam(t.id)}
            className={[
              "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
              selectedTeam === t.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-muted-foreground/40",
            ].join(" ")}
          >
            <span>{t.avatar}</span>
            {t.name}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">添加记忆条目</p>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="主题 (e.g. preferences)"
            value={addTopic}
            onChange={(e) => setAddTopic(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="标题 (e.g. 用户偏好中文回复)"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
          />
          <textarea
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="内容..."
            value={addContent}
            onChange={(e) => setAddContent(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void handleAdd()} disabled={isSaving || !addTopic || !addTitle || !addContent}>
              {isSaving ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Memory index */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 加载中...
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Brain className="size-8 opacity-20 mx-auto mb-2" />
          <p>团队「{selectedTeam}」暂无记忆</p>
          <p className="text-xs mt-1 opacity-70">智能体在对话中使用 <code>memory(add)</code> 工具会自动创建记忆</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* MEMORY.md index preview */}
          {memoryIndex && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">MEMORY.md 索引</p>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{memoryIndex.slice(0, 800)}</pre>
            </div>
          )}

          {/* Topic files */}
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1">主题文件 ({topics.length})</p>
          {topics.map((topic) => (
            <div key={topic} className="rounded-lg border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => void toggleTopic(topic)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40 transition-colors"
              >
                {expandedTopics.has(topic)
                  ? <ChevronDown className="size-3.5 text-muted-foreground" />
                  : <ChevronRight className="size-3.5 text-muted-foreground" />}
                <span className="font-mono">{topic}.md</span>
              </button>
              {expandedTopics.has(topic) && (
                <div className="border-t bg-muted/20 px-3 py-2">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {topicContent[topic] || "加载中..."}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {/* Clear */}
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-destructive hover:text-destructive"
              onClick={() => void handleClear()}
              disabled={isClearing}
            >
              {isClearing ? <Loader2 className="size-3 animate-spin mr-1" /> : <Trash2 className="size-3 mr-1" />}
              清除此团队记忆
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
