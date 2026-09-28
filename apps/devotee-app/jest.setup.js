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

// expo-audio: players that record calls (src/lib/sound.ts, features/mandir/sounds.ts).
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn((source) => ({
    source,
    playing: false,
    currentTime: 0,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
  })),
}));
