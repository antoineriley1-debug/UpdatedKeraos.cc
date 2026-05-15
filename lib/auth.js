// Self-contained auth using Node's built-in crypto (no external deps).
// Users are stored in the USERS env var as JSON. Passwords are scrypt-hashed.
// Sessions are HMAC-signed cookies — stateless, no DB needed.

import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'priority-session';
const SESSION_DAYS = 30;

// ============================================================
// PASSWORD HASHING (scrypt)
// ============================================================

// Returns a string `salt:hash` (both hex) suitable for storing.
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Returns true if the password matches the stored hash.
export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ============================================================
// USER STORE (from env var)
// ============================================================

// USERS env var format: JSON array of { email, name, passwordHash, role }
function getUsers() {
  const raw = process.env.USERS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('USERS env var is not valid JSON');
    return [];
  }
}

export function getUserByEmail(email) {
  if (!email) return null;
  const norm = String(email).toLowerCase().trim();
  return getUsers().find(u => String(u.email).toLowerCase().trim() === norm) || null;
}

// ============================================================
// SESSION COOKIES (HMAC signed, stateless)
// ============================================================

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET must be set and at least 16 chars');
  }
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

// Returns the cookie value to set: `email:expiresAt:signature`
export function createSession(email) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${email}:${expiresAt}`;
  return `${payload}:${sign(payload)}`;
}

// Returns the user object for the current request, or null.
export function getSessionUser() {
  const value = cookies().get(COOKIE_NAME)?.value;
  if (!value) return null;

  const parts = value.split(':');
  if (parts.length !== 3) return null;
  const [email, expiresAt, signature] = parts;

  // Verify signature with constant-time compare
  const expected = sign(`${email}:${expiresAt}`);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  if (Date.now() > Number(expiresAt)) return null;

  // Look up user fresh — removing them from USERS env immediately revokes access
  const user = getUserByEmail(email);
  if (!user) return null;

  return { email: user.email, name: user.name, role: user.role || 'user' };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_COOKIE_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
