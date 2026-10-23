import {mkdir,writeFile,stat} from 'node:fs/promises';
import {generateKeyPairSync} from 'node:crypto';
import path from 'node:path';
const directory=path.resolve('.cache/deployment');await mkdir(directory,{recursive:true,mode:0o700});
const keyPath=path.join(directory,'media-private.pem');
if(await stat(keyPath).catch(()=>null))throw new Error('Existing signing key preserved. Use the documented rotation procedure for a new key.');
const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
await writeFile(keyPath,pair.privateKey,{mode:0o600,flag:'wx'});await writeFile(path.join(directory,'media-public.pem'),pair.publicKey,{mode:0o600,flag:'wx'});
console.log(JSON.stringify({publicKeyPath:path.join(directory,'media-public.pem'),privateKeyPath:keyPath,note:'Keep the private key out of Git, archives and chat. Supply only the public key to Terraform.'}));
