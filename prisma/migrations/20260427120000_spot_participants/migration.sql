-- AlterTable
ALTER TABLE "users" ADD COLUMN "speed" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "spot_participants" (
  "id" TEXT NOT NULL,
  "spotId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "spot_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spot_participants_spotId_userId_key" ON "spot_participants"("spotId", "userId");
CREATE INDEX "spot_participants_userId_leftAt_idx" ON "spot_participants"("userId", "leftAt");

-- AddForeignKey
ALTER TABLE "spot_participants"
  ADD CONSTRAINT "spot_participants_spotId_fkey"
  FOREIGN KEY ("spotId") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "spot_participants"
  ADD CONSTRAINT "spot_participants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
