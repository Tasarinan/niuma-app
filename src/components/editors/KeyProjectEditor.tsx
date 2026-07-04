import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Check, X, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS } from "@/config";
import type { KeyProject } from "@/types";

interface KeyProjectEditorProps {
  projects: KeyProject[];
  onSave: (projects: KeyProject[]) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

const PROJECT_STATUSES = ["active", "planning", "completed", "on-hold"] as const;

export const KeyProjectEditor = ({
  projects,
  onSave,
  onCancel,
  className = "",
}: KeyProjectEditorProps) => {
  const [editProjects, setEditProjects] = useState<KeyProject[]>([...projects]);
  const [newProject, setNewProject] = useState<KeyProject>({
    name: "",
    status: "active",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleAddProject = () => {
    if (!newProject.name.trim()) return;

    setEditProjects([
      ...editProjects,
      {
        name: newProject.name.trim(),
        status: newProject.status,
        description: newProject.description.trim(),
      },
    ]);
    setNewProject({ name: "", status: "active", description: "" });
  };

  const handleRemoveProject = (index: number) => {
    setEditProjects(editProjects.filter((_, i) => i !== index));
  };

  const handleUpdateProject = (
    index: number,
    field: keyof KeyProject,
    value: string
  ) => {
    const updated = [...editProjects];
    updated[index] = { ...updated[index], [field]: value };
    setEditProjects(updated);
  };

  const handleSave = async () => {
    const filtered = editProjects.filter((project) => project.name.trim() !== "");
    setIsSaving(true);
    try {
      await onSave(filtered);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditProjects([...projects]);
    setNewProject({ name: "", status: "active", description: "" });
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newProject.name.trim()) {
      e.preventDefault();
      handleAddProject();
    }
  };

  const hasChanges = JSON.stringify(editProjects) !== JSON.stringify(projects);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "completed":
        return "secondary";
      case "planning":
        return "outline";
      case "on-hold":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Projects List */}
      <div className="space-y-2">
        {editProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No key projects yet
          </p>
        ) : (
          editProjects.map((project, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 rounded-lg border bg-accent/20"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={project.name}
                    onChange={(e) =>
                      handleUpdateProject(index, "name", e.target.value)
                    }
                    className="font-medium"
                    disabled={isSaving}
                    placeholder="Project name..."
                    maxLength={INPUT_LIMITS.MAX_NAME_LENGTH}
                  />
                  <Select
                    value={project.status}
                    onValueChange={(value) =>
                      handleUpdateProject(index, "status", value)
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          <Badge variant={getStatusVariant(status)} className="text-xs">
                            {status}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={project.description}
                  onChange={(e) =>
                    handleUpdateProject(index, "description", e.target.value)
                  }
                  className="text-sm resize-none h-16"
                  disabled={isSaving}
                  placeholder="Project description..."
                  maxLength={INPUT_LIMITS.MAX_DESCRIPTION_LENGTH}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveProject(index)}
                disabled={isSaving}
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                title="Remove project"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add New Project */}
      <div className="space-y-2 p-3 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Project name..."
            disabled={isSaving}
            maxLength={INPUT_LIMITS.MAX_NAME_LENGTH}
          />
          <Select
            value={newProject.status}
            onValueChange={(value) =>
              setNewProject({ ...newProject, status: value })
            }
            disabled={isSaving}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  <Badge variant={getStatusVariant(status)} className="text-xs">
                    {status}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={newProject.description}
          onChange={(e) =>
            setNewProject({ ...newProject, description: e.target.value })
          }
          className="text-sm resize-none h-16"
          disabled={isSaving}
          placeholder="Project description..."
          maxLength={INPUT_LIMITS.MAX_DESCRIPTION_LENGTH}
        />
        <Button
          size="sm"
          onClick={handleAddProject}
          disabled={!newProject.name.trim() || isSaving}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Project
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
          className="text-sm"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="text-sm"
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
