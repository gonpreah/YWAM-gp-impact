/* The Library's recorded audio on the server (api.js libAudio*, library-audio-
   background.js, audio.js), with Azure and the background function stood in.
   Only admins see the status, hear samples, start or stop; without the Azure key
   nothing records (and the key is never sent anywhere but Azure); a run records
   book by book in the background, each screen one MP3 in 'gp-audio' (not the
   backed-up 'gp-data'), and the index says what is recorded; audio.js serves the
   index (no hashes) and the files to anyone, nothing else; "new and changed" only
   records what changed; Stop ends the run; a stranger with no token gets nothing;
   a wrong key stops the run; a busy Azure is retried. */
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

/* Azure and our own background function, stood in */
const azure = [], bgCalls = [];
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
  if (/library-audio-background/.test(u)) { bgCalls.push(JSON.parse(init.body)); return new Response('', { status: 202 }); }
  return realFetch(url, init);
};
process.env.GP_LEADER_CODE = 'leadercode'; process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const bg = await import(TMP + '/library-audio-background.js');
const audio = await import(TMP + '/audio.js');
const data = blobs.__stores['gp-data'] || (blobs.getStore({ name: 'gp-data' }), blobs.__stores['gp-data']);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = (o) => ({ campus: 'siemreap', active: true, ...o, pinSalt: o.id, pinHash: H('1234', o.id) });
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [
  mk({ id: 'st_admin', name: 'Uriah', username: 'uriah', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'st_dara', name: 'Dara', username: 'dara', dept: 'Community Service', ministry: 'Cafe' })
]);
async function call(fn, args) { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return r.json(); }
const store = () => blobs.__stores['gp-audio'] || new Map();
async function drain() { let n = 0; while (bgCalls.length && n < 50) { const b = bgCalls.shift(); await bg.default({ json: async () => b, url: 'http://localhost/.netlify/functions/library-audio-background' }); n++; } return n; }
const get = (q) => audio.default({ method: 'GET', url: 'http://localhost/.netlify/functions/audio?' + q });
const BOOKS = [
  { id: 'start-with-why', steps: ['Intro\n\nStart with Why — Simon Sinek\n\nPeople don’t buy what you do & why.', 'Key idea 1 of 1\n\nThe golden circle\n\nWhy, how, what.', 'Final summary\n\nIn one line: start with why.'] },
  { id: 'atomic-habits', steps: ['Intro\n\nAtomic Habits — James Clear', 'Key idea 1 of 1\n\nTiny changes', 'Final summary\n\nIn one line: 1% better.'] }
];

console.log('=== who may, and the key ===');
let r = await call('libAudioStatus', ['dara', '1234']);
ok('only an admin sees the audio page', !r.ok && r.err === 'not_authorized');
r = await call('libAudioStart', ['dara', '1234', 'en', 'en-US-AvaMultilingualNeural', BOOKS]);
ok('… or starts a recording', !r.ok && r.err === 'not_authorized');
r = await call('libAudioStatus', ['uriah', '1234']);
ok('without AZURE_SPEECH_KEY the page says it is not set up', r.ok && r.configured === false && r.voices.km.some(v => v.id === 'km-KH-SreymomNeural'));
r = await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AvaMultilingualNeural', BOOKS]);
ok('… and nothing records', !r.ok && r.err === 'not_set_up' && azure.length === 0);
process.env.AZURE_SPEECH_KEY = 'test-key-123'; process.env.AZURE_SPEECH_REGION = 'southeastasia';
r = await call('libAudioStatus', ['uriah', '1234']);
ok('with the key in Netlify: set up — and the key itself never comes back', r.ok && r.configured === true && !JSON.stringify(r).includes('test-key-123'));
r = await call('libAudioStart', ['uriah', '1234', 'en', 'km-KH-SreymomNeural', BOOKS]);
ok('a voice from the other language is refused', !r.ok && r.err === 'bad_voice');
r = await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AvaMultilingualNeural', [{ id: '../x', steps: ['a', 'b'] }]]);
ok('a book id that isn’t one is refused', !r.ok && r.err === 'bad_books');

console.log('\n=== a sample ===');
r = await call('libAudioSample', ['uriah', '1234', 'km', 'km-KH-PisethNeural']);
ok('▶ a sample comes back as audio, in that voice', r.ok && r.mp3.length > 100 && /km-KH-PisethNeural/.test(azure[azure.length - 1].body) && /xml:lang="km-KH"/.test(azure[azure.length - 1].body));
ok('… with the key only in Azure’s header', azure[azure.length - 1].headers['Ocp-Apim-Subscription-Key'] === 'test-key-123' && /southeastasia\.tts\.speech\.microsoft\.com/.test(azure[azure.length - 1].url));

console.log('\n=== a recording run ===');
azure.length = 0;
r = await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AvaMultilingualNeural', BOOKS]);
ok('Start hands the run to the background function', r.ok && r.job && r.job.state === 'running' && r.job.total === 2 && bgCalls.length === 1);
r = await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AvaMultilingualNeural', BOOKS]);
ok('… and a second Start while it runs is refused', !r.ok && r.err === 'busy');
const ran = await drain();
r = await call('libAudioStatus', ['uriah', '1234']);
ok('it records book by book, calling itself for the next, until done', ran >= 2 && r.job.state === 'done' && r.job.done === 2 && azure.length === 6, 'runs ' + ran + ', azure ' + azure.length);
ok('each screen is one MP3 in its own store, not the backed-up one', store().has('en/start-with-why/0') && store().has('en/atomic-habits/2') && ![...data.keys()].some(k => /start-with-why\/0/.test(k)));
ok('the speech is the screen’s text, its paragraphs paused between, & made safe', azure.some(a => /Simon Sinek<break time="600ms"\/>People don’t buy what you do &amp; why\./.test(a.body)) && azure.every(a => /voice name="en-US-AvaMultilingualNeural"/.test(a.body)));
let res = await get('index=1'); let ix = await res.json();
ok('audio.js tells anyone which books are recorded — without the hashes', ix.ok && ix.index.en['start-with-why'].n === 3 && ix.index.en['start-with-why'].voice === 'Ava' && !JSON.stringify(ix).includes('hashes'));
res = await get('lang=en&book=start-with-why&step=1');
ok('… and plays a screen’s MP3', res.status === 200 && res.headers.get('Content-Type') === 'audio/mpeg' && (await res.arrayBuffer()).byteLength === 400);
res = await get('lang=en&book=nope&step=1'); ok('a book with no recording is not found', res.status === 404);
res = await get('lang=xx&book=start-with-why&step=1'); ok('a made-up language is refused', res.status === 400);
res = await audio.default({ method: 'POST', url: 'http://localhost/.netlify/functions/audio?index=1' }); ok('audio.js only reads', res.status === 405);

console.log('\n=== only what changed ===');
azure.length = 0;
const changed = JSON.parse(JSON.stringify(BOOKS)); changed[0].steps[1] = 'Key idea 1 of 1\n\nThe golden circle\n\nWhy first, then how, then what.';
await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AvaMultilingualNeural', changed]); await drain();
ok('"Record new and changed" records only the screen that changed', azure.length === 1 && /Why first/.test(azure[0].body));
azure.length = 0;
await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AndrewMultilingualNeural', changed]); await drain();
ok('a new voice records every screen again', azure.length === 6);
azure.length = 0;
await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AndrewMultilingualNeural', changed, true]); await drain();
ok('"Re-record everything" does, even with nothing changed', azure.length === 6);

console.log('\n=== stop, strangers, a wrong key, a busy Azure ===');
azure.length = 0;
await call('libAudioStart', ['uriah', '1234', 'km', 'km-KH-SreymomNeural', BOOKS, true]);
const tok = bgCalls[0].token;
await bg.default({ json: async () => bgCalls.shift(), url: 'http://localhost/x' });   // the first book
r = await call('libAudioStop', ['uriah', '1234']);
ok('Stop ends the run after the book it is on', r.ok && r.job.state === 'stopped' && r.job.done === 1);
const before = azure.length; await drain();
ok('… and the next call does nothing', azure.length === before);
res = await bg.default({ json: async () => ({ token: 'guess' }), url: 'http://localhost/x' });
ok('the background function does nothing for a caller without the run’s token', res.status === 403);
res = await bg.default({ json: async () => ({ token: tok }), url: 'http://localhost/x' });
ok('… nor with an old run’s token once stopped', res.status === 403);
azureMode = 'badkey';
await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AvaMultilingualNeural', BOOKS, true]); await drain();
r = await call('libAudioStatus', ['uriah', '1234']);
ok('a key Azure turns down stops the run and says so', r.job.state === 'stopped' && r.job.failed.length === 1 && r.job.failed[0].err === 'azure_key');
azureMode = 'ok'; azureFailOnce = 2; azure.length = 0;
await call('libAudioStart', ['uriah', '1234', 'en', 'en-US-AvaMultilingualNeural', [BOOKS[1]], true]); await drain();
r = await call('libAudioStatus', ['uriah', '1234']);
ok('a busy Azure (429) is tried again', r.job.state === 'done' && r.job.failed.length === 0 && azure.length === 5);
ok('nothing about audio is in the boot or the public dashboard', !JSON.stringify(await call('getData', [''])).includes('gp-audio'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
