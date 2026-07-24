import type { Sighting } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

export function isToday(isoString: string): boolean {
  return dayKey(new Date(isoString)) === dayKey(new Date());
}

export function computeDailyStreak(sightings: Sighting[]): number {
  const dayKeys = new Set(sightings.map((s) => dayKey(new Date(s.createdAt))));
  if (dayKeys.size === 0) return 0;

  let cursor = Date.now();
  let key = dayKey(new Date(cursor));

  if (!dayKeys.has(key)) {
    cursor -= DAY_MS;
    key = dayKey(new Date(cursor));
    if (!dayKeys.has(key)) return 0;
  }

  let streak = 0;
  while (dayKeys.has(key)) {
    streak += 1;
    cursor -= DAY_MS;
    key = dayKey(new Date(cursor));
  }
  return streak;
}
