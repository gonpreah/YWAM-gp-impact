/* ==================== GPDTS on My Ministry (Nov 2026, Andrew) ====================
   "Instead of manually inputting numbers, I would like it to automatically track them." The DTS
   pipeline lives in the portal — DTS applications, and the people the team reaches out to and
   follows up there (＋ Add a contact, Contacts, next steps). This page is the school's home:
     Dashboard    where everyone is (reaching out → contacted → applied → accepted → here →
                  graduated, Khmer and international), the follow-ups due, and the year's numbers
     This school  the students who are here: mark graduated (with the day) and potential staff
     Lectures     each week's topic and speaker; the budget comes later
     Outreach     to come
   then Numbers (only what can't count itself: gospel, healings, salvations, baptisms), Tasks, OKRs.
   Server: dtsBoard / dtsMark / dtsSaveLecture / dtsDeleteLecture (api.js, "GPDTS"). Siem Reap's GPDTS
   only for now (DTS_TOOL in api.js). */
var DTS_TABS=['dtsdash','dtsclass','dtslect','dtsout'];
function isDtsMinistry_(dept, min){ return typeof autoMetricsFor==='function' && autoMetricsFor(S.me && S.me.campus, dept, min).length>0; }
function dtsTabs_(){ return [['dtsdash',t('Dashboard')],['dtsclass',t('This school')],['dtslect',t('Lectures')],['dtsout',t('Outreach')]]; }
var DTS_COLS=[['lead','Reaching out','🌱'],['contacted','Contacted','💬'],['applied','Applied','📝'],['accepted','Accepted','✅'],['arrived','Here now','🏠'],['graduated','Graduated this year','🎓']];
function dtsLoadHtml_(){
  if(S.dtsErr) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load the school.'))+'</p><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.dtsErr)+'</p>'+
    '<button class="btn ghost" id="dtsRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
}
function dtsPortalUrl_(extra){ return 'portal.html?what=dts'+(extra||''); }
function dtsPaneHtml_(cur){
  var d=S.dts;
  if(!d) return dtsLoadHtml_();
  if(cur==='dtsclass') return dtsClassHtml_(d);
  if(cur==='dtslect') return dtsLectHtml_(d);
  if(cur==='dtsout') return dtsOutHtml_();
  return dtsDashHtml_(d);
}
/* ---- Dashboard ---- */
function dtsDashHtml_(d){
  var c=d.counts||{};
  var h='<div class="card dtsPipe" id="dtsPipe"><h3 style="margin-top:0">🔥 '+esc(t('Where everyone is'))+'</h3>'+
    '<div class="dtsSteps">'+DTS_COLS.map(function(x){
      var v=c[x[0]]||{ khmer:0, international:0 }, n=(v.khmer||0)+(v.international||0);
      return '<div class="dtsStep'+(n?'':' empty')+'" data-dtscol="'+x[0]+'"><div class="dtsStepTop">'+x[2]+' <span class="dtsStepNum">'+n+'</span></div>'+
        '<div class="dtsStepName">'+esc(t(x[1]))+'</div><div class="dtsStepSplit">'+esc(gpT('{k} Khmer · {i} intl',{k:v.khmer||0, i:v.international||0}))+'</div></div>';
    }).join('')+'</div>'+
    '<p class="hint" style="margin:8px 0 0">'+esc(t('From the portal: DTS applications, and the people you add there and reach out to. Applied, accepted, enrolled, graduated, potential staff and students contacted are counted from it — nobody types them.'))+'</p>'+
    (d.portal ? '<div class="dtsBtns"><a class="btn small" id="dtsOpenPortal" href="'+esc(dtsPortalUrl_(''))+'" target="_blank" rel="noopener">🛂 '+esc(t('Open the DTS list in the portal'))+'</a>'+
      '<a class="btn ghost small" href="'+esc(dtsPortalUrl_(''))+'" target="_blank" rel="noopener">＋ '+esc(t('Add a contact'))+'</a></div>' : '')+'</div>';
  var due=d.due||[], today=d.today||todayStr();
  h+='<div class="card" id="dtsDue"><h3 style="margin-top:0">⏰ '+esc(t('Follow-ups due'))+(due.length ? ' · '+(due.length+(d.dueMore||0)) : '')+'</h3>';
  if(!due.length) h+='<p class="sub" style="margin:0">'+esc(t('Nothing due this week. Set a next step on each person in the portal and it shows here when it’s near.'))+'</p>';
  else h+='<div class="dtsDueList">'+due.map(function(x){
    var late=x.nextDate<today;
    var row='<span class="dtsDueName">'+esc(x.name)+'</span><span class="dtsDueStep">'+esc(x.nextStep||t('Follow up'))+'</span>'+
      '<span class="dtsDueDate'+(late?' late':'')+'">'+(late?'⏰ ':'')+esc(fmtDayShort_(x.nextDate))+'</span>';
    return d.portal ? '<a class="dtsDue" data-dtsdue="'+esc(x.id)+'" href="portal.html?open='+encodeURIComponent(x.id)+'" target="_blank" rel="noopener">'+row+'</a>' : '<div class="dtsDue" data-dtsdue="'+esc(x.id)+'">'+row+'</div>';
  }).join('')+'</div>'+(d.dueMore ? '<p class="hint" style="margin:6px 0 0">'+esc(gpT('{n} more in the portal',{n:d.dueMore}))+'</p>' : '');
  h+='</div>';
  h+='<h3 class="dtsH">📊 '+esc(t('This year’s numbers'))+'</h3>'+ministryDashboardHtml_(S.me.campus, 'Leadership Development', d.ministry||'GPDTS', d.data);
  return h;
}
function fmtDayShort_(iso){ return iso ? fmtDateNice_(iso) : ''; }
/* ---- This school ---- */
function dtsClassHtml_(d){
  var list=d.school||[], sel=S.dtsSel||(S.dtsSel={});
  Object.keys(sel).forEach(function(id){ if(!list.some(function(x){ return x.id===id; })) delete sel[id]; });
  var nSel=Object.keys(sel).filter(function(k){ return sel[k]; }).length;
  var grad=list.filter(function(x){ return x.graduated; }).length, staff=list.filter(function(x){ return x.potentialStaff; }).length;
  var h='<div class="mmGrid">'+[[t('Here'), list.length],[t('Graduated'), grad],[t('Potential staff'), staff]].map(function(x){
    return '<div class="mmTile"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+x[1]+'</div></div>'; }).join('')+'</div>';
  if(!list.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Nobody is here yet. Students show here once they are marked Arrived in the portal.'))+'</p></div>';
  h+='<div class="card" id="dtsClass"><div class="dtsClassBar"><label class="dtsAll"><input type="checkbox" id="dtsSelAll"'+(nSel && nSel===list.length?' checked':'')+'> '+esc(t('Select all'))+'</label>'+
    (nSel ? '<span class="dtsGradBox"><input type="date" id="dtsGradDate" max="'+esc(d.today||todayStr())+'" value="'+esc(S.dtsGradDate||d.today||todayStr())+'">'+
      '<button class="btn small" id="dtsMarkGrad">🎓 '+esc(gpT('Graduated ({n})',{n:nSel}))+'</button></span>' : '<span class="hint">'+esc(t('Tick students to mark them graduated together.'))+'</span>')+'</div>';
  h+=list.map(function(x){
    return '<div class="dtsStu'+(x.graduated?' grad':'')+'" data-dtsstu="'+esc(x.id)+'"><label class="dtsTick"><input type="checkbox" data-dtssel="'+esc(x.id)+'"'+(sel[x.id]?' checked':'')+' aria-label="'+esc(x.name)+'"></label>'+
      '<div class="dtsStuText"><b>'+esc(x.name)+'</b><span class="rowSub">'+esc(x.audience==='khmer' ? t('Khmer') : (x.country||t('International')))+(x.arrived ? ' · '+esc(gpT('Here since {date}',{date:fmtDayShort_(x.arrived)})) : '')+'</span>'+
        (x.graduated ? '<span class="rowSub dtsGradLine">🎓 '+esc(gpT('Graduated {date}',{date:fmtDayShort_(x.graduated)}))+' · <button class="linkbtn inline" data-dtsungrad="'+esc(x.id)+'">'+esc(t('Undo'))+'</button></span>' : '')+'</div>'+
      '<button class="dtsStaff'+(x.potentialStaff?' on':'')+'" data-dtsstaff="'+esc(x.id)+'" aria-pressed="'+!!x.potentialStaff+'" title="'+esc(t('Potential staff'))+'">⭐ <span>'+esc(t('Potential staff'))+'</span></button></div>';
  }).join('')+'</div>';
  return h;
}
/* ---- Lectures ---- */
function dtsLectFormHtml_(f){
  return '<div class="card" id="dtsLectForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the lecture') : t('Add a lecture'))+'</h3>'+
    '<div class="dtsTwo"><div><label class="f" for="dl_date">'+esc(t('From'))+'</label><input type="date" id="dl_date" data-dl="date" value="'+esc(f.date||'')+'"></div>'+
    '<div><label class="f" for="dl_end">'+esc(t('To (optional)'))+'</label><input type="date" id="dl_end" data-dl="end" value="'+esc(f.end||'')+'"></div></div>'+
    '<label class="f" for="dl_topic">'+esc(t('Topic'))+'</label><input type="text" id="dl_topic" data-dl="topic" maxlength="160" placeholder="'+esc(t('e.g. The Father heart of God'))+'" value="'+esc(f.topic||'')+'">'+
    '<label class="f" for="dl_speaker">'+esc(t('Speaker'))+'</label><input type="text" id="dl_speaker" data-dl="speaker" maxlength="120" value="'+esc(f.speaker||'')+'">'+
    '<label class="f" for="dl_from">'+esc(t('Where they are from'))+'</label><input type="text" id="dl_from" data-dl="from" maxlength="160" placeholder="'+esc(t('e.g. YWAM Phnom Penh, a church in Battambang'))+'" value="'+esc(f.from||'')+'">'+
    '<label class="f" for="dl_contact">'+esc(t('How to reach them'))+'</label><input type="text" id="dl_contact" data-dl="contact" maxlength="160" placeholder="'+esc(t('Phone, email or Telegram'))+'" value="'+esc(f.contact||'')+'">'+
    '<label class="dtsConf"><input type="checkbox" id="dl_confirmed"'+(f.confirmed?' checked':'')+'> '+esc(t('Confirmed — they are coming'))+'</label>'+
    '<label class="f" for="dl_notes">'+esc(t('Notes'))+'</label><textarea id="dl_notes" data-dl="notes" rows="3" maxlength="2000" placeholder="'+esc(t('Travel, where they stay, what they need…'))+'">'+esc(f.notes||'')+'</textarea>'+
    '<div class="dtsBtns"><button class="btn small" id="dtsLectSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsLectCancel">'+esc(t('Cancel'))+'</button>'+
    (f.id ? '<button class="linkbtn danger" id="dtsLectDel" style="width:auto">'+esc(t('Delete'))+'</button>' : '')+'</div></div>';
}
function dtsLectHtml_(d){
  var list=d.lectures||[], today=d.today||todayStr();
  var up=list.filter(function(x){ return (x.end||x.date)>=today; }), past=list.filter(function(x){ return (x.end||x.date)<today; }).reverse();
  var h='';
  if(S.dtsLect) h+=dtsLectFormHtml_(S.dtsLect);
  else h+='<button class="btn" id="dtsLectAdd" style="margin-top:0">＋ '+esc(t('Add a lecture'))+'</button>';
  var row=function(x){
    var when=fmtDayShort_(x.date)+(x.end && x.end!==x.date ? ' – '+fmtDayShort_(x.end) : '');
    return '<button class="dtsLect'+(x.confirmed?' ok':'')+'" data-dtslect="'+esc(x.id)+'"><span class="dtsLectWhen">'+esc(when)+'</span>'+
      '<span class="dtsLectText"><b>'+esc(x.topic||t('Topic to come'))+'</b><span class="rowSub">'+esc(x.speaker||t('Speaker to come'))+(x.from?' · '+esc(x.from):'')+'</span></span>'+
      '<span class="dtsLectState">'+(x.confirmed ? '✅ '+esc(t('Confirmed')) : '⏳ '+esc(t('Not confirmed')))+'</span></button>';
  };
  h+='<div class="card" id="dtsLectList"><h3 style="margin-top:0">🎤 '+esc(t('Coming up'))+'</h3>'+(up.length ? up.map(row).join('') : '<p class="sub" style="margin:0">'+esc(t('No lectures planned yet.'))+'</p>')+
    (past.length ? '<details class="dtsPast"'+(S.dtsShowPast?' open':'')+'><summary id="dtsPastToggle">'+esc(gpT('Earlier ({n})',{n:past.length}))+'</summary>'+past.map(row).join('')+'</details>' : '')+'</div>';
  h+='<div class="card dtsSoon" id="dtsBudget"><h3 style="margin-top:0">💰 '+esc(t('Finance & budget'))+'</h3><p class="sub" style="margin:0">'+esc(t('Coming soon: the school’s budget — speakers’ gifts and travel, food, outreach — beside what has been spent.'))+'</p></div>';
  return h;
}
/* ---- Outreach ---- */
function dtsOutHtml_(){
  return '<div class="card dtsSoon" id="dtsOutreach"><h3 style="margin-top:0">🌏 '+esc(t('Outreach'))+'</h3><p class="sub" style="margin:0">'+esc(t('Coming soon: the outreach teams — where they go, when, who leads them, the budget, and what God did there.'))+'</p></div>';
}
/* ---- loading and the taps ---- */
function dtsApply_(d){
  if(!(d && d.ok)) return false;
  S.dts=d; S.dtsErr='';
  // the Numbers tab reads the same figures (another ministry's lives in S.oversee)
  var mine=S.me.dept==='Leadership Development' && S.me.ministry===d.ministry;
  if(!mine && d.data) S.oversee[d.ministry]=d.data;
  return true;
}
function dtsLoad_(){
  if(S.dtsLoading) return;
  S.dtsLoading=true; S.dtsErr='';
  run('dtsBoard',[S.auth.user,S.auth.pin],function(d){
    S.dtsLoading=false;
    if(!dtsApply_(d)){ S.dtsErr = d && d.err==='not_authorized' ? t('Only GPDTS’s team can open this.') : (d && d.err) || t('The server answered without the school.'); S.ovError[S.mmBrowseMinistry]=S.dtsErr; }
    render();
  }, function(e){ S.dtsLoading=false; S.dtsErr=(e && e.message) || t('Connection problem — try again.'); render(); });
}
function dtsMark_(ids, marks, msg){
  S.dtsBusy=true;
  run('dtsMark',[S.auth.user,S.auth.pin,ids,marks],function(d){
    S.dtsBusy=false;
    if(dtsApply_(d)){ S.dtsSel={}; showMsg(msg); } else showMsg(d && d.err==='future' ? t('That day hasn’t come yet.') : t('Could not save'));
    render();
  }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
}
function dtsKeepLect_(){
  var f=S.dtsLect; if(!f) return;
  document.querySelectorAll('[data-dl]').forEach(function(el){ f[el.getAttribute('data-dl')]=el.value; });
  var c=document.getElementById('dl_confirmed'); if(c) f.confirmed=c.checked;
}
function bindDts_(){
  if(S.view!=='ministry' || !isDtsMinistry_(S.mmBrowseDept, S.mmBrowseMinistry)) return;
  if(!S.dts && !S.dtsLoading && !S.dtsErr) dtsLoad_();
  var rt=document.getElementById('dtsRetry'); if(rt) rt.onclick=function(){ S.dtsErr=''; S.ovError[S.mmBrowseMinistry]=''; dtsLoad_(); render(); };
  if(!S.dts) return;
  // This school
  document.querySelectorAll('[data-dtssel]').forEach(function(cb){ cb.onchange=function(){ (S.dtsSel=S.dtsSel||{})[cb.getAttribute('data-dtssel')]=cb.checked; render(); }; });
  var all=document.getElementById('dtsSelAll');
  if(all) all.onchange=function(){ S.dtsSel={}; if(all.checked) (S.dts.school||[]).forEach(function(x){ S.dtsSel[x.id]=true; }); render(); };
  var gd=document.getElementById('dtsGradDate'); if(gd) gd.onchange=function(){ S.dtsGradDate=gd.value; };
  var mg=document.getElementById('dtsMarkGrad');
  if(mg) mg.onclick=function(){
    var ids=Object.keys(S.dtsSel||{}).filter(function(k){ return S.dtsSel[k]; }); if(!ids.length) return;
    var day=(document.getElementById('dtsGradDate')||{}).value||S.dts.today;
    gpTap(); dtsMark_(ids, { graduated:day }, ids.length===1 ? t('Marked graduated 🎓') : gpT('{n} marked graduated 🎓',{n:ids.length}));
    if(typeof gpConfetti==='function') try { gpConfetti(); } catch(e){}
  };
  document.querySelectorAll('[data-dtsungrad]').forEach(function(b){ b.onclick=function(){ dtsMark_([b.getAttribute('data-dtsungrad')], { graduated:'' }, t('Saved')); }; });
  document.querySelectorAll('[data-dtsstaff]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-dtsstaff'), x=(S.dts.school||[]).filter(function(s){ return s.id===id; })[0]; if(!x) return;
    gpTap(); dtsMark_([id], { potentialStaff:!x.potentialStaff }, x.potentialStaff ? t('Saved') : t('Marked potential staff ⭐'));
  }; });
  // Lectures
  var la=document.getElementById('dtsLectAdd'); if(la) la.onclick=function(){ S.dtsLect={ date:'', end:'', topic:'', speaker:'', from:'', contact:'', confirmed:false, notes:'' }; render(); var n=document.getElementById('dl_date'); if(n) n.focus(); };
  document.querySelectorAll('[data-dtslect]').forEach(function(b){ b.onclick=function(){
    var x=(S.dts.lectures||[]).filter(function(l){ return l.id===b.getAttribute('data-dtslect'); })[0]; if(!x) return;
    S.dtsLect=Object.assign({}, x); render(); var f=document.getElementById('dtsLectForm'); if(f) f.scrollIntoView({ block:'start', behavior:'smooth' });
  }; });
  document.querySelectorAll('[data-dl]').forEach(function(el){ el.oninput=el.onchange=function(){ if(S.dtsLect) S.dtsLect[el.getAttribute('data-dl')]=el.value; }; });
  var lc=document.getElementById('dtsLectCancel'); if(lc) lc.onclick=function(){ S.dtsLect=null; render(); };
  var ls=document.getElementById('dtsLectSave');
  if(ls) ls.onclick=function(){
    dtsKeepLect_(); var f=S.dtsLect;
    if(!f.date){ showMsg(t('Pick the day first.')); return; }
    if(!String(f.topic||'').trim() && !String(f.speaker||'').trim()){ showMsg(t('Add a topic or a speaker.')); return; }
    S.dtsBusy=true; render();
    run('dtsSaveLecture',[S.auth.user,S.auth.pin,f],function(d){
      S.dtsBusy=false;
      if(d && d.ok){ S.dts.lectures=d.lectures; S.dtsLect=null; showMsg(t('Saved')); } else showMsg(t('Could not save'));
      render();
    }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
  };
  var ld=document.getElementById('dtsLectDel');
  if(ld) ld.onclick=function(){
    if(!S.dtsLect || !confirm(t('Delete this lecture?'))) return;
    run('dtsDeleteLecture',[S.auth.user,S.auth.pin,S.dtsLect.id],function(d){
      if(d && d.ok){ S.dts.lectures=d.lectures; S.dtsLect=null; showMsg(t('Deleted')); } else showMsg(t('Could not delete'));
      render();
    });
  };
  var pt=document.getElementById('dtsPastToggle'); if(pt) pt.onclick=function(){ S.dtsShowPast=!S.dtsShowPast; };
}
