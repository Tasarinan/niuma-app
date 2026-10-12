# 调研策略（参考 wemp-ops 采集顺序）

Niuma 没有 `web_fetch`。深读用 `web-to-markdown`。热点源用本技能 `scripts/collect.py`（底层是 wemp-ops 的 `fetch_news.py`）。

## 顺序（不要跳）

1. **本地先查**：对话里的 `content_entries`、中央 Feed、IMA。有匹配就标用途（开头 / 论据 / 反面 / 待补事实）。用自己的话转述，不要学术式堆链接。
2. **热点源**：想法扩 3–5 个关键词，跑 `collect.py`。默认 sspai / juejin / 36kr / v2ex / zhihu。
3. **补充搜索**：`web_search` 2–3 轮（官方或一手 → 深度分析 → 对比讨论）。一共 4–6 次，不要空转。
4. **深读**：从上面挑 2–4 个最好的 URL，用 `web-to-markdown` 抽正文。打不开就换，不要编造。

## collect.py

在仓库根：

```bash
python .teams/content/skills/topic-research/scripts/collect.py --query "想法" --keywords "关键词1,关键词2" --sources sspai,juejin,36kr,v2ex,zhihu --count 16
```

`--sources` 也可用分组 `tech` / `china` / `finance`。某个源失败就记下，继续别的。

## 搜索轮次

**有具体想法（模式 A）**
```
web_search("{想法} 深度解析")
web_search("{想法} 公众号")
web_search("{想法} 数据 报告")
web_search("{想法} 知乎 痛点")
```

**只有方向（模式 B）**
```
web_search("{方向} 最新 {当前月份}")
web_search("{方向} 公众号")
web_search("{方向} {读者} 关心")
```

**完全没方向（模式 C）** 用 `editorial.yaml` 的栏目和类别替换 `{方向}`。

## 写法产出（给写手）

```markdown
# 调研

- 想法：
- 主题（一句话，不是最终标题）：
- 写法：教程式 / 故事型 / 清单体 / 观点文；各节要解决什么
- 废水（动笔禁用）：

## 本地素材
- 记录 id / 用途

## 网上
- [标题](url) — 一句能用的点

## 可引用
- 事实 + URL
- 没有来源的数字丢掉
```

## 规则

- 主题不是标题。已有 `topic.md` 里的主题时，材料必须贴题，跑题的丢掉
- 不定最终公众号标题
- 不写 `article.md`（那是 `/outline` 写手的事）
- 不编造亲身经历；用户没写过的诊所细节标「待补」
- 搜索或采集失败就说明失败，换词再试一次，不要硬凑
