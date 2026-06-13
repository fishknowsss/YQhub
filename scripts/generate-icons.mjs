import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const rootDir = new URL('..', import.meta.url).pathname;
const buildDir = path.join(rootDir, 'build');
const iconsetDir = path.join(buildDir, 'icon.iconset');
const pngDir = path.join(buildDir, 'png');

const iconsetTargets = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
];
const icoTargets = [16, 32, 48, 64, 128, 256];
const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

await mkdir(buildDir, { recursive: true });
await rm(iconsetDir, { force: true, recursive: true });
await rm(pngDir, { force: true, recursive: true });
await mkdir(iconsetDir, { recursive: true });
await mkdir(pngDir, { recursive: true });

for (const [filename, size] of iconsetTargets) {
  const png = encodePng(renderIcon(size), size, size);
  await writeFile(path.join(iconsetDir, filename), png);
  await writeFile(path.join(pngDir, `icon-${size}.png`), png);
}

const generatedSizes = new Set(iconsetTargets.map((target) => target[1]));
for (const size of icoTargets) {
  if (!generatedSizes.has(size)) {
    const png = encodePng(renderIcon(size), size, size);
    await writeFile(path.join(pngDir, `icon-${size}.png`), png);
  }
}

execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(buildDir, 'icon.icns')], {
  stdio: 'inherit'
});

const icoImages = await Promise.all(
  icoTargets.map(async (size) => ({
    size,
    bytes: await readFile(path.join(pngDir, `icon-${size}.png`))
  }))
);
await writeFile(path.join(buildDir, 'icon.ico'), encodeIco(icoImages));

function renderIcon(size) {
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const alpha = roundedSquareAlpha(nx, ny, 0.23);
      const base = iconBackground(nx, ny);
      setPixel(pixels, size, x, y, base[0], base[1], base[2], Math.round(alpha * 255));
    }
  }

  drawThickLine(pixels, size, [0.302, 0.31], [0.5, 0.5], 0.092, [247, 242, 232, 244]);
  drawThickLine(pixels, size, [0.698, 0.31], [0.5, 0.5], 0.092, [247, 242, 232, 244]);
  drawThickLine(pixels, size, [0.5, 0.5], [0.5, 0.735], 0.092, [247, 242, 232, 244]);
  drawPolygon(pixels, size, [
    [0.59, 0.422],
    [0.744, 0.5],
    [0.59, 0.578]
  ], [233, 184, 114, 246]);
  drawCircle(pixels, size, [0.5, 0.5], 0.046, [10, 15, 14, 250]);
  drawCircle(pixels, size, [0.5, 0.5], 0.024, [108, 199, 168, 246]);
  drawCircle(pixels, size, [0.302, 0.31], 0.028, [108, 199, 168, 246]);
  drawCircle(pixels, size, [0.698, 0.31], 0.028, [108, 199, 168, 246]);
  drawCircle(pixels, size, [0.5, 0.735], 0.028, [108, 199, 168, 246]);

  return pixels;
}

function roundedSquareAlpha(x, y, radius) {
  const left = radius;
  const right = 1 - radius;
  const top = radius;
  const bottom = 1 - radius;
  const dx = x < left ? left - x : x > right ? x - right : 0;
  const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
  const dist = Math.hypot(dx, dy);
  const edge = radius - dist;
  return clamp(edge * 220 + 0.5, 0, 1);
}

function iconBackground(x, y) {
  const d1 = clamp(1 - Math.hypot(x - 0.25, y - 0.2) / 0.78, 0, 1);
  const d2 = clamp(1 - Math.hypot(x - 0.74, y - 0.7) / 0.86, 0, 1);
  const base = mix([7, 9, 9], [37, 53, 47], d1 * 0.62);
  const warm = mix(base, [92, 60, 35], d2 * 0.28);
  return warm;
}

function drawPolygon(pixels, size, points, color) {
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point[0])) * size) - 2);
  const maxX = Math.min(size - 1, Math.ceil(Math.max(...points.map((point) => point[0])) * size) + 2);
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point[1])) * size) - 2);
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...points.map((point) => point[1])) * size) + 2);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const coverage = sampleCoverage((sx, sy) => isInsidePolygon((x + sx) / size, (y + sy) / size, points));
      if (coverage > 0) {
        blendPixel(pixels, size, x, y, color[0], color[1], color[2], Math.round(color[3] * coverage));
      }
    }
  }
}

function drawCircle(pixels, size, center, radius, color) {
  const minX = Math.max(0, Math.floor((center[0] - radius) * size) - 2);
  const maxX = Math.min(size - 1, Math.ceil((center[0] + radius) * size) + 2);
  const minY = Math.max(0, Math.floor((center[1] - radius) * size) - 2);
  const maxY = Math.min(size - 1, Math.ceil((center[1] + radius) * size) + 2);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const coverage = sampleCoverage((sx, sy) => {
        const dx = (x + sx) / size - center[0];
        const dy = (y + sy) / size - center[1];
        return Math.hypot(dx, dy) <= radius;
      });
      if (coverage > 0) {
        blendPixel(pixels, size, x, y, color[0], color[1], color[2], Math.round(color[3] * coverage));
      }
    }
  }
}

function drawThickLine(pixels, size, start, end, width, color) {
  const minX = Math.max(0, Math.floor((Math.min(start[0], end[0]) - width) * size) - 2);
  const maxX = Math.min(size - 1, Math.ceil((Math.max(start[0], end[0]) + width) * size) + 2);
  const minY = Math.max(0, Math.floor((Math.min(start[1], end[1]) - width) * size) - 2);
  const maxY = Math.min(size - 1, Math.ceil((Math.max(start[1], end[1]) + width) * size) + 2);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const coverage = sampleCoverage((sx, sy) => {
        const point = [(x + sx) / size, (y + sy) / size];
        return distanceToSegment(point, start, end) <= width / 2;
      });
      if (coverage > 0) {
        blendPixel(pixels, size, x, y, color[0], color[1], color[2], Math.round(color[3] * coverage));
      }
    }
  }
}

function sampleCoverage(predicate) {
  const samples = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ];
  let hits = 0;
  for (const [x, y] of samples) {
    if (predicate(x, y)) {
      hits += 1;
    }
  }
  return hits / samples.length;
}

function isInsidePolygon(x, y, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const xi = points[index][0];
    const yi = points[index][1];
    const xj = points[previous][0];
    const yj = points[previous][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

function setPixel(pixels, size, x, y, r, g, b, a) {
  const index = (y * size + x) * 4;
  pixels[index] = r;
  pixels[index + 1] = g;
  pixels[index + 2] = b;
  pixels[index + 3] = a;
}

function blendPixel(pixels, size, x, y, r, g, b, a) {
  const index = (y * size + x) * 4;
  const sourceAlpha = a / 255;
  const targetAlpha = pixels[index + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);

  if (outputAlpha <= 0) {
    setPixel(pixels, size, x, y, 0, 0, 0, 0);
    return;
  }

  pixels[index] = Math.round((r * sourceAlpha + pixels[index] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 1] = Math.round((g * sourceAlpha + pixels[index + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 2] = Math.round((b * sourceAlpha + pixels[index + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[index + 3] = Math.round(outputAlpha * 255);
}

function encodePng(pixels, width, height) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    Buffer.from(pixels.buffer, y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  return Buffer.concat([
    uint32(data.length),
    typeBytes,
    data,
    uint32(crc32(Buffer.concat([typeBytes, data])))
  ]);
}

function encodeIco(images) {
  const headerSize = 6 + images.length * 16;
  let offset = headerSize;
  const entries = [];

  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size === 256 ? 0 : image.size;
    entry[1] = image.size === 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.bytes.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += image.bytes.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  return Buffer.concat([header, ...entries, ...images.map((image) => image.bytes)]);
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function mix(a, b, amount) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * amount),
    Math.round(a[1] + (b[1] - a[1]) * amount),
    Math.round(a[2] + (b[2] - a[2]) * amount)
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
