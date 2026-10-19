/* QuickBooks (api.js "QuickBooks", quickbooks.js, qbo-sync.js): the Finances office connects
   their QuickBooks company and the Profit and Loss and the A/R Ageing come in by themselves.

   Intuit is a stand-in here (fetch is replaced): its sign-in, its tokens and its reports are
   made up, laid out the way QuickBooks Online's JSON is. Checked: nothing until the keys are
   set; only the office may connect; the state is single-use and tied to its person; the
   tokens never leave the server or land in the backed-up store; the P&L's months and its
   sub-accounts come in the shape an upload has, checked against QuickBooks' own totals; a
   month's cash survives, an uploaded PDF for the month is replaced; the ageing's names
   match staff and each department's Staff Debt ($) follows; leadership sees totals only; a
   token running out is refreshed (and the new one kept), a revoked one says "reconnect"; a
   Location narrows the P&L; disconnecting revokes it and keeps the numbers; the nightly
   run; and the page Intuit sends people back to. All names and figures are made up. */
import { tmpDir, REPO } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('qbo');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const stores={};
export function getStore(o){
  const name=(typeof o==='string') ? o : o.name;
  const mem=stores[name]||(stores[name]=new Map());
  return {
    get: async (k,opt)=>{ if(!mem.has(k)) return null; const v=mem.get(k); return (opt&&opt.type==='text') ? v : JSON.parse(v); },
    set: async (k,v)=>{ mem.set(k, String(v)); },
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
process.env.GP_LEADER_CODE = 'leadercode';
process.env.URL = 'https://example-gp.netlify.app';
delete process.env.QBO_CLIENT_ID; delete process.env.QBO_CLIENT_SECRET; delete process.env.QBO_ENV;
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const cb = await import(TMP + '/quickbooks.js');
const nightly = await import(TMP + '/qbo-sync.js');
blobs.getStore({ name: 'gp-data' }); blobs.getStore({ name: 'gp-qbo' });
const mem = blobs.__stores['gp-data'], qmem = blobs.__stores['gp-qbo'];

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [
  withPin({ id: 'st_fin', name: 'Bopha Keo', username: 'bopha', campus: 'poipet', dept: 'Skills Training', ministry: 'Finances', active: true }),
  withPin({ id: 'st_fin2', name: 'Lina Ros', username: 'lina', campus: 'poipet', dept: 'Skills Training', ministry: 'Finances', active: true }),
  withPin({ id: 'st_cd', name: 'Mark Hill', username: 'mark', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', active: true }),
  withPin({ id: 'st_dara', name: 'Dara Sok', username: 'dara', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', active: true }),
  withPin({ id: 'st_vanna', name: 'Vanna Chan', username: 'vanna', campus: 'poipet', dept: 'Youth Education', ministry: 'Kids Club', active: true })
]);
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json();
}
const doc = () => JSON.parse(mem.get('finance:poipet') || '{}');
const conn = () => JSON.parse(qmem.get('conn:poipet') || 'null');
const entries = () => JSON.parse(mem.get('entries') || '[]');
const debtEntry = (dept) => entries().filter((r) => r.campus === 'poipet' && r.dept === 'Campus Leadership' && r.ministry === dept && r.metric === 'Staff Debt ($)').slice(-1)[0];

import { fakeIntuit, I, today, back, LAST, PREV } from './qbo-fixtures.mjs';
fakeIntuit();
const intuitCalls = () => I.calls.filter((c) => /intuit\.com$/.test(c.url.host));
const stateFrom = (url) => new URL(url).searchParams.get('state');
async function back_(q) {
  const u = new URL('https://example-gp.netlify.app/.netlify/functions/quickbooks');
  Object.keys(q).forEach((k) => u.searchParams.set(k, q[k]));
  const r = await cb.default(new Request(u.href));
  return await r.text();
}

console.log('=== nothing until the keys are set ===');
let r = await call('getFinance', ['bopha', '1234']);
ok('the office is told QuickBooks isn’t set up yet', r.ok && r.qbo && r.qbo.configured === false && r.qbo.connected === false);
r = await call('qboConnect', ['bopha', '1234']);
ok('… and can’t start connecting', !r.ok && r.err === 'not_configured');
ok('the nightly run does nothing', JSON.stringify(await api.runQboSync()) === JSON.stringify({ skipped: 'not_configured' }) && !intuitCalls().length);
process.env.QBO_CLIENT_ID = 'cid-test'; process.env.QBO_CLIENT_SECRET = 'csecret-test';

console.log('=== who may connect ===');
r = await call('qboConnect', ['mark', '1234']);
ok('Campus Leadership can’t connect it', !r.ok && r.err === 'not_authorized');
r = await call('qboConnect', ['dara', '1234']);
ok('nor can ordinary staff', !r.ok && r.err === 'not_authorized');
r = await call('qboConnect', ['bopha', '1234']);
const au = r.ok && new URL(r.url);
ok('the office gets Intuit’s sign-in page', au && au.origin + au.pathname === 'https://appcenter.intuit.com/connect/oauth2' && au.searchParams.get('client_id') === 'cid-test' &&
  au.searchParams.get('scope') === 'com.intuit.quickbooks.accounting' && au.searchParams.get('response_type') === 'code' &&
  au.searchParams.get('redirect_uri') === 'https://example-gp.netlify.app/.netlify/functions/quickbooks' && /^[0-9a-f]{48}$/.test(au.searchParams.get('state')));
ok('… and the secret is nowhere in it', !r.url.includes('csecret'));
const st1 = stateFrom(r.url);

console.log('=== coming back from Intuit ===');
let html = await back_({ code: I.code, state: 'f'.repeat(48), realmId: '4620816365' });
ok('a state we never gave out is turned away', /Try again from the app/.test(html) && !conn());
html = await back_({ error: 'access_denied', state: st1 });
ok('saying no at Intuit connects nothing', /Not connected/.test(html) && !conn());
html = await back_({ code: I.code, state: st1, realmId: '4620816365' });
ok('… and that state can’t be used again', /Try again from the app/.test(html) && !conn());
r = await call('qboConnect', ['bopha', '1234']);
const st2 = stateFrom(r.url);
html = await back_({ code: '<script>alert(1)</script>', state: st2, realmId: '4620816365', error: '' });
ok('a bad code fails, and nothing from the request is in the page', /Couldn’t connect/.test(html) && !html.includes('<script>alert') && !conn());
r = await call('qboConnect', ['bopha', '1234']);
html = await back_({ code: I.code, state: stateFrom(r.url), realmId: '4620816365' });
ok('the right code connects it, and the numbers come in at once', /QuickBooks is connected/.test(html) && /every night/.test(html), html.match(/<h1>(.*?)<\/h1>/)[1]);
const tokenCall = intuitCalls().find((c) => c.url.href.includes('tokens/bearer') && new URLSearchParams(c.opts.body).get('grant_type') === 'authorization_code' && new URLSearchParams(c.opts.body).get('code') === I.code);
ok('the code was traded with the app’s keys, in the header (not the URL)', tokenCall && !tokenCall.url.href.includes('cid-test') && tokenCall.opts.method === 'POST');
const plCall = intuitCalls().find((c) => c.url.pathname.endsWith('/reports/ProfitAndLoss'));
ok('the P&L asked for: twelve finished months, a column each, cash basis', plCall && plCall.url.searchParams.get('summarize_column_by') === 'Month' && plCall.url.searchParams.get('accounting_method') === 'Cash' &&
  plCall.url.searchParams.get('start_date') === back(12) + '-01' && plCall.url.searchParams.get('end_date').slice(0, 7) === LAST && !plCall.url.searchParams.get('department'), plCall && plCall.url.search);
ok('the connection is stored where the backup doesn’t go, with the company’s name', conn() && conn().company === 'Made-up Mission Org' && conn().realmId === '4620816365' && conn().by === 'st_fin');
ok('no token is in the app’s own store', ![...mem.values()].some((v) => /AT-secret|RT-secret/.test(v)));

console.log('=== the P&L, as an upload has it ===');
let d = doc();
ok('the months QuickBooks has numbers for, and no others', Object.keys(d.pl).sort().join() === [PREV, LAST].join(), Object.keys(d.pl).join());
const L = d.pl[LAST].lines, line = (code) => L.find((l) => l.code === code);
ok('marked as from QuickBooks, with no PDF', d.pl[LAST].src === 'qbo' && !d.pl[LAST].fileId);
ok('a sub-account sits under its heading account', line('45100').parent === '45000' && line('54000').parent === '53000' && !line('41000').parent);
ok('a heading account keeps its own amount (the row of its own name)', d.pl[PREV].lines.find((l) => l.code === '45000').amt === 100 && line('45000').amt === null);
ok('Cost of Goods Sold counts as going out, other income as coming in', line('51000').sec === 'exp' && line('49000').sec === 'oth');
r = await call('getFinance', ['bopha', '1234']);
ok('the office sees it connected, last brought in today', r.qbo.connected && r.qbo.company === 'Made-up Mission Org' && r.qbo.lastSync.slice(0, 10) === new Date().toISOString().slice(0, 10) && r.qbo.by === 'Bopha Keo' && r.qbo.months === 2 && !r.qbo.warn.length);
ok('… and its Locations to choose from', r.qbo.lists.department.map((x) => x.name).join() === 'Poipet,Siem Reap');
ok('no token ever reaches a phone', !/AT-secret|RT-secret|realm|4620816365/.test(JSON.stringify(r)));

console.log('=== staff debt from the ageing ===');
ok('every name owing, the ageing buckets as QuickBooks has them', d.debt.src === 'qbo' && d.debt.asOf === today && d.debt.cols.join('|') === 'Current|1 - 30|31 - 60|61 - 90|91 and over' && d.debt.rows.length === 3);
const row = (n) => d.debt.rows.find((x) => x.name === n);
ok('each matched to staff (a sub-customer row too)', row('Dara Sok').staffId === 'st_dara' && row('Vanna Chan').staffId === 'st_vanna' && row('Vanna Chan').total === 100 && !row('Someone Gone').staffId);
ok('each department’s Staff Debt ($) follows', Number(debtEntry('Community Service').value) === 30 && Number(debtEntry('Youth Education').value) === 100);
r = await call('getFinance', ['mark', '1234']);
ok('leadership: totals only, and that it’s from QuickBooks', r.ok && r.debt.total === 160 && !r.debtRows && !/Dara|Vanna|Someone/.test(JSON.stringify(r)) && r.qbo.connected && r.qbo.lastSync && !r.qbo.company && !r.qbo.lists);

console.log('=== bringing it in again ===');
await call('finSetCash', ['bopha', '1234', LAST, 5000]);
r = await call('qboSyncNow', ['bopha', '1234']);
d = doc();
ok('brought in again on demand', r.ok && r.synced && d.pl[LAST].src === 'qbo');
ok('the cash typed for the month stays', d.pl[LAST].cash === 5000);
ok('the ageing’s history keeps one point a month, not one a night', d.debtHist.filter((h) => h.asOf.slice(0, 7) === today.slice(0, 7) && h.src === 'qbo').length === 1);
r = await call('qboSyncNow', ['mark', '1234']);
ok('leadership can’t bring it in', !r.ok && r.err === 'not_authorized');

console.log('=== tokens running out ===');
let c = conn(); c.accessExp = Date.now() + 1000; qmem.set('conn:poipet', JSON.stringify(c));
const before = I.n;
r = await call('qboSyncNow', ['bopha', '1234']);
ok('an access token near its end is refreshed first', r.synced && I.n === before + 1 && conn().access === 'AT-secret-' + I.n);
ok('… and the new refresh token is kept', conn().refresh === 'RT-secret-' + I.n);
I.fail401 = 1;
r = await call('qboSyncNow', ['bopha', '1234']);
ok('one turned down early is refreshed and tried again', r.synced && I.n === before + 2);
I.refreshBad = true; I.fail401 = 1;
r = await call('qboSyncNow', ['bopha', '1234']);
ok('a connection QuickBooks has ended says to reconnect', !r.synced && r.syncErr === 'reconnect' && r.qbo.broken && r.qbo.lastErr === 'reconnect');
ok('… and the numbers already in stay', doc().pl[LAST] && doc().debt);
I.refreshBad = false;
r = await call('qboConnect', ['bopha', '1234']);
html = await back_({ code: I.code, state: stateFrom(r.url), realmId: '4620816365' });
ok('connecting again mends it, and keeps what was set', /QuickBooks is connected/.test(html) && !conn().broken && !conn().lastErr);

console.log('=== a campus’s own Location ===');
r = await call('qboSetFilter', ['bopha', '1234', 'department', '99']);
ok('a Location QuickBooks doesn’t have is refused', !r.ok && r.err === 'not_found');
r = await call('qboSetFilter', ['bopha', '1234', 'department', '7']);
const pl2 = intuitCalls().filter((x) => x.url.pathname.endsWith('/reports/ProfitAndLoss')).slice(-1)[0];
ok('choosing one asks QuickBooks for just that Location', r.ok && r.synced && pl2.url.searchParams.get('department') === '7' && r.qbo.filter.name === 'Poipet');
ok('… and the P&L follows at once', doc().pl[LAST].lines.find((l) => l.code === '50300').amt === 600);
r = await call('qboSetFilter', ['bopha', '1234', '', '']);
ok('the whole company again', r.ok && !r.qbo.filter && doc().pl[LAST].lines.find((l) => l.code === '50300').amt === 1200);

console.log('=== a report that doesn’t add up ===');
I.plMismatch = true;
r = await call('qboSyncNow', ['bopha', '1234']);
ok('a section whose lines miss QuickBooks’ own total is shown to the office', r.synced && r.qbo.warn.some((w) => w.month === PREV && w.sec === 'inc' && w.theirs === 9999));
I.plMismatch = false;
await call('qboSyncNow', ['bopha', '1234']);

console.log('=== an uploaded month ===');
const pdf = { name: 'pl.pdf', base64: Buffer.from('%PDF-1.4 a made-up profit and loss report, for the test').toString('base64') };
r = await call('finSave', ['bopha', '1234', 'pl', { months: { [LAST]: { cash: null, lines: [{ sec: 'inc', code: '41000', name: 'Donation', parent: '', amt: 1 }] } } }, pdf]);
const fid = doc().pl[LAST].fileId;
ok('an upload still works, and replaces QuickBooks’ month', r.ok && fid && doc().pl[LAST].src === '' && doc().pl[LAST].cash === 5000, JSON.stringify(r.err || doc().pl[LAST]).slice(0, 200));
await call('qboSyncNow', ['bopha', '1234']);
ok('the next time QuickBooks brings it in, its PDF goes', doc().pl[LAST].src === 'qbo' && !doc().pl[LAST].fileId && !mem.has('finfile:' + fid));

console.log('=== every night ===');
const n0 = intuitCalls().length;
let out = await api.runQboSync();
ok('the nightly run brings in each connected campus, and only those', out.poipet && out.poipet.ok && out.poipet.months === 2 && !out.siemreap && intuitCalls().length > n0, JSON.stringify(out));
ok('… as the person who connected it', doc().pl[LAST].by === 'st_fin');
ok('qbo-sync.js runs at 04:15 Phnom Penh time', nightly.config.schedule === '15 21 * * *');

console.log('=== the one who connected it leaves the office ===');
r = await call('qboConnect', ['lina', '1234']);
const st3 = stateFrom(r.url);
const staff = JSON.parse(mem.get('staff')); staff.find((s) => s.id === 'st_fin2').ministry = 'Kitchen'; mem.set('staff', JSON.stringify(staff));
html = await back_({ code: I.code, state: st3, realmId: '4620816365' });
ok('their half-finished connection is refused', /Couldn’t connect/.test(html));

console.log('=== disconnecting ===');
const rt = conn().refresh;
r = await call('qboDisconnect', ['bopha', '1234']);
ok('Intuit is told to forget the token', I.revoked.includes(rt));
ok('the connection is gone, the numbers stay', r.ok && !conn() && !r.qbo.connected && doc().pl[LAST] && doc().debt);
out = await api.runQboSync();
ok('and nothing runs at night', JSON.stringify(out) === '{}');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
