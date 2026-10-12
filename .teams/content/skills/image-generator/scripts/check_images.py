#!/usr/bin/env python3
"""微信配图预检。规格对齐 main/skills/wechat-article-writer（封面/正文体积与比例）。

封面：JPG/PNG，< 10MB；推荐 2.35:1（900×383）或合并封面 1283×383。
正文：JPG/PNG/GIF，< 2MB；推荐 4:3（1200×900）或宽 1080。
微信素材不收 webp / jfif。

用法（仓库根）：
  python .teams/content/skills/image-generator/scripts/check_images.py .artifacts/drafts/<主题>/
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

COVER_MAX_BYTES = 10 * 1024 * 1024
CONTENT_MAX_BYTES = 2 * 1024 * 1024
COVER_EXTS = {".png", ".jpg", ".jpeg"}
CONTENT_EXTS = {".png", ".jpg", ".jpeg", ".gif"}
REJECT_EXTS = {".webp", ".jfif", ".avif"}
COVER_NAMES = ("cover.png", "cover.jpg", "cover.jpeg")

# wechat-article-writer cover_guide.md
COVER_TARGETS = (
    (1283, 383, "合并封面（左 900 大封面 + 右 383 小封面）"),
    (900, 383, "大封面 2.35:1"),
    (900, 500, "wechat-mp-auto 900x500"),
    (383, 383, "小封面 1:1"),
    (1080, 608, "16:9 约 1080×608"),
    (1080, 1080, "1:1 1080"),
)
ILLUSTRATION_TARGETS = (
    (1200, 900, "正文 4:3"),
    (1920, 1080, "正文 16:9"),
    (1080, 1080, "正文 1:1"),
    (1080, 0, "正文宽约 1080"),
)


def _ratio(w: int, h: int) -> float:
    return w / h if h else 0.0


def _near_target(w: int, h: int, tw: int, th: int, tol: float = 0.08) -> bool:
    if tw <= 0 or th <= 0:
        if tw > 0:
            return abs(w - tw) / tw <= 0.12
        return False
    return abs(_ratio(w, h) - _ratio(tw, th)) <= tol


def _image_size(path: Path) -> tuple[int, int] | None:
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        with Image.open(path) as img:
            return img.size
    except Exception:
        return None


def _find_cover(article_dir: Path) -> Path | None:
    for name in COVER_NAMES:
        p = article_dir / name
        if p.is_file():
            return p
    imgs = article_dir / "imgs"
    if not imgs.is_dir():
        return None
    for name in COVER_NAMES:
        p = imgs / name
        if p.is_file():
            return p
    for sfx in COVER_EXTS:
        cands = sorted(imgs.glob(f"*-cover{sfx}"))
        if cands:
            return cands[0]
    return None


def _list_content_images(article_dir: Path, cover: Path | None) -> list[Path]:
    imgs = article_dir / "imgs"
    if not imgs.is_dir():
        return []
    out: list[Path] = []
    for p in sorted(imgs.iterdir()):
        if not p.is_file():
            continue
        if p.name.startswith(".") or p.stem.endswith("_compressed"):
            continue
        if cover and p.resolve() == cover.resolve():
            continue
        if p.suffix.lower() in CONTENT_EXTS | REJECT_EXTS | {".drawio"}:
            out.append(p)
    return out


def inspect_article_images(article_dir: Path) -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    notes: list[str] = []
    article_dir = article_dir.resolve()

    cover = _find_cover(article_dir)
    if cover is None:
        errors.append("未找到封面：cover.png / cover.jpg，或 imgs/cover.* / imgs/*-cover.*")
    else:
        ext = cover.suffix.lower()
        size = cover.stat().st_size
        notes.append(f"封面 {cover.relative_to(article_dir)} ({size / 1024:.0f}KB)")
        if ext in REJECT_EXTS:
            errors.append(f"封面是 {ext}，微信素材不收。请导出 PNG 或 JPG")
        elif ext not in COVER_EXTS:
            errors.append(f"封面格式须为 PNG/JPG，当前 {ext}")
        if ext == ".gif":
            errors.append("封面不能用 GIF")
        if size > COVER_MAX_BYTES:
            errors.append(f"封面超过 10MB（{size / 1024 / 1024:.1f}MB），微信永久素材上限 10MB")
        dim = _image_size(cover)
        if dim:
            w, h = dim
            notes.append(f"封面尺寸 {w}×{h}")
            if min(w, h) < 300:
                warnings.append(f"封面 {w}×{h} 太小，公众号小图预览会糊（建议至少 900×383 或 1283×383）")
            elif not any(_near_target(w, h, tw, th) for tw, th, _ in COVER_TARGETS):
                warnings.append(
                    f"封面 {w}×{h} 不接近公众号常用规格："
                    "合并封面 1283×383、大封面 900×383、wechat-mp-auto 900×500、小封面 383×383、16:9 或 1:1"
                )
        elif size:
            warnings.append("未安装 Pillow，无法校验封面宽高（pip install Pillow）")

    for img in _list_content_images(article_dir, cover):
        ext = img.suffix.lower()
        rel = img.relative_to(article_dir)
        if ext == ".drawio":
            png = img.with_suffix(".png")
            jpg = img.with_suffix(".jpg")
            if not png.is_file() and not jpg.is_file():
                warnings.append(f"{rel} 尚未导出 PNG/JPG（可用 draw.io 导出 2x）")
            continue
        size = img.stat().st_size
        if ext in REJECT_EXTS:
            errors.append(f"正文图 {rel} 是 {ext}，请改为 PNG/JPG/GIF")
            continue
        if ext not in CONTENT_EXTS:
            warnings.append(f"正文图 {rel} 格式 {ext}，微信建议 PNG/JPG/GIF")
        if size > CONTENT_MAX_BYTES:
            warnings.append(
                f"正文图 {rel} 为 {size / 1024:.0f}KB，超过 2MB 建议；"
                "publish.py 上传前会压到约 1MB"
            )
        dim = _image_size(img)
        if dim:
            w, h = dim
            if w < 400:
                warnings.append(f"正文图 {rel} 宽 {w}px，公众号里可能发糊（建议约 1080 或 1200×900）")

    return {
        "ok": not errors,
        "cover": str(cover) if cover else "",
        "errors": errors,
        "warnings": warnings,
        "notes": notes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="检查草稿目录配图是否符合微信公众号素材限制")
    parser.add_argument("article_dir", help="草稿目录，例如 .artifacts/drafts/20261011-主题")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    args = parser.parse_args()
    article_dir = Path(args.article_dir)
    if not article_dir.is_dir():
        print(f"[ERROR] 目录不存在: {article_dir}", file=sys.stderr)
        return 1
    result = inspect_article_images(article_dir)
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
        print("[OK] 配图预检通过")
        return 0
    print("[ERROR] 配图预检未通过，修好后再排版/推草稿箱", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
