// Disposable generated-media container/PG fault checks. No source service or AWS calls.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,chmod,mkdir,readFile,writeFile,rm,readdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {migrate} from '../../backend/migrate.mjs';
import {PgStore} from '../../backend/db/store.mjs';
import {loadConfig} from '../../backend/config.mjs';
import {buildOptions,publicInfo} from '../../backend/core.mjs';
import {fixture} from '../../tests/fixtures.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
const value=(name,fallback)=>{const at=args.indexOf(name);return at<0?fallback:args[at+1];};
const image=value('--image','clipnest:local');
const output=path.resolve(value('--output',path.join(root,'qa-artifacts/container-resource-drill')));
const suffix=randomBytes(8).toString('hex'),network='clipnest-resource-'+suffix,dbName=network+'-db';
const password=randomBytes(24).toString('hex');
const uid=process.getuid?.(),gid=process.getgid?.();
const report={recordedAt:new Date().toISOString(),scope:'Local generated-media WorkerRunner/PgStore and disposable PostgreSQL 17 in Docker; not authorized source, AWS/RDS/S3/SQS, physical-device or production acceptance.',productionAcceptance:false,scenarios:[],cleanup:{},commands:[]};
const owned=new Set();let temporary,pool,admin,networkCreated=false,dbUrl='',containerDbUrl='',failure=null;
const redact=text=>String(text).replaceAll(password,'[REDACTED]').replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi,'[REDACTED_DATABASE_URL]');
async function command(name,argv,{env={},timeout=30000,allowFailure=false}={}){
 const started=Date.now();let text='';
 const child=spawn(name,argv,{cwd:root,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);timer.unref();
 child.stdout.on('data',b=>{text=(text+b).slice(-150000);});child.stderr.on('data',b=>{text=(text+b).slice(-150000);});
 const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timer));
 report.commands.push({command:[name,...argv.map(redact)],exitCode:result.code,signal:result.signal,seconds:(Date.now()-started)/1000});
 if(result.code!==0&&!allowFailure)throw new Error(path.basename(name)+' failed: '+redact(text));
 return{...result,text:redact(text)};
}
const docker=(argv,options)=>command('docker',argv,options);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,timeout=15000){const until=Date.now()+timeout;let last;do{try{const result=await fn();if(result)return result;}catch(error){last=error;}await pause(150);}while(Date.now()<until);throw new Error('Bounded wait did not complete'+(last?': '+redact(last.message):''));}
const state=async name=>JSON.parse((await docker(['inspect','--format','{{json .State}}',name])).text);
async function events(name){const raw=(await docker(['logs',name])).text;return raw.split('\n').filter(line=>line.startsWith('{')).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);}
async function startWorker(mode,caseName,caseDir){
 const name=network+'-'+caseName+'-'+mode;owned.add(name);
 const mount=mode==='disk'?['--tmpfs',`/drill-data:rw,nosuid,nodev,size=8m,uid=${uid},gid=${gid}`]:['--mount',`type=bind,src=${caseDir},dst=/drill-data`];
 await docker(['run','-d','--name',name,'--network',network,'--user',`${uid}:${gid}`,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','192m','--memory-swap','192m','--cpus','1','--pids-limit','96',
  '--tmpfs',`/tmp:rw,nosuid,nodev,size=16m,uid=${uid},gid=${gid}`,'--tmpfs',`/app/.cache:rw,nosuid,nodev,size=16m,uid=${uid},gid=${gid}`,...mount,
  '--mount',`type=bind,src=${temporary},dst=/drill-fixture,readonly`,
  '--mount',`type=bind,src=${path.join(root,'tests/helpers/container-resource-worker.mjs')},dst=/app/tests/helpers/container-resource-worker.mjs,readonly`,
  '-e','TEST_DATABASE_URL','-e','DRILL_SCHEMA','-e','DRILL_MODE','-e','DRILL_CASE','--entrypoint','node',report.imageId,'tests/helpers/container-resource-worker.mjs'],
  {env:{TEST_DATABASE_URL:containerDbUrl,DRILL_SCHEMA:report.schema,DRILL_MODE:mode,DRILL_CASE:caseName}});
 return name;
}
async function waitExit(name){await docker(['wait',name],{timeout:20000});return state(name);}
async function snapshot(store,user,job){const raw=await store.rawJob(job.id),usage=await store.usage(user.id),assets=(await pool.query('SELECT * FROM assets WHERE job_id=$1',[job.id])).rows;return{raw,usage,assets};}
async function checkSettlement(store,user,job,{ready=false,attempts=1,errorCode=null}={}){
 const result=await snapshot(store,user,job);assert.equal(result.raw.status,ready?'ready':'failed');assert.equal(result.raw.attempts,attempts);assert.equal(result.usage.bytesReserved,0);assert.equal(result.assets.length,ready?1:0);assert.equal(result.usage.jobsStarted,1);
 const reservation=(await pool.query('SELECT state FROM usage_reservations WHERE job_id=$1',[job.id])).rows[0];assert.equal(reservation.state,ready?'settled':'released');
 if(errorCode)assert.equal(result.raw.error_code,errorCode);
 if(ready){assert.equal(result.usage.bytesCompleted,Number(result.assets[0].size_bytes));assert.ok(result.usage.bytesCompleted>0);}else assert.equal(result.usage.bytesCompleted,0);
 return{status:result.raw.status,attempts:result.raw.attempts,errorCode:result.raw.error_code,assetCount:result.assets.length,bytesReserved:result.usage.bytesReserved,bytesCompleted:result.usage.bytesCompleted,reservationState:reservation.state};
}
try{
 assert.ok(Number.isInteger(uid)&&uid>0&&Number.isInteger(gid),'Run this disposable bind-mount harness as a non-root Linux user');
 await mkdir(output,{recursive:true});
 report.imageId=(await docker(['image','inspect','--format','{{.Id}}',image])).text.trim();assert.match(report.imageId,/^sha256:[a-f0-9]{64}$/);
 report.imageRequested=image;report.node=process.version;report.startedAt=new Date().toISOString();
 report.runtimeUser={uid,gid,selection:'Explicit non-root runner UID/GID for private bind mounts. The Compose smoke separately checks the image default user.'};
 temporary=await mkdtemp(path.join(tmpdir(),'clipnest-container-resource-'));await chmod(temporary,0o755);
 await docker(['run','--rm','--user',`${uid}:${gid}`,'--network','none','--read-only','--cap-drop','ALL','--tmpfs',`/tmp:rw,size=16m,uid=${uid},gid=${gid}`,'--tmpfs',`/app/.cache:rw,size=16m,uid=${uid},gid=${gid}`,'--mount',`type=bind,src=${temporary},dst=/fixture`,'--entrypoint','ffmpeg',report.imageId,'-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=160x90:r=10','-f','lavfi','-i','sine=frequency=440','-t','0.4','-c:v','libx264','-c:a','aac','-shortest','/fixture/media.mp4']);
 report.fixture={generated:true,bytes:(await stat(path.join(temporary,'media.mp4'))).size,sha256:createHash('sha256').update(await readFile(path.join(temporary,'media.mp4'))).digest('hex')};
 await docker(['network','create',network]);networkCreated=true;
 owned.add(dbName);await docker(['run','-d','--name',dbName,'--network',network,'--network-alias','db','--memory','256m','--pids-limit','96','-p','127.0.0.1::5432','--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=128m','-e','POSTGRES_USER=clipnest','-e','POSTGRES_DB=clipnest','-e','POSTGRES_PASSWORD','postgres:17-bookworm','-c','shared_buffers=16MB'],{env:{POSTGRES_PASSWORD:password}});
 const port=(await docker(['port',dbName,'5432/tcp'])).text.trim().match(/^127\.0\.0\.1:(\d+)$/);assert.ok(port,'Database port must be loopback only');dbUrl=`postgresql://clipnest:${password}@127.0.0.1:${port[1]}/clipnest`;containerDbUrl=`postgresql://clipnest:${password}@db:5432/clipnest`;
 admin=new pg.Pool({connectionString:dbUrl,connectionTimeoutMillis:500,max:2});await waitFor(async()=>{await admin.query('SELECT 1');return true;},30000);
 report.databaseConnection={publishedAddress:'127.0.0.1',transport:'disposable local PostgreSQL TCP, not RDS TLS'};
 report.postgres=(await admin.query('SHOW server_version')).rows[0].server_version;assert.match(report.postgres,/^17\./);
 report.schema='clipnest_resource_'+suffix;await admin.query('CREATE SCHEMA '+report.schema);
 pool=new pg.Pool({connectionString:dbUrl,options:'-c search_path='+report.schema+',public',max:4});await migrate(pool);
 const config=loadConfig({DATA_DIR:temporary,SESSION_SECRET:'disposable-container-drill-session-secret',MAX_FILE_BYTES:'1048576',MAX_CONCURRENT_JOBS:'1'}),store=new PgStore(pool,config);
 for(const mode of ['sigterm','sigkill','oom','disk','deadline']){
  const record={name:mode,startedAt:new Date().toISOString(),status:'running'};report.scenarios.push(record);
  const caseDir=path.join(temporary,mode);await mkdir(caseDir,{mode:0o700});
  const user=await store.createUser(`${mode}-${suffix}@example.test`,'unused-fixture-password-hash'),choices=buildOptions(fixture),analysis=await store.saveAnalysis(user.id,'https://youtu.be/'+fixture.id,publicInfo(fixture,choices),choices),job=(await store.createJob(user.id,analysis.analysisId,choices[0].id,'resource-drill-'+mode)).job;
  const name=await startWorker(mode,mode,caseDir);record.containerName=name;
  await waitFor(async()=>{const rows=await events(name);const active=rows.find(r=>r.event==='active');if(!active){const s=await state(name);assert.equal(s.Running,true,'Worker exited before active-job observation');return false;}record.active=active;return true;});
  const before=await snapshot(store,user,job);assert.equal(before.raw.status,'downloading');assert.equal(before.raw.attempts,1);assert.ok(before.usage.bytesReserved>0);assert.equal(before.assets.length,0);record.activeJobObserved=true;
  record.dockerStats=(await docker(['stats','--no-stream','--format','{{json .}}',name])).text.trim();
  if(mode==='sigterm'||mode==='sigkill')await docker(['kill','--signal',mode==='sigterm'?'SIGTERM':'SIGKILL',name]);
  if(mode==='oom'||mode==='disk')await docker(['kill','--signal','SIGUSR1',name]);
  const exited=await waitExit(name);record.containerExit={exitCode:exited.ExitCode,oomKilled:exited.OOMKilled,error:exited.Error};record.telemetry=await events(name);
  await writeFile(path.join(output,mode+'.log'),redact((await docker(['logs',name])).text));
  if(mode==='sigterm'||mode==='sigkill'||mode==='oom'){
   assert.equal(exited.ExitCode,mode==='sigterm'?0:137);assert.equal(exited.OOMKilled,mode==='oom');
   const recoveryStarted=Date.now();await waitFor(async()=>{await store.recoverExpiredLeases();return(await store.rawJob(job.id)).status==='queued';},40000);record.recoveryWaitSeconds=(Date.now()-recoveryStarted)/1000;
   const recovered=await snapshot(store,user,job);assert.equal(recovered.assets.length,0);assert.ok(recovered.usage.bytesReserved>0);
   const replacement=await startWorker('complete',mode+'-replacement',caseDir);const secondExit=await waitExit(replacement);assert.equal(secondExit.ExitCode,0);assert.equal(secondExit.OOMKilled,false);record.replacementExit={exitCode:secondExit.ExitCode,oomKilled:secondExit.OOMKilled};record.replacementTelemetry=await events(replacement);
   record.settlement=await checkSettlement(store,user,job,{ready:true,attempts:2});
   const asset=(await snapshot(store,user,job)).assets[0];assert.ok(asset.file_path.startsWith('/drill-data/'));const file=path.join(caseDir,asset.file_path.slice('/drill-data/'.length));const data=await readFile(file);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);assert.equal(data.length,Number(asset.size_bytes));record.finalFile={bytes:data.length,sha256:asset.sha256};
  }else{
   assert.equal(exited.ExitCode,0);assert.equal(exited.OOMKilled,false);
   if(mode==='disk')assert.ok(record.telemetry.some(r=>r.event==='disk_error'&&r.code==='ENOSPC'),'Actual bounded tmpfs ENOSPC must be observed');
   record.settlement=await checkSettlement(store,user,job,{errorCode:mode==='deadline'?'DEADLINE_EXCEEDED':'DOWNLOAD_FAILED'});
   const finished=record.telemetry.find(r=>r.event==='finished');assert.ok(finished);assert.deepEqual(finished.remainingFiles,[],'Failed attempt files must be cleaned before container exit');record.failedAttemptScratchCleaned=true;
  }
  record.status='passed';record.completedAt=new Date().toISOString();
  // Stop each completed pair promptly; never remove unrelated containers.
  for(const own of [...owned].filter(n=>n!==dbName)){await docker(['rm','--force','--volumes',own]);owned.delete(own);}
 }
 report.status='passed';
}catch(error){failure=error;report.status='failed';report.error=redact(error.stack||error.message);for(const record of report.scenarios)if(record.status==='running')record.status='failed';}
finally{
 await pool?.end().catch(error=>{failure||=error;});
 if(admin){if(report.schema)await admin.query('DROP SCHEMA '+report.schema+' CASCADE').catch(error=>{failure||=error;});await admin.end().catch(error=>{failure||=error;});}
 for(const name of owned){const result=await docker(['rm','--force','--volumes',name],{allowFailure:true}).catch(error=>({code:1,text:error.message}));report.cleanup[name]=result.code===0;if(result.code!==0)failure||=new Error('Owned container cleanup failed');}
 if(networkCreated){const result=await docker(['network','rm',network],{allowFailure:true}).catch(error=>({code:1}));report.cleanup.network=result.code===0;if(result.code!==0)failure||=new Error('Owned network cleanup failed');}
 if(temporary)await rm(temporary,{recursive:true,force:true}).catch(error=>{failure||=error;});
 report.finishedAt=new Date().toISOString();report.status=failure?'failed':'passed';report.unproved=['Real source restrictions/authorized transfer','AWS/RDS/S3/SQS/CDN and release image','Production traffic/capacity thresholds','Elapsed orphan-retention grace and active multi-instance service outage'];
 await mkdir(output,{recursive:true});await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,imageId:report.imageId,scenarios:report.scenarios.map(r=>({name:r.name,status:r.status,settlement:r.settlement})),output,scope:report.scope,error:report.error},null,2));
 if(failure)process.exitCode=1;
}
