import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getCampaign, handleApiError, requireAdmin } from '@/lib/auth';
import { newestFirst, serializeFirestore } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

// Lists a campaign's guests, newest first. The dashboard polls this, so the large
// QR image stored on each guest is left out (the dashboard never shows it).
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const campaignId = req.nextUrl.searchParams.get('campaignId') ?? '';
    const db = getAdminDb();
    await getCampaign(db, campaignId);

    const snap = await db.collection('guests').where('campaignId', '==', campaignId).get();
    const guests = snap.docs.map((d) => {
      const { qrCodeUrl: _omitted, ...rest } = d.data();
      return { ...serializeFirestore<Record<string, unknown>>(rest), id: d.id };
    });

    return NextResponse.json({ guests: newestFirst(guests, 'createdAt') });
  } catch (err) {
    return handleApiError(err, 'list guests');
  }
}
