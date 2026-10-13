#!/usr/bin/env python3
"""Collect public posts for /scrap. Wraps topic-research fetch_news.py."""
from __future__ import annotations

import argparse
import concurrent.futures
import html as html_lib
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from deep_playwright import fetch_pages, playwright_available  # noqa: E402

SKILL = HERE.parent
FETCH = SKILL.parent / "topic-research" / "scripts" / "fetch_news.py"
SOURCES_FILE = SKILL / "sources.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
KEYWORD_EXPAND = {
    "ai": "AI,LLM,GPT,Claude,Agent,RAG,DeepSeek",
    "llm": "AI,LLM,GPT,Claude,Agent,RAG",
}
SKIP_DEEP = ("weibo.com", "s.weibo.com", "douyin.com", "baidu.com/s")
MIN_CONTENT = 240
PLAYWRIGHT_CAP = 15


def load_fetch():
    spec = importlib.util.spec_from_file_location("fetch_news", FETCH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {FETCH}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_config() -> dict:
    return json.loads(SOURCES_FILE.read_text(encoding="utf-8"))


def fingerprint(title: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", title.lower())[:30]


def heat_number(raw: str) -> int:
    digits = re.sub(r"[^0-9]", "", str(raw or ""))
    return int(digits) if digits else 0


def relevance(item: dict, keywords: list[str]) -> float:
    if not keywords:
        return 0.0
    title = (item.get("title") or "").lower()
    content = (item.get("content") or "").lower()
    score = 0.0
    for word in keywords:
        key = word.lower()
        if key in title:
            score += 0.3
        if key in content:
            score += 0.15
    if score <= 0:
        return 0.0
    heat = heat_number(item.get("heat") or item.get("score") or "")
    if heat > 500:
        score += 0.2
    elif heat > 100:
        score += 0.1
    return min(score, 1.0)


def rank_items(items: list[dict], keywords: list[str], limit: int) -> list[dict]:
    rows = [normalize(item) for item in items]
    if keywords:
        for row in rows:
            row["relevance"] = round(relevance(row, keywords), 3)
        rows = [row for row in rows if row["relevance"] > 0]
        rows.sort(key=lambda row: (-float(row["relevance"]), -heat_number(row.get("heat") or "")))
    seen: set[str] = set()
    unique: list[dict] = []
    for row in rows:
        key = fingerprint(row.get("title") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(row)
        if len(unique) >= limit:
            break
    return unique


def expand_keywords(raw: str) -> list[str]:
    parts: list[str] = []
    for token in raw.split(","):
        key = token.strip()
        if not key:
            continue
        expanded = KEYWORD_EXPAND.get(key.lower())
        if expanded:
            parts.extend(p.strip() for p in expanded.split(",") if p.strip())
        else:
            parts.append(key)
    seen: set[str] = set()
    unique: list[str] = []
    for part in parts:
        low = part.lower()
        if low in seen:
            continue
        seen.add(low)
        unique.append(part)
    return unique


def strip_html(raw: str) -> str:
    text = re.sub(r"(?is)<(script|style|nav|footer|header)[^>]*>.*?</\1>", " ", raw)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:3000]


def fetch_text(url: str) -> str:
    if not url.startswith("http"):
        return ""
    if any(part in url for part in SKIP_DEEP):
        return ""
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    try:
        with urlopen(req, timeout=8) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            return strip_html(resp.read().decode(charset, errors="ignore"))
    except (URLError, HTTPError, TimeoutError, UnicodeError):
        return ""


def needs_browser(item: dict) -> bool:
    url = item.get("url") or ""
    content = item.get("content") or ""
    if not url.startswith("http") or any(part in url for part in SKIP_DEEP):
        return False
    return len(content) < MIN_CONTENT


def enrich(items: list[dict], workers: int = 8, use_playwright: bool = True) -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        future_map = {pool.submit(fetch_text, item.get("url") or ""): item for item in items}
        for future in concurrent.futures.as_completed(future_map):
            item = future_map[future]
            try:
                content = future.result()
            except Exception:
                content = ""
            if content:
                item["content"] = content
                item["engine"] = "http"
    if not use_playwright:
        return
    pending = [item for item in items if needs_browser(item)]
    if not pending:
        return
    print(f"[collect] playwright deep-read {min(len(pending), PLAYWRIGHT_CAP)} urls...", file=sys.stderr)
    pages = fetch_pages([item.get("url") or "" for item in pending], limit=PLAYWRIGHT_CAP)
    for item in pending:
        text = pages.get(item.get("url") or "")
        if text:
            item["content"] = text
            item["engine"] = "playwright"


def normalize(item: dict) -> dict:
    heat = str(item.get("heat") or item.get("score") or "").strip()
    time_str = str(item.get("time") or "").strip() or "Unknown Time"
    row = {
        "source": item.get("source") or "",
        "title": item.get("title") or "",
        "url": item.get("url") or "",
        "heat": heat,
        "time": time_str,
        "hn_url": item.get("hn_url") or "",
        "lang": item.get("lang") or "",
        "content": item.get("content") or "",
    }
    extra_links = []
    if row["hn_url"]:
        extra_links.append({"label": "Discussion", "url": row["hn_url"]})
    if "github.com" in row["url"] and row["source"].lower().startswith("github"):
        extra_links.append({"label": "GitHub", "url": row["url"]})
    row["links"] = extra_links
    return row


def resolve_names(requested: list[str], groups: dict, fetch) -> list[str]:
    names: list[str] = []
    for name in requested:
        if name in groups:
            names.extend(groups[name])
        elif name in fetch.GROUPS:
            names.extend(fetch.GROUPS[name])
        elif name in fetch.SOURCES:
            names.append(name)
        else:
            print(f"[collect] skip unknown source: {name}", file=sys.stderr)
    unique: list[str] = []
    seen: set[str] = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        unique.append(name)
    return unique


def main() -> int:
    config = load_config()
    groups = {key: [str(item) for item in value] for key, value in (config.get("groups") or {}).items()}
    profiles = config.get("profiles") or {}
    default_group = str(config.get("default") or "general")
    parser = argparse.ArgumentParser(description="Collect public posts for /scrap")
    parser.add_argument("--sources", default=default_group, help="comma-separated sources, groups, or profiles")
    parser.add_argument("--count", type=int, default=0, help="max unique items (0 = profile default)")
    parser.add_argument("--keyword", default="", help="comma-separated keyword filter; AI expands automatically")
    parser.add_argument("--deep", action="store_true", help="download article text for Deep Dive")
    parser.add_argument("--no-deep", action="store_true")
    parser.add_argument("--no-playwright", action="store_true", help="skip Chromium fallback")
    args = parser.parse_args()

    fetch = load_fetch()
    requested = [part.strip().lower() for part in args.sources.split(",") if part.strip()]
    profile_name = requested[0] if len(requested) == 1 and requested[0] in profiles else default_group
    profile = profiles.get(profile_name) or {}
    deep = bool(profile.get("deep", True))
    if args.deep:
        deep = True
    if args.no_deep:
        deep = False
    count = args.count or int(profile.get("count") or 40)
    per = int(profile.get("per") or max(6, count // max(len(requested), 1)))

    unique_names = resolve_names(requested, groups, fetch)
    keywords = expand_keywords(args.keyword)
    items: list[dict] = []
    failed: list[str] = []
    for name in unique_names:
        print(f"[collect] {name}...", file=sys.stderr)
        try:
            batch = fetch.SOURCES[name](per, ",".join(keywords) if keywords else None)
            print(f"[collect] {name} -> {len(batch)}", file=sys.stderr)
            items.extend(batch)
        except Exception as exc:  # noqa: BLE001
            print(f"[collect] {name} failed: {exc}", file=sys.stderr)
            failed.append(f"{name}: {exc}")

    unique = rank_items(items, keywords, count)

    use_playwright = deep and not args.no_playwright
    if deep:
        print(f"[collect] deep fetch {len(unique)} urls...", file=sys.stderr)
        enrich(unique, use_playwright=use_playwright)

    payload = {
        "sources": unique_names,
        "profile": profile_name,
        "keywords": keywords,
        "deep": deep,
        "playwright": bool(use_playwright and playwright_available()),
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "failed": failed,
        "items": unique,
    }
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
