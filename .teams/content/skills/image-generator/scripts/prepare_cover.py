#!/usr/bin/env python3
"""把封面图居中裁到目标比例再缩放。默认 PNG（源为 JPG 或 --jpeg 时出 JPEG）。

尺寸：
  900x383  大封面 2.35:1（默认）
  1283x383 合并封面
  900x500  wechat-mp-auto 常用封面
  383x383  小封面 1:1

用法（仓库根）：
  python .teams/content/skills/image-generator/scripts/prepare_cover.py cover.png --size 900x383
  python .teams/content/skills/image-generator/scripts/prepare_cover.py --article-dir .artifacts/drafts/<主题>/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from check_images import _find_cover  # noqa: E402

SIZES: dict[str, tuple[int, int]] = {
    "900x383": (900, 383),
    "1283x383": (1283, 383),
    "900x500": (900, 500),
    "383x383": (383, 383),
}


def _err(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def crop_center_resize(img, width: int, height: int):
    from PIL import Image

    target_ratio = width / height
    w, h = img.size
    if w <= 0 or h <= 0:
        raise ValueError("源图宽高无效")
    current = w / h
    if current > target_ratio:
        new_w = max(1, int(round(h * target_ratio)))
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    elif current < target_ratio:
        new_h = max(1, int(round(w / target_ratio)))
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))
    resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
    return img.resize((width, height), resample)


def _use_jpeg(src: Path, jpeg_flag: bool) -> bool:
    if jpeg_flag:
        return True
    return src.suffix.lower() in {".jpg", ".jpeg"}


def main() -> int:
    parser = argparse.ArgumentParser(description="居中裁切封面到微信常用尺寸")
    parser.add_argument("image", nargs="?", help="源图路径；与 --article-dir 二选一")
    parser.add_argument("--article-dir", help="从草稿目录自动找封面（check_images._find_cover）")
    parser.add_argument(
        "--size",
        default="900x383",
        choices=sorted(SIZES.keys()),
        help="目标尺寸，默认 900x383",
    )
    parser.add_argument("--out", help="输出路径")
    parser.add_argument("--jpeg", action="store_true", help="输出 JPEG（质量 85%）")
    args = parser.parse_args()

    try:
        from PIL import Image
    except ImportError:
        _err("需要 Pillow：pip install Pillow")

    src: Path | None = Path(args.image) if args.image else None
    if args.article_dir:
        found = _find_cover(Path(args.article_dir))
        if found is None:
            _err(f"未在 {args.article_dir} 找到封面（cover.png/jpg 或 imgs/cover.*）")
        src = found
        print(f"[INFO] 使用封面: {src}")
    if src is None:
        _err("请提供 image 或 --article-dir")
    if not src.is_file():
        _err(f"文件不存在: {src}")

    width, height = SIZES[args.size]
    jpeg = _use_jpeg(src, bool(args.jpeg))
    if args.out:
        out = Path(args.out)
    else:
        ext = ".jpg" if jpeg else ".png"
        out = src.with_name(f"{src.stem}_{width}x{height}{ext}")

    with Image.open(src) as im:
        im = im.convert("RGB") if jpeg or im.mode not in {"RGB", "RGBA"} else im
        if jpeg and im.mode == "RGBA":
            im = im.convert("RGB")
        out_img = crop_center_resize(im, width, height)
        out.parent.mkdir(parents=True, exist_ok=True)
        if jpeg:
            if out_img.mode == "RGBA":
                out_img = out_img.convert("RGB")
            out_img.save(out, "JPEG", quality=85, optimize=True)
        else:
            out_img.save(out, "PNG", optimize=True)

    print(f"[OK] 已写出 {out} ({width}×{height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
