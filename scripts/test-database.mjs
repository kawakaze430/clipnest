import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, chmod, chown, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.platform === 'win32' ? '.exe' : '';
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux';
const native = path.join(root, 'node_modules', '@embedded-postgres', `${platform}-${arch}`, 'native', 'bin');
const rootUser = typeof process.getuid === 'function' && process.getuid() === 0;
const withCrash = process.argv.includes('--with-crash');
const tlsOnly = process.argv.includes('--tls-only');
const withTls = tlsOnly || process.argv.includes('--with-tls');
const mode = process.argv.includes('--docker') || process.env.CLIPNEST_NATIVE_DOCKER === '1' ? 'docker' : process.env.CLIPNEST_TEST_DATABASE_MODE || 'auto';
const dockerImage = 'postgres:17-bookworm';
let directory, server, container, child, interrupted = false, logsCaptured = false;
let url = process.env.TEST_DATABASE_URL, caFile = process.env.TEST_DB_CA_FILE;
let password = '';
const sanitize = value => String(value).replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[database URL redacted]').replaceAll(password || '\0', '[redacted]');
const execAsUser = (name, args, options = {}) => spawn(rootUser ? 'runuser' : path.join(native, name + executable), rootUser ? ['-u', 'nobody', '--', path.join(native, name + executable), ...args] : args, options);

function command(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    let output = '';
    const p = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    const append = data => { output = (output + data).slice(-16000); };
    p.stdout.on('data', append); p.stderr.on('data', append);
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(output) : reject(new Error(`${path.basename(executable)} failed (exit ${code}): ${sanitize(output)}`)));
  });
}
const docker = (args, options) => command('docker', args, options);
const run = (name, args) => new Promise((resolve, reject) => {
  let output = '';
  const p = execAsUser(name, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const append = data => { output = (output + data).slice(-8000); };
  p.stdout.on('data', append); p.stderr.on('data', append);
  p.on('error', reject);
  p.on('close', code => code === 0 ? resolve(output) : reject(new Error(`${name} failed: ${sanitize(output)}`)));
});
async function freePort() {
  const s = net.createServer();
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', resolve); });
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}
function signalHandler(signal) {
  interrupted = true;
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  child?.kill(signal);
}
process.once('SIGTERM', () => signalHandler('SIGTERM'));
process.once('SIGINT', () => signalHandler('SIGINT'));

async function createCertificate() {
  caFile = path.join(directory, 'server.crt');
  const key = path.join(directory, 'server.key');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', caFile, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  await chmod(key, 0o600);
  // The certificate is public. Explicit mode is needed when the caller uses umask 077.
  await chmod(caFile, 0o644);
  return key;
}

async function startDocker() {
  await docker(['info', '--format', '{{.ServerVersion}}']);
  container = 'clipnest-native-' + randomBytes(8).toString('hex');
  const args = ['run', '-d', '--name', container, '-p', '127.0.0.1::5432', '-e', 'POSTGRES_USER=clipnest', '-e', 'POSTGRES_DB=clipnest', '-e', 'POSTGRES_PASSWORD'];
  const postgresArgs = [];
  if (withTls) {
    await createCertificate();
    await chmod(directory, 0o755);
    // Resolve ownership in the actual image; do not assume a host PostgreSQL UID.
    await docker(['run', '--rm', '--user', '0', '--mount', `type=bind,src=${directory},dst=/tls`, dockerImage, 'chown', 'postgres:postgres', '/tls/server.key']);
    args.push('--mount', `type=bind,src=${directory},dst=/tls,readonly`);
    postgresArgs.push('-c', 'ssl=on', '-c', 'ssl_cert_file=/tls/server.crt', '-c', 'ssl_key_file=/tls/server.key');
  }
  await docker([...args, dockerImage, ...postgresArgs], { env: { ...process.env, POSTGRES_PASSWORD: password } });
  const mapping = await docker(['port', container, '5432/tcp']);
  const match = mapping.trim().match(/^127\.0\.0\.1:(\d+)$/);
  if (!match) throw new Error('Disposable PostgreSQL did not receive a loopback-only mapped port');
  url = `postgresql://clipnest:${password}@${withTls ? 'localhost' : '127.0.0.1'}:${match[1]}/clipnest`;
}

async function startEmbedded() {
  const pw = path.join(directory, 'password');
  await writeFile(pw, password, { mode: 0o600 });
  if (rootUser) {
    try { await chown(directory, 65534, 65534); await chown(pw, 65534, 65534); }
    catch (error) { throw new Error('BLOCKED: native PostgreSQL needs a mapped non-root user. Use a non-root environment, CLIPNEST_TEST_DATABASE_MODE=docker with an existing daemon, or a disposable TEST_DATABASE_URL. (' + error.code + ')'); }
  }
  const data = path.join(directory, 'data');
  await run('initdb', ['-D', data, '--username=clipnest', '--auth-host=scram-sha-256', '--auth-local=trust', '--pwfile=' + pw, '--locale=C', '--encoding=UTF8', '--no-instructions']);
  const port = await freePort();
  const args = ['-D', data, '-h', withTls ? 'localhost' : '127.0.0.1', '-p', String(port), '-k', directory];
  if (withTls) {
    const key = await createCertificate();
    if (rootUser) { await chown(key, 65534, 65534); await chown(caFile, 65534, 65534); }
    args.push('-c', 'ssl=on', '-c', 'ssl_cert_file=' + caFile, '-c', 'ssl_key_file=' + key);
  }
  server = execAsUser('postgres', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stderr.on('data', data => { log = (log + data).slice(-8000); });
  server.stdout.resume();
  server.on('error', error => { log = sanitize(error.message); });
  server.startupLog = () => log;
  url = `postgresql://clipnest:${password}@${withTls ? 'localhost' : '127.0.0.1'}:${port}/postgres`;
}

try {
  if (!['auto', 'embedded', 'docker'].includes(mode)) throw new Error('CLIPNEST_TEST_DATABASE_MODE must be auto, embedded or docker');
  if (!url) {
    directory = await mkdtemp(path.join(tmpdir(), 'clipnest-pg-'));
    await chmod(directory, 0o700);
    password = randomBytes(24).toString('hex');
    const embeddedProbe = mode === 'auto' ? spawnSync(path.join(native, 'initdb' + executable), ['--version'], { encoding: 'utf8' }) : null;
    const useDocker = mode === 'docker' || (mode === 'auto' && embeddedProbe.status !== 0);
    if (mode === 'auto' && useDocker) console.log('Embedded PostgreSQL runtime unavailable; using the disposable PostgreSQL 17 Docker target.');
    if (useDocker) await startDocker(); else await startEmbedded();
    let ready = false;
    for (let i = 0; i < 100 && !interrupted; i++) {
      if (container) {
        const state = await docker(['inspect', '--format', '{{.State.Running}}', container]);
        if (state.trim() !== 'true') throw new Error('Disposable PostgreSQL container exited before readiness');
      } else if (server.exitCode !== null) throw new Error('Embedded PostgreSQL exited before readiness: ' + sanitize(server.startupLog()));
      const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 500 });
      try { await c.connect(); await c.query('SELECT 1'); ready = true; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
      finally { await c.end().catch(() => {}); }
      if (ready) break;
    }
    if (interrupted) throw new Error('Disposable PostgreSQL test interrupted');
    if (!ready) throw new Error('Disposable PostgreSQL did not become ready' + (server ? ': ' + sanitize(server.startupLog()) : ''));
  }
  const c = new pg.Client({ connectionString: url });
  try {
    await c.connect();
    const version = await c.query('SHOW server_version');
    console.log(`Real PostgreSQL ${version.rows[0].server_version} is ready (${container ? 'Docker' : server ? 'embedded' : 'explicit'} disposable test target).`);
  } finally { await c.end(); }
  if (!process.argv.includes('--probe')) {
    if (withTls && !caFile) throw new Error('--with-tls needs TEST_DB_CA_FILE for an explicitly supplied disposable database');
    const files = tlsOnly ? ['tests/tls.native.mjs'] : ['tests/database.test.mjs', 'tests/release.test.mjs', 'tests/operations.test.mjs'];
    if (withCrash && !tlsOnly) files.push('tests/crash.native.mjs');
    if (withTls && !tlsOnly) files.push('tests/tls.native.mjs');
    child = spawn(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', ...files], { cwd: root, stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: url, ...(withTls ? { TEST_DB_CA_FILE: caFile } : {}), NODE_ENV: 'test' } });
    const result = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => resolve(code ?? 1)); });
    if (!interrupted) process.exitCode = result;
  }
} catch (error) {
  console.error(sanitize(error.message));
  if (container) {
    logsCaptured = true;
    try { console.error('Disposable PostgreSQL startup log:\n' + sanitize(await docker(['logs', '--tail', '80', container]))); } catch (logError) { console.error(sanitize(logError.message)); }
  }
  process.exitCode = interrupted ? process.exitCode : 1;
} finally {
  if (container && process.exitCode && !logsCaptured) {
    try { console.error('Disposable PostgreSQL failure log:\n' + sanitize(await docker(['logs', '--tail', '80', container]))); } catch (error) { console.error(sanitize(error.message)); }
  }
  if (container) await docker(['rm', '--force', '--volumes', container]).catch(error => { console.error(sanitize(error.message)); process.exitCode ||= 1; });
  if (server && directory) await run('pg_ctl', ['-D', path.join(directory, 'data'), '-m', 'fast', '-w', 'stop']).catch(() => server.kill('SIGTERM'));
  if (directory) await rm(directory, { recursive: true, force: true });
}
