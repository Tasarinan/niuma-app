import { Message } from "@/types";
import {
  SummarizationResult,
  ExtractedEntity,
  CreateMeetingSummaryInput,
  CreateKnowledgeEntityInput,
} from "@/types";
import {
  createMeetingSummary,
  createOrUpdateKnowledgeEntity,
  createEntityMention,
  getMeetingSummaryByConversation,
} from "@/lib/database";
import { fetchAIResponse } from "./ai-response.function";
import { shouldUseNiumaAPI } from "./Niuma.api";
import { getUserIdentity, hasUserIdentity } from "@/lib/storage";

// Minimum number of exchanges (user+assistant pairs) required to trigger summarization
const MIN_EXCHANGES_FOR_SUMMARY = 2;

/**
 * Filters the user's name from a list of participants (case-insensitive).
 */
function filterUserFromParticipants(participants: string[]): string[] {
  if (!hasUserIdentity()) {
    return participants;
  }

  const identity = getUserIdentity();
  if (!identity?.name) {
    return participants;
  }

  const userNameLower = identity.name.toLowerCase();
  return participants.filter((p) => p.toLowerCase() !== userNameLower);
}

/**
 * Gets the user identity instruction for AI prompts.
 */
function getUserIdentityInstruction(): string {
  if (!hasUserIdentity()) {
    return "";
  }

  const identity = getUserIdentity();
  if (!identity?.name) {
    return "";
  }

  return `\n- IMPORTANT: The user's name is "${identity.name}". Do NOT include "${identity.name}" in the participants list - they are the user, not a participant.`;
}

// Summarization prompt template
const SUMMARIZATION_PROMPT = `You are a meeting/conversation summarizer. Analyze the conversation and extract key information.

Respond ONLY with a valid JSON object in this exact format (no markdown, no code blocks, just raw JSON):
{
  "title": "Brief descriptive title for this conversation",
  "summary": "2-3 sentence summary of what was discussed",
  "topics": ["topic1", "topic2"],
  "goals": ["goal1", "goal2"],
  "action_items": ["action1", "action2"],
  "next_steps": ["step1", "step2"],
  "decisions": ["decision1"],
  "team_updates": ["update1", "update2"],
  "participants": ["person1", "person2"],
  "entities": [
    {"type": "person", "name": "John", "description": "Project manager"},
    {"type": "project", "name": "Alpha", "description": "Q1 initiative"},
    {"type": "company", "name": "Acme Corp", "description": "Client company"},
    {"type": "term", "name": "API", "description": "Application Programming Interface"}
  ]
}

Rules:
- "title": Short, descriptive title summarizing the conversation (5-8 words max)
- "summary": Brief overview of the conversation's main points
- "topics": Main subjects discussed (2-5 topics)
- "goals": Objectives or goals mentioned or discussed (can be empty array)
- "action_items": Tasks or follow-ups mentioned (can be empty array)
- "next_steps": Planned next steps or future actions (can be empty array)
- "decisions": Key decisions made (can be empty array)
- "team_updates": Status updates about team members or projects (can be empty array)
- "participants": Names of people mentioned (can be empty array)
- "entities": Important entities to remember. Types: "person", "project", "company", "term"
  - Only include entities that are significant and likely to be referenced again
  - Provide brief, useful descriptions
- Keep arrays empty [] if nothing relevant was mentioned
- Do NOT include the user or assistant in participants unless explicitly named`;

/**
 * Formats conversation messages for summarization
 */
function formatConversationForSummary(messages: Message[]): string {
  // Messages are typically in reverse chronological order, so reverse them
  const chronological = [...messages].reverse();

  return chronological
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      return `${role}: ${msg.content}`;
    })
    .join("\n\n");
}

/**
 * Counts the number of complete exchanges (user message + assistant response)
 */
function countExchanges(messages: Message[]): number {
  const userMessages = messages.filter((m) => m.role === "user").length;
  const assistantMessages = messages.filter((m) => m.role === "assistant").length;
  return Math.min(userMessages, assistantMessages);
}

/**
 * Parses the AI response into a SummarizationResult
 */
function parseSummarizationResponse(response: string): SummarizationResult | null {
  try {
    // Try to extract JSON from the response (handle potential markdown code blocks)
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith("```")) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the response
    const result: SummarizationResult = {
      title: typeof parsed.title === "string" ? parsed.title : null,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      topics: Array.isArray(parsed.topics) ? parsed.topics.filter((t: any) => typeof t === "string") : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals.filter((g: any) => typeof g === "string") : [],
      actionItems: Array.isArray(parsed.action_items) ? parsed.action_items.filter((a: any) => typeof a === "string") : [],
      nextSteps: Array.isArray(parsed.next_steps) ? parsed.next_steps.filter((n: any) => typeof n === "string") : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter((d: any) => typeof d === "string") : [],
      teamUpdates: Array.isArray(parsed.team_updates) ? parsed.team_updates.filter((u: any) => typeof u === "string") : [],
      participants: filterUserFromParticipants(
        Array.isArray(parsed.participants) ? parsed.participants.filter((p: any) => typeof p === "string") : []
      ),
      entities: [],
    };

    // Parse entities with validation
    if (Array.isArray(parsed.entities)) {
      result.entities = parsed.entities
        .filter((e: any) =>
          e &&
          typeof e === "object" &&
          typeof e.name === "string" &&
          ["person", "project", "term", "company"].includes(e.type)
        )
        .map((e: any): ExtractedEntity => ({
          type: e.type,
          name: e.name,
          description: typeof e.description === "string" ? e.description : "",
        }));
    }

    return result;
  } catch (error) {
    console.error("Failed to parse summarization response:", error);
    console.error("Raw response:", response);
    return null;
  }
}

/**
 * Generates a summary for a conversation using AI
 */
export async function generateConversationSummary(
  conversationId: string,
  messages: Message[],
  providerConfig?: {
    provider: any;
    selectedProvider: {
      provider: string;
      variables: Record<string, string>;
    };
  }
): Promise<SummarizationResult | null> {
  const exchangeCount = countExchanges(messages);

  // Check if we have enough exchanges
  if (exchangeCount < MIN_EXCHANGES_FOR_SUMMARY) {
    console.log(`Skipping summarization: only ${exchangeCount} exchanges (need ${MIN_EXCHANGES_FOR_SUMMARY})`);
    return null;
  }

  // Check if we already have a summary for this conversation
  const existingSummary = await getMeetingSummaryByConversation(conversationId);
  if (existingSummary) {
    console.log(`Summary already exists for conversation ${conversationId}`);
    return null;
  }

  const conversationText = formatConversationForSummary(messages);
  const userMessage = `CONVERSATION:\n${conversationText}\n\nProvide the JSON summary:`;

  try {
    let fullResponse = "";

    // Use Niuma API or custom provider
    const useNiumaAPI = await shouldUseNiumaAPI();

    if (!useNiumaAPI && !providerConfig) {
      console.log("No AI provider configured for summarization");
      return null;
    }

    // Collect the full response
    for await (const chunk of fetchAIResponse({
      provider: useNiumaAPI ? undefined : providerConfig?.provider,
      selectedProvider: providerConfig?.selectedProvider || {
        provider: "",
        variables: {},
      },
      systemPrompt: SUMMARIZATION_PROMPT + getUserIdentityInstruction(),
      history: [],
      userMessage,
      imagesBase64: [],
    })) {
      fullResponse += chunk;
    }

    // Parse the response
    const result = parseSummarizationResponse(fullResponse);

    if (!result || !result.summary) {
      console.error("Failed to generate valid summary");
      return null;
    }

    return result;
  } catch (error) {
    console.error("Error generating conversation summary:", error);
    return null;
  }
}

/**
 * Saves a summarization result to the database
 */
export async function saveSummarizationResult(
  conversationId: string,
  result: SummarizationResult,
  exchangeCount: number
): Promise<string | null> {
  try {
    // Create the meeting summary
    const summaryInput: CreateMeetingSummaryInput = {
      conversationId,
      title: result.title || undefined,
      summary: result.summary,
      topics: result.topics,
      goals: result.goals,
      actionItems: result.actionItems,
      nextSteps: result.nextSteps,
      decisions: result.decisions,
      teamUpdates: result.teamUpdates,
      participants: result.participants,
      exchangeCount,
    };

    const summary = await createMeetingSummary(summaryInput);

    // Create/update entities and link them to the summary
    for (const entity of result.entities) {
      const entityInput: CreateKnowledgeEntityInput = {
        entityType: entity.type,
        name: entity.name,
        description: entity.description,
      };

      const savedEntity = await createOrUpdateKnowledgeEntity(entityInput);
      await createEntityMention(savedEntity.id, summary.id);
    }

    console.log(`Saved summary for conversation ${conversationId} with ${result.entities.length} entities`);
    return summary.id;
  } catch (error) {
    console.error("Failed to save summarization result:", error);
    return null;
  }
}

/**
 * Main function to summarize and save a conversation
 * Call this when a conversation ends or switches
 */
export async function summarizeConversation(
  conversationId: string,
  messages: Message[],
  providerConfig?: {
    provider: any;
    selectedProvider: {
      provider: string;
      variables: Record<string, string>;
    };
  }
): Promise<boolean> {
  try {
    // Generate the summary
    const result = await generateConversationSummary(
      conversationId,
      messages,
      providerConfig
    );

    if (!result) {
      return false;
    }

    // Save to database
    const exchangeCount = countExchanges(messages);
    const summaryId = await saveSummarizationResult(conversationId, result, exchangeCount);

    return summaryId !== null;
  } catch (error) {
    console.error("Error in summarizeConversation:", error);
    return false;
  }
}

/**
 * Checks if a conversation should be summarized based on exchange count
 */
export function shouldSummarize(messages: Message[]): boolean {
  return countExchanges(messages) >= MIN_EXCHANGES_FOR_SUMMARY;
}
