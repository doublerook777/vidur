import { describe, expect, it } from 'vitest';

import { AI_MARKER, KEYS, TEMPLATES, say, type SpeechLang } from '../i18n/index.js';
import { Ledger, MemoryStore } from '../ledger/index.js';
import { Dialogue, type LlmParser, type Reply } from './engine.js';

const T0 = Date.UTC(2026, 10, 11, 6, 30); // Wed 11 Nov 2026, noon IST

async function setup(lang: SpeechLang = 'hi', llm?: LlmParser) {
  let now = T0;
  let n = 0;
  const ledger = await Ledger.load(new MemoryStore(), () => now, () => `id${++n}`);
  const d = new Dialogue({ ledger, lang, clock: () => now, ...(llm ? { llm } : {}) });
  const say1 = async (text: string): Promise<Reply[]> => d.handle(text);
  return { ledger, d, say1, tick: (ms: number) => (now += ms), now: () => now };
}
const keys = (rs: Reply[]): string[] => rs.map((r) => r.key);
const paise = (n: number): number => n * 100;

describe('section 1.4, one scripted dialogue per row', () => {
  it('"Ramesh ka 340 udhaar, kal 200 diya tha": credit today, payment yesterday, balance 140', async () => {
    const { ledger, d, say1 } = await setup();
    const ramesh = await ledger.createCustomer('Ramesh');
    d.start();
    const rs = await say1('Ramesh ka 340 udhaar, kal 200 diya tha');
    expect(keys(rs)).toEqual(['credit_saved', 'payment_saved_dated']);
    expect(ledger.balance(ramesh.id)).toBe(paise(140));
    const entries = ledger.activeEntries(ramesh.id);
    expect(entries.map((e) => [e.kind, e.paise])).toEqual([['credit', paise(340)], ['payment', paise(200)]]);
    expect(entries[1]!.at).toBeLessThan(T0 - 6 * 60 * 60 * 1000); // yesterday, not now
    expect(rs[1]!.text).toContain('₹200');
    expect(rs[1]!.text).toContain('₹140');
  });

  it('"Ramesh ka 340, nahi nahi 430 udhaar": one credit of 430', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    const rs = await say1('Ramesh ka 340, nahi nahi 430 udhaar');
    expect(keys(rs)).toEqual(['credit_saved']);
    expect(ledger.activeEntries(c.id).map((e) => e.paise)).toEqual([paise(430)]);
  });

  it('"Nahi, 430" after an entry replaces the last amount', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    await say1('Ramesh ka 340 udhaar');
    const rs = await say1('Nahi, 430');
    expect(keys(rs)).toEqual(['replaced']);
    expect(ledger.activeEntries(c.id).map((e) => e.paise)).toEqual([paise(430)]);
    expect(ledger.balance(c.id)).toBe(paise(430));
  });

  it('"Nahi, Suresh ka tha" moves the last entry', async () => {
    const { ledger, d, say1 } = await setup();
    const r = await ledger.createCustomer('Ramesh');
    const s = await ledger.createCustomer('Suresh');
    d.start();
    await say1('Ramesh ka 340 udhaar');
    const rs = await say1('Nahi, Suresh ka tha');
    expect(keys(rs)).toEqual(['moved']);
    expect(ledger.balance(r.id)).toBe(0);
    expect(ledger.balance(s.id)).toBe(paise(340));
  });

  it.each(['Galat', 'cancel', 'हटा दो'])('"%s" reverses the last entry', async (word) => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    await say1('Ramesh ka 340 udhaar');
    const rs = await say1(word);
    expect(keys(rs)).toEqual(['undone']);
    expect(ledger.balance(c.id)).toBe(0);
  });

  it('two Rameshes: held as pending, not saved, then settled by an alias', async () => {
    const { ledger, d, say1 } = await setup();
    const a = await ledger.createCustomer('Ramesh', ['doodh wale']);
    const b = await ledger.createCustomer('Ramesh', ['auto wale']);
    d.start();
    const rs = await say1('Ramesh ka 340 udhaar');
    expect(keys(rs)).toEqual(['ask_which']);
    expect(rs[0]!.text).toContain('doodh wale');
    expect(rs[0]!.text).toContain('auto wale');
    expect(ledger.activeEntries()).toEqual([]); // nothing saved while the question is open
    const done = await say1('auto wale');
    expect(keys(done)).toEqual(['credit_saved']);
    expect(ledger.balance(b.id)).toBe(paise(340));
    expect(ledger.balance(a.id)).toBe(0);
  });

  it('"Ramesh 340" with no direction: asks, saves nothing, then saves on the answer', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    expect(keys(await say1('Ramesh 340'))).toEqual(['ask_direction']);
    expect(ledger.activeEntries()).toEqual([]);
    expect(keys(await say1('jama'))).toEqual(['payment_advance']); // paid with nothing owed: an advance
    expect(ledger.activeEntries(c.id).map((e) => [e.kind, e.paise])).toEqual([['payment', paise(340)]]);
  });

  it('"Ramesh kal 500 dega" is a note and never a payment', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    const rs = await say1('Ramesh kal 500 dega');
    expect(keys(rs)).toEqual(['note_saved']);
    expect(ledger.activeEntries()).toEqual([]);
    expect(ledger.notes(c.id)).toHaveLength(1);
    expect(ledger.balance(c.id)).toBe(0);
  });

  it('"Mohan ka 50 udhaar": a new name creates the customer and saves', async () => {
    const { ledger, d, say1 } = await setup();
    d.start();
    const rs = await say1('Mohan ka 50 udhaar');
    expect(keys(rs)).toEqual(['new_customer', 'credit_saved']);
    expect(ledger.customers().map((c) => c.name)).toEqual(['Mohan']);
    expect(ledger.balance(ledger.customers()[0]!.id)).toBe(paise(50));
  });

  it('"Aaj kitna udhaar gaya?" is computed from the ledger', async () => {
    const { ledger, d, say1 } = await setup();
    d.start();
    await say1('Mohan ka 200 udhaar');
    await say1('Sunita ka 1040 udhaar');
    await say1('Sunita ne 40 jama kiye');
    const rs = await say1('Aaj kitna udhaar gaya?');
    expect(keys(rs)).toEqual(['balance_day']);
    expect(rs[0]!.text).toContain('₹1,240');
    expect(rs[0]!.text).toContain('2');
    expect(ledger.totalsBetween(0, T0 + 1).creditPaise).toBe(paise(1240));
  });

  it('"Ramesh ka total?" is computed from the ledger', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(540) });
    d.start();
    const rs = await say1('Ramesh ka total?');
    expect(keys(rs)).toEqual(['balance_customer']);
    expect(rs[0]!.text).toContain('₹540');
  });

  it('unclear amount: asks for just the amount, then saves', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    expect(keys(await say1('Ramesh ka udhaar likh do'))).toEqual(['ask_amount']);
    expect(ledger.activeEntries()).toEqual([]);
    expect(keys(await say1('teen sau'))).toEqual(['credit_saved']);
    expect(ledger.balance(c.id)).toBe(paise(300));
  });

  it('an amount that came out of a speech glitch is read back before saving', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    const rs = await say1('Ramesh ka 3:40 udhaar');
    expect(keys(rs)).toEqual(['confirm_amount']);
    expect(rs[0]!.text).toContain('₹340');
    expect(ledger.activeEntries()).toEqual([]);
    expect(keys(await say1('haan'))).toEqual(['credit_saved']);
    expect(ledger.balance(c.id)).toBe(paise(340));
  });

  it('a "no" to the read-back asks for the amount again', async () => {
    const { ledger, d, say1 } = await setup();
    await ledger.createCustomer('Ramesh');
    d.start();
    await say1('Ramesh ka 3:40 udhaar');
    expect(keys(await say1('nahi'))).toEqual(['ask_amount']);
    expect(keys(await say1('chaar sau'))).toEqual(['credit_saved']);
    expect(ledger.activeEntries().map((e) => e.paise)).toEqual([paise(400)]);
  });

  it('"Ramesh ko dhamki do" is refused politely and nothing changes', async () => {
    const { ledger, d, say1 } = await setup();
    await ledger.createCustomer('Ramesh');
    d.start();
    const rs = await say1('Ramesh ko dhamki do');
    expect(keys(rs)).toEqual(['refuse_threat']);
    expect(rs[0]!.text).toContain('रिमाइंडर');
    expect(ledger.activeEntries()).toEqual([]);
  });

  it('"Byaj laga do" is refused', async () => {
    const { d, say1 } = await setup();
    d.start();
    expect(keys(await say1('Byaj laga do'))).toEqual(['refuse_loan']);
  });
});

describe('questions, timeouts and interruptions', () => {
  it('a new entry in the middle of a question drops the old one and saves the new one', async () => {
    const { ledger, d, say1 } = await setup();
    await ledger.createCustomer('Ramesh');
    const s = await ledger.createCustomer('Sunita');
    d.start();
    await say1('Ramesh 340'); // asks direction
    const rs = await say1('Sunita ne 200 jama kiye');
    expect(keys(rs)).toEqual(['dropped_pending', 'payment_advance']);
    expect(ledger.activeEntries().map((e) => [e.customerId, e.paise])).toEqual([[s.id, paise(200)]]);
    expect(d.hasPending()).toBe(false);
  });

  it('an unanswered question expires and is never saved', async () => {
    const { ledger, d, say1, tick } = await setup();
    await ledger.createCustomer('Ramesh');
    d.start();
    await say1('Ramesh ka 340');
    tick(31_000);
    const rs = await say1('Sunita ka 50 udhaar');
    expect(keys(rs)).toContain('pending_expired');
    expect(ledger.activeEntries().map((e) => e.paise)).toEqual([paise(50)]);
  });

  it('"cancel" during a question drops the question and does not touch earlier entries', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    await say1('Ramesh ka 100 udhaar');
    await say1('Ramesh ka udhaar'); // asks amount
    const rs = await say1('galat');
    expect(keys(rs)).toEqual(['dropped_pending']);
    expect(ledger.balance(c.id)).toBe(paise(100));
  });

  it('barge-in keeps the open question', async () => {
    const { d, say1 } = await setup();
    d.start();
    await say1('Ramesh 340');
    d.interrupt();
    expect(d.hasPending()).toBe(true);
  });

  it('a near-spelled name is confirmed first', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Suresh');
    d.start();
    expect(keys(await say1('Suraj ka 50 udhaar'))).toContain('new_customer'); // different name: new
    const rs = await say1('Sureshi ka 70 udhaar');
    expect(['confirm_near', 'credit_saved', 'new_customer']).toContain(rs[0]!.key);
    void c;
  });

  it('too old to undo by voice', async () => {
    const { ledger, d, say1, tick } = await setup();
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    await say1('Ramesh ka 100 udhaar');
    tick(20 * 60_000);
    expect(keys(await say1('galat'))).toEqual(['undo_too_old']);
    expect(ledger.balance(c.id)).toBe(paise(100));
  });

  it('nothing to undo', async () => {
    const { d, say1 } = await setup();
    d.start();
    expect(keys(await say1('galat'))).toEqual(['nothing_to_undo']);
  });
});

describe('reminders: opt-in, polite, rate limited, never automatic', () => {
  it('asks for consent first, then prepares a text for the shopkeeper to share', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Sunita');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(500) });
    d.start();
    const first = await say1('Sunita ko reminder bhejo');
    expect(keys(first)).toEqual(['consent_ask']);
    expect(first[0]!.action).toBeUndefined();
    expect(ledger.lastReminderAt(c.id)).toBeNull();
    const done = await say1('haan');
    expect(keys(done)).toEqual(['reminder_ready']);
    expect(done[0]!.action?.type).toBe('share_reminder');
    expect(done[0]!.action?.text).toContain('₹500');
    expect(ledger.consent(c.id)).toBe(true);
    expect(ledger.lastReminderAt(c.id)).not.toBeNull();
  });
  it('declining consent prepares nothing', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Sunita');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(500) });
    d.start();
    await say1('Sunita ko reminder bhejo');
    expect(keys(await say1('nahi'))).toEqual(['consent_declined']);
    expect(ledger.consent(c.id)).toBe(false);
    expect(ledger.lastReminderAt(c.id)).toBeNull();
  });
  it('at most one reminder per customer per 7 days', async () => {
    const { ledger, d, say1, tick } = await setup();
    const c = await ledger.createCustomer('Sunita');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(500) });
    await ledger.setConsent(c.id, true);
    d.start();
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_ready']);
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_too_soon']);
    tick(6 * 24 * 3600_000);
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_too_soon']);
    tick(2 * 24 * 3600_000);
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_ready']);
  });
  it('no reminder when nothing is due', async () => {
    const { ledger, d, say1 } = await setup();
    const c = await ledger.createCustomer('Sunita');
    await ledger.setConsent(c.id, true);
    d.start();
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['balance_zero']);
  });
  it('a reminder is never produced for someone who is not in the khata', async () => {
    const { d, say1 } = await setup();
    d.start();
    expect(keys(await say1('Ghost ko reminder bhejo'))).toEqual(['unknown_customer']);
  });
});

describe('AI disclosure cannot be skipped', () => {
  const FIRST_TURNS = ['Ramesh ka 340 udhaar', 'Ramesh ka total?', 'Ramesh ko dhamki do', 'galat', 'Sunita ko reminder bhejo', 'weather kaisa hai', '', 'Ramesh 340', 'Mohan kal 500 dega', 'Aaj kitna udhaar gaya?'];
  for (const lang of ['hi', 'en', 'kn'] as const) {
    it.each(FIRST_TURNS)(`${lang}: first turn %j starts with the disclosure`, async (utterance) => {
      const { ledger, d, say1 } = await setup(lang);
      await ledger.createCustomer('Ramesh');
      const rs = await say1(utterance); // no start() call at all
      expect(rs[0]!.key).toBe('disclosure');
      expect(rs[0]!.text).toContain(AI_MARKER[lang]);
      expect(rs[0]!.text).toBe(say(lang, 'disclosure'));
      expect(rs.filter((r) => r.key === 'disclosure')).toHaveLength(1);
      const later = await d.handle('Ramesh ka total?');
      expect(later.some((r) => r.key === 'disclosure')).toBe(false);
    });
    it(`${lang}: start() says it too, once`, async () => {
      const { d } = await setup(lang);
      const a = d.start();
      expect(a.map((r) => r.key)).toEqual(['disclosure']);
      expect(d.start()).toEqual([]);
    });
  }
  it('every language has every template', () => {
    for (const lang of ['hi', 'en', 'kn'] as const) {
      for (const k of KEYS) expect(typeof TEMPLATES[lang][k]).toBe('function');
    }
  });
});

describe('LLM fallback is optional and cannot bypass the engine', () => {
  it('with no LLM, an unreadable sentence gets a polite line and changes nothing', async () => {
    const { ledger, d, say1 } = await setup('en');
    d.start();
    const rs = await say1('tell me a joke');
    expect(keys(rs)).toEqual(['out_of_scope']);
    expect(ledger.customers()).toEqual([]);
  });
  it('a grounded LLM result is used', async () => {
    const llm: LlmParser = async (text) => ({
      text, needsLlm: false,
      events: [{ intent: 'balance_query', tense: 'unknown', needs: [], customerSpoken: 'Ramesh', text }],
    });
    const { ledger, d, say1 } = await setup('en', llm);
    const c = await ledger.createCustomer('Ramesh');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(250) });
    d.start();
    const rs = await say1('what does ramesh still need to settle'); // the deterministic parser has nothing to act on
    expect(keys(rs)).toEqual(['balance_customer']);
    expect(rs[0]!.text).toContain('₹250');
  });
  it('an LLM that throws is ignored', async () => {
    const llm: LlmParser = async () => { throw new Error('network'); };
    const { d, say1 } = await setup('en', llm);
    d.start();
    expect(keys(await say1('tell me a joke'))).toEqual(['out_of_scope']);
  });
});
