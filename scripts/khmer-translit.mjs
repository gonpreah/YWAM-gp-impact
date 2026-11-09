/* Khmer → "sounds like" in Latin letters, for Learn Khmer (Andrew, Oct 2026: "for those who don't
   know how to read, transliterate the word in English"). Rule-based and approximate — a reading aid,
   not a standard: each consonant has a sound and a series (first: a-coloured, second: o-coloured), a
   vowel sign sounds one way after each series, a consonant at the end of a syllable loses its breath
   (ស → h, រ → silent, ប → p …), ្ joins consonants into a cluster. Run to fill in the `tl` of every
   word in public/khmer-vocab.js:

     node scripts/khmer-translit.mjs            (rewrites public/khmer-vocab.js with a tl per word, and
                                                 the readings of public/khmer-grammar.js's sentences)
     node scripts/khmer-translit.mjs --show     (prints a sample instead)

   Exports translit(text) for tests. A word whose generated reading is wrong can be given a hand one
   in OVERRIDES below, by its Khmer spelling. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

/* consonants: [sound as onset, series (1 a / 2 o), sound as final] */
const C = {
  'ក': ['k', 1, 'k'], 'ខ': ['kh', 1, 'k'], 'គ': ['k', 2, 'k'], 'ឃ': ['kh', 2, 'k'], 'ង': ['ng', 2, 'ng'],
  'ច': ['ch', 1, 'ch'], 'ឆ': ['chh', 1, 'ch'], 'ជ': ['ch', 2, 'ch'], 'ឈ': ['chh', 2, 'ch'], 'ញ': ['nh', 2, 'nh'],
  'ដ': ['d', 1, 't'], 'ឋ': ['th', 1, 't'], 'ឌ': ['d', 2, 't'], 'ឍ': ['th', 2, 't'], 'ណ': ['n', 1, 'n'],
  'ត': ['t', 1, 't'], 'ថ': ['th', 1, 't'], 'ទ': ['t', 2, 't'], 'ធ': ['th', 2, 't'], 'ន': ['n', 2, 'n'],
  'ប': ['b', 1, 'p'], 'ផ': ['ph', 1, 'p'], 'ព': ['p', 2, 'p'], 'ភ': ['ph', 2, 'p'], 'ម': ['m', 2, 'm'],
  'យ': ['y', 2, 'y'], 'រ': ['r', 2, ''], 'ល': ['l', 2, 'l'], 'វ': ['v', 2, 'v'],
  'ស': ['s', 1, 'h'], 'ហ': ['h', 1, 'h'], 'ឡ': ['l', 1, 'l'], 'អ': ['', 1, '']
};
const SONORANT = 'ងញនមយរលវ';
/* vowel signs: [after a first-series consonant, after a second-series one] */
const V = {
  'ា': ['a', 'ie'], 'ិ': ['e', 'i'], 'ី': ['ey', 'i'], 'ឹ': ['oe', 'ue'], 'ឺ': ['oe', 'ue'], 'ុ': ['o', 'u'], 'ូ': ['ou', 'u'],
  'ួ': ['uo', 'uo'], 'ើ': ['aeu', 'eu'], 'ឿ': ['eua', 'eua'], 'ៀ': ['ie', 'ie'], 'េ': ['ei', 'e'], 'ែ': ['ae', 'ae'], 'ៃ': ['ai', 'ey'],
  'ោ': ['ao', 'ou'], 'ៅ': ['au', 'ov'], 'ំ': ['am', 'um'], 'ះ': ['ah', 'eah'], '័': ['a', 'oa'], 'ៈ': ['ak', 'eak']
};
const V2 = { 'ុំ': ['om', 'um'], 'ាំ': ['am', 'oam'], 'ិះ': ['eh', 'ih'], 'ុះ': ['oh', 'uh'], 'េះ': ['eh', 'ih'], 'ោះ': ['aoh', 'uoh'] };
const INDEP = { 'ឥ': 'e', 'ឦ': 'ei', 'ឧ': 'o', 'ឩ': 'ou', 'ឪ': 'au', 'ឫ': 'roe', 'ឬ': 'rue', 'ឭ': 'loe', 'ឮ': 'lue', 'ឯ': 'ae', 'ឰ': 'ai', 'ឱ': 'ao', 'ឲ': 'ao', 'ឳ': 'au' };
const DIGITS = { '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4', '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9' };
const COENG = '្', TREISAP = '៊', MUSIKATOAN = '៉', BANTOC = '់', TOANDAKHIAT = '៍', ROBAT = '៌', LEK_TOO = 'ៗ';
/* hand readings where the rules fall short (by the Khmer spelling) */
export const OVERRIDES = {
  /* the Grammar lessons' words (Oct 2026) */
  'ឲ្យ': 'aoy', 'ស្អែក': 'sa-aek', 'ធ្លាប់': 'thloap', 'អត់': 'ot', 'ត្រូវ': 'trov', 'អង្គរវត្ត': 'angkor voat', 'សប្តាហ៍': 'sap-da',
  'បាល់ទាត់': 'bal-toat', 'នឹង': 'noeng',
  /* the Faith lists (Oct 2026): church life, God & the Bible, the books of the Bible */
  'ទីបន្ទាល់': 'ti-bon-toal', 'សេចក្ដីអធិប្បាយ': 'seich-kdey-a-thip-bay', 'ការប្រកបគ្នា': 'ka-pra-kop-knea', 'បេសកកម្ម': 'be-sak-kam',
  'អធិស្ឋានឲ្យ': 'athisthan-aoy', 'ប្រគល់ជីវិតឲ្យព្រះយេស៊ូវ': 'pra-kol-chi-vit-aoy-preah yesu', 'ស្ដាប់បង្គាប់': 'sdap-bang-koap',
  'បុណ្យទី៥០': 'bon-ti-ha-sep', 'ក្រុមយុវជន': 'krom-yu-veak-chon', 'ព្រះជាម្ចាស់': 'preah-chie-mchah', 'ព្រះគ្រីស្ទ': 'preah-krist',
  'ស្ដេចលើអស់ទាំងស្ដេច': 'sdach-leu-ah-teang-sdach', 'ព្រះអាទិករ': 'preah-a-ti-ko', 'ការបង្កើតពិភពលោក': 'ka-bang-kaeut-pi-phop-louk',
  'នគរព្រះ': 'no-ko-preah', 'សេចក្ដីសញ្ញា': 'seich-kdey-sanh-nya', 'អារក្ស': 'a-rak', 'ការជំនុំជម្រះ': 'ka-chum-num-chum-reah',
  'សេចក្ដីសង្ឃឹម': 'seich-kdey-sang-khoem', 'ភាពស្មោះត្រង់': 'phiep-smaoh-trang', 'និយាយភាសាដទៃ': 'niyeay-phie-sa-da-tey',
  'អាសនៈ': 'a-sa-nak', 'បញ្ញត្តិ': 'banh-nhat', 'ក្រឹត្យវិន័យ': 'kret-vi-ney', 'លោកុប្បត្តិ': 'lou-kop-bat', 'និក្ខមនំ': 'nik-kha-ma-nom',
  'ចោទិយកថា': 'chao-ti-yak-ka-tha', 'ពង្សាវតារក្សត្រ': 'pong-sa-va-da-ksat', 'របាក្សត្រ': 'ro-bak-sat', 'អែសរ៉ា': 'ae-sa-ra',
  'វិវរណៈ': 'vi-vo-ra-nak', 'កិច្ចការ': 'kech-cha-ka',
  'ខ្ញុំ': 'khnhom', 'ទេ': 'te', 'បាទ': 'bat', 'ចាស': 'chah', 'អរគុណ': 'orkun', 'សួស្តី': 'suostei', 'ព្រះ': 'preah', 'ព្រះយេស៊ូវ': 'preah yesu',
  'ព្រះអង្គ': 'preah ang', 'ព្រះគម្ពីរ': 'preah kompi', 'ព្រះវិហារ': 'preah vihie', 'ក្រុមជំនុំ': 'krom chumnum', 'អធិស្ឋាន': 'athisthan',
  'ថ្វាយបង្គំ': 'thvay bangkum', 'ម្ហូប': 'mhoup', 'ផ្ទះ': 'phteah', 'ទឹក': 'tuk', 'បាយ': 'bai', 'ញ៉ាំ': 'nham', 'ហូប': 'houp', 'ស្អាត': 'sa-at',
  'ល្អ': 'la-or', 'ថ្ងៃ': 'thngai', 'ថ្ងៃនេះ': 'thngai nih', 'ថ្ងៃស្អែក': 'thngai sa-aek', 'ម្សិលមិញ': 'msel menh', 'ឥឡូវនេះ': 'eylov nih',
  'ម៉ោង': 'maong', 'ម្តាយ': 'mdai', 'ឪពុក': 'ovpuk', 'មិត្តភក្តិ': 'mit pheak', 'ប្តី': 'pdey', 'ប្រពន្ធ': 'prapun', 'ស្រឡាញ់': 'srolanh',
  'ចូលចិត្ត': 'choul chet', 'ធ្វើ': 'thveu', 'ទៅ': 'tov', 'មក': 'mok', 'ចង់': 'chang', 'ដឹង': 'deng', 'ចេះ': 'cheh', 'ស្គាល់': 'skoal',
  'ជួយ': 'chuoy', 'ប្រើ': 'praeu', 'គេង': 'keng', 'ឃើញ': 'kheunh', 'មើល': 'meul', 'ស្តាប់': 'sdap', 'និយាយ': 'niyeay', 'អាន': 'an',
  'ដើរ': 'daeu', 'រត់': 'rot', 'អង្គុយ': 'angkuy', 'ឈរ': 'chho', 'ភ្លេច': 'phlech', 'សាលារៀន': 'sala rien', 'សិស្ស': 'seh', 'គ្រូ': 'krou',
  'ផ្សារ': 'phsa', 'ទិញ': 'tinh', 'លក់': 'luk', 'ថ្លៃ': 'thlai', 'ថោក': 'thaok', 'ស្វាយ': 'svay', 'ចេក': 'chek', 'ដូង': 'doung',
  'ត្រី': 'trey', 'សាច់': 'sach', 'មាន់': 'moan', 'ជ្រូក': 'chrouk', 'គោ': 'ko', 'ឆ្កែ': 'chkae', 'ឆ្មា': 'chhma', 'ដំរី': 'damrey',
  'ភ្នំ': 'phnum', 'ទន្លេ': 'tonle', 'សមុទ្រ': 'samot', 'ព្រៃ': 'prey', 'ភ្លៀង': 'phlieng', 'ក្តៅ': 'kdav', 'ត្រជាក់': 'trocheak',
  'ម៉ូតូ': 'moto', 'ឡាន': 'lan', 'កង់': 'kang', 'ផ្លូវ': 'phlov', 'ទីក្រុង': 'ti krong', 'មន្ទីរពេទ្យ': 'muntipet', 'គ្រូពេទ្យ': 'kru pet',
  'ឈឺ': 'chheu', 'ក្បាល': 'kbal', 'ភ្នែក': 'phnek', 'ដៃ': 'dai', 'ជើង': 'cheung', 'ឈាម': 'chhiem', 'សុខភាព': 'sokhapheap',
  'កាហ្វេ': 'kafe', 'ហាងបាយ': 'hang bai', 'លុយ': 'luy', 'សូម': 'soum', 'សុំទោស': 'som toh', 'ឃ្លាន': 'khlien', 'ឆ្អែត': 'chh-aet',
  'ហឹរ': 'hel', 'ផ្អែម': 'ph-aem', 'ជូរ': 'chu', 'ប្រៃ': 'prai', 'នំប៉័ង': 'num pang', 'ស្រា': 'sra', 'សម្ល': 'samlo',
  'បុគ្គលិក': 'bokkolik', 'ប្រជុំ': 'prochum', 'ថ្នាក់រៀន': 'thnak rien', 'ព័ន្ធកិច្ច': 'poan kech', 'អ្នកដឹកនាំ': 'neak doek noam',
  'ព្រះវិញ្ញាណបរិសុទ្ធ': 'preah vinhnhean borisot', 'សេចក្តីជំនឿ': 'sechkdei chumnuea', 'ជឿ': 'chuea', 'សង្គម': 'sangkum', 'ការងារ': 'ka ngie',
  'មួយ': 'muoy', 'ពីរ': 'pi', 'បី': 'bei', 'បួន': 'buon', 'ប្រាំ': 'pram', 'ប្រាំមួយ': 'pram muoy', 'ប្រាំពីរ': 'pram pi', 'ប្រាំបី': 'pram bei',
  'ប្រាំបួន': 'pram buon', 'ដប់': 'dap', 'ម្ភៃ': 'mphey', 'សាមសិប': 'sam seb', 'សែសិប': 'sae seb', 'ហាសិប': 'ha seb', 'ហុកសិប': 'hok seb',
  'ចិតសិប': 'chet seb', 'ប៉ែតសិប': 'paet seb', 'កៅសិប': 'kav seb', 'មួយរយ': 'muoy roy', 'មួយពាន់': 'muoy poan', 'មួយម៉ឺន': 'muoy meun',
  'មួយសែន': 'muoy saen', 'មួយលាន': 'muoy lean', 'សូន្យ': 'soun', 'អ្នក': 'neak', 'វា': 'vie', 'ពួកគេ': 'puok ke', 'គាត់': 'koat', 'នាង': 'neang',
  'ពួកយើង': 'puok yeung', 'ទាំងអស់គ្នា': 'teang os knie', 'ខ្លួនឯង': 'khluon aeng', 'របស់ខ្ញុំ': 'robos khnhom', 'របស់អ្នក': 'robos neak',
  'ពណ៌ស': 'poa sor', 'ពណ៌ខ្មៅ': 'poa khmav', 'ពណ៌បៃតង': 'poa baitang', 'ពណ៌ត្នោត': 'poa tnaot', 'ពណ៌ក្រហម': 'poa krohom', 'ពណ៌ខៀវ': 'poa khiev',
  'អ្វី': 'avei', 'អារម្មណ៍': 'arom', 'សញ្ញាប័ត្រ': 'sanhnhabat', 'ប្រជុំ': 'pro-chum', 'ហេតុអ្វី': 'haet avei', 'អ្នកណា': 'neak na', 'មនុស្ស': 'monuh', 'កិច្ច': 'kech', 'សប្បាយ': 'sabbay', 'អរុណសួស្តី': 'arun suostei',
  'ពណ៌លឿង': 'poa lueng', 'ប៉ុន្មាន': 'ponman', 'ក្បែរ': 'kbae', 'ធ្នូ': 'thnu', 'ខ្នុរ': 'khno', 'ស្នាក់': 'snak', 'វាំងនន': 'veang non', 'ដូច្នេះ': 'doch-neh', 'ក៏': 'kor', 'ទ្វារ': 'tvie', 'ស្វា': 'sva', 'ម្ទេស': 'mteh', 'ថ្ងៃណា': 'thngai na', 'ពណ៌ប្រផេះ': 'poa propheh', 'ពណ៌ស្វាយ': 'poa svay', 'ពណ៌ទឹកក្រូច': 'poa tuk krouch', 'ពណ៌ផ្កាឈូក': 'poa phka chhouk'
};

const SPLIT_PAIRS = ['ដ្ឋ', 'ទ្ធ', 'ត្ថ', 'ច្ឆ', 'ជ្ញ', 'ទ្យ', 'ត្យ', 'ក្ខ', 'គ្ឃ', 'ក្ស', 'ល្ប', 'ប្ស', 'ត្ស', 'ព្វ', 'ប្ភ'];
function splitsHere(c1, c2) { return 'ងញណនម'.indexOf(c1) > -1 || c1 === c2 || SPLIT_PAIRS.indexOf(c1 + COENG + c2) > -1; }
function isCons(ch) { return Object.prototype.hasOwnProperty.call(C, ch); }
function isVowel(ch) { return Object.prototype.hasOwnProperty.call(V, ch); }
/* one word (no spaces) → syllables → letters */
const OVK = Object.keys(OVERRIDES).sort(function (a, b) { return b.length - a.length; });
function translitWord(w) {
  const m = /^(.*?)([?!.,:;…]*)$/.exec(w), body = m[1], tail = m[2];   // punctuation stays outside the syllables
  if (!body) return tail;
  if (OVERRIDES[body]) return OVERRIDES[body] + tail;
  /* a hand reading inside a longer word (ថ្ងៃ in ថ្ងៃណា): the longest known piece wins, but only where it
     sits on a syllable boundary — not ទេ inside ម្ទេស, nor ល្អ inside ល្អិត */
  for (const k of OVK) { const at = body.indexOf(k); if (at > -1 && k.length >= 2 && boundaryOk(body, at, k)) {
    return [body.slice(0, at), k, body.slice(at + k.length)].filter(Boolean).map(function (x) { return x === k ? OVERRIDES[k] : translitWord(x); }).join('-') + tail; } }
  return translitSyllables(body).join('-') + tail;
}
const SIGN = /[\u17B6-\u17D3]/;   // vowel signs, ្ and the other marks that hang on a consonant
function boundaryOk(body, at, k) {
  const before = body[at - 1] || '', before2 = body[at - 2] || '', after = body[at + k.length] || '', after2 = body[at + k.length + 1] || '';
  const beforeOk = !before || isVowel(before) || before === BANTOC || before === LEK_TOO || (isCons(before) && (SIGN.test(before2) || INDEP[before2]));
  const afterOk = !after || INDEP[after] || DIGITS[after] || (isCons(after) && (SIGN.test(after2) || isCons(after2) || !after2 && false));
  return beforeOk && afterOk;
}
function translitSyllables(w) {
  const chars = Array.from(w), out = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (DIGITS[ch]) { if (out.length && /^\d+$/.test(out[out.length - 1])) out[out.length - 1] += DIGITS[ch]; else out.push(DIGITS[ch]); i++; continue; }
    if (ch === COENG && isCons(chars[i + 1] || '')) { i++; continue; }   // a ្ left after a final: the next consonant starts a syllable
    if (INDEP[ch]) { out.push(INDEP[ch]); i++; continue; }
    if (isVowel(ch)) { out.push(V[ch][0]); i++; continue; }   // a vowel sign on its own (the script's lists show them on ◌)
    if (!isCons(ch)) { if (!SIGN.test(ch) && ch !== LEK_TOO) out.push(ch); i++; continue; }   // a stray sign (ក៏, a ្ at the end) is silent
    /* the onset: a consonant, its series shifters, and any ្ clusters */
    let onset = C[ch][0], series = C[ch][1]; i++;
    if (ch === 'ប' && chars[i] === COENG) onset = 'p';   // ប in a cluster is p: ប្រ pr, ប្អ p'
    if (chars[i] === TREISAP) { series = 2; i++; } else if (chars[i] === MUSIKATOAN) { series = 1; if (ch === 'ប') onset = 'p'; i++; }
    let firstOnly = true;
    while (chars[i] === COENG && isCons(chars[i + 1] || '')) {
      const sub = chars[i + 1]; i += 2;
      onset += C[sub][0]; if (SONORANT.indexOf(sub) === -1 || firstOnly === false) series = C[sub][1]; else if (ch === 'អ') series = C[sub][1];
      if (SONORANT.indexOf(sub) === -1) series = C[sub][1];
      firstOnly = false;
      if (chars[i] === TREISAP) { series = 2; i++; } else if (chars[i] === MUSIKATOAN) { series = 1; i++; }
    }
    /* the vowel: a two-sign one first, then one sign, else the inherent vowel */
    let vowel = null, pair = chars[i] + (chars[i + 1] || '');
    if (V2[pair]) { vowel = V2[pair][series - 1]; i += 2; }
    else if (isVowel(chars[i] || '')) { vowel = V[chars[i]][series - 1]; i++; }
    if (chars[i] === BANTOC) i++;
    if (chars[i] === ROBAT || chars[i] === TOANDAKHIAT) i++;
    /* a final consonant: the next consonant, if it does not start a syllable of its own (no vowel or ្ after it) */
    let final = '';
    const nx = chars[i], nn = chars[i + 1] || '';
    /* a doubled final at the end of a word (មនុស្ស, កិច្ច): the first sounds, the subscript is silent */
    if (nx && isCons(nx) && nn === COENG && isCons(chars[i + 2] || '') && !(chars[i + 3] && (isVowel(chars[i + 3]) || chars[i + 3] === COENG))) {
      final = C[nx][2]; i += 3; if (chars[i] === BANTOC) i++;
    } else if (nx && isCons(nx) && nn === COENG && isCons(chars[i + 2] || '') && (vowel === null || splitsHere(nx, chars[i + 2]))) {
      /* ចង្ក្រាន, ជណ្តើរ, ដើម្បី, ប៉ុន្តែ, សិក្សា: a consonant with ្ under it closes this syllable and the one
         under it opens the next — after a vowel only for the pairs that are read that way (a nasal, a
         doubled consonant, the Pali pairs); any other pair after a vowel is a cluster opening the next
         syllable (ផ្លែក្រូច phlae-krouch, ខ្លាឃ្មុំ khla-khmum, កើតជាថ្មី kaeut-chie-thmey) */
      final = C[nx][2]; i++;
    } else if (nx && isCons(nx) && !(isVowel(nn) || nn === COENG || V2[nn + (chars[i + 2] || '')] || nn === TREISAP || nn === MUSIKATOAN)) {
      const after = chars[i + 1] || '';
      /* a consonant with ៍ after it is silent; one at the end of the word or before another consonant is a final */
      if (after === TOANDAKHIAT) { i += 2; }
      else { final = C[nx][2]; i++; if (chars[i] === BANTOC) i++; if (chars[i] === ROBAT) i++; }
    }
    if (vowel === null) vowel = final || chars[i] ? (series === 1 ? 'a' : 'o') : (series === 1 ? 'a' : 'o');
    out.push(onset + vowel + final);
  }
  return out;
}
export function translit(text) {
  return String(text).split(/(\s+|\/|\(|\)|,|◌)/).map(function (part) {
    if (!part || /^\s+$/.test(part) || /^[\/(),◌]$/.test(part)) return part === '◌' ? '' : part;
    return /[ក-៿]/.test(part) ? translitWord(part) : part;
  }).join('').replace(/\s+/g, ' ').trim();
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'public/khmer-vocab.js');
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const src = fs.readFileSync(FILE, 'utf8'), ctx = {}; vm.runInNewContext(src, ctx);
  const V0 = ctx.GP_KHMER_VOCAB;
  if (process.argv.includes('--show')) {
    V0.cats.forEach(function (c) { if (c.script) return; c.words.slice(0, 4).forEach(function (w) { console.log(c.id.padEnd(12), w[0].padEnd(28), w[1].padEnd(22), translit(w[1])); }); });
    process.exit(0);
  }
  /* rewrite the file: the header comment kept, every word [en, km, note, tl] (note '' when none; the
     script's lists keep their own sound as the reading) */
  const head = src.slice(0, src.indexOf('var GP_KHMER_VOCAB'));
  const q = function (s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; };
  let out = head + 'var GP_KHMER_VOCAB = {\n  levels: [\n' + V0.levels.map(function (L) { return '    { id: ' + L.id + ', name: ' + q(L.name) + ', blurb: ' + q(L.blurb) + ' }'; }).join(',\n') + '\n  ],\n  cats: [\n';
  out += V0.cats.map(function (c) {
    const meta = '{ id: ' + q(c.id) + ', level: ' + c.level + (c.script ? ', script: true' : '') + (c.en ? ', en: true' : '') + ', name: ' + q(c.name) + (c.tip ? ', tip: ' + q(c.tip) : '') + ', words: [\n';
    const rows = []; let line = '     ';
    c.words.forEach(function (w) {
      const tl = c.script ? (c.en ? '' : w[0].split(' · ')[0]) : translit(w[1]);
      const cell = ' [' + q(w[0]) + ', ' + q(w[1]) + ', ' + q(w[2] || '') + ', ' + q(tl) + '],';
      if ((line + cell).length > 180) { rows.push(line); line = '     '; }
      line += cell;
    });
    rows.push(line);
    return '    ' + meta + rows.join('\n').replace(/,$/, '') + '\n    ] }';
  }).join(',\n') + '\n  ]\n};\n';
  out = out.replace(/,\n    \] \}/g, '\n    ] }');
  fs.writeFileSync(FILE, out);
  /* the Grammar lessons: every example's `tl` is its Khmer words' readings, in place */
  const GFILE = path.join(ROOT, 'public/khmer-grammar.js');
  if (fs.existsSync(GFILE)) {
    const g = fs.readFileSync(GFILE, 'utf8').replace(/km: (\[[^\]]*\]), tl: \[[^\]]*\]/g, function (all, km) {
      return 'km: ' + km + ', tl: ' + JSON.stringify(JSON.parse(km).map(translit));
    });
    fs.writeFileSync(GFILE, g);
    console.log('wrote', GFILE);
  }
  const n = V0.cats.reduce(function (a, c) { return a + c.words.length; }, 0);
  console.log('wrote', FILE, n, 'words with a reading');
}
