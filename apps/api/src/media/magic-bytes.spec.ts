import { describe, expect, it } from 'vitest';
import { looksLikeContentType, MAGIC_BYTES_HEAD } from '@balitrade/shared';

/** Builds a fake file head: `bytes` at `offset`, zeros elsewhere. */
const head = (parts: { offset: number; bytes: number[] }[]): Uint8Array => {
  const buffer = new Uint8Array(MAGIC_BYTES_HEAD);
  for (const { offset, bytes } of parts) buffer.set(bytes, offset);
  return buffer;
};

const JPEG = head([{ offset: 0, bytes: [0xff, 0xd8, 0xff, 0xe0] }]);
const PNG = head([{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }]);
// "RIFF" + 4 size bytes + "WEBP"
const WEBP = head([
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { offset: 4, bytes: [0x24, 0x00, 0x00, 0x00] },
  { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
]);
const MP4 = head([{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }]);
const WEBM = head([{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }]);

describe('looksLikeContentType', () => {
  it('accepts each format it is meant to accept', () => {
    expect(looksLikeContentType(JPEG, 'image/jpeg')).toBe(true);
    expect(looksLikeContentType(PNG, 'image/png')).toBe(true);
    expect(looksLikeContentType(WEBP, 'image/webp')).toBe(true);
    expect(looksLikeContentType(MP4, 'video/mp4')).toBe(true);
    expect(looksLikeContentType(MP4, 'video/quicktime')).toBe(true);
    expect(looksLikeContentType(WEBM, 'video/webm')).toBe(true);
  });

  it('rejects a file that merely claims to be an image', () => {
    // What a renamed .html or .exe actually starts with.
    const html = head([{ offset: 0, bytes: [0x3c, 0x21, 0x44, 0x4f, 0x43] }]); // "<!DOC"
    const exe = head([{ offset: 0, bytes: [0x4d, 0x5a] }]); // "MZ"
    for (const type of ['image/jpeg', 'image/png', 'image/webp'] as const) {
      expect(looksLikeContentType(html, type)).toBe(false);
      expect(looksLikeContentType(exe, type)).toBe(false);
    }
  });

  it('does not mistake one accepted format for another', () => {
    expect(looksLikeContentType(PNG, 'image/jpeg')).toBe(false);
    expect(looksLikeContentType(JPEG, 'image/png')).toBe(false);
    expect(looksLikeContentType(WEBM, 'video/mp4')).toBe(false);
  });

  it('needs BOTH halves of the WebP marker, not just the RIFF container', () => {
    // A .wav is also RIFF. Checking only the first four bytes would let it through as a photo.
    const wav = head([
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x41, 0x56, 0x45] }, // "WAVE"
    ]);
    expect(looksLikeContentType(wav, 'image/webp')).toBe(false);
  });

  it('rejects a head that is too short to contain the marker', () => {
    expect(looksLikeContentType(new Uint8Array([0xff, 0xd8]), 'image/jpeg')).toBe(false);
    expect(looksLikeContentType(new Uint8Array(), 'image/png')).toBe(false);
  });
});
