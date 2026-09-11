import { mkdir } from 'node:fs/promises';
import { db } from './db.mjs';
import { createApp } from './app.mjs';
import { normalizeEmail } from './access.mjs';
import { seed } from './seed.mjs';

const baseUrl = process.env.BASE_URL || 'https://invest.scalio.app';
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters');
if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email configuration is required');
const storage = process.env.STORAGE_DIR || '/data/documents';
await mkdir(storage, { recursive: true, mode: 0o700 });
await seed();
async function sendCode(email, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: email, subject: 'Your Scalio investor room verification code', text: `Your verification code is ${code}.\n\nIt expires in 10 minutes. Enter it only at ${baseUrl}.\n\nIf you did not request this code, you can ignore this email.\n\nScalio` }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}
const app = createApp({ db, sendCode, storage, baseUrl, admins: (process.env.ADMIN_EMAILS || '').split(',').map(normalizeEmail).filter(Boolean), secret: process.env.AUTH_SECRET });
const server = app.listen(Number(process.env.PORT || 3400), '0.0.0.0', () => console.log('Scalio investor room listening.'));
server.requestTimeout = 150_000;
const cleanup = setInterval(async () => {
  try { await db.accessSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }); await db.accessChallenge.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400000) } } }); }
  catch { console.error('Authentication cleanup failed'); }
}, 60 * 60_000);
cleanup.unref();
process.on('SIGTERM', () => server.close(async () => { await db.$disconnect(); process.exit(0); }));
