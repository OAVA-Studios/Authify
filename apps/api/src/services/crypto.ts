import { env } from '../lib/env.js';

const ALG = { name: 'AES-GCM', length: 256 } as const;

async function getKey(): Promise<CryptoKey> {
  const raw = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  return crypto.subtle.importKey('raw', raw, ALG, false, ['encrypt', 'decrypt']);
}

export async function encryptValue(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALG.name, iv }, key, encoded);
  const buf = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  buf.set(iv);
  buf.set(new Uint8Array(ciphertext), iv.byteLength);
  return Buffer.from(buf).toString('base64');
}

export async function decryptValue(ciphertext: string): Promise<string> {
  const key = await getKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const data = buf.subarray(12);
  const decrypted = await crypto.subtle.decrypt({ name: ALG.name, iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
