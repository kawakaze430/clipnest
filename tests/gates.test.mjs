import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectEvidence,required} from '../scripts/ops/release-gates.mjs';
import {Metrics} from '../backend/metrics.mjs';
test('release gate refuses placeholders, stale evidence and evidence for another commit',async()=>{
 const template=JSON.parse(await readFile(new URL('../release/evidence.example.json',import.meta.url),'utf8'));assert.ok(inspectEvidence(template,{commit:'abc'}).length>required.length);
 const now=Date.now(),base={commit:'abc',recordedAt:new Date(now).toISOString(),owner:{monthlyBudgetUsd:50,legalEntity:'Test owner',onCall:'Owner',launchMarkets:['test']},checks:Object.fromEntries(required.map(k=>[k,{status:'passed',reference:'fixture-only'}]))};assert.deepEqual(inspectEvidence(base,{commit:'abc',now}),[]);assert.ok(inspectEvidence(base,{commit:'different',now}).length);assert.ok(inspectEvidence({...base,recordedAt:new Date(now-8*86400000).toISOString()},{commit:'abc',now}).length);assert.ok(inspectEvidence({...base,checks:{...base.checks,s3SqsCloudFront:{status:'pending',reference:'not run'}}},{commit:'abc',now}).includes('s3SqsCloudFront: missing passed result and evidence reference'));
});
test('EMF keeps retention gauges current, batches latency and limits dimensions',()=>{const logs=[],m=new Metrics({logger:l=>logs.push(JSON.parse(l)),environment:'test',role:'worker'});m.emit('OldestExpiredSeconds',200,'Seconds');m.emit('OldestExpiredSeconds',10,'Seconds');m.emit('JobReady',1);m.emit('JobReady',1);m.emit('email@example.test',1);for(let i=0;i<100;i++)m.emit('RequestLatency',i,'Milliseconds');m.close();assert.equal(logs[0].OldestExpiredSeconds,10);assert.equal(logs[0].JobReady,2);assert.equal(logs[0].RequestLatency.length,100);assert.deepEqual(logs[0]._aws.CloudWatchMetrics[0].Dimensions,[['Environment','Role']]);assert.equal('email@example.test' in logs[0],false);});
