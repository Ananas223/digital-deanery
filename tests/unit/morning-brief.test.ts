import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMorningBrief } from "@/lib/domain/dashboard";
import type { GradesSummary, Semester, SemesterOverview, SessionExam } from "@/lib/domain/grades";
import type { NotificationItem, NotificationPage } from "@/lib/domain/notifications";
import type { RequestSummary } from "@/lib/domain/requests";
import type { LessonCard, ScheduleDay } from "@/lib/domain/schedule";

const mocks = vi.hoisted(() => ({
  getTodaySchedule: vi.fn(),
  getRequestsForMorningBrief: vi.fn(),
  getSemesterOverview: vi.fn(),
  getNotificationsForUser: vi.fn(),
}));

vi.mock("@/lib/domain/schedule", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/domain/schedule")>()),
  getTodaySchedule: mocks.getTodaySchedule,
}));
vi.mock("@/lib/domain/requests", () => ({
  getRequestsForMorningBrief: mocks.getRequestsForMorningBrief,
}));
vi.mock("@/lib/domain/grades", () => ({ getSemesterOverview: mocks.getSemesterOverview }));
vi.mock("@/lib/domain/notifications", () => ({
  getNotificationsForUser: mocks.getNotificationsForUser,
}));

const NOW = new Date("2026-11-17T09:30:00.000Z");
const USER_ID = "user-anna";

const DISCIPLINE = { id: "discipline-1", code: "MO-101", name: "История международных отношений" };
const TEACHER = { id: "teacher-1", fullName: "Иванов Иван Иванович" };
const ROOM = {
  id: "room-1",
  number: "А-305",
  name: "Аудитория 305",
  building: { id: "building-1", code: "A", name: "Корпус А" },
};

function makeLesson(overrides: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status?: "SCHEDULED" | "CANCELLED";
  changes?: LessonCard["changes"];
}): LessonCard {
  const snapshot = {
    startsAt: overrides.startsAt,
    endsAt: overrides.endsAt,
    discipline: DISCIPLINE,
    teacher: TEACHER,
    room: ROOM,
  };

  return {
    id: overrides.id,
    groupCode: "MO-21-4",
    type: "LECTURE",
    subgroup: "ALL",
    original: snapshot,
    changes: overrides.changes ?? [],
    effective: { ...snapshot, status: overrides.status ?? "SCHEDULED" },
  };
}

function makeDay(lessons: LessonCard[]): ScheduleDay {
  return {
    date: "2026-11-17",
    startsAt: new Date("2026-11-16T21:00:00.000Z"),
    lessons,
  };
}

const CURRENT_LESSON = makeLesson({
  id: "lesson-current",
  startsAt: new Date("2026-11-17T09:00:00.000Z"),
  endsAt: new Date("2026-11-17T10:30:00.000Z"),
  changes: [
    {
      id: "change-1",
      type: "ROOM_CHANGE",
      reason: "Ремонт",
      createdAt: new Date("2026-11-16T12:00:00.000Z"),
      newStartsAt: null,
      newEndsAt: null,
      newRoom: ROOM,
      newTeacher: null,
      replacementDiscipline: null,
    },
  ],
});

const NEXT_LESSON = makeLesson({
  id: "lesson-next",
  startsAt: new Date("2026-11-17T11:00:00.000Z"),
  endsAt: new Date("2026-11-17T12:30:00.000Z"),
});

const SEMESTER: Semester = {
  id: "semester-1",
  academicYear: "2026/2027",
  term: "AUTUMN",
  startsAt: new Date("2026-09-01T00:00:00.000Z"),
  endsAt: new Date("2027-01-25T00:00:00.000Z"),
  isCurrent: true,
};

function makeSummary(overrides: Partial<GradesSummary> = {}): GradesSummary {
  return {
    averageScore: 4.5,
    totalCredits: 60,
    earnedCredits: 51,
    plannedCredits: 9,
    failedCredits: 0,
    debtCount: 0,
    state: "OK",
    message: "Учёба в норме, задолженностей нет.",
    ...overrides,
  };
}

function makeOverview(overrides: Partial<SemesterOverview> = {}): SemesterOverview {
  return {
    semester: SEMESTER,
    grades: [],
    session: [],
    sessionPublication: null,
    summary: makeSummary(),
    ...overrides,
  };
}

function makeExam(overrides: Partial<SessionExam> = {}): SessionExam {
  return {
    id: "exam-1",
    discipline: DISCIPLINE,
    assessmentType: "EXAM",
    startsAt: new Date("2026-11-20T09:00:00.000Z"),
    endsAt: new Date("2026-11-20T11:00:00.000Z"),
    previousStartsAt: null,
    room: null,
    teacherName: null,
    result: null,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<RequestSummary> = {}): RequestSummary {
  return {
    id: "request-1",
    number: "З-2026-900001",
    typeCode: "STUDY_CERTIFICATE",
    typeTitle: "Справка об обучении",
    status: "NEW",
    createdAt: new Date("2026-11-10T10:00:00.000Z"),
    dueAt: new Date("2026-11-14T10:00:00.000Z"),
    rejectionReason: null,
    ...overrides,
  };
}

function makeNotification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "notification-1",
    category: "SCHEDULE",
    source: "SCHEDULE_SYSTEM",
    priority: "NORMAL",
    title: "Перенос пары",
    body: "Пара перенесена в аудиторию Б-201.",
    targetType: "LESSON",
    targetId: "lesson-current",
    publishedAt: new Date("2026-11-17T06:00:00.000Z"),
    isRead: false,
    ...overrides,
  };
}

function makePage(items: NotificationItem[]): NotificationPage {
  return { items, unreadCount: items.length, nextCursor: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTodaySchedule.mockResolvedValue(makeDay([CURRENT_LESSON, NEXT_LESSON]));
  mocks.getRequestsForMorningBrief.mockResolvedValue([]);
  mocks.getSemesterOverview.mockResolvedValue(makeOverview());
  mocks.getNotificationsForUser.mockResolvedValue(makePage([makeNotification()]));
});

describe("getMorningBrief: карточка «Сейчас»", () => {
  it("показывает текущую пару с аудиторией и изменением", async () => {
    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.now).toMatchObject({
      lessonId: "lesson-current",
      kind: "current",
      disciplineName: DISCIPLINE.name,
      typeLabel: "Лекция",
      roomNumber: "А-305",
      buildingName: "Корпус А",
      changeLabel: "Смена аудитории",
    });
  });

  it("берёт следующую пару, если текущая уже закончилась", async () => {
    const data = await getMorningBrief(USER_ID, new Date("2026-11-17T10:45:00.000Z"));

    expect(data.now?.lessonId).toBe("lesson-next");
    expect(data.now?.kind).toBe("next");
    expect(data.now?.changeLabel).toBeNull();
  });

  it("не показывает отменённую пару", async () => {
    mocks.getTodaySchedule.mockResolvedValue(
      makeDay([
        makeLesson({
          id: "lesson-cancelled",
          startsAt: new Date("2026-11-17T09:00:00.000Z"),
          endsAt: new Date("2026-11-17T10:30:00.000Z"),
          status: "CANCELLED",
        }),
      ]),
    );

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.now).toBeNull();
    expect(data.unavailable).toEqual([]);
  });
});

describe("getMorningBrief: карточка «Изменилось»", () => {
  it("оставляет не более двух свежих изменений расписания и заявок", async () => {
    mocks.getNotificationsForUser.mockResolvedValue(
      makePage([
        makeNotification({
          id: "old",
          publishedAt: new Date("2026-11-01T06:00:00.000Z"),
        }),
        makeNotification({
          id: "deanery",
          category: "DEANERY",
          publishedAt: new Date("2026-11-17T07:00:00.000Z"),
        }),
        makeNotification({
          id: "request",
          category: "REQUESTS",
          targetType: "REQUEST",
          targetId: "request-1",
          title: "Заявка готова",
          publishedAt: new Date("2026-11-17T08:00:00.000Z"),
        }),
        makeNotification({
          id: "schedule",
          publishedAt: new Date("2026-11-17T06:00:00.000Z"),
        }),
      ]),
    );

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.changes.map((change) => change.id)).toEqual(["request", "schedule"]);
    expect(data.changes[0]?.href).toBe("/requests/request-1");
    expect(data.changes[1]?.href).toBe("/schedule/lesson-current");
  });

  it("не выдумывает изменение, если подходящих уведомлений нет", async () => {
    mocks.getNotificationsForUser.mockResolvedValue(makePage([]));

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.changes).toEqual([]);
    expect(data.unavailable).toEqual([]);
  });
});

describe("getMorningBrief: карточка «Требует действия»", () => {
  it("просроченная заявка важнее готовой, срока, долга и экзамена", async () => {
    mocks.getRequestsForMorningBrief.mockResolvedValue([
      makeRequest({ id: "ready", status: "READY", dueAt: null }),
      makeRequest({
        id: "overdue",
        dueAt: new Date("2026-11-16T10:00:00.000Z"),
      }),
    ]);
    mocks.getSemesterOverview.mockResolvedValue(
      makeOverview({ summary: makeSummary({ debtCount: 2 }), session: [makeExam()] }),
    );

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.action).toMatchObject({
      kind: "REQUEST_OVERDUE",
      href: "/requests/overdue",
    });
  });

  it("готовая заявка важнее срока, долга и экзамена", async () => {
    mocks.getRequestsForMorningBrief.mockResolvedValue([
      makeRequest({ id: "ready", status: "READY", dueAt: null }),
      makeRequest({ id: "due", dueAt: new Date("2026-11-18T10:00:00.000Z") }),
    ]);
    mocks.getSemesterOverview.mockResolvedValue(makeOverview({ summary: makeSummary({ debtCount: 2 }) }));

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.action).toMatchObject({
      kind: "REQUEST_READY",
      href: "/requests/ready",
    });
  });

  it("близкий срок заявки важнее долга и экзамена", async () => {
    mocks.getRequestsForMorningBrief.mockResolvedValue([
      makeRequest({ id: "due", dueAt: new Date("2026-11-18T10:00:00.000Z") }),
    ]);
    mocks.getSemesterOverview.mockResolvedValue(makeOverview({ summary: makeSummary({ debtCount: 2 }) }));

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.action).toMatchObject({ kind: "REQUEST_DUE", href: "/requests/due" });
  });

  it("долг важнее далёкого экзамена", async () => {
    mocks.getSemesterOverview.mockResolvedValue(
      makeOverview({
        summary: makeSummary({ debtCount: 1, state: "DEBTS" }),
        session: [makeExam()],
      }),
    );

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.action).toMatchObject({ kind: "DEBT", href: "/grades" });
  });

  it("экзамен в ближайшие семь дней — последний вариант", async () => {
    mocks.getSemesterOverview.mockResolvedValue(makeOverview({ session: [makeExam()] }));

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.action).toMatchObject({
      kind: "EXAM",
      href: "/grades?tab=session",
      at: new Date("2026-11-20T09:00:00.000Z"),
    });
  });

  it("не показывает действие, если ничего не требует внимания", async () => {
    mocks.getSemesterOverview.mockResolvedValue(
      makeOverview({ session: [makeExam({ startsAt: new Date("2026-12-20T09:00:00.000Z") })] }),
    );

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.action).toBeNull();
  });
});

describe("getMorningBrief: состояния и изоляция", () => {
  it("передаёт в источники только идентификатор сессии и фиксированное время", async () => {
    await getMorningBrief(USER_ID, NOW);

    expect(mocks.getTodaySchedule).toHaveBeenCalledWith(USER_ID, NOW);
    expect(mocks.getRequestsForMorningBrief).toHaveBeenCalledWith(USER_ID);
    expect(mocks.getSemesterOverview).toHaveBeenCalledWith(USER_ID, undefined, NOW);
    expect(mocks.getNotificationsForUser).toHaveBeenCalledWith(
      USER_ID,
      { category: "ALL", scope: "ACTIVE" },
      undefined,
      NOW,
    );
  });

  it("возвращает пустые карточки и честное пустое состояние", async () => {
    mocks.getTodaySchedule.mockResolvedValue(null);
    mocks.getNotificationsForUser.mockResolvedValue(makePage([]));
    mocks.getSemesterOverview.mockResolvedValue(makeOverview());

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data).toEqual({ now: null, changes: [], action: null, unavailable: [] });
  });

  it("сохраняет остальные карточки при частичном сбое и фиксирует порядок", async () => {
    mocks.getTodaySchedule.mockRejectedValue(new Error("schedule unavailable"));
    mocks.getNotificationsForUser.mockRejectedValue(new Error("notifications unavailable"));

    const data = await getMorningBrief(USER_ID, NOW);

    expect(data.now).toBeNull();
    expect(data.changes).toEqual([]);
    expect(data.action).toBeNull();
    expect(data.unavailable).toEqual(["now", "changes"]);
  });

  it("помечает действие недоступным при сбое заявок или успеваемости", async () => {
    mocks.getRequestsForMorningBrief.mockRejectedValue(new Error("requests unavailable"));

    const requestsFailed = await getMorningBrief(USER_ID, NOW);
    expect(requestsFailed.unavailable).toEqual(["action"]);

    mocks.getRequestsForMorningBrief.mockResolvedValue([]);
    mocks.getSemesterOverview.mockRejectedValue(new Error("grades unavailable"));

    const gradesFailed = await getMorningBrief(USER_ID, NOW);
    expect(gradesFailed.unavailable).toEqual(["action"]);
  });
});
