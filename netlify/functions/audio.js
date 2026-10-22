/* Plays recorded audio to anyone (the books are open to guests too): GET ?index=1 → which books are
   recorded; GET ?lang=en&book=<id>&step=3 → that screen's MP3. Read-only; nothing here can record or
   change the Library.

   Learn Khmer's words (Oct 2026, Andrew: "can you generate the audio for me?"): GET ?lang=km&say=<word>
   → that word's MP3 from the same store (vocab/<lang>/<hash>). A word not yet recorded is made on the
   spot with Azure's Khmer or English voice when AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are set in the
   site's environment, kept, and served from then on — so the first learner to tap 🔊 on a word records
   it for everyone. Only the words of public/khmer-vocab.js are made (nothing anyone types in; the file
   rides along with the function through netlify.toml's included_files); scripts/record-khmer-vocab.mjs
   records them all in one go. Without the key, a word never recorded is 404 and the app falls back to
   the phone's own voice.

   The phone fetches the file whole (fine for iPhones, which want byte ranges for a streamed <audio> but
   play a fetched blob). Versioned by the index's `v`, so a re-recorded book is never served stale. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { audioStore, readIndex, publicIndex, AUDIO_LANGS, bookIdOk, stepKey, hashOf, synthesize, audioConfigured } from './library-audio-lib.js';

let VOCAB_WORDS = null;   // Set of "lang\nword" for every word in the book (loaded once)
export function vocabWords(file) {
  if (VOCAB_WORDS && !file) return VOCAB_WORDS;
  const set = new Set();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = file ? [file] : [path.join(here, '../../public/khmer-vocab.js'), path.join(process.cwd(), 'public/khmer-vocab.js'), path.join(here, 'public/khmer-vocab.js')];
  for (const f of candidates) {
    try {
      const ctx = {}; vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx);
      (ctx.GP_KHMER_VOCAB.cats || []).forEach(function (c) { (c.words || []).forEach(function (w) {
        String(w[1] || '').split(' / ').forEach(function (k) { k = k.replace(/◌/g, '').replace(/\s*\(.*\)$/, '').trim(); if (k) set.add('km\n' + k); });
        String(w[0] || '').split(' / ').forEach(function (e) { e = e.replace(/\s*\(.*\)$/, '').replace(/\s*·.*$/, '').trim(); if (e) set.add('en\n' + e); });
      }); });
      break;
    } catch (e) { /* try the next place */ }
  }
  if (!file) VOCAB_WORDS = set;
  return set;
}
export const VOCAB_VOICE = { km: 'km-KH-SreymomNeural', en: 'en-US-AvaMultilingualNeural' };
export function vocabKey(lang, text) { return 'vocab/' + lang + '/' + hashOf(VOCAB_VOICE[lang], text); }
export function sayOk(lang, text) {
  if (AUDIO_LANGS.indexOf(lang) === -1 || typeof text !== 'string' || !text || text.length > 80) return false;
  return lang === 'km' ? /^[ក-៿\s]+$/.test(text) : /^[A-Za-z0-9' ’.,!?-]+$/.test(text);
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const u = new URL(req.url), st = audioStore();
  if (u.searchParams.get('index')) {
    return new Response(JSON.stringify({ ok: true, index: publicIndex(await readIndex(st)) }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
  }
  const lang = u.searchParams.get('lang'), say = u.searchParams.get('say');
  if (say !== null) {
    const text = String(say).replace(/\s+/g, ' ').trim();
    if (!sayOk(lang, text)) return new Response('Bad request', { status: 400 });
    const key = vocabKey(lang, text);
    let buf = await st.get(key, { type: 'arrayBuffer' });
    if (!buf) {
      if (!audioConfigured() || !vocabWords().has(lang + '\n' + text)) return new Response('Not found', { status: 404 });
      try { buf = await synthesize(lang, VOCAB_VOICE[lang], text); } catch (e) { return new Response('Not available', { status: 503 }); }
      await st.set(key, buf);
    }
    return new Response(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400',
      'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable' } });
  }
  const book = u.searchParams.get('book'), step = Number(u.searchParams.get('step'));
  if (AUDIO_LANGS.indexOf(lang) === -1 || !bookIdOk(book) || !(step >= 0 && step < 20 && Math.floor(step) === step)) return new Response('Bad request', { status: 400 });
  const buf = await st.get(stepKey(lang, book, step), { type: 'arrayBuffer' });
  if (!buf) return new Response('Not found', { status: 404 });
  return new Response(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400',
    'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable' } });
};
