# 选题输出

## `/digest` 日报 / 月报

先写报告文件，再在回复里展示。条目只用 scraps 里有的事实。格式与 `scraps/references/report-template.md` 相同。

```markdown
# 采集日报（YYYY-MM-DD）

#### 1. [标题（中文）](url)
- **Source**: 源名 | **Time**: 时间 | **Heat**: 🔥 热度
- **Links**: [Discussion](hn_url)
- **Summary**: 一句话中文摘要。
- **Deep Dive**: 💡 **Insight**: 背景与影响。没有正文则写「材料不足，仅标题」。

可成稿题目（最多 3 个）：
1. 题目 — 依据记录 id / 网址
2. …
```

没有采集就写「今日无采集」或「本月无采集」。不要建草稿。等用户确认后再 `/propose` 或 `/outline`。

## `/propose`

每个主题一段，最多 5 个：

```markdown
### 1. 题目
- 为什么现在写：
- 引用：记录 id / 网址
- 栏目：乾坤AI路书 / FDE日记 / AI外网
- 建议下一步：`/outline <主题>` 写初稿（写手会调研，标题后定）
```

素材不够就写「建议再聊」，或请用户 `/outline <想法>`。不要假装已上网。不要自己写初稿。
