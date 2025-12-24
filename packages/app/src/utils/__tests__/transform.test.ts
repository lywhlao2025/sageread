import { describe, expect, it } from "vitest";

import type { Book, BookConfig, BookNote } from "@/types/book";
import type { DBBook, DBBookConfig, DBBookNote } from "@/types/records";
import {
  transformBookConfigFromDB,
  transformBookConfigToDB,
  transformBookFromDB,
  transformBookNoteFromDB,
  transformBookNoteToDB,
  transformBookToDB,
} from "../transform";

describe("transform utilities", () => {
  it("transforms book config to and from DB", () => {
    const updatedAt = 1_700_000_000_000;
    const config = {
      bookHash: "hash",
      progress: [1, 10],
      location: "cfi",
      searchConfig: { matchCase: true },
      viewSettings: { zoomLevel: 1 },
      updatedAt,
    } as BookConfig;

    const dbConfig = transformBookConfigToDB(config, "user-1");
    expect(dbConfig).toEqual({
      user_id: "user-1",
      book_hash: "hash",
      location: "cfi",
      progress: JSON.stringify([1, 10]),
      search_config: JSON.stringify({ matchCase: true }),
      view_settings: JSON.stringify({ zoomLevel: 1 }),
      updated_at: new Date(updatedAt).toISOString(),
    });

    const roundTrip = transformBookConfigFromDB(dbConfig as DBBookConfig);
    expect(roundTrip.bookHash).toBe("hash");
    expect(roundTrip.progress).toEqual([1, 10]);
    expect(roundTrip.searchConfig).toEqual({ matchCase: true });
    expect(roundTrip.viewSettings).toEqual({ zoomLevel: 1 });
    expect(roundTrip.updatedAt).toBe(updatedAt);
  });

  it("transforms book to and from DB", () => {
    const timestamp = 1_700_000_000_100;
    const book = {
      id: "id-1",
      hash: "hash",
      format: "EPUB",
      title: "Title",
      sourceTitle: "Source",
      author: "Author",
      groupId: "group",
      groupName: "Group",
      tags: ["tag"],
      progress: [1, 2],
      metadata: { key: "value" },
      createdAt: timestamp,
      updatedAt: timestamp + 1,
      deletedAt: timestamp + 2,
      uploadedAt: timestamp + 3,
    } as unknown as Book;

    const dbBook = transformBookToDB(book, "user-1");
    expect(dbBook).toEqual({
      user_id: "user-1",
      book_hash: "hash",
      format: "EPUB",
      title: "Title",
      author: "Author",
      group_id: "group",
      group_name: "Group",
      tags: ["tag"],
      progress: [1, 2],
      source_title: "Source",
      metadata: JSON.stringify({ key: "value" }),
      created_at: new Date(timestamp).toISOString(),
      updated_at: new Date(timestamp + 1).toISOString(),
      deleted_at: new Date(timestamp + 2).toISOString(),
      uploaded_at: new Date(timestamp + 3).toISOString(),
    });

    const roundTrip = transformBookFromDB(dbBook as DBBook);
    expect(roundTrip.hash).toBe("hash");
    expect(roundTrip.format).toBe("EPUB");
    expect(roundTrip.metadata).toEqual({ key: "value" });
    expect(roundTrip.createdAt).toBe(timestamp);
    expect(roundTrip.deletedAt).toBe(timestamp + 2);
  });

  it("transforms book notes to and from DB", () => {
    const timestamp = 1_700_000_000_200;
    const note = {
      bookHash: "hash",
      id: "note-1",
      type: "annotation",
      cfi: "epubcfi(/6/2)",
      text: "text",
      style: "highlight",
      color: "yellow",
      note: "note",
      createdAt: timestamp,
      updatedAt: timestamp + 1,
      deletedAt: null,
    } as BookNote;

    const dbNote = transformBookNoteToDB(note, "user-1");
    expect(dbNote).toEqual({
      user_id: "user-1",
      book_hash: "hash",
      id: "note-1",
      type: "annotation",
      cfi: "epubcfi(/6/2)",
      text: "text",
      style: "highlight",
      color: "yellow",
      note: "note",
      created_at: new Date(timestamp).toISOString(),
      updated_at: new Date(timestamp + 1).toISOString(),
      deleted_at: null,
    });

    const roundTrip = transformBookNoteFromDB(dbNote as DBBookNote);
    expect(roundTrip.id).toBe("note-1");
    expect(roundTrip.type).toBe("annotation");
    expect(roundTrip.color).toBe("yellow");
    expect(roundTrip.deletedAt).toBeNull();
  });
});
