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
import { cn } from "@/lib/utils";
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

const KEYBOARD_INSET = "--assistant-keyboard-inset";
const MOBILE_NAV_HEIGHT = "--assistant-mobile-nav-height";

/** Keep the panel and the mobile navigation above the same visible viewport edge. */
function useAssistantViewport(open: boolean) {
  const [layout, setLayout] = useState<{ style: CSSProperties; compact: boolean }>();
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const mobileNav = document.querySelector<HTMLElement>("[data-mobile-navigation]");
    const updateNavHeight = () => {
      const height = mobileNav?.getBoundingClientRect().height ?? 0;
      if (height > 0) root.style.setProperty(MOBILE_NAV_HEIGHT, `${height}px`);
      else root.style.removeProperty(MOBILE_NAV_HEIGHT);
    };
    const observer = mobileNav ? new ResizeObserver(updateNavHeight) : null;
    if (mobileNav) observer?.observe(mobileNav);
    updateNavHeight();
    const update = () => {
      const mobile = window.innerWidth < 768;
      const gap = viewport ? window.innerHeight - viewport.height : 0;
      // The browser's toolbar and pinch zoom are not a docked keyboard.
      const compact = mobile && viewport?.scale === 1 && gap > 100;
      if (compact && viewport) {
        root.style.setProperty(KEYBOARD_INSET, `${Math.max(0, gap - viewport.offsetTop)}px`);
      } else {
        root.style.removeProperty(KEYBOARD_INSET);
      }
      setLayout(
        mobile
          ? { style: viewport ? { height: viewport.height, top: viewport.offsetTop } : {}, compact }
          : undefined,
      );
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      root.style.removeProperty(KEYBOARD_INSET);
      root.style.removeProperty(MOBILE_NAV_HEIGHT);
      observer?.disconnect();
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);
  return open ? layout : undefined;
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
  const viewport = useAssistantViewport(assistant.open);
  const compact = viewport?.compact === true;
  const feedbackInHistory = viewport !== undefined;
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
  }, [assistant.messages, assistant.error, assistant.open, compact]);

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
  }, [assistant.open, viewport]);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy && assistant.draft.trim()) {
      fieldRef.current?.focus({ preventScroll: true });
      followLatestRef.current = true;
      void assistant.sendQuestion();
    }
  }

  if (!assistant.enabled) return null;

  const feedback =
    assistant.error || (assistant.phase === "stopped" && assistant.canRetry) ? (
      <div className="space-y-3">
        {assistant.error ? (
          <div id="assistant-error">
            <Alert tone="danger" className="gap-2 p-3 text-sm">
              <p>{assistant.error.message}</p>
            </Alert>
          </div>
        ) : null}
        {assistant.canRetry ? (
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
      </div>
    ) : null;

  return (
    <BaseDialog.Root
      open={assistant.open}
      modal={false}
      // The nav moves when the panel closes. Let its tap finish before dismissing.
      disablePointerDismissal={compact}
      onOpenChange={(open, details) => onOpenChange(open, details.reason)}
    >
      <BaseDialog.Portal>
        <BaseDialog.Viewport
          style={viewport?.style}
          className="pointer-events-none fixed inset-0 z-40 h-dvh overflow-clip"
        >
          <BaseDialog.Popup
            id="assistant-panel"
            data-assistant-panel=""
            initialFocus={() =>
              window.innerWidth < 768 || window.matchMedia("(any-pointer: coarse)").matches
                ? closeRef.current
                : fieldRef.current
            }
            finalFocus={finalFocus}
            className="overlay-surface pointer-events-auto absolute inset-x-0 top-0 bottom-[var(--assistant-mobile-nav-height,var(--spacing-bottom-safe))] flex min-h-0 min-w-0 flex-col overflow-hidden border-border bg-card text-card-foreground shadow-popover motion-safe:transition-transform motion-safe:duration-(--duration-panel) motion-safe:ease-interface motion-safe:data-[ending-style]:translate-x-full motion-safe:data-[starting-style]:translate-x-full md:inset-x-auto md:right-0 md:bottom-0 md:w-144 md:border-l"
          >
            <header
              className={cn(
                "max-h-[35%] shrink-0 overflow-y-auto border-b border-border px-4 md:px-6 md:py-4",
                compact ? "py-1.5" : "py-3",
              )}
            >
              <div className="flex items-center gap-2">
                <BlikMascot state={mascotState} className={compact ? "size-10" : "size-16"} />
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
              <BaseDialog.Description
                className={compact ? "sr-only" : "mt-2 text-caption text-muted-foreground"}
              >
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
                {feedbackInHistory && feedback ? <div className="mt-4">{feedback}</div> : null}
              </div>
            </div>

            <footer
              ref={composerRef}
              className={cn(
                "max-h-[60%] shrink-0 space-y-3 overflow-y-auto overscroll-contain border-t border-border bg-card px-4 md:px-6 md:pb-5",
                compact ? "py-2" : "py-3",
              )}
            >
              {!feedbackInHistory ? feedback : null}
              <form
                onSubmit={submitQuestion}
                className={
                  compact ? "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2" : "space-y-2"
                }
              >
                <div
                  className={cn("flex items-center justify-between gap-3", compact && "col-span-2")}
                >
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
                  className={
                    compact ? "max-h-24 min-h-14 resize-none" : "max-h-40 min-h-20 resize-y"
                  }
                />
                <div
                  className={
                    compact ? "contents" : "flex flex-wrap items-center justify-between gap-2"
                  }
                >
                  <p
                    id="assistant-question-hint"
                    className={compact ? "sr-only" : "max-w-64 text-caption text-muted-foreground"}
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
              <p className={compact ? "sr-only" : "text-caption text-muted-foreground"}>
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
