import { useDownloadImage } from "@/hooks/use-download-image";
import { repairStoredEpubForIndexing, updateBookVectorizationMeta } from "@/services/book-service";
import { type EpubIndexResult, indexEpub } from "@/services/book-service";
import { useLayoutStore } from "@/store/layout-store";
import { useNotificationStore } from "@/store/notification-store";
import type { BookWithStatusAndUrls } from "@/types/simple-book";
import { getCurrentVectorModelConfig } from "@/utils/model";
import { listen } from "@tauri-apps/api/event";
import { Menu, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/window";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import EditInfo from "./edit-info";
import EmbeddingDialog from "./embedding-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface BookUpdateData {
  title?: string;
  author?: string;
  coverPath?: string;
  tags?: string[];
}

interface BookItemProps {
  book: BookWithStatusAndUrls;
  viewMode?: "grid" | "list";
  onDelete?: (book: BookWithStatusAndUrls) => Promise<boolean>;
  onUpdate?: (bookId: string, updates: BookUpdateData) => Promise<boolean>;
  onRefresh?: () => Promise<void>;
}

export default function BookItem({ book, onDelete, onUpdate, onRefresh }: BookItemProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { downloadImage } = useDownloadImage();
  const [showEmbeddingDialog, setShowEmbeddingDialog] = useState(false);
  const [vectorizeProgress, setVectorizeProgress] = useState<number | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      const off = await listen<{
        book_id: string;
        current: number;
        total: number;
        percent: number;
        chapter_title: string;
        chunk_index: number;
      }>("epub://index-progress", (e) => {
        const p = e.payload;
        if (p && p.book_id === book.id) {
          setVectorizeProgress(Math.max(0, Math.min(100, Math.round(p.percent))));
        }
      });
      unlisten = off;
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [book.id]);

  const { openBook } = useLayoutStore();

  const handleClick = useCallback(() => {
    openBook(book.id, book.title);
  }, [book.id, book.title, openBook]);

  const handleNativeDelete = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!onDelete) {
      setShowDeleteDialog(false);
      return;
    }
    try {
      await onDelete(book);
    } finally {
      setShowDeleteDialog(false);
    }
  }, [onDelete, book]);

  const handleDownloadImage = useCallback(async () => {
    if (!book.coverUrl) {
      console.warn("No cover image available for download");
      return;
    }

    await downloadImage(book.coverUrl, {
      title: book.title,
      defaultFileName: `${book.title}_cover`,
    });
  }, [book.coverUrl, book.title, downloadImage]);

  // Extracted vectorization action
  const handleVectorizeBook = useCallback(async () => {
    const { addNotification } = useNotificationStore.getState();

    const vectorConfig = await getCurrentVectorModelConfig();
    const version = 1;

    try {
      toast.info("开始向量化...");
      setVectorizeProgress(0);
      // Best-effort: repair malformed EPUB structure (e.g., everything wrapped under a top-level folder)
      // so the Rust indexer can read META-INF/container.xml at ZIP root.
      await repairStoredEpubForIndexing(book.id);
      await updateBookVectorizationMeta(book.id, {
        status: "processing",
        model: vectorConfig.model,
        dimension: vectorConfig.dimension,
        version,
        startedAt: Date.now(),
      });

      const res: EpubIndexResult = await indexEpub(book.id, {
        dimension: vectorConfig.dimension,
        embeddingsUrl: vectorConfig.embeddingsUrl,
        model: vectorConfig.model,
        apiKey: vectorConfig.apiKey,
      });

      if (res?.success && res.report) {
        await updateBookVectorizationMeta(book.id, {
          status: "success",
          chunkCount: res.report.total_chunks,
          dimension: res.report.vector_dimension,
          finishedAt: Date.now(),
        });
      } else {
        await updateBookVectorizationMeta(book.id, {
          status: "failed",
          finishedAt: Date.now(),
        });
        throw new Error(res?.message || "向量化失败");
      }
      const message = `《${book.title}》向量化完成，分块数：${res.report?.total_chunks ?? "未知"}`;
      toast.success(message);
      addNotification(message);
      setVectorizeProgress(null);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error("向量化失败", err);
      await updateBookVectorizationMeta(book.id, {
        status: "failed",
        finishedAt: Date.now(),
      });
      setVectorizeProgress(null);
      const errorMessage = `《${book.title}》向量化失败`;
      toast.error("向量化失败，请检查嵌入服务是否可用");
      addNotification(errorMessage);
      if (onRefresh) await onRefresh();
    }
  }, [book.id, book.title, onRefresh]);

  const renderProgress = () => {
    if (!book.status) {
      return null;
    }

    const { status, progressCurrent = 0, progressTotal = 0 } = book.status;

    if (status === "unread") {
      return (
        <div className="inline-block rounded-full bg-neutral-100 px-1.5 py-0.5 text-neutral-600 text-xs dark:bg-neutral-800 dark:text-neutral-300">
          New
        </div>
      );
    }

    if (status === "completed") {
      return (
        <div className="inline-block rounded-full bg-green-100 px-2 py-1 font-medium text-green-600 text-xs dark:bg-green-900 dark:text-green-300">
          Complete
        </div>
      );
    }

    const progress = progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;
    return (
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-neutral-500 text-xs dark:text-neutral-400">{progress}%</span>
      </div>
    );
  };

  const renderVectorizationStatus = () => {
    const statusFromMeta = book.status?.metadata?.vectorization?.status ?? "idle";
    const effectiveStatus =
      vectorizeProgress != null && vectorizeProgress >= 0 && vectorizeProgress < 100 ? "processing" : statusFromMeta;

    if (effectiveStatus === "processing") {
      const pct = Math.max(0, Math.min(100, vectorizeProgress ?? 0));
      return (
        <div className="flex items-center gap-1" title={`向量化: processing ${pct}%`}>
          <div className="relative h-4 w-4" aria-label={`processing ${pct}%`}>
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: `conic-gradient(#eab308 ${pct}%, rgba(229,231,235,0.6) 0)` }}
            />
            <div className="absolute inset-[2px] rounded-full bg-white dark:bg-neutral-900" />
          </div>
          <span className="text-[10px] text-neutral-500 leading-none dark:text-neutral-400">{pct}%</span>
        </div>
      );
    }

    const colorClass =
      effectiveStatus === "success"
        ? "border-green-500"
        : effectiveStatus === "failed"
          ? "border-red-500"
          : "border-neutral-400 dark:border-neutral-500";
    return (
      <div className="flex items-center gap-1" title={`向量化: ${effectiveStatus}`}>
        <div className={`h-3.5 w-3.5 rounded-full border-2 ${colorClass}`} />
      </div>
    );
  };

  const handleMenuClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const separator1 = await PredefinedMenuItem.new({ text: "separator-1", item: "Separator" });
        const separator2 = await PredefinedMenuItem.new({ text: "separator-2", item: "Separator" });
        const separator3 = await PredefinedMenuItem.new({ text: "separator-3", item: "Separator" });

        const isUnread = !book.status || book.status.status === "unread";
        const markStatusItem = {
          id: isUnread ? "mark-read" : "mark-unread",
          text: isUnread ? "标记为已读" : "标记为未读",
          action: () => {
            if (isUnread) {
              console.log("Mark as Read clicked");
            } else {
              console.log("Mark as Unread clicked");
            }
          },
        };

        const menu = await Menu.new({
          items: [
            {
              id: "open",
              text: "打开",
              action: () => {
                handleClick();
              },
            },
            separator1,
            {
              id: "edit",
              text: "编辑信息",
              action: () => {
                setShowEditDialog(true);
              },
            },
            ...(book.coverUrl
              ? [
                  {
                    id: "download-image",
                    text: "下载图片",
                    action: () => {
                      handleDownloadImage();
                    },
                  },
                ]
              : []),
            separator2,
            markStatusItem,
            separator3,
            {
              id: "delete",
              text: "删除",
              action: () => {
                handleNativeDelete();
              },
            },
          ],
        });

        await menu.popup(new LogicalPosition(e.clientX, e.clientY));
      } catch (error) {
        console.error("Failed to show native menu:", error);
      }
    },
    [
      handleClick,
      handleNativeDelete,
      handleDownloadImage,
      handleVectorizeBook,
      book.coverUrl,
      book.status,
    ],
  );

  return (
    <>
      <div className="group cursor-pointer" onClick={handleClick}>
        <div
          onContextMenu={handleMenuClick}
          className="rounded-r-2xl rounded-l-md border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800"
        >
          <div className="relative p-2 pb-0">
            <div className="mb-2">
              <h4 className="truncate text-neutral-600 text-sm leading-tight dark:text-neutral-200">{book.title}</h4>
            </div>

            <div className="aspect-[4/5] w-full overflow-hidden">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800">
                  <div className="p-4 text-center">
                    <div className="mb-2 font-bold text-2xl text-neutral-500 dark:text-neutral-400">📖</div>
                    <div className="line-clamp-3 text-neutral-600 text-xs dark:text-neutral-300">{book.title}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex h-8 items-center justify-between space-x-2 p-2 py-0">
            <div className="flex-1">{renderProgress()}</div>
            <div className="flex items-center gap-2">
              {renderVectorizationStatus()}
              <MoreHorizontal onClick={handleMenuClick} className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            </div>
          </div>
        </div>
      </div>

      <EditInfo book={book} isOpen={showEditDialog} onClose={() => setShowEditDialog(false)} onSave={onUpdate} />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">确认删除</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{book.title}</span>
              <span className="text-muted-foreground"> 将被移除，此操作无法撤销。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={handleConfirmDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EmbeddingDialog isOpen={showEmbeddingDialog} onClose={() => setShowEmbeddingDialog(false)} bookId={book.id} />
    </>
  );
}
