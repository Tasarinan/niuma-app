---
id: "gt-reading-hub"
name: "gpt-tutor-reading-hub"
description: "GPT-Tutor 阅读综合功能。整合摘要、论证分析、探究问题和拓展知识。"
icon: "📚"
category: "GPT-Tutor 文章阅读理解"
command: "gt-reading-hub"
enabled: true
isPreset: false
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-03T13:26:40.9767643+08:00"
updatedAt: "2026-06-03T13:26:40.9767643+08:00"
---

# gpt-tutor-reading-hub

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请将 {{text}} 作为阅读材料，输出阅读理解综合结果。

请覆盖：
- 一句话摘要与要点摘要。
- 论证结构（主张、证据、推理链）。
- 4 个探究问题（主旨/细节/推理/批判）。
- 关键词表达解释与可替换表达。
- 相关背景知识与延伸阅读方向。

## Output Format

markdown
