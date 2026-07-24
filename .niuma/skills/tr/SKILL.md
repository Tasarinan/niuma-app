---
id: "tr"
name: "translate"
description: "多语言翻译服务，支持中英日韩法德等语言互译。当用户需要翻译文本、理解外语内容或进行语言转换时使用。"
icon: "🌐"
category: "翻译"
command: "tr"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"text\",\"description\":\"要翻译的内容\",\"required\":true,\"type\":\"text\"},{\"name\":\"target\",\"description\":\"目标语言\",\"required\":false,\"type\":\"select\",\"options\":[\"中文\",\"英文\",\"日文\",\"韩文\",\"法文\",\"德文\"],\"defaultValue\":\"中文\"}]"
createdAt: "2026-05-28T07:45:09.061Z"
updatedAt: "2026-05-28T07:45:09.061Z"
---

# translate

## Instructions

请将以下内容翻译成{{target}}：

{{text}}

## Output Format


