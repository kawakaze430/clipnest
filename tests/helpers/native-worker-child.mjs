// Native process-kill fixture; requires an explicit disposable test schema.
import pg from 'pg';
import {once} from 'node:events';
import {copyFile} from 'node:fs/promises';
import path from 'node:path';
import {loadConfig} from '../../backend/config.mjs';
import {PgStore} from '../../backend/db/store.mjs';
import {WorkerRunner} from '../../backend/worker.mjs';
if(!/^clipnest_test_[a-f0-9]{16}$/.test(process.env.DRILL_SCHEMA||''))throw new Error('Disposable native test schema required');const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:'-c search_path='+process.env.DRILL_SCHEMA+',public',max:3}),config=loadConfig({DATA_DIR:process.env.DRILL_DATA,SESSION_SECRET:'native-process-fixture-only-secret'}),store=new PgStore(pool,config);
const engine={download:async({signal,directory,onFile})=>{process.send({event:'active'});if(process.env.DRILL_FINISH==='true'){const target=path.join(directory,'media.mp4');await copyFile(process.env.DRILL_MEDIA,target);onFile(target);return;}await new Promise((resolve,reject)=>{if(signal.aborted)return reject(new Error('aborted'));signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});}};
const worker=new WorkerRunner({store,config,engine});await worker.tick();if(process.env.DRILL_FINISH==='true'){await Promise.all([...worker.active.values()].map(v=>v.task));await worker.stop();await pool.end();process.send({event:'complete'});process.disconnect();}else setInterval(()=>{},1000);
