import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    const campaignSnap = await db.collection('campaigns').get();
    const campaigns = campaignSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const guestSnap = await db.collection('guests').get();
    const guests = guestSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ campaigns, guests });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
