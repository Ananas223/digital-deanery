"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { AssistantLauncherContext } from "./assistant-context";

// The AI SDK, panel and mascot stay out of the initial bundle until Blik is opened.
const AssistantRuntime = dynamic(
  () => import("./assistant-runtime").then((module) => module.AssistantRuntime),
  { ssr: false },
);

/**
 * Light shell wrapper: owns launcher state and loads the chat runtime on first open.
 * Conversation state survives close/open and in-app navigation, and resets on reload
 * because the runtime is only mounted after the first launcher interaction.
 */
export function AssistantRoot({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(true);

  const openAssistant = useCallback((trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    restoreFocusRef.current = true;
    setMounted(true);
    setOpen(true);
  }, []);

  const closeAssistant = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  const handleOpen = useCallback(() => setOpen(true), []);

  const finalFocus = useCallback((): HTMLElement | false => {
    if (restoreFocusRef.current && triggerRef.current?.isConnected) return triggerRef.current;
    return false;
  }, []);

  const value = useMemo(
    () => ({ enabled, open: enabled && open, openAssistant, closeAssistant }),
    [enabled, open, openAssistant, closeAssistant],
  );

  return (
    <AssistantLauncherContext.Provider value={value}>
      {children}
      {enabled && mounted ? (
        <AssistantRuntime
          open={open}
          onOpen={handleOpen}
          onClose={closeAssistant}
          finalFocus={finalFocus}
        />
      ) : null}
    </AssistantLauncherContext.Provider>
  );
}
