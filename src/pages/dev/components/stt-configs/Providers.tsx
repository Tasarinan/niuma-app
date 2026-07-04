import { Button, Header, Input, Selection, TextInput, ModelSelector } from "@/components";
import { UseSettingsReturn } from "@/types";
import curl2Json, { ResultJSON } from "@bany/curl-to-json";
import { KeyIcon, TrashIcon, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { getSTTProviderInfo } from "@/config/models.constants";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

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
              variable?.key !== "language" // Language is configured on the Language page
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
