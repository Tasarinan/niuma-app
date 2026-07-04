import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, ChevronRight, MessageSquare, Loader2 } from "lucide-react";
import { getAllMeetingSummaries, deleteMeetingSummary } from "@/lib/database";
import type { MeetingSummary } from "@/types";

interface SummaryListProps {
  onSelectSummary: (summary: MeetingSummary) => void;
  selectedSummaryId?: string;
  refreshTrigger?: number;
}

export const SummaryList = ({
  onSelectSummary,
  selectedSummaryId,
  refreshTrigger,
}: SummaryListProps) => {
  const [summaries, setSummaries] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSummaries = async () => {
    setLoading(true);
    try {
      const data = await getAllMeetingSummaries();
      setSummaries(data);
    } catch (error) {
      console.error("Failed to load summaries:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummaries();
  }, [refreshTrigger]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this summary?")) return;

    setDeletingId(id);
    try {
      await deleteMeetingSummary(id);
      setSummaries((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to delete summary:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Meeting Summaries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summaries.length === 0) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Meeting Summaries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No summaries yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Summaries are created after conversations with 2+ exchanges
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none border border-border/70 rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Meeting Summaries</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {summaries.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="p-4 pt-2 space-y-2">
            {summaries.map((summary) => (
              <div
                key={summary.id}
                onClick={() => onSelectSummary(summary)}
                className={`
                  group relative p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    selectedSummaryId === summary.id
                      ? "bg-accent border-accent-foreground/20"
                      : "hover:bg-accent/50 border-border/50"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(summary.createdAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(summary.createdAt)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {summary.exchangeCount} exchanges
                      </Badge>
                    </div>
                    <p className="text-sm line-clamp-2">{summary.summary}</p>
                    {summary.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {summary.topics.slice(0, 3).map((topic, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                        {summary.topics.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{summary.topics.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDelete(e, summary.id)}
                      disabled={deletingId === summary.id}
                    >
                      {deletingId === summary.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
