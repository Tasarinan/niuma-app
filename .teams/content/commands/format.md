---
description: 后备：微信排版：优先请用户在编辑栏点「生成微信排版」
argument-hint: [WECHAT|XHS|ZHIHU]
---

# 多平台排版（/format · 后备）

**规范入口：编辑栏 → 元数据侧栏 → 排版与发布 → 生成微信排版**（主题已在编辑栏「排版样式」写入 `article.yaml`）。

用户坚持在聊天排版时：切换到**发行**，基于磁盘最新 `article.md` 跑 `format.py`。不要开会，不要 mkdir。

## 前置

- 平台：`WECHAT` / `XHS` / `ZHIHU`（未指定先问）
- 提醒用户先在编辑栏保存并确认排版主题

## WECHAT

- 加载 `article-formatting-wechat`
- `format.py <草稿目录>/article.md`（主题来自本篇 YAML，不要擅自 `--theme`）

## XHS / ZHIHU

尚未接通，说明即可，禁止假产物。

## 边界

- 不要 `publish.py`
- 开稿用 `/draft`，继续稿用 `/article edit <target>`
