---
name: image-generator
description: 为当前篇指定位置配封面或插图：搜图或生图，保存 PNG 到 imgs/。当用户要配图、封面、搜图，或在编辑栏点了「配图」时使用。
---

# 配图生成器

为当前草稿指定位置出封面或插图。没有 `article.md` 就停止，不要 mkdir。

**先计划再生图。** 扫描结构 → Type×Style → 写 `illustration-plan.md` 等人确认 → 再搜图/生图/渲 Mermaid。全文只锁一种 Style；含封面共 **3–5 张**。禁止「只有封面、正文 2000 字零插图」，禁止每张换一种 Style。细则：[references/illustration-plan.md](references/illustration-plan.md)。

## 核心功能

### 1. 选路径
| 需要 | 工具 |
|------|------|
| 实拍、产品页、后台、IDE、新闻 | `search_images` → `save_web_image`（或用户截图）。禁止 AI 假界面 |
| 流程 / 架构 / 对比要精确可读 | Mermaid → PNG，见 [references/mermaid-path.md](references/mermaid-path.md) |
| 原创插画、品牌封面、场景/氛围 | `generate_image`，沿用计划里锁定的 Style |

没说死：实物常搜图，封面常生图。未配置图片模型时，生图只出 prompt。

### 2. 落盘
- PNG 写到本篇 `imgs/`：封面 `cover.png`，插图 `01.png`
- 截图禁止叫 cover
- 每张图一份 `imgs/prompts/<同名>.md`（搜图须带来源）

### 3. 插入指定位置
- 把 `imgs/…` 写进用户点名的位置
- `open_article` 定位，请用户点「编辑」
- 散落图片用 `consolidate_draft_images`

### 4. 微信规格预检
落盘后、推草稿箱前检查体积与比例（封面 < 10MB，正文建议 < 2MB，不要 webp）：

```bash
python .teams/content/skills/image-generator/scripts/check_images.py .artifacts/drafts/<YYYYMMDD-主题>/
```

封面优先 PNG：合并封面 1283×383，大封面 900×383，或 wechat-mp-auto 900×500。裁切用 `scripts/prepare_cover.py`。细则见 [references/specs.md](references/specs.md)。

## 使用说明

### 触发条件

当用户提到以下场景时，使用此技能：

- ✅ 封面或某一节要图
- ✅ 「找一张类似的」「生一张」
- ✅ 编辑栏「配图」

### 执行步骤

#### 步骤 1: 读取当前稿
`read` 最新 `article.md`。没有当前草稿就停止。

#### 步骤 2: 计划（尚未确认时）
按 [references/illustration-plan.md](references/illustration-plan.md) 扫描结构、选 Type、**全文锁一种 Style**，写入本篇 `illustration-plan.md`。等人确认后再出图。已有锁定计划时，编辑栏单张也必须沿用 Style。

#### 步骤 3: 按行出图
搜图 / 生图 / `render_mermaid.py`。产品页走真实截图。

#### 步骤 4: 保存并插入
按核心功能落盘 PNG 与 prompt，再写入计划中的位置。

风格细则：[references/image-styles/auto-selection.md](references/image-styles/auto-selection.md)

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 当前稿 | `.artifacts/drafts/<主题>/article.md` | 配图位置与文意 |
| 内置封面风格 | `references/cover-styles/` | 封面预设 |
| 用户封面风格 | `.teams/content/editor/cover-styles/` | 同名覆盖内置 |
| 配图风格 | `references/image-styles/` | 自动选 Type；Style 全文只锁一种 |
| 配图计划 | 本篇 `illustration-plan.md` | 确认后再出图 |

## 安全与合规

- ❌ 没有当前草稿不要 mkdir
- ❌ 未配置图片模型时不要假装已出图
- ❌ 不写正文、不排版、不发布
- ❌ 不把 AI 假界面当作产品截图；Mermaid 渲不出时不要改画假架构图
- ✅ 计划确认后出图；全文一种 Style；3–5 张（含封面）

## 相关入口

- 编辑栏「配图」
- 聊天里被点名配图
