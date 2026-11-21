"use client";

import { ScheduleErrorPanel } from "@/components/schedule/schedule-error-panel";

export default function ScheduleError({ retry }: { retry: () => void }) {
  return <ScheduleErrorPanel retry={retry} />;
}
