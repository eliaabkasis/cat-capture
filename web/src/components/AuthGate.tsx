import { useEffect, useRef, useState } from "react";
import { loadGsi } from "../auth/loadGsi";
import type { GoogleCredentialResponse } from "../auth/loadGsi";
import { useAuth } from "../auth/AuthContext";
import { signInWithGoogle } from "../api/auth";
import styles from "./AuthGate.module.css";

export function AuthGate() {
  const buttonMountRef = useRef<HTMLDivElement>(null);
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCredential(response: GoogleCredentialResponse) {
      try {
        const user = await signInWithGoogle(response.credential);
        setUser(user);
      } catch {
        setError("Sign-in failed. Please try again.");
      }
    }

    loadGsi()
      .then((accountsId) => {
        if (cancelled || !buttonMountRef.current) return;

        accountsId.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredential,
        });
        accountsId.renderButton(buttonMountRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
        });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load Google Sign-In. Check your connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Cat Capture </h1>
      <h2 className={styles.subtitle}>Created For My Shai</h2>
      <p className={styles.description}>Sign in to start your cozy cat collection</p>

      <div className={styles.card}>
        <div ref={buttonMountRef} className={styles.buttonMount} />
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}
