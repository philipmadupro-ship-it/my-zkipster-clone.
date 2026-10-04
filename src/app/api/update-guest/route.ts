import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin, getOwnedGuest, handleApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { guestId, firstName, lastName, email, category, portraitUrl } = await req.json();

    if (!guestId || typeof guestId !== 'string') {
      return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
    }

    const { ref } = await getOwnedGuest(getAdminDb(), guestId, user);

    const updateData = {
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      email: email?.trim() || '',
      category: category || 'Standard',
      portraitUrl: portraitUrl?.trim() || '',
      // Update the legacy name field for compatibility
      name: `${firstName?.trim() || ''} ${lastName?.trim() || ''}`.trim(),
    };

    await ref.update(updateData);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'update-guest');
  }
}
