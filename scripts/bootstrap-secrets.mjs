import {readFile,stat} from 'node:fs/promises';
import {randomBytes,createPrivateKey,createPublicKey,createHash} from 'node:crypto';
import {SecretsManagerClient,GetSecretValueCommand,PutSecretValueCommand} from '@aws-sdk/client-secrets-manager';
const [outputPath,privatePath]=process.argv.slice(2);if(!outputPath||!privatePath)throw new Error('Usage: node scripts/bootstrap-secrets.mjs TERRAFORM_OUTPUT_JSON PRIVATE_KEY_PATH');
const raw=JSON.parse(await readFile(outputPath,'utf8')),d=raw.deployment?.value||raw.deployment||raw;
const details=await stat(privatePath);if(process.platform!=='win32'&&(details.mode&0o077))throw new Error('Private key permissions must be 0600');const privateKey=await readFile(privatePath,'utf8');createPrivateKey(privateKey);
const publicKey=createPublicKey(privateKey).export({format:"pem",type:"spki"});
if(!d.media_public_key_sha256||createHash("sha256").update(publicKey.trim()).digest("hex")!==d.media_public_key_sha256)throw new Error("Private key does not match the CloudFront public key in these Terraform outputs");
const client=new SecretsManagerClient({region:d.region,maxAttempts:2});
// Preserve an existing session secret so a routine release does not invalidate pending mail.
let existing=false;try{await client.send(new GetSecretValueCommand({SecretId:d.session_secret}));existing=true;}catch(e){if(!['ResourceNotFoundException','InvalidRequestException'].includes(e.name))throw e;}
if(!existing)await client.send(new PutSecretValueCommand({SecretId:d.session_secret,SecretString:randomBytes(48).toString('base64url')}));
await client.send(new PutSecretValueCommand({SecretId:d.media_signing_secret,SecretString:privateKey}));
console.log(JSON.stringify({sessionSecretPreserved:existing,signingSecretStored:true,publicKeyMatchesDistribution:true}));
