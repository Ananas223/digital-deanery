"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import { LessonDetailsContent } from "@/components/schedule/lesson-details-content";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { LessonDetailsView } from "@/lib/ui/schedule-details";

export type LessonDetailsContextValue = {
  readonly panelActive: boolean;
  openLesson: (lessonId: string, trigger: HTMLAnchorElement) => boolean;
};

const LessonDetailsContext = createContext<LessonDetailsContextValue | null>(null);

type DetailsState = { selectedId: string | null; open: boolean };
type DetailsAction =
  | { type: "select"; lessonId: string }
  | { type: "open-change"; open: boolean }
  | { type: "close-complete" };

function detailsReducer(state: DetailsState, action: DetailsAction): DetailsState {
  switch (action.type) {
    case "select":
      return { selectedId: action.lessonId, open: true };
    case "open-change":
      return { ...state, open: action.open };
    case "close-complete":
      // A completed close must not clear a lesson opened in the meantime.
      return state.open ? state : { selectedId: null, open: false };
  }
}

export function useLessonDetails(): LessonDetailsContextValue | null {
  return useContext(LessonDetailsContext);
}

/** A local modal selection; lesson presentation is always read from the current props. */
export function LessonDetailsProvider({
  lessons,
  children,
}: {
  lessons: LessonDetailsView[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(detailsReducer, { selectedId: null, open: false });
  const triggerRef = useRef<HTMLAnchorElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const selected = lessons.find((lesson) => lesson.id === state.selectedId) ?? null;

  const openLesson = useCallback(
    (lessonId: string, trigger: HTMLAnchorElement) => {
      if (!lessons.some((lesson) => lesson.id === lessonId)) return false;
      triggerRef.current = trigger;
      dispatch({ type: "select", lessonId });
      return true;
    },
    [lessons],
  );
  const panelActive = state.selectedId !== null;
  const context = useMemo(() => ({ openLesson, panelActive }), [openLesson, panelActive]);

  return (
    <LessonDetailsContext.Provider value={context}>
      {children}
      <BaseDialog.Root
        open={state.open && selected !== null}
        modal={true}
        onOpenChange={(open) => dispatch({ type: "open-change", open })}
        onOpenChangeComplete={(open) => {
          if (!open) dispatch({ type: "close-complete" });
        }}
      >
        {selected ? (
          <BaseDialog.Portal>
            <BaseDialog.Backdrop
              data-lesson-details-backdrop=""
              className="fixed inset-0 z-50 bg-overlay data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-(--duration-panel) motion-safe:ease-interface"
            />
            <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-end justify-end overflow-clip overscroll-contain">
              <BaseDialog.Popup
                data-lesson-details-panel={selected.id}
                initialFocus={closeRef}
                finalFocus={triggerRef}
                className="overlay-surface relative flex max-h-[92dvh] w-full max-w-full min-w-0 flex-col overflow-hidden overscroll-contain rounded-t-xl bg-card text-card-foreground shadow-popover motion-safe:transition-transform motion-safe:duration-(--duration-panel) motion-safe:ease-interface motion-safe:data-[ending-style]:translate-y-full motion-safe:data-[starting-style]:translate-y-full md:h-dvh md:max-h-dvh md:w-144 md:rounded-none md:motion-safe:data-[ending-style]:translate-x-full md:motion-safe:data-[ending-style]:translate-y-0 md:motion-safe:data-[starting-style]:translate-x-full md:motion-safe:data-[starting-style]:translate-y-0"
              >
                <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-card px-4 py-4 md:px-6 md:py-6">
                  <div className="flex items-start gap-4">
                    <BaseDialog.Title className="min-w-0 flex-1 text-2xl leading-snug font-semibold tracking-tight wrap-anywhere md:text-3xl">
                      {selected.title}
                    </BaseDialog.Title>
                    <BaseDialog.Close
                      ref={closeRef}
                      aria-label="Закрыть подробности"
                      className={buttonVariants({ variant: "ghost", size: "icon" })}
                    >
                      <X aria-hidden="true" className="size-5" />
                    </BaseDialog.Close>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <BaseDialog.Description className="text-meta text-muted-foreground">
                      <time dateTime={selected.startsAtIso}>{selected.dateLabel}</time>
                    </BaseDialog.Description>
                    <Badge variant={selected.cancelled ? "danger" : "neutral"}>
                      {selected.cancelled ? "Отменено" : selected.typeLabel}
                    </Badge>
                  </div>
                </header>
                <div
                  data-lesson-details-scroll=""
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 focus-visible:-outline-offset-2 md:px-6"
                  role="region"
                  tabIndex={0}
                  aria-label="Сведения о занятии"
                >
                  <LessonDetailsContent lesson={selected} />
                </div>
                <footer className="sticky bottom-0 shrink-0 border-t border-border bg-card px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6">
                  <Link
                    href={selected.disciplineHref}
                    className={buttonVariants({ variant: "primary", size: "md" }) + " w-full"}
                  >
                    Успеваемость по дисциплине
                  </Link>
                </footer>
              </BaseDialog.Popup>
            </BaseDialog.Viewport>
          </BaseDialog.Portal>
        ) : null}
      </BaseDialog.Root>
    </LessonDetailsContext.Provider>
  );
}
