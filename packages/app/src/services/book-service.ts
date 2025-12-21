import { DocumentLoader } from "@/lib/document";
import type {
  BookQueryOptions,
  BookStatus,
  BookStatusUpdateData,
  BookUpdateData,
  BookUploadData,
  BookVectorizationMeta,
  BookWithStatus,
  BookWithStatusAndUrls,
  SimpleBook,
} from "@/types/simple-book";

export interface TocNode {
  id: string;
  play_order: number;
  title: string;
  src: string;
  children: TocNode[];
}
import { formatAuthors, formatTitle, getPrimaryLanguage } from "@/utils/book";
import { partialMD5 } from "@/utils/md5";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { appDataDir, tempDir } from "@tauri-apps/api/path";
import { join } from "@tauri-apps/api/path";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";

async function unwrapEpubZipIfNeeded(
  fileName: string,
  fileData: ArrayBuffer,
): Promise<{ fileName: string; fileData: ArrayBuffer } | null> {
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".epub.zip")) return null;

  try {
    const { configure, ZipReader, BlobReader, BlobWriter } = await import("@zip.js/zip.js");
    configure({ useWebWorkers: false });

    const zipBlob = new Blob([fileData], { type: "application/zip" });
    const reader = new ZipReader(new BlobReader(zipBlob));
    const entries = await reader.getEntries();

    const hasEpubContainer = entries.some((e) => e.filename === "META-INF/container.xml");
    if (hasEpubContainer) {
      await reader.close();
      return null;
    }

    const epubEntries = entries.filter((e) => e.filename.toLowerCase().endsWith(".epub"));
    if (epubEntries.length === 0) {
      await reader.close();
      return null;
    }

    // If multiple EPUBs exist, pick the largest one.
    epubEntries.sort((a, b) => (b.uncompressedSize ?? 0) - (a.uncompressedSize ?? 0));
    const chosen = epubEntries[0]!;
    const innerBlob = (await chosen.getData?.(new BlobWriter())) as Blob | undefined;
    await reader.close();

    if (!innerBlob) return null;
    const innerData = await innerBlob.arrayBuffer();
    const innerName = chosen.filename.split("/").pop() || chosen.filename;
    return { fileName: innerName, fileData: innerData };
  } catch (e) {
    console.warn("无法解包 .epub.zip，尝试按普通 EPUB 处理:", e);
    return null;
  }
}

async function normalizeEpubContainerPrefixIfNeeded(fileName: string, fileData: ArrayBuffer): Promise<ArrayBuffer | null> {
  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".epub")) return null;

  try {
    const { configure, ZipReader, ZipWriter, BlobReader, BlobWriter } = await import("@zip.js/zip.js");
    configure({ useWebWorkers: false });

    const zipBlob = new Blob([fileData], { type: "application/epub+zip" });
    const reader = new ZipReader(new BlobReader(zipBlob));
    const entries = await reader.getEntries();

    const containerAtRoot = entries.some((e: any) => (e?.filename || "").toLowerCase() === "meta-inf/container.xml");
    if (containerAtRoot) {
      await reader.close();
      return null;
    }

    const containerSuffix = "meta-inf/container.xml";
    const containerCandidates = entries.filter((e: any) => {
      const name = (e?.filename || "").toLowerCase();
      return (
        name.endsWith(`/${containerSuffix}`) &&
        !name.startsWith("__macosx/") &&
        !name.includes("/__macosx/") &&
        !name.includes("/.ds_store")
      );
    });

    if (containerCandidates.length === 0) {
      await reader.close();
      return null;
    }

    // Choose the shortest prefix that contains META-INF/container.xml (most likely the real root folder).
    containerCandidates.sort((a: any, b: any) => (a.filename?.length ?? 0) - (b.filename?.length ?? 0));
    const chosen = containerCandidates[0]!;
    const prefixLen = chosen.filename.length - "META-INF/container.xml".length;
    const prefix = chosen.filename.slice(0, Math.max(0, prefixLen));
    const lowerPrefix = prefix.toLowerCase();

    const candidatesToCopy = entries
      .filter((e: any) => {
        const name = (e?.filename || "").toLowerCase();
        return name.startsWith(lowerPrefix) && !name.startsWith("__macosx/");
      })
      .filter((e: any) => !e?.directory);

    if (candidatesToCopy.length === 0) {
      await reader.close();
      return null;
    }

    // Repack: strip the leading folder prefix so container.xml sits at META-INF/container.xml
    const zipWriteOptions = {
      lastAccessDate: new Date(0),
      lastModDate: new Date(0),
      extendedTimestamp: false,
    } as const;
    const writer = new ZipWriter(new BlobWriter("application/epub+zip"), { extendedTimestamp: false });

    const mapped = candidatesToCopy
      .map((e: any) => {
        const original = e.filename as string;
        const stripped = original.slice(prefix.length).replace(/^\/+/, "");
        return { entry: e, name: stripped, lower: stripped.toLowerCase() };
      })
      .filter((x: any) => x.name && !x.lower.startsWith("__macosx/") && x.lower !== ".ds_store");

    // Add mimetype first if present (some readers are strict about ordering).
    mapped.sort((a: any, b: any) => {
      const am = a.lower === "mimetype" ? 0 : 1;
      const bm = b.lower === "mimetype" ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.name.localeCompare(b.name);
    });

    for (const item of mapped) {
      const blob = (await item.entry.getData?.(new BlobWriter())) as Blob | undefined;
      if (!blob) continue;
      // Some readers are strict about `mimetype` being the first entry and uncompressed.
      const options = item.lower === "mimetype" ? ({ ...zipWriteOptions, level: 0 } as any) : (zipWriteOptions as any);
      await writer.add(item.name, new BlobReader(blob), options);
    }

    const outBlob = await writer.close();
    await reader.close();
    return await outBlob.arrayBuffer();
  } catch (e) {
    console.warn("无法规范化 EPUB 结构（将按原文件处理）:", e);
    return null;
  }
}

export async function repairStoredEpubForIndexing(bookId: string): Promise<void> {
  const baseDir = await appDataDir();
  const epubPath = await join(baseDir, "books", bookId, "book.epub");

  try {
    const data = await readFile(epubPath);
    const buf =
      data instanceof ArrayBuffer
        ? data
        : (data as Uint8Array).buffer.slice((data as Uint8Array).byteOffset, (data as Uint8Array).byteOffset + (data as Uint8Array).byteLength);
    const normalized = await normalizeEpubContainerPrefixIfNeeded("book.epub", buf);
    if (!normalized) return;
    await writeFile(epubPath, new Uint8Array(normalized));
  } catch (e) {
    console.warn("修复 EPUB 文件失败（将继续尝试索引原文件）:", e);
  }
}

export async function uploadBook(file: File): Promise<SimpleBook> {
  try {
    const format = getBookFormat(file.name);
    if (!["EPUB", "PDF", "MOBI", "CBZ", "FB2", "FBZ"].includes(format)) {
      throw new Error(`不支持的文件格式: ${format}`);
    }

    const bookHash = await partialMD5(file);
    const tempDirPath = await tempDir();
    const tempFileName = `temp_${bookHash}.${format.toLowerCase()}`;
    const tempFilePath = await join(tempDirPath, tempFileName);

    let fileData = await file.arrayBuffer();
    let finalFileName = file.name;
    let finalFileSize = file.size;

    // Some sources provide "xxx.epub.zip" where the ZIP contains an EPUB file.
    // Unwrap it so foliate-js can read META-INF/container.xml.
    const unwrapped = await unwrapEpubZipIfNeeded(finalFileName, fileData);
    if (unwrapped) {
      finalFileName = unwrapped.fileName;
      fileData = unwrapped.fileData;
      finalFileSize = fileData.byteLength;
    }

    // Some malformed EPUBs are ZIPs that wrap the real EPUB contents under a single top-level folder.
    // Normalize them so META-INF/container.xml is at the ZIP root (required by many EPUB parsers).
    if (format === "EPUB") {
      const normalized = await normalizeEpubContainerPrefixIfNeeded(finalFileName, fileData);
      if (normalized) {
        fileData = normalized;
        finalFileSize = fileData.byteLength;
      }
    }

    await writeFile(tempFilePath, new Uint8Array(fileData));

    const metadataSourceFile = new File([fileData], finalFileName, { type: getFileMimeType(finalFileName) });
    let metadata = await extractMetadataOnly(metadataSourceFile);
    let finalFormat: SimpleBook["format"] = format;
    let finalTempFilePath = tempFilePath;

    let coverTempFilePath: string | undefined;
    if (finalFormat === "EPUB") {
      try {
        const dataForCover =
          finalFormat === "EPUB" && finalTempFilePath !== tempFilePath ? await readFile(finalTempFilePath) : fileData;
        const bookDoc = await parseEpubFile(
          dataForCover instanceof ArrayBuffer ? dataForCover : (dataForCover as Uint8Array).buffer,
          finalFileName,
        );
        const coverBlob = await bookDoc.getCover();
        if (coverBlob) {
          const coverTempFileName = `cover_${bookHash}.jpg`;
          const coverTempPath = await join(tempDirPath, coverTempFileName);
          const coverArrayBuffer = await coverBlob.arrayBuffer();
          await writeFile(coverTempPath, new Uint8Array(coverArrayBuffer));
          coverTempFilePath = coverTempPath;
        }
      } catch (e) {
        console.warn("无法提取封面:", e);
      }
    }

    const uploadData: BookUploadData = {
      id: bookHash,
      title: formatTitle(metadata.title) || getFileNameWithoutExt(file.name),
      author: formatAuthors(metadata.author) || "Unknown",
      format: finalFormat,
      fileSize: finalFileSize,
      language: getPrimaryLanguage(metadata.language) || "en",
      tempFilePath: finalTempFilePath,
      coverTempFilePath,
      metadata: metadata,
    };

    const result = await invoke<SimpleBook>("save_book", { data: uploadData });
    return result;
  } catch (error) {
    console.error("书籍上传失败:", error);
    throw new Error(`上传失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

async function extractMetadataOnly(file: File): Promise<any> {
  try {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".epub") || lowerName.endsWith(".epub.zip")) {
      const arrayBuffer = await file.arrayBuffer();
      const bookDoc = await parseEpubFile(arrayBuffer, file.name);
      return bookDoc.metadata;
    }

    return {
      title: getFileNameWithoutExt(file.name),
      author: "Unknown",
      language: "en",
    };
  } catch (error) {
    console.warn("元数据提取失败，使用默认值:", error);
    return {
      title: getFileNameWithoutExt(file.name),
      author: "Unknown",
      language: "en",
    };
  }
}

export async function getBooks(options: BookQueryOptions = {}): Promise<SimpleBook[]> {
  try {
    const result = await invoke<SimpleBook[]>("get_books", { options });
    return result;
  } catch (error) {
    console.error("获取书籍列表失败:", error);
    throw new Error(`获取书籍列表失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function getBookById(id: string): Promise<SimpleBook | null> {
  try {
    const result = await invoke<SimpleBook | null>("get_book_by_id", { id });
    return result;
  } catch (error) {
    console.error("获取书籍详情失败:", error);
    throw new Error(`获取书籍详情失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function convertBookWithStatusUrls(book: BookWithStatus): Promise<BookWithStatusAndUrls> {
  try {
    const appDataDirPath = await appDataDir();
    const absoluteFilePath = book.filePath.startsWith("/") ? book.filePath : `${appDataDirPath}/${book.filePath}`;

    const absoluteCoverPath = book.coverPath
      ? book.coverPath.startsWith("/")
        ? book.coverPath
        : `${appDataDirPath}/${book.coverPath}`
      : undefined;

    const fileUrl = convertFileSrc(absoluteFilePath);
    const coverUrl = absoluteCoverPath ? convertFileSrc(absoluteCoverPath) : undefined;

    return {
      ...book,
      fileUrl,
      coverUrl,
    };
  } catch (error) {
    console.error("Error converting book URLs for:", book.title, error);
    throw error;
  }
}

export async function getBookWithStatusById(id: string): Promise<BookWithStatusAndUrls | null> {
  try {
    const bookWithStatus = await invoke<BookWithStatus | null>("get_book_with_status_by_id", { id });
    if (!bookWithStatus) return null;

    return await convertBookWithStatusUrls(bookWithStatus);
  } catch (error) {
    console.error("获取书籍详情失败:", error);
    throw new Error(`获取书籍详情失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function updateBook(id: string, updateData: BookUpdateData): Promise<SimpleBook> {
  try {
    const result = await invoke<SimpleBook>("update_book", {
      id,
      updateData: {
        ...updateData,
        updatedAt: Date.now(),
      },
    });
    return result;
  } catch (error) {
    console.error("更新书籍失败:", error);
    throw new Error(`更新书籍失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function deleteBook(id: string): Promise<void> {
  try {
    await invoke("delete_book", { id });
  } catch (error) {
    console.error("删除书籍失败:", error);
    throw new Error(`删除书籍失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function searchBooks(
  query: string,
  options: Omit<BookQueryOptions, "searchQuery"> = {},
): Promise<SimpleBook[]> {
  try {
    const searchOptions: BookQueryOptions = {
      ...options,
      searchQuery: query,
    };
    return await getBooks(searchOptions);
  } catch (error) {
    console.error("搜索书籍失败:", error);
    throw new Error(`搜索失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function getBookStatus(bookId: string): Promise<BookStatus | null> {
  try {
    const result = await invoke<BookStatus | null>("get_book_status", { bookId });
    return result;
  } catch (error) {
    console.error("获取书籍状态失败:", error);
    throw new Error(`获取书籍状态失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function updateBookStatus(bookId: string, updateData: BookStatusUpdateData): Promise<BookStatus> {
  try {
    const result = await invoke<BookStatus>("update_book_status", { bookId, updateData });
    return result;
  } catch (error) {
    console.error("更新书籍状态失败:", error);
    throw new Error(`更新书籍状态失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function getBooksWithStatus(options: BookQueryOptions = {}): Promise<BookWithStatus[]> {
  try {
    const result = await invoke<BookWithStatus[]>("get_books_with_status", { options });
    return result;
  } catch (error) {
    console.error("获取书籍列表失败:", error);
    throw new Error(`获取书籍列表失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

// 默认的获取书籍函数，包含状态信息
export const getLibraryBooks = getBooksWithStatus;

export async function updateBookProgress(
  bookId: string,
  current: number,
  total: number,
  location?: string,
): Promise<BookStatus> {
  return updateBookStatus(bookId, {
    progressCurrent: current,
    progressTotal: total,
    location: location || "",
    lastReadAt: Date.now(),
  });
}

export interface EpubIndexReport {
  db_path: string;
  book_title: string;
  book_author: string;
  total_chunks: number;
  vector_dimension: number;
}

export interface EpubIndexResult {
  success: boolean;
  message: string;
  report?: EpubIndexReport;
}

export async function indexEpub(
  bookId: string,
  params: { dimension?: number; embeddingsUrl?: string; model?: string; apiKey?: string | null },
): Promise<EpubIndexResult> {
  const { dimension = 1024, embeddingsUrl, model = "local-embed", apiKey = null } = params;

  // Best-effort repair for malformed EPUB structure before indexing (required by Rust EPUB parser).
  await repairStoredEpubForIndexing(bookId);

  const res = await invoke<EpubIndexResult>("plugin:epub|index_epub", {
    bookId,
    dimension,
    embeddingsUrl,
    model,
    apiKey,
  });
  return res;
}

export async function convertBookToMdbook(bookId: string, overwrite = true): Promise<{ outputDir: string }> {
  const res = await invoke<{ success: boolean; message: string; outputDir?: string }>("plugin:epub|convert_to_mdbook", {
    bookId,
    overwrite,
  });
  if (!res?.success || !res.outputDir) {
    throw new Error(res?.message || "转换失败");
  }
  return { outputDir: res.outputDir };
}

// 解析 TOC 目录结构
export async function parseToc(bookId: string): Promise<TocNode[]> {
  console.log("parseToc: bookId=", bookId);
  try {
    const tocNodes = await invoke<TocNode[]>("plugin:epub|parse_toc", {
      bookId,
    });
    return tocNodes;
  } catch (error) {
    console.log("解析 TOC 失败:", error);
    throw new Error(error instanceof Error ? error.message : "解析 TOC 失败");
  }
}

// Merge-update vectorization metadata without clobbering other metadata fields
export async function updateBookVectorizationMeta(
  bookId: string,
  patch: Partial<BookVectorizationMeta>,
): Promise<BookStatus> {
  const current = await getBookStatus(bookId);
  const prevVec = current?.metadata?.vectorization ?? {};
  const nextVec: BookVectorizationMeta = {
    // Defaults if creating from scratch
    status: "idle",
    model: "",
    dimension: 0,
    chunkCount: 0,
    version: 1,
    ...prevVec,
    ...patch,
    updatedAt: Date.now(),
  } as BookVectorizationMeta;

  const newMetadata = {
    ...(current?.metadata ?? {}),
    vectorization: nextVec,
  } as BookStatus["metadata"];

  return updateBookStatus(bookId, { metadata: newMetadata });
}

async function parseEpubFile(fileData: ArrayBuffer, fileName: string) {
  const file = new File([fileData], fileName, {
    type: getFileMimeType(fileName),
  });
  const loader = new DocumentLoader(file);
  const { book } = await loader.open();
  return book;
}

function getBookFormat(fileName: string): SimpleBook["format"] {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".epub.zip")) return "EPUB";
  const ext = lowerName.split(".").pop();
  switch (ext) {
    case "epub":
      return "EPUB";
    case "pdf":
      return "PDF";
    case "mobi":
      return "MOBI";
    case "cbz":
      return "CBZ";
    case "fb2":
      return "FB2";
    case "fbz":
      return "FBZ";
    default:
      return "EPUB";
  }
}

function getFileMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".epub.zip")) return "application/epub+zip";
  const ext = lowerName.split(".").pop();
  switch (ext) {
    case "epub":
      return "application/epub+zip";
    case "pdf":
      return "application/pdf";
    case "mobi":
      return "application/x-mobipocket-ebook";
    case "cbz":
      return "application/vnd.comicbook+zip";
    case "fb2":
      return "application/x-fictionbook+xml";
    case "fbz":
      return "application/x-zip-compressed-fb2";
    default:
      return "application/octet-stream";
  }
}

function getFileNameWithoutExt(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}
