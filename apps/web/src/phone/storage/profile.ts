import type { Profile } from '../contract.js';
import type { Vault } from './vault.js';

/**
 * The shopkeeper's local profile (F1) is stored in the vault's encrypted `meta` store under its own key, apart from
 * `settings`, and never leaves the phone. The type lives in `contract.ts`. An install made before Plan 2 has no profile:
 * `loadProfile` returns `null` and the app treats that as "profile incomplete", never as an error.
 */
export type { Profile };

export const PROFILE_KEY = 'profile';

/** Spec F1: salted PBKDF2 with WebCrypto, at least 200,000 iterations. */
export const MIN_PIN_ITERATIONS = 200_000;

export function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  if (p.version !== 1 || typeof p.ownerName !== 'string' || typeof p.shopName !== 'string' || typeof p.createdAt !== 'number') {
    return false;
  }
  if (p.pin !== undefined) {
    if (typeof p.pin !== 'object' || p.pin === null) return false;
    const pin = p.pin as Record<string, unknown>;
    if (typeof pin.salt !== 'string' || typeof pin.hash !== 'string' || typeof pin.iterations !== 'number') {
      return false;
    }
    if (pin.iterations < MIN_PIN_ITERATIONS) return false;
  }
  return true;
}

export async function loadProfile(vault: Vault): Promise<Profile | null> {
  const raw = await vault.getMeta<unknown>(PROFILE_KEY);
  return isProfile(raw) ? raw : null;
}

export async function saveProfile(vault: Vault, profile: Profile): Promise<void> {
  await vault.putMeta(PROFILE_KEY, profile);
}

/**
 * Hashes a 4 to 6 digit PIN using PBKDF2 with SHA-256 and WebCrypto.
 * Returns salt (hex), hash (hex), and iteration count.
 */
export async function hashPin(
  pin: string,
  iterations = MIN_PIN_ITERATIONS,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<{ salt: string; hash: string; iterations: number }> {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error('PIN must be 4 to 6 digits');
  }
  const actualIterations = Math.max(iterations, MIN_PIN_ITERATIONS);
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const pinKey = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: actualIterations, hash: 'SHA-256' },
    pinKey,
    256,
  );
  const saltHex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { salt: saltHex, hash: hashHex, iterations: actualIterations };
}

/**
 * Verifies a candidate PIN against stored salt, hash, and iteration count.
 */
export async function verifyPin(
  pin: string,
  stored: { salt: string; hash: string; iterations: number },
  subtle: SubtleCrypto = crypto.subtle,
): Promise<boolean> {
  if (!/^\d{4,6}$/.test(pin)) return false;
  try {
    const saltBytes = new Uint8Array(stored.salt.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
    const pinKey = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: stored.iterations, hash: 'SHA-256' },
      pinKey,
      256,
    );
    const hashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex === stored.hash;
  } catch {
    return false;
  }
}
