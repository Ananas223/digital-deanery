"use client";

import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";

import { useAssistantLauncher } from "./assistant-context";
import { BlikMascot } from "./blik-mascot";

/** The home card opens the same conversation that is available from the cabinet toolbar. */
export function AssistantHomeCard() {
  const { enabled, open, openAssistant } = useAssistantLauncher();
  const trackingSurfaceRef = useRef<HTMLElement | null>(null);
  if (!enabled) return null;

  return (
    <section
      ref={trackingSurfaceRef}
      data-blik-surface=""
      aria-labelledby="assistant-home-title"
      className="rounded-card border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="assistant-home-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Блик
          </h2>
          <p className="mt-1 text-caption text-muted-foreground">Ваш ИИ-помощник</p>
        </div>
        <BlikMascot state="idle" className="size-24" trackingSurfaceRef={trackingSurfaceRef} />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Спросите о расписании, учёбе, заявках и уведомлениях.
      </p>
      <button
        type="button"
        className={buttonVariants({ variant: "outline", size: "md" }) + " mt-5 w-full"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? "assistant-panel" : undefined}
        onClick={(event) => openAssistant(event.currentTarget)}
      >
        Задать вопрос
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </button>
    </section>
  );
}
