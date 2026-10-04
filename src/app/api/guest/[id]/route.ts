import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdmin, handleApiError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Used by the door scanner only, so it is restricted to signed-in staff.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }>}) {
  try {
    await requireAdmin(req);

    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('guests').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data = doc.data()!;
    return NextResponse.json({
      id: doc.id,
      name: data.name,
      email: data.email,
      status: data.status,
      portraitUrl: data.portraitUrl ?? null,
      category: data.category ?? 'Standard',
      seatNumber: data.seatNumber ?? '—',
      arrivedAt: data.arrivedAt?.toDate?.()?.toISOString() ?? data.arrivedAt ?? null,
      arrivedBy: data.arrivedBy ?? null,
      notes: data.notes ?? '',
    });
  } catch (err) {
    return handleApiError(err, 'guest lookup');
  }
}
