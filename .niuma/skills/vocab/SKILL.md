---
id: "vocab"
name: "vocab-lookup"
description: "查询单词的发音、释义、例句和词源。当用户想要学习新单词、查询词义或了解单词用法时使用。"
icon: "📚"
category: "学习"
command: "vocab"
enabled: true
isPreset: true
toolsMode: "selected"
selectedTools: "[\"web_search\"]"
parameters: "[{\"name\":\"word\",\"description\":\"要查询的单词\",\"required\":true,\"type\":\"text\"}]"
createdAt: "2026-05-28T07:45:09.048Z"
updatedAt: "2026-05-28T07:45:09.048Z"
---

# vocab-lookup

## Instructions

请查询单词 "{{word}}" 的详细信息。如果需要，可以使用网络搜索获取最新发音和例句。

## Output Format

## {{word}}
**发音**: [音标]
**词性**: [名词/动词/形容词等]
**释义**: [中文释义]
**例句**:
1. [英文例句] - [中文翻译]
2. [英文例句] - [中文翻译]
**词根词缀**: [如有]
**同义词**: [如有]
