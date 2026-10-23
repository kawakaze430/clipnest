import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SecretsManagerClient,GetSecretValueCommand,PutSecretValueCommand} from '@aws-sdk/client-secrets-manager';
import {migrate} from './migrate.mjs';
import {normalizeEmail,hashPassword,opaqueId,digest} from './security.mjs';
import {seal} from './sealed.mjs';
export async function bootstrapDatabase(env=process.env,{client=new SecretsManagerClient({region:env.AWS_REGION,maxAttempts:2})}={}){
 if(!env.MASTER_DATABASE_SECRET_ARN||!env.APPLICATION_DATABASE_SECRET_ARN||!env.DB_HOST||!env.DB_CA_FILE)throw new Error('Database bootstrap configuration is incomplete');
 const master=JSON.parse((await client.send(new GetSecretValueCommand({SecretId:env.MASTER_DATABASE_SECRET_ARN}))).SecretString);
 let application;try{application=JSON.parse((await client.send(new GetSecretValueCommand({SecretId:env.APPLICATION_DATABASE_SECRET_ARN}))).SecretString);}catch(e){if(!['ResourceNotFoundException','InvalidRequestException'].includes(e.name))throw e;}
 application={host:env.DB_HOST,port:Number(env.DB_PORT||5432),dbname:env.DB_NAME||'clipnest',username:'clipnest_app',password:application?.password||randomBytes(32).toString('hex')};
 if(!/^[a-z_][a-z0-9_]*$/.test(application.dbname))throw new Error('Invalid database name');
 const pool=new pg.Pool({host:application.host,port:application.port,database:application.dbname,user:master.username,password:master.password,ssl:{rejectUnauthorized:true,ca:await readFile(env.DB_CA_FILE,'utf8')},max:2,connectionTimeoutMillis:10000});
 try{const applied=await migrate(pool);const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('clipnest.bootstrap_password',$1,true)",[application.password]);await c.query("DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clipnest_app') THEN EXECUTE format('ALTER ROLE clipnest_app LOGIN NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',current_setting('clipnest.bootstrap_password')); ELSE EXECUTE format('CREATE ROLE clipnest_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L',current_setting('clipnest.bootstrap_password')); END IF; END $$");await c.query('GRANT CONNECT ON DATABASE "'+application.dbname+'" TO clipnest_app');await c.query('GRANT USAGE ON SCHEMA public TO clipnest_app');await c.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO clipnest_app');await c.query('REVOKE INSERT,UPDATE,DELETE ON schema_migrations FROM clipnest_app');await c.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO clipnest_app');await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  await client.send(new PutSecretValueCommand({SecretId:env.APPLICATION_DATABASE_SECRET_ARN,SecretString:JSON.stringify(application)}));
  if(env.BOOTSTRAP_OPERATOR_EMAIL){if(!env.SESSION_SECRET||!env.PUBLIC_ORIGIN?.startsWith('https://'))throw new Error('Operator bootstrap requires SESSION_SECRET and HTTPS PUBLIC_ORIGIN');const email=normalizeEmail(env.BOOTSTRAP_OPERATOR_EMAIL);let user=(await pool.query('SELECT id FROM users WHERE email=$1 AND disabled_at IS NULL',[email])).rows[0];if(!user){user={id:randomUUID()};await pool.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[user.id,email,await hashPassword(opaqueId())]);}await pool.query("INSERT INTO user_roles(user_id,role) VALUES($1,'operator') ON CONFLICT DO NOTHING",[user.id]);const {PgStore}=await import('./db/store.mjs');await new PgStore(pool,{sessionSecret:env.SESSION_SECRET,publicOrigin:env.PUBLIC_ORIGIN}).issueEmailAction(user.id,'reset');}
  return{applied,runtimeRole:'clipnest_app',secretStored:true,operatorBootstrapRequested:!!env.BOOTSTRAP_OPERATOR_EMAIL};
 }finally{await pool.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await bootstrapDatabase()));}catch(e){console.error(JSON.stringify({event:'bootstrap_failed',errorType:e.code||e.name||'Error'}));process.exitCode=1;}}
