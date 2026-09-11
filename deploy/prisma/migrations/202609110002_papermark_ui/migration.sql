CREATE TABLE "PageEvent" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "linkId" TEXT NOT NULL,
 "documentId" TEXT NOT NULL,
 "viewId" TEXT NOT NULL,
 "dataroomId" TEXT,
 "versionNumber" INTEGER NOT NULL DEFAULT 1,
 "time" TIMESTAMP(3) NOT NULL,
 "duration" INTEGER NOT NULL,
 "pageNumber" TEXT NOT NULL
);
CREATE INDEX "PageEvent_documentId_time_idx" ON "PageEvent"("documentId", "time");
CREATE INDEX "PageEvent_viewId_idx" ON "PageEvent"("viewId");
CREATE INDEX "PageEvent_dataroomId_time_idx" ON "PageEvent"("dataroomId", "time");
