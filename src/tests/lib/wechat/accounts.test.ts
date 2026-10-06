import { describe, expect, it } from "vitest";
import {
  envCandidatePaths,
  formatReadyWechatContext,
  isReadyCommand,
  maskWechatAppId,
  parseDotenv,
  parseReadyAccountArg,
  wechatSlotsFromEnv,
} from "@/lib/wechat/accounts";

const SAMPLE_ENV = `
WECHAT_1_APPID=wx1111111111111111
WECHAT_1_APPSECRET=super-secret-do-not-leak
WECHAT_1_NAME=主号
WECHAT_2_APPID=wx2222222222222222
WECHAT_2_APPSECRET=another-secret
IMAGE_MODEL_API_KEY=sk-should-not-appear
`;

describe("/ready wechat slot selection", () => {
  it("identifies /ready", () => {
    expect(isReadyCommand("ready")).toBe(true);
    expect(isReadyCommand("digest")).toBe(false);
  });

  it("only reads .env.local, never aws.env or .aws-article", () => {
    expect(envCandidatePaths("C:\\proj")).toEqual(["C:\\proj\\.env.local"]);
    expect(envCandidatePaths("/proj")).toEqual(["/proj/.env.local"]);
  });

  it("lists slots from .env.local without printing APPSECRET or API keys", () => {
    const env = parseDotenv(SAMPLE_ENV);
    const slots = wechatSlotsFromEnv(env);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      slot: 1,
      name: "主号",
      hasSecret: true,
      appIdMasked: maskWechatAppId("wx1111111111111111"),
    });
    const text = formatReadyWechatContext({
      status: "ok",
      slots,
      sources: [".env.local"],
      selectedSlot: 1,
      errors: [],
    });
    expect(text).toContain("槽位 1");
    expect(text).toContain("槽位 2");
    expect(text).toContain(".env.local");
    expect(text).not.toContain("aws.env");
    expect(text).not.toContain(".aws-article");
    expect(text).not.toContain("config.yaml");
    expect(text).not.toContain("super-secret-do-not-leak");
    expect(text).not.toContain("another-secret");
    expect(text).not.toContain("sk-should-not-appear");
    expect(text).not.toMatch(/APPSECRET\s*=/);
  });

  it("masks AppID instead of showing the full value", () => {
    expect(maskWechatAppId("wx1111111111111111")).toBe("wx11…1111");
    const text = formatReadyWechatContext({
      status: "ok",
      slots: wechatSlotsFromEnv(parseDotenv(SAMPLE_ENV)),
      sources: [".env.local"],
      errors: [],
    });
    expect(text).not.toContain("wx1111111111111111");
  });

  it("parses /ready 2 as slot 2", () => {
    const slots = wechatSlotsFromEnv(parseDotenv(SAMPLE_ENV));
    expect(parseReadyAccountArg("2", slots)?.slot).toBe(2);
    expect(parseReadyAccountArg("主号", slots)?.slot).toBe(1);
  });
});
