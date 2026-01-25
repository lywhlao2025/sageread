import { useT } from "@/hooks/use-i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth-store";
import { useModeStore } from "@/store/mode-store";

export default function SimpleModeQuotaBattery() {
  const { token, quota } = useAuthStore();
  const { mode } = useModeStore();
  const t = useT();

  if (mode !== "simple" || !token || !quota || quota.totalCount <= 0) {
    return null;
  }

  const total = quota.totalCount;
  const used = Math.min(quota.usedCount, total);
  const remaining = Math.max(0, Math.min(quota.remainingCount, total));
  const percent = total > 0 ? remaining / total : 0;
  const fillWidth = `${Math.max(0, Math.min(1, percent)) * 100}%`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1">
          <div className="relative h-3 w-7 overflow-hidden rounded-[3px] border border-neutral-400/80 dark:border-neutral-500/80">
            <div
              className="h-full rounded-[2px] bg-emerald-500 transition-[width] duration-300"
              style={{ width: fillWidth }}
            />
            <div className="-right-[3px] absolute top-1/2 h-1.5 w-1 -translate-y-1/2 rounded-[1px] bg-neutral-400/80 dark:bg-neutral-500/80" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t("quota.usedOfTotal", "已用 {used}/{total}", { used, total })} ·{" "}
        {t("quota.remaining", "剩余 {count} 次", { count: remaining })}
      </TooltipContent>
    </Tooltip>
  );
}
