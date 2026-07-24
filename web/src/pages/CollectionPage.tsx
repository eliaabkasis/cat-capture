import { useEffect, useRef, useState } from "react";
import type { FriendUser, Sighting } from "../types";
import { fetchSightingsPage } from "../api/sightings";
import { fetchFriendSightings } from "../api/friends";
import { isToday } from "../stats";
import { SightingModal } from "../components/SightingModal";
import styles from "./CollectionPage.module.css";

interface CollectionPageProps {
  onBack: () => void;
  refreshKey: number;
  friend?: FriendUser;
}

export function CollectionPage({ onBack, refreshKey, friend }: CollectionPageProps) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Sighting | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const readOnly = Boolean(friend);

  useEffect(() => {
    setInitialLoading(true);
    setSightings([]);
    setCursor(null);
    setHasMore(false);
    setLoadedIds(new Set());

    const load = friend
      ? fetchFriendSightings(friend.id).then((items) => ({
          items,
          nextCursor: null as string | null,
          totalCount: items.length,
        }))
      : fetchSightingsPage();

    load
      .then((page) => {
        setSightings(page.items);
        setTotalCount(page.totalCount);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch(() => setSightings([]))
      .finally(() => setInitialLoading(false));
  }, [refreshKey, friend]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { root: gridRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, cursor, loadingMore]);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchSightingsPage(cursor)
      .then((page) => {
        setSightings((prev) => [...prev, ...page.items]);
        setTotalCount(page.totalCount);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }

  function handleImageLoad(id: string) {
    setLoadedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function handleDeleted(id: string) {
    setSightings((prev) => prev.filter((sighting) => sighting.id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    setSelected(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack} aria-label="Back to home">
          ←
        </button>
        <h1 className={styles.title}>
          {friend ? `${friend.name ?? friend.email}'s Cats` : "My Cats"}
          {totalCount > 0 && <span className={styles.count}>{totalCount} Captured</span>}
        </h1>
      </div>

      {initialLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div className={styles.skeletonTile} key={i} />
          ))}
        </div>
      ) : sightings.length === 0 ? (
        <p className={styles.empty}>
          {friend ? "No cats captured yet." : "No cats captured yet — go find one!"}
        </p>
      ) : (
        <div className={styles.grid} ref={gridRef}>
          {sightings.map((sighting) => {
            const caughtToday = isToday(sighting.createdAt);
            const loaded = loadedIds.has(sighting.id);
            return (
              <button
                key={sighting.id}
                className={[
                  styles.tile,
                  caughtToday && styles.tileToday,
                  loaded && styles.tileLoaded,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelected(sighting)}
                aria-label="View original photo"
              >
                {caughtToday && (
                  <>
                    <span className={styles.sparkle} data-pos="tl">✦</span>
                    <span className={styles.sparkle} data-pos="br">✦</span>
                    <span className={styles.todayBadge}>Today</span>
                  </>
                )}
                <img
                  className={loaded ? `${styles.tileImage} ${styles.tileImageLoaded}` : styles.tileImage}
                  src={sighting.thumbUrl}
                  alt="Lofi cat portrait"
                  loading="lazy"
                  onLoad={() => handleImageLoad(sighting.id)}
                />
              </button>
            );
          })}
          {hasMore && <div ref={sentinelRef} className={styles.sentinel} />}
        </div>
      )}

      {selected && (
        <SightingModal
          sighting={selected}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
