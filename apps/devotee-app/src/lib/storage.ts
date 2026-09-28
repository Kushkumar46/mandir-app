import { File, Paths } from 'expo-file-system';

/**
 * Device-local JSON files in the app's documents directory. Failures never break the app: a file
 * that cannot be read counts as missing, a failed write is skipped.
 */
export function readJsonFile(name: string): unknown {
  try {
    const file = new File(Paths.document, name);
    return file.exists ? (JSON.parse(file.textSync()) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

export function writeJsonFile(name: string, value: unknown): void {
  try {
    const file = new File(Paths.document, name);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch {
    // Kept in memory only.
  }
}

/**
 * Small device-local preferences (one JSON file), read once and kept in memory. For per-device
 * conveniences only — never for coins, streaks or anything the server owns.
 */
const PREFERENCES_FILE = 'preferences.json';
let cache: Record<string, unknown> | null = null;

function load(): Record<string, unknown> {
  if (cache) return cache;
  const parsed = readJsonFile(PREFERENCES_FILE);
  cache = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  return cache;
}

export function getPreference<T>(key: string, fallback: T): T {
  const value = load()[key];
  return value === undefined ? fallback : (value as T);
}

export function setPreference(key: string, value: unknown): void {
  const prefs = load();
  prefs[key] = value;
  writeJsonFile(PREFERENCES_FILE, prefs);
}

/** Tests only: forget the in-memory copy. */
export function resetPreferencesCache() {
  cache = null;
}
