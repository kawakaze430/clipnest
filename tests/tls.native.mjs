import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createPool} from '../backend/db/store.mjs';
if(!process.env.TEST_DATABASE_URL||!process.env.TEST_DB_CA_FILE)throw new Error('Explicit disposable native TLS database and CA are required');
test('native PostgreSQL TLS verifies trusted certificate, rejects wrong hostname and untrusted CA',async()=>{
 const config={databaseUrl:process.env.TEST_DATABASE_URL,dbTls:'verify-full',dbCaFile:process.env.TEST_DB_CA_FILE,dbPoolMax:3};const pool=await createPool(config);try{assert.equal((await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true);const c=await pool.connect();try{await c.query('BEGIN');await c.query('CREATE TEMP TABLE tls_probe(value int)');await c.query('INSERT INTO tls_probe VALUES(1)');await c.query('ROLLBACK');}finally{c.release();}}finally{await pool.end();}
 const url=new URL(config.databaseUrl);url.hostname='127.0.0.1';const hostname=new pg.Client({connectionString:url.href,ssl:{rejectUnauthorized:true,ca:await readFile(config.dbCaFile,'utf8')},connectionTimeoutMillis:5000});try{await assert.rejects(()=>hostname.connect(),e=>/altname|certificate|IP address/i.test(e.message));}finally{await hostname.end();}
 const untrusted=new pg.Client({connectionString:config.databaseUrl,ssl:{rejectUnauthorized:true,ca:'invalid-test-CA'},connectionTimeoutMillis:5000});try{await assert.rejects(()=>untrusted.connect());}finally{await untrusted.end();}
});
