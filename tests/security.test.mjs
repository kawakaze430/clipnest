import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../backend/config.mjs';
import { hashPassword, verifyPassword, normalizeEmail, validatePassword, digest, opaqueId, csrfFor, parseCookies, sessionCookie } from '../backend/security.mjs';

test('production fails closed on missing database, weak secrets, insecure origin and TLS', () => {
  assert.throws(() => loadConfig({ NODE_ENV:'production' }), /HTTPS/);
  const valid={ NODE_ENV:'production', PUBLIC_ORIGIN:'https://clip.example', DATABASE_URL:'postgresql://localhost/test', MAIL_FROM:'test@example.test', ALLOW_SHARED_LOCAL_STORAGE:'true', SESSION_SECRET:'x'.repeat(40) };
  assert.equal(loadConfig(valid).inlineWorker,false);
  assert.equal(loadConfig(valid).allowRegistration,false);
  assert.throws(() => loadConfig({...valid,DATABASE_URL:''}),/DATABASE_URL/);
  assert.throws(() => loadConfig({...valid,SESSION_SECRET:'weak'}),/SESSION_SECRET/);
  assert.throws(() => loadConfig({...valid,DB_TLS:'disable'}),/TLS/);
  assert.throws(() => loadConfig({...valid,DATABASE_URL:valid.DATABASE_URL+'?sslmode=no-verify'}),/SSL parameters/);
  assert.throws(() => loadConfig({...valid,COOKIE_SECURE:'false'}),/secure/);
  assert.throws(() => loadConfig({MAX_CONCURRENT_JOBS:'NaN'}),/integer/);
  assert.throws(() => loadConfig({PUBLIC_ORIGIN:'https://clip.example/path'}),/origin/);
});
test('password verification, normalized identity, opaque tokens and session cookie policy', async () => {
  assert.equal(normalizeEmail('  PERSON@EXAMPLE.COM '),'person@example.com');
  assert.throws(() => validatePassword('short'));
  const hashed=await hashPassword('a long test password');
  assert.equal(await verifyPassword('a long test password',hashed),true);
  assert.equal(await verifyPassword('wrong password',hashed),false);
  assert.equal(await verifyPassword('anything','broken'),false);
  const token=opaqueId(); assert.match(token,/^[\w-]{32}$/); assert.equal(digest(token).length,64);
  assert.notEqual(csrfFor(token,'secret-a'),csrfFor(token,'secret-b'));
  const config=loadConfig({COOKIE_SECURE:'true'});
  assert.match(sessionCookie(config,token),/^__Host-clipnest=.*HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal(parseCookies(`x=y; ${config.cookieName}=${token}`)[config.cookieName],token);
});
