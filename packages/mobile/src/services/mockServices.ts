import { mockNotes, mockMessages } from "../data/mock";
import type { CreateNoteData, Note, Thread, ThreadMessage, UpdateNoteData } from "sageread-shared";

let notes = [...mockNotes] as Note[];
let threads: Thread[] = [
  {
    id: "thread-1",
    book_id: null,
    title: "示例对话",
    metadata: "{}",
    messages: mockMessages,
    created_at: Date.now(),
    updated_at: Date.now(),
  } as Thread,
];

export const mockNoteService = {
  async getNotes() {
    return notes;
  },
  async createNote(data: CreateNoteData) {
    const now = Date.now();
    const note: Note = {
      id: `note-${now}`,
      title: data.title ?? "",
      content: data.content ?? "",
      bookId: data.bookId ?? null,
      bookMeta: data.bookMeta ?? null,
      createdAt: now,
      updatedAt: now,
    } as Note;
    notes = [note, ...notes];
    return note;
  },
  async updateNote(data: UpdateNoteData) {
    const idx = notes.findIndex((n) => n.id === data.id);
    if (idx === -1) throw new Error("Note not found");
    const updated: Note = {
      ...notes[idx],
      title: data.title ?? notes[idx].title ?? "",
      content: data.content ?? notes[idx].content ?? "",
      bookId: data.bookId ?? notes[idx].bookId ?? null,
      bookMeta: data.bookMeta ?? notes[idx].bookMeta ?? null,
      updatedAt: Date.now(),
    } as Note;
    notes[idx] = updated;
    return updated;
  },
};

export const mockThreadService = {
  async getThreadById() {
    return threads[0];
  },
  async createThread(bookId: string | undefined, title: string, messages: ThreadMessage[]) {
    const now = Date.now();
    const newThread: Thread = {
      id: `thread-${now}`,
      book_id: bookId ?? null,
      title,
      metadata: "{}",
      messages,
      created_at: now,
      updated_at: now,
    } as Thread;
    threads = [newThread, ...threads];
    return newThread;
  },
};
