import ScalioEmailHeader from "./scalio-header";
import React from "react";
import {
  Body,
  Container,
  Button,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
} from "@react-email/components";

export default function EmailVerification({
  verificationURL = "invest.scalio.app",
  email = "test@test.com",
}: {
  verificationURL: string;
  email: string;
}) {
  return (
    <Html>
      <Preview>Verify your email to view the document</Preview>
      <Tailwind>
        <Head />
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-10 mx-auto p-5 w-[465px]">
            <ScalioEmailHeader />
            <Heading className="mx-0 my-7 p-0 text-center text-xl font-semibold text-black">
              Please verify your email
            </Heading>
            <Text className="text-sm leading-6 text-black">
              Please click the verification link below to view the document.
            </Text>
            <Section className="my-8 text-center">
              <Button
                className="bg-black rounded text-white text-xs font-semibold no-underline text-center"
                href={verificationURL}
                style={{ padding: "12px 20px" }}
              >
                Verify Email
              </Button>
            </Section>
            <Text className="text-sm leading-6 text-black">
              or copy and paste this URL into your browser:
            </Text>
            <Text className="max-w-sm flex-wrap break-words font-medium text-purple-600 no-underline">
              {verificationURL.replace(/^https?:\/\//, "")}
            </Text>
            <Hr />
            <Section className="mt-8 text-gray-400">
              <Text className="text-xs">
                © {new Date().getFullYear()}{" "}
                <a
                  href="https://invest.scalio.app"
                  className="no-underline text-gray-400 hover:text-gray-400 visited:text-gray-400"
                  target="_blank"
                >
                  invest.scalio.app
                </a>
              </Text>
              <Text className="text-xs">
                This email was intended for{" "}
                <span className="text-black">{email}</span>. If you were not
                expecting this email, you can ignore this email. If you have any
                feedback or questions about this email, simply reply to it.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
