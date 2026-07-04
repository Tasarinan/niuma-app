import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCost } from "@/lib";
import type { ProviderCostBreakdown } from "@/types";

interface CostByProviderProps {
  byProvider: Record<string, ProviderCostBreakdown>;
  loading?: boolean;
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

// Provider display names
const providerNames: Record<string, string> = {
  openai: "OpenAI",
  claude: "Anthropic Claude",
  gemini: "Google Gemini",
  groq: "Groq",
  mistral: "Mistral",
  perplexity: "Perplexity",
  openrouter: "OpenRouter",
  cohere: "Cohere",
  grok: "xAI Grok",
  ollama: "Ollama (Local)",
};

export const CostByProvider = ({ byProvider, loading }: CostByProviderProps) => {
  const providers = Object.entries(byProvider).sort(
    ([, a], [, b]) => b.cost - a.cost
  );

  if (loading) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-md lg:text-lg">By Provider</CardTitle>
          <CardDescription className="text-xs lg:text-sm">
            Cost breakdown by AI provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-muted rounded h-12"
              ></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none border border-border/70 rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-md lg:text-lg">By Provider</CardTitle>
        <CardDescription className="text-xs lg:text-sm">
          Cost breakdown by AI provider
        </CardDescription>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No provider data yet
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map(([providerId, data]) => {
              const totalCost = Object.values(byProvider).reduce(
                (sum, p) => sum + p.cost,
                0
              );
              const percentage =
                totalCost > 0 ? (data.cost / totalCost) * 100 : 0;

              return (
                <div key={providerId} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      {providerNames[providerId] || providerId}
                    </span>
                    <span className="text-sm font-bold">
                      {formatCost(data.cost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                      {formatNumber(data.tokens)} tokens | {data.requests}{" "}
                      requests
                    </span>
                    <span>{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary rounded-full h-1.5 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
