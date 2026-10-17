/* My YWAM GP — teams.html, part 1 of 10: state, the page frame and render(), helpers, the Base tab.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
if(typeof getDepartments !== 'function' || typeof CAMPUSES === 'undefined'){
  window.gpBootFailed('taxonomy.js did not load');
  // Throwing stops the rest of this script, so nothing paints over the message.
  throw new Error('taxonomy.js missing');
}
if(typeof gpRollup !== 'function'){
  window.gpBootFailed('rollup.js did not load');
  throw new Error('rollup.js missing');
}
/* CAMPUSES, getDepartments(), modeOf() and the metric lists come from
   taxonomy.js — the same file the dashboard uses, so a staff member's KPI
   card always matches what leadership sees. */
function deptsFor(campusId){ return Object.keys(getDepartments(campusId||'poipet')); }
function ministriesFor(campusId, dept){
  var d = getDepartments(campusId||'poipet')[dept];
  return d ? Object.keys(d) : [];
}
function metricsFor(campusId, dept, ministry){
  var d = getDepartments(campusId||'poipet')[dept];
  var list = (d && d[ministry]) ? d[ministry] : [];
  // Staff never see or edit the leadership-only financial metrics; the server
  // enforces this too, this just keeps them off the screen.
  return list.filter(function(m){ return SENSITIVE.indexOf(m) === -1; });
}


var S = {
  auth:{user:'', pin:''}, me:null, profile:null,
  logs:[], roster:[], mentees:[], mentorRequests:[], view:'week', base:null,
  regMode:false, mentee:null, menteeLogs:[], menteeGoals:[], busy:false,
  goals:[], checkins:[], menteeCheckins:[], goalsWeek:null, goalEditIdx:null, ministry:null, kpiDraft:{}, kpiWeekDraft:{}, kpiWeek:null, weekDraft:{},
  kpiMonthDraft:{}, kpiQuarterDraft:{},
  habits:null, habitEdit:false, menteeHabits:[], menteeMinistry:null, menteeTrips:null, menteeSmart:[],
  kpiAll:false, kpiPick:false, person:null, habitMore:false,
  metricEditTarget:null, metricNewName:'', metricNewType:'sum', metricRename:null, metricRenameText:'',
  /* My Ministry: which of its two tabs is showing, whether the metric form
     is unfolded for the week on screen, and the person's own four numbers. */
  mmTab:'ministry', kpiInputOpen:false, mmDashAll:false, personal:null, personalDraft:{}, mmPeriod:'quarter',
  lead:null, leadErr:'', leadForm:null, leadTab:'okrs', leadShown:false,
  sched:null, schedError:'', schedData:null, schedEdit:false, schedPick:null,
  hosp:null, hospLoading:false, hospError:'', hospTab:'dash', hospForm:null, hospRoom:null, hospBld:null,
  teamTrips:{}, teamLoading:{}, teamError:{}, teamPeriod:'ytd', teamYear:null, teamQ:null, teamMonth:null, teamForm:null,
  /* Team tab: the directory or the org chart; the chart is cached per
     campus|year|quarter, and an admin's unsaved edits live in structDraft. */
  teamMode:'dir', structYear:null, structQ:null, structCache:{}, structLoading:{}, structError:{},
  structEdit:false, structEditNode:null, structDraft:null, structAddTitle:'', structAddParent:'',
  adminMetricCampus:'', adminMetricDept:'', adminMetricMinistry:'',
  trips:null, tripRequests:[], leaveDraft:null, oneOnOnes:[], broadcasts:[],
  baseDept:null, okrForm:false, okrEditId:null, okrPaste:false, okrPasteParsed:null, okrPasteText:'', teamCampus:null,
  healthWeek:null, weekForm:null, weekDraftFor:null, weekJustSaved:null,
  healthScope:'week', healthQuarter:null, healthYear:null, healthMonth:null, baseByYear:{}, srScope:'quarter', srQuarter:null, srMonth:null, srOpenQ:null,
  baseAcc:{salv:false, ld:false, cs:false, out:false, church:false, gospel:false, media:false, baseKpi:false, health:false, explorer:false},
  baseHealthPeriod:'week',
  hx:null,
  dbAcc:{kpiDay:false, kpiWeek:false},
  smartGoals:[], smartYear:null, smartCategory:'Faith', smartDraft:null,
  dbCustomize:false,
  menuOpen:false, bellOpen:false,
  /* A single "cleared before" cutoff (device-local, like gp-theme), not a
     per-item read flag — Clear on the bell hides everything up to now.
     Nothing pending is lost: a cleared leave/1-on-1 request still has its own
     home (Leave Request, Mentorship, Team) — this only tidies the FYI feed. */
  notifClearedAt: lsGet('gp-notif-cleared') || '',
  /* Ministries a department overseer logs on behalf of, keyed by ministry name
     so more than one can sit on the same page without their state colliding. */
  oversee:{}, ovWeek:{}, ovWeekDraft:{}, ovAcc:{}, ovLoading:{}, ovError:{}, ovDeptOf:{}, ovInputOpen:{},
  // Admin screen — S.me.isAdmin only. adminStaff loads lazily on first visit.
  adminStaff:null, adminLoading:false, adminAcc:{}, adminEditId:null, adminEditDraft:null, adminPinDraft:{}, adminCode:'', adminCampusTab:null, adminSub:null, adminPersonId:null, adminSearch:'', adminMentorCampus:null, adminPortalCampus:null, adminLeave:null, adminLeaveLoading:false, adminLeaveError:'', adminLeaveCampus:null, adminLeaveYear:null, adminLeavePast:false, broadcastDraft:'',
  hrStaff:null, hrLoading:false, hrError:'', hrSub:'home', hrPersonId:null, hrSearch:'', hrCampusTab:null, hrShowArchived:false, hrContractForm:null, hrArchiveDraft:null, hrDue:null, hrFollowUps:null, hrTab:'staff',
  cands:null, candsLoading:false, candsError:'', candStage:'', candType:'', candSearch:'', candShowArchived:false, candForm:null, candPersonId:null, candNoteDraft:'',
  adminOkrAcc:{},
  /* The "jump to any ministry" picker on My Ministry — admin can pick any
     department/ministry on their campus; everyone else's options resolve to
     just the one they work in (see myMinistryBrowseHtml_). */
  mmBrowseDept:'', mmBrowseMinistry:''
};

var SMART_CATEGORIES = ['Faith','Health','Finance','Language','Skills','Fun'];

var HABIT_LIBRARY = [
  {id:'bible',       label:'Bible reading',   icon:'📖'},
  {id:'quietTime',   label:'Quiet time / prayer', icon:'🙏'},
  {id:'workout',     label:'Workout',         icon:'💪'},
  {id:'ateWell',     label:'Ate well',        icon:'🥗'},
  {id:'sleptWell',   label:'Slept well',      icon:'😴'},
  {id:'language',    label:'Language study',  icon:'🗣️'},
  {id:'gratitude',   label:'Gratitude',       icon:'✨'},
  {id:'oneOnOne',    label:'One-on-one',      icon:'☕'},
  {id:'sharedFaith', label:'Shared my faith', icon:'💬'},
  {id:'sabbath',     label:'Sabbath / rest',  icon:'🌿'}
];
var MAX_HABITS=8;
/* Takes a habit row or just its id; a habit of your own carries its label and emoji. */
function habitMeta(hb){
  var id = (hb && typeof hb==='object') ? hb.id : hb;
  if(hb && typeof hb==='object' && hb.label) return {id:id, label:hb.label, icon:hb.icon||'⭐', custom:true};
  for(var i=0;i<HABIT_LIBRARY.length;i++) if(HABIT_LIBRARY[i].id===id) return HABIT_LIBRARY[i];
  return {id:id,label:id,icon:'•'};
}
function myHabits(){
  return (S.habits && S.habits.length) ? S.habits
    : [{id:'bible',mentorVisible:true},{id:'quietTime',mentorVisible:true},{id:'workout',mentorVisible:true}];
}

/* ---------- week helpers (must match isoWeek_ / weekYear_ in netlify/functions/api.js) ----------
   Week 1 of a year is the Monday–Sunday week that holds 1 January, so the last
   days of December can already be next year's week 1: Monday 28 – Thursday 31
   December 2026 are week 1 of 2027. weekYearOf says which year a date's week
   belongs to, and anything that pairs a year with a week number uses it rather
   than getFullYear(). When next year's 1 January is a Monday (2023, 2029) the
   last seven days of December belong to no week 1 and still clamp onto week 52
   of their own year — rare, and week 53 exists nowhere in the app.
   Days are counted from the date's own year/month/day, so a daylight-saving
   change on a test machine cannot move midnight into the week before. */
function dayNoOf_(d){ return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())/86400000); }
function mondayOfW1No_(y){ var jan1=new Date(y,0,1); return dayNoOf_(jan1)-((jan1.getDay()+6)%7); }
function weekYearOf(d){ var y=d.getFullYear(); return dayNoOf_(d)>=mondayOfW1No_(y+1) ? y+1 : y; }
function isoWeekOf(d){
  return Math.max(1, Math.min(52, Math.floor((dayNoOf_(d)-mondayOfW1No_(weekYearOf(d)))/7)+1));
}
function thisWeek(){ return isoWeekOf(new Date()); }
function thisWeekYear(){ return weekYearOf(new Date()); }
/* Today, or — on the days that are already next year's week 1 — 1 January of
   that year: the date the "this month" and "this quarter" defaults are read
   from, so they name the same month and quarter as thisWeek() does. */
function weekYearToday_(){ var d=new Date(), y=weekYearOf(d); return y>d.getFullYear() ? new Date(y,0,1) : d; }
/* A monthly/quarterly-cadence metric still lives in the weekly-keyed
   `entries` store — it's just always read and written under the ONE week
   that contains the period's first day, so repeated saves within the same
   month/quarter land on the same cell instead of spreading across several
   (which would double-count on any sum roll-up). No back-navigation to a
   past period yet — this is "log it whenever this month/quarter", not a
   full picker. */
function monthAnchorWeek_(){
  var d=weekYearToday_();
  return isoWeekOf(new Date(d.getFullYear(), d.getMonth(), 1));
}
function quarterAnchorWeek_(){
  var d=weekYearToday_();
  return isoWeekOf(new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3, 1));
}
function goalsViewWeek(){ return S.goalsWeek==null ? thisWeek() : S.goalsWeek; }
function kpiViewWeek(){ return S.kpiWeek==null ? thisWeek() : S.kpiWeek; }
/* Same idea as kpiViewWeek, but one week pointer per oversee-ministry — so
   backfilling Cafe's week 30 doesn't move what Outreach Teams' card is showing. */
function ovWeekFor_(min){ return (S.ovWeek[min]==null) ? thisWeek() : S.ovWeek[min]; }
/* A "Campus Leadership" profile whose ministry is itself a real department name
   means that person oversees every ministry under it — see getDepartments()
   in taxonomy.js. Returns that department name, or null for everyone else. */
function myOversightDept_(){ return oversightDeptOf_(S.me); }
/* Same check as myOversightDept_, generalized to any staff record — used so
   a teammate's own OKR view can also add the department they lead, not just
   S.me's. */
function oversightDeptOf_(person){
  if(!person || person.dept!=='Campus Leadership') return null;
  var deps=getDepartments(person.campus);
  return deps[person.ministry] ? person.ministry : null;
}

/* Same Monday-anchored math as isoWeekOf, run backwards: a week NUMBER back
   to the calendar date its Monday actually falls on, so the Weekly Goals
   header can say "Aug 17 – Aug 23" instead of a bare week number. `year` is
   the week year and defaults to this one, so week 1 looked at on 30 December
   2026 is 28 Dec 2026 – 3 Jan 2027, not the January just gone. */
var MONTH_ABBR=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function mondayOfWeek_(week, year){
  var y=year ? Number(year) : thisWeekYear();
  var jan1=new Date(y,0,1);
  var monW1=new Date(y,0,1-((jan1.getDay()+6)%7));
  var d=new Date(monW1);
  d.setDate(d.getDate()+(Number(week)-1)*7);
  return d;
}
function weekRange_(week, year){
  var mon=mondayOfWeek_(week, year);
  var sun=new Date(mon); sun.setDate(sun.getDate()+6);
  var a=MONTH_ABBR[mon.getMonth()]+' '+mon.getDate();
  var b=sun.getMonth()===mon.getMonth() ? String(sun.getDate()) : MONTH_ABBR[sun.getMonth()]+' '+sun.getDate();
  return { short:a+' – '+b, year:sun.getFullYear() };
}
function weekRangeLabel_(week, year){
  var r=weekRange_(week, year);
  return gpT('Week of {range}, {year}',{range:r.short, year:r.year});
}
/* A compact "Aug 17 – 23" for secondary labels (the ministry KPI card),
   where the full "Week of …, 2026" sentence would be too long. */
function weekRangeShort_(week, year){ return weekRange_(week, year).short; }
function isoDateOf_(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
/* The Monday and Sunday of a given week, as YYYY-MM-DD — used to pick which
   date a backfilled ministry number should land on when you're not looking
   at the current week. */
function weekBounds_(week, year){
  var mon=mondayOfWeek_(week, year), sun=new Date(mon); sun.setDate(sun.getDate()+6);
  return { from:isoDateOf_(mon), to:isoDateOf_(sun) };
}
function kpiEntryDate_(week){
  return Number(week)===Number(thisWeek()) ? todayStr() : weekBounds_(week).to;
}
function goalsForWeek(week){
  for(var i=0;i<S.goals.length;i++) if(Number(S.goals[i].week)===Number(week)) return S.goals[i];
  return null;
}
function checkinForWeek(week){
  for(var i=0;i<S.checkins.length;i++) if(Number(S.checkins[i].week)===Number(week)) return S.checkins[i];
  return null;
}

/* ---------- language ----------
   Same contract as the dashboard: t() looks the English up in the reviewed
   Khmer dictionary and falls back to the English when there's no entry, so a
   missing translation degrades to English rather than breaking a page.
   Khmer is the first language of most people using this page every day, so a
   string added here without a dictionary entry is a gap, not a finished job. */
/* localStorage is not always there to be written. With storage blocked, setItem
   throws rather than quietly doing nothing — and afterLogin() used to write the
   session before touching anything else, so a login just silently did nothing at
   all. Not saving the session is a bad session; not logging in is a bad app. */
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }

var LANG = (function(){ return lsGet('gp-lang') || 'en'; })();
function t(s){ return LANG==='km' ? (BUILTIN_KM[s] || s) : s; }
/* A bottom-bar tab is 64-86px wide: where the full Khmer is too long for it, a
   shorter one is kept under 'Tab: <English>' in km.js (e.g. My Ministry →
   ការបម្រើ). English and every other place keep the full label. */
function navLabel_(s){ return (LANG==='km' && BUILTIN_KM['Tab: '+s]) || t(s); }
function toggleLang(){
  LANG = LANG==='km' ? 'en' : 'km';
  lsSet('gp-lang', LANG);
  render();
}

/* ---------- helpers ---------- */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function todayStr(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function initials(name){ return String(name||'?').trim().split(/\s+/).map(function(w){return w[0];}).slice(0,2).join('').toUpperCase(); }
function campusName(id){ for(var i=0;i<CAMPUSES.length;i++) if(CAMPUSES[i].id===id) return CAMPUSES[i].name; return id; }
// campusName() already reads "YWAM Poipet" — for a label that supplies its
// own "YWAM" prefix (e.g. "YWAM {campus} Ministries"), this is the part after it.
function campusShort(id){ for(var i=0;i<CAMPUSES.length;i++) if(CAMPUSES[i].id===id) return CAMPUSES[i].short; return id; }
function nameOf(id){ for(var i=0;i<S.roster.length;i++) if(S.roster[i].id===id) return S.roster[i].name; return '—'; }
function personOf(id){ for(var i=0;i<S.roster.length;i++) if(S.roster[i].id===id) return S.roster[i]; return null; }

function avatarHtml(person, cls){
  cls = cls||'';
  /* Someone with no photo but a shared personality type shows their type's
     character rather than initials — see personality.js. A photo always wins:
     a real face is better than any drawing of one. */
  if(person && !person.photo && person.avatar && typeof gpPAvatar==='function'){
    var pav = gpPAvatar(person.avatar.type, person.avatar.sex, 96, true);
    if(pav) return '<div class="avatar pav '+cls+'">'+pav+'</div>';
  }
  if(person && person.photo) return '<img class="avatar '+cls+'" src="'+esc(person.photo)+'" alt="" onerror="this.outerHTML=\'<div class=\\\'avatar '+cls+' ph\\\'>'+esc(initials(person.name))+'</div>\'">';
  return '<div class="avatar '+cls+' ph">'+esc(initials(person?person.name:'')) +'</div>';
}

function showMsg(t){
  var m=document.getElementById('msg'); m.textContent=t; m.classList.add('show');
  clearTimeout(m._t); m._t=setTimeout(function(){ m.classList.remove('show'); }, 2200);
}

/* A request that never answers used to leave S.busy true forever, which killed
   every save button on the page until somebody thought to reload. fetch() has no
   timeout of its own, so this gives it one. */
var REQUEST_TIMEOUT_MS = 20000;

/* onErr is optional. Without it a failure does what it always did — say so and
   release the lock. With it, the caller owns the failure (the habit tiles use
   this to put back a toggle the server never accepted). */
function run(fn, args, onOk, onErr){
  /* While the page shows the copy kept from last time (S.bootStale), every call
     but the boot itself waits for the fresh boot: a save is then made against
     today's data, not the copy, and a read answers with what is true now. They
     go out in order the moment it lands (gpBootFresh_), or, if it fails, fall
     to the offline handling they already have. */
  if(S.bootStale && fn!=='getMyBoot'){ _gpHeld.push([fn, args, onOk, onErr]); return; }
  var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
  var settled = false;
  var timer = setTimeout(function(){ if(!settled && ctl) ctl.abort(); }, REQUEST_TIMEOUT_MS);
  function done(){ settled = true; clearTimeout(timer); }
  fetch('/.netlify/functions/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn: fn, args: args }),
    signal: ctl ? ctl.signal : undefined
  }).then(function(res){
    if(!res.ok){
      /* The function answers a crash with {ok:false, error:"…"} and a 500.
         Carry that text along: "Connection problem" on its own hides what
         actually went wrong, and the message is what lets it be fixed. */
      return res.text().then(function(txt){
        var msg='HTTP '+res.status;
        try { var j=JSON.parse(txt); if(j && j.error) msg+=' — '+j.error; } catch(e2){}
        throw new Error(msg);
      });
    }
    return res.json();
  }).then(function(d){ done(); return onOk ? onOk(d) : d; })
    .catch(function(e){
      done();
      if(onErr){ onErr(e); return; }
      showMsg(t('Connection problem — try again.')+(e && e.message && /HTTP/.test(e.message) ? ' ('+e.message+')' : '')); S.busy=false; render();
    });
}

/* ---- offline queue: a save on a bad connection is not lost ----
   Weekly Goals and the weekly health check-in both write a full snapshot
   for one week, not an incremental change, so "queue the latest attempt"
   is always correct — a second offline edit to the same week simply
   replaces the first, never stacks. That's what `key` buys: one pending
   write per key, last one wins.

   Deliberately narrow to these two for now — every other save in the app
   still just fails on a bad connection like it always did. Widening this
   to more of them is a question of picking the next one, not rebuilding
   the mechanism. */
var GP_QUEUE_KEY = 'gp-offline-queue';
function gpQueueList_(){
  try { return JSON.parse(localStorage.getItem(GP_QUEUE_KEY) || '[]'); } catch(e){ return []; }
}
function gpQueueSave_(list){
  try { localStorage.setItem(GP_QUEUE_KEY, JSON.stringify(list)); } catch(e){}
}
function gpQueueCount(){ return gpQueueList_().length; }
function gpQueuePut_(key, fn, args){
  var list = gpQueueList_().filter(function(x){ return x.key!==key; });
  list.push({ key:key, fn:fn, args:args, ts:Date.now() });
  gpQueueSave_(list);
  render();
}
function gpQueueRemove_(key){
  gpQueueSave_(gpQueueList_().filter(function(x){ return x.key!==key; }));
  render();
}
/* Real network status only, never a guess: does the browser itself think
   it has a connection right now. */
function gpOnline_(){ return typeof navigator==='undefined' || navigator.onLine!==false; }

/* Replays whatever's queued, oldest first, one at a time — stops trying
   (leaving the rest queued for next time) the moment one fails, so a
   still-bad connection doesn't burn through the whole list at once. */
var _gpQueueFlushing = false;
function gpQueueFlush(){
  if(_gpQueueFlushing || !gpOnline_()) return;
  var list = gpQueueList_();
  if(!list.length) return;
  _gpQueueFlushing = true;
  var i = 0;
  function next(){
    if(i>=list.length){ _gpQueueFlushing=false; return; }
    var item = list[i];
    run(item.fn, item.args, function(d){
      gpQueueRemove_(item.key);
      if(item.fn==='saveGoals' && d && d.goals) S.goals=d.goals;
      if(item.fn==='saveMyWeek' && d && d.checkins) S.checkins=d.checkins;
      if(item.fn==='saveMyMinistry' && d && d.ok) S.ministry=d;
      if(item.fn==='saveMinistryFor' && d && d.ok && S.oversee) S.oversee[item.args[3]]=d;
      i++; next();
    }, function(){ _gpQueueFlushing=false; });
  }
  next();
}
window.addEventListener('online', gpQueueFlush);
document.addEventListener('visibilitychange', function(){ if(!document.hidden) gpQueueFlush(); });

/* Every Weekly Goals action — add, remove, mark complete, drag the slider,
   link a KPI, edit the wording — already sends the whole week's list, not a
   delta, so they all share one save path and it's the one place offline
   queueing needs wiring in. cb(ok) fires once either way: true for a save
   that reached the server OR queued cleanly, false for a real failure. */
/* One line at the top of My Home whenever anything is still waiting to
   sync — the only visible sign this mechanism exists at all otherwise, so
   it's what tells someone their edit is safe rather than lost. */
function gpQueueBannerHtml_(){
  var n = gpQueueCount();
  if(!n) return '';
  return '<div class="banner">📡 '+esc(n===1
    ? t('One change is saved on your phone and will sync once you’re back online.')
    : gpT('{n} changes are saved on your phone and will sync once you’re back online.', {n:n}))+'</div>';
}
function gpSaveGoals_(wk, written, cb){
  function queueOffline(){
    gpQueuePut_('goals:'+wk, 'saveGoals', [S.auth.user,S.auth.pin,wk,written]);
    S.goals = (S.goals||[]).filter(function(g){ return Number(g.week)!==Number(wk); })
      .concat([{week:wk, pct:gpGoalsWeekPct_(written), updated:'', items:written}]);
    showMsg(t('Saved on your phone — will sync once you’re back online.'));
    cb(true);
  }
  if(!gpOnline_()){ queueOffline(); return; }
  run('saveGoals',[S.auth.user,S.auth.pin,wk,written], function(d){
    if(d && d.ok) S.goals=d.goals||[]; else showMsg(t('That didn’t save — try again.'));
    cb(!!(d && d.ok));
  }, queueOffline);
}

/* Ministry numbers queue too — the week's, the month's and the quarter's boxes on
   My Ministry and an overseer's card. Each save carries absolute values per
   metric for one week, so a second offline save to the same ministry and week
   merges into the first by metric (the newer box wins) rather than replacing
   it: one card saved, then another, must both arrive. The numbers show on the
   page at once (gpMinistryOverlay_), and again over a fresh boot until sent. */
function gpMinistryOverlay_(data, wk, updates){
  if(!data) return;
  data.entries = data.entries || {};
  (updates||[]).forEach(function(u){
    var e = data.entries[u.metric] || (data.entries[u.metric] = {});
    if(u.value===null || u.value===undefined) delete e[String(wk)]; else e[String(wk)] = u.value;
  });
}
function gpSaveMinistry_(o){
  function queueOffline(){
    var key = 'min:'+o.dept+'|'+o.min+'|'+o.wk;
    var prev = gpQueueList_().filter(function(x){ return x.key===key; })[0];
    var merged = {}, order = [];
    ((prev && prev.args[prev.args.length-1]) || []).concat(o.updates).forEach(function(u){
      if(!(u.metric in merged)) order.push(u.metric);
      merged[u.metric] = u;
    });
    gpQueuePut_(key, o.fn, o.args.slice(0, -1).concat([order.map(function(m){ return merged[m]; })]));
    gpMinistryOverlay_(o.fn==='saveMinistryFor' ? (S.oversee||{})[o.min] : S.ministry, o.wk, o.updates);
    if(o.updates.some(function(u){ return u.value!==null && u.value!==undefined; })) numbersMarkLogged_(o.dept, o.min, o.wk);
    showMsg(t('Saved on your phone — will sync once you’re back online.'));
    o.done(null, true);
  }
  if(!gpOnline_()){ queueOffline(); return; }
  run(o.fn, o.args, function(d){ o.done(d, false); }, queueOffline);
}

/* consecutive-day streak ending today or yesterday */
function streak(pred){
  var have={}; S.logs.forEach(function(l){ if(pred(l)) have[l.date]=1; });
  var d=new Date(); var n=0;
  // allow streak to still count if today not logged yet
  if(!have[fmtD(d)]) d.setDate(d.getDate()-1);
  while(have[fmtD(d)]){ n++; d.setDate(d.getDate()-1); }
  return n;
}

/* Forgiving streak: one missed day doesn't wipe the run, it spends the single
   grace day. Punitive streaks are why habit trackers get deleted in February. */
function graceStreak(pred){
  var have={}; S.logs.forEach(function(l){ if(pred(l)) have[l.date]=1; });
  var d=new Date();
  if(!have[fmtD(d)]) d.setDate(d.getDate()-1);   // today's not due yet
  var n=0, grace=1;
  while(true){
    if(have[fmtD(d)]){ n++; }
    else if(grace>0 && n>0){ grace--; }          // never start on a grace day
    else break;
    d.setDate(d.getDate()-1);
  }
  return n;
}
function bestStreak(pred){
  var days=S.logs.filter(pred).map(function(l){return l.date;}).sort();
  var best=0, run=0, prev=null;
  days.forEach(function(ds){
    if(prev){
      var gap=Math.round((new Date(ds+'T00:00:00')-new Date(prev+'T00:00:00'))/86400000);
      run = gap===1 ? run+1 : 1;
    } else run=1;
    if(run>best) best=run;
    prev=ds;
  });
  return best;
}
/* Habit results live in l.habits, but the original fixed columns (bible,
   workout, quietTime…) hold the history from before habits were configurable —
   fall back to them so nobody's streak resets to zero on this change. */
function didHabit(l, id){
  if(l.habits && l.habits[id]!==undefined) return !!l.habits[id];
  return !!l[id];
}
function habitPred(id){ return function(l){ return didHabit(l,id); }; }
function logForDate(ds){
  for(var i=0;i<S.logs.length;i++) if(S.logs[i].date===ds) return S.logs[i];
  return null;
}
function fmtD(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function sum(rows, f){ var acc=0; rows.forEach(function(r){ acc+=Number(f(r))||0; }); return acc; }
function count(rows, f){ var n=0; rows.forEach(function(r){ if(f(r)) n++; }); return n; }

/* ---------- offline: the last page this phone loaded ----------
   Every good getMyBoot is kept on the phone (gp-boot-cache, with whose it is
   and when), so the app can open with no connection: sw.js serves the page
   itself, and this serves the data, marked as a copy (S.offlineSince) with a
   line at the top of every screen. It is the same data this phone was already
   showing, behind the same remembered PIN; logging out, or a PIN the server
   refuses, deletes it. Saves that queue offline (goals, the health check-in,
   ministry numbers) still queue; the rest say they could not save. Back online,
   the page boots again by itself and the line goes. */
var GP_BOOT_CACHE = 'gp-boot-cache', GP_BOOT_CACHE_MAX = 3000000;
function gpBootCacheSave_(d){
  try {
    var txt = JSON.stringify({ user:S.auth.user, at:new Date().toISOString(), d:d });
    if(txt.length > GP_BOOT_CACHE_MAX) { lsDel(GP_BOOT_CACHE); return; }   // too big to keep: keep none rather than a stale one
    lsSet(GP_BOOT_CACHE, txt);
  } catch(e){}
}
function gpBootCacheLoad_(user){
  try {
    var c = JSON.parse(lsGet(GP_BOOT_CACHE)||'null');
    return (c && c.d && c.d.ok && c.user===user) ? c : null;
  } catch(e){ return null; }
}
function gpBootFromCache_(){
  var c = gpBootCacheLoad_(S.auth.user);
  if(!c) return false;
  S.me = c.d.staff; S.profile = c.d.profile;
  S.offlineSince = c.at;
  S.bootStale = false;
  applyBoot(c.d, true);
  gpReleaseHeld_();   // what was tapped meanwhile now meets the offline queue, or says it could not save
  return true;
}
/* Back online (or back to the app) while showing the copy: boot again, quietly. */
var _gpReboot = false;
function gpRebootIfOffline_(){
  if(!S.offlineSince || _gpReboot || !gpOnline_() || !S.auth || !S.auth.user) return;
  _gpReboot = true;
  run('getMyBoot', [S.auth.user, S.auth.pin], function(d){
    _gpReboot = false;
    if(d && d.ok) gpBootFresh_(d);
  }, function(){ _gpReboot = false; });
}
window.addEventListener('online', gpRebootIfOffline_);
document.addEventListener('visibilitychange', function(){ if(!document.hidden) gpRebootIfOffline_(); });
function gpOfflineBannerHtml_(){
  if(!S.offlineSince || !S.me) return '';
  var d=new Date(S.offlineSince);
  var when=shortDay_(d)+', '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
  return '<div class="banner offlineBanner" id="offlineBanner">📴 '+esc(gpT('No connection — this is your page as it was on {date}. Numbers, goals and check-ins you save will send when you’re back online.',{date:when}))+'</div>';
}

/* Once a day, after a good boot: "opened the app today", for Admin → Loose
   ends. Its own call because the boot writes nothing; the date only. */
function gpMarkSeen_(){
  var day=todayStr();
  if(lsGet('gp-seen-day')===day+'|'+S.auth.user) return;
  run('markSeen',[S.auth.user,S.auth.pin],function(d){ if(d && d.ok) lsSet('gp-seen-day', day+'|'+S.auth.user); }, function(){});
}

/* Opening the app: the copy first, then the truth. With a remembered session and
   a copy of this person's last boot on the phone, the page draws from the copy at
   once — no blank screen while the server answers — marked by a thin "Updating…"
   bar, and replaces it when the fresh boot lands, usually a second or two later. */
var _gpHeld = [];
function gpReleaseHeld_(){
  var held=_gpHeld; _gpHeld=[];
  held.forEach(function(c){ run(c[0], c[1], c[2], c[3]); });
}
function gpBootFresh_(d){
  S.bootStale=false; S.offlineSince=null;
  S.me = d.staff; S.profile = d.profile;
  applyBoot(d);
  gpReleaseHeld_();
}
function gpStaleBarHtml_(){ return S.bootStale ? '<div class="staleBar" id="staleBar"><span>'+esc(t('Updating…'))+'</span></div>' : ''; }

/* ---------- boot ---------- */
/* An invite link (Admin → Arrivals & departures): teams.html?reg=1&campus=…&dept=…
   &ministry=… opens the sign-up form with those chosen. It grants nothing — the
   person still picks their own username, PIN and email, and a Campus Leadership
   sign-up still waits for an admin, exactly as without the link. Anything in it
   that is not a real campus / department / ministry is ignored. */
function gpInviteFromUrl_(){
  try {
    var q=new URLSearchParams(location.search||'');
    var c=q.get('campus')||'', d=q.get('dept')||'', m=q.get('ministry')||'';
    if(!CAMPUSES.some(function(x){ return x.id===c; })) return null;
    if(d && deptsFor(c).indexOf(d)===-1) d='';
    if(!d || ministriesFor(c, d).indexOf(m)===-1) m='';
    return { campus:c, dept:d, ministry:m };
  } catch(e){ return null; }
}
function gpInviteLink_(c, d, m){
  var base=location.origin+location.pathname.replace(/[^\/]*$/, '')+'teams.html';
  return base+'?reg=1&campus='+encodeURIComponent(c)+(d?'&dept='+encodeURIComponent(d):'')+(m?'&ministry='+encodeURIComponent(m):'');
}
/* Back from pulling in a new version (gpReloadForUpdate_): the same tab as before. */
function gpResumeView_(){
  try { var rv=sessionStorage.getItem('gp-resume');
    if(rv){ sessionStorage.removeItem('gp-resume'); if(['week','base','team','health','library','ministry','mentor','goals','leave','admin'].indexOf(rv)>-1) S.view=rv; } } catch(e){}
}
function boot(){
  /* The dashboard's front door links straight here: ?reg=1 opens the create
     form rather than making someone find the "New here?" link first. */
  try { if(String(location.search||'').indexOf('reg=1')>-1) S.regMode = true; } catch(e){}
  S.regPrefill = gpInviteFromUrl_();
  var saved = null;
  try { saved = JSON.parse(lsGet('gp-staff')||'null'); } catch(e){}
  var wantGuest = false, wantDash = false;
  try { wantGuest = String(location.search||'').indexOf('guest=1')>-1; } catch(e){}
  /* teams.html?view=base — where index.html and the old dashboard's links send now */
  try { wantDash = /^(base|dashboard)$/.test(new URLSearchParams(location.search||'').get('view')||''); } catch(e){}
  if(!(saved && saved.user && saved.pin) && lsGet(BOARD_KEY) && boardResume_()) return;
  /* the old dashboard was public, so its links look around as a guest, on Base */
  if(!(saved && saved.user && saved.pin) && (wantGuest || wantDash || lsGet(GUEST_KEY))){ gpEnterGuest_(); if(wantDash){ S.view='base'; render(); } return; }
  if(saved && saved.user && saved.pin){
    /* A remembered session goes straight to getMyBoot: it verifies the PIN and
       returns the staff record, so the separate staffLogin round-trip that used
       to come first is not needed. Logging in by hand still uses staffLogin,
       because there the answer to "is this PIN right" is the whole point. */
    S.auth = saved;
    gpResumeView_();
    if(wantDash) S.view='base';
    var kept = gpBootCacheLoad_(saved.user);
    if(kept){ S.bootStale = true; S.me = kept.d.staff; S.profile = kept.d.profile; applyBoot(kept.d, true); }
    run('getMyBoot', [saved.user, saved.pin], function(d){
      if(d && d.ok){ gpBootFresh_(d); return; }
      /* Only forget the session when the server actually says the credentials are
         wrong. Anything else — a 500, a bad gateway, a truncated response — is the
         request failing, and making somebody retype their PIN because the server
         hiccuped is the wrong answer. run() already reports a dropped connection;
         this covers a server that answered but not with a page. */
      if(d && d.err === 'auth'){
        lsDel('gp-staff'); lsDel(GP_BOOT_CACHE);
        S.bootStale = false; _gpHeld = [];   // nothing held goes out under a PIN the server refused
        S.me = null; S.auth = { user:'', pin:'' };
        showMsg(t('Your PIN didn’t work — please log in again.'));
      } else if(gpBootFromCache_()){
        return;
      } else {
        S.bootStale = false; gpReleaseHeld_();
        showMsg(t('Couldn’t load your page — pull down to try again.'));
      }
      render();
    }, function(){
      /* No connection at all: the copy from last time, if this phone has one. */
      if(gpBootFromCache_()) return;
      S.bootStale = false; gpReleaseHeld_();
      showMsg(t('No connection — your page will load once you’re back online.'));
      render();
    });
  } else { render(); }
}
/* Small public snapshot so the dashboard's top-right chip can show your face
   and name without needing your PIN. Nothing private goes in here. */
function saveStaffCard(){
  lsSet('gp-staff-card', JSON.stringify({
    name: S.me.name, photo: S.me.photo || '', ministry: S.me.ministry || '',
    // Campus so the dashboard can open on your own base instead of Poipet.
    campus: S.me.campus || ''
  }));
}

function afterLogin(){
  lsSet('gp-staff', JSON.stringify(S.auth));
  saveStaffCard();
  S.view='week';
  /* back from signing on the portal: straight to My contract */
  try { var qv=new URLSearchParams(location.search||'');
    if(qv.get('view')==='mycontract'){ S.view='mycontract'; S.myc=null; }
    if(qv.get('view')==='base' || qv.get('view')==='dashboard') S.view='base';
    /* back from filling out a contract with someone: their HR profile, fresh */
    if(qv.get('view')==='hr' && qv.get('hr')){ S.view='hr'; S.hrTab='staff'; S.hrSub='person'; S.hrPersonId=qv.get('hr'); S.hrStaff=null; } } catch(e){}
  gpResumeView_();
  /* ONE request for everything this page needs. It used to be nine on top of the
     login — each verifying the same PIN, each re-rendering when it landed, so the
     page rebuilt itself nine times while it loaded. Sections that fail come back
     null and simply stay empty; the rest of the page still works. */
  run('getMyBoot', [S.auth.user, S.auth.pin], function(d){
    if(!d || !d.ok){ showMsg(t('Couldn’t load your page — pull down to try again.')); render(); return; }
    if(d.staff) S.me = d.staff;
    if(d.profile) S.profile = Object.assign(S.profile||{}, d.profile);
    applyBoot(d);
  });
  render();
}

/* Everything a boot payload carries, in one place, because two entry points use
   it: a remembered session and a fresh login. */
function applyBoot(d, fromCache){
  if(!fromCache){ S.offlineSince = null; gpBootCacheSave_(d); gpMarkSeen_(); }
  S.roster = d.roster || [];
  S.logs = d.logs || [];
  adoptHabits(d.habits);
  S.mentees = d.mentees || [];
  S.mentorRequests = d.mentorRequests || [];
  S.goals = d.goals || [];
  S.checkins = d.checkins || [];
  if(d.trips) S.trips = d.trips;
  S.tripRequests = d.tripRequests || [];
  if(d.ministry) S.ministry = d.ministry;
  if(d.org && d.org.ok) S.org = d.org;   // titles, YWAM GP roles, the advisory board
  if(d.kmFixes) gpKmFixes_(d.kmFixes);    // a Khmer reviewer's corrections (Khmer review)
  S.push = d.push || null;                 // reminders: the app's public key and your times (null = not set up)
  S.personal = d.personal || null;
  S.hrDue = (d.hrDue===undefined) ? null : d.hrDue;
  S.backup = d.backup || null;   // admins only: the nightly backup's last run
  S.numbers = d.numbers || null;
  S.pulse = {}; S.staffDebt = null;
  S.hrFollowUps = (d.hrFollowUps===undefined) ? null : d.hrFollowUps;
  S.reqDocs = d.reqDocs || [];
  S.required = d.required || null;      // what this profile still needs (the papers and the contract)
  S.supSum = d.supportSummary || null;   // support raising: your own totals (the full list loads on its page)
  libAdoptServer_(d.libRead, fromCache);
  if(d.teamTrips && d.teamTrips.ok) S.teamTrips[d.teamTrips.campus] = { trips: d.teamTrips.trips || [], canEdit: !!d.teamTrips.canEdit };
  S.smartGoals = d.smartGoals || [];
  S.tasks = d.tasks || [];
  S.oneOnOnes = d.oneOnOnes || [];
  S.broadcasts = d.broadcasts || [];
  if(d.base && d.base.entries) S.base = d.base;
  /* A boot payload is always the server's view, which for a week still
     queued offline is the OLD view — reapply the same overlay queueing
     used, or the screen would flash back to before the edit for a moment
     on every fresh boot until the flush below catches up. */
  gpQueueList_().forEach(function(item){
    if(item.fn==='saveGoals'){
      var gwk=item.args[2], gwritten=item.args[3];
      S.goals = (S.goals||[]).filter(function(g){ return Number(g.week)!==Number(gwk); })
        .concat([{week:gwk, pct:gpGoalsWeekPct_(gwritten), updated:'', items:gwritten}]);
    } else if(item.fn==='saveMyMinistry'){
      gpMinistryOverlay_(S.ministry, item.args[2], item.args[3]);
    } else if(item.fn==='saveMyWeek'){
      var wwk=item.args[2], wpayload=item.args[3];
      S.checkins = (S.checkins||[]).filter(function(c){ return Number(c.week)!==Number(wwk); })
        .concat([Object.assign({week:wwk, source:'weekly', days:7}, wpayload)]);
    }
  });
  render();
  gpQueueFlush();
}

function logout(){
  lsDel('gp-staff'); lsDel(GP_BOOT_CACHE); S.offlineSince=null;
  lsDel('gp-lib-read'); lsDel('gp-lib-pending'); lsDel('gp-lib-synced'); lsDel('gp-lib-progress');
  lsDel('gp-staff-card');
  S.me=null; S.auth={user:'',pin:''}; S.logs=[]; S.mentees=[];
  S.goals=[]; S.checkins=[]; S.ministry=null; S.goalsWeek=null; S.goalEditIdx=null; S.kpiWeek=null; S.leaveDraft=null; S.weekDraft={}; S.kpiDraft={}; S.kpiWeekDraft={};
  S.personal=null; S.personalDraft={}; S.mmTab='ministry'; S.kpiInputOpen=false; S.mmDashAll=false; S.metricRename=null;
  S.mmPeriod='quarter'; S.teamTrips={}; S.teamLoading={}; S.teamError={}; S.teamForm=null;
  S.hosp=null; S.hospLoading=false; S.hospError=''; S.hospForm=null; S.hospBedPick=null; S.hospRoom=null; S.hospBld=null; S.hospMove=null;
  S.lead=null; S.leadErr=''; S.leadForm=null; S.leadLoading=false; S.leadEdit=null;
  S.sched=null; S.schedError=''; S.schedData=null; S.schedEdit=false; S.schedPick=null; S.schedDirty=false;
  S.hrStaff=null; S.hrLoading=false; S.hrError=''; S.hrSub='home'; S.hrPersonId=null; S.hrSearch=''; S.hrContractForm=null; S.hrArchiveDraft=null; S.hrDue=null; S.hrFollowUps=null; S.hrTab='staff';
  S.cands=null; S.candsLoading=false; S.candsError=''; S.candForm=null; S.candPersonId=null; S.candNoteDraft='';
  S.teamMode='dir'; S.structYear=null; S.structQ=null; S.structCache={}; S.structLoading={}; S.structError={};
  S.smartGoals=[]; S.smartYear=null; S.smartCategory='Faith'; S.smartDraft=null;
  S.habitShowRest=false; S.habitNew=null;
  S.tasks=[]; S.goalsTab='goals'; S.taskFilter='all'; S.taskEdit=null; S.taskEditDraft=null; S.taskNew=null; S.tasksDoneOpen=false; S.smartHelpOpen=false; S.stepAdd=null; S.stepDraft=null;
  S.dbCustomize=false; S.oneOnOnes=[]; S.broadcasts=[];
  S.ooDrafts=null; S.ooNotes=null; S.ooGoals=null; S.ooGoalsFor=null; S.ooId=null; S.ooWith=null;
  S.oversee={}; S.ovWeek={}; S.ovWeekDraft={}; S.ovAcc={}; S.ovLoading={}; S.ovError={}; S.ovInputOpen={};
  S.adminStaff=null; S.adminLoading=false; S.adminAcc={}; S.adminEditId=null; S.adminEditDraft=null; S.adminPinDraft={}; S.adminCode=''; S.adminCampusTab=null; S.adminSub=null;
  render();
}

/* ---------- render root ---------- */
/* One buzz and one pop the first time a streak crosses 7 or 30, per browser
   session. Streaks are the one number here that is purely for the person holding
   the phone, so it is worth marking — but a celebration that fires on every render
   stops being one. Used to target a standalone streak chip under the hero; that
   chip was dropped as a duplicate of the hero's own number, so this now marks
   the hero's number directly (only present, and only worth marking, on My
   Database's own hero — not Base's, which uses .heroNum for a different figure). */
function celebrateStreak(){
  var el = document.querySelector('.hero.myHero .heroNum');
  if(!el) return;
  var st = graceStreak(function(){ return true; });
  if(st < 7) return;
  var band = st >= 30 ? '30' : '7';
  try {
    if(sessionStorage.getItem('gp-streak-cheer') === band) return;
    sessionStorage.setItem('gp-streak-cheer', band);
  } catch(e){ return; }   // no storage: skip rather than repeat it forever
  el.classList.add('cheer');
  gpTap(18);
}

var lastRenderedView=null;
function render(){
  if(window.gpDead) return;   // an error message is on screen; leave it there
  /* Whatever this render decides to show — the profile, the login form, an empty
     week — it is a real screen, so the splash has done its job. Lifting it here
     rather than on a timer is what makes the launch read as splash-then-profile
     instead of splash-then-pause-then-profile. */
  if(window.gpSplashDone) window.gpSplashDone();
  // Whatever just changed S.base — a fresh boot, a pull-to-refresh, an OKR
  // save that came back with the whole getData payload — this is the one
  // place every one of those paths ends up before anything renders, so it's
  // the one place getDepartments() needs to be kept in sync from.
  if(S.base) setMetricOverrides(S.base.metricOverrides);
  var hb=document.getElementById('hbtns');
  var nav=document.getElementById('bottomNav');
  if(!S.me){
    hb.innerHTML = '<button class="hbtn" id="langBtn">'+(LANG==='km'?'EN':'ខ្មែរ')+'</button>';   // (the old dashboard's button is gone: Look around shows Base)
    nav.classList.add('hidden');
    document.getElementById('main').innerHTML = S.regMode ? registerHtml() : loginHtml();
    bind();
    return;
  }
  var notifN = S.guest ? 0 : visibleNotifItems_().length;
  if(S.board){ if(BOARD_VIEWS.indexOf(S.view)===-1) S.view='ywamgp'; }
  else if(S.guest && GUEST_VIEWS.indexOf(S.view)===-1) S.view='week';
  hb.innerHTML = '<button class="hbtn" id="langBtn">'+(LANG==='km'?'EN':'ខ្មែរ')+'</button>'+ (S.guest ? '' :
    '<button class="hbtn icon" id="bellBtn" style="position:relative" aria-label="'+esc(gpT('Notifications ({n})',{n:notifN}))+'">'+BELL_SVG+
    (notifN?'<span class="notifDot"></span>':'')+'</button>')+
    '<button class="hbtn icon" id="menuBtn" aria-label="'+esc(t('Menu'))+'">'+HAMBURGER_SVG+'</button>';
  /* Base leads: signing in should show how the base is doing, not a to-do list.
     Your own week is one tap away, Profile is folded into Me, and Mentor is
     reached from Team. */
  var reqN=S.mentorRequests?S.mentorRequests.length:0;
  /* Outline icons from the redesign mockup, in place of the emoji this bar
     used before — same four glyphs (house / stacked database / two people /
     heart), traced as stroke paths so they inherit the tab's own color
     instead of carrying an emoji font's fixed hue. The house belongs to
     'week' (My Home) and the stacked database to 'base' — swapped from the
     original mockup pairing so each tab's icon actually matches its name. */
  var NAV_SVG_OPEN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
  var NAV_ICONS = {
    report: NAV_SVG_OPEN+'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 17v-3M12 17v-6M16 17v-2"/></svg>',
    base: NAV_SVG_OPEN+'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
    week: NAV_SVG_OPEN+'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    team: NAV_SVG_OPEN+'<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3.5 20c.6-3.4 3-5.4 5.5-5.4s4.9 2 5.5 5.4"/><path d="M14.8 15c1.9.2 3.6 1.9 4.1 5"/></svg>',
    health: NAV_SVG_OPEN+'<path d="M12 20.5s-7.5-4.6-9.8-9.6C.6 7.3 2.4 4 5.7 4c2 0 3.5 1.1 4.3 2.5C10.8 5.1 12.3 4 14.3 4c3.3 0 5.1 3.3 3.5 6.9C15.5 15.9 12 20.5 12 20.5Z"/></svg>',
    ywamgp: NAV_SVG_OPEN+'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9Z"/></svg>',
    ministry: NAV_SVG_OPEN+'<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M21 20H3"/></svg>',
    library: NAV_SVG_OPEN+'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>'
  };
  /* Oct 2026 (Uriah): My Ministry takes Base's place and the Library joins the
     bar; Base moves to the menu, and its key numbers sit on My Home's card. */
  var tabs=[['week','My Home'],['ministry','My Ministry'],['team','Team'+(reqN?' ('+reqN+')':'')],['health','Health'],['library','Library']];
  if(S.board) tabs=[['ywamgp','YWAM GP'],['base','Campuses'],['report','Report'],['library','Library']];
  else if(S.guest) tabs=[['week','Look around'],['base','Base'],['team','Team'],['health','Health'],['library','Library']];
  nav.classList.remove('hidden');
  nav.innerHTML = tabs.map(function(tab){
    return '<button class="'+(S.view===tab[0]?'on':'')+'" data-tab="'+tab[0]+'"><span class="ic">'+NAV_ICONS[tab[0]]+'</span>'+navLabel_(tab[1])+'</button>';
  }).join('');
  var m=document.getElementById('main');
  document.body.classList.toggle('repOn', S.view==='report');
  document.body.classList.toggle('libReading', S.view==='library' && !!S.libBook && S.libStep!=null);   // not 'reading': that is the Bible-reading box's class, and its yellow, border and font leaked onto the whole page
  if(LIBA.on && !(S.view==='library' && S.libBook && S.libStep!=null)) libAudioStop_();
  if(S.guest && S.view==='week') m.innerHTML=gpGuestHomeHtml_();
  else if(S.guest && (S.view==='team' || S.view==='health')) m.innerHTML=gpGuestLockHtml_(S.view);
  else if(S.view==='base') m.innerHTML=(S.guest ? gpGuestCampusHtml_() : '')+(S.board ? orgCampusProfileHtml_(S.me.campus) : '')+baseHtml();
  else if(S.view==='ywamgp') m.innerHTML=ywamGpHtml();
  else if(S.view==='kmreview') m.innerHTML=kmReviewHtml();
  else if(S.view==='report') m.innerHTML=boardReportHtml_();
  else if(S.view==='support') m.innerHTML=supportHtml_();
  else if(S.view==='prayer') m.innerHTML=prayerHtml_();
  else if(S.view==='week') m.innerHTML=homeHtml();
  else if(S.view==='health') m.innerHTML=healthHtml();
  else if(S.view==='team') m.innerHTML=teamHtml();
  else if(S.view==='mentor') m.innerHTML=mentorHtml();
  else if(S.view==='oneonone') m.innerHTML=oneOnOneHtml();
  else if(S.view==='leave') m.innerHTML=leaveHtml();
  else if(S.view==='goals') m.innerHTML=goalsPageHtml();
  else if(S.view==='ministry') m.innerHTML=myMinistryHtml();
  else if(S.view==='teamsdb') m.innerHTML=teamsDbHtml();
  else if(S.view==='hr') m.innerHTML=hrHtml();
  else if(S.view==='mycontract') m.innerHTML=myContractHtml();
  else if(S.view==='hosp') m.innerHTML=hospHtml();
  else if(S.view==='sched') m.innerHTML=schedHtml();
  /* OKRs live on My Ministry's second tab now — anything still pointing at
     the old view lands there rather than on a page that no longer exists. */
  else if(S.view==='okr'){ S.view='ministry'; S.mmTab='okr'; m.innerHTML=myMinistryHtml(); }
  else if(S.view==='admin') m.innerHTML=adminHtml();
  else if(S.view==='ptest') m.innerHTML=ptestHtml();
  else if(S.view==='ptype') m.innerHTML=ptypeHtml();
  else if(S.view==='gtest') m.innerHTML=gtestHtml();
  else if(S.view==='gstr') m.innerHTML=gstrHtml();
  else if(S.view==='library') m.innerHTML=libraryHtml();
  else if(S.view==='required') m.innerHTML=reqSignHtml();
  else m.innerHTML=profileHtml();
  if(S.offlineSince) m.insertAdjacentHTML('afterbegin', gpOfflineBannerHtml_());
  if(S.bootStale) m.insertAdjacentHTML('afterbegin', gpStaleBarHtml_());
  /* Switching screens should open at the top of the new one, not wherever the
     old screen happened to be scrolled to — without this, tapping into Leave
     Request from partway down My Home lands on whatever the leave screen
     shows at that same pixel offset, which usually isn't its top. Re-renders
     of the SAME screen (an accordion opening, a slider dragging) must not
     reset scroll, so this only fires when S.view actually changed. */
  /* SR Hospitality is a desk tool as much as a phone one: on a wide screen it
     takes the width (main.wide), its cards in columns; on a phone, unchanged. */
  m.classList.toggle('wide', S.view==='hosp' || (S.view==='ministry' && S.mmTab!=='okr' && !!S.leadShown));
  if(S.view!==lastRenderedView){ window.scrollTo(0,0); lastRenderedView=S.view; }
  bind();
}

function greeting(){
  var h=new Date().getHours();
  return h<12 ? 'Good morning' : (h<18 ? 'Good afternoon' : 'Good evening');
}

/* ---------- base: the first thing you see after logging in ----------
   The dashboard's figures, for the base this person actually works at. Nothing
   is computed here — rollup.js does the arithmetic, so these are the same
   numbers leadership reads, not a second opinion.

   getData() is the dashboard's own endpoint. It needs no leader code: the two
   money metrics leadership can see are stripped server-side for everyone else,
   so what lands here is what an ordinary staff member is allowed to read. */
var _baseRoll = null;
function baseR(){
  var d = S.base || {};
  if(!_baseRoll || _baseRoll.e!==d.entries || _baseRoll.s!==d.survey || _baseRoll.r!==S.roster){
    _baseRoll = { e:d.entries, s:d.survey, r:S.roster,
      api: gpRollup({ entries:d.entries, survey:d.survey, roster:S.roster, week:thisWeek() }) };
  }
  return _baseRoll.api;
}

/* A year other than the one getMyBoot already loaded (S.base). Health's year
   view needs to browse those without a second boot round-trip for every field
   on the page, so it fetches just that year's getData and caches it — the
   same anonymous, no-leader-code call S.base itself came from. */
function baseRFor(year){
  if(S.base && Number(S.base.year)===Number(year)) return baseR();
  var d = S.baseByYear[year];
  if(!d) return null;
  return gpRollup({ entries:d.entries, survey:d.survey, roster:S.roster, week:thisWeek() });
}
function ensureBaseYear(year, cb){
  if((S.base && Number(S.base.year)===Number(year)) || S.baseByYear[year]){ cb(); return; }
  run('getData', ['', year], function(dd){
    if(dd && dd.entries) S.baseByYear[year] = dd;
    cb();
  });
}

/* One tile. `metric` only decides formatting ($ / 1-10 / plain); a trend is
   passed in already rendered because only the caller knows what to compare; and
   `drill` carries the attributes that make the figure open its own breakdown.

   Every figure that came from logged entries gets a drill. A few can't have one
   — a school count is derived from several metrics at once, and the health score
   comes from check-ins rather than entries — and those stay plain rather than
   opening an empty sheet. */
function bstat(label, value, metric, trend, drill){
  return '<div class="stat'+(drill?' drillable':'')+'"'+(drill||'')+'>'+
    '<div class="statNum">'+fmt(value, metric)+'</div>'+
    '<div class="statLabel">'+esc(t(label))+(trend||'')+'</div></div>';
}

/* Q1-Q4 chips under a heading, so "per quarter" is answerable without leaving
   the page. Each chip drills into that quarter alone. */
function bquarters(label, valFn, drillFn){
  var h = '<div class="qRow"><span class="qRowLabel">'+esc(t(label))+'</span>';
  for(var q=0;q<4;q++){
    var d = drillFn ? drillFn(q) : '';
    h += '<span'+(d?' class="drillable"'+d:'')+'>Q'+(q+1)+' <b>'+fmt(valFn(q))+'</b></span>';
  }
  return h+'</div>';
}

/* ---- hamburger menu drawer ----
   From the redesign mockup: a right-side drawer for the destinations that
   aren't one of the four bottom tabs. "Admin" is deliberately not here —
   the mockup's item points at an account-approval system this app doesn't
   have yet, and a menu item that goes nowhere is worse than no menu item. */
var HAMBURGER_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
var DRAWER_CLOSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';
var BELL_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 14.5 18 8Z"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/></svg>';

/* ---- notification bell ----
   Same panel style as the hamburger drawer, on the opposite side of the
   header. This is where updates live (My Home has no Updates card): what is
   waiting on you — a mentee's leave request, an incoming 1-on-1 — gets its
   Approve/Deny or Accept/Decline right here, the same handlers the Leave
   Request page and the Mentorship card use. The red dot on the bell says
   when there is something new. */
function renderNotifPanel(){
  var root = document.getElementById('notifRoot');
  if(!root) return;
  if(!S.bellOpen || !S.me){ root.innerHTML=''; return; }
  var items = visibleNotifItems_();
  var close=function(){ S.bellOpen=false; renderNotifPanel(); };
  root.innerHTML = '<div class="scrim" id="notifScrim"></div>'+
    '<div class="drawer">'+
      '<div class="drawerHead"><span class="drawerTitle">'+BELL_SVG+' '+esc(t('Notifications'))+'</span>'+
        '<button class="hbtn icon" id="notifCloseBtn" style="border-color:var(--border2);color:var(--ink)" aria-label="'+esc(t('Dismiss'))+'">'+DRAWER_CLOSE_SVG+'</button></div>'+
      (items.length
        ? items.map(function(it){ return '<div class="row"><span class="rowName">'+esc(it.text)+'</span>'+(it.actions||'')+'</div>'; }).join('')+
          '<button class="linkbtn" id="notifPanelClearBtn">'+esc(t('Clear all'))+'</button>'
        : '<p class="sub" style="margin:4px 0">'+esc(t('Nothing new.'))+'</p>')+
    '</div>';
  document.getElementById('notifScrim').onclick=close;
  document.getElementById('notifCloseBtn').onclick=close;
  var clearBtn=document.getElementById('notifPanelClearBtn');
  if(clearBtn) clearBtn.onclick=clearNotifications;

  /* The same action types bind() wires up on the Leave Request page and the
     Mentorship card — wired here too because opening the bell only calls
     this function, not a full render()/bind() pass, so those handlers
     never reach whatever just got drawn inside #notifRoot. */
  document.querySelectorAll('#notifRoot [data-gohealth]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='health'; render(); };
  });
  document.querySelectorAll('#notifRoot [data-jumpgoals]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='week'; render(); };
  });
  document.querySelectorAll('#notifRoot [data-goprofile]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='profile'; render(); };
  });
  document.querySelectorAll('#notifRoot [data-goadmin]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='admin'; S.adminSub='home'; render(); };
  });
  document.querySelectorAll('#notifRoot [data-gohr]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='hr'; S.hrSub='home'; render(); };
  });
  document.querySelectorAll('#notifRoot [data-121accept]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-121accept');
      run('respondToOneOnOne',[S.auth.user,S.auth.pin,id,true],function(d){
        if(d.ok){ S.oneOnOnes=d.oneOnOnes; S.bellOpen=false; ooAfterAccept_(id); }
      });
    };
  });
  document.querySelectorAll('#notifRoot [data-ooopen]').forEach(function(b){
    b.onclick=function(){ gpTap(); ooGo_(b.getAttribute('data-ooopen')); };
  });
  document.querySelectorAll('#notifRoot [data-121decline]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-121decline');
      run('respondToOneOnOne',[S.auth.user,S.auth.pin,id,false],function(d){
        if(d.ok){ S.oneOnOnes=d.oneOnOnes; render(); }
      });
    };
  });
  [['trok',true],['trno',false]].forEach(function(pair){
    document.querySelectorAll('#notifRoot [data-'+pair[0]+']').forEach(function(b){
      b.onclick=function(){
        if(S.busy) return;
        S.busy=true; b.disabled=true;
        run('respondToTrip',[S.auth.user,S.auth.pin,b.getAttribute('data-'+pair[0]),pair[1]],function(d){
          S.busy=false;
          if(d && d.ok) S.tripRequests=d.requests||[];
          render();
        });
      };
    });
  });
}
function renderMenu(){
  var root = document.getElementById('menuRoot');
  if(!root) return;
  if(!S.menuOpen || !S.me){ root.innerHTML=''; return; }
  /* Sections, so the menu stays short to read. Everyone: Leave Request and
     Profile & settings (My Ministry and the Library are in the bottom bar; Base is here, first), then Operations (the weekly schedules; SR Hospitality for
     the Hospitality ministry and admins). Applications: the YWAM GP Portal,
     for admins, portal staff/admins and the Outreach Teams leader (S.me.portal,
     from the server). Admin: HR (admins, or anyone given hr) and the Admin
     page (admins). Weekly Check-in is gone — the Health tab is its home — and
     the GP Dashboard is hidden for now. An empty section isn't drawn. */
  var IC={"ministry":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/></svg>","profile":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 20.5c1.5-4 4.5-6 8-6s6.5 2 8 6\"/></svg>","leave":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"16\" rx=\"2.5\"/><line x1=\"3.5\" y1=\"10\" x2=\"20.5\" y2=\"10\"/><path d=\"M8 8V3.5M16 8V3.5\"/><path d=\"M8.5 14.5l2 2 4-4\"/></svg>","sched":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2.5\"/><path d=\"M3 9h18M9 9v12M15 9v12\"/></svg>","hosp":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 18V7\"/><path d=\"M3 14h18v4\"/><path d=\"M21 14v-2a3 3 0 0 0-3-3h-7v5\"/><circle cx=\"7\" cy=\"11\" r=\"2\"/></svg>","portal":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 4h11l5 5v11H4z\"/><path d=\"M15 4v5h5\"/><path d=\"M8 13h8M8 17h5\"/></svg>","hr":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2.5\"/><path d=\"M3 9h18\"/><path d=\"M8 2.5V6M16 2.5V6\"/><path d=\"M8 14h4M8 17.5h8\"/></svg>","admin":"<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z\"/><path d=\"M9 12l2 2 4-4\"/></svg>"};
  var it=function(id, label){ return { id:id, icon:IC[id], label:label }; };
  var hrN=(S.hrDue||0)+(S.hrFollowUps||0);
  IC.mycontract='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>';
  IC.base='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>';
  IC.library='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h5"/></svg>';
  IC.ywamgp='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9Z"/></svg>';
  IC.boardlogout=IC.profile;
  IC.prayer='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-1.2 2.5-1.8 5-1.8 7.5L7 15.5V20h4l1-2.5"/><path d="M12 3c1.2 2.5 1.8 5 1.8 7.5l3.2 5V20h-4L12 17.5"/></svg>';
  IC.kmreview='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h8M8 3v2M5.5 5c.8 3.2 3 5.6 6 7"/><path d="M10.5 5c-.7 3.6-3 6.4-6 8"/><path d="M12.5 21l4-9 4 9M14 18h5"/></svg>';
  var sections= S.board ? [
    { title:'', items:[it('ywamgp', t('YWAM GP')), it('library', t('Library')), it('boardlogout', t('Log out'))] }
  ] : S.guest ? [
    { title:'', items:[it('library', t('Library')), it('guestreg', t('Create my profile')), it('guestlogin', t('Log in'))] }
  ] : [
    { title:'', items:[it('base', t('Base')), it('ywamgp', t('YWAM GP')), it('prayer', t('Prayer')), it('leave', t('Leave Request')), it('mycontract', t('My contract')), it('profile', t('Profile & settings'))] },
    { title:t('Operations'), items:[].concat(typeof dutyHtml==='function' ? [it('sched', t('Weekly schedules'))] : [], canHospClient_() ? [it('hosp', t('SR Hospitality'))] : []) },
    { title:t('Applications'), items:(S.me.isAdmin || S.me.portalStaff || S.me.portalAdmin || S.me.portal) ? [it('portal', t('YWAM GP Portal'))] : [] },
    { title:t('Admin'), items:[].concat((S.me.isAdmin || S.me.hr) ? [it('hr', t('HR')+(hrN ? ' · '+hrN : ''))] : [], S.me.isAdmin ? [it('admin', t('Admin'))] : []) },
    { title:t('Language'), items:kmrCan_() ? [it('kmreview', t('Khmer review'))] : [] }
  ];
  root.innerHTML = '<div class="scrim" id="menuScrim"></div>'+
    '<div class="drawer">'+
      '<div class="drawerHead"><span class="drawerTitle">✦ '+esc(t('Menu'))+'</span>'+
        '<button class="hbtn icon" id="menuCloseBtn" style="border-color:var(--border2);color:var(--ink)" aria-label="'+esc(t('Dismiss'))+'">'+DRAWER_CLOSE_SVG+'</button></div>'+
      sections.filter(function(sec){ return sec.items.length; }).map(function(sec){
        return (sec.title ? '<div class="drawerSection">'+esc(sec.title)+'</div>' : '')+sec.items.map(function(x){
          return '<button class="drawerItem" data-menu-item="'+x.id+'"><span class="drawerIcon">'+x.icon+'</span>'+
            '<span class="drawerLabel">'+esc(x.label)+'</span></button>';
        }).join('');
      }).join('')+
    '</div>';
  var close=function(){ S.menuOpen=false; renderMenu(); };
  document.getElementById('menuScrim').onclick=close;
  document.getElementById('menuCloseBtn').onclick=close;
  root.querySelectorAll('[data-menu-item]').forEach(function(btn){
    btn.onclick=function(){
      var id=btn.getAttribute('data-menu-item');
      S.menuOpen=false;
      if(id==='ministry'){ S.view='ministry'; render(); }
      else if(id==='base'){ S.view='base'; render(); window.scrollTo(0,0); }
      else if(id==='leave'){ S.view='leave'; render(); }
      else if(id==='mycontract'){ openMyContract_(); }
      else if(id==='library'){ S.view='library'; S.libBook=null; libLoad_(); render(); }
      else if(id==='guestreg' || id==='guestlogin'){ gpLeaveGuest_(id==='guestreg'); }
      else if(id==='ywamgp'){ S.view='ywamgp'; S.person=null; render(); window.scrollTo(0,0); }
      else if(id==='prayer'){ S.view='prayer'; S.pr=null; render(); window.scrollTo(0,0); }
      else if(id==='kmreview'){ S.view='kmreview'; S.kmr=null; S.kmrErr=''; render(); window.scrollTo(0,0); }
      else if(id==='boardlogout'){ boardLeave_(false); }
      else if(id==='profile'){ S.view='profile'; render(); }
      else if(id==='admin'){ S.view='admin'; render(); }
      else if(id==='hr'){ S.view='hr'; S.hrSub='home'; render(); }
      else if(id==='hosp'){ S.view='hosp'; render(); }
      else if(id==='sched'){ schedOpen_('kitchen', false, 'home'); }
      else if(id==='portal'){ renderMenu(); window.open('portal.html', '_blank', 'noopener'); }
      else renderMenu();
    };
  });
}

/* One collapsible row of the Base accordion. `bodyHtml` is only asked for —
   and only lands in the DOM — while the row is open, matching the mockup's
   sc-if; a closed row costs nothing but its own head line. */
var ACC_CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
function accRowHtml(bucketName, id, title, summaryClosed, bodyFn){
  var open = !!S[bucketName][id];
  return '<div class="accRow'+(open?' open':'')+'">'+
    '<button class="accHead" data-acc="'+id+'" data-accbucket="'+bucketName+'">'+
      '<span><div class="accTitle">'+title+'</div><div class="accSummary">'+
        (open?esc(t('Tap to collapse')):summaryClosed)+'</div></span>'+
      '<span class="accChevron" style="transform:rotate('+(open?'180deg':'0deg')+')">'+ACC_CHEVRON+'</span>'+
    '</button>'+
    (open ? '<div class="accBody">'+bodyFn()+'</div>' : '')+
  '</div>';
}

/* The same Base Health figures the Health tab shows (loneliness, clarity,
   habits…), reachable from Base too, on its own period — This Week, a
   quarter, or the whole year — independent of whatever the Health tab's own
   picker is set to. */
var BASE_HEALTH_PERIODS = ['week','q1','q2','q3','q4','year'];
function baseHealthPeriodLabel(id){
  return id==='week' ? t('This Week') : id==='year' ? t('Year (YTD)') : 'Q'+id.slice(1);
}
function baseHealthAccHtml(){
  var period = S.baseHealthPeriod || 'week';
  var R = baseR(); // Year (YTD) is a chip on the year already loaded — no year picker here, unlike the Health tab's
  var ids = [S.me.campus];
  var wk = thisWeek();
  /* Its own block, same as the mockup, so every row can carry a real ▲/▼ —
     against last week, or the previous quarter. Q1 and Year have nothing
     before them to compare to, same as the mockup's own period chips. */
  var rows, score, prevRows;
  if(period==='year'){
    rows = R.surveyRows(ids); score = R.healthScore(ids); prevRows = null;
  } else if(period==='week'){
    rows = R.surveyRows(ids, wk); score = R.healthScore(ids, wk);
    prevRows = R.surveyRows(ids, wk-1);
  } else {
    var q = Number(period.slice(1))-1;
    rows = R.surveyRows(ids, undefined, q); score = R.healthScore(ids, undefined, q);
    prevRows = q>0 ? R.surveyRows(ids, undefined, q-1) : null;
  }
  var cr = (period==='week') ? R.checkinRate(ids, wk) : null;
  var summary = score===null ? t('No check-ins yet.') :
    (cr && cr.total) ? gpT('Score {n}/10 · {pct}% checked in', {n:score.toFixed(1), pct:gpCheckinPct(cr.n,cr.total)})
      : gpT('Score {n}/10', {n:score.toFixed(1)});
  return accRowHtml('baseAcc', 'health', '🏠 '+esc(t('Base Health')), summary, function(){
    var b = '<div class="deptChips">'+BASE_HEALTH_PERIODS.map(function(id){
      return '<button class="deptChip'+(period===id?' on':'')+'" data-baseHealthPeriod="'+id+'">'+esc(baseHealthPeriodLabel(id))+'</button>';
    }).join('')+'</div>';
    b += hxBtnHtml_('base');
    [['lonely','Loneliness (avg, lower is better)', false],
     ['clarity','Clarity (avg)', true],
     ['growth','Personal growth (avg)', true],
     ['langHours','Language study (avg hrs)', true]
    ].forEach(function(q2){
      var v = rows.length ? R.avg(rows, q2[0]) : null;
      var pv = (prevRows && prevRows.length) ? R.avg(prevRows, q2[0]) : null;
      var tr = (v!==null && pv!==null) ? trendBadge(pctChange(pv,v), q2[2]) : '';
      var suffix = (q2[0]==='langHours') ? '' : '/10';
      b+='<div class="row"><span class="rowName">'+esc(t(q2[1]))+'</span>'+
        '<span class="rowVal">'+(v===null?'—':v.toFixed(1)+suffix)+tr+'</span></div>';
    });
    [['sharedFaith','Shared their faith', true],['sabbath','Took a sabbath', true],
     ['porn','Looked at porn', false],['oneOnOne','Had a one-on-one', true],
     ['exercise','Exercised 3+ days', true],['quietTime','Regular quiet time', true],
     ['debt','Have staff debt', false]
    ].forEach(function(q2){
      var p = rows.length ? R.pct(rows, q2[0]) : null;
      var pp = (prevRows && prevRows.length) ? R.pct(prevRows, q2[0]) : null;
      var tr = (p!==null && pp!==null) ? trendBadge(pctChange(pp,p), q2[2]) : '';
      b+='<div class="row"><span class="rowName">'+esc(t(q2[1]))+'</span>'+
        '<span class="rowVal">'+(p===null?'—':p+'%')+tr+'</span></div>';
    });
    return b+'<p class="hint">🔒 '+esc(t('Base figures are totals only — no names, and nobody sees an individual answer.'))+'</p>';
  });
}

/* One card per ministry under a department, every metric it tracks with its
   current figure and trend — the same raw ledger the Base tab's Department
   Explorer shows for any department, reusable here for a department leader's
   own page (My Ministry) so they don't have to leave it to check on the
   ministries they oversee. Read-only either way: nothing here is typed, it's
   all rolled up from what each ministry already logged. */
function deptMinistriesHtml_(dept, R, ids){
  var deps=getDepartments(S.me.campus);
  if(!deps[dept]) return '';
  var entries=(S.base && S.base.entries || {})[S.me.campus]||{};
  var b='';
  Object.keys(deps[dept]).forEach(function(min){
    b+='<div class="card"><div class="row" style="border-bottom:2px solid var(--ink)">'+
       '<span class="rowName" style="font-weight:700">'+(MIN_EMOJI[min]?MIN_EMOJI[min]+' ':'')+esc(t(min))+'</span><span></span></div>';
    deps[dept][min].forEach(function(metric){
      var mode=modeOf(metric);
      var mkey=dept+'|'+min+'|'+metric;
      var v=aggregate(entries[mkey], mode);
      var lbl=mode==='latest'?'now':(mode==='avg'?'avg':'YTD');
      var tr=R.trendFor(function(w){
        var en=entries[mkey];
        return (en && en[w]!==undefined && en[w]!==null && !isNaN(Number(en[w]))) ? Number(en[w]) : null;
      }, metric);
      b+='<div class="row drillable"'+gpDrillAttrs(metric, ids, dept, min)+'>'+
         '<span class="rowName">'+esc(t(metric))+' <span style="color:var(--faint);font-size:11px">'+lbl+'</span></span>'+
         '<span class="rowVal">'+fmt(v,metric)+tr+'</span></div>';
    });
    b+='</div>';
  });
  return b;
}

function baseHtml(){
  var wk=thisWeek();
  var ids=[S.me.campus];
  var R=baseR();
  var LD=LD_DEPT, CS=CS_DEPT;

  /* The name-and-face greeting used to open here, but Base is ministry stats,
     not a personal page — it now lives on My Home's own hero instead. */
  var h='';

  /* Asked once of the people who have not answered: these two are the only facts
     the base counts people by, so an unanswered one is a hole in the very figures
     underneath it. */
  if(!S.guest && (!S.me.staffType || !S.me.country)){
    h+='<div class="banner">'+esc(t('Say what kind of staff you are and where you are from — it is what these numbers count.'))+
       ' <button class="linkbtn inline" id="goProfileMix">'+esc(t('Add it to my profile'))+'</button></div>';
  }

  if(!S.base){
    return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading your base…'))+'</p></div>';
  }

  /* --- the hero: who we are, then what happened --- */
  var staff=R.totalStaff(ids);
  h+='<div class="hero"><div class="heroLabel">'+esc(t(campusName(S.me.campus)).toUpperCase())+' · '+esc(t('WEEK'))+' '+wk+'</div>'+
     '<div class="heroNum"'+(staff===null?'':' data-count="'+staff+'"')+'>'+(staff===null?'—':'0')+'</div>'+
     '<div class="heroLabel" style="letter-spacing:2px">'+esc(t('STAFF'))+'</div>';
  /* The headline counts everyone here. This is the same people split by what kind
     of staff they are and where they are from — one function, shared with the
     dashboard, so the base is never described two ways. */
  h+=gpStaffMixHtml(R.staffBreakdown(ids));
  var cr=R.checkinRate(ids, wk);
  if(cr.total && cr.total>0){
    var crp = gpCheckinPct(cr.n, cr.total);
    h+='<div class="heroRow">'+gpRingHtml(crp, 'sm', t('Checked in this week'))+
       '<div class="heroTrend">'+esc(t('Checked in this week'))+' <b class="heroFig">'+cr.n+'</b> / '+cr.total+
       ' · '+crp+'%</div></div>';
  }
  var hs=R.healthScore(ids);
  if(hs!==null){
    h+='<div class="heroRow">'+gpRingHtml(Math.round(hs*10), 'sm', t('Staff Health Score'))+
       '<div class="heroTrend">'+esc(t('Staff Health Score'))+' <b class="heroFig">'+hs.toFixed(1)+'</b>/10 '+
       R.trendFor(function(w){return R.healthScore(ids,w);}, null)+'</div></div>';
  }
  h+='<div class="heroSub"><div class="heroSubRow drillable"'+gpDrillAttrs('Salvations', ids)+'>'+
     '<span class="heroSubLabel">'+esc(t('SALVATIONS — YTD'))+'</span>'+
     '<span class="heroSubNum">'+fmt(R.headlineFor(ids,'Salvations'))+'</span></div>'+
     '<div class="heroQ">';
  for(var q=0;q<4;q++){
    h+='<span class="drillable"'+gpDrillAttrs('Salvations', ids, null, null, q)+'>Q'+(q+1)+
       ' <b>'+fmt(R.headlineFor(ids,'Salvations',q))+'</b></span>';
  }
  h+='</div></div></div>';

  /* --- everything else, one collapsible accordion (the redesign mockup's
     Base tab): landing here shows what changed, not every figure the base
     tracks. Summaries are computed either way — they're what a closed row
     shows — only each row's full body is built lazily, on open. */
  var bd=R.salvByDept(ids);
  var myDept=S.me.dept==='Base Director' ? 'Campus Leadership' : S.me.dept;
  h+='<div class="accCard">';

  h+=accRowHtml('baseAcc', 'salv', '🙌 '+esc(t('Salvations by Department')),
    gpT('{n} YTD across {d} departments', {n:fmt(R.headlineFor(ids,'Salvations')), d:Object.keys(bd).length}),
    function(){
      var b='<div class="card">';
      Object.keys(bd).forEach(function(d){
        var isMine=(d===myDept);
        b+='<div class="row drillable"'+gpDrillAttrs('Salvations', ids, d)+'>'+
           '<span class="rowName">'+(MIN_EMOJI[d]?MIN_EMOJI[d]+' ':'')+esc(t(d))+
           (isMine?' <span class="chip blue" style="padding:1px 8px;font-size:11px">'+esc(t('yours'))+'</span>':'')+
           '</span><span class="'+(isMine?'pctSm':'rowVal')+'">'+fmt(bd[d])+'</span></div>';
      });
      return b+'</div>';
    });

  h+=accRowHtml('baseAcc', 'ld', '🌱 '+esc(t('Leadership Development Schools')),
    gpT('{s} schools running · {n} enrolled', {s:fmt(R.ldSchools(ids)), n:fmt(R.ldStudents(ids))}),
    function(){
      return '<div class="grid">'+
        bstat('Schools', R.ldSchools(ids))+
        bstat('Students Enrolled', R.ldStudents(ids), null, '', gpDrillAttrs('Students Enrolled', ids, LD))+
        bstat('Students Graduated', R.ldGraduates(ids), null,
          R.trendFor(function(w){return R.ministryRollupWeek(ids, LD, LD_SCHOOL_MINISTRIES, 'Students Graduated', w);}, 'Students Graduated'),
          gpDrillAttrs('Students Graduated', ids, LD))+
        bstat('Potential Staff', R.ministryRollup(ids, LD, LD_SCHOOL_MINISTRIES, 'Potential Staff'), null, '',
          gpDrillAttrs('Potential Staff', ids, LD))+
        '</div>'+
        bquarters('Students Enrolled', function(q){ return R.ldStudents(ids,q); },
          function(q){ return gpDrillAttrs('Students Enrolled', ids, LD, null, q); });
    });

  /* Three of these open and three do not, and the line between them is whether a
     breakdown would ADD UP to the number above it — see the same note on the
     dashboard. Schools is a count of ministries reporting; Total Volunteer Hours
     is Σ(hours × volunteers). */
  h+=accRowHtml('baseAcc', 'cs', '📚 '+esc(t('Community Schools')),
    CS_SCHOOL_MINISTRIES.filter(function(m){ return ids.some(function(cid){ return !!(getDepartments(cid)['Community Service']||{})[m]; }); })
      .concat(YE_SCHOOL_MINISTRIES).map(function(m){ return esc(t(m)); }).join(' · '),
    function(){
      return '<div class="grid">'+
        bstat('Schools', R.communitySchools(ids))+
        bstat('Students Enrolled', R.communityStudents(ids), null, '',
          gpDrillGroupAttrs(['Students Enrolled','Youth Enrolled'], ids,
            CS_SCHOOL_MINISTRIES.concat(YE_SCHOOL_MINISTRIES), t('Community Schools')))+
        bstat('Students in Discipleship', R.communityDiscipled(ids), null, '',
          gpDrillGroupAttrs('Students in Discipleship', ids,
            CS_SCHOOL_MINISTRIES.concat(YE_SCHOOL_MINISTRIES), t('Community Schools')))+
        bstat('Students Supported Financially',
          R.ministryRollup(ids, CS, CS_SCHOOL_MINISTRIES, 'Students Supported Financially'), null, '',
          gpDrillAttrs('Students Supported Financially', ids, CS))+
        '</div>'+
        bquarters('Students Enrolled', function(q){ return R.communityStudents(ids,q); },
          function(q){ return gpDrillGroupAttrs(['Students Enrolled','Youth Enrolled'], ids,
            CS_SCHOOL_MINISTRIES.concat(YE_SCHOOL_MINISTRIES), t('Community Schools'), q); });
    });

  h+=accRowHtml('baseAcc', 'out', '🙌 '+esc(t('Outreach Teams')),
    gpT('{n} teams hosted · {m} people served', {n:fmt(R.outreachRollup(ids,'Teams Hosted')), m:fmt(R.headlineFor(ids,'People Served'))}),
    function(){
      return '<div class="grid">'+
        bstat('Teams Hosted', R.outreachRollup(ids,'Teams Hosted'), null,
          R.trendFor(function(w){return R.ministryRollupWeek(ids, CS, ['Outreach Teams'], 'Teams Hosted', w);}, 'Teams Hosted'),
          gpDrillAttrs('Teams Hosted', ids, CS, 'Outreach Teams'))+
        bstat('Volunteers Mobilized', R.outreachRollup(ids,'Volunteers Mobilized'), null, '',
          gpDrillAttrs('Volunteers Mobilized', ids, CS, 'Outreach Teams'))+
        bstat('Total Volunteer Hours', R.volunteerHours(ids))+
        bstat('People Served', R.headlineFor(ids,'People Served'), null,
          R.trendFor(function(w){return R.metricWeekSum(ids,'People Served',w);}, 'People Served'),
          gpDrillAttrs('People Served', ids))+
        bstat('Salvations', R.outreachRollup(ids,'Salvations'), null, '',
          gpDrillAttrs('Salvations', ids, CS, 'Outreach Teams'))+
        bstat('Baptisms', R.outreachRollup(ids,'Baptisms'), null, '',
          gpDrillAttrs('Baptisms', ids, CS, 'Outreach Teams'))+
        bstat('People Connected to Local Church', R.outreachRollup(ids,'People Connected to Local Church'), null, '',
          gpDrillAttrs('People Connected to Local Church', ids, CS, 'Outreach Teams'))+
        '</div>'+
        bquarters('Teams Hosted', function(q){ return R.outreachRollup(ids,'Teams Hosted',q); },
          function(q){ return gpDrillAttrs('Teams Hosted', ids, CS, 'Outreach Teams', q); });
    });

  h+=accRowHtml('baseAcc', 'church', '⛪ '+esc(t('Local Church Partnerships')),
    gpT('{n} churches partnered', {n:fmt(R.partnerChurches(ids))}),
    function(){
      return '<div class="grid">'+
        bstat('Local Churches Partnered', R.partnerChurches(ids), null, '',
          gpDrillGroupAttrs(['Partner Churches Supported','Churches Being Led'], ids,
            ['Church Partnerships'], t('Local Church Partnerships')))+
        bstat('Partner Churches Supported',
          R.ministryRollup(ids, LD, ['Church Partnerships'], 'Partner Churches Supported'), null, '',
          gpDrillAttrs('Partner Churches Supported', ids, LD, 'Church Partnerships'))+
        bstat('Churches Being Led',
          R.ministryRollup(ids, LD, ['Church Partnerships'], 'Churches Being Led'), null, '',
          gpDrillAttrs('Churches Being Led', ids, LD, 'Church Partnerships'))+
        bstat('Combined Congregation Attendance',
          R.ministryRollup(ids, LD, ['Church Partnerships'], 'Combined Congregation Attendance'), null, '',
          gpDrillAttrs('Combined Congregation Attendance', ids, LD, 'Church Partnerships'))+
        bstat('People Connected to Local Church', R.headlineFor(ids,'People Connected to Local Church'), null,
          R.trendFor(function(w){return R.metricWeekSum(ids,'People Connected to Local Church',w);}, 'People Connected to Local Church'),
          gpDrillAttrs('People Connected to Local Church', ids))+
        bstat('Spoke at Churches', R.blAggAll(ids,'Spoke at Churches'))+
        '</div>';
    });

  var GOSPEL_METRICS=['Baptisms','People Heard the Gospel','Healings'];
  h+=accRowHtml('baseAcc', 'gospel', '🕊️ '+esc(t('Gospel Totals')),
    GOSPEL_METRICS.map(function(m){ return esc(t(m)); }).join(' · '),
    function(){
      var b='<div class="grid">';
      GOSPEL_METRICS.forEach(function(m){
        b+=bstat(m, R.headlineFor(ids,m), m,
          R.trendFor(function(w){return R.metricWeekSum(ids,m,w);}, m),
          gpDrillAttrs(m, ids));
      });
      return b+'</div>';
    });

  var ms=R.mediaSummary(ids);
  h+=accRowHtml('baseAcc', 'media', '📱 '+esc(t('Media reach')),
    ms ? gpT('{p} platforms · {f} followers', {p:fmt(ms.platforms), f:fmt(ms.followers)}) : t('Nothing logged yet'),
    function(){
      return '<div class="grid">'+
        bstat('Platforms', ms?ms.platforms:null)+
        bstat('Total Pages', ms?ms.pages:null)+
        bstat('Total Followers', ms?ms.followers:null)+
        bstat('Views YTD', ms?ms.views:null)+
        '</div>';
    });

  /* --- base leadership: the department leaders' own figures ---
     These come from Campus Leadership, where each department reports on how it is
     being led rather than what it produced — distinct from the Base Health row
     below, which is everyone's own weekly wellbeing check-in. The two money
     metrics are stripped server-side for anyone without the leadership code, so
     they simply read as "no figure" here. */
  h+=accRowHtml('baseAcc', 'baseKpi', '🏠 '+esc(t('Campus Leadership')), t('Department leaders’ own figures'),
    function(){
      var b='<div class="grid">';
      ['Staff Debt ($)','One-on-Ones Held','Partner Connections','Spoke at YWAM Bases',
       'Hours Sharing the Gospel','Base Vision (1-10)','Communications (1-10)',
       'Partner Relationships (1-10)'].forEach(function(m){
        b+='<div class="stat"><div class="statNum">'+fmt(R.blAgg(S.me.campus,m),m)+'</div>'+
           '<div class="statLabel">'+esc(t(m).replace(' ($)','').replace(' (1-10)',''))+'</div></div>';
      });
      return b+'</div>';
    });

  h+=baseHealthAccHtml();

  /* --- every metric, by department ---
     The tiles above are the roll-ups; this is the raw ledger behind them, one
     card per ministry. Same picker the dashboard uses, scoped to this campus. */
  var deps=getDepartments(S.me.campus);
  if(!S.baseDept || !deps[S.baseDept]) S.baseDept = (deps[myDept] ? myDept : Object.keys(deps)[0]);
  h+=accRowHtml('baseAcc', 'explorer', '🗂️ '+esc(t('Department Explorer')), t('Browse any department’s own numbers'),
    function(){
      var b='<div class="pickerRow"><label class="pick"><span>'+esc(t('Department'))+'</span>'+
        '<select id="baseDeptSel">'+Object.keys(deps).map(function(d){
          return '<option value="'+esc(d)+'"'+(S.baseDept===d?' selected':'')+'>'+
            (MIN_EMOJI[d]?MIN_EMOJI[d]+' ':'')+esc(t(d))+'</option>';
        }).join('')+'</select></label></div>';
      b+=deptMinistriesHtml_(S.baseDept, R, ids);
      return b;
    });

  h+='</div>';

  h+='<p class="hint" style="margin-top:14px">'+
     esc(t('Every figure here is built from what each ministry logs each week — including yours.'))+
     ' '+esc(t('Tap any number to see which ministries and weeks it came from.'))+'</p>';
  return h;
}

/* Base Health, for Siem Reap only — the plain avg/pct list further down in
   healthHtml() is for every OTHER campus; Siem Reap gets this instead, not
   both, because a one-time import (Jan-Jul 2026, Siem Reap only — see
   sr-checkin-history.js) exists for it and Uriah wants one section, not the
   import sitting next to Base Health's own numbers. Every yes/no question
   Base Health used to list for Siem Reap is here too (see SR_CHECKIN_
   QUESTIONS — some carry real imported history, some are live-only), so this
   IS Base Health for this campus, just with an extra quarter or two of
   history under the ones that have it. The 1-10 scales and hour totals
   (clarity, growth, loneliness, language/ministry hours) have no percentage
   to plot and are left out, same as Uriah asked.

   Every submission in the import was anonymous, so it can only ever be
   team-wide — never folded into anyone's personal health score. The app's
   own weekly check-in now asks the same questions (reworded to match — see
   WEEK_YESNO_QS / WEEK_MONTHLY_QS), so srCheckinPoints_ below appends live
   Siem Reap answers onto the same series the moment the import stops: one
   continuous line, not an old dataset next to a new one. Rendered
   defensively: sr-checkin-history.js is data-optional like km.js, so a
   missing file just means this card doesn't appear rather than breaking
   the page.

   One period at a time — Month, Quarter (the original picker) or Year, same
   three-way View picker the generic Base health section already uses — with
   two views of that period: a line chart of the overall trend (each
   question's "good" direction, so a climbing line always means things got
   better — the same flip lonely/porn/debt already get everywhere else in
   this app) and a bar chart of that period's raw "% said yes" per
   question, which is what the plain numbers elsewhere on the page mean too.
   Year has no year picker of its own (same reasoning as the generic Base
   health section: there's only ever been one year of data so far), so it
   just means "everything" — which for now reads the same as year-to-date.
   Both animate in on render via gpAnimateBars/gpAnimateLine (rollup.js) —
   same "grow from nothing" idea as gpAnimateCounts, just for shapes instead
   of digits. */
function srCheckinPoints_(q){
  var pts=[];
  (SR_CHECKIN_MANUAL_MONTHS||[]).forEach(function(m){
    if(m.pct[q.id]!==undefined){
      pts.push({month:m.month, label:SR_MONTHS_[m.month-1]+' '+m.year, pct:m.pct[q.id],
        good: q.lowerBetter ? 100-m.pct[q.id] : m.pct[q.id]});
    }
  });
  SR_CHECKIN_WEEKS.forEach(function(w){
    var qq=w.q[q.id];
    if(!qq) return;
    var month=Number(w.date.slice(5,7));
    var pct=Math.round(qq.yes/qq.n*100);
    pts.push({month:month, label:w.date.slice(5), pct:pct, good: q.lowerBetter ? 100-pct : pct});
  });
  /* Live data picks up right where the import stopped — the app's own
     weekly check-in now asks this exact question (q.liveId), so it's
     aggregated for Siem Reap the same way Base Health aggregates any other
     weekly question, and appended to the same series. One line, not two. */
  if(q.liveId && S.base){
    var R = baseR();
    var monthly = q.id.charAt(0)==='m';
    var cur = thisWeek();
    for(var wk=1; wk<=cur; wk++){
      var b = weekBounds_(wk);
      if(b.to <= SR_HISTORY_CUTOFF) continue;
      if(monthly && !isMonthEndWeek_(wk)) continue;
      var pct = R.pct(R.surveyRows(['siemreap'], wk), q.liveId);
      if(pct===null) continue;
      pts.push({month:Number(b.to.slice(5,7)), label:b.to.slice(5), pct:pct, good: q.lowerBetter ? 100-pct : pct});
    }
  }
  return pts;
}
var SR_MONTHS_=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/* scope is 'month' | 'quarter' | 'year'; month is 1-12, quarter is 1-4 —
   only the one that matches scope is used. */
function srScopeMatcher_(scope, month, quarter){
  if(scope==='month') return function(m){ return m===month; };
  if(scope==='year') return function(){ return true; };
  return function(m){ return Math.ceil(m/3)===quarter; };
}
function srCheckinForScope_(scope, month, quarter){
  var inPeriod = srScopeMatcher_(scope, month, quarter);
  // one row per data point in the period: { label, good } averaged across
  // whichever questions actually have that point, so the line has one value
  // per week/month rather than one per question.
  var byPoint = {};
  var order = [];
  SR_CHECKIN_QUESTIONS.forEach(function(q){
    srCheckinPoints_(q).filter(function(p){ return inPeriod(p.month); }).forEach(function(p){
      if(!byPoint[p.label]){ byPoint[p.label]={label:p.label, sum:0, n:0}; order.push(p.label); }
      byPoint[p.label].sum += p.good; byPoint[p.label].n++;
    });
  });
  var line = order.map(function(l){ return {label:l, pct:Math.round(byPoint[l].sum/byPoint[l].n)}; });
  // one bar per question: its own average raw "% yes" across the period, plus
  // its own points (same shape a line chart wants) so tapping it can show its
  // own trend without recomputing anything.
  var bars = SR_CHECKIN_QUESTIONS.map(function(q){
    var pts = srCheckinPoints_(q).filter(function(p){ return inPeriod(p.month); });
    if(!pts.length) return null;
    var avg = Math.round(pts.reduce(function(s,p){ return s+p.pct; },0)/pts.length);
    return {id:q.id, label:q.en, pct:avg, points:pts.map(function(p){ return {label:p.label, pct:p.pct}; })};
  }).filter(Boolean);
  return {line:line, bars:bars};
}
function srScopeNoun_(scope){
  return scope==='month' ? t('month') : scope==='year' ? t('year') : t('quarter');
}
function srLineChartHtml_(points, scopeNoun){
  if(points.length<2) return '<p class="emptyLine">'+esc(gpT('Not enough data points this {scope} for a trend line.',{scope:scopeNoun||t('quarter')}))+'</p>';
  var W=280, H=90, pad=8;
  var step=(W-pad*2)/(points.length-1);
  var xy=points.map(function(p,i){ return [pad+i*step, pad+(H-pad*2)*(1-p.pct/100)]; });
  var path='M'+xy.map(function(p){ return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' L');
  var dots=xy.map(function(p,i){ return '<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.6" fill="var(--accent)"><title>'+esc(points[i].label)+': '+points[i].pct+'%</title></circle>'; }).join('');
  return '<div class="srChartReveal"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" class="srLineChart" role="img" aria-label="'+
    esc(gpT('Trend, {a} to {b}',{a:points[0].label,b:points[points.length-1].label}))+'">'+
    '<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'+
    dots+'</svg></div>'+
    '<div class="pmeta" style="display:flex;justify-content:space-between;margin-top:2px">'+
    '<span>'+esc(points[0].label)+'</span><span>'+esc(points[points.length-1].label)+'</span></div>';
}
/* Each question is its own comparison: the bar shows the quarter at a
   glance, tapping it opens that question's own trend line right underneath
   — one open at a time, so comparing two is still just two taps, not a wall
   of ten charts nobody asked to see. */
function srBarChartHtml_(bars, openId, scopeNoun){
  if(!bars.length) return '<p class="emptyLine">'+esc(gpT('No data for this {scope}.',{scope:scopeNoun||t('quarter')}))+'</p>';
  var h='<div class="srBars">';
  bars.forEach(function(b){
    var open = openId===b.id;
    h+='<div class="srBarItem">'+
      '<button class="srBarRow" data-sropen="'+esc(b.id)+'" aria-expanded="'+(open?'true':'false')+'">'+
        '<span class="rowName" style="font-size:12.5px">'+esc(t(b.label))+'</span>'+
        '<div class="srBarTrack"><div class="srBarFill" data-bar="'+b.pct+'" style="width:0%"></div></div>'+
        '<span class="srBarPct">'+b.pct+'%</span>'+
        '<span class="chev">'+(open?'▴':'▾')+'</span>'+
      '</button>'+
      (open ? '<div class="srBarChart">'+srLineChartHtml_(b.points, scopeNoun)+'</div>' : '')+
    '</div>';
  });
  return h+'</div>';
}
function srCheckinHistoryHtml(){
  if(S.me.campus!=='siemreap') return '';
  if(typeof SR_CHECKIN_QUESTIONS==='undefined' || typeof SR_CHECKIN_WEEKS==='undefined') return '';
  var scope = S.srScope || 'quarter';
  var curQ = Math.ceil((new Date().getMonth()+1)/3);
  var q = Number(S.srQuarter || curQ);
  var m = Number(S.srMonth!=null ? S.srMonth : new Date().getMonth()+1); // 1-12
  var data = srCheckinForScope_(scope, m, q);
  var scopeNoun = srScopeNoun_(scope);
  var h='<h3 style="margin-top:16px">🏠 '+esc(t('Base health'))+' · '+esc(t(campusName(S.me.campus)))+'</h3>';
  h+=hxBtnHtml_('health');
  h+='<div class="card">'+
    '<div class="pmeta" style="margin-bottom:8px">'+
    esc(t('Starts with a Jan–Jul 2026 import from a separate check-in tool, then continues from the weekly check-in below. Team-wide and anonymous — not linked to any individual profile.'))+
    '</div>'+
    '<div class="pickerRow">'+
      '<label class="pick"><span>'+esc(t('View'))+'</span><select id="srScopeSel">'+
        [['month','Month'],['quarter','Quarter'],['quarters','Quarter by quarter'],['year','Year']].map(function(sc){
          return '<option value="'+sc[0]+'"'+(scope===sc[0]?' selected':'')+'>'+esc(t(sc[1]))+'</option>';
        }).join('')+'</select></label>'+
      (scope==='month' ? '<label class="pick" style="max-width:120px"><span>'+esc(t('Month'))+'</span><select id="srMSel">'+
        MONTH_ABBR.map(function(mn,i){ return '<option value="'+(i+1)+'"'+(m===(i+1)?' selected':'')+'>'+mn+'</option>'; }).join('')+
        '</select></label>' : '')+
      (scope==='quarter' ? '<label class="pick" style="max-width:120px"><span>'+esc(t('Quarter'))+'</span><select id="srQSel">'+
        [1,2,3,4].map(function(i){ return '<option value="'+i+'"'+(q===i?' selected':'')+'>Q'+i+'</option>'; }).join('')+
        '</select></label>' : '')+
    '</div>'+
    '</div>';
  if(scope==='quarters') return h + hqHtml_();
  h+='<div class="card">'+
    '<div class="mentorLabel">'+esc(t('Overall trend (higher is better)'))+'</div>'+
    srLineChartHtml_(data.line, scopeNoun)+
    '<div class="mentorDivider"></div>'+
    '<div class="mentorLabel">'+esc(gpT('This {scope}, by question',{scope:scopeNoun||t('quarter')}))+'</div>'+
    '<p class="pmeta" style="margin:0 0 8px">'+esc(t('Tap a question to see its own trend.'))+'</p>'+
    srBarChartHtml_(data.bars, S.srOpenQ, scopeNoun)+
  '</div>';
  return h;
}

