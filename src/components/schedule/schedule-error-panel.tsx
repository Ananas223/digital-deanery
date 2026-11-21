"use client";

import { ScheduleReturnLink } from "@/components/schedule/schedule-return-link";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";

type ScheduleErrorPanelProps = { retry: () => void; detail?: boolean };

export function ScheduleErrorPanel({ retry, detail = false }: ScheduleErrorPanelProps) {
  return (
    <div className="space-y-6">
      {detail ? <ScheduleReturnLink /> : null}
      <PageHeader title={detail ? "Занятие" : "Расписание"} className="border-0 pb-0" />
      <ErrorState
        title={detail ? "Не удалось открыть занятие" : "Не удалось загрузить расписание"}
        description="Попробуйте ещё раз. Выбранный день и неделя сохранятся."
        onRetry={retry}
      />
    </div>
  );
}
