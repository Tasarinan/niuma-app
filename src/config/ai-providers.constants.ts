// ─── Legacy export removed ───────────────────────────────────────────────────
// cURL template constants have been replaced by the provider registry.
// See src/lib/providers/registry.ts for the new direct-registration system.
// This stub keeps backward-compat imports working.

import type { TYPE_PROVIDER } from "@/types";
import { getAllProviders, type ProviderDef } from "@/lib/providers/registry";

/** Generate an OpenAI/Anthropic-compatible curl for internal use only. */
export function generateCurlForProvider(
  def: ProviderDef,
  apiKey = "{{API_KEY}}",
  model = "{{MODEL}}"
): string {
  if (def.api === "anthropic-messages") {
    return (
      `curl ${def.baseUrl}/messages ` +
      `-H "x-api-key: ${apiKey}" ` +
      `-H "anthropic-version: 2023-06-01" ` +
      `-H "anthropic-dangerous-direct-browser-access: true" ` +
      `-H "content-type: application/json" ` +
      `-d '{"model":"${model}","system":"{{SYSTEM_PROMPT}}","messages":[{"role":"user","content":[{"type":"text","text":"{{TEXT}}"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"{{IMAGE}}"}}]}],"max_tokens":8192}'`
    );
  }
  return (
    `curl ${def.baseUrl}/chat/completions ` +
    `-H "Content-Type: application/json" ` +
    `-H "Authorization: Bearer ${apiKey}" ` +
    `-d '{"model":"${model}","messages":[{"role":"system","content":"{{SYSTEM_PROMPT}}"},{"role":"user","content":[{"type":"text","text":"{{TEXT}}"},{"type":"image_url","image_url":{"url":"data:image/png;base64,{{IMAGE}}"}}]}],"stream":true}'`
  );
}

function defToTypeProvider(def: ProviderDef): TYPE_PROVIDER {
  return {
    id: def.id,
    name: def.name,
    curl: generateCurlForProvider(def),
    streaming: true,
    responseContentPath:
      def.api === "anthropic-messages"
        ? "content[0].text"
        : "choices[0].message.content",
    isCustom: false,
  };
}

/** All registered providers as TYPE_PROVIDER (backward-compat). */
export const AI_PROVIDERS: TYPE_PROVIDER[] = getAllProviders()
  .filter((p) => p.type !== "web")
  .map(defToTypeProvider);

