/* Records the Library's audio with Microsoft Azure's voices — run by hand, once
   (and again after books change); nothing in the app records anything.

   Needs an Azure "Speech service" (Standard S0) key — never commit it:

     AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=southeastasia node scripts/record-library-audio.mjs --lang en --dry-run
     … node scripts/record-library-audio.mjs --lang en --voice andrew                 (MP3s into ./library-audio)
     … node scripts/record-library-audio.mjs --lang km --voice sreymom --books start-with-why
     … NETLIFY_SITE_ID=… NETLIFY_AUTH_TOKEN=… node scripts/record-library-audio.mjs --lang en --voice andrew --upload

   --lang en|km        which language's text (Khmer from public/library-km.js)
   --voice <name>      en: ava, andrew, emma, brian, sonia, ryan · km: sreymom, piseth
                       (default andrew / sreymom), or a full Azure voice id
   --books a,b         only these book ids (default: all 46)
   --dry-run           no Azure calls: what would be recorded, characters, rough cost
   --upload            straight into the site's 'gp-audio' store, where the app's player
                       (LIB_AUDIO_ON in teams.html) finds it; needs NETLIFY_SITE_ID and a
                       NETLIFY_AUTH_TOKEN, like scripts/restore-backup.mjs
   --out <dir>         where the MP3s go without --upload (default ./library-audio, not
                       committed: ~200 MB a language)
   --force             record every screen again, even unchanged ones

   Each book is one MP3 per reader screen — the intro, each key idea, the final
   summary — saying exactly what that screen shows, in its order. A second run
   records only the screens whose text or voice changed. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AUDIO_VOICES, synthesize, hashOf, recordBook } from '../netlify/functions/library-audio-lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadLibrary(root) {
  const C = {}; vm.createContext(C);
  for (const f of ['public/km.js', 'public/library.js', 'public/library-km.js'])
    vm.runInContext(fs.readFileSync(path.join(root || ROOT, f), 'utf8'), C);
  vm.runInContext('this.__L=GP_LIBRARY; this.__K=GP_LIBRARY_KM; this.__BK=BUILTIN_KM;', C);
  return { books: C.__L.books, km: C.__K, labels: C.__BK };
}
/* What each screen says — the reader's own order and words (libReaderHtml_ in
   teams.html), a blank line between parts so the voice pauses. */
export function stepTexts(b, lang, lib) {
  const K = lang === 'km' ? lib.km[b.id] : null;
  if (lang === 'km' && !K) throw new Error('no Khmer for ' + b.id);
  const tt = (x) => (lang === 'km' ? (lib.labels[x] || x) : x);
  const fm = (x, o) => tt(x).replace(/\{(\w+)\}/g, (m, k) => o[k]);
  const T = K ? { vibe: K.vibe, bigIdea: K.bigIdea, tryThis: K.tryThis, forUs: K.forUs, oneLine: K.oneLine,
    insights: b.insights.map((x, i) => ({ title: (K.insights[i] || {}).title || x.title, body: (K.insights[i] || {}).body || x.body })) } : b;
  const n = b.insights.length, out = [];
  out.push([tt('Intro'), ((K && K.title) || b.title) + ' — ' + b.author, T.vibe, T.bigIdea].join('\n\n'));
  T.insights.forEach((x, i) => out.push([fm('Key idea {n} of {m}', { n: i + 1, m: n }), x.title, x.body].join('\n\n')));
  out.push([tt('Final summary'), tt('In one line') + ': ' + T.oneLine, tt('Try this week'), ...T.tryThis, tt('For us at YWAM GP'), T.forUs].join('\n\n'));
  return out;
}
export function resolveVoice(lang, v) {
  const list = AUDIO_VOICES[lang] || [];
  if (!v) return list[lang === 'km' ? 0 : 1].id;   // Sreymom / Andrew
  const hit = list.find((x) => x.id.toLowerCase() === v.toLowerCase() || x.name.toLowerCase() === v.toLowerCase());
  if (!hit) throw new Error('voice "' + v + '" — choose one of: ' + list.map((x) => x.name.toLowerCase()).join(', '));
  return hit.id;
}
/* Without --upload: <out>/<lang>/<book>/<step>.mp3, and <out>/<lang>/index.json of what was recorded. */
async function recordLocal(out, lang, voice, book, force) {
  const dir = path.join(out, lang, book.id), ixf = path.join(out, lang, 'index.json');
  const ix = fs.existsSync(ixf) ? JSON.parse(fs.readFileSync(ixf, 'utf8')) : {};
  const prev = ix[book.id], hashes = book.steps.map((s) => hashOf(voice, s));
  fs.mkdirSync(dir, { recursive: true });
  let made = 0;
  for (let i = 0; i < book.steps.length; i++) {
    const f = path.join(dir, i + '.mp3');
    if (!force && prev && prev.hashes[i] === hashes[i] && fs.existsSync(f)) continue;
    fs.writeFileSync(f, await synthesize(lang, voice, book.steps[i])); made++;
  }
  ix[book.id] = { n: book.steps.length, voice, hashes, at: new Date().toISOString() };
  fs.writeFileSync(ixf, JSON.stringify(ix, null, 1));
  return made;
}
export async function main(argv, env, log) {
  log = log || console.log;
  const arg = (k) => { const i = argv.indexOf('--' + k); return i > -1 ? (argv[i + 1] || '') : null; };
  const has = (k) => argv.includes('--' + k);
  const lang = arg('lang');
  if (lang !== 'en' && lang !== 'km') throw new Error('--lang en or --lang km');
  const voice = resolveVoice(lang, arg('voice'));
  const lib = loadLibrary();
  const only = arg('books') ? arg('books').split(',').map((x) => x.trim()).filter(Boolean) : null;
  const books = lib.books.filter((b) => !only || only.includes(b.id));
  if (only && books.length !== only.length) throw new Error('unknown book id in --books');
  const work = books.map((b) => ({ id: b.id, steps: stepTexts(b, lang, lib) }));
  const chars = work.reduce((a, b) => a + b.steps.reduce((x, s) => x + s.length, 0), 0);
  log(`${work.length} books, ${work.reduce((a, b) => a + b.steps.length, 0)} screens, ${chars.toLocaleString('en-US')} characters, voice ${voice}`);
  log(`(Azure neural voices cost about $16 per million characters — check the current price; this run at most ~$${(chars / 1e6 * 16).toFixed(2)})`);
  if (has('dry-run')) return { books: work.length, chars };
  if (!env.AZURE_SPEECH_KEY || !/^[a-z0-9]{3,40}$/.test(env.AZURE_SPEECH_REGION || '')) throw new Error('set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. southeastasia)');
  let store = null;
  if (has('upload')) {
    if (!env.NETLIFY_SITE_ID || !env.NETLIFY_AUTH_TOKEN) throw new Error('--upload needs NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN');
    const { getStore } = await import('@netlify/blobs');
    store = getStore({ name: 'gp-audio', siteID: env.NETLIFY_SITE_ID, token: env.NETLIFY_AUTH_TOKEN, consistency: 'strong' });
  }
  const out = path.resolve(arg('out') || path.join(ROOT, 'library-audio'));
  let made = 0, failed = [];
  for (const [i, b] of work.entries()) {
    try {
      const n = store ? await recordBook(store, lang, voice, b, has('force')) : await recordLocal(out, lang, voice, b, has('force'));
      made += n; log(`${i + 1}/${work.length} ${b.id}: ${n ? n + ' screens recorded' : 'unchanged'}`);
    } catch (e) {
      failed.push(b.id); log(`${i + 1}/${work.length} ${b.id}: FAILED ${e.message}`);
      if (e.message === 'azure_key') throw new Error('Azure turned the key down — check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION');
    }
  }
  log(`done: ${made} screens recorded${failed.length ? ', failed: ' + failed.join(', ') : ''}${store ? ' — in the site’s gp-audio store' : ' — in ' + out}`);
  return { made, failed };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2), process.env).catch((e) => { console.error('Error: ' + e.message); process.exit(1); });
}
