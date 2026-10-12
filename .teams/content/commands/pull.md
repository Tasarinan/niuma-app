---
description: 按已保存的网址拉取当天材料，摘要写入指定目录，并给出列表报
argument-hint: [额外网址]
---

# 每日拉取

按文风档案里的网址（加上本次补上的网址）抓取正文。应用已把这次要拉的网址记入 `content_entries`。

## 执行步骤

1. 按注入的列表逐个打开
2. 每个网址一篇 Markdown，写到注入的目录（默认 `.artifacts/content/pulls/<YYYY-MM-DD>/`）
3. 文首写原 URL
4. 打不开的页面写进列表，不要编造正文
5. 给出列表报

## 输出格式

```
标题 | 网址 | 一句摘要 | 本地路径
```

## 示例

```
/pull
/pull https://example.com/today
```
