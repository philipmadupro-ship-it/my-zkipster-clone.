import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { guests, campaignId, ownerEmail } = await req.json();

    if (!Array.isArray(guests) || !campaignId || !ownerEmail) {
      return NextResponse.json({ error: 'guests array, campaignId, and ownerEmail are required' }, { status: 400 });
    }

    const db = getAdminDb();
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

        const { firstName, lastName, email, category, ...extraFields } = g;

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
          rsvpLink: '—', // Unified campaign url used instead
          confirmedAt: null,
          arrivedAt: null,
          createdAt: FieldValue.serverTimestamp(),
          ownerEmail: ownerEmail,
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
    console.error('bulk-import error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
