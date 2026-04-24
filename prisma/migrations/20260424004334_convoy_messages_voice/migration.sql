-- AlterTable
ALTER TABLE "convoy_messages" ADD COLUMN     "audioData" TEXT,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'text',
ALTER COLUMN "message" DROP NOT NULL;
