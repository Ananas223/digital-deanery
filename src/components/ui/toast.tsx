"use client";

import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastProviderProps = {
  children: React.ReactNode;
  /** Сколько миллисекунд тост остаётся на экране. */
  timeout?: number;
};

/**
 * Провайдер всплывающих уведомлений на Base UI.
 * Тост дублируется текстом, закрывается кнопкой и не блокирует страницу.
 */
export function ToastProvider({ children, timeout = 6000 }: ToastProviderProps) {
  return (
    <Toast.Provider timeout={timeout} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport
          aria-label="Уведомления кабинета"
          className="pointer-events-none fixed inset-x-4 bottom-20 z-50 mx-auto flex w-auto max-w-sm flex-col gap-2 outline-none md:right-6 md:bottom-6 md:left-auto md:mx-0"
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts, close } = Toast.useToastManager();

  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={cn(
        "pointer-events-auto w-full rounded-card border border-border bg-card p-3 text-card-foreground shadow-popover transition-opacity duration-150",
        "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
      )}
    >
      <Toast.Content className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <Toast.Title className="text-sm font-semibold text-foreground" />
          <Toast.Description className="text-sm text-muted-foreground" />
        </div>
        {/* Обычная кнопка вместо Toast.Close: Base UI скрывает свою кнопку от скринридера,
            пока тост не получил фокус. */}
        <button
          type="button"
          aria-label="Закрыть уведомление"
          onClick={() => close(toast.id)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </Toast.Content>
    </Toast.Root>
  ));
}

/** Менеджер тостов: `add({ title, description })`. */
export function useToast() {
  return Toast.useToastManager();
}
