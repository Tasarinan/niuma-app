#!/usr/bin/env python3
"""Render a .mmd file to PNG via Playwright + mermaid_render.html. Optional Chromium."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

TEMPLATE = Path(__file__).with_name("mermaid_render.html")


def chromium_executable() -> str | None:
    env = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE") or os.environ.get("CHROME_PATH")
    if env and Path(env).exists():
        return env
    local = os.environ.get("LOCALAPPDATA", "")
    program = os.environ.get("PROGRAMFILES", r"C:\Program Files")
    program_x86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
    candidates = [
        Path(local) / "Google/Chrome/Application/chrome.exe",
        Path(program) / "Google/Chrome/Application/chrome.exe",
        Path(program_x86) / "Google/Chrome/Application/chrome.exe",
        Path(local) / "Microsoft/Edge/Application/msedge.exe",
        Path(program) / "Microsoft/Edge/Application/msedge.exe",
        Path(program_x86) / "Microsoft/Edge/Application/msedge.exe",
        Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        Path("/usr/bin/google-chrome"),
        Path("/usr/bin/chromium"),
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Render Mermaid source to PNG")
    parser.add_argument("source", help=".mmd file")
    parser.add_argument("output", help="PNG path")
    args = parser.parse_args()

    src_path = Path(args.source)
    out_path = Path(args.output)
    if not src_path.is_file():
        print(f"[ERROR] missing mermaid source: {src_path}", file=sys.stderr)
        return 1
    if not TEMPLATE.is_file():
        print(f"[ERROR] missing template: {TEMPLATE}", file=sys.stderr)
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "[ERROR] Playwright 未安装。保留 .mmd，不要改用 AI 假架构图。pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        return 2

    source = src_path.read_text(encoding="utf-8")
    html = TEMPLATE.read_text(encoding="utf-8").replace(
        "__MERMAID_PLACEHOLDER__",
        json.dumps(source, ensure_ascii=False),
    )
    tmp = out_path.with_suffix(".html")
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_text(html, encoding="utf-8")

    chrome = chromium_executable()
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=chrome if chrome else None,
        )
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        page.goto(tmp.resolve().as_uri(), wait_until="networkidle")
        page.wait_for_timeout(800)
        page.screenshot(path=str(out_path), full_page=True)
        browser.close()

    print(f"[OK] {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
