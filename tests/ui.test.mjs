import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {buildOptions,publicInfo} from '../backend/core.mjs';
import {fixture} from './fixtures.mjs';
import {acceptanceApp} from './helpers/acceptance-app.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){const deadline=Date.now()+12000;while(Date.now()<deadline){if(await check())return;await sleep(40);}throw new Error('DOM state timed out: '+label);}
// Emulated DOM + real HTTP/SQL. This is not a browser rendering/accessibility test.
test('CP-02 actual frontend scripts against real HTTP and PostgreSQL SQL in emulated DOM',{timeout:90000},async t=>{
 const service=await acceptanceApp({overrides:{DAILY_JOB_LIMIT:'100'}});t.after(()=>service.close());let cookie='';const windows=[];t.after(async()=>{for(const w of windows)await w.happyDOM.close();});
 async function page(file,script,fragment=''){
  const errors=[],w=new Window({url:service.origin+'/'+(file==='index.html'?'':file)+fragment,settings:{enableJavaScriptEvaluation:true,disableCSSFileLoading:true,disableJavaScriptFileLoading:true,disableComputedStyleRendering:true,suppressInsecureJavaScriptEnvironmentWarning:true}});windows.push(w);
  w.addEventListener('error',e=>errors.push(e.error||e.message));w.HTMLElement.prototype.scrollIntoView=function(){};
  w.fetch=async(input,options={})=>{const headers=new Headers(options.headers);headers.set('Origin',service.origin);if(cookie)headers.set('Cookie',cookie);const c=new AbortController();options.signal?.addEventListener('abort',()=>c.abort(),{once:true});if(options.signal?.aborted)c.abort();const result=await fetch(new URL(String(input),service.origin),{...options,headers,signal:c.signal});const next=result.headers.get('set-cookie');if(next)cookie=next.split(';')[0];return result;};
  w.document.write((await readFile(new URL('../dist/'+file,import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));w.document.close();w.eval(await readFile(new URL('../dist/'+script,import.meta.url),'utf8'));
  return{w,errors,$:s=>w.document.querySelector(s),submit:s=>w.document.querySelector(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))};
 }
 let p;
 await t.test('anonymous sign-up, secure session and sign-out UI',async()=>{
  p=await page('index.html','app.js');await until(()=>!p.$('#account-open').hidden,'account entry');p.$('#account-open').click();assert.equal(p.$('#account-dialog').open,true);p.$('#account-toggle').click();p.$('#account-email').value='ui@example.test';p.$('#account-password').value='acceptance password 123';p.submit('#account-form');await until(()=>p.$('#account-open').textContent==='My account','registration');assert.equal(p.$('#account-dialog').open,false);await until(()=>/daily requests/.test(p.$('#account-usage').textContent),'usage');assert.equal(p.errors.length,0);
 });
 await t.test('asynchronous quality selection, keyboard navigation, ready file, paginated account history',async()=>{
  p.$('#video-url').value='https://youtu.be/aqz-KE-bpKQ';p.submit('#link-form');await until(()=>p.$('[data-option]'),'quality results');const selected=p.$('[aria-checked="true"]');selected.dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.notEqual(selected.dataset.option,p.$('[aria-checked="true"]').dataset.option);p.$('#start-download').click();await until(()=>p.$('#save-file'),'ready download');await until(()=>p.$('#recent-count').textContent==='1','history');assert.match(p.$('#history-list').textContent,/Synthetic acceptance video/);assert.equal(p.errors.length,0);
 });
 await t.test('history pagination loads the next owned page without dropping earlier items',async()=>{
  const user=(await service.db.pool.query('SELECT id FROM users WHERE email=$1',['ui@example.test'])).rows[0],options=buildOptions(fixture),a=await service.store.saveAnalysis(user.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,options),options);for(let i=0;i<21;i++){const j=(await service.store.createJob(user.id,a.analysisId,options[0].id,'pagination-ui-key-'+i)).job;await service.store.cancelJob(user.id,j.id);}
  p=await page('index.html','app.js');await until(()=>p.$('#recent-count').textContent==='20','first history page');assert.equal(p.$('#history-more').hidden,false);p.$('#history-more').click();await until(()=>p.$('#recent-count').textContent==='22','second history page');assert.equal(p.$('#history-more').hidden,true);assert.match(p.$('#history-list').textContent,/Synthetic acceptance video/);
 });
 await t.test('session expiry removes private history and opens sign-in',async()=>{
  await service.db.pool.query("UPDATE user_sessions SET expires_at=now()-interval '1 second'");p.$('[data-history="21"]').click();await until(()=>p.$('#account-open').textContent==='Sign in','expired session');assert.equal(p.$('#account-dialog').open,true);assert.equal(p.$('#recent-count').textContent,'0');assert.equal(p.$('#job-panel').hidden,true);p.$('#account-email').value='ui@example.test';p.$('#account-password').value='acceptance password 123';p.submit('#account-form');await until(()=>p.$('#account-open').textContent==='My account','login');p.$('#account-open').click();p.$('#account-logout').click();await until(()=>p.$('#account-open').textContent==='Sign in','logout');
 });
 await t.test('account reset fragment is cleared and consumed through a form',async()=>{
  const user=(await service.db.pool.query('SELECT id FROM users WHERE email=$1',['ui@example.test'])).rows[0];await service.store.issueEmailAction(user.id,'reset');await service.app.worker.mail.tick();const message=service.deliveries.findLast(d=>d.subject.includes('Reset'));assert.ok(message);const hash=new URL(message.text.match(/https?:\/\/\S+/)[0]).hash;const q=await page('account.html','account.js',hash);await until(()=>q.$('#password'),'reset form');assert.equal(q.w.location.hash,'');q.$('#password').value='a new acceptance password';q.$('#confirm').value='a new acceptance password';q.submit('form');await until(()=>q.$('#page-title').textContent==='Sign in','reset success');assert.equal(q.errors.length,0);
 });
});
