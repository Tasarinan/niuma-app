#!/usr/bin/env python3
"""
文章元数据初始化工具（发布子 skill�?

在流程中的位置：
- **本篇准备**（总览 main）：建好 `drafts/…` 目录后，可初始化本篇 **`article.yaml`**（标�?作�?摘要等）�?
- **发布�?*：定稿后再次更新 **`article.yaml`**（与 **`publish.py`** 读取的字段一致）�?

不属于七步箭头里的单独一格：元数据贯�?**写稿 �?�?�?发布**，脚本主要在 **「建目录之后、写稿前后�?* �?**「发布前�?* 使用�?

用途：
- 为某一篇文章目录初始化或更新元数据�?*`article.yaml`**�?
- 可选生成文末链接文件（**`closing.md`**�?

约定�?
- 文章目录结构�?
    <article_dir>/
      ├── article.yaml         # 元信息（标题/作�?摘要等）
      ├── *.md                 # 正文 Markdown（可选）
      ├── closing.md           # 本篇专属文末（可选，若存在会在排版时自动追加�?
      └── imgs/                # 正文图片（可选）
"""

import argparse
from pathlib import Path
import sys
import yaml


def _info(msg: str):
    print(f"[INFO] {msg}")


def _ok(msg: str):
    print(f"[OK] {msg}")


def _err(msg: str):
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def _load_yaml_example() -> str:
    """返回 article.yaml 最小模板（不再�?.aws-article）�?""
    return (
        "# 文章元数据\n"
        "title: \"\"\n"
        "author: \"\"\n"
        "digest: \"\"\n"
        "cover_image: \"\"\n"
        "content_source: \"article.html\"\n"
        "image_source: \"generated\"\n"
        "user_images_dir: \"imgs/\"\n"
        "img_analysis_file: \"img_analysis.md\"\n"
        "need_open_comment: 1\n"
        "only_fans_can_comment: 0\n"
        "publish_completed: false\n"
    )


def _parse_links(links: str) -> list[tuple[str, str]]:
    """
    将形�?'标题A|https://a; 标题B|https://b' 的字符串解析为列表�?
    忽略空项与不合法项�?
    """
    items: list[tuple[str, str]] = []
    if not links:
        return items
    for part in links.split(";"):
        part = part.strip()
        if not part:
            continue
        if "|" not in part:
            continue
        name, url = part.split("|", 1)
        name = name.strip()
        url = url.strip()
        if name and url:
            items.append((name, url))
    return items


def _write_closing_md(article_dir: Path, links: list[tuple[str, str]], overwrite: bool) -> Path | None:
    """根据 links 生成/更新 closing.md；若�?links 且文件已存在且非覆盖，则不动�?""
    closing_path = article_dir / "closing.md"
    if not links:
        return closing_path if closing_path.exists() else None
    if closing_path.exists() and not overwrite:
        _info(f"closing.md 已存在，跳过写入（使�?--overwrite 可覆盖）：{closing_path}")
        return closing_path
    lines = ["---", "延伸阅读�?]
    for title, url in links:
        lines.append(f"- [{title}]({url})")
    content = "\n".join(lines) + "\n"
    closing_path.write_text(content, encoding="utf-8")
    _ok(f"写入文末链接: {closing_path}")
    return closing_path


PRESET_FIELDS = [
    "default_structure",
    "default_closing_block",
    "default_title_style",
    "default_format_preset",
    "default_cover_image_style",
    "default_article_image_style",
    "default_sticker_style",
]


def _ensure_preset_fields(article_yaml_path: Path):
    """
    若仓库存�?.teams/content/editor/editorial.yaml，则�?article.yaml 中补齐预设字段，
    初始值统一为空列表 []（仅补缺，不覆盖已有值）�?
    �?config 不存在则不处理，保持 article.yaml 可为空�?
    """
    cfg_path = Path(".teams/content/editor/editorial.yaml")
    if not cfg_path.is_file():
        _info("未发�?.teams/content/editor/editorial.yaml，跳过预设字段初始化")
        return

    try:
        cfg_data = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        _info("读取 .teams/content/editor/editorial.yaml 失败，跳过预设字段初始化")
        return
    if not isinstance(cfg_data, dict):
        _info(".teams/content/editor/editorial.yaml 不是 YAML 对象，跳过预设字段初始化")
        return

    try:
        art_data = yaml.safe_load(article_yaml_path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        _info("读取 article.yaml 失败，跳过预设字段初始化")
        return
    if not isinstance(art_data, dict):
        _info("article.yaml 不是 YAML 对象，跳过预设字段初始化")
        return

    changed = False
    for key in PRESET_FIELDS:
        if key in cfg_data and key not in art_data:
            art_data[key] = []
            changed = True

    if changed:
        article_yaml_path.write_text(
            yaml.safe_dump(art_data, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        _ok(f"已补齐预设字段（初始为空�? {article_yaml_path}")
    else:
        _info("预设字段已齐全或 config 未声明对应字段，跳过写入")


def _merge_article_yaml(existing_text: str, title: str, author: str, digest: str) -> str:
    """
    朴素合并：逐行替换常见键；若不存在则在末尾追加�?
    仅处理少量关键字段，避免引入额外依赖�?
    """
    lines = existing_text.splitlines()
    keys = {
        "title": title,
        "author": author,
        "digest": digest,
    }
    found = {k: False for k in keys}
    for i, line in enumerate(lines):
        for key, val in keys.items():
            if val is None or val == "":
                continue
            prefix = f"{key}:"
            if line.strip().startswith(prefix):
                # 保留引号以避�?YAML 解析歧义
                lines[i] = f'{key}: "{val}"'
                found[key] = True
    # 追加缺失�?
    for key, val in keys.items():
        if val is None or val == "":
            continue
        if not found[key]:
            lines.append(f'{key}: "{val}"')
    return "\n".join(lines) + ("\n" if not existing_text.endswith("\n") else "")


def main():
    parser = argparse.ArgumentParser(
        description="初始化或更新某一篇文章的元数据与文末链接",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("article_dir", help="文章目录（如 drafts/20260326-标题slug�?)
    parser.add_argument("--title", help="文章标题")
    parser.add_argument("--author", help="作者名")
    parser.add_argument("--digest", help="摘要�?0-128字建议）")
    parser.add_argument(
        "--links",
        help="文末链接，使�?'标题A|URLA; 标题B|URLB' 形式；将写入 closing.md",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="�?closing.md 已存在则允许覆盖",
    )
    args = parser.parse_args()

    article_dir = Path(args.article_dir)
    article_dir.mkdir(parents=True, exist_ok=True)

    article_yaml_path = article_dir / "article.yaml"
    if article_yaml_path.exists():
        text = article_yaml_path.read_text(encoding="utf-8")
        _info(f"更新 article.yaml: {article_yaml_path}")
    else:
        _info("未发�?article.yaml，基于示例创�?)
        text = _load_yaml_example()

    merged = _merge_article_yaml(text, args.title or "", args.author or "", args.digest or "")
    article_yaml_path.write_text(merged, encoding="utf-8")
    _ok(f"已写�? {article_yaml_path}")
    _ensure_preset_fields(article_yaml_path)

    links = _parse_links(args.links or "")
    if links:
        _write_closing_md(article_dir, links, overwrite=args.overwrite)
    else:
        _info("未提�?--links，跳过生�?closing.md")

    _ok("初始化完�?)


if __name__ == "__main__":
    main()
