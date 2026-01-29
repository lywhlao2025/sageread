import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/use-i18n";
import { recordUserEvent } from "@/services/simple-mode-service";
import { useAuthStore } from "@/store/auth-store";
import { md5 } from "js-md5";
import { User } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export default function UserMenu() {
  const t = useT();
  const { token, phone, startSwitchUser, userId } = useAuthStore();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return null;
  }

  const handleSubmitFeedback = useCallback(async () => {
    const trimmed = feedback.trim();
    if (!trimmed) {
      toast.error(t("feedback.empty", "请输入反馈意见"));
      return;
    }
    setSubmitting(true);
    try {
      const userIdPart = userId ?? "unknown";
      const eventId = md5(`${userIdPart}-${Date.now()}-user_feedback-${Math.random()}`);
      await recordUserEvent({
        eventId,
        eventType: "user_feedback",
        payloadJson: JSON.stringify({ content: trimmed, source: "user_menu" }),
      });
      toast.success(t("feedback.success", "感谢反馈"));
      setIsFeedbackOpen(false);
      setFeedback("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || t("feedback.fail", "提交失败，请稍后再试"));
    } finally {
      setSubmitting(false);
    }
  }, [feedback, t, userId]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center rounded-full p-1 text-sm outline-none hover:bg-neutral-200 focus:outline-none focus-visible:ring-0 dark:hover:bg-neutral-700">
            <Avatar className="size-6">
              <AvatarFallback className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                <User size={14} />
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="min-w-48">
          <DropdownMenuLabel>{t("user.menu.current", "当前用户")}</DropdownMenuLabel>
          {phone ? (
            <div className="px-2 pb-1 text-xs text-muted-foreground">{phone}</div>
          ) : (
            <div className="px-2 pb-1 text-xs text-muted-foreground">{t("user.menu.unknown", "未知用户")}</div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsFeedbackOpen(true)}>
            {t("user.menu.feedback", "提交反馈")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startSwitchUser()}>
            {t("user.menu.switch", "切换用户")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={isFeedbackOpen}
        onOpenChange={(open) => {
          setIsFeedbackOpen(open);
          if (!open) {
            setFeedback("");
          }
        }}
      >
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("feedback.title", "提交反馈")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder={t("feedback.placeholder", "请描述你的问题或建议")}
            rows={5}
          />
          <DialogFooter className="justify-end">
            <Button variant="ghost" onClick={() => setIsFeedbackOpen(false)} disabled={submitting}>
              {t("feedback.cancel", "取消")}
            </Button>
            <Button onClick={handleSubmitFeedback} disabled={submitting}>
              {t("feedback.submit", "确定")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
