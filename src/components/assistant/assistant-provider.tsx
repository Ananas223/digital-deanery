"use client";

import { readUIMessageStream, type UIMessageChunk } from "ai";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  createAssistantTransport,
  AssistantInterruptedError,
  getAssistantError,
  readMessageText,
  toChatRequest,
  toUiMessages,
  type AssistantError,
  type AssistantPhase,
  type ConversationMessage,
} from "./assistant-chat";
import { AssistantContext } from "./assistant-context";
import { AssistantPanel } from "./assistant-panel";

type ConversationState = {
  messages: ConversationMessage[];
  phase: AssistantPhase;
  error: AssistantError | null;
};

type ConversationAction =
  | { type: "start"; messages: ConversationMessage[] }
  | { type: "partial"; message: ConversationMessage }
  | { type: "finish" }
  | { type: "stop" }
  | { type: "fail"; error: AssistantError }
  | { type: "clear" };

const initialState: ConversationState = { messages: [], phase: "idle", error: null };

function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case "start":
      return { messages: action.messages, phase: "waiting", error: null };
    case "partial": {
      const last = state.messages.at(-1);
      const messages =
        last?.id === action.message.id ? state.messages.slice(0, -1) : state.messages;
      return { messages: [...messages, action.message], phase: "streaming", error: null };
    }
    case "finish":
      return { ...state, phase: "complete", error: null };
    case "stop":
      return { ...state, phase: "stopped", error: null };
    case "fail":
      return { ...state, phase: "error", error: action.error };
    case "clear":
      return initialState;
  }
}

/** One conversation per mounted signed-in layout, never persisted in browser storage. */
export function AssistantProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef<ConversationMessage[] | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const openAssistant = useCallback((trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    restoreFocusRef.current = true;
    setOpen(true);
  }, []);

  const closeAssistant = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  const stop = useCallback(() => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    dispatch({ type: "stop" });
  }, []);

  const clear = useCallback(() => {
    requestVersionRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    lastRequestRef.current = null;
    dispatch({ type: "clear" });
  }, []);

  const runRequest = useCallback(
    async (messages: ConversationMessage[]) => {
      if (!enabled || controllerRef.current) return;
      const parsed = toChatRequest(messages);

      if (!parsed.success) {
        dispatch({
          type: "fail",
          error: {
            message: "Диалог стал слишком длинным. Очистите историю, чтобы задать новый вопрос.",
            retryable: false,
          },
        });
        return;
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      const version = ++requestVersionRef.current;
      const assistantId = crypto.randomUUID();
      chatIdRef.current ??= crypto.randomUUID();
      lastRequestRef.current = messages;
      dispatch({ type: "start", messages });
      let answer = "";
      let finished = false;
      let streamError = false;

      try {
        const stream = await createAssistantTransport().sendMessages({
          trigger: "submit-message",
          chatId: chatIdRef.current,
          messageId: undefined,
          messages: toUiMessages(parsed.data.messages),
          abortSignal: controller.signal,
        });
        const observedStream = stream.pipeThrough(
          new TransformStream<UIMessageChunk, UIMessageChunk>({
            transform(chunk, output) {
              if (chunk.type === "finish") {
                finished = true;
                if (
                  chunk.finishReason === "error" ||
                  chunk.finishReason === "length" ||
                  chunk.finishReason === "content-filter" ||
                  chunk.finishReason === "other"
                ) {
                  streamError = true;
                }
              } else if (chunk.type === "error" || chunk.type === "abort") {
                streamError = true;
              }
              output.enqueue(chunk);
            },
          }),
        );

        for await (const message of readUIMessageStream({
          stream: observedStream,
          terminateOnError: true,
          onError: () => {
            streamError = true;
          },
        })) {
          if (controller.signal.aborted || version !== requestVersionRef.current) return;
          answer = readMessageText(message);
          if (answer) {
            dispatch({
              type: "partial",
              message: { id: assistantId, role: "assistant", text: answer },
            });
          }
        }

        if (version !== requestVersionRef.current || controller.signal.aborted) return;
        if (!finished || streamError || !answer.trim()) throw new AssistantInterruptedError();
        dispatch({ type: "finish" });
      } catch (error) {
        if (controller.signal.aborted || version !== requestVersionRef.current) return;
        dispatch({
          type: "fail",
          error: getAssistantError(answer || streamError ? new AssistantInterruptedError() : error),
        });
      } finally {
        if (version === requestVersionRef.current) controllerRef.current = null;
      }
    },
    [enabled],
  );

  const sendQuestion = useCallback(async () => {
    const text = draft.trim();
    if (!text || controllerRef.current) return;
    const messages: ConversationMessage[] = [
      ...state.messages,
      { id: crypto.randomUUID(), role: "user", text },
    ];
    if (toChatRequest(messages).success) setDraft("");
    await runRequest(messages);
  }, [draft, runRequest, state.messages]);

  const retry = useCallback(async () => {
    if (lastRequestRef.current) await runRequest(lastRequestRef.current);
  }, [runRequest]);

  const context = useMemo(
    () => ({
      enabled,
      open: enabled && open,
      messages: state.messages,
      phase: state.phase,
      error: state.error,
      draft,
      canRetry: state.phase === "stopped" || state.error?.retryable === true,
      openAssistant,
      closeAssistant,
      setDraft,
      sendQuestion,
      retry,
      stop,
      clear,
    }),
    [enabled, open, state, draft, openAssistant, closeAssistant, sendQuestion, retry, stop, clear],
  );

  return (
    <AssistantContext.Provider value={context}>
      {children}
      <AssistantPanel
        onOpenChange={(nextOpen, reason) => {
          if (nextOpen) setOpen(true);
          else closeAssistant(reason !== "outside-press" && reason !== "focus-out");
        }}
        finalFocus={() =>
          restoreFocusRef.current && triggerRef.current?.isConnected ? triggerRef.current : false
        }
      />
    </AssistantContext.Provider>
  );
}
