---
description: 按预置信源或指定网址采集材料，写入 .artifacts/scraps，并按统一模板写中文 briefing
argument-hint: [源名或网址]
---

# 每日采集

加载 `scraps`。无参跑 `general` 早报组；参数可以是 `tech` / `finance` / `social`、源名、关键词，或文章网址。关键词会过滤并按相关度排序。文风里保存的网址会并入。应用已把这次采集记入 `content_entries`。

## 执行步骤

1. 加载 scraps，跑 `collect.py --deep`（指定文章网址同样走深读，HTTP + 可选 Playwright）
2. 每条按统一模板写成中文（Title / Source / Time / Heat / Links / Summary / Deep Dive）
3. 写到 `.artifacts/scraps/<YYYY-MM-DD>/`，并写 `index.json` 与 `briefing.md`
4. 打不开的源写进列表，不要编造正文
5. 给出列表报

## 输出格式

```
标题 | 源 | 时间 | 热度 | 网址 | 本地路径
```

## 示例

```
/scrap
/scrap tech
/scrap finance
/scrap https://example.com/today
/scrap hackernews,36kr https://example.com/a
/scrap AI
/scrap tech GPT,Claude
```
