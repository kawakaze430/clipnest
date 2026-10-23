// Real-process lifecycle fixture. PGlite persistence is not native RDS proof.
import {PGlite} from '@electric-sql/pglite';
import {migrate} from '../../backend/migrate.mjs';
import {PgStore} from '../../backend/db/store.mjs';
import {loadConfig} from '../../backend/config.mjs';
import {WorkerRunner} from '../../backend/worker.mjs';
import {buildOptions,publicInfo} from '../../backend/core.mjs';
import {fixture} from '../fixtures.mjs';
const db=await PGlite.create(process.env.DRILL_DATA+'/sql');let chain=Promise.resolve();
function run(sql,values){return values?.length?db.query(sql,values):db.exec(sql).then(rows=>rows.at(-1));}
const pool={async connect(){let release;const prior=chain;chain=new Promise(r=>release=r);await prior;return{query:async(sql,values)=>{const r=await run(sql,values);return{...r,rowCount:r.affectedRows||r.rows?.length||0};},release};},async query(sql,values){const c=await this.connect();try{return await c.query(sql,values);}finally{c.release();}}};
const config=loadConfig({DATA_DIR:process.env.DRILL_DATA+'/media',SESSION_SECRET:'disposable-process-drill-session-secret',INLINE_WORKER:'false'});await migrate(pool);const store=new PgStore(pool,config);
const user=await store.createUser('drill@example.test','unused-test-password-hash');const options=buildOptions(fixture),a=await store.saveAnalysis(user.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,options),options),job=(await store.createJob(user.id,a.analysisId,options[0].id,'process-drill-unique-key')).job;
const worker=new WorkerRunner({store,config,engine:{download:async({signal})=>{process.send({event:'active',jobId:job.id});await new Promise((resolve,reject)=>{if(signal.aborted)return reject(new Error('Aborted'));signal.addEventListener('abort',()=>reject(new Error('Aborted')),{once:true});});}}});
process.once('SIGTERM',async()=>{await worker.stop();const after=await store.rawJob(job.id);await store.recoverExpiredLeases();const recovered=await store.rawJob(job.id);const usage=await store.usage(user.id);await db.close();process.send({event:'drained',status:after.status,leaseExpired:new Date(after.lease_until)<new Date(),recovered:recovered.status,reserved:usage.bytesReserved});process.disconnect();});
await worker.tick();
// Keep this fixture process alive until the OS signal arrives.
const keep=setInterval(()=>{},1000);process.once('disconnect',()=>clearInterval(keep));
