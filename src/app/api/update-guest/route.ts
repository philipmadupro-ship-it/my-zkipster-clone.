import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin, getGuest, handleApiError } from '@/lib/auth';
import { canonicalTag, cleanNotes } from '@/lib/guest-fields';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { guestId, firstName, lastName, email, category, portraitUrl, notes } = body;

    if (!guestId || typeof guestId !== 'string') {
      return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
    }

    const db = getAdminDb();
    const { ref, data } = await getGuest(db, guestId);

    const first = typeof firstName === 'string' ? firstName.trim() : '';
    const last = typeof lastName === 'string' ? lastName.trim() : '';
    const updateData: Record<string, unknown> = {
      firstName: first,
      lastName: last,
      email: typeof email === 'string' ? email.trim() : '',
      category: canonicalTag(category),
      portraitUrl: typeof portraitUrl === 'string' ? portraitUrl.trim() : '',
      // Update the legacy name field for compatibility
      name: `${first} ${last}`.trim(),
    };
    // Only touch these when the form sent them, so older callers don't wipe them.
    if ('notes' in body) updateData.notes = cleanNotes(notes);

    if ('parentId' in body) {
      const parentId = typeof body.parentId === 'string' ? body.parentId : '';
      if (parentId) {
        const host = await db.collection('guests').doc(parentId).get();
        if (!host.exists || host.data()?.campaignId !== data.campaignId) {
          return NextResponse.json({ error: 'The guest this plus-one belongs to was not found in this campaign.' }, { status: 400 });
        }
        // A guest can't be their own host, and two guests can't be each other's.
        if (parentId === guestId || host.data()?.parentId === guestId) {
          return NextResponse.json({ error: 'A guest can not be a plus-one of themselves or of their own plus-one.' }, { status: 400 });
        }
      }
      updateData.parentId = parentId;
    }

    await ref.update(updateData);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'update-guest');
  }
}
