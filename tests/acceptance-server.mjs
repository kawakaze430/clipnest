// CI browser fixture only: generated media, synthetic metadata, disposable SQL.
import {acceptanceApp} from './helpers/acceptance-app.mjs';
const service=await acceptanceApp({downloadDelayMs:3000,port:Number(process.env.PORT||4173),host:'0.0.0.0'});
console.log('Synthetic media acceptance server ready on port '+service.app.address().port);
let closing=false;async function stop(){if(closing)return;closing=true;await service.close();}process.once('SIGTERM',stop);process.once('SIGINT',stop);
