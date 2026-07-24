import { useEffect, useState } from "react";
import type { FriendUser, Sighting } from "../types";
import { fetchSightings } from "../api/sightings";
import { fetchFriendSightings } from "../api/friends";
import { SightingModal } from "../components/SightingModal";
import styles from "./CollectionPage.module.css";

interface CollectionPageProps {
  onBack: () => void;
  refreshKey: number;
  friend?: FriendUser;
}

export function CollectionPage({ onBack, refreshKey, friend }: CollectionPageProps) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [selected, setSelected] = useState<Sighting | null>(null);
  const readOnly = Boolean(friend);

  useEffect(() => {
    const load = friend ? fetchFriendSightings(friend.id) : fetchSightings();
    load.then(setSightings).catch(() => setSightings([]));
  }, [refreshKey, friend]);

  function handleDeleted(id: string) {
    setSightings((prev) => prev.filter((sighting) => sighting.id !== id));
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

      {sightings.length === 0 ? (
        <p className={styles.empty}>
          {friend ? "No cats captured yet." : "No cats captured yet — go find one!"}
        </p>
      ) : (
        <div className={styles.grid}>
          {sightings.map((sighting) => (
            <button
              key={sighting.id}
              className={styles.tile}
              onClick={() => setSelected(sighting)}
              aria-label="View original photo"
            >
              <img className={styles.tileImage} src={sighting.lofiUrl} alt="Lofi cat portrait" />
            </button>
          ))}
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
