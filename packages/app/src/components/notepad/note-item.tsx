import type { Note } from "@/types/note";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { useNotepad } from "./hooks";
import { NoteDetailDialog } from "./note-detail-dialog";

interface NoteItemProps {
  note: Note;
}

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

export const NoteItem = ({ note }: NoteItemProps) => {
  const { handleDeleteNote } = useNotepad();
  const [showDetail, setShowDetail] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const cleanContent = sanitizeText(note.content);

  const handleClick = useCallback(() => {
    setShowDetail(true);
  }, []);

  return (
    <>
      <div
        className="group cursor-pointer rounded-lg bg-muted p-2"
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">{dayjs(note.createdAt).format("YYYY-MM-DD HH:mm")}</span>
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
            <p className="mt-1 line-clamp-3 select-auto text-neutral-700 text-sm dark:text-neutral-200">
              {cleanContent || "暂无内容"}
            </p>

            {confirming && (
              <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                <div className="text-neutral-700 dark:text-neutral-200">确定删除这条笔记吗？</div>
                <div className="mt-2 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
                  “{cleanContent || "暂无内容"}”
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
                      await handleDeleteNote(note.id);
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

      <NoteDetailDialog note={note} open={showDetail} onOpenChange={setShowDetail} />
    </>
  );
};
