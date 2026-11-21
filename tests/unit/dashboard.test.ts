import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboardData } from "@/lib/domain/dashboard";
import type { GradesSummary, Semester, SemesterOverview, SessionExam } from "@/lib/domain/grades";
import type { NotificationItem, UnreadNotifications } from "@/lib/domain/notifications";
import type { StudentProfile } from "@/lib/domain/profile";
import type { RequestSummary } from "@/lib/domain/requests";
import type { LessonCard, ScheduleDay } from "@/lib/domain/schedule";

const mocks = vi.hoisted(() => ({
  getStudentProfile: vi.fn(),
  getTodaySchedule: vi.fn(),
  getSemesterOverview: vi.fn(),
  getActiveRequestsForUser: vi.fn(),
  getUnreadNotificationsForUser: vi.fn(),
}));

vi.mock("@/lib/domain/profile", () => ({ getStudentProfile: mocks.getStudentProfile }));
vi.mock("@/lib/domain/schedule", () => ({ getTodaySchedule: mocks.getTodaySchedule }));
vi.mock("@/lib/domain/grades", () => ({ getSemesterOverview: mocks.getSemesterOverview }));
vi.mock("@/lib/domain/requests", () => ({
  getActiveRequestsForUser: mocks.getActiveRequestsForUser,
}));
vi.mock("@/lib/domain/notifications", () => ({
  getUnreadNotificationsForUser: mocks.getUnreadNotificationsForUser,
  UNREAD_PREVIEW_DEFAULT_LIMIT: 3,
}));

const GROUP_CODE = "MO-21-4";

/** Фиксированное «сейчас»: 09:30 UTC — идёт текущая пара и экзамен из фикстур. */
const NOW = new Date("2026-11-17T09:30:00.000Z");
/** 10:45 UTC — текущая пара уже закончилась, следующая ещё не началась. */
const LATER = new Date("2026-11-17T10:45:00.000Z");

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
}): LessonCard {
  const original = {
    startsAt: overrides.startsAt,
    endsAt: overrides.endsAt,
    discipline: DISCIPLINE,
    teacher: TEACHER,
    room: ROOM,
  };

  return {
    id: overrides.id,
    groupCode: GROUP_CODE,
    type: "LECTURE",
    subgroup: "ALL",
    original,
    changes: [],
    effective: { ...original, status: overrides.status ?? "SCHEDULED" },
  };
}

const CURRENT_LESSON = makeLesson({
  id: "lesson-current",
  startsAt: new Date("2026-11-17T09:00:00.000Z"),
  endsAt: new Date("2026-11-17T10:30:00.000Z"),
});

const NEXT_LESSON = makeLesson({
  id: "lesson-next",
  startsAt: new Date("2026-11-17T11:00:00.000Z"),
  endsAt: new Date("2026-11-17T12:30:00.000Z"),
});

const CANCELLED_LESSON = makeLesson({
  id: "lesson-cancelled",
  startsAt: new Date("2026-11-17T09:30:00.000Z"),
  endsAt: new Date("2026-11-17T11:00:00.000Z"),
  status: "CANCELLED",
});

function makeDay(lessons: LessonCard[]): ScheduleDay {
  return {
    date: "2026-11-17",
    startsAt: new Date("2026-11-16T21:00:00.000Z"),
    lessons,
  };
}

const PROFILE: StudentProfile = {
  fullName: "Анна Петрова",
  email: "anna.petrova@example.com",
  faculty: "Факультет международных отношений",
  program: "Международные отношения",
  group: GROUP_CODE,
  course: 4,
  studyForm: "BUDGET",
  studentNumber: "MO-21-0001",
};

const SEMESTER: Semester = {
  id: "semester-1",
  academicYear: "2026/2027",
  term: "AUTUMN",
  startsAt: new Date("2026-09-01T00:00:00.000Z"),
  endsAt: new Date("2027-01-25T00:00:00.000Z"),
  isCurrent: true,
};

const SUMMARY: GradesSummary = {
  averageScore: 4.5,
  totalCredits: 60,
  earnedCredits: 51,
  plannedCredits: 9,
  failedCredits: 0,
  debtCount: 0,
  state: "OK",
  message: "Учёба в норме, задолженностей нет.",
};

const PAST_EXAM: SessionExam = {
  id: "exam-past",
  discipline: DISCIPLINE,
  assessmentType: "EXAM",
  startsAt: new Date("2026-11-10T09:00:00.000Z"),
  endsAt: new Date("2026-11-10T11:00:00.000Z"),
  room: { buildingCode: "A", number: "А-305", name: "Аудитория 305" },
  teacherName: TEACHER.fullName,
  result: null,
};

const FUTURE_EXAM: SessionExam = {
  id: "exam-future",
  discipline: DISCIPLINE,
  assessmentType: "EXAM",
  startsAt: new Date("2026-12-20T09:00:00.000Z"),
  endsAt: new Date("2026-12-20T11:00:00.000Z"),
  room: null,
  teacherName: null,
  result: null,
};

const IN_PROGRESS_EXAM: SessionExam = {
  id: "exam-in-progress",
  discipline: DISCIPLINE,
  assessmentType: "EXAM",
  startsAt: new Date("2026-11-17T08:30:00.000Z"),
  endsAt: new Date("2026-11-17T10:00:00.000Z"),
  room: null,
  teacherName: null,
  result: null,
};

const OVERVIEW: SemesterOverview = {
  semester: SEMESTER,
  grades: [],
  session: [PAST_EXAM, FUTURE_EXAM],
  summary: SUMMARY,
};

const OVERVIEW_WITH_IN_PROGRESS_EXAM: SemesterOverview = {
  ...OVERVIEW,
  session: [PAST_EXAM, IN_PROGRESS_EXAM, FUTURE_EXAM],
};

const REQUESTS: RequestSummary[] = [
  {
    id: "request-1",
    number: "З-2026-900003",
    typeCode: "ACADEMIC_LEAVE",
    typeTitle: "Академический отпуск",
    status: "NEW",
    createdAt: new Date("2026-11-15T15:10:00.000Z"),
    dueAt: new Date("2026-11-20T15:10:00.000Z"),
    rejectionReason: null,
  },
];

const FOUR_REQUESTS: RequestSummary[] = Array.from({ length: 4 }, (_, index) => ({
  id: `request-${index + 1}`,
  number: `З-2026-90000${index + 3}`,
  typeCode: "STUDY_CERTIFICATE",
  typeTitle: "Справка об обучении",
  status: index % 2 === 0 ? "NEW" : "IN_PROGRESS",
  createdAt: new Date(NOW.getTime() - (index + 1) * 60_000),
  dueAt: null,
  rejectionReason: null,
}));

const NOTIFICATION: NotificationItem = {
  id: "notification-1",
  category: "DEANERY",
  priority: "IMPORTANT",
  title: "Собрание группы перед сессией",
  body: "Собрание состоится в четверг.",
  targetType: "NONE",
  targetId: null,
  publishedAt: new Date("2026-11-16T06:30:00.000Z"),
  isRead: false,
};

const UNREAD: UnreadNotifications = { count: 1, items: [NOTIFICATION] };

beforeEach(() => {
  vi.clearAllMocks();

  mocks.getStudentProfile.mockResolvedValue(PROFILE);
  mocks.getTodaySchedule.mockResolvedValue(makeDay([CURRENT_LESSON, NEXT_LESSON]));
  mocks.getSemesterOverview.mockResolvedValue(OVERVIEW);
  mocks.getActiveRequestsForUser.mockResolvedValue(REQUESTS);
  mocks.getUnreadNotificationsForUser.mockResolvedValue(UNREAD);
});

describe("getDashboardData: ближайшая пара", () => {
  it("выбирает пару, которая идёт сейчас", async () => {
    const data = await getDashboardData("user-anna", NOW);

    expect(data.nearestLesson?.id).toBe(CURRENT_LESSON.id);
    expect(data.unavailable).toEqual([]);
  });

  it("выбирает следующую пару, если текущая закончилась", async () => {
    const data = await getDashboardData("user-anna", LATER);

    expect(data.nearestLesson?.id).toBe(NEXT_LESSON.id);
  });

  it("не выбирает отменённую пару", async () => {
    mocks.getTodaySchedule.mockResolvedValue(makeDay([CANCELLED_LESSON]));

    const data = await getDashboardData("user-anna", NOW);

    expect(data.nearestLesson).toBeNull();
    expect(data.unavailable).toEqual([]);
  });

  it("пропускает отменённую пару в текущем слоте и берёт следующую", async () => {
    mocks.getTodaySchedule.mockResolvedValue(makeDay([CANCELLED_LESSON, NEXT_LESSON]));

    const data = await getDashboardData("user-anna", NOW);

    expect(data.nearestLesson?.id).toBe(NEXT_LESSON.id);
  });

  it("возвращает null, если профиля нет и расписание пустое", async () => {
    mocks.getStudentProfile.mockResolvedValue(null);
    mocks.getTodaySchedule.mockResolvedValue(null);

    const data = await getDashboardData("user-without-profile", NOW);

    expect(data.student).toBeNull();
    expect(data.nearestLesson).toBeNull();
    expect(data.unavailable).toEqual([]);
  });
});

describe("getDashboardData: ближайший экзамен", () => {
  it("выбирает идущий экзамен раньше будущего", async () => {
    mocks.getSemesterOverview.mockResolvedValue(OVERVIEW_WITH_IN_PROGRESS_EXAM);

    const data = await getDashboardData("user-anna", NOW);

    expect(data.nearestExam?.id).toBe(IN_PROGRESS_EXAM.id);
  });
});

describe("getDashboardData: частичный сбой блока", () => {
  it("переживает сбой расписания и сохраняет остальные блоки", async () => {
    mocks.getTodaySchedule.mockRejectedValue(new Error("schedule unavailable"));

    const data = await getDashboardData("user-anna", NOW);

    expect(data.unavailable).toEqual(["nearestLesson"]);
    expect(data.nearestLesson).toBeNull();
    expect(data.student).toEqual({ firstName: "Анна", groupCode: GROUP_CODE });
    expect(data.gradesSummary).toEqual(SUMMARY);
    expect(data.nearestExam?.id).toBe(FUTURE_EXAM.id);
    expect(data.activeRequests).toEqual(REQUESTS);
    expect(data.unreadNotifications).toEqual(UNREAD);
  });

  it("помечает оба блока успеваемости при сбое сводки", async () => {
    mocks.getSemesterOverview.mockRejectedValue(new Error("grades unavailable"));

    const data = await getDashboardData("user-anna", NOW);

    expect(data.unavailable).toEqual(["gradesSummary", "nearestExam"]);
    expect(data.gradesSummary).toBeNull();
    expect(data.nearestExam).toBeNull();
    expect(data.nearestLesson?.id).toBe(CURRENT_LESSON.id);
    expect(data.activeRequests).toEqual(REQUESTS);
    expect(data.unreadNotifications).toEqual(UNREAD);
  });
});

describe("getDashboardData: лимиты и полный сбой", () => {
  it("ограничивает активные заявки тремя новыми", async () => {
    mocks.getActiveRequestsForUser.mockResolvedValue(FOUR_REQUESTS);

    const data = await getDashboardData("user-anna", NOW);

    expect(data.activeRequests).toHaveLength(3);
    expect(data.activeRequests.map((request) => request.id)).toEqual([
      "request-1",
      "request-2",
      "request-3",
    ]);
    expect(data.unavailable).toEqual([]);
  });

  it("возвращает фиксированный порядок недоступных блоков при полном сбое", async () => {
    mocks.getStudentProfile.mockRejectedValue(new Error("profile unavailable"));
    mocks.getTodaySchedule.mockRejectedValue(new Error("schedule unavailable"));
    mocks.getSemesterOverview.mockRejectedValue(new Error("grades unavailable"));
    mocks.getActiveRequestsForUser.mockRejectedValue(new Error("requests unavailable"));
    mocks.getUnreadNotificationsForUser.mockRejectedValue(new Error("notifications unavailable"));

    const data = await getDashboardData("user-anna", NOW);

    expect(data.unavailable).toEqual([
      "student",
      "nearestLesson",
      "gradesSummary",
      "nearestExam",
      "activeRequests",
      "unreadNotifications",
    ]);
    expect(data.student).toBeNull();
    expect(data.nearestLesson).toBeNull();
    expect(data.gradesSummary).toBeNull();
    expect(data.nearestExam).toBeNull();
    expect(data.activeRequests).toEqual([]);
    expect(data.unreadNotifications).toEqual({ count: 0, items: [] });
  });
});
