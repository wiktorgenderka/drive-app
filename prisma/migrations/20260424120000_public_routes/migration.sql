-- AlterTable
ALTER TABLE "routes"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "importedFromId" TEXT;

-- CreateIndex
CREATE INDEX "routes_isPublic_publishedAt_idx" ON "routes"("isPublic", "publishedAt");

-- AddForeignKey
ALTER TABLE "routes"
  ADD CONSTRAINT "routes_importedFromId_fkey"
  FOREIGN KEY ("importedFromId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
