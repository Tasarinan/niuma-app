#!/usr/bin/env python3
"""Hot-source collect for a writing idea. Wraps fetch_news.py (from wemp-ops)."""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
FETCH = HERE / "fetch_news.py"


def load_fetch():
    spec = importlib.util.spec_from_file_location("fetch_news", FETCH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {FETCH}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def score(item: dict, keywords: list[str]) -> float:
    title = (item.get("title") or "").lower()
    content = (item.get("content") or "").lower()
    points = 0.0
    for raw in keywords:
        key = raw.lower()
        if key and key in title:
            points += 0.3
        if key and key in content:
            points += 0.15
    heat = int(re.sub(r"[^0-9]", "", str(item.get("score") or "0")) or 0)
    if heat > 500:
        points += 0.2
    elif heat > 100:
        points += 0.1
    return min(points, 1.0)


def fingerprint(title: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", title.lower())[:30]


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect public posts for a writing idea")
    parser.add_argument("--query", required=True, help="the idea or theme")
    parser.add_argument("--keywords", default="", help="comma-separated extra keywords")
    parser.add_argument(
        "--sources",
        default="sspai,juejin,36kr,v2ex,zhihu",
        help="comma-separated sources, or tech/china/finance/all",
    )
    parser.add_argument("--count", type=int, default=16)
    args = parser.parse_args()

    fetch = load_fetch()
    keywords = [part.strip() for part in args.keywords.split(",") if part.strip()]
    if args.query.strip() and args.query.strip() not in keywords:
        keywords.insert(0, args.query.strip())

    requested = [part.strip().lower() for part in args.sources.split(",") if part.strip()]
    names: list[str] = []
    for name in requested:
        if name in fetch.GROUPS:
            names.extend(fetch.GROUPS[name])
        elif name in fetch.SOURCES:
            names.append(name)
        else:
            print(f"[collect] skip unknown source: {name}", file=sys.stderr)

    seen_names: set[str] = set()
    unique_names = []
    for name in names:
        if name in seen_names:
            continue
        seen_names.add(name)
        unique_names.append(name)

    per = max(4, args.count // max(len(unique_names), 1) + 3)
    items: list[dict] = []
    for name in unique_names:
        print(f"[collect] {name}...", file=sys.stderr)
        try:
            batch = fetch.SOURCES[name](per, ",".join(keywords) if keywords else None)
            print(f"[collect] {name} -> {len(batch)}", file=sys.stderr)
            items.extend(batch)
        except Exception as exc:  # noqa: BLE001
            print(f"[collect] {name} failed: {exc}", file=sys.stderr)

    ranked = [{**item, "relevance": score(item, keywords)} for item in items]
    ranked.sort(key=lambda item: item.get("relevance") or 0, reverse=True)
    seen: set[str] = set()
    unique: list[dict] = []
    for item in ranked:
        key = fingerprint(item.get("title") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= args.count:
            break

    payload = {
        "query": args.query,
        "keywords": keywords,
        "sources": unique_names,
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "items": unique,
    }
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
