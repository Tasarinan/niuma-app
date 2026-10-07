# 审稿落盘文件（Phase A）

同一草稿目录 `.artifacts/drafts/<文件夹>/` 下，除 `review.md` 外必须写入：

## 1. 审稿前快照

- 读取 `review.meta.yaml` 的 `round`（不存在则视为 `0`）。
- 新轮次 `nextRound = round + 1`。
- 将当前 `article.md` **全文复制**到 `.history/article-r{nextRound}.md`（目录不存在则创建）。
- 对刚读取的 `article.md` 原文计算 **SHA-256**（十六进制小写，UTF-8），记为 `article_sha256`。

## 2. review.meta.yaml

```yaml
round: 2
status: blocked          # pass | blocked
reviewed_at: "2026-10-07T12:00:00+08:00"
article_sha256: "<上一步计算的哈希>"
blocker_count: 2         # 🔴 必须修改项数量
reviewer: chief
```

- `status: pass` 仅当无 🔴 项且可定稿时。
- 人改 `article.md` 后哈希会变，编辑器会标「审稿已过期」，需重审。

## 3. review.suggestions.json

与 `review.md` **同轮次、同 article_sha256**。人类可读清单仍写 `review.md`；本文件供编辑栏「审稿」侧栏解析。

```json
{
  "round": 2,
  "article_sha256": "<与 meta 相同>",
  "title": {
    "score": 72,
    "candidates": ["候选标题 A", "候选标题 B"],
    "issues": ["含禁用套路"]
  },
  "items": [
    {
      "id": "r2-001",
      "severity": "blocker",
      "category": "typo",
      "anchor": "帐号",
      "reason": "错别字",
      "suggestion": "改为「账号」",
      "patch": { "type": "replace", "old": "帐号", "new": "账号" }
    },
    {
      "id": "r2-002",
      "severity": "suggestion",
      "category": "ai_flavor",
      "anchor": "这不是工具，而是伙伴",
      "reason": "对仗模板感",
      "suggestion": "保留一句，删凑数对仗",
      "patch": null
    }
  ]
}
```

规则：

- `id` 建议 `r{round}-{序号}`。
- `anchor` 必须是 `article.md` 中的**原文子串**；可自动替换时 `patch.old` 与 `anchor` 一致，且在全文中**只出现 1 次**。
- 无自动替换时 `patch` 为 `null`，只写 `reason` / `suggestion`。
- 🔴 对应 `severity: "blocker"`，🟡 对应 `suggestion`。

## 4. review.md

格式仍见 `output-format.md`。轮次、结论与 `review.meta.yaml` 一致。

## 5. 完成后

`open_article` 定位 `review.md`，请用户在编辑栏打开 **审稿** 侧栏查看结构化项（不必只读 Markdown 文件）。
