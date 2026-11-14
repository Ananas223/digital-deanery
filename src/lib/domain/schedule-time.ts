/**
 * Московское время и учебные границы дня и недели.
 *
 * В базе занятия хранятся как UTC-инстанты (`AGENTS.md` § 2.4), а студент видит
 * московское время. Москва живёт в UTC+3 и с 2014 года не переходит на летнее
 * время, поэтому смещение фиксировано: границы считаются без внешних библиотек.
 *
 * Модуль намеренно не помечен `server-only`: те же функции нужны интерфейсу
 * недели для подписей дней и перехода по неделям.
 */

export const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const SEPTEMBER_INDEX = 8;

function toMoscowShifted(date: Date): Date {
  return new Date(date.getTime() + MOSCOW_UTC_OFFSET_MS);
}

/** День недели по Москве: 0 — воскресенье, 1 — понедельник. */
export function getMoscowWeekday(date: Date): number {
  return toMoscowShifted(date).getUTCDay();
}

/** Календарная дата по Москве в формате `ГГГГ-ММ-ДД`. */
export function getMoscowDateKey(date: Date): string {
  const shifted = toMoscowShifted(date);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** Начало московских суток (00:00) как UTC-инстант. */
export function startOfMoscowDay(date: Date): Date {
  const shifted = toMoscowShifted(date);
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );

  return new Date(utcMidnight - MOSCOW_UTC_OFFSET_MS);
}

/**
 * Сдвигает инстант на целое число московских суток.
 * Перехода на летнее время в Москве нет, поэтому сутки всегда равны 24 часам.
 */
export function addMoscowDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Начало московской недели (понедельник, 00:00) как UTC-инстант. */
export function startOfMoscowWeek(date: Date): Date {
  const dayStart = startOfMoscowDay(date);
  const daysSinceMonday = (getMoscowWeekday(dayStart) + 6) % 7;

  return addMoscowDays(dayStart, -daysSinceMonday);
}

/** Начало учебного года: понедельник недели, в которую попадает 1 сентября. */
export function getAcademicYearStart(date: Date): Date {
  const shifted = toMoscowShifted(date);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const startYear = month >= SEPTEMBER_INDEX ? year : year - 1;
  const septemberFirst = new Date(Date.UTC(startYear, SEPTEMBER_INDEX, 1) - MOSCOW_UTC_OFFSET_MS);

  return startOfMoscowWeek(septemberFirst);
}

/**
 * Номер учебной недели: 1 — неделя, содержащая 1 сентября.
 *
 * Семестр появится в `P3-BE-01`; до этого точкой отсчёта служит начало учебного
 * года. Необязательный `semesterStart` позволит позже передать реальное начало
 * семестра, не меняя сигнатуры запросов расписания. Даты до точки отсчёта
 * относятся к первой неделе, чтобы номер всегда был положительным.
 */
export function getStudyWeekNumber(date: Date, semesterStart?: Date): number {
  const weekStart = startOfMoscowWeek(date);
  const reference = startOfMoscowWeek(semesterStart ?? getAcademicYearStart(date));
  const weeks = Math.round((weekStart.getTime() - reference.getTime()) / WEEK_MS);

  return Math.max(1, weeks + 1);
}
