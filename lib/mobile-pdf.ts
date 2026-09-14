import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentVersion } from "@prisma/client";
import prisma from "@/lib/prisma";
import { localPath, renderLocalPdf } from "@/lib/local-storage";

export class MobilePdfError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function removeFiles(key: string | null) {
  if (!key) return;
  await rm(path.dirname(localPath(key)), {
    recursive: true,
    force: true,
  }).catch(() => console.error("Unable to clean up detached mobile PDF"));
}

// Rendering happens in a fresh directory. Publish only after every page succeeds.
export async function uploadMobilePdf(
  version: DocumentVersion,
  bytes: Buffer,
  name: string,
) {
  if (!bytes.subarray(0, 8).toString().startsWith("%PDF-")) {
    throw new MobilePdfError("Choose a PDF file.");
  }
  const key = `${randomUUID()}/original.pdf`;
  await mkdir(path.dirname(localPath(key)), { recursive: true });
  try {
    await writeFile(localPath(key), bytes, { mode: 0o600 });
    let rendered;
    try {
      rendered = await renderLocalPdf(key);
    } catch {
      throw new MobilePdfError(
        "Unable to process this PDF. Use a readable PDF with 1–300 pages.",
      );
    }
    await prisma.$transaction(
      async (tx) => {
        const changed = await tx.documentVersion.updateMany({
          where: {
            id: version.id,
            isPrimary: true,
            updatedAt: version.updatedAt,
          },
          data: {
            mobileFile: key,
            mobileName: name.slice(0, 255),
            mobileNumPages: rendered.count,
            mobileEnabled: version.mobileEnabled,
          },
        });
        if (!changed.count)
          throw new MobilePdfError(
            "The document changed during upload. Refresh and try again.",
            409,
          );
        await tx.documentPage.deleteMany({
          where: { versionId: version.id, variant: "MOBILE" },
        });
        await tx.documentPage.createMany({
          data: rendered.pages.map((page) => ({
            ...page,
            versionId: version.id,
            variant: "MOBILE",
          })),
        });
      },
      { timeout: 30000 },
    );
  } catch (error) {
    await removeFiles(key);
    throw error;
  }
  await removeFiles(version.mobileFile);
}

export async function setMobilePdf(
  version: DocumentVersion,
  enabled: boolean | null,
) {
  if (enabled && (!version.mobileFile || !version.mobileNumPages)) {
    throw new MobilePdfError("Upload a mobile PDF before enabling it.");
  }
  await prisma.$transaction(async (tx) => {
    const changed = await tx.documentVersion.updateMany({
      where: { id: version.id, isPrimary: true, updatedAt: version.updatedAt },
      data:
        enabled === null
          ? {
              mobileFile: null,
              mobileName: null,
              mobileNumPages: null,
              mobileEnabled: false,
            }
          : { mobileEnabled: enabled },
    });
    if (!changed.count)
      throw new MobilePdfError(
        "The document changed. Refresh and try again.",
        409,
      );
    if (enabled === null)
      await tx.documentPage.deleteMany({
        where: { versionId: version.id, variant: "MOBILE" },
      });
  });
  if (enabled === null) await removeFiles(version.mobileFile);
}
