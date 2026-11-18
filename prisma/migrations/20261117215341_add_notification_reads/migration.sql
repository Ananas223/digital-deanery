-- CreateTable
CREATE TABLE "notification_read" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_read_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_read_userId_readAt_idx" ON "notification_read"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_read_notificationId_userId_key" ON "notification_read"("notificationId", "userId");

-- CreateIndex
CREATE INDEX "notification_category_publishedAt_idx" ON "notification"("category", "publishedAt");

-- AddForeignKey
ALTER TABLE "notification_read" ADD CONSTRAINT "notification_read_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_read" ADD CONSTRAINT "notification_read_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
