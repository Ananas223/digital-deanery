"use client";

import { cn } from "@/lib/utils";

import { useAssistant } from "./assistant-context";
import { BlikMascot } from "./blik-mascot";

export function AssistantTrigger({ placement }: { placement: "sidebar" | "mobile" }) {
  const assistant = useAssistant();
  if (!assistant.enabled) return null;
  const sidebar = placement === "sidebar";

  return (
    <button
      type="button"
      aria-label={sidebar ? undefined : "Блик, ИИ-помощник"}
      aria-haspopup="dialog"
      aria-controls={assistant.open ? "assistant-panel" : undefined}
      aria-expanded={assistant.open}
      onClick={(event) => assistant.openAssistant(event.currentTarget)}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg text-sm text-foreground transition-colors duration-(--duration-feedback) ease-interface hover:bg-primary-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-muted",
        sidebar ? "w-full min-w-0 px-3 py-2 text-left" : "size-11 justify-center",
      )}
    >
      <BlikMascot className="size-9" />
      {sidebar ? (
        <span className="min-w-0">
          <span className="block font-semibold">Блик</span>
          <span className="block text-caption text-muted-foreground">ИИ-помощник</span>
        </span>
      ) : null}
    </button>
  );
}
