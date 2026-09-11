import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeEmail, hash, randomToken, codeHash, canView, canDownload } from './access.mjs';
import { TEAM_ID, ROOM_ID } from './db.mjs';

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const nameSchema = z.string().trim().min(1).max(120);
const idSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const cookieName = 'scalio_invest_session';
const docSelect = { id: true, name: true, numPages: true, createdAt: true };

export function createApp({ db, sendCode, storage, baseUrl, admins, secret, secureCookies = true }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'"], frameAncestors: ["'none'"], objectSrc: ["'none'"] } }, referrerPolicy: { policy: 'no-referrer' } }));
  app.use((req, res, next) => { res.set('X-Robots-Tag', 'noindex, nofollow'); next(); });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!['GET', 'HEAD'].includes(req.method) && req.get('origin') !== baseUrl) return res.status(403).json({ error: 'Request origin rejected.' });
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  const verifyLimit = rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });
  const fail = (res, code = 403) => res.status(code).json({ error: 'Access unavailable. Check your link or contact the Scalio team.' });
  const activeLink = () => db.link.findFirst({ where: { dataroomId: ROOM_ID, isArchived: false }, orderBy: { createdAt: 'desc' } });
  async function identity(req) {
    const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token || token.length > 128) return null;
    const session = await db.accessSession.findUnique({ where: { tokenHash: hash(token) } });
    if (!session || session.expiresAt <= new Date()) return null;
    if (!session.linkId && admins.includes(session.email)) return { ...session, admin: true };
    if (!session.linkId) return null;
    const link = await db.link.findUnique({ where: { id: session.linkId } });
    if (link?.dataroomId !== ROOM_ID || !canView(link, session.email)) return null;
    return { ...session, admin: false, link };
  }
  async function auth(req, res, next) {
    req.identity = await identity(req);
    if (!req.identity) return fail(res, 401);
    next();
  }
  function admin(req, res, next) { if (!req.identity.admin) return fail(res); next(); }
  async function document(req, res, next) {
    const id = idSchema.parse(req.params.id);
    const item = await db.dataroomDocument.findUnique({ where: { dataroomId_documentId: { dataroomId: ROOM_ID, documentId: id } }, include: { document: true } });
    if (!item) return fail(res, 404);
    req.document = item.document;
    next();
  }

  app.get('/api/health', async (_req, res) => { await db.$queryRaw`SELECT 1`; res.json({ ok: true }); });
  app.post('/api/auth/request', authLimit, async (req, res) => {
    const { email, linkId } = z.object({ email: emailSchema, linkId: idSchema.nullable().optional() }).parse(req.body);
    const link = linkId ? await db.link.findUnique({ where: { id: linkId } }) : null;
    const allowed = linkId ? link?.dataroomId === ROOM_ID && canView(link, email) : admins.includes(email);
    const id = randomToken();
    // Same response for unknown addresses. Rate limits persist across app restarts.
    const recent = await db.accessChallenge.count({ where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } } });
    if (recent >= 5) return res.status(429).json({ error: 'Please wait 15 minutes before requesting another code.' });
    if (allowed) {
      const code = String(randomInt(100000, 1000000));
      await db.accessChallenge.create({ data: { id, email, linkId: linkId || null, codeHash: codeHash(secret, id, code), expiresAt: new Date(Date.now() + 10 * 60_000) } });
      try { await sendCode(email, code); }
      catch (error) { await db.accessChallenge.deleteMany({ where: { id } }); throw error; }
    }
    res.json({ challengeId: id, message: 'If this email has access, a verification code is on its way.' });
  });
  app.post('/api/auth/verify', verifyLimit, async (req, res) => {
    const { challengeId, code } = z.object({ challengeId: idSchema, code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const result = await db.$transaction(async tx => {
      // Atomic attempt reservation and consumption prevent concurrent replay.
      const update = await tx.accessChallenge.updateMany({ where: { id: challengeId, attempts: { lt: 5 }, expiresAt: { gt: new Date() } }, data: { attempts: { increment: 1 } } });
      if (!update.count) return null;
      const challenge = await tx.accessChallenge.findUnique({ where: { id: challengeId } });
      if (challenge.codeHash !== codeHash(secret, challengeId, code)) return null;
      const link = challenge.linkId ? await tx.link.findUnique({ where: { id: challenge.linkId } }) : null;
      if (challenge.linkId ? link?.dataroomId !== ROOM_ID || !canView(link, challenge.email) : !admins.includes(challenge.email)) return null;
      const consumed = await tx.accessChallenge.deleteMany({ where: { id: challengeId } });
      if (!consumed.count) return null;
      const token = randomToken();
      await tx.accessSession.create({ data: { tokenHash: hash(token), email: challenge.email, linkId: challenge.linkId, expiresAt: new Date(Date.now() + (challenge.linkId ? 2 : 12) * 60 * 60_000) } });
      if (challenge.linkId) await tx.view.create({ data: { linkId: challenge.linkId, dataroomId: ROOM_ID, viewerEmail: challenge.email, verified: true, viewType: 'DATAROOM_VIEW' } });
      return { token, admin: !challenge.linkId };
    });
    if (!result) return res.status(401).json({ error: 'Invalid or expired code. Request a new code and try again.' });
    res.cookie(cookieName, result.token, { httpOnly: true, secure: secureCookies, sameSite: 'strict', maxAge: (result.admin ? 12 : 2) * 60 * 60_000, path: '/' });
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', async (req, res) => {
    const who = await identity(req);
    if (who) await db.accessSession.deleteMany({ where: { tokenHash: who.tokenHash } });
    res.clearCookie(cookieName, { httpOnly: true, secure: secureCookies, sameSite: 'strict', path: '/' });
    res.json({ ok: true });
  });
  app.get('/api/state', auth, async (req, res) => {
    if (!req.identity.admin && req.query.linkId !== req.identity.linkId) return fail(res);
    const [documents, folders, link] = await Promise.all([
      db.dataroomDocument.findMany({ where: { dataroomId: ROOM_ID }, select: { folderId: true, document: { select: docSelect } }, orderBy: { createdAt: 'desc' } }),
      db.dataroomFolder.findMany({ where: { dataroomId: ROOM_ID }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      req.identity.admin ? activeLink() : req.identity.link,
    ]);
    res.json({ email: req.identity.email, admin: req.identity.admin, documents: documents.map(x => ({ ...x.document, folderId: x.folderId })), folders, admins: req.identity.admin ? admins : undefined, link: req.identity.admin ? link : { allowDownload: link.allowDownload } });
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1, fields: 2, parts: 3 } });
  let processing = false;
  app.post('/api/admin/documents', auth, admin, (req, res, next) => {
    if (processing) return res.status(409).json({ error: 'Another document is processing. Please try again shortly.' });
    processing = true;
    res.on('finish', () => { processing = false; });
    upload.single('file')(req, res, next);
  }, async (req, res) => {
    if (!req.file || !req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) return res.status(400).json({ error: 'Please upload a PDF, up to 30 MB.' });
    const name = nameSchema.parse(Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
    const folderId = req.body.folderId ? idSchema.parse(req.body.folderId) : null;
    if (folderId && !await db.dataroomFolder.findFirst({ where: { id: folderId, dataroomId: ROOM_ID } })) return fail(res, 400);
    const dirName = randomUUID();
    const dir = path.join(storage, dirName);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    try {
      const file = path.join(dir, 'original.pdf');
      await writeFile(file, req.file.buffer, { mode: 0o600 });
      const { stdout } = await exec('pdfinfo', [file], { timeout: 15_000, maxBuffer: 128 * 1024 });
      const pages = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
      if (!pages || pages > 200 || /^Encrypted:\s+yes/m.test(stdout)) throw new Error('PDF must be unencrypted and contain 1–200 pages.');
      await exec('pdftoppm', ['-jpeg', '-jpegopt', 'quality=82', '-scale-to', '1600', '-r', '110', file, path.join(dir, 'page')], { timeout: 120_000, maxBuffer: 1024 * 1024 });
      const previews = (await readdir(dir)).filter(x => /^page-\d+\.jpg$/.test(x));
      if (previews.length !== pages) throw new Error('Could not render all PDF pages.');
      const user = await db.user.findUniqueOrThrow({ where: { email: req.identity.email } });
      const doc = await db.document.create({ data: { name, file: dirName, type: 'pdf', storageType: 'LOCAL_PATH', numPages: pages, ownerId: user.id, teamId: TEAM_ID, datarooms: { create: { dataroomId: ROOM_ID, folderId } } }, select: docSelect });
      res.status(201).json(doc);
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      console.error('PDF processing failed:', error.code || error.name);
      res.status(422).json({ error: 'Unable to process this PDF. Use an unencrypted PDF with 1–200 pages.' });
    }
  });
  app.patch('/api/admin/documents/:id', auth, admin, document, async (req, res) => {
    const { folderId } = z.object({ folderId: idSchema.nullable() }).parse(req.body);
    if (folderId && !await db.dataroomFolder.findFirst({ where: { id: folderId, dataroomId: ROOM_ID } })) return fail(res, 400);
    await db.dataroomDocument.update({ where: { dataroomId_documentId: { dataroomId: ROOM_ID, documentId: req.document.id } }, data: { folderId } });
    res.json({ ok: true });
  });
  app.delete('/api/admin/documents/:id', auth, admin, document, async (req, res) => {
    await db.document.delete({ where: { id: req.document.id } });
    await rm(path.join(storage, req.document.file), { recursive: true, force: true });
    res.json({ ok: true });
  });
  app.post('/api/admin/folders', auth, admin, async (req, res) => {
    const { name } = z.object({ name: nameSchema }).parse(req.body);
    const folder = await db.dataroomFolder.create({ data: { name, path: `/${randomUUID()}`, dataroomId: ROOM_ID } });
    res.status(201).json({ id: folder.id, name: folder.name });
  });
  app.delete('/api/admin/folders/:id', auth, admin, async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const result = await db.dataroomFolder.deleteMany({ where: { id, dataroomId: ROOM_ID, documents: { none: {} } } });
    if (!result.count) return res.status(409).json({ error: 'Move documents out of this folder before deleting it.' });
    res.json({ ok: true });
  });
  app.patch('/api/admin/access', auth, admin, async (req, res) => {
    const data = z.object({ allowList: z.array(emailSchema).max(500), allowDownload: z.boolean(), expiresAt: z.iso.datetime().nullable() }).parse(req.body);
    if (data.expiresAt && new Date(data.expiresAt) <= new Date()) return res.status(400).json({ error: 'Choose an expiry date in the future.' });
    const link = await activeLink();
    if (!link) return fail(res, 404);
    await db.link.update({ where: { id: link.id }, data: { ...data, allowList: [...new Set(data.allowList)], expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } });
    res.json({ ok: true });
  });
  app.post('/api/admin/access/rotate', auth, admin, async (_req, res) => {
    await db.$transaction(async tx => {
      const current = await tx.link.findFirst({ where: { dataroomId: ROOM_ID, isArchived: false } });
      await tx.link.updateMany({ where: { dataroomId: ROOM_ID }, data: { isArchived: true } });
      await tx.link.create({ data: { id: randomToken(), dataroomId: ROOM_ID, linkType: 'DATAROOM_LINK', name: 'Investor access', allowList: current?.allowList || [], denyList: [], allowDownload: current?.allowDownload || false, expiresAt: current?.expiresAt, emailProtected: true, emailAuthenticated: true } });
    });
    res.json({ ok: true });
  });
  app.get('/api/admin/activity', auth, admin, async (_req, res) => {
    const views = await db.view.findMany({ where: { dataroomId: ROOM_ID }, orderBy: { viewedAt: 'desc' }, take: 100, select: { id: true, viewerEmail: true, viewedAt: true, downloadedAt: true, viewType: true, document: { select: { name: true } } } });
    res.json(views);
  });
  app.get('/api/documents/:id', auth, document, async (req, res) => {
    if (!req.identity.admin) await db.view.create({ data: { documentId: req.document.id, dataroomId: ROOM_ID, linkId: req.identity.linkId, viewerEmail: req.identity.email, verified: true } });
    res.json({ id: req.document.id, name: req.document.name, numPages: req.document.numPages, allowDownload: req.identity.admin || canDownload(req.identity.link, req.identity.email) });
  });
  app.get('/api/documents/:id/pages/:page', auth, document, async (req, res) => {
    if (!/^\d{1,3}$/.test(req.params.page)) return fail(res, 404);
    const page = Number(req.params.page);
    if (page < 1 || page > req.document.numPages) return fail(res, 404);
    const files = await readdir(path.join(storage, req.document.file));
    const name = files.find(f => /^page-\d+\.jpg$/.test(f) && Number(f.match(/\d+/)[0]) === page);
    if (!name) return fail(res, 404);
    res.sendFile(path.join(storage, req.document.file, name));
  });
  app.get('/api/documents/:id/download', auth, document, async (req, res) => {
    if (!req.identity.admin && !canDownload(req.identity.link, req.identity.email)) return fail(res);
    if (!req.identity.admin) await db.view.create({ data: { documentId: req.document.id, dataroomId: ROOM_ID, linkId: req.identity.linkId, viewerEmail: req.identity.email, verified: true, downloadedAt: new Date() } });
    res.download(path.join(storage, req.document.file, 'original.pdf'), req.document.name);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use(express.static(path.join(here, 'public'), { index: false, maxAge: '1h', dotfiles: 'deny' }));
  for (const route of ['/', '/login', '/r/:linkId']) app.get(route, (_req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(here, 'public/index.html')); });
  app.use((_req, res) => res.status(404).send('Not found'));
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Check the entered values and try again.' });
    if (error instanceof multer.MulterError) return res.status(400).json({ error: 'Upload one PDF, up to 30 MB.' });
    console.error('Request failed:', error.code || error.name);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
