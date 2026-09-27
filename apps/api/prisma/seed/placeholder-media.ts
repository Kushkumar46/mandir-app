/**
 * Generates the seed's placeholder media in memory (no binaries in git): deity artwork,
 * offering icons/sprites, the default theme frame, aarti tones and lyrics timelines.
 * All of it must be replaced with licensed assets before launch (module doc §12).
 */
import sharp from 'sharp';

/** docs/01-architecture.md §6 — widths of the WebP variants; images are portrait 3:4. */
export const IMAGE_VARIANT_WIDTHS = { thumb: 240, card: 540, full: 1080, hd: 1440 } as const;
export type ImageVariant = keyof typeof IMAGE_VARIANT_WIDTHS;

const DEITY_W = 1440;
const DEITY_H = 1920;

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Portrait placeholder: gradient, arch, halo at the default mala anchor (35% from top). */
function deitySvg(label: string, [top, bottom]: [string, string]): string {
  const w = DEITY_W;
  const h = DEITY_H;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#FFF6E5" stop-opacity="0.9"/><stop offset="1" stop-color="#FFF6E5" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <path d="M240 ${h - 160} V760 A480 480 0 0 1 ${w - 240} 760 V${h - 160} Z" fill="#000" fill-opacity="0.18"/>
  <circle cx="${w / 2}" cy="${h * 0.35}" r="360" fill="url(#halo)"/>
  <circle cx="${w / 2}" cy="${h * 0.35}" r="150" fill="#FFF6E5" fill-opacity="0.85"/>
  <text x="${w / 2}" y="${h - 330}" font-family="sans-serif" font-size="120" font-weight="bold" fill="#FFF6E5" text-anchor="middle">${escapeXml(label)}</text>
  <text x="${w / 2}" y="${h - 220}" font-family="sans-serif" font-size="56" fill="#FFF6E5" fill-opacity="0.8" text-anchor="middle">PLACEHOLDER</text>
</svg>`;
}

export interface GeneratedImage {
  original: Buffer;
  variants: Record<ImageVariant, Buffer>;
  width: number;
  height: number;
}

export async function deityImage(label: string, colors: [string, string]): Promise<GeneratedImage> {
  const original = await sharp(Buffer.from(deitySvg(label, colors))).png().toBuffer();
  const entries = await Promise.all(
    (Object.entries(IMAGE_VARIANT_WIDTHS) as [ImageVariant, number][]).map(
      async ([variant, width]) =>
        [variant, await sharp(original).resize({ width }).webp({ quality: 80 }).toBuffer()] as const,
    ),
  );
  return {
    original,
    variants: Object.fromEntries(entries) as Record<ImageVariant, Buffer>,
    width: DEITY_W,
    height: DEITY_H,
  };
}

/** Transparent square sprite: a coloured disc with petals — enough to see particles move. */
export function offeringSprite(color: string, size: number): Promise<Buffer> {
  const c = size / 2;
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return `<circle cx="${c + Math.cos(a) * c * 0.5}" cy="${c + Math.sin(a) * c * 0.5}" r="${c * 0.32}" fill="${color}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${petals}<circle cx="${c}" cy="${c}" r="${c * 0.3}" fill="#FFF6E5" stroke="${color}" stroke-width="${size / 32}"/>
</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}

/** Default theme frame (1440×2560, transparent centre): gold arch, pillars and a toran strip. */
export function themeFrame(): Promise<Buffer> {
  const w = 1440;
  const h = 2560;
  const gold = '#D4A537';
  const maroon = '#6B1E1E';
  const bells = Array.from({ length: 13 }, (_, i) => {
    const x = 60 + i * 110;
    return `<path d="M${x - 30} 90 Q${x} 170 ${x + 30} 90 Z" fill="${i % 2 ? '#E07A1F' : '#2E7D32'}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <path fill-rule="evenodd" fill="${maroon}" d="M0 0 H${w} V${h} H0 Z M180 ${h - 200} V900 A540 540 0 0 1 ${w - 180} 900 V${h - 200} Z"/>
  <path fill="none" stroke="${gold}" stroke-width="28" d="M180 ${h - 200} V900 A540 540 0 0 1 ${w - 180} 900 V${h - 200}"/>
  <rect x="40" y="700" width="100" height="${h - 900}" fill="${gold}"/>
  <rect x="${w - 140}" y="700" width="100" height="${h - 900}" fill="${gold}"/>
  <rect x="0" y="60" width="${w}" height="30" fill="${gold}"/>${bells}
  <rect x="0" y="${h - 200}" width="${w}" height="200" fill="${gold}"/>
</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}

/**
 * Placeholder aarti audio: 8 kHz mono 8-bit WAV with a soft bell-like chime every 2 s.
 * `seed` shifts the pitch so each deity sounds different.
 */
export function aartiTone(seconds: number, seed: number): Buffer {
  const rate = 8000;
  const samples = rate * seconds;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28); // byte rate
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  const freq = 440 + (seed % 10) * 22;
  for (let i = 0; i < samples; i++) {
    const t = (i % (rate * 2)) / rate; // restart the chime every 2 s
    const v = Math.exp(-2.5 * t) * (Math.sin(2 * Math.PI * freq * t) + 0.4 * Math.sin(4 * Math.PI * freq * t));
    buf.writeUInt8(Math.round(128 + 60 * v), 44 + i);
  }
  return buf;
}

/** Lyrics timeline (module doc §4.5): `[{ t, line }]`, one line every 5 s. */
export function lyricsTimeline(titleHi: string, seconds: number): { t: number; line: string }[] {
  const lines = [titleHi];
  for (let t = 5; t < seconds; t += 5) lines.push(`पंक्ति ${lines.length + 1} (प्लेसहोल्डर)`);
  return lines.map((line, i) => ({ t: i * 5, line }));
}
