import { ChatConversation } from "@/types";
import { Button, Card, Markdown } from "@/components";
import {
  BotIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HeadphonesIcon,
} from "lucide-react";
import { useState } from "react";
import { QuickActions } from "./QuickActions";

type Props = {
  lastTranscription: string;
  lastAIResponse: string;
  isAIProcessing: boolean;
  conversation: ChatConversation;
  startNewConversation: () => void;
  quickActions: string[];
  addQuickAction: (action: string) => void;
  removeQuickAction: (action: string) => void;
  isManagingQuickActions: boolean;
  setIsManagingQuickActions: (isManaging: boolean) => void;
  showQuickActions: boolean;
  setShowQuickActions: (show: boolean) => void;
  handleQuickActionClick: (action: string) => void;
};

export const OperationSection = ({
  lastTranscription,
  lastAIResponse,
  isAIProcessing,
  conversation,
  startNewConversation,
  quickActions,
  addQuickAction,
  removeQuickAction,
  isManagingQuickActions,
  setIsManagingQuickActions,
  showQuickActions,
  setShowQuickActions,
  handleQuickActionClick,
}: Props) => {
  const [openConversation, setOpenConversation] = useState(true);
  return (
    <div className="space-y-4">
      {/* AI Response */}
      {(lastAIResponse || isAIProcessing) && (
        <>
          <QuickActions
            actions={quickActions}
            onActionClick={handleQuickActionClick}
            onAddAction={addQuickAction}
            onRemoveAction={removeQuickAction}
            isManaging={isManagingQuickActions}
            setIsManaging={setIsManagingQuickActions}
            show={showQuickActions}
            setShow={setShowQuickActions}
          />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BotIcon className="w-3 h-3" />
              <h3 className="font-semibold text-xs">{`AI Assistant - answering to "${lastTranscription}"`}</h3>
            </div>
            <Card className="p-3 bg-transparent">
              {isAIProcessing && !lastAIResponse ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" />
                  <p className="text-xs italic">Generating response...</p>
                </div>
              ) : (
                <p className="text-md leading-relaxed whitespace-pre-wrap">
                  {lastAIResponse ? (
                    <Markdown>{lastAIResponse}</Markdown>
                  ) : null}
                  {isAIProcessing && (
                    <span className="inline-block w-2 h-4 animate-pulse ml-1" />
                  )}
                </p>
              )}
            </Card>
          </div>
        </>
      )}

      {conversation.messages.length > 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="font-semibold text-md w-full cursor-pointer"
              onClick={() => setOpenConversation(!openConversation)}
            >
              Conversations
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setOpenConversation(!openConversation)}
              >
                {openConversation ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronUpIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  startNewConversation();
                  setOpenConversation(false);
                }}
              >
                Start New
              </Button>
            </div>
          </div>

          {openConversation ? (
            <>
              {conversation.messages.length > 2 &&
                conversation?.messages
                  ?.slice(2)
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((message) => (
                    <div className="space-y-3 flex flex-row gap-2">
                      <div className="flex items-start gap-2">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                          {message.role === "user" ? (
                            <HeadphonesIcon className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <BotIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <Card className="p-3 bg-transparent">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          <Markdown>{message.content}</Markdown>
                        </p>
                      </Card>
                    </div>
                  ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};
