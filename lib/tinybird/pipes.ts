// Same interface as the upstream analytics pipes, backed by local Postgres.
import prisma from '@/lib/prisma';
type Filter={excludedLinkIds:string[];excludedViewIds:string[];since:number};
const filters=(p:Filter)=>({linkId:{notIn:p.excludedLinkIds},viewId:{notIn:p.excludedViewIds},time:{gte:new Date(p.since)}});
export async function getTotalAvgPageDuration(p:Filter & {documentId:string}) {
 const totals=await prisma.pageEvent.groupBy({by:['versionNumber','pageNumber','viewId'],where:{documentId:p.documentId,...filters(p)},_sum:{duration:true}});
 const groups=new Map<string,{versionNumber:number;pageNumber:string;sum:number;count:number}>();
 for(const r of totals){const key=`${r.versionNumber}:${r.pageNumber}`;const g=groups.get(key)||{versionNumber:r.versionNumber,pageNumber:r.pageNumber,sum:0,count:0};g.sum+=r._sum.duration||0;g.count++;groups.set(key,g);}
 return {data:Array.from(groups.values()).map(g=>({versionNumber:g.versionNumber,pageNumber:g.pageNumber,avg_duration:g.sum/g.count})).sort((a,b)=>a.versionNumber-b.versionNumber || Number(a.pageNumber)-Number(b.pageNumber))};
}
export async function getViewPageDuration(p:{documentId:string;viewId:string;since:number}){
 const data=await prisma.pageEvent.groupBy({by:['pageNumber'],where:{documentId:p.documentId,viewId:p.viewId,time:{gte:new Date(p.since)}},_sum:{duration:true}});
 return {data:data.map(r=>({pageNumber:r.pageNumber,sum_duration:r._sum.duration||0}))};
}
export async function getTotalDataroomDuration(p:Filter & {dataroomId:string}){
 const data=await prisma.pageEvent.groupBy({by:['viewId'],where:{dataroomId:p.dataroomId,...filters(p)},_sum:{duration:true}});
 return {data:data.map(r=>({viewId:r.viewId,sum_duration:r._sum.duration||0}))};
}
