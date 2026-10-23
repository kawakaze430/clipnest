import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir,utimes,stat} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {testDatabase} from './helpers/database.mjs';
import {migrate} from '../backend/migrate.mjs';
import {PgStore} from '../backend/db/store.mjs';
import {loadConfig} from '../backend/config.mjs';
import {createDatabaseApp} from '../backend/database-app.mjs';
import {MailDispatcher} from '../backend/mail.mjs';
import {OutboxDispatcher} from '../backend/queue.mjs';
import {WorkerRunner} from '../backend/worker.mjs';
import {fixture} from './fixtures.mjs';
import {buildOptions,publicInfo} from '../backend/core.mjs';
import {opaqueId} from '../backend/security.mjs';

test('CP-02 account lifecycle, asynchronous analysis, distributed contracts and retention',{timeout:120000},async t=>{
 const db=await testDatabase(),dir=await mkdtemp(path.join(tmpdir(),'clipnest-release-'));
 const config=loadConfig({DATA_DIR:dir,INLINE_WORKER:'false',ALLOW_REGISTRATION:'true',REQUIRE_EMAIL_VERIFICATION:'true',SESSION_SECRET:'test-seal-secret-with-at-least-32-characters',AUTH_ATTEMPTS_PER_MINUTE:'100',API_REQUESTS_PER_MINUTE:'1000',ORPHAN_GRACE_MINUTES:'5'});
 const store=new PgStore(db.pool,config);await migrate(db.pool);
 const deliveries=[],mailer={send:async(id,payload)=>deliveries.push({...payload,id})};
 const dispatchMail=new MailDispatcher({store,config,mailer});
 const engine={health:async()=>({ready:true,ffmpeg:true}),analyze:async()=>fixture};
 const logs=[],app=await createDatabaseApp({config,store,engine,mailer,logger:s=>logs.push(s)});app.listen(0,'127.0.0.1');await once(app,'listening');config.publicOrigin='http://127.0.0.1:'+app.address().port;
 t.after(async()=>{await app.shutdown();await dispatchMail.stop();await db.close();await rm(dir,{recursive:true,force:true});});
 const password='a long fixture password';
 async function call(endpoint,{method='GET',body,user,key}={}){const headers={Origin:config.publicOrigin};if(body)headers['Content-Type']='application/json';if(user){headers.Cookie=user.cookie;headers['X-CSRF-Token']=user.csrf;}if(key)headers['Idempotency-Key']=key;const response=await fetch(config.publicOrigin+endpoint,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual'});const data=await response.json().catch(()=>null);return{status:response.status,data,headers:response.headers};}
 const session=result=>({id:result.data.user.id,email:result.data.user.email,cookie:result.headers.get('set-cookie').split(';')[0],csrf:result.data.csrfToken});
 async function register(email,extra={}){const r=await call('/api/auth/register',{method:'POST',body:{email,password,...extra}});assert.equal(r.status,201,JSON.stringify(r.data));return session(r);}
 function action(message,kind){const link=message.text.match(/https?:\/\/\S+/)[0];return new URLSearchParams(new URL(link).hash.slice(1)).get(kind);}
 async function verify(user){await dispatchMail.tick();const mail=deliveries.findLast(d=>d.to===user.email&&d.subject.includes('Verify'));assert.ok(mail);const token=action(mail,'verify');assert.equal((await call('/api/auth/verify',{method:'POST',body:{token}})).status,200);return token;}
 let user,operator;
 await t.test('successful HTTP login, wrong password, verification one-use and encrypted outbox',async()=>{
  user=await register('member@example.test');
  assert.equal((await call('/api/analyses',{method:'POST',user,body:{url:'https://youtu.be/'+fixture.id}})).status,403);
  const sealed=(await db.pool.query('SELECT sealed_payload FROM mail_outbox')).rows[0].sealed_payload;assert.ok(!sealed.includes(user.email)&&!sealed.includes('/account.html'));
  const token=await verify(user);assert.equal((await call('/api/auth/verify',{method:'POST',body:{token}})).status,400);
  assert.equal((await call('/api/auth/login',{method:'POST',body:{email:user.email,password:'incorrect password'}})).status,401);
  const signedIn=await call('/api/auth/login',{method:'POST',body:{email:user.email,password}});assert.equal(signedIn.status,200);assert.equal(signedIn.data.user.verified,true);assert.notEqual(session(signedIn).cookie,user.cookie);user=session(signedIn);
  assert.equal((await db.pool.query("SELECT sealed_payload FROM mail_outbox WHERE status='sent'")).rows[0].sealed_payload,null);
 });
 await t.test('operator-only invite beta and pause controls; invitation binds email and is single-use',async()=>{
  operator=await register('operator@example.test');await verify(operator);await db.pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'operator')",[operator.id]);
  assert.equal((await call('/api/admin/state',{user})).status,403);
  assert.equal((await call('/api/admin/controls',{method:'POST',user:operator,body:{registrationMode:'invite',downloadsPaused:true}})).status,200);
  assert.equal((await call('/api/auth/session')).data.allowRegistration,false);
  assert.equal((await call('/api/auth/register',{method:'POST',body:{email:'uninvited@example.test',password}})).status,403);
  assert.equal((await call('/api/admin/invitations',{method:'POST',user:operator,body:{email:'invited@example.test'}})).status,202);await dispatchMail.tick();const token=action(deliveries.findLast(d=>d.to==='invited@example.test'),'invite');
  assert.equal((await call('/api/auth/register',{method:'POST',body:{email:'wrong@example.test',password,invitationToken:token}})).status,403);
  const invited=await register('invited@example.test',{invitationToken:token});await verify(invited);
  assert.equal((await call('/api/auth/register',{method:'POST',body:{email:'invited@example.test',password,invitationToken:token}})).status,403);
  const options=buildOptions(fixture,{ffmpeg:true}),a=await store.saveAnalysis(user.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,options),options);
  await assert.rejects(()=>store.createJob(user.id,a.analysisId,options[0].id,'paused-job-key'),e=>e.code==='DOWNLOADS_PAUSED');
  await call('/api/admin/controls',{method:'POST',user:operator,body:{registrationMode:'open',downloadsPaused:false}});
 });
 await t.test('operator disable revokes sessions and rejects a correct-password login',async()=>{const target=await register('disabled@example.test');assert.equal((await call('/api/admin/disable',{method:'POST',user:operator,body:{userId:target.id}})).status,200);assert.equal((await call('/api/usage',{user:target})).status,401);assert.equal((await call('/api/auth/login',{method:'POST',body:{email:target.email,password}})).status,401);});
 let analysisResult;
 await t.test('asynchronous analysis is owned, durable, cancellable and produces safe qualities',async()=>{
  const created=await call('/api/analyses',{method:'POST',user,body:{url:'https://youtu.be/'+fixture.id}});assert.equal(created.status,202);
  assert.equal((await call('/api/analyses/'+created.data.id,{user:operator})).status,404);
  await app.worker.analysis.tick();await Promise.all([...app.worker.analysis.active.values()].map(v=>v.promise));
  const finished=await call('/api/analyses/'+created.data.id,{user});assert.equal(finished.data.status,'ready');analysisResult=finished.data.result;assert.ok(analysisResult.options.length);assert.equal('selector' in analysisResult.options[0],false);
  const cancelled=await call('/api/analyses',{method:'POST',user,body:{url:'https://youtu.be/'+fixture.id}});assert.equal((await call('/api/analyses/'+cancelled.data.id,{method:'DELETE',user})).data.status,'cancelled');
 });
 await t.test('SQS contract duplicate delivery cannot complete a job twice; final media can live off-worker',async()=>{
  const created=await call('/api/jobs',{method:'POST',user,key:'distributed-contract-key',body:{analysisId:analysisResult.analysisId,optionId:analysisResult.options.find(o=>o.type==='video').id}});assert.equal(created.status,202);
  const sent=[],queue={publish:async e=>sent.push(e),deliveries:[],receive:async()=>queue.deliveries.shift()||null,ack:async d=>{d.acked=true;},renew:async(d,seconds)=>{d.renewed=seconds;}};
  const dispatcher=new OutboxDispatcher({store,queue});await dispatcher.tick();await dispatcher.tick();assert.equal(sent.filter(e=>e.event_type==='download.requested'&&e.job_id===created.data.id).length,1);
  const media=path.join(dir,'media.mp4');await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=160x90:r=10','-f','lavfi','-i','sine=frequency=440','-t','0.4','-c:v','mpeg4','-c:a','aac','-shortest',media]);
  let release,started,downloads=0;const gate=new Promise(r=>release=r),began=new Promise(r=>started=r);
  const downloadEngine={download:async({directory,onFile})=>{downloads++;started();await gate;const target=path.join(directory,'media.mp4');await writeFile(target,await readFile(media));onFile(target);}};
  const objects=new Map(),storage={backend:'s3',put:async({jobId,filename,ext,sha256})=>{const key='media/'+jobId+'/'+randomUUID()+'.'+ext;const bytes=await readFile(filename);objects.set(key,bytes);return{backend:'s3',objectKey:key,size:bytes.length,filename:'media.mp4',ext,sha256};},delete:async a=>objects.delete(a.objectKey||a.object_key),sweepOrphans:async()=>0};
  const first={jobId:created.data.id,receipt:'first'},duplicate={jobId:created.data.id,receipt:'duplicate'};queue.deliveries.push(first);
  const w1=new WorkerRunner({store,config,engine:downloadEngine,queue,storage}),w2=new WorkerRunner({store,config,engine:downloadEngine,queue,storage});
  await w1.tick();await began;queue.deliveries.push(duplicate);await w2.tick();assert.equal(downloads,1);assert.equal(duplicate.renewed,10);
  release();await Promise.all([...w1.active.values()].map(v=>v.task));assert.equal(first.acked,true);queue.deliveries.push(duplicate);await w2.tick();assert.equal(duplicate.acked,true);assert.equal(downloads,1);
  const ready=await store.getJob(user.id,created.data.id);assert.equal(ready.status,'ready');const asset=(await db.pool.query('SELECT * FROM assets WHERE job_id=$1',[ready.id])).rows[0];assert.equal(asset.file_path,null);assert.equal(asset.storage_backend,'s3');assert.ok(objects.has(asset.object_key));
  const usage=await store.usage(user.id);assert.equal(usage.bytesReserved,0);assert.equal(usage.bytesCompleted,objects.get(asset.object_key).length);
  await storage.delete(asset);await store.markAssetDeleted(ready.id);await w1.stop();await w2.stop();await dispatcher.stop();
 });
 await t.test('outbox publication failure stays retryable without losing its DB job',async()=>{
  const a=await store.saveAnalysis(operator.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,buildOptions(fixture)),buildOptions(fixture));const job=(await store.createJob(operator.id,a.analysisId,buildOptions(fixture)[0].id,'outbox-retry-key')).job;
  const dispatcher=new OutboxDispatcher({store,queue:{publish:async()=>{throw new Error('simulated transport error');}}});await dispatcher.tick();const out=(await db.pool.query("SELECT * FROM outbox_events WHERE job_id=$1 AND event_type='download.requested'",[job.id])).rows[0];assert.equal(out.dispatched_at,null);assert.equal(out.publish_attempts,1);assert.equal((await store.getJob(operator.id,job.id)).status,'queued');await store.cancelJob(operator.id,job.id);
 });
 await t.test('password reset is single-use, expires and revokes previous sessions',async()=>{
  const unknown=await call('/api/auth/forgot',{method:'POST',body:{email:'absent@example.test'}}),known=await call('/api/auth/forgot',{method:'POST',body:{email:user.email}});assert.equal(unknown.status,202);assert.deepEqual(unknown.data,known.data);await dispatchMail.tick();const token=action(deliveries.findLast(d=>d.to===user.email&&d.subject.includes('Reset')),'reset');
  const changed='a changed fixture password';assert.equal((await call('/api/auth/reset',{method:'POST',body:{token,password:changed}})).status,200);assert.equal((await call('/api/usage',{user})).status,401);assert.equal((await call('/api/auth/reset',{method:'POST',body:{token,password:changed}})).status,400);
  user=session(await call('/api/auth/login',{method:'POST',body:{email:user.email,password:changed}}));
  await store.issueEmailAction(user.id,'reset');await db.pool.query("UPDATE email_actions SET expires_at=now()-interval '1 second' WHERE user_id=$1 AND kind='reset' AND consumed_at IS NULL",[user.id]);await dispatchMail.tick();const expired=action(deliveries.findLast(d=>d.to===user.email&&d.subject.includes('Reset')),'reset');assert.equal((await call('/api/auth/reset',{method:'POST',body:{token:expired,password:changed}})).status,400);
 });
 await t.test('privacy export excludes credentials; deletion revokes access and cleanup purges personal history',async()=>{
  const exported=await call('/api/account/export',{user});assert.equal(exported.status,200);assert.equal(exported.data.user.email,user.email);const text=JSON.stringify(exported.data);assert.ok(!text.includes('password_hash')&&!text.includes('token_hash')&&!text.includes('sealed_payload'));
  assert.equal((await call('/api/account',{method:'DELETE',user,body:{password:'wrong password'}})).status,401);
  const closed=await call('/api/account',{method:'DELETE',user,body:{password:'a changed fixture password'}});assert.equal(closed.status,200);assert.equal((await call('/api/usage',{user})).status,401);await app.worker.cleanup();assert.equal((await db.pool.query('SELECT count(*)::int n FROM download_jobs WHERE user_id=$1',[user.id])).rows[0].n,0);const row=(await db.pool.query('SELECT * FROM users WHERE id=$1',[user.id])).rows[0];assert.ok(row.email.endsWith('@deleted.invalid'));assert.equal(row.password_hash,'deleted');
 });
 await t.test('orphan file sweep removes only old unowned attempts and preserves current valid files',async()=>{
  const jobId=opaqueId(),attempt=path.join(dir,'job-'+jobId,'attempt-'+randomUUID()+'-1');await mkdir(attempt,{recursive:true});await writeFile(path.join(attempt,'partial.mp4'),'partial');const ago=new Date(Date.now()-6*60000);await utimes(attempt,ago,ago);await app.worker.cleanup();await assert.rejects(()=>stat(attempt),e=>e.code==='ENOENT');assert.ok(!logs.join('').includes('password_hash'));assert.ok(!logs.join('').includes('a long fixture password'));
 });
});
