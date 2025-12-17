import type React from "react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { uploadBook } from "@/services/book-service";
import { FILE_ACCEPT_FORMATS, SUPPORTED_FILE_EXTS } from "@/services/constants";
import { useLibraryStore } from "@/store/library-store";
import { getFilename, listFormater } from "@/utils/book";
import { eventDispatcher } from "@/utils/event";

const EXTRA_ACCEPT_SUFFIXES = [".epub.zip"] as const;

export function useBookUpload() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { refreshBooks } = useLibraryStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleDropedFiles(files);
  }, []);

  const handleDropedFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const supportedFiles = files.filter((file) => {
      const name = (file.name || "").trim();
      const lowerName = name.toLowerCase();
      const lastPart = lowerName.split(".").pop()?.trim();
      const byExtList = lastPart ? SUPPORTED_FILE_EXTS.includes(lastPart) : false;
      const bySuffix = SUPPORTED_FILE_EXTS.some((ext) => lowerName.endsWith(`.${ext}`));
      const byExtraSuffix = EXTRA_ACCEPT_SUFFIXES.some((suffix) => lowerName.endsWith(suffix));
      const ok = byExtList || bySuffix || byExtraSuffix;
      console.log("[Import] picked file:", { name, ext: lastPart, ok });
      return ok;
    });

    if (supportedFiles.length === 0) {
      const message = `未找到支持的文件。支持的格式：${FILE_ACCEPT_FORMATS}（也支持 .epub.zip）`;
      eventDispatcher.dispatch("toast", { message, type: "error" });
      const picked = files.map((f) => (f.name || "").trim()).filter(Boolean).slice(0, 3);
      toast.error(message, {
        description: picked.length ? `已选择：${picked.join(", ")}` : undefined,
      });
      return;
    }

    await importBooks(supportedFiles);
  }, []);

  const importBooks = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      const failedFiles: { name: string; reason: string }[] = [];
      const successBooks = [];

      for (const file of files) {
        try {
          const newBook = await uploadBook(file);
          successBooks.push(newBook);
        } catch (error) {
          const baseFilename = getFilename(file.name);
          const reason = error instanceof Error ? error.message : String(error);
          failedFiles.push({ name: baseFilename, reason });
          console.error(`[Import] Failed to import "${file.name}":`, error);
        }
      }

      setIsUploading(false);

      if (failedFiles.length > 0) {
        const detail = failedFiles
          .slice(0, 5)
          .map((f) => `${f.name}: ${f.reason}`)
          .join("\n");

        eventDispatcher.dispatch("toast", {
          message: `导入书籍失败：${listFormater(false).format(failedFiles.map((f) => f.name))}`,
          type: "error",
        });
        toast.error("导入失败", {
          description: failedFiles.length > 5 ? `${detail}\n…（还有 ${failedFiles.length - 5} 个失败项）` : detail,
          duration: 8000,
        });
      }

      if (successBooks.length > 0) {
        toast.success(`成功导入 ${successBooks.length} 本书籍`);
        await refreshBooks();
      }
    },
    [refreshBooks],
  );

  const selectFiles = useCallback((): Promise<FileList | null> => {
    return new Promise((resolve) => {
      console.log("[Import] trigger file select");
      const existing = fileInputRef.current;
      if (existing) {
        existing.remove();
        fileInputRef.current = null;
      }

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      // Allow picking `.epub.zip` from some sources (e.g. z-lib); it will be recognized as EPUB later.
      fileInput.accept = `${FILE_ACCEPT_FORMATS}, .zip`;
      fileInput.multiple = true;
      fileInput.style.position = "fixed";
      fileInput.style.left = "-9999px";
      fileInput.style.top = "-9999px";
      document.body.appendChild(fileInput);
      fileInputRef.current = fileInput;
      fileInput.click();

      fileInput.onchange = () => {
        const files = fileInput.files;
        console.log("[Import] file input changed:", files?.length ?? 0);
        fileInput.remove();
        fileInputRef.current = null;

        if (!files || files.length === 0) {
          toast.info("未选择文件");
          resolve(null);
          return;
        }

        resolve(files);
      };
    });
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      handleDropedFiles(files);
    },
    [handleDropedFiles],
  );

  const triggerFileSelect = useCallback(async () => {
    const files = await selectFiles();
    if (!files || files.length === 0) {
      toast.info("未选择文件");
      return;
    }
    handleDropedFiles(Array.from(files));
  }, [selectFiles, handleDropedFiles]);

  return {
    isDragOver,
    isUploading,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    handleDropedFiles,
    triggerFileSelect,
  };
}
