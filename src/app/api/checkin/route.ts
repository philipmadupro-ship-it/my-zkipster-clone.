import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { handleApiError, requireAdmin } from '@/lib/auth';
import { planCheckIns, type GuestSnapshot } from '@/lib/checkin';
import { serializeFirestore } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const MAX_GUESTS_PER_REQUEST = 100;

/**
 * Checks guests in, or undoes it. Body: `{ guestId }` or `{ guestIds: [...] }`
 * (a whole party at once), plus `undo: true` to reverse.
 *
 * Every guest is read and updated in one transaction, so if two people check
 * in the same guest at the same moment only the first counts; the other gets
 * `already_checked_in` with the time and who did it. Each result carries its own
 * outcome, so a party can partly succeed.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const requested: unknown[] = Array.isArray(body.guestIds) ? body.guestIds : body.guestId !== undefined ? [body.guestId] : [];
    const ids = [...new Set(requested)].filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128 && !id.includes('/'));

    if (ids.length === 0) {
      return NextResponse.json({ error: 'guestId or guestIds is required' }, { status: 400 });
    }
    if (ids.length > MAX_GUESTS_PER_REQUEST) {
      return NextResponse.json({ error: `Check in at most ${MAX_GUESTS_PER_REQUEST} guests at a time.` }, { status: 400 });
    }

    const undo = body.undo === true;
    const db = getAdminDb();
    const refs = ids.map((id) => db.collection('guests').doc(id));
    const arrivedAtValue = Timestamp.now();

    const plans = await db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...refs);
      const plan = planCheckIns(
        snaps.map((s): GuestSnapshot => ({ id: s.id, exists: s.exists, data: s.data() as GuestSnapshot['data'] })),
        { undo, by: user.email, arrivedAtValue },
      );
      plan.forEach((p, i) => {
        if (p.update) tx.update(refs[i], p.update);
      });
      return plan;
    });

    const results = plans.map((p) => ({
      id: p.id,
      name: p.name,
      outcome: p.outcome,
      arrivedAt: serializeFirestore(p.arrivedAt ?? null),
      arrivedBy: p.arrivedBy ?? null,
    }));
    const count = (outcome: string) => results.filter((r) => r.outcome === outcome).length;

    // Older callers (the QR scanner, the original dashboard button) send a single `guestId`
    // and expect these status codes. New callers send `guestIds` and read `results` instead.
    if (!Array.isArray(body.guestIds) && results.length === 1) {
      const [only] = results;
      if (only.outcome === 'not_found') return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      if (only.outcome === 'already_checked_in') {
        return NextResponse.json(
          { error: 'Already checked in', name: only.name, arrivedAt: only.arrivedAt, arrivedBy: only.arrivedBy },
          { status: 409 },
        );
      }
      if (only.outcome === 'not_checked_in') return NextResponse.json({ error: 'Guest is not checked in' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      results,
      checkedIn: count('checked_in'),
      alreadyCheckedIn: count('already_checked_in'),
      undone: count('undone'),
    });
  } catch (err) {
    return handleApiError(err, 'checkin');
  }
}
