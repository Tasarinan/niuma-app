#!/usr/bin/env python3
"""
微信公众号发布工具（skills/article-publish-wechat/scripts/publish.py�?

- check-screening：校�?**`.niuma/teams/content/presets/editorial.yaml`** �?**`publish_method`**（`draft` / `published` / `none`）�?
- 其余子命令：token、上传、草稿、发布、一�?full 等�?

**publish_method**（`config.yaml` 顶层）：
  - **`draft`**（默认）：`full` �?**创建草稿**（进公众号草稿箱），不调�?freepublish 发出�?
  - **`published`**：`full` 在创建草稿后 **提交发布**（异步）。命令行 `full --publish` �?*显式**强制带发布一步（即使当前�?draft）�?
  - **`none`**：用户明确不填微信时写入�?*`full` 直接退�?*，不调任何微信接口；其它子命令（`token`、`create-draft` 等）仍须凭证，照常报错�?

微信发布配置分工�?
  - **`.niuma/teams/content/presets/editorial.yaml`**：文风、审稿等编辑部配置（不含 AppSecret�?
  - 工作区根 **`.env.local`**：`WECHAT_{i}_APPID`、`WECHAT_{i}_APPSECRET`、`WECHAT_{i}_NAME`、`WECHAT_{i}_API_BASE`
  - `WECHAT_N_API_BASE` 可空（空则使用官�?https://api.weixin.qq.com）�?

在仓库根执行示例�?
    python skills/article-publish-wechat/scripts/publish.py check-screening
    python skills/article-publish-wechat/scripts/publish.py full path/to/article-dir/

`full` 会先对目录内 **article.md** 运行 **format.py** 生成 **article.html**，再上传发布�?
禁止跳过排版直接发布�?HTML（除非调试时显式 `--skip-format`）�?
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import certifi  # type: ignore
except Exception:
    certifi = None

# base 仅域名；接口路径 /cgi-bin 拼在请求 URL �?
DEFAULT_API_BASE = "https://api.weixin.qq.com"
API_PATH = "/cgi-bin"
API_BASE = DEFAULT_API_BASE  # 运行时从 config 覆盖


def _err(msg: str):
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def _ok(msg: str):
    print(f"[OK] {msg}")


def _info(msg: str):
    print(f"[INFO] {msg}")


def _build_ssl_context():
    """Prefer certifi CA bundle for compatibility with legacy OpenSSL builds."""
    if certifi is not None:
        try:
            cafile = certifi.where()
            if cafile and Path(cafile).is_file():
                return ssl.create_default_context(cafile=cafile)
        except Exception:
            pass
    return None


_SSL_CONTEXT = _build_ssl_context()


def _urlopen(req_or_url, timeout: int):
    if _SSL_CONTEXT is not None:
        return urllib.request.urlopen(req_or_url, timeout=timeout, context=_SSL_CONTEXT)
    return urllib.request.urlopen(req_or_url, timeout=timeout)


# ── config.yaml（publish_method）──────────────────────────────

def _load_yaml_config(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        import yaml
    except ImportError:
        print("[ERROR] 需�?PyYAML：pip install pyyaml", file=sys.stderr)
        return None
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"[ERROR] 无法解析 YAML（{path}�? {e}", file=sys.stderr)
        return None
    if data is None:
        return {}
    if not isinstance(data, dict):
        return {}
    return data


def errors_for_publish_method(data: dict) -> list[str]:
    """config.yaml 顶层�?publish_method：缺省视�?draft；有值则须为 draft | published | none�?""
    raw = data.get("publish_method")
    if raw is None:
        return []
    s = str(raw).strip()
    if not s:
        return []
    pm = s.lower()
    if pm in ("draft", "published", "none"):
        return []
    return [f"publish_method 非法: {raw!r}，须�?draft、published �?none"]


def cmd_check_screening(config_path: Path) -> int:
    """校验仓库 config.yaml 中的 publish_method（子命令名沿�?check-screening）�?""
    data = _load_yaml_config(config_path)
    if data is None:
        print(f"[ERROR] 未找到文�? {config_path.resolve()}", file=sys.stderr)
        return 1
    errs = errors_for_publish_method(data)
    if errs:
        print("[ERROR] config.yaml �?publish_method 校验未通过�?, file=sys.stderr)
        for line in errs:
            print(f"   - {line}", file=sys.stderr)
        return 1
    raw = data.get("publish_method")
    if raw is None or not str(raw).strip():
        print("[OK] publish_method 未设置（将按默认 draft：仅创建公众号草稿，不自动发布）")
    else:
        pm = str(raw).strip().lower()
        print(f"[OK] publish_method={pm} 合法")
        if pm == "draft":
            print("[INFO] draft：`full` 默认只进草稿箱；若要发出请改 published 或执�?full --publish")
        elif pm == "published":
            print(
                "[INFO] published：`full` 将在创建草稿后提交发布。微信凭证：.env.local；可运行 check-wechat-env"
            )
        elif pm == "none":
            print(
                "[INFO] none：`full` 将不调微信接口；其它子命令（token、create-draft 等）仍需要凭�?
            )
    return 0


def load_repo_config(config_path: Path | None = None) -> dict:
    """读取 `.niuma/teams/content/presets/editorial.yaml`；缺失或无效返回 {}�?""
    p = config_path if config_path is not None else Path(".niuma/teams/content/presets/editorial.yaml")
    data = _load_yaml_config(p)
    if data is None or not isinstance(data, dict):
        return {}
    return data


def _parse_wechat_accounts_cfg(cfg: dict) -> int:
    raw = cfg.get("wechat_accounts")
    if raw is None or isinstance(raw, bool):
        n = 0
    elif isinstance(raw, int):
        n = raw if raw >= 1 else 0
    else:
        s = str(raw).strip()
        if not s:
            n = 0
        else:
            try:
                n = int(s)
            except ValueError:
                n = 0
            n = n if n >= 1 else 0
    if n >= 1:
        return n
    env = _load_env_map()
    slots = sorted(
        {
            int(m.group(1))
            for key in env
            for m in [__import__("re").match(r"WECHAT_(\d+)_(APPID|APPSECRET|NAME|API_BASE)$", key, __import__("re").I)]
            if m
        }
    )
    return max(slots) if slots else 0


# ── access_token ────────────────────────────────────────────

def get_access_token(appid: str, appsecret: str) -> str:
    """获取 access_token（有效期 2 小时）。网络类失败会自动重�?1 次�?""
    url = (
        f"{API_BASE}{API_PATH}/token?"
        f"grant_type=client_credential&appid={appid}&secret={appsecret}"
    )
    data = _api_get(url)
    if "access_token" not in data:
        errcode = data.get("errcode")
        hint = ""
        if errcode in (40013, 40125, 40164, 89004):
            hint = "（多�?AppID/AppSecret 错误�?IP 未加白名单，请检�?.env.local 对应槽位�?
        elif errcode == 40001:
            hint = "（access_token 无效类错误，请核对凭证）"
        _err(f"获取 access_token 失败: {data}{hint}")
    return data["access_token"]


# ── 图片压缩 ────────────────────────────────────────────────

def _compress_image(image_path: str, max_bytes: int, for_content: bool = False) -> str:
    """压缩图片到指定大小以内，返回压缩后的路径（可能是临时文件）�?

    封面/永久素材：max 10MB
    正文图片：max 1MB
    """
    path = Path(image_path)
    size = path.stat().st_size
    if size <= max_bytes:
        return image_path

    _info(f"图片 {path.name} ({size/1024:.0f}KB) 超过限制 ({max_bytes/1024:.0f}KB)，压缩中...")

    try:
        from PIL import Image
    except ImportError:
        _info("未安�?Pillow，跳过压缩（pip install Pillow�?)
        return image_path

    img = Image.open(path)
    if img.mode == "RGBA":
        img = img.convert("RGB")

    compressed_path = path.parent / f"{path.stem}_compressed.jpg"

    quality = 85
    while quality >= 20:
        img.save(compressed_path, "JPEG", quality=quality, optimize=True)
        if compressed_path.stat().st_size <= max_bytes:
            new_size = compressed_path.stat().st_size
            _ok(f"压缩完成: {new_size/1024:.0f}KB (quality={quality})")
            return str(compressed_path)
        quality -= 10

    max_dim = 1920 if not for_content else 1080
    img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    img.save(compressed_path, "JPEG", quality=60, optimize=True)
    new_size = compressed_path.stat().st_size
    _ok(f"压缩+缩放完成: {new_size/1024:.0f}KB")
    return str(compressed_path)


THUMB_MAX_BYTES = 10 * 1024 * 1024    # 封面 10MB
CONTENT_MAX_BYTES = 1 * 1024 * 1024   # 正文 1MB


# ── 上传图片 ────────────────────────────────────────────────

def upload_thumb(token: str, image_path: str) -> dict:
    """上传封面图为永久素材，返�?{media_id, url}。自动压缩到 10MB 以内�?""
    image_path = _compress_image(image_path, THUMB_MAX_BYTES)
    url = f"{API_BASE}{API_PATH}/material/add_material?access_token={token}&type=image"
    data = _upload_file(url, image_path, field_name="media")
    if "media_id" not in data:
        _err(f"上传封面图失�? {data}")
    return {"media_id": data["media_id"], "url": data.get("url", "")}


def upload_content_image(token: str, image_path: str) -> str:
    """上传正文内图片，返回可在正文中使用的 URL。自动压缩到 1MB 以内�?""
    image_path = _compress_image(image_path, CONTENT_MAX_BYTES, for_content=True)
    url = f"{API_BASE}{API_PATH}/media/uploadimg?access_token={token}"
    data = _upload_file(url, image_path, field_name="media")
    if "url" not in data:
        _err(f"上传正文图片失败: {data}")
    return data["url"]


# ── 草稿 ────────────────────────────────────────────────────

def create_draft(token: str, articles: list[dict]) -> str:
    """创建草稿，返�?media_id�?

    articles 中每个元素包含：
        title, content, thumb_media_id,
        author(可�?, digest(可�?,
        content_source_url(可�?,
        need_open_comment(可�? 0/1),
        only_fans_can_comment(可�? 0/1)
    """
    url = f"{API_BASE}{API_PATH}/draft/add?access_token={token}"
    body = {"articles": articles}
    data = _api_post_json(url, body)
    if "media_id" not in data:
        _err(f"创建草稿失败: {data}")
    return data["media_id"]


# ── 发布 ────────────────────────────────────────────────────

def publish_draft(token: str, media_id: str) -> str:
    """发布草稿（异步），返�?publish_id�?""
    url = f"{API_BASE}{API_PATH}/freepublish/submit?access_token={token}"
    data = _api_post_json(url, {"media_id": media_id})
    if "publish_id" not in data:
        _err(f"提交发布失败: {data}")
    return data["publish_id"]


def get_publish_status(token: str, publish_id: str) -> dict:
    """查询发布状态�?

    返回 publish_status:
        0=成功, 1=发布�? 2=原创失败, 3=常规失败,
        4=审核不通过, 5=已删�? 6=已封�?
    """
    url = f"{API_BASE}{API_PATH}/freepublish/get?access_token={token}"
    return _api_post_json(url, {"publish_id": publish_id})


# ── 往期文�?────────────────────────────────────────────────

def get_published_articles(token: str, offset: int = 0, count: int = 10,
                           no_content: bool = True) -> dict:
    """获取已发布的文章列表�?

    Args:
        offset: 偏移位置�? = 从最新开�?
        count: 返回数量�?-20
        no_content: True = 不返回正文（省流量）
    """
    url = f"{API_BASE}{API_PATH}/freepublish/batchget?access_token={token}"
    body = {"offset": offset, "count": count, "no_content": 1 if no_content else 0}
    return _api_post_json(url, body)


def list_recent_articles(token: str, count: int = 10) -> list[dict]:
    """获取最近发布的文章，返�?[{title, url, update_time}]�?""
    result = get_published_articles(token, offset=0, count=count)
    articles = []
    for item in result.get("item", []):
        content = item.get("content", {})
        for art in content.get("news_item", []):
            articles.append({
                "title": art.get("title", ""),
                "url": art.get("url", ""),
                "digest": art.get("digest", ""),
                "update_time": item.get("update_time", ""),
            })
    return articles


# ── 排版（发布前强制）────────────────────────────────────────

def _format_script_path() -> Path:
    skill_publish = Path(__file__).resolve().parent.parent
    return (
        skill_publish.parent
        / "article-formatting-wechat"
        / "scripts"
        / "format.py"
    )


def regenerate_article_html(article_dir: Path) -> None:
    """Always rebuild article.html from the on-disk article.md before publish."""
    md_path = article_dir / "article.md"
    if not md_path.is_file():
        _err(f"未找�?{md_path}，无法从 Markdown 重新排版")

    format_script = _format_script_path()
    if not format_script.is_file():
        _err(f"未找到排版脚�?{format_script}")

    try:
        md_arg = str(md_path.relative_to(Path.cwd()))
    except ValueError:
        md_arg = str(md_path.resolve())

    _info(f"发布前从最�?article.md 重新排版: {md_arg}")
    result = subprocess.run(
        [sys.executable, str(format_script), md_arg],
        cwd=Path.cwd(),
    )
    if result.returncode != 0:
        _err(f"format.py 失败（exit {result.returncode}），已中止发�?)

    html_path = article_dir / "article.html"
    if not html_path.is_file():
        _err(f"排版后未生成 {html_path}")
    _ok(f"已生�?{html_path}")


# ── 全流�?──────────────────────────────────────────────────

def full_publish(
    token: str,
    article_dir: str,
    do_publish: bool = False,
    skip_format: bool = False,
):
    """一键全流程：读取文章目�?�?上传图片 �?创建草稿 �?可选发布�?

    文章目录结构�?
        article_dir/
        ├── article.yaml    文章元信息（title, author, digest 等）
        ├── article.html    排版后的正文 HTML
        ├── cover.jpg       封面�?
        └── imgs/           正文内图片（可选）
            ├── 01-xxx.png
            └── 02-xxx.jpg
    """
    article_dir = Path(article_dir)

    if not skip_format:
        regenerate_article_html(article_dir)
    else:
        _info("已跳�?format.py�?-skip-format）；将直接使用现�?article.html")

    meta_path = article_dir / "article.yaml"
    if not meta_path.exists():
        _err(f"未找�?{meta_path}")

    import yaml  # lazy import，仅全流程需�?
    with open(meta_path, encoding="utf-8") as f:
        meta = yaml.safe_load(f)

    cfg = load_repo_config()
    author = (meta.get("author") or "").strip() or str(
        cfg.get("default_author") or ""
    ).strip()

    content_path = article_dir / "article.html"
    if not content_path.exists():
        _err(f"未找�?{content_path}")
    content = content_path.read_text(encoding="utf-8")

    # 上传封面（优�?article_dir/cover.*，fallback imgs/cover.* �?imgs/*-cover.*�?
    _cover_names = ["cover.jpg", "cover.png", "cover.jpeg", "cover.webp"]
    cover_path = _find_file(article_dir, _cover_names)
    if not cover_path:
        _imgs = article_dir / "imgs"
        if _imgs.is_dir():
            cover_path = _find_file(_imgs, _cover_names)
            if not cover_path:
                for _sfx in (".jpg", ".png", ".jpeg", ".webp"):
                    _cands = sorted(_imgs.glob(f"*-cover{_sfx}"))
                    if _cands:
                        cover_path = _cands[0]
                        break
    if not cover_path:
        _err("未找到封面图（cover.jpg/png/jpeg/webp）；支持 article_dir/ �?imgs/ �?)
    _info(f"上传封面�? {cover_path}")
    thumb = upload_thumb(token, str(cover_path))
    _ok(f"封面图上传成�? media_id={thumb['media_id']}")

    # 上传正文图片并替换路径（仅上�?HTML 中实际引用的 imgs/ 文件�?
    imgs_dir = article_dir / "imgs"
    if imgs_dir.exists():
        for fname in _content_image_refs_flat(content):
            img_file = imgs_dir / fname
            if not img_file.is_file():
                _err(f"正文引用了不存在的图�? imgs/{fname}")
            _info(f"上传正文图片: {img_file.name}")
            img_url = upload_content_image(token, str(img_file))
            content = content.replace(f"imgs/{img_file.name}", img_url)
            content = content.replace(img_file.name, img_url)
            _ok(f"  �?{img_url}")

    if "tempkey=" in content or "tempkey%3D" in content:
        _err(
            "正文 HTML 仍含 tempkey 预览链（常见�?getdraft list-fields 返回�?url）�?
            "微信 draft/add 常因此返�?45166 invalid content�?
            "请改用已群发文章的永久链接（后台对该文「复制链接」），或从正文去掉相关超链后重试�?
        )

    # 构建草稿（author 优先 article.yaml，为空时�?config.yaml default_author�?
    article = {
        "title": meta.get("title", ""),
        "author": author,
        "digest": meta.get("digest", ""),
        "content": content,
        "thumb_media_id": thumb["media_id"],
        "content_source_url": meta.get("content_source_url", ""),
        "need_open_comment": meta.get("need_open_comment", 0),
        "only_fans_can_comment": meta.get("only_fans_can_comment", 0),
    }
    _info("创建草稿...")
    media_id = create_draft(token, [article])
    _ok(f"草稿创建成功: media_id={media_id}")

    # 可选发�?
    if do_publish:
        _info("提交发布...")
        publish_id = publish_draft(token, media_id)
        _ok(f"发布任务已提�? publish_id={publish_id}")
        _info("等待发布结果（异步，轮询中）...")
        _poll_publish_status(token, publish_id)
    else:
        _info("草稿已创建，未发布。如需发布�?)
        print(
            "  python skills/article-publish-wechat/scripts/publish.py publish "
            f"{media_id}"
        )

    return media_id


def _poll_publish_status(token: str, publish_id: str, max_wait: int = 60):
    """轮询发布状态，最多等�?max_wait 秒�?""
    status_map = {
        0: "[OK] 发布成功",
        1: "[INFO] 发布�?,
        2: "[ERROR] 原创失败",
        3: "[ERROR] 常规失败",
        4: "[ERROR] 平台审核不通过",
        5: "[ERROR] 已删�?,
        6: "[ERROR] 已封�?,
    }
    start = time.time()
    while time.time() - start < max_wait:
        result = get_publish_status(token, publish_id)
        status = result.get("publish_status", -1)
        print(f"  状�? {status_map.get(status, f'未知({status})')}")
        if status != 1:
            return result
        time.sleep(3)
    _info(f"已等�?{max_wait}s，发布仍在进行中。可稍后查询�?)
    print(
        "  python skills/article-publish-wechat/scripts/publish.py status "
        f"{publish_id}"
    )


# ── HTTP 工具 ───────────────────────────────────────────────

def _is_transient_network_error(e: BaseException) -> bool:
    if isinstance(e, urllib.error.URLError):
        return True
    if isinstance(e, TimeoutError):
        return True
    if isinstance(e, urllib.error.HTTPError) and e.code >= 500:
        return True
    return False


def _api_get(url: str) -> dict:
    last: BaseException | None = None
    t_req, _ = _wechat_http_timeouts()
    for attempt in range(2):
        try:
            req = urllib.request.Request(url)
            with _urlopen(req, timeout=t_req) as resp:
                return json.loads(resp.read())
        except Exception as e:
            last = e
            if attempt == 0 and _is_transient_network_error(e):
                _info("【网络】请求失败，1 秒后重试一次�?)
                time.sleep(1)
                continue
            raise
    raise last  # pragma: no cover


def _api_post_json(url: str, body: dict) -> dict:
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    last: BaseException | None = None
    t_req, _ = _wechat_http_timeouts()
    for attempt in range(2):
        try:
            req = urllib.request.Request(
                url, data=payload, headers={"Content-Type": "application/json"}
            )
            with _urlopen(req, timeout=t_req) as resp:
                return json.loads(resp.read())
        except Exception as e:
            last = e
            if attempt == 0 and _is_transient_network_error(e):
                _info("【网络】请求失败，1 秒后重试一次�?)
                time.sleep(1)
                continue
            raise
    raise last  # pragma: no cover


def _upload_file(url: str, file_path: str, field_name: str = "media") -> dict:
    """multipart/form-data 文件上传（纯标准库实现）�?""
    boundary = f"----WechatPublish{int(time.time() * 1000)}"
    file_path = Path(file_path)
    if not file_path.exists():
        _err(f"文件不存�? {file_path}")

    mime_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    file_data = file_path.read_bytes()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{field_name}"; '
        f'filename="{file_path.name}"\r\n'
        f"Content-Type: {mime_type}\r\n\r\n"
    ).encode("utf-8") + file_data + f"\r\n--{boundary}--\r\n".encode("utf-8")

    last: BaseException | None = None
    _, t_up = _wechat_http_timeouts()
    for attempt in range(2):
        try:
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            )
            with _urlopen(req, timeout=t_up) as resp:
                return json.loads(resp.read())
        except Exception as e:
            last = e
            if attempt == 0 and _is_transient_network_error(e):
                _info("【网络】上传失败，1 秒后重试一次�?)
                time.sleep(1)
                continue
            raise
    raise last  # pragma: no cover


def _find_file(directory: Path, candidates: list[str]) -> Path | None:
    for name in candidates:
        p = directory / name
        if p.exists():
            return p
    return None


def _content_image_refs_flat(html: str) -> list[str]:
    """�?article.html 中解析正文引用的 imgs/ 文件名（仅单层文件名，去重保序）�?

    避免上传 imgs 目录下压缩缓�?*_compressed.jpg、prompts 子目录等未被引用的文件�?
    """
    seen: set[str] = set()
    out: list[str] = []
    for m in re.finditer(r'imgs/([^"\'<>\s]+)', html, flags=re.IGNORECASE):
        name = m.group(1).strip()
        if not name or "/" in name or "\\" in name or ".." in name:
            continue
        low = name.lower()
        if not low.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
            continue
        if name not in seen:
            seen.add(name)
            out.append(name)
    return out


# ── 工作�?.env.local（微信凭证，不再�?aws.env）────────────────

def _resolve_env_path() -> Path:
    candidates = [
        Path(".env.local"),
        Path("..") / ".env.local",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return Path(".env.local")


def _parse_dotenv(content: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key] = val
    return out


def _load_env_map() -> dict[str, str]:
    path = _resolve_env_path()
    if not path.is_file():
        return {}
    try:
        return _parse_dotenv(path.read_text(encoding="utf-8"))
    except OSError:
        return {}


# 微信 HTTP 超时（秒）：默认较原 30/60 放宽，慢代理或大图上传统计更�?
_DEFAULT_WECHAT_REQUEST_TIMEOUT = 60
_DEFAULT_WECHAT_UPLOAD_TIMEOUT = 120


def _wechat_http_timeouts() -> tuple[int, int]:
    """从仓库根 env 文件读取 (普通请求超�? 文件上传超时)，单位秒�?""
    env = _load_env_map()
    req = _DEFAULT_WECHAT_REQUEST_TIMEOUT
    up = _DEFAULT_WECHAT_UPLOAD_TIMEOUT
    raw_req = (env.get("WECHAT_REQUEST_TIMEOUT") or "").strip()
    if raw_req:
        try:
            req = max(5, int(raw_req))
        except ValueError:
            pass
    raw_up = (env.get("WECHAT_UPLOAD_TIMEOUT") or "").strip()
    if raw_up:
        try:
            up = max(10, int(raw_up))
        except ValueError:
            pass
    return req, up


def _wechat_slot_keys(i: int) -> tuple[str, str, str]:
    return (
        f"WECHAT_{i}_APPID",
        f"WECHAT_{i}_APPSECRET",
        f"WECHAT_{i}_API_BASE",
    )


def wechat_slot(cfg: dict, env: dict[str, str], i: int) -> dict:
    ak, sk, bk = _wechat_slot_keys(i)
    return {
        "slot": i,
        "name": str(env.get(f"WECHAT_{i}_NAME") or cfg.get(f"wechat_{i}_name") or "").strip(),
        "appid": (env.get(ak) or "").strip(),
        "appsecret": (env.get(sk) or "").strip(),
        "api_base": (env.get(bk) or "").strip(),
    }


def missing_wechat_slot_fields(slot: dict) -> list[str]:
    """用于完整性提示：APPID、APPSECRET；API_BASE 可空�?""
    miss: list[str] = []
    if not slot["appid"]:
        miss.append("APPID")
    if not slot["appsecret"]:
        miss.append("APPSECRET")
    return miss


def list_wechat_slots(cfg: dict, env: dict[str, str]) -> list[dict]:
    n = _parse_wechat_accounts_cfg(cfg)
    return [wechat_slot(cfg, env, i) for i in range(1, n + 1)]


def cmd_check_wechat_env() -> int:
    """�?.env.local 槽位检�?WECHAT_N_APPID/APPSECRET 是否齐全�?""
    cfg = load_repo_config()
    env = _load_env_map()
    env_path = _resolve_env_path()
    if not env and not env_path.is_file():
        print("[ERROR] 未找�?.env.local（工作区根）", file=sys.stderr)
        return 1
    n = _parse_wechat_accounts_cfg(cfg)
    if n < 1:
        print("[ERROR] .env.local 中未解析�?WECHAT_N_APPID 槽位", file=sys.stderr)
        return 1
    bad = False
    for slot in list_wechat_slots(cfg, env):
        miss = missing_wechat_slot_fields(slot)
        if miss:
            bad = True
            keys = ", ".join(f"WECHAT_{slot['slot']}_{m}" for m in miss)
            print(
                f"[ERROR] �?{slot['slot']} 个微信账号未填完整：缺少 {', '.join(miss)}（{keys}�?,
                file=sys.stderr,
            )
        else:
            _ok(
                f"槽位 {slot['slot']}: {slot['name'] or '(未命�?'} �?APPID/SECRET 已填"
            )
    return 1 if bad else 0


# full 流程�?config.yaml wechat_publish_slot 写入的槽位（1..N），�?_get_credentials 使用
_draft_wechat_slot: int | None = None


def _resolve_slot_index(
    cfg: dict,
    env: dict[str, str],
    account_alias: str | None,
    preferred_slot: int | None,
) -> int:
    n = _parse_wechat_accounts_cfg(cfg)
    if n < 1:
        _err(
            "config.yaml �?wechat_accounts 无效或未设置。\n"
            "请设�?wechat_accounts=1，并�?config.yaml 填写 wechat_1_name�?
        )
    # 命令�?--account 优先�?config.yaml �?wechat_publish_slot
    if account_alias:
        s = str(account_alias).strip()
        if s.isdigit():
            si = int(s)
            if 1 <= si <= n:
                _info(f"使用 --account 指定槽位 {si}")
                return si
            _err(f"--account 槽位序号须在 1..{n} 之间")
        for i in range(1, n + 1):
            sl = wechat_slot(cfg, env, i)
            nm = sl["name"]
            if nm and (s == nm or s in nm):
                _info(f"使用名称匹配的槽�?{i}: {nm}")
                return i
        _err(
            f"未找到账�?'{account_alias}'�?
            f"请使用槽位序�?1..{n} �?config.yaml �?wechat_N_name 的展示名�?
        )
    if preferred_slot is not None:
        if 1 <= preferred_slot <= n:
            _info(f"使用 config.yaml 中的 wechat_publish_slot={preferred_slot}")
            return preferred_slot
        _err(
            f"config.yaml �?wechat_publish_slot={preferred_slot} 超出范围�?
            f"当前 wechat_accounts={n}（有�?1..{n}�?
        )
    if n == 1:
        return 1
    _err(
        f"配置�?{n} 个微信槽位，请指定账号：\n"
        "  --account <1..N �?wechat_N_name 子串>\n"
        "或在 .niuma/teams/content/presets/editorial.yaml 中设�?wechat_publish_slot: <整数>"
    )


def _active_slot_dict(cfg: dict, env: dict[str, str], slot_index: int) -> dict:
    return wechat_slot(cfg, env, slot_index)


def _get_credentials(account_alias: str | None) -> tuple[str, str]:
    cfg = load_repo_config()
    env = _load_env_map()
    if not _resolve_env_path().is_file():
        _err(
            "未找�?.env.local。请在工作区根创�?.env.local�?
            "并填�?WECHAT_1_APPID、WECHAT_1_APPSECRET�?
        )
    slot_i = _resolve_slot_index(cfg, env, account_alias, _draft_wechat_slot)
    slot = _active_slot_dict(cfg, env, slot_i)
    if not slot["appid"] or not slot["appsecret"]:
        miss = missing_wechat_slot_fields(slot)
        _err(
            f"�?{slot_i} 个账号缺少微信凭证（需 APPID、APPSECRET）�?
            f"�? {', '.join(miss) if miss else 'APPID/APPSECRET'}\n"
            f"请补�?WECHAT_{slot_i}_APPID / WECHAT_{slot_i}_APPSECRET"
        )
    return slot["appid"], slot["appsecret"]


# ── CLI ─────────────────────────────────────────────────────

_cli_account: str | None = None


def _slot_for_api_base(cfg: dict, env: dict[str, str]) -> int | None:
    """不抛错；无法唯一确定槽位时返�?None。CLI --account 优先�?wechat_publish_slot�?""
    n = _parse_wechat_accounts_cfg(cfg)
    if n < 1:
        return None
    if _cli_account:
        s = str(_cli_account).strip()
        if s.isdigit():
            si = int(s)
            if 1 <= si <= n:
                return si
            return None
        for i in range(1, n + 1):
            sl = wechat_slot(cfg, env, i)
            nm = sl["name"]
            if nm and (s == nm or s in nm):
                return i
        return None
    if _draft_wechat_slot is not None and 1 <= _draft_wechat_slot <= n:
        return _draft_wechat_slot
    if n == 1:
        return 1
    return None


def _normalize_api_base(raw: str) -> str:
    api_base = raw.strip().rstrip("/")
    if api_base.endswith("/cgi-bin"):
        api_base = api_base[:-8].rstrip("/")
    return api_base


def _resolve_api_base(cfg: dict, slot: dict) -> str:
    """槽位 WECHAT_N_API_BASE 优先；为空时回退 config.yaml.wechat_api_base�?""
    slot_base = (slot.get("api_base") or "").strip()
    if slot_base:
        return _normalize_api_base(slot_base)
    cfg_base = str(cfg.get("wechat_api_base") or "").strip()
    if cfg_base:
        return _normalize_api_base(cfg_base)
    return ""


def _init_api_base():
    """优先用槽�?WECHAT_N_API_BASE；为空则回退 config.yaml.wechat_api_base�?""
    global API_BASE
    API_BASE = DEFAULT_API_BASE
    cfg = load_repo_config()
    env = _load_env_map()
    if not env:
        return
    slot_i = _slot_for_api_base(cfg, env)
    if slot_i is None:
        return
    slot = _active_slot_dict(cfg, env, slot_i)
    api_base = _resolve_api_base(cfg, slot)
    if not api_base:
        return
    API_BASE = api_base
    _info(f"API 端点: {API_BASE}{API_PATH}")

def _get_token() -> str:
    _init_api_base()
    appid, appsecret = _get_credentials(_cli_account)
    return get_access_token(appid, appsecret)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="微信公众号发布工�?,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--account",
        help="微信槽位：填 1..N �?config.yaml �?wechat_N_name 的展示名",
    )
    sub = parser.add_subparsers(dest="command", help="子命�?)

    p_scr = sub.add_parser(
        "check-screening",
        help="校验仓库 .niuma/teams/content/presets/editorial.yaml 中的 publish_method（draft / published / none�?,
    )
    p_scr.add_argument(
        "--config",
        type=Path,
        default=Path(".niuma/teams/content/presets/editorial.yaml"),
        metavar="FILE",
        help="默认 .niuma/teams/content/presets/editorial.yaml",
    )

    sub.add_parser("token", help="获取 access_token")

    p_thumb = sub.add_parser("upload-thumb", help="上传封面图（永久素材，自动压缩）")
    p_thumb.add_argument("image", help="图片路径")

    p_img = sub.add_parser("upload-content-image", help="上传正文图片（自动压缩）")
    p_img.add_argument("image", help="图片路径")

    p_draft = sub.add_parser("create-draft", help="�?YAML 创建草稿")
    p_draft.add_argument("article_yaml", help="article.yaml 路径")

    p_pub = sub.add_parser("publish", help="发布草稿")
    p_pub.add_argument("media_id", help="草稿 media_id")

    p_status = sub.add_parser("status", help="查询发布状�?)
    p_status.add_argument("publish_id", help="发布任务 publish_id")

    p_full = sub.add_parser("full", help="一键全流程（先 format 再上传）")
    p_full.add_argument("article_dir", help="文章目录路径")
    p_full.add_argument("--publish", action="store_true", help="创建草稿后立即发�?)
    p_full.add_argument(
        "--skip-format",
        action="store_true",
        help="调试专用：跳�?format.py，直接使用现�?article.html",
    )

    sub.add_parser("accounts", help="列出 config.yaml 中的微信槽位与名�?)
    sub.add_parser("check", help="检查发布环境（.env 微信槽位等）")
    sub.add_parser(
        "check-wechat-env",
        help="�?.env.local 槽位检�?WECHAT_N_APPID/APPSECRET 是否已填�?,
    )

    p_recent = sub.add_parser("recent-articles", help="获取最近发布的文章")
    p_recent.add_argument("-n", "--count", type=int, default=5, help="数量（默�?�?)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    global _cli_account
    _cli_account = args.account

    if args.command == "check-screening":
        return cmd_check_screening(args.config)

    if args.command == "accounts":
        cfg = load_repo_config()
        env = _load_env_map()
        ep = _resolve_env_path()
        if not ep.is_file():
            print("[ERROR] 未找�?.env.local（工作区根）")
            return 1
        n = _parse_wechat_accounts_cfg(cfg)
        if n < 1:
            print("[ERROR] config.yaml �?wechat_accounts 无效")
            return 1
        print(f"微信槽位（共 {n} 个，名称来自 config.yaml，凭证来�?{ep.name}）：")
        for i in range(1, n + 1):
            s = wechat_slot(cfg, env, i)
            miss = missing_wechat_slot_fields(s)
            mark = " [OK]" if not miss else f" [WARN] �? {','.join(miss)}"
            print(f"  {i}. {s['name'] or '(未命�?'}{mark}")
        return 0

    if args.command == "check-wechat-env":
        return cmd_check_wechat_env()

    if args.command == "check":
        _run_checks()
        return 0

    if args.command == "recent-articles":
        token = _get_token()
        articles = list_recent_articles(token, count=args.count)
        if not articles:
            _info("暂无已发布文�?)
        else:
            print(f"最�?{len(articles)} 篇已发布文章：\n")
            for i, art in enumerate(articles, 1):
                print(f"  {i}. {art['title']}")
                print(f"     {art['url']}")
                print()
        return 0

    if args.command == "token":
        token = _get_token()
        _ok(f"access_token: {token[:20]}...")
        print(token)

    elif args.command == "upload-thumb":
        token = _get_token()
        result = upload_thumb(token, args.image)
        _ok(f"media_id: {result['media_id']}")
        _ok(f"url: {result['url']}")

    elif args.command == "upload-content-image":
        token = _get_token()
        url = upload_content_image(token, args.image)
        _ok(f"url: {url}")

    elif args.command == "create-draft":
        token = _get_token()
        import yaml

        ay = Path(args.article_yaml)
        with open(ay, encoding="utf-8") as f:
            meta = yaml.safe_load(f)
        default_author = str(load_repo_config().get("default_author") or "").strip()
        articles = meta.get("articles", [meta])
        for art in articles:
            if not (art.get("author") or "").strip():
                art["author"] = default_author
        media_id = create_draft(token, articles)
        _ok(f"草稿 media_id: {media_id}")

    elif args.command == "publish":
        token = _get_token()
        publish_id = publish_draft(token, args.media_id)
        _ok(f"publish_id: {publish_id}")
        _poll_publish_status(token, publish_id)

    elif args.command == "status":
        token = _get_token()
        result = get_publish_status(token, args.publish_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif args.command == "full":
        global _draft_wechat_slot
        ad = Path(args.article_dir)
        _draft_wechat_slot = None
        cfg = load_repo_config()
        pe = errors_for_publish_method(cfg)
        if pe:
            for line in pe:
                print(f"[ERROR] {line}", file=sys.stderr)
            return 1
        pm = str(cfg.get("publish_method") or "draft").strip().lower() or "draft"
        if pm == "none":
            if args.publish:
                _info("已忽�?--publish：config.yaml �?publish_method �?none�?)
            _info("publish_method: none �?不调用微�?API，不执行发布或草稿上传�?)
            _ok("已按配置跳过 publish.py full（可继续本地写稿/排版等）")
            return 0
        if pm not in ("draft", "published"):
            print(
                f"[ERROR] config.yaml �?publish_method 须为 draft、published �?none，当�? {pm!r}",
                file=sys.stderr,
            )
            return 1
        do_publish = bool(args.publish) or (pm == "published")
        ws = cfg.get("wechat_publish_slot")
        if ws is not None and str(ws).strip() != "":
            try:
                _draft_wechat_slot = int(ws)
            except (TypeError, ValueError):
                print(
                    "[ERROR] config.yaml �?wechat_publish_slot 须为整数",
                    file=sys.stderr,
                )
                return 1
        try:
            token = _get_token()
            full_publish(
                token,
                args.article_dir,
                do_publish=do_publish,
                skip_format=bool(getattr(args, "skip_format", False)),
            )
        finally:
            _draft_wechat_slot = None

    return 0


def _run_checks():
    """检查发布环境（.env.local 微信槽位、依赖等）�?""
    print("=== 发布环境检�?===\n")
    issues: list[str] = []
    cfg = load_repo_config()
    n_cfg = _parse_wechat_accounts_cfg(cfg)

    ep = _resolve_env_path()
    if not ep.is_file():
        print("[ERROR] 未找�?.env.local（工作区根）")
        issues.append("在工作区根创�?.env.local，填�?WECHAT_1_APPID / WECHAT_1_APPSECRET")
        env = {}
    else:
        _ok(f"环境文件找到: {ep.resolve()}")
        env = _load_env_map()
    if n_cfg < 1:
        print("[ERROR] .env.local 中未解析�?WECHAT_N_APPID 槽位")
        issues.append("�?.env.local 填写 WECHAT_1_APPID / WECHAT_1_APPSECRET（及可�?WECHAT_1_NAME�?)
    else:
        for i in range(1, n_cfg + 1):
            s = wechat_slot(cfg, env, i)
            miss = missing_wechat_slot_fields(s)
            if miss:
                print(f"  [ERROR] 槽位 {i} ({s['name'] or '未命�?}): 缺少 {', '.join(miss)}")
                keys = ", ".join(f"WECHAT_{i}_{m}" for m in miss)
                issues.append(f"补全 .env.local 槽位 {i}: {keys}")
            elif s["name"]:
                _ok(f"  槽位 {i} ({s['name']}): APPID/SECRET 已填")
            else:
                _ok(f"  槽位 {i}: APPID/SECRET 已填")

    # API 连通性：用第一�?APPID+SECRET 齐全的槽位探�?
    probe_i: int | None = None
    for i in range(1, n_cfg + 1):
        s = wechat_slot(cfg, env, i)
        if s["appid"] and s["appsecret"]:
            probe_i = i
            break
    if probe_i is not None:
        s = wechat_slot(cfg, env, probe_i)
        global API_BASE
        API_BASE = DEFAULT_API_BASE
        api_base = _resolve_api_base(cfg, s)
        if api_base:
            API_BASE = api_base
        try:
            url = (
                f"{API_BASE}{API_PATH}/token?"
                f"grant_type=client_credential&appid={s['appid']}&secret={s['appsecret']}"
            )
            data = _api_get(url)
            if "access_token" in data:
                tok = data["access_token"]
                _ok(f"API 连通正常（槽位 {probe_i}，token: {tok[:16]}...�?)
            else:
                print(f"[ERROR] 微信接口返回: {data}")
                issues.append(
                    f"槽位 {probe_i} 凭证或白名单有误（见 errcode/errmsg），请检�?.env"
                )
        except Exception as e:
            print(f"[ERROR] API 连通失�? {e}")
            issues.append("网络异常或微信接口不可用，可稍后重试")

    try:
        import yaml
        _ok("PyYAML 已安�?)
    except ImportError:
        print("[ERROR] PyYAML 未安�?)
        issues.append("pip install pyyaml")

    try:
        from PIL import Image
        _ok("Pillow 已安装（图片压缩可用�?)
    except ImportError:
        print("[WARN] Pillow 未安装（大图上传可能失败�?)
        issues.append("建议: pip install Pillow")

    print("\n=== 检查完�?===")
    if issues:
        print(f"\n需要处理的问题（{len(issues)} 个）�?)
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
    else:
        _ok("发布相关检查通过�?)


if __name__ == "__main__":
    raise SystemExit(main())
