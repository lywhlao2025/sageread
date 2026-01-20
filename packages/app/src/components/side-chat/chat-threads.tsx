import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/use-i18n";
import { useThreads } from "@/hooks/use-threads";
import type { ThreadSummary } from "@/types/thread";
import { Menu } from "@tauri-apps/api/menu";
import { LogicalPosition } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import dayjs from "dayjs";
import { ArrowLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface ChatThreadsProps {
  bookId: string | undefined;
  onBack: () => void;
  onSelectThread: (threadSummary: ThreadSummary) => void;
}

export function ChatThreads({ bookId, onBack, onSelectThread }: ChatThreadsProps) {
  const t = useT();
  const { threads, error, status, handleDeleteThread: deleteThreadFn } = useThreads({ bookId });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groupedThreads = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; threads: ThreadSummary[]; latestUpdated: number }>();
    for (const thread of threads) {
      const displayTitle = (thread.title || t("chat.untitled", "未命名对话")).trim();
      const key = displayTitle.toLowerCase() || t("chat.untitled", "未命名对话");
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          key,
          title: displayTitle || t("chat.untitled", "未命名对话"),
          threads: [thread],
          latestUpdated: thread.updated_at,
        });
      } else {
        existing.threads.push(thread);
        if (thread.updated_at > existing.latestUpdated) {
          existing.latestUpdated = thread.updated_at;
        }
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        threads: group.threads.sort((a, b) => b.updated_at - a.updated_at),
      }))
      .sort((a, b) => b.latestUpdated - a.latestUpdated);
  }, [threads, t]);

  const handleNativeDelete = useCallback(
    async (thread: ThreadSummary) => {
      try {
        const confirmed = await ask(
          t("chat.deleteConfirm.body", undefined, { title: thread.title || t("chat.untitled", "未命名对话") }),
          {
            title: t("chat.deleteConfirm.title", "确认删除"),
          kind: "warning",
          },
        );

        if (confirmed) {
          await deleteThreadFn(thread.id);
        }
      } catch (error) {
        console.error("delete thread failed:", error);
      }
    },
    [deleteThreadFn, t],
  );

  const handleMenuClick = useCallback(
    (thread: ThreadSummary) => async (menuEvent: React.MouseEvent) => {
      menuEvent.preventDefault();
      menuEvent.stopPropagation();

      try {
        const menu = await Menu.new({
          items: [
            {
              id: "delete",
              text: t("chat.delete", "删除"),
              action: () => {
                handleNativeDelete(thread);
              },
            },
          ],
        });

        await menu.popup(new LogicalPosition(menuEvent.clientX, menuEvent.clientY));
      } catch (error) {
        console.error("show menu failed:", error);
      }
    },
    [handleNativeDelete, t],
  );

  if (status === "pending") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-8 items-center gap-2 border-neutral-300 pl-0.5 dark:border-neutral-700">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">{t("chat.threads.title", "历史对话")}</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-neutral-600 dark:text-neutral-400">{t("chat.loading", "加载中...")}</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-8 items-center gap-2 border-neutral-300 pl-0.5 dark:border-neutral-700">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-medium text-neutral-900 dark:text-neutral-100">{t("chat.threads.title", "历史对话")}</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-neutral-600 dark:text-neutral-400">
              {error?.message || t("chat.loadFail", "加载历史对话失败")}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="border-neutral-200 dark:border-neutral-700"
            >
              {t("chat.retry", "重试")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 border-neutral-300 dark:border-neutral-700">
        <div className="flex h-10 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-medium text-neutral-900 text-sm dark:text-neutral-100">{t("chat.threads.title", "历史对话")}</h2>
          <span className="text-neutral-500 text-xs dark:text-neutral-500">({threads.length})</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-8">
        {threads.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 w-fit rounded-full bg-neutral-100 p-3 dark:bg-neutral-800">
                <MessageCircle size={24} className="text-neutral-500 dark:text-neutral-500" />
              </div>
              <p className="text-neutral-600 text-sm dark:text-neutral-400">
                {bookId ? t("chat.noThreads.book", "还没有历史对话") : t("chat.noThreads.global", "暂无聊天记录")}
              </p>
              <p className="mt-1 text-neutral-500 text-xs dark:text-neutral-500">
                {bookId
                  ? t("chat.noThreads.hint.book", "开始聊天来创建你的第一个对话")
                  : t("chat.noThreads.hint.global", "开始对话来创建聊天记录")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedThreads.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              return (
                <div key={group.key} className="overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.key)) {
                          next.delete(group.key);
                        } else {
                          next.add(group.key);
                        }
                        return next;
                      });
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-1 font-medium text-neutral-900 text-sm dark:text-neutral-100">
                        {group.title}
                      </div>
                      <div className="text-neutral-500 text-xs dark:text-neutral-500">
                        {t("chat.messageCount", "{count} 条消息", { count: group.threads[0]?.message_count ?? 0 })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500 text-xs dark:text-neutral-500">
                      <span>{group.threads.length}</span>
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-neutral-200 border-t dark:border-neutral-700">
                      {group.threads.map((thread) => (
                        <button
                          key={thread.id}
                          onClick={() => onSelectThread(thread)}
                          onContextMenu={handleMenuClick(thread)}
                          className="w-full cursor-pointer border-neutral-200 border-b px-3 py-2 text-left last:border-b-0 dark:border-neutral-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-neutral-600 text-xs dark:text-neutral-400">
                              {t("chat.messageCount", "{count} 条消息", { count: thread.message_count })}
                            </span>
                            <span className="flex-shrink-0 text-neutral-500 text-xs dark:text-neutral-500">
                              {dayjs(thread.updated_at).format("YYYY-MM-DD HH:mm:ss")}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
