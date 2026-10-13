---
description: 根据 .artifacts/scraps 写日报或月报，并建议可成稿题目
argument-hint: [daily|month|week]
---

# 采集报告

应用已从 `content_entries` 取出对应范围的记录并注入对话。再读 `.artifacts/scraps` 里已采集的材料，写成报告。不要创建草稿目录。

## 执行步骤

1. `/digest` 或 `/digest daily`：读当天 scraps，写入 `daily-report.md`，回复展示全文
2. `/digest month`：读本月 scraps，写入 `monthly-report.md`。报告条目用与 `/scrap` 相同的统一模板（Time / Heat / Deep Dive）
3. `/digest week`：近 7 天条目列表报，不必另写 report 文件
4. 没有采集就写「今日无采集」或「本月无采集」
5. 最多建议 3 个可成稿题目
6. 不要创建草稿目录
7. 公众号涨粉/阅读走 `/ops` 或 `/digest wechat`，不要和采集早报混在一起

## 示例

```
/digest
/digest daily
/digest month
```
