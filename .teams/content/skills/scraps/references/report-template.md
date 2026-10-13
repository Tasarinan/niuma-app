# 采集报告模板

全文简体中文。专有名词可保留英文。只用 JSON / Markdown 里的事实，不要编造条目或因果关系。

## 单条（每条独立一节，不要把多条揉成一条）

```markdown
#### N. [标题（中文翻译）](https://original-url.com)
- **Source**: 源名 | **Time**: 时间 | **Heat**: 🔥 热度
- **Links**: [Discussion](hn_url) | [GitHub](gh_url)
- **Summary**: 一句话中文摘要。
- **Deep Dive**: 💡 **Insight**: 背景、影响、为什么值得写。没有正文就写「材料不足，仅标题」。
```

- **Time** 必填。JSON 缺时间就写 `Unknown Time`。
- **Links** 只在字段存在时显示。Hacker News 必须带 Discussion。
- GitHub：Heat 用 Stars / trending，有语言就加 `Lang`。
- 微博：Heat 保留原文（如「108万」）。

## `/scrap` 落盘

1. 每条一篇 Markdown，文首原 URL，正文用上面模板。
2. 再写 `briefing.md`：从 JSON 里选出约 20–25 条（不够就全写，禁止凑数编造）。按源分组。
3. `index.json`：title、url、source、time、heat、path、failed。

## `/digest`

读 scraps 里的条目和 `briefing.md`，按同一模板写 `daily-report.md` / `monthly-report.md`。不要另造新闻。
