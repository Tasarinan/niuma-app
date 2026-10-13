#!/usr/bin/env python3
"""One-shot: convert wechat-auto-writer nested themes into format.py CSS-string YAML."""
from __future__ import annotations

import json
from pathlib import Path

import yaml

SRC = Path(r"C:\userdata\testbed\gitrepo\cursor\wechat-auto-writer\themes")
DST = Path(__file__).resolve().parent / "builtin"


def css(block) -> str:
    if not isinstance(block, dict):
        return str(block or "").strip()
    parts = []
    for key, val in block.items():
        if val is None or str(val).strip() == "":
            continue
        parts.append(f"{str(key).replace('_', '-')}: {val}")
    return "; ".join(parts)


def convert(path: Path, category: str, stem: str) -> tuple[str, dict]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    colors = data.get("colors") or {}
    styles_in = data.get("styles") or {}
    body = styles_in.get("body") or {}
    listing = styles_in.get("list") or {}
    image = dict(styles_in.get("image") or {})
    image.setdefault("max-width", "100%")
    image.setdefault("height", "auto")
    image.setdefault("display", "block")
    image.setdefault("margin", "16px auto")
    body_box = dict(body)
    body_box.pop("margin", None)
    sep = dict(styles_in.get("separator") or {})
    hr_parts = ["border: none"]
    for key, val in sep.items():
        css_key = str(key).replace("_", "-")
        if css_key == "border" or val is None or str(val).strip() == "":
            continue
        hr_parts.append(f"{css_key}: {val}")
    container_bits = [
        "max-width: 740px",
        "margin: 0 auto",
        css(body_box),
    ]
    variables = {
        "primary-color": colors.get("primary") or "#333333",
        "bg-accent-color": colors.get("accent") or colors.get("blockquote_bg") or "#F5F5F5",
        "text-color": colors.get("text") or "#333333",
        "text-light": colors.get("text_light") or "#666666",
        "link-color": (styles_in.get("link") or {}).get("color") or colors.get("primary") or "#576B95",
        "font-size": body.get("font_size") or "16px",
        "line-height": body.get("line_height") or "1.75",
        "font-family": body.get("font_family")
        or "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }
    p = {
        "margin": body.get("margin") or "10px 0",
        "line-height": body.get("line_height") or "1.75",
        "color": body.get("color") or colors.get("text") or "#333333",
        "font-size": body.get("font_size") or "16px",
        "letter-spacing": body.get("letter_spacing") or "0",
    }
    styles = {
        "container": "; ".join(x for x in container_bits if x),
        "h1": css(styles_in.get("h1")),
        "h2": css(styles_in.get("h2")),
        "h3": css(styles_in.get("h3")),
        "h4": css(styles_in.get("h4")),
        "p": css(p),
        "strong": css(styles_in.get("strong")),
        "em": f"font-style: italic; color: {colors.get('text_light') or '#666666'}",
        "a": css(styles_in.get("link")),
        "ul": css(listing),
        "ol": css(listing),
        "li": css(
            {
                "font-size": listing.get("font_size") or body.get("font_size") or "16px",
                "line-height": listing.get("line_height") or body.get("line_height") or "1.75",
                "color": listing.get("color") or colors.get("text") or "#333333",
                "margin-bottom": "6px",
            }
        ),
        "blockquote": css(styles_in.get("blockquote")),
        "hr": "; ".join(hr_parts) if len(hr_parts) > 1 else "border: none; border-top: 1px solid #ddd; margin: 2em 0",
        "img": css(image),
        "code": css(styles_in.get("code_inline")),
        "pre": css(styles_in.get("code_block")),
        "table": css(styles_in.get("table")),
        "th": css(styles_in.get("table_th")),
        "td": css(styles_in.get("table_td")),
        "strong-color": (styles_in.get("strong") or {}).get("color") or colors.get("primary") or "#333333",
        "figcaption": f"text-align: center; font-size: 12px; color: {colors.get('text_light') or '#999999'}; margin-top: 6px",
    }
    theme_id = f"{category}-{stem}"
    payload = {
        "id": theme_id,
        "name": data.get("name") or theme_id,
        "description": data.get("description") or "",
        "variables": variables,
        "styles": {k: v for k, v in styles.items() if v},
    }
    return theme_id, payload


def dump_yaml(payload: dict) -> str:
    lines = [
        "# Ported from wechat-auto-writer (nested styles → format.py CSS strings)",
        f"name: {json.dumps(payload['name'], ensure_ascii=False)}",
        f"description: {json.dumps(payload['description'], ensure_ascii=False)}",
        "source: wechat-auto-writer",
        "",
        "variables:",
    ]
    for key, val in payload["variables"].items():
        lines.append(f"  {key}: {json.dumps(val, ensure_ascii=False)}")
    lines.append("")
    lines.append("styles:")
    for key, val in payload["styles"].items():
        lines.append(f"  {key}: {json.dumps(val, ensure_ascii=False)}")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    catalog = []
    for category in ("macaron", "wenyan", "shuimo"):
        folder = SRC / category
        for path in sorted(folder.glob("*.yaml")):
            if path.name.startswith("_"):
                continue
            theme_id, payload = convert(path, category, path.stem.replace("_", "-"))
            out = DST / f"{theme_id}.yaml"
            out.write_text(dump_yaml(payload), encoding="utf-8")
            catalog.append((theme_id, payload["name"], payload["description"], category))
            print(f"wrote {out.name}  {payload['name']}")
    print("CATALOG")
    for item in catalog:
        print(f"{item[0]}\t{item[1]}\t{item[2]}\t{item[3]}")


if __name__ == "__main__":
    main()
