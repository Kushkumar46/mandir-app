import { File, Paths } from 'expo-file-system';

/**
 * Small device-local preferences (one JSON file in the app's documents directory), read once and
 * kept in memory. For per-device conveniences only — never for coins, streaks or anything the
 * server owns. Failures fall back to defaults so the app never breaks over a preference.
 */
const FILE_NAME = 'preferences.json';
let cache: Record<string, unknown> | null = null;

function load(): Record<string, unknown> {
  if (cache) return cache;
  try {
    const file = new File(Paths.document, FILE_NAME);
    const parsed: unknown = file.exists ? JSON.parse(file.textSync()) : {};
    cache = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function getPreference<T>(key: string, fallback: T): T {
  const value = load()[key];
  return value === undefined ? fallback : (value as T);
}

export function setPreference(key: string, value: unknown): void {
  const prefs = load();
  prefs[key] = value;
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) file.create();
    file.write(JSON.stringify(prefs));
  } catch {
    // Kept in memory for this session.
  }
}

/** Tests only: forget the in-memory copy. */
export function resetPreferencesCache() {
  cache = null;
}
