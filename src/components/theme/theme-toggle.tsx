"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { normalizeThemePreference } from "./theme";
import { useTheme } from "./theme-provider";

type ThemeToggleProps = {
  className?: string;
};

/** A native three-choice selector in a compact44px icon control. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();
  const Icon = preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;
  const label = preference === "dark" ? "Тёмная" : preference === "light" ? "Светлая" : "Системная";

  return (
    <label
      title={"Тема оформления: " + label}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "relative shrink-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
      <span className="sr-only">Тема оформления</span>
      <select
        aria-label="Тема оформления"
        value={preference}
        onChange={(event) => setPreference(normalizeThemePreference(event.target.value))}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 focus-visible:outline-none"
      >
        <option value="system">Системная</option>
        <option value="light">Светлая</option>
        <option value="dark">Тёмная</option>
      </select>
    </label>
  );
}
