/* My YWAM GP — teams.html, part 11 of 11: bind() — every screen's handlers — and starting the app.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ---------- bind ---------- */
/* Ministry dropdowns depend on the chosen department, so repopulate them in
   place rather than re-rendering the whole form and losing typed input. */
/* Campus Leadership picks a title, not a ministry (Uriah, Oct 2026): International or
   National Campus Director, or Director of one of the departments. The option's value
   is "<ministry>#<cdKind>" for a Campus Director (minSelValue_ splits it); a Campus
   Director with no kind yet keeps a plain "Campus Director" until they choose. */
function fillMinistrySelect(selId, campusSelId, deptSelId, current, curKind){
  var sel=document.getElementById(selId);
  if(!sel) return;
  var campus=(document.getElementById(campusSelId)||{}).value||(S.me?S.me.campus:'poipet');
  var dept=(document.getElementById(deptSelId)||{}).value||'';
  var list=ministriesFor(campus, dept);
  var keep=sel.value||current||'';
  if(dept===BL_DEPT){
    if(keep==='Campus Director' && curKind) keep='Campus Director#'+curKind;
    var opts=[['Campus Director#international', t('International Campus Director')], ['Campus Director#national', t('National Campus Director')]];
    if(keep==='Campus Director') opts.push(['Campus Director', t('Campus Director')]);
    list.forEach(function(m){ if(m!=='Campus Director') opts.push([m, orgTitleText_('Director of '+m)]); });
    sel.innerHTML='<option value="">'+esc(t('— choose your role —'))+'</option>'+opts.map(function(o){
      return '<option value="'+esc(o[0])+'"'+(keep===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';
    }).join('');
    return;
  }
  keep=keep.split('#')[0];
  sel.innerHTML='<option value="">— none yet —</option>'+list.map(function(m){
    return '<option value="'+esc(m)+'"'+(keep===m?' selected':'')+'>'+esc(t(m))+'</option>';
  }).join('');
}
/* A move into Campus Leadership waits for an admin (updateProfile keeps it as cltRequest). */
var CD_TITLE_={ international:'International Campus Director', national:'National Campus Director' };
function cltRequestTitle_(q){
  if(!q || !q.ministry) return t('Campus Leadership');
  if(q.ministry==='Campus Director') return t(CD_TITLE_[q.cdKind] || 'Campus Director');
  return orgTitleText_('Director of '+q.ministry);
}
function cltRequestBannerHtml_(){
  var q=S.profile && S.profile.cltRequest; if(!q) return '';
  return '<div class="banner" id="cltWaiting">⏳ '+esc(gpT('Your move to Campus Leadership, as {title}, is waiting for an admin to approve it.',{title:cltRequestTitle_(q)}))+
    ' <button class="linkbtn inline" id="cltCancel" style="width:auto;padding:0">'+esc(t('Cancel the request'))+'</button></div>';
}
function minSelValue_(id, deptId){
  var v=(document.getElementById(id)||{}).value||'', i=v.indexOf('#');
  var out={ ministry: i>-1 ? v.slice(0,i) : v };
  if(((document.getElementById(deptId)||{}).value||'')===BL_DEPT) out.cdKind = i>-1 ? v.slice(i+1) : '';
  return out;
}
/* this person's Campus Director kind, read off the title YWAM GP's org data gives them */
function myCdKind_(){
  var tl=S.me ? orgTitleOf_(S.me) : '';
  return tl==='International Campus Director' ? 'international' : tl==='National Campus Director' ? 'national' : '';
}
function bindMinistrySelects(){
  if(document.getElementById('r_ministry')){
    fillMinistrySelect('r_ministry','r_campus','r_dept',(S.regPrefill && S.regPrefill.ministry) || '');
    ['r_campus','r_dept'].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.onchange=function(){ fillMinistrySelect('r_ministry','r_campus','r_dept',''); };
    });
  }
  if(document.getElementById('p_ministry')){
    fillMinistrySelect('p_ministry','p_campus','p_dept', S.me?S.me.ministry:'', myCdKind_());
    ['p_campus','p_dept'].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.onchange=function(){
        var s=document.getElementById('p_ministry'); if(s) s.value='';
        fillMinistrySelect('p_ministry','p_campus','p_dept','');
      };
    });
  }
}

/* Persist the habit set (and Bible-plan position) without blocking the UI. */
/* The habit config the server has actually acknowledged.

   The grid is drawn from S.habits, and the picker used to write straight into
   it and render — so a save that never landed left the page showing a habit the
   server has never heard of. From there every daily save cleans the tap against
   the config the SERVER holds (cleanHabitMap_ in api.js) and answers with that
   same config, which the page then adopted over its own: the tile vanished from
   under the finger and the next press landed on whatever slid into its place.
   That is the "sometimes when I press a habit it selects another one" report. */
var _habitCfg = { inFlight:false, confirmed:null };

/* Every save answers with the person's habit config, and adopting it is right —
   the server is the truth. Except while a change of our own is still in flight,
   when its answer is simply older than what we asked for. */
function adoptHabits(list){
  if(!list || _habitCfg.inFlight) return;
  S.habits = list;
  _habitCfg.confirmed = list;
}

function revertHabitCfg(){
  if(_habitCfg.confirmed) S.habits = _habitCfg.confirmed;
  showMsg(t('Your habits didn’t save — check your connection and pick them again.'));
}

function pushHabits(){
  _habitCfg.inFlight = true;
  run('saveMyHabits',[S.auth.user,S.auth.pin,myHabits()],function(d){
    _habitCfg.inFlight = false;
    if(d && d.ok) adoptHabits(d.habits); else revertHabitCfg();
    render();
  }, function(){
    _habitCfg.inFlight = false;
    revertHabitCfg();
    render();
  });
}
/* Write today's habit ticks through the existing daily-log endpoint, merged
   with whatever else today already holds so the full check-in isn't clobbered.

   The tap has to read as instant — waiting on a round trip before the button
   fills in is exactly what "not smooth" looks like — so the local copy of
   today's log is updated and rendered right away, and the save happens
   underneath that. The server's own answer still wins once it lands, the
   same way the goal slider and KPI running totals already work. */
/*  ---------- habit tiles ----------
    A tile is a local toggle that happens to get saved. It must never wait for
    the network to show what you just did.

    It used to take S.busy — the page-wide lock — and hold it for the whole
    round trip, which produced both of the things the base reported: on a slow
    connection every tap after the first was dropped in complete silence (no
    toggle, no message, the button simply looked broken), and a request that
    never came back left the lock set, so every save button on the page was dead
    until somebody reloaded.

    So now: apply it locally, paint it, send in the background. Taps that arrive
    mid-send are not dropped — they accumulate and go out in one follow-up
    request, which also stops a burst of taps becoming a burst of Netlify
    invocations. If a send fails, the toggles the server never accepted are put
    back, because a tile that looks saved and is not is worse than one that
    never lit.  */
var _habitQ = { inFlight:false, pending:false, confirmed:null };

/* Write a habit map into today's log — creating the log if this is the first
   thing logged today — including the legacy columns, so streaks and the mentor
   view stay consistent with pre-habits history. */
function applyHabitsLocally(map){
  var today=todayStr();
  var log=logForDate(today);
  if(!log){
    log={date:today, week:thisWeek(), langHours:0, minHours:0,
      workout:false, bible:false, quietTime:false, oneOnOne:false, sharedFaith:false, sabbath:false,
      clarity:null, growth:null, lonely:null, porn:false, habits:{}};
    S.logs=[log].concat(S.logs);
  }
  log.habits=map;
  ['workout','bible','quietTime','oneOnOne','sharedFaith','sabbath'].forEach(function(k){
    if(map[k]!==undefined) log[k]=map[k];
  });
  return log;
}

function habitPayload(map){
  var log=logForDate(todayStr())||{};
  var payload={
    langHours:log.langHours||0, minHours:log.minHours||0,
    workout:log.workout, bible:log.bible, quietTime:log.quietTime,
    oneOnOne:log.oneOnOne, sharedFaith:log.sharedFaith, sabbath:log.sabbath,
    clarity:log.clarity, growth:log.growth, lonely:log.lonely, porn:log.porn,
    habits:map
  };
  ['workout','bible','quietTime','oneOnOne','sharedFaith','sabbath'].forEach(function(k){
    if(map[k]!==undefined) payload[k]=map[k];
  });
  return payload;
}

function toggleHabit(id){
  var map=todayHabitMap();
  /* Remember the last state the server agreed with, so a failure can be undone
     without having to work out which taps of a burst got through. Only taken
     when idle: mid-burst, the fallback point is whatever was last acknowledged. */
  if(!_habitQ.inFlight && !_habitQ.pending) _habitQ.confirmed=map;
  var next={};
  Object.keys(map).forEach(function(k){ next[k]=map[k]; });
  next[id]=!next[id];
  applyHabitsLocally(next);
  render();
  flushHabits();
}

function flushHabits(){
  if(_habitQ.inFlight){ _habitQ.pending=true; return; }
  _habitQ.inFlight=true;
  var sending=todayHabitMap();
  /* The day-details form writes the same daily row, and its payload carries this
     same habit map, so the two cannot disagree about habits even if they overlap.
     That is why this no longer needs the page-wide lock to stay correct. */
  run('saveDaily',[S.auth.user,S.auth.pin,todayStr(),habitPayload(sending)],function(d){
    _habitQ.inFlight=false;
    if(d && d.ok){
      /* An answer is a snapshot of the day at the moment the request was dealt
         with. The screen is the person's intent, right now. When the two
         disagree, intent wins — a tile must never untick itself because a reply
         arrived describing an older version of the day.

         So: take the answer's logs for everything else (hours, mood, the
         derived week), then put this device's habit map straight back on top —
         the map we sent, or a newer one if more taps have landed since. Both are
         read BEFORE S.logs is replaced, because both are read out of it.

         Without this, any disagreement at all reads as "the app undid my tap":
         a store that served a read older than its own write, another device, or
         the day-details form saving the same row from the other card. */
      var localNow = todayHabitMap();
      var keep = _habitQ.pending ? localNow : sending;
      S.logs=d.logs;
      adoptHabits(d.habits);
      if(d.week) upsertCheckin(d.week);
      applyHabitsLocally(keep);
      _habitQ.confirmed = _habitQ.pending ? sending : null;
    }
    if(_habitQ.pending){ _habitQ.pending=false; render(); flushHabits(); return; }
    render();
  }, function(){
    _habitQ.inFlight=false; _habitQ.pending=false;
    if(_habitQ.confirmed){ applyHabitsLocally(_habitQ.confirmed); _habitQ.confirmed=null; }
    showMsg(t('Not saved — check your connection and tap again.'));
    render();
  });
}
/* Keep the locally-held derived week row in step with what the server just
   recomputed, so the summary updates without another round trip. */
function upsertCheckin(week){
  if(!week) return;
  S.checkins=(S.checkins||[]).filter(function(c){ return Number(c.week)!==Number(week.week); });
  S.checkins.unshift(week);
}
function todayHabitMap(){
  var log=logForDate(todayStr());
  var map={};
  myHabits().forEach(function(hb){ map[hb.id]= !!(log && didHabit(log,hb.id)); });
  return map;
}

function bindAway(){
  var lb=document.getElementById('leaveBack');
  if(lb) lb.onclick=function(){ S.view='week'; render(); };
  var gl=document.getElementById('goLeaveFromMe');
  if(gl) gl.onclick=function(){ S.view='leave'; render(); };
  var mb=document.getElementById('ministryBack');
  if(mb) mb.onclick=function(){ S.view='week'; render(); };
  var db=document.getElementById('dashToBase'); if(db) db.onclick=function(){ gpTap(); S.view='base'; render(); window.scrollTo(0,0); };
  var gm=document.getElementById('goMinistryFromMe');
  if(gm) gm.onclick=function(){ gpTap(); S.view='ministry'; S.mmTab='ministry'; render(); };
  document.querySelectorAll('[data-gohealth]').forEach(function(b){ b.onclick=function(){ gpTap(); S.view='health'; render(); }; });
  var dth=document.getElementById('dashToHealth');
  if(dth) dth.onclick=function(){ gpTap(); S.view='health'; render(); };

  document.querySelectorAll('[data-mmtab]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.mmTab=b.getAttribute('data-mmtab'); render(); };
  });
  /* The metric form is folded away until asked for — the page opens on the
     dashboard and the week's status, and this one button is how you get to
     the boxes. Unfolding opens every section at once: two taps to reach a
     number was the "confusing" part. */
  var kib=document.getElementById('kpiInputBtn');
  if(kib && !kib.hasAttribute('data-ovinput')) kib.onclick=function(){
    gpTap();
    S.kpiInputOpen=!S.kpiInputOpen;
    if(S.kpiInputOpen){ S.dbAcc.kpiDay=true; S.dbAcc.kpiWeek=true; S.dbAcc.kpiMonth=true; S.dbAcc.kpiQuarter=true; }
    render();
  };
  document.querySelectorAll('[data-kpigoto]').forEach(function(b){
    b.onclick=function(){
      var w=Number(b.getAttribute('data-kpigoto'));
      gpTap(); S.kpiWeek = (w===thisWeek()) ? null : w;
      S.kpiDraft={}; S.kpiWeekDraft={}; S.personalDraft={}; render();
    };
  });
  var mda=document.getElementById('mmDashAll');
  if(mda) mda.onclick=function(){ S.mmDashAll=!S.mmDashAll; render(); };
  document.querySelectorAll('[data-mmperiod]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.mmPeriod=b.getAttribute('data-mmperiod'); render(); };
  });

  // --- Outreach Teams: one record per team, not a weekly form ---
  var tp=document.getElementById('teamsPage');
  if(tp){
    var tCampus=tp.getAttribute('data-campus');
    if(!S.teamTrips[tCampus] && !S.teamLoading[tCampus] && !S.teamError[tCampus]){
      S.teamLoading[tCampus]=true;
      run('getTeamTrips',[S.auth.user,S.auth.pin,tCampus],function(d){
        S.teamLoading[tCampus]=false;
        if(d && d.ok) S.teamTrips[tCampus] = { trips:d.trips||[], canEdit:!!d.canEdit };
        else S.teamError[tCampus] = (d && d.err) || t('The server answered without the teams.');
        render();
      }, function(e){ S.teamLoading[tCampus]=false; S.teamError[tCampus]=(e && e.message) || t('Connection problem — try again.'); render(); });
    }
    var tre=document.getElementById('teamRetry');
    if(tre) tre.onclick=function(){ S.teamError[tCampus]=''; render(); };
    var putTrips=function(d){ S.teamTrips[d.campus]={ trips:d.trips||[], canEdit:!!d.canEdit }; };
    var toForm=function(){ var el=document.getElementById('teamFormCard'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); };
    document.querySelectorAll('[data-teamperiod]').forEach(function(b){
      b.onclick=function(){ gpTap(); S.teamPeriod=b.getAttribute('data-teamperiod'); render(); };
    });
    document.querySelectorAll('[data-teamview]').forEach(function(b){
      b.onclick=function(){ gpTap(); S.teamView=b.getAttribute('data-teamview'); render(); };
    });
    var calShift=function(n){ var ym=S.teamCalYm||todayStr().slice(0,7), d=new Date(Number(ym.slice(0,4)), Number(ym.slice(5,7))-1+n, 1); S.teamCalYm=calIso_(d).slice(0,7); S.teamCalSel=null; render(); };
    var cpv=document.getElementById('calPrev'); if(cpv) cpv.onclick=function(){ gpTap(); calShift(-1); };
    var cnx=document.getElementById('calNext'); if(cnx) cnx.onclick=function(){ gpTap(); calShift(1); };
    var ctd=document.getElementById('calToday'); if(ctd) ctd.onclick=function(){ gpTap(); S.teamCalYm=null; S.teamCalSel=null; render(); };
    document.querySelectorAll('[data-calteam]').forEach(function(b){
      b.onclick=function(){ gpTap(); var id=b.getAttribute('data-calteam'); S.teamCalSel = S.teamCalSel===id ? null : id; render();
        var el=document.querySelector('[data-teamcard="'+id+'"]'); if(el) el.scrollIntoView({behavior:'smooth', block:'nearest'}); };
    });
    var tys=document.getElementById('teamYearSel');
    if(tys) tys.onchange=function(){ S.teamYear=Number(tys.value); render(); };
    var tms=document.getElementById('teamMonthSel');
    if(tms) tms.onchange=function(){ S.teamMonth=Number(tms.value); render(); };
    document.querySelectorAll('[data-teamq]').forEach(function(b){
      b.onclick=function(){ gpTap(); S.teamQ=Number(b.getAttribute('data-teamq')); render(); };
    });
    document.querySelectorAll('[data-teamym]').forEach(function(b){
      b.onclick=function(){ gpTap(); S.teamPeriod='month'; S.teamMonth=Number(b.getAttribute('data-teamym')); render(); };
    });
    document.querySelectorAll('[data-teamyq]').forEach(function(b){
      b.onclick=function(){ gpTap(); S.teamPeriod='quarter'; S.teamQ=Number(b.getAttribute('data-teamyq')); render(); };
    });
    var tab_=document.getElementById('teamAddBtn');
    if(tab_) tab_.onclick=function(){ gpTap(); S.teamForm=teamBlank_(tCampus); render(); toForm(); };
    document.querySelectorAll('[data-teamedit]').forEach(function(b){
      b.onclick=function(){
        var id=b.getAttribute('data-teamedit'), c=S.teamTrips[tCampus];
        var tr=c && c.trips.filter(function(x){ return x.id===id; })[0];
        if(!tr) return;
        S.teamForm=JSON.parse(JSON.stringify(tr));
        S.teamForm.metrics=S.teamForm.metrics||{}; S.teamForm.reached=S.teamForm.reached||{ male:'', female:'' };
        render(); toForm();
      };
    });
    document.querySelectorAll('[data-tf]').forEach(function(inp){
      var f=function(){ if(S.teamForm) S.teamForm[inp.getAttribute('data-tf')]=inp.value; };
      inp.oninput=f; inp.onchange=f;
    });
    document.querySelectorAll('[data-tfm]').forEach(function(inp){
      inp.oninput=function(){ if(S.teamForm) S.teamForm.metrics[inp.getAttribute('data-tfm')]=inp.value; };
    });
    document.querySelectorAll('[data-tfr]').forEach(function(inp){
      inp.oninput=function(){ if(S.teamForm) S.teamForm.reached[inp.getAttribute('data-tfr')]=inp.value; };
    });
    var tcb=document.getElementById('teamCancelBtn');
    if(tcb) tcb.onclick=function(){ S.teamForm=null; render(); };
    var tsb=document.getElementById('teamSaveBtn');
    if(tsb) tsb.onclick=function(){
      if(S.busy || !S.teamForm) return;
      var f=S.teamForm;
      if(!(f.name||'').trim()){ showMsg(t('Give the team a name first.')); return; }
      if(!f.from || !f.to){ showMsg(t('Enter the dates they arrived and left.')); return; }
      if(f.to<f.from){ showMsg(t('The leaving date is before the arrival date.')); return; }
      var num=function(v){ return (v==='' || v==null) ? null : Number(v); };
      var doc={ id:f.id||'', campus:tCampus, name:f.name.trim(), org:f.org, country:f.country, from:f.from, to:f.to,
        size:num(f.size), males:num(f.males), females:num(f.females), couples:num(f.couples), families:num(f.families),
        staff:f.staff, focus:f.focus, status:f.status, notes:f.notes, metrics:{}, reached:{ male:num(f.reached.male), female:num(f.reached.female) } };
      Object.keys(f.metrics).forEach(function(m){ var v=num(f.metrics[m]); if(v!==null) doc.metrics[m]=v; });
      S.busy=true; tsb.disabled=true; tsb.textContent=t('Saving…');
      run('saveTeamTrip',[S.auth.user,S.auth.pin,doc],function(d){
        S.busy=false;
        if(d && d.ok){ putTrips(d); S.teamForm=null; showMsg(t('Team saved')); }
        else showMsg(d && d.err==='not_authorized' ? t('Only Outreach Teams staff or leadership can do that.') : t('Could not save'));
        render();
      });
    };
    var tdb=document.getElementById('teamDeleteBtn');
    if(tdb) tdb.onclick=function(){
      if(S.busy || !S.teamForm || !S.teamForm.id) return;
      if(!confirm(gpT('Delete “{team}”? Its numbers come out of the dashboards too.',{team:S.teamForm.name}))) return;
      S.busy=true;
      run('deleteTeamTrip',[S.auth.user,S.auth.pin,S.teamForm.id],function(d){
        S.busy=false;
        if(d && d.ok){ putTrips(d); S.teamForm=null; showMsg(t('Team deleted')); }
        else showMsg(t('Could not save'));
        render();
      });
    };
  }

  // --- my own four numbers: drafted in state like every other box here ---
  document.querySelectorAll('[data-personal]').forEach(function(inp){
    inp.oninput=function(){ S.personalDraft[inp.getAttribute('data-personal')]=inp.value; };
  });
  var spb=document.getElementById('savePersonalBtn');
  if(spb) spb.onclick=function(){
    if(S.busy) return;
    var wk=kpiViewWeek(), updates=[];
    document.querySelectorAll('[data-personal]').forEach(function(inp){
      updates.push({ metric:inp.getAttribute('data-personal'), value: inp.value==='' ? null : Number(inp.value) });
    });
    S.busy=true; spb.disabled=true; spb.textContent=t('Saving…');
    run('saveMyPersonalWeek',[S.auth.user,S.auth.pin,wk,updates],function(d){
      S.busy=false;
      if(d && d.ok){ S.personal=d; S.personalDraft={}; showMsg(gpT('Saved — week {wk} updated',{wk:wk})); }
      else showMsg(t('Could not save'));
      render();
    });
  };

  // --- renaming a metric this ministry added itself ---
  document.querySelectorAll('[data-metricrename]').forEach(function(b){
    b.onclick=function(){ S.metricRename=b.getAttribute('data-metricrename'); S.metricRenameText=S.metricRename; render(); };
  });
  document.querySelectorAll('[data-metricrenamecancel]').forEach(function(b){
    b.onclick=function(){ S.metricRename=null; S.metricRenameText=''; render(); };
  });
  var mri=document.getElementById('metricRenameInput');
  if(mri) mri.oninput=function(){ S.metricRenameText=mri.value; };
  document.querySelectorAll('[data-metricrenamesave]').forEach(function(b){
    b.onclick=function(){ metricRenameSave_(S.metricEditTarget, b.getAttribute('data-metricrenamesave')); };
  });

  document.querySelectorAll('[data-metricoff]').forEach(function(b){
    b.onclick=function(){ metricEditToggle_(S.metricEditTarget, b.getAttribute('data-metricoff'), true); };
  });
  document.querySelectorAll('[data-metricon]').forEach(function(b){
    b.onclick=function(){ metricEditToggle_(S.metricEditTarget, b.getAttribute('data-metricon'), false); };
  });
  document.querySelectorAll('[data-metriccadence]').forEach(function(sel){
    sel.onchange=function(){ metricCadenceSet_(S.metricEditTarget, sel.getAttribute('data-metriccadence'), sel.value); };
  });
  var mnn=document.getElementById('metricNewName');
  if(mnn) mnn.oninput=function(){ S.metricNewName=mnn.value; };
  var mnt=document.getElementById('metricNewType');
  if(mnt) mnt.onchange=function(){ S.metricNewType=mnt.value; };
  var man=document.getElementById('metricAddBtn');
  if(man) man.onclick=function(){ metricEditAdd_(S.metricEditTarget); };

  // Ministries an overseer logs for load lazily, one request each, the first
  // time this page is open — cached in S.oversee after that until logout.
  if(S.view==='ministry'){
    // The picked ministry, if it isn't your own, loads lazily the first time
    // it's picked — cached in S.oversee by ministry name until logout.
    var bDept=S.mmBrowseDept, bMin=S.mmBrowseMinistry;
    if(bDept && bMin && !(bDept===S.me.dept && bMin===S.me.ministry) && !isTeamsMinistry_(bDept,bMin) &&
       !S.oversee[bMin] && !S.ovLoading[bMin] && !S.ovError[bMin]){
      S.ovLoading[bMin]=true; S.ovError[bMin]='';
      run('getMinistryFor',[S.auth.user,S.auth.pin,bDept,bMin],function(d){
        S.ovLoading[bMin]=false;
        if(d && d.ok) S.oversee[bMin]=d;
        else S.ovError[bMin] = d && d.err==='not_authorized' ? t('You can’t log for this ministry.') : (d && d.err) || t('The server answered without the numbers.');
        render();
      }, function(e){
        // a crash or a timeout is not "Loading…" for ever: say so, offer Retry
        S.ovLoading[bMin]=false; S.ovError[bMin]=(e && e.message) || t('Connection problem — try again.'); render();
      });
    }
    var ovr=document.getElementById('ovRetry');
    if(ovr) ovr.onclick=function(){ var m=ovr.getAttribute('data-ministry'); S.ovError[m]=''; S.ovLoading[m]=false; render(); };
    document.querySelectorAll('[data-mmpick]').forEach(function(b){
      b.onclick=function(){ var v=b.getAttribute('data-mmpick'), i=v.lastIndexOf('|'); gpTap(); S.mmBrowseDept=v.slice(0,i); S.mmBrowseMinistry=v.slice(i+1); render(); };
    });
    var mbd=document.getElementById('mmBrowseDeptSel');
    if(mbd) mbd.onchange=function(){ S.mmBrowseDept=mbd.value; S.mmBrowseMinistry=''; render(); };
    var mbm=document.getElementById('mmBrowseMinSel');
    if(mbm) mbm.onchange=function(){ S.mmBrowseMinistry=mbm.value; render(); };
    // another ministry's week strip and input button (your own use ids above)
    document.querySelectorAll('[data-ovgoto]').forEach(function(b){
      b.onclick=function(){
        var v=b.getAttribute('data-ovgoto'), i=v.lastIndexOf('|'), min=v.slice(0,i), w=Number(v.slice(i+1));
        gpTap(); S.ovWeek[min] = (w===thisWeek()) ? null : w; S.ovWeekDraft[min]={}; render();
      };
    });
    var ovi=document.querySelector('[data-ovinput]');
    if(ovi) ovi.onclick=function(){ var min=ovi.getAttribute('data-ovinput'); gpTap(); S.ovInputOpen[min]=!S.ovInputOpen[min]; render(); };
    var gtd=document.getElementById('goTeamsDb');
    if(gtd) gtd.onclick=function(){ gpTap(); S.view='teamsdb'; render(); };
    var gse=document.getElementById('goSchedEdit');
    if(gse) gse.onclick=function(){ gpTap(); schedOpen_(gse.getAttribute('data-schedkind-edit'), true, 'ministry'); };
    var gho=document.getElementById('goHosp');
    if(gho) gho.onclick=function(){ gpTap(); S.view='hosp'; render(); };
  }
  var tdbk=document.getElementById('teamsDbBack');
  if(tdbk) tdbk.onclick=function(){ S.view='ministry'; render(); };
  document.querySelectorAll('#main [data-gohr]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.view='hr'; S.hrSub='home'; render(); };
  });
  bindHr();
  if(S.view==='library') bindLibrary_();
  if(S.view==='ministry'){ bindLw_(); bindCafe_(); bindLeadTools_(); bindFinance_(); }
  if(S.view==='required') bindReqSign_();
  if(S.guest) bindGuest_();
  if(S.view==='mycontract') bindMyContract_();
  bindReqRows_();
  ['libHomeTile','personBooks','profBooks'].forEach(function(id){ var b=document.getElementById(id); if(b) b.onclick=function(){ gpTap(); libOpen_(); }; });
  var pmc=document.getElementById('profMyContract'); if(pmc) pmc.onclick=function(){ gpTap(); openMyContract_(); };
  if(S.view==='admin' && (S.adminSub==='groups' || S.adminSub==='leaving')) bindAdminGroups_();
  if(S.view==='admin' && S.adminSub==='board') bindAdminBoard_();
  if(S.view==='admin' && S.adminSub==='reminders') bindAdminReminders_();
  if(S.view==='profile') bindReminders_();
  bindOrg_();
  bindKmReview_();
  bindBoardReport_();
  bindF30_();
  bindSupport_();
  bindPrayer_();
  bindP360_();
  bindHosp();
  if(S.view==='ministry') bindLead_();
  if(typeof dutyHtml==='function') bindSched_();

  if(!S.leaveDraft) S.leaveDraft={from:'',to:'',type:'',reason:'',coverage:'',ack:false};
  ['lv_from','lv_to'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.onchange=function(){ S.leaveDraft[id==='lv_from'?'from':'to']=el.value; render(); };
  });
  var lr=document.getElementById('lv_reason');
  if(lr) lr.oninput=function(){ S.leaveDraft.reason=lr.value; };
  var lc=document.getElementById('lv_coverage');
  if(lc) lc.oninput=function(){ S.leaveDraft.coverage=lc.value; };
  document.querySelectorAll('[data-leavetype]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.leaveDraft.type=b.getAttribute('data-leavetype'); render(); };
  });
  var la=document.getElementById('lv_ack');
  if(la) la.onclick=function(){ S.leaveDraft.ack=!S.leaveDraft.ack; render(); };

  var sl=document.getElementById('saveLeave');
  if(sl) sl.onclick=function(){
    if(S.busy) return;
    var f=S.leaveDraft||{};
    if(!f.from || !f.to){ showMsg(t('Pick both dates')); return; }
    if(f.to<f.from){ showMsg(t('The last day can’t be before the first')); return; }
    if(!f.type){ showMsg(t('Pick a leave type')); return; }
    if(!f.ack){ showMsg(t('Please confirm you understand the allowance.')); return; }
    S.busy=true; sl.disabled=true; sl.textContent='…';
    run('saveTrip',[S.auth.user,S.auth.pin,{from:f.from,to:f.to,type:f.type,reason:f.reason,coverage:f.coverage}],function(d){
      S.busy=false;
      if(d && d.ok){
        S.trips=d; S.leaveDraft={from:'',to:'',type:'',reason:'',coverage:'',ack:false};
        showMsg(d.hasMentor ? t('Sent to your mentor') : t('Saved'));
      } else showMsg(t('Could not save'));
      render();
    });
  };

  // mentor decisions on someone's leave request
  [['trok',true],['trno',false]].forEach(function(pair){
    document.querySelectorAll('[data-'+pair[0]+']').forEach(function(b){
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

function bindHome(){
  var gp=document.getElementById('goProfile');
  if(gp) gp.onclick=function(){ S.view='profile'; render(); };
  var jg=document.getElementById('jumpGoals');
  if(jg) jg.onclick=function(){ S.view='week'; render(); };

  /* Quick-jump bar: scroll to a section already on this tab, or navigate
     straight to the screen for the one that lives elsewhere (Account). */
  document.querySelectorAll('[data-jump]').forEach(function(b){
    b.onclick=function(){
      var el=document.getElementById(b.getAttribute('data-jump'));
      if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    };
  });

  /* Personal dashboard customize panel, hidden behind the gear icon. The
     color wheel saves on change (one control, no separate Save button);
     the background photo goes through the same resize-then-upload path
     as the profile photo. */
  var dcb=document.getElementById('dashCustomizeBtn');
  if(dcb) dcb.onclick=function(){ gpTap(); S.dbCustomize=!S.dbCustomize; render();
    var pn=document.getElementById('dashCustom'); if(pn && pn.scrollIntoView) pn.scrollIntoView({ block:'nearest', behavior:'smooth' }); };
  var dcd=document.getElementById('dashCustomDone'); if(dcd) dcd.onclick=function(){ gpTap(); S.dbCustomize=false; render(); };
  var dci=document.getElementById('dashColorInput');
  if(dci) dci.onchange=function(){
    var c=dci.value;
    S.profile=S.profile||{}; S.profile.dashboardColor=c; render();
    run('updateProfile',[S.auth.user,S.auth.pin,{dashboardColor:c}],function(d){
      if(d.ok){ S.me=d.staff; S.profile=d.profile; render(); }
    });
  };
  var dcr=document.getElementById('dashColorReset');
  if(dcr) dcr.onclick=function(){
    S.profile=S.profile||{}; S.profile.dashboardColor=''; render();
    run('updateProfile',[S.auth.user,S.auth.pin,{dashboardColor:''}],function(d){
      if(d.ok){ S.me=d.staff; S.profile=d.profile; render(); }
    });
  };
  var dbb=document.getElementById('dashBgBtn'), dbi=document.getElementById('dashBgInput');
  if(dbb&&dbi){ dbb.onclick=function(){ dbi.click(); }; dbi.onchange=function(){ if(dbi.files&&dbi.files[0]) handleDashboardBg(dbi.files[0]); }; }
  var dbc=document.getElementById('dashBgClearBtn');
  if(dbc) dbc.onclick=function(){
    run('clearDashboardBg',[S.auth.user,S.auth.pin],function(d){
      if(d.ok){ S.profile=S.profile||{}; S.profile.dashboardBg=''; render(); }
    });
  };

  /* Mentorship card's "open" arrow — same fetch the mentor screen's own
     mentee list uses, but from My Home this also has to switch to that
     screen to land on the detail view. */
  document.querySelectorAll('[data-openmentee]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-openmentee');
      run('getMenteeLogs',[S.auth.user,S.auth.pin,id],function(d){
        if(d.ok){
          S.view='mentor'; S.mentee=d.mentee; S.menteeWeek=null; S.menteeLogs=d.logs; S.menteeGoals=d.goals||[];
          S.menteeProfile=d.profile; S.menteeCheckins=d.checkins||[]; S.menteeSupport=d.support||null;
          S.menteeHabits=d.habits||[]; S.menteeMinistry=d.ministry||null; S.menteeTrips=d.trips||null; S.menteeSmart=d.smartGoals||[];
          render();
        }
        else showMsg('Not available');
      });
    };
  });

  // --- daily habits ---
  /* No S.busy gate here on purpose: toggleHabit() updates the local log and
     re-renders before its network call goes out, so tapping a second habit
     while the first save is still in flight feels just as instant instead of
     being silently swallowed until the first request returns. S.busy is for
     one-shot "Save" buttons elsewhere that must not double-submit — this
     tap-to-toggle grid isn't that, and flushHabits() handles the overlap. */
  document.querySelectorAll('[data-habit]').forEach(function(b){
    b.onclick=function(){
      gpTap();   // one definition, and it respects prefers-reduced-motion
      var id=b.getAttribute('data-habit');
      if(!b.classList.contains('on')) gpConfetti(b);   // ticking it, not unticking
      toggleHabit(id);
    };
  });
  var eh=document.getElementById('editHabits');
  if(eh) eh.onclick=function(){ S.habitEdit=true; S.habitNew=null; render(); };
  var hsr=document.getElementById('habitShowRest');
  if(hsr) hsr.onclick=function(){ S.habitShowRest=!S.habitShowRest; render(); };
  var hlm=document.getElementById('habitLoadMore');
  if(hlm) hlm.onclick=function(){ S.habitMore=!S.habitMore; render(); };
  var sh=document.getElementById('saveHabits');
  if(sh) sh.onclick=function(){ S.habitEdit=false; S.habitNew=null; pushHabits(); };
  document.querySelectorAll('[data-hpick]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-hpick');
      var list=myHabits().slice();
      var at=-1;
      list.forEach(function(hb,i){ if(hb.id===id) at=i; });
      if(at>-1){ if(list.length<=1){ showMsg(t('Keep at least one habit')); return; } list.splice(at,1); }
      else {
        if(list.length>=MAX_HABITS){ showMsg(t('That’s the max — drop one first')); return; }
        list.push({id:id, mentorVisible:true});
      }
      S.habits=list; render();
    };
  });
  /* when a habit is due: a preset, or the days picked one by one */
  document.querySelectorAll('[data-hpdays]').forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute('data-hpdays').split('|');
      var list=myHabits().map(function(hb){
        if(hb.id!==parts[0]) return hb;
        var o=Object.assign({}, hb);
        if(parts[1]==='daily') delete o.days;
        else if(parts[1]==='weekdays') o.days=[1,2,3,4,5];
        else o.days=(o.days && o.days.length && o.days.join()!=='1,2,3,4,5') ? o.days : [1,3,5];
        return o;
      });
      S.habits=list; render();
    };
  });
  document.querySelectorAll('[data-hpday]').forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute('data-hpday').split('|'), d=Number(parts[1]);
      var list=myHabits().map(function(hb){
        if(hb.id!==parts[0]) return hb;
        var o=Object.assign({}, hb), days=(o.days||[]).slice();
        if(days.indexOf(d)>-1){ if(days.length<=1){ showMsg(t('Keep at least one day')); return hb; } days.splice(days.indexOf(d),1); }
        else days.push(d);
        days.sort(function(a,b){ return a-b; });
        o.days=days;
        return o;
      });
      S.habits=list; render();
    };
  });
  var hni=document.getElementById('habitNewIcon'), hnl=document.getElementById('habitNewLabel');
  if(hni) hni.oninput=function(){ S.habitNew=S.habitNew||{icon:'',label:''}; S.habitNew.icon=hni.value; };
  if(hnl){
    hnl.oninput=function(){ S.habitNew=S.habitNew||{icon:'',label:''}; S.habitNew.label=hnl.value; };
    hnl.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var a=document.getElementById('habitNewAdd'); if(a) a.click(); } };
  }
  var hna=document.getElementById('habitNewAdd');
  if(hna) hna.onclick=function(){
    var label=(hnl?hnl.value:'').trim(), icon=(hni?hni.value:'').trim();
    if(!label){ showMsg(t('Give the habit a name first.')); if(hnl) hnl.focus(); return; }
    var list=myHabits().slice();
    if(list.length>=MAX_HABITS){ showMsg(t('That’s the max — drop one first')); return; }
    var id='c_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    list.push({ id:id, mentorVisible:true, label:label.slice(0,40), icon:(icon||'⭐').slice(0,8) });
    S.habits=list; S.habitNew=null; render();
  };
  // --- goals ---
  document.querySelectorAll('[data-goalswk]').forEach(function(b){
    b.onclick=function(){ gpTap(); var w=b.getAttribute('data-goalswk'); S.goalsWeek = w==='last' ? thisWeek()-1 : w==='next' ? thisWeek()+1 : null; S.goalEditIdx=null; render(); };
  });
  var gjc=document.getElementById('goalsJumpCurrent');
  if(gjc) gjc.onclick=function(){ gpTap(); S.goalsWeek=null; S.goalEditIdx=null; render(); };
  document.querySelectorAll('[data-theme-set]').forEach(function(b){
    b.onclick=function(){ gpTap(); applyTheme(b.getAttribute('data-theme-set')); render(); };
  });
  var pau=document.getElementById('p_adminunlock');
  if(pau) pau.onclick=function(){
    var code=(document.getElementById('p_admincode')||{}).value||'';
    if(!code){ showMsg('Enter the admin code'); return; }
    pau.disabled=true; pau.textContent='…';
    run('grantAdmin',[code, S.me.username, true],function(d){
      pau.disabled=false; pau.textContent=t('Unlock');
      if(d && d.ok){ S.me.isAdmin=true; showMsg('Admin access unlocked'); render(); }
      else showMsg('Wrong admin code');
    });
  };

  var agb=document.getElementById('addGoalBtn');
  if(agb) agb.onclick=function(){
    if(S.busy) return;
    var inp=document.getElementById('newGoalText');
    var text=(inp&&inp.value||'').trim();
    if(!text) return;
    var wk=goalsViewWeek();
    var rec=goalsForWeek(wk);
    var written=(rec&&rec.items)?rec.items.filter(function(i){return i.text;}).slice():[];
    if(written.length>=3) return;
    written.push({text:text, pct:0, metricKey:''});
    S.busy=true; agb.disabled=true;
    gpSaveGoals_(wk, written, function(){ S.busy=false; render(); });
  };
  document.querySelectorAll('[data-goalcomplete]').forEach(function(b){
    b.onclick=function(){
      if(S.busy) return;
      gpTap();
      var wk=goalsViewWeek();
      var rec=goalsForWeek(wk);
      if(!rec) return;
      var i=Number(b.getAttribute('data-goalcomplete'));
      var written=rec.items.filter(function(x){ return x.text; });
      if(!written[i]) return;
      written[i].pct=100;
      S.busy=true;
      gpSaveGoals_(wk, written, function(){ S.busy=false; render(); });
    };
  });
  document.querySelectorAll('[data-goalremove]').forEach(function(b){
    b.onclick=function(){
      if(S.busy) return;
      gpTap();
      var wk=goalsViewWeek();
      var rec=goalsForWeek(wk);
      if(!rec) return;
      var i=Number(b.getAttribute('data-goalremove'));
      var written=rec.items.filter(function(x){ return x.text; });
      if(!written[i]) return;
      written.splice(i,1);
      S.busy=true;
      gpSaveGoals_(wk, written, function(){ S.busy=false; render(); });
    };
  });
  /* Wording used to be fixed the moment it was typed — the only way to
     change it was delete-and-retype, which lost the progress and KPI link
     along with it. This edits the text in place, everything else on the
     goal untouched. */
  document.querySelectorAll('[data-goaledit]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.goalEditIdx=Number(b.getAttribute('data-goaledit')); render(); };
  });
  document.querySelectorAll('[data-goaleditcancel]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.goalEditIdx=null; render(); };
  });
  document.querySelectorAll('[data-goaleditsave]').forEach(function(b){
    b.onclick=function(){
      if(S.busy) return;
      var i=Number(b.getAttribute('data-goaleditsave'));
      var inp=document.getElementById('editGoalText');
      var text=(inp&&inp.value||'').trim();
      if(!text) return;
      var wk=goalsViewWeek();
      var rec=goalsForWeek(wk);
      if(!rec) return;
      var written=rec.items.filter(function(x){ return x.text; });
      if(!written[i]) return;
      written[i].text=text;
      S.busy=true;
      gpSaveGoals_(wk, written, function(){ S.busy=false; S.goalEditIdx=null; render(); });
    };
  });
  /* Dragging repaints the track and the label straight away — waiting on a
     round trip to see your own thumb move feels broken. The save fires once
     on release, and only render() after it lands, so a re-render never yanks
     the slider out from under a thumb that is still down. */
  document.querySelectorAll('[data-goalpct]').forEach(function(sl){
    var row=sl.closest('.wgRow');
    var ring=row&&row.querySelector('.gRing');
    var pctLabel=row&&row.querySelector('.wgPct');
    function paint(){
      var v=Number(sl.value)||0;
      sl.setAttribute('style', ringVars(v));
      if(ring){ ring.setAttribute('style', ringVars(v)); var sp=ring.querySelector('span'); if(sp) sp.textContent=v; }
      if(pctLabel){ pctLabel.style.color=pctColor(v); pctLabel.textContent=v+'% · '+pctWord(v); }
      if(row) row.classList.toggle('done', v>=100);
    }
    /* Same as the health sliders, and here it reached the server: scrolling the
       page with a finger that landed on this slider moved the percentage and
       saved it on release. */
    var guard = gpSlideGuard(sl, null, function(){ paint(); });
    sl.oninput=function(){ if(guard.scrolling()) return; paint(); gpTap(4); };
    sl.onchange=function(){
      if(guard.scrolling()) return;
      paint();
      var wk=goalsViewWeek();
      var rec=goalsForWeek(wk);
      if(!rec) return;
      var i=Number(sl.getAttribute('data-goalpct'));
      var written=rec.items.filter(function(x){ return x.text; });
      if(!written[i]) return;
      written[i].pct=Number(sl.value)||0;
      gpSaveGoals_(wk, written, function(){ render(); });
    };
  });
  document.querySelectorAll('[data-goallink]').forEach(function(sel){
    sel.onchange=function(){
      var wk=goalsViewWeek();
      var rec=goalsForWeek(wk);
      if(!rec) return;
      var i=Number(sel.getAttribute('data-goallink'));
      var written=rec.items.filter(function(x){ return x.text; });
      if(!written[i]) return;
      written[i].metricKey=sel.value;
      gpSaveGoals_(wk, written, function(){ render(); });
    };
  });

  // --- ministry KPIs ---
  document.querySelectorAll('[data-kpi]').forEach(function(inp){
    inp.oninput=function(){ S.kpiDraft[inp.getAttribute('data-kpi')]=inp.value; };
  });
  /* Held in state for the same reason as the daily boxes: a render triggered by
     anything else would otherwise throw away a number someone had just typed. */
  document.querySelectorAll('[data-kpiweek]').forEach(function(inp){
    inp.oninput=function(){ S.kpiWeekDraft[inp.getAttribute('data-kpiweek')]=inp.value; };
  });
  // "+5" on top of 286 reads as 291 before it is saved (shared with the dashboard).
  // Whole document, not just kpiDayCard — an oversight card's day inputs use
  // the same data-mode="sum" data-run pattern and need the same "+5 on top of
  // 286 reads as 291" running total before it saves.
  gpBindRunningTotals();
  // --- which KPIs show on the daily card ---
  var ksa=document.getElementById('kpiShowAll');
  if(ksa) ksa.onclick=function(){ S.kpiAll=true; render(); };
  var ksl=document.getElementById('kpiShowLess');
  if(ksl) ksl.onclick=function(){ S.kpiAll=false; render(); };
  var pk=document.getElementById('pickKpis');
  if(pk) pk.onclick=function(){ S.kpiPick=true; render(); };
  document.querySelectorAll('[data-kpipin]').forEach(function(b){
    b.onclick=function(){
      var m=b.getAttribute('data-kpipin');
      var pins=((S.ministry&&S.ministry.pins)||[]).slice();
      var at=pins.indexOf(m);
      if(at>-1) pins.splice(at,1);
      else {
        if(pins.length>=8){ showMsg('Eight is the max — unstar one first'); return; }
        pins.push(m);
      }
      S.ministry=Object.assign({}, S.ministry, {pins:pins});
      render();
    };
  });
  // --- ministry KPI week nav --- switching weeks drops any unsaved draft, so
  // a number typed for one week can't be mistakenly submitted under another.
  var kpw=document.getElementById('kpiPrevWeek');
  if(kpw) kpw.onclick=function(){ if(kpiViewWeek()<=1) return; gpTap(); S.kpiWeek=kpiViewWeek()-1; S.kpiDraft={}; S.kpiWeekDraft={}; S.personalDraft={}; render(); };
  var knw=document.getElementById('kpiNextWeek');
  if(knw) knw.onclick=function(){ if(kpiViewWeek()>=52) return; gpTap(); S.kpiWeek=kpiViewWeek()+1; S.kpiDraft={}; S.kpiWeekDraft={}; S.personalDraft={}; render(); };
  var kjc=document.getElementById('kpiJumpCurrent');
  if(kjc) kjc.onclick=function(){ gpTap(); S.kpiWeek=null; S.kpiDraft={}; S.kpiWeekDraft={}; S.personalDraft={}; render(); };
  var skp=document.getElementById('saveKpiPins');
  if(skp) skp.onclick=function(){
    if(S.busy) return;
    S.busy=true; skp.disabled=true; skp.textContent='…';
    run('saveMyKpiPins',[S.auth.user,S.auth.pin,(S.ministry&&S.ministry.pins)||[]],function(d){
      S.busy=false;
      if(d.ok){ S.ministry=d; S.kpiPick=false; S.kpiAll=false; showMsg('Saved'); }
      else showMsg('Could not save');
      render();
    });
  };

  var skb=document.getElementById('saveKpiBtn');
  if(skb) skb.onclick=function(){
    if(S.busy) return;
    var updates=[];
    document.querySelectorAll('[data-kpi]').forEach(function(inp){
      updates.push({
        metric:inp.getAttribute('data-kpi'),
        mode:inp.getAttribute('data-kpimode')||'sum',
        value: inp.value==='' ? null : Number(inp.value)
      });
    });
    var bad=kpiProblem_(updates, S.me.ministry); if(bad){ showMsg(bad); return; }
    S.busy=true; skb.disabled=true; skb.textContent='…';
    // Saves the DAY; the server rolls the week up from the days it holds.
    // Not the current week → the entry lands on that week's own last day.
    run('saveMyKpiDay',[S.auth.user,S.auth.pin,kpiEntryDate_(kpiViewWeek()),updates],function(d){
      S.busy=false;
      if(d.ok){ S.ministry=d; S.kpiDraft={}; numbersMarkLogged_(S.me.dept, S.me.ministry, kpiViewWeek()); showMsg('Saved — week total updated'); }
      else showMsg('Could not save');
      render();
    });
  };

  /* Levels and scores are the week's own figure, so they are written straight to
     the week — including the ones sitting there carried forward, which is how a
     headcount that did not change still ends up recorded for this week. */
  var skw=document.getElementById('saveKpiWeekBtn');
  if(skw) skw.onclick=function(){
    if(S.busy) return;
    var wk=kpiViewWeek(), updates=[];
    document.querySelectorAll('[data-kpiweek]').forEach(function(inp){
      updates.push({ metric:inp.getAttribute('data-kpiweek'),
        value: inp.value==='' ? null : Number(inp.value) });
    });
    var bad=kpiProblem_(updates, S.me.ministry); if(bad){ showMsg(bad); return; }
    S.busy=true; skw.disabled=true; skw.textContent=t('Saving…');
    gpSaveMinistry_({ fn:'saveMyMinistry', args:[S.auth.user,S.auth.pin,wk,updates], dept:S.me.dept, min:S.me.ministry, wk:wk, updates:updates,
      done:function(d, queued){
      S.busy=false;
      if(queued){ S.kpiWeekDraft={}; render(); return; }
      if(d && d.ok){ S.ministry=d; S.kpiWeekDraft={}; numbersMarkLogged_(S.me.dept, S.me.ministry, wk); showMsg(d.rejected&&d.rejected.length ? kpiProblem_(d.rejected.map(function(m){ return {metric:m, value:-1e9}; }), S.me.ministry) : 'Saved — week '+wk+' updated'); }
      else showMsg('Could not save');
      render();
    }});
  };

  /* Monthly/quarterly-cadence figures — one number for the period, written
     to that period's own anchor week (monthAnchorWeek_/quarterAnchorWeek_)
     rather than kpiViewWeek(), which the week-nav arrows above can move —
     these sections have no week-nav of their own on purpose (current period
     only, for now). */
  document.querySelectorAll('[data-kpimonth]').forEach(function(inp){
    inp.oninput=function(){ S.kpiMonthDraft[inp.getAttribute('data-kpimonth')]=inp.value; };
  });
  var skm=document.getElementById('saveKpiMonthBtn');
  if(skm) skm.onclick=function(){
    if(S.busy) return;
    var wk=monthAnchorWeek_(), updates=[];
    document.querySelectorAll('[data-kpimonth]').forEach(function(inp){
      updates.push({ metric:inp.getAttribute('data-kpimonth'),
        value: inp.value==='' ? null : Number(inp.value) });
    });
    var bad=kpiProblem_(updates, S.me.ministry); if(bad){ showMsg(bad); return; }
    S.busy=true; skm.disabled=true; skm.textContent=t('Saving…');
    gpSaveMinistry_({ fn:'saveMyMinistry', args:[S.auth.user,S.auth.pin,wk,updates], dept:S.me.dept, min:S.me.ministry, wk:wk, updates:updates,
      done:function(d, queued){
      S.busy=false;
      if(queued){ S.kpiMonthDraft={}; render(); return; }
      if(d && d.ok){ S.ministry=d; S.kpiMonthDraft={}; showMsg(t('Saved')); }
      else showMsg(t('Could not save'));
      render();
    }});
  };
  document.querySelectorAll('[data-kpiquarter]').forEach(function(inp){
    inp.oninput=function(){ S.kpiQuarterDraft[inp.getAttribute('data-kpiquarter')]=inp.value; };
  });
  var skq=document.getElementById('saveKpiQuarterBtn');
  if(skq) skq.onclick=function(){
    if(S.busy) return;
    var wk=quarterAnchorWeek_(), updates=[];
    document.querySelectorAll('[data-kpiquarter]').forEach(function(inp){
      updates.push({ metric:inp.getAttribute('data-kpiquarter'),
        value: inp.value==='' ? null : Number(inp.value) });
    });
    var bad=kpiProblem_(updates, S.me.ministry); if(bad){ showMsg(bad); return; }
    S.busy=true; skq.disabled=true; skq.textContent=t('Saving…');
    gpSaveMinistry_({ fn:'saveMyMinistry', args:[S.auth.user,S.auth.pin,wk,updates], dept:S.me.dept, min:S.me.ministry, wk:wk, updates:updates,
      done:function(d, queued){
      S.busy=false;
      if(queued){ S.kpiQuarterDraft={}; render(); return; }
      if(d && d.ok){ S.ministry=d; S.kpiQuarterDraft={}; showMsg(t('Saved')); }
      else showMsg(t('Could not save'));
      render();
    }});
  };

  // --- ministries you oversee: weekly only, keyed by ministry name so
  // several of these cards can sit on the page at once.
  document.querySelectorAll('[data-ovweek]').forEach(function(inp){
    var min=inp.getAttribute('data-ovweek'), metric=inp.getAttribute('data-ovmetric');
    inp.oninput=function(){ (S.ovWeekDraft[min]||(S.ovWeekDraft[min]={}))[metric]=inp.value; };
  });
  document.querySelectorAll('[data-ovprev]').forEach(function(btn){
    btn.onclick=function(){
      var min=btn.getAttribute('data-ovprev');
      if(ovWeekFor_(min)<=1) return;
      gpTap(); S.ovWeek[min]=ovWeekFor_(min)-1; S.ovWeekDraft[min]={}; render();
    };
  });
  document.querySelectorAll('[data-ovnext]').forEach(function(btn){
    btn.onclick=function(){
      var min=btn.getAttribute('data-ovnext');
      if(ovWeekFor_(min)>=52) return;
      gpTap(); S.ovWeek[min]=ovWeekFor_(min)+1; S.ovWeekDraft[min]={}; render();
    };
  });
  document.querySelectorAll('[data-ovjump]').forEach(function(btn){
    btn.onclick=function(){
      var min=btn.getAttribute('data-ovjump');
      gpTap(); S.ovWeek[min]=null; S.ovWeekDraft[min]={}; render();
    };
  });
  document.querySelectorAll('[data-ovsaveweek]').forEach(function(btn){
    btn.onclick=function(){
      if(S.busy) return;
      var min=btn.getAttribute('data-ovsaveweek'), dept=S.ovDeptOf[min]||myOversightDept_();
      if(!dept) return;
      var wk=ovWeekFor_(min), updates=[];
      document.querySelectorAll('[data-ovweek]').forEach(function(inp){
        if(inp.getAttribute('data-ovweek')!==min) return;
        updates.push({ metric:inp.getAttribute('data-ovmetric'),
          value: inp.value==='' ? null : Number(inp.value) });
      });
    var bad=kpiProblem_(updates, min); if(bad){ showMsg(bad); return; }
      S.busy=true; btn.disabled=true; btn.textContent=t('Saving…');
      gpSaveMinistry_({ fn:'saveMinistryFor', args:[S.auth.user,S.auth.pin,dept,min,wk,updates], dept:dept, min:min, wk:wk, updates:updates,
        done:function(d, queued){
        S.busy=false;
        if(queued){ S.ovWeekDraft[min]={}; render(); return; }
        if(d && d.ok){ S.oversee[min]=d; S.ovWeekDraft[min]={}; numbersMarkLogged_(dept, min, wk); showMsg(gpT('Saved — week {wk} updated',{wk:wk})); }
        else showMsg(t('Could not save'));
        render();
      }});
    };
  });
}

function bind(){
  /* a Leadership Development mentor answers a student */
  document.querySelectorAll('[data-stuaccept],[data-studecline]').forEach(function(b){ b.onclick=function(){
    var acc=b.hasAttribute('data-stuaccept'), id=b.getAttribute(acc?'data-stuaccept':'data-studecline'); b.disabled=true;
    run('respondStudentMentor',[S.auth.user,S.auth.pin,id,acc],function(d){ if(d && d.ok){ S.stuMentor={ requests:d.requests, students:d.students }; showMsg(acc?t('Accepted'):t('Declined')); } else showMsg(t('Could not save')); render(); });
  }; });
  /* 🎓 Students (staff): the students staying with us, their profiles and invite links */
  if(S.view==='students' || (S.view==='admin' && S.adminSub==='students')){
    if(S.view==='students' && !S.stuList && !S.stuListLoading){ S.stuListLoading=true; run('studentsList',[S.auth.user,S.auth.pin],function(d){ S.stuListLoading=false; S.stuList=d||{ ok:false }; render(); }); }
    document.querySelectorAll('[data-stumake]').forEach(function(b){ b.onclick=function(){
      b.disabled=true;
      run('studentMakeProfile',[S.auth.user,S.auth.pin,b.getAttribute('data-stumake'),(document.getElementById('stuSchool')||{}).value||'dts'],function(d){
        if(d && d.ok){ S.stuList=d; S.adminStu=null; showMsg(t('Profile made — send them the invite link')); } else showMsg(d && d.err==='exists' ? t('They have a profile already') : t('Could not save'));
        render();
      });
    }; });
    document.querySelectorAll('[data-stucopy]').forEach(function(b){ b.onclick=function(){
      var link=location.origin+'/portal.html?join='+b.getAttribute('data-stucopy'), nm=b.getAttribute('data-stuname')||'';
      var msg=gpT('Hi {name}! Here is your link to the YWAM GP portal and the GP app — open it and sign in with Google: {link}',{name:nm.split(' ')[0], link:link});
      if(navigator.share && b.getAttribute('data-stushare')){ navigator.share({ text:msg }).catch(function(){}); return; }
      try { navigator.clipboard.writeText(msg).then(function(){ showMsg(t('Invite copied — paste it in a message')); }, function(){ window.prompt(t('Copy this invite'), msg); }); } catch(e){ window.prompt(t('Copy this invite'), msg); }
    }; });
    var sbk=document.getElementById('stuBack'); if(sbk) sbk.onclick=function(){ S.view='week'; render(); window.scrollTo(0,0); };
  }
  /* an admin looking at a student's app: back to Admin, as yourself */
  var spx=document.getElementById('stuPreviewExit'); if(spx) spx.onclick=function(){ gpTap(); stuPreviewExit_(); };
  /* student mode: choosing a mentor */
  var smc=document.getElementById('stuMentorChange'); if(smc) smc.onclick=function(){ S.stuMentorPick=true; render(); };
  var smx=document.getElementById('stuMentorCancel'); if(smx) smx.onclick=function(){ S.stuMentorPick=false; render(); };
  var sma=document.getElementById('stuMentorAsk'); if(sma) sma.onclick=function(){
    var id=(document.getElementById('stuMentorSel')||{}).value||''; if(!id){ showMsg(t('Choose a mentor first')); return; }
    sma.disabled=true;
    run('studentSetMentor',[S.auth.user,S.auth.pin,id],function(d){
      if(d && d.ok){ S.me=d.staff; S.stuMentorPick=false; showMsg(t('Asked — they’ll see it in their Mentorship page')); }
      else showMsg(t('Could not save'));
      render();
    });
  };
  var lb=document.getElementById('langBtn');
  if(lb) lb.onclick=toggleLang;
  var menuBtn=document.getElementById('menuBtn');
  if(menuBtn) menuBtn.onclick=function(){ S.menuOpen=true; renderMenu(); };
  renderMenu();
  var bellBtn=document.getElementById('bellBtn');
  if(bellBtn) bellBtn.onclick=function(){ gpTap(); S.bellOpen=!S.bellOpen; renderNotifPanel(); };
  renderNotifPanel();

  document.querySelectorAll('[data-tab]').forEach(function(b){
    b.onclick=function(){ gpTap(); var v=b.getAttribute('data-tab');
      if(v==='ministry') S.mmTab='ministry';
      if(v==='library'){ if(S.view==='library'){ S.libBook=null; S.libStep=null; } libLoad_(); }
      S.view=v; S.mentee=null; S.person=null; render(); };
  });

  /* Every figure on Base opens its own breakdown, from the same sheet the
     dashboard uses. Only bound when the base's numbers are actually on screen. */
  if(S.base) gpBindDrill(baseR());
  if(S.base && S.me) gpBindStaffMix(baseR().staffBreakdown([S.me.campus]));
  gpAnimateCounts();
  celebrateStreak();
  var bds=document.getElementById('baseDeptSel');
  if(bds) bds.onchange=function(){ S.baseDept=bds.value; render(); };
  document.querySelectorAll('[data-acc]').forEach(function(btn){
    btn.onclick=function(){
      var id=btn.getAttribute('data-acc'), bucketName=btn.getAttribute('data-accbucket'), bucket=S[bucketName];
      var opening = !bucket[id];
      // Admin's account list only, not every accordion in the app — this is
      // what makes "which profile am I looking at" unambiguous there: at
      // most one row open at a time, instead of a tap here and a tap there
      // leaving three people's edit forms stacked on screen at once.
      if(bucketName==='adminAcc' && opening){
        Object.keys(bucket).forEach(function(k){ bucket[k]=false; });
      }
      bucket[id]=!bucket[id]; render();
    };
  });
  document.querySelectorAll('[data-baseHealthPeriod]').forEach(function(btn){
    btn.onclick=function(){ S.baseHealthPeriod=btn.getAttribute('data-baseHealthPeriod'); render(); };
  });
  // A different week means a different set of answers, same as switching a
  // Goals or Ministry week drops whatever was drafted for the last one.
  var hpw=document.getElementById('healthPrevWeek');
  if(hpw) hpw.onclick=function(){
    var wk=Number(S.healthWeek||thisWeek());
    if(wk<=1) return;
    gpTap(); S.healthWeek=wk-1; S.weekDraft=null; S.weekDraftFor=null; S.weekForm=null; render();
  };
  var hnw=document.getElementById('healthNextWeek');
  if(hnw) hnw.onclick=function(){
    var wk=Number(S.healthWeek||thisWeek());
    if(wk>=52) return;
    gpTap(); S.healthWeek=wk+1; S.weekDraft=null; S.weekDraftFor=null; S.weekForm=null; render();
  };
  var hjc=document.getElementById('healthJumpCurrent');
  if(hjc) hjc.onclick=function(){
    gpTap(); S.healthWeek=null; S.weekDraft=null; S.weekDraftFor=null; S.weekForm=null; render();
  };
  var glw=document.getElementById('goLastWeekHealth');
  if(glw) glw.onclick=function(){
    gpTap(); S.healthWeek=thisWeek()-1; S.weekDraft=null; S.weekDraftFor=null; S.weekForm=thisWeek()-1; render();
  };
  var hSc=document.getElementById('healthScopeSel');
  if(hSc) hSc.onchange=function(){ S.healthScope=hSc.value; render(); };
  var hMs=document.getElementById('healthMSel');
  if(hMs) hMs.onchange=function(){ S.healthMonth=Number(hMs.value); render(); };
  var hQs=document.getElementById('healthQSel');
  if(hQs) hQs.onchange=function(){ S.healthQuarter=Number(hQs.value); render(); };
  var hYs=document.getElementById('healthYSel');
  if(hYs) hYs.onchange=function(){
    var y=Number(hYs.value);
    ensureBaseYear(y, function(){ S.healthYear=y; render(); });
  };
  var srSc=document.getElementById('srScopeSel');
  if(srSc) srSc.onchange=function(){ S.srScope=srSc.value; S.srOpenQ=null; render(); };
  var srMs=document.getElementById('srMSel');
  if(srMs) srMs.onchange=function(){ S.srMonth=Number(srMs.value); S.srOpenQ=null; render(); };
  var srQs=document.getElementById('srQSel');
  if(srQs) srQs.onchange=function(){ S.srQuarter=Number(srQs.value); S.srOpenQ=null; render(); };
  document.querySelectorAll('[data-sropen]').forEach(function(btn){
    btn.onclick=function(){
      var id=btn.getAttribute('data-sropen');
      S.srOpenQ = (S.srOpenQ===id) ? null : id;
      gpTap();
      render();
    };
  });
  gpAnimateBars();
  gpAnimateLine();
  hxBind_();

  /* --- the weekly check-in form --- */
  document.querySelectorAll('[data-wslide]').forEach(function(sl){
    var block=sl.closest('.qBlock');
    var readout=block&&block.querySelector('.qReadout');
    var id=sl.getAttribute('data-wslide');
    var higherBetter=sl.getAttribute('data-higherbetter')==='1';
    function paint(){
      var v=Number(sl.value)||1;
      var pct=Math.round(((v-1)/9)*100);
      sl.style.setProperty('--fillpct', pct+'%');
      // Same colour walk as the goal slider — direction-aware, so a high
      // "how lonely" score still reads as a warning colour, not green.
      var goodPct = higherBetter ? pct : (100-pct);
      sl.style.setProperty('--gc', gpRingColor(goodPct));
      if(readout){ readout.textContent=v+'/10'; readout.style.color=gpPctColor(goodPct); }
      return v;
    }
    /* A swipe that starts on one of these is usually somebody scrolling past the
       question rather than answering it. If it turns out to be a scroll, the
       answer goes back exactly as it was — including back to unanswered, which
       is the whole point: an untouched slider reads 5 and must not count as a 5
       in the base average. */
    var guard = gpSlideGuard(sl, function(){
      var dr = weekDraftFor(S.healthWeek||thisWeek());
      return { had: dr[id]!==undefined, v: dr[id] };
    }, function(snap){
      var dr = weekDraftFor(S.healthWeek||thisWeek());
      if(snap.had) dr[id] = snap.v; else delete dr[id];
      paint();
    });
    sl.oninput=function(){
      if(guard.scrolling()) return;
      weekDraftFor(S.healthWeek||thisWeek())[id]=paint();
      gpTap(4);   // same per-tick buzz as the goal slider — a drag with no feedback at all reads as unresponsive
    };
  });
  document.querySelectorAll('[data-wyn]').forEach(function(b){
    b.onclick=function(){
      var p=b.getAttribute('data-wyn').split('|');
      weekDraftFor(S.healthWeek||thisWeek())[p[0]]=Number(p[1]);
      render();
    };
  });
  document.querySelectorAll('[data-wnum]').forEach(function(inp){
    inp.onchange=function(){
      var d=weekDraftFor(S.healthWeek||thisWeek());
      d[inp.getAttribute('data-wnum')] = inp.value===''?undefined:Number(inp.value);
    };
  });
  var wsb=document.getElementById('weekSubmit');
  if(wsb) wsb.onclick=function(){ weekSubmit(wsb); };
  var wed=document.getElementById('weekEdit');
  if(wed) wed.onclick=function(){
    var wk=Number(S.healthWeek||thisWeek());
    S.weekForm = (S.weekForm===wk) ? null : wk;
    render();
  };
  var wst=document.getElementById('weekStart');
  if(wst) wst.onclick=function(){ S.weekForm=Number(S.healthWeek||thisWeek()); render(); };
  var wcl=document.getElementById('weekClear');
  if(wcl) wcl.onclick=function(){
    if(!confirm(t('Clear this week’s check-in?'))) return;
    weekClear();
  };

  /* --- OKRs --- */
  var onb=document.getElementById('okrNewBtn');
  if(onb) onb.onclick=function(){ S.okrAdmin=null; S.okrForm=true; S.okrEditId=null; S.okrPaste=false; render(); };
  var ocb=document.getElementById('okrCancelBtn');
  if(ocb) ocb.onclick=function(){ S.okrForm=false; S.okrEditId=null; S.okrAdmin=null; render(); };
  var osb=document.getElementById('okrSaveBtn');
  if(osb) osb.onclick=function(){ okrSave(osb); };
  okrKrRows_().forEach(function(r){ okrBindKrRow_(r.getAttribute('data-okr-kr')); });
  document.querySelectorAll('#okrKrList .okrRow').forEach(okrBindRm_);
  var oka=document.getElementById('okrKrAddBtn');
  if(oka) oka.onclick=function(){ gpTap(); okrAddKr_(); };
  var okh=document.getElementById('okrHeadAddBtn');
  if(okh) okh.onclick=function(){ gpTap(); okrAddHead_(); };
  var opb=document.getElementById('okrPasteBtn');
  if(opb) opb.onclick=function(){ gpTap(); S.okrPaste=true; S.okrPasteParsed=null; render();
    var ta=document.getElementById('okrPasteText'); if(ta) ta.focus(); };
  var opp=document.getElementById('okrPastePreview');
  if(opp) opp.onclick=function(){
    S.okrPasteText = document.getElementById('okrPasteText').value;
    var parsed = okrParsePaste_(S.okrPasteText);
    if(!parsed.objectives.length){ showMsg(t('Nothing to add yet — paste your OKRs in the box.')); return; }
    S.okrPasteParsed = parsed; render();
  };
  var opk=document.getElementById('okrPasteBack');
  if(opk) opk.onclick=function(){ S.okrPasteParsed=null; render(); };
  var opc=document.getElementById('okrPasteCancel');
  if(opc) opc.onclick=function(){ S.okrPaste=false; S.okrPasteParsed=null; S.okrPasteText=''; render(); };
  var ops=document.getElementById('okrPasteSave');
  if(ops) ops.onclick=function(){ okrPasteSave_(ops); };
  document.querySelectorAll('[data-okr-edit]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-okr-edit'), o=okrFind_(id);
      // an admin editing from "Every department's OKRs" writes that objective's own campus / department
      S.okrAdmin = (o && S.me.isAdmin && b.closest('[data-okradmin]')) ? { campus:o.campus, dept:o.dept } : null;
      S.okrEditId=id; S.okrForm=true; S.okrPaste=false; render();
      var f=document.getElementById('okrForm'); if(f) f.scrollIntoView({behavior:'smooth', block:'start'});
    };
  });
  var oac=document.getElementById('okrAdmCampus');
  if(oac) oac.onchange=function(){ S.okrAdminPick={ campus:oac.value, dept:'' }; render(); };
  var oad=document.getElementById('okrAdmDept');
  if(oad) oad.onchange=function(){ S.okrAdminPick=Object.assign({}, S.okrAdminPick||{}, { dept:oad.value }); };
  var oan=document.getElementById('okrAdmNewBtn');
  if(oan) oan.onclick=function(){ var p=S.okrAdminPick||{}; if(!p.campus || !p.dept) return; S.okrAdmin={ campus:p.campus, dept:p.dept }; S.okrEditId=null; S.okrForm=true; render(); var f=document.getElementById('okrForm'); if(f) f.scrollIntoView({behavior:'smooth', block:'start'}); };
  document.querySelectorAll('[data-okr-del]').forEach(function(b){
    b.onclick=function(){
      if(!confirm(t('Delete this objective?'))) return;
      okrDelete(b.getAttribute('data-okr-del'));
    };
  });
  document.querySelectorAll('[data-okr-manual]').forEach(function(inp){
    var ref = inp.getAttribute('data-okr-manual');
    inp.oninput=function(){
      inp.style.setProperty('--p', inp.value+'%');
      var lbl=document.querySelector('[data-okr-pct="'+ref+'"]');
      if(lbl) lbl.textContent=(Number(inp.value)>=100?'✓ ':'')+inp.value+'%';
    };
    inp.onchange=function(){
      var parts=ref.split('|');
      okrSetManual(parts[0], Number(parts[1]), inp.value);
    };
  });
  document.querySelectorAll('[data-okr-step]').forEach(function(b){
    b.onclick=function(){
      gpTap();
      var parts=b.getAttribute('data-okr-step').split('|'), o=okrFind_(parts[0]), kr=o && o.krs[Number(parts[1])];
      if(kr) okrSetCount(parts[0], Number(parts[1]), (Number(kr.current)||0)+Number(parts[2]));
    };
  });
  document.querySelectorAll('[data-okr-count]').forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute('data-okr-count').split('|'), o=okrFind_(parts[0]), kr=o && o.krs[Number(parts[1])];
      if(!kr) return;
      var v = prompt(t('How many so far?'), String(Number(kr.current)||0));
      if(v===null || v.trim()==='' || isNaN(Number(v))) return;
      okrSetCount(parts[0], Number(parts[1]), Number(v));
    };
  });

  /* --- Goals & Tasks page --- */
  var ggm=document.getElementById('goGoalsFromMe');
  if(ggm) ggm.onclick=function(){ gpTap(); S.view='goals'; S.goalsTab='goals'; render(); };
  var gb=document.getElementById('goalsBack');
  if(gb) gb.onclick=function(){ S.view='week'; S.smartDraft=null; S.taskEdit=null; render(); };
  document.querySelectorAll('[data-gtab]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.goalsTab=b.getAttribute('data-gtab'); S.smartDraft=null; S.taskEdit=null; S.stepAdd=null; render(); };
  });
  var sht=document.getElementById('smartHelpToggle');
  if(sht) sht.onclick=function(){ gpTap(); S.smartHelpOpen=!S.smartHelpOpen; render(); };
  var spy=document.getElementById('smartPrevYear');
  if(spy) spy.onclick=function(){ S.smartYear=smartYear_()-1; S.smartDraft=null; S.stepAdd=null; render(); };
  var sny=document.getElementById('smartNextYear');
  if(sny) sny.onclick=function(){ S.smartYear=smartYear_()+1; S.smartDraft=null; S.stepAdd=null; render(); };
  document.querySelectorAll('[data-smartcat]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.smartCategory=b.getAttribute('data-smartcat'); S.smartDraft=null; S.stepAdd=null; render(); };
  });
  var snb=document.getElementById('smartNewBtn');
  if(snb) snb.onclick=function(){ S.smartDraft={ id:null, title:'', meta:'', pct:0, smart:{} }; S.stepAdd=null; render(); };
  document.querySelectorAll('[data-smartedit]').forEach(function(b){
    b.onclick=function(){
      var g=goalById_(b.getAttribute('data-smartedit'));
      if(g) S.smartDraft={ id:g.id, title:g.title, meta:g.meta, pct:g.pctManual!=null?g.pctManual:g.pct, smart:Object.assign({}, g.smart||{}) };
      S.stepAdd=null; render();
    };
  });
  var scb=document.getElementById('smartCancelBtn');
  if(scb) scb.onclick=function(){ S.smartDraft=null; render(); };
  var sgt=document.getElementById('sg_title');
  if(sgt) sgt.oninput=function(){ if(S.smartDraft) S.smartDraft.title=sgt.value; };
  var sgm=document.getElementById('sg_meta');
  if(sgm) sgm.oninput=function(){ if(S.smartDraft) S.smartDraft.meta=sgm.value; };
  var sgp=document.getElementById('sg_pct');
  if(sgp) sgp.oninput=function(){ if(S.smartDraft) S.smartDraft.pct=sgp.value; };
  ['s','m','a','r','t'].forEach(function(k){
    var el=document.getElementById('sg_'+k);
    if(el) el.oninput=function(){ if(S.smartDraft){ S.smartDraft.smart=S.smartDraft.smart||{}; S.smartDraft.smart[k]=el.value; } };
  });
  /* Every save sends the goal whole (steps included), so a tick and an edit
     can never half-overwrite each other. */
  function smartSend_(payload, after){
    if(S.busy) return;
    S.busy=true;
    run('saveSmartGoal',[S.auth.user,S.auth.pin,payload],function(r){
      S.busy=false;
      if(r && r.ok){ S.smartGoals=r.smartGoals||[]; if(after) after(true); }
      else { showMsg(t('That didn’t save — try again.')); if(after) after(false); }
      render();
    });
  }
  function goalPayload_(g){
    return { id:g.id, year:g.year, category:g.category, title:g.title, meta:g.meta||'', pct:g.pctManual!=null?g.pctManual:g.pct, smart:g.smart||{}, steps:(g.steps||[]).slice() };
  }
  var ssb=document.getElementById('smartSaveBtn');
  if(ssb) ssb.onclick=function(){
    if(S.busy) return;
    var d=S.smartDraft, g=d.id ? goalById_(d.id) : null;
    var title=(document.getElementById('sg_title').value||'').trim();
    if(!title){ showMsg(t('Give the goal a title first.')); return; }
    var smart={};
    ['s','m','a','r','t'].forEach(function(k){ var el=document.getElementById('sg_'+k); smart[k]=el ? el.value.trim() : ''; });
    var pctEl=document.getElementById('sg_pct');
    var payload={ id:d.id, year:g?g.year:smartYear_(), category:g?g.category:S.smartCategory, title:title,
      meta:(document.getElementById('sg_meta').value||'').trim(),
      pct: pctEl ? (Number(pctEl.value)||0) : (g ? (g.pctManual!=null?g.pctManual:g.pct) : 0),
      smart:smart, steps:g?(g.steps||[]).slice():[] };
    ssb.disabled=true;
    smartSend_(payload, function(okk){ if(okk){ S.smartDraft=null; showMsg(t('Saved')); } });
  };
  document.querySelectorAll('[data-smartdel]').forEach(function(b){
    b.onclick=function(){
      if(S.busy) return;
      if(!confirm(t('Delete this goal? Its tasks stay under Other tasks.'))) return;
      S.busy=true;
      run('deleteSmartGoal',[S.auth.user,S.auth.pin,b.getAttribute('data-smartdel')],function(r){
        S.busy=false;
        if(r && r.ok){ S.smartGoals=r.smartGoals||[]; (S.tasks||[]).forEach(function(x){ if(x.goalId===b.getAttribute('data-smartdel')) x.goalId=''; }); }
        render();
      });
    };
  });
  /* steps */
  document.querySelectorAll('[data-stepnew]').forEach(function(b){
    b.onclick=function(){ S.stepAdd=b.getAttribute('data-stepnew'); S.stepDraft={kind:'quarter', period:1, title:''}; render(); var el=document.getElementById('stepTitle'); if(el) el.focus(); };
  });
  var stk=document.getElementById('stepKind');
  if(stk) stk.onchange=function(){ S.stepDraft.kind=stk.value; S.stepDraft.period=1; render(); var el=document.getElementById('stepPeriod'); if(el) el.focus(); };
  var stp=document.getElementById('stepPeriod');
  if(stp) stp.onchange=function(){ S.stepDraft.period=Number(stp.value); };
  var stt=document.getElementById('stepTitle');
  if(stt){
    stt.oninput=function(){ S.stepDraft.title=stt.value; };
    stt.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var sb=document.getElementById('stepSaveBtn'); if(sb) sb.click(); } };
  }
  var stc=document.getElementById('stepCancelBtn');
  if(stc) stc.onclick=function(){ S.stepAdd=null; S.stepDraft=null; render(); };
  var sts=document.getElementById('stepSaveBtn');
  if(sts) sts.onclick=function(){
    var g=goalById_(S.stepAdd); if(!g) return;
    var title=(document.getElementById('stepTitle').value||'').trim();
    if(!title){ showMsg(t('Write the step first.')); return; }
    var p=goalPayload_(g);
    p.steps.push({ kind:S.stepDraft.kind, period:Number(S.stepDraft.period)||1, title:title, done:false });
    smartSend_(p, function(okk){ if(okk){ S.stepDraft={kind:S.stepDraft.kind, period:S.stepDraft.period, title:''}; } });
  };
  document.querySelectorAll('[data-stepdone]').forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute('data-stepdone').split('|'), g=goalById_(parts[0]); if(!g) return;
      var p=goalPayload_(g);
      p.steps=p.steps.map(function(st){ return st.id===parts[1] ? Object.assign({}, st, {done:!st.done}) : st; });
      b.classList.toggle('on');
      smartSend_(p);
    };
  });
  document.querySelectorAll('[data-stepdel]').forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute('data-stepdel').split('|'), g=goalById_(parts[0]); if(!g) return;
      if(!confirm(t('Remove this step?'))) return;
      var p=goalPayload_(g);
      p.steps=p.steps.filter(function(st){ return st.id!==parts[1]; });
      smartSend_(p);
    };
  });
  document.querySelectorAll('[data-goaltasks]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.goalsTab='tasks'; S.taskFilter=b.getAttribute('data-goaltasks'); S.taskNew=null; S.smartDraft=null; S.stepAdd=null; render(); };
  });

  /* tasks */
  function taskSend_(fn, args, after){
    if(S.busy) return;
    S.busy=true;
    run(fn, [S.auth.user,S.auth.pin].concat(args), function(r){
      S.busy=false;
      if(r && r.ok){ S.tasks=r.tasks||[]; S.smartGoals=r.smartGoals||S.smartGoals; if(after) after(true); }
      else { showMsg(t('That didn’t save — try again.')); if(after) after(false); }
      render();
    });
  }
  document.querySelectorAll('[data-taskfilter]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.taskFilter=b.getAttribute('data-taskfilter'); S.taskNew=null; S.taskEdit=null; render(); };
  });
  var tnt=document.getElementById('taskNewTitle');
  var tnd=document.getElementById('taskNewDue');
  var tng=document.getElementById('taskNewGoal');
  function taskNewDraft_(){
    S.taskNew=S.taskNew||{title:'', due:'', goalId:''};
    S.taskNew.title=tnt?tnt.value:''; S.taskNew.due=tnd?tnd.value:'';
    S.taskNew.goalId=tng ? tng.value : (goalById_(S.taskFilter) ? S.taskFilter : '');
    return S.taskNew;
  }
  if(tnt){
    tnt.oninput=taskNewDraft_;
    tnt.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var ab=document.getElementById('taskAddBtn'); if(ab) ab.click(); } };
  }
  if(tnd) tnd.onchange=taskNewDraft_;
  if(tng) tng.onchange=taskNewDraft_;
  var tab=document.getElementById('taskAddBtn');
  if(tab) tab.onclick=function(){
    var d=taskNewDraft_();
    var title=(d.title||'').trim();
    if(!title){ if(tnt) tnt.focus(); return; }
    taskSend_('saveTask', [{ title:title, due:d.due||'', goalId:d.goalId||'', done:false }], function(okk){
      if(okk){ S.taskNew={title:'', due:'', goalId:d.goalId||''}; }
    });
    /* Back to the box straight away — the next task is usually right behind */
    setTimeout(function(){ var el=document.getElementById('taskNewTitle'); if(el) el.focus(); }, 50);
  };
  document.querySelectorAll('[data-taskdone]').forEach(function(b){
    b.onclick=function(){
      var x=(S.tasks||[]).filter(function(y){ return y.id===b.getAttribute('data-taskdone'); })[0]; if(!x) return;
      b.classList.toggle('on');
      taskSend_('saveTask', [Object.assign({}, x, {done:!x.done})]);
    };
  });
  document.querySelectorAll('[data-taskedit]').forEach(function(b){
    b.onclick=function(){
      var x=(S.tasks||[]).filter(function(y){ return y.id===b.getAttribute('data-taskedit'); })[0]; if(!x) return;
      S.taskEdit=x.id; S.taskEditDraft=Object.assign({}, x); render();
      var el=document.getElementById('tk_title'); if(el) el.focus();
    };
  });
  ['tk_title','tk_notes','tk_due','tk_goal'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.oninput=el.onchange=function(){ if(S.taskEditDraft) S.taskEditDraft[{tk_title:'title', tk_notes:'notes', tk_due:'due', tk_goal:'goalId'}[id]]=el.value; };
  });
  var tkc=document.getElementById('tkCancelBtn');
  if(tkc) tkc.onclick=function(){ S.taskEdit=null; S.taskEditDraft=null; render(); };
  var tks=document.getElementById('tkSaveBtn');
  if(tks) tks.onclick=function(){
    var d=S.taskEditDraft; if(!d) return;
    var title=(document.getElementById('tk_title').value||'').trim();
    if(!title){ showMsg(t('Give the task a name first.')); return; }
    d.title=title; d.notes=document.getElementById('tk_notes').value; d.due=document.getElementById('tk_due').value; d.goalId=document.getElementById('tk_goal').value;
    taskSend_('saveTask', [d], function(okk){ if(okk){ S.taskEdit=null; S.taskEditDraft=null; } });
  };
  var tkd=document.getElementById('tkDeleteBtn');
  if(tkd) tkd.onclick=function(){
    if(!S.taskEdit) return;
    if(!confirm(t('Delete this task?'))) return;
    taskSend_('deleteTask', [S.taskEdit], function(){ S.taskEdit=null; S.taskEditDraft=null; });
  };
  var tdt=document.getElementById('tasksDoneToggle');
  if(tdt) tdt.onclick=function(){ gpTap(); S.tasksDoneOpen=!S.tasksDoneOpen; render(); };
  var tcd=document.getElementById('tasksClearDone');
  if(tcd) tcd.onclick=function(){
    if(!confirm(t('Clear all completed tasks?'))) return;
    taskSend_('clearDoneTasks', [], function(){ S.tasksDoneOpen=false; });
  };

  bindHome();
  bindMinistrySelects();
  bindCountryOther();

  bindAway();
  bindAdmin();
  bindPersonality();
  bindGStrengths();

  var gpm=document.getElementById('goProfileFromMe');
  if(gpm) gpm.onclick=function(){ S.view='profile'; render(); };
  var gmx=document.getElementById('goProfileMix');
  if(gmx) gmx.onclick=function(){ S.view='profile'; render(); };
  var gmn=document.getElementById('goMentor');
  if(gmn) gmn.onclick=function(){ S.view='mentor'; S.mentee=null; render(); };

  // login
  var lb=document.getElementById('loginBtn');
  if(lb) lb.onclick=function(){
    var u=document.getElementById('li_user').value.trim();
    var pin=document.getElementById('li_pin').value.trim();
    if(!u||!/^\d{4}$/.test(pin)){ showMsg('Enter username + 4-digit PIN'); return; }
    lb.disabled=true; lb.textContent='…';
    run('staffLogin',[u,pin],function(d){
      if(d.ok){ S.auth={user:u,pin:pin}; S.me=d.staff; S.profile=d.profile; afterLogin(); }
      else if(!d.err){
        /* not staff — perhaps a member of the advisory board, with their own sign-in */
        run('boardLogin',[u,pin],function(b){
          if(b && b.ok){ boardEnter_(b.member, {user:u,pin:pin}); return; }
          lb.disabled=false; lb.textContent='Log in'; showMsg('Wrong username or PIN');
        });
      }
      else {
        lb.disabled=false; lb.textContent='Log in';
        if(d.err==='applicant'){ showMsg(t('That is a portal account — opening the YWAM GP Portal.')); setTimeout(function(){ location.href='portal.html'; }, 900); return; }
        showMsg(d.err==='pending' ? 'Your account is waiting on approval from a base leader.' : 'Wrong username or PIN');
      }
    });
  };
  var look=document.getElementById('lookAround'); if(look) look.onclick=function(){ gpTap(); gpEnterGuest_(); };
  var toReg=document.getElementById('toReg'); if(toReg) toReg.onclick=function(){ S.regMode=true; if(!S.roster.length){ run('teamRoster',[],function(r){S.roster=Array.isArray(r)?r:[];render();}); } else render(); };
  var toLogin=document.getElementById('toLogin'); if(toLogin) toLogin.onclick=function(){ S.regMode=false; render(); };

  // register
  var rb=document.getElementById('regBtn');
  if(rb) rb.onclick=function(){
    var payload={
      name:document.getElementById('r_name').value.trim(),
      email:document.getElementById('r_email').value.trim(),
      username:document.getElementById('r_user').value.trim(),
      pin:document.getElementById('r_pin').value.trim(),
      campus:document.getElementById('r_campus').value,
      dept:document.getElementById('r_dept').value,
      ministry:minSelValue_('r_ministry','r_dept').ministry,
      cdKind:minSelValue_('r_ministry','r_dept').cdKind,
      role:document.getElementById('r_role').value.trim(),
      staffType:document.getElementById('r_type').value,
      country:countryValue('r_country'),
      mentorId:document.getElementById('r_mentor').value,
      phone:document.getElementById('r_phone').value.trim(),
      joined:document.getElementById('r_joined').value.trim()
    };
    if(!payload.name){ showMsg('Add your name'); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)){ showMsg('Add a real email address'); return; }
    if(!/^[a-z0-9._-]{2,20}$/.test(payload.username.toLowerCase())){ showMsg('Username: lowercase letters/numbers, 2–20'); return; }
    if(!/^\d{4}$/.test(payload.pin)){ showMsg('PIN must be 4 digits'); return; }
    rb.disabled=true; rb.textContent='…';
    run('staffRegister',[payload],function(d){
      if(d.ok && d.pending){
        // Campus Leadership only — every other department signs in right away.
        // There is no session to start: a base leader has to approve first.
        rb.disabled=false; rb.textContent='Create profile'; S.regMode=false;
        showMsg('Submitted — a base leader needs to approve a leadership account before you can log in.');
        render();
      } else if(d.ok){ S.auth={user:payload.username.toLowerCase(),pin:payload.pin}; S.me=d.staff; S.profile=d.profile; S.regMode=false; afterLogin(); showMsg('Profile created — add a photo!'); S.view='profile'; render(); }
      else {
        rb.disabled=false; rb.textContent='Create profile';
        showMsg(d.err==='taken' ? 'That username is taken'
          : d.err==='email_taken' ? 'There’s already a profile with that email'
          : d.err==='bad_email' || d.err==='email_required' ? 'Add a real email address'
          : 'Check your details');
      }
    });
  };

  // team + mentor cards
  var tps=document.getElementById('teamPScope');
  if(tps) tps.onchange=function(){ S.teamPScope=tps.value; render(); };
  document.querySelectorAll('[data-teamcampus]').forEach(function(b){
    b.onclick=function(){ S.teamCampus=b.getAttribute('data-teamcampus'); S.teamPScope=''; render(); };
  });
  // tapping a teammate in the directory opens their public profile
  document.querySelectorAll('[data-person]').forEach(function(c){
    c.onclick=function(){
      var id=c.getAttribute('data-person');
      run('staffProfile',[S.auth.user,S.auth.pin,id],function(d){
        if(d && d.ok){ S.person=d; render(); }
        else showMsg('Not available');
      });
    };
  });
  var pb=document.getElementById('personBack');
  if(pb) pb.onclick=function(){ S.person=null; render(); };

  // --- the org chart: the Directory / Structure toggle (people open via data-person above) ---
  document.querySelectorAll('[data-teammode]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.teamMode=b.getAttribute('data-teammode'); render(); };
  });
  if(S.view==='team' && S.teamMode==='org' && !S.person && S.me && !teamOrgScope_(S.teamCampus)){
    var sCampus=S.teamCampus || S.me.campus || CAMPUSES[0].id, sYear=structYear_(), sQ=structQ_(), sKey=structKey_(sCampus,sYear,sQ);
    // a quarter other than the current one is read from its snapshot, once
    if(!structIsLive_() && !S.structCache[sKey] && !S.structLoading[sKey] && !S.structError[sKey]){
      S.structLoading[sKey]=true;
      run('getStructure',[S.auth.user,S.auth.pin,sCampus,sYear,sQ],function(d){
        S.structLoading[sKey]=false;
        if(d && d.ok) S.structCache[sKey]={ doc:d.doc, source:d.source, plan:d.plan }; else S.structError[sKey]=(d && d.err) || t('The server answered without the saved structure.');
        render();
      }, function(e){ S.structLoading[sKey]=false; S.structError[sKey]=(e && e.message) || t('Connection problem — try again.'); render(); });
    }
    // the current (or next) quarter's own snapshot, for the "saved on" note, once
    if(structIsLive_() && !S.structCache[sKey] && !S.structLoading[sKey] && !S.structError[sKey]){
      S.structLoading[sKey]=true;
      run('getStructure',[S.auth.user,S.auth.pin,sCampus,sYear,sQ],function(d){
        S.structLoading[sKey]=false;
        S.structCache[sKey] = (d && d.ok) ? { doc:d.doc, source:d.source, plan:d.plan } : { doc:null, source:'none' };
        render();
      }, function(e){ S.structLoading[sKey]=false; S.structCache[sKey]={ doc:null, source:'none' }; render(); });
    }
    var sys=document.getElementById('structYearSel');
    if(sys) sys.onchange=function(){ S.structYear=Number(sys.value); render(); };
    document.querySelectorAll('[data-structq]').forEach(function(b){
      b.onclick=function(){ gpTap(); S.structQ=Number(b.getAttribute('data-structq')); render(); };
    });
    var srt=document.getElementById('structRetry');
    if(srt) srt.onclick=function(){ S.structError[sKey]=''; render(); };
    bindStructArrange_();
    var stb=document.getElementById('structStudentsBtn');
    if(stb) stb.onclick=function(){ gpTap(); if(S.structStudentsEdit===sKey){ S.structStudentsEdit=null; } else { var c0=S.structCache[sKey]; S.structStudentsDraft=Object.assign({}, (c0 && c0.plan && c0.plan.students) || {}); S.structStudentsEdit=sKey; } render(); };
    document.querySelectorAll('[data-stu]').forEach(function(sel){ sel.onchange=function(){ var id=sel.getAttribute('data-stu'); S.structStudentsDraft=S.structStudentsDraft||{}; if(sel.value) S.structStudentsDraft[id]=sel.value; else delete S.structStudentsDraft[id]; }; });
    var sts=document.getElementById('structStudentsCancel');
    if(sts) sts.onclick=function(){ S.structStudentsEdit=null; render(); };
    var stv=document.getElementById('structStudentsSave');
    if(stv) stv.onclick=function(){
      if(S.busy) return; S.busy=true; stv.disabled=true; stv.textContent=t('Saving…');
      run('saveStructurePlan',[S.auth.user,S.auth.pin,sCampus,sYear,sQ,S.structStudentsDraft||{}],function(d){
        S.busy=false;
        if(d && d.ok){ var c1=S.structCache[sKey]||{ doc:null, source:'none' }; c1.plan=d.plan; if(d.doc){ c1.doc=d.doc; c1.source='saved'; } S.structCache[sKey]=c1; S.structStudentsEdit=null; showMsg(gpT('Saved — students in Q{q} {year}',{q:sQ, year:sYear})); }
        else showMsg(t('Could not save'));
        render();
      }, function(){ S.busy=false; showMsg(t('Connection problem — try again.')); render(); });
    };
    var ssb=document.getElementById('structSaveBtn');
    if(ssb) ssb.onclick=function(){
      if(S.busy) return; S.busy=true; ssb.disabled=true; ssb.textContent=t('Saving…');
      run('saveStructure',[S.auth.user,S.auth.pin,sCampus,sYear,sQ],function(d){
        S.busy=false;
        if(d && d.ok){ S.structCache[sKey]={ doc:d.doc, source:'saved', plan:(S.structCache[sKey]||{}).plan }; showMsg(gpT('Saved — Q{q} {year} structure',{q:sQ, year:sYear})); }
        else showMsg(t('Could not save'));
        render();
      });
    };
  }

  document.querySelectorAll('[data-mentee]').forEach(function(c){
    c.onclick=function(){
      var id=c.getAttribute('data-mentee');
      run('getMenteeLogs',[S.auth.user,S.auth.pin,id],function(d){
        if(d.ok){
          S.mentee=d.mentee; S.menteeWeek=null; S.menteeLogs=d.logs; S.menteeGoals=d.goals||[];
          S.menteeProfile=d.profile; S.menteeCheckins=d.checkins||[]; S.menteeSupport=d.support||null;
          S.menteeHabits=d.habits||[]; S.menteeMinistry=d.ministry||null; S.menteeTrips=d.trips||null; S.menteeSmart=d.smartGoals||[];
          render();
        }
        else showMsg('Not available');
      });
    };
  });
  var mBack=document.getElementById('menteeBack'); if(mBack) mBack.onclick=function(){ S.mentee=null; S.menteeWeek=null; render(); };
  var mwp=document.getElementById('mWeekPrev'); if(mwp) mwp.onclick=function(){ gpTap(); S.menteeWeek=(S.menteeWeek||thisWeek())-1; render(); };
  var mwn=document.getElementById('mWeekNext'); if(mwn) mwn.onclick=function(){ gpTap(); S.menteeWeek=(S.menteeWeek||thisWeek())+1; render(); };
  var mwl=document.getElementById('mWeekLatest'); if(mwl) mwl.onclick=function(){ S.menteeWeek=null; render(); };
  document.querySelectorAll('[data-mweek]').forEach(function(b){ b.onclick=function(){ gpTap(); S.menteeWeek=Number(b.getAttribute('data-mweek')); render(); var nav=document.getElementById('mWeekNav'); if(nav) nav.scrollIntoView({ behavior:'smooth', block:'start' }); }; });
  document.querySelectorAll('[data-accept]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-accept');
      run('respondToMentorRequest',[S.auth.user,S.auth.pin,id,true],function(d){
        if(d.ok) S.mentorRequests=d.requests;
        run('getMyMentees',[S.auth.user,S.auth.pin],function(r){ if(r.ok) S.mentees=r.mentees; render(); });
      });
    };
  });
  document.querySelectorAll('[data-decline]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-decline');
      run('respondToMentorRequest',[S.auth.user,S.auth.pin,id,false],function(d){
        if(d.ok) S.mentorRequests=d.requests;
        render();
      });
    };
  });

  /* 1-on-1 requests, either direction of a mentor/mentee pair. */
  document.querySelectorAll('[data-gohealth]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='health'; render(); };
  });
  document.querySelectorAll('[data-jumpgoals]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='week'; render(); };
  });
  document.querySelectorAll('[data-goprofile]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.bellOpen=false; S.view='profile'; render(); };
  });
  /* ☕ opens the 1-on-1 sheet: a mentee fills in their check-in there before
     the request goes; a mentor can ask, or log one that already happened. */
  /* Mentorship: the dashboard's Mentor, My Home's card and Team all open the one page */
  document.querySelectorAll('[data-gomentorship]').forEach(function(b){ b.onclick=function(){ gpTap(); S.view='mentor'; S.mentee=null; render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-oohistall]').forEach(function(b){ b.onclick=function(){ S.ooHistAll=b.getAttribute('data-oohistall'); render(); }; });
  document.querySelectorAll('[data-oolog]').forEach(function(b){ b.onclick=function(){ gpTap(); ooGo_(null, b.getAttribute('data-oolog')); var el=document.getElementById('ooLogHead'); if(el) el.scrollIntoView({ block:'start' }); }; });
  var mpp=document.getElementById('mentorPickProfile'); if(mpp) mpp.onclick=function(){ S.view='profile'; render(); window.scrollTo(0,0); };
  document.querySelectorAll('[data-request121]').forEach(function(b){
    b.onclick=function(){ gpTap(); ooGo_(null, b.getAttribute('data-request121')); };
  });
  document.querySelectorAll('[data-ooopen]').forEach(function(b){
    b.onclick=function(){ gpTap(); ooGo_(b.getAttribute('data-ooopen')); };
  });
  bindOneOnOne_();
  document.querySelectorAll('[data-121accept]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-121accept');
      run('respondToOneOnOne',[S.auth.user,S.auth.pin,id,true],function(d){
        if(d.ok){ S.oneOnOnes=d.oneOnOnes; ooAfterAccept_(id); }
      });
    };
  });
  document.querySelectorAll('[data-121decline]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-121decline');
      run('respondToOneOnOne',[S.auth.user,S.auth.pin,id,false],function(d){
        if(d.ok){ S.oneOnOnes=d.oneOnOnes; render(); }
      });
    };
  });

  // profile
  var pb=document.getElementById('photoBtn'), pi=document.getElementById('photoInput');
  if(pb&&pi){ pb.onclick=function(){ pi.click(); }; pi.onchange=function(){ if(pi.files&&pi.files[0]) handlePhoto(pi.files[0]); }; }
  var dY=document.getElementById('debtY'), dN=document.getElementById('debtN');
  if(dY&&dN){ dY.onclick=function(){ S.profile=S.profile||{}; S.profile.debt=true; render(); }; dN.onclick=function(){ S.profile=S.profile||{}; S.profile.debt=false; render(); }; }
  var cc=document.getElementById('cltCancel');
  if(cc) cc.onclick=function(){
    cc.disabled=true;
    run('updateProfile',[S.auth.user,S.auth.pin,{cancelCltRequest:true}],function(d){
      if(d && d.ok){ S.profile=d.profile; render(); } else { cc.disabled=false; showMsg(t('Could not save')); }
    });
  };
  var sp=document.getElementById('saveProfBtn');
  if(sp) sp.onclick=function(){
    var payload={
      name:document.getElementById('p_name').value.trim(),
      email:document.getElementById('p_email').value.trim(),
      campus:document.getElementById('p_campus').value,
      dept:document.getElementById('p_dept').value,
      ministry:minSelValue_('p_ministry','p_dept').ministry,
      ministries:[].map.call(document.querySelectorAll('[data-pmin]:checked'), function(c){ return c.getAttribute('data-pmin'); }),
      role:document.getElementById('p_role').value.trim(),
      staffType:document.getElementById('p_type').value,
      sex:(document.getElementById('p_sex')||{}).value||'',
      country:countryValue('p_country'),
      mentorId:document.getElementById('p_mentor').value,
      phone:document.getElementById('p_phone').value.trim(),
      joined:document.getElementById('p_joined').value.trim(),
      debt:S.profile&&S.profile.debt?true:false
    };
    var pk=minSelValue_('p_ministry','p_dept'); if(pk.cdKind!==undefined) payload.cdKind=pk.cdKind;
    sp.disabled=true; sp.textContent='Saving…';
    run('updateProfile',[S.auth.user,S.auth.pin,payload],function(d){
      if(d.ok){
        // merged, not replaced: updateProfile sends the public card, which has no
        // isAdmin / hr / portal flags — replacing S.me dropped the Admin menu until a reload
        S.me=Object.assign({}, S.me, d.staff); S.profile=d.profile; saveStaffCard();
        showMsg(d.cltPending ? t('Saved. Your move to Campus Leadership is waiting for an admin to approve it.') : 'Profile saved');
        orgLoad_();   // a new title (Campus Leadership) shows on the charts
        // Ministry may have changed, so re-pull the KPI set for the new one.
        run('getMyMinistry',[S.auth.user,S.auth.pin],function(mn){ if(mn.ok) S.ministry=mn; render(); });
        run('teamRoster',[S.auth.user,S.auth.pin],function(r){S.roster=Array.isArray(r)?r:[];render();});
      }
      else {
        sp.disabled=false; sp.textContent='Save profile';
        showMsg(d && d.err==='email_taken' ? 'There’s already a profile with that email'
          : d && d.err==='bad_email' ? 'That doesn’t look like a real email address'
          : 'Could not save');
      }
    });
  };
  var pinBtn=document.getElementById('pinBtn');
  if(pinBtn) pinBtn.onclick=function(){
    var np=document.getElementById('p_newpin').value.trim();
    if(!/^\d{4}$/.test(np)){ showMsg('PIN must be 4 digits'); return; }
    run('changePin',[S.auth.user,S.auth.pin,np],function(d){
      if(d.ok){ S.auth.pin=np; lsSet('gp-staff',JSON.stringify(S.auth)); showMsg('PIN updated'); }
      else showMsg('Could not update PIN');
    });
  };
  var lo=document.getElementById('logoutBtn'); if(lo) lo.onclick=logout;
}

/* The old dashboard (index.html) is gone (Oct 2026): numbers are recorded on My
   Ministry, and Base shows the figures. What used to open it opens Base. */
function gpGo(p){
  if(p==='teams'){ window.location.href='teams.html'; return; }
  if(!S.me) gpEnterGuest_();
  S.menuOpen=false; renderMenu(); S.view='base'; render(); window.scrollTo(0,0);
}

/* Promise flavour of run() for the refresh gesture. Always resolves, even on a
   failed request — otherwise a dropped connection would leave the spinner
   turning forever. */
function runP(fn, args){
  if(S.student){ return new Promise(function(res){ run(fn, args, function(d){ res(d||null); }, function(){ res(null); }); }); }
  return fetch('/.netlify/functions/api', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ fn:fn, args:args })
  }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
}

function refreshAll(){
  if(!S.me) return Promise.resolve();
  if(S.board){ S.orgLoading=false; orgLoad_(); return gpGuestLoadBase_(); }
  if(S.guest) return gpGuestLoadBase_();
  var u=S.auth.user, k=S.auth.pin;
  if(S.student) return runP('getMyBoot',[u,k]).then(function(d){ if(d && d.ok && d.student){ S.me=d.staff; S.profile=d.profile||{}; applyBoot(d); } });
  return Promise.all([
    runP('teamRoster',[S.auth.user,S.auth.pin]).then(function(r){ if(Array.isArray(r)) S.roster=r; }),
    runP('getMyLogs',[u,k]).then(function(d){
      if(d&&d.ok){ S.logs=d.logs; adoptHabits(d.habits); if(d.profile) S.profile=Object.assign(S.profile||{}, d.profile); }
    }),
    runP('getMyWeekly',[u,k]).then(function(d){ if(d&&d.ok){ S.goals=d.goals||[]; S.checkins=d.checkins||[]; } }),
    runP('getMyMinistry',[u,k]).then(function(d){ if(d&&d.ok) S.ministry=d; }),
    runP('getMyMentees',[u,k]).then(function(d){ if(d&&d.ok) S.mentees=d.mentees; }),
    runP('getMyMentorRequests',[u,k]).then(function(d){ if(d&&d.ok) S.mentorRequests=d.requests; }),
    runP('getMyTrips',[u,k]).then(function(d){ if(d&&d.ok) S.trips=d; }),
    runP('getTripRequests',[u,k]).then(function(d){ if(d&&d.ok) S.tripRequests=d.requests||[]; }),
    runP('getData',['']).then(function(d){ if(d&&d.entries) S.base=d; })
  ]).then(function(){ render(); });
}

/* ---- pulling down also brings in a new version of the app (Oct 2026) ----
   Uriah: "fix the refresh pull down to bring the updated version". The data
   always refreshed; the page itself did not — an app on an iPhone's home screen
   can sit in memory for days running yesterday's code. So the page notes which
   version it started on (the ETags of teams.html, km.js and library.js, read
   with HEAD: a few hundred bytes, never through the service worker), and a pull
   asks again. Anything changed → it reloads, back to the same tab, telling the
   worker to wait for the network instead of the 4-second offline copy (sw.js,
   ?fresh). If the page itself came from the offline copy (the worker leaves a
   note in the gp-meta cache), the first pull that reaches the server reloads. */
/* the page and its code (teams/*) — a change to any of them is a new version */
var GP_VER_FILES=['teams.html','teams/teams.css','teams/01-core.js','teams/02-goals-okrs.js','teams/03-library-org.js','teams/04-ministry-strengths.js','teams/05-admin-hr.js','teams/06-numbers-contract.js','teams/07-health-leave.js','teams/08-team-profile.js','teams/09-finance.js','teams/10-review360.js','teams/11-bind-boot.js','finance.js','km.js','library.js'];
var gpVerBase=null, gpVerStale=false;
function gpVerSig_(){
  return Promise.all(GP_VER_FILES.map(function(f){
    return fetch(f+'?ver='+Date.now(), { method:'HEAD', cache:'no-store' }).then(function(r){
      var e=r.ok && (r.headers.get('etag') || r.headers.get('last-modified'));
      if(!e) throw new Error('no version');
      return String(e).replace(/^W\//,'').replace(/"/g,'').split('-')[0];   // Netlify adds -df etc. per encoding
    });
  })).then(function(a){ return a.join('|'); });
}
function gpVerInit_(){
  try {
    if(window.caches) caches.open('gp-meta').then(function(c){
      return c.match('served-from-cache').then(function(r){
        if(!r) return;
        return r.text().then(function(at){ if(Date.now()-Number(at) < 5*60*1000) gpVerStale=true; return c.delete('served-from-cache'); });
      });
    }).catch(function(){});
  } catch(e){}
  setTimeout(function(){ gpVerSig_().then(function(sig){ if(!gpVerBase) gpVerBase=sig; }, function(){}); }, 1500);
}
function gpNewVersion_(){
  var check=gpVerSig_().then(function(sig){
    if(gpVerStale) return true;
    if(!gpVerBase){ gpVerBase=sig; return false; }
    return sig!==gpVerBase;
  }, function(){ return false; });
  // never hold the pull up for long on a slow connection
  return Promise.race([check, new Promise(function(res){ setTimeout(function(){ res(false); }, 3500); })]);
}
function gpReloadForUpdate_(){
  showMsg(t('Updating to the latest version…'));
  try { if(S.me && !S.guest) sessionStorage.setItem('gp-resume', S.view||''); } catch(e){}
  try { navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(function(r){ if(r) r.update(); }).catch(function(){}); } catch(e){}
  var q=new URLSearchParams(location.search||''); q.set('fresh', String(Date.now()));
  setTimeout(function(){ location.replace(location.pathname+'?'+q.toString()); }, 250);
  return new Promise(function(){});   // the spinner stays until the new page is up
}
function gpPullRefresh_(){
  return gpNewVersion_().then(function(newer){
    return newer ? gpReloadForUpdate_() : refreshAll();
  });
}
/* the ?fresh= a reload asked for has done its job — keep the address clean */
try { if(/[?&]fresh=/.test(location.search)){ var gq=new URLSearchParams(location.search); gq.delete('fresh'); history.replaceState(null,'',location.pathname+(gq.toString()?'?'+gq.toString():'')+location.hash); } } catch(e){}
gpVerInit_();

/* Shared with the dashboard — see gpPullToRefresh in rollup.js. The staff page
   also sits out the gesture while nobody is logged in. */
gpPullToRefresh(function(){ return gpPullRefresh_(); }, { blocked: function(){ return !S.me; } });

/* ---- the bottom bar and the on-screen keyboard ----
   iOS does not shrink the page for the keyboard: it only shrinks what is
   visible. A position:fixed bottom bar stays pinned to the bottom of the
   full-height page, so while someone types into a box (numbers, goals,
   notes…) and scrolls, the bar floats over the middle of what they can see —
   and when the keyboard goes away, iOS sometimes leaves it stuck there until
   the page is laid out again. Reported as the bar "getting stuck on the page,
   randomly blocking the middle of the page at different parts".

   So, on touch screens: while the keyboard is actually up — a field that
   brings one up has focus AND the visible area has shrunk for it — the bar
   is hidden (body.kbOpen). Both halves matter: focus alone is not enough (an
   iPad with a hardware keyboard never shows one; Android's back button
   closes the keyboard but leaves the field focused, and the bar must come
   back then), and a shrink alone is not either (the browser's own toolbars
   move). When it comes back, the scroll position is re-set to itself, which
   makes WebKit recompute where fixed things belong. */
(function gpKeyboardWatch(){
  var vv = window.visualViewport;
  if(!vv || !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return;
  var NO_KB = { checkbox:1, radio:1, button:1, submit:1, reset:1, range:1, file:1, color:1, image:1, hidden:1 };
  var KB_MIN = 120;                         // a keyboard takes far more than any toolbar
  function bringsKeyboard(el){
    if(!el || el === document.body) return false;
    if(el.isContentEditable) return true;
    var tag = el.tagName;
    if(tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return tag === 'INPUT' && !NO_KB[(el.type || 'text').toLowerCase()];
  }
  function settle(){ window.scrollTo(window.pageXOffset, window.pageYOffset); }
  var full = vv.height, width = vv.width, settleNext = false;
  function update(){
    if(Math.abs(vv.width - width) > 1){ width = vv.width; full = vv.height; }   // the phone was turned
    if(vv.height > full) full = vv.height;
    var up = bringsKeyboard(document.activeElement) && vv.height < full - KB_MIN;
    var was = document.body.classList.contains('kbOpen');
    if(up && !was) document.body.classList.add('kbOpen');
    else if(!up && was){
      document.body.classList.remove('kbOpen');
      /* the keyboard is still sliding away: settle now, after its animation,
         and once more on the resize that ends it — only then, never on an
         ordinary resize, which would stop a momentum scroll dead */
      settle(); setTimeout(settle, 350); settleNext = true;
    } else if(settleNext && !up){ settleNext = false; settle(); }
  }
  vv.addEventListener('resize', update);
  document.addEventListener('focusin', function(){ setTimeout(update, 0); });
  /* focus moving to the next box is a focusout then a focusin: wait a beat so
     the bar does not flash up between two fields */
  document.addEventListener('focusout', function(){ setTimeout(update, 60); });
})();
gpSelectNumberOnFocus();   // tapping a number box types over it, rather than beside the 0
gpInstallPrompt();

/* The offline copy of the page (sw.js). Not under a test browser unless the
   test asks for it: a worker serving cached files would quietly change what
   every other test is testing. */
(function(){
  try {
    if(!('serviceWorker' in navigator)) return;
    if(navigator.webdriver && !lsGet('gp-sw-test')) return;
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  } catch(e){}
})();
boot();
