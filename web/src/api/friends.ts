import type { FriendRequest, FriendUser, Sighting } from "../types";

export class FriendRequestError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "FriendRequestError";
    this.code = code;
  }
}

export async function sendFriendRequest(email: string): Promise<void> {
  const res = await fetch("/api/friends/requests", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new FriendRequestError(body.error ?? `request_failed_${res.status}`);
  }
}

export async function fetchIncomingRequests(): Promise<FriendRequest[]> {
  const res = await fetch("/api/friends/requests/incoming", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load incoming requests (${res.status})`);
  }
  return res.json();
}

export async function fetchOutgoingRequests(): Promise<FriendRequest[]> {
  const res = await fetch("/api/friends/requests/outgoing", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load outgoing requests (${res.status})`);
  }
  return res.json();
}

export async function acceptRequest(id: string): Promise<void> {
  const res = await fetch(`/api/friends/requests/${id}/accept`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to accept request (${res.status})`);
  }
}

export async function declineRequest(id: string): Promise<void> {
  const res = await fetch(`/api/friends/requests/${id}/decline`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to decline request (${res.status})`);
  }
}

export async function cancelRequest(id: string): Promise<void> {
  const res = await fetch(`/api/friends/requests/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to cancel request (${res.status})`);
  }
}

export async function fetchFriends(): Promise<FriendUser[]> {
  const res = await fetch("/api/friends", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load friends (${res.status})`);
  }
  return res.json();
}

export async function removeFriend(userId: string): Promise<void> {
  const res = await fetch(`/api/friends/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to remove friend (${res.status})`);
  }
}

export async function fetchFriendSightings(userId: string): Promise<Sighting[]> {
  const res = await fetch(`/api/friends/${userId}/sightings`, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load friend's collection (${res.status})`);
  }
  return res.json();
}
