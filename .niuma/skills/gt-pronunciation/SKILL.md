---
id: "gt-pronunciation"
name: "gpt-tutor-pronunciation"
description: "GPT-Tutor 发音解释功能。解释单词、表达或句子的常见发音和特殊读法。"
icon: "🎙️"
category: "GPT-Tutor 单词学习"
command: "gt-pronunciation"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.165Z"
updatedAt: "2026-06-04T04:41:04.165Z"
---

# gpt-tutor-pronunciation

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请作为专业英语口语老师，解释下面内容的正确发音：{{text}}。

请给出：
- 最常见发音和 IPA 音标。
- 重音、连读、弱读或易错音。
- 如果存在同形异音、方言或口音差异，请指出。
- 适合中文学习者的发音练习提示。

## Output Format

markdown
