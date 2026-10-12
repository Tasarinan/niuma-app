---
description: 快速记录思考、摘录、日记，存入本地数据库
argument-hint: [idea|note|clip|quote|diary] [content]
---

# 素材记录

将日更素材写入本地 SQLite `content_entries`。不要另写 journal Markdown 作为主记录。人给原文，不要扩写成文章。若要把一段话写进当前稿，直接粘贴或用 `/clip`，不要只用 `/record`。

## 记录类型

### idea — 想法

```
/record idea Cursor 多窗口的一个坑
```

### note — 笔记

```
/record note 读书会一句：…
```

### clip — 摘录

```
/record clip 摘自某篇文章的一段
```

### quote — 金句

```
/record quote …
```

### diary — 日记

```
/record diary 今日小结
```

## 执行步骤

1. 解析类型和正文；类型必须是 idea / note / clip / quote / diary
2. 应用写入 `content_entries`
3. 根据注入的记录 id 与摘要做简短确认

## 输出格式

```
✅ 已记录 [类型] — [摘要]
```
