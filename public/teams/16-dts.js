/* ==================== GPDTS on My Ministry (Nov 2026, Andrew) ====================
   "Instead of manually inputting numbers, I would like it to automatically track them." The DTS
   pipeline lives in the portal — DTS applications, and the people the team reaches out to and
   follows up there (＋ Add a contact, Contacts, next steps). This page is the school's home, in two
   tabs of its own (Nov 2026, Andrew: "simplify the amount of tabs"), then Tasks and OKRs:
     Dashboard  where everyone is (reaching out → contacted → applied → accepted → here → graduated,
                Khmer and international), the follow-ups due, and the school by year
     Database   one school at a time — a year and a name ("2027 · January DTS") — with four parts:
                Lectures (the speaker schedule: topic, dates, speaker, translator, MC and who is finding
                the speaker; the students, drawn from the portal, each with their details and their
                1-on-1; the events; the school policy), Outreach (teams, each with a short outreach of
                2 weeks and a long one of 8 — where, when, leaders, students, and the numbers week by
                week), Responsibilities (before school and in school, given to staff) and Resources.
   Every number counts itself — the students from the portal, the fruit from the lectures and the
   outreach weeks. Server: dtsBoard / dtsMark / dtsToStaff / dtsSaveLecture / dtsDbSave / dtsDbDelete /
   dtsStudentSave / dtsSavePast (api.js, "GPDTS"). Siem Reap's GPDTS only for now (DTS_TOOL). */
var DTS_TABS=['dtsdash','dtsdb'];
function isDtsMinistry_(dept, min){ return typeof autoMetricsFor==='function' && autoMetricsFor(S.me && S.me.campus, dept, min).length>0; }
function dtsTabs_(){ return [['dtsdash',t('Dashboard')],['dtsdb',t('Database')]]; }
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
  if(cur==='dtsdb') return dtsDbHtml_(d);
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
  h+=dtsYearHtml_(d);
  return h;
}
/* ---- the school by year: this year from the weekly rows, earlier years typed in (dtsSavePast) ---- */
var DTS_STU_M=[['Local Students Contacted','Contacted (local)'],['Intl Students Contacted','Contacted (international)'],['Students Applied','Applied'],['Students Accepted','Accepted'],['Students Enrolled','Enrolled'],['Students Graduated','Graduated'],['Potential Staff','Potential staff']];
var DTS_FRUIT_M=[['People Heard the Gospel','Heard the gospel','📣','gospel'],['Healings','Healings','✨','healings'],['Salvations','Salvations','❤️','salvations'],['Baptisms','Baptisms','💧','baptisms']];
var DTS_LEVEL_M=['Students Enrolled','Potential Staff'];   // the most at once, not a sum
function dtsYearVals_(d, y){
  if(String(y)===String(d.year)){
    var e=(d.data && d.data.entries)||{}, out={};
    DTS_STU_M.concat(DTS_FRUIT_M).forEach(function(m){
      var w=e[m[0]]||{}, ks=Object.keys(w); if(!ks.length) return;
      out[m[0]] = DTS_LEVEL_M.indexOf(m[0])>-1 ? Math.max.apply(null, ks.map(function(k){ return Number(w[k])||0; })) : ks.reduce(function(a,k){ return a+(Number(w[k])||0); }, 0);
    });
    return out;
  }
  var p=(d.past||{})[y]; return p ? (p.values||{}) : {};
}
/* where this year's fruit came from: lectures and outreach reports, up to today */
function dtsFruitSrc_(d){
  var yr=String(d.year), today=d.today||todayStr(), src={ lect:{}, out:{} };
  (d.lectures||[]).forEach(function(l){ if(l.date && l.date.slice(0,4)===yr && l.date<=today) Object.keys(l.fruit||{}).forEach(function(k){ src.lect[k]=(src.lect[k]||0)+(Number(l.fruit[k])||0); }); });
  (d.outreaches||[]).forEach(function(o){ (o.reports||[]).forEach(function(r){ if(r.date && r.date.slice(0,4)===yr && r.date<=today) Object.keys(r.fruit||{}).forEach(function(k){ src.out[k]=(src.out[k]||0)+(Number(r.fruit[k])||0); }); }); });
  ((d.db && d.db.teams)||[]).forEach(function(tm){ ['short','long'].forEach(function(k){ var ph=tm[k]; if(!ph || !ph.from) return;
    (ph.weeks||[]).forEach(function(w, i){ var day=dtsAddDays_(ph.from, 7*i); if(day.slice(0,4)!==yr || day>today) return; Object.keys(DTS_REACH_KEY).forEach(function(rk){ var f=DTS_REACH_KEY[rk]; if(w[rk]) src.out[f]=(src.out[f]||0)+(Number(w[rk])||0); }); }); }); });
  return src;
}
function dtsYearsOf_(d){
  return [String(d.year)].concat(Object.keys(d.past||{}).filter(function(y){ return Number(y)<Number(d.year); }).sort().reverse());
}
function dtsTile_(label, n, sub, attr){
  return '<div class="mmTile'+(n?'':' empty')+'"'+(attr||'')+'><div class="mmTileName">'+esc(label)+'</div><div class="mmTileNum">'+(n===undefined ? '—' : esc(String(n)))+'</div>'+(sub?'<div class="hint" style="margin:2px 0 0">'+esc(sub)+'</div>':'')+'</div>';
}
function dtsYearHtml_(d){
  var years=dtsYearsOf_(d), y=years.indexOf(S.dtsYear)>-1 ? S.dtsYear : String(d.year), cur=y===String(d.year);
  var v=dtsYearVals_(d, y), src=cur ? dtsFruitSrc_(d) : null;
  var h='<div class="card" id="dtsYear"><h3 style="margin-top:0">📊 '+esc(t('The school by year'))+'</h3>'+
    '<div class="chips dtsYearChips">'+years.map(function(x){ return '<button class="chip'+(x===y?' on':'')+'" data-dtsyear="'+esc(x)+'">'+esc(x)+'</button>'; }).join('')+
    '<button class="chip" id="dtsPastAdd">＋ '+esc(t('Add a past year'))+'</button></div>';
  if(S.dtsPastEdit) return h+dtsPastFormHtml_(d)+'</div>';
  if(!cur){
    var p=(d.past||{})[y]||{};
    h+='<p class="hint" style="margin:4px 0 8px">'+esc(t('Typed in for a past school.'))+(p.notes?' '+esc(p.notes):'')+' <button class="linkbtn inline" id="dtsPastEditBtn" data-dtspastedit="'+esc(y)+'">'+esc(t('Edit these numbers'))+'</button></p>';
  }
  h+='<div class="dtsGroupH">🎓 '+esc(t('Students'))+'</div><div class="mmGrid dtsTiles">'+DTS_STU_M.map(function(m){ return dtsTile_(t(m[1]), v[m[0]], '', ' data-dtsm="'+esc(m[0])+'"'); }).join('')+'</div>';
  h+='<div class="dtsGroupH">🙏 '+esc(t('What God did'))+'</div><div class="mmGrid dtsTiles">'+DTS_FRUIT_M.map(function(m){
    var sub = src ? gpT('Lectures {a} · Outreach {b}',{a:src.lect[m[3]]||0, b:src.out[m[3]]||0}) : '';
    return dtsTile_(m[2]+' '+t(m[1]), v[m[0]], sub, ' data-dtsm="'+esc(m[0])+'"'); }).join('')+'</div>';
  if(cur) h+='<p class="hint" style="margin:6px 0 0">'+esc(t('Students count themselves from the portal; what God did, from Lectures and Outreach. Enrolled and potential staff are the most at once.'))+'</p>';
  if(years.length>1){
    h+='<div class="dtsYearsWrap"><table class="dtsYears" id="dtsYears"><thead><tr><th></th>'+years.map(function(x){ return '<th>'+esc(x)+'</th>'; }).join('')+'</tr></thead><tbody>'+
      DTS_STU_M.concat(DTS_FRUIT_M).map(function(m){
        return '<tr><th>'+esc(t(m[1]))+'</th>'+years.map(function(x){ var n=dtsYearVals_(d, x)[m[0]]; return '<td>'+(n===undefined ? '—' : esc(String(n)))+'</td>'; }).join('')+'</tr>';
      }).join('')+'</tbody></table></div>';
  }
  return h+'</div>';
}
function dtsPastFormHtml_(d){
  var f=S.dtsPastEdit, isNew=!f.fixed;
  return '<div id="dtsPastForm" class="dtsPastForm"><p class="sub" style="margin:6px 0 8px">'+esc(t('The totals for a school before this app — leave a box empty if you don’t know it.'))+'</p>'+
    (isNew ? '<label class="f" for="dp_year">'+esc(t('Year'))+'</label><input type="number" id="dp_year" min="2000" max="'+(Number(d.year)-1)+'" value="'+esc(f.year||'')+'" placeholder="'+(Number(d.year)-1)+'">' : '<div class="dtsGroupH">'+esc(f.year)+'</div>')+
    '<div class="dtsPastGrid">'+DTS_STU_M.concat(DTS_FRUIT_M).map(function(m){
      return '<label class="dtsPastBox"><span>'+esc(t(m[1]))+'</span><input type="number" min="0" inputmode="numeric" data-dpv="'+esc(m[0])+'" value="'+esc(f.values[m[0]]!==undefined ? String(f.values[m[0]]) : '')+'"></label>'; }).join('')+'</div>'+
    '<label class="f" for="dp_notes">'+esc(t('Notes'))+'</label><input type="text" id="dp_notes" maxlength="1000" value="'+esc(f.notes||'')+'" placeholder="'+esc(t('e.g. where outreach went that year'))+'">'+
    '<div class="dtsBtns"><button class="btn small" id="dtsPastSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsPastCancel">'+esc(t('Cancel'))+'</button>'+
    (isNew ? '' : '<button class="linkbtn danger" id="dtsPastDel" style="width:auto">'+esc(t('Delete this year'))+'</button>')+'</div></div>';
}
function fmtDayShort_(iso){ return iso ? fmtDateNice_(iso) : ''; }
/* a graduate marked potential staff goes on into the staff pipeline (Part 2): their staff application,
   worked by HR in the portal; once accepted, Add to the GP app there */
var DTS_STAGE_WORD={ 'new':'New inquiry', contacted:'Contacted', applied:'Applied', interview:'Interview', accepted:'Accepted', practical:'Getting ready', arrived:'Arrived' };
function dtsPipeLine_(x){
  if(x.staffCand){
    var sc=x.staffCand;
    return '<div class="dtsPipe2" data-dtspipe="'+esc(x.id)+'">'+(sc.hired ? '✅ '+esc(t('On staff — in the GP app'))
      : '👔 '+esc(t('Staff application'))+' · '+esc(t(DTS_STAGE_WORD[sc.stage]||sc.stage))+(sc.archived ? ' · '+esc(t('Closed')) : ''))+'</div>';
  }
  if(!(x.graduated && x.potentialStaff)) return '';
  return '<div class="dtsPipe2"><button class="btn small ghost" data-dtstostaff="'+esc(x.id)+'">➡️ '+esc(t('Start their staff application'))+'</button></div>';
}
/* ---- Lectures ---- */
function dtsLectFormHtml_(f){
  return '<div class="card" id="dtsLectForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the lecture') : t('Add a topic'))+'</h3>'+
    '<label class="f" for="dl_topic">'+esc(t('Topic'))+'</label><input type="text" id="dl_topic" data-dl="topic" maxlength="160" placeholder="'+esc(t('e.g. The Father heart of God'))+'" value="'+esc(f.topic||'')+'">'+
    '<div class="dtsTwo"><div><label class="f" for="dl_date">'+esc(t('From'))+'</label><input type="date" id="dl_date" data-dl="date" value="'+esc(f.date||'')+'"></div>'+
    '<div><label class="f" for="dl_end">'+esc(t('To (optional)'))+'</label><input type="date" id="dl_end" data-dl="end" value="'+esc(f.end||'')+'"></div></div>'+
    '<label class="f" for="dl_finder">'+esc(t('Who is finding the speaker'))+'</label>'+dtsStaffSelectHtml_('dl_finder', f.finder, 'data-dl="finder"')+
    '<label class="f" for="dl_speaker">'+esc(t('Speaker'))+'</label><input type="text" id="dl_speaker" data-dl="speaker" maxlength="120" value="'+esc(f.speaker||'')+'">'+
    '<label class="f" for="dl_from">'+esc(t('Where they are from'))+'</label><input type="text" id="dl_from" data-dl="from" maxlength="160" placeholder="'+esc(t('e.g. YWAM Phnom Penh, a church in Battambang'))+'" value="'+esc(f.from||'')+'">'+
    '<label class="f" for="dl_contact">'+esc(t('How to reach them'))+'</label><input type="text" id="dl_contact" data-dl="contact" maxlength="160" placeholder="'+esc(t('Phone, email or Telegram'))+'" value="'+esc(f.contact||'')+'">'+
    '<div class="dtsTwo"><div><label class="f" for="dl_translator">'+esc(t('Translator'))+'</label><input type="text" id="dl_translator" data-dl="translator" maxlength="120" list="dtsStaffNames" value="'+esc(f.translator||'')+'"></div>'+
    '<div><label class="f" for="dl_mc">'+esc(t('MC'))+'</label><input type="text" id="dl_mc" data-dl="mc" maxlength="120" list="dtsStaffNames" value="'+esc(f.mc||'')+'"></div></div>'+dtsStaffDatalist_()+
    '<label class="dtsConf"><input type="checkbox" id="dl_confirmed"'+(f.confirmed?' checked':'')+'> '+esc(t('Confirmed — they are coming'))+'</label>'+
    '<label class="f" for="dl_notes">'+esc(t('Notes'))+'</label><textarea id="dl_notes" data-dl="notes" rows="3" maxlength="2000" placeholder="'+esc(t('Travel, where they stay, what they need…'))+'">'+esc(f.notes||'')+'</textarea>'+
    '<label class="f">'+esc(t('What God did (after the week)'))+'</label>'+dtsFruitInputs_('data-dlf', f.fruit||{})+
    '<div class="dtsBtns"><button class="btn small" id="dtsLectSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsLectCancel">'+esc(t('Cancel'))+'</button>'+
    (f.id ? '<button class="linkbtn danger" id="dtsLectDel" style="width:auto">'+esc(t('Delete'))+'</button>' : '')+'</div></div>';
}
/* ---- the four numbers: inputs and a line ---- */
function dtsFruitInputs_(attr, f, prefix){
  return '<div class="dtsFruitIn">'+DTS_FRUIT_M.map(function(m){
    return '<label class="dtsPastBox"><span>'+m[2]+' '+esc(t(m[1]))+'</span><input type="number" min="0" inputmode="numeric" '+attr+'="'+(prefix||'')+m[3]+'" value="'+esc(f[m[3]] ? String(f[m[3]]) : '')+'"></label>'; }).join('')+'</div>';
}
function dtsFruitLine_(f){
  f=f||{};
  return DTS_FRUIT_M.filter(function(m){ return f[m[3]]; }).map(function(m){ return m[2]+' '+f[m[3]]; }).join('  ');
}
function dtsFruitSum_(reports){
  var s={}; (reports||[]).forEach(function(r){ Object.keys(r.fruit||{}).forEach(function(k){ s[k]=(s[k]||0)+(Number(r.fruit[k])||0); }); }); return s;
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
  f.fruit=f.fruit||{};
  document.querySelectorAll('[data-dlf]').forEach(function(el){ f.fruit[el.getAttribute('data-dlf')]=el.value; });
}
function dtsKeepOut_(){
  var f=S.dtsOut; if(!f) return;
  document.querySelectorAll('[data-do]').forEach(function(el){ f[el.getAttribute('data-do')]=el.value; });
  document.querySelectorAll('[data-dor]').forEach(function(el){
    var k=el.getAttribute('data-dor').split('|'), r=f.reports[Number(k[0])]; if(!r) return;
    if(k[1]==='date' || k[1]==='note') r[k[1]]=el.value; else { r.fruit=r.fruit||{}; r.fruit[k[1]]=el.value; }
  });
}
function dtsKeepPast_(){
  var f=S.dtsPastEdit; if(!f) return;
  var y=document.getElementById('dp_year'); if(y) f.year=y.value;
  var n=document.getElementById('dp_notes'); if(n) f.notes=n.value;
  document.querySelectorAll('[data-dpv]').forEach(function(el){ f.values[el.getAttribute('data-dpv')]=el.value; });
}
/* after a lecture or report changes the numbers, the board (with this year's rows) again */
function dtsRefresh_(){ run('dtsBoard',[S.auth.user,S.auth.pin],function(d){ if(dtsApply_(d)) render(); }); }
function dtsNewReport_(){ return { date:todayStr(), fruit:{}, note:'' }; }
function bindDts_(){
  if(S.view!=='ministry' || !isDtsMinistry_(S.mmBrowseDept, S.mmBrowseMinistry)) return;
  if(!S.dts && !S.dtsLoading && !S.dtsErr) dtsLoad_();
  var rt=document.getElementById('dtsRetry'); if(rt) rt.onclick=function(){ S.dtsErr=''; S.ovError[S.mmBrowseMinistry]=''; dtsLoad_(); render(); };
  if(!S.dts) return;
  // This school
  document.querySelectorAll('[data-dtssel]').forEach(function(cb){ cb.onchange=function(){ (S.dtsSel=S.dtsSel||{})[cb.getAttribute('data-dtssel')]=cb.checked; render(); }; });
  var all=document.getElementById('dtsSelAll');
  if(all) all.onchange=function(){ S.dtsSel={}; if(all.checked) dtsHereIn_().forEach(function(x){ S.dtsSel[x.id]=true; }); render(); };
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
    var id=b.getAttribute('data-dtsstaff'), x=dtsStudent_(id); if(!x) return;
    gpTap(); dtsMark_([id], { potentialStaff:!x.potentialStaff }, x.potentialStaff ? t('Saved') : t('Marked potential staff ⭐'));
  }; });
  // Lectures
  var la=document.getElementById('dtsLectAdd'); if(la) la.onclick=function(){ S.dtsLect={ date:'', end:'', topic:'', speaker:'', from:'', contact:'', confirmed:false, notes:'', translator:'', mc:'', finder:'', schoolId:S.dtsSchool||'' }; render(); var n=document.getElementById('dl_topic'); if(n) n.focus(); };
  document.querySelectorAll('[data-dtslect]').forEach(function(b){ b.onclick=function(){
    var x=(S.dts.lectures||[]).filter(function(l){ return l.id===b.getAttribute('data-dtslect'); })[0]; if(!x) return;
    S.dtsLect=Object.assign({}, x); if(!S.dtsLect.schoolId) S.dtsLect.schoolId=S.dtsSchool||''; render(); var f=document.getElementById('dtsLectForm'); if(f) f.scrollIntoView({ block:'start', behavior:'smooth' });
  }; });
  document.querySelectorAll('[data-dl]').forEach(function(el){ el.oninput=el.onchange=function(){ if(S.dtsLect) S.dtsLect[el.getAttribute('data-dl')]=el.value; }; });
  var lc=document.getElementById('dtsLectCancel'); if(lc) lc.onclick=function(){ S.dtsLect=null; render(); };
  var ls=document.getElementById('dtsLectSave');
  if(ls) ls.onclick=function(){
    dtsKeepLect_(); var f=S.dtsLect;
    if(!String(f.topic||'').trim() && !String(f.speaker||'').trim()){ showMsg(t('Add a topic or a speaker.')); return; }
    if(!f.date && !String(f.topic||'').trim()){ showMsg(t('Pick the day first.')); return; }
    S.dtsBusy=true; render();
    run('dtsSaveLecture',[S.auth.user,S.auth.pin,f],function(d){
      S.dtsBusy=false;
      if(d && d.ok){ S.dts.lectures=d.lectures; S.dtsLect=null; showMsg(t('Saved')); dtsRefresh_(); } else showMsg(t('Could not save'));
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
  document.querySelectorAll('[data-dlf]').forEach(function(el){ el.oninput=function(){ if(S.dtsLect){ S.dtsLect.fruit=S.dtsLect.fruit||{}; S.dtsLect.fruit[el.getAttribute('data-dlf')]=el.value; } }; });
  // the staff pipeline
  document.querySelectorAll('[data-dtstostaff]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-dtstostaff'), x=dtsStudent_(id); if(!x) return;
    if(!confirm(gpT('Start {name}’s staff application? Their portal sign-in will open the staff application, and HR takes it from there.',{name:x.name}))) return;
    S.dtsBusy=true; b.disabled=true;
    run('dtsToStaff',[S.auth.user,S.auth.pin,[id]],function(d){
      S.dtsBusy=false;
      if(dtsApply_(d)) showMsg(d.moved ? t('Their staff application has started 👔') : t('Nothing to move — they need to be graduated and potential staff.'));
      else showMsg(t('Could not save'));
      render();
    }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
  }; });
  // the year view and past years
  document.querySelectorAll('[data-dtsyear]').forEach(function(b){ b.onclick=function(){ S.dtsYear=b.getAttribute('data-dtsyear'); S.dtsPastEdit=null; render(); }; });
  var pa=document.getElementById('dtsPastAdd'); if(pa) pa.onclick=function(){ S.dtsPastEdit={ year:'', values:{}, notes:'' }; render(); var y=document.getElementById('dp_year'); if(y) y.focus(); };
  var pe=document.getElementById('dtsPastEditBtn'); if(pe) pe.onclick=function(){ var y=pe.getAttribute('data-dtspastedit'), p=(S.dts.past||{})[y]||{}; S.dtsPastEdit={ year:y, fixed:true, values:Object.assign({}, p.values||{}), notes:p.notes||'' }; render(); };
  var pc=document.getElementById('dtsPastCancel'); if(pc) pc.onclick=function(){ S.dtsPastEdit=null; render(); };
  var savePast=function(values){
    dtsKeepPast_(); var f=S.dtsPastEdit, y=Number(f.year);
    if(!(y>=2000 && y<Number(S.dts.year))){ showMsg(t('Pick a year before this one.')); return; }
    S.dtsBusy=true; render();
    run('dtsSavePast',[S.auth.user,S.auth.pin,y,values===null ? null : f.values,f.notes],function(d){
      S.dtsBusy=false;
      if(d && d.ok){ S.dts.past=d.past; S.dtsPastEdit=null; S.dtsYear=values===null ? String(S.dts.year) : String(y); showMsg(values===null ? t('Deleted') : t('Saved')); }
      else showMsg(t('Could not save'));
      render();
    }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
  };
  var ps=document.getElementById('dtsPastSave'); if(ps) ps.onclick=function(){ savePast(); };
  var pd=document.getElementById('dtsPastDel'); if(pd) pd.onclick=function(){ if(confirm(t('Delete this year’s numbers?'))) savePast(null); };
  bindDtsDb_();
}

/* ==================== Database (Nov 2026, Andrew) ====================
   One school at a time: year chips, then that year's schools ("January DTS"), the one coming up chosen
   by default. Under it four parts — Lectures (Speaker schedule · Students · Events · School policy),
   Outreach, Responsibilities, Resources — each showing only that school's things. */
var DTS_SECS=[['lect','🎤','Lectures'],['out','🌏','Outreach'],['resp','📋','Responsibilities'],['res','📚','Resources']];
var DTS_LPARTS=[['speakers','Speaker schedule'],['students','Students'],['events','Events'],['policy','School policy']];
var DTS_REACH=[['male','Males reached'],['female','Females reached'],['salvations','Salvations'],['healings','Healings'],['gospel','Heard the gospel']];
var DTS_REACH_KEY={ salvations:'salvations', healings:'healings', gospel:'gospel' };
var DTS_PHASE_WEEKS={ short:2, long:8 };
var DTS_COL_WORD={ applied:'Applied', accepted:'Accepted', arrived:'Here now', graduated:'Graduated' };
function dtsAddDays_(iso, n){ var d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function dtsDb_(){ return (S.dts && S.dts.db) || { schools:[], events:[], resp:[], resources:[], teams:[], policy:'' }; }
function dtsStaff_(){ return (S.roster||[]).filter(function(r){ return r && r.campus===S.me.campus; }).slice().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); }); }
function dtsStaffName_(id){ var p=personOf(id); return p ? p.name : ''; }
function dtsStaffSelectHtml_(id, cur, attr){
  return '<select id="'+id+'" '+(attr||'')+'><option value="">'+esc(t('— nobody yet —'))+'</option>'+dtsStaff_().map(function(r){ return '<option value="'+esc(r.id)+'"'+(cur===r.id?' selected':'')+'>'+esc(r.name)+'</option>'; }).join('')+'</select>';
}
function dtsStaffDatalist_(){ return '<datalist id="dtsStaffNames">'+dtsStaff_().map(function(r){ return '<option value="'+esc(r.name)+'">'; }).join('')+'</datalist>'; }
/* staff to tick (leaders, who holds a responsibility): a fold that says who is ticked */
function dtsPeopleChecks_(attr, chosen, label){
  chosen=chosen||[];
  var names=chosen.map(dtsStaffName_).filter(Boolean);
  return '<details class="dtsPick"><summary>'+esc(names.length ? names.join(', ') : label)+'</summary><div class="dtsPickList">'+
    dtsStaff_().map(function(r){ return '<label class="dtsPickRow"><input type="checkbox" '+attr+' value="'+esc(r.id)+'"'+(chosen.indexOf(r.id)>-1?' checked':'')+'> '+esc(r.name)+'</label>'; }).join('')+'</div></details>';
}
function dtsSchoolName_(s){ return s ? s.year+' · '+s.name : ''; }
function dtsSchoolWhen_(s){ return [fmtDayShort_(s.from), fmtDayShort_(s.to)].filter(Boolean).join(' – '); }
/* the school on show: the one picked, else the next one still to finish, else the latest */
function dtsCurSchool_(){
  var list=dtsDb_().schools||[], today=(S.dts && S.dts.today)||todayStr();
  var hit=list.filter(function(s){ return s.id===S.dtsSchool; })[0];
  if(!hit) hit=list.filter(function(s){ return (s.to || dtsAddDays_((s.from||s.year+'-01-01'), 200))>=today; })[0] || list[list.length-1] || null;
  S.dtsSchool=hit ? hit.id : '';
  return hit;
}
function dtsIn_(list){ var id=S.dtsSchool; return (list||[]).filter(function(x){ return x && x.schoolId===id; }); }
function dtsStudents_(){ return dtsIn_((S.dts && S.dts.students)||[]); }
function dtsStudent_(id){ return ((S.dts && S.dts.students)||[]).filter(function(x){ return x.id===id; })[0] || null; }
function dtsHereIn_(){ return dtsStudents_().filter(function(x){ return x.column==='arrived' || (x.arrived && !x.archived); }); }
/* a lecture is in the school it was put in; one from before schools existed, in the school of its year */
function dtsLectsIn_(sch){
  var all=(S.dts && S.dts.lectures)||[], ids=(dtsDb_().schools||[]).map(function(s){ return s.id; });
  return all.filter(function(l){ return l.schoolId ? l.schoolId===sch.id : (ids.length && l.date && Number(l.date.slice(0,4))===Number(sch.year)); });
}
function dtsDbHtml_(d){
  var db=dtsDb_(), sch=dtsCurSchool_();
  var years=[]; (db.schools||[]).forEach(function(s){ if(years.indexOf(String(s.year))===-1) years.push(String(s.year)); });
  var yr=S.dtsDbYear && years.indexOf(S.dtsDbYear)>-1 ? S.dtsDbYear : (sch ? String(sch.year) : '');
  if(sch && String(sch.year)!==yr){ var first=(db.schools||[]).filter(function(s){ return String(s.year)===yr; })[0]; if(first){ S.dtsSchool=first.id; sch=first; } }
  var h='<div class="card" id="dtsSchoolPick"><h3 style="margin-top:0">🏫 '+esc(t('Which school'))+'</h3>';
  if(years.length) h+='<div class="chips" id="dtsDbYears">'+years.map(function(y){ return '<button class="chip'+(y===yr?' on':'')+'" data-dtsdbyear="'+esc(y)+'">'+esc(y)+'</button>'; }).join('')+'</div>'+
    '<div class="chips" id="dtsDbSchools">'+(db.schools||[]).filter(function(s){ return String(s.year)===yr; }).map(function(s){ return '<button class="chip'+(sch && s.id===sch.id?' on':'')+'" data-dtsschool="'+esc(s.id)+'">'+esc(s.name)+'</button>'; }).join('')+
    '<button class="chip" id="dtsSchoolAdd">＋ '+esc(t('New school'))+'</button></div>';
  if(S.dtsSchoolEdit) h+=dtsSchoolFormHtml_(S.dtsSchoolEdit);
  else if(!sch) h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Start with the school: its year and name, like 2027 · January DTS. Its lectures, students, events, outreach, responsibilities and resources all sit under it.'))+'</p><button class="btn small" id="dtsSchoolAdd">＋ '+esc(t('Add the school'))+'</button>';
  else h+='<div class="dtsSchoolLine" id="dtsSchoolLine"><b>'+esc(dtsSchoolName_(sch))+'</b>'+(dtsSchoolWhen_(sch) ? ' · '+esc(dtsSchoolWhen_(sch)) : '')+
    ' · <button class="linkbtn inline" id="dtsSchoolEditBtn">'+esc(t('Edit'))+'</button></div>';
  h+='</div>';
  if(!sch) return h;
  var sec=S.dtsSec||'lect';
  h+='<div class="seg dtsSecs" id="dtsSecs">'+DTS_SECS.map(function(x){ return '<button class="'+(sec===x[0]?'on':'')+'" data-dtssec="'+x[0]+'">'+x[1]+' '+esc(t(x[2]))+'</button>'; }).join('')+'</div>';
  if(sec==='out') h+=dtsOutSecHtml_(d, sch);
  else if(sec==='resp') h+=dtsRespHtml_(sch);
  else if(sec==='res') h+=dtsResHtml_(sch);
  else h+=dtsLectSecHtml_(d, sch);
  return h;
}
function dtsSchoolFormHtml_(f){
  return '<div id="dtsSchoolForm" class="dtsForm"><div class="dtsTwo"><div><label class="f" for="ds_year">'+esc(t('Year'))+'</label><input type="number" id="ds_year" data-ds="year" min="2000" max="2100" value="'+esc(f.year||'')+'"></div>'+
    '<div><label class="f" for="ds_name">'+esc(t('Name'))+'</label><input type="text" id="ds_name" data-ds="name" maxlength="80" placeholder="'+esc(t('e.g. January DTS'))+'" value="'+esc(f.name||'')+'"></div></div>'+
    '<div class="dtsTwo"><div><label class="f" for="ds_from">'+esc(t('Starts'))+'</label><input type="date" id="ds_from" data-ds="from" value="'+esc(f.from||'')+'"></div>'+
    '<div><label class="f" for="ds_to">'+esc(t('Ends'))+'</label><input type="date" id="ds_to" data-ds="to" value="'+esc(f.to||'')+'"></div></div>'+
    '<p class="hint" style="margin:6px 0 0">'+esc(t('Students who applied before it starts are put in it by themselves — you can move anyone.'))+'</p>'+
    '<div class="dtsBtns"><button class="btn small" id="dtsSchoolSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsSchoolCancel">'+esc(t('Cancel'))+'</button>'+
    (f.id ? '<button class="linkbtn danger" id="dtsSchoolDel" style="width:auto">'+esc(t('Delete'))+'</button>' : '')+'</div></div>';
}
/* ---- Lectures: Speaker schedule · Students · Events · School policy ---- */
function dtsLectSecHtml_(d, sch){
  var part=S.dtsLp||'speakers';
  var h='<div class="chips dtsParts" id="dtsLParts">'+DTS_LPARTS.map(function(x){ return '<button class="chip'+(part===x[0]?' on':'')+'" data-dtslp="'+x[0]+'">'+esc(t(x[1]))+'</button>'; }).join('')+'</div>';
  if(part==='students') return h+(S.dtsStu ? dtsStuHtml_(dtsStudent_(S.dtsStu), sch) : dtsStudentsHtml_(d, sch));
  if(part==='events') return h+dtsEventsHtml_(d, sch);
  if(part==='policy') return h+dtsPolicyHtml_();
  return h+dtsSpeakersHtml_(d, sch);
}
function dtsSpeakersHtml_(d, sch){
  var list=dtsLectsIn_(sch), today=d.today||todayStr(), only=S.dtsNeed;
  var need=list.filter(function(l){ return !l.speaker; });
  var h='';
  if(S.dtsLect) h+=dtsLectFormHtml_(S.dtsLect);
  else h+='<button class="btn" id="dtsLectAdd" style="margin-top:0">＋ '+esc(t('Add a topic'))+'</button>';
  var rows=only ? need : list;
  h+='<div class="card" id="dtsSpeakers"><h3 style="margin-top:0">🎤 '+esc(t('Speaker schedule'))+'</h3>'+
    '<div class="chips"><button class="chip'+(only?'':' on')+'" data-dtsneed="0">'+esc(gpT('All ({n})',{n:list.length}))+'</button><button class="chip'+(only?' on':'')+'" data-dtsneed="1">'+esc(gpT('Speaker needed ({n})',{n:need.length}))+'</button></div>';
  if(!rows.length) h+='<p class="sub" style="margin:0">'+esc(only ? t('Every topic has a speaker.') : t('No topics yet. Add each week’s topic — and who is finding its speaker, if there isn’t one yet.'))+'</p>';
  else h+='<div class="dtsTblWrap"><table class="dtsTbl" id="dtsSpeakTbl"><thead><tr><th>'+esc(t('Dates'))+'</th><th>'+esc(t('Topic'))+'</th><th>'+esc(t('Speaker'))+'</th><th>'+esc(t('Translator'))+'</th><th>'+esc(t('MC'))+'</th></tr></thead><tbody>'+
    rows.map(function(x){
      var when=x.date ? fmtDayShort_(x.date)+(x.end && x.end!==x.date ? ' – '+fmtDayShort_(x.end) : '') : t('Dates to come');
      var past=(x.end||x.date) && (x.end||x.date)<today;
      var spk='<div>'+(x.speaker ? esc(x.speaker)+(x.confirmed ? ' ✅' : ' <span class="hint">⏳</span>') :
        '<span class="dtsNeed">'+esc(t('Speaker needed'))+'</span><span class="rowSub">'+esc(x.finder ? gpT('{name} is finding one',{name:dtsStaffName_(x.finder)||'—'}) : t('Nobody is finding one yet'))+'</span>')+'</div>';
      /* data-l: on a phone each row is a small card, every cell with its label (teams.css) */
      return '<tr class="'+(past?'past':'')+'" data-dtslect="'+esc(x.id)+'" tabindex="0"><td class="dtsWhen" data-l="'+esc(t('Dates'))+'">'+esc(when)+'</td><td data-l="'+esc(t('Topic'))+'"><b>'+esc(x.topic||'—')+'</b></td><td data-l="'+esc(t('Speaker'))+'">'+spk+'</td><td data-l="'+esc(t('Translator'))+'">'+esc(x.translator||'—')+'</td><td data-l="'+esc(t('MC'))+'">'+esc(x.mc||'—')+'</td></tr>';
    }).join('')+'</tbody></table></div><p class="hint" style="margin:6px 0 0">'+esc(t('Tap a row to change it. ✅ the speaker has said yes; ⏳ not yet.'))+'</p>';
  h+='</div>';
  h+='<div class="card dtsSoon" id="dtsBudget"><h3 style="margin-top:0">💰 '+esc(t('Finance & budget'))+'</h3><p class="sub" style="margin:0">'+esc(t('Coming soon: the school’s budget — speakers’ gifts and travel, food, outreach — beside what has been spent.'))+'</p></div>';
  return h;
}
/* the students: everyone who applied for this school, from the portal */
function dtsStudentsHtml_(d, sch){
  var list=dtsStudents_(), sel=S.dtsSel||(S.dtsSel={}), here=dtsHereIn_();
  Object.keys(sel).forEach(function(id){ if(!here.some(function(x){ return x.id===id; })) delete sel[id]; });
  var nSel=Object.keys(sel).filter(function(k){ return sel[k]; }).length;
  var groups=[['arrived','🏠'],['accepted','✅'],['applied','📝'],['graduated','🎓']];
  var h='<div class="mmGrid">'+groups.map(function(g){ return '<div class="mmTile"><div class="mmTileName">'+g[1]+' '+esc(t(DTS_COL_WORD[g[0]]))+'</div><div class="mmTileNum">'+list.filter(function(x){ return x.column===g[0]; }).length+'</div></div>'; }).join('')+'</div>';
  h+='<div class="card" id="dtsStudents"><h3 style="margin-top:0">🎓 '+esc(gpT('Students — {school}',{school:dtsSchoolName_(sch)}))+'</h3>'+
    '<p class="hint" style="margin:0 0 8px">'+esc(t('From the portal’s DTS applications. Tap a student for their details and their 1-on-1.'))+'</p>';
  if(!list.length) h+='<p class="sub" style="margin:0">'+esc(t('No applications for this school yet.'))+'</p>';
  if(here.length) h+='<div class="dtsClassBar"><label class="dtsAll"><input type="checkbox" id="dtsSelAll"'+(nSel && nSel===here.length?' checked':'')+'> '+esc(t('Select everyone here'))+'</label>'+
    (nSel ? '<span class="dtsGradBox"><input type="date" id="dtsGradDate" max="'+esc(d.today||todayStr())+'" value="'+esc(S.dtsGradDate||d.today||todayStr())+'">'+
      '<button class="btn small" id="dtsMarkGrad">🎓 '+esc(gpT('Graduated ({n})',{n:nSel}))+'</button></span>' : '<span class="hint">'+esc(t('Tick students to mark them graduated together.'))+'</span>')+'</div>';
  groups.forEach(function(g){
    var rows=list.filter(function(x){ return x.column===g[0]; }); if(!rows.length) return;
    h+='<div class="dtsGroupH">'+g[1]+' '+esc(t(DTS_COL_WORD[g[0]]))+' · '+rows.length+'</div>'+rows.map(function(x){
      var p=dtsStuVal_(x), oo=x.oneOnOne ? dtsStaffName_(x.oneOnOne) : '';
      var tick=g[0]==='arrived' ? '<label class="dtsTick"><input type="checkbox" data-dtssel="'+esc(x.id)+'"'+(sel[x.id]?' checked':'')+' aria-label="'+esc(x.name)+'"></label>' : '';
      return '<div class="dtsStu'+(x.graduated?' grad':'')+'" data-dtsstu="'+esc(x.id)+'">'+tick+'<button class="dtsStuOpen" data-dtsstuopen="'+esc(x.id)+'"><b>'+esc(x.name)+'</b><span class="rowSub">'+
        esc([dtsSexWord_(p.sex), x.audience==='khmer' ? t('Khmer') : (x.country||t('International')), oo ? gpT('1-on-1: {name}',{name:oo}) : t('No 1-on-1 yet')].filter(Boolean).join(' · '))+'</span>'+
        (x.graduated ? '<span class="rowSub dtsGradLine">🎓 '+esc(gpT('Graduated {date}',{date:fmtDayShort_(x.graduated)}))+'</span>' : '')+'</button>'+
        (x.arrived ? '<button class="dtsStaff'+(x.potentialStaff?' on':'')+'" data-dtsstaff="'+esc(x.id)+'" aria-pressed="'+!!x.potentialStaff+'" title="'+esc(t('Potential staff'))+'">⭐ <span>'+esc(t('Potential staff'))+'</span></button>' : '')+
        dtsPipeLine_(x)+'</div>';
    }).join('');
  });
  var loose=((S.dts && S.dts.students)||[]).filter(function(x){ return !x.schoolId; });
  if(loose.length) h+='<details class="dtsPast" id="dtsLoose"><summary>'+esc(gpT('Not in a school yet ({n})',{n:loose.length}))+'</summary>'+loose.map(function(x){
    return '<div class="dtsStu"><button class="dtsStuOpen" data-dtsstuopen="'+esc(x.id)+'"><b>'+esc(x.name)+'</b><span class="rowSub">'+esc(x.applied ? gpT('Applied {date}',{date:fmtDayShort_(x.applied)}) : '')+'</span></button>'+
      '<button class="btn small ghost" data-dtsplace="'+esc(x.id)+'">'+esc(gpT('Put in {school}',{school:dtsSchoolName_(sch)}))+'</button></div>'; }).join('')+'</details>';
  return h+'</div>';
}
function dtsSexWord_(v){ v=String(v||'').toLowerCase(); return /female|ស្រី/.test(v) ? t('Female') : /male|ប្រុស/.test(v) ? t('Male') : ''; }
/* what the school has for a student: what the team typed, else what they wrote in the portal */
function dtsStuVal_(x){ var o={}, pr=(x && x.profile)||{}, po=(x && x.portal)||{}; ['sex','dob','phone','email','guardianName','guardianPhone','pastorName','pastorPhone','church','notes'].forEach(function(k){ o[k]=pr[k]||po[k]||''; }); return o; }
var DTS_STU_FIELDS=[['sex','Sex'],['dob','Date of birth'],['phone','Phone'],['email','Email'],['guardianName','Parent or guardian'],['guardianPhone','Parent or guardian’s phone'],['pastorName','Pastor'],['pastorPhone','Pastor’s phone'],['church','Church']];
function dtsTel_(v){ var d=String(v||'').replace(/[^\d+]/g,''); return d.length>=6 ? '<a href="tel:'+esc(d)+'">'+esc(v)+'</a>' : esc(v); }
function dtsStuHtml_(x, sch){
  var back='<button class="linkbtn inline" id="dtsStuBack">← '+esc(t('All students'))+'</button>';
  if(!x) return '<div class="card">'+back+'</div>';
  var v=dtsStuVal_(x), ed=S.dtsStuEdit;
  var h='<div class="card" id="dtsStuCard">'+back+'<h2 style="margin:8px 0 2px">'+esc(x.name)+'</h2><p class="sub" style="margin:0 0 10px">'+
    esc([t(DTS_COL_WORD[x.column]||x.column), x.applied ? gpT('Applied {date}',{date:fmtDayShort_(x.applied)}) : '', x.audience==='khmer' ? t('Khmer') : (x.country||'')].filter(Boolean).join(' · '))+'</p>'+
    '<div class="dtsOneOnOne" id="dtsStuOO"><label class="f" for="dtsStuOOSel">🤝 '+esc(t('Their 1-on-1'))+'</label>'+dtsStaffSelectHtml_('dtsStuOOSel', x.oneOnOne, '')+'</div>';
  if(ed){
    h+='<div id="dtsStuForm">'+DTS_STU_FIELDS.map(function(f){
      return '<label class="f" for="dsp_'+f[0]+'">'+esc(t(f[1]))+'</label><input type="'+(f[0]==='email'?'email':f[0]==='dob'?'text':'text')+'" id="dsp_'+f[0]+'" data-dsp="'+f[0]+'" maxlength="200" value="'+esc(ed[f[0]]||'')+'"'+(x.portal[f[0]] ? ' placeholder="'+esc(x.portal[f[0]])+'"' : '')+'>';
    }).join('')+'<label class="f" for="dsp_notes">'+esc(t('Notes'))+'</label><textarea id="dsp_notes" data-dsp="notes" rows="3" maxlength="2000">'+esc(ed.notes||'')+'</textarea>'+
      '<div class="dtsBtns"><button class="btn small" id="dtsStuSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsStuCancel">'+esc(t('Cancel'))+'</button></div></div>';
  } else {
    h+='<div class="dtsKv">'+DTS_STU_FIELDS.map(function(f){
      var val=f[0]==='sex' ? (dtsSexWord_(v.sex)||v.sex) : v[f[0]];
      return '<div class="kv"><b>'+esc(t(f[1]))+'</b><span>'+(val ? (/phone/i.test(f[0]) ? dtsTel_(val) : f[0]==='email' ? '<a href="mailto:'+esc(val)+'">'+esc(val)+'</a>' : esc(val)) : '<i>—</i>')+'</span></div>';
    }).join('')+(v.notes ? '<div class="kv"><b>'+esc(t('Notes'))+'</b><span style="white-space:pre-wrap">'+esc(v.notes)+'</span></div>' : '')+'</div>'+
      '<p class="hint" style="margin:6px 0 0">'+esc(t('From what they wrote in the portal, unless the school changed it here.'))+'</p>'+
      '<div class="dtsBtns"><button class="btn small ghost" id="dtsStuEditBtn">✏️ '+esc(t('Edit details'))+'</button>'+
      (S.dts && S.dts.portal ? '<a class="btn small ghost" href="portal.html?open='+encodeURIComponent(x.id)+'" target="_blank" rel="noopener">🛂 '+esc(t('Open in the portal'))+'</a>' : '')+'</div>';
  }
  var schools=dtsDb_().schools||[];
  h+='<label class="f" for="dtsStuSchool">🏫 '+esc(t('School'))+'</label><select id="dtsStuSchool">'+schools.map(function(s){ return '<option value="'+esc(s.id)+'"'+(x.schoolId===s.id?' selected':'')+'>'+esc(dtsSchoolName_(s))+'</option>'; }).join('')+
    (x.schoolId ? '' : '<option value="" selected>'+esc(t('— not in a school yet —'))+'</option>')+'</select>';
  if(x.arrived) h+='<div class="dtsBtns"><button class="dtsStaff'+(x.potentialStaff?' on':'')+'" data-dtsstaff="'+esc(x.id)+'" aria-pressed="'+!!x.potentialStaff+'">⭐ <span>'+esc(t('Potential staff'))+'</span></button>'+
    (x.graduated ? '<span class="rowSub">🎓 '+esc(gpT('Graduated {date}',{date:fmtDayShort_(x.graduated)}))+' · <button class="linkbtn inline" data-dtsungrad="'+esc(x.id)+'">'+esc(t('Undo'))+'</button></span>' : '')+'</div>'+dtsPipeLine_(x);
  return h+'</div>';
}
/* ---- Events ---- */
function dtsEventsHtml_(d, sch){
  var list=dtsIn_(dtsDb_().events), today=d.today||todayStr(), h='';
  if(S.dtsEv) h+=dtsEventFormHtml_(S.dtsEv);
  else h+='<button class="btn" id="dtsEvAdd" style="margin-top:0">＋ '+esc(t('Add an event'))+'</button>';
  var up=list.filter(function(e){ return (e.end||e.date)>=today; }), past=list.filter(function(e){ return (e.end||e.date)<today; }).reverse();
  var row=function(e){ return '<button class="dtsLect" data-dtsev="'+esc(e.id)+'"><span class="dtsLectWhen">'+esc(fmtDayShort_(e.date)+(e.end && e.end!==e.date ? ' – '+fmtDayShort_(e.end) : ''))+'</span>'+
    '<span class="dtsLectText"><b>'+esc(e.title)+'</b>'+(e.notes ? '<span class="rowSub">'+esc(e.notes)+'</span>' : '')+'</span></button>'; };
  h+='<div class="card" id="dtsEvents"><h3 style="margin-top:0">📅 '+esc(t('Important dates'))+'</h3>'+(up.length ? up.map(row).join('') : '<p class="sub" style="margin:0">'+esc(t('No events coming up. Add the school’s important dates — arrival, graduation, outreach send-off.'))+'</p>')+
    (past.length ? '<details class="dtsPast"><summary>'+esc(gpT('Earlier ({n})',{n:past.length}))+'</summary>'+past.map(row).join('')+'</details>' : '')+'</div>';
  return h;
}
function dtsEventFormHtml_(f){
  return '<div class="card" id="dtsEvForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the event') : t('Add an event'))+'</h3>'+
    '<label class="f" for="de_title">'+esc(t('What'))+'</label><input type="text" id="de_title" data-de="title" maxlength="160" placeholder="'+esc(t('e.g. Students arrive, Graduation'))+'" value="'+esc(f.title||'')+'">'+
    '<div class="dtsTwo"><div><label class="f" for="de_date">'+esc(t('From'))+'</label><input type="date" id="de_date" data-de="date" value="'+esc(f.date||'')+'"></div>'+
    '<div><label class="f" for="de_end">'+esc(t('To (optional)'))+'</label><input type="date" id="de_end" data-de="end" value="'+esc(f.end||'')+'"></div></div>'+
    '<label class="f" for="de_notes">'+esc(t('Notes'))+'</label><textarea id="de_notes" data-de="notes" rows="2" maxlength="1000">'+esc(f.notes||'')+'</textarea>'+
    dtsFormBtns_('dtsEv', f.id)+'</div>';
}
function dtsFormBtns_(p, id){
  return '<div class="dtsBtns"><button class="btn small" id="'+p+'Save"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="'+p+'Cancel">'+esc(t('Cancel'))+'</button>'+
    (id ? '<button class="linkbtn danger" id="'+p+'Del" style="width:auto">'+esc(t('Delete'))+'</button>' : '')+'</div>';
}
/* ---- School policy: numbered headings, "*" lines are points ---- */
function dtsPolicyBody_(text){
  var h='', open=false;
  String(text||'').split(/\r?\n/).forEach(function(line){
    var l=line.trim(); if(!l) return;
    var b=l.match(/^[*•\-]\s*(.*)$/);
    if(b){ if(!open){ h+='<ul>'; open=true; } h+='<li>'+esc(b[1])+'</li>'; return; }
    if(open){ h+='</ul>'; open=false; }
    h+=/^\d+[.)]\s/.test(l) ? '<h4>'+esc(l)+'</h4>' : '<p>'+esc(l)+'</p>';
  });
  return h+(open ? '</ul>' : '');
}
function dtsPolicyHtml_(){
  var db=dtsDb_();
  if(S.dtsPol!==undefined && S.dtsPol!==null) return '<div class="card" id="dtsPolForm"><h3 style="margin-top:0">📜 '+esc(t('School policy'))+'</h3>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(t('A number starts a heading (“3. Participation”); a line starting with * is a point under it.'))+'</p>'+
    '<textarea id="dtsPolText" rows="18" maxlength="8000">'+esc(S.dtsPol)+'</textarea>'+
    '<div class="dtsBtns"><button class="btn small" id="dtsPolSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsPolCancel">'+esc(t('Cancel'))+'</button></div></div>';
  return '<div class="card dtsPolicy" id="dtsPolicy"><h3 style="margin-top:0">📜 '+esc(t('School policy'))+'</h3><p class="hint" style="margin:0 0 8px">'+esc(t('For every DTS on this campus.'))+'</p>'+
    dtsPolicyBody_(db.policy)+'<div class="dtsBtns"><button class="btn small ghost" id="dtsPolEdit">✏️ '+esc(t('Edit the policy'))+'</button></div></div>';
}
/* ---- Outreach: teams, each with a short (2 weeks) and a long (8 weeks) outreach ---- */
function dtsPhaseWeeks_(ph, kind){
  if(ph && ph.from && ph.to && ph.to>=ph.from){ var n=Math.ceil((Date.parse(ph.to)-Date.parse(ph.from))/86400000/7+1/7); return Math.max(1, Math.min(12, n)); }
  return DTS_PHASE_WEEKS[kind];
}
function dtsReachSum_(ph){ var s={}; ((ph && ph.weeks)||[]).forEach(function(w){ DTS_REACH.forEach(function(r){ s[r[0]]=(s[r[0]]||0)+(Number(w && w[r[0]])||0); }); }); return s; }
function dtsReachLine_(s){ return [['male','♂'],['female','♀'],['salvations','❤️'],['healings','✨'],['gospel','📣']].filter(function(x){ return s[x[0]]; }).map(function(x){ return x[1]+' '+s[x[0]]; }).join('  '); }
function dtsOutSecHtml_(d, sch){
  if(S.dtsTeam) return dtsTeamFormHtml_(S.dtsTeam, sch);
  var teams=dtsIn_(dtsDb_().teams), studs=dtsStudents_();
  var onTeam={}; teams.forEach(function(tm){ ['short','long'].forEach(function(k){ ((tm[k]||{}).students||[]).forEach(function(id){ (onTeam[id]=onTeam[id]||{})[k]=tm.name; }); }); });
  var h='<button class="btn" id="dtsTeamAdd" style="margin-top:0">＋ '+esc(t('Add an outreach team'))+'</button>';
  h+='<div class="card" id="dtsTeams"><h3 style="margin-top:0">🌏 '+esc(gpT('Outreach teams — {school}',{school:dtsSchoolName_(sch)}))+'</h3>';
  if(!teams.length) h+='<p class="sub" style="margin:0">'+esc(t('No teams yet. Add each team: where the short and the long outreach go, when, who leads, which students — then its numbers week by week.'))+'</p>';
  h+=teams.map(function(tm){
    var ph=function(k, label){ var p=tm[k]||{}, s=dtsReachSum_(p);
      return '<div class="dtsPhaseLine"><b>'+esc(t(label))+'</b> '+esc([p.place, [fmtDayShort_(p.from), fmtDayShort_(p.to)].filter(Boolean).join(' – '), (p.students||[]).length ? gpT('{n} students',{n:(p.students||[]).length}) : ''].filter(Boolean).join(' · ') || t('not set yet'))+
        (dtsReachLine_(s) ? '<span class="rowSub">'+esc(dtsReachLine_(s))+'</span>' : '')+'</div>'; };
    var leaders=((tm.short||{}).leaders||[]).concat((tm.long||{}).leaders||[]).filter(function(x, i, a){ return a.indexOf(x)===i; }).map(dtsStaffName_).filter(Boolean);
    return '<button class="dtsTeamCard" data-dtsteam="'+esc(tm.id)+'"><span class="dtsTeamName">'+esc(tm.name)+'</span>'+(leaders.length ? '<span class="rowSub">'+esc(gpT('Led by {name}',{name:leaders.join(', ')}))+'</span>' : '')+
      ph('short','Short outreach')+ph('long','Long outreach')+'</button>';
  }).join('')+'</div>';
  var free=studs.filter(function(x){ return !onTeam[x.id]; });
  h+='<div class="card" id="dtsOutStudents"><h3 style="margin-top:0">🎓 '+esc(gpT('Students for {year}',{year:sch.year}))+' · '+studs.length+'</h3>'+
    (studs.length ? '<p class="hint" style="margin:0 0 6px">'+esc(gpT('{n} not on a team yet',{n:free.length}))+'</p>'+studs.map(function(x){ var o=onTeam[x.id]||{};
      return '<div class="dtsStuMini"><span>'+esc(x.name)+'</span><span class="rowSub">'+esc(o.short||o.long ? [o.short ? t('Short')+': '+o.short : '', o.long ? t('Long')+': '+o.long : ''].filter(Boolean).join(' · ') : t('Not on a team yet'))+'</span></div>'; }).join('')
      : '<p class="sub" style="margin:0">'+esc(t('No applications for this school yet.'))+'</p>')+'</div>';
  var old=d.outreaches||[];
  if(old.length) h+='<details class="dtsPast card" id="dtsOldOut"><summary>'+esc(gpT('Earlier outreach records ({n})',{n:old.length}))+'</summary>'+old.map(function(o){
    return '<div class="dtsOut"><div class="dtsOutText"><b>'+esc(o.place)+'</b><span class="rowSub">'+esc([fmtDayShort_(o.from), fmtDayShort_(o.to)].filter(Boolean).join(' – '))+(dtsFruitLine_(dtsFruitSum_(o.reports)) ? ' · '+esc(dtsFruitLine_(dtsFruitSum_(o.reports))) : '')+'</span></div></div>'; }).join('')+'</details>';
  h+='<div class="card dtsSoon" id="dtsOutBudget"><h3 style="margin-top:0">💰 '+esc(t('Outreach budget'))+'</h3><p class="sub" style="margin:0">'+esc(t('Coming soon: each outreach’s budget beside what was spent.'))+'</p></div>';
  return h;
}
function dtsTeamFormHtml_(f, sch){
  var studs=dtsStudents_(), teams=dtsIn_(dtsDb_().teams).filter(function(x){ return x.id!==f.id; });
  var phase=function(k, label){
    var p=f[k], n=dtsPhaseWeeks_(p, k), other={};
    teams.forEach(function(tm){ ((tm[k]||{}).students||[]).forEach(function(id){ other[id]=tm.name; }); });
    var tot=dtsReachSum_({ weeks:(p.weeks||[]).slice(0,n) });
    var h='<div class="dtsPhase" id="dtsPhase_'+k+'"><h3 style="margin:0 0 4px">'+esc(t(label))+'</h3><p class="hint" style="margin:0 0 6px">'+esc(gpT('{n} weeks',{n:n}))+'</p>'+
      '<label class="f">'+esc(t('Where'))+'</label><input type="text" data-dtp="'+k+'|place" maxlength="120" placeholder="'+esc(t('e.g. Mondulkiri'))+'" value="'+esc(p.place||'')+'">'+
      '<div class="dtsTwo"><div><label class="f">'+esc(t('From'))+'</label><input type="date" data-dtp="'+k+'|from" value="'+esc(p.from||'')+'"></div><div><label class="f">'+esc(t('To'))+'</label><input type="date" data-dtp="'+k+'|to" value="'+esc(p.to||'')+'"></div></div>'+
      '<label class="f">'+esc(t('Leaders'))+'</label>'+dtsPeopleChecks_('data-dtpl="'+k+'"', p.leaders, t('Pick the leaders'))+
      '<input type="text" data-dtp="'+k+'|others" maxlength="200" placeholder="'+esc(t('Other leaders, not on staff (optional)'))+'" value="'+esc(p.others||'')+'" style="margin-top:6px">'+
      '<label class="f">'+esc(gpT('Students ({n})',{n:(p.students||[]).length}))+'</label>'+
      (studs.length ? '<details class="dtsPick"'+((p.students||[]).length?'':' open')+'><summary>'+esc((p.students||[]).map(function(id){ var s=dtsStudent_(id); return s ? s.name : ''; }).filter(Boolean).join(', ') || t('Pick the students'))+'</summary><div class="dtsPickList">'+
        studs.map(function(x){ return '<label class="dtsPickRow"><input type="checkbox" data-dtps="'+k+'" value="'+esc(x.id)+'"'+((p.students||[]).indexOf(x.id)>-1?' checked':'')+'> '+esc(x.name)+(other[x.id] ? ' <span class="hint">· '+esc(gpT('on {team}',{team:other[x.id]}))+'</span>' : '')+'</label>'; }).join('')+'</div></details>'
        : '<p class="hint" style="margin:0">'+esc(t('No applications for this school yet.'))+'</p>')+
      (k==='long' ? '<button class="linkbtn inline" id="dtsCopyShort" style="margin-top:4px">'+esc(t('Same leaders and students as the short outreach'))+'</button>' : '')+
      '<div class="dtsGroupH">📊 '+esc(t('Week by week'))+'</div><div class="dtsTblWrap"><table class="dtsTbl dtsWeeks" id="dtsWeeks_'+k+'"><thead><tr><th>'+esc(t('Week'))+'</th>'+DTS_REACH.map(function(r){ return '<th>'+esc(t(r[1]))+'</th>'; }).join('')+'</tr></thead><tbody>';
    for(var i=0;i<n;i++){
      var w=(p.weeks||[])[i]||{}, wd=p.from ? fmtDayShort_(dtsAddDays_(p.from, 7*i)) : '';
      h+='<tr><th>'+esc(gpT('Week {n}',{n:i+1}))+(wd ? '<span class="rowSub">'+esc(wd)+'</span>' : '')+'</th>'+DTS_REACH.map(function(r){ return '<td><input type="number" min="0" inputmode="numeric" data-dtpw="'+k+'|'+i+'|'+r[0]+'" value="'+esc(w[r[0]] ? String(w[r[0]]) : '')+'" aria-label="'+esc(t(r[1])+' · '+gpT('Week {n}',{n:i+1}))+'"></td>'; }).join('')+'</tr>';
    }
    h+='</tbody><tfoot><tr><th>'+esc(t('Total'))+'</th>'+DTS_REACH.map(function(r){ return '<td>'+(tot[r[0]]||0)+'</td>'; }).join('')+'</tr></tfoot></table></div>'+
      (p.from ? '' : '<p class="hint" style="margin:4px 0 0">'+esc(t('Set the dates and these numbers count in GPDTS’s totals week by week.'))+'</p>')+'</div>';
    return h;
  };
  return '<div class="card" id="dtsTeamForm"><button class="linkbtn inline" id="dtsTeamBack">← '+esc(t('All teams'))+'</button>'+
    '<label class="f" for="dt_name">'+esc(t('Team name'))+'</label><input type="text" id="dt_name" maxlength="80" placeholder="'+esc(t('e.g. Team Mondulkiri'))+'" value="'+esc(f.name||'')+'">'+
    phase('short','Short outreach')+phase('long','Long outreach')+
    '<label class="f" for="dt_notes">'+esc(t('Notes'))+'</label><textarea id="dt_notes" rows="2" maxlength="1000">'+esc(f.notes||'')+'</textarea>'+
    dtsFormBtns_('dtsTeam', f.id)+'</div>';
}
function dtsNewPhase_(){ return { place:'', from:'', to:'', leaders:[], others:'', students:[], weeks:[] }; }
/* ---- Responsibilities: before school and in school, each given to staff ---- */
function dtsRespHtml_(sch){
  var list=dtsIn_(dtsDb_().resp), h='';
  if(S.dtsResp) return dtsRespFormHtml_(S.dtsResp);
  h+='<button class="btn" id="dtsRespAdd" style="margin-top:0">＋ '+esc(t('Add a responsibility'))+'</button>';
  [['before','Before school','🧳'],['school','During school','🏫']].forEach(function(g){
    var rows=list.filter(function(r){ return r.when===g[0]; });
    h+='<div class="card" id="dtsResp_'+g[0]+'"><h3 style="margin-top:0">'+g[2]+' '+esc(t(g[1]))+' · '+rows.length+'</h3>'+
      (rows.length ? rows.map(function(r){ var who=(r.staff||[]).map(dtsStaffName_).filter(Boolean);
        return '<button class="dtsLect" data-dtsresp="'+esc(r.id)+'"><span class="dtsLectText"><b>'+(r.done?'✅ ':'')+esc(r.title)+'</b>'+(r.notes ? '<span class="rowSub">'+esc(r.notes)+'</span>' : '')+
          '<span class="rowSub">👤 '+esc(who.length ? who.join(', ') : t('Nobody yet'))+'</span></span></button>'; }).join('')
        : '<p class="sub" style="margin:0">'+esc(t('Nothing here yet.'))+'</p>')+'</div>';
  });
  return h;
}
function dtsRespFormHtml_(f){
  return '<div class="card" id="dtsRespForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the responsibility') : t('Add a responsibility'))+'</h3>'+
    '<div class="seg"><button data-drwhen="before" class="'+(f.when==='before'?'on':'')+'">🧳 '+esc(t('Before school'))+'</button><button data-drwhen="school" class="'+(f.when!=='before'?'on':'')+'">🏫 '+esc(t('During school'))+'</button></div>'+
    '<label class="f" for="dr_title">'+esc(t('What'))+'</label><input type="text" id="dr_title" maxlength="160" placeholder="'+esc(t('e.g. Book the speakers’ rooms'))+'" value="'+esc(f.title||'')+'">'+
    '<label class="f" for="dr_notes">'+esc(t('A short description'))+'</label><textarea id="dr_notes" rows="3" maxlength="1000">'+esc(f.notes||'')+'</textarea>'+
    '<label class="f">'+esc(t('Who it’s given to'))+'</label>'+dtsPeopleChecks_('data-drstaff', f.staff, t('Pick the staff'))+
    '<label class="dtsConf"><input type="checkbox" id="dr_done"'+(f.done?' checked':'')+'> '+esc(t('Done'))+'</label>'+
    dtsFormBtns_('dtsResp', f.id)+'</div>';
}
/* ---- Resources: links and notes the school keeps ---- */
function dtsResHtml_(sch){
  var list=dtsIn_(dtsDb_().resources), h='';
  if(S.dtsRes) return dtsResFormHtml_(S.dtsRes);
  h+='<button class="btn" id="dtsResAdd" style="margin-top:0">＋ '+esc(t('Add a resource'))+'</button>';
  h+='<div class="card" id="dtsResources"><h3 style="margin-top:0">📚 '+esc(t('Resources'))+'</h3>'+(list.length ? list.map(function(r){
    return '<div class="dtsResRow">'+(r.url ? '<a href="'+esc(r.url)+'" target="_blank" rel="noopener"><b>'+esc(r.title)+'</b> ↗</a>' : '<b>'+esc(r.title)+'</b>')+
      (r.notes ? '<span class="rowSub">'+esc(r.notes)+'</span>' : '')+'<button class="linkbtn inline" data-dtsres="'+esc(r.id)+'">'+esc(t('Edit'))+'</button></div>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('Nothing here yet. Add the school’s documents and links — the schedule, the curriculum, forms, a shared folder.'))+'</p>')+'</div>';
  return h;
}
function dtsResFormHtml_(f){
  return '<div class="card" id="dtsResForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the resource') : t('Add a resource'))+'</h3>'+
    '<label class="f" for="dres_title">'+esc(t('Name'))+'</label><input type="text" id="dres_title" maxlength="160" value="'+esc(f.title||'')+'">'+
    '<label class="f" for="dres_url">'+esc(t('Link (optional)'))+'</label><input type="url" id="dres_url" maxlength="600" placeholder="https://" value="'+esc(f.url||'')+'">'+
    '<label class="f" for="dres_notes">'+esc(t('Notes'))+'</label><textarea id="dres_notes" rows="2" maxlength="1000">'+esc(f.notes||'')+'</textarea>'+
    dtsFormBtns_('dtsRes', f.id)+'</div>';
}
/* ---- saving ---- */
function dtsDbSave_(kind, rec, msg, done){
  S.dtsBusy=true; render();
  run('dtsDbSave',[S.auth.user,S.auth.pin,kind,rec],function(d){
    S.dtsBusy=false;
    if(d && d.ok){ S.dts.db=d.db; if(done) done(d); showMsg(msg||t('Saved')); if(kind==='team') dtsRefresh_(); }
    else showMsg(d && d.err==='bad_resource' ? t('A link starts with https://') : t('Could not save'));
    render();
  }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
}
function dtsDbDel_(kind, id, done){
  run('dtsDbDelete',[S.auth.user,S.auth.pin,kind,id],function(d){
    if(d && d.ok){ S.dts.db=d.db; if(done) done(); showMsg(t('Deleted')); if(kind==='team') dtsRefresh_(); }
    else showMsg(d && d.err==='in_use' ? t('This school still has things in it — move or delete them first.') : t('Could not delete'));
    render();
  });
}
function dtsStuSave_(id, p, msg){
  S.dtsBusy=true; render();
  run('dtsStudentSave',[S.auth.user,S.auth.pin,id,p],function(d){
    S.dtsBusy=false;
    if(d && d.ok && d.student){ S.dts.students=(S.dts.students||[]).map(function(x){ return x.id===id ? d.student : x; }); S.dtsStuEdit=null; showMsg(msg||t('Saved')); }
    else showMsg(t('Could not save'));
    render();
  }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
}
function dtsKeepTeam_(){
  var f=S.dtsTeam; if(!f) return;
  var n=document.getElementById('dt_name'); if(n) f.name=n.value;
  var no=document.getElementById('dt_notes'); if(no) f.notes=no.value;
  document.querySelectorAll('[data-dtp]').forEach(function(el){ var k=el.getAttribute('data-dtp').split('|'); f[k[0]][k[1]]=el.value; });
  ['short','long'].forEach(function(k){
    var ls=document.querySelectorAll('[data-dtpl="'+k+'"]'); if(ls.length){ f[k].leaders=[]; ls.forEach(function(c){ if(c.checked) f[k].leaders.push(c.value); }); }
  });
  document.querySelectorAll('[data-dtpw]').forEach(function(el){ var k=el.getAttribute('data-dtpw').split('|'), ph=f[k[0]], i=Number(k[1]); ph.weeks=ph.weeks||[]; ph.weeks[i]=ph.weeks[i]||{}; ph.weeks[i][k[2]]=el.value; });
  ['short','long'].forEach(function(k){ var ss=document.querySelectorAll('[data-dtps="'+k+'"]'); if(ss.length){ f[k].students=[]; ss.forEach(function(c){ if(c.checked) f[k].students.push(c.value); }); } });
}
function bindDtsDb_(){
  if(!S.dts) return;
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  var all=function(sel, fn){ document.querySelectorAll(sel).forEach(function(el){ el.onclick=function(e){ fn(el, e); }; }); };
  // the school
  all('[data-dtsdbyear]', function(b){ S.dtsDbYear=b.getAttribute('data-dtsdbyear'); S.dtsSchool=''; S.dtsSchoolEdit=null; var first=(dtsDb_().schools||[]).filter(function(s){ return String(s.year)===S.dtsDbYear; })[0]; if(first) S.dtsSchool=first.id; dtsCloseForms_(); render(); });
  all('[data-dtsschool]', function(b){ S.dtsSchool=b.getAttribute('data-dtsschool'); S.dtsSchoolEdit=null; dtsCloseForms_(); render(); });
  document.querySelectorAll('#dtsSchoolAdd').forEach(function(b){ b.onclick=function(){ var td=(S.dts.today||todayStr()), y=Number(td.slice(0,4))+(Number(td.slice(5,7))>=7?1:0); S.dtsSchoolEdit={ year:y, name:t('January DTS'), from:'', to:'' }; render(); var n=document.getElementById('ds_name'); if(n) n.focus(); }; });
  on('dtsSchoolEditBtn', function(){ var s=dtsCurSchool_(); if(s){ S.dtsSchoolEdit=Object.assign({}, s); render(); } });
  on('dtsSchoolCancel', function(){ S.dtsSchoolEdit=null; render(); });
  var keepSchool=function(){ document.querySelectorAll('[data-ds]').forEach(function(el){ S.dtsSchoolEdit[el.getAttribute('data-ds')]=el.value; }); };
  document.querySelectorAll('[data-ds]').forEach(function(el){ el.oninput=function(){ keepSchool(); }; });
  on('dtsSchoolSave', function(){ keepSchool(); var f=S.dtsSchoolEdit;
    if(!(Number(f.year)>=2000) || !String(f.name||'').trim()){ showMsg(t('Give the school a year and a name.')); return; }
    dtsDbSave_('school', f, t('Saved'), function(d){ S.dtsSchool=d.id; S.dtsDbYear=String(f.year); S.dtsSchoolEdit=null; dtsRefresh_(); }); });
  on('dtsSchoolDel', function(){ var f=S.dtsSchoolEdit; if(!f || !confirm(gpT('Delete {school}?',{school:dtsSchoolName_(f)}))) return; dtsDbDel_('school', f.id, function(){ S.dtsSchoolEdit=null; S.dtsSchool=''; }); });
  all('[data-dtssec]', function(b){ S.dtsSec=b.getAttribute('data-dtssec'); dtsCloseForms_(); render(); });
  all('[data-dtslp]', function(b){ S.dtsLp=b.getAttribute('data-dtslp'); dtsCloseForms_(); render(); });
  // the speaker schedule
  all('[data-dtsneed]', function(b){ S.dtsNeed=b.getAttribute('data-dtsneed')==='1'; render(); });
  document.querySelectorAll('tr[data-dtslect]').forEach(function(tr){ tr.onkeydown=function(e){ if(e.key==='Enter') tr.click(); }; });
  // students
  all('[data-dtsstuopen]', function(b){ S.dtsStu=b.getAttribute('data-dtsstuopen'); S.dtsStuEdit=null; S.dtsLp='students'; render(); window.scrollTo(0,0); });
  on('dtsStuBack', function(){ S.dtsStu=null; S.dtsStuEdit=null; render(); });
  on('dtsStuEditBtn', function(){ var x=dtsStudent_(S.dtsStu); if(!x) return; S.dtsStuEdit=Object.assign({}, x.profile||{}); var v=dtsStuVal_(x); Object.keys(v).forEach(function(k){ if(!S.dtsStuEdit[k]) S.dtsStuEdit[k]=v[k]; }); render(); });
  on('dtsStuCancel', function(){ S.dtsStuEdit=null; render(); });
  document.querySelectorAll('[data-dsp]').forEach(function(el){ el.oninput=function(){ if(S.dtsStuEdit) S.dtsStuEdit[el.getAttribute('data-dsp')]=el.value; }; });
  on('dtsStuSave', function(){ var x=dtsStudent_(S.dtsStu), ed=S.dtsStuEdit; if(!x || !ed) return;
    /* only what differs from the portal is kept, so a later change there still shows */
    var pr={}; Object.keys(ed).forEach(function(k){ var v=String(ed[k]||'').trim(); if(v && v!==String((x.portal||{})[k]||'').trim()) pr[k]=v; });
    dtsStuSave_(x.id, { profile:pr }); });
  var oo=document.getElementById('dtsStuOOSel'); if(oo) oo.onchange=function(){ dtsStuSave_(S.dtsStu, { oneOnOne:oo.value }, oo.value ? gpT('{name} is their 1-on-1',{name:dtsStaffName_(oo.value)}) : t('Saved')); };
  var ss=document.getElementById('dtsStuSchool'); if(ss) ss.onchange=function(){ if(ss.value) dtsStuSave_(S.dtsStu, { schoolId:ss.value }); };
  all('[data-dtsplace]', function(b){ dtsStuSave_(b.getAttribute('data-dtsplace'), { schoolId:S.dtsSchool }); });
  // events
  on('dtsEvAdd', function(){ S.dtsEv={ title:'', date:'', end:'', notes:'', schoolId:S.dtsSchool }; render(); var n=document.getElementById('de_title'); if(n) n.focus(); });
  all('[data-dtsev]', function(b){ var e=dtsIn_(dtsDb_().events).filter(function(x){ return x.id===b.getAttribute('data-dtsev'); })[0]; if(e){ S.dtsEv=Object.assign({}, e); render(); } });
  document.querySelectorAll('[data-de]').forEach(function(el){ el.oninput=el.onchange=function(){ if(S.dtsEv) S.dtsEv[el.getAttribute('data-de')]=el.value; }; });
  on('dtsEvCancel', function(){ S.dtsEv=null; render(); });
  on('dtsEvSave', function(){ var f=S.dtsEv; if(!String(f.title||'').trim() || !f.date){ showMsg(t('Give the event a name and a day.')); return; } dtsDbSave_('event', f, t('Saved'), function(){ S.dtsEv=null; }); });
  on('dtsEvDel', function(){ if(S.dtsEv && confirm(t('Delete this event?'))) dtsDbDel_('event', S.dtsEv.id, function(){ S.dtsEv=null; }); });
  // the policy
  on('dtsPolEdit', function(){ S.dtsPol=dtsDb_().policy||''; render(); });
  on('dtsPolCancel', function(){ S.dtsPol=null; render(); });
  var pt=document.getElementById('dtsPolText'); if(pt) pt.oninput=function(){ S.dtsPol=pt.value; };
  on('dtsPolSave', function(){ if(!String(S.dtsPol||'').trim()){ showMsg(t('The policy can’t be empty.')); return; } dtsDbSave_('policy', { text:S.dtsPol }, t('Saved'), function(){ S.dtsPol=null; }); });
  // outreach teams
  on('dtsTeamAdd', function(){ S.dtsTeam={ name:'', notes:'', schoolId:S.dtsSchool, short:dtsNewPhase_(), long:dtsNewPhase_() }; render(); window.scrollTo(0,0); var n=document.getElementById('dt_name'); if(n) n.focus(); });
  all('[data-dtsteam]', function(b){ var tm=dtsIn_(dtsDb_().teams).filter(function(x){ return x.id===b.getAttribute('data-dtsteam'); })[0]; if(!tm) return;
    S.dtsTeam=JSON.parse(JSON.stringify(tm)); ['short','long'].forEach(function(k){ S.dtsTeam[k]=Object.assign(dtsNewPhase_(), S.dtsTeam[k]||{}); }); render(); window.scrollTo(0,0); });
  on('dtsTeamBack', function(){ S.dtsTeam=null; render(); });
  on('dtsTeamCancel', function(){ S.dtsTeam=null; render(); });
  /* dates change how many weeks there are; ticks change the names in the fold — keep what's typed and draw again */
  document.querySelectorAll('[data-dtp$="|from"], [data-dtp$="|to"], [data-dtps], [data-dtpl]').forEach(function(el){ el.onchange=function(){ dtsKeepTeam_(); var y=window.scrollY, open=[].map.call(document.querySelectorAll('#dtsTeamForm details'), function(d){ return d.open; }); render(); [].forEach.call(document.querySelectorAll('#dtsTeamForm details'), function(d, i){ if(open[i]) d.open=true; }); window.scrollTo(0,y); }; });
  document.querySelectorAll('[data-dtpw]').forEach(function(el){ el.oninput=function(){ dtsKeepTeam_(); var k=el.getAttribute('data-dtpw').split('|')[0], ph=S.dtsTeam[k], n=dtsPhaseWeeks_(ph, k), tot=dtsReachSum_({ weeks:(ph.weeks||[]).slice(0,n) });
    var cells=document.querySelectorAll('#dtsWeeks_'+k+' tfoot td'); DTS_REACH.forEach(function(r, i){ if(cells[i]) cells[i].textContent=tot[r[0]]||0; }); }; });
  on('dtsCopyShort', function(){ dtsKeepTeam_(); var f=S.dtsTeam; f.long.leaders=(f.short.leaders||[]).slice(); f.long.others=f.short.others||''; f.long.students=(f.short.students||[]).slice(); render(); });
  on('dtsTeamSave', function(){ dtsKeepTeam_(); var f=S.dtsTeam; if(!String(f.name||'').trim()){ showMsg(t('Give the team a name.')); return; } dtsDbSave_('team', f, t('Saved'), function(){ S.dtsTeam=null; }); });
  on('dtsTeamDel', function(){ if(S.dtsTeam && confirm(t('Delete this team and its numbers?'))) dtsDbDel_('team', S.dtsTeam.id, function(){ S.dtsTeam=null; }); });
  // responsibilities
  on('dtsRespAdd', function(){ S.dtsResp={ when:'before', title:'', notes:'', staff:[], done:false, schoolId:S.dtsSchool }; render(); var n=document.getElementById('dr_title'); if(n) n.focus(); });
  all('[data-dtsresp]', function(b){ var r=dtsIn_(dtsDb_().resp).filter(function(x){ return x.id===b.getAttribute('data-dtsresp'); })[0]; if(r){ S.dtsResp=JSON.parse(JSON.stringify(r)); render(); } });
  var keepResp=function(){ var f=S.dtsResp; if(!f) return; var g=function(id){ var el=document.getElementById(id); return el ? el.value : ''; }; f.title=g('dr_title'); f.notes=g('dr_notes'); var dn=document.getElementById('dr_done'); if(dn) f.done=dn.checked;
    var cs=document.querySelectorAll('[data-drstaff]'); if(cs.length){ f.staff=[]; cs.forEach(function(c){ if(c.checked) f.staff.push(c.value); }); } };
  all('[data-drwhen]', function(b){ keepResp(); S.dtsResp.when=b.getAttribute('data-drwhen'); render(); });
  document.querySelectorAll('[data-drstaff]').forEach(function(c){ c.onchange=function(){ keepResp(); var y=window.scrollY; render(); var dd=document.querySelector('#dtsRespForm details'); if(dd) dd.open=true; window.scrollTo(0,y); }; });
  on('dtsRespCancel', function(){ S.dtsResp=null; render(); });
  on('dtsRespSave', function(){ keepResp(); if(!String(S.dtsResp.title||'').trim()){ showMsg(t('Say what the responsibility is.')); return; } dtsDbSave_('resp', S.dtsResp, t('Saved'), function(){ S.dtsResp=null; }); });
  on('dtsRespDel', function(){ if(S.dtsResp && confirm(t('Delete this responsibility?'))) dtsDbDel_('resp', S.dtsResp.id, function(){ S.dtsResp=null; }); });
  // resources
  on('dtsResAdd', function(){ S.dtsRes={ title:'', url:'', notes:'', schoolId:S.dtsSchool }; render(); var n=document.getElementById('dres_title'); if(n) n.focus(); });
  all('[data-dtsres]', function(b){ var r=dtsIn_(dtsDb_().resources).filter(function(x){ return x.id===b.getAttribute('data-dtsres'); })[0]; if(r){ S.dtsRes=Object.assign({}, r); render(); } });
  var keepRes=function(){ var f=S.dtsRes; if(!f) return; ['title','url','notes'].forEach(function(k){ var el=document.getElementById('dres_'+k); if(el) f[k]=el.value; }); };
  on('dtsResCancel', function(){ S.dtsRes=null; render(); });
  on('dtsResSave', function(){ keepRes(); var f=S.dtsRes; if(!String(f.title||'').trim()){ showMsg(t('Give it a name.')); return; } if(f.url && !/^https?:\/\//i.test(f.url)){ showMsg(t('A link starts with https://')); return; } dtsDbSave_('resource', f, t('Saved'), function(){ S.dtsRes=null; }); });
  on('dtsResDel', function(){ if(S.dtsRes && confirm(t('Delete this resource?'))) dtsDbDel_('resource', S.dtsRes.id, function(){ S.dtsRes=null; }); });
}
function dtsCloseForms_(){ S.dtsLect=null; S.dtsEv=null; S.dtsTeam=null; S.dtsResp=null; S.dtsRes=null; S.dtsStu=null; S.dtsStuEdit=null; S.dtsPol=null; }
