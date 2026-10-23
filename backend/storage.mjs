import {createReadStream} from 'node:fs';
import {stat,realpath,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {S3Client,HeadObjectCommand,DeleteObjectCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';
import {Upload} from '@aws-sdk/lib-storage';
import {getSignedUrl} from '@aws-sdk/cloudfront-signer';
const suffixes=new Set(['mp4','webm','mkv','mp3','m4a']);
const safeKey=key=>/^media\/[\w-]{32}\/[0-9a-f-]{36}\.(mp4|webm|mkv|mp3|m4a)$/.test(key||'');
export class LocalStorage {
 constructor(config){this.config=config;this.backend='local';}
 async put({filename,ext,sha256}){const root=await realpath(this.config.dataDir),canonical=await realpath(filename);if(!canonical.startsWith(root+path.sep))throw new Error('Invalid local artifact');const details=await stat(canonical);return{backend:'local',path:canonical,filename:path.basename(canonical),ext,size:details.size,sha256};}
 async delete(asset){const raw=asset.path||asset.file_path;if(!raw)return;const root=await realpath(this.config.dataDir),filename=await realpath(raw).catch(()=>null);if(!filename)return;if(!filename.startsWith(root+path.sep))throw new Error('Invalid cleanup path');await rm(path.dirname(filename),{recursive:true,force:true});}
}
export class S3Storage {
 constructor(config,{client=new S3Client({region:config.awsRegion,maxAttempts:3}),uploadFactory=options=>new Upload(options),signer=getSignedUrl}={}){this.config=config;this.client=client;this.uploadFactory=uploadFactory;this.signer=signer;this.backend='s3';}
 async put({jobId,filename,ext,sha256,signal}){
  if(!/^[\w-]{32}$/.test(jobId)||!suffixes.has(ext)||!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Invalid object metadata');
  const details=await stat(filename);if(!details.size||details.size>this.config.maxBytes)throw new Error('Object exceeds file limit');
  const key=`media/${jobId}/${randomUUID()}.${ext}`;
  const upload=this.uploadFactory({client:this.client,params:{Bucket:this.config.s3Bucket,Key:key,Body:createReadStream(filename),ContentLength:details.size,ContentType:ext==='mp3'?'audio/mpeg':ext==='m4a'?'audio/mp4':`video/${ext==='mkv'?'x-matroska':ext}`,ContentDisposition:`attachment; filename="download.${ext}"; filename*=UTF-8''${encodeURIComponent(path.basename(filename)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`,ChecksumAlgorithm:'SHA256',Metadata:{sha256,'job-id':jobId,'expires-at':String(Date.now()+this.config.fileTtlMinutes*60000)}},queueSize:2,partSize:8*1024*1024,leavePartsOnError:false});
  const abort=()=>{upload.abort().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  try{if(signal?.aborted)throw new Error('Upload interrupted');await upload.done();if(signal?.aborted)throw new Error('Upload interrupted');const head=await this.client.send(new HeadObjectCommand({Bucket:this.config.s3Bucket,Key:key}),{abortSignal:signal});if(Number(head.ContentLength)!==details.size||head.Metadata?.sha256!==sha256)throw new Error('Uploaded object integrity check failed');return{backend:'s3',objectKey:key,filename:path.basename(filename),ext,size:details.size,sha256};}
  catch(error){await upload.abort().catch(()=>{});await this.client.send(new DeleteObjectCommand({Bucket:this.config.s3Bucket,Key:key})).catch(()=>{});throw error;}
  finally{signal?.removeEventListener('abort',abort);}
 }
 url(asset,expiresAt){const key=asset.object_key||asset.objectKey;if(!safeKey(key))throw new Error('Invalid object key');const deadline=Math.floor(Math.min(Number(expiresAt),Date.now()+600000)/1000)*1000;if(deadline<=Date.now())throw new Error('Download link expired');return this.signer({url:this.config.mediaBaseUrl+'/'+key.split('/').map(encodeURIComponent).join('/'),keyPairId:this.config.cloudfrontKeyPairId,privateKey:this.config.cloudfrontPrivateKey,dateLessThan:new Date(deadline).toISOString()});}
 async delete(asset){const key=asset.object_key||asset.objectKey;if(!safeKey(key))throw new Error('Invalid object deletion key');await this.client.send(new DeleteObjectCommand({Bucket:this.config.s3Bucket,Key:key}));}
 async sweepOrphans(store){const response=await this.client.send(new ListObjectsV2Command({Bucket:this.config.s3Bucket,Prefix:'media/',MaxKeys:100,ContinuationToken:this.orphanCursor}));this.orphanCursor=response.NextContinuationToken;let count=0;for(const item of response.Contents||[]){if(!safeKey(item.Key)||Date.now()-new Date(item.LastModified).getTime()<this.config.orphanGraceMinutes*60000)continue;if(await store.objectReferenced(item.Key))continue;await this.delete({objectKey:item.Key});count++;}return count;}
}
export const createStorage=(config,options)=>config.storageBackend==='s3'?new S3Storage(config,options):new LocalStorage(config);
