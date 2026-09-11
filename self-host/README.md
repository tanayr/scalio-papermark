# Scalio investor room

One shared data room at **https://invest.scalio.app**, hosted on the MIS / founder droplet in `/opt/scalio-invest`.

## Using it

- Tanay and Aditya sign in at `/` with `tanay@scalio.app` or `aditya@scalio.app` using a six-digit email code.
- Upload PDFs (up to 30 MB / 200 pages), optionally organized in folders. Export slides, spreadsheets, and Word documents as PDFs before uploading.
- In **Access**, add exact approved investor email addresses and copy the shared room link. Share it yourself; editing the access list does not send invitations.
- Investors open `/r/<link-id>` and verify an approved email. Possessing the link is insufficient.
- Removing an email immediately blocks subsequent document requests. Set an optional expiry or replace the link to invalidate all sessions tied to the previous link.
- Download permission applies to the entire room. View-only users receive JPEG page previews; the server denies the original PDF. Screenshots and saving visible images cannot be prevented.
- **Activity** shows the last 100 verified room visits, document opens, and PDF downloads. It does not measure page dwell time.

## What this fork runs

Based on Papermark **v0.12.0**, commit `eb959c99fae0566fdd93fee3b4fdb26c36bd3ab4` (AGPLv3, before the enterprise directory was introduced). The Prisma data model derives from that release and retains Papermark's User/Team/Dataroom/Document/Link/View relationships. Scalio adds private local storage and token-based authentication models.

The single-room interface and its HTTP handlers are a focused implementation in this directory. The historical upstream Next.js app is preserved in the repository for provenance but **is not installed, built, or exposed**. No code from Papermark's commercial enterprise directories is used. This is not the complete current Papermark product or a claim of enterprise feature parity. This modified distribution remains under AGPLv3; its source is linked in the application footer.

Runtime: Node 24, Express 5, Prisma 6, PostgreSQL 17, Poppler PDF rendering, and Caddy. Resend sends verification codes from the existing `notifications@scalio.app` sender. No Tinybird, Vercel, Stripe, or external file-storage account is required.

## Deployment

Only this directory is copied to `/opt/scalio-invest`. Secrets are in a root-owned `.env` with mode 0600 and never committed. See `.env.example` for names. The app only receives its own database, authentication, and email credentials; the DNS token is isolated to Caddy.

```sh
cd /opt/scalio-invest
docker compose build app
docker compose up -d db
docker compose run --rm app npx prisma migrate deploy
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:3400/api/health
```

The database and documents persist in separate Docker volumes. The database has no published port; the app's port 3400 is bound to localhost. Caddy listens on host port 8443. Cloudflare's origin rule for **only** `invest.scalio.app` maps public HTTPS 443 to origin 8443; zone TLS remains Full (strict). Caddy obtains and renews its certificate using DNS validation. The existing MIS and secrets-service Caddy configuration is not modified.

Cloudflare DNS: proxied A record `invest.scalio.app` → `168.144.31.147`. Preserve the origin rule in `cloudflare-origin.json` when maintaining Cloudflare routing. Current Cloudflare IP ranges are configured as trusted proxies in the Caddyfile for rate limiting. The `scalio-secrets-mis` DigitalOcean firewall (`590f57c8-433c-4364-807b-b531eb1a86ff`) and UFW allow TCP 8443 only from Cloudflare IPv4 ranges. Existing firewall rules remain intact. Use the `scalio` doctl context for this account.

Administrators are set with `ADMIN_EMAILS`; seed runs idempotently on app startup. Sessions last 12 hours for admins and 2 hours for investors. Codes expire after 10 minutes, allow five attempts, and are consumed atomically. Only code/session hashes are stored. Code requests have per-IP and database-backed per-email limits. All mutations require a matching Origin header; cookies are Secure, HttpOnly, and SameSite=Strict. Every document/page/download request rechecks the live link and email access list.

## Backups and recovery

`scalio-invest-backup.timer` runs daily at 03:15 UTC. `backup.sh` stops only the investor app briefly, waiting for active requests, then saves a consistent Postgres dump, private documents, and a protected copy of the deployment environment. It restarts the app and keeps approximately seven days under `/opt/scalio-invest/backups` (root-only). These backups are **on the same droplet**, not disaster recovery for loss of the droplet. Copy encrypted backups off-host if that becomes a requirement.

To restore, first stop the investor app and preserve the current volumes. Select a complete timestamped backup; never use `.partial-*`. Restore the database with `pg_restore --clean --if-exists --no-owner -U invest -d invest` inside the database container, and extract `documents.tar.gz` into the `scalio-invest_documents` volume. Restore the matching environment if credentials changed, then start the app and check health/login/document previews. Recovery overwrites data and must be explicitly authorized.

## Validation

```sh
npm ci
npm audit --omit=dev
npm test
# Full integration test: use a fresh dedicated database ending in _test.
POSTGRES_PRISMA_URL=... POSTGRES_PRISMA_URL_NON_POOLING=... npx prisma migrate deploy
INVEST_TEST_DATABASE_URL=... npm test
```

The integration test uses a separate database, synthetic PDF, and in-memory mail sink. It checks upload/rendering, folder operations, admin boundaries, exact email allowlisting, one-use codes, brute-force lockout, original-file download policy, direct requests, expiry, revocation, and activity logging. It never sends live email. Poppler executables must be installed. The Docker image includes them.

Fonts: Hanken Grotesk and Bricolage Grotesque, locally hosted under the SIL Open Font License (notices in `public/`). Scalio branding follows the shared Scalio Spring design tokens.
