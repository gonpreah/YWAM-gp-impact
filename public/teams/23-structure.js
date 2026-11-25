/* ==================== The structure whiteboard (Nov 2026, Andrew) ====================
   "Every quarter we restructure everything based on who is doing what … a whiteboard view … zoom in and zoom out …
   a tree graph of the whole structure … a plus sign in each ministry and department … add people's names and who the
   leader is … not synced into our staff profile … edited in the leadership My Ministry, and it shows in Team → Structure."

   One quarter of one campus as a tree: the campus on top, Campus Leadership (the directors), then each department with its
   director(s) and its ministries, each ministry with its leader(s) 👑 and its people, then the staff who are students this
   quarter. Everyone is a face. The quarter's plan (getStructure / saveStructurePlan, the 'structurePlans' blob) holds where
   each person sits (`place`), who leads what (`leads`), names typed in for people not in the app (`extra`) and the students
   (`students`) and the other ministries someone also serves in (`also`). It is not anyone's profile until the quarter is
   made live (see "Make a quarter live" below): then the arrangement is written to the profiles. A quarter with no plan of its own starts from the latest earlier one, else from
   the profiles; the first change makes the whole arrangement the quarter's own (sbOwn_), so a profile edited later moves
   nobody.

   Pan with a finger or the mouse, pinch or the wheel to zoom, ⤢ to fit. Campus Leadership and admins edit it on their
   My Ministry → Structure tab (sbLeadHtml_): drag a face from the tray at the bottom (or from one box to another) onto a
   box, tap ＋ on a box to add people or a name, tap a face to make them the leader, move them or take them off. Each
   change saves at once for that quarter. Team → Structure shows the same quarter read only (the list, and this tree). */

var SB_MIN_K=0.15, SB_MAX_K=2.2, SB_ALSO_MAX=4;
function sbState_(){ if(!S.sb) S.sb={ x:0, y:0, k:1, fitted:{}, trayQ:'', sheet:null, full:false, saving:0, saved:0, editing:false }; return S.sb; }
/* Which schools run in a quarter (Nov 2026, Andrew: "in Q1 we only have the GPDTS school running"): the plan's `schools`,
   a list of Leadership Development school ministries (LD_SCHOOL_MINISTRIES); null = every school the campus has. A school
   not running has no box that quarter; anyone placed in it waits in the tray, still placed there for a quarter it runs. */
function sbSchoolsOn_(campus){ var LD=getDepartments(campus)['Leadership Development']||{}; return LD_SCHOOL_MINISTRIES.filter(function(m){ return !!LD[m]; }); }
function sbRuns_(plan, m){ return LD_SCHOOL_MINISTRIES.indexOf(m)===-1 || !plan.schools || plan.schools.indexOf(m)>-1; }
/* the students' schools (dts, dbs…) that run this quarter */
var SB_STU_MINS={ dts:['GPDTS','DTS'], dbs:['DBS'], bcs:['BCS'], sms:['SMS'] };
function sbStuSchools_(plan){
  if(!plan || !plan.schools) return STRUCT_SCHOOLS_C;
  var r=STRUCT_SCHOOLS_C.filter(function(sc){ return SB_STU_MINS[sc].some(function(m){ return plan.schools.indexOf(m)>-1; }); });
  return r.length ? r : STRUCT_SCHOOLS_C;
}
function sbCanEdit_(campus){ return !!(S.me && (S.me.isAdmin || (S.me.dept===BL_DEPT && S.me.campus===campus))); }
/* the leadership tab plans the quarter ahead by default (Andrew: "right now we're looking at the quarter one of 2027") */
function sbQuarter_(){ var B=sbState_(); if(B.year && B.q) return { year:B.year, q:B.q }; var n=nextQuarter_(); return { year:n.year, q:n.q }; }
function sbKey_(campus, year, q){ return structKey_(campus, year, q); }
function sbLoad_(campus, year, q){
  var key=sbKey_(campus, year, q);
  if(S.structCache[key] || S.structLoading[key] || S.structError[key]) return;
  S.structLoading[key]=true;
  run('getStructure',[S.auth.user,S.auth.pin,campus,year,q],function(d){
    S.structLoading[key]=false;
    if(d && d.ok) S.structCache[key]={ doc:d.doc, source:d.source, plan:d.plan, diff:d.diff||null }; else S.structError[key]=(d && d.err) || t('The server answered without the saved structure.');
    render();
  }, function(e){ S.structLoading[key]=false; S.structError[key]=String((e && e.message) || t('Connection problem — try again.')); render(); });
}
function sbPlan_(campus, year, q){
  var c=S.structCache[sbKey_(campus, year, q)];
  var p=(c && c.plan) || {};
  return { students:p.students||{}, place:p.place||{}, leads:p.leads||null, extra:p.extra||[], schools:Array.isArray(p.schools) ? p.schools : null,
    also:(p.also && typeof p.also==='object') ? p.also : null, live:p.live||null, inherited:!!p.inherited, from:p.from||null };
}

/* ---- the model: who is where this quarter ---- */
function sbModel_(campus, plan){
  var deps=getDepartments(campus), depts=Object.keys(deps).filter(function(d){ return d!==BL_DEPT; });
  var people={}, order=[];
  (S.roster||[]).forEach(function(p){
    if(p.campus!==campus || p.kind==='applicant') return;
    people[p.id]={ id:p.id, name:p.name, photo:p.photo, avatar:p.avatar, real:true,
      prof:{ dept:p.dept==='Base Director' ? BL_DEPT : (p.dept||''), ministry:p.ministry||'' }, profLeads:(p.leads||[]).slice(), profAlso:(p.ministries||[]).slice() };
    order.push(p.id);
  });
  (plan.extra||[]).forEach(function(x){ people[x.id]={ id:x.id, name:x.name, extra:true, prof:{ dept:'_off', ministry:'' }, profLeads:[] }; order.push(x.id); });
  order.sort(function(a,b){ return String(people[a].name).localeCompare(String(people[b].name)); });
  var pos=function(id){ var pl=plan.place[id]; return pl ? { dept:pl.dept, ministry:pl.ministry||'' } : people[id].prof; };
  var leadsOf=function(key){
    if(plan.leads) return (plan.leads[key]||[]).filter(function(id){ return !!people[id]; });
    return order.filter(function(id){ return people[id].profLeads.indexOf(key)>-1; });
  };
  var boxes={}, placed={};
  var add=function(key, id){ (boxes[key]=boxes[key]||[]).push(id); placed[id]=key; };
  var known={}, all={}; known[BL_DEPT+'|Campus Director']=1; depts.forEach(function(d){ known[BL_DEPT+'|'+d]=1; Object.keys(deps[d]||{}).forEach(function(m){ all[d+'|'+m]=1; if(sbRuns_(plan, m)) known[d+'|'+m]=1; }); });
  Object.keys(known).forEach(function(k){ all[k]=1; });
  var notRunning=sbSchoolsOn_(campus).filter(function(m){ return !sbRuns_(plan, m); });
  var students={};
  order.forEach(function(id){
    if(plan.students[id]){ (students[plan.students[id]]=students[plan.students[id]]||[]).push(id); placed[id]='_students'; return; }
    var w=pos(id), key=w.dept+'|'+w.ministry;
    if(w.dept!=='_off' && known[key]) add(key, id);
  });
  var tray=order.filter(function(id){ return !placed[id]; });
  /* the other ministries someone serves in this quarter (Nov 2026, Uriah: "some people will have 2 ministry jobs"): the
     plan's `also` when it has its own, else their profile's — never their main place, never a Campus Leadership row.
     `any` keeps a school that isn't running this quarter (for the plan), without it only boxes on the chart. */
  var alsoOf=function(id, any){
    var p=people[id]; if(!p || plan.students[id]) return [];
    var w=pos(id), main=w.dept+'|'+(w.ministry||''); if(w.dept==='_off') return [];
    var list=plan.also ? (plan.also[id]||[]) : (p.profAlso||[]);
    return list.filter(function(k, i){ return k!==main && k.indexOf(BL_DEPT+'|')!==0 && (any ? all[k] : known[k]) && list.indexOf(k)===i; }).slice(0, SB_ALSO_MAX);
  };
  var alsoBoxes={};
  order.forEach(function(id){ if(!placed[id] || placed[id]==='_students') return; alsoOf(id).forEach(function(k){ (alsoBoxes[k]=alsoBoxes[k]||[]).push(id); }); });
  return { campus:campus, deps:deps, depts:depts, people:people, order:order, boxes:boxes, students:students, tray:tray, leadsOf:leadsOf, pos:pos, placed:placed, alsoOf:alsoOf, alsoBoxes:alsoBoxes, known:known,
    all:all, plan:plan, notRunning:notRunning, runs:function(m){ return sbRuns_(plan, m); } };
}
function sbBoxName_(key){
  if(key==='_students') return t('Students this quarter');
  if(key==='_off') return t('Not on the chart');
  var i=key.indexOf('|'), d=key.slice(0,i), m=key.slice(i+1);
  if(d===BL_DEPT) return m==='Campus Director' ? t('Campus Directors') : gpT('Director of {dept}',{dept:t(m)});
  return t(m)+' · '+t(d);
}

/* ---- drawing ---- */
function sbFace_(M, id, o){
  o=o||{};
  var p=M.people[id]; if(!p) return '';
  var first=String(p.name||'').split(/\s+/)[0];
  var attr = o.edit ? ' data-sbp="'+esc(id)+'"'+(o.from?' data-sbfrom="'+esc(o.from)+'"':'') : (p.real && !o.noOpen ? ' data-person="'+esc(id)+'"' : '');
  /* o.also: this is their second ministry — the face is marked so nobody counts them twice */
  return '<button type="button" class="sbFace'+(o.lead?' lead':'')+(p.extra?' extra':'')+(o.also?' also':'')+'"'+attr+(o.also?' data-sbalso="1"':'')+' title="'+esc(p.name)+(o.lead?' · '+esc(t('Leader')):'')+(o.also?' · '+esc(t('also serves here')):'')+'">'+
    '<span class="sbFaceImg">'+avatarHtml(p,'sm')+(o.lead?'<span class="sbCrown" aria-hidden="true">👑</span>':'')+'</span>'+
    '<span class="sbFaceName">'+esc(first)+'</span>'+(o.also?'<span class="sbAlsoTag">'+esc(t('also'))+'</span>':'')+'</button>';
}
function sbPlus_(key, edit){ return edit ? '<button type="button" class="sbPlus" data-sbbox="'+esc(key)+'" aria-label="'+esc(gpT('Add to {box}',{box:sbBoxName_(key)}))+'">＋</button>' : ''; }
function sbTreeHtml_(M, edit, title){
  var h='<div class="sbTree" id="sbTree">';
  h+='<div class="sbRootRow"><div class="sbRoot">✦ '+esc(title)+'</div></div>';
  var lk=BL_DEPT+'|Campus Director', dirs=M.boxes[lk]||[];
  h+='<div class="sbLeadRow"><div class="sbNode sbLead" data-sbdrop="'+esc(lk)+'"><div class="sbHead"><span>🧭 '+esc(t('Campus Leadership'))+'</span>'+sbPlus_(lk, edit)+'</div>'+
    '<div class="sbFaces">'+(dirs.length ? dirs.map(function(id){ return sbFace_(M, id, { edit:edit, from:lk, lead:true }); }).join('') : '<span class="sbEmpty">'+esc(edit ? t('Drop the directors here') : t('Nobody here yet'))+'</span>')+'</div></div></div>';
  h+='<div class="sbDepts">';
  M.depts.forEach(function(dept){
    var dk=BL_DEPT+'|'+dept, dd=M.boxes[dk]||[], mins=Object.keys(M.deps[dept]||{}).filter(function(m){ return M.runs(m); });
    var n=dd.length; mins.forEach(function(m){ n+=(M.boxes[dept+'|'+m]||[]).length; });
    h+='<div class="sbCol"><div class="sbNode sbDept" data-sbdept="'+esc(dept)+'">'+
      '<div class="sbHead"><span>'+(MIN_EMOJI[dept]?MIN_EMOJI[dept]+' ':'')+esc(t(dept))+'</span><span class="sbN">'+n+'</span></div>'+
      '<div class="sbDir" data-sbdrop="'+esc(dk)+'"><div class="sbSub"><span>'+esc(t('Director'))+'</span>'+sbPlus_(dk, edit)+'</div><div class="sbFaces">'+
        (dd.length ? dd.map(function(id){ return sbFace_(M, id, { edit:edit, from:dk, lead:true }); }).join('') : '<span class="sbEmpty">'+esc(t('Nobody yet'))+'</span>')+'</div></div>'+
      (M.notRunning.length && Object.keys(M.deps[dept]||{}).some(function(m){ return M.notRunning.indexOf(m)>-1; })
        ? '<div class="sbNotRun" id="sbNotRun">'+esc(gpT('Not running this quarter: {list}',{list:M.notRunning.map(function(m){ return t(m); }).join(' · ')}))+'</div>' : '')+'</div>';
    h+='<div class="sbMins">';
    mins.forEach(function(m){
      var key=dept+'|'+m, leads=M.leadsOf(key), here=(M.boxes[key]||[]).filter(function(id){ return leads.indexOf(id)===-1; });
      var all=leads.length+here.length;
      var also=(M.alsoBoxes[key]||[]).filter(function(id){ return leads.indexOf(id)===-1; }), isAlso=function(id){ return M.placed[id]!==key && (M.alsoBoxes[key]||[]).indexOf(id)>-1; };
      h+='<div class="sbNode sbMin'+(all||also.length?'':' bare')+'" data-sbdrop="'+esc(key)+'"><div class="sbHead"><span>'+(MIN_EMOJI[m]?MIN_EMOJI[m]+' ':'')+esc(t(m))+'</span>'+
        '<span class="sbHeadR"><span class="sbN">'+(all||(also.length?'0':'—'))+(also.length?' <span class="sbNAlso">+'+also.length+'</span>':'')+'</span>'+sbPlus_(key, edit)+'</span></div>'+
        (all||also.length ? '<div class="sbFaces">'+leads.map(function(id){ return sbFace_(M, id, { edit:edit, from:key, lead:true, also:isAlso(id) }); }).join('')+here.map(function(id){ return sbFace_(M, id, { edit:edit, from:key }); }).join('')+
          also.map(function(id){ return sbFace_(M, id, { edit:edit, from:key, also:true }); }).join('')+'</div>' : '')+'</div>';
    });
    h+='</div></div>';
  });
  // the staff doing a school this quarter
  var stuN=0; STRUCT_SCHOOLS_C.forEach(function(sc){ stuN+=(M.students[sc]||[]).length; });   // a student already marked stays shown
  if(stuN || edit){
    h+='<div class="sbCol"><div class="sbNode sbDept sbStu" data-sbdrop="_students"><div class="sbHead"><span>🎓 '+esc(t('Students this quarter'))+'</span><span class="sbN">'+stuN+'</span></div>'+
      (stuN ? STRUCT_SCHOOLS_C.map(function(sc){ var g=M.students[sc]||[]; return g.length ? '<div class="sbSub"><span>'+sc.toUpperCase()+' · '+g.length+'</span></div><div class="sbFaces">'+g.map(function(id){ return sbFace_(M, id, { edit:edit, from:'_students' }); }).join('')+'</div>' : ''; }).join('')
        : '<span class="sbEmpty">'+esc(t('Drop staff doing a school here'))+'</span>')+'</div></div>';
  }
  h+='</div>';
  if(!edit && M.tray.length) h+='<div class="sbLoose"><div class="sbHead"><span>'+esc(t('Not placed yet'))+' · '+M.tray.length+'</span></div><div class="sbFaces">'+M.tray.map(function(id){ return sbFace_(M, id, {}); }).join('')+'</div></div>';
  return h+'</div>';
}
var STRUCT_SCHOOLS_C=['dts','dbs','bcs','sms'];
/* the whole board: the bar, the zoomable view, and (editing) the tray of faces */
function sbBoardHtml_(campus, year, q, edit){
  var B=sbState_(), plan=sbPlan_(campus, year, q), M=sbModel_(campus, plan);
  B.cur={ campus:campus, year:year, q:q, edit:!!edit, key:sbKey_(campus, year, q) };
  var title=gpT('{campus} · Q{q} {year}',{campus:campusShort(campus), q:q, year:year});
  /* data-noptr: a drag on the board is never the app's pull to refresh (Nov 2026, Andrew: "when I move down, it refreshes the page") */
  var h='<div class="sbWrap'+(B.full?' full':'')+(edit?' editing':'')+'" id="sbWrap" data-noptr="1">';
  h+='<div class="sbBar"><div class="sbZoom"><button type="button" class="sbZb" id="sbOut" aria-label="'+esc(t('Zoom out'))+'">−</button>'+
    '<span class="sbPct" id="sbPct">'+Math.round(B.k*100)+'%</span><button type="button" class="sbZb" id="sbIn" aria-label="'+esc(t('Zoom in'))+'">＋</button>'+
    '<button type="button" class="sbZb" id="sbFit" aria-label="'+esc(t('Fit the whole structure'))+'">⤢</button>'+
    '<button type="button" class="sbZb" id="sbFull" aria-label="'+esc(B.full ? t('Close full screen') : t('Full screen'))+'">'+(B.full?'✕':'⛶')+'</button></div>'+
    (edit ? '<span class="sbSaved" id="sbSaved">'+esc(B.saving ? t('Saving…') : B.saved ? t('Saved ✓') : '')+'</span>' : '')+
    (B.full && B.canEdit ? sbModeHtml_() : '')+'</div>';
  h+='<div class="sbView" id="sbView"><div class="sbCanvas" id="sbCanvas" style="transform:translate('+B.x+'px,'+B.y+'px) scale('+B.k+')">'+sbTreeHtml_(M, edit, title)+'</div>'+
    '<p class="sbHint">'+esc(edit ? t('Drag a face onto a box. Tap ＋ to add, tap a face for more.') : B.canEdit ? t('Looking only — nobody moves. Tap Edit to make changes.') : t('Pinch or scroll to zoom, drag to move around.'))+'</p></div>';
  if(edit){
    var q2=(B.trayQ||'').trim().toLowerCase();
    var list=M.order.filter(function(id){ return !q2 || String(M.people[id].name).toLowerCase().indexOf(q2)>-1; });
    var off=list.filter(function(id){ return M.tray.indexOf(id)>-1; }), on=list.filter(function(id){ return M.tray.indexOf(id)===-1; });
    h+='<div class="sbTray" id="sbTray" data-sbdrop="_off"><div class="sbTrayHead"><b>'+esc(off.length ? gpT('Not on the chart yet · {n}',{n:M.tray.length}) : t('Everyone'))+'</b>'+
      '<input type="search" id="sbTrayQ" value="'+esc(B.trayQ||'')+'" placeholder="'+esc(t('Find someone…'))+'" autocomplete="off"></div>'+
      '<div class="sbTrayFaces" id="sbTrayFaces">'+off.map(function(id){ return sbFace_(M, id, { edit:true, from:'_off' }); }).join('')+
        (off.length && on.length ? '<span class="sbTraySep" aria-hidden="true"></span>' : '')+
        on.map(function(id){ return sbFace_(M, id, { edit:true, from:M.placed[id] }); }).join('')+'</div>'+
      '<p class="sbTrayHint">'+esc(t('Drop a face here to take them off the chart for this quarter.'))+'</p></div>';
  }
  h+='</div>';
  if(edit && B.sheet) h+=sbSheetHtml_(M, B.sheet);
  return h;
}

/* ---- the sheets: a box's people, one person, a school ---- */
function sbSheetHtml_(M, sh){
  var h='<div class="sbScrim" id="sbScrim"></div><div class="sbSheet gtSheet" id="sbSheet" role="dialog" aria-modal="true">';
  var close='<button type="button" class="hbtn sbClose" id="sbSheetClose" aria-label="'+esc(t('Close'))+'">✕</button>';
  if(sh.kind==='box'){
    var key=sh.key, isMin=key.indexOf(BL_DEPT+'|')!==0, leads=isMin ? M.leadsOf(key) : [];
    var inBox=(M.boxes[key]||[]).slice(); leads.forEach(function(id){ if(inBox.indexOf(id)===-1) inBox.unshift(id); });
    inBox.sort(function(a,b){ return (leads.indexOf(b)>-1)-(leads.indexOf(a)>-1); });
    h+='<div class="sbSheetHead"><b>'+esc(sbBoxName_(key))+'</b>'+close+'</div>';
    var alsoIn=(M.alsoBoxes[key]||[]).slice(); alsoIn.forEach(function(id){ if(inBox.indexOf(id)===-1) inBox.push(id); });
    h+=inBox.length ? '<div class="sbRows">'+inBox.map(function(id){ var p=M.people[id], L=leads.indexOf(id)>-1, A=alsoIn.indexOf(id)>-1 && M.placed[id]!==key;
        return '<div class="sbRow">'+avatarHtml(p,'sm')+'<span class="sbRowName">'+esc(p.name)+(p.extra?' <span class="hint">· '+esc(t('typed in'))+'</span>':'')+(A?' <span class="sbAlsoTag">'+esc(t('also'))+'</span>':'')+'</span>'+
          (isMin ? '<button type="button" class="sbLeadBtn'+(L?' on':'')+'" data-sblead="'+esc(key)+'|'+esc(id)+'">'+(L?'👑 '+esc(t('Leader')):esc(t('Make leader')))+'</button>' : '')+
          (A ? '<button type="button" class="gptX" data-sbalsorm="'+esc(key)+'|'+esc(id)+'" aria-label="'+esc(gpT('{name} no longer also serves here',{name:p.name}))+'">×</button>'
             : '<button type="button" class="gptX" data-sbout="'+esc(id)+'" aria-label="'+esc(gpT('Take {name} out',{name:p.name}))+'">×</button>')+'</div>'; }).join('')+'</div>'
      : '<p class="sub" style="margin:4px 0 10px">'+esc(t('Nobody here yet.'))+'</p>';
    var cand=M.order.filter(function(id){ return inBox.indexOf(id)===-1; }).map(function(id){ var p=M.people[id], w=M.placed[id];
      return { id:id, name:p.name, sub: w==='_students' ? t('Student') : w ? sbBoxName_(w) : t('Not on the chart'), first: !w, group: !w ? t('Not on the chart yet') : t('Everyone else') }; });
    h+='<div class="sbAdd"><div class="eyebrow">'+esc(t('Add people'))+'</div>'+ppickHtml_({ key:'sb', people:cand, placeholder:t('Type a name…'), onPick:function(id){ sbMove_(id, key); } })+'</div>';
    h+='<div class="sbAdd"><div class="eyebrow">'+esc(t('Someone not in the app yet'))+'</div><div class="sbNewRow"><input type="text" id="sbNewName" maxlength="60" placeholder="'+esc(t('Their name'))+'">'+
      '<button type="button" class="btn small" id="sbNewAdd" data-sbnewkey="'+esc(key)+'">'+esc(t('Add'))+'</button></div>'+
      '<p class="hint" style="margin:4px 0 0">'+esc(t('For someone coming this quarter. It is only on this chart.'))+'</p></div>';
  } else if(sh.kind==='person'){
    var p=M.people[sh.id]; if(!p) return '';
    var w=M.placed[sh.id] || '_off', isMin2=w!=='_off' && w!=='_students' && w.indexOf(BL_DEPT+'|')!==0, L2=isMin2 && M.leadsOf(w).indexOf(sh.id)>-1;
    h+='<div class="sbSheetHead"><span class="sbPHead">'+avatarHtml(p,'sm')+'<b>'+esc(p.name)+'</b></span>'+close+'</div>';
    h+='<p class="sub" style="margin:0 0 6px">'+esc(w==='_students' ? gpT('A {school} student this quarter',{school:String(sbStudentOf_(sh.id)).toUpperCase()}) : w==='_off' ? t('Not on the chart this quarter') : gpT('In {box}',{box:sbBoxName_(w)}))+'</p>';
    if(p.real) h+='<p class="hint" style="margin:0 0 10px">'+esc(gpT('Their profile says {where}.',{where:t(p.prof.ministry||p.prof.dept||'—')+(p.prof.ministry?' · '+t(p.prof.dept):'')}))+'</p>';
    if(isMin2) h+='<button type="button" class="btn ghost" data-sblead="'+esc(w)+'|'+esc(sh.id)+'">'+(L2 ? esc(t('Not the leader')) : '👑 '+esc(gpT('Make leader of {min}',{min:sbBoxName_(w)})))+'</button>';
    h+='<label class="f" for="sbMoveSel">'+esc(t('Move to'))+'</label><select id="sbMoveSel">'+sbTargetsHtml_(M, w)+'</select>'+
      '<button type="button" class="btn" id="sbMoveGo" data-sbid="'+esc(sh.id)+'">'+esc(t('Move'))+'</button>';
    if(w!=='_off' && w!=='_students') h+=sbAlsoHtml_(M, sh.id, w);
    if(w!=='_off') h+='<button type="button" class="btn ghost" data-sbout="'+esc(sh.id)+'">'+esc(t('Take off the chart this quarter'))+'</button>';
    if(p.extra) h+='<div class="sbAdd"><div class="eyebrow">'+esc(t('Typed-in name'))+'</div><div class="sbNewRow"><input type="text" id="sbRename" maxlength="60" value="'+esc(p.name)+'">'+
      '<button type="button" class="btn small" id="sbRenameGo" data-sbid="'+esc(sh.id)+'">'+esc(t('Save'))+'</button></div>'+
      '<button type="button" class="linkbtn danger" id="sbDelName" data-sbid="'+esc(sh.id)+'">'+esc(t('Remove this name'))+'</button></div>';
  } else if(sh.kind==='school'){
    var ps=M.people[sh.id]; if(!ps) return '';
    h+='<div class="sbSheetHead"><b>'+esc(gpT('Which school is {name} doing?',{name:ps.name}))+'</b>'+close+'</div><div class="sbSchools">'+
      sbStuSchools_(M.plan).map(function(sc){ return '<button type="button" class="btn ghost" data-sbschool="'+sc+'">'+sc.toUpperCase()+'</button>'; }).join('')+'</div>'+
      '<p class="hint">'+esc(t('For this quarter only. Their profile stays as it is.'))+'</p>';
  }
  return h+'</div>';
}
/* One person's ministries on the sheet: which is the main one (where their profile's ministry goes, the one My Ministry
   opens on) and the others they also serve in — add one, take one off, or make one of them the main (the two swap). */
function sbAlsoHtml_(M, id, main){
  var list=M.alsoOf(id), mainBL=main.indexOf(BL_DEPT+'|')===0;
  var h='<div class="sbAdd sbAlso" id="sbAlso"><div class="eyebrow">'+esc(t('Their ministries this quarter'))+'</div>'+
    '<div class="sbRow sbAlsoRow"><span class="sbRowName">⭐ '+esc(sbBoxName_(main))+'</span><span class="sbMainTag" id="sbMainTag">'+esc(t('Main ministry'))+'</span></div>';
  h+=list.map(function(k){
    return '<div class="sbRow sbAlsoRow" data-sbalsorow="'+esc(k)+'"><span class="sbRowName">'+esc(sbBoxName_(k))+' <span class="sbAlsoTag">'+esc(t('also'))+'</span></span>'+
      (mainBL ? '' : '<button type="button" class="sbLeadBtn" data-sbmain="'+esc(k)+'|'+esc(id)+'">'+esc(t('Make this their main ministry'))+'</button>')+
      '<button type="button" class="gptX" data-sbalsorm="'+esc(k)+'|'+esc(id)+'" aria-label="'+esc(gpT('No longer also in {min}',{min:sbBoxName_(k)}))+'">×</button></div>'; }).join('');
  if(list.length<SB_ALSO_MAX){
    var opts='';
    M.depts.forEach(function(d){
      var ms=Object.keys(M.deps[d]||{}).filter(function(m){ var k=d+'|'+m; return M.known[k] && k!==main && list.indexOf(k)===-1; });
      if(ms.length) opts+='<optgroup label="'+esc(t(d))+'">'+ms.map(function(m){ return '<option value="'+esc(d+'|'+m)+'">'+esc(t(m))+'</option>'; }).join('')+'</optgroup>';
    });
    h+='<label class="f" for="sbAlsoSel">'+esc(t('Also serves in…'))+'</label><div class="sbNewRow"><select id="sbAlsoSel"><option value="">'+esc(t('Choose a ministry'))+'</option>'+opts+'</select>'+
      '<button type="button" class="btn small" id="sbAlsoAdd" data-sbid="'+esc(id)+'">'+esc(t('Add'))+'</button></div>';
  }
  return h+'<p class="hint" style="margin:4px 0 0">'+esc(t('They get both ministries’ pages on My Ministry. Dragging their face moves the main one.'))+'</p></div>';
}
function sbTargetsHtml_(M, cur){
  var opt=function(k, label){ return '<option value="'+esc(k)+'"'+(k===cur?' selected':'')+'>'+esc(label)+'</option>'; };
  var h=opt(BL_DEPT+'|Campus Director', t('Campus Directors'));
  M.depts.forEach(function(d){
    h+='<optgroup label="'+esc(t(d))+'">'+opt(BL_DEPT+'|'+d, gpT('Director of {dept}',{dept:t(d)}))+
      Object.keys(M.deps[d]||{}).map(function(m){ return opt(d+'|'+m, t(m)); }).join('')+'</optgroup>';
  });
  h+='<optgroup label="'+esc(t('Students this quarter'))+'">'+STRUCT_SCHOOLS_C.map(function(sc){ return opt('_stu:'+sc, sc.toUpperCase()); }).join('')+'</optgroup>';
  return h+opt('_off', t('Not on the chart'));
}
function sbStudentOf_(id){ var B=sbState_(), c=B.cur, plan=c ? sbPlan_(c.campus, c.year, c.q) : null; return plan ? (plan.students[id]||'') : ''; }

/* ---- changes: the quarter's plan, saved at once ---- */
/* The first change makes the quarter's arrangement its own: everyone where they stand now, who leads what now — so a
   profile edited later moves nobody on this chart. */
function sbOwn_(campus, plan){
  var M=sbModel_(campus, plan), place={}, leads={};
  M.order.forEach(function(id){ var w=M.pos(id); place[id]={ dept:w.dept||'_off', ministry:w.ministry||'' }; if(w.dept && w.dept!=='_off' && !M.all[w.dept+'|'+(w.ministry||'')]) place[id]={ dept:'_off', ministry:'' }; });
  M.depts.forEach(function(d){ Object.keys(M.deps[d]||{}).forEach(function(m){ var k=d+'|'+m, l=M.leadsOf(k); if(l.length) leads[k]=l.slice(); }); });
  return { students:Object.assign({}, plan.students), place:place, leads:leads, extra:(plan.extra||[]).slice(), schools:plan.schools ? plan.schools.slice() : null, also:sbAlsoAll_(M), live:plan.live||null, inherited:false };
}
function sbAlsoAll_(M){ var also={}; M.order.forEach(function(id){ var a=M.alsoOf(id, true); if(a.length) also[id]=a; }); return also;
}
function sbChange_(fn){
  var B=sbState_(), c=B.cur; if(!c || !c.edit) return;
  var cache=S.structCache[c.key] || (S.structCache[c.key]={ doc:null, source:'none' });
  var cur=sbPlan_(c.campus, c.year, c.q);
  var own=(cache.plan && !cache.plan.inherited && cache.plan.leads) ? { students:Object.assign({}, cur.students), place:Object.assign({}, cur.place), leads:JSON.parse(JSON.stringify(cur.leads||{})), extra:cur.extra.slice(), schools:cur.schools ? cur.schools.slice() : null,
    also:cur.also ? JSON.parse(JSON.stringify(cur.also)) : sbAlsoAll_(sbModel_(c.campus, cur)), live:cur.live||null, inherited:false } : sbOwn_(c.campus, cur);
  fn(own);
  cache.plan=own;
  sbSave_();
  render();
}
var _sbSaveT=null;
function sbSave_(){
  var B=sbState_(), c=B.cur; if(!c) return;
  B.saving++; B.saved=0;
  clearTimeout(_sbSaveT);
  _sbSaveT=setTimeout(function(){
    var cache=S.structCache[c.key]; if(!cache || !cache.plan) return;
    var p=cache.plan, n=B.saving;
    run('saveStructurePlan',[S.auth.user,S.auth.pin,c.campus,c.year,c.q,p.students,p.place,p.leads,p.extra,p.schools||null,p.also||null],function(d){
      if(d && d.ok && d.applied && d.applied.length) sbPatchRoster_(d.applied);   // a live quarter: those profiles changed just now
      if(B.saving!==n) return;   // a newer change is on its way
      B.saving=0;
      if(d && d.ok){ B.saved=Date.now(); if(d.doc){ cache.doc=d.doc; cache.source='saved'; } if(d.diff) cache.diff=d.diff; if(cache.plan && d.plan) cache.plan.live=d.plan.live||null; }
      else showMsg(d && d.err==='not_authorized' ? t('Only Campus Leadership and admins can change the structure.') : t('Could not save'));
      if(d && d.ok && d.applied && d.applied.length) showMsg(d.applied.length===1 ? gpT('{name}’s profile is updated',{name:d.applied[0].name}) : gpT('{n} profiles updated',{n:d.applied.length}));
      sbLiveRefresh_();
      var el=document.getElementById('sbSaved'); if(el) el.textContent = d && d.ok ? t('Saved ✓') : '';
    }, function(){ B.saving=0; showMsg(t('Connection problem — try again.')); var el=document.getElementById('sbSaved'); if(el) el.textContent=''; });
  }, 450);
}
function sbDropLeads_(p, id, except){ var keep=(p.also && p.also[id]) || []; Object.keys(p.leads||{}).forEach(function(k){ if(k===except || keep.indexOf(k)>-1) return; p.leads[k]=p.leads[k].filter(function(x){ return x!==id; }); if(!p.leads[k].length) delete p.leads[k]; }); }
function sbMove_(id, target){
  if(!target) return;
  if(target==='_students'){ sbState_().sheet={ kind:'school', id:id }; render(); return; }
  var c0=S.sb && S.sb.cur, M0=c0 ? sbModel_(c0.campus, sbPlan_(c0.campus, c0.year, c0.q)) : null;
  if(M0 && M0.placed[id]===target) return;   // already their main place (a second-ministry face dropped back on it)
  sbChange_(function(p){
    delete p.students[id];
    if(target.indexOf('_stu:')===0){ p.students[id]=target.slice(5); p.place[id]={ dept:'_off', ministry:'' }; if(p.also) delete p.also[id]; sbDropLeads_(p, id); return; }
    if(target==='_off'){ p.place[id]={ dept:'_off', ministry:'' }; if(p.also) delete p.also[id]; sbDropLeads_(p, id); return; }
    var i=target.indexOf('|');
    p.place[id]={ dept:target.slice(0,i), ministry:target.slice(i+1) };
    if(p.also && p.also[id]){ p.also[id]=p.also[id].filter(function(k){ return k!==target; }); if(!p.also[id].length) delete p.also[id]; }   // their second ministry became the main one
    sbDropLeads_(p, id, target);   // a leader moved elsewhere no longer leads where they were
  });
  var M=S.sb && S.sb.cur ? sbModel_(S.sb.cur.campus, sbPlan_(S.sb.cur.campus, S.sb.cur.year, S.sb.cur.q)) : null;
  var who=M && M.people[id] ? M.people[id].name : '';
  var isStu=target.slice(0,5)==='_stu'+':', boxLabel=isStu ? target.slice(5).toUpperCase() : sbBoxName_(target);
  if(who && target==='_off') showMsg(gpT('{name} is off the chart for this quarter',{name:who}));
  else if(who) showMsg(gpT('{name} moved to {box}',{name:who, box:boxLabel}));
}
function sbToggleLead_(key, id){
  sbChange_(function(p){
    p.leads=p.leads||{};
    var l=p.leads[key]||[];
    if(l.indexOf(id)>-1){ l=l.filter(function(x){ return x!==id; }); }
    else if(p.also && (p.also[id]||[]).indexOf(key)>-1){ l=l.concat([id]).slice(0, 8); }   // leading their second ministry: the main one stays
    else { l=l.concat([id]).slice(0, 8); delete p.students[id]; p.place[id]={ dept:key.slice(0, key.indexOf('|')), ministry:key.slice(key.indexOf('|')+1) }; sbDropLeads_(p, id, key); }
    if(l.length) p.leads[key]=l; else delete p.leads[key];
  });
}
/* a second ministry: add it, take it off, or make it the main one (the two swap) */
function sbAlsoAdd_(id, key){
  if(!key) return;
  sbChange_(function(p){ p.also=p.also||{}; var l=p.also[id]||[]; if(l.indexOf(key)===-1 && l.length<SB_ALSO_MAX) p.also[id]=l.concat([key]); });
}
function sbAlsoRm_(id, key){
  sbChange_(function(p){
    if(!p.also || !p.also[id]) return;
    p.also[id]=p.also[id].filter(function(k){ return k!==key; }); if(!p.also[id].length) delete p.also[id];
    if(p.leads && p.leads[key]){ p.leads[key]=p.leads[key].filter(function(x){ return x!==id; }); if(!p.leads[key].length) delete p.leads[key]; }
  });
}
function sbMakeMain_(id, key){
  sbChange_(function(p){
    var old=p.place[id], oldKey=old && old.dept!=='_off' ? old.dept+'|'+(old.ministry||'') : '', i=key.indexOf('|');
    p.also=p.also||{};
    var l=(p.also[id]||[]).filter(function(k){ return k!==key; });
    if(oldKey && old.ministry && oldKey.indexOf(BL_DEPT+'|')!==0) l.unshift(oldKey);
    p.place[id]={ dept:key.slice(0,i), ministry:key.slice(i+1) };
    if(l.length) p.also[id]=l.slice(0, SB_ALSO_MAX); else delete p.also[id];
  });
}
/* A live quarter changed someone's profile: the roster on this phone follows (and my own card, if it was me). */
function sbPatchRoster_(changes){
  (changes||[]).forEach(function(ch){
    if(!ch || !ch.now) return;
    var set=function(o){ o.dept=ch.now.dept; o.ministry=ch.now.ministry; o.ministries=(ch.now.ministries||[]).slice(); o.leads=(ch.now.leads||[]).slice(); };
    (S.roster||[]).forEach(function(p){ if(p.id===ch.id) set(p); });
    if(S.me && S.me.id===ch.id) set(S.me);
  });
}
function sbNewName_(name, key){
  name=String(name||'').trim().slice(0,60); if(!name) return;
  var id='x_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  sbChange_(function(p){ p.extra.push({ id:id, name:name }); p.place[id]= key ? { dept:key.slice(0, key.indexOf('|')), ministry:key.slice(key.indexOf('|')+1) } : { dept:'_off', ministry:'' }; });
}

/* ---- pan, zoom and drag ---- */
function sbApply_(){
  var B=sbState_(), cv=document.getElementById('sbCanvas'); if(!cv) return;
  cv.style.transform='translate('+B.x+'px,'+B.y+'px) scale('+B.k+')';
  var pc=document.getElementById('sbPct'); if(pc) pc.textContent=Math.round(B.k*100)+'%';
}
function sbZoomAt_(k2, cx, cy){
  var B=sbState_(); k2=Math.max(SB_MIN_K, Math.min(SB_MAX_K, k2));
  B.x=cx-(cx-B.x)*(k2/B.k); B.y=cy-(cy-B.y)*(k2/B.k); B.k=k2; sbApply_();
}
function sbFit_(first){
  var B=sbState_(), v=document.getElementById('sbView'), tr=document.getElementById('sbTree'); if(!v || !tr) return;
  var vw=v.clientWidth, vh=v.clientHeight, w=tr.offsetWidth, h=tr.offsetHeight; if(!w || !h) return;
  var k=Math.max(SB_MIN_K, Math.min(1, Math.min((vw-16)/w, (vh-16)/h)));
  /* opened on a phone the whole tree would be too small to read: start readable, on the top of the tree (Campus
     Leadership and the departments around the middle); ⤢ still shows it all */
  if(first && k<0.45){ k=Math.min(0.62, Math.max(0.45, vw/560)); B.k=k; B.x=Math.round(vw/2-(w*k)/2); B.y=10; sbApply_(); return; }
  B.k=k; B.x=Math.round((vw-w*k)/2); B.y=Math.max(8, Math.round((vh-h*k)/2)); sbApply_();
}
function bindSb_(){
  var v=document.getElementById('sbView'); if(!v) return;
  var B=sbState_(), c=B.cur;
  if(c && !B.fitted[c.key+(B.full?'f':'')]){ B.fitted[c.key+(B.full?'f':'')]=1; requestAnimationFrame(function(){ sbFit_(true); }); }
  document.body.classList.toggle('sbFullOn', !!B.full && !!document.getElementById('sbWrap'));
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  var mid=function(){ var r=v.getBoundingClientRect(); return [r.width/2, r.height/2]; };
  on('sbIn', function(){ var m=mid(); sbZoomAt_(B.k*1.25, m[0], m[1]); });
  on('sbOut', function(){ var m=mid(); sbZoomAt_(B.k/1.25, m[0], m[1]); });
  on('sbFit', function(){ gpTap(); sbFit_(); });
  on('sbFull', function(){ gpTap(); B.full=!B.full; render(); });
  /* the view: one finger or the mouse moves it, two fingers pinch, the wheel zooms (a trackpad's pinch too) */
  /* every finger on the board is counted here, a face's too (capture phase, before the face's own handler): a second
     finger always means pinch — a face drag that had started stands down (B.pinch) */
  var pts={}, start=null, moved=false;
  var pinchStart=function(){ var ids=Object.keys(pts), r=v.getBoundingClientRect(), a=pts[ids[0]], b=pts[ids[1]];
    start={ mode:'pinch', d:Math.hypot(a.x-b.x, a.y-b.y)||1, k:B.k, cx:(a.x+b.x)/2-r.left, cy:(a.y+b.y)/2-r.top, bx:B.x, by:B.y }; moved=true; B.pinch=true; };
  v.addEventListener('pointerdown', function(e){
    var onFace=!!(e.target.closest && e.target.closest('[data-sbp]'));
    if(!onFace && e.target.closest && e.target.closest('.sbPlus, button, input, select, a')) return;
    pts[e.pointerId]={ x:e.clientX, y:e.clientY, face:onFace };
    var ids=Object.keys(pts);
    if(ids.length===2) pinchStart();
    else if(ids.length===1 && !onFace){ try{ v.setPointerCapture(e.pointerId); }catch(err){} start={ mode:'pan', x:e.clientX, y:e.clientY, bx:B.x, by:B.y }; moved=false; }
  }, true);
  v.onpointermove=function(e){
    if(!pts[e.pointerId]) return;
    pts[e.pointerId].x=e.clientX; pts[e.pointerId].y=e.clientY;
    if(!start) return;
    if(start.mode==='pan'){
      var dx=e.clientX-start.x, dy=e.clientY-start.y;
      if(Math.abs(dx)+Math.abs(dy)>4) moved=true;
      B.x=start.bx+dx; B.y=start.by+dy; sbApply_();
    } else {
      var ids=Object.keys(pts); if(ids.length<2) return;
      var a=pts[ids[0]], b=pts[ids[1]], d=Math.hypot(a.x-b.x, a.y-b.y)||1, k2=Math.max(SB_MIN_K, Math.min(SB_MAX_K, start.k*d/start.d));
      B.k=k2; B.x=start.cx-(start.cx-start.bx)*(k2/start.k); B.y=start.cy-(start.cy-start.by)*(k2/start.k); sbApply_();
    }
  };
  var up=function(e){
    if(!pts[e.pointerId]) return;
    delete pts[e.pointerId]; var ids=Object.keys(pts);
    if(ids.length<2) setTimeout(function(){ B.pinch=false; }, 0);
    if(!ids.length) start=null;
    else if(ids.length===1 && !pts[ids[0]].face){ var p=pts[ids[0]]; start={ mode:'pan', x:p.x, y:p.y, bx:B.x, by:B.y }; }
    else start=null;
  };
  v.addEventListener('pointerup', up, true); v.addEventListener('pointercancel', up, true);
  v.addEventListener('click', function(e){ if(moved){ e.stopPropagation(); e.preventDefault(); moved=false; } }, true);
  v.onwheel=function(e){
    e.preventDefault();
    var r=v.getBoundingClientRect();
    if(e.ctrlKey || !e.shiftKey && Math.abs(e.deltaY)>=Math.abs(e.deltaX)) sbZoomAt_(B.k*Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0018)), e.clientX-r.left, e.clientY-r.top);
    else { B.x-=e.deltaX||e.deltaY; sbApply_(); }
  };
  if(!c || !c.edit) return;
  /* editing: drag a face (from the chart or the tray) onto a box, or onto the tray to take them off; a tap opens them */
  document.querySelectorAll('[data-sbp]').forEach(function(f){
    f.onclick=function(e){ e.preventDefault(); };
    f.onpointerdown=function(e){
      if(e.button>0) return;
      e.stopPropagation();
      var id=f.getAttribute('data-sbp'), from=f.getAttribute('data-sbfrom')||'', sx=e.clientX, sy=e.clientY, ghost=null, over=null, inTray=!!f.closest('#sbTray'), edgeT=null, last=null;
      try{ f.setPointerCapture(e.pointerId); }catch(err){}
      var edge=function(){ if(!ghost || !last) return; var r=v.getBoundingClientRect(), dx=0, dy=0;
        if(last.x<r.left+30) dx=12; else if(last.x>r.right-30) dx=-12; if(last.y<r.top+30) dy=12; else if(last.y>r.bottom-30 && last.y<r.bottom) dy=-12;
        if(dx||dy){ B.x+=dx; B.y+=dy; sbApply_(); } edgeT=requestAnimationFrame(edge); };
      var stood=false, standDown=function(){ stood=true; if(edgeT) cancelAnimationFrame(edgeT); if(ghost){ ghost.remove(); ghost=null; } f.classList.remove('dragging'); document.body.classList.remove('sbDragging'); if(over){ over.classList.remove('sbOver'); over=null; } };
      var move=function(ev){
        if(stood) return;
        if(B.pinch){ standDown(); return; }   // two fingers: it's a pinch, not a drag
        last={ x:ev.clientX, y:ev.clientY };
        var dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(!ghost){
          if(Math.abs(dx)+Math.abs(dy)<7) return;
          if(inTray && Math.abs(dx)>Math.abs(dy)*1.3) return;   // sideways in the tray scrolls it
          ghost=f.cloneNode(true); ghost.className='sbFace sbGhost'+(f.classList.contains('lead')?' lead':''); ghost.removeAttribute('data-sbp'); document.body.appendChild(ghost);
          f.classList.add('dragging'); document.body.classList.add('sbDragging'); edgeT=requestAnimationFrame(edge);
        }
        ev.preventDefault();
        ghost.style.left=(ev.clientX-24)+'px'; ghost.style.top=(ev.clientY-30)+'px';
        var el=document.elementFromPoint(ev.clientX, ev.clientY), tg=el && el.closest ? el.closest('[data-sbdrop]') : null;
        if(over!==tg){ if(over) over.classList.remove('sbOver'); over=tg; if(over) over.classList.add('sbOver'); }
      };
      var end=function(ev){
        f.removeEventListener('pointermove', move); f.removeEventListener('pointerup', end); f.removeEventListener('pointercancel', end);
        if(stood || B.pinch){ standDown(); return; }
        if(edgeT) cancelAnimationFrame(edgeT);
        document.body.classList.remove('sbDragging');
        if(ghost){ ghost.remove(); f.classList.remove('dragging');
          if(over){ over.classList.remove('sbOver'); var to=over.getAttribute('data-sbdrop'); if(ev.type==='pointerup' && to && to!==from) sbMove_(id, to); }
          return; }
        if(ev.type==='pointerup'){ gpTap(); B.sheet={ kind:'person', id:id }; render(); }
      };
      f.addEventListener('pointermove', move); f.addEventListener('pointerup', end); f.addEventListener('pointercancel', end);
    };
  });
  document.querySelectorAll('[data-sbbox]').forEach(function(b){ b.onclick=function(e){ e.stopPropagation(); gpTap(); if(S.ppick) S.ppick.sb={ q:'' }; B.sheet={ kind:'box', key:b.getAttribute('data-sbbox') }; render(); }; });
  var tq=document.getElementById('sbTrayQ');
  if(tq) tq.oninput=function(){ B.trayQ=tq.value; var pos=tq.selectionStart; render(); var t2=document.getElementById('sbTrayQ'); if(t2){ t2.focus(); try{ t2.setSelectionRange(pos, pos); }catch(err){} } };
  // the sheet
  var shut=function(){ B.sheet=null; render(); };
  on('sbScrim', shut); on('sbSheetClose', shut);
  document.querySelectorAll('[data-sblead]').forEach(function(b){ b.onclick=function(){ gpTap(); var v2=b.getAttribute('data-sblead'), i=v2.lastIndexOf('|'); sbToggleLead_(v2.slice(0,i), v2.slice(i+1)); }; });
  document.querySelectorAll('[data-sbout]').forEach(function(b){ b.onclick=function(){ gpTap(); var id=b.getAttribute('data-sbout'); if(B.sheet && B.sheet.kind==='person') B.sheet=null; sbMove_(id, '_off'); }; });
  document.querySelectorAll('[data-sbalsorm]').forEach(function(b){ b.onclick=function(){ gpTap(); var v2=b.getAttribute('data-sbalsorm'), i=v2.lastIndexOf('|'); sbAlsoRm_(v2.slice(i+1), v2.slice(0,i)); }; });
  document.querySelectorAll('[data-sbmain]').forEach(function(b){ b.onclick=function(){ gpTap(); var v2=b.getAttribute('data-sbmain'), i=v2.lastIndexOf('|'); sbMakeMain_(v2.slice(i+1), v2.slice(0,i)); }; });
  on('sbAlsoAdd', function(){ var sel=document.getElementById('sbAlsoSel'); if(!sel || !sel.value){ if(sel) sel.focus(); return; } gpTap(); sbAlsoAdd_(this.getAttribute('data-sbid'), sel.value); });
  on('sbMoveGo', function(){ var sel=document.getElementById('sbMoveSel'), id=this.getAttribute('data-sbid'); if(!sel) return; B.sheet=null; sbMove_(id, sel.value); });
  on('sbNewAdd', function(){ var inp=document.getElementById('sbNewName'), key=this.getAttribute('data-sbnewkey'); if(!inp || !inp.value.trim()){ if(inp) inp.focus(); return; } sbNewName_(inp.value, key); });
  var nn=document.getElementById('sbNewName'); if(nn) nn.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var b2=document.getElementById('sbNewAdd'); if(b2) b2.click(); } };
  on('sbRenameGo', function(){ var inp=document.getElementById('sbRename'), id=this.getAttribute('data-sbid'), nm=inp ? inp.value.trim().slice(0,60) : ''; if(!nm) return; sbChange_(function(p){ p.extra.forEach(function(x){ if(x.id===id) x.name=nm; }); }); });
  on('sbDelName', function(){ var id=this.getAttribute('data-sbid'); if(!gpAsk_(t('Remove this name from the chart?'))) return; B.sheet=null; sbChange_(function(p){ p.extra=p.extra.filter(function(x){ return x.id!==id; }); delete p.place[id]; sbDropLeads_(p, id); }); });
  document.querySelectorAll('[data-sbschool]').forEach(function(b){ b.onclick=function(){ var id=B.sheet && B.sheet.id; B.sheet=null; if(id) sbMove_(id, '_stu:'+b.getAttribute('data-sbschool')); }; });
}

/* ---- View or Edit (Nov 2026, Andrew: "a view mode where you don't accidently move people and an edit mode") ----
   The leadership tab opens on View: the board only moves and zooms, a face opens nobody and moves nobody. Edit brings the
   tray, the ＋ buttons, dragging and the schools row. Kept for the visit (S.sb.editing); Team → Structure's Edit opens on it. */
function sbModeHtml_(){
  var on=!!sbState_().editing;
  return '<span class="sbMode" role="group" aria-label="'+esc(t('View or edit'))+'">'+
    '<button type="button" class="sbModeB'+(on?'':' on')+'" id="sbModeView" aria-pressed="'+(!on)+'">👁 '+esc(t('View'))+'</button>'+
    '<button type="button" class="sbModeB'+(on?' on':'')+'" id="sbModeEdit" aria-pressed="'+on+'">✏️ '+esc(t('Edit'))+'</button></span>';
}
function bindSbMode_(){
  var B=sbState_();
  var set=function(v){ if(!!B.editing===v) return; gpTap(); B.editing=v; B.sheet=null; render(); };
  document.querySelectorAll('#sbModeView').forEach(function(b){ b.onclick=function(){ set(false); }; });
  document.querySelectorAll('#sbModeEdit').forEach(function(b){ b.onclick=function(){ set(true); }; });
}
/* The schools running this quarter: chips to tick while editing, one line while viewing. */
function sbSchoolsHtml_(campus, plan, Q, edit){
  var have=sbSchoolsOn_(campus); if(!have.length) return '';
  var runs=have.filter(function(m){ return sbRuns_(plan, m); });
  if(!edit) return '<p class="hint sbRunLine" id="sbRunLine">🎓 '+esc(gpT('Schools running in Q{q} {year}: {list}',{q:Q.q, year:Q.year, list: runs.length ? runs.map(function(m){ return t(m); }).join(' · ') : t('none')}))+'</p>';
  return '<div class="sbRun" id="sbRun"><b>🎓 '+esc(gpT('Which schools run in Q{q} {year}?',{q:Q.q, year:Q.year}))+'</b>'+
    '<div class="deptChips" style="margin:4px 0 0">'+have.map(function(m){ var on=runs.indexOf(m)>-1;
      return '<button type="button" class="deptChip'+(on?' on':'')+'" data-sbrun="'+esc(m)+'" aria-pressed="'+on+'">'+(on?'✓ ':'')+esc(t(m))+'</button>'; }).join('')+'</div>'+
    '<p class="hint" style="margin:4px 0 0">'+esc(t('A school that isn’t running has no box this quarter. Add its leaders and staff in its box once it runs.'))+'</p></div>';
}

/* ---- Campus Leadership → My Ministry → Structure ---- */
function sbLeadHtml_(){
  var B=sbState_(), campus=B.campus || S.me.campus, Q=sbQuarter_(), now={ year:new Date().getFullYear(), q:currentQuarter_() }, nx=nextQuarter_();
  if(!S.me.isAdmin) campus=S.me.campus;
  var h='<div class="sbTop"><div><h3 style="margin:0">🗺️ '+esc(t('The structure'))+'</h3><p class="sub" style="margin:2px 0 0">'+
    esc(t('Who is in which department and ministry this quarter, and who leads. Make the quarter live and it becomes everyone’s profile.'))+'</p></div></div>';
  h+='<div class="sbPick"><div class="deptChips" style="margin:0">'+[[now.year, now.q, t('now')],[nx.year, nx.q, t('next')]].map(function(x){
    var on=x[0]===Q.year && x[1]===Q.q; return '<button class="deptChip'+(on?' on':'')+'" data-sbq="'+x[0]+'|'+x[1]+'">Q'+x[1]+' '+x[0]+' · '+esc(x[2])+'</button>'; }).join('')+'</div>'+
    (S.me.isAdmin ? '<div class="deptChips" style="margin:0">'+CAMPUSES.map(function(c){ return '<button class="deptChip'+(c.id===campus?' on':'')+'" data-sbcampus="'+esc(c.id)+'">'+esc(t(c.short))+'</button>'; }).join('')+'</div>' : '')+'</div>';
  var key=sbKey_(campus, Q.year, Q.q);
  if(S.structError[key]) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load this quarter.'))+'</p><button class="btn ghost" id="sbRetry">'+esc(t('Try again'))+'</button></div>';
  if(!S.structCache[key]){ sbLoad_(campus, Q.year, Q.q); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'; }
  var plan=sbPlan_(campus, Q.year, Q.q), cache=S.structCache[key];
  var own=cache.plan && !cache.plan.inherited && cache.plan.leads;
  if(!own) h+='<p class="hint sbFrom">'+esc(plan.inherited && plan.from ? gpT('Starting from the Q{q} {year} structure — your first change makes Q{q2} {year2} its own.',{q:plan.from.quarter, year:plan.from.year, q2:Q.q, year2:Q.year}) : gpT('Starting from everyone’s profile — your first change makes Q{q} {year} its own.',{q:Q.q, year:Q.year}))+'</p>';
  var can=sbCanEdit_(campus), edit=can && !!B.editing;
  B.canEdit=can;
  if(can && !B.full) h+='<div class="sbModeRow">'+sbModeHtml_()+'<span class="sub sbModeSub">'+esc(edit ? t('Editing: drag faces, tap ＋ to add, tap a face for more.') : t('Viewing: move around and zoom — nobody can be moved by accident.'))+'</span></div>';
  if(can) h+=sbLiveHtml_(campus, Q);
  h+=sbSchoolsHtml_(campus, plan, Q, edit);
  h+=sbBoardHtml_(campus, Q.year, Q.q, edit);
  if(can && B.liveOpen) h+=sbLiveSheetHtml_(campus, Q);
  if(own && edit) h+='<button class="linkbtn" id="sbReset" style="margin-top:6px">'+esc(gpT('Start Q{q} {year} again from everyone’s profile',{q:Q.q, year:Q.year}))+'</button>';
  h+='<p class="hint" style="margin:8px 0 0">'+esc(t('Everyone sees this quarter’s structure under Team → Structure.'))+'</p>';
  return h;
}
function bindSbLead_(){
  var B=sbState_();
  document.querySelectorAll('[data-sbq]').forEach(function(b){ b.onclick=function(){ gpTap(); var v=b.getAttribute('data-sbq').split('|'); B.year=Number(v[0]); B.q=Number(v[1]); B.sheet=null; render(); }; });
  document.querySelectorAll('[data-sbcampus]').forEach(function(b){ b.onclick=function(){ gpTap(); B.campus=b.getAttribute('data-sbcampus'); B.sheet=null; render(); }; });
  bindSbMode_();
  document.querySelectorAll('[data-sbrun]').forEach(function(b){ b.onclick=function(){
    gpTap(); var m=b.getAttribute('data-sbrun'), c=B.cur; if(!c || !c.edit) return;
    var have=sbSchoolsOn_(c.campus);
    sbChange_(function(p){
      var on=(p.schools || have).filter(function(x){ return have.indexOf(x)>-1; });
      on = on.indexOf(m)>-1 ? on.filter(function(x){ return x!==m; }) : on.concat([m]);
      p.schools=have.filter(function(x){ return on.indexOf(x)>-1; });   // in the campus's own order
    });
  }; });
  var rt=document.getElementById('sbRetry'); if(rt) rt.onclick=function(){ var Q=sbQuarter_(), campus=B.campus||S.me.campus; delete S.structError[sbKey_(campus, Q.year, Q.q)]; render(); };
  var rs=document.getElementById('sbReset');
  if(rs) rs.onclick=function(){
    var c=B.cur; if(!c) return;
    if(!gpAsk_(t('Put everyone back where their profile says for this quarter? Names typed in stay off the chart.'))) return;
    var cache=S.structCache[c.key]; if(!cache) return;
    var keepSchools=(cache.plan && Array.isArray(cache.plan.schools)) ? cache.plan.schools : null;
    cache.plan={ students:{}, place:{}, leads:null, extra:(cache.plan && cache.plan.extra)||[], schools:keepSchools, also:null, live:null, inherited:false };
    B.saving++;
    run('saveStructurePlan',[S.auth.user,S.auth.pin,c.campus,c.year,c.q,{},{},null,cache.plan.extra,keepSchools,null],function(d){ B.saving=0; if(d && d.ok){ cache.plan=d.plan; if(d.diff) cache.diff=d.diff; if(d.doc){ cache.doc=d.doc; cache.source='saved'; } B.fitted={}; showMsg(t('Back to profiles')); } else showMsg(t('Could not save')); render(); },
      function(){ B.saving=0; showMsg(t('Connection problem — try again.')); render(); });
  };
  bindSbLive_();
  bindSb_();
}

/* ---- Make a quarter live: the arrangement becomes people's profiles (Nov 2026, Uriah) ----
   "Really easy every quarter for anyone in the campus leadership roles to move people around … and for that to
   automatically change in their profile." One line above the board says where the quarter stands, with one button:
   not live — "n people's profiles would change" → Make Qn yyyy live → a sheet listing each change → Confirm
   (applyStructure); live — "changes here update profiles straight away" (this quarter: saveStructurePlan applies what
   changed); a profile someone edited since — "n profiles differ" with See / Apply again. The list of changes is the
   server's (`diff` on getStructure and on every save), so the page never works a profile out by itself. */
function sbIsNow_(Q){ return Q.year===new Date().getFullYear() && Q.q===currentQuarter_(); }
function sbKeyShort_(key){
  var i=String(key||'').indexOf('|'), d=i>-1 ? key.slice(0,i) : '', m=i>-1 ? key.slice(i+1) : '';
  if(d===BL_DEPT) return m==='Campus Director' ? t('Campus Director') : gpT('Director of {dept}',{dept:t(m)});
  return m ? t(m) : d ? t(d) : '—';
}
function sbChangeText_(ch){
  var parts=[];
  if(ch.waits) parts.push(gpT('waits for an admin: {title}',{title:sbKeyShort_(ch.waits)}));
  if(ch.to) parts.push(sbKeyShort_(ch.from)+' → '+sbKeyShort_(ch.to));
  (ch.alsoAdd||[]).forEach(function(k){ parts.push('+ '+gpT('also {min}',{min:sbKeyShort_(k)})); });
  (ch.alsoDrop||[]).forEach(function(k){ parts.push(gpT('no longer also {min}',{min:sbKeyShort_(k)})); });
  (ch.leadAdd||[]).forEach(function(k){ parts.push('👑 '+gpT('now leads {min}',{min:sbKeyShort_(k)})); });
  (ch.leadDrop||[]).forEach(function(k){ parts.push(gpT('no longer leads {min}',{min:sbKeyShort_(k)})); });
  return parts.join(' · ');
}
function sbLiveHtml_(campus, Q){
  var c=S.structCache[sbKey_(campus, Q.year, Q.q)], diff=c && c.diff; if(!diff) return '';
  var plan=c.plan||{}, n=(diff.changes||[]).length, w=(diff.waiting||[]).length, now=sbIsNow_(Q), B=sbState_();
  var waitTxt=w ? ' · '+(w===1 ? t('1 move into Campus Leadership is waiting for an admin') : gpT('{n} moves into Campus Leadership are waiting for an admin',{n:w})) : '';
  var h='<div class="sbLive'+(plan.live?(n?' drift':' on'):'')+'" id="sbLive" data-sblive="'+(plan.live?(n?'drift':'live'):'off')+'">';
  if(plan.live && !n){
    h+='<p class="sbLiveLine" id="sbLiveLine">✅ '+esc(now ? gpT('Q{q} {year} is live — changes here update profiles straight away.',{q:Q.q, year:Q.year}) : gpT('Q{q} {year} is live — profiles match it. A change before it starts waits for Apply again.',{q:Q.q, year:Q.year}))+esc(waitTxt)+'</p>';
  } else if(plan.live){
    h+='<p class="sbLiveLine" id="sbLiveLine">⚠️ '+esc(n===1 ? t('1 profile differs from this structure') : gpT('{n} profiles differ from this structure',{n:n}))+esc(waitTxt)+'</p>'+
      '<div class="sbLiveBtns"><button type="button" class="btn ghost small" id="sbLiveSee">'+esc(t('See'))+'</button><button type="button" class="btn small" id="sbLiveAgain">'+esc(t('Apply again'))+'</button></div>';
  } else {
    h+='<p class="sbLiveLine" id="sbLiveLine">'+esc(n ? (n===1 ? t('1 person’s profile would change') : gpT('{n} people’s profiles would change',{n:n})) : t('Everyone’s profile already matches this structure.'))+esc(waitTxt)+'</p>'+
      '<div class="sbLiveBtns"><button type="button" class="btn small" id="sbLiveBtn"'+(B.liveBusy?' disabled':'')+'>'+esc(gpT('Make Q{q} {year} live',{q:Q.q, year:Q.year}))+'</button></div>';
  }
  return h+'</div>';
}
function sbLiveSheetHtml_(campus, Q){
  var c=S.structCache[sbKey_(campus, Q.year, Q.q)], diff=(c && c.diff) || { changes:[], waiting:[] }, plan=(c && c.plan) || {}, B=sbState_();
  var n=diff.changes.length, now=sbIsNow_(Q);
  var h='<div class="sbScrim" id="sbLiveScrim"></div><div class="sbSheet gtSheet sbLiveSheet" id="sbLiveSheet" role="dialog" aria-modal="true">'+
    '<div class="sbSheetHead"><b>'+esc(plan.live ? gpT('Profiles that differ from Q{q} {year}',{q:Q.q, year:Q.year}) : gpT('Make Q{q} {year} live',{q:Q.q, year:Q.year}))+'</b>'+
    '<button type="button" class="hbtn sbClose" id="sbLiveClose" aria-label="'+esc(t('Close'))+'">✕</button></div>';
  h+='<p class="sub" style="margin:0 0 8px">'+esc(n ? t('These profiles change to match the structure. Each person is told. Nothing else on a profile changes.') : t('Nobody’s profile changes now.'))+'</p>';
  if(!now && !plan.live) h+='<p class="hint sbLiveEarly" id="sbLiveEarly">'+esc(gpT('Q{q} {year} hasn’t started yet — profiles change today, not on its first day.',{q:Q.q, year:Q.year}))+'</p>';
  if(n) h+='<ul class="sbLiveList" id="sbLiveList">'+diff.changes.map(function(ch){ return '<li data-sbchange="'+esc(ch.id)+'"><b>'+esc(ch.name)+'</b><span>'+esc(sbChangeText_(ch))+'</span></li>'; }).join('')+'</ul>';
  if((diff.waiting||[]).length) h+='<p class="hint" id="sbLiveWaiting">'+esc(t('Already waiting for an admin (Admin → Approvals):'))+' '+diff.waiting.map(function(x){ return esc(x.name)+' — '+esc(sbKeyShort_(x.waits)); }).join(' · ')+'</p>';
  h+='<p class="hint">'+esc(t('Left as they are: anyone off the chart, staff who are students this quarter, and names typed in.'))+'</p>';
  h+='<button type="button" class="btn" id="sbLiveConfirm"'+(B.liveBusy?' disabled':'')+'>'+esc(B.liveBusy ? t('Saving…') : plan.live ? t('Apply again') : now ? t('Confirm — from now on, changes here update profiles') : t('Confirm'))+'</button>'+
    '<button type="button" class="btn ghost" id="sbLiveCancel">'+esc(t('Cancel'))+'</button>';
  return h+'</div>';
}
/* the line follows a save's answer without a redraw (someone may be mid-drag) */
function sbLiveRefresh_(){
  var el=document.getElementById('sbLive'), B=sbState_(), c=B.cur; if(!el || !c) return;
  var tmp=document.createElement('div'); tmp.innerHTML=sbLiveHtml_(c.campus, { year:c.year, q:c.q });
  if(tmp.firstChild){ el.parentNode.replaceChild(tmp.firstChild, el); bindSbLive_(); }
}
function sbApplyLive_(){
  var B=sbState_(), c=B.cur; if(!c || B.liveBusy) return;
  if(B.saving){ showMsg(t('Still saving — try again in a moment.')); return; }
  var cache=S.structCache[c.key]; if(!cache) return;
  B.liveBusy=true; render();
  run('applyStructure',[S.auth.user,S.auth.pin,c.campus,c.year,c.q,{}],function(d){
    B.liveBusy=false;
    if(d && d.ok){
      cache.plan=d.plan; cache.diff=d.diff || { changes:[], waiting:[] }; if(d.doc){ cache.doc=d.doc; cache.source='saved'; }
      sbPatchRoster_(d.changes); B.liveOpen=false;
      if(sbIsNow_({ year:c.year, q:c.q }) && c.campus===S.me.campus) S.structReady=null;
      var n=(d.changes||[]).filter(function(x){ return !x.waits; }).length;
      showMsg(gpT('Q{q} {year} is live',{q:c.q, year:c.year})+(n ? ' — '+(n===1 ? t('1 profile updated') : gpT('{n} profiles updated',{n:n})) : ''));
    } else showMsg(d && d.err==='not_authorized' ? t('Only Campus Leadership and admins can change the structure.') : d && d.err==='past_quarter' ? t('That quarter is over.') : d && d.err==='busy' ? t('Someone else is saving — try again.') : t('Could not save'));
    render();
  }, function(){ B.liveBusy=false; showMsg(t('Connection problem — try again.')); render(); });
}
function bindSbLive_(){
  var B=sbState_(), on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  var open=function(){ gpTap(); if(B.saving){ showMsg(t('Still saving — try again in a moment.')); return; } B.liveOpen=true; B.sheet=null; render(); };
  var shut=function(){ B.liveOpen=false; render(); };
  on('sbLiveBtn', open); on('sbLiveSee', open);
  on('sbLiveAgain', function(){ if(!gpAsk_(t('Change these profiles back to match the structure? Each person is told.'))) return; sbApplyLive_(); });
  on('sbLiveScrim', shut); on('sbLiveClose', shut); on('sbLiveCancel', shut);
  on('sbLiveConfirm', function(){ gpTap(); sbApplyLive_(); });
}
/* Campus Leadership's bell, from this quarter's first day until it is live (the boot's `structReady`) */
function sbNotifItems_(){
  var r=S.structReady; if(!r || !S.me || S.student || S.guest || S.board || !sbCanEdit_(S.me.campus)) return [];
  return [{ when:todayStr(), text:'🗺️ '+gpT('Q{q}’s structure is ready — make it live',{q:r.q}),
    actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gostruct="'+r.year+'|'+r.q+'">'+esc(t('Open'))+'</button>' }];
}
function sbOpenTab_(campus, year, q, editing){
  var B=sbState_(); B.year=year; B.q=q; B.campus=campus||S.me.campus; B.sheet=null; B.liveOpen=false; B.editing=!!editing;
  S.view='ministry'; S.mentee=null; S.person=null; S.mmTab='ministry'; S.mmBrowseDept=BL_DEPT; S.mmBrowseMinistry=S.me.dept===BL_DEPT ? blMyKey_() : ''; S.lwTab='struct'; try{ lwTabKeep_('struct'); }catch(er){}
  render(); window.scrollTo(0,0);
}
function bindGoStruct_(sel){
  document.querySelectorAll(sel).forEach(function(b){ b.onclick=function(){
    gpTap(); var v=String(b.getAttribute('data-gostruct')||'').split('|'); S.bellOpen=false; if(typeof renderNotifPanel==='function') renderNotifPanel();
    sbOpenTab_(S.me.campus, Number(v[0])||new Date().getFullYear(), Number(v[1])||currentQuarter_(), false);
  }; });
}
/* Team → Structure: the same quarter as a tree, read only (opened from the list) */
function sbTeamHtml_(campus, year, q){
  sbState_().canEdit=false;
  return '<div class="sbTeamBar"><button class="linkbtn" id="sbTeamBack" style="text-decoration:none">← '+esc(t('The list'))+'</button></div>'+sbBoardHtml_(campus, year, q, false);
}
function bindSbTeam_(){
  var b=document.getElementById('sbTeamBack'); if(b) b.onclick=function(){ S.sbTeam=false; sbState_().full=false; render(); };
  var o=document.getElementById('sbTeamOpen'); if(o) o.onclick=function(){ gpTap(); S.sbTeam=true; render(); window.scrollTo(0,0); };
  var e=document.getElementById('sbTeamEdit'); if(e) e.onclick=function(){
    gpTap(); var B=sbState_(); B.year=structYear_(); B.q=structQ_(); B.campus=S.teamCampus||S.me.campus; B.sheet=null; B.editing=true;
    S.view='ministry'; S.mmBrowseDept=BL_DEPT; S.mmBrowseMinistry=S.me.dept===BL_DEPT ? (S.me.ministry||'') : ''; S.lwTab='struct'; try{ lwTabKeep_('struct'); }catch(er){}
    render(); window.scrollTo(0,0);
  };
  if(document.getElementById('sbView')) bindSb_();
}
