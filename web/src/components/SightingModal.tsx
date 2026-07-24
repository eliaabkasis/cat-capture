import { useState } from "react";
import type { Sighting } from "../types";
import { deleteSighting } from "../api/sightings";
import { formatCapturedAt } from "../format";
import styles from "./SightingModal.module.css";

interface SightingModalProps {
  sighting: Sighting;
  onClose: () => void;
  onDeleted: (id: string) => void;
  readOnly?: boolean;
}

type Shown = "lofi" | "original";

export function SightingModal({ sighting, onClose, onDeleted, readOnly = false }: SightingModalProps) {
  const [shown, setShown] = useState<Shown>("lofi");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteSighting(sighting.id);
      onDeleted(sighting.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {shown === "lofi" ? (
          <img className={styles.image} src={sighting.lofiUrl} alt="Lofi cat portrait" />
        ) : (
          <img className={styles.image} src={sighting.originalUrl} alt="Original cat photo" />
        )}

        <p className={styles.caption}>Caught {formatCapturedAt(sighting.createdAt)}</p>

        <button
          className={styles.switchButton}
          onClick={() => setShown(shown === "lofi" ? "original" : "lofi")}
        >
          {shown === "lofi" ? "See original" : "See lofi version"}
        </button>

        <button className={styles.closeButton} onClick={onClose}>
          Close
        </button>

        {!readOnly &&
          (!confirmingDelete ? (
            <button className={styles.deleteButton} onClick={() => setConfirmingDelete(true)}>
              Remove this cat
            </button>
          ) : (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>Remove for good?</span>
              <button
                className={styles.confirmDeleteButton}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Removing…" : "Yes, remove"}
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
