import type { Lang } from '../contract.js';

/** What to tell the shopkeeper when something goes wrong, and what to do next. Never a raw error code. */
type Msg = { text: string; action?: string };
const M: Record<string, Record<Lang, Msg>> = {
  network: {
    en: { text: 'No connection. You can still add entries with the keypad.', action: 'Try again' },
    hi: { text: 'इंटरनेट नहीं है। आप कीपैड से एंट्री लिख सकते हैं।', action: 'फिर कोशिश करें' },
    kn: { text: 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲ. ಕೀಪ್ಯಾಡ್‌ನಿಂದ ದಾಖಲೆ ಬರೆಯಬಹುದು.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  },
  mic_denied: {
    en: { text: 'The microphone is off. Allow it in the browser settings, or use the keypad.', action: 'Try again' },
    hi: { text: 'माइक बंद है। ब्राउज़र की सेटिंग में चालू करें, या कीपैड इस्तेमाल करें।', action: 'फिर कोशिश करें' },
    kn: { text: 'ಮೈಕ್ ಆಫ್ ಆಗಿದೆ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ನಲ್ಲಿ ಆನ್ ಮಾಡಿ, ಅಥವಾ ಕೀಪ್ಯಾಡ್ ಬಳಸಿ.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  },
  credit_exhausted: {
    en: { text: 'The voice service has no credit left. Use the keypad, or run Vidur with your own key.' },
    hi: { text: 'वॉइस सेवा का क्रेडिट ख़त्म हो गया है। कीपैड इस्तेमाल करें, या अपनी चाबी से चलाएँ।' },
    kn: { text: 'ವಾಯ್ಸ್ ಸೇವೆಯ ಕ್ರೆಡಿಟ್ ಮುಗಿದಿದೆ. ಕೀಪ್ಯಾಡ್ ಬಳಸಿ, ಅಥವಾ ನಿಮ್ಮ ಸ್ವಂತ ಕೀ ಬಳಸಿ.' },
  },
  service_misconfigured: {
    en: { text: 'The voice service is not set up. Use the keypad for now.' },
    hi: { text: 'वॉइस सेवा चालू नहीं है। अभी कीपैड इस्तेमाल करें।' },
    kn: { text: 'ವಾಯ್ಸ್ ಸೇವೆ ಸಿದ್ಧವಿಲ್ಲ. ಈಗ ಕೀಪ್ಯಾಡ್ ಬಳಸಿ.' },
  },
  bad_access_code: {
    en: { text: 'The access code is wrong. Check it and try again.', action: 'Try again' },
    hi: { text: 'एक्सेस कोड ग़लत है। जाँचकर फिर कोशिश करें।', action: 'फिर कोशिश करें' },
    kn: { text: 'ಪ್ರವೇಶ ಕೋಡ್ ತಪ್ಪಾಗಿದೆ. ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  },
  busy: {
    en: { text: 'The service is busy. Wait a moment and try again.', action: 'Try again' },
    hi: { text: 'सेवा व्यस्त है। थोड़ा रुककर फिर कोशिश करें।', action: 'फिर कोशिश करें' },
    kn: { text: 'ಸೇವೆ ಬ್ಯುಸಿ ಇದೆ. ಸ್ವಲ್ಪ ಕಾದು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', action: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' },
  },
  stopped: {
    en: { text: 'The demo is paused for now. Use the keypad, or try again later.' },
    hi: { text: 'डेमो अभी रुका हुआ है। कीपैड इस्तेमाल करें, या बाद में कोशिश करें।' },
    kn: { text: 'ಡೆಮೊ ಈಗ ನಿಲ್ಲಿಸಲಾಗಿದೆ. ಕೀಪ್ಯಾಡ್ ಬಳಸಿ, ಅಥವಾ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.' },
  },
  didnt_hear: {
    en: { text: 'I did not hear anything. Hold the button and speak.' },
    hi: { text: 'कुछ सुनाई नहीं दिया। बटन दबाकर बोलिए।' },
    kn: { text: 'ಏನೂ ಕೇಳಿಸಲಿಲ್ಲ. ಬಟನ್ ಒತ್ತಿ ಹಿಡಿದು ಮಾತನಾಡಿ.' },
  },
};
const ALIAS: Record<string, string> = {
  speech_error: 'network', stt_timeout: 'network', killed: 'stopped', daily_cap: 'stopped', session_cap: 'stopped', ip_rate_limit: 'busy', bad_origin: 'service_misconfigured',
};

export function errorMessage(code: string, lang: Lang): { text: string; actionLabel?: string } {
  const m = (M[ALIAS[code] ?? code] ?? M['network']!)[lang];
  return { text: m.text, ...(m.action ? { actionLabel: m.action } : {}) };
}
export const ERROR_CODES = Object.keys(M);
