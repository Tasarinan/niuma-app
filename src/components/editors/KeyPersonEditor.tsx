import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Check, X, User, Briefcase, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS } from "@/config";
import type { KeyPerson } from "@/types";

interface KeyPersonEditorProps {
  people: KeyPerson[];
  onSave: (people: KeyPerson[]) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
}

export const KeyPersonEditor = ({
  people,
  onSave,
  onCancel,
  className = "",
}: KeyPersonEditorProps) => {
  const [editPeople, setEditPeople] = useState<KeyPerson[]>([...people]);
  const [newPerson, setNewPerson] = useState<KeyPerson>({
    name: "",
    role: "",
    relationship: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleAddPerson = () => {
    if (!newPerson.name.trim()) return;

    setEditPeople([
      ...editPeople,
      {
        name: newPerson.name.trim(),
        role: newPerson.role.trim(),
        relationship: newPerson.relationship.trim(),
      },
    ]);
    setNewPerson({ name: "", role: "", relationship: "" });
  };

  const handleRemovePerson = (index: number) => {
    setEditPeople(editPeople.filter((_, i) => i !== index));
  };

  const handleUpdatePerson = (
    index: number,
    field: keyof KeyPerson,
    value: string
  ) => {
    const updated = [...editPeople];
    updated[index] = { ...updated[index], [field]: value };
    setEditPeople(updated);
  };

  const handleSave = async () => {
    const filtered = editPeople.filter((person) => person.name.trim() !== "");
    setIsSaving(true);
    try {
      await onSave(filtered);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditPeople([...people]);
    setNewPerson({ name: "", role: "", relationship: "" });
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newPerson.name.trim()) {
      e.preventDefault();
      handleAddPerson();
    }
  };

  const hasChanges = JSON.stringify(editPeople) !== JSON.stringify(people);

  return (
    <div className={cn("space-y-3", className)}>
      {/* People List */}
      <div className="space-y-2">
        {editPeople.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No key people yet
          </p>
        ) : (
          editPeople.map((person, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 rounded-lg border bg-accent/20"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={person.name}
                    onChange={(e) =>
                      handleUpdatePerson(index, "name", e.target.value)
                    }
                    className="font-medium"
                    disabled={isSaving}
                    placeholder="Person name..."
                    maxLength={INPUT_LIMITS.MAX_NAME_LENGTH}
                  />
                  {person.role && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {person.role}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={person.role}
                    onChange={(e) =>
                      handleUpdatePerson(index, "role", e.target.value)
                    }
                    className="text-sm h-8"
                    disabled={isSaving}
                    placeholder="Role/title..."
                    maxLength={INPUT_LIMITS.MAX_ROLE_LENGTH}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <Input
                    value={person.relationship}
                    onChange={(e) =>
                      handleUpdatePerson(index, "relationship", e.target.value)
                    }
                    className="text-sm h-8"
                    disabled={isSaving}
                    placeholder="Relationship/context..."
                    maxLength={INPUT_LIMITS.MAX_DESCRIPTION_LENGTH}
                  />
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleRemovePerson(index)}
                disabled={isSaving}
                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                title="Remove person"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add New Person */}
      <div className="space-y-2 p-3 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={newPerson.name}
            onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Person name..."
            disabled={isSaving}
            maxLength={INPUT_LIMITS.MAX_NAME_LENGTH}
          />
        </div>
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={newPerson.role}
            onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })}
            className="text-sm h-8"
            disabled={isSaving}
            placeholder="Role/title..."
            maxLength={INPUT_LIMITS.MAX_ROLE_LENGTH}
          />
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={newPerson.relationship}
            onChange={(e) =>
              setNewPerson({ ...newPerson, relationship: e.target.value })
            }
            className="text-sm h-8"
            disabled={isSaving}
            placeholder="Relationship/context..."
            maxLength={INPUT_LIMITS.MAX_DESCRIPTION_LENGTH}
          />
        </div>
        <Button
          size="sm"
          onClick={handleAddPerson}
          disabled={!newPerson.name.trim() || isSaving}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Person
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
