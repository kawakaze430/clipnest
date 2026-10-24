// Planning only: validate private owner inputs and optionally read STS identity.
// This tool never provisions resources or marks production acceptance passed.
import {readFile,access} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {privateJson} from './aws-cli.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const shape={schemaVersion:null,accountId:null,deploymentRoleArn:null,region:null,
 monthlyBudgetUsd:null,stagingSpendLimitUsd:null,
 traffic:{dailyJobs:null,peakConcurrentJobs:null,maxFileMiB:null,maxDurationSeconds:null},
 mailFrom:null,alertEmail:null,owner:{legalEntity:null,onCall:null,supportContact:null,launchMarkets:null},
 mediaAuthorization:{reference:null,testVideoUrl:null}};
const text=value=>typeof value==='string'&&value.trim().length>0&&!/REPLACE|YOUR_|PLACEHOLDER/i.test(value);
const email=value=>text(value)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
function knownFields(value,expected){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 return Object.keys(value).every(key=>Object.hasOwn(expected,key)&&
  (expected[key]===null||knownFields(value[key],expected[key])));
}
export function assessLaunchInputs(input){
 const blockers=[];
 if(!knownFields(input,shape))return {readyForAccountDiscovery:false,productionReady:false,
  blockers:[{field:'input',reason:'Use the documented schema only; credentials and extra fields are refused.'}]};
 const check=(valid,field,reason)=>{if(!valid)blockers.push({field,reason});};
 check(input.schemaVersion===1,'schemaVersion','Use schema version 1.');
 check(typeof input.accountId==='string'&&/^\d{12}$/.test(input.accountId),'accountId','Supply the expected owner-authorized 12-digit AWS account.');
 check(typeof input.region==='string'&&/^[a-z]{2}-[a-z]+-\d$/.test(input.region)&&!input.region.startsWith('cn-'),'region','Select a commercial AWS Region supported by this infrastructure.');
 if(input.deploymentRoleArn){const match=/^arn:aws:iam::(\d{12}):role\/[\w+=,.@/-]+$/.exec(input.deploymentRoleArn);check(match&&match[1]===input.accountId,'deploymentRoleArn','The optional existing deployment role must belong to the selected account.');}
 for(const field of ['monthlyBudgetUsd','stagingSpendLimitUsd'])check(positive(input[field]),field,'Supply an explicit positive owner-approved spending bound; alerts are not a hard spending cap.');
 for(const field of ['dailyJobs','peakConcurrentJobs'])check(Number.isSafeInteger(input.traffic?.[field])&&input.traffic[field]>0,'traffic.'+field,'Supply a positive traffic target for measured capacity/cost review.');
 check(positive(input.traffic?.maxFileMiB)&&input.traffic.maxFileMiB<=1024,'traffic.maxFileMiB','Select a file bound up to the implemented 1024 MiB limit.');
 check(Number.isSafeInteger(input.traffic?.maxDurationSeconds)&&input.traffic.maxDurationSeconds>0&&input.traffic.maxDurationSeconds<=7200,'traffic.maxDurationSeconds','Select a duration bound up to the implemented 7200-second limit.');
 for(const field of ['mailFrom','alertEmail'])check(email(input[field]),field,'Supply the intended owner-controlled sender/recipient; actual delivery still requires verification.');
 for(const field of ['legalEntity','onCall','supportContact'])check(text(input.owner?.[field]),'owner.'+field,'Supply the accountable public operator/support commitment.');
 const markets=input.owner?.launchMarkets;
 check(Array.isArray(markets)&&markets.length>0&&markets.every(m=>typeof m==='string'&&/^[A-Z]{2}$/.test(m)&&!['XX','ZZ'].includes(m))&&new Set(markets).size===markets.length,'owner.launchMarkets','List the approved distinct two-letter launch countries.');
 check(text(input.mediaAuthorization?.reference),'mediaAuthorization.reference','Supply the actual media/source authorization reference; a public URL alone is insufficient.');
 let video=false;try{const u=new URL(input.mediaAuthorization?.testVideoUrl);video=u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
  ((['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)&&((u.pathname==='/watch'&&/^[\w-]{11}$/.test(u.searchParams.get('v')||''))||/^\/shorts\/[\w-]{11}\/?$/.test(u.pathname)))||(u.hostname==='youtu.be'&&/^\/[\w-]{11}\/?$/.test(u.pathname)));}catch{}
 check(video,'mediaAuthorization.testVideoUrl','Supply a supported HTTPS individual YouTube/Shorts test reference covered by that authorization.');
 return {readyForAccountDiscovery:blockers.length===0,productionReady:false,blockers};
}
export async function inspectLaunchReadiness(input,{probeIdentity}={}){
 const report={...assessLaunchInputs(input),recordedAt:new Date().toISOString(),
  scope:'Owner-input/account discovery only. No AWS resources, source requests or production acceptance.',
  accountProbe:{status:'not_requested'},
  nextSteps:['Verify authenticated account/role and Region availability; discover supported RDS version/class and actual prices.',
   'Review the traffic/cost model, remote-state bootstrap and full Terraform plan within the approved spend.',
   'Apply the reviewed staging plan, populate private secrets, verify SES and deploy exact scanned ECR digest/schema/frontend.',
   'Execute all 16 real release gates, including source-to-device, recovery, security, load, delivery and device/geography evidence.',
   'Open an approved capped invitation beta; record launch/1h/24h/7d observations before worldwide expansion.']};
 if(probeIdentity&&report.readyForAccountDiscovery){
  try{const identity=await probeIdentity(input.region);if(identity?.Account!==input.accountId)throw new Error('account mismatch');
   report.accountProbe={status:'passed',expectedAccountMatched:true};
  }catch{report.accountProbe={status:'failed'};report.readyForAccountDiscovery=false;report.blockers.push({field:'authentication',reason:'AWS STS did not verify the expected account. Check the secure profile/role and retained private CLI diagnostics; do not provision.'});}
 }else if(probeIdentity)report.accountProbe={status:'blocked_by_missing_inputs'};
 return report;
}
async function identity(region){
 const cached=path.join(root,'.cache/external/bin/aws');let executable='aws';try{await access(cached);executable=cached;}catch{}
 const {stdout}=await promisify(execFile)(executable,['sts','get-caller-identity','--region',region,'--no-cli-pager','--output','json','--cli-connect-timeout','5','--cli-read-timeout','10'],
  {timeout:20000,maxBuffer:1024*1024,env:{...process.env,AWS_PAGER:'',AWS_CLI_AUTO_PROMPT:'off',AWS_MAX_ATTEMPTS:'2'}});
 return JSON.parse(stdout);
}
async function main(){
 const args=process.argv.slice(2);let inputFile=path.join(root,'release/launch-inputs.example.json'),output,probe=false;
 while(args.length){const arg=args.shift();if(arg==='--output'){output=args.shift();if(!output)throw new Error('Specify --output path.');}
  else if(arg==='--probe-account')probe=true;else if(arg.startsWith('--'))throw new Error('Unknown option. Use INPUTS_JSON [--probe-account] [--output JSON].');else inputFile=arg;}
 let input;try{input=JSON.parse(await readFile(inputFile,'utf8'));}catch{throw new Error('Cannot read valid launch-input JSON. Copy the example to a private ignored directory; never include credentials.');}
 const report=await inspectLaunchReadiness(input,{probeIdentity:probe?identity:undefined});
 if(output)await privateJson(output,report);
 console.log(JSON.stringify(report,null,2));if(!report.readyForAccountDiscovery)process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Launch readiness failed. Check the input file and secure runtime; input values and CLI errors are withheld.');process.exitCode=1;});
