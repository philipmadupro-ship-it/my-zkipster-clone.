import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminDb();
    
    const campaignsSnap = await db.collection('campaigns').limit(10).get();
    const campaigns = campaignsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const guestsSnap = await db.collection('guests').limit(10).get();
    const guests = guestsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({
      success: true,
      campaigns,
      guests
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
