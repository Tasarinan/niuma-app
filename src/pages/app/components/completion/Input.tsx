import { Loader2, XIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  ScrollArea,
  Input as InputComponent,
  Markdown,
  Switch,
  CopyButton,
} from "@/components";
import { UseCompletionReturn } from "@/types";
import { MessageHistory } from "./MessageHistory";
import { QuickActions } from "./QuickActions";
import { MeetingTranscriptPanel } from "./MeetingTranscriptPanel";
import { UseQuickActionsReturn } from "@/hooks/useQuickActions";
import { useApp } from "@/contexts";

interface InputProps extends UseCompletionReturn {
  isHidden: boolean;
  quickActions?: UseQuickActionsReturn;
  onQuickActionClick?: (action: string) => void;
}

export const Input = ({
  isPopoverOpen,
  isLoading,
  reset,
  input,
  setInput,
  handleKeyPress,
  handlePaste,
  currentConversationId,
  conversationHistory,
  startNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
  error,
  response,
  cancel,
  scrollAreaRef,
  inputRef,
  isHidden,
  keepEngaged,
  setKeepEngaged,
  enableVAD,
  quickActions,
  onQuickActionClick,
  meetingAssistMode,
  meetingTranscript,
  clearMeetingTranscript,
  assignSpeaker,
}: InputProps) => {
  const { sttTranslationEnabled } = useApp();

  // Get the last user message for display when conversation mode is OFF
  const lastUserMessage = conversationHistory
    .filter(msg => msg.role === "user")
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  // Show meeting transcript panel when:
  // - Meeting mode is ON
  // - Has transcripts
  // - No AI response yet (once response comes, show normal view)
  // - Conversation mode is OFF (when ON, show conversation history instead)
  const showMeetingPanel =
    meetingAssistMode &&
    meetingTranscript.length > 0 &&
    !response &&
    !keepEngaged &&
    !isLoading;

  // Check if we have content that should prevent auto-reset
  const hasContent = response !== "" || (meetingAssistMode && meetingTranscript.length > 0);

  return (
    <div className="relative flex-1">
      <Popover
        open={isPopoverOpen}
        onOpenChange={(open) => {
          // Only reset if popover is closing AND:
          // - Not loading
          // - Not in conversation mode
          // - No response content
          // - No meeting transcript (in meeting mode)
          if (!open && !isLoading && !keepEngaged && !hasContent) {
            reset();
          }
        }}
      >
        <PopoverTrigger asChild className="!border-none !bg-transparent">
          <div className="relative select-none">
            <InputComponent
              ref={inputRef}
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              disabled={isLoading || isHidden}
              className={`${
                currentConversationId && conversationHistory.length > 0
                  ? "pr-14"
                  : "pr-2"
              }`}
            />

            {/* Conversation thread indicator */}
            {currentConversationId &&
              conversationHistory.length > 0 &&
              !isLoading && (
                <div className="absolute select-none right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <MessageHistory
                    conversationHistory={conversationHistory}
                    currentConversationId={currentConversationId}
                    onStartNewConversation={startNewConversation}
                    messageHistoryOpen={messageHistoryOpen}
                    setMessageHistoryOpen={setMessageHistoryOpen}
                    quickActions={quickActions}
                    onQuickActionClick={onQuickActionClick}
                    enableVAD={enableVAD}
                    isLoading={isLoading}
                  />
                </div>
              )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </PopoverTrigger>

        {/* Response Panel */}
        <PopoverContent
          align="end"
          side="bottom"
          className="w-screen p-0 border shadow-lg overflow-hidden flex flex-col h-[calc(100vh-4rem)]"
          sideOffset={8}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex flex-row gap-1 items-center">
              <h3 className="font-semibold text-xs select-none">
                {keepEngaged ? "Conversation Mode" : "AI Response"}
              </h3>
              <div className="text-[10px] text-muted-foreground/70">
                (Use arrow keys to scroll)
              </div>
            </div>
            <div className="flex items-center gap-2 select-none">
              <div className="flex flex-row items-center gap-2 mr-2">
                <p className="text-[10px]">{`Toggle ${
                  keepEngaged ? "AI response" : "conversation mode"
                }`}</p>
                <span className="text-[10px] text-muted-foreground/60 bg-muted/30 px-1 py-0 rounded border border-input/50">
                  {navigator.platform.toLowerCase().includes("mac")
                    ? "⌘"
                    : "Ctrl"}{" "}
                  + K
                </span>
                <Switch
                  checked={keepEngaged}
                  onCheckedChange={(checked) => {
                    setKeepEngaged(checked);
                    // Focus input after toggle
                    setTimeout(() => {
                      inputRef?.current?.focus();
                    }, 100);
                  }}
                />
              </div>
              <CopyButton content={response} />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (isLoading) {
                    cancel();
                  } else if (keepEngaged) {
                    // When keepEngaged is on, close everything and start new conversation
                    setKeepEngaged(false);
                    startNewConversation();
                    // Also clear meeting transcript if in meeting mode
                    if (meetingAssistMode && clearMeetingTranscript) {
                      clearMeetingTranscript();
                    }
                  } else {
                    reset();
                    // Also clear meeting transcript if in meeting mode
                    if (meetingAssistMode && clearMeetingTranscript) {
                      clearMeetingTranscript();
                    }
                  }
                }}
                className="cursor-pointer"
                title={
                  isLoading
                    ? "Cancel loading"
                    : keepEngaged
                    ? "Close and start new conversation"
                    : meetingAssistMode && meetingTranscript.length > 0
                    ? "Clear meeting transcript"
                    : "Clear conversation"
                }
              >
                <XIcon />
              </Button>
            </div>
          </div>

          {/* Show Meeting Transcript Panel when in meeting mode without response */}
          {showMeetingPanel ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <MeetingTranscriptPanel
                meetingTranscript={meetingTranscript}
                clearMeetingTranscript={clearMeetingTranscript}
                assignSpeaker={assignSpeaker}
              />
            </div>
          ) : (
            <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
              <div className="p-4">
                {error && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    <strong>Error:</strong> {error}
                  </div>
                )}
                {isLoading && (
                  <div className="flex items-center gap-2 my-4 text-muted-foreground animate-pulse select-none">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating response...</span>
                  </div>
                )}

                {/* When conversation mode is OFF, show the last user message above the AI response */}
                {!keepEngaged && lastUserMessage && response && (
                  <div className="mb-4 p-3 rounded-lg text-sm bg-primary/10 border-l-4 border-primary">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">You</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(lastUserMessage.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <Markdown>{lastUserMessage.content}</Markdown>
                    {/* Translation display */}
                    {sttTranslationEnabled && lastUserMessage.translation && (
                      <div className="mt-2 pt-2 border-t border-primary/20">
                        <p className="text-foreground/80 italic" dir="auto">
                          {lastUserMessage.translation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {response && <Markdown>{response}</Markdown>}

                {/* Conversation History - Separate scroll, no auto-scroll */}
                {keepEngaged && conversationHistory.length > 0 && (
                  <div className="space-y-3 pt-3">
                    {conversationHistory
                      .sort((a, b) => b?.timestamp - a?.timestamp)
                      .map((message, index) => {
                        // Only skip the first message if it's an assistant response already displayed above
                        // Never skip user messages - they should always be shown
                        if (!isLoading && index === 0 && response && message.role === "assistant") {
                          return null;
                        }
                        return (
                          <div
                            key={message.id}
                            className={`p-3 rounded-lg text-sm ${
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
                                {new Date(message.timestamp).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
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
                        );
                      })}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Quick Actions - Show at bottom of response panel */}
          {quickActions && onQuickActionClick && (
            <div className="border-t border-input/50 p-3 bg-muted/30 shrink-0">
              <QuickActions
                {...quickActions}
                onActionClick={(action) => {
                  onQuickActionClick(action);
                }}
                disabled={isLoading}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
