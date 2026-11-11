/**
 * The on-device vault. Everything a shopkeeper's customers could be identified by (ledger events, transcripts,
 * settings) is stored in IndexedDB encrypted with AES-GCM 256. The key is created by WebCrypto as NON-EXTRACTABLE
 * and kept in IndexedDB as a CryptoKey object, so page code can use it but cannot read its bytes.
 *
 * Honest limit: this protects against copying the database or the key out of the browser profile. It does not
 * protect against malicious script running in this same origin, which could still ask the key to decrypt.
 */
import type { LedgerEvent, LedgerStore } from '@vidur/core';

const DB_VERSION = 1;
const KEY_ID = 'master';
export const TRANSCRIPT_TTL_MS = 24 * 60 * 60 * 1000;

interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

const req = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction): Promise<void> => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export class Vault {
  private constructor(
    private readonly db: IDBDatabase,
    private readonly key: CryptoKey,
    private readonly idb: IDBFactory,
    private readonly name: string,
    private readonly subtle: SubtleCrypto,
  ) {}

  static async open(name = 'vidur', idb: IDBFactory = indexedDB, subtle: SubtleCrypto = crypto.subtle): Promise<Vault> {
    const open = idb.open(name, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      db.createObjectStore('keys');
      db.createObjectStore('events', { autoIncrement: true });
      db.createObjectStore('transcripts', { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    const db = await req(open);
    let key = (await req(db.transaction('keys').objectStore('keys').get(KEY_ID))) as CryptoKey | undefined;
    if (!key) {
      key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false /* not extractable */, ['encrypt', 'decrypt']);
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put(key, KEY_ID);
      await done(tx);
    }
    const vault = new Vault(db, key, idb, name, subtle);
    await vault.purgeTranscripts();
    return vault;
  }

  private async seal(value: unknown): Promise<Sealed> {
    const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
    const data = await this.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(JSON.stringify(value)));
    return { iv, data };
  }
  private async unseal<T>(s: Sealed): Promise<T> {
    const plain = await this.subtle.decrypt({ name: 'AES-GCM', iv: s.iv }, this.key, s.data);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }

  /** The ledger's storage, as the `core` package expects it. */
  get ledgerStore(): LedgerStore {
    return {
      append: async (e: LedgerEvent) => {
        const sealed = await this.seal(e);
        const tx = this.db.transaction('events', 'readwrite');
        tx.objectStore('events').add(sealed);
        await done(tx);
      },
      all: async () => {
        const rows = (await req(this.db.transaction('events').objectStore('events').getAll())) as Sealed[];
        return Promise.all(rows.map((r) => this.unseal<LedgerEvent>(r)));
      },
      clear: async () => {
        const tx = this.db.transaction('events', 'readwrite');
        tx.objectStore('events').clear();
        await done(tx);
      },
    };
  }

  async putTranscript(id: string, text: string, at: number): Promise<void> {
    const sealed = await this.seal({ text });
    const tx = this.db.transaction('transcripts', 'readwrite');
    tx.objectStore('transcripts').put({ id, at, ...sealed });
    await done(tx);
  }
  async getTranscripts(): Promise<{ id: string; at: number; text: string }[]> {
    const rows = (await req(this.db.transaction('transcripts').objectStore('transcripts').getAll())) as ({ id: string; at: number } & Sealed)[];
    return Promise.all(rows.map(async (r) => ({ id: r.id, at: r.at, text: (await this.unseal<{ text: string }>(r)).text })));
  }
  /** Transcripts older than 24 hours are deleted. Runs at open and can be called on a timer. */
  async purgeTranscripts(now = Date.now()): Promise<number> {
    const tx = this.db.transaction('transcripts', 'readwrite');
    const store = tx.objectStore('transcripts');
    const rows = (await req(store.getAll())) as { id: string; at: number }[];
    let n = 0;
    for (const r of rows) if (now - r.at > TRANSCRIPT_TTL_MS) { store.delete(r.id); n++; }
    await done(tx);
    return n;
  }

  async putMeta(key: string, value: unknown): Promise<void> {
    const sealed = await this.seal(value);
    const tx = this.db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(sealed, key);
    await done(tx);
  }
  async getMeta<T>(key: string): Promise<T | undefined> {
    const s = (await req(this.db.transaction('meta').objectStore('meta').get(key))) as Sealed | undefined;
    return s ? this.unseal<T>(s) : undefined;
  }

  /** Delete everything: all events, transcripts and settings, and the key itself. The vault cannot be used afterwards. */
  async deleteAll(): Promise<void> {
    this.db.close();
    await new Promise<void>((res, rej) => {
      const r = this.idb.deleteDatabase(this.name);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
      r.onblocked = () => res();
    });
  }
}
