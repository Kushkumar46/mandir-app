import { type AudioPlayer, type AudioSource, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let sessionConfigured = false;

/**
 * Short UI sounds (bells, shankh) mix with other apps' audio and play even when the phone is on
 * silent (docs/modules/01-virtual-mandir.md §4.5 default "Silent mode में भी बजाएं" = on).
 * Aarti playback (T13) sets its own mode while it runs.
 */
export function configureSoundEffects() {
  if (sessionConfigured) return;
  sessionConfigured = true;
  void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {
    sessionConfigured = false;
  });
}

/** Plays a player from the start, whatever state it was left in. */
export function restart(player: AudioPlayer) {
  try {
    if (player.currentTime > 0) {
      player.pause();
      void player
        .seekTo(0)
        .then(() => player.play())
        .catch(() => undefined);
    } else {
      player.play();
    }
  } catch {
    // A sound that cannot play must never break the screen.
  }
}

type CreatePlayer = (source: AudioSource) => AudioPlayer;

/**
 * Low-latency sound effects with overlap (§4.2 "rapid taps overlap sounds, max 3 concurrent
 * players"): `slots` round-robin slots, each holding one preloaded player per sound, so a tap never
 * waits for a file to load; reusing a slot stops what it was playing.
 */
export class SoundPool<K extends string> {
  private readonly slots: Record<K, AudioPlayer>[];
  private next = 0;

  constructor(sources: Record<K, AudioSource>, slots: number, create: CreatePlayer = createAudioPlayer) {
    const keys = Object.keys(sources) as K[];
    this.slots = Array.from({ length: slots }, () =>
      Object.fromEntries(keys.map((k) => [k, create(sources[k])])) as Record<K, AudioPlayer>,
    );
  }

  play(key: K) {
    const slot = this.slots[this.next];
    this.next = (this.next + 1) % this.slots.length;
    for (const player of Object.values<AudioPlayer>(slot)) {
      if (player !== slot[key] && player.playing) player.pause();
    }
    restart(slot[key]);
  }

  release() {
    for (const slot of this.slots) for (const player of Object.values<AudioPlayer>(slot)) player.remove();
  }
}
