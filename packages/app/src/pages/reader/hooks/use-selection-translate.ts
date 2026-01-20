import { useChat } from "@/ai/hooks/use-chat";
import { useModelSelector } from "@/hooks/use-model-selector";
import { trackEvent } from "@/services/analytics-service";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";

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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripSelectionEcho(text: string, original: string): string {
  if (!original) return text;
  const normalizedOriginal = normalizeText(original);
  if (!normalizedOriginal) return text;

  const lines = text.split("\n");
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith(">")) return false;

    const normalizedLine = normalizeText(trimmed);
    if (normalizedLine.length >= 12 && normalizedOriginal.includes(normalizedLine)) {
      return false;
    }
    return true;
  });

  let result = filteredLines.join("\n");
  if (normalizedOriginal.length >= 12) {
    result = result.replace(original, "");
  }

  const normalizedBlocks = new Set<string>();
  const blocks = result.split(/\n{2,}/).filter((block) => block.trim());
  const dedupedBlocks: string[] = [];
  for (const block of blocks) {
    const normalizedBlock = normalizeText(block);
    if (!normalizedBlock) continue;
    if (normalizedBlocks.has(normalizedBlock)) continue;
    normalizedBlocks.add(normalizedBlock);
    dedupedBlocks.push(block.trim());
  }

  return dedupedBlocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function useSelectionTranslate(bookId?: string) {
  const { currentModelInstance } = useModelSelector("deepseek", "deepseek-chat", "translate");
  const { messages, status, error, sendMessage, setMessages, stop } = useChat(currentModelInstance || "deepseek-chat", {
    messages: [],
    chatContext: {
      activeBookId: bookId,
    },
  });
  const selectionRef = useRef("");
  const requestStartRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const trackedRequestRef = useRef<number | null>(null);

  const translate = useCallback(
    (selectedText: string, question: string) => {
      if (!selectedText || !question) return;
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
      });
    },
    [sendMessage, setMessages, stop],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
  }, [setMessages, stop]);

  const content = useMemo(() => {
    const raw = stripThinkBlocks(getLatestAssistantText(messages));
    const filtered = stripSelectionEcho(raw, selectionRef.current);
    return filtered || raw;
  }, [messages]);

  useEffect(() => {
    const requestId = requestIdRef.current;
    const requestStart = requestStartRef.current;
    if (!requestStart || trackedRequestRef.current === requestId) return;

    if (error) {
      const durationMs = Math.max(0, Date.now() - requestStart);
      trackEvent("task_failed", { task_type: "translate", duration_ms: durationMs, error_type: "unknown" });
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
