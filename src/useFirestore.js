import { useEffect, useState } from 'react';
import { db, collection, onSnapshot, doc, setDoc, deleteDoc } from './firebase';

function useLiveCollection(collectionName) {
  const [data, setData] = useState([]);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => items.push(doc.data()));
      setData(items.sort((a, b) => (a.id > b.id ? 1 : -1)));
    }, (error) => { console.error(`Error fetching ${collectionName}:`, error); });
    return () => unsubscribe();
  }, [collectionName]);
  return data;
}

export default useFirestoreCollection;
