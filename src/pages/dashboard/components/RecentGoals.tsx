import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Target, Edit2 } from "lucide-react";
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

interface RecentGoalsProps {
  refreshTrigger?: number;
}

export const RecentGoals = ({ refreshTrigger }: RecentGoalsProps) => {
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

  const handleSave = async (newGoals: string[]) => {
    try {
      await updateKnowledgeProfile({ recentGoals: newGoals });
      setIsDialogOpen(false);
      loadProfile();
    } catch (error) {
      console.error("Failed to save recent goals:", error);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recent Goals
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

  const goals = profile?.recentGoals || [];

  return (
    <>
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Recent Goals
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsDialogOpen(true)}
              title="Edit Recent Goals"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {goals.length > 0 ? (
            <div className="grid gap-1.5">
              {goals.map((goal, i) => (
                <div key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span className="flex-1">{goal}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent goals yet
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Recent Goals</DialogTitle>
            <DialogDescription>
              Manage your recent goals
            </DialogDescription>
          </DialogHeader>
          <ListEditor
            items={goals}
            onSave={handleSave}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
