/* My YWAM GP — teams.html, part 8 of 9: the org chart, the team directory, mentor, profile.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ---------- team structure (the org chart) ----------
   The campus as levels, the way the Canva chart reads: Campus Leadership
   at the top (the directors, then the department overseers), a connector,
   then one box per department with its overseer and its ministries — each
   ministry naming its leader (crown) and its people. Departments and
   ministries only: the boxes are the taxonomy's, the people come from
   their profiles (department, ministry, ministry leads), so moving someone
   is editing their profile in Admin — one source of truth, nothing to
   hand-draw and nothing to fall out of date. Tap anyone to open them. */
function orgPersonChip_(p, lead){
  var title=orgTitleOf_(p);
  return '<button class="orgPerson'+(lead?' lead':'')+'" '+(S.orgArranging ? 'data-arrange' : 'data-person')+'="'+esc(p.id)+'">'+avatarHtml(p,'sm')+
    '<span>'+(lead?'👑 ':'')+esc(p.name)+(title ? '<small class="orgChipTitle">'+esc(orgTitleText_(title))+'</small>' : '')+'</span></button>';
}
function orgPeople_(list, leads){
  return '<div class="orgPeople">'+list.map(function(p){ return orgPersonChip_(p, leads.indexOf(p)>-1); }).join('')+'</div>';
}
/* Which quarter is on screen, and what the chart is drawn from: the live
   roster for the current quarter, a saved snapshot for any other (or the
   latest earlier one, marked copied; or nothing). An admin saves the
   current quarter's snapshot from here. */
function structKey_(campus, year, q){ return campus+'|'+year+'|'+q; }
function currentQuarter_(){ return Math.floor(new Date().getMonth()/3)+1; }
function structYear_(){ return S.structYear || new Date().getFullYear(); }
function structQ_(){ return S.structQ || currentQuarter_(); }
function structIsCurrent_(){ return structYear_()===new Date().getFullYear() && structQ_()===currentQuarter_(); }
/* The quarter after this one can be set up early: it shows the live chart
   like the current quarter, and an admin may save it before it starts (then
   save again later if people move). Q4's next is Q1 of next year. */
function nextQuarter_(){ var q=currentQuarter_(), y=new Date().getFullYear(); return q===4 ? { year:y+1, q:1 } : { year:y, q:q+1 }; }
function structIsNext_(){ var n=nextQuarter_(); return structYear_()===n.year && structQ_()===n.q; }
function structIsLive_(){ return structIsCurrent_() || structIsNext_(); }
function orgQuarterBarHtml_(campus){
  var yNow=new Date().getFullYear(), year=structYear_(), q=structQ_();
  var h='<div class="orgQuarterBar"><label class="pick" style="max-width:130px"><span>'+esc(t('Year'))+'</span><select id="structYearSel">'+
    [yNow-2,yNow-1,yNow].concat(nextQuarter_().year>yNow ? [yNow+1] : []).map(function(y){ return '<option value="'+y+'"'+(y===year?' selected':'')+'>'+y+'</option>'; }).join('')+'</select></label>';
  h+='<div class="deptChips" style="margin:0">'+[1,2,3,4].map(function(n){
    return '<button class="deptChip'+(n===q?' on':'')+'" data-structq="'+n+'">Q'+n+'</button>'; }).join('')+'</div></div>';
  return h;
}
function orgStructureHtml_(campus){
  var year=structYear_(), q=structQ_(), key=structKey_(campus,year,q), c=S.structCache[key];
  var h=orgQuarterBarHtml_(campus);
  h+='<h3 style="margin:8px 0 2px">'+esc(gpT('{campus} · Q{q} {year}',{campus:campusShort(campus), q:q, year:year}))+'</h3>';
  if(structIsLive_()){
    var isSaved = c && c.doc && c.source==='saved', early = structIsNext_();
    var savedNote = isSaved ? gpT('Q{q} {year} structure saved on {date}',{q:q, year:year, date:teamDate_((c.doc.savedAt||'').slice(0,10))}) : gpT('Q{q} {year} structure not saved yet',{q:q, year:year});
    h+='<p class="sub" style="margin:0 0 8px">'+esc(early ? t('Next quarter — it starts from this quarter’s chart. Arrange it, then save it early.') : t('Live from everyone’s profile and this quarter’s arrangement.'))+' '+esc(savedNote)+'.</p>';
    if(S.me.isAdmin) h+='<button class="btn ghost" id="structSaveBtn" style="margin:0 0 10px;width:auto;padding:9px 14px">💾 '+esc(isSaved ? gpT('Update Q{q} {year} structure',{q:q, year:year}) : early ? gpT('Save Q{q} {year} structure early',{q:q, year:year}) : gpT('Save Q{q} {year} structure',{q:q, year:year}))+'</button>';
    var stu=(c && c.plan && c.plan.students) || {}, stuN=Object.keys(stu).length;
    if(S.me.isAdmin){
      h+='<button class="btn ghost" id="structStudentsBtn" style="margin:0 0 10px 8px;width:auto;padding:9px 14px">🎓 '+esc(gpT('Students in Q{q} {year}',{q:q, year:year}))+(stuN?' · '+stuN:'')+'</button>';
      if(S.structStudentsEdit===key) h+=structStudentsEditorHtml_(campus, q, year);
    }
    var place=(c && c.plan && c.plan.place) || {}, arranging=S.me.isAdmin && S.structArrange===key;
    S.structCtx={ campus:campus, year:year, q:q, key:key };
    if(S.me.isAdmin && !arranging) h+='<button class="btn ghost" id="structArrangeBtn" style="margin:0 0 10px 8px;width:auto;padding:9px 14px">✏️ '+esc(gpT('Arrange Q{q} {year}',{q:q, year:year}))+'</button>';
    if(c && c.plan && c.plan.inherited && c.plan.from) h+='<p class="hint" style="margin:0 0 8px">'+esc(gpT('Starting from the Q{q} {year} arrangement.',{q:c.plan.from.quarter, year:c.plan.from.year}))+'</p>';
    if(arranging){
      h+='<div class="arrangeBar" id="arrangeBar"><div><b>✏️ '+esc(gpT('Arranging Q{q} {year}',{q:q, year:year}))+'</b><p class="hint" style="margin:2px 0 0">'+
        esc(t('Drag someone onto a ministry, the Campus Director box or a department’s Overseer spot — or tap them to choose. Each move saves for this quarter only; profiles stay as they are.'))+'</p></div>'+
        '<div class="arrangeBtns">'+(Object.keys(place).length ? '<button class="btn ghost small" id="structArrangeReset">'+esc(t('Back to profiles'))+'</button>' : '')+
        '<button class="btn small" id="structArrangeDone">'+esc(t('Done'))+'</button></div></div>';
      if(S.structMove) h+=structMoveHtml_(campus, S.structMove, place, stu);
    }
    return h+orgChartHtml_(campus, S.roster, stu, place, arranging);
  }
  if(S.structError[key]) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load this quarter.'))+'</p><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.structError[key])+'</p><button class="btn ghost" id="structRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  if(!c) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  if(!c.doc) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Nothing saved for this quarter, and nothing earlier to show.'))+'</p></div>';
  var note = c.source==='saved' ? gpT('Q{q} {year} structure saved on {date}',{q:q, year:year, date:teamDate_((c.doc.savedAt||'').slice(0,10))})
    : gpT('Nothing saved for Q{q} {year} — showing the Q{q2} {year2} structure.',{q:q, year:year, q2:c.doc.quarter, year2:c.doc.year});
  h+='<p class="sub" style="margin:0 0 8px">💾 '+esc(note)+'</p>';
  return h+orgChartHtml_(campus, (c.doc.people||[]).map(function(p){ return Object.assign({ campus:campus }, p); }));
}
/* Tap someone in Arrange mode: pick where they sit this quarter. */
function structMoveHtml_(campus, id, place, stu){
  var p=null; S.roster.forEach(function(x){ if(x.id===id) p=x; }); if(!p) return '';
  var cur=place[id] || { dept:p.dept, ministry:p.ministry||'' }, curKey=cur.dept+'|'+cur.ministry;
  var deps=getDepartments(campus), opts=[['Campus Leadership|Campus Director', t('Campus Director')]];
  Object.keys(deps).forEach(function(d){ if(d===BL_DEPT) return; opts.push(['Campus Leadership|'+d, gpT('{dept} · overseer',{dept:t(d)})]); });
  var h='<div class="card" id="structMoveCard"><h3 style="margin-top:0">'+esc(gpT('Move {name}',{name:p.name}))+'</h3><select id="structMoveSel">'+
    opts.map(function(o){ return '<option value="'+esc(o[0])+'"'+(o[0]===curKey?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('');
  Object.keys(deps).forEach(function(d){ if(d===BL_DEPT) return;
    h+='<optgroup label="'+esc(t(d))+'">'+Object.keys(deps[d]).map(function(m){ var k=d+'|'+m; return '<option value="'+esc(k)+'"'+(k===curKey?' selected':'')+'>'+esc(t(m))+'</option>'; }).join('')+'</optgroup>'; });
  h+='</select>'+(stu[id] ? '<p class="hint">'+esc(gpT('Moving them takes them out of the {school} students.',{school:String(stu[id]).toUpperCase()}))+'</p>' : '')+
    '<p class="hint">'+esc(gpT('Their profile says {where}.',{where:t(p.ministry||p.dept||'')+(p.ministry?' · '+t(p.dept):'')}))+'</p>'+
    '<button class="btn" id="structMoveGo">'+esc(t('Move'))+'</button><button class="btn ghost" id="structMoveCancel">'+esc(t('Cancel'))+'</button></div>';
  return h;
}
function structMoveTo_(id, target){
  var ctx=S.structCtx; if(!ctx || !target) return;
  var c=S.structCache[ctx.key] || { doc:null, source:'none' };
  var plan=c.plan || { students:{}, place:{} };
  var place=Object.assign({}, plan.place||{}), students=Object.assign({}, plan.students||{});
  var i=target.indexOf('|'), dept=target.slice(0,i), ministry=target.slice(i+1);
  var p=null; S.roster.forEach(function(x){ if(x.id===id) p=x; }); if(!p) return;
  var profDept = p.dept==='Base Director' ? 'Campus Leadership' : p.dept;
  if(dept===profDept && ministry===(p.ministry||'')) delete place[id]; else place[id]={ dept:dept, ministry:ministry };
  var wasStudent=!!students[id]; delete students[id];
  var prev=c.plan; c.plan={ students:students, place:place, inherited:false }; S.structCache[ctx.key]=c; S.structMove=null; render();
  run('saveStructurePlan',[S.auth.user,S.auth.pin,ctx.campus,ctx.year,ctx.q, wasStudent ? students : undefined, place],function(d){
    if(d && d.ok){ c.plan=d.plan; if(d.doc){ c.doc=d.doc; c.source='saved'; } showMsg(gpT('Moved — {name}',{name:p.name})); }
    else { c.plan=prev; showMsg(t('Could not save the move')); }
    render();
  }, function(){ c.plan=prev; showMsg(t('Connection problem — try again.')); render(); });
}
function bindStructArrange_(){
  var ab=document.getElementById('structArrangeBtn');
  if(ab) ab.onclick=function(){ gpTap(); S.structArrange=S.structCtx && S.structCtx.key; S.structMove=null; S.structStudentsEdit=null; render(); };
  var ad=document.getElementById('structArrangeDone');
  if(ad) ad.onclick=function(){ S.structArrange=null; S.structMove=null; render(); };
  var ar=document.getElementById('structArrangeReset');
  if(ar) ar.onclick=function(){
    if(!confirm(t('Put everyone back where their profile says, for this quarter?'))) return;
    var ctx=S.structCtx, c=S.structCache[ctx.key]||{ doc:null, source:'none' };
    run('saveStructurePlan',[S.auth.user,S.auth.pin,ctx.campus,ctx.year,ctx.q, undefined, {}],function(d){ if(d && d.ok){ c.plan=d.plan; if(d.doc){ c.doc=d.doc; c.source='saved'; } S.structCache[ctx.key]=c; showMsg(t('Back to profiles')); } else showMsg(t('Could not save')); render(); });
  };
  var mg=document.getElementById('structMoveGo');
  if(mg) mg.onclick=function(){ var sel=document.getElementById('structMoveSel'); if(sel) structMoveTo_(S.structMove, sel.value); };
  var mc=document.getElementById('structMoveCancel');
  if(mc) mc.onclick=function(){ S.structMove=null; render(); };
  document.body.classList.toggle('arranging', !!document.getElementById('arrangeBar'));
  /* Drag with a mouse or a finger (pointer events; chips don't scroll the page
     while arranging, the gaps between them still do). A tap opens the picker. */
  document.querySelectorAll('[data-arrange]').forEach(function(chip){
    chip.onclick=function(e){ e.preventDefault(); };
    chip.onpointerdown=function(e){
      if(e.button>0) return;
      var id=chip.getAttribute('data-arrange'), sx=e.clientX, sy=e.clientY, ghost=null, over=null;
      try{ chip.setPointerCapture(e.pointerId); }catch(err){}
      var move=function(ev){
        if(!ghost && Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy)>6){ ghost=chip.cloneNode(true); ghost.className='orgPerson orgGhost'; ghost.removeAttribute('data-arrange'); document.body.appendChild(ghost); chip.classList.add('dragging'); }
        if(!ghost) return;
        ev.preventDefault();
        ghost.style.left=(ev.clientX+8)+'px'; ghost.style.top=(ev.clientY-14)+'px';
        var el=document.elementFromPoint(ev.clientX, ev.clientY), tg=el && el.closest ? el.closest('[data-drop]') : null;
        if(over!==tg){ if(over) over.classList.remove('dropOver'); over=tg; if(over) over.classList.add('dropOver'); }
        if(ev.clientY<70) window.scrollBy(0,-14); else if(ev.clientY>window.innerHeight-70) window.scrollBy(0,14);
      };
      var end=function(ev){
        chip.removeEventListener('pointermove', move); chip.removeEventListener('pointerup', end); chip.removeEventListener('pointercancel', end);
        if(ghost){ ghost.remove(); chip.classList.remove('dragging'); if(over){ over.classList.remove('dropOver'); if(ev.type==='pointerup') structMoveTo_(id, over.getAttribute('data-drop')); } return; }
        if(ev.type==='pointerup'){ S.structMove=id; render(); var mc2=document.getElementById('structMoveCard'); if(mc2) mc2.scrollIntoView({ behavior:'smooth', block:'center' }); }
      };
      chip.addEventListener('pointermove', move); chip.addEventListener('pointerup', end); chip.addEventListener('pointercancel', end);
    };
  });
}
function structStudentsEditorHtml_(campus, q, year){
  var draft=S.structStudentsDraft||{};
  var people=S.roster.filter(function(p){ return p.campus===campus && p.kind!=='applicant'; }).slice().sort(function(a,b){ return a.name<b.name?-1:a.name>b.name?1:0; });
  return '<div class="card" id="structStudentsCard"><h3 style="margin-top:0">🎓 '+esc(gpT('Who is a student in Q{q} {year}?',{q:q, year:year}))+'</h3>'+
    '<p class="sub">'+esc(t('Pick the school for anyone doing one this quarter. It is for this quarter only — their profile stays as it is.'))+'</p>'+
    people.map(function(p){
      return '<div class="stuRow"><span class="stuName">'+esc(p.name)+'<span class="pmeta">'+esc(t(p.ministry||p.dept||''))+'</span></span>'+
        '<select data-stu="'+esc(p.id)+'"><option value="">'+esc(t('Not a student'))+'</option>'+['dts','dbs','bcs','sms'].map(function(sc){ return '<option value="'+sc+'"'+(draft[p.id]===sc?' selected':'')+'>'+sc.toUpperCase()+'</option>'; }).join('')+'</select></div>';
    }).join('')+
    '<button class="btn" id="structStudentsSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="structStudentsCancel">'+esc(t('Cancel'))+'</button></div>';
}
function orgChartHtml_(campus, roster, studentsMap, placeMap, arranging){
  /* The chart is the base's structure for the quarter, which can differ from
     what a profile says: placeMap (the quarter's arrangement) wins. */
  var everyone=(roster||S.roster).filter(function(p){ return p.campus===campus && p.kind!=='applicant'; }).map(function(p){
    var pl=placeMap && placeMap[p.id]; return pl ? Object.assign({}, p, { dept:pl.dept, ministry:pl.ministry }) : p; });
  S.orgArranging = !!arranging;
  /* Staff doing a school this quarter (the quarter's plan, or a snapshot's
     own "student" mark) sit in a Students box, not their ministry. */
  var studentOf=function(p){ return (studentsMap && studentsMap[p.id]) || p.student || ''; };
  var students=everyone.filter(function(p){ return !!studentOf(p); });
  var here=everyone.filter(function(p){ return !studentOf(p); });
  var deps=getDepartments(campus);
  var depts=Object.keys(deps).filter(function(d){ return d!==BL_DEPT; });
  var directors=here.filter(function(p){ return p.dept===BL_DEPT && p.ministry==='Campus Director'; });
  var overseers=here.filter(function(p){ return p.dept===BL_DEPT && p.ministry!=='Campus Director'; });
  var placed={};
  var h='<div class="orgChart">';

  // level 1 — campus leadership
  h+='<div class="orgLevelLabel">'+esc(t('Campus Leadership'))+'</div>';
  h+='<div class="orgBox top" data-orgbox="leadership"'+(arranging?' data-drop="Campus Leadership|Campus Director"':'')+'><div class="orgBoxTitle">🧭 '+esc(t('Campus Directors'))+'</div>';
  if(directors.length) h+=orgPeople_(directors, directors); else h+='<div class="orgEmpty">'+esc(t('Nobody here yet'))+'</div>';
  directors.forEach(function(p){ placed[p.id]=1; });
  if(overseers.length){
    h+='<div class="orgSub">'+esc(t('Department directors'))+'</div>'+orgPeople_(overseers, []);
    overseers.forEach(function(p){ placed[p.id]=1; });
  }
  h+='</div>';
  h+='<div class="orgConnector"></div>';

  // level 2 — departments, each with its ministries
  h+='<div class="orgLevelLabel">'+esc(t('Departments'))+' · '+depts.length+'</div><div class="orgGrid">';
  depts.forEach(function(dept){
    var ov=here.filter(function(p){ return p.dept===BL_DEPT && p.ministry===dept; });
    var staffN=here.filter(function(p){ return p.dept===dept; }).length;
    var mins=Object.keys(deps[dept]||{});
    h+='<div class="orgBox dept" data-orgbox="'+esc(dept)+'"><div class="orgBoxTitle">'+(MIN_EMOJI[dept]?MIN_EMOJI[dept]+' ':'')+esc(t(dept))+
      '<span class="orgBoxMeta">'+esc(gpT('{n} staff',{n:staffN}))+'</span></div>';
    if(ov.length) h+='<div class="orgSub">'+esc(t('Director'))+'</div>'+orgPeople_(ov, ov);
    if(arranging) h+='<div class="orgDropOverseer" data-drop="Campus Leadership|'+esc(dept)+'">＋ '+esc(t('Director'))+'</div>';
    h+='<div class="orgMins">';
    mins.forEach(function(min){
      var key=dept+'|'+min;
      var leads=here.filter(function(p){ return (p.leads||[]).indexOf(key)>-1; });
      var members=here.filter(function(p){ return p.dept===dept && p.ministry===min && leads.indexOf(p)===-1; });
      var all=leads.concat(members);
      all.forEach(function(p){ placed[p.id]=1; });
      h+='<div class="orgMin'+(all.length?'':' bare')+'" data-orgmin="'+esc(key)+'"'+(arranging?' data-drop="'+esc(key)+'"':'')+'><div class="orgMinHead"><span>'+(MIN_EMOJI[min]?MIN_EMOJI[min]+' ':'')+esc(t(min))+'</span>'+
        '<span class="orgMinN">'+(all.length||'—')+'</span></div>'+
        (all.length ? orgPeople_(all, leads) : '')+'</div>';
    });
    h+='</div></div>';
  });
  h+='</div>';

  if(students.length){
    h+='<div class="orgLevelLabel">🎓 '+esc(t('Students this quarter'))+' · '+students.length+'</div><div class="orgBox students" data-orgbox="students">';
    ['dts','dbs','bcs','sms'].forEach(function(sc){
      var g=students.filter(function(p){ return studentOf(p)===sc; });
      if(g.length) h+='<div class="orgSub" data-orgschool="'+sc+'">'+esc(sc.toUpperCase())+' · '+g.length+'</div>'+orgPeople_(g, []);
    });
    h+='<p class="hint" style="margin:6px 0 0">'+esc(t('Staff doing a school this quarter. Their profiles are unchanged.'))+'</p></div>';
  }
  // anyone on this campus whose profile points nowhere on the chart
  var unplaced=here.filter(function(p){ return !placed[p.id]; });
  if(unplaced.length){
    h+='<div class="orgLevelLabel">'+esc(t('Not placed yet'))+' · '+unplaced.length+'</div>'+
      '<div class="orgBox loose"><p class="hint" style="margin:0 0 6px">'+esc(t('Their profile names a department or ministry that isn’t on this campus’s chart.'))+'</p>'+orgPeople_(unplaced, [])+'</div>';
  }
  h+='<p class="hint" style="margin:12px 0 0;text-align:center">'+esc(t('This chart is the base’s structure for the quarter. It can differ from what people have on their profile.'))+'</p>';
  S.orgArranging=false;
  return h+'</div>';
}

/* ---------- team directory ---------- */
function teamHtml(){
  if(S.person) return personHtml();

  /* One campus at a time, via the toggle, matching the mockup — the directory
     used to stack both campuses stacked at once, which read as one long list
     rather than "which base am I looking at right now". Defaults to your own
     campus, since that's whose team you open this tab to see. */
  var mode = S.teamMode==='org' ? 'org' : (S.teamMode==='str' && gsOK() ? 'str' : (S.teamMode==='pers' && pOK() ? 'pers' : 'dir'));
  /* Besides the two campuses, every view has YWAM GP's leadership team and the
     Advisory Board (teamOrgScope_) — in Structure, YWAM GP is the whole chart. */
  var campus = S.teamCampus || (S.me && S.me.campus) || CAMPUSES[0].id;
  var cInfo = CAMPUSES.filter(function(c){ return c.id===campus; })[0];
  var here = S.roster.filter(function(p){ return p.campus===campus; });

  var h='<h2>'+esc(t('Team'))+' <small>· '+S.roster.length+' '+esc(t('staff'))+'</small></h2>'+
    mentorEntryHtml();
  h+='<div class="campusSeg teamModeSeg">'+
    '<button class="campusBtn'+(mode==='dir'?' on':'')+'" data-teammode="dir">👥 '+esc(t('Directory'))+'</button>'+
    '<button class="campusBtn'+(mode==='org'?' on':'')+'" data-teammode="org">🧭 '+esc(t('Structure'))+'</button>'+
    (gsOK()?'<button class="campusBtn'+(mode==='str'?' on':'')+'" data-teammode="str">💪 '+esc(t('Strengths'))+'</button>':'')+
    (pOK()?'<button class="campusBtn'+(mode==='pers'?' on':'')+'" data-teammode="pers">🧩 '+esc(t('Personalities'))+'</button>':'')+'</div>';
  h+='<p class="sub">'+esc(mode==='org' ? t('Departments and ministries, and who is in each this quarter.') :
    mode==='str' ? t('Who on the base has which strengths, from the Top 5s people have shared.') :
    mode==='pers' ? t('The team’s mix of personality types, from the types people have shared.') :
    t('Tap anyone to see their ministry and this week’s goals.'))+'</p>';

  h+='<div class="campusSeg teamScopeSeg">'+
    '<button class="campusBtn'+(campus==='ywamgp'?' on':'')+'" data-teamcampus="ywamgp">🌏 '+esc(t('YWAM GP'))+'</button>'+
    '<button class="campusBtn'+(campus==='board'?' on':'')+'" data-teamcampus="board">🛡️ '+esc(t('Advisory Board'))+'</button>'+
    CAMPUSES.map(function(c){
      return '<button class="campusBtn'+(campus===c.id?' on':'')+'" data-teamcampus="'+esc(c.id)+'">'+esc(t(c.name))+'</button>';
    }).join('')+'</div>';

  if(teamOrgScope_(campus) && !S.org){ orgLoad_(); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'; }
  if(campus==='board' && (mode==='org' || mode==='dir')) return h+orgBoardHtml_();
  if(mode==='org' && campus==='ywamgp') return h+ywamGpChartHtml_();
  if(mode==='dir' && campus==='ywamgp') return h+teamGpDirectoryHtml_();
  if(mode==='org') return h+orgStructureHtml_(campus);
  if(mode==='str') return h+teamStrengthsHtml_(campus);
  if(mode==='pers') return h+teamPersonalityHtml_(campus);

  h+='<h3>'+esc(t(cInfo?cInfo.name:campus))+' <small>· '+here.length+'</small></h3>';

  if(here.length){
    // group by department, then ministry inside it
    var byDept={};
    here.forEach(function(p){ (byDept[p.dept||'—']=byDept[p.dept||'—']||[]).push(p); });
    Object.keys(byDept).sort().forEach(function(dept){
      var people=byDept[dept];
      h+='<div class="deptBlock"><div class="deptHead">'+(MIN_EMOJI[dept]||'')+' '+esc(t(dept))+
         '<span class="deptN">'+people.length+'</span></div>';
      var byMin={};
      people.forEach(function(p){ (byMin[p.ministry||'']=byMin[p.ministry||'']||[]).push(p); });
      // named ministries first, "not set yet" last
      Object.keys(byMin).sort(function(a,b){ return a===''?1:(b===''?-1:(a<b?-1:1)); }).forEach(function(min){
        h+='<div class="minLabel">'+(min? (MIN_EMOJI[min]||'')+' '+esc(t(min)) : esc(t('Ministry not set yet')))+'</div>'+
           '<div class="dir">';
        byMin[min].forEach(function(p){
          h+='<div class="dircard" data-person="'+esc(p.id)+'">'+avatarHtml(p)+
             '<div class="pname">'+esc(p.name)+'</div>'+
             (p.role?'<div class="pmeta">'+esc(t(p.role))+'</div>':'')+ptChipHtml(p)+'</div>';
        });
        h+='</div>';
      });
      h+='</div>';
    });
  } else {
    h+='<p class="sub">'+esc(t('No profiles yet.'))+'</p>';
  }
  return h;
}

/* --- one teammate, public view ---
   Deliberately thin: who they are, what they're working on this week, and how
   consistently they show up. Nothing the app treats as private appears here —
   the server sends an allowlist, so this page can't render what it never gets. */
function personHtml(){
  var d=S.person, p=d.staff;
  var h='<button class="linkbtn" id="personBack" style="text-align:left;text-decoration:none">← '+esc(t('Team'))+'</button>';
  h+='<div class="card"><div class="pcard">'+avatarHtml(p,'lg')+
    '<div><div class="pname">'+esc(p.name)+'</div>'+
    (orgTitleOf_(p) ? '<div class="pmeta orgPersonTitle">🧭 '+esc(orgTitleText_(orgTitleOf_(p)))+'</div>' : '')+
    (function(){ var g=((S.org&&S.org.gp)||[]).filter(function(x){ return x.id===p.id; })[0]; return g ? '<div class="pmeta orgPersonTitle">🌏 '+esc(gpRoleLabel_(g.gpRole))+'</div>' : ''; })()+
    (function(){ var b=((S.org&&S.org.board)||[]).filter(function(x){ return x.staffId===p.id; })[0]; return b ? '<div class="pmeta orgPersonTitle">🛡️ '+esc(t(b.role))+' · '+esc(t('YWAM GP Advisory Board'))+'</div>' : ''; })()+
    (p.role?'<div class="pmeta">'+esc(t(p.role))+'</div>':'')+
    '<div class="pmeta">'+esc(t(p.dept))+(p.ministry?' · '+esc(t(p.ministry)):'')+'</div>'+
    '<div class="pmeta">'+esc(t(campusName(p.campus)))+'</div></div></div>';
  var a=d.activity||{};
  if(a.daysLogged){
    h+='<div class="chips" style="margin-top:12px">'+
       '<span class="chip blue">'+a.weeksTracked+' '+esc(t('weeks tracked'))+'</span>'+
       (a.lastLogged?'<span class="chip blue">'+esc(t('last logged'))+' '+esc(a.lastLogged)+'</span>':'')+
       '</div>';
  }
  h+='<button class="libTally" id="personBooks">📚 '+esc(gpT('{n} books read',{n:d.booksRead||0}))+' · '+esc(t('Library'))+' →</button>';
  h+='</div>';
  h+=reqPersonCardHtml_(d);
  h+=personTypeCardHtml(d);
  h+=personGSCardHtml(d);

  var withGoals=(d.goals||[]).filter(function(g){ return g.items.some(function(i){return i.text;}); });
  h+='<h3>🗒️ '+esc(t('Weekly goals'))+'</h3>';
  if(!withGoals.length){
    h+='<div class="card"><p class="sub" style="margin:6px 0">'+
       esc(t('No goals written yet.'))+'</p></div>';
  } else {
    withGoals.forEach(function(g){
      h+='<div class="card"><div class="row" style="border:0;padding-top:0">'+
        '<span class="rowName">'+esc(t('Week'))+' '+g.week+'</span>'+
        '<span class="pctSm">'+(g.pct===null?'—':g.pct+'%')+'</span></div>';
      g.items.filter(function(i){return i.text;}).forEach(function(i){
        var ip=goalItemPct(i);
        h+='<div class="goalRow'+(ip>=100?' done':'')+'">'+ringHtml(ip)+
          '<div class="goalBody"><span class="goalText">'+esc(i.text)+'</span>'+
          (i.metricKey?'<div class="goalLink">📊 '+esc(t('moves'))+' '+esc(t(i.metricKey.split('|')[2]||''))+'</div>':'')+
          '</div></div>';
      });
      h+='</div>';
    });
  }
  /* Their objectives too — tapping a teammate should answer "what is this person
     working toward", not just "did they tick their boxes". Department-level, so
     nothing here is private to them. */
  h+=okrSectionHtml(p, false);

  h+='<p class="hint">🔒 '+esc(t('Daily check-ins, health answers and anything private stay between this person and their mentor.'))+'</p>';
  return h;
}

/* Mentor entry point lives at the top of Team rather than as its own tab. */
function mentorEntryHtml(){
  var reqN=(S.mentorRequests?S.mentorRequests.length:0)+(S.tripRequests?S.tripRequests.length:0);
  if(!S.mentees.length && !reqN) return '';
  var label = reqN
    ? reqN+' mentor request'+(reqN===1?'':'s')+' waiting'
    : gpT('{n} mentees',{n:S.mentees.length});
  return '<button class="btn'+(reqN?'':' ghost')+'" id="goMentor">🤝 '+esc(label)+'</button>';
}

/* ---------- mentor ---------- */
function mentorHtml(){
  if(S.mentee){
    var m=S.mentee, wl=S.menteeLogs;
    var h='<button class="linkbtn" id="menteeBack" style="text-align:left;text-decoration:none">← All mentees</button>';
    h+='<div class="card"><div class="pcard">'+avatarHtml(m,'lg')+'<div><div class="pname">'+esc(m.name)+'</div><div class="pmeta">'+esc(m.dept)+(m.role?' · '+esc(m.role):'')+'</div></div></div></div>';
    h+='<div class="banner">🔒 Shared with you as '+esc(m.name.split(' ')[0])+'\u2019s mentor. Hold it with care and prayer — this is trust, not surveillance.</div>';
    if(S.menteeProfile && S.menteeProfile.debt) h+='<div class="banner">💰 Currently carrying staff debt.</div>';
    h+=supMentorCardHtml_(S.menteeSupport, m);
    h+=ooMenteeSectionHtml_(m);

    /* Any week, not just the latest: a picker at the top, and every section
       below — check-in, habits, goals, daily logs — follows it. Opens on the
       newest week they checked in (or this week). */
    var yrNow=thisWeekYear(), wkNow=thisWeek();
    var logWeek=function(l){ return l.week ? Number(l.week) : isoWeekOf(new Date(String(l.date)+'T00:00:00')); };
    wl=(wl||[]).filter(function(l){ return !l.date || weekYearOf(new Date(String(l.date)+'T00:00:00'))===yrNow; });
    var ckWeeks=(S.menteeCheckins||[]).map(function(c){ return Number(c.week); });
    var anyWeeks=ckWeeks.concat(wl.map(logWeek)).concat((S.menteeGoals||[]).map(function(g){ return Number(g.week); })).filter(function(w){ return w>0; });
    var minWk=anyWeeks.length ? Math.min.apply(null, anyWeeks) : wkNow;
    if(!S.menteeWeek) S.menteeWeek = ckWeeks.length ? Math.max.apply(null, ckWeeks) : wkNow;
    S.menteeWeek=Math.max(Math.min(minWk, wkNow), Math.min(wkNow, S.menteeWeek));
    var W=S.menteeWeek;
    h+='<div class="weekNavRow mWeekNav" id="mWeekNav"><button class="weekArrow" id="mWeekPrev" aria-label="'+esc(t('Previous week'))+'"'+(W<=minWk?' disabled':'')+'>‹</button>'+
      '<div class="weekPill" id="mWeekPill">'+esc(t('Week'))+' '+W+(W===wkNow?' · '+esc(t('this week')):'')+'</div>'+
      '<button class="weekArrow" id="mWeekNext" aria-label="'+esc(t('Next week'))+'"'+(W>=wkNow?' disabled':'')+'>›</button></div>'+
      (ckWeeks.length && W!==Math.max.apply(null, ckWeeks) ? '<button class="linkbtn inline" id="mWeekLatest" style="display:block;margin:0 auto 8px">'+esc(t('Back to the latest check-in'))+'</button>' : '');

    /* Their weekly check-ins, by name. This is the one place a survey answer is
       attached to a person: the base average pools tokens and never sees a name,
       and choosing a mentor is what opens this view to that one person. Newest
       first, with the direction of travel — a mentor needs the trend more than
       any single week. */
    var mc=(S.menteeCheckins||[]).slice().sort(function(a,b){ return b.week-a.week; });
    h+='<h3>💚 '+esc(t('Their weekly check-ins'))+'</h3>';
    if(!mc.length){
      h+='<div class="card"><p class="sub" style="margin:6px 0">'+
         esc(t('No check-ins yet.'))+'</p></div>';
    } else {
      var latest=null, prior=null;
      mc.forEach(function(c){ if(Number(c.week)===W) latest=c; });
      mc.forEach(function(c){ if(!prior && Number(c.week)<W) prior=c; });
    }
    if(mc.length && !latest){
      h+='<div class="card"><p class="sub" style="margin:6px 0">'+esc(gpT('No check-in for week {n}.',{n:W}))+'</p></div>';
    }
    if(mc.length && latest){
      var lsc=compositeOf(latest), psc=prior?compositeOf(prior):null;
      h+='<div class="card"><div class="row" style="border:0;padding-top:0">'+
         '<span class="rowName"><strong>'+esc(t('Week'))+' '+latest.week+'</strong>'+
         '<div class="pmeta">'+esc(t(latest.source==='weekly'?'weekly check-in':'from daily logs'))+'</div></span>'+
         '<span class="pctBig">'+lsc.toFixed(1)+
           (psc!==null?trendBadge(pctChange(psc,lsc), true):'')+'</span></div>'+
         '<div class="bar"><div class="barFill'+(lsc>=8?' done':'')+'" style="width:'+Math.round(lsc*10)+'%"></div></div>';
      var yn=function(v){ return v?esc(t('Yes')):esc(t('No')); };
      var mt=function(id, hb, asPct){
        if(!prior) return '';
        var a=Number(prior[id]), b=Number(latest[id]);
        if(isNaN(a)||isNaN(b)) return '';
        if(asPct) return a===b ? trendBadge(0,hb) : trendBadge(b>a?100:-100, hb);
        return trendBadge(pctChange(a,b), hb);
      };
      [['lonely','Loneliness (avg)',false,'/10'],['clarity','Clarity (avg)',true,'/10'],
       ['growth','Growth (avg)',true,'/10'],['langHours','Language hours',true,'']].forEach(function(q){
        var v=latest[q[0]];
        h+='<div class="row"><span class="rowName">'+esc(t(q[1]))+'</span><span class="rowVal">'+
           ((v===null||v===undefined)?'—':v+q[3])+mt(q[0],q[2],false)+'</span></div>';
      });
      [['porn','Looked at porn',false],['oneOnOne','Had a one-on-one',true],
       ['exercise','Exercised 3+ days',true],['quietTime','Regular quiet time',true],
       ['sharedFaith','Shared my faith',true],['sabbath','Sabbath / rest',true],
       ['debt','Have staff debt',false]].forEach(function(q){
        h+='<div class="row"><span class="rowName">'+esc(t(q[1]))+'</span><span class="rowVal">'+
           yn(latest[q[0]])+mt(q[0],q[2],true)+'</span></div>';
      });
      h+='</div>';
    }
    if(mc.length>1){
      h+='<div class="card"><div class="pmeta" style="margin:0 0 4px">'+esc(t('Every week — tap one to look at it'))+'</div>';
      mc.forEach(function(c,i){
        var sc=compositeOf(c), older=mc[i+1]?compositeOf(mc[i+1]):null;
        h+='<button class="row mWeekRow'+(Number(c.week)===W?' on':'')+'" data-mweek="'+c.week+'"><span class="rowName">'+esc(t('Week'))+' '+c.week+'</span>'+
           '<span class="pctSm">'+sc.toFixed(1)+
             (older!==null?trendBadge(pctChange(older,sc), true):'')+'</span></button>';
      });
      h+='</div>';
    }

    // Trajectory beats a compliance grid: last 7 days against the 7 before, so
    // you see direction rather than policing individual days.
    var menteeHabits=S.menteeHabits||[];
    if(menteeHabits.length){
      var recent=wl.filter(function(l){ return logWeek(l)===W; }), prior=wl.filter(function(l){ return logWeek(l)===W-1; });
      var cnt=function(rows,id){ var n=0; rows.forEach(function(l){ if(l.habits&&l.habits[id]) n++; }); return n; };
      h+='<h3>'+esc(gpT('{name}’s habits',{name:m.name.split(' ')[0]}))+' · '+esc(t('Week'))+' '+W+'</h3><div class="card">';
      menteeHabits.forEach(function(hb){
        var meta=habitMeta(hb);
        var a=cnt(recent,hb.id), b=cnt(prior,hb.id), per=(hb.days&&hb.days.length)?hb.days.length:7;
        var arrow = !prior.length ? '' :
          (a>b?' <span class="trend up">▲</span>':(a<b?' <span class="trend down">▼</span>':' <span class="trend flat">–</span>'));
        h+='<div class="row"><span class="rowName">'+meta.icon+' '+esc(t(meta.label))+
          '<div class="pmeta">'+(prior.length?esc(gpT('week {n}',{n:W-1}))+': '+b:esc(t('no data the week before')))+'</div></span>'+
          '<span class="pctSm">'+a+'/'+per+arrow+'</span></div>';
      });
      h+='</div>';
    }

    // weekly goals + how they're tracking against them
    var mg=(S.menteeGoals||[]).filter(function(g){ return g.items.some(function(i){return i.text;}); });
    h+='<h3>🎯 Weekly goals</h3>';
    if(!mg.length){
      h+='<div class="card"><p class="sub" style="margin:6px 0">No goals written yet.</p></div>';
    } else {
      var scored=mg.filter(function(g){ return g.pct!==null; });
      var avg=scored.length ? Math.round(scored.reduce(function(a,g){return a+g.pct;},0)/scored.length) : null;
      h+='<div class="card"><div class="row" style="border:0;padding-top:0"><span class="rowName">Goals completed'+
        '<div class="pmeta">across '+mg.length+' week'+(mg.length===1?'':'s')+'</div></span>'+
        '<span class="pctBig">'+(avg===null?'—':avg+'%')+'</span></div>';
      h+='<div class="bar"><div class="barFill'+(avg>=100?' done':'')+'" style="width:'+(avg||0)+'%"></div></div></div>';
      var gw=mg.filter(function(g){ return Number(g.week)===W; });
      if(!gw.length) h+='<div class="card"><p class="sub" style="margin:6px 0">'+esc(gpT('No goals written for week {n}.',{n:W}))+'</p></div>';
      gw.forEach(function(g){
        h+='<div class="card"><div class="row" style="border:0;padding-top:0"><span class="rowName">Week '+g.week+'</span>'+
          '<span class="pctSm">'+(g.pct===null?'—':g.pct+'%')+'</span></div>';
        g.items.filter(function(i){return i.text;}).forEach(function(i){
          var mp=goalItemPct(i);
          h+='<div class="goalRow'+(mp>=100?' done':'')+'">'+ringHtml(mp)+
            '<div class="goalBody"><span class="goalText">'+esc(i.text)+'</span></div></div>';
        });
        h+='</div>';
      });
    }

    var wkLogs=wl.filter(function(l){ return logWeek(l)===W; });
    h+='<h3>'+esc(t('Daily logs'))+' · '+esc(t('Week'))+' '+W+'</h3><div class="card">';
    if(!wkLogs.length) h+='<p class="sub" style="margin:6px 0">'+esc(gpT('No daily logs for week {n}.',{n:W}))+'</p>';
    wkLogs.forEach(function(l){
      var flags=[];
      if(l.lonely!=null) flags.push('lonely '+l.lonely+'/10');
      if(l.porn) flags.push('⚠ porn');
      if(l.quietTime) flags.push('quiet time');
      if(l.workout) flags.push('workout');
      h+='<div class="row"><span class="rowName">'+esc(l.date)+'<div class="pmeta">'+(flags.join(' · ')||'—')+'</div></span></div>';
    });
    h+='</div>';

    /* A mentor relationship is consent to see everything below too — the
       ministry numbers they log, their annual goals, and their leave
       history — read-only, since none of this is the mentor's to edit. */
    var mmin=S.menteeMinistry;
    if(mmin && mmin.ministry){
      var mMetrics=metricsFor(mmin.campus, mmin.dept, mmin.ministry);
      if(mMetrics.length){
        h+='<h3>📊 '+esc(t(mmin.ministry))+'</h3><div class="card">';
        mMetrics.forEach(function(metric){
          var mode=modeOf(metric);
          var wks=mmin.entries[metric]||{};
          var agg=aggregate(wks, mode);
          h+='<div class="row"><span class="rowName">'+esc(t(metric))+'</span>'+
            '<span class="pctSm">'+fmt(agg, metric)+'</span></div>';
        });
        h+='</div>';
      }
    }

    var msmart=(S.menteeSmart||[]).filter(function(g){ return Number(g.year)===new Date().getFullYear(); });
    if(msmart.length){
      h+='<h3>'+esc(t('Annual Goals · SMART'))+'</h3><div class="card">';
      msmart.forEach(function(g){
        h+='<div class="smartGoal"><div class="smartTitle">'+esc(g.title)+'</div>'+
          (g.meta?'<div class="smartMeta">'+esc(g.meta)+'</div>':'')+
          '<div class="bar"><div class="barFill'+(g.pct>=100?' done':'')+'" style="width:'+g.pct+'%"></div></div>'+
          '<div class="smartActions"><span class="smartPct">'+esc(smartProgressLine_(g))+'</span></div></div>';
      });
      h+='</div>';
    }

    var mtrips=S.menteeTrips;
    if(mtrips && mtrips.trips && mtrips.trips.length){
      h+='<h3>'+esc(t('Leave Request'))+'</h3><div class="card">';
      mtrips.trips.slice(0,10).forEach(function(r){
        var pillCls = r.status==='declined'?'denied':(r.status==='approved'||r.status==='noted')?'approved':'pending';
        var pillLabel = r.status==='declined'?t('Denied'):r.status==='approved'?t('Approved'):r.status==='noted'?t('Noted'):t('Pending');
        h+='<div class="histRow"><div class="histTop"><span class="histType">'+esc(t(leaveTypeLabel_(r.type)))+'</span>'+
          '<span class="pill '+pillCls+'">'+esc(pillLabel)+'</span></div>'+
          '<div class="histDates">'+esc(r.from)+(r.to!==r.from?' → '+esc(r.to):'')+' · '+esc(gpT('{n} work days',{n:r.workDays}))+'</div></div>';
      });
      h+='</div>';
    }
    return h;
  }
  var h='';

  /* Trips waiting on you as mentor. Sits above mentee requests because it's
     time-sensitive — someone is asking about days that are coming up. */
  if(S.tripRequests && S.tripRequests.length){
    h+='<h2>'+esc(t('Away requests'))+' <small>· '+S.tripRequests.length+'</small></h2>'+
       '<p class="sub">'+esc(t('People you mentor letting you know they’ll be off campus.'))+'</p>';
    S.tripRequests.forEach(function(r){
      h+='<div class="card"><div class="row" style="border:0;padding-top:0">'+
        '<span class="rowName"><strong>'+esc(r.name)+'</strong>'+
        '<div class="pmeta">'+esc(r.from)+(r.to!==r.from?' → '+esc(r.to):'')+' · '+
          esc(t(leaveTypeLabel_(r.type)))+(r.reason?' · '+esc(r.reason):'')+'</div>'+
        (r.coverage?'<div class="pmeta">“'+esc(r.coverage)+'”</div>':'')+
        '</span><span class="pctSm">'+esc(gpT('{n} work days',{n:r.workDays}))+'</span></div>'+
        '<div style="display:flex;gap:8px;margin-top:10px">'+
        '<button class="btn" style="margin:0;padding:9px 4px;font-size:13px" data-trok="'+esc(r.id)+'">'+esc(t('Approve'))+'</button>'+
        '<button class="btn ghost" style="margin:0;padding:9px 4px;font-size:13px" data-trno="'+esc(r.id)+'">'+esc(t('Not yet'))+'</button>'+
        '</div></div>';
    });
  }

  if(S.mentorRequests && S.mentorRequests.length){
    h+='<h2>Mentor requests <small>· '+S.mentorRequests.length+'</small></h2>'+
      '<p class="sub">These people chose you as their mentor. Accepting gives you access to their private check-ins — decline if that’s not a fit.</p><div class="dir">';
    S.mentorRequests.forEach(function(p){
      h+='<div class="dircard" style="cursor:default">'+avatarHtml(p)+'<div class="pname">'+esc(p.name)+'</div><div class="pmeta">'+esc(t(p.dept))+'</div>'+
        '<div style="display:flex;gap:6px;margin-top:10px"><button class="btn" style="margin:0;padding:8px 4px;font-size:13px" data-accept="'+esc(p.id)+'">Accept</button>'+
        '<button class="btn ghost" style="margin:0;padding:8px 4px;font-size:13px" data-decline="'+esc(p.id)+'">Decline</button></div></div>';
    });
    h+='</div>';
  }
  h+='<h2>My mentees <small>· '+S.mentees.length+'</small></h2>'+
    '<p class="sub">People who chose you as their mentor and you’ve accepted. You can see their private check-ins.</p><div class="dir">';
  S.mentees.forEach(function(p){
    h+='<div class="dircard" data-mentee="'+esc(p.id)+'">'+avatarHtml(p)+'<div class="pname">'+esc(p.name)+'</div><div class="pmeta">'+esc(p.dept)+'</div>'+ooMonthHtml_(p.id)+'</div>';
  });
  h+='</div>';
  return h;
}

/* ---------- profile ---------- */
/* '' means auto — no attribute on <html>, so the CSS media query decides. The
   same key is read in <head> on all three pages before anything paints. */
function savedTheme(){
  var v = lsGet('gp-theme');
  return (v === 'light' || v === 'dark') ? v : '';
}
function applyTheme(v){
  if(v === 'light' || v === 'dark'){
    document.documentElement.setAttribute('data-theme', v);
    lsSet('gp-theme', v);
  } else {
    document.documentElement.removeAttribute('data-theme');
    lsDel('gp-theme');
  }
}

function profileHtml(){
  var p=S.profile||{};
  var opts=S.roster.filter(function(x){return x.id!==S.me.id;}).map(function(x){
    return '<option value="'+esc(x.id)+'"'+(S.me.mentorId===x.id?' selected':'')+'>'+esc(x.name)+' · '+esc(x.dept)+'</option>';
  }).join('');
  var h='<h2>My profile</h2>';
  h+='<div class="card"><div class="pcard">'+avatarHtml(S.me,'lg')+
     '<div><button class="btn ghost" id="photoBtn" style="width:auto;margin:0;padding:9px 14px">'+(S.me.photo?'Change photo':'Add photo')+'</button>'+
     '<input type="file" accept="image/*" id="photoInput" style="display:none"></div></div>'+
     '<button class="libTally" id="profBooks">📚 '+esc(gpT('{n} books read',{n:libBooksRead_()}))+' · '+esc(t('Library'))+' →</button></div>';
  h+=reqProfileCardHtml_();
  h+='<div class="card">'+
    '<label class="f">Full name</label><input type="text" id="p_name" value="'+esc(S.me.name)+'">'+
    '<label class="f">Email</label><input type="email" id="p_email" value="'+esc(p.email||'')+'" placeholder="you@example.com">'+
    '<div class="hint">One profile per email — this is what stops a duplicate sign-up.</div>'+
    '<label class="f">Campus</label><select id="p_campus">'+CAMPUSES.map(function(c){return '<option value="'+c.id+'"'+(S.me.campus===c.id?' selected':'')+'>'+c.name+'</option>';}).join('')+'</select>'+
    cltRequestBannerHtml_()+
    '<label class="f">'+esc(t('Main department'))+'</label><select id="p_dept">'+deptsFor(S.me.campus).map(function(d){return '<option value="'+esc(d)+'"'+(S.me.dept===d?' selected':'')+'>'+esc(t(d))+'</option>';}).join('')+'</select>'+
    '<label class="f">'+esc(t('Main ministry'))+'</label><select id="p_ministry"></select><div class="hint">'+esc(t('The one My Ministry opens on.'))+'</div>'+
    '<label class="f">'+esc(t('Other ministries I’m part of'))+'</label>'+
    '<div class="hint" style="margin:0 0 6px">'+esc(t('Tick every other ministry you serve in. You see and enter numbers for your main ministry and these.'))+'</div>'+
    '<div class="leadsPick" id="p_ministries">'+leadsPickHtml_(S.me.campus, S.me.ministries||[], 'data-pmin', S.me.dept+'|'+(S.me.ministry||''))+'</div>'+
    '<label class="f">Role / team</label><input type="text" id="p_role" value="'+esc(S.me.role)+'">'+
    staffTypeFieldHtml('p_type', S.me.staffType||'')+
    '<label class="f">'+esc(t('Male or female'))+'</label><select id="p_sex">'+
      '<option value="">'+esc(t('— choose —'))+'</option>'+
      '<option value="female"'+((p.sex||'')==='female'?' selected':'')+'>'+esc(t('Female'))+'</option>'+
      '<option value="male"'+((p.sex||'')==='male'?' selected':'')+'>'+esc(t('Male'))+'</option></select>'+
      '<div class="hint">'+esc(t('Used for your personality character.'))+'</div>'+
    countryFieldHtml('p_country', S.me.country||'')+
    '<label class="f">My mentor <span class="lock">🔒 sees my private check-ins</span></label><select id="p_mentor"><option value="">— none —</option>'+opts+'</select>'+
    (p.mentorStatus==='pending' ? '<div class="hint">⏳ Waiting for them to accept</div>' : p.mentorStatus==='approved' ? '<div class="hint">✓ Accepted — they can see your private check-ins</div>' : '')+
    '<label class="f">Phone</label><input type="tel" id="p_phone" value="'+esc(p.phone||'')+'">'+
    '<label class="f">Year joined</label><input type="number" id="p_joined" value="'+esc(p.joined||'')+'">'+
    '<label class="f">Staff debt <span class="lock">🔒 private</span></label><div class="seg" style="max-width:220px">'+
      '<button id="debtY" class="'+(p.debt?'on bad':'')+'">Yes</button><button id="debtN" class="'+(!p.debt?'on':'')+'">No</button></div>'+
    '<button class="btn" id="saveProfBtn">Save profile</button></div>';
  h+='<div class="card"><label class="f">Change PIN</label><input type="password" id="p_newpin" inputmode="numeric" maxlength="4" placeholder="new 4-digit PIN">'+
     '<button class="btn ghost" id="pinBtn">Update PIN</button></div>';
  h+=remindersCardHtml_();
  /* Three states, not a switch: "Auto" is the default and the one most people
     want, because it follows what their phone already does at night. */
  var th=savedTheme();
  h+='<div class="card"><label class="f">'+esc(t('Appearance'))+'</label>'+
     '<div class="seg">'+
       '<button data-theme-set="" class="'+(th===''?'on':'')+'">'+esc(t('Auto'))+'</button>'+
       '<button data-theme-set="light" class="'+(th==='light'?'on':'')+'">'+esc(t('Light'))+'</button>'+
       '<button data-theme-set="dark" class="'+(th==='dark'?'on':'')+'">'+esc(t('Dark'))+'</button>'+
     '</div><div class="hint">'+esc(t('Auto follows your phone.'))+'</div></div>';
  /* Bootstrap for the Admin screen: grantAdmin only needs the admin code
     (GP_ADMIN_CODE — separate from the dashboard's leader code on purpose),
     not an admin session, otherwise nobody could ever become the first
     admin. This is the one place that spends the code for yourself; the
     Admin screen itself spends it on someone else. */
  if(S.me.isAdmin){
    h+='<div class="card"><label class="f">'+esc(t('Admin access'))+'</label>'+
      '<p class="hint" style="margin:0">'+esc(t('You have admin access — find it in the menu.'))+'</p></div>';
  } else if(S.me.dept==='Campus Leadership'){
    h+='<div class="card"><label class="f">'+esc(t('Admin access'))+'</label>'+
      '<p class="hint" style="margin:0 0 8px">'+esc(t('Enter the admin code to unlock the Admin screen for this account.'))+'</p>'+
      '<div class="numIn"><input type="password" id="p_admincode" placeholder="'+esc(t('Admin code'))+'">'+
      '<button class="btn ghost" style="margin:0;width:auto;padding:9px 14px" id="p_adminunlock">'+esc(t('Unlock'))+'</button></div></div>';
  }
  h+='<button class="danger" id="logoutBtn" style="width:100%">Log out</button>';
  h+='<footer>✦ Every number is a person.</footer>';
  return h;
}

/* ---------- photo resize + upload ---------- */
function handlePhoto(file){
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var max=300, w=img.width, h=img.height;
      if(w>h && w>max){ h=Math.round(h*max/w); w=max; } else if(h>max){ w=Math.round(w*max/h); h=max; }
      var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      var data=cv.toDataURL('image/jpeg',0.7).split(',')[1];
      showMsg('Uploading photo…');
      run('uploadPhoto',[S.auth.user,S.auth.pin,data,'image/jpeg'],function(d){
        if(d.ok){ S.me.photo=d.photo; saveStaffCard(); showMsg('Photo updated'); render(); }
        else showMsg(d && d.err==='bad_type' ? 'That image type isn\u2019t supported' : (d && d.err==='too_large' ? 'Photo too large \u2014 try a smaller one' : 'Upload failed'));
      });
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

/* Same resize-then-upload shape as handlePhoto, just a wider frame since this
   sits behind a whole card rather than a small avatar circle. */
function handleDashboardBg(file){
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var max=800, w=img.width, h=img.height;
      if(w>h && w>max){ h=Math.round(h*max/w); w=max; } else if(h>max){ w=Math.round(w*max/h); h=max; }
      var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      var data=cv.toDataURL('image/jpeg',0.6).split(',')[1];
      showMsg(t('Uploading image…'));
      run('uploadDashboardBg',[S.auth.user,S.auth.pin,data,'image/jpeg'],function(d){
        if(d.ok){ S.profile=S.profile||{}; S.profile.dashboardBg=d.dashboardBg; showMsg(t('Dashboard updated')); render(); }
        else showMsg(d && d.err==='bad_type' ? t('That image type isn’t supported') : (d && d.err==='too_large' ? t('Image too large — try a smaller one') : t('Upload failed')));
      });
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

