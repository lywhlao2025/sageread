import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/use-i18n";
import { useI18nStore } from "@/store/i18n-store";
import { Languages } from "lucide-react";

export default function LanguageSwitcher() {
  const t = useT();
  const preference = useI18nStore((s) => s.preference);
  const setPreference = useI18nStore((s) => s.setPreference);

  const shortLabel = preference === "system" ? "Auto" : preference === "en" ? "EN" : "中";
  const fullLabel =
    preference === "system"
      ? t("settings.language.system", "跟随系统")
      : preference === "en"
        ? t("settings.language.en", "英语")
        : t("settings.language.zh", "中文");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          title={fullLabel}
          className="h-7 gap-1 rounded-full px-2 text-neutral-700 dark:text-neutral-300"
        >
          <Languages className="h-4 w-4" />
          <span className="text-[11px]">{shortLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={() => setPreference("system")}>
          {t("settings.language.system", "跟随系统")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("zh")}>{t("settings.language.zh", "中文")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("en")}>{t("settings.language.en", "英语")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
