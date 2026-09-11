import path from 'node:path';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import prisma from '@/lib/prisma';
export const root = process.env.DOCUMENT_ROOT || '/data/documents';
export function localPath(key:string) {
 if(!/^[a-zA-Z0-9_-]+\/(original\.pdf|page-\d+\.(jpg|png))$/.test(key)) throw new Error('Invalid file key');
 return path.join(root,key);
}
const run=promisify(execFile);
export async function processLocalVersion(versionId:string) {
 const v=await prisma.documentVersion.findUniqueOrThrow({where:{id:versionId}});
 const key=v.file; const file=localPath(key); const dir=path.dirname(file);
 const {stdout}=await run('pdfinfo',[file],{timeout:15000});
 const count=Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
 if(!count || count>300) throw new Error('PDF must contain 1 to 300 pages');
 await run('pdftoppm',['-jpeg','-r','120','-scale-to','1800',file,path.join(dir,'page')],{timeout:120000});
 const files=(await readdir(dir)).filter(x=>/^page-\d+\.jpg$/.test(x));
 await prisma.$transaction(async tx=>{
  await tx.documentPage.deleteMany({where:{versionId}});
  await tx.documentPage.createMany({data:files.map(name=>({versionId,pageNumber:Number(name.match(/(\d+)\.jpg$/)![1]),file:`${key.split('/')[0]}/${name}`,storageType:'LOCAL_PATH',embeddedLinks:[]}))});
  await tx.documentVersion.updateMany({where:{documentId:v.documentId},data:{isPrimary:false}});
  await tx.documentVersion.update({where:{id:versionId},data:{hasPages:true,isPrimary:true,numPages:count}});
  await tx.document.update({where:{id:v.documentId},data:{file:key,storageType:'LOCAL_PATH',numPages:count}});
 },{timeout:30000});
}
