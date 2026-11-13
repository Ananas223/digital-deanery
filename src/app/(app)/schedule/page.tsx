import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Расписание",
};

/** Каркас раздела «Расписание» (PRD Ф-02, US-02, US-03). */
export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Расписание"
        description="Занятия на сегодня и на неделю: время, дисциплина, тип занятия, преподаватель, аудитория и изменения."
      />

      <EmptyState
        icon={CalendarDays}
        title="Расписание ещё не загружено"
        description="Здесь появятся занятия на сегодня и на неделю, включая переносы и отмены. Данные приходят из демонстрационной базы деканата."
      />
    </div>
  );
}
