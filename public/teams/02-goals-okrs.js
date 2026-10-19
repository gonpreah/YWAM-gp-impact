/* My YWAM GP — teams.html, part 2 of 11: OKRs, My week, Goals & Tasks, weekly goals and habits.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ---------- OKRs: the objectives that belong to somebody's job ----------
   Objectives are stored per campus, quarter and department, so a person's
   objectives are their department's — that is the only handle the data gives on
   "whose objective is this", and it is the right one: a department's objectives
   are what someone in it is working toward.

   Rendered for two readers: yourself, on Me, and a teammate, when you tap them in
   the Team directory. Both get the same thing — the job first, then what that job
   is aiming at this quarter — because an objective means little without the job it
   belongs to. Nobody's page shows the rest of the base's objectives; this is about
   one person's work.

   Read-only. Writing an objective is a leadership act and stays on the dashboard
   behind the leader code; this is for the people carrying them. */
/* One objective, laid out the way SugarOKR does it: the objective and its
   progress on top, then every key result straight underneath — no "show key
   results" fold — each with the one control that moves it. Key results that
   share a heading (Money, Time, Projects…) sit under it. `n` is the
   objective's number on the page, or 0 for none. */
function okrCardHtml(o, R, editable, n){
  var p = R.objProgress(o);
  var krs = o.krs||[];
  var h = '<div class="okrCard">'+
    '<div class="okrHead">'+(n?'<div class="okrNum">'+n+'</div>':'')+
    '<div style="flex:1;min-width:0"><div class="okrObj">'+esc(o.objective)+'</div>'+
    '<div class="okrDept">'+(MIN_EMOJI[o.dept]?MIN_EMOJI[o.dept]+' ':'')+esc(t(o.dept))+'</div></div>'+
    '<div class="okrPct'+(p>=100?' done':'')+'">'+p+'%</div></div>'+
    '<div class="bar"><div class="barFill'+(p>=100?' done':'')+'" style="width:'+Math.min(100,p)+'%"></div></div>';
  var lastGroup = '';
  krs.forEach(function(kr, ki){
    var g = kr.group||'';
    if(g && g!==lastGroup) h += '<div class="krGroup">'+esc(g)+'</div>';
    lastGroup = g;
    h += okrKrViewHtml_(o, kr, ki, R, editable);
  });
  if(editable){
    h += '<div class="okrActions">'+
      '<button class="danger" data-okr-del="'+esc(o.id)+'">'+esc(t('Delete'))+'</button>'+
      '<button class="linkbtn inline" data-okr-edit="'+esc(o.id)+'">'+esc(t('Edit'))+'</button></div>';
  }
  return h+'</div>';
}
/* A key result is one of three kinds, and each gets exactly one control:
   - linked to a ministry number: nothing to touch, the figure comes from what
     the ministry logs each week;
   - a count toward a number ("Recruit 20 students"): − and + around the count;
   - anything else: a slider for how far along it is. */
function okrKrViewHtml_(o, kr, ki, R, editable){
  var kp = R.krProgress(o, kr);
  var ref = esc(o.id)+'|'+ki;
  var h = '<div class="kr"><div class="krTop"><div class="krText">'+esc(kr.text)+'</div>'+
    '<div class="krPctLbl'+(kp.pct>=100?' done':'')+'" data-okr-pct="'+ref+'">'+(kp.pct>=100?'✓ ':'')+kp.pct+'%</div></div>';
  var bar = '<div class="krBar"><div class="barFill'+(kp.pct>=100?' done':'')+'" style="width:'+Math.min(100,kp.pct)+'%"></div></div>';
  if(kr.metricKey){
    var parts = kr.metricKey.split('|'), met = parts[2];
    h += bar+'<div class="krMeta"><span>📊 '+esc(t(parts[1])+' · '+t(met))+'</span><span>'+
      (kp.actual===null ? esc(t('Nothing logged yet')) : fmt(kp.actual, met)+' / '+fmt(kr.target, met))+'</span></div>'+
      gpKrWarnHtml(kp);
  } else if(kr.kind==='count'){
    var cur = Math.max(0, Number(kr.current)||0);
    h += bar;
    if(editable){
      h += '<div class="krCount"><button class="krStep" data-okr-step="'+ref+'|-1" aria-label="'+esc(t('One less'))+'">−</button>'+
        '<button class="krCountNum" data-okr-count="'+ref+'">'+cur+'</button>'+
        '<span class="krOf">/ '+(Number(kr.target)||0)+'</span>'+
        '<button class="krStep" data-okr-step="'+ref+'|1" aria-label="'+esc(t('One more'))+'">+</button></div>';
    } else {
      h += '<div class="krMeta"><span>'+cur+' / '+(Number(kr.target)||0)+'</span><span></span></div>';
    }
  } else if(editable){
    var m = Math.max(0, Math.min(100, Number(kr.manual)||0));
    h += '<input type="range" class="krSlider" min="0" max="100" step="5" value="'+m+'" data-okr-manual="'+ref+'" '+
      'aria-label="'+esc(t('How far along'))+'" style="--p:'+m+'%">';
  } else {
    h += bar;
  }
  return h+'</div>';
}

/* Every metric on this campus, for tying a key result to a real KPI. Grouped by
   department so the list is navigable — a key result can measure any ministry's
   number, not just your own. */
function okrMetricOptions(selected, noneLabel, campus){
  var deps = getDepartments(campus || S.me.campus);
  var h = '<option value="">'+esc(t(noneLabel||'Manual progress (%)'))+'</option>';
  Object.keys(deps).forEach(function(d){
    h += '<optgroup label="'+esc(t(d))+'">';
    Object.keys(deps[d]).forEach(function(min){
      deps[d][min].forEach(function(met){
        var key = d+'|'+min+'|'+met;
        h += '<option value="'+esc(key)+'"'+(selected===key?' selected':'')+'>'+
          esc(t(min)+' · '+t(met))+'</option>';
      });
    });
    h += '</optgroup>';
  });
  return h;
}

/* Same note as the dashboard's editor, from the same helper. */
function okrTargetCheck(k){
  var el = document.getElementById('okrKrWarn'+k);
  var sel = document.getElementById('okrKrMetric'+k);
  var tin = document.getElementById('okrKrTarget'+k);
  if(!el || !sel || !tin) return;
  if(sel.value===OKR_COUNT){ el.textContent=''; return; }
  var wk = thisWeek(), q = Math.min(4, Math.floor((wk-1)/13)+1);
  el.textContent = gpKrTargetNote(baseR(), S.me.campus, q, sel.value,
    Number(tin.value)||0);
}

/* The write form. One box per key result; under it a single "how is it
   measured" picker, and a target box only when the picker needs one. Headings
   (Money, Time…) are rows of their own, so a long objective can be split into
   parts without a box on every key result. Rows are added in place, so
   nothing typed is lost, up to OKR_MAX_KRS key results — the most the server
   keeps. */
var OKR_MAX_KRS = 10;
var OKR_COUNT = '__count';
function okrMeasureOptions_(kr, campus){
  var sel = kr.metricKey ? kr.metricKey : (kr.kind==='count' ? OKR_COUNT : '');
  var h = '<option value=""'+(sel===''?' selected':'')+'>'+esc(t('Slide it (%)'))+'</option>'+
    '<option value="'+OKR_COUNT+'"'+(sel===OKR_COUNT?' selected':'')+'>'+esc(t('Count up to a number'))+'</option>';
  /* okrMetricOptions leads with its own "none" option; the two above replace it */
  return h + okrMetricOptions(sel, null, campus).replace(/^<option value="">[^<]*<\/option>/, '');
}
function okrKrRowHtml(k, kr, campus){
  kr = kr || { text:'', metricKey:'', target:'' };
  var needsTarget = !!kr.metricKey || kr.kind==='count';
  return '<div class="okrRow" data-okr-kr="'+k+'">'+
    '<div class="okrRowTop"><input type="text" id="okrKrText'+k+'" value="'+esc(kr.text)+'" placeholder="'+esc(t('Key result'))+' '+(k+1)+'">'+
    '<button class="okrRm" type="button" data-okr-rm aria-label="'+esc(t('Remove'))+'">✕</button></div>'+
    '<div class="okrRowHow"><select id="okrKrMetric'+k+'" aria-label="'+esc(t('Measure by'))+'">'+okrMeasureOptions_(kr, campus)+'</select>'+
    '<input type="number" id="okrKrTarget'+k+'" inputmode="decimal" placeholder="'+esc(t('Target'))+'" aria-label="'+esc(t('Target'))+'" value="'+
      (kr.target||'')+'"'+(needsTarget?'':' hidden')+'></div>'+
    '<div class="krWarn" id="okrKrWarn'+k+'"></div>'+
    '</div>';
}
function okrHeadRowHtml_(text){
  return '<div class="okrRow okrHeadRow" data-okr-head>'+
    '<div class="okrRowTop"><input type="text" class="okrHeadIn" value="'+esc(text||'')+'" placeholder="'+esc(t('Heading, e.g. Money'))+'">'+
    '<button class="okrRm" type="button" data-okr-rm aria-label="'+esc(t('Remove'))+'">✕</button></div></div>';
}
function okrBindKrRow_(k){
  var sel=document.getElementById('okrKrMetric'+k), tin=document.getElementById('okrKrTarget'+k);
  if(!sel || !tin) return;
  sel.addEventListener('change', function(){
    tin.hidden = !sel.value;
    if(!tin.hidden && !tin.value) tin.focus();
    okrTargetCheck(k);
  });
  tin.addEventListener('input', function(){ okrTargetCheck(k); });
  okrTargetCheck(k);
}
function okrKrRows_(){ return document.querySelectorAll('#okrKrList [data-okr-kr]'); }
function okrSyncAddBtn_(){
  var btn = document.getElementById('okrKrAddBtn');
  if(btn) btn.style.display = okrKrRows_().length >= OKR_MAX_KRS ? 'none' : '';
}
function okrBindRm_(row){
  var rm = row.querySelector('[data-okr-rm]');
  if(rm) rm.onclick = function(){ gpTap(); row.remove(); okrSyncAddBtn_(); };
}
/* Adds a row in place, so whatever is already typed in the form stays put. */
function okrAddKr_(){
  var list = document.getElementById('okrKrList');
  if(!list || okrKrRows_().length >= OKR_MAX_KRS) return;
  var k = 0;
  okrKrRows_().forEach(function(r){ k = Math.max(k, Number(r.getAttribute('data-okr-kr'))+1); });
  list.insertAdjacentHTML('beforeend', okrKrRowHtml(k, null, list.getAttribute('data-campus')||null));
  okrBindKrRow_(k);
  okrBindRm_(list.lastElementChild);
  okrSyncAddBtn_();
  var box = document.getElementById('okrKrText'+k);
  if(box) box.focus();
}
function okrAddHead_(){
  var list = document.getElementById('okrKrList');
  if(!list) return;
  list.insertAdjacentHTML('beforeend', okrHeadRowHtml_(''));
  okrBindRm_(list.lastElementChild);
  var box = list.lastElementChild.querySelector('input');
  if(box) box.focus();
}
function okrFormHtml(editing, target){
  var krs = editing ? (editing.krs||[]) : [];
  var campus = target && target.campus;
  var h = '<div class="okrCard" id="okrForm"><div class="okrObj">'+
    esc(t(editing?'Edit objective':'New objective'))+'</div>'+
    (target ? '<div class="okrDept">'+(MIN_EMOJI[target.dept]?MIN_EMOJI[target.dept]+' ':'')+esc(t(target.dept))+' · '+esc(campusName(target.campus))+'</div>' : '');
  h += '<label class="f">'+esc(t('Objective'))+'</label>'+
    '<input type="text" id="okrObjText" value="'+(editing?esc(editing.objective):'')+'" '+
    'placeholder="'+esc(t('What are we aiming at this quarter?'))+'">';
  h += '<label class="f">'+esc(t('Key results'))+'</label>'+
    '<div id="okrKrList" data-campus="'+esc(campus||'')+'">';
  var rows = Math.min(OKR_MAX_KRS, Math.max(3, krs.length)), lastGroup = '';
  for(var k=0;k<rows;k++){
    var g = (krs[k] && krs[k].group) || '';
    if(g && g!==lastGroup) h += okrHeadRowHtml_(g);
    if(krs[k]) lastGroup = g;
    h += okrKrRowHtml(k, krs[k], campus);
  }
  h += '</div><div class="okrAddRow">'+
    '<button class="btn ghost" id="okrKrAddBtn" type="button"'+(rows>=OKR_MAX_KRS?' style="display:none"':'')+'>'+esc(t('+ Add a key result'))+'</button>'+
    '<button class="btn ghost" id="okrHeadAddBtn" type="button">'+esc(t('+ Heading'))+'</button></div>';
  h += '<button class="btn" id="okrSaveBtn">'+esc(t(editing?'Save changes':'Add objective'))+'</button>'+
    '<button class="btn ghost" id="okrCancelBtn">'+esc(t('Cancel'))+'</button></div>';
  return h;
}

/* ---- Paste OKRs ----
   Most teams already have their OKRs written down somewhere — a doc, a chat,
   a slide. Pasting that in beats retyping it box by box. The rules are loose
   on purpose:
     "Objective 1: …" (or "Goal:", "O1.") starts an objective;
     a bulleted or numbered line is a key result;
     any other line under an objective is a heading (Money, Time…);
     a plain line before any objective is taken as one.
   Nothing is saved until the preview has been seen. */
var OKR_OBJ_RE = /^\s*(?:(?:objective|goal)\s*\d*|o\d+)\s*(?:[:.)\-–—]\s*|\s+(?=\S))(.*)$/i;
var OKR_OBJ_BARE_RE = /^\s*(?:(?:objective|goal)\s*\d*|o\d+)\s*[:.)\-–—]?\s*$/i;
var OKR_BULLET_RE = /^\s*(?:[•\-*–—·●▪◦○■□➢►▶✓✔☐]|\d{1,2}[.)]|[a-z][.)]|kr\s*\d*\s*[:.)\-–—])\s*(.+)$/i;
function okrParsePaste_(text){
  var out = [], cur = null, group = '', waitTitle = false, notes = [];
  String(text||'').split(/\r?\n/).forEach(function(raw){
    var line = raw.replace(/\s+$/,'');
    if(!line.trim()) return;
    var m;
    if(OKR_OBJ_BARE_RE.test(line)){ waitTitle = true; cur = null; group = ''; return; }
    if((m = line.match(OKR_OBJ_RE)) && m[1].trim()){
      cur = { objective:m[1].trim(), krs:[] }; out.push(cur); group = ''; waitTitle = false; return;
    }
    if((m = line.match(OKR_BULLET_RE)) && !waitTitle){
      if(!cur){ cur = { objective:'', krs:[] }; out.push(cur); }
      cur.krs.push({ text:m[1].trim(), group:group });
      return;
    }
    var plain = line.trim().replace(/:$/,'');
    if(waitTitle || !cur){ cur = { objective:plain, krs:[] }; out.push(cur); group = ''; waitTitle = false; }
    else group = plain;
  });
  out.forEach(function(o, i){
    var name = gpT('Objective {n}', { n:i+1 });
    if(!o.objective) notes.push(gpT('{name} has no title.', { name:name }));
    if(!o.krs.length) notes.push(gpT('{name} has no key results — put each one on its own line starting with •', { name:name }));
    if(o.krs.length > OKR_MAX_KRS){
      notes.push(gpT('{name} has {n} key results; only the first {max} fit.', { name:name, n:o.krs.length, max:OKR_MAX_KRS }));
      o.krs = o.krs.slice(0, OKR_MAX_KRS);
    }
  });
  return { objectives:out, notes:notes };
}
function okrPasteHtml_(){
  var h = '<div class="okrCard" id="okrPasteCard"><div class="okrObj">📋 '+esc(t('Paste OKRs'))+'</div>'+
    '<p class="sub" style="margin:4px 0 8px">'+esc(t('Paste your OKRs as you already have them written. Start each objective with “Objective 1:” and put each key result on its own line starting with •'))+'</p>';
  var parsed = S.okrPasteParsed;
  if(!parsed){
    h += '<textarea id="okrPasteText" rows="10" placeholder="'+esc('Objective 1: …\n\nMoney\n• …\n• …\n\nObjective 2: …\n• …')+'">'+esc(S.okrPasteText||'')+'</textarea>'+
      '<button class="btn" id="okrPastePreview">'+esc(t('Preview'))+'</button>';
  } else {
    var good = parsed.objectives.filter(function(o){ return o.objective && o.krs.length; });
    parsed.objectives.forEach(function(o, i){
      h += '<div class="okrPrev"><div class="okrPrevObj"><span class="okrNum">'+(i+1)+'</span>'+esc(o.objective||'—')+'</div>';
      var lg = '';
      o.krs.forEach(function(kr){
        if(kr.group && kr.group!==lg) h += '<div class="krGroup">'+esc(kr.group)+'</div>';
        lg = kr.group;
        h += '<div class="okrPrevKr">• '+esc(kr.text)+'</div>';
      });
      h += '</div>';
    });
    parsed.notes.forEach(function(nt){ h += '<div class="krWarn">'+esc(nt)+'</div>'; });
    var qNow = Math.min(4, Math.floor((thisWeek()-1)/13)+1);
    h += good.length
      ? '<button class="btn" id="okrPasteSave">'+esc(gpT(good.length===1?'Add 1 objective to Q{q}':'Add {n} objectives to Q{q}', { n:good.length, q:qNow }))+'</button>'
      : '';
    h += '<button class="btn ghost" id="okrPasteBack">'+esc(t('Back to the text'))+'</button>';
  }
  h += '<button class="btn ghost" id="okrPasteCancel">'+esc(t('Cancel'))+'</button></div>';
  return h;
}
function okrPasteSave_(btn){
  var parsed = S.okrPasteParsed; if(!parsed) return;
  var list = parsed.objectives.filter(function(o){ return o.objective && o.krs.length; });
  var myDept = S.me.dept==='Base Director' ? 'Campus Leadership' : S.me.dept;
  var quarter = Math.min(4, Math.floor((thisWeek()-1)/13)+1), stamp = Date.now(), i = 0;
  btn.disabled = true; btn.textContent = t('Saving…');
  (function next(){
    if(i >= list.length){
      S.okrPaste = false; S.okrPasteParsed = null; S.okrPasteText = '';
      showMsg(t('Saved')); render(); return;
    }
    var o = list[i];
    var obj = { id:'o'+stamp+'_'+i, campus:S.me.campus, quarter:quarter, dept:myDept, objective:o.objective,
      krs:o.krs.map(function(kr){ return { text:kr.text, group:kr.group||'', metricKey:'', target:0, manual:0 }; }) };
    run('saveObjective', [obj, '', S.auth.user, S.auth.pin], function(d){
      if(d && d.entries){ S.base = d; i++; next(); }
      else { btn.disabled = false; btn.textContent = t('Try again'); list = list.slice(i); i = 0;
        S.okrPasteParsed = { objectives:list, notes:[] };
        showMsg(t('That didn’t save — try again.')); }
    });
  })();
}

/* One person's objectives, with the job they belong to on top. `who` is any
   staff record; `mine` is true on your own page (where you can write).
   A department lead who oversees another department (e.g. Community
   Service) sees their OWN department's objectives (Campus Leadership's) plus
   the objectives of the department they lead. Every objective is on the page
   at once, numbered, with its key results showing — the quarter's whole plan
   in one scroll, the way SugarOKR lays it out. */
function okrSectionHtml(who, mine, noHeading){
  var wk = thisWeek();
  var qNow = Math.min(4, Math.floor((wk-1)/13)+1);
  var dept = who.dept==='Base Director' ? 'Campus Leadership' : who.dept;
  var depts = [dept];
  var oversees = oversightDeptOf_(who);
  if(oversees && depts.indexOf(oversees)===-1) depts.push(oversees);
  var h = noHeading ? '' : ('<h3'+(mine?' id="sec-okr"':'')+'>🎯 Q'+qNow+' '+esc(t('OKRs'))+'</h3>');

  var focus = (typeof jobFocus==='function') ? jobFocus(dept, who.ministry) : null;
  if(focus && !mine){
    h += '<div class="focusCard"><div class="fLabel">'+esc(t('Their focus'))+'</div>'+
      '<div class="fMin">'+esc(t(who.ministry || dept))+'</div>'+
      '<p>'+esc(focus)+'</p></div>';
  }

  if(!S.base){
    return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading your base…'))+'</p></div>';
  }
  var R = baseR();
  var theirs = (S.base.okrs||[]).filter(function(o){
    return o.campus===who.campus && Number(o.quarter)===qNow && depts.indexOf(o.dept)>-1;
  });

  if(theirs.length){
    /* the quarter at a glance: overall progress against how far through it we are */
    var sum = 0; theirs.forEach(function(o){ sum += R.objProgress(o); });
    var all = Math.round(sum/theirs.length);
    var qWeek = Math.max(1, Math.min(13, wk-(qNow-1)*13));
    h += '<div class="okrSum"><div><div class="okrSumPct">'+all+'%</div>'+
      '<div class="rowSub">'+esc(gpT(theirs.length===1?'1 objective':'{n} objectives',{n:theirs.length}))+'</div></div>'+
      '<div class="okrSumWk"><div class="rowSub">'+esc(gpT('Week {n} of 13',{n:qWeek}))+'</div>'+
      '<div class="krBar"><div class="barFill" style="width:'+Math.round(qWeek/13*100)+'%"></div></div></div></div>';
  } else if(!(mine && (S.okrForm || S.okrPaste))){
    h += '<div class="card"><p class="sub" style="margin:0">'+
      esc(t(mine ? 'No objectives set for your department this quarter.'
                 : 'No objectives set for their department this quarter.'))+'</p></div>';
  }
  theirs.forEach(function(o, i){
    /* Editing happens in place: the form takes the card's spot. Edit/delete
       only on your OWN department's objective — the server refuses a write
       against a department you merely oversee. */
    if(mine && S.okrForm && !S.okrAdmin && S.okrEditId===o.id) h += okrFormHtml(o);
    else h += okrCardHtml(o, R, mine && o.dept===dept, theirs.length>1 ? i+1 : 0);
  });

  if(mine){
    if(S.okrForm && !S.okrAdmin && !S.okrEditId) h += okrFormHtml(null);
    else if(S.okrPaste) h += okrPasteHtml_();
    else if(!S.okrForm){
      h += '<div class="okrAddRow"><button class="btn ghost" id="okrNewBtn">+ '+esc(t('New objective'))+'</button>'+
        '<button class="btn ghost" id="okrPasteBtn">📋 '+esc(t('Paste OKRs'))+'</button></div>';
    }
  }

  if(theirs.length){
    h += '<p class="hint">'+esc(t('Slide a key result to show how far along it is. Ones linked to a ministry number fill in from what that ministry logs each week.'))+'</p>';
  }
  return h;
}

/* Writing an objective. The server re-checks everything: it takes the campus and
   department from the staff record rather than from this payload, and refuses an
   id that belongs to another department. So the worst a bad request here can do
   is fail. Rows are read in page order, so a heading row labels the key
   results under it. */
function okrSave(btn){
  var text = (document.getElementById('okrObjText').value||'').trim();
  if(!text){ showMsg(t('Give the objective a name first.')); return; }
  var krs = [], group = '';
  document.querySelectorAll('#okrKrList .okrRow').forEach(function(row){
    if(row.hasAttribute('data-okr-head')){
      group = (row.querySelector('input').value||'').trim(); return;
    }
    var k = row.getAttribute('data-okr-kr');
    var tx = (document.getElementById('okrKrText'+k).value||'').trim();
    if(!tx) return;
    var how = document.getElementById('okrKrMetric'+k).value;
    krs.push({ text:tx, group:group,
      metricKey: how===OKR_COUNT ? '' : how,
      kind: how===OKR_COUNT ? 'count' : '',
      target: how ? (Number(document.getElementById('okrKrTarget'+k).value)||0) : 0,
      manual: 0, current: 0 });
  });
  if(!krs.length){ showMsg(t('Add at least one key result.')); return; }

  /* Keep the progress already entered — the slider's percentage and a count's
     running total. The form does not show them, so re-saving an objective must
     not silently reset them to zero. */
  if(S.okrEditId){
    (S.base.okrs||[]).forEach(function(o){
      if(o.id!==S.okrEditId) return;
      krs.forEach(function(nk){
        if(nk.metricKey) return;
        (o.krs||[]).forEach(function(ok){
          if(ok.text!==nk.text || ok.metricKey) return;
          nk.manual = Number(ok.manual)||0;
          nk.current = Number(ok.current)||0;
        });
      });
    });
  }

  var myDept = S.me.dept==='Base Director' ? 'Campus Leadership' : S.me.dept;
  var tgt = S.okrAdmin || { campus:S.me.campus, dept:myDept };   // an admin may write any campus / department
  var obj = {
    id: S.okrEditId || ('o'+Date.now()),
    campus: tgt.campus,
    quarter: Math.min(4, Math.floor((thisWeek()-1)/13)+1),
    dept: tgt.dept,
    objective: text,
    krs: krs
  };
  btn.disabled = true; btn.textContent = t('Saving…');
  run('saveObjective', [obj, '', S.auth.user, S.auth.pin], function(d){
    // saveObjective answers with the whole getData payload; if it didn't, the
    // write was refused, so say so rather than blanking the page.
    if(d && d.entries){ S.base = d; S.okrForm = false; S.okrEditId = null; S.okrAdmin = null; showMsg(t('Saved')); }
    else { btn.disabled = false; btn.textContent = t('Save changes'); showMsg(t('That didn’t save — try again.')); }
    render();
  });
}

function okrDelete(id){
  run('deleteObjective', [id, '', S.auth.user, S.auth.pin], function(d){
    if(d && d.entries){ S.base = d; S.okrForm = false; S.okrEditId = null; S.okrAdmin = null; }
    else showMsg(t('That didn’t save — try again.'));
    render();
  });
}

/* Moving a key result — the slider or the count — saves on its own rather than
   making anyone open the form for it. The page updates straight away; the
   save follows (the count's a moment later, so tapping + five times is one
   save, not five). */
function okrFind_(id){
  var o = null; (S.base && S.base.okrs || []).forEach(function(x){ if(x.id===id) o=x; });
  return o;
}
function okrSaveProgress_(o){
  var copy = {
    id: o.id, campus: o.campus, quarter: o.quarter, dept: o.dept, objective: o.objective,
    krs: o.krs.map(function(kr){
      return { text:kr.text, group:kr.group||'', metricKey:kr.metricKey||'', kind:kr.kind||'',
        target:Number(kr.target)||0, manual:Number(kr.manual)||0, current:Number(kr.current)||0 };
    })
  };
  run('saveObjective', [copy, '', S.auth.user, S.auth.pin], function(d){
    if(d && d.entries){ S.base = d; showMsg(t('Saved')); }
    else showMsg(t('That didn’t save — try again.'));
    render();
  });
}
function okrSetManual(id, index, pct){
  var o = okrFind_(id);
  if(!o || !o.krs || !o.krs[index]) return;
  o.krs[index].manual = Math.max(0, Math.min(100, Number(pct)||0));
  okrSaveProgress_(o);
}
var okrCountTimer_ = null;
function okrSetCount(id, index, n){
  var o = okrFind_(id);
  if(!o || !o.krs || !o.krs[index]) return;
  o.krs[index].current = Math.max(0, Math.round(Number(n)||0));
  render();
  clearTimeout(okrCountTimer_);
  okrCountTimer_ = setTimeout(function(){ okrSaveProgress_(o); }, 900);
}

/* ---------- my week: the personal page ---------- */

/* The app knows what day it is. Monday you're setting goals, midweek you're
   keeping habits, Friday you're closing the week out — so the card that matters
   today sits at the top instead of the same fixed wall every day. */
function weekPhase(){
  var dow=new Date().getDay();               // 0 Sun … 6 Sat
  if(dow===1||dow===2) return 'plan';
  if(dow===5||dow===6||dow===0) return 'review';
  return 'work';
}
function phaseBanner(phase, wk){
  var rec=goalsForWeek(wk);
  var hasGoals=!!(rec && rec.items.some(function(i){return i.text;}));
  if(phase==='plan' && !hasGoals)
    return '<div class="banner big">🎯 <strong>Start of the week.</strong> Pick the three things that matter for week '+wk+'.'+
      ' <button class="linkbtn inline" id="jumpGoals">Set them now</button></div>';
  /* No end-of-week "Log today" banner: there is no daily check-in any more —
     the weekly health check-in is the one thing to fill in. Goals-incomplete
     lives in the bell. */
  return '';
}

function smartYear_(){ return S.smartYear==null ? new Date().getFullYear() : S.smartYear; }
/* --- the Goals & Tasks page (Oct 2026, Uriah) ---
   Annual goals open into a page of their own, with two tabs. 🎯 Goals: the
   year and category, each goal written out as a SMART goal with a plain
   explanation of what that means, and the quarterly and monthly steps that
   lead up to it, ticked off as they're done. ✅ Tasks: a Google-Tasks-like
   list — add a line and press Enter, tick it off, give it a date, link it
   to a goal — so the goal's progress follows what actually gets done. */
var SMART_HELP = [
  ['s','Specific','Say exactly what you will do — who, what, where. “Read the whole New Testament” rather than “read more”.'],
  ['m','Measurable','How will you know it’s done? A number or a clear finish line: “27 books, one every two weeks”.'],
  ['a','Achievable','Stretching but possible with the time and resources you have. What makes this doable for you?'],
  ['r','Relevant','Why this, why now? How does it serve your walk with God, your ministry, your family?'],
  ['t','Time-bound','By when? Give it a deadline, then break the year into quarterly and monthly steps.']
];
var SMART_PLACEHOLDER = {
  s:'What exactly will you do?', m:'How will you know it’s done? A number, a finish line.',
  a:'What makes it doable for you this year?', r:'Why this, why now?', t:'By when? e.g. by 30 November'
};
function tkToday_(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function tkAddDays_(iso, n){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function tkDateLabel_(iso){
  if(!iso) return '';
  var today=tkToday_();
  if(iso===today) return t('Today');
  if(iso===tkAddDays_(today,1)) return t('Tomorrow');
  if(iso===tkAddDays_(today,-1)) return t('Yesterday');
  var d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString(LANG==='km'?'km-KH':'en-GB',{weekday:'short', day:'numeric', month:'short'});
}
function tkMonthShort_(n){ return new Date(2026, n-1, 1).toLocaleDateString(LANG==='km'?'km-KH':'en-GB',{month:'short'}); }
function stepLabel_(st){ return st.kind==='quarter' ? 'Q'+st.period : tkMonthShort_(st.period); }
/* Quarters first, each in order, then the months — the way a year reads. */
function stepsSorted_(steps){
  return (steps||[]).slice().sort(function(a,b){
    if(a.kind!==b.kind) return a.kind==='quarter' ? -1 : 1;
    return a.period-b.period;
  });
}
function goalById_(id){ return S.smartGoals.filter(function(x){ return x.id===id; })[0]; }
function goalTasks_(id){ return (S.tasks||[]).filter(function(x){ return x.goalId===id; }); }
function openTasksDue_(){
  var today=tkToday_();
  return (S.tasks||[]).filter(function(x){ return !x.done && x.due && x.due<=today; }).length;
}

/* The My Home card: the year at a glance, and a tap opens the page. */
function annualGoalsHtml(){
  var year=smartYear_();
  var yearGoals=S.smartGoals.filter(function(g){ return Number(g.year)===Number(year); });
  var avg=yearGoals.length ? Math.round(yearGoals.reduce(function(a,g){ return a+(Number(g.pct)||0); },0)/yearGoals.length) : 0;
  var due=openTasksDue_();
  var line=yearGoals.length===1 ? gpT('1 goal · {pct}%',{pct:avg}) : yearGoals.length ? gpT('{n} goals · {pct}% on average',{n:yearGoals.length, pct:avg}) : t('No goals set for this year yet.');
  if(due) line+=' · '+(due===1 ? t('1 task due') : gpT('{n} tasks due',{n:due}));
  var h='<h3 id="sec-annual">'+esc(t('Annual Goals · SMART'))+'</h3>';
  return h+'<button class="card homeFold" id="goGoalsFromMe"><span style="flex:1;min-width:0"><b>'+esc(gpT('{year} goals',{year:year}))+'</b>'+
    '<span class="pmeta" style="display:block">'+esc(line)+'</span>'+
    (yearGoals.length?'<span class="bar" style="display:block;margin-top:6px"><span class="barFill" style="display:block;width:'+avg+'%"></span></span>':'')+'</span>'+
    '<span class="chev">›</span></button>';
}

function goalsPageHtml(){
  var tab=S.goalsTab||'goals';
  var open=(S.tasks||[]).filter(function(x){ return !x.done; }).length;
  var h='<button class="linkbtn" id="goalsBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>';
  h+='<h2>'+esc(t('Goals & Tasks'))+'</h2>';
  h+='<div class="hospTabs gTabs">'+
    '<button class="hospTab'+(tab==='goals'?' on':'')+'" data-gtab="goals"><span>🎯</span>'+esc(t('Goals'))+'</button>'+
    '<button class="hospTab'+(tab==='tasks'?' on':'')+'" data-gtab="tasks"><span>✅</span>'+esc(t('Tasks'))+(open?' <span class="hospBadge">'+open+'</span>':'')+'</button></div>';
  return h+(tab==='tasks' ? tasksTabHtml_() : goalsTabHtml_());
}

function smartHelpHtml_(){
  var h='<button class="card homeFold slim" id="smartHelpToggle"><span style="flex:1"><b>'+esc(t('What is a SMART goal?'))+'</b>'+
    (S.smartHelpOpen?'':'<span class="pmeta" style="display:block">'+esc(t('Specific · Measurable · Achievable · Relevant · Time-bound'))+'</span>')+'</span>'+
    '<span class="chev">'+(S.smartHelpOpen?'▴':'▾')+'</span></button>';
  if(!S.smartHelpOpen) return h;
  h+='<div class="card smartHelp">';
  h+='<p class="sub" style="margin:0 0 10px">'+esc(t('A SMART goal is written so clearly that you can tell, any month of the year, whether you are on track. Five short answers do it:'))+'</p>';
  SMART_HELP.forEach(function(r){
    h+='<div class="smartRow"><b class="smartLetter">'+r[0].toUpperCase()+'</b><span><b>'+esc(t(r[1]))+'</b> — '+esc(t(r[2]))+'</span></div>';
  });
  h+='<p class="sub" style="margin:10px 0 0">'+esc(t('Then break the year down: what has to be true by the end of each quarter, and what gets done each month? Tick the steps off as you go and the goal’s progress follows.'))+'</p>';
  return h+'</div>';
}

function goalsTabHtml_(){
  var year=smartYear_(), cat=S.smartCategory||'Faith';
  var h='<div class="card">';
  h+='<div class="yearPick"><button class="yearBtn" id="smartPrevYear" aria-label="'+esc(t('Previous year'))+'">‹</button>'+
     '<span class="yearNum">'+year+'</span>'+
     '<button class="yearBtn" id="smartNextYear" aria-label="'+esc(t('Next year'))+'">›</button></div>';
  h+='<div class="catChips">'+SMART_CATEGORIES.map(function(c){
    var n=S.smartGoals.filter(function(g){ return Number(g.year)===Number(year) && g.category===c; }).length;
    return '<button class="catChip'+(cat===c?' on':'')+'" data-smartcat="'+c+'">'+esc(t(c))+(n?' · '+n:'')+'</button>';
  }).join('')+'</div>';
  h+='</div>';
  h+=smartHelpHtml_();

  var mine=S.smartGoals.filter(function(g){ return Number(g.year)===Number(year) && g.category===cat; });
  if(!mine.length && !(S.smartDraft && !S.smartDraft.id)){
    h+='<div class="card"><p class="sub" style="margin:4px 0 0">'+esc(t('No goals set for this category yet.'))+'</p></div>';
  }
  mine.forEach(function(g){
    if(S.smartDraft && S.smartDraft.id===g.id){ h+='<div class="card">'+smartGoalFormHtml(S.smartDraft)+'</div>'; return; }
    h+=smartGoalCardHtml_(g);
  });
  if(S.smartDraft && !S.smartDraft.id) h+='<div class="card">'+smartGoalFormHtml(S.smartDraft)+'</div>';
  else if(!S.smartDraft) h+='<button class="btn ghost" id="smartNewBtn" style="margin-top:4px">+ '+esc(t('New goal'))+'</button>';
  return h;
}

function smartProgressLine_(g){
  var steps=g.steps||[], doneSteps=steps.filter(function(x){ return x.done; }).length;
  var bits=[g.pct+'%'];
  if(steps.length) bits.push(gpT('{done} of {n} steps',{done:doneSteps, n:steps.length}));
  if(g.tasksTotal) bits.push(gpT('{done} of {n} tasks',{done:g.tasksDone||0, n:g.tasksTotal}));
  return bits.join(' · ');
}

function smartGoalCardHtml_(g){
  var h='<div class="card smartCard" data-goalcard="'+esc(g.id)+'">';
  h+='<div class="smartTitle">'+esc(g.title)+'</div>'+(g.meta?'<div class="smartMeta">'+esc(g.meta)+'</div>':'');
  h+='<div class="bar"><div class="barFill'+(g.pct>=100?' done':'')+'" style="width:'+g.pct+'%"></div></div>';
  h+='<div class="smartActions"><span class="smartPct">'+esc(smartProgressLine_(g))+'</span>'+
    '<button class="linkbtn inline" data-smartedit="'+esc(g.id)+'">'+esc(t('Edit'))+'</button>'+
    '<button class="danger" data-smartdel="'+esc(g.id)+'">'+esc(t('Delete'))+'</button></div>';
  var sm=g.smart||{}, filled=SMART_HELP.filter(function(r){ return sm[r[0]]; });
  if(filled.length){
    h+='<div class="smartGrid">'+filled.map(function(r){
      return '<div class="smartRow"><b class="smartLetter" title="'+esc(t(r[1]))+'">'+r[0].toUpperCase()+'</b><span>'+esc(sm[r[0]])+'</span></div>';
    }).join('')+'</div>';
  } else {
    h+='<p class="hint" style="margin:8px 0 0">'+esc(t('Not written as a SMART goal yet — tap Edit to fill in the five answers.'))+'</p>';
  }
  /* the steps that lead up to it */
  var steps=stepsSorted_(g.steps);
  h+='<div class="stepsHead">'+esc(t('Steps to get there'))+'</div>';
  if(!steps.length) h+='<p class="hint" style="margin:0 0 6px">'+esc(t('Break it down: what must be true by the end of each quarter, and what gets done each month?'))+'</p>';
  steps.forEach(function(st){
    h+='<div class="stepRow'+(st.done?' done':'')+'">'+
      '<button class="tkCheck'+(st.done?' on':'')+'" data-stepdone="'+esc(g.id)+'|'+esc(st.id)+'" aria-label="'+esc(t(st.done?'Not done yet':'Done'))+'">'+(st.done?'✓':'')+'</button>'+
      '<span class="stepPeriod'+(st.kind==='quarter'?' q':'')+'">'+esc(stepLabel_(st))+'</span>'+
      '<span class="stepTitle">'+esc(st.title)+'</span>'+
      '<button class="stepDel" data-stepdel="'+esc(g.id)+'|'+esc(st.id)+'" aria-label="'+esc(t('Remove step'))+'">×</button></div>';
  });
  if(S.stepAdd===g.id){
    var sd=S.stepDraft||{kind:'quarter', period:1, title:''};
    var periods=sd.kind==='quarter' ? [1,2,3,4] : [1,2,3,4,5,6,7,8,9,10,11,12];
    h+='<div class="stepAdd">'+
      '<select id="stepKind" aria-label="'+esc(t('Quarterly or monthly'))+'"><option value="quarter"'+(sd.kind==='quarter'?' selected':'')+'>'+esc(t('Quarter'))+'</option><option value="month"'+(sd.kind==='month'?' selected':'')+'>'+esc(t('Month'))+'</option></select>'+
      '<select id="stepPeriod" aria-label="'+esc(t('Which one'))+'">'+periods.map(function(p){ return '<option value="'+p+'"'+(Number(sd.period)===p?' selected':'')+'>'+esc(sd.kind==='quarter'?'Q'+p:tkMonthShort_(p))+'</option>'; }).join('')+'</select>'+
      '</div><div class="stepAdd">'+
      '<input type="text" id="stepTitle" maxlength="200" value="'+esc(sd.title||'')+'" placeholder="'+esc(sd.kind==='quarter'?t('By the end of this quarter…'):t('This month…'))+'">'+
      '<button class="btn small" id="stepSaveBtn">'+esc(t('Add'))+'</button>'+
      '<button class="linkbtn inline" id="stepCancelBtn">'+esc(t('Cancel'))+'</button></div>';
  } else if(steps.length<24){
    h+='<button class="linkbtn inline stepNew" data-stepnew="'+esc(g.id)+'">+ '+esc(t('Add a quarterly or monthly step'))+'</button>';
  }
  /* its tasks, on the other tab */
  var n=g.tasksTotal||0;
  h+='<div class="goalTasksRow"><button class="linkbtn inline" data-goaltasks="'+esc(g.id)+'">✅ '+
    esc(n ? (n===1 ? gpT('1 task · {done} done',{done:g.tasksDone||0}) : gpT('{n} tasks · {done} done',{n:n, done:g.tasksDone||0})) : t('Add tasks for this goal'))+' ›</button></div>';
  return h+'</div>';
}

function smartGoalFormHtml(draft){
  var g=draft.id ? goalById_(draft.id) : null;
  var auto=g && ((g.steps||[]).length || g.tasksTotal);
  var sm=draft.smart||{};
  var h='<div class="smartGoal">'+
    '<label class="f">'+esc(t('Goal'))+'</label>'+
    '<input type="text" id="sg_title" maxlength="200" value="'+esc(draft.title||'')+'" placeholder="'+esc(t('What are you aiming for this year?'))+'">'+
    '<label class="f">'+esc(t('Detail (optional)'))+'</label>'+
    '<input type="text" id="sg_meta" maxlength="200" value="'+esc(draft.meta||'')+'" placeholder="'+esc(t('e.g. Measurable · by Dec 2026'))+'">';
  h+='<div class="stepsHead" style="margin-top:14px">'+esc(t('Write it as a SMART goal'))+'</div>';
  SMART_HELP.forEach(function(r){
    h+='<label class="f smartF" for="sg_'+r[0]+'"><b class="smartLetter">'+r[0].toUpperCase()+'</b> '+esc(t(r[1]))+'</label>'+
      '<textarea id="sg_'+r[0]+'" maxlength="300" rows="2" placeholder="'+esc(t(SMART_PLACEHOLDER[r[0]]))+'">'+esc(sm[r[0]]||'')+'</textarea>';
  });
  if(auto){
    h+='<p class="hint" style="margin-top:12px">'+esc(gpT('Progress follows your steps and tasks: {pct}%',{pct:g.pct}))+'</p>';
  } else {
    h+='<label class="f">'+esc(t('Progress'))+'</label>'+
      '<input type="number" id="sg_pct" min="0" max="100" placeholder="0" value="'+(draft.pct ? draft.pct : '')+'"> %'+
      '<p class="hint">'+esc(t('Once the goal has steps or tasks, progress follows what you tick off.'))+'</p>';
  }
  h+='<button class="btn" id="smartSaveBtn">'+esc(t(draft.id?'Save changes':'Add goal'))+'</button>'+
    '<button class="btn ghost" id="smartCancelBtn">'+esc(t('Cancel'))+'</button>'+
  '</div>';
  return h;
}

/* ✅ Tasks — the Google-Tasks-like list. */
function taskGoalOptions_(sel){
  var year=new Date().getFullYear();
  var goals=S.smartGoals.filter(function(g){ return Number(g.year)===year; });
  var h='<option value=""'+(!sel?' selected':'')+'>'+esc(t('No goal'))+'</option>';
  goals.forEach(function(g){ h+='<option value="'+esc(g.id)+'"'+(sel===g.id?' selected':'')+'>'+esc(g.title)+'</option>'; });
  return h;
}
function taskRowHtml_(x){
  var g=x.goalId ? goalById_(x.goalId) : null;
  var today=tkToday_();
  var meta=[];
  if(x.due) meta.push('<span class="tkDue'+(!x.done && x.due<today?' late':'')+'">'+esc(tkDateLabel_(x.due))+'</span>');
  if(g) meta.push('<span class="tkGoal">🎯 '+esc(g.title)+'</span>');
  if(x.notes) meta.push('<span class="tkNote">'+esc(x.notes)+'</span>');
  return '<div class="tkRow'+(x.done?' done':'')+'" data-taskrow="'+esc(x.id)+'">'+
    '<button class="tkCheck'+(x.done?' on':'')+'" data-taskdone="'+esc(x.id)+'" aria-label="'+esc(t(x.done?'Not done yet':'Done'))+'">'+(x.done?'✓':'')+'</button>'+
    '<button class="tkBody" data-taskedit="'+esc(x.id)+'"><span class="tkTitle">'+esc(x.title)+'</span>'+
    (meta.length?'<span class="tkMeta">'+meta.join(' · ')+'</span>':'')+'</button></div>';
}
function taskFormHtml_(d){
  return '<div class="tkEdit">'+
    '<input type="text" id="tk_title" maxlength="200" value="'+esc(d.title||'')+'" placeholder="'+esc(t('Task'))+'">'+
    '<textarea id="tk_notes" maxlength="500" rows="2" placeholder="'+esc(t('Details (optional)'))+'">'+esc(d.notes||'')+'</textarea>'+
    '<div class="tkEditRow"><input type="date" id="tk_due" value="'+esc(d.due||'')+'" aria-label="'+esc(t('Due date'))+'">'+
    '<select id="tk_goal" aria-label="'+esc(t('Goal'))+'">'+taskGoalOptions_(d.goalId||'')+'</select></div>'+
    '<div class="tkEditRow"><button class="btn small" id="tkSaveBtn">'+esc(t('Save'))+'</button>'+
    '<button class="linkbtn inline" id="tkCancelBtn">'+esc(t('Cancel'))+'</button>'+
    '<span style="flex:1"></span><button class="danger" id="tkDeleteBtn">'+esc(t('Delete'))+'</button></div></div>';
}
function tasksTabHtml_(){
  var year=new Date().getFullYear();
  var filter=S.taskFilter||'all';
  var goals=S.smartGoals.filter(function(g){ return Number(g.year)===year; });
  if(filter!=='all' && filter!=='other' && !goalById_(filter)) filter='all';
  var all=S.tasks||[];
  var h='<div class="catChips tkChips">'+
    '<button class="catChip'+(filter==='all'?' on':'')+'" data-taskfilter="all">'+esc(t('All'))+'</button>'+
    goals.map(function(g){ return '<button class="catChip'+(filter===g.id?' on':'')+'" data-taskfilter="'+esc(g.id)+'">🎯 '+esc(g.title.length>22?g.title.slice(0,21)+'…':g.title)+'</button>'; }).join('')+
    (all.some(function(x){ return !x.goalId; }) ? '<button class="catChip'+(filter==='other'?' on':'')+'" data-taskfilter="other">'+esc(t('Other tasks'))+'</button>' : '')+
    '</div>';
  var list=all.filter(function(x){
    if(filter==='all') return true;
    if(filter==='other') return !x.goalId;
    return x.goalId===filter;
  });
  var fg=goalById_(filter);
  if(fg) h+='<div class="card slim tkGoalHead"><div class="smartTitle" style="margin:0">🎯 '+esc(fg.title)+'</div><div class="bar" style="margin-top:6px"><div class="barFill'+(fg.pct>=100?' done':'')+'" style="width:'+fg.pct+'%"></div></div><div class="pmeta">'+esc(smartProgressLine_(fg))+'</div></div>';

  /* add a task: type and press Enter — the date and goal are there if you want them */
  var nd=S.taskNew||{title:'', due:'', goalId:(fg?fg.id:'')};
  h+='<div class="card tkAddCard"><div class="tkAdd"><span class="tkPlus">＋</span>'+
    '<input type="text" id="taskNewTitle" maxlength="200" value="'+esc(nd.title||'')+'" placeholder="'+esc(t('Add a task'))+'" autocomplete="off">'+
    '<button class="btn small" id="taskAddBtn">'+esc(t('Add'))+'</button></div>'+
    '<div class="tkEditRow"><input type="date" id="taskNewDue" value="'+esc(nd.due||'')+'" aria-label="'+esc(t('Due date'))+'">'+
    (fg ? '' : '<select id="taskNewGoal" aria-label="'+esc(t('Goal'))+'">'+taskGoalOptions_(nd.goalId||'')+'</select>')+'</div></div>';

  var today=tkToday_();
  var open=list.filter(function(x){ return !x.done; });
  var done=list.filter(function(x){ return x.done; }).sort(function(a,b){ return (b.doneAt||'')<(a.doneAt||'') ? -1 : 1; });
  var byDue=function(a,b){ if((a.due||'')!==(b.due||'')) return (a.due||'')<(b.due||'') ? -1 : 1; return (a.order||0)-(b.order||0); };
  var secs=[
    [t('Overdue'), open.filter(function(x){ return x.due && x.due<today; }).sort(byDue), 'late'],
    [t('Today'), open.filter(function(x){ return x.due===today; }).sort(byDue), ''],
    [t('Upcoming'), open.filter(function(x){ return x.due && x.due>today; }).sort(byDue), ''],
    [t('No date'), open.filter(function(x){ return !x.due; }).sort(byDue), '']
  ];
  var any=false;
  h+='<div class="card tkList">';
  secs.forEach(function(sec){
    if(!sec[1].length) return;
    any=true;
    h+='<div class="tkSecHead'+(sec[2]?' '+sec[2]:'')+'">'+esc(sec[0])+' <span class="tkCount">'+sec[1].length+'</span></div>';
    sec[1].forEach(function(x){ h+= S.taskEdit===x.id ? taskFormHtml_(S.taskEditDraft||x) : taskRowHtml_(x); });
  });
  if(!any) h+='<p class="sub" style="margin:4px 0">'+esc(all.length ? t('All done here. Add the next thing above.') : t('Nothing here yet. Add a task above — link it to a goal and the goal moves as you tick it off.'))+'</p>';
  if(done.length){
    h+='<button class="tkDoneToggle" id="tasksDoneToggle">'+esc(gpT('Completed ({n})',{n:done.length}))+' <span class="chev">'+(S.tasksDoneOpen?'▴':'▾')+'</span></button>';
    if(S.tasksDoneOpen){
      done.forEach(function(x){ h+= S.taskEdit===x.id ? taskFormHtml_(S.taskEditDraft||x) : taskRowHtml_(x); });
      h+='<button class="linkbtn inline" id="tasksClearDone" style="margin-top:8px">'+esc(t('Clear completed'))+'</button>';
    }
  }
  h+='</div>';
  return h;
}

/* Who you mentor, and who mentors you — from the redesign mockup. The data
   already exists (S.mentees from getMyMentees, S.me.mentorId from the
   profile); this just gives it a home on My Home instead of only living
   on Team. Tapping a mentee opens their page the same way Team's directory
   does — it just also has to switch tabs to get there. */
/* A 1-on-1 icon button next to a mentor/mentee row — either side of the
   relationship can ask the other for a 1-on-1, so this shows up in both
   "You're Mentoring" and "Your Mentor". Suppressed once a request between
   these two is already pending, so the row can't be double-tapped. */
function oneOnOneBtnHtml(personId){
  var open=(S.oneOnOnes||[]).filter(function(o){ return o.otherId===personId && ooOpen_(o); })[0];
  if(open) return '<button class="openBtn ooHas" data-ooopen="'+esc(open.id)+'" aria-label="'+esc(t('Open the 1-on-1'))+'">☕<i class="ooBadge"></i></button>';
  return '<button class="openBtn" data-request121="'+esc(personId)+'" aria-label="'+esc(t('Set up a 1-on-1'))+'">☕</button>';
}

/* My Home's Mentorship card: a short summary — who mentors you, how many you
   mentor, what is waiting — that opens the Mentorship page, where everything
   about mentoring and 1-on-1s lives (Oct 2026, Uriah: "one area for easy access"). */
function mentorWaitingN_(){
  var oo=(S.oneOnOnes||[]).filter(function(o){ return !o.mine && o.status==='pending'; }).length;
  return oo+(S.mentorRequests||[]).length+(S.tripRequests||[]).length+((S.stuMentor && S.stuMentor.requests)||[]).length;
}
function mentorshipCardHtml(){
  var h='<h3 id="sec-mentor">'+esc(t('Mentorship'))+'</h3><div class="card mentorSum">';
  var waiting=mentorWaitingN_(), coming=(S.oneOnOnes||[]).filter(function(o){ return ooOpen_(o) && !(o.status==='pending' && !o.mine); }).length;
  if(S.me.mentorId){
    var m=personOf(S.me.mentorId);
    h+='<div class="mentorLabel">'+esc(t('Your Mentor'))+'</div><div class="mentorBlock" style="padding-bottom:8px">'+avatarHtml(m||{name:nameOf(S.me.mentorId)},'sm')+
      '<div style="flex:1"><div class="mentorName">'+esc(m?m.name:nameOf(S.me.mentorId))+'</div>'+ooMonthHtml_(S.me.id)+'</div></div>';
  } else h+='<div class="emptyLine" style="margin-bottom:8px">'+esc(t('No mentor set yet.'))+'</div>';
  if(S.mentees && S.mentees.length) h+='<div class="mentorSumLine">🤝 '+esc(S.mentees.length===1 ? t("You're mentoring 1 person") : gpT("You're mentoring {n} people",{n:S.mentees.length}))+'</div>';
  if(waiting) h+='<div class="mentorSumLine warn">🔔 '+esc(waiting===1 ? t('1 request waiting for you') : gpT('{n} requests waiting for you',{n:waiting}))+'</div>';
  if(coming) h+='<div class="mentorSumLine">☕ '+esc(coming===1 ? t('1 1-on-1 coming up') : gpT('{n} 1-on-1s coming up',{n:coming}))+'</div>';
  return h+'<button class="btn'+(waiting?'':' ghost')+'" id="goMentorshipHome" data-gomentorship="1" style="margin:8px 0 0">🤝 '+esc(t('Open Mentorship'))+' ›</button></div>';
}

/* ---------- 1-on-1s (Oct 2026) ----------
   Uriah: every mentee should have at least two 1-on-1s a month, and each one
   should have a little structure. The mentee fills in a short check-in when
   they ask for one (or right after accepting one): six areas of life and YWAM GP's
   five values — FIGHT: Faithful, Innovative, Generous, Humble, Tenacious —
   each 1-5, plus what they'd like help with and what they're working toward.
   The mentor sees it beside their goals and last time's follow-ups, then marks
   the 1-on-1 done with notes and things to follow up next time. A month counts
   by the day it was held (heldOn). Only the pair ever sees the words (api.js). */
var OO_AREAS=[ {id:'money',emoji:'💰',label:'Fundraising & finances'}, {id:'language',emoji:'🗣️',label:'Language study'},
  {id:'physical',emoji:'💪',label:'Physical health'}, {id:'emotional',emoji:'💛',label:'Emotional health'},
  {id:'relational',emoji:'🤝',label:'Relationships'}, {id:'spiritual',emoji:'🙏',label:'Spiritual life'} ];
/* YWAM GP's values, FIGHT — v2 (Oct 2026, with Uriah): each with its statement, three
   "I…" behaviours to rate yourself against, a verse and a guardrail (what it is
   not). English and YWAM GP's Khmer side by side rather than through t(): the Khmer
   names are YWAM GP's own and stay as they are (ការចុះចូល — submitting to and
   honouring one another). They build on each other: OO_FLOW. */
var OO_FLOW={ en:"They build on each other: start with yourself (Faithful), keep improving (Innovative), from a heart to serve (Generous), open to correction (Humble), and never give up (Tenacious).", km:"ចាប់ផ្តើមពីខ្លួនឯង (ស្មោះត្រង់) → បន្តរីកចម្រើន (គំនិតច្នៃប្រឌិត) → ឱ្យសេចក្តីស្រឡាញ់ជំរុញចិត្ត (សប្បុរស) → ទទួលយកការកែតម្រូវ (ការចុះចូល) → ស្តាប់ ស្តាប់បង្គាប់ ហើយកុំបោះបង់ (ការខិតខំប្រឹងប្រែង)។" };
var OO_VALUES=[
  { id:'faithful', letter:'F', label:"Faithful", km:"ស្មោះត្រង់",
    say:"We’re committed to living disciplined lives, responsible for how we steward our time, talents and treasures, to stay healthy for the long term. Change starts with us: we look honestly at ourselves before we judge anyone else.",
    sayKm:"យើងប្តេជ្ញាចិត្តក្នុងការរស់នៅប្រកបដោយវិន័យ និងទទួលខុសត្រូវចំពោះ ពេលវេលា សមត្ថភាព និងទ្រព្យសម្បត្តិរបស់យើង ដើម្បីរក្សាសុខភាពល្អបានយូរអង្វែង។ ការផ្លាស់ប្តូរចាប់ផ្តើមពីយើង៖ យើងពិនិត្យមើលខ្លួនឯងដោយស្មោះត្រង់ មុននឹងវិនិច្ឆ័យអ្នកដទៃ។",
    does:["I change what I can in myself before I critique others.", "I’m on time, and I finish what I said I’d do.", "I lead myself well (rest, health, self-control), even when no one is watching."],
    doesKm:["ខ្ញុំផ្លាស់ប្តូរអ្វីដែលខ្ញុំអាចផ្លាស់ប្តូរបាននៅក្នុងខ្លួនខ្ញុំ មុននឹងរិះគន់អ្នកដទៃ។", "ខ្ញុំមកទាន់ពេល ហើយខ្ញុំធ្វើឱ្យចប់ នូវអ្វីដែលខ្ញុំបាននិយាយថានឹងធ្វើ។", "ខ្ញុំដឹកនាំខ្លួនឯងបានល្អ (ការសម្រាក សុខភាព និងការគ្រប់គ្រងខ្លួនឯង) ទោះបីជាគ្មាននរណាម្នាក់មើលឃើញក៏ដោយ។"],
    verse:"Luke 16:10 — Whoever is faithful in small things will be faithful in big things.", verseKm:"លូកា ១៦:១០ — អ្នកណាដែលស្មោះត្រង់ក្នុងរឿងតូច ក៏នឹងស្មោះត្រង់ក្នុងរឿងធំដែរ។",
    not:"Not perfectionism or burnout. Faithful is steady, not frantic, and rest is part of it. Honest self-evaluation, never self-condemnation.", notKm:"មិនមែនជាការចង់បានភាពល្អឥតខ្ចោះ ឬការធ្វើការរហូតដល់អស់កម្លាំងទេ។ ស្មោះត្រង់ មានភាពនឹងនរ មិនប្រញាប់ប្រញាល់ ហើយការសម្រាកក៏ជាផ្នែកមួយរបស់វា។ ពិនិត្យខ្លួនឯងដោយស្មោះត្រង់ តែមិនដាក់ទោសខ្លួនឯងទេ។" },
  { id:'innovative', letter:'I', label:"Innovative", km:"គំនិតច្នៃប្រឌិត",
    say:"We use systems and technology, from social media to AI, to maximize organizational clarity, unity and impact, so more people are reached and discipled. We never settle for comfortable; we keep improving.",
    sayKm:"យើងប្រើប្រាស់ប្រព័ន្ធទំនើប និងបច្ចេកវិទ្យា ចាប់ពីបណ្តាញសង្គម រហូតដល់បញ្ញាសិប្បនិម្មិត ដើម្បីបង្កើនភាពច្បាស់លាស់ ការរួបរួម និងឥទ្ធិពលរបស់យើង ដើម្បីឱ្យមនុស្សកាន់តែច្រើន បានឮដំណឹងល្អ និងក្លាយជាសិស្សរបស់ព្រះយេស៊ូវ។ យើងមិនដែលស្កប់ចិត្តនឹងភាពស្រួលស្រាលទេ យើងបន្តកែលម្អជានិច្ច។",
    does:["I learn and use the tools we have (the app, social media, AI) to serve the mission.", "I don’t settle for comfortable. I look for one thing to do better.", "I try a new idea before I say no."],
    doesKm:["ខ្ញុំរៀន និងប្រើឧបករណ៍ដែលយើងមាន (កម្មវិធី បណ្តាញសង្គម និង AI) ដើម្បីបម្រើបេសកកម្ម។", "ខ្ញុំមិនស្កប់ចិត្តនឹងភាពស្រួលទេ។ ខ្ញុំរកមើលរឿងមួយ ដែលខ្ញុំអាចធ្វើបានល្អជាងមុន។", "ខ្ញុំសាកល្បងគំនិតថ្មី មុននឹងនិយាយថា ទេ។"],
    verse:"Isaiah 43:19 — See, I am doing a new thing.", verseKm:"អេសាយ ៤៣:១៩ — ព្រះមានបន្ទូលថា ទ្រង់កំពុងធ្វើការថ្មីមួយ។",
    not:"Not tech for its own sake, or change for change’s sake. Tools serve people and the mission.", notKm:"មិនមែនជាការប្រើបច្ចេកវិទ្យា ដើម្បីតែបច្ចេកវិទ្យា ឬការផ្លាស់ប្តូរ ដើម្បីតែការផ្លាស់ប្តូរទេ។ ឧបករណ៍ត្រូវបម្រើមនុស្ស និងបេសកកម្ម។" },
  { id:'generous', letter:'G', label:"Generous", km:"សប្បុរស",
    say:"We give sacrificially of our time, talents and treasures, and love others as ourselves. Nation over location: we protect unity across YWAM GP and the wider Church over growing our own ministry.",
    sayKm:"យើងលះបង់ពេលវេលា សមត្ថភាព និងទ្រព្យសម្បត្ដិរបស់យើង ហើយស្រឡាញ់អ្នកដទៃដូចស្រឡាញ់ខ្លួនយើង។ ផ្តល់អាទិភាពដល់ប្រទេសលើតំបន់៖ យើងការពារការរួបរួមនៅ YWAM GP និងនៅក្នុងពួកជំនុំរបស់ព្រះគ្រីស្ទទាំងមូល ជាជាងពង្រីកកិច្ចការបម្រើផ្ទាល់ខ្លួនរបស់យើង។",
    does:["I welcome people (guests, teams, new staff) like family.", "I put YWAM GP’s unity and the bigger mission over growing my own ministry.", "I share what I have (time, skills and money), even when it costs me."],
    doesKm:["ខ្ញុំស្វាគមន៍មនុស្ស (ភ្ញៀវ ក្រុមនានា និងបុគ្គលិកថ្មី) ដូចជាក្រុមគ្រួសារ។", "ខ្ញុំផ្តល់អាទិភាពដល់ការរួបរួមរបស់ YWAM GP និងបេសកកម្មដ៏ធំ លើការពង្រីកកិច្ចការបម្រើផ្ទាល់ខ្លួនរបស់ខ្ញុំ។", "ខ្ញុំចែករំលែកអ្វីដែលខ្ញុំមាន (ពេលវេលា ជំនាញ និងលុយ) ទោះបីជាវាធ្វើឱ្យខ្ញុំខាតក៏ដោយ។"],
    verse:"Acts 4:32 — All the believers were one in heart and mind, and shared everything they had.", verseKm:"កិច្ចការ ៤:៣២ — អ្នកជឿទាំងអស់មានចិត្ត និងគំនិតតែមួយ ហើយពួកគេចែករំលែកអ្វីៗទាំងអស់ដែលពួកគេមាន។",
    not:"Not giving to be seen, or saying yes to everything. Generous people still keep healthy limits.", notKm:"មិនមែនជាការឱ្យ ដើម្បីឱ្យគេមើលឃើញ ឬការឆ្លើយព្រមគ្រប់រឿងទេ។ មនុស្សសប្បុរស នៅតែរក្សាព្រំដែនដែលល្អ។" },
  { id:'humble', letter:'H', label:"Humble", km:"ការចុះចូល",
    say:"We submit to one another and practice radical honesty: living transparently and vulnerably, even about our sexuality and our finances, and asking for feedback regularly. We walk in the light: not hiding, but being known.",
    sayKm:"យើងចុះចូលនឹងគ្នាទៅវិញទៅមក ហើយក្លាហានក្នុងការនិយាយ និងទទួលយកការពិតនៅក្នុងជីវិត៖ យើងរស់នៅដោយបើកចំហ និងមិនលាក់បាំង សូម្បីតែអំពីផ្លូវភេទ និងហិរញ្ញវត្ថុរបស់យើង ហើយសុំមតិកែលម្អជាប្រចាំ។ ដូចនៅក្នុង ១យ៉ូហាន ជំពូក ១ យើងដើរក្នុងពន្លឺ៖ មិនលាក់ខ្លួនទេ តែឱ្យគេស្គាល់យើង។",
    does:["I’m open about my life, including my sexuality and finances, with my mentor and my community.", "I ask for feedback and receive correction without defending myself.", "I ask questions more than I give opinions, and I’d rather be real than right."],
    doesKm:["ខ្ញុំបើកចំហអំពីជីវិតរបស់ខ្ញុំ រួមទាំងផ្លូវភេទ និងហិរញ្ញវត្ថុ ជាមួយអ្នកណែនាំ និងសហគមន៍របស់ខ្ញុំ។", "ខ្ញុំសុំមតិកែលម្អ ហើយទទួលយកការកែតម្រូវ ដោយមិនការពារខ្លួន។", "ខ្ញុំសួរសំណួរច្រើនជាងឱ្យយោបល់ ហើយខ្ញុំចង់ជាខ្លួនឯងពិតៗ ជាជាងចង់ជាអ្នកត្រូវ។"],
    verse:"1 John 1:7 — If we walk in the light, we have fellowship with one another.", verseKm:"១យ៉ូហាន ១:៧ — បើយើងដើរក្នុងពន្លឺ យើងមានសេចក្តីប្រកបជាមួយគ្នាទៅវិញទៅមក។",
    not:"Not shaming, or calling people out in public, and not putting yourself down. Openness is safe, private and full of grace.", notKm:"មិនមែនជាការធ្វើឱ្យគេអាម៉ាស់ ការចង្អុលកំហុសគេនៅមុខមនុស្ស ឬការមើលងាយខ្លួនឯងទេ។ ការបើកចំហ មានសុវត្ថិភាព ជារឿងឯកជន និងពោរពេញដោយព្រះគុណ។" },
  { id:'tenacious', letter:'T', label:"Tenacious", km:"ការខិតខំប្រឹងប្រែង",
    say:"We’re driven by love to become all God has created us to be and accomplish all he’s called us to do. We hear and obey, and we don’t give up: grit, passion and perseverance for the long haul.",
    sayKm:"យើងត្រូវបានជំរុញដោយសេចក្តីស្រឡាញ់ ដើម្បីអភិវឌ្ឍខ្លួនឯង ឱ្យក្លាយជាមនុស្សដែលព្រះបានបង្កើតយើងមក និងសម្រេចបាននូវអ្វីដែលទ្រង់បានត្រាស់ហៅយើងឱ្យធ្វើ។ យើងស្តាប់ ហើយស្តាប់បង្គាប់ ហើយយើងមិនបោះបង់ទេ៖ ចិត្តតស៊ូ ចិត្តស្រឡាញ់យ៉ាងខ្លាំង និងការព្យាយាមជាប់លាប់ សម្រាប់ផ្លូវវែង។",
    does:["I listen to God and do what he says, even when it’s hard.", "I keep going through hard seasons and finish what God gave me.", "I keep growing, reading and learning, so my life bears fruit."],
    doesKm:["ខ្ញុំស្តាប់ព្រះ ហើយធ្វើតាមអ្វីដែលទ្រង់មានបន្ទូល ទោះបីជាវាពិបាកក៏ដោយ។", "ខ្ញុំបន្តទៅមុខ ឆ្លងកាត់រដូវដ៏ពិបាក ហើយបញ្ចប់អ្វីដែលព្រះបានប្រគល់ឱ្យខ្ញុំ។", "ខ្ញុំបន្តរីកលូតលាស់ អាន និងរៀន ដើម្បីឱ្យជីវិតរបស់ខ្ញុំបង្កើតផល។"],
    verse:"Galatians 6:9 — Don’t grow weary of doing good; at the right time we will reap, if we don’t give up.", verseKm:"កាឡាទី ៦:៩ — កុំណាយចិត្តក្នុងការធ្វើល្អឡើយ ព្រោះដល់ពេលកំណត់ យើងនឹងច្រូតកាត់ផល បើយើងមិនបោះបង់។",
    not:"Not stubbornness or workaholism. Grit listens to God, rests, and changes course when he says so.", notKm:"មិនមែនជាភាពរឹងរូស ឬការញៀនការងារទេ។ ចិត្តតស៊ូ ស្តាប់ព្រះ សម្រាក ហើយប្តូរទិសដៅ ពេលទ្រង់មានបន្ទូលប្រាប់។" }
];
function ooValName_(v){ return LANG==='km' ? v.km : v.label; }
var OO_PER_MONTH=2;
function ooById_(id){ return (S.oneOnOnes||[]).filter(function(o){ return o.id===id; })[0]||null; }
function ooHeldThisMonth_(menteeId){
  var m=todayStr().slice(0,7);
  return (S.oneOnOnes||[]).filter(function(o){ return o.status==='held' && o.menteeId===menteeId && String(o.heldOn||'').slice(0,7)===m; }).length;
}
/* ●○ 1 of 2 1-on-1s this month */
function ooMonthHtml_(menteeId){
  var n=ooHeldThisMonth_(menteeId), dots='', ok=n>=OO_PER_MONTH;
  for(var i=0;i<Math.max(OO_PER_MONTH,n);i++) dots+='<i class="ooDot'+(i<n?' on':'')+'"></i>';
  return '<div class="ooMonth'+(ok?' ok':'')+'">'+dots+'<span class="ooTxt">'+
    esc(ok ? gpT('{n} 1-on-1s this month ✓',{n:n}) : gpT('{n} of {target} 1-on-1s this month',{n:n,target:OO_PER_MONTH}))+'</span></div>';
}
/* A 1-on-1's day on Cambodia's calendar: the day it was held, else the day it was
   asked. heldOn is a Phnom Penh date already; `created` is a UTC timestamp, whose
   first ten characters are the UTC date — between midnight and 7am that was
   yesterday, so a request made just now sorted (and showed) before one held today. */
function ooDay_(o){
  if(o.heldOn) return o.heldOn;
  var c=String(o.created||''); if(!c) return '';
  var d=new Date(new Date(c).getTime()+7*3600000);
  return isNaN(d) ? c.slice(0,10) : d.toISOString().slice(0,10);
}
/* every 1-on-1 of one mentee, newest first (by the day held, else asked) */
function ooPairRows_(menteeId){
  var key=function(o){ return ooDay_(o)+'|'+(o.created||''); };
  return (S.oneOnOnes||[]).filter(function(o){ return o.menteeId===menteeId && o.status!=='declined'; })
    .sort(function(a,b){ return key(a)<key(b) ? 1 : -1; });
}
function ooOpen_(o){ return o.status==='pending' || o.status==='accepted'; }
function ooLastPrep_(menteeId, cur){
  var rows=ooPairRows_(menteeId), k=cur ? rows.indexOf(cur)+1 : 0;
  for(; k<rows.length; k++) if(rows[k].prep) return rows[k].prep;
  return null;
}
function ooLastFollow_(menteeId, cur){
  var rows=ooPairRows_(menteeId), k=cur ? rows.indexOf(cur)+1 : 0;
  for(; k<rows.length; k++) if(rows[k].status==='held' && (rows[k].followUps||[]).length) return rows[k];
  return null;
}
function ooGo_(id, withId){
  if(S.view!=='oneonone') S.ooBack=S.view;
  S.view='oneonone'; S.ooId=id||null; S.ooWith=withId||null; S.ooEditPrep=null; S.bellOpen=false;
  render(); window.scrollTo(0,0);
}
/* The mentee's check-in being written — kept on S so a tap on a 1-5 button
   (which re-renders) never loses what they have typed. */
function ooDraft_(key, from){
  if(!S.ooDrafts) S.ooDrafts={};
  if(!S.ooDrafts[key]){
    var p=from||{};
    S.ooDrafts[key]={ areas:JSON.parse(JSON.stringify(p.areas||{})), values:JSON.parse(JSON.stringify(p.values||{})),
      helpWith:p.helpWith||'', workingOn:p.workingOn||'', other:p.other||'', note:'' };
  }
  return S.ooDrafts[key];
}
function ooNotesDraft_(key, o){
  if(!S.ooNotes) S.ooNotes={};
  if(!S.ooNotes[key]){
    S.ooNotes[key]={ heldOn:(o&&o.heldOn)||todayStr(), notes:(o&&o.notes)||'',
      followUps:((o&&o.followUps)||[]).map(function(f){ return f.text; }) };
    if(!S.ooNotes[key].followUps.length) S.ooNotes[key].followUps=[''];
  }
  return S.ooNotes[key];
}
function ooScaleRowHtml_(kind, id, labelHtml, val){
  var b=''; for(var n=1;n<=5;n++) b+='<button type="button" data-'+kind+'="'+id+'|'+n+'" class="'+(val===n?'on':'')+'" aria-label="'+n+'">'+n+'</button>';
  return '<div class="ooQ"><div class="ooQLabel">'+labelHtml+'</div><div class="scale ooScale">'+b+'</div></div>';
}
function ooPrepFormHtml_(key, d){
  var h='<p class="sub" style="margin:2px 0 6px">'+esc(t('A quick, honest check-in, so your 1-on-1 can focus on what matters. 1 = struggling · 5 = thriving.'))+'</p>';
  h+='<div class="mentorLabel" style="margin-top:8px">'+esc(t('How I’m doing'))+'</div>';
  OO_AREAS.forEach(function(a){ h+=ooScaleRowHtml_('ooarea', a.id, a.emoji+' '+esc(t(a.label)), d.areas[a.id]); });
  h+='<div class="mentorLabel" style="margin-top:14px">'+esc(t('Living our values — FIGHT'))+'</div>'+
    '<p class="sub ooFlow">'+esc(LANG==='km' ? OO_FLOW.km : OO_FLOW.en)+'</p>';
  OO_VALUES.forEach(function(v){
    var km=LANG==='km', b=''; for(var n=1;n<=5;n++) b+='<button type="button" data-ooval="'+v.id+'|'+n+'" class="'+(d.values[v.id]===n?'on':'')+'" aria-label="'+n+'">'+n+'</button>';
    h+='<div class="ooQ ooQv"><div class="ooQLabel"><b class="ooLetter">'+v.letter+'</b>'+esc(ooValName_(v))+'</div>'+
      '<div class="ooVSay">'+esc(km ? v.sayKm : v.say)+'</div>'+
      '<ul class="ooBeh">'+(km ? v.doesKm : v.does).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'+
      '<details class="ooMore"><summary>📖 '+esc(t('Verse · what it isn’t'))+'</summary>'+
        '<div class="ooVerse">'+esc(km ? v.verseKm : v.verse)+'</div><div class="ooNot">🚧 '+esc(km ? v.notKm : v.not)+'</div></details>'+
      '<div class="scale ooScale">'+b+'</div></div>';
  });
  h+='<label class="f" style="margin-top:14px">'+esc(t('Is there anything specific you’d like help with?'))+'</label>'+
    '<textarea data-oodraft="helpWith" maxlength="600" rows="2">'+esc(d.helpWith)+'</textarea>'+
    '<label class="f">'+esc(t('What are you working toward right now? (your personal goals)'))+'</label>'+
    '<textarea data-oodraft="workingOn" maxlength="600" rows="2">'+esc(d.workingOn)+'</textarea>'+
    '<label class="f">'+esc(t('Anything else your mentor should know? (optional)'))+'</label>'+
    '<textarea data-oodraft="other" maxlength="600" rows="2">'+esc(d.other)+'</textarea>';
  return h;
}
function ooTrendHtml_(n, was){
  if(!was || !n || n===was) return '';
  return '<span class="ooTrend '+(n>was?'up':'down')+'">'+(n>was?'▲':'▼')+Math.abs(n-was)+'</span>';
}
function ooPrepSummaryHtml_(p, prev){
  prev=prev||{areas:{},values:{}};
  var h='<div class="mentorLabel">'+esc(t('How I’m doing'))+'</div>';
  OO_AREAS.forEach(function(a){
    var n=p.areas&&p.areas[a.id], segs='';
    for(var i=1;i<=5;i++) segs+='<i class="'+(n&&i<=n?'on s'+(n<=2?'lo':n===3?'mid':'hi'):'')+'"></i>';
    h+='<div class="ooSum"><span class="ooSumLabel">'+a.emoji+' '+esc(t(a.label))+'</span><span class="ooSegs">'+segs+'</span>'+
      '<span class="ooSumN">'+(n?n+'/5':'—')+ooTrendHtml_(n, prev.areas&&prev.areas[a.id])+'</span></div>';
  });
  h+='<div class="mentorLabel" style="margin-top:12px">'+esc(t('Living our values — FIGHT'))+'</div><div class="ooVals">';
  OO_VALUES.forEach(function(v){
    var n=p.values&&p.values[v.id];
    h+='<div class="ooVal'+(n&&n<=2?' lo':'')+'"><b>'+v.letter+'</b><span>'+(n||'—')+ooTrendHtml_(n, prev.values&&prev.values[v.id])+'</span><small>'+esc(ooValName_(v))+'</small></div>';
  });
  h+='</div>';
  [['helpWith','Would like help with'],['workingOn','Working toward'],['other','Also']].forEach(function(q){
    if(p[q[0]]) h+='<div class="ooQuoteLabel">'+esc(t(q[1]))+'</div><div class="ooQuote">'+esc(p[q[0]])+'</div>';
  });
  return h;
}
function ooNotesFormHtml_(key){
  var d=ooNotesDraft_(key, key.indexOf('new:')===0 ? null : ooById_(key));
  var h='<label class="f">'+esc(t('Date you met'))+'</label><input type="date" id="ooHeldOn" max="'+todayStr()+'" value="'+esc(d.heldOn)+'">'+
    '<label class="f">'+esc(t('Notes'))+'</label>'+
    '<textarea data-oonote="notes" maxlength="2000" rows="4" placeholder="'+esc(t('What did you talk about? What stood out?'))+'">'+esc(d.notes)+'</textarea>'+
    '<label class="f">'+esc(t('To follow up next time'))+'</label>';
  d.followUps.forEach(function(f,i){
    h+='<input type="text" class="ooFuIn" maxlength="200" data-oofu="'+i+'" value="'+esc(f)+'" placeholder="'+esc(t('Something they are growing in, or will try'))+'">';
  });
  if(d.followUps.length<10) h+='<button class="linkbtn inline" id="ooFuAdd" style="display:block;margin:4px 0 8px">＋ '+esc(t('Add another'))+'</button>';
  return h+'<p class="hint" style="margin-top:6px">🔒 '+esc(t('Only the two of you see the check-in and these notes.'))+'</p>';
}
function ooFollowUpsHtml_(o, canTick){
  return (o.followUps||[]).map(function(f,i){
    return '<button class="ooFu'+(f.done?' done':'')+'"'+(canTick?' data-ootick="'+esc(o.id)+'|'+i+'"':' disabled')+'><span class="ooTick">'+(f.done?'✓':'')+'</span>'+esc(f.text)+'</button>';
  }).join('');
}
function ooStatusHtml_(o){
  if(o.status==='held') return '<span class="pill approved">'+esc(gpT('Done · {date}',{date:fmtDateShort_(o.heldOn)}))+'</span>';
  if(o.status==='accepted') return '<span class="pill approved">'+esc(t('Accepted'))+'</span>';
  if(o.status==='declined') return '<span class="pill denied">'+esc(t('Declined'))+'</span>';
  return '<span class="pill pending">'+esc(o.mine ? gpT('Sent · waiting for {name}',{name:String(o.otherName||'').split(' ')[0]}) : t('Waiting for you to accept'))+'</span>';
}
function ooGoalsHtml_(goals){
  var yr=new Date().getFullYear();
  goals=(goals||[]).filter(function(g){ return Number(g.year)===yr; });
  if(!goals.length) return '<p class="sub" style="margin:4px 0">'+esc(t('No goals for this year yet.'))+'</p>';
  return goals.map(function(g){
    return '<div class="smartGoal"><div class="smartTitle">'+esc(g.title)+'</div>'+
      '<div class="bar"><div class="barFill'+(g.pct>=100?' done':'')+'" style="width:'+(g.pct||0)+'%"></div></div>'+
      '<div class="smartActions"><span class="smartPct">'+esc(smartProgressLine_(g))+'</span></div></div>';
  }).join('');
}
function oneOnOneHtml(){
  var o=S.ooId ? ooById_(S.ooId) : null;
  var withId=o ? o.otherId : S.ooWith;
  var who=personOf(withId), name=who ? who.name : (o ? o.otherName : nameOf(withId)), first=String(name||'').split(' ')[0];
  var iMentor=o ? o.iMentor : (S.mentees||[]).some(function(p){ return p.id===withId; });
  var menteeId=o ? o.menteeId : (iMentor ? withId : S.me.id);
  var h='<button class="linkbtn" id="ooBack" style="text-align:left;text-decoration:none">← '+esc(t('Back'))+'</button>';
  h+='<div class="card ooHead"><div class="mentorBlock" style="padding:0">'+avatarHtml(who||{name:name},'sm')+
    '<div style="flex:1"><div class="mentorName">☕ '+esc(gpT('1-on-1 with {name}',{name:name}))+'</div>'+
    '<div class="mentorMeta">'+esc(iMentor ? gpT('You mentor {name}',{name:first}) : gpT('{name} is your mentor',{name:first}))+'</div>'+
    (o ? '<div class="mentorMeta">'+ooStatusHtml_(o)+(o.note?' · “'+esc(o.note)+'”':'')+'</div>' : '')+'</div></div>'+
    ooMonthHtml_(menteeId)+'</div>';

  var last=ooLastFollow_(menteeId, o);
  var lastHtml = last ? '<h3>🔁 '+esc(t('From last time'))+' <small>· '+esc(last.heldOn)+'</small></h3><div class="card">'+
    '<p class="sub" style="margin:0 0 6px">'+esc(t('Things you said you’d follow up — tick what’s done.'))+'</p>'+ooFollowUpsHtml_(last, true)+'</div>' : '';

  if(!o){
    if(!iMentor){
      var d=ooDraft_('new:'+withId, ooLastPrep_(S.me.id));
      h+='<div class="banner ooWho">☕ <b>'+esc(gpT('You are asking {name}, your mentor, for a 1-on-1.',{name:first}))+'</b><br>'+
        esc(gpT('Fill in this short check-in first — {name} sees it with your request, so your time together can focus on what matters.',{name:first}))+'</div>';
      h+='<h3>📝 '+esc(t('Your check-in'))+'</h3><div class="card">'+ooPrepFormHtml_('new:'+withId, d)+
        '<label class="f">'+esc(gpT('A note for {name} (optional)',{name:first}))+'</label>'+
        '<input type="text" data-oodraft="note" maxlength="300" value="'+esc(d.note)+'" placeholder="'+esc(t('e.g. Can we meet this week?'))+'">'+
        '<button class="btn" id="ooSend">☕ '+esc(gpT('Send my request to {name}',{name:first}))+'</button></div>';
      return h+lastHtml;
    }
    h+=lastHtml;
    h+='<div class="card"><p class="sub" style="margin:0 0 8px"><b>'+esc(gpT('You are asking {name}, who you mentor, to meet.',{name:first}))+'</b> '+
      esc(gpT('{name} gets your request, fills in a short check-in, and you see how they’re doing before you meet.',{name:first}))+'</p>'+
      '<button class="btn" id="ooAsk" style="margin:0">☕ '+esc(gpT('Send {name} a 1-on-1 request',{name:first}))+'</button></div>';
    h+='<h3 id="ooLogHead">✍️ '+esc(t('Already met? Log it'))+'</h3><div class="card">'+ooNotesFormHtml_('new:'+withId)+
      '<button class="btn" id="ooLog">'+esc(t('Save this 1-on-1'))+'</button></div>';
    return h;
  }

  if(!o.mine && o.status==='pending'){
    h+='<div class="card"><p class="sub" style="margin:0 0 8px">'+esc(ooAskedYouText_(o))+'</p>'+
      '<div style="display:flex;gap:8px"><button class="btn" style="margin:0" data-121accept="'+esc(o.id)+'">'+esc(t('Accept'))+'</button>'+
      '<button class="btn ghost" style="margin:0" data-121decline="'+esc(o.id)+'">'+esc(t('Decline'))+'</button></div></div>';
  }

  var closed=o.status==='held' || o.status==='declined';
  h+='<h3>📝 '+esc(iMentor ? gpT('{name}’s check-in',{name:first}) : t('Your check-in'))+'</h3>';
  if(!iMentor && !closed && (!o.prep || S.ooEditPrep===o.id)){
    h+='<div class="card">'+ooPrepFormHtml_(o.id, ooDraft_(o.id, o.prep || ooLastPrep_(S.me.id, o)))+
      '<button class="btn" id="ooSavePrep" data-id="'+esc(o.id)+'">'+esc(t('Save my check-in'))+'</button></div>';
  } else if(o.prep){
    h+='<div class="card">'+ooPrepSummaryHtml_(o.prep, ooLastPrep_(menteeId, o))+
      (!iMentor && !closed ? '<button class="linkbtn inline" id="ooEditPrep" style="margin-top:10px">✏️ '+esc(t('Change my check-in'))+'</button>' : '')+'</div>';
  } else {
    h+='<div class="card"><p class="sub" style="margin:4px 0">'+esc(iMentor && !closed ? gpT('Waiting for {name} to fill in their check-in.',{name:first}) : t('No check-in for this one.'))+'</p></div>';
  }

  h+='<h3>🎯 '+esc(iMentor ? gpT('{name}’s goals this year',{name:first}) : t('Your goals this year'))+'</h3><div class="card">';
  if(iMentor) h+= (S.ooGoalsFor===menteeId && S.ooGoals) ? ooGoalsHtml_(S.ooGoals) : '<p class="sub" style="margin:4px 0">'+esc(t('Loading…'))+'</p>';
  else h+=ooGoalsHtml_(S.smartGoals);
  h+='</div>';

  h+=lastHtml;

  if(iMentor && o.status!=='declined'){
    h+='<h3>✍️ '+esc(o.status==='held' ? t('Notes and follow-ups') : t('When you meet'))+'</h3><div class="card">'+ooNotesFormHtml_(o.id)+
      '<button class="btn" id="ooSaveNotes" data-id="'+esc(o.id)+'">'+esc(o.status==='held' ? t('Save changes') : t('Mark as done ✓'))+'</button></div>';
  } else if(!iMentor && (o.notes || (o.followUps||[]).length)){
    h+='<h3>✍️ '+esc(t('Notes and follow-ups'))+'</h3><div class="card">'+
      (o.notes ? '<div class="ooQuote">'+esc(o.notes)+'</div>' : '')+
      ((o.followUps||[]).length ? '<div class="ooQuoteLabel">'+esc(t('To follow up next time'))+'</div>'+ooFollowUpsHtml_(o, true) : '')+'</div>';
  }
  return h;
}
/* Who asked whom, in words — "Sokha (who you mentor) is asking you for a
   1-on-1" or "Andrew, your mentor, is asking to meet you". */
function ooAskedYouText_(o){
  return o.iMentor ? gpT('{name}, who you mentor, is asking you for a 1-on-1',{name:o.otherName}) : gpT('{name}, your mentor, is asking to meet you for a 1-on-1',{name:o.otherName});
}
/* One line of a 1-on-1 history: the day, where it stands, a bit of the notes
   and how the follow-ups went. Opens its sheet. */
function ooHistRowHtml_(o){
  var when=ooDay_(o), fu=o.followUps||[], done=fu.filter(function(f){ return f.done; }).length;
  return '<button class="ooRow" data-ooopen="'+esc(o.id)+'"><span class="rowName"><b>'+esc(fmtDateShort_(when))+'</b> '+(o.status==='held' ? '<span class="pill approved">✓ '+esc(t('Done'))+'</span>' : ooStatusHtml_(o))+
    (o.notes ? '<div class="ooTodo" style="color:var(--muted)">'+esc(String(o.notes).slice(0,90))+(o.notes.length>90?'…':'')+'</div>' : '')+
    (fu.length ? '<div class="ooTodo" style="color:var(--faint)">'+esc(gpT('{done} of {n} follow-ups done',{done:done, n:fu.length}))+'</div>' : '')+
    '</span><span class="ooChev">›</span></button>';
}
function fmtDateShort_(iso){ var d=new Date(String(iso).slice(0,10)+'T00:00:00'); return isNaN(d) ? String(iso||'') : d.toLocaleDateString(LANG==='km'?'km-KH':'en-GB', { day:'numeric', month:'short', year:'numeric' }); }
/* On a mentee's page: this month's count, then their whole 1-on-1 history —
   what's still to happen first, then every one held, newest first. */
function ooMenteeSectionHtml_(m){
  var rows=ooPairRows_(m.id), first=String(m.name||'').split(' ')[0];
  var open=rows.filter(ooOpen_), held=rows.filter(function(o){ return o.status==='held'; });
  var h='<h3 id="ooHistory">☕ '+esc(t('1-on-1 history'))+' <small>· '+held.length+'</small></h3><div class="card">'+ooMonthHtml_(m.id);
  if(open.length) h+='<div class="mentorLabel" style="margin-top:10px">'+esc(t('Coming up'))+'</div>'+open.map(ooHistRowHtml_).join('');
  if(held.length){
    var all=S.ooHistAll===m.id, shown=all ? held : held.slice(0,10);
    h+='<div class="mentorLabel" style="margin-top:10px">'+esc(t('Held'))+'</div>'+shown.map(ooHistRowHtml_).join('')+
      (held.length>shown.length ? '<button class="linkbtn inline" data-oohistall="'+esc(m.id)+'" style="display:block;margin:6px 0 0">'+esc(gpT('Show all {n}',{n:held.length}))+'</button>' : '');
  } else if(!open.length) h+='<p class="sub" style="margin:10px 0 0">'+esc(gpT('No 1-on-1s with {name} yet.',{name:first}))+'</p>';
  return h+'<div class="ooActs"><button class="btn" style="margin:10px 0 0" data-request121="'+esc(m.id)+'">☕ '+esc(gpT('Ask {name} for a 1-on-1',{name:first}))+'</button>'+
    '<button class="btn ghost" style="margin:8px 0 0" data-oolog="'+esc(m.id)+'">✍️ '+esc(t('Log one you already had'))+'</button></div></div>';
}
/* The 1-on-1s still to happen, on the Mentorship page. */
function ooComingHtml_(){
  var open=(S.oneOnOnes||[]).filter(function(o){ return ooOpen_(o) && !(o.status==='pending' && !o.mine); });
  if(!open.length) return '';
  var h='<div class="mentorLabel">'+esc(t('1-on-1s coming up'))+'</div>';
  open.forEach(function(o){
    var todo=!o.iMentor && !o.prep;
    h+='<button class="ooRow" data-ooopen="'+esc(o.id)+'"><span class="rowName">☕ '+esc(o.otherName)+' '+ooStatusHtml_(o)+
      (todo ? '<div class="ooTodo">'+esc(t('Fill in your check-in'))+' ›</div>' : '')+'</span><span class="ooChev">›</span></button>';
  });
  return h;
}
function ooAfterAccept_(id){
  var o=ooById_(id);
  if(o && !o.iMentor && !o.prep){ ooGo_(id); showMsg(t('Accepted — now a quick check-in')); }
  else render();
}
function ooSaved_(d, msg){
  if(d && d.ok){ S.oneOnOnes=d.oneOnOnes; if(msg) showMsg(msg); return true; }
  showMsg(t('Could not save')); return false;
}
function bindOneOnOne_(){
  var back=document.getElementById('ooBack');
  if(back) back.onclick=function(){ S.view=S.ooBack||'week'; S.ooId=null; S.ooWith=null; render(); window.scrollTo(0,0); };
  var o=S.ooId ? ooById_(S.ooId) : null;
  var key=o ? o.id : 'new:'+S.ooWith;
  document.querySelectorAll('[data-ooarea],[data-ooval]').forEach(function(b){
    b.onclick=function(){
      var area=b.hasAttribute('data-ooarea'), v=(b.getAttribute(area?'data-ooarea':'data-ooval')||'').split('|');
      var d=ooDraft_(key); (area?d.areas:d.values)[v[0]]=Number(v[1]);
      b.parentNode.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x===b); });
    };
  });
  document.querySelectorAll('[data-oodraft]').forEach(function(el){
    el.oninput=function(){ ooDraft_(key)[el.getAttribute('data-oodraft')]=el.value; };
  });
  document.querySelectorAll('[data-oonote]').forEach(function(el){
    el.oninput=function(){ ooNotesDraft_(key, o).notes=el.value; };
  });
  document.querySelectorAll('[data-oofu]').forEach(function(el){
    el.oninput=function(){ ooNotesDraft_(key, o).followUps[Number(el.getAttribute('data-oofu'))]=el.value; };
  });
  var ho=document.getElementById('ooHeldOn');
  if(ho) ho.onchange=function(){ ooNotesDraft_(key, o).heldOn=ho.value; };
  var add=document.getElementById('ooFuAdd');
  if(add) add.onclick=function(){ ooNotesDraft_(key, o).followUps.push(''); render(); };
  var prepOf=function(d){ return { areas:d.areas, values:d.values, helpWith:d.helpWith, workingOn:d.workingOn, other:d.other }; };
  var filled=function(d){ return Object.keys(d.areas).length===OO_AREAS.length && Object.keys(d.values).length===OO_VALUES.length; };
  var send=document.getElementById('ooSend');
  if(send) send.onclick=function(){
    var d=ooDraft_(key);
    if(!filled(d)){ showMsg(t('Please rate each area and value first')); return; }
    send.disabled=true;
    run('requestOneOnOne',[S.auth.user,S.auth.pin,S.ooWith,d.note,prepOf(d)],function(r){
      send.disabled=false;
      if(ooSaved_(r, t('Request sent'))){ delete S.ooDrafts[key]; S.view=S.ooBack||'week'; S.ooWith=null; render(); window.scrollTo(0,0); }
    });
  };
  var ask=document.getElementById('ooAsk');
  if(ask) ask.onclick=function(){
    ask.disabled=true;
    run('requestOneOnOne',[S.auth.user,S.auth.pin,S.ooWith,''],function(r){
      ask.disabled=false;
      if(ooSaved_(r, t('Request sent'))){ var mine=(r.oneOnOnes||[]).filter(function(x){ return x.otherId===S.ooWith && x.status==='pending' && x.mine; })[0]; if(mine){ S.ooId=mine.id; } render(); }
    });
  };
  var notesArgs=function(){
    var d=ooNotesDraft_(key, o);
    return [d.notes, d.followUps.filter(function(f){ return String(f).trim(); }), d.heldOn];
  };
  var logB=document.getElementById('ooLog');
  if(logB) logB.onclick=function(){
    var a=notesArgs();
    if(!a[2]){ showMsg(t('Pick the date you met')); return; }
    logB.disabled=true;
    run('logOneOnOne',[S.auth.user,S.auth.pin,S.ooWith,a[0],a[1],a[2]],function(r){
      logB.disabled=false;
      if(ooSaved_(r, t('Saved'))){ delete S.ooNotes[key]; var row=(r.oneOnOnes||[]).filter(function(x){ return x.otherId===S.ooWith && x.status==='held'; })[0]; S.ooId=row?row.id:null; render(); window.scrollTo(0,0); }
    });
  };
  var sp=document.getElementById('ooSavePrep');
  if(sp) sp.onclick=function(){
    var d=ooDraft_(key);
    if(!filled(d)){ showMsg(t('Please rate each area and value first')); return; }
    sp.disabled=true;
    run('saveOneOnOnePrep',[S.auth.user,S.auth.pin,o.id,prepOf(d)],function(r){
      sp.disabled=false;
      if(ooSaved_(r, t('Saved — your mentor can see it now'))){ delete S.ooDrafts[key]; S.ooEditPrep=null; render(); }
    });
  };
  var ep=document.getElementById('ooEditPrep');
  if(ep) ep.onclick=function(){ S.ooEditPrep=o.id; if(S.ooDrafts) delete S.ooDrafts[key]; render(); };
  var sn=document.getElementById('ooSaveNotes');
  if(sn) sn.onclick=function(){
    var a=notesArgs();
    if(!a[2]){ showMsg(t('Pick the date you met')); return; }
    sn.disabled=true;
    run('saveOneOnOneNotes',[S.auth.user,S.auth.pin,o.id,a[0],a[1],a[2]],function(r){
      sn.disabled=false;
      if(ooSaved_(r, o.status==='held' ? t('Saved') : t('Done — counted for this month'))){ delete S.ooNotes[key]; render(); }
    });
  };
  document.querySelectorAll('[data-ootick]').forEach(function(b){
    b.onclick=function(){
      var v=b.getAttribute('data-ootick').split('|'), row=ooById_(v[0]);
      var done=!(row && row.followUps && row.followUps[Number(v[1])] && row.followUps[Number(v[1])].done);
      b.classList.toggle('done', done);
      run('tickOneOnOneFollowUp',[S.auth.user,S.auth.pin,v[0],Number(v[1]),done],function(r){ if(ooSaved_(r)) render(); });
    };
  });
  /* the mentee's goals, for their mentor — fetched once per mentee */
  if(S.view==='oneonone'){
    var iMentor=o ? o.iMentor : (S.mentees||[]).some(function(p){ return p.id===S.ooWith; });
    var mid=o ? o.menteeId : S.ooWith;
    if(iMentor && o && S.ooGoalsFor!==mid){
      S.ooGoalsFor=mid; S.ooGoals=null;
      run('getMenteeLogs',[S.auth.user,S.auth.pin,mid],function(r){
        if(r && r.ok && S.ooGoalsFor===mid){ S.ooGoals=r.smartGoals||[]; if(S.view==='oneonone') render(); }
      });
    }
  }
}

/* The top of My Home — Base's own hero card, styled identically and
   populated with personal figures (streak, this week's goals, today's
   habits, PTO left) instead of the base's. A gear icon above it reveals a
   hidden customize panel — a free color wheel and a background photo — for
   the one card that's actually yours; .hero's text is already the fixed
   --onDark pair regardless, so .hero.custom only has to add a gradient
   under whatever color or photo gets picked, the same trick .allowCard and
   photo-backed cards already use for contrast rather than text color. */
function miniDashboardHtml(){
  var wk=thisWeek();
  var st=graceStreak(function(){return true;});
  var rec=goalsForWeek(wk);
  var written=(rec && rec.items ? rec.items : []).filter(function(i){return i && i.text;});
  var goalsDone=written.filter(function(i){return goalItemPct(i)>=100;}).length;
  var goalsPct=written.length ? Math.round(goalsDone/written.length*100) : 0;
  var list=myHabitsToday();
  var log=logForDate(todayStr());
  var habitsDone=list.filter(function(hb){return log && didHabit(log,hb.id);}).length;
  var habitsPct=list.length ? Math.round(habitsDone/list.length*100) : 0;
  var year=String(new Date().getFullYear());
  var yt=(S.trips && S.trips.totals && S.trips.totals[year]) || {personal:0};
  var cap=(S.trips && S.trips.ptoCap) || 30;
  var ptoLeft=Math.max(0, cap-yt.personal);
  var HH=homeHealth_();   // the weekly check-in only: this week's, or last week's until it is answered
  var score=HH.score;
  var healthPct=score!==null?Math.round(score*10):0;
  var prevScore=HH.prevScore;
  var healthTrend=(score!==null&&prevScore!==null)?trendBadge(pctChange(prevScore,score),true):'';
  var mentorId=S.me.mentorId||'';
  var mentorRec=mentorId?personOf(mentorId):null;
  var mentorName=mentorId?(mentorRec?mentorRec.name:nameOf(mentorId)):'';
  var mentorPct=mentorId?100:0;
  var bestRun=myHabits().reduce(function(m,hb){ return Math.max(m, habitBest(hb)); }, 0);

  var p=S.profile||{};
  var color=p.dashboardColor||'';
  var bg=p.dashboardBg||'';
  var custom=!!(color||bg);
  var open=!!S.dbCustomize;

  /* The name-and-face greeting moved here from Base — Base is ministry
     stats, not a personal page, and this is the one card that's actually
     yours. Same .baseMe markup Base used to show it with. */
  var h='<div class="miniDashHead">'+
      '<div class="baseMe">'+avatarHtml(S.me,'')+
        '<div><div class="pmeta">'+esc(t(greeting()))+'</div>'+
        '<div class="pname">'+esc(S.me.name)+'</div>'+
        '<div class="pmeta">'+esc(t(S.me.role||S.me.dept))+
          (S.me.ministry?' · '+esc(t(S.me.ministry)):'')+'</div>'+
        '</div></div>'+
      '<button class="dashSettingBtn'+(open?' on':'')+'" id="dashCustomizeBtn" aria-pressed="'+(open?'true':'false')+'" aria-label="'+esc(t('Customize dashboard'))+'">'+
        '<span class="ic">⚙️</span></button>'+
    '</div>';

  /* ⚙️ opens the colour / photo options right here, under the greeting —
     below the card (where they were) they opened off the bottom of a phone's
     screen, so the gear seemed to do nothing. */
  if(open){
    h+='<div class="card dashCustom" id="dashCustom">'+
      '<div class="goalCardTitle" style="margin-bottom:4px">⚙️ '+esc(t('Customize dashboard'))+'</div>'+
      '<label class="f">'+esc(t('Accent color'))+'</label>'+
      '<div style="display:flex;align-items:center;gap:12px">'+
        '<input type="color" id="dashColorInput" value="'+esc(color||'#1F44FF')+'" aria-label="'+esc(t('Choose color'))+'">'+
        (color?'<button class="linkbtn" id="dashColorReset" style="width:auto;margin:0;padding:0">'+esc(t('Match app theme'))+'</button>':'')+
      '</div>'+
      '<label class="f">'+esc(t('Background image'))+'</label>'+
      '<div style="display:flex;gap:8px">'+
        '<button class="btn ghost" id="dashBgBtn" style="width:auto;margin:0;padding:9px 14px">'+(bg?esc(t('Change image')):esc(t('Add image')))+'</button>'+
        (bg?'<button class="btn ghost" id="dashBgClearBtn" style="width:auto;margin:0;padding:9px 14px">'+esc(t('Remove'))+'</button>':'')+
      '</div>'+
      '<input type="file" accept="image/*" id="dashBgInput" style="display:none">'+
      '<button class="btn" id="dashCustomDone" style="margin-top:12px">'+esc(t('Done'))+'</button>'+
    '</div>';
  }

  /* Base's own hero, reused whole — same classes, same look, populated with
     personal figures instead of the base's. The streak leads because it's
     the one number here that's purely for the person holding the phone, the
     same reason Base leads with the campus's total staff. Each ring/sub row
     is a button now: tapping one jumps straight to the section it's about,
     the same [data-jump] the quick-jump strip already uses. */
  /* Two halves, split by a faded rule: what you're aiming at this week (the
     three goals, and the two things you most often come here to do — the
     health check-in and your ministry's numbers), then how the week is going
     (streak, habits, health score, mentor). Goals lead because sitting under
     the big streak number read as an afterthought in the middle of the card. */
  h+='<div class="hero myHero'+(custom?' custom':'')+'"'+
    (custom?' style="'+(color?'background-color:'+esc(color)+';':'')+(bg?'background-image:url(\''+esc(bg)+'\');':'')+'"':'')+'>'+
    '<button class="heroRow'+(written.length?' withList':'')+'" data-jump="sec-goals">'+gpRingHtml(goalsPct,'sm',t('Weekly Goals'))+
      '<div class="heroTrend">'+esc(t('Weekly Goals'))+' <b class="heroFig">'+goalsDone+'</b>/'+written.length+'</div>'+
      (written.length?'<div class="heroGoalsPreview">'+written.map(function(g){
        return '<div><span class="heroGoalDot" style="background:'+gpRingColor(goalItemPct(g))+'"></span>'+esc(g.text)+'</div>';
      }).join('')+'</div>':'')+
    '</button>'+
    (typeof dutyHtml==='function' ? schedHomeHtml_() : '')+
    '<div class="heroDivider"></div>'+
    '<div class="heroLabel">'+esc(t('WEEK'))+' '+wk+'</div>'+
    '<div class="heroNum" data-count="'+st+'">0</div>'+
    '<div class="heroLabel" style="letter-spacing:2px">'+esc(t('DAY STREAK'))+'</div>'+
    '<button class="heroRow" data-jump="sec-habits">'+gpRingHtml(habitsPct,'sm',t('Habits Today'))+
      '<div class="heroTrend">'+esc(t('Habits Today'))+' <b class="heroFig">'+habitsDone+'</b>/'+list.length+
      (bestRun>0?'</div><div class="heroSubtext">🔥 '+esc(gpT('best {n}d streak',{n:bestRun}))+'</div>':'</div>')+'</button>'+
    '<button class="heroRow" data-gohealth="1">'+gpRingHtml(healthPct,'sm',t('My Health'))+
      '<div class="heroTrend">'+esc(t('My Health'))+' <b class="heroFig">'+(score!==null?score.toFixed(1):'—')+'</b>/10 '+healthTrend+'</div></button>'+
    '<button class="heroRow" data-gomentorship="1">'+gpRingHtml(mentorPct,'sm',t('Mentor'))+
      '<div class="heroTrend">'+esc(t('Mentor'))+' <b class="heroFig">'+(mentorId?esc(mentorName):esc(t('Not set')))+'</b></div></button>'+
    '<button class="heroHealthBtn" id="goMyHealth" data-gohealth="1">💚 '+esc(t('Go to My Health'))+' ›</button>'+
    '<div class="heroSub">'+
      '<div class="heroSubRow">'+
        '<span class="heroSubLabel">'+esc(t('PERSONAL DAYS OFF LEFT'))+'</span>'+
        '<span class="heroSubNum">'+ptoLeft+'</span>'+
        '<button class="heroSubBtn" id="goLeaveFromMe">🌴 '+esc(t('Request time off'))+'</button>'+
      '</div>'+
    '</div>'+
    homeBaseHtml_()+
  '</div>';
  h+=contractNoticeHtml_();

  return h;
}

/* The base at a glance, at the foot of My Home's card (Base itself is in the
   menu now): the staff, the base's health score and salvations this year —
   the same figures, from the same rollup, as Base's own hero. Tap → Base. */
function homeBaseHtml_(){
  if(!S.me || !S.me.campus) return '';
  /* Drawn before the base's figures arrive too, with a dash for each — so the card is
     its full size from the first moment and doesn't grow when they land. */
  var R=S.base ? baseR() : null, ids=[S.me.campus];
  var staff=R ? R.totalStaff(ids) : null, hs=R ? R.healthScore(ids) : null, salv=R ? R.headlineFor(ids,'Salvations') : null;
  return '<div class="heroDivider"></div>'+
    '<button class="homeBase" id="dashToBase">'+
      '<span class="homeBaseHead"><span>🏠 '+esc(t(campusName(S.me.campus)))+'</span><span class="homeBaseGo">'+esc(t('Base'))+' →</span></span>'+
      '<span class="homeBaseRow">'+
        '<span><b>'+(staff===null?'—':staff)+'</b>'+esc(t('Staff'))+'</span>'+
        '<span><b>'+(hs===null?'—':hs.toFixed(1))+'</b>'+esc(t('Base health'))+'</span>'+
        '<span><b>'+(salv===null?'—':fmt(salv))+'</b>'+esc(t('Salvations'))+'</span>'+
      '</span>'+
    '</button>'+
    /* who is on campus right now (Who's here), the same count as Base's */
    (S.guest || S.board || S.student ? '' : (function(){
      var W=S.whosHere && S.whosFor===(S.me.campus||'') ? S.whosHere : null;
      return '<button class="homeBase homeWhos" id="goWhosHereHome">'+
        '<span class="homeBaseHead"><span>👥 '+esc(t('On campus now'))+' <b class="homeWhosN">'+(W ? W.count : '—')+'</b></span>'+
        '<span class="homeBaseGo">'+esc(t('Who’s here'))+' →</span></span></button>';
    })());
}
/* Recent updates for the personal dashboard — leave decisions on my own
   requests, a mentee's leave request waiting on me, and 1-on-1 activity.
   Purely computed from state already on the page (trips, tripRequests,
   oneOnOnes), the same way streaks and badges are derived rather than
   stored — there's no separate "seen/unseen" tracking, just what's recent. */
function notifActionBtnsHtml_(okAttr, okId, noAttr, noId, okLabel, noLabel){
  return '<span class="chips" style="margin:0">'+
    '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-'+okAttr+'="'+esc(okId)+'">'+esc(okLabel)+'</button>'+
    '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px;color:var(--faint)" data-'+noAttr+'="'+esc(noId)+'">'+esc(noLabel)+'</button>'+
  '</span>';
}
/* The full list, unfiltered — shared by the My Home card below and the
   header bell, so the two can never show a different set of events. Nothing
   is stored for this: it's read straight off state the page already has
   (trips, tripRequests, oneOnOnes), the same way streaks and badges are
   derived rather than stored. */
function notifItems_(){
  var items=[];
  (S.tripRequests||[]).forEach(function(r){
    var range=r.from+(r.to!==r.from?' → '+r.to:'');
    /* When this was ASKED, not when the leave itself falls — a request
       submitted today for next month must still be clearable today, the
       same way a 1-on-1 request already sorts and clears by S.created. */
    items.push({ when:r.created||r.from, text: gpT('{name} requested leave {range}', {name:r.name, range:range}),
      actions: notifActionBtnsHtml_('trok', r.id, 'trno', r.id, t('Approve'), t('Deny')) });
  });
  (S.oneOnOnes||[]).forEach(function(o){
    if(!o.mine && o.status==='pending'){
      items.push({ when:o.created, text: gpT('{name} requested a 1-on-1', {name:o.otherName}),
        actions: notifActionBtnsHtml_('121accept', o.id, '121decline', o.id, t('Accept'), t('Decline')) });
    } else if(o.mine && o.status==='accepted'){
      items.push({ when:o.decidedAt||o.created, text: gpT('{name} accepted your 1-on-1 request', {name:o.otherName}) });
    } else if(o.mine && o.status==='declined'){
      items.push({ when:o.decidedAt||o.created, text: gpT('{name} declined your 1-on-1 request', {name:o.otherName}) });
    }
    /* a mentee whose 1-on-1 is on but whose check-in isn't filled in yet */
    if(!o.iMentor && ooOpen_(o) && !o.prep && !(o.status==='pending' && !o.mine)){
      items.push({ when:o.decidedAt||o.created, text: gpT('Fill in your check-in before your 1-on-1 with {name}', {name:o.otherName}),
        actions: '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-ooopen="'+esc(o.id)+'">'+esc(t('Open'))+'</button>' });
    }
  });
  (S.trips && S.trips.trips || []).forEach(function(r){
    var range=r.from+(r.to!==r.from?' → '+r.to:'');
    if(r.status==='approved'){
      items.push({ when: r.decidedAt||r.from, text: gpT('Your {range} leave request was approved', {range:range}) });
    } else if(r.status==='declined'){
      items.push({ when: r.decidedAt||r.from, text: gpT('Your {range} leave request was declined', {range:range}) });
    }
  });
  /* An admin's own words, sent to everyone — free text, so it never runs
     through t()/gpT like the rest of this list; only the "Announcement"
     label is translated. */
  (S.broadcasts||[]).forEach(function(b){
    items.push({ when:b.created, text:'📣 '+t('Announcement')+': '+b.text });
  });
  /* A nudge, not a server-tracked item — Friday through the end of the week,
     if this week's check-in is still unanswered. "when" is that Friday's own
     date, so clearing it only holds through the rest of THIS week: next
     week's Friday is a later date, past the clear cutoff, so the same nudge
     reappears fresh rather than staying cleared forever. */
  if(S.me){
    var nwk=thisWeek(), nfri=new Date(weekBounds_(nwk).from);
    nfri.setDate(nfri.getDate()+4);
    if(new Date(todayStr())>=nfri && !myWeekRow(nwk)){
      items.push({ when:isoDateOf_(nfri), text:t('Your weekly health check-in is due'),
        actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gohealth="1">'+esc(t('Answer it'))+'</button>' });
    }
  }
  /* End of the week, goals not all the way there — used to be a big banner
     inline on My Home; it's a bell item instead now so the page isn't
     stacking two "end of the week" banners at once. Same Friday-dated
     "when" as the health nudge above, so it clears with the rest of the
     week and comes back fresh next week. */
  if(S.me && weekPhase()==='review'){
    var ggwk=thisWeek(), ggrec=goalsForWeek(ggwk);
    var ggHasGoals=!!(ggrec && ggrec.items.some(function(i){ return i.text; }));
    if(ggHasGoals && ggrec.pct!==null && ggrec.pct<100){
      var ggfri=new Date(weekBounds_(ggwk).from); ggfri.setDate(ggfri.getDate()+4);
      items.push({ when:isoDateOf_(ggfri), text:gpT('Your three goals are {pct}% of the way there.',{pct:ggrec.pct}),
        actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-jumpgoals="1">'+
          esc(gpT('Close out week {wk}',{wk:ggwk}))+'</button>' });
    }
  }
  /* Every account made before email became part of sign-up has none yet —
     "when" is always right now, computed fresh every render, so this never
     ages past a Clear the way the others above do: clearing sets
     notifClearedAt to this same instant, and the next render's "now" is
     always a moment later, so the item is straight back. It's meant to
     stay until the email is actually added, not until someone taps Clear.
     bellOnly: this is true for nearly every existing account at once, so an
     inline card on My Home would be permanent, above-the-fold clutter
     for almost everybody — the bell (and its dot) is visible enough. */
  /* HR reminders — for an admin or anyone with HR. Dated today (not now),
     so Clear hides them until tomorrow and they come back while the work
     is still waiting: a contract to renew, a candidate to follow up. */
  if(S.me && (S.me.isAdmin || S.me.hr)){
    var hrBtn='<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gohr="1">'+esc(t('Open HR'))+'</button>';
    if(S.hrDue) items.push({ when:todayStr()+'T23:59:59.000Z', text: S.hrDue===1 ? t('1 staff contract is due for renewal') : gpT('{n} staff contracts are due for renewal',{n:S.hrDue}), actions:hrBtn });
    if(S.hrFollowUps) items.push({ when:todayStr()+'T23:59:58.000Z', text: S.hrFollowUps===1 ? t('1 candidate follow-up is due') : gpT('{n} candidate follow-ups are due',{n:S.hrFollowUps}), actions:hrBtn });
  }
  /* The nightly backup (admins): only when a night was missed or the last run
     failed — dated today, so Clear holds until tomorrow and it comes back while
     it is still not running. */
  if(S.me && S.me.isAdmin && backupLate_()){
    items.push({ when:todayStr()+'T23:59:57.000Z', text: backupLateText_(),
      actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-goadmin="1">'+esc(t('Open Admin'))+'</button>' });
  }
  /* Ministry numbers, due Friday. Whoever is responsible (main, backup, or the
     leaders with nobody set) gets "due today" on Friday and "overdue" from
     Saturday — Friday- and Saturday-dated, so a Clear holds for that day —
     until the week has numbers in. Last week's, still missing, comes back
     each day (dated today) until it is in. A department's overseer gets the
     done / not done list on the same days. */
  if(S.me && S.numbers){
    var nw=thisWeek(), ntoday=todayStr(), nfriD=weekFriday_(nw), nfri2=isoDateOf_(nfriD);
    var nsatD=new Date(nfriD); nsatD.setDate(nsatD.getDate()+1); var nsat=isoDateOf_(nsatD);
    var goBtn=function(x){ return '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gonumbers="'+esc(x.dept+'|'+x.ministry)+'">'+esc(t('Enter them'))+'</button>'; };
    (S.numbers.duty||[]).forEach(function(x){
      if(ntoday>=nfri2 && !numLogged_(x, nw)){
        items.push({ when: ntoday>nfri2 ? nsat : nfri2,
          text: ntoday>nfri2 ? gpT('{ministry} numbers for week {wk} are overdue',{ministry:t(x.ministry), wk:nw})
                             : gpT('{ministry} numbers for week {wk} are due today',{ministry:t(x.ministry), wk:nw}),
          actions: goBtn(x) });
      }
      if(nw>1 && !numLogged_(x, nw-1)){
        items.push({ when: ntoday, text: gpT('{ministry} numbers for week {wk} are overdue',{ministry:t(x.ministry), wk:nw-1}), actions: goBtn(x) });
      }
    });
    var ND=S.numbers.dept;
    if(ND){
      var nmins=numbersDeptMinistries_(ND.dept);
      var deptBtn='<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gonumdept="'+esc(ND.dept)+'">'+esc(t('See them'))+'</button>';
      var missing=function(w){ var lg=ND.logged && ND.logged[w]; return lg ? nmins.filter(function(m){ return lg.indexOf(m)===-1; }) : null; };
      var listOf=function(ms){ return ms.map(function(m){ return t(m)+' ('+numbersWhoFor_(ND, m)+')'; }).join(', '); };
      var mNow=missing(nw);
      if(nmins.length && mNow && ntoday>=nfri2){
        items.push({ when: ntoday>nfri2 ? nsat : nfri2,
          text: gpT('{dept} week {wk}: {n} of {total} ministries have their numbers in.',{dept:t(ND.dept), wk:nw, n:nmins.length-mNow.length, total:nmins.length})+
            (mNow.length ? ' '+gpT('Not yet: {list}',{list:listOf(mNow)}) : ''),
          actions: deptBtn });
      }
      var mLast = nw>1 ? missing(nw-1) : null;
      if(nmins.length && mLast && mLast.length && ntoday<nfri2){
        items.push({ when: ntoday, text: gpT('{dept} week {wk}: still missing {list}',{dept:t(ND.dept), wk:nw-1, list:listOf(mLast)}), actions: deptBtn });
      }
    }
  }
  if(S.me && !(S.profile && S.profile.email)){
    items.push({ when:new Date().toISOString(), text:t('Add your email to your profile'),
      actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-goprofile="1">'+esc(t('Add it'))+'</button>',
      bellOnly:true });
  }
  items.sort(function(a,b){ return (b.when||'')<(a.when||'')?-1:1; });
  return items;
}

/* What's actually shown: everything since the last Clear. A single "cleared
   before" cutoff rather than a per-item read flag — Clear on the bell or on
   My Home is the same button, so both can never disagree about what's
   left. Clearing an actionable row (a mentee's leave request, an incoming
   1-on-1) only tidies this feed — the request itself is still sitting in
   Leave Request / Mentorship / Team, waiting on you, either way. */
function visibleNotifItems_(){
  var cut = S.notifClearedAt || '';
  return notifItems_().filter(function(it){ return (it.when||'') > cut; });
}

function clearNotifications(){
  S.notifClearedAt = new Date().toISOString();
  lsSet('gp-notif-cleared', S.notifClearedAt);
  S.bellOpen=false;
  render();
}


