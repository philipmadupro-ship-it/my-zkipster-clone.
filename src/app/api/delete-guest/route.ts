import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { guestId } = await req.json();

    if (!guestId) {
      return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection('guests').doc(guestId).delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('delete-guest error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
