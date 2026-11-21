import type { Profile } from '../contract.js';
import type { Vault } from './vault.js';

/**
 * The shopkeeper's local profile (F1) is stored in the vault's encrypted `meta` store under its own key, apart from
 * `settings`, and never leaves the phone. The type lives in `contract.ts`. An install made before Plan 2 has no profile:
 * `loadProfile` returns `null` and the app treats that as "profile incomplete", never as an error.
 */
export type { Profile };

export const PROFILE_KEY = 'profile';

export function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return p.version === 1 && typeof p.ownerName === 'string' && typeof p.shopName === 'string' && typeof p.createdAt === 'number';
}

export async function loadProfile(vault: Vault): Promise<Profile | null> {
  const raw = await vault.getMeta<unknown>(PROFILE_KEY);
  return isProfile(raw) ? raw : null;
}

export async function saveProfile(vault: Vault, profile: Profile): Promise<void> {
  await vault.putMeta(PROFILE_KEY, profile);
}
