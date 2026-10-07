---
id: "gt-sentence-hub"
name: "gpt-tutor-sentence-hub"
description: "GPT-Tutor 句子综合分析功能。整合结构拆解、成分作用、语义解释和改写。"
icon: "🧩"
category: "GPT-Tutor 句子学习"
command: "gt-sentence-hub"
enabled: true
isPreset: false
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-03T13:26:40.9767643+08:00"
updatedAt: "2026-06-03T13:26:40.9767643+08:00"
---

# gpt-tutor-sentence-hub

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请把 {{text}} 作为待分析句子或片段，输出一句话精读报告。

请覆盖：
- 句子主干与层级结构。
- 关键片段在句中的语法角色与语义作用。
- 复杂句拆分为简单句并解释逻辑关系。
- 关键词在上下文中的具体含义。
- 2-3 个等义改写（口语/书面）。
- 若用户包含“json”字样，最后附一个简化结构化 JSON。

## Output Format

markdown
