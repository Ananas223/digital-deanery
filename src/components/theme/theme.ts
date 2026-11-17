export const THEME_STORAGE_KEY = "deanery-theme";
export const THEME_CHANGE_EVENT = "deanery-theme-change";

export type ThemePreference = "system" | "light" | "dark";

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
