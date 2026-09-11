import { sendViewedDocumentEmail } from "@/lib/emails/send-viewed-document";
import { permit } from "@/lib/self-host-rate";
import { NextApiRequest,NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { authorizeViewer,localFileUrl } from '@/lib/self-host-access';
export default async function handle(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).end();
 try{
 const link=await prisma.link.findUnique({where:{id:String(req.body.linkId||'')}});
 if(!link || link.isArchived || link.expiresAt && link.expiresAt<=new Date())return res.status(404).json({message:'Link unavailable.'});
 const access=await authorizeViewer(req,res,link);if(!access)return;
 const {email,verified}=access;
 let viewerId:string|undefined;
 if(link.dataroomId && email){
  const viewer=await prisma.viewer.upsert({where:{dataroomId_email:{dataroomId:link.dataroomId,email}},update:verified?{verified:true}:{},create:{dataroomId:link.dataroomId,email,verified}});viewerId=viewer.id;
 }
 if(link.dataroomId && req.body.viewType==='DATAROOM_VIEW'){
  const room=await prisma.dataroom.findUniqueOrThrow({where:{id:link.dataroomId},include:{folders:{orderBy:{name:'asc'}},documents:{include:{document:{include:{versions:{where:{isPrimary:true},take:1,select:{id:true,type:true,versionNumber:true,hasPages:true}}}}}}}});
  const view=await prisma.view.create({data:{linkId:link.id,dataroomId:room.id,viewerEmail:email,verified,viewerId,viewType:'DATAROOM_VIEW'}});
  return res.json({viewId:view.id,file:null,pages:null,notionData:null,dataroom:{id:room.id,name:room.name,lastUpdatedAt:room.updatedAt,folders:room.folders,documents:room.documents.map(d=>({id:d.document.id,name:d.document.name,versions:d.document.versions,folderId:d.folderId,dataroomDocumentId:d.id}))}});
 }
 const documentId=link.documentId || String(req.body.documentId||'');
 if(link.dataroomId && !await prisma.dataroomDocument.findUnique({where:{dataroomId_documentId:{dataroomId:link.dataroomId,documentId}}}))return res.status(403).json({message:'Document is not in this room.'});
 const version=await prisma.documentVersion.findFirst({where:{documentId,isPrimary:true},orderBy:{versionNumber:'desc'},include:{pages:{orderBy:{pageNumber:'asc'}}}});
 if(!version || !version.hasPages)return res.status(409).json({message:'Document preview is not ready.'});
 let dataroomViewId:string|undefined;
 if(link.dataroomId && req.body.dataroomViewId){const parent=await prisma.view.findFirst({where:{id:req.body.dataroomViewId,linkId:link.id,viewerEmail:email,viewType:'DATAROOM_VIEW'}});dataroomViewId=parent?.id;}
 const view=await prisma.view.create({data:{linkId:link.id,documentId,dataroomId:link.dataroomId,dataroomViewId,viewerEmail:email,verified,viewerId}});
 if(link.enableNotification && permit(`notify:${link.id}:${email}`,3)) {
  const document=await prisma.document.findUnique({where:{id:documentId},include:{owner:true}});
  if(document) await sendViewedDocumentEmail({ownerEmail:document.owner.email,documentId,documentName:document.name,viewerEmail:email});
 }
 return res.json({viewId:view.id,file:null,notionData:null,pages:version.pages.map(page=>({pageNumber:page.pageNumber,file:localFileUrl(page.file,link.id),embeddedLinks:page.embeddedLinks}))});
 }catch(e){console.error('Viewer request failed',e instanceof Error?e.message:'');return res.status(500).json({message:'Unable to open the document. Please try again.'});}
}
