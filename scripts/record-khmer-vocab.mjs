/* Records every word of Learn Khmer (public/khmer-vocab.js) and every grammar example sentence
   (public/khmer-grammar.js) with Azure's voices — Sreymom for the
   Khmer, Ava for the English — into the site's 'gp-audio' store, where netlify/functions/audio.js
   serves them (?lang=km&say=<word>). Run by hand, once, and again after words change; a second run
   records only what is missing. Nothing in the app records anything.

     AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=southeastasia NETLIFY_SITE_ID=… NETLIFY_AUTH_TOKEN=… \
       node scripts/record-khmer-vocab.mjs            (both languages)
     … node scripts/record-khmer-vocab.mjs --lang km  (one language)
     … node scripts/record-khmer-vocab.mjs --dry-run  (what would be recorded, characters, rough cost)

   About 1,100 Khmer words and as many English ones: a few minutes, and well under a dollar of Azure
   time at its neural-voice price. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { getStore } from '@netlify/blobs';
import { synthesize, audioConfigured } from '../netlify/functions/library-audio-lib.js';
import { VOCAB_VOICE, vocabKey, sayOk, grammarSentences } from '../netlify/functions/audio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const dry = args.includes('--dry-run'), only = opt('--lang');
const ctx = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/khmer-vocab.js'), 'utf8'), ctx);
const V = ctx.GP_KHMER_VOCAB;
const want = { km: new Set(), en: new Set() };
V.cats.forEach((c) => c.words.forEach((w) => {
  String(w[1]).split(' / ').forEach((k) => { k = k.replace(/◌/g, '').replace(/\s*\(.*\)$/, '').trim(); if (sayOk('km', k)) want.km.add(k); });
  String(w[0]).split(' / ').forEach((e) => { e = e.replace(/\s*\(.*\)$/, '').replace(/\s*·.*$/, '').trim(); if (sayOk('en', e)) want.en.add(e); });
}));
/* and the Grammar area's example sentences */
try { const g = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'public/khmer-grammar.js'), 'utf8'), g); grammarSentences(g.GP_KHMER_GRAMMAR).forEach((x) => { if (sayOk(x.lang, x.text)) want[x.lang].add(x.text); }); } catch (e) { /* no grammar file */ }
const langs = only ? [only] : ['km', 'en'];
let chars = 0; langs.forEach((l) => want[l].forEach((t) => { chars += t.length; }));
console.log(langs.map((l) => l + ': ' + want[l].size + ' words').join(', ') + ' · ' + chars + ' characters (about $' + (chars / 1e6 * 16).toFixed(2) + ' of Azure time)');
if (dry) process.exit(0);
if (!audioConfigured()) { console.error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION first.'); process.exit(1); }
if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_AUTH_TOKEN) { console.error('Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN so the recordings go into the site\'s store.'); process.exit(1); }
const st = getStore({ name: 'gp-audio', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN, consistency: 'strong' });
let made = 0, kept = 0, failed = 0;
for (const lang of langs) {
  for (const text of want[lang]) {
    const key = vocabKey(lang, text);
    if (await st.get(key, { type: 'arrayBuffer' })) { kept++; continue; }
    try { const buf = await synthesize(lang, VOCAB_VOICE[lang], text); await st.set(key, buf); made++; if (made % 50 === 0) console.log('… ' + made + ' recorded'); }
    catch (e) { failed++; console.error('could not record ' + lang + ' "' + text + '": ' + e.message); }
  }
}
console.log('done: ' + made + ' recorded, ' + kept + ' already there, ' + failed + ' failed');
