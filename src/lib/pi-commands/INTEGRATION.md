# PI Slash Commands 集成指南

## 概述

PI Framework 支持完整的 slash command 系统，niuma-app 现在已支持以下集成：

### 支持的命令类型

1. **PI 内置命令** （7 个）
   - `/model <id>` — 切换 AI 模型
   - `/settings` — 打开设置面板
   - `/session` — 显示当前对话信息
   - `/trust` — 信任当前项目
   - `/reload` — 重新加载技能/模板/扩展
   - `/login` / `/logout` — 管理凭证

2. **Skill 命令** （动态）
   - `/skill:writing` — 加载"writing"技能
   - `/skill:web-search` — 加载"web-search"技能
   - 所有已启用的 Skill 自动注册

3. **Template 命令** （动态）
   - `/refactor-code` — 插入"refactor-code"模板
   - `/summary` — 插入"summary"模板
   - 从项目中自动发现

4. **自定义命令** （静态）
   - `.niuma/commands/*.md` 中的命令
   - 与现有 slash-commands 系统兼容

## 集成步骤

### 1. 在 Toolbar 或 Chat 输入组件中注册

```tsx
// src/pages/agents-chat/chat.tsx 或 src/pages/app/index.tsx

import { usePiSlashCommands } from "@/lib/pi-commands";
import { useSkillStore } from "@/store";

export default function ChatComponent() {
  const skills = useSkillStore((s) => s.items);
  const [templates] = useState<PromptTemplate[]>(/* 从存储加载 */);

  const commands = usePiSlashCommands(skills, templates, {
    switchModel: async (modelId) => {
      // 路由到现有的模型切换逻辑
      await switchAIProvider(modelId);
    },
    openSettings: () => {
      // 打开设置面板
      navigate("/settings");
    },
    showSession: () => {
      // 显示对话信息（可选 modal）
      console.log("Session info:", getCurrentSession());
    },
    trustProject: async () => {
      // 保存项目信任决策
      await saveProjectTrust(getCurrentProject());
    },
    reload: () => {
      // 重新加载所有资源
      window.location.reload();
    },
    onSkillSelected: (skillName) => {
      // 当选择 skill 时，插入相应的 tool 调用
      console.log("Skill selected:", skillName);
    },
    onTemplateSelected: (content) => {
      // 当选择 template 时，插入到输入框
      setInput((prev) => prev + "\n\n" + content);
    },
  });

  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<CommandHandler[]>([]);

  // 处理输入变化，显示 / 建议
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    // 如果输入以 / 开头，显示建议
    if (val.endsWith("/")) {
      setSuggestions(commands.getSuggestions(""));
    } else if (val.match(/\/\w*$/)) {
      const match = val.match(/\/(\w*)$/);
      if (match) {
        setSuggestions(commands.getSuggestions(match[1]));
      }
    }
  };

  // 处理命令执行
  const handleExecuteCommand = async (cmd: CommandHandler) => {
    const parsed = commands.parse(`/${cmd.name}`);
    if (parsed) {
      await commands.execute(parsed);
      // 清空建议
      setSuggestions([]);
    }
  };

  return (
    <div className="relative">
      <textarea
        value={input}
        onChange={handleInputChange}
        placeholder="Type / for commands..."
      />
      
      {/* 命令建议菜单 */}
      <CommandSuggestionList
        commands={suggestions}
        onSelect={handleExecuteCommand}
      />
    </div>
  );
}
```

### 2. 与现有 Agent Runtime 集成

```tsx
// src/hooks/useCompletion.ts 中添加

import { usePiSlashCommands, type ParsedCommand } from "@/lib/pi-commands";

export const useCompletion = () => {
  // ... 现有逻辑

  const commands = usePiSlashCommands(allSkills, templates, {
    switchModel: async (modelId) => {
      // 更新当前模型
      setActiveProvider({ ...activeProvider, model: modelId });
    },
    onSkillSelected: (skillName) => {
      // 自动在 enabledSkillIds 中添加
      const updated = [...enabledSkillIds, skillName];
      setEnabledSkillIds(updated);
    },
  });

  // 在 sendMessage 中拦截 slash commands
  const processInput = async (input: string) => {
    const cmd = commands.parse(input);
    if (cmd) {
      // 这是一个 slash command
      await commands.execute(cmd);
      return; // 不发送给 agent
    }
    // 否则作为普通消息发送
    await sendToAgent(input);
  };

  return { ...existing, commands, processInput };
};
```

### 3. 为 Toolbar 的"Ask me anything"添加 slash 支持

```tsx
// src/components/toolbar/Toolbar.tsx

import { usePiSlashCommands } from "@/lib/pi-commands";

export function Toolbar({ completion, tts, isHidden }: ToolbarProps) {
  const { commands, processInput } = completion; // 假设已从 useCompletion 获得

  const handleSend = async (text: string) => {
    // 先检查是否为 slash command
    const cmd = commands?.parse(text);
    if (cmd) {
      await commands?.execute(cmd);
    } else {
      // 普通消息
      await processInput?.(text);
    }
  };

  return (
    // 现有 Toolbar 代码...
  );
}
```

## 架构细节

### 命令流程图

```
User Input: "/"
    ↓
[Input Change Handler]
    ↓
[usePiSlashCommands.getSuggestions()]
    ↓
[Registry Lookup] → CommandSuggestionList UI
    ↓
User Selects: "/skill:writing"
    ↓
[CommandSuggestionList.onSelect()]
    ↓
[usePiSlashCommands.execute()]
    ↓
[CommandHandler.execute()]
    ↓
[onSkillSelected Callback] → Update Agent enabledSkillIds
    ↓
Agent Runtime reloads with new skill
```

### SlashCommandRegistry 数据结构

```typescript
Map<string, CommandHandler> {
  "model" → {
    name: "model",
    category: "builtin",
    description: "Switch AI model",
    args: [{ name: "model", required: true, ... }],
    execute: async (args) => { ... }
  },
  
  "skill:writing" → {
    name: "writing",
    category: "skill",
    description: "AI writing assistant",
    execute: async () => { ... }
  },
  
  "refactor-code" → {
    name: "refactor-code",
    category: "template",
    description: "Insert code refactoring template",
    execute: async () => { ... }
  },
  
  "sync-db" → {
    name: "sync-db",
    category: "custom",
    description: "Sync database from custom command",
    execute: async () => { ... }
  }
}
```

## 高级功能

### 1. 参数解析

```typescript
const cmd = commands.parse("/model openai/gpt-4o");
// Result: { name: "model", args: { value: "openai/gpt-4o" }, raw: "..." }

const cmd2 = commands.parse("/skill:writing max-length=200");
// Result: { name: "skill:writing", args: { "max-length": "200" }, raw: "..." }
```

### 2. 动态命令注册（用于扩展）

```typescript
// 在扩展或插件中
registry.register("my-custom-cmd", {
  name: "my-custom-cmd",
  category: "extension",
  description: "My custom command",
  execute: async (args) => {
    console.log("Custom command executed with args:", args);
  },
});
```

### 3. 命令分类列表

```typescript
const builtinCmds = commands.registry.listByCategory("builtin");
const skillCmds = commands.registry.listByCategory("skill");
const templateCmds = commands.registry.listByCategory("template");
```

## 与现有系统的兼容性

✅ **完全兼容**：
- 新 PI commands 与现有 `.niuma/commands/*.md` 共存
- 可以逐步迁移（旧命令不删除）
- 现有的 Agent Runtime 无需改动（commands 是上层 UI 特性）
- Skill 和 Template 系统无需改动（只是添加了命令快捷方式）

## 测试清单

- [ ] `/model` 切换模型
- [ ] `/settings` 打开设置
- [ ] `/skill:writing` 加载技能
- [ ] `/reload` 重新加载资源
- [ ] Fuzzy 搜索建议（输入 `/mod` 显示 `/model`）
- [ ] 参数传递（`/model claude-opus`）
- [ ] 错误处理（输入未知命令）
- [ ] 与现有 slash-commands 共存

## API 参考

### `usePiSlashCommands(skills, templates, callbacks)`

**返回**：`UsePiSlashCommandsResult`
- `registry` — 完整的命令注册表
- `suggestions` — 当前建议列表
- `parse(input)` — 解析输入字符串
- `execute(cmd)` — 执行命令
- `getSuggestions(prefix)` — 获取以 prefix 开头的命令列表
- `refreshSkillsAndTemplates(skills, templates)` — 刷新动态命令

### `CommandHandler` 接口

```typescript
interface CommandHandler {
  name: string;                                    // 命令名（不含 /）
  category: "builtin" | "skill" | "template" | "custom" | "extension";
  description: string;                            // UI 显示的描述
  args?: { name: string; description: string; required: boolean }[];
  execute: (args: Record<string, unknown>) => Promise<void> | void;
}
```

## 下一步

1. **集成到现有 Input 组件** — 在 `src/pages/agents-chat/chat.tsx` 中添加建议菜单
2. **添加键盘快捷键** — Tab 自动完成，Enter 执行
3. **持久化命令历史** — 保存用户最近使用的命令
4. **命令文档** — 在 UI 中显示帮助文本
