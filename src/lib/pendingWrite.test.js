import { describe, it, expect, vi, afterEach } from 'vitest';
import { settleWrite, isAccepted, SYNCED, QUEUED, FAILED } from './pendingWrite';

afterEach(() => { vi.useRealTimers(); });

const never = () => new Promise(() => {});

describe('settleWrite', () => {
  it('is SYNCED when the server acknowledges', async () => {
    expect(await settleWrite(Promise.resolve())).toBe(SYNCED);
  });

  it('is FAILED when the write is rejected outright', async () => {
    expect(await settleWrite(Promise.reject(new Error('permission-denied')))).toBe(FAILED);
  });

  // The whole point. Offline, setDoc's promise never settles — the write is in the local
  // cache and the durable queue, and the caller must be allowed to carry on.
  it('is QUEUED when the server never answers', async () => {
    vi.useFakeTimers();
    const result = settleWrite(never(), { timeoutMs: 1500 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toBe(QUEUED);
  });

  it('does not give up before the timeout', async () => {
    vi.useFakeTimers();
    let done = false;
    settleWrite(never(), { timeoutMs: 1500 }).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(1400);
    expect(done).toBe(false);
  });

  it('never rejects, whatever the write does', async () => {
    await expect(settleWrite(Promise.reject(new Error('boom')))).resolves.toBe(FAILED);
    await expect(settleWrite(Promise.reject('a string, not an Error'))).resolves.toBe(FAILED);
  });

  it('accepts a value that is not a promise at all', async () => {
    expect(await settleWrite(undefined)).toBe(SYNCED);
  });

  // A write the rules refuse is only refused once it reaches the server, which may be long
  // after we told the caller it was queued.
  it('reports a rejection that arrives after it said QUEUED', async () => {
    vi.useFakeTimers();
    const onLateFailure = vi.fn();
    let reject;
    const ack = new Promise((_, r) => { reject = r; });
    const result = settleWrite(ack, { timeoutMs: 1500, onLateFailure });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toBe(QUEUED);

    reject(new Error('permission-denied'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onLateFailure).toHaveBeenCalledTimes(1);
    expect(onLateFailure.mock.calls[0][0].message).toBe('permission-denied');
  });

  it('does not call onLateFailure when the write simply succeeded', async () => {
    const onLateFailure = vi.fn();
    expect(await settleWrite(Promise.resolve(), { onLateFailure })).toBe(SYNCED);
    expect(onLateFailure).not.toHaveBeenCalled();
  });

  it('does not call onLateFailure when it already reported FAILED', async () => {
    const onLateFailure = vi.fn();
    expect(await settleWrite(Promise.reject(new Error('x')), { onLateFailure })).toBe(FAILED);
    await Promise.resolve();
    expect(onLateFailure).not.toHaveBeenCalled();
  });

  it('survives a reporter that throws, because reporting must not break a write', async () => {
    vi.useFakeTimers();
    let reject;
    const ack = new Promise((_, r) => { reject = r; });
    const result = settleWrite(ack, { timeoutMs: 10, onLateFailure: () => { throw new Error('reporter broke'); } });
    await vi.advanceTimersByTimeAsync(10);
    expect(await result).toBe(QUEUED);
    expect(() => reject(new Error('x'))).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
  });

  it('stops the timer once the server answers, so nothing fires later', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'clearTimeout');
    await settleWrite(Promise.resolve());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// The trap this predicate exists to close: all three outcomes are non-empty strings, so a
// truthiness check passes for FAILED too.
describe('isAccepted', () => {
  it('is true for the two outcomes that mean the data is safe', () => {
    expect(isAccepted(SYNCED)).toBe(true);
    expect(isAccepted(QUEUED)).toBe(true);
  });

  it('is false only for FAILED', () => {
    expect(isAccepted(FAILED)).toBe(false);
  });

  it('guards the mistake it was written for', () => {
    // `if (result)` would be true here, which is how a failure gets counted as a success.
    expect(Boolean(FAILED)).toBe(true);
    expect(isAccepted(FAILED)).toBe(false);
  });
});
