import { z } from "zod";

/**
 * Контракт запроса к ИИ-помощнику (`docs/specs/p9-ai-assistant.md` § 4.3).
 *
 * История живёт только в состоянии клиента и уходит на сервер в каждом запросе;
 * сервер её не сохраняет. Системные сообщения, файлы и другие нетекстовые части
 * от клиента не принимаются: помощник объясняет свои данные, а не исполняет
 * команды. Те же правила проверяются на сервере повторно, независимо от клиента.
 */

/** Сколько сообщений может содержать один запрос. */
export const AI_MAX_MESSAGES = 20;

/** Суммарная длина текста истории в символах: защита бюджета токенов. */
export const AI_MAX_TOTAL_CHARS = 20_000;

/**
 * Верхняя граница тела запроса в байтах.
 *
 * Кириллица в UTF-8 занимает до двух байт на символ, поэтому история на
 * 20 000 символов может весить около 40 000 байт; запас до 100 000 байт
 * отсекает явно раздутые тела до чтения и разбора JSON.
 */
export const AI_MAX_BODY_BYTES = 100_000;

const MAX_PARTS_PER_MESSAGE = 20;
const MAX_MESSAGE_ID_LENGTH = 200;

const chatMessagePartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(AI_MAX_TOTAL_CHARS),
});

const chatMessageSchema = z.object({
  id: z.string().min(1).max(MAX_MESSAGE_ID_LENGTH),
  role: z.enum(["user", "assistant"]),
  parts: z.array(chatMessagePartSchema).min(1).max(MAX_PARTS_PER_MESSAGE),
});

/**
 * Тело `POST /api/ai/chat`: только текстовые сообщения пользователя и помощника.
 *
 * Лимит символов считается по всей истории, а не по отдельному сообщению:
 * иначе длинная переписка обошла бы бюджет токенов.
 */
export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(AI_MAX_MESSAGES),
  })
  .superRefine((value, context) => {
    const totalChars = value.messages.reduce(
      (messageTotal, message) =>
        messageTotal + message.parts.reduce((partTotal, part) => partTotal + part.text.length, 0),
      0,
    );

    if (totalChars > AI_MAX_TOTAL_CHARS) {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: `История не должна превышать ${AI_MAX_TOTAL_CHARS} символов.`,
      });
    }
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = ChatRequest["messages"][number];
