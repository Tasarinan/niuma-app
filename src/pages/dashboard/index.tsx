import { useState, useCallback } from "react";
import { PageLayout } from "@/layouts";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Sparkles } from "lucide-react";
import { compactKnowledge } from "@/lib/functions/knowledge-compactor";
import { useApp } from "@/contexts";
import { RecentGoals, RecentDecisions, RecentTeamUpdates } from "./components";

const Dashboard = () => {
  const { selectedAIProvider, allAiProviders } = useApp();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCompacting, setIsCompacting] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleCompactKnowledge = useCallback(async () => {
    setIsCompacting(true);
    try {
      const provider = allAiProviders.find(
        (p) => p.id === selectedAIProvider.provider
      );
      await compactKnowledge({
        provider,
        selectedProvider: selectedAIProvider,
      });
      handleRefresh();
    } catch (error) {
      console.error("Failed to compact knowledge:", error);
    } finally {
      setIsCompacting(false);
    }
  }, [handleRefresh, allAiProviders, selectedAIProvider]);

  return (
    <PageLayout
      title="Dashboard"
      description="Your current focus areas from recent meetings"
      rightSlot={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCompactKnowledge}
            disabled={isCompacting}
            className="flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            {isCompacting ? "Updating..." : "Update Knowledge"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <RecentGoals refreshTrigger={refreshTrigger} />
        <RecentDecisions refreshTrigger={refreshTrigger} />
        <RecentTeamUpdates refreshTrigger={refreshTrigger} />
      </div>
    </PageLayout>
  );
};

export default Dashboard;
