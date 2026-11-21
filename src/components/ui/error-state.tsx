"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Состояние ошибки: что случилось, что делать и кнопка повтора.
 * Введённые данные не очищаются — повтор использует то же содержимое.
 */
export function ErrorState({
  title = "Не удалось загрузить данные",
  description = "Проверьте подключение к сети и попробуйте ещё раз. Введённые данные сохранятся.",
  onRetry,
  retryLabel = "Повторить",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-w-0 flex-col items-start gap-4 rounded-card border border-danger/30 bg-card p-4 sm:p-6",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-lg bg-danger-muted text-danger-strong"
      >
        <TriangleAlert aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 space-y-1.5">
        <h2 className="text-lg leading-6 font-semibold text-foreground">{title}</h2>
        <p className="max-w-prose text-base leading-6 text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
