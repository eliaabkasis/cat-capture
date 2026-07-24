import { useEffect, useState } from "react";
import type { FriendUser, Sighting } from "../types";
import { fetchSightings } from "../api/sightings";
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
  const [loading, setLoading] = useState(true);
  const readOnly = Boolean(friend);

  useEffect(() => {
    setLoading(true);
    const load = friend ? fetchFriendSightings(friend.id) : fetchSightings();
    load
      .then(setSightings)
      .catch(() => setSightings([]))
      .finally(() => setLoading(false));
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
          {sightings.length > 0 && (
            <span className={styles.count}>{sightings.length} Captured</span>
          )}
        </h1>
      </div>

      {loading ? (
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
        <div className={styles.grid}>
          {sightings.map((sighting) => {
            const caughtToday = isToday(sighting.createdAt);
            return (
              <button
                key={sighting.id}
                className={caughtToday ? `${styles.tile} ${styles.tileToday}` : styles.tile}
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
                <img className={styles.tileImage} src={sighting.lofiUrl} alt="Lofi cat portrait" />
              </button>
            );
          })}
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
