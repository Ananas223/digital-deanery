import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NotificationFeed } from "@/components/notifications/notification-feed";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getNotifications } from "@/lib/actions/notifications";
import { getCurrentUser } from "@/lib/auth/session";
import type { NotificationPage } from "@/lib/domain/notifications";
import { notificationFilterSchema } from "@/lib/validation/notifications";

export const metadata: Metadata = { title: "Уведомления" };

type PageProps = { searchParams: Promise<{ category?: string | string[] }> };

export default async function NotificationsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fnotifications");

  if (user.role !== "STUDENT") {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader title="Уведомления" />
        <EmptyState
          icon={Bell}
          title="Лента доступна в кабинете студента"
          description="Работа с обращениями студентов находится в разделе заявок."
          action={
            <Link href="/requests" className={buttonVariants({ variant: "outline" })}>
              Открыть заявки
            </Link>
          }
        />
      </div>
    );
  }

  const query = await searchParams;
  const parsed = notificationFilterSchema.safeParse({ category: query.category });
  const filter = parsed.success ? parsed.data : { category: "ALL" as const };
  let initialPage: NotificationPage | null = null;
  try {
    initialPage = await getNotifications(filter);
  } catch {
    // The feed keeps a retry action while the authenticated shell remains usable.
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Уведомления"
        description="Объявления и изменения, которые касаются вас."
        compact
      />
      <NotificationFeed
        key={filter.category}
        category={filter.category}
        initialPage={initialPage}
      />
    </div>
  );
}
