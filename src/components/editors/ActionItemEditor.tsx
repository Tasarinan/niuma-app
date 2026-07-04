import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Check, X, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS } from "@/config";
import type { ActionItem } from "@/types";

interface ActionItemInput {
  text: string;
  assignee: string;
  status: "pending" | "completed";
}

interface ActionItemEditorProps {
  items: ActionItem[];
  onSave: (items: ActionItemInput[]) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export const ActionItemEditor = ({
  items,
  onSave,
  onCancel,
  className = "",
}: ActionItemEditorProps) => {
  const [editItems, setEditItems] = useState<ActionItemInput[]>(
    items.map((item) => ({
      text: item.text,
      assignee: item.assignee || "",
      status: item.status,
    }))
  );
  const [newItem, setNewItem] = useState<ActionItemInput>({
    text: "",
    assignee: "",
    status: "pending",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleAddItem = () => {
    if (!newItem.text.trim()) return;

    setEditItems([
      ...editItems,
      {
        text: newItem.text.trim(),
        assignee: newItem.assignee.trim(),
        status: newItem.status,
      },
    ]);
    setNewItem({ text: "", assignee: "", status: "pending" });
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: keyof ActionItemInput,
    value: string | "pending" | "completed"
  ) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditItems(updated);
  };

  const handleToggleStatus = (index: number) => {
    const updated = [...editItems];
    updated[index].status =
      updated[index].status === "pending" ? "completed" : "pending";
    setEditItems(updated);
  };

  const handleSave = async () => {
    const filtered = editItems.filter((item) => item.text.trim() !== "");
    setIsSaving(true);
    try {
      await onSave(filtered);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditItems(
      items.map((item) => ({
        text: item.text,
        assignee: item.assignee || "",
        status: item.status,
      }))
    );
    setNewItem({ text: "", assignee: "", status: "pending" });
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newItem.text.trim()) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const hasChanges =
    JSON.stringify(editItems) !==
    JSON.stringify(
      items.map((item) => ({
        text: item.text,
        assignee: item.assignee || "",
        status: item.status,
      }))
    );

  return (
    <div className={cn("space-y-3", className)}>
      {/* Items List */}
      <div className="space-y-2">
        {editItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No action items yet
          </p>
        ) : (
          editItems.map((item, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-2 p-3 rounded-lg border",
                item.status === "completed"
                  ? "bg-green-50/50 border-green-200"
                  : "bg-background border-border"
              )}
            >
              <Checkbox
                checked={item.status === "completed"}
                onCheckedChange={() => handleToggleStatus(index)}
                disabled={isSaving}
                className="mt-1"
              />
              <div className="flex-1 space-y-2">
                <Input
                  value={item.text}
                  onChange={(e) =>
                    handleUpdateItem(index, "text", e.target.value)
                  }
                  className={cn(
                    "text-sm",
                    item.status === "completed" && "line-through"
                  )}
                  disabled={isSaving}
                  placeholder="Action item description..."
                  maxLength={INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH}
                />
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={item.assignee}
                    onChange={(e) =>
                      handleUpdateItem(index, "assignee", e.target.value)
                    }
                    className="text-xs h-7"
                    disabled={isSaving}
                    placeholder="Assignee (optional)"
                    maxLength={INPUT_LIMITS.MAX_ASSIGNEE_LENGTH}
                  />
                  <Badge
                    variant={
                      item.status === "completed" ? "default" : "secondary"
                    }
                    className="text-xs flex-shrink-0"
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveItem(index)}
                disabled={isSaving}
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                title="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add New Item */}
      <div className="space-y-2 p-3 rounded-lg border border-dashed">
        <Input
          value={newItem.text}
          onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="New action item..."
          disabled={isSaving}
          maxLength={INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH}
        />
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={newItem.assignee}
            onChange={(e) =>
              setNewItem({ ...newItem, assignee: e.target.value })
            }
            className="text-xs h-7 flex-1"
            disabled={isSaving}
            placeholder="Assignee (optional)"
            maxLength={INPUT_LIMITS.MAX_ASSIGNEE_LENGTH}
          />
          <Button
            size="sm"
            onClick={handleAddItem}
            disabled={!newItem.text.trim() || isSaving}
            className="h-7"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
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
