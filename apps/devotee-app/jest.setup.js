// Native module mocks for component tests (jest-expo preset covers the Expo modules).
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// expo-file-system: an in-memory documents directory (src/lib/storage.ts, features/mandir/aarti-cache.ts).
// `__files` maps uri → content, `__dirs` holds created directories; `File.downloadFileAsync` is a
// jest.fn that "downloads" `downloaded:<url>` (override it to fail).
jest.mock('expo-file-system', () => {
  const files = new Map();
  const dirs = new Set();
  const times = new Map();
  let clock = 0;
  const put = (uri, content) => {
    files.set(uri, String(content));
    times.set(uri, ++clock);
  };
  class File {
    constructor(dir, name) {
      this.uri = `${dir.uri}/${name}`;
      this.name = name;
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      put(this.uri, '');
    }
    textSync() {
      return files.get(this.uri) ?? '';
    }
    write(content) {
      put(this.uri, content);
    }
    delete() {
      if (!files.has(this.uri)) throw new Error(`no file ${this.uri}`);
      files.delete(this.uri);
    }
    info() {
      const content = files.get(this.uri);
      return { exists: content !== undefined, size: content?.length ?? 0, modificationTime: times.get(this.uri) ?? 0 };
    }
    async move(target) {
      put(target.uri, files.get(this.uri) ?? '');
      files.delete(this.uri);
    }
  }
  File.downloadFileAsync = jest.fn(async (url, target) => {
    put(target.uri, `downloaded:${url}`);
    return target;
  });
  class Directory {
    constructor(parent, name) {
      this.uri = `${parent.uri}/${name}`;
    }
    get exists() {
      return dirs.has(this.uri);
    }
    create() {
      dirs.add(this.uri);
    }
    list() {
      const prefix = `${this.uri}/`;
      return [...files.keys()]
        .filter((uri) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes('/'))
        .map((uri) => new File(this, uri.slice(prefix.length)));
    }
  }
  return { File, Directory, Paths: { document: { uri: 'file:///documents' } }, __files: files, __dirs: dirs };
});

// expo-audio: players that record calls (src/lib/sound.ts, features/mandir/sounds.ts,
// features/mandir/aarti-player.ts). `player.__emit(status)` sends a playbackStatusUpdate.
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn((source, options) => {
    const listeners = new Set();
    return {
      source,
      options,
      playing: false,
      currentTime: 0,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
      setActiveForLockScreen: jest.fn(),
      clearLockScreenControls: jest.fn(),
      addListener: jest.fn((event, cb) => {
        const entry = { event, cb };
        listeners.add(entry);
        return { remove: () => listeners.delete(entry) };
      }),
      __emit(status) {
        for (const l of listeners) if (l.event === 'playbackStatusUpdate') l.cb(status);
      },
    };
  }),
}));

// @shopify/react-native-skia needs CanvasKit (WASM) under jest; the particle shower is the only
// Skia user, so a stub is enough: the canvas renders as a View, sprites decode instantly.
jest.mock('@shopify/react-native-skia', () => {
  const { View } = require('react-native');
  const image = { width: () => 64, height: () => 64 };
  return {
    Canvas: ({ children, ...props }) => require('react').createElement(View, props, children),
    Atlas: () => null,
    rect: (x, y, width, height) => ({ x, y, width, height }),
    useRSXformBuffer: () => ({ value: [] }),
    Skia: {
      Data: { fromURI: () => Promise.resolve({}) },
      Image: { MakeImageFromEncoded: () => image },
    },
  };
});
