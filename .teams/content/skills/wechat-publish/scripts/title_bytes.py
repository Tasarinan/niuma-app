#!/usr/bin/env python3
"""微信草稿标题：按 UTF-8 字节卡 45028，而不是只数「25 字」。

官方字段说明常写「不超过 64 个字」。实际 draft/add 对中文更严：
每个汉字 3 字节，超 96 UTF-8 字节会返回 45028（title size out of limit）。
文风 `title_max_length`（默认 25 字）仍是建议，不能代替字节上限。
"""

from __future__ import annotations

import argparse
import json
import re
import sys

WECHAT_TITLE_MAX_BYTES = 96
WECHAT_TITLE_MAX_CHARS = 64
WECHAT_TITLE_LIMIT_ERRCODES = frozenset({45028})
_PUNCT_STRIP = " ，,：:；;、"


def utf8_len(text: str) -> int:
    return len(text.encode("utf-8"))


def normalize_title_for_wechat(title: str) -> str:
    replacements = {
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
        "—": "-",
        "–": "-",
        "，": ",",
        "：": ":",
        "；": ";",
        "（": "(",
        "）": ")",
    }
    for old, new in replacements.items():
        title = title.replace(old, new)
    return re.sub(r"\s+", " ", title).strip()


def trim_title_to_wechat_limit(
    title: str, max_bytes: int = WECHAT_TITLE_MAX_BYTES
) -> str:
    if utf8_len(title) <= max_bytes:
        return title
    buf: list[str] = []
    current = 0
    for ch in title:
        size = len(ch.encode("utf-8"))
        if current + size > max_bytes:
            break
        buf.append(ch)
        current += size
    trimmed = "".join(buf).rstrip(_PUNCT_STRIP)
    return trimmed or title[:1]


def title_candidates_for_draft(title: str) -> list[str]:
    normalized = normalize_title_for_wechat(title)
    seen: set[str] = set()
    out: list[str] = []
    for raw in (
        normalized,
        trim_title_to_wechat_limit(normalized, WECHAT_TITLE_MAX_BYTES),
        trim_title_to_wechat_limit(normalized, 72),
        trim_title_to_wechat_limit(normalized, 60),
        trim_title_to_wechat_limit(normalized, 48),
        trim_title_to_wechat_limit(normalized, 36),
    ):
        candidate = raw.strip()
        if candidate and candidate not in seen:
            out.append(candidate)
            seen.add(candidate)
    return out


def is_title_limit_response(data: dict | None) -> bool:
    if not isinstance(data, dict):
        return False
    errcode = data.get("errcode")
    if isinstance(errcode, int) and errcode in WECHAT_TITLE_LIMIT_ERRCODES:
        return True
    errmsg = str(data.get("errmsg") or "").lower()
    return any(
        marker in errmsg
        for marker in ("title size out of limit", "title out of limit")
    )


def describe_title_limit(title: str) -> dict[str, int | str | bool]:
    chars = len(title)
    bytes_ = utf8_len(title)
    return {
        "title": title,
        "chars": chars,
        "utf8_bytes": bytes_,
        "max_bytes": WECHAT_TITLE_MAX_BYTES,
        "max_chars": WECHAT_TITLE_MAX_CHARS,
        "over_bytes": bytes_ > WECHAT_TITLE_MAX_BYTES,
        "over_chars": chars > WECHAT_TITLE_MAX_CHARS,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="微信标题 UTF-8 字节裁切（45028）")
    parser.add_argument("title", nargs="?", default="", help="待检查标题")
    parser.add_argument("--trim", action="store_true", help="输出裁切后的标题")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        assert utf8_len("中") == 3
        assert utf8_len("A") == 1
        forty = "中" * 40
        trimmed = trim_title_to_wechat_limit(forty)
        assert utf8_len(trimmed) <= WECHAT_TITLE_MAX_BYTES
        assert len(trimmed) == 32
        assert trim_title_to_wechat_limit("短标题") == "短标题"
        punct = trim_title_to_wechat_limit(("中" * 31) + "：再写")
        assert not punct.endswith("：")
        assert is_title_limit_response({"errcode": 45028, "errmsg": "title size out of limit"})
        print("ok")
        return 0

    title = args.title
    info = describe_title_limit(title)
    trimmed = trim_title_to_wechat_limit(title)
    if args.json:
        print(
            json.dumps(
                {**info, "trimmed": trimmed, "candidates": title_candidates_for_draft(title)},
                ensure_ascii=False,
            )
        )
        return 0
    if args.trim:
        print(trimmed)
        return 0
    print(f"{info['chars']} 字 / {info['utf8_bytes']} UTF-8 字节（上限 {WECHAT_TITLE_MAX_BYTES}）")
    return 1 if info["over_bytes"] or info["over_chars"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
