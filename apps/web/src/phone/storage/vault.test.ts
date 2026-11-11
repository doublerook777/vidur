import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { Ledger } from '@vidur/core';

import { TRANSCRIPT_TTL_MS, Vault } from './vault.js';

const fresh = (): IDBFactory => new IDBFactory();

/** Everything stored in a database, read raw with no key, as one string of bytes and JSON. */
async function rawDump(idb: IDBFactory, name: string): Promise<{ text: string; keyObjects: unknown[] }> {
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = idb.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  let text = '';
  const keyObjects: unknown[] = [];
  for (const store of Array.from(db.objectStoreNames)) {
    const rows = await new Promise<unknown[]>((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    for (const row of rows) {
      if (store === 'keys') keyObjects.push(row);
      text += JSON.stringify(row, (_k, v: unknown) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? Array.from(new Uint8Array(v instanceof ArrayBuffer ? v : (v as ArrayBufferView).buffer)).join(',') + '|' + new TextDecoder('latin1').decode(v instanceof ArrayBuffer ? v : (v as ArrayBufferView).buffer as ArrayBuffer) : v));
    }
  }
  db.close();
  return { text, keyObjects };
}

async function ledgerOn(vault: Vault): Promise<Ledger> {
  let n = 0;
  return Ledger.load(vault.ledgerStore, () => 1_700_000_000_000 + n, () => `e${++n}`);
}

describe('the vault', () => {
  it('stores nothing readable: no name, amount or transcript in raw IndexedDB', async () => {
    const idb = fresh();
    const vault = await Vault.open('t1', idb);
    const ledger = await ledgerOn(vault);
    const c = await ledger.createCustomer('Ramesh Kumar', ['doodh wale']);
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 34000 });
    await ledger.addNote(c.id, 'kal paanch sau dega');
    await vault.putTranscript('x', 'Ramesh ka teen sau chalis udhaar', Date.now());
    await vault.putMeta('shop', { name: 'Gupta General Store' });
    const { text } = await rawDump(idb, 't1');
    for (const secret of ['Ramesh', 'Kumar', 'doodh', '34000', '340', 'paanch', 'udhaar', 'chalis', 'Gupta', 'credit', 'customer_created']) expect(text).not.toContain(secret);
    expect(text.length).toBeGreaterThan(100); // there is data, it is just not readable
  });

  it('the key is non-extractable', async () => {
    const idb = fresh();
    await Vault.open('t2', idb);
    const { keyObjects } = await rawDump(idb, 't2');
    expect(keyObjects).toHaveLength(1);
    const key = keyObjects[0] as CryptoKey;
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('round trips the ledger through a reload', async () => {
    const idb = fresh();
    let vault = await Vault.open('t3', idb);
    let ledger = await ledgerOn(vault);
    const c = await ledger.createCustomer('Sunita');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: 20000 });
    await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: 5000 });
    vault = await Vault.open('t3', idb); // a new session, same device
    ledger = await ledgerOn(vault);
    expect(ledger.customers().map((x) => x.name)).toEqual(['Sunita']);
    expect(ledger.balance(c.id)).toBe(15000);
  });

  it('every record uses its own IV, and tampering is detected', async () => {
    const idb = fresh();
    const vault = await Vault.open('t4', idb);
    const ledger = await ledgerOn(vault);
    await ledger.createCustomer('A');
    await ledger.createCustomer('A');
    const db = await new Promise<IDBDatabase>((res) => { const r = idb.open('t4'); r.onsuccess = () => res(r.result); });
    const rows = await new Promise<{ iv: Uint8Array; data: ArrayBuffer }[]>((res) => { const r = db.transaction('events').objectStore('events').getAll(); r.onsuccess = () => res(r.result); });
    expect(Buffer.from(rows[0]!.iv).equals(Buffer.from(rows[1]!.iv))).toBe(false);
    expect(Buffer.from(rows[0]!.data).equals(Buffer.from(rows[1]!.data))).toBe(false); // same plaintext, different ciphertext
    new Uint8Array(rows[0]!.data)[0]! ^= 1;
    await new Promise<void>((res) => { const tx = db.transaction('events', 'readwrite'); tx.objectStore('events').put(rows[0]!, 1); tx.oncomplete = () => res(); });
    db.close();
    await expect(vault.ledgerStore.all()).rejects.toThrow();
  });

  it('purges transcripts older than 24 hours', async () => {
    const idb = fresh();
    const vault = await Vault.open('t5', idb);
    const now = 10 * TRANSCRIPT_TTL_MS;
    await vault.putTranscript('old', 'purana', now - TRANSCRIPT_TTL_MS - 1000);
    await vault.putTranscript('new', 'naya', now - 1000);
    expect(await vault.purgeTranscripts(now)).toBe(1);
    expect((await vault.getTranscripts()).map((t) => t.id)).toEqual(['new']);
  });

  it('delete-all removes events, transcripts, settings and the key', async () => {
    const idb = fresh();
    const vault = await Vault.open('t6', idb);
    const ledger = await ledgerOn(vault);
    await ledger.createCustomer('Mohan');
    await vault.putTranscript('x', 'hello', Date.now());
    await vault.putMeta('lang', 'hi');
    await vault.deleteAll();
    const databases = await idb.databases();
    expect(databases.find((d) => d.name === 't6')).toBeUndefined();
    // A new vault is empty and has a different key.
    const again = await Vault.open('t6', idb);
    expect(await again.ledgerStore.all()).toEqual([]);
    expect(await again.getTranscripts()).toEqual([]);
    expect(await again.getMeta('lang')).toBeUndefined();
  });

  it('the old data cannot be read by a new key even if it were somehow restored', async () => {
    const idbA = fresh(), idbB = fresh();
    const a = await Vault.open('same', idbA);
    await (await ledgerOn(a)).createCustomer('Secret Person');
    const dbA = await new Promise<IDBDatabase>((res) => { const r = idbA.open('same'); r.onsuccess = () => res(r.result); });
    const rows = await new Promise<unknown[]>((res) => { const r = dbA.transaction('events').objectStore('events').getAll(); r.onsuccess = () => res(r.result); });
    const b = await Vault.open('same', idbB); // a different device, different key
    const dbB = await new Promise<IDBDatabase>((res) => { const r = idbB.open('same'); r.onsuccess = () => res(r.result); });
    await new Promise<void>((res) => { const tx = dbB.transaction('events', 'readwrite'); rows.forEach((x) => tx.objectStore('events').add(x)); tx.oncomplete = () => res(); });
    await expect(b.ledgerStore.all()).rejects.toThrow();
  });
});
