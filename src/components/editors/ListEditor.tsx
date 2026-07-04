import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS } from "@/config";

interface ListEditorProps {
  items: string[];
  onSave: (items: string[]) => void | Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  emptyMessage?: string;
  maxItems?: number;
  className?: string;
}

export const ListEditor = ({
  items,
  onSave,
  onCancel,
  placeholder = "Add item...",
  emptyMessage = "No items yet",
  maxItems,
  className = "",
}: ListEditorProps) => {
  const [editItems, setEditItems] = useState<string[]>([...items]);
  const [newItemText, setNewItemText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAddItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    if (maxItems && editItems.length >= maxItems) return;

    setEditItems([...editItems, trimmed]);
    setNewItemText("");
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, value: string) => {
    const updated = [...editItems];
    updated[index] = value;
    setEditItems(updated);
  };

  const handleSave = async () => {
    const filtered = editItems.filter((item) => item.trim() !== "");
    setIsSaving(true);
    try {
      await onSave(filtered);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditItems([...items]);
    setNewItemText("");
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newItemText.trim()) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const hasChanges = JSON.stringify(editItems) !== JSON.stringify(items);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Items List */}
      <div className="space-y-2">
        {editItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {emptyMessage}
          </p>
        ) : (
          editItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab" />
              <Input
                value={item}
                onChange={(e) => handleUpdateItem(index, e.target.value)}
                className="flex-1"
                disabled={isSaving}
                maxLength={INPUT_LIMITS.MAX_LIST_ITEM_LENGTH}
              />
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
      {(!maxItems || editItems.length < maxItems) && (
        <div className="flex items-center gap-2">
          <Input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isSaving}
            className="flex-1"
            maxLength={INPUT_LIMITS.MAX_LIST_ITEM_LENGTH}
          />
          <Button
            size="icon"
            variant="outline"
            onClick={handleAddItem}
            disabled={!newItemText.trim() || isSaving}
            className="h-9 w-9 flex-shrink-0"
            title="Add item (Enter)"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

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
