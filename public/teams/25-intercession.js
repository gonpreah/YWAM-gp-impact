/* ==================== Intercession on My Ministry (Nov 2026, Uriah) ====================
   "For intercession, we only do it once a week, every Wednesday … but it would be great for them to
   also plan like a January 21-day fast and prayer as well." Youth Education › Intercession, both
   campuses. Its tabs: Wednesdays · 21-day fast · Requests · Dashboard, then Numbers (only Director
   Weekly Score is typed — the rest count themselves) · Tasks · OKRs.
   - Wednesdays: a plan for each Wednesday (the next 8, earlier ones folded) — who leads, the focus,
     the ministries and needs prayed for, a scripture reference (never the text), the worship team
     (a line for now; the Worship tool will fill it later), notes; then held, how many came, how long,
     answered-prayer testimonies. "Copy last week's plan" starts a new one.
   - Requests: prayer needs any staff member sends for a Wednesday (S.view='icp', "Wednesday
     intercession", reached from ☰ → Prayer and search), marked prayed / answered.
   - 21-day fast: the ministry plans it (title, start, 7–40 days, theme, a focus and reference for
     each day — our own template of 21, English and Khmer side by side — and the prayer gatherings).
     Staff everywhere see it while it is coming or running (☰, search, the bell), join with the kind
     of fast they choose and tick each day. Joining and ticks are each person's own; the ministry
     sees counts.
   Server: getIntercession / intercessionSaveWed / intercessionNeedSend / intercessionNeedMark /
   intercessionNeedDelete / fastSave / fastDelete / fastJoin / fastTick (api.js "Intercession");
   the boot's `fast` (fastGlance_) is S.fast. */
var ICP_TABS=['icwed','icfast','icreq','icdash'];
S.icp=null; S.icpLoading=false; S.icpErr=''; S.icpEdit=null; S.icpDraft=null; S.fastDraft=null; S.icpBusy=false; S.icpSub='wed'; S.fast=S.fast||null;
var FAST_KINDS=[['full','Full fast'],['partial','Partial fast (Daniel fast)'],['meal','One meal a day'],['media','Media and social media'],['other','Something else']];
/* our own 21 themes for a fast — references only, never Bible text; English and Khmer side by side */
var ICP_FAST_TPL=[
  { en:'Seeking God first', km:'ស្វែងរកព្រះជាមុនសិន', ref:'Matthew 6:33' },
  { en:'Repentance and a clean heart', km:'ការប្រែចិត្ត និងចិត្តបរិសុទ្ធ', ref:'Psalm 51:10' },
  { en:'Our base and our staff', km:'មូលដ្ឋាន និងបុគ្គលិករបស់យើង', ref:'Ephesians 4:1-3' },
  { en:'Families and marriages', km:'គ្រួសារ និងអាពាហ៍ពិពាហ៍', ref:'Joshua 24:15' },
  { en:'Cambodia’s children and youth', km:'កុមារ និងយុវជនកម្ពុជា', ref:'Psalm 127:3' },
  { en:'The church in Cambodia', km:'ក្រុមជំនុំនៅកម្ពុជា', ref:'Acts 2:42-47' },
  { en:'Our schools and students', km:'សាលា និងសិស្សរបស់យើង', ref:'James 1:5' },
  { en:'The nation’s leaders', km:'អ្នកដឹកនាំប្រទេស', ref:'1 Timothy 2:1-2' },
  { en:'Peace and justice in the land', km:'សន្តិភាព និងយុត្តិធម៌ក្នុងស្រុក', ref:'Micah 6:8' },
  { en:'Those who don’t yet know Jesus', km:'អ្នកដែលមិនទាន់ស្គាល់ព្រះយេស៊ូវ', ref:'Romans 10:14-15' },
  { en:'Healing for the sick and the broken-hearted', km:'ការប្រោសឲ្យជាសម្រាប់អ្នកឈឺ និងអ្នកមានចិត្តខូច', ref:'Psalm 147:3' },
  { en:'The poor and the vulnerable', km:'ជនក្រីក្រ និងអ្នកងាយរងគ្រោះ', ref:'Isaiah 58:6-7' },
  { en:'Our ministries and their fruit', km:'កិច្ចការបម្រើរបស់យើង និងផលផ្លែរបស់វា', ref:'John 15:5' },
  { en:'Provision and finances', km:'ការផ្គត់ផ្គង់ និងហិរញ្ញវត្ថុ', ref:'Philippians 4:19' },
  { en:'Unity among believers', km:'ការរួបរួមគ្នាក្នុងចំណោមអ្នកជឿ', ref:'John 17:21' },
  { en:'Missions and the nations', km:'បេសកកម្ម និងប្រជាជាតិនានា', ref:'Matthew 28:19-20' },
  { en:'Workers for the harvest', km:'អ្នកធ្វើការសម្រាប់ការច្រូតកាត់', ref:'Matthew 9:37-38' },
  { en:'Protection and safety', km:'ការការពារ និងសុវត្ថិភាព', ref:'Psalm 91:1-2' },
  { en:'Wisdom for the year ahead', km:'ប្រាជ្ញាសម្រាប់ឆ្នាំខាងមុខ', ref:'Proverbs 3:5-6' },
  { en:'Revival in our hearts', km:'ការរស់ឡើងវិញក្នុងចិត្តរបស់យើង', ref:'Habakkuk 3:2' },
  { en:'Thanksgiving and praise', km:'ការអរព្រះគុណ និងការសរសើរ', ref:'Psalm 100:4' }
];
function isIcpMinistry_(dept, min){ return dept==='Youth Education' && min==='Intercession'; }
function icpTabs_(){ return [['icwed',t('Wednesdays')],['icfast',t('21-day fast')],['icreq',t('Requests')],['icdash',t('Dashboard')]]; }
function icpLoad_(){
  if(S.icpLoading || !S.auth || !S.auth.user) return; S.icpLoading=true; S.icpErr='';
  run('getIntercession',[S.auth.user,S.auth.pin],function(d){ S.icpLoading=false; if(d && d.ok) S.icp=d; else S.icpErr=(d && d.err)||'error'; if(S.view==='ministry' || S.view==='icp') render(); },
    function(e){ S.icpLoading=false; S.icpErr=String((e && e.message)||'offline'); if(S.view==='ministry' || S.view==='icp') render(); });
}
function icpLoadHtml_(){
  if(S.icpErr) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load intercession.'))+'</p><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.icpErr)+'</p>'+
    '<button class="btn ghost" id="icpRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  icpLoad_();
  return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
}
function icpDay_(iso){ var d=new Date(String(iso).slice(0,10)+'T00:00:00'); return isNaN(d) ? String(iso||'') : d.toLocaleDateString(LANG==='km'?'km-KH':'en-GB', { weekday:'short', day:'numeric', month:'short' }); }
function icpAdd_(iso, n){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return isoDateOf_(d); }
function icpMinName_(k){ var i=String(k||'').lastIndexOf('|'); return i<0 ? k : t(k.slice(i+1)); }
function icpCampusMins_(){
  var out=[], deps=getDepartments(S.me.campus);
  Object.keys(deps).forEach(function(dept){ Object.keys(deps[dept]).forEach(function(min){ out.push({ dept:dept, min:min, key:dept+'|'+min }); }); });
  return out;
}
function icpPaneHtml_(cur){
  if(!S.icp) return icpLoadHtml_();
  if(cur==='icfast') return icpFastTabHtml_();
  if(cur==='icreq') return icpReqHtml_(true);
  if(cur==='icdash') return icpDashHtml_();
  return icpWedsHtml_();
}

/* ---------- Wednesdays ---------- */
function icpWedOf_(date){ return (S.icp.weds||[]).filter(function(w){ return w.date===date; })[0]||null; }
function icpNeedsFor_(date){ return (S.icp.needs||[]).filter(function(n){ return n.wed===date; }); }
function icpWedsHtml_(){
  var I=S.icp, h='', next=I.nextWed, today=I.today, list=[];
  for(var i=0;i<8;i++) list.push(icpAdd_(next, i*7));
  /* the last Wednesday that has come, not recorded yet: ask first */
  var last=next===today ? today : icpAdd_(next, -7), lastRec=icpWedOf_(last);
  if((!lastRec || lastRec.held==null) && S.icpEdit!==last)
    h+='<div class="card icpAsk" id="icpAskHeld"><b>🙏 '+esc(gpT('How was Wednesday {date}?',{date:icpDay_(last)}))+'</b>'+
      '<p class="sub" style="margin:4px 0 8px">'+esc(t('Say if it happened, how many came and how long — the ministry’s numbers count themselves from it.'))+'</p>'+
      '<button class="btn" data-icpwed="'+esc(last)+'" style="margin-top:0">'+esc(t('Record it'))+'</button></div>';
  h+='<h3 class="icpHead">📅 '+esc(t('The next Wednesdays'))+'</h3>';
  list.forEach(function(d){ h+=icpWedCardHtml_(d, icpWedOf_(d), I.canEdit); });
  var earlier=(I.weds||[]).filter(function(w){ return w.date<next; }).map(function(w){ return w.date; });
  for(var k=1;k<=4;k++){ var pd=icpAdd_(next, -7*k); if(earlier.indexOf(pd)===-1) earlier.push(pd); }
  earlier.sort().reverse();
  h+='<details class="icpPast" id="icpPast"'+(S.icpEdit && S.icpEdit<next ? ' open' : '')+'><summary>'+esc(gpT('Earlier Wednesdays ({n})',{n:earlier.length}))+'</summary>'+
    earlier.map(function(d){ return icpWedCardHtml_(d, icpWedOf_(d), I.canEdit); }).join('')+'</details>';
  return h;
}
function icpWedCardHtml_(date, w, canEdit){
  if(S.icpEdit===date && canEdit) return icpWedFormHtml_(date);
  var I=S.icp, isToday=date===I.today, needs=icpNeedsFor_(date).filter(function(n){ return n.status==='open'; });
  var h='<div class="card icpWed'+(w ? '' : ' empty')+'" data-icpwedcard="'+esc(date)+'"><div class="icpWedTop"><b>'+esc(icpDay_(date))+'</b>'+(isToday ? ' <span class="icpTag">'+esc(t('today'))+'</span>' : '')+
    (w && w.held===true ? ' <span class="icpTag ok">✓ '+esc(t('Held'))+'</span>' : w && w.held===false ? ' <span class="icpTag">'+esc(t('Didn’t happen'))+'</span>' : '')+'</div>';
  if(w){
    var leader=w.leaderId ? nameOf(w.leaderId) : w.leaderName;
    if(leader && leader!=='—') h+='<div class="icpLine">👤 '+esc(gpT('Led by {name}',{name:leader}))+'</div>';
    if(w.focus) h+='<div class="icpLine">🎯 '+esc(w.focus)+'</div>';
    if(w.scripture) h+='<div class="icpLine">📖 '+esc(w.scripture)+'</div>';
    if(w.worship) h+='<div class="icpLine">🎵 '+esc(gpT('Worship: {who}',{who:w.worship}))+'</div>';
    if(w.mins.length || w.items.length) h+='<div class="icpChips">'+w.mins.map(function(m){ return '<span class="icpChip">'+esc(icpMinName_(m))+'</span>'; }).join('')+
      w.items.map(function(x){ return '<span class="icpChip other">'+esc(x)+'</span>'; }).join('')+'</div>';
    if(w.held===true && (w.came!=null || w.hours!=null)) h+='<div class="icpLine">'+(w.came!=null ? '👥 '+esc(gpT('{n} came',{n:w.came}))+' ' : '')+(w.hours!=null ? '⏱ '+esc(gpT('{n} h',{n:w.hours})) : '')+'</div>';
    if(w.testimonies.length) h+='<div class="icpTes">'+w.testimonies.map(function(x){ return '<div>🎉 '+esc(x.text)+'</div>'; }).join('')+'</div>';
    if(w.notes && canEdit) h+='<div class="icpLine hint">📝 '+esc(w.notes)+'</div>';
  } else h+='<div class="icpLine hint">'+esc(t('Not planned yet'))+'</div>';
  if(needs.length) h+='<div class="icpLine">🙏 '+esc(gpT('{n} prayer needs sent for this day',{n:needs.length}))+'</div>';
  if(canEdit) h+='<button class="btn ghost small" data-icpwed="'+esc(date)+'">'+esc(w ? t('Edit') : t('Plan it'))+'</button>';
  return h+'</div>';
}
function icpBlankWed_(date){ return { date:date, leaderId:'', leaderName:'', focus:'', scripture:'', worship:'', mins:[], items:[], notes:'', held:null, came:'', hours:'', testimonies:[] }; }
function icpStartEdit_(date){
  var w=icpWedOf_(date), d=w ? JSON.parse(JSON.stringify(w)) : icpBlankWed_(date);
  if(d.came==null) d.came=''; if(d.hours==null) d.hours=''; if(d.notes==null) d.notes='';
  S.icpEdit=date; S.icpDraft=d; S.icpNewItem=''; S.icpNewTes=''; S.icpMinOpen=null;
}
function icpWedFormHtml_(date){
  var D=S.icpDraft||icpBlankWed_(date), past=date<=S.icp.today;
  var people=(S.roster||[]).filter(function(p){ return p.campus===S.me.campus; }).sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); })
    .map(function(p){ var mine=(p.dept==='Youth Education' && p.ministry==='Intercession'); return { id:p.id, name:p.name, sub:t(p.ministry||p.dept||''), first:mine, group: mine ? t('Intercession') : t('Everyone else') }; });
  var h='<div class="card icpForm" id="icpForm"><div class="icpWedTop"><b>'+esc(icpDay_(date))+'</b></div>';
  var prev=(S.icp.weds||[]).filter(function(w){ return w.date<date; })[0];
  if(prev) h+='<button class="linkbtn" id="icpCopyLast" style="text-align:left;padding-left:0">📋 '+esc(gpT('Copy the plan from {date}',{date:icpDay_(prev.date)}))+'</button>';
  h+='<label class="f">'+esc(t('Who leads'))+'</label>'+ppickHtml_({ key:'icpl', people:people, chosen:D.leaderId ? [D.leaderId] : [], placeholder:t('Type a name…'),
      onPick:function(id){ icpKeep_(); S.icpDraft.leaderId=id; S.icpDraft.leaderName=''; render(); }, onRemove:function(){ icpKeep_(); S.icpDraft.leaderId=''; render(); } });
  if(!D.leaderId) h+='<input id="icpLeaderName" maxlength="80" placeholder="'+esc(t('…or type a name (a guest)'))+'" value="'+esc(D.leaderName)+'">';
  h+='<label class="f" for="icpFocus">'+esc(t('Focus or theme'))+'</label><input id="icpFocus" maxlength="200" value="'+esc(D.focus)+'">'+
    '<label class="f" for="icpRef">'+esc(t('Scripture (the reference)'))+'</label><input id="icpRef" maxlength="120" placeholder="'+esc(t('e.g. Isaiah 62:6-7'))+'" value="'+esc(D.scripture)+'">'+
    '<label class="f" for="icpWorship">'+esc(t('Worship team'))+'</label><input id="icpWorship" maxlength="200" value="'+esc(D.worship)+'">'+
    '<label class="f">'+esc(t('Ministries we pray for'))+'</label><details class="icpMinPick" id="icpMinPick"'+((S.icpMinOpen==null ? !D.mins.length : S.icpMinOpen)?' open':'')+'><summary>'+esc(gpT('{n} chosen',{n:D.mins.length}))+'</summary>';
  var byDept={}; icpCampusMins_().forEach(function(m){ (byDept[m.dept]=byDept[m.dept]||[]).push(m); });
  Object.keys(byDept).forEach(function(dept){
    h+='<div class="icpMinDept">'+esc(t(dept))+'</div><div class="icpChips">'+byDept[dept].map(function(m){ var on=D.mins.indexOf(m.key)>-1;
      return '<button class="deptChip'+(on?' on':'')+'" data-icpmin="'+esc(m.key)+'">'+(MIN_EMOJI[m.min]||'')+' '+esc(t(m.min))+'</button>'; }).join('')+'</div>';
  });
  h+='</details><label class="f" for="icpItem">'+esc(t('Other needs'))+'</label>'+
    (D.items.length ? '<div class="icpChips">'+D.items.map(function(x,i){ return '<span class="icpChip other">'+esc(x)+' <button class="gptX" data-icpitemrm="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></span>'; }).join('')+'</div>' : '')+
    '<div class="icpRow"><input id="icpItem" maxlength="120" placeholder="'+esc(t('e.g. rain for the farmers'))+'" value="'+esc(S.icpNewItem||'')+'"><button class="btn ghost small" id="icpItemAdd">'+esc(t('Add'))+'</button></div>';
  var sent=icpNeedsFor_(date);
  if(sent.length) h+='<div class="icpLine">🙏 '+esc(gpT('{n} prayer needs sent for this day — see Requests',{n:sent.length}))+'</div>';
  h+='<label class="f" for="icpNotes">'+esc(t('Notes'))+'</label><textarea id="icpNotes" rows="3" maxlength="1500">'+esc(D.notes)+'</textarea>';
  if(past){
    h+='<div class="icpAfter"><label class="f">'+esc(t('Did it happen?'))+'</label><div class="icpChips">'+
      '<button class="deptChip'+(D.held===true?' on':'')+'" data-icpheld="1">'+esc(t('Yes'))+'</button><button class="deptChip'+(D.held===false?' on':'')+'" data-icpheld="0">'+esc(t('No'))+'</button></div>';
    if(D.held===true){
      h+='<div class="icpRow"><label>'+esc(t('How many came'))+'<input type="number" inputmode="numeric" min="0" max="2000" id="icpCame" value="'+esc(String(D.came))+'"></label>'+
        '<label>'+esc(t('How long (hours)'))+'<input type="number" inputmode="decimal" step="0.25" min="0" max="24" id="icpHours" value="'+esc(String(D.hours))+'"></label></div>'+
        '<label class="f" for="icpTes">'+esc(t('Answered-prayer testimonies'))+'</label>'+
        D.testimonies.map(function(x,i){ return '<div class="icpTesRow">🎉 '+esc(x.text)+' <button class="gptX" data-icptesrm="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+
        '<div class="icpRow"><input id="icpTes" maxlength="400" placeholder="'+esc(t('What did God do?'))+'" value="'+esc(S.icpNewTes||'')+'"><button class="btn ghost small" id="icpTesAdd">'+esc(t('Add'))+'</button></div>';
    }
    h+='</div>';
  }
  h+='<div class="kmrActs"><button class="btn" id="icpSave"'+(S.icpBusy?' disabled':'')+'>'+esc(t('Save'))+'</button><button class="btn ghost" id="icpCancel">'+esc(t('Cancel'))+'</button></div>';
  if(icpWedOf_(date)) h+='<button class="linkbtn" id="icpDel" style="color:var(--warm)">'+esc(t('Remove this plan'))+'</button>';
  return h+'</div>';
}
/* what is typed, kept before every redraw */
function icpKeep_(){
  var D=S.icpDraft; if(D){
    var v=function(id){ var el=document.getElementById(id); return el ? el.value : null; };
    if(v('icpLeaderName')!=null) D.leaderName=v('icpLeaderName');
    if(v('icpFocus')!=null) D.focus=v('icpFocus');
    if(v('icpRef')!=null) D.scripture=v('icpRef');
    if(v('icpWorship')!=null) D.worship=v('icpWorship');
    if(v('icpNotes')!=null) D.notes=v('icpNotes');
    if(v('icpCame')!=null) D.came=v('icpCame');
    if(v('icpHours')!=null) D.hours=v('icpHours');
    if(v('icpItem')!=null) S.icpNewItem=v('icpItem');
    if(v('icpTes')!=null) S.icpNewTes=v('icpTes');
  }
  fastKeep_();
}

/* ---------- prayer needs ---------- */
var ICP_STATUS={ open:'Waiting', prayed:'Prayed', answered:'Answered' };
function icpSendFormHtml_(){
  var I=S.icp, opts=icpCampusMins_(), wedOpts=[0,1,2,3].map(function(k){ return icpAdd_(I.nextWed, k*7); });
  return '<div class="card icpSend" id="icpSend"><h3 style="margin-top:0">🙏 '+esc(t('Send a prayer need to Wednesday intercession'))+'</h3>'+
    '<textarea id="icpNeedText" rows="3" maxlength="500" placeholder="'+esc(t('What should we pray for?'))+'"></textarea>'+
    '<label class="f" for="icpNeedMin">'+esc(t('For which ministry (optional)'))+'</label><select id="icpNeedMin"><option value="">'+esc(t('Not for one ministry'))+'</option>'+
      opts.map(function(m){ var me=(m.dept===S.me.dept && m.min===S.me.ministry); return '<option value="'+esc(m.key)+'"'+(me?' selected':'')+'>'+esc(t(m.min))+' · '+esc(t(m.dept))+'</option>'; }).join('')+'</select>'+
    '<label class="f" for="icpNeedWed">'+esc(t('For which Wednesday'))+'</label><select id="icpNeedWed">'+wedOpts.map(function(d,i){ return '<option value="'+d+'">'+esc(i===0 ? gpT('The next Wednesday — {date}',{date:icpDay_(d)}) : icpDay_(d))+'</option>'; }).join('')+'</select>'+
    '<label class="icpPriv"><input type="checkbox" id="icpNeedPriv"> '+esc(t('Only the intercession team sees it'))+'</label>'+
    '<button class="btn" id="icpNeedSend"'+(S.icpBusy?' disabled':'')+'>'+esc(t('Send'))+'</button>'+
    '<p class="hint" style="margin:8px 0 0">'+esc(t('To share a request with everyone and see who prays, use Prayer.'))+' <button class="linkbtn inline" id="icpToPrayer" style="width:auto;padding:0">🙏 '+esc(t('Prayer'))+'</button></p></div>';
}
function icpNeedRowHtml_(n, canEdit){
  var h='<div class="icpNeed'+(n.status!=='open'?' done':'')+'" data-icpneedrow="'+esc(n.id)+'"><div class="icpNeedText">'+(n.private?'🔒 ':'')+esc(n.text)+'</div>'+
    '<div class="icpNeedMeta">'+[n.ministry ? icpMinName_(n.ministry) : '', icpDay_(n.wed), n.byName ? (n.mine ? t('You') : n.byName) : '', t(ICP_STATUS[n.status]||'')].filter(Boolean).map(esc).join(' · ')+'</div>'+
    (n.answer ? '<div class="icpNeedMeta">🎉 '+esc(n.answer)+'</div>' : '');
  var acts='';
  if(canEdit){
    if(n.status!=='prayed') acts+='<button class="btn ghost small" data-icpneed="'+esc(n.id)+'|prayed">🙏 '+esc(t('Prayed'))+'</button>';
    if(n.status!=='answered') acts+='<button class="btn ghost small" data-icpneed="'+esc(n.id)+'|answered">🎉 '+esc(t('Answered'))+'</button>';
    if(n.status!=='open') acts+='<button class="linkbtn inline" data-icpneed="'+esc(n.id)+'|open" style="width:auto;padding:0">'+esc(t('Open again'))+'</button>';
  }
  if(canEdit || n.mine) acts+='<button class="linkbtn inline" data-icpneeddel="'+esc(n.id)+'" style="width:auto;padding:0">'+esc(t('Delete'))+'</button>';
  return h+(acts ? '<div class="prActs">'+acts+'</div>' : '')+'</div>';
}
function icpReqHtml_(asMinistry){
  var I=S.icp, canEdit=asMinistry && I.canEdit, h=icpSendFormHtml_();
  var needs=I.needs||[];
  if(!canEdit){
    var mine=needs.filter(function(n){ return n.mine; });
    if(mine.length) h+='<div class="card"><h3 style="margin-top:0">'+esc(t('Needs I sent'))+'</h3>'+mine.map(function(n){ return icpNeedRowHtml_(n, false); }).join('')+'</div>';
    return h;
  }
  var open=needs.filter(function(n){ return n.status==='open'; }).sort(function(a,b){ return a.wed<b.wed ? -1 : 1; }), done=needs.filter(function(n){ return n.status!=='open'; });
  h+='<div class="card" id="icpNeedsOpen"><h3 style="margin-top:0">🙏 '+esc(gpT('Waiting to be prayed for · {n}',{n:open.length}))+'</h3>'+
    (open.length ? open.map(function(n){ return icpNeedRowHtml_(n, true); }).join('') : '<p class="sub" style="margin:0">'+esc(t('No prayer needs waiting. Anyone on staff can send one from ☰ → Prayer.'))+'</p>')+'</div>';
  if(done.length) h+='<details class="icpPast"><summary>'+esc(gpT('Prayed for and answered ({n})',{n:done.length}))+'</summary>'+done.map(function(n){ return icpNeedRowHtml_(n, true); }).join('')+'</details>';
  return h;
}

/* ---------- the fast ---------- */
function fastKindName_(k){ for(var i=0;i<FAST_KINDS.length;i++) if(FAST_KINDS[i][0]===k) return t(FAST_KINDS[i][1]); return k; }
function fastDate_(f, day){ return icpAdd_(f.start, day-1); }
function fastStateText_(f){ return f.state==='coming' ? gpT('Starts {date}',{date:icpDay_(f.start)}) : f.state==='ended' ? gpT('Ended {date}',{date:icpDay_(f.end)}) : gpT('Day {n} of {days}',{n:f.day, days:f.days}); }
function fastPlanDay_(f, n){ return (f.plan||[])[n-1]||{}; }
/* what everyone sees: the plan, today's focus, joining and ticking */
function fastPublicHtml_(f){
  var n=f.state==='running' ? f.day : 1, p=fastPlanDay_(f, n);
  var h='<div class="card icpFast" data-fastid="'+esc(f.id)+'"'+(f.id===S.icp.current?' id="icpFastCard"':'')+'><div class="icpWedTop"><b>🍞 '+esc(f.title)+'</b> <span class="icpTag'+(f.state==='running'?' ok':'')+'">'+esc(fastStateText_(f))+'</span></div>'+
    '<div class="icpLine hint">'+esc(icpDay_(f.start))+' – '+esc(icpDay_(f.end))+'</div>'+
    (f.theme ? '<div class="icpLine">🎯 '+esc(f.theme)+'</div>' : '');
  if(f.state!=='ended' && (p.focus || p.ref)) h+='<div class="icpToday"><div class="eyebrow">'+esc(f.state==='running' ? t('Today’s focus') : t('Day 1’s focus'))+'</div>'+
    (p.focus ? '<b>'+esc(p.focus)+'</b>' : '')+(p.ref ? '<div>📖 '+esc(p.ref)+'</div>' : '')+(p.note ? '<div class="hint">'+esc(p.note)+'</div>' : '')+'</div>';
  var gt=(f.gatherings||[]).filter(function(g){ return g.day===n; });
  if(f.state==='running' && gt.length) h+='<div class="icpLine">📍 '+esc(t('Praying together today'))+': '+gt.map(function(g){ return esc([g.time, g.place].filter(Boolean).join(' · ')); }).join('; ')+'</div>';
  var m=f.mine;
  if(f.state!=='ended'){
    if(!m){
      h+='<div class="icpJoin"><label class="f">'+esc(t('Join the fast — what kind of fast?'))+'</label><div class="icpChips">'+
        FAST_KINDS.map(function(k){ return '<button class="deptChip" data-fastjoin="'+k[0]+'">'+esc(t(k[1]))+'</button>'; }).join('')+'</div>'+
        '<p class="hint" style="margin:6px 0 0">'+esc(t('Anyone with a health condition, or who is pregnant or nursing, should choose a partial fast or ask a doctor first.'))+'</p>'+
        '<p class="hint" style="margin:4px 0 0">🔒 '+esc(t('Only you see that you joined and what you chose. The intercession team sees how many, never who.'))+'</p></div>';
    } else {
      h+='<div class="icpLine">✅ '+esc(gpT('You joined: {kind}',{kind:fastKindName_(m.kind)}))+' · <button class="linkbtn inline" data-fastleave="1" style="width:auto;padding:0">'+esc(t('Leave the fast'))+'</button></div>';
    }
  }
  if(m && f.state!=='coming'){
    var upto=Math.min(f.days, f.state==='ended' ? f.days : f.day);
    h+='<label class="f">'+esc(gpT('Days done · {n} of {days}',{n:m.ticks.length, days:f.days}))+'</label><div class="fastDays">';
    for(var d=1; d<=f.days; d++){ var on=m.ticks.indexOf(d)>-1, can=d<=upto && f.state!=='ended';
      h+='<button class="fastDay'+(on?' on':'')+(d===f.day && f.state==='running'?' now':'')+'" data-fasttick="'+d+'"'+(can?'':' disabled')+' aria-label="'+esc(gpT('Day {n}',{n:d}))+'">'+d+'</button>'; }
    h+='</div>';
  }
  h+='<details class="icpPast"><summary>'+esc(t('Every day’s focus'))+'</summary>'+(f.plan||[]).map(function(x,i){
      return '<div class="fastPlanRow'+(f.state==='running' && i+1===f.day?' now':'')+'"><span class="fastPlanN">'+(i+1)+'</span><span><b>'+esc(x.focus||'—')+'</b>'+(x.ref?' · 📖 '+esc(x.ref):'')+
        '<span class="hint"> · '+esc(icpDay_(fastDate_(f, i+1)))+'</span></span></div>'; }).join('')+
    ((f.gatherings||[]).length ? '<div class="icpMinDept">'+esc(t('Praying together'))+'</div>'+(f.gatherings||[]).map(function(g){
      return '<div class="fastPlanRow"><span class="fastPlanN">'+g.day+'</span><span>'+esc([icpDay_(fastDate_(f, g.day)), g.time, g.place, g.leader].filter(Boolean).join(' · '))+'</span></div>'; }).join('') : '')+'</details>';
  return h+'</div>';
}
function fastTabNewStart_(){
  var now=new Date(); if(now.getMonth()>=8){ var d=new Date(now.getFullYear()+1, 0, 1); while(d.getDay()!==1) d.setDate(d.getDate()+1); return isoDateOf_(d); }
  return icpAdd_(todayStr(), 7);
}
function icpFastTabHtml_(){
  var I=S.icp, h='';
  if(S.fastDraft) return fastFormHtml_();
  if(I.canEdit) h+='<button class="btn" id="fastNew" style="margin-top:0">＋ '+esc(t('Plan a fast'))+'</button>';
  if(!(I.fasts||[]).length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('No fast planned yet. Plan one — a 21-day fast and prayer in January, or any length from 7 to 40 days — and everyone on the campus can join it.'))+'</p></div>';
  (I.fasts||[]).forEach(function(f){
    if(I.canEdit && f.counts) h+='<div class="mmGrid fastCounts" data-fastcounts="'+esc(f.id)+'">'+
      [[t('Joined'), f.counts.joined],[t('Prayed today'), f.state==='running' ? f.counts.today : '—'],[t('Days ticked'), f.counts.ticks],
       [t('Gatherings held'), (f.gatherings||[]).filter(function(g){ return g.held===true; }).length]].map(function(x){ return '<div class="mmTile"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
    h+=fastPublicHtml_(f);
    if(I.canEdit) h+='<div class="kmrActs" style="margin-top:-6px"><button class="btn ghost small" data-fastedit="'+esc(f.id)+'">'+esc(t('Edit the fast'))+'</button><button class="linkbtn inline" data-fastdel="'+esc(f.id)+'" style="width:auto;padding:0;color:var(--warm)">'+esc(t('Delete'))+'</button></div>';
  });
  return h;
}
function fastStartEdit_(id){
  var f=id ? (S.icp.fasts||[]).filter(function(x){ return x.id===id; })[0] : null;
  if(f) S.fastDraft={ id:f.id, title:f.title, start:f.start, days:f.days, theme:f.theme, plan:JSON.parse(JSON.stringify(f.plan||[])), gatherings:JSON.parse(JSON.stringify(f.gatherings||[])) };
  else S.fastDraft={ id:'', title:t('21-day fast and prayer'), start:fastTabNewStart_(), days:21, theme:'', plan:[], gatherings:[] };
  fastFitPlan_();
}
function fastFitPlan_(){ var F=S.fastDraft; var n=Math.max(7, Math.min(40, Number(F.days)||21)); while(F.plan.length<n) F.plan.push({ focus:'', ref:'', note:'' }); }
function fastFormHtml_(){
  var F=S.fastDraft, n=Math.max(7, Math.min(40, Number(F.days)||21)), today=S.icp.today;
  var h='<div class="card icpForm" id="fastForm"><h3 style="margin-top:0">🍞 '+esc(F.id ? t('Edit the fast') : t('Plan a fast'))+'</h3>'+
    '<label class="f" for="fastTitle">'+esc(t('Title'))+'</label><input id="fastTitle" maxlength="100" value="'+esc(F.title)+'">'+
    '<div class="icpRow"><label>'+esc(t('First day'))+'<input type="date" id="fastStart" value="'+esc(F.start)+'"></label>'+
    '<label>'+esc(t('How many days'))+'<input type="number" inputmode="numeric" min="7" max="40" id="fastDaysN" value="'+esc(String(F.days))+'"></label></div>'+
    '<label class="f" for="fastTheme">'+esc(t('Theme'))+'</label><input id="fastTheme" maxlength="200" value="'+esc(F.theme)+'">'+
    '<div class="icpMinDept">'+esc(t('Each day’s focus'))+'</div><button class="btn ghost small" id="fastTpl">📋 '+esc(t('Fill in our 21 themes'))+'</button>'+
    '<div class="fastPlanEdit">';
  for(var i=0;i<n;i++){ var p=F.plan[i]||{};
    h+='<div class="fastPlanEditRow"><span class="fastPlanN">'+(i+1)+'</span><div class="fastPlanFields"><span class="hint">'+esc(icpDay_(icpAdd_(F.start||today, i)))+'</span>'+
      '<input data-fd="'+i+'|focus" maxlength="120" placeholder="'+esc(t('Focus'))+'" value="'+esc(p.focus||'')+'">'+
      '<input data-fd="'+i+'|ref" maxlength="80" placeholder="'+esc(t('Scripture (the reference)'))+'" value="'+esc(p.ref||'')+'">'+
      '<input data-fd="'+i+'|note" maxlength="400" placeholder="'+esc(t('A note (optional)'))+'" value="'+esc(p.note||'')+'"></div></div>';
  }
  h+='</div><div class="icpMinDept">'+esc(t('Praying together'))+'</div>';
  (F.gatherings||[]).forEach(function(g,i){
    var date=icpAdd_(F.start||today, (Number(g.day)||1)-1), past=date<=today;
    h+='<div class="fastGRow" data-fgrow="'+i+'"><select data-fg="'+i+'|day" aria-label="'+esc(t('Day'))+'">'+Array.apply(null, Array(n)).map(function(_,k){ return '<option value="'+(k+1)+'"'+(Number(g.day)===k+1?' selected':'')+'>'+esc(gpT('Day {n}',{n:k+1}))+'</option>'; }).join('')+'</select>'+
      '<input type="time" data-fg="'+i+'|time" value="'+esc(g.time||'')+'" aria-label="'+esc(t('Time'))+'">'+
      '<input data-fg="'+i+'|place" maxlength="80" placeholder="'+esc(t('Where'))+'" value="'+esc(g.place||'')+'">'+
      '<input data-fg="'+i+'|leader" maxlength="80" placeholder="'+esc(t('Who leads'))+'" value="'+esc(g.leader||'')+'">'+
      (past ? '<label class="icpPriv"><input type="checkbox" data-fg="'+i+'|held"'+(g.held===true?' checked':'')+'> '+esc(t('Held'))+'</label>'+
        '<input type="number" step="0.25" min="0" max="24" data-fg="'+i+'|hours" placeholder="'+esc(t('Hours'))+'" value="'+esc(g.hours==null?'':String(g.hours))+'">' : '')+
      '<button class="gptX" data-fgrm="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></div>';
  });
  h+='<div class="kmrActs"><button class="btn ghost small" id="fastGAdd">＋ '+esc(t('Add a gathering'))+'</button><button class="btn ghost small" id="fastGDaily">＋ '+esc(t('One every day'))+'</button></div>'+
    '<div class="kmrActs"><button class="btn" id="fastSaveBtn"'+(S.icpBusy?' disabled':'')+'>'+esc(t('Save'))+'</button><button class="btn ghost" id="fastCancel">'+esc(t('Cancel'))+'</button></div></div>';
  return h;
}
function fastKeep_(){
  var F=S.fastDraft; if(!F || !document.getElementById('fastForm')) return;
  var v=function(id){ var el=document.getElementById(id); return el ? el.value : null; };
  if(v('fastTitle')!=null) F.title=v('fastTitle');
  if(v('fastStart')!=null) F.start=v('fastStart');
  if(v('fastDaysN')!=null) F.days=v('fastDaysN');
  if(v('fastTheme')!=null) F.theme=v('fastTheme');
  document.querySelectorAll('[data-fd]').forEach(function(el){ var a=el.getAttribute('data-fd').split('|'); (F.plan[Number(a[0])]=F.plan[Number(a[0])]||{})[a[1]]=el.value; });
  document.querySelectorAll('[data-fg]').forEach(function(el){ var a=el.getAttribute('data-fg').split('|'), g=F.gatherings[Number(a[0])]; if(!g) return;
    if(a[1]==='held') g.held=el.checked ? true : null; else if(a[1]==='day') g.day=Number(el.value); else if(a[1]==='hours') g.hours=el.value==='' ? null : Number(el.value); else g[a[1]]=el.value; });
}

/* ---------- Dashboard ---------- */
function icpDashHtml_(){
  var I=S.icp, D=I.dash||{}, tiles=[
    [t('Wednesdays held'), (D.wedsHeld||0)+(D.wedsPlanned ? ' / '+D.wedsPlanned : '')],
    [t('Average attendance'), D.avgCame==null ? '—' : D.avgCame],
    [t('Prayer hours'), D.hours||0],
    [t('Ministries covered'), D.ministries||0],
    [t('Testimonies'), D.testimonies||0],
    [t('Needs answered'), (D.answered||0)+' / '+(D.needs||0)]];
  var h='<h3 class="icpHead" id="icpDash">📊 '+esc(gpT('This year · {year}',{year:D.year||''}))+'</h3><div class="mmGrid">'+tiles.map(function(x){ return '<div class="mmTile"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  h+='<p class="hint">🔄 '+esc(t('Prayer meetings, prayer hours, ministries covered and testimonies count themselves from the Wednesdays and the fast’s gatherings. Only the director’s weekly score is typed, on Numbers.'))+'</p>';
  (I.fasts||[]).forEach(function(f){ if(!f.counts) return;
    h+='<div class="card"><b>🍞 '+esc(f.title)+'</b> <span class="hint">'+esc(icpDay_(f.start))+' – '+esc(icpDay_(f.end))+'</span><div class="icpLine">'+
      esc(gpT('{n} joined · {d} days ticked · {g} gatherings held',{ n:f.counts.joined, d:f.counts.ticks, g:(f.gatherings||[]).filter(function(g){ return g.held===true; }).length }))+'</div></div>'; });
  var tes=[]; (I.weds||[]).forEach(function(w){ if(w.held===true) w.testimonies.forEach(function(x){ tes.push({ date:w.date, text:x.text }); }); });
  if(tes.length) h+='<div class="card"><h3 style="margin-top:0">🎉 '+esc(t('What God did'))+'</h3>'+tes.slice(0, 12).map(function(x){ return '<div class="icpTesRow">'+esc(x.text)+' <span class="hint">· '+esc(icpDay_(x.date))+'</span></div>'; }).join('')+'</div>';
  return h;
}

/* ---------- the page for everyone (S.view='icp'): the next Wednesday, sending a need, the fast ---------- */
function icpOpen_(sub){ S.icpSub=sub||'wed'; S.view='icp'; S.icp=null; S.icpErr=''; render(); window.scrollTo(0,0); }
function icpPageHtml_(){
  var h='<button class="linkbtn" id="icpBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>'+
    '<h2>🙏 '+esc(t('Wednesday intercession'))+'</h2><p class="sub">'+esc(t('Every Wednesday the intercession team prays for the base and its ministries. Send them a need, and join the fast when there is one.'))+'</p>';
  if(!S.icp) return h+icpLoadHtml_();
  var I=S.icp, cur=(I.fasts||[]).filter(function(f){ return f.id===I.current; })[0];
  if(I.canEdit) h+='<button class="btn ghost" id="icpToMm" style="margin-top:0">'+esc(t('Open Intercession on My Ministry'))+'</button>';
  if(cur && S.icpSub==='fast') h+=fastPublicHtml_(cur);
  var w=icpWedOf_(I.nextWed);
  h+='<h3 class="icpHead">📅 '+esc(t('The next Wednesday'))+'</h3>'+icpWedCardHtml_(I.nextWed, w, false);
  h+=icpReqHtml_(false);
  if(cur && S.icpSub!=='fast') h+=fastPublicHtml_(cur);
  return h;
}

/* ---------- the bell, ☰ and the boot's summary (S.fast) ---------- */
function fastNotifItems_(){
  var f=S.fast, out=[]; if(!f || S.student || S.guest || S.board) return out;
  var btn='<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gofast="1">'+esc(t('Open'))+'</button>';
  if(f.mine && f.state==='running' && (f.mine.ticks||[]).indexOf(f.day)===-1)
    out.push({ when:f.today||todayStr(), text:'🍞 '+gpT('Day {n} of {title}: {focus}',{ n:f.day, title:f.title, focus:f.focus||f.theme||'' }), actions:btn });
  else if(!f.mine){
    var from=f.state==='coming' ? icpAdd_(f.start, -14) : f.start;
    if(from<=(f.today||todayStr())) out.push({ when:from, text:'🍞 '+(f.state==='coming' ? gpT('{title} starts {date} — join in',{ title:f.title, date:icpDay_(f.start) }) : gpT('{title} is on — join in',{ title:f.title })), actions:btn });
  }
  return out;
}
function bindGoFast_(sel){
  document.querySelectorAll(sel).forEach(function(b){ b.onclick=function(){ gpTap(); S.bellOpen=false; if(typeof renderNotifPanel==='function') renderNotifPanel(); icpOpen_('fast'); }; });
}

/* ---------- binding ---------- */
function icpCall_(fn, args, then){
  if(S.icpBusy) return; S.icpBusy=true;
  run(fn,[S.auth.user,S.auth.pin].concat(args),function(d){
    S.icpBusy=false;
    if(d && d.ok){ S.icp=d; if(then) then(d); icpGlanceFrom_(d); render(); return; }
    var e=d && d.err;
    showMsg(e==='too_many' ? t('That is a lot for one day — try again tomorrow.') : e==='not_authorized' ? t('Only the intercession team can change this.') : e==='no_title' ? t('Give the fast a title.') :
      e==='bad_days' ? t('A fast is 7 to 40 days.') : e==='bad_date' ? t('Check the date.') : e==='empty' ? t('Write the need first.') : e==='ended' ? t('This fast has ended.') : t('Could not save — try again.'));
    render();
  }, function(){ S.icpBusy=false; showMsg(t('No connection — try again when you are online.')); render(); });
}
/* the boot's summary follows what was just saved, so the bell and ☰ agree with the page */
function icpGlanceFrom_(d){
  var f=(d.fasts||[]).filter(function(x){ return x.id===d.current; })[0];
  if(!f){ S.fast=null; return; }
  var n=f.state==='running' ? f.day : 1, p=(f.plan||[])[n-1]||{};
  S.fast={ id:f.id, title:f.title, theme:f.theme, start:f.start, days:f.days, state:f.state, day:f.day, today:d.today, focus:p.focus||'', ref:p.ref||'',
    gatherToday:(f.gatherings||[]).filter(function(g){ return g.day===f.day; }), mine:f.mine };
}
function bindIcp_(){
  bindGoFast_('#main [data-gofast]');
  var pti=document.getElementById('prToIcp'); if(pti) pti.onclick=function(){ gpTap(); icpOpen_('wed'); };
  var inMin=S.view==='ministry' && isIcpMinistry_(S.mmBrowseDept, S.mmBrowseMinistry);
  if(!(inMin || S.view==='icp')) return;
  var rt=document.getElementById('icpRetry'); if(rt) rt.onclick=function(){ S.icpErr=''; render(); };
  var bk=document.getElementById('icpBack'); if(bk) bk.onclick=function(){ gpTap(); S.view='week'; render(); };
  var tm=document.getElementById('icpToMm'); if(tm) tm.onclick=function(){ gpTap(); S.view='ministry'; S.mmBrowseDept='Youth Education'; S.mmBrowseMinistry='Intercession'; S.mmTab='icwed'; S.mmTabTouched=true; render(); window.scrollTo(0,0); };
  var tp=document.getElementById('icpToPrayer'); if(tp) tp.onclick=function(){ gpTap(); S.view='prayer'; S.pr=null; render(); window.scrollTo(0,0); };
  if(!S.icp) return;
  // Wednesdays
  document.querySelectorAll('[data-icpwed]').forEach(function(b){ b.onclick=function(){ gpTap(); icpStartEdit_(b.getAttribute('data-icpwed')); render(); var f=document.getElementById('icpForm'); if(f && f.scrollIntoView) f.scrollIntoView({ block:'start' }); }; });
  var cl=document.getElementById('icpCopyLast'); if(cl) cl.onclick=function(){
    icpKeep_(); var date=S.icpEdit, prev=(S.icp.weds||[]).filter(function(w){ return w.date<date; })[0]; if(!prev) return;
    var D=S.icpDraft; ['leaderId','leaderName','focus','scripture','worship','notes'].forEach(function(k){ D[k]=prev[k]||''; }); D.mins=(prev.mins||[]).slice(); D.items=(prev.items||[]).slice();
    showMsg(t('Copied — change what you need')); render(); };
  document.querySelectorAll('[data-icpmin]').forEach(function(b){ b.onclick=function(){ icpKeep_(); var k=b.getAttribute('data-icpmin'), D=S.icpDraft, i=D.mins.indexOf(k);
    if(i>-1) D.mins.splice(i,1); else D.mins.push(k); b.classList.toggle('on', i===-1);
    var sm=b.closest('details') && b.closest('details').querySelector('summary'); if(sm) sm.textContent=gpT('{n} chosen',{n:D.mins.length}); }; });
  var mp=document.getElementById('icpMinPick'); if(mp) mp.ontoggle=function(){ S.icpMinOpen=mp.open; };
  var ia=document.getElementById('icpItemAdd'); if(ia) ia.onclick=function(){ icpKeep_(); var v=String(S.icpNewItem||'').trim(); if(!v) return; S.icpDraft.items.push(v.slice(0,120)); S.icpNewItem=''; render(); };
  document.querySelectorAll('[data-icpitemrm]').forEach(function(b){ b.onclick=function(){ icpKeep_(); S.icpDraft.items.splice(Number(b.getAttribute('data-icpitemrm')),1); render(); }; });
  document.querySelectorAll('[data-icpheld]').forEach(function(b){ b.onclick=function(){ icpKeep_(); var v=b.getAttribute('data-icpheld')==='1'; S.icpDraft.held = S.icpDraft.held===v ? null : v; render(); }; });
  var ta=document.getElementById('icpTesAdd'); if(ta) ta.onclick=function(){ icpKeep_(); var v=String(S.icpNewTes||'').trim(); if(!v) return; S.icpDraft.testimonies.push({ text:v.slice(0,400) }); S.icpNewTes=''; render(); };
  document.querySelectorAll('[data-icptesrm]').forEach(function(b){ b.onclick=function(){ icpKeep_(); S.icpDraft.testimonies.splice(Number(b.getAttribute('data-icptesrm')),1); render(); }; });
  var cc=document.getElementById('icpCancel'); if(cc) cc.onclick=function(){ S.icpEdit=null; S.icpDraft=null; render(); };
  var sv=document.getElementById('icpSave'); if(sv) sv.onclick=function(){
    icpKeep_(); var D=S.icpDraft, date=S.icpEdit;
    if(String(S.icpNewTes||'').trim()){ D.testimonies.push({ text:String(S.icpNewTes).trim().slice(0,400) }); S.icpNewTes=''; }
    if(String(S.icpNewItem||'').trim()){ D.items.push(String(S.icpNewItem).trim().slice(0,120)); S.icpNewItem=''; }
    var rec={ leaderId:D.leaderId, leaderName:D.leaderName, focus:D.focus, scripture:D.scripture, worship:D.worship, mins:D.mins, items:D.items, notes:D.notes,
      held:D.held, came:D.came===''?null:Number(D.came), hours:D.hours===''?null:Number(D.hours), testimonies:D.testimonies };
    icpCall_('intercessionSaveWed',[date, rec], function(){ S.icpEdit=null; S.icpDraft=null; gpTap(); showMsg(t('Saved')); });
  };
  var dl=document.getElementById('icpDel'); if(dl) dl.onclick=function(){ if(!gpAsk_(t('Remove this Wednesday’s plan?'))) return; var date=S.icpEdit; icpCall_('intercessionSaveWed',[date, null], function(){ S.icpEdit=null; S.icpDraft=null; }); };
  // needs
  var ns=document.getElementById('icpNeedSend'); if(ns) ns.onclick=function(){
    var tx=String((document.getElementById('icpNeedText')||{}).value||'').trim(); if(!tx){ showMsg(t('Write the need first.')); return; }
    icpCall_('intercessionNeedSend',[{ text:tx, ministry:(document.getElementById('icpNeedMin')||{}).value||'', wed:(document.getElementById('icpNeedWed')||{}).value||'', private:!!(document.getElementById('icpNeedPriv')||{}).checked }],
      function(){ gpTap(); showMsg(t('Sent to the intercession team 🙏')); });
  };
  document.querySelectorAll('[data-icpneed]').forEach(function(b){ b.onclick=function(){
    var v=b.getAttribute('data-icpneed').split('|'), ans='';
    if(v[1]==='answered'){ ans=gpAskText_(t('How was it answered? (optional)'), ''); if(ans===null) return; }
    gpTap(); icpCall_('intercessionNeedMark',[v[0], v[1], ans||'']); }; });
  document.querySelectorAll('[data-icpneeddel]').forEach(function(b){ b.onclick=function(){ if(!gpAsk_(t('Delete this prayer need?'))) return; icpCall_('intercessionNeedDelete',[b.getAttribute('data-icpneeddel')]); }; });
  // the fast
  document.querySelectorAll('[data-fastjoin]').forEach(function(b){ b.onclick=function(){ var f=S.icp.current||((S.icp.fasts||[])[0]||{}).id, card=b.closest('.icpFast');
    var fid=card ? card.getAttribute('data-fastid') : f; gpTap(); icpCall_('fastJoin',[fid||f, b.getAttribute('data-fastjoin')], function(){ showMsg(t('You joined the fast 🙏')); if(typeof gpConfetti==='function') try { gpConfetti(); } catch(e){} }); }; });
  document.querySelectorAll('[data-fastleave]').forEach(function(lv){ lv.onclick=function(){ if(!gpAsk_(t('Leave the fast? Your ticked days go too.'))) return; var card=lv.closest('.icpFast'); icpCall_('fastJoin',[card ? card.getAttribute('data-fastid') : S.icp.current, '']); }; });
  document.querySelectorAll('[data-fasttick]').forEach(function(b){ b.onclick=function(){ var card=b.closest('.icpFast'), on=b.classList.contains('on'); gpTap();
    icpCall_('fastTick',[card ? card.getAttribute('data-fastid') : S.icp.current, Number(b.getAttribute('data-fasttick')), !on]); }; });
  var fn=document.getElementById('fastNew'); if(fn) fn.onclick=function(){ gpTap(); fastStartEdit_(''); render(); };
  document.querySelectorAll('[data-fastedit]').forEach(function(b){ b.onclick=function(){ gpTap(); fastStartEdit_(b.getAttribute('data-fastedit')); render(); }; });
  document.querySelectorAll('[data-fastdel]').forEach(function(b){ b.onclick=function(){ if(!gpAsk_(t('Delete this fast? Everyone who joined it is taken off too.'))) return; icpCall_('fastDelete',[b.getAttribute('data-fastdel')]); }; });
  var fdn=document.getElementById('fastDaysN'); if(fdn) fdn.onchange=function(){ fastKeep_(); fastFitPlan_(); render(); };
  var fst=document.getElementById('fastStart'); if(fst) fst.onchange=function(){ fastKeep_(); render(); };
  var tpl=document.getElementById('fastTpl'); if(tpl) tpl.onclick=function(){
    fastKeep_(); var F=S.fastDraft, n=Math.min(Number(F.days)||21, 40), filled=F.plan.some(function(p,i){ return i<n && (p.focus||p.ref); });
    if(filled && !gpAsk_(t('Replace the days you have filled in with our themes?'))) return;
    for(var i=0;i<n;i++){ var x=ICP_FAST_TPL[i % ICP_FAST_TPL.length]; F.plan[i]={ focus:LANG==='km' ? x.km : x.en, ref:x.ref, note:(F.plan[i]||{}).note||'' }; }
    render(); };
  var ga=document.getElementById('fastGAdd'); if(ga) ga.onclick=function(){ fastKeep_(); S.fastDraft.gatherings.push({ day:1, time:'', place:'', leader:'', held:null, hours:null }); render(); };
  var gd=document.getElementById('fastGDaily'); if(gd) gd.onclick=function(){
    fastKeep_(); var F=S.fastDraft, n=Math.max(7, Math.min(40, Number(F.days)||21)), last=F.gatherings[F.gatherings.length-1]||{};
    for(var d=1; d<=n; d++) if(!F.gatherings.some(function(g){ return Number(g.day)===d; })) F.gatherings.push({ day:d, time:last.time||'', place:last.place||'', leader:'', held:null, hours:null });
    F.gatherings.sort(function(a,b){ return a.day-b.day; }); render(); };
  document.querySelectorAll('[data-fgrm]').forEach(function(b){ b.onclick=function(){ fastKeep_(); S.fastDraft.gatherings.splice(Number(b.getAttribute('data-fgrm')),1); render(); }; });
  var fc=document.getElementById('fastCancel'); if(fc) fc.onclick=function(){ S.fastDraft=null; render(); };
  var fsv=document.getElementById('fastSaveBtn'); if(fsv) fsv.onclick=function(){
    fastKeep_(); var F=S.fastDraft, n=Math.max(7, Math.min(40, Number(F.days)||21));
    var rec={ id:F.id||'', title:F.title, start:F.start, days:Number(F.days), theme:F.theme, plan:F.plan.slice(0, n),
      gatherings:F.gatherings.filter(function(g){ return Number(g.day)>=1 && Number(g.day)<=n; }) };
    icpCall_('fastSave',[rec], function(){ S.fastDraft=null; gpTap(); showMsg(t('Saved')); });
  };
}
