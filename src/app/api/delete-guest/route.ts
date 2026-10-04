import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin, getOwnedGuest, handleApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    const { guestId } = await req.json();

    if (!guestId || typeof guestId !== 'string') {
      return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
    }

    const { ref } = await getOwnedGuest(getAdminDb(), guestId, user);
    await ref.delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, 'delete-guest');
  }
}
