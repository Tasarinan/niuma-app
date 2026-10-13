---
description: 公众号运营日报，以及评论拟回复（确认后再发）
argument-hint: [daily|week|comments] [send] [YYYY-MM-DD]
---

# 公众号运营

加载 `wechat-publish`。涨粉阅读走 datacube；评论先拉真评论、按文风拟回复，**人确认后再发**。不要读 `.artifacts/scraps`。不要编造读者评论。

## 执行步骤

### 日报 / 周报

1. `daily_report.py --range daily` 或 `--range week`（默认昨天）
2. 槽位加 `--account N`，不要打印 APPSECRET
3. 展示 `.artifacts/wechat/ops/` 里的报告，说明该不该跟读

### 评论

1. `/ops comments`：`comments.py list`，只对 JSON 里**新的** unreplied 拟回复（≤120 字），写入 `comment-drafts.json`。已拟过或已发的 id 会跳过
2. 展示拟回复，等用户改或确认
3. `/ops comments send`：带 `--yes` 才真正发送。未确认只允许 dry-run
4. `/ops comments elect <id>`：先 dry-run；用户确认后再 `/ops comments elect <id> yes`。取消精选用 `unelect`

## 示例

```
/ops
/ops week
/ops comments
/ops comments send
/ops comments elect <articleId_commentId>
/ops comments elect <articleId_commentId> yes
/digest wechat
```
