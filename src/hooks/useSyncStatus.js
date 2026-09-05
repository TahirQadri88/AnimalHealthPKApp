// The sync indicator's data source.
//
// useSyncExternalStore rather than useState, because the store is a plain module — a queued
// write can be sent by a different tab, and a counter living in one tab's React state would
// never see it. The store must return the identical object when nothing has changed or this
// re-renders forever; syncStatus.js has a test for exactly that.
import { useSyncExternalStore, useEffect } from 'react';
import { subscribeSyncStatus, getSyncSnapshot, publishOnline } from '../lib/syncStatus';

export const useSyncStatus = () => {
  // The browser's own signal, which is the only one that reports a clean disconnect
  // immediately. Firestore's fromCache follows a few seconds later.
  useEffect(() => {
    publishOnline(typeof navigator === 'undefined' || navigator.onLine !== false);
    const on = () => publishOnline(true);
    const off = () => publishOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return useSyncExternalStore(subscribeSyncStatus, getSyncSnapshot, getSyncSnapshot);
};
