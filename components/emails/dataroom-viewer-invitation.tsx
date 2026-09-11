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
export default function DataroomViewerInvitation({
  dataroomName,
  senderEmail,
  url,
}: {
  dataroomName: string;
  senderEmail: string;
  url: string;
}) {
  return (
    <Html>
      <Preview>View dataroom on Scalio</Preview>
      <Tailwind>
        <Head />
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="my-10 mx-auto p-5 w-[465px]">
            <ScalioEmailHeader />
            <Heading className="text-xl font-seminbold text-center p-0 mt-4 mb-8 mx-0">
              {`View ${dataroomName}`}
            </Heading>
            <Text className="text-sm leading-6 text-black">Hey!</Text>
            <Text className="text-sm leading-6 text-black">
              You have been invited to view the{" "}
              <span className="font-semibold">{dataroomName}</span> dataroom on{" "}
              <span className="font-semibold">Scalio</span>.
              <br />
              The invitation was sent by{" "}
              <span className="font-semibold">{senderEmail}</span>.
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-black rounded text-white text-xs font-semibold no-underline text-center"
                href={`${url}`}
                style={{ padding: "12px 20px" }}
              >
                View the dataroom
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
                reply to it.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
