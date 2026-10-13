# 配图计划（先计划，再生图）

封面有了不算配完。1800–2500 字的正文若零插图，或每张 Style 都不一样，视为失败。

## 顺序（不可跳）

1. **扫描结构**：读最新 `article.md`，标出 `##`、概念首次出现、对比/转折、连续 >800 字无图处。
2. **Type × Style**：每张图先定 Type（画什么），全文只锁 **一种 Style**（怎么画）。渲染方式另选。
3. **写计划并确认**：写入本篇 `illustration-plan.md`，等人回复「按计划配图」或改表后再出图。
4. **再生图 / 搜图 / 渲 Mermaid**。已有计划且 Style 已锁时，编辑栏单张「配图」也必须沿用锁定项。

没有当前 `article.md` 就停。用户明确说「只要封面」才允许封面单独完成。

## 密度（含封面，硬上限 5）

| 篇幅 | 张数 | 组成 |
|------|------|------|
| 约 1800 | 3 | 封面 + 1 结构/概念 + 1 正文 |
| 1800–2500（缺省） | **4** | 封面 + 1 结构 + 2 正文 |
| 更长 | 5 | 封面 + 1 结构 + 3 正文 |

- 全文（含封面）**3–5 张**。超过 5 张像 PPT。
- 默认每 600–800 字一图；不确定就不配。
- 不要连续 2 张以上同 Type。
- `editorial.yaml` 的 `image_density` 服从上表，不再写「按需、不凑数」当零图借口。

## Type（可变）× Style（全文锁一种）

Type 用 [image-styles/styles.md](image-styles/styles.md)。生图 Style 锁一种：`扁平矢量` / `简约线条` / `蓝图` / `手绘` / `水彩` / `海报` / `温暖` / `极简` / `商务`。

| Type | 推荐渲染 |
|------|----------|
| architecture / process / comparison / mindmap / timeline | 技术文优先 **mermaid-render** |
| concept / whiteboard / data-viz / checklist / quote-card / scene / atmosphere | **AI 生图**（锁定 Style） |
| 产品界面、后台、官网、IDE | **real-capture**：搜图或用户截图，禁止 AI 假界面 |

渲染方式全文最多两种：例如「Mermaid + AI 生图」或「真实截图 + AI 生图」。Style 仍然只有一种。

兼容：流程/架构/对比 ↔ mermaid；场景/氛围 ↔ 生图；截图 ↔ real-capture。不要用 mermaid 画氛围，不要用生图假冒产品页。

## 计划表（写入草稿目录 `illustration-plan.md`）

```markdown
## 配图计划

**全文风格锁定：** Style = 扁平矢量 | 主色 = #4A90D9 | 辅色 = #FF6B35 | 背景 = 纯白
**渲染：** AI 生图 + mermaid-render（不超过两种）

| # | 位置 | Type | 渲染 | 内容（用稿里的词） | 必要性 |
|---|------|------|------|-------------------|--------|
| 0 | 封面 | cover | AI 生图 | … | 必要 |
| 1 | §2 标题后 | architecture | mermaid-render | … | 必要 |
| 2 | §4 对比段 | comparison | mermaid-render | … | 推荐 |
| 3 | §6 | scene | AI 生图 | … | 可选 |
```

锁定后写入 `imgs/prompts/style-anchor.md`，后续 prompt 末尾引用，中途不改 Style / 主色。

## 单张仍要遵守

- 图必须传递信息，不配装饰图。
- 图中字用中文短标签（3–5 字），不要长句。
- 产品页走真实截图：`search_images` → `save_web_image`，或请用户提供 PNG。
- Mermaid 见 [mermaid-path.md](mermaid-path.md)。
