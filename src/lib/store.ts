import { useSyncExternalStore } from 'react';
import { collection, doc, onSnapshot, query, where, type Query } from 'firebase/firestore';
import { db } from './firebase';

/**
 * مخزن بسيط لاشتراكات Firestore: كل استعلام يُفتح مرة واحدة ويبقى حيا طوال الجلسة
 * ويتشاركه كل من يستخدمه، لتقليل عدد القراءات (مهم للخطة المجانية).
 */
interface Entry {
  data: any;
  loading: boolean;
  error?: string;
  subs: Set<() => void>;
  unsub?: () => void;
}

const entries = new Map<string, Entry>();

function getEntry(key: string, start: (set: (d: any) => void, fail: (e: string) => void) => () => void, initial: any) {
  let e = entries.get(key);
  if (!e) {
    const entry: Entry = { data: initial, loading: true, subs: new Set() };
    entries.set(key, entry);
    let attempt = 0;
    const connect = () => {
      entry.unsub = start(
        (d) => {
          attempt = 0;
          entry.data = d;
          entry.loading = false;
          entry.error = undefined;
          entry.subs.forEach((f) => f());
        },
        (msg) => {
          entry.loading = false;
          entry.error = msg;
          entry.subs.forEach((f) => f());
          // إعادة المحاولة تلقائيا (مثلا بعد إنشاء الحساب مباشرة أو انقطاع مؤقت)
          if (attempt < 6 && entries.get(key) === entry) {
            const delay = 1000 * 2 ** attempt++;
            setTimeout(() => entries.get(key) === entry && connect(), delay);
          }
        }
      );
    };
    connect();
    e = entry;
  }
  return e;
}

export function resetStore() {
  entries.forEach((e) => e.unsub?.());
  entries.clear();
}

const EMPTY: any[] = [];
const IDLE_EMPTY = { data: EMPTY, loading: false };
const IDLE_NULL = { data: null, loading: false };
const idle = (fallback: any) => (fallback === null ? IDLE_NULL : IDLE_EMPTY);
const snapshotCache = new WeakMap<Entry, { data: any; loading: boolean; error?: string; v: any }>();

function useEntry<T>(key: string | null, start: () => Entry | null, fallback: T) {
  const subscribe = (cb: () => void) => {
    const e = start();
    if (!e) return () => {};
    e.subs.add(cb);
    return () => e.subs.delete(cb);
  };
  const getSnap = () => {
    if (!key) return idle(fallback) as { data: T; loading: boolean; error?: string };
    const e = start()!;
    const c = snapshotCache.get(e);
    if (c && c.data === e.data && c.loading === e.loading && c.error === e.error) return c.v;
    const v = { data: e.data as T, loading: e.loading, error: e.error };
    snapshotCache.set(e, { data: e.data, loading: e.loading, error: e.error, v });
    return v;
  };
  return useSyncExternalStore(subscribe, getSnap);
}

export function useCollection<T>(
  name: string,
  filters: [string, any][] = [],
  enabled = true
): { data: T[]; loading: boolean; error?: string } {
  const key = enabled ? `${name}?${filters.map(([f, v]) => `${f}=${v}`).join('&')}` : null;
  return useEntry<T[]>(
    key,
    () =>
      key
        ? getEntry(
            key,
            (set, fail) => {
              let q: Query = collection(db, name);
              if (filters.length) q = query(q, ...filters.map(([f, v]) => where(f, '==', v)));
              return onSnapshot(
                q,
                (snap) => set(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
                (err) => fail(err.code || err.message)
              );
            },
            EMPTY
          )
        : null,
    EMPTY as T[]
  );
}

export function useDocument<T>(path: string | null): { data: T | null; loading: boolean; error?: string } {
  const key = path ? `doc:${path}` : null;
  return useEntry<T | null>(
    key,
    () =>
      key && path
        ? getEntry(
            key,
            (set, fail) =>
              onSnapshot(
                doc(db, path),
                (snap) => set(snap.exists() ? { id: snap.id, ...snap.data() } : null),
                (err) => fail(err.code || err.message)
              ),
            null
          )
        : null,
    null
  );
}
