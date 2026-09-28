import { type AudioPlayer, createAudioPlayer } from 'expo-audio';

import { configureSoundEffects, restart, SoundPool } from '@/lib/sound';

import type { BellSide } from './bells';

/** Bundled sounds (assets/fallback) — preloaded once, kept for the app's lifetime (a few 100 KB). */
const BELL_SOURCES: Record<BellSide, number> = {
  left: require('../../../assets/fallback/bell-left.wav'),
  right: require('../../../assets/fallback/bell-right.wav'),
};
const SHANKH_SOURCE: number = require('../../../assets/fallback/shankh.wav');

/** §4.2 "max 3 concurrent players". */
export const BELL_MAX_CONCURRENT = 3;

let bells: SoundPool<BellSide> | null = null;
let shankh: AudioPlayer | null = null;

/** Creates the players ahead of the first tap (call when VM-01 mounts). */
export function preloadMandirSounds() {
  configureSoundEffects();
  bells ??= new SoundPool(BELL_SOURCES, BELL_MAX_CONCURRENT);
  shankh ??= createAudioPlayer(SHANKH_SOURCE);
}

export function playBell(side: BellSide) {
  preloadMandirSounds();
  bells?.play(side);
}

export function playShankh() {
  preloadMandirSounds();
  if (shankh) restart(shankh);
}
