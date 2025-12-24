import { useChat } from "@/ai/hooks/use-chat";
import { useModelSelector } from "@/hooks/use-model-selector";
import type { UIMessage } from "ai";
import { useCallback, useMemo } from "react";

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
}

function getLatestAssistantText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    const parts = Array.isArray(message.parts) ? message.parts : [];
    return parts
      .filter((part: any) => part?.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("");
  }
  return "";
}

export function useSelectionTranslate(bookId?: string) {
  const { currentModelInstance } = useModelSelector("deepseek", "deepseek-chat");
  const { messages, status, error, sendMessage, setMessages, stop } = useChat(currentModelInstance || "deepseek-chat", {
    messages: [],
    chatContext: {
      activeBookId: bookId,
    },
  });

  const translate = useCallback(
    (selectedText: string, question: string) => {
      if (!selectedText || !question) return;
      stop();
      setMessages([]);
      sendMessage({
        parts: [
          { type: "quote", text: selectedText, source: "引用" },
          { type: "text", text: question },
        ],
      });
    },
    [sendMessage, setMessages, stop],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
  }, [setMessages, stop]);

  const content = useMemo(() => stripThinkBlocks(getLatestAssistantText(messages)), [messages]);

  return {
    content,
    status,
    error,
    translate,
    reset,
  };
}
