import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { type AartiTrack, pauseAarti, playAarti, resumeAarti, STATUS_INTERVAL_MS, stopAarti, useAartiPlayerStore } from './aarti-player';

type MockPlayer = ReturnType<typeof createAudioPlayer> & { __emit: (s: object) => void };
const create = createAudioPlayer as jest.MockedFunction<typeof createAudioPlayer>;
const lastPlayer = () => create.mock.results.at(-1)!.value as MockPlayer;

const TRACK: AartiTrack = {
  aartiId: 'a1',
  deityId: 'd1',
  title: 'हनुमान आरती',
  artist: 'हनुमान जी',
  artworkUrl: 'http://cdn/thumb.webp',
  uri: 'http://cdn/aarti.m4a',
  durationSec: 30,
};

const status = (s: Partial<{ currentTime: number; duration: number; playing: boolean; didJustFinish: boolean }>) => ({
  currentTime: 0,
  duration: 30,
  playing: true,
  didJustFinish: false,
  isLoaded: true,
  isBuffering: false,
  ...s,
});

beforeEach(() => {
  stopAarti();
  jest.clearAllMocks();
});

describe('aarti player (§4.5)', () => {
  it('plays in the background with lock-screen controls and no seek buttons', () => {
    playAarti(TRACK, 'aarti', { playsInSilentMode: false });
    const p = lastPlayer();
    expect(create).toHaveBeenCalledWith({ uri: TRACK.uri }, { updateInterval: STATUS_INTERVAL_MS });
    expect(STATUS_INTERVAL_MS).toBe(250); // 4×/s
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: false, interruptionMode: 'doNotMix', shouldPlayInBackground: true });
    expect(p.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      { title: 'हनुमान आरती', artist: 'हनुमान जी', artworkUrl: 'http://cdn/thumb.webp' },
      { showSeekForward: false, showSeekBackward: false },
    );
    expect(p.play).toHaveBeenCalled();
    expect(useAartiPlayerStore.getState()).toMatchObject({ mode: 'aarti', playing: true, duration: 30 });
  });

  it('tracks the furthest position played, also across a replay', () => {
    playAarti(TRACK, 'aarti', { playsInSilentMode: true });
    const p = lastPlayer();
    p.__emit(status({ currentTime: 12 }));
    expect(useAartiPlayerStore.getState()).toMatchObject({ currentTime: 12, played: 12, duration: 30 });
    p.__emit(status({ currentTime: 30, didJustFinish: true, playing: false }));
    expect(useAartiPlayerStore.getState()).toMatchObject({ played: 30, finished: true, playing: false });

    resumeAarti(); // finished → from the start
    expect(p.seekTo).toHaveBeenCalledWith(0);
    p.__emit(status({ currentTime: 2 }));
    expect(useAartiPlayerStore.getState()).toMatchObject({ played: 30, currentTime: 2, finished: false });
  });

  it('pause / resume', () => {
    playAarti(TRACK, 'aarti', { playsInSilentMode: true });
    const p = lastPlayer();
    pauseAarti();
    expect(p.pause).toHaveBeenCalled();
    expect(useAartiPlayerStore.getState().playing).toBe(false);
    resumeAarti();
    expect(p.play).toHaveBeenCalledTimes(2);
  });

  it('stop releases the player and the lock screen and restores the sound-effects mode', () => {
    playAarti(TRACK, 'listen', { playsInSilentMode: true });
    const p = lastPlayer();
    stopAarti();
    expect(p.clearLockScreenControls).toHaveBeenCalled();
    expect(p.remove).toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    expect(useAartiPlayerStore.getState().track).toBeNull();
    p.__emit(status({ currentTime: 5 })); // a late event after stop is ignored
    expect(useAartiPlayerStore.getState().track).toBeNull();
  });

  it('Listen stops by itself at the end; a new track replaces the old one', () => {
    playAarti(TRACK, 'listen', { playsInSilentMode: true });
    const first = lastPlayer();
    first.__emit(status({ currentTime: 30, didJustFinish: true }));
    expect(first.remove).toHaveBeenCalled();
    expect(useAartiPlayerStore.getState().mode).toBeNull();

    playAarti(TRACK, 'listen', { playsInSilentMode: true });
    const second = lastPlayer();
    playAarti({ ...TRACK, aartiId: 'a2' }, 'aarti', { playsInSilentMode: true });
    expect(second.remove).toHaveBeenCalled();
    expect(useAartiPlayerStore.getState()).toMatchObject({ mode: 'aarti', track: { aartiId: 'a2' } });
  });
});
