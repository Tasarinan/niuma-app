---
description: 快速记录日常健康数据（症状/饮食/睡眠/情绪/用药），存入本地数据库
agent: 健康向导
arguments:
  - name: type
    description: 记录类型：symptom(症状)/diet(饮食)/sleep(睡眠)/mood(情绪)/medication(用药)/note(备注)
    required: true
  - name: content
    description: 记录内容（自然语言描述）
    required: false
  - name: member
    description: 记录对象（默认本人，可指定家庭成员姓名）
    required: false
---

# 快速健康记录

将日常健康数据快速存入本地 SQLite 数据库，无需上传至 IMA。

## 记录类型详解

### symptom — 症状记录

记录身体不适，支持自然语言描述。

**示例：**
```
/record symptom 头疼，从今天早上开始，程度轻微
/record symptom 发烧38度，伴咳嗽
/record symptom 胃痛 --member 妈妈
```

**自动提取：** 症状名称、严重程度、开始时间、持续时长、伴随症状

### diet — 饮食记录

记录餐食内容，支持图片（上传图片后 AI 自动识别）。

**示例：**
```
/record diet 午餐 米饭+鸡胸肉+西兰花
/record diet 早餐 燕麦片+牛奶
/record diet （附图发送，AI 自动识别）
```

### sleep — 睡眠记录

**示例：**
```
/record sleep 7.5小时 质量还好
/record sleep 6小时 入睡困难，多梦
```

### mood — 情绪记录

**示例：**
```
/record mood 平稳 工作顺利
/record mood 焦虑 工作压力较大
/record mood 低落 原因不明
```

### medication — 用药记录

**示例：**
```
/record medication 服用降压药 氨氯地平 5mg
/record medication 止痛药 布洛芬 0.4g 饭后
```

### note — 健康备注

任意健康相关备注。

**示例：**
```
/record note 今天做了核酸检测
/record note 复诊预约 8月15日 心内科
```

## 执行步骤

1. 解析 `type` 和 `content`，确定对应本地 DB 记录类型
2. 查找或创建对应的 `person_id`（默认本人）
3. 调用 `createHealthRecord` 写入 `health_records`
4. 如有量化数据（发烧度数、睡眠时长等），同时写入 `health_observations`
5. 输出简短确认

## 批量记录

用逗号或换行分隔多条记录：
```
/record symptom 头疼; diet 午餐 清淡; sleep 8小时
```

## 输出格式

```
✅ 已记录 [类型] — [简短摘要]
📅 [日期时间] | 👤 [成员]
```
