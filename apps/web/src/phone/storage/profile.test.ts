import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import {
  MIN_PIN_ITERATIONS,
  hashPin,
  isProfile,
  loadProfile,
  saveProfile,
  verifyPin,
  type Profile,
} from './profile.js';
import { Vault } from './vault.js';

const sample: Profile = { version: 1, ownerName: 'Test Owner', shopName: 'Test Store', createdAt: 1_700_000_000_000 };

describe('profile storage (F0, F1)', () => {
  it('an install with no profile loads null, not an error', async () => {
    const vault = await Vault.open('p1', new IDBFactory());
    expect(await loadProfile(vault)).toBeNull();
  });

  it('saves and loads a profile, and keeps it apart from settings', async () => {
    const vault = await Vault.open('p2', new IDBFactory());
    await vault.putMeta('settings', { lang: 'hi', theme: 'light', shopName: 'Old name', onboarded: true });
    await saveProfile(vault, sample);
    expect(await loadProfile(vault)).toEqual(sample);
    expect((await vault.getMeta<{ shopName: string }>('settings'))?.shopName).toBe('Old name');
  });

  it('survives closing and reopening the vault', async () => {
    const idb = new IDBFactory();
    let vault = await Vault.open('p3', idb);
    await saveProfile(vault, { ...sample, pin: { salt: 'aa', hash: 'bb', iterations: 200_000 } });
    vault = await Vault.open('p3', idb);
    expect((await loadProfile(vault))?.pin?.iterations).toBe(200_000);
  });

  it('delete-all removes the profile with everything else', async () => {
    const idb = new IDBFactory();
    const vault = await Vault.open('p4', idb);
    await saveProfile(vault, sample);
    await vault.deleteAll();
    expect(await loadProfile(await Vault.open('p4', idb))).toBeNull();
  });

  it('rejects anything that is not a version 1 profile', () => {
    expect(isProfile(null)).toBe(false);
    expect(isProfile({})).toBe(false);
    expect(isProfile({ ...sample, version: 2 })).toBe(false);
    expect(isProfile({ ...sample, shopName: 3 })).toBe(false);
    expect(isProfile({ ...sample, pin: { salt: 'a', hash: 'b', iterations: 100 } })).toBe(false);
    expect(isProfile(sample)).toBe(true);
  });

  describe('PIN hashing and verification (F1)', () => {
    it('hashes a 4-digit PIN with at least 200,000 iterations', async () => {
      const hashed = await hashPin('1234');
      expect(hashed.iterations).toBeGreaterThanOrEqual(MIN_PIN_ITERATIONS);
      expect(hashed.salt).toHaveLength(32); // 16 bytes hex = 32 chars
      expect(hashed.hash).toHaveLength(64); // 32 bytes hex = 64 chars
    });

    it('verifies correctly with the matching PIN', async () => {
      const hashed = await hashPin('5678');
      expect(await verifyPin('5678', hashed)).toBe(true);
      expect(await verifyPin('5679', hashed)).toBe(false);
      expect(await verifyPin('0000', hashed)).toBe(false);
    });

    it('rejects invalid PIN formats (not 4-6 digits)', async () => {
      await expect(hashPin('123')).rejects.toThrow();
      await expect(hashPin('1234567')).rejects.toThrow();
      await expect(hashPin('abcd')).rejects.toThrow();
      const hashed = await hashPin('123456');
      expect(await verifyPin('123', hashed)).toBe(false);
      expect(await verifyPin('abcdef', hashed)).toBe(false);
    });

    it('generates unique salts across invocations for the same PIN', async () => {
      const h1 = await hashPin('4321');
      const h2 = await hashPin('4321');
      expect(h1.salt).not.toBe(h2.salt);
      expect(h1.hash).not.toBe(h2.hash);
      expect(await verifyPin('4321', h1)).toBe(true);
      expect(await verifyPin('4321', h2)).toBe(true);
    });
  });
});
