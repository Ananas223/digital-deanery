"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ComponentProps } from "react";

import { useLessonDetails } from "@/components/schedule/lesson-details-provider";

type LessonDetailsTriggerProps = Omit<ComponentProps<"a">, "href"> & {
  lessonId: string;
  href: Route;
};

/** Ordinary activation opens local details; the canonical link remains a progressive fallback. */
export function LessonDetailsTrigger({
  lessonId,
  href,
  onClick,
  children,
  ...anchorProps
}: LessonDetailsTriggerProps) {
  const details = useLessonDetails();

  return (
    <Link
      {...anchorProps}
      href={href}
      data-lesson-trigger={lessonId}
      aria-haspopup={details ? "dialog" : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (event.currentTarget.target && event.currentTarget.target !== "_self") ||
          event.currentTarget.hasAttribute("download")
        ) {
          return;
        }
        if (details?.openLesson(lessonId, event.currentTarget)) event.preventDefault();
      }}
    >
      {children}
    </Link>
  );
}
