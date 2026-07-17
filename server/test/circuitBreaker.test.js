'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { CircuitBreaker, CircuitOpenError, State } = require('../src/circuitBreaker');

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

const fail = (msg = 'upstream exploded') => () => Promise.reject(new Error(msg));
const succeed = (v = 'ok') => () => Promise.resolve(v);

test('stays closed while calls succeed', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });
  for (let i = 0; i < 10; i++) assert.equal(await cb.execute(succeed()), 'ok');
  assert.equal(cb.state, State.CLOSED);
});

test('trips to OPEN after the failure threshold', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });

  for (let i = 0; i < 3; i++) {
    await assert.rejects(cb.execute(fail()));
  }

  assert.equal(cb.state, State.OPEN);
  assert.equal(cb.snapshot().trips, 1);
});

test('an OPEN circuit rejects without calling upstream', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 1 });
  await assert.rejects(cb.execute(fail()));
  assert.equal(cb.state, State.OPEN);

  let called = false;
  await assert.rejects(
    cb.execute(async () => { called = true; }),
    (err) => err instanceof CircuitOpenError && err.code === 'CIRCUIT_OPEN'
  );

  assert.equal(called, false, 'the whole point is NOT touching a known-dead upstream');
});

test('a success run resets the failure count (failures must be consecutive)', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });

  await assert.rejects(cb.execute(fail()));
  await assert.rejects(cb.execute(fail()));
  await cb.execute(succeed()); // resets

  await assert.rejects(cb.execute(fail()));
  await assert.rejects(cb.execute(fail()));

  assert.equal(cb.state, State.CLOSED, 'scattered failures over time must not trip it');
});

test('moves to HALF_OPEN after the reset timeout and closes on recovery', async () => {
  const clock = fakeClock();
  const cb = new CircuitBreaker({
    failureThreshold: 1, successThreshold: 2, resetTimeoutMs: 30_000, now: clock.now,
  });

  await assert.rejects(cb.execute(fail()));
  assert.equal(cb.state, State.OPEN);

  clock.advance(29_999);
  await assert.rejects(cb.execute(succeed()), CircuitOpenError, 'still open before timeout');

  clock.advance(2);
  assert.equal(await cb.execute(succeed()), 'ok', 'probe admitted after timeout');
  assert.equal(cb.state, State.HALF_OPEN, 'one success is not enough to close');

  assert.equal(await cb.execute(succeed()), 'ok');
  assert.equal(cb.state, State.CLOSED, 'closes after successThreshold probes');
});

test('a failed probe re-opens immediately and restarts the cooldown', async () => {
  const clock = fakeClock();
  const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 10_000, now: clock.now });

  await assert.rejects(cb.execute(fail()));
  await assert.rejects(cb.execute(fail()));
  assert.equal(cb.state, State.OPEN);

  clock.advance(10_001);
  await assert.rejects(cb.execute(fail()), /upstream exploded/);

  assert.equal(cb.state, State.OPEN, 'a failed probe must not burn the remaining threshold');
  await assert.rejects(cb.execute(succeed()), CircuitOpenError, 'cooldown restarted');
});

test('HALF_OPEN admits only one probe at a time', async () => {
  const clock = fakeClock();
  const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1_000, now: clock.now });

  await assert.rejects(cb.execute(fail()));
  clock.advance(1_001);

  let resolveProbe;
  const probe = cb.execute(() => new Promise((r) => { resolveProbe = r; }));

  // A second caller arrives while the probe is still in flight.
  await assert.rejects(cb.execute(succeed()), CircuitOpenError, 'must not stampede a recovering upstream');

  resolveProbe('ok');
  assert.equal(await probe, 'ok');
});

test('errors excluded by isFailure do not trip the breaker', async () => {
  // A 404 means upstream is healthy and answering. Counting it would trip the
  // breaker on a user typing a handle that does not exist.
  const cb = new CircuitBreaker({
    failureThreshold: 2,
    isFailure: (err) => (err.status ?? 500) >= 500,
  });

  const notFound = () => Promise.reject(Object.assign(new Error('no such user'), { status: 404 }));

  for (let i = 0; i < 10; i++) await assert.rejects(cb.execute(notFound));

  assert.equal(cb.state, State.CLOSED, '404s are not an upstream health signal');
  assert.equal(cb.snapshot().trips, 0);
});

test('reports retryAfterMs so callers know when to come back', async () => {
  const clock = fakeClock();
  const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 30_000, now: clock.now });

  await assert.rejects(cb.execute(fail()));
  clock.advance(10_000);

  await assert.rejects(cb.execute(succeed()), (err) => {
    assert.equal(err.retryAfterMs, 20_000, 'remaining cooldown, not the full timeout');
    return true;
  });
});

test('concurrent failures trip exactly once', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 3 });

  await Promise.allSettled(Array.from({ length: 20 }, () => cb.execute(fail())));

  assert.equal(cb.state, State.OPEN);
  assert.equal(cb.snapshot().trips, 1, 'a burst of failures is one outage, not twenty');
});
