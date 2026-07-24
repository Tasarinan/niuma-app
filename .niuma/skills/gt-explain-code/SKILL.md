---
id: "gt-explain-code"
name: "gpt-tutor-explain-code"
description: "GPT-Tutor 代码解释功能。解释选中的代码片段、API 用法或报错上下文。"
icon: "💻"
category: "GPT-Tutor 常用功能"
command: "gt-explain-code"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-03T05:29:20.841Z"
updatedAt: "2026-06-03T05:29:20.841Z"
---

# gpt-tutor-explain-code

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请作为耐心的编程老师，解释下面代码或技术片段。

内容：{{text}}

请包含：
- 这段代码整体做什么。
- 关键语句逐步解释。
- 输入、输出和副作用。
- 可能的错误点或边界情况。
- 如果适合，给出更清晰的改写建议。

## Output Format

markdown
