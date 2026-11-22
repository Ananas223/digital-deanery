"use client";

import { createContext, useContext } from "react";

import type { AssistantError, AssistantPhase, ConversationMessage } from "./assistant-chat";

/** Launcher state lives in the initial bundle; it never imports the AI runtime. */
export type AssistantLauncherContextValue = {
  enabled: boolean;
  open: boolean;
  openAssistant: (trigger: HTMLButtonElement) => void;
  closeAssistant: (restoreFocus?: boolean) => void;
};

/** Chat state is provided only by the lazily loaded runtime. */
export type AssistantChatContextValue = {
  messages: ConversationMessage[];
  phase: AssistantPhase;
  error: AssistantError | null;
  draft: string;
  canRetry: boolean;
  setDraft: (value: string) => void;
  sendQuestion: () => Promise<void>;
  retry: () => Promise<void>;
  stop: () => void;
  clear: () => void;
};

export const AssistantLauncherContext = createContext<AssistantLauncherContextValue | null>(null);
export const AssistantChatContext = createContext<AssistantChatContextValue | null>(null);

export function useAssistantLauncher() {
  const context = useContext(AssistantLauncherContext);
  if (!context) throw new Error("AssistantRoot is required");
  return context;
}

export function useAssistantChat() {
  const context = useContext(AssistantChatContext);
  if (!context) throw new Error("AssistantRuntime is required");
  return context;
}
