// Explicitly synthetic worker fixture, mounted only into disposable fault-drill containers.
import pg from 'pg';
import {readFile,writeFile,copyFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {loadConfig} from '../../backend/config.mjs';
import {PgStore} from '../../backend/db/store.mjs';
import {WorkerRunner} from '../../backend/worker.mjs';

if(!/^clipnest_resource_[a-f0-9]{16}$/.test(process.env.DRILL_SCHEMA||''))throw new Error('Disposable resource-drill schema required');
const mode=process.env.DRILL_MODE;if(!['sigterm','sigkill','oom','disk','deadline','complete'].includes(mode))throw new Error('Unknown resource drill mode');
if(process.getuid()===0)throw new Error('Resource-drill worker must run as non-root');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path='+process.env.DRILL_SCHEMA+',public',max:3});
const config=loadConfig({...process.env,NODE_ENV:'test',DB_TLS:'disable',COOKIE_SECURE:'false',MAIL_MODE:'file',STORAGE_BACKEND:'local',DATA_DIR:'/drill-data',SESSION_SECRET:'disposable-container-drill-session-secret',MAX_FILE_BYTES:'1048576',MAX_CONCURRENT_JOBS:'1',JOB_TIMEOUT_SECONDS:mode==='deadline'?'5':'60'});
const store=new PgStore(pool,config);let terminating=false,activeDirectory='',trigger,monitor;const allocations=[];
const output=value=>console.log(JSON.stringify(value));
async function files(directory){const result=[];for(const name of await readdir(directory).catch(()=>[])){const filename=path.join(directory,name),details=await stat(filename);if(details.isDirectory())result.push(...await files(filename));else result.push({path:filename.replace('/drill-data/',''),bytes:details.size});}return result;}
async function measurements(){const optional=async name=>{try{return Number((await readFile('/sys/fs/cgroup/'+name,'utf8')).trim());}catch{return null;}};const scratch=await files('/drill-data');return{rssBytes:process.memoryUsage().rss,cgroupCurrentBytes:await optional('memory.current'),cgroupPeakBytes:await optional('memory.peak'),scratchBytes:scratch.reduce((n,f)=>n+f.bytes,0),uid:process.getuid()};}
const engine={download:async({signal,directory,onFile})=>{
 activeDirectory=directory;
 if(mode==='complete'){const target=path.join(directory,'media.mp4');await copyFile('/drill-fixture/media.mp4',target);onFile(target);return;}
 await writeFile(path.join(directory,'fragment.part'),Buffer.alloc(256*1024,0x42));output({event:'active',mode,...await measurements()});
 const action=new Promise(resolve=>{trigger=resolve;});
 const interrupted=new Promise((resolve,reject)=>{const abort=()=>reject(new Error('Synthetic work interrupted'));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
 if(mode==='oom'||mode==='disk'){
  await Promise.race([action,interrupted]);
  if(mode==='disk'){try{await writeFile(path.join(directory,'disk-pressure.part'),Buffer.alloc(16*1024*1024,0x44));throw new Error('Expected bounded tmpfs to reject oversized scratch');}catch(error){output({event:'disk_error',code:error.code||null,...await measurements()});throw error;}}
  for(let i=0;i<40;i++){allocations.push(Buffer.alloc(16*1024*1024,0x55));output({event:'oom_pressure',allocatedBytes:allocations.length*16*1024*1024,...await measurements()});await new Promise(resolve=>setTimeout(resolve,25));}
  throw new Error('Container did not enforce its memory limit');
 }
 await interrupted;
}};
const worker=new WorkerRunner({store,config,engine});
process.once('SIGUSR1',()=>trigger?.());
process.once('SIGTERM',async()=>{terminating=true;await worker.stop();clearInterval(monitor);await pool.end();output({event:'stopped',...await measurements()});});
try{await worker.tick();monitor=setInterval(()=>{},1000);await Promise.all([...worker.active.values()].map(value=>value.task));if(!terminating){await worker.stop();clearInterval(monitor);await pool.end();output({event:'finished',mode,...await measurements(),remainingFiles:await files('/drill-data')});}}
catch(error){clearInterval(monitor);await pool.end().catch(()=>{});output({event:'fixture_failure',message:String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi,'[REDACTED_DATABASE_URL]')});process.exitCode=1;}
