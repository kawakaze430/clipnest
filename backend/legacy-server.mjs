import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, normalizeYouTubeUrl, buildOptions, publicInfo, safeExtractorError, YtDlpEngine } from './core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const newId = () => randomBytes(24).toString('base64url');
const equal = (a, b) => { const x = Buffer.from(a || ''), y = Buffer.from(b || ''); return x.length === y.length && timingSafeEqual(x, y); };
const mimetypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };

async function readJson(req) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 8192) throw new ApiError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); }
  catch { throw new ApiError(400, 'Send a valid JSON request.'); }
}

export async function createApp({ engine = new YtDlpEngine(), dataDir = process.env.DATA_DIR || path.join(root, '.cache'), apiToken = process.env.API_TOKEN || '', allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean), maxBytes = Number(process.env.MAX_FILE_BYTES) || 1024 ** 3, maxConcurrent = 2, ttl = 30 * 60 * 1000 } = {}) {
  await mkdir(dataDir, { recursive: true });
  // Job secrets live in memory; remove files left behind by an earlier process.
  for (const item of await readdir(dataDir, { withFileTypes: true })) if (item.isDirectory() && /^job-[\w-]+$/.test(item.name)) await rm(path.join(dataDir, item.name), { recursive: true, force: true });
  const analyses = new Map(), jobs = new Map(), tickets = new Map(), rates = new Map();
  let analyzing = 0, healthCache, healthAt = 0;
  const health = async () => { if (!healthCache || Date.now() - healthAt > 30000) { healthCache = await engine.health(); healthAt = Date.now(); } return healthCache; };
  const cleanup = async () => {
    const now = Date.now();
    for (const [id, analysis] of analyses) if (now - analysis.created > 10 * 60 * 1000) analyses.delete(id);
    for (const [key, rate] of rates) if (now > rate.reset) rates.delete(key);
    for (const [key, ticket] of tickets) if (now > ticket.expires) tickets.delete(key);
    for (const [id, job] of jobs) if (['ready', 'failed', 'cancelled'].includes(job.status) && now - job.updated > ttl) {
      // An open file stream must remain readable until it completes.
      if (job.streams) continue;
      jobs.delete(id); await rm(job.directory, { recursive: true, force: true });
    }
  };
  const sweep = setInterval(() => cleanup().catch(() => {}), 60000); sweep.unref();
  const jobView = job => ({ id: job.id, title: job.title, status: job.status, phase: job.phase, progress: job.progress, downloaded: job.downloaded, total: job.total, speed: job.speed, eta: job.eta, error: job.error || null, ext: job.option.ext, filename: job.filename || null, expiresAt: ['ready', 'failed', 'cancelled'].includes(job.status) ? job.updated + ttl : null });
  const runJob = async job => {
    job.status = 'downloading'; job.phase = 'Fetching video'; job.updated = Date.now();
    const timeout = setTimeout(() => job.controller.abort(), 30 * 60 * 1000); timeout.unref();
    try {
      await engine.download({ url: job.url, option: job.option, directory: job.directory, signal: job.controller.signal,
        onFile: filename => { job.file = filename; },
        onProgress: progress => {
          if (job.controller.signal.aborted) return;
          job.updated = Date.now();
          if (progress.status === 'processing' || progress.status === 'finished') { job.phase = 'Preparing your file'; job.speed = null; job.eta = null; return; }
          const current = Number(progress.downloaded_bytes) || 0;
          const stream = progress.info_dict?.format_id || progress.filename || 'main';
          const total = Number(progress.total_bytes || progress.total_bytes_estimate) || null;
          job.parts.set(stream, { current, total });
          const parts = [...job.parts.values()];
          job.downloaded = parts.reduce((sum, p) => sum + p.current, 0);
          job.total = job.option.size || (parts.every(p => p.total) ? parts.reduce((sum, p) => sum + p.total, 0) : null);
          job.progress = job.total ? Math.min(99, Math.max(0, job.downloaded / job.total * 100)) : null;
          job.speed = Number(progress.speed) || null; job.eta = Number.isFinite(progress.eta) ? progress.eta : null;
          job.phase = 'Downloading to server';
          if (job.downloaded > maxBytes) { job.limitExceeded = true; job.controller.abort(); }
        }
      });
      if (job.controller.signal.aborted) throw new Error('Aborted');
      if (!job.file) throw new Error('No final file produced');
      const canonical = await realpath(job.file);
      const directory = await realpath(job.directory);
      if (!canonical.startsWith(directory + path.sep)) throw new Error('Unexpected file path');
      const fileStat = await stat(canonical);
      if (!fileStat.size || fileStat.size > maxBytes) throw new Error('File exceeds size limit');
      job.file = canonical; job.filename = path.basename(canonical); job.total = fileStat.size; job.downloaded = fileStat.size;
      job.progress = 100; job.speed = null; job.eta = 0; job.status = 'ready'; job.phase = 'Ready to save';
    } catch (error) {
      job.status = job.controller.signal.aborted && !job.limitExceeded ? 'cancelled' : 'failed';
      job.error = job.status === 'cancelled' ? 'Download cancelled or timed out.' : job.limitExceeded ? 'This download exceeds the server’s file size limit.' : safeExtractorError(error.message);
      await rm(job.directory, { recursive: true, force: true });
    } finally { clearTimeout(timeout); job.updated = Date.now(); }
  };
  const rateLimit = owner => {
    const now = Date.now(), rate = rates.get(owner) || { count: 0, reset: now + 60000 };
    if (now > rate.reset) { rate.count = 0; rate.reset = now + 60000; }
    rate.count++; rates.set(owner, rate);
    if (rate.count > 20) throw new ApiError(429, 'Too many requests. Try again in a minute.');
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const api = url.pathname.startsWith('/api/');
      if (!api) {
        if (!['GET', 'HEAD'].includes(req.method)) throw new ApiError(405, 'Method not allowed.');
        const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
        const publicDir = path.join(root, 'dist'); const file = path.resolve(publicDir, relative);
        if (!file.startsWith(publicDir + path.sep)) throw new ApiError(404, 'Not found.');
        const details = await stat(file).catch(() => null);
        if (!details?.isFile()) throw new ApiError(404, 'Not found.');
        res.writeHead(200, { 'Content-Type': mimetypes[path.extname(file)] || 'application/octet-stream', 'Content-Length': details.size, 'Cache-Control': 'no-cache', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://i.ytimg.com; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" });
        if (req.method === 'HEAD') return res.end();
        createReadStream(file).on('error', () => res.destroy()).pipe(res); return;
      }
      const origin = req.headers.origin;
      const host = String(req.headers.host || '');
      const sameOrigin = origin && (() => { try { return new URL(origin).host === host; } catch { return false; } })();
      const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
      if (!apiToken && !localHost) throw new ApiError(403, 'Set API_TOKEN before exposing this server on a public hostname.');
      if (origin && !sameOrigin && !allowedOrigins.includes(origin)) throw new ApiError(403, 'This website is not in the server’s ALLOWED_ORIGINS list.');
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-ID');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      const fileMatch = /^\/api\/files\/([\w-]{32})$/.exec(url.pathname);
      if (fileMatch && ['GET', 'HEAD'].includes(req.method)) {
        const ticket = tickets.get(fileMatch[1]);
        const job = ticket && jobs.get(ticket.jobId);
        if (!ticket || ticket.expires < Date.now() || !job || job.status !== 'ready') throw new ApiError(410, 'This file link expired. Prepare the download again.');
        const fileStat = await stat(job.file);
        let start = 0, end = fileStat.size - 1, partial = false;
        if (req.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
          if (!match || (!match[1] && !match[2])) throw new ApiError(416, 'Invalid byte range.');
          if (!match[1]) start = Math.max(0, fileStat.size - Number(match[2]));
          else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
          if (start > end || start >= fileStat.size) { res.setHeader('Content-Range', `bytes */${fileStat.size}`); throw new ApiError(416, 'Byte range not available.'); }
          partial = true;
        }
        const headers = { 'Content-Type': mimetypes[path.extname(job.file)] || 'application/octet-stream', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="download.${job.option.ext}"; filename*=UTF-8''${encodeURIComponent(job.filename).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16))}` };
        if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${fileStat.size}`;
        res.writeHead(partial ? 206 : 200, headers);
        if (req.method === 'HEAD') return res.end();
        job.streams = (job.streams || 0) + 1;
        const stream = createReadStream(job.file, { start, end, highWaterMark: 256 * 1024 });
        res.on('close', () => { stream.destroy(); job.streams--; });
        stream.on('error', () => res.destroy()); stream.pipe(res); return;
      }
      if (apiToken && !equal(req.headers.authorization, `Bearer ${apiToken}`)) throw new ApiError(401, 'Enter the correct server access token in Server setup.');
      const owner = String(req.headers['x-client-id'] || '');
      if (!/^[\w-]{24,80}$/.test(owner)) throw new ApiError(400, 'Missing browser session identifier. Reload the page.');
      if (url.pathname === '/api/health' && req.method === 'GET') return json(200, { service: 'clipnest', protocol: 1, ...(await health()), maxBytes, maxConcurrent });
      if (url.pathname === '/api/analyze' && req.method === 'POST') {
        rateLimit(owner); if (analyzing >= maxConcurrent) throw new ApiError(429, 'The server is busy checking other videos. Try again shortly.');
        const { url: input } = await readJson(req), normalized = normalizeYouTubeUrl(input);
        const ready = await health(); if (!ready.ready) throw new ApiError(503, 'Install yt-dlp on the server to enable video analysis.');
        analyzing++;
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 90000);
        res.on('close', () => { if (!res.writableEnded) controller.abort(); });
        try {
          const info = await engine.analyze(normalized, { signal: controller.signal });
          if (info._type === 'playlist' || info.is_live || info.live_status === 'is_upcoming') throw new ApiError(400, 'Choose an individual, published video. Live streams and playlists are not supported.');
          if (!/^[\w-]{11}$/.test(info.id || '')) throw new ApiError(502, 'The source returned invalid video details.');
          const options = buildOptions(info, { ffmpeg: ready.ffmpeg }).filter(o => !o.size || o.size <= maxBytes);
          if (!options.length) throw new ApiError(422, 'No downloadable qualities are available within this server’s file limit.');
          if (analyses.size >= 200) throw new ApiError(429, 'The server is busy. Please try again in a few minutes.');
          const analysisId = newId();
          analyses.set(analysisId, { owner, url: normalized, info, options, created: Date.now() });
          return json(200, { ...publicInfo(info, options), analysisId, expiresAt: Date.now() + 600000 });
        } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(502, safeExtractorError(error.message)); }
        finally { analyzing--; clearTimeout(timeout); }
      }
      if (url.pathname === '/api/jobs' && req.method === 'POST') {
        rateLimit(owner); await cleanup();
        const input = await readJson(req), analysis = analyses.get(input.analysisId);
        if (!analysis || analysis.owner !== owner || Date.now() - analysis.created > 600000) throw new ApiError(410, 'Video details expired. Analyze the link again.');
        const option = analysis.options.find(item => item.id === input.optionId);
        if (!option) throw new ApiError(400, 'Select one of the qualities returned for this video.');
        const active = [...jobs.values()].filter(job => !['ready', 'failed', 'cancelled'].includes(job.status));
        if (active.length >= maxConcurrent || active.some(job => job.owner === owner)) throw new ApiError(429, 'A download is already running. Wait for it to finish or cancel it.');
        if (jobs.size >= 12) throw new ApiError(429, 'The server’s download cache is full. Try again after old files expire.');
        const id = newId(), directory = path.join(dataDir, `job-${id}`); await mkdir(directory);
        const job = { id, owner, url: analysis.url, title: analysis.info.title, option, directory, status: 'queued', phase: 'Starting', progress: 0, downloaded: 0, total: option.size, speed: null, eta: null, controller: new AbortController(), parts: new Map(), created: Date.now(), updated: Date.now() };
        jobs.set(id, job); json(202, jobView(job)); runJob(job); return;
      }
      const jobMatch = /^\/api\/jobs\/([\w-]{32})(\/ticket)?$/.exec(url.pathname);
      if (jobMatch) {
        const job = jobs.get(jobMatch[1]);
        if (!job || job.owner !== owner) throw new ApiError(404, 'This download expired or belongs to a different session.');
        if (req.method === 'GET' && !jobMatch[2]) return json(200, jobView(job));
        if (req.method === 'DELETE' && !jobMatch[2]) { if (!['ready', 'failed', 'cancelled'].includes(job.status)) { job.controller.abort(); job.status = 'cancelled'; job.phase = 'Cancelled'; } return json(200, jobView(job)); }
        if (req.method === 'POST' && jobMatch[2]) {
          if (job.status !== 'ready') throw new ApiError(409, 'This file is still being prepared.');
          // Bound ticket memory even if a client repeatedly requests a link.
          for (const [key, ticket] of tickets) if (ticket.jobId === job.id) tickets.delete(key);
          const ticket = newId(); tickets.set(ticket, { jobId: job.id, expires: Date.now() + 10 * 60000 });
          return json(200, { path: `/api/files/${ticket}`, filename: job.filename, expiresAt: Date.now() + 10 * 60000 });
        }
      }
      throw new ApiError(404, 'Endpoint not found.');
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      if (!(error instanceof ApiError)) console.error('[ClipNest]', error.message);
      json(error.status || 500, { error: error instanceof ApiError ? error.message : 'The server encountered an error. Please try again.' });
    }
  });
  server.requestTimeout = 120000;
  server.on('close', () => { clearInterval(sweep); for (const job of jobs.values()) job.controller.abort(); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8787;
  const host = process.env.HOST || '127.0.0.1';
  const server = await createApp();
  server.listen(port, host, () => console.log(`ClipNest is listening on http://${host}:${port}`));
  const stop = () => { server.close(); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
