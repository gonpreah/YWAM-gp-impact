/* The Library's recorded audio, made by hand with scripts/record-library-audio.mjs
   (Azure stood in) and played by audio.js / api.js libAudioIndex. The script says
   each screen exactly as the reader shows it, in English and Khmer; finds voices by
   name; a dry run calls nothing; it records one MP3 per screen, then only what
   changed (or everything with --force); the key goes only in Azure's header and is
   never printed; a key Azure refuses stops it; a busy Azure is retried; --upload puts
   the files in 'gp-audio' (not the backed-up 'gp-data') where libAudioIndex and
   audio.js serve them to anyone, read-only. The app itself can no longer record. */
import { tmpDir, REPO } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('library-audio');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const stores={};
export function getStore(o){
  const name=(typeof o==='string') ? o : o.name;
  const mem=stores[name]||(stores[name]=new Map());
  return {
    get: async (k,opt)=>{ if(!mem.has(k)) return null; const v=mem.get(k);
      if(opt&&opt.type==='arrayBuffer'){ const u=v instanceof Uint8Array?v:new TextEncoder().encode(v); return u.buffer.slice(u.byteOffset,u.byteOffset+u.byteLength); }
      if(opt&&opt.type==='text') return v; return JSON.parse(v); },
    set: async (k,v)=>{ mem.set(k, (v instanceof Uint8Array||v instanceof ArrayBuffer) ? new Uint8Array(v) : String(v)); },
    setJSON: async (k,v)=>{ mem.set(k, JSON.stringify(v)); },
    delete: async (k)=>{ mem.delete(k); },
    list: ()=>({ [Symbol.asyncIterator]: async function*(){ yield { blobs: [...mem.keys()].map(key=>({key})), directories: [] }; } })
  };
}
export const __stores=stores;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
/* the recording script as it sits in the repo — scripts/ beside netlify/functions/ and public/ — so it uses the stood-in store */
fs.mkdirSync(TMP + '/scripts', { recursive: true }); fs.mkdirSync(TMP + '/netlify/functions', { recursive: true }); fs.mkdirSync(TMP + '/public', { recursive: true });
fs.copyFileSync(REPO + '/scripts/record-library-audio.mjs', TMP + '/scripts/record-library-audio.mjs');
fs.copyFileSync(REPO + '/netlify/functions/library-audio-lib.js', TMP + '/netlify/functions/library-audio-lib.js');
for (const f of ['km.js', 'library.js', 'library-km.js']) fs.copyFileSync(REPO + '/public/' + f, TMP + '/public/' + f);

/* Azure and our own background function, stood in */
const azure = [];
let azureMode = 'ok', azureFailOnce = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (/tts\.speech\.microsoft\.com/.test(u)) {
    azure.push({ url: u, headers: init.headers, body: init.body });
    if (azureMode === 'badkey') return new Response('no', { status: 401 });
    if (azureFailOnce > 0) { azureFailOnce--; return new Response('busy', { status: 429 }); }
    const bytes = new Uint8Array(400); bytes.set(new TextEncoder().encode('ID3fake:' + azure.length));
    return new Response(bytes, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  }
  return realFetch(url, init);
};
process.env.GP_LEADER_CODE = 'leadercode'; process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const audio = await import(TMP + '/audio.js');
const data = blobs.__stores['gp-data'] || (blobs.getStore({ name: 'gp-data' }), blobs.__stores['gp-data']);
const script = await import(TMP + '/scripts/record-library-audio.mjs');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [{ id: 'st_admin', name: 'Uriah', username: 'uriah', campus: 'siemreap', active: true, isAdmin: true, pinSalt: 'st_admin', pinHash: H('1234', 'st_admin') }]);
async function call(fn, args) { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return r.json(); }
const get = (q) => audio.default({ method: 'GET', url: 'http://localhost/.netlify/functions/audio?' + q });
const logs = []; const log = (x) => logs.push(x);
const OUT = TMP + '/out';
const lib = script.loadLibrary(REPO);
const B = lib.books.find((b) => b.id === 'start-with-why'), N = B.insights.length;

console.log('=== the app can’t record ===');
for (const fn of ['libAudioStatus', 'libAudioStart', 'libAudioSample', 'libAudioStop']) {
  const r = await call(fn, ['uriah', '1234']);
  ok(fn + ' is not in the app', !r.ok);
}

console.log('\n=== what each screen says ===');
const en = script.stepTexts(B, 'en', lib), km = script.stepTexts(B, 'km', lib);
ok('one text per reader screen: the intro, each key idea, the final summary', en.length === N + 2 && km.length === N + 2);
ok('… the intro names the book and author, then the vibe and big idea', en[0].startsWith('Intro\n\nStart with Why — Simon Sinek\n\n' + B.vibe) && en[0].includes(B.bigIdea.slice(0, 40)));
ok('… a key idea is announced, then its title and body', en[1] === 'Key idea 1 of ' + N + '\n\n' + B.insights[0].title + '\n\n' + B.insights[0].body);
ok('… the summary has the one line, try this week, and for us at GP', en[N + 1].includes(B.oneLine) && B.tryThis.every((x) => en[N + 1].includes(x)) && en[N + 1].includes('For us at GP'));
ok('in Khmer it says the Khmer, with Khmer labels', /[ក-៿]/.test(km[1]) && !km[1].startsWith('Key idea') && km[1].includes(lib.km['start-with-why'].insights[0].title));
ok('voices by name, and a wrong one is refused', script.resolveVoice('en', 'andrew') === 'en-US-AndrewMultilingualNeural' && script.resolveVoice('km', 'Piseth') === 'km-KH-PisethNeural' &&
  script.resolveVoice('km') === 'km-KH-SreymomNeural' && (() => { try { script.resolveVoice('km', 'andrew'); return false; } catch (e) { return true; } })());

console.log('\n=== recording ===');
let r = await script.main(['--lang', 'en', '--dry-run'], {}, log);
ok('a dry run counts all 46 books and calls nothing', r.books === 46 && r.chars > 500000 && azure.length === 0);
let err = ''; try { await script.main(['--lang', 'en', '--books', 'start-with-why'], {}, log); } catch (e) { err = e.message; }
ok('without the key it stops and says so', /AZURE_SPEECH_KEY/.test(err) && azure.length === 0);
const ENV = { AZURE_SPEECH_KEY: 'test-key-123', AZURE_SPEECH_REGION: 'southeastasia' };
process.env.AZURE_SPEECH_KEY = ENV.AZURE_SPEECH_KEY; process.env.AZURE_SPEECH_REGION = ENV.AZURE_SPEECH_REGION;
r = await script.main(['--lang', 'en', '--voice', 'andrew', '--books', 'start-with-why,atomic-habits', '--out', OUT], ENV, log);
ok('it records one MP3 per screen', r.made === (N + 2) + (lib.books.find((b) => b.id === 'atomic-habits').insights.length + 2) && fs.existsSync(OUT + '/en/start-with-why/0.mp3') && fs.existsSync(OUT + '/en/start-with-why/' + (N + 1) + '.mp3'));
ok('… in the chosen voice, the paragraphs paused between and made safe', azure.every((a) => /voice name="en-US-AndrewMultilingualNeural"/.test(a.body)) && azure.some((a) => /Simon Sinek<break time="600ms"\/>/.test(a.body)) && !azure.some((a) => /[^&]&[^a-z#]/.test(a.body.replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, ''))));
ok('… the key only in Azure’s header, and never printed', azure.every((a) => a.headers['Ocp-Apim-Subscription-Key'] === 'test-key-123' && /southeastasia\.tts\.speech\.microsoft\.com/.test(a.url)) && !logs.join('\n').includes('test-key-123'));
azure.length = 0;
r = await script.main(['--lang', 'en', '--voice', 'andrew', '--books', 'start-with-why', '--out', OUT], ENV, log);
ok('a second run records nothing that hasn’t changed', r.made === 0 && azure.length === 0);
r = await script.main(['--lang', 'en', '--voice', 'ava', '--books', 'start-with-why', '--out', OUT], ENV, log);
ok('… a new voice records it all again', r.made === N + 2);
azure.length = 0;
r = await script.main(['--lang', 'en', '--voice', 'ava', '--books', 'start-with-why', '--out', OUT, '--force'], ENV, log);
ok('… and --force does, even unchanged', r.made === N + 2);
azureMode = 'badkey'; err = '';
try { await script.main(['--lang', 'en', '--books', 'atomic-habits', '--out', OUT, '--force'], ENV, log); } catch (e) { err = e.message; }
ok('a key Azure refuses stops the run', /turned the key down/.test(err));
azureMode = 'ok'; azureFailOnce = 2; azure.length = 0;
r = await script.main(['--lang', 'km', '--voice', 'piseth', '--books', 'start-with-why', '--out', OUT], ENV, log);
ok('a busy Azure (429) is tried again; Khmer in a Khmer voice', r.made === N + 2 && r.failed.length === 0 && azure.some((a) => /km-KH-PisethNeural/.test(a.body) && /xml:lang="km-KH"/.test(a.body)));

console.log('\n=== upload, and playing it ===');
err = ''; try { await script.main(['--lang', 'en', '--books', 'start-with-why', '--upload'], ENV, log); } catch (e) { err = e.message; }
ok('--upload needs the Netlify site and token', /NETLIFY_SITE_ID/.test(err));
r = await script.main(['--lang', 'en', '--voice', 'andrew', '--books', 'start-with-why', '--upload'], { ...ENV, NETLIFY_SITE_ID: 'site', NETLIFY_AUTH_TOKEN: 'tok' }, log);
const st = blobs.__stores['gp-audio'];
ok('… then the files go in the gp-audio store, not the backed-up gp-data', r.made === N + 2 && st.has('en/start-with-why/0') && ![...data.keys()].some((k) => /start-with-why/.test(k)));
let ix = await call('libAudioIndex', []);
ok('libAudioIndex tells anyone which books are recorded — no hashes', ix.ok && ix.index.en['start-with-why'].n === N + 2 && ix.index.en['start-with-why'].voice === 'Andrew' && !JSON.stringify(ix).includes('hashes'));
let res = await get('lang=en&book=start-with-why&step=1');
ok('audio.js plays a screen’s MP3', res.status === 200 && res.headers.get('Content-Type') === 'audio/mpeg' && (await res.arrayBuffer()).byteLength === 400);
res = await get('lang=en&book=nope&step=1'); ok('a book with no recording is not found', res.status === 404);
res = await get('lang=xx&book=start-with-why&step=1'); ok('a made-up language is refused', res.status === 400);
res = await audio.default({ method: 'POST', url: 'http://localhost/.netlify/functions/audio?index=1' }); ok('audio.js only reads', res.status === 405);
ok('nothing about audio is in the public dashboard', !JSON.stringify(await call('getData', [''])).includes('gp-audio'));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
