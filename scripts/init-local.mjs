import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const contents = `# Local-only Compose settings. Keep this file private.
POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}
SESSION_SECRET=${randomBytes(48).toString('hex')}
`;
try { await writeFile(new URL('../.env',import.meta.url),contents,{flag:'wx',mode:0o600});console.log('Local .env created with random credentials. Run docker compose up --build -d.'); }
catch(error) { if(error.code==='EEXIST')console.log('Existing .env preserved.');else throw error; }
