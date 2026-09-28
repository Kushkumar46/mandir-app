#!/usr/bin/env node
/**
 * Regenerates the app's bundled fallback deity artwork (generic diya scene, 720×960 WebP), shown when
 * a deity has no image or it fails to load (Virtual Mandir VM-01 "Image failed"). Uses the API's sharp.
 *
 *   node scripts/generate-fallback-art.cjs
 */
const path = require('node:path');

const root = path.join(__dirname, '..');
const sharp = require(require.resolve('sharp', { paths: [path.join(root, 'apps/api')] }));
const out = path.join(root, 'apps/devotee-app/assets/fallback/deity-fallback.webp');

const w = 720, h = 960;
const rays = Array.from({ length: 16 }, (_, i) => {
  const a = (i * Math.PI) / 8;
  const x2 = 360 + Math.cos(a) * 420, y2 = 520 + Math.sin(a) * 420;
  return `<line x1="360" y1="520" x2="${x2}" y2="${y2}" stroke="#FFD27A" stroke-opacity="0.18" stroke-width="18"/>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A2B1B"/><stop offset="1" stop-color="#3E0F0F"/></linearGradient>
 <radialGradient id="glow"><stop offset="0" stop-color="#FFE3A3" stop-opacity="0.95"/><stop offset="0.45" stop-color="#E07A1F" stop-opacity="0.35"/><stop offset="1" stop-color="#E07A1F" stop-opacity="0"/></radialGradient>
 <radialGradient id="flame" cx="0.5" cy="0.7" r="0.6"><stop offset="0" stop-color="#FFF6E5"/><stop offset="0.5" stop-color="#FFC247"/><stop offset="1" stop-color="#E07A1F"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
${rays}
<circle cx="360" cy="520" r="300" fill="url(#glow)"/>
<path d="M360 360 C 410 440 420 500 360 560 C 300 500 310 440 360 360 Z" fill="url(#flame)"/>
<path d="M200 600 Q360 700 520 600 Q500 680 360 700 Q220 680 200 600 Z" fill="#B8742F"/>
<path d="M200 600 Q360 640 520 600" fill="none" stroke="#D4A537" stroke-width="10"/>
<rect x="330" y="560" width="60" height="30" rx="8" fill="#6B1E1E"/>
<ellipse cx="360" cy="800" rx="220" ry="26" fill="#000" fill-opacity="0.25"/>
</svg>`;
sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(out).then((info) => console.log(`${out} (${info.size} bytes)`));
