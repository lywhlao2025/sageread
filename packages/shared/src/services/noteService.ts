import type { CreateNoteData, Note, NoteQueryOptions, UpdateNoteData } from "../types/note";
import type { HttpClient } from "./http";

export function createNoteService(client: HttpClient) {
  return {
    createNote: (data: CreateNoteData) => client.post<Note>("/notes", data),
    updateNote: (data: UpdateNoteData) => client.put<Note>(`/notes/${data.id}`, data),
    deleteNote: (id: string) => client.del<void>(`/notes/${id}`),
    getNoteById: (id: string) => client.get<Note | null>(`/notes/${id}`),
    getNotes: (options: NoteQueryOptions = {}) => {
      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      });
      const query = params.toString();
      return client.get<Note[]>(`/notes${query ? `?${query}` : ""}`);
    },
  };
}
