import "dotenv/config";

import { createAuth } from "../src/lib/auth/create-auth";
import { createPrismaClient } from "../src/lib/db/client";
import {
  buildRequestCreatedNotification,
  buildRequestStatusNotification,
  getRequestStatusDedupeKey,
} from "../src/lib/domain/request-notifications";
import { addMoscowWorkingDays, getMoscowYear } from "../src/lib/domain/request-time";

const prisma = createPrismaClient();
const auth = createAuth(prisma);

/** Пароль демо-аккаунтов для жюри; в БД хранится только scrypt-хеш Better Auth. */
const DEMO_PASSWORD = "Deanery#2026";

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type LessonTypeValue = "LECTURE" | "PRACTICE" | "LABORATORY" | "SEMINAR";
type SubgroupValue = "ALL" | "FIRST" | "SECOND";
type ChangeTypeValue =
  "CANCELLATION" | "TIME_CHANGE" | "ROOM_CHANGE" | "TEACHER_CHANGE" | "LESSON_REPLACEMENT";

type DemoStudent = {
  email: string;
  name: string;
  role: "STUDENT";
  studentNumber: string;
  facultyCode: string;
  programCode: string;
  groupCode: string;
  course: number;
  studyForm: "BUDGET" | "PAID";
  subgroup: "FIRST" | "SECOND";
  enrolledAt: Date;
};

type DemoTeacher = {
  email: string;
  fullName: string;
};

type DemoDiscipline = {
  code: string;
  name: string;
  teacherEmail: string;
};

type DemoRoom = {
  number: string;
  name?: string;
  capacity?: number;
};

type DemoBuilding = {
  code: string;
  name: string;
  address: string;
  rooms: DemoRoom[];
};

type DemoLesson = {
  day: number;
  start: [number, number];
  end: [number, number];
  disciplineCode: string;
  type: LessonTypeValue;
  subgroup?: SubgroupValue;
  buildingCode: string;
  roomNumber: string;
  teacherEmail?: string;
};

type DemoChange = {
  groupCode: string;
  day: number;
  start: [number, number];
  disciplineCode: string;
  subgroup?: SubgroupValue;
  type: ChangeTypeValue;
  reason: string;
  newStart?: [number, number];
  newEnd?: [number, number];
  newBuildingCode?: string;
  newRoomNumber?: string;
  newTeacherEmail?: string;
  replacementDisciplineCode?: string;
};

type SemesterTermValue = "AUTUMN" | "SPRING";
type AssessmentTypeValue = "EXAM" | "CREDIT" | "GRADED_CREDIT" | "COURSEWORK";
type GradeStatusValue = "PASSED" | "FAILED" | "NOT_GRADED";
type DemoSemesterSlot = "current" | "past";

type DemoGrade = {
  studentEmail: string;
  disciplineCode: string;
  semester: DemoSemesterSlot;
  assessmentType: AssessmentTypeValue;
  credits: number;
  score: number | null;
  status: GradeStatusValue;
};

type DemoExam = {
  groupCode: string;
  disciplineCode: string;
  semester: DemoSemesterSlot;
  assessmentType: AssessmentTypeValue;
  /** Месяц и день сессии; год выводится из семестра. */
  month: number;
  day: number;
  start: [number, number];
  end: [number, number];
  buildingCode: string;
  roomNumber: string;
};

type DemoSemester = {
  academicYear: string;
  term: SemesterTermValue;
  startYear: number;
  startsAt: Date;
  endsAt: Date;
};

type RequestTypeCodeValue = "STUDY_CERTIFICATE" | "PLACE_REQUIREMENT" | "ACADEMIC_LEAVE" | "RETAKE";
type RequestStatusValue = "NEW" | "IN_PROGRESS" | "READY" | "REJECTED" | "CANCELLED";
/** Статус, в который заявка переходит: создание `NEW` пишется отдельной записью истории. */
type RequestTransitionStatusValue = Exclude<RequestStatusValue, "NEW">;

type DemoRequestType = {
  code: RequestTypeCodeValue;
  title: string;
  description: string;
  processingDays: number;
  sortOrder: number;
};

type DemoRequestTransition = {
  fromStatus: RequestStatusValue;
  toStatus: RequestTransitionStatusValue;
  /** Сколько дней назад произошёл переход; всегда позже создания заявки. */
  daysAgo: number;
  time: [number, number];
  comment?: string;
  /** Автор — студент-владелец (отмена); иначе система или сотрудник, `changedById = null`. */
  byStudent?: boolean;
};

type DemoRequest = {
  /** Шесть цифр номера заявки: 900001–900006, вне диапазона реальной выдачи. */
  numberSuffix: number;
  studentEmail: string;
  typeCode: RequestTypeCodeValue;
  status: RequestStatusValue;
  /** Сколько дней назад создана заявка: вне окна лимита 10 минут. */
  daysAgo: number;
  time: [number, number];
  /** Payload по § 4.3 спецификации; для `RETAKE` берётся id дисциплины из справочника. */
  payload: (disciplines: Map<string, string>) => Record<string, string>;
  rejectionReason?: string;
  transitions: DemoRequestTransition[];
};

const FACULTIES = [
  { code: "FMO", name: "Факультет международных отношений" },
  { code: "FMEO", name: "Факультет международных экономических отношений" },
] as const;

const PROGRAMS = [
  { code: "MO", name: "Международные отношения", facultyCode: "FMO" },
  { code: "MEO", name: "Мировая экономика", facultyCode: "FMEO" },
] as const;

const GROUPS = [
  { code: "MO-21-4", programCode: "MO" },
  { code: "MEO-11-2", programCode: "MEO" },
] as const;

const DEMO_STUDENTS: DemoStudent[] = [
  {
    email: "anna.petrova@example.com",
    name: "Анна Петрова",
    role: "STUDENT",
    studentNumber: "MO-21-0047",
    facultyCode: "FMO",
    programCode: "MO",
    groupCode: "MO-21-4",
    course: 2,
    studyForm: "BUDGET",
    subgroup: "FIRST",
    enrolledAt: new Date("2024-09-01T00:00:00.000Z"),
  },
  {
    email: "mark.sokolov@example.com",
    name: "Марк Соколов",
    role: "STUDENT",
    studentNumber: "MEO-11-0112",
    facultyCode: "FMEO",
    programCode: "MEO",
    groupCode: "MEO-11-2",
    course: 1,
    studyForm: "PAID",
    subgroup: "SECOND",
    enrolledAt: new Date("2025-09-01T00:00:00.000Z"),
  },
];

const TEACHERS: DemoTeacher[] = [
  { email: "i.sokolova@example.com", fullName: "Ирина Владимировна Соколова" },
  { email: "d.lebedev@example.com", fullName: "Дмитрий Андреевич Лебедев" },
  { email: "m.orlova@example.com", fullName: "Мария Сергеевна Орлова" },
  { email: "a.krylov@example.com", fullName: "Алексей Николаевич Крылов" },
  { email: "e.zakharova@example.com", fullName: "Елена Павловна Захарова" },
  { email: "p.melnikov@example.com", fullName: "Павел Игоревич Мельников" },
  { email: "n.belova@example.com", fullName: "Наталья Олеговна Белова" },
];

const DISCIPLINES: DemoDiscipline[] = [
  {
    code: "MO-101",
    name: "История международных отношений",
    teacherEmail: "i.sokolova@example.com",
  },
  {
    code: "MO-102",
    name: "Теория международных отношений",
    teacherEmail: "d.lebedev@example.com",
  },
  {
    code: "MO-103",
    name: "Иностранный язык (английский)",
    teacherEmail: "m.orlova@example.com",
  },
  {
    code: "MO-104",
    name: "Международное право",
    teacherEmail: "a.krylov@example.com",
  },
  {
    code: "MO-105",
    name: "Экономическая география",
    teacherEmail: "e.zakharova@example.com",
  },
  {
    code: "MEO-101",
    name: "Микроэкономика",
    teacherEmail: "p.melnikov@example.com",
  },
  {
    code: "MEO-102",
    name: "Бухгалтерский учёт",
    teacherEmail: "e.zakharova@example.com",
  },
  {
    code: "MEO-103",
    name: "Иностранный язык (английский)",
    teacherEmail: "m.orlova@example.com",
  },
  {
    code: "MEO-104",
    name: "Статистика",
    teacherEmail: "d.lebedev@example.com",
  },
  {
    code: "MEO-105",
    name: "Основы предпринимательства",
    teacherEmail: "i.sokolova@example.com",
  },
  // Дисциплины прошлого семестра: занятий не имеют, нужны для истории оценок.
  {
    code: "MO-091",
    name: "Введение в специальность",
    teacherEmail: "i.sokolova@example.com",
  },
  {
    code: "MO-092",
    name: "История России",
    teacherEmail: "a.krylov@example.com",
  },
  {
    code: "MO-093",
    name: "Иностранный язык (базовый курс)",
    teacherEmail: "m.orlova@example.com",
  },
  {
    code: "MO-094",
    name: "Информатика",
    teacherEmail: "d.lebedev@example.com",
  },
  {
    code: "MEO-091",
    name: "Основы экономической теории",
    teacherEmail: "p.melnikov@example.com",
  },
  {
    code: "MEO-092",
    name: "Математика для экономистов",
    teacherEmail: "e.zakharova@example.com",
  },
  {
    code: "MEO-093",
    name: "Иностранный язык (базовый курс)",
    teacherEmail: "m.orlova@example.com",
  },
  {
    code: "MEO-094",
    name: "Информационные технологии",
    teacherEmail: "d.lebedev@example.com",
  },
];

const BUILDINGS: DemoBuilding[] = [
  {
    code: "A",
    name: "Корпус А",
    address: "ул. Университетская, 1",
    rooms: [
      { number: "101", name: "Аудитория 101", capacity: 30 },
      { number: "203", name: "Аудитория 203", capacity: 28 },
      { number: "305", name: "Аудитория 305", capacity: 24 },
      { number: "410", name: "Аудитория 410", capacity: 20 },
    ],
  },
  {
    code: "B",
    name: "Корпус Б",
    address: "ул. Студенческая, 7",
    rooms: [
      { number: "12", name: "Лингафонный кабинет", capacity: 16 },
      { number: "24", name: "Аудитория 24", capacity: 18 },
    ],
  },
];

const SCHEDULE: Record<string, DemoLesson[]> = {
  "MO-21-4": [
    {
      day: 0,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-101",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 0,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-102",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 0,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 0,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "SECOND",
      buildingCode: "B",
      roomNumber: "24",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 1,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-104",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 1,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-105",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 1,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 1,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "PRACTICE",
      subgroup: "SECOND",
      buildingCode: "B",
      roomNumber: "24",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 2,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-101",
      type: "SEMINAR",
      buildingCode: "A",
      roomNumber: "410",
    },
    {
      day: 2,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-102",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "410",
    },
    {
      day: 3,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-105",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 3,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-104",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 4,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MO-102",
      type: "SEMINAR",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 4,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MO-101",
      type: "PRACTICE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 4,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "LABORATORY",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 4,
      start: [14, 45],
      end: [16, 15],
      disciplineCode: "MO-103",
      type: "LABORATORY",
      subgroup: "SECOND",
      buildingCode: "B",
      roomNumber: "24",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 5,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MO-105",
      type: "SEMINAR",
      buildingCode: "A",
      roomNumber: "203",
    },
  ],
  "MEO-11-2": [
    {
      day: 0,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MEO-101",
      type: "LECTURE",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 0,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-102",
      type: "PRACTICE",
      buildingCode: "B",
      roomNumber: "12",
    },
    {
      day: 1,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-103",
      type: "PRACTICE",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 1,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-103",
      type: "PRACTICE",
      subgroup: "SECOND",
      buildingCode: "A",
      roomNumber: "203",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 1,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MEO-104",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "203",
    },
    {
      day: 2,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MEO-105",
      type: "SEMINAR",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 2,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-101",
      type: "PRACTICE",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 3,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-102",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "305",
    },
    {
      day: 3,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MEO-103",
      type: "LABORATORY",
      subgroup: "FIRST",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 3,
      start: [13, 0],
      end: [14, 30],
      disciplineCode: "MEO-103",
      type: "LABORATORY",
      subgroup: "SECOND",
      buildingCode: "A",
      roomNumber: "203",
      teacherEmail: "n.belova@example.com",
    },
    {
      day: 4,
      start: [9, 0],
      end: [10, 30],
      disciplineCode: "MEO-104",
      type: "PRACTICE",
      buildingCode: "B",
      roomNumber: "24",
    },
    {
      day: 4,
      start: [10, 45],
      end: [12, 15],
      disciplineCode: "MEO-105",
      type: "LECTURE",
      buildingCode: "A",
      roomNumber: "305",
    },
  ],
};

const CHANGES: DemoChange[] = [
  {
    groupCode: "MO-21-4",
    day: 0,
    start: [9, 0],
    disciplineCode: "MO-101",
    type: "CANCELLATION",
    reason: "Преподаватель на научной конференции",
  },
  {
    groupCode: "MO-21-4",
    day: 1,
    start: [10, 45],
    disciplineCode: "MO-105",
    type: "TIME_CHANGE",
    reason: "Перенос после заседания кафедры",
    newStart: [12, 30],
    newEnd: [14, 0],
  },
  {
    groupCode: "MO-21-4",
    day: 2,
    start: [13, 0],
    disciplineCode: "MO-102",
    type: "ROOM_CHANGE",
    reason: "В аудитории 410 проходит олимпиада",
    newBuildingCode: "A",
    newRoomNumber: "203",
  },
  {
    groupCode: "MO-21-4",
    day: 3,
    start: [10, 45],
    disciplineCode: "MO-104",
    type: "TEACHER_CHANGE",
    reason: "Замена преподавателя по болезни",
    newTeacherEmail: "d.lebedev@example.com",
  },
  {
    groupCode: "MO-21-4",
    day: 4,
    start: [9, 0],
    disciplineCode: "MO-102",
    type: "LESSON_REPLACEMENT",
    reason: "Занятие заменено по распоряжению деканата",
    replacementDisciplineCode: "MO-105",
  },
  {
    groupCode: "MEO-11-2",
    day: 0,
    start: [9, 0],
    disciplineCode: "MEO-101",
    type: "CANCELLATION",
    reason: "Преподаватель на больничном",
  },
  {
    groupCode: "MEO-11-2",
    day: 2,
    start: [9, 0],
    disciplineCode: "MEO-105",
    type: "ROOM_CHANGE",
    reason: "Аудитория 24 занята",
    newBuildingCode: "A",
    newRoomNumber: "305",
  },
  {
    groupCode: "MEO-11-2",
    day: 3,
    start: [10, 45],
    disciplineCode: "MEO-102",
    type: "TIME_CHANGE",
    reason: "Сдвиг из-за общего собрания курса",
    newStart: [12, 30],
    newEnd: [14, 0],
  },
  {
    groupCode: "MEO-11-2",
    day: 4,
    start: [9, 0],
    disciplineCode: "MEO-104",
    type: "TEACHER_CHANGE",
    reason: "Замена преподавателя",
    newTeacherEmail: "e.zakharova@example.com",
  },
];

/**
 * Демо-оценки двух студентов. Анна учится ровно и закрыла текущий семестр без
 * долгов, у Марка — незачёт и неудовлетворительная оценка. Прошлый семестр
 * закрыт у обоих: история доступна только для чтения.
 */
const DEMO_GRADES: DemoGrade[] = [
  // Анна, текущий семестр.
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-101",
    semester: "current",
    assessmentType: "EXAM",
    credits: 4,
    score: 5,
    status: "PASSED",
  },
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-102",
    semester: "current",
    assessmentType: "EXAM",
    credits: 3,
    score: 4,
    status: "PASSED",
  },
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-103",
    semester: "current",
    assessmentType: "CREDIT",
    credits: 2,
    score: null,
    status: "PASSED",
  },
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-104",
    semester: "current",
    assessmentType: "GRADED_CREDIT",
    credits: 3,
    score: 5,
    status: "PASSED",
  },
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-105",
    semester: "current",
    assessmentType: "COURSEWORK",
    credits: 2,
    score: null,
    status: "NOT_GRADED",
  },
  // Анна, прошлый семестр.
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-091",
    semester: "past",
    assessmentType: "CREDIT",
    credits: 2,
    score: null,
    status: "PASSED",
  },
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-092",
    semester: "past",
    assessmentType: "EXAM",
    credits: 4,
    score: 5,
    status: "PASSED",
  },
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-093",
    semester: "past",
    assessmentType: "GRADED_CREDIT",
    credits: 3,
    score: 5,
    status: "PASSED",
  },
  {
    studentEmail: "anna.petrova@example.com",
    disciplineCode: "MO-094",
    semester: "past",
    assessmentType: "CREDIT",
    credits: 3,
    score: null,
    status: "PASSED",
  },
  // Марк, текущий семестр: незачёт и неудовлетворительная оценка.
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-101",
    semester: "current",
    assessmentType: "EXAM",
    credits: 4,
    score: 2,
    status: "FAILED",
  },
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-102",
    semester: "current",
    assessmentType: "CREDIT",
    credits: 3,
    score: null,
    status: "FAILED",
  },
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-103",
    semester: "current",
    assessmentType: "CREDIT",
    credits: 2,
    score: null,
    status: "PASSED",
  },
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-104",
    semester: "current",
    assessmentType: "EXAM",
    credits: 3,
    score: 3,
    status: "PASSED",
  },
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-105",
    semester: "current",
    assessmentType: "GRADED_CREDIT",
    credits: 2,
    score: null,
    status: "NOT_GRADED",
  },
  // Марк, прошлый семестр.
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-091",
    semester: "past",
    assessmentType: "EXAM",
    credits: 4,
    score: 3,
    status: "PASSED",
  },
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-092",
    semester: "past",
    assessmentType: "EXAM",
    credits: 4,
    score: 3,
    status: "PASSED",
  },
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-093",
    semester: "past",
    assessmentType: "CREDIT",
    credits: 3,
    score: null,
    status: "PASSED",
  },
  {
    studentEmail: "mark.sokolov@example.com",
    disciplineCode: "MEO-094",
    semester: "past",
    assessmentType: "GRADED_CREDIT",
    credits: 3,
    score: 4,
    status: "PASSED",
  },
];

/** Экзамены и зачёты сессии: расписание общее для группы, результат — в `Grade`. */
const DEMO_EXAMS: DemoExam[] = [
  // Анна, текущий семестр: предстоящие испытания.
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-103",
    semester: "current",
    assessmentType: "CREDIT",
    month: 11,
    day: 18,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "B",
    roomNumber: "12",
  },
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-101",
    semester: "current",
    assessmentType: "EXAM",
    month: 11,
    day: 21,
    start: [10, 0],
    end: [12, 30],
    buildingCode: "A",
    roomNumber: "203",
  },
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-104",
    semester: "current",
    assessmentType: "GRADED_CREDIT",
    month: 11,
    day: 23,
    start: [13, 0],
    end: [14, 30],
    buildingCode: "A",
    roomNumber: "305",
  },
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-102",
    semester: "current",
    assessmentType: "EXAM",
    month: 0,
    day: 14,
    start: [10, 0],
    end: [12, 30],
    buildingCode: "A",
    roomNumber: "410",
  },
  // Анна, прошлый семестр: результаты уже выставлены.
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-091",
    semester: "past",
    assessmentType: "CREDIT",
    month: 5,
    day: 5,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "A",
    roomNumber: "101",
  },
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-092",
    semester: "past",
    assessmentType: "EXAM",
    month: 5,
    day: 11,
    start: [10, 0],
    end: [12, 30],
    buildingCode: "A",
    roomNumber: "203",
  },
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-093",
    semester: "past",
    assessmentType: "GRADED_CREDIT",
    month: 5,
    day: 16,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "B",
    roomNumber: "12",
  },
  {
    groupCode: "MO-21-4",
    disciplineCode: "MO-094",
    semester: "past",
    assessmentType: "CREDIT",
    month: 5,
    day: 9,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "A",
    roomNumber: "410",
  },
  // Марк, текущий семестр.
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-103",
    semester: "current",
    assessmentType: "CREDIT",
    month: 11,
    day: 17,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "B",
    roomNumber: "24",
  },
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-102",
    semester: "current",
    assessmentType: "CREDIT",
    month: 11,
    day: 22,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "B",
    roomNumber: "24",
  },
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-104",
    semester: "current",
    assessmentType: "EXAM",
    month: 11,
    day: 24,
    start: [10, 0],
    end: [12, 30],
    buildingCode: "A",
    roomNumber: "305",
  },
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-105",
    semester: "current",
    assessmentType: "GRADED_CREDIT",
    month: 0,
    day: 18,
    start: [13, 0],
    end: [14, 30],
    buildingCode: "B",
    roomNumber: "24",
  },
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-101",
    semester: "current",
    assessmentType: "EXAM",
    month: 0,
    day: 15,
    start: [10, 0],
    end: [12, 30],
    buildingCode: "A",
    roomNumber: "203",
  },
  // Марк, прошлый семестр.
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-093",
    semester: "past",
    assessmentType: "CREDIT",
    month: 5,
    day: 6,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "B",
    roomNumber: "24",
  },
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-094",
    semester: "past",
    assessmentType: "GRADED_CREDIT",
    month: 5,
    day: 9,
    start: [10, 0],
    end: [11, 30],
    buildingCode: "A",
    roomNumber: "203",
  },
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-091",
    semester: "past",
    assessmentType: "EXAM",
    month: 5,
    day: 10,
    start: [10, 0],
    end: [12, 30],
    buildingCode: "A",
    roomNumber: "203",
  },
  {
    groupCode: "MEO-11-2",
    disciplineCode: "MEO-092",
    semester: "past",
    assessmentType: "EXAM",
    month: 5,
    day: 15,
    start: [10, 0],
    end: [12, 30],
    buildingCode: "A",
    roomNumber: "305",
  },
];

/** Каталог типов заявок: четыре типа по `Ф-04.1`. */
const REQUEST_TYPES: DemoRequestType[] = [
  {
    code: "STUDY_CERTIFICATE",
    title: "Справка об обучении",
    description:
      "Подтверждает, что студент обучается в университете: направление, курс и форма обучения.",
    processingDays: 3,
    sortOrder: 1,
  },
  {
    code: "PLACE_REQUIREMENT",
    title: "Справка по месту требования",
    description:
      "Справка для организаций и учреждений: получатель и место предоставления указываются в заявке.",
    processingDays: 5,
    sortOrder: 2,
  },
  {
    code: "ACADEMIC_LEAVE",
    title: "Академический отпуск",
    description:
      "Заявление на академический отпуск по медицинским или семейным обстоятельствам с указанием периода.",
    processingDays: 10,
    sortOrder: 3,
  },
  {
    code: "RETAKE",
    title: "Пересдача",
    description: "Заявление на пересдачу зачёта или экзамена по дисциплине с указанием причины.",
    processingDays: 7,
    sortOrder: 4,
  },
];

/**
 * Демо-заявки двух студентов. Вместе они покрывают все пять статусов:
 * `NEW`, `IN_PROGRESS`, `READY`, `REJECTED` и `CANCELLED`.
 * Даты лежат в прошлом и вне окна лимита создания (10 заявок за 10 минут).
 * Номера собираются из московского года и суффикса 900001–900006.
 */
const DEMO_REQUESTS: DemoRequest[] = [
  // Анна Петрова: готовая справка об обучении.
  {
    numberSuffix: 900001,
    studentEmail: "anna.petrova@example.com",
    typeCode: "STUDY_CERTIFICATE",
    status: "READY",
    daysAgo: 12,
    time: [9, 40],
    payload: () => ({
      deliveryPlace: "Отдел кадров ООО «Северный ветер»",
      comment: "Справка нужна для подтверждения периода обучения при трудоустройстве.",
    }),
    transitions: [
      {
        fromStatus: "NEW",
        toStatus: "IN_PROGRESS",
        daysAgo: 11,
        time: [10, 15],
        comment: "Заявка принята в работу, срок подготовки — 3 рабочих дня.",
      },
      {
        fromStatus: "IN_PROGRESS",
        toStatus: "READY",
        daysAgo: 8,
        time: [16, 20],
        comment: "Справка готова, её можно забрать в деканате на первом этаже.",
      },
    ],
  },
  // Анна Петрова: отклонённая справка по месту требования.
  {
    numberSuffix: 900002,
    studentEmail: "anna.petrova@example.com",
    typeCode: "PLACE_REQUIREMENT",
    status: "REJECTED",
    daysAgo: 9,
    time: [12, 5],
    payload: () => ({
      organizationName: "Территориальный отдел социальной защиты",
      deliveryPlace: "Приёмное окно № 3, ул. Лесная, 12",
      comment: "Справка нужна для оформления социальной стипендии.",
    }),
    rejectionReason:
      "В заявке не указан полный адрес организации. Уточните место предоставления и создайте заявку повторно.",
    transitions: [
      {
        fromStatus: "NEW",
        toStatus: "IN_PROGRESS",
        daysAgo: 8,
        time: [9, 30],
        comment: "Заявка принята в работу.",
      },
      {
        fromStatus: "IN_PROGRESS",
        toStatus: "REJECTED",
        daysAgo: 6,
        time: [15, 45],
        comment:
          "В заявке не указан полный адрес организации. Уточните место предоставления и создайте заявку повторно.",
      },
    ],
  },
  // Анна Петрова: новая заявка на академический отпуск.
  {
    numberSuffix: 900003,
    studentEmail: "anna.petrova@example.com",
    typeCode: "ACADEMIC_LEAVE",
    status: "NEW",
    daysAgo: 2,
    time: [18, 10],
    payload: () => ({
      reason:
        "Прохожу длительное лечение в стационаре, справка из клиники передана в деканат вместе с заявлением.",
      startDate: "2026-12-01",
      endDate: "2027-05-31",
      comment: "Прошу сохранить место в группе MO-21-4.",
    }),
    transitions: [],
  },
  // Марк Соколов: пересдача экзамена, заявка в работе.
  {
    numberSuffix: 900004,
    studentEmail: "mark.sokolov@example.com",
    typeCode: "RETAKE",
    status: "IN_PROGRESS",
    daysAgo: 5,
    time: [11, 25],
    payload: (disciplines) => {
      const disciplineId = disciplines.get("MEO-101");
      if (!disciplineId) {
        throw new Error("Не найдена дисциплина MEO-101");
      }

      return {
        disciplineId,
        reason: "Пропустил экзамен из-за болезни, справка из поликлиники есть в деканате.",
      };
    },
    transitions: [
      {
        fromStatus: "NEW",
        toStatus: "IN_PROGRESS",
        daysAgo: 4,
        time: [10, 5],
        comment: "Заявка принята в работу, деканат согласует дату пересдачи с преподавателем.",
      },
    ],
  },
  // Марк Соколов: справка об обучении, отменена студентом.
  {
    numberSuffix: 900005,
    studentEmail: "mark.sokolov@example.com",
    typeCode: "STUDY_CERTIFICATE",
    status: "CANCELLED",
    daysAgo: 7,
    time: [8, 50],
    payload: () => ({
      deliveryPlace: "Военный комиссариат Советского района",
      comment: "Справка нужна для уточнения данных воинского учёта.",
    }),
    transitions: [
      {
        fromStatus: "NEW",
        toStatus: "CANCELLED",
        daysAgo: 7,
        time: [9, 20],
        comment: "Отменил заявку: справка больше не требуется.",
        byStudent: true,
      },
    ],
  },
  // Марк Соколов: новая справка по месту требования.
  {
    numberSuffix: 900006,
    studentEmail: "mark.sokolov@example.com",
    typeCode: "PLACE_REQUIREMENT",
    status: "NEW",
    daysAgo: 3,
    time: [14, 0],
    payload: () => ({
      organizationName: "Городская поликлиника № 4",
      deliveryPlace: "Регистратура, ул. Строителей, 21",
      comment: "Справка нужна для оформления медицинской книжки.",
    }),
    transitions: [],
  },
];

/**
 * Последний демо-номер. Счётчик года поднимается до него (заведомо выше 900000),
 * поэтому первая реальная заявка получает 900007 и не пересекается с демо.
 */
const DEMO_REQUEST_LAST_NUMBER = Math.max(...DEMO_REQUESTS.map((request) => request.numberSuffix));

type SeedSummary = {
  created: number;
  updated: number;
  profiles: number;
  lessons: number;
  changes: number;
  semesters: number;
  grades: number;
  exams: number;
  requestTypes: number;
  requests: number;
  requestHistory: number;
  notifications: number;
};

/** Понедельник текущей недели в 00:00 по Москве, выраженный как UTC-инстант. */
function getCurrentWeekMonday(): number {
  const mskNow = new Date(Date.now() + MSK_OFFSET_MS);
  const weekday = mskNow.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  return (
    Date.UTC(mskNow.getUTCFullYear(), mskNow.getUTCMonth(), mskNow.getUTCDate() - daysSinceMonday) -
    MSK_OFFSET_MS
  );
}

function atMoscowTime(weekStart: number, day: number, [hour, minute]: [number, number]): Date {
  return new Date(weekStart + day * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS);
}

function lessonKey(
  groupCode: string,
  day: number,
  start: [number, number],
  disciplineCode: string,
  subgroup: SubgroupValue,
): string {
  return [groupCode, day, start.join(":"), disciplineCode, subgroup].join("|");
}

async function ensureDemoStudent(student: DemoStudent, summary: SeedSummary) {
  const existing = await prisma.user.findUnique({
    where: { email: student.email },
    select: { id: true },
  });

  let userId: string;

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: student.name, role: student.role },
      select: { id: true },
    });
    userId = user.id;
    summary.updated += 1;
  } else {
    const result = await auth.api.signUpEmail({
      body: {
        email: student.email,
        password: DEMO_PASSWORD,
        name: student.name,
      },
    });

    if (!result.user?.id) {
      throw new Error(`Не удалось создать демо-пользователя ${student.email}`);
    }

    const user = await prisma.user.update({
      where: { id: result.user.id },
      data: { name: student.name, role: student.role },
      select: { id: true },
    });
    userId = user.id;
    summary.created += 1;
  }

  return userId;
}

async function seedSchedule(
  groups: Map<string, string>,
  teachers: Map<string, string>,
  disciplines: Map<string, string>,
  rooms: Map<string, string>,
  summary: SeedSummary,
) {
  const groupIds = [...groups.values()];

  // Seed владеет демонстрационным расписанием: перед пересозданием удаляем
  // прошлые занятия этих групп. Изменения удаляются каскадом.
  await prisma.lesson.deleteMany({ where: { groupId: { in: groupIds } } });

  const weekStart = getCurrentWeekMonday();
  const lessonIds = new Map<string, string>();

  for (const [groupCode, lessons] of Object.entries(SCHEDULE)) {
    const groupId = groups.get(groupCode);
    if (!groupId) {
      throw new Error(`Не найдена группа ${groupCode}`);
    }

    for (const lesson of lessons) {
      const disciplineId = disciplines.get(lesson.disciplineCode);
      if (!disciplineId) {
        throw new Error(`Не найдена дисциплина ${lesson.disciplineCode}`);
      }

      const subgroup = lesson.subgroup ?? "ALL";
      const teacherId = lesson.teacherEmail
        ? teachers.get(lesson.teacherEmail)
        : teachers.get(
            DISCIPLINES.find((item) => item.code === lesson.disciplineCode)?.teacherEmail ?? "",
          );

      if (!teacherId) {
        throw new Error(`Не найден преподаватель для ${lesson.disciplineCode}`);
      }

      const roomId = rooms.get(`${lesson.buildingCode}:${lesson.roomNumber}`);
      if (!roomId) {
        throw new Error(`Не найдена аудитория ${lesson.buildingCode}-${lesson.roomNumber}`);
      }

      const created = await prisma.lesson.create({
        data: {
          groupId,
          disciplineId,
          teacherId,
          roomId,
          type: lesson.type,
          subgroup,
          startsAt: atMoscowTime(weekStart, lesson.day, lesson.start),
          endsAt: atMoscowTime(weekStart, lesson.day, lesson.end),
        },
        select: { id: true },
      });

      lessonIds.set(
        lessonKey(groupCode, lesson.day, lesson.start, lesson.disciplineCode, subgroup),
        created.id,
      );
      summary.lessons += 1;
    }
  }

  for (const change of CHANGES) {
    const subgroup = change.subgroup ?? "ALL";
    const lessonId = lessonIds.get(
      lessonKey(change.groupCode, change.day, change.start, change.disciplineCode, subgroup),
    );

    if (!lessonId) {
      throw new Error(
        `Не найдено занятие для изменения: ${change.groupCode} ${change.disciplineCode}`,
      );
    }

    const newRoomId =
      change.newBuildingCode && change.newRoomNumber
        ? rooms.get(`${change.newBuildingCode}:${change.newRoomNumber}`)
        : undefined;

    if (change.newBuildingCode && !newRoomId) {
      throw new Error(`Не найдена аудитория ${change.newBuildingCode}-${change.newRoomNumber}`);
    }

    const newTeacherId = change.newTeacherEmail ? teachers.get(change.newTeacherEmail) : undefined;

    if (change.newTeacherEmail && !newTeacherId) {
      throw new Error(`Не найден преподаватель ${change.newTeacherEmail}`);
    }

    const replacementDisciplineId = change.replacementDisciplineCode
      ? disciplines.get(change.replacementDisciplineCode)
      : undefined;

    if (change.replacementDisciplineCode && !replacementDisciplineId) {
      throw new Error(`Не найдена дисциплина ${change.replacementDisciplineCode}`);
    }

    await prisma.lessonChange.create({
      data: {
        lessonId,
        type: change.type,
        reason: change.reason,
        ...(change.newStart && change.newEnd
          ? {
              newStartsAt: atMoscowTime(weekStart, change.day, change.newStart),
              newEndsAt: atMoscowTime(weekStart, change.day, change.newEnd),
            }
          : {}),
        ...(newRoomId ? { newRoomId } : {}),
        ...(newTeacherId ? { newTeacherId } : {}),
        ...(replacementDisciplineId ? { replacementDisciplineId } : {}),
      },
    });
    summary.changes += 1;
  }
}

/** Начало календарного дня по Москве, выраженное как UTC-инстант. */
function moscowStartOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - MSK_OFFSET_MS);
}

/** Последняя секунда календарного дня по Москве. */
function moscowEndOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 23, 59, 59) - MSK_OFFSET_MS);
}

/** Время по Москве за `daysAgo` дней до сегодняшнего дня, выраженное как UTC-инстант. */
function moscowDaysAgo(daysAgo: number, [hour, minute]: [number, number]): Date {
  const mskNow = new Date(Date.now() + MSK_OFFSET_MS);

  return new Date(
    Date.UTC(
      mskNow.getUTCFullYear(),
      mskNow.getUTCMonth(),
      mskNow.getUTCDate() - daysAgo,
      hour,
      minute,
    ) - MSK_OFFSET_MS,
  );
}

function autumnSemester(startYear: number): DemoSemester {
  return {
    academicYear: `${startYear}/${startYear + 1}`,
    term: "AUTUMN",
    startYear,
    startsAt: moscowStartOfDay(startYear, 8, 1),
    endsAt: moscowEndOfDay(startYear, 11, 31),
  };
}

function springSemester(startYear: number): DemoSemester {
  return {
    academicYear: `${startYear - 1}/${startYear}`,
    term: "SPRING",
    startYear,
    startsAt: moscowStartOfDay(startYear, 1, 1),
    endsAt: moscowEndOfDay(startYear, 5, 30),
  };
}

/**
 * Текущий и прошлый семестры относительно даты запуска seed.
 * В июле–августе текущим считается предстоящий осенний семестр.
 */
function getDemoSemesters(now: Date = new Date()): {
  current: DemoSemester;
  past: DemoSemester;
} {
  const msk = new Date(now.getTime() + MSK_OFFSET_MS);
  const year = msk.getUTCFullYear();
  const month = msk.getUTCMonth();

  if (month >= 6) {
    return { current: autumnSemester(year), past: springSemester(year) };
  }

  return { current: springSemester(year), past: autumnSemester(year - 1) };
}

function examStartsAt(
  semester: DemoSemester,
  month: number,
  day: number,
  [hour, minute]: [number, number],
): Date {
  const year =
    semester.term === "AUTUMN" && month < 6 ? semester.startYear + 1 : semester.startYear;

  return new Date(Date.UTC(year, month, day, hour, minute) - MSK_OFFSET_MS);
}

async function ensureDemoSemester(semester: DemoSemester) {
  const record = await prisma.semester.upsert({
    where: {
      academicYear_term: { academicYear: semester.academicYear, term: semester.term },
    },
    update: { startsAt: semester.startsAt, endsAt: semester.endsAt },
    create: {
      academicYear: semester.academicYear,
      term: semester.term,
      startsAt: semester.startsAt,
      endsAt: semester.endsAt,
    },
    select: { id: true },
  });

  return { ...semester, id: record.id };
}

/**
 * Seed владеет успеваемостью демо-студентов в текущем и прошлом семестрах:
 * прежние оценки и экзамены этих семестров удаляются, затем создаются заново.
 * Естественные ключи (`Grade`, `Exam`) при этом не дублируются.
 */
async function seedGrades(
  semesters: Record<DemoSemesterSlot, DemoSemester & { id: string }>,
  profiles: Map<string, string>,
  groups: Map<string, string>,
  teachers: Map<string, string>,
  disciplines: Map<string, string>,
  rooms: Map<string, string>,
  summary: SeedSummary,
) {
  const semesterIds = [semesters.current.id, semesters.past.id];
  const profileIds = [...profiles.values()];
  const groupIds = [...groups.values()];

  await prisma.grade.deleteMany({
    where: { semesterId: { in: semesterIds }, studentProfileId: { in: profileIds } },
  });
  await prisma.exam.deleteMany({
    where: { semesterId: { in: semesterIds }, groupId: { in: groupIds } },
  });

  const gradeRows = DEMO_GRADES.map((grade) => {
    const studentProfileId = profiles.get(grade.studentEmail);
    const disciplineId = disciplines.get(grade.disciplineCode);
    const semesterId = semesters[grade.semester].id;

    if (!studentProfileId) {
      throw new Error(`Не найден профиль студента ${grade.studentEmail}`);
    }
    if (!disciplineId) {
      throw new Error(`Не найдена дисциплина ${grade.disciplineCode}`);
    }

    return {
      studentProfileId,
      disciplineId,
      semesterId,
      assessmentType: grade.assessmentType,
      credits: grade.credits,
      score: grade.score,
      status: grade.status,
    };
  });

  await prisma.grade.createMany({ data: gradeRows });
  summary.grades += gradeRows.length;

  const examRows = DEMO_EXAMS.map((exam) => {
    const groupId = groups.get(exam.groupCode);
    const disciplineId = disciplines.get(exam.disciplineCode);
    const roomId = rooms.get(`${exam.buildingCode}:${exam.roomNumber}`);
    const semester = semesters[exam.semester];
    const teacherEmail = DISCIPLINES.find(
      (discipline) => discipline.code === exam.disciplineCode,
    )?.teacherEmail;
    const teacherId = teacherEmail ? teachers.get(teacherEmail) : undefined;

    if (!groupId) {
      throw new Error(`Не найдена группа ${exam.groupCode}`);
    }
    if (!disciplineId) {
      throw new Error(`Не найдена дисциплина ${exam.disciplineCode}`);
    }
    if (!roomId) {
      throw new Error(`Не найдена аудитория ${exam.buildingCode}-${exam.roomNumber}`);
    }

    return {
      groupId,
      disciplineId,
      semesterId: semester.id,
      assessmentType: exam.assessmentType,
      startsAt: examStartsAt(semester, exam.month, exam.day, exam.start),
      endsAt: examStartsAt(semester, exam.month, exam.day, exam.end),
      roomId,
      ...(teacherId ? { teacherId } : {}),
    };
  });

  await prisma.exam.createMany({ data: examRows });
  summary.exams += examRows.length;
  summary.semesters += 2;
}

/** Каталог типов заявок обновляется через upsert по `code` и не дублируется. */
async function seedRequestTypes(summary: SeedSummary) {
  const types = new Map<string, string>();

  for (const type of REQUEST_TYPES) {
    const record = await prisma.requestType.upsert({
      where: { code: type.code },
      update: {
        title: type.title,
        description: type.description,
        processingDays: type.processingDays,
        sortOrder: type.sortOrder,
        isActive: true,
      },
      create: {
        code: type.code,
        title: type.title,
        description: type.description,
        processingDays: type.processingDays,
        sortOrder: type.sortOrder,
      },
      select: { id: true, code: true },
    });

    types.set(record.code, record.id);
    summary.requestTypes += 1;
  }

  return types;
}

/**
 * Seed владеет демо-заявками студентов: прежние заявки удаляются вместе с историей
 * (каскад), уведомления категории «Заявки» — отдельной выборкой, затем данные
 * создаются заново. Запись создания (`null → NEW`) и переходы статусов
 * сопровождаются уведомлениями по контракту `P5-BE-02`.
 */
async function seedRequests(
  types: Map<string, string>,
  profiles: Map<string, string>,
  userIds: Map<string, string>,
  disciplines: Map<string, string>,
  summary: SeedSummary,
) {
  const profileIds = [...profiles.values()];

  await prisma.notification.deleteMany({
    where: { category: "REQUESTS", audienceStudentId: { in: profileIds } },
  });
  await prisma.request.deleteMany({ where: { studentId: { in: profileIds } } });

  // Счётчик года поднимается до демо-диапазона, но не откатывает уже выданные
  // номера: повторный seed идемпотентен, а реальная выдача продолжается выше.
  const year = getMoscowYear(new Date());

  await prisma.$executeRaw`
    INSERT INTO "request_number_sequence" ("year", "lastNumber")
    VALUES (${year}, ${DEMO_REQUEST_LAST_NUMBER})
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = GREATEST("request_number_sequence"."lastNumber", ${DEMO_REQUEST_LAST_NUMBER})
  `;

  for (const demo of DEMO_REQUESTS) {
    const studentId = profiles.get(demo.studentEmail);
    const typeId = types.get(demo.typeCode);
    const type = REQUEST_TYPES.find((item) => item.code === demo.typeCode);

    if (!studentId) {
      throw new Error(`Не найден профиль студента ${demo.studentEmail}`);
    }
    if (!typeId || !type) {
      throw new Error(`Не найден тип заявки ${demo.typeCode}`);
    }

    const number = `З-${year}-${String(demo.numberSuffix).padStart(6, "0")}`;
    const createdAt = moscowDaysAgo(demo.daysAgo, demo.time);
    const lastTransition = demo.transitions[demo.transitions.length - 1];
    const updatedAt = lastTransition
      ? moscowDaysAgo(lastTransition.daysAgo, lastTransition.time)
      : createdAt;

    const request = await prisma.request.create({
      data: {
        number,
        studentId,
        typeId,
        status: demo.status,
        payload: demo.payload(disciplines),
        dueAt: addMoscowWorkingDays(createdAt, type.processingDays),
        createdAt,
        updatedAt,
        ...(demo.rejectionReason ? { rejectionReason: demo.rejectionReason } : {}),
      },
      select: { id: true, number: true },
    });
    summary.requests += 1;

    const creation = await prisma.requestStatusHistory.create({
      data: { requestId: request.id, toStatus: "NEW", createdAt },
      select: { id: true },
    });
    summary.requestHistory += 1;

    // Создание заявки сопровождается тем же уведомлением, что и в рантайме.
    const createdContent = buildRequestCreatedNotification(request.number);
    await prisma.notification.create({
      data: {
        category: "REQUESTS",
        priority: createdContent.priority,
        title: createdContent.title,
        body: createdContent.body,
        audienceType: "STUDENT",
        audienceStudentId: studentId,
        targetType: "REQUEST",
        targetId: request.id,
        dedupeKey: getRequestStatusDedupeKey(request.id, creation.id),
        publishedAt: createdAt,
      },
    });
    summary.notifications += 1;

    for (const transition of demo.transitions) {
      const changedAt = moscowDaysAgo(transition.daysAgo, transition.time);
      const entry = await prisma.requestStatusHistory.create({
        data: {
          requestId: request.id,
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          comment: transition.comment ?? null,
          changedById: transition.byStudent ? (userIds.get(demo.studentEmail) ?? null) : null,
          createdAt: changedAt,
        },
        select: { id: true },
      });
      summary.requestHistory += 1;

      const notification = buildRequestStatusNotification(transition.toStatus, request.number);
      await prisma.notification.create({
        data: {
          category: "REQUESTS",
          priority: notification.priority,
          title: notification.title,
          body: notification.body,
          audienceType: "STUDENT",
          audienceStudentId: studentId,
          targetType: "REQUEST",
          targetId: request.id,
          dedupeKey: getRequestStatusDedupeKey(request.id, entry.id),
          publishedAt: changedAt,
        },
      });
      summary.notifications += 1;
    }
  }
}

async function main() {
  const summary: SeedSummary = {
    created: 0,
    updated: 0,
    profiles: 0,
    lessons: 0,
    changes: 0,
    semesters: 0,
    grades: 0,
    exams: 0,
    requestTypes: 0,
    requests: 0,
    requestHistory: 0,
    notifications: 0,
  };

  const faculties = new Map<string, string>();
  for (const faculty of FACULTIES) {
    const record = await prisma.faculty.upsert({
      where: { code: faculty.code },
      update: { name: faculty.name },
      create: { code: faculty.code, name: faculty.name },
      select: { id: true, code: true },
    });
    faculties.set(record.code, record.id);
  }

  const programs = new Map<string, string>();
  for (const program of PROGRAMS) {
    const facultyId = faculties.get(program.facultyCode);
    if (!facultyId) {
      throw new Error(`Не найден факультет ${program.facultyCode}`);
    }

    const record = await prisma.program.upsert({
      where: { code: program.code },
      update: { name: program.name, facultyId },
      create: { code: program.code, name: program.name, facultyId },
      select: { id: true, code: true },
    });
    programs.set(record.code, record.id);
  }

  const groups = new Map<string, string>();
  for (const group of GROUPS) {
    const programId = programs.get(group.programCode);
    if (!programId) {
      throw new Error(`Не найдено направление ${group.programCode}`);
    }

    const record = await prisma.group.upsert({
      where: { code: group.code },
      update: { programId },
      create: { code: group.code, programId },
      select: { id: true, code: true },
    });
    groups.set(record.code, record.id);
  }

  const profiles = new Map<string, string>();
  const userIds = new Map<string, string>();

  for (const student of DEMO_STUDENTS) {
    const facultyId = faculties.get(student.facultyCode);
    const programId = programs.get(student.programCode);
    const groupId = groups.get(student.groupCode);

    if (!facultyId || !programId || !groupId) {
      throw new Error(`Неполные справочники для ${student.email}`);
    }

    const userId = await ensureDemoStudent(student, summary);

    const profile = await prisma.studentProfile.upsert({
      where: { userId },
      update: {
        studentNumber: student.studentNumber,
        facultyId,
        programId,
        groupId,
        course: student.course,
        studyForm: student.studyForm,
        subgroup: student.subgroup,
        enrolledAt: student.enrolledAt,
      },
      create: {
        userId,
        studentNumber: student.studentNumber,
        facultyId,
        programId,
        groupId,
        course: student.course,
        studyForm: student.studyForm,
        subgroup: student.subgroup,
        enrolledAt: student.enrolledAt,
      },
      select: { id: true },
    });
    profiles.set(student.email, profile.id);
    userIds.set(student.email, userId);
    summary.profiles += 1;
  }

  const teachers = new Map<string, string>();
  for (const teacher of TEACHERS) {
    const record = await prisma.teacher.upsert({
      where: { email: teacher.email },
      update: { fullName: teacher.fullName },
      create: { email: teacher.email, fullName: teacher.fullName },
      select: { id: true, email: true },
    });
    if (record.email) {
      teachers.set(record.email, record.id);
    }
  }

  const disciplines = new Map<string, string>();
  for (const discipline of DISCIPLINES) {
    const teacherId = teachers.get(discipline.teacherEmail);
    if (!teacherId) {
      throw new Error(`Не найден преподаватель ${discipline.teacherEmail}`);
    }

    const record = await prisma.discipline.upsert({
      where: { code: discipline.code },
      update: { name: discipline.name, teacherId },
      create: { code: discipline.code, name: discipline.name, teacherId },
      select: { id: true, code: true },
    });
    disciplines.set(record.code, record.id);
  }

  const rooms = new Map<string, string>();
  for (const building of BUILDINGS) {
    const buildingRecord = await prisma.building.upsert({
      where: { code: building.code },
      update: { name: building.name, address: building.address },
      create: { code: building.code, name: building.name, address: building.address },
      select: { id: true, code: true },
    });

    for (const room of building.rooms) {
      const roomRecord = await prisma.room.upsert({
        where: {
          buildingId_number: {
            buildingId: buildingRecord.id,
            number: room.number,
          },
        },
        update: { name: room.name, capacity: room.capacity },
        create: {
          buildingId: buildingRecord.id,
          number: room.number,
          name: room.name,
          capacity: room.capacity,
        },
        select: { id: true },
      });
      rooms.set(`${buildingRecord.code}:${room.number}`, roomRecord.id);
    }
  }

  await seedSchedule(groups, teachers, disciplines, rooms, summary);

  const demo = getDemoSemesters();
  const semesters = {
    current: await ensureDemoSemester(demo.current),
    past: await ensureDemoSemester(demo.past),
  };
  await seedGrades(semesters, profiles, groups, teachers, disciplines, rooms, summary);

  const requestTypes = await seedRequestTypes(summary);
  await seedRequests(requestTypes, profiles, userIds, disciplines, summary);

  console.log(
    `Seed завершён: пользователей создано ${summary.created}, обновлено ${summary.updated}, профилей обработано ${summary.profiles}, занятий создано ${summary.lessons}, изменений ${summary.changes}, семестров ${summary.semesters}, оценок ${summary.grades}, экзаменов ${summary.exams}, типов заявок ${summary.requestTypes}, заявок ${summary.requests}, записей истории ${summary.requestHistory}, уведомлений ${summary.notifications}.`,
  );
}

main()
  .catch((error: unknown) => {
    // Не печатаем объект ошибки целиком: в нём могут быть входные данные.
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    console.error(`Seed завершился с ошибкой: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
