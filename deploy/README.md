# Scalio Papermark deployment

This deployment runs Papermark's original v0.12.0 admin and viewer components (AGPLv3), with multiple data rooms. It replaces the initial custom single-room app. It is not the current commercial Papermark Enterprise distribution.

The runtime uses Node 24, Next 15, Postgres, local private PDF storage, Poppler rendering, and Resend. Page-view analytics are stored in Postgres rather than Tinybird. Scalio styling uses white backgrounds, sage panels, and green accents.

Build from the repository root: `docker build -f deploy/Dockerfile -t scalio/invest:papermark .`.

Apply migrations with `node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=deploy/prisma/schema.prisma`, then `node deploy/bootstrap.mjs`. This migration directory preserves the already-deployed baseline checksum. Do not use the historical root Prisma migration directory against the Scalio database.

Required runtime variables: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, `INTERNAL_BASE_URL`, `ADMIN_EMAILS`, `EMAIL_FROM`, `RESEND_API_KEY`, `POSTGRES_PRISMA_URL`, `POSTGRES_PRISMA_URL_NON_POOLING`. Set `NEXT_PUBLIC_UPLOAD_TRANSPORT=local`. Build-time public URL is invest.scalio.app. The document volume mounts at `/data/documents`.

The two configured administrators sign in using emailed links. Each sharing link can allow access without email, collect an email without verification, or require email verification. Sharing links support allowed/blocked email addresses and domains, passwords, expiry, download controls, and revocation. New links default to collecting an email without verification or an allowlist. Existing links retain their saved settings. Allowed/blocked email lists use verified-email access; use the link settings or Invite Visitors to manage access. Room contents and PDF previews are checked against the live link settings. Original PDF download is blocked when downloads are disabled.

PDF uploads: maximum 30 MB at the proxy, 300 pages. All pages render before an upload is reported complete. Keep the existing daily database/document backup timer. Backups remain on the same droplet.

The previous runtime remains in `self-host/` for rollback. Its Express auth cookies do not sign users into the NextAuth admin UI; users sign in again after the switch.

## Mobile PDF decks

On a document’s overview, use **Mobile version** to upload a portrait PDF and turn on **Use mobile version on phones**. Uploads accept PDFs up to 30 MB / 300 pages. A mobile PDF belongs to the current desktop revision; a new desktop revision starts without a mobile PDF. Mobile and desktop PDFs may have different page counts. Replacement uploads preserve the enabled setting and publish only after all pages render.

Shared document and data-room links select the enabled mobile PDF when opened below 768 CSS pixels wide. The selection stays fixed during that document view, including rotation. Missing or disabled mobile PDFs fall back to desktop. Access settings apply to both PDFs. Downloads follow the viewed PDF; visitors must reopen a document after it is replaced. Analytics label mobile and desktop separately and use the page count recorded when the view began.

The compact mobile PDF viewer hides the header and shows the current/total page count between bottom previous/next buttons. Swipe left to advance or right to go back. The background around PDFs is `#f7f4ee`; enabled reactions appear above the mobile navigation. Desktop keeps its header. See [the changelog](../CHANGELOG.md) for release history.

Run `node deploy/mobile-pdf-test.mjs [path-to-mobile.pdf]` against the local test server configured in `/tmp/scalio-papermark-test-env.json`. The test rejects non-local/non-test databases. It covers mobile uploads, fallbacks, permissions, analytics, downloads, replacement/removal, and desktop revision changes.
