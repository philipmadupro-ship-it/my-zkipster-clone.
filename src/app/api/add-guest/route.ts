import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, getOwnedCampaign, handleApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { firstName, lastName, email, category, campaignId, portraitUrl, parentId } = await req.json();

    if (!firstName || !lastName || !campaignId) {
      return NextResponse.json({ error: 'firstName, lastName and campaignId are required' }, { status: 400 });
    }

    const db = getAdminDb();
    await getOwnedCampaign(db, campaignId, user);

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
      portraitUrl: portraitUrl?.trim() || '',
      parentId: parentId || '',
      rsvpLink: '—', // Link is unified per campaign now
      confirmedAt: null,
      arrivedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      ownerEmail: user.email, // taken from the verified token, never from the request body
    };

    await docRef.set(guest);

    return NextResponse.json({ ...guest, createdAt: new Date().toISOString() });
  } catch (err) {
    return handleApiError(err, 'add-guest');
  }
}
