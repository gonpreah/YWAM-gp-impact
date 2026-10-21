/* ==================== Calendar (Oct 2026, Uriah) ====================
   The campus's Google Calendar — birthdays, events, teams coming, guests, volunteers, speakers —
   read-only, in the app, with GP Tasks that have a day on them beside the events. It is one place
   with GP Tasks: ☰ → GP Calendar/Tasks opens the calendar (S.view='calendar') with a Tasks tab on
   top. The month is laid out like Google Calendar's: week rows with the week number on the left,
   each thing a title bar across the days it spans, in its calendar's colour (an admin picks it) or
   its task list's colour (picked in the list's ⋮); tap a day and the days from there on are listed
   under the month; month chips along the top jump ahead. "Coming up" on My Home shows the next
   seven days. An admin connects each calendar once in Admin → Google Calendar; its secret address
   never reaches a page. Google publishes that address as a live feed: the server reads it again at
   most every 30 minutes, so what is added in Google Calendar shows here within the half hour. It
   is one way — nothing here writes to Google. */
S.cal=null; S.calLoading=false; S.calMonth=null; S.calSel=null; S.calOpen=null; S.calKindsFor=null; S.calHome=null; S.calHomeLoading=false; S.gcalAdmin=null;
var CAL_LOC=function(){ return LANG==='km' ? 'km-KH' : 'en-GB'; };
function calYmd_(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function calAddDays_(iso, n){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return calYmd_(d); }
function calDaysBetween_(a, b){ return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5); }
function calMonthNow_(){ return S.calMonth || todayStr().slice(0,7); }
/* the grid: six weeks from the Monday on or before the 1st, as Google Calendar lays it out */
function calGridStart_(ym){ var d=new Date(ym+'-01T00:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return calYmd_(d); }
function calIsoWeek_(iso){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)+3); var jan4=new Date(d.getFullYear(),0,4); return 1+Math.round(((d-jan4)/864e5-3+((jan4.getDay()+6)%7))/7); }
/* which to show — each connected calendar and GP Tasks, ticked on or off like Google Calendar's list on
   the left (Uriah: "different views of different things"); what's off is remembered on this phone */
function calHidden_(){ try { var v=JSON.parse(lsGet('gp-cal-hide')||'[]'); return Array.isArray(v) ? v : []; } catch(e){ return []; } }
/* the kinds hidden per calendar — { calId: [kindIds] } on this phone */
function calHiddenKinds_(){ try { var v=JSON.parse(lsGet('gp-cal-hidekind')||'{}'); return v && typeof v==='object' && !Array.isArray(v) ? v : {}; } catch(e){ return {}; } }
function calHiddenKindsFor_(calId){ var v=calHiddenKinds_()[calId]; return Array.isArray(v) ? v : []; }
function calShown_(e){ return calHidden_().indexOf(e.cal)===-1 && (!e.kind || calHiddenKindsFor_(e.cal).indexOf(e.kind)===-1); }
function calKindName_(id){ var k=((S.cal && S.cal.kinds)||[]).filter(function(x){ return x.id===id; })[0]; return k ? t(k.name) : ''; }
/* the kinds of events (events, birthdays, schools, teams, guests…), each in its colour, to tick on or off */
/* a filter inside a calendar's chip (Andrew, Oct 2026: "not a row of checks for the categories — just
   within the campus calendar, a filter"): ▾ on the chip opens its kinds, each to tick on or off */
function calKindsHtml_(C, calId){
  var kinds=(C && C.kinds)||[], c=(C.cals||[]).filter(function(x){ return x.id===calId; })[0]; if(!c || kinds.length<2) return '';
  var hid=calHiddenKindsFor_(calId);
  return '<div class="gcKindPick" data-calkindpick="'+esc(calId)+'"><div class="gcKindHead"><b>'+esc(gpT('What to show from {name}',{name:c.name}))+'</b>'+
    (hid.length ? '<button class="linkbtn inline" data-calkindall="'+esc(calId)+'">'+esc(t('All kinds'))+'</button>' : '')+'</div><div class="gcLayers">'+
    kinds.map(function(k){ var on=hid.indexOf(k.id)===-1;
      return '<button class="gcLayer cal-'+esc(k.color || c.color || 'grey')+(on?' on':'')+'" data-calkind="'+esc(calId)+'|'+esc(k.id)+'" aria-pressed="'+(on?'true':'false')+'"><span class="gcBox">'+(on?'✓':'')+'</span>'+esc(t(k.name))+'</button>'; }).join('')+'</div></div>';
}
function calLayersHtml_(C, ev){
  var hid=calHidden_(), rows=(C.cals||[]).map(function(c){ return { id:c.id, name:c.name, color:c.color }; });
  if(!S.student) rows.push({ id:'task', name:t('GP Tasks'), color:'task' });
  if(rows.length<2 && !ev.some(function(e){ return e.task; })) return '';
  var kinds=(C.kinds||[]), nk=kinds.length;
  return '<div class="gcLayers">'+rows.map(function(r){ var on=hid.indexOf(r.id)===-1, isCal=r.id!=='task' && nk>1, hk=isCal ? calHiddenKindsFor_(r.id).length : 0;
    return '<span class="gcLayerSplit cal-'+esc(r.color)+'"><button class="gcLayer cal-'+esc(r.color)+(on?' on':'')+(isCal?' split':'')+'" data-callayer="'+esc(r.id)+'" aria-pressed="'+(on?'true':'false')+'"><span class="gcBox">'+(on?'✓':'')+'</span>'+esc(r.name)+'</button>'+
      (isCal ? '<button class="gcLayer gcKindsBtn'+(hk?' on':'')+(S.calKindsFor===r.id?' open':'')+'" data-calkindsfor="'+esc(r.id)+'" aria-label="'+esc(gpT('What to show from {name}',{name:r.name}))+'" aria-expanded="'+(S.calKindsFor===r.id?'true':'false')+'">'+(hk ? (nk-hk)+'/'+nk+' ' : '')+'▾</button>' : '')+'</span>'; }).join('')+'</div>'+
    (S.calKindsFor ? calKindsHtml_(C, S.calKindsFor) : '');
}
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
/* GP Tasks with a day on them, as things on the calendar, in their list's colour */
function calTaskEvents_(from, to){
  var G=S.gpt; if(!G || S.student) return [];
  return G.tasks.filter(function(x){ return x.due && !x.done && x.status!=='declined' && x.due>=from && x.due<=to; }).map(function(x){
    var L=gptListById_(x.listId);
    return { task:x, cal:'task', calName:L ? gptChipName_(L) : t('GP Tasks'), color:(L && L.color) || 'task', title:x.title, where:'', notes:x.notes||'',
      date:x.due, time:x.time||'', endTime:'', allDay:!x.time, endDate:'' };
  });
}
function calSortEv_(a, b){ return a.date<b.date ? -1 : a.date>b.date ? 1 : (a.allDay!==b.allDay ? (a.allDay ? -1 : 1) : (a.time<b.time ? -1 : a.time>b.time ? 1 : 0)); }
function calAllEvents_(C, from, to){
  var ev=((C && C.ok && C.connected) ? C.events : []).concat(calTaskEvents_(from, to)).sort(calSortEv_);
  ev.forEach(function(e, i){ e.key=e.cal+'|'+e.date+'|'+(e.task ? e.task.id : i); });   // one key for the bar and the row
  return ev;
}
function calDayLabel_(iso){
  var d=new Date(iso+'T00:00:00'), today=todayStr(), tomorrow=calAddDays_(today, 1);
  var nice=d.toLocaleDateString(CAL_LOC(), { weekday:'short', day:'numeric', month:'short' });
  return iso===today ? t('Today')+' · '+nice : iso===tomorrow ? t('Tomorrow')+' · '+nice : nice;
}
function calTime_(hm){ var p=String(hm||'').split(':'); if(p.length<2) return ''; var d=new Date(2026,0,1,+p[0],+p[1]); return d.toLocaleTimeString(LANG==='km'?'km-KH':'en-US', { hour:'numeric', minute:'2-digit' }); }
function calEventHtml_(e){
  var key=e.key, open=S.calOpen===key;
  var when=e.allDay ? t('All day') : calTime_(e.time)+(e.endTime ? '–'+calTime_(e.endTime) : '');
  if(e.task){   // a task: tick it off here, or open it in GP Tasks
    var x=e.task, who=x.assignees.map(function(id){ return firstName_(gptPerson_(id).name); }).join(', ');
    return '<div class="calEv cal-'+esc(e.color)+' calTaskRow"><button class="gtCheck" data-caltask="'+esc(x.id)+'" aria-label="'+esc(t('Mark done'))+'"></button>'+
      '<button class="calTaskOpen" data-caltaskopen="'+esc(x.id)+'"><span class="calWhen">'+esc(x.time ? calTime_(x.time) : t('Task'))+'</span><span class="calBody"><b>'+esc(x.title)+'</b>'+
      (who ? '<span class="calMeta">'+GPT_SVG.person+' '+esc(who)+'</span>' : '')+
      '<span class="calCal">'+GPT_SVG.tasks+' '+esc(e.calName)+'</span></span></button></div>';
  }
  return '<button class="calEv cal-'+esc(e.color||'blue')+(open?' open':'')+'" data-calev="'+esc(key)+'">'+
    '<span class="calWhen">'+esc(when)+'</span><span class="calBody"><b>'+esc(e.title || t('(no title)'))+'</b>'+
    ((e.where || e.endDate) ? '<span class="calMeta">'+esc([e.where, e.endDate ? gpT('until {date}',{date:calDayLabel_(e.endDate)}) : ''].filter(Boolean).join(' · '))+'</span>' : '')+
    (open && e.notes ? '<span class="calNotes">'+esc(e.notes)+'</span>' : '')+
    '<span class="calCal">'+esc(e.calName)+(e.kind && S.cal && S.cal.kinds && S.cal.kinds[0] && e.kind!==S.cal.kinds[0].id ? ' · '+esc(calKindName_(e.kind)) : '')+'</span></span></button>';
}
function calListHtml_(events){
  var by={}, days=[];
  events.forEach(function(e){ if(!by[e.date]){ by[e.date]=[]; days.push(e.date); } by[e.date].push(calEventHtml_(e)); });
  return days.map(function(d){ return '<div class="calDay"><div class="calDayHead'+(d===todayStr()?' today':'')+'">'+esc(calDayLabel_(d))+'</div>'+by[d].join('')+'</div>'; }).join('');
}
/* the months along the top: this one and the year ahead, the year named where it turns */
function calMonthsHtml_(ym){
  var d=new Date(todayStr().slice(0,7)+'-01T00:00:00'), h='<div class="gcMonths" id="gcMonths">', lastY='';
  d.setMonth(d.getMonth()-1);
  for(var i=0; i<14; i++){
    var m=calYmd_(d).slice(0,7), y=m.slice(0,4);
    if(lastY && y!==lastY) h+='<span class="gcYear">'+y+'</span>';
    h+='<button class="gcMonth'+(m===ym?' on':'')+'" data-calmonth="'+m+'">'+esc(d.toLocaleDateString(CAL_LOC(), { month:'short' }))+'</button>';
    lastY=y; d.setMonth(d.getMonth()+1);
  }
  return h+'</div>';
}
/* the month, Google Calendar's way: Monday to Sunday, the week number on the left, each thing a bar
   across the days it spans — four rows of them, then "+n" */
var CAL_LANES=4, CAL_BAR=20;
function calGridHtml_(ym, events, sel){
  var start=calGridStart_(ym), today=todayStr();
  var h='<div class="gcGrid" role="grid"><div class="gcHeadRow"><div></div>';
  for(var w=0; w<7; w++) h+='<div class="gcHead">'+esc(new Date(2026,0,5+w).toLocaleDateString(CAL_LOC(), { weekday:'narrow' }))+'</div>';
  h+='</div>';
  for(var wk=0; wk<6; wk++){
    var ws=calAddDays_(start, wk*7), we=calAddDays_(ws, 6), segs=[];
    events.forEach(function(e){
      var s=e.date, en=e.endDate && e.endDate>e.date ? e.endDate : e.date; if(en<ws || s>we) return;
      var a=s<ws ? ws : s, b=en>we ? we : en;
      segs.push({ e:e, col:calDaysBetween_(ws, a), span:calDaysBetween_(a, b)+1 });
    });
    segs.sort(function(x, y){ return x.col-y.col || y.span-x.span || calSortEv_(x.e, y.e); });
    var laneEnd=[], more={};
    segs.forEach(function(sg){ var l=0; while(laneEnd[l]!==undefined && laneEnd[l]>=sg.col) l++; sg.lane=l; laneEnd[l]=sg.col+sg.span-1;
      if(l>=CAL_LANES) for(var c=sg.col; c<sg.col+sg.span; c++) more[c]=(more[c]||0)+1; });
    var lanes=Math.min(CAL_LANES, laneEnd.length), hasMore=Object.keys(more).length>0;
    h+='<div class="gcWeek"><div class="gcWk">'+calIsoWeek_(ws)+'</div><div class="gcDays" style="min-height:'+(34+lanes*CAL_BAR+(hasMore?16:0))+'px">';
    for(var i=0; i<7; i++){ var d=calAddDays_(ws, i);
      h+='<button class="gcCell'+(d.slice(0,7)!==ym?' out':'')+(d===today?' today':'')+(d===sel?' sel':'')+'" data-calday="'+d+'" aria-label="'+esc(calDayLabel_(d))+'"><span class="gcNum">'+(+d.slice(8))+'</span></button>'; }
    h+='<div class="gcBars">'+segs.filter(function(sg){ return sg.lane<CAL_LANES; }).map(function(sg){ var e=sg.e;
        return '<button class="gcBar cal-'+esc(e.color||'blue')+(e.allDay?'':' timed')+'" style="left:'+(sg.col/7*100).toFixed(3)+'%;width:calc('+(sg.span/7*100).toFixed(3)+'% - 3px);top:'+(sg.lane*CAL_BAR)+'px" data-calbar="'+esc(e.key)+'" title="'+esc(e.title)+'">'+esc(e.title || t('(no title)'))+'</button>'; }).join('')+
      Object.keys(more).map(function(c){ return '<span class="gcMore" style="left:'+(c/7*100).toFixed(3)+'%;top:'+(CAL_LANES*CAL_BAR)+'px">+'+more[c]+'</span>'; }).join('')+'</div></div></div>';
  }
  return h+'</div>';
}
function calendarHtml_(){
  var h='<button class="linkbtn" id="calBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>'+ctSegHtml_('calendar');
  var C=S.cal, ym=calMonthNow_(), today=todayStr();
  if(!C){ if(!S.calLoading) setTimeout(calLoad_, 0); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'; }
  if(!C.ok) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Couldn’t load the calendar — pull down to try again.'))+'</p></div>';
  if(!S.gpt && !S.gptLoading && !S.gptErr && !S.student) setTimeout(gptLoad_, 0);   // the tasks come along once loaded
  var from=calGridStart_(ym), to=calAddDays_(from, 41), all=calAllEvents_(C, from, to), ev=all.filter(calShown_);
  var sel=S.calSel || (ym===today.slice(0,7) ? today : ym+'-01');
  var monthName=new Date(ym+'-01T00:00:00').toLocaleDateString(CAL_LOC(), { month:'long', year:'numeric' });
  h+=calMonthsHtml_(ym);
  h+='<div class="gcNav"><button class="weekArrow" id="calPrev" aria-label="'+esc(t('Earlier'))+'">‹</button><div class="gcTitle">'+esc(monthName)+'</div>'+
    '<button class="weekArrow" id="calNext" aria-label="'+esc(t('Later'))+'">›</button>'+
    (ym!==today.slice(0,7) ? '<button class="linkbtn inline" id="calToday">'+esc(t('Today'))+'</button>' : '')+'</div>';
  h+=calLayersHtml_(C, all);
  h+='<div class="card" style="padding:4px 6px 6px 0">'+calGridHtml_(ym, ev, sel)+'</div>';
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
    S.gptPageScope=null; S.gptFrom='week'; S.view='tasks'; S.gptList=x.listId; S.gptOpen=id; S.gptDraft=null; render(); window.scrollTo(0,0);
  }; });
  if(S.view!=='calendar') return;
  bindCtSeg_();
  on('calBack', function(){ gpTap(); S.view='week'; render(); window.scrollTo(0,0); });
  var goMonth=function(ym){ S.calMonth=ym; S.calSel=null; S.cal=null; S.calOpen=null; render(); window.scrollTo(0,0); };
  var shift=function(n){ var d=new Date(calMonthNow_()+'-01T00:00:00'); d.setMonth(d.getMonth()+n); goMonth(calYmd_(d).slice(0,7)); };
  on('calPrev', function(){ shift(-1); });
  on('calNext', function(){ shift(1); });
  on('calToday', function(){ S.calMonth=null; S.calSel=null; S.cal=null; render(); });
  document.querySelectorAll('[data-calmonth]').forEach(function(b){ b.onclick=function(){ gpTap(); goMonth(b.getAttribute('data-calmonth')); }; });
  var mo=document.getElementById('gcMonths'), onM=mo && mo.querySelector('.gcMonth.on'); if(onM && onM.offsetLeft>mo.clientWidth-80) mo.scrollLeft=onM.offsetLeft-20;
  document.querySelectorAll('[data-calday]').forEach(function(b){ b.onclick=function(){
    var d=b.getAttribute('data-calday'); S.calSel=d;
    if(d.slice(0,7)!==calMonthNow_()){ S.calMonth=d.slice(0,7); S.cal=null; }
    render();
  }; });
  document.querySelectorAll('[data-calbar]').forEach(function(b){ b.onclick=function(){   // a bar: that day, with the thing opened under the month
    var k=b.getAttribute('data-calbar'), d=k.split('|')[1]; gpTap(); S.calSel=d; S.calOpen=k; render();
    var row=document.querySelector('.calEv.open, [data-calev="'+k.replace(/"/g,'')+'"]'); if(row && row.scrollIntoView) row.scrollIntoView({ block:'center' });
  }; });
  document.querySelectorAll('[data-calkindsfor]').forEach(function(b){ b.onclick=function(){ gpTap(); var id=b.getAttribute('data-calkindsfor'); S.calKindsFor=S.calKindsFor===id ? null : id; render(); }; });
  document.querySelectorAll('[data-calkind]').forEach(function(b){ b.onclick=function(){
    var k=b.getAttribute('data-calkind').split('|'), all=calHiddenKinds_(), hid=Array.isArray(all[k[0]]) ? all[k[0]] : [], i=hid.indexOf(k[1]); gpTap();
    if(i>-1) hid.splice(i,1); else hid.push(k[1]); all[k[0]]=hid;
    try { lsSet('gp-cal-hidekind', JSON.stringify(all)); } catch(e){}
    render();
  }; });
  document.querySelectorAll('[data-calkindall]').forEach(function(b){ b.onclick=function(){ gpTap(); var all=calHiddenKinds_(); delete all[b.getAttribute('data-calkindall')]; try { lsSet('gp-cal-hidekind', JSON.stringify(all)); } catch(e){} render(); }; });
  document.querySelectorAll('[data-callayer]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-callayer'), hid=calHidden_(), i=hid.indexOf(id); gpTap();
    if(i>-1) hid.splice(i,1); else hid.push(id);
    try { lsSet('gp-cal-hide', JSON.stringify(hid)); } catch(e){}
    render();
  }; });
  document.querySelectorAll('[data-calev]').forEach(function(b){ b.onclick=function(){ var k=b.getAttribute('data-calev'); S.calOpen = S.calOpen===k ? null : k; render(); }; });
}
/* Admin → Google Calendar: connect a calendar by its secret address, pick its colour, see that it reads */
function adminGcalHtml_(){
  var G=S.gcalAdmin;
  if(!G){ setTimeout(function(){ run('adminGcal',[S.auth.user,S.auth.pin,null],function(d){ S.gcalAdmin=d||{ ok:false }; render(); }); }, 0); return '<p class="sub">'+esc(t('Loading…'))+'</p>'; }
  if(!G.ok) return '<p class="sub">'+esc(t('Could not load — try again.'))+'</p>';
  var h='';
  if(G.cals.length) h+='<div class="card">'+G.cals.map(function(c){
    var st=c.lastErr ? '⚠️ '+t('Couldn’t read it last time — check the address') : c.lastOk ? '✓ '+gpT('{n} events · read {date}',{n:c.events, date:fmtDateShort_(c.lastOk)}) : t('Not read yet — it will be the first time someone opens the calendar');
    return '<div class="row" style="flex-wrap:wrap"><span class="rowName"><span class="calDot cal-'+esc(c.color)+'"></span><b>'+esc(c.name)+'</b><div class="pmeta">'+esc(st)+'</div></span>'+
      '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px;color:var(--bad)" data-gcalrm="'+esc(c.id)+'">'+esc(t('Remove'))+'</button>'+
      '<div style="flex-basis:100%">'+calSwatchesHtml_('data-gcalcolor="'+esc(c.id)+'" data-color', c.color)+'</div></div>';
  }).join('')+'</div>';
  /* the kinds of events and their colours — the words in a title that mark each kind */
  var kinds=G.kinds||[];
  h+='<div class="card"><div class="goalCardTitle">🎨 '+esc(t('Kinds of events'))+'</div>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(t('Each kind has a colour and the words that mark it, matched in the event’s title. Everything else is an Event, in the calendar’s own colour. People can tick each kind on or off on the calendar.'))+'</p>'+
    kinds.map(function(k, i){ return '<div class="gcKind"><div class="gcKindRow"><span class="calDot cal-'+esc(k.color||'grey')+'"></span><input type="text" data-kindname="'+esc(k.id)+'" value="'+esc(k.name)+'" maxlength="40" aria-label="'+esc(t('Name'))+'">'+
      (i ? '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px;color:var(--bad)" data-kindrm="'+esc(k.id)+'">'+esc(t('Remove'))+'</button>' : '')+'</div>'+
      (i ? '<input type="text" data-kindkeys="'+esc(k.id)+'" value="'+esc((k.keywords||[]).join(', '))+'" maxlength="400" placeholder="'+esc(t('Words that mark it, separated by commas'))+'">' : '<p class="hint" style="margin:4px 0 0">'+esc(t('Everything that is none of the others.'))+'</p>')+
      calSwatchesHtml_('data-kindcolor="'+esc(k.id)+'" data-color', k.color||'')+(i ? '' : '<button class="linkbtn inline" data-kindcolor="'+esc(k.id)+'" data-color="">'+esc(t('Use the calendar’s colour'))+'</button>')+'</div>'; }).join('')+
    '<button class="btn ghost" id="gcKindAdd" style="margin-top:10px">＋ '+esc(t('Add a kind'))+'</button></div>';
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
  document.querySelectorAll('[data-gcalcolor]').forEach(function(b){ b.onclick=function(){
    gpTap(); run('adminGcal',[S.auth.user,S.auth.pin,{ id:b.getAttribute('data-gcalcolor'), color:b.getAttribute('data-color') }],function(d){ if(d && d.ok){ S.gcalAdmin=d; S.cal=null; S.calHome=null; } render(); });
  }; });
  var saveKind=function(kind, msg){ run('adminGcal',[S.auth.user,S.auth.pin,{ kind:kind }],function(d){ if(d && d.ok){ S.gcalAdmin=d; S.cal=null; S.calHome=null; if(msg) showMsg(msg); } else showMsg(t('Could not save')); render(); }); };
  document.querySelectorAll('[data-kindcolor]').forEach(function(b){ b.onclick=function(){ gpTap(); saveKind({ id:b.getAttribute('data-kindcolor'), color:b.getAttribute('data-color')||'' }); }; });
  document.querySelectorAll('[data-kindname]').forEach(function(inp){ inp.onchange=function(){ saveKind({ id:inp.getAttribute('data-kindname'), name:inp.value }, t('Saved')); }; });
  document.querySelectorAll('[data-kindkeys]').forEach(function(inp){ inp.onchange=function(){ saveKind({ id:inp.getAttribute('data-kindkeys'), keywords:inp.value }, t('Saved')); }; });
  var ka=document.getElementById('gcKindAdd'); if(ka) ka.onclick=function(){ gpTap(); saveKind({ name:t('New kind'), color:'grey', keywords:[] }); };
  document.querySelectorAll('[data-kindrm]').forEach(function(b){ b.onclick=function(){
    if(!window.confirm(t('Remove this kind? Its events become plain Events.'))) return;
    run('adminGcal',[S.auth.user,S.auth.pin,{ kindRemove:b.getAttribute('data-kindrm') }],function(d){ if(d && d.ok){ S.gcalAdmin=d; S.cal=null; S.calHome=null; showMsg(t('Removed')); } render(); });
  }; });
  document.querySelectorAll('[data-gcalrm]').forEach(function(b){ b.onclick=function(){
    if(!window.confirm(t('Remove this calendar from the app?'))) return;
    run('adminGcal',[S.auth.user,S.auth.pin,{ remove:b.getAttribute('data-gcalrm') }],function(d){ if(d && d.ok){ S.gcalAdmin=d; S.cal=null; S.calHome=null; showMsg(t('Removed')); } render(); });
  }; });
}
