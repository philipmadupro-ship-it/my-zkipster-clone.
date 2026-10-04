import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin, getCampaign, handleApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { campaignId } = await req.json();

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const db = getAdminDb();
    await getCampaign(db, campaignId);

    // 1. Delete the campaign document
    await db.collection('campaigns').doc(campaignId).delete();

    // 2. Cascade delete all associated guests (batches are capped at 500 writes)
    const guestsSnap = await db.collection('guests').where('campaignId', '==', campaignId).get();

    for (let i = 0; i < guestsSnap.docs.length; i += 400) {
      const batch = db.batch();
      guestsSnap.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return NextResponse.json({ success: true, deletedGuests: guestsSnap.size });
  } catch (err) {
    return handleApiError(err, 'delete-campaign');
  }
}
