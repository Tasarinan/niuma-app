import {
  draftThemeSlugFromFolder,
  inferImageNameIntent,
  type NormalizeImageNameOptions,
  normalizeWechatImageFilename,
} from "./draft-image-names";
import { draftFolderFromFilePath } from "./draft-workspace";
import {
  collectMarkdownImageSrcs,
  isRemoteOrDataImageSrc,
  localImageReadCandidates,
  replaceMarkdownImageSrcs,
  resolveLocalImagePath,
  toImgsMarkdownSrc,
  toPngMarkdownSrc,
} from "./markdown-images";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

export function isPngBytes(bytes: Uint8Array): boolean {
  return PNG_MAGIC.every((value, index) => bytes[index] === value);
}

export function toPngPath(path: string, existingNames: string[] = [], options: NormalizeImageNameOptions = {}): string {
  const trimmed = path.trim().replace(/\\/g, "/");
  if (isRemoteOrDataImageSrc(trimmed)) return trimmed;
  const fileName = trimmed.replace(/^.*\//, "") || "01.png";
  const intent = options.intent ?? inferImageNameIntent(fileName);
  const safe = normalizeWechatImageFilename(toPngMarkdownSrc(fileName), existingNames, {
    ...options,
    intent,
  });
  if (trimmed.includes("/")) {
    const dir = trimmed.replace(/\/[^/]+$/, "");
    return `${dir}/${safe}`;
  }
  return safe;
}

function draftFolderOf(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  const marker = ".artifacts/drafts/";
  const index = normalized.toLowerCase().indexOf(marker);
  if (index < 0) return null;
  const rest = normalized.slice(index + marker.length);
  const folder = rest.split("/").filter(Boolean)[0];
  if (!folder) return null;
  return normalized.slice(0, index + marker.length + folder.length);
}

export function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || "image.png";
}

/** Draft images live in `<draft>/imgs/<name>.png` so publish/upload share one folder. */
export function toDraftImgsAbsPath(absPath: string, existingNames: string[] = []): string {
  const normalized = absPath.replace(/\\/g, "/");
  const folder = draftFolderOf(normalized);
  const themeSlug = folder ? draftThemeSlugFromFolder(folder) : undefined;
  const png = toPngPath(normalized, existingNames, { themeSlug });
  const draftFolder = draftFolderOf(png);
  if (!draftFolder) return png;
  return `${draftFolder}/imgs/${fileNameFromPath(png)}`;
}

export function rewriteMarkdownLocalImagesToPng(markdown: string, articlePath?: string): string {
  const folder = articlePath ? draftFolderFromFilePath(articlePath) : null;
  const themeSlug = folder ? draftThemeSlugFromFolder(folder) : undefined;
  const taken: string[] = [];
  return replaceMarkdownImageSrcs(markdown, (src) => {
    if (isRemoteOrDataImageSrc(src)) return src;
    const options: NormalizeImageNameOptions = {
      themeSlug,
      intent: inferImageNameIntent(src),
    };
    const next = toImgsMarkdownSrc(src, taken, options);
    taken.push(next.replace(/^imgs\//i, ""));
    return next;
  });
}

export function preferPngImageEntries<T extends { name: string }>(entries: T[]): T[] {
  const pngStems = new Set(
    entries
      .filter((entry) => /\.png$/i.test(entry.name))
      .map((entry) => entry.name.replace(/\.[^.]+$/, "").toLowerCase()),
  );
  return entries.filter((entry) => {
    if (/\.png$/i.test(entry.name)) return true;
    const stem = entry.name.replace(/\.[^.]+$/, "").toLowerCase();
    return !pngStems.has(stem);
  });
}

export async function encodePngInBrowser(bytes: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([bytes]);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法把图片转成 PNG");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("PNG 编码失败"))), "image/png");
  });
  return new Uint8Array(await pngBlob.arrayBuffer());
}

export async function ensurePngBytes(
  bytes: Uint8Array,
  encodePng: (value: Uint8Array) => Promise<Uint8Array> = encodePngInBrowser,
): Promise<Uint8Array> {
  if (isPngBytes(bytes)) return bytes;
  return encodePng(bytes);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function isRasterImagePath(path: string): boolean {
  return /\.(png|jpe?g|jfif|gif|webp|bmp)$/i.test(path);
}

export function pngBytesToDataUrl(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function convertDraftImageToPngImgs(input: {
  absPath: string;
  readBase64: (path: string) => Promise<string>;
  writeBytes: (path: string, bytes: Uint8Array) => Promise<void>;
  encodePng?: (bytes: Uint8Array) => Promise<Uint8Array>;
  write?: boolean;
}): Promise<{ dest: string; relativeSrc: string; converted: boolean; png: Uint8Array } | null> {
  const encodePng = input.encodePng ?? encodePngInBrowser;
  let sourceAbs = input.absPath;
  let sourceBytes: Uint8Array | undefined;
  for (const candidate of localImageReadCandidates(input.absPath)) {
    const base64 = await input.readBase64(candidate).catch(() => "");
    if (!base64) continue;
    sourceAbs = candidate;
    sourceBytes = decodeBase64(base64);
    break;
  }
  if (!sourceBytes) return null;
  const png = await ensurePngBytes(sourceBytes, encodePng);
  const dest = toDraftImgsAbsPath(sourceAbs);
  const converted = dest !== sourceAbs || !isPngBytes(sourceBytes);
  if (converted && input.write !== false) {
    await input.writeBytes(dest, png);
  }
  return {
    dest,
    relativeSrc: toImgsMarkdownSrc(fileNameFromPath(dest)),
    converted,
    png,
  };
}

export async function materializeLocalImagesAsPng(input: {
  articlePath: string;
  markdown: string;
  readBase64: (path: string) => Promise<string>;
  writeBytes: (path: string, bytes: Uint8Array) => Promise<void>;
  encodePng?: (bytes: Uint8Array) => Promise<Uint8Array>;
}): Promise<{ markdown: string; converted: string[] }> {
  const encodePng = input.encodePng ?? encodePngInBrowser;
  const converted: string[] = [];
  const unique = [
    ...new Set(collectMarkdownImageSrcs(input.markdown).filter((src) => !isRemoteOrDataImageSrc(src))),
  ];

  for (const src of unique) {
    const abs = resolveLocalImagePath(input.articlePath, src);
    if (!abs) continue;
    const pngAbs = toDraftImgsAbsPath(abs);
    let sourceAbs = abs;
    let sourceBytes: Uint8Array | undefined;
    for (const candidate of localImageReadCandidates(abs)) {
      const base64 = await input.readBase64(candidate).catch(() => "");
      if (!base64) continue;
      sourceAbs = candidate;
      sourceBytes = decodeBase64(base64);
      break;
    }
    if (!sourceBytes) continue;
    const png = await ensurePngBytes(sourceBytes, encodePng);
    if (pngAbs !== sourceAbs || !isPngBytes(sourceBytes)) {
      await input.writeBytes(pngAbs, png);
      converted.push(pngAbs);
    }
  }

  return {
    markdown: rewriteMarkdownLocalImagesToPng(input.markdown, input.articlePath),
    converted,
  };
}
