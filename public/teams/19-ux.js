/* ==================== Search · the app's own "are you sure?" (Nov 2026, Uriah) ====================
   Things that came out of the look-through, chosen as the ones that help everyone every day.
   (The "Today" card on My Home that was section 1 was taken out again, Nov 2026, Andrew.)
   2. SEARCH, 🔍 in the header: one box that finds a page, a person, a ministry or a book (gpFind*).
   3. The browser's own confirm() and prompt() are replaced by the app's sheets (gpAsk_ / gpAskText_), which are in
      the app's language and look; a deleted GP task can be put back for a few seconds (gpUndo_).            */

/* ---------- 2. Search ---------- */
/* Other words people type for a page. English; a page's own label (in the app's language) always matches too. */
var FIND_WORDS={ worship:'music songs band rota roster worship team', intercession:'prayer need wednesday fast fasting', fast:'fasting prayer 21 days intercession', base:'dashboard figures numbers salvations staff', caltasks:'calendar tasks to-do todo events', ywamgp:'organisation organization board leadership structure',
  prayer:'pray requests', p360:'feedback review peers', tests:'personality strengths apest gifts couple marriage quiz', leave:'time off holiday vacation pto away',
  library:'books read reading summaries', sched:'cooking chores kitchen duty rota', hosp:'rooms beds bookings guests', students:'dts school', portal:'applications applicants teams',
  hr:'contracts candidates human resources', admin:'accounts approvals settings', kmreview:'translation', khmer:'language vocabulary english flashcards',
  'tab:week':'home goals habits', 'tab:ministry':'scorecard rocks numbers kpis okrs metrics priorities goals', 'tab:team':'directory people staff structure', 'tab:health':'check-in checkin weekly', 'tab:profile':'settings photo pin password reminders appearance dark',
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
    v('intercession', t('Wednesday intercession'), '🙏', '', function(){ icpOpen_('wed'); });
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

function bindUx_(){ bindFind_(); bindQuickApps_(); if(typeof gameIntroMaybe_==='function') gameIntroMaybe_(); gpBannerTick_(); if(typeof holSchedule_==='function') holSchedule_(); if(typeof santaSchedule_==='function') santaSchedule_(); }

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
  if(S.awaiting || (typeof setupWanted_==='function' && setupWanted_())) return false;   // the setup steps and the waiting page
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

/* ---------- My Home's dashboard card, arranged like an iPhone's Home Screen (Nov 2026, Andrew) ----------
   First the quick apps ("small little app icons in the dashboard … customise it like a hotbar"), then the whole card:
   "make the little edit button smaller in the corner … when you click and hold down an app, the whole dashboard would
   wiggle a little bit … click, drag and move things around … a little plus sign … add in new things … certain things
   we want there by default, so you can move them around but you can't delete them."
   - The card is three groups, each in the person's own order (`dashLayout_`): the quick apps (`#qaBar`, `.qaItem`),
     the widgets (`#dashWidgets`, `.dashItem` around a `.heroW`), and the rows (`#dashRows`, `.dashRow`: this week's
     chores, the reading row, the base at a glance).
   - **What came with the card stays** (`DASH_LOCKED_APPS` = QA_DEFAULT, `DASH_W_LOCKED`, every row): it can be moved,
     never taken off, and is put back if a saved layout lacks it. What the person adds — more apps from their own menu
     (`qaCatalog_`), more widgets (`DASH_W_EXTRA`: days off, mentor, streak, books, year goals) — has ✕.
   - **Editing**: hold anything on the card (`DASH_HOLD_MS`) or tap the small ✎ in its corner (`#qaEditBtn`) →
     `S.qaEdit`: the card gets `.dashEditing`, everything on it wiggles, a bar on top has ＋ (`#qaAdd` → `#qaAddSheet`
     with Widgets and Apps) and Done (`#qaDone`). Drag within a group to move (`dashDrag_`, pointer events on the
     window, `touch-action:none` on the card only while editing). Taps on the card's things do nothing while editing
     (`dashSwallow_`), and the tap that ends a hold never opens what was held.
   - Saved with `saveDashLayout` (`{apps, widgets, rows}`, on the staff record; the apps also as `quickApps`) a moment
     after each change (`dashSoon_`), and at once on Done. */
var QA_DEFAULT=['caltasks','library','khmer','leave'], QA_MAX=10, QA_HOLD_MS=450, DASH_HOLD_MS=450;
var QA_SKIP={ applogout:1, boardlogout:1, stuexit:1, openapp:1, stuportal:1, guestreg:1, guestlogin:1 };
var DASH_LOCKED_APPS=QA_DEFAULT;
var DASH_W_LOCKED=['goals','habits','health','tasks'];
var DASH_W_EXTRA=['daysoff','mentor','streak','books','yeargoals'];
var DASH_ROWS=['sched','base'];          // the rows that come with the card
var DASH_ROW_EXTRA=['reading'];          // a row someone can add (Nov 2026: the book suggestions became notes; the reading row is off unless added)
var DASH_W_MAX=8;
/* the bar's own short names, so a name fits under its icon (the menu's full name is the button's label for a screen reader) */
var QA_SHORT={ caltasks:'Calendar', khmer:'Language', leave:'Leave', mycontract:'My contract', whoshere:'Who’s here', goals:'Goals', mentor:'Mentor', p360:'360 reviews' };
function qaName_(p){ return QA_SHORT[p.id] ? t(QA_SHORT[p.id]) : p.label; }
function qaOn_(){ return !!(S.me && S.auth && S.auth.user && !S.guest && !S.student && !S.board && !S.stuPreview); }
function qaCatalog_(){
  var who=S.me.id+'|'+LANG;
  if(S.qaCat && S.qaCat.who===who) return S.qaCat.list;
  var list=[];
  try { list=gpFindPages_().filter(function(p){ return p.id.indexOf('tab:')!==0 && !QA_SKIP[p.id] && p.label; }); } catch(e){ list=[]; }
  S.qaCat={ who:who, list:list };
  return list;
}
function dashUniq_(a){ return (a||[]).filter(function(x, i, arr){ return typeof x==='string' && arr.indexOf(x)===i; }); }
/* the person's order, with everything that came with the card put back if it is missing */
function dashLayout_(){
  var L=(S.me && S.me.dashLayout) || {};
  var apps=dashUniq_(Array.isArray(L.apps) ? L.apps : (Array.isArray(S.me.quickApps) ? S.me.quickApps : QA_DEFAULT));
  DASH_LOCKED_APPS.forEach(function(id){ if(apps.indexOf(id)<0) apps.push(id); });
  var widgets=dashUniq_(Array.isArray(L.widgets) ? L.widgets : DASH_W_LOCKED).filter(function(id){ return DASH_W_LOCKED.indexOf(id)>-1 || DASH_W_EXTRA.indexOf(id)>-1; });
  DASH_W_LOCKED.forEach(function(id){ if(widgets.indexOf(id)<0) widgets.push(id); });
  var rows=dashUniq_(Array.isArray(L.rows) ? L.rows : DASH_ROWS).filter(function(id){ return DASH_ROWS.indexOf(id)>-1 || DASH_ROW_EXTRA.indexOf(id)>-1; });
  if(!L.v) rows=rows.filter(function(id){ return id!=='reading'; });   // a layout saved before v2 had the reading row only because it came with the card
  DASH_ROWS.forEach(function(id){ if(rows.indexOf(id)<0) rows.push(id); });
  /* the order of the blocks — the apps, the widgets and each row — any way round (Nov 2026, Andrew: "drag … the morning
     chores … to the very top … mix and match") */
  var all=['apps','widgets'].concat(rows.map(function(r){ return 'row:'+r; }));
  var order=dashUniq_(Array.isArray(L.order) ? L.order : []).filter(function(b){ return all.indexOf(b)>-1; });
  all.forEach(function(b){ if(order.indexOf(b)<0) order.push(b); });
  return { apps:apps.slice(0, QA_MAX), widgets:widgets.slice(0, DASH_W_MAX), rows:rows, order:order, v:2 };
}
function dashSet_(L){
  var rows=L.rows.slice(), order=L.order.filter(function(b){ return b.indexOf('row:')!==0 || rows.indexOf(b.slice(4))>-1; });
  rows.forEach(function(r){ if(order.indexOf('row:'+r)<0) order.push('row:'+r); });
  S.me.dashLayout={ apps:L.apps.slice(), widgets:L.widgets.slice(), rows:rows, order:order, v:2 }; S.me.quickApps=L.apps.slice(); dashSoon_();
}
function qaChosen_(){
  var cat=qaCatalog_(), by={}; cat.forEach(function(p){ by[p.id]=p; });
  return dashLayout_().apps.filter(function(id){ return by[id]; }).map(function(id){ return by[id]; });
}
function qaIds_(){ return qaChosen_().map(function(p){ return p.id; }); }
function qaIconHtml_(p){ return '<span class="qaIc">'+(p.icon || '•')+'</span>'; }
function dashX_(kind, id, label){ return '<button class="qaX" data-dashrm="'+kind+':'+esc(id)+'" aria-label="'+esc(gpT('Take {name} off',{name:label}))+'">×</button>'; }

/* ---- the widgets ---- */
function dashRing_(p, fig, label){ return '<span class="gRing heroWRing" style="'+gpRingVars(Math.max(0, Math.min(100, Math.round(p))))+'" role="img" aria-label="'+esc(label)+'"><span>'+esc(fig)+'</span></span>'; }
function dashWidget_(id, c){
  if(id==='goals') return { label:t('Goals'), title:t('Weekly Goals'), attrs:'data-jump="sec-goals"', inner:dashRing_(c.goalsPct, c.goalsDone+'/'+c.goalsN, t('Weekly Goals')) };
  if(id==='habits') return { label:t('Habits'), title:t('Habits Today'), attrs:'data-jump="sec-habits"', inner:dashRing_(c.habitsPct, c.habitsDone+'/'+c.habitsN, t('Habits Today')) };
  if(id==='health') return { label:t('Health'), title:t('My Health'), attrs:'id="goMyHealth" data-gohealth="1"', inner:dashRing_(c.healthPct, c.score!==null ? c.score.toFixed(1) : '—', t('My Health')) };
  if(id==='tasks'){
    var I=S.gpTaskInfo; if(!I) return null;
    var n=I.inbox || I.open || 0;
    return { label:t('Tasks'), title:t('GP Tasks'), attrs:'id="goGpTasks"', inner:'<span class="heroWRing heroWIcon">'+GPT_SVG.tasks+(n ? '<span class="gtBadge heroWBadge'+(I.inbox?'':' quiet')+'">'+n+'</span>' : '')+'</span>' };
  }
  if(id==='daysoff'){
    var yr=String(new Date().getFullYear()), yt=(S.trips && S.trips.totals && S.trips.totals[yr]) || {personal:0}, cap=(S.trips && S.trips.ptoCap) || 30;
    var left=Math.max(0, cap-(yt.personal||0));
    return { label:t('Days off'), title:t('Personal days off left'), attrs:'data-dashgo="daysoff"', inner:dashRing_(left/cap*100, String(left), t('Personal days off left')) };
  }
  if(id==='mentor'){
    var held=S.me.mentorId ? ooHeldThisMonth_(S.me.id) : 0;
    return { label:t('Mentor'), title:t('Mentorship'), attrs:'data-dashgo="mentor"', inner:dashRing_(held/OO_PER_MONTH*100, S.me.mentorId ? held+'/'+OO_PER_MONTH : '—', t('Mentorship')) };
  }
  if(id==='streak'){
    var st=graceStreak(function(){ return true; });
    return { label:t('Streak'), title:t('Days in a row'), attrs:'data-dashgo="streak"', inner:dashRing_(st/7*100, '🔥'+st, t('Days in a row')) };
  }
  if(id==='books'){
    var nb=libBooksRead_(), goal=(S.lib && S.lib.goal) || 12;
    return { label:t('Books'), title:t('Books read'), attrs:'data-dashgo="books"', inner:dashRing_(nb/goal*100, String(nb), t('Books read')) };
  }
  if(id==='yeargoals'){
    var yg=(S.smartGoals||[]).filter(function(g){ return Number(g.year)===Number(smartYear_()); });
    var avg=yg.length ? Math.round(yg.reduce(function(a,g){ return a+(Number(g.pct)||0); },0)/yg.length) : 0;
    return { label:t('Year goals'), title:t('Year goals'), attrs:'data-dashgo="yeargoals"', inner:dashRing_(avg, yg.length ? avg+'%' : '—', t('Year goals')) };
  }
  return null;
}
function dashGo_(id){
  gpTap();
  if(id==='daysoff'){ S.view='leave'; render(); window.scrollTo(0,0); }
  else if(id==='mentor'){ S.view='mentor'; S.mentee=null; render(); window.scrollTo(0,0); }
  else if(id==='streak'){ S.person=null; S.teamMode='game'; S.gameCampus=null; S.view='team'; render(); window.scrollTo(0,0); }
  else if(id==='books'){ libOpen_(); }
  else if(id==='yeargoals'){ S.view='goals'; S.goalsTab='goals'; render(); window.scrollTo(0,0); }
}
function dashWidgetsHtml_(c, L, edit){
  var items=L.widgets.map(function(id){
    var w=dashWidget_(id, c); if(!w) return '';
    var locked=DASH_W_LOCKED.indexOf(id)>-1;
    return '<div class="dashItem" data-dashw="'+esc(id)+'"><button class="heroW" '+w.attrs+' aria-label="'+esc(w.title)+'">'+w.inner+'<span class="heroWLabel">'+esc(w.label)+'</span></button>'+
      (edit && !locked ? dashX_('w', id, w.label) : '')+'</div>';
  }).filter(Boolean);
  return '<div class="heroWidgets" id="dashWidgets" style="grid-template-columns:repeat('+Math.max(1, Math.min(4, items.length))+', minmax(0,1fr))">'+items.join('')+'</div>';
}

/* ---- the quick apps ---- */
function qaBarHtml_(){
  if(!qaOn_()) return '';
  var on=qaChosen_(), edit=!!S.qaEdit;
  return '<div class="qaBar'+(edit?' edit':'')+'" id="qaBar" role="toolbar" aria-label="'+esc(t('Quick apps'))+'">'+on.map(function(p){
    var locked=DASH_LOCKED_APPS.indexOf(p.id)>-1;
    return '<div class="qaItem" data-qa="'+esc(p.id)+'"><button class="qaBtn" data-qago="'+esc(p.id)+'" aria-label="'+esc(p.label)+'">'+qaIconHtml_(p)+
      '<span class="qaLabel">'+esc(qaName_(p))+'</span></button>'+(edit && !locked ? dashX_('a', p.id, p.label) : '')+'</div>';
  }).join('')+'</div>';
}

/* ---- the rows ---- */
function dashRowHtml_(id, edit){
  var inner = id==='sched' ? (typeof dutyHtml==='function' ? schedHomeHtml_() : '') : id==='reading' ? libHeroRowHtml_() : id==='base' ? homeBaseHtml_() : '';
  return inner ? '<div class="dashRow" data-dashrow="'+id+'">'+inner+(edit && DASH_ROW_EXTRA.indexOf(id)>-1 ? dashX_('r', id, t(DASH_ROW_NAME[id]||id)) : '')+'</div>' : '';
}
var DASH_ROW_NAME={ sched:'Chores and cooking', reading:'Reading', base:'The base at a glance' };

/* ---- the card ---- */
function dashBodyHtml_(c){
  if(!qaOn_()) return dashWidgetsHtml_(c, { widgets:DASH_W_LOCKED, apps:[], rows:DASH_ROWS }, false)+DASH_ROWS.map(dashRowHtml_).join('');
  var L=dashLayout_(), edit=!!S.qaEdit;
  var h = edit
    ? '<div class="dashEditBar"><button class="dashPlus" id="qaAdd" aria-label="'+esc(t('Add to your dashboard'))+'">＋</button>'+
        '<span class="dashEditHint">'+esc(t('Drag to move · ✕ takes off what you added'))+'</span>'+
        '<button class="qaDone" id="qaDone">'+esc(t('Done'))+'</button></div>'
    : '<button class="dashPencil" id="qaEditBtn" aria-label="'+esc(t('Arrange your dashboard'))+'">✎</button>';
  /* each block can go anywhere: in edit mode the apps and the widgets have a grip to move the whole group by; a row is moved by itself */
  var grip=function(label){ return edit ? '<span class="dashGrip" aria-hidden="true">⠿ '+esc(label)+'</span>' : ''; };
  h+='<div id="dashBlocks">'+L.order.map(function(b){
    var inner = b==='apps' ? (qaBarHtml_() ? grip(t('Apps'))+qaBarHtml_() : '') : b==='widgets' ? grip(t('Widgets'))+dashWidgetsHtml_(c, L, edit) : dashRowHtml_(b.slice(4), edit);
    return inner ? '<div class="dashBlock" data-dashblock="'+esc(b)+'">'+inner+'</div>' : '';
  }).join('')+'</div>';
  return h;
}

/* ---- the add sheet: widgets and apps not on the card yet ---- */
function qaAddSheetHtml_(){
  var L=dashLayout_(), cat=qaCatalog_();
  var ws=DASH_W_EXTRA.filter(function(id){ return L.widgets.indexOf(id)<0; }).map(function(id){ return { id:id, w:dashWidget_(id, dashCtx_()) }; }).filter(function(x){ return x.w; });
  var apps=cat.filter(function(p){ return L.apps.indexOf(p.id)<0; });
  var wFull=L.widgets.length>=DASH_W_MAX, aFull=L.apps.length>=QA_MAX;
  var rs=DASH_ROW_EXTRA.filter(function(id){ return L.rows.indexOf(id)<0; });
  return '<div class="scrim" id="qaAddScrim" style="z-index:74"></div><div class="gtSheet" id="qaAddSheet" role="dialog" style="z-index:75">'+
    '<div class="gtSheetHead"><b>'+esc(t('Add to your dashboard'))+'</b></div>'+
    '<div class="qaPickHead">'+esc(t('Widgets'))+'</div>'+
    (ws.length && !wFull ? '<div class="qaPick">'+ws.map(function(x){ return '<button class="qaPickRow" data-qapick="w:'+x.id+'"><span class="qaIc qaPickW">'+x.w.inner+'</span><span>'+esc(x.w.title)+'</span><span class="qaPickAdd">＋</span></button>'; }).join('')+'</div>'
      : '<p class="sub">'+esc(wFull ? t('The dashboard is full — take one off first.') : t('Every widget is on your dashboard already.'))+'</p>')+
    (rs.length ? '<div class="qaPickHead">'+esc(t('Rows'))+'</div><div class="qaPick">'+rs.map(function(id){ return '<button class="qaPickRow" data-qapick="r:'+id+'"><span class="qaIc">📚</span><span>'+esc(t(DASH_ROW_NAME[id]))+'</span><span class="qaPickAdd">＋</span></button>'; }).join('')+'</div>' : '')+
    '<div class="qaPickHead">'+esc(t('Apps'))+'</div>'+
    (apps.length && !aFull ? '<div class="qaPick">'+apps.map(function(p){ return '<button class="qaPickRow" data-qapick="a:'+esc(p.id)+'">'+qaIconHtml_(p)+'<span>'+esc(p.label)+'</span><span class="qaPickAdd">＋</span></button>'; }).join('')+'</div>'
      : '<p class="sub">'+esc(aFull ? t('The dashboard is full — take one off first.') : t('Everything is on your bar already.'))+'</p>')+'</div>';
}
/* the figures the widgets need, worked out the way the card's own are */
function dashCtx_(){
  var rec=goalsForWeek(thisWeek()), written=(rec && rec.items ? rec.items : []).filter(function(i){ return i && i.text; });
  var goalsDone=written.filter(function(i){ return goalItemPct(i)>=100; }).length;
  var list=myHabitsToday(), log=logForDate(todayStr()), habitsDone=list.filter(function(hb){ return habitDoneToday(hb, log); }).length;
  var HH=homeHealth_(), score=HH.score;
  return { goalsPct: written.length ? goalsDone/written.length*100 : 0, goalsDone:goalsDone, goalsN:written.length,
    habitsPct: list.length ? habitsDone/list.length*100 : 0, habitsDone:habitsDone, habitsN:list.length,
    healthPct: score!==null ? score*10 : 0, score:score };
}

/* ---- saving ---- */
var _dashT=0;
function dashSave_(){
  clearTimeout(_dashT); _dashT=0;
  var L=dashLayout_();
  run('saveDashLayout',[S.auth.user,S.auth.pin,L],function(d){ if(!d || !d.ok) showMsg(t('Could not save — check your connection and try again.')); }, function(){});
}
function dashSoon_(){ clearTimeout(_dashT); _dashT=setTimeout(dashSave_, 600); }

/* ---- holding, tapping, editing ---- */
var _dash={ held:false, heldAt:0, swallowOn:false };
function dashEnter_(){ if(S.qaEdit) return; gpTap(); S.qaEdit=true; render(); }
function dashExit_(){ S.qaEdit=false; if(_dashT) dashSave_(); render(); }
/* while editing, a tap on the card's things does nothing; the tap that ends a hold never opens what was held */
function dashSwallow_(){
  if(_dash.swallowOn) return; _dash.swallowOn=true;
  document.addEventListener('click', function(e){
    var hero=e.target && e.target.closest ? e.target.closest('.myHero') : null; if(!hero) return;
    if(_dash.held && Date.now()-_dash.heldAt<900){ _dash.held=false; e.preventDefault(); e.stopPropagation(); return; }
    _dash.held=false;
    if(S.qaEdit && !e.target.closest('.qaX, #qaAdd, #qaDone, .dashEditBar')){ e.preventDefault(); e.stopPropagation(); }
  }, true);
}
function bindQuickApps_(){
  var hero=document.querySelector('.myHero'); if(!hero || !document.getElementById('qaBar') && !document.getElementById('dashWidgets')) return;
  if(!qaOn_()) return;
  dashSwallow_();
  hero.classList.toggle('dashEditing', !!S.qaEdit);
  /* what each thing opens */
  Array.prototype.forEach.call(hero.querySelectorAll('[data-qago]'), function(b){
    b.onclick=function(){ if(S.qaEdit) return; var id=b.getAttribute('data-qago'); var p=qaCatalog_().filter(function(x){ return x.id===id; })[0]; if(!p) return; gpTap(); p.go(); };
  });
  Array.prototype.forEach.call(hero.querySelectorAll('[data-dashgo]'), function(b){ b.onclick=function(){ if(!S.qaEdit) dashGo_(b.getAttribute('data-dashgo')); }; });
  /* hold anything on the card to arrange it */
  if(!S.qaEdit){
    var timer=0, x0=0, y0=0;
    hero.onpointerdown=function(e){
      if(!e.target.closest('.qaItem, .dashItem, .dashRow')) return;
      x0=e.clientX; y0=e.clientY; clearTimeout(timer);
      timer=setTimeout(function(){ _dash.held=true; _dash.heldAt=Date.now(); dashEnter_(); }, DASH_HOLD_MS);
    };
    hero.onpointermove=function(e){ if(timer && (Math.abs(e.clientX-x0)>8 || Math.abs(e.clientY-y0)>8)){ clearTimeout(timer); timer=0; } };
    hero.onpointerup=hero.onpointercancel=hero.onpointerleave=function(){ clearTimeout(timer); timer=0; };
    hero.oncontextmenu=function(e){ if(e.target.closest('.qaItem, .dashItem, .dashRow')) e.preventDefault(); };
  } else {
    hero.onpointerdown=hero.onpointermove=hero.onpointerup=hero.onpointercancel=hero.onpointerleave=null;
    hero.oncontextmenu=function(e){ e.preventDefault(); };
  }
  var eb=document.getElementById('qaEditBtn'); if(eb) eb.onclick=function(e){ e.stopPropagation(); dashEnter_(); };
  var done=document.getElementById('qaDone'); if(done) done.onclick=function(){ gpTap(); dashExit_(); };
  var add=document.getElementById('qaAdd'); if(add) add.onclick=function(){ gpTap(); qaAddOpen_(); };
  Array.prototype.forEach.call(hero.querySelectorAll('[data-dashrm]'), function(b){ b.onclick=function(e){ e.stopPropagation(); gpTap();
    var v=b.getAttribute('data-dashrm'), kind=v.slice(0,1), id=v.slice(2), L=dashLayout_();
    if(kind==='a' && DASH_LOCKED_APPS.indexOf(id)<0) L.apps=L.apps.filter(function(x){ return x!==id; });
    if(kind==='w' && DASH_W_LOCKED.indexOf(id)<0) L.widgets=L.widgets.filter(function(x){ return x!==id; });
    if(kind==='r' && DASH_ROWS.indexOf(id)<0) L.rows=L.rows.filter(function(x){ return x!==id; });
    dashSet_(L); render(); }; });
  if(S.qaEdit){
    dashDrag_(document.getElementById('qaBar'), '.qaItem[data-qa]', 'data-qa', function(ids){ var L=dashLayout_(); L.apps=ids; dashSet_(L); });
    dashDrag_(document.getElementById('dashWidgets'), '.dashItem[data-dashw]', 'data-dashw', function(ids){ var L=dashLayout_(); L.widgets=ids.concat(L.widgets.filter(function(x){ return ids.indexOf(x)<0; })); dashSet_(L); });
    dashDrag_(document.getElementById('dashBlocks'), '.dashBlock[data-dashblock]', 'data-dashblock', function(ids){ var L=dashLayout_(); L.order=ids.concat(L.order.filter(function(x){ return ids.indexOf(x)<0; })); dashSet_(L); },
      function(e){ return !!e.target.closest('.dashGrip, .dashRow'); });   // a whole block moves by its grip, or a row by itself — an app or a widget moves within its own group
  }
}
function qaAddOpen_(){
  var root=document.getElementById('qaAddRoot'); if(!root){ root=document.createElement('div'); root.id='qaAddRoot'; document.body.appendChild(root); }
  root.innerHTML=qaAddSheetHtml_();
  var shut=function(){ root.innerHTML=''; };
  document.getElementById('qaAddScrim').onclick=shut;
  Array.prototype.forEach.call(root.querySelectorAll('[data-qapick]'), function(b){ b.onclick=function(){ gpTap();
    var v=b.getAttribute('data-qapick'), kind=v.slice(0,1), id=v.slice(2), L=dashLayout_();
    if(kind==='a' && L.apps.indexOf(id)<0 && L.apps.length<QA_MAX) L.apps.push(id);
    if(kind==='w' && L.widgets.indexOf(id)<0 && L.widgets.length<DASH_W_MAX) L.widgets.push(id);
    if(kind==='r' && L.rows.indexOf(id)<0){ L.rows.push(id); L.order.push('row:'+id); }
    dashSet_(L); shut(); render(); }; });
}
/* dragging within one group: the held thing lifts, and the others make room as it passes over them. The window has
   the pointer while dragging, because moving the node in the page can drop the element's own pointer capture. */
function dashDrag_(box, sel, attr, done, startOk){
  if(!box) return;
  Array.prototype.forEach.call(box.querySelectorAll(sel), function(it){
    it.addEventListener('pointerdown', function(e){
      if(e.target.closest('.qaX')) return;
      if(startOk && !startOk(e)) return;
      e.preventDefault();
      var moved=false, x0=e.clientX, y0=e.clientY;
      it.classList.add('drag');
      var move=function(ev){
        if(Math.abs(ev.clientX-x0)>4 || Math.abs(ev.clientY-y0)>4) moved=true;
        var sibs=Array.prototype.filter.call(box.children, function(x){ return x!==it && x.matches(sel); }), over=null, best=1e9;
        sibs.forEach(function(x){ var r=x.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, d=Math.hypot(ev.clientX-cx, ev.clientY-cy);
          var inside=ev.clientX>=r.left && ev.clientX<=r.right && ev.clientY>=r.top && ev.clientY<=r.bottom; if(inside && d<best){ best=d; over=x; } });
        if(!over) return;
        var all=Array.prototype.filter.call(box.children, function(x){ return x.matches(sel); });
        if(all.indexOf(it)<all.indexOf(over)) box.insertBefore(it, over.nextSibling); else box.insertBefore(it, over);
      };
      var up=function(){
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        it.classList.remove('drag');
        if(moved) done(Array.prototype.filter.call(box.children, function(x){ return x.matches(sel); }).map(function(x){ return x.getAttribute(attr); }));
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  });
}
