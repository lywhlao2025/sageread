import type { CreateNoteData, Note, NoteQueryOptions, UpdateNoteData } from "../types/note";
import type { Thread, ThreadMessage, ThreadSummary } from "../types/thread";

export interface NoteService {
  createNote: (data: CreateNoteData) => Promise<Note>;
  updateNote: (data: UpdateNoteData) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  getNoteById: (id: string) => Promise<Note | null>;
  getNotes: (options?: NoteQueryOptions) => Promise<Note[]>;
}

export interface ThreadService {
  createThread: (bookId: string | undefined, title: string, messages: ThreadMessage[]) => Promise<Thread>;
  editThread: (threadId: string, options: { title?: string; metadata?: Record<string, any>; messages?: ThreadMessage[] }) => Promise<Thread>;
  getThreadById: (threadId: string) => Promise<Thread>;
  getThreadsByBookId: (bookId: string | null) => Promise<ThreadSummary[]>;
  getAllThreads: () => Promise<ThreadSummary[]>;
  deleteThread: (threadId: string) => Promise<void>;
}
