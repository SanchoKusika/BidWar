/**
 * Pixel size of an image from its first bytes — enough to tell a square app
 * icon from a 1200×630 social banner, and a real picture from an HTML error
 * page served with a 200. No decoding: only the headers each format puts up
 * front (PNG IHDR, GIF screen, JPEG SOF, WebP VP8*, ICO directory).
 *
 * SVG has no pixel size; it scales to any, and is reported as `vector`.
 */
export interface ImageSize {
  width: number;
  height: number;
  /** Scalable — an SVG. Its width and height are nominal. */
  vector: boolean;
}

const SVG_NOMINAL = 512;

function u16be(b: Uint8Array, i: number): number {
  return (b[i]! << 8) | b[i + 1]!;
}

function u16le(b: Uint8Array, i: number): number {
  return b[i]! | (b[i + 1]! << 8);
}

function u24le(b: Uint8Array, i: number): number {
  return b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
}

function u32be(b: Uint8Array, i: number): number {
  return ((b[i]! << 24) >>> 0) + ((b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!);
}

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

function png(b: Uint8Array): ImageSize | null {
  if (b.length < 24 || u32be(b, 0) !== 0x89504e47 || ascii(b, 12, 16) !== 'IHDR') return null;
  return { width: u32be(b, 16), height: u32be(b, 20), vector: false };
}

function gif(b: Uint8Array): ImageSize | null {
  if (b.length < 10 || ascii(b, 0, 3) !== 'GIF') return null;
  return { width: u16le(b, 6), height: u16le(b, 8), vector: false };
}

function webp(b: Uint8Array): ImageSize | null {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 12) !== 'WEBP') return null;
  const chunk = ascii(b, 12, 16);
  if (chunk === 'VP8X') return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27), vector: false };
  if (chunk === 'VP8 ') {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, vector: false };
  }
  if (chunk === 'VP8L') {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, vector: false };
  }
  return null;
}

/** The largest entry of an icon file: one .ico carries several sizes. */
function ico(b: Uint8Array): ImageSize | null {
  if (b.length < 6 || b[0] !== 0 || b[1] !== 0 || b[2] !== 1 || b[3] !== 0) return null;
  const count = u16le(b, 4);
  let best = 0;
  for (let i = 0; i < count && 6 + i * 16 + 1 < b.length; i++) {
    // A width byte of 0 means 256.
    best = Math.max(best, b[6 + i * 16] || 256);
  }
  return best > 0 ? { width: best, height: best, vector: false } : null;
}

/** SOF0–SOF15 hold the frame size; DHT, JPG and DAC share the range and do not. */
function jpeg(b: Uint8Array): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++;
      continue;
    }
    const length = u16be(b, i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: u16be(b, i + 7), height: u16be(b, i + 5), vector: false };
    }
    i += 2 + length;
  }
  return null;
}

function svg(b: Uint8Array): ImageSize | null {
  const head = new TextDecoder().decode(b.subarray(0, 1024)).trimStart().toLowerCase();
  if (!head.includes('<svg')) return null;
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return null;
  return { width: SVG_NOMINAL, height: SVG_NOMINAL, vector: true };
}

/** null — not an image this knows, or bytes cut too short to say. */
export function imageSize(bytes: Uint8Array): ImageSize | null {
  return png(bytes) ?? gif(bytes) ?? webp(bytes) ?? ico(bytes) ?? jpeg(bytes) ?? svg(bytes);
}
