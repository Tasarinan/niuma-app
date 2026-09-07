#!/usr/bin/env python3
"""Niuma 写手不要运行本脚本。"""
from __future__ import annotations

import sys

print(
    "Niuma 写稿走应用「设置 → API 提供商」。\n"
    "文风读 .niuma/teams/content/config.yaml。\n"
    "不要读 .aws-article/config.yaml，不要设置 WRITING_MODEL_API_KEY。\n"
    "请用 read / write / edit 改当前草稿目录的 article.md。",
    file=sys.stderr,
)
sys.exit(2)
