import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/use-i18n";
import { trackEvent } from "@/services/analytics-service";
import { type AppMode, useModeStore } from "@/store/mode-store";

export default function ModeSelectionDialog() {
  const t = useT();
  const { mode, hasHydrated, setMode } = useModeStore();
  const isOpen = hasHydrated && mode === null;

  const handleSelect = (nextMode: AppMode) => {
    setMode(nextMode);
    trackEvent("mode_selected", { mode: nextMode, source: "onboarding" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="max-w-[520px] p-0">
        <DialogHeader showCloseButton={false} className="border-0 px-6 pt-6 pb-0">
          <DialogTitle>{t("mode.select.title", "选择使用方式")}</DialogTitle>
          <DialogDescription className="px-0">
            {t("mode.select.desc", "首次选择后可在设置中切换")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 p-6 pt-4">
          <button
            type="button"
            className="flex w-full flex-col items-start gap-1 rounded-lg border border-neutral-200 bg-background p-4 text-left transition hover:border-primary/50 hover:bg-muted/40"
            onClick={() => handleSelect("simple")}
          >
            <span className="font-medium text-base">{t("mode.simple.title", "简约模式")}</span>
            <span className="text-muted-foreground text-sm">{t("mode.simple.desc", "快速开始，自动配置")}</span>
          </button>
          <button
            type="button"
            className="flex w-full flex-col items-start gap-1 rounded-lg border border-neutral-200 bg-background p-4 text-left transition hover:border-primary/50 hover:bg-muted/40"
            onClick={() => handleSelect("classic")}
          >
            <span className="font-medium text-base">{t("mode.classic.title", "经典模式")}</span>
            <span className="text-muted-foreground text-sm">{t("mode.classic.desc", "高级设置与更多控制")}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
