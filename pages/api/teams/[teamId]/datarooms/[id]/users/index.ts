import { getServerSession } from "next-auth";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { errorhandler } from "@/lib/errorHandler";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { sendDataroomViewerInvite } from "@/lib/emails/send-dataroom-viewer-invite";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    // POST /api/teams/:teamId/datarooms/:id/users
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauhorized");
    }

    const { teamId, id: dataroomId } = req.query as {
      teamId: string;
      id: string;
    };

    const { emails } = req.body as { emails: string[] };

    if (!emails) {
      return res.status(400).json("Email is missing in request body");
    }

    try {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: (session.user as CustomUser).id,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!team) {
        return res.status(403).end("Unauthorized to access this team");
      }

      const dataroom = await prisma.dataroom.findUnique({
        where: {
          id: dataroomId,
          teamId: teamId,
        },
        include: {
          viewers: true,
          links: true,
        },
      });

      if (!dataroom) {
        return res.status(404).end("Dataroom not found");
      }

      const activeLink = dataroom.links.find(l => !l.isArchived && (!l.expiresAt || l.expiresAt > new Date()));
      if (!activeLink) return res.status(400).json({message:"Create a sharing link before inviting visitors."});
      const cleanEmails = [...new Set(emails.map(e => e.trim().toLowerCase()))];
      if (cleanEmails.length > 50 || cleanEmails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) return res.status(400).json({message:"Enter valid email addresses (up to 50)."});
      await prisma.link.update({where:{id:activeLink.id},data:{allowList:[...new Set([...activeLink.allowList,...cleanEmails])]}});
      await prisma.viewer.createMany({
        data: cleanEmails.map((email) => ({
          email,
          dataroomId,
          invitedAt: new Date(),
        })),
        skipDuplicates: true,
      });

      const viewers = await prisma.viewer.findMany({
        where: {
          dataroomId,
          email: {
            in: emails,
          },
        },
        select: {
          id: true,
          email: true,
        },
      });

      for (const email of cleanEmails) await sendDataroomViewerInvite({dataroomName:dataroom.name,senderEmail:(session.user as CustomUser).email || "Scalio",to:email,url:`${process.env.NEXT_PUBLIC_BASE_URL}/view/d/${activeLink.id}`});

      return res.status(200).json("Invitation sent!");
    } catch (error) {
      errorhandler(error, res);
    }
  }
}
