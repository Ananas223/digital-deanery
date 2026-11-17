"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const ENTRANCE_FLAG = "deanery.ui.entrance.v1";
let entranceClaimed = false;

/** One decorative route stroke per tab visit; page content is ready throughout. */
export function EntranceMark({ className }: { className?: string }) {
  const mark = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (entranceClaimed) return;
    entranceClaimed = true;

    try {
      if (window.sessionStorage.getItem(ENTRANCE_FLAG)) return;
      window.sessionStorage.setItem(ENTRANCE_FLAG, "seen");
    } catch {
      // Storage-blocked visits stay static, including after a full reload.
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    mark.current?.setAttribute("data-enter", "true");
  }, []);

  return <span ref={mark} aria-hidden="true" className={cn("entrance-mark", className)} />;
}
