import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  articleYamlPathFromArticle,
  parseArticleYamlMeta,
  parseDefaultFormatPreset,
  upsertArticleYamlMeta,
  upsertDefaultFormatPreset,
} from "@/lib/wechat/article-yaml";
import { FORMAT_THEMES, isKnownFormatTheme } from "@/lib/wechat/format-themes";

describe("article.yaml format preset", () => {
  it("resolves article.yaml next to a draft article.md", () => {
    expect(
      articleYamlPathFromArticle("C:/proj/.niuma/artifacts/drafts/20260906-demo/article.md"),
    ).toBe("C:/proj/.niuma/artifacts/drafts/20260906-demo/article.yaml");
  });

  it("parses a flow list and an empty list", () => {
    expect(parseDefaultFormatPreset("default_format_preset: [wechat-tech]\n")).toBe("wechat-tech");
    expect(parseDefaultFormatPreset("default_format_preset: []\n")).toBe("");
  });

  it("parses a block list", () => {
    expect(
      parseDefaultFormatPreset("title: demo\ndefault_format_preset:\n  - wechat-anthropic\n"),
    ).toBe("wechat-anthropic");
  });

  it("returns null when the key is absent", () => {
    expect(parseDefaultFormatPreset("title: demo\n")).toBeNull();
  });

  it("inserts the key into an empty file", () => {
    expect(upsertDefaultFormatPreset("", "wechat-ft")).toBe(
      "default_format_preset:\n  - wechat-ft\n",
    );
  });

  it("replaces a flow list without dropping other keys", () => {
    const next = upsertDefaultFormatPreset(
      "title: demo\ndefault_format_preset: [default]\nsummary: hi\n",
      "grace",
    );
    expect(next).toContain("title: demo");
    expect(next).toContain("summary: hi");
    expect(parseDefaultFormatPreset(next)).toBe("grace");
  });

  it("replaces a block list", () => {
    const next = upsertDefaultFormatPreset(
      "default_format_preset:\n  - default\n  - grace\nembeds: {}\n",
      "simple",
    );
    expect(parseDefaultFormatPreset(next)).toBe("simple");
    expect(next).toContain("embeds: {}");
    expect(next).not.toContain("- default");
  });
});

describe("article.yaml metadata", () => {
  it("parses title author digest from scalars", () => {
    expect(
      parseArticleYamlMeta(
        'title: "新标题"\nauthor: "乾坤AI容我懒"\ndigest: "一句摘要"\n',
      ),
    ).toEqual({
      title: "新标题",
      author: "乾坤AI容我懒",
      digest: "一句摘要",
    });
  });

  it("upserts title and digest without dropping other keys", () => {
    const next = upsertArticleYamlMeta(
      'title: "旧标题"\ndigest: "旧摘要"\ndefault_format_preset:\n  - modern\n',
      { title: "没有活人感的公众号文章值得发表吗？", digest: "AI纯写没有独到观点" },
    );
    expect(parseArticleYamlMeta(next)).toEqual({
      title: "没有活人感的公众号文章值得发表吗？",
      digest: "AI纯写没有独到观点",
    });
    expect(parseDefaultFormatPreset(next)).toBe("modern");
  });

  it("inserts missing metadata keys at the top", () => {
    const next = upsertArticleYamlMeta("default_format_preset: [grace]\n", {
      title: "封面稿",
      digest: "摘要",
    });
    expect(next.startsWith('title: "封面稿"')).toBe(true);
    expect(next).toContain('digest: "摘要"');
    expect(parseDefaultFormatPreset(next)).toBe("grace");
  });
});

describe("format theme catalog", () => {
  it("covers Niuma and huasheng ids used by format.py", () => {
    expect(isKnownFormatTheme("default")).toBe(true);
    expect(isKnownFormatTheme("wechat-tech")).toBe(true);
    expect(isKnownFormatTheme("wechat-anthropic")).toBe(true);
    expect(FORMAT_THEMES.map((theme) => theme.id)).toContain("lemonde");
    expect(new Set(FORMAT_THEMES.map((theme) => theme.id)).size).toBe(FORMAT_THEMES.length);
  });

  it("has a YAML file for every catalog id", () => {
    const dir = path.resolve(
      process.cwd(),
      ".niuma/teams/content/skills/article-formatting-wechat/references/presets/themes",
    );
    const stems = new Set(
      readdirSync(dir)
        .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
        .map((name) => name.replace(/\.ya?ml$/i, "")),
    );
    for (const theme of FORMAT_THEMES) {
      expect(stems.has(theme.id), `missing theme YAML: ${theme.id}`).toBe(true);
    }
  });
});
