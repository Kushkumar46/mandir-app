import { type AudioPlayer, type AudioStatus, createAudioPlayer } from 'expo-audio';
import { create } from 'zustand';

import { configureMediaPlayback, restoreSoundEffects } from '@/lib/sound';

import { nextPlayedPosition } from './aarti';

/**
 * The one aarti audio player (§4.5), shared by VM-06 Aarti mode and VM-01 "Listen" (default aarti in
 * the background without aarti mode). Plays in the background and with the screen locked, shows
 * lock-screen controls (title = aarti name, artwork = deity thumb; no seek buttons, so "played" can
 * only grow by listening) and tracks the furthest point played for the completion rule.
 */

export type AartiTrack = {
  aartiId: string;
  deityId: string;
  /** Lock-screen title (aarti name) and artist (deity name). */
  title: string;
  artist: string;
  artworkUrl?: string;
  /** Local cached file or CDN URL. */
  uri: string;
  /** From the API, until the player knows the real duration. */
  durationSec: number;
};

export type AartiPlayerMode = 'listen' | 'aarti';

type AartiPlayerState = {
  track: AartiTrack | null;
  mode: AartiPlayerMode | null;
  playing: boolean;
  /** Loading or buffering. */
  waiting: boolean;
  currentTime: number;
  duration: number;
  /** Furthest position reached, seconds. */
  played: number;
  finished: boolean;
};

const IDLE: AartiPlayerState = {
  track: null,
  mode: null,
  playing: false,
  waiting: false,
  currentTime: 0,
  duration: 0,
  played: 0,
  finished: false,
};

export const useAartiPlayerStore = create<AartiPlayerState>(() => IDLE);

/** §4.5 "Poll 4×/s". */
export const STATUS_INTERVAL_MS = 250;

let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;

function onStatus(status: AudioStatus) {
  const s = useAartiPlayerStore.getState();
  if (!s.track) return;
  const duration = status.duration > 0 ? status.duration : s.track.durationSec;
  const finished = s.finished || status.didJustFinish;
  useAartiPlayerStore.setState({
    playing: status.playing,
    waiting: !status.isLoaded || status.isBuffering,
    currentTime: status.currentTime,
    duration,
    played: nextPlayedPosition(s.played, status.currentTime, duration, status.didJustFinish),
    finished,
  });
  // Listen mode ends with the track; aarti mode keeps the player until the overlay closes.
  if (status.didJustFinish && s.mode === 'listen') stopAarti();
}

function release() {
  subscription?.remove();
  subscription = null;
  if (!player) return;
  const p = player;
  player = null;
  try {
    p.clearLockScreenControls();
    p.pause();
    p.remove();
  } catch {
    // Already released by the system.
  }
}

/** Starts `track` from the beginning in `mode` (replaces whatever was playing). */
export function playAarti(track: AartiTrack, mode: AartiPlayerMode, { playsInSilentMode }: { playsInSilentMode: boolean }) {
  release();
  configureMediaPlayback(playsInSilentMode);
  useAartiPlayerStore.setState({ ...IDLE, track, mode, waiting: true, duration: track.durationSec, playing: true });
  try {
    const p = createAudioPlayer({ uri: track.uri }, { updateInterval: STATUS_INTERVAL_MS });
    player = p;
    subscription = p.addListener('playbackStatusUpdate', onStatus);
    p.setActiveForLockScreen(
      true,
      { title: track.title, artist: track.artist, artworkUrl: track.artworkUrl },
      { showSeekForward: false, showSeekBackward: false },
    );
    p.play();
  } catch {
    stopAarti();
  }
}

export function pauseAarti() {
  player?.pause();
  useAartiPlayerStore.setState({ playing: false });
}

/** Play again; a finished track starts over (what was played still counts). */
export function resumeAarti() {
  if (!player) return;
  const p = player;
  if (useAartiPlayerStore.getState().finished) {
    useAartiPlayerStore.setState({ finished: false, currentTime: 0 });
    void p
      .seekTo(0)
      .then(() => p.play())
      .catch(() => undefined);
  } else {
    p.play();
  }
  useAartiPlayerStore.setState({ playing: true });
}

/** Stops the audio, removes the lock-screen controls and gives the audio session back to the sound effects. */
export function stopAarti() {
  release();
  useAartiPlayerStore.setState(IDLE);
  restoreSoundEffects();
}
