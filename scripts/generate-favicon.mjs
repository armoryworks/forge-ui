// Generates public/favicon.ico with a hex-nut silhouette in the QB Engineer
// teal (#0d9488) on the dark background (#0f172a) — manufacturing cue, readable
// at 16/32/48 px. Multi-size ICO with embedded PNGs. Run with `node scripts/generate-favicon.mjs`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEAL = [0x0d, 0x94, 0x88, 0xff];      // #0d9488 primary
const TEAL_HI = [0x2d, 0xd4, 0xbf, 0xff];   // #2dd4bf highlight stripe
const DARK = [0x0f, 0x17, 0x2a, 0xff];      // #0f172a background
const SQRT3 = Math.sqrt(3);

// Pointy-top hexagon membership for (dx, dy) relative to center, circumradius R.
function inHex(dx, dy, R) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax <= R * SQRT3 / 2 && ax / SQRT3 + ay <= R;
}

function makePng(size) {
  const png = new PNG({ width: size, height: size });
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  // Scale design to size.
  const outerR = size * 0.48;
  const innerR = size * 0.22;
  const cornerR = Math.max(1, Math.round(size * 0.18));
  const half = size / 2;

  // Highlight stripe: a thin teal-light band at ~30° across the upper-left of
  // the nut — reads as a light catch. Only applied at ≥ 32px so the 16px icon
  // stays clean.
  const stripe = size >= 32;
  const stripeAngle = -Math.PI / 6; // -30°
  const stripeDir = [Math.cos(stripeAngle), Math.sin(stripeAngle)];
  const stripeNormal = [-stripeDir[1], stripeDir[0]];
  const stripeCenter = -size * 0.12;
  const stripeHalfWidth = size * 0.06;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) << 2;
      const dx = x - cx;
      const dy = y - cy;

      const inOuter = inHex(dx, dy, outerR);
      const inInner = inHex(dx, dy, innerR);

      // Rounded-square mask for background chrome.
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const ex = Math.max(0, absX - (half - cornerR));
      const ey = Math.max(0, absY - (half - cornerR));
      const inRounded = Math.hypot(ex, ey) <= half - 0.5;

      let color;
      if (inOuter && !inInner) {
        // Nut body — teal, with optional highlight stripe.
        if (stripe) {
          const sn = dx * stripeNormal[0] + dy * stripeNormal[1];
          if (Math.abs(sn - stripeCenter) < stripeHalfWidth) {
            color = TEAL_HI;
          } else {
            color = TEAL;
          }
        } else {
          color = TEAL;
        }
      } else if (inInner) {
        // Nut hole — same as background so it "punches through".
        color = DARK;
      } else if (inRounded) {
        color = DARK;
      } else {
        color = [0, 0, 0, 0];
      }

      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }

  return PNG.sync.write(png, { deflateLevel: 9 });
}

function makeIco(entries) {
  // entries: [{ size, buffer }]
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  const bodies = [];

  entries.forEach((entry, i) => {
    const pos = i * 16;
    const sizeByte = entry.size >= 256 ? 0 : entry.size;
    dir.writeUInt8(sizeByte, pos + 0);       // width
    dir.writeUInt8(sizeByte, pos + 1);       // height
    dir.writeUInt8(0, pos + 2);              // palette count
    dir.writeUInt8(0, pos + 3);              // reserved
    dir.writeUInt16LE(1, pos + 4);           // planes
    dir.writeUInt16LE(32, pos + 6);          // bits per pixel
    dir.writeUInt32LE(entry.buffer.length, pos + 8);
    dir.writeUInt32LE(offset, pos + 12);
    bodies.push(entry.buffer);
    offset += entry.buffer.length;
  });

  return Buffer.concat([header, dir, ...bodies]);
}

const sizes = [16, 32, 48, 64];
const entries = sizes.map((size) => ({ size, buffer: makePng(size) }));
const ico = makeIco(entries);

const outPath = path.join(__dirname, '..', 'public', 'favicon.ico');
fs.writeFileSync(outPath, ico);

console.log(`Wrote ${outPath} (${ico.length} bytes, sizes: ${sizes.join(', ')})`);
