import type { Sighting } from "./types";

const SHARE_TITLE = "Cat Capture";
const SHARE_TEXT = "Look what I found! I just captured a new cat for my collection.";

export async function shareSighting(sighting: Sighting): Promise<void> {
  const imageUrl = new URL(sighting.lofiUrl, window.location.origin).toString();

  let file: File | undefined;
  try {
    const res = await fetch(sighting.lofiUrl);
    const blob = await res.blob();
    file = new File([blob], "cat-capture.png", { type: blob.type || "image/png" });
  } catch {
    // Fall through and share without the file.
  }

  if (file && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, files: [file] });
    return;
  }

  if (navigator.share) {
    await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: imageUrl });
    return;
  }

  window.open(
    `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${imageUrl}`)}`,
    "_blank",
  );
}
