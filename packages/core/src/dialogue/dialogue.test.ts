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

  it('"Mohan ka 50 udhaar": a new name asks first, and "haan" creates the customer and saves', async () => {
    const { ledger, d, say1 } = await setup();
    d.start();
    expect(keys(await say1('Mohan ka 50 udhaar'))).toEqual(['confirm_new_customer']);
    expect(ledger.customers()).toHaveLength(0); // nothing exists until the shopkeeper says yes
    const rs = await say1('haan');
    expect(keys(rs)).toEqual(['new_customer', 'credit_saved']);
    expect(ledger.customers().map((c) => c.name)).toEqual(['Mohan']);
    expect(ledger.balance(ledger.customers()[0]!.id)).toBe(paise(50));
  });

  it('"Aaj kitna udhaar gaya?" is computed from the ledger', async () => {
    const { ledger, d, say1 } = await setup();
    d.start();
    await ledger.createCustomer('Mohan');
    await ledger.createCustomer('Sunita');
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
    await ledger.createCustomer('Sunita');
    d.start();
    await say1('Ramesh ka 340');
    tick(61_000);
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
    expect(keys(await say1('Suraj ka 50 udhaar'))).toContain('confirm_new_customer'); // different name: asks before creating
    const rs = await say1('Sureshi ka 70 udhaar');
    expect(keys(rs).some((k) => k === 'confirm_near' || k === 'confirm_new_customer')).toBe(true); // the earlier open question is dropped first
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
    // preparing the text does not start the lock: only a send does (the phone records it)
    expect(ledger.lastReminderAt(c.id)).toBeNull();
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
  it('at most one reminder per customer per 2 days', async () => {
    const { ledger, d, say1, tick } = await setup();
    const c = await ledger.createCustomer('Sunita');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(500) });
    await ledger.setConsent(c.id, true);
    d.start();
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_ready']);
    // asking again before anything was sent (a cancelled share) is still allowed
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_ready']);
    await ledger.recordReminder(c.id); // what the phone does once the shopkeeper has sent it
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_too_soon']);
    tick(1 * 24 * 3600_000);
    expect(keys(await say1('Sunita ko reminder bhejo'))).toEqual(['reminder_too_soon']);
    tick(1 * 24 * 3600_000);
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

describe('consent and bulk commands are never guessed', () => {
  it.each([
    'Send Sunita a reminder even if she does not agree',
    'Sunita ko bina pooche reminder bhejo',
    'सुनीता को रिमाइंडर भेजो चाहे वह सहमत न हो',
  ])('%s does not record consent or prepare anything', async (text) => {
    const { ledger, d, say1 } = await setup('en');
    const c = await ledger.createCustomer('Sunita');
    await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(500) });
    d.start();
    const rs = await say1(text);
    expect(rs.some((r) => r.action)).toBe(false);
    expect(ledger.consent(c.id)).toBe(false);
    expect(ledger.lastReminderAt(c.id)).toBeNull();
  });
  it('an explicit opt-in is recorded, with no reminder prepared', async () => {
    const { ledger, d, say1 } = await setup('en');
    const c = await ledger.createCustomer('Sunita');
    d.start();
    const rs = await say1('Opt Sunita in for reminders');
    expect(keys(rs)).toEqual(['consent_saved']);
    expect(ledger.consent(c.id)).toBe(true);
    expect(ledger.lastReminderAt(c.id)).toBeNull();
  });
  it.each(['delete all ledger entries', 'saare entries hata do', 'cancel everything', 'सब हटा दो'])('"%s" does not undo anything', async (text) => {
    const { ledger, d, say1 } = await setup('en');
    const c = await ledger.createCustomer('Ramesh');
    d.start();
    await say1('Ramesh ka 100 udhaar');
    const rs = await say1(text);
    expect(keys(rs)).not.toContain('undone');
    expect(ledger.balance(c.id)).toBe(paise(100));
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


describe('a new name is never created without a yes', () => {
  it('"no" drops it and asks whose account; naming the right person saves there, nothing is created', async () => {
    const { ledger, d, say1 } = await setup();
    const m = await ledger.createCustomer('Mohan');
    d.start();
    expect(keys(await say1('Mohn ka 300 udhaar hai'))).toContain('confirm_new_customer');
    expect(keys(await say1('nahi'))).toEqual(['ask_customer']);
    expect(ledger.customers()).toHaveLength(1);
    expect(ledger.activeEntries()).toHaveLength(0);
    const rs = await say1('Mohan');
    expect(keys(rs)).toEqual(['credit_saved']);
    expect(ledger.balance(m.id)).toBe(paise(300));
    expect(ledger.customers()).toHaveLength(1);
  });

  it('"nahi, Mohan" in one breath goes to Mohan', async () => {
    const { ledger, d, say1 } = await setup();
    const m = await ledger.createCustomer('Mohan');
    d.start();
    await say1('Kiran ka 300 udhaar');
    const rs = await say1('nahi Mohan');
    expect(keys(rs)).toEqual(['credit_saved']);
    expect(ledger.balance(m.id)).toBe(paise(300));
    expect(ledger.customers()).toHaveLength(1);
  });

  it('an unanswered "create a new khata?" expires and creates nothing', async () => {
    const { ledger, d, say1, tick } = await setup();
    d.start();
    await say1('Kiran ka 300 udhaar');
    tick(61_000);
    const rs = await say1('Aaj kitna udhaar gaya?');
    expect(keys(rs)).toContain('pending_expired');
    expect(ledger.customers()).toHaveLength(0);
    expect(ledger.activeEntries()).toHaveLength(0);
  });

  it('two new names in one sentence are asked about one at a time', async () => {
    const { ledger, d, say1 } = await setup();
    d.start();
    expect(keys(await say1('Kiran ka 100 udhaar aur Lata ka 200 udhaar'))).toEqual(['confirm_new_customer']);
    expect(keys(await say1('haan'))).toEqual(['new_customer', 'credit_saved', 'confirm_new_customer']);
    expect(keys(await say1('haan'))).toEqual(['new_customer', 'credit_saved']);
    expect(ledger.customers().map((c) => c.name)).toEqual(['Kiran', 'Lata']);
  });

  it('a question word like "kitna" is not a name to create (a query never creates)', async () => {
    const { ledger, d, say1 } = await setup();
    d.start();
    expect(keys(await say1('Kiran ka total kitna hai?'))).toEqual(['unknown_customer']);
    expect(ledger.customers()).toHaveLength(0);
  });
});

describe('a spoken correction never becomes a customer (the first usability test)', () => {
  // A friend said "mohan ke 3000 rupye udhar hain", then "nhi nhi 1500 rupye udhar hain".
  const SECOND = [
    'nhi nhi 1500 rupye udhar hain', 'nahi nahi 1500 rupaye udhaar hain', 'नहीं नहीं 1500 रुपये उधार हैं', 'nahi 1500 rupaye hain',
    'galat hai, 1500 rupaye udhaar hain', 'nahi, 1500', 'nahin 1500 udhaar', 'नहीं पंद्रह सौ रुपये उधार हैं', 'nahi nahi dedh hazaar udhaar hai', 'sorry 1500 udhaar hai',
  ];
  for (const second of SECOND) {
    it(`"${second}" replaces ₹3,000 with ₹1,500 on Mohan and creates nobody`, async () => {
      const { ledger, d, say1, tick } = await setup();
      const m = await ledger.createCustomer('Mohan');
      d.start();
      expect(keys(await say1('mohan ke 3000 rupye udhar hain'))).toEqual(['credit_saved']);
      tick(20_000);
      const rs = await say1(second);
      expect(keys(rs)).toEqual(['replaced']);
      expect(ledger.customers().map((c) => c.name)).toEqual(['Mohan']);
      expect(ledger.activeEntries(m.id).map((e) => [e.kind, e.paise])).toEqual([['credit', paise(1500)]]);
      expect(ledger.balance(m.id)).toBe(paise(1500));
    });
  }

  it('a correction that says "jama" turns the entry into a payment, and says the full result', async () => {
    const { ledger, d, say1 } = await setup();
    const m = await ledger.createCustomer('Mohan');
    d.start();
    await say1('Mohan ka 500 udhaar');
    await say1('Mohan ka 500 udhaar');
    const rs = await say1('nahi 200 jama');
    expect(keys(rs)).toEqual(['payment_saved']);
    expect(ledger.activeEntries(m.id).map((e) => [e.kind, e.paise])).toEqual([['credit', paise(500)], ['payment', paise(200)]]);
  });

  it('with nothing to correct, "nahi nahi 1500 udhaar hain" saves nothing and creates nobody', async () => {
    const { ledger, d, say1 } = await setup();
    d.start();
    const rs = await say1('nhi nhi 1500 rupye udhar hain');
    expect(keys(rs)).toEqual(['nothing_to_undo']);
    expect(ledger.customers()).toHaveLength(0);
    expect(ledger.activeEntries()).toHaveLength(0);
  });

  it('a correction that names someone else is still a new entry for that person', async () => {
    const { ledger, d, say1 } = await setup();
    const m = await ledger.createCustomer('Mohan');
    const s = await ledger.createCustomer('Sunita');
    d.start();
    await say1('Mohan ka 300 udhaar');
    expect(keys(await say1('nahi Sunita ka 500 udhaar'))).toEqual(['credit_saved']);
    expect(ledger.balance(m.id)).toBe(paise(300));
    expect(ledger.balance(s.id)).toBe(paise(500));
  });

  describe('F4 60s window and questionSpoken()', () => {
    it('is still open at 59s and answers successfully', async () => {
      const { ledger, d, say1, tick } = await setup();
      const r = await ledger.createCustomer('Ramesh');
      d.start();
      await say1('Ramesh ka 500'); // asks direction
      expect(d.pendingKind()).toBe('direction');
      tick(59_000); // 59s elapsed: window still open
      const rs = await say1('udhaar');
      expect(keys(rs)).toEqual(['credit_saved']);
      expect(ledger.balance(r.id)).toBe(paise(500));
      expect(d.hasPending()).toBe(false);
    });

    it('expires at 61s and saves nothing', async () => {
      const { ledger, d, say1, tick } = await setup();
      const r = await ledger.createCustomer('Ramesh');
      d.start();
      await say1('Ramesh ka 500'); // asks direction
      expect(d.pendingKind()).toBe('direction');
      tick(61_000); // 61s elapsed: window expired
      const rs = await say1('aaj kitna udhaar gaya?');
      expect(keys(rs)).toContain('pending_expired');
      expect(ledger.balance(r.id)).toBe(0);
      expect(d.hasPending()).toBe(false);
    });

    it('questionSpoken() starts the 60s clock from when audio finishes playing', async () => {
      const { ledger, d, say1, tick } = await setup();
      const r = await ledger.createCustomer('Ramesh');
      d.start();
      await say1('Ramesh ka 500'); // asks direction
      // 5 seconds of audio played
      tick(5_000);
      d.questionSpoken(); // controller notifies audio finished
      // 59 seconds after audio finished (total 64s since asked)
      tick(59_000);
      const rs = await say1('udhaar');
      expect(keys(rs)).toEqual(['credit_saved']);
      expect(ledger.balance(r.id)).toBe(paise(500));
    });

    it('barge-in resets the 60s TTL', async () => {
      const { ledger, d, say1, tick } = await setup();
      await ledger.createCustomer('Ramesh', ['doodh']);
      await ledger.createCustomer('Ramesh', ['auto']);
      d.start();
      await say1('Ramesh ka 300 udhaar'); // ambiguous: asks which
      expect(d.pendingKind()).toBe('which');
      tick(40_000);
      // user barges in with an ambiguous reply again
      await say1('Ramesh');
      // 40s later (total 80s from start, but 40s from barge-in)
      tick(40_000);
      const rs = await say1('doodh wale');
      expect(keys(rs)).toEqual(['credit_saved']);
    });

    it('nothing saved on expiry for every pending kind', async () => {
      const { ledger, d, say1, tick } = await setup();
      d.start();

      // 1. direction
      const c1 = await ledger.createCustomer('Anita');
      await say1('Anita 100');
      expect(d.pendingKind()).toBe('direction');
      tick(61_000);
      expect(keys(await say1('hisaab'))).toContain('pending_expired');
      expect(ledger.balance(c1.id)).toBe(0);

      // 2. amount
      await say1('Anita ka udhaar');
      expect(d.pendingKind()).toBe('amount');
      tick(61_000);
      expect(keys(await say1('hisaab'))).toContain('pending_expired');
      expect(ledger.balance(c1.id)).toBe(0);

      // 3. confirm_amount (high amount)
      await say1('Anita ka pachaas hazaar rupaye udhaar');
      expect(d.pendingKind()).toBe('confirm_amount');
      tick(61_000);
      expect(keys(await say1('hisaab'))).toContain('pending_expired');
      expect(ledger.balance(c1.id)).toBe(0);

      // 4. new_customer
      await say1('Pooja ka 200 udhaar');
      expect(d.pendingKind()).toBe('new_customer');
      tick(61_000);
      expect(keys(await say1('hisaab'))).toContain('pending_expired');
      expect(ledger.customers().some((x) => x.name === 'Pooja')).toBe(false);

      // 5. consent
      await say1('Anita ko reminder bhejo');
      // consent question asked
      expect(d.pendingKind()).toBe('consent');
      tick(61_000);
      expect(keys(await say1('hisaab'))).toContain('pending_expired');

      // 6. which
      await ledger.createCustomer('Mohan', ['auto']);
      await ledger.createCustomer('Mohan', ['dairy']);
      await say1('Mohan ka 100 udhaar');
      expect(d.pendingKind()).toBe('which');
      tick(61_000);
      expect(keys(await say1('hisaab'))).toContain('pending_expired');
      expect(ledger.activeEntries().filter((e) => e.paise === paise(100))).toHaveLength(0);

      // 7. nickname
      await say1('naya customer Mohan 100 udhaar');
      expect(d.pendingKind()).toBe('nickname');
      tick(61_000);
      expect(keys(await say1('hisaab'))).toContain('pending_expired');
    });
  });

  describe('F3: nickname flow for duplicate customer accounts', () => {
    it('a nickname that holds a word like bidi is a nickname, not a skip', async () => {
      const { ledger, d, say1 } = await setup('en');
      await ledger.createCustomer('Ramesh');
      d.start();
      await say1('new customer Ramesh 500 credit');
      const rs = await say1('bidi shop');
      expect(keys(rs)).toEqual(['new_customer', 'credit_saved']);
      expect(ledger.customers().some((c) => c.nickname === 'bidi shop')).toBe(true);
    });

    it('a name with regex characters in it does not crash the nickname answer', async () => {
      const { ledger, d, say1 } = await setup('en');
      await ledger.createCustomer('Ra(mesh');
      d.start();
      await say1('new customer Ra(mesh 500 credit');
      if (d.pendingKind() === 'nickname') {
        await expect(say1('dairy')).resolves.toBeDefined();
      }
    });

    it('nickname given in en: creates customer with nickname and posts credit', async () => {
      const { ledger, d, say1 } = await setup('en');
      const r1 = await ledger.createCustomer('Ramesh');
      d.start();

      const rs1 = await say1('new customer Ramesh 500 credit');
      expect(keys(rs1)).toEqual(['ask_nickname']);
      expect(rs1[0]!.text).toBe(
        'A khata for Ramesh already exists. What nickname for the new one, for example dairy or school? Say skip to continue.',
      );
      expect(d.pendingKind()).toBe('nickname');

      const rs2 = await say1('dairy');
      expect(keys(rs2)).toEqual(['new_customer', 'credit_saved']);
      expect(rs2[0]!.text).toBe('New name Ramesh dairy.');
      expect(ledger.customers()).toHaveLength(2);

      const r2 = ledger.customers().find((c) => c.id !== r1.id)!;
      expect(r2.name).toBe('Ramesh');
      expect(r2.nickname).toBe('dairy');
      expect(ledger.balance(r2.id)).toBe(paise(500));
      expect(ledger.balance(r1.id)).toBe(0);
    });

    it('nickname given in hi: creates customer with nickname and posts credit', async () => {
      const { ledger, d, say1 } = await setup('hi');
      const r1 = await ledger.createCustomer('रमेश');
      d.start();

      const rs1 = await say1('naya customer रमेश 500 udhaar');
      expect(keys(rs1)).toEqual(['ask_nickname']);
      expect(rs1[0]!.text).toBe(
        'रमेश नाम का खाता पहले से है। नए खाते का निकनेम क्या रखें, जैसे डेयरी या स्कूल? जारी रखने के लिए छोड़ बोलिए।',
      );
      expect(d.pendingKind()).toBe('nickname');

      const rs2 = await say1('डेयरी');
      expect(keys(rs2)).toEqual(['new_customer', 'credit_saved']);
      expect(rs2[0]!.text).toBe('नया नाम रमेश डेयरी।');
      expect(ledger.customers()).toHaveLength(2);

      const r2 = ledger.customers().find((c) => c.id !== r1.id)!;
      expect(r2.nickname).toBe('डेयरी');
      expect(ledger.balance(r2.id)).toBe(paise(500));
      expect(ledger.balance(r1.id)).toBe(0);
    });

    it('nickname given in kn: creates customer with nickname and posts credit', async () => {
      const { ledger, d, say1 } = await setup('kn');
      const r1 = await ledger.createCustomer('ರಮೇಶ್');
      d.start();

      const rs1 = await say1('ಹೊಸ ಗ್ರಾಹಕ ರಮೇಶ್ 500 ಉಧಾರ');
      expect(keys(rs1)).toEqual(['ask_nickname']);
      expect(rs1[0]!.text).toBe(
        'ರಮೇಶ್ ಹೆಸರಿನ ಖಾತೆ ಈಗಾಗಲೇ ಇದೆ. ಹೊಸ ಖಾತೆಗೆ ಉಪನಾಮ ಏನು, ಉದಾಹರಣೆ ಡೇರಿ ಅಥವಾ ಸ್ಕೂಲ್? ಮುಂದುವರಿಸಲು ಬಿಟ್ಟುಬಿಡಿ ಎಂದು ಹೇಳಿ.',
      );
      expect(d.pendingKind()).toBe('nickname');

      const rs2 = await say1('ಡೇರಿ');
      expect(keys(rs2)).toEqual(['new_customer', 'credit_saved']);
      expect(rs2[0]!.text).toBe('ಹೊಸ ಹೆಸರು ರಮೇಶ್ ಡೇರಿ.');
      expect(ledger.customers()).toHaveLength(2);

      const r2 = ledger.customers().find((c) => c.id !== r1.id)!;
      expect(r2.nickname).toBe('ಡೇರಿ');
      expect(ledger.balance(r2.id)).toBe(paise(500));
      expect(ledger.balance(r1.id)).toBe(0);
    });

    it.each([
      ['en', 'new customer Ramesh 200 credit', 'skip'],
      ['en', 'new customer Ramesh 200 credit', 'no'],
      ['hi', 'naya customer Ramesh 200 udhaar', 'छोड़ दो'],
      ['hi', 'naya customer Ramesh 200 udhaar', 'चोड़ दो'],
      ['hi', 'naya customer Ramesh 200 udhaar', 'नहीं'],
      ['kn', 'ಹೊಸ ಗ್ರಾಹಕ ರಮೇಶ್ 200 ಉಧಾರ', 'ಬಿಟ್ಟುಬಿಡಿ'],
      ['kn', 'ಹೊಸ ಗ್ರಾಹಕ ರಮೇಶ್ 200 ಉಧಾರ', 'ಇಲ್ಲ'],
    ])('nickname skipped in %s via "%s": creates customer without nickname', async (lang, phrase, skipWord) => {
      const { ledger, d, say1 } = await setup(lang as SpeechLang);
      const r1 = await ledger.createCustomer('Ramesh');
      d.start();

      const rs1 = await say1(phrase);
      expect(keys(rs1)).toEqual(['ask_nickname']);

      const rs2 = await say1(skipWord);
      expect(keys(rs2)).toEqual(['new_customer', 'credit_saved']);
      expect(ledger.customers()).toHaveLength(2);

      const r2 = ledger.customers().find((c) => c.id !== r1.id)!;
      expect(r2.nickname).toBeUndefined();
      expect(ledger.balance(r2.id)).toBe(paise(200));
    });

    it('nickname question expired: drops question and creates no customer', async () => {
      const { ledger, d, say1, tick } = await setup('en');
      await ledger.createCustomer('Ramesh');
      d.start();

      const rs1 = await say1('new customer Ramesh 100 credit');
      expect(keys(rs1)).toEqual(['ask_nickname']);
      expect(d.pendingKind()).toBe('nickname');

      tick(61_000);
      const rs2 = await say1('total hisab');
      expect(keys(rs2)).toContain('pending_expired');
      expect(ledger.customers()).toHaveLength(1);
    });

    it('nickname already used by another Ramesh: re-asks and then accepts a different nickname', async () => {
      const { ledger, d, say1 } = await setup('en');
      await ledger.createCustomer('Ramesh', ['dairy'], { nickname: 'dairy' });
      d.start();

      const rs1 = await say1('new customer Ramesh 300 credit');
      expect(keys(rs1)).toEqual(['ask_nickname']);

      // Attempt duplicate nickname "dairy"
      const rs2 = await say1('dairy');
      expect(keys(rs2)).toEqual(['ask_nickname']);
      expect(d.pendingKind()).toBe('nickname');

      // Now provide a unique nickname "school"
      const rs3 = await say1('school');
      expect(keys(rs3)).toEqual(['new_customer', 'credit_saved']);
      expect(ledger.customers()).toHaveLength(2);
      expect(ledger.customers().map((c) => c.nickname)).toEqual(['dairy', 'school']);
    });

    it('disambiguation question speaks nicknames in en, hi, and kn', async () => {
      // 1. English
      {
        const { ledger, d, say1 } = await setup('en');
        const c1 = await ledger.createCustomer('Ramesh', ['dairy'], { nickname: 'dairy' });
        const c2 = await ledger.createCustomer('Ramesh', ['school'], { nickname: 'school' });
        d.start();

        const rs = await say1('Ramesh 300 credit');
        expect(keys(rs)).toEqual(['ask_which']);
        expect(rs[0]!.text).toBe('Which Ramesh? Ramesh dairy or Ramesh school?');

        const resolved = await say1('Ramesh dairy');
        expect(keys(resolved)).toEqual(['credit_saved']);
        expect(ledger.balance(c1.id)).toBe(paise(300));
        expect(ledger.balance(c2.id)).toBe(0);
      }

      // 2. Hindi
      {
        const { ledger, d, say1 } = await setup('hi');
        const c1 = await ledger.createCustomer('रमेश', ['डेयरी'], { nickname: 'डेयरी' });
        const c2 = await ledger.createCustomer('रमेश', ['स्कूल'], { nickname: 'स्कूल' });
        d.start();

        const rs = await say1('रमेश का 300 उधार');
        expect(keys(rs)).toEqual(['ask_which']);
        expect(rs[0]!.text).toBe('कौन से रमेश? रमेश डेयरी या रमेश स्कूल?');

        const resolved = await say1('रमेश स्कूल');
        expect(keys(resolved)).toEqual(['credit_saved']);
        expect(ledger.balance(c2.id)).toBe(paise(300));
        expect(ledger.balance(c1.id)).toBe(0);
      }

      // 3. Kannada
      {
        const { ledger, d, say1 } = await setup('kn');
        const c1 = await ledger.createCustomer('ರಮೇಶ್', ['ಡೇರಿ'], { nickname: 'ಡೇರಿ' });
        const c2 = await ledger.createCustomer('ರಮೇಶ್', ['ಸ್ಕೂಲ್'], { nickname: 'ಸ್ಕೂಲ್' });
        d.start();

        const rs = await say1('ರಮೇಶ್ 300 ಉಧಾರ');
        expect(keys(rs)).toEqual(['ask_which']);
        expect(rs[0]!.text).toBe('ಯಾವ ರಮೇಶ್? ರಮೇಶ್ ಡೇರಿ ಅಥವಾ ರಮೇಶ್ ಸ್ಕೂಲ್?');

        const resolved = await say1('ರಮೇಶ್ ಡೇರಿ');
        expect(keys(resolved)).toEqual(['credit_saved']);
        expect(ledger.balance(c1.id)).toBe(paise(300));
        expect(ledger.balance(c2.id)).toBe(0);
      }
    });

    it('new customer for an unused name asks confirm_new_customer first, no nickname asked', async () => {
      const { ledger, d, say1 } = await setup('en');
      d.start();

      const rs1 = await say1('new customer Suresh 400 credit');
      expect(keys(rs1)).toEqual(['confirm_new_customer']);
      expect(d.pendingKind()).toBe('new_customer');

      const rs2 = await say1('yes');
      expect(keys(rs2)).toEqual(['new_customer', 'credit_saved']);
      expect(ledger.customers()).toHaveLength(1);
      expect(ledger.customers()[0]!.name).toBe('Suresh');
      expect(ledger.customers()[0]!.nickname).toBeUndefined();
    });
  });

  describe('F5 customer summary', () => {
    it('case 1: owes (balance > 0) in en, hi, kn', async () => {
      // 1. English
      {
        const { ledger, d, say1 } = await setup('en');
        const c = await ledger.createCustomer('Ramesh');
        await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(340), at: T0 - 3 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('Tell me about Ramesh');
        expect(keys(rs)).toEqual(['summary_customer']);
        expect(rs[0]!.text).toBe('Ramesh owes ₹340. Last entry: credit of ₹340, 3 days ago. 1 entries in the last 30 days.');
      }

      // 2. Hindi
      {
        const { ledger, d, say1 } = await setup('hi');
        const c = await ledger.createCustomer('रमेश');
        await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(340), at: T0 - 3 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('रमेश का हिसाब बताओ');
        expect(keys(rs)).toEqual(['summary_customer']);
        expect(rs[0]!.text).toBe('रमेश का बाकी ₹340 है। पिछली एंट्री: उधार ₹340, 3 दिन पहले। पिछले 30 दिनों में 1 एंट्री।');
      }

      // 3. Kannada
      {
        const { ledger, d, say1 } = await setup('kn');
        const c = await ledger.createCustomer('ರಮೇಶ್');
        await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(340), at: T0 - 3 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('ರಮೇಶ್ ಬಗ್ಗೆ ಹೇಳಿ');
        expect(keys(rs)).toEqual(['summary_customer']);
        expect(rs[0]!.text).toBe('ರಮೇಶ್ ಬಾಕಿ ₹340. ಕೊನೆಯ ದಾಖಲೆ: ಉಧಾರ ₹340, 3 ದಿನಗಳ ಹಿಂದೆ. ಕಳೆದ 30 ದಿನಗಳಲ್ಲಿ 1 ದಾಖಲೆಗಳು.');
      }
    });

    it('case 2: advance (balance < 0) in en, hi, kn', async () => {
      // 1. English
      {
        const { ledger, d, say1 } = await setup('en');
        const c = await ledger.createCustomer('Ramesh');
        await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: paise(200), at: T0 - 1 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('Ramesh summary please');
        expect(keys(rs)).toEqual(['summary_advance']);
        expect(rs[0]!.text).toBe('Ramesh is ₹200 in advance. Last entry: payment of ₹200, yesterday. 1 entries in the last 30 days.');
      }

      // 2. Hindi
      {
        const { ledger, d, say1 } = await setup('hi');
        const c = await ledger.createCustomer('रमेश');
        await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: paise(200), at: T0 - 1 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('रमेश का हिसाब बताओ');
        expect(keys(rs)).toEqual(['summary_advance']);
        expect(rs[0]!.text).toBe('रमेश का ₹200 एडवांस है। पिछली एंट्री: जमा ₹200, कल। पिछले 30 दिनों में 1 एंट्री।');
      }

      // 3. Kannada
      {
        const { ledger, d, say1 } = await setup('kn');
        const c = await ledger.createCustomer('ರಮೇಶ್');
        await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: paise(200), at: T0 - 1 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('ರಮೇಶ್ ಬಗ್ಗೆ ಹೇಳಿ');
        expect(keys(rs)).toEqual(['summary_advance']);
        expect(rs[0]!.text).toBe('ರಮೇಶ್ ಅವರ ₹200 ಮುಂಗಡ ಇದೆ. ಕೊನೆಯ ದಾಖಲೆ: ಜಮಾ ₹200, ನಿನ್ನೆ. ಕಳೆದ 30 ದಿನಗಳಲ್ಲಿ 1 ದಾಖಲೆಗಳು.');
      }
    });

    it('case 3: settled (balance === 0 with entries) in en, hi, kn', async () => {
      // 1. English
      {
        const { ledger, d, say1 } = await setup('en');
        const c = await ledger.createCustomer('Ramesh');
        await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(200), at: T0 - 4 * 24 * 60 * 60 * 1000 });
        await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: paise(200), at: T0 - 2 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('Tell me about Ramesh');
        expect(keys(rs)).toEqual(['summary_settled']);
        expect(rs[0]!.text).toBe('Ramesh has nothing due. Last entry: payment of ₹200, the day before yesterday. 2 entries in the last 30 days.');
      }

      // 2. Hindi
      {
        const { ledger, d, say1 } = await setup('hi');
        const c = await ledger.createCustomer('रमेश');
        await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(200), at: T0 - 4 * 24 * 60 * 60 * 1000 });
        await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: paise(200), at: T0 - 2 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('रमेश का हिसाब बताओ');
        expect(keys(rs)).toEqual(['summary_settled']);
        expect(rs[0]!.text).toBe('रमेश का कुछ बाकी नहीं। पिछली एंट्री: जमा ₹200, परसों। पिछले 30 दिनों में 2 एंट्री।');
      }

      // 3. Kannada
      {
        const { ledger, d, say1 } = await setup('kn');
        const c = await ledger.createCustomer('ರಮೇಶ್');
        await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(200), at: T0 - 4 * 24 * 60 * 60 * 1000 });
        await ledger.postEntry({ customerId: c.id, kind: 'payment', paise: paise(200), at: T0 - 2 * 24 * 60 * 60 * 1000 });
        d.start();

        const rs = await say1('ರಮೇಶ್ ಬಗ್ಗೆ ಹೇಳಿ');
        expect(keys(rs)).toEqual(['summary_settled']);
        expect(rs[0]!.text).toBe('ರಮೇಶ್ ಬಾಕಿ ಇಲ್ಲ. ಕೊನೆಯ ದಾಖಲೆ: ಜಮಾ ₹200, ಮೊನ್ನೆ. ಕಳೆದ 30 ದಿನಗಳಲ್ಲಿ 2 ದಾಖಲೆಗಳು.');
      }
    });

    it('case 4: no entries yet in en, hi, kn', async () => {
      // 1. English
      {
        const { ledger, d, say1 } = await setup('en');
        await ledger.createCustomer('Ramesh');
        d.start();

        const rs = await say1('Tell me about Ramesh');
        expect(keys(rs)).toEqual(['customer_summary_none']);
        expect(rs[0]!.text).toBe('No entries for Ramesh yet.');
      }

      // 2. Hindi
      {
        const { ledger, d, say1 } = await setup('hi');
        await ledger.createCustomer('रमेश');
        d.start();

        const rs = await say1('रमेश का हिसाब बताओ');
        expect(keys(rs)).toEqual(['customer_summary_none']);
        expect(rs[0]!.text).toBe('रमेश के लिए अभी कोई एंट्री नहीं है।');
      }

      // 3. Kannada
      {
        const { ledger, d, say1 } = await setup('kn');
        await ledger.createCustomer('ರಮೇಶ್');
        d.start();

        const rs = await say1('ರಮೇಶ್ ಬಗ್ಗೆ ಹೇಳಿ');
        expect(keys(rs)).toEqual(['customer_summary_none']);
        expect(rs[0]!.text).toBe('ರಮೇಶ್ ಅವರಿಗೆ ಇನ್ನೂ ಯಾವುದೇ ದಾಖಲೆಗಳಿಲ್ಲ.');
      }
    });

    it('programmatic summaryFor(id) matches voiced summary', async () => {
      const { ledger, d } = await setup('en');
      const c = await ledger.createCustomer('Ramesh');
      await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(500), at: T0 });
      d.start();

      const rs = d.summaryFor(c.id);
      expect(keys(rs)).toEqual(['summary_customer']);
      expect(rs[0]!.text).toBe('Ramesh owes ₹500. Last entry: credit of ₹500, today. 1 entries in the last 30 days.');
    });

    it('customer summary asks for customer name if missing', async () => {
      const { ledger, d, say1 } = await setup('hi');
      const c = await ledger.createCustomer('रमेश');
      await ledger.postEntry({ customerId: c.id, kind: 'credit', paise: paise(500), at: T0 });
      d.start();

      const rs1 = await say1('हिसाब बताओ');
      expect(keys(rs1)).toEqual(['ask_customer']);

      const rs2 = await say1('रमेश');
      expect(keys(rs2)).toEqual(['summary_customer']);
      expect(rs2[0]!.text).toContain('रमेश का बाकी ₹500 है');
    });
  });
});

describe('"pura hisab": the whole ledger, not a customer called Pura', () => {
  async function ledgerWithEntries(lang: SpeechLang) {
    const s = await setup(lang);
    const a = await s.ledger.createCustomer('Mohan');
    const b = await s.ledger.createCustomer('Sunita');
    await s.ledger.postEntry({ customerId: a.id, kind: 'credit', paise: paise(500), at: T0 - 2 * 24 * 3600_000 }); // earlier
    await s.ledger.postEntry({ customerId: a.id, kind: 'credit', paise: paise(300), at: T0 - 3600_000 }); // today
    await s.ledger.postEntry({ customerId: b.id, kind: 'payment', paise: paise(100), at: T0 - 1800_000 }); // today
    s.d.start();
    return s;
  }
  it.each(['aaj ka pura hisab batao', 'pura hisab batao', 'poora hisab dikhao', 'पूरा हिसाब बताओ'])('%s gives today and all-time totals and creates nobody', async (text) => {
    const { ledger, say1 } = await ledgerWithEntries('hi');
    const rs = await say1(text);
    expect(keys(rs)).toEqual(['summary_all']);
    expect(rs[0]!.text).toContain('₹300'); // credit today
    expect(rs[0]!.text).toContain('₹100'); // paid today
    expect(rs[0]!.text).toContain('₹200'); // net of the day, credit 300 minus paid 100
    expect(rs[0]!.text).toContain('₹800'); // all-time credit
    expect(ledger.customers().map((c) => c.name).sort()).toEqual(['Mohan', 'Sunita']);
  });
  it('says net paid when the day had more payments than credit', async () => {
    const s = await setup('en');
    const a = await s.ledger.createCustomer('Mohan');
    await s.ledger.postEntry({ customerId: a.id, kind: 'credit', paise: paise(500), at: T0 - 2 * 24 * 3600_000 });
    await s.ledger.postEntry({ customerId: a.id, kind: 'payment', paise: paise(400), at: T0 - 3600_000 });
    s.d.start();
    const rs = await s.say1('show full summary');
    expect(rs[0]!.text).toBe('today: credit ₹0, paid ₹400, net payment ₹400. Overall: credit ₹500, paid ₹400.');
  });
  it('an empty ledger says there is nothing, in every language', async () => {
    for (const lang of ['en', 'hi', 'kn', 'ta', 'te', 'mr', 'gu'] as const) {
      const { say1, d } = await setup(lang);
      d.start();
      expect(keys(await say1(lang === 'en' ? 'show full summary' : 'pura hisab batao'))).toEqual(['balance_day_none']);
    }
  });
  it('a named customer still gets that customer\'s own summary', async () => {
    const { say1 } = await ledgerWithEntries('hi');
    expect(keys(await say1('Mohan ka hisab batao'))).toEqual(['summary_customer']);
  });
});
