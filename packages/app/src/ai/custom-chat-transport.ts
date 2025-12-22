import { buildReadingPrompt } from "@/constants/prompt";
import type { ChatContext } from "@/hooks/use-chat-state";
import { useLlamaStore } from "@/store/llama-store";
import { useProviderStore } from "@/store/provider-store";
import { useI18nStore } from "@/store/i18n-store";
import type { UIMessage } from "@ai-sdk/react";
import {
  type ChatRequestOptions,
  type ChatTransport,
  type LanguageModel,
  type PrepareSendMessagesRequest,
  type UIMessageChunk,
  convertToModelMessages,
  stepCountIs,
  streamText,
} from "ai";
import {
  createRagContextTool,
  createRagSearchTool,
  createRagTocTool,
  getBooksTool,
  getReadingStatsTool,
  getSkillsTool,
  mindmapTool,
  notesTool,
} from "./tools";
import { processQuoteMessages, selectValidMessages } from "./utils";

/**
 * Extracts the user question text from a UIMessage (concatenating all text parts).
 * Used to detect quick actions (e.g. selection translate/explain) so we can avoid sending tools.
 */
function getUserQuestionText(message: UIMessage | undefined): string {
  if (!message || message.role !== "user") return "";
  const parts = Array.isArray((message as any).parts) ? (message as any).parts : [];
  return parts
    .filter((p: any) => p?.type === "text" && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("")
    .trim();
}

/**
 * Returns true when the user message looks like a "selection quick action" (translate/explain),
 * which should never require function-calling tools.
 */
function isSelectionTranslateOrExplain(message: UIMessage | undefined): boolean {
  if (!message || message.role !== "user") return false;
  const q = getUserQuestionText(message);
  if (!q) return false;

  // Selection-based quick actions do not need any tools; sending tools to some local models will error.
  return (
    q.includes("请将引用内容翻译成") ||
    q.includes("逐句翻译") ||
    q === "请解释这段文字" ||
    q === "这段内容有什么含义？" ||
    (q.includes("翻译") && q.includes("译文"))
  );
}

/**
 * Best-effort detection for Ollama-local OpenAI-compatible endpoints.
 * These endpoints frequently reject tool-calling on some models, so we downgrade gracefully.
 */
function isLikelyOllamaBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl) return false;
  try {
    const u = new URL(baseUrl);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      // Common Ollama default port
      u.port === "11434"
    );
  } catch {
    return false;
  }
}

/**
 * For Ollama local endpoints, default to disabling tools to avoid hard failures
 * like "does not support tools" (users can still chat/translate normally).
 */
function shouldDisableToolsForCurrentModel(): boolean {
  const state = useProviderStore.getState();
  const selected = state.selectedModel;
  if (!selected) return false;
  const provider = state.modelProviders.find((p) => p.provider === selected.providerId);
  // Only apply this downgrade for known-problematic models on Ollama's OpenAI-compatible endpoint.
  // Some Ollama models support tools well (e.g. gpt-oss), so we must not disable tools globally.
  if (!isLikelyOllamaBaseUrl(provider?.baseUrl)) return false;
  const modelId = (selected.modelId || "").toLowerCase();
  return modelId.includes("deepseek") || modelId.includes("r1");
}

export class CustomChatTransport implements ChatTransport<UIMessage> {
  private model: LanguageModel;
  private prepareSendMessagesRequest?: PrepareSendMessagesRequest<UIMessage>;

  constructor(
    model: LanguageModel,
    options?: {
      prepareSendMessagesRequest?: PrepareSendMessagesRequest<UIMessage>;
    },
  ) {
    this.model = model;
    this.prepareSendMessagesRequest = options?.prepareSendMessagesRequest;
  }

  updateModel(model: LanguageModel) {
    this.model = model;
  }

  async sendMessages(
    options: {
      chatId: string;
      messages: UIMessage[];
      abortSignal: AbortSignal | undefined;
    } & {
      trigger: "submit-message" | "regenerate-message";
      messageId: string | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    let requestBody = options.body;

    if (this.prepareSendMessagesRequest) {
      const prepared = await this.prepareSendMessagesRequest({
        id: options.chatId,
        messages: options.messages,
        requestMetadata: options.metadata,
        body: options.body as Record<string, any> | undefined,
        credentials: undefined,
        headers: options.headers,
        api: "",
        trigger: options.trigger,
        messageId: options.messageId,
      });

      requestBody = prepared.body;
    }

    const chatContext = (requestBody as any)?.chatContext as ChatContext | undefined;
    const activeBookId = chatContext?.activeBookId;

    const rawLastUserMessage = [...(options.messages || [])].reverse().find((m) => m?.role === "user") as
      | UIMessage
      | undefined;

    const processedMessages = processQuoteMessages(options.messages);
    const selectedMessages = selectValidMessages(processedMessages, 8);
    const lastUserMessage = [...selectedMessages].reverse().find((m) => m?.role === "user");
    const disableToolsForThisRequest =
      isSelectionTranslateOrExplain(rawLastUserMessage) ||
      isSelectionTranslateOrExplain(lastUserMessage) ||
      // For Ollama local endpoints, default to disabling tools to avoid hard failures on models without tools support.
      shouldDisableToolsForCurrentModel();

    const hasVectorCapability = useLlamaStore.getState().hasVectorCapability();

    const activeTools = disableToolsForThisRequest
      ? undefined
      : (() => {
          const tools: any = {
            notes: notesTool,
            getBooks: getBooksTool,
            getReadingStats: getReadingStatsTool,
            getSkills: getSkillsTool,
            mindmap: mindmapTool,
          };

          if (hasVectorCapability && activeBookId) {
            tools.ragSearch = createRagSearchTool(activeBookId);
            tools.ragToc = createRagTocTool(activeBookId);
            tools.ragContext = createRagContextTool(activeBookId);
          }

          return tools;
        })();
    const convertedMessages = convertToModelMessages(selectedMessages, {
      tools: activeTools,
      ignoreIncompleteToolCalls: true,
    });

    const result = streamText({
      model: this.model,
      messages: convertedMessages,
      abortSignal: options.abortSignal,
      ...(activeTools ? { toolChoice: "auto" as const, tools: activeTools } : {}),
      stopWhen: stepCountIs(20),
      system: await buildReadingPrompt(chatContext, useI18nStore.getState().getResolvedLocale()),
    });

    return result.toUIMessageStream({
      onError: (error) => {
        console.log("error", error);
        if (error == null) {
          return "Unknown error";
        }
        if (typeof error === "string") {
          return error;
        }
        if (error instanceof Error) {
          if (/does not support tools/i.test(error.message)) {
            return "当前模型/接口不支持 tools（函数调用）。已自动禁用 tools 以保证可用；如需在聊天中使用工具，请升级 Ollama 并重新拉取支持 tools 的模型，或更换支持 tools 的模型。";
          }
          return error.message;
        }
        return JSON.stringify(error);
      },
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return {
            totalUsage: part.totalUsage,
          };
        }
      },
    });
  }

  async reconnectToStream(
    _options: {
      chatId: string;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
