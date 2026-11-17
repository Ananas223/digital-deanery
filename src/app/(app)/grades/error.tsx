"use client";

import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";

type GradesErrorProps = { error: Error & { digest?: string }; reset: () => void };

export default function GradesError({ reset }: GradesErrorProps) {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Успеваемость" />
      <ErrorState
        title="Не удалось открыть успеваемость"
        description="Попробуйте ещё раз. Выбранные семестр, раздел и дисциплина сохранятся в адресе страницы."
        onRetry={reset}
      />
    </div>
  );
}
