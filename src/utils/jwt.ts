// Minimal JWT HS256 sign/verify using WebCrypto
import { badRequest, unauthorized } from './errors';

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  }
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
  return b64;
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g,'+').replace(/_/g,'/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign','verify']);
}

export async function signJWT(payload: Record<string, unknown>, env: Env): Promise<string> {
  const header = { alg: env.JWT_ALG || 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now()/1000);
  const exp = now + (env.TOKEN_TTL_SECONDS || 3600);
  const fullPayload = { iat: now, exp, ...payload };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const key = await importKey(env.JWT_SECRET);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64url(sig)}`;
}

export interface VerifiedJWT {
  header: any;
  payload: any;
}

export async function verifyJWT(token: string, env: Env): Promise<VerifiedJWT> {
  const parts = token.split('.');
  if (parts.length !== 3) badRequest('Invalid JWT format');
  const [h, p, s] = parts;
  const key = await importKey(env.JWT_SECRET);
  const valid = await crypto.subtle.verify('HMAC', key, base64urlToBytes(s) as BufferSource, new TextEncoder().encode(`${h}.${p}`));
  if (!valid) unauthorized('Invalid token signature');
  const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(p)));
  const now = Math.floor(Date.now()/1000);
  if (payload.exp && now > payload.exp) unauthorized('Token expired');
  return { header, payload };
}
