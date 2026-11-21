const moscowHour = new Intl.DateTimeFormat("ru-RU", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Moscow",
});

/** UI greeting follows the same Moscow day as the live schedule clock. */
export function getHomeGreeting(now: number): string {
  const hour = Number(moscowHour.format(new Date(now)));

  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}
