import { AppError } from "@/lib/errors";

/**
 * Проверяет, что ресурс принадлежит текущему пользователю.
 *
 * Вызывается только в Server Actions и Route Handlers рядом с данными,
 * после получения `userId` из проверенной серверной сессии. При несовпадении
 * бросает `NOT_FOUND`, чтобы не раскрывать существование чужого ресурса.
 */
export function assertOwnership(ownerId: string, userId: string): void {
  if (ownerId !== userId) {
    throw new AppError("NOT_FOUND");
  }
}
