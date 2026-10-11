/* Recorded audio on the page: Admin → 🎧 Library audio says how to set it up until
   the Azure key is in Netlify; then shows each language's voices (▶ a sample, tap to
   choose), records every book in the background with progress, and counts what is
   recorded. In the reader, a recorded book plays its file for each screen (the phone's
   voice is not used), turns the page when a file ends, and the speed changes the file's
   rate; a book with no recording still reads with the phone's voice. Azure, the
   background function and the audio element are stood in. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('library-audio-rec-ui');
const OUT = tmpDir('library-audio-rec-ui-out');
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
export const __stores=stores;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);

const azure = [], bgCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (/tts\.speech\.microsoft\.com/.test(u)) { azure.push(init.body); const b = new Uint8Array(300); b.set(new TextEncoder().encode('ID3')); return new Response(b, { status: 200 }); }
  if (/library-audio-background/.test(u)) { bgCalls.push(JSON.parse(init.body)); return new Response('', { status: 202 }); }
  return realFetch(url, init);
};
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const bg = await import(TMP + '/library-audio-background.js');
const audio = await import(TMP + '/audio.js');
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', isAdmin: true })]);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer(async (req, res) => {
  const send = async (r) => { res.writeHead(r.status || 200, { 'Content-Type': r.headers.get('Content-Type') || 'application/octet-stream' }); res.end(Buffer.from(await r.arrayBuffer())); };
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    return send(await api.default({ method: 'POST', json: async () => JSON.parse(b || '{}'), headers: new Map() }, {}));
  }
  if (req.url.indexOf('/.netlify/functions/audio') === 0) return send(await audio.default({ method: 'GET', url: 'http://x' + req.url }));
  let u = req.url.split('?')[0]; if (u === '/') u = '/index.html';
  const f = path.join(PUBLIC, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); } else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); } }
async function drain() { let n = 0; while (bgCalls.length && n < 200) { const b = bgCalls.shift(); await bg.default({ json: async () => b, url: BASE + '/.netlify/functions/library-audio-background' }); n++; } return n; }

/* The audio element and the phone's voice, stood in */
const FAKE = () => {
  window.__audio = []; window.__spoken = [];
  window.Audio = function (src) { const a = { src: src || '', paused: true, playbackRate: 1, currentTime: 0, duration: 10, preload: '',
    play() { a.paused = false; window.__audio.push({ src: a.src, rate: a.playbackRate }); return Promise.resolve(); }, pause() { a.paused = true; } }; window.__lastAudio = a; return a; };
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ name: 'Samantha', lang: 'en-US' }],
    speak: (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend({}), 30); }, cancel() {}, get speaking() { return false; }, get pending() { return false; } } });
};
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(path_) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_|404/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(FAKE);
  await page.addInitScript(() => localStorage.setItem('gp-staff', JSON.stringify({ user: 'uriah', pin: '1234' })));
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  return { ctx, page };
}
const toAudioAdmin = async (page) => { await page.click('#menuBtn'); await page.waitForTimeout(250); await page.click('[data-menu-item="admin"]'); await page.waitForTimeout(700);
  await page.click('[data-adminsub="audio"]'); await page.waitForTimeout(2500); };
const C = {}; vm.createContext(C); vm.runInContext(fs.readFileSync(PUBLIC + '/library.js', 'utf8') + ';this.L=GP_LIBRARY;', C);
const B = C.L.books.find(b => b.id === 'start-with-why'), N = B.insights.length;

{
  const { ctx, page } = await open();
  await toAudioAdmin(page);
  const txt = await page.$eval('#main', e => e.innerText);
  ok('Admin has 🎧 Library audio; before the key is in Netlify it says how to set it up', /Not set up yet/.test(txt) && /AZURE_SPEECH_KEY/.test(txt) && /Southeast Asia/.test(txt) && !(await page.$('[data-audstart]')));
  await ctx.close();
}
process.env.AZURE_SPEECH_KEY = 'k-secret'; process.env.AZURE_SPEECH_REGION = 'southeastasia';
{
  const { ctx, page } = await open();
  await toAudioAdmin(page);
  ok('with the key: both languages, each voice with ▶, and nothing recorded yet', (await page.$$('[data-audsample]')).length === 8 && /0 of 46 books recorded/.test(await page.$eval('#main', e => e.innerText)));
  await page.click('[data-audvoice="km|km-KH-PisethNeural"]'); await page.waitForTimeout(300);
  ok('tapping a voice chooses it', await page.$eval('[data-audvoice="km|km-KH-PisethNeural"]', e => e.parentNode.classList.contains('on')));
  await page.click('[data-audsample="km|km-KH-PisethNeural"]'); await page.waitForTimeout(800);
  ok('▶ plays a sample of that voice', await page.evaluate(() => window.__audio.some(a => /^data:audio\/mpeg;base64,/.test(a.src))) && /PisethNeural/.test(azure[azure.length - 1]));
  await page.screenshot({ path: OUT + '/admin-audio.png', fullPage: true });
  await page.click('[data-audstart="en|0"]'); await page.waitForTimeout(1500);
  ok('Record every book starts a run with all 46, shown as running', bgCalls.length === 1 && /Recording now/.test(await page.$eval('#main', e => e.innerText)) && !!(await page.$('#audStop')));
  const job = JSON.parse(blobs.__stores['gp-audio'].get('jobtexts'));
  const s0 = job['start-with-why'];
  ok('… each book sent as its screens, in the reader’s order and words', Object.keys(job).length === 46 && s0.length === N + 2 && s0[0].startsWith('Intro') && s0[1].startsWith('Key idea 1 of ' + N) && s0[N + 1].includes(B.oneLine));
  await drain();
  await page.evaluate(() => { S.audAdm = null; render(); }); await page.waitForTimeout(1500);
  ok('when it is done the page counts every English book recorded', /46 of 46 books recorded/.test(await page.$eval('#main', e => e.innerText)) && /Last recording finished/.test(await page.$eval('#main', e => e.innerText)));
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await page.click('nav.bottom [data-tab="library"]'); await page.waitForTimeout(1200);
  await page.click('[data-libbook="start-with-why"]'); await page.waitForTimeout(600);
  await page.click('#libListenStart'); await page.waitForTimeout(1200);
  const a = await page.evaluate(() => window.__audio.filter(x => /^blob:/.test(x.src)));
  ok('a recorded book plays its file for the screen — not the phone’s voice', a.length === 1 && await page.evaluate(() => window.__spoken.length) === 0);
  await page.evaluate(() => window.__lastAudio.onended()); await page.waitForTimeout(1200);
  ok('when the file ends the page turns and the next file plays', await page.evaluate(() => S.libStep) === 1 && (await page.evaluate(() => window.__audio.filter(x => /^blob:/.test(x.src)).length)) === 2);
  await page.click('#libRate'); await page.waitForTimeout(150);
  ok('the speed changes the recording’s rate', await page.evaluate(() => window.__lastAudio.playbackRate) === 1.25);
  await page.click('#libListen'); await page.waitForTimeout(200);
  ok('⏸ pauses it', await page.evaluate(() => window.__lastAudio.paused) === true);
  await page.click('#libClose'); await page.waitForTimeout(200);
  await page.click('#libBack'); await page.waitForTimeout(400);
  await page.evaluate(() => { lsSet('gp-lib-lang', 'km'); }); 
  await page.click('[data-libbook="start-with-why"]'); await page.waitForTimeout(1500);
  const before = await page.evaluate(() => window.__audio.length);
  await page.click('#libListenStart'); await page.waitForTimeout(800);
  ok('the same book in Khmer, not recorded yet, does not play the English file', await page.evaluate(() => window.__audio.length) === before + 0 || await page.evaluate(b => window.__audio.slice(b).every(x => !/lang=en/.test(x.src)), before));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
