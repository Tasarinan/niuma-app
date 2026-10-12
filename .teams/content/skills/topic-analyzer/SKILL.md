---
name: topic-analyzer
description: 根据已有素材做周月汇总、拆角度、拟标题。当用户使用 /digest、/propose，或问这些材料能写成哪几篇时使用。不定题、不建草稿目录。
---

# 选题分析器

从已注入的素材里拆出可写题目。不定题、不落盘。

## 核心功能

### 1. 素材汇总
- 统计近 7 天或 30 天的 `content_entries` 条数与类型
- 列表报：日期、类型、摘要、来源
- 最多给出 3 个可成稿题目

### 2. 主题提案
- 最多 5 个主题：题目、为什么现在写、引用的记录 id 或网址
- 本地不够或用户丢来新想法时，改走 `topic-research`，不要假装搜过网
- 不定最终标题。素材不够时写「建议再聊」或请用户 `/outline <想法>`

### 3. 可行性判断
- 丢掉没有 URL 的 Feed 条目
- `feed status: error` 时说明原因，不要编造

## 使用说明

### 触发条件

当用户提到以下场景时，使用此技能：

- ✅ `/digest` 周/月汇总
- ✅ `/propose` 出主题
- ✅ 「这些材料能写成哪几篇」

### 执行步骤

#### 步骤 1: 确认数据源
`/digest` 只使用已注入的 `content_entries`、中央 Feed、IMA。
用户给了新想法或本地不够时，加载 `topic-research` 上网查。

#### 步骤 2: 按命令产出
- `/digest`：汇总 → 最多 3 个可成稿题目 → 停，等人
- `/propose`：最多 5 个主题（不定最终标题）→ 停，等人 `/outline`

#### 步骤 3: 不要落盘
不要创建 `.artifacts/drafts/`，不要写 `article.md`。定题是用户的事。

输出格式见 [references/output-format.md](references/output-format.md)。

## 数据源

| 数据源 | 位置 | 内容 |
|--------|------|------|
| 日常素材 | 对话注入的 `content_entries` | idea / note / 摘录 |
| 中央 Feed | 对话注入 | 已登记网址的条目 |
| IMA | 对话注入 | 知识库摘录 |
| 输出样例 | `references/output-format.md` | digest / propose 模板 |

## 安全与合规

- ❌ 不建目录、不写正文、不定最终标题
- ❌ 不编造无来源的 Feed 或数字
- ✅ 没有 URL 的 Feed 条目丢掉
- ✅ 需要上网时交给 `topic-research`

## 相关命令

- `/digest` — 周/月汇总
- `/propose` — 提出写作主题
- `/outline` — 写初稿（本技能不要执行）
