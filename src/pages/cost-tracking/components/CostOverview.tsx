import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCost } from "@/lib";
import type { CostSummary } from "@/types";

interface CostOverviewProps {
  summary: CostSummary;
  loading?: boolean;
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
};

export const CostOverview = ({ summary, loading }: CostOverviewProps) => {
  const avgCostPerRequest =
    summary.totalRequests > 0 ? summary.totalCost / summary.totalRequests : 0;

  const stats = [
    {
      title: "Total Cost",
      value: formatCost(summary.totalCost),
      subtitle: "This month (estimated)",
    },
    {
      title: "Total Tokens",
      value: formatNumber(summary.totalTokens),
      subtitle: "Input + Output",
    },
    {
      title: "Total Requests",
      value: formatNumber(summary.totalRequests),
      subtitle: "API calls made",
    },
    {
      title: "Avg Cost/Request",
      value: formatCost(avgCostPerRequest),
      subtitle: "Per API call",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className="shadow-none border border-border/70 rounded-xl"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xs lg:text-sm text-muted-foreground font-medium">
              {stat.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-xl lg:text-2xl font-bold ${
                loading ? "animate-pulse bg-muted rounded w-20 h-8" : ""
              }`}
            >
              {loading ? "" : stat.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
