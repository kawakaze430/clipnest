import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../backend/server.mjs';
import { fixture } from './fixtures.mjs';

const owner = 'browser-session-1234567890123456', stranger = 'different-browser-12345678901234';
async function setup(t, opts = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'clipnest-test-'));
  let hold = false;
  const engine = {
    health: async () => ({ ready: true, version: 'test', ffmpeg: true }),
    analyze: async () => structuredClone(fixture),
    download: async ({ directory, onFile, onProgress, signal }) => {
      if (hold) await new Promise((resolve, reject) => { const done = () => reject(new Error('Aborted')); signal.addEventListener('abort', done, { once: true }); if (signal.aborted) done(); });
      onProgress({ status: 'downloading', downloaded_bytes: 6, total_bytes: 6, speed: 1024, eta: 0 });
      const file = path.join(directory, 'video.mp4'); await writeFile(file, 'abcdef'); onFile(file);
    }
  };
  const server = await createApp({ engine, dataDir: directory, ...opts });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, { method = 'GET', body, who = owner, token, headers = {} } = {}) => fetch(base + route, { method, headers: { 'X-Client-ID': who, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  t.after(async () => { const closed = once(server, 'close'); server.close(); server.closeAllConnections(); await closed; await rm(directory, { recursive: true, force: true }); });
  return { request, setHold: value => { hold = value; } };
}
async function analyze(request) { const response = await request('/api/analyze', { method: 'POST', body: { url: 'https://youtu.be/aqz-KE-bpKQ' } }); assert.equal(response.status, 200); return response.json(); }
async function waitJob(request, id, target) { for (let attempt = 0; attempt < 30; attempt++) { const job = await (await request(`/api/jobs/${id}`)).json(); if (job.status === target) return job; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Job did not reach ' + target); }

test('health and metadata omit internal source URLs/selectors', async t => {
  const { request } = await setup(t); assert.equal((await (await request('/api/health')).json()).service, 'clipnest');
  const info = await analyze(request); assert.equal(info.title, fixture.title);
  assert.ok(info.analysisId); assert.ok(!JSON.stringify(info).includes('media.example')); assert.ok(info.options.every(o => !o.selector));
});
test('end-to-end job prepares a file and streams exact bytes with Range support', async t => {
  const { request } = await setup(t); const info = await analyze(request);
  const response = await request('/api/jobs', { method: 'POST', body: { analysisId: info.analysisId, optionId: info.options[0].id } }); assert.equal(response.status, 202);
  const job = await response.json(); const ready = await waitJob(request, job.id, 'ready'); assert.equal(ready.progress, 100);
  const ticket = await (await request(`/api/jobs/${job.id}/ticket`, { method: 'POST' })).json();
  const file = await request(ticket.path); assert.equal(file.status, 200); assert.match(file.headers.get('content-disposition'), /attachment/); assert.equal(await file.text(), 'abcdef');
  const range = await request(ticket.path, { headers: { Range: 'bytes=1-3' } }); assert.equal(range.status, 206); assert.equal(await range.text(), 'bcd'); assert.equal(range.headers.get('content-range'), 'bytes 1-3/6');
  const suffix = await request(ticket.path, { headers: { Range: 'bytes=-2' } }); assert.equal(await suffix.text(), 'ef');
  assert.equal((await request(ticket.path, { headers: { Range: 'bytes=9-' } })).status, 416);
});
test('job and metadata ownership block access from another browser', async t => {
  const { request } = await setup(t); const info = await analyze(request);
  assert.equal((await request('/api/jobs', { method: 'POST', who: stranger, body: { analysisId: info.analysisId, optionId: info.options[0].id } })).status, 410);
  const job = await (await request('/api/jobs', { method: 'POST', body: { analysisId: info.analysisId, optionId: info.options[0].id } })).json();
  assert.equal((await request(`/api/jobs/${job.id}`, { who: stranger })).status, 404);
  assert.equal((await request(`/api/jobs/${job.id}/ticket`, { who: stranger, method: 'POST' })).status, 404);
});
test('cancels an active download and rejects fabricated format selections', async t => {
  const { request, setHold } = await setup(t); const info = await analyze(request);
  assert.equal((await request('/api/jobs', { method: 'POST', body: { analysisId: info.analysisId, optionId: '18+exec' } })).status, 400);
  setHold(true);
  const job = await (await request('/api/jobs', { method: 'POST', body: { analysisId: info.analysisId, optionId: info.options[0].id } })).json();
  assert.equal((await request('/api/jobs', { method: 'POST', body: { analysisId: info.analysisId, optionId: info.options[0].id } })).status, 429);
  const cancelled = await (await request(`/api/jobs/${job.id}`, { method: 'DELETE' })).json(); assert.equal(cancelled.status, 'cancelled');
  assert.equal((await request(`/api/jobs/${job.id}/ticket`, { method: 'POST' })).status, 409);
});
test('requires configured token, rejects unapproved origins, accepts declared CORS', async t => {
  const { request } = await setup(t, { apiToken: 'test-private-token', allowedOrigins: ['https://site.example'] });
  assert.equal((await request('/api/health')).status, 401);
  assert.equal((await request('/api/health', { token: 'wrong' })).status, 401);
  assert.equal((await request('/api/health', { token: 'test-private-token', headers: { Origin: 'https://evil.example' } })).status, 403);
  const success = await request('/api/health', { token: 'test-private-token', headers: { Origin: 'https://site.example' } });
  assert.equal(success.status, 200); assert.equal(success.headers.get('access-control-allow-origin'), 'https://site.example');
});
test('rejects private host URLs before calling extractor', async t => {
  const { request } = await setup(t);
  const response = await request('/api/analyze', { method: 'POST', body: { url: 'http://127.0.0.1/secret' } }); assert.equal(response.status, 400);
});
