import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import Head from "next/head";
import { ThemeProvider } from "@/components/theme-provider";
import { TeamProvider } from "@/context/team-context";
import { TooltipProvider } from "@/components/ui/tooltip";
export default function App({Component,pageProps:{session,...pageProps},router}:AppProps) {
 return <><Head><title>Scalio · Data rooms</title><meta name="robots" content="noindex,nofollow"/><meta name="theme-color" content="#ffffff"/><link rel="icon" href="/favicon.svg"/></Head>
 <SessionProvider session={session}><ThemeProvider attribute="class" forcedTheme="light"><Toaster closeButton richColors/><TooltipProvider delayDuration={100}>
 {router.pathname.startsWith("/view/") ? <Component {...pageProps}/> : <TeamProvider><Component {...pageProps}/></TeamProvider>}
 </TooltipProvider></ThemeProvider></SessionProvider></>;
}
