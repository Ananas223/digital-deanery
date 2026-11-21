import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "page-title",
            "brand-title",
            "lesson-title",
            "lesson-time",
            "lesson-room",
            "meta",
            "caption",
          ],
        },
      ],
    },
  },
});

/**
 * Объединяет классы Tailwind: clsx собирает условные значения,
 * tailwind-merge убирает конфликтующие утилиты (последняя побеждает).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
