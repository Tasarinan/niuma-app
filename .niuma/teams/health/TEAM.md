---
schemaVersion: v1
id: health
name: 健康
description: 个人与家庭全生命周期健康管理。通过 AI 智能体协同完成体检报告解读、饮食营养分析、睡眠情绪追踪、慢病管理和就医建议，所有数据本地留存，检查附件同步 IMA 知识库。
eyebrow: 体检 · 营养 · 心理 · 慢病
avatar: ❤️
accent: emerald
kind: chat
commandDir: teams/health/commands
defaultCommand: record
defaultAgent: guide
dataDomain: healthbook
surface: default
skillSlugs:
  - ai-analyzer
  - nutrition-analyzer
  - sleep-analyzer
  - mental-health-analyzer
  - health-trend-analyzer
  - fitness-analyzer
  - goal-analyzer
  - tcm-constitution-analyzer
  - emergency-card
---

# 健康团队

> 个人与家庭健康的全能助手。所有操作通过 `/命令` 和技能完成。
> **附件**（体检报告、影像、处方）→ IMA 健康知识库
> **日常记录 + AI 解读** → 本地数据库，随时回溯

## 智能体

| Agent | 文件 | 职责 |
|-------|------|------|
| 健康向导 | `guide.md` | **默认智能体**。接收日常问题、路由命令、维护健康档案摘要 |
| 报告分析师 | `analyst.md` | 体检报告 / 影像报告 AI 解读，提取异常指标，给出参考意见 |
| 营养顾问 | `nutritionist.md` | 饮食记录与营养分析，BMI / 热量追踪，个性化膳食建议 |
| 身心顾问 | `mental.md` | 睡眠质量追踪、情绪日记、减压建议，必要时转介专业支持 |
| 全科医生 | `doctor.md` | 综合健康评估，慢病（高血压/糖尿病/高血脂）管理，就医优先级建议 |

## 技能（Skills）

| Skill | 用途 |
|-------|------|
| `ai-analyzer` | 通用健康报告图片 AI 分析（调用 /analyze 命令的后端） |
| `nutrition-analyzer` | 食物营养成分查询与每日摄入分析 |
| `sleep-analyzer` | 睡眠数据解读，检测睡眠障碍风险 |
| `mental-health-analyzer` | 情绪与压力评估，PHQ-9 / GAD-7 自评辅助 |
| `health-trend-analyzer` | 多次体检数据趋势对比，识别异常变化 |
| `fitness-analyzer` | 运动量与体能分析，生成锻炼计划建议 |
| `goal-analyzer` | 健康目标设定与进度追踪（减重、控糖等） |
| `tcm-constitution-analyzer` | 中医体质辨识（九种体质），给出调养建议 |
| `emergency-card` | 生成随身急救信息卡（血型、过敏史、紧急联系人） |

## 命令（Commands）

| 命令 | 文件 | 说明 |
|------|------|------|
| `/profile` | `profile.md` | 查看或更新个人健康档案（年龄、既往史、过敏史、常用药） |
| `/record` | `record.md` | **默认命令**。快速录入健康数据（血压、血糖、体重、症状、饮食） |
| `/analyze` | `analyze.md` | 上传体检报告图片，AI 自动解读并存档 |
| `/report` | `report.md` | 生成周期健康报告（日/周/月），可导出 PDF |
| `/search` | `search.md` | 在 IMA 健康知识库中搜索历史报告或健康笔记 |