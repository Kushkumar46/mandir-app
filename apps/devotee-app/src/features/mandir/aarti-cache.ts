import { type AartiLyrics, aartiLyricsSchema, type AartiView } from '@mandir/shared-types';
import { Directory, File, Paths } from 'expo-file-system';

import { fetchPublicJson } from '@/api/client';

/**
 * Aarti audio + lyrics on the device (§4.5 "cached after first play; cache key = aarti id +
 * version", T14). Files live in `documents/aarti-cache/` as `<aartiId>-v<version>.<ext>` and
 * `<aartiId>-v<version>.json`. A download goes to a `.part` file first, so a broken download is
 * never played. A new version replaces the old one; the folder is kept under `AARTI_CACHE_MAX_BYTES`
 * by removing the least recently written files.
 */

export const AARTI_CACHE_MAX_BYTES = 100 * 1024 * 1024;
const DIR_NAME = 'aarti-cache';

type AartiKey = Pick<AartiView, 'id' | 'version'>;

function dir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function ensureDir(): Directory {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** File extension of the audio URL (".m4a", ".mp3", ".wav"…), ".audio" when it has none. */
export function audioExtension(url: string): string {
  const path = url.split(/[?#]/)[0];
  const match = /\.([a-z0-9]{2,5})$/i.exec(path);
  return match ? `.${match[1].toLowerCase()}` : '.audio';
}

export function audioFileName(aarti: AartiKey & Pick<AartiView, 'audioUrl'>): string {
  return `${aarti.id}-v${aarti.version}${audioExtension(aarti.audioUrl)}`;
}

export function lyricsFileName(aarti: AartiKey): string {
  return `${aarti.id}-v${aarti.version}.json`;
}

/** Local file URI of the cached audio, or null. */
export function cachedAudioUri(aarti: AartiKey & Pick<AartiView, 'audioUrl'>): string | null {
  try {
    const file = new File(dir(), audioFileName(aarti));
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

const downloads = new Map<string, Promise<string | null>>();

/**
 * Downloads the aarti audio into the cache (once; concurrent calls share the download). Resolves
 * with the local URI, or null when it failed (offline, storage full) — playback then streams.
 */
export function cacheAartiAudio(aarti: AartiKey & Pick<AartiView, 'audioUrl'>): Promise<string | null> {
  const name = audioFileName(aarti);
  const running = downloads.get(name);
  if (running) return running;
  const job = (async () => {
    const existing = cachedAudioUri(aarti);
    if (existing) return existing;
    const d = ensureDir();
    const part = new File(d, `${name}.part`);
    try {
      if (part.exists) part.delete();
      await File.downloadFileAsync(aarti.audioUrl, part, { idempotent: true });
      const target = new File(d, name);
      await part.move(target);
      removeOtherVersions(d, aarti.id, aarti.version);
      trimAartiCache();
      return target.uri;
    } catch {
      try {
        if (part.exists) part.delete();
      } catch {
        // nothing to clean up
      }
      return null;
    }
  })().finally(() => downloads.delete(name));
  downloads.set(name, job);
  return job;
}

/** Lyrics from the cache (validated), or null. */
export function readCachedLyrics(aarti: AartiKey): AartiLyrics | null {
  try {
    const file = new File(dir(), lyricsFileName(aarti));
    if (!file.exists) return null;
    const parsed = aartiLyricsSchema.safeParse(JSON.parse(file.textSync()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeCachedLyrics(aarti: AartiKey, lyrics: AartiLyrics): void {
  try {
    const file = new File(ensureDir(), lyricsFileName(aarti));
    if (!file.exists) file.create();
    file.write(JSON.stringify(lyrics));
  } catch {
    // Not cached; fetched again next time.
  }
}

/** Downloads the lyrics into the cache unless they are there already (prefetch, §3.1). */
export async function cacheAartiLyrics(aarti: AartiKey & Pick<AartiView, 'lyricsUrl'>): Promise<void> {
  if (readCachedLyrics(aarti)) return;
  try {
    writeCachedLyrics(aarti, await fetchPublicJson(aarti.lyricsUrl, { schema: aartiLyricsSchema }));
  } catch {
    // Fetched again when the aarti opens.
  }
}

/** Removes the other versions (audio + lyrics) of one aarti. */
function removeOtherVersions(d: Directory, aartiId: string, keepVersion: number) {
  for (const entry of d.list()) {
    if (!(entry instanceof File)) continue;
    const m = /^(.+)-v(\d+)\./.exec(entry.name);
    if (m && m[1] === aartiId && Number(m[2]) !== keepVersion && !entry.name.endsWith('.part')) safeDelete(entry);
  }
}

/** Keeps the folder under the size cap: oldest files first. */
export function trimAartiCache(maxBytes: number = AARTI_CACHE_MAX_BYTES) {
  const d = dir();
  if (!d.exists) return;
  const files = d
    .list()
    .filter((e): e is File => e instanceof File && !e.name.endsWith('.part'))
    .map((f) => {
      const info = f.info();
      return { file: f, size: info.size ?? 0, time: info.modificationTime ?? 0 };
    })
    .sort((a, b) => a.time - b.time);
  let total = files.reduce((sum, f) => sum + f.size, 0);
  for (const f of files) {
    if (total <= maxBytes) break;
    safeDelete(f.file);
    total -= f.size;
  }
}

function safeDelete(file: File) {
  try {
    file.delete();
  } catch {
    // already gone
  }
}
