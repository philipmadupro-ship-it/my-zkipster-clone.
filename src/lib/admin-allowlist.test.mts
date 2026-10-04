import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowlistConfigured, isAllowlisted, isExactlyListed } from './admin-allowlist.ts';

beforeEach(() => {
  process.env.ADMIN_EMAILS = ' Press@Ungaro.com , @partner.com ';
});

test('exact entries match regardless of case and spacing', () => {
  assert.equal(isAllowlisted('press@ungaro.com'), true);
  assert.equal(isAllowlisted('  PRESS@UNGARO.COM '), true);
  assert.equal(isAllowlisted('other@ungaro.com'), false);
});

test('domain entries allow anyone at that domain, but not look-alikes', () => {
  assert.equal(isAllowlisted('anyone@partner.com'), true);
  assert.equal(isAllowlisted('anyone@notpartner.com'), false);
  assert.equal(isAllowlisted('anyone@partner.com.evil.io'), false);
});

test('only a fully written address counts as exactly listed', () => {
  assert.equal(isExactlyListed('press@ungaro.com'), true);
  assert.equal(isExactlyListed('Press@Ungaro.com'), true);
  assert.equal(isExactlyListed('anyone@partner.com'), false); // covered by a domain entry only
  assert.equal(isExactlyListed('other@ungaro.com'), false);
});

test('nothing is listed or allowed when ADMIN_EMAILS is unset or blank', () => {
  for (const value of [undefined, '', ' , ,']) {
    if (value === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = value;
    assert.equal(isAllowlistConfigured(), false);
    assert.equal(isAllowlisted('press@ungaro.com'), false);
    assert.equal(isExactlyListed('press@ungaro.com'), false);
  }
});
