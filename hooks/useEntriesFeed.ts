import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../firebase/FirebaseConfig";

type UseEntriesFeedOpts = {
  daysWindow?: number;
  pageSize?: number;
};

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const utcToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const daysAgoUTC = (start: Date, n: number) => {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

export function useEntriesFeed(opts: UseEntriesFeedOpts = {}) {
  const DAYS_WINDOW = opts.daysWindow ?? 120;
  const PAGE_SIZE = opts.pageSize ?? 90;

  const [dates, setDates] = useState<string[]>([]);
  const startDateRef = useRef<Date>(utcToday());
  const loadedPagesRef = useRef(0);

  const coverCache = useRef(new Map<string, string | null>());
  const titleCache = useRef(new Map<string, string | undefined>());
  const existsCache = useRef(new Map<string, boolean>());

  const [version, setVersion] = useState(0);
  const [showRealOnly, setShowRealOnly] = useState(false);

  const seedPage = useCallback(
    (pageIndex: number) => {
      const startOffset = pageIndex * PAGE_SIZE;
      const next: string[] = [];
      for (let i = 0; i < PAGE_SIZE; i++) {
        const d = daysAgoUTC(startDateRef.current, startOffset + i);
        next.push(toISODate(d));
      }
      return next;
    },
    [PAGE_SIZE]
  );

  const loadMore = useCallback(() => {
    const page = loadedPagesRef.current + 1;
    const next = seedPage(page);
    loadedPagesRef.current = page;
    setDates((prev) => prev.concat(next));
  }, [seedPage]);

  useEffect(() => {
    setDates(seedPage(0));
    loadedPagesRef.current = 0;
  }, [seedPage]);

  useEffect(() => {
    const today = startDateRef.current;
    const todayId = toISODate(today);
    const startId = toISODate(daysAgoUTC(today, DAYS_WINDOW - 1));

    const q = query(
      collection(db, "entries"),
      where("id", ">=", startId),
      where("id", "<=", todayId),
      orderBy("id", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      let changed = false;
      snap.docChanges().forEach((ch) => {
        const d = ch.doc.data() as any;
        const id = d.id as string;
        if (ch.type === "removed") {
          if (existsCache.current.has(id)) {
            existsCache.current.delete(id);
            coverCache.current.delete(id);
            titleCache.current.delete(id);
            changed = true;
          }
        } else {
          existsCache.current.set(id, true);
          coverCache.current.set(id, d.thumbCoverUrl ?? d.coverUrl ?? null);
          titleCache.current.set(id, d.title ?? "");
          changed = true;
        }
      });
      if (changed) setVersion((v) => v + 1);
    });

    return () => unsub();
  }, [DAYS_WINDOW]);

  const ensureLoaded = useCallback(async (date: string) => {
    if (existsCache.current.has(date)) return;
    const snap = await getDoc(doc(db, "entries", date));
    const exists = snap.exists();
    existsCache.current.set(date, exists);
    if (exists) {
      const d = snap.data() as any;
      coverCache.current.set(date, d.thumbCoverUrl ?? d.coverUrl ?? null);
      titleCache.current.set(date, d.title ?? "");
    } else {
      coverCache.current.set(date, null);
      titleCache.current.set(date, "");
    }
    setVersion((v) => v + 1);
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    for (const v of viewableItems) ensureLoaded(v.item as string);
  }).current;

  const data = showRealOnly ? dates.filter((d) => existsCache.current.get(d) === true) : dates;

  const getCover = useCallback((id: string) => coverCache.current.get(id), []);
  const getTitle = useCallback((id: string) => titleCache.current.get(id), []);

  return {
    data,
    version,
    loadMore,
    viewabilityConfig,
    onViewableItemsChanged,
    getCover,
    getTitle,
    showRealOnly,
    setShowRealOnly,
  };
}

export const formatMDY = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
};

export const toParts = (iso: string) => {
  const dt = new Date(iso + "T00:00:00Z");
  const mo = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  const day = dt.getUTCDate().toString().padStart(2, "0");
  const yr = dt.getUTCFullYear().toString();
  return { mo, day, yr };
};