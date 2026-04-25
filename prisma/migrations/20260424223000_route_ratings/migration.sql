-- AlterTable
ALTER TABLE "routes"
  ADD COLUMN "avgRating" DOUBLE PRECISION,
  ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "routes_isPublic_avgRating_ratingCount_idx" ON "routes"("isPublic", "avgRating", "ratingCount");

-- CreateTable
CREATE TABLE "route_ratings" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stars" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "route_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_ratings_routeId_userId_key" ON "route_ratings"("routeId", "userId");
CREATE INDEX "route_ratings_routeId_idx" ON "route_ratings"("routeId");

-- AddForeignKey
ALTER TABLE "route_ratings"
  ADD CONSTRAINT "route_ratings_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "route_ratings"
  ADD CONSTRAINT "route_ratings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
