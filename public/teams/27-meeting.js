/* ==================== The leadership meeting (Nov 2026, Uriah) ====================
   "We want to move more to an EOS-style leadership meeting, and still use our Kanban board … we need a
   little more training to do the meeting well … who's going to lead the Tuesday morning leadership
   meeting, topics and all that … where everyone is clear on their departments … rocks."

   Campus Leadership → Board → **Meeting** (S.leadTab='meet', leadMeetHtml_ / bindMeeting_): a weekly
   90-minute meeting in seven parts, run one part a screen with a clock, built ON what is already there:
     - Issues ARE the board's first column (saveLeadCard); a solved one gets its decision written on the
       card and moves to the finished column (leadMeetSolve);
     - To-dos ARE the board's little tasks, and so GP Tasks (saveLeadTask; a new one: leadMeetTodo);
     - who leads is the facilitator on the meeting-day schedule (the "Tuesday" tab, whose weekday is now a
       setting: S.lead.meetDay).
   New, in leadMeet:<campus> (one getLeadMeeting when the tab opens → S.meet): the scorecard (5–15 weekly
   numbers, typed or linked to a ministry's metric), rocks (the quarter's few priorities, by person),
   headlines, the meeting going on (kept on the server, so every phone shows the same part after
   "Check again") and the record of each past meeting.
   The coaching on each screen is YWAM GP's own wording. "EOS" and "Level 10 Meeting" are trademarks of
   EOS Worldwide — nothing of theirs is copied here, and the page says we aren't affiliated.
   Drafts live in S.mt.d (typing survives a redraw); the clocks tick without a render (lmTick_). */
var LM_PARTS=['checkin','score','rocks','headlines','todos','issues','wrap'];
var LM_DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var LM_INFO={
  checkin:{ icon:'👋', name:'Check-in',
    yes:'One piece of good news each — one from home, one from the work. Half a minute a person.',
    no:'No updates and no problems yet. This part is only for arriving.' },
  score:{ icon:'📊', name:'Scorecard',
    yes:'Read each number and say only “on track” or “off track”.',
    no:'No explaining and no fixing here. If a number is off, drop it to Issues and keep going.' },
  rocks:{ icon:'🪨', name:'Rocks',
    yes:'Each owner says “on track” or “off track” for each of their rocks.',
    no:'No stories. A rock that is off track goes to Issues.' },
  headlines:{ icon:'📣', name:'Headlines',
    yes:'One line each: good news or hard news about our staff and the people we serve.',
    no:'If a headline needs a conversation, drop it to Issues.' },
  todos:{ icon:'☑️', name:'To-dos',
    yes:'Go down last week’s list: done, or not done. We aim for nine in ten done.',
    no:'No reasons needed. Not done: carry it on a week, or drop it to Issues.' },
  issues:{ icon:'🧩', name:'Issues',
    yes:'Pick the three that matter most. Then one at a time: name the real issue, talk it through, decide.',
    no:'Don’t start at the top of the list, and don’t work on three at once. One issue, one decision, then the next.' },
  wrap:{ icon:'🏁', name:'Wrap up',
    yes:'Read back the new to-dos, agree what to tell our teams, and each rate the meeting from 1 to 10.',
    no:'End on time, even with issues left. They wait on the list for next week.' }
};
var LM_GUIDE=[
  'Same day, same time, every week. Put it in the calendar once and guard it.',
  'Start on time and end on time, whoever is missing.',
  'One person leads and keeps the clock. The leader moves the meeting on; they don’t have to have the answers.',
  'The first parts are reporting, kept short. Most of the meeting is for solving issues.',
  'A scorecard number is something you can count every week that tells you early how things are going. Each has one owner and a goal.',
  'A rock is one of the three to seven things that must get done this quarter. Each has one owner. Everyone knows everyone’s rocks.',
  'A to-do is one small action for one person, due in seven days.',
  'An issue is anything in the way: a problem, a question, an idea. Add it to the list the moment you think of it, any day of the week.',
  'To solve an issue: say the real issue in one sentence, let everyone speak once, then decide and write down who does what.'
];
function lmM_(){ return S.meet; }
function lmT_(){ return S.mt || (S.mt={ sec:'score', d:{}, rockQ:'now' }); }
function lmDay_(){ var n=S.lead && Number(S.lead.meetDay); return (S.lead && S.lead.meetDay!=null && n>=0 && n<=6) ? n : 2; }
function lmDayName_(){ return t(LM_DAYS[lmDay_()]); }
function lmNextDate_(){ return leadTuesdays_(1)[0]; }
function lmWho_(p){ return p ? (p.id ? (staffName_(p.id) || '') : (p.name||'')) : ''; }
function lmFirst_(id){ return id ? firstName_(staffName_(id) || '') : ''; }
function lmTeam_(){ return leadOwnerOptions_().map(function(p){ return { id:p.id, name:p.name, sub:'', first:true, group:'' }; }); }
function lmFirstCol_(){ var c=leadCols_()[0]; return c ? c.id : ''; }
function lmIssues_(){ var col=lmFirstCol_(); return ((S.lead && S.lead.cards) || []).filter(function(c){ return c.col===col && col!==leadDoneId_(); }); }
function lmNum_(v){ if(v==null || v==='') return '—'; var n=Number(v); return Math.abs(n)>=1000 ? Math.round(n).toLocaleString('en-US') : String(Math.round(n*100)/100); }
/* is this number where it should be? null when there is no number or no goal to hold it against */
function lmOn_(m, v){ if(v==null || m.goal==null) return null; return m.dir==='lte' ? v<=m.goal : v>=m.goal; }
function lmGoalText_(m){ var sign=m.dir==='lte' ? '≤' : '≥'; return m.goal==null ? t('No goal yet') : gpT('Goal {sign} {n}',{sign:sign, n:lmNum_(m.goal)}); }
function lmQ_(which){ var M=lmM_(); if(which!=='next') return { year:M.year, q:M.q }; return M.q===4 ? { year:M.year+1, q:1 } : { year:M.year, q:M.q+1 }; }
function lmRocks_(which){ var Q=lmQ_(which); return (lmM_().rocks||[]).filter(function(r){ return r.year===Q.year && r.q===Q.q; }); }
function lmClock_(secs){ secs=Math.max(0, Math.round(secs)); var m=Math.floor(secs/60), s=secs%60; return m+':'+(s<10?'0':'')+s; }
function lmNowMs_(){ return Date.now()-(S.meetSkew||0); }
/* last week's to-dos — the server's meetTodoStats_, mirrored: done since the last meeting, or still open
   and due by today (an open one with no day once it is older than that meeting); never one made in the
   meeting going on */
function lmTodoWeek_(){
  var M=lmM_(), since=M.todoSince||'', today=todayStr(), skip=(M.run && M.run.todos) || [], carried=(M.run && M.run.carried) || [], list=[], later=0, done=0;
  ((S.lead && S.lead.cards) || []).forEach(function(c){ leadTasks_(c).forEach(function(tk){
    if(skip.indexOf(tk.id)>-1) return;
    if(tk.done){ if(String(tk.doneAt||'')>=since){ list.push({ c:c, tk:tk }); done++; } }
    else if(carried.indexOf(tk.id)>-1) list.push({ c:c, tk:tk, carried:true });   // moved on a week in this meeting: still not done
    else if(tk.due ? tk.due<=today : String(tk.created||'')<since) list.push({ c:c, tk:tk });
    else later++;
  }); });
  list.sort(function(a,b){ return (a.tk.done-b.tk.done) || String(a.tk.due||'').localeCompare(String(b.tk.due||'')); });
  return { list:list, done:done, total:list.length, pct:list.length ? Math.round(done/list.length*100) : null, later:later };
}
function lmLoad_(force){
  if(S.meetLoading || (!force && (S.meet || S.meetErr))) return;
  S.meetLoading=true; S.meetErr='';
  run('getLeadMeeting',[S.auth.user,S.auth.pin],function(d){ S.meetLoading=false;
    if(d && d.ok && Array.isArray(d.parts)) lmApply_(d);
    else S.meetErr=(d && d.err==='not_authorized') ? t('The leadership meeting is for Campus Leadership.') : t('Could not load');
    render(); },
    function(e){ S.meetLoading=false; S.meetErr=(e && e.message) || t('Connection problem — try again.'); render(); });
}
function lmApply_(d){
  if(d.board && d.board.ok!==false && Array.isArray(d.board.cards)){ S.lead=d.board; S.leadErr=''; }
  var m=Object.assign({}, d); delete m.board;
  ['score','rocks','headlines','past','weeks'].forEach(function(k){ if(!Array.isArray(m[k])) m[k]=[]; });
  m.minutes=m.minutes||{}; S.meet=m; rocksFromMeet_(m);   // leadership's rocks are the app's rocks (teams/28-rocks.js)
  if(S.meetPend && m.run) Object.assign(m.run, S.meetPend);   // taps not sent yet stay on screen
  if(d.now) S.meetSkew=Date.now()-Date.parse(d.now);
}
var LM_ERR={ too_many:'That’s the most this list can hold.', no_meeting:'The meeting has already ended.', bad_decision:'Write the decision first.', linked:'This number fills itself in.',
  bad_value:'Type a number.', bad_metric:'Pick the department, the ministry and the number.', bad_name:'Give it a name first.', bad_title:'Give it a name first.', bad_task:'Write the to-do first.' };
function lmCall_(fn, args, after, quiet){
  if(S.meetBusy) return; S.meetBusy=true;
  run(fn,[S.auth.user,S.auth.pin].concat(args||[]),function(d){ S.meetBusy=false;
    if(d && d.ok){ lmApply_(d); if(after) after(d); }
    else { if(d && d.err==='no_meeting' && S.meet) S.meet.run=null; showMsg(t((d && LM_ERR[d.err]) || 'Could not save')); }
    render(); },
    function(){ S.meetBusy=false; if(!quiet) showMsg(t('No connection — try again when you are online.')); render(); });
}
/* Quick taps on the meeting (who is here, the 1-2-3 ranking): shown at once, sent together a moment later —
   three fast taps are one save, and none is lost behind a call still on its way. */
function lmPatch_(patch){
  S.meetPend=Object.assign(S.meetPend||{}, patch); if(S.meet && S.meet.run) Object.assign(S.meet.run, patch);
  clearTimeout(S.meetPendT); S.meetPendT=setTimeout(lmPatchSend_, 350); render();
}
function lmPatchSend_(){
  if(!S.meetPend) return;
  if(S.meetBusy){ clearTimeout(S.meetPendT); S.meetPendT=setTimeout(lmPatchSend_, 250); return; }
  var p=S.meetPend; S.meetPend=null; lmCall_('leadMeetUpdate',[p], null, true);
}
/* a card straight onto the issues list (the board's first column), unless it is there already */
function lmDrop_(title, notes){
  title=String(title||'').trim().slice(0,160); if(!title || !S.lead) return;
  if(lmIssues_().some(function(c){ return c.title.toLowerCase()===title.toLowerCase(); })){ showMsg(t('Already on the issues list.')); return; }
  if(S.meetBusy) return; S.meetBusy=true;
  run('saveLeadCard',[S.auth.user,S.auth.pin,{ title:title, type:'agenda', col:lmFirstCol_(), notes:notes||'', meeting:(S.meet && S.meet.run && S.meet.run.date)||'' }],function(d){ S.meetBusy=false;
    if(d && d.ok){ S.lead=d; showMsg(t('On the issues list.')); } else showMsg(t('Could not save')); render(); },
    function(){ S.meetBusy=false; showMsg(t('No connection — try again when you are online.')); });
}
function lmSaveTask_(cardId, tk, change){
  if(S.meetBusy) return; S.meetBusy=true;
  run('saveLeadTask',[S.auth.user,S.auth.pin,cardId,Object.assign({ id:tk.id, text:tk.text, done:!!tk.done, owner:tk.owner||'', due:tk.due||'' }, change)],function(d){ S.meetBusy=false;
    if(d && d.ok) S.lead=d; else showMsg(t('Could not save')); render(); },
    function(){ S.meetBusy=false; showMsg(t('No connection — try again when you are online.')); render(); });
}
function lmDraft_(k){ return lmT_().d[k]||''; }
function lmIn_(k, ph, max, extra){ return '<input type="text" data-lmd="'+esc(k)+'" maxlength="'+(max||200)+'" value="'+esc(lmDraft_(k))+'" placeholder="'+esc(ph)+'" aria-label="'+esc(ph)+'"'+(extra||'')+'>'; }

/* ---------- the way in from the Overview ---------- */
function lmOverviewHtml_(){
  if(!S.lead) return '';
  var next=lmNextDate_(), tr=leadTuesFor_(next), who=leadTuesWho_(tr && tr.facilitator);
  return '<button class="lmGo" id="lbMeetGo"><span class="lmGoMain">🗓️ '+esc(gpT('Next meeting · {day} {date}',{day:lmDayName_(), date:hospDate_(next)}))+
    '<span class="lmGoSub">'+esc(who ? gpT('Led by {name}',{name:who}) : t('Nobody is down to lead yet'))+'</span></span><span class="lmGoOpen">'+esc(t('Open'))+' ›</span></button>';
}

/* ---------- the Meeting tab ---------- */
function leadMeetHtml_(){
  var h='<div id="leadMeet">', M=lmM_(), T=lmT_();
  if(!M) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.meetErr || t('Loading…'))+'</p>'+(S.meetErr ? '<button class="btn ghost" id="lmRetry">'+esc(t('Try again'))+'</button>' : '')+'</div></div>';
  if(!S.lead) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.leadErr || t('Loading…'))+'</p></div></div>';
  if(M.run) return h+lmRunHtml_()+lmFineHtml_()+'</div>';
  var next=lmNextDate_(), tr=leadTuesFor_(next), who=leadTuesWho_(tr && tr.facilitator), total=LM_PARTS.reduce(function(a,k){ return a+(Number(M.minutes[k])||0); },0);
  h+='<div class="card lmHead"><div class="lmNextLine"><span class="leadNextLabel">'+esc(t('Next meeting'))+'</span> <b>'+esc(lmDayName_()+' '+hospDate_(next))+'</b></div>'+
    '<div class="lmLedBy">🎤 '+(who ? esc(gpT('Led by {name}',{name:who})) : esc(t('Nobody is down to lead yet'))+' · <button class="linkbtn inline" id="lmPlanWho">'+esc(t('Plan who leads'))+'</button>')+'</div>'+
    '<div class="hint" style="margin:2px 0 10px">'+esc(gpT('{n} minutes · seven parts · one screen each, with a clock',{n:total}))+'</div>'+
    '<button class="btn" id="lmStart" style="margin-top:0">▶ '+esc(t('Start the meeting'))+'</button>'+
    '<button class="linkbtn inline" id="lmSetOpen">⚙️ '+esc(t('Meeting day and minutes'))+'</button></div>';
  if(T.set) h+=lmSettingsHtml_();
  h+=lmGuideHtml_();
  h+='<div class="card lmQuick"><label class="f" style="margin-top:0">🧩 '+esc(t('Something in the way? Add it to the issues list'))+'</label><div class="lmAddRow">'+lmIn_('issue', t('An issue, a question, an idea…'), 160, ' id="lmIssueText"')+
    '<button class="btn small" id="lmIssueAdd">'+esc(t('Add'))+'</button></div><div class="hint" style="margin:6px 0 0">'+esc(gpT('{n} on the issues list — the first column of the board.',{n:lmIssues_().length}))+'</div></div>';
  var secs=[['score','📊',t('Scorecard')],['rocks','🪨',t('Rocks')],['headlines','📣',t('Headlines')],['todos','☑️',t('To-dos')],['past','🗂️',t('Past meetings')]];
  var sec=secs.some(function(x){ return x[0]===T.sec; }) ? T.sec : 'score';
  h+='<div class="lmSecs" role="tablist">'+secs.map(function(x){ return '<button class="lmSec'+(sec===x[0]?' on':'')+'" role="tab" data-lmsec="'+x[0]+'"><span aria-hidden="true">'+x[1]+'</span> '+esc(x[2])+'</button>'; }).join('')+'</div>';
  h+= sec==='rocks' ? lmRocksHtml_(false) : sec==='headlines' ? lmHeadsHtml_() : sec==='todos' ? lmTodosHtml_() : sec==='past' ? lmPastHtml_() : lmScoreHtml_();
  return h+lmFineHtml_()+'</div>';
}
function lmFineHtml_(){ return '<p class="hint lmFine" id="lmFine">'+esc(t('This follows the widely used “Level 10” weekly meeting format. YWAM GP is not affiliated with or endorsed by EOS Worldwide.'))+'</p>'; }
function lmGuideHtml_(){
  var h='<details class="card lmGuide" id="lmGuide"'+(lmT_().guide?' open':'')+'><summary class="goalCardTitle">📖 '+esc(t('How this meeting works'))+'</summary>'+
    '<p class="sub" style="margin:8px 0 6px">'+esc(t('Ninety minutes, the same seven parts every week. The first five are quick reports; the sixth is where the work is done.'))+'</p><ol class="lmParts">';
  LM_PARTS.forEach(function(k){ var I=LM_INFO[k]; h+='<li><b>'+I.icon+' '+esc(t(I.name))+'</b> · '+esc(gpT('{n} min',{n:lmM_().minutes[k]}))+'<div class="lmPartDo">'+esc(t(I.yes))+'</div></li>'; });
  h+='</ol><div class="lbListH">'+esc(t('Rules of thumb'))+'</div><ul class="lmRules">'+LM_GUIDE.map(function(x){ return '<li>'+esc(t(x))+'</li>'; }).join('')+'</ul></details>';
  return h;
}
function lmSettingsHtml_(){
  var st=lmT_().set;
  var h='<div class="card" id="lmSettings"><h3 style="margin-top:0">⚙️ '+esc(t('Meeting day and minutes'))+'</h3><label class="f">'+esc(t('We meet every'))+'</label><select id="lmSetDay">'+
    LM_DAYS.map(function(d, i){ return '<option value="'+i+'"'+(Number(st.day)===i?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+'</select>'+
    '<p class="hint" style="margin:4px 0 8px">'+esc(t('The plan of who leads follows this day. Weeks already planned move to it.'))+'</p><label class="f">'+esc(t('Minutes for each part'))+'</label>';
  LM_PARTS.forEach(function(k){ h+='<div class="lmSetRow"><span>'+LM_INFO[k].icon+' '+esc(t(LM_INFO[k].name))+'</span><input type="number" inputmode="numeric" min="1" max="180" data-lmsetmin="'+k+'" value="'+esc(st.minutes[k])+'" aria-label="'+esc(t(LM_INFO[k].name))+'"></div>'; });
  return h+'<div class="btnRow" style="margin-top:10px"><button class="btn" id="lmSetSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="lmSetCancel">'+esc(t('Cancel'))+'</button></div></div>';
}

/* ---------- the scorecard (its ids keep "score") ---------- */
function lmScoreRowHtml_(m, meeting){
  var M=lmM_(), wks=M.weeks, h='<div class="card slim lmScoreRow" data-lmscore="'+esc(m.id)+'"><div class="lmRowHead"><div style="min-width:0"><b class="lmName">'+esc(m.name)+'</b>'+
    '<div class="rowSub">'+(m.owner ? '👤 '+esc(lmFirst_(m.owner))+' · ' : '')+esc(lmGoalText_(m))+(m.src==='metric' && m.metric ? ' · 🔗 '+esc(t(m.metric.ministry)+' › '+t(m.metric.metric)) : '')+'</div></div>'+
    (meeting ? '' : '<button class="linkbtn inline" data-lmscoreedit="'+esc(m.id)+'">'+esc(t('Edit'))+'</button>')+'</div>';
  var cell=function(w, i){
    var v=m.vals ? m.vals[w.key] : null, on=lmOn_(m, v), lab=i===0 ? t('This week') : i===1 ? t('Last week') : gpT('W{n}',{n:w.week});
    return '<div class="lmWk'+(on===true?' on':on===false?' off':'')+'"><span class="lmWkLab">'+esc(lab)+'</span>'+
      (m.src==='metric' ? '<span class="lmWkVal">'+esc(lmNum_(v))+'</span>' : '<input type="text" inputmode="decimal" class="lmWkIn" data-lmval="'+esc(m.id)+'|'+esc(w.key)+'" value="'+esc(v==null?'':v)+'" aria-label="'+esc(m.name+' — '+lab)+'">')+
      '<span class="lmMark" aria-label="'+esc(on===true ? t('On track') : on===false ? t('Off track') : '')+'">'+(on===true?'✓':on===false?'✗':'·')+'</span></div>';
  };
  if(meeting){
    var w1=wks[1]||wks[0], v1=m.vals ? m.vals[w1.key] : null, on1=lmOn_(m, v1);
    h+='<div class="lmWeeks one">'+cell(w1, 1)+'<div class="lmSay '+(on1===true?'on':on1===false?'off':'')+'">'+esc(on1===true ? t('On track') : on1===false ? t('Off track') : t('No number yet'))+'</div>'+
      (on1===true ? '' : '<button class="hospChip" data-lmscoredrop="'+esc(m.id)+'">🧩 '+esc(t('Drop it to Issues'))+'</button>')+'</div>';
  } else h+='<div class="lmWeeks">'+wks.map(cell).join('')+'</div>';
  return h+'</div>';
}
function lmScoreHtml_(meeting){
  var M=lmM_(), T=lmT_(), h='<div id="lmScore">';
  if(!meeting) h+='<p class="sub">'+esc(t('Five to fifteen numbers you can count every week. Each has one owner and a goal. Thirteen weeks, the newest first.'))+'</p>';
  if(!M.score.length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('No numbers on the scorecard yet.'))+'</p></div>';
  M.score.forEach(function(m){ h+=(T.scoreForm && T.scoreForm.id===m.id && !meeting) ? lmScoreFormHtml_() : lmScoreRowHtml_(m, meeting); });
  if(!meeting){
    if(T.scoreForm && !T.scoreForm.id) h+=lmScoreFormHtml_();
    else if(M.score.length<15) h+='<button class="btn ghost" id="lmScoreAdd">＋ '+esc(t('Add a number'))+'</button>';
  }
  return h+'</div>';
}
function lmScoreFormHtml_(){
  var f=lmT_().scoreForm, deps=getDepartments(S.me.campus), mins=f.dept && deps[f.dept] ? Object.keys(deps[f.dept]) : [];
  var mets=(f.dept && f.ministry) ? metricsFor(S.me.campus, f.dept, f.ministry) : [];
  var opt=function(v, cur, label){ return '<option value="'+esc(v)+'"'+(cur===v?' selected':'')+'>'+esc(label)+'</option>'; };
  var h='<div class="card" id="lmScoreForm"><label class="f" style="margin-top:0">'+esc(t('What do we count?'))+'</label><input type="text" data-lmsf="name" maxlength="80" value="'+esc(f.name||'')+'" placeholder="'+esc(t('e.g. 1-on-1s held this week'))+'">'+
    '<label class="f">'+esc(t('Who owns it'))+'</label>'+ppickHtml_({ key:'lmso', people:lmTeam_(), chosen:f.owner ? [f.owner] : [], multi:false, open:true, placeholder:t('Type a name…'),
      onPick:function(id){ lmT_().scoreForm.owner=id; render(); }, onRemove:function(){ lmT_().scoreForm.owner=''; render(); } })+
    '<label class="f">'+esc(t('Goal'))+'</label><div class="lmAddRow"><select data-lmsf="dir" data-lmre="1" aria-label="'+esc(t('At least or at most'))+'">'+opt('gte', f.dir, t('At least (≥)'))+opt('lte', f.dir, t('At most (≤)'))+'</select>'+
    '<input type="text" inputmode="decimal" data-lmsf="goal" value="'+esc(f.goal==null?'':f.goal)+'" placeholder="'+esc(t('a number'))+'" aria-label="'+esc(t('Goal'))+'"></div>'+
    '<label class="f">'+esc(t('Where does the number come from?'))+'</label><div class="leadFilters"><button class="leadSeg'+(f.src!=='metric'?' on':'')+'" data-lmsrc="manual">✏️ '+esc(t('We type it each week'))+'</button>'+
    '<button class="leadSeg'+(f.src==='metric'?' on':'')+'" data-lmsrc="metric">🔗 '+esc(t('A ministry’s number'))+'</button></div>';
  if(f.src==='metric'){
    h+='<select data-lmsf="dept" data-lmre="1" aria-label="'+esc(t('Department'))+'"><option value="">'+esc(t('— department —'))+'</option>'+Object.keys(deps).map(function(d){ return opt(d, f.dept, t(d)); }).join('')+'</select>'+
      '<select data-lmsf="ministry" data-lmre="1" aria-label="'+esc(t('Ministry'))+'"><option value="">'+esc(t('— ministry —'))+'</option>'+mins.map(function(m){ return opt(m, f.ministry, t(m)); }).join('')+'</select>'+
      '<select data-lmsf="metric" aria-label="'+esc(t('Which number'))+'"><option value="">'+esc(t('— which number —'))+'</option>'+mets.map(function(m){ return opt(m, f.metric, t(m)); }).join('')+'</select>'+
      '<p class="hint" style="margin:4px 0 0">'+esc(t('It fills itself in from what that ministry enters each week.'))+'</p>';
  }
  h+='<div class="btnRow" style="margin-top:10px"><button class="btn" id="lmScoreSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="lmScoreCancel">'+esc(t('Cancel'))+'</button></div>';
  if(f.id) h+='<button class="linkbtn teamDelete" id="lmScoreDel">'+esc(t('Take it off the scorecard'))+'</button>';
  return h+'</div>';
}

/* ---------- rocks ---------- */
/* a rock is drawn the one way the whole app draws it (rockHtml_, teams/28-rocks.js), with the meeting's own attributes */
function lmRockHtml_(r, meeting){ return rockHtml_(r, { p:'lmrock', edit:true, meeting:meeting, drop:true }); }
function lmRocksHtml_(meeting){
  var T=lmT_(), which=meeting ? 'now' : (T.rockQ==='next' ? 'next' : 'now'), Q=lmQ_(which), rocks=lmRocks_(which), h='<div id="lmRocks">';
  if(!meeting){
    var N=lmQ_('next'), C=lmQ_('now');
    h+='<p class="sub">'+esc(t('The three to seven things that must get done this quarter — each person’s, and the team’s. Every ministry has its own rocks too, on its Rocks tab.'))+'</p>'+
      '<div class="leadFilters"><button class="leadSeg'+(which==='now'?' on':'')+'" data-lmrq="now">'+esc(gpT('This quarter · Q{q} {year}',{q:C.q, year:C.year}))+'</button>'+
      '<button class="leadSeg'+(which==='next'?' on':'')+'" data-lmrq="next">'+esc(gpT('Next · Q{q} {year}',{q:N.q, year:N.year}))+'</button></div>';
  }
  var owners=[], seen={}; rocks.forEach(function(r){ var k=r.owner||''; if(!seen[k]){ seen[k]=1; owners.push(k); } });
  owners.sort(function(a,b){ return a==='' ? -1 : b==='' ? 1 : String(staffName_(a)).localeCompare(String(staffName_(b))); });
  if(!rocks.length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(gpT('No rocks for Q{q} yet.',{q:Q.q}))+'</p></div>';
  owners.forEach(function(k){
    var list=rocks.filter(function(r){ return (r.owner||'')===k; }), on=list.filter(function(r){ return r.status!=='off'; }).length;
    h+='<div class="card lmRockGroup" data-lmrockowner="'+esc(k||'team')+'"><div class="lmRowHead"><div class="goalCardTitle">'+(k ? '👤 '+esc(staffName_(k) || t('Someone who has left')) : '🤝 '+esc(t('The whole team')))+'</div><span class="hint">'+esc(gpT('{d} of {n} on track',{d:on, n:list.length}))+'</span></div>'+
      list.map(function(r){ return (T.rockForm && T.rockForm.id===r.id && !meeting) ? lmRockFormHtml_() : lmRockHtml_(r, meeting); }).join('')+'</div>';
  });
  if(!meeting){
    if(T.rockForm && !T.rockForm.id) h+=lmRockFormHtml_();
    else h+='<button class="btn ghost" id="lmRockAdd">＋ '+esc(t('Add a rock'))+'</button>';
  }
  return h+'</div>';
}
function lmRockFormHtml_(){
  var f=lmT_().rockForm;
  var h='<div class="card" id="lmRockForm"><label class="f" style="margin-top:0">'+esc(t('The rock'))+'</label><input type="text" data-lmrf="title" maxlength="120" value="'+esc(f.title||'')+'" placeholder="'+esc(t('e.g. The new dorm is open by the end of the quarter'))+'">'+
    '<label class="f">'+esc(t('Whose is it?'))+'</label>'+ppickHtml_({ key:'lmro', people:lmTeam_(), chosen:f.owner ? [f.owner] : [], multi:false, open:true, placeholder:t('Type a name — or leave empty for the whole team'),
      onPick:function(id){ lmT_().rockForm.owner=id; render(); }, onRemove:function(){ lmT_().rockForm.owner=''; render(); } })+
    (f.owner ? '' : '<p class="hint" style="margin:4px 0 0">🤝 '+esc(t('Nobody picked: it is the whole team’s rock.'))+'</p>')+
    '<label class="f">'+esc(t('A short note (optional)'))+'</label><input type="text" data-lmrf="note" maxlength="300" value="'+esc(f.note||'')+'" placeholder="'+esc(t('What done looks like, or where it stands'))+'">'+
    '<div class="btnRow" style="margin-top:10px"><button class="btn" id="lmRockSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="lmRockCancel">'+esc(t('Cancel'))+'</button></div>';
  if(f.id) h+='<button class="linkbtn teamDelete" id="lmRockDel">'+esc(t('Delete this rock'))+'</button>';
  return h+'</div>';
}

/* ---------- headlines ---------- */
function lmHeadsHtml_(meeting){
  var M=lmM_(), kind=lmT_().hlKind==='hard' ? 'hard' : 'good', h='<div id="lmHeads">';
  if(!meeting) h+='<p class="sub">'+esc(t('One line of good or hard news about our staff or the people we serve. Add them through the week; they are read at the meeting and kept with it.'))+'</p>';
  h+='<div class="card">';
  if(!M.headlines.length) h+='<p class="sub" style="margin:0 0 8px">'+esc(t('No headlines yet this week.'))+'</p>';
  M.headlines.forEach(function(x){
    h+='<div class="lmLine '+esc(x.kind)+'"><span aria-hidden="true">'+(x.kind==='hard'?'💔':'🎉')+'</span><span class="lmLineText">'+esc(x.text)+'<span class="lmLineBy"> — '+esc(lmFirst_(x.by))+'</span></span>'+
      (meeting ? '<button class="hospChip" data-lmhldrop="'+esc(x.id)+'" title="'+esc(t('Drop it to Issues'))+'" aria-label="'+esc(t('Drop it to Issues'))+'">🧩</button>' : '')+
      '<button class="lwDel" data-lmhldel="'+esc(x.id)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>';
  });
  h+='<div class="leadFilters lmKind"><button class="leadSeg'+(kind==='good'?' on':'')+'" data-lmhk="good">🎉 '+esc(t('Good news'))+'</button><button class="leadSeg'+(kind==='hard'?' on':'')+'" data-lmhk="hard">💔 '+esc(t('Hard news'))+'</button></div>'+
    '<div class="lmAddRow">'+lmIn_('hl', t('A headline, in one line'), 200, ' id="lmHlText"')+'<button class="btn small" id="lmHlAdd">'+esc(t('Add'))+'</button></div></div>';
  return h+'</div>';
}

/* ---------- to-dos: the board's little tasks, a week at a time ---------- */
function lmTodoAddHtml_(key, cardId){
  var T=lmT_(), ok='own:'+key;
  return '<div class="lmTodoAdd"><div class="lmAddRow">'+lmIn_(key, t('A to-do: one action, one person, seven days'), 200, ' data-lmtodoin="'+esc(key)+'"')+'<button class="btn small" data-lmtodoadd="'+esc(key)+'" data-lmcard="'+esc(cardId||'')+'">'+esc(t('Add'))+'</button></div>'+
    ppickHtml_({ key:'lmt_'+key, people:lmTeam_(), chosen:T.d[ok] ? [T.d[ok]] : [], multi:false, open:true, placeholder:t('Who owns it — type a name'),
      onPick:function(id){ lmT_().d[ok]=id; render(); }, onRemove:function(){ lmT_().d[ok]=''; render(); } })+'</div>';
}
function lmTodosHtml_(meeting){
  var W=lmTodoWeek_(), h='<div id="lmTodos">';
  if(!meeting) h+='<p class="sub">'+esc(t('A to-do is one action for one person, due in seven days. These are the tasks on the board’s cards — the same ones as in GP Tasks.'))+'</p>';
  h+='<div class="card"><div class="lmRowHead"><div class="goalCardTitle">'+esc(t('Last week’s to-dos'))+'</div>'+
    '<b class="lmPct'+(W.pct==null ? '' : W.pct>=90 ? ' on' : ' off')+'" id="lmTodoPct">'+(W.pct==null ? '—' : esc(gpT('{d} of {n} done',{d:W.done, n:W.total}))+' · '+W.pct+'%')+'</b></div>'+
    '<div class="hint" style="margin:0 0 6px">'+esc(t('We aim for nine in ten done.'))+'</div>';
  if(!W.list.length) h+='<p class="sub" style="margin:0">'+esc(t('Nothing was due this week.'))+'</p>';
  W.list.forEach(function(x){
    var key=esc(x.c.id)+'|'+esc(x.tk.id);
    h+='<div class="lmTodo'+(x.tk.done?' done':'')+'"><label class="leadTaskTick"><input type="checkbox" data-lmtick="'+key+'"'+(x.tk.done?' checked':'')+'> <span>'+esc(x.tk.text)+'</span></label>'+
      '<div class="leadTaskSub">'+(x.tk.owner ? '👤 '+esc(lmFirst_(x.tk.owner))+' · ' : '')+(x.tk.due ? '📅 '+esc(hospDate_(x.tk.due))+' · ' : '')+esc(x.c.title)+'</div>'+
      (x.tk.done ? '' : x.carried ? '<div class="hint">↻ '+esc(t('Carried on a week.'))+'</div>' : '<div class="lmTodoBtns"><button class="hospChip" data-lmcarry="'+key+'">↻ '+esc(t('Carry it on a week'))+'</button><button class="hospChip" data-lmtododrop="'+key+'">🧩 '+esc(t('Drop it to Issues'))+'</button></div>')+'</div>';
  });
  if(W.later) h+='<div class="hint" style="margin:8px 0 0">'+esc(gpT('{n} more are not due yet.',{n:W.later}))+'</div>';
  h+='</div><div class="card"><div class="goalCardTitle" style="margin-bottom:6px">＋ '+esc(t('A new to-do'))+'</div>'+lmTodoAddHtml_('todo', '')+
    '<p class="hint" style="margin:6px 0 0">'+esc(t('It lands in that person’s GP Tasks, due in seven days.'))+'</p></div>';
  return h+'</div>';
}

/* ---------- past meetings ---------- */
function lmPastHtml_(){
  var past=(lmM_().past||[]).slice().reverse(), T=lmT_(), h='<div id="lmPast">';
  if(!past.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('No meetings on record yet. End a meeting and it is kept here.'))+'</p></div></div>';
  var rated=past.filter(function(p){ return p.avg!=null; }).slice(0,12).reverse();
  if(rated.length){
    h+='<div class="card" id="lmTrend"><div class="goalCardTitle" style="margin-bottom:6px">'+esc(t('How we rated our meetings'))+'</div><div class="lmTrend" role="img" aria-label="'+esc(rated.map(function(p){ return hospDate_(p.date)+' '+p.avg; }).join(', '))+'">'+
      rated.map(function(p){ return '<div class="lmTrendCol"><span class="lmTrendN">'+esc(p.avg)+'</span><span class="lmTrendBar" style="height:'+Math.round(p.avg*6)+'px"></span><span class="lmTrendD">'+esc(hospDate_(p.date))+'</span></div>'; }).join('')+'</div></div>';
  }
  past.forEach(function(p){
    var mins=p.mins||{};
    h+='<details class="card lmPastItem" data-lmpast="'+esc(p.id)+'"'+(T.pastOpen===p.id?' open':'')+'><summary><b>'+esc(hospDate_(p.date)+' '+String(p.date).slice(0,4))+'</b> <span class="hint">· '+esc(gpT('{n} min',{n:p.total}))+
      (p.avg!=null ? ' · ⭐ '+esc(p.avg) : '')+(p.todo && p.todo.pct!=null ? ' · ☑️ '+p.todo.pct+'%' : '')+' · 🧩 '+(p.solved||[]).length+'</span></summary>'+
      '<div class="lbWho"><span>'+esc(t('Led by'))+'</span><b>'+esc((p.leader && p.leader.name) || '—')+'</b></div>'+
      '<div class="lbWho"><span>'+esc(t('There'))+'</span><b>'+esc((p.present||[]).map(function(x){ return firstName_(x.name); }).join(', ') || '—')+'</b></div>'+
      '<div class="lbWho"><span>'+esc(t('Time'))+'</span><b>'+esc(gpT('{n} of {m} minutes',{n:p.total, m:p.planned||90}))+'</b></div>'+
      '<div class="lmPastMins">'+LM_PARTS.map(function(k){ return '<span>'+LM_INFO[k].icon+' '+(mins[k]||0)+'</span>'; }).join('')+'</div>';
    if(p.todo && p.todo.total) h+='<div class="lbWho"><span>'+esc(t('To-dos'))+'</span><b>'+esc(gpT('{d} of {n} done',{d:p.todo.done, n:p.todo.total}))+' · '+p.todo.pct+'%</b></div>';
    var list=function(title, rows){ return rows.length ? '<div class="lbListH">'+title+'</div><ul class="lbTopics">'+rows.map(function(x){ return '<li>'+x+'</li>'; }).join('')+'</ul>' : ''; };
    h+=list('🧩 '+esc(t('Issues solved')), (p.solved||[]).map(function(x){ return '<b>'+esc(x.title)+'</b> — '+esc(x.decision); }))+
      list('☑️ '+esc(t('New to-dos')), (p.newTodos||[]).map(function(x){ return esc(x.text)+(x.owner ? ' — '+esc(firstName_(x.owner)) : ''); }))+
      list('📣 '+esc(t('Headlines')), (p.headlines||[]).map(function(x){ return (x.kind==='hard'?'💔 ':'🎉 ')+esc(x.text); }))+
      list('📨 '+esc(t('To tell our teams')), (p.messages||[]).map(function(x){ return esc(x); }));
    if((p.ratings||[]).length) h+='<div class="lbListH">⭐ '+esc(t('Ratings'))+'</div><div class="lmPastMins">'+p.ratings.map(function(x){ return '<span>'+esc(firstName_(x.name))+' '+x.n+'</span>'; }).join('')+'</div>';
    h+='</details>';
  });
  return h+'</div>';
}

/* ---------- running the meeting: one part a screen ---------- */
function lmSpent_(){
  var r=lmM_().run, k=LM_PARTS[r.part], live=Math.max(0, (lmNowMs_()-Date.parse(r.partAt))/1000), sp=r.spent||{}, total=live;
  LM_PARTS.forEach(function(x){ total+=Number(sp[x])||0; });
  return { part:(Number(sp[k])||0)+live, total:total };
}
function lmTick_(){
  var pc=document.getElementById('lmPartClock'), tc=document.getElementById('lmTotalClock'); if(!pc || !tc || !S.meet || !S.meet.run) return;
  var M=S.meet, sp=lmSpent_(), k=LM_PARTS[M.run.part], pm=(Number(M.minutes[k])||0)*60, tm=LM_PARTS.reduce(function(a,x){ return a+(Number(M.minutes[x])||0); },0)*60;
  pc.textContent=lmClock_(sp.part)+' / '+lmClock_(pm); pc.classList.toggle('over', sp.part>pm);
  tc.textContent=lmClock_(sp.total)+' / '+lmClock_(tm); tc.classList.toggle('over', sp.total>tm);
}
setInterval(lmTick_, 1000);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible' && S.meet && S.meet.run && S.auth && document.getElementById('lmRun')) lmLoad_(true); });
function lmRunHtml_(){
  var M=lmM_(), r=M.run, k=LM_PARTS[r.part]||LM_PARTS[0], I=LM_INFO[k], last=r.part===LM_PARTS.length-1;
  var h='<div id="lmRun" data-lmpartnow="'+k+'"><div class="lmBar"><div class="lmBarTop"><span class="lmStep">'+esc(gpT('Part {n} of {m}',{n:r.part+1, m:LM_PARTS.length}))+'</span>'+
    '<span class="lmClocks"><span class="lmClock" id="lmPartClock" title="'+esc(t('This part'))+'">0:00</span><span class="lmClock total" id="lmTotalClock" title="'+esc(t('The whole meeting'))+'">0:00</span></span></div>'+
    '<h3 class="lmRunTitle">'+I.icon+' '+esc(t(I.name))+'</h3>'+
    '<div class="lmDots">'+LM_PARTS.map(function(x, i){ return '<button class="lmDot'+(i===r.part?' on':i<r.part?' past':'')+'" data-lmpart="'+i+'" aria-label="'+esc(t(LM_INFO[x].name))+'" title="'+esc(t(LM_INFO[x].name))+'">'+LM_INFO[x].icon+'</button>'; }).join('')+'</div></div>'+
    '<div class="lmLedBy run">🎤 '+esc(gpT('Led by {name}',{name:lmWho_(r.leader) || '—'}))+' · <button class="linkbtn inline" id="lmRefresh">↻ '+esc(t('Check again'))+'</button></div>'+
    '<div class="lmCoach"><p class="lmDo"><b aria-hidden="true">✓</b> '+esc(t(I.yes))+'</p><p class="lmDont"><b aria-hidden="true">✗</b> '+esc(t(I.no))+'</p></div>';
  h+= k==='checkin' ? lmCheckinHtml_() : k==='score' ? lmScoreHtml_(true) : k==='rocks' ? lmRocksHtml_(true) : k==='headlines' ? lmHeadsHtml_(true) : k==='todos' ? lmTodosHtml_(true) : k==='issues' ? lmIssuesHtml_() : lmWrapHtml_();
  h+='<div class="btnRow lmNav">'+(r.part>0 ? '<button class="btn ghost" id="lmBack">‹ '+esc(t('Back'))+'</button>' : '')+
    (last ? '<button class="btn" id="lmEnd">🏁 '+esc(t('End the meeting'))+'</button>' : '<button class="btn" id="lmNext">'+esc(gpT('Next: {part}',{part:t(LM_INFO[LM_PARTS[r.part+1]].name)}))+' ›</button>')+'</div>'+
    '<div class="lmFoot"><button class="linkbtn inline teamDelete" id="lmCancel">'+esc(t('Started by mistake? Cancel this meeting'))+'</button></div>';
  return h+'</div>';
}
function lmCheckinHtml_(){
  var r=lmM_().run, here=r.present||[], people=leadOwnerOptions_();
  here.forEach(function(id){ if(!people.some(function(p){ return p.id===id; })) people.push({ id:id, name:staffName_(id) || '—' }); });
  return '<div class="card" id="lmCheckin"><div class="goalCardTitle" style="margin-bottom:6px">'+esc(t('Who is here?'))+'</div><div class="chips">'+people.map(function(p){
    var on=here.indexOf(p.id)>-1; return '<button class="hospChip'+(on?' on':'')+'" data-lmhere="'+esc(p.id)+'" aria-pressed="'+on+'">'+(on?'✓ ':'')+esc(firstName_(p.name))+'</button>'; }).join('')+'</div>'+
    '<p class="hint" style="margin:8px 0 0">'+esc(gpT('{n} here',{n:here.length}))+'</p></div>';
}
function lmIssuesHtml_(){
  var M=lmM_(), r=M.run, T=lmT_(), issues=lmIssues_(), top=(r.top||[]).filter(function(id){ return issues.some(function(c){ return c.id===id; }); });
  var cur=r.issue && issues.filter(function(c){ return c.id===r.issue; })[0], h='<div id="lmIssues">';
  if(cur){
    var ik='identify:'+cur.id, dk='decision:'+cur.id; if(T.d[ik]==null) T.d[ik]=r.identify||'';
    h+='<div class="card" id="lmIds" data-lmissue="'+esc(cur.id)+'"><div class="leadNextLabel">'+esc(t('The issue on the table'))+'</div><h3 style="margin:2px 0 4px">'+esc(cur.title)+'</h3>'+(cur.notes ? '<p class="sub lmIssueNotes">'+esc(cur.notes)+'</p>' : '')+
      '<div class="lmIdsStep"><b>1 · '+esc(t('Identify'))+'</b><span class="hint"> '+esc(t('What is the real issue underneath? One sentence.'))+'</span></div>'+
      '<input type="text" id="lmIdentify" data-lmd="'+esc(ik)+'" maxlength="300" value="'+esc(T.d[ik]||'')+'" placeholder="'+esc(t('The real issue is…'))+'" aria-label="'+esc(t('The real issue is…'))+'">'+
      '<div class="lmIdsStep"><b>2 · '+esc(t('Discuss'))+'</b><span class="hint"> '+esc(t('Everyone says what they think, once. No repeating, no side roads.'))+'</span></div>'+
      '<div class="lmIdsStep"><b>3 · '+esc(t('Solve'))+'</b><span class="hint"> '+esc(t('Decide. Write the decision, and a to-do for whoever acts on it.'))+'</span></div>'+
      '<textarea id="lmDecision" data-lmd="'+esc(dk)+'" rows="3" maxlength="600" placeholder="'+esc(t('We decided…'))+'" aria-label="'+esc(t('We decided…'))+'">'+esc(T.d[dk]||'')+'</textarea>';
    var tasks=leadTasks_(cur);
    if(tasks.length) h+='<ul class="lbTopics lmIssueTodos">'+tasks.map(function(tk){ return '<li>☑️ '+esc(tk.text)+(tk.owner ? ' — '+esc(lmFirst_(tk.owner)) : '')+'</li>'; }).join('')+'</ul>';
    h+=lmTodoAddHtml_('itodo', cur.id)+
      '<div class="btnRow" style="margin-top:10px"><button class="btn" id="lmSolve">✓ '+esc(t('Solved — write it on the card'))+'</button><button class="btn ghost" id="lmIssueBack">'+esc(t('Not today — back to the list'))+'</button></div></div>';
  } else {
    h+='<div class="card"><div class="lmRowHead"><div class="goalCardTitle">'+esc(t('The issues list'))+'</div><span class="hint">'+esc(gpT('{n} picked of 3',{n:top.length}))+'</span></div>'+
      '<p class="hint" style="margin:0 0 6px">'+esc(t('Tap the three that matter most, in order. Then work on number 1.'))+'</p>';
    if(!issues.length) h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Nothing on the issues list. Add what is in the way.'))+'</p>';
    issues.forEach(function(c){ var n=top.indexOf(c.id);
      h+='<button class="lmIssue'+(n>-1?' picked':'')+'" data-lmrank="'+esc(c.id)+'" aria-pressed="'+(n>-1)+'"><span class="lmRank">'+(n>-1 ? (n+1) : '')+'</span><span class="lmIssueTitle">'+esc(c.title)+(c.owner ? '<span class="lmLineBy"> — '+esc(lmFirst_(c.owner))+'</span>' : '')+'</span></button>'; });
    /* this meeting's topics on the schedule, not yet on the list: one tap puts each there */
    var tr=leadTuesFor_(r.date), sug=((tr && tr.topics) || []).filter(function(x){ return !((S.lead.cards)||[]).some(function(c){ return c.title.toLowerCase()===String(x).toLowerCase(); }); });
    if(sug.length) h+='<div class="lbListH">📌 '+esc(t('From today’s topics'))+'</div><div class="chips">'+sug.map(function(x, i){ return '<button class="hospChip" data-lmtopic="'+i+'">＋ '+esc(x)+'</button>'; }).join('')+'</div>';
    T.sug=sug;
    h+='<div class="lmAddRow" style="margin-top:10px">'+lmIn_('issue', t('An issue, a question, an idea…'), 160, ' id="lmIssueText"')+'<button class="btn small" id="lmIssueAdd">'+esc(t('Add'))+'</button></div>';
    if(top.length){ var first=issues.filter(function(c){ return c.id===top[0]; })[0]; h+='<button class="btn" id="lmWork">'+esc(gpT('Work on number 1: {title}',{title:first.title}))+'</button>'; }
    h+='</div>';
  }
  if((r.solved||[]).length) h+='<div class="card" id="lmSolved"><div class="goalCardTitle" style="margin-bottom:6px">✓ '+esc(gpT('Solved today · {n}',{n:r.solved.length}))+'</div>'+r.solved.map(function(x){ return '<div class="lmLine"><span class="lmLineText"><b>'+esc(x.title)+'</b> — '+esc(x.decision)+'</span></div>'; }).join('')+'</div>';
  return h+'</div>';
}
function lmWrapHtml_(){
  var M=lmM_(), r=M.run, tasks={}, h='<div id="lmWrap">';
  ((S.lead && S.lead.cards) || []).forEach(function(c){ leadTasks_(c).forEach(function(tk){ tasks[tk.id]=tk; }); });
  var made=(r.todos||[]).map(function(id){ return tasks[id]; }).filter(Boolean);
  h+='<div class="card" id="lmNewTodos"><div class="goalCardTitle" style="margin-bottom:6px">☑️ '+esc(gpT('New to-dos · {n}',{n:made.length}))+'</div>'+
    (made.length ? made.map(function(tk){ return '<div class="lmLine"><span class="lmLineText">'+esc(tk.text)+'<span class="lmLineBy"> — '+esc(lmFirst_(tk.owner) || t('nobody yet'))+(tk.due ? ' · '+esc(hospDate_(tk.due)) : '')+'</span></span></div>'; }).join('') : '<p class="sub" style="margin:0 0 6px">'+esc(t('None yet. Read back who is doing what.'))+'</p>')+
    lmTodoAddHtml_('wtodo', '')+'</div>';
  h+='<div class="card" id="lmMsgs"><div class="goalCardTitle" style="margin-bottom:6px">📨 '+esc(t('What do we need to tell our teams?'))+'</div>'+
    (r.messages||[]).map(function(x, i){ return '<div class="lmLine"><span class="lmLineText">'+esc(x)+'</span><button class="lwDel" data-lmmsgdel="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+
    '<div class="lmAddRow">'+lmIn_('msg', t('One message, in one line'), 200, ' id="lmMsgText"')+'<button class="btn small" id="lmMsgAdd">'+esc(t('Add'))+'</button></div></div>';
  var all=S.me.isAdmin || r.by===S.me.id || (r.leader && r.leader.id===S.me.id), rated=Object.keys(r.ratings||{}), sum=0;
  rated.forEach(function(id){ sum+=Number(r.ratings[id])||0; });
  var people=(r.present||[]).slice(); if(people.indexOf(S.me.id)===-1) people.push(S.me.id);
  h+='<div class="card" id="lmRate"><div class="lmRowHead"><div class="goalCardTitle">⭐ '+esc(t('Rate the meeting, 1 to 10'))+'</div><b id="lmAvg">'+(rated.length ? esc(gpT('Average {n}',{n:Math.round(sum/rated.length*10)/10})) : '—')+'</b></div>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(t('Did we start and end on time, stay on track, and solve what mattered? Under 8: say in a sentence what would make it better.'))+'</p>'+
    people.map(function(id){ var v=r.ratings ? r.ratings[id] : null, can=all || id===S.me.id;
      return '<div class="lmSetRow"><span>'+esc(staffName_(id) || '—')+'</span><select data-lmrate="'+esc(id)+'"'+(can?'':' disabled')+' aria-label="'+esc(gpT('{name}’s rating',{name:firstName_(staffName_(id)||'')}))+'"><option value="">—</option>'+
        [1,2,3,4,5,6,7,8,9,10].map(function(n){ return '<option value="'+n+'"'+(Number(v)===n?' selected':'')+'>'+n+'</option>'; }).join('')+'</select></div>'; }).join('')+'</div>';
  return h+'</div>';
}

/* ---------- binding ---------- */
function bindMeeting_(){
  var go=document.getElementById('lbMeetGo'); if(go) go.onclick=function(){ gpTap(); S.lwTab='board'; lwTabKeep_('board'); S.leadTab='meet'; render(); window.scrollTo(0,0); };
  var root=document.getElementById('leadMeet'); if(!root) return;
  if(!S.meet && !S.meetLoading && !S.meetErr) lmLoad_();
  var rt=document.getElementById('lmRetry'); if(rt) rt.onclick=function(){ S.meetErr=''; S.leadErr=''; lmLoad_(true); render(); };
  if(!S.meet || !S.lead) return;
  var T=lmT_(), M=S.meet, on=function(sel, fn){ root.querySelectorAll(sel).forEach(function(el){ el.onclick=function(e){ gpTap(); fn(el, e); }; }); };
  var id=function(x, fn){ var el=document.getElementById(x); if(el) el.onclick=function(e){ gpTap(); fn(el, e); }; };
  var enter=function(inputId, btnId){ var el=document.getElementById(inputId); if(el) el.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var b=document.getElementById(btnId); if(b) b.click(); } }; };
  root.querySelectorAll('[data-lmd]').forEach(function(el){ el.oninput=function(){ T.d[el.getAttribute('data-lmd')]=el.value; }; });
  var g=document.getElementById('lmGuide'); if(g) g.ontoggle=function(){ T.guide=g.open; };
  on('[data-lmsec]', function(b){ T.sec=b.getAttribute('data-lmsec'); T.scoreForm=null; T.rockForm=null; render(); });
  id('lmPlanWho', function(){ S.leadTab='tues'; render(); });
  /* settings */
  id('lmSetOpen', function(){ T.set=T.set ? null : { day:lmDay_(), minutes:Object.assign({}, M.minutes) }; render(); });
  id('lmSetCancel', function(){ T.set=null; render(); });
  var sd=document.getElementById('lmSetDay'); if(sd) sd.onchange=function(){ T.set.day=Number(sd.value); };
  root.querySelectorAll('[data-lmsetmin]').forEach(function(el){ el.oninput=function(){ T.set.minutes[el.getAttribute('data-lmsetmin')]=el.value; }; });
  id('lmSetSave', function(){ lmCall_('saveLeadMeetSettings',[{ day:T.set.day, minutes:T.set.minutes }], function(){ T.set=null; S.ltOpen=null; S.ltDraft=null; showMsg(t('Saved')); }); });
  /* an issue from anywhere */
  id('lmIssueAdd', function(){ var v=(T.d.issue||'').trim(); if(!v){ showMsg(t('Write the issue first.')); return; } T.d.issue=''; lmDrop_(v, ''); });
  enter('lmIssueText', 'lmIssueAdd');
  /* scorecard */
  id('lmScoreAdd', function(){ T.scoreForm={ id:'', name:'', owner:'', goal:'', dir:'gte', src:'manual', dept:'', ministry:'', metric:'' }; render(); });
  on('[data-lmscoreedit]', function(b){ var m=M.score.filter(function(x){ return x.id===b.getAttribute('data-lmscoreedit'); })[0]; if(!m) return;
    T.scoreForm={ id:m.id, name:m.name, owner:m.owner||'', goal:m.goal==null?'':m.goal, dir:m.dir, src:m.src, dept:m.metric?m.metric.dept:'', ministry:m.metric?m.metric.ministry:'', metric:m.metric?m.metric.metric:'' }; render(); });
  root.querySelectorAll('[data-lmsf]').forEach(function(el){ var k=el.getAttribute('data-lmsf'), f=T.scoreForm; if(!f) return;
    var set=function(){ f[k]=el.value; if(k==='dept'){ f.ministry=''; f.metric=''; } if(k==='ministry') f.metric=''; if(el.getAttribute('data-lmre')) render(); };
    if(el.tagName==='SELECT') el.onchange=set; else el.oninput=set; });
  on('[data-lmsrc]', function(b){ T.scoreForm.src=b.getAttribute('data-lmsrc'); render(); });
  id('lmScoreCancel', function(){ T.scoreForm=null; render(); });
  id('lmScoreSave', function(){ var f=T.scoreForm;
    if(!String(f.name||'').trim()){ showMsg(t('Give it a name first.')); return; }
    if(f.src==='metric' && !(f.dept && f.ministry && f.metric)){ showMsg(t('Pick the department, the ministry and the number.')); return; }
    lmCall_('saveLeadScore',[{ id:f.id, name:f.name, owner:f.owner, goal:String(f.goal).replace(/,/g,''), dir:f.dir, src:f.src, metric:{ dept:f.dept, ministry:f.ministry, metric:f.metric } }], function(){ T.scoreForm=null; showMsg(t('Saved')); }); });
  id('lmScoreDel', function(){ if(!gpAsk_(t('Take this number off the scorecard? Its weeks of numbers go with it.'))) return; lmCall_('deleteLeadScore',[T.scoreForm.id], function(){ T.scoreForm=null; }); });
  root.querySelectorAll('[data-lmval]').forEach(function(el){ el.onchange=function(){ var p=el.getAttribute('data-lmval').split('|'); lmCall_('saveLeadScoreValue',[p[0], p[1], el.value.trim()]); }; });
  on('[data-lmscoredrop]', function(b){ var m=M.score.filter(function(x){ return x.id===b.getAttribute('data-lmscoredrop'); })[0]; if(!m) return; var w=M.weeks[1]||M.weeks[0], v=m.vals[w.key];
    lmDrop_(gpT('Scorecard: {name}',{name:m.name}), lmGoalText_(m)+' · '+gpT('W{n}',{n:w.week})+': '+lmNum_(v)); });
  /* rocks */
  on('[data-lmrq]', function(b){ T.rockQ=b.getAttribute('data-lmrq'); T.rockForm=null; render(); });
  id('lmRockAdd', function(){ var Q=lmQ_(T.rockQ); T.rockForm={ id:'', title:'', owner:'', note:'', status:'on', year:Q.year, q:Q.q }; render(); });
  var rockOf=function(rid){ return (M.rocks||[]).filter(function(x){ return x.id===rid; })[0]; };
  on('[data-lmrockedit]', function(b){ var r=rockOf(b.getAttribute('data-lmrockedit')); if(r){ T.rockForm={ id:r.id, title:r.title, owner:r.owner||'', okrId:r.okrId||'', note:r.note||'', status:r.status, year:r.year, q:r.q }; render(); } });
  root.querySelectorAll('[data-lmrf]').forEach(function(el){ var k=el.getAttribute('data-lmrf'); var set=function(){ if(T.rockForm) T.rockForm[k]=el.value; }; if(el.tagName==='SELECT') el.onchange=set; else el.oninput=set; });
  id('lmRockCancel', function(){ T.rockForm=null; render(); });
  id('lmRockSave', function(){ var f=T.rockForm; if(!String(f.title||'').trim()){ showMsg(t('Give it a name first.')); return; } lmCall_('saveLeadRock',[f], function(){ T.rockForm=null; showMsg(t('Saved')); }); });
  id('lmRockDel', function(){ if(!gpAsk_(t('Delete this rock?'))) return; lmCall_('deleteLeadRock',[T.rockForm.id], function(){ T.rockForm=null; }); });
  on('[data-lmrockst]', function(b){ var p=b.getAttribute('data-lmrockst').split('|'), r=rockOf(p[0]); if(!r || r.status===p[1]) return; lmCall_('saveLeadRock',[Object.assign({}, r, { status:p[1] })]); });
  on('[data-lmrockdrop]', function(b){ var r=rockOf(b.getAttribute('data-lmrockdrop')); if(r) lmDrop_(gpT('Rock off track: {title}',{title:r.title}), (r.owner ? staffName_(r.owner)+'. ' : '')+(r.note||'')); });
  /* headlines */
  on('[data-lmhk]', function(b){ T.hlKind=b.getAttribute('data-lmhk'); render(); });
  id('lmHlAdd', function(){ var v=(T.d.hl||'').trim(); if(!v) return; lmCall_('saveLeadHeadline',[{ text:v, kind:T.hlKind==='hard'?'hard':'good' }], function(){ T.d.hl=''; }); });
  enter('lmHlText', 'lmHlAdd');
  on('[data-lmhldel]', function(b){ lmCall_('deleteLeadHeadline',[b.getAttribute('data-lmhldel')]); });
  on('[data-lmhldrop]', function(b){ var x=M.headlines.filter(function(q){ return q.id===b.getAttribute('data-lmhldrop'); })[0]; if(x) lmDrop_(x.text, ''); });
  /* to-dos */
  var taskOf=function(key){ var p=key.split('|'), c=(S.lead.cards||[]).filter(function(x){ return x.id===p[0]; })[0], tk=c && leadTasks_(c).filter(function(x){ return x.id===p[1]; })[0]; return tk ? { c:c, tk:tk } : null; };
  root.querySelectorAll('[data-lmtick]').forEach(function(el){ el.onchange=function(){ var x=taskOf(el.getAttribute('data-lmtick')); if(x) lmSaveTask_(x.c.id, x.tk, { done:el.checked }); }; });
  on('[data-lmcarry]', function(b){ var x=taskOf(b.getAttribute('data-lmcarry')); if(!x) return; var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+7); lmSaveTask_(x.c.id, x.tk, { due:calIso_(d) }); showMsg(t('Carried on a week.'));
    if(M.run) lmPatch_({ carried:(M.run.carried||[]).concat([x.tk.id]) }); });
  on('[data-lmtododrop]', function(b){ var x=taskOf(b.getAttribute('data-lmtododrop')); if(x) lmDrop_(gpT('Not done: {text}',{text:x.tk.text}), (x.tk.owner ? staffName_(x.tk.owner)+' · ' : '')+x.c.title); });
  on('[data-lmtodoadd]', function(b){ var key=b.getAttribute('data-lmtodoadd'), v=(T.d[key]||'').trim(); if(!v){ showMsg(t('Write the to-do first.')); return; }
    lmCall_('leadMeetTodo',[{ text:v, owner:T.d['own:'+key]||'', cardId:b.getAttribute('data-lmcard')||'', cardTitle:t('Meeting to-dos') }], function(){ T.d[key]=''; T.d['own:'+key]=''; if(S.ppick['lmt_'+key]) S.ppick['lmt_'+key].q=''; showMsg(t('Added — it is in their GP Tasks.')); }); });
  root.querySelectorAll('[data-lmtodoin]').forEach(function(el){ el.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var b=root.querySelector('[data-lmtodoadd="'+el.getAttribute('data-lmtodoin')+'"]'); if(b) b.click(); } }; });
  /* past */
  root.querySelectorAll('[data-lmpast]').forEach(function(d){ d.ontoggle=function(){ if(d.open) T.pastOpen=d.getAttribute('data-lmpast'); else if(T.pastOpen===d.getAttribute('data-lmpast')) T.pastOpen=null; }; });
  /* running it */
  id('lmStart', function(){ lmCall_('leadMeetStart',[], function(d){ T.set=null; if(d.already) showMsg(t('A meeting is already going — you’ve joined it.')); window.scrollTo(0,0); }); });
  var r=M.run; if(!r){ return; }
  lmTick_();
  var goPart=function(n){ lmCall_('leadMeetUpdate',[{ part:n }], function(){ window.scrollTo(0,0); }); };
  id('lmNext', function(){ goPart(r.part+1); });
  id('lmBack', function(){ goPart(r.part-1); });
  on('[data-lmpart]', function(b){ var n=Number(b.getAttribute('data-lmpart')); if(n!==r.part) goPart(n); });
  id('lmRefresh', function(){ lmLoad_(true); showMsg(t('Checking…')); });
  id('lmCancel', function(){ if(!gpAsk_(t('Cancel this meeting? Nothing is recorded. The to-dos and cards already made stay.'))) return; lmCall_('leadMeetEnd',[{ cancel:true }], function(){ window.scrollTo(0,0); }); });
  id('lmEnd', function(){ lmCall_('leadMeetEnd',[{}], function(d){ T.sec='past'; T.pastOpen=d.ended||null; showMsg(t('Meeting ended — it is in Past meetings.')); window.scrollTo(0,0); try{ gpConfetti(document.getElementById('leadMeet')); }catch(e){} }); });
  on('[data-lmhere]', function(b){ var pid=b.getAttribute('data-lmhere'), here=(r.present||[]).slice(), i=here.indexOf(pid); if(i>-1) here.splice(i,1); else here.push(pid); lmPatch_({ present:here }); });
  /* issues */
  on('[data-lmrank]', function(b){ var cid=b.getAttribute('data-lmrank'), issues=lmIssues_(), top=(r.top||[]).filter(function(x){ return issues.some(function(c){ return c.id===x; }); }), i=top.indexOf(cid);
    if(i>-1) top.splice(i,1); else { if(top.length>=3){ showMsg(t('Three at a time. Tap one to take it off first.')); return; } top.push(cid); }
    lmPatch_({ top:top }); });
  on('[data-lmtopic]', function(b){ var x=(T.sug||[])[Number(b.getAttribute('data-lmtopic'))]; if(x) lmDrop_(x, ''); });
  id('lmWork', function(){ lmCall_('leadMeetUpdate',[{ issue:r.top[0] }], function(){ window.scrollTo(0,0); }); });
  var idn=document.getElementById('lmIdentify'); if(idn) idn.onchange=function(){ lmCall_('leadMeetUpdate',[{ identify:idn.value }], null, true); };
  id('lmIssueBack', function(){ lmCall_('leadMeetUpdate',[{ issue:'' }]); });
  id('lmSolve', function(){ var cid=r.issue, dec=(T.d['decision:'+cid]||'').trim(); if(!dec){ showMsg(t('Write the decision first.')); return; }
    lmCall_('leadMeetSolve',[{ cardId:cid, issue:T.d['identify:'+cid]||'', decision:dec }], function(){ delete T.d['decision:'+cid]; delete T.d['identify:'+cid]; showMsg(t('Solved. On to the next.')); window.scrollTo(0,0); }); });
  /* wrap up */
  id('lmMsgAdd', function(){ var v=(T.d.msg||'').trim(); if(!v) return; lmCall_('leadMeetUpdate',[{ messages:(r.messages||[]).concat([v]) }], function(){ T.d.msg=''; }); });
  enter('lmMsgText', 'lmMsgAdd');
  on('[data-lmmsgdel]', function(b){ var list=(r.messages||[]).slice(); list.splice(Number(b.getAttribute('data-lmmsgdel')),1); lmCall_('leadMeetUpdate',[{ messages:list }]); });
  root.querySelectorAll('[data-lmrate]').forEach(function(el){ el.onchange=function(){ var pid=el.getAttribute('data-lmrate'), x={}; x[pid]=el.value; lmCall_('leadMeetUpdate',[pid===S.me.id ? { rating:el.value } : { ratings:x }]); }; });
}
