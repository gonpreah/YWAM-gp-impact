/* scripts/khmer-translit.mjs — Khmer → "sounds like" in Latin letters (Andrew, Oct 2026: "for those who
   don't know how to read, transliterate the word in English"). Rule-based and approximate: a reading aid.
   These pin the rules that matter — series, finals, clusters, two-sign vowels, the hand overrides, where
   a word splits into syllables — and that the data file carries a reading for every word. */
import { translit, OVERRIDES } from '../scripts/khmer-translit.mjs';
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x ? '  → ' + x : '')); } };
const is = (km, want, why) => ok((why || km) + ' → ' + want, translit(km) === want, translit(km));

is('ក', 'ka', 'a bare first-series consonant has an a');
is('គ', 'ko', 'a bare second-series consonant has an o');
is('កា', 'ka', 'ា after the first series');
is('គា', 'kie', 'ា after the second series');
is('បាន', 'ban', 'a final consonant');
is('ពាក់', 'piek', 'ប/ព: p as a final; ់ is silent');
is('ស្រី', 'srey', 'a ្ cluster');
is('ខ្លាឃ្មុំ', 'khla-khmum', 'a cluster after a vowel opens the next syllable');
is('ដើម្បី', 'daeum-bey', 'a nasal with ្ under it after a vowel closes its syllable');
is('សិក្សា', 'sek-sa', 'ក្ស splits');
is('មេត្តា', 'met-ta', 'a doubled consonant splits');
is('មនុស្ស', 'monuh', 'a doubled final at the end is one sound');
is('ជំនុំ', 'chum-num', 'ុំ is om/um');
is('ចង្ក្រាន', 'chang-kran', 'a consonant with ្ under it straight after a bare onset closes the syllable');
is('ប៉ុន្មាន?', 'ponman?', 'a hand reading keeps its punctuation outside');
is('ម្ទេស', 'mteh', 'ទេ is not read as a word inside ម្ទេស');
is('សត្វល្អិត', 'sat-let', 'ល្អ is not read as a word inside ល្អិត');
is('ថ្ងៃណា?', 'thngai na?', 'a hand reading inside a longer word');
is('មួយណាក៏បាន', 'muoy-na-kor-ban', 'ក៏');
is('ទីក្រុងភ្នំពេញ', 'ti krong-phnum-penh', 'a city');
is('សូមអរគុណ / អរគុណច្រើន', 'soum-orkun / orkun-chraeun', 'alternatives with / keep the slash');
is('ស្រៈ (◌ា)', 'srak (a)', '◌ is dropped');
is('១២៣', '123', 'digits');
ok('hand readings are plain Latin', Object.values(OVERRIDES).every(v => /^[a-z' -]+$/.test(v)), Object.values(OVERRIDES).filter(v => !/^[a-z' -]+$/.test(v)).join());

/* the data file: every word has a reading in its 4th place, made by this script */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = {}; vm.runInNewContext(fs.readFileSync(ROOT + '/public/khmer-vocab.js', 'utf8'), ctx);
const words = []; ctx.GP_KHMER_VOCAB.cats.forEach(c => { if (!c.script) c.words.forEach(w => words.push(w)); });
ok('every word of the book has a reading, and it is what the script makes now (run it after changing a word)',
  words.every(w => w[3] && w[3] === translit(w[1])), JSON.stringify(words.filter(w => !(w[3] && w[3] === translit(w[1]))).slice(0, 3)));
/* the grammar lessons' sentences: a reading for each Khmer word, made by the same script */
const ctxG = {}; vm.runInNewContext(fs.readFileSync(ROOT + '/public/khmer-grammar.js', 'utf8'), ctxG);
const ex = ctxG.GP_KHMER_GRAMMAR.lessons.flatMap(l => l.examples);
ok('every grammar sentence\'s Khmer words have their readings, made by this script (run it after changing a sentence)',
  ex.every(e => e.tl.length === e.km.length && e.km.every((w, i) => e.tl[i] === translit(w))), JSON.stringify(ex.filter(e => !e.km.every((w, i) => e.tl[i] === translit(w))).slice(0, 2)));
is('ឲ្យ', 'aoy', 'a hand reading for the grammar words');
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
