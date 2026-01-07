import { deleteBookNote, getBookNotes } from "@/services/book-note-service";
import { deletePublicHighlight, getPublicHighlightsDeviceId } from "@/services/public-highlights-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

interface UseAnnotationsProps {
  bookId?: string;
}

export const useAnnotations = ({ bookId }: UseAnnotationsProps = {}) => {
  const queryClient = useQueryClient();

  // 获取当前书籍的所有标注
  const {
    data: annotations,
    error,
    isLoading,
    status,
  } = useQuery({
    queryKey: ["annotations", bookId],
    queryFn: async () => {
      if (!bookId) return [];
      const bookNotes = await getBookNotes(bookId);
      // 过滤出类型为 annotation 且未删除的笔记，并按创建时间倒序排列
      return bookNotes
        .filter((note) => note.type === "annotation" && !note.deletedAt)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },
    enabled: !!bookId,
  });

  // 删除标注
  const handleDeleteAnnotation = useCallback(
    async (annotationId: string) => {
      try {
        const annotation = (annotations ?? []).find((note) => note.id === annotationId);
        await deleteBookNote(annotationId);
        toast.success("标注删除成功");

        if (annotation && bookId) {
          const anchorType = annotation.cfi.startsWith("txt:")
            ? "txt"
            : annotation.cfi.startsWith("pdf:")
              ? "pdf"
              : "epub";
          if (anchorType !== "pdf") {
            if (
              anchorType === "epub" &&
              (annotation.sectionId == null || annotation.normStart == null || annotation.normEnd == null)
            ) {
              console.warn("Skipping public highlight delete: missing EPUB section info.");
            } else {
              const deviceId = await getPublicHighlightsDeviceId();
              await deletePublicHighlight({
                deviceId,
                bookKey: bookId,
                anchorType,
                anchor: annotation.cfi,
                sectionId: annotation.sectionId ?? null,
                normStart: annotation.normStart ?? null,
                normEnd: annotation.normEnd ?? null,
              });
            }
          }
        }

        // 刷新标注列表
        queryClient.invalidateQueries({ queryKey: ["annotations", bookId] });
      } catch (error) {
        console.error("删除标注失败:", error);
        toast.error("删除标注失败");
        throw error;
      }
    },
    [annotations, queryClient, bookId],
  );

  return {
    annotations: annotations ?? [],
    error,
    isLoading,
    status,
    handleDeleteAnnotation,
  };
};
