import { FileText } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Заявки",
};

/** Каркас раздела «Заявки и справки» (PRD Ф-04, US-06 — US-08). */
export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Заявки"
        description="Справки и заявления: тип, номер, дата, текущий статус и история обработки."
      />

      <EmptyState
        icon={FileText}
        title="Заявок пока нет"
        description="Здесь появятся ваши обращения в деканат и их статусы: «Новая», «В работе», «Готова», «Отклонена». Каталог типов и форма заявки откроются вместе с данными кабинета."
      />
    </div>
  );
}
