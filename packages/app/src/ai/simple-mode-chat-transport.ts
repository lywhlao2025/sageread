import { buildReadingPrompt } from "@/constants/prompt";
import { useI18nStore } from "@/store/i18n-store";
import { useAuthStore } from "@/store/auth-store";
import type { ChatContext } from "@/hooks/use-chat-state";
import type { UIMessage } from "@ai-sdk/react";
import type { ChatRequestOptions, ChatTransport, UIMessageChunk } from "ai";
import { processQuoteMessages, selectValidMessages } from "./utils";
import {
  streamSimpleModeLlm,
  type SimpleModeMessagePayload,
  SimpleModeApiError,
  type SimpleModeLlmStreamEvent,
} from "@/services/simple-mode-service";
import { t as translate } from "@/i18n";

function extractTextFromMessage(message: UIMessage): string {
  const parts = Array.isArray((message as any).parts) ? (message as any).parts : [];
  return parts
    .filter((part: any) => part?.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("")
    .trim();
}

function getUserQuestionText(message: UIMessage | undefined): string {
  if (!message || message.role !== "user") return "";
  const parts = Array.isArray((message as any).parts) ? (message as any).parts : [];
  return parts
    .filter((part: any) => part?.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("")
    .trim();
}

function isTranslatePrompt(message: UIMessage | undefined): boolean {
  const text = getUserQuestionText(message);
  if (!text) return false;
  return (
    text.includes("请将引用内容翻译成") ||
    text.includes("逐句翻译") ||
    text.includes("请翻译这段内容") ||
    (text.includes("翻译") && text.includes("译文"))
  );
}

function toSimpleMessages(messages: UIMessage[]): SimpleModeMessagePayload[] {
  return messages
    .map((message) => ({
      role: message.role,
      content: extractTextFromMessage(message),
    }))
    .filter((message) => message.content);
}

function createResponseStream(
  stream: AsyncGenerator<SimpleModeLlmStreamEvent>,
  onDone: (event: SimpleModeLlmStreamEvent) => void,
): ReadableStream<UIMessageChunk> {
  const id =
    (typeof globalThis !== "undefined" &&
      (globalThis as any).crypto &&
      typeof (globalThis as any).crypto.randomUUID === "function" &&
      (globalThis as any).crypto.randomUUID()) ||
    `simple-${Date.now()}`;

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      controller.enqueue({ type: "text-start", id });
      (async () => {
        try {
          for await (const event of stream) {
            if (event.type === "delta" && event.content) {
              controller.enqueue({ type: "text-delta", id, delta: event.content });
            } else if (event.type === "done") {
              onDone(event);
              controller.enqueue({ type: "text-end", id });
              controller.close();
              return;
            }
          }
          controller.enqueue({ type: "text-end", id });
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      })();
    },
  });
}

export class SimpleModeChatTransport implements ChatTransport<UIMessage> {
  readonly kind = "simple-mode";
  private readonly fixedTaskType?: "chat" | "translate";

  constructor(fixedTaskType?: "chat" | "translate") {
    this.fixedTaskType = fixedTaskType;
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
    const authState = useAuthStore.getState();
    const locale = useI18nStore.getState().getResolvedLocale();
    if (!authState.token) {
      throw new Error(translate(locale, "auth.required", "请先注册后使用"));
    }

    const metadataContext = (options.metadata as any)?.chatContext as ChatContext | undefined;
    const bodyContext = (options.body as any)?.chatContext as ChatContext | undefined;
    const chatContext = metadataContext || bodyContext;
    const lastUserMessage = Array.isArray(options.messages)
      ? [...options.messages].reverse().find((message) => message.role === "user")
      : undefined;
    const messageTaskType = (lastUserMessage as any)?.metadata?.taskType;
    const rawTaskType =
      messageTaskType ??
      (options.metadata as any)?.taskType ??
      (options.body as any)?.taskType ??
      (options.data as any)?.taskType;
    const taskType =
      this.fixedTaskType ||
      (rawTaskType === "translate" || isTranslatePrompt(lastUserMessage) ? "translate" : "chat");
    const processedMessages = processQuoteMessages(options.messages || []);
    const selectedMessages = selectValidMessages(processedMessages, 8);
    const systemPrompt =
      this.fixedTaskType === "translate" ? "" : taskType === "chat" ? await buildReadingPrompt(chatContext, locale) : "";

    const payloadMessages: SimpleModeMessagePayload[] = [];
    if (systemPrompt) {
      payloadMessages.push({ role: "system", content: systemPrompt });
    }
    const filteredMessages =
      taskType === "translate" || this.fixedTaskType === "translate"
        ? selectedMessages.filter((message) => message.role !== "system")
        : selectedMessages;
    payloadMessages.push(...toSimpleMessages(filteredMessages));

    const requestId =
      (typeof globalThis !== "undefined" &&
        (globalThis as any).crypto &&
        typeof (globalThis as any).crypto.randomUUID === "function" &&
        (globalThis as any).crypto.randomUUID()) ||
      `simple-${Date.now()}`;

    try {
      const stream = streamSimpleModeLlm({
        taskType,
        messages: payloadMessages,
        requestId,
        abortSignal: options.abortSignal,
      });

      return createResponseStream(stream, (event) => {
        const quotaState = useAuthStore.getState();
        const existingTotal = quotaState.quota?.totalCount;
        const remaining = event.remainingCount ?? 0;
        const usageCount = event.usageCount ?? 0;
        if (existingTotal != null) {
          quotaState.setQuota({
            totalCount: existingTotal,
            usedCount: Math.max(0, existingTotal - remaining),
            remainingCount: remaining,
          });
        } else {
          quotaState.setQuota({
            totalCount: remaining + usageCount,
            usedCount: usageCount,
            remainingCount: remaining,
          });
        }
      });
    } catch (error) {
      if (error instanceof SimpleModeApiError) {
        if (error.code === "INSUFFICIENT_QUOTA") {
          throw new Error(translate(locale, "quota.exhausted", "额度已用完，暂不可用"));
        }
        if (error.code === "RATE_LIMITED") {
          throw new Error(translate(locale, "quota.rateLimited", "请求过于频繁，请稍后再试"));
        }
        if (error.code === "UNAUTHORIZED" || error.code === "SESSION_EXPIRED") {
          throw new Error(translate(locale, "auth.required", "请先注册后使用"));
        }
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async reconnectToStream(
    _options: {
      chatId: string;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    return null;
  }
}
