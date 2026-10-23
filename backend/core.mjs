import { spawn } from 'node:child_process';

export class ApiError extends Error {
  constructor(status, message, code = null) { super(message); this.status = status; this.code = code; }
}

export function normalizeYouTubeUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new ApiError(400, 'Paste a valid YouTube video link.');
  let url;
  try { url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`); }
  catch { throw new ApiError(400, 'Paste a valid YouTube video link.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new ApiError(400, 'Use a standard YouTube video link.');
  const host = url.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    const parts = url.pathname.split('/').filter(Boolean);
    id = parts[0] === 'watch' ? url.searchParams.get('v') : ['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : null;
  }
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new ApiError(400, 'Use a YouTube video, Shorts, or youtu.be link. Playlists are not supported.');
  return `https://www.youtube.com/watch?v=${id}`;
}

const fileSize = f => Number(f.filesize || f.filesize_approx) || null;
const codec = value => value && value !== 'none';
const usable = f => f && !f.has_drm && /^[\w.-]+$/.test(f.format_id || '') && /^https?:\/\//.test(f.url || '');
export function buildOptions(info, { ffmpeg = true } = {}) {
  const formats = (info.formats || []).filter(usable);
  const audio = formats.filter(f => !codec(f.vcodec) && codec(f.acodec) && ['m4a','webm','mp3','mp4'].includes(f.ext));
  const bestAudio = audio.slice().sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
  const bestM4a = bestAudio.find(f => f.ext === 'm4a');
  const candidates = new Map();
  for (const f of formats.filter(f => codec(f.vcodec) && f.height > 0)) {
    const hasAudio = codec(f.acodec);
    const companion = hasAudio ? null : (f.ext === 'mp4' ? bestM4a : null) || bestAudio[0];
    if (!hasAudio && (!companion || !ffmpeg)) continue;
    const ext = hasAudio ? f.ext : f.ext === 'mp4' && companion.ext === 'm4a' ? 'mp4' : f.ext === 'webm' && companion.ext === 'webm' ? 'webm' : 'mkv';
    if (!['mp4', 'webm', 'mkv'].includes(ext)) continue;
    const fps = Number(f.fps) || 30;
    const hdr = f.dynamic_range && f.dynamic_range !== 'SDR' && f.dynamic_range !== 'unknown';
    const key = `${f.height}-${fps > 30 ? Math.round(fps) : 30}-${ext}-${hdr ? 'hdr' : 'sdr'}`;
    const size = fileSize(f) && (hasAudio || fileSize(companion)) ? fileSize(f) + (hasAudio ? 0 : fileSize(companion)) : null;
    const record = {
      id: `v-${f.format_id}`, type: 'video', label: `${f.height}p${fps > 30 ? ` ${Math.round(fps)}fps` : ''}${hdr ? ' HDR' : ''}`,
      height: f.height, fps, ext, size, approximate: !!(f.filesize_approx || companion?.filesize_approx),
      audioIncluded: true, codec: String(f.vcodec).split('.')[0],
      selector: hasAudio ? f.format_id : `${f.format_id}+${companion.format_id}`,
      sourceBitrate: Number(f.tbr) || 0,
    };
    if (!candidates.has(key) || record.sourceBitrate > candidates.get(key).sourceBitrate) candidates.set(key, record);
  }
  const options = [...candidates.values()].sort((a, b) => b.height - a.height || b.fps - a.fps || (a.ext === 'mp4' ? -1 : 1));
  for (const [i, f] of bestAudio.entries()) {
    if (i > 3) break;
    options.push({ id: `a-${f.format_id}`, type: 'audio', label: f.abr || f.tbr ? `${Math.round(f.abr || f.tbr)} kbps` : 'Original audio', ext: f.ext, size: fileSize(f), approximate: !!f.filesize_approx, sourceBitrate: f.abr || f.tbr || null, selector: f.format_id, codec: f.acodec, audioIncluded: true });
  }
  if (ffmpeg && bestAudio.length) {
    const f = bestAudio[0];
    options.push({ id: `mp3-${f.format_id}`, type: 'audio', label: 'MP3 · converted', ext: 'mp3', size: info.duration ? Math.round(info.duration * 192000 / 8) : null, approximate: true, sourceBitrate: f.abr || f.tbr || null, selector: f.format_id, codec: 'mp3', convert: true, audioIncluded: true });
  }
  return options;
}

export function publicInfo(info, options) {
  return {
    id: info.id, title: String(info.title || 'YouTube video').slice(0, 300),
    author: String(info.uploader || info.channel || 'YouTube').slice(0, 160),
    duration: Number(info.duration) || 0,
    thumbnail: `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
    options: options.map(({ selector, convert, ...item }) => item),
  };
}

export function safeExtractorError(raw) {
  const message = String(raw || '').toLowerCase();
  if (/sign in|sign-in|bot|cookies|age.restrict|members.only|private video/.test(message)) return 'YouTube restricted access to this video from the server. Use a download option authorized by the source, or try again later.';
  if (/unavailable|not available|removed|copyright|geo.restrict/.test(message)) return 'This video is unavailable from the server’s location.';
  if (/format.*not available|requested format/.test(message)) return 'That quality is no longer available. Analyze the link again.';
  if (/enoent|not found/.test(message)) return 'The download engine is missing. Install yt-dlp and FFmpeg on the server.';
  if (/timed out|timeout/.test(message)) return 'The video source took too long to respond. Please try again.';
  if (/file.*size|larger than|storage|enospc/.test(message)) return 'This file exceeds the server’s storage limit.';
  return 'The server could not prepare this video. Try again or check the server log.';
}

const baseArgs = ['--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-warnings', '--socket-timeout', '20', '--retries', '3', '--fragment-retries', '3', '--abort-on-unavailable-fragments', '--js-runtimes', 'node', '--no-colors'];
export class YtDlpEngine {
  constructor({ command = process.env.YTDLP_PATH || 'yt-dlp', maxBytes = 1024 * 1024 * 1024, systemCa = false } = {}) { this.command = command; this.maxBytes = maxBytes; this.args = [...baseArgs, ...(systemCa ? ['--compat-options', 'no-certifi'] : [])]; }
  async health() {
    const check = (command, flags = ['--version']) => new Promise(resolve => {
      const proc = spawn(command, flags, { stdio: ['ignore', 'pipe', 'ignore'] });
      let version = '';
      proc.stdout.on('data', data => version += data);
      proc.on('error', () => resolve(null));
      proc.on('close', code => resolve(code === 0 ? version.trim().split('\n')[0] : null));
      const timeout = setTimeout(() => { proc.kill('SIGKILL'); resolve(null); }, 5000); timeout.unref();
      proc.on('close', () => clearTimeout(timeout));
    });
    const [version, ffmpeg] = await Promise.all([check(this.command), check('ffmpeg', ['-version'])]);
    return { ready: !!version, version, ffmpeg: !!ffmpeg };
  }
  analyze(url, { signal } = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.command, [...this.args, '--dump-single-json', '--skip-download', '--', url], { signal, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', error = '', overflow = false;
      proc.stdout.on('data', data => { output += data; if (output.length > 16 * 1024 * 1024) { overflow = true; proc.kill('SIGKILL'); } });
      proc.stderr.on('data', data => { error = (error + data).slice(-12000); });
      proc.on('error', reject);
      proc.on('close', code => {
        if (code !== 0 || overflow) return reject(new Error(error || 'Metadata extraction failed'));
        try { resolve(JSON.parse(output)); } catch { reject(new Error('Invalid metadata from download engine')); }
      });
    });
  }
  download({ url, option, directory, onProgress, onFile, signal }) {
    return new Promise((resolve, reject) => {
      const args = [...this.args, '--no-simulate', '--newline', '--progress', '--progress-template', 'download:CLIPPROGRESS:{"status":%(progress.status)j,"downloaded_bytes":%(progress.downloaded_bytes|0)j,"total_bytes":%(progress.total_bytes|0)j,"total_bytes_estimate":%(progress.total_bytes_estimate|0)j,"speed":%(progress.speed|0)j,"eta":%(progress.eta|0)j,"filename":%(progress.filename)j}', '--print', 'after_move:CLIPFILE:%(filepath)s', '--concurrent-fragments', '8', '--max-filesize', String(this.maxBytes), '-f', option.selector, '-o', `${directory}/%(title).150B [%(id)s].%(ext)s`];
      if (option.convert) args.push('-x', '--audio-format', 'mp3', '--audio-quality', '192K');
      else if (option.selector.includes('+')) args.push('--merge-output-format', option.ext);
      args.push('--', url);
      const proc = spawn(this.command, args, { signal, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      const killGroup = () => { try { if (process.platform !== 'win32') process.kill(-proc.pid, 'SIGKILL'); else proc.kill('SIGKILL'); } catch {} };
      signal?.addEventListener('abort', killGroup, { once: true });
      let error = '', pending = '';
      const line = input => {
        if (input.startsWith('CLIPPROGRESS:')) { try { onProgress(JSON.parse(input.slice(13))); } catch {} }
        else if (input.startsWith('CLIPFILE:')) onFile(input.slice(9).trim());
        else if (/\[Merger\]|\[ExtractAudio\]|\[VideoConvertor\]/.test(input)) onProgress({ status: 'processing' });
      };
      const consume = data => { pending += data; const lines = pending.split(/\r?\n/); pending = lines.pop(); lines.forEach(line); };
      proc.stdout.on('data', consume);
      proc.stderr.on('data', data => { error = (error + data).slice(-12000); consume(data); });
      proc.on('error', reject);
      proc.on('close', code => { signal?.removeEventListener('abort', killGroup); if (pending) line(pending); code === 0 ? resolve() : reject(new Error(error || 'Download interrupted')); });
    });
  }
}
