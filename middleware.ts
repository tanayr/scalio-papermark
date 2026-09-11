import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export const config = { matcher: ["/((?!_next/static|_next/image|pdf.worker.min.mjs|favicon.ico|favicon.svg|_static/|fonts/|scalio-logo.png).*)"] };
export default async function middleware(req: NextRequest) {
 const path = req.nextUrl.pathname;
 const publicApi = (req.method==="GET" && path==="/api/file/brand") || path.startsWith("/api/auth/") || ["/api/record_reaction", "/api/feedback", "/api/health", "/api/views", "/api/views-dataroom", "/api/record_view", "/api/links/download", "/api/file/local"].includes(path) || (req.method === "GET" && /^\/api\/links\/[^/]+(?:\/dataroom)?$/.test(path));
 if (publicApi || path.startsWith("/view/") && !path.endsWith("/chat") || path === "/login") return NextResponse.next();
 const token = await getToken({req, secret: process.env.NEXTAUTH_SECRET});
 const admins = (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map(x=>x.trim());
 if (!token?.email || !admins.includes(token.email.toLowerCase())) {
  if (path.startsWith("/api/")) return NextResponse.json({message:"Unauthorized"},{status:401});
  return NextResponse.redirect(new URL("/login", req.url));
 }
 if (path.startsWith("/api/") && !["GET","HEAD","OPTIONS"].includes(req.method)) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXTAUTH_URL!).origin) return NextResponse.json({message:"Invalid origin"},{status:403});
 }
 if (path === "/" || path === "/admin" || path === "/welcome") return NextResponse.redirect(new URL("/datarooms",req.url));
 return NextResponse.next();
}
