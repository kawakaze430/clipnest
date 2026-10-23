import {readFile} from 'node:fs/promises';
import path from 'node:path';
try{const state=JSON.parse(await readFile(path.join(process.env.DATA_DIR||'.cache','worker-health.json'),'utf8'));if(!Number.isFinite(state.lastDatabaseSuccess)||Date.now()-state.lastDatabaseSuccess>45000)process.exit(1);}catch{process.exit(1);}
