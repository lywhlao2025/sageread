import { I18N_DICT, type Locale } from "./dict";

export type LanguagePreference = "system" | "zh" | "en";

export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return "zh";
  const lang = (navigator.languages?.[0] || navigator.language || "").toLowerCase();
  return lang.startsWith("en") ? "en" : "zh";
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
  const base = entry ? (locale === "en" ? entry.en : entry.zh) : fallback ?? key;
  return interpolate(base, vars);
}

