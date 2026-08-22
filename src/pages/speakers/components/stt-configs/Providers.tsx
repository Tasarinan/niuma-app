import { Button, Header, Input, Selection, TextInput, ModelSelector } from "@/components";
import { UseSettingsReturn } from "@/types";
import curl2Json, { ResultJSON } from "@bany/curl-to-json";
import { KeyIcon, TrashIcon, ExternalLink, FileKey } from "lucide-react";
import { useEffect, useState } from "react";
import { getSTTProviderInfo } from "@/config/models.constants";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

// ── .env.local helpers ────────────────────────────────────────────────────────

/** Env var names to probe for each STT provider id. */
const STT_ENV_KEYS: Record<string, string[]> = {
  "elevenlabs-stt": ["STT_API_KEY"],
};

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) result[key] = val;
  }
  return result;
}

async function readEnvLocal(): Promise<Record<string, string>> {
  const root = await invoke<string>("get_niuma_root_dir").catch(() => "");
  const sep = root.includes("/") ? "/" : "\\";
  for (const path of [`${root}${sep}.env.local`, `${root}${sep}..${sep}.env.local`]) {
    try {
      const raw = await invoke<string>("read_text_file", { path });
      return parseEnvFile(raw);
    } catch { /* try next */ }
  }
  return {};
}

async function readSttKeyFromEnv(providerId: string): Promise<string> {
  const envVars = await readEnvLocal().catch((): Record<string, string> => ({}));
  for (const envKey of STT_ENV_KEYS[providerId] ?? []) {
    if (envVars[envKey]) return envVars[envKey];
  }
  return "";
}

const handleOpenUrl = async (url: string) => {
  try {
    await openUrl(url);
  } catch (error) {
    console.error("Failed to open URL:", error);
    toast.error("Failed to open link", {
      description: "Please try again or copy the URL manually.",
    });
  }
};

export const Providers = ({
  allSttProviders,
  selectedSttProvider,
  onSetSelectedSttProvider,
  sttVariables,
}: UseSettingsReturn) => {
  const [localSelectedProvider, setLocalSelectedProvider] =
    useState<ResultJSON | null>(null);

  useEffect(() => {
    if (selectedSttProvider?.provider) {
      const provider = allSttProviders?.find(
        (p) => p?.id === selectedSttProvider?.provider
      );
      if (provider) {
        const json = curl2Json(provider?.curl);
        setLocalSelectedProvider(json as ResultJSON);
      }
    }
  }, [selectedSttProvider?.provider]);

  // Auto-fill API key from .env.local when the field is empty
  useEffect(() => {
    if (!selectedSttProvider?.provider) return;
    const apiKeyVar = findKeyAndValue("api_key");
    const currentKey = apiKeyVar ? selectedSttProvider.variables?.[apiKeyVar.key] ?? "" : "";
    if (currentKey.trim()) return; // already set
    void readSttKeyFromEnv(selectedSttProvider.provider).then((envKey) => {
      if (envKey && apiKeyVar) {
        onSetSelectedSttProvider?.({
          ...selectedSttProvider,
          variables: { ...selectedSttProvider.variables, [apiKeyVar.key]: envKey },
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSttProvider?.provider]);

  const findKeyAndValue = (key: string) => {
    return sttVariables?.find((v) => v?.key === key);
  };

  const getApiKeyValue = () => {
    const apiKeyVar = findKeyAndValue("api_key");
    if (!apiKeyVar || !selectedSttProvider?.variables) return "";
    return selectedSttProvider?.variables?.[apiKeyVar.key] || "";
  };

  const isApiKeyEmpty = () => {
    return !getApiKeyValue().trim();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Header
          title="Select STT Provider"
          description="Select your preferred STT service provider or custom providers to get started."
        />
        <Selection
          selected={selectedSttProvider?.provider}
          options={allSttProviders?.map((provider) => {
            const json = curl2Json(provider?.curl);
            return {
              label: provider?.isCustom
                ? json?.url || "Custom Provider"
                : provider?.name || provider?.id || "Custom Provider",
              value: provider?.id || "Custom Provider",
              isCustom: provider?.isCustom,
            };
          })}
          placeholder="Choose your STT provider"
          onChange={(value) => {
            onSetSelectedSttProvider({
              provider: value,
              variables: {},
            });
          }}
        />
      </div>

      {localSelectedProvider ? (
        <Header
          title={`Method: ${
            localSelectedProvider?.method || "Invalid"
          }, Endpoint: ${localSelectedProvider?.url || "Invalid"}`}
          description={`If you want to use different url or method, you can always create a custom provider.`}
        />
      ) : null}

      {/* Provider signup/pricing links */}
      {selectedSttProvider?.provider && !allSttProviders?.find(p => p?.id === selectedSttProvider?.provider)?.isCustom && (() => {
        const providerInfo = getSTTProviderInfo(selectedSttProvider.provider);
        if (!providerInfo) return null;
        const { pricingUrl } = providerInfo;
        return (
          <div className="flex flex-wrap gap-2 py-2">
            <button
              onClick={() => handleOpenUrl(providerInfo.signupUrl)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Get API Key from {providerInfo.name}
            </button>
            {pricingUrl && (
              <button
                onClick={() => handleOpenUrl(pricingUrl)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Pricing
              </button>
            )}
          </div>
        );
      })()}

      {findKeyAndValue("api_key") ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Header
              title="API Key"
              description={`Enter your ${
                allSttProviders?.find(
                  (p) => p?.id === selectedSttProvider?.provider
                )?.isCustom
                  ? "Custom Provider"
                  : selectedSttProvider?.provider
              } API key to authenticate and access STT models. Your key is stored locally and never shared.`}
            />
            {selectedSttProvider?.provider && STT_ENV_KEYS[selectedSttProvider.provider] && (
              <button
                type="button"
                onClick={() => {
                  if (!selectedSttProvider) return;
                  void readSttKeyFromEnv(selectedSttProvider.provider).then((envKey) => {
                    const apiKeyVar = findKeyAndValue("api_key");
                    if (envKey && apiKeyVar) {
                      onSetSelectedSttProvider?.({
                        ...selectedSttProvider,
                        variables: { ...selectedSttProvider.variables, [apiKeyVar.key]: envKey },
                      });
                    } else {
                      toast.error("未找到 API Key", {
                        description: `在 .env.local 中未找到 ${(STT_ENV_KEYS[selectedSttProvider.provider] ?? []).join(" / ")}`,
                      });
                    }
                  });
                }}
                className="flex shrink-0 items-center gap-1 text-[11px] text-primary hover:underline ml-2"
              >
                <FileKey className="size-3" />
                从 .env.local 读取
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="**********"
                value={getApiKeyValue()}
                onChange={(value) => {
                  const apiKeyVar = findKeyAndValue("api_key");
                  if (!apiKeyVar || !selectedSttProvider) return;

                  onSetSelectedSttProvider({
                    ...selectedSttProvider,
                    variables: {
                      ...selectedSttProvider.variables,
                      [apiKeyVar.key]:
                        typeof value === "string" ? value : value.target.value,
                    },
                  });
                }}
                onKeyDown={(e) => {
                  const apiKeyVar = findKeyAndValue("api_key");
                  if (!apiKeyVar || !selectedSttProvider) return;

                  onSetSelectedSttProvider({
                    ...selectedSttProvider,
                    variables: {
                      ...selectedSttProvider.variables,
                      [apiKeyVar.key]: (e.target as HTMLInputElement).value,
                    },
                  });
                }}
                disabled={false}
                className="flex-1 h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
              />
              {isApiKeyEmpty() ? (
                <Button
                  onClick={() => {
                    const apiKeyVar = findKeyAndValue("api_key");
                    if (!apiKeyVar || !selectedSttProvider || isApiKeyEmpty())
                      return;

                    onSetSelectedSttProvider({
                      ...selectedSttProvider,
                      variables: {
                        ...selectedSttProvider.variables,
                        [apiKeyVar.key]: getApiKeyValue(),
                      },
                    });
                  }}
                  disabled={isApiKeyEmpty()}
                  size="icon"
                  className="shrink-0 h-11 w-11"
                  title="Submit API Key"
                >
                  <KeyIcon className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const apiKeyVar = findKeyAndValue("api_key");
                    if (!apiKeyVar || !selectedSttProvider) return;

                    onSetSelectedSttProvider({
                      ...selectedSttProvider,
                      variables: {
                        ...selectedSttProvider.variables,
                        [apiKeyVar.key]: "",
                      },
                    });
                  }}
                  size="icon"
                  variant="destructive"
                  className="shrink-0 h-11 w-11"
                  title="Remove API Key"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 mt-2">
        {sttVariables
          ?.filter(
            (variable) =>
              variable?.key !== findKeyAndValue("api_key")?.key &&
              variable?.key !== "language" // Language is configured in the Speech Recognition Language section below
          )
          .map((variable) => {
            const getVariableValue = () => {
              if (!variable?.key || !selectedSttProvider?.variables) return "";
              return selectedSttProvider.variables[variable.key] || "";
            };

            const isModelVariable = variable?.key === "model";
            const currentProvider = allSttProviders?.find(
              (p) => p?.id === selectedSttProvider?.provider
            );
            const isCustomProvider = currentProvider?.isCustom;
            const providerDisplayName = isCustomProvider
              ? "Custom Provider"
              : currentProvider?.name || selectedSttProvider?.provider;

            // Use ModelSelector for model variable if provider has predefined models
            if (isModelVariable && !isCustomProvider && selectedSttProvider?.provider) {
              return (
                <div key={variable?.key}>
                  <ModelSelector
                    providerId={selectedSttProvider.provider}
                    selectedModel={getVariableValue()}
                    onModelChange={(model) => {
                      if (!variable?.key || !selectedSttProvider) return;
                      onSetSelectedSttProvider({
                        ...selectedSttProvider,
                        variables: {
                          ...selectedSttProvider.variables,
                          [variable.key]: model,
                        },
                      });
                    }}
                    type="stt"
                    providerDisplayName={providerDisplayName}
                  />
                </div>
              );
            }

            return (
              <div className="space-y-1" key={variable?.key}>
                <Header
                  title={variable?.value || ""}
                  description={`add your preferred ${variable?.key?.replace(
                    /_/g,
                    " "
                  )} for ${providerDisplayName}`}
                />
                <TextInput
                  placeholder={`Enter ${providerDisplayName} ${variable?.key?.replace(/_/g, " ") || "value"}`}
                  value={getVariableValue()}
                  onChange={(value) => {
                    if (!variable?.key || !selectedSttProvider) return;

                    onSetSelectedSttProvider({
                      ...selectedSttProvider,
                      variables: {
                        ...selectedSttProvider.variables,
                        [variable.key]: value,
                      },
                    });
                  }}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
};
