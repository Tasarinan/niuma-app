---
id: "gt-grammar-check"
name: "gpt-tutor-grammar-check"
description: "GPT-Tutor 检查语法错误功能。指出语法错误、错误类型、修改建议和学习方向。"
icon: "🔧"
category: "GPT-Tutor 语法学习"
command: "gt-grammar-check"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.386Z"
updatedAt: "2026-06-04T04:41:04.386Z"
---

# gpt-tutor-grammar-check

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请作为英语语法老师，检查下面表达中的语法错误。

表达：{{text}}

请明确指出错误、错误类型、修改建议、正确版本，以及相关语法知识点。

## Output Format

markdown
