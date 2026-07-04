import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Edit2 } from "lucide-react";
import { getKnowledgeProfile, updateKnowledgeProfile } from "@/lib/database";
import type { KnowledgeProfile } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ListEditor } from "@/components/editors";

interface RecentTeamUpdatesProps {
  refreshTrigger?: number;
}

export const RecentTeamUpdates = ({ refreshTrigger }: RecentTeamUpdatesProps) => {
  const [profile, setProfile] = useState<KnowledgeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeProfile();
      setProfile(data);
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [refreshTrigger]);

  const handleSave = async (newUpdates: string[]) => {
    try {
      await updateKnowledgeProfile({ recentTeamUpdates: newUpdates });
      setIsDialogOpen(false);
      loadProfile();
    } catch (error) {
      console.error("Failed to save recent team updates:", error);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Recent Team Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const updates = profile?.recentTeamUpdates || [];

  return (
    <>
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Team Updates
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsDialogOpen(true)}
              title="Edit Recent Team Updates"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {updates.length > 0 ? (
            <div className="grid gap-1.5">
              {updates.map((update, i) => (
                <div key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span className="flex-1">{update}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent team updates yet
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recent Team Updates</DialogTitle>
            <DialogDescription>
              Manage your recent team updates
            </DialogDescription>
          </DialogHeader>
          <ListEditor
            items={updates}
            onSave={handleSave}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
