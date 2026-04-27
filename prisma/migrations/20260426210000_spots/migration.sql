-- CreateEnum
CREATE TYPE "SpotKind" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SpotVisibility" AS ENUM ('FRIENDS', 'PUBLIC');

-- CreateTable
CREATE TABLE "spots" (
  "id" TEXT NOT NULL,
  "kind" "SpotKind" NOT NULL,
  "visibility" "SpotVisibility" NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "spots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spots_visibility_closedAt_expiresAt_idx" ON "spots"("visibility", "closedAt", "expiresAt");
CREATE INDEX "spots_createdById_createdAt_idx" ON "spots"("createdById", "createdAt");
CREATE INDEX "spots_latitude_longitude_idx" ON "spots"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "spots"
  ADD CONSTRAINT "spots_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
