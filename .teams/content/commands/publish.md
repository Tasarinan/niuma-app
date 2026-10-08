---
description: 后备：推草稿箱 — 优先请用户在编辑栏「推到公众号草稿箱」
argument-hint: [WECHAT|XHS|ZHIHU] [account]
---

# 推草稿箱（/publish · 后备）

**规范入口：编辑栏 → 排版与发布 → 选微信槽位 → 推到公众号草稿箱**（会先保存当前稿再跑 `publish.py full`）。

用户坚持在聊天发布时：切换到**发行**。不要开会，不要 mkdir。

## 前置

- 平台必选；微信须 `[微信公众号槽位]` 确认 `--account N`
- 以磁盘最新 `article.md` 为准；建议先 `/review` 或编辑栏审稿

## WECHAT

```bash
python .teams/content/skills/article-publish-wechat/scripts/publish.py --account N full .artifacts/drafts/<主题目录>/
```

禁止 `--skip-format`，禁止直传旧 `article.html`。

## XHS / ZHIHU

尚未接通。

## 边界

- 只排版用 `/format` 或编辑栏「生成微信排版」
- 开稿 `/draft`，继续 `/article edit <target>`
