/* ==================== My Ministry → Today (Nov 2026, Uriah) ====================
   "My ministry page could have a fun and simple way to use it daily … each one can see their ministry as a fun game
   they're doing each day, while also getting all the data needed for our board, donors and the government. And when
   they go to My Ministry they wouldn't be overwhelmed either."

   Every ministry's page opens on ONE screen, under a minute a day:
     1. tap counters — a big tile per daily count (tap +1, − undoes, ✎ or a long press types today's number);
     2. this week's ring — goals on target (the Scorecard's own goals and maths), or days logged this week;
     3. the team streak — days in a row anyone logged anything, Sundays and national holidays skipped;
     4. win of the day — one line of something good that happened (kept 200 days, offered to the quarter's story);
     5. the Friday wrap — the weekly numbers, carried forward as the weekly form does, then "Week n complete";
     6. badges — the ministry's, worked out here from what is already stored.

   The rule of the game (Uriah): rewards are for SHOWING UP and logging honestly — never for the size of a number —
   and salvations, baptisms, healings and every other faith number (GP_FAITH_RE, taxonomy.js) are counted in a plain
   row and are never part of it: no tile, no ring, no celebration, no badge.

   Saving a count: the DAY's own value, absolute, through the existing daily path (saveMyKpiDay / saveKpiDayFor) about
   0.8 s after the last tap — so three quick taps are one save of "3", and sending it twice changes nothing. What has
   not reached the server yet is kept on the phone (gp-td-pending, by user + ministry + date + metric, the last value
   wins) and sent when the connection is back. A tap paints its own tile; it never redraws the page. */
var TD_TILES=4, TD_SAVE_MS=800, TD_HOLD_MS=500, TD_PENDING='gp-td-pending', TD_BADGES='gp-td-badges', TD_WINS_SHOWN=3, TD_FEED_DAYS=60;
S.td={ more:false, edit:null, winDraft:'', winsAll:false, wrapOpen:false, wrapDraft:{}, wrapDone:'', flying:false, note:'', timer:null, winBusy:false, stripOpen:'', reqBusy:'' };

/* out of the game: salvations, baptisms, healings (Uriah's three). The quarterly report's wider GP_FAITH_RE also names
   churches, worship, prayer… — those are a ministry's ordinary daily counts (Evangelism, Church Partnerships), so they are tiles. */
var TD_FAITH_RE=/salvation|baptis|healing/i;
function tdIsFaith_(m){ return TD_FAITH_RE.test(m); }
/* the ministries that already have a daily home of their own: it stays their first tab, with the shared strip on top */
function tdToolMin_(sel){
  return (sel.dept==='Community Service' && sel.min==='Cafe') || isTeamsMinistry_(sel.dept, sel.min) || isIcpMinistry_(sel.dept, sel.min) ||
    isWorshipMinistry_(sel.dept, sel.min) || isDtsMinistry_(sel.dept, sel.min) || isSchoolMinistry_(sel.dept, sel.min);
}
function tdMine_(sel){ return sel.dept===S.me.dept && sel.min===S.me.ministry; }
function tdData_(sel){ return tdMine_(sel) ? S.ministry : (S.oversee||{})[sel.min]; }
function tdCanLog_(sel){ return canLogForClient_(sel.dept, sel.min); }
function tdSel_(){ return (S.mmBrowseDept && S.mmBrowseMinistry) ? { dept:S.mmBrowseDept, min:S.mmBrowseMinistry } : null; }
function tdKey_(sel){ return S.me.campus+'|'+sel.dept+'|'+sel.min; }

/* ---------- each ministry's own touches (step 2, Nov 2026, Uriah: "Keep improving the My Ministry pages") ----------
   ONE table, keyed 'Dept|Ministry'; a ministry not in it gets the generic screen. Nothing here is stored and no
   metric is invented: `lead` and `icons` only name metrics the taxonomy already has (a name that isn't in the
   ministry's list is simply ignored), `prompt` is one friendly line in the ministry's own terms, and `extra` names
   the read-only lines above the tiles: 'hosp' (tonight, from SR Hospitality's booking book), 'sched:<kind>' (is this
   week's schedule published), 'tech' (work requests — GP Tasks asked of Technical). */
var TD_MIN={
  'Youth Education|Sports': { prompt:function(){ return t('Log each game as it ends.'); }, lead:['Games Played','Games Won','Sessions / Leagues Run','Youth Participating'],
    icons:{ 'Games Played':'⚽', 'Games Won':'🏆', 'Sessions / Leagues Run':'📅', 'Youth Participating':'🧒' } },
  'Youth Education|GP Media': { prompt:function(){ return t('Tap when something goes out.'); }, lead:['Instagram Pieces Published','Facebook Pieces Published','YouTube Pieces Published','TikTok Pieces Published'],
    icons:{ 'Instagram Pieces Published':'📸', 'Facebook Pieces Published':'👍', 'YouTube Pieces Published':'▶️', 'TikTok Pieces Published':'🎵' } },
  'Skills Training|Technical': { prompt:function(){ return t('Tap each project you finish.'); }, lead:['Projects Completed','Training Hours Delivered'],
    icons:{ 'Projects Completed':'🔧', 'Training Hours Delivered':'🎓' }, extra:['tech'] },
  'Skills Training|Culinary': { prompt:function(){ return t('Tap after each meal service.'); }, lead:['Breakfasts Served','Lunches Served','Dinners Served','People Cooked For'],
    icons:{ 'Breakfasts Served':'🍳', 'Lunches Served':'🍛', 'Dinners Served':'🍲', 'People Cooked For':'👥', 'New Meals Tried':'✨', 'Training Hours Delivered':'🎓' }, extra:['sched:kitchen'] },
  'Skills Training|Hospitality': { prompt:function(){ return t('Tap as you welcome each guest.'); }, lead:['Guests Welcomed','Beds Made','Welcome Gifts Given'],
    icons:{ 'Guests Welcomed':'🤗', 'Beds Made':'🛏', 'Welcome Gifts Given':'🎁', 'Training Hours Delivered':'🎓' }, extra:['hosp','sched:chores'] },
  'Leadership Development|Evangelism': { prompt:function(){ return t('Tap after each conversation.'); }, lead:['Gospel Conversations Initiated','People Reached with Gospel','Evangelistic Events Held','People Connected to Local Church'],
    icons:{ 'Gospel Conversations Initiated':'💬', 'People Reached with Gospel':'👂', 'Evangelistic Events Held':'📣', 'People Connected to Local Church':'⛪' } },
  'Leadership Development|Church Partnerships': { prompt:function(){ return t('After each church visit, share a win. The churches’ numbers go in Friday’s wrap.'); }, lead:[], icons:{ 'New Churches Planted':'🌱' } }
};
function tdCfg_(sel){ var k=sel.dept+'|'+sel.min; return Object.prototype.hasOwnProperty.call(TD_MIN, k) ? TD_MIN[k] : null; }
function tdIcon_(sel, m){ var c=tdCfg_(sel), i=c && c.icons && c.icons[m]; return i ? '<span class="tdIc" aria-hidden="true">'+i+'</span> ' : ''; }
function tdHasExtra_(sel, x){ var c=tdCfg_(sel); return !!(c && c.extra && c.extra.indexOf(x)>-1); }

/* ---------- which numbers go where ---------- */
function tdMetrics_(sel){
  var c=S.me.campus, auto=autoMetricsFor(c, sel.dept, sel.min);
  var all=metricsFor(c, sel.dept, sel.min).filter(function(m){ return auto.indexOf(m)===-1; });
  var weekly=all.filter(function(m){ return cadenceOf(c, sel.dept, sel.min, m)==='week'; });
  var counts=weekly.filter(function(m){ return modeOf(m)==='sum' && WEEKLY_ONLY_METRICS.indexOf(m)===-1; });
  var goals=sbdGoals_(c, sel.dept, sel.min);
  var taps=counts.filter(function(m){ return !tdIsFaith_(m); });
  var cfg=tdCfg_(sel), lead=(cfg && cfg.lead) || [];
  var rank=function(m){ var i=lead.indexOf(m); return i<0 ? lead.length : i; };
  var rest=taps.filter(function(m){ return !goals[m]; }).map(function(m, i){ return [m, i]; }).sort(function(x, y){ return rank(x[0])-rank(y[0]) || x[1]-y[1]; }).map(function(x){ return x[0]; });
  taps=taps.filter(function(m){ return goals[m]; }).concat(rest);   // the leader's goals first, then this ministry's own order (TD_MIN), then the taxonomy's
  return { taps:taps, faith:counts.filter(tdIsFaith_), levels:weekly.filter(function(m){ return counts.indexOf(m)===-1; }), goals:goals };
}

/* ---------- what is waiting on this phone ---------- */
function tdPend_(){ try { return JSON.parse(lsGet(TD_PENDING)||'{}') || {}; } catch(e){ return {}; } }
function tdPendSave_(p){ try { lsSet(TD_PENDING, JSON.stringify(p)); } catch(e){} }
function tdPendKey_(sel, date, m){ return [S.auth.user, sel.dept, sel.min, date, m].join('\u0001'); }
function tdPendOf_(sel, date, m){ var p=tdPend_()[tdPendKey_(sel, date, m)]; return p ? p : null; }
function tdPendCount_(){ var u=S.auth && S.auth.user, n=0; Object.keys(tdPend_()).forEach(function(k){ if(k.split('\u0001')[0]===u) n++; }); return n; }

/* ---------- today's and the week's figure for one count ---------- */
function tdVals_(sel, data, m){
  var wk=thisWeek(), date=todayStr(), b=weekBounds_(wk), days=(data && data.daily && data.daily[m]) || {}, sum=0, d;
  for(d in days){ if(d>=b.from && d<=b.to) sum+=Number(days[d])||0; }
  var stored=((data && data.entries && data.entries[m]) || {})[String(wk)];
  var weekVal=stored===undefined ? sum : Number(stored);
  var saved=days[date]===undefined ? 0 : Number(days[date]);
  var p=tdPendOf_(sel, date, m);
  var today=p ? (p.v===null ? 0 : Number(p.v)) : saved;
  /* carry: what the week holds beyond its days — a total somebody typed for the week on the Scorecard. The server
     makes the week the sum of its days the moment a day is saved, so the first tap puts it on the week's Monday. */
  return { today:today, week:weekVal-saved+today, saved:saved, carry:Math.round((weekVal-sum)*1000)/1000, monday:b.from, has:days[date]!==undefined || !!p };
}
function tdSet_(sel, m, v){
  var data=tdData_(sel), x=tdVals_(sel, data, m), date=todayStr(), p=tdPend_();
  if(x.carry && !p[tdPendKey_(sel, x.monday, m)]){
    if(x.monday===date){ if(v!==null) v=Number(v)+x.carry; }
    else { var days=(data && data.daily && data.daily[m]) || {}; p[tdPendKey_(sel, x.monday, m)]={ v:(Number(days[x.monday])||0)+x.carry, d:sel.dept, n:sel.min, date:x.monday, m:m }; }
  }
  p[tdPendKey_(sel, date, m)]={ v:v, d:sel.dept, n:sel.min, date:date, m:m };
  tdPendSave_(p);
  tdPaint_();
  tdSoon_();
}
function tdSoon_(ms){ if(S.td.timer) clearTimeout(S.td.timer); S.td.timer=setTimeout(function(){ S.td.timer=null; tdFlush_(); }, ms==null ? TD_SAVE_MS : ms); }
/* one day of one ministry at a time, the oldest first; a value that changed while it was on its way stays waiting */
function tdFlush_(){
  if(S.td.flying || !S.auth || !S.auth.user || S.stuPreview) return;
  var p=tdPend_(), u=S.auth.user, keys=Object.keys(p).filter(function(k){ return k.split('\u0001')[0]===u; });
  if(!keys.length) return;
  if(!gpOnline_()){ S.td.note='phone'; tdPaint_(); return; }
  keys.sort(function(a, b){ return p[a].date<p[b].date ? -1 : p[a].date>p[b].date ? 1 : 0; });
  var f=p[keys[0]], group=keys.filter(function(k){ return p[k].d===f.d && p[k].n===f.n && p[k].date===f.date; });
  var sent={}, updates=group.map(function(k){ sent[k]=p[k].v; return { metric:p[k].m, mode:'sum', value:p[k].v }; });
  var mine=f.d===S.me.dept && f.n===S.me.ministry;
  S.td.flying=true;
  run(mine ? 'saveMyKpiDay' : 'saveKpiDayFor', mine ? [S.auth.user, S.auth.pin, f.date, updates] : [S.auth.user, S.auth.pin, f.d, f.n, f.date, updates], function(d){
    S.td.flying=false;
    if(!(d && d.ok)){ S.td.note='retry'; tdPaint_(); return; }
    if(mine) S.ministry=d; else { S.oversee=S.oversee||{}; S.oversee[f.n]=d; }
    var q=tdPend_(); group.forEach(function(k){ if(q[k] && q[k].v===sent[k]) delete q[k]; }); tdPendSave_(q);
    try { numbersMarkLogged_(f.d, f.n, isoWeekOf(new Date(f.date+'T00:00:00'))); } catch(e){}
    S.td.note='';
    tdRefresh_();
    if(tdPendCount_() && !S.td.timer) tdSoon_(60);
  }, function(){ S.td.flying=false; S.td.note='phone'; tdPaint_(); });
}
window.addEventListener('online', function(){ if(S.td && S.auth && S.auth.user) tdSoon_(60); });

/* ---------- the days ---------- */
function tdIso_(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function tdClosedSet_(){ return leaveHolidaySet_(S.trips && S.trips.holidays); }
function tdClosed_(d, hol){ return d.getDay()===0 || !!hol[tdIso_(d)]; }
/* every day anyone logged anything for this ministry: a daily count, a weekly row written (the Friday wrap, a tool's
   own row), a win shared — and what is still waiting on this phone */
function tdActive_(sel, data){
  var set={}, m, d;
  ((data && data.active) || []).forEach(function(x){ set[x]=1; });
  var daily=(data && data.daily) || {};
  for(m in daily){ for(d in daily[m]) set[d]=1; }
  ((data && data.wins) || []).forEach(function(w){ if(w.date) set[w.date]=1; });
  var p=tdPend_(), u=S.auth && S.auth.user;
  Object.keys(p).forEach(function(k){ if(k.split('\u0001')[0]===u && p[k].d===sel.dept && p[k].n===sel.min && p[k].v!==null) set[p[k].date]=1; });
  return set;
}
function tdStreak_(set){
  var hol=tdClosedSet_(), d=new Date(), n=0, i;
  d.setHours(12,0,0,0);
  if(!set[tdIso_(d)]) d.setDate(d.getDate()-1);   // today is not over yet
  for(i=0;i<400;i++){
    if(set[tdIso_(d)]) n++;
    else if(!tdClosed_(d, hol)) break;   // a day the base is closed never breaks a streak
    d.setDate(d.getDate()-1);
  }
  return n;
}
function tdBestStreak_(set){
  var hol=tdClosedSet_(), d=new Date(), best=0, run=0, i;
  d.setHours(12,0,0,0); d.setDate(d.getDate()-110);
  for(i=0;i<=110;i++){
    if(set[tdIso_(d)]){ run++; if(run>best) best=run; }
    else if(!tdClosed_(d, hol) && i<110) run=0;
    d.setDate(d.getDate()+1);
  }
  return best;
}
function tdWeekDays_(){
  var mon=mondayOfWeek_(thisWeek()), out=[], i, d;
  for(i=0;i<7;i++){ d=new Date(mon); d.setDate(d.getDate()+i); d.setHours(12,0,0,0); out.push(d); }
  return out;
}
/* a week is "in" when anything at all was logged for it — the same thing the numbers-due reminders ask */
function tdWeekIn_(data, wk){
  var entries=(data && data.entries) || {}, daily=(data && data.daily) || {}, k=String(wk), m, d, b;
  for(m in entries){ if(entries[m] && entries[m][k]!==undefined) return true; }
  b=weekBounds_(wk);
  for(m in daily){ for(d in daily[m]){ if(d>=b.from && d<=b.to) return true; } }
  return false;
}
function tdBestWeeks_(data){
  var best=0, run=0, w, now=Number(thisWeek());
  for(w=1;w<=now;w++){ if(tdWeekIn_(data, w)){ run++; if(run>best) best=run; } else if(w<now) run=0; }
  return best;
}

/* ---------- badges: the ministry's, never tied to how big a number is ---------- */
function tdBadges_(sel, data){
  var set=tdActive_(sel, data), weeks=tdBestWeeks_(data), streak=Math.max(tdStreak_(set), tdBestStreak_(set));
  var goals=Object.keys(tdMetrics_(sel).goals).length, wins=((data && data.wins) || []).length;
  return [
    { id:'week1', icon:'🌱', name:t('First full week'), on:weeks>=1 },
    { id:'week4', icon:'🌿', name:t('4 full weeks in a row'), on:weeks>=4 },
    { id:'week13', icon:'🌳', name:t('A whole quarter — 13 weeks in a row'), on:weeks>=13 },
    { id:'streak10', icon:'🔥', name:t('10-day streak'), on:streak>=10 },
    { id:'streak30', icon:'🏆', name:t('30-day streak'), on:streak>=30 },
    { id:'goals', icon:'🎯', name:t('Goals set'), on:goals>0 },
    { id:'wins5', icon:'🌟', name:t('5 wins shared'), on:wins>=5 }
  ];
}
/* a new one pops once on this phone; the first look at a ministry only remembers what it already has */
function tdBadgeWatch_(sel, list){
  try {
    var all=JSON.parse(lsGet(TD_BADGES)||'{}') || {}, key=tdKey_(sel), had=all[key], got=list.filter(function(b){ return b.on; }).map(function(b){ return b.id; });
    var fresh=had ? list.filter(function(b){ return b.on && had.indexOf(b.id)===-1; }) : [];
    if(!had || fresh.length){ all[key]=got.concat((had||[]).filter(function(x){ return got.indexOf(x)===-1; })); lsSet(TD_BADGES, JSON.stringify(all)); }
    if(fresh.length) setTimeout(function(){ showMsg(fresh[0].icon+' '+gpT('New badge for {ministry}: {badge}',{ ministry:t(sel.min), badge:fresh[0].name }), 5000); gpConfetti(document.getElementById('tdBadges')); }, 400);
  } catch(e){}
}

/* ---------- the pieces ---------- */
function tdTileHtml_(sel, data, m, can){
  var x=tdVals_(sel, data, m), goal=tdMetrics_(sel).goals[m];
  var wkLine=esc(t('This week'))+' <b class="tdWkN">'+fmt(x.week, m)+'</b>'+(goal ? ' <span class="tdGoal">🎯 '+esc(sbdGoalText_(goal, m))+'</span>' : '');
  if(S.td.edit===m && can){
    return '<div class="tdTile editing" data-tdtile="'+esc(m)+'"><div class="tdName">'+tdIcon_(sel, m)+esc(t(m))+'</div>'+
      '<label class="tdTypeLbl" for="tdTypeBox">'+esc(t('Today’s number'))+'</label>'+
      '<div class="tdTypeRow"><input type="number" inputmode="decimal" id="tdTypeBox" class="tdType" value="'+esc(String(x.has ? x.today : ''))+'"><button type="button" class="btn small" id="tdTypeOk" data-tdtypeok="'+esc(m)+'">'+esc(t('OK'))+'</button></div>'+
      '<button type="button" class="linkbtn inline" id="tdTypeCancel">'+esc(t('Cancel'))+'</button></div>';
  }
  var body='<span class="tdNum">'+fmt(x.today, m)+'</span><span class="tdName">'+tdIcon_(sel, m)+esc(t(m))+'</span><span class="tdWk">'+wkLine+'</span>';
  if(!can) return '<div class="tdTile ro" data-tdtile="'+esc(m)+'"><div class="tdTap">'+body+'</div></div>';
  return '<div class="tdTile" data-tdtile="'+esc(m)+'"><button type="button" class="tdTap" data-tdtap="'+esc(m)+'" aria-label="'+esc(gpT('Add 1 to {metric}',{metric:t(m)}))+'">'+body+'<span class="tdPlus" aria-hidden="true">+1</span></button>'+
    '<div class="tdTileBtns"><button type="button" class="tdMini" data-tdminus="'+esc(m)+'" aria-label="'+esc(gpT('Take 1 off {metric}',{metric:t(m)}))+'">−</button>'+
    '<button type="button" class="tdMini" data-tdedit="'+esc(m)+'" aria-label="'+esc(gpT('Type today’s number for {metric}',{metric:t(m)}))+'">✎</button></div></div>';
}
function tdCountersHtml_(sel, data, M, can){
  if(!M.taps.length) return '';
  var list=S.td.more ? M.taps : M.taps.slice(0, TD_TILES);
  var h='<div class="tdTiles'+(list.length===1 ? ' one' : '')+'" id="tdTiles">'+list.map(function(m){ return tdTileHtml_(sel, data, m, can); }).join('')+'</div>';
  if(M.taps.length>TD_TILES) h+='<button type="button" class="linkbtn inline tdMore" id="tdMore">'+esc(S.td.more ? t('Show fewer') : gpT('{n} more…',{n:M.taps.length-TD_TILES}))+'</button>';
  return h;
}
/* faith numbers: counted, plainly — no tile, no ring, no celebration */
function tdAlsoHtml_(sel, data, M, can){
  if(!M.faith.length) return '';
  return '<div class="tdAlso" id="tdAlso"><div class="tdAlsoHead">'+esc(t('Also today'))+'</div>'+M.faith.map(function(m, i){
    var x=tdVals_(sel, data, m), id='tdAlso'+i;
    return '<div class="tdAlsoRow"><label for="'+id+'">'+esc(t(m))+'</label>'+
      (can ? '<input type="number" inputmode="numeric" id="'+id+'" data-tdalso="'+esc(m)+'" value="'+esc(x.has ? String(x.today) : '')+'" placeholder="0">'
           : '<span class="tdAlsoVal">'+fmt(x.today, m)+'</span>')+
      '<span class="tdAlsoWk">'+esc(t('This week'))+' '+fmt(x.week, m)+'</span></div>'; }).join('')+'</div>';
}
function tdRingCalc_(sel, data, M){
  var c=S.me.campus, wk=thisWeek(), entries=(data && data.entries) || {};
  var withGoal=Object.keys(M.goals).filter(function(m){ return !tdIsFaith_(m) && metricsFor(c, sel.dept, sel.min).indexOf(m)>-1; }), on=0;
  withGoal.forEach(function(m){
    var v=(entries[m]||{})[String(wk)];
    if(M.taps.indexOf(m)>-1) v=tdVals_(sel, data, m).week;
    if(sbdOn_(M.goals[m], v)===true) on++;
  });
  var d, n, line, sub='';
  if(withGoal.length){ d=on; n=withGoal.length; line=gpT('{d} of {n} goals on target',{d:d, n:n}); sub=t('this week'); }
  else {
    var set=tdActive_(sel, data), hol=tdClosedSet_(), today=todayStr(); d=0; n=0;
    tdWeekDays_().forEach(function(x){ var iso=tdIso_(x); if(iso>today) return; if(set[iso]) d++; if(set[iso] || !tdClosed_(x, hol)) n++; });
    line=gpT('{d} of {n} days logged this week',{d:d, n:n});
  }
  return { d:d, n:n, line:line, sub:sub, goals:withGoal.length, p:n ? Math.round(d/n*100) : 0 };
}
function tdRingHtml_(sel, data, M, can){
  var c=S.me.campus, R=tdRingCalc_(sel, data, M);
  return '<div class="tdRing" id="tdRing"><div class="gRing lg" style="'+gpRingVars(R.p)+'" role="img" aria-label="'+esc(R.line)+'"><span>'+R.d+'/'+R.n+'</span></div>'+
    '<div class="tdRingText"><b id="tdRingLine">'+esc(R.line)+'</b>'+(R.sub ? '<span class="hint">'+esc(R.sub)+'</span>' : '')+
    (!R.goals && can && canEditMetricsClient_(c, sel.dept, sel.min) && M.taps.concat(M.levels).length ? '<button type="button" class="linkbtn inline" id="tdSetGoals">🎯 '+esc(t('Set this week’s goals'))+'</button>' : '')+'</div></div>';
}
function tdStreakHtml_(sel, data){
  var set=tdActive_(sel, data), n=tdStreak_(set), hol=tdClosedSet_(), today=todayStr(), names=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var dots=tdWeekDays_().map(function(x, i){
    var iso=tdIso_(x), cls=set[iso] ? 'on' : iso>today ? 'future' : tdClosed_(x, hol) ? 'closed' : iso===today ? 'today' : 'off';
    return '<span class="tdDot '+cls+(iso===today ? ' now' : '')+'" data-tddot="'+iso+'"><i aria-hidden="true">'+(set[iso] ? '✓' : '')+'</i><small>'+esc(t(names[i]))+'</small></span>'; }).join('');
  var done=tdWeekDays_().filter(function(x){ return set[tdIso_(x)]; }).length;
  return '<div class="tdStreak" id="tdStreak"><div class="tdStreakLine"><span class="tdFlame" aria-hidden="true">🔥</span><b id="tdStreakN" data-n="'+n+'">'+
    esc(n>0 ? gpT('{n}-day team streak',{n:n}) : t('Start the team streak today'))+'</b></div>'+
    '<div class="tdDots" role="img" aria-label="'+esc(gpT('{d} of 7 days logged this week',{d:done}))+'">'+dots+'</div></div>';
}
function tdWhen_(date){
  var today=todayStr(), y=new Date(); y.setDate(y.getDate()-1);
  return date===today ? t('today') : date===tdIso_(y) ? t('yesterday') : teamDate_(date).replace(/, \d{4}$/, '');
}
function tdWinsHtml_(sel, data, can){
  var feedFrom=new Date(); feedFrom.setDate(feedFrom.getDate()-TD_FEED_DAYS); feedFrom=tdIso_(feedFrom);
  var wins=((data && data.wins) || []).filter(function(w){ return w.date>=feedFrom; }), list=S.td.winsAll ? wins : wins.slice(0, TD_WINS_SHOWN);   // the feed: two months; the store keeps 200 days for the quarter's story
  var h='<div class="tdWin" id="tdWin"><div class="tdHead">🌟 '+esc(t('Win of the day'))+'</div>';
  if(can) h+='<div class="tdWinRow"><input type="text" id="tdWinText" maxlength="200" value="'+esc(S.td.winDraft||'')+'" placeholder="'+esc(t('Something good that happened today'))+'" aria-label="'+esc(t('Something good that happened today'))+'" autocomplete="off">'+
    '<button type="button" class="btn small" id="tdWinSave"'+(S.td.winBusy ? ' disabled' : '')+'>'+esc(t('Share'))+'</button></div>'+
    '<p class="hint tdWinHint">'+esc(t('One line, for your team. No child’s full name.'))+'</p>';
  if(list.length) h+='<ul class="tdWinList" id="tdWinList">'+list.map(function(w){
    return '<li data-tdwin="'+esc(w.id)+'"><span class="tdWinTxt">'+esc(w.text)+'</span><span class="tdWinBy">'+esc(w.name||'')+(w.name ? ' · ' : '')+esc(tdWhen_(w.date))+
      (w.mine && can ? ' <button type="button" class="tdWinDel" data-tdwindel="'+esc(w.id)+'" aria-label="'+esc(t('Take this win off'))+'">✕</button>' : '')+'</span></li>'; }).join('')+'</ul>';
  else if(!can) h+='<p class="hint">'+esc(t('No wins shared yet.'))+'</p>';
  if(wins.length>TD_WINS_SHOWN) h+='<button type="button" class="linkbtn inline" id="tdWinsAll">'+esc(S.td.winsAll ? t('Show fewer') : gpT('Show all {n} wins',{n:wins.length}))+'</button>';
  return h+'</div>';
}
/* The Friday wrap: the week's own numbers (levels and scores), drawn by the weekly form's own row (kpiWeekRowHtml_,
   carried-forward values and all) and saved by its own path (gpSaveMinistry_ → saveMyMinistry / saveMinistryFor). */
function tdWrapDue_(){ var dow=new Date().getDay(); return dow===5 || dow===6 || dow===0; }
function tdWrapHtml_(sel, data, M, can){
  if(!can || !M.levels.length || !tdWrapDue_()) return '';
  var wk=thisWeek(), entries=(data && data.entries) || {}, key=tdKey_(sel)+'|'+wk;
  var allIn=M.levels.some(function(m){ return (entries[m]||{})[String(wk)]!==undefined; });   // the wrap was saved (a box left empty is allowed)
  if(allIn && !S.td.wrapOpen) return '<div class="tdWrap done" id="tdWrapDone" data-tdfresh="'+(S.td.wrapDone===key ? '1' : '')+'"><b>🎉 '+esc(gpT('Week {wk} complete',{wk:wk}))+'</b>'+
    '<span class="hint">'+esc(t('The week’s numbers are in. Thank you.'))+'</span><button type="button" class="linkbtn inline" id="tdWrapOpen">'+esc(t('Change them'))+'</button></div>';
  if(!S.td.wrapOpen) return '<div class="tdWrap" id="tdWrap"><div class="tdHead">📦 '+esc(t('Wrap up the week'))+'</div>'+
    '<p class="hint">'+esc(gpT('{n} numbers for the whole week — most are already filled in from last week.',{n:M.levels.length}))+'</p>'+
    '<button type="button" class="btn" id="tdWrapOpen">'+esc(t('Wrap up the week'))+'</button></div>';
  var draft=S.td.wrapDraft[key] || (S.td.wrapDraft[key]={});
  var rows=M.levels.map(function(m){ return kpiWeekRowHtml_(m, wk, entries, (data && data.prev) || {}, draft, S.me.campus, sel.dept, sel.min).replace(/data-kpiweek=/g, 'data-tdweek='); }).join('');
  return '<div class="tdWrap open" id="tdWrap" data-tdwrapkey="'+esc(key)+'"><div class="tdHead">📦 '+esc(t('Wrap up the week'))+'</div>'+
    '<p class="hint">'+esc(t('One number per week — headcounts and scores carry forward until changed; the rest is logged fresh each week.'))+'</p>'+rows+
    '<div class="btnRow"><button type="button" class="btn" id="tdWrapSave">'+esc(gpT('Save week {wk}',{wk:wk}))+'</button><button type="button" class="btn ghost" id="tdWrapClose">'+esc(t('Not now'))+'</button></div></div>';
}
function tdBadgesHtml_(sel, data){
  var list=tdBadges_(sel, data), got=list.filter(function(b){ return b.on; }).length;
  return '<details class="tdBadges" id="tdBadges"><summary><span>🏅 '+esc(t('Our badges'))+'</span><span class="tdBadgeN">'+got+' / '+list.length+'</span>'+
    '<span class="tdBadgeRow" aria-hidden="true">'+list.map(function(b){ return '<i class="'+(b.on ? 'on' : '')+'">'+b.icon+'</i>'; }).join('')+'</span></summary>'+
    '<ul>'+list.map(function(b){ return '<li class="'+(b.on ? 'on' : '')+'" data-tdbadge="'+b.id+'"><i aria-hidden="true">'+b.icon+'</i> '+esc(b.name)+' <span class="hint">'+esc(b.on ? t('earned') : t('not yet'))+'</span></li>'; }).join('')+'</ul>'+
    '<p class="hint">'+esc(t('Badges are the whole ministry’s, for showing up and logging honestly — never for how big a number is.'))+'</p></details>';
}
function tdNoteText_(){
  if(S.td.note==='phone' || (!gpOnline_() && tdPendCount_())) return t('Saved on this phone — it will send when you’re back online.');
  if(S.td.note==='retry') return t('Not saved yet — it will try again.');
  return '';
}
function tdNoteHtml_(){ return '<p class="hint tdNote" id="tdNote" role="status" aria-live="polite">'+esc(tdNoteText_())+'</p>'; }

/* ---------- a ministry's own lines above its tiles (TD_MIN `extra`): read-only, from what the app already has ---------- */
function tdLine_(id, attrs, icon, main, sub){
  return '<button type="button" class="tdLine" id="'+id+'"'+(attrs||'')+'><span class="tdLineIc" aria-hidden="true">'+icon+'</span><span class="tdLineTxt"><b>'+main+'</b>'+(sub ? '<small>'+sub+'</small>' : '')+'</span><span class="tdLineGo" aria-hidden="true">›</span></button>';
}
/* Hospitality: tonight, from the booking book (S.hosp — getHospitality, asked for once when this tab opens, never on app open) */
function tdTonightHtml_(){
  if(!canHospClient_()) return '';
  var H=S.hosp;
  if(!H) return S.hospError ? '' : tdLine_('tdTonight', ' data-tdload="1"', '🛏', esc(t('Tonight')), esc(t('Loading…')));
  if(!H.rooms || !H.rooms.length) return '';
  var today=todayStr(), cap=hospCap_(H), held=hospDaily_(H.bookings, today, hospAdd_(today, 1))[0] || 0, arr=0, lv=0;
  H.bookings.forEach(function(k){ if(k.from===today) arr+=Number(k.count)||0; if(!k.permanent && k.to===today) lv+=Number(k.count)||0; });
  return tdLine_('tdTonight', ' data-held="'+held+'" data-cap="'+cap+'" data-arr="'+arr+'" data-lv="'+lv+'"', '🛏',
    esc(gpT('Tonight: {n} of {cap} beds filled · {free} free',{ n:held, cap:cap, free:Math.max(0, cap-held) })),
    esc(gpT('Arriving today {a} · leaving today {l}',{ a:arr, l:lv })));
}
/* Culinary / Hospitality: is the week's schedule out? (the boot's `schedules` — S.sched; published weeks only) */
function tdSchedLineHtml_(kind){
  var d=S.sched, k=SCHED_KINDS.filter(function(x){ return x[0]===kind; })[0];
  if(!d || !k || typeof dutyHtml!=='function') return '';
  var now=!!(d.now && d.now[kind]), next=!!(d.next && d.next[kind]);
  var yes=t('published ✓'), no=t('not yet');
  return tdLine_('tdSched', ' data-tdsched="'+kind+'" data-now="'+(now ? 1 : 0)+'" data-next="'+(next ? 1 : 0)+'"', k[1],
    esc(gpT('This week’s {name}: {state}',{ name:t(k[2]).toLowerCase(), state:now ? yes : no })),
    esc(gpT('Next week: {state}',{ state:next ? yes : no })));
}
/* Technical: work requests are GP Tasks asked of Technical ("Ask another ministry") — its designated list, no store of its own */
var TD_TECH={ dept:'Skills Training', min:'Technical' }, TD_REQ_SHOWN=3;
function tdTechReqs_(){
  var G=S.gpt; if(!G) return null;
  var L=G.lists.filter(function(l){ return l.scope==='ministry' && l.dept===TD_TECH.dept && l.ministry===TD_TECH.min && l.campus===S.me.campus; })[0];
  if(!L) return [];
  return G.tasks.filter(function(x){ return x.listId===L.id && !x.done && x.status!=='declined' && x.from; })
    .sort(function(a, b){ return String(a.created||'')<String(b.created||'') ? -1 : 1; });   // the oldest first
}
function tdReqHtml_(can){
  var list=tdTechReqs_();
  if(list===null) return S.gptErr ? '' : '<div class="tdReq" id="tdReq" data-tdload="1"><div class="tdHead">🔧 '+esc(t('Work requests'))+'</div><p class="hint">'+esc(t('Loading…'))+'</p></div>';
  var h='<div class="tdReq" id="tdReq" data-n="'+list.length+'"><div class="tdHead">🔧 '+esc(list.length===1 ? t('1 open request') : gpT('{n} open requests',{n:list.length}))+'</div>';
  if(!list.length) h+='<p class="hint">'+esc(t('Nothing is waiting. Anyone can ask from ☰ → Ask Technical.'))+'</p>';
  else h+='<ul class="tdReqList">'+list.slice(0, TD_REQ_SHOWN).map(function(x){
    var first=String(x.notes||'').split('\n')[0], who=(x.from && x.from.label) ? t(x.from.label) : '', when=x.created ? tdWhen_(String(x.created).slice(0, 10)) : '';
    return '<li data-tdreq="'+esc(x.id)+'"><span class="tdReqTxt"><b>'+esc(x.title)+'</b>'+(first ? '<small>'+esc(first)+'</small>' : '')+
      '<small class="tdReqBy">'+esc(nameOf(x.by)||'')+(who ? ' · '+esc(who) : '')+(when ? ' · '+esc(when) : '')+'</small></span>'+
      (can ? '<button type="button" class="btn small tdReqDone" data-tdreqdone="'+esc(x.id)+'"'+(S.td.reqBusy===x.id ? ' disabled' : '')+' aria-label="'+esc(gpT('Mark “{title}” done',{title:x.title}))+'">✓ '+esc(t('Done'))+'</button>' : '')+'</li>'; }).join('')+'</ul>';
  if(list.length) h+='<button type="button" class="linkbtn inline" id="tdReqAll">'+esc(list.length>TD_REQ_SHOWN ? gpT('See all {n} in Tasks',{n:list.length}) : t('Open them in Tasks'))+'</button>';
  return h+'</div>';
}
function tdExtrasHtml_(sel, can, below){   // one-line ones above the tiles; the requests box under them, so the counters still need no scrolling
  var c=tdCfg_(sel), h=''; if(!c || !c.extra) return '';
  c.extra.forEach(function(x){
    if(x==='tech'){ if(below) h+=tdReqHtml_(can); }
    else if(below) return;
    else if(x==='hosp') h+=tdTonightHtml_();
    else if(x.indexOf('sched:')===0) h+=tdSchedLineHtml_(x.slice(6));
  });
  return h;
}
function tdReqDone_(id){
  var x=((S.gpt && S.gpt.tasks)||[]).filter(function(y){ return y.id===id; })[0]; if(!x || S.td.reqBusy) return;
  S.td.reqBusy=id; tdRefresh_();
  var fail=function(){ S.td.reqBusy=''; showMsg(t('Could not save')); tdRefresh_(); };
  var finish=function(){ run('saveGpTask', [S.auth.user, S.auth.pin, { id:id, done:true }], function(d){
    if(!(d && d.ok)) return fail();
    gptTake_(d); S.td.reqBusy=''; showMsg(t('Done — thank you')); tdRefresh_(); }, fail); };
  /* a request still waiting is taken first (respondGpTask) — only then can it be ticked */
  if(x.status==='request') run('respondGpTask', [S.auth.user, S.auth.pin, id, true], function(d){ if(!(d && d.ok)) return fail(); gptTake_(d); finish(); }, fail);
  else finish();
}

/* ---------- "Ask Technical to fix something" (☰ → Operations, and search): any staff member ----------
   One GP Task, asked of Technical through the existing "Ask another ministry" path (saveGpTask {askMin}) — its people
   hear of it, it lands in its designated list, and it shows on Technical's Today. Text only: GP Tasks holds no photos. */
function tdAskTechOpen_(){
  S.at={ what:'', where:'', more:'', busy:false, sent:false, rid:'at'+Date.now().toString(36)+Math.random().toString(36).slice(2, 8) };
  tdAskDraw_(); var i=document.getElementById('atWhat'); if(i) i.focus();
}
function tdAskDraw_(){
  var root=document.getElementById('atRoot');
  if(!root){ root=document.createElement('div'); root.id='atRoot'; document.body.appendChild(root); }
  var A=S.at; if(!A){ root.innerHTML=''; return; }
  var h='<div class="atScrim" id="atScrim"></div><div class="gtSheet atSheet" id="atSheet" role="dialog" aria-modal="true" aria-label="'+esc(t('Ask Technical to fix something'))+'">'+
    '<div class="gtSheetHead"><b>🔧 '+esc(t('Ask Technical to fix something'))+'</b></div>';
  if(A.sent) h+='<p class="sub" id="atSent" style="margin:0">✅ '+esc(t('Sent to Technical. They see it on their page, and you can follow it in GP Tasks → Inbox.'))+'</p>'+
    '<button type="button" class="btn" id="atCancel">'+esc(t('Close'))+'</button>';
  else h+='<label class="f" for="atWhat">'+esc(t('What needs fixing?'))+'</label><input type="text" id="atWhat" maxlength="120" value="'+esc(A.what)+'" placeholder="'+esc(t('e.g. The tap is leaking'))+'" autocomplete="off">'+
    '<label class="f" for="atWhere">'+esc(t('Where is it?'))+'</label><input type="text" id="atWhere" maxlength="80" value="'+esc(A.where)+'" placeholder="'+esc(t('e.g. Room 203, the kitchen'))+'" autocomplete="off">'+
    '<label class="f" for="atMore">'+esc(t('Anything else they should know? (optional)'))+'</label><textarea id="atMore" rows="2" maxlength="500">'+esc(A.more)+'</textarea>'+
    '<div class="btnRow"><button type="button" class="btn" id="atSend"'+(A.busy ? ' disabled' : '')+'>'+esc(A.busy ? t('Sending…') : t('Send to Technical'))+'</button>'+
    '<button type="button" class="btn ghost" id="atCancel">'+esc(t('Cancel'))+'</button></div>';
  root.innerHTML=h+'</div>';
  var close=function(){ S.at=null; tdAskDraw_(); };
  document.getElementById('atScrim').onclick=close; document.getElementById('atCancel').onclick=close;
  ['What','Where','More'].forEach(function(k){ var el=document.getElementById('at'+k); if(el) el.oninput=function(){ A[k.toLowerCase()]=el.value; }; });
  var send=document.getElementById('atSend'); if(send) send.onclick=function(){
    var what=String(A.what||'').replace(/\s+/g, ' ').trim(), where=String(A.where||'').replace(/\s+/g, ' ').trim(), more=String(A.more||'').trim();
    if(!what){ showMsg(t('Say what needs fixing.')); var w=document.getElementById('atWhat'); if(w) w.focus(); return; }
    if(A.busy) return;
    if(!gpOnline_()){ showMsg(t('No connection — try again when you’re back online.')); return; }
    gpTap(); A.busy=true; tdAskDraw_();
    var back=function(msg){ A.busy=false; showMsg(msg); tdAskDraw_(); };
    run('saveGpTask', [S.auth.user, S.auth.pin, { askMin:TD_TECH.dept+'|'+TD_TECH.min, title:what, notes:(where ? '📍 '+where : '')+(where && more ? '\n' : '')+more, rid:A.rid }], function(d){
      if(!(d && d.ok)) return back(t('Could not save'));
      if(S.gpt) gptTake_(d);
      A.busy=false; A.sent=true; tdAskDraw_();
      if(S.view==='ministry') tdRefresh_();
    }, function(){ back(t('No connection — try again when you’re back online.')); });
  };
}

/* ---------- the Today tab ---------- */
function tdLoadingHtml_(sel){
  if(S.ovError && S.ovError[sel.min]) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(gpT('Couldn’t load {ministry}’s numbers.',{ministry:t(sel.min)}))+'</p>'+
    '<p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.ovError[sel.min])+'</p><button class="btn ghost" id="ovRetry" data-ministry="'+esc(sel.min)+'" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
}
function tdInnerHtml_(sel){
  var data=tdData_(sel), can=tdCanLog_(sel), M=tdMetrics_(sel);
  var h='';   // no heading: the tab already says Today, and the counters should need no scrolling
  var cfg=tdCfg_(sel);
  if(!can) h+='<p class="hint" id="tdReadOnly">👀 '+esc(t('You can look, but only this ministry’s own people enter its numbers.'))+'</p>';
  else if(!M.taps.length) h+='<p class="hint" id="tdCalm">'+esc(cfg && cfg.prompt ? cfg.prompt() : M.levels.length ? t('Nothing to count day by day here. Share a win when there is one, and wrap up the week on Friday.') : t('Nothing to count day by day here. Share a win when there is one.'))+'</p>';
  else if(cfg && cfg.prompt) h+='<p class="hint" id="tdHow"><b class="tdPrompt" id="tdPrompt">'+esc(cfg.prompt())+'</b> '+esc(t('− takes one off, ✎ types the number.'))+'</p>';   // the ministry's own line, in the generic line's place
  else h+='<p class="hint" id="tdHow">'+esc(t('Tap a tile each time it happens. − takes one off, ✎ types the number.'))+'</p>';
  h+=tdExtrasHtml_(sel, can);
  h+=tdCountersHtml_(sel, data, M, can)+tdNoteHtml_()+tdExtrasHtml_(sel, can, true)+tdWrapHtml_(sel, data, M, can)+
    '<div class="tdPair">'+tdRingHtml_(sel, data, M, can)+tdStreakHtml_(sel, data)+'</div>'+
    tdAlsoHtml_(sel, data, M, can)+tdWinsHtml_(sel, data, can)+tdBadgesHtml_(sel, data);
  return h;
}
function todayPaneHtml_(sel){
  if(!tdData_(sel)) return tdLoadingHtml_(sel);
  return '<div class="tdToday" id="tdToday" data-tdkey="'+esc(tdKey_(sel))+'">'+tdInnerHtml_(sel)+'</div>';
}
/* a ministry with its own daily home (the Cafe, the school, GPDTS, Outreach Teams, Intercession, Worship): the shared
   pieces in one strip at the top of its first tab — its counting stays its tool's */
function todayStripHtml_(sel){
  var data=tdData_(sel); if(!data) return '';
  var can=tdCanLog_(sel), M=tdMetrics_(sel), key=tdKey_(sel), open=S.td.stripOpen===key;
  var n=tdStreak_(tdActive_(sel, data)), R=tdRingCalc_(sel, data, M), got=tdBadges_(sel, data).filter(function(b){ return b.on; }).length;
  /* ONE row (Nov 2026: the full pieces were ~330px and pushed the tool down): streak · ring · badges, and ＋ Win; a tap opens the rest */
  var bar='<div class="tdBar" id="tdBar"><button type="button" class="tdBarMain" id="tdBarOpen" aria-expanded="'+(open ? 'true' : 'false')+'" aria-controls="tdStripMore" aria-label="'+esc(t('Streak, this week and badges'))+'">'+
    '<span class="tdBarIt" id="tdBarStreak" data-n="'+n+'" title="'+esc(n>0 ? gpT('{n}-day team streak',{n:n}) : t('Start the team streak today'))+'"><span aria-hidden="true">🔥</span> <b>'+n+'</b></span>'+
    '<span class="tdBarIt" id="tdBarRing" title="'+esc(R.line)+'"><span class="gRing sm" style="'+gpRingVars(R.p)+'" role="img" aria-label="'+esc(R.line)+'"><span>'+R.d+'/'+R.n+'</span></span></span>'+
    '<span class="tdBarIt" id="tdBarBadges" data-n="'+got+'" title="'+esc(t('Our badges'))+'"><span aria-hidden="true">🏅</span> <b>'+got+'</b></span>'+
    '<span class="tdBarChev" aria-hidden="true">'+(open ? '▴' : '▾')+'</span></button>'+
    (can ? '<button type="button" class="tdBarWin" id="tdBarWin">＋ '+esc(t('Win'))+'</button>' : '')+'</div>';
  return '<div class="tdToday tdStrip'+(open ? ' open' : '')+'" id="tdToday" data-tdstrip="1" data-tdkey="'+esc(key)+'">'+bar+
    (open ? '<div class="tdStripMore" id="tdStripMore"><div class="tdPair">'+tdStreakHtml_(sel, data)+tdRingHtml_(sel, data, M, false)+'</div>'+tdWinsHtml_(sel, data, can)+tdBadgesHtml_(sel, data)+'</div>' : '')+'</div>';
}

/* ---------- painting without a redraw ---------- */
function tdPaint_(){
  var box=document.getElementById('tdToday'), sel=tdSel_(); if(!box || !sel) return;
  var data=tdData_(sel);
  box.querySelectorAll('[data-tdtile]').forEach(function(tile){
    var m=tile.getAttribute('data-tdtile'), x=tdVals_(sel, data, m), n=tile.querySelector('.tdNum'), w=tile.querySelector('.tdWkN');
    if(n){ var txt=String(fmt(x.today, m)); if(n.textContent!==txt){ n.textContent=txt; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump'); } }
    if(w) w.textContent=String(fmt(x.week, m));
  });
  var note=document.getElementById('tdNote'); if(note) note.textContent=tdNoteText_();
}
/* the Today block again, in its place (never the page): the ring, the streak and the dots follow a save */
function tdRefresh_(){
  var box=document.getElementById('tdToday'), sel=tdSel_(); if(!box || !sel || S.view!=='ministry') return;
  var a=document.activeElement;
  if(a && box.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)){ tdPaint_(); return; }   // somebody is typing: leave the boxes alone
  var tmp=document.createElement('div');
  tmp.innerHTML=box.getAttribute('data-tdstrip') ? todayStripHtml_(sel) : todayPaneHtml_(sel);
  var nb=tmp.querySelector('#tdToday'); if(!nb) return;
  var open=box.querySelector('#tdBadges'); if(open && open.open){ var nd=nb.querySelector('#tdBadges'); if(nd) nd.open=true; }
  box.innerHTML=nb.innerHTML; box.className=nb.className;
  bindToday_();
}

/* ---------- handlers ---------- */
function tdWinSave_(sel){
  var box=document.getElementById('tdWinText'), text=String((box && box.value) || '').replace(/\s+/g, ' ').trim();
  if(!text || S.td.winBusy) return;
  if(!gpOnline_()){ showMsg(t('No connection — your win is kept here until you can send it.')); return; }
  S.td.winBusy=true;
  run('saveMinistryWin', [S.auth.user, S.auth.pin, sel.dept, sel.min, text], function(d){
    S.td.winBusy=false;
    if(d && d.ok){ var data=tdData_(sel); if(data) data.wins=d.wins||[]; S.td.winDraft=''; if(box){ box.value=''; box.blur(); } showMsg(t('Shared with your team')); tdRefresh_(); }
    else showMsg(d && d.err==='too_many' ? t('That is plenty for one day — more tomorrow.') : t('Could not save'));
  }, function(){ S.td.winBusy=false; showMsg(t('No connection — your win is kept here until you can send it.')); });
}
function tdWrapSave_(sel){
  var wrap=document.getElementById('tdWrap'); if(!wrap || S.busy) return;
  var wk=thisWeek(), key=wrap.getAttribute('data-tdwrapkey'), updates=[], mine=tdMine_(sel);
  wrap.querySelectorAll('[data-tdweek]').forEach(function(inp){ updates.push({ metric:inp.getAttribute('data-tdweek'), value: inp.value==='' ? null : Number(inp.value) }); });
  var bad=kpiProblem_(updates, sel.min); if(bad){ showMsg(bad); return; }
  S.busy=true;
  var btn=document.getElementById('tdWrapSave'); if(btn){ btn.disabled=true; btn.textContent=t('Saving…'); }
  gpSaveMinistry_({ fn: mine ? 'saveMyMinistry' : 'saveMinistryFor', args: mine ? [S.auth.user, S.auth.pin, wk, updates] : [S.auth.user, S.auth.pin, sel.dept, sel.min, wk, updates],
    dept:sel.dept, min:sel.min, wk:wk, updates:updates, done:function(d, queued){
      S.busy=false;
      if(!queued && !(d && d.ok)){ showMsg(t('Could not save')); render(); return; }
      if(!queued){
        if(mine) S.ministry=d; else S.oversee[sel.min]=d;
        numbersMarkLogged_(sel.dept, sel.min, wk);
        if(d.rejected && d.rejected.length) showMsg(kpiProblem_(d.rejected.map(function(m){ return { metric:m, value:-1e9 }; }), sel.min));
      }
      delete S.td.wrapDraft[key]; S.td.wrapOpen=false; S.td.wrapDone=key;
      render();
    }});
}
function bindToday_(){
  /* the quarter's story form (29-report.js): a win tapped goes into Highlights */
  document.querySelectorAll('[data-qrwin]').forEach(function(b){ b.onclick=function(){
    var ta=document.querySelector('#qrForm [data-qrf="highlights"]'); if(!ta) return;
    var add='• '+b.getAttribute('data-qrwin'), cur=ta.value.replace(/\s+$/, '');
    if(cur.indexOf(add)>-1) return;
    var next=(cur ? cur+'\n' : '')+add, max=Number(ta.getAttribute('maxlength'))||2000;
    if(next.length>max){ showMsg(t('Highlights is full.')); return; }
    gpTap(); ta.value=next; if(ta.oninput) ta.oninput(); b.classList.add('used'); b.disabled=true;
  }; });
  var box=document.getElementById('tdToday'), sel=tdSel_(); if(!box || !sel) return;
  var data=tdData_(sel);
  /* a ministry's own lines: ask once for what they read, when this tab is open (never on app open) */
  if(!box.getAttribute('data-tdstrip')){
    if(tdHasExtra_(sel, 'hosp') && canHospClient_() && !S.hosp && !S.hospLoading && !S.hospError){
      S.hospLoading=true;
      run('getHospitality', [S.auth.user, S.auth.pin], function(d){ S.hospLoading=false; if(d && d.ok){ S.hosp=d; S.hospNews=(d.changes||[]).slice(0, 10); } else S.hospError=hospErr_(d); tdRefresh_(); },
        function(e){ S.hospLoading=false; S.hospError=(e && e.message) || t('Connection problem — try again.'); tdRefresh_(); });
    }
    if(tdHasExtra_(sel, 'tech') && !S.gpt && !S.gptLoading && !S.gptErr){
      S.gptLoading=true;
      run('getGpTasks', [S.auth.user, S.auth.pin], function(d){ S.gptLoading=false; if(d && d.ok) gptTake_(d); else S.gptErr=(d && d.err) || 'error'; tdRefresh_(); },
        function(){ S.gptLoading=false; S.gptErr='offline'; tdRefresh_(); });
    }
  }
  var tn=document.getElementById('tdTonight'); if(tn) tn.onclick=function(){ gpTap(); S.view='hosp'; S.hospTab='dash'; render(); window.scrollTo(0,0); };
  var sl=document.getElementById('tdSched'); if(sl) sl.onclick=function(){ gpTap(); var k=sl.getAttribute('data-tdsched'); schedOpen_(k, !!(S.sched && S.sched.canEdit && S.sched.canEdit[k]), 'ministry'); };
  box.querySelectorAll('[data-tdreqdone]').forEach(function(b){ b.onclick=function(){ gpTap(); tdReqDone_(b.getAttribute('data-tdreqdone')); }; });
  var ra=document.getElementById('tdReqAll'); if(ra) ra.onclick=function(){ gpTap(); S.mmTab='tasks'; S.mmTabTouched=true; mmTabKeep_('tasks'); render(); window.scrollTo(0,0); };
  var bo=document.getElementById('tdBarOpen'); if(bo) bo.onclick=function(){ gpTap(); S.td.stripOpen=S.td.stripOpen===tdKey_(sel) ? '' : tdKey_(sel); tdRefresh_(); };
  var bw=document.getElementById('tdBarWin'); if(bw) bw.onclick=function(){ gpTap(); S.td.stripOpen=tdKey_(sel); tdRefresh_(); var i=document.getElementById('tdWinText'); if(i) i.focus(); };
  box.querySelectorAll('[data-tdtap]').forEach(function(b){
    var m=b.getAttribute('data-tdtap'), hold=null, held=false;
    var stop=function(){ if(hold){ clearTimeout(hold); hold=null; } };
    b.addEventListener('pointerdown', function(){ held=false; stop(); hold=setTimeout(function(){ held=true; hold=null; gpTap(); S.td.edit=m; tdRefresh_(); var i=document.getElementById('tdTypeBox'); if(i){ i.focus(); i.select(); } }, S.tdHoldMs||TD_HOLD_MS); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(ev){ b.addEventListener(ev, stop); });
    b.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    b.onclick=function(){ if(held){ held=false; return; } gpTap(); tdSet_(sel, m, tdVals_(sel, tdData_(sel), m).today+1); };
  });
  box.querySelectorAll('[data-tdminus]').forEach(function(b){ b.onclick=function(){
    var m=b.getAttribute('data-tdminus'), x=tdVals_(sel, tdData_(sel), m); if(x.today<=0) return;
    gpTap(); tdSet_(sel, m, x.today-1); }; });
  box.querySelectorAll('[data-tdedit]').forEach(function(b){ b.onclick=function(){ gpTap(); S.td.edit=b.getAttribute('data-tdedit'); tdRefresh_(); var i=document.getElementById('tdTypeBox'); if(i){ i.focus(); i.select(); } }; });
  var ok=document.getElementById('tdTypeOk'), tb=document.getElementById('tdTypeBox'), typeDone=function(){
    var m=ok.getAttribute('data-tdtypeok'), raw=String(tb.value).trim();
    if(raw!=='' && !isFinite(Number(raw))) return;
    S.td.edit=null; tb.blur();
    if(raw!=='') tdSet_(sel, m, Number(raw));
    tdRefresh_();
  };
  if(ok && tb){ ok.onclick=function(){ gpTap(); typeDone(); }; tb.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); typeDone(); } }; }
  var tc=document.getElementById('tdTypeCancel'); if(tc) tc.onclick=function(){ S.td.edit=null; if(tb) tb.blur(); tdRefresh_(); };
  var more=document.getElementById('tdMore'); if(more) more.onclick=function(){ gpTap(); S.td.more=!S.td.more; tdRefresh_(); };
  box.querySelectorAll('[data-tdalso]').forEach(function(inp){ inp.onchange=function(){
    var raw=String(inp.value).trim(); if(raw!=='' && !isFinite(Number(raw))) return;
    tdSet_(sel, inp.getAttribute('data-tdalso'), raw==='' ? null : Number(raw)); }; });
  var sg=document.getElementById('tdSetGoals'); if(sg) sg.onclick=function(){ gpTap(); S.mmTab='numbers'; S.mmTabTouched=true; mmTabKeep_('numbers'); S.sbd={ key:rkKey_(S.me.campus, sel.dept, sel.min), vals:{} }; render(); window.scrollTo(0,0); };
  var wt=document.getElementById('tdWinText'); if(wt){ wt.oninput=function(){ S.td.winDraft=wt.value; }; wt.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); tdWinSave_(sel); } }; }
  var ws=document.getElementById('tdWinSave'); if(ws) ws.onclick=function(){ gpTap(); tdWinSave_(sel); };
  var wa=document.getElementById('tdWinsAll'); if(wa) wa.onclick=function(){ S.td.winsAll=!S.td.winsAll; tdRefresh_(); };
  box.querySelectorAll('[data-tdwindel]').forEach(function(b){ b.onclick=function(){
    if(!gpAsk_(t('Take this win off?'))) return;
    run('deleteMinistryWin', [S.auth.user, S.auth.pin, sel.dept, sel.min, b.getAttribute('data-tdwindel')], function(d){
      if(d && d.ok){ var dd=tdData_(sel); if(dd) dd.wins=d.wins||[]; tdRefresh_(); } else showMsg(t('Could not save')); }); }; });
  var wo=document.getElementById('tdWrapOpen'); if(wo) wo.onclick=function(){ gpTap(); S.td.wrapOpen=true; tdRefresh_(); };
  var wc=document.getElementById('tdWrapClose'); if(wc) wc.onclick=function(){ S.td.wrapOpen=false; tdRefresh_(); };
  var wrap=document.getElementById('tdWrap');
  if(wrap) wrap.querySelectorAll('[data-tdweek]').forEach(function(inp){ inp.oninput=function(){ var k=wrap.getAttribute('data-tdwrapkey'); (S.td.wrapDraft[k] || (S.td.wrapDraft[k]={}))[inp.getAttribute('data-tdweek')]=inp.value; }; });
  var wsv=document.getElementById('tdWrapSave'); if(wsv) wsv.onclick=function(){ gpTap(); tdWrapSave_(sel); };
  var wd=document.getElementById('tdWrapDone');
  if(wd && wd.getAttribute('data-tdfresh')==='1'){ S.td.wrapDone=''; wd.setAttribute('data-tdfresh',''); setTimeout(function(){ gpConfetti(wd); }, 80); }   // the week just wrapped: once
  if(data) tdBadgeWatch_(sel, tdBadges_(sel, data));
  if(tdPendCount_() && !S.td.flying && !S.td.timer) tdSoon_(gpOnline_() ? 300 : 60);
}

/* ---------- the quarter's story: this quarter's wins, to tap into Highlights (read only) ---------- */
function tdReportWinsHtml_(campus, key, year, q){
  if(!S.me || campus!==S.me.campus) return '';
  var i=String(key||'').indexOf('|'); if(i<1) return '';
  var data=tdData_({ dept:key.slice(0, i), min:key.slice(i+1) }), wins=(data && data.wins) || [];
  var from=weekBounds_((Number(q)-1)*13+1, year).from, to=weekBounds_(Math.min(52, Number(q)*13), year).to;
  wins=wins.filter(function(w){ return w.date>=from && w.date<=to; });
  if(!wins.length) return '';
  return '<div class="tdQrWins noPrint" id="tdQrWins"><div class="hint">🌟 '+esc(t('This quarter’s wins — tap one to add it to Highlights'))+'</div>'+
    wins.slice(0, 20).map(function(w){ return '<button type="button" class="tdQrWin" data-qrwin="'+esc(w.text)+'">'+esc(w.text)+'</button>'; }).join('')+'</div>';
}
