---
description: 管理个人在不同栏目下的写作风格（建立/查看/更新）以及素材去向
argument-hint: [setup|view|update|sources] [栏目或字段]
---

# 文风档案

应用在回复前写入 SQLite `content_profiles`（追加版本，不覆盖历史）。已有档案时写稿以它为准；没有档案时再用 `.teams/content/editor/editorial.yaml`。

档案是一张固定表。每一项只能是列出的选项，不能改成别的句子。

## 固定字段

选栏目后整表写入：

| 字段 | 选项 |
|------|------|
| 栏目 | 乾坤AI路书 / FDE日记 / AI外网 |
| 类别 | AI / 技术 / 中医诊所 / 教育 |
| 语气 | 轻松口语 |
| 读者 | 大众读者 |
| 写法 | 口语 |
| 段落 | 长短交替 |
| 小标题 | 按需 |
| 标题类型 | 干货 / 数字 / 悬念 / 情感 / 对比 / 故事 / 反问 |
| 标题字数 | 25 |
| 篇幅 | 1800-2500 |
| 署名 | 乾坤AI容我懒 |
| 禁用词 | 赋能、闭环 |
| 选题 | 随栏目：工具怎么用、何时不用 / 医问安做成这样的取舍 / 外网刚发生的事和读者有什么关系 |

可以改的是栏目、类别、标题类型。其余字段不能改成表外的话。

## 操作类型

### setup

- `/style setup` 只列出这张表，不写空档案
- `/style setup 乾坤AI路书`、`FDE日记`、`AI外网` 写入整张表
- 贴一段文字时，归入最接近的栏目，字段仍用上表

### view

按固定字段逐行展示。缺的项显示「未填」。

### update

只改一项，值必须在选项里。其余字段保留。写入新一条档案（保留历史）。

### sources

| 操作 | 示例 |
|------|------|
| 放到目录 | `/style sources 目录` |
| 指定目录 | `/style sources 目录 .artifacts/scraps` |
| 放到 IMA | `/style sources ima` |
| 指定 IMA | `/style sources ima <知识库ID> <文件夹ID>` |
| 添加网址 | `/style sources add https://example.com/feed` |
| 查看 | `/style sources` |

## 示例

```
/style setup
/style setup 乾坤AI路书
/style update 标题类型 悬念
/style view
```
