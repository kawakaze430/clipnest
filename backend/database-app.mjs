import http from 'node:http';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {ApiError,normalizeYouTubeUrl,YtDlpEngine,safeExtractorError} from './core.mjs';
import {loadConfig} from './config.mjs';
import {createPool,PgStore} from './db/store.mjs';
import {normalizeEmail,validatePassword,hashPassword,verifyPassword,opaqueId,digest,csrfFor,constantEqual,parseCookies,sessionCookie,requireRequestOrigin} from './security.mjs';
import {json,readJson,serveStatic,streamAsset} from './http.mjs';
import {WorkerRunner} from './worker.mjs';
import {createStorage} from './storage.mjs';
import {analyzeVideo} from './analysis.mjs';
import {Metrics} from './metrics.mjs';
const publicDir=fileURLToPath(new URL('../dist/',import.meta.url));
export async function createDatabaseApp({config=loadConfig(),store,engine,logger=console.log,storage,queue,mailer}={}){
 const ownedPool=store?null:await createPool(config);store||=new PgStore(ownedPool,config);
 engine||=new YtDlpEngine({maxBytes:config.maxBytes,systemCa:config.systemCa});storage||=createStorage(config);
 await mkdir(config.dataDir,{recursive:true,mode:0o700});
 const metrics=new Metrics({environment:config.environment,role:'api',logger}),worker=new WorkerRunner({store,config,engine,storage,queue,mailer,metrics});
 let engineStatus,healthAt=0,analyzing=0,hashing=0,stopping=false;
 const dummyHash=await hashPassword(opaqueId());
 const health=async()=>{if(!engineStatus||Date.now()-healthAt>30000){engineStatus=await engine.health();healthAt=Date.now();}const database=await store.health().catch(()=>false);const workers=!config.production||!!(await store.pool.query("SELECT 1 FROM worker_heartbeats WHERE seen_at>now()-interval '45 seconds' LIMIT 1").catch(()=>({rowCount:0}))).rowCount;return{database,workers,engine:!!engineStatus.ready,ffmpeg:!!engineStatus.ffmpeg,ready:database&&workers&&!!engineStatus.ready&&!!engineStatus.ffmpeg,release:{version:'1.2.0',source:process.env.SOURCE_COMMIT||'development'}};};
 const address=req=>{const forwarded=String(req.headers['x-forwarded-for']||'').split(',').map(v=>v.trim()).filter(v=>isIP(v));const chain=[...forwarded,req.socket.remoteAddress||'unknown'];return config.trustedProxyHops?chain[Math.max(0,chain.length-1-config.trustedProxyHops)]:chain.at(-1);};
 const performHash=async work=>{if(hashing>=2)throw new ApiError(429,'Sign-in is busy. Please try again shortly.','AUTH_BUSY');hashing++;try{return await work();}finally{hashing--;}};
 const publicUser=u=>({id:u.id,email:u.email,verified:!!u.verified_at,operator:!!u.is_operator});
 const verifyAccount=user=>{if(config.requireEmailVerification&&!user.verified_at)throw new ApiError(403,'Verify your email before preparing downloads.','EMAIL_UNVERIFIED');};
 const server=http.createServer(async(req,res)=>{
  const requestId=randomUUID(),started=Date.now();let route='/';
  res.setHeader('X-Request-ID',requestId);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(config.secureCookies)res.setHeader('Strict-Transport-Security','max-age=31536000');
  res.on('finish',()=>{const durationMs=Date.now()-started;logger(JSON.stringify({event:'request',requestId,method:req.method,route,status:res.statusCode,durationMs}));metrics.emit('Requests');metrics.emit('RequestLatency',durationMs,'Milliseconds');if(res.statusCode>=500)metrics.emit('RequestErrors');});
  try{
   const url=new URL(req.url,'http://localhost');route=url.pathname.startsWith('/api/files/')?'/api/files/:ticket':url.pathname;
   if(stopping)throw new ApiError(503,'The server is restarting. Please retry shortly.','SERVER_STOPPING');
   if(url.pathname==='/healthz'&&req.method==='GET')return json(res,200,{live:true});
   if(url.pathname==='/readyz'&&req.method==='GET'){const state=await health();return json(res,state.ready?200:503,state);}
   if(!url.pathname.startsWith('/api/'))return await serveStatic(req,res,url,path.resolve(publicDir));
   if(req.method==='OPTIONS')throw new ApiError(403,'Use the same website origin for account sessions.','ORIGIN_REJECTED');
   if(url.pathname==='/api/config'&&req.method==='GET'){const controls=await store.controls();const mode=controls.registration_mode==='config'?(config.allowRegistration?'open':'invite'):controls.registration_mode;return json(res,200,{service:'clipnest',protocol:1,authMode:'session',asyncAnalysis:true,allowRegistration:mode==='open',registrationMode:mode,requireEmailVerification:config.requireEmailVerification,maxBytes:config.maxBytes,maxDuration:config.maxDuration,dailyJobLimit:config.dailyJobs,downloadsPaused:controls.downloads_paused,jobRetentionDays:config.jobRetentionDays,auditRetentionDays:config.auditRetentionDays,fileTtlMinutes:config.fileTtlMinutes});}
   if(url.pathname==='/api/health'&&req.method==='GET'){const state=await health();return json(res,state.ready?200:503,{service:'clipnest',protocol:1,authMode:'session',...state,maxBytes:config.maxBytes,maxConcurrent:config.maxConcurrent});}
   const file=/^\/api\/files\/([\w-]{32})$/.exec(url.pathname);
   if(file&&['GET','HEAD'].includes(req.method)){const asset=await store.assetForTicket(file[1]);if(asset.storage_backend==='s3'){const target=storage.url(asset,new Date(asset.ticket_expires_at||asset.expires_at).getTime());res.writeHead(307,{Location:target,'Cache-Control':'private,no-store'});return res.end();}return await streamAsset(req,res,asset,config.dataDir);}
   const token=parseCookies(req.headers.cookie)[config.cookieName];const validToken=typeof token==='string'&&/^[\w-]{32}$/.test(token);const user=validToken?await store.resolveSession(digest(token)):null;
   if(url.pathname==='/api/auth/session'&&req.method==='GET'){const control=await store.controls(),mode=control.registration_mode==='config'?(config.allowRegistration?'open':'invite'):control.registration_mode;return json(res,200,{user:user?publicUser(user):null,csrfToken:user?csrfFor(token,config.sessionSecret):null,authMode:'session',allowRegistration:mode==='open'});}
   if(['/api/auth/register','/api/auth/login','/api/auth/forgot','/api/auth/reset','/api/auth/verify'].includes(url.pathname)&&req.method==='POST'){
    requireRequestOrigin(req,config);await store.hitRate(`auth:${address(req)}`,config.authAttemptsPerMinute);const input=await readJson(req);
    if(url.pathname.endsWith('/verify'))return json(res,200,await store.consumeEmailAction(input.token,'verify'));
    if(url.pathname.endsWith('/reset')){validatePassword(input.password);const result=await store.consumeEmailAction(input.token,'reset',await performHash(()=>hashPassword(input.password)));res.setHeader('Set-Cookie',sessionCookie(config,'',true));return json(res,200,result);}
    const email=normalizeEmail(input.email);
    if(url.pathname.endsWith('/forgot')){await store.hitRate(`reset:${email}`,2);const account=await store.userForLogin(email);if(account&&!account.disabled_at)await store.issueEmailAction(account.id,'reset');return json(res,202,{message:'If this account can receive email, a recovery link will be sent.'});}
    let account;
    if(url.pathname.endsWith('/register')){validatePassword(input.password);account=await store.createUser(email,await performHash(()=>hashPassword(input.password)),{enforceRegistration:true,invitationToken:input.invitationToken});if(config.requireEmailVerification)await store.issueEmailAction(account.id,'verify');}
    else{const candidate=await store.userForLogin(email);const verified=await performHash(()=>verifyPassword(input.password,candidate?.password_hash||dummyHash));if(!candidate||!verified||candidate.disabled_at)throw new ApiError(401,'Email or password is incorrect.','INVALID_CREDENTIALS');account=candidate;}
    const session=opaqueId();await store.createSession(account.id,digest(session));res.setHeader('Set-Cookie',sessionCookie(config,session));account=await store.resolveSession(digest(session));return json(res,url.pathname.endsWith('/register')?201:200,{user:publicUser(account),csrfToken:csrfFor(session,config.sessionSecret),authMode:'session'});
   }
   if(!user)throw new ApiError(401,'Sign in to use your download server.','AUTH_REQUIRED');
   if(!['GET','HEAD'].includes(req.method)){requireRequestOrigin(req,config);if(!constantEqual(req.headers['x-csrf-token'],csrfFor(token,config.sessionSecret)))throw new ApiError(403,'Your session security token expired. Refresh the page.','CSRF_REJECTED');await store.hitRate(`api:${user.id}`,config.apiRequestsPerMinute);}
   if(url.pathname==='/api/auth/logout'&&req.method==='POST'){await store.revokeSession(digest(token),user.id);res.setHeader('Set-Cookie',sessionCookie(config,'',true));return json(res,200,{signedOut:true});}
   if(url.pathname==='/api/auth/resend'&&req.method==='POST'){await store.hitRate(`verify:${user.id}`,1);return json(res,202,await store.issueEmailAction(user.id,'verify'));}
   if(url.pathname==='/api/account/export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="clipnest-account.json"');return json(res,200,await store.exportAccount(user.id));}
   if(url.pathname==='/api/account'&&req.method==='DELETE'){const input=await readJson(req),account=await store.userForLogin(user.email);if(!account||!await performHash(()=>verifyPassword(input.password,account.password_hash)))throw new ApiError(401,'Password is incorrect.','REAUTH_REQUIRED');const receipt=await store.deleteAccount(user.id);res.setHeader('Set-Cookie',sessionCookie(config,'',true));return json(res,200,receipt);}
   if(url.pathname.startsWith('/api/admin/')){
    if(!user.is_operator)throw new ApiError(403,'Operator access required.','FORBIDDEN');
    if(url.pathname==='/api/admin/state'&&req.method==='GET')return json(res,200,{controls:await store.controls(),operations:await store.operationalSnapshot(),metrics:metrics.snapshot()});
    if(url.pathname==='/api/admin/controls'&&req.method==='POST'){const input=await readJson(req);if(input.downloadsPaused!==undefined&&typeof input.downloadsPaused!=='boolean')throw new ApiError(400,'downloadsPaused must be a boolean.','INVALID_INPUT');if(input.registrationMode!==undefined&&!['config','open','invite','closed'].includes(input.registrationMode))throw new ApiError(400,'Invalid registration mode.','INVALID_INPUT');return json(res,200,await store.setControls(user.id,input));}
    if(url.pathname==='/api/admin/invitations'&&req.method==='POST'){const input=await readJson(req);return json(res,202,await store.invite(normalizeEmail(input.email),user.id));}
    if(url.pathname==='/api/admin/disable'&&req.method==='POST'){const input=await readJson(req);if(!/^[a-f0-9-]{36}$/.test(input.userId||''))throw new ApiError(400,'Invalid account ID.','INVALID_INPUT');return json(res,200,await store.disableAccount(user.id,input.userId));}
   }
   if(url.pathname==='/api/usage'&&req.method==='GET')return json(res,200,await store.usage(user.id));
   if(url.pathname==='/api/analyses'&&req.method==='POST'){verifyAccount(user);const input=await readJson(req);return json(res,202,await store.createAnalysisTask(user.id,normalizeYouTubeUrl(input.url)));}
   const analysisMatch=/^\/api\/analyses\/([\w-]{32})$/.exec(url.pathname);
   if(analysisMatch){if(req.method==='GET')return json(res,200,await store.analysisTask(user.id,analysisMatch[1]));if(req.method==='DELETE')return json(res,200,await store.cancelAnalysis(user.id,analysisMatch[1]));}
   if(url.pathname==='/api/analyze'&&req.method==='POST'){
    verifyAccount(user);const input=await readJson(req),canonical=normalizeYouTubeUrl(input.url);if(analyzing>=config.maxAnalysisConcurrent)throw new ApiError(429,'The server is checking other videos.','ANALYSIS_BUSY');const state=await health();if(!state.ready)throw new ApiError(503,'The download engine or database is unavailable.','DEPENDENCY_UNAVAILABLE');analyzing++;const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),90000);deadline.unref();res.on('close',()=>{if(!res.writableEnded)controller.abort();});try{const result=await analyzeVideo(engine,canonical,config,controller.signal);metrics.emit('AnalysisSuccess');return json(res,200,await store.saveAnalysis(user.id,canonical,result.metadata,result.options));}catch(e){metrics.emit('AnalysisFailure');if(e instanceof ApiError)throw e;throw new ApiError(502,safeExtractorError(e.message),'SOURCE_UNAVAILABLE');}finally{analyzing--;clearTimeout(deadline);}
   }
   if(url.pathname==='/api/jobs'&&req.method==='POST'){
    verifyAccount(user);const input=await readJson(req),key=String(req.headers['idempotency-key']||'');if(!/^[\w-]{8,100}$/.test(key))throw new ApiError(400,'Supply a valid Idempotency-Key.','IDEMPOTENCY_KEY_REQUIRED');if(!/^[\w-]{32}$/.test(input.analysisId||'')||typeof input.optionId!=='string'||input.optionId.length>100)throw new ApiError(400,'Choose a valid analyzed video and quality.','INVALID_JOB');const result=await store.createJob(user.id,input.analysisId,input.optionId,key);res.setHeader('Idempotency-Replayed',String(result.replayed));return json(res,result.replayed?200:202,result.job);
   }
   if(url.pathname==='/api/jobs'&&req.method==='GET'){const raw=url.searchParams.get('limit')||'20';if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>50)throw new ApiError(400,'History limit must be between 1 and 50.','INVALID_LIMIT');let before;const cursor=url.searchParams.get('cursor');if(cursor){try{if(cursor.length>256)throw new Error();before=JSON.parse(Buffer.from(cursor,'base64url'));if(!/^[\w-]{32}$/.test(before.id||'')||!Number.isFinite(Date.parse(before.createdAt)))throw new Error();}catch{throw new ApiError(400,'Invalid history cursor.','INVALID_CURSOR');}}return json(res,200,await store.history(user.id,{limit:Number(raw),before}));}
   const match=/^\/api\/jobs\/([\w-]{32})(\/ticket)?$/.exec(url.pathname);
   if(match){if(req.method==='GET'&&!match[2])return json(res,200,await store.getJob(user.id,match[1]));if(req.method==='DELETE'&&!match[2])return json(res,200,await store.cancelJob(user.id,match[1]));if(req.method==='POST'&&match[2])return json(res,200,await store.ticket(user.id,match[1]));}
   throw new ApiError(404,'Endpoint not found.','NOT_FOUND');
  }catch(e){if(res.headersSent){res.destroy();return;}if(!(e instanceof ApiError))logger(JSON.stringify({event:'request_error',requestId,errorType:e.code||e.name||'Error'}));json(res,e instanceof ApiError?e.status:500,{error:e instanceof ApiError?e.message:'The server could not complete this request.',code:e instanceof ApiError?(e.code||'REQUEST_REJECTED'):'INTERNAL_ERROR',requestId});}
 });
 server.requestTimeout=120000;if(config.inlineWorker)worker.start();
 const cleanup=config.inlineWorker?setInterval(()=>worker.cleanup().catch(()=>metrics.emit('CleanupFailure')),60000):null;cleanup?.unref();
 server.store=store;server.worker=worker;server.metrics=metrics;
 server.shutdown=async()=>{stopping=true;clearInterval(cleanup);await worker.stop();if(server.listening)await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections?.();});metrics.close();if(ownedPool)await ownedPool.end();};
 server.on('close',()=>{clearInterval(cleanup);worker.stop().catch(()=>{});});return server;
}
