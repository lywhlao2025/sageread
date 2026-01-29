import { useT } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import aliPayImage from "@/assets/ali_pay.PNG";
import wechatPayImage from "@/assets/wechat_pay.JPG";
import { recordUserEvent } from "@/services/simple-mode-service";
import { useAuthStore } from "@/store/auth-store";
import { useModeStore } from "@/store/mode-store";
import { md5 } from "js-md5";
import { useState } from "react";

export default function SimpleModeQuotaBattery() {
  const { token, quota, userId } = useAuthStore();
  const { mode } = useModeStore();
  const t = useT();
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);

  if (mode !== "simple" || !token || !quota || quota.totalCount <= 0) {
    return null;
  }

  const total = quota.totalCount;
  const used = Math.min(quota.usedCount, total);
  const remaining = Math.max(0, Math.min(quota.remainingCount, total));
  const percent = total > 0 ? remaining / total : 0;
  const fillWidth = `${Math.max(0, Math.min(1, percent)) * 100}%`;
  const showReset = percent < 0.2;

  const handleRechargeClick = () => {
    setIsRechargeOpen(true);
  };

  const handleRechargeDone = async () => {
    setIsRechargeOpen(false);
    try {
      const userIdPart = userId ?? "unknown";
      const eventId = md5(`${userIdPart}-${Date.now()}-recharge_report-${Math.random()}`);
      await recordUserEvent({
        eventId,
        eventType: "recharge_report",
        payloadJson: JSON.stringify({ channel: "unknown" }),
      });
    } catch (error) {
      console.warn("Failed to report recharge:", error);
    }
  };

  return (
    <>
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
                onClick={handleRechargeClick}
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
      <Dialog open={isRechargeOpen} onOpenChange={setIsRechargeOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("quota.recharge.title", "充值")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2">
              <img
                src={aliPayImage}
                alt={t("quota.recharge.alipay", "支付宝")}
                className="max-h-64 w-full rounded-md border border-neutral-200 object-contain dark:border-neutral-700"
              />
              <span className="text-xs text-neutral-600 dark:text-neutral-300">
                {t("quota.recharge.alipay", "支付宝")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <img
                src={wechatPayImage}
                alt={t("quota.recharge.wechat", "微信")}
                className="max-h-64 w-full rounded-md border border-neutral-200 object-contain dark:border-neutral-700"
              />
              <span className="text-xs text-neutral-600 dark:text-neutral-300">
                {t("quota.recharge.wechat", "微信")}
              </span>
            </div>
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-200">
            {t("quota.recharge.note", "进行转账，备注手机号，1 元/100 次模型调用服务")}
          </p>
          <DialogFooter className="justify-center sm:justify-center">
            <Button
              onClick={handleRechargeDone}
              className="bg-emerald-300 text-emerald-950 hover:bg-emerald-200"
            >
              {t("quota.recharge.done", "我已转账")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
