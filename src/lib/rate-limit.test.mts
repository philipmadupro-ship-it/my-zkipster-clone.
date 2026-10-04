import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFailureLimiter } from './rate-limit.ts';

const T0 = 1_000_000;

test('allows attempts until the limit, then says how long to wait', () => {
  const limiter = createFailureLimiter(3, 60_000);
  for (let i = 0; i < 2; i++) limiter.recordFailure('k', T0);
  assert.equal(limiter.retryAfterSeconds('k', T0), 0);
  limiter.recordFailure('k', T0);
  assert.equal(limiter.retryAfterSeconds('k', T0), 60);
  assert.equal(limiter.retryAfterSeconds('k', T0 + 45_000), 15);
});

test('the block lifts when the window ends', () => {
  const limiter = createFailureLimiter(1, 60_000);
  limiter.recordFailure('k', T0);
  assert.ok(limiter.retryAfterSeconds('k', T0 + 59_000) > 0);
  assert.equal(limiter.retryAfterSeconds('k', T0 + 60_000), 0);
});

test('keys are independent, and a success can reset one', () => {
  const limiter = createFailureLimiter(1, 60_000);
  limiter.recordFailure('a', T0);
  assert.ok(limiter.retryAfterSeconds('a', T0) > 0);
  assert.equal(limiter.retryAfterSeconds('b', T0), 0);
  limiter.reset('a');
  assert.equal(limiter.retryAfterSeconds('a', T0), 0);
});
