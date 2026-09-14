# Scalio Papermark changelog

Changes to the Scalio fork of Papermark v0.12.0 (AGPLv3), hosted at https://invest.scalio.app.

## 2026-09-14

### Mobile PDF decks

- Added a **Mobile version** section to the existing document admin screen with upload, replace, remove, and enable/disable controls.
- Attached optional mobile PDFs to individual desktop revisions. Uploading a new desktop revision starts without a mobile PDF.
- Automatically select an enabled mobile PDF when a shared document opens below 768 CSS pixels wide, including documents opened from data rooms. Missing or disabled mobile PDFs fall back to desktop.
- Support independent page counts for mobile and desktop PDFs. Each PDF page remains a slide; no page-to-page mapping is required.
- Render all mobile pages before publishing an upload. Failed replacements preserve the existing mobile PDF and its setting.
- Apply the sharing link's existing access and download settings to both formats. Downloads return the PDF selected for the view; stale downloads require reopening the document.
- Record the selected format, revision, and page count for each view. Label mobile and desktop page analytics separately and calculate completion against the viewed PDF's page count.

### Viewer improvements

- Added touch gestures: swipe left for the next page and right for the previous page. Taps, vertical gestures, multiple touches, cancelled gestures, and zoomed views do not turn pages.
- Fixed the reaction toolbar's invisible container intercepting touches over the slide.
- Changed the background around PDFs to `#f7f4ee` on mobile and desktop.
- Hid the header in the compact mobile PDF viewer and centered the current/total page counter between bottom previous/next buttons. Disabled arrows remain in place at the first and last pages.
- Accounted for the bottom safe area and placed enabled reactions above the mobile navigation controls.
- Kept desktop header navigation and existing keyboard/arrow controls.

### Deployment and validation

- Added migration `202609140001_mobile_pdf` under `deploy/prisma/migrations`; existing records default to desktop with mobile disabled.
- Added `deploy/mobile-pdf-test.mjs` covering uploads, independent page counts, access restrictions, downloads, analytics, fallback, replacement/removal, and revision changes.
- Passed TypeScript checks, production builds, the existing integration suite, mobile PDF integration checks using a 22-page portrait PDF, and browser checks for mobile layout and touch navigation.
- Deployed application commits: `fa06ee2`, `bd3ece8`, `e91901f`, and `0f4ba76`.

## 2026-09-11

### Self-hosted Scalio workspace

- Established the Scalio deployment using Node 24, Next.js 15, Postgres, private local PDF storage, Poppler rendering, and Resend email delivery.
- Restored Papermark's original admin UI and support for multiple data rooms, replacing the initial custom single-room interface.
- Added Scalio styling, white admin backgrounds, green accents, and the Scalio logo across emails, navigation, and access screens.
- Updated access-screen guidance to “Contact Aditya or Tanay for access.”
- Restored configurable per-link email collection and verification. Links can allow anonymous access, collect email without verification, or require verified email; saved link settings are preserved.
- Supported link passwords, allowed/blocked email lists, expiry, download controls, and revocation through the self-hosted access flow.
- Stored page-view analytics in Postgres and added local integration coverage.
- Packaged the PDF engine WASM and an isolated Prisma CLI in the standalone image. Preserved the previously applied migration baseline checksum in the deployment migration directory.

See [deployment documentation](deploy/README.md) for setup, migration, and mobile PDF details. Uploaded investor documents and runtime credentials are not part of the source repository.
