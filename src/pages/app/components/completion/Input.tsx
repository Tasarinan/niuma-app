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
  handlePaste,
  inputRef,
  isHidden,
}: InputProps) => {
  return (
    <div className="relative flex-1">
      <div className="relative select-none">
        <InputComponent
          ref={inputRef}
          placeholder="Ask me anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          disabled={isLoading || isHidden}
          className="pr-10"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
};
