import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from './core.mjs';
const scrypt = promisify(scryptCallback);
export const opaqueId = () => randomBytes(24).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function constantEqual(a, b) { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && timingSafeEqual(x, y); }
export function normalizeEmail(value) {
  if (typeof value !== 'string') throw new ApiError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email)) throw new ApiError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
  return email;
}
export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128 || Buffer.byteLength(value) > 512) throw new ApiError(400, 'Use a password between 12 and 128 characters.', 'INVALID_PASSWORD');
  return value;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$${salt}$${derived.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || Buffer.byteLength(password) > 512) return false;
  const pieces = String(encoded || '').split('$');
  if (pieces.length !== 4 || pieces[0] !== 'scrypt' || pieces[1] !== '32768' || !/^[a-f0-9]{32}$/.test(pieces[2]) || !/^[a-f0-9]{128}$/.test(pieces[3])) return false;
  const derived = await scrypt(password, pieces[2], 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(derived, Buffer.from(pieces[3], 'hex'));
}
export const csrfFor = (token, secret) => createHmac('sha256', secret).update(`csrf:${token}`).digest('base64url');
export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) { const split = part.indexOf('='); if (split > 0) cookies[part.slice(0, split).trim()] = part.slice(split + 1).trim(); }
  return cookies;
}
export function sessionCookie(config, token, clear = false) {
  return `${config.cookieName}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : config.sessionHours * 3600}${config.secureCookies ? '; Secure' : ''}`;
}
export function requireRequestOrigin(req, config) {
  if (req.headers.origin !== config.publicOrigin) throw new ApiError(403, 'Request origin is not allowed.', 'ORIGIN_REJECTED');
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'Cross-site requests are not allowed.', 'ORIGIN_REJECTED');
}
