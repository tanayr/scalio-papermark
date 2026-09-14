// Read when a document opens, not on resize, so rotation does not switch decks.
export function prefersMobilePdf() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
  );
}

export function selectDocumentVariant(
  version: {
    mobileFile: string | null;
    mobileEnabled: boolean;
    mobileNumPages: number | null;
    pages: { variant: string }[];
  },
  preferMobile: boolean,
): "MOBILE" | "DESKTOP" {
  return preferMobile &&
    version.mobileEnabled &&
    !!version.mobileFile &&
    !!version.mobileNumPages &&
    version.pages.filter((p) => p.variant === "MOBILE").length ===
      version.mobileNumPages
    ? "MOBILE"
    : "DESKTOP";
}
