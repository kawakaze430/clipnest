export const fixture = {
  id: 'aqz-KE-bpKQ', title: 'Example Video', uploader: 'Example Creator', duration: 60,
  formats: [
    { format_id: '18', vcodec: 'avc1', acodec: 'mp4a', height: 360, fps: 30, ext: 'mp4', filesize: 10000, url: 'https://media.example/a', tbr: 500 },
    { format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080, fps: 30, ext: 'mp4', filesize: 20000, url: 'https://media.example/v', tbr: 2000 },
    { format_id: '140', vcodec: 'none', acodec: 'mp4a.40.2', ext: 'm4a', abr: 128, filesize: 3000, url: 'https://media.example/aac' },
    { format_id: '251', vcodec: 'none', acodec: 'opus', ext: 'webm', abr: 160, filesize_approx: 4000, url: 'https://media.example/opus' },
    { format_id: 'drm', vcodec: 'avc1', acodec: 'none', height: 2160, fps: 60, ext: 'mp4', has_drm: true, url: 'https://media.example/drm' },
    { format_id: 'storyboard', vcodec: 'none', acodec: 'none', ext: 'mhtml', url: 'https://media.example/storyboard' }
  ]
};
