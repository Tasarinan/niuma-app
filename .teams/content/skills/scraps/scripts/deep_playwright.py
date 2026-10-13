#!/usr/bin/env python3
"""Optional Playwright deep-read. Used when urllib gets a challenge page or empty body."""
from __future__ import annotations

import os
import sys
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
CHALLENGE_MARKERS = ("just a moment", "attention required", "cf-browser-verification", "enable javascript")


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


def looks_blocked(title: str, text: str) -> bool:
    hay = f"{title} {text[:400]}".lower()
    return any(marker in hay for marker in CHALLENGE_MARKERS)


def playwright_available() -> bool:
    try:
        import playwright.sync_api  # noqa: F401

        return True
    except ImportError:
        return False


def fetch_pages(urls: list[str], limit: int = 15) -> dict[str, str]:
    """Open one Chromium and deep-read up to `limit` URLs. Missing playwright → {}."""
    if not urls:
        return {}
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("[playwright] not installed; pip install playwright && python -m playwright install chromium", file=sys.stderr)
        return {}

    out: dict[str, str] = {}
    launch_kwargs: dict = {
        "headless": True,
        "args": ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
    }
    exe = chromium_executable()
    if exe:
        launch_kwargs["executable_path"] = exe

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(**launch_kwargs)
            context = browser.new_context(user_agent=UA, locale="zh-CN")
            page = context.new_page()
            for url in urls[:limit]:
                try:
                    page.goto(url, timeout=25000, wait_until="domcontentloaded")
                    page.wait_for_timeout(1200)
                    title = page.title() or ""
                    if looks_blocked(title, page.inner_text("body")[:200]):
                        page.wait_for_timeout(8000)
                    for selector in ("article", "main", "[role=main]", "body"):
                        try:
                            text = page.inner_text(selector, timeout=2000)
                        except Exception:
                            continue
                        text = " ".join(text.split())
                        if len(text) >= 240 and not looks_blocked(title, text):
                            out[url] = text[:3000]
                            break
                    print(f"[playwright] {'ok' if url in out else 'thin'} {url}", file=sys.stderr)
                except Exception as exc:  # noqa: BLE001
                    print(f"[playwright] fail {url}: {exc}", file=sys.stderr)
            browser.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[playwright] launch failed: {exc}", file=sys.stderr)
    return out
