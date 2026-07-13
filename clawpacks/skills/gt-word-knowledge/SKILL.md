---
id: "gt-word-knowledge"
name: "gpt-tutor-word-knowledge"
description: "GPT-Tutor 单词相关知识点功能。围绕一个词扩展相关词汇、语法、搭配和注意事项。"
icon: "🧠"
category: "GPT-Tutor 单词学习"
command: "gt-word-knowledge"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.170Z"
updatedAt: "2026-06-04T04:41:04.170Z"
---

# gpt-tutor-word-knowledge

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

当我给出一个词时，请用中文解释这个词相关的词汇、语法规则、使用方法、注意事项、常见短语或搭配。

输入词：{{text}}

请尽量全面，类似给出“时间”时，应包含 time、timely、timeline、year、month、day，以及日期、时刻、时间段等表达方式。

## Output Format

markdown
