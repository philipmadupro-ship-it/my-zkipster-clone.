import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCheckIn, planCheckIns, type CheckInResultItem, type GuestSnapshot } from './checkin.ts';
import { DEFAULT_TAGS, MAX_NOTES_LENGTH, MAX_TAG_LENGTH, canonicalTag, cleanNotes } from './guest-fields.ts';
import { buildWorkbook, exportFileName } from './export-guests.ts';
import XLSX from 'xlsx';

const NOW = { marker: 'now' };
const by = 'second@ungaro.com';
const snap = (id: string, data?: GuestSnapshot['data']): GuestSnapshot => ({ id, exists: data !== undefined, data });

test('checking in someone who has not arrived records when and by whom', () => {
  const [plan] = planCheckIns([snap('a', { name: 'Ann', status: 'confirmed' })], { undo: false, by, arrivedAtValue: NOW });
  assert.equal(plan.outcome, 'checked_in');
  assert.deepEqual(plan.update, { status: 'arrived', arrivedAt: NOW, arrivedBy: by });
  assert.equal(plan.arrivedBy, by);
  assert.equal(plan.name, 'Ann');
});

test('invited, pending and even refused guests can be checked in at the door', () => {
  for (const status of ['invited', 'pending', 'confirmed', 'accepted', 'refused', undefined]) {
    const [plan] = planCheckIns([snap('a', { name: 'X', status })], { undo: false, by, arrivedAtValue: NOW });
    assert.equal(plan.outcome, 'checked_in', String(status));
  }
});

test('checking in someone already checked in changes nothing and says when and by whom', () => {
  const earlier = { seconds: 123 };
  const [plan] = planCheckIns(
    [snap('a', { name: 'Ann', status: 'arrived', arrivedAt: earlier, arrivedBy: 'press@ungaro.com' })],
    { undo: false, by, arrivedAtValue: NOW },
  );
  assert.equal(plan.outcome, 'already_checked_in');
  assert.equal(plan.update, undefined, 'must not overwrite the first check-in');
  assert.equal(plan.arrivedAt, earlier);
  assert.equal(plan.arrivedBy, 'press@ungaro.com');
});

test('an older check-in with no recorded person still reports as already checked in', () => {
  const [plan] = planCheckIns([snap('a', { status: 'arrived', arrivedAt: { seconds: 1 } })], { undo: false, by, arrivedAtValue: NOW });
  assert.equal(plan.outcome, 'already_checked_in');
  assert.equal(plan.arrivedBy, null);
});

test('undo returns RSVP-confirmed guests to confirmed and the rest to invited', () => {
  const plans = planCheckIns(
    [
      snap('a', { status: 'arrived', confirmedAt: { seconds: 1 }, arrivedAt: { seconds: 2 }, arrivedBy: 'x' }),
      snap('b', { status: 'arrived', arrivedAt: { seconds: 2 }, arrivedBy: 'x' }),
    ],
    { undo: true, by, arrivedAtValue: NOW },
  );
  assert.deepEqual(plans[0].update, { status: 'confirmed', arrivedAt: null, arrivedBy: null });
  assert.deepEqual(plans[1].update, { status: 'invited', arrivedAt: null, arrivedBy: null });
  assert.deepEqual(plans.map((p) => p.outcome), ['undone', 'undone']);
});

test('undoing someone who has not arrived, and unknown guests, change nothing', () => {
  const plans = planCheckIns([snap('a', { status: 'confirmed' }), snap('gone')], { undo: true, by, arrivedAtValue: NOW });
  assert.deepEqual(plans.map((p) => p.outcome), ['not_checked_in', 'not_found']);
  assert.ok(plans.every((p) => p.update === undefined));
  const [missing] = planCheckIns([snap('gone')], { undo: false, by, arrivedAtValue: NOW });
  assert.equal(missing.outcome, 'not_found');
});

test('a whole party is handled in one go, each guest on their own merits', () => {
  const plans = planCheckIns(
    [snap('host', { name: 'Host', status: 'confirmed' }), snap('kid1', { name: 'K1', status: 'invited' }), snap('kid2', { name: 'K2', status: 'arrived', arrivedAt: { seconds: 9 }, arrivedBy: 'p' }), snap('ghost')],
    { undo: false, by, arrivedAtValue: NOW },
  );
  assert.deepEqual(plans.map((p) => [p.id, p.outcome]), [['host', 'checked_in'], ['kid1', 'checked_in'], ['kid2', 'already_checked_in'], ['ghost', 'not_found']]);
});

test('tags: tidy up, keep the usual spelling for built-ins, default to Standard', () => {
  assert.equal(canonicalTag('vip'), 'VIP');
  assert.equal(canonicalTag('  PRESS '), 'Press');
  assert.equal(canonicalTag('Front   Row'), 'Front Row');
  assert.equal(canonicalTag('Gift Bag'), 'Gift Bag');
  for (const empty of ['', '   ', undefined, null, 5, {}]) assert.equal(canonicalTag(empty), 'Standard', String(empty));
  assert.equal(canonicalTag('x'.repeat(100)).length, MAX_TAG_LENGTH);
  assert.ok(DEFAULT_TAGS.includes('Standard') && DEFAULT_TAGS.includes('VIP'));
});

test('notes: trimmed, limited, line breaks normalised, junk becomes empty', () => {
  assert.equal(cleanNotes('  seat near the front \r\n second line '), 'seat near the front \n second line');
  assert.equal(cleanNotes('y'.repeat(900)).length, MAX_NOTES_LENGTH);
  for (const junk of [undefined, null, 3, {}, []]) assert.equal(cleanNotes(junk), '');
});

test('export: a real .xlsx round-trips, accents survive, and formula-looking names stay plain text', () => {
  const rows = [
    { 'First name': 'Élodie', 'Last name': 'Martin', Notes: 'seat near the front' },
    { 'First name': '=HYPERLINK("http://evil.example","click")', 'Last name': '+SUM(1,1)', Notes: '@cmd' },
  ];
  const buffer = XLSX.write(buildWorkbook(XLSX as never, rows), { type: 'buffer', bookType: 'xlsx' });
  const sheet = XLSX.read(buffer, { cellStyles: true }).Sheets['Guest list']; // cellStyles brings back column widths

  assert.equal(sheet.A1.v, 'First name');
  assert.equal(sheet.A2.v, 'Élodie');
  assert.equal(sheet.A3.v, '=HYPERLINK("http://evil.example","click")');
  assert.equal(sheet.A3.t, 's', 'stored as text, never as a formula');
  assert.equal(sheet.A3.f, undefined);
  assert.equal(sheet.B3.t, 's');
  assert.equal(sheet.C3.f, undefined);
  assert.equal(XLSX.utils.sheet_to_json(sheet).length, 2);
  assert.ok(sheet['!cols'] && sheet['!cols'].length === 3);
});

test('export file name is tidy and dated', () => {
  const day = new Date(2026, 9, 4);
  assert.equal(exportFileName('Ungaro FW26 — Show', day), 'Ungaro-FW26-Show-guest-list-2026-10-04.xlsx');
  assert.equal(exportFileName('Élodie & Co.', day), 'Elodie-Co-guest-list-2026-10-04.xlsx');
  assert.equal(exportFileName('???', day), 'event-guest-list-2026-10-04.xlsx');
});

const fmt = () => '21:14';
const item = (name: string, outcome: CheckInResultItem['outcome'], arrivedBy?: string): CheckInResultItem => ({ id: name, name, outcome, arrivedAt: 1, arrivedBy });

test('messages: a normal check-in, a party, and an undo', () => {
  assert.deepEqual(describeCheckIn([item('Ann', 'checked_in')], false, fmt), { text: 'Ann checked in', kind: 'success' });
  assert.deepEqual(describeCheckIn([item('Ann', 'checked_in'), item('Bo', 'checked_in'), item('Cy', 'checked_in')], false, fmt), { text: '3 guests checked in', kind: 'success' });
  assert.deepEqual(describeCheckIn([item('Ann', 'undone')], true, fmt), { text: 'Ann: check-in undone', kind: 'success' });
  assert.deepEqual(describeCheckIn([item('Ann', 'undone'), item('Bo', 'undone')], true, fmt), { text: '2 check-ins undone', kind: 'success' });
});

test('messages: already checked in says when and by whom, as a warning', () => {
  assert.deepEqual(
    describeCheckIn([item('Ann', 'already_checked_in', 'press@ungaro.com')], false, fmt),
    { text: 'Ann was already checked in at 21:14 by press', kind: 'warning' },
  );
  assert.equal(describeCheckIn([item('Ann', 'already_checked_in')], false, fmt).text, 'Ann was already checked in at 21:14', 'no "by" when it was not recorded');
  const mixed = describeCheckIn([item('Ann', 'checked_in'), item('Bo', 'already_checked_in', 'second@ungaro.com'), item('Cy', 'not_found')], false, fmt);
  assert.equal(mixed.kind, 'warning');
  assert.equal(mixed.text, 'Ann checked in. Bo was already checked in at 21:14 by second. 1 not found');
});

test('messages: nothing to undo, and unknown guests', () => {
  assert.equal(describeCheckIn([item('Ann', 'not_checked_in')], true, fmt).kind, 'warning');
  assert.deepEqual(describeCheckIn([item('', 'not_found')], false, fmt), { text: 'Guest not found', kind: 'error' });
  assert.equal(describeCheckIn([item('', 'not_found'), item('', 'not_found')], false, fmt).text, 'None of those guests were found');
});
