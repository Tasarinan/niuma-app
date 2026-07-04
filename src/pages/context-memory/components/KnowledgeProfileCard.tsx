import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, FolderKanban, BookOpen, Brain, Edit2, Copy, Check } from "lucide-react";
import { getKnowledgeProfile, updateKnowledgeProfile } from "@/lib/database";
import type { KnowledgeProfile } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  KeyPersonEditor,
  KeyProjectEditor,
  TerminologyEditor,
} from "@/components/editors";

interface KnowledgeProfileCardProps {
  refreshTrigger?: number;
}

type EditDialog =
  | "keyPeople"
  | "keyProjects"
  | "terminology"
  | null;

export const KnowledgeProfileCard = ({
  refreshTrigger,
}: KnowledgeProfileCardProps) => {
  const [profile, setProfile] = useState<KnowledgeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<EditDialog>(null);
  const [copied, setCopied] = useState(false);

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

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Save handlers
  const handleSaveKeyPeople = async (newPeople: any[]) => {
    if (!profile) return;
    try {
      await updateKnowledgeProfile({ keyPeople: newPeople });
      setOpenDialog(null);
      loadProfile();
    } catch (error) {
      console.error("Failed to save key people:", error);
    }
  };

  const handleSaveKeyProjects = async (newProjects: any[]) => {
    if (!profile) return;
    try {
      await updateKnowledgeProfile({ keyProjects: newProjects });
      setOpenDialog(null);
      loadProfile();
    } catch (error) {
      console.error("Failed to save key projects:", error);
    }
  };

  const handleSaveTerminology = async (newTerms: any[]) => {
    if (!profile) return;
    try {
      await updateKnowledgeProfile({ terminology: newTerms });
      setOpenDialog(null);
      loadProfile();
    } catch (error) {
      console.error("Failed to save terminology:", error);
    }
  };

  const handleCopyAsMarkdown = async () => {
    if (!profile) return;

    let markdown = "# Knowledge Profile\n\n";

    if (profile.summary) {
      markdown += `## Background\n\n${profile.summary}\n\n`;
    }

    if (profile.recentGoals && profile.recentGoals.length > 0) {
      markdown += `## Recent Goals\n\n`;
      profile.recentGoals.forEach(goal => {
        markdown += `- ${goal}\n`;
      });
      markdown += "\n";
    }

    if (profile.recentDecisions && profile.recentDecisions.length > 0) {
      markdown += `## Recent Decisions\n\n`;
      profile.recentDecisions.forEach(decision => {
        markdown += `- ${decision}\n`;
      });
      markdown += "\n";
    }

    if (profile.recentTeamUpdates && profile.recentTeamUpdates.length > 0) {
      markdown += `## Recent Team Updates\n\n`;
      profile.recentTeamUpdates.forEach(update => {
        markdown += `- ${update}\n`;
      });
      markdown += "\n";
    }

    if (profile.keyPeople && profile.keyPeople.length > 0) {
      markdown += `## Key People\n\n`;
      profile.keyPeople.forEach(person => {
        markdown += `- **${person.name}**: ${person.role}${person.relationship ? ` (${person.relationship})` : ""}\n`;
      });
      markdown += "\n";
    }

    if (profile.keyProjects && profile.keyProjects.length > 0) {
      markdown += `## Key Projects\n\n`;
      profile.keyProjects.forEach(project => {
        markdown += `- **${project.name}** [${project.status}]: ${project.description}\n`;
      });
      markdown += "\n";
    }

    if (profile.terminology && profile.terminology.length > 0) {
      markdown += `## Domain Terms\n\n`;
      profile.terminology.forEach(term => {
        markdown += `- **${term.term}**: ${term.meaning}\n`;
      });
      markdown += "\n";
    }

    markdown += `---\n\n`;
    markdown += `*Last compacted: ${formatDate(profile.lastCompacted)}*\n`;
    markdown += `*Source summaries: ${profile.sourceCount}*\n`;

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Knowledge Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile || !profile.summary) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Knowledge Profile
          </CardTitle>
          <CardDescription>
            Compacted from your meeting summaries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No knowledge profile yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              A profile is created after compacting meeting summaries
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none border border-border/70 rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Knowledge Profile
            </CardTitle>
            <CardDescription>
              {profile.sourceCount} summaries compacted
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Last updated: {formatDate(profile.lastCompacted)}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopyAsMarkdown}
              title="Copy as Markdown"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground bg-accent/30 p-3 rounded-lg">
            {profile.summary}
          </p>
        </div>

        {/* Key People */}
        {profile.keyPeople.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 group">
              <Users className="h-3.5 w-3.5" />
              Key People
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setOpenDialog("keyPeople")}
                title="Edit Key People"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </h4>
            <div className="grid gap-2">
              {profile.keyPeople.map((person, i) => (
                <div
                  key={i}
                  className="text-sm p-2 rounded-lg bg-accent/20 border border-border/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{person.name}</span>
                    {person.role && (
                      <Badge variant="secondary" className="text-xs">
                        {person.role}
                      </Badge>
                    )}
                  </div>
                  {person.relationship && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {person.relationship}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Projects */}
        {profile.keyProjects.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 group">
              <FolderKanban className="h-3.5 w-3.5" />
              Key Projects
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setOpenDialog("keyProjects")}
                title="Edit Key Projects"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </h4>
            <div className="grid gap-2">
              {profile.keyProjects.map((project, i) => (
                <div
                  key={i}
                  className="text-sm p-2 rounded-lg bg-accent/20 border border-border/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{project.name}</span>
                    <Badge
                      variant={
                        project.status === "active"
                          ? "default"
                          : project.status === "completed"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {project.status}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {project.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terminology */}
        {profile.terminology.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 group">
              <BookOpen className="h-3.5 w-3.5" />
              Domain Terms
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setOpenDialog("terminology")}
                title="Edit Terminology"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </h4>
            <div className="grid gap-2">
              {profile.terminology.map((term, i) => (
                <div
                  key={i}
                  className="text-sm p-2 rounded-lg bg-accent/20 border border-border/50"
                >
                  <span className="font-medium">{term.term}</span>
                  {term.meaning && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {term.meaning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Dialogs */}
      <Dialog
        open={openDialog === "keyPeople"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Key People</DialogTitle>
            <DialogDescription>
              Manage key people mentioned in your meetings
            </DialogDescription>
          </DialogHeader>
          <KeyPersonEditor
            people={profile?.keyPeople || []}
            onSave={handleSaveKeyPeople}
            onCancel={() => setOpenDialog(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog === "keyProjects"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Key Projects</DialogTitle>
            <DialogDescription>
              Manage projects discussed in your meetings
            </DialogDescription>
          </DialogHeader>
          <KeyProjectEditor
            projects={profile?.keyProjects || []}
            onSave={handleSaveKeyProjects}
            onCancel={() => setOpenDialog(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog === "terminology"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Terminology</DialogTitle>
            <DialogDescription>
              Manage domain-specific terms
            </DialogDescription>
          </DialogHeader>
          <TerminologyEditor
            terms={profile?.terminology || []}
            onSave={handleSaveTerminology}
            onCancel={() => setOpenDialog(null)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};
