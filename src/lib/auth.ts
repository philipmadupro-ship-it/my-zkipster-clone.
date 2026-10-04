import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';

/** An error that should be returned to the caller with a specific HTTP status. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AdminUser {
  uid: string;
  /** Lower-cased, verified email address from the Firebase ID token. */
  email: string;
}

/**
 * ADMIN_EMAILS is a comma-separated allowlist. Entries are either a full
 * address (`press@ungaro.com`) or a whole domain (`@ungaro.com`).
 */
function isAllowlisted(email: string): boolean {
  const entries = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (entries.length === 0) {
    console.error('[auth] ADMIN_EMAILS is not set; refusing all admin API requests.');
    throw new ApiError(503, 'Admin access is not configured on this server.');
  }

  return entries.some((entry) => (entry.startsWith('@') ? email.endsWith(entry) : email === entry));
}

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>` and
 * checks the account against the ADMIN_EMAILS allowlist. Throws ApiError.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminUser> {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  if (!match) throw new ApiError(401, 'Authentication required.');

  let decoded;
  try {
    decoded = await getAuth(getAdminApp()).verifyIdToken(match[1]);
  } catch {
    throw new ApiError(401, 'Your session is invalid or has expired. Please sign in again.');
  }

  if (!decoded.email || !decoded.email_verified) {
    throw new ApiError(403, 'A verified email address is required.');
  }

  const email = decoded.email.toLowerCase();
  if (!isAllowlisted(email)) {
    throw new ApiError(403, 'This account is not authorised to manage events.');
  }

  return { uid: decoded.uid, email };
}

/**
 * Loads a campaign and ensures the signed-in admin owns it. A missing campaign
 * and someone else's campaign are indistinguishable to the caller.
 */
export async function getOwnedCampaign(db: Firestore, campaignId: string, user: AdminUser) {
  const snap = await db.collection('campaigns').doc(campaignId).get();
  const data = snap.data();
  if (!snap.exists || !data || String(data.ownerEmail ?? '').toLowerCase() !== user.email) {
    throw new ApiError(404, 'Campaign not found');
  }
  return { id: snap.id, data };
}

/** Loads a guest together with its (owned) campaign. */
export async function getOwnedGuest(db: Firestore, guestId: string, user: AdminUser) {
  const snap = await db.collection('guests').doc(guestId).get();
  const data = snap.data();
  if (!snap.exists || !data) throw new ApiError(404, 'Guest not found');
  const campaign = await getOwnedCampaign(db, String(data.campaignId ?? ''), user);
  return { ref: snap.ref, data, campaign };
}

export function handleApiError(err: unknown, label: string): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`${label} error:`, err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
