#!/usr/bin/env python3
"""WeChat account ops report (followers, reads, shares). Not the scraps briefing."""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
HISTORY = Path(".artifacts/wechat/ops/history.json")
OUT_DIR = Path(".artifacts/wechat/ops")


def load_publish():
    spec = importlib.util.spec_from_file_location("wechat_publish", HERE / "publish.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load publish.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def yesterday(now: datetime | None = None) -> str:
    day = (now or datetime.now(timezone.utc)) - timedelta(days=1)
    return day.strftime("%Y-%m-%d")


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).strftime("%Y-%m-%d")


def change_rate(current: float, previous: float) -> str:
    if previous == 0:
        return "-"
    pct = (current - previous) / abs(previous) * 100
    sign = "+" if pct >= 0 else ""
    return f"{sign}{pct:.1f}%"


def datacube(pub, token: str, path: str, begin: str, end: str) -> dict:
    url = f"{pub.API_BASE}{pub.API_PATH}/datacube/{path}?access_token={token}"
    data = pub._api_post_json(url, {"begin_date": begin, "end_date": end})
    if data.get("errcode") not in (None, 0):
        raise RuntimeError(pub._format_api_error(data))
    return data


def sum_list(rows: list, *keys: str) -> int:
    total = 0
    for row in rows:
        for key in keys:
            total += int(row.get(key) or 0)
    return total


def load_history() -> dict:
    if not HISTORY.is_file():
        return {"reports": []}
    try:
        return json.loads(HISTORY.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"reports": []}


def save_history(entry: dict) -> None:
    history = load_history()
    reports = [row for row in history.get("reports") or [] if row.get("date") != entry.get("date")]
    reports.append(entry)
    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    HISTORY.write_text(json.dumps({"reports": reports[-30:]}, ensure_ascii=False, indent=2), encoding="utf-8")


def insight_for(data: dict) -> str:
    net = int(data.get("netGrowth") or 0)
    reads = int(data.get("totalRead") or 0)
    read_change = str(data.get("readChange") or "-")
    if net < 0:
        follow = "建议跟读或复盘推送时间，先看昨天阅读是否掉量。"
    elif net > 10 and reads > 0:
        follow = "增长不错，可对热门稿做一篇跟读，不要换赛道。"
    elif reads == 0:
        follow = "阅读为 0：数据接口常延迟一天，或昨天没有群发。先核对日期再决定跟读。"
    elif read_change.startswith("-"):
        follow = "阅读下滑，优先跟读已验证选题，不要另开新栏目。"
    else:
        follow = "数据平稳，有热门稿再跟读；没有就维持节奏。"
    if net > 10:
        growth = f"净增 {net} 粉，势头好。"
    elif net > 0:
        growth = f"净增 {net} 粉。"
    elif net < 0:
        growth = f"净流失 {abs(net)} 粉。"
    else:
        growth = "粉丝持平。"
    return f"{growth} {follow}"


def collect_day(pub, token: str, date: str) -> dict:
    errors: list[str] = []
    new_users = cancel_users = total_users = total_read = total_share = messages = 0
    try:
        summary = datacube(pub, token, "getusersummary", date, date)
        new_users = sum_list(summary.get("list") or [], "new_user")
        cancel_users = sum_list(summary.get("list") or [], "cancel_user")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"usersummary: {exc}")
    try:
        cumulate = datacube(pub, token, "getusercumulate", date, date)
        rows = cumulate.get("list") or []
        if rows:
            total_users = int(rows[-1].get("cumulate_user") or 0)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"usercumulate: {exc}")
    try:
        articles = datacube(pub, token, "getarticlesummary", date, date)
        rows = articles.get("list") or []
        total_read = sum_list(rows, "int_page_read_count")
        total_share = sum_list(rows, "share_count")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"articlesummary: {exc}")
    try:
        msg = datacube(pub, token, "getupstreammsg", date, date)
        messages = sum_list(msg.get("list") or [], "msg_count")
    except Exception as exc:  # noqa: BLE001
        errors.append(f"upstreammsg: {exc}")
    top: list[dict] = []
    try:
        top = pub.list_recent_articles(token, count=5)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"published: {exc}")
    return {
        "date": date,
        "newUsers": new_users,
        "cancelUsers": cancel_users,
        "netGrowth": new_users - cancel_users,
        "totalUsers": total_users,
        "totalRead": total_read,
        "totalShare": total_share,
        "newMessages": messages,
        "topArticles": top,
        "errors": errors,
    }


def render_markdown(data: dict, range_name: str) -> str:
    net = int(data["netGrowth"])
    lines = [
        f"# 公众号{'周报' if range_name == 'week' else '日报'}（{data.get('range') or data['date']}）",
        "",
        "## 用户",
        f"- 新增关注：+{data['newUsers']}",
        f"- 取消关注：-{data['cancelUsers']}",
        f"- 净增长：{'+' if net >= 0 else ''}{net}（较上次 {data.get('growthRate') or '-'}）",
        f"- 累计粉丝：{data['totalUsers']}",
        "",
        "## 阅读",
        f"- 总阅读：{data['totalRead']} 次（较上次 {data.get('readChange') or '-'}）",
        f"- 总分享：{data['totalShare']} 次",
        "",
        "## 互动",
        f"- 新消息：{data['newMessages']} 条",
        "",
        "## 最近已发",
    ]
    articles = data.get("topArticles") or []
    if not articles:
        lines.append("- （无或接口失败）")
    for idx, art in enumerate(articles, 1):
        title = art.get("title") or "未知标题"
        url = art.get("url") or ""
        lines.append(f"{idx}. [{title}]({url})" if url else f"{idx}. {title}")
    lines.extend(["", "## 洞察", data.get("insight") or "", ""])
    errors = data.get("errors") or []
    if errors:
        lines.extend(["## 接口错误", *[f"- {err}" for err in errors], ""])
    lines.append("数据来自微信 datacube，通常延迟一天。不要把采集早报 `/digest` 和本报告混在一起。")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="公众号运营日报/周报")
    parser.add_argument("--account", help="微信槽位 1..N 或名称")
    parser.add_argument("--range", choices=("daily", "week"), default="daily")
    parser.add_argument("--date", help="日报日期 YYYY-MM-DD，默认昨天（接口 T+1）")
    args = parser.parse_args()

    pub = load_publish()
    pub._cli_account = args.account
    token = pub._get_token()

    if args.range == "week":
        days = [collect_day(pub, token, days_ago(i)) for i in range(7, 0, -1)]
        data = {
            "range": f"{days[0]['date']} ~ {days[-1]['date']}",
            "date": days[-1]["date"],
            "newUsers": sum(d["newUsers"] for d in days),
            "cancelUsers": sum(d["cancelUsers"] for d in days),
            "netGrowth": sum(d["netGrowth"] for d in days),
            "totalUsers": days[-1]["totalUsers"],
            "totalRead": sum(d["totalRead"] for d in days),
            "totalShare": sum(d["totalShare"] for d in days),
            "newMessages": sum(d["newMessages"] for d in days),
            "topArticles": days[-1]["topArticles"],
            "errors": [err for d in days for err in d["errors"]],
            "days": days,
        }
        stamp = f"week-{data['date']}"
    else:
        data = collect_day(pub, token, args.date or yesterday())
        stamp = data["date"]

    history = load_history().get("reports") or []
    last = next((row for row in reversed(history) if row.get("range") == args.range), None)
    data["growthRate"] = change_rate(data["netGrowth"], float(last["netGrowth"])) if last else "-"
    data["readChange"] = change_rate(data["totalRead"], float(last["totalRead"])) if last else "-"
    data["insight"] = insight_for(data)
    data["kind"] = args.range

    save_history({
        "date": data["date"],
        "range": args.range,
        "netGrowth": data["netGrowth"],
        "totalRead": data["totalRead"],
        "totalUsers": data["totalUsers"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = OUT_DIR / f"{stamp}.md"
    json_path = OUT_DIR / f"{stamp}.json"
    md_path.write_text(render_markdown(data, args.range), encoding="utf-8")
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "markdown": str(md_path).replace("\\", "/"), "json": str(json_path).replace("\\", "/"), "data": data}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
