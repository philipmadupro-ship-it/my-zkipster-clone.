import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { handleApiError, requireAdmin } from '@/lib/auth';
import { newestFirst, serializeFirestore } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

// Lists every campaign (all admins share them), newest first. The dashboard polls this.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const snap = await getAdminDb().collection('campaigns').get();
    const campaigns = snap.docs.map((d) => ({ ...serializeFirestore<Record<string, unknown>>(d.data()), id: d.id }));

    return NextResponse.json({ campaigns: newestFirst(campaigns, 'createdAt') });
  } catch (err) {
    return handleApiError(err, 'list campaigns');
  }
}
