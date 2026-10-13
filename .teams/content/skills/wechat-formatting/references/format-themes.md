# 排版主题（编辑器）

主题 YAML 已迁至内容团队编辑器目录，不再放在本 skill 下：

- 内置：`.teams/content/editor/themes/builtin/<id>.yaml`
- 自定义：`.teams/content/editor/themes/custom/<id>.yaml`

应用内预览与 `scripts/format.py` 共用上述路径。列出主题：`python scripts/format.py --list-themes`。

`macaron-*` / `wenyan-*` / `shuimo-default` 从 wechat-auto-writer 的嵌套 YAML 转成 format.py 的 CSS 字符串。重转：`python .teams/content/editor/themes/convert_auto_writer_themes.py`。编辑栏「排版样式」选 id，例如 `macaron-blue`、`wenyan-lapis`。
