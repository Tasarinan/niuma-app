/**
 * pi-ai provider + stream function for talking directly to a configured
 * niuma AI provider.
 *
 * Depending on the resolved connection we register a single dynamic provider
 * (`niuma-direct`) whose model uses either the `openai-completions` or the
 * `anthropic-messages` API. Auth is the provider's stored API key. The returned
 * `streamFn` satisfies Pi's `StreamFn` contract and is handed to the `Agent`.
 */

import {
  createModels,
  createProvider,
  type ApiKeyAuth,
  type AuthResult,
  type Model,
  type MutableModels,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { AgentApiKind } from "@/types";
import type { ProviderConnection } from "./connection";
import { DIRECT_PROVIDER_ID } from "./model";

function directApiKeyAuth(conn: ProviderConnection): ApiKeyAuth {
  const key = conn.apiKey.trim();
  return {
    name: "Niuma Direct",
    resolve: async ({ model }): Promise<AuthResult> => ({
      auth: { apiKey: key, baseUrl: model.baseUrl },
      source: "niuma-direct",
    }),
  };
}

export interface DirectRuntime {
  models: MutableModels;
  streamFn: StreamFn;
}

/** Pick the pi-ai API implementation matching the connection's wire format. */
function apiFor(kind: AgentApiKind) {
  return kind === "anthropic-messages"
    ? anthropicMessagesApi()
    : openAICompletionsApi();
}

/**
 * Create a Pi runtime bound to a single configured provider.
 *
 * @param models pi-ai `Model`s built via `buildPiModel`.
 * @param conn   the resolved provider connection (base URL + key + API family).
 */
export function createDirectRuntime(
  models: Model<AgentApiKind>[],
  conn: ProviderConnection
): DirectRuntime {
  const collection = createModels();
  collection.setProvider(
    createProvider({
      id: DIRECT_PROVIDER_ID,
      name: "Niuma Direct",
      baseUrl: conn.baseUrl,
      auth: { apiKey: directApiKeyAuth(conn) },
      models,
      api: apiFor(conn.api),
    })
  );

  const streamFn: StreamFn = (model, context, options) =>
    collection.streamSimple(model, context, options);

  return { models: collection, streamFn };
}
