import { invoke } from "@tauri-apps/api/core";
import {
  addHealthAttachment,
  createHealthRecord,
  getOrCreateSelfPerson,
} from "@/lib/database/health.action";

export interface MinimalHealthUploadImage {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  size: number;
}

interface SaveAttachmentResponse {
  id: string;
  filePath?: string;
  sizeBytes?: number;
  file_path?: string;
  size_bytes?: number;
}

export interface MinimalHealthUsecaseResult {
  recordId: string;
  savedCount: number;
  failedCount: number;
  prompt: string;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export async function runMinimalHealthUploadUsecase(input: {
  images: MinimalHealthUploadImage[];
  note?: string;
}): Promise<MinimalHealthUsecaseResult> {
  const self = await getOrCreateSelfPerson();
  const now = Date.now();

  // Resolve workspace root so attachments land in <root>/.artifacts/health/...
  const workspaceRoot = await invoke<string>("get_niuma_root_dir").catch(() => "");

  const record = await createHealthRecord({
    personId: self.id,
    type: "note",
    occurredAt: now,
    title: "健康频道图片上传",
    summary: input.note?.trim() || `上传了 ${input.images.length} 张健康图片`,
    source: "image",
    rawText: input.note?.trim() || undefined,
  });

  let savedCount = 0;
  let failedCount = 0;

  for (const img of input.images) {
    try {
      const resp = await invoke<SaveAttachmentResponse>("health_save_attachment", {
        request: {
          base64Data: img.data,
          mimeType: img.mimeType,
          extension: extFromMime(img.mimeType),
          workspaceRoot: workspaceRoot || undefined,
        },
      });

      await addHealthAttachment({
        id: resp.id,
        recordId: record.id,
        filePath: resp.filePath ?? resp.file_path ?? "",
        mimeType: img.mimeType,
        sizeBytes: resp.sizeBytes ?? resp.size_bytes ?? img.size,
      });
      savedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  const imageNames = input.images.slice(0, 8).map((img) => `- ${img.name}`).join("\n") || "- (未提供文件名)";

  const prompt = [
    "用户在健康频道上传了图片，系统已自动保存到健康数据库。",
    `recordId: ${record.id}`,
    `保存成功: ${savedCount}，失败: ${failedCount}`,
    "图片列表:",
    imageNames,
    input.note?.trim() ? `用户备注: ${input.note.trim()}` : "用户备注: (无)",
    "",
    "请基于上述信息给出结构化健康记录建议（不做医疗诊断，不给药物剂量建议）。",
  ].join("\n");

  return {
    recordId: record.id,
    savedCount,
    failedCount,
    prompt,
  };
}
