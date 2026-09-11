import ScalioEmailHeader from "./scalio-header";
import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Tailwind,
  Section,
  Button,
  Hr,
} from "@react-email/components";
export default function TeamInvitation({
  senderName,
  senderEmail,
  teamName,
  url,
}: {
  senderName: string;
  senderEmail: string;
  teamName: string;
  url: string;
}) {
  return (
    <Html>
      <Preview>Join the team on Scalio</Preview>
      <Tailwind>
        <Head />
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-10 mx-auto p-5 w-[465px]">
            <ScalioEmailHeader />
            <Heading className="text-xl font-seminbold text-center p-0 mt-4 mb-8 mx-0">
              {`Join ${teamName} on Scalio`}
            </Heading>
            <Text className="text-sm leading-6 text-black">Hey!</Text>
            <Text className="text-sm leading-6 text-black">
              <span className="font-semibold">{senderName}</span> ({senderEmail}
              ) has invited you to the{" "}
              <span className="font-semibold">{teamName}</span> team on{" "}
              <span className="font-semibold">Scalio</span>.
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-black rounded text-white text-xs font-semibold no-underline text-center"
                href={`${url}`}
                style={{ padding: "12px 20px" }}
              >
                Join the team
              </Button>
            </Section>
            <Text className="text-sm text-black">
              or copy and paste this URL into your browser: <br />
              {`${url}`}
            </Text>
            <Text className="text-sm text-gray-400">Scalio</Text>
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
                If you have any feedback or questions about this email, simply
                reply to it. I&apos;d love to hear from you!
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
