import { viewerSession } from "@/lib/self-host-access";
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // We only allow POST requests
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  // POST /api/record_reaction

  const { viewId, pageNumber, type } = req.body as {
    viewId: string;
    pageNumber: number;
    type: string;
  };

  const accessView = await prisma.view.findUnique({where:{id:String(viewId||"")},include:{link:true}});
  const accessSession = accessView && await viewerSession(req,accessView.link);
  if(!accessSession || accessSession.email !== accessView?.viewerEmail) return res.status(403).end();
  try {
    const reaction = await prisma.reaction.create({
      data: {
        viewId,
        pageNumber,
        type,
      },
    });

    if (!reaction) {
      res.status(500).json({ message: "Internal Server Error" });
      return;
    }

    res.status(200).json({ message: "Reaction recorded" });
    return;
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
    return;
  }
}
