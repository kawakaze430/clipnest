import {SQSClient,SendMessageCommand,ReceiveMessageCommand,DeleteMessageCommand,ChangeMessageVisibilityCommand} from '@aws-sdk/client-sqs';
import {createHash,randomUUID} from 'node:crypto';
export class SqsQueue {
 constructor(config,{client=new SQSClient({region:config.awsRegion,maxAttempts:3})}={}){this.config=config;this.client=client;}
 async publish(event){const failed=event.event_type==='download.failed';await this.client.send(new SendMessageCommand({QueueUrl:failed?this.config.sqsDlqUrl:this.config.sqsQueueUrl,MessageBody:JSON.stringify({protocol:1,eventId:event.id,jobId:event.job_id,...(failed?{errorCode:event.payload.errorCode||'DOWNLOAD_FAILED'}:{})})}));}
 async receive(signal){const r=await this.client.send(new ReceiveMessageCommand({QueueUrl:this.config.sqsQueueUrl,MaxNumberOfMessages:1,WaitTimeSeconds:10,VisibilityTimeout:60,MessageSystemAttributeNames:['ApproximateReceiveCount']}),{abortSignal:signal});const message=r.Messages?.[0];if(!message)return null;let body;try{body=JSON.parse(message.Body);if(body.protocol!==1||!/^[\w-]{32}$/.test(body.jobId)||!/^[a-f0-9-]{36}$/.test(body.eventId))throw new Error();}catch{return{invalid:true,receipt:message.ReceiptHandle,bodySha256:createHash('sha256').update(message.Body||'').digest('hex')};}return{jobId:body.jobId,eventId:body.eventId,receipt:message.ReceiptHandle};}
 async reject(delivery){await this.client.send(new SendMessageCommand({QueueUrl:this.config.sqsDlqUrl,MessageBody:JSON.stringify({protocol:1,kind:'invalid.message',bodySha256:delivery.bodySha256,eventId:randomUUID()})}));await this.ack(delivery);}
 async ack(delivery){await this.client.send(new DeleteMessageCommand({QueueUrl:this.config.sqsQueueUrl,ReceiptHandle:delivery.receipt}));}
 async renew(delivery,seconds=60){await this.client.send(new ChangeMessageVisibilityCommand({QueueUrl:this.config.sqsQueueUrl,ReceiptHandle:delivery.receipt,VisibilityTimeout:seconds}));}
}
export class OutboxDispatcher {
 constructor({store,queue,metrics}){this.store=store;this.queue=queue;this.metrics=metrics;this.id=randomUUID();this.busy=false;this.stopping=false;}
 async tick(){if(this.busy||this.stopping||!this.queue)return;this.busy=true;try{for(let i=0;i<10&&!this.stopping;i++){const event=await this.store.claimOutbox(this.id);if(!event)break;try{await this.queue.publish(event);await this.store.markPublished(event.id,this.id);}catch{this.metrics?.emit('QueuePublishFailure');await this.store.releaseOutbox(event.id,this.id);break;}}}finally{this.busy=false;}}
 start(){this.stopping=false;this.timer=setInterval(()=>this.tick().catch(()=>this.metrics?.emit('QueuePublishFailure')),1000);this.timer.unref();this.tick().catch(()=>{});}
 async stop(){this.stopping=true;clearInterval(this.timer);while(this.busy)await new Promise(r=>setTimeout(r,10));}
}
