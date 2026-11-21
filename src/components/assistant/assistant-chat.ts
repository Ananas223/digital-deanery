import { DefaultChatTransport, type UIMessage } from "ai";

import { chatRequestSchema, type ChatMessage } from "@/lib/validation/ai";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type AssistantPhase = "idle" | "waiting" | "streaming" | "complete" | "stopped" | "error";

export type AssistantError = {
  message: string;
  retryable: boolean;
};

class AssistantRequestError extends Error {
  constructor(readonly status: number) {
    super("Assistant request failed");
    this.name = "AssistantRequestError";
  }
}

export class AssistantInterruptedError extends Error {
  constructor() {
    super("Assistant response was interrupted");
    this.name = "AssistantInterruptedError";
  }
}

/** Only text from the conversation is sent back, never streamed tool arguments or results. */
export function toChatRequest(messages: ConversationMessage[]) {
  return chatRequestSchema.safeParse({
    messages: messages.map(({ id, role, text }) => ({
      id,
      role,
      parts: [{ type: "text", text }],
    })),
  });
}

export function toUiMessages(messages: ChatMessage[]): UIMessage[] {
  return messages.map(({ id, role, parts }) => ({ id, role, parts }));
}

export function readMessageText(message: UIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function getAssistantError(error: unknown): AssistantError {
  if (error instanceof AssistantInterruptedError) {
    return { message: "Ответ прервался. Попробуйте повторить вопрос.", retryable: true };
  }

  if (!(error instanceof AssistantRequestError)) {
    return {
      message: "Не удалось получить ответ. Проверьте подключение и попробуйте ещё раз.",
      retryable: true,
    };
  }

  switch (error.status) {
    case 401:
      return {
        message: "Сессия закончилась. Обновите страницу и войдите в кабинет снова.",
        retryable: false,
      };
    case 403:
      return { message: "Помощник доступен в кабинете студента.", retryable: false };
    case 422:
      return { message: "Проверьте вопрос или очистите слишком длинный диалог.", retryable: false };
    case 429:
      return { message: "Достигнут лимит вопросов. Попробуйте немного позже.", retryable: true };
    case 503:
      return {
        message: "Блик временно недоступен. Расписание, учёба и заявки доступны в своих разделах.",
        retryable: true,
      };
    default:
      return { message: "Не удалось получить ответ. Попробуйте ещё раз.", retryable: true };
  }
}

/** Use the installed SDK to validate and consume its standard UI-message stream. */
export function createAssistantTransport() {
  return new DefaultChatTransport<UIMessage>({
    api: "/api/ai/chat",
    credentials: "same-origin",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        messages: messages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({
            id: message.id,
            role: message.role,
            parts: [{ type: "text", text: readMessageText(message) }],
          })),
      },
    }),
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      if (response.redirected && new URL(response.url).pathname === "/login") {
        throw new AssistantRequestError(401);
      }
      if (!response.ok) throw new AssistantRequestError(response.status);
      return response;
    },
  });
}
