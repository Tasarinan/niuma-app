import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WECHAT_TITLE_MAX_BYTES,
  describeWechatTitle,
  trimTitleToWechatLimit,
  utf8ByteLength,
} from "@/lib/wechat/title-bytes";

const PY = path.resolve(
  ".teams/content/skills/wechat-publish/scripts/title_bytes.py",
);

describe("WeChat title UTF-8 bytes (45028)", () => {
  it("counts Chinese as 3 bytes and ASCII as 1", () => {
    expect(utf8ByteLength("中")).toBe(3);
    expect(utf8ByteLength("A")).toBe(1);
    expect(utf8ByteLength("中A")).toBe(4);
  });

  it("trims to 96 bytes without splitting a character", () => {
    const long = "中".repeat(40);
    expect(utf8ByteLength(long)).toBe(120);
    const trimmed = trimTitleToWechatLimit(long);
    expect(utf8ByteLength(trimmed)).toBe(WECHAT_TITLE_MAX_BYTES);
    expect(trimmed).toBe("中".repeat(32));
  });

  it("strips trailing punctuation after a byte cut", () => {
    const title = `${"中".repeat(31)}：再写`;
    const trimmed = trimTitleToWechatLimit(title);
    expect(trimmed.endsWith("：")).toBe(false);
    expect(utf8ByteLength(trimmed)).toBeLessThanOrEqual(WECHAT_TITLE_MAX_BYTES);
  });

  it("flags over-bytes even when under 25 characters", () => {
    const title = "中".repeat(33);
    expect(title.length).toBe(33);
    const meta = describeWechatTitle(title);
    expect(meta.chars).toBe(33);
    expect(meta.utf8Bytes).toBe(99);
    expect(meta.overBytes).toBe(true);
    expect(meta.overChars).toBe(false);
  });

  it("keeps a 25-character Chinese title under the API byte cap", () => {
    const title = "中".repeat(25);
    const meta = describeWechatTitle(title);
    expect(meta.utf8Bytes).toBe(75);
    expect(meta.overBytes).toBe(false);
  });
});

describe("title_bytes.py", () => {
  it("self-test passes", () => {
    const out = execFileSync("python", [PY, "--self-test"], { encoding: "utf8" });
    expect(out.trim()).toBe("ok");
  });

  it("preflight errors when title exceeds 96 UTF-8 bytes", () => {
    const dir = path.join(tmpdir(), `niuma-title-bytes-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "article.yaml"),
      `title: "${"中".repeat(40)}"\nauthor: "测"\ndigest: "摘要摘要摘要摘要摘要"\n`,
      "utf8",
    );
    writeFileSync(path.join(dir, "article.md"), "# 测\n\n正文\n", "utf8");
    const preflight = path.resolve(
      ".teams/content/skills/wechat-publish/scripts/preflight.py",
    );
    let stdout = "";
    let code = 0;
    try {
      stdout = execFileSync("python", [preflight, dir, "--json"], { encoding: "utf8" });
    } catch (err) {
      const spawned = err as { status?: number; stdout?: string };
      code = spawned.status ?? 1;
      stdout = spawned.stdout ?? "";
    }
    const result = JSON.parse(stdout) as { ok: boolean; errors: string[] };
    expect(result.ok).toBe(false);
    expect(code).toBe(1);
    expect(result.errors.join("\n")).toMatch(/45028|96/);
  });
});
