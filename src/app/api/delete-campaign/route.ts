import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const db = getAdminDb();
    
    // 1. Delete the campaign document
    await db.collection('campaigns').doc(campaignId).delete();

    // 2. Cascade delete all associated guests
    const guestsSnap = await db.collection('guests').where('campaignId', '==', campaignId).get();
    
    if (!guestsSnap.empty) {
      const batch = db.batch();
      guestsSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true, deletedGuests: guestsSnap.size });
  } catch (err) {
    console.error('delete-campaign error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
