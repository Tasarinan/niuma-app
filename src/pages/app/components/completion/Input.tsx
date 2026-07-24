import { Loader2 } from "lucide-react";
import { Input as InputComponent } from "@/components";
import { UseCompletionReturn } from "@/types";

interface InputProps extends UseCompletionReturn {
  isHidden: boolean;
}

export const Input = ({
  isLoading,
  input,
  setInput,
  handleKeyPress,
  handleInputKeyDown,
  handlePaste,
  inputRef,
  isHidden,
  slashCommandSuggestions,
  isSlashMenuOpen,
  activeSlashCommandIndex,
  selectSlashCommand,
}: InputProps) => {
  return (
    <div className="relative flex-1">
      <div className="relative select-none">
        <InputComponent
          ref={inputRef}
          placeholder="Ask me anything... (type / for commands)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          disabled={isLoading || isHidden}
          className="pr-10"
        />

        {isSlashMenuOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
            <div className="max-h-64 overflow-y-auto p-1">
              {slashCommandSuggestions.map((command, index) => {
                const isActive = index === activeSlashCommandIndex;
                const sourceLabel = command.sourceLabel || "extension";
                const sourceClass =
                  sourceLabel === "builtin"
                    ? "bg-blue-500/10 text-blue-600"
                    : sourceLabel === "file"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-amber-500/10 text-amber-600";
                return (
                  <button
                    key={command.name}
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent text-foreground"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSlashCommand(command.name);
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate">/{command.name}</div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sourceClass}`}
                      >
                        {sourceLabel}
                      </span>
                    </div>
                    {command.argumentHint ? (
                      <div className="mt-0.5 text-[11px] text-muted-foreground font-mono truncate">
                        {command.argumentHint}
                      </div>
                    ) : null}
                    {command.description ? (
                      <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {command.description}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};
