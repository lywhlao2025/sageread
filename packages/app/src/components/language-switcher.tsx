import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/use-i18n";
import { useI18nStore } from "@/store/i18n-store";
import { Languages } from "lucide-react";

export default function LanguageSwitcher() {
  const t = useT();
  const preference = useI18nStore((s) => s.preference);
  const setPreference = useI18nStore((s) => s.setPreference);

  const labelMap: Record<string, string> = {
    system: t("settings.language.system", "跟随系统"),
    zh: t("settings.language.zh", "中文"),
    en: t("settings.language.en", "English"),
    ja: t("settings.language.ja", "Japanese"),
    ko: t("settings.language.ko", "Korean"),
    es: t("settings.language.es", "Spanish"),
    fr: t("settings.language.fr", "French"),
    de: t("settings.language.de", "German"),
    "pt-BR": t("settings.language.ptBR", "Portuguese (Brazil)"),
  };
  const shortLabelMap: Record<string, string> = {
    system: "Auto",
    zh: "中",
    en: "EN",
    ja: "JA",
    ko: "KO",
    es: "ES",
    fr: "FR",
    de: "DE",
    "pt-BR": "PT",
  };
  const shortLabel = shortLabelMap[preference] || "Auto";
  const fullLabel = labelMap[preference] || labelMap.system;

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
        <DropdownMenuItem onClick={() => setPreference("en")}>{t("settings.language.en", "English")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("ja")}>{t("settings.language.ja", "Japanese")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("ko")}>{t("settings.language.ko", "Korean")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("es")}>{t("settings.language.es", "Spanish")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("fr")}>{t("settings.language.fr", "French")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("de")}>{t("settings.language.de", "German")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setPreference("pt-BR")}>
          {t("settings.language.ptBR", "Portuguese (Brazil)")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
