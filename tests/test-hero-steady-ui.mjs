/* My Home's card keeps its size while it loads (Oct 2026, Uriah: "when you log in the
   card on My Home is smaller and then gets big"). The base figures at its foot used to
   appear only once the boot landed, and every redraw counted the numbers up from 0
   again; now the strip is there from the start and a figure only animates when it
   changes. */
// Sign in (by hand, or remembered), then sample the My Home card's height every 100ms.
import { PUBLIC, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const PUB=PUBLIC;
const T={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png'};
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
ok('no page errors', errs.length===0, errs.join(' | '));
console.log('\n'+pass+' passed, '+fail+' failed');
await b.close(); srv.close();
process.exit(fail?1:0);
