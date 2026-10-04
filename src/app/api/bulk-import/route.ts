import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, getCampaign, handleApiError } from '@/lib/auth';
import { canonicalTag, cleanNotes } from '@/lib/guest-fields';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 3000;

function norm(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { guests, campaignId } = await req.json();

    if (!Array.isArray(guests) || !campaignId) {
      return NextResponse.json({ error: 'guests array and campaignId are required' }, { status: 400 });
    }
    if (guests.length > MAX_ROWS) {
      return NextResponse.json({ error: `Import at most ${MAX_ROWS} guests at a time.` }, { status: 400 });
    }

    const db = getAdminDb();
    await getCampaign(db, campaignId);

    // Spreadsheets name a plus-one's host by name or email, not by our internal ID.
    // Build a lookup of who is already in the campaign and who is in this file, so
    // the link can be stored properly whichever order the rows are in.
    const existingIds = new Set<string>();
    const lookup = new Map<string, string>(); // normalised email / full name / "last first" -> guest id
    const register = (id: string, g: { email?: unknown; firstName?: unknown; lastName?: unknown; name?: unknown }) => {
      const keys = [
        g.email,
        g.name,
        `${g.firstName ?? ''} ${g.lastName ?? ''}`,
        `${g.lastName ?? ''} ${g.firstName ?? ''}`,
      ].map(norm).filter(Boolean);
      for (const key of keys) if (!lookup.has(key)) lookup.set(key, id);
    };

    const existing = await db.collection('guests').where('campaignId', '==', campaignId).get();
    for (const doc of existing.docs) {
      existingIds.add(doc.id);
      register(doc.id, doc.data());
    }

    const prepared = guests
      .filter((g) => g && (g.firstName || g.lastName || g.email))
      .map((g) => ({ g, docRef: db.collection('guests').doc() }));
    for (const { g, docRef } of prepared) register(docRef.id, g);

    const results = [];
    const errors = [];
    let unlinkedPlusOnes = 0;

    for (const { g, docRef } of prepared) {
      try {
        const id = docRef.id;

        const qrCodeUrl = await QRCode.toDataURL(id, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 400,
          color: { dark: '#0f0f0f', light: '#fafaf8' },
        });

        const { firstName, lastName, email, category, notes, portraitUrl, parentId, ...extraFields } = g;

        const hostRef = typeof parentId === 'string' ? parentId.trim() : '';
        const hostId = !hostRef ? '' : existingIds.has(hostRef) ? hostRef : lookup.get(norm(hostRef)) ?? '';
        // Unresolved text is kept as it was, so the dashboard can still link it if the host turns up later.
        if (hostRef && !hostId) unlinkedPlusOnes += 1;

        const guest = {
          id,
          campaignId,
          name: `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim(),
          firstName: (firstName || '').trim(),
          lastName: (lastName || '').trim(),
          email: email ? email.trim().toLowerCase() : '',
          category: canonicalTag(category),
          notes: cleanNotes(notes),
          status: 'invited',
          qrCodeUrl,
          portraitUrl: portraitUrl || '',
          // The host's real ID if we found them (never the guest themselves), otherwise the text as given.
          parentId: hostId === id ? '' : hostId || hostRef,
          rsvpLink: '—', // Unified campaign url used instead
          confirmedAt: null,
          arrivedAt: null,
          arrivedBy: null,
          createdAt: FieldValue.serverTimestamp(),
          ownerEmail: user.email, // taken from the verified session, never from the request body
          extraFields: extraFields ?? {},
        };

        await docRef.set(guest);
        results.push({ ...guest, createdAt: new Date().toISOString() });
      } catch (err) {
        errors.push({ email: g.email || g.firstName, error: err instanceof Error ? err.message : 'Failed' });
      }
    }

    return NextResponse.json({ created: results.length, errors, unlinkedPlusOnes, guests: results });
  } catch (err) {
    return handleApiError(err, 'bulk-import');
  }
}
