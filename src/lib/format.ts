/**
 * Единые правила отображения дат, времени и чисел (`AGENTS.md` § 4.4).
 * Локаль — `ru-RU`, часовой пояс — `Europe/Moscow`, время — 24 часа.
 */

const LOCALE = "ru-RU";
const TIME_ZONE = "Europe/Moscow";
const EMPTY_VALUE = "—";

function toValidDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Дата в формате `ДД.ММ.ГГГГ` (по Москве). */
export function formatDate(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toValidDate(value);
  if (!date) {
    return EMPTY_VALUE;
  }

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
    ...options,
  }).format(date);
}

/** Дата и время в формате `ДД.ММ.ГГГГ, ЧЧ:ММ` (по Москве). */
export function formatDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toValidDate(value);
  if (!date) {
    return EMPTY_VALUE;
  }

  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
    ...options,
  }).format(date);
}

/** Число в русской локали: разделитель групп разрядов и десятичная запятая. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat(LOCALE, options).format(value);
}

/** Первое слово имени для приветствия: «Анна» из «Анна Петрова». */
export function getFirstName(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);
  return first && first.length > 0 ? first : fullName;
}

/** Инициалы для аватара: «АП» из «Анна Петрова». */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  const first = parts[0]?.charAt(0) ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";

  return `${first}${second}`.toLocaleUpperCase(LOCALE);
}
