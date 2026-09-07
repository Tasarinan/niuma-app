import { describe, expect, it } from "vitest";
import {
  formatImaTopicContext,
  imaOpenApiPost,
  isTopicCommand,
  parseImaCredentials,
} from "./openapi";

describe("IMA OpenAPI for /topic", () => {
  it("identifies /topic", () => {
    expect(isTopicCommand("topic")).toBe(true);
    expect(isTopicCommand("digest")).toBe(false);
  });

  it("reads IMA_CLIENT_ID / IMA_API_KEY from .env.local-style env", () => {
    const creds = parseImaCredentials({
      IMA_CLIENT_ID: "test-client-id",
      IMA_API_KEY: "abc/def+ghi==",
    });
    expect(creds?.clientId).toBe("test-client-id");
    expect(creds?.apiKey).toBe("abc/def+ghi==");
  });

  it("sends official IMA headers and does not require ima_api.cjs", async () => {
    const headers: Record<string, string> = {};
    const data = await imaOpenApiPost(
      "openapi/wiki/v1/search_knowledge",
      { query: "选题", knowledge_base_id: "kb1" },
      {
        credentials: parseImaCredentials({
          IMA_CLIENT_ID: "test-client-id",
          IMA_API_KEY: "abc/def+ghi==",
        })!,
        fetchImpl: async (input, init) => {
          expect(String(input)).toBe("https://ima.qq.com/openapi/wiki/v1/search_knowledge");
          const h = new Headers(init?.headers);
          headers["ima-openapi-clientid"] = h.get("ima-openapi-clientid") ?? "";
          headers["ima-openapi-apikey"] = h.get("ima-openapi-apikey") ?? "";
          return new Response(JSON.stringify({ code: 0, data: { info_list: [{ title: "一篇收藏", media_id: "m1" }] } }), {
            status: 200,
          });
        },
      },
    );
    expect(headers["ima-openapi-clientid"]).toBe("test-client-id");
    expect(headers["ima-openapi-apikey"]).toBe("abc/def+ghi==");
    expect((data.info_list as { title: string }[])[0].title).toBe("一篇收藏");
  });

  it("surfaces 认证失败 without leaking the API key", async () => {
    await expect(
      imaOpenApiPost(
        "openapi/wiki/v1/search_knowledge",
        { query: "选题" },
        {
          credentials: parseImaCredentials({
            IMA_CLIENT_ID: "test-client-id",
            IMA_API_KEY: "abc/def+ghi==",
          })!,
          fetchImpl: async () =>
            new Response(JSON.stringify({ code: 401, msg: "认证失败" }), { status: 200 }),
        },
      ),
    ).rejects.toThrow("认证失败");
  });

  it("formats topic context without secrets", () => {
    const text = formatImaTopicContext({
      status: "ok",
      query: "AI agent",
      items: [{ title: "一篇收藏", excerpt: "关于 agent 的笔记", url: "" }],
      errors: [],
    });
    expect(text).toContain("一篇收藏");
    expect(text).toContain("不要再 curl");
    expect(text).not.toContain("abc/def+ghi==");
    expect(text).not.toContain("IMA_API_KEY");
  });
});
