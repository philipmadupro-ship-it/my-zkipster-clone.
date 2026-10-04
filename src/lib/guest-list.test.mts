import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCheckInLocally,
  buildExportRows,
  buildRows,
  collectTags,
  countStatuses,
  formatClock,
  normalizeText,
  pendingPartyIds,
  plusOneStats,
  recentArrivals,
  resolveHosts,
  shortWho,
  tagHue,
  toMs,
  type GuestRecord,
  type ListOptions,
} from './guest-list.ts';

const T = 1_800_000_000; // seconds
const at = (secondsAfter: number) => ({ seconds: T + secondsAfter, nanoseconds: 0 });

function guest(id: string, firstName: string, lastName: string, extra: Partial<GuestRecord> = {}): GuestRecord {
  return {
    id, firstName, lastName, name: `${firstName} ${lastName}`, status: 'invited', category: 'Standard',
    email: `${firstName}.${lastName}@example.com`.toLowerCase(), createdAt: at(0), ...extra,
  };
}

const ALL: ListOptions = { query: '', status: 'all', tag: 'all', sort: 'name' };
const names = (rows: { guest: GuestRecord }[]) => rows.map((r) => r.guest.firstName);

test('text helpers: accents, case, and every timestamp shape', () => {
  assert.equal(normalizeText('  Élodie  Ça '), '  elodie  ca ');
  assert.equal(toMs({ seconds: 5, nanoseconds: 0 }), 5000);
  assert.equal(toMs('2026-01-01T00:00:00Z'), Date.parse('2026-01-01T00:00:00Z'));
  assert.equal(toMs(new Date(7000)), 7000);
  assert.equal(toMs(9000), 9000);
  for (const bad of [null, undefined, '', 'not a date', { seconds: 'x' }]) assert.equal(toMs(bad), null, String(bad));
  assert.equal(shortWho('press@ungaro.com'), 'press');
  assert.equal(shortWho(null), '');
});

test('plus-ones are linked to their host by id, email or name', () => {
  const host = guest('h1', 'Jean', 'Dupont');
  const byId = guest('p1', 'Ann', 'A', { parentId: 'h1' });
  const byEmail = guest('p2', 'Bob', 'B', { parentId: 'JEAN.DUPONT@example.com' });
  const byName = guest('p3', 'Cy', 'C', { parentId: 'jean dupont' });
  const byAccentedName = guest('p4', 'Di', 'D', { parentId: 'DUPONT Jean' }); // "Last First" order, other case
  const unknown = guest('p5', 'Ed', 'E', { parentId: 'nobody here' });
  const self = guest('p6', 'Fi', 'F', { parentId: 'p6' });
  const hosts = resolveHosts([host, byId, byEmail, byName, byAccentedName, unknown, self]);
  for (const kid of ['p1', 'p2', 'p3', 'p4']) assert.equal(hosts.get(kid)?.id, 'h1', kid);
  assert.equal(hosts.has('p5'), false, 'an unknown host leaves the guest as an ordinary guest');
  assert.equal(hosts.has('p6'), false, 'a guest can not be their own host');
  assert.equal(hosts.has('h1'), false);
});

test('chains climb to the top host, and loops never make guests disappear', () => {
  const a = guest('a', 'A', 'A');
  const b = guest('b', 'B', 'B', { parentId: 'a' });
  const c = guest('c', 'C', 'C', { parentId: 'b' });
  assert.equal(resolveHosts([a, b, c]).get('c')?.id, 'a');

  const x = guest('x', 'X', 'X', { parentId: 'y' });
  const y = guest('y', 'Y', 'Y', { parentId: 'x' });
  const z = guest('z', 'Z', 'Z', { parentId: 'x' });
  const { rows } = buildRows([x, y, z], ALL);
  assert.deepEqual(rows.map((r) => r.guest.id).sort(), ['x', 'y', 'z'], 'every guest still appears exactly once');
});

test('with no filters every guest appears exactly once, plus-ones right under their host', () => {
  const guests = [
    guest('h1', 'Jean', 'Dupont'), guest('k2', 'Zed', 'Dupont', { parentId: 'h1' }), guest('k1', 'Amy', 'Dupont', { parentId: 'h1' }),
    guest('h2', 'Marie', 'Curie'), guest('s1', 'Solo', 'Guest'),
  ];
  const { rows, shown } = buildRows(guests, ALL);
  assert.equal(rows.length, 5);
  assert.equal(shown, 5);
  assert.equal(new Set(rows.map((r) => r.guest.id)).size, 5);
  assert.deepEqual(names(rows), ['Marie', 'Jean', 'Amy', 'Zed', 'Solo']); // Curie, Dupont (+ his kids by name), Guest
  assert.deepEqual(rows.map((r) => r.depth), [0, 0, 1, 1, 0]);
  assert.equal(rows[2].host?.id, 'h1');
  assert.deepEqual(rows[1].party, { total: 2, arrived: 0, pendingIds: ['h1', 'k1', 'k2'] }); // host, then plus-ones by name
  assert.equal(rows[0].party, null);
});

test('search ignores case and accents and needs every word', () => {
  const guests = [guest('1', 'Élodie', 'Martin', { notes: 'seat near the front' }), guest('2', 'Jean', 'Dupont'), guest('3', 'Jean', 'Durand', { category: 'Press' })];
  const find = (query: string) => names(buildRows(guests, { ...ALL, query }).rows);
  assert.deepEqual(find('ELODIE'), ['Élodie']);
  assert.deepEqual(find('jean').sort(), ['Jean', 'Jean']);
  assert.deepEqual(find('jean dup'), ['Jean']);
  assert.deepEqual(find('front'), ['Élodie'], 'finds text in notes');
  assert.deepEqual(find('press'), ['Jean'], 'finds the tag');
  assert.deepEqual(find('dupont@'), ['Jean'], 'finds email text');
  assert.deepEqual(find('nobody'), []);
});

test('searching for a host also finds their plus-ones', () => {
  const guests = [guest('h', 'Jean', 'Dupont'), guest('k', 'Amy', 'Smith', { parentId: 'h' }), guest('o', 'Other', 'Person')];
  assert.deepEqual(names(buildRows(guests, { ...ALL, query: 'dupont' }).rows), ['Jean', 'Amy']);
});

test('status and tag filters; a matching plus-one keeps its host above it, dimmed', () => {
  const guests = [
    guest('h', 'Jean', 'Dupont', { category: 'VIP' }),
    guest('k', 'Amy', 'Smith', { parentId: 'h', status: 'arrived', arrivedAt: at(10), category: 'Press' }),
    guest('o', 'Other', 'Person', { status: 'arrived', arrivedAt: at(5), category: 'vip ' }),
  ];
  const arrived = buildRows(guests, { ...ALL, status: 'arrived' });
  // Sorted by last name: Dupont (host, dimmed) with Amy under him, then Person.
  assert.deepEqual(arrived.rows.map((r) => [r.guest.firstName, r.context]), [['Jean', true], ['Amy', false], ['Other', false]]);
  assert.equal(arrived.shown, 2, 'context rows are not counted as matches');
  assert.deepEqual(arrived.rows[0].party, { total: 1, arrived: 1, pendingIds: ['h'] }, 'the dimmed host is the only one still to check in');

  const vip = buildRows(guests, { ...ALL, tag: 'vip' });
  assert.deepEqual(names(vip.rows).sort(), ['Jean', 'Other'], 'tags match regardless of case and spacing');
  assert.deepEqual(names(buildRows(guests, { ...ALL, status: 'notArrived' }).rows), ['Jean']);
});

test('party counts include every plus-one even when a filter hides some', () => {
  const guests = [
    guest('h', 'Jean', 'Dupont'),
    guest('k1', 'A', 'A', { parentId: 'h', status: 'arrived', arrivedAt: at(1) }),
    guest('k2', 'B', 'B', { parentId: 'h' }),
    guest('k3', 'C', 'C', { parentId: 'h' }),
  ];
  const rows = buildRows(guests, { ...ALL, status: 'arrived' }).rows;
  assert.deepEqual(rows[0].party, { total: 3, arrived: 1, pendingIds: ['h', 'k2', 'k3'] });
  assert.deepEqual(plusOneStats(guests), { total: 3, arrived: 1 });
});

test('sorting: name, newest, arrival time, status', () => {
  const guests = [
    guest('1', 'Cara', 'Zimmer', { status: 'confirmed', createdAt: at(300) }),
    guest('2', 'Abel', 'Young', { status: 'arrived', arrivedAt: at(50), createdAt: at(100) }),
    guest('3', 'Dana', 'Xu', { status: 'arrived', arrivedAt: at(90), createdAt: at(200) }),
    guest('4', 'Eli', 'White', { status: 'refused', createdAt: at(50) }),
    guest('5', 'Fay', 'Vance', { status: 'invited', createdAt: at(10) }),
  ];
  const order = (sort: ListOptions['sort']) => names(buildRows(guests, { ...ALL, sort }).rows);
  assert.deepEqual(order('name'), ['Fay', 'Eli', 'Dana', 'Abel', 'Cara']); // by last name: Vance, White, Xu, Young, Zimmer
  assert.deepEqual(order('newest'), ['Cara', 'Dana', 'Abel', 'Eli', 'Fay']);
  assert.deepEqual(order('arrival'), ['Dana', 'Abel', 'Fay', 'Eli', 'Cara']); // latest arrival first, then the rest by name
  assert.deepEqual(order('status'), ['Dana', 'Abel', 'Cara', 'Fay', 'Eli']); // arrived, confirmed, invited, refused
});

test('tags: counted case-insensitively, most used first, with a stable colour', () => {
  const tags = collectTags([
    guest('1', 'a', 'a', { category: 'VIP' }), guest('2', 'b', 'b', { category: ' vip' }), guest('3', 'c', 'c', { category: 'Press' }),
    guest('4', 'd', 'd', { category: '' }), guest('5', 'e', 'e', { category: undefined }), guest('6', 'f', 'f'),
  ]);
  assert.deepEqual(tags.map((t) => [t.key, t.count]), [['standard', 3], ['vip', 2], ['press', 1]]);
  assert.equal(tagHue('VIP'), tagHue(' vip '));
  assert.notEqual(tagHue('Press'), tagHue('Staff'));
  assert.ok(tagHue('x') >= 0 && tagHue('x') < 360);
});

test('counts, recent arrivals and the party still to check in', () => {
  const guests = [
    guest('h', 'Jean', 'Dupont', { status: 'arrived', arrivedAt: at(100) }),
    guest('k1', 'A', 'A', { parentId: 'h' }), guest('k2', 'B', 'B', { parentId: 'h', status: 'arrived', arrivedAt: at(200) }),
    guest('o', 'Other', 'Person', { status: 'confirmed' }), guest('r', 'Ref', 'Used', { status: 'pending' }),
  ];
  assert.deepEqual(countStatuses(guests), { all: 5, arrived: 2, notArrived: 3, confirmed: 1, invited: 2 });
  assert.deepEqual(recentArrivals(guests, 5).map((g) => g.id), ['k2', 'h']);
  assert.deepEqual(recentArrivals(guests, 1).map((g) => g.id), ['k2']);
  assert.deepEqual(pendingPartyIds(guests[0], guests), ['k1'], 'the host already arrived; only the waiting plus-one remains');
  assert.deepEqual(pendingPartyIds(guest('x', 'X', 'X'), guests), ['x']);
});

test('optimistic update: check in, undo, and leave everyone else alone', () => {
  const guests = [
    guest('1', 'A', 'A', { status: 'confirmed', confirmedAt: at(1) }), guest('2', 'B', 'B'),
    guest('3', 'C', 'C', { status: 'arrived', arrivedAt: at(5), arrivedBy: 'x@y.com', confirmedAt: at(1) }),
    guest('4', 'D', 'D', { status: 'arrived', arrivedAt: at(5), arrivedBy: 'x@y.com' }),
  ];
  const now = (T + 1000) * 1000;
  const checked = applyCheckInLocally(guests, ['1', '2', '3'], false, 'me@y.com', now);
  assert.equal(checked[0].status, 'arrived');
  assert.deepEqual(checked[0].arrivedAt, { seconds: T + 1000, nanoseconds: 0 });
  assert.equal(checked[0].arrivedBy, 'me@y.com');
  assert.equal(checked[2].arrivedBy, 'x@y.com', 'someone already checked in keeps their original time and person');
  assert.equal(checked[3], guests[3], 'untouched guests are the same object');

  const undone = applyCheckInLocally(guests, ['3', '4', '2'], true, 'me@y.com');
  assert.equal(undone[2].status, 'confirmed', 'RSVP\'d guest goes back to confirmed');
  assert.equal(undone[3].status, 'invited', 'never-confirmed guest goes back to invited');
  assert.equal(undone[2].arrivedAt, null);
  assert.equal(undone[1], guests[1], 'undoing someone who has not arrived changes nothing');
});

test('formatClock', () => {
  const now = new Date(2026, 9, 4, 22, 0).getTime();
  assert.equal(formatClock(null, now), '—');
  assert.match(formatClock(new Date(2026, 9, 4, 21, 14).getTime(), now), /9:14|21:14/);
  assert.doesNotMatch(formatClock(new Date(2026, 9, 4, 21, 14).getTime(), now), /Oct/);
  assert.match(formatClock(new Date(2026, 9, 3, 21, 14).getTime(), now), /Oct/);
});

test('export rows: hosts then plus-ones, arrival time, who checked in, extras, notes', () => {
  const guests = [
    guest('h', 'Jean', 'Dupont', { category: 'VIP', notes: 'seat near the front', status: 'arrived', arrivedAt: { seconds: Math.floor(new Date(2026, 9, 4, 21, 14).getTime() / 1000), nanoseconds: 0 }, arrivedBy: 'press@ungaro.com', extraFields: { Company: 'Acme' } }),
    guest('k', 'Amy', 'Dupont', { parentId: 'h', status: 'pending' }),
    guest('o', 'Ana', 'Bell', { status: 'accepted' }),
  ];
  const rows = buildExportRows(guests);
  assert.deepEqual(rows.map((r) => r['First name']), ['Ana', 'Jean', 'Amy']);
  const [ana, jean, amy] = rows;
  assert.equal(jean.Arrived, 'Yes');
  assert.equal(jean['Arrival time'], '2026-10-04 21:14');
  assert.equal(jean['Checked in by'], 'press@ungaro.com');
  assert.equal(jean.Tag, 'VIP');
  assert.equal(jean.Notes, 'seat near the front');
  assert.equal(jean.Company, 'Acme');
  assert.equal(amy['Plus-one of'], 'Jean Dupont');
  assert.equal(amy.Status, 'Invited');
  assert.equal(amy.Arrived, 'No');
  assert.equal(amy['Arrival time'], '');
  assert.equal(ana.Status, 'Confirmed');
  assert.equal(ana.Company, '', 'every row has every extra column');
  assert.deepEqual(Object.keys(jean).slice(0, 5), ['First name', 'Last name', 'Email', 'Tag', 'Status']);
});
