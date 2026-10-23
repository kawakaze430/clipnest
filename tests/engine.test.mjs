import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { YtDlpEngine } from '../backend/core.mjs';

test('download subprocess consumes progress and final paths without a shell', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'clipnest-engine-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const command = path.join(directory, 'test-engine.mjs');
  const finalFile = path.join(directory, 'example.mp4');
  await writeFile(command, `#!/usr/bin/env node\nimport {writeFileSync} from 'node:fs';\nconst args=process.argv.slice(2);\nif(args.includes('--version')){console.log('test-version');process.exit(0)}\nif(args.includes('--dump-single-json')){console.log(JSON.stringify({id:'aqz-KE-bpKQ',title:'Test'}));process.exit(0)}\nif(args[args.length-2]!=='--') process.exit(2);\nwriteFileSync(${JSON.stringify(finalFile)}, 'video');\nprocess.stdout.write('CLIPPROGRESS:'+JSON.stringify({status:'downloading',downloaded_bytes:100,speed:1000})+'\\n');\nprocess.stdout.write('CLIPFILE:'+${JSON.stringify(finalFile)}+'\\n');\n`);
  await chmod(command, 0o755);
  const engine = new YtDlpEngine({ command });
  assert.equal((await engine.analyze('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).id, 'aqz-KE-bpKQ');
  const updates = []; let file;
  await engine.download({ url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', option: { selector: '137+140', ext: 'mp4' }, directory, onProgress: item => updates.push(item), onFile: value => { file = value; }, signal: new AbortController().signal });
  assert.equal(file, finalFile); assert.equal(updates[0].downloaded_bytes, 100); assert.equal(updates[0].speed, 1000);
});
