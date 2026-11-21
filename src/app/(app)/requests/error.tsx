"use client";

import { ErrorBoundaryReporter } from "@/components/ui/error-boundary-reporter";
import { ErrorState } from "@/components/ui/error-state";
import { useErrorRetry } from "@/components/ui/use-error-retry";

export default function RequestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useErrorRetry(reset);

  return (
    <>
      <ErrorBoundaryReporter digest={error.digest} />
      <ErrorState
        title="Не удалось загрузить заявки"
        description="Проверьте подключение и попробуйте ещё раз."
        onRetry={retry}
      />
    </>
  );
}
