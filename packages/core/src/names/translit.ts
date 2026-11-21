/**
 * Cross-script name normalization for Indic scripts.
 *
 * A shopkeeper says "Ramesh" in Hindi ("रमेश"), Kannada ("ರಮೇಶ್"), Tamil ("ரமேஷ்"),
 * Telugu ("రమేష్"), or Gujarati ("રમેશ") and expects the same khata to open.
 *
 * Rule: pure functions only. No network, no DOM, deterministic.
 */

const DEV_C: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'ch', ज: 'j', झ: 'jh', ञ: 'n', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'f', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh',
  स: 's', ह: 'h', ड़: 'r', ढ़: 'rh', क़: 'k', ख़: 'kh', ग़: 'g', ज़: 'j', फ़: 'f',
};
const DEV_V: Record<string, string> = { अ: 'a', आ: 'a', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au' };
const DEV_M: Record<string, string> = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au' };

const KN_C: Record<string, string> = {
  ಕ: 'k', ಖ: 'kh', ಗ: 'g', ಘ: 'gh', ಙ: 'n', ಚ: 'ch', ಛ: 'ch', ಜ: 'j', ಝ: 'jh', ಞ: 'n', ಟ: 't', ಠ: 'th', ಡ: 'd', ಢ: 'dh', ಣ: 'n',
  ತ: 't', ಥ: 'th', ದ: 'd', ಧ: 'dh', ನ: 'n', ಪ: 'p', ಫ: 'f', ಬ: 'b', ಭ: 'bh', ಮ: 'm', ಯ: 'y', ರ: 'r', ಲ: 'l', ವ: 'v', ಶ: 'sh', ಷ: 'sh',
  ಸ: 's', ಹ: 'h', ಳ: 'l',
};
const KN_V: Record<string, string> = { ಅ: 'a', ಆ: 'a', ಇ: 'i', ಈ: 'i', ಉ: 'u', ಊ: 'u', ಋ: 'ri', ಎ: 'e', ಏ: 'e', ಐ: 'ai', ಒ: 'o', ಓ: 'o', ಔ: 'au' };
const KN_M: Record<string, string> = { 'ಾ': 'a', 'ಿ': 'i', 'ೀ': 'i', 'ು': 'u', 'ೂ': 'u', 'ೃ': 'ri', 'ೆ': 'e', 'ೇ': 'e', 'ೈ': 'ai', 'ೊ': 'o', 'ೋ': 'o', 'ೌ': 'au' };

const TE_C: Record<string, string> = {
  క: 'k', ఖ: 'kh', గ: 'g', ఘ: 'gh', ఙ: 'n', చ: 'ch', ఛ: 'ch', జ: 'j', ఝ: 'jh', ఞ: 'n', ట: 't', ఠ: 'th', డ: 'd', ఢ: 'dh', ణ: 'n',
  త: 't', థ: 'th', ద: 'd', ధ: 'dh', న: 'n', ప: 'p', ఫ: 'f', బ: 'b', భ: 'bh', మ: 'm', య: 'y', ర: 'r', ల: 'l', వ: 'v', శ: 'sh', ష: 'sh',
  స: 's', హ: 'h', ళ: 'l',
};
const TE_V: Record<string, string> = { అ: 'a', ఆ: 'a', ఇ: 'i', ఈ: 'i', ఉ: 'u', ఊ: 'u', ఋ: 'ri', ఎ: 'e', ఏ: 'e', ఐ: 'ai', ఒ: 'o', ఓ: 'o', ఔ: 'au' };
const TE_M: Record<string, string> = { 'ా': 'a', 'ి': 'i', 'ీ': 'i', 'ు': 'u', 'ూ': 'u', 'ృ': 'ri', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au' };

const GU_C: Record<string, string> = {
  ક: 'k', ખ: 'kh', ગ: 'g', ઘ: 'gh', ઙ: 'n', ચ: 'ch', છ: 'ch', જ: 'j', ઝ: 'jh', ઞ: 'n', ટ: 't', ઠ: 'th', ડ: 'd', ઢ: 'dh', ણ: 'n',
  ત: 't', થ: 'th', દ: 'd', ધ: 'dh', ન: 'n', પ: 'p', ફ: 'f', બ: 'b', ભ: 'bh', મ: 'm', ય: 'y', ર: 'r', લ: 'l', વ: 'v', શ: 'sh', ષ: 'sh',
  સ: 's', હ: 'h', ળ: 'l',
};
const GU_V: Record<string, string> = { અ: 'a', આ: 'a', ઇ: 'i', ઈ: 'i', ઉ: 'u', ઊ: 'u', ઋ: 'ri', એ: 'e', ઐ: 'ai', ઓ: 'o', ઔ: 'au' };
const GU_M: Record<string, string> = { 'ા': 'a', 'િ': 'i', 'ી': 'i', 'ુ': 'u', 'ૂ': 'u', 'ૃ': 'ri', 'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au' };

const TA_C: Record<string, string> = {
  க: 'k', ங: 'n', ச: 's', ஞ: 'n', ட: 't', ண: 'n', த: 't', ந: 'n', ப: 'p', ம: 'm', ய: 'y', ர: 'r', ல: 'l', வ: 'v', ழ: 'l', ள: 'l', ற: 'r', ன: 'n',
  ஜ: 'j', ஷ: 'sh', ஸ: 's', ஹ: 'h',
};
const TA_V: Record<string, string> = { அ: 'a', ஆ: 'a', இ: 'i', ஈ: 'i', உ: 'u', ஊ: 'u', எ: 'e', ஏ: 'e', ஐ: 'ai', ஒ: 'o', ஓ: 'o', ஔ: 'au' };
const TA_M: Record<string, string> = { 'ா': 'a', 'ி': 'i', 'ீ': 'i', 'ு': 'u', 'ூ': 'u', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au' };

const VIRAMA = new Set(['्', '್', '్', '્', '்']);

function indic(word: string, C: Record<string, string>, V: Record<string, string>, M: Record<string, string>): string {
  const cs = [...word.normalize('NFC')];
  let out = '';
  for (let i = 0; i < cs.length; i++) {
    const ch = cs[i]!;
    const next = cs[i + 1];
    if (C[ch] !== undefined) {
      out += C[ch];
      const nextIsMatra = next !== undefined && (M[next] !== undefined || VIRAMA.has(next));
      // Inherent "a", dropped at the end of a word and before a matra or virama.
      if (!nextIsMatra && next !== undefined && (C[next] !== undefined || V[next] !== undefined || next === 'ं' || next === 'ಂ' || next === 'ः')) out += 'a';
    } else if (V[ch] !== undefined) out += V[ch];
    else if (M[ch] !== undefined) out += M[ch];
    else if (ch === 'ं' || ch === 'ँ' || ch === 'ಂ') out += 'n';
    else if (ch === 'ः' || ch === 'ಃ') out += 'h';
    else if (VIRAMA.has(ch) || ch === '़') continue;
    else if (/[\p{L}\p{N}]/u.test(ch)) out += ch.toLowerCase();
  }
  return out;
}

export function toLatin(word: string): string {
  return [...word]
    .map((c) => c)
    .join('')
    .split(/(\s+)/)
    .map((part) => {
      if (/[ऀ-ॿ]/.test(part)) return indic(part, DEV_C, DEV_V, DEV_M);
      if (/[ಀ-೿]/.test(part)) return indic(part, KN_C, KN_V, KN_M);
      if (/[஀-௿]/.test(part)) return indic(part, TA_C, TA_V, TA_M);
      if (/[ఀ-౿]/.test(part)) return indic(part, TE_C, TE_V, TE_M);
      if (/[઀-૿]/.test(part)) return indic(part, GU_C, GU_V, GU_M);
      return part.toLowerCase();
    })
    .join('');
}

/** A spelling-tolerant key. Equal keys mean "the same name" for a shopkeeper. */
export function nameKey(name: string): string {
  let s = toLatin(name).normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[^a-z]/g, '');
  s = s.replace(/w/g, 'v').replace(/z/g, 'j').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks');
  s = s.replace(/th/g, 't').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a').replace(/(.)\1+/g, '$1');
  return s;
}

/** Looser key: the one used to decide "near" matches. */
export function looseKey(name: string): string {
  return nameKey(name)
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/jh/g, 'j')
    .replace(/[ei]/g, 'i')
    .replace(/[ou]/g, 'u')
    .replace(/(.)\1+/g, '$1');
}

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length]![b.length]!;
}
