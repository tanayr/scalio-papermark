import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../app.mjs';
import { seed } from '../seed.mjs';
import { ROOM_ID } from '../db.mjs';

function pdf() {
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream='BT /F1 22 Tf 40 440 Td (Scalio access verification fixture) Tj ET';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let text='%PDF-1.4\n';const offsets=[0];
  objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const start=Buffer.byteLength(text);text+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(text);
}
test('single-room upload, verified-email access, view-only, expiry and revocation', {skip:!process.env.INVEST_TEST_DATABASE_URL}, async () => {
  const url=process.env.INVEST_TEST_DATABASE_URL;
  if(!new URL(url).pathname.endsWith('_test'))throw new Error('Integration tests require a dedicated database ending in _test');
  const db=new PrismaClient({datasources:{db:{url}}});
  const storage=await mkdtemp(path.join(os.tmpdir(),'scalio-invest-test-'));
  const sent=[]; const baseUrl='http://localhost:9998';
  await seed(db);
  const app=createApp({db,storage,baseUrl,admins:['tanay@scalio.app','aditya@scalio.app'],secret:'test-secret-with-more-than-thirty-two-chars',secureCookies:false,sendCode:async(email,code)=>{sent.push({email,code});}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(route,method='GET',body,cookie,origin=baseUrl){
    const headers={Origin:origin};if(cookie)headers.Cookie=cookie;if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';
    return fetch(base+route,{method,headers,body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});
  }
  async function login(email,linkId=null){
    const response=await request('/api/auth/request','POST',{email,linkId});assert.equal(response.status,200);const {challengeId}=await response.json();
    const code=sent.at(-1).code;const verified=await request('/api/auth/verify','POST',{challengeId,code});assert.equal(verified.status,200);
    assert.equal((await request('/api/auth/verify','POST',{challengeId,code})).status,401,'one-use code cannot replay');
    return verified.headers.get('set-cookie').split(';')[0];
  }
  try {
    assert.equal((await request('/api/state')).status,401);
    assert.equal((await request('/api/auth/request','POST',{email:'tanay@scalio.app'},null,'https://attacker.test')).status,403);
    const unknown=await request('/api/auth/request','POST',{email:'stranger@example.com'});assert.equal(unknown.status,200);assert.equal(sent.length,0);
    const admin=await login('tanay@scalio.app');
    const initial=await (await request('/api/state','GET',null,admin)).json();let link=initial.link;
    assert.equal(initial.admin,true);assert.equal(initial.admins.length,2);
    const settings={allowList:['investor@example.com','second@example.com'],allowDownload:false,expiresAt:null};
    assert.equal((await request('/api/admin/access','PATCH',settings,admin)).status,200);
    const bad=await (await request('/api/auth/request','POST',{email:'second@example.com',linkId:link.id})).json();
    const correct=sent.at(-1).code;
    for(let i=0;i<5;i++) assert.equal((await request('/api/auth/verify','POST',{challengeId:bad.challengeId,code:'000000'})).status,401);
    assert.equal((await request('/api/auth/verify','POST',{challengeId:bad.challengeId,code:correct})).status,401,'five wrong attempts lock challenge');
    const folder=await (await request('/api/admin/folders','POST',{name:'Company overview'},admin)).json();
    const data=new FormData();data.set('folderId',folder.id);data.set('file',new Blob([pdf()],{type:'application/pdf'}),'Scalio test.pdf');
    const upload=await request('/api/admin/documents','POST',data,admin);assert.equal(upload.status,201,await upload.clone().text());const doc=await upload.json();assert.equal(doc.numPages,1);
    const viewer=await login('investor@example.com',link.id);
    const viewedState=await request('/api/state?linkId='+link.id,'GET',null,viewer);assert.equal(viewedState.status,200);const vs=await viewedState.json();assert.equal(vs.admin,false);assert.equal(vs.documents.length,1);assert.equal('file' in vs.documents[0],false);
    assert.equal((await request('/api/state?linkId=wrong','GET',null,viewer)).status,403);
    assert.equal((await request('/api/admin/activity','GET',null,viewer)).status,403);
    assert.equal((await request(`/api/documents/${doc.id}`,'GET',null,viewer)).status,200);
    const page=await request(`/api/documents/${doc.id}/pages/1`,'GET',null,viewer);assert.equal(page.status,200);assert.match(page.headers.get('content-type'),/image\/jpeg/);assert.match(page.headers.get('cache-control'),/no-store/);
    assert.equal((await request(`/api/documents/${doc.id}/pages/2`,'GET',null,viewer)).status,404);
    assert.equal((await request(`/api/documents/${doc.id}/download`,'GET',null,viewer)).status,403,'view-only denies original PDF');
    assert.equal((await request(`/api/documents/${doc.id}/pages/1`)).status,401);
    assert.equal((await request('/data/documents')).status,404);
    assert.equal((await request('/.env')).status,404);
    assert.equal((await request('/api/admin/access','PATCH',{...settings,allowDownload:true},admin)).status,200);
    const download=await request(`/api/documents/${doc.id}/download`,'GET',null,viewer);assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);
    const activity=await (await request('/api/admin/activity','GET',null,admin)).json();assert.ok(activity.some(v=>v.downloadedAt));
    await request('/api/admin/access','PATCH',{...settings,allowList:[]},admin);
    assert.equal((await request(`/api/documents/${doc.id}/pages/1`,'GET',null,viewer)).status,401,'removal revokes live image access');
    await request('/api/admin/access','PATCH',settings,admin);
    await db.link.update({where:{id:link.id},data:{expiresAt:new Date(0)}});
    assert.equal((await request(`/api/documents/${doc.id}/pages/1`,'GET',null,viewer)).status,401,'expiry revokes live sessions');
    await request('/api/admin/access','PATCH',settings,admin);
    await request('/api/admin/access/rotate','POST',{},admin);
    assert.equal((await request(`/api/documents/${doc.id}/pages/1`,'GET',null,viewer)).status,401,'replacing link revokes old sessions');
    const count=sent.length;await request('/api/auth/request','POST',{email:'investor@example.com',linkId:link.id});assert.equal(sent.length,count,'old links cannot issue new codes');
    assert.equal((await request(`/api/admin/documents/${doc.id}`,'DELETE',null,admin)).status,200);
    assert.equal((await request(`/api/admin/folders/${folder.id}`,'DELETE',null,admin)).status,200);
    assert.equal((await request('/api/auth/logout','POST',{},admin)).status,200);
    assert.equal((await request('/api/state','GET',null,admin)).status,401);
  } finally { await new Promise(resolve=>server.close(resolve)); await db.$disconnect(); await rm(storage,{recursive:true,force:true}); }
});
