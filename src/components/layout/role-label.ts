const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Студент",
  DEAN_EMPLOYEE: "Сотрудник деканата",
};

/** Понятная подпись роли; неизвестная роль не раскрывает внутренних кодов. */
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? "Пользователь кабинета";
}
