import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { guestId, name, dietary, carService } = await req.json();

    if (!guestId || !name) {
      return NextResponse.json({ error: 'guestId and name are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection('guests').doc(guestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const data = doc.data()!;

    if (data.status === 'confirmed' || data.status === 'accepted' || data.status === 'arrived') {
      return NextResponse.json({ error: 'Guest has already confirmed', qrCodeUrl: data.qrCodeUrl }, { status: 409 });
    }

    await docRef.update({
      name: name.trim(),
      status: 'confirmed',
      dietary: dietary?.trim() || '',
      carService: carService?.trim() || '',
      confirmedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, qrCodeUrl: data.qrCodeUrl });
  } catch (err) {
    console.error('confirm-rsvp error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
