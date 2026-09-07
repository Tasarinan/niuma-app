/** Normalize separators so Windows and POSIX paths compare the same way. */
export function normalizeFsPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const verbatimDrive = normalized.match(/^\/\/\?\/([a-zA-Z]:\/.*)$/);
  if (verbatimDrive) return verbatimDrive[1];
  const verbatimUnc = normalized.match(/^\/\/\?\/UNC\/(.*)$/i);
  if (verbatimUnc) return `//${verbatimUnc[1]}`;
  return normalized;
}

export function isAbsoluteFsPath(path: string): boolean {
  const normalized = normalizeFsPath(path.trim());
  return /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("/");
}

function collapseDotSegments(path: string): string {
  const normalized = normalizeFsPath(path);
  const drive = normalized.match(/^([a-zA-Z]:)(\/.*)?$/);
  const prefix = drive ? `${drive[1]}/` : normalized.startsWith("/") ? "/" : "";
  const rest = drive ? (drive[2] ?? "/").replace(/^\//, "") : normalized.replace(/^\//, "");
  const parts: string[] = [];
  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(part);
  }
  if (!prefix) return parts.join("/");
  return prefix + parts.join("/");
}

/** Join a relative path onto the workspace root. Absolute paths are returned as-is. */
export function resolveWorkspacePath(workspaceRoot: string, path: string): string {
  const trimmed = path.trim();
  if (!trimmed) throw new Error("path 不能为空");
  if (isAbsoluteFsPath(trimmed)) return collapseDotSegments(trimmed);
  const root = collapseDotSegments(workspaceRoot.trim()).replace(/\/+$/, "");
  if (!root) throw new Error("没有工作区根路径，无法解析相对路径");
  const rel = normalizeFsPath(trimmed).replace(/^\/+/, "");
  return collapseDotSegments(`${root}/${rel}`);
}

export function isPathInsideWorkspace(workspaceRoot: string, absPath: string): boolean {
  const root = collapseDotSegments(workspaceRoot.trim()).replace(/\/+$/, "").toLowerCase();
  const target = collapseDotSegments(absPath).toLowerCase();
  if (!root) return false;
  return target === root || target.startsWith(`${root}/`);
}

export function imageMimeFromPath(path: string): string {
  const ext = normalizeFsPath(path).split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "jfif") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}
