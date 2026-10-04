import { authedFetch } from '@/lib/api-client';
import type { CheckInResultItem } from '@/lib/checkin';

/** Sends a check-in (or undo) for one guest or a whole party. Never throws. */
export async function postCheckIn(
  ids: string[],
  undo: boolean,
): Promise<{ ok: true; results: CheckInResultItem[] } | { ok: false; error: string }> {
  try {
    const res = await authedFetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestIds: ids, undo }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || `Check-in failed (${res.status})` };
    return { ok: true, results: body.results as CheckInResultItem[] };
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' };
  }
}
