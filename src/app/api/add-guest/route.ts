import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, getCampaign, handleApiError } from '@/lib/auth';
import { canonicalTag, cleanNotes } from '@/lib/guest-fields';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { firstName, lastName, email, category, notes, campaignId, portraitUrl, parentId } = await req.json();

    if (typeof firstName !== 'string' || typeof lastName !== 'string' || !firstName.trim() || !lastName.trim() || !campaignId) {
      return NextResponse.json({ error: 'firstName, lastName and campaignId are required' }, { status: 400 });
    }

    const db = getAdminDb();
    await getCampaign(db, campaignId);

    // A plus-one must belong to a guest of the same campaign.
    if (typeof parentId === 'string' && parentId) {
      const host = await db.collection('guests').doc(parentId).get();
      if (!host.exists || host.data()?.campaignId !== campaignId) {
        return NextResponse.json({ error: 'The guest this plus-one belongs to was not found in this campaign.' }, { status: 400 });
      }
    }

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
      email: typeof email === 'string' ? email.trim() : '',
      category: canonicalTag(category),
      notes: cleanNotes(notes),
      status: 'invited',
      qrCodeUrl,
      portraitUrl: typeof portraitUrl === 'string' ? portraitUrl.trim() : '',
      parentId: typeof parentId === 'string' ? parentId : '',
      rsvpLink: '—', // Link is unified per campaign now
      confirmedAt: null,
      arrivedAt: null,
      arrivedBy: null,
      createdAt: FieldValue.serverTimestamp(),
      ownerEmail: user.email, // taken from the verified session, never from the request body
    };

    await docRef.set(guest);

    return NextResponse.json({ ...guest, createdAt: new Date().toISOString() });
  } catch (err) {
    return handleApiError(err, 'add-guest');
  }
}
