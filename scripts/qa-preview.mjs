// Development-only browser QA: real PostgreSQL SQL through PGlite, one backend.
// Never imported by the production server. No source formats are fabricated.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { testDatabase } from '../tests/helpers/database.mjs';
import { migrate } from '../backend/migrate.mjs';
import { PgStore } from '../backend/db/store.mjs';
import { loadConfig } from '../backend/config.mjs';
import { createDatabaseApp } from '../backend/database-app.mjs';
if(process.env.NODE_ENV==='production')throw new Error('QA preview is development-only');
if(process.env.TEST_DATABASE_URL)throw new Error('QA preview uses a disposable PGlite database; unset TEST_DATABASE_URL');
const directory=await mkdtemp(path.join(tmpdir(),'clipnest-qa-'));
const db=await testDatabase();await migrate(db.pool);
const config=loadConfig({...process.env,NODE_ENV:'development',DATABASE_URL:'',HOST:'0.0.0.0',PORT:process.env.PORT||'4173',PUBLIC_ORIGIN:'http://terminal.local:4173',COOKIE_SECURE:'false',ALLOW_REGISTRATION:'true',INLINE_WORKER:'true',DATA_DIR:directory});
const app=await createDatabaseApp({config,store:new PgStore(db.pool,config)});
app.listen(config.port,config.host,()=>console.log('Disposable SQL account QA preview ready. Live source tests remain separate.'));
const stop=async()=>{await app.shutdown();await db.close();await rm(directory,{recursive:true,force:true});process.exit();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
