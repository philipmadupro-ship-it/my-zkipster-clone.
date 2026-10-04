/**
 * The rules for checking guests in (or undoing it), kept free of any database
 * code so they can be tested. The API route reads the guests inside a Firestore
 * transaction, asks this for a plan, and applies it, so two people checking in
 * the same guest at once can't both win: the second one is told who got there
 * first and when.
 */

export interface GuestSnapshot {
  id: string;
  exists: boolean;
  data?: {
    name?: string;
    status?: string;
    confirmedAt?: unknown;
    arrivedAt?: unknown;
    arrivedBy?: string | null;
  };
}

export type CheckInOutcome =
  | 'checked_in' // arrived just now
  | 'already_checked_in' // someone got there first; arrivedAt/arrivedBy say when and who
  | 'undone' // check-in reversed
  | 'not_checked_in' // asked to undo, but they hadn't arrived
  | 'not_found';

export interface PlannedCheckIn {
  id: string;
  name: string;
  outcome: CheckInOutcome;
  /** Fields to write to the guest document (absent when nothing changes). */
  update?: Record<string, unknown>;
  arrivedAt?: unknown;
  arrivedBy?: string | null;
}

export interface CheckInResultItem {
  id: string;
  name: string;
  outcome: CheckInOutcome;
  arrivedAt?: unknown;
  arrivedBy?: string | null;
}

/**
 * The message to show after a check-in or undo. `fmtTime` turns a timestamp into
 * a clock time. A guest who was already checked in produces a warning that says
 * when and by whom.
 */
export function describeCheckIn(
  results: CheckInResultItem[],
  undo: boolean,
  fmtTime: (value: unknown) => string,
): { text: string; kind: 'success' | 'warning' | 'error' } {
  const of = (outcome: CheckInOutcome) => results.filter((r) => r.outcome === outcome);
  const who = (r: CheckInResultItem) => r.name || 'Guest';

  if (results.length > 0 && results.every((r) => r.outcome === 'not_found')) {
    return { text: results.length === 1 ? 'Guest not found' : 'None of those guests were found', kind: 'error' };
  }

  if (undo) {
    const undone = of('undone');
    if (undone.length === 0) return { text: 'Nobody to undo: they have not arrived', kind: 'warning' };
    return {
      text: undone.length === 1 ? `${who(undone[0])}: check-in undone` : `${undone.length} check-ins undone`,
      kind: 'success',
    };
  }

  const done = of('checked_in');
  const already = of('already_checked_in');
  const missing = of('not_found').length;

  const alreadyText = already
    .map((r) => {
      const by = r.arrivedBy ? ` by ${r.arrivedBy.split('@')[0]}` : '';
      return `${who(r)} was already checked in at ${fmtTime(r.arrivedAt)}${by}`;
    })
    .join('. ');

  if (done.length === 0) return { text: alreadyText || 'Nothing to check in', kind: 'warning' };

  const doneText = done.length === 1 ? `${who(done[0])} checked in` : `${done.length} guests checked in`;
  const extras = [alreadyText, missing ? `${missing} not found` : ''].filter(Boolean);
  return { text: [doneText, ...extras].join('. '), kind: extras.length > 0 ? 'warning' : 'success' };
}

export function planCheckIns(
  snapshots: GuestSnapshot[],
  options: { undo: boolean; by: string; arrivedAtValue: unknown },
): PlannedCheckIn[] {
  return snapshots.map((snap): PlannedCheckIn => {
    if (!snap.exists || !snap.data) return { id: snap.id, name: '', outcome: 'not_found' };

    const { data } = snap;
    const name = data.name ?? '';
    const arrived = data.status === 'arrived';

    if (options.undo) {
      if (!arrived) return { id: snap.id, name, outcome: 'not_checked_in' };
      return {
        id: snap.id,
        name,
        outcome: 'undone',
        // Back to where they were before arriving: confirmed if they had RSVP'd, otherwise invited.
        update: { status: data.confirmedAt ? 'confirmed' : 'invited', arrivedAt: null, arrivedBy: null },
      };
    }

    if (arrived) {
      return {
        id: snap.id,
        name,
        outcome: 'already_checked_in',
        arrivedAt: data.arrivedAt ?? null,
        arrivedBy: data.arrivedBy ?? null,
      };
    }

    return {
      id: snap.id,
      name,
      outcome: 'checked_in',
      update: { status: 'arrived', arrivedAt: options.arrivedAtValue, arrivedBy: options.by },
      arrivedAt: options.arrivedAtValue,
      arrivedBy: options.by,
    };
  });
}
