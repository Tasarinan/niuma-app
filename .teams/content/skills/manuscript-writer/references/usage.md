# 写手用法（Niuma）

写稿走系统 API 提供商的文字模型，用 `read` / `write` / `edit` 改当前 `.artifacts/drafts/<YYYYMMDD-主题>/article.md`。

文风先用对话注入的 `content_profiles`。没有档案时再读 `.teams/content/editor/editorial.yaml`（对话里的 `[内容团队配置]`）。本篇标题、作者、摘要只改同目录 `article.yaml`。

- 正式稿就是 `article.md`，不要另写 `draft.md`
- 聊天 `/outline` 先定主题再写初稿；后补材料必须贴题。标题按正文后改，改标题不改主题。补事实、加长、配图在编辑栏做
- 先 `read` 磁盘上的最新稿，再改用户点名的段落
