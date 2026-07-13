---
id: "gt-vocab-hub"
name: "gpt-tutor-vocab-hub"
description: "GPT-Tutor 词汇综合功能。整合释义、搭配、近反义、词源、派生、发音和替换表达。"
icon: "🧠"
category: "GPT-Tutor 单词学习"
command: "gt-vocab-hub"
enabled: true
isPreset: false
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-03T13:26:40.9767643+08:00"
updatedAt: "2026-06-03T13:26:40.9767643+08:00"
---

# gpt-tutor-vocab-hub

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请把输入 {{text}} 当作“词汇学习主题”，输出一份整合词汇学习卡。

请覆盖：
- 核心释义与词性（常见语境）。
- 常见搭配（动词/名词/形容词/介词）。
- 近义词与反义词（含细微区别）。
- 派生词、复合词、词根词源（如适用）。
- 上下位词关系（如适用）。
- 发音要点与易错点。
- 可替换表达与使用限制。
- 4 个高质量例句（附中文）。

## Output Format

markdown
