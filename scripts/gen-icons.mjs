/**
 * Generate PWA icon PNGs from an emoji SVG using sharp.
 * Run: node scripts/gen-icons.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// SVG icon: dark background + wind & drone emoji rendered via system font
function makeSvg(size) {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  // Drone body + rotors drawn in app blue/green tones so it looks great on dark bg
  const r = inner / 2;
  // Simple stylised quadcopter: 4 arms + 4 rotors + central body
  const arm = r * 0.38;
  const rotorR = r * 0.3;
  const bodyR = r * 0.22;
  const stroke = r * 0.07;
  // Wind streaks on left side
  const w1y = cy - r * 0.22;
  const w2y = cy;
  const w3y = cy + r * 0.22;
  const wLen = r * 0.45;
  const wX = cx - r * 0.72;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="#0d0d1a"/>
  <!-- wind streaks -->
  <line x1="${wX}" y1="${w1y}" x2="${wX + wLen}" y2="${w1y}" stroke="#4a9eff" stroke-width="${stroke * 0.8}" stroke-linecap="round" opacity="0.7"/>
  <line x1="${wX - r*0.08}" y1="${w2y}" x2="${wX + wLen * 0.85}" y2="${w2y}" stroke="#4a9eff" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${wX}" y1="${w3y}" x2="${wX + wLen * 0.7}" y2="${w3y}" stroke="#4a9eff" stroke-width="${stroke * 0.8}" stroke-linecap="round" opacity="0.7"/>
  <!-- drone arms -->
  <line x1="${cx}" y1="${cy}" x2="${cx + arm}" y2="${cy - arm}" stroke="#e0e0e0" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${cx + arm}" y2="${cy + arm}" stroke="#e0e0e0" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${cx - arm * 0.35}" y2="${cy - arm}" stroke="#e0e0e0" stroke-width="${stroke}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${cx - arm * 0.35}" y2="${cy + arm}" stroke="#e0e0e0" stroke-width="${stroke}" stroke-linecap="round"/>
  <!-- rotors -->
  <ellipse cx="${cx + arm}" cy="${cy - arm}" rx="${rotorR}" ry="${rotorR * 0.18}" fill="#4aff80" opacity="0.85"/>
  <ellipse cx="${cx + arm}" cy="${cy + arm}" rx="${rotorR}" ry="${rotorR * 0.18}" fill="#4aff80" opacity="0.85"/>
  <ellipse cx="${cx - arm * 0.35}" cy="${cy - arm}" rx="${rotorR * 0.75}" ry="${rotorR * 0.18}" fill="#4aff80" opacity="0.85"/>
  <ellipse cx="${cx - arm * 0.35}" cy="${cy + arm}" rx="${rotorR * 0.75}" ry="${rotorR * 0.18}" fill="#4aff80" opacity="0.85"/>
  <!-- body -->
  <circle cx="${cx}" cy="${cy}" r="${bodyR}" fill="#4a9eff"/>
  <circle cx="${cx}" cy="${cy}" r="${bodyR * 0.55}" fill="#0d0d1a"/>
</svg>`;
}

mkdirSync(`${root}/public/icons`, { recursive: true });

for (const size of [192, 512]) {
  const svg = Buffer.from(makeSvg(size));
  await sharp(svg)
    .png()
    .toFile(`${root}/public/icons/icon-${size}.png`);
  console.log(`Generated icon-${size}.png`);
}

// Also write a simple SVG favicon (reuse same design at 64px)
const faviconSvg = makeSvg(64).replace('width="64" height="64"', 'width="64" height="64" viewBox="0 0 64 64"');

writeFileSync(`${root}/public/favicon.svg`, faviconSvg);
console.log('Generated favicon.svg');
