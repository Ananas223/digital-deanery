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
        "flex flex-col items-start gap-3 rounded-card border border-danger/30 bg-danger-muted/70 p-5 sm:p-6",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-md bg-card text-danger-strong"
      >
        <TriangleAlert aria-hidden="true" className="size-5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
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
