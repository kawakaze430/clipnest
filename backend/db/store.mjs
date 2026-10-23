import {ReleaseStore} from './release-store.mjs';
import {transaction} from './transaction.mjs';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../core.mjs';
import { opaqueId, digest } from '../security.mjs';
const { Pool } = pg;
const terminal = new Set(['ready', 'failed', 'cancelled', 'expired']);
export async function createPool(config) {
  const ssl = config.dbTls === 'verify-full' ? { rejectUnauthorized: true, ...(config.dbCaFile ? { ca: await readFile(config.dbCaFile, 'utf8') } : {}) } : false;
  const pool = new Pool({ connectionString: config.databaseUrl, ssl, max: config.dbPoolMax, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 15000, application_name: 'clipnest' });
  pool.on('error', () => console.error(JSON.stringify({ level: 'error', event: 'database_pool_error' })));
  return pool;
}
export {transaction} from './transaction.mjs';
export function jobView(row) {
  return { id: row.id, title: row.payload.title, videoId: row.payload.videoId, author: row.payload.author,
    quality: row.payload.option.label, ext: row.payload.option.ext, status: row.status, phase: row.phase,
    progress: row.progress === null ? null : Number(row.progress), downloaded: Number(row.downloaded_bytes), total: row.total_bytes ? Number(row.total_bytes) : null,
    speed: row.speed ? Number(row.speed) : null, eta: row.eta, error: row.error_message, errorCode: row.error_code,
    cancelRequested: row.cancel_requested, attempts: row.attempts, version: row.version,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null, createdAt: new Date(row.created_at).toISOString(),
    filename: row.filename || null, sha256: row.sha256 || null };
}
export class PgStore extends ReleaseStore {
  constructor(pool, config) { super(pool,config); }
  async health() { const r = await this.pool.query("SELECT to_regclass('analysis_tasks') IS NOT NULL AS migrated"); return !!r.rows[0].migrated; }
  async hitRate(key, limit) {
    const r = await this.pool.query('INSERT INTO rate_buckets(bucket_key,window_start,hits) VALUES($1,floor(extract(epoch FROM now())/60)::bigint,1) ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=rate_buckets.hits+1 RETURNING hits', [digest(key)]);
    if (r.rows[0].hits > limit) throw new ApiError(429, 'Too many requests. Please try again in a minute.', 'RATE_LIMITED');
  }
  async createUser(email, passwordHash, {enforceRegistration=false,invitationToken=null}={}) {
    return transaction(this.pool, async client => {
      if(enforceRegistration)await this.assertRegistration(client,email,invitationToken);
      let r;
      try { r = await client.query('INSERT INTO users(id,email,password_hash,verified_at) VALUES($1,$2,$3,CASE WHEN $4 THEN NULL ELSE now() END) RETURNING id,email,created_at,verified_at', [randomUUID(), email, passwordHash,!!this.config.requireEmailVerification]); }
      catch (error) { if (error.code === '23505') throw new ApiError(409, 'This account could not be created. Try signing in.', 'ACCOUNT_UNAVAILABLE'); throw error; }
      await client.query('INSERT INTO audit_events(user_id,action) VALUES($1,$2)', [r.rows[0].id, 'account.created']); return r.rows[0];
    });
  }
  async userForLogin(email) { return (await this.pool.query('SELECT id,email,password_hash,disabled_at,verified_at FROM users WHERE email=$1', [email])).rows[0] || null; }
  async createSession(userId, tokenHash) {
    await transaction(this.pool, async client => {
      const owner=await client.query('SELECT id FROM users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE', [userId]);if(!owner.rowCount)throw new ApiError(401,'Your account is unavailable.','AUTH_REQUIRED');
      await client.query("DELETE FROM user_sessions WHERE user_id=$1 AND (expires_at<=now() OR token_hash IN (SELECT token_hash FROM user_sessions WHERE user_id=$1 ORDER BY created_at DESC OFFSET 9))", [userId]);
      await client.query("INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+$3*interval '1 hour')", [tokenHash, userId, this.config.sessionHours]);
      await client.query('INSERT INTO audit_events(user_id,action) VALUES($1,$2)', [userId, 'session.created']);
    });
  }
  async resolveSession(tokenHash) { return (await this.pool.query("SELECT u.id,u.email,u.verified_at,EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='operator') AS is_operator FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL", [tokenHash])).rows[0] || null; }
  async revokeSession(tokenHash, userId) { await transaction(this.pool, async c => { await c.query('DELETE FROM user_sessions WHERE token_hash=$1 AND user_id=$2', [tokenHash,userId]); await c.query('INSERT INTO audit_events(user_id,action) VALUES($1,$2)',[userId,'session.revoked']); }); }
  async saveAnalysis(userId, url, metadata, options) {
    return transaction(this.pool,async c=>{const owner=await c.query('SELECT id FROM users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE',[userId]);if(!owner.rowCount)throw new ApiError(401,'Your account is unavailable.','AUTH_REQUIRED');const id=opaqueId();const r=await c.query("INSERT INTO analyses(id,user_id,video_id,canonical_url,metadata,options,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+$7*interval '1 minute') RETURNING expires_at",[id,userId,metadata.id,url,metadata,JSON.stringify(options),this.config.analysisTtlMinutes]);return{...metadata,analysisId:id,expiresAt:new Date(r.rows[0].expires_at).getTime()};});
  }
  async createJob(userId, analysisId, optionId, key) {
    const requestHash = digest(JSON.stringify({ analysisId, optionId }));
    return transaction(this.pool, async c => {
      const owner = await c.query('SELECT id FROM users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE', [userId]);
      if (!owner.rowCount) throw new ApiError(401,'Your account is unavailable.','AUTH_REQUIRED');
      const prior = await c.query('SELECT * FROM download_jobs WHERE user_id=$1 AND idempotency_key=$2',[userId,key]);
      if (prior.rowCount) { if (prior.rows[0].request_hash !== requestHash) throw new ApiError(409,'This request key was used for a different download.','IDEMPOTENCY_CONFLICT'); return { job:jobView(prior.rows[0]), replayed:true }; }
      await c.query('SELECT pg_advisory_xact_lock(81236015)');
      const control=(await c.query('SELECT downloads_paused FROM service_controls WHERE singleton=true')).rows[0];
      if(control.downloads_paused)throw new ApiError(503,'New downloads are temporarily paused.','DOWNLOADS_PAUSED');
      const queued=(await c.query("SELECT count(*)::int n FROM download_jobs WHERE status='queued'")).rows[0].n;
      if(queued>=this.config.maxQueuedJobs)throw new ApiError(429,'The queue is full. Try again later.','QUEUE_FULL');
      const a = (await c.query('SELECT * FROM analyses WHERE id=$1 AND user_id=$2 AND expires_at>now()', [analysisId,userId])).rows[0];
      if (!a) throw new ApiError(410,'Video details expired or are unavailable. Analyze the link again.','ANALYSIS_EXPIRED');
      const option = a.options.find(item=>item.id===optionId);
      if (!option) throw new ApiError(400,'Select an available quality for this video.','INVALID_FORMAT');
      if ((await c.query("SELECT 1 FROM download_jobs WHERE user_id=$1 AND status IN ('queued','downloading','processing') LIMIT 1",[userId])).rowCount) throw new ApiError(429,'You already have an active download.','ACTIVE_JOB_LIMIT');
      await c.query("INSERT INTO daily_usage(user_id,usage_day) VALUES($1,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING",[userId]);
      const usage = (await c.query("SELECT * FROM daily_usage WHERE user_id=$1 AND usage_day=(now() AT TIME ZONE 'UTC')::date FOR UPDATE",[userId])).rows[0];
      const reserve = this.config.maxBytes;
      if (usage.jobs_started>=this.config.dailyJobs || Number(usage.bytes_reserved)+Number(usage.bytes_completed)+reserve>this.config.dailyBytes) throw new ApiError(429,'Your daily download allowance has been reached.','DAILY_QUOTA_EXCEEDED');
      await c.query('INSERT INTO global_usage(usage_day) VALUES($1) ON CONFLICT DO NOTHING',[usage.usage_day]);
      const global=(await c.query('SELECT * FROM global_usage WHERE usage_day=$1 FOR UPDATE',[usage.usage_day])).rows[0];
      if(global.jobs_started>=this.config.globalDailyJobs||Number(global.bytes_reserved)+Number(global.bytes_completed)+reserve>this.config.globalDailyBytes)throw new ApiError(429,'The service daily allowance has been reached.','GLOBAL_QUOTA_EXCEEDED');
      await c.query('UPDATE global_usage SET jobs_started=jobs_started+1,bytes_reserved=bytes_reserved+$2 WHERE usage_day=$1',[usage.usage_day,reserve]);
      const id=opaqueId(), payload={url:a.canonical_url,videoId:a.video_id,title:a.metadata.title,author:a.metadata.author,option};
      const r=await c.query('INSERT INTO download_jobs(id,user_id,analysis_id,idempotency_key,request_hash,payload,total_bytes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id,userId,analysisId,key,requestHash,payload,option.size||null]);
      await c.query('UPDATE daily_usage SET jobs_started=jobs_started+1,bytes_reserved=bytes_reserved+$3 WHERE user_id=$1 AND usage_day=$2',[userId,usage.usage_day,reserve]);
      await c.query("INSERT INTO usage_reservations(job_id,user_id,usage_day,reserved_bytes,state) VALUES($1,$2,$3,$4,'active')",[id,userId,usage.usage_day,reserve]);
      await c.query("INSERT INTO outbox_events(id,job_id,event_type,payload) VALUES($1,$2,'download.requested',$3)",[randomUUID(),id,{jobId:id}]);
      await c.query('INSERT INTO audit_events(user_id,action,target_id) VALUES($1,$2,$3)',[userId,'job.created',id]);
      return {job:jobView(r.rows[0]),replayed:false};
    });
  }
  async getJob(userId,id) { const r=await this.pool.query('SELECT j.*,a.filename,a.sha256 FROM download_jobs j LEFT JOIN assets a ON a.job_id=j.id WHERE j.id=$1 AND j.user_id=$2',[id,userId]); if(!r.rowCount) throw new ApiError(404,'Download not found.','JOB_NOT_FOUND'); return jobView(r.rows[0]); }
  async history(userId,{limit=20,before=null}={}) {
    const values=[userId,limit+1];let filter='';
    if(before){values.push(before.createdAt,before.id);filter=' AND (j.created_at,j.id)<($3::timestamptz,$4::text)';}
    const r=await this.pool.query(`SELECT j.*,a.filename,a.sha256 FROM download_jobs j LEFT JOIN assets a ON a.job_id=j.id WHERE j.user_id=$1${filter} ORDER BY j.created_at DESC,j.id DESC LIMIT $2`,values);
    const more=r.rows.length>limit,rows=r.rows.slice(0,limit),last=rows.at(-1);
    return {items:rows.map(jobView),nextCursor:more?Buffer.from(JSON.stringify({createdAt:new Date(last.created_at).toISOString(),id:last.id})).toString('base64url'):null};
  }
  async usage(userId) { const r=await this.pool.query("SELECT jobs_started,bytes_reserved,bytes_completed FROM daily_usage WHERE user_id=$1 AND usage_day=(now() AT TIME ZONE 'UTC')::date",[userId]); const d=r.rows[0]||{};return{jobsStarted:Number(d.jobs_started)||0,bytesReserved:Number(d.bytes_reserved)||0,bytesCompleted:Number(d.bytes_completed)||0,dailyJobLimit:this.config.dailyJobs,dailyByteLimit:this.config.dailyBytes}; }
  async settleReservation(c,jobId,completedBytes=0) {
    const r=await c.query("UPDATE usage_reservations SET state=$2 WHERE job_id=$1 AND state='active' RETURNING *",[jobId,completedBytes?'settled':'released']);
    if(r.rowCount){const row=r.rows[0];await c.query('UPDATE global_usage SET bytes_reserved=GREATEST(0,bytes_reserved-$2),bytes_completed=bytes_completed+$3 WHERE usage_day=$1',[row.usage_day,row.reserved_bytes,completedBytes]);await c.query('UPDATE daily_usage SET bytes_reserved=bytes_reserved-$3,bytes_completed=bytes_completed+$4 WHERE user_id=$1 AND usage_day=$2',[row.user_id,row.usage_day,row.reserved_bytes,completedBytes]);}
  }
  async cancelJob(userId,id) {
    return transaction(this.pool,async c=>{
      const r=await c.query('SELECT * FROM download_jobs WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId]);
      if(!r.rowCount) throw new ApiError(404,'Download not found.','JOB_NOT_FOUND');const row=r.rows[0];
      if(terminal.has(row.status)) return jobView(row);
      const queued=row.status==='queued';
      const changed=await c.query(`UPDATE download_jobs SET cancel_requested=true${queued?",status='cancelled',phase='Cancelled',expires_at=now()+interval '30 minutes'":''} WHERE id=$1 RETURNING *`,[id]);
      if(queued) await this.settleReservation(c,id);
      await c.query('INSERT INTO audit_events(user_id,action,target_id) VALUES($1,$2,$3)',[userId,'job.cancel_requested',id]);
      return jobView(changed.rows[0]);
    });
  }
  async claimJob(workerId, jobId=null) {
    return transaction(this.pool,async c=>{
      await c.query('SELECT pg_advisory_xact_lock(81236012)');
      const active=await c.query("SELECT count(*)::int AS n FROM download_jobs WHERE status IN ('downloading','processing') AND lease_until>now()");
      if(active.rows[0].n>=this.config.maxConcurrent)return null;
      const next=await c.query("SELECT id FROM download_jobs WHERE status='queued' AND NOT cancel_requested AND ($1::text IS NULL OR id=$1) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",[jobId]);
      if(!next.rowCount)return null;
      const r=await c.query("UPDATE download_jobs SET status='downloading',phase='Fetching video',attempts=attempts+1,lease_owner=$2,lease_until=now()+interval '30 seconds' WHERE id=$1 RETURNING *",[next.rows[0].id,workerId]);
      await c.query('UPDATE outbox_events SET dispatched_at=now() WHERE job_id=$1',[next.rows[0].id]);return r.rows[0];
    });
  }
  async heartbeat(id,workerId) { const r=await this.pool.query("UPDATE download_jobs SET lease_until=now()+interval '30 seconds' WHERE id=$1 AND lease_owner=$2 AND lease_until>now() AND status IN ('downloading','processing') RETURNING cancel_requested",[id,workerId]);return r.rowCount?{owned:true,cancel:r.rows[0].cancel_requested}:{owned:false,cancel:true}; }
  async progress(id,workerId,p) { await this.pool.query("UPDATE download_jobs SET phase=$3,progress=$4,downloaded_bytes=$5,total_bytes=$6,speed=$7,eta=$8 WHERE id=$1 AND lease_owner=$2 AND lease_until>now() AND status IN ('downloading','processing')",[id,workerId,p.phase,p.progress,p.downloaded,p.total,p.speed,p.eta]); }
  async complete(id,workerId,asset) {
    return transaction(this.pool,async c=>{
      const r=await c.query("SELECT * FROM download_jobs WHERE id=$1 AND lease_owner=$2 AND lease_until>now() AND status IN ('downloading','processing') FOR UPDATE",[id,workerId]);
      if(!r.rowCount)return false;
      if(r.rows[0].cancel_requested)return false;
      if(asset.size>this.config.maxBytes)throw new Error('File exceeds size limit');
      const updated=await c.query("UPDATE download_jobs SET status='ready',phase='Ready to save',progress=100,downloaded_bytes=$2,total_bytes=$2,speed=NULL,eta=0,expires_at=now()+$3*interval '1 minute',lease_owner=NULL,lease_until=NULL WHERE id=$1 RETURNING expires_at",[id,asset.size,this.config.fileTtlMinutes]);
      await c.query('INSERT INTO assets(job_id,file_path,filename,extension,size_bytes,sha256,expires_at,storage_backend,object_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,asset.path||null,asset.filename,asset.ext,asset.size,asset.sha256,updated.rows[0].expires_at,asset.backend||'local',asset.objectKey||null]);
      await this.settleReservation(c,id,asset.size);return true;
    });
  }
  async fail(id,workerId,{code='DOWNLOAD_FAILED',message='Could not prepare this video.',cancelled=false}={}) {
    return transaction(this.pool,async c=>{
      const r=await c.query("UPDATE download_jobs SET status=$3,phase=$4,error_code=$5,error_message=$6,speed=NULL,eta=NULL,lease_owner=NULL,lease_until=NULL,expires_at=now()+$7*interval '1 minute' WHERE id=$1 AND lease_owner=$2 AND lease_until>now() AND status IN ('downloading','processing') RETURNING id",[id,workerId,cancelled?'cancelled':'failed',cancelled?'Cancelled':'Failed',code,message,this.config.fileTtlMinutes]);
      if(r.rowCount){await this.settleReservation(c,id);if(!cancelled)await this.failureEvent(c,id,code);}return !!r.rowCount;
    });
  }
  async abandon(id,workerId) { await this.pool.query("UPDATE download_jobs SET lease_until=now()-interval '1 second' WHERE id=$1 AND lease_owner=$2 AND status IN ('downloading','processing')",[id,workerId]); }
  async recoverExpiredLeases() {
    return transaction(this.pool,async c=>{
      const r=await c.query("SELECT * FROM download_jobs WHERE status IN ('downloading','processing') AND lease_until<=now() FOR UPDATE SKIP LOCKED");
      for(const row of r.rows){const stop=row.cancel_requested||row.attempts>=3,status=row.cancel_requested?'cancelled':stop?'failed':'queued';
        await c.query("UPDATE download_jobs SET status=$2,phase=$3,lease_owner=NULL,lease_until=NULL,progress=0,downloaded_bytes=0,speed=NULL,eta=NULL,error_code=$4,error_message=$5,expires_at=CASE WHEN $6 THEN now()+interval '30 minutes' ELSE NULL END WHERE id=$1",[row.id,status,stop?'Interrupted':'Queued for retry',stop?'WORKER_INTERRUPTED':null,stop?'The worker stopped before completing this download.':null,stop]);
        if(stop){await this.settleReservation(c,row.id);if(status==='failed')await this.failureEvent(c,row.id,'WORKER_INTERRUPTED');}else await c.query('UPDATE outbox_events SET dispatched_at=NULL WHERE job_id=$1',[row.id]);
      }return r.rowCount;
    });
  }
  async ticket(userId,id) {
    return transaction(this.pool,async c=>{
      const r=await c.query("SELECT j.status,a.expires_at,a.filename FROM download_jobs j JOIN assets a ON a.job_id=j.id WHERE j.id=$1 AND j.user_id=$2 AND j.status='ready' AND a.deleted_at IS NULL AND a.expires_at>now()",[id,userId]);
      if(!r.rowCount)throw new ApiError(410,'This file is not ready or has expired.','FILE_EXPIRED');
      const token=opaqueId();const inserted=await c.query("INSERT INTO download_tickets(token_hash,job_id,expires_at) VALUES($1,$2,LEAST(now()+interval '10 minutes',$3)) RETURNING expires_at",[digest(token),id,r.rows[0].expires_at]);
      return{path:`/api/files/${token}`,filename:r.rows[0].filename,expiresAt:new Date(inserted.rows[0].expires_at).getTime()};
    });
  }
  async assetForTicket(token) { const r=await this.pool.query("SELECT a.*,LEAST(t.expires_at,a.expires_at) AS ticket_expires_at FROM download_tickets t JOIN assets a ON a.job_id=t.job_id JOIN download_jobs j ON j.id=a.job_id WHERE t.token_hash=$1 AND t.expires_at>now() AND a.expires_at>now() AND a.deleted_at IS NULL AND j.status='ready'",[digest(token)]);if(!r.rowCount)throw new ApiError(410,'The file link expired. Prepare the download again.','FILE_EXPIRED');return r.rows[0]; }
  async expiredAssets() { return (await this.pool.query('SELECT * FROM assets WHERE expires_at<=now() AND deleted_at IS NULL AND (delete_retry_at IS NULL OR delete_retry_at<=now()) LIMIT 100')).rows; }
  async markAssetDeleted(id) { await transaction(this.pool,async c=>{await c.query('UPDATE assets SET deleted_at=now() WHERE job_id=$1',[id]);await c.query("UPDATE download_jobs SET status='expired',phase='Expired' WHERE id=$1 AND status='ready'",[id]);}); }
  async prune() { await this.pool.query('DELETE FROM user_sessions WHERE expires_at<=now()');await this.pool.query('DELETE FROM download_tickets WHERE expires_at<=now()');await this.pool.query('DELETE FROM rate_buckets WHERE window_start<floor(extract(epoch FROM now())/60)-10');await this.pool.query('DELETE FROM analyses a WHERE expires_at<=now() AND NOT EXISTS(SELECT 1 FROM download_jobs j WHERE j.analysis_id=a.id) AND NOT EXISTS(SELECT 1 FROM analysis_tasks t WHERE t.result_id=a.id)'); }
}
