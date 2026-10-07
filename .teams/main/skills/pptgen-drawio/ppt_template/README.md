# PPT 模板目录

将参考用的 `.pptx` 模板文件放入此目录。

- **预设模板**：可放置 `通用ppt模板1.pptx` ~ `通用ppt模板4.pptx` 等作为风格参考
- **自定义模板**：用户提供的模板（如 `my-template.pptx`）也放于此，便于 `scripts/analyze_pptx.py` 统一分析

分析命令示例：
```bash
python scripts/analyze_pptx.py ppt_template/我的模板.pptx reference/style-custom.md
```