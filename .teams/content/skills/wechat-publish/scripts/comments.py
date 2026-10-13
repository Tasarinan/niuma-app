#!/usr/bin/env python3
"""List WeChat article comments and send approved replies. Drafts stay local until --yes."""
from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT_DIR = Path(".artifacts/wechat/ops")
COMMENTS_FILE = OUT_DIR / "comments.json"
DRAFTS_FILE = OUT_DIR / "comment-drafts.json"
PROCESSED_FILE = OUT_DIR / "processed-comments.json"


def load_publish():
    spec = importlib.util.spec_from_file_location("wechat_publish", HERE / "publish.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load publish.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def api(pub, token: str, path: str, body: dict) -> dict:
    url = f"{pub.API_BASE}{pub.API_PATH}{path}?access_token={token}"
    data = pub._api_post_json(url, body)
    if data.get("errcode") not in (None, 0):
        raise RuntimeError(pub._format_api_error(data))
    return data


def article_id_of(item: dict) -> str:
    return str(item.get("article_id") or item.get("msg_data_id") or "").strip()


def list_comments(pub, token: str, article_id: str, index: int = 0, begin: int = 0, count: int = 50) -> dict:
    return api(
        pub,
        token,
        "/comment/list",
        {"msg_data_id": article_id, "index": index, "begin": begin, "count": min(count, 50), "type": 0},
    )


def comment_key(article_id: str, comment_id) -> str:
    return f"{article_id}_{comment_id}"


def load_processed() -> set[str]:
    if not PROCESSED_FILE.is_file():
        return set()
    try:
        raw = json.loads(PROCESSED_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    return {str(item) for item in (raw.get("ids") or []) if item}


def save_processed(ids: set[str]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_FILE.write_text(
        json.dumps({"ids": sorted(ids)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def mark_processed(keys: list[str]) -> None:
    ids = load_processed()
    ids.update(str(key) for key in keys if key)
    save_processed(ids)


def drafted_keys() -> set[str]:
    if not DRAFTS_FILE.is_file():
        return set()
    try:
        raw = json.loads(DRAFTS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    keys: set[str] = set()
    for row in raw.get("drafts") or raw.get("unreplied") or []:
        aid = str(row.get("articleId") or "")
        cid = row.get("commentId")
        if aid and cid is not None:
            keys.add(comment_key(aid, cid))
    return keys


def elect_comment(pub, token: str, article_id: str, comment_id: int, index: int = 0, *, elect: bool = True) -> dict:
    path = "/comment/markelect" if elect else "/comment/unmarkelect"
    return api(
        pub,
        token,
        path,
        {"msg_data_id": article_id, "index": index, "user_comment_id": int(comment_id)},
    )


def send_reply(pub, token: str, article_id: str, comment_id: int, content: str, index: int = 0) -> dict:
    return api(
        pub,
        token,
        "/comment/reply/add",
        {
            "msg_data_id": article_id,
            "index": index,
            "user_comment_id": int(comment_id),
            "content": content,
        },
    )


def cmd_list(pub, token: str, article_count: int) -> dict:
    published = pub.get_published_articles(token, offset=0, count=min(article_count, 20), no_content=False)
    items = published.get("item") or []
    articles = []
    unreplied = []
    errors = []
    skip = load_processed() | drafted_keys()
    for item in items:
        aid = article_id_of(item)
        news = ((item.get("content") or {}).get("news_item") or [{}])[0]
        title = news.get("title") or "未知标题"
        if not aid:
            errors.append(f"{title}: 无 article_id")
            continue
        try:
            raw = list_comments(pub, token, aid)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{title}: {exc}")
            continue
        comments = []
        for row in raw.get("comment") or []:
            reply = row.get("reply") or {}
            entry = {
                "id": row.get("user_comment_id"),
                "user": row.get("nick_name") or "匿名",
                "content": row.get("content") or "",
                "time": row.get("create_time") or "",
                "isElected": bool(row.get("is_elected")),
                "hasReply": bool(reply.get("content")),
                "replyContent": reply.get("content") or "",
            }
            comments.append(entry)
            key = comment_key(aid, entry["id"])
            if not entry["hasReply"] and entry["id"] is not None and key not in skip:
                unreplied.append({
                    "articleId": aid,
                    "articleTitle": title,
                    "index": 0,
                    "commentId": entry["id"],
                    "user": entry["user"],
                    "content": entry["content"],
                    "draftReply": "",
                    "key": key,
                })
        articles.append({
            "articleId": aid,
            "title": title,
            "total": int(raw.get("total") or len(comments)),
            "unreplied": sum(1 for c in comments if not c["hasReply"]),
            "comments": comments,
        })
    payload = {
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "articles": articles,
        "unreplied": unreplied,
        "totalComments": sum(a["total"] for a in articles),
        "unrepliedCount": len(unreplied),
        "errors": errors,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    COMMENTS_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return payload


def cmd_send(pub, token: str, args: argparse.Namespace) -> int:
    jobs = []
    if args.file:
        raw = json.loads(Path(args.file).read_text(encoding="utf-8"))
        drafts = raw.get("drafts") or raw.get("unreplied") or []
        for row in drafts:
            content = (row.get("draftReply") or row.get("content") or "").strip()
            if not content:
                continue
            jobs.append({
                "articleId": str(row.get("articleId") or ""),
                "commentId": int(row.get("commentId")),
                "index": int(row.get("index") or 0),
                "content": content[:300],
            })
    else:
        if not args.article_id or args.comment_id is None or not args.content:
            print("[ERROR] send 需要 --article-id --comment-id --content，或 --file", file=sys.stderr)
            return 1
        jobs.append({
            "articleId": args.article_id,
            "commentId": int(args.comment_id),
            "index": int(args.index),
            "content": args.content.strip()[:300],
        })
    if not jobs:
        print("[ERROR] 没有可发送的回复（拟回复为空）", file=sys.stderr)
        return 1
    if not args.yes:
        print(json.dumps({"dryRun": True, "wouldSend": jobs}, ensure_ascii=False, indent=2))
        print("[INFO] 未加 --yes，没有真正发送。用户确认后再带 --yes。", file=sys.stderr)
        return 2
    sent = []
    errors = []
    for job in jobs:
        try:
            send_reply(pub, token, job["articleId"], job["commentId"], job["content"], job["index"])
            sent.append(job)
            mark_processed([comment_key(job["articleId"], job["commentId"])])
        except Exception as exc:  # noqa: BLE001
            errors.append({**job, "error": str(exc)})
    print(json.dumps({"ok": not errors, "sent": sent, "errors": errors}, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


def resolve_ref(raw: str) -> tuple[str, int, int]:
    text = (raw or "").strip()
    if not text:
        raise ValueError("缺少评论 id")
    if "_" in text:
        article_id, _, cid = text.rpartition("_")
        return article_id, int(cid), 0
    if COMMENTS_FILE.is_file():
        payload = json.loads(COMMENTS_FILE.read_text(encoding="utf-8"))
        matches = []
        for article in payload.get("articles") or []:
            for row in article.get("comments") or []:
                if str(row.get("id")) == text:
                    matches.append((str(article.get("articleId") or ""), int(row["id"]), 0))
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise ValueError(f"评论 {text} 对应多篇文章，请用 articleId_commentId")
    raise ValueError("找不到该评论，请先 comments.py list，或传入 articleId_commentId")


def cmd_elect(pub, token: str, args: argparse.Namespace, *, elect: bool) -> int:
    raw = args.id or ""
    if args.article_id and args.comment_id is not None:
        article_id, comment_id, index = args.article_id, int(args.comment_id), int(args.index or 0)
    else:
        try:
            article_id, comment_id, index = resolve_ref(raw)
        except ValueError as exc:
            print(f"[ERROR] {exc}", file=sys.stderr)
            return 1
    job = {
        "action": "elect" if elect else "unelect",
        "articleId": article_id,
        "commentId": comment_id,
        "index": index,
        "key": comment_key(article_id, comment_id),
    }
    if not args.yes:
        print(json.dumps({"dryRun": True, "would": job}, ensure_ascii=False, indent=2))
        print("[INFO] 未加 --yes，没有真正精选。用户确认后再带 --yes。", file=sys.stderr)
        return 2
    try:
        elect_comment(pub, token, article_id, comment_id, index, elect=elect)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, **job, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1
    mark_processed([job["key"]])
    print(json.dumps({"ok": True, **job}, ensure_ascii=False, indent=2))
    return 0


def add_elect_flags(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("id", nargs="?", help="articleId_commentId，或 list 结果里的 commentId")
    parser.add_argument("--article-id")
    parser.add_argument("--comment-id", type=int)
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--yes", action="store_true", help="真正调用；不加则只预览")


def main() -> int:
    parser = argparse.ArgumentParser(description="公众号评论：拉取、拟回复、精选")
    parser.add_argument("--account", help="微信槽位 1..N 或名称")
    sub = parser.add_subparsers(dest="command")
    p_list = sub.add_parser("list", help="拉取最近文章评论")
    p_list.add_argument("--count", type=int, default=5)
    p_send = sub.add_parser("send", help="发送已确认的回复")
    p_send.add_argument("--article-id")
    p_send.add_argument("--comment-id", type=int)
    p_send.add_argument("--content")
    p_send.add_argument("--index", type=int, default=0)
    p_send.add_argument("--file", help="comment-drafts.json")
    p_send.add_argument("--yes", action="store_true", help="真正发送；不加则只预览")
    p_elect = sub.add_parser("elect", help="精选评论（确认后 --yes）")
    add_elect_flags(p_elect)
    p_unelect = sub.add_parser("unelect", help="取消精选（确认后 --yes）")
    add_elect_flags(p_unelect)
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return 0
    pub = load_publish()
    pub._cli_account = args.account
    token = pub._get_token()
    if args.command == "list":
        cmd_list(pub, token, args.count)
        return 0
    if args.command == "send":
        return cmd_send(pub, token, args)
    if args.command == "elect":
        return cmd_elect(pub, token, args, elect=True)
    if args.command == "unelect":
        return cmd_elect(pub, token, args, elect=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
