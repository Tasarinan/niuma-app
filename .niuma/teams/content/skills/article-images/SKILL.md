---
name: article-images
description: 配图师｜封面与插图 — 系统图片模型生图，或上网搜类似图，保存 PNG 到草稿 imgs/，并改最新 article.md 中的图片引用。触发词：「配图」「封面」「搜图」。
homepage: https://github.com/Tasarinan/niuma-app
---

# 配图师

配图**不一定要 AI 生成**。实拍、产品界面、新闻现场、已有参考图，用网上搜索；原创插画、品牌封面、从零做的信息图，用图片模型。

## 两条路

1. **网上搜类似图**：`search_images`（关键词）→ 选一张 → `save_web_image`（`url` 用结果里的 `image:` 行，`sourceUrl` 用 `page:` 行）
2. **AI 生图**：`generate_image`（系统 API 提供商的图片模型，设置 → API 提供商）

不要跑 `image_create.py`，不要使用 `IMAGE_MODEL_API_KEY`，不要用 Pollinations，不要 bash curl 下图。未配置图片模型时，生图这条路只出 prompt，**不要假装已经出图**；搜图这条路仍可走。

草稿配图一律用 **PNG**。全部写到该篇草稿的 `imgs/`：
- **封面**只用 `cover.png`（或 `imgs/prompts/cover.md` 对应的那张）
- **截图 / 插图**用 `01.png`、`02.png`……，或带主题前缀如 `ai-native-01.png`（取自草稿目录名里的英文段）
- **禁止**把截图命名为 `cover`；不能有空格、中文或其它乱名。工具会转成 PNG 并自动规范文件名。

网上的图要写来源（`save_web_image` 会记进 `imgs/prompts/<同名>.md`）。搜图**优先 Unsplash**（实拍/氛围），其次 Wikimedia，再次 DuckDuckGo。Unsplash 图保留「Photo by … on Unsplash」。版权不清时告诉用户来源。不要下内网地址。

可选：在工作区 `.env.local` 写 `UNSPLASH_ACCESS_KEY=`（[Unsplash developers](https://unsplash.com/developers) 的 Access Key）。没有 key 时仍会搜 Unsplash 公开结果。不要把密钥发到聊天里。

## 怎么选

| 需要 | 走哪条 |
|------|--------|
| 真实照片、产品外观、软件界面、新闻事件、用户说「找一张类似的」 | `search_images` → `save_web_image` |
| 原创插画、品牌封面、抽象概念图、按稿现画的流程图 | `generate_image` |
| 没说死 | 先判断上面两行；封面常生图，正文里「长这样」的实物常搜图 |

## 整理散落图片（/image）

用户或主理人发出 `/image` 时：

1. 加载本技能（若尚未加载）
2. 对当前篇调用 **`consolidate_draft_images`**（`path` 指向 `article.md` 或草稿目录）
3. 工具会把草稿**根目录**与 `imgs/` 下的图**移动**到 `imgs/{主题}-NN.png`（封面仍 `cover.png`），删除根目录旧文件与非 PNG 中间文件，并改写 `article.md` / `topic.md` / `review.md` 中的 `![](...)`，**alt 与文件名一致**
4. `open_article` 定位文稿，请用户点「编辑」核对

不要用 bash `mv` 代替该工具。

## 流程

1. 确认 `.niuma/artifacts/drafts/<YYYYMMDD-主题>/article.md` 已存在。没有就停止，不要 mkdir
2. `read` 该 `article.md`
3. 按正文结构决定每张图走搜还是生。每一张图单独一个 prompt 文件，文件名与 PNG 相同：`imgs/prompts/cover.md` 对 `imgs/cover.png`
4. 生图：调用 `generate_image`，`path` 必须是 PNG。搜图：调用 `search_images`，再 `save_web_image`
5. 再 `read` `article.md`，用相对路径 `imgs/cover.png` / `imgs/01.png` 写入正文（先读再 edit）
6. 用 `open_article` **定位**当前文稿（不要切换对话/编辑）。告诉用户点工具栏 **编辑** 看配图
7. 编辑器里手贴的图也算数；不要删用户已贴的图，除非对方要求

`generate_image` 参数：`prompt`（必填）、`path`（输出 PNG）、可选 `image`（参考图路径，做图生图）。
`search_images` 参数：`query`（必填）。
`save_web_image` 参数：`url`（必填）、`path`（输出 PNG）、可选 `prompt`、`sourceUrl`。
