import {
  createParticles,
  LAND_FADE_S,
  MAX_PARTICLES,
  PARTICLE_START_Y,
  particleCountFor,
  particleFrame,
  particlesDuration,
  particleTransform,
  seededRandom,
  SWAY_PX,
} from './particles';

const landing = { x: 120, y: 500, width: 120, height: 56 };
const make = (count: number, style: 'flowers' | 'shower' | 'drops' = 'flowers', seed = 7) =>
  createParticles({ count, style, width: 360, landing, source: { x: 180, y: 150 }, size: 28, random: seededRandom(seed) });

describe('falling offerings (§4.4)', () => {
  it('caps the count at 30 particles (performance budget)', () => {
    expect(particleCountFor(108)).toBe(MAX_PARTICLES);
    expect(particleCountFor(20)).toBe(20);
    expect(particleCountFor(0)).toBe(1);
    expect(make(108)).toHaveLength(30);
    expect(make(108, 'shower')).toHaveLength(30);
  });

  it('starts across the top 70% of the width at y = −40 and falls for 2.2–3.2 s', () => {
    for (const p of make(30)) {
      expect(p.x0).toBeGreaterThanOrEqual(0.15 * 360);
      expect(p.x0).toBeLessThanOrEqual(0.85 * 360);
      expect(p.y0).toBe(PARTICLE_START_Y);
      expect(p.durationS).toBeGreaterThanOrEqual(2.2);
      expect(p.durationS).toBeLessThanOrEqual(3.2);
      expect(Math.abs(p.spin)).toBeLessThanOrEqual(Math.PI); // ±180°
    }
  });

  it('lands inside the feet area and shrinks into the pile', () => {
    for (const p of make(30)) {
      expect(p.x1).toBeGreaterThanOrEqual(landing.x);
      expect(p.x1).toBeLessThanOrEqual(landing.x + landing.width);
      expect(p.y1).toBeGreaterThanOrEqual(landing.y);
      expect(p.y1).toBeLessThanOrEqual(landing.y + landing.height);

      const landed = particleFrame(p, p.delayS + p.durationS + 0.001);
      expect(landed.x).toBeCloseTo(p.x1);
      expect(landed.y).toBeCloseTo(p.y1);
      expect(landed.scale).toBeLessThanOrEqual(1);
      expect(particleFrame(p, p.delayS + p.durationS + LAND_FADE_S).scale).toBe(0);
    }
  });

  it('is invisible before its delay, eases in and sways at most 12 px', () => {
    const [p] = make(1);
    expect(particleFrame(p, p.delayS - 0.01).scale).toBe(0);
    const early = particleFrame(p, p.delayS + p.durationS * 0.25);
    const late = particleFrame(p, p.delayS + p.durationS * 0.75);
    // ease-in: a quarter of the time covers far less than a quarter of the height
    expect((early.y - p.y0) / (p.y1 - p.y0)).toBeCloseTo(0.0625, 5);
    expect(late.y).toBeGreaterThan(early.y);
    for (let i = 1; i < 100; i++) {
      const t = p.delayS + (p.durationS * i) / 100;
      const f = particleFrame(p, t);
      const eased = ((t - p.delayS) / p.durationS) ** 2;
      expect(Math.abs(f.x - (p.x0 + (p.x1 - p.x0) * eased))).toBeLessThanOrEqual(SWAY_PX);
    }
  });

  it('drops (jal / tel abhishek) fall straight from above the deity without spinning', () => {
    for (const p of make(15, 'drops')) {
      expect(p.spin).toBe(0);
      expect(p.swayHz).toBe(0);
      expect(p.y0).toBe(150);
      expect(Math.abs(p.x0 - 180)).toBeLessThanOrEqual(0.08 * 360);
    }
  });

  it('knows when the last particle is gone', () => {
    const ps = make(20);
    const last = Math.max(...ps.map((p) => p.delayS + p.durationS));
    expect(particlesDuration(ps)).toBeCloseTo(last + LAND_FADE_S);
    expect(particlesDuration(ps)).toBeLessThan(4.5);
  });

  it('draws the sprite centred on the particle at its size', () => {
    const [p] = make(1);
    const t = p.delayS + p.durationS / 2;
    const f = particleFrame(p, t);
    const [scos, ssin, tx, ty] = particleTransform(p, t, 256, 256);
    const s = p.size / 256;
    expect(Math.hypot(scos, ssin)).toBeCloseTo(s);
    // the sprite centre (128, 128) maps onto the particle position
    expect(scos * 128 - ssin * 128 + tx).toBeCloseTo(f.x);
    expect(ssin * 128 + scos * 128 + ty).toBeCloseTo(f.y);
  });
});
