import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Note } from "@/types/note";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNotepad } from "./hooks";
import { toast } from "sonner";

interface NoteDetailDialogProps {
  note: Note | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteDetailDialog({ note, open, onOpenChange }: NoteDetailDialogProps) {
  if (!note) return null;

  const { handleUpdateNote } = useNotepad();
  // 将笔记内容拆成「引用」+「补充」，约定中间用两个换行分隔
  const [quote, setQuote] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = note.content ?? "";
    const parts = raw.split(/\n\n/);
    if (parts.length > 1) {
      setQuote(parts[0] ?? "");
      setExtra(parts.slice(1).join("\n\n"));
    } else {
      setQuote(raw);
      setExtra("");
    }
  }, [note]);

  const derivedTitle = useMemo(() => {
    const combined = [quote.trim(), extra.trim()].filter(Boolean).join("\n\n");
    if (!combined) return "无标题";
    return combined.length > 50 ? `${combined.slice(0, 50)}...` : combined;
  }, [quote, extra]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 这里不做“只保留 ASCII”的清洗：笔记内容需要保留中文等 Unicode 字符，
      // 且后端使用参数绑定（sqlx .bind），不会因为特殊字符导致 SQL 拼接错误。
      const combined = [quote.trim(), extra.trim()].filter(Boolean).join("\n\n");
      const title = derivedTitle.trim() || "无标题";

      await handleUpdateNote({
        id: note.id,
        content: combined,
        title,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新笔记失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{derivedTitle}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-1 text-mutedx text-sm">
          <div className="flex items-center gap-1">
            <div>{dayjs(note.createdAt).format("YYYY-MM-DD HH:mm:ss")}</div>
          </div>

          {note.bookMeta && (
            <div>
              关联书籍: {note.bookMeta.title}
              {note.bookMeta.author && ` - ${note.bookMeta.author}`}
            </div>
          )}
        </div>
        <ScrollArea className="max-h-[60vh] min-h-[200px] space-y-3 px-4 py-2">
          <div>
            <div className="mb-1 text-xs text-neutral-500">引用</div>
            <div className="min-h-[80px] rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
              {quote || "暂无引用"}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs text-neutral-500">补充内容</div>
            <textarea
              className="h-32 w-full resize-none whitespace-pre-wrap rounded border border-neutral-200 bg-background px-3 py-2 text-sm text-neutral-900 outline-none focus:border-primary-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="输入或修改你的补充内容"
            />
          </div>
        </ScrollArea>
        <div className="mt-3 flex justify-end gap-2 border-t border-neutral-200 bg-white pt-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <button
            className="rounded-md px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </button>
          <button
            className="rounded-md bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-800 dark:bg-primary-500 dark:hover:bg-primary-600 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            确定
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
