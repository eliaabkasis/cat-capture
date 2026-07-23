import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { CollectionPage } from "./pages/CollectionPage";
import { CameraOverlay } from "./components/CameraOverlay";
import { CapturedModal } from "./components/CapturedModal";
import { AuthGate } from "./components/AuthGate";
import { useAuth } from "./auth/AuthContext";
import type { Sighting } from "./types";
import styles from "./App.module.css";

type View = "home" | "collection";

function App() {
  const { user, loading, signOut } = useAuth();
  const [view, setView] = useState<View>("home");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [justCaptured, setJustCaptured] = useState<Sighting | null>(null);

  function handleCaptured(sighting: Sighting) {
    setCameraOpen(false);
    setRefreshKey((key) => key + 1);
    setJustCaptured(sighting);
  }

  function handleContinueFromCaptured() {
    setJustCaptured(null);
    setView("collection");
  }

  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  if (!user) {
    return <AuthGate />;
  }

  return (
    <>
      {view === "home" && (
        <HomePage
          onOpenCamera={() => setCameraOpen(true)}
          onOpenCollection={() => setView("collection")}
          refreshKey={refreshKey}
          user={user}
          onSignOut={signOut}
        />
      )}

      {view === "collection" && (
        <CollectionPage onBack={() => setView("home")} refreshKey={refreshKey} />
      )}

      {cameraOpen && (
        <CameraOverlay onClose={() => setCameraOpen(false)} onCaptured={handleCaptured} />
      )}

      {justCaptured && (
        <CapturedModal sighting={justCaptured} onContinue={handleContinueFromCaptured} />
      )}
    </>
  );
}

export default App;
