import { MessageSquareText, ChevronUp, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  ScrollArea,
  Markdown,
} from "@/components";
import { ChatMessage } from "@/types/completion";
import { QuickActions } from "./QuickActions";
import { UseQuickActionsReturn } from "@/hooks/useQuickActions";
import { useApp } from "@/contexts";

interface MessageHistoryProps {
  conversationHistory: ChatMessage[];
  currentConversationId: string | null;
  onStartNewConversation: () => void;
  messageHistoryOpen: boolean;
  setMessageHistoryOpen: (open: boolean) => void;
  // Quick actions props
  quickActions?: UseQuickActionsReturn;
  onQuickActionClick?: (action: string) => void;
  enableVAD?: boolean;
  isLoading?: boolean;
}

export const MessageHistory = ({
  conversationHistory,
  onStartNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
  quickActions,
  onQuickActionClick,
  isLoading,
}: MessageHistoryProps) => {
  const { sttTranslationEnabled } = useApp();
  // Show quick actions at bottom of conversation panel
  const showQuickActions = quickActions && onQuickActionClick;
  return (
    <Popover open={messageHistoryOpen} onOpenChange={setMessageHistoryOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label="View Current Conversation"
          className="relative cursor-pointer w-12 h-7 px-2 flex gap-1 items-center justify-center"
        >
          <div className="flex items-center justify-center text-xs font-medium">
            {conversationHistory.length}
          </div>
          <MessageSquareText className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 mt-3 border overflow-hidden border-input/50"
      >
        <div className="border-b border-input/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-col">
              <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Current Conversation
              </h2>
              <p className="text-xs text-muted-foreground">
                {conversationHistory.length} messages in this conversation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onStartNewConversation();
                  setMessageHistoryOpen(false);
                }}
                className="text-xs"
              >
                New Chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMessageHistoryOpen(false)}
                className="text-xs"
              >
                {messageHistoryOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-10rem)]">
          <div className="p-4 space-y-4">
            {conversationHistory
              .sort((a, b) => b?.timestamp - a?.timestamp)
              .map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary/10 border-l-4 border-primary"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {message.role === "user"
                        ? (message.speaker?.speakerLabel || "You")
                        : "AI"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <Markdown>{message.content}</Markdown>
                  {/* Translation display for user messages */}
                  {sttTranslationEnabled && message.role === "user" && message.translation && (
                    <div className="mt-2 pt-2 border-t border-primary/20">
                      <p className="text-foreground/80 italic" dir="auto">
                        {message.translation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </ScrollArea>

        {/* Quick Actions - Show at bottom when in Manual mode */}
        {showQuickActions && (
          <div className="border-t border-input/50 p-3 bg-muted/30">
            <QuickActions
              {...quickActions}
              onActionClick={(action) => {
                onQuickActionClick(action);
                setMessageHistoryOpen(false);
              }}
              disabled={isLoading}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
