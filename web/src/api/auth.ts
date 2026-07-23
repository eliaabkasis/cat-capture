import type { User } from "../types";

export async function fetchMe(): Promise<User | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to load current user (${res.status})`);
  return res.json();
}

export async function signInWithGoogle(credential: string): Promise<User> {
  const res = await fetch("/api/auth/google", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  if (!res.ok) {
    throw new Error(`Sign-in failed (${res.status})`);
  }

  return res.json();
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
