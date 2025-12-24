import { beforeEach, describe, expect, it, vi } from "vitest";

import { appDataDir } from "@tauri-apps/api/path";
import {
  extractRelativePathFromAppData,
  getFullPathFromAppData,
  resolveMarkdownImagePaths,
} from "../path";

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn(),
}));

describe("path utilities", () => {
  beforeEach(() => {
    vi.mocked(appDataDir).mockResolvedValue("/app/data");
  });

  it("extracts relative path from app data directory", async () => {
    const result = await extractRelativePathFromAppData("/app/data/books/book.epub");
    expect(result).toBe("books/book.epub");
  });

  it("returns full path when outside app data directory", async () => {
    const result = await extractRelativePathFromAppData("/other/path/book.epub");
    expect(result).toBe("/other/path/book.epub");
  });

  it("resolves markdown and html image paths", async () => {
    const content = [
      "![cover](../Images/cover.jpg)",
      '<img src="../Images/inline.jpg" alt="inline" />',
      "![absolute](/Images/absolute.jpg)",
    ].join("\n");

    const result = await resolveMarkdownImagePaths(content, "/app/data/books/book/EPUB/content.md");

    expect(result).toContain("![cover](books/book/Images/cover.jpg)");
    expect(result).toContain('<img src="books/book/Images/inline.jpg" alt="inline" />');
    expect(result).toContain("![absolute](/Images/absolute.jpg)");
  });

  it("builds full path from app data directory", async () => {
    const result = await getFullPathFromAppData("books/book.epub");
    expect(result).toBe("/app/data/books/book.epub");
  });
});
