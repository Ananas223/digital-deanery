CREATE TYPE "NotificationSource" AS ENUM ('DEANERY', 'SCHEDULE_SYSTEM', 'REQUESTS_SYSTEM', 'ACADEMIC_CALENDAR');

ALTER TABLE "notification" ADD COLUMN "source" "NotificationSource";
ALTER TABLE "exam" ADD COLUMN "previousStartsAt" TIMESTAMP(3);

CREATE TABLE "session_publication" (
    "semesterId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "expectedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "session_publication_pkey" PRIMARY KEY ("semesterId", "groupId")
);

ALTER TABLE "session_publication" ADD CONSTRAINT "session_publication_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_publication" ADD CONSTRAINT "session_publication_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
