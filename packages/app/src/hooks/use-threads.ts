import { deleteThread, getAllThreads, getThreadsBybookId } from "@/services/thread-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

interface UseThreadsProps {
  bookId?: string | null;
}

export const useThreads = ({ bookId }: UseThreadsProps = {}) => {
  const queryClient = useQueryClient();

  // 获取 threads 列表
  const {
    data: threads,
    error,
    isLoading,
    status,
  } = useQuery({
    queryKey: ["threads", bookId],
    queryFn: async () => {
      return bookId ? await getThreadsBybookId(bookId) : await getAllThreads();
    },
  });

  // 删除 thread
  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      try {
        await deleteThread(threadId);
        toast.success("对话删除成功");

        // 刷新 threads 列表
        queryClient.invalidateQueries({ queryKey: ["threads", bookId] });
      } catch (error) {
        console.error("删除对话失败:", error);
        toast.error("删除对话失败");
        throw error;
      }
    },
    [queryClient, bookId],
  );

  const dedupedThreads = useMemo(() => {
    if (!threads) return [];
    const byId = new Map<string, (typeof threads)[number]>();
    for (const thread of threads) {
      const existing = byId.get(thread.id);
      if (!existing || thread.updated_at > existing.updated_at) {
        byId.set(thread.id, thread);
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.updated_at - a.updated_at);
  }, [threads]);

  return {
    // 查询相关
    threads: dedupedThreads,
    error,
    isLoading,
    status,

    // 操作相关
    handleDeleteThread,
  };
};
