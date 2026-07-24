const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date) {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

export function computeDailyStreak(createdAtList) {
  const dayKeys = new Set(createdAtList.map((iso) => dayKey(new Date(iso))));
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
