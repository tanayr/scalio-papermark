import { permit } from "@/lib/self-host-rate";
import { NextApiRequest,NextApiResponse } from "next";
import NextAuth, { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { sendVerificationRequestEmail } from "@/lib/emails/send-verification-request";
export const authOptions: NextAuthOptions = {
 adapter: PrismaAdapter(prisma),
 pages: {signIn:"/login", error:"/login", verifyRequest:"/login?sent=true"},
 providers: [EmailProvider({ maxAge: 15 * 60, async sendVerificationRequest({identifier,url}) { await sendVerificationRequestEmail({email:identifier,url}); } })],
 session: {strategy:"jwt", maxAge: 8*60*60},
 callbacks: {
  async signIn({user}) { return (process.env.ADMIN_EMAILS || "").split(",").map(x=>x.trim().toLowerCase()).includes(user.email?.toLowerCase() || ""); },
  async jwt({token,user}) { if(user) token.user={id:user.id,email:user.email,name:user.name,image:user.image}; return token; },
  async session({session,token}) { session.user = { ...(token.user as object), id:token.sub } as any; return session; }
 }
};
const handler=NextAuth(authOptions);
export default async function auth(req:NextApiRequest,res:NextApiResponse){
 if(req.method==='POST' && req.query.nextauth?.[0]==='signin' && !permit(`admin:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`,30)) return res.status(429).json({error:'Too many requests'});
 return handler(req,res);
}
