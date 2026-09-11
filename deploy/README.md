# Scalio Papermark deployment

This deployment runs Papermark's original v0.12.0 admin and viewer components (AGPLv3), with multiple data rooms. It replaces the initial custom single-room app. It is not the current commercial Papermark Enterprise distribution.

The runtime uses Node 24, Next 15, Postgres, local private PDF storage, Poppler rendering, and Resend. Page-view analytics are stored in Postgres rather than Tinybird. Scalio styling uses white backgrounds, sage panels, and green accents.

Build from the repository root: `docker build -f deploy/Dockerfile -t scalio/invest:papermark .`.

Apply migrations with `node node_modules/prisma/build/index.js migrate deploy --schema=deploy/prisma/schema.prisma`, then `node deploy/bootstrap.mjs`. This migration directory preserves the already-deployed baseline checksum. Do not use the historical root Prisma migration directory against the Scalio database.

Required runtime variables: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, `INTERNAL_BASE_URL`, `ADMIN_EMAILS`, `EMAIL_FROM`, `RESEND_API_KEY`, `POSTGRES_PRISMA_URL`, `POSTGRES_PRISMA_URL_NON_POOLING`. Set `NEXT_PUBLIC_UPLOAD_TRANSPORT=local`. Build-time public URL is invest.scalio.app. The document volume mounts at `/data/documents`.

The two configured administrators sign in using emailed links. Every visitor verifies their email. Sharing links support allowed/blocked email addresses and domains, passwords, expiry, download controls, and revocation. New links initially allow the administrators; use the link settings or Invite Visitors to grant access. Room contents and PDF previews are checked against the live link settings. Original PDF download is blocked when downloads are disabled.

PDF uploads: maximum 30 MB at the proxy, 300 pages. All pages render before an upload is reported complete. Keep the existing daily database/document backup timer. Backups remain on the same droplet.

The previous runtime remains in `self-host/` for rollback. Its Express auth cookies do not sign users into the NextAuth admin UI; users sign in again after the switch.
