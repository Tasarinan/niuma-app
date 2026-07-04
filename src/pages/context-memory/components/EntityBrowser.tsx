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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Trash2,
  Users,
  FolderKanban,
  Building2,
  BookOpen,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  getAllKnowledgeEntities,
  deleteKnowledgeEntity,
} from "@/lib/database";
import type { KnowledgeEntity, EntityType } from "@/types";

interface EntityBrowserProps {
  refreshTrigger?: number;
}

const ENTITY_TYPES: { type: EntityType; label: string; icon: React.ElementType }[] = [
  { type: "person", label: "People", icon: Users },
  { type: "project", label: "Projects", icon: FolderKanban },
  { type: "company", label: "Companies", icon: Building2 },
  { type: "term", label: "Terms", icon: BookOpen },
];

export const EntityBrowser = ({ refreshTrigger }: EntityBrowserProps) => {
  const [entities, setEntities] = useState<KnowledgeEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EntityType>("person");

  const loadEntities = async () => {
    setLoading(true);
    try {
      const data = await getAllKnowledgeEntities();
      setEntities(data);
    } catch (error) {
      console.error("Failed to load entities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntities();
  }, [refreshTrigger]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entity?")) return;

    setDeletingId(id);
    try {
      await deleteKnowledgeEntity(id);
      setEntities((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error("Failed to delete entity:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const getEntitiesByType = (type: EntityType) => {
    return entities.filter((e) => e.entityType === type);
  };

  const getEntityCount = (type: EntityType) => {
    return entities.filter((e) => e.entityType === type).length;
  };

  if (loading) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Extracted Entities
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

  if (entities.length === 0) {
    return (
      <Card className="shadow-none border border-border/70 rounded-xl">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Extracted Entities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No entities extracted yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Entities are extracted from conversation summaries
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
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Extracted Entities
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {entities.length} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EntityType)}>
          <TabsList className="w-full mb-4">
            {ENTITY_TYPES.map(({ type, label, icon: Icon }) => (
              <TabsTrigger
                key={type}
                value={type}
                className="flex items-center gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {getEntityCount(type) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                    {getEntityCount(type)}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {ENTITY_TYPES.map(({ type, icon: Icon }) => (
            <TabsContent key={type} value={type}>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-4">
                  {getEntitiesByType(type).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Icon className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No {type}s found
                      </p>
                    </div>
                  ) : (
                    getEntitiesByType(type).map((entity) => (
                      <div
                        key={entity.id}
                        className="group p-3 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {entity.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {entity.mentionCount} mentions
                              </Badge>
                            </div>
                            {entity.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {entity.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              First seen: {formatDate(entity.firstSeen)} | Last:{" "}
                              {formatDate(entity.lastSeen)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => handleDelete(entity.id)}
                            disabled={deletingId === entity.id}
                          >
                            {deletingId === entity.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
