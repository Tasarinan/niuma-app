import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2Icon,
  PlusIcon,
  Settings2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { useState } from "react";
import { UseQuickActionsReturn } from "@/hooks/useQuickActions";

interface QuickActionsProps extends UseQuickActionsReturn {
  onActionClick: (action: string) => void;
  disabled?: boolean;
}

export const QuickActions = ({
  actions,
  onActionClick,
  addAction,
  removeAction,
  resetActions,
  isManaging,
  setIsManaging,
  disabled,
}: QuickActionsProps) => {
  const [newAction, setNewAction] = useState("");

  const handleAdd = () => {
    if (newAction.trim()) {
      addAction(newAction.trim());
      setNewAction("");
    }
  };

  return (
    <div className="min-w-[280px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground">
          Quick Actions
        </h4>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setIsManaging(!isManaging)}
          >
            <Settings2Icon className="w-3 h-3 mr-1" />
            {isManaging ? "Done" : "Manage"}
          </Button>
          {isManaging && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={resetActions}
              title="Reset to defaults"
            >
              <RotateCcwIcon className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {actions.map((action) => (
          <div key={action} className="relative group">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => {
                if (!isManaging && !disabled) {
                  onActionClick(action);
                }
              }}
              disabled={disabled && !isManaging}
            >
              {action}
              {isManaging && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAction(action);
                  }}
                  className="ml-1.5 cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <Trash2Icon className="w-3 h-3" />
                </button>
              )}
            </Button>
          </div>
        ))}

        {/* Add new action input - only in manage mode */}
        {isManaging && (
          <div className="flex gap-1.5 items-center">
            <Input
              type="text"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              placeholder="Add action..."
              className="h-7 text-xs w-28"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              size="sm"
              className="h-7 text-xs px-2"
              onClick={handleAdd}
              disabled={!newAction.trim()}
            >
              <PlusIcon className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
