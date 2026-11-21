import { NotificationFeedSkeleton } from "@/components/notifications/notification-feed-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <PageHeader title="Уведомления" compact />
      <NotificationFeedSkeleton />
    </div>
  );
}
