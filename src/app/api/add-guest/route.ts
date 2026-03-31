import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, category, campaignId, ownerEmail, seatNumber } = await req.json();

    if (!firstName || !lastName || !campaignId || !ownerEmail) {
      return NextResponse.json({ error: 'firstName, lastName, campaignId, and ownerEmail are required' }, { status: 400 });
    }

    const db = getAdminDb();
    const docRef = db.collection('guests').doc();
    const id = docRef.id;

    const qrCodeUrl = await QRCode.toDataURL(id, { // QR code now only encodes the Guest ID itself
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
      color: { dark: '#0f0f0f', light: '#fafaf8' },
    });

    const guest = {
      id,
      campaignId,
      name: `${firstName.trim()} ${lastName.trim()}`,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email?.trim() || '',
      category: category || 'Standard',
      status: 'invited',
      qrCodeUrl,
      seatNumber: seatNumber || '',
      rsvpLink: '—', // Link is unified per campaign now
      confirmedAt: null,
      arrivedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
    };

    await docRef.set(guest);

    return NextResponse.json({ ...guest, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('add-guest error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
