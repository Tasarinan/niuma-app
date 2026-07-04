import {
  Switch,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
  SelectGroup,
  Button,
  Header,
} from "@/components";
import {
  PROMPT_TEMPLATES,
  getPromptTemplateById,
} from "@/lib/platform-instructions";
import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, WandIcon } from "lucide-react";

interface ContextProps {
  useSystemPrompt: boolean;
  setUseSystemPrompt: (value: boolean) => void;
  contextContent: string;
  setContextContent: (content: string) => void;
}

export const Context = ({
  useSystemPrompt,
  setUseSystemPrompt,
  contextContent,
  setContextContent,
}: ContextProps) => {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const handleTemplateSelection = (templateId: string) => {
    const template = getPromptTemplateById(templateId);
    if (template) {
      setContextContent(template.prompt);
      setSelectedTemplate(""); // Reset selection after prefill
    }
  };
  const getTitle = () => {
    return useSystemPrompt ? "System Prompt" : "Custom System Prompt + Context";
  };

  const getDescription = () => {
    return useSystemPrompt
      ? "Using the default system prompt from settings"
      : "Create a custom system prompt with specific context. Define how the AI should behave AND provide the knowledge it needs (meeting notes, translation rules, resume details, etc.).";
  };

  return (
    <div className="space-y-3">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div>
          <h3 className="font-semibold text-xs">{getTitle()}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getDescription()}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(!open)}
          className="h-8 w-8 p-0"
        >
          {open ? (
            <ArrowUpIcon className="w-4 h-4" />
          ) : (
            <ArrowDownIcon className="w-4 h-4" />
          )}
        </Button>
      </div>

      {open ? (
        <>
          <div className="flex items-center justify-between gap-4 border-t border-input/50 pt-4">
            <Header
              title={
                useSystemPrompt
                  ? "System Prompt"
                  : "Custom System Prompt + Context"
              }
              description={`Toggle to use the ${
                !useSystemPrompt
                  ? "default system prompt"
                  : "custom system prompt"
              } from settings`}
            />
            <Switch
              checked={useSystemPrompt}
              onCheckedChange={setUseSystemPrompt}
            />
          </div>

          {/* Show textarea when using custom context */}
          {!useSystemPrompt && (
            <div className="space-y-2">
              {/* Template Selector - Auto-prefills on selection */}
              <div className="space-y-1 w-full flex justify-end">
                <Select
                  value={selectedTemplate}
                  onValueChange={handleTemplateSelection}
                >
                  <SelectTrigger className="max-w-54">
                    <WandIcon className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="auto-prefill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="py-2">
                        Select a template above to instantly populate the
                        textarea with a ready-to-use prompt
                      </SelectLabel>
                      {PROMPT_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                placeholder="Write a complete system prompt with context. Include both instructions and knowledge:

Example:
You are a meeting assistant. Be concise and professional. Use the following meeting notes to answer questions:

[Meeting Notes]
- Project deadline: Dec 15th
- Budget approved: $50k
- Team: John (dev), Sarah (design), Mike (PM)
- Next review: Friday 2PM

Answer questions about this meeting content and help with follow-up tasks."
                value={contextContent}
                onChange={(e) => setContextContent(e.target.value)}
                className="min-h-54 resize-none border-1 border-input/50 focus:border-primary/50 transition-colors"
              />
              <p className="text-xs text-muted-foreground/70">
                💡 Tip: This replaces the system prompt entirely. Include both
                AI instructions (how to behave) and specific context/knowledge
                it should use.
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
