import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { campaignId, firstName = '', lastName = '' } = await req.json();

    if (!campaignId || (!firstName && !lastName)) {
      return NextResponse.json({ error: 'campaignId and name are required' }, { status: 400 });
    }

    const searchFirst = firstName.trim().toLowerCase();
    const searchLast = lastName.trim().toLowerCase();

    const db = getAdminDb();
    
    // Fetch all guests for this campaign.
    // For large events (e.g. 500-2000 guests) this is extremely fast and completely fine.
    const snapshot = await db.collection('guests')
      .where('campaignId', '==', campaignId)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'No guests found for this event' }, { status: 404 });
    }

    // Manual case-insensitive find
    let matchedDoc: any = null;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const dbFirst = (data.firstName || '').toLowerCase();
      const dbLast = (data.lastName || '').toLowerCase();
      const dbFullName = (data.name || '').toLowerCase();

      // Match exact on first/last, or exact on full name
      if (
        (dbFirst === searchFirst && dbLast === searchLast) ||
        dbFullName === `${searchFirst} ${searchLast}`.trim()
      ) {
        matchedDoc = { id: doc.id, ...data };
        break;
      }
    }

    if (!matchedDoc) {
      return NextResponse.json({ error: "We couldn't find an invitation under that name." }, { status: 404 });
    }

    return NextResponse.json({
      id: matchedDoc.id,
      name: matchedDoc.name,
      status: matchedDoc.status,
    });
  } catch (err) {
    console.error('lookup-guest error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
