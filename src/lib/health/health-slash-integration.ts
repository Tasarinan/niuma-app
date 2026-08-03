import {
  addHealthObservations,
  createHealthRecord,
  getOrCreateSelfPerson,
  listHealthObservations,
  listHealthRecords,
} from "@/lib/database/health.action";
import type { HealthRecord } from "@/types/health.type";

export interface HealthSlashContext {
  command: string;
  args: string;
}

export interface HealthSlashResolution {
  prompt: string;
}

function parseDateOnly(text: string): number | null {
  const normalized = text.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const ts = new Date(`${normalized}T00:00:00`).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function parseDateRange(raw?: string): { start: number; end: number; label: string } {
  const now = new Date();
  const end = now.getTime();
  const value = (raw ?? "all").trim().toLowerCase();

  if (!value || value === "all") {
    return { start: 0, end, label: "all" };
  }

  if (value === "last_year") {
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 12);
    return { start: startDate.getTime(), end, label: "last_year" };
  }

  if (value === "last_quarter") {
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 3);
    return { start: startDate.getTime(), end, label: "last_quarter" };
  }

  if (value === "last_month") {
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 1);
    return { start: startDate.getTime(), end, label: "last_month" };
  }

  if (value.includes(",")) {
    const [from, to] = value.split(",");
    const start = parseDateOnly(from) ?? 0;
    const endDate = parseDateOnly(to);
    return { start, end: endDate ?? end, label: value };
  }

  const single = parseDateOnly(value);
  if (single !== null) {
    return { start: single, end, label: value };
  }

  return { start: 0, end, label: "all" };
}

function fmtRecordLine(record: HealthRecord): string {
  const dt = new Date(record.occurredAt).toISOString().slice(0, 10);
  const title = record.title || "(无标题)";
  const summary = record.summary || "";
  return `- ${dt} | ${title}${summary ? ` | ${summary}` : ""}`;
}

async function handleSymptom(args: string): Promise<HealthSlashResolution> {
  const [action = "", ...rest] = args.trim().split(/\s+/);
  const normalizedAction = action.toLowerCase();

  if (normalizedAction === "add") {
    const self = await getOrCreateSelfPerson();
    const tail = rest.join(" ").trim();
    const tokens = tail.split(/\s+/).filter(Boolean);
    let occurredAt = Date.now();
    if (tokens.length > 0) {
      const maybeDate = parseDateOnly(tokens[tokens.length - 1]);
      if (maybeDate !== null) {
        occurredAt = maybeDate;
        tokens.pop();
      }
    }
    const description = tokens.join(" ").trim();
    if (!description) {
      return {
        prompt:
          "用户执行了 /symptom add 但没有填写症状描述。请提示用户补充症状，例如：/symptom add 头疼 2026-08-03。",
      };
    }

    const record = await createHealthRecord({
      personId: self.id,
      type: "symptom",
      occurredAt,
      title: "症状记录",
      summary: description,
      source: "manual",
      rawText: description,
    });

    await addHealthObservations([
      {
        recordId: record.id,
        personId: self.id,
        code: "SYMPTOM_NOTE",
        displayName: "症状描述",
        valueText: description,
        observedAt: occurredAt,
      },
    ]);

    const day = new Date(occurredAt).toISOString().slice(0, 10);
    return {
      prompt: `用户刚通过 /symptom add 新增了症状记录，已写入数据库。\n\n记录信息：\n- 日期: ${day}\n- 描述: ${description}\n\n请用中文给出简短确认，并提供 3 条非诊断性的自我观察建议（何时应及时就医）。`,
    };
  }

  if (normalizedAction === "history") {
    const self = await getOrCreateSelfPerson();
    const records = await listHealthRecords({ personId: self.id, type: "symptom", limit: 30 });
    const list = records.length > 0 ? records.map(fmtRecordLine).join("\n") : "- 暂无症状记录";
    return {
      prompt: `用户执行 /symptom history。以下是数据库中的症状记录：\n${list}\n\n请按时间倒序总结近期症状变化，并给出下一步记录建议。`,
    };
  }

  if (normalizedAction === "status") {
    const self = await getOrCreateSelfPerson();
    const observations = await listHealthObservations({ personId: self.id, code: "SYMPTOM_NOTE", limit: 100 });
    const recent30 = observations.filter((o) => o.observedAt >= Date.now() - 30 * 24 * 3600 * 1000);
    const lines = recent30.slice(0, 20).map((o) => `- ${new Date(o.observedAt).toISOString().slice(0, 10)} | ${o.valueText ?? ""}`);
    return {
      prompt: `用户执行 /symptom status。\n\n统计：\n- 近30天记录数: ${recent30.length}\n\n近30天症状明细：\n${lines.length > 0 ? lines.join("\n") : "- 暂无"}\n\n请给出症状趋势摘要（不做医疗诊断）。`,
    };
  }

  return {
    prompt: "用户执行了 /symptom 命令。请根据命令规范引导用户使用 add/history/status 子命令。",
  };
}

async function handleDiet(args: string): Promise<HealthSlashResolution> {
  const [action = "", ...rest] = args.trim().split(/\s+/);
  const normalizedAction = action.toLowerCase();

  if (normalizedAction === "add") {
    const self = await getOrCreateSelfPerson();
    const note = rest.join(" ").trim();
    if (!note) {
      return {
        prompt:
          "用户执行了 /diet add 但没有填写内容。请提示用户补充饮食描述或先上传餐食图片后点击“保存为健康记录”。",
      };
    }

    const occurredAt = Date.now();
    const record = await createHealthRecord({
      personId: self.id,
      type: "meal",
      occurredAt,
      title: "饮食记录",
      summary: note,
      source: "manual",
      rawText: note,
    });

    await addHealthObservations([
      {
        recordId: record.id,
        personId: self.id,
        code: "DIET_NOTE",
        displayName: "饮食描述",
        valueText: note,
        observedAt: occurredAt,
      },
    ]);

    return {
      prompt: `用户刚通过 /diet add 写入一条饮食记录：${note}\n\n请给出简短营养记录反馈（不做医疗诊断，不给药物建议）。`,
    };
  }

  if (normalizedAction === "history") {
    const self = await getOrCreateSelfPerson();
    const records = await listHealthRecords({ personId: self.id, type: "meal", limit: 30 });
    return {
      prompt: `用户执行 /diet history。\n\n饮食记录：\n${records.length > 0 ? records.map(fmtRecordLine).join("\n") : "- 暂无饮食记录"}\n\n请总结饮食规律并给出 3 条可执行的记录优化建议。`,
    };
  }

  if (normalizedAction === "status" || normalizedAction === "summary") {
    const self = await getOrCreateSelfPerson();
    const records = await listHealthRecords({ personId: self.id, type: "meal", limit: 200 });
    const weekStart = Date.now() - 7 * 24 * 3600 * 1000;
    const monthStart = Date.now() - 30 * 24 * 3600 * 1000;
    const weekCount = records.filter((r) => r.occurredAt >= weekStart).length;
    const monthCount = records.filter((r) => r.occurredAt >= monthStart).length;

    return {
      prompt: `用户执行 /diet ${normalizedAction}。\n\n统计：\n- 近7天记录数: ${weekCount}\n- 近30天记录数: ${monthCount}\n\n最近记录：\n${records.slice(0, 10).map(fmtRecordLine).join("\n") || "- 暂无"}\n\n请做饮食记录质量总结，并建议后续打卡频率。`,
    };
  }

  return {
    prompt: "用户执行了 /diet 命令。请根据命令规范引导用户使用 add/history/status/summary 子命令。",
  };
}

async function handleReport(args: string): Promise<HealthSlashResolution> {
  const [reportType = "comprehensive", rangeToken = "all", sectionsToken = "all"] =
    args.trim().split(/\s+/);
  const self = await getOrCreateSelfPerson();
  const range = parseDateRange(rangeToken);

  const records = await listHealthRecords({ personId: self.id, limit: 500 });
  const scoped = records.filter((r) => r.occurredAt >= range.start && r.occurredAt <= range.end);

  const byType = scoped.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

  const observations = await listHealthObservations({ personId: self.id, limit: 500 });
  const scopedObs = observations.filter((o) => o.observedAt >= range.start && o.observedAt <= range.end);
  const abnormal = scopedObs.filter(
    (o) => o.abnormalFlag && o.abnormalFlag !== "normal" && o.abnormalFlag !== "unknown"
  );

  return {
    prompt: [
      `用户执行 /report ${args || "comprehensive"}，请生成健康报告摘要（Markdown）。`,
      `参数：reportType=${reportType}, dateRange=${range.label}, sections=${sectionsToken}`,
      "",
      "数据库汇总：",
      `- 范围内记录总数: ${scoped.length}`,
      `- 范围内观察值总数: ${scopedObs.length}`,
      `- 异常观察值数量: ${abnormal.length}`,
      `- 记录类型分布: ${JSON.stringify(byType)}`,
      "",
      "最近15条记录：",
      scoped.slice(0, 15).map(fmtRecordLine).join("\n") || "- 暂无",
      "",
      "最近15条异常观察值：",
      abnormal
        .slice(0, 15)
        .map(
          (o) =>
            `- ${new Date(o.observedAt).toISOString().slice(0, 10)} | ${o.displayName} | ${o.valueNum ?? o.valueText ?? ""} ${o.unit ?? ""} | ${o.abnormalFlag}`
        )
        .join("\n") || "- 暂无",
      "",
      "要求：不要诊断疾病，不给药物剂量建议，只做记录性总结和风险提示。",
    ].join("\n"),
  };
}

export async function resolveHealthSlashIntegration(
  ctx: HealthSlashContext
): Promise<HealthSlashResolution | null> {
  if (ctx.command === "symptom") {
    return handleSymptom(ctx.args);
  }
  if (ctx.command === "diet") {
    return handleDiet(ctx.args);
  }
  if (ctx.command === "report") {
    return handleReport(ctx.args);
  }
  return null;
}
