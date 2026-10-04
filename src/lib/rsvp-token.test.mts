// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  RsvpConfigError,
  requireRsvpSecret,
  resolveGuestId,
  signGuestToken,
  tryResolveGuestId,
} from './rsvp-token.ts';

const SECRET = 'a'.repeat(40);
const ID = 'AbC123xyz890QwErTy12';

beforeEach(() => {
  process.env.RSVP_LINK_SECRET = SECRET;
  delete process.env.RSVP_ALLOW_LEGACY_LINKS;
});

test('a signed token resolves back to its guest id', () => {
  assert.equal(resolveGuestId(signGuestToken(ID)), ID);
});

test('tokens are deterministic and differ per guest', () => {
  assert.equal(signGuestToken(ID), signGuestToken(ID));
  assert.notEqual(signGuestToken(ID), signGuestToken('OtherGuest0000000001'));
});

test('a signature for one guest is rejected for another', () => {
  const sig = signGuestToken(ID).split('.')[1];
  assert.equal(resolveGuestId(`OtherGuest0000000001.${sig}`), null);
});

test('tampered or truncated signatures are rejected', () => {
  const token = signGuestToken(ID);
  const flipped = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
  assert.equal(resolveGuestId(flipped), null);
  assert.equal(resolveGuestId(token.slice(0, -5)), null);
  assert.equal(resolveGuestId(`${ID}.`), null);
  assert.equal(resolveGuestId(`${token}.extra`), null);
});

test('a token signed with a different secret is rejected', () => {
  process.env.RSVP_LINK_SECRET = 'b'.repeat(40);
  const forged = signGuestToken(ID);
  process.env.RSVP_LINK_SECRET = SECRET;
  assert.equal(resolveGuestId(forged), null);
});

test('malformed input is rejected without throwing', () => {
  for (const bad of [undefined, null, 42, {}, '', '.', '..', `a/b.${'x'.repeat(43)}`, 'x'.repeat(300)]) {
    assert.equal(resolveGuestId(bad), null, String(bad));
  }
});

test('legacy bare guest ids work by default and can be switched off', () => {
  assert.equal(resolveGuestId(ID), ID);
  process.env.RSVP_ALLOW_LEGACY_LINKS = 'false';
  assert.equal(resolveGuestId(ID), null);
  assert.equal(resolveGuestId(signGuestToken(ID)), ID); // signed links are unaffected
});

test('legacy ids with unsafe characters are rejected', () => {
  assert.equal(resolveGuestId('a/b'), null);
  assert.equal(resolveGuestId('../x'), null);
});

test('signing refuses ids that are not plain document ids', () => {
  assert.throws(() => signGuestToken('a/b'));
  assert.throws(() => signGuestToken('a.b'));
  assert.throws(() => signGuestToken(''));
});

test('a missing or short secret fails closed', () => {
  for (const secret of [undefined, '', 'short']) {
    if (secret === undefined) delete process.env.RSVP_LINK_SECRET;
    else process.env.RSVP_LINK_SECRET = secret;

    assert.throws(() => requireRsvpSecret(), RsvpConfigError);
    assert.throws(() => signGuestToken(ID), RsvpConfigError);
    assert.throws(() => resolveGuestId(`${ID}.${'x'.repeat(43)}`), RsvpConfigError);
    // The page helper turns the config error into "not found" instead of a 500.
    assert.equal(tryResolveGuestId(`${ID}.${'x'.repeat(43)}`), null);
  }
});

test('legacy ids still resolve while the secret is unset (deploy continuity)', () => {
  delete process.env.RSVP_LINK_SECRET;
  assert.equal(resolveGuestId(ID), ID);
});
