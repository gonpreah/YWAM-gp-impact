/* The Library's recorded audio — shared by scripts/record-library-audio.mjs (which
   records it, run by hand — not from the app), audio.js (plays the files to anyone)
   and api.js libAudioIndex (says which books have it).

   Microsoft Azure Speech makes the voices — the one service with natural Khmer
   voices (Sreymom, Piseth) as well as English. Its key, AZURE_SPEECH_KEY with
   AZURE_SPEECH_REGION, lives only in the environment of whoever runs the script;
   never in this public repo, never sent to a phone.

   One MP3 per reader screen (intro, each key idea, the final summary) in the store
   'gp-audio' — kept apart from 'gp-data' so the nightly backup doesn't copy
   hundreds of MB of audio that can always be made again. 'index' says which books
   are recorded in which language, with which voice and a hash of each screen's
   text, so a second run records only what changed. */
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

export const AUDIO_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
export const AUDIO_VOICES = {
  en: [
    { id: 'en-US-AvaMultilingualNeural', name: 'Ava', note: 'American, female' },
    { id: 'en-US-AndrewMultilingualNeural', name: 'Andrew', note: 'American, male' },
    { id: 'en-US-EmmaMultilingualNeural', name: 'Emma', note: 'American, female' },
    { id: 'en-US-BrianMultilingualNeural', name: 'Brian', note: 'American, male' },
    { id: 'en-GB-SoniaNeural', name: 'Sonia', note: 'British, female' },
    { id: 'en-GB-RyanNeural', name: 'Ryan', note: 'British, male' }
  ],
  km: [
    { id: 'km-KH-SreymomNeural', name: 'Sreymom', note: 'Khmer, female' },
    { id: 'km-KH-PisethNeural', name: 'Piseth', note: 'Khmer, male' }
  ]
};
export const AUDIO_LANGS = ['en', 'km'];

export function audioStore() { return getStore({ name: 'gp-audio', consistency: 'strong' }); }
export function audioConfigured() {
  return !!(process.env.AZURE_SPEECH_KEY && /^[a-z0-9]{3,40}$/.test(process.env.AZURE_SPEECH_REGION || ''));
}
export function voiceOk(lang, voice) { return (AUDIO_VOICES[lang] || []).some(function (v) { return v.id === voice; }); }
export function bookIdOk(id) { return typeof id === 'string' && /^[a-z0-9-]{2,80}$/.test(id); }
export function stepKey(lang, book, step) { return lang + '/' + book + '/' + step; }
export function hashOf(voice, text) { return crypto.createHash('sha256').update(voice + '\n' + text, 'utf8').digest('hex').slice(0, 16); }

function xml_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
export function ssml(lang, voice, text) {
  const paras = String(text).split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + (lang === 'km' ? 'km-KH' : 'en-US') + '">' +
    '<voice name="' + xml_(voice) + '">' + paras.map(xml_).join('<break time="600ms"/>') + '</voice></speak>';
}
/* One screen of text → MP3 bytes. Retries a busy answer (429/5xx) a few times. */
export async function synthesize(lang, voice, text) {
  const region = process.env.AZURE_SPEECH_REGION, key = process.env.AZURE_SPEECH_KEY;
  if (!audioConfigured()) throw new Error('not_set_up');
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://' + region + '.tts.speech.microsoft.com/cognitiveservices/v1', {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': AUDIO_FORMAT, 'User-Agent': 'ywam-gp-library' },
      body: ssml(lang, voice, text)
    });
    if (res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length < 200) throw new Error('empty_audio');
      return buf;
    }
    last = 'azure_' + res.status;
    if (res.status === 401 || res.status === 403) throw new Error('azure_key');   // the key or region is wrong: no point retrying
    if (res.status !== 429 && res.status < 500) throw new Error(last);
    await new Promise(function (r) { setTimeout(r, 1500 * (attempt + 1)); });
  }
  throw new Error(last || 'azure_failed');
}

export async function readIndex(st) { const v = await (st || audioStore()).get('index', { type: 'json' }); return v && typeof v === 'object' ? v : { en: {}, km: {} }; }
/* What a phone needs: which books are recorded, how many screens, a version for caching. */
export function publicIndex(ix) {
  const out = {};
  AUDIO_LANGS.forEach(function (l) {
    out[l] = {};
    Object.keys(ix[l] || {}).forEach(function (id) { const r = ix[l][id]; if (r && r.n) out[l][id] = { n: r.n, v: r.v, voice: r.voiceName || '' }; });
  });
  return out;
}

/* Records one book: every screen whose text or voice changed since last time
   (all of them on a first run), then writes the index. */
export async function recordBook(st, lang, voice, book, force) {
  const ix = await readIndex(st);
  const prev = (ix[lang] || {})[book.id];
  const hashes = book.steps.map(function (s) { return hashOf(voice, s); });
  let made = 0;
  for (let i = 0; i < book.steps.length; i++) {
    if (!force && prev && prev.hashes && prev.hashes[i] === hashes[i] && prev.n === book.steps.length) continue;
    const mp3 = await synthesize(lang, voice, book.steps[i]);
    await st.set(stepKey(lang, book.id, i), mp3);
    made++;
  }
  const ix2 = await readIndex(st);   // read again: another book may have finished meanwhile
  ix2[lang] = ix2[lang] || {};
  const vname = (AUDIO_VOICES[lang].filter(function (v) { return v.id === voice; })[0] || {}).name || voice;
  ix2[lang][book.id] = { n: book.steps.length, hashes: hashes, voice: voice, voiceName: vname, v: hashOf(voice, hashes.join('')).slice(0, 10), at: new Date().toISOString() };
  await st.setJSON('index', ix2);
  return made;
}
