import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Заявки" };

export default function RequestsPage() {
  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <PageHeader title="Заявки" />
      <EmptyState
        icon={FileText}
        title="Раздел временно недоступен"
        description="Сейчас открыть или отправить заявку в кабинете нельзя. Вы можете вернуться на главную и продолжить работу с доступными разделами."
        action={
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            На главную
          </Link>
        }
      />
    </div>
  );
}
