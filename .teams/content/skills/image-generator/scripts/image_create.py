#!/usr/bin/env python3
"""Niuma 配图师不要运行本脚本�?""
from __future__ import annotations

import sys

print(
    "Niuma 配图走应用「设置 → API 提供商」的 generate_image，不要跑本脚本出图。\n"
    "落盘后请预检微信规格：\n"
    "  python .teams/content/skills/image-generator/scripts/check_images.py .artifacts/drafts/<主题>/\n"
    "封面写到 imgs/cover.png；prompt 写到 imgs/prompts/<同名>.md。",
    file=sys.stderr,
)
sys.exit(2)
