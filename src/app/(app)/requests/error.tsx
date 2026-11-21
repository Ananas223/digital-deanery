"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function RequestsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Не удалось загрузить заявки"
      description="Проверьте подключение и попробуйте ещё раз."
      onRetry={reset}
    />
  );
}
