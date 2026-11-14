-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('LECTURE', 'PRACTICE', 'LABORATORY', 'SEMINAR');

-- CreateEnum
CREATE TYPE "LessonSubgroup" AS ENUM ('ALL', 'FIRST', 'SECOND');

-- CreateEnum
CREATE TYPE "LessonChangeType" AS ENUM ('CANCELLATION', 'TIME_CHANGE', 'ROOM_CHANGE', 'TEACHER_CHANGE', 'LESSON_REPLACEMENT');

-- CreateTable
CREATE TABLE "teacher" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "LessonType" NOT NULL,
    "subgroup" "LessonSubgroup" NOT NULL DEFAULT 'ALL',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_change" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "LessonChangeType" NOT NULL,
    "reason" TEXT,
    "newStartsAt" TIMESTAMP(3),
    "newEndsAt" TIMESTAMP(3),
    "newRoomId" TEXT,
    "newTeacherId" TEXT,
    "replacementDisciplineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_email_key" ON "teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "discipline_code_key" ON "discipline"("code");

-- CreateIndex
CREATE INDEX "discipline_teacherId_idx" ON "discipline"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "building_code_key" ON "building"("code");

-- CreateIndex
CREATE INDEX "room_buildingId_idx" ON "room"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "room_buildingId_number_key" ON "room"("buildingId", "number");

-- CreateIndex
CREATE INDEX "lesson_groupId_startsAt_idx" ON "lesson"("groupId", "startsAt");

-- CreateIndex
CREATE INDEX "lesson_teacherId_startsAt_idx" ON "lesson"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "lesson_roomId_startsAt_idx" ON "lesson"("roomId", "startsAt");

-- CreateIndex
CREATE INDEX "lesson_disciplineId_idx" ON "lesson"("disciplineId");

-- CreateIndex
CREATE INDEX "lesson_change_lessonId_createdAt_idx" ON "lesson_change"("lessonId", "createdAt");

-- AddForeignKey
ALTER TABLE "discipline" ADD CONSTRAINT "discipline_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room" ADD CONSTRAINT "room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_change" ADD CONSTRAINT "lesson_change_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_change" ADD CONSTRAINT "lesson_change_newRoomId_fkey" FOREIGN KEY ("newRoomId") REFERENCES "room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_change" ADD CONSTRAINT "lesson_change_newTeacherId_fkey" FOREIGN KEY ("newTeacherId") REFERENCES "teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_change" ADD CONSTRAINT "lesson_change_replacementDisciplineId_fkey" FOREIGN KEY ("replacementDisciplineId") REFERENCES "discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
