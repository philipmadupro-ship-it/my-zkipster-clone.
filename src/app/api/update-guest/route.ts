import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { guestId, firstName, lastName, email, category, portraitUrl } = await req.json();

    if (!guestId) {
      return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection('guests').doc(guestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const updateData: any = {
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      email: email?.trim() || '',
      category: category || 'Standard',
      portraitUrl: portraitUrl?.trim() || '',
      // Update the legacy name field for compatibility
      name: `${firstName?.trim() || ''} ${lastName?.trim() || ''}`.trim(),
    };

    await docRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('update-guest error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
