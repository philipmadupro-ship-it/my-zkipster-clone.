import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { RsvpConfigError } from '@/lib/rsvp-token';
import { AuthConfigError, SESSION_COOKIE, isKnownAdmin, readSessionToken } from '@/lib/admin-session';

/** An error that should be returned to the caller with a specific HTTP status. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AdminUser {
  /** Same as `email`; kept so callers have a stable identifier. */
  uid: string;
  /** Lower-cased email address from the signed session cookie. */
  email: string;
}

/**
 * Reads the signed session cookie set at login and confirms the person is still
 * listed in ADMIN_LOGINS. Throws ApiError (401) when there is no valid session.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminUser> {
  const email = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!email) throw new ApiError(401, 'Authentication required.');

  // Removing someone from ADMIN_LOGINS ends their session on the next request.
  if (!isKnownAdmin(email)) {
    throw new ApiError(401, 'Your session is no longer valid. Please sign in again.');
  }

  return { uid: email, email };
}

/**
 * Loads a campaign. Everyone listed in ADMIN_LOGINS shares all campaigns (it is
 * a small trusted team), so this only checks that the campaign exists.
 */
export async function getCampaign(db: Firestore, campaignId: string) {
  const snap = campaignId ? await db.collection('campaigns').doc(campaignId).get() : null;
  const data = snap?.data();
  if (!snap || !snap.exists || !data) throw new ApiError(404, 'Campaign not found');
  return { id: snap.id, data };
}

/** Loads a guest together with its campaign. */
export async function getGuest(db: Firestore, guestId: string) {
  const snap = await db.collection('guests').doc(guestId).get();
  const data = snap.data();
  if (!snap.exists || !data) throw new ApiError(404, 'Guest not found');
  const campaign = await getCampaign(db, String(data.campaignId ?? ''));
  return { ref: snap.ref, data, campaign };
}

export function handleApiError(err: unknown, label: string): NextResponse {
  if (err instanceof ApiError || err instanceof RsvpConfigError || err instanceof AuthConfigError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`${label} error:`, err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
