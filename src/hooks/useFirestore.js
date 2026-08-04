import { useEffect, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

/**
 * Realtime-subscribe to a Firestore collection (optionally with query
 * constraints). `constraints` may reference outside values (e.g. the
 * signed-in user's id) that aren't known on the first render — pass a
 * `depKey` (any primitive) that changes whenever those values do, so the
 * subscription rebuilds with the fresh constraints. Constraints built only
 * from literals (orderBy, a fixed where) don't need a depKey.
 */
export function useCollection(path, constraints = [], depKey) {
  const [state, setState] = useState({ data: [], loading: isFirebaseConfigured, error: null });
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ data: [], loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    const q = query(collection(db, path), ...constraintsRef.current);
    const unsub = onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error })
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, depKey]);

  return state;
}

/**
 * Same as useCollection, but when no Firebase project is connected yet
 * (`isFirebaseConfigured === false`) it serves the given static demo array
 * instead of an empty list — so the whole UI stays clickable/demoable
 * before a real backend is wired up, and switches over automatically the
 * moment `.env.local` is filled in.
 */
export function useLiveOrDemo(path, constraints, demoData, depKey) {
  const live = useCollection(path, constraints, depKey);
  if (!isFirebaseConfigured) {
    return { data: demoData, loading: false, error: null, demo: true };
  }
  return { ...live, demo: false };
}

/** Realtime-subscribe to a single Firestore document. */
export function useDoc(path) {
  const [state, setState] = useState({ data: null, loading: isFirebaseConfigured, error: null });

  useEffect(() => {
    if (!path || !isFirebaseConfigured) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    const unsub = onSnapshot(
      doc(db, path),
      (snap) => setState({ data: snap.exists() ? { id: snap.id, ...snap.data() } : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error })
    );
    return unsub;
  }, [path]);

  return state;
}

/** Doc-level counterpart to useLiveOrDemo. */
export function useDocOrDemo(path, demoData) {
  const live = useDoc(path);
  if (!isFirebaseConfigured) {
    return { data: demoData, loading: false, error: null, demo: true };
  }
  return { ...live, demo: false };
}
