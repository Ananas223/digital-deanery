import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Объединяет классы Tailwind: clsx собирает условные значения,
 * tailwind-merge убирает конфликтующие утилиты (последняя побеждает).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
