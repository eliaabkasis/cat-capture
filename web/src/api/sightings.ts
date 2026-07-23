import type { Sighting } from "../types";

export class NoCatFoundError extends Error {
  constructor() {
    super("No cat was found in the photo.");
    this.name = "NoCatFoundError";
  }
}

export interface SightingsPage {
  items: Sighting[];
  nextCursor: string | null;
  totalCount: number;
}

export async function fetchSightings(): Promise<Sighting[]> {
  const res = await fetch("/api/sightings", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load sightings (${res.status})`);
  }
  return res.json();
}

export async function fetchSightingsPage(cursor?: string | null): Promise<SightingsPage> {
  const params = new URLSearchParams({ limit: "30" });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`/api/sightings?${params}`, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load sightings (${res.status})`);
  }
  return res.json();
}

export async function submitSighting(photo: Blob): Promise<Sighting> {
  const formData = new FormData();
  formData.append("photo", photo, "sighting.jpg");

  const res = await fetch("/api/sightings", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (res.status === 422) {
    throw new NoCatFoundError();
  }

  if (!res.ok) {
    throw new Error(`Failed to submit sighting (${res.status})`);
  }

  return res.json();
}

export async function deleteSighting(id: string): Promise<void> {
  const res = await fetch(`/api/sightings/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete sighting (${res.status})`);
  }
}
