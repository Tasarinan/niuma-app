---
id: "gt-grammar-hub"
name: "gpt-tutor-grammar-hub"
description: "GPT-Tutor 语法综合功能。整合语法讲解、纠错、延伸学习和练习生成。"
icon: "📐"
category: "GPT-Tutor 语法学习"
command: "gt-grammar-hub"
enabled: true
isPreset: false
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-03T13:26:40.9767643+08:00"
updatedAt: "2026-06-03T13:26:40.9767643+08:00"
---

# gpt-tutor-grammar-hub

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请围绕 {{text}} 输出“语法学习一体化答案”。

请覆盖：
- 核心规则与使用条件。
- 典型正确例句与常见错误。
- 若输入像句子/段落，先进行语法纠错并说明原因。
- 前置知识、易混点与进阶学习方向。
- 3 题小练习（含答案与简析）。

## Output Format

markdown
