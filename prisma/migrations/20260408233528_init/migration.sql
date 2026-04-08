-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConvoyRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('POLICE', 'UNMARKED_POLICE', 'SPEED_TRAP', 'ACCIDENT', 'OBSTACLE', 'SPEED_CAMERA');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL_95', 'PETROL_98', 'DIESEL', 'LPG');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "image" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "lastLocationUpdate" TIMESTAMP(3),
    "spotifyAccessToken" TEXT,
    "spotifyRefreshToken" TEXT,
    "spotifyExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convoys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convoys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convoy_members" (
    "id" TEXT NOT NULL,
    "convoyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ConvoyRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convoy_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_votes" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isUpvote" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_stations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "fuel_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_prices" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "fuel_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "waypoints" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "convoyId" TEXT,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "friendships_addresseeId_idx" ON "friendships"("addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requesterId_addresseeId_key" ON "friendships"("requesterId", "addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "convoy_members_convoyId_userId_key" ON "convoy_members"("convoyId", "userId");

-- CreateIndex
CREATE INDEX "reports_latitude_longitude_idx" ON "reports"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "reports_expiresAt_idx" ON "reports"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "report_votes_reportId_userId_key" ON "report_votes"("reportId", "userId");

-- CreateIndex
CREATE INDEX "fuel_stations_latitude_longitude_idx" ON "fuel_stations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "fuel_prices_stationId_fuelType_idx" ON "fuel_prices"("stationId", "fuelType");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convoys" ADD CONSTRAINT "convoys_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convoy_members" ADD CONSTRAINT "convoy_members_convoyId_fkey" FOREIGN KEY ("convoyId") REFERENCES "convoys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convoy_members" ADD CONSTRAINT "convoy_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_votes" ADD CONSTRAINT "report_votes_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_votes" ADD CONSTRAINT "report_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_prices" ADD CONSTRAINT "fuel_prices_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "fuel_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_prices" ADD CONSTRAINT "fuel_prices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_convoyId_fkey" FOREIGN KEY ("convoyId") REFERENCES "convoys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
