---
id: "gt-word-usage"
name: "gpt-tutor-word-usage"
description: "GPT-Tutor 单词使用功能。分析单词作为名词、动词、形容词时的搭配和用法。"
icon: "⚓"
category: "GPT-Tutor 单词学习"
command: "gt-word-usage"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.174Z"
updatedAt: "2026-06-04T04:41:04.174Z"
---

# gpt-tutor-word-usage

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

我给出的单词是 {{text}}。请直接回答，不要寒暄。

如果该词有名词、动词、形容词等不同形式，请分别说明。
- 名词形式：给出最高频的 3 个搭配、常见修饰形容词、常搭配动词。
- 形容词形式：给出最高频的 3 个搭配，并说明如何正确使用。
- 动词形式：给出最高频的 3 个搭配，并说明及物/不及物、宾语类型和常见句型。

## Output Format

markdown
