import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GradesError from "@/app/(app)/grades/error";
import GradesLoading from "@/app/(app)/grades/loading";
import NotificationsError from "@/app/(app)/notifications/error";
import NotificationsLoading from "@/app/(app)/notifications/loading";
import RequestCardPage from "@/app/(app)/requests/[id]/page";
import RequestsError from "@/app/(app)/requests/error";
import RequestsLoading from "@/app/(app)/requests/loading";
import ScheduleError from "@/app/(app)/schedule/error";
import ScheduleLoading from "@/app/(app)/schedule/loading";
import {
  DashboardOverview,
  DashboardOverviewSkeleton,
  DashboardQuickActions,
} from "@/components/dashboard/dashboard-overview";
import { TodayOverview, TodayOverviewSkeleton } from "@/components/dashboard/today-overview";
import { NotificationFeed } from "@/components/notifications/notification-feed";
import type { DashboardData } from "@/lib/domain/dashboard";
import type { NotificationPage } from "@/lib/domain/notifications";
import type { RequestDetail } from "@/lib/domain/requests";

// Fixtures stop at the UI boundary; the interactive E2E suite still uses the real app and database.
const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  today: vi.fn(),
  request: vi.fn(),
  currentUser: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/domain/dashboard", () => ({ getDashboardData: mocks.dashboard }));
vi.mock("@/lib/domain/schedule", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/domain/schedule")>()),
  getTodaySchedule: mocks.today,
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/lib/actions/requests", () => ({
  getRequest: mocks.request,
  cancelRequest: vi.fn(),
  transitionRequestStatus: vi.fn(),
}));
vi.mock("@/lib/actions/notifications", () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const NOW = new Date("2026-11-21T09:00:00.000Z");
const PROPS = { userId: "ui-fixture-student", now: NOW };
const unavailable = new Error("private fixture error");
const emptyDashboard: DashboardData = {
  student: null,
  nearestLesson: null,
  gradesSummary: null,
  nearestExam: null,
  activeRequests: [],
  unreadNotifications: { count: 0, items: [] },
  unavailable: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  // The standalone Vitest transform may emit classic JSX for components built by Next.
  vi.stubGlobal("React", React);
});
afterEach(() => vi.unstubAllGlobals());

describe("Состояния основных разделов", () => {
  it.each([
    { Loading: ScheduleLoading, label: "Загружаем расписание" },
    { Loading: GradesLoading, label: "Загружаем успеваемость" },
    { Loading: RequestsLoading, label: "Загружаем заявки" },
    { Loading: NotificationsLoading, label: "Загружаем уведомления" },
    { Loading: DashboardOverviewSkeleton, label: "Загружаем сводку" },
    { Loading: TodayOverviewSkeleton, label: "Загружаем расписание", surface: "главная" },
  ])("$label: скелетон не озвучивается", ({ Loading, label }) => {
    const html = renderToStaticMarkup(React.createElement(Loading));
    expect(html).toContain('role="status"');
    expect(html).toContain(label);
    expect(html).toContain('aria-hidden="true"');
  });

  it.each([
    { ErrorView: ScheduleError, title: "Не удалось загрузить расписание" },
    { ErrorView: GradesError, title: "Не удалось открыть успеваемость" },
    { ErrorView: RequestsError, title: "Не удалось загрузить заявки" },
    { ErrorView: NotificationsError, title: "Уведомления не загрузились" },
  ])("$title: предлагает повтор без внутренних деталей", ({ ErrorView, title }) => {
    const props = { error: unavailable, retry: vi.fn() };
    const html = renderToStaticMarkup(React.createElement(() => ErrorView(props)));
    expect(html).toContain('role="alert"');
    expect(html).toContain(title);
    expect(html).toContain("Повторить");
    expect(html).not.toContain(unavailable.message);
  });

  it("отличает пустую категорию уведомлений от ошибки", () => {
    const empty: NotificationPage = { items: [], unreadCount: 0, nextCursor: null };
    const render = (initialPage: NotificationPage | null) =>
      renderToStaticMarkup(
        React.createElement(NotificationFeed, { initialPage, category: "REQUESTS" }),
      );

    expect(render(empty)).toContain("В этой категории пока нет уведомлений");
    expect(render(empty)).toContain('href="/notifications"');
    expect(render(null)).toContain("Уведомления не загрузились");
    expect(render(null)).toContain("Повторить");
    expect(render(null)).not.toContain("В этой категории пока нет уведомлений");
  });
});

describe("Сводка главной", () => {
  it("объясняет пустые блоки и сохраняет маршруты", async () => {
    mocks.dashboard.mockResolvedValue(emptyDashboard);
    mocks.today.mockResolvedValue({ date: "2026-11-21", startsAt: NOW, lessons: [] });

    const summary = renderToStaticMarkup(await DashboardOverview(PROPS));
    expect(summary).toContain("За семестр пока нет данных об оценках.");
    expect(summary).toContain("Ближайших экзаменов и зачётов нет.");
    expect(summary).toContain("Активных заявок нет.");
    expect(summary).toContain("Непрочитанных нет.");
    expect(summary).toContain("Учебные сведения не найдены");
    for (const href of ["/grades", "/requests", "/requests/new", "/notifications", "/profile"]) {
      expect(summary).toContain(`href="${href}"`);
    }
    const today = renderToStaticMarkup(await TodayOverview(PROPS));
    expect(today).toContain("На сегодня занятий нет");
    expect(today).toContain('href="/schedule?view=week"');
  });

  it.each([
    {
      unavailable: ["activeRequests"],
      error: "Заявки не загрузились",
      empty: "Активных заявок нет.",
    },
    {
      unavailable: ["gradesSummary", "nearestExam"],
      error: "Учёба не загрузилась",
      empty: "За семестр пока нет данных об оценках.",
    },
    {
      unavailable: ["unreadNotifications"],
      error: "Уведомления не загрузились",
      empty: "Непрочитанных нет.",
    },
  ] satisfies { unavailable: DashboardData["unavailable"]; error: string; empty: string }[])(
    "$error не превращается в ноль и не убирает остальные разделы",
    async ({ unavailable: missing, error, empty }) => {
      mocks.dashboard.mockResolvedValue({ ...emptyDashboard, unavailable: missing });
      const html = renderToStaticMarkup(await DashboardOverview(PROPS));
      expect(html).toContain(error);
      expect(html).toContain("Повторить");
      expect(html).not.toContain(empty);
      expect(html).toContain(`<section aria-label="${error}"`);
      expect((html.match(/role="region"/g) ?? []).length).toBe(2);
      for (const href of ["/grades", "/requests", "/notifications"]) {
        expect(html).toContain(`href="${href}"`);
      }
    },
  );

  it("ошибка расписания оставляет быстрые действия и сводку независимыми", async () => {
    mocks.today.mockRejectedValue(unavailable);
    mocks.dashboard.mockResolvedValue(emptyDashboard);
    const today = renderToStaticMarkup(await TodayOverview(PROPS));
    const summary = renderToStaticMarkup(await DashboardOverview(PROPS));
    const quick = renderToStaticMarkup(React.createElement(DashboardQuickActions));
    expect(today).toContain("Расписание не загрузилось");
    expect(today).toContain("Повторить");
    expect(today).not.toContain(unavailable.message);
    expect(summary).toContain("Непрочитанных нет.");
    expect(quick).toContain('href="/requests/new"');
  });
});

describe("Несогласованный снимок заявки", () => {
  const mixed: RequestDetail = {
    id: "ui-fixture-request",
    number: "З-2026-900001",
    typeCode: "STUDY_CERTIFICATE",
    typeTitle: "Справка об обучении",
    status: "NEW",
    createdAt: NOW,
    dueAt: null,
    rejectionReason: null,
    payload: { deliveryPlace: "Тестовая библиотека" },
    history: [
      {
        id: "1",
        fromStatus: null,
        toStatus: "NEW",
        comment: null,
        changedByName: null,
        createdAt: NOW,
      },
      {
        id: "2",
        fromStatus: "NEW",
        toStatus: "IN_PROGRESS",
        comment: null,
        changedByName: null,
        createdAt: NOW,
      },
    ],
    canCancel: true,
    student: null,
    assignedToName: null,
    allowedTransitions: ["IN_PROGRESS"],
    disciplineName: null,
  };

  it("при свежем согласованном ответе показывает карточку без устаревшей отмены", async () => {
    mocks.currentUser.mockResolvedValue({ role: "STUDENT" });
    mocks.request.mockResolvedValueOnce(mixed).mockResolvedValueOnce({
      ...mixed,
      status: "IN_PROGRESS",
      canCancel: false,
    });
    const html = renderToStaticMarkup(
      await RequestCardPage({ params: Promise.resolve({ id: mixed.id }) }),
    );
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(mocks.request).toHaveBeenNthCalledWith(2, mixed.id);
    expect(html).toContain("В работе");
    expect(html).toContain("История обработки");
    expect(html).not.toContain("Отменить заявку");
  });

  it.each(["STUDENT", "DEAN_EMPLOYEE"])(
    "%s не видит действий при повторном расхождении",
    async (role) => {
      mocks.currentUser.mockResolvedValue({ role });
      mocks.request.mockResolvedValue(mixed);
      const html = renderToStaticMarkup(
        await RequestCardPage({ params: Promise.resolve({ id: mixed.id }) }),
      );
      expect(mocks.request).toHaveBeenCalledTimes(2);
      expect(html).toContain("Статус заявки обновляется");
      expect(html).toContain("Обновить карточку");
      expect(html).not.toContain("Отменить заявку");
      expect(html).not.toContain("Изменить статус");
    },
  );
});
