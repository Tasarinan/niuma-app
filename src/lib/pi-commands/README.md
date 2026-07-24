# PI Slash Commands 快速开始

## 核心概念

PI Framework 支持原生的 slash commands，niuma-app 现已集成该功能。命令分 5 类：

| 类型 | 示例 | 注册方式 | 说明 |
|------|------|---------|------|
| 内置 | `/model`, `/settings`, `/reload` | 硬编码 | PI 官方命令 |
| Skill | `/skill:writing`, `/skill:web-search` | 自动 | 所有已启用 Skill |
| Template | `/refactor-code`, `/summary` | 自动 | 项目 Prompt Templates |
| 自定义 | `.niuma/commands/*.md` | 自动 | 现有系统 |
| 扩展 | 用户插件注册 | 动态 | 扩展程序 |

## 3 分钟上手

### 1️⃣ 导入 Hook

```tsx
import { usePiSlashCommands } from "@/lib/pi-commands";
```

### 2️⃣ 初始化

```tsx
const commands = usePiSlashCommands(skills, templates, {
  switchModel: async (id) => { /* 实现 */ },
  openSettings: () => { /* 实现 */ },
});
```

### 3️⃣ 显示建议

```tsx
const suggestions = commands.getSuggestions("mod");  // 返回 ["/model"]
```

### 4️⃣ 执行命令

```tsx
const cmd = commands.parse("/model claude-opus");
await commands.execute(cmd);
```

## 一个完整的集成例子

```tsx
// src/pages/agents-chat/index.tsx

import { usePiSlashCommands } from "@/lib/pi-commands";
import { useSkillStore } from "@/store";

export function AgentChat() {
  const skills = useSkillStore(s => s.items);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  // 初始化 PI 命令系统
  const commands = usePiSlashCommands(skills, [], {
    switchModel: async (modelId) => {
      // 切换模型逻辑
      console.log("Switching to:", modelId);
    },
    openSettings: () => {
      // 打开设置
      window.location.hash = "#/settings";
    },
  });

  // 处理输入变化
  const handleChange = (e) => {
    const val = e.target.value;
    setInput(val);

    // 用户输入 / 时显示建议
    const match = val.match(/\/(\w*)$/);
    if (match) {
      setSuggestions(commands.getSuggestions(match[1]));
    } else {
      setSuggestions([]);
    }
  };

  // 处理发送
  const handleSend = async () => {
    const cmd = commands.parse(input);
    if (cmd) {
      // 是一个 slash command
      await commands.execute(cmd);
    } else {
      // 普通消息，发送给 agent
      await agentRuntime.sendMessage(input);
    }
    setInput("");
    setSuggestions([]);
  };

  return (
    <div>
      <div style={{ position: "relative" }}>
        <input
          value={input}
          onChange={handleChange}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Try typing: /model, /skill:, /settings..."
        />
        
        {/* 显示建议列表 */}
        {suggestions.length > 0 && (
          <ul style={{ position: "absolute", top: "-200px", width: "100%", background: "white", border: "1px solid #ccc", maxHeight: "200px", overflow: "auto" }}>
            {suggestions.map(s => (
              <li key={s.name} onClick={() => {
                commands.execute(commands.parse(`/${s.name}`));
                setInput("");
                setSuggestions([]);
              }}>
                /{s.name} — {s.description}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

## 文件结构

```
src/lib/pi-commands/
├── handler.ts                  # 核心：命令处理、注册表、解析
├── use-pi-commands.ts         # React Hook：UI 集成
├── quick-example.tsx          # 最小化示例组件
├── INTEGRATION.md             # 详细集成指南
└── index.ts                   # 导出入口
```

## API 速查

### `usePiSlashCommands(skills, templates, callbacks)`

**返回对象属性**：
- `registry` — 命令注册表（Map<name, handler>）
- `suggestions` — 当前建议列表
- `parse(input: string)` — 解析 "/" 命令 → `{ name, args, raw }`
- `execute(cmd)` — 执行已解析的命令
- `getSuggestions(prefix)` — 模糊搜索建议
- `refreshSkillsAndTemplates(skills, templates)` — 刷新动态命令

### `callbacks` 参数

```typescript
{
  switchModel?: (modelId: string) => Promise<void>;
  openSettings?: () => void;
  showSession?: () => void;
  trustProject?: () => Promise<void>;
  reload?: () => void;
  onSkillSelected?: (skillName: string) => void;
  onTemplateSelected?: (content: string) => void;
}
```

## 键盘快捷键建议

```typescript
// 在输入框的 onKeyDown 中
onKeyDown={(e) => {
  if (e.key === "Enter" && e.shiftKey) {
    // Shift+Enter: 发送
    handleSend();
  } else if (e.key === "Tab" && suggestions.length > 0) {
    // Tab: 自动完成第一个建议
    e.preventDefault();
    const cmd = commands.parse(`/${suggestions[0].name}`);
    if (cmd) await commands.execute(cmd);
  } else if (e.key === "ArrowUp" && suggestions.length > 0) {
    // 上下箭头: 浏览建议
    // ...导航逻辑
  }
}}
```

## 与现有系统的关系

```
┌─────────────────────────────────────┐
│   PI Slash Commands (新)             │
│   /model /skill:name /settings...   │
└────────────┬────────────────────────┘
             │ 集成到
             ↓
┌─────────────────────────────────────┐
│   Agent Runtime (现有)               │
│   createAgentRuntime + PI Framework │
└────────────┬────────────────────────┘
             │ 启用 tools
             ↓
┌─────────────────────────────────────┐
│   Skill + MCP + Internal Tools      │
│   (文件、bash、搜索、检查点等)       │
└─────────────────────────────────────┘
```

**关键点**：
- Slash commands 是 UI 层特性
- 不修改 Agent Runtime 核心
- 完全向后兼容
- 可与现有 `.niuma/commands/*.md` 共存

## 常见问题

**Q: Slash commands 是否会修改 Agent Runtime？**  
A: 不会。Commands 是纯 UI 层，Agent Runtime 无需改变。Commands 只是提供快捷方式。

**Q: 如何添加自定义命令？**  
A: 在 `.niuma/commands/*.md` 创建文件（现有系统），或通过 `registry.register()` 动态注册。

**Q: `/skill:name` 如何工作？**  
A: 当用户选择时，触发 `onSkillSelected` 回调，你的代码可以：
- 更新 Agent 的 `enabledSkillIds`
- 在提示中插入 skill name
- 或两者都做

**Q: 性能如何？**  
A: 完全客户端，零网络开销。命令解析和匹配都是 O(n) 的简单操作。

## 下一步

1. **选择集成位置** — 在 Chat、Toolbar 或其他输入点集成
2. **实现回调** — 连接到现有的模型切换、设置等逻辑
3. **测试** — 验证所有命令类型都能正常工作
4. **优化 UI** — 美化建议菜单、添加快捷键等

## 相关文档

- [完整集成指南](./INTEGRATION.md)
- [快速示例组件](./quick-example.tsx)
- [API 参考](./handler.ts)
- [使用示例](./use-pi-commands.ts)
