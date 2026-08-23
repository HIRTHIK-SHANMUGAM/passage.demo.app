/** Derive a realistic-looking 0x… hash deterministically from a string payload. */
export function deriveHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 0x01000193) >>> 0;
    h2 = (Math.imul(h2, 31) + input.charCodeAt(i)) >>> 0;
  }
  let out = '';
  let a = h1;
  let b = h2;
  while (out.length < 64) {
    a = Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) >>> 0;
    b = Math.imul(b ^ (b >>> 13), 0x297a2d39) >>> 0;
    out += ((a ^ b) >>> 0).toString(16).padStart(8, '0');
  }
  return '0x' + out.slice(0, 64);
}

export function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function deriveSignature(hash: string): string {
  return deriveHash(hash + ':sig');
}
