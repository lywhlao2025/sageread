import type { Note, Thread, ThreadMessage } from "sageread-shared";

export type NoteDTO = Note;
export type ThreadDTO = Thread;
export type ThreadMessageDTO = ThreadMessage;

export type NoteModel = {
  id: string;
  bookId: string | null;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

export type ThreadSummaryModel = {
  id: string;
  bookId: string | null;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
};

export type ThreadModel = {
  id: string;
  bookId: string | null;
  title: string;
  messages: ThreadMessageDTO[];
  createdAt: number;
  updatedAt: number;
};

export function toNoteModel(note: NoteDTO): NoteModel {
  return {
    id: note.id,
    bookId: note.bookId ?? null,
    title: note.title ?? "",
    content: note.content ?? "",
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export function toThreadSummaryModel(thread: {
  id: string;
  book_id: string | null;
  title: string;
  message_count: number;
  created_at: number;
  updated_at: number;
}): ThreadSummaryModel {
  return {
    id: thread.id,
    bookId: thread.book_id,
    title: thread.title,
    messageCount: thread.message_count,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  };
}

export function toThreadModel(thread: ThreadDTO): ThreadModel {
  return {
    id: thread.id,
    bookId: thread.book_id,
    title: thread.title,
    messages: thread.messages ?? [],
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
  };
}
