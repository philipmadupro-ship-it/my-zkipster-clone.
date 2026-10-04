import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from '@/lib/firebase-admin';
import { ApiError, handleApiError, requireAllowlistConfigured } from '@/lib/auth';
import { isExactlyListed } from '@/lib/admin-allowlist';

export const dynamic = 'force-dynamic';

/**
 * Marks an email/password account as verified, so an administrator can create a
 * login in the Firebase Console (which leaves it unverified) and just sign in.
 *
 * Only accounts whose address is written out in full in ADMIN_EMAILS qualify. A
 * `@domain` entry does not, because that would let anyone who registers an
 * address on the domain promote themselves. The caller must hold a valid ID
 * token for the account, i.e. have just signed in with its password.
 */
export async function POST(req: NextRequest) {
  try {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
    if (!match) throw new ApiError(401, 'Authentication required.');

    const auth = getAuth(getAdminApp());
    let decoded;
    try {
      decoded = await auth.verifyIdToken(match[1]);
    } catch {
      throw new ApiError(401, 'Your session is invalid or has expired. Please sign in again.');
    }

    if (decoded.email_verified) return NextResponse.json({ success: true, alreadyActive: true });

    requireAllowlistConfigured();

    const email = decoded.email?.toLowerCase();
    if (!email || decoded.firebase?.sign_in_provider !== 'password' || !isExactlyListed(email)) {
      throw new ApiError(403, 'This account has not been activated. Please contact the administrator.');
    }

    await auth.updateUser(decoded.uid, { emailVerified: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'activate-account');
  }
}
