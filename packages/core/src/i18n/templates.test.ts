import { describe, expect, it } from 'vitest';

import { KEYS, TEMPLATES } from './templates.js';

// Pressure, threat and shaming words that must never appear in anything the agent says or a customer receives.
const BANNED: Record<string, string[]> = {
  en: ['police', 'court', 'legal', 'lawyer', 'immediately', 'right now', 'or else', 'warning', 'last chance', 'shame', 'defaulter', 'cheat', 'fraud', 'pay now', 'must pay', 'penalty', 'interest rate', 'overdue', 'consequence', 'expose'],
  hi: ['पुलिस', 'कोर्ट', 'कानूनी', 'वकील', 'तुरंत', 'अभी के अभी', 'वरना', 'चेतावनी', 'आख़िरी मौक़ा', 'आखिरी मौका', 'शर्म', 'डिफॉल्टर', 'धोखा', 'धोखेबाज़', 'जुर्माना', 'बदनाम', 'ज़रूर चुकाओ', 'अभी चुकाओ'],
  kn: ['ಪೊಲೀಸ್', 'ಕೋರ್ಟ್', 'ಕಾನೂನು', 'ವಕೀಲ', 'ತಕ್ಷಣ', 'ಇಲ್ಲದಿದ್ದರೆ', 'ಎಚ್ಚರಿಕೆ', 'ಕೊನೆಯ ಅವಕಾಶ', 'ನಾಚಿಕೆ', 'ವಂಚನೆ', 'ದಂಡ', 'ಅವಮಾನ'],
};
const SAMPLE = { name: 'Sunita', amount: '₹500', balance: '₹500', advance: '₹100', when: 'today', options: 'a or b', credit: '₹1,240', count: '5' };

describe('no pressure or threat language in any template', () => {
  for (const lang of ['en', 'hi', 'kn'] as const) {
    it(`${lang}: every line is free of banned words`, () => {
      for (const k of KEYS) {
        const text = TEMPLATES[lang][k](SAMPLE).toLowerCase();
        for (const w of BANNED[lang]!) expect(text, `${lang}/${k} contains "${w}"`).not.toContain(w.toLowerCase());
      }
    });
  }
  it('every template fills its placeholders (no undefined or braces left)', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      for (const k of KEYS) {
        const text = TEMPLATES[lang][k](SAMPLE);
        expect(text, `${lang}/${k}`).not.toMatch(/undefined|\$\{|\{[a-z]+\}/);
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });
  it('the customer-facing reminder is polite in every language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const t = TEMPLATES[lang].reminder_text(SAMPLE);
      expect(t).toContain('₹500');
      expect(t).toContain('Sunita');
      expect(t).not.toMatch(/!/);
    }
  });
});
