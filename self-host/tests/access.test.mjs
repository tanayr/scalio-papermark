import test from 'node:test';
import assert from 'node:assert/strict';
import { canView, canDownload, normalizeEmail } from '../access.mjs';

const link = { allowList: ['investor@example.com'], allowDownload: false, isArchived: false, expiresAt: null };
test('exact approved emails only; no domain, suffix, or substring matching', () => {
  assert.equal(canView(link, ' INVESTOR@EXAMPLE.COM '), true);
  for (const email of ['other@example.com','investor@example.com.attacker.test','investor+other@example.com','']) assert.equal(canView(link,email),false);
  assert.equal(normalizeEmail(' A@B.COM '),'a@b.com');
});
test('revocation and expiry override otherwise valid permissions', () => {
  assert.equal(canView({...link,isArchived:true},'investor@example.com'),false);
  assert.equal(canView({...link,expiresAt:new Date(0)},'investor@example.com'),false);
  assert.equal(canDownload(link,'investor@example.com'),false);
  assert.equal(canDownload({...link,allowDownload:true},'investor@example.com'),true);
  assert.equal(canDownload({...link,allowDownload:true,isArchived:true},'investor@example.com'),false);
});
