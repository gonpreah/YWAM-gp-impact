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
var DTS_TABS=['dtsdash','dtsdb','dtsfin'];
function isDtsMinistry_(dept, min){ return typeof autoMetricsFor==='function' && autoMetricsFor(S.me && S.me.campus, dept, min).length>0; }
function dtsTabs_(){ return [['dtsdash',t('Dashboard')],['dtsdb',t('Database')],['dtsfin',t('Finances')]]; }
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
  if(cur==='dtsfin') return dtsFinHtml_(d);
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
    '<p class="hint" style="margin:8px 0 0">'+esc(t('From the portal: DTS applications, and the people you add there and reach out to. Applied, accepted, enrolled, graduated, potential staff and students contacted are counted from it — nobody types them.'))+'</p></div>';
  h+=dtsYearHtml_(d);
  h+=dtsFinDashHtml_();
  return h;
}
/* the follow-ups due (from the portal's next steps) — on the Database tab since Nov 2026 (Andrew: "I want the
   dashboard to only have the metric informations") */
function dtsDueHtml_(d){
  var h='';
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
  return h;
}
/* the portal's DTS list and ＋ Add a contact, at the top of the Database tab */
function dtsPortalBarHtml_(d){
  return d.portal ? '<div class="dtsBtns dtsPortalBar" id="dtsPortalBar"><a class="btn small" id="dtsOpenPortal" href="'+esc(dtsPortalUrl_(''))+'" target="_blank" rel="noopener">🛂 '+esc(t('Open the DTS list in the portal'))+'</a>'+
    '<a class="btn ghost small" href="'+esc(dtsPortalUrl_(''))+'" target="_blank" rel="noopener">＋ '+esc(t('Add a contact'))+'</a></div>' : '';
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
  bindDtsFin_();
}

/* ==================== Database (Nov 2026, Andrew) ====================
   One school at a time: year chips, then that year's schools ("January DTS"), the one coming up chosen
   by default. Under it four parts — Lectures (Speaker schedule · Students · Events · School policy),
   Outreach, Responsibilities, Resources — each showing only that school's things. */
/* The Database opens on a page of tiles, one per part, each saying where things stand (Nov 2026,
   Uriah: "make it easier to use — it's still a bit overwhelming"): one level of choosing, not tabs
   inside tabs. Andrew's grouping is kept in the order — the lecture parts first, then outreach,
   responsibilities and resources. */
var DTS_SECS=[['speakers','🎤','Speaker schedule'],['students','🎓','Students'],['fees','💰','Lecture fees'],['events','📅','Events'],['out','🌏','Outreach'],['resp','📋','Responsibilities'],['res','📚','Resources'],['policy','📜','School policy']];
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
function dtsPeopleChecks_(attr, chosen, label, fold){
  chosen=chosen||[];
  var names=chosen.map(dtsStaffName_).filter(Boolean);
  return '<details class="dtsPick"'+(fold ? ' data-dtfold="'+fold+'"'+(dtsFoldOpen_(fold)?' open':'') : '')+'><summary>'+esc(names.length ? names.join(', ') : label)+'</summary><div class="dtsPickList">'+
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
  return dtsPortalBarHtml_(d)+dtsDbBodyHtml_(d);
}
function dtsDbBodyHtml_(d){
  var db=dtsDb_(), sch=dtsCurSchool_();
  var years=[]; (db.schools||[]).forEach(function(s){ if(years.indexOf(String(s.year))===-1) years.push(String(s.year)); });
  var yr=S.dtsDbYear && years.indexOf(S.dtsDbYear)>-1 ? S.dtsDbYear : (sch ? String(sch.year) : '');
  if(sch && String(sch.year)!==yr){ var first=(db.schools||[]).filter(function(s){ return String(s.year)===yr; })[0]; if(first){ S.dtsSchool=first.id; sch=first; } }
  var h='';
  if(!sch){
    /* no school yet: say what one is, and the one way to start */
    h+='<div class="card" id="dtsSchoolPick"><h3 style="margin-top:0">🏫 '+esc(t('Which school'))+'</h3>';
    h+=S.dtsSchoolEdit ? dtsSchoolFormHtml_(S.dtsSchoolEdit) :
      '<p class="sub" style="margin:0 0 8px">'+esc(t('Start with the school: its year and name, like 2027 · January DTS. Its lectures, students, events, outreach, responsibilities and resources all sit under it.'))+'</p><button class="btn small" id="dtsSchoolAdd">＋ '+esc(t('Add the school'))+'</button>';
    return h+'</div>'+dtsDueHtml_(d);
  }
  /* the school, on one line; the picker only when asked for */
  var picking=S.dtsPickOpen || S.dtsSchoolEdit;
  h+='<div class="dtsSchoolBar" id="dtsSchoolPick"><div class="dtsSchoolLine" id="dtsSchoolLine"><span class="dtsSchoolIc" aria-hidden="true">🏫</span><span class="dtsSchoolTxt"><b>'+esc(dtsSchoolName_(sch))+'</b>'+
    (dtsSchoolWhen_(sch) ? '<span class="rowSub">'+esc(dtsSchoolWhen_(sch))+'</span>' : '')+'</span>'+
    '<button class="btn small ghost" id="dtsSchoolChange" aria-expanded="'+(picking?'true':'false')+'">'+esc(picking ? t('Done') : t('Change'))+'</button></div>';
  if(picking){
    h+='<div class="dtsPicker">'+(years.length>1 ? '<div class="chips" id="dtsDbYears">'+years.map(function(y){ return '<button class="chip'+(y===yr?' on':'')+'" data-dtsdbyear="'+esc(y)+'">'+esc(y)+'</button>'; }).join('')+'</div>' : '')+
      '<div class="chips" id="dtsDbSchools">'+(db.schools||[]).filter(function(s){ return String(s.year)===yr; }).map(function(s){ return '<button class="chip'+(s.id===sch.id?' on':'')+'" data-dtsschool="'+esc(s.id)+'">'+esc(s.name)+'</button>'; }).join('')+'</div>'+
      (S.dtsSchoolEdit ? dtsSchoolFormHtml_(S.dtsSchoolEdit) :
        '<div class="dtsBtns"><button class="btn small ghost" id="dtsSchoolEditBtn">✏️ '+esc(gpT('Edit {school}',{school:sch.name}))+'</button><button class="btn small ghost" id="dtsSchoolAdd">＋ '+esc(t('New school'))+'</button></div>')+'</div>';
  }
  h+='</div>';
  var sec=S.dtsSec||'';
  if(!sec) return h+dtsHomeHtml_(d, sch)+dtsDueHtml_(d);
  var meta=DTS_SECS.filter(function(x){ return x[0]===sec; })[0]||DTS_SECS[0];
  h+='<div class="dtsPageHead"><button class="dtsBack" id="dtsHome">← '+esc(t('Back'))+'</button><h2 class="dtsPageTitle">'+meta[1]+' '+esc(t(meta[2]))+'</h2></div>';
  if(sec==='out') return h+dtsOutSecHtml_(d, sch);
  if(sec==='resp') return h+dtsRespHtml_(sch);
  if(sec==='res') return h+dtsResHtml_(sch);
  if(sec==='students') return h+(S.dtsStu ? dtsStuHtml_(dtsStudent_(S.dtsStu), sch) : dtsStudentsHtml_(d, sch));
  if(sec==='events') return h+dtsEventsHtml_(d, sch);
  if(sec==='fees') return h+dtsFeesHtml_(d, sch);
  if(sec==='policy') return h+dtsPolicyHtml_();
  return h+dtsSpeakersHtml_(d, sch);
}
/* one tile per part, each with the one line that says where it stands */
function dtsHomeHtml_(d, sch){
  var db=dtsDb_(), today=d.today||todayStr();
  var lects=dtsLectsIn_(sch), need=lects.filter(function(l){ return !l.speaker; }).length;
  var studs=dtsStudents_(), here=studs.filter(function(x){ return x.column==='arrived'; }).length;
  var evs=dtsIn_(db.events), next=evs.filter(function(e){ return (e.end||e.date)>=today; })[0];
  var teams=dtsIn_(db.teams), onTeam={}; teams.forEach(function(tm){ ['short','long'].forEach(function(k){ ((tm[k]||{}).students||[]).forEach(function(id){ onTeam[id]=1; }); }); });
  var free=studs.filter(function(x){ return !onTeam[x.id]; }).length;
  var resp=dtsIn_(db.resp), open=resp.filter(function(r){ return !r.done; }).length;
  var res=dtsIn_(db.resources).length;
  var rules=String(db.policy||'').split(/\r?\n/).filter(function(l){ return /^\s*\d+[.)]\s/.test(l); }).length;
  var line={
    speakers: !lects.length ? [t('No topics yet'), ''] : need ? [gpT('{n} need a speaker',{n:need}), 'warn'] : [gpT('{n} topics · every one has a speaker',{n:lects.length}), 'ok'],
    students: !studs.length ? [t('No applications yet'), ''] : [gpT('{n} students',{n:studs.length})+(here ? ' · '+gpT('{n} here now',{n:here}) : ''), ''],
    fees: (function(){ var f=dtsFees_(studs), n=f.A+f.B+f.C+f.unknown; return !n ? [t('Nobody accepted yet'), ''] : [gpT('{money} · {n} accepted',{money:dtsMoney_(f.total), n:n})+(f.unknown ? ' · '+gpT('{n} country not known',{n:f.unknown}) : ''), f.unknown ? 'warn' : '']; })(),
    events: next ? [gpT('Next: {what} · {when}',{what:next.title, when:fmtDayShort_(next.date)}), ''] : [t('Nothing coming up'), ''],
    out: !teams.length ? [t('No teams yet'), ''] : [gpT('{n} teams',{n:teams.length})+(free && studs.length ? ' · '+gpT('{n} not on a team yet',{n:free}) : ''), free && studs.length ? 'warn' : ''],
    resp: !resp.length ? [t('Nothing here yet.'), ''] : open ? [gpT('{n} still to do',{n:open}), 'warn'] : [t('All done'), 'ok'],
    res: [res ? gpT('{n} saved',{n:res}) : t('Nothing here yet.'), ''],
    policy: [gpT('{n} rules',{n:rules}), '']
  };
  return '<div class="dtsHome" id="dtsHome0">'+DTS_SECS.map(function(x){
    var l=line[x[0]]||['',''];
    return '<button class="dtsTile" data-dtssec="'+x[0]+'"><span class="dtsTileIc" aria-hidden="true">'+x[1]+'</span><span class="dtsTileTxt"><b>'+esc(t(x[2]))+'</b>'+
      '<span class="dtsTileLine'+(l[1]?' '+l[1]:'')+'">'+esc(l[0])+'</span></span><span class="dtsTileGo" aria-hidden="true">›</span></button>';
  }).join('')+'</div>';
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
function dtsSpeakersHtml_(d, sch){
  var list=dtsLectsIn_(sch), today=d.today||todayStr(), only=S.dtsNeed;
  var need=list.filter(function(l){ return !l.speaker; });
  var h='';
  if(S.dtsLect) h+=dtsLectFormHtml_(S.dtsLect);
  else h+='<button class="btn small dtsAdd" id="dtsLectAdd">＋ '+esc(t('Add a topic'))+'</button>';
  var rows=only ? need : list;
  h+='<div class="card" id="dtsSpeakers">'+(!list.length ? '' :
    '<div class="chips"><button class="chip'+(only?'':' on')+'" data-dtsneed="0">'+esc(gpT('All ({n})',{n:list.length}))+'</button><button class="chip'+(only?' on':'')+'" data-dtsneed="1">'+esc(gpT('Speaker needed ({n})',{n:need.length}))+'</button></div>');
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
  return h;
}
/* ---- Lecture fees (Nov 2026, Andrew: "for our finance team and the DTS team to get more clarity and
   collaboration in setting clear and accountable budget and finances"). The lecture phase is a fixed price
   by the country a student is from — A, B or C (the server's list, DTS_FEE_LIST in api.js) — and the total
   is every student accepted for this school, from the portal. Nothing to type; it moves as students are
   accepted. The Finances office sees the same on its dashboard (finDtsHtml_). ---- */
var DTS_FEE_COLS=['accepted','arrived','graduated'];
function dtsMoney_(n){ return '$'+Math.round(Number(n)||0).toLocaleString('en-US'); }
function dtsFeePrice_(cat){ var p=(S.dts && S.dts.fees) || {}; return Number(p[cat])||0; }
function dtsFees_(list){
  var f={ A:0, B:0, C:0, unknown:0, total:0, applying:0, ifAll:0 };
  (list||[]).forEach(function(x){
    var p=dtsFeePrice_(x.feeCat);
    if(DTS_FEE_COLS.indexOf(x.column)>-1){ if(x.feeCat) f[x.feeCat]++; else f.unknown++; f.total+=p; f.ifAll+=p; }
    else if(x.column==='applied' && !x.archived){ f.applying++; f.ifAll+=p; }
  });
  return f;
}
function dtsFeesHtml_(d, sch){
  var list=dtsStudents_(), f=dtsFees_(list), acc=list.filter(function(x){ return DTS_FEE_COLS.indexOf(x.column)>-1; });
  var n=f.A+f.B+f.C+f.unknown;
  var h='<div class="card" id="dtsFees"><h3 style="margin-top:0">💰 '+esc(gpT('Lecture phase — {school}',{school:dtsSchoolName_(sch)}))+'</h3>'+
    '<div class="dtsFeeTotal"><span class="dtsFeeBig" id="dtsFeeTotal">'+esc(dtsMoney_(f.total))+'</span><span class="sub">'+esc(gpT('{n} students accepted',{n:n}))+'</span></div>'+
    '<div class="dtsTblWrap"><table class="dtsFeeTbl" id="dtsFeeTbl"><thead><tr><th>'+esc(t('Category'))+'</th><th>'+esc(t('Students'))+'</th><th>'+esc(t('Price each'))+'</th><th>'+esc(t('Total'))+'</th></tr></thead><tbody>'+
    ['A','B','C'].map(function(c){ var p=dtsFeePrice_(c);
      return '<tr data-dtsfeecat="'+c+'"><td><span class="dtsCat cat'+c+'">'+c+'</span></td><td>'+f[c]+'</td><td>'+esc(dtsMoney_(p))+'</td><td><b>'+esc(dtsMoney_(f[c]*p))+'</b></td></tr>'; }).join('')+
    (f.unknown ? '<tr class="warn" data-dtsfeecat="unknown"><td>'+esc(t('Country not known'))+'</td><td>'+f.unknown+'</td><td>—</td><td>—</td></tr>' : '')+
    '</tbody><tfoot><tr><td>'+esc(t('Total'))+'</td><td>'+n+'</td><td></td><td><b>'+esc(dtsMoney_(f.total))+'</b></td></tr></tfoot></table></div>'+
    (f.applying ? '<p class="hint" style="margin:8px 0 0" id="dtsFeeIfAll">'+esc(gpT('{n} more have applied and are waiting. If they are all accepted: {money}.',{n:f.applying, money:dtsMoney_(f.ifAll)}))+'</p>' : '')+
    '<p class="hint" style="margin:8px 0 0">'+esc(t('Counted from the portal: every student accepted for this school — accepted, getting ready, here or graduated — at the price for the country they are from (A, B or C). It changes by itself as students are accepted. The Finances office sees the same on its dashboard.'))+'</p></div>';
  if(f.unknown) h+='<div class="card dtsFeeWarn" id="dtsFeeUnknown"><p class="sub" style="margin:0">⚠️ '+esc(t('These students’ country isn’t on the A/B/C list, so their fee isn’t counted yet. Fix the country on their record in the portal.'))+'</p>'+
    acc.filter(function(x){ return !x.feeCat; }).map(function(x){
      var row='<b>'+esc(x.name)+'</b><span class="rowSub">'+esc(x.country || t('No country given'))+'</span>';
      return d.portal ? '<a class="dtsFeeRow" href="portal.html?open='+encodeURIComponent(x.id)+'" target="_blank" rel="noopener">'+row+'</a>' : '<div class="dtsFeeRow">'+row+'</div>';
    }).join('')+'</div>';
  if(acc.length) h+='<div class="card" id="dtsFeeWho"><h3 style="margin-top:0">🎓 '+esc(t('Who is counted'))+'</h3>'+
    ['A','B','C'].filter(function(c){ return f[c]; }).map(function(c){
      return '<div class="dtsGroupH"><span class="dtsCat cat'+c+'">'+c+'</span> '+esc(f[c]+' × '+dtsMoney_(dtsFeePrice_(c)))+'</div>'+
        acc.filter(function(x){ return x.feeCat===c; }).map(function(x){
          return '<div class="dtsFeeRow" data-dtsfeestu="'+esc(x.id)+'"><b>'+esc(x.name)+'</b><span class="rowSub">'+esc([x.country || (x.audience==='khmer' ? 'Cambodia' : ''), t(DTS_COL_WORD[x.column]||x.column)].filter(Boolean).join(' · '))+'</span></div>'; }).join('');
    }).join('')+'</div>';
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
      var p=dtsStuVal_(x), oo=dtsOoName_(x);
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
/* a student's 1-on-1: GPDTS's own people to tap (its staff, anyone with it as another ministry, its
   leaders — Nov 2026: "only show the DTS staff"), or any name typed in ("and also be able to type in the name") */
function dtsTeamStaff_(){
  var min=(S.dts && S.dts.ministry)||'GPDTS', key='Leadership Development|'+min;
  return dtsStaff_().filter(function(r){
    return (r.dept==='Leadership Development' && r.ministry===min) || (r.ministries||[]).indexOf(key)>-1 || (r.leads||[]).indexOf(key)>-1;
  });
}
function dtsOoName_(x){ return x ? (x.oneOnOne ? dtsStaffName_(x.oneOnOne) : (x.oneOnOneName||'')) : ''; }
function dtsOoPickHtml_(x){
  var cur=dtsOoName_(x), team=dtsTeamStaff_();
  var h='<div class="dtsOneOnOne" id="dtsStuOO"><div class="dtsOoHead"><span class="f">🤝 '+esc(t('Their 1-on-1'))+'</span>'+
    (cur ? '<span class="dtsOoNow"><b>'+esc(cur)+'</b> <button class="linkbtn inline" id="dtsOoClear">'+esc(t('Remove'))+'</button></span>' : '<span class="hint">'+esc(t('No 1-on-1 yet'))+'</span>')+'</div>';
  h+= team.length ? '<div class="chips dtsOoChips">'+team.map(function(r){ return '<button class="chip'+(x.oneOnOne===r.id?' on':'')+'" data-dtsoo="'+esc(r.id)+'">'+esc(r.name)+'</button>'; }).join('')+'</div>'
    : '<p class="hint" style="margin:4px 0">'+esc(t('Nobody is on GPDTS in the app yet — type a name below.'))+'</p>';
  h+='<div class="dtsOoType"><input type="text" id="dtsStuOOName" maxlength="120" placeholder="'+esc(t('Someone else? Type their name'))+'" value="'+esc(S.dtsOoType||'')+'">'+
    '<button class="btn small" id="dtsStuOOSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(t('Save'))+'</button></div></div>';
  return h;
}
function dtsSexWord_(v){ v=String(v||'').toLowerCase(); return /female|ស្រី/.test(v) ? t('Female') : /male|ប្រុស/.test(v) ? t('Male') : ''; }
/* what the school has for a student: what the team typed, else what they wrote in the portal */
function dtsStuVal_(x){ var o={}, pr=(x && x.profile)||{}, po=(x && x.portal)||{}; ['sex','dob','phone','email','guardianName','guardianPhone','pastorName','pastorPhone','church','notes'].forEach(function(k){ o[k]=pr[k]||po[k]||''; }); return o; }
var DTS_STU_FIELDS=[['sex','Sex'],['dob','Date of birth'],['phone','Phone'],['email','Email'],['guardianName','Parent or guardian'],['guardianPhone','Parent or guardian’s phone'],['pastorName','Pastor'],['pastorPhone','Pastor’s phone'],['church','Church']];
function dtsTel_(v){ var d=String(v||'').replace(/[^\d+]/g,''); return d.length>=6 ? '<a href="tel:'+esc(d)+'">'+esc(v)+'</a>' : esc(v); }
function dtsStuHtml_(x, sch){
  var back='';   // the page's own ← Back goes back to the list
  if(!x) return '<div class="card">'+back+'</div>';
  var v=dtsStuVal_(x), ed=S.dtsStuEdit;
  var h='<div class="card" id="dtsStuCard">'+back+'<h2 style="margin:8px 0 2px">'+esc(x.name)+'</h2><p class="sub" style="margin:0 0 10px">'+
    esc([t(DTS_COL_WORD[x.column]||x.column), x.applied ? gpT('Applied {date}',{date:fmtDayShort_(x.applied)}) : '', x.audience==='khmer' ? t('Khmer') : (x.country||'')].filter(Boolean).join(' · '))+'</p>'+
    dtsOoPickHtml_(x);
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
  else h+='<button class="btn small dtsAdd" id="dtsEvAdd">＋ '+esc(t('Add an event'))+'</button>';
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
  return '<div class="card dtsPolicy" id="dtsPolicy"><p class="hint" style="margin:0 0 8px">'+esc(t('For every DTS on this campus.'))+'</p>'+
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
  var h='<button class="btn small dtsAdd" id="dtsTeamAdd">＋ '+esc(t('Add an outreach team'))+'</button>';
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
    /* folded to one line — where, when, how many students — until opened (Nov 2026: "less overwhelming") */
    var sum=[p.place, [fmtDayShort_(p.from), fmtDayShort_(p.to)].filter(Boolean).join(' – '), (p.students||[]).length ? gpT('{n} students',{n:(p.students||[]).length}) : ''].filter(Boolean).join(' · ') || t('not set yet');
    var h='<details class="dtsPhase" id="dtsPhase_'+k+'" data-dtfold="'+k+'"'+(dtsFoldOpen_(k)?' open':'')+'><summary><span class="dtsPhaseName">'+esc(t(label))+' <span class="hint">· '+esc(gpT('{n} weeks',{n:n}))+'</span></span><span class="rowSub">'+esc(sum)+'</span></summary><div class="dtsPhaseBody">'+
      '<label class="f">'+esc(t('Where'))+'</label><input type="text" data-dtp="'+k+'|place" maxlength="120" placeholder="'+esc(t('e.g. Mondulkiri'))+'" value="'+esc(p.place||'')+'">'+
      '<div class="dtsTwo"><div><label class="f">'+esc(t('From'))+'</label><input type="date" data-dtp="'+k+'|from" value="'+esc(p.from||'')+'"></div><div><label class="f">'+esc(t('To'))+'</label><input type="date" data-dtp="'+k+'|to" value="'+esc(p.to||'')+'"></div></div>'+
      '<label class="f">'+esc(t('Leaders'))+'</label>'+dtsPeopleChecks_('data-dtpl="'+k+'"', p.leaders, t('Pick the leaders'), 'pl_'+k)+
      '<input type="text" data-dtp="'+k+'|others" maxlength="200" placeholder="'+esc(t('Other leaders, not on staff (optional)'))+'" value="'+esc(p.others||'')+'" style="margin-top:6px">'+
      '<label class="f">'+esc(gpT('Students ({n})',{n:(p.students||[]).length}))+'</label>'+
      (studs.length ? '<details class="dtsPick" data-dtfold="ps_'+k+'"'+(dtsFoldOpen_('ps_'+k, !(p.students||[]).length)?' open':'')+'><summary>'+esc((p.students||[]).map(function(id){ var s=dtsStudent_(id); return s ? s.name : ''; }).filter(Boolean).join(', ') || t('Pick the students'))+'</summary><div class="dtsPickList">'+
        studs.map(function(x){ return '<label class="dtsPickRow"><input type="checkbox" data-dtps="'+k+'" value="'+esc(x.id)+'"'+((p.students||[]).indexOf(x.id)>-1?' checked':'')+'> '+esc(x.name)+(other[x.id] ? ' <span class="hint">· '+esc(gpT('on {team}',{team:other[x.id]}))+'</span>' : '')+'</label>'; }).join('')+'</div></details>'
        : '<p class="hint" style="margin:0">'+esc(t('No applications for this school yet.'))+'</p>')+
      (k==='long' ? '<button class="linkbtn inline" id="dtsCopyShort" style="margin-top:4px">'+esc(t('Same leaders and students as the short outreach'))+'</button>' : '')+
      '<details class="dtsWeeksFold" data-dtfold="w_'+k+'"'+(dtsFoldOpen_('w_'+k)?' open':'')+'><summary>📊 '+esc(t('Week by week'))+(dtsReachLine_(tot) ? ' <span class="hint">· '+esc(dtsReachLine_(tot))+'</span>' : '')+'</summary>'+
      '<div class="dtsTblWrap"><table class="dtsTbl dtsWeeks" id="dtsWeeks_'+k+'"><thead><tr><th>'+esc(t('Week'))+'</th>'+DTS_REACH.map(function(r){ return '<th>'+esc(t(r[1]))+'</th>'; }).join('')+'</tr></thead><tbody>';
    for(var i=0;i<n;i++){
      var w=(p.weeks||[])[i]||{}, wd=p.from ? fmtDayShort_(dtsAddDays_(p.from, 7*i)) : '';
      h+='<tr><th>'+esc(gpT('Week {n}',{n:i+1}))+(wd ? '<span class="rowSub">'+esc(wd)+'</span>' : '')+'</th>'+DTS_REACH.map(function(r){ return '<td><input type="number" min="0" inputmode="numeric" data-dtpw="'+k+'|'+i+'|'+r[0]+'" value="'+esc(w[r[0]] ? String(w[r[0]]) : '')+'" aria-label="'+esc(t(r[1])+' · '+gpT('Week {n}',{n:i+1}))+'"></td>'; }).join('')+'</tr>';
    }
    h+='</tbody><tfoot><tr><th>'+esc(t('Total'))+'</th>'+DTS_REACH.map(function(r){ return '<td>'+(tot[r[0]]||0)+'</td>'; }).join('')+'</tr></tfoot></table></div>'+
      (p.from ? '' : '<p class="hint" style="margin:4px 0 0">'+esc(t('Set the dates and these numbers count in GPDTS’s totals week by week.'))+'</p>')+'</details></div></details>';
    return h;
  };
  return '<div class="card" id="dtsTeamForm">'+
    '<label class="f" for="dt_name">'+esc(t('Team name'))+'</label><input type="text" id="dt_name" maxlength="80" placeholder="'+esc(t('e.g. Team Mondulkiri'))+'" value="'+esc(f.name||'')+'">'+
    phase('short','Short outreach')+phase('long','Long outreach')+
    '<label class="f" for="dt_notes">'+esc(t('Notes'))+'</label><textarea id="dt_notes" rows="2" maxlength="1000">'+esc(f.notes||'')+'</textarea>'+
    dtsFormBtns_('dtsTeam', f.id)+'</div>';
}
/* which folds of the team form are open: kept in the page, so a redraw (a tick, a date) leaves them be */
function dtsFoldOpen_(key, dflt){ var o=S.dtsTeamOpen||{}; return o[key]===undefined ? !!dflt : !!o[key]; }
function dtsNewPhase_(){ return { place:'', from:'', to:'', leaders:[], others:'', students:[], weeks:[] }; }
/* ---- Responsibilities: before school and in school, each given to staff ---- */
function dtsRespHtml_(sch){
  var list=dtsIn_(dtsDb_().resp), h='';
  if(S.dtsResp) return dtsRespFormHtml_(S.dtsResp);
  h+='<button class="btn small dtsAdd" id="dtsRespAdd">＋ '+esc(t('Add a responsibility'))+'</button>';
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
  h+='<button class="btn small dtsAdd" id="dtsResAdd">＋ '+esc(t('Add a resource'))+'</button>';
  h+='<div class="card" id="dtsResources">'+(list.length ? list.map(function(r){
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
  all('[data-dtsschool]', function(b){ S.dtsSchool=b.getAttribute('data-dtsschool'); S.dtsSchoolEdit=null; S.dtsPickOpen=false; dtsCloseForms_(); render(); });
  document.querySelectorAll('#dtsSchoolAdd').forEach(function(b){ b.onclick=function(){ var td=(S.dts.today||todayStr()), y=Number(td.slice(0,4))+(Number(td.slice(5,7))>=7?1:0); S.dtsSchoolEdit={ year:y, name:t('January DTS'), from:'', to:'' }; render(); var n=document.getElementById('ds_name'); if(n) n.focus(); }; });
  on('dtsSchoolEditBtn', function(){ var s=dtsCurSchool_(); if(s){ S.dtsSchoolEdit=Object.assign({}, s); render(); } });
  on('dtsSchoolCancel', function(){ S.dtsSchoolEdit=null; render(); });
  var keepSchool=function(){ document.querySelectorAll('[data-ds]').forEach(function(el){ S.dtsSchoolEdit[el.getAttribute('data-ds')]=el.value; }); };
  document.querySelectorAll('[data-ds]').forEach(function(el){ el.oninput=function(){ keepSchool(); }; });
  on('dtsSchoolSave', function(){ keepSchool(); var f=S.dtsSchoolEdit;
    if(!(Number(f.year)>=2000) || !String(f.name||'').trim()){ showMsg(t('Give the school a year and a name.')); return; }
    dtsDbSave_('school', f, t('Saved'), function(d){ S.dtsSchool=d.id; S.dtsDbYear=String(f.year); S.dtsSchoolEdit=null; S.dtsPickOpen=false; dtsRefresh_(); }); });
  on('dtsSchoolDel', function(){ var f=S.dtsSchoolEdit; if(!f || !confirm(gpT('Delete {school}?',{school:dtsSchoolName_(f)}))) return; dtsDbDel_('school', f.id, function(){ S.dtsSchoolEdit=null; S.dtsSchool=''; }); });
  all('[data-dtssec]', function(b){ S.dtsSec=b.getAttribute('data-dtssec'); S.dtsPickOpen=false; dtsCloseForms_(); render(); window.scrollTo(0,0); });
  /* one way back: out of whatever is open (a student, a team, a form), then to the tiles */
  on('dtsHome', function(){
    var open=S.dtsStu || S.dtsTeam || S.dtsLect || S.dtsEv || S.dtsResp || S.dtsRes || (S.dtsPol!==undefined && S.dtsPol!==null);
    if(!open) S.dtsSec='';
    dtsCloseForms_(); render(); window.scrollTo(0,0);
  });
  on('dtsSchoolChange', function(){ S.dtsPickOpen=!S.dtsPickOpen; S.dtsSchoolEdit=null; render(); });
  // the speaker schedule
  all('[data-dtsneed]', function(b){ S.dtsNeed=b.getAttribute('data-dtsneed')==='1'; render(); });
  document.querySelectorAll('tr[data-dtslect]').forEach(function(tr){ tr.onkeydown=function(e){ if(e.key==='Enter') tr.click(); }; });
  // students
  all('[data-dtsstuopen]', function(b){ S.dtsStu=b.getAttribute('data-dtsstuopen'); S.dtsStuEdit=null; S.dtsSec='students'; render(); window.scrollTo(0,0); });
  on('dtsStuEditBtn', function(){ var x=dtsStudent_(S.dtsStu); if(!x) return; S.dtsStuEdit=Object.assign({}, x.profile||{}); var v=dtsStuVal_(x); Object.keys(v).forEach(function(k){ if(!S.dtsStuEdit[k]) S.dtsStuEdit[k]=v[k]; }); render(); });
  on('dtsStuCancel', function(){ S.dtsStuEdit=null; render(); });
  document.querySelectorAll('[data-dsp]').forEach(function(el){ el.oninput=function(){ if(S.dtsStuEdit) S.dtsStuEdit[el.getAttribute('data-dsp')]=el.value; }; });
  on('dtsStuSave', function(){ var x=dtsStudent_(S.dtsStu), ed=S.dtsStuEdit; if(!x || !ed) return;
    /* only what differs from the portal is kept, so a later change there still shows */
    var pr={}; Object.keys(ed).forEach(function(k){ var v=String(ed[k]||'').trim(); if(v && v!==String((x.portal||{})[k]||'').trim()) pr[k]=v; });
    dtsStuSave_(x.id, { profile:pr }); });
  all('[data-dtsoo]', function(b){ var id=b.getAttribute('data-dtsoo'); S.dtsOoType=''; dtsStuSave_(S.dtsStu, { oneOnOne:id }, gpT('{name} is their 1-on-1',{name:dtsStaffName_(id)})); });
  on('dtsOoClear', function(){ S.dtsOoType=''; dtsStuSave_(S.dtsStu, { oneOnOne:'' }, t('Saved')); });
  var ooIn=document.getElementById('dtsStuOOName');
  var ooSave=function(){ var nm=String((ooIn && ooIn.value)||'').trim(); if(!nm){ showMsg(t('Type their name first.')); return; }
    /* a typed name that is one of the app's people is saved as that person */
    var hit=dtsStaff_().filter(function(r){ return String(r.name).trim().toLowerCase()===nm.toLowerCase(); })[0];
    S.dtsOoType=''; dtsStuSave_(S.dtsStu, hit ? { oneOnOne:hit.id } : { oneOnOneName:nm }, gpT('{name} is their 1-on-1',{name:hit ? hit.name : nm})); };
  if(ooIn){ ooIn.oninput=function(){ S.dtsOoType=ooIn.value; }; ooIn.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); ooSave(); } }; }
  on('dtsStuOOSave', ooSave);
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
  on('dtsTeamAdd', function(){ S.dtsTeamOpen={ short:true }; S.dtsTeam={ name:'', notes:'', schoolId:S.dtsSchool, short:dtsNewPhase_(), long:dtsNewPhase_() }; render(); window.scrollTo(0,0); var n=document.getElementById('dt_name'); if(n) n.focus(); });
  all('[data-dtsteam]', function(b){ var tm=dtsIn_(dtsDb_().teams).filter(function(x){ return x.id===b.getAttribute('data-dtsteam'); })[0]; if(!tm) return;
    S.dtsTeamOpen={}; S.dtsTeam=JSON.parse(JSON.stringify(tm)); ['short','long'].forEach(function(k){ S.dtsTeam[k]=Object.assign(dtsNewPhase_(), S.dtsTeam[k]||{}); }); render(); window.scrollTo(0,0); });
  on('dtsTeamCancel', function(){ S.dtsTeam=null; render(); });
  /* dates change how many weeks there are; ticks change the names in the fold — keep what's typed and draw again */
  document.querySelectorAll('[data-dtfold]').forEach(function(d){ d.ontoggle=function(){ (S.dtsTeamOpen=S.dtsTeamOpen||{})[d.getAttribute('data-dtfold')]=d.open; }; });
  document.querySelectorAll('[data-dtp$="|from"], [data-dtp$="|to"], [data-dtps], [data-dtpl]').forEach(function(el){ el.onchange=function(){ dtsKeepTeam_(); var y=window.scrollY; render(); window.scrollTo(0,y); }; });
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

/* ==================== Finances (Nov 2026, Andrew) ====================
   "For the lecture finances, we want to track the real income and real expenses … so that the dts staff and
   leaders can see how much they have left in their lecture budget." One school at a time, lecture and
   outreach kept apart ("separate and tracked separately"):
     Income    each gift entered by hand — the day, how it came in (cash, ABA, Subsplash), for one student
               (it lowers what they still owe) or the general DTS pool, and the amount in US$
     Expenses  (lecture) the day, a category, a memo of what it was for, who made it, the amount, "has a
               receipt already"; in the list a second tick, "receipt given to the office"
     Students  each student's lecture fee (their country's A/B/C price), what has come in for them, and what
               they still owe; outreach: what has come in for each
   The budget is the lecture fees of the students accepted (Lecture fees, above); what is left is the budget
   less what has been spent. Server: dtsFinSave / dtsFinDelete, blob dtsFin:<campus> (api.js). */
var DTS_FIN_METHODS=[['cash','Cash'],['aba','ABA'],['subsplash','Subsplash']];
var DTS_FIN_CATS=[['honorarium','Honorarium'],['supplies','Supplies'],['coffee','Coffee'],['food','Food / snacks'],['transport','Transport'],['other','Other']];
function dtsFinWord_(list, id){ var hit=list.filter(function(x){ return x[0]===id; })[0]; return hit ? t(hit[1]) : id; }
function dtsMoney2_(n){ n=Math.round((Number(n)||0)*100)/100; return '$'+n.toLocaleString('en-US',{ minimumFractionDigits:n%1?2:0, maximumFractionDigits:2 }); }
function dtsFinAll_(){ return (S.dts && S.dts.fin) || []; }
function dtsFinIn_(phase, kind){ var id=S.dtsSchool; return dtsFinAll_().filter(function(e){ return e.schoolId===id && e.phase===phase && (!kind || e.kind===kind); }); }
function dtsFinSum_(list){ return Math.round(list.reduce(function(a, e){ return a+(Number(e.amount)||0); }, 0)*100)/100; }
function dtsFinStuName_(id){ if(!id) return t('General DTS pool'); var x=dtsStudent_(id); return x ? x.name : t('A student no longer listed'); }
/* the money of the school on show, for the tab and the dashboard's card */
function dtsFinNums_(){
  var studs=dtsStudents_(), fees=dtsFees_(studs);
  var linc=dtsFinIn_('lecture','income'), lexp=dtsFinIn_('lecture','expense'), oinc=dtsFinIn_('outreach','income');
  var spent=dtsFinSum_(lexp);
  return { budget:fees.total, received:dtsFinSum_(linc), spent:spent, left:Math.round((fees.total-spent)*100)/100, inHand:Math.round((dtsFinSum_(linc)-spent)*100)/100,
    receiptsOut:lexp.filter(function(e){ return !e.toOffice; }).length, noReceipt:lexp.filter(function(e){ return !e.hasReceipt; }).length,
    oReceived:dtsFinSum_(oinc), oPool:dtsFinSum_(oinc.filter(function(e){ return !e.studentId; })) };
}
function dtsFinTile_(label, money, sub, cls){
  return '<div class="mmTile'+(cls?' '+cls:'')+'"><div class="mmTileName">'+esc(label)+'</div><div class="mmTileNum">'+esc(dtsMoney2_(money))+'</div>'+(sub ? '<div class="mmTileSub">'+esc(sub)+'</div>' : '')+'</div>';
}
/* the Dashboard's card, at the bottom (Andrew: "adding in a finance dashboard into the DTS dashboard … on the bottom") */
function dtsFinDashHtml_(){
  var sch=dtsCurSchool_(); if(!sch) return '';
  var n=dtsFinNums_();
  return '<div class="card" id="dtsFinDash"><h3 style="margin-top:0">💰 '+esc(gpT('Finances — {school}',{school:dtsSchoolName_(sch)}))+'</h3>'+
    '<div class="dtsFinLabel">'+esc(t('Lecture phase'))+'</div><div class="mmGrid">'+
    dtsFinTile_(t('Budget'), n.budget, t('the fees of the students accepted'))+dtsFinTile_(t('Received'), n.received)+dtsFinTile_(t('Spent'), n.spent)+
    dtsFinTile_(t('Left in the budget'), n.left, '', n.left<0 ? 'dtsFinNeg' : '')+'</div>'+
    '<div class="dtsFinLabel">'+esc(t('Outreach'))+'</div><div class="mmGrid">'+dtsFinTile_(t('Received'), n.oReceived)+'</div>'+
    (n.receiptsOut ? '<p class="hint" style="margin:8px 0 0">🧾 '+esc(gpT('{n} receipts not given to the office yet',{n:n.receiptsOut}))+'</p>' : '')+
    '<div class="dtsBtns"><button class="btn small ghost" data-mmtab="dtsfin">'+esc(t('Open Finances'))+' ›</button></div></div>';
}
function dtsFinHtml_(d){
  var db=dtsDb_(), sch=dtsCurSchool_();
  if(!sch) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Start with the school on the Database tab: its year and name, like 2027 · January DTS. Its money is kept under it.'))+'</p></div>';
  var phase=S.dtsFinPhase==='outreach' ? 'outreach' : 'lecture';
  var secs=phase==='lecture' ? [['overview','📊','Overview'],['income','💵','Income'],['expenses','🧾','Expenses'],['students','🎓','Students']] : [['overview','📊','Overview'],['income','💵','Income'],['students','🎓','Students']];
  var sec=secs.some(function(x){ return x[0]===S.dtsFinSec; }) ? S.dtsFinSec : 'overview';
  var h='';
  if((db.schools||[]).length>1) h+='<div class="chips" id="dtsFinSchools">'+db.schools.slice().reverse().map(function(s){ return '<button class="chip'+(s.id===sch.id?' on':'')+'" data-dtsfinschool="'+esc(s.id)+'">'+esc(dtsSchoolName_(s))+'</button>'; }).join('')+'</div>';
  else h+='<p class="sub" style="margin:0 0 8px">🏫 <b>'+esc(dtsSchoolName_(sch))+'</b></p>';
  h+='<div class="seg dtsFinPhase" id="dtsFinPhase" role="tablist">'+[['lecture','📖 '+t('Lecture phase')],['outreach','🌏 '+t('Outreach')]].map(function(x){
    return '<button class="'+(x[0]===phase?'on':'')+'" data-dtsfinphase="'+x[0]+'" role="tab" aria-selected="'+(x[0]===phase)+'">'+esc(x[1])+'</button>'; }).join('')+'</div>';
  var n=dtsFinNums_();
  if(phase==='lecture') h+='<div class="mmGrid" id="dtsFinTiles">'+dtsFinTile_(t('Left in the budget'), n.left, gpT('{money} in hand',{money:dtsMoney2_(n.inHand)}), n.left<0 ? 'dtsFinNeg' : '')+
    dtsFinTile_(t('Budget'), n.budget, t('the fees of the students accepted'))+dtsFinTile_(t('Received'), n.received)+dtsFinTile_(t('Spent'), n.spent)+'</div>';
  else h+='<div class="mmGrid" id="dtsFinTiles">'+dtsFinTile_(t('Received'), n.oReceived)+dtsFinTile_(t('For students'), n.oReceived-n.oPool)+dtsFinTile_(t('General DTS pool'), n.oPool)+'</div>';
  h+='<div class="chips" id="dtsFinSecs">'+secs.map(function(x){ return '<button class="chip'+(x[0]===sec?' on':'')+'" data-dtsfinsec="'+x[0]+'">'+x[1]+' '+esc(t(x[2]))+'</button>'; }).join('')+'</div>';
  if(sec==='expenses') return h+dtsFinExpHtml_(sch);
  if(sec==='students') return h+dtsFinStuHtml_(phase, sch);
  if(sec==='income') return h+dtsFinIncHtml_(phase, sch);
  return h+dtsFinOverviewHtml_(phase);
}
/* ---- Overview: the finance dashboard with the detail (Nov 2026, Andrew: "a general overview of the finance
   dashboard in the dashboard tab, but also a finance dashboard with more details on the lecture and outreach
   finances"). Lecture: how much of the budget is spent and collected, where the money came from and where it
   went, the receipts, and who still owes. Outreach: where its money came from and for whom. ---- */
function dtsMeter_(label, part, whole, id, over){
  var pct=whole>0 ? Math.round(part/whole*100) : 0, w=Math.max(0, Math.min(100, pct));
  return '<div class="dtsMeterRow"'+(id?' id="'+id+'"':'')+'><div class="dtsMeterTop"><span>'+esc(label)+'</span><b>'+esc(gpT('{a} of {b}',{a:dtsMoney2_(part), b:dtsMoney2_(whole)}))+(whole>0 ? ' · '+pct+'%' : '')+'</b></div>'+
    '<div class="dtsMeter'+(pct>100 && over ? ' over' : '')+'" role="img" aria-label="'+esc(label+': '+pct+'%')+'"><i style="width:'+w+'%"></i></div></div>';
}
function dtsFinBars_(rows, attr){
  var top=Math.max.apply(null, rows.map(function(r){ return r[1]; }).concat([0])) || 1;
  return rows.map(function(r){ return '<div class="dtsBarRow"'+(attr ? ' '+attr+'="'+esc(r[2]||r[0])+'"' : '')+'><span class="dtsBarName">'+esc(r[0])+'</span><span class="dtsBar"><i style="width:'+Math.round(r[1]/top*100)+'%"></i></span><b>'+esc(dtsMoney2_(r[1]))+'</b></div>'; }).join('');
}
function dtsFinOverviewHtml_(phase){
  var inc=dtsFinIn_(phase,'income'), received=dtsFinSum_(inc), pool=dtsFinSum_(inc.filter(function(e){ return !e.studentId; }));
  var byMethod=DTS_FIN_METHODS.map(function(m){ return [t(m[1]), dtsFinSum_(inc.filter(function(e){ return e.method===m[0]; })), m[0]]; });
  var src='<div class="card" id="dtsFinFrom"><h3 style="margin-top:0">💵 '+esc(t('Where the money came from'))+(received ? ' · '+esc(dtsMoney2_(received)) : '')+'</h3>';
  if(!inc.length) src+='<p class="sub" style="margin:0">'+esc(t('Nothing in yet.'))+'</p>';
  else src+=dtsFinBars_(byMethod, 'data-dtsfinmethod')+'<div class="dtsFinSplit">'+dtsFinBars_([[t('For students'), Math.round((received-pool)*100)/100, 'students'],[t('General DTS pool'), pool, 'pool']], 'data-dtsfinfor')+'</div>';
  src+='</div>';
  if(phase==='outreach'){
    var given={}; inc.forEach(function(e){ if(e.studentId) given[e.studentId]=(given[e.studentId]||0)+e.amount; });
    var ids=Object.keys(given).sort(function(a, b){ return given[b]-given[a]; });
    return src+'<div class="card" id="dtsFinOStu"><h3 style="margin-top:0">🎓 '+esc(t('Students'))+'</h3>'+
      (ids.length ? '<p class="sub" style="margin:0 0 6px">'+esc(gpT('{n} students have money in for outreach.',{n:ids.length}))+'</p>'+dtsFinBars_(ids.slice(0, 6).map(function(id){ return [dtsFinStuName_(id), Math.round(given[id]*100)/100, id]; })) :
        '<p class="sub" style="margin:0">'+esc(t('Nothing in for a student yet.'))+'</p>')+
      '<div class="dtsBtns"><button class="btn small ghost" data-dtsfinsec="students">'+esc(t('See every student'))+' ›</button></div></div>';
  }
  var n=dtsFinNums_(), exp=dtsFinIn_('lecture','expense');
  var h='<div class="card" id="dtsFinBudget"><h3 style="margin-top:0">📊 '+esc(t('The lecture budget'))+'</h3>'+
    dtsMeter_(t('Spent'), n.spent, n.budget, 'dtsFinSpentMeter', true)+dtsMeter_(t('Collected'), n.received, n.budget, 'dtsFinGotMeter')+
    '<div class="cafeLine"><span>'+esc(t('Left in the budget'))+'</span><b'+(n.left<0?' class="dtsNegTxt"':'')+'>'+esc(dtsMoney2_(n.left))+'</b></div>'+
    '<div class="cafeLine"><span>'+esc(t('In hand (received less spent)'))+'</span><b'+(n.inHand<0?' class="dtsNegTxt"':'')+'>'+esc(dtsMoney2_(n.inHand))+'</b></div>'+
    '<p class="hint" style="margin:6px 0 0">'+esc(t('The budget is the lecture fees of the students accepted for this school, at their country’s price.'))+'</p></div>';
  h+=src;
  var byCat=DTS_FIN_CATS.map(function(c){ return [t(c[1]), dtsFinSum_(exp.filter(function(e){ return e.category===c[0]; })), c[0]]; }).filter(function(r){ return r[1]; });
  h+='<div class="card" id="dtsFinWent"><h3 style="margin-top:0">🧾 '+esc(t('Where it went'))+(n.spent ? ' · '+esc(dtsMoney2_(n.spent)) : '')+'</h3>'+
    (exp.length ? dtsFinBars_(byCat, 'data-dtsfincat')+
      '<p class="hint" style="margin:8px 0 0" id="dtsFinReceipts">🧾 '+esc(gpT('{a} of {b} have a receipt · {c} given to the office',{a:exp.length-n.noReceipt, b:exp.length, c:exp.length-n.receiptsOut}))+'</p>' :
      '<p class="sub" style="margin:0">'+esc(t('Nothing spent yet.'))+'</p>')+'</div>';
  var rows=dtsFinStuRows_('lecture').filter(function(r){ return r.accepted; }), owing=rows.filter(function(r){ return r.owes>0; });
  var owed=Math.round(owing.reduce(function(a, r){ return a+r.owes; }, 0)*100)/100;
  h+='<div class="card" id="dtsFinOwing"><h3 style="margin-top:0">🎓 '+esc(t('Students'))+'</h3>'+
    (rows.length ? '<div class="mmGrid">'+
      '<div class="mmTile"><div class="mmTileName">'+esc(t('Paid in full'))+'</div><div class="mmTileNum">'+(rows.length-owing.length)+'</div><div class="mmTileSub">'+esc(gpT('of {n}',{n:rows.length}))+'</div></div>'+
      '<div class="mmTile"><div class="mmTileName">'+esc(t('Still owe'))+'</div><div class="mmTileNum">'+owing.length+'</div><div class="mmTileSub">'+esc(dtsMoney2_(owed))+'</div></div></div>'+
      (owing.length ? dtsFinBars_(owing.slice(0, 6).map(function(r){ return [r.name, r.owes, r.id]; })) : '') :
      '<p class="sub" style="margin:0">'+esc(t('No student accepted for this school yet.'))+'</p>')+
    '<div class="dtsBtns"><button class="btn small ghost" data-dtsfinsec="students">'+esc(t('See every student'))+' ›</button></div></div>';
  return h;
}
/* ---- income ---- */
function dtsFinIncFormHtml_(f, phase){
  var studs=dtsStudents_().filter(function(x){ return x.column!=='lead' && x.column!=='contacted'; });
  if(f.studentId && !studs.some(function(x){ return x.id===f.studentId; })){ var gone=dtsStudent_(f.studentId); if(gone) studs.push(gone); }
  return '<div class="card dtsForm" id="dtsFinIncForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the income') : t('Add income'))+'</h3>'+
    '<div class="dtsTwo"><div><label class="f" for="dfi_date">'+esc(t('Date'))+'</label><input type="date" id="dfi_date" data-dfi="date" value="'+esc(f.date||'')+'"></div>'+
    '<div><label class="f" for="dfi_amount">'+esc(t('Amount (US$)'))+'</label><input type="number" id="dfi_amount" data-dfi="amount" min="0" step="0.01" inputmode="decimal" value="'+esc(f.amount ? String(f.amount) : '')+'"></div></div>'+
    '<label class="f">'+esc(t('Came in through'))+'</label><div class="chips" id="dfi_method">'+DTS_FIN_METHODS.map(function(m){ return '<button type="button" class="chip'+(f.method===m[0]?' on':'')+'" data-dfimethod="'+m[0]+'">'+esc(t(m[1]))+'</button>'; }).join('')+'</div>'+
    '<label class="f" for="dfi_student">'+esc(t('Who it is for'))+'</label><select id="dfi_student" data-dfi="studentId"><option value="">'+esc(t('General DTS pool'))+'</option>'+
      studs.map(function(x){ return '<option value="'+esc(x.id)+'"'+(f.studentId===x.id?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+'</select>'+
    '<p class="hint" style="margin:4px 0 0">'+esc(phase==='lecture' ? t('Given for one student, it lowers what they still owe for the lecture phase.') : t('Given for one student, it shows against them under Students.'))+'</p>'+
    '<label class="f" for="dfi_note">'+esc(t('Note (optional)'))+'</label><input type="text" id="dfi_note" data-dfi="note" maxlength="300" placeholder="'+esc(t('e.g. from their home church'))+'" value="'+esc(f.note||'')+'">'+
    '<div class="dtsBtns"><button class="btn small" id="dtsFinSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsFinCancel">'+esc(t('Cancel'))+'</button>'+
    (f.id ? '<button class="linkbtn danger" id="dtsFinDel" style="width:auto">'+esc(t('Delete'))+'</button>' : '')+'</div></div>';
}
function dtsFinIncHtml_(phase, sch){
  var list=dtsFinIn_(phase,'income'), f=S.dtsFinForm;
  var h=(f && f.kind==='income') ? dtsFinIncFormHtml_(f, phase) : '<button class="btn small dtsAdd" id="dtsFinAddInc">＋ '+esc(t('Add income'))+'</button>';
  h+='<div class="card" id="dtsFinIncome"><h3 style="margin-top:0">💵 '+esc(t('Income'))+(list.length ? ' · '+esc(dtsMoney2_(dtsFinSum_(list))) : '')+'</h3>';
  if(!list.length) return h+'<p class="sub" style="margin:0">'+esc(t('Nothing in yet. Add each gift as it comes in — the day, how it came, who it is for and how much.'))+'</p></div>';
  var by={}; DTS_FIN_METHODS.forEach(function(m){ var s=dtsFinSum_(list.filter(function(e){ return e.method===m[0]; })); if(s) by[m[0]]=s; });
  h+='<p class="hint" style="margin:0 0 6px">'+DTS_FIN_METHODS.filter(function(m){ return by[m[0]]; }).map(function(m){ return esc(t(m[1]))+' '+esc(dtsMoney2_(by[m[0]])); }).join(' · ')+'</p>';
  return h+list.map(function(e){
    return '<button class="dtsFinRow" data-dtsfinedit="'+esc(e.id)+'"><span class="dtsFinWhen">'+esc(fmtDayShort_(e.date))+'</span><span class="dtsFinTxt"><b>'+esc(dtsFinStuName_(e.studentId))+'</b>'+
      '<span class="rowSub">'+esc([dtsFinWord_(DTS_FIN_METHODS, e.method), e.note].filter(Boolean).join(' · '))+'</span></span><span class="dtsFinAmt">'+esc(dtsMoney2_(e.amount))+'</span></button>';
  }).join('')+'</div>';
}
/* ---- expenses (lecture) ---- */
function dtsFinExpFormHtml_(f){
  return '<div class="card dtsForm" id="dtsFinExpForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the expense') : t('Add an expense'))+'</h3>'+
    '<div class="dtsTwo"><div><label class="f" for="dfe_date">'+esc(t('Date'))+'</label><input type="date" id="dfe_date" data-dfe="date" value="'+esc(f.date||'')+'"></div>'+
    '<div><label class="f" for="dfe_amount">'+esc(t('Amount (US$)'))+'</label><input type="number" id="dfe_amount" data-dfe="amount" min="0" step="0.01" inputmode="decimal" value="'+esc(f.amount ? String(f.amount) : '')+'"></div></div>'+
    '<label class="f">'+esc(t('Category'))+'</label><div class="chips" id="dfe_cat">'+DTS_FIN_CATS.map(function(c){ return '<button type="button" class="chip'+(f.category===c[0]?' on':'')+'" data-dfecat="'+c[0]+'">'+esc(t(c[1]))+'</button>'; }).join('')+'</div>'+
    '<label class="f" for="dfe_memo">'+esc(t('What it was for'))+'</label><input type="text" id="dfe_memo" data-dfe="memo" maxlength="300" placeholder="'+esc(t('e.g. Honorarium for the week 3 speaker'))+'" value="'+esc(f.memo||'')+'">'+
    '<label class="f" for="dfe_who">'+esc(t('Who made it'))+'</label>'+dtsStaffSelectHtml_('dfe_who', f.who, 'data-dfe="who"')+
    '<label class="dtsConf"><input type="checkbox" id="dfe_receipt"'+(f.hasReceipt?' checked':'')+'> 🧾 '+esc(t('Has receipt already'))+'</label>'+
    '<div class="dtsBtns"><button class="btn small" id="dtsFinSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsFinCancel">'+esc(t('Cancel'))+'</button>'+
    (f.id ? '<button class="linkbtn danger" id="dtsFinDel" style="width:auto">'+esc(t('Delete'))+'</button>' : '')+'</div></div>';
}
function dtsFinExpHtml_(sch){
  var list=dtsFinIn_('lecture','expense'), f=S.dtsFinForm, n=dtsFinNums_();
  var h=(f && f.kind==='expense') ? dtsFinExpFormHtml_(f) : '<button class="btn small dtsAdd" id="dtsFinAddExp">＋ '+esc(t('Add an expense'))+'</button>';
  h+='<div class="card" id="dtsFinExpenses"><h3 style="margin-top:0">🧾 '+esc(t('Expenses'))+(list.length ? ' · '+esc(dtsMoney2_(dtsFinSum_(list))) : '')+'</h3>';
  if(!list.length) return h+'<p class="sub" style="margin:0">'+esc(t('Nothing spent yet. Add each expense — the day, what kind, what it was for, who made it and how much.'))+'</p></div>';
  h+='<div class="dtsFinCats">'+DTS_FIN_CATS.map(function(c){ var s=dtsFinSum_(list.filter(function(e){ return e.category===c[0]; })); return s ? '<span>'+esc(t(c[1]))+' <b>'+esc(dtsMoney2_(s))+'</b></span>' : ''; }).join('')+'</div>';
  if(n.receiptsOut) h+='<p class="hint" style="margin:6px 0 0" id="dtsFinReceiptsOut">🧾 '+esc(gpT('{n} receipts not given to the office yet',{n:n.receiptsOut}))+(n.noReceipt ? ' · '+esc(gpT('{n} with no receipt',{n:n.noReceipt})) : '')+'</p>';
  h+='<div class="dtsTblWrap"><table class="dtsTbl dtsFinTbl" id="dtsFinExpTbl"><thead><tr><th>'+esc(t('Date'))+'</th><th>'+esc(t('What'))+'</th><th>'+esc(t('Amount'))+'</th><th>'+esc(t('Has receipt'))+'</th><th>'+esc(t('Receipt given to the office'))+'</th></tr></thead><tbody>'+
    list.map(function(e){
      var who=e.who ? dtsStaffName_(e.who) : (e.whoName||'');
      return '<tr data-dtsfinexp="'+esc(e.id)+'"><td data-l="'+esc(t('Date'))+'" class="dtsWhen">'+esc(fmtDayShort_(e.date))+'</td>'+
        '<td data-l="'+esc(t('What'))+'"><button class="dtsFinOpen" data-dtsfinedit="'+esc(e.id)+'"><b>'+esc(e.memo)+'</b><span class="rowSub">'+esc([dtsFinWord_(DTS_FIN_CATS, e.category), who].filter(Boolean).join(' · '))+'</span></button></td>'+
        '<td data-l="'+esc(t('Amount'))+'" class="dtsFinAmt">'+esc(dtsMoney2_(e.amount))+'</td>'+
        '<td data-l="'+esc(t('Has receipt'))+'"><label class="dtsFinTick" data-l="'+esc(t('Has receipt'))+'"><input type="checkbox" data-dtsfintick="'+esc(e.id)+'|hasReceipt"'+(e.hasReceipt?' checked':'')+' aria-label="'+esc(t('Has receipt'))+'"></label></td>'+
        '<td data-l="'+esc(t('Receipt given to the office'))+'"><label class="dtsFinTick" data-l="'+esc(t('Receipt given to the office'))+'"><input type="checkbox" data-dtsfintick="'+esc(e.id)+'|toOffice"'+(e.toOffice?' checked':'')+' aria-label="'+esc(t('Receipt given to the office'))+'"></label></td></tr>';
    }).join('')+'</tbody></table></div>'+
    '<div class="dtsBtns"><button class="btn small ghost" id="dtsFinCsvExp">⬇ '+esc(t('Download (CSV)'))+'</button></div></div>';
  return h;
}
/* ---- students: each one's fee, what came in for them, what they still owe ---- */
function dtsFinStuRows_(phase){
  var inc=dtsFinIn_(phase,'income'), paid={};
  inc.forEach(function(e){ if(e.studentId) paid[e.studentId]=(paid[e.studentId]||0)+(Number(e.amount)||0); });
  var studs=dtsStudents_().filter(function(x){ return DTS_FEE_COLS.indexOf(x.column)>-1 || paid[x.id]; });
  Object.keys(paid).forEach(function(id){ if(!studs.some(function(x){ return x.id===id; })){ var x=dtsStudent_(id); studs.push(x || { id:id, name:t('A student no longer listed'), column:'' }); } });
  return studs.map(function(x){
    var fee=phase==='lecture' && DTS_FEE_COLS.indexOf(x.column)>-1 ? dtsFeePrice_(x.feeCat) : 0, p=Math.round((paid[x.id]||0)*100)/100;
    return { id:x.id, name:x.name, cat:x.feeCat||'', country:x.country||'', fee:fee, paid:p, owes:Math.max(0, Math.round((fee-p)*100)/100), accepted:DTS_FEE_COLS.indexOf(x.column)>-1 };
  }).sort(function(a, b){ return b.owes-a.owes || a.name.localeCompare(b.name); });
}
function dtsFinStuHtml_(phase, sch){
  var rows=dtsFinStuRows_(phase), pool=dtsFinSum_(dtsFinIn_(phase,'income').filter(function(e){ return !e.studentId; }));
  var h='<div class="card" id="dtsFinStudents"><h3 style="margin-top:0">🎓 '+esc(phase==='lecture' ? t('Each student’s lecture fee') : t('What came in for each student'))+'</h3>';
  if(!rows.length) return h+'<p class="sub" style="margin:0">'+esc(t('No student accepted for this school yet.'))+'</p>'+(pool ? '<p class="hint" style="margin:6px 0 0">'+esc(gpT('General DTS pool: {money}',{money:dtsMoney2_(pool)}))+'</p>' : '')+'</div>';
  var tot={ fee:0, paid:0, owes:0 }; rows.forEach(function(r){ tot.fee+=r.fee; tot.paid+=r.paid; tot.owes+=r.owes; });
  if(phase==='lecture'){
    h+='<p class="hint" style="margin:0 0 6px">'+esc(t('The fee is the lecture price for their country (A, B or C). What came in for them comes off it.'))+'</p>'+
      '<div class="dtsTblWrap"><table class="dtsFeeTbl" id="dtsFinStuTbl"><thead><tr><th>'+esc(t('Student'))+'</th><th>'+esc(t('Fee'))+'</th><th>'+esc(t('Paid'))+'</th><th>'+esc(t('Still owes'))+'</th></tr></thead><tbody>'+
      rows.map(function(r){ return '<tr data-dtsfinstu="'+esc(r.id)+'"><td><b>'+esc(r.name)+'</b> '+(r.cat ? '<span class="dtsCat cat'+r.cat+'">'+r.cat+'</span>' : (r.accepted ? '<span class="hint" style="margin:0">'+esc(t('Country not known'))+'</span>' : ''))+'</td>'+
        '<td>'+esc(r.accepted ? dtsMoney2_(r.fee) : '—')+'</td><td>'+esc(dtsMoney2_(r.paid))+'</td><td>'+(r.owes ? '<b>'+esc(dtsMoney2_(r.owes))+'</b>' : (r.accepted && r.fee ? '✅ '+esc(t('Paid')) : '—'))+'</td></tr>'; }).join('')+
      '</tbody><tfoot><tr><td>'+esc(t('Total'))+'</td><td>'+esc(dtsMoney2_(tot.fee))+'</td><td>'+esc(dtsMoney2_(tot.paid))+'</td><td>'+esc(dtsMoney2_(tot.owes))+'</td></tr></tfoot></table></div>';
  } else {
    h+='<div class="dtsTblWrap"><table class="dtsFeeTbl" id="dtsFinStuTbl"><thead><tr><th>'+esc(t('Student'))+'</th><th>'+esc(t('Came in'))+'</th></tr></thead><tbody>'+
      rows.map(function(r){ return '<tr data-dtsfinstu="'+esc(r.id)+'"><td><b>'+esc(r.name)+'</b></td><td>'+esc(dtsMoney2_(r.paid))+'</td></tr>'; }).join('')+
      '</tbody><tfoot><tr><td>'+esc(t('Total'))+'</td><td>'+esc(dtsMoney2_(tot.paid))+'</td></tr></tfoot></table></div>';
  }
  h+='<p class="hint" style="margin:8px 0 0" id="dtsFinPool">'+esc(gpT('General DTS pool: {money}',{money:dtsMoney2_(pool)}))+' — '+esc(t('given to the school, not to one student.'))+'</p>';
  return h+'<div class="dtsBtns"><button class="btn small ghost" id="dtsFinCsvStu">⬇ '+esc(t('Download (CSV)'))+'</button></div></div>';
}
function dtsFinCsv_(name, head, rows){
  var q=function(v){ v=String(v==null?'':v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  var blob=new Blob(['﻿'+[head].concat(rows).map(function(r){ return r.map(q).join(','); }).join('\r\n')], { type:'text/csv;charset=utf-8' });
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name.replace(/[^\w\- ]+/g,'').trim()+'.csv';
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function dtsFinPut_(d, msg){
  S.dtsBusy=false;
  if(d && d.ok){ S.dts.fin=d.fin||[]; S.dtsFinForm=null; if(msg) showMsg(msg); return true; }
  var err=d && d.err;
  showMsg(err==='bad_amount' ? t('Put in the amount in US$.') : err==='bad_date' ? t('Pick the day first.') : err==='bad_method' ? t('Say how it came in: cash, ABA or Subsplash.') :
    err==='bad_category' ? t('Pick a category.') : err==='no_memo' ? t('Write what it was for.') : t('Could not save'));
  return false;
}
function dtsFinKeep_(){
  var f=S.dtsFinForm; if(!f) return;
  document.querySelectorAll('[data-dfi],[data-dfe]').forEach(function(el){ var k=el.getAttribute('data-dfi')||el.getAttribute('data-dfe'); f[k]=el.value; });
  var rc=document.getElementById('dfe_receipt'); if(rc) f.hasReceipt=rc.checked;
}
function bindDtsFin_(){
  var d=S.dts; if(!d) return;
  var all=function(sel, fn){ document.querySelectorAll(sel).forEach(function(b){ b.onclick=function(e){ gpTap(); fn(b, e); }; }); };
  all('[data-dtsfinschool]', function(b){ S.dtsSchool=b.getAttribute('data-dtsfinschool'); S.dtsFinForm=null; render(); });
  all('[data-dtsfinphase]', function(b){ S.dtsFinPhase=b.getAttribute('data-dtsfinphase'); S.dtsFinForm=null; render(); });
  all('[data-dtsfinsec]', function(b){ S.dtsFinSec=b.getAttribute('data-dtsfinsec'); S.dtsFinForm=null; render(); });
  var phase=S.dtsFinPhase==='outreach' ? 'outreach' : 'lecture';
  var ai=document.getElementById('dtsFinAddInc'); if(ai) ai.onclick=function(){ gpTap(); S.dtsFinForm={ kind:'income', phase:phase, date:d.today||todayStr(), method:'', studentId:'', amount:'', note:'' }; render(); };
  var ae=document.getElementById('dtsFinAddExp'); if(ae) ae.onclick=function(){ gpTap(); S.dtsFinForm={ kind:'expense', phase:'lecture', date:d.today||todayStr(), category:'', memo:'', who:(S.me && S.me.id)||'', amount:'', hasReceipt:false }; render(); };
  all('[data-dtsfinedit]', function(b){ var e=dtsFinAll_().filter(function(x){ return x.id===b.getAttribute('data-dtsfinedit'); })[0]; if(e){ S.dtsFinForm=Object.assign({}, e); render(); window.scrollTo(0,0); } });
  all('[data-dfimethod]', function(b){ dtsFinKeep_(); S.dtsFinForm.method=b.getAttribute('data-dfimethod'); render(); });
  all('[data-dfecat]', function(b){ dtsFinKeep_(); S.dtsFinForm.category=b.getAttribute('data-dfecat'); render(); });
  document.querySelectorAll('[data-dfi],[data-dfe]').forEach(function(el){ el.oninput=el.onchange=dtsFinKeep_; });
  var rc=document.getElementById('dfe_receipt'); if(rc) rc.onchange=dtsFinKeep_;
  var cc=document.getElementById('dtsFinCancel'); if(cc) cc.onclick=function(){ S.dtsFinForm=null; render(); };
  var sv=document.getElementById('dtsFinSave');
  if(sv) sv.onclick=function(){
    dtsFinKeep_(); var f=S.dtsFinForm; if(!f || S.dtsBusy) return;
    if(!(Number(f.amount)>0)){ showMsg(t('Put in the amount in US$.')); return; }
    if(f.kind==='income' && !f.method){ showMsg(t('Say how it came in: cash, ABA or Subsplash.')); return; }
    if(f.kind==='expense' && !f.category){ showMsg(t('Pick a category.')); return; }
    if(f.kind==='expense' && !String(f.memo||'').trim()){ showMsg(t('Write what it was for.')); return; }
    var rec=Object.assign({}, f, { schoolId:S.dtsSchool, amount:Number(f.amount) });
    S.dtsBusy=true; render();
    run('dtsFinSave',[S.auth.user,S.auth.pin,rec],function(r){ dtsFinPut_(r, t('Saved')); render(); }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
  };
  var dl=document.getElementById('dtsFinDel');
  if(dl) dl.onclick=function(){
    var f=S.dtsFinForm; if(!f || !f.id || !confirm(t('Delete this entry?'))) return;
    S.dtsBusy=true; render();
    run('dtsFinDelete',[S.auth.user,S.auth.pin,f.id],function(r){ dtsFinPut_(r, t('Deleted')); render(); }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
  };
  /* the two ticks in the list save on the spot */
  document.querySelectorAll('[data-dtsfintick]').forEach(function(cb){
    cb.onchange=function(){
      var p=cb.getAttribute('data-dtsfintick').split('|'), e=dtsFinAll_().filter(function(x){ return x.id===p[0]; })[0]; if(!e) return;
      var rec=Object.assign({}, e); rec[p[1]]=cb.checked; e[p[1]]=cb.checked;
      run('dtsFinSave',[S.auth.user,S.auth.pin,rec],function(r){ if(!dtsFinPut_(r)){ e[p[1]]=!cb.checked; } render(); }, function(){ e[p[1]]=!cb.checked; showMsg(t('Connection problem — try again.')); render(); });
    };
  });
  var sch=dtsCurSchool_(), nm=sch ? dtsSchoolName_(sch) : 'DTS';
  var ce=document.getElementById('dtsFinCsvExp');
  if(ce) ce.onclick=function(){ dtsFinCsv_(nm+' - lecture expenses', ['Date','Category','What it was for','Who made it','Amount (US$)','Has receipt','Receipt given to the office'],
    dtsFinIn_('lecture','expense').map(function(e){ return [e.date, dtsFinWord_(DTS_FIN_CATS, e.category), e.memo, e.who ? dtsStaffName_(e.who) : (e.whoName||''), e.amount, e.hasReceipt?'yes':'no', e.toOffice?'yes':'no']; })); };
  var cs=document.getElementById('dtsFinCsvStu');
  if(cs) cs.onclick=function(){
    var rows=dtsFinStuRows_(phase);
    if(phase==='lecture') dtsFinCsv_(nm+' - lecture fees by student', ['Student','Country','Category','Fee (US$)','Paid (US$)','Still owes (US$)'], rows.map(function(r){ return [r.name, r.country, r.cat, r.fee, r.paid, r.owes]; }));
    else dtsFinCsv_(nm+' - outreach income by student', ['Student','Came in (US$)'], rows.map(function(r){ return [r.name, r.paid]; }));
  };
}
