/* ==================== Rocks and the Scorecard (Nov 2026, Uriah) ====================
   "I'm going to move OKRs to rocks. And we're going to move the KPI and numbers things to scorecard
   across our whole thing, as the OKRs are too complicated."

   ROCKS — a team's few priorities for a quarter: a title, whose it is, on track / off track / done,
   and a note. No percentages, no sliders, no targets. One model for everyone: a ministry's, a
   department's (ministry ''), leadership's (dept Campus Leadership, ministry '' — the same ones the
   leadership meeting shows), each with an owner or the team's. They come with the boot (S.rocks —
   every team's on both campuses; the board's sign-in gets title and status in S.org.rocks) and are
   written through saveRock / deleteRock; the server decides who may (rkCanWrite_ mirrors it only to
   decide what to draw).
     - rockHtml_(r, o) is the ONE way a rock and its on / off / done control is drawn — the meeting
       calls it with its own attribute prefix (data-lmrock…), every other page with data-rock…
     - rocksTabHtml_(sel)        My Ministry's Rocks tab (key still 'okr' / 'okrs') for any ministry,
                                 tool or leadership row;
     - rocksPersonHtml_(who)     a teammate's page: their focus, their own rocks, their ministry's;
     - rkLeadTile_ / rkPulse_ / leadRocksLineHtml_ / leadRocksDashHtml_   the small places that used
                                 to show "OKR progress";
     - rkEarlierHtml_            the objectives of earlier quarters, read only (nothing was deleted).
   Drafts live in S.rk (typing survives every redraw).

   THE SCORECARD — a ministry's weekly numbers page, with a goal per number (scoreBoardHtml_): each
   number, its goal, this week's figure with ✓ / ✗ (a mark, never colour alone) and the last thirteen
   weeks as small cells. Goals are set by whoever may change what the ministry tracks
   (canEditMetricsClient_) and live on the ministry's metricOverrides row (saveMetricGoals). */

/* ---------- rocks: what there is ---------- */
var ROCK_ST=[['on','On track'],['off','Off track'],['done','Done']];
function rkT_(){ return S.rk || (S.rk={ q:'now', d:{}, form:null, deptAdd:{} }); }
function rocksAll_(){ return S.rocks || (S.org && S.org.rocks) || []; }
/* this quarter or the next — the app's 13-week quarters of the week year, as the server's meetQ_ */
function rkQ_(which){ var y=thisWeekYear(), q=qOf(thisWeek())+1; if(which!=='next') return { year:y, q:q }; return q===4 ? { year:y+1, q:1 } : { year:y, q:q+1 }; }
function rocksFor_(campus, dept, ministry, which){
  var Q=rkQ_(which);
  return rocksAll_().filter(function(r){ return r.campus===campus && r.dept===dept && (ministry==null || (r.ministry||'')===ministry) && r.year===Q.year && r.q===Q.q; });
}
function rkOnTrack_(list){ return list.filter(function(r){ return r.status!=='off'; }).length; }
function rkMark_(s){ return s==='on' ? '✓ ' : s==='off' ? '✗ ' : '★ '; }
var RK_ST_NAME={ on:'On track', off:'Off track', done:'Done' };
function rkStName_(s){ return t(RK_ST_NAME[s] || RK_ST_NAME.on); }
function rkKey_(campus, dept, ministry){ return campus+'|'+dept+'|'+(ministry||''); }
/* who may write a rock here — the server's canWriteRock_, only to decide what to draw */
function rkCanWrite_(campus, dept, ministry){
  var me=S.me; if(!me || !S.auth || !S.auth.user || S.guest || S.stuPreview) return false;
  if(me.isAdmin) return true;
  if(campus!==me.campus) return false;
  if(dept===BL_DEPT) return me.dept===BL_DEPT;
  if(me.dept===dept) return true;
  if(me.dept===BL_DEPT && me.ministry===dept) return true;
  var k=dept+'|'+ministry;
  return !!ministry && ((me.ministries||[]).indexOf(k)>-1 || (me.leads||[]).indexOf(k)>-1);
}
function rkPeople_(campus, dept, ministry){
  var k=dept+'|'+ministry;
  return (S.roster||[]).filter(function(p){ return p.campus===campus; }).sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); }).map(function(p){
    var f = ministry ? ((p.dept===dept && p.ministry===ministry) || (p.ministries||[]).indexOf(k)>-1 || (p.leads||[]).indexOf(k)>-1) : p.dept===dept;
    return { id:p.id, name:p.name, sub:t(p.ministry||p.dept||''), first:f, group: f ? t(ministry||dept) : t('Everyone else') };
  });
}

/* ---------- one rock, drawn one way everywhere ----------
   o.p      the attribute prefix: 'rock' (data-rock, data-rockst="id|on", data-rockedit) or the meeting's 'lmrock'
   o.edit   may this reader change it (the three buttons); otherwise the status is a plain badge
   o.meeting  in the meeting going on: no Edit link    o.drop  an off-track rock offers "Drop it to Issues"
   o.who    say whose it is on the row    o.where  a word on where it belongs (a ministry's name) */
function rockHtml_(r, o){
  o=o||{}; var p=o.p||'rock', st=r.status==='off' || r.status==='done' ? r.status : 'on';
  var lines=String(r.note||'').split('\n').map(function(x){ return x.trim(); }).filter(Boolean), sub=[];
  if(o.who) sub.push(r.owner ? '👤 '+esc(firstName_(staffName_(r.owner)) || t('Someone who has left')) : '🤝 '+esc(t('The team')));
  if(o.where) sub.push(esc(o.where));
  var note = !lines.length ? '' : lines.length<=2 ? '<div class="rowSub rkNote">'+esc(lines.join('\n'))+'</div>'
    : '<details class="rkNoteFold"><summary class="rowSub">'+esc(lines[0])+' <span class="hint">'+esc(gpT('+{n} more',{n:lines.length-1}))+'</span></summary><div class="rowSub rkNote">'+esc(lines.slice(1).join('\n'))+'</div></details>';
  var h='<div class="lmRock '+st+'" data-'+p+'="'+esc(r.id)+'"><div class="lmRowHead"><div style="min-width:0"><b class="lmName">'+esc(r.title)+'</b>'+
    (sub.length ? '<div class="rowSub">'+sub.join(' · ')+'</div>' : '')+note+'</div>'+
    (o.edit && !o.meeting ? '<button class="linkbtn inline" data-'+p+'edit="'+esc(r.id)+'">'+esc(t('Edit'))+'</button>' : '')+'</div>';
  if(o.edit){
    h+='<div class="lmStRow" role="group" aria-label="'+esc(t('Status'))+'">'+ROCK_ST.map(function(s){ return '<button class="lmSt '+s[0]+(st===s[0]?' sel':'')+'" data-'+p+'st="'+esc(r.id)+'|'+s[0]+'" aria-pressed="'+(st===s[0])+'">'+rkMark_(s[0])+esc(t(s[1]))+'</button>'; }).join('')+
      (st==='off' && o.drop ? '<button class="hospChip" data-'+p+'drop="'+esc(r.id)+'">🧩 '+esc(t('Drop it to Issues'))+'</button>' : '')+'</div>';
  } else h+='<div class="lmStRow"><span class="lmSt sel '+st+' rkBadge">'+rkMark_(st)+esc(rkStName_(st))+'</span></div>';
  return h+'</div>';
}
/* the form a rock opens into: its title, whose it is, a note */
function rkFormHtml_(){
  var f=rkT_().form;
  var h='<div class="card rkForm" id="rkForm"><label class="f" style="margin-top:0">'+esc(t('The rock'))+'</label><input type="text" data-rkf="title" maxlength="120" value="'+esc(f.title||'')+'">'+
    '<label class="f">'+esc(t('Whose is it?'))+'</label>'+ppickHtml_({ key:'rko', people:rkPeople_(f.campus, f.dept, f.ministry), chosen:f.owner ? [f.owner] : [], multi:false, placeholder:t('Type a name — or leave empty for the whole team'),
      onPick:function(id){ rkT_().form.owner=id; render(); }, onRemove:function(){ rkT_().form.owner=''; render(); } })+
    (f.owner ? '' : '<p class="hint" style="margin:4px 0 0">🤝 '+esc(t('Nobody picked: it is the whole team’s rock.'))+'</p>')+
    '<label class="f">'+esc(t('A short note (optional)'))+'</label><textarea data-rkf="note" rows="3" maxlength="1200" placeholder="'+esc(t('What done looks like, or where it stands'))+'">'+esc(f.note||'')+'</textarea>'+
    '<div class="btnRow" style="margin-top:10px"><button class="btn" id="rkSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="rkCancel">'+esc(t('Cancel'))+'</button></div>'+
    '<button class="linkbtn teamDelete" id="rkDel">'+esc(t('Delete this rock'))+'</button>';
  return h+'</div>';
}
/* a team's rocks in one card: the heading with "n of m on track", each rock, and — for someone who may
   write them — one line to add another */
function rkGroupHtml_(g){
  var T=rkT_(), key=rkKey_(g.campus, g.dept, g.ministry), list=g.rocks, canAdd=g.edit && g.add!==false;
  var h='<div class="card rkGroup" data-rkscope="'+esc(key)+'"><div class="lmRowHead"><div class="goalCardTitle">'+g.title+'</div>'+
    (list.length ? '<span class="hint rkCount">'+esc(gpT('{d} of {n} on track',{d:rkOnTrack_(list), n:list.length}))+'</span>' : '')+'</div>';
  if(!list.length) h+='<p class="sub rkEmpty" style="margin:0 0 6px">'+esc(g.empty || t('No rocks yet for this quarter.'))+'</p>';
  list.forEach(function(r){ h+=(T.form && T.form.id===r.id && g.edit) ? rkFormHtml_() : rockHtml_(r, { edit:g.edit, who:g.who!==false, where:g.where ? g.where(r) : '' }); });
  if(canAdd){
    if(g.fold && !T.deptAdd[key] && !T.d[key]) h+='<button class="linkbtn inline rkAddOpen" data-rkaddopen="'+esc(key)+'">＋ '+esc(g.fold)+'</button>';
    else h+='<div class="lmAddRow rkAdd"><input type="text" data-rkadd="'+esc(key)+'" maxlength="120" value="'+esc(T.d[key]||'')+'" placeholder="'+esc(t('A rock: one thing that must get done this quarter'))+'" aria-label="'+esc(t('Add a rock'))+'">'+
      '<button class="btn small" data-rkaddbtn="'+esc(key)+'">'+esc(t('Add'))+'</button></div>';
  }
  return h+'</div>';
}
function rkQuarterSegHtml_(){
  var T=rkT_(), C=rkQ_('now'), N=rkQ_('next');
  return '<div class="leadFilters rkQSeg"><button class="leadSeg'+(T.q!=='next'?' on':'')+'" data-rkq="now">'+esc(gpT('This quarter · Q{q} {year}',{q:C.q, year:C.year}))+'</button>'+
    '<button class="leadSeg'+(T.q==='next'?' on':'')+'" data-rkq="next">'+esc(gpT('Next · Q{q} {year}',{q:N.q, year:N.year}))+'</button></div>';
}
/* leadership's rocks on a campus, by person — the team's first (as the meeting lays them out) */
function rkLeadGroupsHtml_(campus, edit, which){
  var rocks=rocksFor_(campus, BL_DEPT, '', which), owners=[], seen={}, h='';
  rocks.forEach(function(r){ var k=r.owner||''; if(!seen[k]){ seen[k]=1; owners.push(k); } });
  owners.sort(function(a,b){ return a==='' ? -1 : b==='' ? 1 : String(staffName_(a)).localeCompare(String(staffName_(b))); });
  if(owners.indexOf('')===-1) owners.unshift('');
  owners.forEach(function(k, i){
    var list=rocks.filter(function(r){ return (r.owner||'')===k; });
    if(!list.length && !(k==='' && (edit || !rocks.length))) return;
    h+=rkGroupHtml_({ campus:campus, dept:BL_DEPT, ministry:'', rocks:list, edit:edit, who:false, add:k==='',
      title: k ? '👤 '+esc(staffName_(k) || t('Someone who has left')) : '🤝 '+esc(t('The whole team')),
      empty: rocks.length ? t('No rocks for the whole team yet.') : t('No leadership rocks yet for this quarter.') });
  });
  return h;
}

/* ---------- My Ministry → Rocks ---------- */
function rocksTabHtml_(sel){
  var T=rkT_(), which=T.q==='next' ? 'next' : 'now', campus=S.me.campus, Q=rkQ_(which);
  var isBL = sel.dept===BL_DEPT, myDept = S.me.dept;
  var h='<div id="rocksTab"><h3 style="margin-top:0">🪨 '+esc(gpT('Q{q} Rocks',{q:Q.q}))+'</h3>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(t('The few things that must get done this quarter. Tap one to say where it stands: on track, off track or done.'))+'</p>'+rkQuarterSegHtml_();
  var earlier=[];
  if(isBL){
    h+=rkLeadGroupsHtml_(campus, rkCanWrite_(campus, BL_DEPT, ''), which);
    /* a department's director also carries that department's rocks */
    var view=S.lwView, od = view ? (view.role==='dept' ? view.key : null) : myOversightDept_();
    if(od){ h+=rkGroupHtml_({ campus:campus, dept:od, ministry:'', rocks:rocksFor_(campus, od, null, which), edit:rkCanWrite_(campus, od, ''),
      title:(MIN_EMOJI[od]?MIN_EMOJI[od]+' ':'')+esc(t(od)), where:function(r){ return r.ministry ? t(r.ministry) : ''; }, empty:t('No rocks for this department yet.') }); earlier.push(od); }
    earlier.unshift(BL_DEPT);
  } else {
    var canMin=rkCanWrite_(campus, sel.dept, sel.min), canDept=rkCanWrite_(campus, sel.dept, '');
    h+=rkGroupHtml_({ campus:campus, dept:sel.dept, ministry:sel.min, rocks:rocksFor_(campus, sel.dept, sel.min, which), edit:canMin,
      title:(MIN_EMOJI[sel.min]?MIN_EMOJI[sel.min]+' ':'')+esc(t(sel.min)), empty:t('No rocks for this ministry yet.') });
    var dl=rocksFor_(campus, sel.dept, '', which);
    if(dl.length || canDept) h+=rkGroupHtml_({ campus:campus, dept:sel.dept, ministry:'', rocks:dl, edit:canDept, fold:t('A rock for the whole department'),
      title:(MIN_EMOJI[sel.dept]?MIN_EMOJI[sel.dept]+' ':'')+esc(gpT('{dept} — the whole department',{dept:t(sel.dept)})), empty:t('No rocks for the whole department yet.') });
    earlier.push(sel.dept);
  }
  /* leadership's rocks, for everyone to see — not to change */
  if(!isBL && myDept!==BL_DEPT && !S.me.isAdmin) h+=leadershipRocksHtml_(which);
  if(S.me.isAdmin) h+=rkAdminHtml_(which);
  return h+rkEarlierHtml_(campus, earlier)+'</div>';
}
function leadershipRocksHtml_(which){
  var camps=[S.me.campus].concat(CAMPUSES.map(function(c){ return c.id; }).filter(function(c){ return c!==S.me.campus; }));
  var h='<h3 id="leadRocks">🧭 '+esc(t('Leadership’s rocks'))+'</h3><p class="sub" style="margin:0 0 6px">'+esc(t('What the leadership team is working on this quarter — to see, not to change.'))+'</p>', any=false;
  camps.forEach(function(c){
    var list=rocksFor_(c, BL_DEPT, '', which); if(!list.length) return; any=true;
    h+='<div class="card rkGroup" data-leadrocks="'+esc(c)+'"><div class="lmRowHead"><div class="goalCardTitle">'+esc(campusName(c))+'</div><span class="hint rkCount">'+esc(gpT('{d} of {n} on track',{d:rkOnTrack_(list), n:list.length}))+'</span></div>'+
      list.map(function(r){ return rockHtml_(r, { edit:false, who:true }); }).join('')+'</div>';
  });
  return any ? h : h+'<p class="sub">'+esc(t('No leadership rocks yet for this quarter.'))+'</p>';
}
/* an admin sees — and can change — every department's rocks, on both campuses */
function rkAdminHtml_(which){
  var T=rkT_(), Q=rkQ_(which), all=rocksAll_().filter(function(r){ return r.year===Q.year && r.q===Q.q; });
  var pick=T.adm || (T.adm={ campus:S.me.campus, dept:'' });
  var depts=Object.keys(getDepartments(pick.campus));
  if(depts.indexOf(pick.dept)===-1) pick.dept=depts[0]||'';
  var h='<h3 id="adminRocks">🗂️ '+esc(t('Every department’s rocks'))+'</h3><div class="okrAdminNew rkAdminNew">'+
    '<label class="pick"><span>'+esc(t('Campus'))+'</span><select id="rkAdmCampus">'+CAMPUSES.map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===pick.campus?' selected':'')+'>'+esc(c.short)+'</option>'; }).join('')+'</select></label>'+
    '<label class="pick"><span>'+esc(t('Department'))+'</span><select id="rkAdmDept">'+depts.map(function(d){ return '<option value="'+esc(d)+'"'+(d===pick.dept?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+'</select></label></div>'+
    '<div class="lmAddRow rkAdd" style="margin:0 0 10px"><input type="text" id="rkAdmTitle" maxlength="120" value="'+esc(T.d.adm||'')+'" placeholder="'+esc(t('A rock: one thing that must get done this quarter'))+'" aria-label="'+esc(t('Add a rock'))+'"><button class="btn small" id="rkAdmAdd">'+esc(t('Add'))+'</button></div>';
  if(!all.length) return h+'<p class="sub">'+esc(t('No rocks anywhere yet for this quarter.'))+'</p>';
  var keys=[], by={};
  all.forEach(function(r){ var k=r.campus+'|'+r.dept; if(!by[k]){ by[k]=[]; keys.push(k); } by[k].push(r); });
  keys.sort();
  h+='<div class="accCard">';
  keys.forEach(function(k){
    var p=k.split('|'), list=by[k];
    h+=accRowHtml('adminRockAcc', k, esc(campusName(p[0]))+' · '+(MIN_EMOJI[p[1]]?MIN_EMOJI[p[1]]+' ':'')+esc(t(p[1])), esc(gpT('{d} of {n} on track',{d:rkOnTrack_(list), n:list.length})), function(){
      return '<div data-rkadmin="'+esc(k)+'">'+list.map(function(r){ return (T.form && T.form.id===r.id) ? rkFormHtml_() : rockHtml_(r, { edit:true, who:true, where:r.ministry ? t(r.ministry) : '' }); }).join('')+'</div>';
    });
  });
  return h+'</div>';
}
/* What was there before rocks: the objectives of earlier quarters, kept and shown — nothing to change. */
function rkEarlierHtml_(campus, depts){
  if(!S.base || !S.base.okrs) return '';
  var moved={}; rocksAll_().forEach(function(r){ if(r.fromOkr) moved[r.fromOkr]=1; });
  var list=S.base.okrs.filter(function(o){ return o.campus===campus && depts.indexOf(o.dept)>-1 && !moved[o.id]; });
  if(!list.length) return '';
  var R=baseR();
  return '<details class="card rkEarlier" id="rkEarlier"><summary class="goalCardTitle">🗄️ '+esc(gpT('Earlier objectives ({n})',{n:list.length}))+'</summary>'+
    '<p class="hint" style="margin:6px 0">'+esc(t('From before we moved to rocks. Kept as they were — nothing here can be changed.'))+'</p>'+
    list.map(function(o){ return '<div class="rkOld"><span>'+esc(o.objective)+'<small>Q'+Number(o.quarter)+(o.dept ? ' · '+esc(t(o.dept)) : '')+'</small></span><b>'+R.objProgress(o)+'%</b></div>'; }).join('')+'</details>';
}

/* ---------- a person's rocks: on a teammate's page (Team → tap someone) ---------- */
function rocksPersonHtml_(who){
  var Q=rkQ_('now'), dept = who.dept==='Base Director' ? BL_DEPT : who.dept;
  var h='<h3>🪨 '+esc(gpT('Q{q} Rocks',{q:Q.q}))+'</h3>';
  var focus=(typeof jobFocus==='function') ? jobFocus(dept, who.ministry) : null;
  if(focus) h+='<div class="focusCard"><div class="fLabel">'+esc(t('Their focus'))+'</div><div class="fMin">'+esc(t(who.ministry || dept))+'</div><p>'+esc(focus)+'</p></div>';
  var mine=rocksAll_().filter(function(r){ return r.owner===who.id && r.year===Q.year && r.q===Q.q; });
  var isBL=dept===BL_DEPT, team=rocksFor_(who.campus, dept, isBL ? '' : (who.ministry||''), 'now').filter(function(r){ return r.owner!==who.id; });
  var od=oversightDeptOf_(who); if(od) team=team.concat(rocksFor_(who.campus, od, '', 'now').filter(function(r){ return r.owner!==who.id; }));
  if(!mine.length && !team.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('No rocks set for their team this quarter.'))+'</p></div>';
  if(mine.length) h+='<div class="card rkGroup" data-rkperson="'+esc(who.id)+'"><div class="lmRowHead"><div class="goalCardTitle">👤 '+esc(gpT('{name}’s rocks',{name:firstName_(who.name)}))+'</div><span class="hint rkCount">'+esc(gpT('{d} of {n} on track',{d:rkOnTrack_(mine), n:mine.length}))+'</span></div>'+
    mine.map(function(r){ return rockHtml_(r, { edit:false, where:r.ministry ? t(r.ministry) : (r.dept===BL_DEPT ? t('Campus Leadership') : t(r.dept)) }); }).join('')+'</div>';
  if(team.length) h+='<div class="card rkGroup" data-rkteam="1"><div class="lmRowHead"><div class="goalCardTitle">'+(isBL ? '🧭 '+esc(t('Leadership’s rocks')) : (MIN_EMOJI[who.ministry]?MIN_EMOJI[who.ministry]+' ':'')+esc(gpT('{team}’s rocks',{team:t(who.ministry || dept)})))+'</div><span class="hint rkCount">'+esc(gpT('{d} of {n} on track',{d:rkOnTrack_(team), n:team.length}))+'</span></div>'+
    team.map(function(r){ return rockHtml_(r, { edit:false, who:true }); }).join('')+'</div>';
  return h;
}

/* ---------- the small places that used to say "OKR progress" ---------- */
function leadRocks_(){ if(brOn_()){ var Q=rkQ_('now'); return ((S.meet && S.meet.rocks) || []).filter(function(r){ return r.year===Q.year && r.q===Q.q; }); } return rocksFor_(S.me.campus, BL_DEPT, '', 'now'); }
/* Campus Leadership's Overview tile (#lbOkrTile opens the Rocks tab) */
function rkLeadTile_(){
  var l=leadRocks_(), q=rkQ_('now').q;
  return '<button class="mmTile lbTileBtn lbNav" data-lwtab="okrs" id="lbOkrTile"><div class="mmTileName">🪨 '+esc(gpT('Q{q} Rocks',{q:q}))+'</div><div class="mmTileNum">'+(l.length ? rkOnTrack_(l)+'/'+l.length : '—')+'</div>'+
    '<div class="mmTileSub">'+esc(l.length ? t('on track') : t('None set yet'))+'</div></button>';
}
/* a department's rocks this quarter (every ministry's in it), for its pulse */
function rkPulse_(dept){ var l=rocksFor_(S.me.campus, dept, null, 'now'); return l.length ? { n:l.length, on:rkOnTrack_(l) } : null; }
/* one quiet line above the meeting notes — tap it for each rock */
function leadRocksLineHtml_(){
  var l=leadRocks_(); if(!l.length) return '';
  return '<details class="leadNoteOkr" id="leadNoteRocks"'+(S.leadNoteRocksOpen?' open':'')+'><summary>🪨 '+esc(gpT('Q{q} Rocks',{q:rkQ_('now').q}))+' · <b>'+esc(gpT('{d} of {n} on track',{d:rkOnTrack_(l), n:l.length}))+'</b></summary>'+
    l.map(function(r){ return '<div class="leadNoteOkrRow rkLine"><span class="leadNoteOkrName">'+esc(r.title)+'</span><b class="rkLineSt '+esc(r.status)+'">'+rkMark_(r.status)+esc(rkStName_(r.status))+'</b></div>'; }).join('')+'</details>';
}
/* someone in Campus Leadership with no role picked yet has no tabs: their rocks sit above the board */
function leadRocksDashHtml_(){
  return '<div id="leadRocksDash">'+rkLeadGroupsHtml_(S.me.campus, rkCanWrite_(S.me.campus, BL_DEPT, ''), 'now')+'</div>';
}
/* the quarter report (the board's Report tab): a campus's rocks with where each stands */
function rkReportHtml_(campus, year, q){
  var list=rocksAll_().filter(function(r){ return r.campus===campus && r.year===year && r.q===q; });
  var h='<div class="repSub">'+esc(gpT('Rocks for Q{q}',{q:q}))+(list.length ? ' · '+esc(gpT('{d} of {n} on track',{d:rkOnTrack_(list), n:list.length})) : '')+'</div>';
  return h+(list.length ? list.map(function(r){ return '<div class="repObj"><span>'+esc(r.title)+'<small>'+esc(t(r.dept))+(r.ministry ? ' · '+esc(t(r.ministry)) : '')+'</small></span><b class="rkLineSt '+esc(r.status)+'">'+rkMark_(r.status)+esc(rkStName_(r.status))+'</b></div>'; }).join('')
    : '<div class="repEmpty">'+esc(t('None set for this quarter.'))+'</div>');
}

/* ---------- saving ---------- */
var RK_ERR={ not_authorized:'Only that team can change its rocks.', too_many:'That’s the most this list can hold.', past:'An earlier quarter’s rocks are kept as they were.', bad_title:'Give it a name first.', not_found:'That rock is no longer there.' };
function rocksTake_(list){
  if(!Array.isArray(list)) return; S.rocks=list;
  if(S.meet && S.meet.campus) S.meet.rocks=list.filter(function(r){ return r.campus===S.meet.campus && r.dept===BL_DEPT && !r.ministry; });
}
/* the meeting saved one of leadership's rocks: the same rocks everywhere else on the page */
function rocksFromMeet_(m){
  if(brOn_()) return;   // the Advisory Board's rocks are its own: never among the campuses'
  if(!m || !m.campus || !Array.isArray(m.rocks) || !Array.isArray(S.rocks)) return;
  S.rocks=S.rocks.filter(function(r){ return !(r.campus===m.campus && r.dept===BL_DEPT && !r.ministry); }).concat(m.rocks);
}
function rkCall_(fn, arg, after){
  if(S.rkBusy) return; S.rkBusy=true;
  run(fn,[S.auth.user,S.auth.pin,arg],function(d){ S.rkBusy=false;
    if(d && d.ok){ rocksTake_(d.rocks); if(after) after(d); }
    else showMsg(t((d && RK_ERR[d.err]) || 'That didn’t save — try again.'));
    render(); },
    function(){ S.rkBusy=false; showMsg(t('No connection — try again when you are online.')); render(); });
}
function rkFind_(id){ return rocksAll_().filter(function(r){ return r.id===id; })[0]; }
function rkAdd_(key){
  var T=rkT_(), p=key.split('|'), title=String(T.d[key]||'').trim(); if(!title){ showMsg(t('Give it a name first.')); return; }
  var Q=rkQ_(T.q);
  rkCall_('saveRock', { campus:p[0], dept:p[1], ministry:p[2]||'', title:title, owner:(S.me.campus===p[0] && p[1]!==BL_DEPT) ? S.me.id : '', year:Q.year, q:Q.q, status:'on', note:'' }, function(){ T.d[key]=''; });
}
function bindRocks_(){
  var T=rkT_(), each=function(sel, fn){ document.querySelectorAll(sel).forEach(function(b){ b.onclick=function(){ gpTap(); fn(b); }; }); };
  each('[data-rkq]', function(b){ T.q=b.getAttribute('data-rkq'); T.form=null; render(); });
  each('[data-rkaddopen]', function(b){ T.deptAdd[b.getAttribute('data-rkaddopen')]=true; render(); var i=document.querySelector('[data-rkadd="'+b.getAttribute('data-rkaddopen')+'"]'); if(i) i.focus(); });
  document.querySelectorAll('[data-rkadd]').forEach(function(inp){ var k=inp.getAttribute('data-rkadd');
    inp.oninput=function(){ T.d[k]=inp.value; };
    inp.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); T.d[k]=inp.value; rkAdd_(k); } }; });
  each('[data-rkaddbtn]', function(b){ rkAdd_(b.getAttribute('data-rkaddbtn')); });
  each('[data-rockst]', function(b){ var p=b.getAttribute('data-rockst').split('|'), r=rkFind_(p[0]); if(!r || r.status===p[1]) return;
    rkCall_('saveRock', { id:r.id, title:r.title, owner:r.owner||'', year:r.year, q:r.q, status:p[1], note:r.note||'' }); });
  each('[data-rockedit]', function(b){ var r=rkFind_(b.getAttribute('data-rockedit')); if(!r) return;
    T.form={ id:r.id, title:r.title, owner:r.owner||'', note:r.note||'', status:r.status, year:r.year, q:r.q, campus:r.campus, dept:r.dept, ministry:r.ministry||'' }; render();
    var f=document.getElementById('rkForm'); if(f && f.scrollIntoView) f.scrollIntoView({ block:'nearest' }); });
  document.querySelectorAll('[data-rkf]').forEach(function(el){ el.oninput=function(){ if(T.form) T.form[el.getAttribute('data-rkf')]=el.value; }; });
  var sv=document.getElementById('rkSave'); if(sv) sv.onclick=function(){ var f=T.form; if(!String(f.title||'').trim()){ showMsg(t('Give it a name first.')); return; }
    rkCall_('saveRock', { id:f.id, title:f.title, owner:f.owner, year:f.year, q:f.q, status:f.status, note:f.note }, function(){ T.form=null; showMsg(t('Saved')); }); };
  var cn=document.getElementById('rkCancel'); if(cn) cn.onclick=function(){ T.form=null; render(); };
  var dl=document.getElementById('rkDel'); if(dl) dl.onclick=function(){ if(!gpAsk_(t('Delete this rock?'))) return; rkCall_('deleteRock', T.form.id, function(){ T.form=null; }); };
  var ac=document.getElementById('rkAdmCampus'); if(ac) ac.onchange=function(){ T.adm={ campus:ac.value, dept:'' }; render(); };
  var ad=document.getElementById('rkAdmDept'); if(ad) ad.onchange=function(){ T.adm.dept=ad.value; };
  var at=document.getElementById('rkAdmTitle'); if(at){ at.oninput=function(){ T.d.adm=at.value; }; at.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var x=document.getElementById('rkAdmAdd'); if(x) x.click(); } }; }
  var aa=document.getElementById('rkAdmAdd'); if(aa) aa.onclick=function(){ var title=String(T.d.adm||'').trim(), Q=rkQ_(T.q); if(!title){ showMsg(t('Give it a name first.')); return; }
    if(!T.adm || !T.adm.dept) return;
    rkCall_('saveRock', { campus:T.adm.campus, dept:T.adm.dept, ministry:'', title:title, owner:'', year:Q.year, q:Q.q, status:'on', note:'' }, function(){ T.d.adm=''; S.adminRockAcc[T.adm.campus+'|'+T.adm.dept]=true; }); };
  var ln=document.getElementById('leadNoteRocks'); if(ln) ln.ontoggle=function(){ S.leadNoteRocksOpen=ln.open; };
  bindScoreBoard_();
}

/* The numbers on a campus, for linking a weekly goal to one of them — grouped by department. */
function metricLinkOptions_(selected, noneLabel, campus){
  var deps=getDepartments(campus || S.me.campus);
  var h='<option value="">'+esc(t(noneLabel))+'</option>';
  Object.keys(deps).forEach(function(d){
    h+='<optgroup label="'+esc(t(d))+'">';
    Object.keys(deps[d]).forEach(function(min){ deps[d][min].forEach(function(met){ var key=d+'|'+min+'|'+met;
      h+='<option value="'+esc(key)+'"'+(selected===key?' selected':'')+'>'+esc(t(min)+' · '+t(met))+'</option>'; }); });
    h+='</optgroup>';
  });
  return h;
}

/* ==================== the Scorecard ==================== */
var SBD_WEEKS=13, SBD_SHOW=6;
function sbdGoals_(campus, dept, ministry){
  var rec=((S.base && S.base.metricOverrides) || []).filter(function(r){ return r.campus===campus && r.dept===dept && r.ministry===ministry; })[0];
  return (rec && rec.goals && typeof rec.goals==='object') ? rec.goals : {};
}
/* is the week's figure where it should be? null when there is no figure or no goal to hold it against */
function sbdOn_(g, v){ if(!g || g.goal==null || v==null || v==='' || isNaN(Number(v))) return null; return g.dir==='lte' ? Number(v)<=g.goal : Number(v)>=g.goal; }
function sbdGoalText_(g, m){ return (g.dir==='lte' ? '≤ ' : '≥ ')+fmt(g.goal, m); }
function sbdDefaultDir_(m){ return (typeof LOWER_BETTER!=='undefined' && LOWER_BETTER[m]) ? 'lte' : 'gte'; }
/* The board at the top of a ministry's Scorecard: "n of m on target", then each number with its goal,
   the week's figure and its mark, and thirteen weeks of marks. `wk` is the week the page is on. */
function scoreBoardHtml_(campus, dept, ministry, data, wk, readOnly){
  var metrics=metricsFor(campus, dept, ministry); if(!metrics.length) return '';
  var entries=(data && data.entries) || {}, goals=sbdGoals_(campus, dept, ministry), key=rkKey_(campus, dept, ministry);
  var canSet=!readOnly && canEditMetricsClient_(campus, dept, ministry), E=!readOnly && S.sbd && S.sbd.key===key ? S.sbd : null;   // readOnly: the Advisory Board looking in
  var isCur=Number(wk)===Number(thisWeek());
  var withGoal=metrics.filter(function(m){ return goals[m]; }), on=0, waiting=0;
  withGoal.forEach(function(m){ var v=(entries[m]||{})[String(wk)], o=sbdOn_(goals[m], v); if(o===true) on++; else if(o===null) waiting++; });
  var h='<div class="card sbd" id="scoreBoard" data-sbd="'+esc(key)+'"><div class="lmRowHead sbdHead"><div style="min-width:0"><div class="goalCardTitle">📊 '+esc(t('Scorecard'))+'</div>'+
    '<div class="sbdLine" id="sbdHeadline">'+(withGoal.length
      ? '<b>'+esc(gpT(isCur ? '{d} of {n} on target this week' : '{d} of {n} on target in week {wk}',{d:on, n:withGoal.length, wk:wk}))+'</b>'+(waiting ? ' <span class="hint">· '+esc(gpT('{n} not entered yet',{n:waiting}))+'</span>' : '')
      : '<span class="hint">'+esc(canSet ? t('No goals yet. Set a goal for a number and each week shows ✓ or ✗ against it.') : t('No goals set yet for these numbers.'))+'</span>')+'</div></div>'+
    (canSet && !E ? '<button class="linkbtn inline" id="sbdEdit">🎯 '+esc(withGoal.length ? t('Goals') : t('Set goals'))+'</button>' : '')+'</div>';
  if(E){
    h+='<p class="hint" style="margin:0 0 8px">'+esc(t('A goal is for one week. Leave a box empty for no goal.'))+'</p>';
    metrics.forEach(function(m){ var v=E.vals[m]||{ goal:'', dir:sbdDefaultDir_(m) };
      h+='<div class="sbdSet"><span class="sbdName">'+esc(t(m))+'</span><select data-sbddir="'+esc(m)+'" aria-label="'+esc(t('At least or at most'))+'"><option value="gte"'+(v.dir!=='lte'?' selected':'')+'>'+esc(t('At least (≥)'))+'</option><option value="lte"'+(v.dir==='lte'?' selected':'')+'>'+esc(t('At most (≤)'))+'</option></select>'+
        '<input type="text" inputmode="decimal" data-sbdgoal="'+esc(m)+'" value="'+esc(v.goal)+'" placeholder="'+esc(t('a number'))+'" aria-label="'+esc(gpT('Goal for {metric}',{metric:t(m)}))+'"></div>'; });
    return h+'<div class="btnRow" style="margin-top:10px"><button class="btn" id="sbdSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="sbdCancel">'+esc(t('Cancel'))+'</button></div></div>';
  }
  /* the numbers with a goal first, then the ones that have figures, then the rest */
  var has_=function(m){ return Object.keys(entries[m]||{}).length>0; };
  var order=withGoal.concat(metrics.filter(function(m){ return !goals[m] && has_(m); }), metrics.filter(function(m){ return !goals[m] && !has_(m); }));
  var list=(S.sbdAll===key) ? order : order.slice(0, Math.max(SBD_SHOW, withGoal.length));
  list.forEach(function(m){
    var wks=entries[m]||{}, g=goals[m], v=wks[String(wk)], o=sbdOn_(g, v), has=v!==undefined && v!==null && v!=='';
    h+='<div class="sbdRow'+(g ? (o===true?' on':o===false?' off':'') : ' plain')+'" data-sbdrow="'+esc(m)+'"><div class="sbdTop"><span class="sbdName">'+esc(t(m))+'</span>'+
      (g ? '<span class="sbdGoal">'+esc(sbdGoalText_(g, m))+'</span>' : '')+
      '<span class="sbdVal">'+(has ? fmt(Number(v), m) : '—')+'</span>'+
      (g ? '<span class="lmMark sbdMark" aria-label="'+esc(o===true ? t('On target') : o===false ? t('Off target') : t('Not entered yet'))+'">'+(o===true?'✓':o===false?'✗':'–')+'</span>' : '')+'</div>';
    if(g){
      h+='<div class="sbdCells" role="img" aria-label="'+esc(gpT('The last {n} weeks',{n:SBD_WEEKS}))+'">';
      for(var w=Number(wk)-SBD_WEEKS+1; w<=Number(wk); w++){
        if(w<1){ h+='<span class="sbdC none" aria-hidden="true"></span>'; continue; }
        var x=wks[String(w)], ox=sbdOn_(g, x);
        h+='<span class="sbdC '+(ox===true?'on':ox===false?'off':'none')+(w===Number(wk)?' cur':'')+'" title="'+esc(gpT('Week {wk}',{wk:w})+(x===undefined || x===null ? '' : ': '+fmt(Number(x), m)))+'">'+(ox===true?'✓':ox===false?'✗':'–')+'</span>';
      }
      h+='</div>';
    } else if(has || Object.keys(wks).length) h+='<div class="sbdSub">'+esc(isCur ? t('this week') : gpT('Week {wk}',{wk:wk}))+gpVsLastWeek(wks, Number(wk), m, has ? v : '')+'</div>';
    h+='</div>';
  });
  if(order.length>list.length) h+='<button class="linkbtn inline" id="sbdAll">'+esc(gpT('Show all {n} numbers',{n:order.length}))+'</button>';
  else if(S.sbdAll===key && order.length>Math.max(SBD_SHOW, withGoal.length)) h+='<button class="linkbtn inline" id="sbdAll">'+esc(t('Show fewer'))+'</button>';
  return h+'</div>';
}
function bindScoreBoard_(){
  var box=document.getElementById('scoreBoard'); if(!box) return;
  var key=box.getAttribute('data-sbd'), p=key.split('|'), campus=p[0], dept=p[1], ministry=p[2];
  var ed=document.getElementById('sbdEdit'); if(ed) ed.onclick=function(){ gpTap(); var g=sbdGoals_(campus, dept, ministry), vals={};
    Object.keys(g).forEach(function(m){ vals[m]={ goal:String(g[m].goal), dir:g[m].dir==='lte' ? 'lte' : 'gte' }; }); S.sbd={ key:key, vals:vals }; render(); };
  var slot=function(m){ return S.sbd.vals[m] || (S.sbd.vals[m]={ goal:'', dir:sbdDefaultDir_(m) }); };
  box.querySelectorAll('[data-sbdgoal]').forEach(function(inp){ inp.oninput=function(){ slot(inp.getAttribute('data-sbdgoal')).goal=inp.value; }; });
  box.querySelectorAll('[data-sbddir]').forEach(function(sel){ sel.onchange=function(){ slot(sel.getAttribute('data-sbddir')).dir=sel.value; }; });
  var cn=document.getElementById('sbdCancel'); if(cn) cn.onclick=function(){ S.sbd=null; render(); };
  var sv=document.getElementById('sbdSave'); if(sv) sv.onclick=function(){
    var goals={}, bad='';
    Object.keys(S.sbd.vals).forEach(function(m){ var v=S.sbd.vals[m], raw=String(v.goal==null ? '' : v.goal).replace(/,/g,'').trim(); if(raw==='') return;
      var n=Number(raw), rg=kpiRange(m);
      if(isNaN(n)){ bad=bad || gpT('{metric}: type a number.',{metric:t(m)}); return; }
      if(rg && (n<rg.min || n>rg.max)){ bad=bad || gpT('{metric} goes from {min} to {max}.',{metric:t(m), min:rg.min, max:rg.max}); return; }
      goals[m]={ goal:n, dir:v.dir==='lte' ? 'lte' : 'gte' }; });
    if(bad){ showMsg(bad); return; }
    sv.disabled=true;
    run('saveMetricGoals',[S.auth.user,S.auth.pin,campus,dept,ministry,goals],function(d){
      if(d && d.ok){ if(S.base) S.base.metricOverrides=d.metricOverrides; S.sbd=null; showMsg((d.rejected||[]).length ? t('Saved — but a goal outside its range was left out.') : t('Saved')); }
      else { var no=d && d.err==='not_authorized'; showMsg(no ? t('Only the ministry’s leader, Campus Leadership or an admin sets the goals.') : t('That didn’t save — try again.')); }
      render(); }, function(){ showMsg(t('No connection — try again when you are online.')); render(); });
  };
  var all=document.getElementById('sbdAll'); if(all) all.onclick=function(){ S.sbdAll = S.sbdAll===key ? null : key; render(); };
  var gl=document.getElementById('mmGlance'); if(gl) gl.ontoggle=function(){ S.mmGlanceOpen=gl.open; };
}
