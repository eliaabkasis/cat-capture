import { useEffect, useRef, useState } from "react";
import type { Sighting } from "../types";
import { NoCatFoundError, submitSighting } from "../api/sightings";
import { resizeForUpload } from "../image";
import styles from "./CameraOverlay.module.css";

interface CameraOverlayProps {
  onClose: () => void;
  onCaptured: (sighting: Sighting) => void;
}

type Phase = "live" | "checking" | "no-cat" | "error" | "no-camera";

export function CameraOverlay({ onClose, onCaptured }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("live");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("no-camera");
      setCameraError("Camera isn't available in this browser.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setPhase("live");
      })
      .catch((err) => {
        if (cancelled) return;
        setPhase("no-camera");
        if (err?.name === "NotAllowedError") {
          setCameraError("Camera permission denied. Allow camera access in your browser settings.");
        } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
          setCameraError("No camera found on this device.");
        } else if (err?.name === "NotReadableError") {
          setCameraError("Camera is already in use by another app.");
        } else {
          setCameraError("Couldn't access the camera.");
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraAttempt]);

  async function processBlob(blob: Blob) {
    setPhase("checking");
    try {
      const resized = await resizeForUpload(blob);
      const sighting = await submitSighting(resized);
      onCaptured(sighting);
    } catch (err) {
      setPhase(err instanceof NoCatFoundError ? "no-cat" : "error");
    }
  }

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;

    setPreviewUrl(URL.createObjectURL(blob));
    processBlob(blob);
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    processBlob(file);
  }

  function retry() {
    setPreviewUrl(null);
    setPhase("live");
  }

  function retryCamera() {
    setCameraError(null);
    setPhase("live");
    setCameraAttempt((n) => n + 1);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.videoWrap}>
        <video
          ref={videoRef}
          className={previewUrl ? `${styles.video} ${styles.videoHidden}` : styles.video}
          autoPlay
          playsInline
          muted
        />

        {previewUrl && <img className={styles.video} src={previewUrl} alt="Captured cat" />}

        <button className={styles.closeButton} onClick={onClose} aria-label="Close camera">
          ×
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenFileInput}
          onChange={handleFileChosen}
        />

        {phase === "live" && (
          <div className={styles.captureBar}>
            <button className={styles.captureButton} onClick={handleCapture} aria-label="Capture photo" />
            <button
              className={styles.uploadButton}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload from file
            </button>
          </div>
        )}

        {phase === "checking" && (
          <div className={styles.statusPanel}>
            <div className={styles.spinner} />
            <p className={styles.statusText}>Checking if a cat is found in the picture…</p>
          </div>
        )}

        {phase === "no-cat" && (
          <div className={styles.statusPanel}>
            <p className={styles.errorText}>No cat found in that photo — try again!</p>
            <button className={styles.retryButton} onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className={styles.statusPanel}>
            <p className={styles.errorText}>Something went wrong. Check your connection and try again.</p>
            <button className={styles.retryButton} onClick={retry}>
              Retry
            </button>
            <button className={styles.uploadButton} onClick={() => fileInputRef.current?.click()}>
              Upload from file
            </button>
          </div>
        )}

        {phase === "no-camera" && (
          <div className={styles.statusPanel}>
            <p className={styles.errorText}>{cameraError}</p>
            <button className={styles.retryButton} onClick={retryCamera}>
              Retry
            </button>
            <button className={styles.uploadButton} onClick={() => fileInputRef.current?.click()}>
              Upload from file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
