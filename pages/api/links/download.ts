import { NextApiRequest,NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { viewerSession,localFileUrl } from '@/lib/self-host-access';
export default async function handle(req:NextApiRequest,res:NextApiResponse){
 if(req.method!=='POST')return res.status(405).end();
 const link=await prisma.link.findUnique({where:{id:String(req.body.linkId||'')}});
 const session=link && await viewerSession(req,link);
 if(!link?.allowDownload || !session)return res.status(403).end();
 const view=await prisma.view.findFirst({where:{id:String(req.body.viewId||''),linkId:link.id,viewerEmail:session.email}});
 if(!view?.documentId)return res.status(403).end();
 const version=await prisma.documentVersion.findFirst({where:{documentId:view.documentId,isPrimary:true},orderBy:{versionNumber:'desc'}});
 if(!version)return res.status(404).end();
 await prisma.view.update({where:{id:view.id},data:{downloadedAt:new Date()}});
 res.json({downloadUrl:localFileUrl(version.file,link.id,true)});
}
