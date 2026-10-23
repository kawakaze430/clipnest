import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {testDatabase} from './helpers/database.mjs';
import {migrate} from '../backend/migrate.mjs';
import {loadConfig} from '../backend/config.mjs';
import {PgStore} from '../backend/db/store.mjs';
import {buildOptions,publicInfo} from '../backend/core.mjs';
import {fixture} from './fixtures.mjs';

test('migration upgrades a populated CP-01 schema and preserves settled accounting',{timeout:45000},async t=>{
 const db=await testDatabase(),dir=await mkdtemp(path.join(tmpdir(),'clipnest-upgrade-'));t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});await copyFile(new URL('../backend/db/migrations/001_foundation.sql',import.meta.url),path.join(dir,'001_foundation.sql'));
 await migrate(db.pool,{directory:dir});await db.pool.query("INSERT INTO users(id,email,password_hash) VALUES('11111111-1111-4111-8111-111111111111','upgrade@example.test','fixture')");await db.pool.query("INSERT INTO daily_usage(user_id,usage_day,jobs_started,bytes_completed,bytes_reserved) VALUES('11111111-1111-4111-8111-111111111111',(now() AT TIME ZONE 'UTC')::date,2,100,300)");
 assert.deepEqual(await migrate(db.pool),['002_release_foundation.sql']);assert.deepEqual(await migrate(db.pool),[]);const g=(await db.pool.query('SELECT * FROM global_usage')).rows[0];assert.equal(Number(g.jobs_started),2);assert.equal(Number(g.bytes_completed),100);assert.equal(Number(g.bytes_reserved),300);assert.equal((await db.pool.query('SELECT email FROM users')).rows[0].email,'upgrade@example.test');
});
test('bounded concurrent submission enforces queue/global caps and rejects arbitrary selectors',{timeout:45000},async t=>{
 const db=await testDatabase();t.after(()=>db.close());await migrate(db.pool);const config=loadConfig({MAX_QUEUED_JOBS:'2',GLOBAL_DAILY_JOB_LIMIT:'3',MAX_CONCURRENT_JOBS:'1'}),store=new PgStore(db.pool,config),choices=buildOptions(fixture);
 const users=[];for(let i=0;i<8;i++){const user=await store.createUser(`load${i}@example.test`,'fixture');const analysis=await store.saveAnalysis(user.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,choices),choices);users.push({user,analysis});}
 const results=await Promise.allSettled(users.map(({user,analysis},i)=>store.createJob(user.id,analysis.analysisId,choices[0].id,'burst-request-key-'+i)));assert.equal(results.filter(v=>v.status==='fulfilled').length,2);for(const result of results.filter(v=>v.status==='rejected'))assert.equal(result.reason.code,'QUEUE_FULL');
 const queued=(await db.pool.query('SELECT id,user_id FROM download_jobs')).rows;for(const j of queued)await store.cancelJob(j.user_id,j.id);const next=await store.createJob(users[2].user.id,users[2].analysis.analysisId,choices[0].id,'after-capacity-key');assert.equal(next.job.status,'queued');await assert.rejects(()=>store.createJob(users[3].user.id,users[3].analysis.analysisId,choices[0].id,'global-cap-request'),e=>e.code==='GLOBAL_QUOTA_EXCEEDED');await assert.rejects(()=>store.createJob(users[4].user.id,users[4].analysis.analysisId,'137+140; arbitrary shell','selector-reject-key'),e=>e.code==='INVALID_FORMAT');const totals=(await db.pool.query('SELECT jobs_started,bytes_reserved FROM global_usage')).rows[0];assert.equal(Number(totals.jobs_started),3);assert.ok(Number(totals.bytes_reserved)>=0);
});
test('real process SIGTERM drains an active worker and leaves a retryable lease',{timeout:45000},async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'clipnest-process-'));t.after(()=>rm(directory,{recursive:true,force:true}));const child=fork(new URL('./helpers/drain-child.mjs',import.meta.url),{env:{...process.env,DRILL_DATA:directory},stdio:['ignore','pipe','pipe','ipc']});t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.resume();const messages=[];let active;const running=new Promise((resolve,reject)=>{active=resolve;child.once('error',reject);child.once('exit',code=>{if(!messages.some(m=>m.event==='active'))reject(new Error('Child exited before work: '+stderr));});});child.on('message',m=>{messages.push(m);if(m.event==='active')active();});await running;const exit=once(child,'exit');assert.equal(child.kill('SIGTERM'),true);const [code]=await exit;assert.equal(code,0,stderr);const result=messages.find(m=>m.event==='drained');assert.ok(result);assert.equal(result.leaseExpired,true);assert.equal(result.recovered,'queued');assert.ok(result.reserved>0);
});

test('retention preserves referenced analyses then prunes expired tasks and deleted-account tombstones',{timeout:45000},async t=>{
 const db=await testDatabase();t.after(()=>db.close());await migrate(db.pool);const store=new PgStore(db.pool,loadConfig()),user=await store.createUser('retention@example.test','fixture'),options=buildOptions(fixture),a=await store.saveAnalysis(user.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,options),options);
 await db.pool.query("UPDATE analyses SET expires_at=now()-interval '1 hour' WHERE id=$1",[a.analysisId]);await db.pool.query("INSERT INTO analysis_tasks(id,user_id,canonical_url,status,result_id,expires_at) VALUES('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',$1,'fixture','ready',$2,now()+interval '1 hour')",[user.id,a.analysisId]);await store.prune();assert.equal((await db.pool.query('SELECT count(*)::int n FROM analyses')).rows[0].n,1);await db.pool.query("UPDATE analysis_tasks SET expires_at=now()-interval '2 days'");await store.deleteAccount(user.id);await db.pool.query("UPDATE users SET deletion_requested_at=now()-interval '91 days'");await db.pool.query("UPDATE audit_events SET created_at=now()-interval '91 days'");await store.pruneRelease();assert.equal((await db.pool.query('SELECT count(*)::int n FROM users')).rows[0].n,0);
});

test('late analysis completion and stale sign-in cannot recreate deleted-account data',{timeout:45000},async t=>{
 const db=await testDatabase();t.after(()=>db.close());await migrate(db.pool);const store=new PgStore(db.pool,loadConfig()),u=await store.createUser('late-result@example.test','fixture'),options=buildOptions(fixture);const task=await store.createAnalysisTask(u.id,'https://youtu.be/'+fixture.id),claimed=await store.claimAnalysis('11111111-1111-4111-8111-111111111111');assert.equal(claimed.id,task.id);await store.deleteAccount(u.id);
 assert.equal(await store.completeAnalysis(claimed,'11111111-1111-4111-8111-111111111111',{metadata:publicInfo(fixture,options),options}),false);assert.equal((await db.pool.query('SELECT count(*)::int n FROM analyses')).rows[0].n,0);await assert.rejects(()=>store.saveAnalysis(u.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,options),options),e=>e.code==='AUTH_REQUIRED');await assert.rejects(()=>store.createSession(u.id,'a'.repeat(64)),e=>e.code==='AUTH_REQUIRED');await assert.rejects(()=>store.createAnalysisTask(u.id,'https://youtu.be/'+fixture.id),e=>e.code==='AUTH_REQUIRED');
});
