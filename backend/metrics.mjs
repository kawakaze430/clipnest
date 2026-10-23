const allowed=new Set(['Requests','RequestErrors','RequestLatency','AnalysisSuccess','AnalysisFailure','JobReady','JobFailure','PreparedBytes','UploadFailure','QueuePublishFailure','QueueReceiveFailure','CleanupFailure','ExpiredObjects','OldestExpiredSeconds','OrphanFilesDeleted','MailSent','MailFailure']);
const gauges=new Set(['ExpiredObjects','OldestExpiredSeconds']);
export class Metrics {
 constructor({environment='development',role='api',logger=console.log}={}){this.environment=environment;this.role=role;this.logger=logger;this.values={};this.pending={};this.units={};this.timer=setInterval(()=>this.flush(),60000);this.timer.unref();}
 emit(name,value=1,unit='Count'){if(!allowed.has(name)||!Number.isFinite(value))return;this.values[name]=gauges.has(name)?value:(this.values[name]||0)+value;this.units[name]=unit;if(name==='RequestLatency'){(this.pending[name]||=[]).push(value);if(this.pending[name].length>=100)this.flush();}else this.pending[name]=gauges.has(name)?value:(this.pending[name]||0)+value;}
 flush(){const entries=Object.entries(this.pending);if(!entries.length)return;this.pending={};this.logger(JSON.stringify({_aws:{Timestamp:Date.now(),CloudWatchMetrics:[{Namespace:'ClipNest',Dimensions:[['Environment','Role']],Metrics:entries.map(([Name])=>({Name,Unit:this.units[Name]}))}]},Environment:this.environment,Role:this.role,...Object.fromEntries(entries)}));}
 snapshot(){return{environment:this.environment,role:this.role,values:{...this.values}};}
 close(){clearInterval(this.timer);this.flush();}
}
