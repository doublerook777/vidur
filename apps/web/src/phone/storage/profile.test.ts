import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { isProfile, loadProfile, saveProfile, type Profile } from './profile.js';
import { Vault } from './vault.js';

const sample: Profile = { version: 1, ownerName: 'Test Owner', shopName: 'Test Store', createdAt: 1_700_000_000_000 };

describe('profile storage (F0)', () => {
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
    expect(isProfile(sample)).toBe(true);
  });
});
