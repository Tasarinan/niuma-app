import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";

interface InlineTextEditorProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const InlineTextEditor = ({
  value,
  onSave,
  onCancel,
  placeholder = "Enter text...",
  multiline = false,
  autoFocus = true,
  className = "",
}: InlineTextEditorProps) => {
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      onCancel?.();
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue.trim());
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter" && multiline && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <InputComponent
        ref={inputRef as any}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSaving}
        className={multiline ? "min-h-[100px] resize-none" : ""}
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving || !editValue.trim()}
          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
          title="Save (Enter or Ctrl+Enter)"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Cancel (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
