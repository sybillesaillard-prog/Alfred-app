import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "../context/AuthContext";

/**
 * Realtime-synced Firestore collection scoped to the current user:
 * users/{uid}/{collectionName}
 *
 * Works offline thanks to Firestore's persistent local cache — writes made
 * without network queue up and sync automatically once back online, on
 * whichever device made them.
 */
export function useCollection(collectionName, orderByField = "createdAt") {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ref = collection(db, "users", user.uid, collectionName);
    const q = orderByField ? query(ref, orderBy(orderByField, "desc")) : ref;
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(`Erreur de synchro (${collectionName}):`, err);
        setLoading(false);
      }
    );
    return unsub;
  }, [user, collectionName, orderByField]);

  const add = (data) => {
    if (!user) return Promise.reject(new Error("Non connecté"));
    const ref = collection(db, "users", user.uid, collectionName);
    return addDoc(ref, { ...data, createdAt: serverTimestamp() });
  };

  const update = (id, data) => {
    if (!user) return Promise.reject(new Error("Non connecté"));
    const ref = doc(db, "users", user.uid, collectionName, id);
    return updateDoc(ref, data);
  };

  const remove = (id) => {
    if (!user) return Promise.reject(new Error("Non connecté"));
    const ref = doc(db, "users", user.uid, collectionName, id);
    return deleteDoc(ref);
  };

  return { items, loading, add, update, remove };
}
