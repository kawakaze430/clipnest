import { mkdir, realpath, stat, rm, writeFile, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeExtractorError, YtDlpEngine } from './core.mjs';
import {createStorage} from './storage.mjs';
import {SqsQueue,OutboxDispatcher} from './queue.mjs';
import {MailDispatcher} from './mail.mjs';
import {AnalysisRunner} from './analysis.mjs';
import {Metrics} from './metrics.mjs';
import {Maintenance} from './maintenance.mjs';

export function probeMedia(filename) {
  return new Promise((resolve,reject)=>{
    const child=spawn('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type','-of','json',filename],{stdio:['ignore','pipe','pipe']});
    let output='';const timer=setTimeout(()=>child.kill('SIGKILL'),10000);timer.unref();
    child.stdout.on('data',d=>{output+=d;if(output.length>128000)child.kill('SIGKILL');});child.stderr.resume();child.on('error',reject);
    child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error('Output media validation failed'));try{resolve(JSON.parse(output));}catch{reject(new Error('Invalid media metadata'));}});
  });
}
async function checksum(filename) { const hash=createHash('sha256');for await(const chunk of createReadStream(filename))hash.update(chunk);return hash.digest('hex'); }
export class WorkerRunner {
  constructor({store,config,engine,storage=createStorage(config),queue,mailer,metrics=new Metrics({environment:config.environment,role:'worker',logger:()=>{}})}){this.store=store;this.config=config;this.engine=engine;this.storage=storage;this.queue=queue||(config.queueMode==='sqs'?new SqsQueue(config):null);this.metrics=metrics;this.id=randomUUID();this.active=new Map();this.stopping=false;this.busy=false;this.analysis=new AnalysisRunner({store,config,engine,metrics});this.mail=new MailDispatcher({store,config,mailer,metrics});this.dispatcher=new OutboxDispatcher({store,queue:this.queue,metrics});this.maintenance=new Maintenance({store,config,storage,metrics});}
  start(){if(this.timer)return;this.stopping=false;this.analysis.start();this.mail.start();if(this.queue)this.dispatcher.start();this.timer=setInterval(()=>this.tick().catch(()=>this.metrics.emit('QueueReceiveFailure')),500);this.timer.unref();this.tick().catch(()=>{});}
  async tick(){if(this.stopping||this.busy)return;this.busy=true;try{await this.store.recoverExpiredLeases();while(!this.stopping&&this.active.size<this.config.maxConcurrent){let delivery=null;if(this.queue){this.receiveController=new AbortController();delivery=await this.queue.receive(this.receiveController.signal);if(!delivery)break;if(delivery.invalid){this.metrics.emit('QueueReceiveFailure');if(this.queue.reject)await this.queue.reject(delivery);else await this.queue.renew(delivery,60);break;}}const job=await this.store.claimJob(this.id,delivery?.jobId||null);if(!job){if(delivery){const current=await this.store.rawJob(delivery.jobId);if(!current||['ready','failed','cancelled','expired'].includes(current.status))await this.queue.ack(delivery);else await this.queue.renew(delivery,10);}break;}const controller=new AbortController();const task=this.run(job,controller,delivery).catch(()=>{}).finally(()=>this.active.delete(job.id));this.active.set(job.id,{controller,task});}}finally{this.busy=false;}}
  async run(job,controller=new AbortController(),delivery=null) {
    const directory=path.join(this.config.dataDir,`job-${job.id}`,`attempt-${this.id}-${job.attempts}`);
    let filename,artifact,leaseLost=false,timedOut=false,limitExceeded=false,complete=false,latest={phase:'Fetching video',progress:0,downloaded:0,total:job.payload.option.size||null,speed:null,eta:null};
    const parts=new Map();let flushChain=Promise.resolve();
    const flush=()=>{flushChain=flushChain.then(()=>this.store.progress(job.id,this.id,latest)).catch(()=>{controller.abort();});return flushChain;};
    const heartbeat=setInterval(async()=>{try{const lease=await this.store.heartbeat(job.id,this.id);if(!lease.owned){leaseLost=true;controller.abort();}else if(lease.cancel)controller.abort();}catch{leaseLost=true;controller.abort();}},5000);heartbeat.unref();
    const queueHeartbeat=delivery?setInterval(()=>this.queue.renew(delivery).catch(()=>{leaseLost=true;controller.abort();}),20000):null;queueHeartbeat?.unref();
    const progressTimer=setInterval(flush,1000);progressTimer.unref();
    const deadline=setTimeout(()=>{timedOut=true;controller.abort();},(this.config.jobTimeoutSeconds||1800)*1000);deadline.unref();
    try {
      await mkdir(directory,{recursive:true,mode:0o700});
      await this.engine.download({url:job.payload.url,option:job.payload.option,directory,signal:controller.signal,onFile:value=>{filename=value;},onProgress:p=>{
        if(controller.signal.aborted)return;
        if(p.status==='finished'||p.status==='processing'){latest={...latest,phase:'Preparing your file',speed:null,eta:null};return;}
        const current=Number(p.downloaded_bytes)||0,total=Number(p.total_bytes||p.total_bytes_estimate)||null;
        parts.set(p.info_dict?.format_id||p.filename||'main',{current,total});const items=[...parts.values()];
        const downloaded=items.reduce((n,v)=>n+v.current,0),combined=job.payload.option.size||(items.every(v=>v.total)?items.reduce((n,v)=>n+v.total,0):null);
        latest={phase:'Downloading to server',downloaded,total:combined,progress:combined?Math.min(99,Math.max(0,downloaded/combined*100)):null,speed:Number(p.speed)||null,eta:Number.isFinite(p.eta)?Math.max(0,Math.floor(p.eta)):null};
        if(downloaded>this.config.maxBytes){limitExceeded=true;controller.abort();}
      }});
      if(controller.signal.aborted)throw new Error('Interrupted');if(!filename)throw new Error('No output file');
      const canonical=await realpath(filename),expected=await realpath(directory);if(!canonical.startsWith(expected+path.sep))throw new Error('Output outside working directory');
      const details=await stat(canonical);if(!details.isFile()||!details.size||details.size>this.config.maxBytes)throw new Error('File exceeds size limit');
      const media=await probeMedia(canonical);const types=new Set((media.streams||[]).map(s=>s.codec_type));
      if(!types.has('audio')||(job.payload.option.type==='video'&&!types.has('video')))throw new Error('Output media is missing expected tracks');
      const mediaDuration = Number(media.format?.duration);
      if(!Number.isFinite(mediaDuration)||mediaDuration<=0||mediaDuration>this.config.maxDuration+1)throw new Error('Output duration is invalid or exceeds duration limit');
      await flush();await flushChain;
      artifact=await this.storage.put({jobId:job.id,filename:canonical,ext:job.payload.option.ext,sha256:await checksum(canonical),signal:controller.signal});
      complete=await this.store.complete(job.id,this.id,artifact);
      if(complete){this.metrics.emit('JobReady');this.metrics.emit('PreparedBytes',details.size,'Bytes');}
      if(!complete)await this.store.fail(job.id,this.id,{code:'CANCELLED',message:'Download cancelled.',cancelled:true});
    } catch(error){
      await flushChain;
      if(this.stopping||leaseLost)await this.store.abandon(job.id,this.id);
      else await this.store.fail(job.id,this.id,{code:limitExceeded?'FILE_LIMIT':timedOut?'DEADLINE_EXCEEDED':controller.signal.aborted?'CANCELLED':'DOWNLOAD_FAILED',message:limitExceeded?'The file exceeds your server’s size limit.':controller.signal.aborted?'Download cancelled or timed out.':safeExtractorError(error.message),cancelled:controller.signal.aborted&&!limitExceeded&&!timedOut});
    } finally {clearInterval(heartbeat);clearInterval(progressTimer);clearInterval(queueHeartbeat);clearTimeout(deadline);if(!complete){this.metrics.emit('JobFailure');if(artifact?.backend==='s3')await this.storage.delete(artifact).catch(()=>this.metrics.emit('CleanupFailure'));}if(!complete||this.storage.backend==='s3')await rm(directory,{recursive:true,force:true});if(delivery){const current=await this.store.rawJob(job.id);try{if(current&&['ready','failed','cancelled','expired'].includes(current.status))await this.queue.ack(delivery);else await this.queue.renew(delivery,0);}catch{this.metrics.emit('QueueReceiveFailure');}}}

  }
  async cleanup(){return this.maintenance.cleanup();}
  async stop(){this.stopping=true;clearInterval(this.timer);this.timer=null;this.receiveController?.abort();for(const active of this.active.values())active.controller.abort();const services=Promise.allSettled([this.analysis.stop(),this.mail.stop(),this.dispatcher.stop()]);while(this.busy)await new Promise(r=>setTimeout(r,10));for(const active of this.active.values())active.controller.abort();await Promise.allSettled([...this.active.values()].map(v=>v.task));await services;}

}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {loadRuntimeConfig}=await import('./runtime-config.mjs');const{createPool,PgStore}=await import('./db/store.mjs');
 const config=await loadRuntimeConfig();if(!config.databaseUrl)throw new Error('DATABASE_URL is required for a durable worker');
 const pool=await createPool(config),store=new PgStore(pool,config);if(!await store.health())throw new Error('Run database migrations before starting the worker');
 const worker=new WorkerRunner({store,config,metrics:new Metrics({environment:config.environment,role:'worker'}),engine:new YtDlpEngine({maxBytes:config.maxBytes,systemCa:config.systemCa})});worker.start();
 const cleanup=setInterval(()=>worker.cleanup().catch(()=>{}),60000);
 const beat=async()=>{try{await pool.query('INSERT INTO worker_heartbeats(worker_id) VALUES($1) ON CONFLICT(worker_id) DO UPDATE SET seen_at=now()',[worker.id]);const target=path.join(config.dataDir,'worker-health.json');await writeFile(target+'.tmp',JSON.stringify({lastDatabaseSuccess:Date.now(),workerId:worker.id}),{mode:0o600});await rename(target+'.tmp',target);}catch{}};await beat();const beatTimer=setInterval(beat,15000);
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;clearInterval(cleanup);clearInterval(beatTimer);const deadline=setTimeout(()=>process.exit(1),25000);deadline.unref();await worker.stop();worker.metrics.close();await pool.end();clearTimeout(deadline);};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 console.log(JSON.stringify({event:'worker_ready'}));
}
