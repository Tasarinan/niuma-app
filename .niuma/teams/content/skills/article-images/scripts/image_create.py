#!/usr/bin/env python3
"""Niuma 配图师不要运行本脚本。"""
from __future__ import annotations

import sys

print(
    "Niuma 配图走应用「设置 → API 提供商」的 generate_image。\n"
    "封面比例读 .niuma/teams/content/config.yaml 的 cover_aspect。\n"
    "不要读 .aws-article/config.yaml，不要设置 IMAGE_MODEL_API_KEY。\n"
    "图片写到当前草稿目录 imgs/，prompt 写 imgs/prompts/<同名>.md。",
    file=sys.stderr,
)
sys.exit(2)
