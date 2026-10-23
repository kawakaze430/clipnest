// Explicitly synthetic media for acceptance/UI tests. Never imported by production.
import {mkdtemp,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {testDatabase} from './database.mjs';
import {migrate} from '../../backend/migrate.mjs';
import {PgStore} from '../../backend/db/store.mjs';
import {loadConfig} from '../../backend/config.mjs';
import {createDatabaseApp} from '../../backend/database-app.mjs';
import {fixture} from '../fixtures.mjs';
export async function acceptanceApp({downloadDelayMs=350,port=0,host='127.0.0.1',overrides={}}={}){
 if(process.env.NODE_ENV==='production')throw new Error('Synthetic acceptance server is not a production entry point');
 const directory=await mkdtemp(path.join(tmpdir(),'clipnest-acceptance-')),db=await testDatabase();
 try{
  await migrate(db.pool);const media=path.join(directory,'fixture.mp4');
  await promisify(execFile)('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=160x90:r=10','-f','lavfi','-i','sine=frequency=440','-t','0.4','-c:v','mpeg4','-c:a','aac','-shortest',media]);
  const config=loadConfig({DATA_DIR:directory,SESSION_SECRET:'acceptance-only-disposable-session-secret',INLINE_WORKER:'true',ALLOW_REGISTRATION:'true',REQUIRE_EMAIL_VERIFICATION:'false',AUTH_ATTEMPTS_PER_MINUTE:'100',API_REQUESTS_PER_MINUTE:'1000',MAX_QUEUED_JOBS:'30',...overrides});
  const store=new PgStore(db.pool,config),deliveries=[];
  const engine={health:async()=>({ready:true,ffmpeg:true}),analyze:async()=>({...fixture,title:'Synthetic acceptance video'}),download:async({directory,signal,onFile,onProgress})=>{await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,downloadDelayMs);const abort=()=>{clearTimeout(timer);reject(new Error('Cancelled fixture'));};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});if(signal.aborted)throw new Error('Cancelled fixture');const target=path.join(directory,'media.mp4');await copyFile(media,target);onFile(target);onProgress({downloaded_bytes:1024,total_bytes:1024,status:'finished'});}};
  const app=await createDatabaseApp({config,store,engine,mailer:{send:async(id,payload)=>deliveries.push({...payload,id})},logger:()=>{}});
  app.listen(port,host);await once(app,'listening');const origin='http://127.0.0.1:'+app.address().port;config.publicOrigin=origin;
  return{app,store,db,config,origin,directory,deliveries,close:async()=>{await app.shutdown();await db.close();await rm(directory,{recursive:true,force:true});}};
 }catch(error){await db.close();await rm(directory,{recursive:true,force:true});throw error;}
}
