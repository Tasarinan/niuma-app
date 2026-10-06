---
id: "gt-exercise-create"
name: "gpt-tutor-exercise-create"
description: "GPT-Tutor 题目创建功能。根据语法点或学习内容设计练习题。"
icon: "❔"
category: "GPT-Tutor 语法学习"
command: "gt-exercise-create"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.373Z"
updatedAt: "2026-06-04T04:41:04.373Z"
---

# gpt-tutor-exercise-create

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请作为基础语法专家，根据 {{text}} 设计互动练习题。

请包含填空、改错、选择、句子重组等题型，并在最后给出答案和解析。

## Output Format

markdown
