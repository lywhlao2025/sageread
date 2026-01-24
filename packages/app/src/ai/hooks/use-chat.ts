import type { ChatContext } from "@/hooks/use-chat-state";
import { type UIMessage, type UseChatOptions, useChat as useChatSDK } from "@ai-sdk/react";
import type { ChatInit, ChatTransport, LanguageModel } from "ai";
import { useEffect, useRef } from "react";
import { CustomChatTransport } from "../custom-chat-transport";

type CustomChatOptions = Omit<ChatInit<UIMessage>, "transport"> &
  Pick<UseChatOptions<UIMessage>, "experimental_throttle" | "resume"> & {
    chatContext?: ChatContext;
    transport?: ChatTransport<UIMessage>;
  };

export function useChat(model: LanguageModel, options?: CustomChatOptions) {
  const { chatContext, transport: transportOverride, ...restOptions } = options || {};
  const chatContextRef = useRef(chatContext);
  const transportRef = useRef<ChatTransport<UIMessage> | null>(null);

  useEffect(() => {
    chatContextRef.current = chatContext;
  }, [chatContext]);

  if (transportOverride) {
    transportRef.current = transportOverride;
  } else if (!transportRef.current || (transportRef.current as any).kind === "simple-mode") {
    transportRef.current = new CustomChatTransport(model, {
      prepareSendMessagesRequest: ({ body }) => {
        const currentChatContext = chatContextRef.current;
        return {
          body: {
            ...body,
            chatContext: currentChatContext,
          },
        };
      },
    });
  }

  useEffect(() => {
    if (transportRef.current && "updateModel" in transportRef.current) {
      (transportRef.current as CustomChatTransport).updateModel(model);
    }
  }, [model]);

  const chatResult = useChatSDK({
    transport: transportRef.current,
    ...restOptions,
  });

  return chatResult;
}
