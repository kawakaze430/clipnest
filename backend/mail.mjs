import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {SESv2Client,SendEmailCommand} from '@aws-sdk/client-sesv2';
import {unseal} from './sealed.mjs';
export class SesMailer {
 constructor(config,{client=new SESv2Client({region:config.awsRegion,maxAttempts:2})}={}){this.config=config;this.client=client;}
 async send(id,{to,subject,text}){await this.client.send(new SendEmailCommand({FromEmailAddress:this.config.mailFrom,Destination:{ToAddresses:[to]},Content:{Simple:{Subject:{Data:subject,Charset:'UTF-8'},Body:{Text:{Data:text,Charset:'UTF-8'}}}},EmailTags:[{Name:'application',Value:'clipnest'}]}));}
}
export class FileMailer {
 constructor(config){if(config.production)throw new Error('File email is development-only');this.directory=path.join(config.dataDir,'mail');}
 async send(id,payload){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid delivery identifier');await mkdir(this.directory,{recursive:true,mode:0o700});await writeFile(path.join(this.directory,id+'.json'),JSON.stringify(payload),{mode:0o600});}
}
export class MailDispatcher {
 constructor({store,config,mailer,metrics}){this.store=store;this.config=config;this.mailer=mailer||(config.mailMode==='ses'?new SesMailer(config):new FileMailer(config));this.metrics=metrics;this.id=randomUUID();this.busy=false;this.stopping=false;}
 async tick(){if(this.busy||this.stopping)return;this.busy=true;try{for(let i=0;i<5&&!this.stopping;i++){const mail=await this.store.claimMail(this.id);if(!mail)break;try{await this.mailer.send(mail.id,unseal(mail.sealed_payload,this.config.sessionSecret));await this.store.finishMail(mail.id,this.id,true);this.metrics?.emit('MailSent');}catch{await this.store.finishMail(mail.id,this.id,false);this.metrics?.emit('MailFailure');}}}finally{this.busy=false;}}
 start(){this.stopping=false;this.timer=setInterval(()=>this.tick().catch(()=>this.metrics?.emit('MailFailure')),1000);this.timer.unref();this.tick().catch(()=>{});}
 async stop(){this.stopping=true;clearInterval(this.timer);while(this.busy)await new Promise(r=>setTimeout(r,10));}
}
