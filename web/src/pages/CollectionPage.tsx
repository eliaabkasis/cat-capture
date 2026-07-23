import { useEffect, useRef, useState } from "react";
import type { Sighting } from "../types";
import { fetchSightingsPage } from "../api/sightings";
import { SightingModal } from "../components/SightingModal";
import styles from "./CollectionPage.module.css";

interface CollectionPageProps {
  onBack: () => void;
  refreshKey: number;
}

export function CollectionPage({ onBack, refreshKey }: CollectionPageProps) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Sighting | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);

    fetchSightingsPage()
      .then((page) => {
        if (cancelled) return;
        setSightings(page.items);
        setTotalCount(page.totalCount);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch(() => {
        if (cancelled) return;
        setSightings([]);
        setTotalCount(0);
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
          My Cats
          {totalCount > 0 && <span className={styles.count}>{totalCount} Captured</span>}
        </h1>
      </div>

      {!initialLoading && sightings.length === 0 ? (
        <p className={styles.empty}>No cats captured yet — go find one!</p>
      ) : (
        <div className={styles.grid} ref={gridRef}>
          {sightings.map((sighting) => (
            <button
              key={sighting.id}
              className={`${styles.tile} ${loadedIds.has(sighting.id) ? styles.tileLoaded : ""}`}
              onClick={() => setSelected(sighting)}
              aria-label="View original photo"
            >
              <img
                className={`${styles.tileImage} ${loadedIds.has(sighting.id) ? styles.tileImageLoaded : ""}`}
                src={sighting.thumbUrl}
                alt="Lofi cat portrait"
                loading="lazy"
                decoding="async"
                width={320}
                height={320}
                onLoad={() => handleImageLoad(sighting.id)}
              />
            </button>
          ))}

          {hasMore && <div ref={sentinelRef} className={styles.sentinel} />}
        </div>
      )}

      {selected && (
        <SightingModal
          sighting={selected}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
