import { describe, expect, it } from "vitest";
import { parseEnvFile } from "@/lib/env-local";

describe("env-local", () => {
  it("parses AGNES_API_KEY from dotenv text", () => {
    const vars = parseEnvFile(`
# comment
AGNES_API_KEY=sk-test-key
NIUMA_CONTENT_DIR=.
`);
    expect(vars.AGNES_API_KEY).toBe("sk-test-key");
    expect(vars.NIUMA_CONTENT_DIR).toBe(".");
  });
});
