import { NextApiRequest,NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import prisma from '@/lib/prisma';
import { localPath,root } from '@/lib/local-storage';
import { viewerSession } from '@/lib/self-host-access';
import { randomUUID } from 'node:crypto';
import { mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import path from 'node:path';
export const config={api:{bodyParser:false,responseLimit:false}};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try {
 const session=await getServerSession(req,res,authOptions); const userId=(session?.user as any)?.id;
 if(req.method==='POST') {
  const teamId=String(req.query.teamId||'');
  if(!userId || !await prisma.userTeam.findUnique({where:{userId_teamId:{userId,teamId}}})) return res.status(401).end();
  const chunks:Buffer[]=[];let size=0;
  for await (const chunk of req){size+=chunk.length;if(size>40*1024*1024) return res.status(413).json({message:'Maximum PDF size is 40 MB'});chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);if(!bytes.subarray(0,8).toString().startsWith('%PDF-')) return res.status(400).json({message:'Upload a PDF file'});
  const id=randomUUID();await mkdir(path.join(root,id),{recursive:true});await writeFile(localPath(`${id}/original.pdf`),bytes,{mode:0o600});
  return res.json({type:'LOCAL_PATH',data:`${id}/original.pdf`});
 }
 if(req.method!=='GET')return res.status(405).end();
 const key=String(req.query.key||'');const file=localPath(key);
 const version=await prisma.documentVersion.findFirst({where:{OR:[{file:key},{mobileFile:key},{pages:{some:{file:key}}}]},include:{document:true,pages:{where:{file:key},select:{variant:true}}}});
 if(!version) return res.status(404).end();
 const member=userId && version.document.teamId && await prisma.userTeam.findUnique({where:{userId_teamId:{userId,teamId:version.document.teamId}}});
 if(!member) {
  const link=await prisma.link.findUnique({where:{id:String(req.query.linkId||'')}});
  if(!link || !await viewerSession(req,link))return res.status(403).end();
  const inScope=link.documentId===version.documentId || link.dataroomId && await prisma.dataroomDocument.findUnique({where:{dataroomId_documentId:{dataroomId:link.dataroomId,documentId:version.documentId}}});
  if(!inScope || !version.isPrimary || key.endsWith('.pdf') && !link.allowDownload)return res.status(403).end();
  const isMobile=key===version.mobileFile || version.pages.some(page=>page.variant==='MOBILE');
  if(isMobile && !version.mobileEnabled)return res.status(403).end();
 }
 const bytes=await readFile(file);res.setHeader('Content-Type',key.endsWith('.pdf')?'application/pdf':key.endsWith('.png')?'image/png':'image/jpeg');
 if(key.endsWith('.pdf'))res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(key===version.mobileFile?(version.mobileName || 'Mobile deck.pdf'):version.document.name)}`);
 return res.send(bytes);
 }catch(error){console.error('Local file request failed');return res.status(400).json({message:'File unavailable'});}
}
