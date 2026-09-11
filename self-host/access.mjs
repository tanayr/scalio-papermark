import { createHash, createHmac, randomBytes } from 'node:crypto';

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export const codeHash = (secret, id, code) => createHmac('sha256', secret).update(`${id}:${code}`).digest('hex');

export function canView(link, email, now = new Date()) {
  return !!link && !link.isArchived && (!link.expiresAt || link.expiresAt > now)
    && link.allowList.includes(normalizeEmail(email));
}

export function canDownload(link, email, now = new Date()) {
  return canView(link, email, now) && link.allowDownload === true;
}
