/* My YWAM GP — teams.html, part 9 of 11: the finance tool.
   Oct 2026 (Uriah): "Build the finance tool for the accounting ministry … build the
   finance page around [our three reports] and then give all the leadership a base
   financial dashboard in their ministry page."

   Two screens, one set of numbers (getFinance in api.js):
   - The Finances office (Skills Training → Finances, on My Ministry): upload the
     month's PDFs — the Profit and Loss, the Burn Rate, the A/R Ageing (staff debt).
     finance.js reads them (pdf.js, kept in vendor/pdfjs and loaded the first time a
     PDF is picked); a preview shows what was read and whether it adds up to the
     report's own totals before anything is saved. The cash in the bank at the month's
     end is typed with the P&L (the reports don't have it, and the money ahead starts
     from it). Staff-debt names are matched to staff here, by the office alone.
   - Campus Leadership (every one of them, a "Finances" tab on their own row): the
     dashboard — the month, the year so far, the campus and new house's burn rate,
     staff debt (totals, and since Oct 2026 who owes and how much), and the money ahead. The office sees the same
     dashboard as a tab of its own, so it knows what leadership is looking at.
   Staff debt: leadership sees who owes and how much (Oct 2026); matching names to staff and
   the ageing PDF stay the office's.
   QuickBooks (Oct 2026): once the office connects their QuickBooks company (the card at the
   top of Reports), the Profit and Loss and the A/R Ageing come in by themselves every night —
   see "QuickBooks" in api.js. The Burn Rate is their own spreadsheet, so it's still uploaded. */
S.fin=null; S.qboWaiting=false; S.finLoading=false; S.finErr=''; S.finPending=[]; S.finMonth=null; S.finAheadEdit=null; S.finReading=0;
S.finTab=(lsGet('gp-fin-tab')==='dash' || lsGet('gp-fin-tab')==='numbers' ? lsGet('gp-fin-tab') : 'reports');
function finCanEditClient_(){ return typeof canEnterStaffDebtClient_==='function' && canEnterStaffDebtClient_(); }
function finLoad_(force){
  if(S.finLoading || (S.fin && !force)) return;
  S.finLoading=true;
  run('getFinance',[S.auth.user,S.auth.pin],function(d){ S.finLoading=false; if(d && d.ok){ S.fin=d; S.finErr=''; if(d.qbo && d.qbo.connected) S.qboWaiting=false; } else S.finErr=(d && d.err) || 'error'; if(S.view==='ministry') render(); },
    function(){ S.finLoading=false; S.finErr='offline'; if(S.view==='ministry') render(); });
}
function finPut_(d){ if(d && d.ok){ S.fin=d; return true; } return false; }
/* Back from signing in to QuickBooks in the other window: look again. */
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible' && S.qboWaiting && S.auth) finLoad_(true); });
function finFail_(d){
  var e=d && d.err;
  return e==='too_large' ? t('That file is too big — keep it under 4 MB.') : e==='not_authorized' ? t('Only the Finances office can do that.') :
    e==='bad_date' ? t('The report needs its date.') : e==='bad_year' ? t('Choose the year this burn rate is for.') : t('Could not save — try again.');
}

/* ---------- money and months ---------- */
function finMoney_(v, cents){
  var n=Number(v)||0, a=Math.abs(n);
  var s=cents ? a.toLocaleString('en-US',{ minimumFractionDigits:2, maximumFractionDigits:2 }) : Math.round(a).toLocaleString('en-US');
  return (n<0 && (cents ? a>=0.005 : Math.round(a)>0) ? '−' : '')+'$'+s;
}
function finCompact_(v){ var a=Math.abs(v); return (v<0?'−':'')+'$'+(a>=1000 ? (Math.round(a/100)/10)+'K' : Math.round(a)); }
function finMonthName_(ym){ return t(MONTH_SHORT[Number(String(ym).slice(5,7))-1]||'')+' '+String(ym).slice(0,4); }
function finMonthsOf_(F){ return Object.keys((F && F.pl) || {}).sort(); }
function finLatestMonth_(F){ var m=finMonthsOf_(F); return m.length ? m[m.length-1] : null; }
function finDate_(iso){ if(!iso) return ''; var d=new Date(String(iso).length<=10 ? iso+'T12:00:00' : iso); return isNaN(d) ? '' : t(MONTH_SHORT[d.getMonth()])+' '+d.getDate()+', '+d.getFullYear(); }
/* The cash in the bank most recently entered, and the month it was for. */
function finCash_(F){ var ms=finMonthsOf_(F).filter(function(k){ return F.pl[k].cash!=null; }); var k=ms[ms.length-1]; return k ? { ym:k, value:F.pl[k].cash } : null; }

/* A year, month by month: what came in and went out for the whole organisation —
   from the P&L where there is one, else from the burn rate's whole-organisation
   rows (the office's own totals, the same ones the P&L adds up to). */
function finYear_(F, yr){
  var b=F.burn && F.burn[String(yr)] ? GP_FIN.burnSeries(F.burn[String(yr)]) : null;
  var out=[];
  for(var i=0;i<12;i++){
    var ym=yr+'-'+('0'+(i+1)).slice(-2), m=F.pl && F.pl[ym], row={ ym:ym, i:i, inn:null, out:null, net:null, src:'' };
    if(m){ var tt=GP_FIN.plTotals(m.lines, ym); row.inn=tt.income; row.out=tt.spend; row.net=tt.net; row.src='pl'; }
    else if(b && b.orgIn && b.orgOut && b.orgIn[i]!=null && b.orgOut[i]!=null && b.actual[i]){ row.inn=b.orgIn[i]; row.out=b.orgOut[i]; row.net=Math.round((b.orgIn[i]-b.orgOut[i])*100)/100; row.src='burn'; }
    out.push(row);
  }
  return out;
}

/* ---------- charts (inline SVG; tokens only, so both themes work) ----------
   Columns, two series (in / out) a month, a shared tooltip (#finTip) on each month's
   band, and a table twin under every chart. Planned months are drawn lighter and
   say so in the legend and the tooltip. */
function finNice_(max){ if(max<=0) return 1; var p=Math.pow(10, Math.floor(Math.log(max)/Math.LN10)), f=max/p; return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p; }
function finBarPath_(x, y0, w, h){
  if(h<=0.5) return '';
  var r=Math.min(3, w/2, h);
  return 'M'+x+','+y0+'V'+(y0-h+r)+'Q'+x+','+(y0-h)+' '+(x+r)+','+(y0-h)+'H'+(x+w-r)+'Q'+(x+w)+','+(y0-h)+' '+(x+w)+','+(y0-h+r)+'V'+y0+'Z';
}
function finColsHtml_(id, title, series, labels, planned, tips){
  var W=340, H=170, L=38, T=8, B=22, PH=H-T-B, n=labels.length, band=(W-L)/n;
  var max=0; series.forEach(function(s){ s.vals.forEach(function(v){ if(v!=null && v>max) max=v; }); });
  var top=finNice_(max*1.05/4)*4, y0=T+PH;   // four even steps of a round number ($0 / $2.5K / $5K …)
  var bw=Math.min(9, (band-6)/series.length-2);
  var svg='<svg class="finSvg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(title)+'">';
  for(var g=0; g<=4; g++){ var gy=T+PH-PH*g/4; svg+='<line x1="'+L+'" x2="'+W+'" y1="'+gy+'" y2="'+gy+'" class="finGrid"/>'+
    '<text x="'+(L-5)+'" y="'+(gy+3.5)+'" text-anchor="end" class="finAxis">'+esc(finCompact_(top*g/4))+'</text>'; }
  labels.forEach(function(lab, i){
    var cx=L+band*i+band/2, gw=series.length*bw+(series.length-1)*2, x=cx-gw/2;
    series.forEach(function(s, si){
      var v=s.vals[i]; if(v==null) return;
      svg+='<path d="'+finBarPath_(x+si*(bw+2), y0, bw, Math.max(0, v)/top*PH)+'" class="finBar '+s.cls+(planned && planned[i]?' planned':'')+'"/>';
    });
    svg+='<text x="'+cx+'" y="'+(H-7)+'" text-anchor="middle" class="finAxis">'+esc(lab)+'</text>';
    if(tips && tips[i]) svg+='<rect x="'+(L+band*i)+'" y="'+T+'" width="'+band+'" height="'+(PH+B)+'" class="finHit" tabindex="0" data-fintip="'+esc(JSON.stringify(tips[i]))+'"/>';
  });
  svg+='</svg>';
  var legend='<div class="finLegend">'+series.map(function(s){ return '<span><i class="finKey '+s.cls+'"></i>'+esc(s.label)+'</span>'; }).join('')+
    (planned && planned.some(Boolean) ? '<span><i class="finKey '+series[0].cls+' planned"></i>'+esc(t('planned'))+'</span>' : '')+'</div>';
  var table='<details class="finTable"><summary>'+esc(t('Show as a table'))+'</summary><table><thead><tr><th></th>'+series.map(function(s){ return '<th>'+esc(s.label)+'</th>'; }).join('')+'</tr></thead><tbody>'+
    labels.map(function(lab, i){ if(series.every(function(s){ return s.vals[i]==null; })) return '';
      return '<tr><th>'+esc(lab)+(planned && planned[i]?' · '+esc(t('planned')):'')+'</th>'+series.map(function(s){ return '<td>'+(s.vals[i]==null?'—':esc(finMoney_(s.vals[i])))+'</td>'; }).join('')+'</tr>'; }).join('')+
    '</tbody></table></details>';
  return '<div class="finChart" id="'+id+'">'+legend+svg+table+'</div>';
}
/* Horizontal bars, one series: where the money went (or came from). */
function finBarsHtml_(rows, cls, max){
  if(!rows.length) return '<p class="sub" style="margin:0">'+esc(t('Nothing in this month.'))+'</p>';
  var top=max || rows.reduce(function(a, r){ return Math.max(a, r.amt); }, 0) || 1;
  return '<div class="finBars">'+rows.map(function(r){
    var pct=Math.max(0, Math.min(100, r.amt/top*100));
    return '<div class="finBarRow"><div class="finBarName">'+esc(r.name)+'</div><div class="finBarTrack"><i class="'+cls+'" style="width:'+pct.toFixed(1)+'%"></i><b>'+esc(finMoney_(r.amt))+'</b></div></div>';
  }).join('')+'</div>';
}
function finTipShow_(el){
  var tip=document.getElementById('finTip');
  if(!tip){ tip=document.createElement('div'); tip.id='finTip'; tip.setAttribute('role','status'); document.body.appendChild(tip); }
  var d; try { d=JSON.parse(el.getAttribute('data-fintip')); } catch(e){ return; }
  tip.textContent='';
  var h=document.createElement('div'); h.className='finTipHead'; h.textContent=d.t; tip.appendChild(h);
  (d.r||[]).forEach(function(r){
    var row=document.createElement('div'); row.className='finTipRow';
    if(r.c){ var k=document.createElement('i'); k.className='finTipKey '+r.c; row.appendChild(k); }
    var b=document.createElement('b'); b.textContent=r.v; row.appendChild(b);
    var s=document.createElement('span'); s.textContent=r.l; row.appendChild(s);
    tip.appendChild(row);
  });
  var rc=el.getBoundingClientRect();
  tip.style.display='block';
  var tw=tip.offsetWidth, x=Math.max(8, Math.min(window.innerWidth-tw-8, rc.left+rc.width/2-tw/2));
  tip.style.left=x+'px'; tip.style.top=Math.max(8, rc.top-tip.offsetHeight-6)+'px';
}
function finTipHide_(){ var tip=document.getElementById('finTip'); if(tip) tip.style.display='none'; }

/* ---------- the dashboard ---------- */
function finDashHtml_(){
  finLoad_();
  var F=S.fin, h='<div id="finDash">';
  if(!F) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.finErr==='not_authorized' ? t('Base finances are for Campus Leadership and the Finances office.') : S.finErr ? t('Couldn’t load this — pull down to try again.') : t('Loading…'))+'</p></div></div>';
  var months=finMonthsOf_(F), latest=finLatestMonth_(F);
  var burnYears=Object.keys(F.burn||{}).sort(), hasDebt=!!F.debt;
  if(!latest && !burnYears.length && !hasDebt){
    h+='<div class="card"><div class="goalCardTitle" style="margin-bottom:4px">💵 '+esc(t('Base finances'))+'</div><p class="sub" style="margin:0">'+
      esc(t('Nothing from the Finances office yet. Once they upload the month’s reports or connect QuickBooks, the numbers show here.'))+'</p></div>';
    return h+finAheadHtml_(F)+'</div>';
  }
  var ym=(S.finMonth && F.pl[S.finMonth]) ? S.finMonth : latest;
  /* the month: one picker above everything it changes */
  if(months.length>1) h+='<div class="finPick"><label for="finMonthSel">'+esc(t('Month'))+'</label><select id="finMonthSel">'+months.slice().reverse().map(function(k){ return '<option value="'+k+'"'+(k===ym?' selected':'')+'>'+esc(finMonthName_(k))+'</option>'; }).join('')+'</select></div>';
  if(ym){
    var M=F.pl[ym], tt=GP_FIN.plTotals(M.lines, ym), prevK=months[months.indexOf(ym)-1], pt=prevK ? GP_FIN.plTotals(F.pl[prevK].lines, prevK) : null;
    var delta=function(cur, prev, upGood){ if(prev==null) return ''; var dd=cur-prev; if(Math.abs(dd)<0.5) return '<div class="mmTileSub">'+esc(gpT('same as {month}',{month:finMonthName_(prevK)}))+'</div>';
      var good=upGood ? dd>0 : dd<0;
      return '<div class="mmTileSub '+(good?'finGood':'finBad')+'">'+(dd>0?'▲ ':'▼ ')+esc(gpT('{money} vs {month}',{money:finMoney_(Math.abs(dd)), month:finMonthName_(prevK)}))+'</div>'; };
    h+='<div class="card finHead"><div class="goalCardTitle" style="margin-bottom:2px">💵 '+esc(gpT('Base finances · {month}',{month:finMonthName_(ym)}))+'</div>'+
      '<p class="hint" style="margin:0">'+(M.src==='qbo' ? esc(gpT('From QuickBooks · brought in {date}',{date:finDate_(M.at)})) : esc(gpT('From the Finances office’s Profit and Loss · uploaded {date}',{date:finDate_(M.at)}))+(M.by?' · '+esc(M.by):''))+'</p>'+
      (M.fileId ? '<button class="linkbtn inline" data-finfile="'+esc(M.fileId)+'" style="margin:6px 0 0">📄 '+esc(t('Open the P&L'))+'</button>' : '')+'</div>';
    h+='<div class="mmGrid finTiles">'+
      '<div class="mmTile"><div class="mmTileName">'+esc(t('Came in'))+'</div><div class="mmTileNum">'+esc(finMoney_(tt.income))+'</div>'+delta(tt.income, pt && pt.income, true)+'</div>'+
      '<div class="mmTile"><div class="mmTileName">'+esc(t('Went out'))+'</div><div class="mmTileNum">'+esc(finMoney_(tt.spend))+'</div>'+delta(tt.spend, pt && pt.spend, false)+'</div>'+
      '<div class="mmTile '+(tt.net<0?'finNeg':'finPos')+'"><div class="mmTileName">'+esc(t('Net for the month'))+'</div><div class="mmTileNum">'+esc(finMoney_(tt.net))+'</div><div class="mmTileSub">'+(tt.net<0 ? '▼ '+esc(t('spent more than came in')) : '▲ '+esc(t('more came in than went out')))+'</div></div>'+
      (M.cash!=null ? '<div class="mmTile"><div class="mmTileName">'+esc(t('Cash in the bank'))+'</div><div class="mmTileNum">'+esc(finMoney_(M.cash))+'</div><div class="mmTileSub">'+esc(gpT('at the end of {month}',{month:finMonthName_(ym)}))+'</div></div>'
        : '<div class="mmTile empty"><div class="mmTileName">'+esc(t('Cash in the bank'))+'</div><div class="mmTileNum">—</div><div class="mmTileSub">'+esc(t('not entered for this month'))+'</div></div>')+
    '</div>';
    /* the year so far */
    var yr=Number(ym.slice(0,4)), Y=finYear_(F, yr), upTo=Number(ym.slice(5,7));
    var ytd=Y.slice(0, upTo).filter(function(r){ return r.inn!=null; });
    var ti=ytd.reduce(function(a, r){ return a+r.inn; }, 0), to=ytd.reduce(function(a, r){ return a+r.out; }, 0);
    var labels=MONTH_SHORT.map(function(m){ return t(m).slice(0,3); });
    var tips=Y.map(function(r){ if(r.inn==null) return null;
      return { t:finMonthName_(r.ym)+(r.src==='burn' ? ' · '+t('from the burn rate') : ''), r:[{ c:'in', v:finMoney_(r.inn), l:t('came in') }, { c:'out', v:finMoney_(r.out), l:t('went out') }, { v:finMoney_(r.net), l:t('net') }] }; });
    h+='<div class="card"><div class="goalCardTitle" style="margin-bottom:2px">📅 '+esc(gpT('{year} so far',{year:yr}))+'</div>'+
      '<p class="sub" style="margin:0 0 6px">'+esc(gpT('{n} months in: {inn} came in, {out} went out — {net} for the year.',{ n:ytd.length, inn:finMoney_(ti), out:finMoney_(to), net:finMoney_(ti-to) }))+'</p>'+
      finColsHtml_('finYearChart', gpT('Came in and went out, month by month, {year}',{year:yr}),
        [{ label:t('Came in'), cls:'in', vals:Y.map(function(r){ return r.inn; }) }, { label:t('Went out'), cls:'out', vals:Y.map(function(r){ return r.out; }) }], labels, null, tips)+
      (Y.some(function(r){ return r.src==='burn'; }) ? '<p class="hint" style="margin:4px 0 0">'+esc(t('Months without a P&L here come from the burn rate’s whole-organisation totals.'))+'</p>' : '')+'</div>';
    /* where it went, where it came from */
    var outs=GP_FIN.plRollup(M.lines, ym, 'out'), ins=GP_FIN.plRollup(M.lines, ym, 'in');
    var top=Math.max(outs.length ? outs[0].amt : 0, ins.length ? ins[0].amt : 0);
    h+='<div class="card"><div class="goalCardTitle" style="margin-bottom:8px">↗️ '+esc(gpT('Where it went in {month}',{month:finMonthName_(ym)}))+'</div>'+finBarsHtml_(outs, 'out', top)+'</div>';
    h+='<div class="card"><div class="goalCardTitle" style="margin-bottom:8px">↙️ '+esc(gpT('Where it came from in {month}',{month:finMonthName_(ym)}))+'</div>'+finBarsHtml_(ins, 'in', top)+'</div>';
  }
  h+=finBurnHtml_(F, ym);
  h+=finDebtDashHtml_(F);
  h+=finAheadHtml_(F);
  return h+'</div>';
}
/* The campus and new house: what it costs to run, what the teams, staff, students and
   ministries put in, and the plan for the months ahead. */
function finBurnHtml_(F, ym){
  var years=Object.keys(F.burn||{}).sort(); if(!years.length) return '';
  var yr=ym && F.burn[ym.slice(0,4)] ? ym.slice(0,4) : years[years.length-1], B=F.burn[yr], s=GP_FIN.burnSeries(B);
  if(!s.campusCost) return '';
  var last=-1; for(var i=0;i<12;i++) if(s.actual[i] && s.campusCost[i]!=null) last=i;
  if(ym && ym.slice(0,4)===yr){ var mi=Number(ym.slice(5,7))-1; if(s.actual[mi] && s.campusCost[mi]!=null) last=mi; }
  var h='<div class="card" id="finBurn"><div class="goalCardTitle" style="margin-bottom:2px">🏠 '+esc(t('The campus and new house'))+'</div>'+
    '<p class="hint" style="margin:0 0 8px">'+esc(gpT('From the burn rate, {year}',{year:yr}))+' · '+esc(finDate_(B.at))+
    (B.fileId ? ' · <button class="linkbtn inline" data-finfile="'+esc(B.fileId)+'" style="margin:0">📄 '+esc(t('Open the burn rate'))+'</button>' : '')+'</p>';
  if(last>-1){
    // rounded down, so 99.6% never reads as fully covered
    var cost=s.campusCost[last]||0, inn=s.campusIn ? (s.campusIn[last]||0) : 0, cov=cost ? Math.floor(inn/cost*100) : 0;
    h+='<div class="mmGrid finTiles">'+
      '<div class="mmTile"><div class="mmTileName">'+esc(gpT('Cost to run, {month}',{month:t(MONTH_SHORT[last])}))+'</div><div class="mmTileNum">'+esc(finMoney_(cost))+'</div></div>'+
      '<div class="mmTile"><div class="mmTileName">'+esc(gpT('Contributions, {month}',{month:t(MONTH_SHORT[last])}))+'</div><div class="mmTileNum">'+esc(finMoney_(inn))+'</div></div></div>'+
      '<div class="finMeterLabel"><b>'+cov+'%</b> '+esc(t('of the cost was covered by contributions'))+(inn<cost-0.5 ? ' · '+esc(gpT('{money} short',{money:finMoney_(cost-inn)})) : '')+'</div>'+
      '<div class="finMeter" role="img" aria-label="'+esc(cov+'%')+'"><i style="width:'+Math.min(100, cov)+'%"></i></div>';
    /* the year's difference: what is in, and what the plan says for the rest */
    var diffA=0, diffP=0, anyP=false;
    for(var m=0;m<12;m++){ if(s.campusIn && s.campusIn[m]!=null && s.campusCost[m]!=null){ var dd=s.campusIn[m]-s.campusCost[m]; if(s.actual[m]) diffA+=dd; else { diffP+=dd; anyP=true; } } }
    h+='<p class="sub" style="margin:8px 0 6px">'+esc(gpT('So far this year contributions have come to {money} {more} the cost.',{ money:finMoney_(Math.abs(diffA)), more: diffA>=0 ? t('more than') : t('less than') }))+
      (anyP ? ' '+esc(gpT('With the months planned, the year ends {money} {where}.',{ money:finMoney_(Math.abs(diffA+diffP)), where: diffA+diffP>=0 ? t('ahead') : t('behind') })) : '')+'</p>';
  }
  var labels=MONTH_SHORT.map(function(m){ return t(m).slice(0,3); }), planned=s.actual.map(function(a){ return !a; });
  var tips=s.campusCost.map(function(v, i){ if(v==null && !(s.campusIn && s.campusIn[i]!=null)) return null;
    return { t:t(MONTH_SHORT[i])+' '+yr+(planned[i] ? ' · '+t('planned') : ''), r:[{ c:'out', v:finMoney_(v||0), l:t('cost to run') }, { c:'in', v:finMoney_(s.campusIn ? s.campusIn[i]||0 : 0), l:t('contributions') }] }; });
  h+=finColsHtml_('finBurnChart', t('Cost to run and contributions, month by month'),
    [{ label:t('Cost to run'), cls:'out', vals:s.campusCost }, { label:t('Contributions'), cls:'in', vals:s.campusIn || s.campusCost.map(function(){ return null; }) }], labels, planned, tips);
  /* what each part costs: this month against the three before it */
  if(last>-1 && s.cats.length){
    h+='<div class="finCats"><div class="finCatHead"><span></span><span>'+esc(t(MONTH_SHORT[last]))+'</span><span>'+esc(t('3-month average'))+'</span></div>';
    s.cats.forEach(function(c){
      var prev=[]; for(var k=last-1;k>=0 && prev.length<3;k--) if(s.actual[k] && c.vals[k]!=null) prev.push(c.vals[k]);
      var avg=prev.length ? prev.reduce(function(a, b){ return a+b; }, 0)/prev.length : null, cur=c.vals[last];
      var up=avg!=null && cur!=null && cur>avg*1.15, down=avg!=null && cur!=null && cur<avg*0.85;
      h+='<div class="finCatRow"><span>'+esc(c.label)+'</span><span>'+(cur==null?'—':esc(finMoney_(cur)))+(up?' <em class="finBad">▲ '+esc(t('up'))+'</em>':down?' <em class="finGood">▼ '+esc(t('down'))+'</em>':'')+'</span><span>'+(avg==null?'—':esc(finMoney_(avg)))+'</span></div>';
    });
    h+='</div>';
  }
  if(s.incCats.length && last>-1){
    h+='<details class="pulseMore"><summary>'+esc(t('Where the contributions came from'))+'</summary>'+
      finBarsHtml_(s.incCats.map(function(c){ return { name:c.label, amt:c.vals[last]||0 }; }).filter(function(r){ return r.amt; }), 'in')+'</details>';
  }
  return h+'</div>';
}
/* Staff debt, as totals only: how much, how many, how old, which departments. */
function finDebtDashHtml_(F){
  var D=F.debt; if(!D) return '';
  var hist=F.debtHist||[], prev=null;
  for(var i=hist.length-1;i>=0;i--) if(hist[i].asOf<D.asOf){ prev=hist[i]; break; }
  var h='<div class="card" id="finDebt"><div class="goalCardTitle" style="margin-bottom:2px">💳 '+esc(t('Staff debt'))+'</div>'+
    '<p class="hint" style="margin:0 0 8px">'+esc(gpT('From the A/R ageing report, as of {date}',{date:finDate_(D.asOf)}))+'</p>';
  h+='<div class="mmGrid finTiles"><div class="mmTile"><div class="mmTileName">'+esc(t('Owed by staff'))+'</div><div class="mmTileNum">'+esc(finMoney_(D.total))+'</div>'+
    (prev ? '<div class="mmTileSub '+(D.total>prev.total?'finBad':'finGood')+'">'+(D.total>prev.total?'▲ ':'▼ ')+esc(gpT('{money} since {date}',{money:finMoney_(Math.abs(D.total-prev.total)), date:finDate_(prev.asOf)}))+'</div>' : '')+'</div>'+
    '<div class="mmTile"><div class="mmTileName">'+esc(t('Names'))+'</div><div class="mmTileNum">'+D.people+'</div><div class="mmTileSub">'+esc(t('a couple is one name'))+'</div></div></div>';
  var tot=D.vals.reduce(function(a, b){ return a+Math.max(0, b); }, 0) || 1;
  h+='<div class="finStackLabel">'+esc(t('How old it is'))+'</div><div class="finStack" role="img" aria-label="'+esc(D.cols.map(function(c, i){ return c+' '+finMoney_(D.vals[i]); }).join(', '))+'">'+
    D.vals.map(function(v, i){ var w=Math.max(0, v)/tot*100; return w>0 ? '<i class="age'+Math.min(5, i+1)+'" style="width:'+w.toFixed(2)+'%" title="'+esc(D.cols[i]+': '+finMoney_(v))+'"></i>' : ''; }).join('')+'</div>'+
    '<div class="finLegend finAgeLegend">'+D.cols.map(function(c, i){ return '<span><i class="finKey age'+Math.min(5, i+1)+'"></i>'+esc(c)+' <b>'+esc(finMoney_(D.vals[i]))+'</b></span>'; }).join('')+'</div>';
  var depts=Object.keys(D.byDept||{}).sort(function(a, b){ return D.byDept[b]-D.byDept[a]; });
  if(depts.length || D.unmatched){
    h+='<div class="finStackLabel" style="margin-top:10px">'+esc(t('By department'))+'</div>'+depts.map(function(d){ return '<div class="cafeLine"><span>'+esc(t(d))+'</span><b>'+esc(finMoney_(D.byDept[d]))+'</b></div>'; }).join('')+
      (D.unmatched ? '<div class="cafeLine"><span class="hint" style="margin:0">'+esc(t('Not matched to anyone on staff yet'))+'</span><b>'+esc(finMoney_(D.unmatched))+'</b></div>' : '');
  }
  /* who owes and how much — every name on the report, biggest first, with how old the oldest of it is */
  var P=F.debtPeople||[];
  if(P.length){
    var row=function(r){
      var old=-1; (r.vals||[]).forEach(function(v, i){ if(v>0.004) old=i; });
      var sub=[r.dept ? t(r.dept) : t('Not matched to anyone on staff yet')].concat(old>-1 && D.cols[old] ? [gpT('oldest: {age}',{age:D.cols[old]})] : []).join(' · ');
      return '<div class="finOwes"><div><div class="rowName">'+esc(r.name)+'</div><div class="rowSub">'+esc(sub)+'</div></div><b class="'+(r.total<0?'finGood':'')+'">'+esc(finMoney_(r.total, true))+'</b></div>';
    };
    h+='<div class="finStackLabel" style="margin-top:12px">'+esc(gpT('Who owes · {n}',{n:P.length}))+'</div><div class="finOwesList">'+P.slice(0, 8).map(row).join('')+'</div>';
    if(P.length>8) h+='<details class="pulseMore"><summary>'+esc(gpT('{n} more',{n:P.length-8}))+'</summary><div class="finOwesList">'+P.slice(8).map(row).join('')+'</div></details>';
  }
  return h+'</div>';
}
/* The money ahead: from the cash in the bank, month by month, with what's expected
   in and out. It used to sit behind the leadership code; it is Campus Leadership's
   now, signed in, and starts from the cash the office enters with the P&L. */
function finAheadMonths_(n){ var d=new Date(), out=[]; d.setDate(1); for(var i=0;i<n;i++){ out.push(d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)); d.setMonth(d.getMonth()+1); } return out; }
function finProject_(F){
  if(!F) return null;
  var c=finCash_(F), bal=c ? Number(c.value) : 0, short='', E=S.finAheadEdit || (F.ahead && F.ahead.months) || {};
  var rows=finAheadMonths_(6).map(function(k){ var m=E[k]||{}; bal+=(Number(m.inc)||0)-(Number(m.exp)||0); if(bal<0 && !short) short=k; return { k:k, bal:bal }; });
  return { rows:rows, end:bal, short:short, cash:c };
}
function finAheadHtml_(F){
  var E=S.finAheadEdit || (S.finAheadEdit=JSON.parse(JSON.stringify((F.ahead && F.ahead.months) || {})));
  var pj=finProject_(F), c=pj.cash;
  /* a guide for the boxes: the last three months' average, from the P&L */
  var ms=finMonthsOf_(F).slice(-3), avgIn=null, avgOut=null;
  if(ms.length){ avgIn=0; avgOut=0; ms.forEach(function(k){ var tt=GP_FIN.plTotals(F.pl[k].lines, k); avgIn+=tt.income; avgOut+=tt.spend; }); avgIn=Math.round(avgIn/ms.length); avgOut=Math.round(avgOut/ms.length); }
  var h='<div class="card" id="leadMoney"><div class="goalCardTitle" style="margin-bottom:4px">🔭 '+esc(t('Money ahead'))+'</div>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(c ? gpT('Starts from the cash in the bank at the end of {month}: {money}.',{month:finMonthName_(c.ym), money:finMoney_(c.value)}) : t('The Finances office hasn’t entered the cash in the bank yet, so this starts from $0.'))+'</p>';
  var bal=c ? Number(c.value) : 0, short='';
  h+='<div class="lmTable"><div class="lmRow lmHead"><span></span><span>'+esc(t('Coming in'))+'</span><span>'+esc(t('Going out'))+'</span><span>'+esc(t('Balance'))+'</span></div>'+finAheadMonths_(6).map(function(k){
      var m=E[k]||{}; bal+=(Number(m.inc)||0)-(Number(m.exp)||0); if(bal<0 && !short) short=k;
      return '<div class="lmRow"><span>'+esc(finMonthName_(k).replace(/ (\d\d)(\d\d)$/, ' $2'))+'</span>'+
        '<input type="number" inputmode="numeric" min="0" step="1" data-finahead="'+k+'|inc" value="'+(m.inc!=null?esc(String(m.inc)):'')+'"'+(avgIn!=null?' placeholder="'+avgIn+'"':'')+' aria-label="'+esc(t('Coming in'))+'">'+
        '<input type="number" inputmode="numeric" min="0" step="1" data-finahead="'+k+'|exp" value="'+(m.exp!=null?esc(String(m.exp)):'')+'"'+(avgOut!=null?' placeholder="'+avgOut+'"':'')+' aria-label="'+esc(t('Going out'))+'">'+
        '<span class="lmBal'+(bal<0?' bad':'')+'">'+esc(finMoney_(bal))+'</span></div>'; }).join('')+'</div>';
  h+='<p class="lmSum'+(short?' bad':'')+'">'+esc(short ? gpT('At this rate the money runs short in {month}.',{month:finMonthName_(short)}) : gpT('In six months: {money}',{money:finMoney_(bal)}))+'</p>';
  if(avgIn!=null) h+='<p class="hint" style="margin:0 0 8px">'+esc(gpT('The grey numbers are the last {n} months’ average, from the P&L — type your own for each month.',{n:ms.length}))+'</p>';
  return h+'<button class="btn" id="finAheadSave">'+esc(t('Save'))+'</button></div>';
}
function finAheadRecalc_(){
  var pj=finProject_(S.fin); if(!pj) return;
  var spans=document.querySelectorAll('#leadMoney .lmBal');
  pj.rows.forEach(function(r, i){ if(spans[i]){ spans[i].textContent=finMoney_(r.bal); spans[i].classList.toggle('bad', r.bal<0); } });
  var sum=document.querySelector('#leadMoney .lmSum'); if(sum){ sum.textContent=pj.short ? gpT('At this rate the money runs short in {month}.',{month:finMonthName_(pj.short)}) : gpT('In six months: {money}',{money:finMoney_(pj.end)}); sum.classList.toggle('bad', !!pj.short); }
}

/* ---------- the Finances office: the reports ---------- */
var FIN_KINDS_={ pl:['📊','Profit and Loss'], burn:['🏠','Burn rate'], debt:['💳','Staff debt (A/R ageing)'] };
function finPdfLib_(cb, fail){
  if(window.pdfjsLib) return cb(window.pdfjsLib);
  var s=document.createElement('script'); s.src='vendor/pdfjs/pdf.min.js';
  s.onload=function(){ if(!window.pdfjsLib) return fail(); window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js'; cb(window.pdfjsLib); };
  s.onerror=fail; document.head.appendChild(s);
}
/* A PDF's bytes → its text rows (GP_FIN.rowsFromItems), up to maxPages pages. Also used
   by support raising to read a giving & support tracker. fail('lib') when pdf.js won't load. */
function finPdfRows_(buf, maxPages, ok, fail){
  finPdfLib_(function(lib){
    lib.getDocument({ data:new Uint8Array(buf.slice(0)) }).promise.then(function(doc){
      var items=[], n=Math.min(doc.numPages, maxPages), chain=Promise.resolve();
      for(var p=1;p<=n;p++) (function(p){ chain=chain.then(function(){ return doc.getPage(p).then(function(pg){ return pg.getTextContent(); }).then(function(tc){
        tc.items.forEach(function(it){ items.push({ str:it.str, x:it.transform[4], y:it.transform[5], w:it.width, page:p }); }); }); }); })(p);
      return chain.then(function(){ return items; });
    }).then(function(items){ ok(GP_FIN.rowsFromItems(items)); }).catch(function(){ fail('pdf'); });
  }, function(){ fail('lib'); });
}
function finB64_(buf){ var b=new Uint8Array(buf), s='', CH=0x8000; for(var i=0;i<b.length;i+=CH) s+=String.fromCharCode.apply(null, b.subarray(i, i+CH)); return btoa(s); }
/* A PDF picked → its text rows → a report, read and checked, waiting for a yes. */
function finReadFile_(file){
  if(!/\.pdf$/i.test(file.name) && file.type!=='application/pdf'){ showMsg(t('That isn’t a PDF.')); return; }
  if(file.size>4*1024*1024){ showMsg(t('That file is too big — keep it under 4 MB.')); return; }
  S.finReading++; render();
  var done=function(item){ S.finReading=Math.max(0, S.finReading-1); if(item) S.finPending.push(item); render(); };
  var rd=new FileReader();
  rd.onload=function(){
    var buf=rd.result, b64=finB64_(buf);
    finPdfRows_(buf, 10, function(rows){
      done(finPendingItem_(GP_FIN.parse(rows, file.name, new Date().getFullYear()), file.name, b64));
    }, function(why){
      if(why==='lib'){ done(null); showMsg(t('Couldn’t open the PDF reader — check the connection and try again.')); }
      else done({ id:'p'+Date.now(), fileName:file.name, parsed:{ ok:false, err:'unreadable' } });
    });
  };
  rd.onerror=function(){ done(null); showMsg(t('Couldn’t read that file.')); };
  rd.readAsArrayBuffer(file);
}
function finPendingItem_(parsed, fileName, b64){
  var it={ id:'p'+Date.now()+Math.random().toString(36).slice(2,6), fileName:fileName, b64:b64||'', parsed:parsed, cash:{}, year:parsed.year };
  if(parsed.kind==='pl' && S.fin) (parsed.months||[]).forEach(function(k){ var old=S.fin.pl[k]; if(old && old.cash!=null) it.cash[k]=old.cash; });
  return it;
}
function finChecksHtml_(P){
  var bad=(P.checks||[]).filter(function(c){ return !c.ok; });
  if(!(P.checks||[]).length) return '<div class="finCheck warn">⚠️ '+esc(t('This report has no totals to check against — look the numbers over before saving.'))+'</div>';
  if(!bad.length) return '<div class="finCheck ok">✓ '+esc(t('Every total matches the report’s own.'))+'</div>';
  return '<div class="finCheck warn">⚠️ '+esc(t('Some totals don’t match the report — it may not have been read right:'))+'<ul>'+bad.map(function(c){
    if(c.rows) return '<li>'+esc(gpT('These rows don’t add up across: {names}',{names:c.rows.join(', ')}))+'</li>';
    if(c.months) return '<li>'+esc(gpT('{what}: the TOTAL row doesn’t match its rows in {months}',{what:c.what, months:c.months.map(function(m){ return t(MONTH_SHORT[m]); }).join(', ')}))+'</li>';
    return '<li>'+esc(gpT('{what}: the report says {theirs}, the lines add up to {ours}',{what:c.what, theirs:c.theirs==null?'—':finMoney_(c.theirs, true), ours:finMoney_(c.ours, true)}))+'</li>'; }).join('')+'</ul></div>';
}
function finPendingHtml_(it){
  var P=it.parsed, K=FIN_KINDS_[P.kind];
  var h='<div class="card finPending" data-finpending="'+esc(it.id)+'"><div class="goalCardTitle" style="margin-bottom:2px">'+(K ? K[0]+' '+esc(t(K[1])) : '📄 '+esc(t('A PDF')))+'</div>'+
    '<p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(it.fileName)+'</p>';
  if(!P.ok){
    h+='<p class="sub" style="margin:0 0 8px">'+esc(P.err==='unknown' ? t('This doesn’t look like one of the three reports — the Profit and Loss, the Burn Rate or the A/R Ageing Summary.') : P.err==='unreadable' ? t('This PDF couldn’t be read. Is it a scan? The reports need to be the PDFs QuickBooks or the spreadsheet make.') : t('Couldn’t find the numbers in this report.'))+'</p>';
    return h+'<button class="btn ghost" data-findrop="'+esc(it.id)+'" style="margin:0">'+esc(t('Remove'))+'</button></div>';
  }
  if(P.kind==='pl'){
    P.months.forEach(function(k){
      var tt=GP_FIN.plTotals(P.lines, k), had=S.fin && S.fin.pl[k];
      h+='<div class="finPrevMonth"><b>'+esc(finMonthName_(k))+'</b>'+(had ? ' · <span class="hint" style="margin:0">'+esc(t('replaces the one saved'))+'</span>' : '')+
        '<div class="finPrevNums"><span>'+esc(t('Came in'))+' <b>'+esc(finMoney_(tt.income, true))+'</b></span><span>'+esc(t('Went out'))+' <b>'+esc(finMoney_(tt.spend, true))+'</b></span><span>'+esc(t('Net'))+' <b class="'+(tt.net<0?'finBad':'')+'">'+esc(finMoney_(tt.net, true))+'</b></span></div>'+
        '<label class="f">'+esc(gpT('Cash in the bank at the end of {month} (optional)',{month:finMonthName_(k)}))+'</label>'+
        '<input type="number" inputmode="decimal" step="0.01" data-fincash="'+esc(it.id)+'|'+k+'" value="'+(it.cash[k]!=null?esc(String(it.cash[k])):'')+'" placeholder="$"></div>';
    });
    h+='<details class="pulseMore"><summary>'+esc(gpT('See the {n} lines read',{n:P.lines.length}))+'</summary>'+P.lines.map(function(l){
      var v=P.months.map(function(k){ return l.amt[k]==null ? '—' : finMoney_(l.amt[k], true); }).join(' · ');
      return '<div class="cafeLine"><span>'+(l.parent?'↳ ':'')+esc((l.code?l.code+' ':'')+l.name)+'</span><span>'+esc(v)+'</span></div>'; }).join('')+'</details>';
  } else if(P.kind==='burn'){
    var b=GP_FIN.burnSeries(P), act=b.actual.filter(Boolean).length;
    h+='<label class="f">'+esc(t('The year this is for'))+'</label><select data-finyear="'+esc(it.id)+'">'+[it.year-1, it.year, it.year+1].map(function(y){ return '<option value="'+y+'"'+(y===it.year?' selected':'')+'>'+y+'</option>'; }).join('')+'</select>';
    if(S.fin && S.fin.burn[String(it.year)]) h+='<p class="hint" style="margin:4px 0 0">'+esc(gpT('Replaces the {year} burn rate saved before.',{year:it.year}))+'</p>';
    h+='<p class="sub" style="margin:8px 0 4px">'+esc(gpT('{a} months in, {p} planned.',{a:act, p:12-act}))+'</p>'+
      P.sections.map(function(sec){ return '<div class="cafeLine"><span>'+esc(sec.title||t('A table'))+'</span><span>'+esc(gpT('{n} rows',{n:sec.rows.length}))+'</span></div>'; }).join('');
  } else if(P.kind==='debt'){
    var dt=GP_FIN.debtTotals(P.rows, P.cols.length);
    h+='<div class="finPrevNums"><span>'+esc(t('As of'))+' <b>'+esc(P.asOf ? finDate_(P.asOf) : '—')+'</b></span><span>'+esc(t('Owed'))+' <b>'+esc(finMoney_(dt.total, true))+'</b></span><span>'+esc(t('Names'))+' <b>'+P.rows.length+'</b></span></div>';
    if(!P.asOf) h+='<label class="f">'+esc(t('The date it is as of'))+'</label><input type="date" data-finasof="'+esc(it.id)+'">';
    if(S.fin && S.fin.debt && P.asOf && P.asOf<S.fin.debt.asOf) h+='<p class="hint" style="margin:4px 0 0">'+esc(t('This is older than the one saved — it only fills in the history.'))+'</p>';
    h+='<p class="hint" style="margin:6px 0 0">'+esc(t('Names are matched to staff when you save; you can fix any match after.'))+'</p>';
  }
  h+=finChecksHtml_(P);
  return h+'<div class="btnRow"><button class="btn" data-finsave="'+esc(it.id)+'">'+esc(t('Save'))+'</button><button class="btn ghost" data-findrop="'+esc(it.id)+'">'+esc(t('Leave it'))+'</button></div></div>';
}
/* ---------- QuickBooks ---------- */
function finQboErr_(e){
  return e==='reconnect' ? t('QuickBooks has ended the connection — connect it again.') :
    e==='offline' ? t('Couldn’t reach QuickBooks — it will try again tonight.') :
    e==='busy' ? t('QuickBooks was busy — it will try again tonight.') :
    e==='quickbooks' ? t('QuickBooks didn’t answer properly — it will try again tonight.') :
    e==='token' ? t('QuickBooks didn’t accept the app’s keys — ask an admin to check them.') :
    e==='too_big' ? t('The report was too big to bring in — ask an admin.') :
    e==='not_connected' ? t('QuickBooks isn’t connected.') :
    e==='not_configured' ? t('QuickBooks isn’t set up for this app yet — an admin needs to add its keys.') : t('Couldn’t bring the numbers in — try again.');
}
function finQboHtml_(F){
  var Q=F && F.qbo; if(!Q) return '';
  var h='<div class="card finQbo"><div class="goalCardTitle" style="margin-bottom:4px">🔗 QuickBooks</div>';
  if(!Q.connected){
    if(!Q.configured) return h+'<p class="sub" style="margin:0">'+esc(t('The Profit and Loss and the staff debt can come straight from QuickBooks every night, once an admin has added the app’s QuickBooks keys.'))+'</p></div>';
    return h+'<p class="sub" style="margin:0 0 10px">'+esc(t('Connect your QuickBooks company and the Profit and Loss and the A/R Ageing (staff debt) come in by themselves every night — no more uploading those two. The Burn Rate isn’t in QuickBooks, so it’s still uploaded.'))+'</p>'+
      '<button class="btn" id="finQboConnect" style="margin:0">'+esc(t('Connect QuickBooks'))+'</button>'+
      (S.qboWaiting ? '<p class="hint" style="margin:8px 0 0">'+esc(t('Finish signing in to QuickBooks in the window that opened, then come back here.'))+'</p>' : '')+'</div>';
  }
  h+='<p class="sub" style="margin:0">'+esc(Q.company ? gpT('Connected to {company}',{company:Q.company}) : t('Connected to QuickBooks'))+(Q.sandbox ? ' · '+esc(t('a test company')) : '')+'</p>'+
    '<p class="hint" style="margin:2px 0 0">'+(Q.lastSync ? esc(gpT('Last brought in {date}: {n} months of the Profit and Loss, {p} names owing.',{date:finDate_(Q.lastSync), n:Q.months||0, p:Q.people||0})) : esc(t('Nothing brought in yet.')))+'</p>';
  if(Q.lastErr) h+='<div class="finCheck warn">⚠️ '+esc(finQboErr_(Q.lastErr))+'</div>';
  if(Q.warn && Q.warn.length){
    var wm=[]; Q.warn.forEach(function(w){ if(wm.indexOf(w.month)<0) wm.push(w.month); });
    h+='<div class="finCheck warn">⚠️ '+esc(gpT('Some of QuickBooks’ totals don’t match their lines in {months} — look those months over.',{months:wm.map(finMonthName_).join(', ')}))+'</div>';
  }
  var L=Q.lists||{}, dep=L.department||[], cls=L['class']||[], cur=Q.filter ? Q.filter.type+'|'+Q.filter.id : '';
  if(dep.length || cls.length || Q.filter){
    var opt=function(type, x){ var v=type+'|'+x.id; return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(x.name)+'</option>'; };
    h+='<label class="f" for="finQboFilter">'+esc(t('Whose numbers are these?'))+'</label><select id="finQboFilter"><option value="">'+esc(t('The whole company'))+'</option>'+
      (dep.length ? '<optgroup label="'+esc(t('Locations'))+'">'+dep.map(function(x){ return opt('department', x); }).join('')+'</optgroup>' : '')+
      (cls.length ? '<optgroup label="'+esc(t('Classes'))+'">'+cls.map(function(x){ return opt('class', x); }).join('')+'</optgroup>' : '')+
      (Q.filter && !(Q.filter.type==='class' ? cls : dep).some(function(x){ return x.id===Q.filter.id; }) ? '<option value="'+esc(cur)+'" selected>'+esc(Q.filter.name)+'</option>' : '')+'</select>'+
      '<p class="hint" style="margin:4px 0 0">'+esc(t('If both campuses keep their books in one QuickBooks company, choose this campus’s Location or Class, and the Profit and Loss is this campus’s alone.'))+'</p>';
  }
  return h+(Q.broken ? '<button class="btn" id="finQboConnect" style="margin:12px 0 0">'+esc(t('Connect again'))+'</button>' : '<button class="btn" id="finQboSync" style="margin:12px 0 0">'+esc(t('Bring the numbers in now'))+'</button>')+
    '<p class="hint" style="margin:8px 0 0">'+esc(t('They come in every night at about 4am, for the twelve finished months. The Burn Rate isn’t in QuickBooks, so it’s still uploaded below.'))+'</p>'+
    '<button class="linkbtn" id="finQboOff" style="margin-top:6px">'+esc(t('Disconnect'))+'</button></div>';
}
function finReportsHtml_(){
  finLoad_();
  var F=S.fin, h='<div id="finReports">', Q=F && F.qbo;
  h+=finQboHtml_(F);
  h+='<div class="card"><div class="goalCardTitle" style="margin-bottom:4px">🧾 '+esc(t('The month’s reports'))+'</div>'+
    '<p class="sub" style="margin:0 0 10px">'+esc(Q && Q.connected ? t('QuickBooks brings in the Profit and Loss and the staff debt. Upload the Burn Rate here — and any report you’d rather add by hand; it’s read and checked against its own totals before anything is saved.') :
      t('Upload the PDFs you already make — the Profit and Loss, the Burn Rate and the A/R Ageing Summary. The numbers are read from them and checked against their own totals before anything is saved. Campus Leadership sees them on their Finances tab; staff-debt names stay with you.'))+'</p>'+
    '<label class="btn finPickBtn" style="margin:0">📄 '+esc(t('Add the PDFs'))+'<input type="file" id="finFiles" accept="application/pdf,.pdf" multiple hidden></label>'+
    (S.finReading ? '<p class="sub" style="margin:8px 0 0">'+esc(t('Reading…'))+'</p>' : '')+
    '<details class="pulseMore"><summary>'+esc(t('No PDF? Paste from the spreadsheet'))+'</summary><p class="hint" style="margin:6px 0">'+esc(t('Copy the rows from Excel or Google Sheets, headings and all, and paste them here.'))+'</p>'+
    '<textarea id="finPaste" rows="4" placeholder="'+esc(t('Paste the rows here'))+'"></textarea><button class="btn ghost" id="finPasteRead" style="margin-top:6px">'+esc(t('Read these rows'))+'</button></details></div>';
  S.finPending.forEach(function(it){ h+=finPendingHtml_(it); });
  if(!F) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.finErr ? t('Couldn’t load this — pull down to try again.') : t('Loading…'))+'</p></div></div>';
  /* what is saved */
  var months=finMonthsOf_(F).reverse();
  h+='<h3>📊 '+esc(t('Profit and Loss'))+' <small>· '+months.length+'</small></h3><div class="card">';
  if(!months.length) h+='<p class="sub" style="margin:0">'+esc(t('None saved yet.'))+'</p>';
  months.forEach(function(k){
    var M=F.pl[k], tt=GP_FIN.plTotals(M.lines, k);
    h+='<div class="finSaved"><div class="finSavedMain"><b>'+esc(finMonthName_(k))+'</b> <span class="'+(tt.net<0?'finBad':'finGood')+'">'+esc(finMoney_(tt.net))+'</span>'+
      '<div class="hint" style="margin:0">'+(M.src==='qbo' ? esc(gpT('from QuickBooks {date}',{date:finDate_(M.at)})) : esc(gpT('uploaded {date}',{date:finDate_(M.at)}))+(M.by?' · '+esc(M.by):''))+'</div></div>'+
      '<div class="finCashIn"><label class="hint" style="margin:0" for="fc'+k+'">'+esc(t('Cash at month end'))+'</label><input id="fc'+k+'" type="number" inputmode="decimal" step="0.01" data-fincashsaved="'+k+'" value="'+(M.cash!=null?esc(String(M.cash)):'')+'" placeholder="$"></div>'+
      '<div class="finSavedActs">'+(M.fileId?'<button class="linkbtn inline" data-finfile="'+esc(M.fileId)+'" aria-label="'+esc(t('Open the PDF'))+'">📄</button>':'')+
      '<button class="lwDel" data-findel="pl|'+k+'" aria-label="'+esc(t('Remove'))+'">×</button></div></div>';
  });
  h+='</div>';
  var years=Object.keys(F.burn||{}).sort().reverse();
  h+='<h3>🏠 '+esc(t('Burn rate'))+' <small>· '+years.length+'</small></h3><div class="card">';
  if(!years.length) h+='<p class="sub" style="margin:0">'+esc(t('None saved yet.'))+'</p>';
  years.forEach(function(y){
    var B=F.burn[y], b=GP_FIN.burnSeries(B), act=b.actual.filter(Boolean).length;
    h+='<div class="finSaved"><div class="finSavedMain"><b>'+esc(y)+'</b> <span class="hint" style="margin:0">'+esc(gpT('{a} months in, {p} planned',{a:act, p:12-act}))+'</span>'+
      '<div class="hint" style="margin:0">'+esc(gpT('uploaded {date}',{date:finDate_(B.at)}))+(B.by?' · '+esc(B.by):'')+'</div></div><div class="finSavedActs">'+
      (B.fileId?'<button class="linkbtn inline" data-finfile="'+esc(B.fileId)+'" aria-label="'+esc(t('Open the PDF'))+'">📄</button>':'')+'<button class="lwDel" data-findel="burn|'+esc(y)+'" aria-label="'+esc(t('Remove'))+'">×</button></div></div>';
  });
  h+='</div>';
  h+='<h3>💳 '+esc(t('Staff debt'))+'</h3><div class="card">';
  if(!F.debt) h+='<p class="sub" style="margin:0">'+esc(t('None saved yet.'))+'</p>';
  else {
    var D=F.debt;
    h+='<div class="finSaved"><div class="finSavedMain"><b>'+esc(gpT('As of {date}',{date:finDate_(D.asOf)}))+'</b> '+esc(finMoney_(D.total, true))+
      '<div class="hint" style="margin:0">'+(D.src==='qbo' ? esc(gpT('from QuickBooks {date}',{date:finDate_(D.at)})) : esc(gpT('uploaded {date}',{date:finDate_(D.at)}))+(D.by?' · '+esc(D.by):''))+'</div></div><div class="finSavedActs">'+
      (F.debtFile && F.debtFile.fileId?'<button class="linkbtn inline" data-finfile="'+esc(F.debtFile.fileId)+'" aria-label="'+esc(t('Open the PDF'))+'">📄</button>':'')+'<button class="lwDel" data-findel="debt|x" aria-label="'+esc(t('Remove'))+'">×</button></div></div>';
    var people=(S.roster||[]).filter(function(p){ return p.campus===S.fin.campus; }).slice().sort(function(a, b){ return a.name.localeCompare(b.name); });
    var rows=(F.debtRows||[]).slice().sort(function(a, b){ return (a.staffId?1:0)-(b.staffId?1:0) || a.name.localeCompare(b.name); });
    var un=rows.filter(function(r){ return !r.staffId; }).length;
    h+='<p class="sub" style="margin:10px 0 6px">'+esc(un ? gpT('{n} names aren’t matched to anyone on staff — say who they are, and their department’s total follows:',{n:un}) : t('Every name is matched to someone on staff.'))+'</p>';
    h+='<div class="finMatch">'+rows.map(function(r){
      var v=r.staffId || (F.nameMap && F.nameMap[r.name]==='-' ? '-' : '');
      return '<div class="finMatchRow"><div><div class="rowName">'+esc(r.name)+'</div><div class="rowSub">'+esc(finMoney_(r.total, true))+'</div></div>'+
        '<select data-finmatch="'+esc(r.name)+'" aria-label="'+esc(gpT('Who is {name}?',{name:r.name}))+'"><option value="">'+esc(t('— who is this? —'))+'</option>'+
        people.map(function(p){ return '<option value="'+esc(p.id)+'"'+(v===p.id?' selected':'')+'>'+esc(p.name)+'</option>'; }).join('')+
        '<option value="-"'+(v==='-'?' selected':'')+'>'+esc(t('Not on staff'))+'</option></select></div>'; }).join('')+'</div>';
  }
  return h+'</div></div>';
}
/* The Finances office's page on My Ministry: the reports, what leadership sees, and the usual numbers. */
function finMinistryTabsHtml_(){
  var tab=S.finTab;
  return '<div class="campusSeg" style="max-width:none">'+[['reports','🧾','Reports'],['dash','📊','Dashboard'],['numbers','🔢','The numbers']].map(function(x){
    return '<button class="campusBtn'+(tab===x[0]?' on':'')+'" data-fintab="'+x[0]+'">'+x[1]+' '+esc(t(x[2]))+'</button>'; }).join('')+'</div>';
}

function bindFinance_(){
  var qc=document.getElementById('finQboConnect'); if(qc) qc.onclick=function(){
    if(S.busy) return; gpTap();
    // the window opens on the tap itself (a phone blocks one opened later), and is sent to Intuit once the app has its link
    var w=null; try{ w=window.open('', '_blank'); }catch(e){ w=null; }
    S.busy=true;
    run('qboConnect',[S.auth.user,S.auth.pin],function(d){
      S.busy=false;
      if(d && d.ok){ S.qboWaiting=true; if(w && !w.closed) w.location.href=d.url; else location.href=d.url; render(); }
      else { if(w) try{ w.close(); }catch(e){} showMsg(d && d.err==='not_authorized' ? t('Only the Finances office can do that.') : finQboErr_(d && d.err)); }
    }, function(){ S.busy=false; if(w) try{ w.close(); }catch(e){} showMsg(t('No connection — try again when you are online.')); }); };
  var qs=document.getElementById('finQboSync'); if(qs) qs.onclick=function(){
    if(S.busy) return; S.busy=true; qs.disabled=true; qs.textContent=t('Bringing them in…');
    run('qboSyncNow',[S.auth.user,S.auth.pin],function(d){ S.busy=false; if(finPut_(d)) showMsg(d.synced ? t('Brought in from QuickBooks') : finQboErr_(d.syncErr)); else showMsg(finQboErr_(d && d.err)); render(); },
      function(){ S.busy=false; showMsg(t('No connection — try again when you are online.')); render(); }); };
  var qf=document.getElementById('finQboFilter'); if(qf) qf.onchange=function(){
    if(S.busy) return; S.busy=true; qf.disabled=true;
    var v=qf.value.split('|');
    run('qboSetFilter',[S.auth.user,S.auth.pin,v[0]||'',v[1]||''],function(d){ S.busy=false; if(finPut_(d)) showMsg(d.synced ? t('Brought in from QuickBooks') : finQboErr_(d.syncErr)); else showMsg(finQboErr_(d && d.err)); render(); },
      function(){ S.busy=false; showMsg(t('No connection — try again when you are online.')); render(); }); };
  var qo=document.getElementById('finQboOff'); if(qo) qo.onclick=function(){
    if(S.busy || !confirm(t('Disconnect QuickBooks? What it already brought in stays; nothing new comes in until it’s connected again.'))) return;
    S.busy=true;
    run('qboDisconnect',[S.auth.user,S.auth.pin],function(d){ S.busy=false; if(finPut_(d)) showMsg(t('Disconnected')); else showMsg(finFail_(d)); render(); },
      function(){ S.busy=false; showMsg(t('No connection — try again when you are online.')); }); };
  document.querySelectorAll('[data-fintab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.finTab=b.getAttribute('data-fintab'); lsSet('gp-fin-tab', S.finTab); render(); }; });
  var fs=document.getElementById('finFiles'); if(fs) fs.onchange=function(){ Array.prototype.forEach.call(fs.files||[], finReadFile_); fs.value=''; };
  var pr=document.getElementById('finPasteRead'); if(pr) pr.onclick=function(){
    var txt=(document.getElementById('finPaste')||{}).value||'';
    if(!txt.trim()){ showMsg(t('Paste the rows first.')); return; }
    S.finPending.push(finPendingItem_(GP_FIN.parse(GP_FIN.rowsFromTsv(txt), '', new Date().getFullYear()), t('Pasted rows'), '')); render(); };
  var ms=document.getElementById('finMonthSel'); if(ms) ms.onchange=function(){ S.finMonth=ms.value; render(); };
  document.querySelectorAll('[data-findrop]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-findrop'); S.finPending=S.finPending.filter(function(x){ return x.id!==id; }); render(); }; });
  document.querySelectorAll('[data-fincash]').forEach(function(inp){ inp.oninput=function(){ var v=inp.getAttribute('data-fincash').split('|'), it=S.finPending.filter(function(x){ return x.id===v[0]; })[0]; if(it) it.cash[v[1]] = inp.value==='' ? null : Number(inp.value); }; });
  document.querySelectorAll('[data-finyear]').forEach(function(sel){ sel.onchange=function(){ var it=S.finPending.filter(function(x){ return x.id===sel.getAttribute('data-finyear'); })[0]; if(it){ it.year=Number(sel.value); render(); } }; });
  document.querySelectorAll('[data-finasof]').forEach(function(inp){ inp.onchange=function(){ var it=S.finPending.filter(function(x){ return x.id===inp.getAttribute('data-finasof'); })[0]; if(it) it.parsed.asOf=inp.value; }; });
  document.querySelectorAll('[data-finsave]').forEach(function(b){ b.onclick=function(){
    if(S.busy) return;
    var it=S.finPending.filter(function(x){ return x.id===b.getAttribute('data-finsave'); })[0]; if(!it) return;
    var P=it.parsed, data;
    if((P.checks||[]).some(function(c){ return !c.ok; }) && !confirm(t('Some totals don’t match the report. Save it anyway?'))) return;
    if(P.kind==='pl'){ data={ months:{} }; P.months.forEach(function(k){ data.months[k]={ cash: it.cash[k]==null || isNaN(it.cash[k]) ? null : it.cash[k], lines:P.lines.map(function(l){ return { sec:l.sec, code:l.code, name:l.name, parent:l.parent, amt: l.amt[k]==null ? null : l.amt[k] }; }) }; }); }
    else if(P.kind==='burn') data={ year:it.year, sections:P.sections };
    else { if(!P.asOf){ showMsg(t('The report needs its date.')); return; } data={ asOf:P.asOf, cols:P.cols, rows:P.rows }; }
    S.busy=true; b.disabled=true; b.textContent=t('Saving…');
    run('finSave',[S.auth.user,S.auth.pin,P.kind,data,it.b64 ? { name:it.fileName, base64:it.b64 } : null],function(d){
      S.busy=false;
      if(finPut_(d)){ S.finPending=S.finPending.filter(function(x){ return x.id!==it.id; }); S.finAheadEdit=null; showMsg(t('Saved')); } else showMsg(finFail_(d));
      render();
    }, function(){ S.busy=false; showMsg(t('No connection — try again when you are online.')); render(); });
  }; });
  document.querySelectorAll('[data-fincashsaved]').forEach(function(inp){ inp.onchange=function(){
    run('finSetCash',[S.auth.user,S.auth.pin,inp.getAttribute('data-fincashsaved'), inp.value==='' ? null : Number(inp.value)],function(d){ if(finPut_(d)){ S.finAheadEdit=null; showMsg(t('Saved')); } else showMsg(finFail_(d)); render(); }); }; });
  document.querySelectorAll('[data-findel]').forEach(function(b){ b.onclick=function(){
    var v=b.getAttribute('data-findel').split('|');
    if(!confirm(t('Take this report out? Its numbers and its PDF go, and leadership won’t see them.'))) return;
    run('finDelete',[S.auth.user,S.auth.pin,v[0],v[1]],function(d){ if(finPut_(d)) showMsg(t('Removed')); else showMsg(finFail_(d)); render(); }); }; });
  document.querySelectorAll('[data-finmatch]').forEach(function(sel){ sel.onchange=function(){
    run('finMatchName',[S.auth.user,S.auth.pin,sel.getAttribute('data-finmatch'),sel.value],function(d){ if(finPut_(d)) showMsg(t('Saved')); else showMsg(finFail_(d)); render(); }); }; });
  document.querySelectorAll('[data-finfile]').forEach(function(b){ b.onclick=function(){
    b.disabled=true;
    run('finFile',[S.auth.user,S.auth.pin,b.getAttribute('data-finfile')],function(d){ b.disabled=false; if(d && d.ok) hrOpenDataUrl_(d.dataUrl, d.name); else showMsg(t('Couldn’t open the PDF.')); },
      function(){ b.disabled=false; showMsg(t('Connection problem — try again.')); }); }; });
  document.querySelectorAll('[data-finahead]').forEach(function(inp){ inp.oninput=function(){ var v=inp.getAttribute('data-finahead').split('|'); S.finAheadEdit[v[0]]=S.finAheadEdit[v[0]]||{}; S.finAheadEdit[v[0]][v[1]] = inp.value==='' ? null : Number(inp.value); finAheadRecalc_(); }; });
  var as=document.getElementById('finAheadSave'); if(as) as.onclick=function(){ if(S.busy) return; S.busy=true;
    run('finAheadSave',[S.auth.user,S.auth.pin,S.finAheadEdit||{}],function(d){ S.busy=false; if(finPut_(d)){ S.finAheadEdit=null; showMsg(t('Saved')); } else showMsg(t('Could not save')); render(); },
      function(){ S.busy=false; showMsg(t('No connection — try again when you are online.')); }); };
  document.querySelectorAll('.finHit').forEach(function(r){
    r.addEventListener('pointerenter', function(){ finTipShow_(r); }); r.addEventListener('pointerleave', finTipHide_);
    r.addEventListener('focus', function(){ finTipShow_(r); }); r.addEventListener('blur', finTipHide_);
    r.addEventListener('click', function(){ finTipShow_(r); });
  });
  finTipHide_();
}
