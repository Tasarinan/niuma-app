import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from "@/components";
import { Header } from "@/components";
import {
  getAIModelsForProvider,
  getSTTModelsForProvider,
  hasModelsForProvider,
  type ModelOption,
} from "@/config/models.constants";
import {
  getModelPricing,
  getSTTModelPricing,
  formatCost,
  getPricingConfig,
  getSTTPricingConfig,
} from "@/lib/storage/pricing.storage";
import { Star, Pencil, AlertCircle } from "lucide-react";

interface ModelSelectorProps {
  providerId: string;
  selectedModel: string;
  onModelChange: (model: string) => void;
  type: "ai" | "stt";
  providerDisplayName?: string;
}

const CUSTOM_MODEL_VALUE = "__custom__";

/**
 * Check if pricing for a model is using fallback/estimated values.
 * Returns true if using wildcard (*) pricing instead of exact model pricing.
 */
function isUsingFallbackPricing(
  providerId: string,
  modelId: string,
  type: "ai" | "stt"
): boolean {
  if (type === "ai") {
    const config = getPricingConfig();
    const providerPricing = config[providerId];
    if (!providerPricing) return true; // Using provider wildcard
    if (providerPricing[modelId]) return false; // Exact match found
    // Check if any pattern matches
    for (const pattern of Object.keys(providerPricing)) {
      if (pattern !== "*" && modelId.toLowerCase().includes(pattern.toLowerCase())) {
        return false; // Pattern match found
      }
    }
    return true; // Using wildcard
  } else {
    const config = getSTTPricingConfig();
    const providerPricing = config[providerId];
    if (!providerPricing) return true;
    if (providerPricing[modelId]) return false;
    for (const pattern of Object.keys(providerPricing)) {
      if (pattern !== "*" && modelId.toLowerCase().includes(pattern.toLowerCase())) {
        return false;
      }
    }
    return true;
  }
}

/**
 * Format pricing for display in dropdown
 */
function formatAIPricing(providerId: string, modelId: string): { text: string; isEstimate: boolean } {
  const pricing = getModelPricing(providerId, modelId);
  const isEstimate = isUsingFallbackPricing(providerId, modelId, "ai");
  if (pricing.inputPer1k === 0 && pricing.outputPer1k === 0) {
    return { text: "Free", isEstimate: false };
  }
  return {
    text: `$${pricing.inputPer1k}/$${pricing.outputPer1k} per 1K`,
    isEstimate
  };
}

function formatSTTPricing(providerId: string, modelId: string): { text: string; isEstimate: boolean } {
  const pricing = getSTTModelPricing(providerId, modelId);
  const isEstimate = isUsingFallbackPricing(providerId, modelId, "stt");
  if (pricing.perMinute === 0) {
    return { text: "Free", isEstimate: false };
  }
  const text = pricing.perMinute < 0.001
    ? `$${pricing.perMinute.toFixed(5)}/min`
    : `$${pricing.perMinute.toFixed(4)}/min`;
  return { text, isEstimate };
}

/**
 * Calculate estimated cost for typical usage
 */
function getEstimatedCost(
  providerId: string,
  modelId: string,
  type: "ai" | "stt"
): { text: string; isEstimate: boolean } {
  const isEstimate = isUsingFallbackPricing(providerId, modelId, type);

  if (type === "ai") {
    const pricing = getModelPricing(providerId, modelId);
    if (pricing.inputPer1k === 0 && pricing.outputPer1k === 0) {
      return { text: "Free (local model)", isEstimate: false };
    }
    // Estimate based on 500 input + 500 output tokens (typical request)
    const inputCost = (500 / 1000) * pricing.inputPer1k;
    const outputCost = (500 / 1000) * pricing.outputPer1k;
    const totalCost = inputCost + outputCost;
    return {
      text: `~${formatCost(totalCost)} per typical request (500 in/out tokens)`,
      isEstimate
    };
  } else {
    const pricing = getSTTModelPricing(providerId, modelId);
    if (pricing.perMinute === 0) {
      return { text: "Free (local model)", isEstimate: false };
    }
    return {
      text: `~${formatCost(pricing.perMinute)} per minute of audio`,
      isEstimate
    };
  }
}

export const ModelSelector = ({
  providerId,
  selectedModel,
  onModelChange,
  type,
  providerDisplayName,
}: ModelSelectorProps) => {
  const [isCustomMode, setIsCustomMode] = useState(false);

  const models = useMemo(
    () =>
      type === "ai"
        ? getAIModelsForProvider(providerId)
        : getSTTModelsForProvider(providerId),
    [providerId, type]
  );

  const hasModels = hasModelsForProvider(providerId, type);

  // Check if the current selected model is in the predefined list
  const isSelectedModelPredefined = useMemo(
    () => hasModels && models.some((m) => m.id === selectedModel),
    [hasModels, models, selectedModel]
  );

  // Sync custom mode state: exit custom mode if user selects a predefined model
  useEffect(() => {
    if (isSelectedModelPredefined && isCustomMode) {
      setIsCustomMode(false);
    }
  }, [isSelectedModelPredefined, isCustomMode]);

  // If no predefined models, or we're in custom mode, show text input
  if (!hasModels || isCustomMode) {
    const costInfo = selectedModel
      ? getEstimatedCost(providerId, selectedModel, type)
      : null;

    return (
      <div className="space-y-2">
        <Header
          title="MODEL"
          description={`Enter the model identifier for ${
            providerDisplayName || providerId
          }`}
        />
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={`Enter model name (e.g., ${
              type === "ai" ? "gpt-4o" : "whisper-1"
            })`}
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            className="flex-1 h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
          />
          {hasModels && isCustomMode && (
            <button
              onClick={() => setIsCustomMode(false)}
              className="px-3 h-11 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              title="Back to model list"
            >
              List
            </button>
          )}
        </div>
        {costInfo && (
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <span>Estimated: {costInfo.text}</span>
            {costInfo.isEstimate && (
              <span className="inline-flex items-center gap-0.5 text-yellow-600 dark:text-yellow-500" title="Using estimated pricing - actual cost may vary">
                <AlertCircle className="h-3 w-3" />
                <span className="text-[10px]">(est.)</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // If selected model is not in predefined list but we have models, show as custom
  const displayValue =
    !isSelectedModelPredefined && selectedModel
      ? CUSTOM_MODEL_VALUE
      : selectedModel;

  // Get the display name for the selected model
  const getSelectedModelDisplay = () => {
    if (!selectedModel) return null;

    // If it's a custom model (not in predefined list)
    if (!isSelectedModelPredefined) {
      return (
        <span className="flex items-center gap-2">
          <Pencil className="h-3 w-3" />
          {selectedModel}
        </span>
      );
    }

    // Find the model in the predefined list
    const modelInfo = models.find((m) => m.id === selectedModel);
    if (modelInfo) {
      return (
        <span className="flex items-center gap-2">
          {modelInfo.recommended && <Star className="h-3 w-3 text-yellow-500" />}
          {modelInfo.name}
        </span>
      );
    }

    return selectedModel;
  };

  // Get cost info for the footer
  const costInfo = selectedModel
    ? getEstimatedCost(providerId, selectedModel, type)
    : null;

  return (
    <div className="space-y-2">
      <Header
        title="MODEL"
        description={`Select a model for ${
          providerDisplayName || providerId
        } or enter a custom model name`}
      />
      <Select
        value={displayValue || ""}
        onValueChange={(value) => {
          if (value === CUSTOM_MODEL_VALUE) {
            setIsCustomMode(true);
          } else {
            onModelChange(value);
          }
        }}
      >
        <SelectTrigger className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors">
          <SelectValue placeholder="Select a model">
            {getSelectedModelDisplay()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Recommended models first */}
          {models.filter((m) => m.recommended).length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                Recommended
              </div>
              {models
                .filter((m) => m.recommended)
                .map((model) => (
                  <ModelSelectItem
                    key={model.id}
                    model={model}
                    providerId={providerId}
                    type={type}
                    showStar
                  />
                ))}
            </>
          )}

          {/* Other models */}
          {models.filter((m) => !m.recommended).length > 0 && (
            <>
              {models.filter((m) => m.recommended).length > 0 && (
                <div className="border-t border-input/50 my-1" />
              )}
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                All Models
              </div>
              {models
                .filter((m) => !m.recommended)
                .map((model) => (
                  <ModelSelectItem
                    key={model.id}
                    model={model}
                    providerId={providerId}
                    type={type}
                  />
                ))}
            </>
          )}

          {/* Custom model option */}
          <div className="border-t border-input/50 my-1" />
          <SelectItem
            value={CUSTOM_MODEL_VALUE}
            className="cursor-pointer hover:bg-accent/50"
          >
            <span className="flex items-center gap-2">
              <Pencil className="h-3 w-3" />
              <span>Custom model...</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Cost estimation */}
      {costInfo && (
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <span>Estimated: {costInfo.text}</span>
          {costInfo.isEstimate && (
            <span className="inline-flex items-center gap-0.5 text-yellow-600 dark:text-yellow-500" title="Using estimated pricing - actual cost may vary">
              <AlertCircle className="h-3 w-3" />
              <span className="text-[10px]">(est.)</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Individual model option in the select dropdown
 */
function ModelSelectItem({
  model,
  providerId,
  type,
  showStar = false,
}: {
  model: ModelOption;
  providerId: string;
  type: "ai" | "stt";
  showStar?: boolean;
}) {
  const pricing =
    type === "ai"
      ? formatAIPricing(providerId, model.id)
      : formatSTTPricing(providerId, model.id);

  return (
    <SelectItem
      value={model.id}
      className="cursor-pointer hover:bg-accent/50"
    >
      <div className="flex items-center justify-between w-full gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {showStar && <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
          <span className="font-medium truncate">{model.name}</span>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
          {pricing.text}
          {pricing.isEstimate && (
            <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
          )}
        </span>
      </div>
    </SelectItem>
  );
}
