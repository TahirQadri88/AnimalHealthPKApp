import { describe, it, expect, vi } from 'vitest';
import { requestPersistentStorage, storageEstimate, isStoragePersisted } from './offlineStorage';

const api = (over = {}) => ({
  persisted: vi.fn().mockResolvedValue(false),
  persist: vi.fn().mockResolvedValue(true),
  estimate: vi.fn().mockResolvedValue({ usage: 5_000_000, quota: 100_000_000 }),
  ...over,
});

describe('requestPersistentStorage', () => {
  it('asks, and reports that it was granted', async () => {
    const s = api();
    expect(await requestPersistentStorage(s)).toBe(true);
    expect(s.persist).toHaveBeenCalled();
  });

  it('reports a refusal rather than pretending', async () => {
    expect(await requestPersistentStorage(api({ persist: vi.fn().mockResolvedValue(false) }))).toBe(false);
  });

  // Asking again can re-prompt in some browsers, and there is nothing to gain by it.
  it('does not ask again when it has already been granted', async () => {
    const s = api({ persisted: vi.fn().mockResolvedValue(true) });
    expect(await requestPersistentStorage(s)).toBe(true);
    expect(s.persist).not.toHaveBeenCalled();
  });

  it('is null where the API does not exist — an old browser, or plain HTTP', async () => {
    expect(await requestPersistentStorage(undefined)).toBeNull();
    expect(await requestPersistentStorage({})).toBeNull();
    expect(await requestPersistentStorage({ persist: vi.fn() })).toBeNull();
  });

  // This runs at start-up, and a start-up path that can throw is a white screen.
  it('never throws, whatever the browser does', async () => {
    await expect(requestPersistentStorage(api({ persist: vi.fn().mockRejectedValue(new Error('nope')) })))
      .resolves.toBeNull();
    await expect(requestPersistentStorage(api({ persisted: vi.fn(() => { throw new Error('nope'); }) })))
      .resolves.toBeNull();
  });
});

describe('storageEstimate', () => {
  it('reports what is used, what is allowed, and the share of it', async () => {
    expect(await storageEstimate(api())).toEqual({ usage: 5_000_000, quota: 100_000_000, percentUsed: 5 });
  });

  it('is null when the browser will not say', async () => {
    expect(await storageEstimate(undefined)).toBeNull();
    expect(await storageEstimate({})).toBeNull();
    expect(await storageEstimate(api({ estimate: vi.fn().mockResolvedValue({}) }))).toBeNull();
  });

  it('does not divide by a zero quota', async () => {
    expect(await storageEstimate(api({ estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }) }))).toBeNull();
  });

  it('never throws', async () => {
    await expect(storageEstimate(api({ estimate: vi.fn().mockRejectedValue(new Error('x')) })))
      .resolves.toBeNull();
  });
});

describe('isStoragePersisted', () => {
  it('answers without asking for anything', async () => {
    const s = api({ persisted: vi.fn().mockResolvedValue(true) });
    expect(await isStoragePersisted(s)).toBe(true);
    expect(s.persist).not.toHaveBeenCalled();
  });

  it('is null when the browser has no opinion, and never throws', async () => {
    expect(await isStoragePersisted(undefined)).toBeNull();
    await expect(isStoragePersisted(api({ persisted: vi.fn().mockRejectedValue(new Error('x')) })))
      .resolves.toBeNull();
  });
});
