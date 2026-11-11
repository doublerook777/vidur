import { norm } from '../numbers/lexicon.js';
import type { RefusalKind } from './types.js';

const words = (s: string): string[] => s.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean).map(norm);
const set = (xs: string[]): Set<string> => new Set(xs.map(norm));

const THREAT = set([
  'dhamki', 'dhamkao', 'dhamkana', 'dhamka', 'darao', 'darana', 'dara', 'threat', 'threaten', 'threatening', 'badnam', 'bejjati', 'beizzati', 'shame', 'humiliate', 'harass', 'blackmail', 'gali', 'goonde', 'goondon',
  'धमकी', 'धमकाओ', 'धमकाना', 'डराओ', 'डराना', 'बदनाम', 'बेइज़्ज़ती', 'बेइज्जती', 'बेज्जती', 'गाली', 'गुंडे',
  'ಬೆದರಿಕೆ', 'ಬೆದರಿಸು', 'ಬೆದರಿಸಿ', 'ಅವಮಾನ', 'ಬೈಯಿರಿ',
]);
const INTEREST = set(['byaj', 'byaaj', 'vyaj', 'interest', 'sood', 'penalty', 'jurmana', 'latefee', 'surcharge', 'ब्याज', 'सूद', 'जुर्माना', 'ಬಡ್ಡಿ', 'ದಂಡ']);
const LENDING = set(['loan', 'karz', 'karja', 'lend', 'lending', 'borrow', 'कर्ज', 'कर्ज़', 'लोन', 'ಸಾಲ', 'ಲೋನ್']);
const JUDGMENT = set([
  'bharosa', 'bharose', 'trust', 'trustworthy', 'safe', 'risky', 'defaulter', 'creditworthy', 'reliable', 'dhokha', 'fraud',
  'भरोसा', 'भरोसे', 'सुरक्षित', 'डिफॉल्टर', 'धोखा', 'ನಂಬಿಕೆ', 'ನಂಬಬಹುದೇ', 'ಅಪಾಯ',
]);
const JUDGMENT_PHRASE =
  /\b(dena|dene|dun|de sakte|de sakta|lend|give)\b.*\b(chahiye|chahie|theek|sahi|should)\b|\b(chahiye|should)\b.*\b(dena|dene|give|lend)\b|\bshould i (give|lend|trust)\b|\bcredit score\b|देना चाहिए|देना ठीक|देना सही|ಕೊಡಬೇಕೇ|ಕೊಡಬಹುದೇ|\b(good|bad|reliable|trustworthy|decent) (customer|payer)\b|\b(achha|accha|bura|buri) (grahak|customer)\b|अच्छा (ग्राहक|कस्टमर)|बुरा (ग्राहक|कस्टमर)|ಒಳ್ಳೆಯ (ಕಸ್ಟಮರ್|ಗ್ರಾಹಕ)|ಕೆಟ್ಟ (ಕಸ್ಟಮರ್|ಗ್ರಾಹಕ)/;

/**
 * Checks a transcript for requests the product must refuse: threats and shaming, interest or penalties,
 * lending, and judgments about whether a customer deserves credit. Runs before anything else in `interpret`.
 */
export function detectRefusal(text: string): RefusalKind | null {
  const ws = words(text);
  const has = (s: Set<string>): boolean => ws.some((w) => s.has(w));
  const joined = ws.join(' ');
  if (has(THREAT) || /police (bulao|bulayenge|bulana)|पुलिस/.test(joined) || /public(ly)? (me|mein|ko)/.test(joined) || /sabke samne|सबके सामने/.test(joined)) return 'threat';
  if (has(INTEREST)) return 'interest';
  if (has(LENDING)) return 'lending';
  // Asking the assistant to lend: "mujhe udhaar de do", "give me credit".
  if (/\b(mujhe|mujhko|muje|mere liye)\b.*\b(udhar|udhari|credit|paise|paisa)\b.*\b(de|do|dedo|dijiye)\b/.test(joined) || /मुझे .*उधार .*दे/.test(text) || /\bgive me (some )?(credit|money|loan)\b/.test(joined)) return 'lending';
  // Trust words alone are not enough ('bharosa ke saath diya'); they count when the speaker is asking.
  const asking = /\?|\bkya\b|क्या|\b(should|can|is|are|would|does)\b|ಬಹುದೇ|ಕೇ/.test(joined + ' ' + text);
  if ((has(JUDGMENT) && asking) || JUDGMENT_PHRASE.test(joined) || JUDGMENT_PHRASE.test(text)) return 'judgment';
  return null;
}
