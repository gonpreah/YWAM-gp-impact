/* ==================== the school tool (YDC; Nov 2026, Uriah) ====================
   "A really good software for managing a school … add students, … grades, taking roll, testing the
   students … names, photo, keep tabs of all of their students … use their phones to take a photo of the
   student … they fill out the tests on paper … then have they paid." My Ministry for a ministry in
   SCHOOL_TOOL (taxonomy.js; YDC for now) has the tabs Today · Students · Tests · Payments · Dashboard,
   then Tasks · OKRs — no Numbers tab: every metric counts itself from what is done here (api.js, "the
   school tool", schoolSync_). Locations, classes, the fee and the pass mark are set up in the app
   (⚙️ Set up the school: the ministry's leaders, its department's director, admins).
   One schoolBoard load per open (S.sch), every save answers with the whole board again. The roll is
   kept on this phone when there is no connection (the offline queue, 01-core.js) and sent later.
   Children's details: only the ministry's own people see any of it. */
var SCH_TABS=['sctoday','scstu','sctest','scpay','scdash'];
function isSchoolMinistry_(dept, min){ return typeof schoolToolFor==='function' && !!schoolToolFor(dept, min); }
function schTabs_(){ return [['sctoday',t('Today')],['scstu',t('Students')],['sctest',t('Tests')],['scpay',t('Payments')],['scdash',t('Dashboard')]]; }
function schScope_(){ var d=S.sch && S.sch.d; return { dept:S.mmBrowseDept, ministry:S.mmBrowseMinistry, campus:(d && d.campus) || S.me.campus }; }
function schKey_(){ return (S.mmBrowseDept||'')+'|'+(S.mmBrowseMinistry||''); }
function schD_(){ return S.sch && S.sch.key===schKey_() ? S.sch.d : null; }
function schToday_(){ var d=schD_(); return (d && d.today) || todayStr(); }
function schAddDays_(iso, n){ var x=new Date(iso+'T00:00:00Z'); x.setUTCDate(x.getUTCDate()+n); return x.toISOString().slice(0,10); }
function schMoney_(n){ n=Number(n)||0; return '$'+(Math.round(n*100)/100).toFixed(2).replace(/\.00$/,''); }
function schName_(s){ if(!s) return ''; return LANG==='km' ? (s.kh || s.en) : (s.en || s.kh); }
function schOtherName_(s){ if(!s) return ''; var a=schName_(s), b=LANG==='km' ? s.en : s.kh; return b && b!==a ? b : ''; }
function schById_(list, id){ return (list||[]).filter(function(x){ return x.id===id; })[0] || null; }
function schClass_(id){ var d=schD_(); return d ? schById_(d.data.classes, id) : null; }
function schStudent_(id){ var d=schD_(); return d ? schById_(d.data.students, id) : null; }
function schClassName_(c){ if(!c) return t('No class'); var d=schD_(), l=d ? schById_(d.data.locations, c.locationId) : null; return c.name+(l ? ' · '+l.name : ''); }
function schActiveOn_(s, day){ return !!s && (s.start||'')<=day && !(s.status==='left' && s.leftOn && s.leftOn<=day); }
function schInClass_(classId, day){ var d=schD_(); if(!d) return []; return d.data.students.filter(function(s){ return s.classId===classId && schActiveOn_(s, day); }).sort(function(a,b){ return schName_(a).localeCompare(schName_(b)); }); }
function schFace_(s){ var d=schD_(), th=d && d.thumbs && d.thumbs[s.id];
  return th ? '<img class="avatar schFaceImg" src="data:image/jpeg;base64,'+esc(th)+'" alt="">' : '<div class="avatar schFaceImg ph">'+esc(initials(schName_(s)))+'</div>'; }
function schTeacher_(c){ if(!c) return ''; if(c.teacherId){ var p=personOf(c.teacherId); return p ? p.name : ''; } return c.teacherName||''; }
var SCH_DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function schDaysText_(c){ return (c.days||[]).map(function(n){ return t(SCH_DAYS[n]); }).join(' · '); }
function schErr_(e){
  var m={ name_needed:t('Add a name first.'), bad_class:t('Pick a class.'), bad_location:t('Pick a location.'), bad_date:t('That date can’t be used.'),
    bad_out_of:t('Say what the test is out of.'), subject_needed:t('Add the subject.'), bad_amount:t('Type the amount.'), bad_period:t('Pick what the payment is for.'),
    bad_student:t('Pick a student.'), in_use:t('That is still in use, so it can’t be deleted.'), not_setup:t('Only the ministry’s leaders can change the set-up.'),
    too_many:t('That list is full.'), too_large:t('That photo is too large.'), bad_file:t('That photo couldn’t be read.'), not_authorized:t('You can’t open this school.') };
  return m[e] || t('That didn’t save — try again.');
}
/* ---- loading and saving ---- */
function schLoad_(){
  var key=schKey_();
  S.sch={ key:key, d:null, loading:true, err:'' };
  run('schoolBoard',[S.auth.user,S.auth.pin,schScope_()],function(d){
    if(S.sch.key!==key) return;
    S.sch.loading=false;
    if(d && d.ok) S.sch.d=d; else S.sch.err=schErr_(d && d.err);
    render();
  }, function(e){ if(S.sch.key!==key) return; S.sch.loading=false; S.sch.err=(e && e.message) || t('Connection problem — try again.'); render(); });
}
function schAdopt_(d){ if(d && d.ok && S.sch && S.sch.key===d.dept+'|'+d.ministry) S.sch.d=d; }
function schCall_(fn, extra, okMsg, then){
  if(S.schBusy) return;
  S.schBusy=true; render();
  run(fn,[S.auth.user,S.auth.pin,schScope_()].concat(extra),function(d){
    S.schBusy=false;
    if(d && d.ok){ schAdopt_(d); if(okMsg) showMsg(okMsg); if(then) then(d); }
    else showMsg(schErr_(d && d.err));
    render();
  }, function(){ S.schBusy=false; showMsg(t('Connection problem — try again.')); render(); });
}
function schLoadHtml_(){
  if(S.sch && S.sch.err) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load the school.'))+'</p><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.sch.err)+'</p>'+
    '<button class="btn ghost" id="schRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
}
/* ---- the pane ---- */
function schPaneHtml_(cur){
  var d=schD_();
  if(!d) return schLoadHtml_();
  var h='';
  var pend=schPendingRolls_();
  if(pend) h+='<p class="banner" id="schPending">📡 '+esc(gpT('{n} roll saved on this phone — it will send when you’re online.',{n:pend}))+'</p>';
  var pg=S.schPage;
  if(pg){
    if(pg==='setup') return h+schSetupHtml_(d);
    if(pg==='form') return h+schFormHtml_();
    if(pg.indexOf('student:')===0) return h+schStudentHtml_(pg.slice(8));
    if(pg.indexOf('report:')===0) return h+schReportHtml_(pg.slice(7));
    if(pg.indexOf('receipt:')===0) return h+schReceiptHtml_(pg.slice(8));
  }
  if(cur==='scstu') return h+schStudentsHtml_(d);
  if(cur==='sctest') return h+schTestsHtml_(d);
  if(cur==='scpay') return h+schPayHtml_(d);
  if(cur==='scdash') return h+schDashHtml_(d);
  return h+schTodayHtml_(d);
}
function schBackHtml_(){ return '<button class="linkbtn" id="schBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('Back'))+'</button>'; }
function schNeedSetupHtml_(d){
  return '<div class="card" id="schNoClass"><h3 style="margin-top:0">🏫 '+esc(t('No classes yet'))+'</h3><p class="sub" style="margin:0 0 8px">'+
    esc(d.canSetup ? t('Add your locations and classes first — then students, the roll and tests.') : t('Ask the ministry’s leader to set up the locations and classes.'))+'</p>'+
    (d.canSetup ? '<button class="btn" id="schSetupGo" style="margin-top:0">⚙️ '+esc(t('Set up the school'))+'</button>' : '')+'</div>';
}
/* ---------- Today: taking roll ---------- */
var SCH_MARK_NEXT={ p:'a', a:'l', l:'p' };
function schRollFor_(classId, date){ var d=schD_(); return d ? (d.rolls||[]).filter(function(r){ return r.classId===classId && r.date===date; })[0] || null : null; }
function schRollDraft_(){
  var d=schD_(), today=schToday_();
  var R=S.schRoll;
  if(!R || R.key!==S.sch.key || !schClass_(R.classId)){
    var dow=new Date(today+'T00:00:00Z').getUTCDay();
    var todays=d.data.classes.filter(function(c){ return (c.days||[]).indexOf(dow)>-1; });
    var c=(todays[0] || d.data.classes[0]);
    R=S.schRoll={ key:S.sch.key, classId:c ? c.id : '', date:today, marks:null };
  }
  if(!R.marks){
    var had=schRollFor_(R.classId, R.date), pend=schPendingRoll_(R.classId, R.date);
    R.marks={};
    schInClass_(R.classId, R.date).forEach(function(s){ R.marks[s.id]='p'; });
    var src=pend || (had && had.marks) || null;
    if(src) Object.keys(src).forEach(function(k){ R.marks[k]=src[k]; });
    R.saved=!!(had || pend);
  }
  return R;
}
function schTodayHtml_(d){
  if(!d.data.classes.length) return schNeedSetupHtml_(d);
  var R=schRollDraft_(), today=schToday_();
  var dow=new Date(R.date+'T00:00:00Z').getUTCDay();
  var h='<div class="card" id="schRoll"><h3 style="margin-top:0">✅ '+esc(t('Take the roll'))+'</h3>';
  h+='<div class="schChips" id="schRollClasses">'+d.data.classes.map(function(c){
    var on=c.id===R.classId, meets=(c.days||[]).indexOf(dow)>-1;
    return '<button class="chip'+(on?' on':'')+'" data-scrollclass="'+esc(c.id)+'">'+esc(c.name)+(meets ? ' •' : '')+'</button>'; }).join('')+'</div>';
  h+='<label class="f" for="schRollDate">'+esc(t('Day'))+'</label><input type="date" id="schRollDate" value="'+esc(R.date)+'" min="'+esc(schAddDays_(today,-14))+'" max="'+esc(today)+'">';
  var c=schClass_(R.classId);
  if(c) h+='<p class="hint" style="margin:6px 0">'+esc(schClassName_(c))+(schTeacher_(c) ? ' · '+esc(schTeacher_(c)) : '')+(c.time ? ' · '+esc(c.time) : '')+'</p>';
  var kids=schInClass_(R.classId, R.date);
  if(!kids.length) h+='<p class="sub">'+esc(t('No students in this class yet.'))+'</p>';
  else {
    var n={ p:0, a:0, l:0 }; kids.forEach(function(s){ n[R.marks[s.id]||'p']++; });
    h+='<p class="sub" id="schRollCount">'+esc(gpT('{p} here · {a} absent · {l} late',{p:n.p, a:n.a, l:n.l}))+'</p>';
    h+='<p class="hint" style="margin:0 0 6px">'+esc(t('Everyone starts as here. Tap a face: absent, then late, then here again.'))+'</p>';
    h+='<div class="schGrid">'+kids.map(function(s){ var m=R.marks[s.id]||'p';
      return '<button class="schFace m-'+m+'" data-scmark="'+esc(s.id)+'">'+schFace_(s)+'<span class="schFaceName">'+esc(schName_(s))+'</span><span class="schMark">'+esc(m==='p' ? t('Here') : m==='a' ? t('Absent') : t('Late'))+'</span></button>'; }).join('')+'</div>';
    h+='<button class="btn" id="schRollSave"'+(S.schBusy?' disabled':'')+'>'+esc(R.saved ? t('Save the roll again') : t('Save the roll'))+'</button>';
    if(R.saved) h+='<p class="hint" id="schRollSaved">✓ '+esc(t('A roll is saved for this day — saving again replaces it.'))+'</p>';
  }
  return h+'</div>';
}
/* the roll waiting on this phone (the offline queue) */
function schQueueKey_(classId, date){ return 'school:'+(S.sch ? S.sch.key : '')+'|'+(schScope_().campus)+'|'+classId+'|'+date; }
function schPendingRoll_(classId, date){ var k=schQueueKey_(classId, date), it=gpQueueList_().filter(function(x){ return x.key===k; })[0]; return it ? it.args[5] : null; }
function schPendingRolls_(){ var p='school:'+(S.sch ? S.sch.key : '')+'|'; return gpQueueList_().filter(function(x){ return x.key.indexOf(p)===0; }).length; }
function schSaveRoll_(){
  var R=S.schRoll; if(!R || !R.classId) return;
  var marks={}; schInClass_(R.classId, R.date).forEach(function(s){ marks[s.id]=R.marks[s.id]||'p'; });
  var args=[S.auth.user,S.auth.pin,schScope_(),R.classId,R.date,marks];
  function queue(){
    gpQueuePut_(schQueueKey_(R.classId, R.date), 'schoolRoll', args);
    R.saved=true; S.schBusy=false;
    showMsg(t('Saved on this phone — will send when online.')); render();
  }
  if(!gpOnline_()){ queue(); return; }
  S.schBusy=true; render();
  run('schoolRoll', args, function(d){
    S.schBusy=false;
    if(d && d.ok){ schAdopt_(d); R.saved=true; showMsg(t('Roll saved ✓')); }
    else showMsg(schErr_(d && d.err));
    render();
  }, queue);
}
/* ---------- Students ---------- */
function schStudentsHtml_(d){
  if(!d.data.classes.length) return schNeedSetupHtml_(d);
  var q=String(S.schFind||'').trim().toLowerCase(), cf=S.schClassF||'';
  var list=d.data.students.filter(function(s){ return (!cf || s.classId===cf) && (!q || (s.kh+' '+s.en+' '+(s.village||'')).toLowerCase().indexOf(q)>-1); })
    .sort(function(a,b){ return schName_(a).localeCompare(schName_(b)); });
  var here=list.filter(function(s){ return s.status!=='left'; }), left=list.filter(function(s){ return s.status==='left'; });
  var h='<div class="card" id="schStudents"><div class="schHeadRow"><h3 style="margin:0">🧒 '+esc(t('Students'))+' · '+here.length+'</h3>'+
    '<button class="btn dtsAdd" id="schAddStu" style="margin:0">＋ '+esc(t('Add a student'))+'</button></div>';
  h+='<label class="gtFind">'+gptIc_('search')+'<input type="search" id="schFind" value="'+esc(S.schFind||'')+'" placeholder="'+esc(t('Search a name or village'))+'" autocomplete="off"></label>';
  h+='<div class="schChips"><button class="chip'+(!cf?' on':'')+'" data-scclassf="">'+esc(t('All classes'))+'</button>'+d.data.classes.map(function(c){
    return '<button class="chip'+(cf===c.id?' on':'')+'" data-scclassf="'+esc(c.id)+'">'+esc(c.name)+'</button>'; }).join('')+'</div>';
  var grid=function(arr){ return '<div class="schGrid">'+arr.map(function(s){
    return '<button class="schFace" data-scstu="'+esc(s.id)+'">'+schFace_(s)+'<span class="schFaceName">'+esc(schName_(s))+'</span><span class="schMark">'+esc((schClass_(s.classId)||{}).name||'')+'</span></button>'; }).join('')+'</div>'; };
  h+= here.length ? grid(here) : '<p class="sub" style="margin:8px 0 0">'+esc(q ? t('Nobody by that name.') : t('No students yet — add the first one.'))+'</p>';
  if(left.length) h+='<details class="schFold"><summary>'+esc(gpT('Left the school · {n}',{n:left.length}))+'</summary>'+grid(left)+'</details>';
  return h+'</div>';
}
function schAttendance_(sid, from, to){
  var d=schD_(), n=0, here=0, late=0, absent=0;
  (d.rolls||[]).forEach(function(r){ if((from && r.date<from) || (to && r.date>to)) return; var m=r.marks && r.marks[sid]; if(!m) return; n++; if(m==='a') absent++; else { here++; if(m==='l') late++; } });
  return { n:n, here:here, late:late, absent:absent, pct: n ? Math.round(here/n*100) : null };
}
function schTestsOf_(sid, from, to){
  var d=schD_();
  return d.data.tests.filter(function(x){ return x.scores && (sid in x.scores) && (!from || x.date>=from) && (!to || x.date<=to); })
    .sort(function(a,b){ return a.date<b.date ? -1 : 1; }).map(function(x){ var pc=Math.round(x.scores[sid]/x.outOf*100); return { t:x, score:x.scores[sid], pct:pc, pass:pc>=d.data.settings.passMark }; });
}
function schStudentHtml_(id){
  var d=schD_(), s=schStudent_(id);
  if(!s) return schBackHtml_()+'<p class="sub">'+esc(t('That student isn’t here any more.'))+'</p>';
  var c=schClass_(s.classId), full=S.schPhotos && S.schPhotos[s.id];
  var h=schBackHtml_()+'<div class="card" id="schStu" data-scstuid="'+esc(s.id)+'"><div class="schStuTop">'+
    (full ? '<img class="schStuPhoto" src="data:image/jpeg;base64,'+esc(full)+'" alt="">' : schFace_(s))+
    '<div><div class="schStuName">'+esc(schName_(s))+'</div>'+(schOtherName_(s) ? '<div class="sub">'+esc(schOtherName_(s))+'</div>' : '')+
    '<div class="hint">'+esc(schClassName_(c))+(s.status==='left' ? ' · '+esc(gpT('Left {date}',{date:fmtDateNice_(s.leftOn)})) : '')+'</div></div></div>';
  h+='<label class="btn ghost schPhotoBtn" for="schPhotoIn">📷 '+esc(s.hasPhoto ? t('Take a new photo') : t('Take a photo'))+'</label>'+
    '<input type="file" id="schPhotoIn" accept="image/*" capture="environment" style="display:none">';
  var att=schAttendance_(s.id);
  h+='<div class="mmGrid schStats"><div class="mmTile"><div class="mmTileNum">'+(att.pct==null ? '—' : att.pct+'%')+'</div><div class="mmTileLbl">'+esc(t('Attendance'))+'</div></div>'+
    '<div class="mmTile"><div class="mmTileNum">'+att.absent+'</div><div class="mmTileLbl">'+esc(t('Days absent'))+'</div></div>';
  var ts=schTestsOf_(s.id), avg=ts.length ? Math.round(ts.reduce(function(a,x){ return a+x.pct; },0)/ts.length) : null;
  h+='<div class="mmTile"><div class="mmTileNum">'+(avg==null ? '—' : avg+'%')+'</div><div class="mmTileLbl">'+esc(t('Test average'))+'</div></div></div>';
  var rows=[[t('Sex'), s.sex==='m' ? t('Male') : s.sex==='f' ? t('Female') : ''],[t('Date of birth'), s.dob ? fmtDateNice_(s.dob)+' '+s.dob.slice(0,4) : ''],[t('Village'), s.village],
    [t('Parent or guardian'), s.guardian],[t('Guardian’s phone'), s.guardianPhone],[t('Started'), s.start ? fmtDateNice_(s.start)+' '+s.start.slice(0,4) : ''],
    [t('Fee'), s.fee && s.fee.mode==='free' ? t('Sponsored — free') : s.fee && s.fee.mode==='discount' ? gpT('Discount: {amt}',{amt:schMoney_(s.fee.amount)}) : t('Full fee')]];
  h+='<dl class="schDl">'+rows.filter(function(r){ return r[1]; }).map(function(r){ return '<dt>'+esc(r[0])+'</dt><dd>'+(r[0]===t('Guardian’s phone') ? '<a href="tel:'+esc(r[1].replace(/\s/g,''))+'">'+esc(r[1])+'</a>' : esc(r[1]))+'</dd>'; }).join('')+'</dl>';
  if(s.notes) h+='<p class="sub schNotes">'+esc(s.notes)+'</p>';
  h+='<div class="schBtnRow"><button class="btn ghost" data-scedit="student|'+esc(s.id)+'">✏️ '+esc(t('Edit'))+'</button>'+
    '<button class="btn ghost" data-screport="'+esc(s.id)+'">📄 '+esc(t('Report card'))+'</button></div></div>';
  // faith & life
  var f=s.faith||{};
  var FA=[['disc',t('In discipleship')],['church',t('Brought to a local church')],['salv',t('Salvation')],['bapt',t('Baptism')]];
  h+='<div class="card" id="schFaith"><h3 style="margin-top:0">🙏 '+esc(t('Faith and life'))+'</h3>'+FA.map(function(x){
    var on=!!f[x[0]];
    return '<div class="schFaithRow"><label class="schTick"><input type="checkbox" data-scfaith="'+x[0]+'"'+(on?' checked':'')+'> '+esc(x[1])+'</label>'+
      (on ? '<input type="date" data-scfaithdate="'+x[0]+'" value="'+esc(f[x[0]])+'" max="'+esc(schToday_())+'" aria-label="'+esc(x[1])+'">' : '')+'</div>';
  }).join('')+'<p class="hint" style="margin:6px 0 0">'+esc(t('Salvations, baptisms, discipleship and church count in the ministry’s numbers by these dates.'))+'</p></div>';
  // tests
  h+='<div class="card"><h3 style="margin-top:0">📝 '+esc(t('Tests'))+'</h3>'+(ts.length ? '<table class="schTbl"><tbody>'+ts.slice().reverse().map(function(x){
    return '<tr><td>'+esc(x.t.subject)+'<div class="hint">'+esc(fmtDateNice_(x.t.date))+'</div></td><td class="num">'+esc(x.score+' / '+x.t.outOf)+'</td><td class="num '+(x.pass?'ok':'bad')+'">'+x.pct+'%</td></tr>'; }).join('')+'</tbody></table>'
    : '<p class="sub" style="margin:0">'+esc(t('No test scores yet.'))+'</p>')+'</div>';
  // payments
  var pays=d.data.payments.filter(function(p){ return p.studentId===s.id; }).sort(function(a,b){ return a.date<b.date ? 1 : -1; });
  h+='<div class="card"><div class="schHeadRow"><h3 style="margin:0">💵 '+esc(t('Payments'))+'</h3><button class="btn dtsAdd" data-scpayfor="'+esc(s.id)+'" style="margin:0">＋ '+esc(t('Record a payment'))+'</button></div>'+
    (pays.length ? '<table class="schTbl"><tbody>'+pays.map(function(p){ return '<tr><td>'+esc(fmtDateNice_(p.date))+'<div class="hint">'+esc(schPeriodName_(p.period))+'</div></td><td class="num">'+esc(schMoney_(p.amount))+'</td><td><button class="linkbtn" data-screceipt="'+esc(p.id)+'">'+esc(t('Receipt'))+'</button></td></tr>'; }).join('')+'</tbody></table>'
    : '<p class="sub" style="margin:6px 0 0">'+esc(t('No payments yet.'))+'</p>')+'</div>';
  if(!pays.length) h+='<button class="linkbtn danger" data-scdel="student|'+esc(s.id)+'">'+esc(t('Delete this student'))+'</button>';
  return h;
}
/* ---------- Tests ---------- */
function schTestStats_(x){
  var d=schD_(), ids=Object.keys(x.scores||{}), pm=d.data.settings.passMark;
  if(!ids.length) return { n:0, avg:null, pass:0 };
  var pcs=ids.map(function(k){ return x.scores[k]/x.outOf*100; });
  return { n:ids.length, avg:Math.round(pcs.reduce(function(a,b){ return a+b; },0)/ids.length), pass:pcs.filter(function(p){ return p>=pm; }).length };
}
function schTestsHtml_(d){
  if(!d.data.classes.length) return schNeedSetupHtml_(d);
  var list=d.data.tests.slice().sort(function(a,b){ return a.date<b.date ? 1 : a.date>b.date ? -1 : 0; });
  var h='<div class="card" id="schTests"><div class="schHeadRow"><h3 style="margin:0">📝 '+esc(t('Tests'))+'</h3><button class="btn dtsAdd" id="schAddTest" style="margin:0">＋ '+esc(t('New test'))+'</button></div>'+
    '<p class="hint" style="margin:6px 0">'+esc(gpT('The students do the test on paper; type each score here. Pass mark: {pm}%.',{pm:d.data.settings.passMark}))+'</p>';
  if(!list.length) h+='<p class="sub" style="margin:0">'+esc(t('No tests yet.'))+'</p>';
  else h+=list.map(function(x){ var st=schTestStats_(x), c=schClass_(x.classId);
    return '<button class="schRowBtn" data-scedit="test|'+esc(x.id)+'"><span><b>'+esc(x.subject)+'</b><span class="hint"> · '+esc((c||{}).name||'')+' · '+esc(fmtDateNice_(x.date))+'</span></span>'+
      '<span class="schRowRight">'+(st.n ? esc(gpT('avg {a}% · {p} of {n} passed',{a:st.avg, p:st.pass, n:st.n})) : esc(t('No scores yet')))+((x.papers||[]).length ? ' · 📷' : '')+'</span></button>'; }).join('');
  return h+'</div>';
}
/* ---------- Payments ---------- */
function schPeriodName_(p){
  if(/^\d{4}-\d{2}$/.test(p||'')){ var dt=new Date(p+'-01T00:00:00'); return isNaN(dt) ? p : dt.toLocaleDateString(LANG==='km'?'km-KH':'en-GB', { month:'long', year:'numeric' }); }
  var d=schD_(), tm=d ? schById_(d.data.settings.terms, p) : null; return tm ? tm.name : (p||'');
}
function schCurPeriod_(){
  var d=schD_(), st=d.data.settings, today=schToday_();
  if(S.schPeriod) return S.schPeriod;
  if(st.fee.per==='term'){ var tm=st.terms.filter(function(x){ return x.from<=today && today<=x.to; })[0] || st.terms[st.terms.length-1]; if(tm) return tm.id; }
  return today.slice(0,7);
}
function schOwes_(period){
  var d=schD_(), st=d.data.settings, today=schToday_(), out=[];
  d.data.students.forEach(function(s){
    if(!schActiveOn_(s, today)) return;
    var mode=(s.fee && s.fee.mode) || 'full'; if(mode==='free') return;
    var due=mode==='discount' ? Number(s.fee.amount)||0 : Number(st.fee.amount)||0; if(!due) return;
    var paid=d.data.payments.filter(function(p){ return p.studentId===s.id && p.period===period; }).reduce(function(a,p){ return a+p.amount; },0);
    if(paid < due-0.001) out.push({ s:s, due:due, paid:paid, owes:Math.round((due-paid)*100)/100 });
  });
  return out;
}
function schPayHtml_(d){
  var st=d.data.settings, period=schCurPeriod_(), today=schToday_();
  var h='<div class="card" id="schPay"><div class="schHeadRow"><h3 style="margin:0">💵 '+esc(t('Payments'))+'</h3><button class="btn dtsAdd" id="schAddPay" style="margin:0">＋ '+esc(t('Record a payment'))+'</button></div>';
  if(!st.fee.amount) h+='<p class="hint" style="margin:6px 0">'+esc(d.canSetup ? t('Set the fee in ⚙️ Set up the school to see who still owes.') : t('The fee isn’t set yet — the ministry’s leader sets it.'))+'</p>';
  h+='<label class="f" for="schPeriod">'+esc(t('For'))+'</label>';
  if(st.fee.per==='term' && st.terms.length) h+='<select id="schPeriod">'+st.terms.map(function(x){ return '<option value="'+esc(x.id)+'"'+(x.id===period?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+'</select>';
  else h+='<input type="month" id="schPeriod" value="'+esc(/^\d{4}-\d{2}$/.test(period) ? period : today.slice(0,7))+'">';
  var owes=schOwes_(period), total=owes.reduce(function(a,o){ return a+o.owes; },0);
  var mo=(/^\d{4}-\d{2}$/.test(period) ? period : today.slice(0,7));
  var inMonth=d.data.payments.filter(function(p){ return p.date.slice(0,7)===mo; }).reduce(function(a,p){ return a+p.amount; },0);
  h+='<div class="mmGrid schStats"><div class="mmTile"><div class="mmTileNum" id="schOwedTotal">'+esc(schMoney_(total))+'</div><div class="mmTileLbl">'+esc(t('Still owed'))+'</div></div>'+
    '<div class="mmTile"><div class="mmTileNum" id="schMonthTotal">'+esc(schMoney_(inMonth))+'</div><div class="mmTileLbl">'+esc(gpT('Paid in {month}',{month:schPeriodName_(mo)}))+'</div></div></div>';
  h+='<h4>'+esc(t('Still owes'))+' · '+owes.length+'</h4>';
  if(!owes.length) h+='<p class="sub" id="schOwesNone">'+esc(t('Nobody owes anything for this.'))+'</p>';
  else {
    var byClass={}; owes.forEach(function(o){ (byClass[o.s.classId]=byClass[o.s.classId]||[]).push(o); });
    h+='<div id="schOwes">'+Object.keys(byClass).map(function(cid){
      return '<div class="schOweClass"><div class="gtPickDept">'+esc((schClass_(cid)||{}).name||t('No class'))+'</div>'+byClass[cid].map(function(o){
        return '<div class="schOwe" data-scowe="'+esc(o.s.id)+'"><span>'+esc(schName_(o.s))+(o.paid ? '<span class="hint"> · '+esc(gpT('paid {amt}',{amt:schMoney_(o.paid)}))+'</span>' : '')+'</span>'+
          '<span class="schRowRight"><b>'+esc(schMoney_(o.owes))+'</b> <button class="linkbtn" data-scpayfor="'+esc(o.s.id)+'">'+esc(t('Record'))+'</button></span></div>'; }).join('')+'</div>'; }).join('')+'</div>';
  }
  var recent=d.data.payments.slice().sort(function(a,b){ return a.date<b.date ? 1 : a.date>b.date ? -1 : (a.at<b.at?1:-1); }).slice(0,30);
  h+='<h4>'+esc(t('Latest payments'))+'</h4>'+(recent.length ? '<table class="schTbl" id="schPayList"><tbody>'+recent.map(function(p){ var s=schStudent_(p.studentId);
    return '<tr><td>'+esc(schName_(s))+'<div class="hint">'+esc(fmtDateNice_(p.date))+' · '+esc(schPeriodName_(p.period))+'</div></td><td class="num">'+esc(schMoney_(p.amount))+'</td><td><button class="linkbtn" data-screceipt="'+esc(p.id)+'">'+esc(t('Receipt'))+'</button></td></tr>'; }).join('')+'</tbody></table>'
    : '<p class="sub">'+esc(t('No payments yet.'))+'</p>');
  return h+'</div>';
}
var SCH_METHODS=[['cash','Cash'],['aba','ABA'],['other','Other']];
function schReceiptHtml_(id){
  var d=schD_(), p=schById_(d.data.payments, id);
  if(!p) return schBackHtml_()+'<p class="sub">'+esc(t('That payment isn’t here any more.'))+'</p>';
  var s=schStudent_(p.studentId), m=SCH_METHODS.filter(function(x){ return x[0]===p.method; })[0];
  return schBackHtml_()+'<div class="card schPrint" id="schReceipt"><h3 style="margin-top:0">🧾 '+esc(t('Receipt'))+'</h3>'+
    '<p class="sub" style="margin:0">'+esc(t(S.mmBrowseMinistry))+' · '+esc(campusName(d.campus))+'</p>'+
    '<dl class="schDl"><dt>'+esc(t('Student'))+'</dt><dd>'+esc(schName_(s))+(schOtherName_(s) ? ' ('+esc(schOtherName_(s))+')' : '')+'</dd>'+
    '<dt>'+esc(t('Amount'))+'</dt><dd><b>'+esc(schMoney_(p.amount))+'</b></dd><dt>'+esc(t('For'))+'</dt><dd>'+esc(schPeriodName_(p.period))+'</dd>'+
    '<dt>'+esc(t('Paid on'))+'</dt><dd>'+esc(fmtDateNice_(p.date))+' '+esc(p.date.slice(0,4))+'</dd><dt>'+esc(t('How'))+'</dt><dd>'+esc(t(m ? m[1] : 'Cash'))+'</dd>'+
    (p.note ? '<dt>'+esc(t('Note'))+'</dt><dd>'+esc(p.note)+'</dd>' : '')+'<dt>'+esc(t('Received by'))+'</dt><dd>'+esc(nameOf(p.by)||'')+'</dd></dl>'+
    '<div class="schBtnRow noPrint"><button class="btn" id="schPrint">🖨️ '+esc(t('Print or save as PDF'))+'</button><button class="linkbtn danger" data-scdel="payment|'+esc(p.id)+'">'+esc(t('Delete this payment'))+'</button></div></div>';
}
/* ---------- Report card ---------- */
function schReportRange_(){
  var d=schD_(), today=schToday_(), tm=(d.data.settings.terms||[]).filter(function(x){ return x.from<=today && today<=x.to; })[0];
  var r=S.schReportRange || (tm ? { from:tm.from, to:tm.to } : { from:today.slice(0,4)+'-01-01', to:today });
  return r;
}
function schReportHtml_(id){
  var d=schD_(), s=schStudent_(id);
  if(!s) return schBackHtml_();
  var r=schReportRange_(), att=schAttendance_(s.id, r.from, r.to), ts=schTestsOf_(s.id, r.from, r.to);
  var avg=ts.length ? Math.round(ts.reduce(function(a,x){ return a+x.pct; },0)/ts.length) : null;
  var h=schBackHtml_()+'<div class="card noPrint"><div class="dateRow"><div><label class="f" for="schRepFrom">'+esc(t('From'))+'</label><input type="date" id="schRepFrom" value="'+esc(r.from)+'"></div>'+
    '<div><label class="f" for="schRepTo">'+esc(t('To'))+'</label><input type="date" id="schRepTo" value="'+esc(r.to)+'"></div></div>'+
    (d.data.settings.terms.length ? '<div class="schChips">'+d.data.settings.terms.map(function(x){ return '<button class="chip'+(x.from===r.from && x.to===r.to?' on':'')+'" data-scterm="'+esc(x.from+'|'+x.to)+'">'+esc(x.name)+'</button>'; }).join('')+'</div>' : '')+'</div>';
  h+='<div class="card schPrint" id="schReport"><h3 style="margin-top:0">📄 '+esc(t('Report card'))+'</h3>'+
    '<div class="schStuName">'+esc(schName_(s))+'</div>'+(schOtherName_(s) ? '<div class="sub">'+esc(schOtherName_(s))+'</div>' : '')+
    '<p class="hint">'+esc(t(S.mmBrowseMinistry))+' · '+esc(schClassName_(schClass_(s.classId)))+' · '+esc(fmtDateNice_(r.from)+' '+r.from.slice(0,4)+' – '+fmtDateNice_(r.to)+' '+r.to.slice(0,4))+'</p>'+
    '<dl class="schDl"><dt>'+esc(t('Attendance'))+'</dt><dd>'+(att.pct==null ? '—' : esc(gpT('{pct}% · here {h} of {n} days, late {l}',{pct:att.pct, h:att.here, n:att.n, l:att.late})))+'</dd>'+
    '<dt>'+esc(t('Test average'))+'</dt><dd>'+(avg==null ? '—' : avg+'%')+'</dd></dl>'+
    (ts.length ? '<table class="schTbl" id="schRepTests"><thead><tr><th>'+esc(t('Test'))+'</th><th class="num">'+esc(t('Score'))+'</th><th class="num">%</th><th></th></tr></thead><tbody>'+ts.map(function(x){
      return '<tr><td>'+esc(x.t.subject)+'<div class="hint">'+esc(fmtDateNice_(x.t.date))+'</div></td><td class="num">'+esc(x.score+' / '+x.t.outOf)+'</td><td class="num">'+x.pct+'%</td><td>'+esc(x.pass ? t('Pass') : t('Not yet'))+'</td></tr>'; }).join('')+'</tbody></table>'
      : '<p class="sub">'+esc(t('No tests in these dates.'))+'</p>')+
    '<div class="schBtnRow noPrint"><button class="btn" id="schPrint">🖨️ '+esc(t('Print or save as PDF'))+'</button></div></div>';
  return h;
}
/* ---------- Dashboard ---------- */
function schMissedRun_(s){
  var d=schD_(), rows=(d.rolls||[]).filter(function(r){ return r.marks && r.marks[s.id]; }).sort(function(a,b){ return a.date<b.date ? 1 : -1; });
  var n=0; for(var i=0;i<rows.length;i++){ if(rows[i].marks[s.id]==='a') n++; else break; } return n;
}
function schDashHtml_(d){
  var today=schToday_(), mo=today.slice(0,7), yr=today.slice(0,4);
  var active=d.data.students.filter(function(s){ return schActiveOn_(s, today); });
  var h='';
  if(d.canSetup) h+='<button class="btn ghost" id="schSetupGo" style="margin-top:0">⚙️ '+esc(t('Set up the school'))+'</button>';
  // attendance this month
  var n=0, here=0; (d.rolls||[]).forEach(function(r){ if(r.date.slice(0,7)!==mo) return; Object.keys(r.marks||{}).forEach(function(k){ n++; if(r.marks[k]!=='a') here++; }); });
  var owed=schOwes_(schCurPeriod_()).reduce(function(a,o){ return a+o.owes; },0);
  h+='<div class="card" id="schDash"><h3 style="margin-top:0">📊 '+esc(t('The school at a glance'))+'</h3><div class="mmGrid schStats">'+
    '<div class="mmTile"><div class="mmTileNum" id="schDashStudents">'+active.length+'</div><div class="mmTileLbl">'+esc(t('Students'))+'</div></div>'+
    '<div class="mmTile"><div class="mmTileNum" id="schDashAtt">'+(n ? Math.round(here/n*100)+'%' : '—')+'</div><div class="mmTileLbl">'+esc(t('Attendance this month'))+'</div></div>'+
    '<div class="mmTile"><div class="mmTileNum" id="schDashOwed">'+esc(schMoney_(owed))+'</div><div class="mmTileLbl">'+esc(t('Still owed'))+'</div></div></div>';
  // by location
  h+='<h4>'+esc(t('Students by location'))+'</h4><div class="schBars">'+d.data.locations.map(function(l){
    var k=active.filter(function(s){ var c=schClass_(s.classId); return c && c.locationId===l.id; }).length, w=active.length ? Math.round(k/active.length*100) : 0;
    return '<div class="schBarRow"><span>'+esc(l.name)+'</span><span class="schBar"><i style="width:'+w+'%"></i></span><b>'+k+'</b></div>'; }).join('')+'</div></div>';
  // follow up
  var miss=active.map(function(s){ return { s:s, n:schMissedRun_(s) }; }).filter(function(x){ return x.n>=3; }).sort(function(a,b){ return b.n-a.n; });
  h+='<div class="card" id="schFollow"><h3 style="margin-top:0">📞 '+esc(t('Missed 3 classes or more in a row'))+'</h3>'+(miss.length ? miss.map(function(x){
    return '<button class="schRowBtn" data-scstu="'+esc(x.s.id)+'"><span>'+esc(schName_(x.s))+'<span class="hint"> · '+esc((schClass_(x.s.classId)||{}).name||'')+'</span></span><span class="schRowRight">'+esc(gpT('{n} in a row',{n:x.n}))+(x.s.guardianPhone ? ' · 📞' : '')+'</span></button>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('Nobody — everyone has been coming.'))+'</p>')+'</div>';
  // tests over time: by month
  var byMo={}; d.data.tests.forEach(function(x){ if(x.date.slice(0,4)!==yr) return; var st=schTestStats_(x); if(!st.n) return; var k=x.date.slice(0,7); byMo[k]=byMo[k]||{ s:0, n:0, p:0 }; byMo[k].s+=st.avg*st.n; byMo[k].n+=st.n; byMo[k].p+=st.pass; });
  var mos=Object.keys(byMo).sort();
  h+='<div class="card" id="schTestTrend"><h3 style="margin-top:0">📈 '+esc(t('Test results this year'))+'</h3>'+(mos.length ? '<div class="schBars">'+mos.map(function(k){ var a=Math.round(byMo[k].s/byMo[k].n);
    return '<div class="schBarRow"><span>'+esc(schPeriodName_(k))+'</span><span class="schBar"><i style="width:'+a+'%"></i></span><b>'+a+'%</b></div>'; }).join('')+'</div><p class="hint">'+esc(t('The average score each month, and how many passed.'))+'</p>'
    : '<p class="sub" style="margin:0">'+esc(t('No test scores yet.'))+'</p>')+'</div>';
  // fruit
  var cnt=function(k){ return d.data.students.filter(function(s){ return s.faith && s.faith[k] && s.faith[k].slice(0,4)===yr; }).length; };
  var lvl=function(k){ return active.filter(function(s){ return s.faith && s.faith[k]; }).length; };
  var ev=function(k){ return d.data.events.filter(function(e){ return e.kind===k && e.date.slice(0,4)===yr && e.date<=today; }).length; };
  var F=[['🙌',t('Salvations'),cnt('salv')],['💧',t('Baptisms'),cnt('bapt')],['📖',t('In discipleship'),lvl('disc')],['⛪',t('At a local church'),lvl('church')],['🎉',t('Parties'),ev('party')],['🏆',t('Competitions'),ev('competition')]];
  h+='<div class="card" id="schFruit"><h3 style="margin-top:0">🌱 '+esc(gpT('This year’s fruit · {y}',{y:yr}))+'</h3><div class="mmGrid schStats">'+F.map(function(x){
    return '<div class="mmTile"><div class="mmTileNum">'+x[2]+'</div><div class="mmTileLbl">'+x[0]+' '+esc(x[1])+'</div></div>'; }).join('')+'</div>'+
    '<p class="hint" style="margin:6px 0 0">'+esc(t('These, the days with classes, students enrolled and tests count themselves into the ministry’s numbers — nobody types them.'))+'</p></div>';
  // events
  var evs=d.data.events.slice().sort(function(a,b){ return a.date<b.date ? 1 : -1; });
  h+='<div class="card" id="schEvents"><div class="schHeadRow"><h3 style="margin:0">🎉 '+esc(t('Parties and competitions'))+'</h3><button class="btn dtsAdd" id="schAddEvent" style="margin:0">＋ '+esc(t('Add'))+'</button></div>'+
    (evs.length ? evs.slice(0,20).map(function(e){ return '<button class="schRowBtn" data-scedit="event|'+esc(e.id)+'"><span>'+(e.kind==='party' ? '🎉 ' : e.kind==='competition' ? '🏆 ' : '📌 ')+esc(e.title)+'</span><span class="schRowRight">'+esc(fmtDateNice_(e.date))+'</span></button>'; }).join('')
      : '<p class="sub" style="margin:6px 0 0">'+esc(t('None yet.'))+'</p>')+'</div>';
  return h;
}
/* ---------- Set up ---------- */
function schSetupHtml_(d){
  var st=S.schSet || (S.schSet=JSON.parse(JSON.stringify(d.data.settings)));
  var h=schBackHtml_()+'<div class="card" id="schSetup"><h3 style="margin-top:0">⚙️ '+esc(t('Set up the school'))+'</h3>';
  h+='<h4>'+esc(t('Locations'))+'</h4>'+d.data.locations.map(function(l){ return '<button class="schRowBtn" data-scedit="location|'+esc(l.id)+'"><span>📍 '+esc(l.name)+'</span><span class="schRowRight">'+esc(gpT('{n} classes',{n:d.data.classes.filter(function(c){ return c.locationId===l.id; }).length}))+'</span></button>'; }).join('')+
    '<button class="btn ghost dtsAdd" id="schAddLoc">＋ '+esc(t('Add a location'))+'</button>';
  h+='<h4>'+esc(t('Classes'))+'</h4>'+d.data.classes.map(function(c){ return '<button class="schRowBtn" data-scedit="class|'+esc(c.id)+'"><span>🏫 '+esc(schClassName_(c))+'<span class="hint"> · '+esc([schTeacher_(c), schDaysText_(c), c.time].filter(Boolean).join(' · '))+'</span></span></button>'; }).join('')+
    (d.data.locations.length ? '<button class="btn ghost dtsAdd" id="schAddClass">＋ '+esc(t('Add a class'))+'</button>' : '<p class="hint">'+esc(t('Add a location first.'))+'</p>');
  h+='<h4>'+esc(t('Fee and pass mark'))+'</h4>'+
    '<label class="f" for="scs_fee">'+esc(t('Fee (US$)'))+'</label><input type="number" id="scs_fee" min="0" step="0.5" inputmode="decimal" value="'+esc(st.fee.amount||'')+'">'+
    '<label class="f" for="scs_per">'+esc(t('The fee is for'))+'</label><select id="scs_per"><option value="month"'+(st.fee.per!=='term'?' selected':'')+'>'+esc(t('Each month'))+'</option><option value="term"'+(st.fee.per==='term'?' selected':'')+'>'+esc(t('Each term'))+'</option></select>'+
    '<label class="f" for="scs_pass">'+esc(t('Pass mark (%)'))+'</label><input type="number" id="scs_pass" min="1" max="100" inputmode="numeric" value="'+esc(st.passMark)+'">';
  h+='<h4>'+esc(t('Terms'))+'</h4>'+(st.terms||[]).map(function(x,i){
    return '<div class="schTermRow"><input type="text" data-scterm-f="'+i+'|name" value="'+esc(x.name)+'" placeholder="'+esc(t('Name'))+'" aria-label="'+esc(t('Name'))+'"><input type="date" data-scterm-f="'+i+'|from" value="'+esc(x.from)+'" aria-label="'+esc(t('From'))+'"><input type="date" data-scterm-f="'+i+'|to" value="'+esc(x.to)+'" aria-label="'+esc(t('To'))+'"><button class="gptX" data-sctermrm="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+
    '<button class="linkbtn" id="schAddTerm">＋ '+esc(t('Add a term'))+'</button>';
  h+='<button class="btn" id="schSaveSettings"'+(S.schBusy?' disabled':'')+'>'+esc(t('Save'))+'</button></div>';
  return h;
}
/* ---------- the one form: location, class, student, test, payment, event ---------- */
function schOpenForm_(kind, rec){ S.schForm={ kind:kind, rec:rec }; S.schPage='form'; render(); window.scrollTo(0,0); }
function schFieldHtml_(f, rec){
  var id='scf_'+f[0], v=rec[f[0]]==null ? '' : rec[f[0]], lab='<label class="f" for="'+id+'">'+esc(f[1])+'</label>';
  if(f[2]==='select') return lab+'<select id="'+id+'" data-scf="'+f[0]+'">'+f[3].map(function(o){ return '<option value="'+esc(o[0])+'"'+(String(v)===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select>';
  if(f[2]==='area') return lab+'<textarea id="'+id+'" data-scf="'+f[0]+'" rows="3" maxlength="'+(f[3]||1000)+'">'+esc(v)+'</textarea>';
  return lab+'<input id="'+id+'" data-scf="'+f[0]+'" type="'+(f[2]||'text')+'" value="'+esc(v)+'"'+(f[3] ? ' '+f[3] : '')+'>';
}
function schFormHtml_(){
  var F=S.schForm, d=schD_(); if(!F) return '';
  var r=F.rec, k=F.kind, today=schToday_(), h=schBackHtml_()+'<div class="card" id="schForm" data-sckind="'+k+'">';
  var classOpts=d.data.classes.map(function(c){ return [c.id, schClassName_(c)]; });
  var titles={ location:r.id ? t('Edit the location') : t('Add a location'), class:r.id ? t('Edit the class') : t('Add a class'), student:r.id ? t('Edit the student') : t('Add a student'),
    test:r.id ? t('Test scores') : t('New test'), payment:t('Record a payment'), event:r.id ? t('Edit') : t('Add a party or competition') };
  h+='<h3 style="margin-top:0">'+esc(titles[k])+'</h3>';
  if(k==='location') h+=schFieldHtml_(['name',t('Name'),'text','maxlength="60"'], r)+schFieldHtml_(['notes',t('Notes'),'area',300], r);
  else if(k==='class'){
    h+=schFieldHtml_(['name',t('Class name or level'),'text','maxlength="60"'], r)+schFieldHtml_(['locationId',t('Location'),'select',d.data.locations.map(function(l){ return [l.id,l.name]; })], r);
    h+='<label class="f">'+esc(t('Teacher'))+'</label>'+ppickHtml_({ key:'sct', people:ppickPeopleFor_({ scope:'ministry', dept:S.mmBrowseDept, ministry:S.mmBrowseMinistry, campus:d.campus }), chosen:r.teacherId ? [r.teacherId] : [],
      onPick:function(id){ S.schForm.rec.teacherId=id; S.schForm.rec.teacherName=''; render(); }, onRemove:function(){ S.schForm.rec.teacherId=''; render(); } });
    if(!r.teacherId) h+=schFieldHtml_(['teacherName',t('Or type a name'),'text','maxlength="60"'], r);
    h+='<label class="f">'+esc(t('Days'))+'</label><div class="schChips">'+SCH_DAYS.map(function(x,i){ var on=(r.days||[]).indexOf(i)>-1; return '<button class="chip'+(on?' on':'')+'" data-scday="'+i+'">'+esc(t(x))+'</button>'; }).join('')+'</div>';
    h+='<div class="dateRow"><div>'+schFieldHtml_(['time',t('Starts'),'time'], r)+'</div><div>'+schFieldHtml_(['end',t('Ends'),'time'], r)+'</div></div>';
  }
  else if(k==='student'){
    h+=schFieldHtml_(['kh',t('Name in Khmer'),'text','maxlength="80"'], r)+schFieldHtml_(['en',t('Name in English letters'),'text','maxlength="80"'], r)+
      schFieldHtml_(['classId',t('Class'),'select',classOpts], r)+
      schFieldHtml_(['sex',t('Sex'),'select',[['',t('Not said')],['m',t('Male')],['f',t('Female')]]], r)+
      schFieldHtml_(['dob',t('Date of birth'),'date','max="'+today+'"'], r)+schFieldHtml_(['village',t('Village'),'text','maxlength="80"'], r)+
      schFieldHtml_(['guardian',t('Parent or guardian'),'text','maxlength="80"'], r)+schFieldHtml_(['guardianPhone',t('Guardian’s phone'),'tel','maxlength="30" inputmode="tel"'], r)+
      schFieldHtml_(['start',t('Started'),'date'], r);
    var fee=r.fee||{ mode:'full' };
    h+='<label class="f" for="scf_feemode">'+esc(t('Fee'))+'</label><select id="scf_feemode" data-scfee="mode"><option value="full"'+(fee.mode==='full'?' selected':'')+'>'+esc(t('Full fee'))+'</option><option value="discount"'+(fee.mode==='discount'?' selected':'')+'>'+esc(t('A discount'))+'</option><option value="free"'+(fee.mode==='free'?' selected':'')+'>'+esc(t('Sponsored — free'))+'</option></select>'+
      (fee.mode==='discount' ? '<label class="f" for="scf_feeamt">'+esc(t('They pay (US$)'))+'</label><input type="number" id="scf_feeamt" data-scfee="amount" min="0" step="0.5" inputmode="decimal" value="'+esc(fee.amount||'')+'">' : '');
    if(r.id) h+=schFieldHtml_(['status',t('Status'),'select',[['active',t('In the school')],['left',t('Left the school')]]], r)+(r.status==='left' ? schFieldHtml_(['leftOn',t('Left on'),'date'], r) : '');
    h+=schFieldHtml_(['notes',t('Notes'),'area',1000], r);
    if(!r.id) h+='<p class="hint">'+esc(t('Take their photo once they’re saved.'))+'</p>';
  }
  else if(k==='test'){
    var subs=[]; d.data.tests.slice().reverse().forEach(function(x){ if(subs.indexOf(x.subject)===-1) subs.push(x.subject); });
    h+=schFieldHtml_(['classId',t('Class'),'select',classOpts], r)+schFieldHtml_(['subject',t('Subject'),'text','maxlength="60" list="schSubjects"'], r)+
      '<datalist id="schSubjects">'+subs.slice(0,20).map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>'+
      '<div class="dateRow"><div>'+schFieldHtml_(['date',t('Day'),'date'], r)+'</div><div>'+schFieldHtml_(['outOf',t('Out of'),'number','min="1" max="1000" inputmode="numeric"'], r)+'</div></div>';
    var kids=d.data.students.filter(function(s){ return s.classId===r.classId && (schActiveOn_(s, r.date||today) || (r.scores && s.id in r.scores)); }).sort(function(a,b){ return schName_(a).localeCompare(schName_(b)); });
    h+='<h4>'+esc(t('Scores'))+'</h4><p class="hint">'+esc(t('Leave a box empty for someone who was absent.'))+'</p>';
    h+=kids.length ? '<div id="schScores">'+kids.map(function(s){ var v=r.scores && s.id in r.scores ? r.scores[s.id] : '';
      return '<div class="schScoreRow">'+schFace_(s)+'<label for="scsc_'+esc(s.id)+'">'+esc(schName_(s))+'</label><input type="number" id="scsc_'+esc(s.id)+'" data-scscore="'+esc(s.id)+'" min="0" step="0.5" inputmode="decimal" value="'+esc(v)+'"><span class="hint">/ '+esc(r.outOf||'')+'</span></div>'; }).join('')+'</div>'
      : '<p class="sub">'+esc(t('No students in this class yet.'))+'</p>';
    if(r.id){
      var test=schById_(d.data.tests, r.id)||{};
      h+='<h4>📷 '+esc(t('Photos of the marked papers'))+'</h4><div class="schPapers">'+(test.papers||[]).map(function(pid){ var img=S.schPhotos && S.schPhotos[pid];
        return '<div class="schPaper">'+(img ? '<img src="data:image/jpeg;base64,'+esc(img)+'" alt="">' : '<button class="btn ghost" data-scpaper="'+esc(pid)+'">'+esc(t('Show'))+'</button>')+'<button class="gptX" data-scpaperrm="'+esc(pid)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+'</div>'+
        ((test.papers||[]).length<6 ? '<label class="btn ghost schPhotoBtn" for="schPaperIn">📷 '+esc(t('Add a photo'))+'</label><input type="file" id="schPaperIn" accept="image/*" capture="environment" style="display:none">' : '');
    }
  }
  else if(k==='payment'){
    var stOpts=d.data.students.filter(function(s){ return s.status!=='left' || s.id===r.studentId; }).sort(function(a,b){ return schName_(a).localeCompare(schName_(b)); }).map(function(s){ return [s.id, schName_(s)+' · '+((schClass_(s.classId)||{}).name||'')]; });
    h+=schFieldHtml_(['studentId',t('Student'),'select',[['','—']].concat(stOpts)], r)+schFieldHtml_(['amount',t('Amount (US$)'),'number','min="0" step="0.25" inputmode="decimal"'], r)+
      schFieldHtml_(['date',t('Paid on'),'date','max="'+today+'"'], r)+schFieldHtml_(['method',t('How'),'select',SCH_METHODS.map(function(x){ return [x[0], t(x[1])]; })], r);
    var st=d.data.settings;
    if(st.fee.per==='term' && st.terms.length) h+=schFieldHtml_(['period',t('For'),'select',st.terms.map(function(x){ return [x.id, x.name]; })], r);
    else h+=schFieldHtml_(['period',t('For the month'),'month'], r);
    h+=schFieldHtml_(['note',t('Note'),'text','maxlength="200"'], r);
  }
  else if(k==='event'){
    h+=schFieldHtml_(['title',t('What'),'text','maxlength="80"'], r)+schFieldHtml_(['kind',t('Kind'),'select',[['party',t('Party')],['competition',t('Competition')],['other',t('Other')]]], r)+
      schFieldHtml_(['date',t('Day'),'date'], r)+schFieldHtml_(['notes',t('Notes'),'area',300], r);
  }
  h+='<div class="schBtnRow"><button class="btn" id="schFormSave"'+(S.schBusy?' disabled':'')+'>'+esc(t('Save'))+'</button><button class="btn ghost" id="schFormCancel">'+esc(t('Cancel'))+'</button></div>';
  if(r.id && k!=='student' && k!=='payment') h+='<button class="linkbtn danger" data-scdel="'+k+'|'+esc(r.id)+'">'+esc(t('Delete'))+'</button>';
  return h+'</div>';
}
/* ---------- photos: taken on the phone, made small here ---------- */
function schShrink_(file, max, cb){
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var w=img.width, h=img.height, k=Math.min(1, max/Math.max(w,h)); w=Math.round(w*k); h=Math.round(h*k);
      var cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h);
      var q=0.75, data=cv.toDataURL('image/jpeg', q).split(',')[1];
      while(data.length>390*1024 && q>0.3){ q-=0.1; data=cv.toDataURL('image/jpeg', q).split(',')[1]; }
      cb(data, photoThumbOf_(img));
    };
    img.onerror=function(){ showMsg(t('That photo couldn’t be read.')); };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
function schPhotoGet_(id){
  if((S.schPhotos=S.schPhotos||{})[id] || (S.schPhotoAsk=S.schPhotoAsk||{})[id]) return;
  S.schPhotoAsk[id]=true;
  run('schoolPhotoGet',[S.auth.user,S.auth.pin,schScope_(),id],function(d){ if(d && d.ok){ S.schPhotos[id]=d.data; render(); } }, function(){ S.schPhotoAsk[id]=false; });
}
/* ---------- binding ---------- */
function schGo_(page){ S.schPage=page; render(); window.scrollTo(0,0); }
function bindSchool_(){
  if(S.view!=='ministry' || !isSchoolMinistry_(S.mmBrowseDept, S.mmBrowseMinistry)) return;
  if(!S.sch || S.sch.key!==schKey_()){ S.schPage=null; S.schForm=null; S.schSet=null; schLoad_(); return; }
  var rt=document.getElementById('schRetry'); if(rt) rt.onclick=function(){ schLoad_(); render(); };
  var d=schD_(); if(!d) return;
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  on('schBack', function(){ gpTap(); var pg=S.schPage||''; S.schForm=null; S.schSet=null;
    S.schPage = (pg.indexOf('report:')===0) ? 'student:'+pg.slice(7) : (pg==='form' && S.schFormFrom) ? S.schFormFrom : null; S.schFormFrom=null; render(); window.scrollTo(0,0); });
  document.querySelectorAll('#schSetupGo').forEach(function(b){ b.onclick=function(){ gpTap(); S.schSet=null; schGo_('setup'); }; });
  // Today
  document.querySelectorAll('[data-scrollclass]').forEach(function(b){ b.onclick=function(){ gpTap(); S.schRoll.classId=b.getAttribute('data-scrollclass'); S.schRoll.marks=null; render(); }; });
  var rd=document.getElementById('schRollDate'); if(rd) rd.onchange=function(){ if(!rd.value) return; S.schRoll.date=rd.value; S.schRoll.marks=null; render(); };
  document.querySelectorAll('[data-scmark]').forEach(function(b){ b.onclick=function(){ gpTap(); var id=b.getAttribute('data-scmark'), R=S.schRoll; R.marks[id]=SCH_MARK_NEXT[R.marks[id]||'p']; render(); }; });
  on('schRollSave', function(){ gpTap(); schSaveRoll_(); });
  // Students
  var fd=document.getElementById('schFind'); if(fd) fd.oninput=function(){ S.schFind=fd.value; var pos=fd.selectionStart; render(); var n=document.getElementById('schFind'); if(n){ n.focus(); try { n.setSelectionRange(pos,pos); } catch(e){} } };
  document.querySelectorAll('[data-scclassf]').forEach(function(b){ b.onclick=function(){ gpTap(); S.schClassF=b.getAttribute('data-scclassf'); render(); }; });
  document.querySelectorAll('[data-scstu]').forEach(function(b){ b.onclick=function(){ gpTap(); var id=b.getAttribute('data-scstu'); var s=schStudent_(id); if(s && s.hasPhoto) schPhotoGet_(id); schGo_('student:'+id); }; });
  on('schAddStu', function(){ gpTap(); S.schFormFrom=null; schOpenForm_('student', { kh:'', en:'', classId:S.schClassF || (d.data.classes[0]||{}).id || '', start:schToday_(), fee:{ mode:'full' } }); });
  var pin=document.getElementById('schPhotoIn');
  if(pin) pin.onchange=function(){ var f=pin.files && pin.files[0]; if(!f) return; var sid=S.schPage.slice(8); showMsg(t('Uploading photo…'));
    schShrink_(f, 480, function(data, thumb){ schCall_('schoolPhoto',['student', sid, data, thumb], t('Photo saved ✓'), function(){ (S.schPhotos=S.schPhotos||{})[sid]=data; }); }); };
  document.querySelectorAll('[data-scfaith]').forEach(function(cb){ cb.onchange=function(){
    var s=schStudent_(S.schPage.slice(8)); if(!s) return; var f=Object.assign({}, s.faith||{}); f[cb.getAttribute('data-scfaith')]=cb.checked ? schToday_() : '';
    schCall_('schoolSave',['student', Object.assign({}, s, { faith:f })], t('Saved')); }; });
  document.querySelectorAll('[data-scfaithdate]').forEach(function(inp){ inp.onchange=function(){
    var s=schStudent_(S.schPage.slice(8)); if(!s || !inp.value) return; var f=Object.assign({}, s.faith||{}); f[inp.getAttribute('data-scfaithdate')]=inp.value;
    schCall_('schoolSave',['student', Object.assign({}, s, { faith:f })], t('Saved')); }; });
  document.querySelectorAll('[data-screport]').forEach(function(b){ b.onclick=function(){ gpTap(); S.schReportRange=null; schGo_('report:'+b.getAttribute('data-screport')); }; });
  document.querySelectorAll('[data-scterm]').forEach(function(b){ b.onclick=function(){ var v=b.getAttribute('data-scterm').split('|'); S.schReportRange={ from:v[0], to:v[1] }; render(); }; });
  ['schRepFrom','schRepTo'].forEach(function(id){ var el=document.getElementById(id); if(el) el.onchange=function(){ var r=schReportRange_(); if(!el.value) return; S.schReportRange={ from:id==='schRepFrom' ? el.value : r.from, to:id==='schRepTo' ? el.value : r.to }; render(); }; });
  on('schPrint', function(){ document.body.classList.add('schPrintOn'); try { window.print(); } catch(e){} setTimeout(function(){ document.body.classList.remove('schPrintOn'); }, 500); });
  // Tests
  on('schAddTest', function(){ gpTap(); S.schFormFrom=null; var c=d.data.classes[0]; schOpenForm_('test', { classId:(S.schClassF || (c||{}).id || ''), subject:'', date:schToday_(), outOf:'', scores:{} }); });
  document.querySelectorAll('[data-scscore]').forEach(function(inp){ inp.oninput=function(){ var F=S.schForm; if(!F) return; F.rec.scores=F.rec.scores||{}; var k=inp.getAttribute('data-scscore'); if(inp.value==='') delete F.rec.scores[k]; else F.rec.scores[k]=inp.value; }; });
  var ppi=document.getElementById('schPaperIn');
  if(ppi) ppi.onchange=function(){ var f=ppi.files && ppi.files[0]; if(!f) return; var tid=S.schForm.rec.id; showMsg(t('Uploading photo…'));
    schShrink_(f, 1400, function(data){ schCall_('schoolPhoto',['paper', tid, data], t('Photo saved ✓'), function(r){ (S.schPhotos=S.schPhotos||{})[r.photoId]=data; }); }); };
  document.querySelectorAll('[data-scpaper]').forEach(function(b){ b.onclick=function(){ schPhotoGet_(b.getAttribute('data-scpaper')); }; });
  document.querySelectorAll('[data-scpaperrm]').forEach(function(b){ b.onclick=function(){ if(!gpAsk_(t('Take this photo off?'))) return; schCall_('schoolPhoto',['paper', S.schForm.rec.id, null, null, b.getAttribute('data-scpaperrm')], t('Saved')); }; });
  // Payments
  var per=document.getElementById('schPeriod'); if(per) per.onchange=function(){ S.schPeriod=per.value; render(); };
  on('schAddPay', function(){ gpTap(); S.schFormFrom=null; schOpenForm_('payment', schPayDraft_('')); });
  document.querySelectorAll('[data-scpayfor]').forEach(function(b){ b.onclick=function(){ gpTap(); S.schFormFrom=S.schPage; schOpenForm_('payment', schPayDraft_(b.getAttribute('data-scpayfor'))); }; });
  document.querySelectorAll('[data-screceipt]').forEach(function(b){ b.onclick=function(){ gpTap(); S.schFormFrom=null; schGo_('receipt:'+b.getAttribute('data-screceipt')); }; });
  // Dashboard / events
  on('schAddEvent', function(){ gpTap(); S.schFormFrom=null; schOpenForm_('event', { title:'', kind:'party', date:schToday_(), notes:'' }); });
  // Set up
  on('schAddLoc', function(){ gpTap(); S.schFormFrom='setup'; schOpenForm_('location', { name:'', notes:'' }); });
  on('schAddClass', function(){ gpTap(); S.schFormFrom='setup'; schOpenForm_('class', { name:'', locationId:(d.data.locations[0]||{}).id||'', teacherId:'', teacherName:'', days:[], time:'', end:'' }); });
  var st=S.schSet;
  if(st){
    var sv=function(id, fn){ var el=document.getElementById(id); if(el) el.oninput=el.onchange=function(){ fn(el.value); }; };
    sv('scs_fee', function(v){ st.fee.amount=v; }); sv('scs_per', function(v){ st.fee.per=v; }); sv('scs_pass', function(v){ st.passMark=v; });
    document.querySelectorAll('[data-scterm-f]').forEach(function(el){ el.oninput=el.onchange=function(){ var v=el.getAttribute('data-scterm-f').split('|'); st.terms[Number(v[0])][v[1]]=el.value; }; });
    document.querySelectorAll('[data-sctermrm]').forEach(function(b){ b.onclick=function(){ st.terms.splice(Number(b.getAttribute('data-sctermrm')),1); render(); }; });
    on('schAddTerm', function(){ var today=schToday_(); st.terms.push({ name:'', from:today, to:schAddDays_(today, 90) }); render(); });
    on('schSaveSettings', function(){ gpTap(); schCall_('schoolSave',['settings', st], t('Saved ✓'), function(r){ S.schSet=JSON.parse(JSON.stringify(r.data.settings)); }); });
  }
  // the form
  document.querySelectorAll('[data-scedit]').forEach(function(b){ b.onclick=function(){
    var v=b.getAttribute('data-scedit').split('|'), list={ location:'locations', class:'classes', student:'students', test:'tests', event:'events' }[v[0]];
    var rec=schById_(d.data[list], v[1]); if(!rec) return; gpTap();
    S.schFormFrom=S.schPage; schOpenForm_(v[0], JSON.parse(JSON.stringify(rec)));
    if(v[0]==='test') (rec.papers||[]).forEach(function(p){ schPhotoGet_(p); });
  }; });
  var F=S.schForm;
  if(F && S.schPage==='form'){
    document.querySelectorAll('[data-scf]').forEach(function(el){ el.oninput=el.onchange=function(e){
      var k=el.getAttribute('data-scf'); F.rec[k]=el.value;
      if(e && e.type==='change' && (k==='classId' && F.kind==='test' || k==='status' || k==='outOf')) render();
    }; });
    document.querySelectorAll('[data-scfee]').forEach(function(el){ el.oninput=el.onchange=function(e){ F.rec.fee=F.rec.fee||{ mode:'full' }; F.rec.fee[el.getAttribute('data-scfee')]=el.value; if(e && e.type==='change' && el.getAttribute('data-scfee')==='mode') render(); }; });
    document.querySelectorAll('[data-scday]').forEach(function(b){ b.onclick=function(){ var n=Number(b.getAttribute('data-scday')), ds=F.rec.days=F.rec.days||[], i=ds.indexOf(n); if(i>-1) ds.splice(i,1); else ds.push(n); render(); }; });
    on('schFormCancel', function(){ S.schForm=null; S.schPage=S.schFormFrom||null; S.schFormFrom=null; render(); });
    on('schFormSave', function(){
      gpTap();
      var rec=F.rec;
      if(F.kind==='student' && !String(rec.kh||'').trim() && !String(rec.en||'').trim()){ showMsg(t('Add a name first.')); return; }
      if(F.kind==='test'){ var sc={}; Object.keys(rec.scores||{}).forEach(function(k){ if(rec.scores[k]!=='' && rec.scores[k]!=null){ var n=Number(rec.scores[k]); if(isFinite(n)) sc[k]=n; } });
        var over=Object.keys(sc).filter(function(k){ return sc[k]>Number(rec.outOf) || sc[k]<0; });
        if(over.length){ showMsg(gpT('{n} scores are more than the test is out of.',{n:over.length})); return; }
        rec=Object.assign({}, rec, { scores:sc }); }
      var back=S.schFormFrom;
      schCall_('schoolSave',[F.kind, rec], t('Saved ✓'), function(r){
        S.schForm=null; S.schFormFrom=null;
        if(F.kind==='student' && !F.rec.id && r.saved) S.schPage='student:'+r.saved;
        else if(F.kind==='payment' && r.saved) S.schPage='receipt:'+r.saved;
        else S.schPage=back||null;
        if(F.kind==='test' && !F.rec.id && r.saved && typeof gpConfetti==='function') try { gpConfetti(); } catch(e){}
      });
    });
  }
  document.querySelectorAll('[data-scdel]').forEach(function(b){ b.onclick=function(){
    var v=b.getAttribute('data-scdel').split('|');
    if(!gpAsk_(t('Delete this for good?'))) return;
    var from=S.schFormFrom;
    schCall_('schoolDelete',[v[0], v[1]], t('Deleted'), function(){ S.schForm=null; S.schFormFrom=null; S.schPage=(v[0]==='location'||v[0]==='class') ? 'setup' : (v[0]==='test'||v[0]==='event'||v[0]==='student'||v[0]==='payment') ? (from && from.indexOf('student:')===0 && v[0]!=='student' ? from : null) : null; });
  }; });
  bindPeoplePick_();
}
function schPayDraft_(sid){
  var d=schD_(), st=d.data.settings, s=sid ? schStudent_(sid) : null, period=schCurPeriod_();
  var due=s ? (s.fee && s.fee.mode==='discount' ? Number(s.fee.amount)||0 : s.fee && s.fee.mode==='free' ? 0 : Number(st.fee.amount)||0) : '';
  if(s){ var paid=d.data.payments.filter(function(p){ return p.studentId===s.id && p.period===period; }).reduce(function(a,p){ return a+p.amount; },0); due=Math.max(0, Math.round((due-paid)*100)/100) || ''; }
  return { studentId:sid||'', amount:due, date:schToday_(), method:'cash', period:period, note:'' };
}
