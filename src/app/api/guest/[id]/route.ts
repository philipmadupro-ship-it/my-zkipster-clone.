import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest, { params }: { params: { id: string }}) {
  try {
    const db = getAdminDb();
    const doc = await db.collection('guests').doc(params.id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data = doc.data()!;
    return NextResponse.json({
      id: doc.id,
      name: data.name,
      email: data.email,
      status: data.status,
      arrivedAt: data.arrivedAt?.toDate?.()?.toISOString() ?? data.arrivedAt ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
