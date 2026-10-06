---
id: "gt-inquiry-questions"
name: "gpt-tutor-inquiry-questions"
description: "GPT-Tutor 探究问题生成功能。基于文章生成帮助理解核心内容的问题。"
icon: "❓"
category: "GPT-Tutor 文章阅读理解"
command: "gt-inquiry-questions"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.288Z"
updatedAt: "2026-06-04T04:41:04.288Z"
---

# gpt-tutor-inquiry-questions

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请作为阅读指导教师，基于下面文章内容生成 4 个帮助理解文章核心的探究问题。

文章内容：{{text}}

问题应覆盖主旨、论证、细节推理和批判性思考。

## Output Format

markdown
