// Password hashing using subtle crypto PBKDF2
const ITERATIONS = 100_000;
const KEY_LEN = 32; // 256 bits
const DIGEST = 'SHA-256';

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const enc = new TextEncoder();
  const saltBytes = salt ? base64ToBytes(salt) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes as BufferSource, iterations: ITERATIONS, hash: DIGEST }, keyMaterial, KEY_LEN * 8);
  const derived = new Uint8Array(bits);
  const saltB64 = bytesToBase64(saltBytes);
  const hashB64 = bytesToBase64(derived);
  return `pbkdf2$${DIGEST}$${ITERATIONS}$${saltB64}$${hashB64}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, digest, iterStr, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'pbkdf2') return false;
    const iterations = parseInt(iterStr, 10);
    const saltBytes = base64ToBytes(saltB64);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes as BufferSource, iterations, hash: digest }, keyMaterial, KEY_LEN * 8);
    const derived = bytesToBase64(new Uint8Array(bits));
    return timingSafeEqual(derived, hashB64);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return res === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
