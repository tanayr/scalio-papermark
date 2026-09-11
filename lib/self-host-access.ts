import { permit } from "@/lib/self-host-rate";
import prisma from '@/lib/prisma';
import { createHash, randomBytes } from 'node:crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import type { Link } from '@prisma/client';
import { checkPassword } from '@/lib/utils';
import { sendVerificationEmail } from '@/lib/emails/send-email-verification';
export const normalizedEmail = (v:unknown) => typeof v === 'string' ? v.trim().toLowerCase() : '';
export const hash = (s:string) => createHash('sha256').update(s).digest('hex');
export function emailAllowed(link:Link,email:string) {
 if(link.isArchived || link.expiresAt && link.expiresAt<=new Date()) return false;
 if(!link.emailProtected && !link.emailAuthenticated) return true;
 if(!email.includes('@')) return false;
 if(!link.emailAuthenticated) return true;
 const matches=(value:string)=>{const v=normalizedEmail(value);return v===email || v.startsWith('@') && email.endsWith(v);};
 return !link.denyList.some(matches) && (!link.allowList.length || link.allowList.some(matches));
}
export async function viewerSession(req:NextApiRequest,link:Link) {
 const token=req.cookies[`scalio-view-${link.id}`];
 if(!token) return null;
 const session=await prisma.accessSession.findUnique({where:{tokenHash:hash(token)}});
 if(!session || session.linkId!==link.id || session.expiresAt<=new Date() || !emailAllowed(link,session.email)) return null;
 // Proof and password state are part of the opaque token stored by hash.
 // Changing either part invalidates the lookup; clients cannot upgrade their proof.
 const parts=token.split('.');
 const legacy=/^[a-f0-9]{64}$/.test(token);
 const verified=legacy || parts[1]==='verified';
 if(!legacy && (parts[0]!=='v1' || parts[2]!==hash(link.password || ''))) return null;
 if(legacy && link.password && session.createdAt<link.updatedAt) return null;
 if(link.emailAuthenticated && !verified) return null;
 return {...session,verified};
}
async function createViewerSession(res:NextApiResponse,link:Link,email:string,verified:boolean) {
 const token=`v1.${verified?'verified':'unverified'}.${hash(link.password || '')}.${randomBytes(32).toString('hex')}`;
 await prisma.accessSession.create({data:{tokenHash:hash(token),email,linkId:link.id,expiresAt:new Date(Date.now()+8*3600e3)}});
 res.setHeader('Set-Cookie',`scalio-view-${link.id}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${process.env.NEXTAUTH_URL?.startsWith('https:')?'; Secure':''}`);
 return {email,verified};
}
export async function authorizeViewer(req:NextApiRequest,res:NextApiResponse,link:Link) {
 const existing=await viewerSession(req,link); if(existing) return {email:existing.email,verified:existing.verified};
 const email=link.emailProtected || link.emailAuthenticated ? normalizedEmail(req.body.email || req.body.verifiedEmail) : '';
 if(!emailAllowed(link,email)) {res.status(403).json({message:'This email does not have access to this link.'});return null;}
 if(link.password && !(typeof req.body.password==='string' && await checkPassword(req.body.password,link.password))) {res.status(403).json({message:'Invalid password.'});return null;}
 if(!link.emailAuthenticated) return createViewerSession(res,link,email,false);
 if(req.body.token) {
  const verification=await prisma.verificationToken.findFirst({where:{token:hash(String(req.body.token)),identifier:`${link.id}:${email}`,expires:{gt:new Date()}}});
  if(!verification) {res.status(401).json({message:'Verification link expired or invalid. Request a new one.'});return null;}
  // Token use is atomic; parallel replay cannot issue a second session.
  const consumed=await prisma.verificationToken.deleteMany({where:{token:verification.token}});
  if(!consumed.count){res.status(401).json({message:'Verification link already used.'});return null;}
  return createViewerSession(res,link,email,true);
 }
 if(!permit(`email:${email}`,10) || !permit(`ip:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`,60)){res.status(429).json({message:'Too many requests. Try again later.'});return null;}
 const recent=await prisma.verificationToken.findFirst({where:{identifier:`${link.id}:${email}`,expires:{gt:new Date(Date.now()+14*60e3)}}});
 if(!recent) {
  const token=randomBytes(32).toString('hex');
  await prisma.verificationToken.create({data:{token:hash(token),identifier:`${link.id}:${email}`,expires:new Date(Date.now()+15*60e3)}});
  try {await sendVerificationEmail(email,`${process.env.NEXT_PUBLIC_BASE_URL}/view/${link.dataroomId?'d/':''}${link.id}?token=${token}&email=${encodeURIComponent(email)}`);} catch(e){await prisma.verificationToken.deleteMany({where:{token:hash(token)}}); throw e;}
 }
 res.json({type:'email-verification',message:'Check your email to verify access.'});return null;
}
export function localFileUrl(key:string,linkId?:string,download=false){return `/api/file/local?key=${encodeURIComponent(key)}${linkId?`&linkId=${encodeURIComponent(linkId)}`:''}${download?'&download=1':''}`;}
