import prisma from '@/lib/prisma';
export async function publishPageView(event:{id:string;linkId:string;documentId:string;viewId:string;dataroomId?:string|null;versionNumber?:number;variant?:"DESKTOP"|"MOBILE";time:number;duration:number;pageNumber:string}){
 const {id,linkId,documentId,viewId,dataroomId,versionNumber,variant,time,duration,pageNumber}=event;
 await prisma.pageEvent.create({data:{id,linkId,documentId,viewId,dataroomId,versionNumber,variant,time:new Date(time),duration,pageNumber}});
}
