import { describe, expect, it } from "vitest";
import { buildRetrievalPrompt, extractSearchTerms, searchQueries, type ImaReference, type LocalResult } from "@/hooks/useQuickSearch";

const local: LocalResult = {
  name: "note.md",
  path: "C:/docs/note.md",
  isDir: false,
  kind: "file",
  matchKind: "content",
  excerpt: "这里提到零信任网络",
};

const ima: ImaReference = {
  title: "零信任笔记",
  excerpt: "资料库里的零信任摘要",
  url: "https://ima.example/zt",
};

describe("search terms", () => {
  it("keeps the topic and drops the question words", () => {
    expect(extractSearchTerms("workbuddy有什么技巧")).toEqual(["workbuddy"]);
    expect(extractSearchTerms("零信任有什么技巧")).toEqual(["零信任"]);
  });

  it("keeps an english phrase together", () => {
    expect(searchQueries("vibe coding")).toEqual(["vibe coding", "vibe"]);
  });
});

describe("retrieval prompt", () => {
  it("puts local paths and IMA items into the Doubao prompt", () => {
    const prompt = buildRetrievalPrompt("零信任", [local], [ima]);
    expect(prompt).toContain("路径：C:/docs/note.md");
    expect(prompt).toContain("这里提到零信任网络");
    expect(prompt).toContain("《零信任笔记》");
    expect(prompt).toContain("网址：https://ima.example/zt");
    expect(prompt).toContain("只写分析正文");
  });
});
