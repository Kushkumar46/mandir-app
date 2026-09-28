import type { Rect } from '../layout';

/**
 * Falling offerings (docs/modules/01-virtual-mandir.md §4.4) — pure maths for the Skia particle
 * system; `particleTransform` runs on the UI thread every frame.
 *
 * Each particle starts at a random x across the top 70% of the width (y = −40), falls for 2.2–3.2 s
 * with ease-in, sways `x += sin(t·2π·f)·12px`, turns up to ±180° and lands in the feet area, where it
 * shrinks away into the static pile.
 */

/** §4.4 / CLAUDE.md performance budget: never more than 30 particles at once. */
export const MAX_PARTICLES = 30;
export const PARTICLE_START_Y = -40;
export const SWAY_PX = 12;
/** Time a landed particle takes to shrink into the pile. */
export const LAND_FADE_S = 0.35;

export type ParticleStyle = 'flowers' | 'shower' | 'drops';

export type Particle = {
  x0: number;
  y0: number;
  /** Landing point (inside the feet area). */
  x1: number;
  y1: number;
  delayS: number;
  durationS: number;
  /** Sway frequency (Hz) and phase; 0 Hz = no sway. */
  swayHz: number;
  swayPhase: number;
  /** Total rotation over the fall, radians. */
  spin: number;
  /** Drawn size in dp. */
  size: number;
};

export type ParticleFrame = { x: number; y: number; angle: number; scale: number };

/** Deterministic PRNG (mulberry32) so tests can pin a seed. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Particle count for an item: `min(item.particleCount, 30)`, at least 1. */
export function particleCountFor(requested: number): number {
  return Math.max(1, Math.min(MAX_PARTICLES, Math.round(requested)));
}

/**
 * Builds the particles of one offering. `width` = scene width; `landing` = the pile slot at the
 * deity's feet; `source` = where drops start (above the deity's head) for the `drops` style.
 */
export function createParticles(input: {
  count: number;
  style: ParticleStyle;
  width: number;
  landing: Rect;
  source?: { x: number; y: number };
  size: number;
  random?: () => number;
}): Particle[] {
  const { style, width, landing, size } = input;
  const rnd = input.random ?? Math.random;
  const count = particleCountFor(input.count);
  const range = (min: number, max: number) => lerp(min, max, rnd());

  return Array.from({ length: count }, (_, i) => {
    const x1 = range(landing.x, landing.x + landing.width);
    const y1 = range(landing.y + landing.height * 0.35, landing.y + landing.height * 0.85);
    if (style === 'drops') {
      // jal / tel abhishek: a stream over the deity, falling straight down onto the feet
      const src = input.source ?? { x: width / 2, y: 0 };
      return {
        x0: src.x + range(-0.08, 0.08) * width,
        y0: src.y,
        x1: lerp(src.x, x1, 0.6),
        y1,
        delayS: (i / count) * 0.9 + range(0, 0.1),
        durationS: range(1.1, 1.5),
        swayHz: 0,
        swayPhase: 0,
        spin: 0,
        size: size * range(0.6, 0.9),
      };
    }
    return {
      x0: range(0.15, 0.85) * width, // top 70% of the width, centred
      y0: PARTICLE_START_Y,
      x1,
      y1,
      // the 108-flower shower starts more densely and uses slightly smaller flowers
      delayS: style === 'shower' ? range(0, 0.9) : range(0, 0.6),
      durationS: range(2.2, 3.2),
      swayHz: range(0.4, 0.9),
      swayPhase: range(0, Math.PI * 2),
      spin: range(-Math.PI, Math.PI),
      size: size * range(0.75, 1.15) * (style === 'shower' ? 0.85 : 1),
    };
  });
}

/** Seconds until the last particle has landed and shrunk away. */
export function particlesDuration(particles: readonly Particle[]): number {
  return particles.reduce((m, p) => Math.max(m, p.delayS + p.durationS), 0) + LAND_FADE_S;
}

/** Where particle `p` is `t` seconds after the offering. Scale 0 = not visible. */
export function particleFrame(p: Particle, t: number): ParticleFrame {
  'worklet';
  const local = t - p.delayS;
  if (local <= 0) return { x: p.x0, y: p.y0, angle: 0, scale: 0 };
  if (local >= p.durationS) {
    const fade = 1 - (local - p.durationS) / LAND_FADE_S;
    return { x: p.x1, y: p.y1, angle: p.spin, scale: Math.max(0, fade) };
  }
  const progress = local / p.durationS;
  const eased = progress * progress; // ease-in
  // the sway calms down as the particle nears the ground, so it lands inside the feet area
  const sway = p.swayHz > 0 ? Math.sin(local * 2 * Math.PI * p.swayHz + p.swayPhase) * SWAY_PX * (1 - progress) : 0;
  return {
    x: p.x0 + (p.x1 - p.x0) * eased + sway,
    y: p.y0 + (p.y1 - p.y0) * eased,
    angle: p.spin * progress,
    scale: 1,
  };
}

/**
 * Skia RSXform `[scos, ssin, tx, ty]` that draws a `spriteW`×`spriteH` sprite centred on the
 * particle, rotated and scaled to its size in dp.
 */
export function particleTransform(p: Particle, t: number, spriteW: number, spriteH: number): [number, number, number, number] {
  'worklet';
  const f = particleFrame(p, t);
  const s = (f.scale * p.size) / Math.max(spriteW, spriteH, 1);
  const scos = s * Math.cos(f.angle);
  const ssin = s * Math.sin(f.angle);
  const cx = spriteW / 2;
  const cy = spriteH / 2;
  return [scos, ssin, f.x - (scos * cx - ssin * cy), f.y - (ssin * cx + scos * cy)];
}
