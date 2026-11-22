import "server-only";

import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2FinishReason,
  LanguageModelV2FunctionTool,
  LanguageModelV2Message,
  LanguageModelV2StreamPart,
  LanguageModelV2ToolChoice,
  LanguageModelV2ToolResultPart,
} from "@ai-sdk/provider";

/** Путь к OpenAI-совместимому методу чата Codex Code. */
export const CODEX_CODE_CHAT_PATH = "/chat/completions";

/** Базовый URL OpenAI-совместимого API Codex Code по умолчанию. */
export const CODEX_CODE_BASE_URL_DEFAULT = "https://codexcode.tech/v1";

/** Распознаёт finish reason провайдера в терминах ai@6. */
function mapFinishReason(reason: string | undefined | null): LanguageModelV2FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    case "tool_calls":
      return "tool-calls";
    case null:
    case undefined:
      return "stop";
    default:
      return "stop";
  }
}

/** OpenAI-формат сообщения чата. */
type OpenAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

/** OpenAI-формат инструмента. */
type OpenAiTool = {
  type: "function";
  function: { name: string; description?: string; parameters: unknown };
};

/** Преобразует сообщения ai@6 (v2) в формат OpenAI Chat Completions. */
function toOpenAiMessages(prompt: LanguageModelV2Message[]): OpenAiMessage[] {
  const messages: OpenAiMessage[] = [];

  for (const message of prompt) {
    if (message.role === "system") {
      messages.push({ role: "system", content: message.content });
      continue;
    }

    if (message.role === "user") {
      const text = message.content
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      messages.push({ role: "user", content: text || null });
      continue;
    }

    if (message.role === "tool") {
      const resultPart = message.content.find(
        (part): part is LanguageModelV2ToolResultPart => part.type === "tool-result",
      );
      messages.push({
        role: "tool",
        tool_call_id: resultPart?.toolCallId,
        content: resultPart !== undefined ? JSON.stringify(resultPart.output) : "",
      });
      continue;
    }

    // assistant
    const text = message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
    const toolCalls: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }> = [];
    for (const part of message.content) {
      if (part.type === "tool-call") {
        toolCalls.push({
          id: part.toolCallId,
          type: "function",
          function: { name: part.toolName, arguments: String(part.input) },
        });
      }
    }
    messages.push({
      role: "assistant",
      content: text || null,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    });
  }

  return messages;
}

function toOpenAiTool(tool: LanguageModelV2FunctionTool): OpenAiTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

function toOpenAiToolChoice(
  toolChoice: LanguageModelV2ToolChoice | undefined,
  hasTools: boolean,
): string | { type: "function"; function: { name: string } } | undefined {
  if (!hasTools) return undefined;
  if (toolChoice === undefined || toolChoice.type === "auto") return "auto";
  if (toolChoice.type === "none") return "none";
  if (toolChoice.type === "required") return "required";
  if (toolChoice.type === "tool") {
    return { type: "function", function: { name: toolChoice.toolName } };
  }
  return "auto";
}

/** Создаёт модель Codex Code, совместимую с ai@6 (`LanguageModelV2`). */
export function createCodexCodeModel(params: {
  apiKey: string;
  baseUrl: string;
  modelId: string;
}): LanguageModelV2 {
  const { apiKey, baseUrl, modelId } = params;
  const url = baseUrl.replace(/\/$/, "") + CODEX_CODE_CHAT_PATH;

  return {
    specificationVersion: "v2",
    provider: "codex-code",
    modelId,
    supportedUrls: {},
    async doGenerate() {
      throw new Error("codex-code: doGenerate не поддерживается, используется потоковый doStream");
    },
    async doStream(options: LanguageModelV2CallOptions) {
      const {
        prompt,
        tools,
        toolChoice,
        maxOutputTokens,
        temperature,
        topP,
        stopSequences,
        seed,
        abortSignal,
        headers,
      } = options;

      const controllerAbort = new AbortController();
      let aborted = false;
      const abort = () => {
        aborted = true;
        try {
          controllerAbort.abort();
        } catch {}
      };
      if (abortSignal) {
        if (abortSignal.aborted) {
          abort();
        } else {
          abortSignal.addEventListener("abort", abort, { once: true });
        }
      }

      const openAiMessages = toOpenAiMessages(prompt);
      const hasTools = Array.isArray(tools) && tools.length > 0;
      const openAiTools = hasTools
        ? tools
            .filter((tool): tool is LanguageModelV2FunctionTool => tool.type === "function")
            .map(toOpenAiTool)
        : undefined;

      const body = {
        model: modelId,
        messages: openAiMessages,
        stream: true,
        ...(maxOutputTokens != null ? { max_tokens: maxOutputTokens } : {}),
        ...(temperature != null ? { temperature } : {}),
        ...(topP != null ? { top_p: topP } : {}),
        ...(stopSequences?.length ? { stop: stopSequences } : {}),
        ...(seed != null ? { seed } : {}),
        ...(hasTools
          ? { tools: openAiTools, tool_choice: toOpenAiToolChoice(toolChoice, hasTools) }
          : {}),
      };

      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        start(ctrl) {
          (async () => {
            let textId: string | null = null;
            let textStarted = false;
            const toolBuffers = new Map<string, { toolName: string; args: string }>();
            let finishReason: LanguageModelV2FinishReason = "stop";
            let inputTokens: number | undefined;
            let outputTokens: number | undefined;
            let closed = false;

            const enqueue = (part: LanguageModelV2StreamPart) => {
              if (closed) return;
              ctrl.enqueue(part);
            };

            try {
              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                  ...(headers ?? {}),
                },
                body: JSON.stringify(body),
                signal: controllerAbort.signal,
              });

              if (!response.ok || !response.body) {
                const text = await response.text().catch(() => "");
                enqueue({
                  type: "error",
                  error: new Error(`codex-code: HTTP ${response.status} ${text}`),
                });
                ctrl.close();
                closed = true;
                return;
              }

              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";

              try {
                while (true) {
                  if (aborted) break;
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });

                  let newlineIndex;
                  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);
                    await processSseLine(line, {
                      enqueue,
                      setTextId: (id) => {
                        textId = id;
                        textStarted = true;
                      },
                      onTextDelta: (delta) => {
                        if (!textStarted) {
                          enqueue({ type: "text-start", id: crypto.randomUUID() });
                          textStarted = true;
                          textId =
                            (ctrl as { __lastTextId?: string }).__lastTextId ?? crypto.randomUUID();
                        }
                        enqueue({ type: "text-delta", id: textId ?? crypto.randomUUID(), delta });
                      },
                      onToolInputStart: (id, toolName) => {
                        toolBuffers.set(id, { toolName, args: "" });
                        enqueue({ type: "tool-input-start", id, toolName });
                      },
                      onToolInputDelta: (id, delta) => {
                        const buf = toolBuffers.get(id);
                        if (buf) {
                          buf.args += delta;
                          enqueue({ type: "tool-input-delta", id, delta });
                        }
                      },
                      onToolInputEnd: (id) => {
                        toolBuffers.delete(id);
                        enqueue({ type: "tool-input-end", id });
                      },
                      setFinishReason: (reason) => {
                        finishReason = reason;
                      },
                      setUsage: (inTok, outTok) => {
                        inputTokens = inTok;
                        outputTokens = outTok;
                      },
                    });
                    if (aborted) break;
                  }
                }

                // Остаток буфера (последене событие без перевода строки).
                if (buffer.trim() && !aborted) {
                  await processSseLine(buffer, {
                    enqueue,
                    setTextId: (id) => {
                      textId = id;
                      textStarted = true;
                    },
                    onTextDelta: (delta) => {
                      if (!textStarted) {
                        enqueue({ type: "text-start", id: crypto.randomUUID() });
                        textStarted = true;
                      }
                      enqueue({ type: "text-delta", id: textId ?? crypto.randomUUID(), delta });
                    },
                    onToolInputStart: (id, toolName) => {
                      toolBuffers.set(id, { toolName, args: "" });
                      enqueue({ type: "tool-input-start", id, toolName });
                    },
                    onToolInputDelta: (id, delta) => {
                      const buf = toolBuffers.get(id);
                      if (buf) {
                        buf.args += delta;
                        enqueue({ type: "tool-input-delta", id, delta });
                      }
                    },
                    onToolInputEnd: (id) => {
                      toolBuffers.delete(id);
                      enqueue({ type: "tool-input-end", id });
                    },
                    setFinishReason: (reason) => {
                      finishReason = reason;
                    },
                    setUsage: (inTok, outTok) => {
                      inputTokens = inTok;
                      outputTokens = outTok;
                    },
                  });
                }

                // Завершаем незакрытые вызовы инструментов.
                if (!aborted) {
                  for (const [id] of toolBuffers) {
                    enqueue({ type: "tool-input-end", id });
                  }
                  toolBuffers.clear();

                  if (textStarted && textId) {
                    enqueue({ type: "text-end", id: textId });
                  }

                  enqueue({
                    type: "finish",
                    usage: { inputTokens, outputTokens, totalTokens: undefined },
                    finishReason,
                  });
                  ctrl.close();
                  closed = true;
                }
              } finally {
                try {
                  reader.releaseLock();
                } catch {}
                if (abortSignal) {
                  try {
                    abortSignal.removeEventListener("abort", abort);
                  } catch {}
                }
              }
            } catch (error) {
              if (!closed) {
                enqueue({ type: "error", error });
                ctrl.close();
                closed = true;
              }
            }
          })();
        },
        cancel() {
          abort();
        },
      });

      return { stream };
    },
  } as LanguageModelV2;
}

/** Обрабатывает одну строку SSE события OpenAI-совместимого провайдера. */
async function processSseLine(
  line: string,
  handlers: {
    enqueue: (part: LanguageModelV2StreamPart) => void;
    setTextId: (id: string) => void;
    onTextDelta: (delta: string) => void;
    onToolInputStart: (id: string, toolName: string) => void;
    onToolInputDelta: (id: string, delta: string) => void;
    onToolInputEnd: (id: string) => void;
    setFinishReason: (reason: LanguageModelV2FinishReason) => void;
    setUsage: (inputTokens: number | undefined, outputTokens: number | undefined) => void;
  },
): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  // Поддерживаем как `data: {...}`, так и просто JSON без префикса.
  let payload = trimmed;
  if (payload.startsWith("data: ")) payload = payload.slice(6);
  else if (payload.startsWith("data:")) payload = payload.slice(5);

  if (payload === "[DONE]") {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return;
  }

  const obj = parsed as {
    choices?: Array<{
      index?: number;
      delta?: { content?: string; role?: string; tool_calls?: unknown[] };
      finish_reason?: string;
    }>;
    usage?: unknown;
    id?: string;
    created?: number;
    model?: string;
  };
  const choice = obj.choices?.[0];
  if (!choice) return;

  const delta = choice.delta;
  if (delta) {
    if (typeof delta.content === "string" && delta.content.length > 0) {
      handlers.onTextDelta(delta.content);
    }

    const toolCalls = delta.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const rawCall of toolCalls) {
        const call = rawCall as
          | { index?: number; id?: string; function?: { name?: string; arguments?: string } }
          | undefined;
        if (!call) continue;
        const index = call.index ?? 0;
        const id = String(call.id ?? `call-${index}-${crypto.randomUUID()}`);
        const fn = call.function ?? {};
        const name = String(fn.name ?? "");
        const args = String(fn.arguments ?? "");

        if (!name) continue;

        const existing = toolBuffersGet(id);
        if (!existing) {
          toolBuffersSet(id, { toolName: name, args: "" });
          handlers.onToolInputStart(id, name);
        }
        if (args.length > 0) {
          const buf = toolBuffersGet(id);
          if (buf) {
            buf.args += args;
            handlers.onToolInputDelta(id, args);
          }
        }
      }
    }
  }

  if (typeof choice.finish_reason === "string") {
    handlers.setFinishReason(mapFinishReason(choice.finish_reason));
  }

  if (obj.usage && typeof obj.usage === "object") {
    const usage = obj.usage as { prompt_tokens?: number; completion_tokens?: number };
    handlers.setUsage(usage.prompt_tokens, usage.completion_tokens);
  }
}

/* Вспомогательные буферы инструментов в замыкании processSseLine. */
const toolBuffersStore: Map<string, { toolName: string; args: string }> = new Map();
function toolBuffersGet(id: string): { toolName: string; args: string } | undefined {
  return toolBuffersStore.get(id);
}
function toolBuffersSet(id: string, value: { toolName: string; args: string }): void {
  toolBuffersStore.set(id, value);
}
