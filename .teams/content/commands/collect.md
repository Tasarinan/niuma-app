---
description: 剪藏 URL 或附件，摘要入 journal，全文可进 IMA 素材库
argument-hint: [url|file] [target]
---

# 剪藏（/collect）

对标健康 `/analyze` 的「重输入」。

## url

加载 `web-to-markdown`（或现有 fetch 脚本）→ Markdown 摘要 + 来源 URL 写入 journal。IMA 已配置时可上传全文至「内容素材库」。

## file

用户附件 → `.artifacts/content/inbox/` + 摘要入 journal。

## 示例

```
/collect url https://example.com/post
/collect file （附图）
```

IMA 未配置时仅本地 inbox + journal。
