import { t as translate } from "@/i18n";
import type { Locale } from "@/i18n/dict";
import { useI18nStore } from "@/store/i18n-store";

export function useLocale(): Locale {
  return useI18nStore((s) => s.getResolvedLocale());
}

export function useT() {
  const locale = useLocale();
  return (key: string, fallback?: string, vars?: Record<string, string | number>) => translate(locale, key, fallback, vars);
}

