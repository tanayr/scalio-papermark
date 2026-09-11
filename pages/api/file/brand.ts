import {NextApiRequest,NextApiResponse} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/pages/api/auth/[...nextauth]';
import {root} from '@/lib/local-storage';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
export const config={api:{bodyParser:false}};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 try{
  if(req.method==='GET'){
   const name=String(req.query.name||'');if(!/^[a-f0-9-]{36}\.(png|jpg)$/.test(name))return res.status(404).end();
   res.setHeader('Content-Type',name.endsWith('.png')?'image/png':'image/jpeg');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public, max-age=86400');return res.send(await readFile(path.join(root,'branding',name)));
  }
  if(req.method!=='POST')return res.status(405).end();
  if(!await getServerSession(req,res,authOptions))return res.status(401).end();
  const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024)return res.status(413).end();chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);const ext=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216?'jpg':null;
  if(!ext)return res.status(400).json({message:'Upload a PNG or JPEG image.'});
  const name=`${randomUUID()}.${ext}`;await mkdir(path.join(root,'branding'),{recursive:true});await writeFile(path.join(root,'branding',name),bytes,{mode:0o600});return res.json({url:`/api/file/brand?name=${name}`});
 }catch{return res.status(404).end();}
}
