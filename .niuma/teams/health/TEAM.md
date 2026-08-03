---
schemaVersion: v1
id: health
name: 健康
legacyNames: ["家庭健康团队"]
description: 个人与家庭健康管理频道。所有操作通过命令和技能完成，无复杂 UI。检查报告等附件上传至 IMA 健康知识库，日常记录与 AI 解读保存到本地数据库。
eyebrow: 个人 · 家庭 · 全生命周期
avatar: ❤️
accent: emerald
kind: chat
commandDir: teams/health/commands
defaultCommand: record
defaultAgent: guide
dataDomain: healthbook
surface: default
skillSlugs:
  - ima-skill
---

# 健康

> 所有操作通过 `/命令` 和技能完成，无需复杂界面。
> **附件**（检查报告、影像、处方）→ 上传至 IMA 健康知识库
> **日常记录 + AI 解读** → 保存到本地 SQLite 数据库

## 成员

| Agent | 职责 |
|-------|------|
| `guide` | 健康向导（默认），管理档案、日常问答、命令路由 |
| `analyst` | 检查报告分析师，解读检验/影像，协调 IMA 上传 |
| `nutritionist` | 营养饮食顾问，饮食记录与分析 |
| `mental` | 身心健康顾问，睡眠、情绪、心理 |
| `doctor` | 全科医生，慢病管理、综合报告、就医建议 |

## Commands

### 核心命令（新版）
- profile-v2
- record
- analyze
- report-v2
- search

### 旧版命令（保留兼容）
- profile
- report
- symptom
- diet
- sleep
- mood
- medication

## Agents
- guide.md
- analyst.md
- nutritionist.md
- mental.md
- doctor.md