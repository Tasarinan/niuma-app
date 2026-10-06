---
id: "gt-writing-hub"
name: "gpt-tutor-writing-hub"
description: "GPT-Tutor 写作综合功能。整合表达建议、改写润色、题目分析与范文支持。"
icon: "📝"
category: "GPT-Tutor 写作学习"
command: "gt-writing-hub"
enabled: true
isPreset: false
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-03T13:26:40.9767643+08:00"
updatedAt: "2026-06-03T13:26:40.9767643+08:00"
---

# gpt-tutor-writing-hub

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请将 {{text}} 作为写作任务或表达需求，输出写作辅导方案。

请覆盖：
- 表达方案（至少 3 种）与语气/场景差异。
- 句子或段落润色（如有原文）。
- 文章结构与论点展开建议。
- 常用连接词和高级替换表达。
- 若是 IELTS/TOEFL 题目：补充题型分析与示例段落。

## Output Format

markdown
