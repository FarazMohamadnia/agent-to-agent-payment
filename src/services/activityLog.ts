export type ActivityLevel = 'info' | 'error' | 'warn';

export interface ActivityEntry {
  id: string;
  at: string;
  level: ActivityLevel;
  method?: string;
  path?: string;
  statusCode?: number;
  requestId?: string;
  message: string;
  details?: unknown;
}

const MAX = 200;
const entries: ActivityEntry[] = [];

export function pushActivity(entry: Omit<ActivityEntry, 'id' | 'at'>): ActivityEntry {
  const full: ActivityEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  entries.unshift(full);
  if (entries.length > MAX) entries.length = MAX;
  return full;
}

export function listActivity(limit = 100): ActivityEntry[] {
  return entries.slice(0, Math.min(limit, MAX));
}

export function clearActivity(): void {
  entries.length = 0;
}
