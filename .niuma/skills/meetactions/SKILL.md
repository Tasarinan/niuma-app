---
id: "meetactions"
name: "meeting-action-items"
description: "基于会议模式中的实时转写，提取 action items、负责人、时间点和下一步。适合会后整理。"
icon: "💬"
category: "会议辅助"
command: "meetactions"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"focus\",\"description\":\"可选：希望重点关注的问题、对象或主题\",\"required\":false,\"type\":\"text\",\"defaultValue\":\"无特别关注点\"}]"
createdAt: "2026-05-28T07:45:09.135Z"
updatedAt: "2026-05-28T07:45:09.135Z"
---

# meeting-action-items

## Instructions

请基于当前 Meeting Context，提取行动项和下一步。

关注点：{{focus}}

要求：
1. 用表格列出 action item、负责人、截止时间、状态。
2. 只提取上下文中有依据的信息。
3. 信息缺失时写“待确认”。
4. 最后给一个简短会后总结。

## Output Format

| 行动项 | 负责人 | 截止时间 | 状态 |
| --- | --- | --- | --- |

### 会后总结
