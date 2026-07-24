/**
 * Quick integration example: Add PI slash commands to the chat input.
 *
 * This is a minimal working example showing how to add slash command support
 * to an existing chat input component.
 *
 * To use:
 * 1. Copy this file to your project
 * 2. Import and use in your Chat component
 * 3. Adjust import paths as needed
 */

import React, { useState, useRef } from "react";
import { usePiSlashCommands } from "@/lib/pi-commands";
import type { CommandHandler } from "@/lib/pi-commands";
import type { Skill, AgentDefinition } from "@/types";

interface QuickChatInputProps {
  onSubmit: (message: string) => Promise<void>;
  skills: Skill[];
  agent?: AgentDefinition;
  isLoading?: boolean;
}

/**
 * Chat input with PI slash command support.
 *
 * Features:
 * - Type '/' to see command suggestions
 * - Select a command to execute
 * - Fall back to normal message input
 */
export const QuickChatInputWithCommands: React.FC<QuickChatInputProps> = ({
  onSubmit,
  skills,
  isLoading,
}) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<CommandHandler[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize PI slash commands
  const commands = usePiSlashCommands(skills, [], {
    switchModel: async (modelId) => {
      console.log("Switch model to:", modelId);
      // Implement your model switching logic
    },
    openSettings: () => {
      console.log("Open settings");
      // Navigate to settings or open settings modal
    },
    showSession: () => {
      console.log("Show session info");
      // Display session information
    },
    reload: () => {
      console.log("Reload resources");
      // Reload skills, templates, etc.
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Show command suggestions when user types '/'
    const slashMatch = value.match(/\/([a-zA-Z0-9:_-]*)$/);
    if (slashMatch) {
      const prefix = slashMatch[1];
      const matching = commands.getSuggestions(prefix);
      setSuggestions(matching);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectCommand = async (cmd: ReturnType<typeof commands.registry.list>[number]) => {
    try {
      // Replace the "/..." part with the selected command
      const beforeSlash = input.substring(0, input.lastIndexOf("/"));
      const newInput = beforeSlash + "/" + cmd.name;
      setInput(newInput);

      // Parse and execute
      const parsed = commands.parse("/" + cmd.name);
      if (parsed) {
        await commands.execute(parsed);
      }

      setSuggestions([]);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error executing command:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Try to parse as a command first
    const cmd = commands.parse(input);
    if (cmd) {
      // It's a slash command
      try {
        await commands.execute(cmd);
        setInput("");
        setSuggestions([]);
      } catch (error) {
        console.error("Command execution failed:", error);
      }
    } else {
      // Normal message
      await onSubmit(input);
      setInput("");
      setSuggestions([]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message or / for commands..."
          className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          disabled={isLoading}
          onKeyDown={(e) => {
            // Send on Shift+Enter, newline on Enter
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            } else if (e.key === "Tab" && suggestions.length > 0) {
              e.preventDefault();
              // Auto-complete first suggestion
              handleSelectCommand(suggestions[0]);
            }
          }}
        />

        {/* Command suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
            {suggestions.map((cmd) => (
              <button
                key={`${cmd.category}:${cmd.name}`}
                type="button"
                onClick={() => handleSelectCommand(cmd)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors border-b last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">/{cmd.name}</div>
                    <div className="text-xs text-gray-600">{cmd.description}</div>
                  </div>
                  <span className="text-xs text-gray-500 ml-2 px-2 py-1 bg-gray-100 rounded">
                    {cmd.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!input.trim() || isLoading}
        className="self-end px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Sending..." : "Send"}
      </button>

      {/* Help text */}
      <div className="text-xs text-gray-500">
        💡 Tip: Type / to see available commands. Shift+Enter to send.
      </div>
    </form>
  );
};

// ─── Example Usage ────────────────────────────────────────────────────────────

/**
 * Example of integrating into an existing chat page:
 *
 * import { QuickChatInputWithCommands } from "@/lib/pi-commands/quick-example";
 *
 * export function ChatPage() {
 *   const skills = useSkillStore(s => s.items);
 *   const [messages, setMessages] = useState([]);
 *   const [loading, setLoading] = useState(false);
 *
 *   const handleSubmit = async (message: string) => {
 *     setLoading(true);
 *     try {
 *       // Send to agent
 *       const response = await agentRuntime.run(message);
 *       setMessages(prev => [...prev, { role: 'user', content: message }, ...response]);
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <MessageList messages={messages} />
 *       <QuickChatInputWithCommands
 *         onSubmit={handleSubmit}
 *         skills={skills}
 *         isLoading={loading}
 *       />
 *     </div>
 *   );
 * }
 */
