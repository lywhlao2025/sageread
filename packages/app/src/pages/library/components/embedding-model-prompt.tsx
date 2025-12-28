import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EmbeddingModelPromptProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onNeverAsk: () => void;
}

export default function EmbeddingModelPrompt({ open, onConfirm, onCancel, onNeverAsk }: EmbeddingModelPromptProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onCancel() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>向量模型下载</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-neutral-700 dark:text-neutral-300">
          为了提升智能搜索/问答效果，需要下载模型（1.2GB）。
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button variant="outline" onClick={onNeverAsk}>
            不再提示
          </Button>
          <Button onClick={onConfirm}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
