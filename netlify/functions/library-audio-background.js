/* Records the Library's audio in the background (a Netlify background function:
   up to 15 minutes a run, answered at once with 202). Each run records ONE book
   of the job in 'gp-audio' → 'job', then calls itself for the next, so a whole
   language finishes even after the admin closes the page. Only a caller holding
   the job's own random token gets anything done — that token never leaves the
   server (api.js libAudioStart writes it and makes the first call). */
import { audioStore, recordBook } from './library-audio-lib.js';

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) { return new Response('bad', { status: 400 }); }
  const st = audioStore();
  const job = await st.get('job', { type: 'json' });
  if (!job || job.state !== 'running' || !body.token || body.token !== job.token) return new Response('no', { status: 403 });
  const next = job.queue[0];
  if (!next) { job.state = 'done'; job.updated = new Date().toISOString(); await st.setJSON('job', job); return new Response('done'); }
  const texts = await st.get('jobtexts', { type: 'json' }) || {};
  const book = { id: next, steps: texts[next] || [] };
  let err = '';
  try { if (!book.steps.length) throw new Error('no_text'); await recordBook(st, job.lang, job.voice, book, job.force); }
  catch (e) { err = String((e && e.message) || e).slice(0, 80); }
  const now = await st.get('job', { type: 'json' });   // the admin may have pressed Stop meanwhile
  if (!now || now.token !== job.token) return new Response('replaced');
  now.queue = now.queue.filter(function (id) { return id !== next; });
  if (err) now.failed = (now.failed || []).concat([{ id: next, err: err }]); else now.done = (now.done || []).concat([next]);
  now.updated = new Date().toISOString();
  if (err === 'azure_key' || err === 'not_set_up') { now.state = 'stopped'; now.stopReason = err; }
  if (now.state === 'running' && !now.queue.length) now.state = 'done';
  await st.setJSON('job', now);
  if (now.state === 'running') {
    const self = new URL('/.netlify/functions/library-audio-background', process.env.URL || req.url);
    try { await fetch(self, { method: 'POST', body: JSON.stringify({ token: now.token }) }); } catch (e) {}
  }
  return new Response('ok');
};
