/* ==================== The Advisory Board: invite link, the big picture, and its own room (Nov 2026, Uriah) ====================
   "An easy link to send our board people to sign up with their roles and be able to view all of the base app activity,
   finances, and everything — full access, not admin control, but full oversight of the whole base … Even a special
   My Ministry thing for them, similar to our leadership team, where we have projects and tasks and rocks — we'll try to
   run our board by the EOS system too."

   Four views (BD_VIEWS), the bottom bar's tabs for a board member's own sign-in and ☰ → 🛡️ Advisory Board for a staff
   member who is also on the board (or an admin), who gets the same four as a row on top (bdSegHtml_):
     bdover  Overview — one getBoardOverview: both campuses and YWAM GP as a whole. The headline figures are rolled up
             here with rollup.js from what getData gives everyone (baseR, repHealth_); the Scorecards' ✓ / ✗ from the
             goals in metricOverrides; rocks, numbers in, who is here, the balance and leadership's meeting from the call.
     bdcamp  Campuses → a department → a ministry: its Scorecard (scoreBoardHtml_, read-only) and Rocks (rockHtml_ with
             no controls), who leads it, how many serve, its page in the quarterly report; and a campus's leadership team
             as it runs itself (getBoardLeadership: Scorecard, rocks, Kanban, past meetings) — all to read.
     bdfin   Finances — the finance tool's Dashboard for either campus, read-only (fin2FrameHtml_).
     bdroom  Board room — the leadership team's own tools (27-meeting.js, the Kanban in 07-health-leave.js) run for the
             board: while this view is open brOn_() is true, run() sends those calls through `boardRoom`, and brSync_
             swaps S.lead / S.meet / … with the campus's so neither ever shows in the other's place.
   Nothing here can change a campus: the only writes are the board room's, on the board's own blobs.
   The invite page (bdInviteHtml_, S.bdInv) and Admin → Advisory Board's invite card are here too. */
var BD_VIEWS=['bdover','bdcamp','bdfin','bdroom','bdinvite'];
/* the server's BOARD_ROOM_FNS, as a map — tests/test-board-room.mjs fails if the two drift */
var BR_FNS={ getLeadBoard:1, saveLeadCard:1, deleteLeadCard:1, saveLeadTask:1, deleteLeadTask:1, saveLeadNote:1, saveLeadSettings:1,
  getLeadMeeting:1, saveLeadMeetSettings:1, saveLeadScore:1, deleteLeadScore:1, saveLeadScoreValue:1, saveLeadRock:1, deleteLeadRock:1,
  saveLeadHeadline:1, deleteLeadHeadline:1, leadMeetStart:1, leadMeetUpdate:1, leadMeetTodo:1, leadMeetSolve:1, leadMeetEnd:1 };
var BR_KEYS=['lead','leadErr','leadLoading','leadTab','leadFilter','leadForm','leadEdit','leadOld','leadNoteDate','leadNoteTask','leadDrafts','leadShown','leadLines',
  'meet','meetErr','meetLoading','meetPend','meetSkew','mt','ltOpen','ltDraft'];
var BD_INVITE_DAYS=[3,7,14,30];

function bdT_(){ return S.bd || (S.bd={ campus:'', dept:'', min:'', sub:'', lead:{}, leadErr:{}, fin:'' }); }
function bdAuth_(){ return (S.board && S.boardAuth) ? S.boardAuth : S.auth; }
/* a staff member whose profile holds a seat on the board (the boot's `org` lists it) */
function bdSeat_(){ return !!(S.me && !S.board && !S.guest && S.org && (S.org.board||[]).some(function(b){ return b.staffId && b.staffId===S.me.id; })); }
function bdCan_(){ return !!(S.me && !S.student && !S.stuPreview && !S.demo && !S.awaiting && (S.board || (!S.guest && (bdSeat_() || S.me.isAdmin)))); }
function brOn_(){ return !!(S.brActive && S.me && S.view==='bdroom'); }
function bdMembers_(){
  var O=S.bd && S.bd.ov, list=O ? O.members : ((S.org && S.org.board) || []).map(function(b){ return { id:b.staffId || b.id, name:b.name, role:b.role, photo:b.photo }; });
  return list.map(function(m){ return { id:m.id, name:m.name, photo:m.photo||'', ministry:'', dept:'', role:m.role||'' }; }).sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
}
/* a name the roster doesn't have: a board member (by their board-room id), or — for the board's own sign-in, whose
   roster has no names — a staff member, from the Overview */
function bdName_(id){
  if(!id) return '';
  var O=S.bd && S.bd.ov; if(O && O.names && O.names[id]) return O.names[id];
  var m=bdMembers_().filter(function(x){ return x.id===id; })[0];
  return m ? m.name : '';
}
function bdOpen_(view){ S.menuOpen=false; S.person=null; S.view=view||'bdover'; renderMenu(); render(); window.scrollTo(0,0); }
/* in or out of the board room: the leadership tools' state swaps with the campus's, and nothing in flight carries over */
function brSync_(){
  /* an invite opened while signed in as staff: its page, once, as soon as both the boot and the invite have landed */
  var V=S.bdInv; if(V && V.info && !V.shown && S.me && !S.board && !S.guest && !S.student && !S.awaiting && !S.bootStale){ V.shown=true; S.view='bdinvite'; }
  var want=S.view==='bdroom' && bdCan_();
  if(!!S.brActive===want) return;
  var st=S.brStash || (S.brStash={ room:{}, campus:{} }), leave=want ? 'campus' : 'room', enter=want ? 'room' : 'campus';
  st[leave]={}; BR_KEYS.forEach(function(k){ st[leave][k]=S[k]; });
  BR_KEYS.forEach(function(k){ S[k]=st[enter][k]; });
  clearTimeout(S.meetPendT); S.busy=false; S.meetBusy=false; S.brActive=want;
  if(want && !S.leadTab) S.leadTab='meet';
}
function bdLoad_(force){
  var B=bdT_(), a=bdAuth_(); if(!a || !a.user || B.loading || (!force && (B.ov || B.err))) return;
  B.loading=true; B.err='';
  run('getBoardOverview',[a.user,a.pin],function(d){ B.loading=false;
    if(d && d.ok){ B.ov=d; if(!B.campus) B.campus=(S.me && !S.board && S.me.campus) || CAMPUSES[0].id; }
    else B.err=(d && d.err==='not_authorized') ? t('This part is for the Advisory Board.') : t('Could not load');
    render(); }, function(e){ B.loading=false; B.err=(e && e.message) || t('Connection problem — try again.'); render(); });
  if(!S.org) orgLoad_();
}

/* ---------- small figures, worked out from what the page already has ---------- */
function bdQ_(){ var O=bdT_().ov; return { year:O.year, q:O.q }; }
function bdDepts_(campus){ return getDepartments(campus)||{}; }
function bdMinEntries_(campus, dept, min){
  var E=(S.base && S.base.entries && S.base.entries[campus]) || {}, out={};
  metricsFor(campus, dept, min).forEach(function(m){ var w=E[dept+'|'+min+'|'+m]; if(w) out[m]=w; });
  return out;
}
/* a ministry's Scorecard this week: how many numbers have a goal, and how many of those are on target */
function bdScore_(campus, dept, min){
  var O=bdT_().ov, goals=sbdGoals_(campus, dept, min), E=(S.base && S.base.entries && S.base.entries[campus]) || {}, n=0, on=0;
  metricsFor(campus, dept, min).forEach(function(m){ if(!goals[m]) return; n++; if(sbdOn_(goals[m], (E[dept+'|'+min+'|'+m]||{})[String(O.week)])===true) on++; });
  return { n:n, on:on };
}
function bdScoreDept_(campus, dept){ var s={ n:0, on:0 }; Object.keys(bdDepts_(campus)[dept]||{}).forEach(function(m){ var x=bdScore_(campus, dept, m); s.n+=x.n; s.on+=x.on; }); return s; }
function bdScoreCampus_(campus){ var s={ n:0, on:0 }; Object.keys(bdDepts_(campus)).forEach(function(d){ var x=bdScoreDept_(campus, d); s.n+=x.n; s.on+=x.on; }); return s; }
function bdRocks_(campus, dept, min){
  var O=bdT_().ov, Q=bdQ_();
  return (O.rocks||[]).filter(function(r){ return r.campus===campus && r.year===Q.year && r.q===Q.q && (dept==null || r.dept===dept) && (min==null || (r.ministry||'')===min); });
}
function bdRockLine_(list){ return list.length ? gpT('{d} of {n} on track',{d:rkOnTrack_(list), n:list.length}) : t('none this quarter'); }
function bdNumMins_(campus, dept){ return Object.keys(bdDepts_(campus)[dept]||{}).filter(function(m){ return !numbersExempt_(dept, m); }); }
function bdNumbers_(campus, dept){
  var O=bdT_().ov, lg=((O.campuses[campus]||{}).logged||{})[O.week]||[], n=0, inN=0;
  (dept ? [dept] : Object.keys(bdDepts_(campus))).forEach(function(d){ bdNumMins_(campus, d).forEach(function(m){ n++; if(lg.indexOf(d+'|'+m)>-1) inN++; }); });
  return { n:n, inN:inN };
}
function bdMoney_(v){ return '$'+Math.round(Number(v)||0).toLocaleString('en-US'); }
function bdTile_(label, big, sub, go){
  return '<'+(go ? 'button data-bdgo="'+esc(go)+'"' : 'div')+' class="pulseTile bdTile'+(go?' go':'')+'"><div class="pulseLabel">'+esc(label)+'</div><div class="pulseBig">'+big+'</div>'+(sub ? '<div class="pulseSub">'+sub+'</div>' : '')+'</'+(go?'button':'div')+'>';
}
function bdLine_(icon, label, value, go, cls){
  return '<'+(go ? 'button data-bdgo="'+esc(go)+'"' : 'div')+' class="bdLine'+(cls?' '+cls:'')+'"><span class="bdLineL"><span aria-hidden="true">'+icon+'</span> '+esc(label)+'</span><b class="bdLineV">'+value+'</b>'+(go ? '<span class="ooChev" aria-hidden="true">›</span>' : '')+'</'+(go?'button':'div')+'>';
}

/* ---------- the four tabs, for a staff member on the board (the bottom bar has them in the board's own sign-in) ---------- */
function bdSegHtml_(){
  if(S.board) return '';
  return '<button class="linkbtn" id="bdBackHome" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>'+
    '<div class="leadFilters bdSeg" role="tablist">'+[['bdover','🌏',t('Overview')],['bdcamp','🏠',t('Campuses')],['bdfin','💵',t('Finances')],['bdroom','🛡️',t('Board room')]].map(function(x){
      return '<button class="leadSeg'+(S.view===x[0]?' on':'')+'" role="tab" data-bdtab="'+x[0]+'"><span aria-hidden="true">'+x[1]+'</span> '+esc(x[2])+'</button>'; }).join('')+'</div>';
}
function bdPageHtml_(){
  if(S.view==='bdinvite') return bdInviteStaffHtml_();
  if(!bdCan_()) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('This part is for the Advisory Board.'))+'</p></div>';
  var B=bdT_(), h=bdSegHtml_();
  if(S.view==='bdroom') return h+bdRoomHtml_();
  bdLoad_();
  if(!B.ov || !S.base) return h+'<div class="card" id="bdLoading"><p class="sub" style="margin:0">'+esc(B.err || t('Loading…'))+'</p>'+(B.err ? '<button class="btn ghost" id="bdRetry">'+esc(t('Try again'))+'</button>' : '')+'</div>';
  return h+(S.view==='bdcamp' ? bdCampHtml_() : S.view==='bdfin' ? bdFinHtml_() : bdOverHtml_());
}

/* ==================== Overview: the big picture ==================== */
function bdFiguresHtml_(ids){
  var R=baseR(), O=bdT_().ov, q=O.q-1, mix=R.staffBreakdown(ids), hs=repHealth_(R, ids, q), n=R.surveyRows(ids, undefined, q).length, sal=R.headlineFor(ids, 'Salvations', q), salY=R.headlineFor(ids, 'Salvations');
  var h=bdTile_(t('Staff'), String(R.totalStaff(ids)), mix ? esc(gpT('{k} Khmer · {i} international',{k:mix.khmer, i:mix.international})) : '');
  h+=bdTile_(t('Staff Health Score'), hs===null ? '—' : hs.toFixed(1)+'<small>/10</small>', esc(hs===null ? gpT('needs {n} check-ins or more',{n:REP_MIN_ANSWERS}) : gpT('{n} check-ins · Q{q}',{n:n, q:O.q})));
  h+=bdTile_(t('Salvations'), sal==null ? '—' : fmt(sal), esc(gpT('Q{q} · {n} this year',{q:O.q, n:salY==null ? 0 : fmt(salY)})));
  h+=bdTile_(t('Leadership school students'), fmt(R.ldStudents(ids, q)||0), esc(gpT('{n} graduated this year',{n:fmt(R.ldGraduates(ids)||0)})));
  h+=bdTile_(t('Community school students'), fmt(R.communityStudents(ids, q)||0), esc(gpT('Q{q}',{q:O.q})));
  return h;
}
function bdOverHtml_(){
  var B=bdT_(), O=B.ov, all=CAMPUSES.map(function(c){ return c.id; });
  var h='<div id="bdOver"><div class="bdHead"><div><h2>🛡️ '+esc(t('The big picture'))+'</h2><p class="sub">'+esc(gpT('All of YWAM GP · week {wk} · Q{q} {year}',{wk:O.week, q:O.q, year:O.year}))+
    (O.me && O.me.member ? ' · '+esc(gpT('You: {role}',{role:t(O.me.role)})) : '')+'</p></div><button class="btn ghost small" id="bdRefresh">↻ '+esc(t('Check again'))+'</button></div>';
  h+='<div class="card bdAll" id="bdAll"><div class="goalCardTitle" style="margin-bottom:8px">🌏 '+esc(t('YWAM GP'))+'</div><div class="pulseGrid bdTiles">'+bdFiguresHtml_(all)+'</div></div>';
  h+='<div class="bdGrid">';
  CAMPUSES.forEach(function(c){
    var C=O.campuses[c.id]||{}, sc=bdScoreCampus_(c.id), rocks=bdRocks_(c.id), nm=bdNumbers_(c.id), depts=Object.keys(bdDepts_(c.id));
    h+='<div class="card bdCampus" data-bdcard="'+esc(c.id)+'"><div class="lmRowHead"><div class="goalCardTitle">🏠 '+esc(t(c.name))+'</div><button class="linkbtn inline" data-bdgo="camp|'+esc(c.id)+'">'+esc(t('Open'))+' ›</button></div>'+
      '<div class="pulseGrid bdTiles">'+bdFiguresHtml_([c.id])+
      bdTile_(t('On campus tonight'), C.here ? String(C.here.count) : '—', C.here && C.here.capacity!=null ? esc(gpT('{pct}% of beds full',{pct:C.here.capacity})) : esc(gpT('{n} staff away this week',{n:C.away||0})))+'</div>';
    /* Scorecards */
    h+='<div class="bdBlock" data-bdblock="score">'+bdLine_('📊', t('Scorecards'), sc.n ? esc(gpT('{d} of {n} numbers on target this week',{d:sc.on, n:sc.n})) : esc(t('no goals set yet')), 'camp|'+c.id, sc.n ? (sc.on===sc.n ? 'on' : sc.on*2<sc.n ? 'off' : '') : '')+'<div class="bdSubs">'+
      depts.map(function(d){ var x=bdScoreDept_(c.id, d); return x.n ? '<button class="bdSub" data-bdgo="camp|'+esc(c.id)+'|'+esc(d)+'"><span>'+esc(t(d))+'</span><b>'+x.on+' / '+x.n+'</b></button>' : ''; }).join('')+'</div></div>';
    /* Rocks */
    h+='<div class="bdBlock" data-bdblock="rocks">'+bdLine_('🪨', t('Rocks'), esc(bdRockLine_(rocks)), 'camp|'+c.id, rocks.length ? (rkOnTrack_(rocks)===rocks.length ? 'on' : '') : '')+'<div class="bdSubs">'+
      depts.map(function(d){ var l=bdRocks_(c.id, d); return l.length ? '<button class="bdSub" data-bdgo="'+(d===BL_DEPT ? 'lead|'+esc(c.id) : 'camp|'+esc(c.id)+'|'+esc(d))+'"><span>'+esc(t(d))+'</span><b>'+rkOnTrack_(l)+' / '+l.length+'</b></button>' : ''; }).join('')+'</div></div>';
    /* numbers in, the balance, leadership's meeting */
    h+='<div class="bdBlock">'+bdLine_('📥', t('Numbers in on time'), esc(gpT('{d} of {n} ministries this week',{d:nm.inN, n:nm.n})), 'camp|'+c.id, nm.n && nm.inN===nm.n ? 'on' : '');
    h+=bdLine_('💵', t('Liquid balance'), C.fin ? esc(bdMoney_(C.fin.total))+' <small>'+esc(gpT('entered {date}',{date:hospDate_(C.fin.asOf)}))+' · '+(C.fin.reconciled ? '✓ '+esc(gpT('reconciled {date}',{date:hospDate_(C.fin.reconciled)})) : '⚠️ '+esc(t('not reconciled')))+'</small>' : esc(t('not entered yet')), 'fin|'+c.id);
    var M=C.meet||{}, L=M.last;
    h+=bdLine_('🧭', t('Leadership meeting'), L ? esc(hospDate_(L.date))+' <small>'+(L.avg!=null ? '⭐ '+esc(gpT('rated {n}',{n:L.avg})) : esc(t('not rated')))+(L.todoPct!=null ? ' · ☑️ '+esc(gpT('{pct}% of To-Dos done',{pct:L.todoPct})) : '')+'</small>' : esc(t('no meeting on record yet')), 'lead|'+c.id);
    h+=bdLine_('🧩', t('Leadership’s Issues'), esc(gpT('{n} open on their list',{n:M.issues||0})), 'lead|'+c.id);
    var debt=0, hasDebt=false; Object.keys(C.debt||{}).forEach(function(d){ hasDebt=true; debt+=Number(C.debt[d].value)||0; });
    h+=bdLine_('☕', t('1-on-1s held or set this month'), String(C.oneOnOnes||0), '')+bdLine_('🧾', t('Staff debt'), hasDebt ? esc(bdMoney_(debt)) : esc(t('not entered yet')), 'fin|'+c.id)+'</div></div>';
  });
  h+='</div><p class="hint" id="bdFine">'+esc(t('The board reads what each campus’s leadership team reads, for both campuses, and changes nothing outside its own Board room. Health is a campus average, shown only from three check-ins or more — nobody’s own answers, 1-on-1s, prayer requests, support or HR papers are ever shown here.'))+'</p>';
  return h+'</div>';
}

/* ==================== Campuses → a department → a ministry ==================== */
function bdCampusSegHtml_(attr, cur){
  return '<div class="campusSeg bdCampusSeg">'+CAMPUSES.map(function(c){ return '<button class="campusBtn'+(cur===c.id?' on':'')+'" '+attr+'="'+esc(c.id)+'">'+esc(t(c.short))+'</button>'; }).join('')+'</div>';
}
function bdCampHtml_(){
  var B=bdT_(), O=B.ov, c=B.campus || CAMPUSES[0].id, deps=bdDepts_(c);
  var h='<div id="bdCamp">'+bdCampusSegHtml_('data-bdcampus', c);
  if(B.sub==='lead') return h+bdLeadHtml_(c)+'</div>';
  if(B.dept && deps[B.dept] && B.min && deps[B.dept][B.min]) return h+bdMinHtml_(c, B.dept, B.min)+'</div>';
  if(B.dept && deps[B.dept]) return h+bdDeptHtml_(c, B.dept)+'</div>';
  var C=O.campuses[c]||{}, sc=bdScoreCampus_(c), rocks=bdRocks_(c), nm=bdNumbers_(c), oc=orgCampus_(c);
  h+='<div class="pulseGrid bdTiles" style="margin-bottom:12px">'+bdTile_(t('Staff'), String(C.staff||0), esc(gpT('{n} away this week',{n:C.away||0})))+
    bdTile_(t('Scorecards'), sc.n ? sc.on+' / '+sc.n : '—', esc(t('on target this week')))+bdTile_(t('Rocks'), rocks.length ? rkOnTrack_(rocks)+' / '+rocks.length : '—', esc(gpT('on track · Q{q}',{q:O.q})))+
    bdTile_(t('Numbers in'), nm.inN+' / '+nm.n, esc(t('ministries this week')))+'</div>';
  h+=orgCltCardHtml_(c);
  h+='<button class="lmGo" id="bdLeadGo" data-bdgo="lead|'+esc(c)+'"><span class="lmGoMain">🧭 '+esc(t('The leadership team’s Scorecard, Rocks and meetings'))+'<span class="lmGoSub">'+esc(t('To read — as they run their week'))+'</span></span><span class="lmGoOpen">'+esc(t('Open'))+' ›</span></button>';
  h+='<div class="card" id="bdDepts"><div class="mentorLabel">🗂️ '+esc(t('Departments'))+'</div>';
  Object.keys(deps).filter(function(d){ return d!==BL_DEPT; }).forEach(function(d){
    var s=bdScoreDept_(c, d), rk=bdRocks_(c, d), n2=bdNumbers_(c, d), dirs=oc ? oc.clt.filter(function(p){ return p.dept===d; }).map(function(p){ return p.name; }) : [];
    h+='<button class="bdRow" data-bddept="'+esc(d)+'"><span class="bdRowMain"><b>'+esc(t(d))+'</b><small>'+esc(dirs.length ? gpT('Director: {name}',{name:dirs.join(', ')}) : t('No director named yet'))+' · '+esc(gpT('{n} staff',{n:(oc && oc.deptStaff && oc.deptStaff[d])||0}))+'</small>'+
      '<small>📊 '+(s.n ? s.on+' / '+s.n : '—')+' · 🪨 '+(rk.length ? rkOnTrack_(rk)+' / '+rk.length : '—')+' · 📥 '+n2.inN+' / '+n2.n+'</small></span><span class="ooChev" aria-hidden="true">›</span></button>';
  });
  h+='</div><button class="btn ghost" id="bdBaseGo">📈 '+esc(t('The base’s figures, section by section'))+'</button>';
  return h+'</div>';
}
function bdCrumbHtml_(label, to){ return '<button class="linkbtn bdCrumb" data-bdup="'+esc(to)+'" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(label)+'</button>'; }
function bdDeptHtml_(c, dept){
  var O=bdT_().ov, deps=bdDepts_(c), own=bdRocks_(c, dept, ''), people=(O.campuses[c]||{}).people||{}, oc=orgCampus_(c);
  var h=bdCrumbHtml_(t(campusName(c)), 'campus')+'<h2 class="bdTitle">'+esc(t(dept))+'</h2>';
  h+='<div class="card" id="bdDeptRocks"><div class="lmRowHead"><div class="goalCardTitle">🪨 '+esc(gpT('The department’s rocks · Q{q}',{q:O.q}))+'</div><span class="hint">'+esc(bdRockLine_(own))+'</span></div>'+
    (own.length ? own.map(function(r){ return rockHtml_(r, { who:true }); }).join('') : '<p class="sub" style="margin:0">'+esc(t('None set for this quarter.'))+'</p>')+'</div>';
  h+='<div class="card" id="bdMins"><div class="mentorLabel">'+esc(t('Ministries'))+'</div>';
  Object.keys(deps[dept]).forEach(function(m){
    var s=bdScore_(c, dept, m), rk=bdRocks_(c, dept, m), lead=(oc && oc.leaders && oc.leaders[dept+'|'+m]) || [];
    h+='<button class="bdRow" data-bdmin="'+esc(m)+'"><span class="bdRowMain"><b>'+gpMinEmoji(m)+esc(t(m))+'</b><small>'+(lead.length ? '👑 '+esc(lead.join(', ')) : esc(t('No leader named yet')))+' · '+esc(gpT('{n} serve',{n:people[dept+'|'+m]||0}))+'</small>'+
      '<small>📊 '+(s.n ? esc(gpT('{d} of {n} on target',{d:s.on, n:s.n})) : esc(t('no goals set yet')))+' · 🪨 '+esc(bdRockLine_(rk))+'</small></span><span class="ooChev" aria-hidden="true">›</span></button>';
  });
  return h+'</div>';
}
function bdMinHtml_(c, dept, min){
  var O=bdT_().ov, people=(O.campuses[c]||{}).people||{}, oc=orgCampus_(c), lead=(oc && oc.leaders && oc.leaders[dept+'|'+min]) || [], rk=bdRocks_(c, dept, min), E=bdMinEntries_(c, dept, min), q=O.q-1;
  var h=bdCrumbHtml_(t(dept), 'dept')+'<div class="card bdMinHead" id="bdMin" data-bdminkey="'+esc(dept+'|'+min)+'"><h2 class="bdTitle" style="margin:0 0 4px">'+gpMinEmoji(min)+esc(t(min))+'</h2>'+
    '<div class="rowSub">'+esc(t(dept))+' · '+esc(t(campusName(c)))+'</div>'+
    '<div class="lbWho"><span>👑 '+esc(t('Led by'))+'</span><b>'+esc(lead.length ? lead.join(', ') : t('No leader named yet'))+'</b></div>'+
    '<div class="lbWho"><span>'+esc(t('Serving'))+'</span><b>'+esc(gpT('{n} people',{n:people[dept+'|'+min]||0}))+'</b></div>'+
    '<button class="btn ghost small" id="bdMinReport">📄 '+esc(t('Its page in the quarterly report'))+'</button></div>';
  var sb=scoreBoardHtml_(c, dept, min, { entries:E }, O.week, true);
  h+=sb || '<div class="card"><p class="sub" style="margin:0">'+esc(t('This ministry has no numbers on its Scorecard.'))+'</p></div>';
  /* period totals: each number by its own rule (sum, latest or average) */
  var mets=metricsFor(c, dept, min).filter(function(m){ return E[m]; });
  if(mets.length) h+='<div class="card" id="bdTotals"><div class="goalCardTitle" style="margin-bottom:6px">'+esc(t('This quarter and this year'))+'</div><div class="bdTable" role="table"><div class="bdTr bdTh" role="row"><span role="columnheader">'+esc(t('Number'))+'</span><span role="columnheader">'+esc(gpT('Q{q}',{q:O.q}))+'</span><span role="columnheader">'+esc(t('Year to date'))+'</span></div>'+
    mets.map(function(m){ var a=aggregate(E[m], modeOf(m), q), y=aggregate(E[m], modeOf(m)); return '<div class="bdTr" role="row"><span role="cell">'+esc(t(m))+'</span><span role="cell">'+(a==null ? '—' : fmt(a, m))+'</span><span role="cell">'+(y==null ? '—' : fmt(y, m))+'</span></div>'; }).join('')+'</div></div>';
  h+='<div class="card" id="bdMinRocks"><div class="lmRowHead"><div class="goalCardTitle">🪨 '+esc(gpT('Rocks · Q{q}',{q:O.q}))+'</div><span class="hint">'+esc(bdRockLine_(rk))+'</span></div>'+
    (rk.length ? rk.map(function(r){ return rockHtml_(r, { who:true }); }).join('') : '<p class="sub" style="margin:0">'+esc(t('None set for this quarter.'))+'</p>')+'</div>';
  return h;
}

/* ---------- a campus's leadership team as it runs itself: to read ---------- */
function bdLeadLoad_(c, force){
  var B=bdT_(), a=bdAuth_(); if(B.leadLoading || (!force && (B.lead[c] || B.leadErr[c]))) return;
  B.leadLoading=true; B.leadErr[c]='';
  run('getBoardLeadership',[a.user,a.pin,c],function(d){ B.leadLoading=false; if(d && d.ok) B.lead[c]=d; else B.leadErr[c]=t('Could not load'); render(); },
    function(e){ B.leadLoading=false; B.leadErr[c]=(e && e.message) || t('Connection problem — try again.'); render(); });
}
function bdLeadHtml_(c){
  var B=bdT_(), M=B.lead[c], O=B.ov;
  var h=bdCrumbHtml_(t(campusName(c)), 'campus')+'<div id="bdLead" data-bdlead="'+esc(c)+'"><h2 class="bdTitle">🧭 '+esc(gpT('{campus} · leadership team',{campus:t(campusName(c))}))+'</h2>';
  bdLeadLoad_(c);
  if(!M) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(B.leadErr[c] || t('Loading…'))+'</p>'+(B.leadErr[c] ? '<button class="btn ghost" id="bdLeadRetry">'+esc(t('Try again'))+'</button>' : '')+'</div></div>';
  var secs=[['score','📊',t('Scorecard')],['rocks','🪨',t('Rocks')],['kanban','🗂️',t('Issues and To-Dos')],['past','🗂️',t('Past meetings')]], sec=secs.some(function(x){ return x[0]===B.leadSec; }) ? B.leadSec : 'score';
  h+='<div class="lmSecs" role="tablist">'+secs.map(function(x){ return '<button class="lmSec'+(sec===x[0]?' on':'')+'" role="tab" data-bdleadsec="'+x[0]+'"><span aria-hidden="true">'+x[1]+'</span> '+esc(x[2])+'</button>'; }).join('')+'</div>';
  if(sec==='score'){
    if(!(M.score||[]).length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('No numbers on the scorecard yet.'))+'</p></div>';
    (M.score||[]).forEach(function(m){
      h+='<div class="card slim lmScoreRow" data-bdscore="'+esc(m.id)+'"><div class="lmRowHead"><div style="min-width:0"><b class="lmName">'+esc(m.name)+'</b><div class="rowSub">'+(m.owner ? '👤 '+esc(firstName_(staffName_(m.owner))) +' · ' : '')+esc(lmGoalText_(m))+
        (m.src==='metric' && m.metric ? ' · 🔗 '+esc(t(m.metric.ministry)+' › '+t(m.metric.metric)) : '')+'</div></div></div><div class="lmWeeks">'+
        (M.weeks||[]).map(function(w, i){ var v=m.vals ? m.vals[w.key] : null, on=lmOn_(m, v), lab=i===0 ? t('This week') : i===1 ? t('Last week') : gpT('W{n}',{n:w.week});
          return '<div class="lmWk'+(on===true?' on':on===false?' off':'')+'"><span class="lmWkLab">'+esc(lab)+'</span><span class="lmWkVal">'+esc(lmNum_(v))+'</span><span class="lmMark" aria-label="'+esc(on===true ? t('On track') : on===false ? t('Off track') : '')+'">'+(on===true?'✓':on===false?'✗':'·')+'</span></div>'; }).join('')+'</div></div>';
    });
  } else if(sec==='rocks'){
    var Q=bdQ_(), list=(M.rocks||[]).filter(function(r){ return r.year===Q.year && r.q===Q.q; });
    h+='<div class="card"><div class="lmRowHead"><div class="goalCardTitle">🪨 '+esc(gpT('Rocks · Q{q}',{q:O.q}))+'</div><span class="hint">'+esc(bdRockLine_(list))+'</span></div>'+
      (list.length ? list.map(function(r){ return rockHtml_(r, { who:true }); }).join('') : '<p class="sub" style="margin:0">'+esc(t('None set for this quarter.'))+'</p>')+'</div>';
  } else if(sec==='kanban'){
    var K=M.board||{}, cards=K.cards||[];
    (K.cols||[]).forEach(function(col){
      var mine=cards.filter(function(x){ return x.col===col.id; }); if(col.done) mine=mine.sort(function(a,b){ return String(b.doneAt||'').localeCompare(String(a.doneAt||'')); }).slice(0, 12);
      h+='<details class="card bdKan" data-bdcol="'+esc(col.id)+'"'+(col.done ? '' : ' open')+'><summary class="goalCardTitle">'+esc(col.title)+' · '+mine.length+'</summary>'+
        (mine.length ? mine.map(function(x){ var tk=(x.tasks||[]), dn=tk.filter(function(y){ return y.done; }).length;
          return '<div class="bdKanCard"><b>'+(x.type==='project'?'🔨 ':'💬 ')+esc(x.title)+'</b><div class="rowSub">'+(x.owner ? '👤 '+esc(firstName_(staffName_(x.owner)))+' · ' : '')+(x.due ? '📅 '+esc(hospDate_(x.due))+' · ' : '')+(tk.length ? '☑️ '+dn+' / '+tk.length : esc(t('no To-Dos')))+'</div>'+
            (x.notes ? '<div class="rowSub rkNote">'+esc(x.notes)+'</div>' : '')+'</div>'; }).join('') : '<p class="hint" style="margin:6px 0 0">'+esc(t('Nothing here yet.'))+'</p>')+'</details>';
    });
  } else {
    var old=S.meet, oldT=S.mt; S.meet=M; S.mt={ sec:'past', d:{} };
    try { h+=lmPastHtml_(); } finally { S.meet=old; S.mt=oldT; }
  }
  return h+'<p class="hint">'+esc(t('To read only: nothing here can be changed from the board’s side.'))+'</p>'+lmFineHtml_()+'</div>';
}

/* ==================== Finances ==================== */
function bdFinHtml_(){
  var B=bdT_(), c=B.fin || B.campus || CAMPUSES[0].id;
  return '<div id="bdFin">'+bdCampusSegHtml_('data-bdfincampus', c)+'<p class="hint" style="margin:0 0 8px">'+esc(t('The Finances office’s dashboard, to read. Only the office can enter or change anything.'))+'</p>'+fin2FrameHtml_('dash', c)+'</div>';
}

/* ==================== Board room ==================== */
function bdRoomHtml_(){
  return '<div id="bdRoom"><div class="bdHead"><div><h2>🛡️ '+esc(t('Board room'))+'</h2><p class="sub">'+esc(t('The Advisory Board’s own meeting, Rocks, Scorecard, Issues and To-Dos. Only board members (and admins) can open this.'))+'</p></div></div>'+
    leadSectionHtml_()+'</div>';
}

/* ==================== the invite link: teams.html?board=<48 hex> ==================== */
function bdInviteTake_(){
  var tok='';
  try { var q=new URLSearchParams(location.search||''); tok=q.get('board')||''; if(tok){ q.delete('board'); var qs=q.toString(); history.replaceState(null, '', location.pathname+(qs?'?'+qs:'')+location.hash); } } catch(e){}
  try { if(tok) sessionStorage.setItem('gp-board-invite', tok); else tok=sessionStorage.getItem('gp-board-invite')||''; } catch(e){}
  if(!/^[a-f0-9]{48}$/.test(tok)) return false;
  S.bdInv={ token:tok, info:null, err:'', f:{ name:'', email:'', phone:'', bio:'', user:'', pin:'' }, pinWay:false, busy:false, done:null };
  run('boardInviteInfo',[tok],function(d){
    if(!S.bdInv) return;
    if(d && d.ok) S.bdInv.info=d; else { S.bdInv.err=(d && d.err) || 'bad'; try { sessionStorage.removeItem('gp-board-invite'); } catch(e){} }
    render();
  }, function(){ if(S.bdInv){ S.bdInv.err='offline'; render(); } });
  return true;
}
function bdInviteDrop_(){ S.bdInv=null; try { sessionStorage.removeItem('gp-board-invite'); } catch(e){} }
var BD_INV_ERR={ invite_used:'This invite link has already been used. Ask an admin for a new one.', invite_expired:'This invite link has ended. Ask an admin for a new one.', invite_off:'This invite link was turned off. Ask an admin for a new one.',
  invite_bad:'This invite link isn’t right. Ask an admin for a new one.', used:'This invite link has already been used. Ask an admin for a new one.', expired:'This invite link has ended. Ask an admin for a new one.',
  off:'This invite link was turned off. Ask an admin for a new one.', bad:'This invite link isn’t right. Ask an admin for a new one.', offline:'No connection — try again when you are online.',
  name_required:'Add your name', email_required:'Add your email', bad_email:'That email doesn’t look right', bad_username:'Usernames are 2–20 letters or numbers', bad_pin:'The PIN must be 4 digits',
  username_taken:'That username is already taken', already_member:'You already have a sign-in for the board — sign in with it.', google:'Google sign-in didn’t work — try again.',
  staff_email:'That email belongs to a staff profile. Sign in to the app first, then open this link again — your seat is added to your profile.', staff_inactive:'That staff profile isn’t active — ask an admin.', auth:'Please sign in again' };
function bdInvRoleText_(I){ return I ? gpT('You’re invited to the YWAM GP Advisory Board as {role}',{role:t(I.role)}) : t('An invitation to the YWAM GP Advisory Board'); }
function bdInviteHtml_(){
  var V=S.bdInv, I=V.info, f=V.f, h='<div id="bdInvite">';
  gglCfg_();
  if(V.done) return h+'<h2>🛡️ '+esc(t('Welcome to the Advisory Board'))+'</h2><div class="card" id="bdInvDone"><p style="margin:0 0 10px">'+esc(gpT('{name}, your seat on the board is linked to your staff profile. Open the app as usual — you’ll find 🛡️ Advisory Board in the menu.',{name:V.done.name}))+'</p>'+
    '<button class="btn" id="bdInvToLogin">'+esc(t('Sign in'))+'</button></div></div>';
  if(V.err && !I) return h+'<h2>🛡️ '+esc(t('YWAM GP Advisory Board'))+'</h2><div class="card" id="bdInvGone"><p style="margin:0 0 10px">'+esc(t(BD_INV_ERR[V.err] || BD_INV_ERR.bad))+'</p><button class="btn ghost" id="bdInvToLogin">'+esc(t('Go to sign in'))+'</button></div></div>';
  if(!I) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div></div>';
  var google=gglOn_() && !V.pinWay;
  h+='<h2>🛡️ '+esc(bdInvRoleText_(I))+'</h2><div class="card" id="bdInvForm">'+(I.byName ? '<p class="sub" style="margin:0 0 6px">'+esc(gpT('Invited by {name}.',{name:I.byName}))+'</p>' : '')+
    '<p class="sub" style="margin:0 0 10px">'+esc(t('The board sees how the whole base is doing — every ministry, the finances, the leadership teams — and has its own room for its meetings, Rocks and Scorecard. It reads; it doesn’t run the base.'))+'</p>'+
    '<label class="f" for="bdi_name">'+esc(t('Your name'))+'</label><input type="text" id="bdi_name" data-bdif="name" maxlength="80" value="'+esc(f.name)+'" autocomplete="name">'+
    (google ? '' : '<label class="f" for="bdi_email">'+esc(t('Email'))+'</label><input type="email" id="bdi_email" data-bdif="email" maxlength="120" value="'+esc(f.email)+'" autocomplete="email">')+
    '<label class="f" for="bdi_phone">'+esc(t('Phone (optional)'))+'</label><input type="tel" id="bdi_phone" data-bdif="phone" maxlength="40" value="'+esc(f.phone)+'">'+
    '<label class="f" for="bdi_bio">'+esc(t('A short bio (optional)'))+'</label><textarea id="bdi_bio" data-bdif="bio" maxlength="600" rows="3" placeholder="'+esc(t('Who you are, in a few lines — staff see it on the YWAM GP page.'))+'">'+esc(f.bio)+'</textarea>';
  if(V.err) h+='<p class="banner" id="bdInvErr" role="alert">'+esc(t(BD_INV_ERR[V.err] || 'Could not save'))+'</p>';
  if(google){
    h+='<label class="f">'+esc(t('How you’ll sign in'))+'</label>'+gglBtnHtml_('bdInvGoogle', t('Continue with Google'))+
      (_ggl.busy ? '<p class="hint">'+esc(t('Opening Google…'))+'</p>' : '')+(S.gglHelp ? gglHelpHtml_('login') : '')+
      '<button class="linkbtn" id="bdInvPinWay">'+esc(t('No Google account? Use a username and PIN'))+'</button>';
  } else {
    h+='<label class="f" for="bdi_user">'+esc(t('Choose a username'))+'</label><input type="text" id="bdi_user" data-bdif="user" maxlength="20" value="'+esc(f.user)+'" autocapitalize="off" autocomplete="username">'+
      '<label class="f" for="bdi_pin">'+esc(t('Choose a 4-digit PIN'))+'</label><input type="password" id="bdi_pin" data-bdif="pin" inputmode="numeric" maxlength="4" value="'+esc(f.pin)+'" autocomplete="new-password">'+
      '<button class="btn" id="bdInvJoin"'+(V.busy?' disabled':'')+'>'+esc(V.busy ? t('Saving…') : t('Join the board'))+'</button>'+
      (gglOn_() ? '<button class="linkbtn" id="bdInvGoogleWay">'+esc(t('Use Continue with Google instead'))+'</button>' : '');
  }
  h+='<p class="hint" style="margin:10px 0 0">'+esc(t('Already on staff? Sign in to the app first, then open this link again — the seat is added to your profile, with the sign-in you already have.'))+'</p>'+
    '<button class="linkbtn" id="bdInvToLogin">'+esc(t('Go to sign in'))+'</button></div>';
  return h+'</div>';
}
/* signed in as staff: the seat goes on this profile */
function bdInviteStaffHtml_(){
  var V=S.bdInv, I=V && V.info;
  if(!V || !I) return '<div class="card" id="bdInvGone"><p class="sub" style="margin:0 0 10px">'+esc(t(BD_INV_ERR[V && V.err] || BD_INV_ERR.bad))+'</p><button class="btn ghost" id="bdInvClose">'+esc(t('Close'))+'</button></div>';
  return '<div id="bdInvite"><h2>🛡️ '+esc(bdInvRoleText_(I))+'</h2><div class="card" id="bdInvStaff">'+(I.byName ? '<p class="sub" style="margin:0 0 6px">'+esc(gpT('Invited by {name}.',{name:I.byName}))+'</p>' : '')+
    '<p style="margin:0 0 10px">'+esc(gpT('You’re signed in as {name}. Your seat on the board is added to this profile — no second sign-in.',{name:S.me.name}))+'</p>'+
    (V.err ? '<p class="banner" id="bdInvErr" role="alert">'+esc(t(BD_INV_ERR[V.err] || 'Could not save'))+'</p>' : '')+
    '<button class="btn" id="bdInvStaffJoin"'+(V.busy?' disabled':'')+'>'+esc(V.busy ? t('Saving…') : t('Join the board'))+'</button><button class="btn ghost" id="bdInvClose">'+esc(t('Not now'))+'</button></div></div>';
}
function bdInviteSend_(extra){
  var V=S.bdInv; if(!V || V.busy) return; V.busy=true; V.err=''; render();
  var f=V.f, p=Object.assign({ name:f.name.trim(), phone:f.phone.trim(), bio:f.bio.trim() }, extra);
  run('boardJoin',[V.token, p],function(d){
    if(!S.bdInv) return; V.busy=false;
    if(!d || !d.ok){ V.err=(d && d.err) || 'error'; if(/^invite_/.test(V.err)){ V.info=null; try { sessionStorage.removeItem('gp-board-invite'); } catch(e){} } render(); return; }
    try { sessionStorage.removeItem('gp-board-invite'); } catch(e){}
    if(d.linked){
      if(S.me && !S.board && !S.guest){ S.bdInv=null; S.org=null; S.bd=null; orgLoad_(); showMsg(t('You’re on the Advisory Board — it is in your menu.')); bdOpen_('bdover'); return; }
      if(extra.googleToken){ S.bdInv=null; _ggl.mode='login'; gglCred_({ access_token:extra.googleToken }); return; }   // their staff sign-in, with the Google sign-in just made
      V.done={ name:d.name||'' }; render(); return;
    }
    S.bdInv=null; boardEnter_(d.member, { user:d.user, pin:d.token || f.pin }); showMsg(t('Welcome to the Advisory Board'));
  }, function(){ if(S.bdInv){ V.busy=false; V.err='offline'; render(); } });
}
function bdInviteGoogle_(tok){ bdInviteSend_({ googleToken:tok }); }

/* ---------- Admin → Advisory Board: the invite card ---------- */
function bdAdminInviteHtml_(){
  var A=S.bdAdm || (S.bdAdm={ role:'Advisor', days:7, note:'', made:null, making:false }), roles=(S.adminBoard && S.adminBoard.roles) || ['President','Secretary','Treasurer','Advisor'], list=(S.adminBoard && S.adminBoard.invites) || [];
  var h='<div class="card" id="bdiForm"><div class="goalCardTitle">✉️ '+esc(t('Invite a board member'))+'</div>'+
    '<p class="looseWhy">'+esc(t('Make a link for one person and send it to them. They add their name and choose how to sign in — Google, or a username and PIN — and are on the board straight away, with this role. Someone already on staff gets the seat on their own profile.'))+'</p>'+
    '<label class="f" for="bdiRole">'+esc(t('Role on the board'))+'</label><input type="text" id="bdiRole" maxlength="40" list="bdiRoles" value="'+esc(A.role)+'"><datalist id="bdiRoles">'+roles.map(function(r){ return '<option value="'+esc(r)+'">'; }).join('')+'</datalist>'+
    '<label class="f">'+esc(t('The link works for'))+'</label><div class="deptChips">'+BD_INVITE_DAYS.map(function(n){ return '<button class="deptChip'+(A.days===n?' on':'')+'" data-bdidays="'+n+'">'+esc(gpT('{n} days',{n:n}))+'</button>'; }).join('')+'</div>'+
    '<label class="f" for="bdiNote">'+esc(t('A note for you (optional)'))+'</label><input type="text" id="bdiNote" maxlength="80" value="'+esc(A.note)+'" placeholder="'+esc(t('e.g. who it is for'))+'">'+
    '<button class="btn" id="bdiMake"'+(A.making?' disabled':'')+'>'+esc(A.making ? t('Making…') : t('Make the invite link'))+'</button></div>';
  if(A.made){
    h+='<div class="card" id="bdiMade"><div class="goalCardTitle">🔗 '+esc(t('Your invite link'))+'</div><p class="looseWhy">'+esc(gpT('For one person, as {role} — until {date}. Anyone who has the link can use it, so send it only to them.',{role:t(A.made.invite.role), date:shortDay_(new Date(A.made.invite.exp))}))+'</p>'+
      '<input type="text" id="bdiLink" readonly value="'+esc(A.made.link)+'"><div class="btnRow" style="margin-top:8px"><button class="btn" id="bdiCopy">'+esc(t('Copy link'))+'</button>'+(navigator.share ? '<button class="btn ghost" id="bdiShare">'+esc(t('Share'))+'</button>' : '')+'</div>'+
      '<p class="hint">'+esc(t('This is the only time the link is shown — copy it now. You can make another any time.'))+'</p></div>';
  }
  if(list.length) h+='<div class="card" id="bdiList"><div class="mentorLabel">'+esc(t('Invite links'))+'</div>'+list.map(function(x){
    var word={ ok:t('Open'), used:t('Used up'), expired:t('Ended'), off:t('Turned off') }[x.state] || x.state;
    return '<div class="invRow" data-bdinv="'+esc(x.id)+'"><div style="min-width:0;flex:1"><b>'+esc(x.note || t(x.role))+'</b><span class="rowSub" style="display:block">'+esc((x.note ? t(x.role)+' · ' : '')+gpT('until {date}',{date:shortDay_(new Date(x.exp))}))+'</span>'+
      (x.used.length ? '<span class="rowSub" style="display:block">✓ '+esc(x.used.map(function(u){ return u.name+(u.linked ? ' ('+t('on staff')+')' : ''); }).join(', '))+'</span>' : '')+'</div>'+
      '<span class="invState '+esc(x.state)+'">'+esc(word)+'</span>'+(x.state==='ok' ? '<button class="linkbtn" style="width:auto;margin:0 0 0 8px" data-bdioff="'+esc(x.id)+'">'+esc(t('Turn off'))+'</button>' : '')+'</div>'; }).join('')+'</div>';
  return h;
}
function bindBdAdminInvite_(){
  var A=S.bdAdm; if(!A || !document.getElementById('bdiForm')) return;
  var keep=function(){ var r=document.getElementById('bdiRole'), n=document.getElementById('bdiNote'); if(r) A.role=r.value; if(n) A.note=n.value; };
  ['bdiRole','bdiNote'].forEach(function(id){ var el=document.getElementById(id); if(el) el.oninput=keep; });
  document.querySelectorAll('[data-bdidays]').forEach(function(b){ b.onclick=function(){ keep(); A.days=Number(b.getAttribute('data-bdidays')); render(); }; });
  var mk=document.getElementById('bdiMake'); if(mk) mk.onclick=function(){ keep(); if(A.making) return; A.making=true; render();
    run('adminMakeBoardInvite',[S.auth.user,S.auth.pin,{ role:A.role, days:A.days, note:A.note }],function(d){ A.making=false;
      if(d && d.ok){ A.made={ invite:d.invite, link:location.origin+location.pathname.replace(/[^\/]*$/, '')+'teams.html?board='+d.token }; A.note=''; if(S.adminBoard) S.adminBoard.invites=d.invites; }
      else showMsg(t('Could not save'));
      render(); }, function(){ A.making=false; showMsg(t('No connection — try again when you are online.')); render(); }); };
  var cp=document.getElementById('bdiCopy'); if(cp) cp.onclick=function(){ gpCopyText_(A.made.link); };
  var sh=document.getElementById('bdiShare'); if(sh) sh.onclick=function(){ try { navigator.share({ title:t('YWAM GP Advisory Board'), url:A.made.link }); } catch(e){} };
  document.querySelectorAll('[data-bdioff]').forEach(function(b){ b.onclick=function(){
    if(!gpAsk_(t('Turn this invite link off? It stops working at once.'))) return;
    run('adminBoardInviteOff',[S.auth.user,S.auth.pin,b.getAttribute('data-bdioff')],function(d){ if(d && d.ok && S.adminBoard){ S.adminBoard.invites=d.invites; } else showMsg(t('Could not save')); render(); }); }; });
}

/* ==================== binding ==================== */
function bindBoardroom_(){
  var by=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=function(e){ gpTap(); fn(el, e); }; };
  /* the invite page (signed out, or signed in as staff) */
  var V=S.bdInv;
  if(V && document.getElementById('bdInvite')){
    document.querySelectorAll('[data-bdif]').forEach(function(el){ el.oninput=function(){ V.f[el.getAttribute('data-bdif')]=el.value; }; });
    by('bdInvGoogle', function(){ gglGo_('board'); });
    by('bdInvPinWay', function(){ V.pinWay=true; V.err=''; render(); });
    by('bdInvGoogleWay', function(){ V.pinWay=false; V.err=''; render(); });
    by('bdInvJoin', function(){ var f=V.f;
      if(!f.name.trim()){ V.err='name_required'; render(); return; }
      if(!f.email.trim()){ V.err='email_required'; render(); return; }
      bdInviteSend_({ email:f.email.trim(), username:f.user.trim(), pin:f.pin }); });
    by('bdInvStaffJoin', function(){ bdInviteSend_({ staff:{ user:S.auth.user, pin:S.auth.pin } }); });
  }
  by('bdInvToLogin', function(){ bdInviteDrop_(); S.regMode=false; render(); });
  by('bdInvClose', function(){ bdInviteDrop_(); S.view='week'; render(); });
  if(BD_VIEWS.indexOf(S.view)===-1 || !S.me) return;
  document.querySelectorAll('[data-bdtab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.view=b.getAttribute('data-bdtab'); render(); window.scrollTo(0,0); }; });
  by('bdBackHome', function(){ S.view='week'; render(); window.scrollTo(0,0); });
  by('bdRetry', function(){ var B=bdT_(); B.err=''; bdLoad_(true); render(); });
  by('bdRefresh', function(){ bdLoad_(true); showMsg(t('Checking…')); });
  var B=bdT_();
  document.querySelectorAll('[data-bdgo]').forEach(function(b){ b.onclick=function(){ gpTap(); var p=b.getAttribute('data-bdgo').split('|');
    if(p[0]==='fin'){ B.fin=p[1]; S.view='bdfin'; }
    else if(p[0]==='lead'){ B.campus=p[1]; B.sub='lead'; B.dept=''; B.min=''; S.view='bdcamp'; }
    else { B.campus=p[1]; B.sub=''; B.dept=p[2]||''; B.min=''; S.view='bdcamp'; }
    render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-bdcampus]').forEach(function(b){ b.onclick=function(){ gpTap(); B.campus=b.getAttribute('data-bdcampus'); B.dept=''; B.min=''; if(B.sub!=='lead') B.sub=''; S.sbdAll=null; render(); }; });
  document.querySelectorAll('[data-bddept]').forEach(function(b){ b.onclick=function(){ gpTap(); B.dept=b.getAttribute('data-bddept'); B.min=''; render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-bdmin]').forEach(function(b){ b.onclick=function(){ gpTap(); B.min=b.getAttribute('data-bdmin'); S.sbdAll=null; render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-bdup]').forEach(function(b){ b.onclick=function(){ gpTap(); var to=b.getAttribute('data-bdup'); if(to==='dept') B.min=''; else { B.dept=''; B.min=''; B.sub=''; } render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-bdleadsec]').forEach(function(b){ b.onclick=function(){ gpTap(); B.leadSec=b.getAttribute('data-bdleadsec'); render(); }; });
  by('bdLeadRetry', function(){ B.leadErr[B.campus]=''; bdLeadLoad_(B.campus, true); render(); });
  by('bdBaseGo', function(){ if(S.board && S.me) S.me.campus=B.campus; S.view='base'; render(); window.scrollTo(0,0); });
  by('bdMinReport', function(){ qrOpen_({ campus:B.campus, only:{ campus:B.campus, key:B.dept+'|'+B.min }, from:'bdcamp' }); });
  document.querySelectorAll('[data-bdfincampus]').forEach(function(b){ b.onclick=function(){ gpTap(); B.fin=b.getAttribute('data-bdfincampus'); render(); }; });
  if(S.view==='bdfin') fin2FrameSize_();
}
