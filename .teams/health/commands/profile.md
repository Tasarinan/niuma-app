---
description: 管理个人和家庭成员健康档案（建立/查看/更新）
argument-hint: [setup|view|update|add-member] [member]
---

# 个人与家庭健康档案管理

管理本地数据库中的 `health_people` 档案，无需上传至 IMA，所有档案数据留在本地。

## 操作类型

### setup — 首次建档（本人）

Agent 向用户依次收集以下信息（可一次性提供，也可逐步填写）：

**必填：**
- 姓名/昵称
- 出生日期（YYYY-MM-DD）
- 性别（M/F）
- 身高（cm）
- 体重（kg）
- 药物过敏史（无则填"无"）
- 重大疾病史（无则填"无"）
- 长期用药（无则填"无"）

**建议填写：**
- 健康目标（如：减重/控糖/改善睡眠）
- 吸烟情况（不吸/已戒/吸烟）
- 饮酒情况（不饮/偶尔/经常）
- 平均睡眠时长（小时）
- 每周运动频次（次）
- 直系亲属慢病史（高血压/糖尿病/冠心病/肿瘤等）

**执行步骤：**
1. 调用前端 `getOrCreateSelfPerson()` 获取或创建本人档案
2. 将收集到的字段写入本地 `health_records`（type=profile）的 `structured_json`
3. 确认保存成功，输出档案摘要
4. 提示下一步：`/analyze` 上传检查报告，`/record` 记录日常健康

### view — 查看档案

读取本地 `health_records`（type=profile）最近一条记录，格式化展示。
如包含多个家庭成员，按成员分组展示。

### update — 更新档案

用户指定要更新的字段，仅修改对应字段，其余保留。
写入新一条 profile 记录（保留历史，不覆盖）。

### add-member — 添加家庭成员

收集家庭成员信息（同 setup 字段），指定 relation：
- spouse（配偶）
- parent（父/母）
- child（子/女）
- other（其他）

调用 `createHealthPerson({ name, relation, ... })` 写入本地数据库。

## 示例

```
/profile setup
/profile view
/profile update 体重 68
/profile add-member parent 妈妈 1965-05-12 F
```

## 输出示例

```
✅ 档案已保存
👤 姓名：张三 | 男 | 36岁 | 身高 175cm | 体重 70kg | BMI 22.9
🎯 健康目标：改善睡眠、适度减重
⚠️ 过敏史：青霉素
💊 长期用药：无
下一步：用 /analyze 上传最近的体检报告，或用 /record 开始记录日常健康数据。
```
