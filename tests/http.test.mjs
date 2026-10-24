import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readJson} from '../backend/http.mjs';

function request(chunks){
 const req=Readable.from(chunks);
 req.headers={'content-type':'application/json; charset=utf-8'};
 return req;
}

test('JSON request parsing preserves Unicode passwords across every HTTP chunk boundary',async()=>{
 const input={password:'A long é € 🔐 password',description:'日本語'},body=Buffer.from(JSON.stringify(input));
 for(let split=1;split<body.length;split++){
  assert.deepEqual(await readJson(request([body.subarray(0,split),body.subarray(split)])),input,`byte ${split}`);
 }
 assert.deepEqual(await readJson(request([...body].map(byte=>Buffer.from([byte])))),input);
});

test('JSON request parsing keeps its bounded byte limit with split multibyte input',async()=>{
 const overhead=Buffer.byteLength(JSON.stringify({password:''}));
 const exact=Buffer.from(JSON.stringify({password:'x'.repeat(8192-overhead)}));
 assert.equal(exact.length,8192);
 assert.equal((await readJson(request([exact.subarray(0,4096),exact.subarray(4096)]))).password.length,8192-overhead);
 const oversized=Buffer.from(JSON.stringify({password:'🔐'.repeat(2048)}));
 assert.ok(oversized.length>8192);
 await assert.rejects(readJson(request([oversized.subarray(0,8192),oversized.subarray(8192)])),{status:413,code:'PAYLOAD_TOO_LARGE'});
});
