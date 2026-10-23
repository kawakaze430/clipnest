import test from 'node:test';
import assert from 'node:assert/strict';
import {fork,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {testDatabase} from './helpers/database.mjs';
import {loadConfig} from '../backend/config.mjs';
import {migrate} from '../backend/migrate.mjs';
import {PgStore} from '../backend/db/store.mjs';
import {fixture} from './fixtures.mjs';
import {buildOptions,publicInfo} from '../backend/core.mjs';
if(!process.env.TEST_DATABASE_URL)throw new Error('Explicit disposable native PostgreSQL is required for crash acceptance');
test('SIGKILL expires a real native lease; a replacement process commits exactly once',{timeout:70000},async t=>{
 const db=await testDatabase(),dir=await mkdtemp(path.join(tmpdir(),'clipnest-native-crash-'));t.after(async()=>{await db.close();await rm(dir,{recursive:true,force:true});});assert.equal(db.kind,'native-postgresql');await migrate(db.pool);const schema=(await db.pool.query('SELECT current_schema() name')).rows[0].name,config=loadConfig({DATA_DIR:dir}),store=new PgStore(db.pool,config),user=await store.createUser('native-crash@example.test','fixture'),options=buildOptions(fixture),a=await store.saveAnalysis(user.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,options),options),job=(await store.createJob(user.id,a.analysisId,options[0].id,'native-crash-request')).job;
 const media=path.join(dir,'fixture.mp4');await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=160x90:r=10','-f','lavfi','-i','sine=frequency=440','-t','0.4','-c:v','mpeg4','-c:a','aac','-shortest',media]);
 function child(finish){const c=fork(new URL('./helpers/native-worker-child.mjs',import.meta.url),{env:{...process.env,DRILL_SCHEMA:schema,DRILL_DATA:dir,DRILL_MEDIA:media,DRILL_FINISH:String(finish)},stdio:['ignore','inherit','inherit','ipc']});t.after(()=>{if(c.exitCode===null)c.kill('SIGKILL');});return c;}
 const first=child(false);await once(first,'message');const firstExit=once(first,'exit');first.kill('SIGKILL');const [,signal]=await firstExit;assert.equal(signal,'SIGKILL');const expiry=Date.now()+40000;while(Date.now()<expiry){await store.recoverExpiredLeases();if((await store.rawJob(job.id)).status==='queued')break;await new Promise(r=>setTimeout(r,500));}assert.equal((await store.rawJob(job.id)).status,'queued');const second=child(true),secondExit=once(second,'exit');const [code]=await secondExit;assert.equal(code,0);const ready=await store.getJob(user.id,job.id);assert.equal(ready.status,'ready');assert.equal(ready.attempts,2);assert.equal((await db.pool.query('SELECT count(*)::int n FROM assets WHERE job_id=$1',[job.id])).rows[0].n,1);assert.equal((await store.usage(user.id)).bytesReserved,0);
});
