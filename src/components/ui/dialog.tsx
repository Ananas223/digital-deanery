"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Модальное окно на Base UI: ловушка фокуса, закрытие по Escape и по клику вне окна,
 * обязательные заголовок и описание для скринридера.
 */
export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;

type DialogContentProps = {
  children: React.ReactNode;
  className?: string;
  /** Подпись кнопки закрытия для скринридера. */
  closeLabel?: string;
};

export function DialogContent({
  children,
  className,
  closeLabel = "Закрыть окно",
}: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-150" />
      <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto sm:items-center sm:p-6">
        <BaseDialog.Popup
          className={cn(
            "relative max-h-[calc(100dvh-2rem)] w-full min-w-0 overflow-y-auto rounded-t-xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-card-foreground shadow-popover data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-150 sm:max-w-md sm:rounded-card sm:p-6",
            className,
          )}
        >
          {children}
          <BaseDialog.Close
            aria-label={closeLabel}
            className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </BaseDialog.Close>
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-col gap-2 pr-12", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn("text-xl leading-7 font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-5 flex flex-wrap items-center justify-end gap-2", className)}
      {...props}
    />
  );
}
