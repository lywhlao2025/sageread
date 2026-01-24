import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/hooks/use-i18n";

export default function SimpleModeQuotaBadge() {
  const { quota } = useAuthStore();
  const t = useT();

  if (!quota) return null;

  return (
    <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
      {t("quota.remaining", "剩余 {count} 次", { count: quota.remainingCount })}
    </div>
  );
}
