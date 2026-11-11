import { describe, expect, it } from 'vitest';

import { interpret } from './intent.js';
import type { ParsedEvent } from './types.js';

const NOW = Date.UTC(2026, 10, 11, 6, 0); // Wed 11 Nov 2026
const run = (t: string, customers = []): ParsedEvent[] => interpret(t, { nowMs: NOW, customers }).events;
const first = (t: string): ParsedEvent => run(t)[0]!;
const rupees = (e: ParsedEvent): number | undefined => (e.amountPaise === undefined ? undefined : e.amountPaise / 100);

describe('entries and direction', () => {
  it.each([
    ['Ramesh ka 340 udhaar', 'credit_entry', 340, 'Ramesh'],
    ['रमेश का ३४० उधार', 'credit_entry', 340, 'रमेश'],
    ['Sunita ne 200 jama kiye', 'payment', 200, 'Sunita'],
    ['Sunita ne 200 diye', 'payment', 200, 'Sunita'],
    ['Sunita ko 200 diye', 'credit_entry', 200, 'Sunita'],
    ['सुनीता ने दो सौ दिए', 'payment', 200, 'सुनीता'],
    ['सुनीता को दो सौ दिए', 'credit_entry', 200, 'सुनीता'],
    ['Mohan ka 50 udhaar', 'credit_entry', 50, 'Mohan'],
    ['Mohan paid 500', 'payment', 500, 'Mohan'],
    ['Mohan took 500 on credit', 'credit_entry', 500, 'Mohan'],
    ['Ramesh ka dedh sau udhaar likh do', 'credit_entry', 150, 'Ramesh'],
    ['Mohan ne sawa do sau wapas kiye', 'payment', 225, 'Mohan'],
  ])('%s', (text, intent, amount, who) => {
    const e = first(text);
    expect([e.intent, rupees(e), e.customerSpoken]).toEqual([intent, amount, who]);
    expect(e.needs).toEqual([]);
  });

  it('a bare "diya" with no case marker asks for the direction', () => {
    const e = first('Ramesh 340 diya');
    expect(e.needs).toContain('direction');
  });
  it('no direction word at all asks for the direction', () => {
    const e = first('Ramesh 340');
    expect(e.needs).toContain('direction');
    expect(rupees(e)).toBe(340);
  });
  it('no amount asks for the amount', () => {
    expect(first('Ramesh ka udhaar likh do').needs).toContain('amount');
  });
  it('no name asks for the customer', () => {
    expect(first('340 udhaar').needs).toContain('customer');
  });
  it('a low-confidence amount asks for confirmation', () => {
    expect(first('Ramesh ka 3:40 udhaar').needs).toContain('amount_confirm');
  });
});

describe('several events in one utterance', () => {
  it('Ramesh ka 340 udhaar, kal 200 diya tha', () => {
    const evs = run('Ramesh ka 340 udhaar, kal 200 diya tha');
    expect(evs.map((e) => [e.intent, rupees(e), e.customerSpoken, e.dateToken])).toEqual([
      ['credit_entry', 340, 'Ramesh', undefined],
      ['payment', 200, 'Ramesh', 'yesterday'],
    ]);
  });
  it('two customers', () => {
    const evs = run('Ramesh ka teen sau chalis udhaar aur Sunita ne dedh sau diye');
    expect(evs.map((e) => [e.intent, rupees(e), e.customerSpoken])).toEqual([
      ['credit_entry', 340, 'Ramesh'],
      ['payment', 150, 'Sunita'],
    ]);
  });
});

describe('self-correction and corrections', () => {
  it('"340, nahi nahi 430" is one entry of 430', () => {
    const evs = run('Ramesh ka 340, nahi nahi 430 udhaar');
    expect(evs).toHaveLength(1);
    expect([evs[0]!.intent, rupees(evs[0]!), evs[0]!.selfCorrected]).toEqual(['credit_entry', 430, true]);
  });
  it('"Nahi, 430" alone replaces the last amount', () => {
    const e = first('Nahi, 430');
    expect([e.intent, e.correction?.kind, rupees(e)]).toEqual(['correction', 'amount', 430]);
  });
  it('"Nahi, Suresh ka tha" moves the last entry', () => {
    const e = first('Nahi, Suresh ka tha');
    expect([e.intent, e.correction?.kind, e.customerSpoken]).toEqual(['correction', 'customer', 'Suresh']);
  });
  it.each(['Galat', 'cancel', 'Cancel that', 'hata do', 'गलत', 'रद्द करो'])('%s undoes', (t) => {
    const e = first(t);
    expect([e.intent, e.correction?.kind]).toEqual(['correction', 'undo']);
  });
});

describe('tense, notes and dates', () => {
  it('a future promise is a note, never a payment', () => {
    const e = first('Ramesh kal 500 dega');
    expect([e.intent, rupees(e), e.dateToken, e.tense]).toEqual(['note', 500, 'tomorrow', 'future']);
  });
  it('"kal" is yesterday with the past tense', () => {
    const e = first('Ramesh ne kal 200 diye');
    expect([e.intent, e.dateToken]).toEqual(['payment', 'yesterday']);
  });
  it('English future', () => {
    expect(first('Ramesh will pay five hundred tomorrow').intent).toBe('note');
  });
  it('a weekday resolves', () => {
    const e = first('Sunita ne Monday 200 jama kiye');
    expect(e.dateToken).toBe('weekday:monday');
  });
});

describe('queries', () => {
  it.each(['Aaj kitna udhaar gaya?', 'Ramesh ka total?', 'Sunita ka baaki kitna hai', 'How much does Ramesh owe', 'रमेश का कितना बाकी है'])('%s', (t) => {
    expect(first(t).intent).toBe('balance_query');
  });
});

describe('refusals come first', () => {
  it.each([
    ['Ramesh ko dhamki do', 'threat'], ['Ramesh ko dhamki do ki police bulayenge', 'threat'], ['रमेश को धमकी दो', 'threat'],
    ['Byaj laga do', 'interest'], ['Mohan pe byaj lagao 200 ka', 'interest'], ['add interest on Ramesh', 'interest'],
    ['mujhe 500 udhaar de do', 'lending'], ['loan de do', 'lending'], ['Kya Mohan ko udhaar dena chahiye?', 'judgment'], ['Is Kavya a good customer?', 'judgment'],
    ['Is it safe to give Ramesh credit', 'judgment'],
  ])('%s -> %s', (t, kind) => {
    const e = first(t);
    expect([e.intent, e.refusal]).toEqual(['refusal', kind]);
    expect(e.amountPaise).toBeUndefined(); // a refused request never carries an amount to post
  });
  it('a refusal never becomes an entry even with an amount in it', () => {
    expect(first('Ramesh ko dhamki do, uska 340 udhaar baaki hai').intent).toBe('refusal');
  });
  it('plain entries are not refused', () => {
    for (const t of ['accha, Ramesh ka 340 udhaar', 'Ramesh ka 340 udhaar bharosa ke saath diya', 'Sunita ka baaki kitna hai']) {
      expect(first(t).intent).not.toBe('refusal');
    }
  });
});

describe('reminders and out of scope', () => {
  it('reminder request', () => {
    expect(first('Sunita ko reminder bhejo').intent).toBe('reminder_opt_in');
  });
  it.each(['What is the weather today?', 'Tell me a joke', 'मौसम कैसा है आज?', 'Aaj mausam kaisa hai?'])('%s', (t) => {
    const r = interpret(t, { nowMs: NOW });
    expect(r.events[0]!.intent).toBe('out_of_scope');
    expect(r.needsLlm).toBe(true);
  });
});

describe('known customers', () => {
  const customers = [{ id: '1', name: 'Ramesh', aliases: ['doodh wale'] }, { id: '2', name: 'Ramesh', aliases: ['auto wale'] }, { id: '3', name: 'Sunita', aliases: [] }];
  it('finds a name written in another script', () => {
    const r = interpret('सुनीता ने दो सौ दिए', { nowMs: NOW, customers });
    expect(r.events[0]!.customerSpoken).toBe('सुनीता');
  });
  it('an alias alone identifies someone', () => {
    const r = interpret('doodh wale ka 200 udhaar', { nowMs: NOW, customers });
    expect(r.events[0]!.customerSpoken).toBeDefined();
  });
});
