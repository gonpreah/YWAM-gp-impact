/* My YWAM GP — teams.html, part 7 of 11: weekly schedules, Campus Leadership on My Ministry, login, Health, leave.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ---------- Weekly schedules ----------
   The cooking schedule (Culinary) and the morning chores (Hospitality), a
   new one every week from Sunday. Everyone reads the published week here
   (from My Home's card or the menu) and can send it on as a picture; the
   ministry that owns one makes it here too — "Edit" opens the same page with
   every cell tappable, a name picker (the people here that week, from
   getDuty), Save and Publish. Drawing and the picture are duty.js, shared
   with the portal. */
var SCHED_KINDS=[['kitchen','🍲','Cooking schedule','Skills Training','Culinary'],['chores','🧹','Morning chores','Skills Training','Hospitality']];
function schedKind_(id){ return SCHED_KINDS.filter(function(k){ return k[0]===id; })[0] || SCHED_KINDS[0]; }
function schedWeekLabel_(w, short){
  var e=dutyAddDays(w,6), m=function(iso){ return t(MONTH_SHORT[Number(iso.slice(5,7))-1])+' '+Number(iso.slice(8,10)); };
  return short ? m(w)+' – '+m(e) : gpT('Week of {a} – {b}',{a:m(w), b:m(e)+', '+e.slice(0,4)});
}
/* My name as the schedules write it: the first name, with an initial when two campus staff share it (dutyShortNames_ in api.js). */
/* The names a schedule may hold for me: the full name (schedules since Oct
   2026) and the first-name short form older weeks were made with. */
function schedMyName_(){
  if(!S.me) return [];
  var full=String(S.me.name||'').replace(/\s+/g,' ').trim();
  var parts=full.split(/\s+/), f=parts[0]||'';
  var same=(S.roster||[]).filter(function(p){ return p.campus===S.me.campus && String(p.name||'').trim().split(/\s+/)[0].toLowerCase()===f.toLowerCase(); }).length;
  var short=same>1 && parts.length>1 ? f+' '+parts[parts.length-1][0]+'.' : f;
  return full ? (short && short!==full ? [full, short] : [full]) : [];
}
/* How many places each name holds on this schedule — every cell of the
   grid (a whole-week row counts once), every place of the list. */
function schedAssignCounts_(s){
  var n={};
  var add=function(list){ (list||[]).forEach(function(x){ n[x]=(n[x]||0)+1; }); };
  if(s.layout==='grid') Object.keys(s.cells||{}).forEach(function(k){ add(s.cells[k]); });
  else (s.sections||[]).forEach(function(sec){ (sec.rows||[]).forEach(function(r){ add(r.people); }); });
  return n;
}
/* Your duties this week, inside My Home's dashboard card: the chore by name —
   "🧹 Your chore: Rooftop" — and the cooking, each a tap from its schedule.
   Nothing on the schedules is yours → nothing here (Uriah, Oct 2026: the
   "this week's schedules" label and its Cooking / Chores buttons were
   redundant; the schedules themselves are in the menu). */
function schedHomeHtml_(){
  var d=S.sched, me=schedMyName_();
  var ch=(d && d.now && d.now.chores) ? dutyMine(d.now.chores, me, t) : [], ck=(d && d.now && d.now.kitchen) ? dutyMine(d.now.kitchen, me, t) : [];
  if(!ch.length && !ck.length) return '<span id="schedHome" hidden></span>';   // still there, so this week's schedules get loaded (bind)
  var h='<div class="heroSched" id="schedHome">';
  if(ch.length) h+='<button class="heroSchedMine" data-schedopen="chores" id="schedMineChore">🧹 '+esc(gpT(ch.length===1?'Your chore: {what}':'Your chores: {what}',{what:ch.join(', ')}))+' ›</button>';
  if(ck.length) h+='<button class="heroSchedMine" data-schedopen="kitchen" id="schedMineCook">🍲 '+esc(ck.length<=2 ? gpT('Cooking: {what}',{what:ck.join(', ')}) : gpT('You have {n} cooking duties this week',{n:ck.length}))+' ›</button>';
  return h+'</div>';
}
function schedLoad_(kind, week, edit){
  var key=kind+'|'+week+'|'+(edit?'e':'v');
  if(S.schedData && S.schedData.key===key) return;
  if(S.schedLoading===key) return;
  S.schedLoading=key; S.schedErr='';
  run('getDuty',[S.auth.user,S.auth.pin,kind,week],function(d){
    if(S.schedLoading!==key) return;
    S.schedLoading=null;
    if(d && d.ok){ d.key=key; S.schedData=d; S.schedDirty=false; if(edit && !d.canEdit) S.schedEdit=false; }
    else S.schedErr=(d && d.err) || t('Could not load');
    render();
  }, function(e){ S.schedLoading=null; S.schedErr=(e && e.message) || t('Connection problem — try again.'); render(); });
}
function schedHtml(){
  var kind=schedKind_(S.schedKind)[0], week=S.schedWeek || dutyWeekOf(), edit=!!S.schedEdit;
  var h='<button class="linkbtn" id="schedBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(S.schedFrom==='ministry' ? t('My Ministry') : t('My Home'))+'</button>';
  h+='<h2>📋 '+esc(t('Weekly schedules'))+'</h2>';
  h+='<div class="campusSeg" style="max-width:none">'+SCHED_KINDS.map(function(k){
    return '<button class="campusBtn'+(kind===k[0]?' on':'')+'" data-schedkind="'+k[0]+'">'+k[1]+' '+esc(t(k[2]))+'</button>'; }).join('')+'</div>';
  h+='<div class="calNav"><button class="weekArrow" id="schedPrev" aria-label="'+esc(t('Previous week'))+'">‹</button>'+
    '<div class="calTitle" id="schedWeek">'+esc(schedWeekLabel_(week, true))+'</div>'+
    '<button class="weekArrow" id="schedNext" aria-label="'+esc(t('Next week'))+'">›</button>'+
    (week!==dutyWeekOf() ? '<button class="linkbtn inline" id="schedThis">'+esc(t('This week'))+'</button>' : '')+'</div>';
  var d=S.schedData, key=kind+'|'+week+'|'+(edit?'e':'v');
  if(!d || d.key!==key){
    schedLoad_(kind, week, edit);
    return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.schedErr ? S.schedErr : t('Loading…'))+'</p>'+(S.schedErr?'<button class="btn ghost" id="schedRetry">'+esc(t('Try again'))+'</button>':'')+'</div>';
  }
  var s=d.sched;
  if(!edit){
    if(!s){
      h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('This week’s schedule isn’t out yet.'))+'</p></div>';
    } else {
      h+='<div class="schedTitle">'+(s.km?'<span class="dutyKm">'+esc(s.km)+'</span>':'')+esc(s.title)+'</div>';
      var me=schedMyName_(), mineRows=dutyMineRows(s, me), mineLines=dutyMine(s, me, t);
      /* your own part first, so it's there without looking through the list */
      if(mineLines.length){
        h+='<div class="card slim schedMineCard" id="schedMine"><div class="schedMineHead">'+(kind==='chores' ? '🧹 '+esc(t(mineRows.length===1?'Your chore this week':'Your chores this week')) : '🍲 '+esc(t('Your cooking this week')))+'</div>';
        if(mineRows.length) h+=mineRows.map(function(r){ return '<div class="schedMineRow"><b>'+esc(r.place)+'</b>'+(r.duty?'<div class="rowSub">'+esc(r.duty)+'</div>':'')+
          (r.with.length?'<div class="rowSub">👥 '+esc(gpT('With {names}',{names:r.with.join(', ')}))+'</div>':'')+'</div>'; }).join('');
        else h+='<div class="schedMineRow">'+mineLines.map(function(l){ return '<div><b>'+esc(l)+'</b></div>'; }).join('')+'</div>';
        h+='</div>';
      }
      var only=S.schedOnlyMine && mineLines.length && s.layout!=='grid';
      if(s.layout!=='grid'){
        h+='<div class="schedViewBar">'+(mineLines.length ? '<div class="leadFilters schedWho">'+
          '<button class="leadSeg'+(only?'':' on')+'" data-schedonly="0">'+esc(t('Everyone'))+'</button>'+
          '<button class="leadSeg'+(only?' on':'')+'" data-schedonly="1">'+esc(t('Mine'))+'</button></div>' : '<span></span>')+
          '<button class="linkbtn inline" id="schedDetails">'+esc(S.schedDetails ? t('Hide what to do') : t('Show what to do'))+'</button></div>';
      }
      h+=dutyHtml(s, { t:t, esc:esc, me:me, compact: s.layout!=='grid' && !S.schedDetails, only: only ? me : '' });
      if(s.notes) h+='<p class="hint" style="white-space:pre-line">'+esc(s.notes)+'</p>';
      h+='<button class="btn" id="schedShare">📤 '+esc(t('Share as image'))+'</button>';
    }
    if(d.canEdit) h+='<button class="btn ghost" id="schedEditBtn">✏️ '+esc(s ? t('Edit this schedule') : t('Make this week’s schedule'))+'</button>';
    return h;
  }
  // ---- making it ----
  h+='<div class="schedState '+(s.published?'pub':'draft')+'" id="schedState">'+(s.published ? '✅ '+esc(t('Published — everyone can see it')) : '📝 '+esc(t('Draft — only your team can see it')))+
    (d.isNew ? '<span class="rowSub" style="display:block">'+esc(d.from ? gpT('Started as a copy of the week of {date} — change what is different.',{date:hospDate_(d.from)}) : t('Started from the usual rows — tap a box to put people in it.'))+'</span>' : '')+
    (S.schedDirty ? '<span class="rowSub" style="display:block">● '+esc(t('Changes not saved yet'))+'</span>' : '')+'</div>';
  h+='<div class="schedTools"><button class="btn ghost small" id="schedRowsBtn">'+esc(S.schedRows ? t('Done changing rows') : (s.layout==='grid' ? t('Change rows and days') : t('Change places')))+'</button></div>';
  h+= S.schedRows ? schedRowsHtml_(s) : dutyHtml(s, { t:t, esc:esc, edit:true });
  h+='<label class="f">'+esc(t('Notes'))+'</label><textarea id="schedNotes" rows="2" maxlength="1000">'+esc(s.notes||'')+'</textarea>';
  h+='<div class="schedActions">'+
    (s.published
      ? '<button class="btn" id="schedSave">'+esc(t('Save changes'))+'</button><button class="btn ghost" id="schedUnpub">'+esc(t('Take it down'))+'</button>'
      : '<button class="btn" id="schedPub">📣 '+esc(t('Publish for everyone'))+'</button><button class="btn ghost" id="schedSave">'+esc(t('Save draft'))+'</button>')+
    '<button class="linkbtn" id="schedDoneEdit">'+esc(t('Back to the schedule'))+'</button></div>';
  if(S.schedPick) h+=schedPickerHtml_(d, s);
  return h;
}
function schedCellNames_(s, key){
  var p=key.split('|');
  if(s.layout==='grid'){ s.cells=s.cells||{}; return s.cells[key] || (s.cells[key]=[]); }
  var sec=s.sections.filter(function(x){ return x.id===p[0]; })[0], row=sec && sec.rows.filter(function(r){ return r.id===p[1]; })[0];
  return row ? (row.people=row.people||[]) : [];
}
function schedCellTitle_(s, key){
  var p=key.split('|');
  if(s.layout==='grid'){
    var r=s.rows.filter(function(x){ return x.id===p[0]; })[0];
    return (r?r.label:'')+' · '+(p[1]==='all' ? t('All week') : t(DUTY_DAY_NAMES[p[1]]||''));
  }
  var sec=s.sections.filter(function(x){ return x.id===p[0]; })[0], row=sec && sec.rows.filter(function(r){ return r.id===p[1]; })[0];
  return row ? row.place : '';
}
function schedPickerHtml_(d, s){
  var key=S.schedPick, cur=schedCellNames_(s, key), q=(S.schedQ||'').trim().toLowerCase();
  var h='<div class="scrim" id="schedScrim"></div><div class="schedSheet" id="schedSheet" role="dialog">';
  h+='<div class="schedSheetHead"><b>'+esc(schedCellTitle_(s, key))+'</b><button class="btn small" id="schedPickDone">'+esc(t('Done'))+'</button></div>';
  h+='<div class="chips" id="schedCur">'+(cur.length ? cur.map(function(n){ return '<button class="hospChip on" data-dunpick="'+esc(n)+'">'+esc(n)+' ✕</button>'; }).join('') : '<span class="rowSub">'+esc(t('Nobody yet — tap names below.'))+'</span>')+'</div>';
  h+='<div class="schedAdd"><input type="text" id="schedQ" placeholder="'+esc(t('Search, or type a new name'))+'" value="'+esc(S.schedQ||'')+'" maxlength="40" autocomplete="off">'+
    '<button class="btn small" id="schedAddName">'+esc(t('Add'))+'</button></div>';
  /* Every name carries how many things it already has this week (0 until it
     has one) — the cooking spreads people over many slots, so the number is
     what keeps it fair. The morning chores are one responsibility each: a
     name that has one steps out of the list until everyone has one, unless
     "Show everyone" is on. */
  var counts=schedAssignCounts_(s), chores=s.layout!=='grid';
  var all=[]; (d.people||[]).forEach(function(g){ g.names.forEach(function(n){ if(all.indexOf(n)===-1) all.push(n); }); });
  var placed=all.filter(function(n){ return counts[n]>0; }).length, everyone=all.length>0 && placed>=all.length;
  var hide = chores && !everyone && !S.schedShowAll;
  if(chores && all.length) h+='<div class="schedAssigned" id="schedAssigned">'+esc(everyone ? t('Everyone has a chore — the numbers show who has more than one.') : gpT('{placed} of {n} have a chore',{placed:placed, n:all.length}))+
    (!everyone ? ' · <button class="linkbtn inline" id="schedShowAll">'+esc(S.schedShowAll ? t('Hide the ones already placed') : t('Show everyone'))+'</button>' : '')+'</div>';
  h+='<div class="schedGroups">';
  (d.people||[]).forEach(function(g){
    var names=g.names.filter(function(n){ return (!q || n.toLowerCase().indexOf(q)>-1) && (!hide || !counts[n] || cur.indexOf(n)>-1); });
    if(!names.length) return;
    /* the ones with the least first — the next name to call */
    names=names.slice().sort(function(a,b){ return (counts[a]||0)-(counts[b]||0); });
    h+='<div class="schedGroupLabel">'+esc(t(g.label))+'</div><div class="chips" style="margin-top:2px">'+names.map(function(n){
      var aw=(d.away||{})[n], c=counts[n]||0;
      return '<button class="hospChip'+(cur.indexOf(n)>-1?' on':'')+'" data-dpick="'+esc(n)+'" data-dcount="'+c+'"'+(aw?' title="'+esc(gpT('On leave: {days}',{days:aw}))+'"':'')+'>'+esc(n)+
        ' <small class="schedN'+(c?'':' zero')+'" aria-label="'+esc(gpT('{n} this week',{n:c}))+'">'+c+'</small>'+(aw?' <small class="schedAway">'+esc(gpT('away {days}',{days:aw}))+'</small>':'')+'</button>'; }).join('')+'</div>';
  });
  return h+'</div></div>';
}
function schedRowsHtml_(s){
  var h='<div class="card" id="schedRows">';
  if(s.layout==='grid'){
    h+='<label class="f" style="margin-top:0">'+esc(t('Days'))+'</label><div class="chips">'+['sun','mon','tue','wed','thu','fri','sat'].map(function(dd){
      return '<button class="hospChip'+(s.days.indexOf(dd)>-1?' on':'')+'" data-sday="'+dd+'">'+esc(t(DUTY_DAY_SHORT[dd]))+'</button>'; }).join('')+'</div>';
    s.rows.forEach(function(r, i){
      h+='<div class="schedRowEdit"><div class="teamGrid2"><div><label class="f">'+esc(t('Name'))+'</label><input type="text" data-srow="'+i+'" data-sf="label" value="'+esc(r.label)+'" maxlength="80"></div>'+
        '<div><label class="f">'+esc(t('Khmer'))+'</label><input type="text" data-srow="'+i+'" data-sf="km" value="'+esc(r.km||'')+'" maxlength="80"></div></div>'+
        '<label class="f">'+esc(t('Time'))+'</label><input type="text" data-srow="'+i+'" data-sf="time" value="'+esc(r.time||'')+'" maxlength="60" placeholder="'+esc(t('e.g. Cooking 6:00'))+'">'+
        '<label class="hospCheck"><input type="checkbox" data-srowspan="'+i+'"'+(r.span?' checked':'')+'> '+esc(t('The same people all week'))+'</label>'+
        '<div class="rowSub">'+esc(t('Days off'))+'</div><div class="chips">'+s.days.map(function(dd){
          return '<button class="hospChip'+((r.off||[]).indexOf(dd)>-1?' on':'')+'" data-srowoff="'+i+'|'+dd+'">'+esc(t(DUTY_DAY_SHORT[dd]))+'</button>'; }).join('')+'</div>'+
        '<div class="schedRowBtns"><button class="linkbtn inline" data-srowup="'+i+'">↑</button><button class="linkbtn inline" data-srowdown="'+i+'">↓</button>'+
        '<button class="linkbtn inline teamDelete" data-srowdel="'+i+'">'+esc(t('Remove'))+'</button></div></div>';
    });
    h+='<button class="btn ghost small" id="schedRowAdd">＋ '+esc(t('Add a row'))+'</button>';
  } else {
    s.sections.forEach(function(sec, si){
      h+='<div class="schedSecEdit"><div class="teamGrid2"><div><label class="f">'+esc(t('Section'))+'</label><input type="text" data-ssec="'+si+'" data-sf="title" value="'+esc(sec.title)+'" maxlength="80"></div>'+
        '<div><label class="f">'+esc(t('Khmer'))+'</label><input type="text" data-ssec="'+si+'" data-sf="km" value="'+esc(sec.km||'')+'" maxlength="80"></div></div>';
      sec.rows.forEach(function(r, i){
        h+='<div class="schedRowEdit"><label class="f">'+esc(t('Place'))+'</label><input type="text" data-splace="'+si+'|'+i+'" data-sf="place" value="'+esc(r.place)+'" maxlength="120">'+
          '<label class="f">'+esc(t('What to do'))+'</label><textarea data-splace="'+si+'|'+i+'" data-sf="duty" rows="2" maxlength="400">'+esc(r.duty||'')+'</textarea>'+
          '<div class="schedRowBtns"><button class="linkbtn inline" data-splaceup="'+si+'|'+i+'">↑</button><button class="linkbtn inline" data-splacedown="'+si+'|'+i+'">↓</button>'+
          '<button class="linkbtn inline teamDelete" data-splacedel="'+si+'|'+i+'">'+esc(t('Remove'))+'</button></div></div>';
      });
      h+='<button class="btn ghost small" data-splaceadd="'+si+'">＋ '+esc(t('Add a place'))+'</button></div>';
    });
    h+='<button class="btn ghost small" id="schedSecAdd">＋ '+esc(t('Add a section'))+'</button>';
  }
  return h+'</div>';
}
function bindSched_(){
  var hm=document.getElementById('schedHome');
  if(hm && !S.sched && !S.schedHomeLoading && !S.schedError){
    S.schedHomeLoading=true;
    run('getMySchedules',[S.auth.user,S.auth.pin,dutyWeekOf()],function(d){ S.schedHomeLoading=false; if(d && d.ok) S.sched=d; else S.schedError='x'; render(); },
      function(){ S.schedHomeLoading=false; S.schedError='x'; render(); });
  }
  document.querySelectorAll('[data-schedopen]').forEach(function(b){ b.onclick=function(){ gpTap(); schedOpen_(b.getAttribute('data-schedopen'), false, 'home'); }; });
  if(S.view!=='sched') return;
  var d=S.schedData, s=d && d.sched;
  var mark=function(){ S.schedDirty=true; };
  var bk=document.getElementById('schedBack');
  if(bk) bk.onclick=function(){ if(S.schedDirty && !confirm(t('Leave without saving your changes?'))) return; S.schedEdit=false; S.schedPick=null; S.view=S.schedFrom==='ministry'?'ministry':'week'; render(); };
  document.querySelectorAll('[data-schedkind]').forEach(function(b){ b.onclick=function(){
    if(S.schedDirty && !confirm(t('Leave without saving your changes?'))) return;
    gpTap(); S.schedKind=b.getAttribute('data-schedkind'); S.schedPick=null; S.schedRows=false; S.schedDirty=false; render(); }; });
  var wk=function(n){ if(S.schedDirty && !confirm(t('Leave without saving your changes?'))) return; S.schedWeek=dutyAddDays(S.schedWeek||dutyWeekOf(), n); S.schedPick=null; S.schedDirty=false; render(); };
  var sp=document.getElementById('schedPrev'); if(sp) sp.onclick=function(){ gpTap(); wk(-7); };
  var sn=document.getElementById('schedNext'); if(sn) sn.onclick=function(){ gpTap(); wk(7); };
  var stw=document.getElementById('schedThis'); if(stw) stw.onclick=function(){ gpTap(); S.schedWeek=null; S.schedDirty=false; render(); };
  var sr=document.getElementById('schedRetry'); if(sr) sr.onclick=function(){ S.schedErr=''; S.schedData=null; render(); };
  var se=document.getElementById('schedEditBtn'); if(se) se.onclick=function(){ gpTap(); S.schedEdit=true; render(); };
  document.querySelectorAll('[data-schedonly]').forEach(function(b){ b.onclick=function(){ gpTap(); S.schedOnlyMine=b.getAttribute('data-schedonly')==='1'; render(); }; });
  var sdt=document.getElementById('schedDetails'); if(sdt) sdt.onclick=function(){ gpTap(); S.schedDetails=!S.schedDetails; render(); };
  var sde=document.getElementById('schedDoneEdit'); if(sde) sde.onclick=function(){ if(S.schedDirty && !confirm(t('Leave without saving your changes?'))) return; S.schedEdit=false; S.schedPick=null; S.schedRows=false; S.schedDirty=false; S.schedData=null; render(); };
  var sh=document.getElementById('schedShare');
  if(sh) sh.onclick=function(){
    var k=schedKind_(s.kind);
    sh.disabled=true;
    dutyImage(s, { t:t, weekLabel:schedWeekLabel_(s.week) }).then(function(blob){
      return dutyShare(blob, (s.kind==='kitchen'?'cooking-schedule-':'morning-chores-')+s.week+'.png', t(k[2]));
    }).then(function(how){ sh.disabled=false; if(how==='downloaded') showMsg(t('Saved as a picture — send it from your photos or downloads.')); }, function(){ sh.disabled=false; showMsg(t('Could not make the picture.')); });
  };
  if(!s || !S.schedEdit) return;
  var notes=document.getElementById('schedNotes'); if(notes) notes.oninput=function(){ s.notes=notes.value; mark(); };
  document.querySelectorAll('[data-dcell]').forEach(function(c){ c.onclick=function(){ gpTap(); S.schedPick=c.getAttribute('data-dcell'); S.schedQ=''; S.schedShowAll=false; render(); var q=document.getElementById('schedQ'); if(q && window.innerWidth>700) q.focus(); }; });
  var closePick=function(){ S.schedPick=null; S.schedQ=''; render(); };
  var scr=document.getElementById('schedScrim'); if(scr) scr.onclick=closePick;
  var pd=document.getElementById('schedPickDone'); if(pd) pd.onclick=closePick;
  var ssa=document.getElementById('schedShowAll'); if(ssa) ssa.onclick=function(){ gpTap(); S.schedShowAll=!S.schedShowAll; render(); };
  var toggle=function(n){ var l=schedCellNames_(s, S.schedPick), i=l.indexOf(n); if(i>-1) l.splice(i,1); else l.push(n); mark(); };
  document.querySelectorAll('[data-dpick]').forEach(function(b){ b.onclick=function(){ gpTap(); toggle(b.getAttribute('data-dpick')); render(); }; });
  document.querySelectorAll('[data-dunpick]').forEach(function(b){ b.onclick=function(){ gpTap(); toggle(b.getAttribute('data-dunpick')); render(); }; });
  var sq=document.getElementById('schedQ');
  if(sq){
    sq.oninput=function(){
      S.schedQ=sq.value; var q=sq.value.trim().toLowerCase();
      document.querySelectorAll('#schedSheet [data-dpick]').forEach(function(b){ b.style.display = !q || b.getAttribute('data-dpick').toLowerCase().indexOf(q)>-1 ? '' : 'none'; });
      document.querySelectorAll('#schedSheet .schedGroupLabel').forEach(function(l){ var box=l.nextElementSibling; l.style.display = box && [].some.call(box.children, function(c){ return c.style.display!=='none'; }) ? '' : 'none'; });
    };
    sq.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var b=document.getElementById('schedAddName'); if(b) b.click(); } };
  }
  var an=document.getElementById('schedAddName');
  if(an) an.onclick=function(){
    var n=String(S.schedQ||'').replace(/\s+/g,' ').trim().slice(0,40);
    if(!n) return;
    var l=schedCellNames_(s, S.schedPick); if(l.indexOf(n)===-1) l.push(n);
    var g=(d.people||[]).filter(function(x){ return x.id==='extras'; })[0];
    if(!g){ g={ id:'extras', label:'Added before', names:[] }; d.people=(d.people||[]).concat([g]); }
    if(!(d.people||[]).some(function(x){ return x.names.indexOf(n)>-1; })) g.names.unshift(n);
    S.schedQ=''; mark(); render();
  };
  // rows and places
  var rb=document.getElementById('schedRowsBtn'); if(rb) rb.onclick=function(){ gpTap(); S.schedRows=!S.schedRows; render(); };
  var rid=function(p){ return p+Date.now().toString(36).slice(-4)+Math.random().toString(36).slice(2,4); };
  var move=function(list, i, n){ var j=i+n; if(j<0 || j>=list.length) return; var x=list[i]; list[i]=list[j]; list[j]=x; mark(); render(); };
  document.querySelectorAll('[data-srow]').forEach(function(inp){ inp.oninput=function(){ s.rows[Number(inp.getAttribute('data-srow'))][inp.getAttribute('data-sf')]=inp.value; mark(); }; });
  document.querySelectorAll('[data-srowspan]').forEach(function(inp){ inp.onchange=function(){ s.rows[Number(inp.getAttribute('data-srowspan'))].span=inp.checked; mark(); render(); }; });
  document.querySelectorAll('[data-srowoff]').forEach(function(b){ b.onclick=function(){ var p=b.getAttribute('data-srowoff').split('|'), r=s.rows[Number(p[0])]; r.off=r.off||[]; var i=r.off.indexOf(p[1]); if(i>-1) r.off.splice(i,1); else r.off.push(p[1]); mark(); render(); }; });
  document.querySelectorAll('[data-sday]').forEach(function(b){ b.onclick=function(){ var dd=b.getAttribute('data-sday'), i=s.days.indexOf(dd);
    if(i>-1){ if(s.days.length<2) return; s.days.splice(i,1); } else { s.days.push(dd); s.days.sort(function(a,c){ return DUTY_DAY_ORDER_.indexOf(a)-DUTY_DAY_ORDER_.indexOf(c); }); } mark(); render(); }; });
  document.querySelectorAll('[data-srowup]').forEach(function(b){ b.onclick=function(){ move(s.rows, Number(b.getAttribute('data-srowup')), -1); }; });
  document.querySelectorAll('[data-srowdown]').forEach(function(b){ b.onclick=function(){ move(s.rows, Number(b.getAttribute('data-srowdown')), 1); }; });
  document.querySelectorAll('[data-srowdel]').forEach(function(b){ b.onclick=function(){ var i=Number(b.getAttribute('data-srowdel')); if(!confirm(gpT('Remove “{name}”?',{name:s.rows[i].label}))) return; s.rows.splice(i,1); mark(); render(); }; });
  var ra=document.getElementById('schedRowAdd'); if(ra) ra.onclick=function(){ s.rows.push({ id:rid('r'), label:t('New row'), km:'', time:'', span:false, off:[] }); mark(); render(); };
  var at=function(v){ var p=v.split('|'); return { sec:s.sections[Number(p[0])], i:Number(p[1]) }; };
  document.querySelectorAll('[data-ssec]').forEach(function(inp){ inp.oninput=function(){ s.sections[Number(inp.getAttribute('data-ssec'))][inp.getAttribute('data-sf')]=inp.value; mark(); }; });
  document.querySelectorAll('[data-splace]').forEach(function(inp){ inp.oninput=function(){ var x=at(inp.getAttribute('data-splace')); x.sec.rows[x.i][inp.getAttribute('data-sf')]=inp.value; mark(); }; });
  document.querySelectorAll('[data-splaceup]').forEach(function(b){ b.onclick=function(){ var x=at(b.getAttribute('data-splaceup')); move(x.sec.rows, x.i, -1); }; });
  document.querySelectorAll('[data-splacedown]').forEach(function(b){ b.onclick=function(){ var x=at(b.getAttribute('data-splacedown')); move(x.sec.rows, x.i, 1); }; });
  document.querySelectorAll('[data-splacedel]').forEach(function(b){ b.onclick=function(){ var x=at(b.getAttribute('data-splacedel')); if(!confirm(gpT('Remove “{name}”?',{name:x.sec.rows[x.i].place}))) return; x.sec.rows.splice(x.i,1); mark(); render(); }; });
  document.querySelectorAll('[data-splaceadd]').forEach(function(b){ b.onclick=function(){ s.sections[Number(b.getAttribute('data-splaceadd'))].rows.push({ id:rid('c'), place:t('New place'), km:'', duty:'', people:[] }); mark(); render(); }; });
  var sa=document.getElementById('schedSecAdd'); if(sa) sa.onclick=function(){ s.sections.push({ id:rid('s'), title:t('New section'), km:'', rows:[] }); mark(); render(); };
  // save
  var save=function(action, btn, msg){
    if(S.busy) return;
    S.busy=true; if(btn) btn.disabled=true;
    run('saveDuty',[S.auth.user,S.auth.pin,s.kind,s.week,s,action],function(r){
      S.busy=false;
      if(r && r.ok){ r.key=d.key; S.schedData=r; S.schedDirty=false; S.sched=null; showMsg(msg); }
      else showMsg(r && r.err==='not_authorized' ? t('Only this ministry’s team can change it.') : t('Could not save'));
      render();
    });
  };
  var sv=document.getElementById('schedSave'); if(sv) sv.onclick=function(){ save('save', sv, t('Saved')); };
  var pb=document.getElementById('schedPub'); if(pb) pb.onclick=function(){ save('publish', pb, t('Published — everyone can see it now')); };
  var up=document.getElementById('schedUnpub'); if(up) up.onclick=function(){ if(!confirm(t('Take this schedule down? Only your team will see it until you publish it again.'))) return; save('unpublish', up, t('Taken down')); };
}
var DUTY_DAY_ORDER_=['sun','mon','tue','wed','thu','fri','sat'];
function schedOpen_(kind, edit, from){
  S.schedKind=kind; S.schedEdit=!!edit; S.schedFrom=from||'home'; S.schedWeek=null; S.schedPick=null; S.schedRows=false; S.schedDirty=false; S.schedData=null;
  S.view='sched'; render();
}
/* On My Ministry, for the ministry that makes one: the way in. */
function schedMinistryHtml_(dept, min){
  var k=SCHED_KINDS.filter(function(x){ return x[3]===dept && x[4]===min; })[0];
  if(!k || !canLogForClient_(dept, min)) return '';
  return '<div class="card" id="schedMinistry"><p class="sub" style="margin:0 0 10px">'+k[1]+' '+esc(gpT('Your team makes the {name} each week. Once you publish it, everyone sees it on My Home.',{name:t(k[2]).toLowerCase()}))+'</p>'+
    '<button class="btn" id="goSchedEdit" data-schedkind-edit="'+k[0]+'" style="margin-top:0">🗓️ '+esc(gpT('Make the {name}',{name:t(k[2]).toLowerCase()}))+'</button></div>';
}
/* The page-side mirror of canLogFor_: who may make a ministry's schedule. */
function canLogForClient_(dept, min){
  var m=S.me; if(!m) return false;
  if(m.isAdmin) return true;
  var key=dept+'|'+min;
  return (m.dept===dept && m.ministry===min) || (m.ministries||[]).indexOf(key)>-1 || (m.leads||[]).indexOf(key)>-1 || (m.dept==='Campus Leadership' && m.ministry===dept);
}

/* ---------- Campus Leadership on My Ministry ----------
   Campus Leadership doesn't log weekly numbers (they're hidden for now), so
   its section of My Ministry is two things: its OKRs as the dashboard — this
   quarter's Campus Leadership objectives, how far along, each key result —
   and the board for the Monday leadership meeting: agenda items and projects
   in columns (Agenda / In progress / Done to start), each with a focus area
   (Siem Reap finances, Siem Reap ministries, Construction to start), an
   owner, a due date and the Leadership OKR it moves forward, under the
   agenda items every Monday has (Department and ministry updates, Events
   coming up). Columns, focus areas and standing items are all theirs to
   change — "Edit the board" (getLeadBoard / saveLeadCard / saveLeadSettings
   in api.js). Each card holds a checklist of tasks (saveLeadTask /
   deleteLeadTask), and a third tab keeps the notes of each Monday's meeting
   (saveLeadNote), where any line can be put on the board as a card or a task.
   An objective shows how many of its cards are done; a card shows its
   objective's progress. Progress is edited where it always was, on the OKRs
   tab. On a computer the board's columns sit side by side; on a phone one
   column shows at a time, picked by tabs. */
function leadCols_(){ return (S.lead && S.lead.cols) || []; }
function leadDoneId_(){ var d=leadCols_().filter(function(c){ return c.done; })[0]; return d ? d.id : ''; }
function leadAreaName_(id){ var a=((S.lead && S.lead.areas) || []).filter(function(x){ return x.id===id; })[0]; return a ? a.title : ''; }
function leadQNow_(){ return Math.min(4, Math.floor((thisWeek()-1)/13)+1); }
function leadOkrs_(){
  var q=leadQNow_();
  return ((S.base && S.base.okrs) || []).filter(function(o){ return o.campus===S.me.campus && Number(o.quarter)===q && o.dept==='Campus Leadership'; });
}
function leadNextMonday_(){ var d=new Date(); d.setHours(12,0,0,0); var add=(8-d.getDay())%7; d.setDate(d.getDate()+add); return calIso_(d); }
function leadSectionHtml_(){
  /* OKRs are their own tab now (beside My department, Board, My week, Finances) — the board
     keeps the meeting board, Tuesday and the notes */
  var tab=S.leadTab==='notes' || S.leadTab==='tues' ? S.leadTab : 'board';
  var h='<div class="leadFilters leadTabs" role="tablist">'+
    '<button class="leadSeg'+(tab==='board'?' on':'')+'" role="tab" data-leadtab="board" title="'+esc(t('Monday meetings'))+'">🗂️ '+esc(t('Board'))+'</button>'+
    '<button class="leadSeg'+(tab==='tues'?' on':'')+'" role="tab" data-leadtab="tues" title="'+esc(t('Tuesday morning meeting'))+'">🎤 '+esc(t('Tuesday'))+'</button>'+
    '<button class="leadSeg'+(tab==='notes'?' on':'')+'" role="tab" data-leadtab="notes" title="'+esc(t('Meeting notes'))+'">📝 '+esc(t('Notes'))+'</button></div>';
  return h+(tab==='notes' ? leadNotesHtml_() : tab==='tues' ? leadTuesHtml_() : leadBoardHtml_());
}
function leadCardsFor_(okrId){ return ((S.lead && S.lead.cards) || []).filter(function(c){ return c.okrId===okrId; }); }
function leadOkrDashHtml_(){
  var R=baseR(), objs=leadOkrs_(), q=leadQNow_(), wk=thisWeek(), wq=Math.max(1, Math.min(13, wk-(q-1)*13));
  var h='<div id="leadOkrs">';
  if(!objs.length) return h+'<div class="card"><p class="sub" style="margin:0 0 10px">'+esc(gpT('No Campus Leadership OKRs for Q{q} yet.',{q:q}))+'</p>'+
    '<button class="btn" id="leadGoOkr" style="margin-top:0">🎯 '+esc(t('Set this quarter’s OKRs'))+'</button></div></div>';
  var avg=Math.round(objs.reduce(function(a,o){ return a+R.objProgress(o); },0)/objs.length);
  var krs=0, krsOn=0; objs.forEach(function(o){ (o.krs||[]).forEach(function(kr){ krs++; if(R.krProgress(o,kr).pct>=Math.round(wq/13*100)) krsOn++; }); });
  h+='<div class="mmGrid leadTiles">'+
    '<div class="mmTile"><div class="mmTileName">'+esc(gpT('Q{q} progress',{q:q}))+'</div><div class="mmTileNum">'+avg+'%</div><div class="mmTileSub">'+esc(gpT('Week {n} of 13',{n:wq}))+'</div></div>'+
    '<div class="mmTile"><div class="mmTileName">'+esc(t('Objectives'))+'</div><div class="mmTileNum">'+objs.length+'</div><div class="mmTileSub">'+esc(gpT('{n} key results',{n:krs}))+'</div></div>'+
    '<div class="mmTile"><div class="mmTileName">'+esc(t('Key results on pace'))+'</div><div class="mmTileNum">'+krsOn+'/'+krs+'</div><div class="mmTileSub">'+esc(t('at or ahead of the quarter so far'))+'</div></div>'+
    '<div class="mmTile"><div class="mmTileName">'+esc(t('Meeting board'))+'</div><div class="mmTileNum">'+(S.lead ? S.lead.cards.filter(function(c){ return c.col!==leadDoneId_(); }).length : '—')+'</div><div class="mmTileSub">'+esc(t('open agenda items and projects'))+'</div></div>'+
  '</div>';
  h+='<div class="leadPace"><div class="leadPaceFill" style="width:'+Math.round(wq/13*100)+'%"></div></div>';
  objs.forEach(function(o, i){
    var p=R.objProgress(o), cards=leadCardsFor_(o.id), done=cards.filter(function(c){ return c.col===leadDoneId_(); }).length;
    h+='<div class="card slim leadObj" data-leadobj="'+esc(o.id)+'"><div class="teamHead"><div style="min-width:0"><div class="rowName"><b>'+(i+1)+'. '+esc(o.objective)+'</b></div></div>'+
      '<b class="leadPct" style="color:'+gpRingColor(p)+'">'+p+'%</b></div>'+
      '<div class="leadBar"><div style="width:'+p+'%;background:'+gpRingColor(p)+'"></div></div>';
    (o.krs||[]).forEach(function(kr){
      var kp=R.krProgress(o,kr);
      h+='<div class="leadKr"><span class="leadKrText">'+esc(kr.text)+'</span><span class="leadKrPct">'+kp.pct+'%</span></div>';
    });
    if(cards.length) h+='<button class="linkbtn inline leadObjCards" data-leadobjcards="'+esc(o.id)+'">🗂️ '+esc(gpT('{d} of {n} meeting cards done',{d:done,n:cards.length}))+'</button>';
    h+='</div>';
  });
  h+='<button class="btn ghost" id="leadGoOkr">🎯 '+esc(t('Update progress or change the OKRs'))+'</button>';
  return h+'</div>';
}
function leadOwnerOptions_(){
  var list=(S.roster||[]).filter(function(p){ return p.campus===S.me.campus && p.dept==='Campus Leadership'; });
  if(!list.some(function(p){ return p.id===S.me.id; })) list.push(S.me);
  return list.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
}
/* The little tasks inside a card — a checklist anyone in the meeting can
   tick. On the board a card shows how many are done and opens to the list;
   the card's edit form also gives each one an owner and a due date. */
function leadTasks_(c){ return (c && Array.isArray(c.tasks)) ? c.tasks : []; }
function leadTaskRowHtml_(cid, tk, full){
  var late=tk.due && !tk.done && tk.due<todayStr(), key=esc(cid)+'|'+esc(tk.id);
  var h='<div class="leadTask'+(tk.done?' done':'')+'"><label class="leadTaskTick"><input type="checkbox" data-ltick="'+key+'"'+(tk.done?' checked':'')+'> <span>'+esc(tk.text)+'</span></label>';
  if(full){
    h+='<div class="leadTaskMeta"><select data-ltowner="'+key+'" aria-label="'+esc(t('Who owns it'))+'"><option value="">'+esc(t('— nobody yet —'))+'</option>'+
      leadOwnerOptions_().map(function(p){ return '<option value="'+esc(p.id)+'"'+(tk.owner===p.id?' selected':'')+'>'+esc(p.name)+'</option>'; }).join('')+'</select>'+
      '<input type="date" data-ltdue="'+key+'" value="'+esc(tk.due||'')+'" aria-label="'+esc(t('Due'))+'">'+
      '<button class="linkbtn inline teamDelete" data-ltdel="'+key+'" aria-label="'+esc(t('Remove'))+'">✕</button></div>';
  } else if(tk.owner || tk.due){
    h+='<div class="leadTaskSub">'+(tk.owner?'👤 '+esc(String(nameOf(tk.owner)).split(' ')[0]):'')+(tk.owner&&tk.due?' · ':'')+(tk.due?'<span class="leadDue'+(late?' late':'')+'">📅 '+esc(hospDate_(tk.due))+'</span>':'')+'</div>';
  }
  return h+'</div>';
}
function leadTaskAddHtml_(cid){
  return '<div class="leadTaskAdd"><input type="text" data-ltnew="'+esc(cid)+'" maxlength="200" placeholder="'+esc(t('Add a task…'))+'" aria-label="'+esc(t('Add a task…'))+'">'+
    '<button class="btn small" data-ltadd="'+esc(cid)+'" aria-label="'+esc(t('Add a task'))+'">＋</button></div>';
}
/* A card on the board is small on purpose: its title, then one line —
   who owns it, when it's due, how many tasks are done — and a thin line
   along the bottom for its OKR's progress. Everything else is in the sheet
   that opens when it's tapped. Hold it (or on a computer just drag it) to
   move it to another column. */
function leadCardHtml_(c, R, objs){
  var o=c.okrId && ((S.base && S.base.okrs) || []).filter(function(x){ return x.id===c.okrId; })[0];
  var late=c.due && c.col!==leadDoneId_() && c.due<todayStr();
  var tasks=leadTasks_(c), td=tasks.filter(function(x){ return x.done; }).length;
  var meta=[];
  if(c.owner) meta.push('<span class="leadWho" title="'+esc(nameOf(c.owner))+'">'+esc(initials(nameOf(c.owner)))+'</span>');
  if(c.due) meta.push('<span class="leadDue'+(late?' late':'')+'">'+esc(hospDate_(c.due))+'</span>');
  if(tasks.length) meta.push('<span class="leadTaskCount'+(td===tasks.length?' all':'')+'">☑ '+td+'/'+tasks.length+'</span>');
  var h='<div class="leadCard '+esc(c.type)+'" data-leadcard="'+esc(c.id)+'" role="button" tabindex="0" aria-label="'+esc(c.title)+'">';
  h+='<div class="leadTitle">'+esc(c.title)+'</div>';
  if(meta.length) h+='<div class="leadMeta">'+meta.join('')+'</div>';
  if(o){ var p=R.objProgress(o); h+='<div class="leadOkrLine" title="'+esc(o.objective+' · '+p+'%')+'"><span style="width:'+p+'%;background:'+gpRingColor(p)+'"></span></div>'; }
  return h+'</div>';
}
function leadBoardHtml_(){
  var h='<div id="leadBoard">';
  if(!S.lead){ return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.leadErr || t('Loading…'))+'</p></div></div>'; }
  var R=baseR(), objs=leadOkrs_(), filter=S.leadFilter||'all', today=todayStr();
  var nm=leadNextMonday_();
  h+='<div class="leadHead"><div class="leadNext"><span class="leadNextLabel">'+esc(t('Next meeting'))+'</span> <b>'+esc(gpT('Monday {date}',{date:hospDate_(nm)}))+'</b></div>'+
    '<div class="leadHeadBtns"><button class="leadIconBtn" id="leadEditBoard" aria-label="'+esc(t('Edit the board'))+'" title="'+esc(t('Edit the board'))+'">✏️</button>'+
    '<button class="btn small" id="leadNew">＋ '+esc(t('Card'))+'</button></div></div>';
  if(S.lead.standing.length) h+='<div class="leadStanding" id="leadStanding"><span class="leadNextLabel">'+esc(t('Every Monday'))+'</span> '+S.lead.standing.map(function(x){ return '<span class="leadStandItem">'+esc(x.title)+'</span>'; }).join('<span class="leadDot">·</span>')+'</div>';
  /* Which cards to show: everything, one kind, or only mine (cards I own
     or have an open task on). */
  h+='<div class="leadFilters" role="group" aria-label="'+esc(t('Show'))+'">'+
    [['all',t('All')],['agenda','💬 '+t('Agenda')],['project','🔨 '+t('Projects')],['mine','👤 '+t('Mine')]].map(function(f){
      return '<button class="leadSeg'+(filter===f[0]?' on':'')+'" data-leadfilter="'+esc(f[0])+'">'+esc(f[1])+'</button>'; }).join('')+'</div>';
  if(S.leadEdit) h+=leadSettingsHtml_();
  var mine=function(c){ return c.owner===S.me.id || leadTasks_(c).some(function(x){ return !x.done && x.owner===S.me.id; }); };
  var cards=S.lead.cards.filter(function(c){ return filter==='all' || (filter==='mine' ? mine(c) : c.type===filter); });
  var cutoff=calIso_(new Date(Date.now()-30*86400000));
  /* The columns side by side, narrow enough that three fit on a phone;
     a board with more scrolls across a little. */
  var lists=leadCols_().map(function(col){
    var list=cards.filter(function(c){ return c.col===col.id; });
    var hidden=0;
    if(col.done){ var recent=list.filter(function(c){ return S.leadOld || !c.doneAt || c.doneAt.slice(0,10)>=cutoff; }); hidden=list.length-recent.length; list=recent; }
    list.sort(function(a,b){ return col.done ? String(b.doneAt||'').localeCompare(String(a.doneAt||'')) : String(a.due||'9999').localeCompare(String(b.due||'9999')); });
    return { list:list, hidden:hidden };
  });
  h+='<div class="leadCols" style="--leadN:'+leadCols_().length+'">'+leadCols_().map(function(col, ci){
    var list=lists[ci].list, hidden=lists[ci].hidden;
    return '<div class="leadCol" data-leadcol="'+esc(col.id)+'"><div class="leadColHead"><span>'+esc(col.title)+'</span><span class="leadColN">'+list.length+'</span></div>'+
      list.map(function(c){ return leadCardHtml_(c, R, objs); }).join('')+
      (!list.length?'<p class="hint leadEmpty">'+esc(t('Nothing here yet.'))+'</p>':'')+
      (hidden?'<button class="linkbtn inline" id="leadOld">'+esc(gpT('Show {n} older',{n:hidden}))+'</button>':'')+
    '</div>';
  }).join('')+'</div>';
  h+='<p class="hint leadDragHint">'+esc(t('Tap a card to open it. Hold and drag it to move it.'))+'</p>';
  if(S.leadForm) h+=leadFormHtml_(objs);
  return h+'</div>';
}
/* Meeting notes, one page per Monday. Any line can be turned into an agenda
   item, a project or a task on a card — that card or task remembers the
   meeting it came from, and the line shows it's on the board. */
function leadMonday_(){ var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return calIso_(d); }
function leadAddDays_(iso, n){ var d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return calIso_(d); }
function leadNoteFor_(date){ return ((S.lead && S.lead.notes) || []).filter(function(n){ return n.date===date; })[0]; }
function leadDraft_(date){
  S.leadDrafts=S.leadDrafts||{};
  var n=leadNoteFor_(date), d=S.leadDrafts[date];
  if(!d || !d.dirty) d=S.leadDrafts[date]={ text:n ? n.text : '', since:n ? n.updated : '', dirty:false };
  return d;
}
function leadLine_(x){ return String(x||'').replace(/^\s*(?:[-*•#>]+|\d+[.)]|\[[ xX]?\])\s*/, '').replace(/^\[[ xX]?\]\s*/, '').trim(); }
function leadNoteLinesHtml_(date, text){
  var standing=(S.lead.standing||[]).map(function(x){ return x.title.toLowerCase(); }), seen={}, lines=[];
  String(text||'').split('\n').forEach(function(raw){ var l=leadLine_(raw); var k=l.toLowerCase(); if(l && !seen[k] && standing.indexOf(k.replace(/:$/,''))===-1){ seen[k]=1; lines.push(l); } });
  S.leadLines=lines;
  if(!lines.length) return '<p class="hint" style="margin:0">'+esc(t('Write a line in the notes — each one can become an agenda item, a project or a task.'))+'</p>';
  var openCards=S.lead.cards.filter(function(c){ return c.col!==leadDoneId_(); });
  return lines.map(function(l, i){
    var k=l.toLowerCase(), card=S.lead.cards.filter(function(c){ return c.title.toLowerCase()===k; })[0], onCard=null;
    if(!card) S.lead.cards.some(function(c){ return leadTasks_(c).some(function(tk){ if(tk.text.toLowerCase()===k){ onCard=c; return true; } }); });
    var h='<div class="leadLine" data-lnline="'+i+'"><div class="leadLineText">'+esc(l)+'</div>';
    if(card) h+='<div class="leadLineDone">✓ '+esc(gpT('On the board — {col}',{col:(leadCols_().filter(function(x){ return x.id===card.col; })[0]||{}).title||''}))+'</div>';
    else if(onCard) h+='<div class="leadLineDone">✓ '+esc(gpT('Task on “{card}”',{card:onCard.title}))+'</div>';
    else if(S.leadNoteTask===l) h+='<div class="leadLineTask"><select id="leadLnCard" aria-label="'+esc(t('Which card?'))+'">'+
      openCards.map(function(c){ return '<option value="'+esc(c.id)+'">'+esc(c.title)+'</option>'; }).join('')+'</select>'+
      '<button class="btn small" data-lntaskgo="'+i+'"'+(openCards.length?'':' disabled')+'>'+esc(t('Add task'))+'</button><button class="linkbtn inline" data-lntaskno="1">'+esc(t('Cancel'))+'</button></div>';
    else h+='<div class="leadLineBtns"><button class="hospChip" data-lnmake="agenda|'+i+'">＋ 💬 '+esc(t('Agenda item'))+'</button>'+
      '<button class="hospChip" data-lnmake="project|'+i+'">＋ 🔨 '+esc(t('Project'))+'</button>'+
      '<button class="hospChip" data-lntask="'+i+'">＋ ☑️ '+esc(t('Task'))+'</button></div>';
    return h+'</div>';
  }).join('');
}
/* The quarter's Leadership OKRs in one quiet line above the notes — tap it
   for each objective's progress. Closed unless opened. */
function leadNoteOkrHtml_(){
  var objs=leadOkrs_(); if(!objs.length) return '';
  var R=baseR(), q=leadQNow_(), wq=Math.max(1, Math.min(13, thisWeek()-(q-1)*13));
  var avg=Math.round(objs.reduce(function(a,o){ return a+R.objProgress(o); },0)/objs.length);
  var krs=0, on=0; objs.forEach(function(o){ (o.krs||[]).forEach(function(kr){ krs++; if(R.krProgress(o,kr).pct>=Math.round(wq/13*100)) on++; }); });
  return '<details class="leadNoteOkr" id="leadNoteOkr"'+(S.leadNoteOkrOpen?' open':'')+'><summary>🎯 '+esc(gpT('Q{q} OKRs',{q:q}))+' · <b>'+avg+'%</b>'+
    (krs?' <span class="leadNoteOkrSub">· '+esc(gpT('{d} of {n} key results on pace',{d:on,n:krs}))+'</span>':'')+'</summary>'+
    objs.map(function(o){ var p=R.objProgress(o);
      return '<div class="leadNoteOkrRow"><span class="leadNoteOkrName">'+esc(o.objective)+'</span><span class="leadNoteOkrBar"><span style="width:'+p+'%;background:'+gpRingColor(p)+'"></span></span><b>'+p+'%</b></div>'; }).join('')+
  '</details>';
}
function leadNotesHtml_(){
  var h='<div id="leadNotes">';
  if(!S.lead) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.leadErr || t('Loading…'))+'</p></div></div>';
  var thisMon=leadMonday_(), date=/^\d{4}-\d{2}-\d{2}$/.test(S.leadNoteDate||'') ? S.leadNoteDate : thisMon, d=leadDraft_(date), n=leadNoteFor_(date);
  var rel=date===thisMon ? t('This week’s meeting') : date===leadAddDays_(thisMon,-7) ? t('Last week') : date===leadAddDays_(thisMon,7) ? t('Next week') : '';
  h+='<div class="leadNoteWeek"><button class="btn ghost small" data-lnweek="-7" aria-label="'+esc(t('Earlier'))+'">‹</button>'+
    '<div class="leadNoteDate"><b>'+esc(gpT('Monday {date}',{date:hospDate_(date)}))+'</b>'+(rel?'<div class="rowSub">'+esc(rel)+'</div>':'')+'</div>'+
    '<button class="btn ghost small" data-lnweek="7" aria-label="'+esc(t('Later'))+'">›</button></div>';
  var past=((S.lead.notes)||[]).map(function(x){ return x.date; }).filter(function(x){ return x!==date; }).slice(-8).reverse();
  if(past.length) h+='<div class="chips leadNotePast"><span class="leadFilterLabel">'+esc(t('Earlier notes'))+'</span>'+past.map(function(x){ return '<button class="hospChip" data-lndate="'+esc(x)+'">'+esc(hospDate_(x))+'</button>'; }).join('')+'</div>';
  h+=leadNoteOkrHtml_();
  h+='<div class="leadNoteGrid"><div class="card leadNoteCard">';
  if(!d.text) h+='<button class="btn ghost small" id="leadNoteStart">📋 '+esc(t('Start from the agenda'))+'</button>';
  h+='<textarea id="leadNoteText" rows="14" maxlength="8000" placeholder="'+esc(t('What came up, what was decided, who is doing what… One thing per line.'))+'">'+esc(d.text)+'</textarea>'+
    '<div class="leadNoteFoot"><span class="hint" id="leadNoteState">'+esc(d.dirty ? t('Not saved yet') : n ? gpT('Saved by {name}',{name:nameOf(n.updatedBy)}) : '')+'</span>'+
    '<button class="btn small" id="leadNoteSave">'+esc(t('Save notes'))+'</button></div></div>';
  h+='<div class="card leadNoteCard"><h4 style="margin:0 0 4px">'+esc(t('Put it on the board'))+'</h4><p class="hint" style="margin:0 0 8px">'+esc(t('Turn a line into an agenda item, a project, or a task on a card.'))+'</p>'+
    '<div id="leadNoteLines">'+leadNoteLinesHtml_(date, d.text)+'</div>';
  var made=[]; S.lead.cards.forEach(function(c){ if(c.meeting===date && c.fromNotes) made.push((c.type==='project'?'🔨 ':'💬 ')+c.title); leadTasks_(c).forEach(function(tk){ if(tk.meeting===date) made.push('☑️ '+tk.text+' — '+c.title); }); });
  if(made.length) h+='<h4 style="margin:14px 0 4px">'+esc(t('From this meeting'))+'</h4>'+made.map(function(x){ return '<div class="leadMade">'+esc(x)+'</div>'; }).join('');
  return h+'</div></div></div>';
}
/* Edit the board: its columns (and which one is finished), focus areas and
   the agenda items every Monday has. */
function leadSettingsHtml_(){
  var e=S.leadEdit;
  var list=function(key, label, addLabel, withDone){
    var h='<h4 style="margin:12px 0 4px">'+esc(label)+'</h4>';
    e[key].forEach(function(x, i){
      h+='<div class="leadSetRow"><input type="text" data-lset="'+key+'|'+i+'" value="'+esc(x.title)+'" maxlength="80" aria-label="'+esc(label)+'">'+
        (withDone ? '<label class="hospCheck leadDonePick"><input type="radio" name="leadDone" data-ldone="'+i+'"'+(x.done?' checked':'')+'> '+esc(t('Finished'))+'</label>' : '')+
        '<button class="linkbtn inline" data-lsetup="'+key+'|'+i+'" aria-label="'+esc(t('Move up'))+'">↑</button>'+
        '<button class="linkbtn inline teamDelete" data-lsetdel="'+key+'|'+i+'" aria-label="'+esc(t('Remove'))+'">✕</button></div>';
    });
    return h+'<button class="btn ghost small leadSetAdd" data-lsetadd="'+key+'">＋ '+esc(addLabel)+'</button>';
  };
  return '<div class="card" id="leadSettings"><h3 style="margin-top:0">✏️ '+esc(t('Edit the board'))+'</h3>'+
    list('cols', t('Columns'), t('Add a column'), true)+
    list('areas', t('Focus areas'), t('Add a focus area'), false)+
    list('standing', t('Every Monday’s agenda'), t('Add an agenda item'), false)+
    '<p class="hint">'+esc(t('Cards in a column you take away move to the first column. “Finished” is the column that counts as done.'))+'</p>'+
    '<button class="btn" id="leadSetSave">'+esc(t('Save the board'))+'</button><button class="btn ghost" id="leadSetCancel">'+esc(t('Cancel'))+'</button></div>';
}
function leadFormHtml_(objs){
  var f=S.leadForm, isNew=!f.id;
  var h='<div class="scrim" id="leadScrim"></div><div class="schedSheet leadSheet" id="leadForm" role="dialog" aria-label="'+esc(isNew?t('New card'):f.title)+'">'+
    '<div class="schedSheetHead"><h3 style="margin:0">'+esc(isNew?t('New card'):t('Card'))+'</h3><button class="leadIconBtn" id="leadClose" aria-label="'+esc(t('Close'))+'">✕</button></div>';
  h+='<div class="chips hospChips">'+[['agenda','💬','Agenda item'],['project','🔨','Project']].map(function(x){
    return '<button class="hospChip'+(f.type===x[0]?' on':'')+'" data-lftype="'+x[0]+'">'+x[1]+' '+esc(t(x[2]))+'</button>'; }).join('')+'</div>';
  h+='<label class="f">'+esc(t('Title'))+'</label><input type="text" data-lf="title" maxlength="160" value="'+esc(f.title||'')+'" placeholder="'+esc(t('e.g. Staff retreat plan'))+'">';
  h+='<div class="teamGrid2"><div><label class="f">'+esc(t('Who owns it'))+'</label><select data-lf="owner"><option value="">'+esc(t('— nobody yet —'))+'</option>'+
    leadOwnerOptions_().map(function(p){ return '<option value="'+esc(p.id)+'"'+(f.owner===p.id?' selected':'')+'>'+esc(p.name)+'</option>'; }).join('')+'</select></div>'+
    '<div><label class="f">'+esc(t('Due'))+'</label><input type="date" data-lf="due" value="'+esc(f.due||'')+'"></div></div>';
  h+='<label class="f">'+esc(t('Column'))+'</label><div class="leadFilters leadColPick">'+leadCols_().map(function(c){ return '<button class="leadSeg'+(f.col===c.id?' on':'')+'" data-lfcol="'+esc(c.id)+'">'+esc(c.title)+'</button>'; }).join('')+'</div>';
  h+='<div class="teamGrid2"><div><label class="f">'+esc(t('Focus area'))+'</label><select data-lf="area"><option value="">'+esc(t('— none —'))+'</option>'+(S.lead.areas||[]).map(function(a){ return '<option value="'+esc(a.id)+'"'+(f.area===a.id?' selected':'')+'>'+esc(a.title)+'</option>'; }).join('')+'</select></div>';
  var known=objs.some(function(o){ return o.id===f.okrId; });
  h+='<div><label class="f">'+esc(t('Moves forward which OKR?'))+'</label><select data-lf="okrId"><option value="">'+esc(t('— none —'))+'</option>'+
    objs.map(function(o){ return '<option value="'+esc(o.id)+'"'+(f.okrId===o.id?' selected':'')+'>'+esc(o.objective)+'</option>'; }).join('')+
    (f.okrId && !known ? '<option value="'+esc(f.okrId)+'" selected>'+esc(t('An earlier quarter’s objective'))+'</option>' : '')+'</select></div></div>';
  h+='<label class="f">'+esc(t('Notes'))+'</label><textarea data-lf="notes" rows="3" maxlength="2000" placeholder="'+esc(t('What to decide, next steps, who to ask…'))+'">'+esc(f.notes||'')+'</textarea>';
  /* an existing card's tasks save as they change; a new card's go with it */
  var cur=isNew ? null : S.lead.cards.filter(function(c){ return c.id===f.id; })[0], tasks=isNew ? (f.tasks||[]) : leadTasks_(cur);
  h+='<label class="f">'+esc(t('Tasks'))+'</label><div class="leadTasks inForm" id="leadFormTasks">'+tasks.map(function(tk){ return leadTaskRowHtml_(f.id||'', tk, true); }).join('')+leadTaskAddHtml_(f.id||'')+'</div>';
  h+='<button class="btn" id="leadSave">'+esc(isNew?t('Add card'):t('Save card'))+'</button><button class="btn ghost" id="leadCancel">'+esc(t('Cancel'))+'</button>';
  if(!isNew) h+='<button class="linkbtn teamDelete" id="leadDelete">'+esc(t('Delete this card'))+'</button>';
  return h+'</div>';
}
/* Moving a card: on a phone, hold it for a moment until it lifts, then drag
   it over another column and let go; with a mouse, just drag it. A short
   tap opens it. While a card is held the board scrolls sideways if the
   finger nears its edge. */
function leadDrag_(onTap, onDrop){
  var board=document.querySelector('#leadBoard .leadCols'); if(!board) return;
  var HOLD=320, d=null;
  var colAt=function(x, y){ var el=document.elementFromPoint(x, y); return el && el.closest ? el.closest('[data-leadcol]') : null; };
  var mark=function(col){ board.querySelectorAll('.leadCol.drop').forEach(function(c){ if(c!==col) c.classList.remove('drop'); }); if(col) col.classList.add('drop'); };
  var lift=function(){
    if(!d || d.ghost) return;
    var r=d.el.getBoundingClientRect();
    d.ghost=d.el.cloneNode(true); d.ghost.classList.add('leadGhost'); d.ghost.removeAttribute('data-leadcard');
    d.ghost.style.width=r.width+'px'; d.dx=d.x-r.left; d.dy=d.y-r.top;
    document.body.appendChild(d.ghost); d.el.classList.add('lifted');
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
    move(d.x, d.y);
  };
  var move=function(x, y){
    if(!d || !d.ghost) return;
    d.x=x; d.y=y;
    d.ghost.style.transform='translate('+(x-d.dx)+'px,'+(y-d.dy)+'px) rotate(2deg)';
    mark(colAt(x, y));
    var br=board.getBoundingClientRect();
    d.edge = x<br.left+36 ? -1 : x>br.right-36 ? 1 : 0;
    if(d.edge && !d.timer) d.timer=setInterval(function(){ if(!d || !d.edge){ return; } board.scrollLeft+=d.edge*12; mark(colAt(d.x, d.y)); }, 30);
  };
  var end=function(cancel){
    if(!d) return;
    clearTimeout(d.hold); clearInterval(d.timer);
    var was=d; d=null;
    mark(null);
    if(was.ghost){ was.ghost.remove(); was.el.classList.remove('lifted');
      var col=!cancel && colAt(was.x, was.y); if(col) onDrop(was.id, col.getAttribute('data-leadcol'));
      return true; }
    return false;
  };
  board.querySelectorAll('[data-leadcard]').forEach(function(el){
    var id=el.getAttribute('data-leadcard');
    el.addEventListener('touchstart', function(e){
      if(e.touches.length!==1) return;
      var p=e.touches[0]; d={ el:el, id:id, x:p.clientX, y:p.clientY, sx:p.clientX, sy:p.clientY, touch:true };
      d.hold=setTimeout(lift, HOLD);
    }, { passive:true });
    el.addEventListener('touchmove', function(e){
      if(!d || d.el!==el) return;
      var p=e.touches[0];
      if(d.ghost){ e.preventDefault(); move(p.clientX, p.clientY); return; }
      if(Math.abs(p.clientX-d.sx)+Math.abs(p.clientY-d.sy)>10){ clearTimeout(d.hold); d=null; }   // a scroll, not a hold
    }, { passive:false });
    el.addEventListener('touchend', function(e){ if(!d || d.el!==el) return; var lifted=!!d.ghost; end(false); if(lifted) e.preventDefault(); else { e.preventDefault(); onTap(id); } });
    el.addEventListener('touchcancel', function(){ if(d && d.el===el) end(true); });
    el.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    el.addEventListener('mousedown', function(e){
      if(e.button!==0) return;
      e.preventDefault();
      d={ el:el, id:id, x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY };
      var mm=function(ev){ if(!d) return; if(!d.ghost && Math.abs(ev.clientX-d.sx)+Math.abs(ev.clientY-d.sy)>6){ d.x=ev.clientX; d.y=ev.clientY; lift(); } else move(ev.clientX, ev.clientY); };
      var mu=function(ev){ document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); if(!d) return; d.x=ev.clientX; d.y=ev.clientY; if(!end(false)) onTap(id); };
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
  });
}
function bindLead_(){
  document.querySelectorAll('[data-leadtab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.leadTab=b.getAttribute('data-leadtab'); render(); }; });
  document.querySelectorAll('#leadGoOkr').forEach(function(b){ b.onclick=function(){ gpTap(); S.mmTab='okr'; S.lwTab='okrs'; lwTabKeep_('okrs'); render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-leadobjcards]').forEach(function(b){ b.onclick=function(){ gpTap(); S.leadTab='board'; S.leadFilter='all'; render(); }; });
  if((document.getElementById('leadBoard') || document.getElementById('leadOkrs') || document.getElementById('leadNotes') || document.getElementById('leadTues') || document.getElementById('leadBase')) && !S.lead && !S.leadLoading && !S.leadErr){
    S.leadLoading=true;
    run('getLeadBoard',[S.auth.user,S.auth.pin],function(d){ S.leadLoading=false; if(d && d.ok) S.lead=d; else S.leadErr=(d && d.err==='not_authorized') ? t('The meeting board is for Campus Leadership.') : t('Could not load'); render(); },
      function(e){ S.leadLoading=false; S.leadErr=(e && e.message) || t('Connection problem — try again.'); render(); });
  }
  if(!S.lead) return;
  var save=function(card, msg, after){
    if(S.busy) return; S.busy=true;
    run('saveLeadCard',[S.auth.user,S.auth.pin,card],function(d){ S.busy=false; if(d && d.ok){ S.lead=d; if(after) after(d); if(msg) showMsg(msg); } else showMsg(d && d.err==='bad_card' ? t('Give the card a title first.') : t('Could not save')); render(); });
  };
  var saveTask=function(cid, task, msg, after){
    if(S.busy) return; S.busy=true;
    run('saveLeadTask',[S.auth.user,S.auth.pin,cid,task],function(d){ S.busy=false; if(d && d.ok){ S.lead=d; if(after) after(d); if(msg) showMsg(msg); } else showMsg(d && d.err==='too_many' ? t('That card has as many tasks as it can hold.') : t('Could not save')); render(); });
  };
  var find=function(id){ return S.lead.cards.filter(function(c){ return c.id===id; })[0]; };
  /* tasks — on the board and in the edit form. A new card (no id yet) keeps
     its tasks in the form until it is added. */
  var f=S.leadForm;
  var taskAt=function(v){ var p=v.split('|'), c=p[0] ? find(p[0]) : null, list=p[0] ? leadTasks_(c) : ((f && f.tasks) || []); return { cid:p[0], task:list.filter(function(x){ return x.id===p[1]; })[0] }; };
  var changeTask=function(v, patch){
    var x=taskAt(v); if(!x.task) return;
    if(!x.cid){ Object.assign(x.task, patch); render(); return; }
    saveTask(x.cid, Object.assign({}, x.task, patch));
  };
  document.querySelectorAll('[data-ltick]').forEach(function(b){ b.onchange=function(){ gpTap(); changeTask(b.getAttribute('data-ltick'), { done:b.checked }); }; });
  document.querySelectorAll('[data-ltowner]').forEach(function(b){ b.onchange=function(){ changeTask(b.getAttribute('data-ltowner'), { owner:b.value }); }; });
  document.querySelectorAll('[data-ltdue]').forEach(function(b){ b.onchange=function(){ changeTask(b.getAttribute('data-ltdue'), { due:b.value }); }; });
  document.querySelectorAll('[data-ltdel]').forEach(function(b){ b.onclick=function(){ var x=taskAt(b.getAttribute('data-ltdel')); if(!x.task) return; gpTap();
    if(!x.cid){ f.tasks=f.tasks.filter(function(y){ return y!==x.task; }); render(); return; }
    if(S.busy) return; S.busy=true;
    run('deleteLeadTask',[S.auth.user,S.auth.pin,x.cid,x.task.id],function(d){ S.busy=false; if(d && d.ok) S.lead=d; else showMsg(t('Could not save')); render(); }); }; });
  var addTask=function(cid){
    var inp=document.querySelector('[data-ltnew="'+cid+'"]'), text=inp ? inp.value.trim() : '';
    if(!text){ if(inp) inp.focus(); return; }
    gpTap();
    if(!cid){ f.tasks=(f.tasks||[]).concat([{ id:'new'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), text:text, done:false, owner:'', due:'' }]); render(); var el=document.querySelector('[data-ltnew=""]'); if(el) el.focus(); return; }
    saveTask(cid, { text:text }, '', function(){ setTimeout(function(){ var el=document.querySelector('[data-ltnew="'+cid+'"]'); if(el) el.focus(); }, 0); });
  };
  document.querySelectorAll('[data-ltadd]').forEach(function(b){ b.onclick=function(){ addTask(b.getAttribute('data-ltadd')); }; });
  document.querySelectorAll('[data-ltnew]').forEach(function(inp){ inp.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); addTask(inp.getAttribute('data-ltnew')); } }; });
  if(document.getElementById('leadNotes')) bindLeadNotes_(save, saveTask, find);
  if(!document.getElementById('leadBoard')) return;
  var nw=document.getElementById('leadNew'); if(nw) nw.onclick=function(){ gpTap(); S.leadForm={ id:'', type: S.leadFilter==='project' ? 'project' : 'agenda', col:(leadCols_()[0]||{}).id||'', area:'', title:'', owner:'', due:'', okrId:'', notes:'', meeting:leadNextMonday_(), tasks:[] }; render(); var el=document.querySelector('#leadForm [data-lf="title"]'); if(el) el.focus(); };
  document.querySelectorAll('[data-leadfilter]').forEach(function(b){ b.onclick=function(){ gpTap(); S.leadFilter=b.getAttribute('data-leadfilter'); render(); }; });
  var lo=document.getElementById('leadOld'); if(lo) lo.onclick=function(){ S.leadOld=true; render(); };
  var openCard=function(id){ var c=find(id); if(!c) return; gpTap(); S.leadForm=JSON.parse(JSON.stringify(c)); render(); };
  document.querySelectorAll('[data-leadcard]').forEach(function(el){ el.onkeydown=function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openCard(el.getAttribute('data-leadcard')); } }; });
  leadDrag_(openCard, function(id, to){
    var c=find(id), col=leadCols_().filter(function(x){ return x.id===to; })[0];
    if(c && col && c.col!==to) save(Object.assign({}, c, { col:to }), gpT('Moved to {col}',{col:col.title}));
  });
  var eb=document.getElementById('leadEditBoard');
  if(eb) eb.onclick=function(){ gpTap(); S.leadEdit = S.leadEdit ? null : { cols:JSON.parse(JSON.stringify(S.lead.cols)), areas:JSON.parse(JSON.stringify(S.lead.areas)), standing:JSON.parse(JSON.stringify(S.lead.standing)) }; render(); var el=document.getElementById('leadSettings'); if(el) el.scrollIntoView({block:'start'}); };
  var e=S.leadEdit;
  if(e){
    var at=function(v){ var p=v.split('|'); return { list:e[p[0]], i:Number(p[1]) }; };
    document.querySelectorAll('[data-lset]').forEach(function(inp){ inp.oninput=function(){ var x=at(inp.getAttribute('data-lset')); x.list[x.i].title=inp.value; }; });
    document.querySelectorAll('[data-ldone]').forEach(function(inp){ inp.onchange=function(){ e.cols.forEach(function(c, i){ c.done = i===Number(inp.getAttribute('data-ldone')); }); }; });
    document.querySelectorAll('[data-lsetup]').forEach(function(b){ b.onclick=function(){ var x=at(b.getAttribute('data-lsetup')); if(x.i<1) return; var tmp=x.list[x.i]; x.list[x.i]=x.list[x.i-1]; x.list[x.i-1]=tmp; render(); }; });
    document.querySelectorAll('[data-lsetdel]').forEach(function(b){ b.onclick=function(){ var x=at(b.getAttribute('data-lsetdel')); if(b.getAttribute('data-lsetdel').indexOf('cols|')===0 && e.cols.length<2) return; x.list.splice(x.i,1); render(); }; });
    document.querySelectorAll('[data-lsetadd]').forEach(function(b){ b.onclick=function(){ var k=b.getAttribute('data-lsetadd'); e[k].push({ id:'', title:'', done:false }); render(); var all=document.querySelectorAll('[data-lset^="'+k+'|"]'); if(all.length) all[all.length-1].focus(); }; });
    var sc=document.getElementById('leadSetCancel'); if(sc) sc.onclick=function(){ S.leadEdit=null; render(); };
    var ss=document.getElementById('leadSetSave');
    if(ss) ss.onclick=function(){
      if(S.busy) return; S.busy=true; ss.disabled=true;
      run('saveLeadSettings',[S.auth.user,S.auth.pin,e],function(d){ S.busy=false; if(d && d.ok){ S.lead=d; S.leadEdit=null; showMsg(t('Board saved')); } else showMsg(d && d.err==='no_columns' ? t('The board needs at least one column.') : t('Could not save')); render(); });
    };
  }
  if(f){
    document.querySelectorAll('[data-lf]').forEach(function(inp){ var k=inp.getAttribute('data-lf'); inp.oninput=inp.onchange=function(){ f[k]=inp.value; }; });
    document.querySelectorAll('[data-lftype]').forEach(function(b){ b.onclick=function(){ f.type=b.getAttribute('data-lftype'); render(); }; });
    var cn=document.getElementById('leadCancel'); if(cn) cn.onclick=function(){ S.leadForm=null; render(); };
    ['leadClose','leadScrim'].forEach(function(id){ var x=document.getElementById(id); if(x) x.onclick=function(){ S.leadForm=null; render(); }; });
    document.querySelectorAll('[data-lfcol]').forEach(function(b){ b.onclick=function(){ gpTap(); f.col=b.getAttribute('data-lfcol'); render(); }; });
    var sv=document.getElementById('leadSave');
    if(sv) sv.onclick=function(){ if(!(f.title||'').trim()){ showMsg(t('Give the card a title first.')); return; } save(f, f.id ? t('Card saved') : t('Card added'), function(){ S.leadForm=null; }); };
    var dl=document.getElementById('leadDelete');
    if(dl) dl.onclick=function(){
      if(!confirm(gpT('Delete “{name}”?',{name:f.title}))) return;
      if(S.busy) return; S.busy=true;
      run('deleteLeadCard',[S.auth.user,S.auth.pin,f.id],function(d){ S.busy=false; if(d && d.ok){ S.lead=d; S.leadForm=null; showMsg(t('Card deleted')); } else showMsg(t('Could not save')); render(); });
    };
  }
}
function bindLeadNotes_(save, saveTask, find){
  var thisMon=leadMonday_(), date=/^\d{4}-\d{2}-\d{2}$/.test(S.leadNoteDate||'') ? S.leadNoteDate : thisMon, d=leadDraft_(date);
  var ta=document.getElementById('leadNoteText'), state=document.getElementById('leadNoteState'), box=document.getElementById('leadNoteLines'), timer=null;
  var go=function(iso){ gpTap(); S.leadNoteDate=iso; S.leadNoteTask=''; render(); };
  var okr=document.getElementById('leadNoteOkr'); if(okr) okr.ontoggle=function(){ S.leadNoteOkrOpen=okr.open; };
  document.querySelectorAll('[data-lnweek]').forEach(function(b){ b.onclick=function(){ go(leadAddDays_(date, Number(b.getAttribute('data-lnweek')))); }; });
  document.querySelectorAll('[data-lndate]').forEach(function(b){ b.onclick=function(){ go(b.getAttribute('data-lndate')); }; });
  var saveNote=function(then){
    if(S.busy) return; S.busy=true;
    run('saveLeadNote',[S.auth.user,S.auth.pin,{ date:date, text:d.text, since:d.since }],function(r){
      S.busy=false;
      if(r && r.ok){ S.lead=r; S.leadDrafts[date]={ text:r.saved ? r.saved.text : '', since:r.saved ? r.saved.updated : '', dirty:false }; if(then) then(); else showMsg(t('Notes saved')); }
      else if(r && r.err==='changed'){
        /* someone else saved this Monday's notes meanwhile: keep both, for this person to tidy and save */
        S.lead=Object.assign({}, S.lead, { notes:r.notes });
        var theirs=(r.latest && r.latest.text) || '';
        S.leadDrafts[date]={ text: theirs===d.text ? theirs : theirs+'\n\n— '+t('your notes')+' —\n'+d.text, since:(r.latest && r.latest.updated) || '', dirty:true };
        showMsg(gpT('{name} saved these notes too — both are in the box. Check them and save.',{name:nameOf(r.latest && r.latest.updatedBy)}));
      }
      else showMsg(t('Could not save'));
      render();
    });
  };
  var lines=function(){ box.innerHTML=leadNoteLinesHtml_(date, d.text); bindLines(); };
  if(ta) ta.oninput=function(){ d.text=ta.value; d.dirty=true; if(state) state.textContent=t('Not saved yet'); clearTimeout(timer); timer=setTimeout(lines, 350); };
  var sv=document.getElementById('leadNoteSave'); if(sv) sv.onclick=function(){ gpTap(); saveNote(); };
  var st=document.getElementById('leadNoteStart'); if(st) st.onclick=function(){ gpTap();
    var first=(leadCols_()[0]||{}).id, agenda=S.lead.cards.filter(function(c){ return c.col===first && c.type!=='project'; });
    d.text=S.lead.standing.concat(agenda).map(function(x){ return x.title+'\n- '; }).join('\n'); d.dirty=true; render();
    var el=document.getElementById('leadNoteText'); if(el){ el.focus(); } };
  /* make a line into a card or a task — the notes are saved first so the line stays */
  var withNotes=function(fn){ if(d.dirty) saveNote(fn); else fn(); };
  var bindLines=function(){
    var L=S.leadLines||[];
    box.querySelectorAll('[data-lnmake]').forEach(function(b){ b.onclick=function(){ var p=b.getAttribute('data-lnmake').split('|'), text=L[Number(p[1])]; if(!text) return; gpTap();
      withNotes(function(){ save({ title:text.slice(0,160), type:p[0], col:(leadCols_()[0]||{}).id||'', meeting:date, fromNotes:true }, p[0]==='project' ? t('Project added to the board') : t('Agenda item added to the board')); }); }; });
    box.querySelectorAll('[data-lntask]').forEach(function(b){ b.onclick=function(){ gpTap(); S.leadNoteTask=L[Number(b.getAttribute('data-lntask'))]||''; lines(); }; });
    box.querySelectorAll('[data-lntaskno]').forEach(function(b){ b.onclick=function(){ S.leadNoteTask=''; lines(); }; });
    box.querySelectorAll('[data-lntaskgo]').forEach(function(b){ b.onclick=function(){ var text=L[Number(b.getAttribute('data-lntaskgo'))], sel=document.getElementById('leadLnCard'), c=sel && find(sel.value); if(!text || !c) return; gpTap();
      withNotes(function(){ S.leadNoteTask=''; saveTask(c.id, { text:text.slice(0,200), meeting:date }, gpT('Task added to “{card}”',{card:c.title})); }); }; });
  };
  if(box) bindLines();
}

function teamsDbHtml(){
  var h='<button class="linkbtn" id="teamsDbBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Ministry'))+'</button>';
  h+='<h2>🗂️ '+esc(t('Teams Database'))+'</h2>';
  h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Outreach Teams'))+' · '+esc(t(TEAM_DEPT))+' · '+esc(campusName(S.me.campus))+'</p>';
  return h+teamsMinistryHtml_(S.me.campus);
}

/* A 1-10 score and a percentage have edges; a phone keypad should know about
   them. Same rules the metric names already carry, read the same way fmt() reads
   them, so nothing new has to be kept in step. */
/* A metric's name, with an ⓘ that opens the KPI guide's one line on what to
   count (kpiguide.js). The line is drawn hidden and shown by a delegated tap
   (see the document listener below), so opening it never re-renders the card
   and never disturbs a number half typed. Outreach Teams is left as it is. */
function kpiNameHtml_(metric, ministry){
  var g = (typeof kpiGloss==='function' && ministry!=='Outreach Teams') ? kpiGloss(metric) : '';
  if(!g) return '<div class="rowName">'+esc(t(metric))+'</div>';
  /* the ⓘ sits beside .rowName, not inside it, so the name reads exactly as
     before to anything that reads it (tests, the OKR "feeds" note lookups) */
  return '<div class="kpiNameLine"><span class="rowName">'+esc(t(metric))+'</span>'+
    '<button type="button" class="kpiInfo" data-kpiinfo aria-expanded="false" aria-label="'+esc(t('What to count'))+'">ⓘ</button></div>'+
    '<div class="kpiGlossLine" hidden>'+esc(t(g))+'</div>';
}
/* The first number in a save that is outside its edges (kpiRange in
   taxonomy.js), as the message to show — or '' when everything is fine. The
   server refuses the same numbers; this just says so before anything is sent. */
function kpiProblem_(updates, ministry){
  if(ministry==='Outreach Teams' || typeof kpiRange!=='function') return '';
  for(var i=0;i<updates.length;i++){
    var u=updates[i], r=kpiRange(u.metric||'');
    if(!r || u.value===null || u.value===undefined || isNaN(u.value)) continue;
    if(u.value<r.min || u.value>r.max)
      return gpT('{metric} goes from {min} to {max} — check the number you typed.',{metric:t(u.metric), min:r.min, max:r.max});
  }
  return '';
}
document.addEventListener('click', function(e){
  var b = e.target && e.target.closest ? e.target.closest('[data-kpiinfo]') : null;
  if(!b) return;
  var line = b.parentNode && b.parentNode.nextElementSibling;
  if(!line || !line.classList.contains('kpiGlossLine')) return;
  line.hidden = !line.hidden;
  b.setAttribute('aria-expanded', line.hidden ? 'false' : 'true');
});

function kpiInputAttrs_(metric){
  if(metric.indexOf('(1-10)')>-1) return ' min="1" max="10" step="1"';
  if(metric.indexOf('(%)')>-1) return ' min="0" max="100"';
  return '';
}

/* ---------- login / register ---------- */
function loginHtml(){
  return '<h2>Welcome back</h2><p class="sub">Log in with your username and 4-digit PIN.</p>'+
    '<div class="card">'+
    '<label class="f">Username</label><input type="text" id="li_user" autocapitalize="none" placeholder="e.g. sokha">'+
    '<label class="f">PIN</label><input type="password" id="li_pin" inputmode="numeric" maxlength="4" placeholder="••••">'+
    '<button class="btn" id="loginBtn">Log in</button>'+
    '<button class="linkbtn" id="toReg">New here? Create my profile</button></div>'+
    '<button class="btn ghost guestEntry" id="lookAround">👀 '+esc(t('Look around without an account'))+'</button>'+
    '<p class="hint" style="text-align:center">'+esc(t('Read the Library and see the app first — no username needed.'))+'</p>';
}
/*  Two facts the base counts people by: what kind of staff you are, and where you
    are from. Asked when a profile is created and changed from Profile & settings
    afterwards — one pair of fields, written once and used by both forms so the
    two cannot drift.

    Country is a picker rather than a text box on purpose: "how many countries are
    we" only has an answer if one country is one string. "Other" is there so a
    nationality missing from the list is still recordable — the API folds the
    common spellings together either way. */
function staffTypeFieldHtml(id, current){
  return '<label class="f">'+esc(t('What kind of staff are you?'))+'</label>'+
    '<select id="'+id+'"><option value="">'+esc(t('— choose —'))+'</option>'+
    STAFF_TYPES.map(function(ty){
      return '<option value="'+ty.id+'"'+(current===ty.id?' selected':'')+'>'+esc(t(ty.label))+'</option>';
    }).join('')+'</select>'+
    '<div class="hint">'+esc(t('The base counts campus staff, YAP and ministry staff separately.'))+'</div>';
}
function countryFieldHtml(id, current){
  var known = COUNTRIES.indexOf(current)>-1;
  var other = !!current && !known;
  return '<label class="f">'+esc(t('Home country'))+'</label>'+
    '<select id="'+id+'"><option value="">'+esc(t('— choose —'))+'</option>'+
    COUNTRIES.map(function(c){
      /* Country names stay in Latin script — a list half in Khmer would read worse
         than one that is not translated at all. */
      return '<option value="'+esc(c)+'"'+(current===c?' selected':'')+'>'+esc(c)+'</option>';
    }).join('')+
    '<option value="__other"'+(other?' selected':'')+'>'+esc(t('Other…'))+'</option></select>'+
    '<input type="text" id="'+id+'_other" placeholder="'+esc(t('Country'))+'" value="'+esc(other?current:'')+'"'+
    (other?'':' style="display:none"')+'>'+
    '<div class="hint">'+esc(t('Counted as how many Khmer, how many international, and how many countries.'))+'</div>';
}
/* "Other" is a select value, never a country — read the text box instead. */
function countryValue(id){
  var sel=document.getElementById(id);
  if(!sel) return '';
  if(sel.value!=='__other') return sel.value;
  var box=document.getElementById(id+'_other');
  return box ? String(box.value||'').trim() : '';
}
function bindCountryOther(){
  ['r_country','p_country','adm_country'].forEach(function(id){
    var sel=document.getElementById(id), box=document.getElementById(id+'_other');
    if(!sel||!box) return;
    sel.onchange=function(){
      var other = sel.value==='__other';
      box.style.display = other ? '' : 'none';
      if(other) box.focus();
    };
  });
}

function registerHtml(){
  var inv = S.regPrefill;
  var opts = S.roster.map(function(p){ return '<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.dept)+'</option>'; }).join('');
  return '<h2>Create my profile</h2><p class="sub">Pick a username and a 4-digit PIN you\u2019ll remember. You can add a photo right after.</p>'+
    (inv ? '<div class="banner" id="inviteBanner">👋 '+esc(gpT('You’re joining {where}. Check it below, then make your profile.',{where:[inv.ministry?t(inv.ministry):'', inv.dept?t(inv.dept):'', campusName(inv.campus)].filter(Boolean).join(' · ')}))+'</div>' : '')+
    '<div class="card">'+
    '<label class="f">Full name</label><input type="text" id="r_name" placeholder="Your name">'+
    '<label class="f">Email</label><input type="email" id="r_email" autocapitalize="none" placeholder="you@example.com">'+
    '<div class="hint">One profile per email \u2014 this is what stops a duplicate sign-up.</div>'+
    '<label class="f">Username</label><input type="text" id="r_user" autocapitalize="none" placeholder="lowercase, no spaces"><div class="hint">Letters, numbers, . _ - (2\u201320 chars)</div>'+
    '<label class="f">PIN (4 digits)</label><input type="password" id="r_pin" inputmode="numeric" maxlength="4" placeholder="••••">'+
    '<label class="f">Campus</label><select id="r_campus">'+CAMPUSES.map(function(c){return '<option value="'+c.id+'"'+(inv && inv.campus===c.id?' selected':'')+'>'+c.name+'</option>';}).join('')+'</select>'+
    '<label class="f">Department</label><select id="r_dept">'+deptsFor(inv ? inv.campus : 'poipet').map(function(d){return '<option value="'+esc(d)+'"'+(inv && inv.dept===d?' selected':'')+'>'+esc(t(d))+'</option>';}).join('')+'</select>'+
    '<label class="f">Ministry</label><select id="r_ministry"></select><div class="hint">This is what puts your team’s KPIs on your home page.</div>'+
    '<label class="f">Role / team</label><input type="text" id="r_role" placeholder="e.g. Cafe barista, DTS staff">'+
    staffTypeFieldHtml('r_type','')+
    countryFieldHtml('r_country','')+
    '<label class="f">My mentor <span class="lock">🔒 sees my private check-ins</span></label><select id="r_mentor"><option value="">— choose later —</option>'+opts+'</select>'+
    '<label class="f">Phone (optional)</label><input type="tel" id="r_phone" placeholder="">'+
    '<label class="f">'+esc(t('Year I started with YWAM GP (optional)'))+'</label><input type="number" id="r_joined" placeholder="2024">'+
    '<button class="btn" id="regBtn">Create profile</button>'+
    '<button class="linkbtn" id="toLogin">I already have a profile</button></div>';
}


/* ---------- me ---------- */
/* Me is the looking-back page: streaks, this week's totals, recent days,
   settings. Home already greets you and carries today's actions, so the
   identity card isn't repeated here — only the per-habit streaks Home
   doesn't show. */
/* ---------- Health: my weekly check-in, my history, the base average ----------
   The eleven weekly questions, filled in by hand. Daily logging turned out not to
   be sustainable, so this is the primary way a week gets answered; the daily
   roll-up still works for anyone who does log days, and a week answered here
   wins over one inferred from days (see saveMyWeek in api.js).

   Either way it is ONE row per person per week, keyed by their survey token — so
   the two paths cannot double-count anybody.

   Who sees what, which is the whole point of the token:
     - the base average pools rows that carry a token and never a name, so
       anything base-wide is anonymous by construction;
     - only the person's own record maps that token back to them, which is how
       their ONE approved mentor — and nobody else — sees these answers by name.
   Leadership reads the base total. It does not read this. */
var WEEK_SCALE_QS = [
  { id:'lonely',  text:'How lonely do I feel this week?', higherBetter:false, lowLabel:'1 · Very connected', highLabel:'10 · Very lonely' },
  { id:'clarity', text:'How clear am I on what to work on this week?', higherBetter:true, lowLabel:'1 · Unclear', highLabel:'10 · Very clear' },
  { id:'growth',  text:'How would I rate my personal growth this week?', higherBetter:true, lowLabel:'1 · Stagnant', highLabel:'10 · Thriving' }
];
/* Four of these are worded to match the Siem Reap history's own weekly
   questions exactly (porn, exercise, debt, quiet time) — same question, same
   id, so an answer given from here on continues that same historical line
   rather than starting a new, disconnected one. See srCheckinPoints_ in
   sr-checkin-history.js for where the two get spliced together. */
var WEEK_YESNO_QS = [
  { id:'porn',        text:'Did I look at porn this week?', higherBetter:false },
  { id:'oneOnOne',    text:'Did I have a one-on-one this week?', higherBetter:true },
  { id:'exercise',    text:'Did I exercise at least 15 minutes, 3 days this week?', higherBetter:true },
  { id:'quietTime',   text:'Did I read the Bible and have daily quiet time every day this week?', higherBetter:true },
  { id:'debt',        text:'Do I currently have debt toward the base?', higherBetter:false },
  { id:'sharedFaith', text:'Did I share my faith with someone this week?', higherBetter:true },
  { id:'sabbath',     text:'Did I take a sabbath this week?', higherBetter:true }
];
var WEEK_NUM_QS = [
  { id:'langHours', text:'Hours spent on language study this week' }
];
/* Extra questions, once a month — the same "Monthly Check-In" add-on the
   Siem Reap history's own tool asked, on the week that closes out a month
   (isMonthEndWeek_ below). Only written to the server on that week (see
   weekSubmit and saveMyWeek in api.js), so compositeOf only counts them on
   the weeks they were actually asked — same pattern growth/sharedFaith/
   sabbath already use for "answered, or not asked at all". */
var WEEK_MONTHLY_QS = [
  { id:'familyCall',     text:'Did I call my family at least once this month?', higherBetter:true },
  { id:'lonelyMonth',    text:'Did I often feel lonely this month?', higherBetter:false },
  { id:'ministryUpdate', text:'Did I send a ministry update to my supporters this month?', higherBetter:true },
  { id:'twoOneOnOnes',   text:'Did I have at least 2 one-on-ones this month?', higherBetter:true }
];
/* The week whose Sunday is the last one still inside this calendar month —
   exactly one per month, same cadence the Siem Reap tool used for its own
   month-end add-on. */
function isMonthEndWeek_(wk){
  var thisSun = new Date(weekBounds_(wk).to);
  var nextSun = new Date(weekBounds_(Number(wk)+1).to);
  return thisSun.getMonth() !== nextSun.getMonth();
}

function myWeekRow(wk){
  for(var i=0;i<(S.checkins||[]).length;i++){
    if(Number(S.checkins[i].week)===Number(wk)) return S.checkins[i];
  }
  return null;
}

/* The draft starts from whatever is already answered for that week, so opening a
   filled-in week shows your answers rather than a blank form. */
function weekDraftFor(wk){
  if(S.weekDraftFor===Number(wk) && S.weekDraft) return S.weekDraft;
  var row = myWeekRow(wk), d = {};
  if(row){
    WEEK_SCALE_QS.concat(WEEK_NUM_QS).forEach(function(q){
      if(row[q.id]!==null && row[q.id]!==undefined) d[q.id]=Number(row[q.id]);
    });
    WEEK_YESNO_QS.concat(WEEK_MONTHLY_QS).forEach(function(q){
      if(row[q.id]!==null && row[q.id]!==undefined) d[q.id]=row[q.id]?1:0;
    });
  }
  S.weekDraftFor = Number(wk); S.weekDraft = d;
  return d;
}

/* ▲/▼ against the week before, per question — the progress-or-regress the old
   dashboard showed, but about your own answers rather than the base's. */
function myTrend(wk, id, higherBetter, asPct){
  var now = myWeekRow(wk), prev = myWeekRow(Number(wk)-1);
  if(!now || !prev) return '';
  var a = Number(prev[id]), b = Number(now[id]);
  if(isNaN(a) || isNaN(b)) return '';
  if(asPct){
    if(a===b) return trendBadge(0, higherBetter);
    return trendBadge(b>a?100:-100, higherBetter);
  }
  return trendBadge(pctChange(a,b), higherBetter);
}

function healthHtml(){
  var cur = thisWeek();
  var wk = Number(S.healthWeek || cur);
  var isCurWk = wk===cur;
  var h = '<h2>'+esc(t('Health'))+'</h2>';

  /* --- which week --- same week-nav layout as Weekly Goals and My Ministry,
     so backfilling a past check-in works the same way everywhere in the app. */
  h += '<div class="card">'+
    '<div class="weekNavLabel">'+esc(t('Week'))+'</div>'+
    '<div class="weekNavRow">'+
      '<button class="weekArrow" id="healthPrevWeek" aria-label="'+esc(t('Previous week'))+'"'+(wk<=1?' disabled':'')+'>‹</button>'+
      '<div class="weekPill">'+esc(weekRangeLabel_(wk))+
        '<span class="currentTag'+(isCurWk?' on':'')+'">'+esc(t('Current Week'))+'</span></div>'+
      '<button class="weekArrow" id="healthNextWeek" aria-label="'+esc(t('Next week'))+'"'+(wk>=52?' disabled':'')+'>›</button>'+
    '</div>'+
    (isCurWk?'':'<button class="linkbtn" style="padding:6px 0 0" id="healthJumpCurrent">'+esc(t('Jump back to this week'))+'</button>')+
  '</div>';

  /* A nudge for last week specifically, from the moment it ends — shown only
     while looking at the current week, so it doesn't stack with the "which
     week" nav you'd use to jump there anyway once you tap in. */
  if(isCurWk && cur>1 && !myWeekRow(cur-1)){
    h += '<div class="banner">'+esc(gpT('You haven’t answered week {n} yet.',{n:cur-1}))+
      ' <button class="linkbtn inline" id="goLastWeekHealth">'+esc(t('Fill it in'))+'</button></div>';
  }

  /* --- my check-in for that week --- */
  var row = myWeekRow(wk);
  var score = row ? compositeOf(row) : null;
  var prevScore = myWeekRow(wk-1) ? compositeOf(myWeekRow(wk-1)) : null;
  /* Used to default open whenever there was no row yet, so the sliders sat
     there as clutter even for someone who just wanted to check their score
     history and hadn't decided to answer yet. Now it only opens on request —
     the button below for a week with no answer yet, "Edit my answers" for
     one that already has one — and weekSubmit resetting S.weekForm on
     success (see below) closes it again either way. */
  var open = (S.weekForm===Number(wk));

  h += '<h3>💚 '+esc(t('My check-in'))+' · '+esc(t('Week'))+' '+wk+'</h3>';
  /* A one-time confirmation, not a permanent state: shown for the render
     right after weekSubmit sets it, then cleared here so it doesn't linger
     once you've moved on — the toast alone was too easy to miss since the
     form also closes and the base average refreshes at the same moment. */
  if(row && S.weekJustSaved===wk){
    h += '<div class="banner">✅ '+esc(gpT('Week {wk}’s check-in is saved.',{wk:wk}))+'</div>';
    S.weekJustSaved = null;
  }
  if(row){
    h += '<div class="card">'+
      '<div class="row" style="border:0;padding-top:0"><span class="rowName">'+
      '<strong>'+esc(t('Health score out of 10'))+'</strong>'+
      '<div class="pmeta">'+esc(t(row.source==='weekly' ? 'From your weekly check-in' : 'Worked out from the days you logged'))+'</div></span>'+
      '<span class="pctBig">'+score.toFixed(1)+
        (prevScore!==null ? trendBadge(pctChange(prevScore,score), true) : '')+'</span></div>'+
      '<div class="bar"><div class="barFill'+(score>=8?' done':'')+'" style="width:'+
        Math.round(score*10)+'%"></div></div>';
    h += '<div class="okrActions">'+
      (row.source==='weekly'
        ? '<button class="danger" id="weekClear">'+esc(t('Clear this week'))+'</button>' : '')+
      '<button class="linkbtn inline" id="weekEdit">'+
        esc(t(open?'Hide the form':'Edit my answers'))+'</button></div></div>';
  } else if(!open){
    h += '<button class="btn" id="weekStart">'+esc(t('Fill out this week’s check-in'))+'</button>';
  }

  if(open){
    var d = weekDraftFor(wk);
    h += '<div class="card" id="weekForm" style="padding:6px 14px 14px">';
    WEEK_SCALE_QS.forEach(function(q){
      var v = d[q.id]!==undefined ? Number(d[q.id]) : 5;
      var pct = Math.round(((v-1)/9)*100);
      // Same colour walk as the goal slider, just pointed the right way for
      // this question — a HIGH loneliness score is bad, so it colours as a
      // low goodPct even though the thumb itself sits at the high end.
      var goodPct = q.higherBetter ? pct : (100-pct);
      h += '<div class="qBlock"><div class="qText">'+esc(t(q.text))+'</div>'+
        '<div class="sliderWrap"><input type="range" min="1" max="10" step="1" value="'+v+'" data-wslide="'+q.id+'" data-higherbetter="'+(q.higherBetter?'1':'0')+'" '+
        'style="--fillpct:'+pct+'%;--gc:'+gpRingColor(goodPct)+'"></div>'+
        '<div class="qCaps"><span>'+esc(t(q.lowLabel))+'</span><span class="qReadout" style="color:'+gpPctColor(goodPct)+'">'+v+'/10</span><span>'+esc(t(q.highLabel))+'</span></div>'+
        '</div>';
    });
    WEEK_NUM_QS.forEach(function(q){
      h += '<div class="qBlock"><div class="qText">'+esc(t(q.text))+'</div>'+
        '<div class="numIn"><input type="number" inputmode="decimal" min="0" step="0.5" placeholder="0" '+
        'data-wnum="'+q.id+'" value="'+(d[q.id]!==undefined?d[q.id]:'')+'"> '+esc(t('hours'))+'</div></div>';
    });
    WEEK_YESNO_QS.forEach(function(q){
      h += '<div class="qBlock"><div class="qText">'+esc(t(q.text))+'</div><div class="seg">'+
        '<button data-wyn="'+q.id+'|1" class="'+(d[q.id]===1?('on'+(q.higherBetter?'':' bad')):'')+'">'+esc(t('Yes'))+'</button>'+
        '<button data-wyn="'+q.id+'|0" class="'+(d[q.id]===0?'on':'')+'">'+esc(t('No'))+'</button></div></div>';
    });
    if(isMonthEndWeek_(wk)){
      h += '<div class="mentorDivider"></div><div class="mentorLabel">'+esc(t('Monthly Check-In'))+'</div>';
      WEEK_MONTHLY_QS.forEach(function(q){
        /* the app already knows how many 1-on-1s were held — say so beside the question */
        var ooHint = (q.id==='twoOneOnOnes' && S.me && S.me.mentorId) ? '<div class="pmeta" style="margin:-4px 0 8px">☕ '+esc(gpT('The app counts {n} this month',{n:ooHeldThisMonth_(S.me.id)}))+'</div>' : '';
        h += '<div class="qBlock"><div class="qText">'+esc(t(q.text))+'</div>'+ooHint+'<div class="seg">'+
          '<button data-wyn="'+q.id+'|1" class="'+(d[q.id]===1?('on'+(q.higherBetter?'':' bad')):'')+'">'+esc(t('Yes'))+'</button>'+
          '<button data-wyn="'+q.id+'|0" class="'+(d[q.id]===0?'on':'')+'">'+esc(t('No'))+'</button></div></div>';
      });
    }
    h += '<button class="btn" id="weekSubmit">'+
      esc(t(row?'Update my check-in':'Submit my check-in'))+'</button>';
    h += '<p class="hint" style="margin-top:8px">🔒 '+
      esc(t('Base figures are totals only — no names. Your answers are shown by name to your mentor and to nobody else.'))+
      '</p></div>';
  }

  /* --- this week's answers against last week, question by question --- */
  if(row){
    h += '<h3>📊 '+esc(t('Against last week'))+'</h3>'+
      '<p class="pmeta" style="margin:-6px 0 8px">'+esc(t('Your personal health check-in — nobody else sees this breakdown.'))+'</p>'+
      '<div class="card">';
    WEEK_SCALE_QS.forEach(function(q){
      var v = row[q.id];
      h += '<div class="row"><span class="rowName">'+esc(t(q.text))+'</span>'+
        '<span class="rowVal">'+((v===null||v===undefined)?'—':v+'/10')+
        myTrend(wk,q.id,q.higherBetter,false)+'</span></div>';
    });
    WEEK_NUM_QS.forEach(function(q){
      h += '<div class="row"><span class="rowName">'+esc(t(q.text))+'</span>'+
        '<span class="rowVal">'+(Number(row[q.id])||0)+
        myTrend(wk,q.id,true,false)+'</span></div>';
    });
    WEEK_YESNO_QS.forEach(function(q){
      h += '<div class="row"><span class="rowName">'+esc(t(q.text))+'</span>'+
        '<span class="rowVal">'+esc(t(row[q.id]?'Yes':'No'))+
        myTrend(wk,q.id,q.higherBetter,true)+'</span></div>';
    });
    var monthlyAnswered = WEEK_MONTHLY_QS.filter(function(q){ return row[q.id]!==null && row[q.id]!==undefined; });
    if(monthlyAnswered.length){
      h += '<div class="mentorDivider"></div><div class="mentorLabel">'+esc(t('Monthly Check-In'))+'</div>';
      monthlyAnswered.forEach(function(q){
        h += '<div class="row"><span class="rowName">'+esc(t(q.text))+'</span>'+
          '<span class="rowVal">'+esc(t(row[q.id]?'Yes':'No'))+'</span></div>';
      });
    }
    h += '</div>';
  }

  /* --- every week I have answered, newest first --- */
  var past = (S.checkins||[]).slice().sort(function(a,b){ return b.week-a.week; });
  if(past.length){
    h += '<h3>📈 '+esc(t('My weeks'))+'</h3><div class="card">';
    past.forEach(function(c, i){
      var sc = compositeOf(c);
      var older = past[i+1] ? compositeOf(past[i+1]) : null;
      h += '<div class="row"><span class="rowName">'+esc(t('Week'))+' '+c.week+
        '<div class="pmeta">'+esc(t(c.source==='weekly'?'weekly check-in':'from daily logs'))+'</div></span>'+
        '<span class="pctSm">'+sc.toFixed(1)+
          (older!==null ? trendBadge(pctChange(older,sc), true) : '')+'</span></div>';
    });
    h += '</div>';
  }

  /* Siem Reap gets ONE section, not two: the chart view (quarter picker,
     trend line, tap-a-question bars) IS Base Health here, not a second
     thing sitting next to it — srCheckinHistoryHtml covers every yes/no
     question Base Health used to list, plus the ones only the import ever
     asked. The 1-10 scales and hour totals (clarity, growth, loneliness,
     language/ministry hours) have no percentage to show and are left out
     rather than forced into a chart that can't represent them. Poipet has
     no import to merge, so it keeps the plain figures below unchanged. */
  if(S.me.campus==='siemreap'){
    h += srCheckinHistoryHtml();
    h += '<p class="hint">🔒 '+esc(t('Base figures are totals only — no names, and nobody sees an individual answer.'))+'</p>';
    return h;
  }

  /* --- the base average this feeds. Anonymous: pooled from tokens, no names. --- */
  if(!S.base){
    return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading your base…'))+'</p></div>';
  }
  var ids = [S.me.campus];
  var curYear = thisWeekYear();   // S.base is this week year's, and the pickers pair with it
  var scope = S.healthScope || 'week';
  var hYear = Number(S.healthYear || curYear);
  var hQ = Number(S.healthQuarter || (qOf(cur)+1)); // 1-4, human-facing like the OKR quarter picker
  var hM = Number(S.healthMonth!=null ? S.healthMonth : weekYearToday_().getMonth()); // 0-11

  h += '<h3>🏠 '+esc(t('Base health'))+' · '+esc(t(campusName(S.me.campus)))+'</h3>';
  h += hxBtnHtml_('health');
  h += '<div class="pickerRow">'+
    '<label class="pick"><span>'+esc(t('View'))+'</span><select id="healthScopeSel">'+
      [['week','Week'],['month','Month'],['quarter','Quarter'],['quarters','Quarter by quarter'],['year','Year']].map(function(sc){
        return '<option value="'+sc[0]+'"'+(scope===sc[0]?' selected':'')+'>'+esc(t(sc[1]))+'</option>';
      }).join('')+'</select></label>'+
    (scope==='month' ? '<label class="pick" style="max-width:120px"><span>'+esc(t('Month'))+'</span><select id="healthMSel">'+
      MONTH_ABBR.map(function(mn,i){ return '<option value="'+i+'"'+(hM===i?' selected':'')+'>'+mn+'</option>'; }).join('')+
      '</select></label>' : '')+
    (scope==='quarter' ? '<label class="pick" style="max-width:120px"><span>'+esc(t('Quarter'))+'</span><select id="healthQSel">'+
      [1,2,3,4].map(function(i){ return '<option value="'+i+'"'+(hQ===i?' selected':'')+'>Q'+i+'</option>'; }).join('')+
      '</select></label>' : '')+
    (scope==='year' ? '<label class="pick" style="max-width:120px"><span>'+esc(t('Year'))+'</span><select id="healthYSel">'+
      [curYear,curYear-1,curYear-2].map(function(y){ return '<option value="'+y+'"'+(hYear===y?' selected':'')+'>'+y+'</option>'; }).join('')+
      '</select></label>' : '')+
    '</div>';

  if(scope==='quarters'){
    return h + hqHtml_() + '<p class="hint">🔒 '+esc(t('Base figures are totals only — no names, and nobody sees an individual answer.'))+'</p>';
  }
  var R = (scope==='year') ? baseRFor(hYear) : baseR();
  if(!R){
    h += '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'+
      '<p class="hint">🔒 '+esc(t('Base figures are totals only — no names, and nobody sees an individual answer.'))+'</p>';
    return h;
  }

  var rows, score, scopeLabel;
  if(scope==='month'){
    rows = R.surveyRows(ids).filter(function(r){ return new Date(weekBounds_(r.week).to).getMonth()===hM; });
    score = rows.length ? rows.reduce(function(s,r){ return s+compositeOf(r); },0)/rows.length : null;
    scopeLabel = MONTH_ABBR[hM];
  } else if(scope==='quarter'){
    rows = R.surveyRows(ids, undefined, hQ-1); score = R.healthScore(ids, undefined, hQ-1); scopeLabel = 'Q'+hQ;
  } else if(scope==='year'){
    rows = R.surveyRows(ids); score = R.healthScore(ids); scopeLabel = String(hYear);
  } else {
    rows = R.surveyRows(ids, wk); score = R.healthScore(ids, wk); scopeLabel = 'W'+wk;
  }
  var hsYtd = baseR().healthScore(ids);
  var cr = (scope==='week') ? R.checkinRate(ids, wk) : null;

  h += '<div class="grid">'+
    '<div class="stat gold"><div class="statNum">'+(score===null?'—':score.toFixed(1)+'/10')+'</div>'+
      '<div class="statLabel">'+esc(t('Staff Health Score'))+' · '+scopeLabel+
      (scope==='week' ? R.trendB(function(w){ return R.healthScore(ids,w); }, true, wk) : '')+'</div></div>'+
    '<div class="stat"><div class="statNum">'+(hsYtd===null?'—':hsYtd.toFixed(1)+'/10')+'</div>'+
      '<div class="statLabel">'+esc(t('Staff Health Score'))+' · YTD</div></div>'+
    (cr ? '<div class="stat"><div class="statNum">'+cr.n+(cr.total?' / '+cr.total:'')+'</div>'+
      '<div class="statLabel">'+esc(t('Checked in this week'))+' · W'+wk+
      (cr.total&&cr.total>0?' · '+gpCheckinPct(cr.n, cr.total)+'%':'')+'</div></div>'
      : '<div class="stat"><div class="statNum">'+rows.length+'</div>'+
      '<div class="statLabel">'+esc(t('Check-ins logged'))+' · '+scopeLabel+'</div></div>')+
    '</div>';

  h += '<div class="card" style="margin-top:12px">';
  [['lonely','Loneliness (avg, lower is better)', false],
   ['clarity','Clarity (avg)', true],
   ['growth','Personal growth (avg)', true],
   ['langHours','Language study (avg hrs)', true]
  ].forEach(function(q){
    var v = rows.length ? R.avg(rows, q[0]) : null;
    var tr = (scope==='week') ? R.trendB(function(w){
      var r = R.surveyRows(ids, w); return r.length ? R.avg(r, q[0]) : null;
    }, q[2], wk) : '';
    var suffix = (q[0]==='langHours') ? '' : '/10';
    h += '<div class="row"><span class="rowName">'+esc(t(q[1]))+'</span>'+
      '<span class="rowVal">'+(v===null?'—':v.toFixed(1)+suffix)+tr+'</span></div>';
  });
  [['sharedFaith','Shared their faith', true],
   ['sabbath','Took a sabbath', true],
   ['porn','Looked at porn', false],
   ['oneOnOne','Had a one-on-one', true],
   ['exercise','Exercised 3+ days', true],
   ['quietTime','Regular quiet time', true],
   ['debt','Have staff debt', false]
  ].forEach(function(q){
    var p = R.pct(rows, q[0]);
    var tr = (scope==='week') ? R.trendB(function(w){
      var r = R.surveyRows(ids, w); return r.length ? R.pct(r, q[0]) : null;
    }, q[2], wk) : '';
    h += '<div class="row"><span class="rowName">'+esc(t(q[1]))+'</span>'+
      '<span class="rowVal">'+(p===null?'—':p+'%')+tr+'</span></div>';
  });
  h += '</div>';
  h += '<p class="hint">🔒 '+esc(t('Base figures are totals only — no names, and nobody sees an individual answer.'))+'</p>';

  return h;
}

/* ---------- Health export: the base's figures as slides ----------
   "Export" on Base health opens the same numbers the page shows — the
   period the pickers are set to, for the reader's own campus — as a
   full-screen deck: one figure family per slide, in the app's own type and
   colours, big enough to read from the back of a room or drop straight
   into a staff meeting. Three ways out of it: save the slide on screen as
   a PNG, save every slide, or print the deck to a PDF (each slide lands on
   its own landscape page — see the @media print rules).

   Everything here is pooled and anonymous, same as the page: the model
   only ever sees survey rows by device token and counts distinct tokens
   for "people answered". Nothing about any one person is on a slide.

   Two renderers share one model (hxSlides_): HTML for the on-screen deck
   and print, and a canvas for the PNGs — so a saved image is the slide you
   were looking at, not an approximation of it. */
var HX_SCALES = [
  { id:'lonely',    label:'Loneliness',      higherBetter:false, sub:'lower is better' },
  { id:'clarity',   label:'Clarity',         higherBetter:true },
  { id:'growth',    label:'Personal growth', higherBetter:true },
  { id:'langHours', label:'Language study',  hours:true, sub:'avg hours a week' }
];
var HX_YESNO = [
  { id:'sharedFaith', label:'Shared their faith', higherBetter:true },
  { id:'sabbath',     label:'Took a sabbath',     higherBetter:true },
  { id:'oneOnOne',    label:'Had a one-on-one',   higherBetter:true },
  { id:'exercise',    label:'Exercised 3+ days',  higherBetter:true },
  { id:'quietTime',   label:'Regular quiet time', higherBetter:true },
  { id:'porn',        label:'Looked at porn',     higherBetter:false },
  { id:'debt',        label:'Have staff debt',    higherBetter:false }
];
var HX_MONTHLY = [
  { id:'familyCall',     label:'Called family',          higherBetter:true },
  { id:'lonelyMonth',    label:'Often felt lonely',      higherBetter:false },
  { id:'ministryUpdate', label:'Sent a ministry update', higherBetter:true },
  { id:'twoOneOnOnes',   label:'Had 2+ one-on-ones',     higherBetter:true }
];

function hxSrData_(){
  return typeof SR_CHECKIN_QUESTIONS!=='undefined' && typeof SR_CHECKIN_WEEKS!=='undefined';
}
/* Which period to export — read off whichever pickers the reader is
   looking at, so the deck matches the screen: the Health tab's View
   picker, Siem Reap's own Month / Quarter / Year picker, or the Base tab's
   period chips. month is 0-11, quarter 1-4, wk an ISO week. */
function hxSpec_(source){
  var campus = S.me.campus, cur = thisWeek(), now = new Date(), yr = thisWeekYear();
  if(source==='base'){
    var p = S.baseHealthPeriod || 'week';
    var by = (S.base && Number(S.base.year)) || yr;
    if(p==='week') return { campus:campus, scope:'week', wk:cur, year:by };
    if(p==='year') return { campus:campus, scope:'year', year:by };
    return { campus:campus, scope:'quarter', quarter:Number(p.slice(1)), year:by };
  }
  if(campus==='siemreap' && hxSrData_()){
    var sc = S.srScope || 'quarter';
    if(sc==='quarters') sc='year';
    return { campus:campus, scope:sc, sr:true, year:yr,
      month:(S.srMonth!=null ? Number(S.srMonth) : now.getMonth()+1)-1,
      quarter:Number(S.srQuarter || Math.ceil((now.getMonth()+1)/3)) };
  }
  var hs = S.healthScope||'week';
  if(hs==='quarters') hs='year';
  return { campus:campus, scope:hs, wk:Number(S.healthWeek||cur),
    month:Number(S.healthMonth!=null ? S.healthMonth : weekYearToday_().getMonth()),
    quarter:Number(S.healthQuarter || (qOf(cur)+1)), year:Number(S.healthYear||yr) };
}
function hxRowsFor_(R, spec, ids){
  if(spec.scope==='month') return R.surveyRows(ids).filter(function(r){ return new Date(weekBounds_(r.week).to).getMonth()===spec.month; });
  if(spec.scope==='quarter') return R.surveyRows(ids, undefined, spec.quarter-1);
  if(spec.scope==='year') return R.surveyRows(ids);
  return R.surveyRows(ids, spec.wk);
}
/* The period before, for the ▲/▼ on the cover — none for a year, or for
   the first week / month / quarter, same as the page. */
function hxPrevSpec_(spec){
  if(spec.scope==='week' && spec.wk>1) return Object.assign({}, spec, { wk:spec.wk-1 });
  if(spec.scope==='month' && spec.month>0) return Object.assign({}, spec, { month:spec.month-1 });
  if(spec.scope==='quarter' && spec.quarter>1) return Object.assign({}, spec, { quarter:spec.quarter-1 });
  return null;
}
function hxPeriodLabel_(spec){
  if(spec.scope==='week') return weekRangeLabel_(spec.wk);
  if(spec.scope==='month') return MONTH_ABBR[spec.month]+' '+spec.year;
  if(spec.scope==='quarter') return 'Q'+spec.quarter+' '+spec.year;
  return String(spec.year);
}
function hxPrevWord_(spec){
  if(spec.scope==='week') return t('vs last week');
  if(spec.scope==='month') return t('vs last month');
  return t('vs last quarter');
}
function hxScore_(rows){
  if(!rows.length) return null;
  var s=0; rows.forEach(function(r){ s+=compositeOf(r); });
  return s/rows.length;
}
/* Everything a slide could show, computed once. Siem Reap's yes/no
   percentages come from the same import-plus-live series its Base health
   card plots (srCheckinForScope_), so the deck agrees with the bars on
   screen; every other figure — and every figure on Poipet — is the plain
   pooled roll-up the generic Base health section prints. */
function hxModel_(spec){
  /* S.base is always the current year's data; a payload without a year
     field (getData never sets one) still means "this year", so an unmatched
     current-year request falls back to it rather than to nothing. */
  var R = spec.scope==='year' ? (baseRFor(spec.year) || (spec.year===thisWeekYear() ? baseR() : null)) : baseR();
  if(!R) return null;
  var ids = [spec.campus];
  var rows = hxRowsFor_(R, spec, ids);
  var prevSpec = hxPrevSpec_(spec);
  var prevRows = prevSpec ? hxRowsFor_(R, prevSpec, ids) : [];
  var people = {}, weeks = {};
  rows.forEach(function(r){ people[r.device||'?']=1; weeks[r.week]=1; });
  var scales = HX_SCALES.map(function(q){
    return { id:q.id, label:q.label, sub:q.sub||'', hours:!!q.hours, higherBetter:q.higherBetter,
      value: rows.length ? R.avg(rows, q.id) : null };
  });
  var pctOf = function(id){ return rows.length ? R.pct(rows, id) : null; };
  var yes = HX_YESNO.map(function(q){ return { id:q.id, label:q.label, higherBetter:q.higherBetter, value:pctOf(q.id) }; });
  var monthly = HX_MONTHLY.map(function(q){ return { id:q.id, label:q.label, higherBetter:q.higherBetter, value:pctOf(q.id) }; });
  if(spec.sr && spec.scope!=='week'){
    var byLive = {};
    SR_CHECKIN_QUESTIONS.forEach(function(q){ if(q.liveId) byLive[q.liveId]=q.id; });
    var bars = srCheckinForScope_(spec.scope, spec.month+1, spec.quarter).bars, byId = {};
    bars.forEach(function(b){ byId[b.id]=b.pct; });
    yes.concat(monthly).forEach(function(it){
      var sid = byLive[it.id];
      if(sid && byId[sid]!==undefined) it.value = byId[sid];
    });
  }
  monthly = monthly.filter(function(it){ return it.value!==null; });
  var total = R.checkinRate(ids, spec.wk||thisWeek()).total;
  return { campus:spec.campus, spec:spec, periodLabel:hxPeriodLabel_(spec), prevWord:hxPrevWord_(spec),
    rows:rows.length, people:Object.keys(people).length, weeks:Object.keys(weeks).length, total:total,
    score:hxScore_(rows), prevScore:prevSpec ? hxScore_(prevRows) : null,
    scales:scales, yes:yes, monthly:monthly };
}
/* One figure on a slide: the number, its unit, a label and the colour the
   rest of the app would give that result — good when it is good, warm when
   it is not — via gpPctColor on a "how good is this" percentage. */
function hxPctItem_(it){
  var v = it.value;
  var good = v===null ? null : (it.higherBetter ? v : 100-v);
  return { n: v===null ? '—' : String(v), unit: v===null ? '' : '%', label:t(it.label),
    color: good===null ? 'var(--faint)' : gpPctColor(good) };
}
function hxScaleItem_(it){
  var v = it.value;
  if(it.hours) return { n: v===null ? '—' : (Math.round(v*10)/10).toString(), unit: v===null ? '' : ' '+t('hrs'), label:t(it.label), sub:it.sub?t(it.sub):'', color:'var(--accent)' };
  var good = v===null ? null : Math.round((it.higherBetter ? v : 10-v)*10);
  return { n: v===null ? '—' : v.toFixed(1), unit: v===null ? '' : '/10', label:t(it.label), sub:it.sub?t(it.sub):'',
    color: good===null ? 'var(--faint)' : gpPctColor(good) };
}
function hxSlides_(m){
  var kicker = t('Base Health')+' · '+t(campusName(m.campus));
  var slides = [];
  var trend = null;
  if(m.score!==null && m.prevScore!==null){
    var pc = pctChange(m.prevScore, m.score);
    trend = { pct:pc, text:(pc>0?'▲ ':pc<0?'▼ ':'') + Math.abs(pc) + '% ' + m.prevWord, good: pc>=0 };
  }
  slides.push({ kind:'cover', kicker:t('Base Health'), title:t(campusName(m.campus)), sub:m.periodLabel,
    item:{ n: m.score===null ? '—' : m.score.toFixed(1), unit: m.score===null ? '' : '/10', label:t('Staff Health Score'),
      color: m.score===null ? 'var(--faint)' : gpPctColor(Math.round(m.score*10)) }, trend:trend });
  var who = [{ n:String(m.rows), unit:'', label:t('check-ins logged'), color:'var(--accent)' },
    { n:String(m.people), unit:'', label: m.total ? gpT('of {n} staff answered',{n:m.total}) : t('people answered'), color:'var(--accent)' }];
  if(m.spec.scope==='week' && m.total) who.push({ n:String(gpCheckinPct(m.people, m.total)), unit:'%', label:t('response rate'), color:gpPctColor(gpCheckinPct(m.people, m.total)) });
  else who.push({ n:String(m.weeks), unit:'', label:t('weeks covered'), color:'var(--accent)' });
  slides.push({ kind:'stats', kicker:kicker, title:t('Who checked in'), sub:m.periodLabel, items:who });
  slides.push({ kind:'stats', kicker:kicker, title:t('How we’re doing'), sub:m.periodLabel, items:m.scales.map(hxScaleItem_) });
  slides.push({ kind:'stats', kicker:kicker, title:t('Habits'), sub:m.periodLabel+' · 1/2', items:m.yes.slice(0,4).map(hxPctItem_) });
  slides.push({ kind:'stats', kicker:kicker, title:t('Habits'), sub:m.periodLabel+' · 2/2', items:m.yes.slice(4).map(hxPctItem_) });
  if(m.monthly.length) slides.push({ kind:'stats', kicker:kicker, title:t('Monthly Check-In'), sub:m.periodLabel, items:m.monthly.map(hxPctItem_) });
  hqSlides_(m.campus, kicker).forEach(function(sl){ slides.push(sl); });
  slides.push({ kind:'end', kicker:kicker, title:t('Totals only — no names.'), sub:t('Nobody sees an individual answer.'),
    foot:gpT('GP Impact · {date}',{date:todayStr()}) });
  return slides;
}

/* ---- on screen ---- */
function hxRoot_(){
  var r = document.getElementById('hxRoot');
  if(!r){ r = document.createElement('div'); r.id='hxRoot'; document.body.appendChild(r); }
  return r;
}
function hxItemHtml_(it, cls){
  return '<div class="hxItem'+(cls?' '+cls:'')+'"><div class="hxNum" style="color:'+it.color+'">'+esc(it.n)+
    (it.unit ? '<span class="hxUnit">'+esc(it.unit)+'</span>' : '')+'</div>'+
    '<div class="hxLbl">'+esc(it.label)+'</div>'+(it.sub ? '<div class="hxSub">'+esc(it.sub)+'</div>' : '')+'</div>';
}
function hxSlideHtml_(sl){
  if(sl.kind==='qchart' || sl.kind==='qmulti') return hqSlideHtml_(sl);
  var logo = (typeof GP_LOGO==='string') ? '<img class="hxLogo" src="'+GP_LOGO+'" alt="">' : '';
  if(sl.kind==='cover'){
    return '<div class="hxSlide hxCover">'+logo+'<div class="hxKicker">'+esc(sl.kicker)+'</div>'+
      '<div class="hxTitle big">'+esc(sl.title)+'</div><div class="hxWhen">'+esc(sl.sub)+'</div>'+
      hxItemHtml_(sl.item, 'hxHero')+
      (sl.trend ? '<div class="hxTrend '+(sl.trend.good?'good':'bad')+'">'+esc(sl.trend.text)+'</div>' : '')+'</div>';
  }
  if(sl.kind==='end'){
    return '<div class="hxSlide hxEnd">'+logo+'<div class="hxKicker">'+esc(sl.kicker)+'</div>'+
      '<div class="hxTitle">🔒 '+esc(sl.title)+'</div><div class="hxWhen">'+esc(sl.sub)+'</div>'+
      '<div class="hxFoot">'+esc(sl.foot)+'</div></div>';
  }
  return '<div class="hxSlide"><div class="hxHead"><div class="hxKicker">'+esc(sl.kicker)+'</div>'+
    '<div class="hxTitle">'+esc(sl.title)+'</div><div class="hxWhen">'+esc(sl.sub)+'</div></div>'+
    '<div class="hxGrid n'+sl.items.length+'">'+sl.items.map(function(it){ return hxItemHtml_(it); }).join('')+'</div></div>';
}
function hxOpen_(source){
  var m = hxModel_(hxSpec_(source));
  if(!m){ showMsg(t('Loading…')); return; }
  S.hx = { slides:hxSlides_(m), i:0, slug:(m.campus+'-'+m.periodLabel).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') };
  gpTap();
  hxRender_();
}
function hxClose_(){
  S.hx = null;
  hxRoot_().innerHTML = '';
  document.body.classList.remove('hxOn');
  if(hxKeyFn_){ document.removeEventListener('keydown', hxKeyFn_); hxKeyFn_ = null; }
}
var hxKeyFn_ = null;
function hxGo_(k){
  if(!S.hx) return;
  var n = S.hx.slides.length;
  if(k<0 || k>=n) return;
  S.hx.i = k; hxRender_();
}
function hxRender_(){
  var root = hxRoot_();
  if(!S.hx){ root.innerHTML=''; return; }
  var slides = S.hx.slides, i = S.hx.i, n = slides.length;
  document.body.classList.add('hxOn');
  root.innerHTML = '<div class="hxOverlay" id="hxOverlay" role="dialog" aria-modal="true" aria-label="'+esc(t('Health slides'))+'">'+
    '<div class="hxBar">'+
      '<span class="hxCount">'+esc(gpT('Slide {i} of {n}',{i:i+1,n:n}))+'</span>'+
      '<span class="hxTools">'+
        '<button class="hxTool" id="hxPng">'+esc(t('Save image'))+'</button>'+
        '<button class="hxTool" id="hxAll">'+esc(t('Save all'))+'</button>'+
        '<button class="hxTool" id="hxPdf">'+esc(t('PDF'))+'</button>'+
        '<button class="hxClose" id="hxClose" aria-label="'+esc(t('Close'))+'">✕</button>'+
      '</span></div>'+
    '<div class="hxStage" id="hxStage">'+slides.map(function(sl,k){
      return '<div class="hxFrame'+(k===i?' on':'')+'" data-hxk="'+k+'">'+hxSlideHtml_(sl)+'</div>';
    }).join('')+'</div>'+
    '<div class="hxNav">'+
      '<button class="hxArrow" id="hxPrev" aria-label="'+esc(t('Previous slide'))+'"'+(i===0?' disabled':'')+'>‹</button>'+
      '<div class="hxDots">'+slides.map(function(sl,k){ return '<button class="hxDot'+(k===i?' on':'')+'" data-hxgo="'+k+'" aria-label="'+esc(gpT('Slide {i} of {n}',{i:k+1,n:n}))+'"></button>'; }).join('')+'</div>'+
      '<button class="hxArrow" id="hxNext" aria-label="'+esc(t('Next slide'))+'"'+(i===n-1?' disabled':'')+'>›</button>'+
    '</div></div>';
  document.getElementById('hxClose').onclick = function(){ gpTap(); hxClose_(); };
  document.getElementById('hxPrev').onclick = function(){ gpTap(); hxGo_(i-1); };
  document.getElementById('hxNext').onclick = function(){ gpTap(); hxGo_(i+1); };
  root.querySelectorAll('[data-hxgo]').forEach(function(b){ b.onclick=function(){ hxGo_(Number(b.getAttribute('data-hxgo'))); }; });
  document.getElementById('hxPng').onclick = function(){ hxSavePng_(i); };
  document.getElementById('hxAll').onclick = function(){ hxSaveAll_(); };
  document.getElementById('hxPdf').onclick = function(){ window.print(); };
  var stage = document.getElementById('hxStage'), x0 = null;
  stage.ontouchstart = function(e){ x0 = e.touches[0].clientX; };
  stage.ontouchend = function(e){
    if(x0===null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if(dx < -40) hxGo_(i+1); else if(dx > 40) hxGo_(i-1);
  };
  stage.onclick = function(e){
    if(e.target.closest('button')) return;
    var r = stage.getBoundingClientRect();
    if(e.clientX - r.left > r.width/2) hxGo_(i+1); else hxGo_(i-1);
  };
  if(!hxKeyFn_){
    hxKeyFn_ = function(e){
      if(!S.hx) return;
      if(e.key==='ArrowRight' || e.key===' ') { e.preventDefault(); hxGo_(S.hx.i+1); }
      else if(e.key==='ArrowLeft') { e.preventDefault(); hxGo_(S.hx.i-1); }
      else if(e.key==='Escape') hxClose_();
    };
    document.addEventListener('keydown', hxKeyFn_);
  }
}

/* ---- as an image ----
   The slide drawn again on a 1600×900 canvas, from the same model, in the
   theme the reader is looking at (the CSS variables are read off the page,
   so dark mode saves dark slides). Fonts are awaited first where the
   browser lets us, otherwise the system fallback draws. */
function hxCanvas_(sl, cb){
  var W=1600, H=900;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var g=c.getContext('2d');
  var cs=getComputedStyle(document.documentElement);
  var v=function(name){ return cs.getPropertyValue(name).trim() || '#1F44FF'; };
  var col=function(x){ var mm=/^var\((--[a-z0-9-]+)\)$/i.exec(x||''); return mm ? v(mm[1]) : (x||v('--accent')); };
  var KO=function(px){ return px+'px Koulen, "Kantumruy Pro", sans-serif'; };
  var KP=function(px, w){ return (w||400)+' '+px+'px "Kantumruy Pro", system-ui, sans-serif'; };
  var wrap=function(text, maxW){
    var words=String(text).split(' '), lines=[], line='';
    words.forEach(function(w){
      var tryLine = line ? line+' '+w : w;
      if(g.measureText(tryLine).width > maxW && line){ lines.push(line); line=w; } else line=tryLine;
    });
    if(line) lines.push(line);
    return lines;
  };
  var draw=function(){
    g.fillStyle=v('--bg'); g.fillRect(0,0,W,H);
    g.fillStyle=v('--accent'); g.fillRect(0,0,W,12);
    g.fillStyle=v('--amber'); g.fillRect(0,12,W,3);
    g.textBaseline='alphabetic';
    var kicker=function(y){ g.fillStyle=v('--faint'); g.font=KP(26,700); g.fillText(String(sl.kicker).toUpperCase(), 90, y); };
    var item=function(it, x, y, w, numPx){
      g.fillStyle=col(it.color); g.font=KO(numPx);
      g.fillText(it.n, x, y);
      var nw=g.measureText(it.n).width;
      if(it.unit){ g.font=KO(Math.round(numPx*0.42)); g.fillText(it.unit, x+nw+8, y); }
      g.fillStyle=v('--ink'); g.font=KP(Math.round(numPx*0.22), 500);
      var ly=y+Math.round(numPx*0.36);
      wrap(it.label, w-20).forEach(function(l, k){ g.fillText(l, x, ly+k*Math.round(numPx*0.27)); });
      if(it.sub){ g.fillStyle=v('--muted'); g.font=KP(Math.round(numPx*0.17)); g.fillText(it.sub, x, ly+Math.round(numPx*0.27)*wrap(it.label, w-20).length+4); }
    };
    if(sl.kind==='cover'){
      kicker(120);
      g.fillStyle=v('--ink'); g.font=KO(150); g.fillText(sl.title, 90, 270);
      g.fillStyle=v('--muted'); g.font=KP(40); g.fillText(sl.sub, 90, 335);
      item(sl.item, 90, 640, 900, 300);
      if(sl.trend){ g.fillStyle=v(sl.trend.good?'--good':'--bad'); g.font=KP(40,700); g.fillText(sl.trend.text, 90, 830); }
    } else if(sl.kind==='end'){
      kicker(120);
      g.fillStyle=v('--ink'); g.font=KO(96);
      wrap(sl.title, W-180).forEach(function(l,k){ g.fillText(l, 90, 400+k*110); });
      g.fillStyle=v('--muted'); g.font=KP(40); g.fillText(sl.sub, 90, 560);
      g.fillStyle=v('--faint'); g.font=KP(28); g.fillText(sl.foot, 90, 820);
    } else if(sl.kind==='qchart'){
      kicker(110);
      g.fillStyle=v('--ink'); g.font=KO(84); g.fillText(sl.title, 90, 200);
      g.fillStyle=sl.good===true ? v('--good') : sl.good===false ? v('--bad') : v('--muted'); g.font=KP(34, sl.good===null?400:700); g.fillText(sl.sub, 90, 250);
      hqCanvasColumns_(g, v, sl.series, 160, 290, W-320, H-330, true);
    } else if(sl.kind==='qmulti'){
      kicker(110);
      g.fillStyle=v('--ink'); g.font=KO(84); g.fillText(sl.title, 90, 200);
      g.fillStyle=v('--muted'); g.font=KP(34); g.fillText(sl.sub, 90, 250);
      g.fillStyle=v('--border'); g.fillRect(90, 290, W-180, 2);
      var qn=sl.items.length, qcols=qn<=3?qn:2, qrows=Math.ceil(qn/qcols), qcw=(W-180)/qcols, qch=(H-330)/qrows;
      sl.items.forEach(function(ser,k){
        var qx=90+(k%qcols)*qcw, qy=320+Math.floor(k/qcols)*qch;
        g.fillStyle=v('--ink'); g.font=KP(26,500); g.fillText(t(ser.label), qx, qy+26);
        var val=ser.latest ? hqFmt_(ser.latest.value, ser.unit) : '—';
        g.font=KO(40); var vw=g.measureText(val).width; g.textAlign='right'; g.fillText(val, qx+qcw-40, qy+30);
        if(ser.delta!==null){ var gd=((ser.delta>0)===ser.higherBetter)||ser.delta===0; g.fillStyle=v(gd?'--good':'--bad'); g.font=KP(22,700);
          g.fillText((ser.delta>0?'▲':ser.delta<0?'▼':'—')+' '+Math.abs(ser.delta)+'%', qx+qcw-40-vw-14, qy+30); }
        g.textAlign='left';
        hqCanvasColumns_(g, v, ser, qx, qy+30, qcw-40, qch-50, false);
      });
    } else {
      kicker(110);
      g.fillStyle=v('--ink'); g.font=KO(84); g.fillText(sl.title, 90, 200);
      g.fillStyle=v('--muted'); g.font=KP(34); g.fillText(sl.sub, 90, 250);
      g.fillStyle=v('--border'); g.fillRect(90, 290, W-180, 2);
      var n=sl.items.length, cols=n<=3?n:2, rows=Math.ceil(n/cols);
      var cw=(W-180)/cols, ch=(H-340)/rows;
      var numPx = rows===1 ? 190 : 150;
      sl.items.forEach(function(it,k){
        var cx=90+(k%cols)*cw, cy=340+Math.floor(k/cols)*ch+Math.round(numPx*0.95);
        item(it, cx, cy, cw, numPx);
      });
    }
  };
  var ready = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load('100px Koulen'), document.fonts.load('700 30px "Kantumruy Pro"'), document.fonts.load('30px "Kantumruy Pro"')])
    : Promise.resolve();
  ready.then(draw, draw).then(function(){ cb(c); }, function(){ cb(c); });
}
function hxDownload_(canvas, name, done){
  var finish=function(url){
    var a=document.createElement('a'); a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ if(/^blob:/.test(url)) URL.revokeObjectURL(url); }, 60000);
    if(done) done();
  };
  try {
    if(canvas.toBlob) canvas.toBlob(function(b){ if(b) finish(URL.createObjectURL(b)); else finish(canvas.toDataURL('image/png')); }, 'image/png');
    else finish(canvas.toDataURL('image/png'));
  } catch(e){ showMsg(t('Could not save the image')); if(done) done(); }
}
function hxSavePng_(k, done){
  if(!S.hx) return;
  var sl=S.hx.slides[k], name='gp-health-'+S.hx.slug+'-'+(k+1)+'.png';
  hxCanvas_(sl, function(c){ hxDownload_(c, name, done); });
}
/* One after another with a breath between, so browsers that ask before a
   page saves several files get one question, not seven at once. */
function hxSaveAll_(){
  if(!S.hx) return;
  var n=S.hx.slides.length, k=0;
  showMsg(gpT('Saving {n} images…',{n:n}));
  var next=function(){ if(!S.hx || k>=n) return; var me=k++; hxSavePng_(me, function(){ setTimeout(next, 450); }); };
  next();
}
function hxBind_(){
  document.querySelectorAll('[data-healthexport]').forEach(function(b){
    b.onclick=function(){ hxOpen_(b.getAttribute('data-healthexport')); };
  });
}
function hxBtnHtml_(source){
  return '<button class="hxOpenBtn" data-healthexport="'+source+'">📽️ '+esc(t('Export as slides'))+'</button>';
}

/* ---------- Base health, quarter by quarter ----------
   "Quarter by quarter" on the Health tab's View picker (and Siem Reap's)
   lays this year's quarters side by side: the Staff Health Score as a
   column per quarter with the rise or fall on the quarter before, then
   every question as its own small column chart with the same ▲/▼ — so
   "did we get better since Q2" is one glance, not two picker changes and
   some mental arithmetic. The same model feeds the export deck (hxSlides_
   adds a set of "By quarter" slides), so the slides say what the page says.

   Quarters are the roll-up's own 13-week blocks (qOf), the same ones the
   Quarter picker uses; only quarters up to the current one are shown.
   Siem Reap's yes/no percentages come from srCheckinForScope_ so they
   agree with its bars. Everything is pooled and anonymous. */
function hqSeries_(qs, id, label, unit, higherBetter, hours){
  var pts = qs.map(function(e){ return { label:e.label, value: id==='score' ? e.score : (e.vals[id]===undefined ? null : e.vals[id]) }; });
  var withData = pts.filter(function(p){ return p.value!==null; });
  var last = withData.length ? withData[withData.length-1] : null;
  var prev = withData.length>1 ? withData[withData.length-2] : null;
  pts.forEach(function(p, i){
    var before = null;
    for(var k=i-1; k>=0; k--){ if(pts[k].value!==null){ before = pts[k]; break; } }
    p.delta = (p.value!==null && before) ? pctChange(before.value, p.value) : null;
  });
  return { id:id, label:label, unit:unit, hours:!!hours, higherBetter:higherBetter!==false, points:pts,
    latest:last, prevLabel:prev ? prev.label : '', delta:(last && prev) ? pctChange(prev.value, last.value) : null };
}
function hqModel_(campus){
  var R = baseR();
  if(!R || !S.base) return null;
  var ids = [campus], curQ = qOf(thisWeek());
  var sr = campus==='siemreap' && hxSrData_();
  var byLive = {};
  if(sr) SR_CHECKIN_QUESTIONS.forEach(function(q){ if(q.liveId) byLive[q.id]=q.liveId; });
  var qs = [];
  for(var q=0; q<=curQ; q++){
    var rows = R.surveyRows(ids, undefined, q);
    var e = { q:q+1, label:'Q'+(q+1), rows:rows.length, score: rows.length ? hxScore_(rows) : null, vals:{} };
    HX_SCALES.forEach(function(s){ e.vals[s.id] = rows.length ? R.avg(rows, s.id) : null; });
    HX_YESNO.concat(HX_MONTHLY).forEach(function(y){ e.vals[y.id] = rows.length ? R.pct(rows, y.id) : null; });
    if(sr){
      srCheckinForScope_('quarter', 0, q+1).bars.forEach(function(b){ if(byLive[b.id]) e.vals[byLive[b.id]] = b.pct; });
      if(!e.rows && Object.keys(e.vals).some(function(k){ return e.vals[k]!==null && e.vals[k]!==undefined; })) e.rows = -1; // imported history only
    }
    qs.push(e);
  }
  var withData = qs.filter(function(e){ return e.rows!==0; });
  return { campus:campus, year:thisWeekYear(), quarters:qs,
    hasData:withData.length>0, compared:withData.length>=2,
    score: hqSeries_(qs, 'score', 'Staff Health Score', '/10', true),
    scales: HX_SCALES.map(function(s){ return hqSeries_(qs, s.id, s.label, s.hours ? 'hrs' : '/10', s.higherBetter!==false, s.hours); }),
    yes: HX_YESNO.map(function(y){ return hqSeries_(qs, y.id, y.label, '%', y.higherBetter); }),
    monthly: HX_MONTHLY.map(function(y){ return hqSeries_(qs, y.id, y.label, '%', y.higherBetter); })
      .filter(function(s){ return s.points.some(function(p){ return p.value!==null; }); }) };
}
function hqFmt_(v, unit){
  if(v===null || v===undefined) return '—';
  if(unit==='%') return Math.round(v)+'%';
  if(unit==='hrs') return (Math.round(v*10)/10)+' '+t('hrs');
  return v.toFixed(1);
}
function hqMax_(ser){
  if(ser.unit==='%') return 100;
  if(ser.unit==='/10') return 10;
  var m = 0; ser.points.forEach(function(p){ if(p.value!==null && p.value>m) m=p.value; });
  return m>0 ? m*1.15 : 1;
}
/* One column per quarter. Thin columns off a single baseline, rounded at
   the data end only, the latest quarter in the accent and the ones before
   it a lighter step of the same hue — emphasis, not a rainbow. Every value
   sits on its cap (there are at most four, and no axis to carry them), the
   quarter under the column, and — on the large chart — the change on the
   quarter before under that. Text stays in text colours; the mark carries
   the colour. */
function hqColumnsHtml_(ser, big){
  var W = big ? 320 : 150, H = big ? 150 : 74;
  var padX = big ? 6 : 4, top = big ? 22 : 16, labelH = big ? 34 : 14;
  var n = ser.points.length, slot = (W-padX*2)/n, bw = Math.min(big ? 26 : 16, slot*0.5);
  var plotH = H-top-labelH, base = top+plotH, max = hqMax_(ser);
  var lastIdx = -1; ser.points.forEach(function(p,i){ if(p.value!==null) lastIdx=i; });
  var h = '<svg viewBox="0 0 '+W+' '+H+'" class="hqCols'+(big?' big':'')+'" role="img" aria-label="'+esc(ser.label)+'">';
  h += '<line x1="'+padX+'" x2="'+(W-padX)+'" y1="'+base+'" y2="'+base+'" class="hqBase"/>';
  ser.points.forEach(function(p,i){
    var cx = padX+slot*i+slot/2;
    if(p.value===null){
      h += '<text x="'+cx+'" y="'+(base-6)+'" class="hqVal muted" text-anchor="middle">—</text>';
    } else {
      var bh = Math.max(3, plotH*(p.value/max)), y = base-bh, r = Math.min(4, bw/2, bh);
      var x0 = cx-bw/2, x1 = cx+bw/2;
      var d = 'M'+x0+','+base+' V'+(y+r)+' Q'+x0+','+y+' '+(x0+r)+','+y+' H'+(x1-r)+' Q'+x1+','+y+' '+x1+','+(y+r)+' V'+base+' Z';
      h += '<path d="'+d+'" class="hqBar'+(i===lastIdx?' on':'')+'"><title>'+esc(p.label)+': '+esc(hqFmt_(p.value, ser.unit))+'</title></path>';
      h += '<text x="'+cx+'" y="'+(y-5)+'" class="hqVal" text-anchor="middle">'+esc(hqFmt_(p.value, ser.unit))+'</text>';
    }
    h += '<text x="'+cx+'" y="'+(base+(big?14:11))+'" class="hqQ" text-anchor="middle">'+esc(p.label)+'</text>';
    if(big && p.delta!==null){
      var good = p.delta===0 ? null : ((p.delta>0) === ser.higherBetter);
      h += '<text x="'+cx+'" y="'+(base+28)+'" class="hqDelta '+(good===null?'flat':good?'good':'bad')+'" text-anchor="middle">'+
        (p.delta>0?'▲':p.delta<0?'▼':'—')+' '+Math.abs(p.delta)+'%</text>';
    }
  });
  return h+'</svg>';
}
function hqDeltaHtml_(ser){
  if(ser.delta===null) return '';
  return trendBadge(ser.delta, ser.higherBetter)+' <span class="pmeta">'+esc(gpT('vs {q}',{q:ser.prevLabel}))+'</span>';
}
function hqMiniHtml_(ser){
  return '<div class="hqMini"><div class="hqMiniHead"><span class="rowName">'+esc(t(ser.label))+'</span>'+
    '<span class="rowVal">'+(ser.latest ? esc(hqFmt_(ser.latest.value, ser.unit)) : '—')+(ser.delta!==null ? trendBadge(ser.delta, ser.higherBetter) : '')+'</span></div>'+
    hqColumnsHtml_(ser, false)+'</div>';
}
function hqHtml_(){
  var m = hqModel_(S.me.campus);
  if(!m) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  if(!m.hasData) return '<div class="card"><p class="emptyLine">'+esc(t('No check-ins this year yet — the quarters fill in as people answer.'))+'</p></div>';
  var h = '<div class="card">'+
    '<div class="row" style="border:0;padding-top:0"><span class="rowName"><strong>'+esc(t('Staff Health Score'))+'</strong>'+
      '<div class="pmeta">'+esc(m.score.latest ? gpT('{q} so far',{q:m.score.latest.label}) : '')+'</div></span>'+
      '<span class="pctBig">'+(m.score.latest ? m.score.latest.value.toFixed(1) : '—')+'</span></div>'+
    (m.compared ? '<div class="hqVs">'+hqDeltaHtml_(m.score)+'</div>'
      : '<p class="pmeta" style="margin:0 0 6px">'+esc(t('The change appears once two quarters have check-ins.'))+'</p>')+
    hqColumnsHtml_(m.score, true)+
    '<div class="pmeta" style="margin-top:6px">'+esc(t('Average of every check-in in the quarter. ▲/▼ is against the quarter before.'))+'</div>'+
  '</div>';
  h += '<div class="mentorLabel" style="margin-top:14px">'+esc(t('How we’re doing'))+'</div><div class="hqGrid">'+m.scales.map(hqMiniHtml_).join('')+'</div>';
  h += '<div class="mentorLabel" style="margin-top:14px">'+esc(t('Habits'))+' · '+esc(t('said yes'))+'</div><div class="hqGrid">'+m.yes.map(hqMiniHtml_).join('')+'</div>';
  if(m.monthly.length) h += '<div class="mentorLabel" style="margin-top:14px">'+esc(t('Monthly Check-In'))+'</div><div class="hqGrid">'+m.monthly.map(hqMiniHtml_).join('')+'</div>';
  return h;
}
/* The deck's "By quarter" slides, from the same model. */
function hqSlides_(campus, kicker){
  var m = hqModel_(campus);
  if(!m || !m.hasData) return [];
  var out = [];
  var sub = m.compared && m.score.delta!==null
    ? (m.score.delta>0?'▲ ':m.score.delta<0?'▼ ':'')+Math.abs(m.score.delta)+'% '+gpT('vs {q}',{q:m.score.prevLabel})
    : String(m.year);
  out.push({ kind:'qchart', kicker:kicker, title:t('Staff Health Score by quarter'), sub:sub, series:m.score,
    good: m.score.delta===null ? null : (m.score.delta>=0) });
  out.push({ kind:'qmulti', kicker:kicker, title:t('By quarter')+' · '+t('How we’re doing'), sub:String(m.year), items:m.scales });
  out.push({ kind:'qmulti', kicker:kicker, title:t('By quarter')+' · '+t('Habits'), sub:m.year+' · 1/2', items:m.yes.slice(0,4) });
  out.push({ kind:'qmulti', kicker:kicker, title:t('By quarter')+' · '+t('Habits'), sub:m.year+' · 2/2', items:m.yes.slice(4) });
  if(m.monthly.length) out.push({ kind:'qmulti', kicker:kicker, title:t('By quarter')+' · '+t('Monthly Check-In'), sub:String(m.year), items:m.monthly });
  return out;
}
function hqSlideHtml_(sl){
  var head = '<div class="hxHead"><div class="hxKicker">'+esc(sl.kicker)+'</div><div class="hxTitle">'+esc(sl.title)+'</div>'+
    '<div class="hxWhen'+(sl.good===true?' good':sl.good===false?' bad':'')+'">'+esc(sl.sub)+'</div></div>';
  if(sl.kind==='qchart'){
    return '<div class="hxSlide hxQ">'+head+'<div class="hxChart">'+hqColumnsHtml_(sl.series, true)+'</div></div>';
  }
  return '<div class="hxSlide hxQ">'+head+'<div class="hxGrid hxMinis n'+sl.items.length+'">'+sl.items.map(function(ser){
    return '<div class="hxItem"><div class="hxMiniTop"><span class="hxLbl">'+esc(t(ser.label))+'</span>'+
      '<span class="hxMiniVal">'+(ser.latest ? esc(hqFmt_(ser.latest.value, ser.unit)) : '—')+
      (ser.delta!==null ? ' <span class="hxTrend inline '+(((ser.delta>0)===ser.higherBetter)||ser.delta===0?'good':'bad')+'">'+(ser.delta>0?'▲':ser.delta<0?'▼':'—')+' '+Math.abs(ser.delta)+'%</span>' : '')+
      '</span></div>'+hqColumnsHtml_(ser, false)+'</div>';
  }).join('')+'</div></div>';
}
/* The same columns on the PNG canvas. */
function hqCanvasColumns_(g, v, ser, x, y, w, h, big, T){
  var n = ser.points.length, slot = w/n, bw = Math.min(big ? 110 : 56, slot*0.5);
  var labelH = big ? 90 : 44, top = big ? 60 : 58;
  var plotH = h-top-labelH, base = y+top+plotH, max = hqMax_(ser);
  var lastIdx = -1; ser.points.forEach(function(p,i){ if(p.value!==null) lastIdx=i; });
  g.fillStyle = v('--border'); g.fillRect(x, base, w, 2);
  ser.points.forEach(function(p,i){
    var cx = x+slot*i+slot/2;
    g.textAlign = 'center';
    if(p.value===null){
      g.fillStyle = v('--muted'); g.font = (big?34:22)+'px Koulen, "Kantumruy Pro", sans-serif'; g.fillText('—', cx, base-10);
    } else {
      var bh = Math.max(4, plotH*(p.value/max)), ty = base-bh, r = Math.min(big?8:5, bw/2, bh);
      g.globalAlpha = i===lastIdx ? 1 : 0.45; g.fillStyle = v('--accent');
      g.beginPath(); g.moveTo(cx-bw/2, base); g.lineTo(cx-bw/2, ty+r); g.quadraticCurveTo(cx-bw/2, ty, cx-bw/2+r, ty);
      g.lineTo(cx+bw/2-r, ty); g.quadraticCurveTo(cx+bw/2, ty, cx+bw/2, ty+r); g.lineTo(cx+bw/2, base); g.closePath(); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = v('--ink'); g.font = (big?44:26)+'px Koulen, "Kantumruy Pro", sans-serif'; g.fillText(hqFmt_(p.value, ser.unit), cx, ty-12);
    }
    g.fillStyle = v('--muted'); g.font = (big?'500 28px':'500 20px')+' "Kantumruy Pro", system-ui, sans-serif'; g.fillText(p.label, cx, base+(big?36:26));
    if(big && p.delta!==null){
      var good = p.delta===0 ? null : ((p.delta>0) === ser.higherBetter);
      g.fillStyle = good===null ? v('--muted') : v(good?'--good':'--bad'); g.font = '700 26px "Kantumruy Pro", system-ui, sans-serif';
      g.fillText((p.delta>0?'▲':p.delta<0?'▼':'—')+' '+Math.abs(p.delta)+'%', cx, base+72);
    }
  });
  g.textAlign = 'left';
}

/* Sending the week. Every 1-10 question has to be answered — a composite built
   on gaps would be worse than no score at all. The server checks the same thing. */
function weekSubmit(btn){
  var wk = Number(S.healthWeek || thisWeek());
  var d = weekDraftFor(wk);
  var missing = WEEK_SCALE_QS.filter(function(q){ return d[q.id]===undefined; });
  if(missing.length){
    showMsg(t('Answer the 1-10 questions first.'));
    return;
  }
  var payload = {};
  WEEK_SCALE_QS.forEach(function(q){ payload[q.id] = Number(d[q.id]); });
  WEEK_NUM_QS.forEach(function(q){ payload[q.id] = Number(d[q.id])||0; });
  WEEK_YESNO_QS.forEach(function(q){ payload[q.id] = d[q.id]===1; });
  // Only sent on the week that closes out a month — left out entirely the
  // rest of the time, so saveMyWeek doesn't write a "No" nobody was asked.
  if(isMonthEndWeek_(wk)){
    WEEK_MONTHLY_QS.forEach(function(q){ payload[q.id] = d[q.id]===1; });
  }

  /* A bad connection (or none at all) queues this instead of losing it —
     see gpQueuePut_. Same close-the-form, same confirmation, just worded
     for "saved here, not there yet" instead of "saved". */
  function queueOffline(){
    gpQueuePut_('week:'+wk, 'saveMyWeek', [S.auth.user, S.auth.pin, wk, payload]);
    S.checkins = (S.checkins||[]).filter(function(c){ return Number(c.week)!==wk; })
      .concat([Object.assign({week:wk, source:'weekly', days:7}, payload)]);
    S.weekForm = null; S.weekDraft = null; S.weekDraftFor = null;
    S.weekJustSaved = wk;
    showMsg(gpT('Week {wk}’s check-in saved on your phone — it’ll sync once you’re back online.',{wk:wk}));
    render();
  }
  btn.disabled = true; btn.textContent = t('Saving…');
  if(!gpOnline_()){ queueOffline(); return; }
  run('saveMyWeek', [S.auth.user, S.auth.pin, wk, payload], function(res){
    if(res && res.ok){
      S.checkins = res.checkins || [];
      S.weekForm = null; S.weekDraft = null; S.weekDraftFor = null;
      S.weekJustSaved = wk;
      showMsg(gpT('Week {wk}’s check-in is saved.',{wk:wk}));
      /* The base total includes this now, so pull it fresh rather than showing a
         stale average next to a figure that just changed. */
      run('getData', [''], function(dd){ if(dd && dd.entries) S.base = dd; render(); });
    } else {
      btn.disabled = false; btn.textContent = t('Submit my check-in');
      showMsg(t('That didn’t save — try again.'));
      render();
    }
  }, queueOffline);
}

function weekClear(){
  var wk = Number(S.healthWeek || thisWeek());
  run('deleteMyWeek', [S.auth.user, S.auth.pin, wk], function(res){
    if(res && res.ok){
      S.checkins = res.checkins || [];
      S.weekDraft = null; S.weekDraftFor = null;
      run('getData', [''], function(dd){ if(dd && dd.entries) S.base = dd; render(); });
    } else { showMsg(t('That didn’t save — try again.')); render(); }
  });
}

/* --- leave request ---
   A full screen (matching the mockup) rather than an inline card: the PTO
   allowance, the approval queue, and the request form all need room, and
   burying them in an accordion inside My Home would hide the one figure
   (days used against the 30-day cap) staff most need at a glance.

   Doubles as the mentor check-in: submitting a request is how you tell your
   mentor you're going. Working Outside Siem Reap and Special Condition are
   tracked but uncapped; Personal Time Off is what the 30-day allowance is
   for. */
function leaveTypeLabel_(type){
  return type==='special' ? 'Special Condition' : type==='outside' ? 'Working Outside Siem Reap' : 'Personal Time Off';
}
/* National holidays (Khmer New Year week, Pchum Ben, Christmas week) are not
   work days — the server sends them with the leave (holidayList_ in api.js),
   so a request over one doesn't spend anyone's 30 days. */
function leaveHolidaySet_(list){
  var set={};
  (list||[]).forEach(function(h){ for(var d=new Date(h.from+'T00:00:00Z'); d<=new Date(h.to+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+1)) set[d.toISOString().slice(0,10)]=h.name; });
  return set;
}
function leaveWorkDays_(from,to){
  var a=new Date(from+'T00:00:00Z'), b=new Date(to+'T00:00:00Z'), hol=leaveHolidaySet_(S.trips && S.trips.holidays);
  var n=0;
  for(var d=new Date(a); d<=b; d.setUTCDate(d.getUTCDate()+1)){
    var dow=d.getUTCDay();
    if(dow!==0 && dow!==6 && !hol[d.toISOString().slice(0,10)]) n++;
  }
  return n;
}
function leaveHolidayRange_(h){ return teamDate_(h.from).replace(/, \d{4}$/,'')+(h.to!==h.from?' – '+teamDate_(h.to).replace(/, \d{4}$/,''):''); }
function leaveHolidaysHtml_(list, year){
  var hs=(list||[]).filter(function(h){ return String(h.from).slice(0,4)===String(year); });
  if(!hs.length) return '';
  return '<div class="holidayNote" id="holidayNote">🎉 '+esc(gpT('National holidays in {year} aren’t counted:',{year:year}))+' '+
    hs.map(function(h){ return '<b>'+esc(t(h.name))+'</b> '+esc(leaveHolidayRange_(h)); }).join(' · ')+'</div>';
}

function leaveEntryHtml(){
  return '<h3 id="sec-leave">'+esc(t('Leave Request'))+'</h3>'+
    '<button class="card leaveEntry" id="goLeaveFromMe">'+
    '<span class="leaveEntryIcon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><path d="M8 8V3.5M16 8V3.5"/><path d="M8.5 14.5l2 2 4-4"/></svg></span>'+
    '<span style="flex:1"><div style="font-size:13.5px;font-weight:700">'+esc(t('Leave Request'))+'</div></span>'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--faint);flex:0 0 auto"><path d="M9 6l6 6-6 6"/></svg></button>';
}

function leaveHtml(){
  var h='<button class="linkbtn" id="leaveBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>';
  h+='<h2>'+esc(t('Leave Request'))+'</h2>';
  h+='<p class="sub">'+esc(t('Baked into My YWAM GP — nothing to fill out on another site.'))+'</p>';

  var d=S.trips;
  if(!d) return h+'<div class="card"><p class="sub" style="margin:6px 0">'+esc(t('Loading…'))+'</p></div>';

  var year=String(new Date().getFullYear());
  var yt=(d.totals&&d.totals[year])||{outside:0,special:0,personal:0,trips:0};
  var cap=d.ptoCap||30;
  if(!S.leaveDraft) S.leaveDraft={from:'',to:'',type:'',reason:'',coverage:'',ack:false};
  var draft=S.leaveDraft;
  var draftWorkDays = (draft.from && draft.to && draft.to>=draft.from) ? leaveWorkDays_(draft.from,draft.to) : 0;
  var projectedPersonal = yt.personal + (draft.type==='personal'?draftWorkDays:0);
  var barPct = Math.min(100, Math.round(yt.personal/cap*100));

  h+='<div class="allowCard">'+
    '<div class="allowTitle">'+esc(t('Personal Time Off'))+'</div>'+
    '<div class="allowNote">'+esc(t('UofN Cambodia allocates a maximum of 6 weeks (30 work days) off per year for vacation, furlough, support raising and home visits.'))+'</div>'+
    '<div class="allowNum"><b>'+yt.personal+'</b> '+esc(gpT('/ {cap} days used',{cap:cap}))+'</div>'+
    '<div class="allowBar"><div class="allowBarFill" style="width:'+barPct+'%"></div></div>'+
    '<div class="allowMini">'+
      '<span>'+esc(t('Working Outside Siem Reap'))+' <b>'+yt.outside+'d</b></span>'+
      '<span>'+esc(t('Special Condition'))+' <b>'+yt.special+'d</b></span>'+
    '</div>'+leaveHolidaysHtml_(d.holidays, year)+'</div>';

  var approvals=(S.tripRequests||[]);
  if(approvals.length){
    h+='<h3>'+esc(t('Awaiting Your Approval'))+'</h3><div class="card">';
    approvals.forEach(function(r){
      h+='<div class="histRow" style="border-top:0;padding-top:0">'+
        '<div class="histTop"><span class="histType">'+esc(r.name)+' · '+esc(t(leaveTypeLabel_(r.type)))+'</span>'+
        '<span class="pill pending">'+esc(t('Pending'))+'</span></div>'+
        '<div class="histDates">'+esc(r.from)+(r.to!==r.from?' → '+esc(r.to):'')+' · '+esc(gpT('{n} work days',{n:r.workDays}))+'</div>'+
        '<div class="approveRow">'+
          '<button class="approveBtn yes" data-trok="'+esc(r.id)+'">'+esc(t('Approve'))+'</button>'+
          '<button class="approveBtn no" data-trno="'+esc(r.id)+'">'+esc(t('Deny'))+'</button>'+
        '</div></div>';
    });
    h+='</div>';
  }

  h+='<h3>'+esc(t('New Request'))+'</h3><div class="card">';
  h+='<div class="field"><label class="fieldLabel">'+esc(t('Leave Dates'))+'</label>'+
     '<div class="dateRow"><input type="date" id="lv_from" value="'+esc(draft.from||'')+'">'+
     '<input type="date" id="lv_to" value="'+esc(draft.to||'')+'"></div></div>';
  h+='<div class="workDaysLine"><b>'+draftWorkDays+'</b> '+esc(t('work days requested (Mon–Fri)'))+'</div>';
  if(draft.from && draft.to && draft.to>=draft.from){
    var hol=leaveHolidaySet_(d.holidays), inside=[];
    for(var hd=new Date(draft.from+'T00:00:00Z'); hd<=new Date(draft.to+'T00:00:00Z'); hd.setUTCDate(hd.getUTCDate()+1)){ var k=hd.toISOString().slice(0,10), dw=hd.getUTCDay(); if(hol[k] && dw!==0 && dw!==6 && inside.indexOf(hol[k])===-1) inside.push(hol[k]); }
    if(inside.length) h+='<p class="hint" id="leaveHolidayHint" style="margin:-8px 0 12px;text-align:center">🎉 '+esc(gpT('{names} not counted — the base is closed.',{names:inside.map(function(n){ return t(n); }).join(', ')}))+'</p>';
  }

  h+='<div class="field"><label class="fieldLabel">'+esc(t('Leave Type'))+'</label><div class="typeChips">';
  [['outside','Working Outside Siem Reap','Not capped, tracked separately'],
   ['special','Special Condition','Not capped, tracked separately'],
   ['personal','Personal Time Off',"Counts against your 30-day allowance"]
  ].forEach(function(row){
    h+='<button type="button" class="typeChip'+(draft.type===row[0]?' on':'')+'" data-leavetype="'+row[0]+'">'+
       '<span class="typeDot"></span><span><div class="typeLabel">'+esc(t(row[1]))+'</div>'+
       '<div class="typeSub">'+esc(t(row[2]))+'</div></span></button>';
  });
  h+='</div></div>';

  if(draft.type==='personal' && projectedPersonal>cap){
    h+='<div class="noticeNote" style="background:var(--badSoft);color:var(--bad)">'+
       esc(t('This request would put you over your 30-day Personal Time Off allowance for the year.'))+'</div>';
  }

  h+='<div class="field"><label class="fieldLabel">'+esc(t('Reason'))+'</label>'+
     '<textarea id="lv_reason" maxlength="500" placeholder="'+esc(t('Why are you requesting this leave?'))+'">'+esc(draft.reason||'')+'</textarea></div>';
  h+='<div class="field"><label class="fieldLabel">'+esc(t('Ministry Coverage'))+'</label>'+
     '<textarea id="lv_coverage" maxlength="500" placeholder="'+esc(t('Who will cover your ministries while you’re away?'))+'">'+esc(draft.coverage||'')+'</textarea></div>';

  h+='<div class="noticeNote">'+esc(t('In-country leave needs at least 1 week notice · out-of-country leave needs at least 1 month notice.'))+'</div>';

  h+='<div class="ackRow"><button type="button" class="ackBox'+(draft.ack?' on':'')+'" id="lv_ack">'+
     '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>'+
     '<span>'+esc(t('I understand the 6-week (30-day) allowance for personal time off.'))+'</span></div>';

  var mentor = (S.me.mentorId && S.me.mentorStatus==='approved') ? personOf(S.me.mentorId) : null;
  var submitLabel = mentor ? gpT('Send to {name} for Approval',{name:mentor.name}) : t('Save this request');
  var canSubmit = draft.from && draft.to && draft.to>=draft.from && draft.type && draft.ack;
  h+='<button class="btn" id="saveLeave"'+(canSubmit?'':' disabled')+'>'+esc(submitLabel)+'</button>';
  if(!mentor) h+='<div class="hint">'+esc(t('Pick a mentor on your profile and these go to them for a quick yes.'))+'</div>';
  h+='</div>';

  h+='<h3>'+esc(t('My Requests'))+'</h3><div class="card">';
  if(d.trips.length){
    d.trips.slice(0,10).forEach(function(r){
      var pillCls = r.status==='declined'?'denied':(r.status==='approved'||r.status==='noted')?'approved':'pending';
      var pillLabel = r.status==='declined'?t('Denied'):r.status==='approved'?t('Approved'):r.status==='noted'?t('Noted'):t('Pending');
      h+='<div class="histRow"><div class="histTop"><span class="histType">'+esc(t(leaveTypeLabel_(r.type)))+'</span>'+
        '<span class="pill '+pillCls+'">'+esc(pillLabel)+'</span></div>'+
        '<div class="histDates">'+esc(r.from)+(r.to!==r.from?' → '+esc(r.to):'')+' · '+esc(gpT('{n} work days',{n:r.workDays}))+'</div></div>';
    });
  } else {
    h+='<p class="sub" style="margin:4px 0">'+esc(t('No requests yet.'))+'</p>';
  }
  h+='</div>';

  h+='<p class="hint" style="margin-top:10px">🔒 '+
     esc(t('Your team can see how many WORK days you’re away. Reason and coverage stay between you and your mentor.'))+'</p>';
  return h;
}

