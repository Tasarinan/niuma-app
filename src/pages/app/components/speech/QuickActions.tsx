import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2Icon,
  PlusIcon,
  EyeIcon,
  EyeOffIcon,
  Settings2Icon,
} from "lucide-react";
import { useState } from "react";

interface QuickActionsProps {
  actions: string[];
  onActionClick: (action: string) => void;
  onAddAction: (action: string) => void;
  onRemoveAction: (action: string) => void;
  isManaging: boolean;
  setIsManaging: (isManaging: boolean) => void;
  show: boolean;
  setShow: (show: boolean) => void;
}

export const QuickActions = ({
  actions,
  onActionClick,
  onAddAction,
  onRemoveAction,
  isManaging,
  setIsManaging,
  show,
  setShow,
}: QuickActionsProps) => {
  const [newAction, setNewAction] = useState("");

  const handleAdd = () => {
    onAddAction(newAction.trim());
    setNewAction("");
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center h-5">
        <h4 className="text-xs font-semibold text-gray-500">
          Quick Actions/Smart Conversation Helpers
        </h4>
        <div className="flex items-center gap-2">
          {show ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => setIsManaging(!isManaging)}
            >
              <Settings2Icon className="w-3.5 h-3.5 mr-1" />
              {isManaging ? "Done" : "Manage"}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => {
              setShow(!show);
              setIsManaging(false);
            }}
          >
            {show ? (
              <EyeOffIcon className="w-3.5 h-3.5" />
            ) : (
              <EyeIcon className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
      {show && (
        <div className="flex flex-wrap gap-2 items-center">
          {actions.map((action) => (
            <div key={action} className="relative group">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 pr-2"
                onClick={() => {
                  if (isManaging) {
                    return;
                  }
                  onActionClick(action);
                }}
              >
                {action}
                {isManaging && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAction(action);
                    }}
                    className="ml-2 cursor-pointer text-gray-400 hover:text-red-500"
                  >
                    <Trash2Icon className="w-3 h-3" />
                  </button>
                )}
              </Button>
            </div>
          ))}
          {isManaging && (
            <div className="flex gap-2">
              <Input
                type="text"
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder="Add new..."
                className="h-7 text-xs w-32"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleAdd}
                disabled={!newAction.trim()}
              >
                <PlusIcon className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
