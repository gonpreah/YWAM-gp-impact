/* ==================== GP Tasks (Oct 2026, Uriah) ====================
   "Much simpler and easy to use, very much like Google Tasks": lists with a title, tasks
   under them with a day and a time, subtasks, drag to reorder — and, for a campus that works
   as one team, each ministry's own list, people a task is given to, and asking another
   ministry for help (it shows in their list as a request they accept or decline). Campus
   Leadership and admins see every ministry's list, narrowed by a filter they keep as their
   default. Opened from My Home's card and the Weekly Goals heading (S.view='tasks'), from
   the Calendar, and folded under the ministry on My Ministry, where it shows only that
   ministry's list.
   Everyone starts with an Inbox (the server makes it): their own quick tasks, and everything
   given to them from any other list — a ministry's, the Leadership team's, someone's own — each
   with where it came from, and what they asked other ministries for. A task given to you stays in
   its list; dragging it onto one of your own lists files it there for you alone (`filed`). The
   lists you add are private. The server's rules are in api.js. */
S.gpt=null; S.gptLoading=false; S.gptErr=''; S.gptList=null; S.gptOpen=null; S.gptDraft=null; S.gptScope=null; S.gptPageScope=null;
S.gptNewList=null; S.gptAsk=null; S.gptFilterOpen=false; S.gptFilterDraft=null; S.gptListMenu=false; S.gptDoneOpen=false; S.gptFrom='week';
/* plain line icons, the app's own kind (Uriah: "simple, modern — not the green tick emoji");
   they take the text's size and colour, so they sit in a heading, a chip or a button alike */
var GPT_SVG=(function(){
  var o='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  return {
    tasks:   o+'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/></svg>',
    details: o+'<path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    clock:   o+'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    person:  o+'<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    plus:    o+'<path d="M12 5v14M5 12h14"/></svg>',
    team:    o+'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 19c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 13.5c2.6 0 4.6 1.6 5.5 4.5"/></svg>',
    lock:    o+'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    inbox:   o+'<path d="M3 13l2.5-8h13L21 13"/><path d="M3 13v6h18v-6"/><path d="M3 13h5l1.5 3h5L16 13h5"/></svg>',
    search:  o+'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    sub:     o+'<path d="M7 4v9a3 3 0 0 0 3 3h8"/><path d="M14 12l4 4-4 4"/></svg>',
    grip:    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    calendar:o+'<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>'
  };
})();
function gptIc_(k, cls){ return '<span class="gtIc'+(cls?' '+cls:'')+'" aria-hidden="true">'+GPT_SVG[k]+'</span>'; }
function gptLoad_(){
  if(S.gptLoading) return; S.gptLoading=true; S.gptErr='';
  run('getGpTasks',[S.auth.user,S.auth.pin],function(d){ S.gptLoading=false; if(d && d.ok) gptTake_(d); else S.gptErr=(d && d.err) || 'error'; render(); },
    function(){ S.gptLoading=false; S.gptErr='offline'; render(); });
}
function gptTake_(d){
  d.lists=Array.isArray(d.lists) ? d.lists : []; d.tasks=Array.isArray(d.tasks) ? d.tasks : [];
  S.gpt=d;
  var mine=(d.tasks||[]).filter(function(t){ return !t.done && t.status!=='declined' && t.assignees.indexOf(S.me.id)>-1; });
  if(S.gpTaskInfo){ S.gpTaskInfo.open=mine.length; S.gpTaskInfo.inbox=gptInboxCount_(); }
}
/* the red number: what is in your Inbox — its own open tasks, and what you were given and haven't filed elsewhere */
function gptInboxCount_(){
  var G=S.gpt, m=gptMain_(); if(!G || !m) return (S.gpTaskInfo && S.gpTaskInfo.inbox) || 0;
  return G.tasks.filter(function(x){ return !x.done && x.status!=='declined' && (x.listId===m.id || (gptGiven_(x) && gptFiledIn_(x)===m.id)); }).length;
}
function gptBadge_(n){ return n ? '<span class="gtBadge">'+n+'</span>' : ''; }
function gptKeyOf_(L){ return L.dept+'|'+(L.scope==='ministry' ? L.ministry : ''); }
function gptListById_(id){ return ((S.gpt && S.gpt.lists)||[]).filter(function(L){ return L.id===id; })[0] || null; }
function gptPerson_(id){ var p=personOf(id); return p || { id:id, name:nameOf(id) }; }
/* your Inbox: your first personal list — the server makes one for everyone */
function gptMain_(){
  var G=S.gpt; if(!G) return null;
  return G.lists.filter(function(L){ return L.scope==='personal' && L.ownerId===S.me.id; }).sort(function(a,b){ return (a.order||0)-(b.order||0); })[0] || null;
}
/* a designated list is named after its ministry (or "Leadership team"), so it reads in Khmer too */
function gptIsMain_(L){ var m=gptMain_(); return !!(m && L && L.id===m.id); }
function gptTitle_(L){ return (gptIsMain_(L) || L.title==='My Tasks' || L.title==='Inbox') ? t('Inbox') : L.title==='Leadership team' ? t('Leadership team') : (L.scope!=='personal' && L.title===(L.ministry||L.dept)) ? t(L.title) : L.title; }
function gptKindIc_(L){ return gptIc_(gptIsMain_(L) ? 'inbox' : L.scope==='personal' ? 'lock' : 'team', 'gtKind'); }
/* where a task given to you sits among your lists: where you filed it, else your Inbox */
function gptFiledIn_(x){ var f=x.filed && x.filed[S.me.id]; var L=f && gptListById_(f.list); return L && L.scope==='personal' && L.ownerId===S.me.id ? L.id : (gptMain_()||{}).id; }
function gptGiven_(x){ return x.listId!==(gptMain_()||{}).id && (x.assignees.indexOf(S.me.id)>-1 || (x.by===S.me.id && (x.status==='request' || x.status==='declined'))); }
/* the name a task carries when it shows away from its list */
function gptChipName_(L){ return L.scope==='personal' && L.ownerId!==S.me.id ? gpT('{name}’s list',{name:firstName_(gptPerson_(L.ownerId).name)}) : gptTitle_(L); }
/* the lists to show: a ministry's own (My Ministry's fold — only that ministry's, nothing personal),
   or all you see — Campus Leadership's narrowed by their saved filter (your own ministries' and your
   personal lists always show), My Tasks first, then in the order you dragged them into */
function gptLists_(scope){
  var G=S.gpt; if(!G) return [];
  /* never someone else's personal list (Uriah: "why is Vannak's list in my GP Tasks?") — what they give you is in your Inbox */
  var lists=G.lists.filter(function(L){ return !L.onlyAssigned && !(L.scope==='personal' && L.ownerId!==S.me.id); });
  if(scope) return lists.filter(function(L){ return L.dept===scope.dept && (scope.min ? L.scope==='ministry' && L.ministry===scope.min : L.scope==='dept'); });
  /* Campus Leadership and admins: only your own by default (Andrew, Oct 2026: "why are there random
     ministries I'm not part of on my list?") — other ministries' lists only once ticked in ⋮ */
  var f=(G.filter && G.filter.keys) || [];
  if(G.canAll) lists=lists.filter(function(L){ return L.scope==='personal' || L.mine || f.indexOf(gptKeyOf_(L))>-1; });
  var main=gptMain_(), ord=G.listOrder||[];
  var rank=function(L){ return main && L.id===main.id ? 0 : L.scope==='personal' ? 2 : L.mine ? 1 : 3; };
  return lists.slice().sort(function(a,b){
    var ia=ord.indexOf(a.id), ib=ord.indexOf(b.id);
    if(ia>-1 && ib>-1) return ia-ib; if(ia>-1 || ib>-1) return ia>-1 ? -1 : 1;
    return rank(a)-rank(b) || String(a.dept+a.ministry+a.title).localeCompare(String(b.dept+b.ministry+b.title)); });
}
function gptListLabel_(L){
  if(gptIsMain_(L)) return t('Yours, and what’s given to you — drag a task onto one of your lists to file it');
  if(L.scope==='personal') return L.ownerId===S.me.id ? t('Personal · only you') : gpT('{name}’s list',{name:firstName_(gptPerson_(L.ownerId).name)});
  return (L.scope==='dept' ? gpT('{dept} · whole department',{dept:t(L.dept)}) : t(L.ministry)+' · '+t(L.dept))+' — '+t('the ministry’s list: add tasks and give them to its people');
}
function gptWhen_(x){
  if(!x.due) return '';
  var d=new Date(x.due+'T'+(x.time||'12:00')), today=todayStr(), s;
  var tm=new Date(); tm.setDate(tm.getDate()+1); var tomorrow=tm.getFullYear()+'-'+('0'+(tm.getMonth()+1)).slice(-2)+'-'+('0'+tm.getDate()).slice(-2);
  s = x.due===today ? t('Today') : x.due===tomorrow ? t('Tomorrow') : d.toLocaleDateString(LANG==='km'?'km-KH':'en-GB', { weekday:'short', day:'numeric', month:'short' });
  if(x.time) s+=', '+d.toLocaleTimeString(LANG==='km'?'km-KH':'en-US', { hour:'numeric', minute:'2-digit' });
  return s;
}
function gptOverdue_(x){ return !x.done && x.due && x.due<todayStr(); }
/* "My order", like Google Tasks: where you dragged it; new ones at the end. In one of your own lists a
   task given to you sits where you filed it. */
function gptOrderIn_(x, L){ if(x.listId===L.id) return x.order||0; var f=x.filed && x.filed[S.me.id]; return f && f.list===L.id && f.order!=null ? f.order : 1e9; }
function gptSortIn_(L){ return function(a,b){ return gptOrderIn_(a,L)-gptOrderIn_(b,L) || String(a.created).localeCompare(String(b.created)); }; }
/* ---- the page, like Google Tasks (Uriah, Oct 2026: "simple, like Google Tasks — the only thing is you
   can assign people"): list tabs across the top (My Tasks first) with ⋮ for the list's options; rows
   with a circle to tick, the title, small chips for the day and the person, subtasks under it, and a
   grip to drag it up or down or onto another list's tab; a round ＋ that opens "New task" with
   details, date/time and assign as one tap each; a task opens in a sheet to change it;
   "＋ New list" opens a small sheet for the name — lists are added as you go. ---- */
S.gtNew=null; S.gtMenu=false;
function gptPageHtml_(scope, embedded){
  var h='';
  S.gptScope=scope||null;
  /* the ministry's page (Uriah, Oct 2026: "like the personal GP Tasks, just that ministry's tasks") is the same page, with its list */
  if(!embedded) h+='<button class="linkbtn" id="gptBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(S.gptFrom==='ministry' ? t('My Ministry') : S.gptFrom==='calendar' ? t('Calendar') : t('My Home'))+'</button>'+
    '<h2 class="gtTitle">'+gptIc_('tasks')+' '+esc(t('GP Tasks'))+(scope ? ' · '+esc(t(scope.min||scope.dept)) : '')+'</h2>';
  if(!S.gpt){ if(!S.gptLoading && !S.gptErr) setTimeout(gptLoad_, 0); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.gptErr ? t('Couldn’t load the tasks — pull down to try again.') : t('Loading…'))+'</p></div>'; }
  var G=S.gpt, lists=gptLists_(scope);
  var ids=lists.map(function(L){ return L.id; });
  if(ids.indexOf(S.gptList)===-1) S.gptList=ids[0] || null;
  /* the tabs — hold one and drag it to change their order */
  h+='<div class="gtBar"><div class="gtTabs" role="tablist">'+
    lists.map(function(L){ return '<button class="gtTab'+(S.gptList===L.id?' on':'')+'" data-gptlist="'+esc(L.id)+'" role="tab">'+gptKindIc_(L)+esc(gptChipName_(L))+(gptIsMain_(L) ? gptBadge_(gptInboxCount_()) : '')+'</button>'; }).join('')+
    (scope ? '' : '<button class="gtTab gtNewList" id="gptNewListBtn">＋ '+esc(t('New list'))+'</button>')+'</div>'+
    '<button class="gtMenuBtn" id="gtMenuBtn" aria-label="'+esc(t('List options'))+'">⋮</button></div>';
  if(S.gtMenu) h+=gtMenuHtml_(scope);
  if(S.gptNewList) h+=gptNewListHtml_();
  if(S.gptAsk) h+=gptAskHtml_();
  if(S.gptFilterOpen && G.canAll && !scope) h+=gptFilterHtml_();
  if(!S.gptList){
    h+='<div class="gtEmpty"><div class="gtEmptyIc">'+GPT_SVG.tasks+'</div><p>'+esc(scope ? gpT('{ministry} has no task list yet — make one, and everyone in it shares it.',{ministry:t(scope.min||scope.dept)}) : t('No lists yet.'))+'</p>'+
      (scope ? '<button class="btn" data-gptmakefor="'+esc(scope.dept+'|'+(scope.min||''))+'">＋ '+esc(gpT('Make a list for {ministry}',{ministry:t(scope.min||scope.dept)}))+'</button>' : '')+'</div>';
    return h;
  }
  var L=gptListById_(S.gptList);
  h+=gtListHtml_(L);
  /* add: the round ＋ on the page; inside My Ministry, a plain row */
  var canAdd=L.canEdit || L.scope!=='personal';
  if(canAdd) h+='<button class="gtFab" id="gtAdd" aria-label="'+esc(L && !L.canEdit ? gpT('Ask {name} for help',{name:t(L.ministry||L.dept)}) : t('Add a task'))+'">'+GPT_SVG.plus+'</button>';
  if(S.gtNew) h+=gtNewHtml_();
  if(S.gptOpen) h+=gtDetailHtml_();
  return h;
}
/* ⋮ — everything that isn't adding or ticking off */
function gtMenuHtml_(scope){
  var G=S.gpt, L=S.gptList ? gptListById_(S.gptList) : null, it=function(id, label){ return '<button class="gtMenuIt" id="'+id+'">'+label+'</button>'; };
  var main=gptMain_(), isMain=!!(L && main && L.id===main.id);
  return '<div class="scrim" id="gtMenuScrim"></div><div class="gtMenu" role="menu">'+
    (L && L.canEdit && !isMain ? it('gtRename', '✏️ '+esc(t('Rename list'))) : '')+
    (!scope ? it('gptAskBtn', '🤝 '+esc(t('Ask another ministry for help'))) : '')+
    (G.canAll && !scope ? it('gptFilterBtn', '⚙️ '+esc(t('Which lists to show'))) : '')+
    (L && L.canEdit && !isMain ? it('gptListDelete', '🗑 '+esc(t('Delete the list'))) : '')+'</div>';
}
function gtListHtml_(L){
  var G=S.gpt, mine=L.scope==='personal' && L.ownerId===S.me.id;
  /* one of your own lists: its tasks, and the tasks given to you that you keep here (unfiled ones in the Inbox) */
  var all=G.tasks.filter(function(x){ return x.listId===L.id ? x.status!=='declined' : (mine && gptGiven_(x) && gptFiledIn_(x)===L.id); });
  var open=all.filter(function(x){ return !x.done; }).sort(function(a,b){ return (a.status==='request')-(b.status==='request') || gptSortIn_(L)(a,b); });
  var done=all.filter(function(x){ return x.done; });
  var h='<div class="gtList"><div class="gtListHead"><b>'+gptKindIc_(L)+esc(gptChipName_(L))+'</b><span>'+esc(gptListLabel_(L))+'</span></div>';
  if(!open.length) h+='<div class="gtEmpty small"><div class="gtEmptyIc">'+GPT_SVG.tasks+'</div><p>'+esc(t('No tasks yet.'))+'</p></div>';
  h+='<div class="gtOpen" data-gptorder="'+esc(L.id)+'">'+open.map(function(x){ return gtItemHtml_(x, L); }).join('')+'</div>';
  if(done.length) h+='<button class="gtDoneHead" id="gptDoneToggle" aria-expanded="'+(S.gptDoneOpen?'true':'false')+'">'+esc(gpT('Completed ({n})',{n:done.length}))+' <span>'+(S.gptDoneOpen?'⌃':'⌄')+'</span></button>'+
    (S.gptDoneOpen ? '<div class="gtDone">'+done.map(function(x){ return gtItemHtml_(x, L); }).join('')+'</div>'+(L.canEdit ? '<button class="linkbtn inline" id="gptClearDone">'+esc(t('Clear completed'))+'</button>' : '') : '');
  return h+'</div>';
}
/* one task: its row, its subtasks under it, and a request's answer buttons */
function gtItemHtml_(x, L){
  var req=x.status==='request', dec=x.status==='declined', canDrag=L && L.canEdit && !req && !dec && !x.done;
  var showList=x.listId!==L.id, SL=showList ? gptListById_(x.listId) : L;   // the list it is really in
  var chips=[];
  if(x.due) chips.push('<span class="gtChip'+(gptOverdue_(x)?' late':'')+'">'+GPT_SVG.clock+esc(gptWhen_(x))+'</span>');
  x.assignees.forEach(function(id){ chips.push('<span class="gtChip who">'+GPT_SVG.person+esc(firstName_(gptPerson_(id).name))+'</span>'); });
  if(x.from && x.from.label && x.by!==S.me.id) chips.push('<span class="gtChip from">'+esc(gpT('from {who}',{who:t(x.from.label)}))+'</span>');
  if(showList && SL) chips.push('<span class="gtChip list">'+gptIc_(SL.scope==='personal' ? 'person' : 'team')+esc(gptChipName_(SL))+'</span>');
  if(req) chips.push('<span class="gtChip req">'+esc(x.by===S.me.id ? gpT('Asked — waiting for {name}',{name:t((SL&&(SL.ministry||SL.dept))||'')}) : t('Request'))+'</span>');
  if(dec) chips.push('<span class="gtChip late">'+esc(t('They can’t take it on'))+'</span>');
  var subs=x.subs||[], subsDone=subs.filter(function(s){ return s.done; }).length;
  if(subs.length && x.done) chips.push('<span class="gtChip">'+GPT_SVG.sub+subsDone+'/'+subs.length+'</span>');
  var answer = req && L && x.by!==S.me.id && (L.mine || x.assignees.indexOf(S.me.id)>-1 || (S.gpt.canAll && !L.onlyAssigned));
  return '<div class="gtItem" data-gptitem="'+esc(x.id)+'">'+
    '<div class="gtRow'+(x.done?' done':'')+(req?' req':'')+'" data-gptrow="'+esc(x.id)+'">'+
    '<button class="gtCheck'+(x.done?' on':'')+'" data-gptdone="'+esc(x.id)+'"'+(req||dec?' disabled':'')+' aria-label="'+esc(x.done ? t('Mark not done') : t('Mark done'))+'">'+(x.done?'✓':'')+'</button>'+
    '<button class="gtMain" data-gptopen="'+esc(x.id)+'"><span class="gtT">'+esc(x.title)+'</span>'+
      (x.notes ? '<span class="gtNotes">'+esc(String(x.notes).split('\n')[0].slice(0,80))+'</span>' : '')+
      (chips.length ? '<span class="gtChips">'+chips.join('')+'</span>' : '')+'</button>'+
    (canDrag ? '<span class="gtGrip" data-gptgrip="'+esc(x.id)+'" aria-label="'+esc(t('Drag to move'))+'">'+GPT_SVG.grip+'</span>' : '')+'</div>'+
    (subs.length && !x.done ? '<div class="gtSubs">'+subs.map(function(s){ return '<div class="gtSub'+(s.done?' done':'')+'"><button class="gtCheck small'+(s.done?' on':'')+'" data-gptsubtick="'+esc(x.id)+'|'+esc(s.id)+'" aria-label="'+esc(s.done ? t('Mark not done') : t('Mark done'))+'">'+(s.done?'✓':'')+'</button><span>'+esc(s.text)+'</span></div>'; }).join('')+'</div>' : '')+
    (answer ? '<div class="gtReq">'+esc(gpT('{name} is asking for help.',{name:firstName_(gptPerson_(x.by).name)}))+
      ' <button class="btn small" data-gptaccept="'+esc(x.id)+'">'+esc(t('We’ll do it'))+'</button><button class="btn small ghost" data-gptdecline="'+esc(x.id)+'">'+esc(t('Can’t'))+'</button></div>' : '')+'</div>';
}
/* New task — the sheet from the round ＋, into the list that is open */
function gtNewHtml_(){
  var N=S.gtNew, L=gptListById_(N.listId);
  var whoName=N.who ? firstName_(gptPerson_(N.who).name) : '';
  var asks=L && !L.canEdit;
  return '<div class="scrim" id="gtNewScrim"></div><div class="gtSheet" id="gtNew" role="dialog" aria-label="'+esc(t('New task'))+'">'+
    (asks ? '<p class="hint gtAsks">🤝 '+esc(gpT('A request to {name} — they say whether they can take it on.',{name:t(L.ministry||L.dept)}))+'</p>' : '')+
    '<input type="text" id="gptAddInput" class="gtNewTitle" maxlength="200" placeholder="'+esc(t('New task'))+'" value="'+esc(N.title||'')+'">'+
    (N.showNotes ? '<textarea id="gtNewNotes" rows="2" maxlength="2000" placeholder="'+esc(t('Add details'))+'">'+esc(N.notes||'')+'</textarea>' : '')+
    (N.showWhen ? '<div class="gtWhen"><input type="date" id="gptAddDue" value="'+esc(N.due||'')+'" aria-label="'+esc(t('Set date'))+'"><input type="time" id="gptAddTime" step="900" value="'+esc(N.time||'')+'" aria-label="'+esc(t('Set time'))+'"></div>' : '')+
    '<div class="gtTools">'+
      '<button class="gtTool'+(N.showNotes?' on':'')+'" id="gtNewNotesBtn" aria-label="'+esc(t('Add details'))+'">'+GPT_SVG.details+'</button>'+
      '<button class="gtTool'+(N.showWhen||N.due?' on':'')+'" id="gtNewWhenBtn" aria-label="'+esc(t('Set date and time'))+'">'+GPT_SVG.clock+'</button>'+
      '<label class="gtTool gtWho'+(N.who?' on':'')+'">'+GPT_SVG.person+(whoName ? ' '+esc(whoName) : '')+'<select id="gptAddWho" aria-label="'+esc(t('Assign to'))+'"><option value="">'+esc(t('Nobody'))+'</option>'+gptPeopleOptions_(L, [])+'</select></label>'+
      '<span style="flex:1"></span><button class="gtSave" id="gptAddBtn">'+esc(t('Save'))+'</button></div></div>';
}
/* a task, opened — with its subtasks */
function gtDetailHtml_(){
  var x=(S.gpt.tasks||[]).filter(function(y){ return y.id===S.gptOpen; })[0]; if(!x) return '';
  var L=gptListById_(x.listId);
  var D=S.gptDraft && S.gptDraft.id===x.id ? S.gptDraft : (S.gptDraft={ id:x.id, title:x.title, notes:x.notes, due:x.due, time:x.time, assignees:x.assignees.slice(), subs:(x.subs||[]).map(function(s){ return { id:s.id, text:s.text, done:!!s.done }; }), subNew:'' });
  var canAll=L && L.canEdit, canEdit=canAll || x.by===S.me.id || x.assignees.indexOf(S.me.id)>-1, canAssign=canAll || x.by===S.me.id;
  var ro=canEdit ? '' : ' readonly';
  return '<div class="scrim" id="gtDetScrim"></div><div class="gtSheet gtDetail" id="gtDetail" role="dialog" aria-label="'+esc(x.title)+'">'+
    '<div class="gtDetTop"><button class="gtTool" id="gptClose" aria-label="'+esc(t('Close'))+'">←</button><span class="gtDetList">'+esc(L ? gptChipName_(L) : '')+'</span>'+
      ((canAll || x.by===S.me.id) ? '<button class="gtTool" id="gptDelete" aria-label="'+esc(t('Delete'))+'">🗑</button>' : '')+'</div>'+
    '<textarea class="gtDetTitle" data-gptd="title" rows="1" maxlength="200"'+ro+'>'+esc(D.title)+'</textarea>'+
    '<label class="gtLine">'+gptIc_('details')+'<textarea data-gptd="notes" rows="2" maxlength="2000" placeholder="'+esc(t('Add details'))+'"'+ro+'>'+esc(D.notes||'')+'</textarea></label>'+
    '<div class="gtLine">'+gptIc_('clock')+'<span class="gtWhen"><input type="date" data-gptd="due" value="'+esc(D.due||'')+'" aria-label="'+esc(t('Set date'))+'"'+(canEdit?'':' disabled')+'><input type="time" data-gptd="time" value="'+esc(D.time||'')+'" step="900" aria-label="'+esc(t('Set time'))+'"'+(D.due && canEdit ? '' : ' disabled')+'></span>'+(D.due ? '' : '<span class="gtHint">'+esc(t('Set date and time'))+'</span>')+'</div>'+
    '<div class="gtLine">'+gptIc_('person')+'<span class="gtPeople">'+D.assignees.map(function(id){ return '<span class="gtChip who">'+esc(gptPerson_(id).name)+(canAssign ? ' <button class="gptX" data-gptunassign="'+esc(id)+'" aria-label="'+esc(t('Remove'))+'">×</button>' : '')+'</span>'; }).join('')+
      (canAssign ? '<select id="gptAssignSel"><option value="">'+esc(D.assignees.length ? t('＋ Add someone') : t('Assign to…'))+'</option>'+gptPeopleOptions_(L, D.assignees)+'</select>' : (D.assignees.length ? '' : '<span class="gtHint">'+esc(t('nobody yet'))+'</span>'))+'</span></div>'+
    '<div class="gtLine gtSubLine">'+gptIc_('sub')+'<div class="gtSubEdit">'+
      D.subs.map(function(s, i){ return '<div class="gtSub'+(s.done?' done':'')+'"><button class="gtCheck small'+(s.done?' on':'')+'" data-gptdsub="'+i+'" aria-label="'+esc(t('Mark done'))+'">'+(s.done?'✓':'')+'</button>'+
        (canEdit ? '<input type="text" data-gptdsubtext="'+i+'" maxlength="200" value="'+esc(s.text)+'"><button class="gptX" data-gptdsubdel="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button>' : '<span>'+esc(s.text)+'</span>')+'</div>'; }).join('')+
      (canEdit ? '<input type="text" id="gptSubNew" maxlength="200" placeholder="'+esc(D.subs.length ? t('Add a subtask') : t('Add a subtask — a small step inside this task'))+'" value="'+esc(D.subNew||'')+'">' : (D.subs.length ? '' : '<span class="gtHint">'+esc(t('no subtasks'))+'</span>'))+'</div></div>'+
    (x.from && x.from.label ? '<p class="gtHint" style="margin:6px 0 0 30px">'+esc(gpT('from {who}',{who:t(x.from.label)}))+'</p>' : '')+
    (x.status==='request' ? '' : '<button class="btn gtDoneBtn" data-gptdone="'+esc(x.id)+'">'+esc(x.done ? t('Mark not done') : t('Mark completed'))+'</button>')+
    (canEdit ? '<button class="btn ghost" id="gptSave">'+esc(t('Save'))+'</button>' : '')+'</div>';
}
/* asking another ministry: it lands in their list as a request they accept or decline */
function gptAskHtml_(){
  var A=S.gptAsk, deps=getDepartments(S.me.campus), q=String(A.find||'').trim().toLowerCase();
  var h='<div class="card gptNewList"><div class="goalCardTitle">🤝 '+esc(t('Ask another ministry for help'))+'</div>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(t('It shows in their list as a request; they say whether they can take it on.'))+'</p>'+
    '<label class="f">'+esc(t('Which ministry'))+'</label>';
  if(A.min){   // chosen — one line, tap to change
    var p=A.min.split('|');
    h+='<button class="gtPicked" id="gptAskChange">'+gptIc_('team')+' <b>'+esc(t(p[1]||p[0]))+'</b> <span>'+esc(t(p[0]))+'</span><span class="gtPickedChange">'+esc(t('Change'))+'</span></button>';
  } else {   // by department, or search the name
    h+='<label class="gtFind">'+gptIc_('search')+'<input type="search" id="gptAskFind" value="'+esc(A.find||'')+'" placeholder="'+esc(t('Search a ministry'))+'" autocomplete="off"></label><div class="gtPick">';
    var any=false;
    Object.keys(deps).sort().forEach(function(d){
      var ms=Object.keys(deps[d]||{}).filter(function(m){ return !(d===S.me.dept && m===S.me.ministry) && (!q || (t(m)+' '+m+' '+t(d)+' '+d).toLowerCase().indexOf(q)>-1); });
      if(!ms.length) return; any=true;
      h+='<div class="gtPickDept">'+esc(t(d))+'</div>'+ms.map(function(m){ return '<button class="gtPickIt" data-gptaskmin="'+esc(d+'|'+m)+'">'+esc(t(m))+'</button>'; }).join('');
    });
    if(!any) h+='<p class="sub" style="margin:6px 0">'+esc(t('No ministry by that name.'))+'</p>';
    h+='</div>';
  }
  return h+'<label class="f">'+esc(t('What do you need?'))+'</label><input type="text" id="gptAskTitle" maxlength="200" value="'+esc(A.title||'')+'" placeholder="'+esc(t('e.g. Coffee for the team arriving Friday'))+'">'+
    '<label class="f">'+esc(t('By when (optional)'))+'</label><input type="date" id="gptAskDue" value="'+esc(A.due||'')+'">'+
    '<div class="btnRow"><button class="btn" id="gptAskSend">'+esc(t('Send the request'))+'</button><button class="btn ghost" id="gptAskCancel">'+esc(t('Cancel'))+'</button></div></div>';
}
function gptFilterHtml_(){
  var G=S.gpt, D=S.gptFilterDraft, keys={};
  G.lists.forEach(function(L){ if(L.scope!=='personal' && !L.onlyAssigned) keys[gptKeyOf_(L)]=1; });
  var byDept={}; Object.keys(keys).sort().forEach(function(k){ var p=k.split('|'); (byDept[p[0]]=byDept[p[0]]||[]).push(k); });
  var h='<div class="card gptFilter"><div class="goalCardTitle">⚙️ '+esc(t('Which lists to show'))+'</div>'+
    '<p class="hint" style="margin:0 0 8px">'+esc(t('Your own lists always show. Tick the other ministries you want here too — saved as your default, change it any time.'))+'</p>';
  if(!Object.keys(byDept).length) h+='<p class="sub" style="margin:0">'+esc(t('No ministry has a list yet.'))+'</p>';
  Object.keys(byDept).forEach(function(d){
    h+='<div class="gptFDept"><b>'+esc(t(d))+'</b>'+byDept[d].map(function(k){ var m=k.split('|')[1];
      return '<label class="remBox"><input type="checkbox" data-gptf="'+esc(k)+'"'+((D||[]).indexOf(k)>-1 ? ' checked' : '')+'> '+esc(m ? t(m) : t('Whole department'))+'</label>'; }).join('')+'</div>';
  });
  return h+'<div class="btnRow"><button class="btn" id="gptFilterSave">'+esc(t('Save as my default'))+'</button><button class="btn ghost" id="gptFilterAll">'+esc(t('Show everything'))+'</button><button class="btn ghost" id="gptFilterNone">'+esc(t('Only mine'))+'</button></div></div>';
}
/* New list — a small sheet for the name. A new list is always your own (Uriah: "each person can add
   as many lists as they want in their own GP Tasks"); a ministry has the one list the server makes. */
function gptNewListHtml_(){
  var N=S.gptNewList;
  return '<div class="scrim" id="gptNewCancel"></div><div class="gtSheet" id="gptNewListSheet" role="dialog" aria-label="'+esc(t('New list'))+'">'+
    '<div class="gtSheetHead"><b>'+esc(t('New list'))+'</b></div>'+
    '<input type="text" id="gptNewTitle" class="gtNewTitle" maxlength="80" value="'+esc(N.title||'')+'" placeholder="'+esc(t('List name'))+'">'+
    '<p class="hint" style="margin:0">'+gptIc_('lock')+' '+esc(t('A personal list — only you see it. Give someone a task and it reaches them.'))+'</p>'+
    '<div class="gtTools"><span style="flex:1"></span><button class="gtSave" id="gptNewSave">'+esc(t('Done'))+'</button></div></div>';
}
/* who a task can be given to: the list's own people first, under the ministry's (or department's)
   name, then everyone else on the campus (Uriah, Oct 2026: "assign people in that ministry") */
function gptInList_(L, p){ return !!L && L.scope!=='personal' && (L.scope==='dept' ? p.dept===L.dept : (p.dept===L.dept && p.ministry===L.ministry) || (p.ministries||[]).indexOf(L.dept+'|'+L.ministry)>-1 || (p.leads||[]).indexOf(L.dept+'|'+L.ministry)>-1); }
function gptPeopleOptions_(L, skip){
  var people=(S.roster||[]).filter(function(p){ return p.campus===((L&&L.campus)||S.me.campus) && (skip||[]).indexOf(p.id)===-1; })
    .sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  var mine=people.filter(function(p){ return gptInList_(L, p); }), rest=people.filter(function(p){ return !gptInList_(L, p); });
  var opt=function(p, other){ return '<option value="'+esc(p.id)+'">'+esc(p.name)+(other ? ' · '+esc(t(p.ministry||p.dept||'')) : '')+'</option>'; };
  if(!mine.length) return rest.map(function(p){ return opt(p, true); }).join('');
  return '<optgroup label="'+esc(L.scope==='dept' ? t(L.dept) : t(L.ministry))+'">'+mine.map(function(p){ return opt(p, false); }).join('')+'</optgroup>'+
    (rest.length ? '<optgroup label="'+esc(t('Everyone else'))+'">'+rest.map(function(p){ return opt(p, true); }).join('')+'</optgroup>' : '');
}
function gptSaveTask_(payload, msg, after){
  run('saveGpTask',[S.auth.user,S.auth.pin,payload],function(d){
    if(d && d.ok){ gptTake_(d); if(after) after(d); if(msg) showMsg(msg); }
    else showMsg(d && d.err==='title_required' ? t('Give it a title first') : t('Could not save'));
    render();
  }, function(){ showMsg(t('No connection — try again when you are online.')); });
}
/* ---- drag and drop: a task by its grip (at once), a tab after a short hold on touch — mouse or finger.
   The thing moves live among its siblings; letting go gives back their order, or the tab it was dropped on. ---- */
S.gtDragEnd=0;
function gptDrag_(handles, o){
  handles.forEach(function(hd){
    var start=function(ev, touch){
      var p=touch ? ev.touches[0] : ev, item=hd.closest(o.itemSel); if(!item || !p) return;
      var st={ on:false, x:p.clientX, y:p.clientY, target:null }, timer=null;
      var begin=function(){ st.on=true; item.classList.add('gtDragging'); document.body.classList.add('gtDragOn'); };
      if(!o.hold) begin(); else if(touch) timer=setTimeout(begin, o.hold);
      var mv=touch?'touchmove':'mousemove', up=touch?'touchend':'mouseup';
      var move=function(e){
        var q=e.touches ? e.touches[0] : e; if(!q) return;
        if(!st.on){ if(Math.abs(q.clientX-st.x)+Math.abs(q.clientY-st.y)<8) return; if(timer){ clearTimeout(timer); timer=null; if(touch){ stop(); return; } } begin(); }
        if(e.cancelable) e.preventDefault();
        var el=document.elementFromPoint(q.clientX, q.clientY); if(!el) return;
        document.querySelectorAll('.gtDrop').forEach(function(x){ x.classList.remove('gtDrop'); }); st.target=null;
        var d=o.dropSel ? el.closest(o.dropSel) : null;
        if(d && d.getAttribute(o.dropAttr)!==o.self){ d.classList.add('gtDrop'); st.target=d.getAttribute(o.dropAttr); return; }
        var over=el.closest(o.itemSel);
        if(over && over!==item && over.parentNode===item.parentNode){
          var r=over.getBoundingClientRect(), after = o.axis==='x' ? q.clientX > r.left+r.width/2 : q.clientY > r.top+r.height/2;
          over.parentNode.insertBefore(item, after ? over.nextSibling : over);
        }
      };
      var stop=function(){
        if(timer) clearTimeout(timer);
        document.removeEventListener(mv, move); document.removeEventListener(up, stop);
        document.querySelectorAll('.gtDrop').forEach(function(x){ x.classList.remove('gtDrop'); });
        if(!st.on) return;
        item.classList.remove('gtDragging'); document.body.classList.remove('gtDragOn'); S.gtDragEnd=Date.now();
        o.onEnd([].map.call(item.parentNode.querySelectorAll(o.itemSel), function(x){ return x.getAttribute(o.idAttr); }), st.target);
      };
      document.addEventListener(mv, move, { passive:false }); document.addEventListener(up, stop);
      if(!touch) ev.preventDefault();
    };
    hd.addEventListener('mousedown', function(e){ if(e.button===0) start(e, false); });
    hd.addEventListener('touchstart', function(e){ start(e, true); }, { passive:true });
  });
}
function bindGpTasks_(){
  var mt=document.getElementById('mtToggle');
  if(mt) mt.onclick=function(){ gpTap(); gptOpenMinistry_(mt.getAttribute('data-mtdept'), mt.getAttribute('data-mtmin')); };
  if(!document.querySelector('.gtBar, #gptBack, [data-gptmakefor]')) return;
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; return el; };
  var scope=S.gptScope;
  on('gptBack', function(){ gpTap(); S.view=S.gptFrom==='ministry' ? 'ministry' : S.gptFrom==='calendar' ? 'calendar' : 'week'; render(); window.scrollTo(0,0); });
  document.querySelectorAll('[data-gptlist]').forEach(function(b){ b.onclick=function(){ if(Date.now()-S.gtDragEnd<400) return; gpTap(); S.gptList=b.getAttribute('data-gptlist'); S.gptOpen=null; S.gptDraft=null; S.gtMenu=false; S.gptDoneOpen=false; render(); }; });
  /* ⋮ */
  on('gtMenuBtn', function(){ gpTap(); S.gtMenu=!S.gtMenu; render(); });
  on('gtMenuScrim', function(){ S.gtMenu=false; render(); });
  var L0=S.gptList ? gptListById_(S.gptList) : null;
  var saveList=function(payload, msg, after){ run('saveGpTaskList',[S.auth.user,S.auth.pin,payload],function(d){ if(d && d.ok){ gptTake_(d); if(after) after(d); if(msg) showMsg(msg); } else showMsg(t('Could not save')); render(); }); };
  on('gtRename', function(){ S.gtMenu=false; var v=window.prompt(t('Rename list'), L0.title); if(v && v.trim()) saveList({ id:L0.id, title:v.trim() }, t('Saved')); else render(); });
  on('gptListDelete', function(){ S.gtMenu=false; if(!window.confirm(gpT('Delete “{title}” and all its tasks?',{title:L0.title}))){ render(); return; }
    saveList({ id:L0.id, remove:true }, t('List deleted'), function(){ S.gptList=null; }); });
  on('gptAskBtn', function(){ gpTap(); S.gtMenu=false; S.gptAsk={ min:'', title:'', due:'', find:'' }; render(); });
  on('gptFilterBtn', function(){ S.gtMenu=false; S.gptFilterOpen=true; S.gptFilterDraft=S.gpt.filter ? S.gpt.filter.keys.slice() : []; render(); });
  /* the filter (Campus Leadership) */
  document.querySelectorAll('[data-gptf]').forEach(function(c){ c.onchange=function(){
    S.gptFilterDraft=[].filter.call(document.querySelectorAll('[data-gptf]'), function(x){ return x.checked; }).map(function(x){ return x.getAttribute('data-gptf'); });
  }; });
  var saveFilter=function(keys){ run('saveGpTaskFilter',[S.auth.user,S.auth.pin,keys],function(d){ if(d && d.ok){ gptTake_(d); S.gptFilterOpen=false; S.gptFilterDraft=null; showMsg(t('Saved as your default')); } else showMsg(t('Could not save')); render(); }); };
  on('gptFilterSave', function(){ saveFilter(S.gptFilterDraft||[]); });
  on('gptFilterAll', function(){ saveFilter([].map.call(document.querySelectorAll('[data-gptf]'), function(x){ return x.getAttribute('data-gptf'); })); });
  on('gptFilterNone', function(){ saveFilter([]); });
  /* asking another ministry */
  var af=document.getElementById('gptAskFind'); if(af){ af.oninput=function(){ S.gptAsk.find=af.value; var box=document.querySelector('.gtPick'); if(box){ var tmp=document.createElement('div'); tmp.innerHTML=gptAskHtml_(); var nb=tmp.querySelector('.gtPick'); if(nb) box.innerHTML=nb.innerHTML; bindAskPick(); } }; }
  var bindAskPick=function(){ document.querySelectorAll('[data-gptaskmin]').forEach(function(b){ b.onclick=function(){ gpTap(); S.gptAsk.min=b.getAttribute('data-gptaskmin'); S.gptAsk.find=''; render(); var ti=document.getElementById('gptAskTitle'); if(ti) ti.focus(); }; }); };
  bindAskPick();
  on('gptAskChange', function(){ S.gptAsk.min=''; render(); });
  var at=document.getElementById('gptAskTitle'); if(at) at.oninput=function(){ S.gptAsk.title=at.value; };
  var ad=document.getElementById('gptAskDue'); if(ad) ad.onchange=function(){ S.gptAsk.due=ad.value; };
  on('gptAskCancel', function(){ S.gptAsk=null; render(); });
  on('gptAskSend', function(){
    var A=S.gptAsk; if(!A.min){ showMsg(t('Choose the ministry first')); return; } if(!(A.title||'').trim()){ showMsg(t('Give it a title first')); return; }
    gptSaveTask_({ askMin:A.min, title:A.title.trim(), due:A.due||'' }, gpT('Asked — {name} will see it in their list',{name:t(A.min.split('|')[1])}),
      function(){ S.gptAsk=null; var m=gptMain_(); S.gptList=m ? m.id : null; });   // → your Inbox, where it waits
  });
  /* a new list is your own; a ministry's designated list is made by the server (the button below is
     for a ministry that has none yet — someone from before the designated lists) */
  var madeList=function(payload){ var before=((S.gpt&&S.gpt.lists)||[]).map(function(x){ return x.id; });
    saveList(payload, t('List made'), function(d){ var made=d.lists.filter(function(x){ return before.indexOf(x.id)===-1; })[0]; if(made) S.gptList=made.id; S.gptNewList=null; }); };
  on('gptNewListBtn', function(){ gpTap(); S.gptNewList={ title:'' }; render(); var el=document.getElementById('gptNewTitle'); if(el) el.focus(); });
  document.querySelectorAll('[data-gptmakefor]').forEach(function(b){ b.onclick=function(){ var k=b.getAttribute('data-gptmakefor').split('|'); madeList({ title:k[1]||k[0], scope:k[1] ? 'ministry' : 'dept', dept:k[0], ministry:k[1]||'' }); }; });
  var nt=document.getElementById('gptNewTitle'); if(nt){ nt.oninput=function(){ S.gptNewList.title=nt.value; }; nt.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var b=document.getElementById('gptNewSave'); if(b) b.click(); } }; }
  on('gptNewCancel', function(){ S.gptNewList=null; render(); });
  on('gptNewSave', function(){ madeList({ title:(S.gptNewList.title||'').trim() || t('Tasks'), scope:'personal' }); });
  /* ticking off — in a row or in the open task; a subtask in a row saves at once */
  document.querySelectorAll('[data-gptdone]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-gptdone'), x=(S.gpt.tasks||[]).filter(function(y){ return y.id===id; })[0]; if(!x) return; gpTap();
    x.done=!x.done; if(S.gptOpen===id){ S.gptOpen=null; S.gptDraft=null; } render();   // at once; the server's answer follows
    gptSaveTask_({ id:id, done:x.done }, x.done ? t('Completed') : '');
  }; });
  document.querySelectorAll('[data-gptsubtick]').forEach(function(b){ b.onclick=function(){
    var k=b.getAttribute('data-gptsubtick').split('|'), x=(S.gpt.tasks||[]).filter(function(y){ return y.id===k[0]; })[0]; if(!x) return; gpTap();
    var subs=(x.subs||[]).map(function(s){ return s.id===k[1] ? { id:s.id, text:s.text, done:!s.done } : s; }); x.subs=subs; render();
    gptSaveTask_({ id:x.id, subs:subs }, '');
  }; });
  on('gptDoneToggle', function(){ S.gptDoneOpen=!S.gptDoneOpen; render(); });
  on('gptClearDone', function(){ run('clearDoneGpTasks',[S.auth.user,S.auth.pin,S.gptList],function(d){ if(d && d.ok){ gptTake_(d); showMsg(t('Cleared')); } render(); }); });
  document.querySelectorAll('[data-gptaccept],[data-gptdecline]').forEach(function(b){ b.onclick=function(){
    var acc=b.hasAttribute('data-gptaccept'), id=b.getAttribute(acc?'data-gptaccept':'data-gptdecline'); b.disabled=true;
    run('respondGpTask',[S.auth.user,S.auth.pin,id,acc],function(d){ if(d && d.ok){ gptTake_(d); showMsg(acc ? t('Added to your list') : t('Declined')); } else showMsg(t('Could not save')); render(); });
  }; });
  /* drag: a task up or down its list, or onto another list's tab; a tab along the row */
  var openBox=document.querySelector('[data-gptorder]');
  if(openBox) gptDrag_([].slice.call(document.querySelectorAll('[data-gptgrip]')), { itemSel:'.gtItem', idAttr:'data-gptitem', axis:'y', hold:0,
    dropSel:'.gtTab[data-gptlist]', dropAttr:'data-gptlist', self:S.gptList,
    onEnd:function(ids, target){
      var dragged=document.querySelector('.gtItem.gtDragging, .gtItem') && null;
      if(target){   // dropped on a tab: into that list — or, for a task given to you, filed under one of yours
        var id=S.gtDragId; S.gtDragId=null; if(!id) return;
        var to=gptListById_(target), x=(S.gpt.tasks||[]).filter(function(y){ return y.id===id; })[0]; if(!x || !to) return;
        if(x.listId!==S.gptList){   // shown here because it was given to you: file it, it stays in its own list
          if(!(to.scope==='personal' && to.ownerId===S.me.id)){ showMsg(t('Only into one of your own lists')); render(); return; }
          x.filed=x.filed||{}; x.filed[S.me.id]={ list:to.id, order:1e8 }; render();
          run('fileGpTask',[S.auth.user,S.auth.pin,id,to.id],function(d){ if(d && d.ok){ gptTake_(d); showMsg(gpT('Filed under {list}',{list:gptChipName_(to)})); } else showMsg(t('Could not save')); render(); });
          return;
        }
        if(!to.canEdit){ showMsg(t('You can’t add to that list')); render(); return; }
        x.listId=target; render();
        gptSaveTask_({ id:id, listId:target }, gpT('Moved to {list}',{list:gptChipName_(to)}));
        return;
      }
      ids.forEach(function(id, i){ var x=(S.gpt.tasks||[]).filter(function(y){ return y.id===id; })[0]; if(!x) return; if(x.listId===S.gptList) x.order=i; else { x.filed=x.filed||{}; x.filed[S.me.id]={ list:S.gptList, order:i }; } }); render();
      run('orderGpTasks',[S.auth.user,S.auth.pin,S.gptList,ids],function(d){ if(d && d.ok) gptTake_(d); });
    } });
  document.querySelectorAll('[data-gptgrip]').forEach(function(g){ g.addEventListener('mousedown', function(){ S.gtDragId=g.getAttribute('data-gptgrip'); }); g.addEventListener('touchstart', function(){ S.gtDragId=g.getAttribute('data-gptgrip'); }, { passive:true }); });
  if(!scope) gptDrag_([].slice.call(document.querySelectorAll('.gtTab[data-gptlist]')), { itemSel:'.gtTab[data-gptlist]', idAttr:'data-gptlist', axis:'x', hold:350,
    onEnd:function(ids){ S.gpt.listOrder=ids; render(); run('saveGpListOrder',[S.auth.user,S.auth.pin,ids],function(d){ if(d && d.ok) gptTake_(d); }); } });
  /* New task: the round ＋, into the open list */
  on('gtAdd', function(){
    gpTap();
    S.gtNew={ listId:S.gptList, title:'', notes:'', due:'', time:'', who:'', showNotes:false, showWhen:false }; render();
    var el=document.getElementById('gptAddInput'); if(el) el.focus();
  });
  var N=S.gtNew;
  if(N){
    var ni=document.getElementById('gptAddInput'); if(ni){ ni.oninput=function(){ N.title=ni.value; }; ni.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); gtSaveNew_(); } }; }
    var nn=document.getElementById('gtNewNotes'); if(nn) nn.oninput=function(){ N.notes=nn.value; };
    var nd=document.getElementById('gptAddDue'); if(nd) nd.onchange=nd.oninput=function(){ N.due=nd.value; if(!nd.value) N.time=''; };
    var nm=document.getElementById('gptAddTime'); if(nm) nm.onchange=nm.oninput=function(){ N.time=nm.value; };
    var nw=document.getElementById('gptAddWho'); if(nw){ nw.value=N.who||''; nw.onchange=function(){ N.who=nw.value; render(); }; }
    on('gtNewNotesBtn', function(){ N.showNotes=!N.showNotes; render(); var x=document.getElementById(N.showNotes ? 'gtNewNotes' : 'gptAddInput'); if(x) x.focus(); });
    on('gtNewWhenBtn', function(){ N.showWhen=!N.showWhen; render(); });
    on('gptAddBtn', gtSaveNew_);
    on('gtNewScrim', function(){ S.gtNew=null; render(); });
  }
  /* an open task */
  document.querySelectorAll('[data-gptopen]').forEach(function(b){ b.onclick=function(){ gpTap(); S.gptOpen=b.getAttribute('data-gptopen'); S.gptDraft=null; render(); }; });
  var D=S.gptDraft;
  if(D && S.gptOpen){
    document.querySelectorAll('[data-gptd]').forEach(function(inp){ var k=inp.getAttribute('data-gptd'); inp.oninput=inp.onchange=function(){ D[k]=inp.value; if(k==='due'){ if(!inp.value) D.time=''; render(); } }; });
    var as=document.getElementById('gptAssignSel'); if(as) as.onchange=function(){ if(as.value && D.assignees.indexOf(as.value)===-1) D.assignees.push(as.value); render(); };
    document.querySelectorAll('[data-gptunassign]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-gptunassign'); D.assignees=D.assignees.filter(function(x){ return x!==id; }); render(); }; });
    /* subtasks in the sheet: tick, reword, remove, add (Enter adds and keeps typing) */
    document.querySelectorAll('[data-gptdsub]').forEach(function(b){ b.onclick=function(){ var i=+b.getAttribute('data-gptdsub'); if(D.subs[i]) D.subs[i].done=!D.subs[i].done; render(); }; });
    document.querySelectorAll('[data-gptdsubtext]').forEach(function(inp){ inp.oninput=function(){ var i=+inp.getAttribute('data-gptdsubtext'); if(D.subs[i]) D.subs[i].text=inp.value; }; });
    document.querySelectorAll('[data-gptdsubdel]').forEach(function(b){ b.onclick=function(){ var i=+b.getAttribute('data-gptdsubdel'); D.subs.splice(i,1); render(); }; });
    var sn=document.getElementById('gptSubNew'); if(sn){ sn.oninput=function(){ D.subNew=sn.value; };
      sn.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var v=(D.subNew||'').trim(); if(!v) return; D.subs.push({ id:'', text:v, done:false }); D.subNew=''; render(); var x=document.getElementById('gptSubNew'); if(x) x.focus(); } }; }
    var x0=(S.gpt.tasks||[]).filter(function(y){ return y.id===D.id; })[0];
    var subsOf=function(list){ return JSON.stringify((list||[]).map(function(s){ return [s.text, !!s.done]; })); };
    var pendingSub=function(){ var v=(D.subNew||'').trim(); if(v){ D.subs.push({ id:'', text:v, done:false }); D.subNew=''; } };
    var changed=function(){ return x0 && (D.title!==x0.title || (D.notes||'')!==(x0.notes||'') || (D.due||'')!==(x0.due||'') || (D.time||'')!==(x0.time||'') || D.assignees.join()!==x0.assignees.join() || subsOf(D.subs)!==subsOf(x0.subs)); };
    var saveOpen=function(close){ pendingSub(); if(!changed()){ if(close){ S.gptOpen=null; S.gptDraft=null; render(); } return; }
      gptSaveTask_({ id:D.id, title:D.title, notes:D.notes, due:D.due||'', time:D.due ? (D.time||'') : '', assignees:D.assignees, subs:D.subs }, t('Saved'), function(){ if(close){ S.gptOpen=null; S.gptDraft=null; } }); };
    on('gptSave', function(){ saveOpen(true); });
    on('gptClose', function(){ saveOpen(true); });   // ← keeps what you changed, like Google Tasks
    on('gtDetScrim', function(){ saveOpen(true); });
    on('gptDelete', function(){ if(!window.confirm(t('Delete this task?'))) return;
      run('deleteGpTask',[S.auth.user,S.auth.pin,D.id],function(d){ if(d && d.ok){ gptTake_(d); S.gptOpen=null; S.gptDraft=null; showMsg(t('Deleted')); } else showMsg(t('Could not save')); render(); }); });
  }
}
function gtSaveNew_(){
  var N=S.gtNew; if(!N) return;
  var v=(N.title||'').trim(); if(!v){ showMsg(t('Give it a title first')); return; }
  var L=gptListById_(N.listId); if(!L){ showMsg(t('Make a list first')); return; }
  var asks=!L.canEdit;
  gptSaveTask_({ listId:L.id, title:v, notes:N.notes||'', due:N.due||'', time:N.due ? (N.time||'') : '', assignees: N.who ? [N.who] : [] },
    asks ? gpT('Asked — {name} will see it in their list',{name:t(L.ministry||L.dept)}) : (N.who ? gpT('Added — {name} will be told',{name:firstName_(gptPerson_(N.who).name)}) : t('Added')),
    function(){ S.gtNew=null; });
}
/* My Ministry: one row under the department and ministry, Ministry Tasks (n) ›, that opens the
   ministry's own GP Tasks page — the same page as your own, with just that ministry's list (Uriah,
   Oct 2026: "like the personal GP Tasks, just showing the tasks for that ministry — for all of the
   ministries"). */
function mtOpen_(){ return false; }
function mtFoldHtml_(sel){
  var n=null;
  if(S.gpt){ var ids=gptLists_({ dept:sel.dept, min:sel.min }).map(function(L){ return L.id; });
    n=S.gpt.tasks.filter(function(x){ return ids.indexOf(x.listId)>-1 && !x.done && x.status!=='declined'; }).length; }
  else if(!S.gptLoading && !S.gptErr) setTimeout(gptLoad_, 0);
  return '<div class="card mtFold" id="mtFold"><button class="mtHead" id="mtToggle" data-mtdept="'+esc(sel.dept)+'" data-mtmin="'+esc(sel.min||'')+'">'+
    '<span>'+gptIc_('tasks')+' '+esc(t('Ministry Tasks'))+(n ? ' <span class="adminBadge">'+n+'</span>' : '')+'</span><span class="heroGo" aria-hidden="true">›</span></button></div>';
}
function gptOpenMinistry_(dept, min){ S.gptPageScope={ dept:dept, min:min||'' }; S.gptFrom='ministry'; S.view='tasks'; S.gptList=null; S.gptOpen=null; S.gptDraft=null; render(); window.scrollTo(0,0); }
/* My Home: the line on the card, and the small button by Weekly Goals */
function gptHomeRowHtml_(){
  var I=S.gpTaskInfo; if(!I || S.student || S.guest || S.board) return '';
  return '<button class="heroRow heroRowGo" id="goGpTasks" aria-label="'+esc(t('GP Tasks'))+'"><span class="gptRing">'+GPT_SVG.tasks+'</span>'+
    '<div class="heroTrend">'+esc(t('GP Tasks'))+' '+(I.inbox ? '<span class="gtBadge">'+I.inbox+'</span> <span class="whoCap">'+esc(t('in your Inbox'))+'</span>' : '<b class="heroFig">'+I.open+'</b>')+(I.due ? ' <span class="whoCap">· '+esc(gpT('{n} due',{n:I.due}))+'</span>' : '')+'</div><span class="heroGo" aria-hidden="true">›</span></button>';
}
function gptOpenPage_(from){ S.gptFrom=from||'week'; S.gptPageScope=null; S.view='tasks'; S.gpt=null; S.gptOpen=null; S.gptDraft=null; render(); window.scrollTo(0,0); }
/* the bell: given a task, asked for help, a request turned down */
function gptNotifItems_(){
  var I=S.gpTaskInfo, out=[]; if(!I) return out;
  (I.notices||[]).forEach(function(n){
    var who=firstName_(gptPerson_(n.by).name);
    var text = n.kind==='assigned' ? (n.from ? gpT('{from} gave you a task: {title}',{from:t(n.from), title:n.title}) : gpT('{name} gave you a task: {title}',{name:who, title:n.title}))
      : n.kind==='request' ? gpT('{from} is asking {list} for help: {title}',{from:t(n.from||who), list:n.list, title:n.title})
      : gpT('{name} can’t take on: {title}',{name:who, title:n.title});
    out.push({ when:n.at, text:text, actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gogptasks="1">'+esc(t('Open'))+'</button>' });
  });
  return out;
}
