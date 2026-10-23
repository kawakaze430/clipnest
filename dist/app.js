const $ = selector => document.querySelector(selector);
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const getStored = (storage, key, fallback = '') => { try { return storage.getItem(key) || fallback; } catch { return fallback; } };
const setStored = (storage, key, value) => { try { storage.setItem(key, value); return true; } catch { return false; } };
const safeParse = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
const newId = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
let clientId = getStored(localStorage, 'clipnest-client');
if (!/^[\w-]{24,80}$/.test(clientId)) { clientId = newId(); setStored(localStorage, 'clipnest-client', clientId); }
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const savedServer = getStored(localStorage, 'clipnest-server', local ? location.origin : '');
let server = savedServer;
let accessToken = getStored(sessionStorage, 'clipnest-token');
let authMode = 'prototype', accountUser = null, csrfToken = '', allowRegistration = false, registering = false;
let pendingDownload = null, asyncAnalysis = false, requireVerification = false, analysisTaskId = null, historyCursor = null;
let connected = false, mode = 'video', video = null, selection = null, demo = false, analyzing = false, activeJob = null, pollTimer, toastTimer, analysisController, connectionGeneration = 0;
let history = safeParse(getStored(localStorage, 'clipnest-history', '[]'), []);
if (!Array.isArray(history)) history = [];
history = history.filter(item => item && typeof item.title === 'string' && /^[\w-]{11}$/.test(item.videoId || '') && typeof item.jobId === 'string').slice(0, 20);

function bytes(value) { if (!value) return 'Size unavailable'; const units = ['B', 'KB', 'MB', 'GB']; const index = Math.min(3, Math.floor(Math.log(value) / Math.log(1024))); return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`; }
function duration(seconds) { if (!Number.isFinite(seconds) || seconds < 0) return '—'; const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = Math.floor(seconds % 60); return `${h ? `${h}:` : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`; }
function eta(seconds) { if (!Number.isFinite(seconds)) return 'Calculating time…'; if (seconds < 60) return `${Math.ceil(seconds)}s remaining`; return `${Math.ceil(seconds / 60)}m remaining`; }
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4000); }
function showError(message, setup = false) { $('#form-error').replaceChildren(document.createTextNode(message)); if (setup) { const button = document.createElement('button'); button.textContent = 'Server setup'; button.addEventListener('click', openSetup); $('#form-error').append(button); } $('#form-error').hidden = false; }
function clearError() { $('#form-error').hidden = true; }
function updateConnection(value) { connected = value; $('#connection-dot').classList.toggle('connected', value); $('#connection-label').textContent = value ? 'Server connected' : 'Connect server'; $('#disconnect-button').hidden = !server; }
function openSetup() { if (authMode === 'session') { api('/api/health',{timeout:12000}).then(async state => { updateConnection(!!state.ready); clearError(); await loadCollection(); if(activeJob)pollJob(); toast('Connection checked.'); }).catch(error => showError(error.message)); return; } $('#server-url').value = server; $('#server-token').value = accessToken; $('#connection-message').hidden = true; $('#disconnect-button').hidden = !server; $('#setup-dialog').showModal(); }

function normalizeLink(value) {
  let url; try { url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`); } catch { throw new Error('Paste a valid YouTube video link to get started.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Use a standard YouTube video link.');
  let id;
  if (url.hostname === 'youtu.be') id = url.pathname.split('/')[1];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
    const parts = url.pathname.split('/').filter(Boolean);
    id = parts[0] === 'watch' ? url.searchParams.get('v') : ['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : null;
  }
  if (!/^[\w-]{11}$/.test(id || '')) throw new Error('That doesn’t look like a video link. Try youtube.com/watch, youtu.be, or a Shorts link.');
  return `https://www.youtube.com/watch?v=${id}`;
}

async function api(endpoint, { method = 'GET', body, signal, base = server, token = accessToken, timeout = 95000, requestKey, csrfRefresh = false } = {}) {
  if (!base) throw new Error('Connect your download server first.');
  const controller = new AbortController(), abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeout);
  try {
    const headers = { 'X-Client-ID': clientId };
    const sessions = authMode === 'session' && base === location.origin;
    if (token && !sessions) headers.Authorization = `Bearer ${token}`;
    if (sessions && csrfToken && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = csrfToken;
    if (requestKey) headers['Idempotency-Key'] = requestKey;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal, credentials: sessions ? 'same-origin' : 'omit', cache: 'no-store', redirect: 'error' });
    let data;
    try { data = await response.json(); } catch { throw new Error('This address is not a ClipNest server. Check the address in Server setup.'); }
    if (!response.ok && sessions && response.status === 403 && data.code === 'CSRF_REJECTED' && !csrfRefresh) { const oldId = accountUser?.id; const session = await api('/api/auth/session'); setAccount(session); if (session.user?.id === oldId) return api(endpoint,{method,body,signal,base,token,timeout,requestKey,csrfRefresh:true}); }
    if (!response.ok) { const error = new Error(data.error || `The server returned an error (${response.status}).`); error.status = response.status; error.code = data.code; if (sessions && response.status === 401 && data.code === 'AUTH_REQUIRED') { setAccount(null); openAccount(); } throw error; }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') { const abortError = new Error(signal?.aborted ? 'Request cancelled.' : 'The server took too long to respond. Try again.'); abortError.name = 'AbortError'; throw abortError; }
    if (error instanceof TypeError) throw new Error('Couldn’t reach the server. Check its address, HTTPS, and allowed website origins in Server setup.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

function setAccount(session) {
  const previous = accountUser?.id;
  accountUser = session?.user || null; if(accountUser || previous) registering = false; csrfToken = session?.csrfToken || '';
  if (typeof session?.allowRegistration === 'boolean') allowRegistration = session.allowRegistration;
  $('#account-open').hidden = authMode !== 'session';
  $('#account-open').textContent = accountUser ? 'My account' : 'Sign in';
  $('#account-form').hidden = !!accountUser; $('#signed-in-actions').hidden = !accountUser;
  $('#signed-in-email').textContent = accountUser?.email || '';
  $('#verification-note').hidden = !accountUser || !requireVerification || accountUser.verified; $('#resend-verification').hidden = !accountUser || !requireVerification || accountUser.verified;
  $('#account-title').textContent = accountUser ? 'You’re signed in.' : registering ? 'Make it yours.' : 'Welcome back.';
  $('#account-description').textContent = accountUser ? 'Your history is saved to your account. Prepared files expire after the server’s retention window.' : 'Sign in to keep your download history and allowance with your account.';
  $('#account-toggle').hidden = !allowRegistration;
  $('#account-submit').textContent = registering ? 'Create account' : 'Sign in';
  $('#account-toggle').textContent = registering ? 'I already have an account' : 'Create an account';
  $('#account-password').autocomplete = registering ? 'new-password' : 'current-password';
  $('#clear-history').hidden = authMode === 'session' || !history.length;
  if (authMode === 'session' && previous !== accountUser?.id) {
    analysisController?.abort(); clearTimeout(pollTimer); activeJob = null; video = null; history = []; pendingDownload = null;
    sessionStorage.removeItem('clipnest-active'); if(previous || !accountUser)sessionStorage.removeItem('clipnest-analysis'); $('#result-panel').hidden = true; $('#job-panel').hidden = true; renderHistory();
  }
  $('#account-usage').hidden = authMode !== 'session';
  if (authMode === 'session' && !accountUser) $('#account-usage').textContent = 'Sign in to check real qualities and prepare a download.';
  if (authMode === 'session') renderHistory();
}
function openAccount() { if (authMode !== 'session') return; $('#account-error').hidden = true; setAccount({user:accountUser,csrfToken}); if (!$('#account-dialog').open) $('#account-dialog').showModal(); }
async function loadCollection(more = false) {
  if (authMode !== 'session' || !accountUser) return;
  const owner = accountUser.id;
  const [collection, usage] = await Promise.all([api('/api/jobs?limit=20'+(more && historyCursor ? '&cursor='+encodeURIComponent(historyCursor) : '')), api('/api/usage')]);
  if (accountUser?.id !== owner) return;
  const mapped = collection.items.map(job => ({...job,jobId:job.id,server,status:job.status,size:job.total,preparedAt:Date.parse(job.createdAt)}));
  history = more ? [...history,...mapped.filter(item=>!history.some(old=>old.jobId===item.jobId))] : mapped; historyCursor = collection.nextCursor; $('#history-more').hidden = !historyCursor;
  renderHistory();
  $('#account-usage').textContent = `${usage.jobsStarted} / ${usage.dailyJobLimit} daily requests used · ${usage.bytesCompleted ? bytes(usage.bytesCompleted) : '0 B'} prepared · Resets at 00:00 UTC`;
  if (!activeJob) {
    const running = collection.items.find(job => ['queued','downloading','processing'].includes(job.status));
    if (running) { activeJob = {...running,source:server}; renderJob(); pollJob(); }
  }
}
$('#account-open').addEventListener('click', openAccount);
$('#history-more').addEventListener('click',()=>loadCollection(true).catch(error=>toast(error.message)));
$('#resend-verification').addEventListener('click',async()=>{try{await api('/api/auth/resend',{method:'POST'});toast('If verification is needed, an email will be sent.');}catch(error){toast(error.message);}});
$('#cancel-analysis').addEventListener('click',()=>analysisController?.abort());
$('#account-close').addEventListener('click', () => $('#account-dialog').close());
$('#account-toggle').addEventListener('click', () => { registering = !registering; setAccount({user:accountUser,csrfToken}); });
$('#account-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#account-submit'); button.disabled = true; $('#account-error').hidden = true;
  try {
    const session = await api(`/api/auth/${registering ? 'register' : 'login'}`, {method:'POST',body:{email:$('#account-email').value,password:$('#account-password').value}});
    $('#account-password').value = ''; setAccount(session); $('#account-dialog').close();
    await loadCollection(); toast('You’re signed in. Your collection is ready.');
  } catch (error) { $('#account-error').textContent = error.message; $('#account-error').hidden = false; }
  finally { button.disabled = false; }
});
$('#account-logout').addEventListener('click', async () => {
  const button = $('#account-logout'); button.disabled = true;
  try { await api('/api/auth/logout',{method:'POST'}); setAccount(null); $('#account-dialog').close(); toast('Signed out.'); }
  catch (error) { toast(error.message); } finally { button.disabled = false; }
});

function setMode(next) {
  mode = next;
  for (const button of document.querySelectorAll('.mode-tab')) { const selected = button.dataset.mode === mode; button.classList.toggle('active', selected); button.setAttribute('aria-selected', selected); button.tabIndex = selected ? 0 : -1; }
  $('#result-panel').setAttribute('aria-labelledby', `tab-${mode}`);
  if (video) renderResult();
}
function addImageFallbacks(container) {
  for (const img of container.querySelectorAll('img')) img.addEventListener('error', () => { if (!img.src.endsWith('/thumbnail-fallback.svg')) { img.src = '/thumbnail-fallback.svg'; img.alt = 'Video thumbnail unavailable'; } }, { once: true });
}
function renderResult() {
  if (!video) return;
  const panel = $('#result-panel'); panel.hidden = false;
  const options = video.options.filter(option => option.type === mode);
  if (!options.some(option => option.id === selection)) selection = options.find(option => option.ext === (mode === 'video' ? 'mp4' : 'm4a'))?.id || options[0]?.id;
  const selected = options.find(option => option.id === selection);
  panel.innerHTML = `<div class="result-top"><img class="video-thumb" src="${demo ? '/thumbnail-fallback.svg' : `https://i.ytimg.com/vi/${escape(video.id)}/hqdefault.jpg`}" alt="${demo ? 'Illustrative landscape for the interface preview' : `Thumbnail of ${escape(video.title)}`}" referrerpolicy="no-referrer"><div class="video-details"><span class="result-badge ${demo ? 'demo' : ''}">${demo ? 'INTERFACE PREVIEW' : 'VIDEO FOUND'}</span><h3>${escape(video.title)}</h3><div class="video-meta"><span>${escape(video.author)}</span><span>${icon('clock')}${duration(video.duration)}</span><span>${mode === 'video' ? 'Video + audio' : 'Audio only'}</span></div></div></div><div class="result-controls"><h4>${mode === 'video' ? 'Choose your quality' : 'Choose your audio'}</h4><span>${demo ? 'Illustrative options' : `${options.length} available ${options.length === 1 ? 'option' : 'options'}`}</span></div><div class="format-list" role="radiogroup" aria-label="Available download qualities">${options.map(option => `<button class="format-card ${selection === option.id ? 'selected' : ''}" role="radio" aria-checked="${selection === option.id}" tabindex="${selection === option.id ? '0' : '-1'}" data-option="${escape(option.id)}"><span class="format-radio"></span><span><span class="format-title">${escape(option.label)}</span><span class="format-detail">${escape(option.ext)} · ${mode === 'video' ? 'Audio included' : escape(option.codec || 'Audio')}</span></span><span class="format-size">${option.approximate ? '~' : ''}${bytes(option.size)}</span></button>`).join('')}</div>${options.length ? `<p class="format-info">${icon('info')}${mode === 'audio' ? 'MP3 is converted from the source audio; conversion does not increase its quality.' : 'Quality comes from the original upload. Video and audio are combined when needed.'} Approximate sizes are marked ~.</p><div class="download-action"><span>${selected ? `${escape(selected.label)} · ${escape(selected.ext.toUpperCase())} · ${selected.approximate ? '~' : ''}${bytes(selected.size)}` : ''}</span><button id="start-download" class="primary-button" ${activeJob && !['ready', 'failed', 'cancelled', 'expired'].includes(activeJob.status) ? 'disabled' : ''}>${icon('down')} ${demo ? 'Connect to download' : 'Prepare download'}</button></div>` : '<div class="no-options">No audio-only formats were returned for this video. Try the Video tab.</div>'}${demo ? '<div class="demo-note">This is a sample of the quality picker. No video has been fetched and these are not live formats. <button id="demo-connect">Connect your server to use a real link.</button></div>' : ''}`;
  addImageFallbacks(panel);
  panel.querySelectorAll('[data-option]').forEach(button => {
    button.addEventListener('click', () => { selection = button.dataset.option; renderResult(); panel.querySelector(`[data-option="${CSS.escape(selection)}"]`)?.focus({ preventScroll: true }); });
    button.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault(); const index = options.findIndex(option => option.id === selection); const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
      selection = options[(index + step + options.length) % options.length].id; renderResult(); panel.querySelector(`[data-option="${CSS.escape(selection)}"]`)?.focus({ preventScroll: true });
    });
  });
  $('#start-download')?.addEventListener('click', demo ? openSetup : startDownload);
  $('#demo-connect')?.addEventListener('click', openSetup);
}

async function analyze(event) {
  event?.preventDefault();
  if (analyzing) return;
  clearError();
  let url;
  try { url = normalizeLink($('#video-url').value); } catch (error) { showError(error.message); $('#video-url').focus(); return; }
  if (activeJob && !['ready', 'failed', 'cancelled', 'expired'].includes(activeJob.status)) { showError('Finish or cancel your current download before checking another video.'); return; }
  if (!connected) { showError('Connect the included download server to discover this video’s available qualities.', true); return; }
  if (authMode === 'session' && !accountUser) { openAccount(); return; }
  if (authMode === 'session' && accountUser && requireVerification && !accountUser.verified) { showError('Verify your email to prepare a download.'); openAccount(); return; }
  analyzing = true; video = null; demo = false; activeJob = null; clearTimeout(pollTimer); $('#result-panel').hidden = true; $('#job-panel').hidden = true;
  const button = $('#analyze-button'); button.disabled = true; button.innerHTML = '<span class="spinner"></span><span>Checking video</span>';
  analysisController = new AbortController(); $('#cancel-analysis').hidden = false;
  try {
    let result; const owner = accountUser?.id;
    if (authMode === 'session' && asyncAnalysis) { const task = await api('/api/analyses',{method:'POST',body:{url},signal:analysisController.signal}); analysisTaskId = task.id; setStored(sessionStorage,'clipnest-analysis',JSON.stringify({id:task.id,owner,url,source:server})); result = await waitForAnalysis(task.id,analysisController.signal); } else result = await api('/api/analyze', { method: 'POST', body: { url }, signal: analysisController.signal });
    if(authMode === 'session' && owner !== accountUser?.id) return;
    if (!/^[\w-]{11}$/.test(result.id || '') || !Array.isArray(result.options) || !result.analysisId) throw new Error('The server returned incomplete video details.');
    video = result; selection = null; renderResult(); $('#video-url').value = url;
    if (window.innerWidth < 720) $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) { if (analysisController?.signal.aborted) { if(analysisTaskId && accountUser) api('/api/analyses/'+analysisTaskId,{method:'DELETE'}).catch(()=>{}); toast('Video check cancelled.'); } else { if (error.status === 401 && authMode !== 'session') updateConnection(false); showError(error.message, error.status === 401 && authMode !== 'session'); } }
  finally { analyzing = false; analysisTaskId = null; sessionStorage.removeItem('clipnest-analysis'); $('#cancel-analysis').hidden = true; button.disabled = false; button.innerHTML = `<span>Find video</span>${icon('arrow')}`; }
}

async function waitForAnalysis(id,signal) { for (;;) { if(signal.aborted) throw new DOMException('Cancelled','AbortError'); const task = await api('/api/analyses/'+encodeURIComponent(id),{signal,timeout:15000}); if(task.status === 'ready') { if(!task.result) throw new Error('These qualities expired. Check the link again.'); return task.result; } if(['failed','cancelled'].includes(task.status)) throw new Error(task.error || 'Video check cancelled.'); $('#analyze-button').textContent = task.status === 'queued' ? 'Waiting to check…' : 'Checking video…'; await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},750);signal.addEventListener('abort',abort,{once:true});}); } }

async function startDownload() {
  if (!video || demo || !selection) return;
  clearError();
  const button = $('#start-download'); if (button) { button.disabled = true; button.innerHTML = '<span class="spinner"></span> Starting…'; }
  try {
    const choice = `${video.analysisId}:${selection}`;
    if (!pendingDownload || pendingDownload.choice !== choice) pendingDownload = {choice,key:newId()};
    const job = await api('/api/jobs', { method: 'POST', body: { analysisId: video.analysisId, optionId: selection }, requestKey: pendingDownload.key });
    pendingDownload = null;
    activeJob = { ...job, source: server, videoId: video.id, author: video.author, quality: video.options.find(o => o.id === selection)?.label };
    setStored(sessionStorage, 'clipnest-active', JSON.stringify(activeJob));
    renderJob(); renderResult(); pollJob(); if (authMode === 'session') loadCollection().catch(error => toast(error.message));
  } catch (error) { if (error.status && error.status < 500 && error.status !== 429) pendingDownload = null; showError(error.message); renderResult(); }
}
function remember(job) {
  if (authMode === 'session') { loadCollection().catch(error => toast(error.message)); return; }
  if (history.some(item => item.jobId === job.id && item.server === job.source)) return;
  history.unshift({ title: job.title || video?.title || 'Video', videoId: job.videoId, quality: job.quality, ext: job.ext, size: job.total, preparedAt: Date.now(), expiresAt: job.expiresAt, jobId: job.id, server: job.source });
  history = history.slice(0, 20); setStored(localStorage, 'clipnest-history', JSON.stringify(history)); renderHistory();
}
function renderJob() {
  if (!activeJob) return;
  const job = activeJob, panel = $('#job-panel'); panel.hidden = false;
  if (job.status === 'ready') {
    panel.innerHTML = `<div class="job-ready"><div><span class="ready-mark">${icon('check')}</span><div><strong>Your video is ready to go.</strong><p>${bytes(job.total)} · ${escape(job.ext.toUpperCase())} · Save before the server file expires.</p></div></div><button id="save-file" class="primary-button">${icon('down')}Save to device</button></div>`;
    $('#save-file').addEventListener('click', () => saveFile(job.id));
  } else if (['failed', 'cancelled', 'expired'].includes(job.status)) {
    panel.innerHTML = `<div class="job-heading">${icon('info')}<strong>${escape(job.status === 'cancelled' ? 'Download cancelled' : 'Couldn’t prepare this download')}</strong></div><p class="format-info">${escape(job.error || 'You can try preparing the file again.')}</p>`;
  } else {
    const percent = Number.isFinite(job.progress) ? Math.round(job.progress) : null;
    panel.innerHTML = `<div class="job-heading"><span class="spinner"></span><strong>${escape(job.phase || 'Preparing your download')}</strong><span class="job-percent">${percent === null ? 'Working…' : `${percent}%`}</span></div><div class="job-track ${percent === null ? 'indeterminate' : ''}" role="progressbar" aria-label="Download to server" ${percent === null ? '' : `aria-valuenow="${percent}"`} aria-valuemin="0" aria-valuemax="100"><span ></span></div><div class="job-details"><span>${bytes(job.downloaded)}${job.total ? ` / ${bytes(job.total)}` : ''}</span><span>${job.speed ? `${bytes(job.speed)}/s` : 'Preparing…'}</span><span>${eta(job.eta)}</span><button id="cancel-job">Cancel</button></div><p class="format-info">Fetching the file to your server. You’ll save it to your device when it’s ready.</p>`;
    // Avoid inline styles under a self-hosted strict Content Security Policy.
    if (percent !== null) panel.querySelector('.job-track>span').style.width = `${percent}%`;
    $('#cancel-job').addEventListener('click', async () => { $('#cancel-job').disabled = true; try { const next = await api(`/api/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' }); if (activeJob?.id !== job.id) return; Object.assign(activeJob, next); clearTimeout(pollTimer); renderJob(); renderResult(); if (['cancelled','failed','expired'].includes(next.status)) { sessionStorage.removeItem('clipnest-active'); if (authMode === 'session') await loadCollection(); } else pollJob(); } catch (error) { toast(error.message); const button = $('#cancel-job'); if (button) button.disabled = false; } });
  }
}
async function pollJob() {
  if (!activeJob || activeJob.source !== server || !connected) return;
  const id = activeJob.id;
  try {
    const next = await api(`/api/jobs/${encodeURIComponent(id)}`, { timeout: 15000 });
    if (!activeJob || activeJob.id !== id) return;
    Object.assign(activeJob, next); renderJob();
    if (next.status === 'ready') { remember(activeJob); sessionStorage.removeItem('clipnest-active'); renderResult(); toast('Your file is ready. Save it to your device.'); return; }
    if (['failed', 'cancelled', 'expired'].includes(next.status)) { sessionStorage.removeItem('clipnest-active'); renderResult(); if (authMode === 'session') loadCollection().catch(error => toast(error.message)); return; }
    setStored(sessionStorage, 'clipnest-active', JSON.stringify(activeJob)); pollTimer = setTimeout(pollJob, 1000);
  } catch (error) {
    if (error.status === 404) { activeJob.status = 'failed'; activeJob.error = error.message; renderJob(); renderResult(); sessionStorage.removeItem('clipnest-active'); return; }
    if (authMode === 'session' && error.status === 401) return;
    showError(`Progress updates paused: ${error.message} Reconnect the server to resume.`, true);
    updateConnection(false);
  }
}
async function saveFile(jobId, item) {
  if (!connected || (item && item.server !== server)) { toast('Connect the same server used to prepare this file.'); openSetup(); return; }
  const button = $('#save-file'); if (button) button.disabled = true;
  try {
    const ticket = await api(`/api/jobs/${encodeURIComponent(jobId)}/ticket`, { method: 'POST' });
    if (!/^\/api\/files\/[\w-]{32}$/.test(ticket.path || '')) throw new Error('The server returned an invalid download link.');
    const link = document.createElement('a'); link.href = `${server}${ticket.path}`; link.download = ticket.filename || 'video'; link.rel = 'noreferrer'; document.body.append(link); link.click(); link.remove();
    toast('File sent to your browser. Check your downloads.');
  } catch (error) { toast(error.message); }
  finally { if (button) button.disabled = false; }
}
function itemReady(item) { return (!item.status || item.status === 'ready') && Date.now() < item.expiresAt; }
function renderHistory() {
  $('#recent-count').textContent = String(history.length);
  $('#clear-history').hidden = authMode === 'session' || history.length === 0;
  if (!history.length) { $('#history-list').innerHTML = `<div class="empty-history"><span class="empty-icon">${icon('clock')}</span><div><h3>Make room for your favorites.</h3><p>${authMode === 'session' ? accountUser ? 'Your download history is saved to your account.' : 'Sign in to see your download history.' : 'Your prepared downloads will appear here. History stays in this browser.'}</p></div><span class="empty-doodle">↗</span></div>`; return; }
  $('#history-list').innerHTML = (authMode === 'session' ? history : history.slice(0,6)).map((item, index) => `<article class="history-row"><img src="https://i.ytimg.com/vi/${escape(item.videoId)}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"><div class="history-content"><h3>${escape(item.title)}</h3><p>${escape(item.quality || 'Original')} · ${escape((item.ext || '').toUpperCase())} · ${bytes(item.size)} · ${itemReady(item) ? 'Ready on server' : escape(item.status && item.status !== 'ready' ? item.status : 'Server file expired')}</p></div><button data-history="${index}" aria-label="${itemReady(item) ? 'Save' : 'Prepare again'} ${escape(item.title)}">${icon(itemReady(item) ? 'down' : 'arrow')}</button></article>`).join('');
  addImageFallbacks($('#history-list'));
  $('#history-list').querySelectorAll('[data-history]').forEach(button => button.addEventListener('click', () => {
    const item = history[Number(button.dataset.history)];
    if (itemReady(item)) saveFile(item.jobId, item);
    else { $('#video-url').value = `https://www.youtube.com/watch?v=${item.videoId}`; $('#downloader').scrollIntoView({ behavior: 'smooth' }); analyze(); }
  }));
}

$('#link-form').addEventListener('submit', analyze);
$('#paste-button').addEventListener('click', async () => { try { if (!navigator.clipboard?.readText) throw new Error(); $('#video-url').value = await navigator.clipboard.readText(); $('#video-url').focus(); clearError(); } catch { toast('Use Ctrl+V or ⌘+V to paste your link.'); $('#video-url').focus(); } });
$('#video-url').addEventListener('input', () => { clearError(); if (video && !analyzing) { video = null; $('#result-panel').hidden = true; } });
for (const button of document.querySelectorAll('.mode-tab')) { button.addEventListener('click', () => setMode(button.dataset.mode)); button.addEventListener('keydown', event => { if (['ArrowRight', 'ArrowLeft'].includes(event.key)) { event.preventDefault(); setMode(mode === 'video' ? 'audio' : 'video'); $(`#tab-${mode}`).focus(); } }); }
$('#sample-button').addEventListener('click', () => {
  if (analyzing || activeJob && !['ready', 'failed', 'cancelled', 'expired'].includes(activeJob.status)) { toast('Finish your current request before opening the preview.'); return; }
  clearError(); demo = true; selection = null; activeJob = null; $('#job-panel').hidden = true;
  video = { id: 'aqz-KE-bpKQ', title: 'Big Buck Bunny — an offline little adventure', author: 'Blender Foundation · sample preview', duration: 634, options: [
    { id: 'sample1080', type: 'video', label: '1080p', ext: 'mp4', size: 250 * 1024 ** 2, approximate: true },
    { id: 'sample720', type: 'video', label: '720p', ext: 'mp4', size: 125 * 1024 ** 2, approximate: true },
    { id: 'sample480', type: 'video', label: '480p', ext: 'mp4', size: 68 * 1024 ** 2, approximate: true },
    { id: 'sampleaudio', type: 'audio', label: 'Original audio', ext: 'm4a', size: 10 * 1024 ** 2, codec: 'AAC', approximate: true },
    { id: 'samplemp3', type: 'audio', label: 'MP3 · converted', ext: 'mp3', size: 15 * 1024 ** 2, codec: 'MP3', approximate: true }
  ] };
  renderResult(); $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('#setup-open').addEventListener('click', openSetup);
$('#setup-close').addEventListener('click', () => $('#setup-dialog').close());
$('#about-button').addEventListener('click', () => $('#about-dialog').showModal());
$('#about-close').addEventListener('click', () => $('#about-dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { const bounds = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close(); });
$('#copy-command').addEventListener('click', async () => { try { await navigator.clipboard.writeText('node scripts/init-local.mjs && docker compose up --build -d'); toast('Command copied.'); } catch { toast('Select and copy the command above.'); } });
$('#clear-history').addEventListener('click', () => { if (authMode === 'session') return; history = []; setStored(localStorage, 'clipnest-history', '[]'); renderHistory(); toast('Browser history cleared.'); });
$('#disconnect-button').addEventListener('click', () => {
  if (activeJob && !['ready', 'failed', 'cancelled', 'expired'].includes(activeJob.status)) { toast('Cancel your current download before disconnecting.'); return; }
  connectionGeneration++; clearTimeout(pollTimer); if (authMode === 'session') setAccount(null); authMode = 'prototype'; setAccount(null); server = ''; accessToken = ''; updateConnection(false); setStored(localStorage, 'clipnest-server', ''); setStored(sessionStorage, 'clipnest-token', ''); $('#server-url').value = ''; $('#server-token').value = ''; $('#setup-dialog').close(); toast('Server disconnected.');
});
$('#connection-form').addEventListener('submit', async event => {
  event.preventDefault();
  const message = $('#connection-message'), button = $('#connect-button');
  message.hidden = true;
  let nextServer, nextToken = $('#server-token').value.trim();
  try {
    const raw = $('#server-url').value.trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol) || url.pathname !== '/') throw new Error('Enter the server’s origin only, for example https://server.example.');
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Use HTTPS for a remote server. For local use, open http://localhost:8787.');
    nextServer = url.origin;
    if (activeJob && !['ready', 'failed', 'cancelled', 'expired'].includes(activeJob.status) && nextServer !== server) throw new Error('Cancel your current download before switching servers.');
    button.disabled = true; button.innerHTML = '<span class="spinner"></span> Connecting…';
    const generation = ++connectionGeneration;
    const status = await api('/api/health', { base: nextServer, token: nextToken, timeout: 15000 });
    if (generation !== connectionGeneration) return;
    if (status.service !== 'clipnest' || status.protocol !== 1) throw new Error('This address is not a compatible ClipNest server.');
    if (status.authMode === 'session' && nextServer !== location.origin) throw new Error('This server uses account sessions. Open its website address directly to sign in.');
    if (!status.ready) throw new Error('Server reached, but a required service is unavailable. Check server readiness.');
    const changed = server !== nextServer;
    server = nextServer; accessToken = nextToken; if (status.authMode === 'session') { authMode = 'session'; setAccount(await api('/api/auth/session')); await loadCollection(); } setStored(localStorage, 'clipnest-server', server); setStored(sessionStorage, 'clipnest-token', accessToken); updateConnection(true);
    if (changed) { video = null; $('#result-panel').hidden = true; activeJob = null; $('#job-panel').hidden = true; }
    message.textContent = `Connected. ${status.ffmpeg ? 'Video merging and MP3 conversion are ready.' : 'Install FFmpeg to enable video merging and MP3 conversion.'}`;
    message.className = 'connection-message success'; message.hidden = false; toast('Your download server is connected.');
    if (activeJob && !['ready', 'failed', 'cancelled', 'expired'].includes(activeJob.status)) pollJob();
    setTimeout(() => { if (connected && $('#setup-dialog').open) $('#setup-dialog').close(); }, 1400);
  } catch (error) { message.textContent = error.message; message.className = 'connection-message'; message.hidden = false; }
  finally { button.disabled = false; button.innerHTML = `Test & connect${icon('arrow')}`; }
});

renderHistory(); setMode('video'); updateConnection(false);
async function initializeConnection() {
  try {
    const config = await api('/api/config', {base:location.origin,timeout:8000});
    if (config.service === 'clipnest' && config.authMode === 'session') {
      server = location.origin; authMode = 'session'; asyncAnalysis = !!config.asyncAnalysis; requireVerification = !!config.requireEmailVerification; allowRegistration = config.allowRegistration; accessToken = '';
      history = []; setAccount(await api('/api/auth/session'));
      try { const health = await api('/api/health', {timeout:12000}); updateConnection(!!health.ready); }
      catch { updateConnection(false); showError('The server is online, but its download engine is unavailable. Your account and history are still available.'); }
      await loadCollection(); const pending = safeParse(getStored(sessionStorage,'clipnest-analysis'),null); if(pending && pending.owner === accountUser?.id && pending.source === server && !activeJob && /^[\w-]{32}$/.test(pending.id)) { analyzing = true; analysisController = new AbortController(); $('#cancel-analysis').hidden = false; try { video = await waitForAnalysis(pending.id,analysisController.signal); selection=null; renderResult(); } catch(error) { showError(error.message); } finally { analyzing=false; $('#cancel-analysis').hidden=true; $('#analyze-button').innerHTML=`<span>Find video</span>${icon('arrow')}`; sessionStorage.removeItem('clipnest-analysis'); } } return;
    }
  } catch (error) { if (authMode === 'session') { showError(error.message); return; } }
  if (!server) return;
  const generation = connectionGeneration;
  api('/api/health', { timeout: 12000 }).then(status => {
    if (generation !== connectionGeneration || status.service !== 'clipnest' || !status.ready) return;
    updateConnection(true);
    const savedJob = safeParse(getStored(sessionStorage, 'clipnest-active'), null);
    if (savedJob && savedJob.source === server && /^[\w-]{32}$/.test(savedJob.id || '')) { activeJob = savedJob; renderJob(); pollJob(); }
  }).catch(() => updateConnection(false));
}
initializeConnection();
