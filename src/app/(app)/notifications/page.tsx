import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Уведомления" };

export default function NotificationsPage() {
  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <PageHeader title="Уведомления" />
      <EmptyState
        icon={Bell}
        title="Раздел временно недоступен"
        description="Сейчас лента уведомлений недоступна. Вы можете вернуться на главную и продолжить работу с доступными разделами."
        action={
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            На главную
          </Link>
        }
      />
    </div>
  );
}
