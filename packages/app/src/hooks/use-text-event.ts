import type { ExplainTextEventDetail } from "@/services/iframe-service";
import { useCallback, useEffect } from "react";

interface UseTextEventHandlerOptions {
  sendMessage: any;
  onTextReceived?: (text: string) => void;
  activeBookId?: string;
  isSimpleMode?: boolean;
  chatContext?: { activeBookId?: string; activeContext?: string; activeSectionLabel?: string };
}

export const useTextEventHandler = (options: UseTextEventHandlerOptions) => {
  const { sendMessage, onTextReceived, activeBookId, isSimpleMode, chatContext } = options;

  const handleTextEvent = useCallback(
    (event: CustomEvent<ExplainTextEventDetail>) => {
      const { selectedText, question, bookId } = event.detail;

      if (bookId && bookId !== activeBookId) {
        return;
      }

      if (selectedText && question) {
        onTextReceived?.(selectedText);

        const parts = [
          {
            type: "quote",
            text: selectedText,
            source: "引用",
          },
          {
            type: "text",
            text: question,
          },
        ];

        sendMessage({
          parts,
          ...(isSimpleMode
            ? {
                metadata: { taskType: "chat", chatContext },
                body: { taskType: "chat", chatContext },
              }
            : {}),
        });
      }
    },
    [sendMessage, onTextReceived, activeBookId, isSimpleMode, chatContext],
  );

  useEffect(() => {
    window.addEventListener("explainText", handleTextEvent as EventListener);

    return () => {
      window.removeEventListener("explainText", handleTextEvent as EventListener);
    };
  }, [handleTextEvent]);
};
