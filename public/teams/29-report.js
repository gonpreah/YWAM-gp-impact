/* ==================== The quarterly report, ministry by ministry (Nov 2026, Uriah) ====================
   "Automatically feed information to a quarterly report that we can give to ministries and donors, the
   government Ministry, and to donors." The board's Report tab (boardReportHtml_, 03-library-org.js) is one
   page of figures; this is the document behind it (S.view='qreport', qrHtml_ / bindReport_):
     - a cover (YWAM GP or a campus, the quarter and its dates, headline figures, the leadership team, a
       letter from leadership), then a page per department and per ministry: what the ministry is for, who
       leads it and how many serve, the Scorecard (every metric: this quarter by its own sum / latest /
       average rule, last quarter with ▲/▼, year to date), what its tool counted, Priorities this quarter,
       and what the ministry wrote — Highlights, A story, Challenges, Prayer and needs;
     - three audiences (S.qr.aud): 'min' our ministries (everything), 'donor' (stories first; no challenges,
       money, health or priorities), 'gov' (Khmer by default, counts, staff Khmer / international; a tick the
       person makes themselves leaves the faith numbers out);
     - three languages (S.qr.lang): English, Khmer, or both side by side — qrD_ renders a string in a NAMED
       language by running the ordinary t() / gpT() with LANG switched for that one call (qrIn_), so t()
       itself is unchanged and tests/test-khmer.mjs still sees every string.
   One getQuarterReport per campus and quarter (S.qr.data); every figure is rolled up HERE with rollup.js
   (gpRollup on the rows the server sent) — no roll-up rule is written twice. Nothing about a person is in
   it but the names of leaders. Typing is kept across redraws and on the phone until it is sent
   (gp-qr-draft). Printing: body.qrOn's print rules in teams.css (A4, a page per department). */
var QR_KEY='gp-qr', QR_DRAFT_KEY='gp-qr-draft', QR_TEXT_MAX=1200, QR_LETTER_MAX=3000, QR_YEAR_FROM=2024;
var QR_NEVER=SENSITIVE.concat(['Staff Debt ($)']);   // never printed, whatever the audience (api.js QR_NEVER)
var QR_FAITH=/salvation|baptis|gospel|healing|discipl|church|prayer|testimon|worship|bible|evangel|congregation/i;
var QR_FIELDS=[['highlights','Highlights'],['story','A story'],['challenges','Challenges'],['needs','Prayer and needs']];
var QR_AUDS=[['min','Our ministries'],['donor','Donors'],['gov','Government']];
var QR_LANGS=[['en','English'],['km','ខ្មែរ'],['both','Both']];
S.qr=null; S.qstory=S.qstory||null;

/* ---------- a string in a named language ---------- */
function qrIn_(lang, fn){ var was=LANG; LANG=lang; try { return fn(); } finally { LANG=was; } }
function qrLang_(){ return (S.qr && S.qr.lang) || (LANG==='km' ? 'km' : 'en'); }
/* fn returns plain text through t() / gpT(); out comes escaped HTML in the report's language(s) */
function qrD_(fn){
  var lang=qrLang_();
  if(lang!=='both') return esc(qrIn_(lang, fn));
  var en=qrIn_('en', fn), km=qrIn_('km', fn);
  return en===km ? esc(en) : '<span class="qrBi"><span lang="en">'+esc(en)+'</span><span lang="km">'+esc(km)+'</span></span>';
}

/* ---------- who, and the choices ---------- */
function qrAuth_(){ return S.board ? S.boardAuth : S.auth; }
function qrFull_(){ return !!(S.board || (S.me && !S.guest && !S.student && (S.me.isAdmin || S.me.dept===BL_DEPT || bdSeat_()))); }   // a staff member on the Advisory Board reads it all too
function qrAnyCampus_(){ return !!(S.board || (S.me && (S.me.isAdmin || bdSeat_()))); }
function qrCan_(){ return !!(S.me && !S.student && !S.stuPreview && !S.demo && (S.board || !S.guest)); }
/* ☰ and search: the whole report for those who may open it, and for a ministry's leader their own page */
function qrMenu_(){ return qrCan_() && (qrFull_() || ((S.me.leads||[]).length>0)); }
function qrS_(){
  if(S.qr) return S.qr;
  var k={}; try { k=JSON.parse(lsGet(QR_KEY)||'{}')||{}; } catch(e){}
  var ids=CAMPUSES.map(function(c){ return c.id; }), mine=ids.indexOf(S.me && S.me.campus)>-1 ? S.me.campus : ids[0];
  S.qr={ campus: qrAnyCampus_() && (k.campus==='all' || ids.indexOf(k.campus)>-1) ? k.campus : mine,
    year:thisWeekYear(), q:qOf(thisWeek())+1,
    aud: (k.aud==='donor' || (k.aud==='gov' && !S.board)) ? k.aud : 'min',
    lang: ['en','km','both'].indexOf(k.lang)>-1 ? k.lang : (LANG==='km' ? 'km' : 'en'),
    noFaith:false,   // never remembered: it is off until the person ticks it, each time
    govMore:!!k.govMore, only:null, edit:null, draft:null, data:{}, loading:{}, err:{}, busy:false };
  return S.qr;
}
function qrKeep_(){ var Q=qrS_(); lsSet(QR_KEY, JSON.stringify({ campus:Q.campus, aud:Q.aud, lang:Q.lang, govMore:Q.govMore })); }
function qrOpen_(o){
  if(!qrCan_()) return;
  var Q=qrS_(); o=o||{};
  if(o.campus) Q.campus=o.campus;
  if(o.year){ Q.year=o.year; Q.q=o.q; }
  Q.only=o.only||null; Q.edit=null; Q.draft=null;
  if(o.edit) qrEdit_(o.edit.campus, o.edit.key);
  S.qrFrom=o.from||S.view; S.menuOpen=false; S.view='qreport'; S.person=null;
  render(); window.scrollTo(0,0);
}
function qrCampuses_(){ var Q=qrS_(); return Q.campus==='all' ? CAMPUSES.map(function(c){ return c.id; }) : [Q.campus]; }
function qrKey_(c){ var Q=qrS_(); return c+'|'+Q.year+'|'+Q.q; }
function qrData_(c){ return qrS_().data[qrKey_(c)] || null; }
function qrLoad_(){
  var Q=qrS_(), a=qrAuth_(); if(!a || !a.user) return;
  qrCampuses_().forEach(function(c){
    var k=qrKey_(c); if(Q.data[k] || Q.loading[k] || Q.err[k]) return;
    Q.loading[k]=1;
    run('getQuarterReport',[a.user,a.pin,c,Q.year,Q.q],function(d){
      delete Q.loading[k];
      if(d && d.ok) Q.data[k]=d; else Q.err[k]=(d && d.err) || 'failed';
      if(S.view==='qreport') render();
    }, function(e){ delete Q.loading[k]; Q.err[k]=(e && e.message) || 'failed'; if(S.view==='qreport') render(); });
  });
}

/* ---------- the roll-ups: rollup.js on the rows the server sent ---------- */
function qrRolls_(ids){
  var e={}, p={}, y={}, mix=[], full=true, hi=52;
  ids.forEach(function(c){
    var d=qrData_(c); e[c]=d.entries||{}; p[c]=d.prev||{}; hi=d.weeks[1];
    var cut={};   // the year so far, to the end of this quarter: the same rows with later weeks left out
    Object.keys(e[c]).forEach(function(k){ var o={}; Object.keys(e[c][k]).forEach(function(w){ if(Number(w)<=hi) o[w]=e[c][k][w]; }); cut[k]=o; });
    y[c]=cut;
    if(d.mix) mix=mix.concat(d.mix); else full=false;
  });
  return { R:gpRollup({ entries:e, roster:full ? mix : null, week:hi }), Y:gpRollup({ entries:y, week:hi }), P:gpRollup({ entries:p, week:52 }), q0:qrS_().q-1 };
}
function qrVals_(X, c, dept, min, metric){
  return { now:X.R.ministryRollup([c], dept, [min], metric, X.q0),
    before: X.q0>0 ? X.R.ministryRollup([c], dept, [min], metric, X.q0-1) : X.P.ministryRollup([c], dept, [min], metric, 3),
    ytd:X.Y.ministryRollup([c], dept, [min], metric) };
}
function qrPrevLabel_(){ var Q=qrS_(); return Q.q>1 ? 'Q'+(Q.q-1) : 'Q4 '+(Q.year-1); }
function qrIsMoney_(metric){ return metric.indexOf('($)')>-1; }
function qrFaithOff_(){ var Q=qrS_(); return Q.aud==='gov' && Q.noFaith; }
function qrMetricShown_(metric){
  if(QR_NEVER.indexOf(metric)>-1) return false;
  if(qrIsMoney_(metric) && qrS_().aud!=='min') return false;   // money is for our own ministries
  if(qrFaithOff_() && QR_FAITH.test(metric)) return false;
  return true;
}

/* THE ONE PLACE this report reads a ministry's priorities for the quarter: its rocks (28-rocks.js), with where each stands.
   A ministry's page gets that ministry's; a department's page (ministry null) the department's own. */
function qrPrioritiesFor_(campus, dept, ministry, year, q){
  if(typeof rocksAll_!=='function') return [];
  return rocksAll_().filter(function(r){ return r.campus===campus && r.dept===dept && (r.ministry||'')===(ministry||'') && Number(r.year)===Number(year) && Number(r.q)===Number(q); })
    .map(function(r){ return { text:r.title, st:r.status||'on' }; });
}

/* ---------- drafts: what is typed stays on the phone until it is sent ---------- */
function qrDrafts_(){ try { return JSON.parse(lsGet(QR_DRAFT_KEY)||'{}')||{}; } catch(e){ return {}; } }
function qrDraftId_(c, key){ var Q=qrS_(); return c+'|'+Q.year+'|'+Q.q+'|'+key; }
function qrDraftGet_(c, key){ return qrDrafts_()[qrDraftId_(c, key)] || null; }
function qrDraftSet_(c, key, v){ var all=qrDrafts_(), id=qrDraftId_(c, key); if(v) all[id]=v; else delete all[id]; lsSet(QR_DRAFT_KEY, JSON.stringify(all)); }
function qrEdit_(c, key){
  var Q=qrS_(), d=qrData_(c), kept=qrDraftGet_(c, key), v={};
  if(key==='@letter') v.letter=kept ? kept.letter||'' : ((d && d.letter && d.letter.text) || '');
  else { var st=(d && d.stories && d.stories[key]) || {}; QR_FIELDS.forEach(function(f){ v[f[0]]=kept ? kept[f[0]]||'' : st[f[0]]||''; }); }
  Q.edit={ campus:c, key:key }; Q.draft=v;
}
function qrMayWrite_(d, key){ return !!(d && d.can && (d.can.write==='all' || (d.can.write||[]).indexOf(key)>-1)); }

/* ---------- small pieces ---------- */
function qrText_(s){ return esc(String(s||'')).replace(/\n/g,'<br>'); }
function qrNum_(v, metric){ return v===null || v===undefined ? '—' : fmt(v, metric); }
function qrBlock_(cls, titleHtml, body){ return body ? '<div class="qrBlock '+cls+'"><h4>'+titleHtml+'</h4>'+body+'</div>' : ''; }
function qrFact_(labelHtml, value){ return '<div class="qrFact"><span>'+labelHtml+'</span><b>'+value+'</b></div>'; }
function qrCampusLine_(ids){ return ids.map(function(c){ return qrD_(function(){ return t(campusName(c)); }); }).join(' · '); }
function qrAudLine_(){
  var a=qrS_().aud;
  return a==='donor' ? qrD_(function(){ return t('For our partners and donors'); }) : a==='gov' ? qrD_(function(){ return t('Report of activities'); }) : qrD_(function(){ return t('For our ministries'); });
}

/* ---------- what each tool counted this quarter ---------- */
function qrToolItems_(c, dept, min, X){
  var d=qrData_(c), T=(d.tools||{})[dept+'|'+min], items=[], lines=[];
  var add=function(fn, v, faith){ if(v===null || v===undefined || v==='') return; items.push({ label:qrD_(fn), value:esc(String(v)), faith:!!faith }); };
  var roll=function(metric){ var v=X.R.ministryRollup([c], dept, [min], metric, X.q0); return v===null ? null : fmt(v, metric); };
  if(T && T.kind==='school'){
    add(function(){ return t('Students enrolled'); }, T.students);
    (T.byLocation||[]).forEach(function(l){ if(l.name) items.push({ label:'↳ '+esc(l.name), value:String(l.n) }); });
    add(function(){ return t('Days with classes'); }, T.classDays);
    add(function(){ return t('Attendance'); }, T.attendance===null ? null : T.attendance+'%');
    add(function(){ return t('Tests given'); }, T.tests);
    add(function(){ return t('Pass rate'); }, T.passRate===null ? null : T.passRate+'%');
    add(function(){ return t('New salvations'); }, T.salvations, true);
    add(function(){ return t('Baptisms'); }, T.baptisms, true);
  } else if(T && T.kind==='teams'){
    add(function(){ return t('Teams hosted'); }, T.teams);
    add(function(){ return t('People who came'); }, T.people);
    add(function(){ return t('Countries'); }, (T.countries||[]).length ? T.countries.length+' · '+T.countries.join(', ') : null);
    (T.list||[]).forEach(function(x){ lines.push(esc(x.name)+(x.country ? ' ('+esc(x.country)+')' : '')+(x.size ? ' · '+qrD_(function(){ return gpT('{n} people',{n:x.size}); }) : '')); });
  } else if(T && T.kind==='icp'){
    add(function(){ return t('Wednesdays held'); }, T.wedsHeld, true);
    add(function(){ return t('Prayer gatherings in the fast'); }, T.gatheringsHeld || null, true);
    add(function(){ return t('Hours in prayer'); }, T.hours, true);
    add(function(){ return t('Ministries covered in prayer'); }, T.ministries, true);
    add(function(){ return t('Answered-prayer testimonies'); }, T.testimonies, true);
    (T.fasts||[]).forEach(function(f){ items.push({ label:'🍞 '+esc(f.title)+' · '+qrD_(function(){ return gpT('{n} days',{n:f.days}); }), value:qrD_(function(){ return gpT('{n} joined',{n:f.joined}); }), faith:true }); });
  } else if(T && T.kind==='worship'){
    add(function(){ return t('Services held'); }, T.held, true);
    add(function(){ return t('Average attendance'); }, T.avg, true);
    add(function(){ return t('Musicians in training'); }, T.training);
    add(function(){ return t('Songs written'); }, T.songsWritten);
  } else if(T && T.kind==='hosp'){
    add(function(){ return t('Guest nights hosted'); }, T.guestNights);
    add(function(){ return t('Teams housed'); }, T.teams);
    add(function(){ return t('Guests and speakers'); }, T.guests);
  }
  if(dept==='Leadership Development' && min==='GPDTS' && autoMetricsFor(c, dept, min).length>0){   // GPDTS counts its students itself; the outreach weeks come from its Database
    add(function(){ return t('Students applied'); }, roll('Students Applied'));
    add(function(){ return t('Students accepted'); }, roll('Students Accepted'));
    add(function(){ return t('Students here'); }, roll('Students Enrolled'));
    add(function(){ return t('Students graduated'); }, roll('Students Graduated'));
    if(T && T.kind==='dts'){
      add(function(){ return t('Outreach teams sent'); }, T.outreachTeams);
      add(function(){ return t('Outreach places'); }, (T.places||[]).join(', ') || null);
      add(function(){ return t('People reached on outreach'); }, T.reached || null, true);
      add(function(){ return t('Salvations on outreach'); }, T.salvations || null, true);
      add(function(){ return t('Healings on outreach'); }, T.healings || null, true);
      add(function(){ return t('Heard the gospel on outreach'); }, T.gospel || null, true);
    }
  }
  if(dept==='Community Service' && min==='Cafe' && roll('Days Open')!==null){   // the till's own counts, no money
    add(function(){ return t('Days open'); }, roll('Days Open'));
    add(function(){ return t('Cups sold'); }, roll('Cups Sold'));
    add(function(){ return t('Customers served'); }, roll('Customers Served'));
    add(function(){ return t('Gospel conversations'); }, roll('Gospel Conversations'), true);
  }
  if(qrFaithOff_()) items=items.filter(function(x){ return !x.faith; });
  if(!items.length) return '';
  return '<div class="qrFacts">'+items.map(function(x){ return qrFact_(x.label, x.value); }).join('')+'</div>'+
    (lines.length ? '<ul class="qrList">'+lines.map(function(l){ return '<li>'+l+'</li>'; }).join('')+'</ul>' : '');
}

/* ---------- the Scorecard: every metric of the ministry, by its own rule ---------- */
function qrScoreHtml_(c, dept, min, metrics, X){
  var Q=qrS_(), rows='';
  metrics.filter(qrMetricShown_).forEach(function(metric){
    var v=qrVals_(X, c, dept, min, metric);
    if(v.now===null && v.before===null && v.ytd===null) return;
    rows+='<tr><th scope="row">'+qrD_(function(){ return t(metric); })+'</th>'+
      '<td><b>'+qrNum_(v.now, metric)+'</b>'+trendBadge(pctChange(v.before, v.now), !LOWER_BETTER[metric])+'</td>'+
      '<td>'+qrNum_(v.before, metric)+'</td><td>'+qrNum_(v.ytd, metric)+'</td></tr>';
  });
  if(!rows) return '<p class="qrNone">'+qrD_(function(){ return t('No numbers were entered this quarter.'); })+'</p>';
  return '<table class="qrTbl"><thead><tr><th scope="col">'+qrD_(function(){ return t('What we count'); })+'</th><th scope="col">Q'+Q.q+'</th>'+
    '<th scope="col">'+esc(qrPrevLabel_())+'</th><th scope="col">'+qrD_(function(){ return t('Year to date'); })+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

/* ---------- what the ministry wrote, by audience ---------- */
function qrStoryFields_(){
  var Q=qrS_();
  if(Q.aud==='min') return ['highlights','story','challenges','needs'];
  if(Q.aud==='donor') return ['story','highlights','needs'];
  return Q.govMore ? ['highlights','story','needs'] : ['highlights'];
}
function qrFieldName_(id){ return QR_FIELDS.filter(function(f){ return f[0]===id; })[0][1]; }
function qrStoryHtml_(st){
  if(!st) return '';
  return qrStoryFields_().map(function(f){
    return st[f] ? '<div class="qrBlock qrStory" data-qrstory="'+f+'"><h4>'+qrD_(function(){ return t(qrFieldName_(f)); })+'</h4><p>'+qrText_(st[f])+'</p></div>' : '';
  }).join('');
}
function qrCountHtml_(id, v, max){ return '<div class="qrCount" data-qrn="'+id+'">'+String(v||'').length+' / '+max+'</div>'; }
function qrFormHtml_(c, key){
  var Q=qrS_(), v=Q.draft||{}, letter=key==='@letter';
  var h='<div class="qrForm noPrint" id="qrForm"><h4>✍️ '+esc(letter ? t('A letter from leadership') : t('Write this quarter’s story'))+'</h4>';
  if(letter) h+='<p class="hint">'+esc(t('A short letter for the front of the report: what this quarter was about, and thank you.'))+'</p>'+
    '<textarea id="qrLetterText" data-qrf="letter" rows="8" maxlength="'+QR_LETTER_MAX+'">'+esc(v.letter||'')+'</textarea>'+qrCountHtml_('letter', v.letter, QR_LETTER_MAX);
  else QR_FIELDS.forEach(function(f){
    h+='<label class="f">'+esc(t(f[1]))+'</label>'+
      (f[0]==='story' ? '<p class="hint">'+esc(t('One short story of a changed life. No child’s full name — change names where needed, and ask permission first.'))+'</p>' : '')+
      (f[0]==='challenges' ? '<p class="hint">'+esc(t('Only our own ministries read this part. Donors and the government never see it.'))+'</p>' : '')+
      '<textarea data-qrf="'+f[0]+'" rows="4" maxlength="'+QR_TEXT_MAX+'">'+esc(v[f[0]]||'')+'</textarea>'+qrCountHtml_(f[0], v[f[0]], QR_TEXT_MAX);
  });
  return h+'<p class="hint">'+esc(t('What you type is kept on this phone until it is saved.'))+'</p>'+
    '<div class="qrFormBtns"><button class="btn" id="qrSave"'+(Q.busy ? ' disabled' : '')+'>'+esc(Q.busy ? t('Saving…') : t('Save'))+'</button>'+
    '<button class="linkbtn" id="qrCancel">'+esc(t('Cancel'))+'</button></div></div>';
}
function qrWriteBtn_(c, key, has){
  var kept=qrDraftGet_(c, key), label=kept ? t('Carry on writing — a draft is kept on this phone') : key==='@letter' ? (has ? t('Change the letter') : t('Write the letter from leadership')) : (has ? t('Change this quarter’s story') : t('Write this quarter’s story'));
  return '<button class="linkbtn qrWrite noPrint" data-qrwrite="'+esc(c+'|'+key)+'">✍️ '+esc(label)+'</button>';
}

/* ---------- one ministry's page ---------- */
function qrMinHas_(c, dept, min, metrics, X){
  var d=qrData_(c), key=dept+'|'+min, p=(d.people||{})[key];
  if((p && (p.n || p.leaders.length)) || (d.stories||{})[key] || (d.tools||{})[key]) return true;
  return metrics.some(function(m){ return QR_NEVER.indexOf(m)===-1 && X.R.ministryRollup([c], dept, [min], m, X.q0)!==null; });
}
function qrMinHtml_(c, dept, min, metrics, X){
  var Q=qrS_(), d=qrData_(c), key=dept+'|'+min, p=(d.people||{})[key] || { n:0, leaders:[] }, st=(d.stories||{})[key], lang=qrLang_();
  var focus=jobFocus(dept, min), editing=Q.edit && Q.edit.campus===c && Q.edit.key===key;
  var h='<section class="qrMin" data-qrmin="'+esc(key)+'" data-qrc="'+esc(c)+'"><div class="qrMinHead"><span class="qrEmoji">'+(MIN_EMOJI[min]||'📊')+'</span>'+
    '<div><h3>'+qrD_(function(){ return t(min); })+'</h3><div class="qrSub">'+qrD_(function(){ return t(dept); })+' · '+qrD_(function(){ return t(campusName(c)); })+' · Q'+Q.q+' '+Q.year+'</div></div></div>';
  if(focus) h+='<p class="qrFocus">'+(lang==='km' ? '<small class="qrEnTag">'+qrD_(function(){ return t('English'); })+'</small> ' : '')+esc(focus)+'</p>';
  h+='<div class="qrWho">'+(p.leaders.length ? '<span>👑 '+qrD_(function(){ return gpT('Led by {names}',{names:p.leaders.join(', ')}); })+'</span>' : '')+
    (p.n ? '<span>'+qrD_(function(){ return gpT('{n} serve in this ministry',{n:p.n}); })+'</span>' : '')+'</div>';
  var score=qrBlock_('qrScore', qrD_(function(){ return t('Scorecard'); }), qrScoreHtml_(c, dept, min, metrics, X));
  var tool=qrBlock_('qrTool', qrD_(function(){ return t('This quarter in numbers'); }), qrToolItems_(c, dept, min, X));
  var story=editing ? qrFormHtml_(c, key) : qrStoryHtml_(st)+(qrMayWrite_(d, key) ? qrWriteBtn_(c, key, !!st) : '');
  var pri='';
  if(Q.aud==='min'){   // the ministry's own rocks; printed alone, its department's too (on the whole report those are on the department's page)
    var list=qrPrioritiesFor_(c, dept, min, Q.year, Q.q);
    if(Q.only) list=list.concat(qrPrioritiesFor_(c, dept, null, Q.year, Q.q));
    if(list.length) pri=qrBlock_('qrPri', qrD_(function(){ return t('Priorities this quarter'); }), qrPriList_(list));
  }
  h+=Q.aud==='donor' ? story+tool+score : score+tool+pri+story;
  if(!Q.only) h+='<button class="linkbtn noPrint qrOnlyBtn" data-qronly="'+esc(c+'|'+key)+'">📄 '+esc(t('Just this ministry'))+'</button>';
  return h+'</section>';
}
function qrPriList_(list){
  return list.length ? '<ul class="qrPriList">'+list.map(function(x){ return '<li><span>'+esc(x.text)+'</span>'+'<b>'+esc(rkMark_(x.st)+rkStName_(x.st))+'</b>'+'</li>'; }).join('')+'</ul>' : '';
}

/* ---------- the cover and a campus's own first page ---------- */
function qrFigures_(ids, X){
  var Q=qrS_(), R=X.R, P=X.P, q0=X.q0, rows=[];
  var two=function(fn){ return [fn(R, q0), q0>0 ? fn(R, q0-1) : fn(P, 3)]; };
  var row=function(labelFn, pair, noteFn, show){
    var now=pair[0], before=pair[1];
    rows.push('<div class="qrFig"><span>'+qrD_(labelFn)+(noteFn ? '<small>'+qrD_(noteFn)+'</small>' : '')+'</span><b>'+(now===null || now===undefined ? '—' : (show ? show(now) : fmt(now)))+
      (before===null || before===undefined ? '' : '<small>'+esc(qrPrevLabel_())+': '+(show ? show(before) : fmt(before))+'</small>')+'</b></div>');
  };
  row(function(){ return t('Staff'); }, [R.totalStaff(ids), null], function(){ return t('today'); });
  if(Q.aud==='gov'){
    var bd=R.staffBreakdown(ids);
    if(bd){
      row(function(){ return t('Khmer staff'); }, [bd.khmer, null]);
      row(function(){ return t('International staff'); }, [bd.international, null]);
      if(bd.noCountry) row(function(){ return t('Country not said yet'); }, [bd.noCountry, null]);
    }
  }
  if(Q.aud==='min' && ids.length===1){
    var hl=qrData_(ids[0]).health;
    if(hl) row(function(){ return t('Staff Health Score'); }, [hl.now.score, hl.prev.score],
      function(){ return hl.now.score===null ? gpT('needs {n} check-ins or more',{n:hl.minN}) : gpT('{n} check-ins',{n:hl.now.n}); }, function(v){ return v.toFixed(1)+'/10'; });
  }
  if(!qrFaithOff_()) row(function(){ return t('Salvations'); }, two(function(r, q){ return r.headlineFor(ids, 'Salvations', q); }));
  row(function(){ return t('Leadership school students'); }, two(function(r, q){ return r.ldStudents(ids, q); }));
  row(function(){ return t('Leadership school graduates'); }, two(function(r, q){ return r.ldGraduates(ids, q); }));
  row(function(){ return t('Community school students'); }, two(function(r, q){ return r.communityStudents(ids, q); }));
  row(function(){ return t('Outreach teams hosted'); }, two(function(r, q){ return r.outreachRollup(ids, 'Teams Hosted', q); }));
  return '<div class="qrFigs">'+rows.join('')+'</div>';
}
function qrCoverHtml_(ids, X){
  var Q=qrS_(), d=qrData_(ids[0]), all=ids.length>1;
  var logo=(typeof GP_LOGO==='string' && GP_LOGO) ? '<span class="qrCoin"><img src="'+GP_LOGO+'" alt=""></span>' : '';
  return '<section class="qrCover" id="qrCover">'+logo+
    '<div class="qrEyebrow">'+qrAudLine_()+'</div>'+
    '<h2>'+(all ? qrD_(function(){ return t('YWAM GP'); }) : qrD_(function(){ return t(campusName(ids[0])); }))+'</h2>'+
    '<div class="qrTitle">'+qrD_(function(){ return gpT('Quarterly report · Q{q} {year}',{q:Q.q, year:Q.year}); })+'</div>'+
    '<div class="qrDates">'+qrD_(function(){ return teamDate_(d.from); })+' – '+qrD_(function(){ return teamDate_(d.to); })+
      (d.done ? '' : ' · '+qrD_(function(){ return t('this quarter is still going'); }))+'</div>'+
    (Q.aud==='gov' ? '<div class="qrDates">'+qrD_(function(){ return t('Locations'); })+': '+qrCampusLine_(ids)+'</div>' : '')+
    qrFigures_(ids, X)+
    '<div class="qrMade">'+qrD_(function(){ return gpT('Made {date}. Staff numbers are as of today.',{date:teamDate_(todayStr())}); })+'</div></section>';
}
function qrCampusHtml_(c, X, all){
  var Q=qrS_(), d=qrData_(c), oc=orgCampus_(c), h='';
  if(all) h+='<h2 class="qrCampusName">🏠 '+qrD_(function(){ return t(campusName(c)); })+'</h2>'+qrFigures_([c], X);
  if(oc && oc.clt && oc.clt.length) h+=qrBlock_('qrClt', qrD_(function(){ return t('Campus Leadership Team'); }),
    '<div class="qrLeaders">'+oc.clt.map(function(p){ return '<div><b>'+esc(p.name)+'</b> <small>'+qrD_(function(){ return orgTitleText_(p.title); })+'</small></div>'; }).join('')+'</div>');
  var editing=Q.edit && Q.edit.campus===c && Q.edit.key==='@letter';
  if(editing) h+=qrFormHtml_(c, '@letter');
  else {
    if(d.letter) h+='<div class="qrBlock qrLetter" id="qrLetter"><h4>'+qrD_(function(){ return t('A letter from leadership'); })+'</h4><p>'+qrText_(d.letter.text)+'</p>'+
      (d.letter.byName ? '<p class="qrSign">— '+esc(d.letter.byName)+'</p>' : '')+'</div>';
    if(d.can && d.can.letter) h+=qrWriteBtn_(c, '@letter', !!d.letter);
  }
  return h ? '<section class="qrCampus'+(all ? ' qrBreak' : '')+'" data-qrcampuspage="'+esc(c)+'">'+h+'</section>' : '';
}
function qrDeptsHtml_(c, X){
  var Q=qrS_(), d=qrData_(c), deps=getDepartments(c), h='';
  Object.keys(deps).forEach(function(dept){
    if(dept===BL_DEPT) return;   // leadership's own log is not a ministry page; its team is on the campus's first page
    var mins=Object.keys(deps[dept]||{}).filter(function(m){ return qrMinHas_(c, dept, m, deps[dept][m]||[], X); });
    if(!mins.length) return;
    var info=(d.depts||{})[dept] || { n:0, directors:[] };
    var pri=Q.aud==='min' ? qrBlock_('qrPri', qrD_(function(){ return t('Priorities this quarter'); }), qrPriList_(qrPrioritiesFor_(c, dept, null, Q.year, Q.q))) : '';
    h+='<section class="qrDept" data-qrdept="'+esc(dept)+'" data-qrc="'+esc(c)+'"><div class="qrDeptHead"><h2>'+(MIN_EMOJI[dept] ? MIN_EMOJI[dept]+' ' : '')+qrD_(function(){ return t(dept); })+'</h2>'+
      '<div class="qrSub">'+qrD_(function(){ return t(campusName(c)); })+
      (info.directors.length ? ' · '+qrD_(function(){ return gpT('Director: {names}',{names:info.directors.join(', ')}); }) : '')+
      ' · '+qrD_(function(){ return gpT('{n} staff',{n:info.n}); })+' · '+qrD_(function(){ return gpT('{n} ministries',{n:mins.length}); })+'</div></div>'+pri+
      mins.map(function(m){ return qrMinHtml_(c, dept, m, deps[dept][m]||[], X); }).join('')+'</section>';
  });
  return h || '<div class="card"><p class="sub" style="margin:0">'+esc(t('No ministry has people or numbers for this quarter yet.'))+'</p></div>';
}
/* someone who is not leadership: only the ministries the server sent them */
function qrOwnHtml_(c, X){
  var d=qrData_(c), deps=getDepartments(c), h='';
  Object.keys(deps).forEach(function(dept){ if(dept===BL_DEPT) return; Object.keys(deps[dept]||{}).forEach(function(m){
    if((d.people||{})[dept+'|'+m] || (d.can.write!=='all' && (d.can.write||[]).indexOf(dept+'|'+m)>-1)) h+=qrMinHtml_(c, dept, m, deps[dept][m]||[], X);
  }); });
  return h;
}

/* ---------- the page ---------- */
function qrPickHtml_(){
  var Q=qrS_(), curY=thisWeekYear(), curQ=qOf(thisWeek())+1, h='<div class="qrPick noPrint" id="qrPick">';
  var chips=function(label, body){ return '<div class="qrPickRow"><span class="qrPickLbl">'+esc(label)+'</span><div class="deptChips">'+body+'</div></div>'; };
  if(qrAnyCampus_() && !Q.only) h+=chips(t('Campus'), CAMPUSES.map(function(c){ return '<button class="deptChip'+(Q.campus===c.id?' on':'')+'" data-qrcampus="'+c.id+'">'+esc(t(c.short))+'</button>'; }).join('')+
    '<button class="deptChip'+(Q.campus==='all'?' on':'')+'" data-qrcampus="all">🌏 '+esc(t('All of YWAM GP'))+'</button>');
  var years=''; for(var y=curY; y>=QR_YEAR_FROM; y--) years+='<option value="'+y+'"'+(y===Q.year?' selected':'')+'>'+y+'</option>';
  h+=chips(t('Quarter'), '<select id="qrYear" class="qrYear" aria-label="'+esc(t('Year'))+'">'+years+'</select>'+[1,2,3,4].map(function(i){
    return '<button class="deptChip'+(i===Q.q?' on':'')+'" data-qrq="'+i+'"'+(Q.year===curY && i>curQ ? ' disabled' : '')+'>Q'+i+'</button>'; }).join(''));
  h+=chips(t('Who is it for?'), QR_AUDS.filter(function(a){ return !(S.board && a[0]==='gov'); }).map(function(a){
    return '<button class="deptChip'+(Q.aud===a[0]?' on':'')+'" data-qraud="'+a[0]+'">'+esc(t(a[1]))+'</button>'; }).join(''));
  h+=chips(t('Language'), QR_LANGS.map(function(l){ return '<button class="deptChip'+(Q.lang===l[0]?' on':'')+'" data-qrlang="'+l[0]+'">'+esc(l[0]==='km' ? l[1] : t(l[1]))+'</button>'; }).join(''));
  if(Q.aud==='gov') h+='<label class="qrTick"><input type="checkbox" id="qrNoFaith"'+(Q.noFaith?' checked':'')+'> <span>'+esc(t('Leave out faith numbers (salvations, baptisms, gospel…)'))+'</span></label>'+
    '<label class="qrTick"><input type="checkbox" id="qrGovMore"'+(Q.govMore?' checked':'')+'> <span>'+esc(t('Also print each ministry’s story and its prayer and needs'))+'</span></label>';
  h+='<p class="hint">'+esc(Q.aud==='donor' ? t('Donors: stories first. No challenges, money, health or internal priorities.') : Q.aud==='gov' ? t('Government: what we did and who we served, in Khmer unless you choose another language. Highlights only, unless you tick more.') : t('Our ministries: everything — the numbers, priorities, and all four parts of each story.'))+'</p>';
  return h+'<button class="btn qrPrintBtn" id="qrPrint">🖨️ '+esc(t('Print or save as PDF'))+'</button></div>';
}
function qrHtml_(){
  if(!qrCan_()) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Not available'))+'</p></div>';
  var Q=qrS_(), ids=Q.only ? [Q.only.campus] : qrCampuses_();
  var back=S.board ? t('Report') : S.qrFrom==='ministry' ? t('My Ministry') : S.qrFrom==='report' ? t('The quarter report') : t('Back');
  var h='<div id="qrPage" data-qraud="'+Q.aud+'" data-qrlangnow="'+Q.lang+'">'+
    (Q.only && (qrFull_() || qrOwnCount_()>1) ? '<button class="linkbtn noPrint qrBack" id="qrAll">← '+esc(t('The whole report'))+'</button>'
      : '<button class="linkbtn noPrint qrBack" id="qrBack">← '+esc(back)+'</button>')+
    '<div class="qrHead noPrint"><h2>📄 '+esc(t('Quarterly report'))+'</h2><p class="sub">'+esc(t('A page for every ministry, filled in from what each ministry already records. Choose who it is for, then print it or save it as a PDF.'))+'</p></div>'+
    qrPickHtml_();
  var errs=ids.filter(function(c){ return Q.err[qrKey_(c)]; });
  if(errs.length) return h+'<div class="card" id="qrErr"><p class="sub" style="margin:0 0 8px">'+esc(Q.err[qrKey_(errs[0])]==='not_authorized' ? t('This report is for Campus Leadership and each ministry’s own people.') : gpT('Could not load the report ({err}).',{err:Q.err[qrKey_(errs[0])]}))+'</p>'+
    '<button class="btn" id="qrRetry">'+esc(t('Try again'))+'</button></div></div>';
  if(ids.some(function(c){ return !qrData_(c); })) return h+'<div class="card" id="qrLoading"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div></div>';
  if(qrFull_() && !S.org) orgLoad_();
  var X=qrRolls_(ids), doc='';
  if(Q.only){
    var p=Q.only.key.split('|'), deps=getDepartments(Q.only.campus);
    doc=qrMinHtml_(Q.only.campus, p[0], p[1], (deps[p[0]]||{})[p[1]]||[], X);
  } else if(!qrData_(ids[0]).full){
    doc=qrOwnHtml_(ids[0], X) || '<div class="card"><p class="sub" style="margin:0">'+esc(t('No ministry has people or numbers for this quarter yet.'))+'</p></div>';
  } else {
    doc=qrCoverHtml_(ids, X);
    ids.forEach(function(c){ doc+=qrCampusHtml_(c, X, ids.length>1)+qrDeptsHtml_(c, X); });
    if(Q.aud==='min') doc+='<p class="qrFoot">'+qrD_(function(){ return t('Health is shown only from three check-ins or more, so nobody’s answers can be picked out. Staff numbers are as of today.'); })+'</p>';
  }
  return h+'<div class="qrDoc qrAud-'+Q.aud+' qrLang-'+Q.lang+'" id="qrDoc"'+(Q.lang==='km' ? ' lang="km"' : '')+'>'+doc+'</div></div>';
}
function qrOwnCount_(){ var d=qrData_(qrS_().only ? qrS_().only.campus : qrCampuses_()[0]); return d ? Object.keys(d.people||{}).length : 0; }

/* ---------- ways in ---------- */
/* on the board's quarter report: one more button on its row */
function qrWayInHtml_(){ return qrCan_() && qrFull_() ? '<button class="deptChip" id="qrWayIn">📑 '+esc(t('Ministry by ministry'))+'</button>' : ''; }
/* on a ministry's My Ministry page, under its name */
function qrMmLinkHtml_(sel){
  if(!qrCan_() || !sel || sel.dept===BL_DEPT || S.guest) return '';
  return '<button class="linkbtn qrMmLink" data-qrmm="'+esc(sel.dept+'|'+sel.min)+'">📄 '+esc(t('This quarter’s report'))+'</button>';
}
/* the bell: a ministry I lead has nothing written for the quarter that is ending or has just ended */
function qrNotifItems_(){
  var W=S.qstory, out=[]; if(!W || !qrCan_() || S.board) return out;
  (W.keys||[]).forEach(function(k){
    var min=k.split('|')[1]; if(!min) return;
    out.push({ when:W.since||todayStr(), text:'📄 '+gpT('Write {ministry}’s story for Q{q}',{ministry:t(min), q:W.q}),
      actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-goqr="'+esc(k)+'">'+esc(t('Write it'))+'</button>' });
  });
  return out;
}
function qrGoWrite_(key){
  var W=S.qstory||{}, c=S.me.campus;
  S.bellOpen=false; if(typeof renderNotifPanel==='function') renderNotifPanel();
  var Q=qrS_(); Q.campus=c; if(W.year){ Q.year=W.year; Q.q=W.q; }
  Q.only={ campus:c, key:key }; Q.edit=null; Q.draft=null; S.qrWant={ campus:c, key:key };
  S.qrFrom=S.view==='qreport' ? S.qrFrom : S.view; S.view='qreport'; render(); window.scrollTo(0,0);
}
/* the bell's button lives in a panel drawn elsewhere (and the slide-down reminder presses it): one listener for all */
document.addEventListener('click', function(e){
  var b=e.target && e.target.closest ? e.target.closest('[data-goqr]') : null;
  if(b){ gpTap(); qrGoWrite_(b.getAttribute('data-goqr')); }
});

/* ---------- binding ---------- */
function qrSave_(){
  var Q=qrS_(), E=Q.edit, a=qrAuth_(); if(!E || Q.busy) return;
  var c=E.campus, key=E.key, k=qrKey_(c), rec=Object.assign({}, Q.draft||{});
  Q.busy=true; render();
  var fail=function(){ Q.busy=false; render(); showMsg(t('Could not save — your words are kept on this phone.')); };
  run('saveQuarterStory',[a.user,a.pin,c,Q.year,Q.q,key,rec],function(d){
    if(!d || !d.ok){ Q.busy=false; render(); showMsg(d && d.err==='not_authorized' ? t('Only the ministry’s own people can write this.') : t('Could not save — your words are kept on this phone.')); return; }
    Q.busy=false;
    var D=Q.data[k];
    if(D){ if(key==='@letter') D.letter=d.letter||null; else if(d.story) D.stories[key]=d.story; else delete D.stories[key]; }
    qrDraftSet_(c, key, null); Q.edit=null; Q.draft=null;
    if(S.qstory && S.qstory.keys && d.story) S.qstory.keys=S.qstory.keys.filter(function(x){ return x!==key; });
    render(); showMsg(t('Saved'));
  }, fail);
}
function bindReport_(){
  var w=document.getElementById('qrWayIn'); if(w) w.onclick=function(){ gpTap(); qrOpen_({ from:'report' }); };
  document.querySelectorAll('[data-qrmm]').forEach(function(b){ b.onclick=function(){ gpTap(); qrOpen_({ campus:S.me.campus, only:{ campus:S.me.campus, key:b.getAttribute('data-qrmm') }, from:'ministry' }); }; });
  if(S.view!=='qreport' || !qrCan_()) return;
  var Q=qrS_();
  qrLoad_();
  /* asked to open the form (the bell): once the quarter has loaded */
  if(S.qrWant && qrData_(S.qrWant.campus)){ var wnt=S.qrWant; S.qrWant=null; if(qrMayWrite_(qrData_(wnt.campus), wnt.key)){ qrEdit_(wnt.campus, wnt.key); render(); return; } }
  var by=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  var redo=function(){ Q.edit=null; Q.draft=null; qrKeep_(); render(); };
  by('qrBack', function(){ gpTap(); var to=S.board ? 'report' : (S.qrFrom && S.qrFrom!=='qreport' ? S.qrFrom : 'week'); Q.only=null; Q.edit=null; S.view=to; render(); window.scrollTo(0,0); });
  by('qrAll', function(){ gpTap(); Q.only=null; Q.edit=null; Q.draft=null; render(); window.scrollTo(0,0); });
  by('qrPrint', function(){ window.print(); });
  by('qrRetry', function(){ Q.err={}; render(); });
  document.querySelectorAll('[data-qrcampus]').forEach(function(b){ b.onclick=function(){ Q.campus=b.getAttribute('data-qrcampus'); redo(); }; });
  document.querySelectorAll('[data-qrq]').forEach(function(b){ b.onclick=function(){ Q.q=Number(b.getAttribute('data-qrq')); redo(); }; });
  var ys=document.getElementById('qrYear'); if(ys) ys.onchange=function(){ Q.year=Number(ys.value); var cq=qOf(thisWeek())+1; if(Q.year===thisWeekYear() && Q.q>cq) Q.q=cq; redo(); };
  document.querySelectorAll('#qrPick [data-qraud]').forEach(function(b){ b.onclick=function(){
    var a=b.getAttribute('data-qraud'); if(a===Q.aud) return;
    Q.aud=a; if(a==='gov') Q.lang='km';   // the government's copy is in Khmer unless they choose otherwise
    qrKeep_(); render();
  }; });
  document.querySelectorAll('[data-qrlang]').forEach(function(b){ b.onclick=function(){ Q.lang=b.getAttribute('data-qrlang'); qrKeep_(); render(); }; });
  var nf=document.getElementById('qrNoFaith'); if(nf) nf.onchange=function(){ Q.noFaith=nf.checked; render(); };
  var gm=document.getElementById('qrGovMore'); if(gm) gm.onchange=function(){ Q.govMore=gm.checked; qrKeep_(); render(); };
  document.querySelectorAll('[data-qronly]').forEach(function(b){ b.onclick=function(){ gpTap(); var v=b.getAttribute('data-qronly'), i=v.indexOf('|'); Q.only={ campus:v.slice(0,i), key:v.slice(i+1) }; Q.edit=null; Q.draft=null; render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-qrwrite]').forEach(function(b){ b.onclick=function(){ gpTap(); var v=b.getAttribute('data-qrwrite'), i=v.indexOf('|'); qrEdit_(v.slice(0,i), v.slice(i+1)); render();
    var f=document.getElementById('qrForm'); if(f && f.scrollIntoView) f.scrollIntoView({ block:'start' }); }; });
  /* typing: kept in the draft and on the phone, with no redraw */
  document.querySelectorAll('#qrForm [data-qrf]').forEach(function(el){ el.oninput=function(){
    if(!Q.edit) return; var f=el.getAttribute('data-qrf');
    Q.draft=Q.draft||{}; Q.draft[f]=el.value; qrDraftSet_(Q.edit.campus, Q.edit.key, Q.draft);
    var n=document.querySelector('[data-qrn="'+f+'"]'); if(n) n.textContent=el.value.length+' / '+(f==='letter' ? QR_LETTER_MAX : QR_TEXT_MAX);
  }; });
  by('qrSave', qrSave_);
  by('qrCancel', function(){ Q.edit=null; Q.draft=null; render(); });
}
