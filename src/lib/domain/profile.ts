import "server-only";

import { prisma } from "@/lib/db/prisma";

export type StudyForm = "BUDGET" | "PAID";

export type StudentProfile = {
  fullName: string;
  email: string;
  faculty: string;
  program: string;
  group: string;
  course: number;
  studyForm: StudyForm;
  studentNumber: string;
};

const STUDY_FORM_LABELS: Record<StudyForm, string> = {
  BUDGET: "Бюджетная основа",
  PAID: "Платная основа",
};

export function getStudyFormLabel(value: StudyForm): string {
  return STUDY_FORM_LABELS[value];
}

/**
 * Читает академический профиль текущего студента.
 *
 * `userId` берётся только из проверенной серверной сессии: клиентский
 * идентификатор сюда не передаётся (`AGENTS.md` § 3.2). Если профиль не
 * найден, возвращаем `null`, а страница показывает нейтральное пояснение.
 */
export async function getStudentProfile(userId: string): Promise<StudentProfile | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      studentNumber: true,
      course: true,
      studyForm: true,
      faculty: { select: { name: true } },
      program: { select: { name: true } },
      group: { select: { code: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!profile) {
    return null;
  }

  return {
    fullName: profile.user.name,
    email: profile.user.email,
    faculty: profile.faculty.name,
    program: profile.program.name,
    group: profile.group.code,
    course: profile.course,
    studyForm: profile.studyForm,
    studentNumber: profile.studentNumber,
  };
}
