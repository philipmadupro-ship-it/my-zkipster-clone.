import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, getCampaign, handleApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { guests, campaignId } = await req.json();

    if (!Array.isArray(guests) || !campaignId) {
      return NextResponse.json({ error: 'guests array and campaignId are required' }, { status: 400 });
    }

    const db = getAdminDb();
    await getCampaign(db, campaignId);

    const results = [];
    const errors = [];

    for (const g of guests) {
      if (!g.firstName && !g.lastName && !g.email) continue;
      try {
        const docRef = db.collection('guests').doc();
        const id = docRef.id;

        const qrCodeUrl = await QRCode.toDataURL(id, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 400,
          color: { dark: '#0f0f0f', light: '#fafaf8' },
        });

        const { firstName, lastName, email, category, portraitUrl, parentId, ...extraFields } = g;

        const guest = {
          id,
          campaignId,
          name: `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim(),
          firstName: (firstName || '').trim(),
          lastName: (lastName || '').trim(),
          email: email ? email.trim().toLowerCase() : '',
          category: category || 'Standard',
          status: 'invited',
          qrCodeUrl,
          portraitUrl: portraitUrl || '',
          parentId: parentId || '',
          rsvpLink: '—', // Unified campaign url used instead
          confirmedAt: null,
          arrivedAt: null,
          createdAt: FieldValue.serverTimestamp(),
          ownerEmail: user.email, // taken from the verified token, never from the request body
          extraFields: extraFields ?? {},
        };

        await docRef.set(guest);
        results.push({ ...guest, createdAt: new Date().toISOString() });
      } catch (err) {
        errors.push({ email: g.email || g.firstName, error: err instanceof Error ? err.message : 'Failed' });
      }
    }

    return NextResponse.json({ created: results.length, errors, guests: results });
  } catch (err) {
    return handleApiError(err, 'bulk-import');
  }
}
