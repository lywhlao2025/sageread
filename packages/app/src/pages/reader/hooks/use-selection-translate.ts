import { useChat } from "@/ai/hooks/use-chat";
import { SimpleModeChatTransport } from "@/ai/simple-mode-chat-transport";
import { useT } from "@/hooks/use-i18n";
import { useModelSelector } from "@/hooks/use-model-selector";
import { trackEvent } from "@/services/analytics-service";
import { trackUserAction } from "@/services/user-action-service";
import { useAuthStore } from "@/store/auth-store";
import { useModeStore } from "@/store/mode-store";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

function getLatestAssistantText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    const textFromParts = parts
      .filter((part: any) => part?.type === "text" && (typeof part.text === "string" || typeof part.content === "string"))
      .map((part: any) => (typeof part.text === "string" ? part.text : part.content))
      .join("");
    if (textFromParts) {
      return textFromParts;
    }
    const rawContent = (message as any).content;
    if (Array.isArray(rawContent)) {
      const contentText = rawContent
        .filter((part: any) => part?.type === "text" && (typeof part.text === "string" || typeof part.content === "string"))
        .map((part: any) => (typeof part.text === "string" ? part.text : part.content))
        .join("");
      if (contentText) {
        return contentText;
      }
    }
    const fallbackText =
      (typeof rawContent === "string" && rawContent) ||
      (typeof (message as any).text === "string" && (message as any).text) ||
      "";
    return fallbackText;
  }
  return "";
}

export function useSelectionTranslate(bookId?: string) {
  const { mode } = useModeStore();
  const { token, quota } = useAuthStore();
  const isSimpleMode = mode === "simple";
  const t = useT();
  const { currentModelInstance } = useModelSelector("deepseek", "deepseek-chat", "translate");
  const simpleModeTransport = useMemo(
    () => (isSimpleMode ? new SimpleModeChatTransport("translate") : null),
    [isSimpleMode],
  );
  const { messages, status, error, sendMessage, setMessages, stop } = useChat(currentModelInstance || "deepseek-chat", {
    messages: [],
    chatContext: {
      activeBookId: bookId,
    },
    transport: simpleModeTransport ?? undefined,
  });
  const selectionRef = useRef("");
  const requestStartRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const trackedRequestRef = useRef<number | null>(null);

  const translate = useCallback(
    (selectedText: string, question: string) => {
      if (!selectedText || !question) return;
      if (isSimpleMode) {
        if (!token) {
          toast.error(t("auth.required", "请先注册后使用"));
          return;
        }
        if (quota && quota.remainingCount <= 0) {
          toast.error(t("quota.exhausted", "额度已用完，暂不可用"));
          return;
        }
      }
      if (isSimpleMode) {
        void trackUserAction("translate", {
          bookId: bookId ?? undefined,
          selectionLength: selectedText.length,
        });
      }
      selectionRef.current = selectedText;
      stop();
      setMessages([]);
      requestIdRef.current += 1;
      requestStartRef.current = Date.now();
      sendMessage({
        parts: [
          { type: "quote", text: selectedText, source: "引用" },
          { type: "text", text: question },
        ],
        metadata: { taskType: "translate", chatContext: { activeBookId: bookId } },
        ...(isSimpleMode
          ? {
              metadata: { taskType: "translate", chatContext: { activeBookId: bookId } },
              body: { taskType: "translate", chatContext: { activeBookId: bookId } },
            }
          : {}),
      });
    },
    [bookId, isSimpleMode, quota, sendMessage, setMessages, stop, t, token],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
  }, [setMessages, stop]);

  const content = useMemo(() => {
    return getLatestAssistantText(messages);
  }, [messages]);

  useEffect(() => {
    const requestId = requestIdRef.current;
    const requestStart = requestStartRef.current;
    if (!requestStart || trackedRequestRef.current === requestId) return;

    if (error) {
      const durationMs = Math.max(0, Date.now() - requestStart);
      trackEvent("task_failed", { task_type: "translate", duration_ms: durationMs, error_type: "unknown" });
      console.error("translate.failed", error);
      trackedRequestRef.current = requestId;
      requestStartRef.current = null;
      return;
    }

    if (status === "ready" && content) {
      const durationMs = Math.max(0, Date.now() - requestStart);
      trackEvent("task_done", { task_type: "translate", duration_ms: durationMs });
      trackedRequestRef.current = requestId;
      requestStartRef.current = null;
    }
  }, [content, error, status]);

  return {
    content,
    status,
    error,
    translate,
    reset,
  };
}
