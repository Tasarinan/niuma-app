# 发布前检查清单

在审稿通过后、实际提交前执行，确保可安全发布。

## 检查项

- [ ] 标题、摘要、作者已最终确认
- [ ] 正文无未替换的占位符或草稿标记
- [ ] 敏感词与错别字已在审稿中修正
- [ ] 封面图已就绪：`cover.png`/`cover.jpg`，PNG 或 JPG，小于 10MB（不要 webp）
- [ ] 封面比例接近 1283×383（合并）、900×383、900×500 或 1:1；可用 `image-generator/scripts/prepare_cover.py` 居中裁切
- [ ] 正文内图片齐全，PNG/JPG/GIF，建议小于 2MB；`.drawio` 已导出 PNG
- [ ] 已跑 `check_images.py` 或 `publish.py check-images`
- [ ] 已跑 `preflight.py` 或 `publish.py preflight DIR`（标题 ≤64、摘要、HTML 无 tempkey/data:image/script）
- [ ] 原创/转载标注已按配置处理
- [ ] 文末引导区块已就位
- [ ] 如需开启评论/仅粉丝可评，已确认设置

全部勾选后执行提交步骤。
