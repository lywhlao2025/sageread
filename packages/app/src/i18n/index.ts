import { I18N_DICT, type Locale } from "./dict";

export type LanguagePreference = "system" | Locale;

export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return "zh";
  const lang = (navigator.languages?.[0] || navigator.language || "").toLowerCase();
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("es")) return "es";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("de")) return "de";
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("en")) return "en";
  return "zh";
}

export function resolveLocale(preference: LanguagePreference, systemLocale: Locale): Locale {
  if (preference === "system") return systemLocale;
  return preference;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

/**
 * Translate by key (preferred), with a safe fallback string.
 * - When a key is missing, falls back to provided `fallback` (or the key itself).
 * - Supports simple `{var}` interpolation.
 */
export function t(locale: Locale, key: string, fallback?: string, vars?: Record<string, string | number>): string {
  const entry = I18N_DICT[key];
  const base =
    (entry?.[locale] as string | undefined) ??
    (entry?.en as string | undefined) ??
    (entry?.zh as string | undefined) ??
    fallback ??
    key;
  return interpolate(base, vars);
}
