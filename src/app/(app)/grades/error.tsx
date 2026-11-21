"use client";

import { ErrorBoundaryReporter } from "@/components/ui/error-boundary-reporter";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { useErrorRetry } from "@/components/ui/use-error-retry";

export default function GradesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retry = useErrorRetry(reset);

  return (
    <div className="min-w-0 space-y-6">
      <ErrorBoundaryReporter digest={error.digest} />
      <PageHeader title="Успеваемость" />
      <ErrorState
        title="Не удалось открыть успеваемость"
        description="Попробуйте ещё раз. Выбранные семестр, раздел и дисциплина сохранятся в адресе страницы."
        onRetry={retry}
      />
    </div>
  );
}
