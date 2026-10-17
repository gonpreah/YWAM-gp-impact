/* My YWAM GP — teams.html, part 6 of 10: department pulse, numbers people, My Ministry, My contract.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ==================== department pulse ====================
   A department leader's page leads with the department as it is this week,
   with nothing to type: numbers in on time, headcount and who is away, the
   health check-ins (two numbers only, none under the server's minimum —
   getDeptPulse), 1-on-1s this month, OKR progress this quarter and staff
   debt (entered monthly by the Finance office). The Campus Director sees
   one for every department, plus the quarter's own scores to enter. */
var PULSE_DEPTS_ = ['Community Service','Youth Education','Leadership Development','Skills Training'];
function pulseDeptsForMe_(){
  if(!S.me || S.me.dept!==BL_DEPT) return [];
  if(S.me.ministry==='Campus Director') return PULSE_DEPTS_.slice();
  return PULSE_DEPTS_.indexOf(S.me.ministry)>-1 ? [S.me.ministry] : [];
}
function pulseLoad_(dept){
  S.pulse=S.pulse||{}; S.pulseLoading=S.pulseLoading||{};
  if(S.pulse[dept] || S.pulseLoading[dept]) return;
  S.pulseLoading[dept]=true;
  run('getDeptPulse',[S.auth.user,S.auth.pin,dept],function(d){
    S.pulseLoading[dept]=false;
    S.pulse[dept] = (d && d.ok && d.week) ? {
      ok:true, week:d.week, staff:d.staff||0, away:d.away||[], oneOnOnes:d.oneOnOnes||0, staffDebt:d.staffDebt||null,
      health:(d.health && d.health.length) ? d.health : [{ week:d.week, answered:0, total:0 }],
      numbers:d.numbers||{ logged:{} }
    } : { ok:false };
    if(S.view==='ministry') render();
  });
}
function pulseOkr_(dept){
  var okrs=((S.base && S.base.okrs)||[]).filter(function(o){ return o.campus===S.me.campus && o.dept===dept && Number(o.quarter)===leadQNow_(); });
  if(!okrs.length || typeof baseR!=='function') return null;
  var R=baseR();
  return { n:okrs.length, pct:Math.round(okrs.reduce(function(a,o){ return a+R.objProgress(o); },0)/okrs.length) };
}
function pulseTile_(label, big, sub){
  return '<div class="pulseTile"><div class="pulseLabel">'+esc(label)+'</div><div class="pulseBig">'+big+'</div>'+
    (sub?'<div class="pulseSub">'+sub+'</div>':'')+'</div>';
}
function pulseCardHtml_(dept, compact){
  pulseLoad_(dept);
  var P=S.pulse && S.pulse[dept];
  var h='<div class="card pulseCard"><div class="goalCardTitle" style="margin-bottom:8px">📊 '+esc(gpT('{dept} this week',{dept:t(dept)}))+'</div>';
  if(!P) return h+'<p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  if(!P.ok) return h+'<p class="sub" style="margin:0">'+esc(t('Couldn’t load this — pull down to try again.'))+'</p></div>';
  var mins=numbersDeptMinistries_(dept), wk=P.week, lg=(P.numbers.logged||{})[wk]||[];
  var inN=mins.filter(function(m){ return lg.indexOf(m)>-1; }).length;
  var st=numbersDueState_(wk, inN===mins.length);
  var hNow=P.health[0], hLast=P.health[1]||null;
  var hShow=(hLast && hLast.score!==undefined) ? hLast : (hNow.score!==undefined ? hNow : null);
  var okr=pulseOkr_(dept);
  h+='<div class="pulseGrid">';
  h+=pulseTile_(t('Numbers in'), inN+' / '+mins.length,
    esc(st==='done'?t('all in'):(st==='late'?t('overdue'):(st==='today'?t('due today'):gpT('due Friday, {date}',{date:shortDay_(weekFriday_(wk))})))));
  h+=pulseTile_(t('Staff'), String(P.staff), esc(P.away.length ? gpT('{n} away this week',{n:P.away.length}) : t('nobody away this week')));
  h+=pulseTile_(t('Health'), hShow ? hShow.score.toFixed(1) : '—',
    esc(hShow ? gpT('{n} of {total} answered · week {wk}',{n:hShow.answered,total:hShow.total,wk:hShow.week})
              : gpT('{n} answered — too few to show',{n:(hLast||hNow).answered})));
  h+=pulseTile_(t('1-on-1s'), String(P.oneOnOnes), esc(t('this month')));
  h+=pulseTile_(t('OKRs'), okr ? okr.pct+'%' : '—', esc(okr ? gpT('{n} objectives · Q{q}',{n:okr.n,q:leadQNow_()}) : t('none this quarter')));
  h+=pulseTile_(t('Staff debt'), P.staffDebt ? fmt(P.staffDebt.value, 'Staff Debt ($)') : '—',
    esc(P.staffDebt ? gpT('from Finance, {date}',{date:P.staffDebt.at ? shortDay_(new Date(P.staffDebt.at)) : ''}) : t('not entered yet')));
  h+='</div>';
  if(P.away.length){
    h+='<div class="hint" style="margin:8px 0 0">'+esc(t('Away:'))+' '+esc(P.away.map(function(a){
      return a.name.split(' ')[0]+' ('+shortDay_(new Date(a.from+'T00:00:00'))+(a.to!==a.from?'–'+shortDay_(new Date(a.to+'T00:00:00')):'')+')'; }).join(', '))+'</div>';
  }
  h+='<div class="hint" style="margin:6px 0 0">'+esc(gpT('Health is the department’s average check-in score, never anyone’s answers — hidden when fewer than {n} answered.',{n:P.minN}))+'</div>';
  var list=numbersDeptListHtml_(P.numbers);
  if(list) h+= compact ? '<details class="pulseMore"><summary>'+esc(t('Which ministries are in'))+'</summary>'+list+'</details>' : list;
  return h+'</div>';
}

/* The Campus Director's own quarter: three scores and the base plants, once a quarter. */
var DIRECTOR_QUARTERLY_ = ['Base Vision (1-10)','Communications (1-10)','Partner Relationships (1-10)','Base Plants in Planning'];
function directorQuarterHtml_(){
  if(!S.me || S.me.dept!==BL_DEPT || S.me.ministry!=='Campus Director') return '';
  var wk=quarterAnchorWeek_(), entries=(S.ministry&&S.ministry.entries)||{}, d=S.dirDraft||{};
  var h='<div class="card"><div class="goalCardTitle" style="margin-bottom:4px">🧭 '+esc(gpT('Q{q} check-in',{q:leadQNow_()}))+'</div>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(t('Once a quarter: how the base is doing, in your own honest view.'))+'</p>';
  DIRECTOR_QUARTERLY_.forEach(function(m){
    var cur = d[m]!==undefined ? d[m] : ((entries[m]||{})[String(wk)]!==undefined ? entries[m][String(wk)] : '');
    h+='<div class="row"><div>'+(typeof kpiNameHtml_==='function' ? kpiNameHtml_(m, 'Campus Director') : '<div class="rowName">'+esc(t(m))+'</div>')+'</div>'+
      '<input type="number" inputmode="decimal" class="kpiIn"'+(m.indexOf('(1-10)')>-1?' min="1" max="10" step="1"':' min="0"')+' data-dirq="'+esc(m)+'" value="'+esc(String(cur))+'"></div>';
  });
  return h+'<button class="btn" id="dirQSave">'+esc(gpT('Save Q{q}',{q:leadQNow_()}))+'</button></div>';
}

/* Finances: the staff debt for each department, monthly. */
function canEnterStaffDebtClient_(){
  var m=S.me; if(!m) return false;
  var key='Skills Training|Finances';
  return !!(m.isAdmin || (m.dept==='Skills Training' && m.ministry==='Finances') || (m.ministries||[]).indexOf(key)>-1 || (m.leads||[]).indexOf(key)>-1);
}
function staffDebtCardHtml_(){
  if(!canEnterStaffDebtClient_()) return '';
  if(!S.staffDebt && !S.staffDebtLoading){
    S.staffDebtLoading=true;
    run('getStaffDebt',[S.auth.user,S.auth.pin],function(d){ S.staffDebtLoading=false; S.staffDebt=(d&&d.ok)?d.debt:{}; if(S.view==='ministry') render(); });
  }
  var D=S.staffDebt, dr=S.debtDraft||{};
  var h='<div class="card"><div class="goalCardTitle" style="margin-bottom:4px">💵 '+esc(t('Staff debt by department'))+'</div>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(t('Fills itself in when the A/R ageing report is uploaded (Reports tab), or type it here. Department leaders see it on their page.'))+'</p>';
  if(!D) return h+'<p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  PULSE_DEPTS_.forEach(function(dept){
    var cur=D[dept], v = dr[dept]!==undefined ? dr[dept] : (cur ? cur.value : '');
    var sub = cur ? gpT('last entered {date}',{date: cur.at ? shortDay_(new Date(cur.at)) : ''})+(cur.by?' · '+cur.by:'') : t('not entered yet');
    h+='<div class="row"><div><div class="rowName">'+esc(t(dept))+'</div><div class="rowSub">'+esc(sub)+'</div></div>'+
      '<input type="number" inputmode="decimal" class="kpiIn" min="0" data-debt="'+esc(dept)+'" value="'+esc(String(v))+'" placeholder="$"></div>';
  });
  return h+'<button class="btn" id="debtSave">'+esc(t('Save staff debt'))+'</button></div>';
}

document.addEventListener('input', function(e){
  var el=e.target; if(!el || !el.getAttribute) return;
  if(el.hasAttribute('data-dirq')){ S.dirDraft=S.dirDraft||{}; S.dirDraft[el.getAttribute('data-dirq')]=el.value; }
  if(el.hasAttribute('data-debt')){ S.debtDraft=S.debtDraft||{}; S.debtDraft[el.getAttribute('data-debt')]=el.value; }
});
document.addEventListener('click', function(e){
  var el=e.target && e.target.closest ? e.target.closest('#dirQSave,#debtSave') : null;
  if(!el || S.busy) return;
  if(el.id==='dirQSave'){
    var updates=[];
    document.querySelectorAll('[data-dirq]').forEach(function(inp){
      updates.push({ metric:inp.getAttribute('data-dirq'), value: inp.value==='' ? null : Number(inp.value) });
    });
    for(var i=0;i<updates.length;i++){
      var u=updates[i];
      if(u.value!==null && u.metric.indexOf('(1-10)')>-1 && (u.value<1 || u.value>10)){ showMsg(gpT('{metric} goes from {min} to {max} — check the number you typed.',{metric:t(u.metric),min:1,max:10})); return; }
    }
    S.busy=true; el.disabled=true; el.textContent=t('Saving…');
    run('saveMyMinistry',[S.auth.user,S.auth.pin,quarterAnchorWeek_(),updates],function(d){
      S.busy=false;
      if(d && d.ok){ S.ministry=d; S.dirDraft={}; showMsg(t('Saved')); } else showMsg(t('Could not save'));
      render();
    });
  }
  if(el.id==='debtSave'){
    var vals={};
    document.querySelectorAll('[data-debt]').forEach(function(inp){ if(inp.value!=='') vals[inp.getAttribute('data-debt')]=Number(inp.value); });
    S.busy=true; el.disabled=true; el.textContent=t('Saving…');
    run('saveStaffDebt',[S.auth.user,S.auth.pin,vals],function(d){
      S.busy=false;
      if(d && d.ok){ S.staffDebt=d.debt; S.debtDraft={}; S.pulse={}; showMsg(t('Saved')); } else showMsg(t('Could not save'));
      render();
    });
  }
});

/* ==================== numbers people ====================
   Each ministry's weekly numbers are somebody's job: a main person and a
   backup (with nobody set, the ministry's leaders), due by Friday of that
   week. Anyone on the ministry can still enter them. Set by the ministry's
   leader, its department's overseer or an admin (the server decides —
   data.numbers.canSet). Outreach Teams and Campus Leadership's own rows have
   none (numbersExempt_). The reminders are in notifItems_; the department
   overseer's done / not done list is numbersDeptListHtml_, inside their department card (pulseCardHtml_). */
function numbersExempt_(dept, min){ return isTeamsMinistry_(dept, min) || dept===BL_DEPT; }
function weekFriday_(wk){ var d=new Date(mondayOfWeek_(wk)); d.setDate(d.getDate()+4); return d; }
function shortDay_(d){ return MONTH_ABBR[d.getMonth()]+' '+d.getDate(); }
/* 'done' · 'upcoming' (before Friday) · 'today' (Friday) · 'late' */
function numbersDueState_(wk, logged){
  if(logged) return 'done';
  var today=todayStr(), fri=isoDateOf_(weekFriday_(wk));
  return today<fri ? 'upcoming' : (today===fri ? 'today' : 'late');
}
function numbersProgress_(campus, dept, min, data, wk){
  var metrics=metricsFor(campus, dept, min), entries=(data&&data.entries)||{}, daily=(data&&data.daily)||{};
  var b=weekBounds_(wk), n=0;
  metrics.forEach(function(m){
    if(entries[m] && entries[m][String(wk)]!==undefined){ n++; return; }
    var d=daily[m]||{};
    for(var date in d){ if(date>=b.from && date<=b.to){ n++; return; } }
  });
  return { n:n, total:metrics.length };
}
function numbersPersonName_(n){
  if(n && n.main) return n.main.name;
  if(n && n.leaders && n.leaders.length) return n.leaders.map(function(p){ return p.name; }).join(', ');
  return '';
}
function numbersHeadHtml_(data, wk, ovMin){
  var dept=data&&data.dept, min=data&&data.ministry;
  if(!data || !min || numbersExempt_(dept, min)) return '';
  var n=data.numbers||null, key=dept+'|'+min;
  var logged=ministryWeekLogged_(data, wk), st=numbersDueState_(wk, logged);
  var pr=numbersProgress_(S.me.campus, dept, min, data, wk);
  var fri=shortDay_(weekFriday_(wk));
  var due = st==='done' ? gpT('Numbers are in · {n} of {total} entered',{n:pr.n,total:pr.total})
    : st==='today' ? gpT('Due today · {n} of {total} entered',{n:pr.n,total:pr.total})
    : st==='late' ? gpT('Overdue — was due Friday, {date} · {n} of {total} entered',{date:fri,n:pr.n,total:pr.total})
    : gpT('Due Friday, {date} · {n} of {total} entered',{date:fri,n:pr.n,total:pr.total});
  var h='<div class="numHead">'+
    '<div class="numTitle">📝 '+esc(gpT('Week {wk} numbers',{wk:wk}))+'</div>'+
    '<div class="numDue '+st+'">'+esc(due)+'</div>'+
    '<div class="numBar"><div style="width:'+(pr.total?Math.round(pr.n/pr.total*100):0)+'%"></div></div>';
  if(S.numEdit===key && n && n.canSet){
    h+=numbersEditHtml_(n, dept, min);
  } else {
    var main=n && n.main ? n.main.name : '', backup=n && n.backup ? n.backup.name : '';
    var who = main ? gpT('Numbers: {name}',{name:main}) :
      (n && n.leaders && n.leaders.length ? gpT('Numbers: {name} (ministry leader)',{name:numbersPersonName_(n)}) : t('Nobody is responsible for these numbers yet'));
    h+='<div class="numPeople"><span>'+esc(who)+(backup?' · '+esc(gpT('Backup: {name}',{name:backup})):'')+'</span>'+
      (n && n.canSet ? '<button class="linkbtn numChange" data-numedit="'+esc(key)+'">'+esc(main?t('Change'):t('Choose'))+'</button>' : '')+'</div>';
  }
  var lb=n && n.lastBy && n.lastBy[String(wk)];
  if(lb && lb.name) h+='<div class="hint" style="margin:2px 0 0">'+esc(gpT('Last entered by {name}, {date}',{name:lb.name, date: lb.at ? shortDay_(new Date(lb.at)) : ''}))+'</div>';
  return h+'</div>';
}
function numbersEditHtml_(n, dept, min){
  /* people on this ministry first, then everyone else on the campus */
  var people=(S.roster||[]).filter(function(p){ return p.campus===S.me.campus; });
  var inMin=function(p){ return p.dept===dept && p.ministry===min; };
  people.sort(function(a,b){ return (inMin(b)?1:0)-(inMin(a)?1:0) || String(a.name).localeCompare(String(b.name)); });
  var opt=function(sel, none){
    return '<option value="">'+esc(none)+'</option>'+people.map(function(p){
      return '<option value="'+esc(p.id)+'"'+(sel===p.id?' selected':'')+'>'+esc(p.name)+(inMin(p)?'':' · '+esc(t(p.ministry||p.dept||'')))+'</option>';
    }).join('');
  };
  return '<div class="numEdit">'+
    '<label class="f">'+esc(t('Main person'))+'</label><select id="numMain">'+opt(n.main&&n.main.id, t('Nobody — the ministry leader'))+'</select>'+
    '<label class="f">'+esc(t('Backup'))+'</label><select id="numBackup">'+opt(n.backup&&n.backup.id, t('No backup'))+'</select>'+
    '<div class="hint">'+esc(t('They get a reminder on Friday if the week’s numbers aren’t in, and again on Saturday. Anyone on the ministry can still enter them.'))+'</div>'+
    '<div style="display:flex;gap:8px;margin-top:8px">'+
      '<button class="btn" data-numsave="'+esc(dept+'|'+min)+'" style="flex:2;margin-top:0">'+esc(t('Save'))+'</button>'+
      '<button class="btn ghost" data-numcancel="1" style="flex:1;margin-top:0">'+esc(t('Cancel'))+'</button></div></div>';
}
/* My numbers for (dept, min) are now in for week wk — the bell follows at
   once, without waiting for the next boot. */
function numbersMarkLogged_(dept, min, wk){
  var N=S.numbers; if(!N) return;
  (N.duty||[]).forEach(function(x){ if(x.dept===dept && x.ministry===min){ x.logged=x.logged||{}; x.logged[wk]=true; } });
  if(N.dept && N.dept.dept===dept && N.dept.logged && N.dept.logged[wk] && N.dept.logged[wk].indexOf(min)===-1) N.dept.logged[wk].push(min);
}
function numLogged_(x, wk){ return !(x && x.logged && x.logged[wk]===false); }
function numbersDeptMinistries_(dept){
  var d=(typeof getDepartments==='function' ? getDepartments(S.me.campus) : {})[dept]||{};
  return Object.keys(d).filter(function(m){ return !numbersExempt_(dept, m); });
}
function numbersWhoFor_(D, m){
  var p=D.people && D.people[m];
  if(p && p.main) return p.main.name;
  var l=D.leaders && D.leaders[m];
  return (l && l.length) ? l[0].name : t('nobody set');
}
/* A department's list: this week and last, done or not, and whose. */
function numbersDeptListHtml_(D){
  if(!D) return '';
  var mins=numbersDeptMinistries_(D.dept); if(!mins.length) return '';
  var nw=thisWeek(), weeks=[nw]; if(nw>1) weeks.push(nw-1);
  var h='<div class="numDeptCard">';
  weeks.forEach(function(w){
    var lg=D.logged && D.logged[w]; if(!lg) return;
    var done=mins.filter(function(m){ return lg.indexOf(m)>-1; }).length;
    var st=numbersDueState_(w, done===mins.length);
    h+='<div class="numDeptWeek"><b>'+esc(gpT('Week {wk}',{wk:w}))+'</b> · '+esc(gpT('{n} of {total} in',{n:done,total:mins.length}))+
      (st==='done'?'':' · <span class="numDue '+st+'" style="display:inline">'+esc(st==='late'?t('overdue'):(st==='today'?t('due today'):gpT('due Friday, {date}',{date:shortDay_(weekFriday_(w))})))+'</span>')+'</div>';
    mins.forEach(function(m){
      var ok=lg.indexOf(m)>-1;
      h+='<button class="numDeptRow" data-numgo="'+esc(D.dept+'|'+m)+'"><span>'+(ok?'✅':'⚠️')+' '+esc(t(m))+'</span>'+
        '<span class="numDeptWho">'+esc(numbersWhoFor_(D, m))+'</span></button>';
    });
    /* Outreach Teams is in Community Service too — its numbers come from the
       Teams Database, team by team, so it isn't one of the weekly "in" count */
    if(D.dept===TEAM_DEPT && (getDepartments(S.me.campus)[TEAM_DEPT]||{})[TEAM_MIN])
      h+='<button class="numDeptRow" data-numgo="'+esc(TEAM_DEPT+'|'+TEAM_MIN)+'"><span>🙌 '+esc(t(TEAM_MIN))+'</span>'+
        '<span class="numDeptWho">'+esc(t('from the Teams Database'))+'</span></button>';
  });
  return h+'</div>';
}
/* All the numbers-people taps, delegated once — these buttons are drawn in the
   page, the bell drawer and the My Home updates card alike. */
document.addEventListener('click', function(e){
  var el=e.target && e.target.closest ? e.target.closest('[data-numedit],[data-numcancel],[data-numsave],[data-numgo],[data-gonumbers],[data-gonumdept]') : null;
  if(!el) return;
  var open=function(v){ var i=v.lastIndexOf('|'); S.bellOpen=false; if(typeof renderNotifPanel==='function') renderNotifPanel();
    S.view='ministry'; S.mmTab='ministry'; S.mmBrowseDept=v.slice(0,i); S.mmBrowseMinistry=v.slice(i+1); render(); window.scrollTo(0,0); };
  if(el.hasAttribute('data-numedit')){ gpTap(); S.numEdit=el.getAttribute('data-numedit'); render(); return; }
  if(el.hasAttribute('data-numcancel')){ S.numEdit=null; render(); return; }
  if(el.hasAttribute('data-numgo')){ gpTap(); open(el.getAttribute('data-numgo')); return; }
  if(el.hasAttribute('data-gonumbers')){ open(el.getAttribute('data-gonumbers')); return; }
  if(el.hasAttribute('data-gonumdept')){ S.bellOpen=false; if(typeof renderNotifPanel==='function') renderNotifPanel();
    S.view='ministry'; S.mmTab='ministry'; S.mmBrowseDept=BL_DEPT; S.mmBrowseMinistry=el.getAttribute('data-gonumdept'); S.lwTab='base'; S.lbPulseOpen=true; render(); window.scrollTo(0,0); return; }
  if(el.hasAttribute('data-numsave')){
    if(S.busy) return;
    var v=el.getAttribute('data-numsave'), i=v.lastIndexOf('|'), dept=v.slice(0,i), min=v.slice(i+1);
    var main=(document.getElementById('numMain')||{}).value||'', backup=(document.getElementById('numBackup')||{}).value||'';
    if(main && backup && main===backup){ showMsg(t('Pick two different people')); return; }
    if(!main && backup){ showMsg(t('Choose a main person first')); return; }
    S.busy=true; el.disabled=true; el.textContent=t('Saving…');
    run('setNumbersPeople',[S.auth.user,S.auth.pin,dept,min,{ main:main, backup:backup }],function(d){
      S.busy=false;
      if(!d || !d.ok){ showMsg(t('Could not save')); render(); return; }
      var data = (S.ministry && S.ministry.dept===dept && S.ministry.ministry===min) ? S.ministry : S.oversee[min];
      if(data) data.numbers=Object.assign({}, d.numbers, { lastBy:(data.numbers&&data.numbers.lastBy)||{} });
      S.numEdit=null; showMsg(t('Saved')); render();
      /* who is responsible changed, so whose reminders are due changed too */
      if(typeof refreshAll==='function') try { refreshAll(); } catch(e){}
    });
  }
});

function ministryWeekStatusHtml_(data, wk, ovMin){
  var isCur=Number(wk)===Number(thisWeek());
  var logged=ministryWeekLogged_(data, wk);
  var open = ovMin ? !!S.ovInputOpen[ovMin] : S.kpiInputOpen;
  // your own ministry's buttons carry ids; another ministry's carry its name
  var prevA = ovMin ? ' data-ovprev="'+esc(ovMin)+'"' : ' id="kpiPrevWeek"';
  var nextA = ovMin ? ' data-ovnext="'+esc(ovMin)+'"' : ' id="kpiNextWeek"';
  var h='<div class="card" id="mmWeekCard">';
  h+=numbersHeadHtml_(data, wk, ovMin);
  h+='<div class="weekNavLabel">'+esc(t('Week'))+'</div>'+
    '<div class="weekNavRow">'+
      '<button class="weekArrow"'+prevA+' aria-label="'+esc(t('Previous week'))+'"'+(wk<=1?' disabled':'')+'>‹</button>'+
      '<div class="weekPill">'+esc(weekRangeLabel_(wk))+
        '<span class="currentTag'+(isCur?' on':'')+'">'+esc(t('Current Week'))+'</span></div>'+
      '<button class="weekArrow"'+nextA+' aria-label="'+esc(t('Next week'))+'"'+(wk>=52?' disabled':'')+'>›</button>'+
    '</div>';
  var strip='';
  for(var w=Math.max(1,thisWeek()-7); w<=thisWeek(); w++){
    var l=ministryWeekLogged_(data,w);
    var goA = ovMin ? ' data-ovgoto="'+esc(ovMin)+'|'+w+'"' : ' data-kpigoto="'+w+'"';
    strip+='<button class="wkDot'+(l?' on':'')+(w===Number(wk)?' cur':'')+'"'+goA+' aria-label="'+esc(gpT('Week {wk}',{wk:w}))+'">'+w+'</button>';
  }
  h+='<div class="wkStrip">'+strip+'</div>';
  h+='<p class="hint" style="margin:0 0 8px">'+esc(t('Filled weeks have numbers in; hollow ones don’t yet. Tap a week to open it.'))+'</p>';
  h+='<div class="mmStatus">'+(logged
    ? '✅ '+esc(gpT('Week {wk} is logged',{wk:wk}))
    : '⚠️ '+esc(gpT('Nothing logged for week {wk} yet',{wk:wk})))+'</div>';
  h+='<button class="btn" id="kpiInputBtn"'+(ovMin?' data-ovinput="'+esc(ovMin)+'"':'')+' style="margin-top:0">'+
    esc(open ? t('Hide the metric form') : (logged ? t('Edit this week’s metrics') : t('Input this week’s metrics')))+'</button>';
  if(!isCur) h+='<button class="linkbtn"'+(ovMin?' data-ovjump="'+esc(ovMin)+'"':' id="kpiJumpCurrent"')+'>'+esc(t('Jump back to this week'))+'</button>';
  return h+'</div>';
}

/* The person's own four figures sit folded at the very bottom of the page:
   the ministry's numbers are what this page is for right now, and the
   personal ones are parked until they get their own design. Opening the
   fold is the only way to see them, so the inputs only exist while open. */
function personalCardHtml_(wk){
  return '<div class="accCard" style="margin-top:14px">'+accRowHtml('dbAcc', 'personal', '🙋 '+esc(t('My personal numbers')),
    esc(t('Your own four weekly figures — parked here for later')), function(){ return personalBodyHtml_(wk); })+'</div>';
}
function personalBodyHtml_(wk){
  var entries=(S.personal&&S.personal.entries)||{};
  var h='<div>';
  h+='<p class="sub" style="margin:0 0 8px">'+esc(gpT('Your own week {wk} — yours alone, not the ministry’s.',{wk:wk}))+'</p>';
  PERSONAL_METRICS.forEach(function(m){
    var wks=entries[m]||{};
    var stored=wks[String(wk)];
    var cur = S.personalDraft[m]!==undefined ? S.personalDraft[m] : (stored!==undefined ? stored : '');
    var sub=esc(t('week total'))+' '+fmt(stored===undefined?null:Number(stored), m)+gpVsLastWeek(wks, wk, m, cur);
    h+='<div class="row"><div><div class="rowName">'+esc(t(m))+'</div><div class="rowSub">'+sub+'</div></div>'+
      '<input type="number" inputmode="numeric" class="kpiIn" data-personal="'+esc(m)+'" value="'+esc(String(cur))+'"></div>';
  });
  h+='<button class="btn" id="savePersonalBtn">'+esc(t('Save my numbers'))+'</button></div>';
  return h;
}

/* ---------- Outreach Teams ----------
   The one ministry that isn't logged week by week. A team comes for a
   stretch, and its numbers are gathered once, when it leaves — so this page
   is a list of teams, one card each, plus a dashboard that adds them up by
   month, quarter or year (a team counts in the period it LEAVES). Adding or
   editing a team is a single form: who came, when, how many, and every
   Outreach Teams metric as a total for the visit. The server turns the
   teams into weekly rows for the Base dashboard, so nothing else changes.
   Who may add or edit is who may log for the ministry (canLogFor_ on the
   server, echoed back as canEdit): its own staff, its overseer, an admin. */
var TEAM_DEPT='Community Service', TEAM_MIN='Outreach Teams';
var MONTH_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function isTeamsMinistry_(dept, min){ return dept===TEAM_DEPT && min===TEAM_MIN; }
function teamMetrics_(campus){ return metricsFor(campus, TEAM_DEPT, TEAM_MIN).filter(function(m){ return m!=='Teams Hosted'; }); }
/* Volunteers Mobilized is the team's own head count for a team leaving on or
   after TEAM_AUTO_FROM (tripMetrics_ in api.js does the same for the
   dashboards), so the form has no box for it; earlier teams keep theirs. */
var TEAM_AUTO_FROM='2026-10-01', TEAM_AUTO_METRIC='Volunteers Mobilized';
function teamInputMetrics_(campus){ return teamMetrics_(campus).filter(function(m){ return m!==TEAM_AUTO_METRIC; }); }
function tripMetric_(tr, m){
  var size=(tr && tr.size!=null && tr.size!=='') ? Number(tr.size) : null;
  if(m===TEAM_AUTO_METRIC && tr && tr.to && tr.to>=TEAM_AUTO_FROM) return size;
  var v=tr && tr.metrics ? tr.metrics[m] : null;
  if(m===TEAM_AUTO_METRIC && (v==null || v==='')) return size;   // an earlier team with nothing logged: its head count
  return v;
}
/* Where a team is from, as one spelling — "USA", "U.S." and "united states"
   are one country (the server folds new entries the same way). */
var TEAM_COUNTRY_ALIAS={ 'usa':'United States','us':'United States','u.s.':'United States','u.s.a.':'United States','america':'United States','united states of america':'United States',
  'uk':'United Kingdom','u.k.':'United Kingdom','england':'United Kingdom','scotland':'United Kingdom','wales':'United Kingdom','britain':'United Kingdom','great britain':'United Kingdom',
  'korea':'South Korea','republic of korea':'South Korea','nz':'New Zealand','the philippines':'Philippines','holland':'Netherlands','png':'Papua New Guinea','hk':'Hong Kong','viet nam':'Vietnam','burma':'Myanmar','khmer':'Cambodia','kh':'Cambodia' };
function teamCountry_(tr){
  var raw=String((tr && tr.country)||'').trim().replace(/\s+/g,' ');
  if(!raw) return '';
  var al=TEAM_COUNTRY_ALIAS[raw.toLowerCase()]; if(al) return al;
  return raw.replace(/\S+/g, function(w){ return /^(and|of|the|de|da)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase()+w.slice(1).toLowerCase(); });
}
/* The countries the teams in a period came from, most teams first. */
function teamCountries_(trips){
  var by={}, none=0;
  trips.forEach(function(tr){ var c=teamCountry_(tr); if(!c){ none++; return; } var x=by[c]||(by[c]={ name:c, teams:0, people:0 }); x.teams++; x.people+=Number(tr.size)||0; });
  return { list:Object.keys(by).map(function(k){ return by[k]; }).sort(function(a,b){ return b.teams-a.teams || b.people-a.people || a.name.localeCompare(b.name); }), none:none };
}
/* The page opens on the year so far — the overview first; Year, Quarter
   and Month narrow it from there. */
function teamPeriod_(){ return ['month','quarter','ytd','year'].indexOf(S.teamPeriod)>-1 ? S.teamPeriod : 'ytd'; }
function teamYear_(){ return S.teamYear || new Date().getFullYear(); }
function teamQ_(){ return S.teamQ || (Math.floor(new Date().getMonth()/3)+1); }
function teamMonth_(){ return S.teamMonth || (new Date().getMonth()+1); }
function teamDate_(iso){ if(!iso) return ''; var m=Number(iso.slice(5,7)), d=Number(iso.slice(8,10)); return t(MONTH_SHORT[m-1]||'')+' '+d+', '+iso.slice(0,4); }
/* A team that applied on the portal is pending (tr.pending, from the server)
   until it is marked arrived — it is listed and on the calendar, but not
   counted until then. */
function tripFinished_(tr){ return tr && tr.status!=='cancelled' && !tr.pending && !!tr.to && tr.to<=todayStr(); }
function tripInPeriod_(tr, year, period, n){
  if(!tripFinished_(tr)) return false;
  var y=Number(tr.to.slice(0,4)), mo=Number(tr.to.slice(5,7));
  if(y!==year) return false;
  if(period==='month') return mo===n;
  if(period==='quarter') return Math.ceil(mo/3)===n;
  if(period==='ytd') return tr.to.slice(5)<=todayStr().slice(5);   // Jan 1 up to today's date — of that year, so years compare like for like
  return true;
}
function teamPeriodLabel_(){
  var p=teamPeriod_(), y=teamYear_();
  if(p==='month') return t(MONTH_SHORT[teamMonth_()-1])+' '+y;
  if(p==='quarter') return 'Q'+teamQ_()+' '+y;
  if(p==='ytd') return gpT('{year} to {date}',{year:y, date:hospDate_(todayStr())});
  return String(y);
}
/* Each team counts once, in the period it leaves — so a team here across
   the end of a quarter (or a year) is counted in the later one. The page
   says so on the team, and a period lists the teams that were here during
   it but count in the next one, without adding them in. */
function teamPeriodKey_(iso, p){
  if(!iso) return '';
  if(p==='month') return iso.slice(0,7);
  if(p==='quarter') return iso.slice(0,4)+'Q'+Math.ceil(Number(iso.slice(5,7))/3);
  return iso.slice(0,4);
}
function teamPeriodName_(iso, p){
  if(p==='month') return t(MONTH_SHORT[Number(iso.slice(5,7))-1])+' '+iso.slice(0,4);
  if(p==='quarter') return 'Q'+Math.ceil(Number(iso.slice(5,7))/3)+' '+iso.slice(0,4);
  return iso.slice(0,4);
}
function teamPeriodRange_(){
  var p=teamPeriod_(), y=teamYear_(), pad=function(n){ return ('0'+n).slice(-2); };
  if(p==='month'){ var m=teamMonth_(); return { from:y+'-'+pad(m)+'-01', to:calIso_(new Date(y, m, 0)) }; }
  if(p==='quarter'){ var q=teamQ_(); return { from:y+'-'+pad(q*3-2)+'-01', to:calIso_(new Date(y, q*3, 0)) }; }
  if(p==='ytd') return { from:y+'-01-01', to:y+'-'+todayStr().slice(5) };
  return { from:y+'-01-01', to:y+'-12-31' };
}
/* "Arrived in Q1 — counted in Q2, when it left", for a team whose visit
   crosses into another period of the kind on show */
function teamCrossNote_(tr){
  if(!tr.from || !tr.to || tr.status==='cancelled') return '';
  var p=teamPeriod_(); if(p==='ytd') p='year';
  if(teamPeriodKey_(tr.from, p)===teamPeriodKey_(tr.to, p)) return '';
  return tripFinished_(tr) ? gpT('Arrived in {from} — counted in {to}, when it left',{from:teamPeriodName_(tr.from, p), to:teamPeriodName_(tr.to, p)})
    : gpT('Arrived in {from} — will count in {to}, when it leaves',{from:teamPeriodName_(tr.from, p), to:teamPeriodName_(tr.to, p)});
}
/* teams here during the period on show that count in a later one (not the
   ones still here or coming — they are listed below anyway) */
function tripsAlsoHere_(trips){
  var r=teamPeriodRange_(), shown=tripsShown_(trips), today=todayStr();
  return trips.filter(function(tr){
    return tr.status!=='cancelled' && !tr.pending && tr.from && tr.to && tr.to<today && tr.from<=r.to && tr.to>=r.from && shown.indexOf(tr)===-1;
  }).sort(function(a,b){ return a.from<b.from ? -1 : 1; });
}
function tripsShown_(trips){
  var p=teamPeriod_(), n = p==='month' ? teamMonth_() : teamQ_();
  return trips.filter(function(tr){ return tripInPeriod_(tr, teamYear_(), p, n); });
}
function teamPeriodBarHtml_(){
  var p=teamPeriod_(), yNow=new Date().getFullYear(), y=teamYear_();
  var h='<div class="campusSeg periodSeg">'+[['ytd','Year to date'],['year','Full year'],['quarter','Quarter'],['month','Month']].map(function(o){
    return '<button class="campusBtn'+(p===o[0]?' on':'')+'" data-teamperiod="'+o[0]+'">'+esc(t(o[1]))+'</button>'; }).join('')+'</div>';
  h+='<div class="pickerRow teamPickRow"><label class="pick"><span>'+esc(t('Year'))+'</span><select id="teamYearSel">'+
    [yNow-2,yNow-1,yNow].map(function(yy){ return '<option value="'+yy+'"'+(yy===y?' selected':'')+'>'+yy+'</option>'; }).join('')+'</select></label>';
  if(p==='month') h+='<label class="pick"><span>'+esc(t('Month'))+'</span><select id="teamMonthSel">'+
    MONTH_SHORT.map(function(m,i){ return '<option value="'+(i+1)+'"'+(i+1===teamMonth_()?' selected':'')+'>'+esc(t(m))+'</option>'; }).join('')+'</select></label>';
  h+='</div>';
  if(p==='quarter') h+='<div class="deptChips">'+[1,2,3,4].map(function(n){
    return '<button class="deptChip'+(n===teamQ_()?' on':'')+'" data-teamq="'+n+'">Q'+n+'</button>'; }).join('')+'</div>';
  return h;
}
/* The year at a glance, under Year and YTD: a bar per month (teams that
   finished, and how many people), the four quarters, and how it compares
   with the year before over the same stretch. Tapping a month or a quarter
   opens it. */
function teamYearOverviewHtml_(trips){
  var p=teamPeriod_(), y=teamYear_(), today=todayStr(), cutMd = p==='ytd' ? today.slice(5) : '12-31';
  var months=[], quarters=[0,0,0,0], qPeople=[0,0,0,0];
  for(var m=1;m<=12;m++) months.push({ teams:0, people:0 });
  var tally=function(year){ var n=0, ppl=0; trips.forEach(function(tr){ if(!tripFinished_(tr) || Number(tr.to.slice(0,4))!==year || tr.to.slice(5)>cutMd) return; n++; ppl+=Number(tr.size)||0; }); return { teams:n, people:ppl }; };
  trips.forEach(function(tr){
    if(!tripFinished_(tr) || Number(tr.to.slice(0,4))!==y || tr.to.slice(5)>cutMd) return;
    var mo=Number(tr.to.slice(5,7)), sz=Number(tr.size)||0;
    months[mo-1].teams++; months[mo-1].people+=sz; quarters[Math.ceil(mo/3)-1]++; qPeople[Math.ceil(mo/3)-1]+=sz;
  });
  var max=Math.max.apply(null, months.map(function(x){ return x.teams; }).concat([1]));
  var nowYm=today.slice(0,7);
  var h='<div class="card teamYear" id="teamYear"><h3 style="margin:0 0 2px">📅 '+esc(gpT('{year} month by month',{year:y}))+'</h3>';
  var cur=tally(y), prev=tally(y-1);
  var diff=function(a,b){ var d=a-b; return d>0 ? '▲ '+d : d<0 ? '▼ '+(-d) : '='; };
  h+='<p class="hint" style="margin:0 0 10px" id="teamYearVs">'+esc(gpT('vs {year} over the same stretch: {teams} teams ({td}), {people} people ({pd})',{year:y-1, teams:prev.teams, td:diff(cur.teams, prev.teams), people:prev.people, pd:diff(cur.people, prev.people)}))+'</p>';
  h+='<div class="teamYearBars">'+months.map(function(x, i){
    var ym=y+'-'+('0'+(i+1)).slice(-2), future=ym>nowYm;
    return '<button class="teamYearBar'+(future?' future':'')+'" data-teamym="'+(i+1)+'" aria-label="'+esc(t(MONTH_SHORT[i])+': '+gpT('{n} teams',{n:x.teams})+', '+gpT('{n} people',{n:x.people}))+'">'+
      '<span class="teamYearN">'+(x.teams||'')+'</span><span class="teamYearCol"><span style="height:'+Math.round(x.teams/max*100)+'%"></span></span>'+
      '<span class="teamYearM">'+esc(t(MONTH_SHORT[i]).slice(0,3))+'</span><span class="teamYearP">'+(x.people||'')+'</span></button>';
  }).join('')+'</div><div class="teamYearKey hint">'+esc(t('Bar: teams that finished that month. Below: people.'))+'</div>';
  h+='<div class="teamYearQs">'+quarters.map(function(n, i){
    return '<button class="teamYearQ" data-teamyq="'+(i+1)+'"><b>Q'+(i+1)+'</b><span>'+esc(gpT('{n} teams',{n:n}))+'</span><span class="hint">'+esc(gpT('{n} people',{n:qPeople[i]}))+'</span></button>';
  }).join('')+'</div>';
  return h+'</div>';
}
/* One tile per figure: how many teams, how many people came, then every
   Outreach Teams metric summed over the teams that finished in the period,
   and the men/women split of who was reached. */
function teamsDashboardHtml_(campus, trips){
  var shown=tripsShown_(trips), metrics=teamMetrics_(campus);
  var sum=function(fn){ var s=0, any=false; shown.forEach(function(tr){ var v=fn(tr); if(v!==null && v!==undefined && v!=='' && !isNaN(Number(v))){ s+=Number(v); any=true; } }); return any?s:null; };
  /* Teams Hosted, then Volunteers Mobilized (everyone who came) and how many
     countries they came from, then every other metric */
  var tiles=[{ name:t('Teams Hosted'), text:fmt(shown.length,''), has:shown.length>0 }];
  var vm=sum(function(tr){ return tripMetric_(tr, TEAM_AUTO_METRIC); }), ctry=teamCountries_(shown);
  /* under the total, how many were men and how many women (each team's own head counts) */
  var vmM=sum(function(tr){ return tr.males; }), vmF=sum(function(tr){ return tr.females; });
  tiles.push({ name:t(TEAM_AUTO_METRIC), text:fmt(vm,''), has:vm!==null, id:'vmTile',
    split: (vmM!==null || vmF!==null) ? gpT('{m} men · {w} women',{m:fmt(vmM,''), w:fmt(vmF,'')}) : '' });
  tiles.push({ name:t('Countries'), text:fmt(ctry.list.length,''), has:ctry.list.length>0 });
  metrics.forEach(function(m){ if(m===TEAM_AUTO_METRIC) return; var v=sum(function(tr){ return tripMetric_(tr, m); }); tiles.push({ name:t(m), text:fmt(v,m), has:v!==null }); });
  var rm=sum(function(tr){ return tr.reached&&tr.reached.male; }), rf=sum(function(tr){ return tr.reached&&tr.reached.female; });
  tiles.push({ name:t('Men / Women Reached'), text:fmt(rm,'')+' / '+fmt(rf,''), has:rm!==null||rf!==null });
  // figures with numbers in first, so the six on show aren't dashes
  tiles=tiles.slice(0,2).concat(tiles.slice(2).filter(function(x){ return x.has; }), tiles.slice(2).filter(function(x){ return !x.has; }));
  var list=S.mmDashAll?tiles:tiles.slice(0,6);
  var h='<h3>📈 '+esc(gpT('{period} at a glance',{period:teamPeriodLabel_()}))+'</h3><div class="mmGrid">';
  list.forEach(function(tl){
    h+='<div class="mmTile'+(tl.has?'':' empty')+'"'+(tl.id?' id="'+tl.id+'"':'')+'><div class="mmTileName">'+esc(tl.name)+'</div>'+
      '<div class="mmTileNum">'+(tl.has?tl.text:'—')+'</div>'+
      (tl.split ? '<div class="mmTileSplit">'+esc(tl.split)+'</div>' : '')+
      '<div class="mmTileSub">'+esc(gpT('{n} teams',{n:shown.length}))+'</div></div>';
  });
  h+='</div>';
  if(tiles.length>6) h+='<button class="linkbtn" id="mmDashAll" style="margin:-6px 0 8px">'+
    esc(S.mmDashAll ? t('Show fewer') : gpT('Show all {n} metrics',{n:tiles.length}))+'</button>';
  if(ctry.list.length) h+='<div class="card slim teamCountries" id="teamCountries"><div class="teamCountriesHead">🌍 '+esc(gpT('{n} countries',{n:ctry.list.length}))+'</div>'+
    ctry.list.map(function(x){ return '<div class="teamCountry"><span>'+esc(x.name)+'</span><span class="hint">'+esc(gpT('{n} teams',{n:x.teams}))+(x.people?' · '+esc(gpT('{n} people',{n:x.people})):'')+'</span></div>'; }).join('')+
    (ctry.none ? '<div class="hint" style="margin-top:4px">'+esc(gpT('{n} teams with no country yet',{n:ctry.none}))+'</div>' : '')+'</div>';
  return h;
}
/* One team, kept short on purpose — the dates, and how many people (all,
   men, women). Everything else lives in Edit, or for a team that applied on
   the portal, in its application: "Open application" goes straight to it on
   the staff side of the portal (for anyone with portal access). */
function canPortalClient_(){ return !!(S.me && (S.me.isAdmin || S.me.portalStaff || S.me.portalAdmin || S.me.portal)); }
function tripDays_(tr){ return tr.from && tr.to ? Math.round((new Date(tr.to+'T00:00:00')-new Date(tr.from+'T00:00:00'))/86400000)+1 : 0; }
function teamPeopleLine_(tr){
  var bits=[];
  if(tr.size!=null && tr.size!=='') bits.push(gpT('{n} people',{n:tr.size}));
  if(tr.males!=null && tr.males!=='') bits.push(tr.males+' '+t('men'));
  if(tr.females!=null && tr.females!=='') bits.push(tr.females+' '+t('women'));
  return bits.length ? bits.join(' · ') : t('Head count not in yet');
}
function teamCardHtml_(tr, canEdit, campus){
  var n=tripDays_(tr);
  var h='<div class="card slim teamCard'+(tr.status==='cancelled'?' cancelled':'')+'" data-teamcard="'+esc(tr.id)+'">';
  h+='<div class="teamHead"><div style="min-width:0"><div class="rowName"><b>'+esc(tr.name)+'</b>'+
      (tr.pending ? ' <span class="teamStat pending" data-fromportal data-pending title="'+esc(candStageLabel_(tr.portalStage))+'">⏳ '+esc(t('Pending'))+'</span>' : '')+
      (tr.status==='cancelled'?' <span class="teamStat">'+esc(t('Cancelled'))+'</span>':'')+'</div>'+
      '<div class="rowSub">📅 '+(tr.from && tr.to ? esc(teamDate_(tr.from))+' → '+esc(teamDate_(tr.to))+' · '+esc(gpT('{n} days',{n:n})) : esc(t('Dates not set yet')))+'</div>'+
      '<div class="rowSub">👥 '+esc(teamPeopleLine_(tr))+'</div>'+
      (teamCrossNote_(tr) ? '<div class="rowSub teamCross">↪ '+esc(teamCrossNote_(tr))+'</div>' : '')+'</div>'+
    (canEdit?'<button class="linkbtn inline" data-teamedit="'+esc(tr.id)+'">'+esc(t('Edit'))+'</button>':'')+'</div>';
  if(tripFinished_(tr)){
    var any=Object.keys(tr.metrics||{}).some(function(m){ return tr.metrics[m]!=null; });
    h+='<div class="rowSub" style="margin-top:4px">'+(any ? '📊 '+esc(t('Numbers entered')) : '⚠️ '+esc(t('No numbers entered for this team yet')))+'</div>';
  }
  if(tr.candidateId && canPortalClient_()){
    h+='<a class="btn ghost small teamOpenApp" data-openapp="'+esc(tr.candidateId)+'" href="portal.html?open='+encodeURIComponent(tr.candidateId)+'" target="_blank" rel="noopener">🛂 '+esc(t('Open application'))+'</a>';
  }
  return h+'</div>';
}

/* ---------- the teams calendar ----------
   A month at a time, like Google Calendar: weeks start on Monday, each team
   is a bar across the days it is here (split at the week's edge and carried
   on the next row), stacked in lanes when teams overlap. Colour says where it
   stands — pending (applied on the portal, not arrived yet), coming, here now,
   been. Tap a bar for the team's card. Under the grid, the month's teams as a
   list, which is what a phone reads best. */
function calIso_(d){ return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function calKind_(tr, today){ return tr.pending ? 'pend' : tr.from<=today && tr.to>=today ? 'here' : tr.to<today ? 'past' : 'coming'; }
function teamCalHtml_(campus, trips){
  var today=todayStr(), ym=S.teamCalYm || today.slice(0,7);
  var y=Number(ym.slice(0,4)), m=Number(ym.slice(5,7));
  var first=new Date(y, m-1, 1), last=new Date(y, m, 0);
  var start=new Date(first); start.setDate(1-((first.getDay()+6)%7));
  var end=new Date(last); end.setDate(last.getDate()+(6-((last.getDay()+6)%7)));
  var mStart=calIso_(first), mEnd=calIso_(last);
  var live=trips.filter(function(tr){ return tr.status!=='cancelled' && tr.from && tr.to; })
    .sort(function(a,b){ return a.from<b.from?-1:a.from>b.from?1:(a.to<b.to?1:-1); });
  var h='<div class="card calCard" id="teamCal"><div class="calNav">'+
    '<button class="weekArrow" id="calPrev" aria-label="'+esc(t('Previous month'))+'">‹</button>'+
    '<div class="calTitle">'+esc(t(MONTH_SHORT[m-1]))+' '+y+'</div>'+
    '<button class="weekArrow" id="calNext" aria-label="'+esc(t('Next month'))+'">›</button>'+
    (ym!==today.slice(0,7) ? '<button class="linkbtn inline" id="calToday">'+esc(t('Today'))+'</button>' : '')+'</div>';
  h+='<div class="calHead">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(d){ return '<span>'+esc(t(d))+'</span>'; }).join('')+'</div>';
  for(var ws=new Date(start); ws<=end; ws.setDate(ws.getDate()+7)){
    var days=[]; for(var i=0;i<7;i++){ var d=new Date(ws); d.setDate(ws.getDate()+i); days.push(calIso_(d)); }
    var segs=[], lanes=[];
    live.forEach(function(tr){
      if(tr.to<days[0] || tr.from>days[6]) return;
      var a=Math.max(0, days.indexOf(tr.from<days[0]?days[0]:tr.from)), b=days.indexOf(tr.to>days[6]?days[6]:tr.to);
      var lane=0; while(lanes[lane]!==undefined && lanes[lane]>=a) lane++;
      lanes[lane]=b;
      segs.push({ tr:tr, a:a, b:b, lane:lane, cont:tr.from<days[0], more:tr.to>days[6] });
    });
    var rows=Math.max(2, lanes.length);
    h+='<div class="calWeek" style="grid-template-rows:22px repeat('+rows+',20px)">';
    days.forEach(function(iso, i){
      var cls=(iso<mStart||iso>mEnd?' out':'')+(iso===today?' today':'');
      h+='<div class="calDay'+cls+'" style="grid-column:'+(i+1)+';grid-row:1 / -1"><span class="calNum">'+Number(iso.slice(8,10))+'</span></div>';
    });
    segs.forEach(function(sg){
      var k=calKind_(sg.tr, today);
      h+='<button class="calBar '+k+(sg.cont?' cont':'')+(sg.more?' more':'')+(S.teamCalSel===sg.tr.id?' sel':'')+'" data-calteam="'+esc(sg.tr.id)+'" style="grid-column:'+(sg.a+1)+' / span '+(sg.b-sg.a+1)+';grid-row:'+(sg.lane+2)+'" title="'+esc(sg.tr.name)+'">'+esc(sg.tr.name)+'</button>';
    });
    h+='</div>';
  }
  h+='<div class="calLegend"><span class="calDot pend"></span>'+esc(t('Pending'))+'<span class="calDot coming"></span>'+esc(t('Coming'))+
    '<span class="calDot here"></span>'+esc(t('Here now'))+'<span class="calDot past"></span>'+esc(t('Been'))+'</div></div>';
  var sel=S.teamCalSel && live.filter(function(tr){ return tr.id===S.teamCalSel; })[0];
  if(sel) h+=teamCardHtml_(sel, (S.teamTrips[campus]||{}).canEdit, campus);
  var inMonth=live.filter(function(tr){ return tr.to>=mStart && tr.from<=mEnd; });
  var people=0; inMonth.forEach(function(tr){ people+=Number(tr.size)||0; });
  h+='<h3>'+esc(gpT('Teams in {month}',{month:t(MONTH_SHORT[m-1])+' '+y}))+' <small>· '+inMonth.length+(people?' · '+esc(gpT('{n} people',{n:people})):'')+'</small></h3>';
  if(!inMonth.length) h+='<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No teams this month.'))+'</p></div>';
  else h+='<div class="accCard">'+inMonth.map(function(tr){
    var k=calKind_(tr, today);
    return '<button class="calRow" data-calteam="'+esc(tr.id)+'"><span class="calDot '+k+'"></span><span style="flex:1;min-width:0"><b>'+esc(tr.name)+'</b>'+
      '<span class="rowSub" style="display:block">'+esc(teamDate_(tr.from))+' → '+esc(teamDate_(tr.to))+' · '+esc(teamPeopleLine_(tr))+
      (tr.pending?' · ⏳ '+esc(t('Pending')):'')+'</span></span></button>';
  }).join('')+'</div>';
  return h;
}
function teamBlank_(campus){
  return { id:'', campus:campus, name:'', org:'', country:'', from:'', to:'', size:'', males:'', females:'', couples:'', families:'',
    staff:'', focus:'', status:'active', notes:'', metrics:{}, reached:{ male:'', female:'' } };
}
function teamFormHtml_(campus){
  var f=S.teamForm, metrics=teamInputMetrics_(campus), isNew=!f.id;
  var inp=function(key, label, type, extra){
    var v=f[key]; if(v==null) v='';
    return '<div><label class="f">'+esc(label)+'</label><input type="'+type+'"'+(type==='number'?' inputmode="numeric" min="0"':'')+
      ' data-tf="'+key+'" value="'+esc(String(v))+'"'+(extra||'')+'></div>';
  };
  var h='<div class="card" id="teamFormCard"><h3 style="margin-top:0">'+esc(isNew?t('Add a team'):t('Edit team'))+'</h3>';
  if(f.candidateId) h+='<p class="hint" style="margin:0 0 8px">🛂 '+esc(t('This team applied on the portal. Its name, dates and head counts follow the application, and the team enters its own numbers there — you can still change them here.'))+'</p>';
  h+=inp('name', t('Team name'), 'text', ' maxlength="120" placeholder="'+esc(t('e.g. Endeavor DTS'))+'"');
  h+='<div class="teamGrid2">'+inp('org', t('Sending base / church'), 'text', ' maxlength="120"')+inp('country', t('Country'), 'text', ' maxlength="60" list="teamCountryList" autocomplete="off"')+'</div>'+
    '<datalist id="teamCountryList">'+COUNTRIES.map(function(c){ return '<option value="'+esc(c)+'">'; }).join('')+'</datalist>';
  h+='<div class="teamGrid2">'+inp('from', t('Arrived'), 'date')+inp('to', t('Left'), 'date')+'</div>';
  h+='<div class="teamGrid2">'+inp('size', t('People in the team'), 'number')+inp('couples', t('Couples'), 'number')+'</div>';
  h+='<div class="teamGrid3">'+inp('males', t('Men'), 'number')+inp('females', t('Women'), 'number')+inp('families', t('Families'), 'number')+'</div>';
  h+=inp('staff', t('Hosted by (our staff)'), 'text', ' maxlength="120"');
  h+=inp('focus', t('Outreach focus'), 'text', ' maxlength="200" placeholder="'+esc(t('e.g. Teaching, Evangelism'))+'"');
  h+='<label class="f">'+esc(t('Status'))+'</label><select data-tf="status">'+
    '<option value="active"'+(f.status!=='cancelled'?' selected':'')+'>'+esc(t('Came as planned'))+'</option>'+
    '<option value="cancelled"'+(f.status==='cancelled'?' selected':'')+'>'+esc(t('Cancelled'))+'</option></select>';
  h+='<h4 style="margin:16px 0 4px">'+esc(t('The team’s numbers — totals for the whole visit'))+'</h4>';
  h+='<p class="hint" style="margin:0 0 6px">'+esc(t('Gathered at the end of their trip. Leave a box empty if you don’t have it.'))+'</p>';
  metrics.forEach(function(m){
    var v=f.metrics[m]; if(v==null) v='';
    h+='<div class="row"><div class="rowName">'+esc(t(m))+'</div><input type="number" inputmode="numeric" class="kpiIn" data-tfm="'+esc(m)+'" value="'+esc(String(v))+'"></div>';
  });
  var rm=f.reached.male==null?'':f.reached.male, rf=f.reached.female==null?'':f.reached.female;
  h+='<div class="row"><div class="rowName">'+esc(t('Men reached'))+'</div><input type="number" inputmode="numeric" class="kpiIn" data-tfr="male" value="'+esc(String(rm))+'"></div>';
  h+='<div class="row"><div class="rowName">'+esc(t('Women reached'))+'</div><input type="number" inputmode="numeric" class="kpiIn" data-tfr="female" value="'+esc(String(rf))+'"></div>';
  h+='<label class="f">'+esc(t('Notes'))+'</label><textarea data-tf="notes" rows="2" maxlength="1000">'+esc(f.notes||'')+'</textarea>';
  h+='<button class="btn" id="teamSaveBtn">'+esc(isNew?t('Add this team'):t('Save team'))+'</button>';
  h+='<button class="btn ghost" id="teamCancelBtn">'+esc(t('Cancel'))+'</button>';
  if(!isNew) h+='<button class="linkbtn teamDelete" id="teamDeleteBtn">'+esc(t('Delete this team'))+'</button>';
  return h+'</div>';
}
function teamsMinistryHtml_(campus){
  var c=S.teamTrips[campus];
  var h='<div id="teamsPage" data-campus="'+esc(campus)+'">';
  h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Teams are entered one at a time, once their visit is over — not week by week. Each team counts in the week it leaves, and the Base dashboard picks it up from there.'))+'</p>';
  if(!c && S.teamError[campus]) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load the teams.'))+'</p>'+
    '<p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.teamError[campus])+'</p>'+
    '<button class="btn ghost" id="teamRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div></div>';
  if(!c) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div></div>';
  var view=S.teamView==='cal' ? 'cal' : 'list';
  h+='<div class="campusSeg" style="max-width:none;margin-bottom:10px">'+
    '<button class="campusBtn'+(view==='list'?' on':'')+'" data-teamview="list">📋 '+esc(t('Teams'))+'</button>'+
    '<button class="campusBtn'+(view==='cal'?' on':'')+'" data-teamview="cal">📅 '+esc(t('Calendar'))+'</button></div>';
  if(view==='cal') return h+teamCalHtml_(campus, c.trips)+'</div>';
  h+=teamPeriodBarHtml_();
  h+=teamsDashboardHtml_(campus, c.trips);
  if(teamPeriod_()==='year' || teamPeriod_()==='ytd') h+=teamYearOverviewHtml_(c.trips);
  if(c.canEdit){
    if(S.teamForm && S.teamForm.campus===campus) h+=teamFormHtml_(campus);
    else h+='<button class="btn" id="teamAddBtn" style="margin-top:0">＋ '+esc(t('Add a team'))+'</button>';
  }
  var shown=tripsShown_(c.trips);
  h+='<h3>'+esc(gpT('Teams · {period}',{period:teamPeriodLabel_()}))+' <small>· '+shown.length+'</small></h3>';
  if(!shown.length) h+='<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No teams finished in this period.'))+'</p></div>';
  shown.forEach(function(tr){ h+=teamCardHtml_(tr, c.canEdit, campus); });
  var also=tripsAlsoHere_(c.trips);
  if(also.length){
    h+='<h3 id="teamsAlso">'+esc(gpT('Also here in {period}',{period:teamPeriodLabel_()}))+' <small>· '+also.length+'</small></h3>'+
      '<p class="sub" style="margin:0 0 8px">'+esc(t('These teams were here during this time but left after it, so they count in the period they left — not here. Each team counts once.'))+'</p>';
    also.forEach(function(tr){ h+=teamCardHtml_(tr, c.canEdit, campus); });
  }
  var now=todayStr(), coming=c.trips.filter(function(tr){ return tr.status!=='cancelled' && (tr.to>=now || tr.pending || !tr.to); })
    .sort(function(a,b){ if(!a.from) return 1; if(!b.from) return -1; return a.from<b.from?-1:1; });
  if(coming.length){
    var comingPeople=0, pendN=0; coming.forEach(function(tr){ comingPeople+=Number(tr.size)||0; if(tr.pending) pendN++; });
    h+='<h3 id="teamsComing">'+esc(t('Here now or coming'))+' <small>· '+coming.length+(comingPeople?' · '+esc(gpT('{n} people',{n:comingPeople})):'')+(pendN?' · '+esc(gpT('{n} pending',{n:pendN})):'')+'</small></h3>';
    h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Every team application is here from the day it comes in, and stays pending until its flights are confirmed. Enter their numbers once they leave — they join the dashboard then.'))+'</p>';
    coming.forEach(function(tr){ h+=teamCardHtml_(tr, c.canEdit, campus); });
  }
  return h+'</div>';
}

/* ---------- My Ministry ----------
   One page, two tabs, ONE ministry at a time. The page is built around the
   ministry you are entering numbers for — picked at the top (your own, one
   you oversee, or for an admin any on the campus), named in a banner so
   there is never a doubt whose boxes these are — then that ministry's
   dashboard, its week strip (which weeks have numbers in), and the one
   button that unfolds its form. Your own ministry gets the full daily /
   weekly form (kpiCardHtml); any other gets the weekly rows (ovWeekRowsHtml_).
   Outreach Teams is entered on its own Teams Database page instead.

   A Campus Leadership person's own row is their team's section: no weekly
   numbers (hidden for now) — the Leadership OKRs as its dashboard and the
   Monday meeting board (leadSectionHtml_). It sits last in the picker as
   "Campus Leadership" and is where the page opens for them. The person's own
   four personal numbers are off the page altogether for now (personalCardHtml_
   is kept for when they return). */
/* Only the ministries you are part of (same rule as canLogFor_ in api.js):
   your main one, the others on your profile, any you lead, and — for a
   department's Campus Leadership overseer — that department's ministries.
   An admin gets those first and then every other ministry on the campus
   (role 'admin'), always as the Department / Ministry dropdowns. */
function mmOptions_(){
  var deps=getDepartments(S.me.campus), out=[];
  var oversees=myOversightDept_(), isBL = S.me.dept===BL_DEPT;
  var push=function(d,m,role){ if(!out.some(function(o){ return o.dept===d && o.min===m; })) out.push({ dept:d, min:m, role:role }); };
  var pushKey=function(k,role){ var p=String(k||'').split('|'); if(p.length===2 && deps[p[0]] && deps[p[0]][p[1]]!==undefined && p[0]!==BL_DEPT) push(p[0], p[1], role); };
  if(S.me.ministry && !isBL) push(S.me.dept, S.me.ministry, 'main');
  (S.me.ministries||[]).forEach(function(k){ pushKey(k, 'member'); });
  (S.me.leads||[]).forEach(function(k){ pushKey(k, 'leader'); });
  if(oversees) Object.keys(deps[oversees]||{}).forEach(function(m){ push(oversees, m, 'oversee'); });
  if(S.me.isAdmin) Object.keys(deps).forEach(function(d){ if(d===BL_DEPT) return; Object.keys(deps[d]).forEach(function(m){ push(d, m, 'admin'); }); });
  if(S.me.ministry && isBL) push(S.me.dept, S.me.ministry, 'main');   // last, never the default
  return out;
}
function mmSelected_(opts){
  if(!opts.length) return null;
  var pick=opts.filter(function(o){ return o.dept===S.mmBrowseDept && o.min===S.mmBrowseMinistry; })[0];
  if(pick) return pick;
  // a department picked with no ministry yet (the admin's Department select) → its first weekly ministry
  var inDept=opts.filter(function(o){ return o.dept===S.mmBrowseDept; });
  if(inDept.length) return inDept.filter(function(o){ return !isTeamsMinistry_(o.dept, o.min); })[0] || inDept[0];
  // your own first — for Campus Leadership that is its OKRs and meeting board
  var own = opts.filter(function(o){ return o.dept===S.me.dept && o.min===S.me.ministry; })[0];
  // otherwise the first weekly ministry — Outreach Teams is its own page
  return own || opts.filter(function(o){ return !isTeamsMinistry_(o.dept, o.min); })[0] || opts[0];
}
function mmOptionLabel_(o){
  if(o.dept===BL_DEPT) return '🧭 '+t('Campus Leadership');
  return (MIN_EMOJI[o.min]?MIN_EMOJI[o.min]+' ':'')+t(o.min);
}
function mmPickerHtml_(opts, sel){
  if(opts.length<2) return '';
  var depts=[]; opts.forEach(function(o){ if(depts.indexOf(o.dept)===-1) depts.push(o.dept); });
  var h='<div class="mmPick"><div class="weekNavLabel">'+esc(t('Which ministry'))+'</div>';
  if(opts.length<=8 && !S.me.isAdmin){
    h+='<div class="deptChips">'+opts.map(function(o){
      var on=o.dept===sel.dept && o.min===sel.min;
      return '<button class="deptChip'+(on?' on':'')+'" data-mmpick="'+esc(o.dept)+'|'+esc(o.min)+'">'+esc(mmOptionLabel_(o))+'</button>'; }).join('')+'</div>';
    return h+'</div>';
  }
  var mins=opts.filter(function(o){ return o.dept===sel.dept; });
  h+='<div class="pickerRow" style="margin-top:4px">'+
    '<label class="pick"><span>'+esc(t('Department'))+'</span><select id="mmBrowseDeptSel"'+(depts.length<2?' disabled':'')+'>'+
      depts.map(function(d){ return '<option value="'+esc(d)+'"'+(sel.dept===d?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+
    '</select></label>'+
    '<label class="pick"><span>'+esc(t('Ministry'))+'</span><select id="mmBrowseMinSel"'+(mins.length<2?' disabled':'')+'>'+
      mins.map(function(o){ return '<option value="'+esc(o.min)+'"'+(sel.min===o.min?' selected':'')+'>'+esc(mmOptionLabel_(o))+'</option>'; }).join('')+
    '</select></label></div>';
  return h+'</div>';
}
function mmBannerHtml_(sel, mine){
  var isBL = sel.dept===BL_DEPT;
  var name = isBL ? t('Campus Leadership') : t(sel.min);
  var emoji = isBL ? '🧭' : (MIN_EMOJI[sel.min]||'📊');
  /* Campus Leadership's is one slim line — its page is the OKRs and the board */
  if(isBL) return '<div class="card mmBanner slim leadBanner" id="mmBanner"><div class="mmBannerEmoji">'+emoji+'</div><div style="min-width:0">'+
    '<div class="mmBannerName">'+esc(name)+'</div><div class="rowSub">'+esc(campusName(S.me.campus))+'</div></div></div>';
  var h='<div class="card mmBanner" id="mmBanner"><div class="mmBannerEmoji">'+emoji+'</div><div style="min-width:0">'+
    '<div class="mmBannerName">'+esc(name)+'</div>'+
    '<div class="rowSub">'+esc(isBL ? t('OKRs and the Monday leadership meeting') : t(sel.dept))+' · '+esc(campusName(S.me.campus))+'</div>';
  var leaders = isBL ? [] : ministryLeaders_(S.me.campus, sel.dept, sel.min);
  if(leaders.length) h+='<div class="rowSub">👑 '+esc(t('Led by'))+' '+leaders.map(function(p){ return esc(p.name); }).join(', ')+'</div>';
  var note = isBL ? 'Campus Leadership tracks its OKRs here, not weekly numbers.'
    : mine ? 'Your main ministry — you are entering its numbers.'
    : sel.role==='member' ? 'One of your ministries — you are entering its numbers.'
    : sel.role==='leader' ? 'You lead this ministry — you are entering its numbers.'
    : sel.role==='admin' ? 'As an admin you can see and enter this ministry’s numbers.'
    : 'You are entering numbers for this ministry.';
  h+='<div class="mmBannerNote">'+esc(t(note))+'</div>';
  return h+'</div></div>';
}
function myMinistryHtml(){
  var h='<button class="linkbtn" id="ministryBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>';
  h+='<h2>'+esc(t('My Ministry'))+'</h2>';
  var tab = S.mmTab==='okr' ? 'okr' : 'ministry';
  h+='<div class="campusSeg" style="max-width:none">'+
    '<button class="campusBtn'+(tab==='ministry'?' on':'')+'" data-mmtab="ministry">📊 '+esc(t('Numbers'))+'</button>'+
    '<button class="campusBtn'+(tab==='okr'?' on':'')+'" data-mmtab="okr">🎯 '+esc(t('OKRs'))+'</button></div>';
  if(tab==='okr') return h+okrTabHtml_();

  var opts=mmOptions_(), sel=mmSelected_(opts);
  if(!sel){
    return h+'<div class="card"><p class="sub" style="margin:4px 0 10px">'+
      esc(t('Set your ministry on the Profile tab and your team’s KPIs will show up here, ready to log.'))+'</p>'+
      '<button class="btn ghost" id="goProfile">'+esc(t('Choose my ministry'))+'</button></div>';
  }
  S.mmBrowseDept=sel.dept; S.mmBrowseMinistry=sel.min;
  var mine = sel.dept===S.me.dept && sel.min===S.me.ministry;
  h+=mmPickerHtml_(opts, sel);
  h+=mmBannerHtml_(sel, mine);
  // Campus Leadership: its OKRs and the Monday meeting board, no weekly numbers (hidden for now)
  S.leadShown = sel.dept===BL_DEPT;
  if(S.leadShown){
    var pd = mine ? pulseDeptsForMe_() : [];
    var ph = pd.map(function(d){ return pulseCardHtml_(d, pd.length>1); }).join('');
    /* Your own leadership row: "My week" first — the numbers come from it — and
       the board, pulse and the Director's quarter a tab away. */
    if(mine && S.me.dept===BL_DEPT && S.me.ministry){
      var lwt=S.lwTab==='board' || S.lwTab==='base' || S.lwTab==='money' ? S.lwTab : 'week';
      /* who you are on the team — International / National Campus Director, Director of … */
      var myTitle=orgTitleOf_(S.me);
      if(myTitle) h+='<div class="orgYou">🧭 '+esc(gpT('Your role: {title}',{title:orgTitleText_(myTitle)}))+'</div>';
      h+='<div class="campusSeg lwSeg" style="max-width:none">'+[['week','🗓️','My week'],['base','🧭','Overview'],['money','💵','Finances'],['board','📋','Board']].map(function(x){
        return '<button class="campusBtn'+(lwt===x[0]?' on':'')+'" data-lwtab="'+x[0]+'">'+x[1]+' '+esc(t(x[2]))+'</button>'; }).join('')+'</div>';
      if(lwt==='week') return h+lwHtml_();
      /* the base's finances, from the Finances office's reports (teams/09-finance.js) */
      if(lwt==='money') return h+finDashHtml_();
      if(lwt==='base') return h+orgCltCardHtml_(S.me.campus)+leadBaseHtml_(ph);
      return h+(mine ? directorQuarterHtml_() : '')+leadSectionHtml_();
    }
    return h+ph+orgCltCardHtml_(S.me.campus)+(mine ? directorQuarterHtml_() : '')+leadSectionHtml_();
  }
  /* The Cafe runs its day here — open, sell, close, the rota — and its numbers
     fill themselves in; the usual numbers are a tab away. */
  if(sel.dept==='Community Service' && sel.min==='Cafe'){
    h+='<div class="campusSeg" style="max-width:none"><button class="campusBtn'+(S.cafeView!=='numbers'?' on':'')+'" data-cafeview="tool">☕ '+esc(t('Cafe tool'))+'</button>'+
      '<button class="campusBtn'+(S.cafeView==='numbers'?' on':'')+'" data-cafeview="numbers">📊 '+esc(t('The numbers'))+'</button></div>';
    if(S.cafeView!=='numbers') return h+cafeHtml_();
    h+='<p class="hint">'+esc(t('When the cafe tool is used, these numbers fill themselves in from it.'))+'</p>';
  }

  /* The Finances office runs the month's reports here (teams/09-finance.js), sees
     what leadership sees, and its usual numbers are the third tab. */
  if(sel.dept==='Skills Training' && sel.min==='Finances' && finCanEditClient_()){
    h+=finMinistryTabsHtml_();
    if(S.finTab==='reports') return h+finReportsHtml_();
    if(S.finTab==='dash') return h+finDashHtml_();
  }

  if(sel.dept==='Skills Training' && sel.min==='Hospitality' && canHospClient_()){
    h+='<div class="card"><p class="sub" style="margin:0 0 10px">'+esc(t('Rooms, beds and bookings for guests, speakers, teams, students and volunteers — and team requests from the portal.'))+'</p>'+
      '<button class="btn" id="goHosp" style="margin-top:0">🌺 '+esc(t('Open SR Hospitality'))+'</button></div>';
  }
  /* The week's numbers come first — status, who is responsible, and the boxes
     themselves, already open when the week has nothing in yet — and the
     schedules and the at-a-glance charts after them: they are for reading,
     the numbers are what this page is for. */
  var schedH = (typeof dutyHtml==='function') ? schedMinistryHtml_(sel.dept, sel.min) : '';
  if(isTeamsMinistry_(sel.dept, sel.min)){
    h+=schedH;
    h+='<div class="card"><p class="sub" style="margin:0 0 10px">'+
      esc(t('Teams are entered one at a time, once their visit is over — not week by week. Each team counts in the week it leaves, and the Base dashboard picks it up from there.'))+'</p>'+
      '<button class="btn" id="goTeamsDb" style="margin-top:0">🗂️ '+esc(t('Open the Teams Database'))+'</button></div>';
  } else if(mine){
    var wk=kpiViewWeek(), akey=sel.dept+'|'+sel.min+'|'+wk;
    if(S.ministry && S.kpiAutoKey!==akey){
      S.kpiAutoKey=akey;
      S.kpiInputOpen=!ministryWeekLogged_(S.ministry, wk);
      if(S.kpiInputOpen){ S.dbAcc.kpiDay=true; S.dbAcc.kpiWeek=true; S.dbAcc.kpiMonth=true; S.dbAcc.kpiQuarter=true; }
    }
    h+=ministryWeekStatusHtml_(S.ministry, wk, null);
    if(S.kpiInputOpen) h+=kpiCardHtml(wk);
    if(sel.dept==='Skills Training' && sel.min==='Finances') h+=staffDebtCardHtml_();
    h+=schedH;
    h+=ministryDashboardHtml_(S.me.campus, sel.dept, sel.min, S.ministry);
  } else {
    var data=S.oversee[sel.min];
    if(!data && S.ovError[sel.min]){
      h+='<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(gpT('Couldn’t load {ministry}’s numbers.',{ministry:t(sel.min)}))+'</p>'+
        '<p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.ovError[sel.min])+'</p>'+
        '<button class="btn ghost" id="ovRetry" data-ministry="'+esc(sel.min)+'" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
    }
    else if(!data) h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
    else {
      var owk=ovWeekFor_(sel.min), okey=sel.dept+'|'+sel.min+'|'+owk;
      S.ovAutoKey=S.ovAutoKey||{};
      if(S.ovAutoKey[sel.min]!==okey){ S.ovAutoKey[sel.min]=okey; S.ovInputOpen[sel.min]=!ministryWeekLogged_(data, owk); }
      h+=ministryWeekStatusHtml_(data, owk, sel.min);
      if(S.ovInputOpen[sel.min]) h+=ovWeekRowsHtml_(sel.dept, sel.min, data, owk);
      if(sel.dept==='Skills Training' && sel.min==='Finances') h+=staffDebtCardHtml_();
      h+=schedH;
      h+=ministryDashboardHtml_(S.me.campus, sel.dept, sel.min, data);
    }
    if(!data) h+=schedH;
  }

  if(canEditMetricsClient_(S.me.campus, sel.dept, sel.min)){
    S.metricEditTarget = { campus:S.me.campus, dept:sel.dept, ministry:sel.min };
    h+='<div class="accCard">'+accRowHtml('dbAcc', 'kpiMetrics', '⚙️ '+esc(t('Edit what we track')),
      esc(t('Add, rename or remove metrics; move a count to monthly or quarterly')),
      function(){ return metricEditorHtml_(S.me.campus, sel.dept, sel.min); })+'</div>';
  }
  return h;
}

/* ---------- Human Resources ----------
   Staff contracts, on the page an admin or anyone with `hr` reaches from
   the menu. One row per person; a person's page holds their contracts (a
   renewal is another row), the papers attached to each, how long they have
   served, when the current contract runs out, and the archive box for
   someone who leaves. The paper contract stays in the drawer — this is the
   record of it. Later this page grows into processing potential staff and
   volunteers; for now it is contracts. */
var HR_DUE_DAYS=90;
function hrMonthLabel_(ym){ if(!ym) return ''; return t(MONTH_SHORT[Number(ym.slice(5,7))-1]||'')+' '+ym.slice(0,4); }
function hrContractEnd_(c){ var y=Number(c.signed.slice(0,4)), m=Number(c.signed.slice(5,7))-1; return new Date(y, m+Math.round(Number(c.years)*12), 1); }
function hrEndYm_(c){ var d=hrContractEnd_(c); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2); }
function hrDaysLeft_(c){ var now=new Date(); now.setHours(0,0,0,0); return Math.round((hrContractEnd_(c)-now)/86400000); }
function hrInForce_(c){ return !c.digital || c.digital.status==='signed'; }
function hrCurrent_(p){ var l=(p.contracts||[]).filter(hrInForce_); return l.length ? l[l.length-1] : null; }
function hrStatus_(p){
  // label is the full sentence (banner, list line); short fits a chip
  if(p.archived) return { key:'archived', label:t('Archived'), short:t('Archived') };
  var c=hrCurrent_(p); if(!c) return { key:'none', label:t('No contract on file'), short:t('No contract') };
  var d=hrDaysLeft_(c);
  if(d<0) return { key:'expired', label:gpT('Expired {n} days ago',{n:-d}), short:t('Expired'), days:d };
  if(d<=HR_DUE_DAYS) return { key:'due', label:gpT('Renew in {n} days',{n:d}), short:t('Renew soon'), days:d };
  return { key:'active', label:gpT('Until {month}',{month:hrMonthLabel_(hrEndYm_(c))}), short:gpT('Until {month}',{month:hrMonthLabel_(hrEndYm_(c))}), days:d };
}
/* How long someone has served, three ways:
     In YWAM since      the year they joined YWAM anywhere in the world
                        (ywamSince — some served in other countries first)
     On each campus     when they started in Poipet and/or Siem Reap: the
                        month set for it (starts), or else the first contract
                        signed with that campus, or else — for the campus
                        they are on now — the year they joined. A campus's
                        time runs until they started on the next one.
     Serving YWAM GP    the two together: from the earliest campus start.
   Adding a newer contract never moves any of them. */
function hrContractCampus_(p, c){ return (c && c.campus) || p.campus; }
function hrStartOf_(p, campus){
  var set=(p.starts && p.starts[campus]) || (campus===p.campus && p.baseSince) || '';
  if(/^\d{4}-\d{2}$/.test(set)) return { month:set, set:true };
  var first=(p.contracts||[]).filter(function(c){ return hrContractCampus_(p, c)===campus; })[0], c=[];
  if(first) c.push(first.signed);
  if(campus===p.campus && /^\d{4}$/.test(p.joined||'')) c.push(p.joined+'-01');
  c.sort();
  return c.length ? { month:c[0], set:false } : null;
}
/* each campus they have time on, oldest first, with where it ends */
function hrPeriods_(p){
  var list=CAMPUSES.map(function(x){ var s=hrStartOf_(p, x.id); return s ? { campus:x.id, from:s.month, set:s.set } : null; }).filter(Boolean)
    .sort(function(a,b){ return a.from<b.from ? -1 : a.from>b.from ? 1 : 0; });
  list.forEach(function(x, i){ x.to = list[i+1] ? list[i+1].from : ''; });
  return list;
}
function hrSince_(p){ var s=hrStartOf_(p, p.campus); return s ? s.month+'-01' : ''; }
function hrGpSince_(p){ var l=hrPeriods_(p); return l.length ? l[0].from+'-01' : ''; }
function hrMonthsBetween_(a, b){ var ya=Number(a.slice(0,4)), ma=Number(a.slice(5,7)), yb=Number(b.slice(0,4)), mb=Number(b.slice(5,7)); return Math.max(0, (yb-ya)*12+(mb-ma)); }
function hrMonthsLabel_(months){ var y=Math.floor(months/12), m=months%12, parts=[]; if(y) parts.push(gpT('{n} yr',{n:y})); if(m||!y) parts.push(gpT('{n} mo',{n:m})); return parts.join(' '); }
function hrServing_(p){ return hrSpan_(hrGpSince_(p)); }
function hrSpan_(since){
  if(!since) return '';
  var a=new Date(since+'T00:00:00'), b=new Date();
  var months=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth()); if(b.getDate()<a.getDate()) months--; if(months<0) months=0;
  var y=Math.floor(months/12), m=months%12, parts=[];
  if(y) parts.push(gpT('{n} yr',{n:y})); if(m||!y) parts.push(gpT('{n} mo',{n:m}));
  return parts.join(' ');
}
function hrYearsLabel_(n){ return Number(n)===1 ? t('1 year') : gpT('{n} years',{n:n}); }
function hrYwamYears_(since){ var y=Number(since); if(!(y>=1960)) return 0; return Math.max(0, new Date().getFullYear()-y); }
/* the HR list's filters: by where their contract stands, and who is still on paper */
var HR_FILTERS_=[['all','All'],['expired','Expired'],['due','Renew soon'],['active','Current'],['none','No contract'],['paper','Paper only']];
function hrIsDigital_(c){ return !!(c && c.digital && c.digital.status==='signed'); }
function hrFilterHas_(p, f){
  if(f==='all') return true;
  var st=hrStatus_(p);
  if(f==='paper'){ var c=hrCurrent_(p); return !!c && !hrIsDigital_(c); }
  return st.key===f;
}
/* soonest end first (run out the longest ago at the very top), no contract last */
function hrByEnd_(a, b){
  var A=hrStatus_(a), B=hrStatus_(b), ra=A.days==null ? 1e9 : A.days, rb=B.days==null ? 1e9 : B.days;
  return ra!==rb ? ra-rb : (a.name<b.name ? -1 : 1);
}
function hrStatusChip_(st){ return '<span class="hrChip '+st.key+'">'+esc(st.short)+'</span>'; }
function hrRowHtml_(p){
  var st=hrStatus_(p), serving=hrServing_(p);
  return '<div data-hrrow="'+esc((p.name+' '+p.username).toLowerCase())+'"><button class="adminRow" data-hrperson="'+esc(p.id)+'">'+avatarHtml(p,'sm')+
    '<span class="adminRowText"><span class="rowName">'+esc(p.name)+'</span>'+
    '<span class="rowSub">'+esc(t(p.dept))+(p.ministry?' · '+esc(t(p.ministry)):'')+(serving?' · '+esc(serving):'')+(p.ywamSince?' · '+esc(gpT('{n} yrs in YWAM',{n:hrYwamYears_(p.ywamSince)})):'')+
      ((st.key==='due'||st.key==='expired')?' · '+esc(st.label):'')+
      (hrCurrent_(p) ? ' · '+(hrIsDigital_(hrCurrent_(p)) ? '✍️ '+esc(t('Digital')) : '📄 '+esc(t('Paper'))) : '')+'</span></span>'+
    hrStatusChip_(st)+'</button></div>';
}
function hrBackHtml_(to, label){
  return '<button class="linkbtn" id="hrBack" data-hrback="'+to+'" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(label)+'</button>';
}
function hrHtml(){
  if(S.hrSub==='person' && S.hrStaff){
    var who=S.hrStaff.filter(function(x){ return x.id===S.hrPersonId; })[0];
    if(who) return hrPersonHtml_(who);
    S.hrSub='home';
  }
  if(S.hrTab==='cands') return candsHtml_();
  if(S.hrTab==='docs') return hrBackHtml_('week', t('My Home'))+'<h2>🗂️ '+esc(t('Human Resources'))+'</h2>'+hrTabsHtml_()+reqHrHtml_();
  var h=hrBackHtml_('week', t('My Home'));
  h+='<h2>🗂️ '+esc(t('Human Resources'))+'</h2>'+hrTabsHtml_();
  h+='<p class="sub">'+esc(t('Staff contracts — who signed when, for how long, and whose is coming up for renewal.'))+'</p>';
  if(S.hrError) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load the staff list.'))+'</p><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.hrError)+'</p><button class="btn ghost" id="hrRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  if(!S.hrStaff) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  var all=S.hrStaff;
  var active=all.filter(function(x){ return x.active && !x.archived; });
  var archived=all.filter(function(x){ return x.archived; });
  var withC=active.filter(function(x){ return (x.contracts||[]).length; });
  var due=active.filter(function(x){ var st=hrStatus_(x); return st.key==='due'||st.key==='expired'; })
    .sort(function(a,b){ return hrStatus_(a).days-hrStatus_(b).days; });
  S.hrDue=due.length;
  h+='<div class="mmGrid">'+[
      [t('Active staff'), active.length, false],
      [t('Contracts on file'), withC.length+' / '+active.length, false],
      [t('Renewals due'), due.length, due.length>0],
      [t('Archived'), archived.length, false]
    ].map(function(x){ return '<div class="mmTile'+(x[2]?' hot':'')+'"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  if(due.length){
    h+='<h3>⏰ '+esc(t('Renewals due'))+'</h3><p class="sub" style="margin:0 0 6px">'+esc(gpT('Contracts that have run out or run out within {n} days.',{n:HR_DUE_DAYS}))+'</p>';
    h+='<div class="accCard adminList" id="hrDueList">'+due.map(hrRowHtml_).join('')+'</div>';
  }
  h+='<h3>👥 '+esc(t('Everyone'))+'</h3>';
  var known_=CAMPUSES.map(function(c){ return c.id; });
  var pool = S.hrShowArchived ? all : all.filter(function(x){ return !x.archived; });
  var tabs=CAMPUSES.map(function(c){ return { id:c.id, label:c.short, n:pool.filter(function(x){ return x.campus===c.id; }).length }; });
  var other=pool.filter(function(x){ return known_.indexOf(x.campus)===-1; });
  if(other.length) tabs.push({ id:'__other', label:t('Other'), n:other.length });
  var activeTab = tabs.some(function(tb){ return tb.id===S.hrCampusTab; }) ? S.hrCampusTab
    : (tabs.some(function(tb){ return tb.id===S.me.campus; }) ? S.me.campus : tabs[0].id);
  S.hrCampusTab=activeTab;
  h+='<div class="deptChips">'+tabs.map(function(tb){
    return '<button class="deptChip'+(activeTab===tb.id?' on':'')+'" data-hrcampustab="'+esc(tb.id)+'">'+esc(tb.label)+' · '+tb.n+'</button>'; }).join('')+'</div>';
  h+='<div class="field" style="margin:10px 0 6px"><input type="text" id="hrSearch" value="'+esc(S.hrSearch||'')+'" placeholder="'+esc(t('Search by name or username…'))+'"></div>';
  h+='<label class="hrToggle"><input type="checkbox" id="hrShowArchived"'+(S.hrShowArchived?' checked':'')+'> '+esc(gpT('Show archived ({n})',{n:archived.length}))+'</label>';
  h+='<p class="emptyLine" id="hrSearchEmpty" style="display:none">'+esc(t('No one matches that search.'))+'</p>';
  var shown = activeTab==='__other' ? other : pool.filter(function(x){ return x.campus===activeTab; });
  shown.sort(function(a,b){ return a.name<b.name?-1:1; });
  if(!shown.length) return h+'<p class="sub">'+esc(t('No accounts yet.'))+'</p>';
  /* by contract: who has run out, who renews soon, then everyone else by when
     theirs ends, no contract at the bottom — and who is still on paper */
  var fs_=HR_FILTERS_.map(function(f){ return { id:f[0], label:t(f[1]), n:shown.filter(function(x){ return hrFilterHas_(x, f[0]); }).length }; });
  var fon=fs_.some(function(f){ return f.id===S.hrStatusF; }) ? S.hrStatusF : 'all';
  h+='<div class="deptChips hrStatusChips">'+fs_.map(function(f){ return '<button class="deptChip'+(fon===f.id?' on':'')+'" data-hrstatusf="'+f.id+'">'+esc(f.label)+' · '+f.n+'</button>'; }).join('')+'</div>';
  var byMin = S.hrGroupBy==='ministry';
  h+='<div class="leadFilters hrGroupBy"><button class="leadSeg'+(byMin?'':' on')+'" data-hrgroupby="end">'+esc(t('By contract end'))+'</button><button class="leadSeg'+(byMin?' on':'')+'" data-hrgroupby="ministry">'+esc(t('By ministry'))+'</button></div>';
  var rows=shown.filter(function(x){ return hrFilterHas_(x, fon); });
  h+='<div id="hrList">';
  if(!rows.length) h+='<p class="sub">'+esc(t('No one here.'))+'</p>';
  else if(byMin) staffGroups_(rows, activeTab==='__other' ? t('Other') : campusShort(activeTab)).forEach(function(g){
    if(!g.rows.length) return;
    h+='<div data-hrgroup="'+g.id+'"><div class="mentorLabel" style="margin:12px 0 6px">'+esc(g.label)+' · '+g.rows.length+'</div>'+
      '<div class="accCard adminList">'+g.rows.map(hrRowHtml_).join('')+'</div></div>';
  });
  else h+='<div data-hrgroup="byend"><div class="accCard adminList" style="margin-top:10px">'+rows.slice().sort(hrByEnd_).map(hrRowHtml_).join('')+'</div></div>';
  h+='</div>';
  return h;
}
function hrTabsHtml_(){
  var tab=S.hrTab==='cands'||S.hrTab==='docs' ? S.hrTab : 'staff';
  return '<div class="campusSeg" style="max-width:none">'+
    '<button class="campusBtn'+(tab==='staff'?' on':'')+'" data-hrtab="staff">📄 '+esc(t('Staff contracts'))+'</button>'+
    '<button class="campusBtn'+(tab==='cands'?' on':'')+'" data-hrtab="cands">🌱 '+esc(t('Candidates'))+((S.hrFollowUps)?' · '+S.hrFollowUps:'')+'</button>'+
    '<button class="campusBtn'+(tab==='docs'?' on':'')+'" data-hrtab="docs">✍️ '+esc(t('Required'))+'</button></div>';
}

/* ---------- Candidates — potential staff, volunteers, students ----------
   The CRM side of HR: a pipeline from first contact to arrival. One row per
   person with a stage, a next step and its date (the follow-up reminders
   hang on that), a running log of notes and stage moves, and an archive box
   for a no. Kept deliberately plain — a list you can search and filter,
   one page per person — rather than columns to drag between. */
var CAND_STAGES=[['new','New inquiry'],['contacted','Contacted'],['applied','Applied'],['interview','Interview'],['accepted','Accepted'],['practical','Getting ready'],['arrived','Arrived']];
/* A short-term team has its own stages — two calls instead of an interview,
   and the documents and visa between them (TEAM_STAGES in api.js). */
var TEAM_CAND_STAGES=[['new','New inquiry'],['applied','Applied'],['call1','1st call'],['docs','Awaiting documents'],['call2','2nd call — orientation'],['practical','Getting ready'],['arrived','Arrived']];
function candStagesFor_(type){ return type==='team' ? TEAM_CAND_STAGES : CAND_STAGES; }
var CAND_TYPES=[['staff','Staff'],['volunteer','Volunteer'],['student','Student'],['team','Team']];
var CAND_FOLLOWUP_DAYS=7;
function candStageLabel_(k){ var all=CAND_STAGES.concat(TEAM_CAND_STAGES); for(var i=0;i<all.length;i++) if(all[i][0]===k) return t(all[i][1]); return k; }
function candTypeLabel_(k){ for(var i=0;i<CAND_TYPES.length;i++) if(CAND_TYPES[i][0]===k) return t(CAND_TYPES[i][1]); return k; }
function candDaysUntil_(iso){ if(!iso) return null; var a=new Date(iso+'T00:00:00'), b=new Date(); b.setHours(0,0,0,0); return Math.round((a-b)/86400000); }
function candDue_(c){ if(c.archived || !c.nextDate) return ''; var d=candDaysUntil_(c.nextDate); return d<0 ? 'overdue' : d<=CAND_FOLLOWUP_DAYS ? 'soon' : ''; }
function candDueLabel_(c){ var d=candDaysUntil_(c.nextDate); if(d===null) return ''; return d<0 ? gpT('{n} days overdue',{n:-d}) : d===0 ? t('today') : d===1 ? t('tomorrow') : gpT('in {n} days',{n:d}); }
function candWhen_(iso){ return iso ? teamDate_(iso.slice(0,10)) : ''; }
function candRowHtml_(c){
  var due=candDue_(c);
  var sub=candTypeLabel_(c.type)+(c.subtype?' · '+c.subtype:'')+(c.school?' · '+c.school:'')+
    (c.nextStep ? ' · '+c.nextStep+(c.nextDate?' ('+candDueLabel_(c)+')':'') : '');
  return '<div data-candrow="'+esc((c.name+' '+(c.email||'')+' '+(c.country||'')).toLowerCase())+'"><button class="adminRow" data-candperson="'+esc(c.id)+'">'+avatarHtml({name:c.name,photo:''},'sm')+
    '<span class="adminRowText"><span class="rowName">'+esc(c.name)+'</span><span class="rowSub">'+esc(sub)+'</span></span>'+
    '<span class="hrChip '+(c.archived?'archived':due==='overdue'?'expired':due==='soon'?'due':c.stage==='arrived'||c.stage==='accepted'?'active':'')+'">'+esc(c.archived?t('Archived'):candStageLabel_(c.stage))+'</span></button></div>';
}
function candsHtml_(){
  var h='';
  if(S.hrSub==='cand' && S.cands){
    var who=S.cands.filter(function(x){ return x.id===S.candPersonId; })[0];
    if(who) return candPersonHtml_(who);
    S.hrSub='home';
  }
  if(S.hrSub==='candform') return candFormHtml_();
  h+=hrBackHtml_('week', t('My Home'));
  h+='<h2>🗂️ '+esc(t('Human Resources'))+'</h2>'+hrTabsHtml_();
  h+='<p class="sub">'+esc(t('Potential staff, volunteers and students — from first contact to arrival.'))+'</p>';
  if(S.candsError) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load the candidates.'))+'</p><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.candsError)+'</p><button class="btn ghost" id="candsRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  if(!S.cands) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  var all=S.cands, live=all.filter(function(c){ return !c.archived; }), archived=all.filter(function(c){ return c.archived; });
  var due=live.filter(function(c){ return candDue_(c); }).sort(function(a,b){ return a.nextDate<b.nextDate?-1:1; });
  var won=live.filter(function(c){ return c.stage==='accepted'||c.stage==='arrived'; });
  S.hrFollowUps=due.length;
  h+='<div class="mmGrid">'+[
      [t('In the pipeline'), live.length, false], [t('Follow-ups due'), due.length, due.length>0],
      [t('Accepted or arrived'), won.length, false], [t('Archived'), archived.length, false]
    ].map(function(x){ return '<div class="mmTile'+(x[2]?' hot':'')+'"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  h+='<button class="btn" id="candAdd" style="margin-top:0">＋ '+esc(t('Add a candidate'))+'</button>';
  if(due.length){
    h+='<h3>⏰ '+esc(t('Follow-ups due'))+'</h3><p class="sub" style="margin:0 0 6px">'+esc(gpT('Next steps that are overdue or due within {n} days.',{n:CAND_FOLLOWUP_DAYS}))+'</p>';
    h+='<div class="accCard adminList" id="candDueList">'+due.map(candRowHtml_).join('')+'</div>';
  }
  h+='<h3>🌱 '+esc(t('Pipeline'))+'</h3>';
  var pool = S.candShowArchived ? all : live;
  h+='<div class="deptChips">'+[['',t('All types')]].concat(CAND_TYPES.map(function(x){ return [x[0], t(x[1])]; })).map(function(x){
    var n = x[0] ? pool.filter(function(c){ return c.type===x[0]; }).length : pool.length;
    return '<button class="deptChip'+((S.candType||'')===x[0]?' on':'')+'" data-candtype="'+esc(x[0])+'">'+esc(x[1])+' · '+n+'</button>'; }).join('')+'</div>';
  var typed = S.candType ? pool.filter(function(c){ return c.type===S.candType; }) : pool;
  h+='<div class="deptChips">'+[['',t('All stages')]].concat(CAND_STAGES.map(function(x){ return [x[0], t(x[1])]; })).map(function(x){
    var n = x[0] ? typed.filter(function(c){ return c.stage===x[0]; }).length : typed.length;
    return '<button class="deptChip'+((S.candStage||'')===x[0]?' on':'')+'" data-candstage="'+esc(x[0])+'">'+esc(x[1])+' · '+n+'</button>'; }).join('')+'</div>';
  h+='<div class="field" style="margin:10px 0 6px"><input type="text" id="candSearch" value="'+esc(S.candSearch||'')+'" placeholder="'+esc(t('Search by name, email or country…'))+'"></div>';
  h+='<label class="hrToggle"><input type="checkbox" id="candShowArchived"'+(S.candShowArchived?' checked':'')+'> '+esc(gpT('Show archived ({n})',{n:archived.length}))+'</label>';
  h+='<p class="emptyLine" id="candSearchEmpty" style="display:none">'+esc(t('No one matches that search.'))+'</p>';
  var shown = (S.candStage ? typed.filter(function(c){ return c.stage===S.candStage; }) : typed).slice()
    .sort(function(a,b){ return (a.nextDate||'9999')<(b.nextDate||'9999') ? -1 : (a.nextDate||'9999')>(b.nextDate||'9999') ? 1 : (a.name<b.name?-1:1); });
  if(!shown.length) return h+'<div class="card slim"><p class="sub" style="margin:0">'+esc(all.length ? t('Nobody at this stage.') : t('Nobody in the pipeline yet — add the first candidate.'))+'</p></div>';
  h+='<div class="accCard adminList" id="candList">'+shown.map(candRowHtml_).join('')+'</div>';
  return h;
}
function candBlank_(){ return { id:'', name:'', type:'staff', stage:'new', subtype:'', school:'', email:'', phone:'', country:'', source:'', assignedTo:'', expected:'', nextStep:'', nextDate:'', notes:'' }; }
function candFormHtml_(){
  var f=S.candForm||candBlank_(), isNew=!f.id;
  var h=hrBackHtml_(isNew?'cands':'cand', isNew?t('Candidates'):f.name);
  h+='<h2>'+esc(isNew?t('Add a candidate'):t('Edit details'))+'</h2><div class="card">';
  var inp=function(key,label,type,extra){ var v=f[key]; if(v==null) v=''; return '<div><label class="f">'+esc(label)+'</label><input type="'+type+'" data-cf="'+key+'" value="'+esc(String(v))+'"'+(extra||'')+'></div>'; };
  h+=inp('name', t('Name'), 'text', ' maxlength="120"');
  h+='<label class="f">'+esc(t('Type'))+'</label><select data-cf="type">'+CAND_TYPES.map(function(x){ return '<option value="'+x[0]+'"'+(f.type===x[0]?' selected':'')+'>'+esc(t(x[1]))+'</option>'; }).join('')+'</select>';
  h+='<div class="teamGrid2">'+inp('subtype', t('Khmer / International'), 'text', ' maxlength="60" placeholder="'+esc(t('e.g. International'))+'"')+inp('school', t('School (students)'), 'text', ' maxlength="80" placeholder="DTS, DBS…"')+'</div>';
  h+='<div class="teamGrid2">'+inp('email', t('Email'), 'email', ' maxlength="120"')+inp('phone', t('Phone / WhatsApp'), 'tel', ' maxlength="60"')+'</div>';
  h+='<div class="teamGrid2">'+inp('country', t('Country'), 'text', ' maxlength="60"')+inp('source', t('How they found us'), 'text', ' maxlength="120" placeholder="'+esc(t('e.g. DTS outreach, website, a friend'))+'"')+'</div>';
  h+='<label class="f">'+esc(t('Who is walking with them'))+'</label><select data-cf="assignedTo"><option value="">'+esc(t('— nobody yet —'))+'</option>'+
    S.roster.slice().sort(function(a,b){ return a.name<b.name?-1:1; }).map(function(p){ return '<option value="'+esc(p.id)+'"'+(f.assignedTo===p.id?' selected':'')+'>'+esc(p.name)+'</option>'; }).join('')+'</select>';
  h+='<div class="teamGrid2">'+inp('expected', t('Expected arrival'), 'month')+'<div></div></div>';
  h+='<h4 style="margin:14px 0 4px">'+esc(t('Next step'))+'</h4>';
  h+='<div class="teamGrid2">'+inp('nextStep', t('What'), 'text', ' maxlength="200" placeholder="'+esc(t('e.g. video call, send the application'))+'"')+inp('nextDate', t('By when'), 'date')+'</div>';
  h+='<label class="f">'+esc(t('Notes'))+'</label><textarea data-cf="notes" rows="3" maxlength="1000">'+esc(f.notes||'')+'</textarea>';
  h+='<button class="btn" id="candSave">'+esc(isNew?t('Add this candidate'):t('Save changes'))+'</button>';
  h+='<button class="btn ghost" id="candCancel">'+esc(t('Cancel'))+'</button></div>';
  return h;
}
function candPersonHtml_(c){
  var h=hrBackHtml_('cands', t('Candidates'));
  var who=c.assignedTo ? personOf(c.assignedTo) : null, due=candDue_(c);
  h+='<div class="card"><div class="adminPersonHead">'+avatarHtml({name:c.name,photo:''},'lg')+'<div style="min-width:0">'+
    '<div class="pname">'+esc(c.name)+'</div>'+
    '<div class="pmeta">'+esc(candTypeLabel_(c.type))+(c.subtype?' · '+esc(c.subtype):'')+(c.school?' · '+esc(c.school):'')+(c.country?' · '+esc(c.country):'')+'</div>'+
    (c.email?'<div class="pmeta"><a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a></div>':'')+
    (c.phone?'<div class="pmeta"><a href="tel:'+esc(c.phone.replace(/\s+/g,''))+'">'+esc(c.phone)+'</a></div>':'')+
    (c.source?'<div class="pmeta">🔎 '+esc(c.source)+'</div>':'')+
    (who?'<div class="pmeta">🤝 '+esc(gpT('Walking with {name}',{name:who.name}))+'</div>':'')+
    (c.expected?'<div class="pmeta">📅 '+esc(gpT('Expected {month}',{month:hrMonthLabel_(c.expected)}))+'</div>':'')+
    '</div></div>';
  if(c.archived){
    h+='<div class="hrBanner archived">📦 <b>'+esc(t('Archived'))+'</b> · '+esc(candWhen_(c.archived.at))+(c.archived.reason?' — '+esc(c.archived.reason):'')+'</div>'+
      '<button class="btn ghost" id="candUnarchive">'+esc(t('Bring back (unarchive)'))+'</button>';
  }
  h+='<button class="linkbtn" id="candEdit" style="margin-top:6px">✏️ '+esc(t('Edit details'))+'</button></div>';

  // the stage, as a row of steps — tap one to move them
  var stagesHere=candStagesFor_(c.type);
  h+='<h3>🪜 '+esc(t('Stage'))+'</h3><div class="card slim"><div class="candSteps">'+stagesHere.map(function(x,i){
    var cur=stagesHere.map(function(y){ return y[0]; }).indexOf(c.stage);
    return '<button class="candStep'+(x[0]===c.stage?' on':i<cur?' done':'')+'" data-candmove="'+x[0]+'"'+(c.archived?' disabled':'')+'>'+(i<cur?'✓ ':'')+esc(t(x[1]))+'</button>'; }).join('')+'</div>';
  if(c.stage==='arrived'){
    var linked=c.staffId ? personOf(c.staffId) : null;
    h+='<div class="rowSub" style="margin-top:8px">'+esc(t('Arrived — link them to their staff account so HR can carry on with their contract there.'))+'</div>'+
      '<select id="candLink" style="margin-top:6px"><option value="">'+esc(t('— no account linked —'))+'</option>'+
      S.roster.slice().sort(function(a,b){ return a.name<b.name?-1:1; }).map(function(p){ return '<option value="'+esc(p.id)+'"'+(c.staffId===p.id?' selected':'')+'>'+esc(p.name)+' · @'+esc(p.username)+'</option>'; }).join('')+'</select>'+
      (linked?'<button class="linkbtn" id="candOpenStaff" data-staff="'+esc(linked.id)+'">'+esc(gpT('Open {name}’s HR page',{name:linked.name}))+'</button>':'');
  }
  h+='</div>';

  // next step
  h+='<h3>⏰ '+esc(t('Next step'))+'</h3><div class="card'+(due?' hrBanner '+(due==='overdue'?'expired':'due'):'')+'" style="margin-top:0">';
  h+='<div class="teamGrid2"><div><label class="f">'+esc(t('What'))+'</label><input type="text" id="cand_next" maxlength="200" value="'+esc(c.nextStep||'')+'" placeholder="'+esc(t('e.g. video call, send the application'))+'"></div>'+
    '<div><label class="f">'+esc(t('By when'))+'</label><input type="date" id="cand_nextdate" value="'+esc(c.nextDate||'')+'"></div></div>'+
    (c.nextDate?'<p class="hint" style="margin:0 0 6px">'+esc(candDueLabel_(c))+'</p>':'')+
    '<button class="btn ghost" id="candNextSave" style="margin-top:4px">'+esc(t('Save next step'))+'</button></div>';

  // notes & activity
  h+='<h3>📝 '+esc(t('Notes & activity'))+'</h3><div class="card">';
  h+='<div class="pickerRow" style="display:flex;gap:8px;margin:0 0 8px"><input type="text" id="candNote" maxlength="1000" value="'+esc(S.candNoteDraft||'')+'" placeholder="'+esc(t('Called, emailed, met… what happened?'))+'" style="flex:1">'+
    '<button class="btn ghost" id="candNoteAdd" style="margin:0;width:auto;padding:9px 14px">'+esc(t('Add'))+'</button></div>';
  if(c.notes) h+='<p class="sub" style="margin:0 0 8px">'+esc(c.notes)+'</p>';
  var log=(c.log||[]).slice().reverse();
  if(!log.length) h+='<p class="hint" style="margin:0">'+esc(t('Nothing logged yet.'))+'</p>';
  log.forEach(function(e){
    var by=personOf(e.by); var when=candWhen_(e.at);
    h+='<div class="candLog">'+(e.kind==='stage' ? '🪜 '+esc(gpT('Moved to {stage}',{stage:candStageLabel_(e.text)})) : esc(e.text))+
      '<div class="hint" style="margin-top:2px">'+esc(when)+(by?' · '+esc(by.name):'')+'</div></div>';
  });
  h+='</div>';

  if(!c.archived){
    h+='<h3>📦 '+esc(t('Not going ahead?'))+'</h3><div class="card">'+
      '<label class="f">'+esc(t('Why'))+'</label><select id="cand_why"><option>'+esc(t('Declined'))+'</option><option>'+esc(t('Withdrew'))+'</option><option>'+esc(t('No response'))+'</option><option>'+esc(t('Not a fit'))+'</option><option>'+esc(t('Other'))+'</option></select>'+
      '<label class="f">'+esc(t('Notes'))+'</label><input type="text" id="cand_whynote" maxlength="200">'+
      '<button class="danger" id="candArchive">'+esc(gpT('Archive {name}',{name:c.name}))+'</button></div>';
  }
  return h;
}

function hrFileSize_(n){ n=Number(n)||0; return n>1048576 ? (n/1048576).toFixed(1)+' MB' : Math.max(1,Math.round(n/1024))+' KB'; }
function hrContractCardHtml_(p, c, isCurrent){
  var h='<div class="card slim hrContract" data-hrcontract="'+esc(c.id)+'">';
  h+='<div class="teamHead"><div style="min-width:0"><div class="rowName"><b>'+esc(c.digital && c.digital.status!=='signed' ? gpT('From {month}',{month:hrMonthLabel_(c.signed)}) : gpT('Signed {month}',{month:hrMonthLabel_(c.signed)}))+'</b> · '+esc(hrYearsLabel_(c.years))+' <span class="hrCampusTag">'+esc(campusName(hrContractCampus_(p, c)))+'</span></div>'+
    '<div class="rowSub">'+esc(gpT('Ends {month}',{month:hrMonthLabel_(hrEndYm_(c))}))+(isCurrent && !p.archived ? ' · '+esc(hrStatus_(p).label) : '')+'</div>'+
    (c.notes?'<div class="rowSub" style="margin-top:2px">'+esc(c.notes)+'</div>':'')+'</div>'+
    '<button class="linkbtn inline" data-hredit="'+esc(c.id)+'">'+esc(t('Edit'))+'</button></div>';
  if(c.digital){
    var dg=c.digital;
    if(dg.status!=='signed') h+='<div class="hrDigital waiting">✍️ '+esc(gpT('Not signed yet — fill it out with {name}: they sign, then you sign to approve',{name:p.name}))+'</div>'+
      '<a class="btn small" href="portal.html?staff=1&hr='+encodeURIComponent(p.id)+'&doc='+encodeURIComponent('contract:'+c.id)+'" data-hrfillout="'+esc(c.id)+'">✍️ '+esc(t('Fill out and sign now'))+'</a>';
    else h+='<div class="hrDigital done">✅ '+esc(gpT('Signed by {name} · approved by {leader}',{name:dg.staffName||p.name, leader:dg.leaderName||''}))+'</div>'+
      '<button class="btn ghost small" data-hrcontractpdf="'+esc(c.id)+'">📄 '+esc(t('Signed contract (PDF)'))+'</button>';
    return h+'</div>';
  }
  var files=c.files||[];
  if(files.length){
    h+='<div class="hrFiles">'+files.map(function(f){
      return '<div class="hrFile"><span class="hrFileName">📄 '+esc(f.name)+' <span class="hint" style="display:inline">'+esc(hrFileSize_(f.size))+'</span></span>'+
        '<button class="linkbtn inline" data-hrfileopen="'+esc(f.id)+'">'+esc(t('Open'))+'</button>'+
        '<button class="linkbtn inline" data-hrfiledel="'+esc(c.id)+'|'+esc(f.id)+'">'+esc(t('Remove'))+'</button></div>'; }).join('')+'</div>';
  } else {
    h+='<div class="rowSub" style="margin-top:6px">⚠️ '+esc(t('No paper attached yet'))+'</div>';
  }
  h+='<label class="btn ghost hrAttach">'+esc(t('Attach the signed contract'))+' (PDF / photo)'+
    '<input type="file" accept="application/pdf,image/*" data-hrattach="'+esc(c.id)+'" style="display:none"></label>';
  return h+'</div>';
}
/* Fill out the Volunteer Staff Contract with them, in person, on this phone:
   its first month and length (a paper one being redone keeps its own), then
   the signing page — they sign, HR signs to approve. */
function hrSendFormHtml_(p){
  var f=S.hrSendForm;
  return '<div class="card" id="hrSendForm"><h3 style="margin-top:0">✍️ '+esc(t('Fill out staff contract'))+'</h3><p class="sub" style="margin:0 0 8px">'+
    esc(gpT('Do it together on this phone: {name} reads the Volunteer Staff Contract, fills in their commitment and signs. Then you sign to approve it, and it becomes their contract.',{name:p.name}))+'</p>'+
    (f.redo ? '<p class="hint" style="margin:0 0 8px">'+esc(t('Redoing their paper contract? The month and years below are from it.'))+'</p>' : '')+
    '<div class="teamGrid2"><div><label class="f">'+esc(t('From (month)'))+'</label><input type="month" id="hr_send_from" value="'+esc(f.from||'')+'"></div>'+
    '<div><label class="f" for="hr_send_years">'+esc(t('Years'))+'</label><input type="number" id="hr_send_years" inputmode="decimal" min="0.25" max="30" step="0.25" value="'+esc(f.years==null?'':String(f.years))+'" placeholder="2"></div></div>'+
    '<button class="btn" id="hrSendSave"'+(S.busy?' disabled':'')+'>'+esc(gpT('Start — hand the phone to {name}',{name:(p.name||'').split(' ')[0]}))+'</button><button class="btn ghost" id="hrSendCancel">'+esc(t('Cancel'))+'</button></div>';
}
/* ==================== My contract (☰ menu, every staff member) ====================
   Their own HR profile, read-only apart from their start dates: time in YWAM
   and on each campus, their contracts and when the current one ends (HR
   fills a new one out with them, in HR), and the legal documents —
   the Child Protection Agreement and the forms applicants sign in the portal
   — each signed here (or already in the portal) with its PDF. */
function openMyContract_(){ S.view='mycontract'; S.myc=null; S.hrStartEdit=null; render(); window.scrollTo(0,0); }
function myContractHtml(){
  var back='<button class="linkbtn" id="mycBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>';
  var d=S.myc;
  if(!d) return back+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  if(!d.ok) return back+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Could not load — try again.'))+'</p></div>';
  var p=d.me, st=hrStatus_(p), cur=hrCurrent_(p);
  var h=back+'<h2 style="margin:4px 0 10px">📄 '+esc(t('My contract'))+'</h2>';
  h+=reqMyContractCardHtml_();
  h+='<div class="card"><div class="adminPersonHead">'+avatarHtml(p,'lg')+'<div style="min-width:0"><div class="pname">'+esc(p.name)+'</div>'+
    '<div class="pmeta">'+esc(campusName(p.campus))+' · '+esc(t(p.dept))+(p.ministry?' · '+esc(t(p.ministry)):'')+(p.role?' · '+esc(p.role):'')+'</div>'+
    hrStartsHtml_(p, true)+'</div></div>';
  h+='<div class="hrBanner '+st.key+'">'+(st.key==='none'?'📝':st.key==='expired'?'🔴':st.key==='due'?'🟠':'🟢')+' <b>'+esc(st.key==='none' ? t('No contract on file yet — HR adds it') : st.key==='due' ? gpT('Ends in {n} days — talk to HR about renewing',{n:st.days}) : st.label)+'</b>'+
    (cur ? '<span class="rowSub"> · '+esc(gpT('Signed {month}',{month:hrMonthLabel_(cur.signed)}))+' · '+esc(hrYearsLabel_(cur.years))+'</span>' : '')+'</div></div>';
  var list=(p.contracts||[]).filter(function(c){ return !(c.digital && c.digital.status!=='signed'); }).slice().reverse();
  h+='<h3>📄 '+esc(t('Contracts'))+'</h3>';
  if(!list.length) h+='<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No contract on file yet. HR fills it out with you.'))+'</p></div>';
  list.forEach(function(c){
    var dg=c.digital;
    h+='<div class="card slim hrContract" data-myc="'+esc(c.id)+'"><div class="rowName"><b>'+esc(gpT('Signed {month}',{month:hrMonthLabel_(c.signed)}))+'</b> · '+esc(hrYearsLabel_(c.years))+' <span class="hrCampusTag">'+esc(campusName(hrContractCampus_(p, c)))+'</span></div>'+
      '<div class="rowSub">'+esc(gpT('Ends {month}',{month:hrMonthLabel_(hrEndYm_(c))}))+(cur && c.id===cur.id ? ' · '+esc(st.label) : '')+'</div>'+
      (dg ? '<button class="btn ghost small" data-myccontractpdf="'+esc(c.id)+'">📄 '+esc(t('Signed contract (PDF)'))+'</button>'
        : '<div class="rowSub" style="margin-top:4px">'+esc(t('On file with HR'))+'</div>')+'</div>';
  });
  var docs=d.legalDocs||[], l=p.legal||{}, n=docs.filter(function(x){ return l[x.id]; }).length;
  h+='<h3>✍️ '+esc(t('Legal documents'))+' <small>· '+n+'/'+docs.length+'</small></h3><div class="card slim" id="mycLegal">';
  if(!l.child) h+='<p class="sub" style="margin:0 0 6px">'+esc(t('Everyone reads and signs the revised Child Protection Agreement.'))+'</p>';
  h+=docs.map(function(x){ var g=l[x.id];
    return '<div class="hrLegalRow" data-myclegal="'+esc(x.id)+'"><span class="hrLegalName">'+(g?'✅':'⬜')+' '+esc(x.title)+'</span>'+
      (g ? '<span class="rowSub">'+esc(fmtDateShort_(g.at))+(g.from==='portal'?' · '+esc(t('in the portal')):'')+'</span><button class="linkbtn inline" data-myclegalpdf="'+esc(x.id)+'">📄 PDF</button>'
         : '<a class="btn small" href="portal.html?staff=1&doc='+encodeURIComponent(x.id)+'">'+esc(t('Read and sign'))+'</a>')+'</div>'; }).join('');
  return h+'</div>';
}
function bindMyContract_(){
  var bk=document.getElementById('mycBack'); if(bk) bk.onclick=function(){ gpTap(); S.view='week'; render(); window.scrollTo(0,0); };
  if(!S.myc){
    if(S.mycLoading) return; S.mycLoading=true;
    run('myContract',[S.auth.user,S.auth.pin],function(d){ S.mycLoading=false; S.myc=d||{ ok:false }; if(d && d.required) S.required=d.required; render(); }, function(){ S.mycLoading=false; S.myc={ ok:false }; render(); });
    return;
  }
  if(!S.myc.ok) return;
  var p=S.myc.me;
  var pdf=function(b, fn, args){ b.disabled=true; run(fn, [S.auth.user,S.auth.pin].concat(args), function(r){ b.disabled=false; if(r && r.ok) hrOpenDataUrl_(r.dataUrl, r.name); else showMsg(t('Could not open the file')); }, function(){ b.disabled=false; showMsg(t('Connection problem — try again.')); }); };
  document.querySelectorAll('[data-myclegalpdf]').forEach(function(b){ b.onclick=function(){ pdf(b, 'hrLegalPdf', ['', b.getAttribute('data-myclegalpdf')]); }; });
  document.querySelectorAll('[data-myccontractpdf]').forEach(function(b){ b.onclick=function(){ pdf(b, 'hrContractPdf', ['', b.getAttribute('data-myccontractpdf')]); }; });
  /* their own start dates — the same boxes HR has */
  document.querySelectorAll('[data-hrstartedit]').forEach(function(b){ b.onclick=function(){ gpTap(); var k=b.getAttribute('data-hrstartedit'), st=k==='ywam' ? null : hrStartOf_(p, k.slice(6));
    S.hrStartEdit={ staffId:p.id, key:k, value: k==='ywam' ? (p.ywamSince==null?'':String(p.ywamSince)) : (st ? st.month : '') }; render(); var el=document.getElementById('hr_start'); if(el) el.focus(); }; });
  var se=S.hrStartEdit && S.hrStartEdit.staffId===p.id ? S.hrStartEdit : null; if(!se) return;
  var sin=document.getElementById('hr_start'); if(sin) sin.oninput=sin.onchange=function(){ se.value=sin.value; };
  var scn=document.getElementById('hrStartCancel'); if(scn) scn.onclick=function(){ S.hrStartEdit=null; render(); };
  var ss=document.getElementById('hrStartSave');
  if(ss) ss.onclick=function(){
    if(S.busy) return;
    var v=String(se.value||'').trim(), body={};
    if(se.key==='ywam'){
      if(v && !(/^\d{4}$/.test(v) && Number(v)>=1960 && Number(v)<=new Date().getFullYear())){ showMsg(t('Started with YWAM: a year like 2003, or leave it empty.')); return; }
      body.ywamSince = v ? Number(v) : '';
    } else {
      if(v && (!/^\d{4}-\d{2}$/.test(v) || v>todayStr().slice(0,7))){ showMsg(t('Pick the month you started here, or leave it empty.')); return; }
      body.starts={}; body.starts[se.key.slice(6)]=v;
    }
    S.busy=true; ss.disabled=true;
    run('mySaveStart',[S.auth.user,S.auth.pin,body],function(r){
      S.busy=false;
      if(r && r.ok){ S.myc.me=Object.assign({}, S.myc.me, r.staff); S.hrStartEdit=null; showMsg(t('Start dates saved')); }
      else showMsg(r && r.err==='base_before_ywam' ? t('You can’t have started here before you joined YWAM.') : t('Could not save — try again.'));
      render();
    }, function(){ S.busy=false; showMsg(t('Connection problem — try again.')); render(); });
  };
}
/* the five legal documents each staff member signs once */
function hrLegalHtml_(p){
  var docs=S.hrLegalDocs||[]; if(!docs.length) return '';
  var l=p.legal||{}, n=docs.filter(function(d){ return l[d.id]; }).length;
  var h='<h3>✍️ '+esc(t('Legal documents'))+' <small>· '+n+'/'+docs.length+'</small></h3><div class="card slim" id="hrLegal">';
  if(n<docs.length) h+='<p class="sub" style="margin:0 0 6px">'+esc(t('They sign these in My contract (☰ menu). Ones signed in the portal as an applicant count too.'))+'</p>';
  h+=docs.map(function(d){ var s=l[d.id];
    return '<div class="hrLegalRow" data-hrlegal="'+esc(d.id)+'"><span class="hrLegalName">'+(s?'✅':'⬜')+' '+esc(d.title)+(s && s.disclose ? ' <span class="hrFlag">'+esc(t('has something to disclose privately'))+'</span>' : '')+'</span>'+
      (s ? '<span class="rowSub">'+esc(fmtDateShort_(s.at))+'</span><button class="linkbtn inline" data-hrlegalpdf="'+esc(d.id)+'">📄 PDF</button>' : '<span class="rowSub">'+esc(t('Not yet'))+'</span>')+'</div>'; }).join('');
  return h+'</div>';
}
function hrContractFormHtml_(p){
  var f=S.hrContractForm, isNew=!f.id;
  var h='<div class="card" id="hrContractForm"><h3 style="margin-top:0">'+esc(isNew ? ((p.contracts||[]).length ? t('Add a renewal') : t('Add a contract')) : t('Edit contract'))+'</h3>';
  var fc=f.campus || p.campus;
  h+='<label class="f">'+esc(t('Signed with'))+'</label><div class="chips hospChips">'+CAMPUSES.map(function(x){
    return '<button class="hospChip'+(fc===x.id?' on':'')+'" data-hrcampus="'+esc(x.id)+'">'+esc(x.name)+'</button>'; }).join('')+'</div>'+
    '<div class="hint" style="margin:-2px 0 8px">'+esc(t('The campus this contract is with. Someone who moved keeps their old contract as it was — set when they started here at the top of their page.'))+'</div>';
  h+='<div class="teamGrid2"><div><label class="f">'+esc(t('Month signed'))+'</label><input type="month" id="hr_signed" value="'+esc(f.signed||'')+'"></div>'+
    '<div><label class="f">'+esc(gpT('Years serving in {campus}',{campus:campusName(fc)}))+'</label><input type="number" id="hr_years" inputmode="decimal" min="0.25" max="30" step="0.25" value="'+esc(f.years==null?'':String(f.years))+'" placeholder="2"></div></div>';
  h+='<label class="f">'+esc(t('Notes'))+'</label><input type="text" id="hr_notes" maxlength="500" value="'+esc(f.notes||'')+'" placeholder="'+esc(t('e.g. second term, part-time'))+'">';
  h+='<button class="btn" id="hrContractSave">'+esc(isNew?t('Save contract'):t('Save changes'))+'</button>';
  h+='<button class="btn ghost" id="hrContractCancel">'+esc(t('Cancel'))+'</button>';
  if(!isNew) h+='<button class="linkbtn teamDelete" id="hrContractDelete">'+esc(t('Delete this contract'))+'</button>';
  return h+'</div>';
}
/* The starts in the profile at the top: In YWAM, then Serving YWAM GP (both
   campuses together) with each campus's time under it. Each has a small ✏️
   that opens right there; a campus they haven't served on can be added. */
function hrStartsHtml_(p, self){
  var e=S.hrStartEdit && S.hrStartEdit.staffId===p.id ? S.hrStartEdit : null;
  var edit=function(k, label){ return '<button class="linkbtn inline hrStartEdit" data-hrstartedit="'+esc(k)+'" aria-label="'+esc(label||t('Edit'))+'">✏️</button>'; };
  var box=function(input){ return '<div class="pmeta hrStartBox" id="hrStartBox">'+input+'<button class="btn small" id="hrStartSave">'+esc(t('Save'))+'</button><button class="linkbtn inline" id="hrStartCancel">'+esc(t('Cancel'))+'</button></div>'; };
  var monthBox=function(campus){ return box('📍 <label for="hr_start">'+esc(gpT('Started in {campus}',{campus:campusName(campus)}))+'</label> <input type="month" id="hr_start" value="'+esc(e.value)+'">'); };
  var h='';
  if(e && e.key==='ywam') h+=box('🌍 <label for="hr_start">'+esc(t('In YWAM since'))+'</label> <input type="number" id="hr_start" inputmode="numeric" min="1960" max="'+new Date().getFullYear()+'" step="1" value="'+esc(e.value)+'" placeholder="'+esc(String(new Date().getFullYear()-2))+'">');
  else h+='<div class="pmeta" id="hrYwamSince">🌍 '+(p.ywamSince ? esc(gpT('In YWAM since {year} — {n} years',{year:p.ywamSince, n:hrYwamYears_(p.ywamSince)})) : '<span class="hint" style="display:inline">'+esc(t('In YWAM since — add the year'))+'</span>')+' '+edit('ywam')+'</div>';
  var per=hrPeriods_(p), now=todayStr().slice(0,7);
  if(per.length) h+='<div class="pmeta" id="hrGpSince">🤝 <b>'+esc(gpT('Serving YWAM GP {time}',{time:hrMonthsLabel_(hrMonthsBetween_(per[0].from, now))}))+'</b> · '+esc(gpT('since {month}',{month:hrMonthLabel_(per[0].from)}))+'</div>';
  h+='<div class="hrPeriods">';
  per.forEach(function(x){
    if(e && e.key==='start:'+x.campus){ h+=monthBox(x.campus); return; }
    h+='<div class="pmeta hrPeriod" data-hrperiod="'+esc(x.campus)+'">📍 '+esc(campusName(x.campus))+': '+
      esc(x.to ? hrMonthLabel_(x.from)+' – '+hrMonthLabel_(x.to) : gpT('since {month}',{month:hrMonthLabel_(x.from)}))+' · '+
      esc(hrMonthsLabel_(hrMonthsBetween_(x.from, x.to || now)))+(x.set?'':' <span class="hint" style="display:inline">('+esc(t('from the first contract'))+')</span>')+' '+edit('start:'+x.campus)+'</div>';
  });
  CAMPUSES.forEach(function(x){
    if(per.some(function(y){ return y.campus===x.id; })) return;
    if(e && e.key==='start:'+x.id){ h+=monthBox(x.id); return; }
    h+='<button class="linkbtn inline hrAddCampus" data-hrstartedit="start:'+esc(x.id)+'">＋ '+esc(x.id===p.campus ? gpT(self ? 'Add when you started in {campus}' : 'Add when they started in {campus}',{campus:campusName(x.id)}) : gpT('Add time in {campus}',{campus:campusName(x.id)}))+'</button>';
  });
  return h+'</div>';
}
function hrPersonHtml_(p){
  var st=hrStatus_(p), cur=hrCurrent_(p), serving=hrServing_(p), since=hrSince_(p);
  var h=hrBackHtml_('home', t('Human Resources'));
  h+='<div class="card"><div class="adminPersonHead">'+avatarHtml(p,'lg')+'<div style="min-width:0">'+
    '<div class="pname">'+esc(p.name)+'</div>'+
    '<div class="pmeta">@'+esc(p.username)+(p.email?' · '+esc(p.email):'')+'</div>'+
    '<div class="pmeta">'+esc(campusName(p.campus))+' · '+esc(t(p.dept))+(p.ministry?' · '+esc(t(p.ministry)):'')+(p.role?' · '+esc(p.role):'')+'</div>'+
    hrStartsHtml_(p)+
    '</div></div>';
  h+='<div class="hrBanner '+st.key+'">'+(st.key==='archived'?'📦':st.key==='none'?'📝':st.key==='expired'?'🔴':st.key==='due'?'🟠':'🟢')+' <b>'+esc(st.label)+'</b>'+
    (cur && !p.archived ? '<span class="rowSub"> · '+esc(gpT('Signed {month}',{month:hrMonthLabel_(cur.signed)}))+' · '+esc(hrYearsLabel_(cur.years))+'</span>' : '')+'</div>';
  if(p.archived){
    h+='<p class="sub" style="margin:8px 0 0">'+esc(gpT('Left on {date}',{date:p.archived.at||'—'}))+(p.archived.reason?' — '+esc(p.archived.reason):'')+'</p>'+
      '<button class="btn ghost" id="hrUnarchive">'+esc(t('Bring back (unarchive)'))+'</button>';
  }
  h+='</div>';

  h+='<h3>📄 '+esc(t('Contracts'))+'</h3>';
  var list=(p.contracts||[]).slice().reverse();
  if(!list.length && !S.hrContractForm) h+='<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No contract on file yet. Add the one from the paper folder.'))+'</p></div>';
  list.forEach(function(c){ h+=hrContractCardHtml_(p, c, cur && c.id===cur.id); });
  if(S.hrContractForm && S.hrContractForm.staffId===p.id) h+=hrContractFormHtml_(p);
  else if(S.hrSendForm && S.hrSendForm.staffId===p.id) h+=hrSendFormHtml_(p);
  else if(!p.archived) h+='<div class="hrContractBtns"><button class="btn" id="hrSendContract" style="margin-top:0">✍️ '+esc(t('Fill out staff contract'))+'</button>'+
    '<button class="btn ghost" id="hrAddContract" style="margin-top:0">＋ '+esc(list.length ? t('Add a paper renewal') : t('Add a paper contract'))+'</button></div>';
  h+=hrLegalHtml_(p);

  if(!p.archived){
    var d=S.hrArchiveDraft && S.hrArchiveDraft.staffId===p.id ? S.hrArchiveDraft : { at:todayStr(), reason:'' };
    h+='<h3>📦 '+esc(t('Leaving?'))+'</h3><div class="card">'+
      '<p class="sub" style="margin:0 0 8px">'+esc(t('Archiving takes them off the roster and the staff count, and closes their sign-in. Their history stays. You can bring them back later.'))+'</p>'+
      '<div class="teamGrid2"><div><label class="f">'+esc(t('Date they left'))+'</label><input type="date" id="hr_left" value="'+esc(d.at)+'"></div>'+
      '<div><label class="f">'+esc(t('Reason'))+'</label><input type="text" id="hr_reason" maxlength="300" value="'+esc(d.reason)+'" placeholder="'+esc(t('e.g. moved home, finished term'))+'"></div></div>'+
      '<button class="danger" id="hrArchive">'+esc(gpT('Archive {name}',{name:p.name}))+'</button></div>';
  }
  return h;
}

/* ---------- Teams Database ----------
   Where Outreach Teams are entered, one record per team — its own page, off
   My Ministry, so the team list and its month / quarter / year dashboard
   have room and never sit among another ministry's weekly boxes. */
/* ---------- SR Hospitality ----------
   The hospitality team's booking book: who sleeps in which bed when. Four
   tabs, phone first — Dashboard (tonight, and how full each week / month /
   quarter is, so the busy and quiet seasons show), Requests (every upcoming
   team in the Teams Database, with whether it fits), Bookings (guests,
   speakers, teams, students, volunteers, staff — each with its beds) and
   Rooms (buildings, rooms, beds). For the Hospitality ministry (Skills
   Training) and admins; the server checks the same (canHosp_ in api.js).

   A booking holds `count` beds from `from` (the first night) to `to` (the
   morning they leave), or for good when it is a permanent staff bed. It can
   name its beds or just hold the number until they are picked — so "how
   full are we" counts people, and the bed picker only has to be right about
   the beds it names. */
var HOSP_CATS=[['guest','Guest','🧳'],['speaker','Speaker','🎤'],['team','Team','👥'],['student','Student','🎓'],['volunteer','Volunteer','🤝'],['staff','Staff','🏠']];
var HOSP_STYLES=[['mixed','Mixed / dorm'],['male','Men'],['female','Women'],['couple','Couple'],['family','Family'],['guest','Guest / speaker'],['staff','Staff']];
var HOSP_KEY='Skills Training|Hospitality';
function canHospClient_(){
  var m=S.me; if(!m) return false;
  if(m.isAdmin || m.hospitality) return true;
  return (m.dept==='Skills Training' && m.ministry==='Hospitality') || (m.ministries||[]).indexOf(HOSP_KEY)>-1 || (m.leads||[]).indexOf(HOSP_KEY)>-1;
}
function hospCat_(id){ return HOSP_CATS.filter(function(c){ return c[0]===id; })[0] || HOSP_CATS[0]; }
function hospStyle_(id){ var s=HOSP_STYLES.filter(function(c){ return c[0]===id; })[0]; return s ? t(s[1]) : ''; }
// dates as plain YYYY-MM-DD, stepped in UTC so a clock change never skips a night
function hospAdd_(iso, n){ var d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function hospNights_(from, to){ return Math.round((new Date(to+'T00:00:00Z')-new Date(from+'T00:00:00Z'))/86400000); }
function hospCap_(H){ var n=0; H.rooms.forEach(function(r){ r.beds.forEach(function(b){ if(!b.out) n++; }); }); return n; }
function hospBedIndex_(H){ var o={}; H.rooms.forEach(function(r){ r.beds.forEach(function(b){ o[b.id]={ bed:b, room:r }; }); }); return o; }
function hospEnd_(k){ return k.permanent ? '9999-12-31' : k.to; }
/* Beds held each night of [start, end): one number per night. `skip` leaves
   one booking out (the one being edited). */
function hospDaily_(list, start, end, skip){
  var n=hospNights_(start, end), out=[]; for(var i=0;i<n;i++) out.push(0);
  list.forEach(function(k){
    if(k.id && k.id===skip) return;
    var a=k.from>start?k.from:start, e=hospEnd_(k), b=e<end?e:end;
    if(a>=b) return;
    var i0=hospNights_(start, a), i1=hospNights_(start, b);
    for(var i=i0;i<i1;i++) out[i]+=Number(k.count)||0;
  });
  return out;
}
function hospReqNeed_(q){ var n=Number(q.size)||0; var mf=(Number(q.males)||0)+(Number(q.females)||0); return Math.max(n, mf); }
// the team requests nobody has booked yet, as bookings-to-be (for "if they all come")
/* teams cancelled or deleted with beds still booked for them */
function hospGoneReqs_(H){ return (H.requests||[]).filter(function(q){ return q.cancelled; }); }
/* a request's own key: a team's tripId, or 'sr:<id>' for a guest or speaker who asked from the link */
function hospReqKey_(q){ return q.stayId ? 'sr:'+q.stayId : q.tripId; }
function hospOpenReqs_(H){ return (H.requests||[]).filter(function(q){ return !q.bookingId && !q.cancelled; }).map(function(q){ return { id:'req_'+hospReqKey_(q), from:q.from, to:q.to, count:hospReqNeed_(q) }; }); }
/* Does a stay of `need` people over [from, to) fit? Against the tightest night. */
function hospFit_(H, from, to, need, skip){
  var cap=hospCap_(H), d=hospDaily_(H.bookings, from, to, skip), peak=0;
  d.forEach(function(v){ if(v>peak) peak=v; });
  var free=cap-peak;
  return { cap:cap, free:free, fits: need<=free, short: Math.max(0, need-free), spare: free-need };
}
function hospFitChip_(f, need){
  if(!f.cap) return '<span class="teamStat hospFit no" data-fit="none">🛏 '+esc(t('No rooms set up yet'))+'</span>';
  if(!need) return '<span class="teamStat hospFit" data-fit="unknown">❔ '+esc(gpT('{n} beds free',{n:Math.max(0,f.free)}))+'</span>';
  if(f.fits) return '<span class="teamStat hospFit ok" data-fit="yes">✅ '+esc(t('Fits'))+' · '+esc(gpT('{n} beds spare',{n:f.spare}))+'</span>';
  return '<span class="teamStat hospFit no" data-fit="no">⚠️ '+esc(gpT('Short by {n} beds',{n:f.short}))+'</span>';
}
function hospDate_(iso){ if(!iso) return ''; return t(MONTH_SHORT[Number(iso.slice(5,7))-1]||'')+' '+Number(iso.slice(8,10)); }
function hospRange_(k){
  if(k.permanent) return gpT('From {date}',{date:hospDate_(k.from)})+' · '+t('Permanent');
  var n=hospNights_(k.from, k.to);
  return hospDate_(k.from)+' → '+hospDate_(k.to)+' · '+gpT(n===1?'{n} night':'{n} nights',{n:n});
}
function hospPeople_(k){
  var bits=[gpT(Number(k.count)===1?'{n} person':'{n} people',{n:Number(k.count)||0})];
  if(Number(k.males)) bits.push(k.males+' '+t('men'));
  if(Number(k.females)) bits.push(k.females+' '+t('women'));
  if(k.family) bits.push(t('Family'));
  return bits.join(' · ');
}
function hospMonday_(iso){ var d=new Date(iso+'T00:00:00Z'); return hospAdd_(iso, -((d.getUTCDay()+6)%7)); }

/* The buckets the dashboard draws: 12 weeks from this week (paged), the 12
   months of a year, or its four quarters. */
function hospBuckets_(period){
  var today=todayStr(), out=[], y=S.hospYear || Number(today.slice(0,4));
  if(period==='week'){
    var w0=hospAdd_(hospMonday_(today), 7*12*(S.hospWeekOff||0));
    for(var i=0;i<12;i++){ var a=hospAdd_(w0, 7*i); out.push({ from:a, to:hospAdd_(a,7), label:hospDate_(a), now: today>=a && today<hospAdd_(a,7) }); }
  } else if(period==='quarter'){
    for(var q=0;q<4;q++){ var qa=y+'-'+('0'+(q*3+1)).slice(-2)+'-01', qb=q===3?(y+1)+'-01-01':y+'-'+('0'+(q*3+4)).slice(-2)+'-01';
      out.push({ from:qa, to:qb, label:'Q'+(q+1), now: today>=qa && today<qb }); }
  } else {
    for(var m=0;m<12;m++){ var ma=y+'-'+('0'+(m+1)).slice(-2)+'-01', mb=m===11?(y+1)+'-01-01':y+'-'+('0'+(m+2)).slice(-2)+'-01';
      out.push({ from:ma, to:mb, label:t(MONTH_SHORT[m]), now: today>=ma && today<mb }); }
  }
  return out;
}
function hospLevel_(pct){ return pct>=80 ? 'high' : pct>=50 ? 'mid' : 'low'; }
function hospDashHtml_(H){
  var cap=hospCap_(H), today=todayStr();
  var h='';
  if(!H.rooms.length){
    return h+'<div class="card"><p class="sub" style="margin:0 0 10px">🛏 '+esc(t('Start by adding your buildings, rooms and beds — then bookings and team requests can be checked against them.'))+'</p>'+
      '<button class="btn" data-hosptab="rooms" style="margin-top:0">'+esc(t('Set up rooms'))+'</button></div>';
  }
  var tonight=hospDaily_(H.bookings, today, hospAdd_(today,1))[0];
  var wkEnd=hospAdd_(today,7), arriving=0, leaving=0;
  H.bookings.forEach(function(k){
    if(k.from>=today && k.from<wkEnd) arriving+=Number(k.count)||0;
    if(!k.permanent && k.to>=today && k.to<wkEnd) leaving+=Number(k.count)||0;
  });
  var waiting=hospOpenReqs_(H).length, goneN=hospGoneReqs_(H).length;
  h+='<button class="btn" id="hospNewBtn" style="margin-top:0">＋ '+esc(t('New booking'))+'</button>';
  var tile=function(id, name, num, sub){ return '<div class="mmTile" data-hosptile="'+id+'"><div class="mmTileName">'+esc(name)+'</div><div class="mmTileNum">'+esc(String(num))+'</div>'+(sub?'<div class="mmTileSub">'+esc(sub)+'</div>':'')+'</div>'; };
  h+='<div class="mmGrid">'+
    tile('tonight', t('Here tonight'), tonight, cap ? gpT('{pct}% full',{pct:Math.round(tonight/cap*100)}) : '')+
    tile('free', t('Beds free tonight'), Math.max(0,cap-tonight), gpT('of {n} beds',{n:cap}))+
    tile('arriving', t('Arriving in 7 days'), arriving, gpT('{n} leaving',{n:leaving}))+
    tile('requests', t('Team requests'), waiting, goneN ? gpT('{n} cancelled — free the beds',{n:goneN}) : waiting ? t('waiting for beds') : t('all booked'))+'</div>';
  // who is here tonight, by kind of guest
  var by={};
  H.bookings.forEach(function(k){ if(k.from<=today && today<hospEnd_(k)) by[k.category]=(by[k.category]||0)+(Number(k.count)||0); });
  var cats=HOSP_CATS.filter(function(c){ return by[c[0]]; });
  if(cats.length) h+='<div class="teamStats" style="margin:-4px 0 12px">'+cats.map(function(c){ return '<span class="teamStat hospCat '+c[0]+'">'+c[2]+' '+esc(t(c[1]))+' <b>'+by[c[0]]+'</b></span>'; }).join('')+'</div>';

  var period=['week','month','quarter'].indexOf(S.hospPeriod)>-1 ? S.hospPeriod : 'month';
  h+='<h3>'+esc(t('How full we are'))+'</h3>';
  h+='<div class="campusSeg periodSeg">'+[['week','Weeks'],['month','Months'],['quarter','Quarters']].map(function(p){
    return '<button class="campusBtn'+(period===p[0]?' on':'')+'" data-hospperiod="'+p[0]+'">'+esc(t(p[1]))+'</button>'; }).join('')+'</div>';
  var y=S.hospYear || Number(today.slice(0,4));
  h+='<div class="calNav">'+
    '<button class="weekArrow" id="hospPrev" aria-label="'+esc(t('Earlier'))+'">‹</button>'+
    '<div class="calTitle">'+(period==='week' ? esc(t('12 weeks')) : String(y))+'</div>'+
    '<button class="weekArrow" id="hospNext" aria-label="'+esc(t('Later'))+'">›</button></div>';
  var bks=hospBuckets_(period), reqs=hospOpenReqs_(H);
  var start=bks[0].from, end=bks[bks.length-1].to;
  var held=hospDaily_(H.bookings, start, end), asked=hospDaily_(reqs, start, end);
  var best=null, worst=null;
  h+='<div class="card hospChart" id="hospChart">';
  bks.forEach(function(b){
    var i0=hospNights_(start, b.from), i1=hospNights_(start, b.to), used=0, req=0;
    for(var i=i0;i<i1;i++){ used+=held[i]; req+=asked[i]; }
    var room=cap*(i1-i0), pct=room ? Math.round(used/room*100) : 0, rpct=room ? Math.round(req/room*100) : 0;
    if(!best || pct>best.pct) best={ label:b.label, pct:pct };
    if(!worst || pct<worst.pct) worst={ label:b.label, pct:pct };
    var w=Math.min(100,pct), rw=Math.max(0, Math.min(100-w, rpct));
    h+='<div class="hospBarRow'+(b.now?' now':'')+'" data-hospbucket="'+b.from+'" data-pct="'+pct+'" data-req="'+rpct+'">'+
      '<span class="hospBarLabel">'+esc(b.label)+'</span>'+
      '<span class="hospBar"><span class="hospBarFill '+hospLevel_(pct)+'" style="width:'+w+'%"></span>'+
        (rw?'<span class="hospBarReq" style="width:'+rw+'%"></span>':'')+'</span>'+
      '<span class="hospBarPct">'+pct+'%'+(rpct?'<small> +'+rpct+'%</small>':'')+'</span></div>';
  });
  h+='<div class="calLegend"><span class="calDot hospLow"></span>'+esc(t('Quiet (under 50%)'))+'<span class="calDot hospMid"></span>'+esc(t('Busy'))+
    '<span class="calDot hospHigh"></span>'+esc(t('Full (80%+)'))+'<span class="calDot hospReqDot"></span>'+esc(t('Team requests not booked yet'))+'</div>';
  if(best && best.pct>0) h+='<p class="hint" id="hospSeason" style="margin:8px 0 0">📈 '+esc(gpT('Busiest: {a} ({p}%)',{a:best.label,p:best.pct}))+' · 📉 '+esc(gpT('Quietest: {a} ({p}%)',{a:worst.label,p:worst.pct}))+'</p>';
  h+='</div>';
  return h;
}
function hospReqCardHtml_(H, q){
  if(q.cancelled) return '<div class="card slim hospReq hospGone" data-hospreq="'+esc(q.tripId)+'"><div class="rowName"><b>'+esc(q.name)+'</b> <span class="teamStat hospFit no" data-cancelled>✕ '+esc(q.cancelled==='deleted' ? t('Deleted') : t('Cancelled'))+'</span></div>'+
    '<div class="rowSub">📅 '+esc(hospRange_(q))+(q.count?' · 🛏 '+esc(gpT('{n} beds still booked',{n:q.count})):'')+'</div>'+
    '<div class="rowSub">'+esc(q.cancelled==='deleted' ? t('This team was deleted. Their beds are still booked — free them if they are not coming.') : t('This team was cancelled. Their beds are still booked — free them if they are not coming.'))+'</div>'+
    '<div class="hospActions"><button class="btn small" data-hospfree="'+esc(q.bookingId)+'">'+esc(t('Free the beds'))+'</button><button class="btn ghost small" data-hospedit="'+esc(q.bookingId)+'">'+esc(t('Open booking'))+'</button></div></div>';
  var need=hospReqNeed_(q), f=hospFit_(H, q.from, q.to, need);
  var h='<div class="card slim hospReq'+(q.stayId?' hospStay':'')+'" data-hospreq="'+esc(hospReqKey_(q))+'">';
  h+='<div class="rowName"><b>'+esc(q.name)+'</b>'+(q.pending?' <span class="teamStat pending" data-pending>⏳ '+esc(t('Pending'))+'</span>':'')+
    (q.stayId ? ' <span class="teamStat" data-staycat>'+(q.category==='speaker' ? '🎤 '+esc(t('Speaker')) : '🧳 '+esc(t('Guest')))+'</span>' : '')+'</div>';
  if(q.org) h+='<div class="rowSub">⛪ '+esc(q.org)+'</div>';
  if(q.country) h+='<div class="rowSub">📍 '+esc(q.country)+'</div>';
  h+='<div class="rowSub">📅 '+esc(hospRange_(q))+'</div>';
  h+='<div class="rowSub">👥 '+esc(teamPeopleLine_(q))+'</div>';
  if(q.stayId && (q.phone || q.email)) h+='<div class="rowSub">'+(q.phone?'📞 <a href="tel:'+esc(q.phone.replace(/[^\d+]/g,''))+'">'+esc(q.phone)+'</a>':'')+(q.phone && q.email?' · ':'')+(q.email?'✉️ <a href="mailto:'+esc(q.email)+'">'+esc(q.email)+'</a>':'')+'</div>';
  if(q.stayId && q.notes) h+='<div class="rowSub" style="white-space:pre-line">📝 '+esc(q.notes)+'</div>';
  h+='<div class="teamStats">'+(q.bookingId ? '<span class="teamStat hospFit ok" data-booked>✓ '+esc(t('Booked'))+'</span>' : hospFitChip_(f, need))+'</div>';
  h+='<div class="hospActions">'+(q.bookingId
    ? '<button class="btn ghost small" data-hospedit="'+esc(q.bookingId)+'">'+esc(t('Open booking'))+'</button>'
    : '<button class="btn small" data-hospbookreq="'+esc(hospReqKey_(q))+'">🛏 '+esc(t('Book beds'))+'</button>')+
    (q.stayId && !q.bookingId ? '<button class="btn ghost small" data-hospstaydecline="'+esc(q.stayId)+'">'+esc(t('Decline'))+'</button>' : '')+
    (q.candidateId && canPortalClient_() ? '<a class="btn ghost small" href="portal.html?open='+encodeURIComponent(q.candidateId)+'" target="_blank" rel="noopener">🛂 '+esc(t('Open application'))+'</a>' : '')+'</div>';
  return h+'</div>';
}
/* the link a guest or speaker uses to ask for a room (portal.html?stay=<campus>) */
function hospStayLink_(H){ return location.origin+location.pathname.replace(/[^/]*$/,'')+'portal.html?stay='+encodeURIComponent(H.campus||S.me.campus||'siemreap'); }
function hospReqsHtml_(H){
  var reqs=H.requests||[];
  var h='<div class="card slim" id="hospStayLink"><b>🔗 '+esc(t('Link for guests and speakers'))+'</b><p class="sub" style="margin:4px 0 8px">'+esc(t('Send it to a guest or speaker coming for a short stay: they fill in their name, dates and how many are coming, and it shows here as a request.'))+'</p>'+
    '<input type="text" id="hospStayUrl" readonly value="'+esc(hospStayLink_(H))+'" onclick="this.select()"><div class="hospActions" style="margin-top:8px"><button class="btn small" id="hospStayCopy">'+esc(t('Copy link'))+'</button>'+
    (navigator.share ? '<button class="btn ghost small" id="hospStayShare">📤 '+esc(t('Share'))+'</button>' : '')+'</div></div>';
  h+='<p class="sub" style="margin:0 0 10px">'+esc(t('Every team in the Teams Database that hasn’t left yet, and guests and speakers who asked from the link. Pending teams applied on the portal and haven’t confirmed flights.'))+'</p>';
  if(!reqs.length) return h+'<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No upcoming requests.'))+'</p></div>';
  var gone=hospGoneReqs_(H), open=reqs.filter(function(q){ return !q.bookingId && !q.cancelled; }), done=reqs.filter(function(q){ return q.bookingId && !q.cancelled; });
  if(gone.length) h+='<h3>'+esc(t('Cancelled — beds still booked'))+' <small>· '+gone.length+'</small></h3><div class="hospGrid">'+gone.map(function(q){ return hospReqCardHtml_(H, q); }).join('')+'</div>'+(open.length?'<h3>'+esc(t('Waiting for beds'))+' <small>· '+open.length+'</small></h3>':'');
  h+='<div class="hospGrid">'+open.map(function(q){ return hospReqCardHtml_(H, q); }).join('')+'</div>';
  if(done.length) h+='<h3>'+esc(t('Booked'))+' <small>· '+done.length+'</small></h3><div class="hospGrid">'+done.map(function(q){ return hospReqCardHtml_(H, q); }).join('')+'</div>';
  return h;
}
function hospBookingCardHtml_(H, k, idx){
  var c=hospCat_(k.category);
  var names=k.bedIds.map(function(id){ var x=idx[id]; return x ? x.room.name+' '+x.bed.label+(k.bedNames && k.bedNames[id] ? ' · '+k.bedNames[id] : '') : ''; }).filter(Boolean);
  var h='<button class="card slim hospBooking hospCat '+c[0]+'" data-hospedit="'+esc(k.id)+'">';
  var gq=k.tripId && hospGoneReqs_(H).filter(function(q){ return q.bookingId===k.id; })[0];
  h+='<div class="rowName"><b>'+esc(k.name)+'</b> <span class="teamStat">'+c[2]+' '+esc(t(c[1]))+'</span>'+(gq?' <span class="teamStat hospFit no" data-cancelled>✕ '+esc(gq.cancelled==='deleted' ? t('Deleted') : t('Cancelled'))+'</span>':'')+'</div>';
  h+='<div class="rowSub">📅 '+esc(hospRange_(k))+'</div>';
  h+='<div class="rowSub">👥 '+esc(hospPeople_(k))+((k.people||[]).length ? ' · '+esc(gpT('{n} named',{n:k.people.length})) : '')+'</div>';
  h+='<div class="rowSub">🛏 '+(names.length ? esc(names.join(', ')) : '')+
    (names.length<k.count ? (names.length?' · ':'')+'<span class="hospToPick">'+esc(gpT('{n} beds to pick',{n:k.count-names.length}))+'</span>' : '')+'</div>';
  return h+'</button>';
}
function hospBookingsHtml_(H){
  var today=todayStr(), when=S.hospWhen==='past'?'past':'now', cat=S.hospCat||'all';
  var h='<button class="btn" id="hospNewBtn" style="margin-top:0">＋ '+esc(t('New booking'))+'</button>';
  h+='<div class="campusSeg periodSeg" style="margin-top:12px">'+
    '<button class="campusBtn'+(when==='now'?' on':'')+'" data-hospwhen="now">'+esc(t('Here & coming'))+'</button>'+
    '<button class="campusBtn'+(when==='past'?' on':'')+'" data-hospwhen="past">'+esc(t('Past'))+'</button></div>';
  h+='<div class="chips hospChips">'+[['all','All','']].concat(HOSP_CATS).map(function(c){
    return '<button class="hospChip'+(cat===c[0]?' on':'')+'" data-hospcat="'+c[0]+'">'+(c[2]?c[2]+' ':'')+esc(t(c[1]))+'</button>'; }).join('')+'</div>';
  var list=H.bookings.filter(function(k){
    var past=hospEnd_(k)<=today;
    return (when==='past'?past:!past) && (cat==='all' || k.category===cat);
  }).sort(function(a,b){ return when==='past' ? (a.from<b.from?1:-1) : (a.from<b.from?-1:a.from>b.from?1:0); });
  if(!list.length) return h+'<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No bookings here.'))+'</p></div>';
  var idx=hospBedIndex_(H);
  return h+'<div id="hospList" class="hospGrid">'+list.map(function(k){ return hospBookingCardHtml_(H, k, idx); }).join('')+'</div>';
}
/* Who has each bed on any night of [from, to), leaving out the booking being edited. */
function hospTaken_(H, f){
  var out={};
  if(!f.from || (!f.permanent && (!f.to || f.to<=f.from))) return out;
  var me={ from:f.from, to:f.to, permanent:f.permanent };
  H.bookings.forEach(function(k){
    if(k.id===f.id) return;
    if(!(k.from<hospEnd_(me) && me.from<hospEnd_(k))) return;
    (k.bedIds||[]).forEach(function(id){ out[id]=k.name; });
  });
  return out;
}
function hospFormHtml_(H){
  var f=S.hospForm, isNew=!f.id, taken=hospTaken_(H, f);
  var h='<div class="card" id="hospFormCard"><h3 style="margin-top:0">'+esc(isNew?t('New booking'):t('Edit booking'))+'</h3>';
  if(f.tripId) h+='<p class="hint" style="margin:0 0 8px">👥 '+esc(t('A team from the Teams Database — its dates and head count came with it.'))+'</p>';
  var inp=function(key, label, type, extra){ var v=f[key]; if(v==null) v='';
    return '<div><label class="f">'+esc(label)+'</label><input type="'+type+'"'+(type==='number'?' inputmode="numeric" min="0"':'')+' data-hf="'+key+'" value="'+esc(String(v))+'"'+(extra||'')+'></div>'; };
  h+=inp('name', t('Name'), 'text', ' maxlength="120" placeholder="'+esc(t('e.g. Pastor Sam, YWAM Example DTS'))+'"');
  /* what they are, as tick-boxes right by the name — one at a time */
  h+='<div class="hospKinds" role="radiogroup" aria-label="'+esc(t('Who is coming?'))+'">'+hospKindOpts_(f.category).map(function(o){
    var on=o.ids.indexOf(f.category)>-1;
    return '<label class="hospKind'+(on?' on':'')+'"><input type="checkbox" data-hfcat="'+o.ids[0]+'"'+(on?' checked':'')+'> '+o.icon+' '+esc(t(o.label))+'</label>'; }).join('')+'</div>';
  if(['staff','student','volunteer'].indexOf(f.category)>-1) h+='<label class="hospCheck"><input type="checkbox" data-hfchk="permanent"'+(f.permanent?' checked':'')+'> '+esc(t('Permanent (no leaving date)'))+'</label>';
  h+='<div class="teamGrid2">'+inp('from', t('Arriving'), 'date')+(f.permanent?'':inp('to', t('Leaving'), 'date'))+'</div>';
  h+=hospPeopleSecHtml_(H, f);
  h+='<div class="teamGrid3">'+inp('males', t('Men'), 'number')+inp('females', t('Women'), 'number')+inp('count', t('Beds'), 'number')+'</div>';
  h+='<label class="hospCheck"><input type="checkbox" data-hfchk="family"'+(f.family?' checked':'')+'> '+esc(t('A family or couple (keep them together)'))+'</label>';
  var need=hospFormCount_(f);
  if(f.from && (f.permanent || (f.to && f.to>f.from))){
    var fit=hospFit_(H, f.from, f.permanent ? hospAdd_(f.from, 1) : f.to, need, f.id);
    h+='<div class="teamStats" id="hospFormFit" style="margin:2px 0 6px">'+hospFitChip_(fit, need)+'</div>';
  }
  // the bed picker
  var sel=f.bedIds||[];
  h+='<h4 style="margin:14px 0 2px">🛏 '+esc(gpT('Beds · {a} of {b} picked',{a:sel.length,b:need}))+'</h4>';
  if(!H.rooms.length) h+='<p class="hint" style="margin:0">'+esc(t('No rooms set up yet — the booking can still hold the number of beds.'))+'</p>';
  else {
    h+='<p class="hint" style="margin:0 0 6px">'+esc(t('Tap a bed to give it to this booking. You can leave beds to pick later.'))+'</p>';
    h+='<button class="btn ghost small" id="hospAutoBtn" style="margin:0 0 6px">✨ '+esc(t('Pick beds for me'))+'</button>';
    /* So nobody over-books (Uriah, Oct 2026): once the booking has all the
       beds it needs, every other free bed greys out; and when it says how
       many men and how many women, the men's rooms grey out once their beds
       are picked, the women's rooms once theirs are — any beds beyond the
       men and women (the Beds box) can go in either. */
    var pIdx=hospBedIndex_(H), picks={ male:0, female:0, any:0 };
    sel.forEach(function(id){ var x=pIdx[id]; if(!x) return; picks[x.room.style==='male'?'male':x.room.style==='female'?'female':'any']++; });
    var caps=null;
    if(f.males!=='' && f.males!=null && f.females!=='' && f.females!=null){
      var mN=Number(f.males)||0, wN=Number(f.females)||0, spare=Math.max(0, need-mN-wN);
      caps={ male:mN+spare, female:wN+spare };
    }
    var totalFull = sel.length>=need;
    if(totalFull) h+='<p class="hint" id="hospBedsFull" style="margin:0 0 6px">✅ '+esc(gpT('All {n} beds picked — the other beds are greyed so you don’t over-book.',{n:need}))+'</p>';
    else if(caps) h+='<p class="hint" id="hospBedsQuota" style="margin:0 0 6px">'+esc(gpT('Men’s beds {a} of {b} · Women’s beds {c} of {d}',{a:picks.male, b:caps.male, c:picks.female, d:caps.female}))+'</p>';
    var warn=[], namesMode=hospNamesMode_(H, f), bi=hospBedIndex_(H);
    if(namesMode){
      var pplAll=hospPeopleFor_(H, f), nmAll=f.bedNames||{}, usedAll={};
      sel.forEach(function(id){ if(nmAll[id]) usedAll[nmAll[id]]=1; });
      var leftAll=pplAll.filter(function(n){ return !usedAll[n]; });
      h+='<p class="hint" style="margin:0 0 6px">'+esc(pplAll.length ? t('Tap a bed, then tap who sleeps in it — a men’s room offers the men, a women’s room the women.') : t('Tap a bed, then type who sleeps in it.'))+'</p>';
      if(leftAll.length && sel.length && f.category==='team') h+='<button class="btn ghost small" id="hospNamesAuto" style="margin:0 0 6px">✨ '+esc(gpT('Fill the beds in order ({n} names)',{n:leftAll.length}))+'</button>';
      h+='<datalist id="hospPeopleList">'+pplAll.map(function(n){ return '<option value="'+esc(n)+'">'; }).join('')+'</datalist>';
    }
    h+=hospBedKeyHtml_();
    H.buildings.forEach(function(b){
      var rooms=H.rooms.filter(function(r){ return r.buildingId===b.id; });
      if(!rooms.length) return;
      h+='<div class="hospPickBld">'+esc(b.name)+'</div>';
      rooms.forEach(function(r){
        var free=r.beds.filter(function(x){ return !x.out && !taken[x.id]; }).length;
        h+='<div class="hospPickRoom"><div class="rowSub"><b>'+esc(r.name)+'</b> '+hospStyleTag_(r.style)+' · '+esc(gpT('{n} free',{n:free}))+'</div><div class="hospBeds">';
        r.beds.forEach(function(x){
          var on=sel.indexOf(x.id)>-1, who=taken[x.id];
          var full = !on && !x.out && !who && (totalFull || (caps && (r.style==='male'||r.style==='female') && picks[r.style]>=caps[r.style]));
          var cls=(on?'sel':x.out?'out':who?'taken':full?'full':'free')+(!on && !x.out && !who && !full ? (r.style==='male'?' bed-m':r.style==='female'?' bed-f':r.style==='couple'?' bed-fam':'') : '');
          if(on && ((r.style==='male' && Number(f.females)>0 && !Number(f.males)) || (r.style==='female' && Number(f.males)>0 && !Number(f.females)))) warn.push(r.name);
          var fullWhy = full ? (totalFull ? t('All the beds this booking needs are picked') : r.style==='male' ? t('All the men’s beds this booking needs are picked') : t('All the women’s beds this booking needs are picked')) : '';
          var mine=on && f.bedNames && f.bedNames[x.id];
          h+='<button class="hospBed '+cls+(on && S.hospBedPick===x.id?' picking':'')+'" data-hbed="'+esc(x.id)+'"'+((x.out||who||full)&&!on?' disabled':'')+' title="'+esc(who||(x.out?t('Out of use'):fullWhy))+'">'+
            esc(x.label)+(who&&!on?'<small>'+esc(who)+'</small>':x.out?'<small>'+esc(t('Out of use'))+'</small>':mine?'<small>'+esc(mine)+'</small>':(on&&namesMode?'<small>'+esc(t('who?'))+'</small>':''))+'</button>';
        });
        h+='</div>';
        /* tap a bed, then tap the person — the names the room is for */
        if(namesMode && S.hospBedPick && sel.indexOf(S.hospBedPick)>-1 && r.beds.some(function(x){ return x.id===S.hospBedPick; })){
          var pb=r.beds.filter(function(x){ return x.id===S.hospBedPick; })[0], cur=(f.bedNames||{})[pb.id]||'';
          var offer=hospNamesForRoom_(H, f, r);
          h+='<div class="hospWho" id="hospWho"><div class="hospWhoHead"><b>'+esc(r.name+' '+pb.label)+'</b> · '+esc(t('Who sleeps here?'))+
            (r.style==='male'?' <span class="pmeta">'+esc(t('men'))+'</span>':r.style==='female'?' <span class="pmeta">'+esc(t('women'))+'</span>':'')+'</div>';
          if(offer.length){
            h+='<div class="hospWhoChips">'+offer.map(function(p){
              var here=p.bedId===pb.id, elsewhere=p.bedId && !here, ebi=elsewhere?bi[p.bedId]:null;
              return '<button class="catChip'+(here?' on':'')+(elsewhere?' dim':'')+'" data-hbwho="'+esc(pb.id)+'|'+esc(p.name)+'">'+(p.sex==='m'?'👨 ':p.sex==='f'?'👩 ':'')+esc(p.name)+
                (elsewhere?' <small>· '+esc(ebi ? ebi.room.name+' '+ebi.bed.label : t('in a bed'))+'</small>':'')+'</button>'; }).join('')+'</div>';
          } else h+='<p class="hint" style="margin:0 0 6px">'+esc(r.style==='male' ? t('No men left to place — type a name, or pick another room.') : r.style==='female' ? t('No women left to place — type a name, or pick another room.') : t('No names left to place — type one.'))+'</p>';
          h+='<div class="hospWhoType"><input type="text" list="hospPeopleList" maxlength="80" data-hbname="'+esc(pb.id)+'" value="'+esc(cur)+'" placeholder="'+esc(t('Or type a name'))+'"></div>';
          h+='<div class="hospWhoBtns">'+(cur?'<button class="linkbtn inline" id="hospWhoClear">'+esc(t('Clear the name'))+'</button>':'')+
            '<button class="linkbtn inline" id="hospWhoRemove">'+esc(t('Remove this bed'))+'</button><span style="flex:1"></span>'+
            '<button class="btn small" id="hospWhoClose">'+esc(t('Done'))+'</button></div></div>';
        }
        h+='</div>';
      });
    });
    if(warn.length) h+='<p class="hint hospWarn" id="hospWarn">⚠️ '+esc(gpT('Check the room: {rooms} is set for the other gender.',{rooms:warn.filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ')}))+'</p>';
    if(namesMode && sel.length && leftAll.length) h+='<p class="hint" id="hospNamesLeft" style="margin:6px 0 0">'+esc(gpT('Not in a bed yet: {names}',{names:leftAll.join(', ')}))+'</p>';
  }
  h+='<label class="f">'+esc(t('Notes'))+'</label><textarea data-hf="notes" rows="2" maxlength="1000" placeholder="'+esc(t('Diet, arrival time, who to contact…'))+'">'+esc(f.notes||'')+'</textarea>';
  h+='<button class="btn" id="hospSaveBtn">'+esc(isNew?t('Save booking'):t('Save changes'))+'</button>';
  h+='<button class="btn ghost" id="hospCancelBtn">'+esc(t('Cancel'))+'</button>';
  if(!isNew) h+='<button class="linkbtn teamDelete" id="hospDeleteBtn">'+esc(t('Delete this booking'))+'</button>';
  return h+'</div>';
}
/* The tick-boxes by a booking's name: Staff, Student, Team, Guest / speaker
   (a speaker ticks the same box as a guest). Volunteer shows only on a
   booking that is one already. */
function hospKindOpts_(cur){
  return [{ ids:['staff'], icon:'🏠', label:'Staff' }, { ids:['student'], icon:'🎓', label:'Student' }, { ids:['volunteer'], icon:'🤝', label:'Volunteer' },
    { ids:['team'], icon:'👥', label:'Team' }, { ids: cur==='speaker' ? ['speaker','guest'] : ['guest','speaker'], icon:'🧳', label:'Guest / speaker' }];
}
/* The people a booking can name in its beds: a team's from its portal (with
   the team's request), anyone already named. */
/* A group booking's people — a school's students, a team's members — typed
   in one by one (with man / woman, so beds can follow the rooms), pasted as
   a list, or for a team taken from its portal. The men / women / beds
   numbers follow the list. */
function hospPortalPeople_(H, f){ var q=f.tripId && (H.requests||[]).filter(function(x){ return x.tripId===f.tripId; })[0]; return (q && q.people) || []; }
function hospPeopleSecHtml_(H, f){
  if(f.category!=='student' && f.category!=='team') return '';
  var list=f.people||[], portal=hospPortalPeople_(H, f), have={};
  list.forEach(function(p){ have[String(p.name).toLowerCase()]=1; });
  var fromPortal=portal.filter(function(p){ return !have[String(p.name).toLowerCase()]; });
  var isTeam=f.category==='team';
  var h='<h4 style="margin:14px 0 2px">👥 '+esc(isTeam ? t('People in this team') : t('Students in this booking'))+(list.length?' · '+list.length:'')+'</h4>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(isTeam ? t('Add each person, or paste a list — one name per line. Leave it empty to book the beds only.') : t('Booking a school? Add each student, or paste a list — one name per line. For one student on their own, put their name above and leave this empty.'))+'</p>';
  h+='<div class="hospPeople" id="hospPeople">'+list.map(function(p, i){
    return '<div class="hospPerson"><input type="text" maxlength="80" data-hpname="'+i+'" value="'+esc(p.name)+'" placeholder="'+esc(t('Name'))+'" aria-label="'+esc(t('Name'))+'">'+
      '<div class="hospSex"><button class="'+(p.sex==='m'?'on':'')+'" data-hpsex="'+i+'|m" aria-label="'+esc(t('Man'))+'">'+esc(t('M'))+'</button><button class="'+(p.sex==='f'?'on':'')+'" data-hpsex="'+i+'|f" aria-label="'+esc(t('Woman'))+'">'+esc(t('F'))+'</button></div>'+
      '<button class="linkbtn inline teamDelete" data-hpdel="'+i+'" aria-label="'+esc(t('Remove'))+'">✕</button></div>'; }).join('')+'</div>';
  h+='<div class="hospPeopleBtns"><button class="btn ghost small" id="hospPersonAdd">＋ '+esc(isTeam ? t('Add a person') : t('Add a student'))+'</button>'+
    '<button class="btn ghost small" id="hospPasteOpen">📋 '+esc(t('Paste a list'))+'</button>'+
    (fromPortal.length ? '<button class="btn ghost small" id="hospFromPortal">＋ '+esc(gpT('The {n} names from their portal',{n:fromPortal.length}))+'</button>' : '')+'</div>';
  if(S.hospPaste) h+='<div class="hospPasteBox"><textarea id="hospPasteText" rows="5" placeholder="'+esc(t('One name per line. Add (m) or (f) after a name to say man or woman.'))+'"></textarea>'+
    '<button class="btn small" id="hospPasteAdd">'+esc(t('Add these'))+'</button><button class="linkbtn inline" id="hospPasteCancel">'+esc(t('Cancel'))+'</button></div>';
  return h;
}
/* the men / women / beds follow the list */
function hospPeopleCount_(f){
  var l=f.people||[]; if(!l.length) return;
  var m=l.filter(function(p){ return p.sex==='m'; }).length, w=l.filter(function(p){ return p.sex==='f'; }).length;
  f.males=m||''; f.females=w||''; f.count=Math.max(l.length, (f.bedIds||[]).length);
}
function hospPeopleFor_(H, f){
  var out=[];
  (f.people||[]).forEach(function(p){ if(p.name && out.indexOf(p.name)===-1) out.push(p.name); });
  hospPortalPeople_(H, f).forEach(function(p){ if(out.indexOf(p.name)===-1) out.push(p.name); });
  Object.keys(f.bedNames||{}).forEach(function(id){ var n=f.bedNames[id]; if(n && out.indexOf(n)===-1) out.push(n); });
  return out;
}
/* Who is a man and who a woman, from the names list and the team's portal. */
function hospSexOf_(H, f){
  var sexOf={};
  hospPortalPeople_(H, f).concat(f.people||[]).forEach(function(p){ if(p && p.name && p.sex) sexOf[p.name]=p.sex; });
  return sexOf;
}
/* Does this booking name who sleeps where? A team or a school, or anything
   with people listed, or more than one bed. A lone guest just picks a bed. */
function hospNamesMode_(H, f){
  return !!(hospPeopleFor_(H, f).length || f.category==='team' || hospFormCount_(f)>1);
}
/* The names to offer for a bed (Uriah, Oct 2026: the picker and "who sleeps
   where" are one step): in a men's room the men, in a women's room the
   women — anyone whose sex is not known in either — and people not yet in a
   bed first. */
function hospNamesForRoom_(H, f, room){
  var sexOf=hospSexOf_(H, f), nm=f.bedNames||{}, inBed={};
  Object.keys(nm).forEach(function(id){ if((f.bedIds||[]).indexOf(id)>-1) inBed[nm[id]]=id; });
  var want = room.style==='male' ? 'm' : room.style==='female' ? 'f' : '';
  var all=hospPeopleFor_(H, f).filter(function(n){ return !want || !sexOf[n] || sexOf[n]===want; });
  return all.map(function(n){ return { name:n, sex:sexOf[n]||'', bedId:inBed[n]||'' }; })
    .sort(function(a,b){ return (a.bedId?1:0)-(b.bedId?1:0); });
}
/* The name a bed shows: the person in it — "Name (Team)" for a team or a
   family — or else the booking's own name. */
/* Bed colours (Uriah, Oct 2026): men blue, women pink, a couple or family
   green. Who is in a bed: a family booking is green; else the person named on
   that bed, by their man / woman; else a booking of only men or only women;
   else the room's own style. An empty bed takes a light tint from its room. */
function hospBedSex_(k, bedId, room){
  if(k){
    if(k.family) return 'fam';
    var n=k.bedNames && k.bedNames[bedId], p=n && (k.people||[]).filter(function(x){ return x.name===n; })[0];
    if(p && (p.sex==='m' || p.sex==='f')) return p.sex;
    var m=Number(k.males)||0, w=Number(k.females)||0;
    if(m && !w) return 'm';
    if(w && !m) return 'f';
  }
  return room && room.style==='male' ? 'm' : room && room.style==='female' ? 'f' : room && room.style==='couple' ? 'fam' : '';
}
var HOSP_BED_SYM={m:'♂', f:'♀', fam:'👪'};
function hospBedKeyHtml_(){ return '<div class="hospBedKey" id="hospBedKey"><span class="bm">♂ '+esc(t('Men'))+'</span><span class="bf">♀ '+esc(t('Women'))+'</span><span class="bfam">👪 '+esc(t('Couple / family'))+'</span></div>'; }
function hospStyleTag_(st){ var c=st==='male'?'st-m':st==='female'?'st-f':st==='couple'?'st-fam':''; return '<span class="hospStyleTag '+c+'">'+esc(hospStyle_(st))+'</span>'; }
function hospBedWho_(k, bedId){
  var n=k.bedNames && k.bedNames[bedId];
  return n ? n+' ('+k.name+')' : k.name;
}
/* Put the booking's people in its beds: men into men's rooms and women into
   women's first, then anyone anywhere; beds already named keep theirs. */
function hospFillNames_(f){
  f.bedNames=f.bedNames||{}; var used={}; f.bedIds.forEach(function(id){ if(f.bedNames[id]) used[f.bedNames[id]]=1; });
  var left=hospPeopleFor_(S.hosp, f).filter(function(n){ return !used[n]; });
  /* men into men's rooms and women into women's first (as the portal says who is which), then anyone anywhere */
  var sexOf={};
  hospPortalPeople_(S.hosp, f).concat(f.people||[]).forEach(function(p){ if(p.sex) sexOf[p.name]=p.sex; });
  var bi=hospBedIndex_(S.hosp), want=function(id){ var x=bi[id]; return x && x.room.style==='male' ? 'm' : x && x.room.style==='female' ? 'f' : ''; };
  var take=function(pred){ var i=left.findIndex(pred); return i>-1 ? left.splice(i,1)[0] : ''; };
  f.bedIds.forEach(function(id){ var w=want(id); if(!f.bedNames[id] && w){ var n=take(function(n){ return sexOf[n]===w; }); if(n) f.bedNames[id]=n; } });
  f.bedIds.forEach(function(id){ var w=want(id); if(!f.bedNames[id] && left.length){ var n=take(function(n){ return !w || !sexOf[n] || sexOf[n]===w; }); if(n) f.bedNames[id]=n; } });
}
function hospFormCount_(f){ return Math.max(Number(f.count)||0, (Number(f.males)||0)+(Number(f.females)||0), (f.bedIds||[]).length, (f.people||[]).length, 1); }
/* Pick beds for me: men into men's rooms first, women into women's, then
   anyone into mixed / family / guest rooms; staff rooms only for staff. */
function hospAutoPick_(H, f){
  var taken=hospTaken_(H, f), sel=(f.bedIds||[]).slice(), idx=hospBedIndex_(H);
  var have={ male:0, female:0, any:0 };
  sel.forEach(function(id){ var x=idx[id]; if(!x) return; have[x.room.style==='male'?'male':x.room.style==='female'?'female':'any']++; });
  var freeIn=function(test){ var out=[]; H.rooms.forEach(function(r){ if(!test(r)) return; r.beds.forEach(function(b){ if(!b.out && !taken[b.id] && sel.indexOf(b.id)===-1) out.push(b.id); }); }); return out; };
  var ok=function(r){ return r.style!=='staff' || f.category==='staff'; };
  var flex=function(r){ return ok(r) && r.style!=='male' && r.style!=='female'; };
  var take=function(list, n){ while(n>0 && list.length){ var id=list.shift(); if(sel.indexOf(id)===-1){ sel.push(id); n--; } } return n; };
  var m=Math.max(0,(Number(f.males)||0)-have.male), w=Math.max(0,(Number(f.females)||0)-have.female);
  m=take(freeIn(function(r){ return r.style==='male'; }), m);
  w=take(freeIn(function(r){ return r.style==='female'; }), w);
  var rest=hospFormCount_(f)-sel.length;
  take(freeIn(flex), rest);
  return sel.slice(0, hospFormCount_(f));
}
/* ---- upload the rooms sheet ----
   The base's own "Rooms and Peoples in Base" sheet, downloaded as CSV, read
   as it is (hospSheetRows_): each "Room 102" block with its "Bunk" line and
   name / bed-letter rows; each family, couple or teacher room with its
   "Total:" head count; and Peace House's "Unit N" rows with the family and
   how many. "(staff)" after a name makes them staff, anyone else in a dorm a
   student, families staff. A plain list with a header row (Building, Room,
   Room type, Bed, Name, Category) is read too. Either way it becomes rows for
   hospImport, which fills the beds already in the book (and adds any room or
   bed it hasn't got). */
function hospCsvParse_(text){
  var rows=[], row=[], cell='', q=false, i, c;
  text=String(text||'').replace(/^\uFEFF/,'');
  for(i=0;i<text.length;i++){
    c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else q=false; } else cell+=c; continue; }
    if(c==='"') q=true;
    else if(c===','){ row.push(cell); cell=''; }
    else if(c==='\n' || c==='\r'){ if(c==='\r' && text[i+1]==='\n') i++; row.push(cell); rows.push(row); row=[]; cell=''; }
    else cell+=c;
  }
  if(cell!=='' || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(function(r){ return r.some(function(x){ return String(x).trim(); }); });
}
function hospStyleOf_(v){
  v=String(v||'').toLowerCase();
  if(/family/.test(v)) return 'family';
  if(/couple/.test(v)) return 'couple';
  if(/girl|wom|female|ladies/.test(v)) return 'female';
  if(/boy|bosy|guy|\bmen\b|\bman\b|male/.test(v)) return 'male';
  if(/guest|speaker|teacher/.test(v)) return 'guest';
  if(/staff/.test(v)) return 'staff';
  return 'mixed';
}
var HOSP_LETTERS='ABCDEFGHIJKL';
function hospSheetRows_(grid){
  var cell=function(r,c){ return (grid[r] && grid[r][c]!=null) ? String(grid[r][c]).trim() : ''; };
  var num=function(v){ v=String(v||'').trim(); return /^\d+$/.test(v) ? Number(v) : null; };
  var rows=[], r, c;
  var staffName=function(n){ return /\(\s*staff\s*\)/i.test(n); };
  var clean=function(n){ return n.replace(/\(\s*staff\s*\)/ig,'').replace(/\s+/g,' ').trim(); };
  for(r=0;r<grid.length;r++) for(c=0;c<(grid[r]||[]).length;c++){
    var v=cell(r,c), m;
    // Peace House: "Unit 2 | Yi family | 2 | 1 | 3"
    if((m=v.match(/^unit\s*(\d+)$/i))){
      var fam=cell(r,c+1), people=num(cell(r,c+4)); if(people==null) people=(num(cell(r,c+2))||0)+(num(cell(r,c+3))||0);
      for(var u=0; u<(fam?people:0) && u<HOSP_LETTERS.length; u++) rows.push({ building:'Peace House', room:'Unit '+m[1], style:'family', bed:HOSP_LETTERS[u], name:fam, category:'staff' });
      if(!fam || !people) rows.push({ building:'Peace House', room:'Unit '+m[1], style:'family', bed:'', name:'', category:'' });
      continue;
    }
    // a room heading: "Bosy Room 102(students)", "Couple - R402", "Emmy's Family 202"…
    if(!/[a-z]/i.test(v) || !(m=v.match(/(?:^|[^\d])(\d{3})(?!\d)/))) continue;
    var room=m[1];
    if(/bunk/i.test(cell(r+1,c))){
      var style=hospStyleOf_(v);
      for(var rr=r+2; rr<grid.length && /^[A-L]$/i.test(cell(rr,c+1)); rr++){
        var nm=cell(rr,c);
        rows.push({ building:'Old Base', room:room, style:style, bed:cell(rr,c+1).toUpperCase(), name:clean(nm), category: !nm ? '' : staffName(nm) ? 'staff' : 'student' });
      }
      continue;
    }
    // family / couple / teacher: how many, from the "Total:" line below it
    var total=null;
    for(var tr=r+1; tr<=r+8 && tr<grid.length; tr++){
      if((grid[tr]||[]).some(function(x){ return /^total\s*:?$/i.test(String(x).trim()); })){ total=num(cell(tr,c)); if(total==null) total=num(cell(tr,c+1)); break; }
    }
    var label=v.replace(/(?:room\s*)?-?\s*\bR?\s*\d{3}\b/ig,'').replace(/[-–]+\s*$/,'').replace(/\s+/g,' ').trim();
    var kind=/couple/i.test(v) ? 'couple' : /teacher|speaker|guest/i.test(v) ? 'guest' : 'family';
    var generic=/^(couple|teacher|speaker|guest|family)$/i.test(label);
    if(total && !generic) for(var k=0;k<total && k<HOSP_LETTERS.length;k++) rows.push({ building:'Old Base', room:room, style:kind, bed:HOSP_LETTERS[k], name:label, category:'staff' });
    else rows.push({ building:'Old Base', room:room, style:kind, bed:'', name:'', category:'' });
  }
  return rows;
}
/* The rows to send, or an error to show. */
function hospCsvRows_(text){
  var all=hospCsvParse_(text);
  if(all.length<2) return { err:t('That file has no rows under its header.') };
  var head=all[0].map(function(h){ return String(h).trim().toLowerCase(); });
  var listLike=head.some(function(h){ return /^building/.test(h); }) && head.some(function(h){ return /^room/.test(h); });
  if(!listLike){
    var sheet=hospSheetRows_(all);
    return sheet.length ? { rows:sheet } : { err:t('No rooms found in that file.') };
  }
  var col=function(re){ for(var i=0;i<head.length;i++) if(re.test(head[i])) return i; return -1; };
  var cb=col(/^building|house/), cr=col(/^room$|^room\s*(name|number|no)/), cs=col(/type|style|kind/), cd=col(/^bed/), cn=col(/^name|person|who$/), cc=col(/categ|role/);
  if(cr<0) cr=col(/room/);
  if(cb<0 || cr<0) return { err:t('The file needs at least a Building and a Room column.') };
  var out=[];
  all.slice(1).forEach(function(r){
    var g=function(i){ return i<0 ? '' : String(r[i]==null?'':r[i]).trim(); };
    var name=g(cn), cat=g(cc).toLowerCase();
    if(/\(\s*staff\s*\)/i.test(name)){ cat='staff'; name=name.replace(/\(\s*staff\s*\)/ig,'').trim(); }
    cat = /staff/.test(cat) ? 'staff' : /student/.test(cat) ? 'student' : /volunt/.test(cat) ? 'volunteer' : (name ? 'staff' : '');
    if(!g(cb) || !g(cr)) return;
    out.push({ building:g(cb), room:g(cr), style:hospStyleOf_(g(cs)), bed:g(cd), name:name, category:cat });
  });
  if(!out.length) return { err:t('No rooms found in that file.') };
  return { rows:out };
}
function hospImportHtml_(){
  var I=S.hospImport||{};
  var h='<div class="card" id="hospImportCard"><h3 style="margin-top:0">⬆️ '+esc(t('Upload your rooms sheet'))+'</h3>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(t('The “Rooms and Peoples in Base” sheet, as it is: in Google Sheets choose File → Download → CSV, then pick that file here. Everyone on it goes into their bed from today — (staff) after a name makes them staff.'))+'</p>'+
    '<input type="file" id="hospCsvFile" accept=".csv,text/csv">';
  if(I.err) h+='<p class="hint hospWarn" id="hospImportErr">⚠️ '+esc(I.err)+'</p>';
  if(I.rows){
    var b={}, r={}, people={};
    I.rows.forEach(function(x){ b[x.building]=1; r[x.building+'|'+x.room]=1; if(x.name) people[x.building+'|'+x.room+'|'+(x.style==='family'||x.style==='couple'?x.name:x.bed)]=1; });
    var beds=I.rows.filter(function(x){ return x.bed; }).length;
    h+='<p class="sub" id="hospImportPreview" style="margin:10px 0 4px"><b>'+esc(I.file||'')+'</b>: '+esc(gpT('{b} buildings, {r} rooms, {d} beds, {p} people',{b:Object.keys(b).length, r:Object.keys(r).length, d:beds, p:Object.keys(people).length}))+'</p>'+
      '<button class="btn" id="hospImportGo" style="margin-top:6px">'+esc(t('Import'))+'</button>';
  }
  if(I.done){
    var d=I.done;
    h+='<p class="sub" id="hospImportDone" style="margin:10px 0 0">✅ '+esc(gpT('Added {b} buildings, {r} rooms, {d} beds and {p} people.',{b:d.buildings, r:d.rooms, d:d.beds, p:d.people}))+'</p>'+
      (d.skipped && d.skipped.length ? '<p class="hint">'+esc(gpT('{n} already had their bed taken and were left out:',{n:d.skipped.length}))+' '+d.skipped.slice(0,20).map(function(x){ return esc(x.name+' ('+x.room+')'); }).join(', ')+'</p>' : '');
  }
  return h+'</div>';
}
function hospRoomsHtml_(H){
  var h='<p class="sub" style="margin:0 0 10px">'+esc(t('Your buildings, rooms and beds. A bed out of use isn’t counted or booked.'))+'</p>';
  h+=hospImportHtml_();
  if(S.hospBld) h+=hospBldFormHtml_();
  else h+='<button class="btn ghost" id="hospAddBld" style="margin-top:0">＋ '+esc(t('Add a building'))+'</button>';
  H.buildings.forEach(function(b){
    var rooms=H.rooms.filter(function(r){ return r.buildingId===b.id; });
    var beds=0; rooms.forEach(function(r){ r.beds.forEach(function(x){ if(!x.out) beds++; }); });
    h+='<div class="card slim hospBld" data-hospbld="'+esc(b.id)+'"><div class="teamHead"><div style="min-width:0"><div class="rowName"><b>🏠 '+esc(b.name)+'</b></div>'+
      '<div class="rowSub">'+esc(gpT('{r} rooms · {b} beds',{r:rooms.length,b:beds}))+'</div></div>'+
      '<button class="linkbtn inline" data-hospbldedit="'+esc(b.id)+'">'+esc(t('Rename'))+'</button></div><div class="hospRoomGrid">';
    rooms.forEach(function(r){
      var out=r.beds.filter(function(x){ return x.out; }).length;
      h+='<button class="hospRoomRow" data-hosproom="'+esc(r.id)+'"><span><b>'+esc(r.name)+'</b> '+hospStyleTag_(r.style)+'</span><span class="rowSub">'+
        esc(gpT('{n} beds',{n:r.beds.length}))+(out?' · '+esc(gpT('{n} out',{n:out})):'')+' ›</span></button>';
    });
    h+='</div><button class="btn ghost small" data-hospaddroom="'+esc(b.id)+'" style="margin:8px 0 0">＋ '+esc(t('Add a room'))+'</button>';
    if(!rooms.length) h+=' <button class="linkbtn inline teamDelete" data-hospbldel="'+esc(b.id)+'">'+esc(t('Delete building'))+'</button>';
    h+='</div>';
  });
  return h;
}
function hospBldFormHtml_(){
  var f=S.hospBld;
  return '<div class="card" id="hospBldForm"><label class="f">'+esc(t('Building name'))+'</label>'+
    '<input type="text" id="hospBldName" maxlength="80" value="'+esc(f.name||'')+'" placeholder="'+esc(t('e.g. Main House'))+'">'+
    '<button class="btn" id="hospBldSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="hospBldCancel">'+esc(t('Cancel'))+'</button></div>';
}
function hospRoomFormHtml_(H){
  var f=S.hospRoom, isNew=!f.id;
  var h='<div class="card" id="hospRoomForm"><h3 style="margin-top:0">'+esc(isNew?t('Add a room'):t('Edit room'))+'</h3>';
  h+='<div class="teamGrid2"><div><label class="f">'+esc(t('Room name or number'))+'</label><input type="text" data-hrf="name" maxlength="60" value="'+esc(f.name||'')+'" placeholder="101"></div>'+
    '<div><label class="f">'+esc(t('Building'))+'</label><select data-hrf="buildingId">'+H.buildings.map(function(b){ return '<option value="'+esc(b.id)+'"'+(b.id===f.buildingId?' selected':'')+'>'+esc(b.name)+'</option>'; }).join('')+'</select></div></div>';
  h+='<label class="f">'+esc(t('Who is this room for?'))+'</label><select data-hrf="style">'+HOSP_STYLES.map(function(s){ return '<option value="'+s[0]+'"'+(s[0]===f.style?' selected':'')+'>'+esc(t(s[1]))+'</option>'; }).join('')+'</select>';
  h+='<label class="f">'+esc(gpT('Beds ({n})',{n:f.beds.length}))+'</label>';
  f.beds.forEach(function(b, i){
    h+='<div class="hospBedEdit"><input type="text" data-hrbed="'+i+'" maxlength="20" value="'+esc(b.label)+'" aria-label="'+esc(t('Bed name'))+'">'+
      '<label class="hospCheck"><input type="checkbox" data-hrout="'+i+'"'+(b.out?' checked':'')+'> '+esc(t('Out of use'))+'</label>'+
      '<button class="linkbtn inline teamDelete" data-hrdel="'+i+'" aria-label="'+esc(t('Remove bed'))+'">✕</button></div>';
  });
  h+='<button class="btn ghost small" id="hospAddBed" style="margin:6px 0 0">＋ '+esc(t('Add a bed'))+'</button>';
  h+='<label class="f">'+esc(t('Notes'))+'</label><input type="text" data-hrf="notes" maxlength="300" value="'+esc(f.notes||'')+'" placeholder="'+esc(t('e.g. Air-con, own bathroom'))+'">';
  h+='<button class="btn" id="hospRoomSave">'+esc(t('Save room'))+'</button><button class="btn ghost" id="hospRoomCancel">'+esc(t('Cancel'))+'</button>';
  if(!isNew) h+='<button class="linkbtn teamDelete" id="hospRoomDelete">'+esc(t('Delete this room'))+'</button>';
  return h+'</div>';
}
/* ---- SR Hospitality, part 2: the calendar and the bed board ----
   Calendar: one row per bed (grouped by room), 14 days across from a Monday,
   each booking a bar over the nights it holds that bed; a booking with beds
   still to pick sits in "No bed yet" rows at the bottom. Over each day, how
   full the base is that night. Tap a bar for the booking. It scrolls
   sideways inside its card on a phone; the bed names stay put.

   Bed board: the rooms on one night, each bed with who sleeps in it. Tap a
   person, then a bed: an empty bed moves them, someone else's swaps the two
   (hospMoveBed, for the whole stay). People still without a bed that night
   wait at the top and are placed the same way. On a desktop the same moves
   can be dragged. */
var HOSP_CAL_DAYS=14;
var HOSP_WD=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function hospCalHtml_(H){
  var today=todayStr(), d0=S.hospCalFrom || hospMonday_(today), dN=hospAdd_(d0, HOSP_CAL_DAYS);
  var days=[]; for(var i=0;i<HOSP_CAL_DAYS;i++) days.push(hospAdd_(d0,i));
  var cap=hospCap_(H), held=hospDaily_(H.bookings, d0, dN);
  var h='<div class="calNav">'+
    '<button class="weekArrow" id="hospCalPrev" aria-label="'+esc(t('Earlier'))+'">‹</button>'+
    '<div class="calTitle">'+esc(hospDate_(d0))+' – '+esc(hospDate_(hospAdd_(dN,-1)))+'</div>'+
    '<button class="weekArrow" id="hospCalNext" aria-label="'+esc(t('Later'))+'">›</button>'+
    (S.hospCalFrom && S.hospCalFrom!==hospMonday_(today) ? '<button class="linkbtn inline" id="hospCalToday">'+esc(t('Today'))+'</button>' : '')+'</div>';
  if(!H.rooms.length) return h+'<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No rooms set up yet'))+'</p></div>';
  var rows=[], row=2;   // row 1 is the day header
  var inWin=function(k){ return k.from<dN && hospEnd_(k)>d0; };
  var span=function(k){ var a=k.from>d0?k.from:d0, e=hospEnd_(k), b=e<dN?e:dN; return [hospNights_(d0,a), hospNights_(d0,b)]; };
  var bar=function(k, r, extra){
    var s=span(k), c=hospCat_(k.category);
    return '<button class="hospCalBar hospBg '+c[0]+(k.from<d0?' cont':'')+(hospEnd_(k)>dN?' more':'')+'" data-hospedit="'+esc(k.id)+'" data-calbar="'+esc(k.id)+'" style="grid-row:'+r+';grid-column:'+(s[0]+2)+' / '+(s[1]+2)+'" title="'+esc(k.name)+'">'+esc(k.name)+(extra||'')+'</button>';
  };
  H.buildings.forEach(function(b){
    H.rooms.filter(function(r){ return r.buildingId===b.id; }).forEach(function(r){
      rows.push('<div class="hospCalRoom" style="grid-row:'+row+'"><b>'+esc(r.name)+'</b> · '+esc(hospStyle_(r.style))+(H.buildings.length>1?' · '+esc(b.name):'')+'</div>'); row++;
      r.beds.forEach(function(x){
        rows.push('<div class="hospCalBed'+(x.out?' out':'')+'" style="grid-row:'+row+'">'+esc(x.label)+(x.out?' 🔧':'')+'</div>');
        H.bookings.forEach(function(k){ if(inWin(k) && (k.bedIds||[]).indexOf(x.id)>-1) rows.push(bar(k, row)); });
        row++;
      });
    });
  });
  // bookings with beds still to pick, stacked in lanes
  var waiting=H.bookings.filter(function(k){ return inWin(k) && (k.bedIds||[]).length<k.count; })
    .sort(function(a,b){ return a.from<b.from?-1:1; });
  if(waiting.length){
    rows.push('<div class="hospCalRoom wait" style="grid-row:'+row+'"><b>'+esc(t('No bed yet'))+'</b></div>'); row++;
    var lanes=[];
    waiting.forEach(function(k){
      var s=span(k), l=0; while(lanes[l]!==undefined && lanes[l]>s[0]) l++;
      lanes[l]=s[1];
      rows.push(bar(k, row+l, ' ×'+(k.count-(k.bedIds||[]).length)));
    });
    for(var l=0;l<lanes.length;l++) rows.push('<div class="hospCalBed" style="grid-row:'+(row+l)+'"></div>');
    row+=lanes.length;
  }
  var g='<div class="hospCalGrid" id="hospCal" style="grid-template-rows:50px repeat('+(row-2)+', 30px)">';
  g+='<div class="hospCalCorner" style="grid-row:1"></div>';
  days.forEach(function(iso, i){
    var pct=cap ? Math.round(held[i]/cap*100) : 0, wd=HOSP_WD[(i+((new Date(d0+'T00:00:00Z').getUTCDay()+6)%7))%7];
    g+='<div class="hospCalDay'+(iso===today?' today':'')+'" data-hospday="'+iso+'" data-pct="'+pct+'" style="grid-column:'+(i+2)+'"><span>'+esc(t(wd))+'</span><b>'+Number(iso.slice(8,10))+'</b>'+
      '<small class="'+hospLevel_(pct)+'">'+pct+'%</small></div>';
    g+='<div class="hospCalCol'+(iso===today?' today':'')+'" style="grid-column:'+(i+2)+';grid-row:2 / '+row+'"></div>';
  });
  g+=rows.join('')+'</div>';
  h+='<div class="card hospCalCard"><div class="hospCalScroll">'+g+'</div></div>';
  h+='<div class="calLegend">'+HOSP_CATS.map(function(c){ return '<span class="calDot hospBg '+c[0]+'"></span>'+esc(t(c[1])); }).join('')+'</div>';
  return h;
}
/* who has each bed on night `iso`, and who is here that night without one */
function hospNight_(H, iso){
  var byBed={}, wait=[];
  H.bookings.forEach(function(k){
    if(!(k.from<=iso && iso<hospEnd_(k))) return;
    (k.bedIds||[]).forEach(function(id){ byBed[id]=k; });
    var left=k.count-(k.bedIds||[]).length;
    if(left>0) wait.push({ k:k, left:left });
  });
  return { byBed:byBed, wait:wait };
}
function hospBoardHtml_(H){
  var today=todayStr(), iso=S.hospBoardDay || today, N=hospNight_(H, iso), mv=S.hospMove;
  var h='<div class="calNav">'+
    '<button class="weekArrow" id="hospBoardPrev" aria-label="'+esc(t('Previous day'))+'">‹</button>'+
    '<input type="date" id="hospBoardDay" class="hospBoardDay" value="'+esc(iso)+'" aria-label="'+esc(t('Night'))+'">'+
    '<button class="weekArrow" id="hospBoardNext" aria-label="'+esc(t('Next day'))+'">›</button>'+
    (iso!==today ? '<button class="linkbtn inline" id="hospBoardToday">'+esc(t('Tonight'))+'</button>' : '')+'</div>';
  if(!H.rooms.length) return h+'<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No rooms set up yet'))+'</p></div>';
  var who=mv && H.bookings.filter(function(k){ return k.id===mv.id; })[0];
  if(who) h+='<div class="card slim hospMoveBar" id="hospMoveBar"><div class="rowName">↔️ <b>'+esc(who.name)+'</b></div>'+
    '<div class="rowSub">'+esc(mv.bed ? t('Tap an empty bed to move them, or someone’s bed to swap. It moves them for their whole stay.') : t('Tap an empty bed to put them in it.'))+'</div>'+
    '<div class="hospActions">'+(mv.bed?'<button class="btn ghost small" id="hospMoveOff">'+esc(t('Take off this bed'))+'</button>':'')+
    '<button class="btn ghost small" id="hospMoveCancel">'+esc(t('Cancel'))+'</button></div></div>';
  else h+='<p class="hint" style="margin:0 0 8px">'+esc(t('Tap a person, then the bed they should move to. On a computer you can drag them.'))+'</p>';
  if(N.wait.length){
    h+='<div class="card slim hospWait"><div class="rowName"><b>'+esc(t('No bed yet'))+'</b></div><div class="chips" style="margin-bottom:0">'+N.wait.map(function(w){
      var on=mv && mv.id===w.k.id && !mv.bed;
      return '<button class="hospChip hospWho'+(on?' on':'')+'" data-hmove="'+esc(w.k.id)+'" data-hmovebed="" draggable="true">'+esc(w.k.name)+' ×'+w.left+'</button>'; }).join('')+'</div></div>';
  }
  var free=0, used=0;
  H.buildings.forEach(function(b){
    var rooms=H.rooms.filter(function(r){ return r.buildingId===b.id; });
    if(!rooms.length) return;
    h+='<div class="hospPickBld">'+esc(b.name)+'</div><div class="hospGrid">';
    rooms.forEach(function(r){
      h+='<div class="card slim hospBoardRoom"><div class="rowSub"><b>'+esc(r.name)+'</b> '+hospStyleTag_(r.style)+'</div><div class="hospBeds">';
      r.beds.forEach(function(x){
        var k=N.byBed[x.id], c=k && hospCat_(k.category), on=mv && k && mv.id===k.id && mv.bed===x.id;
        if(k) used++; else if(!x.out) free++;
        var sx=x.out ? '' : hospBedSex_(k, x.id, r);
        var cls=(x.out?'out':k?'held hospCat '+c[0]:'free')+(sx?' bed-'+sx:'');
        if(mv && !on && !x.out && who) cls+=' target';
        h+='<button class="hospBed board '+cls+(on?' moving':'')+'" data-hboard="'+esc(x.id)+'"'+(k?' data-hmove="'+esc(k.id)+'" data-hmovebed="'+esc(x.id)+'" draggable="true"':'')+(x.out?' disabled':'')+'>'+
          '<span class="hospBedLab">'+(sx?'<span class="hospBedSym">'+HOSP_BED_SYM[sx]+'</span> ':'')+esc(x.label)+'</span>'+(k?'<small>'+c[2]+' '+esc(hospBedWho_(k, x.id))+'</small>':x.out?'<small>'+esc(t('Out of use'))+'</small>':'<small>'+esc(t('Free'))+'</small>')+'</button>';
      });
      h+='</div></div>';
    });
    h+='</div>';
  });
  return '<p class="sub" id="hospBoardSum" style="margin:0 0 6px">'+esc(gpT('{a} in a bed · {b} beds free',{a:used,b:free}))+'</p>'+hospBedKeyHtml_()+h;
}
function hospCalTabHtml_(H){
  var mode=S.hospCalMode==='board'?'board':'cal';
  var h='<div class="campusSeg periodSeg">'+
    '<button class="campusBtn'+(mode==='cal'?' on':'')+'" data-hospcalmode="cal">📅 '+esc(t('Calendar'))+'</button>'+
    '<button class="campusBtn'+(mode==='board'?' on':'')+'" data-hospcalmode="board">🛏 '+esc(t('Bed board'))+'</button></div>';
  return h+(mode==='board' ? hospBoardHtml_(H) : hospCalHtml_(H));
}
function bindHospCal_(send){
  var shiftCal=function(n){ S.hospCalFrom=hospAdd_(S.hospCalFrom||hospMonday_(todayStr()), n); render(); };
  var cp=document.getElementById('hospCalPrev'); if(cp) cp.onclick=function(){ gpTap(); shiftCal(-7); };
  var cn=document.getElementById('hospCalNext'); if(cn) cn.onclick=function(){ gpTap(); shiftCal(7); };
  var ct=document.getElementById('hospCalToday'); if(ct) ct.onclick=function(){ gpTap(); S.hospCalFrom=null; render(); };
  document.querySelectorAll('[data-hospcalmode]').forEach(function(b){ b.onclick=function(){ gpTap(); S.hospCalMode=b.getAttribute('data-hospcalmode'); S.hospMove=null; render(); }; });
  var day=function(n){ S.hospBoardDay=hospAdd_(S.hospBoardDay||todayStr(), n); S.hospMove=null; render(); };
  var bp=document.getElementById('hospBoardPrev'); if(bp) bp.onclick=function(){ gpTap(); day(-1); };
  var bn=document.getElementById('hospBoardNext'); if(bn) bn.onclick=function(){ gpTap(); day(1); };
  var bt=document.getElementById('hospBoardToday'); if(bt) bt.onclick=function(){ gpTap(); S.hospBoardDay=null; S.hospMove=null; render(); };
  var bd=document.getElementById('hospBoardDay'); if(bd) bd.onchange=function(){ if(/^\d{4}-\d{2}-\d{2}$/.test(bd.value)){ S.hospBoardDay=bd.value; S.hospMove=null; render(); } };
  var mc=document.getElementById('hospMoveCancel'); if(mc) mc.onclick=function(){ S.hospMove=null; render(); };
  var move=function(id, from, to){
    send('hospMoveBed', [id, from, to], function(){ S.hospMove=null; showMsg(to ? t('Moved') : t('Taken off the bed')); });
  };
  var mo=document.getElementById('hospMoveOff'); if(mo) mo.onclick=function(){ var m=S.hospMove; if(m) move(m.id, m.bed, ''); };
  document.querySelectorAll('[data-hboard]').forEach(function(b){
    b.onclick=function(){
      var bed=b.getAttribute('data-hboard'), m=S.hospMove, held=b.getAttribute('data-hmove');
      if(m && !(held===m.id && bed===m.bed)){ move(m.id, m.bed, bed); return; }
      if(held){ gpTap(); S.hospMove = m ? null : { id:held, bed:bed }; render(); }
    };
  });
  document.querySelectorAll('.hospWho[data-hmove]').forEach(function(b){
    b.onclick=function(){ var id=b.getAttribute('data-hmove'); gpTap(); S.hospMove = (S.hospMove && S.hospMove.id===id && !S.hospMove.bed) ? null : { id:id, bed:'' }; render(); };
  });
  // the same moves, dragged (a mouse; a phone uses the taps above)
  document.querySelectorAll('[data-hmove][draggable]').forEach(function(el){
    el.ondragstart=function(e){ try { e.dataTransfer.setData('text/plain', el.getAttribute('data-hmove')+'|'+el.getAttribute('data-hmovebed')); e.dataTransfer.effectAllowed='move'; } catch(x){} };
  });
  document.querySelectorAll('[data-hboard]').forEach(function(b){
    if(b.disabled) return;
    b.ondragover=function(e){ e.preventDefault(); b.classList.add('drop'); };
    b.ondragleave=function(){ b.classList.remove('drop'); };
    b.ondrop=function(e){
      e.preventDefault(); b.classList.remove('drop');
      var v=''; try { v=e.dataTransfer.getData('text/plain'); } catch(x){}
      var i=v.indexOf('|'); if(i<0) return;
      var id=v.slice(0,i), from=v.slice(i+1), to=b.getAttribute('data-hboard');
      if(to===from) return;
      move(id, from, to);
    };
  });
}

function hospHtml(){
  var h='<button class="linkbtn" id="hospBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Ministry'))+'</button>';
  h+='<h2>🌺 '+esc(t('SR Hospitality'))+'</h2>';
  h+='<div id="hospPage">';
  if(!canHospClient_()) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('SR Hospitality is for the Hospitality ministry and admins.'))+'</p></div></div>';
  var H=S.hosp;
  if(!H && S.hospError) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load SR Hospitality.'))+'</p>'+
    '<p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.hospError)+'</p><button class="btn ghost" id="hospRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div></div>';
  if(!H) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div></div>';
  if(S.hospForm) return h+hospFormHtml_(H)+'</div>';
  if(S.hospRoom) return h+hospRoomFormHtml_(H)+'</div>';
  var tab=['dash','req','cal','book','staff','rooms'].indexOf(S.hospTab)>-1 ? S.hospTab : 'dash';
  var nReq=hospOpenReqs_(H).length+hospGoneReqs_(H).length;
  h+='<div class="hospTabs">'+[['dash','📊','Overview'],['req','👥','Requests'],['cal','📅','Calendar'],['book','🛏','Bookings'],['staff','🛌','Staff'],['rooms','🏠','Rooms']].map(function(x){
    return '<button class="hospTab'+(tab===x[0]?' on':'')+'" data-hosptab="'+x[0]+'"><span>'+x[1]+'</span>'+esc(t(x[2]))+(x[0]==='req'&&nReq?' <b class="hospBadge">'+nReq+'</b>':'')+'</button>'; }).join('')+'</div>';
  if(tab==='req') h+=hospReqsHtml_(H);
  else if(tab==='cal') h+=hospCalTabHtml_(H);
  else if(tab==='book') h+=hospBookingsHtml_(H);
  else if(tab==='rooms') h+=hospRoomsHtml_(H);
  else if(tab==='staff') h+=hospStaffHtml_(H);
  else h+=hospDashHtml_(H);
  return h+'</div>';
}
/* Staff who live here, bed by bed: a name box on every bed, saved together.
   A name makes the bed taken from today on (a permanent staff booking —
   hospStaffBeds in api.js); clearing it frees the bed from today. A bed
   someone else has tonight or later shows who, and can't be given. */
function hospStaffMap_(H){
  var m={}, today=todayStr();
  H.bookings.forEach(function(k){ if(k.category==='staff' && k.permanent && (k.bedIds||[]).length===1 && k.from<=hospAdd_(today, 3650)) m[k.bedIds[0]]=k.name; });
  return m;
}
function hospStaffHtml_(H){
  if(!H.rooms.length) return '<div class="card slim"><p class="sub" style="margin:0">'+esc(t('No rooms set up yet'))+'</p></div>';
  var cur=hospStaffMap_(H), d=S.hospStaffDraft || (S.hospStaffDraft=Object.assign({}, cur)), today=todayStr();
  var other={};
  H.bookings.forEach(function(k){ if(k.category==='staff' && k.permanent && (k.bedIds||[]).length===1) return; if(hospEnd_(k)>today) (k.bedIds||[]).forEach(function(id){ if(!other[id]) other[id]=k; }); });
  var dirty=Object.keys(d).concat(Object.keys(cur)).some(function(id){ return (d[id]||'')!==(cur[id]||''); });
  var people=(S.roster||[]).filter(function(p){ return p.campus===S.me.campus; }).map(function(p){ return p.name; }).sort();
  var n=Object.keys(cur).length;
  var h='<p class="sub" style="margin:0 0 8px">'+esc(t('Type who lives in each bed. They stay there until you change it, and the bed shows as taken in every booking.'))+'</p>'+
    '<p class="hint" style="margin:0 0 10px" id="hospStaffCount">'+esc(gpT('{n} staff beds',{n:n}))+'</p>'+
    '<datalist id="hospStaffList">'+people.map(function(p){ return '<option value="'+esc(p)+'">'; }).join('')+'</datalist>';
  H.buildings.forEach(function(b){
    var rooms=H.rooms.filter(function(r){ return r.buildingId===b.id; });
    if(!rooms.length) return;
    h+='<div class="hospPickBld">'+esc(b.name)+'</div><div class="hospGrid">';
    rooms.forEach(function(r){
      h+='<div class="card slim hospStaffRoom"><div class="rowSub"><b>'+esc(r.name)+'</b> '+hospStyleTag_(r.style)+'</div>';
      r.beds.forEach(function(x){
        var o=other[x.id];
        h+='<label class="hospWhoRow hospStaffRow"><span>'+esc(x.label)+'</span>'+
          (x.out ? '<em class="hint">'+esc(t('Out of use'))+'</em>'
          : o && !d[x.id] ? '<em class="hint hospStaffTaken" data-staffheld="'+esc(x.id)+'">'+esc(gpT('{name} until {date}',{name:hospBedWho_(o, x.id), date:o.permanent?'—':hospDate_(o.to)}))+'</em>'
          : '<input type="text" list="hospStaffList" maxlength="120" data-hstaff="'+esc(x.id)+'" value="'+esc(d[x.id]||'')+'" placeholder="'+esc(t('Nobody'))+'">')+'</label>';
      });
      h+='</div>';
    });
    h+='</div>';
  });
  h+='<div class="schedActions hospStaffBar"><button class="btn" id="hospStaffSave"'+(dirty?'':' disabled')+'>'+esc(dirty ? t('Save staff beds') : t('Saved'))+'</button>'+
    (dirty ? '<button class="linkbtn" id="hospStaffUndo">'+esc(t('Undo changes'))+'</button>' : '')+'</div>';
  return h;
}
function hospBlank_(){ return { id:'', category:'guest', name:'', from:'', to:'', males:'', females:'', count:'', family:false, permanent:false, bedIds:[], bedNames:{}, people:[], notes:'', tripId:'', stayId:'' }; }
function hospErr_(d){
  var e=d && d.err;
  if(e==='bed_taken') return gpT('That bed is already taken by {name} on those nights.',{name:d.with||''});
  if(e==='bed_out') return t('One of those beds is out of use.');
  if(e==='already_booked') return t('This team already has a booking.');
  if(e==='not_empty') return t('Move or delete its rooms first.');
  if(e==='in_use') return t('Someone is still booked into this room.');
  if(e==='not_authorized') return t('SR Hospitality is for the Hospitality ministry and admins.');
  if(e==='bad_record') return t('Check the name and dates.');
  if(e==='empty') return t('No rooms found in that file.');
  if(e==='all_placed') return t('Everyone in this booking already has a bed.');
  if(e==='not_in_bed' || e==='not_found') return t('That booking changed — try again.');
  if(e==='same_bed') return t('They are already in that bed.');
  return t('Could not save');
}
function bindHosp(){
  var pg=document.getElementById('hospPage');
  var bk=document.getElementById('hospBack');
  if(bk) bk.onclick=function(){ S.view='ministry'; S.hospForm=null; S.hospRoom=null; S.hospBld=null; render(); };
  if(!pg) return;
  if(canHospClient_() && !S.hosp && !S.hospLoading && !S.hospError){
    S.hospLoading=true;
    run('getHospitality',[S.auth.user,S.auth.pin],function(d){
      S.hospLoading=false;
      if(d && d.ok) S.hosp=d; else S.hospError = hospErr_(d);
      render();
    }, function(e){ S.hospLoading=false; S.hospError=(e && e.message) || t('Connection problem — try again.'); render(); });
  }
  var rt=document.getElementById('hospRetry'); if(rt) rt.onclick=function(){ S.hospError=''; render(); };
  var put=function(d){ S.hosp=d; };
  var send=function(fn, args, done, btn){
    if(S.busy) return;
    S.busy=true; if(btn){ btn.disabled=true; }
    run(fn, [S.auth.user,S.auth.pin].concat(args), function(d){
      S.busy=false;
      if(d && d.ok){ put(d); if(done) done(d); }
      else showMsg(hospErr_(d));
      render();
    });
  };
  bindHospCal_(send);
  var top=function(id){ var el=document.getElementById(id); if(el) el.scrollIntoView({block:'start'}); };
  document.querySelectorAll('[data-hosptab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.hospTab=b.getAttribute('data-hosptab'); render(); }; });
  document.querySelectorAll('[data-hospperiod]').forEach(function(b){ b.onclick=function(){ gpTap(); S.hospPeriod=b.getAttribute('data-hospperiod'); render(); }; });
  var shift=function(n){ if((S.hospPeriod||'month')==='week') S.hospWeekOff=(S.hospWeekOff||0)+n; else S.hospYear=(S.hospYear||Number(todayStr().slice(0,4)))+n; render(); };
  var hp=document.getElementById('hospPrev'); if(hp) hp.onclick=function(){ gpTap(); shift(-1); };
  var hn=document.getElementById('hospNext'); if(hn) hn.onclick=function(){ gpTap(); shift(1); };
  document.querySelectorAll('[data-hospwhen]').forEach(function(b){ b.onclick=function(){ gpTap(); S.hospWhen=b.getAttribute('data-hospwhen'); render(); }; });
  document.querySelectorAll('[data-hospcat]').forEach(function(b){ b.onclick=function(){ gpTap(); S.hospCat=b.getAttribute('data-hospcat'); render(); }; });
  // bookings
  var nb=document.getElementById('hospNewBtn'); if(nb) nb.onclick=function(){ gpTap(); S.hospForm=hospBlank_(); S.hospBedPick=null; render(); top('hospFormCard'); };
  document.querySelectorAll('[data-hospedit]').forEach(function(b){ b.onclick=function(){
    var k=S.hosp.bookings.filter(function(x){ return x.id===b.getAttribute('data-hospedit'); })[0];
    if(!k) return; gpTap(); S.hospForm=JSON.parse(JSON.stringify(k)); S.hospBedPick=null; render(); top('hospFormCard'); }; });
  document.querySelectorAll('[data-hospfree]').forEach(function(b){ b.onclick=function(){
    var id=b.getAttribute('data-hospfree'), k=(S.hosp.bookings||[]).filter(function(x){ return x.id===id; })[0];
    if(!confirm(gpT('Free the beds booked for “{name}”? The booking is deleted.',{name:k ? k.name : ''}))) return;
    send('hospDelete', ['booking', id], function(){ showMsg(t('Beds freed')); }, b);
  }; });
  document.querySelectorAll('[data-hospstaydecline]').forEach(function(b){ b.onclick=function(){
    var q=(S.hosp.requests||[]).filter(function(x){ return x.stayId===b.getAttribute('data-hospstaydecline'); })[0];
    if(!confirm(gpT('Decline the request from “{name}”? It comes off the list.',{name:q ? q.name : ''}))) return;
    send('hospStayStatus', [b.getAttribute('data-hospstaydecline'), 'declined'], function(){ showMsg(t('Declined')); }, b);
  }; });
  var su=document.getElementById('hospStayUrl');
  var sc=document.getElementById('hospStayCopy');
  if(sc) sc.onclick=function(){ var done=function(){ showMsg(t('Link copied')); }; if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(su.value).then(done, function(){ su.select(); document.execCommand('copy'); done(); }); else { su.select(); document.execCommand('copy'); done(); } };
  var ss=document.getElementById('hospStayShare');
  if(ss) ss.onclick=function(){ navigator.share({ title:t('Stay with us'), text:t('Ask for a room at YWAM Siem Reap here:'), url:su.value }).catch(function(){}); };
  document.querySelectorAll('[data-hospbookreq]').forEach(function(b){ b.onclick=function(){
    var q=(S.hosp.requests||[]).filter(function(x){ return hospReqKey_(x)===b.getAttribute('data-hospbookreq'); })[0];
    if(!q) return; gpTap();
    S.hospBedPick=null;
    if(q.stayId) S.hospForm=Object.assign(hospBlank_(), { category:q.category==='speaker'?'speaker':'guest', name:q.name, from:q.from, to:q.to, males:q.males||'', females:q.females||'',
      count:hospReqNeed_(q)||'', notes:[q.org, q.phone, q.email, q.notes].filter(Boolean).join(' · '), stayId:q.stayId });
    else S.hospForm=Object.assign(hospBlank_(), { category:'team', name:q.name, from:q.from, to:q.to, males:q.males==null?'':q.males, females:q.females==null?'':q.females,
      count:hospReqNeed_(q)||'', tripId:q.tripId });
    render(); top('hospFormCard'); }; });
  /* staff beds */
  document.querySelectorAll('[data-hstaff]').forEach(function(inp){
    inp.oninput=function(){ S.hospStaffDraft=S.hospStaffDraft||{}; var v=inp.value.trim(); if(v) S.hospStaffDraft[inp.getAttribute('data-hstaff')]=v; else delete S.hospStaffDraft[inp.getAttribute('data-hstaff')];
      var sv=document.getElementById('hospStaffSave'); if(sv){ sv.disabled=false; sv.textContent=t('Save staff beds'); } };
  });
  var ssv=document.getElementById('hospStaffSave');
  if(ssv) ssv.onclick=function(){
    var cur=hospStaffMap_(S.hosp), d=S.hospStaffDraft||{}, map={};
    document.querySelectorAll('[data-hstaff]').forEach(function(inp){ map[inp.getAttribute('data-hstaff')]=(d[inp.getAttribute('data-hstaff')]||'').trim(); });
    Object.keys(cur).forEach(function(id){ if(!(id in map)) map[id]=d[id]||''; });
    send('hospStaffBeds', [map], function(){ S.hospStaffDraft=null; showMsg(t('Staff beds saved')); }, ssv);
  };
  var sud=document.getElementById('hospStaffUndo'); if(sud) sud.onclick=function(){ S.hospStaffDraft=null; render(); };
  var f=S.hospForm;
  if(f){
    document.querySelectorAll('[data-hf]').forEach(function(inp){
      var k=inp.getAttribute('data-hf');
      inp.oninput=function(){ f[k]=inp.value; };
      // dates and head counts change what's free and what fits: redraw on commit
      // (after the tap has landed, so the next box keeps its focus)
      if(inp.type==='date' || inp.type==='number') inp.onchange=function(){ f[k]=inp.value; setTimeout(function(){
        var ae=document.activeElement, key=ae && ae.getAttribute && ae.getAttribute('data-hf');
        render(); if(key){ var nx=document.querySelector('[data-hf="'+key+'"]'); if(nx) nx.focus(); } }, 0); };
    });
    document.querySelectorAll('[data-hfchk]').forEach(function(inp){ inp.onchange=function(){ f[inp.getAttribute('data-hfchk')]=inp.checked; render(); }; });
    document.querySelectorAll('[data-hfcat]').forEach(function(b){ b.onchange=function(){ gpTap(); var c=b.getAttribute('data-hfcat'); if(!b.checked && f.category!==c && !(c==='guest' && f.category==='speaker')){ render(); return; } if(!(c==='guest' && f.category==='speaker')) f.category=c; if(['staff','student','volunteer'].indexOf(f.category)===-1) f.permanent=false; render(); }; });
    document.querySelectorAll('[data-hbname]').forEach(function(inp){ inp.oninput=function(){ f.bedNames=f.bedNames||{}; var v=inp.value.trim(); if(v) f.bedNames[inp.getAttribute('data-hbname')]=v; else delete f.bedNames[inp.getAttribute('data-hbname')]; };
      inp.onchange=function(){ setTimeout(function(){ var ae=document.activeElement, key=ae && ae.getAttribute && ae.getAttribute('data-hbname'); render(); if(key){ var nx=document.querySelector('[data-hbname="'+key+'"]'); if(nx) nx.focus(); } }, 0); }; });
    var na=document.getElementById('hospNamesAuto');
    if(na) na.onclick=function(){ gpTap(); hospFillNames_(f); render(); };
    document.querySelectorAll('[data-hbed]').forEach(function(b){ b.onclick=function(){
      var id=b.getAttribute('data-hbed'), i=f.bedIds.indexOf(id);
      gpTap();
      if(hospNamesMode_(S.hosp, f)){
        /* tap a bed: it's yours and asks who sleeps in it; tap it again to open or close that */
        if(i===-1){ f.bedIds.push(id); S.hospBedPick=id; }
        else S.hospBedPick = S.hospBedPick===id ? null : id;
      } else {
        if(i>-1){ f.bedIds.splice(i,1); if(f.bedNames) delete f.bedNames[id]; } else f.bedIds.push(id);
      }
      render(); }; });
    document.querySelectorAll('[data-hbwho]').forEach(function(b){ b.onclick=function(){
      var p=b.getAttribute('data-hbwho').split('|'), bed=p[0], name=p.slice(1).join('|');
      gpTap(); f.bedNames=f.bedNames||{};
      if(f.bedNames[bed]===name){ delete f.bedNames[bed]; render(); return; }
      Object.keys(f.bedNames).forEach(function(k){ if(f.bedNames[k]===name) delete f.bedNames[k]; });   // one bed each
      f.bedNames[bed]=name; S.hospBedPick=null; render(); }; });
    var whoClear=document.getElementById('hospWhoClear'); if(whoClear) whoClear.onclick=function(){ if(f.bedNames) delete f.bedNames[S.hospBedPick]; render(); };
    var whoRemove=document.getElementById('hospWhoRemove'); if(whoRemove) whoRemove.onclick=function(){ gpTap(); var i=f.bedIds.indexOf(S.hospBedPick); if(i>-1) f.bedIds.splice(i,1); if(f.bedNames) delete f.bedNames[S.hospBedPick]; S.hospBedPick=null; render(); };
    var whoClose=document.getElementById('hospWhoClose'); if(whoClose) whoClose.onclick=function(){ S.hospBedPick=null; render(); };
    var ab=document.getElementById('hospAutoBtn');
    if(ab) ab.onclick=function(){
      if(!f.from || (!f.permanent && (!f.to || f.to<=f.from))){ showMsg(t('Enter the dates first.')); return; }
      gpTap(); var before=f.bedIds.length; f.bedIds=hospAutoPick_(S.hosp, f);
      if(f.bedIds.length===before) showMsg(t('No more free beds for those nights.'));
      if((f.people||[]).length) hospFillNames_(f);   // and puts the people in them
      render(); };
    /* the people of a school or team */
    var pplChanged=function(){ hospPeopleCount_(f); render(); };
    document.querySelectorAll('[data-hpname]').forEach(function(inp){ var i=+inp.getAttribute('data-hpname');
      inp.oninput=function(){ if(f.people[i]) f.people[i].name=inp.value; };
      inp.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); f.people.push({ name:'', sex:'' }); pplChanged(); var all=document.querySelectorAll('[data-hpname]'); if(all.length) all[all.length-1].focus(); } }; });
    document.querySelectorAll('[data-hpsex]').forEach(function(b){ b.onclick=function(){ var p=b.getAttribute('data-hpsex').split('|'), x=f.people[+p[0]]; if(!x) return; gpTap(); x.sex = x.sex===p[1] ? '' : p[1]; pplChanged(); }; });
    document.querySelectorAll('[data-hpdel]').forEach(function(b){ b.onclick=function(){ var i=+b.getAttribute('data-hpdel'), x=f.people[i]; if(!x) return; gpTap();
      f.people.splice(i,1); if(f.bedNames) Object.keys(f.bedNames).forEach(function(id){ if(f.bedNames[id]===x.name) delete f.bedNames[id]; }); pplChanged(); }; });
    var pa=document.getElementById('hospPersonAdd'); if(pa) pa.onclick=function(){ gpTap(); f.people=f.people||[]; f.people.push({ name:'', sex:'' }); pplChanged(); var all=document.querySelectorAll('[data-hpname]'); if(all.length) all[all.length-1].focus(); };
    var po=document.getElementById('hospPasteOpen'); if(po) po.onclick=function(){ gpTap(); S.hospPaste=!S.hospPaste; render(); var tx=document.getElementById('hospPasteText'); if(tx) tx.focus(); };
    var pc=document.getElementById('hospPasteCancel'); if(pc) pc.onclick=function(){ S.hospPaste=false; render(); };
    var pd=document.getElementById('hospPasteAdd'); if(pd) pd.onclick=function(){
      var tx=document.getElementById('hospPasteText'), have={}; f.people=(f.people||[]).filter(function(p){ return String(p.name).trim(); });
      f.people.forEach(function(p){ have[p.name.toLowerCase()]=1; });
      String(tx ? tx.value : '').split(/\n|;/).forEach(function(line){
        var l=line.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*)/, '').trim(), sex='';
        var m=l.match(/\s*[\(\[]?\s*(m|f|male|female|man|woman)\s*[\)\]]?\s*$/i);
        if(m && l.length>m[0].length){ sex=/^(f|female|woman)$/i.test(m[1]) ? 'f' : 'm'; l=l.slice(0, l.length-m[0].length).trim(); }
        l=l.replace(/[,;]+$/, '').slice(0, 80);
        if(l && !have[l.toLowerCase()]){ have[l.toLowerCase()]=1; f.people.push({ name:l, sex:sex }); }
      });
      S.hospPaste=false; gpTap(); pplChanged(); };
    var fp=document.getElementById('hospFromPortal'); if(fp) fp.onclick=function(){ gpTap(); f.people=(f.people||[]).filter(function(p){ return String(p.name).trim(); }); var have={};
      f.people.forEach(function(p){ have[p.name.toLowerCase()]=1; });
      hospPortalPeople_(S.hosp, f).forEach(function(p){ if(!have[p.name.toLowerCase()]) f.people.push({ name:p.name, sex:p.sex||'' }); }); pplChanged(); };
    var cc=document.getElementById('hospCancelBtn'); if(cc) cc.onclick=function(){ S.hospForm=null; render(); };
    var sv=document.getElementById('hospSaveBtn');
    if(sv) sv.onclick=function(){
      if(!(f.name||'').trim()){ showMsg(t('Give the booking a name first.')); return; }
      if(!f.from){ showMsg(t('Enter the arriving date.')); return; }
      if(!f.permanent && (!f.to || f.to<=f.from)){ showMsg(t('The leaving date has to be after the arriving date.')); return; }
      var num=function(v){ return v===''||v==null ? 0 : Number(v); };
      var doc={ id:f.id||'', category:f.category, name:f.name.trim(), from:f.from, to:f.permanent?'':f.to, permanent:!!f.permanent,
        males:num(f.males), females:num(f.females), count:hospFormCount_(f), family:!!f.family, bedIds:f.bedIds.slice(), bedNames:Object.assign({}, f.bedNames||{}), people:(f.people||[]).filter(function(p){ return String(p.name||'').trim(); }).map(function(p){ return { name:String(p.name).trim(), sex:p.sex||'' }; }), notes:f.notes||'', tripId:f.tripId||'', stayId:f.stayId||'' };
      send('hospSave', ['booking', doc], function(){ S.hospForm=null; showMsg(t('Booking saved')); }, sv);
    };
    var dl=document.getElementById('hospDeleteBtn');
    if(dl) dl.onclick=function(){
      if(!confirm(gpT('Delete the booking for “{name}”?',{name:f.name}))) return;
      send('hospDelete', ['booking', f.id], function(){ S.hospForm=null; showMsg(t('Booking deleted')); }, dl);
    };
  }
  // import from a spreadsheet
  var cf=document.getElementById('hospCsvFile');
  if(cf) cf.onchange=function(){
    var file=cf.files && cf.files[0]; if(!file) return;
    var rd=new FileReader();
    rd.onload=function(){ var res=hospCsvRows_(rd.result); S.hospImport={ file:file.name, rows:res.rows||null, err:res.err||'' }; render(); };
    rd.readAsText(file);
  };
  var ig=document.getElementById('hospImportGo');
  if(ig) ig.onclick=function(){
    var rows=S.hospImport && S.hospImport.rows; if(!rows) return;
    send('hospImport', [rows], function(d){ S.hospImport={ done:d.imported }; showMsg(t('Imported')); }, ig);
  };
  // buildings
  var abd=document.getElementById('hospAddBld'); if(abd) abd.onclick=function(){ gpTap(); S.hospBld={ id:'', name:'' }; render(); var i=document.getElementById('hospBldName'); if(i) i.focus(); };
  document.querySelectorAll('[data-hospbldedit]').forEach(function(b){ b.onclick=function(){
    var x=S.hosp.buildings.filter(function(y){ return y.id===b.getAttribute('data-hospbldedit'); })[0]; if(!x) return;
    S.hospBld={ id:x.id, name:x.name }; render(); top('hospBldForm'); }; });
  var bn=document.getElementById('hospBldName'); if(bn) bn.oninput=function(){ S.hospBld.name=bn.value; };
  var bc=document.getElementById('hospBldCancel'); if(bc) bc.onclick=function(){ S.hospBld=null; render(); };
  var bs=document.getElementById('hospBldSave');
  if(bs) bs.onclick=function(){
    if(!(S.hospBld.name||'').trim()){ showMsg(t('Give the building a name first.')); return; }
    send('hospSave', ['building', { id:S.hospBld.id, name:S.hospBld.name.trim() }], function(){ S.hospBld=null; }, bs);
  };
  document.querySelectorAll('[data-hospbldel]').forEach(function(b){ b.onclick=function(){
    if(!confirm(t('Delete this building?'))) return;
    send('hospDelete', ['building', b.getAttribute('data-hospbldel')], null, b); }; });
  // rooms
  document.querySelectorAll('[data-hospaddroom]').forEach(function(b){ b.onclick=function(){
    gpTap(); S.hospRoom={ id:'', buildingId:b.getAttribute('data-hospaddroom'), name:'', style:'mixed', notes:'', beds:[{label:'A'},{label:'B'}] }; render(); }; });
  document.querySelectorAll('[data-hosproom]').forEach(function(b){ b.onclick=function(){
    var r=S.hosp.rooms.filter(function(y){ return y.id===b.getAttribute('data-hosproom'); })[0]; if(!r) return;
    gpTap(); S.hospRoom=JSON.parse(JSON.stringify(r)); render(); }; });
  var rf=S.hospRoom;
  if(rf){
    document.querySelectorAll('[data-hrf]').forEach(function(inp){ var k=inp.getAttribute('data-hrf'); inp.oninput=function(){ rf[k]=inp.value; }; inp.onchange=inp.oninput; });
    document.querySelectorAll('[data-hrbed]').forEach(function(inp){ inp.oninput=function(){ rf.beds[Number(inp.getAttribute('data-hrbed'))].label=inp.value; }; });
    document.querySelectorAll('[data-hrout]').forEach(function(inp){ inp.onchange=function(){ rf.beds[Number(inp.getAttribute('data-hrout'))].out=inp.checked; }; });
    document.querySelectorAll('[data-hrdel]').forEach(function(b){ b.onclick=function(){ rf.beds.splice(Number(b.getAttribute('data-hrdel')),1); render(); }; });
    var adb=document.getElementById('hospAddBed');
    if(adb) adb.onclick=function(){
      var used={}; rf.beds.forEach(function(b){ used[b.label]=1; });
      var n=0, lab; do { lab=n<26 ? String.fromCharCode(65+n) : String(n+1); n++; } while(used[lab]);
      rf.beds.push({ label:lab }); render(); };
    var rc=document.getElementById('hospRoomCancel'); if(rc) rc.onclick=function(){ S.hospRoom=null; render(); };
    var rs=document.getElementById('hospRoomSave');
    if(rs) rs.onclick=function(){
      if(!(rf.name||'').trim()){ showMsg(t('Give the room a name or number first.')); return; }
      var doc={ id:rf.id, buildingId:rf.buildingId, name:rf.name.trim(), style:rf.style, notes:rf.notes||'',
        beds:rf.beds.filter(function(b){ return String(b.label||'').trim(); }).map(function(b){ return { id:b.id||'', label:String(b.label).trim(), out:!!b.out }; }) };
      send('hospSave', ['room', doc], function(){ S.hospRoom=null; showMsg(t('Room saved')); }, rs);
    };
    var rd=document.getElementById('hospRoomDelete');
    if(rd) rd.onclick=function(){
      if(!confirm(gpT('Delete room {name} and its beds?',{name:rf.name}))) return;
      send('hospDelete', ['room', rf.id], function(){ S.hospRoom=null; }, rd);
    };
  }
}

