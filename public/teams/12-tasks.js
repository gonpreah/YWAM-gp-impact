/* ==================== GP Tasks (Oct 2026, Uriah) ====================
   "Much simpler and easy to use, very much like Google Tasks": lists with a title, tasks
   under them with a day and a time — and, for a campus that works as one team, lists for a
   ministry or a department, people a task is given to, and asking another ministry for help
   (it shows in their list as a request they accept or decline). Campus Leadership and admins
   see every list, narrowed by a filter they keep as their default. Opened from My Home's card
   and the Weekly Goals heading (S.view='tasks'), and as the ✅ Tasks tab on My Ministry, where
   it shows that ministry's lists. The server's rules are in api.js (GP Tasks). */
S.gpt=null; S.gptLoading=false; S.gptErr=''; S.gptList=null; S.gptOpen=null; S.gptDraft=null;
S.gptNewList=null; S.gptAsk=null; S.gptFilterOpen=false; S.gptFilterDraft=null; S.gptListMenu=false; S.gptDoneOpen=false; S.gptFrom='week';
function gptLoad_(){
  if(S.gptLoading) return; S.gptLoading=true; S.gptErr='';
  run('getGpTasks',[S.auth.user,S.auth.pin],function(d){ S.gptLoading=false; if(d && d.ok) gptTake_(d); else S.gptErr=(d && d.err) || 'error'; render(); },
    function(){ S.gptLoading=false; S.gptErr='offline'; render(); });
}
function gptTake_(d){
  S.gpt=d;
  var mine=(d.tasks||[]).filter(function(t){ return !t.done && t.status!=='declined' && t.assignees.indexOf(S.me.id)>-1; });
  if(S.gpTaskInfo) S.gpTaskInfo.open=mine.length;
}
function gptKeyOf_(L){ return L.dept+'|'+(L.scope==='ministry' ? L.ministry : ''); }
function gptListById_(id){ return ((S.gpt && S.gpt.lists)||[]).filter(function(L){ return L.id===id; })[0] || null; }
function gptPerson_(id){ var p=personOf(id); return p || { id:id, name:nameOf(id) }; }
/* the lists to show: a ministry's own (My Ministry's tab), or all you see — Campus Leadership's
   narrowed by their saved filter (your own ministries' and your personal lists always show) */
function gptLists_(scope){
  var G=S.gpt; if(!G) return [];
  var lists=G.lists.filter(function(L){ return !L.onlyAssigned; });
  if(scope) return lists.filter(function(L){ return L.scope!=='personal' && L.dept===scope.dept && (L.scope==='dept' || L.ministry===scope.min); });
  var f=G.filter && G.filter.keys;
  if(G.canAll && f) lists=lists.filter(function(L){ return L.scope==='personal' || L.mine || f.indexOf(gptKeyOf_(L))>-1; });
  var rank=function(L){ return L.scope==='personal' ? (L.ownerId===S.me.id ? 2 : 4) : L.mine ? 1 : 3; };
  return lists.slice().sort(function(a,b){ return rank(a)-rank(b) || String(a.dept+a.ministry+a.title).localeCompare(String(b.dept+b.ministry+b.title)); });
}
function gptListLabel_(L){
  if(L.scope==='personal') return L.ownerId===S.me.id ? (L.shared ? t('Personal · others can see it') : t('Personal · only you')) : gpT('{name}’s list',{name:firstName_(gptPerson_(L.ownerId).name)});
  return L.scope==='dept' ? gpT('{dept} · whole department',{dept:t(L.dept)}) : t(L.ministry)+' · '+t(L.dept);
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
function gptSort_(a,b){ var ad=a.due||'9999', bd=b.due||'9999'; return ad<bd ? -1 : ad>bd ? 1 : ((a.time||'99')<(b.time||'99') ? -1 : (a.time||'99')>(b.time||'99') ? 1 : String(a.created).localeCompare(String(b.created))); }
/* the page: the lists across the top, the one open below — like Google Tasks on a phone */
function gptPageHtml_(scope, embedded){
  var h='';
  if(!scope && !embedded) h+='<button class="linkbtn" id="gptBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(S.gptFrom==='ministry' ? t('My Ministry') : t('My Home'))+'</button>'+
    '<h2 style="margin:4px 0 2px">✅ '+esc(t('GP Tasks'))+'</h2>';
  if(!S.gpt){ if(!S.gptLoading && !S.gptErr) setTimeout(gptLoad_, 0); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.gptErr ? t('Couldn’t load the tasks — pull down to try again.') : t('Loading…'))+'</p></div>'; }
  var G=S.gpt, lists=gptLists_(scope);
  var ids=['mine'].concat(lists.map(function(L){ return L.id; }));
  if(scope) ids=lists.map(function(L){ return L.id; });
  if(ids.indexOf(S.gptList)===-1) S.gptList=ids[0] || null;
  h+='<div class="gptBar"><div class="gptChips" role="tablist">'+
    (scope ? '' : '<button class="gptChip'+(S.gptList==='mine'?' on':'')+'" data-gptlist="mine">⭐ '+esc(t('My tasks'))+'</button>')+
    lists.map(function(L){
      var open=G.tasks.filter(function(x){ return x.listId===L.id && !x.done && x.status!=='declined'; }).length;
      return '<button class="gptChip'+(S.gptList===L.id?' on':'')+'" data-gptlist="'+esc(L.id)+'">'+(L.scope==='personal' ? '🔒 ' : L.scope==='dept' ? '🏢 ' : '')+esc(L.title)+(open ? ' <small>'+open+'</small>' : '')+'</button>';
    }).join('')+
    '<button class="gptChip gptAdd" id="gptNewListBtn">＋ '+esc(t('New list'))+'</button></div>'+
    (G.canAll && !scope ? '<button class="gptFilterBtn'+(G.filter ? ' on' : '')+'" id="gptFilterBtn" aria-label="'+esc(t('Filter'))+'">⚙️</button>' : '')+'</div>';
  if(!scope && !embedded) h+='<button class="linkbtn inline gptAskBtn" id="gptAskBtn">🤝 '+esc(t('Ask another ministry for help'))+'</button>';
  if(S.gptAsk) h+=gptAskHtml_();
  if(S.gptFilterOpen && G.canAll && !scope) h+=gptFilterHtml_();
  if(S.gptNewList) h+=gptNewListHtml_(scope);
  if(!S.gptList) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(scope ? gpT('{ministry} has no task list yet — make one, and everyone in it shares it.',{ministry:t(scope.min)}) : t('No lists yet.'))+'</p>'+
    (scope ? '<button class="btn" style="margin:10px 0 0" data-gptmakefor="'+esc(scope.dept+'|'+scope.min)+'">＋ '+esc(gpT('Make a list for {ministry}',{ministry:t(scope.min)}))+'</button>' : '')+'</div>';
  return h+(S.gptList==='mine' ? gptMineHtml_() : gptListHtml_(gptListById_(S.gptList)));
}
/* asking another ministry: it lands in their list as a request they accept or decline */
function gptAskHtml_(){
  var A=S.gptAsk, deps=getDepartments(S.me.campus), opts=[];
  Object.keys(deps).forEach(function(d){ Object.keys(deps[d]||{}).forEach(function(m){ if(!(d===S.me.dept && m===S.me.ministry)) opts.push([d+'|'+m, t(m)+' · '+t(d)]); }); });
  return '<div class="card gptNewList"><div class="goalCardTitle">🤝 '+esc(t('Ask another ministry for help'))+'</div>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(t('It shows in their list as a request; they say whether they can take it on.'))+'</p>'+
    '<label class="f">'+esc(t('Which ministry'))+'</label><select id="gptAskMin"><option value="">—</option>'+opts.map(function(x){ return '<option value="'+esc(x[0])+'"'+(A.min===x[0]?' selected':'')+'>'+esc(x[1])+'</option>'; }).join('')+'</select>'+
    '<label class="f">'+esc(t('What do you need?'))+'</label><input type="text" id="gptAskTitle" maxlength="200" value="'+esc(A.title||'')+'" placeholder="'+esc(t('e.g. Coffee for the team arriving Friday'))+'">'+
    '<label class="f">'+esc(t('By when (optional)'))+'</label><input type="date" id="gptAskDue" value="'+esc(A.due||'')+'">'+
    '<div class="btnRow"><button class="btn" id="gptAskSend">'+esc(t('Send the request'))+'</button><button class="btn ghost" id="gptAskCancel">'+esc(t('Cancel'))+'</button></div></div>';
}
function gptFilterHtml_(){
  var G=S.gpt, D=S.gptFilterDraft, keys={};
  G.lists.forEach(function(L){ if(L.scope!=='personal' && !L.onlyAssigned) keys[gptKeyOf_(L)]=1; });
  var byDept={}; Object.keys(keys).sort().forEach(function(k){ var p=k.split('|'); (byDept[p[0]]=byDept[p[0]]||[]).push(k); });
  var h='<div class="card gptFilter"><div class="goalCardTitle">⚙️ '+esc(t('Which lists to show'))+'</div>'+
    '<p class="hint" style="margin:0 0 8px">'+esc(t('Your own ministry’s lists and your personal ones always show. Save it as your default — change it any time.'))+'</p>';
  if(!Object.keys(byDept).length) h+='<p class="sub" style="margin:0">'+esc(t('No ministry has a list yet.'))+'</p>';
  Object.keys(byDept).forEach(function(d){
    h+='<div class="gptFDept"><b>'+esc(t(d))+'</b>'+byDept[d].map(function(k){ var m=k.split('|')[1];
      return '<label class="remBox"><input type="checkbox" data-gptf="'+esc(k)+'"'+(!D || D.indexOf(k)>-1 ? ' checked' : '')+'> '+esc(m ? t(m) : t('Whole department'))+'</label>'; }).join('')+'</div>';
  });
  return h+'<div class="btnRow"><button class="btn" id="gptFilterSave">'+esc(t('Save as my default'))+'</button><button class="btn ghost" id="gptFilterAll">'+esc(t('Show everything'))+'</button></div></div>';
}
/* where a new list can go: just you (or shared), each ministry you're in, your department —
   and, for Campus Leadership and admins, any ministry on the campus */
function gptListHomes_(scope){
  var out=[['personal','',t('Just me')],['shared','',t('Me — others can see it')]], seen={};
  var add=function(d, m){ var k=d+'|'+m; if(seen[k] || !d) return; seen[k]=1; out.push([m ? 'ministry' : 'dept', k, m ? t(m)+' · '+t(d) : gpT('{dept} · whole department',{dept:t(d)})]); };
  if(scope) add(scope.dept, scope.min);
  add(S.me.dept, S.me.ministry||''); (S.me.ministries||[]).forEach(function(k){ var p=k.split('|'); add(p[0], p[1]); });
  (S.me.leads||[]).forEach(function(k){ var p=k.split('|'); add(p[0], p[1]); });
  add(S.me.dept, '');
  if(S.gpt && S.gpt.canAll){ var deps=getDepartments(S.me.campus); Object.keys(deps).forEach(function(d){ Object.keys(deps[d]||{}).forEach(function(m){ add(d, m); }); add(d, ''); }); }
  return out;
}
function gptNewListHtml_(scope){
  var N=S.gptNewList, homes=gptListHomes_(scope);
  return '<div class="card gptNewList"><div class="goalCardTitle">＋ '+esc(t('New list'))+'</div>'+
    '<label class="f">'+esc(t('Title'))+'</label><input type="text" id="gptNewTitle" maxlength="80" value="'+esc(N.title||'')+'" placeholder="'+esc(t('e.g. Christmas outreach'))+'">'+
    '<label class="f">'+esc(t('Whose list'))+'</label><select id="gptNewHome">'+homes.map(function(x){ var v=x[0]+'#'+x[1];
      return '<option value="'+esc(v)+'"'+(N.home===v?' selected':'')+'>'+esc(x[2])+'</option>'; }).join('')+'</select>'+
    '<div class="btnRow"><button class="btn" id="gptNewSave">'+esc(t('Make the list'))+'</button><button class="btn ghost" id="gptNewCancel">'+esc(t('Cancel'))+'</button></div></div>';
}
function gptMineHtml_(){
  var G=S.gpt, mine=G.tasks.filter(function(x){ return x.status!=='declined' && (x.assignees.indexOf(S.me.id)>-1 || (function(L){ return L && L.scope==='personal' && L.ownerId===S.me.id; })(gptListById_(x.listId))); });
  var open=mine.filter(function(x){ return !x.done; }).sort(gptSort_), done=mine.filter(function(x){ return x.done; });
  var asked=G.tasks.filter(function(x){ return x.by===S.me.id && (x.status==='request' || x.status==='declined'); });
  var h='<div class="card gptList"><div class="gptListHead"><div><b>⭐ '+esc(t('My tasks'))+'</b><div class="pmeta">'+esc(t('Given to you, and your own lists'))+'</div></div></div>';
  if(!open.length) h+='<p class="sub gptEmpty">'+esc(t('Nothing waiting on you. 🎉'))+'</p>';
  h+=open.map(function(x){ return gptRowHtml_(x, true); }).join('');
  h+=gptDoneHtml_(done, null)+'</div>';
  if(asked.length) h+='<h3>'+esc(t('You asked other ministries'))+'</h3><div class="card gptList">'+asked.map(function(x){ return gptRowHtml_(x, true); }).join('')+'</div>';
  return h;
}
function gptListHtml_(L){
  if(!L) return '';
  var G=S.gpt, all=G.tasks.filter(function(x){ return x.listId===L.id; });
  var open=all.filter(function(x){ return !x.done && x.status!=='declined'; }).sort(function(a,b){ return (a.status==='request')-(b.status==='request') || gptSort_(a,b); });
  var done=all.filter(function(x){ return x.done; });
  var h='<div class="card gptList"><div class="gptListHead"><div style="min-width:0"><b>'+esc(L.title)+'</b><div class="pmeta">'+esc(gptListLabel_(L))+'</div></div>'+
    (L.canEdit ? '<button class="leadIconBtn" id="gptListMenuBtn" aria-label="'+esc(t('List options'))+'">⋯</button>' : '')+'</div>';
  if(S.gptListMenu && L.canEdit){
    h+='<div class="gptListMenu"><label class="f">'+esc(t('Title'))+'</label><input type="text" id="gptRename" maxlength="80" value="'+esc(L.title)+'">'+
      (L.scope==='personal' ? '<label class="remBox"><input type="checkbox" id="gptShared"'+(L.shared?' checked':'')+'> '+esc(t('Others on the campus can see this list'))+'</label>' : '')+
      '<div class="btnRow"><button class="btn small" id="gptRenameSave">'+esc(t('Save'))+'</button>'+
      '<button class="btn small ghost" id="gptListDelete" style="color:var(--bad)">'+esc(t('Delete the list'))+'</button></div></div>';
  }
  /* add: straight in for its people; from outside, a request it accepts */
  var asks=!L.canEdit && L.scope!=='personal';
  if(L.canEdit || asks) h+='<div class="gptAddRow"><span class="gptCircle" aria-hidden="true">＋</span><input type="text" id="gptAddInput" maxlength="200" placeholder="'+
    esc(asks ? gpT('Ask {name} for help with…',{name:t(L.ministry||L.dept)}) : t('Add a task'))+'"></div>'+
    /* a day and a time as it is made (Uriah, Oct 2026), said in words while they are blank */
    '<div class="gptAddWhen"><span class="gptWhenLbl">📅 '+esc(t('Set date and time'))+'</span>'+
      '<input type="date" id="gptAddDue" aria-label="'+esc(t('Set date'))+'"><input type="time" id="gptAddTime" step="900" aria-label="'+esc(t('Set time'))+'">'+
      (L.scope!=='personal' || L.ownerId===S.me.id ? '<select id="gptAddWho" aria-label="'+esc(t('Assign to'))+'"><option value="">👤 '+esc(t('Assign to…'))+'</option>'+gptPeopleOptions_(L, [])+'</select>' : '')+
      '<button class="btn small" id="gptAddBtn">'+esc(t('Add'))+'</button></div>';
  if(!open.length) h+='<p class="sub gptEmpty">'+esc(t('No tasks yet.'))+'</p>';
  h+=open.map(function(x){ return gptRowHtml_(x, false); }).join('');
  h+=gptDoneHtml_(done, L)+'</div>';
  return h;
}
function gptDoneHtml_(done, L){
  if(!done.length) return '';
  return '<button class="gptDoneHead" id="gptDoneToggle" aria-expanded="'+(S.gptDoneOpen?'true':'false')+'">'+(S.gptDoneOpen?'▾':'▸')+' '+esc(gpT('Completed ({n})',{n:done.length}))+'</button>'+
    (S.gptDoneOpen ? done.map(function(x){ return gptRowHtml_(x, false); }).join('')+(L && L.canEdit ? '<button class="linkbtn inline" id="gptClearDone">'+esc(t('Clear completed'))+'</button>' : '') : '');
}
function gptRowHtml_(x, showList){
  var L=gptListById_(x.listId), open=S.gptOpen===x.id, req=x.status==='request', dec=x.status==='declined';
  var who=x.assignees.map(function(id){ return avatarHtml(gptPerson_(id),'xs'); }).join('');
  var meta=[];
  if(x.due) meta.push('<span class="'+(gptOverdue_(x)?'gptLate':'')+'">📅 '+esc(gptWhen_(x))+'</span>');
  else if(!x.done && !dec) meta.push('<span class="gptNoWhen">📅 '+esc(t('Set date and time'))+'</span>');
  if(x.from && x.from.label) meta.push('<span class="gptFrom">'+esc(gpT('from {who}',{who:t(x.from.label)}))+'</span>');
  if(showList && L) meta.push('<span>'+esc(L.title)+'</span>');
  if(x.assignees.length) meta.push('<span>'+esc(x.assignees.map(function(id){ return firstName_(gptPerson_(id).name); }).join(', '))+'</span>');
  var mineToAnswer = req && L && (L.mine || x.assignees.indexOf(S.me.id)>-1 || (S.gpt.canAll && !L.onlyAssigned)) && x.by!==S.me.id;
  var h='<div class="gptRow'+(x.done?' done':'')+(req?' req':'')+(open?' open':'')+'" data-gptrow="'+esc(x.id)+'">'+
    '<button class="gptCheck'+(x.done?' on':'')+'" data-gptdone="'+esc(x.id)+'"'+(req||dec?' disabled':'')+' aria-label="'+esc(x.done ? t('Mark not done') : t('Mark done'))+'">'+(x.done?'✓':'')+'</button>'+
    '<button class="gptMain" data-gptopen="'+esc(x.id)+'"><span class="gptTitle">'+esc(x.title)+'</span>'+
      (req ? '<span class="gptBadge">'+esc(x.by===S.me.id ? gpT('Asked — waiting for {name}',{name:t((L&&(L.ministry||L.dept))||'')}) : t('Request'))+'</span>' : '')+
      (dec ? '<span class="gptBadge no">'+esc(t('They can’t take it on'))+'</span>' : '')+
      (meta.length ? '<span class="gptMeta">'+meta.join(' · ')+'</span>' : '')+'</button>'+
    (who ? '<span class="gptWho">'+who+'</span>' : '')+'</div>';
  if(mineToAnswer) h+='<div class="gptReqActs">'+esc(gpT('{name} is asking for help.',{name:firstName_(gptPerson_(x.by).name)}))+' '+
    '<button class="btn small" data-gptaccept="'+esc(x.id)+'">'+esc(t('We’ll do it'))+'</button><button class="btn small ghost" data-gptdecline="'+esc(x.id)+'">'+esc(t('Can’t'))+'</button></div>';
  if(open) h+=gptEditHtml_(x, L);
  return h;
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
function gptEditHtml_(x, L){
  var D=S.gptDraft && S.gptDraft.id===x.id ? S.gptDraft : (S.gptDraft={ id:x.id, title:x.title, notes:x.notes, due:x.due, time:x.time, assignees:x.assignees.slice(), listId:x.listId });
  var canAll=L && L.canEdit, canEdit=canAll || x.by===S.me.id || x.assignees.indexOf(S.me.id)>-1;
  if(!canEdit) return '<div class="gptEdit">'+(x.notes ? '<p class="sub" style="white-space:pre-wrap;margin:0">'+esc(x.notes)+'</p>' : '')+'</div>';
  var canAssign=canAll || x.by===S.me.id;
  return '<div class="gptEdit">'+
    '<input type="text" data-gptd="title" maxlength="200" value="'+esc(D.title)+'" aria-label="'+esc(t('Title'))+'">'+
    '<textarea data-gptd="notes" rows="2" maxlength="2000" placeholder="'+esc(t('Details'))+'">'+esc(D.notes||'')+'</textarea>'+
    '<div class="gptDT"><span class="gptWhenLbl">📅 '+esc(D.due ? t('Date and time') : t('Set date and time'))+'</span><input type="date" data-gptd="due" value="'+esc(D.due||'')+'" aria-label="'+esc(t('Set date'))+'"><input type="time" data-gptd="time" value="'+esc(D.time||'')+'" step="900" aria-label="'+esc(t('Set time'))+'"'+(D.due?'':' disabled')+'></div>'+
    '<div class="gptAssign"><span class="pmeta">'+esc(t('Given to'))+'</span> '+D.assignees.map(function(id){ return '<span class="gptPerson">'+esc(gptPerson_(id).name)+(canAssign ? ' <button class="gptX" data-gptunassign="'+esc(id)+'" aria-label="'+esc(t('Remove'))+'">×</button>' : '')+'</span>'; }).join('')+
      (canAssign ? '<select id="gptAssignSel"><option value="">'+esc(t('＋ Add someone'))+'</option>'+gptPeopleOptions_(L, D.assignees)+'</select>' : (D.assignees.length ? '' : '<span class="pmeta">'+esc(t('nobody yet'))+'</span>'))+'</div>'+
    '<div class="btnRow"><button class="btn small" id="gptSave">'+esc(t('Save'))+'</button>'+
      ((canAll || x.by===S.me.id) ? '<button class="btn small ghost" id="gptDelete" style="color:var(--bad)">'+esc(t('Delete'))+'</button>' : '')+
      '<button class="btn small ghost" id="gptClose">'+esc(t('Close'))+'</button></div></div>';
}
function gptSaveTask_(payload, msg, after){
  run('saveGpTask',[S.auth.user,S.auth.pin,payload],function(d){
    if(d && d.ok){ gptTake_(d); if(after) after(d); if(msg) showMsg(msg); }
    else showMsg(d && d.err==='title_required' ? t('Give it a title first') : t('Could not save'));
    render();
  }, function(){ showMsg(t('No connection — try again when you are online.')); });
}
function bindGpTasks_(){
  var mt=document.getElementById('mtToggle');
  if(mt) mt.onclick=function(){ gpTap(); var o=!mtOpen_(); try{ lsSet('gp-mt-open', o ? '1' : '0'); }catch(e){} if(o && !S.gpt) gptLoad_(); render(); };
  if(!document.querySelector('.gptBar, #gptBack, [data-gptmakefor]')) return;
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; return el; };
  on('gptBack', function(){ gpTap(); S.view=S.gptFrom==='ministry' ? 'ministry' : 'week'; render(); window.scrollTo(0,0); });
  document.querySelectorAll('[data-gptlist]').forEach(function(b){ b.onclick=function(){ gpTap(); S.gptList=b.getAttribute('data-gptlist'); S.gptOpen=null; S.gptDraft=null; S.gptListMenu=false; S.gptDoneOpen=false; render(); }; });
  on('gptFilterBtn', function(){ S.gptFilterOpen=!S.gptFilterOpen; S.gptFilterDraft=S.gpt.filter ? S.gpt.filter.keys.slice() : null; render(); });
  document.querySelectorAll('[data-gptf]').forEach(function(c){ c.onchange=function(){
    var all=[].map.call(document.querySelectorAll('[data-gptf]'), function(x){ return x.getAttribute('data-gptf'); });
    S.gptFilterDraft=[].filter.call(document.querySelectorAll('[data-gptf]'), function(x){ return x.checked; }).map(function(x){ return x.getAttribute('data-gptf'); });
    if(S.gptFilterDraft.length===all.length) S.gptFilterDraft=null;
  }; });
  var saveFilter=function(keys){ run('saveGpTaskFilter',[S.auth.user,S.auth.pin,keys],function(d){ if(d && d.ok){ gptTake_(d); S.gptFilterOpen=false; S.gptFilterDraft=null; showMsg(t('Saved as your default')); } else showMsg(t('Could not save')); render(); }); };
  on('gptFilterSave', function(){ saveFilter(S.gptFilterDraft); });
  on('gptFilterAll', function(){ saveFilter(null); });
  on('gptAskBtn', function(){ gpTap(); S.gptAsk=S.gptAsk ? null : { min:'', title:'', due:'' }; render(); });
  var am=document.getElementById('gptAskMin'); if(am) am.onchange=function(){ S.gptAsk.min=am.value; };
  var at=document.getElementById('gptAskTitle'); if(at) at.oninput=function(){ S.gptAsk.title=at.value; };
  var ad=document.getElementById('gptAskDue'); if(ad) ad.onchange=function(){ S.gptAsk.due=ad.value; };
  on('gptAskCancel', function(){ S.gptAsk=null; render(); });
  on('gptAskSend', function(){
    var A=S.gptAsk; if(!A.min){ showMsg(t('Choose the ministry first')); return; } if(!(A.title||'').trim()){ showMsg(t('Give it a title first')); return; }
    gptSaveTask_({ askMin:A.min, title:A.title.trim(), due:A.due||'' }, gpT('Asked — {name} will see it in their list',{name:t(A.min.split('|')[1])}), function(){ S.gptAsk=null; S.gptList='mine'; });
  });
  on('gptNewListBtn', function(){ gpTap(); S.gptNewList={ title:'', home:'personal#' }; render(); var el=document.getElementById('gptNewTitle'); if(el) el.focus(); });
  document.querySelectorAll('[data-gptmakefor]').forEach(function(b){ b.onclick=function(){ S.gptNewList={ title:t('Tasks'), home:'ministry#'+b.getAttribute('data-gptmakefor') }; render(); }; });
  var nt=document.getElementById('gptNewTitle'); if(nt) nt.oninput=function(){ S.gptNewList.title=nt.value; };
  var nh=document.getElementById('gptNewHome'); if(nh) nh.onchange=function(){ S.gptNewList.home=nh.value; };
  on('gptNewCancel', function(){ S.gptNewList=null; render(); });
  on('gptNewSave', function(){
    var N=S.gptNewList, hp=String(N.home||'personal#').split('#'), kind=hp[0], key=(hp[1]||'').split('|');
    var list={ title:(N.title||'').trim() || t('Tasks'), scope: kind==='shared' ? 'personal' : kind, shared: kind==='shared', dept:key[0]||'', ministry:key[1]||'' };
    run('saveGpTaskList',[S.auth.user,S.auth.pin,list],function(d){
      if(d && d.ok){ var before=((S.gpt&&S.gpt.lists)||[]).map(function(L){ return L.id; }); gptTake_(d); var made=d.lists.filter(function(L){ return before.indexOf(L.id)===-1; })[0]; if(made) S.gptList=made.id; S.gptNewList=null; showMsg(t('List made')); }
      else showMsg(t('Could not save'));
      render();
    });
  });
  on('gptListMenuBtn', function(){ S.gptListMenu=!S.gptListMenu; render(); });
  on('gptRenameSave', function(){
    var L=gptListById_(S.gptList), sh=document.getElementById('gptShared');
    run('saveGpTaskList',[S.auth.user,S.auth.pin,{ id:L.id, title:(document.getElementById('gptRename')||{}).value||L.title, shared: sh ? sh.checked : undefined }],function(d){ if(d && d.ok){ gptTake_(d); S.gptListMenu=false; showMsg(t('Saved')); } else showMsg(t('Could not save')); render(); });
  });
  on('gptListDelete', function(){
    var L=gptListById_(S.gptList); if(!L || !window.confirm(gpT('Delete “{title}” and all its tasks?',{title:L.title}))) return;
    run('saveGpTaskList',[S.auth.user,S.auth.pin,{ id:L.id, remove:true }],function(d){ if(d && d.ok){ gptTake_(d); S.gptList=null; S.gptListMenu=false; showMsg(t('List deleted')); } else showMsg(t('Could not save')); render(); });
  });
  var ai=document.getElementById('gptAddInput');
  var addIt=function(){ var v=((ai && ai.value)||'').trim(); if(!v){ showMsg(t('Give it a title first')); return; }
    var L=gptListById_(S.gptList), asks=L && !L.canEdit;
    var due=(document.getElementById('gptAddDue')||{}).value||'', tm=(document.getElementById('gptAddTime')||{}).value||'', who=(document.getElementById('gptAddWho')||{}).value||'';
    gptSaveTask_({ listId:S.gptList, title:v, due:due, time:due ? tm : '', assignees: who ? [who] : [] }, asks ? gpT('Asked — {name} will see it in their list',{name:t(L.ministry||L.dept)}) : '', function(){ setTimeout(function(){ var m=document.getElementById('gptAddInput'); if(m) m.focus(); }, 0); }); };
  if(ai) ai.onkeydown=function(e){ if(e.key!=='Enter') return; e.preventDefault(); addIt(); };
  on('gptAddBtn', addIt);
  document.querySelectorAll('[data-gptdone]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-gptdone'), x=(S.gpt.tasks||[]).filter(function(y){ return y.id===id; })[0]; if(!x) return; gpTap();
    x.done=!x.done; render();   // at once; the server's answer follows
    gptSaveTask_({ id:id, done:x.done });
  }; });
  document.querySelectorAll('[data-gptopen]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-gptopen'); S.gptOpen = S.gptOpen===id ? null : id; S.gptDraft=null; render(); }; });
  on('gptDoneToggle', function(){ S.gptDoneOpen=!S.gptDoneOpen; render(); });
  on('gptClearDone', function(){ run('clearDoneGpTasks',[S.auth.user,S.auth.pin,S.gptList],function(d){ if(d && d.ok){ gptTake_(d); showMsg(t('Cleared')); } render(); }); });
  document.querySelectorAll('[data-gptaccept],[data-gptdecline]').forEach(function(b){ b.onclick=function(){
    var acc=b.hasAttribute('data-gptaccept'), id=b.getAttribute(acc?'data-gptaccept':'data-gptdecline'); b.disabled=true;
    run('respondGpTask',[S.auth.user,S.auth.pin,id,acc],function(d){ if(d && d.ok){ gptTake_(d); showMsg(acc ? t('Added to your list') : t('Declined')); } else showMsg(t('Could not save')); render(); });
  }; });
  var D=S.gptDraft;
  if(D){
    document.querySelectorAll('[data-gptd]').forEach(function(inp){ var k=inp.getAttribute('data-gptd'); inp.oninput=inp.onchange=function(){ D[k]=inp.value; if(k==='due'){ if(!inp.value) D.time=''; render(); } }; });
    var as=document.getElementById('gptAssignSel'); if(as) as.onchange=function(){ if(as.value && D.assignees.indexOf(as.value)===-1) D.assignees.push(as.value); render(); };
    document.querySelectorAll('[data-gptunassign]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-gptunassign'); D.assignees=D.assignees.filter(function(x){ return x!==id; }); render(); }; });
    on('gptSave', function(){ gptSaveTask_({ id:D.id, title:D.title, notes:D.notes, due:D.due||'', time:D.due ? (D.time||'') : '', assignees:D.assignees }, t('Saved'), function(){ S.gptOpen=null; S.gptDraft=null; }); });
    on('gptClose', function(){ S.gptOpen=null; S.gptDraft=null; render(); });
    on('gptDelete', function(){ if(!window.confirm(t('Delete this task?'))) return;
      run('deleteGpTask',[S.auth.user,S.auth.pin,D.id],function(d){ if(d && d.ok){ gptTake_(d); S.gptOpen=null; S.gptDraft=null; showMsg(t('Deleted')); } else showMsg(t('Could not save')); render(); }); });
  }
}
/* My Ministry: ✅ Ministry Tasks, folded under the department and ministry (Uriah, Oct 2026: easy to
   find, not much on the screen); open, it is that ministry's lists. Open or shut is remembered. */
function mtOpen_(){ try{ return lsGet('gp-mt-open')==='1'; }catch(e){ return false; } }
function mtFoldHtml_(sel){
  var open=mtOpen_(), n=null;
  if(S.gpt){ var ids=gptLists_({ dept:sel.dept, min:sel.min }).map(function(L){ return L.id; });
    n=S.gpt.tasks.filter(function(x){ return ids.indexOf(x.listId)>-1 && !x.done && x.status!=='declined'; }).length; }
  else if(open && !S.gptLoading && !S.gptErr) setTimeout(gptLoad_, 0);
  S.gptFrom='ministry';
  return '<div class="card mtFold'+(open?' open':'')+'" id="mtFold"><button class="mtHead" id="mtToggle" aria-expanded="'+(open?'true':'false')+'">'+
    '<span>✅ '+esc(t('Ministry Tasks'))+(n ? ' <span class="adminBadge">'+n+'</span>' : '')+'</span><span class="accChevron"'+(open?'':' style="transform:rotate(-90deg)"')+'>'+ACC_CHEVRON+'</span></button>'+
    (open ? '<div class="mtBody">'+gptPageHtml_({ dept:sel.dept, min:sel.min }, true)+'</div>' : '')+'</div>';
}
/* My Home: the line on the card, and the small button by Weekly Goals */
function gptHomeRowHtml_(){
  var I=S.gpTaskInfo; if(!I || S.student || S.guest || S.board) return '';
  return '<button class="heroRow heroRowGo" id="goGpTasks" aria-label="'+esc(t('GP Tasks'))+'"><span class="gptRing">✅</span>'+
    '<div class="heroTrend">'+esc(t('GP Tasks'))+' <b class="heroFig">'+I.open+'</b>'+(I.due ? ' <span class="whoCap">· '+esc(gpT('{n} due',{n:I.due}))+'</span>' : '')+'</div><span class="heroGo" aria-hidden="true">›</span></button>';
}
function gptOpenPage_(from){ S.gptFrom=from||'week'; S.view='tasks'; S.gpt=null; S.gptOpen=null; S.gptDraft=null; render(); window.scrollTo(0,0); }
/* the bell: given a task, asked for help, a request turned down */
function gptNotifItems_(){
  var I=S.gpTaskInfo, out=[]; if(!I) return out;
  (I.notices||[]).forEach(function(n){
    var who=firstName_(gptPerson_(n.by).name);
    var text = n.kind==='assigned' ? (n.from ? gpT('{from} gave you a task: {title}',{from:t(n.from), title:n.title}) : gpT('{name} gave you a task: {title}',{name:who, title:n.title}))
      : n.kind==='request' ? gpT('{from} is asking {list} for help: {title}',{from:t(n.from||who), list:n.list, title:n.title})
      : gpT('{name} can’t take on: {title}',{name:who, title:n.title});
    out.push({ when:n.at, text:'✅ '+text, actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gogptasks="1">'+esc(t('Open'))+'</button>' });
  });
  return out;
}
