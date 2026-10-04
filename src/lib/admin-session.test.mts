import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthConfigError,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isKnownAdmin,
  readSessionToken,
  verifyLogin,
} from './admin-session.ts';

const SECRET = 's'.repeat(40);
const NOW = 1_800_000_000_000;

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  process.env.ADMIN_LOGINS = JSON.stringify({
    'Press@Ungaro.com': 'correct horse battery',
    'second@ungaro.com': 'another-long-one',
  });
});

test('the right password logs in; email is case- and space-insensitive', () => {
  assert.equal(verifyLogin('press@ungaro.com', 'correct horse battery'), true);
  assert.equal(verifyLogin('  PRESS@ungaro.COM ', 'correct horse battery'), true);
  assert.equal(verifyLogin('second@ungaro.com', 'another-long-one'), true);
});

test('wrong, near-miss, empty and unknown logins are refused', () => {
  assert.equal(verifyLogin('press@ungaro.com', 'wrong'), false);
  assert.equal(verifyLogin('press@ungaro.com', 'Correct horse battery'), false); // case matters for passwords
  assert.equal(verifyLogin('press@ungaro.com', ''), false);
  assert.equal(verifyLogin('nobody@ungaro.com', 'correct horse battery'), false);
  assert.equal(verifyLogin('second@ungaro.com', 'correct horse battery'), false); // someone else's password
  assert.equal(verifyLogin('nobody@ungaro.com', '\u0000no-such-user'), false); // the internal placeholder
});

test('non-string input is refused without throwing', () => {
  for (const bad of [undefined, null, 1, {}, []]) {
    assert.equal(verifyLogin(bad, 'x'), false);
    assert.equal(verifyLogin('press@ungaro.com', bad), false);
  }
});

test('isKnownAdmin reflects ADMIN_LOGINS, so removing someone revokes them', () => {
  assert.equal(isKnownAdmin('Second@Ungaro.com'), true);
  process.env.ADMIN_LOGINS = JSON.stringify({ 'press@ungaro.com': 'x' });
  assert.equal(isKnownAdmin('second@ungaro.com'), false);
});

test('a session token round-trips to the (lower-cased) email', () => {
  assert.equal(readSessionToken(createSessionToken('Press@Ungaro.com', NOW), NOW + 1000), 'press@ungaro.com');
});

test('a session expires after its lifetime', () => {
  const token = createSessionToken('press@ungaro.com', NOW);
  const lastGoodMs = NOW + (SESSION_MAX_AGE_SECONDS - 1) * 1000;
  assert.equal(readSessionToken(token, lastGoodMs), 'press@ungaro.com');
  assert.equal(readSessionToken(token, NOW + SESSION_MAX_AGE_SECONDS * 1000), null);
});

test('a tampered session is rejected', () => {
  const token = createSessionToken('second@ungaro.com', NOW);
  const [payload, sig] = token.split('.');

  // Swap in a payload for a different person, keeping the old signature.
  const forgedPayload = Buffer.from(JSON.stringify({ e: 'press@ungaro.com', x: 9_999_999_999 })).toString('base64url');
  assert.equal(readSessionToken(`${forgedPayload}.${sig}`, NOW), null);

  const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
  assert.equal(readSessionToken(`${payload}.${flipped}`, NOW), null);
  assert.equal(readSessionToken(`${payload}.${sig.slice(0, -4)}`, NOW), null);
  assert.equal(readSessionToken(`${payload}.`, NOW), null);
  assert.equal(readSessionToken(`${token}.extra`, NOW), null);
});

test('a session signed with a different secret is rejected', () => {
  process.env.SESSION_SECRET = 'x'.repeat(40);
  const forged = createSessionToken('press@ungaro.com', NOW);
  process.env.SESSION_SECRET = SECRET;
  assert.equal(readSessionToken(forged, NOW), null);
});

test('garbage session values are rejected without throwing', () => {
  for (const bad of [undefined, null, 5, {}, '', '.', 'abc', 'a.b', '.sig', 'x'.repeat(2000)]) {
    assert.equal(readSessionToken(bad, NOW), null, String(bad));
  }
});

test('bad configuration fails closed with a clear error', () => {
  for (const value of [undefined, '', '   ', 'not json', '[]', '"str"', '{}', '{"a@b.com":""}', '{"a@b.com":5}']) {
    if (value === undefined) delete process.env.ADMIN_LOGINS;
    else process.env.ADMIN_LOGINS = value;
    assert.throws(() => verifyLogin('a@b.com', 'x'), AuthConfigError, String(value));
    assert.throws(() => isKnownAdmin('a@b.com'), AuthConfigError, String(value));
  }
  for (const secret of [undefined, '', 'short']) {
    if (secret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = secret;
    assert.throws(() => createSessionToken('press@ungaro.com'), AuthConfigError);
    assert.throws(() => readSessionToken('a.b'), AuthConfigError);
  }
});
