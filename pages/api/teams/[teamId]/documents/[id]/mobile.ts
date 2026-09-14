import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import type { CustomUser } from "@/lib/types";
import prisma from "@/lib/prisma";
import {
  MobilePdfError,
  setMobilePdf,
  uploadMobilePdf,
} from "@/lib/mobile-pdf";

export const config = { api: { bodyParser: false }, maxDuration: 180 };

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["POST", "PATCH", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", ["POST", "PATCH", "DELETE"]);
    return res.status(405).end();
  }
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) return res.status(401).end();
    const { teamId, id, versionId } = req.query;
    if (
      typeof teamId !== "string" ||
      typeof id !== "string" ||
      typeof versionId !== "string"
    ) {
      return res.status(400).json({ message: "Choose a document revision." });
    }
    const version = await prisma.documentVersion.findFirst({
      where: {
        id: versionId,
        documentId: id,
        isPrimary: true,
        document: {
          teamId,
          team: {
            users: { some: { userId: (session.user as CustomUser).id } },
          },
        },
      },
    });
    if (!version)
      return res
        .status(404)
        .json({
          message: "Document revision unavailable. Refresh and try again.",
        });
    if (
      version.storageType !== "LOCAL_PATH" ||
      !version.file.endsWith(".pdf")
    ) {
      return res
        .status(400)
        .json({ message: "Mobile versions are available for PDF documents." });
    }
    const maxBytes = req.method === "POST" ? 30 * 1024 * 1024 : 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes)
        throw new MobilePdfError("Maximum PDF size is 30 MB.", 413);
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    if (req.method === "POST") {
      let name = "Mobile deck.pdf";
      try {
        name = decodeURIComponent(String(req.headers["x-file-name"] || name));
      } catch {
        /* Use the default name. */
      }
      await uploadMobilePdf(version, bytes, name);
    } else if (req.method === "PATCH") {
      let body;
      try {
        body = JSON.parse(bytes.toString());
      } catch {
        throw new MobilePdfError("Invalid settings.");
      }
      if (typeof body?.enabled !== "boolean")
        throw new MobilePdfError("Choose whether to enable the mobile PDF.");
      await setMobilePdf(version, body.enabled);
    } else {
      await setMobilePdf(version, null);
    }
    return res.json({ success: true });
  } catch (error) {
    if (error instanceof MobilePdfError)
      return res.status(error.status).json({ message: error.message });
    console.error(
      "Mobile PDF update failed",
      error instanceof Error ? error.message : "",
    );
    return res
      .status(500)
      .json({ message: "Unable to update the mobile PDF. Please try again." });
  }
}
