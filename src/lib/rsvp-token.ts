import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed RSVP links.
 *
 * A guest's Firestore ID is also what their QR code encodes, so it must not be
 * enough, on its own, to open (or confirm) their RSVP. Links carry
 * `<guestId>.<signature>` instead, where the signature is an HMAC of the ID
 * made with RSVP_LINK_SECRET. The server recomputes it, so nothing is stored.
 *
 * Links issued before this change are bare guest IDs. They keep working until
 * RSVP_ALLOW_LEGACY_LINKS=false is set.
 */

/** Thrown when RSVP_LINK_SECRET is missing or too short. Surfaces as a 503. */
export class RsvpConfigError extends Error {
  status = 503;
}

// Firestore auto-IDs are alphanumeric; this also rules out path tricks like "a/b".
const GUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MIN_SECRET_LENGTH = 32;

function getSecret(): string {
  const secret = process.env.RSVP_LINK_SECRET ?? '';
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new RsvpConfigError(
      `RSVP links are not configured on this server (set RSVP_LINK_SECRET to at least ${MIN_SECRET_LENGTH} characters).`,
    );
  }
  return secret;
}

function sign(guestId: string): string {
  // The prefix keeps these signatures from being valid for any other purpose.
  return createHmac('sha256', getSecret()).update(`rsvp:v1:${guestId}`).digest('base64url');
}

/** Throws RsvpConfigError up front, so callers can fail before doing any work. */
export function requireRsvpSecret(): void {
  getSecret();
}

/** Builds the `<guestId>.<signature>` token used in RSVP URLs. */
export function signGuestToken(guestId: string): string {
  if (!GUEST_ID_PATTERN.test(guestId)) throw new Error('Invalid guest id');
  return `${guestId}.${sign(guestId)}`;
}

function legacyLinksAllowed(): boolean {
  return process.env.RSVP_ALLOW_LEGACY_LINKS !== 'false';
}

/**
 * Returns the guest ID for a valid token, or null. Also accepts a bare guest ID
 * (a pre-signing link) unless RSVP_ALLOW_LEGACY_LINKS=false.
 */
export function resolveGuestId(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) return null;

  const dot = raw.indexOf('.');
  if (dot === -1) {
    return legacyLinksAllowed() && GUEST_ID_PATTERN.test(raw) ? raw : null;
  }

  const guestId = raw.slice(0, dot);
  if (!GUEST_ID_PATTERN.test(guestId)) return null;

  const expected = Buffer.from(sign(guestId));
  const given = Buffer.from(raw.slice(dot + 1));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return guestId;
}

/** Like resolveGuestId, for server-rendered pages: a config error becomes "not found". */
export function tryResolveGuestId(raw: unknown): string | null {
  try {
    return resolveGuestId(raw);
  } catch (err) {
    console.error('[rsvp-token]', err instanceof Error ? err.message : err);
    return null;
  }
}
