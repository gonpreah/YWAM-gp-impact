/* ==================== GPDTS on My Ministry (Nov 2026, Andrew) ====================
   "Instead of manually inputting numbers, I would like it to automatically track them." The DTS
   pipeline lives in the portal — DTS applications, and the people the team reaches out to and
   follows up there (＋ Add a contact, Contacts, next steps). This page is the school's home:
     Dashboard    where everyone is (reaching out → contacted → applied → accepted → here →
                  graduated, Khmer and international), the follow-ups due, and the year's numbers
     This school  the students who are here: mark graduated (with the day) and potential staff, and move
                  a graduate who is potential staff into the staff pipeline (dtsToStaff)
     Lectures     each week's topic and speaker, and what God did (heard the gospel, healings, salvations,
                  baptisms); the budget comes later
     Outreach     each team: where, when, who leads, and its reports with the same four numbers
   then Tasks and OKRs. No Numbers tab (Nov 2026, Andrew: the school runs January–June, and every number
   now counts itself — the students from the portal, the fruit from Lectures and Outreach). The Dashboard
   shows the year's numbers, and past years typed in by hand (dtsSavePast).
   Server: dtsBoard / dtsMark / dtsToStaff / dtsSaveLecture / dtsSaveOutreach / dtsSavePast (api.js,
   "GPDTS"). Siem Reap's GPDTS only for now (DTS_TOOL in api.js). */
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
  if(cur==='dtsout') return dtsOutHtml_(d);
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
      '<button class="dtsStaff'+(x.potentialStaff?' on':'')+'" data-dtsstaff="'+esc(x.id)+'" aria-pressed="'+!!x.potentialStaff+'" title="'+esc(t('Potential staff'))+'">⭐ <span>'+esc(t('Potential staff'))+'</span></button>'+
      dtsPipeLine_(x)+'</div>';
  }).join('')+'</div>';
  return h;
}
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
  return '<div class="card" id="dtsLectForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the lecture') : t('Add a lecture'))+'</h3>'+
    '<div class="dtsTwo"><div><label class="f" for="dl_date">'+esc(t('From'))+'</label><input type="date" id="dl_date" data-dl="date" value="'+esc(f.date||'')+'"></div>'+
    '<div><label class="f" for="dl_end">'+esc(t('To (optional)'))+'</label><input type="date" id="dl_end" data-dl="end" value="'+esc(f.end||'')+'"></div></div>'+
    '<label class="f" for="dl_topic">'+esc(t('Topic'))+'</label><input type="text" id="dl_topic" data-dl="topic" maxlength="160" placeholder="'+esc(t('e.g. The Father heart of God'))+'" value="'+esc(f.topic||'')+'">'+
    '<label class="f" for="dl_speaker">'+esc(t('Speaker'))+'</label><input type="text" id="dl_speaker" data-dl="speaker" maxlength="120" value="'+esc(f.speaker||'')+'">'+
    '<label class="f" for="dl_from">'+esc(t('Where they are from'))+'</label><input type="text" id="dl_from" data-dl="from" maxlength="160" placeholder="'+esc(t('e.g. YWAM Phnom Penh, a church in Battambang'))+'" value="'+esc(f.from||'')+'">'+
    '<label class="f" for="dl_contact">'+esc(t('How to reach them'))+'</label><input type="text" id="dl_contact" data-dl="contact" maxlength="160" placeholder="'+esc(t('Phone, email or Telegram'))+'" value="'+esc(f.contact||'')+'">'+
    '<label class="dtsConf"><input type="checkbox" id="dl_confirmed"'+(f.confirmed?' checked':'')+'> '+esc(t('Confirmed — they are coming'))+'</label>'+
    '<label class="f" for="dl_notes">'+esc(t('Notes'))+'</label><textarea id="dl_notes" data-dl="notes" rows="3" maxlength="2000" placeholder="'+esc(t('Travel, where they stay, what they need…'))+'">'+esc(f.notes||'')+'</textarea>'+
    '<label class="f">'+esc(t('What God did (after the week)'))+'</label>'+dtsFruitInputs_('data-dlf', f.fruit||{})+
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
      '<span class="dtsLectState">'+(x.confirmed ? '✅ '+esc(t('Confirmed')) : '⏳ '+esc(t('Not confirmed')))+(dtsFruitLine_(x.fruit) ? ' · '+esc(dtsFruitLine_(x.fruit)) : '')+'</span></button>';
  };
  h+='<div class="card" id="dtsLectList"><h3 style="margin-top:0">🎤 '+esc(t('Coming up'))+'</h3>'+(up.length ? up.map(row).join('') : '<p class="sub" style="margin:0">'+esc(t('No lectures planned yet.'))+'</p>')+
    (past.length ? '<details class="dtsPast"'+(S.dtsShowPast?' open':'')+'><summary id="dtsPastToggle">'+esc(gpT('Earlier ({n})',{n:past.length}))+'</summary>'+past.map(row).join('')+'</details>' : '')+'</div>';
  h+='<div class="card dtsSoon" id="dtsBudget"><h3 style="margin-top:0">💰 '+esc(t('Finance & budget'))+'</h3><p class="sub" style="margin:0">'+esc(t('Coming soon: the school’s budget — speakers’ gifts and travel, food, outreach — beside what has been spent.'))+'</p></div>';
  return h;
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
/* ---- Outreach: each team, where and when, who leads it, and its reports ---- */
function dtsOutFormHtml_(f){
  var reps=f.reports||[];
  return '<div class="card" id="dtsOutForm"><h3 style="margin-top:0">'+esc(f.id ? t('Edit the outreach') : t('Add an outreach'))+'</h3>'+
    '<label class="f" for="do_place">'+esc(t('Where'))+'</label><input type="text" id="do_place" data-do="place" maxlength="120" placeholder="'+esc(t('e.g. Mondulkiri, Thailand'))+'" value="'+esc(f.place||'')+'">'+
    '<div class="dtsTwo"><div><label class="f" for="do_from">'+esc(t('From'))+'</label><input type="date" id="do_from" data-do="from" value="'+esc(f.from||'')+'"></div>'+
    '<div><label class="f" for="do_to">'+esc(t('To'))+'</label><input type="date" id="do_to" data-do="to" value="'+esc(f.to||'')+'"></div></div>'+
    '<div class="dtsTwo"><div><label class="f" for="do_leaders">'+esc(t('Who leads it'))+'</label><input type="text" id="do_leaders" data-do="leaders" maxlength="200" value="'+esc(f.leaders||'')+'"></div>'+
    '<div><label class="f" for="do_size">'+esc(t('People on the team'))+'</label><input type="number" min="0" id="do_size" data-do="size" value="'+esc(f.size ? String(f.size) : '')+'"></div></div>'+
    '<label class="f" for="do_notes">'+esc(t('Notes'))+'</label><textarea id="do_notes" data-do="notes" rows="2" maxlength="2000">'+esc(f.notes||'')+'</textarea>'+
    '<div class="dtsGroupH">🙏 '+esc(t('Reports — what God did'))+'</div>'+
    (reps.length ? reps.map(function(r, i){
      return '<div class="dtsRep" data-dorrow="'+i+'"><div class="dtsTwo"><div><label class="f">'+esc(t('Day'))+'</label><input type="date" data-dor="'+i+'|date" value="'+esc(r.date||'')+'"></div>'+
        '<div style="text-align:right"><button class="linkbtn danger" data-dorrm="'+i+'" style="width:auto">✕ '+esc(t('Remove'))+'</button></div></div>'+
        dtsFruitInputs_('data-dor', r.fruit||{}, i+'|')+
        '<input type="text" data-dor="'+i+'|note" maxlength="500" placeholder="'+esc(t('A line about it (optional)'))+'" value="'+esc(r.note||'')+'"></div>';
    }).join('') : '<p class="hint" style="margin:0 0 6px">'+esc(t('No reports yet. Add one for each week, or each time the team sends its numbers.'))+'</p>')+
    '<button class="btn small ghost" id="dtsOutAddRep" style="margin-top:6px">＋ '+esc(t('Add a report'))+'</button>'+
    '<div class="dtsBtns"><button class="btn small" id="dtsOutSave"'+(S.dtsBusy?' disabled':'')+'>'+esc(S.dtsBusy ? t('Saving…') : t('Save'))+'</button><button class="btn ghost small" id="dtsOutCancel">'+esc(t('Cancel'))+'</button>'+
    (f.id ? '<button class="linkbtn danger" id="dtsOutDel" style="width:auto">'+esc(t('Delete'))+'</button>' : '')+'</div></div>';
}
function dtsOutHtml_(d){
  var list=d.outreaches||[], h='';
  if(S.dtsOut) h+=dtsOutFormHtml_(S.dtsOut);
  else h+='<button class="btn" id="dtsOutAdd" style="margin-top:0">＋ '+esc(t('Add an outreach'))+'</button>';
  h+='<div class="card" id="dtsOutList"><h3 style="margin-top:0">🌏 '+esc(t('Outreach'))+'</h3>';
  if(!list.length) h+='<p class="sub" style="margin:0">'+esc(t('No outreach yet. Add each team the school sends — where, when and who leads it — and the numbers as they come in.'))+'</p>';
  h+=list.map(function(o){
    var when=[fmtDayShort_(o.from), fmtDayShort_(o.to)].filter(Boolean).join(' – '), sum=dtsFruitLine_(dtsFruitSum_(o.reports));
    return '<div class="dtsOut" data-dtsoutcard="'+esc(o.id)+'"><div class="dtsOutText"><b>'+esc(o.place)+'</b><span class="rowSub">'+esc([when, o.leaders ? gpT('Led by {name}',{name:o.leaders}) : '', o.size ? gpT('{n} people',{n:o.size}) : ''].filter(Boolean).join(' · '))+'</span>'+
      '<span class="rowSub">'+(sum ? esc(sum) : esc(t('No numbers yet')))+' · '+esc(gpT('{n} reports',{n:(o.reports||[]).length}))+'</span></div>'+
      '<div class="dtsOutBtns"><button class="btn small ghost" data-dtsoutrep="'+esc(o.id)+'">＋ '+esc(t('Report'))+'</button><button class="btn small ghost" data-dtsout="'+esc(o.id)+'">'+esc(t('Edit'))+'</button></div></div>';
  }).join('')+'</div>';
  h+='<div class="card dtsSoon" id="dtsOutBudget"><h3 style="margin-top:0">💰 '+esc(t('Outreach budget'))+'</h3><p class="sub" style="margin:0">'+esc(t('Coming soon: each outreach’s budget beside what was spent.'))+'</p></div>';
  return h;
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
    var id=b.getAttribute('data-dtstostaff'), x=(S.dts.school||[]).filter(function(s){ return s.id===id; })[0]; if(!x) return;
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
  // Outreach
  var oa=document.getElementById('dtsOutAdd'); if(oa) oa.onclick=function(){ S.dtsOut={ place:'', from:'', to:'', leaders:'', size:'', notes:'', reports:[] }; render(); var n=document.getElementById('do_place'); if(n) n.focus(); };
  var openOut=function(id, addRep){
    var o=(S.dts.outreaches||[]).filter(function(x){ return x.id===id; })[0]; if(!o) return;
    S.dtsOut=JSON.parse(JSON.stringify(o)); if(addRep) S.dtsOut.reports.push(dtsNewReport_());
    render(); var f=document.getElementById('dtsOutForm'); if(f) f.scrollIntoView({ block:'start', behavior:'smooth' });
  };
  document.querySelectorAll('[data-dtsout]').forEach(function(b){ b.onclick=function(){ openOut(b.getAttribute('data-dtsout'), false); }; });
  document.querySelectorAll('[data-dtsoutrep]').forEach(function(b){ b.onclick=function(){ openOut(b.getAttribute('data-dtsoutrep'), true); }; });
  document.querySelectorAll('[data-do], [data-dor]').forEach(function(el){ el.oninput=el.onchange=function(){ dtsKeepOut_(); }; });
  var oar=document.getElementById('dtsOutAddRep'); if(oar) oar.onclick=function(){ dtsKeepOut_(); S.dtsOut.reports.push(dtsNewReport_()); render(); };
  document.querySelectorAll('[data-dorrm]').forEach(function(b){ b.onclick=function(){ dtsKeepOut_(); S.dtsOut.reports.splice(Number(b.getAttribute('data-dorrm')),1); render(); }; });
  var oc=document.getElementById('dtsOutCancel'); if(oc) oc.onclick=function(){ S.dtsOut=null; render(); };
  var os=document.getElementById('dtsOutSave');
  if(os) os.onclick=function(){
    dtsKeepOut_(); var f=S.dtsOut;
    if(!String(f.place||'').trim()){ showMsg(t('Say where the outreach is.')); return; }
    S.dtsBusy=true; render();
    run('dtsSaveOutreach',[S.auth.user,S.auth.pin,f],function(d){
      S.dtsBusy=false;
      if(d && d.ok){ S.dts.outreaches=d.outreaches; S.dtsOut=null; showMsg(t('Saved')); dtsRefresh_(); } else showMsg(t('Could not save'));
      render();
    }, function(){ S.dtsBusy=false; showMsg(t('Connection problem — try again.')); render(); });
  };
  var od=document.getElementById('dtsOutDel');
  if(od) od.onclick=function(){
    if(!S.dtsOut || !confirm(t('Delete this outreach and its reports?'))) return;
    run('dtsDeleteOutreach',[S.auth.user,S.auth.pin,S.dtsOut.id],function(d){
      if(d && d.ok){ S.dts.outreaches=d.outreaches; S.dtsOut=null; showMsg(t('Deleted')); dtsRefresh_(); } else showMsg(t('Could not delete'));
      render();
    });
  };
}
