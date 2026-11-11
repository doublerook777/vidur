import { describe, expect, it } from 'vitest';

import { Ledger, MemoryStore } from '../ledger/index.js';
import { seedDemoLedger } from '../demo/index.js';
import { parseAmount } from '../numbers/index.js';
import { unglue } from '../numbers/unglue.js';
import { Dialogue, type Reply } from './engine.js';
import type { SpeechLang } from '../i18n/index.js';

/** Fixes that came out of the first 32-line live rehearsal. */
const T0 = Date.UTC(2026, 10, 12, 6, 30);
async function setup(lang: SpeechLang = 'hi') {
  let n = 0;
  const ledger = await Ledger.load(new MemoryStore(), () => T0, () => `id${++n}`);
  await seedDemoLedger(ledger, T0);
  const d = new Dialogue({ ledger, lang, clock: () => T0 });
  d.start();
  return { ledger, d };
}
const text = (rs: Reply[]): string => rs.map((r) => r.text).join(' | ');

describe('words the speech service glues together', () => {
  it('splits "saudhar", "paanchsau", "teensau jama" back into words', () => {
    expect(unglue('Pooja ka saudhar')).toBe('Pooja ka sau udhar');
    expect(unglue('Pooja ka saudhaar')).toBe('Pooja ka sau udhaar');
    expect(unglue('Anil ka paanchsaudhar')).toBe('Anil ka paanch sau udhar');
    expect(unglue('Neha ka teensau jama')).toBe('Neha ka teen sau jama');
    expect(unglue('Neha ka do hazarudhar')).toBe('Neha ka do hazar udhar');
    expect(unglue('पूजा का सौउधार')).toBe('पूजा का सौ उधार');
    expect(unglue('Saurabh ka dus')).toBe('Saurabh ka dus'); // ordinary words are left alone
  });
  it('reads the amount through the glue', () => {
    expect(parseAmount('paanchsau').map((a) => a.paise)).toEqual([50000]);
    expect(parseAmount('Pooja ka saudhar').map((a) => a.paise)).toEqual([10000]);
  });
  it('"Pooja ka saudhar" saves ₹100 credit as it should', async () => {
    const { ledger, d } = await setup();
    const pooja = ledger.customers().find((c) => c.name === 'Pooja')!;
    const before = ledger.balance(pooja.id);
    const rs = await d.handle('Pooja ka saudhar');
    expect(rs[0]!.key).toMatch(/^credit_saved/);
    expect(ledger.balance(pooja.id)).toBe(before + 10000);
  });
});

describe('the balance after a credit is never printed as a negative or ₹0.00', () => {
  it('says the advance that is left, or that the account is clear', async () => {
    const { ledger, d } = await setup();
    const pooja = ledger.customers().find((c) => c.name === 'Pooja')!;
    expect(ledger.balance(pooja.id)).toBe(-20000); // the demo has Pooja ₹200 ahead
    const advance = await d.handle('Pooja ka sau udhaar');
    expect(advance[0]!.key).toBe('credit_saved_advance');
    expect(text(advance)).not.toMatch(/-|\.00/);
    const clear = await d.handle('Pooja ka sau udhaar');
    expect(clear[0]!.key).toBe('credit_saved_even');
    expect(text(clear)).not.toMatch(/-|\.00/);
  });
});

describe('asking for the balance of a customer who is ahead', () => {
  it('says the advance, not "all clear"', async () => {
    const { d } = await setup('en');
    const rs = await d.handle('Pooja ka total kitna hai');
    expect(rs[0]!.key).toBe('balance_advance');
    expect(text(rs)).toContain('₹200');
  });
});

describe('which Ramesh, in the language being spoken', () => {
  it.each([
    ['en', /doodh wale/, /auto wale/],
    ['hi', /दूध वाले/, /ऑटो वाले/],
    ['kn', /ಹಾಲಿನವರು/, /ಆಟೋದವರು/],
  ] as const)('%s asks with aliases in its own script', async (lang, milk, auto) => {
    const { d } = await setup(lang);
    const q = text(await d.handle(lang === 'kn' ? 'ರಮೇಶ್ ಮುನ್ನೂರ ನಲವತ್ತು ಉಧಾರ್' : 'Ramesh ka teen sau udhaar'));
    expect(q).toMatch(milk);
    expect(q).toMatch(auto);
    if (lang === 'kn') expect(q).not.toMatch(/[A-Za-z]/);
    if (lang === 'hi') expect(q).not.toMatch(/wale/);
  });
  it.each([
    'doodh wale', 'doodh valle', 'दूध वाले', 'दूध वाला', 'ದೂದ್ ವಾಲೆ', 'ದೂಧ್ ವಾಲೆ', 'ಹಾಲಿನವರು',
  ])('picks the milk Ramesh when the answer is "%s", whatever the script', async (answer) => {
    const { ledger, d } = await setup('kn');
    await d.handle('ರಮೇಶ್ ಮುನ್ನೂರ ನಲವತ್ತು ಉಧಾರ್');
    const rs = await d.handle(answer);
    expect(rs[0]!.key).toMatch(/^credit_saved/);
    const milk = ledger.customers().find((c) => c.aliases.includes('doodh wale'))!;
    expect(ledger.activeEntries(milk.id).some((e) => e.kind === 'credit' && e.paise === 34000 && e.at === T0)).toBe(true);
  });
  it.each(['auto wale', 'ऑटो वाले', 'ಆಟೋ ವಾಲೆ', 'ಆಟೋದವರು'])('picks the auto Ramesh for "%s"', async (answer) => {
    const { ledger, d } = await setup('hi');
    await d.handle('Ramesh ka teen sau udhaar');
    await d.handle(answer);
    const auto = ledger.customers().find((c) => c.aliases.includes('auto wale'))!;
    expect(ledger.activeEntries(auto.id).some((e) => e.kind === 'credit' && e.paise === 30000 && e.at === T0)).toBe(true);
  });
});

describe('cancelling a question', () => {
  it('drops it, saves nothing, and the next full sentence starts fresh', async () => {
    const { ledger, d } = await setup('en');
    const count = ledger.activeEntries().length;
    await d.handle('Ramesh do forty');
    expect(d.hasPending()).toBe(true);
    const rs = d.cancelPending();
    expect(rs.map((r) => r.key)).toEqual(['dropped_pending']);
    expect(d.hasPending()).toBe(false);
    expect(ledger.activeEntries().length).toBe(count);
    expect(d.cancelPending()).toEqual([]); // nothing open: nothing to say
    const next = await d.handle('Mohan credit forty');
    expect(next[0]!.key).toMatch(/^credit_saved/);
  });
});

describe('Kannada speech-to-text spellings of udhaar and jama', () => {
  it.each(['ಉದಾಹರ್', 'ಉದಾಹರ', 'ಉದ್ದಾರ್', 'ಉಧಾರಿ', 'ಉಧಾರ್'])('"%s" is a credit', async (w) => {
    const { ledger, d } = await setup('kn');
    const sunita = ledger.customers().find((c) => c.name === 'Sunita')!;
    const before = ledger.balance(sunita.id);
    const rs = await d.handle(`ಸುನಿತಾ ಇನ್ನೂರು ${w}`);
    expect(rs[0]!.key).toMatch(/^credit_saved/);
    expect(ledger.balance(sunita.id)).toBe(before + 20000);
  });
  it.each(['ಜಮಾ', 'ಜಮ', 'ಜಮೆ'])('"%s" is a payment', async (w) => {
    const { ledger, d } = await setup('kn');
    const sunita = ledger.customers().find((c) => c.name === 'Sunita')!;
    const before = ledger.balance(sunita.id);
    await d.handle(`ಸುನಿತಾ ಇನ್ನೂರು ${w}`);
    expect(ledger.balance(sunita.id)).toBe(before - 20000);
  });
  it('the exact case from the rehearsal: which Ramesh, answer, then the direction as the service wrote it', async () => {
    const { ledger, d } = await setup('kn');
    const first = await d.handle('ರಮೇಶ್ ಮುನ್ನೂರ ನಲವತ್ತು ಉದಾಹರ್'); // heard as "udaahar": the direction must not be lost
    expect(first[0]!.key).toBe('ask_which');
    const second = await d.handle('ಆಟೋದವರು');
    expect(second[0]!.key).toMatch(/^credit_saved/);
    const auto = ledger.customers().find((c) => c.aliases.includes('auto wale'))!;
    expect(ledger.activeEntries(auto.id).some((e) => e.kind === 'credit' && e.paise === 34000)).toBe(true);
  });
});

describe('the answer to "credit or payment?" survives odd spellings', () => {
  it.each(['ಉದಾಹರ್.', 'udahar', 'uddar', 'udhaaar', 'उदहार', 'ಜಮಾ.', 'jam'])('"%s" answers the question', async (answer) => {
    const { ledger, d } = await setup('kn');
    const sunita = ledger.customers().find((c) => c.name === 'Sunita')!;
    const before = ledger.balance(sunita.id);
    const q = await d.handle('ಸುನಿತಾ ಇನ್ನೂರು');
    expect(q[0]!.key).toBe('ask_direction');
    const rs = await d.handle(answer);
    expect(rs[0]!.key).toMatch(/_saved|payment_cleared|payment_advance/);
    expect(Math.abs(ledger.balance(sunita.id) - before)).toBe(20000);
  });
  it('an unrelated word is still not an answer', async () => {
    const { d } = await setup('en');
    await d.handle('Sunita 200');
    const rs = await d.handle('banana');
    expect(rs.map((r) => r.key)).not.toContain('credit_saved');
  });
});
