import { assertEquals } from 'jsr:@std/assert@1';
import { imageSize } from './image_size.ts';

const bytes = (...parts: Array<number[] | string>): Uint8Array =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );

Deno.test('PNG: размер из IHDR', () => {
  const head = bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    [0, 0, 0, 13],
    'IHDR',
    [0, 0, 0x04, 0xb0], // 1200
    [0, 0, 0x02, 0x76], // 630
  );
  assertEquals(imageSize(head), { width: 1200, height: 630, vector: false });
});

Deno.test('GIF: размер логического экрана', () => {
  assertEquals(imageSize(bytes('GIF89a', [0xb4, 0, 0xb4, 0])), {
    width: 180,
    height: 180,
    vector: false,
  });
});

Deno.test('JPEG: размер из SOF, а не из первого попавшегося маркера', () => {
  const head = bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0, 4, 0, 0], // APP0, skipped by its length
    [0xff, 0xc4, 0, 4, 0, 0], // DHT: inside the SOF range, but no frame
    [0xff, 0xc0, 0, 11, 8, 0x01, 0x40, 0x01, 0x40, 3, 0], // SOF0: 320×320
  );
  assertEquals(imageSize(head), { width: 320, height: 320, vector: false });
});

Deno.test('WebP: все три вида заголовка', () => {
  const riff = (chunk: string, body: number[]) =>
    bytes('RIFF', [0, 0, 0, 0], 'WEBP', chunk, [0, 0, 0, 0], body);
  // VP8X: width and height minus one, three bytes each.
  assertEquals(imageSize(riff('VP8X', [0, 0, 0, 0, 0xaf, 0x04, 0, 0x75, 0x02, 0])), {
    width: 1200,
    height: 630,
    vector: false,
  });
  // VP8 (lossy): after the three-byte frame tag and the 9d 01 2a start code.
  assertEquals(imageSize(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x00, 0x02, 0x00, 0x02])), {
    width: 512,
    height: 512,
    vector: false,
  });
  // VP8L (lossless): 14 bits a side after the 0x2f signature byte.
  const w = 180 - 1;
  const h = 180 - 1;
  const bits = w | (h << 14);
  assertEquals(
    imageSize(
      riff('VP8L', [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, 0, 0, 0, 0, 0, 0]),
    ),
    { width: 180, height: 180, vector: false },
  );
});

Deno.test('ICO: самый крупный из размеров внутри, 0 значит 256', () => {
  const entry = (size: number) => [size, size, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assertEquals(imageSize(bytes([0, 0, 1, 0, 3, 0], entry(16), entry(32), entry(0))), {
    width: 256,
    height: 256,
    vector: false,
  });
});

Deno.test('SVG — векторная, её размер условный', () => {
  assertEquals(
    imageSize(bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">')),
    {
      width: 512,
      height: 512,
      vector: true,
    },
  );
});

Deno.test('HTML под видом картинки — не картинка', () => {
  // How sentry.io serves /apple-touch-icon.png: a 200 with a page inside.
  assertEquals(imageSize(bytes('\n\n<!DOCTYPE html><html><body><svg></svg></body></html>')), null);
  assertEquals(imageSize(bytes('<html><head></head></html>')), null);
});

Deno.test('обрезанный заголовок — не картинка, а не мусорный размер', () => {
  assertEquals(imageSize(bytes([0x89, 0x50, 0x4e, 0x47])), null);
  assertEquals(imageSize(bytes([0xff, 0xd8, 0xff])), null);
});
