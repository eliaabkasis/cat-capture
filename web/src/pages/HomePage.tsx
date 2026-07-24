import { useEffect, useState } from "react";
import { fetchSightings } from "../api/sightings";
import { computeDailyStreak } from "../stats";
import type { User } from "../types";
import styles from "./HomePage.module.css";

interface HomePageProps {
  onOpenCamera: () => void;
  onOpenCollection: () => void;
  onOpenFriends: () => void;
  refreshKey: number;
  user: User;
  onSignOut: () => void;
}

export function HomePage({
  onOpenCamera,
  onOpenCollection,
  onOpenFriends,
  refreshKey,
  user,
  onSignOut,
}: HomePageProps) {
  const [count, setCount] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetchSightings()
      .then((sightings) => {
        setCount(sightings.length);
        setStreak(computeDailyStreak(sightings));
      })
      .catch(() => {
        setCount(null);
        setStreak(0);
      });
  }, [refreshKey]);

  return (
    <div className={styles.page}>
      <div className={styles.account}>
        {user.pictureUrl && (
          <img className={styles.avatar} src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
        )}
        <span className={styles.accountName}>{user.name ?? user.email}</span>
        <button className={styles.signOutButton} onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Cat Capture</h1>
        <p className={styles.subtitle}>Snap the cats you meet in the wild</p>
        {count !== null && count > 0 && (
          <p className={styles.stats}>
            {count} {count === 1 ? "cat" : "cats"} captured
            {streak > 0 && ` — ${streak} day streak`}
          </p>
        )}
      </div>

      <button className={styles.cameraButton} onClick={onOpenCamera} aria-label="Open camera">
        <svg
          className={styles.cameraIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
          <circle cx="12" cy="13" r="3.4" />
        </svg>
      </button>

      <div className={styles.navButtons}>
        <button className={styles.navButton} onClick={onOpenCollection}>
          My Cats
        </button>

        <button className={styles.navButton} onClick={onOpenFriends}>
          Friends
        </button>
      </div>
    </div>
  );
}
