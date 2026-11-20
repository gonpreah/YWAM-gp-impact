/* ==================== Search · the app's own "are you sure?" (Nov 2026, Uriah) ====================
   Things that came out of the look-through, chosen as the ones that help everyone every day.
   (The "Today" card on My Home that was section 1 was taken out again, Nov 2026, Andrew.)
   2. SEARCH, 🔍 in the header: one box that finds a page, a person, a ministry or a book (gpFind*).
   3. The browser's own confirm() and prompt() are replaced by the app's sheets (gpAsk_ / gpAskText_), which are in
      the app's language and look; a deleted GP task can be put back for a few seconds (gpUndo_).            */

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

function bindUx_(){ bindFind_(); if(typeof gameIntroMaybe_==='function') gameIntroMaybe_(); gpBannerTick_(); if(typeof holSchedule_==='function') holSchedule_(); if(typeof santaSchedule_==='function') santaSchedule_(); }

/* ---------- The slide-down reminder (Nov 2026, Andrew: "instead of a box pop-up on My Home … a small notification
   slides down from the top, like on a smartphone … swipe it up and it's just in your notification bell … tap it and you
   can finish that one thing") ----------
   What it shows is the bell's own list (visibleNotifItems_: the check-in on Tuesday, goals not set, numbers due, a 1-on-1
   asked for…): one at a time, the newest first, each once a day (gp-banner-seen = {key: date}, only today's kept), the
   first a few seconds after the app is up, then at most one every GP_BANNER_GAP_MS. It stays GP_BANNER_SHOW_MS and slides
   away by itself; ✕ or a swipe up sends it away now. Nothing is cleared — it is still in the bell. A tap does the thing:
   with one action (Answer it, Enter them, Open) that action, exactly as the bell's button does it; with two (Approve /
   Deny, Accept / Pick another time) or none, the bell opens so the person chooses there. Not for guests, students, the
   board, a preview or the GP Tasks app, and not under a test browser unless localStorage 'gp-banner-test' is set. */
var GP_BANNER_FIRST_MS=4000, GP_BANNER_GAP_MS=60000, GP_BANNER_SHOW_MS=9000;
var _gpBan={ timer:0, hide:0, last:0, cur:null };
function gpBannerOn_(){
  if(!S.me || S.guest || S.student || S.board || S.stuPreview || !S.auth || !S.auth.user) return false;
  if(S.bootStale || S.offlineSince || S.view==='login') return false;
  if(typeof gpTasksApp_==='function' && gpTasksApp_()) return false;
  if(navigator.webdriver && !lsGet('gp-banner-test')) return false;
  return true;
}
function gpBannerKey_(it){ return String(it.when||'').slice(0,10)+'|'+String(it.text||'').slice(0,120); }
function gpBannerSeen_(){
  var today=todayStr(), m={};
  try { m=JSON.parse(lsGet('gp-banner-seen')||'{}')||{}; } catch(e){ m={}; }
  Object.keys(m).forEach(function(k){ if(m[k]!==today) delete m[k]; });
  return m;
}
function gpBannerMark_(it){ var m=gpBannerSeen_(); m[gpBannerKey_(it)]=todayStr(); lsSet('gp-banner-seen', JSON.stringify(m)); }
function gpBannerNext_(){
  var seen=gpBannerSeen_();
  return visibleNotifItems_().filter(function(it){ return !it.bellOnly && !seen[gpBannerKey_(it)]; })[0] || null;
}
function gpBannerTick_(){
  if(_gpBan.cur || _gpBan.timer || !gpBannerOn_()) return;
  var wait=Math.max(typeof S.bannerFirstMs==='number' ? S.bannerFirstMs : GP_BANNER_FIRST_MS, _gpBan.last ? _gpBan.last+(typeof S.bannerGapMs==='number' ? S.bannerGapMs : GP_BANNER_GAP_MS)-Date.now() : 0);
  _gpBan.timer=setTimeout(function(){ _gpBan.timer=0; gpBannerShow_(); }, wait);
}
function gpBannerShow_(){
  if(_gpBan.cur || !gpBannerOn_()) return;
  if(document.hidden || S.bellOpen || document.getElementById('findRoot') || document.getElementById('askRoot') || document.getElementById('gameIntro')){ _gpBan.last=Date.now(); gpBannerTick_(); return; }
  var it=gpBannerNext_(); if(!it) return;
  gpBannerMark_(it);
  var acts=document.createElement('div'); acts.innerHTML=it.actions||'';
  var nAct=acts.querySelectorAll('button,a').length, label=nAct===1 ? acts.querySelector('button,a').textContent : '';
  var el=document.createElement('div');
  el.id='gpBanner'; el.className='gpBanner'; el.setAttribute('role','status');
  el.innerHTML='<span class="gpBanIc">'+BELL_SVG+'</span>'+
    '<span class="gpBanText"><b>'+esc(t('YWAM GP'))+'</b><span id="gpBanMsg">'+esc(it.text)+'</span>'+
      (label ? '<span class="gpBanGo">'+esc(label)+' ›</span>' : '<span class="gpBanGo">'+esc(t('Open'))+' ›</span>')+'</span>'+
    '<button class="gpBanX" id="gpBanX" aria-label="'+esc(t('Dismiss'))+'">×</button><span class="gpBanGrip" aria-hidden="true"></span>';
  document.body.appendChild(el);
  _gpBan.cur={ el:el, it:it, n:nAct };
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('on'); }); });
  _gpBan.hide=setTimeout(function(){ gpBannerAway_(); }, typeof S.bannerShowMs==='number' ? S.bannerShowMs : GP_BANNER_SHOW_MS);
  /* a swipe up sends it away; a tap (no movement) opens it */
  var y0=null, dy=0, moved=false;
  el.addEventListener('pointerdown', function(e){ if(e.target.closest('#gpBanX')) return; y0=e.clientY; dy=0; moved=false; el.classList.add('drag'); try { el.setPointerCapture(e.pointerId); } catch(err){} });
  el.addEventListener('pointermove', function(e){ if(y0===null) return; dy=Math.min(0, e.clientY-y0); if(dy<-6) moved=true; el.style.transform='translateY('+dy+'px)'; });
  var up=function(){ if(y0===null) return; y0=null; el.classList.remove('drag'); el.style.transform='';
    if(dy<-30){ gpBannerAway_(); return; }
    if(!moved) gpBannerOpen_(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', function(){ y0=null; el.classList.remove('drag'); el.style.transform=''; });
  document.getElementById('gpBanX').onclick=function(e){ e.stopPropagation(); gpTap(); gpBannerAway_(); };
}
function gpBannerAway_(){
  var c=_gpBan.cur; if(!c) return;
  clearTimeout(_gpBan.hide); _gpBan.cur=null; _gpBan.last=Date.now();
  c.el.classList.remove('on'); c.el.classList.add('off');
  setTimeout(function(){ if(c.el.parentNode) c.el.parentNode.removeChild(c.el); }, 350);
  gpBannerTick_();
}
/* the tap: the bell's own button for this item, so it does exactly what the bell does */
function gpBannerOpen_(){
  var c=_gpBan.cur; if(!c) return;
  var key=gpBannerKey_(c.it), n=c.n;
  gpTap(); gpBannerAway_();
  S.bellOpen=true; renderNotifPanel();
  if(n!==1) return;   // two choices, or none: the bell is open on it
  var idx=-1; visibleNotifItems_().some(function(x, i){ if(gpBannerKey_(x)===key){ idx=i; return true; } return false; });
  var row=idx>-1 ? document.querySelectorAll('#notifRoot .drawer .row')[idx] : null;
  var b=row && row.querySelector('button,a');
  if(!b) return;
  b.click();
  if(S.bellOpen){ S.bellOpen=false; renderNotifPanel(); }
}
