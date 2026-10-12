---
description: 后备：把当前稿推到公众号草稿箱。优先请用户在编辑栏发布
argument-hint: [WECHAT|XHS|ZHIHU] [account]
---

# 推草稿箱

规范入口：编辑栏 → 排版与发布 → 选微信槽位 → 推到公众号草稿箱。

用户坚持在聊天发布时由发行执行。不要在用户没看预览时上传。只推草稿箱，不群发。

## 前置

- 平台必选；微信须 `[微信公众号槽位]` 确认 `--account N`
- 以磁盘最新 `article.md` 为准

## 执行步骤

仓库根：

```bash
python .teams/content/skills/wechat-publish/scripts/publish.py --account N full .artifacts/drafts/<主题目录>/
```

禁止跳过排版，禁止直传旧 `article.html`。小红书、知乎尚未接通。

## 示例

```
/publish WECHAT 1
```
