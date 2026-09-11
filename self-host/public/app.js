const root = document.querySelector('#app');
const account = document.querySelector('#account');
const modal = document.querySelector('#modal');
const linkId = location.pathname.startsWith('/r/') ? location.pathname.split('/')[2] : null;
let state, tab = 'documents', folder = 'all', challengeId, loginEmail, noticeTimer;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = s => new Date(s).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
function toast(text) { const el = document.querySelector('#notice'); el.textContent = text; el.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => el.hidden = true, 4500); }
async function api(url, options = {}) {
  const headers = options.body instanceof FormData ? {} : {'Content-Type':'application/json'};
  const res = await fetch(url, { ...options, headers: {...headers, ...options.headers} });
  const data = await res.json().catch(() => ({ error: 'Request failed. Please try again.' }));
  if (!res.ok) { const error = new Error(data.error || 'Please try again shortly.'); error.status = res.status; throw error; }
  return data;
}
async function load() {
  try { state = await api(`/api/state${linkId ? '?linkId='+encodeURIComponent(linkId) : ''}`); render(); }
  catch (e) { if ([401,403].includes(e.status)) login(); else root.innerHTML = `<div class="empty"><h2>Temporarily unavailable</h2><p>${esc(e.message)}</p><button class="button" data-action="reload">Try again</button></div>`; }
}
function login() {
  state = null; account.innerHTML = '';
  root.innerHTML = `<div class="login"><section><div class="eyebrow"><span class="dot"></span>Scalio · Investor relations</div><h1>A closer look<br>at what's next.</h1><p class="intro">A private space for the documents behind Scalio's next chapter.</p><div class="login-art"><div class="lock">↗</div><div><strong>Shared by the Scalio team</strong><p class="small">Available to approved email addresses.</p></div></div></section><section class="login-card"><h2>${linkId ? 'Welcome to our investor room' : 'Manage the investor room'}</h2><p class="small">${linkId ? 'Use the email address approved by the Scalio team. We’ll send a code to verify it’s you.' : 'Sign in with your Scalio admin email to manage documents and investor access.'}</p><form id="email-form"><label for="email">Email address</label><input id="email" type="email" autocomplete="email" placeholder="you@company.com" required maxlength="254"><button class="button primary full">Send verification code <span aria-hidden="true">→</span></button><p class="error" id="form-error"></p></form><p class="small">${linkId ? 'Need access? Contact the Scalio team using your existing conversation.' : 'Admin access is limited to Tanay and Aditya.'}</p></section></div>`;
  document.querySelector('#email-form').onsubmit = async event => {
    event.preventDefault(); const btn = event.currentTarget.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending…';
    loginEmail = document.querySelector('#email').value.trim().toLowerCase();
    try { const result = await api('/api/auth/request', {method:'POST', body:JSON.stringify({email:loginEmail,linkId})}); challengeId = result.challengeId; codeForm(); }
    catch(e) { document.querySelector('#form-error').textContent=e.message; btn.disabled=false; btn.textContent='Send verification code'; }
  };
}
function codeForm() {
  document.querySelector('.login-card').innerHTML = `<h2>Check your inbox</h2><p class="small">If <strong>${esc(loginEmail)}</strong> has access, a six-digit code is on its way. It expires in 10 minutes.</p><form id="code-form"><label for="code">Verification code</label><input class="code" id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus><button class="button primary full">Verify & continue →</button><p class="error" id="form-error"></p></form><button class="button text" data-action="login">Use another email or request a new code</button>`;
  document.querySelector('#code').focus();
  document.querySelector('#code-form').onsubmit = async event => {
    event.preventDefault();const btn=event.currentTarget.querySelector('button');btn.disabled=true;
    try { await api('/api/auth/verify',{method:'POST',body:JSON.stringify({challengeId,code:document.querySelector('#code').value})}); await load(); }
    catch(e) {document.querySelector('#form-error').textContent=e.message;btn.disabled=false;}
  };
}
function render() {
  account.innerHTML = `<span class="email">${esc(state.email)}</span><button class="button text" data-action="logout">Sign out</button>`;
  root.innerHTML = `<section class="hero"><div><div class="eyebrow"><span class="dot"></span>${state.admin?'Private workspace':'Investor relations'}</div><h1>Scalio investor room</h1><p>${state.admin ? 'Everything investors need, in one private space.' : 'A closer look at our business, progress, and plans.'}</p></div><div class="hero-actions">${state.admin ? '<button class="button" data-action="share">Share room ↗</button><button class="button primary" data-action="upload">＋ Upload PDF</button>' : `<span class="pill">${state.link.allowDownload ? 'Downloads allowed' : 'View only'}</span>`}</div></section>${state.admin ? `<nav class="tabs" aria-label="Room sections">${['documents','access','activity'].map(t=>`<button class="tab ${tab===t?'active':''}" data-tab="${t}">${t[0].toUpperCase()+t.slice(1)}${t==='documents'?' · '+state.documents.length:''}</button>`).join('')}</nav>` : '<hr class="divider">'}<section id="content"></section>`;
  if(tab==='access'&&state.admin) access(); else if(tab==='activity'&&state.admin) activity(); else documents();
}
function documents() {
  const selected=state.folders.find(f=>f.id===folder);
  if(folder!=='all'&&folder!=='none'&&!selected) folder='all';
  const docs=state.documents.filter(d=>folder==='all'||(folder==='none'?!d.folderId:d.folderId===folder));
  const folderButton=(id,name,count)=>`<button class="folder ${folder===id?'active':''}" data-folder="${id}"><span>${esc(name)}</span><span class="count">${count}</span></button>`;
  document.querySelector('#content').innerHTML=`<div class="workspace"><aside class="sidebar" aria-label="Folders">${folderButton('all','All documents',state.documents.length)}${folderButton('none','Unfiled',state.documents.filter(d=>!d.folderId).length)}${state.folders.map(f=>folderButton(f.id,f.name,state.documents.filter(d=>d.folderId===f.id).length)).join('')}${state.admin?'<button class="folder" data-action="new-folder">＋ New folder</button>':''}</aside><div><div class="section-top"><h3>${esc(selected?.name||(folder==='none'?'Unfiled':'All documents'))}</h3><div class="actions"><span class="small muted">${docs.length} document${docs.length===1?'':'s'}</span>${state.admin&&selected?`<button class="button text danger" data-delete-folder="${esc(selected.id)}">Delete folder</button>`:''}</div></div>${docs.length?`<div class="documents">${docs.map(d=>`<article class="doc"><div class="file-icon" aria-hidden="true">PDF</div><div class="doc-main"><button class="doc-title" data-view="${esc(d.id)}">${esc(d.name)}</button><div class="doc-meta">${d.numPages} page${d.numPages===1?'':'s'} · Added ${date(d.createdAt)}</div></div><div class="actions">${state.admin?`<button class="button text" data-move="${esc(d.id)}" aria-label="Move ${esc(d.name)}">Move</button><button class="button text danger" data-delete="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">Delete</button>`:'<span aria-hidden="true">↗</span>'}</div></article>`).join('')}</div>`:`<div class="empty"><div class="lock">▤</div><h3>${state.admin?'A home for your next chapter':'Documents are on their way'}</h3><p>${state.admin?'Upload your pitch deck, financials, and company documents as PDFs. Only approved investors can view them.':'The Scalio team will add documents here shortly.'}</p>${state.admin?'<button class="button primary full" data-action="upload">Upload your first PDF</button>':''}</div>`}</div></div>`;
}
function shareUrl(){return `${location.origin}/r/${state.link.id}`;}
function access() {
  document.querySelector('#content').innerHTML=`<div class="access-grid"><section class="panel"><h2>Who can open the room</h2><p class="small">The link alone does not grant access. Every visitor must verify an approved email address.</p><div class="share-box"><input aria-label="Investor room link" readonly value="${esc(shareUrl())}"><button class="button" data-action="copy">Copy link</button></div><form id="access-form"><label for="allowed">Approved investor emails</label><textarea id="allowed" placeholder="investor@company.com&#10;partner@fund.com">${esc(state.link.allowList.join('\n'))}</textarea><p class="small">One email per line. Removing an email revokes that person’s access immediately.</p><label class="check"><input id="download" type="checkbox" ${state.link.allowDownload?'checked':''}>Allow PDF downloads</label><p class="small">View-only access shows rendered pages. It cannot prevent screenshots or saving visible images.</p><label for="expiry">Link expires on <span class="muted">(optional)</span></label><input id="expiry" type="date" value="${state.link.expiresAt?esc(state.link.expiresAt.slice(0,10)):''}"><button class="button primary full">Save access settings</button><p id="access-error" class="error"></p></form></section><aside><section class="panel"><h3>Room administrators</h3><p class="small">Full access to documents and settings.</p>${state.admins.map(e=>`<div class="admin-person"><span class="avatar">${esc(e[0].toUpperCase())}</span><span>${esc(e)}</span></div>`).join('')}<hr class="divider"><h3>Replace the shared link</h3><p class="small">The old link and its investor sessions will stop working. The approved email list stays the same.</p><button class="button" data-action="rotate">Generate a new link</button></section></aside></div>`;
  document.querySelector('#access-form').onsubmit=async event=>{
    event.preventDefault();const btn=event.currentTarget.querySelector('button');btn.disabled=true;
    const expires=document.querySelector('#expiry').value;
    try{await api('/api/admin/access',{method:'PATCH',body:JSON.stringify({allowList:document.querySelector('#allowed').value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean),allowDownload:document.querySelector('#download').checked,expiresAt:expires?new Date(expires+'T23:59:59').toISOString():null})});toast('Access settings saved');await load();}
    catch(e){document.querySelector('#access-error').textContent=e.message;btn.disabled=false;}
  };
}
async function activity(){
  const content=document.querySelector('#content');content.innerHTML='<div class="loading">Loading activity…</div>';
  try{const rows=await api('/api/admin/activity');content.innerHTML=rows.length?`<section class="panel activity-wrap"><h2>Recent investor activity</h2><p class="small">The latest 100 verified room visits, document opens, and downloads.</p><table class="activity"><thead><tr><th>Email</th><th>Activity</th><th>Document</th><th>When</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.viewerEmail)}</td><td>${r.downloadedAt?'Downloaded PDF':r.viewType==='DATAROOM_VIEW'?'Opened room':'Opened document'}</td><td>${esc(r.document?.name||'—')}</td><td>${esc(new Date(r.viewedAt).toLocaleString())}</td></tr>`).join('')}</tbody></table></section>`:'<div class="empty"><h3>No investor activity yet</h3><p>Verified visits will appear here after you share the room.</p></div>';}
  catch(e){content.innerHTML=`<div class="empty"><p>${esc(e.message)}</p></div>`;}
}
function dialog(title,body,submit,onSubmit){
  modal.innerHTML=`<form id="dialog-form"><h2>${esc(title)}</h2>${body}<p class="error" id="dialog-error"></p><div class="actions"><button type="button" class="button" data-action="close">Cancel</button><button class="button primary" id="dialog-submit">${esc(submit)}</button></div></form>`;
  modal.showModal();
  document.querySelector('#dialog-form').onsubmit=async event=>{event.preventDefault();const btn=document.querySelector('#dialog-submit');btn.disabled=true;try{await onSubmit();modal.close();await load();}catch(e){document.querySelector('#dialog-error').textContent=e.message;btn.disabled=false;}};
}
function upload(){dialog('Add a document',`<p class="small">PDFs up to 30 MB and 200 pages. Investor previews are prepared before the document appears.</p><label for="file">PDF file</label><input id="file" type="file" accept="application/pdf,.pdf" required><label for="upload-folder">Folder</label><select id="upload-folder"><option value="">Unfiled</option>${state.folders.map(f=>`<option value="${esc(f.id)}" ${folder===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`,'Upload PDF',async()=>{const file=document.querySelector('#file').files[0];if(file.size>30*1024*1024)throw new Error('Please choose a PDF smaller than 30 MB.');const data=new FormData();data.set('file',file);data.set('folderId',document.querySelector('#upload-folder').value);document.querySelector('#dialog-submit').innerHTML='<span class="spinner"></span> Preparing preview…';await api('/api/admin/documents',{method:'POST',body:data});toast('Document uploaded');});}
async function view(id){
  try{const doc=await api(`/api/documents/${id}`);root.innerHTML=`<section class="viewer-head"><div class="viewer-name"><button class="button text" data-action="back">← Back to room</button><h2>${esc(doc.name)}</h2><span class="small muted">${doc.numPages} pages · Private document</span></div>${doc.allowDownload?`<a class="button" href="/api/documents/${encodeURIComponent(id)}/download">Download PDF ↓</a>`:'<span class="pill">View only</span>'}</section><div class="pages">${Array.from({length:doc.numPages},(_,i)=>`<img class="pdf-page" src="/api/documents/${encodeURIComponent(id)}/pages/${i+1}" alt="Page ${i+1} of ${esc(doc.name)}" loading="${i?'lazy':'eager'}">`).join('')}</div>`;window.scrollTo(0,0);}
  catch(e){toast(e.message);if(e.status===401)login();}
}
document.addEventListener('click',async event=>{
  const el=event.target.closest('button,a');if(!el)return;
  try{
    if(el.dataset.tab){tab=el.dataset.tab;render();}
    if(el.dataset.folder){folder=el.dataset.folder;documents();}
    if(el.dataset.view)await view(el.dataset.view);
    if(el.dataset.delete){const doc=state.documents.find(d=>d.id===el.dataset.delete);dialog('Delete document?',`<p>This removes <strong>${esc(doc.name)}</strong> from the room and deletes its stored PDF and previews.</p>`,'Delete document',()=>api(`/api/admin/documents/${doc.id}`,{method:'DELETE'}));}
    if(el.dataset.deleteFolder){dialog('Delete empty folder?','<p>Only an empty folder can be deleted.</p>','Delete folder',()=>api(`/api/admin/folders/${el.dataset.deleteFolder}`,{method:'DELETE'}));}
    if(el.dataset.move){const doc=state.documents.find(d=>d.id===el.dataset.move);dialog('Move document',`<label for="move-folder">Folder</label><select id="move-folder"><option value="">Unfiled</option>${state.folders.map(f=>`<option value="${esc(f.id)}" ${doc.folderId===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select>`,'Move document',()=>api(`/api/admin/documents/${doc.id}`,{method:'PATCH',body:JSON.stringify({folderId:document.querySelector('#move-folder').value||null})}));}
    const action=el.dataset.action;
    if(action==='login')login();
    if(action==='reload'||action==='back')await load();
    if(action==='close')modal.close();
    if(action==='logout'){await api('/api/auth/logout',{method:'POST'});login();}
    if(action==='upload')upload();
    if(action==='share'){tab='access';render();}
    if(action==='copy'){await navigator.clipboard.writeText(shareUrl());toast('Room link copied');}
    if(action==='new-folder')dialog('New folder','<label for="folder-name">Folder name</label><input id="folder-name" placeholder="e.g. Financials" maxlength="120" required>','Create folder',()=>api('/api/admin/folders',{method:'POST',body:JSON.stringify({name:document.querySelector('#folder-name').value})}));
    if(action==='rotate')dialog('Replace the shared link?','<p>Everyone using the old link will lose access, including signed-in investors. You’ll need to share the new link.</p>','Replace link',()=>api('/api/admin/access/rotate',{method:'POST'}));
  }catch(e){toast(e.message);}
});
load();
