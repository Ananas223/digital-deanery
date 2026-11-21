"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ArrowUp, RotateCcw, Square, Trash2, X } from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AI_MAX_TOTAL_CHARS } from "@/lib/validation/ai";

import { useAssistant } from "./assistant-context";
import { AssistantMessage } from "./assistant-message";
import { BlikMascot, type BlikState } from "./blik-mascot";

const QUESTIONS = ["Что у меня сегодня?", "Есть ли долги по учёбе?", "Что с моими заявками?"];
const SECTIONS = [
  { href: "/schedule", label: "Расписание" },
  { href: "/grades", label: "Учёба" },
  { href: "/requests", label: "Заявки" },
  { href: "/notifications", label: "Уведомления" },
] as const;

/** Track the visible mobile viewport so a keyboard cannot cover the composer. */
function useVisualViewport(open: boolean): CSSProperties | undefined {
  const [viewportStyle, setViewportStyle] = useState<CSSProperties>();
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport) return;
    const update = () => {
      setViewportStyle(
        window.innerWidth < 768 ? { height: viewport.height, top: viewport.offsetTop } : undefined,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [open]);
  return viewportStyle;
}

export function AssistantPanel({
  finalFocus,
  onOpenChange,
}: {
  finalFocus: () => HTMLElement | false;
  onOpenChange: (open: boolean, reason: string) => void;
}) {
  const assistant = useAssistant();
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLElement | null>(null);
  const followLatestRef = useRef(true);
  const viewportStyle = useVisualViewport(assistant.open);
  const busy = assistant.phase === "waiting" || assistant.phase === "streaming";
  const mascotState: BlikState = busy
    ? "thinking"
    : assistant.phase === "complete"
      ? "success"
      : assistant.error
        ? "error"
        : "idle";
  const status = busy
    ? "Готовлю ответ"
    : assistant.phase === "complete"
      ? "Ответ готов"
      : assistant.phase === "stopped"
        ? "Ответ остановлен"
        : "Помощник по кабинету";

  useEffect(() => {
    if (!assistant.open || !followLatestRef.current) return;
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [assistant.messages, assistant.open]);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    const composer = composerRef.current;
    if (!assistant.open || !field || !composer || document.activeElement !== field) return;
    const fieldRect = field.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    if (fieldRect.bottom > composerRect.bottom) {
      composer.scrollTop += fieldRect.bottom - composerRect.bottom;
    } else if (fieldRect.top < composerRect.top) {
      composer.scrollTop -= composerRect.top - fieldRect.top;
    }
  }, [assistant.open, viewportStyle]);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy && assistant.draft.trim()) {
      fieldRef.current?.focus({ preventScroll: true });
      followLatestRef.current = true;
      void assistant.sendQuestion();
    }
  }

  if (!assistant.enabled) return null;

  return (
    <BaseDialog.Root
      open={assistant.open}
      modal={false}
      onOpenChange={(open, details) => onOpenChange(open, details.reason)}
    >
      <BaseDialog.Portal>
        <BaseDialog.Viewport
          style={viewportStyle}
          className="pointer-events-none fixed inset-0 z-40 h-dvh overflow-clip"
        >
          <BaseDialog.Popup
            id="assistant-panel"
            data-assistant-panel=""
            initialFocus={() =>
              window.matchMedia("(pointer: coarse)").matches ? closeRef.current : fieldRef.current
            }
            finalFocus={finalFocus}
            className="overlay-surface pointer-events-auto absolute inset-x-0 top-0 bottom-bottom-safe flex min-h-0 min-w-0 flex-col overflow-hidden border-border bg-card text-card-foreground shadow-popover motion-safe:transition-transform motion-safe:duration-(--duration-panel) motion-safe:ease-interface motion-safe:data-[ending-style]:translate-x-full motion-safe:data-[starting-style]:translate-x-full md:inset-x-auto md:right-0 md:bottom-0 md:w-144 md:border-l"
          >
            <header className="max-h-[35%] shrink-0 overflow-y-auto border-b border-border px-4 py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-2">
                <BlikMascot state={mascotState} className="size-16" />
                <div className="min-w-0 flex-1">
                  <BaseDialog.Title className="text-xl font-semibold tracking-tight">
                    Блик
                  </BaseDialog.Title>
                  <p className="mt-0.5 text-caption text-muted-foreground">{status}</p>
                </div>
                <BaseDialog.Close
                  ref={closeRef}
                  aria-label="Закрыть Блика"
                  className={buttonVariants({ variant: "ghost", size: "icon" })}
                >
                  <X aria-hidden="true" className="size-5" />
                </BaseDialog.Close>
              </div>
              <BaseDialog.Description className="mt-2 text-caption text-muted-foreground">
                Читаю только ваши данные. Не создаю и не меняю заявки, оценки и уведомления.
              </BaseDialog.Description>
            </header>

            <div
              ref={historyRef}
              data-assistant-history=""
              role="region"
              tabIndex={0}
              aria-label="Диалог с Бликом"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              onScroll={(event) => {
                const history = event.currentTarget;
                followLatestRef.current =
                  history.scrollHeight - history.scrollTop - history.clientHeight < 48;
              }}
            >
              <div className="px-4 py-5 md:px-6">
                {assistant.messages.length === 0 ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg leading-7 font-semibold text-foreground">
                        С чего начнём?
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Задайте вопрос о расписании, учёбе, заявках или уведомлениях.
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2">
                      {QUESTIONS.map((question) => (
                        <button
                          key={question}
                          type="button"
                          className={
                            buttonVariants({ variant: "outline", size: "sm" }) + " text-left"
                          }
                          onClick={() => {
                            assistant.setDraft(question);
                            fieldRef.current?.focus({ preventScroll: true });
                          }}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ol
                    aria-label="История диалога"
                    aria-live="off"
                    role="list"
                    className="space-y-5"
                  >
                    {assistant.messages.map((message) => (
                      <li
                        key={message.id}
                        className={
                          message.role === "user"
                            ? "ml-5 rounded-card bg-primary-muted p-4"
                            : "mr-2 border-l-2 border-border pl-4"
                        }
                      >
                        <p className="mb-2 text-caption font-semibold text-muted-foreground">
                          {message.role === "user" ? "Вы" : "Блик"}
                        </p>
                        <AssistantMessage
                          text={message.text}
                          onNavigate={() => assistant.closeAssistant(false)}
                        />
                      </li>
                    ))}
                  </ol>
                )}
                {busy ? (
                  <p className="mt-5 text-caption text-muted-foreground" aria-busy="true">
                    {status}…
                  </p>
                ) : null}
                {assistant.phase === "stopped" ? (
                  <p className="mt-4 text-caption text-muted-foreground">
                    Ответ остановлен. Можно повторить вопрос или задать новый.
                  </p>
                ) : null}
                <nav
                  aria-label="Разделы кабинета из помощника"
                  className="mt-5 flex flex-wrap gap-x-4 border-t border-border pt-3"
                >
                  {SECTIONS.map((section) => (
                    <Link
                      key={section.href}
                      href={section.href}
                      className="inline-flex min-h-11 items-center rounded-sm text-sm text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={() => assistant.closeAssistant(false)}
                    >
                      {section.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            <footer
              ref={composerRef}
              className="max-h-[60%] shrink-0 space-y-3 overflow-y-auto overscroll-contain border-t border-border bg-card px-4 py-3 md:px-6 md:pb-5"
            >
              {assistant.error ? (
                <div id="assistant-error">
                  <Alert tone="danger" className="gap-2 p-3 text-sm">
                    <p>{assistant.error.message}</p>
                  </Alert>
                </div>
              ) : null}
              {(assistant.error || assistant.phase === "stopped") && assistant.canRetry ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    followLatestRef.current = true;
                    void assistant.retry();
                  }}
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Повторить вопрос
                </Button>
              ) : null}
              <form onSubmit={submitQuestion} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="assistant-question" className="text-sm font-medium">
                    Ваш вопрос
                  </label>
                  <button
                    type="button"
                    disabled={busy || assistant.messages.length === 0}
                    aria-label="Очистить диалог"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-caption text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                    onClick={() => {
                      assistant.clear();
                      fieldRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Очистить
                  </button>
                </div>
                <Textarea
                  ref={fieldRef}
                  id="assistant-question"
                  name="question"
                  value={assistant.draft}
                  maxLength={AI_MAX_TOTAL_CHARS}
                  placeholder="Например, что у меня завтра первым?"
                  aria-describedby={
                    assistant.error
                      ? "assistant-question-hint assistant-error"
                      : "assistant-question-hint"
                  }
                  onChange={(event) => assistant.setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.nativeEvent.keyCode !== 229
                    ) {
                      event.preventDefault();
                      if (!busy) event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className="max-h-40 min-h-20 resize-y"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    id="assistant-question-hint"
                    className="max-w-64 text-caption text-muted-foreground"
                  >
                    Enter — отправить, Shift + Enter — новая строка.
                  </p>
                  <div className="ml-auto flex gap-2">
                    {busy ? (
                      <Button variant="outline" size="sm" onClick={assistant.stop}>
                        <Square aria-hidden="true" className="size-3" />
                        Остановить
                      </Button>
                    ) : null}
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Отправить вопрос"
                      disabled={busy || !assistant.draft.trim()}
                    >
                      <ArrowUp aria-hidden="true" className="size-5" />
                    </Button>
                  </div>
                </div>
              </form>
              <p className="text-caption text-muted-foreground">
                История исчезнет после перезагрузки страницы.
              </p>
            </footer>
            <p role="status" className="sr-only">
              {assistant.phase === "complete"
                ? "Ответ Блика готов."
                : assistant.phase === "stopped"
                  ? "Ответ Блика остановлен."
                  : ""}
            </p>
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
