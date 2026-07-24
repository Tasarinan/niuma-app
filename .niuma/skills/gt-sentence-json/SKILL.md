---
id: "gt-sentence-json"
name: "gpt-tutor-sentence-json"
description: "GPT-Tutor 句子分析功能。将英文句子翻译并按语法成分输出结构化 JSON。"
icon: "🧱"
category: "GPT-Tutor 句子学习"
command: "gt-sentence-json"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要学习、分析或处理的内容\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-06-04T04:41:04.312Z"
updatedAt: "2026-06-04T04:41:04.312Z"
---

# gpt-tutor-sentence-json

## Instructions

目标学习语言默认是英语，讲解语言默认是中文。

请按要求处理英文句子，并返回严格 JSON，不要添加 Markdown 代码块或解释。

要求：
1. 翻译英文句子到中文。
2. 分析并分类每个单词或短语：主语、谓语、宾语、定语、状语、补语、其他成分。
3. 输出格式：
{
  "sentenceTranslation": "中文翻译",
  "originalSentence": "原句",
  "sentences": [
    { "word": ["片段"], "subject": "语法成分", "translation": "中文" }
  ]
}

句子：{{text}}

## Output Format

json
