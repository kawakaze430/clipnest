import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { testDatabase } from './helpers/database.mjs';
import { migrate } from '../backend/migrate.mjs';
import { PgStore } from '../backend/db/store.mjs';
import { loadConfig } from '../backend/config.mjs';
import { digest, opaqueId } from '../backend/security.mjs';
import { publicInfo, buildOptions } from '../backend/core.mjs';
import { createDatabaseApp } from '../backend/database-app.mjs';
import { WorkerRunner } from '../backend/worker.mjs';
import { fixture } from './fixtures.mjs';

test('durable SQL, account API and worker integration', {timeout:120000}, async t => {
  const db=await testDatabase(), pool=db.pool;
  t.diagnostic(`Database scope: ${db.kind}; native concurrency is a separate conditional test.`);
  const directory=await mkdtemp(path.join(tmpdir(),'clipnest-sql-'));
  const config={...loadConfig({DATA_DIR:directory,INLINE_WORKER:'false',ALLOW_REGISTRATION:'true',SESSION_SECRET:'test-secret-is-more-than-32-characters',AUTH_ATTEMPTS_PER_MINUTE:'100',API_REQUESTS_PER_MINUTE:'1000'}), maxBytes:1000000,dailyBytes:5000000,dailyJobs:5};
  const store=new PgStore(pool,config);
  let app;
  t.after(async()=>{if(app)await app.shutdown();await db.close();await rm(directory,{recursive:true,force:true});});
  await t.test('migrations apply once and reject changed historical SQL',async()=>{
    await migrate(pool);assert.equal(await store.health(),true);await migrate(pool);
    const migrations=path.join(directory,'migrations');await import('node:fs/promises').then(fs=>fs.mkdir(migrations));
    await writeFile(path.join(migrations,'001_foundation.sql'),'SELECT 1;');
    await assert.rejects(()=>migrate(pool,{directory:migrations}),/checksum|changed/i);
    assert.equal((await pool.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,2);
    await writeFile(path.join(migrations,'001_foundation.sql'),await readFile(new URL('../backend/db/migrations/001_foundation.sql',import.meta.url)));
    await writeFile(path.join(migrations,'002_bad.sql'),'CREATE TABLE should_roll_back(id integer); SELECT missing_test_function();');
    await assert.rejects(()=>migrate(pool,{directory:migrations}),/missing_test_function/);
    assert.equal((await pool.query("SELECT to_regclass('should_roll_back') IS NULL AS absent")).rows[0].absent,true);
  });
  const user=await store.createUser('one@example.test','test-only-hash'),other=await store.createUser('two@example.test','test-only-hash');
  const options=buildOptions(fixture,{ffmpeg:true}), metadata=publicInfo(fixture,options);
  const analysis=()=>store.saveAnalysis(user.id,'https://www.youtube.com/watch?v='+fixture.id,metadata,options);
  let first,firstAnalysis;
  await t.test('job, reservation, quota and outbox commit together; retries are idempotent',async()=>{
    firstAnalysis=await analysis();const result=await store.createJob(user.id,firstAnalysis.analysisId,options[0].id,'first-request-key');first=result.job;
    const replay=await store.createJob(user.id,firstAnalysis.analysisId,options[0].id,'first-request-key');assert.equal(replay.job.id,first.id);assert.equal(replay.replayed,true);
    await assert.rejects(()=>store.createJob(user.id,firstAnalysis.analysisId,options[1].id,'first-request-key'),e=>e.code==='IDEMPOTENCY_CONFLICT');
    assert.equal((await pool.query('SELECT count(*)::int n FROM outbox_events WHERE job_id=$1',[first.id])).rows[0].n,1);
    assert.equal((await store.usage(user.id)).bytesReserved,config.maxBytes);
    const before=await store.usage(user.id);
    await assert.rejects(()=>store.createJob(user.id,firstAnalysis.analysisId,options[0].id,'second-request-key'),e=>e.code==='ACTIVE_JOB_LIMIT');
    assert.deepEqual(await store.usage(user.id),before);
    await pool.query("CREATE FUNCTION reject_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test outbox failure'; END $$");
    await pool.query('CREATE TRIGGER reject_outbox BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_test_outbox()');
    const foreign=await store.saveAnalysis(other.id,'https://www.youtube.com/watch?v='+fixture.id,metadata,options);
    await assert.rejects(()=>store.createJob(other.id,foreign.analysisId,options[0].id,'rollback-request'),/outbox failure/);
    assert.equal((await pool.query('SELECT count(*)::int n FROM download_jobs WHERE user_id=$1',[other.id])).rows[0].n,0);
    assert.equal((await store.usage(other.id)).jobsStarted,0);
    await pool.query('DROP TRIGGER reject_outbox ON outbox_events');
  });
  await t.test('ownership is enforced on reads, cancellation, analyses and database foreign keys',async()=>{
    await assert.rejects(()=>store.getJob(other.id,first.id),e=>e.status===404);
    await assert.rejects(()=>store.cancelJob(other.id,first.id),e=>e.status===404);
    await assert.rejects(()=>store.createJob(other.id,firstAnalysis.analysisId,options[0].id,'foreign-request'),e=>e.code==='ANALYSIS_EXPIRED');
    await assert.rejects(()=>pool.query('UPDATE download_jobs SET user_id=$2 WHERE id=$1',[first.id,other.id]),e=>e.code==='23503');
    await assert.rejects(()=>pool.query("UPDATE download_jobs SET status='ready' WHERE id=$1",[first.id]),e=>e.code==='23514');
  });
  const workerA=randomUUID(),workerB=randomUUID();
  await t.test('leases recover after interruption; stale workers cannot finish; cancellation releases quota once',async()=>{
    assert.equal((await store.claimJob(workerA)).id,first.id);
    await pool.query("UPDATE download_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[first.id]);
    assert.equal(await store.recoverExpiredLeases(),1);const claimed=await store.claimJob(workerB);assert.equal(claimed.attempts,2);
    const asset={path:'/invalid',filename:'test.mp4',ext:'mp4',size:20,sha256:'a'.repeat(64)};
    assert.equal(await store.complete(first.id,workerA,asset),false);
    await store.cancelJob(user.id,first.id);assert.equal(await store.complete(first.id,workerB,asset),false);
    await store.fail(first.id,workerB,{cancelled:true});await store.fail(first.id,workerB,{cancelled:true});
    assert.equal((await store.usage(user.id)).bytesReserved,0);
    const restarted=new PgStore(pool,config);assert.equal((await restarted.getJob(user.id,first.id)).status,'cancelled');
  });
  await t.test('daily quota and analysis expiry reject without creating jobs',async()=>{
    const a=await analysis();await pool.query("UPDATE analyses SET expires_at=now()-interval '1 second' WHERE id=$1",[a.analysisId]);
    await assert.rejects(()=>store.createJob(user.id,a.analysisId,options[0].id,'expired-request'),e=>e.status===410);
    await pool.query('UPDATE daily_usage SET jobs_started=$2 WHERE user_id=$1',[user.id,config.dailyJobs]);
    const fresh=await analysis();await assert.rejects(()=>store.createJob(user.id,fresh.analysisId,options[0].id,'quota-request'),e=>e.code==='DAILY_QUOTA_EXCEEDED');
    await pool.query('UPDATE daily_usage SET jobs_started=1 WHERE user_id=$1',[user.id]);
  });
  let readyJob,media;
  await t.test('worker validates real FFmpeg fixture output, persists checksum and settles actual bytes',async()=>{
    media=path.join(directory,'fixture.mp4');
    await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=160x90:r=10','-f','lavfi','-i','sine=frequency=440','-t','0.5','-c:v','mpeg4','-c:a','aac','-shortest',media]);
    const a=await analysis();readyJob=(await store.createJob(user.id,a.analysisId,options.find(o=>o.type==='video'&&o.ext==='mp4').id,'fixture-worker-request')).job;
    const engine={async download({directory,onFile}){const target=path.join(directory,'fixture.mp4');await writeFile(target,await readFile(media));onFile(target);}};
    const worker=new WorkerRunner({store,config,engine});const row=await store.claimJob(worker.id);await worker.run(row);
    const result=await store.getJob(user.id,readyJob.id);assert.equal(result.status,'ready');assert.match(result.sha256,/^[a-f0-9]{64}$/);
    assert.equal((await store.usage(user.id)).bytesCompleted,(await readFile(media)).length);assert.equal((await store.usage(user.id)).bytesReserved,0);
  });
  await t.test('sessions are hashed, expire and revoke; rate limits survive a new repository instance',async()=>{
    const raw=opaqueId();await store.createSession(user.id,digest(raw));assert.equal((await store.resolveSession(digest(raw))).id,user.id);
    assert.equal((await pool.query('SELECT token_hash FROM user_sessions WHERE user_id=$1',[user.id])).rows.some(r=>r.token_hash===raw),false);
    await pool.query("UPDATE user_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[digest(raw)]);assert.equal(await store.resolveSession(digest(raw)),null);
    await store.createSession(user.id,digest(raw));await store.revokeSession(digest(raw),user.id);assert.equal(await store.resolveSession(digest(raw)),null);
    await store.hitRate('test-limit',1);await assert.rejects(()=>new PgStore(pool,config).hitRate('test-limit',1),e=>e.status===429);
  });
  let cookie,csrf,apiUser;
  await t.test('account HTTP flow rejects cross-origin, missing CSRF and browser-ID impersonation',async()=>{
    const engine={health:async()=>({ready:true,ffmpeg:true}),analyze:async()=>fixture};
    app=await createDatabaseApp({config,store,engine,logger:()=>{}});app.listen(0,'127.0.0.1');await once(app,'listening');
    const base='http://127.0.0.1:'+app.address().port;config.publicOrigin=base;
    const request=async(endpoint,opts={})=>fetch(base+endpoint,opts);
    const authBody=JSON.stringify({email:'api@example.test',password:'a long fixture password'});
    assert.equal((await request('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://wrong.test'},body:authBody})).status,403);
    const registered=await request('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:authBody});assert.equal(registered.status,201);
    cookie=registered.headers.get('set-cookie').split(';')[0];const session=await registered.json();csrf=session.csrfToken;apiUser=session.user;
    assert.match(registered.headers.get('set-cookie'),/HttpOnly/);
    const mutation={method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify({url:'https://youtu.be/'+fixture.id})};
    assert.equal((await request('/api/analyze',mutation)).status,403);
    assert.equal((await request('/api/usage',{headers:{'X-Client-ID':apiUser.id}})).status,401);
    mutation.headers['X-CSRF-Token']=csrf;const analyzed=await request('/api/analyze',mutation);assert.equal(analyzed.status,200);const a=await analyzed.json();
    const create={method:'POST',headers:{...mutation.headers,'Idempotency-Key':'http-fixture-request'},body:JSON.stringify({analysisId:a.analysisId,optionId:a.options[0].id})};
    assert.equal((await request('/api/jobs',create)).status,202);assert.equal((await request('/api/jobs',create)).status,200);
    assert.equal((await request('/api/jobs?limit=0',{headers:{Cookie:cookie}})).status,400);
    const list=await request('/api/jobs',{headers:{Cookie:cookie}});assert.equal((await list.json()).items.length,1);
    assert.equal((await request('/api/jobs/'+first.id,{headers:{Cookie:cookie}})).status,404);
    await app.shutdown();app=await createDatabaseApp({config,store,engine,logger:()=>{}});app.listen(0,'127.0.0.1');await once(app,'listening');config.publicOrigin='http://127.0.0.1:'+app.address().port;
    const resumed=await fetch(config.publicOrigin+'/api/jobs',{headers:{Cookie:cookie}});assert.equal((await resumed.json()).items.length,1);
    const loggedOut=await fetch(config.publicOrigin+'/api/auth/logout',{method:'POST',headers:{Origin:config.publicOrigin,Cookie:cookie,'X-CSRF-Token':csrf}});assert.equal(loggedOut.status,200);
    assert.equal((await fetch(config.publicOrigin+'/api/usage',{headers:{Cookie:cookie}})).status,401);
  });
  await t.test('short-lived file tickets enforce expiry and support bounded ranges and HEAD',async()=>{
    const ticket=await store.ticket(user.id,readyJob.id),base=config.publicOrigin;
    const range=await fetch(base+ticket.path,{headers:{Range:'bytes=2-11'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,10);
    const head=await fetch(base+ticket.path,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.text()).length,0);
    assert.equal((await fetch(base+ticket.path,{headers:{Range:'bytes=99999999-'}})).status,416);
    await pool.query("UPDATE download_tickets SET expires_at=now()-interval '1 second'");assert.equal((await fetch(base+ticket.path)).status,410);
    await pool.query("UPDATE assets SET expires_at=now()-interval '1 second' WHERE job_id=$1",[readyJob.id]);
    await assert.rejects(()=>store.ticket(user.id,readyJob.id),e=>e.status===410);
    await app.worker.cleanup();assert.equal((await store.getJob(user.id,readyJob.id)).status,'expired');
  });
  await t.test('worker rejects corrupt output and terminal retry exhaustion releases reservation',async()=>{
    const a=await analysis(),job=(await store.createJob(user.id,a.analysisId,options[0].id,'corrupt-output-key')).job;
    const worker=new WorkerRunner({store,config,engine:{async download({directory,onFile}){const target=path.join(directory,'bad.mp4');await writeFile(target,'this is not valid media');onFile(target);}}});
    const claimed=await store.claimJob(worker.id); // An earlier HTTP test may own the oldest queued job.
    assert.ok(claimed);await worker.run(claimed);
    if(claimed.id!==job.id)await worker.run(await store.claimJob(worker.id));
    assert.equal((await store.getJob(user.id,job.id)).status,'failed');assert.equal((await store.usage(user.id)).bytesReserved,0);
    const b=await analysis(),retry=(await store.createJob(user.id,b.analysisId,options[0].id,'retry-exhaustion-key')).job;
    for(let i=0;i<3;i++){const row=await store.claimJob(worker.id);assert.equal(row.id,retry.id);await pool.query("UPDATE download_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[row.id]);await store.recoverExpiredLeases();}
    assert.equal((await store.getJob(user.id,retry.id)).status,'failed');assert.equal((await store.usage(user.id)).bytesReserved,0);
  });
  await t.test('native PostgreSQL parallel idempotency and global worker claim limits', {skip:db.kind!=='native-postgresql'},async()=>{
    const a=await analysis();const requests=await Promise.all(Array.from({length:8},()=>store.createJob(user.id,a.analysisId,options[0].id,'parallel-request-key')));
    assert.equal(new Set(requests.map(r=>r.job.id)).size,1);assert.equal(requests.filter(r=>!r.replayed).length,1);
    for (let i=0;i<2;i++) { const owner=await store.createUser(`parallel-${i}@example.test`,'test-only-hash');const owned=await store.saveAnalysis(owner.id,'https://www.youtube.com/watch?v='+fixture.id,metadata,options);await store.createJob(owner.id,owned.analysisId,options[0].id,'parallel-other-key'); }
    const workers=await Promise.all(Array.from({length:8},()=>store.claimJob(randomUUID())));assert.ok(workers.filter(Boolean).length<=config.maxConcurrent);
    assert.equal(workers.filter(Boolean).length,config.maxConcurrent);
    assert.equal(new Set(workers.filter(Boolean).map(row=>row.id)).size,workers.filter(Boolean).length);
  });
});
