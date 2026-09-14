CREATE TYPE "DocumentVariant" AS ENUM ('DESKTOP', 'MOBILE');
ALTER TABLE "DocumentVersion" ADD COLUMN "mobileFile" TEXT, ADD COLUMN "mobileName" TEXT, ADD COLUMN "mobileNumPages" INTEGER, ADD COLUMN "mobileEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentPage" ADD COLUMN "variant" "DocumentVariant" NOT NULL DEFAULT 'DESKTOP';
DROP INDEX "DocumentPage_pageNumber_versionId_key";
CREATE UNIQUE INDEX "DocumentPage_pageNumber_versionId_variant_key" ON "DocumentPage"("pageNumber", "versionId", "variant");
ALTER TABLE "View" ADD COLUMN "documentVersionId" TEXT, ADD COLUMN "versionNumber" INTEGER, ADD COLUMN "variant" "DocumentVariant" NOT NULL DEFAULT 'DESKTOP', ADD COLUMN "numPages" INTEGER, ADD COLUMN "file" TEXT;
ALTER TABLE "PageEvent" ADD COLUMN "variant" "DocumentVariant" NOT NULL DEFAULT 'DESKTOP';
