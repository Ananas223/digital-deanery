import { addMoscowDays, getMoscowDateKey, getMoscowWeekday } from "./schedule-time";

/**
 * Рабочие дни для срока подготовки заявки.
 *
 * Срок считается по московскому календарю: суббота и воскресенье не входят.
 * Москва не переходит на летнее время, поэтому сутки всегда равны 24 часам.
 */
export function addMoscowWorkingDays(from: Date, workingDays: number): Date {
  if (!Number.isInteger(workingDays) || workingDays < 0) {
    throw new RangeError("Количество рабочих дней должно быть неотрицательным целым числом.");
  }

  let result = new Date(from);
  let added = 0;

  while (added < workingDays) {
    result = addMoscowDays(result, 1);
    const weekday = getMoscowWeekday(result);

    if (weekday !== 0 && weekday !== 6) {
      added += 1;
    }
  }

  return result;
}

/** Год по московскому календарю — для номера заявки. */
export function getMoscowYear(date: Date): number {
  return Number(getMoscowDateKey(date).slice(0, 4));
}
