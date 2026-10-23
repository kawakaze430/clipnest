import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp as createLegacyApp } from './legacy-server.mjs';
import {loadRuntimeConfig} from './runtime-config.mjs';
export async function createApp(options={}){
  if(options.store||options.config?.databaseUrl||(!options.engine&&process.env.DATABASE_URL)){
    const {createDatabaseApp}=await import('./database-app.mjs');return createDatabaseApp(options);
  }
  return createLegacyApp(options);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const config=await loadRuntimeConfig();
 const app=config.databaseUrl?await createApp({config}):await createLegacyApp({dataDir:config.dataDir,maxBytes:config.maxBytes,maxConcurrent:config.maxConcurrent});
 app.listen(config.port,config.host,()=>console.log(JSON.stringify({event:'server_ready',mode:config.databaseUrl?'database':'local-prototype',port:config.port})));
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;const deadline=setTimeout(()=>process.exit(1),15000);deadline.unref();try{if(app.shutdown)await app.shutdown();else await new Promise(resolve=>app.close(resolve));clearTimeout(deadline);}catch{process.exitCode=1;}};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
}
