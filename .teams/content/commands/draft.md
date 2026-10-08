---
description: 从素材与文风开稿或打开已有草稿目录
argument-hint: [主题或关键词]
---

# 开稿（/draft）

从 `/style` + 近期 journal + 可选 IMA 片段生成或继续成稿。目录：`.artifacts/drafts/<YYYYMMDD-主题>/`（`topic.md`、`article.md`、`article.yaml`）。

## 行为

- **有参数**：按主题匹配未完成稿，或新建目录 + `topic.md` + 初稿 `article.md`
- **无参数**：结合 `/digest` 建议，请用户确认题目后再 mkdir
- 落盘后 `open_article`，提示用户到**编辑栏**手工改；不要主持旧式「未定题禁止 mkdir」圆桌

## 与 /article

- `/article create` 视为兼容别名，行为同 `/draft`
- `/article edit <target>` 继续已定题稿

## 示例

```
/draft 乾坤AI路书 Cursor 多窗口
/draft
```
