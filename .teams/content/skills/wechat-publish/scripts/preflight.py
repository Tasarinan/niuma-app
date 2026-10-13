#!/usr/bin/env python3
"""稿件预检：标题/摘要/HTML 兼容性/配图，对齐微信公众号草稿限制。

用法（仓库根）：
  python .teams/content/skills/wechat-publish/scripts/preflight.py .artifacts/drafts/<主题>/
  python .teams/content/skills/wechat-publish/scripts/preflight.py DIR --require-html --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from title_bytes import (
    WECHAT_TITLE_MAX_BYTES,
    WECHAT_TITLE_MAX_CHARS,
    utf8_len,
)

_IMAGE_SCRIPTS = (
    Path(__file__).resolve().parent.parent.parent / "image-generator" / "scripts"
)
if str(_IMAGE_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_IMAGE_SCRIPTS))

try:
    from check_images import inspect_article_images
except Exception:  # noqa: BLE001
    inspect_article_images = None  # type: ignore[assignment]

_CN_RE = re.compile(r"[\u4e00-\u9fff]")
_TODO_RE = re.compile(r"\b(TODO|TBD|placeholder)\b", re.I)
_AI_LEFTOVER = ("source_report", "compliance_report", "信任度报告")
_WECHAT_IFRAME_OK = re.compile(
    r"(?:^|//)(?:[^/]*\.)?(?:weixin\.qq\.com|qq\.com)(?:/|$)",
    re.I,
)
_TABLE_RE = re.compile(r"<table\b[^>]*>(.*?)</table>", re.I | re.S)
_ROW_RE = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.I | re.S)
_CELL_RE = re.compile(r"<t[hd]\b", re.I)
_IFRAME_RE = re.compile(r"<iframe\b([^>]*)>", re.I)
_SRC_RE = re.compile(r"""src\s*=\s*['"]([^'"]+)['"]""", re.I)


def _load_yaml(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        import yaml
    except ImportError:
        return {}
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}
    return data if isinstance(data, dict) else {}


def _editorial_path() -> Path:
    candidates = [
        Path.cwd() / ".teams" / "content" / "editor" / "editorial.yaml",
        Path(__file__).resolve().parents[5] / ".teams" / "content" / "editor" / "editorial.yaml",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return candidates[0]


def lint_html(html: str) -> dict:
    """微信 HTML 兼容性检查。返回 {errors, warnings}。"""
    errors: list[str] = []
    warnings: list[str] = []
    low = html.lower()

    if "data:image" in low:
        errors.append("正文含 data:image（base64）。微信不收内嵌图片，请改为素材 URL 或 imgs/ 路径")
    if "tempkey=" in low or "tempkey%3d" in low:
        errors.append("正文含 tempkey 预览链。微信 draft/add 常返回 45166，请改用永久链接或去掉该链")
    if re.search(r"<script\b", html, re.I):
        errors.append("正文含 <script>。微信草稿不接受脚本标签")

    for m in _IFRAME_RE.finditer(html):
        attrs = m.group(1) or ""
        src_m = _SRC_RE.search(attrs)
        src = src_m.group(1).strip() if src_m else ""
        if not src or not _WECHAT_IFRAME_OK.search(src):
            errors.append(
                f"正文含非微信 iframe（src={src or '(空)'}）。仅允许微信/腾讯视频等 qq.com 域"
            )

    if re.search(r"position\s*:\s*(fixed|sticky)", html, re.I):
        warnings.append("正文使用 position:fixed/sticky，公众号阅读页可能被裁切或无效")
    if re.search(r"\bvar\s*\(", html, re.I):
        warnings.append("正文含 CSS var()，公众号内核支持不稳定，建议写成固定色值")
    if re.search(r"\bcalc\s*\(", html, re.I):
        warnings.append("正文含 CSS calc()，公众号内核支持不稳定")

    for table in _TABLE_RE.finditer(html):
        rows = _ROW_RE.findall(table.group(1))
        if not rows:
            continue
        cols = len(_CELL_RE.findall(rows[0]))
        if cols > 4:
            warnings.append(f"表格有 {cols} 列，手机阅读易挤成一团（建议 ≤4 列）")
            break

    for token in _AI_LEFTOVER:
        if token.lower() in low or token in html:
            warnings.append(f"正文残留流水线痕迹「{token}」，发布前应删掉")

    return {"errors": errors, "warnings": warnings}


def inspect_article(article_dir: Path, require_html: bool = False) -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    notes: list[str] = []
    article_dir = Path(article_dir)

    if not article_dir.is_dir():
        return {
            "ok": False,
            "errors": [f"目录不存在: {article_dir}"],
            "warnings": [],
            "notes": [],
        }

    meta = _load_yaml(article_dir / "article.yaml")
    title = str(meta.get("title") or "").strip()
    digest = str(meta.get("digest") or "").strip()

    if not title:
        errors.append(
            "article.yaml 缺少 title（微信草稿标题必填；UTF-8 ≤"
            f"{WECHAT_TITLE_MAX_BYTES} 字节，避免 45028）"
        )
    else:
        title_bytes = utf8_len(title)
        notes.append(f"标题 {len(title)} 字 / {title_bytes} UTF-8 字节")
        if title_bytes > WECHAT_TITLE_MAX_BYTES:
            errors.append(
                f"标题 {title_bytes} UTF-8 字节，超过微信 45028 上限 "
                f"{WECHAT_TITLE_MAX_BYTES}（按字节裁切，不要只数 25 字）"
            )
        elif len(title) > WECHAT_TITLE_MAX_CHARS:
            errors.append(
                f"标题 {len(title)} 字，超过微信字段上限 {WECHAT_TITLE_MAX_CHARS} 字"
            )

    if not digest:
        warnings.append("article.yaml 无 digest。推草稿时会从正文截 54 字，建议手写摘要")
    else:
        notes.append(f"摘要 {len(digest)} 字")
        if len(digest) > 120:
            errors.append(f"摘要 {len(digest)} 字，超过微信上限 120")
        elif len(digest) > 54:
            warnings.append(
                f"摘要 {len(digest)} 字。群发卡片常见展示约 54 字，超过部分可能被截断"
            )

    md_path = article_dir / "article.md"
    md_text = ""
    if md_path.is_file():
        md_text = md_path.read_text(encoding="utf-8")
        cn = len(_CN_RE.findall(md_text))
        notes.append(f"正文汉字约 {cn} 字")
        if cn > 20000:
            errors.append(f"正文汉字约 {cn} 字，超过微信正文上限约 20000")
        elif cn > 7200:
            warnings.append(f"正文汉字约 {cn} 字，超过常见可读篇幅 7200，建议拆篇或精简")
        if _TODO_RE.search(md_text):
            warnings.append("article.md 含 TODO / TBD / placeholder，发布前应替换")
        for token in _AI_LEFTOVER:
            if token in md_text:
                warnings.append(f"article.md 残留流水线痕迹「{token}」")
    else:
        errors.append(f"未找到 {md_path.name}")

    editorial = _load_yaml(_editorial_path())
    if editorial:
        raw_max = editorial.get("title_max_length")
        try:
            title_max = int(raw_max) if raw_max is not None and str(raw_max).strip() != "" else None
        except (TypeError, ValueError):
            title_max = None
        if title and title_max and len(title) > title_max:
            warnings.append(
                f"标题 {len(title)} 字，超过 editorial.yaml 的 title_max_length={title_max}"
            )
        forbidden = editorial.get("forbidden_words") or []
        if isinstance(forbidden, str):
            forbidden = [forbidden]
        hay = "\n".join([title, digest, md_text])
        hits = [w for w in forbidden if str(w).strip() and str(w) in hay]
        if hits:
            errors.append("命中 editorial.yaml forbidden_words: " + "、".join(str(h) for h in hits))

    html_path = article_dir / "article.html"
    if html_path.is_file():
        html = html_path.read_text(encoding="utf-8")
        lint = lint_html(html)
        errors.extend(lint["errors"])
        warnings.extend(lint["warnings"])
        notes.append("已检查 article.html")
    elif require_html:
        errors.append("未找到 article.html（--require-html）。请先跑 format.py")
    else:
        notes.append("尚无 article.html，已跳过 HTML 预检")

    if inspect_article_images is not None:
        img = inspect_article_images(article_dir)
        errors.extend(img.get("errors") or [])
        warnings.extend(img.get("warnings") or [])
        notes.extend(img.get("notes") or [])
    else:
        warnings.append("未能导入 check_images.py，已跳过配图预检")

    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "notes": notes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="微信稿件预检")
    parser.add_argument("article_dir", help="草稿目录")
    parser.add_argument("--require-html", action="store_true", help="缺少 article.html 视为错误")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    args = parser.parse_args()

    result = inspect_article(Path(args.article_dir), require_html=bool(args.require_html))
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["ok"] else 1
    for line in result["notes"]:
        print(f"[INFO] {line}")
    for line in result["warnings"]:
        print(f"[WARN] {line}")
    for line in result["errors"]:
        print(f"[ERROR] {line}", file=sys.stderr)
    if result["ok"]:
        print("[OK] 稿件预检通过")
        return 0
    print("[ERROR] 稿件预检未通过", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
