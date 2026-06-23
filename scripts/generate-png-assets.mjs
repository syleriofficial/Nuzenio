import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

function png(width, height, paint) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = paint(x, y);
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(value) {
  const clean = value.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255,
  ];
}

function roundedRect(x, y, left, top, width, height, radius) {
  const right = left + width;
  const bottom = top + height;
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const dx = x < left + radius ? left + radius - x : x >= right - radius ? x - (right - radius - 1) : 0;
  const dy = y < top + radius ? top + radius - y : y >= bottom - radius ? y - (bottom - radius - 1) : 0;
  return dx * dx + dy * dy <= radius * radius;
}

function circle(x, y, cx, cy, radius) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function ogPaint(x, y) {
  let color = hex('#f8fafc');
  const stripe = Math.floor((x + y) / 44) % 8;
  if (stripe === 0) color = hex('#eff6ff');
  if (roundedRect(x, y, 72, 72, 1056, 486, 28)) color = hex('#dbeafe');
  if (roundedRect(x, y, 76, 76, 1048, 478, 24)) color = hex('#ffffff');
  if (circle(x, y, 210, 240, 92)) return hex('#eff6ff');
  if (roundedRect(x, y, 138, 168, 144, 144, 34)) return hex('#ffffff');
  if (roundedRect(x, y, 151, 181, 118, 118, 28)) return hex('#dbeafe');
  if (roundedRect(x, y, 165, 195, 90, 90, 22)) return hex('#ffffff');
  if ((x >= 182 && x <= 201 && y >= 214 && y <= 267) || (x >= 237 && x <= 256 && y >= 214 && y <= 267)) return hex('#111827');
  if (x >= 200 && x <= 240 && y >= 214 && y <= 267 && Math.abs((x - 200) - (267 - y)) < 13) return hex('#111827');
  if (Math.abs((y - 286) - Math.sin((x - 155) / 24) * 18) < 8 && x > 155 && x < 285) return hex('#e11d48');
  if (x >= 318 && x <= 870 && y >= 148 && y <= 225) return hex('#111827');
  if (x >= 318 && x <= 650 && y >= 250 && y <= 260) return hex('#2563eb');
  if (x >= 118 && x <= 925 && y >= 342 && y <= 391) return hex('#111827');
  if (x >= 118 && x <= 1010 && y >= 418 && y <= 452) return hex('#475569');
  if (roundedRect(x, y, 118, 492, 190, 50, 25)) return hex('#eff6ff');
  if (roundedRect(x, y, 334, 492, 220, 50, 25)) return hex('#fff1f2');
  if (roundedRect(x, y, 580, 492, 270, 50, 25)) return hex('#f0fdf4');
  return color;
}

function iconPaint(x, y) {
  const scale = 192 / 512;
  const sx = x / scale;
  const sy = y / scale;
  if (roundedRect(sx, sy, 0, 0, 512, 512, 108)) return hex('#ffffff');
  if (roundedRect(sx, sy, 26, 26, 460, 460, 96)) return hex('#dbeafe');
  if (roundedRect(sx, sy, 46, 46, 420, 420, 78)) return hex('#ffffff');
  if (circle(sx, sy, 256, 256, 160)) return hex('#eff6ff');
  if ((sx >= 149 && sx <= 203 && sy >= 160 && sy <= 352) || (sx >= 309 && sx <= 363 && sy >= 160 && sy <= 352)) return hex('#111827');
  if (sx >= 197 && sx <= 322 && sy >= 160 && sy <= 352 && Math.abs((sx - 197) - (352 - sy)) < 34) return hex('#111827');
  if (Math.abs((sy - 303) - Math.sin((sx - 130) / 44) * 34) < 15 && sx > 130 && sx < 382) return hex('#e11d48');
  return hex('#f8fafc');
}

writeFileSync(new URL('../public/og-image.png', import.meta.url), png(1200, 630, ogPaint));
writeFileSync(new URL('../public/icon-192.png', import.meta.url), png(192, 192, iconPaint));
