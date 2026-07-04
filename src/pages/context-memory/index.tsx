import { useState, useCallback } from "react";
import { PageLayout } from "@/layouts";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Sparkles } from "lucide-react";
import { compactKnowledge } from "@/lib/functions/knowledge-compactor";
import { useApp } from "@/contexts";
import {
  SummaryList,
  SummaryDetail,
  KnowledgeProfileCard,
  EntityBrowser,
  ContextSettings,
  UserIdentitySettings,
} from "./components";
import type { MeetingSummary } from "@/types";

const ContextMemory = () => {
  const { selectedAIProvider, allAiProviders } = useApp();
  const [selectedSummary, setSelectedSummary] = useState<MeetingSummary | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isCompacting, setIsCompacting] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleSettingsChange = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

  const handleSelectSummary = useCallback((summary: MeetingSummary) => {
    setSelectedSummary(summary);
  }, []);

  const handleCloseSummary = useCallback(() => {
    setSelectedSummary(null);
  }, []);

  const handleUpdateSummary = useCallback(() => {
    handleRefresh();
  }, [handleRefresh]);

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
      title="Context Memory"
      description="View and manage your conversation history and knowledge profile"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Knowledge Profile */}
          <KnowledgeProfileCard refreshTrigger={refreshTrigger} />

          {/* User Identity */}
          <UserIdentitySettings onSettingsChange={handleSettingsChange} />

          {/* Settings */}
          <ContextSettings onSettingsChange={handleSettingsChange} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Summary List or Detail */}
          {selectedSummary ? (
            <SummaryDetail
              summary={selectedSummary}
              onClose={handleCloseSummary}
              onUpdate={handleUpdateSummary}
            />
          ) : (
            <SummaryList
              onSelectSummary={handleSelectSummary}
              refreshTrigger={refreshTrigger}
            />
          )}

          {/* Entity Browser */}
          <EntityBrowser refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </PageLayout>
  );
};

export default ContextMemory;
