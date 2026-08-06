---
description: 生成个人或家庭成员健康报告摘要，综合本地记录并可检索 IMA 知识库历史资料
agent: 全科医生
arguments:
  - name: range
    description: 时间范围：month(近30天)/quarter(近90天)/year(近1年)/all(全部)，默认 month
    required: false
  - name: member
    description: 指定家庭成员（默认本人）
    required: false
  - name: focus
    description: 重点关注的方面：symptoms/diet/sleep/mood/lab，默认全部
    required: false
---

# 健康报告

从本地 SQLite 数据库查询指定时间范围的健康记录，生成可读性报告。

## 执行步骤

1. 确定 `person_id`（默认本人，或指定成员）
2. 查询 `health_records` 指定时间范围内的所有记录
3. 按记录类型分组统计（symptom/diet/sleep/mood/lab_report 等）
4. 汇总 `health_ai_interpretations` 中的异常项目
5. （可选）通过 `ima-skill` 搜索健康知识库，获取历史检查报告参考
6. 生成结构化报告并输出

## 输出格式

```
## 🏥 健康报告
👤 [成员] · 📅 [时间范围] · 生成于 [日期]

---

### 基础信息
年龄 [X] 岁 | BMI [X] | 健康目标：[目标]

---

### 记录统计
| 类型     | 记录数 | 最近一条               |
|---------|-------|----------------------|
| 症状记录  | X 条  | [日期] [摘要]          |
| 饮食记录  | X 条  | [日期] [摘要]          |
| 睡眠记录  | X 条  | 平均 [X] 小时/天        |
| 情绪记录  | X 条  | 最近状态：[摘要]         |
| 检查报告  | X 份  | [日期] [类型]          |

---

### ⚠️ 需关注项目
[列出检查异常值、频繁出现的症状、睡眠质量趋势等]

---

### 就医建议
[基于记录的非诊断性建议，说明何时应就医]

---

### 下一步行动
1. [具体建议]
2. [具体建议]

---
*本报告基于本地记录自动生成，仅供参考，请咨询医生获取专业建议。*
```

## 就医前摘要模式

输入 `/report visit` 生成就医前快速摘要：
- 近期主要症状时间线
- 近期检查异常值汇总
- 当前长期用药清单
- 过敏史提醒

## 示例

```
/report
/report quarter --member 妈妈
/report --focus lab
/report visit
```
