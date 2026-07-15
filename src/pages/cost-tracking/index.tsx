import { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CostOverview, CostChart, CostByProvider } from "./components";
import { getCostSummary, getDailyCosts } from "@/lib";
import type { CostSummary, DailyCostData } from "@/types";

const CostTracking = () => {
  const { t } = useTranslation("pages");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CostSummary>({
    totalCost: 0,
    totalTokens: 0,
    totalRequests: 0,
    byProvider: {},
    dailyTotals: [],
  });
  const [dailyCosts, setDailyCosts] = useState<DailyCostData[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Get current month data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      const [summaryData, dailyData] = await Promise.all([
        getCostSummary(startOfMonth),
        getDailyCosts(30),
      ]);

      setSummary(summaryData);
      setDailyCosts(dailyData);
    } catch (error) {
      console.error("Failed to load cost data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
  };

  return (
    <PageLayout
      title={t("costTrackingPage.title")}
      description={t("costTrackingPage.description")}
      rightSlot={
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Disclaimer */}
        <div className="text-xs text-amber-500 bg-amber-500/10 p-3 rounded-md">
          {t("costTrackingPage.disclaimer")}
        </div>

        {/* Summary Cards */}
        <CostOverview summary={summary} loading={loading} />

        {/* Chart */}
        <CostChart data={dailyCosts} loading={loading} />

        {/* Provider Breakdown */}
        <CostByProvider byProvider={summary.byProvider} loading={loading} />
      </div>
    </PageLayout>
  );
};

export default CostTracking;
