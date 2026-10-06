---
id: "gt-word-explain"
name: "gpt-tutor-word-explain"
description: "GPT-Tutor 单词解释功能。解释单词含义、不同语境和例句。"
icon: "🔎"
category: "GPT-Tutor 单词学习"
command: "gt-word-explain"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.160Z"
updatedAt: "2026-06-04T04:41:04.160Z"
---

# gpt-tutor-word-explain

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请作为经验丰富的英语词汇老师，面向中文母语初学者解释单词：{{text}}。

请说明：
- 核心含义和常见词性。
- 在不同语境、领域中的可能含义。
- 每个重要含义给出英文原句，并在括号中附中文翻译。
- 容易误解或误用的地方。

## Output Format

markdown
