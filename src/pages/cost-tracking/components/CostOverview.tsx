import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("pages");
  const avgCostPerRequest =
    summary.totalRequests > 0 ? summary.totalCost / summary.totalRequests : 0;

  const stats = [
    {
      title: t("costTrackingPage.overview.totalCost"),
      value: formatCost(summary.totalCost),
      subtitle: t("costTrackingPage.overview.thisMonth"),
    },
    {
      title: t("costTrackingPage.overview.totalTokens"),
      value: formatNumber(summary.totalTokens),
      subtitle: t("costTrackingPage.overview.inputOutput"),
    },
    {
      title: t("costTrackingPage.overview.totalRequests"),
      value: formatNumber(summary.totalRequests),
      subtitle: t("costTrackingPage.overview.apiCalls"),
    },
    {
      title: t("costTrackingPage.overview.avgCost"),
      value: formatCost(avgCostPerRequest),
      subtitle: t("costTrackingPage.overview.perCall"),
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
