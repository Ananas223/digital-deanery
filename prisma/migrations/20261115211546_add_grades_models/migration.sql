-- CreateEnum
CREATE TYPE "SemesterTerm" AS ENUM ('AUTUMN', 'SPRING');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('EXAM', 'CREDIT', 'GRADED_CREDIT', 'COURSEWORK');

-- CreateEnum
CREATE TYPE "GradeStatus" AS ENUM ('PASSED', 'FAILED', 'NOT_GRADED');

-- CreateTable
CREATE TABLE "semester" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" "SemesterTerm" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "assessmentType" "AssessmentType" NOT NULL,
    "credits" INTEGER NOT NULL,
    "score" INTEGER,
    "status" "GradeStatus" NOT NULL DEFAULT 'NOT_GRADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "assessmentType" "AssessmentType" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "roomId" TEXT,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semester_startsAt_idx" ON "semester"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "semester_academicYear_term_key" ON "semester"("academicYear", "term");

-- CreateIndex
CREATE INDEX "grade_studentProfileId_semesterId_idx" ON "grade"("studentProfileId", "semesterId");

-- CreateIndex
CREATE INDEX "grade_disciplineId_idx" ON "grade"("disciplineId");

-- CreateIndex
CREATE UNIQUE INDEX "grade_studentProfileId_disciplineId_semesterId_key" ON "grade"("studentProfileId", "disciplineId", "semesterId");

-- CreateIndex
CREATE INDEX "exam_groupId_startsAt_idx" ON "exam"("groupId", "startsAt");

-- CreateIndex
CREATE INDEX "exam_semesterId_startsAt_idx" ON "exam"("semesterId", "startsAt");

-- CreateIndex
CREATE INDEX "exam_disciplineId_idx" ON "exam"("disciplineId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_groupId_disciplineId_semesterId_key" ON "exam"("groupId", "disciplineId", "semesterId");

-- AddForeignKey
ALTER TABLE "grade" ADD CONSTRAINT "grade_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade" ADD CONSTRAINT "grade_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade" ADD CONSTRAINT "grade_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam" ADD CONSTRAINT "exam_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam" ADD CONSTRAINT "exam_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam" ADD CONSTRAINT "exam_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam" ADD CONSTRAINT "exam_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam" ADD CONSTRAINT "exam_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
