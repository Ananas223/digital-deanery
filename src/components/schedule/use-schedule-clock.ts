"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { LessonPosition } from "@/components/schedule/lesson-item";
import { getMoscowDateKey } from "@/lib/domain/schedule-time";
import type { ScheduleLessonView } from "@/lib/ui/schedule-presentation";

/** Clock is local UI state; schedule data remains unchanged server props. */
export function useScheduleClock(initialNow: number): number {
  const [now, setNow] = useState(initialNow);
  const lastDay = useRef(getMoscowDateKey(new Date(initialNow)));
  const router = useRouter();

  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "hidden") return;
      const timestamp = Date.now();
      setNow(timestamp);
      const day = getMoscowDateKey(new Date(timestamp));
      if (day !== lastDay.current) {
        lastDay.current = day;
        router.refresh();
      }
    };
    const timer = window.setInterval(update, 15_000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [router]);

  return now;
}

export function lessonPositions(
  lessons: ScheduleLessonView[],
  date: string,
  now: number,
): Map<string, LessonPosition> {
  const isToday = date === getMoscowDateKey(new Date(now));
  const scheduled = lessons.filter((lesson) => !lesson.cancelled);
  const current = isToday
    ? scheduled.find((lesson) => lesson.startsAt <= now && now < lesson.endsAt)
    : undefined;
  const next = isToday ? scheduled.find((lesson) => lesson.startsAt > now) : undefined;

  return new Map<string, LessonPosition>(
    lessons.map((lesson) => [
      lesson.id,
      lesson.id === current?.id
        ? "current"
        : lesson.id === next?.id
          ? "next"
          : !lesson.cancelled && lesson.endsAt <= now
            ? "past"
            : isToday && !lesson.cancelled
              ? "later"
              : "planned",
    ]),
  );
}
