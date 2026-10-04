import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, handleApiError } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Any signed-in admin may check guests in at the door.
    await requireAdmin(req);

    // `undo: true` reverses a check-in made by mistake.
    const { guestId, undo } = await req.json();

    if (!guestId || typeof guestId !== 'string') {
      return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection('guests').doc(guestId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    const data = doc.data()!;

    if (undo === true) {
      if (data.status !== 'arrived') {
        return NextResponse.json({ error: 'Guest is not checked in' }, { status: 409 });
      }
      // Go back to where they were before arriving: confirmed if they had RSVP'd, otherwise invited.
      await docRef.update({
        status: data.confirmedAt ? 'confirmed' : 'invited',
        arrivedAt: null,
      });
      return NextResponse.json({ success: true, name: data.name });
    }

    if (data.status === 'arrived') {
      return NextResponse.json({
        error: 'Already checked in',
        arrivedAt: data.arrivedAt,
        name: data.name,
      }, { status: 409 });
    }

    // Allow checking in if they are 'invited' or 'confirmed'
    // This supports the host scanning them directly at the door even if they didn't RSVP.
    await docRef.update({
      status: 'arrived',
      arrivedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, name: data.name, email: data.email });
  } catch (err) {
    return handleApiError(err, 'checkin');
  }
}
