---
id: "meetquestions"
name: "meeting-follow-up-questions"
description: "基于会议模式中的实时转写，生成高质量追问。适合推进需求澄清、面试反问、客户沟通。"
icon: "💬"
category: "会议辅助"
command: "meetquestions"
enabled: true
isPreset: true
toolsMode: "none"
selectedTools: "[]"
parameters: "[{\"name\":\"focus\",\"description\":\"可选：希望重点关注的问题、对象或主题\",\"required\":false,\"type\":\"text\",\"defaultValue\":\"无特别关注点\"}]"
createdAt: "2026-05-28T07:45:09.122Z"
updatedAt: "2026-05-28T07:45:09.122Z"
---

# meeting-follow-up-questions

## Instructions

请基于当前 Meeting Context，帮用户提出高质量追问。

关注点：{{focus}}

要求：
1. 给 5 个问题。
2. 每个问题都要具体、自然、能推进讨论。
3. 按优先级排序。
4. 如果适合，给一句提问前的铺垫话术。

## Output Format

### 建议追问
1.
2.
3.
4.
5.

### 铺垫话术
