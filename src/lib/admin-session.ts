import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Simple admin login for a handful of people, with no external auth service.
 *
 *  - ADMIN_LOGINS: JSON object of email -> password, e.g.
 *      {"press@ungaro.com":"a-long-password","second@ungaro.com":"another-one"}
 *  - SESSION_SECRET: >= 32 characters, signs the session cookie.
 *
 * A successful login sets an HttpOnly cookie holding `<payload>.<signature>`.
 * Every request re-checks that the email is still listed in ADMIN_LOGINS, so
 * removing someone from the setting locks them out straight away.
 */

/** Missing or malformed configuration. Surfaces as a 503 with a clear message. */
export class AuthConfigError extends Error {
  status = 503;
}

export const SESSION_COOKIE = 'pfw_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 32;

function loadLogins(): Map<string, string> {
  const raw = process.env.ADMIN_LOGINS;
  if (!raw || !raw.trim()) {
    throw new AuthConfigError('Admin login is not configured on this server (set ADMIN_LOGINS).');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AuthConfigError('ADMIN_LOGINS is not valid JSON. Expected {"email":"password"}.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AuthConfigError('ADMIN_LOGINS must be a JSON object of email -> password.');
  }

  const logins = new Map<string, string>();
  for (const [email, password] of Object.entries(parsed)) {
    if (typeof password !== 'string' || password.length === 0) {
      throw new AuthConfigError(`ADMIN_LOGINS: the password for ${email} must be a non-empty string.`);
    }
    logins.set(email.trim().toLowerCase(), password);
  }
  if (logins.size === 0) throw new AuthConfigError('ADMIN_LOGINS does not list anyone.');
  return logins;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** Checks an email/password pair. Compares in constant time, even for unknown emails. */
export function verifyLogin(email: unknown, password: unknown): boolean {
  const logins = loadLogins();
  if (typeof email !== 'string' || typeof password !== 'string') return false;

  const expected = logins.get(email.trim().toLowerCase());
  // Hash both sides so lengths match, and compare against a throwaway value for
  // unknown emails so the response time doesn't reveal who has an account.
  const match = timingSafeEqual(sha256(password), sha256(expected ?? '\u0000no-such-user'));
  return match && expected !== undefined;
}

/** True if the address is currently listed in ADMIN_LOGINS. */
export function isKnownAdmin(email: string): boolean {
  return loadLogins().has(email.trim().toLowerCase());
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET ?? '';
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new AuthConfigError(
      `Admin login is not configured on this server (set SESSION_SECRET to at least ${MIN_SECRET_LENGTH} characters).`,
    );
  }
  return secret;
}

function sign(payload: string): string {
  // The prefix keeps these signatures from being valid for any other purpose.
  return createHmac('sha256', getSecret()).update(`session:v1:${payload}`).digest('base64url');
}

/** Builds the cookie value for a signed-in admin. */
export function createSessionToken(email: string, nowMs: number = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ e: email.trim().toLowerCase(), x: Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns the email in a valid, unexpired session token, or null. */
export function readSessionToken(token: unknown, nowMs: number = Date.now()): string | null {
  if (typeof token !== 'string' || token.length === 0 || token.length > 1000) return null;

  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(token.slice(dot + 1));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const { e, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof e !== 'string' || typeof x !== 'number' || x <= Math.floor(nowMs / 1000)) return null;
    return e;
  } catch {
    return null;
  }
}
