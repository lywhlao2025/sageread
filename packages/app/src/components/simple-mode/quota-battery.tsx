import { useT } from "@/hooks/use-i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore } from "@/store/auth-store";
import { useModeStore } from "@/store/mode-store";
import { fetchQuota } from "@/services/simple-mode-service";
import { useState } from "react";

export default function SimpleModeQuotaBattery() {
  const { token, quota, setQuota } = useAuthStore();
  const { mode } = useModeStore();
  const t = useT();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (mode !== "simple" || !token || !quota || quota.totalCount <= 0) {
    return null;
  }

  const total = quota.totalCount;
  const used = Math.min(quota.usedCount, total);
  const remaining = Math.max(0, Math.min(quota.remainingCount, total));
  const percent = total > 0 ? remaining / total : 0;
  const fillWidth = `${Math.max(0, Math.min(1, percent)) * 100}%`;
  const showReset = percent < 0.2;

  const handleRefreshQuota = async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      const latestQuota = await fetchQuota();
      setQuota(latestQuota);
    } catch (error) {
      console.warn("Failed to refresh quota:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

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
          {showReset && (
            <button
              type="button"
              onClick={handleRefreshQuota}
              disabled={isRefreshing}
              className="flex h-5 items-center justify-center rounded-full bg-red-600 px-2 font-medium text-[10px] text-white transition hover:bg-red-500 disabled:opacity-60"
              aria-label={t("quota.recharge", "充值")}
              title={t("quota.recharge", "充值")}
            >
              {t("quota.recharge", "充值")}
            </button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t("quota.usedOfTotal", "已用 {used}/{total}", { used, total })} ·{" "}
        {t("quota.remaining", "剩余 {count} 次", { count: remaining })}
      </TooltipContent>
    </Tooltip>
  );
}
