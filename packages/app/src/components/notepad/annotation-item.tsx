import { useReaderStore } from "@/pages/reader/components/reader-provider";
import { HIGHLIGHT_COLOR_HEX, HIGHLIGHT_COLOR_RGBA } from "@/services/constants";
import type { BookNote } from "@/types/book";
import dayjs from "dayjs";
import { useCallback, useState } from "react";

// 清洗正文中误混入的操作文案
const STRIP_LABELS = ["复制", "解释", "翻译", "询问AI", "引用", "补充内容", "取消", "确定"];
const sanitizeText = (text?: string) => {
  if (!text) return "";
  let result = text;
  for (const label of STRIP_LABELS) {
    result = result.split(label).join("");
  }
  return result.trim();
};

interface AnnotationItemProps {
  annotation: BookNote;
  bookId: string;
  bookTitle?: string;
  onDelete?: (id: string) => void;
}

export const AnnotationItem = ({ annotation, onDelete }: AnnotationItemProps) => {
  const view = useReaderStore((state) => state.view);
  const bgColor = annotation.color ? HIGHLIGHT_COLOR_RGBA[annotation.color] : HIGHLIGHT_COLOR_RGBA.yellow;
  const lineColor = annotation.color ? HIGHLIGHT_COLOR_HEX[annotation.color] : HIGHLIGHT_COLOR_HEX.yellow;
  const style = annotation.style || "highlight";
  const [confirming, setConfirming] = useState(false);
  const cleanText = sanitizeText(annotation.text);
  const cleanBefore = sanitizeText(annotation.context?.before);
  const cleanAfter = sanitizeText(annotation.context?.after);

  const handleClick = useCallback(() => {
    if (view) {
      view.goTo(annotation.cfi);
    }
  }, [annotation.cfi, view]);

  return (
    <div
      className="group cursor-pointer rounded-lg bg-muted p-2 transition-colors dark:bg-neutral-900"
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">{dayjs(annotation.createdAt).format("YYYY-MM-DD HH:mm")}</span>
              <button
                className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600 transition hover:bg-red-100 hover:text-red-700 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirming((v) => !v);
                }}
            >
              删除
            </button>
          </div>
          {annotation.context && (
            <div className="mb-1 text-sm leading-relaxed">
              <span className="text-neutral-600 dark:text-neutral-200">...{cleanBefore}</span>
              <span
                className="font-medium text-sm"
                style={{
                  backgroundColor: style === "highlight" ? bgColor : "transparent",
                  textDecoration: style === "underline" || style === "squiggly" ? "underline" : "none",
                  textDecorationColor: style !== "highlight" ? lineColor : undefined,
                  textDecorationThickness: "2px",
                  textDecorationStyle: style === "squiggly" ? "wavy" : "solid",
                }}
              >
                {cleanText}
              </span>
              <span className="text-neutral-600 dark:text-neutral-200">{cleanAfter}...</span>
            </div>
          )}

          {!annotation.context && (
            <div className="mb-2">
              <span
                className="font-medium text-sm"
                style={{
                  backgroundColor: style === "highlight" ? bgColor : "transparent",
                  textDecoration: style === "underline" || style === "squiggly" ? "underline" : "none",
                  textDecorationColor: style !== "highlight" ? lineColor : undefined,
                  textDecorationThickness: "2px",
                  textDecorationStyle: style === "squiggly" ? "wavy" : "solid",
                }}
              >
                {cleanText}
              </span>
            </div>
          )}

          {confirming && (
            <div className="mt-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
              <div className="text-neutral-700 dark:text-neutral-200">确定删除这条标注吗？</div>
              <div className="mt-2 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
                “{annotation.text || "无内容"}”
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  className="rounded-md px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirming(false);
                  }}
                >
                  取消
                </button>
                <button
                  className="rounded-md bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onDelete) await onDelete(annotation.id);
                    setConfirming(false);
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
