---
description: 搜索 IMA 健康知识库，查找历史上传的检查报告和健康文档
agent: 健康向导
arguments:
  - name: query
    description: 搜索关键词（如：血常规、体检报告、2026年、心电图）
    required: true
  - name: kb
    description: 指定知识库名称（不填则搜索所有已关联健康知识库）
    required: false
  - name: type
    description: 过滤文件类型：lab/imaging/medication/all，默认 all
    required: false
---

# 搜索 IMA 健康知识库

通过 `ima-skill` 搜索 IMA 健康知识库中的历史检查报告和上传文档。

## 前提条件

- 已配置 IMA OpenAPI 凭证（IMA_OPENAPI_CLIENTID、IMA_OPENAPI_APIKEY）
- 已通过 `/analyze` 上传过至少一份检查报告
- 凭证位于 `.env` 或用户配置中

## 执行步骤

1. 确认 IMA 凭证已配置
2. 读取 `ima-skill/knowledge-base/SKILL.md` 了解搜索 API 调用方式
3. 调用 IMA 知识库搜索接口，传入 `query` 参数
4. 如指定 `kb`，则限定在特定知识库范围内搜索
5. 格式化搜索结果并展示

## 输出格式

```
🔍 搜索：[query]
📚 知识库：[知识库名称 / 全部]

找到 X 份相关文档：

1. [文件名] · [上传日期]
   摘要：[相关内容片段]
   
2. [文件名] · [上传日期]
   摘要：[相关内容片段]
```

## 凭证未配置时

如 IMA 凭证未配置，提示：
```
⚠️ IMA 凭证未配置，无法搜索知识库。
请在应用设置中配置：
  IMA_OPENAPI_CLIENTID = [您的 ClientID]
  IMA_OPENAPI_APIKEY   = [您的 APIKey]
```

## 示例

```
/search 血常规
/search 体检报告 2026
/search 心电图 --kb 健康档案
```

## 结合使用场景

- 就医前查找历史体检报告：`/search 血糖 2025`
- 生成报告时补充参考：`/report` 内部会调用此搜索
- 查找家人的检查记录：`/search 妈妈 心脏超声`
