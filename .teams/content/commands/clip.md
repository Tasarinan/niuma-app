---
description: 快速记录思考、摘录、日记，写入 scraps inbox 与本地数据库
argument-hint: [idea|note|clip|quote|diary] [content]
---

# 素材记录

将日更素材写入 **`.artifacts/scraps/<日期>/inbox/`** 的 Markdown，并同步 SQLite `content_entries`。不要另写 journal 作为主记录。人给原文，不要扩写成文章。若要把一段话或图片整理进当前稿，用 `/intake` 或直接粘贴。

## 记录类型

### idea — 想法

```
/clip idea Cursor 多窗口的一个坑
```

### note — 笔记

```
/clip note 读书会一句：…
```

### clip — 摘录

```
/clip clip 摘自某篇文章的一段
```

### quote — 金句

```
/clip quote …
```

### diary — 日记

```
/clip diary 今日小结
```

## 执行步骤

1. 解析类型和正文；类型必须是 idea / note / clip / quote / diary
2. 应用写入 `content_entries`，并在 scraps `inbox/` 落一份 Markdown
3. 根据注入的记录 id、scraps 路径与摘要做简短确认

## 输出格式

```
✅ 已记录 [类型] — [摘要]（scraps inbox + 数据库）
```
