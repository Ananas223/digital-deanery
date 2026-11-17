"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

import {
  normalizeThemePreference,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const scheme = preference === "system" ? "light dark" : preference;
  root.dataset.themePreference = preference;
  root.dataset.theme =
    preference === "dark" || (preference === "system" && systemDark) ? "dark" : "light";
  root.style.colorScheme = scheme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) meta.content = scheme;
}

function getSnapshot(): ThemePreference {
  return normalizeThemePreference(document.documentElement.dataset.themePreference);
}

function getServerSnapshot(): ThemePreference {
  return "system";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (getSnapshot() === "system") applyTheme("system");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyTheme(normalizeThemePreference(event.newValue));
    onChange();
  };
  const onPreferenceChange = () => onChange();
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onPreferenceChange);
  applyTheme(getSnapshot());
  return () => {
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onPreferenceChange);
  };
}

function setPreference(preference: ThemePreference) {
  applyTheme(preference);
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The current choice still works when storage is blocked.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** UI preferences only; passed children retain their server component boundary. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = useMemo(() => ({ preference, setPreference }), [preference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeToggle requires ThemeProvider");
  return context;
}
