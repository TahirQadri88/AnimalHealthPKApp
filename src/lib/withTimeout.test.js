import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout } from './withTimeout';

afterEach(() => { vi.useRealTimers(); });
const never = () => new Promise(() => {});

describe('withTimeout', () => {
  it('passes the value through when the promise answers in time', async () => {
    expect(await withTimeout(Promise.resolve(8477), 1000, null)).toBe(8477);
  });

  // The bug this exists for: a Firestore transaction offline neither resolves nor rejects.
  it('falls back when the promise never answers', async () => {
    vi.useFakeTimers();
    const result = withTimeout(never(), 5000, 'fallback');
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toBe('fallback');
  });

  it('does not give up early', async () => {
    vi.useFakeTimers();
    let done = false;
    withTimeout(never(), 5000, null).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(4900);
    expect(done).toBe(false);
  });

  it('falls back when the promise rejects', async () => {
    expect(await withTimeout(Promise.reject(new Error('unavailable')), 1000, null)).toBeNull();
  });

  it('never rejects', async () => {
    await expect(withTimeout(Promise.reject('not an Error'), 10, 'x')).resolves.toBe('x');
  });

  it('says whether it timed out or failed, so the caller can log the difference', async () => {
    vi.useFakeTimers();
    const onFailure = vi.fn();
    const timedOut = withTimeout(never(), 100, null, onFailure);
    await vi.advanceTimersByTimeAsync(100);
    await timedOut;
    expect(onFailure).toHaveBeenCalledWith(null);

    onFailure.mockClear();
    vi.useRealTimers();
    const err = new Error('permission-denied');
    await withTimeout(Promise.reject(err), 100, null, onFailure);
    expect(onFailure).toHaveBeenCalledWith(err);
  });

  it('does not report anything when the promise simply worked', async () => {
    const onFailure = vi.fn();
    await withTimeout(Promise.resolve(1), 100, null, onFailure);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('reports nothing twice when a rejection lands after the timeout', async () => {
    vi.useFakeTimers();
    const onFailure = vi.fn();
    let reject;
    const p = new Promise((_, r) => { reject = r; });
    const result = withTimeout(p, 100, 'fallback', onFailure);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe('fallback');
    reject(new Error('late'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(null);
  });

  it('survives a reporter that throws', async () => {
    await expect(withTimeout(Promise.reject(new Error('x')), 10, 'ok', () => { throw new Error('reporter'); }))
      .resolves.toBe('ok');
  });
});
