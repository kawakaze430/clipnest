import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeYouTubeUrl, buildOptions, safeExtractorError } from '../backend/core.mjs';

import { fixture } from './fixtures.mjs';


test('accepts YouTube video and Shorts variants and strips tracking', () => {
  for (const url of ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&list=foo', 'youtu.be/aqz-KE-bpKQ?t=20', 'https://m.youtube.com/shorts/aqz-KE-bpKQ', 'https://music.youtube.com/watch?v=aqz-KE-bpKQ', 'https://www.youtube.com/live/aqz-KE-bpKQ']) assert.equal(normalizeYouTubeUrl(url), 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
});
test('rejects SSRF hosts, credentials, ports, malformed IDs, playlists and command text', () => {
  for (const url of ['https://127.0.0.1/watch?v=aqz-KE-bpKQ', 'https://youtube.com.evil.example/watch?v=aqz-KE-bpKQ', 'https://user:pass@youtube.com/watch?v=aqz-KE-bpKQ', 'https://youtube.com:8080/watch?v=aqz-KE-bpKQ', 'https://www.youtube.com/playlist?list=foo', 'https://www.youtube.com/watch?v=../secret', '--exec touch /tmp/evil', 'file:///etc/passwd']) assert.throws(() => normalizeYouTubeUrl(url));
});
test('only lists available real formats, pairs compatible audio, excludes DRM', () => {
  const options = buildOptions(fixture);
  const full = options.find(o => o.label === '1080p');
  assert.equal(full.selector, '137+140'); assert.equal(full.ext, 'mp4'); assert.equal(full.size, 23000);
  assert.ok(options.find(o => o.label === '360p'));
  assert.ok(!options.some(o => o.height === 2160 || o.height === 720));
  assert.ok(options.find(o => o.ext === 'mp3').approximate);
});
test('missing FFmpeg removes separate video tracks and MP3, preserves original playable media', () => {
  const options = buildOptions(fixture, { ffmpeg: false });
  assert.ok(!options.some(o => o.height === 1080 || o.ext === 'mp3'));
  assert.ok(options.some(o => o.height === 360));
  assert.ok(options.some(o => o.ext === 'm4a'));
});
test('rejects arbitrary selectors, unsafe protocols, and video-only without audio', () => {
  const info = structuredClone(fixture);
  info.formats.push({ format_id: 'bad+anything', vcodec: 'avc1', acodec: 'aac', ext: 'mp4', height: 9999, url: 'https://example/a' });
  info.formats.push({ format_id: 'bad', vcodec: 'avc1', acodec: 'aac', ext: 'mp4', height: 9998, url: 'file:///etc/passwd' });
  assert.ok(!buildOptions(info).some(o => o.height > 1080));
  assert.equal(buildOptions({ formats: [info.formats[1]] }).length, 0);
});
test('errors do not expose file paths or internal extractor data', () => {
  assert.match(safeExtractorError('Sign in to confirm you are not a bot, session=secret'), /restricted access/);
  assert.ok(!safeExtractorError('/home/private/cookies').includes('/home/'));
});
