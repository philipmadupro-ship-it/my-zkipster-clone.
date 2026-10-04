import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, handleApiError } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // Any allowlisted staff member may check guests in at the door, so this
    // checks the allowlist but not campaign ownership.
    await requireAdmin(req);

    const { guestId } = await req.json();

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
