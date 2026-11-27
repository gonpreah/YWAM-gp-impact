/* ==================== My Ministry → Today (Nov 2026, Uriah) ====================
   "My ministry page could have a fun and simple way to use it daily … each one can see their ministry as a fun game
   they're doing each day, while also getting all the data needed for our board, donors and the government. And when
   they go to My Ministry they wouldn't be overwhelmed either."

   Every ministry's page opens on ONE screen, under a minute a day:
     1. tap counters — a big tile per daily count (tap +1, − undoes, ✎ or a long press types today's number);
     2. this week's ring — goals on target (the Scorecard's own goals and maths), or days logged this week;
     3. the team streak — days in a row anyone logged anything, Sundays and national holidays skipped;
     4. win of the day — one line of something good that happened (kept 60 days, offered to the quarter's story);
     5. the Friday wrap — the weekly numbers, carried forward as the weekly form does, then "Week n complete";
     6. badges — the ministry's, worked out here from what is already stored.

   The rule of the game (Uriah): rewards are for SHOWING UP and logging honestly — never for the size of a number —
   and salvations, baptisms, healings and every other faith number (GP_FAITH_RE, taxonomy.js) are counted in a plain
   row and are never part of it: no tile, no ring, no celebration, no badge.

   Saving a count: the DAY's own value, absolute, through the existing daily path (saveMyKpiDay / saveKpiDayFor) about
   0.8 s after the last tap — so three quick taps are one save of "3", and sending it twice changes nothing. What has
   not reached the server yet is kept on the phone (gp-td-pending, by user + ministry + date + metric, the last value
   wins) and sent when the connection is back. A tap paints its own tile; it never redraws the page. */
var TD_TILES=4, TD_SAVE_MS=800, TD_HOLD_MS=500, TD_PENDING='gp-td-pending', TD_BADGES='gp-td-badges', TD_WINS_SHOWN=3;
S.td={ more:false, edit:null, winDraft:'', winsAll:false, wrapOpen:false, wrapDraft:{}, wrapDone:'', flying:false, note:'', timer:null, winBusy:false };

function tdIsFaith_(m){ return typeof GP_FAITH_RE!=='undefined' && GP_FAITH_RE.test(m); }
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

/* ---------- which numbers go where ---------- */
function tdMetrics_(sel){
  var c=S.me.campus, auto=autoMetricsFor(c, sel.dept, sel.min);
  var all=metricsFor(c, sel.dept, sel.min).filter(function(m){ return auto.indexOf(m)===-1; });
  var weekly=all.filter(function(m){ return cadenceOf(c, sel.dept, sel.min, m)==='week'; });
  var counts=weekly.filter(function(m){ return modeOf(m)==='sum' && WEEKLY_ONLY_METRICS.indexOf(m)===-1; });
  var goals=sbdGoals_(c, sel.dept, sel.min);
  var taps=counts.filter(function(m){ return !tdIsFaith_(m); });
  taps=taps.filter(function(m){ return goals[m]; }).concat(taps.filter(function(m){ return !goals[m]; }));   // the leader's goals first
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
    return '<div class="tdTile editing" data-tdtile="'+esc(m)+'"><div class="tdName">'+esc(t(m))+'</div>'+
      '<label class="tdTypeLbl" for="tdTypeBox">'+esc(t('Today’s number'))+'</label>'+
      '<div class="tdTypeRow"><input type="number" inputmode="decimal" id="tdTypeBox" class="tdType" value="'+esc(String(x.has ? x.today : ''))+'"><button type="button" class="btn small" id="tdTypeOk" data-tdtypeok="'+esc(m)+'">'+esc(t('OK'))+'</button></div>'+
      '<button type="button" class="linkbtn inline" id="tdTypeCancel">'+esc(t('Cancel'))+'</button></div>';
  }
  var body='<span class="tdNum">'+fmt(x.today, m)+'</span><span class="tdName">'+esc(t(m))+'</span><span class="tdWk">'+wkLine+'</span>';
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
function tdRingHtml_(sel, data, M, can){
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
  var p=n ? Math.round(d/n*100) : 0;
  return '<div class="tdRing" id="tdRing"><div class="gRing lg" style="'+gpRingVars(p)+'" role="img" aria-label="'+esc(line)+'"><span>'+d+'/'+n+'</span></div>'+
    '<div class="tdRingText"><b id="tdRingLine">'+esc(line)+'</b>'+(sub ? '<span class="hint">'+esc(sub)+'</span>' : '')+
    (!withGoal.length && can && canEditMetricsClient_(c, sel.dept, sel.min) && M.taps.concat(M.levels).length ? '<button type="button" class="linkbtn inline" id="tdSetGoals">🎯 '+esc(t('Set this week’s goals'))+'</button>' : '')+'</div></div>';
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
  var wins=(data && data.wins) || [], list=S.td.winsAll ? wins : wins.slice(0, TD_WINS_SHOWN);
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

/* ---------- the Today tab ---------- */
function tdLoadingHtml_(sel){
  if(S.ovError && S.ovError[sel.min]) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(gpT('Couldn’t load {ministry}’s numbers.',{ministry:t(sel.min)}))+'</p>'+
    '<p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.ovError[sel.min])+'</p><button class="btn ghost" id="ovRetry" data-ministry="'+esc(sel.min)+'" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
}
function tdInnerHtml_(sel){
  var data=tdData_(sel), can=tdCanLog_(sel), M=tdMetrics_(sel);
  var h='';   // no heading: the tab already says Today, and the counters should need no scrolling
  if(!can) h+='<p class="hint" id="tdReadOnly">👀 '+esc(t('You can look, but only this ministry’s own people enter its numbers.'))+'</p>';
  else if(!M.taps.length) h+='<p class="hint" id="tdCalm">'+esc(M.levels.length ? t('Nothing to count day by day here. Share a win when there is one, and wrap up the week on Friday.') : t('Nothing to count day by day here. Share a win when there is one.'))+'</p>';
  else h+='<p class="hint" id="tdHow">'+esc(t('Tap a tile each time it happens. − takes one off, ✎ types the number.'))+'</p>';
  h+=tdCountersHtml_(sel, data, M, can)+tdNoteHtml_()+tdWrapHtml_(sel, data, M, can)+
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
  var can=tdCanLog_(sel), M=tdMetrics_(sel);
  return '<div class="tdToday tdStrip" id="tdToday" data-tdstrip="1" data-tdkey="'+esc(tdKey_(sel))+'">'+
    '<div class="tdPair">'+tdStreakHtml_(sel, data)+tdRingHtml_(sel, data, M, false)+'</div>'+tdWinsHtml_(sel, data, can)+tdBadgesHtml_(sel, data)+'</div>';
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
  box.innerHTML=nb.innerHTML;
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
