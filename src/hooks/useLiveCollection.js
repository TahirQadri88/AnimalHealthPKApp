// React is imported as a namespace because the moved body calls React.useState; the body
// is left byte-identical rather than tidied, so the extraction stays a pure move.
import React, { useEffect } from 'react';
import { db, collection, onSnapshot } from '../firebase';
import { publishCollectionMeta, countPending } from '../lib/syncStatus';

/**
 * Subscribe to a whole collection.
 *
 * Every one of these is unbounded, which is the app's largest scaling weakness and is
 * deliberate for now — see docs/FIRESTORE_READS.md before adding another, and note that
 * bounding the invoice or payment listener by date is NOT safe: customer balances, the
 * aging report and the Previous Balance printed on invoices all read full history.
 */
export function useLiveCollection(collectionName, authKey) {
const [data, setData] = React.useState([]);
useEffect(() => {
// Do not subscribe until somebody is signed in. authKey is undefined until Firebase
// reports, then null when signed out, then a uid.
//
// Subscribing earlier is pure waste and it was costing real money: the listener attached
// on the login screen, pulled the whole collection, and was then torn down and replaced
// the moment authKey changed to the uid — a second full read of every collection on every
// page load. Nothing before sign-in needs this data; login reads its two documents
// directly with getDoc.
if (!authKey) { setData([]); return undefined; }
// includeMetadataChanges is what makes the sync indicator possible: without it the
// listener does not fire when a queued write is finally acknowledged, so a pending count
// would stick at "1 waiting to sync" forever. It costs no reads — a metadata-only event
// delivers no documents, and Firestore bills per document.
const unsubscribe = onSnapshot(collection(db, collectionName), { includeMetadataChanges: true }, (snapshot) => {
publishCollectionMeta(collectionName, {
  fromCache: snapshot.metadata.fromCache,
  pending: countPending(snapshot),
});
// docChanges() excludes metadata-only changes by default, and that is the point: without
// this guard, acknowledging fifty queued writes after a long outage would re-render the
// whole app fifty times, recomputing every analytics useMemo over every invoice on a
// phone. The data has not changed; only its status has.
if (snapshot.docChanges().length === 0) return;
const items = [];
snapshot.forEach((d) => items.push(d.data()));
setData(items.sort((a, b) => (a.id > b.id ? 1 : -1)));
}, (error) => { console.error('Error fetching ' + collectionName + ':', error); });
return () => unsubscribe();
}, [collectionName, authKey]);
return data;
}
