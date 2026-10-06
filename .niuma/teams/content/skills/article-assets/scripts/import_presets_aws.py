#!/usr/bin/env python3
"""
导入 `.aws` 预设包（ZIP 格式）：解压到 `.niuma/teams/content/presets/.import-tmp/`，
合并到 `.niuma/teams/content/presets/<子目录>/`。

包根若含 `config.yaml`：
  - 若本地尚无 `.niuma/teams/content/presets/editorial.yaml`，则从包内复制一份；
  - 若本地已存在，则**不覆盖**；按包内字段在本地同名路径上递归比对，将差异以 **JSON 数组**
    打印到 **stdout**（供智能体读取后询问用户再手改配置）。

`.env.local` 增量写入（仅微信槽位）：
  - 包内 config.yaml 的 wechat_appid / wechat_appsecret 映射到 `WECHAT_1_APPID` / `WECHAT_1_APPSECRET`
  - 不写 WRITING_MODEL_API_KEY / IMAGE_MODEL_API_KEY（写稿/配图走应用「设置 → API 提供商」）

合并规则（以服务端为准的「替换式」）：
  - 对每个预设子目录，若**包内存在**该子目录，则**先清空本地对应目录**再写入包内内容；
  - 若包内**不存在**某子目录，本地对应子目录**保持不动**。

用法（工作区根）：
  python .niuma/teams/content/skills/article-assets/scripts/import_presets_aws.py path/to/bundle.aws
  python .niuma/teams/content/skills/article-assets/scripts/import_presets_aws.py path/to/bundle.aws --dry-run
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import urllib.error
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[misc, assignment]

TEAM_CONTENT_REL = Path(".niuma/teams/content")
PRESETS_REL = TEAM_CONTENT_REL / "presets"
TEAM_CONFIG_REL = PRESETS_REL / "editorial.yaml"
IMPORT_TMP_REL = PRESETS_REL / ".import-tmp"
DOWNLOADS_REL = PRESETS_REL / "downloads"

PRESET_SUBDIRS = (
    "article-blocks",
    "closing-blocks",
    "cover-styles",
    "formatting",
    "image-styles",
    "sticker-styles",
    "structures",
    "title-styles",
)

SKIP_NAMES = frozenset({"__MACOSX", ".DS_Store"})

ALLOWED_HOST_EXACT = "aiworkskills.cn"
ALLOWED_HOST_SUFFIX = ".aiworkskills.cn"
DOWNLOAD_TIMEOUT_SEC = 30

# 包内 config.yaml 字段（点分路径） → `.env.local` 键名（仅微信槽位 1）。
SECRET_FIELD_MAP: tuple[tuple[str, str], ...] = (
    ("wechat_appid", "WECHAT_1_APPID"),
    ("wechat_appsecret", "WECHAT_1_APPSECRET"),
)


def _is_url(s: str) -> bool:
    return s.startswith(("http://", "https://"))


def _validate_url(url: str, allow_any_host: bool) -> None:
    p = urlparse(url)
    if p.scheme != "https":
        _err(f"仅允许 https:// 下载预设包，收到: {p.scheme}://")
    host = (p.hostname or "").lower()
    if not allow_any_host:
        if host != ALLOWED_HOST_EXACT and not host.endswith(ALLOWED_HOST_SUFFIX):
            _err(f"域名不在白名单（仅 aiworkskills.cn 及其子域）: {host}")
    if not Path(p.path).name.endswith(".aws"):
        _err("URL 路径须以 .aws 结尾")


def _download_bundle(url: str, repo: Path) -> Path:
    downloads = repo / DOWNLOADS_REL
    downloads.mkdir(parents=True, exist_ok=True)
    fname = Path(urlparse(url).path).name or "bundle.aws"
    local = downloads / fname
    tmp_out = local.with_suffix(local.suffix + ".part")
    req = urllib.request.Request(url, headers={"User-Agent": "article-assets/1.0"})
    _info(f"下载中: {url}")
    try:
        with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT_SEC) as resp, open(tmp_out, "wb") as out:
            shutil.copyfileobj(resp, out)
    except urllib.error.HTTPError as e:
        _err(f"HTTP {e.code} 下载失败: {url}")
    except urllib.error.URLError as e:
        _err(f"网络错误: {e.reason}")
    shutil.move(str(tmp_out), str(local))
    if not zipfile.is_zipfile(local):
        _err(f"下载内容不是有效 ZIP（已保留 {local} 供排查）")
    _ok(f"已下载: {local.as_posix()}")
    return local


def _err(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)


def _info(msg: str) -> None:
    print(f"[INFO] {msg}", file=sys.stderr)


def _ok(msg: str) -> None:
    print(f"[OK] {msg}", file=sys.stderr)


def _find_repo_root(start: Path) -> Path:
    """工作区根 = `--repo` 指向的目录（默认当前工作目录）。"""
    cur = start.resolve()
    if not cur.is_dir():
        _err(f"指定的仓库根不是目录：{cur}")
    if any(
        (cur / marker).exists()
        for marker in (PRESETS_REL, TEAM_CONFIG_REL, Path(".niuma"), Path(".git"))
    ):
        return cur
    _err(
        f"{cur} 不像 Niuma 工作区根（未检测到 .niuma/teams/content/presets、config.yaml 或 .git）。\n"
        "请传入 --repo 指向工作区根，或在工作区根下运行。"
    )


def _ensure_team_layout(repo: Path) -> None:
    (repo / PRESETS_REL).mkdir(parents=True, exist_ok=True)
    (repo / TEAM_CONTENT_REL).mkdir(parents=True, exist_ok=True)


def _should_skip_path(path: Path) -> bool:
    parts = path.parts
    if "__MACOSX" in parts:
        return True
    if path.name == ".DS_Store":
        return True
    return False


def _staging_dir(repo: Path) -> Path:
    return repo / IMPORT_TMP_REL


def _reset_staging(staging: Path) -> None:
    if staging.exists():
        _info(f"清空暂存目录: {staging.as_posix()}")
        shutil.rmtree(staging, ignore_errors=False)
    staging.mkdir(parents=True, exist_ok=True)


def _safe_extractall(zf: zipfile.ZipFile, dest: Path) -> None:
    dest_resolved = dest.resolve()
    for name in zf.namelist():
        member_path = Path(name)
        if member_path.is_absolute():
            _err(f"ZIP 内含绝对路径（可能的路径穿越攻击），已拒绝解压: {name}")
        if ".." in member_path.parts:
            _err(f"ZIP 内含 '..' 段（可能的路径穿越攻击），已拒绝解压: {name}")
        target = (dest / name).resolve()
        try:
            target.relative_to(dest_resolved)
        except ValueError:
            _err(f"ZIP 内路径指向解压目录外（可能的路径穿越攻击），已拒绝解压: {name}")
    zf.extractall(dest)


def _resolve_package_root(extracted: Path) -> Path:
    items = [p for p in extracted.iterdir() if p.name not in SKIP_NAMES and not p.name.startswith(".")]
    if len(items) == 1 and items[0].is_dir():
        candidate = items[0]
        if (candidate / "config.yaml").is_file():
            return candidate
        if any((candidate / d).is_dir() for d in PRESET_SUBDIRS):
            return candidate
    return extracted


def _merge_preset_dir(src: Path, dest: Path, dry_run: bool) -> int:
    n = 0
    for f in src.rglob("*"):
        if not f.is_file() or _should_skip_path(f):
            continue
        rel = f.relative_to(src)
        out = dest / rel
        if dry_run:
            _info(f"  [dry-run] {out.as_posix()}")
        else:
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, out)
        n += 1
    return n


def _config_diff(old: dict[str, Any], new: dict[str, Any], prefix: str = "") -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for k, nv in new.items():
        path = f"{prefix}.{k}" if prefix else k
        if k not in old:
            continue
        ov = old[k]
        if isinstance(nv, dict) and isinstance(ov, dict):
            out.extend(_config_diff(ov, nv, path))
        elif nv != ov:
            out.append({"key": path, "old": ov, "new": nv})
    return out


def _load_yaml_mapping(path: Path, label: str) -> dict[str, Any]:
    if yaml is None:
        _err("需要 PyYAML：请 pip install pyyaml")
    raw = path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    if data is None:
        return {}
    if not isinstance(data, dict):
        _err(f"{label} 根节点须为 YAML mapping（字典），实际为 {type(data).__name__}")
    return data


def _print_config_diff_json(diffs: list[dict[str, Any]]) -> None:
    print(json.dumps(diffs, ensure_ascii=False, indent=2))


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


def _get_dotted(d: Any, path: str) -> Any:
    cur = d
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def _serialize_dotenv_line(key: str, value: str) -> str:
    if any(c in value for c in (' ', '\t', '#', '"', "'", '$', '\\', '\n', '\r')):
        escaped = value.replace('\\', '\\\\').replace('"', '\\"')
        return f'{key}="{escaped}"'
    return f"{key}={value}"


def _write_env_local_incremental(repo: Path, package_config: dict, dry_run: bool) -> None:
    """把包内微信凭证增量写入工作区根 `.env.local`。"""
    env_path = repo / ".env.local"

    candidates: dict[str, str] = {}
    for cfg_path, env_key in SECRET_FIELD_MAP:
        v = _get_dotted(package_config, cfg_path)
        if isinstance(v, str) and v.strip():
            candidates[env_key] = v.strip()

    if not candidates:
        _info("包内未发现可写入 .env.local 的微信凭证字段，跳过")
        return

    if env_path.is_file():
        existing_content = env_path.read_text(encoding="utf-8")
        existing = _parse_dotenv(existing_content)
    else:
        existing_content = ""
        existing = {}

    added: list[str] = []
    overwritten: list[str] = []
    unchanged: list[str] = []
    for k, new_v in candidates.items():
        if k not in existing:
            added.append(k)
        elif existing[k] == new_v:
            unchanged.append(k)
        else:
            overwritten.append(k)

    if not added and not overwritten:
        _info(f".env.local 无需更新（包内 {len(candidates)} 项与现有一致）")
        return

    if dry_run:
        bits = []
        if added:
            bits.append(f"新增 {len(added)} 项 [{', '.join(added)}]")
        if overwritten:
            bits.append(f"覆盖 {len(overwritten)} 项 [{', '.join(overwritten)}]")
        _info("[dry-run] .env.local " + "，".join(bits))
        return

    if overwritten and env_path.is_file():
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = env_path.with_name(f".env.local.bak.{ts}")
        shutil.copy2(env_path, backup)
        _ok(f"备份: {backup.as_posix()}")

    overwrite_set = set(overwritten)
    lines = existing_content.splitlines() if existing_content else []
    new_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            new_lines.append(line)
            continue
        key = line.partition("=")[0].strip()
        if key in overwrite_set:
            new_lines.append(_serialize_dotenv_line(key, candidates[key]))
        else:
            new_lines.append(line)

    for k in added:
        new_lines.append(_serialize_dotenv_line(k, candidates[k]))

    final = "\n".join(new_lines)
    if not final.endswith("\n"):
        final += "\n"
    env_path.write_text(final, encoding="utf-8")

    parts = []
    if added:
        parts.append(f"新增 {len(added)} 项 [{', '.join(added)}]")
    if overwritten:
        parts.append(f"覆盖 {len(overwritten)} 项 [{', '.join(overwritten)}]")
    if unchanged:
        parts.append(f"未变 {len(unchanged)} 项 [{', '.join(unchanged)}]")
    _ok(f".env.local 写入：{'，'.join(parts)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="导入 .aws 预设包到 .niuma/teams/content/presets/；团队 config 仅首次复制，已有则 stdout 输出差异 JSON"
    )
    parser.add_argument("bundle", help="路径或 URL：本地 .aws 文件，或 https://aiworkskills.cn/**/*.aws")
    parser.add_argument("--dry-run", action="store_true", help="只打印将执行的操作，不写盘")
    parser.add_argument("--repo", default=".", help="工作区根（默认当前目录）")
    parser.add_argument(
        "--allow-any-host",
        action="store_true",
        help="调试用，放宽域名白名单（仍强制 https）；不建议生产使用",
    )
    args = parser.parse_args()

    repo = _find_repo_root(Path(args.repo))
    _ensure_team_layout(repo)

    raw = args.bundle
    if _is_url(raw):
        _validate_url(raw, args.allow_any_host)
        bundle = _download_bundle(raw, repo)
    else:
        bundle = Path(raw).resolve()

    if not bundle.is_file():
        _err(f"文件不存在: {bundle}")
    if not zipfile.is_zipfile(bundle):
        _err(f"不是有效的 ZIP 包（.aws 须为 zip）: {bundle}")

    presets_root = repo / PRESETS_REL
    config_dest = repo / TEAM_CONFIG_REL
    staging = _staging_dir(repo)

    _reset_staging(staging)
    with zipfile.ZipFile(bundle, "r") as zf:
        _safe_extractall(zf, staging)

    root = _resolve_package_root(staging)
    _info(f"解压目录: {staging.as_posix()}")
    _info(f"包根解析为: {root}")

    has_any = (root / "config.yaml").is_file() or any((root / d).is_dir() for d in PRESET_SUBDIRS)
    if not has_any:
        _err("包内未找到 config.yaml 或任一预设目录（formatting / closing-blocks / …），请检查 .aws 内容。")

    presets_root.mkdir(parents=True, exist_ok=True)

    total_files = 0
    for name in PRESET_SUBDIRS:
        src = root / name
        if not src.is_dir():
            src = root / "presets" / name
        if not src.is_dir():
            continue
        dest = presets_root / name
        if args.dry_run:
            if dest.exists():
                _info(f"替换预设目录（先清空后合并）: {name} -> {dest.as_posix()}")
            else:
                _info(f"新增预设目录: {name} -> {dest.as_posix()}")
        else:
            if dest.exists():
                shutil.rmtree(dest)
                _info(f"已清空本地预设目录: {dest.as_posix()}")
            dest.mkdir(parents=True, exist_ok=True)
        n = _merge_preset_dir(src, dest, args.dry_run)
        total_files += n
        if n:
            _ok(f"{name}: {n} 个文件")

    cfg = root / "config.yaml"
    if cfg.is_file():
        new_map = _load_yaml_mapping(cfg, "包内 config.yaml")
        if not config_dest.is_file():
            if args.dry_run:
                _info(f"[dry-run] 将复制包内 config 至 {config_dest.as_posix()}（本地尚无 config.yaml）")
            else:
                shutil.copy2(cfg, config_dest)
                _ok(f"已复制包内配置（本地原无）: {config_dest}")
        else:
            old_map = _load_yaml_mapping(config_dest, "本地 config.yaml")
            diffs = _config_diff(old_map, new_map)
            _print_config_diff_json(diffs)
            _info(
                f"config 差异 {len(diffs)} 项已输出至 stdout（JSON）；未修改 {config_dest.as_posix()}，请智能体根据用户确认再更新"
            )
        _write_env_local_incremental(repo, new_map, args.dry_run)
    else:
        _info("包内无 config.yaml，跳过团队配置与 .env.local 更新")

    if args.dry_run:
        _ok(f"dry-run 完成（共将写入约 {total_files} 个预设文件 + 如上 config）；解压保留在 {staging.as_posix()}")
    else:
        _ok(f"导入完成（预设文件合计 {total_files}）；解压保留在 {staging.as_posix()} 供核对")


if __name__ == "__main__":
    main()
