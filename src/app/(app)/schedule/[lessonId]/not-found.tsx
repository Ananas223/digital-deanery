import { CalendarDays } from "lucide-react";

import { ScheduleReturnLink } from "@/components/schedule/schedule-return-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function LessonNotFound() {
  return (
    <div className="space-y-6">
      <ScheduleReturnLink />
      <PageHeader title="Занятие не найдено" className="border-0 pb-0" />
      <EmptyState
        icon={CalendarDays}
        title="Не удалось найти занятие"
        description="Возможно, ссылка устарела. Вернитесь к расписанию своей группы и выберите занятие ещё раз."
      />
    </div>
  );
}
