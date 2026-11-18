/* ==================== Today · search · the app's own "are you sure?" (Nov 2026, Uriah) ====================
   Three things that came out of the look-through, chosen as the ones that help everyone every day:
   1. TODAY, on My Home between the greeting and the summary card: what is waiting on YOU right now, in one short list — leave to
      answer, a 1-on-1 to set a time for, the check-in, numbers due, tasks due, the month's book, today's habits.
      Each of these already had its own card or bell item; nothing new is fetched (todayItems_ reads the boot).
   2. SEARCH, 🔍 in the header: one box that finds a page, a person, a ministry or a book (gpFind*).
   3. The browser's own confirm() and prompt() are replaced by the app's sheets (gpAsk_ / gpAskText_), which are in
      the app's language and look; a deleted GP task can be put back for a few seconds (gpUndo_).            */

/* ---------- 1. Today ---------- */
function todayItems_(){
  var out=[];
  if(!S.me || S.guest || S.student || S.board || S.stuPreview) return out;
  var add=function(ic, text, attr, cta, soft){ out.push({ ic:ic, text:text, attr:attr, cta:cta, soft:!!soft }); };
  var today=todayStr();
  /* people waiting on you come first */
  var tr=S.tripRequests||[];
  if(tr.length) add('🌴', tr.length===1 ? gpT('{name} asked for leave — yours to answer',{name:firstName_(tr[0].name)}) : gpT('{n} leave requests are waiting for your answer',{n:tr.length}), 'data-gomentorship="1"', t('Answer'));
  var mr=S.mentorRequests||[];
  if(mr.length) add('🤝', mr.length===1 ? gpT('{name} asked you to be their mentor',{name:firstName_(mr[0].name)}) : gpT('{n} people asked you to be their mentor',{n:mr.length}), 'data-gomentorship="1"', t('Answer'));
  (S.oneOnOnes||[]).forEach(function(o){
    var nm=firstName_(o.otherName);
    if(!o.mine && o.status==='pending') add('☕', gpT('{name} asked you for a 1-on-1 — pick a day and time',{name:nm}), 'data-gomentorship="1"', t('Set a time'));
    else if(o.status==='accepted' && o.when && String(o.when).slice(0,10)===today) add('☕', gpT('Your 1-on-1 with {name} is today, {when}',{name:nm, when:ooWhenNice_(o.when)}), 'data-ooopen="'+esc(o.id)+'"', t('Open'));
    if(!o.iMentor && ooOpen_(o) && !o.prep && !(o.status==='pending' && !o.mine)) add('📝', gpT('Fill in your check-in before your 1-on-1 with {name}',{name:o.otherName}), 'data-ooopen="'+esc(o.id)+'"', t('Open'));
  });
  /* the weekly check-in: from its day on, until it is in (on the day itself My Home has its own card) */
  var wk=thisWeek();
  if(!checkinIsToday_() && new Date(today)>=checkinDayOf_(wk) && !myWeekRow(wk)) add('💚', t('Your weekly health check-in is due'), 'data-gohealth="open"', t('Answer it'));
  /* ministry numbers you are responsible for */
  if(S.numbers){
    var fri=isoDateOf_(weekFriday_(wk));
    (S.numbers.duty||[]).forEach(function(x){
      var go='data-gonumbers="'+esc(x.dept+'|'+x.ministry)+'"';
      if(wk>1 && !numLogged_(x, wk-1)) add('📊', gpT('{ministry} numbers for week {wk} are overdue',{ministry:t(x.ministry), wk:wk-1}), go, t('Enter them'));
      if(today>=fri && !numLogged_(x, wk)) add('📊', today>fri ? gpT('{ministry} numbers for week {wk} are overdue',{ministry:t(x.ministry), wk:wk}) : gpT('{ministry} numbers for week {wk} are due today',{ministry:t(x.ministry), wk:wk}), go, t('Enter them'));
    });
  }
  /* tasks due today or overdue */
  var I=S.gpTaskInfo;
  if(I && I.due) add('☑️', I.due===1 ? t('1 task is due today or overdue') : gpT('{n} tasks are due today or overdue',{n:I.due}), 'data-todaygo="tasks"', t('Open'));
  /* admins and HR */
  if(S.me.isAdmin || S.me.hr){
    if(S.hrDue) add('📄', S.hrDue===1 ? t('1 staff contract is due for renewal') : gpT('{n} staff contracts are due for renewal',{n:S.hrDue}), 'data-gohr="1"', t('Open HR'));
    if(S.hrFollowUps) add('📞', S.hrFollowUps===1 ? t('1 candidate follow-up is due') : gpT('{n} candidate follow-ups are due',{n:S.hrFollowUps}), 'data-gohr="1"', t('Open HR'));
  }
  /* gentler things: today's habits, the month's book */
  try {
    var hs=myHabitsToday(), log=logForDate(today), left=hs.filter(function(hb){ return !habitDoneToday(hb, log); }).length;
    if(hs.length && left) add('✅', left===1 ? t('1 habit left today') : gpT('{n} habits left today',{n:left}), 'data-todaygo="habits"', t('Tick them'), true);
  } catch(e){}
  try {
    var m=S.lib && S.lib.month;
    if(m && m.bookId && !libRead_()[m.bookId]) add('📚', gpT('This month’s book: {title} — a ten-minute read',{title:m.title||''}), 'data-libhome="'+esc(m.bookId)+'"', t('Read it'), true);
  } catch(e){}
  return out;
}
var TODAY_MAX=5;
function todayHtml_(){
  if(!S.me || S.guest || S.student || S.board || S.stuPreview) return '';
  var it=todayItems_(), firm=it.filter(function(x){ return !x.soft; }).length;
  if(!it.length) return '<div class="todayDone" id="today">✓ '+esc(t('Nothing is waiting on you today.'))+'</div>';
  var show=S.todayAll ? it : it.slice(0, TODAY_MAX);
  var h='<div class="card todayCard" id="today"><div class="todayHead"><span>☀️ '+esc(t('Today'))+'</span>'+(firm ? '<span class="todayN">'+firm+'</span>' : '')+'</div>';
  h+=show.map(function(x){
    return '<button class="todayRow'+(x.soft?' soft':'')+'" '+x.attr+'><span class="todayIc">'+x.ic+'</span><span class="todayText">'+esc(x.text)+'</span><span class="todayCta">'+esc(x.cta)+' ›</span></button>';
  }).join('');
  if(it.length>show.length) h+='<button class="linkbtn" id="todayMore" style="padding-left:0">'+esc(gpT('{n} more',{n:it.length-show.length}))+'</button>';
  return h+'</div>';
}
function bindToday_(){
  var more=document.getElementById('todayMore'); if(more) more.onclick=function(){ S.todayAll=true; render(); };
  document.querySelectorAll('[data-todaygo]').forEach(function(b){ b.onclick=function(){
    var k=b.getAttribute('data-todaygo'); gpTap();
    if(k==='tasks'){ gptOpenPage_('week'); return; }
    if(k==='habits'){ var a=document.getElementById('homeHabits'); if(a && a.scrollIntoView) a.scrollIntoView({ behavior:'smooth', block:'start' }); }
  }; });
}

/* ---------- 2. Search ---------- */
/* Other words people type for a page. English; a page's own label (in the app's language) always matches too. */
var FIND_WORDS={ base:'dashboard figures numbers salvations staff', caltasks:'calendar tasks to-do todo events', ywamgp:'organisation organization board leadership structure',
  prayer:'pray requests', p360:'feedback review peers', tests:'personality strengths apest gifts couple marriage quiz', leave:'time off holiday vacation pto away',
  library:'books read reading summaries', sched:'cooking chores kitchen duty rota', hosp:'rooms beds bookings guests', students:'dts school', portal:'applications applicants teams',
  hr:'contracts candidates human resources', admin:'accounts approvals settings', kmreview:'translation', khmer:'language vocabulary english flashcards',
  'tab:week':'home goals habits', 'tab:ministry':'numbers kpis okrs metrics', 'tab:team':'directory people staff structure', 'tab:health':'check-in checkin weekly', 'tab:profile':'settings photo pin password reminders appearance dark',
  mycontract:'contract papers sign legal', mentor:'mentorship mentor mentee one-on-one 1-on-1', goals:'annual goals smart tasks', support:'support raising partners donors fundraising', whoshere:'on campus who is here' };
function gpFindPages_(){
  var out=[], seen={};
  var push=function(id, label, icon, go){ if(seen[id]) return; seen[id]=1; out.push({ kind:'page', id:id, label:label, icon:icon||'', words:FIND_WORDS[id]||'', go:go }); };
  document.querySelectorAll('nav.bottom [data-tab]').forEach(function(b){
    var id=b.getAttribute('data-tab'), sv=b.querySelector('svg');
    push('tab:'+id, (b.innerText||'').trim(), sv ? sv.outerHTML : '', function(){ var x=document.querySelector('nav.bottom [data-tab="'+id+'"]'); if(x) x.click(); });
  });
  /* the menu's own items, for this person's role: read off the menu itself, so the two can never disagree */
  var was=S.menuOpen; S.menuOpen=true; renderMenu();
  document.querySelectorAll('#menuRoot [data-menu-item]').forEach(function(b){
    var id=b.getAttribute('data-menu-item'), ic=b.querySelector('.drawerIcon'), lb=b.querySelector('.drawerLabel');
    push(id, (lb ? lb.textContent : '').replace(/ · \d+$/,''), ic ? ic.innerHTML : '', function(){ S.menuOpen=true; renderMenu(); var x=document.querySelector('#menuRoot [data-menu-item="'+id+'"]'); if(x) x.click(); else { S.menuOpen=false; renderMenu(); } });
  });
  S.menuOpen=!!was; renderMenu();
  if(!S.guest && !S.student && !S.board){
    var v=function(id, label, ic, view, fn){ push(id, label, '<span class="findEmoji">'+ic+'</span>', fn || function(){ S.view=view; S.person=null; S.mentee=null; render(); window.scrollTo(0,0); }); };
    v('mycontract', t('My contract'), '📄', '', function(){ openMyContract_(); });
    v('mentor', t('Mentorship'), '🤝', 'mentor');
    v('goals', t('Goals & Tasks'), '🎯', 'goals');
    v('support', t('Support raising'), '💰', 'support');
    v('whoshere', t('Who’s here'), '🏠', '', function(){ S.whosFrom='week'; S.view='whoshere'; render(); window.scrollTo(0,0); whosHereLoad_(true); });
  }
  return out;
}
function gpFindNorm_(s){ var x=String(s||'').toLowerCase(); try { x=x.normalize('NFD').replace(/[̀-ͯ]/g,''); } catch(e){} return x; }
function gpFindResults_(q){
  var F=S.find, n=gpFindNorm_(q).trim(), res={ pages:[], people:[], mins:[], books:[] };
  var hit=function(hay){ hay=gpFindNorm_(hay); return n.split(/\s+/).every(function(w){ return hay.indexOf(w)>-1; }); };
  if(!n){ res.pages=F.pages.slice(0, 8); return res; }
  res.pages=F.pages.filter(function(p){ return hit(p.label+' '+p.words); }).slice(0, 6);
  if(!S.guest && !S.student && !S.board){
    res.people=(S.roster||[]).filter(function(p){ return hit([p.name, p.role, p.ministry, t(p.ministry||''), p.dept, t(p.dept||'')].join(' ')); })
      .sort(function(a,b){ var an=gpFindNorm_(a.name).indexOf(n)===0 ? 0 : 1, bn=gpFindNorm_(b.name).indexOf(n)===0 ? 0 : 1; return an-bn || String(a.name).localeCompare(String(b.name)); }).slice(0, 8);
    try { res.mins=mmOptions_().filter(function(o){ return o.dept!==BL_DEPT && hit(o.min+' '+t(o.min)+' '+o.dept+' '+t(o.dept)); }).slice(0, 6); } catch(e){}
  }
  if(typeof GP_LIBRARY!=='undefined'){ try { res.books=libMatches_(q).slice(0, 6); } catch(e){} }
  return res;
}
function gpFindOpen_(){
  S.menuOpen=false; S.bellOpen=false;
  S.find={ q:'', pages:gpFindPages_(), flat:[] };
  if(typeof GP_LIBRARY==='undefined' && typeof libLoad_==='function'){ try { libLoad_(); } catch(e){} }   // books join the results once the Library has loaded
  gpFindDraw_(true);
}
function gpFindClose_(){ S.find=null; var r=document.getElementById('findRoot'); if(r) r.remove(); document.body.classList.remove('findOn'); }
function gpFindDraw_(first){
  var F=S.find; if(!F) return;
  var root=document.getElementById('findRoot');
  if(!root){ root=document.createElement('div'); root.id='findRoot'; document.body.appendChild(root); document.body.classList.add('findOn'); }
  if(first){
    root.innerHTML='<div class="findBar"><span class="findMag" aria-hidden="true">'+FIND_SVG+'</span>'+
      '<input type="search" id="findBox" autocomplete="off" autocapitalize="none" enterkeyhint="go" aria-label="'+esc(t('Search'))+'" placeholder="'+esc(t('Search a page, a person, a book…'))+'">'+
      '<button class="linkbtn" id="findClose" style="width:auto;margin:0;padding:8px 4px">'+esc(t('Close'))+'</button></div><div id="findOut" class="findOut"></div>';
    var box=document.getElementById('findBox');
    box.oninput=function(){ F.q=box.value; gpFindDraw_(); };
    box.onkeydown=function(e){ if(e.key==='Escape'){ gpFindClose_(); } else if(e.key==='Enter'){ e.preventDefault(); if(F.flat[0]) gpFindGo_(0); } };
    document.getElementById('findClose').onclick=gpFindClose_;
    setTimeout(function(){ try { box.focus(); } catch(e){} }, 30);
  }
  var R=gpFindResults_(F.q), flat=[], h='';
  var sec=function(title, rows){ if(rows.length) h+='<div class="findSec">'+esc(title)+'</div>'+rows.join(''); };
  var row=function(icon, main, sub, item){ flat.push(item); return '<button class="findRow" data-find="'+(flat.length-1)+'"><span class="findIc">'+icon+'</span><span class="findTxt"><b>'+esc(main)+'</b>'+(sub ? '<span>'+esc(sub)+'</span>' : '')+'</span><span class="findGo">›</span></button>'; };
  sec(F.q.trim() ? t('Pages') : t('Go to'), R.pages.map(function(p){ return row(p.icon, p.label, '', { go:p.go }); }));
  sec(t('People'), R.people.map(function(p){ return row(avatarHtml(p,'sm'), p.name, [p.ministry ? t(p.ministry) : '', p.dept ? t(p.dept) : ''].filter(Boolean).join(' · '), { person:p.id }); }));
  sec(t('Ministries'), R.mins.map(function(o){ return row('<span class="findEmoji">'+((typeof MIN_EMOJI!=='undefined' && MIN_EMOJI[o.min]) || '📊')+'</span>', t(o.min), t(o.dept), { min:o }); }));
  sec(t('Books'), R.books.map(function(b){ return row('<span class="findEmoji">📚</span>', libTitle_(b), libAuthor_(b), { book:b.id }); }));
  if(!flat.length) h='<p class="findNone">'+esc(gpT('Nothing found for “{q}”.',{q:F.q.trim()}))+'</p>';
  F.flat=flat;
  var out=document.getElementById('findOut'); out.innerHTML=h;
  out.querySelectorAll('[data-find]').forEach(function(b){ b.onclick=function(){ gpFindGo_(Number(b.getAttribute('data-find'))); }; });
}
function gpFindGo_(i){
  var F=S.find, x=F && F.flat[i]; if(!x) return;
  gpTap(); gpFindClose_();
  if(x.go){ x.go(); return; }
  if(x.person){
    run('staffProfile',[S.auth.user,S.auth.pin,x.person],function(d){ if(d && d.ok){ S.view='team'; S.mentee=null; S.person=d; render(); window.scrollTo(0,0); } else showMsg(t('Not available')); });
    return;
  }
  if(x.min){ S.view='ministry'; S.person=null; S.mmBrowseDept=x.min.dept; S.mmBrowseMinistry=x.min.min; S.mmPickOpen=false; S.mmPickQ=''; S.mmTab='ministry'; S.mmTabTouched=false; render(); window.scrollTo(0,0); return; }
  if(x.book){ libOpen_(); S.libBook=x.book; render(); }
}
var FIND_SVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>';
function gpFindBtnHtml_(){ return '<button class="hbtn icon" id="findBtn" aria-label="'+esc(t('Search'))+'">'+FIND_SVG+'</button>'; }
function bindFind_(){ var b=document.getElementById('findBtn'); if(b) b.onclick=function(){ gpTap(); gpFindOpen_(); }; }

/* ---------- 3. The app's own "are you sure?" ----------
   confirm() and prompt() stop the page and answer at once, and ~60 handlers are written around that:
       if(!confirm(msg)) return;   …the rest…
   A sheet can't stop the page. So gpAsk_ answers "no" the first time and opens the sheet; on Yes it sends the same
   click (or change, or key) to the same element again, and this time answers "yes" — the handler runs a second time
   from the top and carries on. A handler with two questions keeps the answers already given (`passed`).
   Outside a tap (a server's answer coming back) there is nothing to send again, so the browser's own box is used.
   Under a test browser the browser's box is used too unless localStorage['gp-ask-test'] is set: every older test
   answers those boxes already (the same rule as the service worker and Learn Khmer's recordings).            */
var _gpAsk={ passed:null, sheet:null };
function gpAskNative_(){ try { return !!navigator.webdriver && !localStorage.getItem('gp-ask-test'); } catch(e){ return false; } }
function gpAskEvent_(){ var ev=window.event; return (ev && ev.target && /^(click|change|keydown|keyup|submit|input)$/.test(ev.type)) ? ev : null; }
function gpAskReplay_(sheet){
  var ev=sheet.ev, el=sheet.el, ne;
  try { ne = /^key/.test(ev.type) ? new KeyboardEvent(ev.type, { key:ev.key, bubbles:true, cancelable:true }) : ev.type==='click' ? new MouseEvent('click', { bubbles:true, cancelable:true }) : new Event(ev.type, { bubbles:true, cancelable:true }); }
  catch(e){ return; }
  _gpAsk.passed=sheet.passed;
  try { el.dispatchEvent(ne); } finally { _gpAsk.passed=null; }
}
function gpAskClose_(){ _gpAsk.sheet=null; var r=document.getElementById('askRoot'); if(r) r.remove(); }
function gpAskOpen_(kind, msg, def, ev){
  var passed=(_gpAsk.passed||[]).slice();
  var sheet=_gpAsk.sheet={ kind:kind, msg:msg, ev:ev, el:ev.target, passed:passed };
  var old=document.getElementById('askRoot'); if(old) old.remove();
  var root=document.createElement('div'); root.id='askRoot';
  root.innerHTML='<div class="scrim askScrim" id="askScrim"></div><div class="askSheet" role="alertdialog" aria-modal="true" aria-labelledby="askMsg">'+
    '<p class="askMsg" id="askMsg">'+esc(msg)+'</p>'+
    (kind==='text' ? '<input type="text" id="askBox" value="'+esc(def==null?'':def)+'" aria-labelledby="askMsg">' : '')+
    '<div class="askBtns"><button class="btn ghost" id="askNo">'+esc(t('Cancel'))+'</button><button class="btn" id="askYes">'+esc(kind==='text' ? t('OK') : t('Yes'))+'</button></div></div>';
  document.body.appendChild(root);
  var yes=function(){
    var val = kind==='text' ? document.getElementById('askBox').value : true;
    gpAskClose_(); sheet.passed=passed.concat([{ msg:msg, val:val }]); gpAskReplay_(sheet);
  };
  document.getElementById('askYes').onclick=yes;
  document.getElementById('askNo').onclick=gpAskClose_;
  document.getElementById('askScrim').onclick=gpAskClose_;
  root.onkeydown=function(e){ if(e.key==='Escape'){ e.stopPropagation(); gpAskClose_(); } else if(e.key==='Enter' && kind==='text'){ e.preventDefault(); e.stopPropagation(); yes(); } };
  setTimeout(function(){ try { var f=document.getElementById(kind==='text' ? 'askBox' : 'askYes'); f.focus(); if(kind==='text' && f.select) f.select(); } catch(e){} }, 30);
}
function gpAskPassed_(msg){
  var p=_gpAsk.passed; if(!p) return null;
  for(var i=0;i<p.length;i++) if(p[i].msg===msg) return p[i];
  return null;
}
function gpAsk_(msg){
  msg=String(msg==null?'':msg);
  var got=gpAskPassed_(msg); if(got) return true;
  var ev=gpAskEvent_();
  if(!ev || gpAskNative_()) return window.confirm(msg);
  gpAskOpen_('yes', msg, null, ev);
  return false;
}
function gpAskText_(msg, def){
  msg=String(msg==null?'':msg);
  var got=gpAskPassed_(msg); if(got) return String(got.val);
  var ev=gpAskEvent_();
  if(!ev || gpAskNative_()) return window.prompt(msg, def==null?'':def);
  gpAskOpen_('text', msg, def, ev);
  return null;
}

/* Deleted — with a few seconds to change your mind. `commit` really does it; `undo` puts the screen back. The
   delete goes through at once if the app is left, or another one starts. Under a test browser there is no wait. */
var _gpUndo=null;
function gpUndoFlush_(){ var u=_gpUndo; if(!u) return; _gpUndo=null; clearTimeout(u.timer); var r=document.getElementById('undoRoot'); if(r) r.remove(); try { u.commit(); } catch(e){} }
function gpUndo_(text, commit, undo){
  gpUndoFlush_();
  if(gpAskNative_()){ commit(); return; }
  var root=document.createElement('div'); root.id='undoRoot'; root.setAttribute('role','status');
  root.innerHTML='<span>'+esc(text)+'</span><button id="undoBtn">'+esc(t('Undo'))+'</button>';
  document.body.appendChild(root);
  _gpUndo={ commit:commit, timer:setTimeout(gpUndoFlush_, 5000) };
  document.getElementById('undoBtn').onclick=function(){ var u=_gpUndo; _gpUndo=null; if(u) clearTimeout(u.timer); root.remove(); try { undo(); } catch(e){} };
}
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='hidden') gpUndoFlush_(); });
window.addEventListener('pagehide', gpUndoFlush_);

function bindUx_(){ bindToday_(); bindFind_(); }
