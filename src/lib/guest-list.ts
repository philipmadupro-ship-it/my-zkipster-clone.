/**
 * Pure logic behind the guest list and door mode: searching, filtering,
 * sorting, tags, plus-ones grouped under their host, and the export rows.
 * No React and no database, so it can be tested on its own.
 */

export interface GuestRecord {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status: string;
  category?: string;
  notes?: string;
  confirmedAt?: unknown;
  arrivedAt?: unknown;
  arrivedBy?: string | null;
  createdAt?: unknown;
  parentId?: string;
  portraitUrl?: string;
  extraFields?: Record<string, string>;
}

export type StatusFilter = 'all' | 'arrived' | 'notArrived' | 'confirmed' | 'invited';
export type SortKey = 'newest' | 'name' | 'arrival' | 'status';

// ---- text, time and status helpers ---------------------------------------

/** Lower-case and strip accents, so "elodie" finds "Élodie". */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Milliseconds for a Firestore timestamp ({seconds}), a Date, a number or an ISO string. */
export function toMs(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = Number((value as { seconds: unknown }).seconds);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  }
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function displayName(g: GuestRecord): string {
  return (g.name || `${g.firstName ?? ''} ${g.lastName ?? ''}`).trim() || 'Unnamed guest';
}

export function isArrived(g: GuestRecord): boolean {
  return g.status === 'arrived';
}

export function matchesStatus(status: string, filter: StatusFilter): boolean {
  switch (filter) {
    case 'arrived': return status === 'arrived';
    case 'notArrived': return status !== 'arrived';
    case 'confirmed': return status === 'confirmed' || status === 'accepted';
    case 'invited': return status === 'invited' || status === 'pending';
    default: return true;
  }
}

/** The tag shown for a guest (their category). */
export function tagOf(g: GuestRecord): string {
  return (g.category ?? '').replace(/\s+/g, ' ').trim() || 'Standard';
}

export function tagKey(tag: string): string {
  return normalizeText(tag).trim();
}

/** Tags in use, with how many guests have each (most used first). Spelling follows the first guest seen. */
export function collectTags(guests: GuestRecord[]): { key: string; label: string; count: number }[] {
  const tags = new Map<string, { key: string; label: string; count: number }>();
  for (const g of guests) {
    const label = tagOf(g);
    const key = tagKey(label);
    const entry = tags.get(key);
    if (entry) entry.count += 1;
    else tags.set(key, { key, label, count: 1 });
  }
  return [...tags.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** A stable colour (hue, 0-359) for a tag, so each tag always looks the same. */
export function tagHue(tag: string): number {
  let hash = 0;
  for (const ch of tagKey(tag)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 360;
}

// ---- plus-ones ------------------------------------------------------------

/**
 * Works out who each plus-one belongs to. `parentId` normally holds the host's
 * guest ID, but spreadsheet imports stored whatever was in the "host" column
 * (a name or an email), so this also matches on email and on full name.
 * Returns child id -> top-level host.
 */
export function resolveHosts(guests: GuestRecord[]): Map<string, GuestRecord> {
  const byId = new Map(guests.map((g) => [g.id, g]));
  const byEmail = new Map<string, GuestRecord>();
  const byName = new Map<string, GuestRecord>();
  for (const g of guests) {
    if (g.email) byEmail.set(normalizeText(g.email).trim(), g);
    const full = normalizeText(displayName(g)).replace(/\s+/g, ' ').trim();
    const reversed = normalizeText(`${g.lastName ?? ''} ${g.firstName ?? ''}`).replace(/\s+/g, ' ').trim();
    if (full && !byName.has(full)) byName.set(full, g);
    if (reversed && !byName.has(reversed)) byName.set(reversed, g);
  }

  const directParent = (g: GuestRecord): GuestRecord | undefined => {
    const ref = (g.parentId ?? '').trim();
    if (!ref) return undefined;
    const found = byId.get(ref) ?? byEmail.get(normalizeText(ref).trim()) ?? byName.get(normalizeText(ref).replace(/\s+/g, ' ').trim());
    return found && found.id !== g.id ? found : undefined;
  };

  const hosts = new Map<string, GuestRecord>();
  for (const g of guests) {
    let host = directParent(g);
    if (!host) continue;

    // Follow the chain up to the top-level host. If it leads back to this guest
    // (A is B's host and B is A's), nobody is "under" anyone: treat them as
    // ordinary guests so no one disappears from the list.
    const seen = new Set([g.id, host.id]);
    let loops = false;
    for (;;) {
      const next = directParent(host);
      if (!next || seen.has(next.id)) {
        loops = next?.id === g.id;
        break;
      }
      seen.add(next.id);
      host = next;
    }
    if (!loops) hosts.set(g.id, host);
  }
  return hosts;
}

// ---- search, filter, sort, group ------------------------------------------

export interface ListOptions {
  query: string;
  status: StatusFilter;
  /** A tag key (see tagKey) or 'all'. */
  tag: string;
  sort: SortKey;
}

export interface ListRow {
  guest: GuestRecord;
  /** 0 for a guest, 1 for a plus-one shown under their host. */
  depth: 0 | 1;
  /** The host, for plus-ones. */
  host: GuestRecord | null;
  /** Shown only so a matching plus-one has its host above it; doesn't match the search itself. */
  context: boolean;
  /**
   * For a host with plus-ones: how many they have, how many have arrived, and who in
   * the party (host included) still hasn't. Counts everyone, not just the matches.
   */
  party: { total: number; arrived: number; pendingIds: string[] } | null;
}

const STATUS_RANK: Record<string, number> = { arrived: 0, confirmed: 1, accepted: 1, invited: 2, pending: 2, refused: 3 };

function nameKey(g: GuestRecord): string {
  return normalizeText(`${g.lastName ?? ''} ${g.firstName ?? ''} ${g.name ?? ''}`).trim();
}

function compareBy(sort: SortKey): (a: GuestRecord, b: GuestRecord) => number {
  const byName = (a: GuestRecord, b: GuestRecord) => nameKey(a).localeCompare(nameKey(b));
  switch (sort) {
    case 'name':
      return byName;
    case 'arrival':
      // Most recent arrivals first, then everyone who hasn't arrived, by name.
      return (a, b) => {
        const am = isArrived(a) ? toMs(a.arrivedAt) : null;
        const bm = isArrived(b) ? toMs(b.arrivedAt) : null;
        if (am !== null && bm !== null) return bm - am || byName(a, b);
        if (am !== null) return -1;
        if (bm !== null) return 1;
        return byName(a, b);
      };
    case 'status':
      return (a, b) => (STATUS_RANK[a.status] ?? 4) - (STATUS_RANK[b.status] ?? 4) || byName(a, b);
    default:
      return (a, b) => (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0) || byName(a, b);
  }
}

function searchText(g: GuestRecord, host: GuestRecord | undefined): string {
  return normalizeText(
    [
      displayName(g), g.firstName, g.lastName, g.email, tagOf(g), g.notes,
      ...Object.values(g.extraFields ?? {}),
      // A plus-one is also found by searching for their host.
      host ? displayName(host) : '',
    ].join(' '),
  );
}

/**
 * Applies search, status and tag filters, sorts, and lays the guests out with
 * each plus-one directly under their host. A plus-one whose host doesn't match
 * still shows, with the host above it dimmed ("context").
 */
export function buildRows(guests: GuestRecord[], options: ListOptions): { rows: ListRow[]; shown: number } {
  const hosts = resolveHosts(guests);
  const terms = normalizeText(options.query).split(/\s+/).filter(Boolean);

  const matches = (g: GuestRecord): boolean => {
    if (!matchesStatus(g.status, options.status)) return false;
    if (options.tag !== 'all' && tagKey(tagOf(g)) !== options.tag) return false;
    if (terms.length === 0) return true;
    const text = searchText(g, hosts.get(g.id));
    return terms.every((t) => text.includes(t));
  };

  const kidsOf = new Map<string, GuestRecord[]>();
  for (const g of guests) {
    const host = hosts.get(g.id);
    if (host) kidsOf.set(host.id, [...(kidsOf.get(host.id) ?? []), g]);
  }
  const byName = compareBy('name');
  for (const kids of kidsOf.values()) kids.sort(byName);

  const leaders = guests.filter((g) => !hosts.has(g.id)).sort(compareBy(options.sort));

  const rows: ListRow[] = [];
  let shown = 0;
  for (const leader of leaders) {
    const kids = kidsOf.get(leader.id) ?? [];
    const leaderMatches = matches(leader);
    const matchingKids = kids.filter(matches);
    if (!leaderMatches && matchingKids.length === 0) continue;

    rows.push({
      guest: leader,
      depth: 0,
      host: null,
      context: !leaderMatches,
      party: kids.length > 0
        ? {
            total: kids.length,
            arrived: kids.filter(isArrived).length,
            pendingIds: [leader, ...kids].filter((g) => !isArrived(g)).map((g) => g.id),
          }
        : null,
    });
    if (leaderMatches) shown += 1;

    for (const kid of matchingKids) {
      rows.push({ guest: kid, depth: 1, host: leader, context: false, party: null });
      shown += 1;
    }
  }
  return { rows, shown };
}

// ---- counts ---------------------------------------------------------------

export function countStatuses(guests: GuestRecord[]): Record<StatusFilter, number> {
  const counts = { all: guests.length, arrived: 0, notArrived: 0, confirmed: 0, invited: 0 };
  for (const g of guests) {
    if (matchesStatus(g.status, 'arrived')) counts.arrived += 1;
    if (matchesStatus(g.status, 'notArrived')) counts.notArrived += 1;
    if (matchesStatus(g.status, 'confirmed')) counts.confirmed += 1;
    if (matchesStatus(g.status, 'invited')) counts.invited += 1;
  }
  return counts;
}

/** How many plus-ones there are and how many of them have arrived. */
export function plusOneStats(guests: GuestRecord[]): { total: number; arrived: number } {
  const hosts = resolveHosts(guests);
  let arrived = 0;
  for (const g of guests) if (hosts.has(g.id) && isArrived(g)) arrived += 1;
  return { total: hosts.size, arrived };
}

/** Guests who have arrived, most recent first. */
export function recentArrivals(guests: GuestRecord[], limit: number): GuestRecord[] {
  return guests
    .filter((g) => isArrived(g))
    .sort((a, b) => (toMs(b.arrivedAt) ?? 0) - (toMs(a.arrivedAt) ?? 0))
    .slice(0, limit);
}

/** Everyone in a host's party (the host and their plus-ones) who hasn't arrived yet. */
export function pendingPartyIds(host: GuestRecord, guests: GuestRecord[]): string[] {
  const hosts = resolveHosts(guests);
  return [host, ...guests.filter((g) => hosts.get(g.id)?.id === host.id)].filter((g) => !isArrived(g)).map((g) => g.id);
}

// ---- optimistic update ----------------------------------------------------

/** What the list should look like straight after a check-in/undo, before the server confirms. */
export function applyCheckInLocally(
  guests: GuestRecord[],
  ids: string[],
  undo: boolean,
  by: string,
  nowMs: number = Date.now(),
): GuestRecord[] {
  const wanted = new Set(ids);
  return guests.map((g) => {
    if (!wanted.has(g.id)) return g;
    if (undo) {
      return isArrived(g) ? { ...g, status: g.confirmedAt ? 'confirmed' : 'invited', arrivedAt: null, arrivedBy: null } : g;
    }
    return isArrived(g) ? g : { ...g, status: 'arrived', arrivedAt: { seconds: Math.floor(nowMs / 1000), nanoseconds: 0 }, arrivedBy: by };
  });
}

// ---- display --------------------------------------------------------------

/** "09:14 PM" for today, "Oct 4, 09:14 PM" for another day. */
export function formatClock(value: unknown, nowMs: number = Date.now()): string {
  const ms = toMs(value);
  if (ms === null) return '—';
  const date = new Date(ms);
  const sameDay = date.toDateString() === new Date(nowMs).toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "press" from "press@ungaro.com", for compact "by whom" labels. */
export function shortWho(email: string | null | undefined): string {
  return (email ?? '').split('@')[0];
}

// ---- export ---------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  arrived: 'Arrived', confirmed: 'Confirmed', accepted: 'Confirmed', invited: 'Invited', pending: 'Invited', refused: 'Refused',
};

function dateTimeText(value: unknown): string {
  const ms = toMs(value);
  if (ms === null) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * One row per guest for the spreadsheet export, hosts followed by their
 * plus-ones, with arrival time and who checked them in.
 */
export function buildExportRows(guests: GuestRecord[]): Record<string, string>[] {
  const { rows } = buildRows(guests, { query: '', status: 'all', tag: 'all', sort: 'name' });
  const extraKeys = [...new Set(guests.flatMap((g) => Object.keys(g.extraFields ?? {})))];

  return rows.map(({ guest: g, host }) => {
    const row: Record<string, string> = {
      'First name': g.firstName ?? '',
      'Last name': g.lastName ?? '',
      Email: g.email ?? '',
      Tag: tagOf(g),
      Status: STATUS_LABEL[g.status] ?? g.status,
      Arrived: isArrived(g) ? 'Yes' : 'No',
      'Arrival time': isArrived(g) ? dateTimeText(g.arrivedAt) : '',
      'Checked in by': isArrived(g) ? g.arrivedBy ?? '' : '',
      'Plus-one of': host ? displayName(host) : '',
      Notes: g.notes ?? '',
      'RSVP confirmed': dateTimeText(g.confirmedAt),
      Registered: dateTimeText(g.createdAt),
    };
    // Guests without first/last names fall back to the combined name.
    if (!row['First name'] && !row['Last name']) row['First name'] = displayName(g);
    for (const key of extraKeys) row[key] = String(g.extraFields?.[key] ?? '');
    return row;
  });
}
