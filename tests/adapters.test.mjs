import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {S3Storage} from '../backend/storage.mjs';
import {SqsQueue} from '../backend/queue.mjs';
import {loadConfig} from '../backend/config.mjs';
import {loadRuntimeConfig} from '../backend/runtime-config.mjs';
import {seal,unseal} from '../backend/sealed.mjs';

test('CloudFront signer uses the exact ticket/asset deadline and a real verifiable RSA signature',()=>{
 const pair=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const config={...loadConfig(),mediaBaseUrl:'https://d123.cloudfront.net',cloudfrontKeyPairId:'K123',cloudfrontPrivateKey:pair.privateKey};
 const store=new S3Storage(config,{client:{}}),key='media/'+'a'.repeat(32)+'/12345678-1234-1234-1234-123456789012.mp4',expires=Date.now()+20000;
 const signed=new URL(store.url({object_key:key},expires));assert.equal(signed.pathname,'/'+key);assert.ok(Number(signed.searchParams.get('Expires'))*1000<=expires);assert.equal(signed.searchParams.get('Key-Pair-Id'),'K123');
 const policy=JSON.stringify({Statement:[{Resource:'https://d123.cloudfront.net/'+key,Condition:{DateLessThan:{'AWS:EpochTime':Number(signed.searchParams.get('Expires'))}}}]});
 const signature=signed.searchParams.get('Signature').replace(/-/g,'+').replace(/_/g,'=').replace(/~/g,'/');const verify=createVerify('RSA-SHA1');verify.update(policy);assert.equal(verify.verify(pair.publicKey,Buffer.from(signature,'base64')),true);
 assert.throws(()=>store.url({object_key:'../private'},expires));assert.throws(()=>store.url({object_key:key},Date.now()-1));
});
test('S3 upload contract checks head metadata, aborts failed multipart uploads and removes stale uploads',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'clipnest-object-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'fixture.mp4');await writeFile(file,'test fixture bytes');const config={...loadConfig(),s3Bucket:'test-bucket'};
 let params,aborted=false;const commands=[];const client={send:async cmd=>{commands.push(cmd);if(cmd.constructor.name==='HeadObjectCommand')return{ContentLength:18,Metadata:{sha256:'a'.repeat(64)}};return{};}};
 const storage=new S3Storage(config,{client,uploadFactory:options=>{params=options;return{done:async()=>{},abort:async()=>{aborted=true;}};}});
 const artifact=await storage.put({jobId:'a'.repeat(32),filename:file,ext:'mp4',sha256:'a'.repeat(64)});assert.equal(artifact.backend,'s3');assert.equal(params.leavePartsOnError,false);assert.ok(params.partSize>=5*1024*1024);params.params.Body.destroy();
 const failed=new S3Storage(config,{client,uploadFactory:options=>{options.params.Body.destroy();return{done:async()=>{throw new Error('part failure');},abort:async()=>{aborted=true;}};}});
 await assert.rejects(()=>failed.put({jobId:'a'.repeat(32),filename:file,ext:'mp4',sha256:'a'.repeat(64)}));assert.equal(aborted,true);assert.ok(commands.some(c=>c.constructor.name==='DeleteObjectCommand'));
});
test('SQS SDK contract renews visibility, acks with receipt handles, validates envelopes and routes failure events to DLQ',async()=>{
 const commands=[],config={...loadConfig(),sqsQueueUrl:'https://sqs.ap-south-1.amazonaws.com/123456789012/work',sqsDlqUrl:'https://sqs.ap-south-1.amazonaws.com/123456789012/dead'};
 const client={send:async cmd=>{commands.push(cmd);if(cmd.constructor.name==='ReceiveMessageCommand')return{Messages:[{ReceiptHandle:'receipt',Body:JSON.stringify({protocol:1,eventId:'12345678-1234-1234-1234-123456789012',jobId:'a'.repeat(32)})}]};return{};}};
 const queue=new SqsQueue(config,{client}),message=await queue.receive();assert.equal(message.jobId,'a'.repeat(32));await queue.renew(message,60);await queue.ack(message);await queue.publish({event_type:'download.failed',id:'x',job_id:'a'.repeat(32),payload:{errorCode:'TEST'}});
 assert.equal(commands.find(c=>c.constructor.name==='ChangeMessageVisibilityCommand').input.ReceiptHandle,'receipt');assert.equal(commands.at(-1).input.QueueUrl,config.sqsDlqUrl);assert.ok(!commands.at(-1).input.MessageBody.includes('password'));
});
test('mail envelopes authenticate ciphertext; runtime database secret preserves escaping and TLS policy',async()=>{
 const encoded=seal({to:'fixture@example.test',token:'secret-fixture'},'key-a');assert.ok(!encoded.includes('secret-fixture'));assert.deepEqual(unseal(encoded,'key-a'),{to:'fixture@example.test',token:'secret-fixture'});assert.throws(()=>unseal(encoded,'key-b'));
 const config=await loadRuntimeConfig({DATABASE_SECRET_ARN:'arn:fixture',PUBLIC_ORIGIN:'http://localhost:8787'},{client:{send:async()=>({SecretString:JSON.stringify({host:'db.example.test',port:5432,dbname:'clipnest',username:'clipnest_app',password:'@#$:/! complex'})})}});const url=new URL(config.databaseUrl);assert.equal(decodeURIComponent(url.password),'@#$:/! complex');assert.equal(url.hostname,'db.example.test');
});
