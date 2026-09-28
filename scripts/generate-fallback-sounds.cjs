#!/usr/bin/env node
/**
 * Regenerates the app's bundled sounds (Virtual Mandir §4.2 bells, VM-01 first-visit shankh):
 * two temple-bell strikes (left/right bell, different pitch) and a soft shankh (conch) call.
 * Synthesised placeholders (22.05 kHz mono 16-bit WAV — uncompressed so playback starts at once);
 * replace them with clean recordings per docs/modules/01-virtual-mandir.md §12 before launch.
 *
 *   node scripts/generate-fallback-sounds.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const RATE = 22050;
const outDir = path.join(__dirname, '..', 'apps/devotee-app/assets/fallback');

/** Deterministic noise so the files only change when this script changes. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000 - 0.5;
  };
}

/** A struck bell: inharmonic partials, each with its own exponential decay, plus a short strike click. */
function bell(fundamental, seconds, seed) {
  const partials = [
    [0.5, 0.35, 1.2], // hum
    [1, 1, 2.2],
    [1.19, 0.55, 2.8],
    [1.5, 0.45, 3.4],
    [2, 0.4, 4.2],
    [2.51, 0.25, 5.5],
    [3.01, 0.18, 7],
    [4.2, 0.12, 9],
  ];
  const noise = rng(seed);
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (const [ratio, amp, decay] of partials) v += amp * Math.exp(-decay * t) * Math.sin(2 * Math.PI * fundamental * ratio * t);
    v += noise() * 0.6 * Math.exp(-t * 90); // strike
    out[i] = v * Math.min(1, t / 0.002); // no click at sample 0
  }
  return out;
}

/** Shankh: breathy horn tone with a slow swell, slight upward glide and vibrato, soft fade out. */
function shankh(fundamental, seconds, seed) {
  const noise = rng(seed);
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = fundamental * (1 + 0.04 * Math.min(1, t / 1.2)) * (1 + 0.006 * Math.sin(2 * Math.PI * 5 * t));
    phase += (2 * Math.PI * f) / RATE;
    let v = 0;
    for (let k = 1; k <= 9; k++) v += Math.sin(k * phase) / Math.pow(k, 1.3);
    lp += 0.08 * (noise() - lp); // low-passed breath
    v += lp * 2.2;
    const env = Math.min(1, t / 0.45) * Math.min(1, (seconds - t) / 0.9);
    out[i] = v * env;
  }
  return out;
}

function writeWav(file, samples, peak) {
  const max = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round((v / max) * peak * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(outDir, file), Buffer.concat([header, data]));
  console.log(`wrote ${file} (${((44 + data.length) / 1024).toFixed(0)} KB)`);
}

writeWav('bell-left.wav', bell(740, 1.8, 1), 0.85);
writeWav('bell-right.wav', bell(880, 1.8, 2), 0.85);
writeWav('shankh.wav', shankh(233, 2.8, 3), 0.5);
