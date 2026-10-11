/* Plays the Library's recorded audio to anyone (the books are open to guests
   too): GET ?index=1 → which books are recorded; GET ?lang=en&book=<id>&step=3
   → that screen's MP3. Read-only; nothing here can record or change anything.
   The phone fetches the file whole (fine for iPhones, which want byte ranges
   for a streamed <audio> but play a fetched blob). Versioned by the index's
   `v`, so a re-recorded book is never served stale. */
import { audioStore, readIndex, publicIndex, AUDIO_LANGS, bookIdOk, stepKey } from './library-audio-lib.js';

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const u = new URL(req.url), st = audioStore();
  if (u.searchParams.get('index')) {
    return new Response(JSON.stringify({ ok: true, index: publicIndex(await readIndex(st)) }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
  }
  const lang = u.searchParams.get('lang'), book = u.searchParams.get('book'), step = Number(u.searchParams.get('step'));
  if (AUDIO_LANGS.indexOf(lang) === -1 || !bookIdOk(book) || !(step >= 0 && step < 20 && Math.floor(step) === step)) return new Response('Bad request', { status: 400 });
  const buf = await st.get(stepKey(lang, book, step), { type: 'arrayBuffer' });
  if (!buf) return new Response('Not found', { status: 404 });
  return new Response(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400',
    'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable' } });
};
