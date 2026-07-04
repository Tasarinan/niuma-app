import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Check, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS } from "@/config";
import type { Terminology } from "@/types";

interface TerminologyEditorProps {
  terms: Terminology[];
  onSave: (terms: Terminology[]) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export const TerminologyEditor = ({
  terms,
  onSave,
  onCancel,
  className = "",
}: TerminologyEditorProps) => {
  const [editTerms, setEditTerms] = useState<Terminology[]>([...terms]);
  const [newTerm, setNewTerm] = useState<Terminology>({
    term: "",
    meaning: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleAddTerm = () => {
    if (!newTerm.term.trim()) return;

    setEditTerms([
      ...editTerms,
      {
        term: newTerm.term.trim(),
        meaning: newTerm.meaning.trim(),
      },
    ]);
    setNewTerm({ term: "", meaning: "" });
  };

  const handleRemoveTerm = (index: number) => {
    setEditTerms(editTerms.filter((_, i) => i !== index));
  };

  const handleUpdateTerm = (
    index: number,
    field: keyof Terminology,
    value: string
  ) => {
    const updated = [...editTerms];
    updated[index] = { ...updated[index], [field]: value };
    setEditTerms(updated);
  };

  const handleSave = async () => {
    const filtered = editTerms.filter((term) => term.term.trim() !== "");
    setIsSaving(true);
    try {
      await onSave(filtered);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditTerms([...terms]);
    setNewTerm({ term: "", meaning: "" });
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTerm.term.trim()) {
      e.preventDefault();
      handleAddTerm();
    }
  };

  const hasChanges = JSON.stringify(editTerms) !== JSON.stringify(terms);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Terms List */}
      <div className="space-y-2">
        {editTerms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No domain terms yet
          </p>
        ) : (
          editTerms.map((termItem, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 rounded-lg border bg-accent/20"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={termItem.term}
                    onChange={(e) =>
                      handleUpdateTerm(index, "term", e.target.value)
                    }
                    className="font-medium"
                    disabled={isSaving}
                    placeholder="Term..."
                    maxLength={INPUT_LIMITS.MAX_NAME_LENGTH}
                  />
                </div>
                <Textarea
                  value={termItem.meaning}
                  onChange={(e) =>
                    handleUpdateTerm(index, "meaning", e.target.value)
                  }
                  className="text-sm resize-none h-16"
                  disabled={isSaving}
                  placeholder="Definition or meaning..."
                  maxLength={INPUT_LIMITS.MAX_DESCRIPTION_LENGTH}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemoveTerm(index)}
                disabled={isSaving}
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                title="Remove term"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add New Term */}
      <div className="space-y-2 p-3 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={newTerm.term}
            onChange={(e) => setNewTerm({ ...newTerm, term: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Term..."
            disabled={isSaving}
            maxLength={INPUT_LIMITS.MAX_NAME_LENGTH}
          />
        </div>
        <Textarea
          value={newTerm.meaning}
          onChange={(e) => setNewTerm({ ...newTerm, meaning: e.target.value })}
          className="text-sm resize-none h-16"
          disabled={isSaving}
          placeholder="Definition or meaning..."
          maxLength={INPUT_LIMITS.MAX_DESCRIPTION_LENGTH}
        />
        <Button
          size="sm"
          onClick={handleAddTerm}
          disabled={!newTerm.term.trim() || isSaving}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Term
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
