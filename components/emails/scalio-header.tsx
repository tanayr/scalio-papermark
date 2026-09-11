import React from "react";
import { Img, Section } from "@react-email/components";

export default function ScalioEmailHeader() {
  return (
    <Section style={{ margin: "16px 0 32px", textAlign: "center" }}>
      <Img src="https://invest.scalio.app/scalio-logo.png" alt="Scalio" width="144" height="40" style={{ display: "block", margin: "0 auto", backgroundColor: "#ffffff" }} />
    </Section>
  );
}
