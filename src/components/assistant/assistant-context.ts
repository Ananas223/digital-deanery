"use client";

import { createContext, useContext } from "react";

import type { AssistantError, AssistantPhase, ConversationMessage } from "./assistant-chat";

export type AssistantContextValue = {
  enabled: boolean;
  open: boolean;
  messages: ConversationMessage[];
  phase: AssistantPhase;
  error: AssistantError | null;
  draft: string;
  canRetry: boolean;
  openAssistant: (trigger: HTMLButtonElement) => void;
  closeAssistant: (restoreFocus?: boolean) => void;
  setDraft: (value: string) => void;
  sendQuestion: () => Promise<void>;
  retry: () => Promise<void>;
  stop: () => void;
  clear: () => void;
};

export const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("AssistantProvider is required");
  return context;
}
