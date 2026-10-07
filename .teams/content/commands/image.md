---
description: 整理当前草稿目录下的图片到 imgs/（主题前缀 PNG），并同步 article.md 等文中的引用与 alt
argument-hint: [path]
---

# 配图整理（/image）

目标路径：`$ARGUMENTS`。

切换到**配图师**。把当前篇草稿里散落的图片**移动进** `.artifacts/drafts/<YYYYMMDD-主题>/imgs/`（草稿根目录的 `Screenshot*.png` 等会**移走并删除原文件**），全部落成 **PNG**，并按主题重命名为 `{主题}-01.png`、`{主题}-02.png`……；`cover.png` 仅用于封面。

## 做什么

1. 扫描草稿**根目录**与 `imgs/` 下已有图片（含截图、jfif、webp、`*_compressed.jpg` 等）
2. 按正文 `article.md`（以及同目录 `topic.md` / `review.md`）里图片出现顺序，分配 `{主题}-01.png`、`{主题}-02.png`……
3. 写入 `imgs/<新名>.png` 后，**删除**已搬迁的旧路径（根目录原图、旧文件名、非 PNG 中间文件）
4. 把文中所有本地图片引用改成 `imgs/<文件名>.png`，并让 **alt 与文件名一致**
5. 根目录里未入文的图片也会收进 `imgs/` 并占用下一个序号，原文件从根目录移除

## 怎么执行

- 加载 `article-images`
- 对目标稿调用 **`consolidate_draft_images`**（`path` 填 `article.md` 或草稿目录）
- 完成后 `read` 一遍 `article.md` 确认引用，再 `open_article` 请用户点「编辑」查看

**不要**用 bash 批量 `mv`；**不要** mkdir 新草稿；**不要**改排版或发布。

## 边界

- 远程 `https://` / `data:` 图片不动
- 无 `article.md` 时停止，说明需要先 `/article create` 或 `/article edit`
- 开新题、续稿：`/article`；排版 `/format`；发布 `/publish`

## 示例

```
/image
/image .artifacts/drafts/20260918-workbuddy-办公搭子还是付费陷阱/article.md
```
