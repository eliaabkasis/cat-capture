import { useState } from "react";
import type { Sighting } from "../types";
import { shareSighting } from "../share";
import styles from "./CapturedModal.module.css";

interface CapturedModalProps {
  sighting: Sighting;
  onContinue: () => void;
}

export function CapturedModal({ sighting, onContinue }: CapturedModalProps) {
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      await shareSighting(sighting);
    } catch {
      // user cancelled the share sheet or sharing isn't available — no-op
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <h2 className={styles.title}>New Cat Captured!</h2>

        <img className={styles.image} src={sighting.lofiUrl} alt="Newly captured cat, lofi portrait" />

        <p className={styles.caption}>Added to your collection</p>

        <div className={styles.actions}>
          <button className={styles.shareButton} onClick={handleShare} disabled={sharing}>
            {sharing ? "Sharing…" : "Share this cat"}
          </button>
          <button className={styles.continueButton} onClick={onContinue}>
            View Collection
          </button>
        </div>
      </div>
    </div>
  );
}
