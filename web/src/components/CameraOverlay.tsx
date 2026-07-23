import { useEffect, useRef, useState } from "react";
import type { Sighting } from "../types";
import { NoCatFoundError, submitSighting } from "../api/sightings";
import styles from "./CameraOverlay.module.css";

interface CameraOverlayProps {
  onClose: () => void;
  onCaptured: (sighting: Sighting) => void;
}

type Phase = "live" | "checking" | "no-cat" | "error";

export function CameraOverlay({ onClose, onCaptured }: CameraOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("live");

  useEffect(() => {
    let cancelled = false;

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
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function processBlob(blob: Blob) {
    setPhase("checking");
    try {
      const sighting = await submitSighting(blob);
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

    processBlob(blob);
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processBlob(file);
  }

  function retry() {
    setPhase("live");
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.videoWrap}>
        <video ref={videoRef} className={styles.video} autoPlay playsInline muted />

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
          </div>
        )}
      </div>
    </div>
  );
}
