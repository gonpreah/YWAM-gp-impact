/* ==================== Calendar (Oct 2026, Uriah) ====================
   The campus's own Google Calendar — birthdays, events, teams coming, guests, volunteers,
   speakers — read-only, in the app, with GP Tasks that have a day on them beside the events:
   ☰ → 📅 Calendar (S.view='calendar'), a month at a time like Google Calendar's — the grid
   with a dot for each thing, tap a day and the days from there on are listed under it — and
   "Coming up" on My Home (the next seven days). An admin connects each calendar once in
   Admin → Google Calendar; its secret address never reaches a page. Google publishes that
   address as a live feed: the server reads it again at most every 30 minutes, so what is
   added in Google Calendar shows here within the half hour. It is one way — nothing here
   writes to Google. */
S.cal=null; S.calLoading=false; S.calMonth=null; S.calSel=null; S.calOpen=null; S.calHome=null; S.calHomeLoading=false; S.gcalAdmin=null;
/* which to show — each connected calendar and GP Tasks, ticked on or off like Google Calendar's list on
   the left (Uriah: "different views of different things"); what's off is remembered on this phone */
function calHidden_(){ try { var v=JSON.parse(lsGet('gp-cal-hide')||'[]'); return Array.isArray(v) ? v : []; } catch(e){ return []; } }
function calShown_(e){ return calHidden_().indexOf(e.cal)===-1; }
function calLayersHtml_(C, ev){
  var hid=calHidden_(), rows=(C.cals||[]).map(function(c){ return { id:c.id, name:c.name, color:c.color }; });
  if(!S.student) rows.push({ id:'task', name:t('GP Tasks'), color:'task' });
  if(rows.length<2 && !ev.some(function(e){ return e.task; })) return '';
  return '<div class="gcLayers">'+rows.map(function(r){ var on=hid.indexOf(r.id)===-1;
    return '<button class="gcLayer cal-'+esc(r.color)+(on?' on':'')+'" data-callayer="'+esc(r.id)+'" aria-pressed="'+(on?'true':'false')+'"><span class="gcBox">'+(on?'✓':'')+'</span>'+esc(r.name)+'</button>'; }).join('')+'</div>';
}
var CAL_LOC=function(){ return LANG==='km' ? 'km-KH' : 'en-GB'; };
function calYmd_(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function calAddDays_(iso, n){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return calYmd_(d); }
function calMonthNow_(){ return S.calMonth || todayStr().slice(0,7); }
/* the grid: six weeks from the Sunday on or before the 1st (the week starts on Sunday here, as the schedules do) */
function calGridStart_(ym){ var d=new Date(ym+'-01T00:00:00'); d.setDate(d.getDate()-d.getDay()); return calYmd_(d); }
function calLoad_(){
  if(S.calLoading) return; S.calLoading=true;
  var from=calGridStart_(calMonthNow_());
  run('getCalendar',[S.auth.user,S.auth.pin,from,42],function(d){ S.calLoading=false; S.cal=(d && d.ok) ? d : { ok:false }; if(S.view==='calendar') render(); },
    function(){ S.calLoading=false; S.cal={ ok:false }; if(S.view==='calendar') render(); });
}
function calHomeLoad_(){
  if(S.calHome || S.calHomeLoading || S.student || S.guest || S.board) return; S.calHomeLoading=true;
  run('getCalendar',[S.auth.user,S.auth.pin,todayStr(),7],function(d){ S.calHomeLoading=false; S.calHome=(d && d.ok) ? d : { ok:false }; if(S.view==='week') render(); },
    function(){ S.calHomeLoading=false; S.calHome={ ok:false }; });
}
/* GP Tasks with a day on them, as things on the calendar (Uriah: "connected to the calendar") */
function calTaskEvents_(from, to){
  var G=S.gpt; if(!G || S.student) return [];
  return G.tasks.filter(function(x){ return x.due && !x.done && x.status!=='declined' && x.due>=from && x.due<=to; }).map(function(x){
    var L=gptListById_(x.listId);
    return { task:x, cal:'task', calName:L ? gptChipName_(L) : t('GP Tasks'), color:'task', title:x.title, where:'', notes:x.notes||'',
      date:x.due, time:x.time||'', endTime:'', allDay:!x.time, endDate:'' };
  });
}
function calSortEv_(a, b){ return a.date<b.date ? -1 : a.date>b.date ? 1 : (a.allDay!==b.allDay ? (a.allDay ? -1 : 1) : (a.time<b.time ? -1 : a.time>b.time ? 1 : 0)); }
function calAllEvents_(C, from, to){
  var ev=((C && C.ok && C.connected) ? C.events : []).concat(calTaskEvents_(from, to));
  return ev.sort(calSortEv_);
}
function calDayLabel_(iso){
  var d=new Date(iso+'T00:00:00'), today=todayStr(), tomorrow=calAddDays_(today, 1);
  var nice=d.toLocaleDateString(CAL_LOC(), { weekday:'short', day:'numeric', month:'short' });
  return iso===today ? t('Today')+' · '+nice : iso===tomorrow ? t('Tomorrow')+' · '+nice : nice;
}
function calTime_(hm){ var p=String(hm||'').split(':'); if(p.length<2) return ''; var d=new Date(2026,0,1,+p[0],+p[1]); return d.toLocaleTimeString(LANG==='km'?'km-KH':'en-US', { hour:'numeric', minute:'2-digit' }); }
function calEventHtml_(e, i){
  var key=e.cal+'|'+e.date+'|'+i, open=S.calOpen===key;
  var when=e.allDay ? t('All day') : calTime_(e.time)+(e.endTime ? '–'+calTime_(e.endTime) : '');
  if(e.task){   // a task: tick it off here, or open it in GP Tasks
    var x=e.task, who=x.assignees.map(function(id){ return firstName_(gptPerson_(id).name); }).join(', ');
    return '<div class="calEv cal-task calTaskRow"><button class="gtCheck" data-caltask="'+esc(x.id)+'" aria-label="'+esc(t('Mark done'))+'"></button>'+
      '<button class="calTaskOpen" data-caltaskopen="'+esc(x.id)+'"><span class="calWhen">'+esc(x.time ? calTime_(x.time) : t('Task'))+'</span><span class="calBody"><b>'+esc(x.title)+'</b>'+
      (who ? '<span class="calMeta">'+GPT_SVG.person+' '+esc(who)+'</span>' : '')+
      '<span class="calCal">'+GPT_SVG.tasks+' '+esc(e.calName)+'</span></span></button></div>';
  }
  return '<button class="calEv cal-'+esc(e.color||'blue')+(open?' open':'')+'" data-calev="'+esc(key)+'">'+
    '<span class="calWhen">'+esc(when)+'</span><span class="calBody"><b>'+esc(e.title || t('(no title)'))+'</b>'+
    ((e.where || e.endDate) ? '<span class="calMeta">'+esc([e.where, e.endDate ? gpT('until {date}',{date:calDayLabel_(e.endDate)}) : ''].filter(Boolean).join(' · '))+'</span>' : '')+
    (open && e.notes ? '<span class="calNotes">'+esc(e.notes)+'</span>' : '')+
    '<span class="calCal">'+esc(e.calName)+'</span></span></button>';
}
function calListHtml_(events){
  var by={}, days=[];
  events.forEach(function(e, i){ if(!by[e.date]){ by[e.date]=[]; days.push(e.date); } by[e.date].push(calEventHtml_(e, i)); });
  return days.map(function(d){ return '<div class="calDay"><div class="calDayHead'+(d===todayStr()?' today':'')+'">'+esc(calDayLabel_(d))+'</div>'+by[d].join('')+'</div>'; }).join('');
}
/* the month: Sunday to Saturday, six rows, a dot per thing (up to three, then "+n") */
function calGridHtml_(ym, events, sel){
  var start=calGridStart_(ym), today=todayStr(), marks={};
  events.forEach(function(e){
    var d=e.date, last=e.endDate && e.endDate>e.date ? e.endDate : e.date, n=0;
    while(d<=last && n<42){ (marks[d]=marks[d]||[]).push(e.color||'blue'); d=calAddDays_(d, 1); n++; }
  });
  var h='<div class="gcGrid" role="grid">';
  for(var w=0; w<7; w++) h+='<div class="gcHead">'+esc(new Date(2026,0,4+w).toLocaleDateString(CAL_LOC(), { weekday:'narrow' }))+'</div>';
  for(var i=0; i<42; i++){
    var d=calAddDays_(start, i), m=marks[d]||[];
    h+='<button class="gcCell'+(d.slice(0,7)!==ym?' out':'')+(d===today?' today':'')+(d===sel?' sel':'')+'" data-calday="'+d+'" aria-label="'+esc(calDayLabel_(d))+'">'+
      '<span class="gcNum">'+(+d.slice(8))+'</span><span class="gcDots">'+m.slice(0,3).map(function(c){ return '<span class="gcDot cal-'+esc(c)+'"></span>'; }).join('')+(m.length>3 ? '<span class="gcMore">+'+(m.length-3)+'</span>' : '')+'</span></button>';
  }
  return h+'</div>';
}
function calendarHtml_(){
  var h='<button class="linkbtn" id="calBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>'+
    '<h2 class="gtTitle">'+gptIc_('calendar')+' '+esc(t('Calendar'))+'</h2>';
  var C=S.cal, ym=calMonthNow_(), today=todayStr();
  if(!C){ if(!S.calLoading) setTimeout(calLoad_, 0); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'; }
  if(!C.ok) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Couldn’t load the calendar — pull down to try again.'))+'</p></div>';
  if(!S.gpt && !S.gptLoading && !S.gptErr && !S.student) setTimeout(gptLoad_, 0);   // the tasks come along once loaded
  var from=calGridStart_(ym), to=calAddDays_(from, 41), all=calAllEvents_(C, from, to), ev=all.filter(calShown_);
  var sel=S.calSel || (ym===today.slice(0,7) ? today : ym+'-01');
  var monthName=new Date(ym+'-01T00:00:00').toLocaleDateString(CAL_LOC(), { month:'long', year:'numeric' });
  h+='<div class="gcNav"><button class="weekArrow" id="calPrev" aria-label="'+esc(t('Earlier'))+'">‹</button><div class="gcTitle">'+esc(monthName)+'</div>'+
    '<button class="weekArrow" id="calNext" aria-label="'+esc(t('Later'))+'">›</button>'+
    (ym!==today.slice(0,7) ? '<button class="linkbtn inline" id="calToday">'+esc(t('Today'))+'</button>' : '')+'</div>';
  h+=calLayersHtml_(C, all);
  h+=calGridHtml_(ym, ev, sel);
  if(!C.connected) h+='<p class="hint" style="margin:0 0 8px">'+esc(t('No calendar is connected yet.'))+
    (S.me.isAdmin ? ' <button class="linkbtn inline" data-adminsubgo="gcal">'+esc(t('Connect it in Admin'))+'</button>' : '')+'</p>';
  var list=ev.filter(function(e){ return e.date>=sel || (e.endDate && e.endDate>=sel && e.date<sel); });
  if(!list.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(all.length && !ev.length ? t('Everything is switched off — tick a calendar above.') : t('Nothing on the calendar from this day on.'))+'</p></div>';
  return h+'<div class="card calList">'+calListHtml_(list)+'</div>';
}
/* My Home: the next seven days, a few at a time — events, and tasks with a day */
function calHomeCardHtml_(){
  calHomeLoad_();
  var C=S.calHome, today=todayStr(), ev=calAllEvents_(C, today, calAddDays_(today, 6));
  if(!(C && C.ok && C.connected) && !ev.length) return '';
  ev=ev.slice(0, 5);
  return '<h3 id="sec-cal">'+gptIc_('calendar')+' '+esc(t('Coming up'))+'</h3><div class="card calHome">'+
    (ev.length ? calListHtml_(ev) : '<p class="sub" style="margin:0">'+esc(t('Nothing on the calendar this week.'))+'</p>')+
    '<button class="btn ghost" id="goCalendar" style="margin:8px 0 0">'+esc(t('See the calendar'))+' ›</button></div>';
}
function bindCalendar_(){
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  on('goCalendar', function(){ gpTap(); S.view='calendar'; S.cal=null; S.calMonth=null; S.calSel=null; render(); window.scrollTo(0,0); });
  /* a task on the calendar: tick it off, or open it */
  document.querySelectorAll('[data-caltask]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-caltask'), x=((S.gpt||{}).tasks||[]).filter(function(y){ return y.id===id; })[0]; if(!x) return; gpTap();
    x.done=true; render(); gptSaveTask_({ id:id, done:true }, t('Completed'));
  }; });
  document.querySelectorAll('[data-caltaskopen]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-caltaskopen'), x=((S.gpt||{}).tasks||[]).filter(function(y){ return y.id===id; })[0]; if(!x) return; gpTap();
    S.gptFrom=S.view==='calendar' ? 'calendar' : 'week'; S.view='tasks'; S.gptList=x.listId; S.gptOpen=id; S.gptDraft=null; render(); window.scrollTo(0,0);
  }; });
  if(S.view!=='calendar') return;
  on('calBack', function(){ gpTap(); S.view='week'; render(); window.scrollTo(0,0); });
  var shift=function(n){ var d=new Date(calMonthNow_()+'-01T00:00:00'); d.setMonth(d.getMonth()+n); S.calMonth=calYmd_(d).slice(0,7); S.calSel=null; S.cal=null; render(); window.scrollTo(0,0); };
  on('calPrev', function(){ shift(-1); });
  on('calNext', function(){ shift(1); });
  on('calToday', function(){ S.calMonth=null; S.calSel=null; S.cal=null; render(); });
  document.querySelectorAll('[data-callayer]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-callayer'), hid=calHidden_(), i=hid.indexOf(id); gpTap();
    if(i>-1) hid.splice(i,1); else hid.push(id);
    try { lsSet('gp-cal-hide', JSON.stringify(hid)); } catch(e){}
    render();
  }; });
  document.querySelectorAll('[data-calday]').forEach(function(b){ b.onclick=function(){
    var d=b.getAttribute('data-calday'); S.calSel=d;
    if(d.slice(0,7)!==calMonthNow_()){ S.calMonth=d.slice(0,7); S.cal=null; }
    render();
  }; });
  document.querySelectorAll('[data-calev]').forEach(function(b){ b.onclick=function(){ var k=b.getAttribute('data-calev'); S.calOpen = S.calOpen===k ? null : k; render(); }; });
}
/* Admin → Google Calendar: connect a calendar by its secret address; see that it reads */
function adminGcalHtml_(){
  var G=S.gcalAdmin;
  if(!G){ setTimeout(function(){ run('adminGcal',[S.auth.user,S.auth.pin,null],function(d){ S.gcalAdmin=d||{ ok:false }; render(); }); }, 0); return '<p class="sub">'+esc(t('Loading…'))+'</p>'; }
  if(!G.ok) return '<p class="sub">'+esc(t('Could not load — try again.'))+'</p>';
  var h='';
  if(G.cals.length) h+='<div class="card">'+G.cals.map(function(c){
    var st=c.lastErr ? '⚠️ '+t('Couldn’t read it last time — check the address') : c.lastOk ? '✓ '+gpT('{n} events · read {date}',{n:c.events, date:fmtDateShort_(c.lastOk)}) : t('Not read yet — it will be the first time someone opens the calendar');
    return '<div class="row"><span class="rowName"><span class="calDot cal-'+esc(c.color)+'"></span><b>'+esc(c.name)+'</b><div class="pmeta">'+esc(st)+'</div></span>'+
      '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px;color:var(--bad)" data-gcalrm="'+esc(c.id)+'">'+esc(t('Remove'))+'</button></div>';
  }).join('')+'</div>';
  h+='<div class="card"><div class="goalCardTitle">＋ '+esc(t('Connect a calendar'))+'</div>'+
    '<ol class="gcalSteps"><li>'+esc(t('In Google Calendar on a computer, open Settings (⚙️) → choose the calendar on the left.'))+'</li>'+
    '<li>'+esc(t('Under “Integrate calendar”, copy the “Secret address in iCal format”.'))+'</li>'+
    '<li>'+esc(t('Paste it here. It stays on the server — nobody in the app sees it.'))+'</li></ol>'+
    '<p class="hint" style="margin:0 0 8px">'+esc(t('It keeps itself up to date: whatever is added in Google Calendar shows in the app within half an hour. The app never changes Google Calendar.'))+'</p>'+
    '<label class="f">'+esc(t('Name'))+'</label><input type="text" id="gcalName" maxlength="60" placeholder="'+esc(t('e.g. YWAM Siem Reap events'))+'">'+
    '<label class="f">'+esc(t('Secret address in iCal format'))+'</label><input type="url" id="gcalUrl" autocomplete="off" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics">'+
    '<button class="btn" id="gcalAdd" style="margin-top:10px">'+esc(t('Connect'))+'</button></div>';
  return h;
}
function bindAdminGcal_(){
  var add=document.getElementById('gcalAdd');
  if(add) add.onclick=function(){
    var url=(document.getElementById('gcalUrl')||{}).value||'', name=(document.getElementById('gcalName')||{}).value||'';
    add.disabled=true;
    run('adminGcal',[S.auth.user,S.auth.pin,{ name:name, url:url.trim() }],function(d){
      add.disabled=false;
      if(d && d.ok){ S.gcalAdmin=d; S.cal=null; S.calHome=null; showMsg(t('Connected')); render(); }
      else showMsg(d && d.err==='bad_url' ? t('That isn’t a Google Calendar iCal address — copy the “Secret address in iCal format”.') : t('Could not save'));
    });
  };
  document.querySelectorAll('[data-gcalrm]').forEach(function(b){ b.onclick=function(){
    if(!window.confirm(t('Remove this calendar from the app?'))) return;
    run('adminGcal',[S.auth.user,S.auth.pin,{ remove:b.getAttribute('data-gcalrm') }],function(d){ if(d && d.ok){ S.gcalAdmin=d; S.cal=null; S.calHome=null; showMsg(t('Removed')); } render(); });
  }; });
}
