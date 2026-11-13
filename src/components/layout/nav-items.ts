import {
  Bell,
  CalendarDays,
  ChartColumnIncreasing,
  FileText,
  House,
  type LucideIcon,
} from "lucide-react";

type NavItemShape = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

/**
 * Основные разделы кабинета. Порядок совпадает для бокового меню,
 * нижней навигации и карточек на главном экране.
 * `href` — литералы существующих маршрутов (`typedRoutes`).
 */
export const primaryNav = [
  {
    href: "/",
    label: "Главная",
    icon: House,
    description: "Сводка дня: ближайшая пара, учёба, заявки и уведомления.",
  },
  {
    href: "/schedule",
    label: "Расписание",
    icon: CalendarDays,
    description: "Занятия на сегодня и на неделю: время, аудитория, преподаватель, изменения.",
  },
  {
    href: "/grades",
    label: "Успеваемость",
    icon: ChartColumnIncreasing,
    description: "Оценки по семестрам, сессия, зачётные единицы и задолженности.",
  },
  {
    href: "/requests",
    label: "Заявки",
    icon: FileText,
    description: "Справки и заявления: номер, статус и история обработки.",
  },
  {
    href: "/notifications",
    label: "Уведомления",
    icon: Bell,
    description: "Объявления деканата, изменения расписания, дедлайны и статусы заявок.",
  },
] as const satisfies readonly NavItemShape[];

export type NavItem = (typeof primaryNav)[number];

/** Активный раздел: точное совпадение для главной, префикс — для вложенных адресов. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
