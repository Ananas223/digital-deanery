import { Bell } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Уведомления",
};

/** Каркас раздела «Уведомления» (PRD Ф-05, US-09). */
export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Уведомления"
        description="Объявления деканата, изменения расписания, дедлайны и смена статуса заявок."
      />

      <EmptyState
        icon={Bell}
        title="Новых уведомлений нет"
        description="Здесь появится лента событий кабинета: важные объявления, переносы занятий, дедлайны и результаты по заявкам. Непрочитанные будут отмечены отдельно."
      />
    </div>
  );
}
