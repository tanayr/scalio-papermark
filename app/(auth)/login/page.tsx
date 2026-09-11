"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { signInWithPasskey } from "@teamhanko/passkeys-next-auth-provider/client";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useParams } from "next/navigation";
import Passkey from "@/components/shared/icons/passkey";
import { useState } from "react";
import { toast } from "sonner";
import LinkedIn from "@/components/shared/icons/linkedin";
import { Loader } from "lucide-react";
import Google from "@/components/shared/icons/google";
import { Label } from "@/components/ui/label";

export default function Login() {
  const next = "/datarooms";

  const [isLoginWithEmail, setIsLoginWithEmail] = useState<boolean>(false);
  const [isLoginWithGoogle, setIsLoginWithGoogle] = useState<boolean>(false);
  const [isLoginWithLinkedIn, setIsLoginWithLinkedIn] =
    useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [emailButtonText, setEmailButtonText] = useState<string>(
    "Continue with Email",
  );

  return (
    <div className="flex h-screen w-full flex-wrap ">
      {/* Left part */}
      <div className="flex w-full justify-center bg-white md:w-1/2 lg:w-2/5">
        <div
          className="absolute inset-x-0 top-10 -z-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
          aria-hidden="true"
        ></div>
        <div className="z-10 mt-[calc(20vh)] h-fit w-full mx-5 sm:mx-0 max-w-md overflow-hidden rounded-lg">
          <div className="flex flex-col items-center justify-center space-y-3 px-4 py-6 pt-8 text-center sm:px-16">
            <Link href="/">
              <span className=" text-2xl font-semibold text-gray-800 text-balance ">
                Scalio data rooms
              </span>
            </Link>
            <h3 className="text-sm text-gray-800 text-balance ">
              Sign in to manage your documents and sharing.
            </h3>
          </div>
          <form
            className="flex flex-col px-4 pt-8 sm:px-16 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setIsLoginWithEmail(true);
              signIn("email", {
                email: email,
                redirect: false,
                ...(next && next.length > 0 ? { callbackUrl: next } : {}),
              }).then((res) => {
                if (res?.ok && !res?.error) {
                  setEmail("");
                  setEmailButtonText("Email sent - check your inbox!");
                  toast.success("Email sent - check your inbox!");
                } else {
                  setEmailButtonText("Error sending email - try again?");
                  toast.error("Error sending email - try again?");
                }
                setIsLoginWithEmail(false);
              });
            }}
          >
            {/* <Input
              className="border-1 bg-white border-gray-200 hover:border-gray-200 text-gray-800"
              placeholder="jsmith@company.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            /> */}
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoginWithEmail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-10 w-full rounded-md border-0 ring-1 ring-gray-200 bg-background px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 bg-white text-gray-900"
            />
            {/* <Button type="submit" disabled={isLoginWithEmail}>
              {isLoginWithEmail && (
                <Loader className="h-5 w-5 mr-2 animate-spin bg-gray-800 hover:bg-gray-900" />
              )}
              Continue with Email
            </Button> */}
            <Button
              type="submit"
              loading={isLoginWithEmail}
              className={`${
                isLoginWithEmail ? "bg-black" : "bg-gray-800 hover:bg-gray-900 "
              } text-white py-2 px-4 rounded focus:outline-none focus:shadow-outline transform transition-colors duration-300 ease-in-out`}
            >
              {emailButtonText}
            </Button>
          </form>
          <p className="mt-8 px-4 sm:px-16 text-sm text-muted-foreground">Administrator access. Investors should use the room link shared with them.</p>
          <p className="mt-5 px-4 sm:px-16 text-xs text-muted-foreground">Powered by <a href="https://github.com/tanayr/scalio-papermark" className="underline">Papermark · source code</a></p>
        </div>
      </div>
      <div className="hidden md:flex flex-1 items-center justify-center bg-[#E9EEE2] p-16"><h1 className="text-6xl font-normal leading-tight">A closer look<br/><span className="text-[#19AA57]">at what&apos;s next.</span></h1></div>
    </div>
  );
}
