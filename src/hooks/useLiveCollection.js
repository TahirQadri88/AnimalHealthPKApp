// React is imported as a namespace because the moved body calls React.useState; the body
// is left byte-identical rather than tidied, so the extraction stays a pure move.
import React, { useEffect } from 'react';
import { db, collection, onSnapshot } from '../firebase';

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
const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
const items = [];
snapshot.forEach((d) => items.push(d.data()));
setData(items.sort((a, b) => (a.id > b.id ? 1 : -1)));
}, (error) => { console.error('Error fetching ' + collectionName + ':', error); });
return () => unsubscribe();
}, [collectionName, authKey]);
return data;
}
