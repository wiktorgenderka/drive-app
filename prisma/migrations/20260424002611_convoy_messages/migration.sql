-- CreateTable
CREATE TABLE "convoy_messages" (
    "id" TEXT NOT NULL,
    "convoyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convoy_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "convoy_messages_convoyId_createdAt_idx" ON "convoy_messages"("convoyId", "createdAt");

-- AddForeignKey
ALTER TABLE "convoy_messages" ADD CONSTRAINT "convoy_messages_convoyId_fkey" FOREIGN KEY ("convoyId") REFERENCES "convoys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
