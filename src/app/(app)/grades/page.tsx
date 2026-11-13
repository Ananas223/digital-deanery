import { ChartColumnIncreasing } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Успеваемость",
};

/** Каркас раздела «Успеваемость» (PRD Ф-03, US-04, US-05). */
export default function GradesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Успеваемость"
        description="Оценки по семестрам, форма контроля, зачётные единицы, сессия и задолженности."
      />

      <EmptyState
        icon={ChartColumnIncreasing}
        title="Оценок пока нет"
        description="Здесь появятся дисциплины семестра с оценками и статусами «зачёт», «незачёт», «не выставлено», а также расписание сессии и сводка задолженностей."
      />
    </div>
  );
}
