-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'READY', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('DEANERY', 'SCHEDULE', 'REQUESTS', 'DEADLINES');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'IMPORTANT');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('STUDENT', 'GROUP', 'FACULTY');

-- CreateEnum
CREATE TYPE "NotificationTarget" AS ENUM ('REQUEST', 'LESSON', 'SECTION', 'NONE');

-- CreateTable
CREATE TABLE "request_type" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "processingDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "payload" JSONB NOT NULL,
    "clientRequestId" TEXT,
    "dueAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "comment" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_number_sequence" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "request_number_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceType" "NotificationAudience" NOT NULL,
    "audienceStudentId" TEXT,
    "audienceGroupId" TEXT,
    "audienceFacultyId" TEXT,
    "targetType" "NotificationTarget" NOT NULL DEFAULT 'NONE',
    "targetId" TEXT,
    "dedupeKey" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_type_code_key" ON "request_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "request_number_key" ON "request"("number");

-- CreateIndex
CREATE INDEX "request_studentId_createdAt_idx" ON "request"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "request_status_createdAt_idx" ON "request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "request_typeId_idx" ON "request"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "request_studentId_clientRequestId_key" ON "request"("studentId", "clientRequestId");

-- CreateIndex
CREATE INDEX "request_status_history_requestId_createdAt_idx" ON "request_status_history"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_dedupeKey_key" ON "notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "notification_audienceStudentId_publishedAt_idx" ON "notification"("audienceStudentId", "publishedAt");

-- CreateIndex
CREATE INDEX "notification_audienceGroupId_publishedAt_idx" ON "notification"("audienceGroupId", "publishedAt");

-- CreateIndex
CREATE INDEX "notification_audienceType_publishedAt_idx" ON "notification"("audienceType", "publishedAt");

-- CreateIndex
CREATE INDEX "notification_targetType_targetId_idx" ON "notification"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "request_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_audienceStudentId_fkey" FOREIGN KEY ("audienceStudentId") REFERENCES "student_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_audienceGroupId_fkey" FOREIGN KEY ("audienceGroupId") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_audienceFacultyId_fkey" FOREIGN KEY ("audienceFacultyId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
