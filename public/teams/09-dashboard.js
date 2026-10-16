/* The leadership dashboard — S.view 'dashboard' in My YWAM GP (☰ → Dashboard, or
   teams.html?view=dashboard; index.html sends here now). Until Oct 2026 this was
   index.html's own page; it moved in unchanged so the app is one page. Dashboard,
   Log Numbers and OKRs by campus or all campuses combined, the leadership code (🔒)
   for the two money figures and editing, per-department dashboards.

   Kept in its own function scope on purpose: its names (state, render, t, esc, R,
   lsGet…) are the dashboard's own and must not meet the app's. The app draws the
   frame (gpDashboard.html()) and calls gpDashboard.mount() after; the styles are
   teams/dashboard.css, every rule under .dashView. */
(function(){
function emj(name){ return MIN_EMOJI[name] ? '<span class="mEmoji">'+MIN_EMOJI[name]+'</span>' : ''; }

/* logo.js is loaded data-optional (see the error boundary), so every use of the
   marks has to survive it being absent. Emit no <img> at all rather than one
   with an empty src — the coin is still a coin, just without the logo in it. */
function logoImg(cls){
  if(typeof GP_LOGO !== 'string') return '';
  return '<img class="'+cls+'" src="'+GP_LOGO+'" alt="">';
}

/* Lives in rollup.js now, so the staff page counts its numbers up the same way. */
function animateCounts(){ gpAnimateCounts(); }


function ring(p, size){
  p = Math.max(0, Math.round(p));
  var shown = Math.min(100, p);
  var r = (size-10)/2, c = 2*Math.PI*r, off = c*(1-shown/100);
  var cx = size/2;
  return '<svg class="ring'+(p>=100?' done':'')+'" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'+
    '<circle class="ringBg" cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke-width="6"/>'+
    '<circle class="ringFg" cx="'+cx+'" cy="'+cx+'" r="'+r+'" fill="none" stroke-width="6" stroke-linecap="round" '+
      'stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 '+cx+' '+cx+')"/>'+
    '<text x="'+cx+'" y="'+(cx+5)+'" text-anchor="middle" font-size="'+(size*0.28)+'">'+p+'%</text></svg>';
}


var VERSES = [
 {en:'Go and make disciples of all nations.', km:'\u1785\u17bc\u179a\u1791\u17c5 \u1794\u1784\u17d2\u1780\u17be\u178f\u179f\u17b7\u179f\u17d2\u179f\u1782\u17d2\u179a\u1794\u17cb\u1787\u17b6\u178f\u17b7\u179f\u17b6\u179f\u1793\u17cd\u17d4', ref:'Matthew 28:19'},
 {en:'Let us not grow weary of doing good.', km:'\u1780\u17bb\u17c6\u178e\u17b6\u1799\u1785\u17b7\u178f\u17d2\u178f\u1780\u17d2\u1793\u17bb\u1784\u1780\u17b6\u179a\u1792\u17d2\u179c\u17be\u179b\u17d2\u17a2\u17a1\u17be\u1799\u17d4', ref:'Galatians 6:9'},
 {en:'Unless the LORD builds the house, the builders labor in vain.', km:'\u1794\u17be\u1796\u17d2\u179a\u17c7\u17a2\u1798\u17d2\u1785\u17b6\u179f\u17cb\u1798\u17b7\u1793\u179f\u1784\u17cb\u1795\u17d2\u1791\u17c7\u1791\u17c1 \u17a2\u17d2\u1793\u1780\u179f\u1784\u17cb\u1780\u17cf\u1781\u17c6\u1794\u17d2\u179a\u17b9\u1784\u17a5\u178f\u1794\u17d2\u179a\u1799\u17c4\u1787\u1793\u17cd\u17d4', ref:'Psalm 127:1'},
 {en:'Do not despise these small beginnings.', km:'\u1780\u17bb\u17c6\u1798\u17be\u179b\u1784\u17b6\u1799\u1780\u17b6\u179a\u1785\u17b6\u1794\u17cb\u1795\u17d2\u178f\u17be\u1798\u178f\u17bc\u1785\u17d7\u17a1\u17be\u1799\u17d4', ref:'Zechariah 4:10'},
 {en:'Your labor in the Lord is not in vain.', km:'\u1780\u17b6\u179a\u1784\u17b6\u179a\u179a\u1794\u179f\u17cb\u17a2\u17d2\u1793\u1780\u1780\u17d2\u1793\u17bb\u1784\u1796\u17d2\u179a\u17c7\u17a2\u1798\u17d2\u1785\u17b6\u179f\u17cb\u1798\u17b7\u1793\u17a5\u178f\u1794\u17d2\u179a\u1799\u17c4\u1787\u1793\u17cd\u1791\u17c1\u17d4', ref:'1 Corinthians 15:58'},
 {en:'Here am I. Send me!', km:'\u1781\u17d2\u1789\u17bb\u17c6\u1793\u17c5\u1791\u17b8\u1793\u17c1\u17c7 \u179f\u17bc\u1798\u1785\u17b6\u178f\u17cb\u1781\u17d2\u1789\u17bb\u17c6\u1791\u17c5!', ref:'Isaiah 6:8'},
 {en:'The harvest is plentiful, but the workers are few.', km:'\u1785\u1798\u17d2\u179a\u17bc\u178f\u1798\u17b6\u1793\u1785\u17d2\u179a\u17be\u1793 \u178f\u17c2\u17a2\u17d2\u1793\u1780\u1792\u17d2\u179c\u17be\u1780\u17b6\u179a\u1798\u17b6\u1793\u178f\u17b7\u1785\u17d4', ref:'Matthew 9:37'},
 {en:'Work heartily, as for the Lord.', km:'\u1792\u17d2\u179c\u17be\u1780\u17b6\u179a\u17a2\u179f\u17cb\u1796\u17b8\u1785\u17b7\u178f\u17d2\u178f \u178a\u17bc\u1785\u1792\u17d2\u179c\u17be\u1790\u17d2\u179c\u17b6\u1799\u1796\u17d2\u179a\u17c7\u17a2\u1798\u17d2\u1785\u17b6\u179f\u17cb\u17d4', ref:'Colossians 3:23'}
];
function verseOfWeek(){
  var v = VERSES[(currentWeek()-1) % VERSES.length];
  var text = state.lang==='km' ? v.km : v.en;
  return '<div class="verse">\ud83d\udcd6 \u201c'+text+'\u201d — <b>'+v.ref+'</b></div>';
}

/* Staff counts and check-in rates come from the shared engine (rollup.js) —
   accounts first, the logged 'Total Staff' figure as the fallback. */
function totalStaff(ids){ return R().totalStaff(ids); }
function staffBreakdown(ids){ return R().staffBreakdown(ids); }
function checkinRate(ids, week){ return R().checkinRate(ids, week); }


/* Open on your own campus when we know which one it is. A staff member logging
   their week shouldn't have to notice the selector is pointed at the other base
   — that is exactly how a week of Poipet numbers lands on Siem Reap. Still
   switchable: reading across campuses is normal, and the hard lock waits until
   everyone has an account. */
function myCampus(){
  try {
    var c = JSON.parse(localStorage.getItem('gp-staff-card')||'null');
    if(c && c.campus){
      for(var i=0;i<CAMPUSES.length;i++) if(CAMPUSES[i].id===c.campus) return c.campus;
    }
  } catch(e){}
  return null;
}

/* localStorage is not always there to be read. With storage blocked, or a Safari
   private window near its quota, getItem and setItem throw instead of returning
   null — and these are called while the page is still booting, so an unguarded
   one is a blank screen. Losing a saved preference is fine; losing the page is not. */
function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
function lsSet(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }

var state = {
  data:{ leader:false, entries:{}, okrs:[], survey:[] }, roster:null,
  campus: myCampus() || 'poipet', view:'dashboard',
  week:1, dept:'Community Service', ministry:'Outreach Teams', loaded:false,
  okrQuarter: Math.floor(new Date().getMonth()/3)+1, okrFormOpen:false, editingId:null,
  /* Reading localStorage can throw outright, not just return null, when a browser
     has storage blocked — and this runs while state is being built, so an
     unguarded read there is a blank page rather than a degraded one. */
  lang: lsGet('gp-lang') || 'en', km: {},
  dashDept:'Community Service',
  leaderCode: lsGet('gp-leadercode') || ''
};

/* ---------- weeks & dates ----------
   The same rule as isoWeekOf / weekYearOf in teams.html and isoWeek_ / weekYear_
   in api.js: week 1 is the Monday–Sunday week that holds 1 January, so 28–31
   December 2026 are already week 1 of 2027. currentWeekYear() is the year that
   goes with currentWeek(), and the one getData answers with when asked for none.
   (When next year's 1 January is a Monday, the last days of December still clamp
   onto week 52 of their own year — see weekYear_.) */
function weekYearOf(d){
  var y = d.getFullYear(), jan1 = new Date(y + 1, 0, 1);
  var nextW1 = new Date(y + 1, 0, 1 - ((jan1.getDay() + 6) % 7));
  return d >= nextW1 ? y + 1 : y;
}
function currentWeekYear(){ return weekYearOf(new Date()); }
function mondayOfW1(year){
  var y = year ? Number(year) : currentWeekYear();
  var jan1 = new Date(y, 0, 1);
  return new Date(y, 0, 1 - ((jan1.getDay() + 6) % 7));
}
function weekRange(w, year){
  var start = new Date(mondayOfW1(year).getTime() + (w-1)*7*86400000);
  var end = new Date(start.getTime() + 6*86400000);
  return [start, end];
}
function fmtDate(d){
  var loc = state.lang === 'km' ? 'km-KH' : 'en-US';
  try { return d.toLocaleDateString(loc, { month:'short', day:'numeric' }); }
  catch(e){ return (d.getMonth()+1)+'/'+d.getDate(); }
}
function weekLabel(w){
  var r = weekRange(w);
  return 'W'+w+' · '+fmtDate(r[0])+'–'+fmtDate(r[1])+' · Q'+(qOf(w)+1);
}
function currentWeek(){
  var now = new Date(), diff = Math.floor((now - mondayOfW1(weekYearOf(now))) / (7*86400000)) + 1;
  return Math.max(1, Math.min(52, diff));
}
state.week = currentWeek();
/* qOf(), fmt(), aggregate() and lastBefore() are shared globals from rollup.js. */

/* ---------- i18n ---------- */
function t(s){ if(state.lang==='en') return s; return BUILTIN_KM[s] || state.km[s] || s; }

function toggleLang(){
  // No live machine-translation fallback here (that needed Apps Script's
  // LanguageApp, which doesn't exist outside it). Untranslated strings just
  // show in English via t()'s existing fallback — BUILTIN_KM already covers
  // the vast majority of what's on screen.
  state.lang = state.lang==='km' ? 'en' : 'km';
  lsSet('gp-lang', state.lang);
  render();
}

/* ---------- the roll-up engine ----------
   Every figure on this page is computed in rollup.js, which teams.html shares
   so a staff member sees their base's numbers built by exactly this arithmetic.
   What stays here is the wiring: R() hands the engine whatever data is loaded
   right now, and the one-liners below keep this page's call sites unchanged.

   The instance is rebuilt only when the data object itself is replaced, which
   is what a load does — so a render costs one engine, not one per figure. */
var _roll = null;
function R(){
  var d = state.data;
  if(!_roll || _roll.e!==d.entries || _roll.s!==d.survey || _roll.r!==state.roster){
    _roll = { e:d.entries, s:d.survey, r:state.roster,
      api: gpRollup({ entries:d.entries, survey:d.survey, roster:state.roster, week:currentWeek() }) };
  }
  return _roll.api;
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

/* trend badges */
function trendB(valFn, higherBetter, maxW){ return R().trendB(valFn, higherBetter, maxW); }
function trendFor(valFn, metric, maxW){ return R().trendFor(valFn, metric, maxW); }

/* base-wide totals */
function metricWeekSum(ids, metric, w){ return R().metricWeekSum(ids, metric, w); }
function headlineFor(ids, metric, quarter){ return R().headlineFor(ids, metric, quarter); }
function volunteerHours(ids, quarter){ return R().volunteerHours(ids, quarter); }
function salvByDept(ids){ return R().salvByDept(ids); }
function blAgg(campus, metric){ return R().blAgg(campus, metric); }
function blAggAll(ids, metric){ return R().blAggAll(ids, metric); }
function mediaSummary(ids){ return R().mediaSummary(ids); }

/* schools, teams, churches */
function ministryRollup(ids, dept, ministries, metric, quarter){ return R().ministryRollup(ids, dept, ministries, metric, quarter); }
function ministryRollupWeek(ids, dept, ministries, metric, week){ return R().ministryRollupWeek(ids, dept, ministries, metric, week); }
function ldSchools(ids){ return R().ldSchools(ids); }
function ldStudents(ids, quarter){ return R().ldStudents(ids, quarter); }
function ldGraduates(ids, quarter){ return R().ldGraduates(ids, quarter); }
function communitySchools(ids){ return R().communitySchools(ids); }
function communityStudents(ids, quarter){ return R().communityStudents(ids, quarter); }
function communityDiscipled(ids){ return R().communityDiscipled(ids); }
function outreachRollup(ids, metric, quarter){ return R().outreachRollup(ids, metric, quarter); }
function partnerChurches(ids){ return R().partnerChurches(ids); }

/* survey */
function avg(rows, id){ return R().avg(rows, id); }
function healthScore(ids, week){ return R().healthScore(ids, week); }

/* ---------- rendering ---------- */
function visibleMetrics(list){
  if(state.data.leader) return list;
  return list.filter(function(m){ return SENSITIVE.indexOf(m)===-1; });
}

function loadingHtml(){
  return '<div class="loadingBox">'+
    '<div class="loadCoin">'+logoImg('loadLogo')+'</div>'+
    '<div class="loadText">Impact Loading<span class="ldots"></span></div>'+
  '</div>';
}
function render(){
  if(window.gpDead) return;   // an error message is on screen; leave it there
  if(!document.getElementById('dashMain')) return;   // the app is showing another screen
  state.lang = (typeof LANG!=='undefined') ? LANG : state.lang;   // the app's own language button
  // Every path that refreshes state.data ends up here before anything
  // renders, so this is the one place getDepartments() needs staying in
  // sync from — see setMetricOverrides in taxonomy.js.
  if(state.data) setMetricOverrides(state.data.metricOverrides);
  renderCampusRow(); renderNav();
  document.getElementById('lockBtn').textContent = state.data.leader ? '🔓' : '🔒';
  document.getElementById('refreshBtn').textContent = '\u21bb';
  document.getElementById('footerLine').textContent = '✦ '+t('Every number is a person. The goal is people knowing Jesus.');
  var m = document.getElementById('dashMain');
  if(!state.loaded){ m.innerHTML = loadingHtml(); return; }
  if(state.view==='all') m.innerHTML = dashboardHtml(t('All Campuses — Combined Impact'), CAMPUSES.map(function(c){return c.id;}), true);
  else if(state.view==='dashboard') m.innerHTML = dashboardHtml(t(campusName()), [state.campus], false);
  else if(isWriteView(state.view) && !canEnterData()) m.innerHTML = gateHtml();
  else if(state.view==='log') m.innerHTML = logHtml();
  else m.innerHTML = okrHtml();
  bindEvents();
  animateCounts();
}

/* ---------- who is here: signed in, guest, or undecided ----------
   Reading the dashboard has never needed an account and still doesn't. Typing
   into it is the part that does: a number logged anonymously can't be traced
   back to a person or a campus, which is how the wrong campus gets a week of
   somebody else's figures.

   So the front door asks once — create a profile, log in, or browse as a guest
   — and guests get every screen except the one that writes: Log Numbers. (The
   health check-in was the other; it lives on the staff page now, derived from
   your daily logs rather than typed a second time.) This is the first half of
   tying logging to your own campus; the campus lock itself waits until everyone
   has an account.

   The server enforces this too now: saveEntries takes either the leadership code
   or a username + PIN, and a staff login may write only its own campus. So this
   gate stops the accident and api.js stops the determined person — the campus lock
   Uriah asked for, which costs nobody access because reaching this form has
   required an account since the front door was added. */
function staffSession(){
  try { return JSON.parse(localStorage.getItem('gp-staff')||'null'); } catch(e){ return null; }
}
function isSignedIn(){ var s=staffSession(); return !!(s && s.user && s.pin); }
function isGuest(){ return !!(typeof S!=='undefined' && S.guest); }
function canEnterData(){ return isSignedIn(); }
/* Health moved to the staff page, which owns the personal half of it. */
var WRITE_VIEWS = ['log'];
function isWriteView(v){ return WRITE_VIEWS.indexOf(v)>-1; }

/* Shown in place of a form a guest can't use. Says what's missing and gives the
   two ways to fix it, rather than a disabled screen with no explanation. */
function gateHtml(){
  var why = t('Numbers are logged against a person and a campus, so we can tell whose week they are.');
  return '<div class="gate"><div class="gateIcon">\u2726</div>'+
    '<h3>'+esc(t('This part needs an account'))+'</h3>'+
    '<p>'+esc(why)+'</p>'+
    '<button class="wBtn" id="gCreate">'+esc(t('Create my profile'))+'</button>'+
    '<button class="wBtn ghost" id="gLogin">'+esc(t('I already have a profile'))+'</button></div>';
}

function campusName(){ for(var i=0;i<CAMPUSES.length;i++) if(CAMPUSES[i].id===state.campus) return CAMPUSES[i].name; }

function renderCampusRow(){
  var h='';
  CAMPUSES.forEach(function(c){
    h += '<button class="cbtn'+(state.campus===c.id&&state.view!=='all'?' on':'')+'" data-campus="'+c.id+'">'+esc(t(c.short))+'</button>';
  });
  h += '<button class="cbtn all'+(state.view==='all'?' on':'')+'" data-all="1">✦ '+esc(t('All Campuses — Combined Impact').split(' — ')[0])+'</button>';
  document.getElementById('campusRow').innerHTML = h;
}

function renderNav(){
  var n = document.getElementById('dashNav');
  if(state.view==='all'){ n.innerHTML=''; return; }
  var tabs=[['dashboard','Dashboard','\ud83d\udcca'],['log','Log Numbers','\u270f\ufe0f'],['okr','OKRs','\ud83c\udfaf']];
  /* Locked tabs stay visible with a padlock rather than disappearing — a guest
     should be able to see what an account would get them. */
  var locked = !canEnterData();
  n.innerHTML = tabs.map(function(tb){
    var lock = (locked && isWriteView(tb[0])) ? ' <span class="navLock">\ud83d\udd12</span>' : '';
    return '<button class="'+(state.view===tb[0]?'on':'')+'" data-view="'+tb[0]+'">'+tb[2]+' '+esc(t(tb[1]))+lock+'</button>';
  }).join('');
}

/* ---------- drill-down: click a total to see what it's made of ----------
   The sheet itself lives in rollup.js so the staff page's Base tab opens the
   same breakdown from the same numbers. These stay as thin wrappers so the call
   sites below read unchanged. */
/* Only drillAttrs is still used here — the sheet itself is opened and closed by
   rollup.js, which both pages share. */
function drillAttrs(metric, ids, dept, ministry, quarter){
  return gpDrillAttrs(metric, ids, dept, ministry, quarter);
}

/* ---------- dashboard tiles ----------
   statTile keeps the count-up animation contract in one place: render the
   number as "0" with a data-count for animateCounts() to drive, or an em dash
   when nothing has been logged. */
function statTile(label, value, opts){
  opts = opts || {};
  var known = (value!==null && value!==undefined && !isNaN(value));
  var attrs = '';
  if(known){
    attrs = ' data-count="'+value+'"';
    if(opts.dec) attrs += ' data-dec="1"';
    if(opts.prefix) attrs += ' data-prefix="'+esc(opts.prefix)+'"';
    if(opts.suffix) attrs += ' data-suffix="'+esc(opts.suffix)+'"';
  }
  return '<div class="stat'+(opts.cls?' '+opts.cls:'')+(opts.drill?' drillable':'')+'"'+(opts.drill||'')+'>'+
    '<div class="statNum"'+attrs+'>'+(known?'0':'—')+'</div>'+
    '<div class="statLabel">'+esc(label)+(opts.trend?'<span class="statTrend">'+opts.trend+'</span>':'')+'</div></div>';
}
/* Q1–Q4 chips under a section heading, so "per quarter" is answerable without
   leaving the dashboard. valFn(quarter) returns that quarter's figure. */
function quarterChips(label, valFn, drillFn){
  var h = '<div class="qRow"><span class="qRowLabel">'+esc(label)+'</span>';
  for(var q=0;q<4;q++){
    var d = drillFn ? drillFn(q) : '';
    h += '<span'+(d?' class="drillable"'+d:'')+'>Q'+(q+1)+' <b>'+fmt(valFn(q))+'</b></span>';
  }
  return h+'</div>';
}

function dashboardHtml(title, ids, perCampus){
  var h = '<h2>'+esc(title)+'</h2>';

  /* The hero answers "who are we" before "what happened". Staff is the number
     every other figure on this page is produced by, so it leads; salvations
     stay in the same black card as the sub-figure, quarters and all. */
  var staff = totalStaff(ids);
  h += '<div class="hero"><div class="heroLabel">'+esc(t('STAFF'))+'</div>';
  h += '<div class="heroNum"'+(staff===null?'':' data-count="'+staff+'"')+'>'+(staff===null?'—':'0')+'</div>';
  /* The headline is everyone at these campuses; this is those same people split
     by what kind of staff they are and where they are from. */
  h += gpStaffMixHtml(staffBreakdown(ids));
  var cr = checkinRate(ids, currentWeek());
  if(cr.total && cr.total>0){
    var crp = gpCheckinPct(cr.n, cr.total);
    h += '<div class="heroRow">'+gpRingHtml(crp, 'sm', t('Checked in this week'))+
      '<div class="heroTrend">'+esc(t('Checked in this week'))+' <b class="heroFig">'+cr.n+'</b> / '+cr.total+
      ' · '+crp+'%</div></div>';
  }
  var hs = healthScore(ids);
  if(hs!==null){
    h += '<div class="heroRow">'+gpRingHtml(Math.round(hs*10), 'sm', t('Staff Health Score'))+
      '<div class="heroTrend">'+esc(t('Staff Health Score'))+' <b class="heroFig">'+hs.toFixed(1)+'</b>/10 '+
      trendFor(function(w){return healthScore(ids,w);}, null)+'</div></div>';
  }

  var salv = headlineFor(ids,'Salvations');
  var salvTrend = trendFor(function(w){return metricWeekSum(ids,'Salvations',w);}, 'Salvations');
  h += '<div class="heroSub">';
  h += '<div class="heroSubRow drillable" data-drill-metric="Salvations" data-drill-ids="'+ids.join(',')+'">'+
    '<span class="heroSubLabel">'+esc(t('SALVATIONS — YTD'))+'</span>'+
    '<span class="heroSubNum"'+(salv===null?'':' data-count="'+salv+'"')+'>'+(salv===null?'—':'0')+'</span>'+
    (salvTrend?'<span class="heroSubTrend">'+salvTrend+'</span>':'')+'</div>';
  h += '<div class="heroQ">';
  for(var q=0;q<4;q++) h += '<span class="drillable" data-drill-metric="Salvations" data-drill-ids="'+ids.join(',')+'" data-drill-quarter="'+q+'">Q'+(q+1)+' <b>'+fmt(headlineFor(ids,'Salvations',q))+'</b></span>';
  h += '</div></div></div>';
  h += verseOfWeek();

  /* ---- leadership development: the YWAM training schools ---- */
  h += '<h3>🌱 '+esc(t('Leadership Development schools'))+'</h3><div class="grid">';
  h += statTile(t('Schools'), ldSchools(ids));
  h += statTile(t('Students Enrolled'), ldStudents(ids),
    { drill: drillAttrs('Students Enrolled', ids, LD_DEPT) });
  h += statTile(t('Students Graduated'), ldGraduates(ids),
    { drill: drillAttrs('Students Graduated', ids, LD_DEPT),
      trend: trendFor(function(w){return ministryRollupWeek(ids, LD_DEPT, LD_SCHOOL_MINISTRIES, 'Students Graduated', w);}, 'Students Graduated') });
  h += statTile(t('Potential Staff'), ministryRollup(ids, LD_DEPT, LD_SCHOOL_MINISTRIES, 'Potential Staff'),
    { drill: drillAttrs('Potential Staff', ids, LD_DEPT) });
  h += '</div>';
  h += quarterChips(t('Students Enrolled'), function(q){ return ldStudents(ids,q); },
    function(q){ return drillAttrs('Students Enrolled', ids, LD_DEPT, null, q); });

  /* ---- community schools: GP Education / Ponlork / LTN / Sry Noi + YDC ---- */
  h += '<h3>📚 '+esc(t('Community schools'))+'</h3><div class="grid">';
  h += statTile(t('Schools'), communitySchools(ids));
  /* Three of these open and three do not, and the line between them is whether a
     breakdown would ADD UP to the number above it. Students, discipleship and
     partner churches are sums of rows, so the sheet totals the tile exactly.
     "Schools" is a count of ministries reporting, and Total Volunteer Hours is
     Σ(hours × volunteers) — a sheet under either would show rows whose total is
     not the headline, which is worse than not opening. */
  h += statTile(t('Students Enrolled'), communityStudents(ids),
    { drill: gpDrillGroupAttrs(['Students Enrolled','Youth Enrolled'], ids,
        CS_SCHOOL_MINISTRIES.concat(YE_SCHOOL_MINISTRIES), t('Community schools')) });
  h += statTile(t('Students in Discipleship'), communityDiscipled(ids),
    { drill: gpDrillGroupAttrs('Students in Discipleship', ids,
        CS_SCHOOL_MINISTRIES.concat(YE_SCHOOL_MINISTRIES), t('Community schools')) });
  h += statTile(t('Students Supported Financially'),
    ministryRollup(ids, CS_DEPT, CS_SCHOOL_MINISTRIES, 'Students Supported Financially'),
    { drill: drillAttrs('Students Supported Financially', ids, CS_DEPT) });
  h += '</div>';
  h += quarterChips(t('Students Enrolled'), function(q){ return communityStudents(ids,q); },
    function(q){ return gpDrillGroupAttrs(['Students Enrolled','Youth Enrolled'], ids,
      CS_SCHOOL_MINISTRIES.concat(YE_SCHOOL_MINISTRIES), t('Community schools'), q); });

  /* ---- outreach teams: teams hosted, and what they did while here ---- */
  h += '<h3>🙌 '+esc(t('Outreach teams'))+'</h3><div class="grid">';
  h += statTile(t('Teams Hosted'), outreachRollup(ids,'Teams Hosted'),
    { drill: drillAttrs('Teams Hosted', ids, CS_DEPT, 'Outreach Teams'),
      trend: trendFor(function(w){return ministryRollupWeek(ids, CS_DEPT, ['Outreach Teams'], 'Teams Hosted', w);}, 'Teams Hosted') });
  h += statTile(t('Volunteers Mobilized'), outreachRollup(ids,'Volunteers Mobilized'),
    { drill: drillAttrs('Volunteers Mobilized', ids, CS_DEPT, 'Outreach Teams') });
  h += statTile(t('Total Volunteer Hours'), volunteerHours(ids));
  h += statTile(t('People Served'), headlineFor(ids,'People Served'),
    { drill: drillAttrs('People Served', ids),
      trend: trendFor(function(w){return metricWeekSum(ids,'People Served',w);}, 'People Served') });
  h += statTile(t('Salvations'), outreachRollup(ids,'Salvations'),
    { drill: drillAttrs('Salvations', ids, CS_DEPT, 'Outreach Teams') });
  h += statTile(t('Baptisms'), outreachRollup(ids,'Baptisms'),
    { drill: drillAttrs('Baptisms', ids, CS_DEPT, 'Outreach Teams') });
  h += statTile(t('People Connected to Local Church'), outreachRollup(ids,'People Connected to Local Church'),
    { drill: drillAttrs('People Connected to Local Church', ids, CS_DEPT, 'Outreach Teams') });
  h += '</div>';
  h += quarterChips(t('Teams Hosted'), function(q){ return outreachRollup(ids,'Teams Hosted',q); },
    function(q){ return drillAttrs('Teams Hosted', ids, CS_DEPT, 'Outreach Teams', q); });

  /* ---- local church partnerships ---- */
  h += '<h3>⛪ '+esc(t('Local church partnerships'))+'</h3><div class="grid">';
  h += statTile(t('Local Churches Partnered'), partnerChurches(ids),
    { drill: gpDrillGroupAttrs(['Partner Churches Supported','Churches Being Led'], ids,
        ['Church Partnerships'], t('Local church partnerships')) });
  h += statTile(t('Partner Churches Supported'), ministryRollup(ids, LD_DEPT, ['Church Partnerships'], 'Partner Churches Supported'),
    { drill: drillAttrs('Partner Churches Supported', ids, LD_DEPT, 'Church Partnerships') });
  h += statTile(t('Churches Being Led'), ministryRollup(ids, LD_DEPT, ['Church Partnerships'], 'Churches Being Led'),
    { drill: drillAttrs('Churches Being Led', ids, LD_DEPT, 'Church Partnerships') });
  h += statTile(t('Combined Congregation Attendance'), ministryRollup(ids, LD_DEPT, ['Church Partnerships'], 'Combined Congregation Attendance'),
    { drill: drillAttrs('Combined Congregation Attendance', ids, LD_DEPT, 'Church Partnerships') });
  h += statTile(t('People Connected to Local Church'), headlineFor(ids,'People Connected to Local Church'),
    { drill: drillAttrs('People Connected to Local Church', ids),
      trend: trendFor(function(w){return metricWeekSum(ids,'People Connected to Local Church',w);}, 'People Connected to Local Church') });
  h += statTile(t('Spoke at Churches'), blAggAll(ids,'Spoke at Churches'));
  h += '</div>';

  /* ---- base-wide gospel totals ---- */
  h += '<h3>🕊️ '+esc(t('Across every ministry'))+'</h3><div class="grid">';
  ['Baptisms','People Heard the Gospel','Healings'].forEach(function(m){
    h += statTile(t(m), headlineFor(ids,m),
      { drill: drillAttrs(m, ids),
        trend: trendFor(function(w){return metricWeekSum(ids,m,w);}, m) });
  });
  h += '</div>';

  var ms = mediaSummary(ids);
  h += '<h3>\ud83d\udcf1 '+esc(t('Media reach'))+'</h3><div class="grid">';
  h += '<div class="stat"><div class="statNum">'+(ms?ms.platforms:'—')+'</div><div class="statLabel">'+esc(t('Platforms'))+'</div></div>';
  h += '<div class="stat"><div class="statNum">'+(ms?ms.pages.toLocaleString():'—')+'</div><div class="statLabel">'+esc(t('Total Pages'))+'</div></div>';
  h += '<div class="stat"><div class="statNum">'+(ms?ms.followers.toLocaleString():'—')+'</div><div class="statLabel">'+esc(t('Total Followers'))+'</div></div>';
  h += '<div class="stat"><div class="statNum">'+(ms?ms.views.toLocaleString():'—')+'</div><div class="statLabel">'+esc(t('Views YTD'))+'</div></div>';
  h += '</div>';

  h += '<h3>\ud83d\ude4c '+esc(t('Salvations by department'))+'</h3><div class="card">';
  var bd = salvByDept(ids);
  Object.keys(bd).forEach(function(d){
    h += '<div class="row drillable" data-drill-metric="Salvations" data-drill-ids="'+ids.join(',')+'" data-drill-dept="'+esc(d)+'"><span class="rowName">'+emj(d)+esc(t(d))+'</span><span class="rowVal">'+fmt(bd[d])+'</span></div>';
  });
  h += '</div>';

  if(perCampus){
    h += '<h3>\ud83c\udfeb '+esc(t('By campus'))+'</h3><div class="card">';
    CAMPUSES.forEach(function(c){
      var chs = healthScore([c.id]);
      h += '<div class="row"><span class="rowName">'+esc(t(c.name))+'</span><span class="rowVal">'+
        fmt(headlineFor([c.id],'Salvations'))+' '+esc(t('salvations'))+' · '+fmt(headlineFor([c.id],'People Served'))+' '+esc(t('served'))+
        ' · '+(chs===null?'—':chs.toFixed(1))+'/10 '+esc(t('staff health'))+'</span></div>';
    });
    h += '</div>';
  } else {
    h += '<h3>\ud83c\udfe0 '+esc(t('Base health'))+'</h3><div class="grid">';
    /* Total Staff now leads "at a glance", and Spoke at Churches sits with the
       church partnerships — no need to print either of them twice. */
    var blShow = ['Staff Debt ($)','One-on-Ones Held','Partner Connections',
      'Spoke at YWAM Bases','Hours Sharing the Gospel','Base Vision (1-10)',
      'Communications (1-10)','Partner Relationships (1-10)'];
    blShow.forEach(function(m){
      var val = blAgg(state.campus,m);
      h += '<div class="stat"><div class="statNum">'+fmt(val,m)+'</div><div class="statLabel">'+
        esc(t(m).replace(' ($)','').replace(' (1-10)',''))+'</div></div>';
    });
    h += '</div>';

    if(state.data.leader){
      h += '<h3>\ud83d\udd10 '+esc(t('Leadership detail'))+'</h3><div class="card">';
      h += '<div class="row"><span class="rowName">'+esc(t('Base Finances ($)').replace(' ($)',''))+'</span><span class="rowVal">'+
        fmt(blAgg(state.campus,'Base Finances ($)'),'Base Finances ($)')+'</span></div>';
      h += '<div class="row"><span class="rowName">'+esc(t('Funds Raised ($)').replace(' ($)',''))+'</span><span class="rowVal">'+
        fmt(blAgg(state.campus,'Funds Raised ($)'),'Funds Raised ($)')+'</span></div>';
      var finKeys = [['Skills Training|Finances|Finances Consolidated ($)','Finances Consolidated ($)'],
                     ['Skills Training|Finances|Base Cash Reserve ($)','Base Cash Reserve ($)']];
      finKeys.forEach(function(fk){
        var v = aggregate((state.data.entries[state.campus]||{})[fk[0]],'latest');
        h += '<div class="row"><span class="rowName">'+esc(t(fk[1]).replace(' ($)',''))+'</span><span class="rowVal">'+fmt(v,fk[1])+'</span></div>';
      });
      Object.keys(getDepartments(state.campus)[BL_DEPT]).forEach(function(min){
        if(min==='Campus Director') return;
        var v = aggregate((state.data.entries[state.campus]||{})[BL_DEPT+'|'+min+'|Staff Debt ($)'],'latest');
        h += '<div class="row"><span class="rowName">'+esc(t('Staff debt by department'))+' · '+esc(t(min))+'</span><span class="rowVal">'+fmt(v,'Staff Debt ($)')+'</span></div>';
      });
      h += '</div>';
    }
    h += deptDashHtml();
    h += okrSummaryHtml();
  }
  return h;
}

function deptDashHtml(){
  var deps = getDepartments(state.campus);
  if(!deps[state.dashDept]) state.dashDept = Object.keys(deps)[0];
  var h = '<h3>\ud83d\uddc2\ufe0f '+esc(t('Department dashboards'))+'</h3>';
  h += '<div class="pickerRow"><label class="pick" style="max-width:280px"><span>'+esc(t('Department'))+'</span><select id="dashDeptSel">'+
    Object.keys(deps).map(function(d){ return '<option value="'+esc(d)+'"'+(state.dashDept===d?' selected':'')+'>'+(MIN_EMOJI[d]?MIN_EMOJI[d]+' ':'')+esc(t(d))+'</option>'; }).join('')+'</select></label></div>';
  var entries = state.data.entries[state.campus]||{};
  Object.keys(deps[state.dashDept]).forEach(function(min){
    h += '<div class="card"><div class="row" style="border-bottom:2px solid var(--ink)"><span class="rowName" style="font-weight:700">'+emj(min)+esc(t(min))+'</span><span></span></div>';
    visibleMetrics(deps[state.dashDept][min]).forEach(function(metric){
      var mode = modeOf(metric);
      var mkey = state.dashDept+'|'+min+'|'+metric;
      var v = aggregate(entries[mkey], mode);
      var lbl = mode==='latest'?'now':(mode==='avg'?'avg':'YTD');
      var tr = trendFor(function(w){ var e=entries[mkey]; return (e&&e[w]!==undefined&&e[w]!==null&&!isNaN(Number(e[w])))?Number(e[w]):null; }, metric);
      h += '<div class="row drillable" data-drill-metric="'+esc(metric)+'" data-drill-ids="'+state.campus+'" data-drill-dept="'+esc(state.dashDept)+'" data-drill-ministry="'+esc(min)+'"><span class="rowName">'+esc(t(metric))+' <span style="color:var(--faint);font-size:11px">'+lbl+'</span></span><span class="rowVal">'+fmt(v,metric)+tr+'</span></div>';
    });
    h += '</div>';
  });
  return h;
}

function okrSummaryHtml(){
  var q = state.okrQuarter;
  var list = state.data.okrs.filter(function(o){ return o.campus===state.campus && Number(o.quarter)===q; });
  if(!list.length) return '';
  var h = '<h3>\ud83c\udfaf Q'+q+' '+esc(t('OKRs'))+'</h3>';
  list.forEach(function(o){
    var p = objProgress(o);
    h += '<div class="card" style="padding:12px 14px"><div class="okrHead"><div><div class="okrObj">'+esc(o.objective)+'</div>'+
      '<div class="okrDept">'+emj(o.dept)+esc(t(o.dept))+'</div></div>'+ring(p,48)+'</div></div>';
  });
  return h;
}

function weekOptions(sel){
  var h='';
  for(var w=1;w<=52;w++) h += '<option value="'+w+'"'+(sel===w?' selected':'')+'>'+esc(weekLabel(w))+'</option>';
  return h;
}

function logHtml(){
  var deps = getDepartments(state.campus);
  if(!deps[state.dept]) state.dept = Object.keys(deps)[0];
  if(!deps[state.dept][state.ministry]) state.ministry = Object.keys(deps[state.dept])[0];
  var h = '<h2>'+esc(t('Log Numbers'))+' <small>· '+esc(t(campusName()))+'</small></h2>';
  h += '<div class="pickerRow">';
  h += '<label class="pick"><span>'+esc(t('Department'))+'</span><select id="deptSel">'+
    Object.keys(deps).map(function(d){ return '<option value="'+esc(d)+'"'+(state.dept===d?' selected':'')+'>'+(MIN_EMOJI[d]?MIN_EMOJI[d]+' ':'')+esc(t(d))+'</option>'; }).join('')+'</select></label>';
  h += '<label class="pick"><span>'+esc(t(state.dept===BL_DEPT?'Oversees':'Ministry'))+'</span><select id="minSel">'+
    Object.keys(deps[state.dept]).map(function(m){ return '<option value="'+esc(m)+'"'+(state.ministry===m?' selected':'')+'>'+(MIN_EMOJI[m]?MIN_EMOJI[m]+' ':'')+esc(t(m))+'</option>'; }).join('')+'</select></label>';
  h += '<label class="pick"><span>'+esc(t('Week'))+'</span><select id="weekSel">'+weekOptions(state.week)+'</select></label>';
  h += '</div><div class="card" id="logCard">';
  var entries = state.data.entries[state.campus]||{};
  if(state.dept===BL_DEPT && state.ministry==='Campus Director'){
    var hsNow = healthScore([state.campus]);
    h += '<div class="row"><div><div class="rowName">'+esc(t('Staff Health Score (from survey)'))+'</div>'+
      '<div class="rowSub">'+esc(t('auto from KPI'))+'</div></div><span class="rowVal">'+(hsNow===null?'—':hsNow.toFixed(1)+'/10')+'</span></div>';
  }
  visibleMetrics(deps[state.dept][state.ministry]).forEach(function(metric){
    var key = state.dept+'|'+state.ministry+'|'+metric;
    var mode = modeOf(metric);
    var wks = entries[key] || {};
    var agg = aggregate(wks, mode);
    var cur = wks[state.week]!==undefined ? wks[state.week] : '';
    var sub, extra = '';
    if(mode==='latest'){
      // Headcounts (students enrolled, staff, schools…) rarely change week to
      // week, so carry the last figure forward already filled in instead of
      // making someone retype it. Still editable, so real growth or decline
      // still registers — and the ▲/▼ badge shows the change.
      var prev = lastBefore(wks, state.week);
      var isCarried = (cur==='' && prev!==null);
      if(isCarried){ cur = prev.value; extra = ' data-carried="1"'; }
      sub = esc(t('now'))+' '+fmt(agg,metric);
      if(prev!==null){
        sub += ' · ' + (isCarried
          ? esc(t('carried from week'))+' '+prev.week
          : esc(t('week'))+' '+prev.week+': '+fmt(prev.value,metric));
        var d = Number(cur)-prev.value;
        if(d) sub += '<span class="trend '+(d>0?'up':'down')+'">'+(d>0?'▲':'▼')+' '+fmt(Math.abs(d),metric)+'</span>';
      }
    } else if(mode==='avg'){
      sub = esc(t('avg'))+' '+fmt(agg,metric)+gpVsLastWeek(wks, state.week, metric, wks[state.week]);
    } else {
      // Running totals: this box is the week's ADDITION, not the new total.
      // Spelling that out stops people entering "105" when they mean "+5".
      // Last week sits beside it so a rise or fall is visible while typing.
      sub = esc(t('total so far'))+' '+fmt(agg,metric)+
        gpVsLastWeek(wks, state.week, metric, wks[state.week])+'<span class="newTot"></span>';
      extra = ' data-run="'+(agg===null?0:agg)+'"';
    }
    h += '<div class="row"><div><div class="rowName">'+esc(t(metric))+'</div><div class="rowSub">'+sub+'</div></div>'+
      '<input type="number" inputmode="decimal" placeholder="'+(mode==='sum'?'+0':'0')+'" data-metric="'+esc(metric)+'" data-mode="'+mode+'" value="'+cur+'"'+extra+'></div>';
  });
  h += '<button class="saveBtn" id="saveBtn">'+esc(t('Save Week'))+' '+state.week+'</button></div>';
  h += '<p class="note">'+esc(t('Entries save to the shared GP Impact Data sheet — every leader sees the same live numbers.'))+'</p>';
  return h;
}

/* ---------- OKR ---------- */
function objProgress(o){ return R().objProgress(o); }
function krProgress(o, kr){ return R().krProgress(o, kr); }
/* Fills the note under one key-result slot in the editor. textContent, so there
   is nothing to escape. */
/* Three key-result rows to start (or as many as the objective has); "+ Add a key
   result" adds more in place, up to MAX_KRS — the server keeps no more than that. */
var MAX_KRS = 10;
function krRowHtml(k, kr){
  kr = kr||{text:'',metricKey:'',target:''};
  return '<div class="formBlock" data-kr-row="'+k+'"><label>'+esc(t('Key result'))+' '+(k+1)+'</label>'+
    '<input type="text" id="krText'+k+'" value="'+esc(kr.text)+'">'+
    '<label>'+esc(t('Measure by'))+'</label><select id="krMetric'+k+'">'+metricOptions(kr.metricKey)+'</select>'+
    '<label>'+esc(t('Target (if linked to a KPI)'))+'</label><input type="number" id="krTarget'+k+'" inputmode="decimal" placeholder="0" value="'+(kr.target||'')+'" style="width:130px">'+
    '<div class="krWarn" id="krWarn'+k+'"></div>'+
  '</div>';
}
function bindKrRow(k){
  var sel=document.getElementById('krMetric'+k), tin=document.getElementById('krTarget'+k);
  if(!sel || !tin) return;
  sel.addEventListener('change', function(){ krTargetCheck(k); });
  tin.addEventListener('input', function(){ krTargetCheck(k); });
  krTargetCheck(k);   /* an objective opened for editing says it straight away */
}
function addKrRow(){
  var btn=document.getElementById('addKrBtn');
  if(!btn) return;
  var k=document.querySelectorAll('#okrForm [data-kr-row]').length;
  if(k>=MAX_KRS) return;
  btn.insertAdjacentHTML('beforebegin', krRowHtml(k));
  bindKrRow(k);
  if(k+1>=MAX_KRS) btn.style.display='none';
  var box=document.getElementById('krText'+k);
  if(box) box.focus();
}
function krTargetCheck(k){
  var el = document.getElementById('krWarn'+k);
  var sel = document.getElementById('krMetric'+k);
  var tin = document.getElementById('krTarget'+k);
  if(!el || !sel || !tin) return;
  el.textContent = gpKrTargetNote(R(), state.campus, state.okrQuarter, sel.value,
    Number(tin.value)||0);
}

function metricOptions(selected){
  var deps = getDepartments(state.campus);
  var h = '<option value="">'+esc(t('Manual progress (%)'))+'</option>';
  Object.keys(deps).forEach(function(d){
    h += '<optgroup label="'+esc(t(d))+'">';
    Object.keys(deps[d]).forEach(function(min){
      visibleMetrics(deps[d][min]).forEach(function(met){
        var key = d+'|'+min+'|'+met;
        h += '<option value="'+esc(key)+'"'+(selected===key?' selected':'')+'>'+esc(t(min)+' · '+t(met))+'</option>';
      });
    });
    h += '</optgroup>';
  });
  return h;
}

function okrHtml(){
  var q = state.okrQuarter;
  var h = '<h2>'+esc(t('OKRs'))+' <small>· '+esc(t(campusName()))+'</small></h2>';
  h += '<div class="pickerRow"><label class="pick" style="max-width:180px"><span>'+esc(t('Quarter'))+'</span><select id="okrQSel">';
  for(var i=1;i<=4;i++) h += '<option value="'+i+'"'+(q===i?' selected':'')+'>Q'+i+'</option>';
  h += '</select></label></div>';

  var list = state.data.okrs.filter(function(o){ return o.campus===state.campus && Number(o.quarter)===q; });
  if(!list.length && !state.okrFormOpen) h += '<p class="note">'+esc(t('No objectives yet. Set 2–3 per department — each with measurable key results.'))+'</p>';

  list.forEach(function(o){
    var p = objProgress(o);
    h += '<div class="okrCard"><div class="okrHead"><div><div class="okrObj">'+esc(o.objective)+'</div>'+
      '<div class="okrDept">'+emj(o.dept)+esc(t(o.dept))+' · Q'+o.quarter+'</div></div>'+ring(p,58)+'</div>';
    o.krs.forEach(function(kr, ki){
      var kp = krProgress(o, kr);
      h += '<div class="kr"><div class="krText">'+esc(kr.text)+'</div><div class="krMeta">';
      if(kr.metricKey){
        var met = kr.metricKey.split('|')[2];
        h += '<span>'+fmt(kp.actual,met)+' / '+fmt(kr.target,met)+' · '+esc(t('auto from KPI'))+'</span><span>'+kp.pct+'%</span>';
      } else if(kr.kind==='count'){
        // counted on the staff app (− / +); the dashboard just shows it
        h += '<span>'+(Number(kr.current)||0)+' / '+(Number(kr.target)||0)+'</span><span>'+kp.pct+'%</span>';
      } else {
        // Empty rather than 0 when nothing is set — see the staff page's copy.
        h += '<span>'+esc(t('manual'))+'</span><span><input type="number" class="manualIn" min="0" max="100" placeholder="0" value="'+(Number(kr.manual) ? Number(kr.manual) : '')+'" data-manual="'+o.id+'|'+ki+'"'+(state.data.leader?'':' disabled')+'> %</span>';
      }
      h += '</div><div class="krBar"><div class="barFill'+(kp.pct>=100?' done':'')+'" style="width:'+Math.min(100,kp.pct)+'%"></div></div>'+(kr.metricKey?gpKrWarnHtml(kp):'')+'</div>';
    });
    if(state.data.leader){
      h += '<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end">'+
        '<button class="dangerBtn" data-del="'+o.id+'">'+esc(t('Delete'))+'</button>'+
        '<button class="ghostBtn" data-edit="'+o.id+'">'+esc(t('Edit'))+'</button></div>';
    }
    h += '</div>';
  });

  if(!state.data.leader){
    return h;
  }

  if(state.okrFormOpen){
    var editing = null;
    if(state.editingId) state.data.okrs.forEach(function(o){ if(o.id===state.editingId) editing=o; });
    var krs = editing ? editing.krs : [];
    h += '<div class="okrCard" id="okrForm"><div class="okrObj">'+esc(t(editing?'Edit objective':'New objective'))+'</div><div class="formBlock" style="border:none;margin-top:4px">';
    h += '<label>'+esc(t('Objective'))+'</label><input type="text" id="objText" value="'+(editing?esc(editing.objective):'')+'">';
    h += '<label>'+esc(t('Owner'))+'</label><select id="objDept">'+Object.keys(getDepartments(state.campus)).map(function(d){
      return '<option value="'+esc(d)+'"'+(editing&&editing.dept===d?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+'</select>';
    var rows = Math.min(MAX_KRS, Math.max(3, krs.length));
    for(var k=0;k<rows;k++) h += krRowHtml(k, krs[k]);
    h += '<button class="ghostBtn" id="addKrBtn" type="button" style="width:100%'+(rows>=MAX_KRS?';display:none':'')+'">'+esc(t('+ Add a key result'))+'</button>';
    h += '<button class="saveBtn" id="saveOkrBtn">'+esc(t(editing?'Save changes':'Add objective'))+'</button>'+
      '<button class="ghostBtn" id="cancelOkrBtn" style="width:100%">'+esc(t('Cancel'))+'</button></div></div>';
  } else {
    h += '<button class="saveBtn" id="openOkrBtn">'+esc(t('+ New Objective'))+'</button>';
  }
  return h;
}

/* ---------- Health survey ---------- */
/* ---------- events & server ---------- */
function apiCall(fn, args){
  return fetch('/.netlify/functions/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fn: fn, args: args || [] })
  }).then(function(res){
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  });
}

function toggleLeader(){
  if(state.data.leader){
    state.leaderCode=''; lsDel('gp-leadercode');
    fetchData(); return;
  }
  var code = prompt(t('Enter leadership code'));
  if(!code) return;
  apiCall('getData', [code]).then(function(d){
    if(d.leader){
      state.leaderCode = code; lsSet('gp-leadercode', code);
      state.data = d; render();
    } else {
      showError(t('Wrong code'));
    }
  }).catch(function(){ showError(t('Wrong code')); });
}

function bindEvents(){
  /* Refresh spins the GP mark, the same way the boot screen and pull-to-refresh
     do. It used to swap in a "…" — a dead ellipsis that looked like nothing was
     happening, and that stayed on the button forever if the request failed,
     because only a successful render put the ↻ back. */
  document.getElementById('refreshBtn').onclick = function(){
    var btn = this;
    if(btn.dataset.busy) return;
    btn.dataset.busy = '1';
    btn.classList.add('spinBtn');
    btn.innerHTML = logoImg('spinMark') || '↻';
    var done = function(){
      delete btn.dataset.busy;
      btn.classList.remove('spinBtn');
      btn.textContent = '↻';
    };
    var p = fetchData();
    if(p && p.then) p.then(done, done); else done();
  };
  document.getElementById('lockBtn').onclick = toggleLeader;
  document.querySelectorAll('[data-campus]').forEach(function(b){
    b.onclick = function(){ state.campus=b.getAttribute('data-campus'); if(state.view==='all') state.view='dashboard'; render(); };
  });
  var all = document.querySelector('[data-all]');
  if(all) all.onclick = function(){ state.view='all'; render(); };
  document.querySelectorAll('[data-view]').forEach(function(b){
    b.onclick = function(){ gpTap(); state.view=b.getAttribute('data-view'); render(); };
  });
  var gc=document.getElementById('gCreate');
  if(gc) gc.onclick=function(){ window.location.href='teams.html?reg=1'; };
  var gl=document.getElementById('gLogin');
  if(gl) gl.onclick=function(){ window.location.href='teams.html'; };
  gpBindDrill(R());
  gpBindStaffMix(staffBreakdown(state.view==='all' ? CAMPUSES.map(function(c){return c.id;}) : [state.campus]));
  var ds=document.getElementById('deptSel');
  if(ds) ds.onchange=function(){ state.dept=ds.value; state.ministry=Object.keys(getDepartments(state.campus)[state.dept])[0]; render(); };
  var ms=document.getElementById('minSel');
  if(ms) ms.onchange=function(){ state.ministry=ms.value; render(); };
  var ws=document.getElementById('weekSel');
  if(ws) ws.onchange=function(){ state.week=Number(ws.value); render(); };
  var sb=document.getElementById('saveBtn');
  if(sb) sb.onclick=function(){ saveCard(sb); };
  // Running totals live in rollup.js now — the staff page's daily card needs the
  // same behaviour, and a second hand-written copy is how these drift.
  gpBindRunningTotals(document.getElementById('logCard'));

  var dds=document.getElementById('dashDeptSel');
  if(dds) dds.onchange=function(){ state.dashDept=dds.value; render(); };
  var qs=document.getElementById('okrQSel');
  if(qs) qs.onchange=function(){ state.okrQuarter=Number(qs.value); render(); };
  var ob=document.getElementById('openOkrBtn');
  if(ob) ob.onclick=function(){ state.okrFormOpen=true; state.editingId=null; render(); };
  var cb=document.getElementById('cancelOkrBtn');
  if(cb) cb.onclick=function(){ state.okrFormOpen=false; state.editingId=null; render(); };
  var sob=document.getElementById('saveOkrBtn');
  if(sob) sob.onclick=function(){ saveOkrForm(sob); };
  for(var kw=0;document.getElementById('krText'+kw);kw++) bindKrRow(kw);
  var akb=document.getElementById('addKrBtn');
  if(akb) akb.onclick=function(){ addKrRow(); };
  document.querySelectorAll('[data-edit]').forEach(function(b){
    b.onclick=function(){ state.editingId=b.getAttribute('data-edit'); state.okrFormOpen=true; render(); };
  });
  document.querySelectorAll('[data-del]').forEach(function(b){
    b.onclick=function(){
      if(!confirm(t('Delete')+'?')) return;
      serverCall('deleteObjective', [b.getAttribute('data-del'), state.leaderCode]);
    };
  });
  document.querySelectorAll('[data-manual]').forEach(function(inp){
    inp.onchange=function(){
      var parts = inp.getAttribute('data-manual').split('|');
      var okr=null; state.data.okrs.forEach(function(o){ if(o.id===parts[0]) okr=o; });
      if(!okr) return;
      okr.krs[Number(parts[1])].manual = Number(inp.value)||0;
      serverCall('saveObjective', [okr, state.leaderCode]);
    };
  });

}

function serverCall(fn, args){
  hideError();
  apiCall(fn, args).then(function(d){ state.data=d; render(); })
    .catch(function(){ showError("Couldn't save. Check your connection and try again."); });
}

function saveCard(btn){
  var updates=[];
  document.querySelectorAll('#logCard input[data-metric]').forEach(function(inp){
    updates.push({ dept:state.dept, ministry:state.ministry, metric:inp.getAttribute('data-metric'),
      week:state.week, value: inp.value==='' ? null : Number(inp.value) });
  });
  /* a score is 1–10 and a percentage 0–100 (kpiRange in taxonomy.js); the
     server refuses anything else, so say so here instead of losing it */
  if(state.ministry!=='Outreach Teams' && typeof kpiRange==='function'){
    for(var i=0;i<updates.length;i++){
      var r=kpiRange(updates[i].metric||''), v=updates[i].value;
      if(r && v!==null && !isNaN(v) && (v<r.min || v>r.max)){
        showError(gpT('{metric} goes from {min} to {max} — check the number you typed.',{metric:t(updates[i].metric), min:r.min, max:r.max}));
        return;
      }
    }
  }
  btn.disabled=true; btn.textContent=t('Saving…'); hideError();
  /* The server needs to know who is writing: the leadership code, or a staff
     login. Without one of them it refuses, and a staff login may only write its
     own campus. */
  var sess = staffSession() || {};
  apiCall('saveEntries', [state.campus, updates, state.leaderCode, sess.user, sess.pin]).then(function(d){
    if(d && d.ok === false){
      btn.disabled=false; btn.textContent=t('Save Week')+' '+state.week;
      showError(d.err === 'wrong_campus'
        ? t('You can only log numbers for your own campus.')
        : d.err === 'no_campus'
          ? t('Your profile has no campus yet — add one on your profile page.')
          : t('Sign in again to save numbers.'));
      return;
    }
    state.data = d; btn.innerHTML='<span class="savedSpark">✦</span> '+t('Saved');
    setTimeout(function(){ render(); }, 900);
  }).catch(function(){
    btn.disabled=false; btn.textContent=t('Save Week')+' '+state.week;
    showError("Couldn't save. Check your connection and press Save again.");
  });
}

function saveOkrForm(btn){
  var text = document.getElementById('objText').value.trim();
  if(!text){ showError(t('Objective')+'?'); return; }
  var krs=[];
  for(var k=0;document.getElementById('krText'+k);k++){
    var tx = document.getElementById('krText'+k).value.trim();
    if(!tx) continue;
    krs.push({ text:tx, metricKey:document.getElementById('krMetric'+k).value,
      target:Number(document.getElementById('krTarget'+k).value)||0, manual:0 });
  }
  if(!krs.length){ showError(t('Key result')+'?'); return; }
  if(state.editingId){
    state.data.okrs.forEach(function(o){
      if(o.id===state.editingId){
        krs.forEach(function(nk){
          o.krs.forEach(function(ok){
            if(ok.text!==nk.text) return;
            // headings and counts are set on the staff app; editing here keeps them
            nk.group = ok.group||'';
            if(!nk.metricKey && !ok.metricKey){ nk.manual=ok.manual; nk.kind=ok.kind||''; nk.current=ok.current||0; }
          });
        });
      }
    });
  }
  var obj = { id: state.editingId || ('o'+Date.now()), campus: state.campus, quarter: state.okrQuarter,
    dept: document.getElementById('objDept').value, objective: text, krs: krs };
  btn.disabled=true; btn.textContent=t('Saving…');
  apiCall('saveObjective', [obj, state.leaderCode]).then(function(d){
    state.data=d; state.okrFormOpen=false; state.editingId=null; render();
  }).catch(function(){
    btn.disabled=false; btn.textContent=t('Add objective');
    showError("Couldn't save. Check your connection and try again.");
  });
}

function showError(msg){ var e=document.getElementById('errorBar'); if(!e) return; e.textContent=msg; e.classList.remove('hidden'); }
function hideError(){ var e=document.getElementById('errorBar'); if(e) e.classList.add('hidden'); }

function fetchData(){
  // Returns the promise so pull-to-refresh knows when to stop spinning.
  /* One request: getData brings the roster with it, so the dashboard no longer
     makes a second round trip for the staff headcount. */
  return apiCall('getData', [state.leaderCode]).then(function(d){
    if(d && Array.isArray(d.roster)) state.roster = d.roster;
    state.data=d; state.loaded=true;
    /* Khmer used to be fetched into a `gp-km-v2` cache, and this is where the
       cache was read — falling back to English when it was empty. Nothing writes
       that key any more (km.js ships BUILTIN_KM with the page), so the fallback
       fired every single time: a Khmer reader picked Khmer, reloaded, and the
       first data load quietly put the page back into English while the toggle
       still read ខ្មែរ. The dictionary is local now, so there is nothing to wait
       for and nothing to fall back to. */
    render();
  }).catch(function(){ showError("Couldn't load data. Pull down to refresh."); });
}

/* What the app (teams/01-core.js, render and bind) calls. The frame is drawn by the
   app; this fills it. The data loads the first time the view opens, then on Refresh
   or a pull. */
var DASH_FRAME='<div class="dashView">'+
  '<div class="dashTop"><div class="campusRow" id="campusRow"></div>'+
    '<div class="dashBtns"><button class="langBtn" id="helpBtn" aria-label="Guide">📖</button><button class="langBtn" id="refreshBtn" aria-label="Refresh">↻</button><button class="langBtn" id="lockBtn">🔒</button></div></div>'+
  '<nav id="dashNav"></nav><div class="errorBar hidden" id="errorBar"></div>'+
  '<div class="dashMain" id="dashMain"></div><footer id="footerLine"></footer></div>';
window.gpDashboard = {
  html: function(){ return DASH_FRAME; },
  mount: function(){
    if(typeof S!=='undefined' && S.me && S.me.campus && !state.campusChosen){ state.campus=S.me.campus; state.campusChosen=true; }
    render();
    var hb=document.getElementById('helpBtn'); if(hb) hb.onclick=function(){ window.location.href='help.html'; };
    if(!state.loaded && !state.loading){ state.loading=true; var p=fetchData(); var dn=function(){ state.loading=false; }; if(p && p.then) p.then(dn, dn); }
  },
  refresh: function(){ return fetchData(); }
};
})();
