import { readdir,readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
let checked=0;
for(const directory of ['backend','tests','scripts','dist']) {
  for(const item of await readdir(path.join(root,directory),{recursive:true,withFileTypes:true})) {
    if(!item.isFile()||! /\.(mjs|js)$/.test(item.name))continue;
    const file=path.join(item.parentPath,item.name);
    const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
    if(result.status!==0)process.exit(result.status||1);checked++;
  }
}
const pkg=JSON.parse(await readFile(path.join(root,'package.json'))),lock=JSON.parse(await readFile(path.join(root,'package-lock.json')));
const canonical = value => JSON.stringify(Object.entries(value||{}).sort(([a],[b])=>a.localeCompare(b)));
for(const group of ['dependencies','devDependencies'])if(canonical(pkg[group])!==canonical(lock.packages[''][group]))throw new Error('Dependency lock is out of sync: '+group);
const html=await readFile(path.join(root,'dist/index.html'),'utf8');
for(const file of ['app.js','styles.css','favicon.svg'])if(!html.includes('/'+file))throw new Error('Missing frontend asset: '+file);
console.log(`Syntax checked ${checked} JavaScript files; dependency lock and frontend entry assets agree.`);
