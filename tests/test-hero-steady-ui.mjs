/* My Home's card keeps its size while it loads (Oct 2026, Uriah: "when you log in the
   card on My Home is smaller and then gets big"). The base figures at its foot used to
   appear only once the boot landed, and every redraw counted the numbers up from 0
   again; now the strip is there from the start and a figure only animates when it
   changes. Then ("it still loads small and then gets bigger"): someone with a chore or
   cooking this week got that line in the card only when a second request answered —
   the week's schedules come with the boot now — and the fonts came from Google after
   the page had drawn, so the headings grew when Koulen landed; they are the app's own
   now (public/fonts/, preloaded, kept offline). */
// Sign in (by hand, or remembered), then sample the My Home card's height every 100ms.
import { PUBLIC, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const PUB=PUBLIC;
const T={'.html':'text/html','.js':'text/javascript', '.css': 'text/css','.json':'application/json','.png':'image/png'};
const srv=http.createServer((q,s)=>{ const f=path.join(PUB,decodeURIComponent(q.url.split('?')[0])); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){ s.writeHead(404); s.end(); return; }
  s.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'}); s.end(fs.readFileSync(f)); }).listen(0);
const BASE='http://127.0.0.1:'+srv.address().port;
const ME={ id:'st1', name:'Dara Pich', username:'dara', campus:'siemreap', dept:'Community Service', ministry:'Cafe', role:'', photo:'', staffType:'campus', country:'Cambodia', leads:[], ministries:[] };
const ROSTER=[ME].concat([1,2,3,4,5].map(i=>({ ...ME, id:'s'+i, name:'P'+i, username:'p'+i })));
const today=new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
const BOOT={ ok:true, staff:ME, profile:{}, roster:ROSTER, logs:[{date:today, habits:{quietTime:true}}], habits:null, mentees:[], mentorRequests:[], goals:[], checkins:[],
  trips:{ ok:true, trips:[], totals:{}, reasons:{work:['x'],personal:['y']}, hasMentor:false }, tripRequests:[], ministry:null,
  base:{ leader:false, entries:{ siemreap:{} }, okrs:[], survey:[] } };
const b=await chromium.launch({ executablePath:CHROMIUM });
const p=await b.newPage({ viewport:{ width:390, height:844 } });
await p.route('**fonts.g**', r=>r.abort());
await p.route('**/.netlify/functions/api', async r=>{ const q=JSON.parse(r.request().postData()||'{}'); let o={ok:true}, wait=0;
  if(q.fn==='staffLogin'){ o={ ok:true, staff:ME, profile:{} }; wait=300; }
  else if(q.fn==='getMyBoot'){ o=BOOT; wait=1200; }
  else if(q.fn==='getMySchedules'){ o={ ok:true, now:{} }; wait=600; }
  else if(q.fn==='teamRoster') o=ROSTER;
  else if(q.fn==='getData') o=BOOT.base;
  await new Promise(x=>setTimeout(x,wait)); r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) }); });
let pass=0, fail=0;
const ok=(name, cond, extra)=>{ if(cond){ pass++; console.log('ok   '+name); } else { fail++; console.log('FAIL '+name+(extra!==undefined?'  → '+extra:'')); } };
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto(BASE+'/teams.html');
await p.waitForSelector('#loginBtn'); await p.fill('#li_user','dara'); await p.fill('#li_pin','1234'); await p.click('#loginBtn');
await p.waitForSelector('.hero', { timeout:10000 });
const heights=[];
for(let i=0;i<30;i++){ heights.push(await p.evaluate(()=>{ const h=document.querySelector('.hero'); return h ? Math.round(h.offsetHeight) : 0; })); await p.waitForTimeout(100); }
ok('after signing in, My Home\'s card is one size from the first moment until everything has loaded', new Set(heights).size===1, heights.join(','));
ok('… its base figures are there from the start, a dash until they land', await p.evaluate(()=>!!document.querySelector('.hero .homeBase')));
/* a redraw with nothing new must not count the numbers up again */
await p.evaluate(()=>render()); 
ok('a redraw with the same figures leaves them still — no count-up, no pop', await p.evaluate(()=>[].every.call(document.querySelectorAll('.hero [data-count]'), function(el){ return el.style.animationName==='none' && el.textContent===String(Number(el.getAttribute('data-count')).toLocaleString()); })));

/* someone with a chore this week, the fonts let through (they are the app's own now) */
const fontReqs=[];
const CHORES={ layout:'list', sections:[{ title:'Inside', rows:[{ place:'Kitchen floor', duty:'Sweep and mop', people:['Dara Pich','P1'] }] }] };
const SCHED={ ok:true, week:'', now:{ chores:CHORES, kitchen:null }, next:{ chores:null, kitchen:null }, nextWeek:'', canEdit:{} };
const ctx2=await b.newContext({ viewport:{ width:390, height:844 } }); const p2=await ctx2.newPage();
p2.on('pageerror', e=>errs.push(String(e)));
p2.on('request', r=>{ if(/fonts\.(googleapis|gstatic)|\/fonts\//.test(r.url())) fontReqs.push(r.url()); });
let schedAsked=0;
await p2.route('**/.netlify/functions/api', async r=>{ const q=JSON.parse(r.request().postData()||'{}'); let o={ok:true}, wait=0;
  const d0=new Date(); d0.setHours(12,0,0,0); d0.setDate(d0.getDate()-d0.getDay());   // duty.js's dutyWeekOf: the Sunday
  SCHED.week=d0.getFullYear()+'-'+('0'+(d0.getMonth()+1)).slice(-2)+'-'+('0'+d0.getDate()).slice(-2);
  if(q.fn==='staffLogin'){ o={ ok:true, staff:ME, profile:{} }; wait=300; }
  else if(q.fn==='getMyBoot'){ o=Object.assign({}, BOOT, { schedules:SCHED }); wait=1200; }
  else if(q.fn==='getMySchedules'){ schedAsked++; o=SCHED; wait=900; }
  else if(q.fn==='teamRoster') o=ROSTER;
  else if(q.fn==='getData') o=BOOT.base;
  await new Promise(x=>setTimeout(x,wait)); r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) }); });
await p2.goto(BASE+'/teams.html');
await p2.waitForSelector('#loginBtn'); await p2.fill('#li_user','dara'); await p2.fill('#li_pin','1234'); await p2.click('#loginBtn');
await p2.waitForSelector('.hero', { timeout:10000 });
const sample=async function(page){ const hs=[]; for(let i=0;i<30;i++){ hs.push(await page.evaluate(()=>{ const h=document.querySelector('.hero'); return h ? Math.round(h.offsetHeight)+(h.querySelector('.heroSched')?'s':'') : 0; })); await page.waitForTimeout(100); } return hs; };
const hs2=await sample(p2);
ok('with a chore this week, the card is drawn with it — one size from the first moment', new Set(hs2).size===1 && /s$/.test(hs2[0]), hs2.join(','));
ok('… because the week\'s schedules come with the boot, not a second request', schedAsked===0, String(schedAsked));
await p2.reload(); await p2.waitForSelector('.hero', { timeout:10000 });
const hs3=await sample(p2);
ok('… and again when the app opens on the kept copy', new Set(hs3).size===1 && /s$/.test(hs3[0]), hs3.join(','));
ok('the fonts are the app\'s own — nothing asked of Google Fonts', fontReqs.length>0 && fontReqs.every(u=>/\/fonts\/[a-z-]+\.woff2$/.test(u)), fontReqs.slice(0,4).join(' | '));
ok('… and they are in before the card is drawn', await p2.evaluate(()=>document.fonts.check('16px "Koulen"') && document.fonts.check('16px "Kantumruy Pro"')));
const sw=fs.readFileSync(path.join(PUB,'sw.js'),'utf8');
ok('… and kept by the service worker for offline', ['koulen-latin','koulen-khmer','kantumruy-latin','kantumruy-khmer'].every(f=>sw.indexOf('fonts/'+f+'.woff2')>-1));
await ctx2.close();
ok('no page errors', errs.length===0, errs.join(' | '));
console.log('\n'+pass+' passed, '+fail+' failed');
await b.close(); srv.close();
process.exit(fail?1:0);
