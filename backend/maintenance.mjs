import {readdir,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalStorage} from './storage.mjs';
export class Maintenance {
 constructor({store,config,storage,metrics}){this.store=store;this.config=config;this.storage=storage;this.metrics=metrics;this.id=randomUUID();}
 async cleanup(){const claimed=await this.store.pool.query("INSERT INTO maintenance_leases(name,owner,expires_at) VALUES('cleanup',$1,now()+interval '2 minutes') ON CONFLICT(name) DO UPDATE SET owner=$1,expires_at=now()+interval '2 minutes' WHERE maintenance_leases.expires_at<=now() RETURNING name",[this.id]);if(!claimed.rowCount)return;
  try{for(const asset of await this.store.expiredAssets()){try{const adapter=asset.storage_backend==='s3'?this.storage:new LocalStorage(this.config);if(asset.storage_backend==='s3'&&adapter.backend!=='s3')throw new Error('S3 cleanup requires its adapter');await adapter.delete(asset);await this.store.markAssetDeleted(asset.job_id);}catch{await this.store.assetDeleteFailed(asset.job_id);this.metrics?.emit('CleanupFailure');}}
   let removed=0;for(const job of await readdir(this.config.dataDir,{withFileTypes:true}).catch(()=>[])){if(!job.isDirectory()||!/^job-[\w-]{32}$/.test(job.name))continue;const jobDir=path.join(this.config.dataDir,job.name);for(const attempt of await readdir(jobDir,{withFileTypes:true})){const match=/^attempt-([a-f0-9-]{36})-(\d+)$/.exec(attempt.name);if(!attempt.isDirectory()||!match)continue;const target=path.join(jobDir,attempt.name),details=await stat(target);if(Date.now()-details.mtimeMs<this.config.orphanGraceMinutes*60000)continue;if(await this.store.attemptIsLive(job.name.slice(4),match[1],Number(match[2])))continue;await rm(target,{recursive:true,force:true});removed++;}if(!(await readdir(jobDir)).length)await rm(jobDir,{recursive:true,force:true});}
   if(this.storage.backend==='s3')removed+=await this.storage.sweepOrphans(this.store);
   if(removed)this.metrics?.emit('OrphanFilesDeleted',removed);
   await this.store.prune();await this.store.pruneRelease();
   const mailDir=path.join(this.config.dataDir,'mail');for(const file of await readdir(mailDir,{withFileTypes:true}).catch(()=>[])){if(!file.isFile()||!/^[-a-f0-9]{36}\.json$/.test(file.name))continue;const target=path.join(mailDir,file.name);if(Date.now()-(await stat(target)).mtimeMs>7*86400000)await rm(target,{force:true});}
   const state=await this.store.operationalSnapshot();this.metrics?.emit('ExpiredObjects',state.expiredObjects);this.metrics?.emit('OldestExpiredSeconds',state.oldestExpiredSeconds,'Seconds');
  }finally{await this.store.pool.query("DELETE FROM maintenance_leases WHERE name='cleanup' AND owner=$1",[this.id]);}
 }
}
