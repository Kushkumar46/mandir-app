import { File } from 'expo-file-system';

import { fetchPublicJson } from '@/api/client';

import {
  audioExtension,
  cacheAartiAudio,
  cacheAartiLyrics,
  cachedAudioUri,
  readCachedLyrics,
  trimAartiCache,
  writeCachedLyrics,
} from './aarti-cache';

jest.mock('@/api/client', () => ({ ...jest.requireActual('@/api/client'), fetchPublicJson: jest.fn() }));

const fs = jest.requireMock('expo-file-system') as { __files: Map<string, string>; __dirs: Set<string> };
const download = File.downloadFileAsync as jest.MockedFunction<typeof File.downloadFileAsync>;
const DIR = 'file:///documents/aarti-cache';
const AARTI = { id: 'aarti-1', version: 2, audioUrl: 'http://cdn/audio/aarti/hanuman/v2.m4a?x=1', lyricsUrl: 'http://cdn/lyrics/v2.json' };

beforeEach(() => {
  fs.__files.clear();
  fs.__dirs.clear();
  download.mockClear();
});

describe('aarti audio cache (§4.5, T14)', () => {
  it('names files by aarti id + version with the audio extension', () => {
    expect(audioExtension('http://cdn/a/v1.WAV')).toBe('.wav');
    expect(audioExtension('http://cdn/a/v1.m4a?sig=abc')).toBe('.m4a');
    expect(audioExtension('http://cdn/a/stream')).toBe('.audio');
  });

  it('downloads once into a .part file, then moves it into place', async () => {
    expect(cachedAudioUri(AARTI)).toBeNull();
    const uri = await cacheAartiAudio(AARTI);
    expect(uri).toBe(`${DIR}/aarti-1-v2.m4a`);
    expect(download).toHaveBeenCalledWith(AARTI.audioUrl, expect.objectContaining({ uri: `${DIR}/aarti-1-v2.m4a.part` }), { idempotent: true });
    expect(fs.__files.has(`${DIR}/aarti-1-v2.m4a.part`)).toBe(false);
    expect(cachedAudioUri(AARTI)).toBe(uri);

    await cacheAartiAudio(AARTI);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('shares a running download', async () => {
    const [a, b] = await Promise.all([cacheAartiAudio(AARTI), cacheAartiAudio(AARTI)]);
    expect(a).toBe(b);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('a failed download leaves nothing behind', async () => {
    download.mockImplementationOnce(async (_url, target) => {
      fs.__files.set((target as { uri: string }).uri, 'half');
      throw new Error('offline');
    });
    await expect(cacheAartiAudio(AARTI)).resolves.toBeNull();
    expect([...fs.__files.keys()]).toEqual([]);
    expect(cachedAudioUri(AARTI)).toBeNull();
  });

  it('a new version replaces the old one (audio + lyrics)', async () => {
    const v1 = { ...AARTI, version: 1, audioUrl: 'http://cdn/v1.m4a' };
    await cacheAartiAudio(v1);
    writeCachedLyrics(v1, [{ t: 0, line: 'पुरानी' }]);
    await cacheAartiAudio({ id: 'other', version: 1, audioUrl: 'http://cdn/o.m4a' });
    await cacheAartiAudio(AARTI);
    expect(cachedAudioUri(v1)).toBeNull();
    expect(readCachedLyrics(v1)).toBeNull();
    expect(cachedAudioUri(AARTI)).not.toBeNull();
    expect(cachedAudioUri({ id: 'other', version: 1, audioUrl: 'http://cdn/o.m4a' })).not.toBeNull();
  });

  it('keeps the folder under the size cap, oldest first', async () => {
    await cacheAartiAudio({ id: 'a', version: 1, audioUrl: 'http://cdn/a.m4a' });
    await cacheAartiAudio({ id: 'b', version: 1, audioUrl: 'http://cdn/b.m4a' });
    await cacheAartiAudio({ id: 'c', version: 1, audioUrl: 'http://cdn/c.m4a' });
    const size = `downloaded:http://cdn/a.m4a`.length;
    trimAartiCache(size * 2);
    expect(cachedAudioUri({ id: 'a', version: 1, audioUrl: 'http://cdn/a.m4a' })).toBeNull();
    expect(cachedAudioUri({ id: 'c', version: 1, audioUrl: 'http://cdn/c.m4a' })).not.toBeNull();
  });
});

describe('aarti lyrics cache', () => {
  it('reads back what was written and rejects a broken file', () => {
    writeCachedLyrics(AARTI, [{ t: 0, line: 'जय' }]);
    expect(readCachedLyrics(AARTI)).toEqual([{ t: 0, line: 'जय' }]);
    fs.__files.set(`${DIR}/aarti-1-v2.json`, '{"nope":1}');
    expect(readCachedLyrics(AARTI)).toBeNull();
  });

  it('prefetches lyrics once', async () => {
    const fetchMock = fetchPublicJson as jest.MockedFunction<typeof fetchPublicJson>;
    fetchMock.mockResolvedValue([{ t: 0, line: 'जय' }]);
    await cacheAartiLyrics(AARTI);
    await cacheAartiLyrics(AARTI);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readCachedLyrics(AARTI)).toEqual([{ t: 0, line: 'जय' }]);
  });
});
