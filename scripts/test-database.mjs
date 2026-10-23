import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, chmod, chown, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executable=process.platform==='win32'?'.exe':'';
const arch=process.arch==='arm64'?'arm64':'x64';
const platform=process.platform==='darwin'?'darwin':process.platform==='win32'?'windows':'linux';
const native=path.join(root,'node_modules','@embedded-postgres',`${platform}-${arch}`,'native','bin');
const rootUser=typeof process.getuid==='function'&&process.getuid()===0;
const withCrash=process.argv.includes('--with-crash'),withTls=process.argv.includes('--with-tls');
const execAsUser=(name,args,options={})=>spawn(rootUser?'runuser':path.join(native,name+executable),rootUser?['-u','nobody','--',path.join(native,name+executable),...args]:args,options);
const run=(name,args)=>new Promise((resolve,reject)=>{let output='';const p=execAsUser(name,args,{stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>output+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(output):reject(new Error(`${name} failed: ${output.slice(-4000)}`)));});
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
let directory,server,url=process.env.TEST_DATABASE_URL,caFile=process.env.TEST_DB_CA_FILE;
try {
 if(!url){
  directory=await mkdtemp(path.join(tmpdir(),'clipnest-pg-'));await chmod(directory,0o700);
  const pass=randomBytes(24).toString('hex'),pw=path.join(directory,'password');await writeFile(pw,pass,{mode:0o600});
  if(rootUser){try{await chown(directory,65534,65534);await chown(pw,65534,65534);}catch(error){throw new Error('BLOCKED: native PostgreSQL needs a mapped non-root user. This container cannot chown to one. Run in a non-root environment, or provide TEST_DATABASE_URL from a disposable PostgreSQL instance. ('+error.code+')');}}
  const data=path.join(directory,'data');
  await run('initdb',['-D',data,'--username=clipnest','--auth-host=scram-sha-256','--auth-local=trust','--pwfile='+pw,'--locale=C','--encoding=UTF8','--no-instructions']);
  const port=await freePort();
  const serverArgs=['-D',data,'-h',withTls?'localhost':'127.0.0.1','-p',String(port),'-k',directory];
  if(withTls){
   caFile=path.join(directory,'server.crt');const key=path.join(directory,'server.key');
   execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',caFile,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
   await chmod(key,0o600);if(rootUser){await chown(key,65534,65534);await chown(caFile,65534,65534);}
   serverArgs.push('-c','ssl=on','-c','ssl_cert_file='+caFile,'-c','ssl_key_file='+key);
  }
  server=execAsUser('postgres',serverArgs,{stdio:['ignore','pipe','pipe']});
  let log='';server.stderr.on('data',d=>{log=(log+d).slice(-4000);});server.stdout.resume();
  url=`postgresql://clipnest:${pass}@${withTls?'localhost':'127.0.0.1'}:${port}/postgres`;
  let ready=false;
  for(let i=0;i<100;i++){const c=new pg.Client({connectionString:url,connectionTimeoutMillis:500});try{await c.connect();await c.query('SELECT 1');await c.end();ready=true;break;}catch{await c.end().catch(()=>{});await new Promise(r=>setTimeout(r,100));}}
  if(!ready)throw new Error('PostgreSQL did not start: '+log);
 }
 const c=new pg.Client({connectionString:url});await c.connect();const v=await c.query('SHOW server_version');await c.end();
 console.log(`Real PostgreSQL ${v.rows[0].server_version} is ready (loopback/disposable test target).`);
 if(!process.argv.includes('--probe')){
  if(withTls&&!caFile)throw new Error('--with-tls needs TEST_DB_CA_FILE for an explicitly supplied disposable database');
  const files=['tests/database.test.mjs','tests/release.test.mjs','tests/operations.test.mjs'];
  if(withCrash)files.push('tests/crash.native.mjs');if(withTls)files.push('tests/tls.native.mjs');
  const child=spawn(process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...files],{cwd:root,stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:url,...(withTls?{TEST_DB_CA_FILE:caFile}:{}),NODE_ENV:'test'}});
  process.exitCode=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code??1));});
 }
} catch(error){console.error(error.message);process.exitCode=1;}
finally {
 if(server&&directory){await run('pg_ctl',['-D',path.join(directory,'data'),'-m','fast','-w','stop']).catch(()=>server.kill('SIGTERM'));}
 if(directory)await rm(directory,{recursive:true,force:true});
}
