// Native module mocks for component tests (jest-expo preset covers the Expo modules).
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// expo-file-system: an in-memory documents directory (src/lib/storage.ts).
jest.mock('expo-file-system', () => {
  const files = new Map();
  class File {
    constructor(dir, name) {
      this.uri = `${dir.uri}/${name}`;
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, '');
    }
    textSync() {
      return files.get(this.uri) ?? '';
    }
    write(content) {
      files.set(this.uri, String(content));
    }
  }
  return { File, Paths: { document: { uri: 'file:///documents' } }, __files: files };
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
