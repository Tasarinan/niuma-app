---
description: 追加日更素材（想法/笔记/摘抄/日记）到本地 journal
argument-hint: [idea|note|clip|quote|diary] [content]
---

# 素材记录（/record）

对标健康 `/record`。轻量、可批量。写入 `.artifacts/content/journal/`（按日 `YYYY-MM-DD.md` 或单条 `entries/YYYYMMDD-HHmmss.md`）。

## 类型

| 类型 | 示例 |
|------|------|
| idea | `/record idea Cursor 多窗口的一个坑` |
| note | `/record note 读书会一句：…` |
| clip | `/record clip 摘自…` |
| quote | `/record quote …` |
| diary | `/record diary 今日小结` |

## 执行

1. 解析类型与正文，加时间戳与可选 `tags:`
2. 追加到当日 journal 文件
3. 简短确认，不冗长

```
✅ 已记录 [类型] — [摘要]
📅 [日期时间]
```
