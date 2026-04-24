/*
  Warnings:

  - You are about to drop the column `spotifyAccessToken` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `spotifyExpiresAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `spotifyRefreshToken` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "friendships_addresseeId_idx";

-- DropIndex
DROP INDEX "reports_expiresAt_idx";

-- DropIndex
DROP INDEX "reports_latitude_longitude_idx";

-- AlterTable
ALTER TABLE "convoys" ADD COLUMN     "destLat" DOUBLE PRECISION,
ADD COLUMN     "destLng" DOUBLE PRECISION,
ADD COLUMN     "destName" TEXT;

-- AlterTable
ALTER TABLE "fuel_prices" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "spotifyAccessToken",
DROP COLUMN "spotifyExpiresAt",
DROP COLUMN "spotifyRefreshToken";

-- CreateTable
CREATE TABLE "spotify_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spotify_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "convoyId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "maxSpeedKmh" DOUBLE PRECISION NOT NULL,
    "avgSpeedKmh" DOUBLE PRECISION NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spotify_tokens_userId_key" ON "spotify_tokens"("userId");

-- CreateIndex
CREATE INDEX "trips_userId_createdAt_idx" ON "trips"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "convoys_ownerId_idx" ON "convoys"("ownerId");

-- CreateIndex
CREATE INDEX "friendships_requesterId_status_idx" ON "friendships"("requesterId", "status");

-- CreateIndex
CREATE INDEX "friendships_addresseeId_status_idx" ON "friendships"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "reports_userId_idx" ON "reports"("userId");

-- CreateIndex
CREATE INDEX "reports_expiresAt_latitude_longitude_idx" ON "reports"("expiresAt", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "routes_userId_createdAt_idx" ON "routes"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "spotify_tokens" ADD CONSTRAINT "spotify_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
