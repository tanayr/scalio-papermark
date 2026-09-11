import { NextApiRequest,NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 try{await prisma.$queryRaw`SELECT 1`;res.json({status:'ok',app:'Scalio Papermark'});}catch{res.status(503).json({status:'unavailable'});}
}
