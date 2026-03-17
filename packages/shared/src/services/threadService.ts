import type { Thread, ThreadMessage, ThreadSummary } from "../types/thread";
import type { HttpClient } from "./http";

export function createThreadService(client: HttpClient) {
  return {
    createThread: (bookId: string | undefined, title: string, messages: ThreadMessage[]) =>
      client.post<Thread>("/threads", { book_id: bookId, title, messages }),
    editThread: (threadId: string, options: { title?: string; metadata?: Record<string, any>; messages?: ThreadMessage[] }) =>
      client.put<Thread>(`/threads/${threadId}`, options),
    getThreadById: (threadId: string) => client.get<Thread>(`/threads/${threadId}`),
    getThreadsByBookId: (bookId: string | null) =>
      client.get<ThreadSummary[]>(`/threads?book_id=${bookId ?? ""}`),
    getAllThreads: () => client.get<ThreadSummary[]>("/threads"),
    deleteThread: (threadId: string) => client.del<void>(`/threads/${threadId}`),
  };
}
