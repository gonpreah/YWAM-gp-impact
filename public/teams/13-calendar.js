/* ==================== Calendar (Oct 2026, Uriah) ====================
   The campus's own Google Calendar — birthdays, events, teams coming, guests, volunteers,
   speakers — read-only, in the app: ☰ → 📅 Calendar (S.view='calendar'), a day-by-day list a
   month at a time, and "Coming up" on My Home (the next seven days). An admin connects each
   calendar once in Admin → Google Calendar; its secret address never reaches a page. */
S.cal=null; S.calLoading=false; S.calFrom=null; S.calOpen=null; S.calHome=null; S.calHomeLoading=false; S.gcalAdmin=null;
function calLoad_(){
  if(S.calLoading) return; S.calLoading=true;
  var from=S.calFrom || todayStr();
  run('getCalendar',[S.auth.user,S.auth.pin,from,31],function(d){ S.calLoading=false; S.cal=(d && d.ok) ? d : { ok:false }; if(S.view==='calendar') render(); },
    function(){ S.calLoading=false; S.cal={ ok:false }; if(S.view==='calendar') render(); });
}
function calHomeLoad_(){
  if(S.calHome || S.calHomeLoading || S.student || S.guest || S.board) return; S.calHomeLoading=true;
  run('getCalendar',[S.auth.user,S.auth.pin,todayStr(),7],function(d){ S.calHomeLoading=false; S.calHome=(d && d.ok) ? d : { ok:false }; if(S.view==='week') render(); },
    function(){ S.calHomeLoading=false; S.calHome={ ok:false }; });
}
function calDayLabel_(iso){
  var d=new Date(iso+'T00:00:00'), today=todayStr();
  var tm=new Date(); tm.setDate(tm.getDate()+1); var tomorrow=tm.getFullYear()+'-'+('0'+(tm.getMonth()+1)).slice(-2)+'-'+('0'+tm.getDate()).slice(-2);
  var nice=d.toLocaleDateString(LANG==='km'?'km-KH':'en-GB', { weekday:'short', day:'numeric', month:'short' });
  return iso===today ? t('Today')+' · '+nice : iso===tomorrow ? t('Tomorrow')+' · '+nice : nice;
}
function calTime_(hm){ var p=String(hm||'').split(':'); if(p.length<2) return ''; var d=new Date(2026,0,1,+p[0],+p[1]); return d.toLocaleTimeString(LANG==='km'?'km-KH':'en-US', { hour:'numeric', minute:'2-digit' }); }
function calEventHtml_(e, i){
  var key=e.cal+'|'+e.date+'|'+i, open=S.calOpen===key;
  var when=e.allDay ? t('All day') : calTime_(e.time)+(e.endTime ? '–'+calTime_(e.endTime) : '');
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
function calendarHtml_(){
  var h='<button class="linkbtn" id="calBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>'+
    '<h2 style="margin:4px 0 2px">📅 '+esc(t('Calendar'))+'</h2>';
  var C=S.cal;
  if(!C){ if(!S.calLoading) setTimeout(calLoad_, 0); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'; }
  if(!C.ok) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Couldn’t load the calendar — pull down to try again.'))+'</p></div>';
  if(!C.connected) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('No calendar is connected yet.'))+'</p>'+
    (S.me.isAdmin ? '<button class="btn ghost" style="margin:10px 0 0" data-adminsubgo="gcal">'+esc(t('Connect it in Admin'))+'</button>' : '')+'</div>';
  h+='<p class="sub calLegend">'+(C.cals||[]).map(function(c){ return '<span class="calDot cal-'+esc(c.color)+'"></span>'+esc(c.name); }).join(' &nbsp; ')+'</p>';
  var from=C.from;
  h+='<div class="calNav"><button class="btn ghost small" id="calPrev">‹ '+esc(t('Earlier'))+'</button>'+
    '<span>'+esc(calDayLabel_(from).replace(/^.* · /,''))+' – '+esc(calDayLabel_(C.to).replace(/^.* · /,''))+'</span>'+
    '<button class="btn ghost small" id="calNext">'+esc(t('Later'))+' ›</button></div>'+
    (from!==todayStr() ? '<button class="linkbtn inline" id="calToday" style="display:block;margin:0 auto 8px">'+esc(t('Back to today'))+'</button>' : '');
  if(!C.events.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Nothing on the calendar for these days.'))+'</p></div>';
  return h+'<div class="card calList">'+calListHtml_(C.events)+'</div>';
}
/* My Home: the next seven days, a few at a time */
function calHomeCardHtml_(){
  calHomeLoad_();
  var C=S.calHome; if(!C || !C.ok || !C.connected) return '';
  var ev=C.events.slice(0, 5);
  return '<h3 id="sec-cal">📅 '+esc(t('Coming up'))+'</h3><div class="card calHome">'+
    (ev.length ? calListHtml_(ev) : '<p class="sub" style="margin:0">'+esc(t('Nothing on the calendar this week.'))+'</p>')+
    '<button class="btn ghost" id="goCalendar" style="margin:8px 0 0">'+esc(t('See the calendar'))+' ›</button></div>';
}
function bindCalendar_(){
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  on('goCalendar', function(){ gpTap(); S.view='calendar'; S.cal=null; S.calFrom=null; render(); window.scrollTo(0,0); });
  if(S.view!=='calendar') return;
  on('calBack', function(){ gpTap(); S.view='week'; render(); window.scrollTo(0,0); });
  var shift=function(n){ var d=new Date((S.cal.from||todayStr())+'T00:00:00'); d.setDate(d.getDate()+n); S.calFrom=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); S.cal=null; render(); window.scrollTo(0,0); };
  on('calPrev', function(){ shift(-31); });
  on('calNext', function(){ shift(31); });
  on('calToday', function(){ S.calFrom=null; S.cal=null; render(); });
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
