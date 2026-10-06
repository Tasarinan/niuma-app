---
name: article-assets
description: 素材落盘｜预设包、业务图库、IMA �?预设合并�?teams/content/presets，业务图�?products。触发词：「导入预设」「保存到 IMA」「存起来」�?
homepage: https://github.com/Tasarinan/niuma-app
---

# 素材（发行）

你是发行。加�?`article-assets`

## 目录约定

| 用�?| 路径 |
|------|------|
| 草稿正文/配图 | `.niuma/artifacts/drafts/<YYYYMMDD-主题>/` |
| **团队预设** | `.niuma/teams/content/presets/` |
| 团队文风配置 | `.niuma/teams/content/presets/editorial.yaml` |
| 业务资料�?| `.niuma/teams/content/products/{产品名}/` |
| 微信凭证 | 工作�?`.env.local`（`WECHAT_N_*`，勿写入聊天�?|

### presets 子目录（�?`format.py`、编辑器块预设一致）

- `formatting/` �?排版主题 YAML（`format.py --theme`、编辑器「排版样式」）
- `closing-blocks/` �?文末�?
- `article-blocks/` �?编辑器结构块（引语、栏目分隔等�?
- `cover-styles/`、`image-styles/`、`title-styles/`、`structures/`、`sticker-styles/` �?其它预设

自定义排版主题：�?`presets/formatting/` 新建 `.yaml` 即可，见 formatting skill �?`references/presets/README.md`�?

## 导入 `.aws` 预设�?

合并�?**`.niuma/teams/content/presets/<子目�?/`**，不再使�?`.aws-article/presets/`�?

```bash
python .niuma/teams/content/skills/article-assets/scripts/import_presets_aws.py path/to/bundle.aws
python .niuma/teams/content/skills/article-assets/scripts/import_presets_aws.py path/to/bundle.aws --dry-run
```

- 包内某预设子目录存在 �?**先清空本地同名目�?*再写入（包内没有的子目录不动�?
- 包内 `config.yaml`：本地尚无团�?config 时复制到 `.niuma/teams/content/presets/editorial.yaml`；已有则 stdout 输出 JSON 差异，不自动覆盖
- 微信 AppID/Secret 可增量写�?`.env.local`�?*不写**写作/生图 API Key

## 业务图入�?

```bash
python .niuma/teams/content/skills/article-assets/scripts/product_image_ingest.py path/to/a.png \
  --product 产品�?--stem 中文文件�?
```

写入 `.niuma/teams/content/products/{产品名}/images/`，并生成同名 `.md` 描述�?

## IMA

用户已配置知识库时，按现�?IMA 导入路径保存；未配置则只本地保存并说明去编辑器配置。不要把密钥写入草稿目录�?
