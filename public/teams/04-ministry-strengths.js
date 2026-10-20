/* My YWAM GP — teams.html, part 4 of 11: ministry tools, Team → Personalities, GP Strengths, My Home.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ==================== ministry tools (My Ministry) ====================
   My Ministry as a tool each ministry uses, with its numbers as a by-product
   (Uriah, Oct 2026). Campus Leadership has "My week"; the Cafe has a till and
   its day. Each saves its own records on the server, which works out the
   week's totals and writes them into the ministry's numbers (toolSync_ in
   api.js) — so nobody types Cups Sold or One-on-Ones Held. */
function money_(n){ return '$'+(Number(n)||0).toFixed(2); }
function shortTime_(iso){ var d=new Date(iso); return isNaN(d) ? '' : ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
function staffName_(id){ var p=(S.roster||[]).filter(function(x){ return x.id===id; })[0]; return p ? p.name : (S.me && S.me.id===id ? S.me.name : ''); }

/* ---------- Campus Leadership: My week ---------- */
var LW_KINDS=[['oneonone','🤝','One-on-one'],['partner','🙏','Partner connection'],['church','⛪','Spoke at a church'],['base','🏠','Spoke at a YWAM base'],
  ['gospel','📣','Shared the gospel'],['teaching','📖','Teaching prepped'],['meeting','👥','Meeting led'],['deptmeeting','🗂️','Department meeting']];
var LW_NOTE={ oneonone:'What you talked about (optional)', partner:'What you talked about (optional)', church:'Which church?', base:'Which base?',
  gospel:'Where, and with whom? (optional)', teaching:'Topic', meeting:'Which meeting?', deptmeeting:'Which department?' };
var PLANT_STAGES_UI=[['praying','Praying'],['exploring','Exploring'],['planning','Planning'],['preparing','Preparing'],['launched','Launched']];
S.lw=null; S.lwWeek=null; S.lwLoading=false; S.lwForm=null; S.lwTab=lwTabKept_(); S.lwErr='';
/* ---------- each leader's own board ----------
   Oct 2026 (Uriah): "for all the campus leadership, each person should have a slightly
   different My Ministry board. Not everyone has the same thing." Their title (orgTitleOf_)
   decides the order of the tabs, the line under it saying what the role is about, the four
   numbers at the top of Overview, and which kinds come first under "Log something":
   - International Campus Director: vision, partners and new bases.
   - National Campus Director: the staff and the week's rhythm.
   - Director of <department>: their own department — the Overview tab is "My department".
   - A Campus Director with no title yet: the whole base, as before.
   Every role opens on Overview each time the app is opened; a tab chosen stays only for
   that visit (sessionStorage), so the page always starts where the role's work is. */
var LW_ROLES={
  icd:{ tabs:['base','okrs','week','board','tasks','money'], focus:'Vision, partners and new bases', tiles:['partners','plants','money','leaders'],
    kinds:['partner','church','base','oneonone','teaching','gospel','meeting','deptmeeting'] },
  ncd:{ tabs:['base','okrs','board','tasks','week','money'], focus:'The staff and the week’s rhythm', tiles:['away','oneonones','numbers','tues'],
    kinds:['oneonone','meeting','deptmeeting','church','gospel','teaching','partner','base'] },
  dept:{ tabs:['base','okrs','board','tasks','week','money'], focus:'Your department: its ministries, leaders and numbers', tiles:[],
    kinds:['deptmeeting','oneonone','meeting','teaching','gospel','partner','church','base'] },
  cd:{ tabs:['base','okrs','week','board','tasks','money'], focus:'', tiles:['leaders','numbers','tues','money'], kinds:[] }
};
function lwRole_(){
  var tt=typeof orgTitleOf_==='function' ? orgTitleOf_(S.me) : '';
  return tt==='International Campus Director' ? 'icd' : tt==='National Campus Director' ? 'ncd' : /^Director of /.test(tt) ? 'dept' : 'cd';
}
function lwTabKept_(){ try{ var v=sessionStorage.getItem('gp-lw-tab'); return ['base','okrs','week','board','tasks','money'].indexOf(v)>-1 ? v : null; }catch(e){ return null; } }
function lwTabKeep_(v){ try{ sessionStorage.setItem('gp-lw-tab', v); }catch(e){} }
/* The tab to show: the one chosen this visit, else the role's first. */
function lwTabNow_(){ var R=LW_ROLES[lwRole_()]; return R.tabs.indexOf(S.lwTab)>-1 ? S.lwTab : R.tabs[0]; }
function lwKindsFor_(){
  var order=LW_ROLES[lwRole_()].kinds;
  return order.length ? order.map(lwKind_).concat(LW_KINDS.filter(function(k){ return order.indexOf(k[0])<0; })) : LW_KINDS;
}
function lwKind_(k){ return LW_KINDS.filter(function(x){ return x[0]===k; })[0] || [k,'•',k]; }
function lwLoad_(wk){
  if(S.lwLoading) return; S.lwLoading=true; S.lwErr='';
  run('leadWeek',[S.auth.user,S.auth.pin,wk],function(d){ S.lwLoading=false; if(d && d.ok && d.week===wk) S.lw=d; else S.lwErr=(d&&d.err)||'error'; if(S.view==='ministry') render(); },
    function(e){ S.lwLoading=false; S.lwErr=String((e&&e.message)||'offline'); if(S.view==='ministry') render(); });
}
function lwDatesOf_(wk){ var mon=mondayOfWeek_(wk), out=[]; for(var i=0;i<7;i++){ var d=new Date(mon); d.setDate(d.getDate()+i); out.push(isoDateOf_(d)); } return out; }
function lwHtml_(){
  var wk=S.lwWeek||thisWeek(); S.lwWeek=wk;
  if(!S.lw || S.lw.week!==wk){
    if(S.lwErr) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load your week.'))+'</p><button class="btn ghost" id="lwRetry">'+esc(t('Try again'))+'</button></div>';
    lwLoad_(wk); return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  }
  var L=S.lw, now=thisWeek(), dates=lwDatesOf_(wk);
  var h='<div class="weekNavRow"><button class="weekArrow" id="lwPrev"'+(wk<=1?' disabled':'')+' aria-label="'+esc(t('Previous week'))+'">‹</button>'+
    '<div class="weekPill">'+esc(t('Week'))+' '+wk+' · '+esc(weekRangeShort_(wk))+'</div>'+
    '<button class="weekArrow" id="lwNext"'+(wk>=now?' disabled':'')+' aria-label="'+esc(t('Next week'))+'">›</button></div>';
  // the week's numbers, counted from what is logged below
  var count=function(k){ return L.log.filter(function(r){ return r.kind===k; }).reduce(function(a,r){ return a+(Number(r.qty)||1); },0); };
  var kinds=lwKindsFor_();
  h+='<div class="lwTotals">'+kinds.map(function(k){ var n=count(k[0]);
    return '<div class="lwTotal'+(n?' on':'')+'"><span>'+k[1]+'</span><b>'+(k[0]==='gospel'?(Math.round(n*10)/10)+'h':n)+'</b><small>'+esc(t(k[2]))+'</small></div>'; }).join('')+'</div>';
  h+='<p class="hint" style="margin:-2px 0 12px">'+esc(t('These are your leadership numbers for the week — counted from what you log here.'))+'</p>';
  // quick log
  h+='<h3>➕ '+esc(t('Log something'))+'</h3><div class="lwKinds">'+kinds.map(function(k){
    return '<button class="lwKind'+(S.lwForm&&S.lwForm.kind===k[0]?' on':'')+'" data-lwkind="'+k[0]+'"><span>'+k[1]+'</span>'+esc(t(k[2]))+'</button>'; }).join('')+'</div>';
  if(S.lwForm){
    var f=S.lwForm, kk=lwKind_(f.kind);
    h+='<div class="card lwForm"><div class="lwFormHead">'+kk[1]+' <b>'+esc(t(kk[2]))+'</b></div>';
    if(f.kind==='oneonone'){
      var people=(S.roster||[]).filter(function(p){ return p.id!==S.me.id && p.campus===S.me.campus; }).sort(function(a,b){ return a.name<b.name?-1:1; });
      h+='<label class="f">'+esc(t('With whom?'))+'</label><select id="lwWho"><option value="">'+esc(t('— choose —'))+'</option>'+
        people.map(function(p){ return '<option value="'+esc(p.id)+'"'+(f.who===p.id?' selected':'')+'>'+esc(p.name)+' · '+esc(t(p.dept))+'</option>'; }).join('')+'</select>';
    } else if(f.kind==='partner'){
      h+='<label class="f">'+esc(t('Which partner?'))+'</label><select id="lwWho"><option value="">'+esc(t('— choose —'))+'</option>'+
        L.partners.map(function(p){ return '<option value="'+esc(p.id)+'"'+(f.who===p.id?' selected':'')+'>'+esc(p.name)+(p.org?' · '+esc(p.org):'')+'</option>'; }).join('')+
        '<option value="__new"'+(f.who==='__new'?' selected':'')+'>+ '+esc(t('Someone new'))+'</option></select>'+
        (f.who==='__new' ? '<input type="text" id="lwNewPartner" placeholder="'+esc(t('Their name'))+'" value="'+esc(f.newName||'')+'">' : '');
    } else if(f.kind==='gospel'){
      h+='<label class="f">'+esc(t('How many hours?'))+'</label><input type="number" id="lwQty" min="0.25" max="24" step="0.25" inputmode="decimal" value="'+esc(String(f.qty||1))+'">';
    }
    h+='<label class="f">'+esc(t(LW_NOTE[f.kind]))+'</label><input type="text" id="lwNote" maxlength="200" value="'+esc(f.note||'')+'">'+
      '<label class="f">'+esc(t('When?'))+'</label><select id="lwDate">'+dates.filter(function(d){ return d<=todayStr(); }).map(function(d){
        return '<option value="'+d+'"'+(f.date===d?' selected':'')+'>'+esc(teamDate_(d))+(d===todayStr()?' · '+esc(t('today')):'')+'</option>'; }).join('')+'</select>'+
      '<div class="btnRow"><button class="btn" id="lwSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="lwCancel">'+esc(t('Cancel'))+'</button></div></div>';
  }
  // the week, day by day
  h+='<h3>🗓️ '+esc(t('This week'))+'</h3>';
  if(!L.log.length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('Nothing logged this week yet. Tap above as things happen — it takes a second.'))+'</p></div>';
  else {
    h+='<div class="card lwLog">'+dates.filter(function(d){ return L.log.some(function(r){ return r.date===d; }); }).map(function(d){
      return '<div class="lwDay">'+esc(teamDate_(d))+'</div>'+L.log.filter(function(r){ return r.date===d; }).map(function(r){
        var k=lwKind_(r.kind), who=r.kind==='oneonone' ? staffName_(r.who) : r.kind==='partner' ? r.whoName : '';
        return '<div class="lwRow"><span class="lwRowIcon">'+k[1]+'</span><span class="lwRowText"><b>'+esc(t(k[2]))+(who?' · '+esc(who):'')+(r.kind==='gospel'?' · '+esc(String(r.qty))+'h':'')+'</b>'+
          (r.note?'<span>'+esc(r.note)+'</span>':'')+'</span><button class="lwDel" data-lwdel="'+esc(r.id)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>';
      }).join(''); }).join('')+'</div>';
  }
  // the Campus Director's three ratings for the week
  if(L.director){
    var rf=L.reflect||{};
    h+='<h3>🌅 '+esc(t('End-of-week reflection'))+'</h3><div class="card"><p class="sub" style="margin:0 0 8px">'+esc(t('How did the week go? 1 is poor, 10 is excellent.'))+'</p>'+
      [['vision','Base vision'],['comms','Communications'],['partners','Partner relationships']].map(function(q){
        var v=rf[q[0]]||'';
        return '<div class="lwRate"><span>'+esc(t(q[1]))+'</span><div class="lwRateRow">'+[1,2,3,4,5,6,7,8,9,10].map(function(n){
          return '<button class="lwRateBtn'+(Number(v)===n?' on':'')+'" data-lwrate="'+q[0]+'|'+n+'">'+n+'</button>'; }).join('')+'</div></div>';
      }).join('')+'<input type="text" id="lwRateNote" maxlength="300" placeholder="'+esc(t('A line about the week (optional)'))+'" value="'+esc(rf.note||'')+'">'+
      '<button class="btn" id="lwRateSave">'+esc(rf.at ? t('Update') : t('Save'))+'</button></div>';
  }
  // partners
  h+='<h3>🙏 '+esc(t('My partners'))+'</h3><div class="card">';
  if(!L.partners.length) h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Churches, supporters and friends of the base you keep in touch with. Add them once; tap “Connected” when you do.'))+'</p>';
  h+=L.partners.map(function(p){
    var ago = p.last ? Math.round((new Date(todayStr()+'T00:00:00') - new Date(p.last+'T00:00:00'))/86400000) : null;
    return '<div class="lwPartner'+(ago===null||ago>30?' due':'')+'"><span class="lwRowText"><b>'+esc(p.name)+'</b><span>'+esc(p.org||'')+(p.org?' · ':'')+
      esc(ago===null ? t('Not yet') : ago===0 ? t('today') : gpT('{n} days ago',{n:ago}))+'</span></span>'+
      '<button class="btn ghost lwConnect" data-lwconnect="'+esc(p.id)+'">'+esc(t('Connected'))+'</button><button class="lwDel" data-lwpdel="'+esc(p.id)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>';
  }).join('');
  h+='<div class="numIn" style="margin-top:8px"><input type="text" id="lwPName" placeholder="'+esc(t('Name'))+'"><input type="text" id="lwPOrg" placeholder="'+esc(t('Church or organisation'))+'">'+
    '<button class="btn ghost" id="lwPAdd" style="margin:0;width:auto;padding:9px 14px">'+esc(t('Add'))+'</button></div></div>';
  // base plants (Campus Director)
  if(L.director || S.me.isAdmin){
    h+='<h3>🌱 '+esc(t('Base plants'))+'</h3><div class="card">';
    if(!L.plants.length) h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Places you are praying about or planning a new base. Those not yet launched count as Base Plants in Planning.'))+'</p>';
    h+=L.plants.map(function(p){
      return '<div class="lwPlant"><span class="lwRowText"><b>'+esc(p.name)+'</b><span>'+esc(p.place||'')+'</span></span>'+
        '<select data-lwplant="'+esc(p.id)+'">'+PLANT_STAGES_UI.map(function(s){ return '<option value="'+s[0]+'"'+(p.stage===s[0]?' selected':'')+'>'+esc(t(s[1]))+'</option>'; }).join('')+'</select>'+
        '<button class="lwDel" data-lwplantdel="'+esc(p.id)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>';
    }).join('');
    h+='<div class="numIn" style="margin-top:8px"><input type="text" id="lwBName" placeholder="'+esc(t('Name, e.g. YWAM Battambang'))+'"><input type="text" id="lwBPlace" placeholder="'+esc(t('Place'))+'">'+
      '<button class="btn ghost" id="lwBAdd" style="margin:0;width:auto;padding:9px 14px">'+esc(t('Add'))+'</button></div></div>';
  }
  return h;
}
function bindLw_(){
  var after=function(d){ S.lwBusy=false; if(d && d.ok){ S.lw=d; } else showMsg(t('Could not save — try again.')); render(); };
  var call=function(fn,args){ if(S.lwBusy) return; S.lwBusy=true; run(fn,[S.auth.user,S.auth.pin].concat(args),after,function(){ S.lwBusy=false; showMsg(t('No connection — try again when you are online.')); }); };
  var rt=document.getElementById('lwRetry'); if(rt) rt.onclick=function(){ S.lwErr=''; render(); };
  var pv=document.getElementById('lwPrev'), nx=document.getElementById('lwNext');
  if(pv) pv.onclick=function(){ gpTap(); S.lwWeek=Math.max(1,(S.lwWeek||thisWeek())-1); S.lwForm=null; render(); };
  if(nx) nx.onclick=function(){ gpTap(); S.lwWeek=Math.min(thisWeek(),(S.lwWeek||thisWeek())+1); S.lwForm=null; render(); };
  document.querySelectorAll('[data-lwkind]').forEach(function(b){ b.onclick=function(){ gpTap(); var k=b.getAttribute('data-lwkind');
    var ds=lwDatesOf_(S.lwWeek).filter(function(d){ return d<=todayStr(); });
    S.lwForm = (S.lwForm && S.lwForm.kind===k) ? null : { kind:k, date: ds.indexOf(todayStr())>-1 ? todayStr() : ds[ds.length-1], who:'', qty:1, note:'' }; render(); }; });
  var keep=function(){ var f=S.lwForm; if(!f) return; var w=document.getElementById('lwWho'), q=document.getElementById('lwQty'), n=document.getElementById('lwNote'), dd=document.getElementById('lwDate'), np=document.getElementById('lwNewPartner');
    if(w) f.who=w.value; if(q) f.qty=q.value; if(n) f.note=n.value; if(dd) f.date=dd.value; if(np) f.newName=np.value; };
  var who=document.getElementById('lwWho'); if(who) who.onchange=function(){ keep(); if(S.lwForm.kind==='partner') render(); };
  ['lwQty','lwNote','lwDate','lwNewPartner'].forEach(function(id){ var el=document.getElementById(id); if(el) el.oninput=el.onchange=keep; });
  var cc=document.getElementById('lwCancel'); if(cc) cc.onclick=function(){ S.lwForm=null; render(); };
  var sv=document.getElementById('lwSave');
  if(sv) sv.onclick=function(){
    keep(); var f=S.lwForm;
    if(f.kind==='oneonone' && !f.who){ showMsg(t('Choose who it was with.')); return; }
    if(f.kind==='partner' && !f.who){ showMsg(t('Choose the partner.')); return; }
    var add=function(partnerId, partnerName){
      call('leadLogAdd',[{ kind:f.kind, date:f.date, who: f.kind==='partner' ? partnerId : f.who, whoName: partnerName||'', qty:f.qty, note:f.note }]);
      S.lwForm=null; };
    if(f.kind==='partner' && f.who==='__new'){
      var nm=String(f.newName||'').trim(); if(!nm){ showMsg(t('Type their name.')); return; }
      S.lwBusy=true;
      run('leadPartnerSave',[S.auth.user,S.auth.pin,{ name:nm },S.lwWeek],function(d){ S.lwBusy=false;
        if(!d||!d.ok){ showMsg(t('Could not save — try again.')); return; }
        S.lw=d; var p=d.partners.filter(function(x){ return x.name===nm; }).slice(-1)[0]; add(p&&p.id, nm); });
      return;
    }
    var pn = f.kind==='partner' ? ((S.lw.partners.filter(function(p){ return p.id===f.who; })[0]||{}).name||'') : '';
    add(f.who, pn);
  };
  document.querySelectorAll('[data-lwdel]').forEach(function(b){ b.onclick=function(){ call('leadLogDelete',[b.getAttribute('data-lwdel')]); }; });
  var rate={}; var rf=(S.lw&&S.lw.reflect)||{}; ['vision','comms','partners'].forEach(function(k){ rate[k]=rf[k]||null; });
  document.querySelectorAll('[data-lwrate]').forEach(function(b){ b.onclick=function(){ var v=b.getAttribute('data-lwrate').split('|'); S.lw.reflect=Object.assign({}, S.lw.reflect||{}); S.lw.reflect[v[0]]=Number(v[1]); render(); }; });
  var rs=document.getElementById('lwRateSave'); if(rs) rs.onclick=function(){ var r=S.lw.reflect||{}; var note=document.getElementById('lwRateNote');
    call('leadReflectSave',[S.lwWeek,{ vision:r.vision, comms:r.comms, partners:r.partners, note: note?note.value:'' }]); };
  document.querySelectorAll('[data-lwconnect]').forEach(function(b){ b.onclick=function(){ gpTap(); var id=b.getAttribute('data-lwconnect'), p=S.lw.partners.filter(function(x){ return x.id===id; })[0]||{};
    var ds=lwDatesOf_(S.lwWeek).filter(function(d){ return d<=todayStr(); });
    call('leadLogAdd',[{ kind:'partner', who:id, whoName:p.name||'', date: ds.indexOf(todayStr())>-1 ? todayStr() : ds[ds.length-1] }]); }; });
  document.querySelectorAll('[data-lwpdel]').forEach(function(b){ b.onclick=function(){ if(!confirm(t('Remove this partner from your list?'))) return; call('leadPartnerDelete',[b.getAttribute('data-lwpdel'), S.lwWeek]); }; });
  var pa=document.getElementById('lwPAdd'); if(pa) pa.onclick=function(){ var n=document.getElementById('lwPName'), o=document.getElementById('lwPOrg');
    if(!String(n.value).trim()){ showMsg(t('Type their name.')); return; } call('leadPartnerSave',[{ name:n.value, org:o.value }, S.lwWeek]); };
  document.querySelectorAll('[data-lwplant]').forEach(function(sel){ sel.onchange=function(){ var p=S.lw.plants.filter(function(x){ return x.id===sel.getAttribute('data-lwplant'); })[0];
    call('basePlantSave',[Object.assign({}, p, { stage:sel.value }), S.lwWeek]); }; });
  document.querySelectorAll('[data-lwplantdel]').forEach(function(b){ b.onclick=function(){ if(!confirm(t('Remove this from the list?'))) return; call('basePlantSave',[{ id:b.getAttribute('data-lwplantdel'), remove:true }, S.lwWeek]); }; });
  var ba=document.getElementById('lwBAdd'); if(ba) ba.onclick=function(){ var n=document.getElementById('lwBName'), pl=document.getElementById('lwBPlace');
    if(!String(n.value).trim()){ showMsg(t('Type a name.')); return; } call('basePlantSave',[{ name:n.value, place:pl.value, stage:'praying' }, S.lwWeek]); };
  document.querySelectorAll('[data-lwtab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.lwTab=b.getAttribute('data-lwtab'); lwTabKeep_(S.lwTab); render(); }; });
}

/* ---------- the Cafe ---------- */
S.cafe=null; S.cafeDate=null; S.cafeLoading=false; S.cafeErr=''; S.cafeTab='today'; S.cafeView=(lsGet('gp-cafe-view')==='numbers'?'numbers':'tool'); S.cafeOrder={}; S.cafeTicks={ open:{}, close:{} }; S.cafeCell=null; S.cafeEdit=null;
function cafeLoad_(date){
  if(S.cafeLoading) return; S.cafeLoading=true; S.cafeErr='';
  run('cafeGet',[S.auth.user,S.auth.pin,date],function(d){ S.cafeLoading=false; if(d && d.ok && d.date===date) S.cafe=d; else S.cafeErr=(d&&d.err)||'error'; if(S.view==='ministry') render(); },
    function(e){ S.cafeLoading=false; S.cafeErr=String((e&&e.message)||'offline'); if(S.view==='ministry') render(); });
}
function cafeHtml_(){
  var date=S.cafeDate||todayStr(); S.cafeDate=date;
  if(!S.cafe || S.cafe.date!==date){
    if(S.cafeErr) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(S.cafeErr==='not_authorized' ? t('The cafe tool is for the cafe team.') : t('Couldn’t load the cafe.'))+'</p><button class="btn ghost" id="cafeRetry">'+esc(t('Try again'))+'</button></div>';
    cafeLoad_(date); return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  }
  var C=S.cafe, tabs=[['today','☀️','Today'],['till','🧾','Till'],['rota','👥','Rota'],['week','📈','Week']].concat(C.canSetup?[['setup','⚙️','Set up']]:[]);
  var h='<div class="cafeTabs">'+tabs.map(function(x){ return '<button class="'+(S.cafeTab===x[0]?'on':'')+'" data-cafetab="'+x[0]+'">'+x[1]+' '+esc(t(x[2]))+'</button>'; }).join('')+'</div>';
  if(S.cafeTab==='till') return h+cafeTillHtml_(C);
  if(S.cafeTab==='rota') return h+cafeRotaHtml_(C);
  if(S.cafeTab==='week') return h+cafeWeekHtml_(C);
  if(S.cafeTab==='setup' && C.canSetup) return h+cafeSetupHtml_(C);
  return h+cafeTodayHtml_(C);
}
function cafeDayStats_(day){
  var cups=0, takings=0; day.orders.forEach(function(o){ takings+=Number(o.total)||0; o.items.forEach(function(i){ if(i.cup) cups+=i.qty; }); });
  var spent=day.expenses.reduce(function(a,e){ return a+(Number(e.amount)||0); },0), pos=day.pos||{};
  return { cups:cups+(Number(pos.cups)||0), takings:takings+(Number(pos.sales)||0), spent:spent, customers:day.orders.length+(Number(pos.receipts)||0) };
}
function cafeTiles_(list){ return '<div class="mmGrid">'+list.map(function(x){ return '<div class="mmTile"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>'; }
function cafeTodayHtml_(C){
  var d=C.day, st=cafeDayStats_(d), today=C.date===todayStr();
  var h='<div class="weekNavRow"><button class="weekArrow" id="cafePrevDay" aria-label="'+esc(t('Previous day'))+'">‹</button><div class="weekPill">'+esc(teamDate_(C.date))+(today?' · '+esc(t('today')):'')+'</div>'+
    '<button class="weekArrow" id="cafeNextDay"'+(today?' disabled':'')+' aria-label="'+esc(t('Next day'))+'">›</button></div>';
  var list=function(kind, items){ return items.map(function(x,i){ var on=!!S.cafeTicks[kind][i];
    return '<label class="cafeTick'+(on?' on':'')+'"><input type="checkbox" data-cafetick="'+kind+'|'+i+'"'+(on?' checked':'')+'> <span>'+esc(x)+'</span></label>'; }).join(''); };
  if(!d.opened){
    h+='<div class="card cafeStage"><div class="cafeStageHead">☀️ <b>'+esc(t('Open the cafe'))+'</b></div>'+list('open', C.settings.open)+
      '<button class="btn" id="cafeOpenBtn">'+esc(t('We’re open'))+'</button></div>';
  } else {
    h+='<div class="cafeStatus '+(d.closed?'closed':'open')+'">'+(d.closed ? '🌙 '+esc(gpT('Closed at {time}',{time:shortTime_(d.closed.at)}))+(d.closed.cash!=null?' · '+esc(gpT('cash {amount}',{amount:money_(d.closed.cash)})):'')
      : '🟢 '+esc(gpT('Open since {time}',{time:shortTime_(d.opened.at)}))+' · '+esc(staffName_(d.opened.by)))+'</div>';
    h+=cafeTiles_([[t('Customers'), st.customers],[t('Cups'), st.cups],[t('Takings'), money_(st.takings)],[t('Expenses'), money_(st.spent)]]);
    if(!d.closed){
      if(C.settings.till==='hangpopok') h+='<div class="cafeStatus '+(d.pos?'open':'closed')+'">🧾 '+esc(d.pos ? t('HangPopok totals are in for today.') : t('HangPopok totals not entered yet — on the Till tab, at closing.'))+'</div>'+
        '<button class="btn" id="cafeGoTill">🧾 '+esc(d.pos ? t('Go to the till') : t('Enter the HangPopok totals'))+'</button>';
      else h+='<button class="btn" id="cafeGoTill">🧾 '+esc(t('Go to the till'))+'</button>';
      h+='<div class="card cafeStage"><div class="cafeStageHead">🌙 <b>'+esc(t('Close for the day'))+'</b></div>'+list('close', C.settings.close)+
        '<label class="f">'+esc(t('Cash in the drawer ($)'))+'</label><input type="number" inputmode="decimal" step="0.01" min="0" id="cafeCash">'+
        '<button class="btn" id="cafeCloseBtn">'+esc(t('Close for today'))+'</button></div>';
    } else h+='<button class="linkbtn" id="cafeReopen">'+esc(t('Open again'))+'</button>';
  }
  return h+'<p class="hint">'+esc(t('Opening the cafe counts the day as open. Every sale, conversation and expense fills this week’s cafe numbers by itself.'))+'</p>';
}
/* HangPopok is the cafe's till: no menu buttons here, just the day's three
   totals copied from its daily sales report at closing. */
function cafePosHtml_(C){
  var d=C.day, p=d.pos||{}, v=function(x){ return x==null ? '' : esc(String(x)); };
  return '<div class="card cafeStage"><div class="cafeStageHead">🧾 <b>'+esc(t('Today’s totals from HangPopok'))+'</b></div>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(t('HangPopok is our till. At closing, copy these from its daily sales report — they count as this week’s sales.'))+'</p>'+
    '<div class="cafePosGrid"><label>'+esc(t('Sales ($)'))+'<input type="number" inputmode="decimal" step="0.01" min="0" id="cafePosSales" value="'+v(p.sales)+'"></label>'+
    '<label>'+esc(t('Receipts'))+'<input type="number" inputmode="numeric" min="0" id="cafePosReceipts" value="'+v(p.receipts)+'"></label>'+
    '<label>'+esc(t('Cups sold'))+'<input type="number" inputmode="numeric" min="0" id="cafePosCups" value="'+v(p.cups)+'"></label></div>'+
    '<button class="btn" id="cafePosSave">'+esc(d.pos ? t('Update') : t('Save the totals'))+'</button>'+
    (d.pos ? '<p class="hint" style="margin:6px 0 0">✓ '+esc(gpT('Saved at {time} by {name}',{time:shortTime_(d.pos.at), name:staffName_(d.pos.by)}))+'</p>' : '')+'</div>';
}
function cafeTillHtml_(C){
  var d=C.day, menu=C.settings.menu, order=S.cafeOrder, total=0, n=0;
  menu.forEach(function(m){ var q=order[m.id]||0; total+=q*(Number(m.price)||0); n+=q; });
  var h=d.opened ? '' : '<div class="banner">☀️ '+esc(t('The cafe isn’t open yet today — open it on the Today tab first.'))+'</div>';
  var hp=C.settings.till==='hangpopok';
  if(hp) h+=cafePosHtml_(C);
  else h+='<div class="cafeMenu">'+menu.map(function(m){ var q=order[m.id]||0;
    return '<button class="cafeItem'+(q?' on':'')+'" data-cafeadd="'+esc(m.id)+'"><span class="cafeItemEmoji">'+esc(m.emoji||'☕')+'</span><b>'+esc(m.name)+'</b><span>'+money_(m.price)+'</span>'+(q?'<span class="cafeQty">'+q+'</span>':'')+'</button>'; }).join('')+'</div>';
  if(!hp) h+='<div class="card cafeOrder"><div class="cafeOrderLines">'+(n ? menu.filter(function(m){ return order[m.id]; }).map(function(m){
      return '<div class="cafeLine"><span>'+esc(m.emoji||'')+' '+esc(m.name)+'</span><span class="cafeLineQty"><button data-cafeminus="'+esc(m.id)+'">−</button>'+order[m.id]+'<button data-cafeadd="'+esc(m.id)+'">+</button></span><span>'+money_(order[m.id]*m.price)+'</span></div>'; }).join('')
      : '<p class="sub" style="margin:0">'+esc(t('Tap the menu to start an order.'))+'</p>')+'</div>'+
    '<div class="cafeTotal"><span>'+esc(t('Total'))+'</span><b>'+money_(total)+'</b></div>'+
    '<div class="btnRow"><button class="btn" id="cafeCharge"'+(n&&!S.cafeBusy?'':' disabled')+'>'+esc(t('Charge'))+' '+money_(total)+'</button><button class="btn ghost" id="cafeClear"'+(n?'':' disabled')+'>'+esc(t('Clear'))+'</button></div></div>';
  h+='<div class="cafeCounters">'+[['gospel','💬','Gospel conversations'],['salvations','🙌','Salvations']].map(function(x){
    return '<div class="card cafeCounter"><span class="cafeCounterIcon">'+x[1]+'</span><span class="cafeCounterName">'+esc(t(x[2]))+'</span><span class="cafeCounterRow"><button data-cafecount="'+x[0]+'|-1" aria-label="−">−</button><b>'+(d[x[0]]||0)+'</b><button data-cafecount="'+x[0]+'|1" aria-label="+">+</button></span></div>'; }).join('')+'</div>';
  if(!hp || d.orders.length) h+='<h3>🧾 '+esc(t('Today’s orders'))+' <small>· '+d.orders.length+'</small></h3>'+(d.orders.length ? '<div class="card">'+d.orders.slice(-6).reverse().map(function(o){
      return '<div class="cafeLine"><span>'+esc(shortTime_(o.at))+' · '+esc(o.items.map(function(i){ return i.qty+'× '+i.name; }).join(', '))+'</span><span>'+money_(o.total)+'</span><button class="lwDel" data-cafevoid="'+esc(o.id)+'" aria-label="'+esc(t('Undo'))+'">×</button></div>'; }).join('')+'</div>'
    : '<p class="sub">'+esc(t('No orders yet today.'))+'</p>');
  h+='<h3>💸 '+esc(t('Expenses'))+'</h3><div class="card">'+d.expenses.map(function(e){
      return '<div class="cafeLine"><span>'+esc(e.note||t('Expense'))+'</span><span>'+money_(e.amount)+'</span><button class="lwDel" data-cafeexpdel="'+esc(e.id)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+
    '<div class="numIn" style="margin-top:6px"><input type="number" inputmode="decimal" step="0.01" min="0" id="cafeExpAmt" placeholder="$" style="max-width:90px"><input type="text" id="cafeExpNote" placeholder="'+esc(t('What for? e.g. milk, ice'))+'">'+
    '<button class="btn ghost" id="cafeExpAdd" style="margin:0;width:auto;padding:9px 14px">'+esc(t('Add'))+'</button></div></div>';
  return h;
}
function cafeTeam_(){
  var team=(S.roster||[]).filter(function(p){ return p.campus===S.me.campus && ((p.dept==='Community Service' && p.ministry==='Cafe') || (p.ministries||[]).indexOf('Community Service|Cafe')>-1); });
  return team.length ? team : (S.roster||[]).filter(function(p){ return p.campus===S.me.campus; });
}
function cafeMonday_(date){ var d=new Date(date+'T00:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return isoDateOf_(d); }
function cafeRotaHtml_(C){
  var wkKey=cafeMonday_(C.date), cells=(C.settings.roster||{})[wkKey]||{}, days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var h='<p class="sub">'+esc(gpT('Who is working the week of {date}. Tap a box to choose.',{date:teamDate_(wkKey)}))+'</p>';
  h+='<div class="cafeRota"><table><thead><tr><th></th>'+days.map(function(d){ return '<th>'+esc(t(d))+'</th>'; }).join('')+'</tr></thead><tbody>'+
    C.settings.shifts.map(function(sh,si){ return '<tr><th>'+esc(t(sh))+'</th>'+days.map(function(d,di){ var key=si+'|'+di, ids=cells[key]||[];
      return '<td><button class="cafeCell'+(S.cafeCell===key?' on':'')+'" data-cafecell="'+key+'">'+(ids.length ? ids.map(function(id){ return esc(firstName_(staffName_(id)||'?')); }).join('<br>') : '<span class="faintPlus">+</span>')+'</button></td>'; }).join('')+'</tr>'; }).join('')+
    '</tbody></table></div>';
  if(S.cafeCell){
    var p=S.cafeCell.split('|'), ids=cells[S.cafeCell]||[];
    h+='<div class="card"><b>'+esc(t(C.settings.shifts[Number(p[0])]||''))+' · '+esc(t(days[Number(p[1])]))+'</b><div class="chips" style="margin-top:8px">'+cafeTeam_().map(function(x){
      return '<button class="chip'+(ids.indexOf(x.id)>-1?' blue':'')+'" data-cafewho="'+esc(x.id)+'">'+esc(firstName_(x.name))+'</button>'; }).join('')+'</div>'+
      '<button class="btn ghost" id="cafeCellDone">'+esc(t('Done'))+'</button></div>';
  }
  return h;
}
function cafeWeekHtml_(C){
  var w=C.week, sum=function(k){ return w.reduce(function(a,d){ return a+(Number(d[k])||0); },0); };
  var h='<p class="sub">'+esc(gpT('Week {n} — these are the numbers the cafe tool fills in.',{n:C.weekNo}))+'</p>';
  h+=cafeTiles_([[t('Days open'), w.filter(function(d){ return d.open; }).length],[t('Cups sold'), sum('cups')],[t('Customers'), sum('customers')],
    [t('Takings'), money_(sum('takings'))],[t('Expenses'), money_(sum('spent'))],[t('Profit'), money_(sum('takings')-sum('spent'))],
    [t('Gospel conversations'), sum('gospel')],[t('Salvations'), sum('salvations')]]);
  var max=Math.max.apply(null, w.map(function(d){ return d.cups; }).concat([1]));
  h+='<h3>☕ '+esc(t('Cups each day'))+'</h3><div class="card cafeBars">'+w.map(function(d){ var dt=new Date(d.date+'T00:00:00');
    return '<div class="cafeBar"><span class="cafeBarNum">'+(d.cups||'')+'</span><span class="cafeBarFill" style="height:'+Math.round(d.cups/max*100)+'%"></span><span class="cafeBarDay">'+esc(t(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]))+'</span></div>'; }).join('')+'</div>';
  var best={}; w.forEach(function(d){ Object.keys(d.best||{}).forEach(function(k){ best[k]=(best[k]||0)+d.best[k]; }); });
  var top=Object.keys(best).sort(function(a,b){ return best[b]-best[a]; }).slice(0,3);
  if(top.length) h+='<h3>🏆 '+esc(t('Best sellers'))+'</h3><div class="card">'+top.map(function(k,i){ return '<div class="cafeLine"><span>'+['🥇','🥈','🥉'][i]+' '+esc(k)+'</span><span>'+best[k]+'</span></div>'; }).join('')+'</div>';
  return h;
}
function cafeSetupHtml_(C){
  var E=S.cafeEdit || (S.cafeEdit={ menu:C.settings.menu.map(function(m){ return Object.assign({}, m); }), open:C.settings.open.join('\n'), close:C.settings.close.join('\n'), shifts:C.settings.shifts.join(', ') });
  var hp=C.settings.till==='hangpopok';
  var h='<h3>🧾 '+esc(t('Our till'))+'</h3><div class="campusSeg" style="max-width:none">'+[['app',t('This app')],['hangpopok','HangPopok']].map(function(x){
      return '<button class="campusBtn'+((C.settings.till||'app')===x[0]?' on':'')+'" data-cafetill="'+x[0]+'">'+esc(x[1])+'</button>'; }).join('')+'</div>'+
    '<p class="hint">'+esc(hp ? t('The till tab asks for the day’s totals from HangPopok. The menu below is only used when selling in this app.') : t('Sell from the menu here. If the cafe rings up sales in HangPopok, choose it — then the day’s totals are typed in at closing.'))+'</p>';
  h+='<h3>🧾 '+esc(t('Menu'))+'</h3><div class="card">'+E.menu.map(function(m,i){
    return '<div class="cafeMenuRow"><input type="text" data-cafemenu="'+i+'|emoji" value="'+esc(m.emoji||'')+'" class="cafeEmojiIn" aria-label="'+esc(t('Emoji'))+'"><input type="text" data-cafemenu="'+i+'|name" value="'+esc(m.name)+'" aria-label="'+esc(t('Name'))+'">'+
      '<input type="number" step="0.05" min="0" data-cafemenu="'+i+'|price" value="'+esc(String(m.price))+'" class="cafePriceIn" aria-label="'+esc(t('Price'))+'">'+
      '<label class="cafeCupIn"><input type="checkbox" data-cafemenu="'+i+'|cup"'+(m.cup?' checked':'')+'> '+esc(t('cup'))+'</label><button class="lwDel" data-cafemenudel="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+
    '<button class="linkbtn inline" id="cafeMenuAdd">+ '+esc(t('Add an item'))+'</button><div class="hint">'+esc(t('Items ticked “cup” count as Cups Sold.'))+'</div></div>';
  h+='<h3>☀️ '+esc(t('Opening checklist'))+'</h3><textarea id="cafeSetOpen" rows="6">'+esc(E.open)+'</textarea>';
  h+='<h3>🌙 '+esc(t('Closing checklist'))+'</h3><textarea id="cafeSetClose" rows="6">'+esc(E.close)+'</textarea>';
  h+='<label class="f">'+esc(t('Shifts (separated by commas)'))+'</label><input type="text" id="cafeSetShifts" value="'+esc(E.shifts)+'">';
  return h+'<button class="btn" id="cafeSetSave">'+esc(t('Save'))+'</button>';
}
function bindCafe_(){
  var done=function(d){ S.cafeBusy=false; if(d && d.ok){ S.cafe=d; } else showMsg(d && d.err==='empty' ? t('The order is empty.') : d && d.err==='not_leader' ? t('Only the cafe’s leader can change the menu.') : t('Could not save — try again.')); render(); };
  var call=function(fn,args,then){ if(S.cafeBusy) return; S.cafeBusy=true; run(fn,[S.auth.user,S.auth.pin].concat(args),function(d){ done(d); if(then && d && d.ok) then(d); },function(){ S.cafeBusy=false; showMsg(t('No connection — try again when you are online.')); render(); }); };
  var rt=document.getElementById('cafeRetry'); if(rt) rt.onclick=function(){ S.cafeErr=''; render(); };
  document.querySelectorAll('[data-cafeview]').forEach(function(b){ b.onclick=function(){ gpTap(); S.cafeView=b.getAttribute('data-cafeview'); lsSet('gp-cafe-view', S.cafeView); render(); }; });
  document.querySelectorAll('[data-cafetab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.cafeTab=b.getAttribute('data-cafetab'); S.cafeEdit=null; render(); }; });
  var shift=function(n){ var d=new Date((S.cafeDate||todayStr())+'T00:00:00'); d.setDate(d.getDate()+n); var s=isoDateOf_(d); if(s>todayStr()) return; S.cafeDate=s; S.cafeTicks={open:{},close:{}}; render(); };
  var pd=document.getElementById('cafePrevDay'), nd=document.getElementById('cafeNextDay');
  if(pd) pd.onclick=function(){ shift(-1); }; if(nd) nd.onclick=function(){ shift(1); };
  document.querySelectorAll('[data-cafetick]').forEach(function(c){ c.onchange=function(){ var v=c.getAttribute('data-cafetick').split('|'); S.cafeTicks[v[0]][v[1]]=c.checked; c.parentNode.classList.toggle('on', c.checked); }; });
  var ticks=function(k){ return Object.keys(S.cafeTicks[k]).filter(function(i){ return S.cafeTicks[k][i]; }).map(Number); };
  var ob=document.getElementById('cafeOpenBtn'); if(ob) ob.onclick=function(){ gpTap(); call('cafeOpen',[S.cafeDate, ticks('open')]); };
  var cb=document.getElementById('cafeCloseBtn'); if(cb) cb.onclick=function(){ var c=document.getElementById('cafeCash'); call('cafeClose',[S.cafeDate, ticks('close'), c && c.value!=='' ? Number(c.value) : null]); };
  var ro=document.getElementById('cafeReopen'); if(ro) ro.onclick=function(){ call('cafeReopen',[S.cafeDate]); };
  var gt=document.getElementById('cafeGoTill'); if(gt) gt.onclick=function(){ gpTap(); S.cafeTab='till'; render(); };
  document.querySelectorAll('[data-cafeadd]').forEach(function(b){ b.onclick=function(){ gpTap(); var id=b.getAttribute('data-cafeadd'); S.cafeOrder[id]=(S.cafeOrder[id]||0)+1; render(); }; });
  document.querySelectorAll('[data-cafeminus]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-cafeminus'); S.cafeOrder[id]=Math.max(0,(S.cafeOrder[id]||0)-1); if(!S.cafeOrder[id]) delete S.cafeOrder[id]; render(); }; });
  var cl=document.getElementById('cafeClear'); if(cl) cl.onclick=function(){ S.cafeOrder={}; render(); };
  var ch=document.getElementById('cafeCharge'); if(ch) ch.onclick=function(){ var items=Object.keys(S.cafeOrder).map(function(id){ return { id:id, qty:S.cafeOrder[id] }; });
    call('cafeSale',[S.cafeDate, items], function(){ S.cafeOrder={}; gpTap(); showMsg(t('Sold')); }); };
  document.querySelectorAll('[data-cafevoid]').forEach(function(b){ b.onclick=function(){ if(!confirm(t('Undo this order?'))) return; call('cafeVoid',[S.cafeDate, b.getAttribute('data-cafevoid')]); }; });
  document.querySelectorAll('[data-cafecount]').forEach(function(b){ b.onclick=function(){ gpTap(); var v=b.getAttribute('data-cafecount').split('|'); call('cafeCount',[S.cafeDate, v[0], Number(v[1])]); }; });
  var ea=document.getElementById('cafeExpAdd'); if(ea) ea.onclick=function(){ var a=document.getElementById('cafeExpAmt'), n=document.getElementById('cafeExpNote');
    if(!(Number(a.value)>0)){ showMsg(t('Type the amount.')); return; } call('cafeExpense',[S.cafeDate, Number(a.value), n.value, null]); };
  document.querySelectorAll('[data-cafeexpdel]').forEach(function(b){ b.onclick=function(){ call('cafeExpense',[S.cafeDate, null, '', b.getAttribute('data-cafeexpdel')]); }; });
  document.querySelectorAll('[data-cafecell]').forEach(function(b){ b.onclick=function(){ gpTap(); var k=b.getAttribute('data-cafecell'); S.cafeCell = S.cafeCell===k ? null : k; render(); }; });
  document.querySelectorAll('[data-cafewho]').forEach(function(b){ b.onclick=function(){
    var C=S.cafe, wkKey=cafeMonday_(C.date), cells=Object.assign({}, (C.settings.roster||{})[wkKey]||{}), ids=(cells[S.cafeCell]||[]).slice(), id=b.getAttribute('data-cafewho');
    cells[S.cafeCell] = ids.indexOf(id)>-1 ? ids.filter(function(x){ return x!==id; }) : ids.concat([id]);
    call('cafeSaveSettings',[{ roster:{ week:wkKey, cells:cells } }, C.date]); }; });
  var cd=document.getElementById('cafeCellDone'); if(cd) cd.onclick=function(){ S.cafeCell=null; render(); };
  document.querySelectorAll('[data-cafemenu]').forEach(function(inp){ inp.oninput=inp.onchange=function(){ var v=inp.getAttribute('data-cafemenu').split('|'), m=S.cafeEdit.menu[Number(v[0])];
    m[v[1]] = v[1]==='cup' ? inp.checked : v[1]==='price' ? Number(inp.value) : inp.value; }; });
  document.querySelectorAll('[data-cafemenudel]').forEach(function(b){ b.onclick=function(){ S.cafeEdit.menu.splice(Number(b.getAttribute('data-cafemenudel')),1); render(); }; });
  var ma=document.getElementById('cafeMenuAdd'); if(ma) ma.onclick=function(){ S.cafeEdit.menu.push({ name:'', emoji:'☕', price:1, cup:true }); render(); };
  ['cafeSetOpen','cafeSetClose','cafeSetShifts'].forEach(function(id){ var el=document.getElementById(id); if(el) el.oninput=function(){ S.cafeEdit[id==='cafeSetOpen'?'open':id==='cafeSetClose'?'close':'shifts']=el.value; }; });
  document.querySelectorAll('[data-cafetill]').forEach(function(b){ b.onclick=function(){ gpTap(); call('cafeSaveSettings',[{ till:b.getAttribute('data-cafetill') }, S.cafeDate], function(){ showMsg(t('Saved')); }); }; });
  var ps=document.getElementById('cafePosSave'); if(ps) ps.onclick=function(){
    var g=function(id){ var el=document.getElementById(id); return el && el.value!=='' ? Number(el.value) : null; };
    var x={ sales:g('cafePosSales'), receipts:g('cafePosReceipts'), cups:g('cafePosCups') };
    if(x.sales==null && x.receipts==null && x.cups==null && !S.cafe.day.pos){ showMsg(t('Type the totals first.')); return; }
    call('cafePos',[S.cafeDate, x], function(){ gpTap(); showMsg(t('Saved')); }); };
  var ss=document.getElementById('cafeSetSave'); if(ss) ss.onclick=function(){ var E=S.cafeEdit;
    call('cafeSaveSettings',[{ menu:E.menu.filter(function(m){ return String(m.name||'').trim(); }), open:E.open.split('\n'), close:E.close.split('\n'), shifts:E.shifts.split(',').map(function(x){ return x.trim(); }) }, S.cafeDate],
      function(){ S.cafeEdit=null; showMsg(t('Saved')); }); };
}

/* ---------- Campus Leadership: Overview and the Tuesday meeting ----------
   Oct 2026 (Uriah): what a Campus Director needs to stay on top of, on one
   page and not many — each department's pulse (numbers in, staff, health,
   OKRs), which ministries have a clear leader and which don't, who is
   facilitating and translating on Tuesday, and the money ahead (its own
   Finances tab since Oct 2026 — teams/09-finance.js). A department
   overseer sees the same for their own department. */
function leadScopeDepts_(){
  var all=Object.keys(getDepartments(S.me.campus)).filter(function(d){ return d!==BL_DEPT; });
  if(S.me.ministry==='Campus Director' || S.me.isAdmin) return all;
  return all.indexOf(S.me.ministry)>-1 ? [S.me.ministry] : all;
}
function leadIsDirector_(){ return !!(S.me && (S.me.ministry==='Campus Director' || S.me.isAdmin)); }
function leadTuesdays_(n){ var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+((2-d.getDay()+7)%7)); var out=[]; for(var i=0;i<n;i++){ out.push(calIso_(d)); d.setDate(d.getDate()+7); } return out; }
function leadTuesFor_(date){ return ((S.lead && S.lead.tues) || []).filter(function(x){ return x.date===date; })[0] || null; }
function leadTuesWho_(p){ return p ? (p.id ? staffName_(p.id) : p.name) : ''; }
function leadBaseHtml_(pulse){
  var V=S.lwView;   // another leadership role's board (blViewOf_), or null for your own
  var depts=getDepartments(S.me.campus), rows=[], scope=V ? V.depts : leadScopeDepts_(), many=scope.length>1;
  var h='<div id="leadBase">'+(!many && pulse ? pulse : '');
  scope.forEach(function(d){ Object.keys(depts[d]||{}).forEach(function(m){ rows.push({ dept:d, min:m, leaders:ministryLeaders_(S.me.campus, d, m) }); }); });
  var none=rows.filter(function(r){ return !r.leaders.length; });
  /* Numbers in this week, added up from the departments' pulse once it's here. */
  var inN=0, ofN=0, pulseIn=true;
  scope.forEach(function(d){ var P=S.pulse && S.pulse[d]; if(!P || !P.ok){ pulseIn=false; return; }
    var mins=numbersDeptMinistries_(d), lg=(P.numbers.logged||{})[P.week]||[]; ofN+=mins.length; inN+=mins.filter(function(m){ return lg.indexOf(m)>-1; }).length; });
  var next=leadTuesdays_(1)[0], tr=S.lead ? leadTuesFor_(next) : null;
  /* At a glance (the Director's whole base): four numbers, each opening onto its section below. */
  finLoad_(); var pj=finProject_(S.fin);
  /* The four numbers at the top, each opening onto where it comes from — which four is the
     role's (LW_ROLES): partners and new bases for the International Director, the staff and
     the week for the National Director, the whole base for a Campus Director. */
  /* The dashboard (Uriah, Oct 2026): this quarter's OKR progress and the board lead for
     every role, each opening its tab; then the role's own (LW_ROLES). */
  var tiles=['okr','board'].concat(many ? LW_ROLES[V ? V.role : lwRole_()].tiles : []);
  if(V) tiles=tiles.map(function(k){ return k==='partners' ? 'numbers' : k; });   // partners are each director's own
  if(tiles.indexOf('partners')>-1 || tiles.indexOf('plants')>-1){ if(!S.lw && !S.lwLoading && !S.lwErr) lwLoad_(S.lwWeek||thisWeek()); }
  var away={}, ones=0;
  scope.forEach(function(d){ var P=S.pulse && S.pulse[d]; if(P && P.ok){ ones+=P.oneOnOnes||0; (P.away||[]).forEach(function(a){ away[a.name]=1; }); } });
  var L=S.lw, today=new Date(todayStr()+'T00:00:00');
  var due=L ? L.partners.filter(function(p){ return !p.last || (today-new Date(p.last+'T00:00:00'))/86400000>30; }).length : null;
  var plans=L ? L.plants.filter(function(p){ return p.stage!=='launched'; }).length : null;
  var lo=leadOkrs_(), lR=baseR(), okrPct=lo.length ? Math.round(lo.reduce(function(a,o){ return a+lR.objProgress(o); },0)/lo.length) : null;
  var openCards=S.lead && S.lead.cards ? S.lead.cards.filter(function(c){ return c.col!==leadDoneId_(); }).length : null;
  var TILE={
    okr:'<button class="mmTile lbTileBtn lbNav" data-lwtab="okrs" id="lbOkrTile"><div class="mmTileName">🎯 '+esc(gpT('Q{q} OKRs',{q:leadQNow_()}))+'</div><div class="mmTileNum">'+(okrPct===null ? '—' : okrPct+'%')+'</div>'+
      (okrPct===null ? '<div class="mmTileSub">'+esc(t('None set yet'))+'</div>' : '<div class="leadBar"><div style="width:'+okrPct+'%;background:'+gpRingColor(okrPct)+'"></div></div>')+'</button>',
    board:'<button class="mmTile lbTileBtn lbNav" data-lwtab="board" id="lbBoardTile"><div class="mmTileName">📋 '+esc(t('Board'))+'</div><div class="mmTileNum">'+(openCards===null ? '…' : openCards)+'</div><div class="mmTileSub">'+esc(t('open cards'))+'</div></button>',
    leaders:'<a class="mmTile" href="#lbLeaders"><div class="mmTileName">👑 '+esc(t('Clear leaders'))+'</div><div class="mmTileNum">'+(rows.length-none.length)+' / '+rows.length+'</div></a>',
    numbers:'<a class="mmTile" href="#lbPulse"><div class="mmTileName">📊 '+esc(t('Numbers in'))+'</div><div class="mmTileNum">'+(pulseIn && ofN ? inN+' / '+ofN : '…')+'</div></a>',
    tues:'<a class="mmTile" href="#lbTues"><div class="mmTileName">🎤 '+esc(gpT('Tuesday {date}',{date:hospDate_(next)}))+'</div><div class="mmTileNum lbTileWho">'+esc(leadTuesWho_(tr && tr.facilitator) || '—')+'</div></a>',
    money:'<button class="mmTile lbTileBtn" data-lwtab="money"><div class="mmTileName">💵 '+esc(t('Money ahead'))+'</div><div class="mmTileNum lbTileWho'+(pj && pj.short?' lbNone':'')+'">'+esc(!pj ? '…' : pj.short ? gpT('short in {month}',{month:lmMonthName_(pj.short)}) : lmMoney_(pj.end))+'</div></button>',
    partners:'<button class="mmTile lbTileBtn" data-lwtab="week"><div class="mmTileName">🙏 '+esc(t('Partners to reach'))+'</div><div class="mmTileNum'+(due?' lbNone':'')+'">'+(due===null ? '…' : L.partners.length ? due+' / '+L.partners.length : '—')+'</div></button>',
    plants:'<'+(V?'div':'button')+' class="mmTile lbTileBtn"'+(V?'':' data-lwtab="week"')+'><div class="mmTileName">🌱 '+esc(t('Base Plants in Planning'))+'</div><div class="mmTileNum">'+(plans===null ? (S.lwErr ? '—' : '…') : plans)+'</div></'+(V?'div':'button')+'>',
    away:'<a class="mmTile" href="#lbPulse"><div class="mmTileName">🏖️ '+esc(t('Away this week'))+'</div><div class="mmTileNum">'+(pulseIn ? Object.keys(away).length : '…')+'</div></a>',
    oneonones:'<a class="mmTile" href="#lbPulse"><div class="mmTileName">🤝 '+esc(t('1-on-1s this month'))+'</div><div class="mmTileNum">'+(pulseIn ? ones : '…')+'</div></a>'
  };
  if(tiles.length) h+='<div class="mmGrid lbGlance">'+tiles.map(function(k){ return TILE[k]; }).join('')+'</div>';
  /* Clear leaders: the ones without, a line per department; who leads what folded. */
  h+='<div class="card" id="lbLeaders"><div class="goalCardTitle" style="margin-bottom:6px">👑 '+esc(t('Clear leaders'))+'</div>'+
    '<p class="lbBig"><b>'+(rows.length-none.length)+' / '+rows.length+'</b> '+esc(t('ministries have a clear leader'))+'</p>';
  if(none.length){
    h+='<div class="hint" style="margin:6px 0 2px">'+esc(t('No leader yet:'))+'</div>';
    scope.forEach(function(d){ var list=none.filter(function(r){ return r.dept===d; }); if(!list.length) return;
      h+='<div class="lbDeptLine">'+(scope.length>1?'<b>'+esc(t(d))+'</b> ':'')+esc(list.map(function(r){ return t(r.min); }).join(', '))+'</div>'; });
  } else h+='<p class="sub" style="margin:4px 0 0">✓ '+esc(t('Every ministry has a leader.'))+'</p>';
  h+='<details class="pulseMore"><summary>'+esc(t('Who leads what'))+'</summary>'+rows.map(function(r){
      return '<div class="cafeLine"><span>'+esc(t(r.min))+'</span><span class="'+(r.leaders.length?'':'lbNone')+'">'+esc(r.leaders.length ? r.leaders.map(function(p){ return p.name; }).join(', ') : '—')+'</span></div>'; }).join('')+
    '<p class="hint" style="margin:6px 0 0">'+esc(t('A leader is set on each person’s profile by an admin.'))+'</p></details></div>';
  /* Tuesday morning. */
  h+='<div class="card" id="lbTues"><div class="goalCardTitle" style="margin-bottom:6px">🎤 '+esc(gpT('Tuesday {date}',{date:hospDate_(next)}))+'</div>';
  if(!S.lead) h+='<p class="sub" style="margin:0">'+esc(S.leadErr || t('Loading…'))+'</p>';
  else {
    h+='<div class="lbWho"><span>'+esc(t('Facilitating'))+'</span><b>'+esc(leadTuesWho_(tr && tr.facilitator) || t('Nobody yet'))+'</b></div>'+
      '<div class="lbWho"><span>'+esc(t('Translating'))+'</span><b>'+esc(leadTuesWho_(tr && tr.translator) || t('Nobody yet'))+'</b></div>';
    h+=leadTueListsHtml_(tr);
    h+='<button class="btn ghost" id="lbGoTues" style="margin-top:8px">'+esc(t('Plan the Tuesdays'))+'</button>';
  }
  h+='</div>';
  /* Each department's pulse last: one open for an overseer, folded for the Director. */
  if(pulse && many) h+='<div id="lbPulse"><details class="card lbPulseFold"'+(S.lbPulseOpen?' open':'')+'><summary class="goalCardTitle">📊 '+esc(t('Departments this week'))+'</summary>'+pulse+'</details></div>';
  return h+'</div>';
}
/* The money ahead lives on the Finances tab now (teams/09-finance.js), signed in and
   starting from the cash the Finances office enters; these two still name its months. */
function lmMonthName_(k){ return t(MONTH_SHORT[Number(k.slice(5,7))-1]||'')+' '+k.slice(2,4); }
function lmMoney_(v){ var n=Math.round(Number(v)||0); return (n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-US'); }
/* The Tuesday morning meeting: the next eight Tuesdays, each with who
   facilitates and who translates (the leadership team), the topics to hit
   and the announcements. */
function leadTueListsHtml_(r){
  if(!r) return '';
  var tp=r.topics||[], an=r.announcements||[], h='';
  if(tp.length) h+='<div class="lbListH">📌 '+esc(t('Topics to hit'))+'</div><ul class="lbTopics">'+tp.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>';
  if(an.length) h+='<div class="lbListH">📣 '+esc(t('Announcements'))+'</div><ul class="lbTopics">'+an.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>';
  return h;
}
function leadTuesHtml_(){
  var h='<div id="leadTues">';
  if(!S.lead) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.leadErr || t('Loading…'))+'</p></div></div>';
  h+='<p class="sub">'+esc(t('The Tuesday morning meeting: who facilitates, who translates, the topics to hit and the announcements.'))+'</p>';
  leadTuesdays_(8).forEach(function(date, i){
    var r=leadTuesFor_(date), open=S.ltOpen===date, fac=leadTuesWho_(r && r.facilitator), tr=leadTuesWho_(r && r.translator);
    h+='<div class="card leadTue'+(i===0?' next':'')+'"><button class="leadTueHead" data-ltopen="'+date+'" aria-expanded="'+open+'">'+
      '<span class="leadTueDate">'+esc(gpT('Tuesday {date}',{date:hospDate_(date)}))+(i===0?' <span class="leadTueNext">'+esc(t('next'))+'</span>':'')+'</span>'+
      '<span class="leadTueWho">🎤 '+esc(fac || '—')+' · 🗣️ '+esc(tr || '—')+(r && r.topics.length ? ' · 📌 '+r.topics.length : '')+(r && (r.announcements||[]).length ? ' · 📣 '+r.announcements.length : '')+'</span></button>';
    if(open) h+=leadTueFormHtml_(date, r);
    else h+=leadTueListsHtml_(r);
    h+='</div>';
  });
  return h+'</div>';
}
function leadTueFormHtml_(date, r){
  var D=S.ltDraft;
  if(!D || D.date!==date) D=S.ltDraft={ date:date, facilitator:r && r.facilitator ? Object.assign({}, r.facilitator) : null, translator:r && r.translator ? Object.assign({}, r.translator) : null,
    topics:r ? r.topics.slice() : [], announcements:r && r.announcements ? r.announcements.slice() : [] };
  /* the leadership team only — plus whoever is already set, if they have since moved on */
  var people=(S.roster||[]).filter(function(p){ return p.campus===S.me.campus && p.dept===BL_DEPT; });
  ['facilitator','translator'].forEach(function(k){ var p=D[k]; if(p && p.id && !people.some(function(x){ return x.id===p.id; })) people.push({ id:p.id, name:staffName_(p.id) }); });
  people=people.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
  var pick=function(key, label){ var p=D[key], v=p ? (p.id || '__other') : '';
    return '<label class="f">'+esc(label)+'</label><select data-ltwho="'+key+'"><option value="">—</option>'+people.map(function(x){ return '<option value="'+esc(x.id)+'"'+(v===x.id?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+
      '<option value="__other"'+(v==='__other'?' selected':'')+'>'+esc(t('Someone else…'))+'</option></select>'+
      (v==='__other' ? '<input type="text" data-ltname="'+key+'" maxlength="60" value="'+esc(p.name||'')+'" placeholder="'+esc(t('Their name'))+'">' : ''); };
  /* a list you can add to, and edit or remove any line of */
  var list=function(key, emoji, label, max, ph){
    return '<label class="f">'+esc(label)+'</label>'+D[key].map(function(x, i){
      return '<div class="ltLine"><span aria-hidden="true">'+emoji+'</span><input type="text" data-tuesline="'+key+'" data-i="'+i+'" maxlength="'+max+'" value="'+esc(x)+'" aria-label="'+esc(label)+' '+(i+1)+'">'+
        '<button class="lwDel" data-tueslinedel="'+key+'" data-i="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+
      '<div class="numIn"><input type="text" data-tuesnew="'+key+'" maxlength="'+max+'" placeholder="'+esc(ph)+'"><button class="btn ghost" data-tuesadd="'+key+'" style="margin:0;width:auto;padding:9px 14px">'+esc(t('Add'))+'</button></div>';
  };
  return '<div class="leadTueForm">'+pick('facilitator', t('Facilitator'))+pick('translator', t('Translator'))+
    list('topics', '📌', t('Topics to hit'), 160, t('e.g. Outreach week, prayer for the DTS'))+
    list('announcements', '📣', t('Announcements'), 200, t('e.g. Water off on Thursday morning'))+
    '<div class="btnRow"><button class="btn" id="ltSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="ltCancel">'+esc(t('Cancel'))+'</button></div></div>';
}
function bindLeadTools_(){
  var gt=document.getElementById('lbGoTues'); if(gt) gt.onclick=function(){ gpTap(); S.lwTab='board'; lwTabKeep_('board'); S.leadTab='tues'; render(); window.scrollTo(0,0); };
  document.querySelectorAll('[data-ltopen]').forEach(function(b){ b.onclick=function(){ gpTap(); var d=b.getAttribute('data-ltopen'); S.ltOpen = S.ltOpen===d ? null : d; S.ltDraft=null; render(); }; });
  var D=S.ltDraft; if(!D) return;
  document.querySelectorAll('[data-ltwho]').forEach(function(sel){ sel.onchange=function(){ var k=sel.getAttribute('data-ltwho'), v=sel.value;
    D[k] = !v ? null : v==='__other' ? { id:'', name:'' } : { id:v, name:'' }; render(); }; });
  document.querySelectorAll('[data-ltname]').forEach(function(inp){ inp.oninput=function(){ D[inp.getAttribute('data-ltname')].name=inp.value; }; });
  /* topics and announcements: type in any line to change it; add; remove */
  document.querySelectorAll('[data-tuesline]').forEach(function(inp){ inp.oninput=function(){ D[inp.getAttribute('data-tuesline')][Number(inp.getAttribute('data-i'))]=inp.value; }; });
  document.querySelectorAll('[data-tueslinedel]').forEach(function(b){ b.onclick=function(){ D[b.getAttribute('data-tueslinedel')].splice(Number(b.getAttribute('data-i')),1); render(); }; });
  var addLine=function(key){ var el=document.querySelector('[data-tuesnew="'+key+'"]'), v=((el && el.value)||'').trim(); if(!v) return;
    if(D[key].length>=15){ showMsg(t('That’s plenty for one meeting.')); return; }
    D[key].push(v); render(); var n=document.querySelector('[data-tuesnew="'+key+'"]'); if(n) n.focus(); };
  document.querySelectorAll('[data-tuesadd]').forEach(function(b){ b.onclick=function(){ addLine(b.getAttribute('data-tuesadd')); }; });
  document.querySelectorAll('[data-tuesnew]').forEach(function(inp){ inp.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); addLine(inp.getAttribute('data-tuesnew')); } }; });
  var cc=document.getElementById('ltCancel'); if(cc) cc.onclick=function(){ S.ltOpen=null; S.ltDraft=null; render(); };
  var sv=document.getElementById('ltSave'); if(sv) sv.onclick=function(){ if(S.busy) return;
    ['topics','announcements'].forEach(function(k){   // a line typed but not added still counts
      var el=document.querySelector('[data-tuesnew="'+k+'"]'), v=((el && el.value)||'').trim(); if(v && D[k].length<15) D[k].push(v); });
    var clean=function(a){ return a.map(function(x){ return String(x||'').trim(); }).filter(Boolean); };
    S.busy=true;
    run('saveLeadTuesday',[S.auth.user,S.auth.pin,{ date:D.date, facilitator:D.facilitator, translator:D.translator, topics:clean(D.topics), announcements:clean(D.announcements) }],function(d){ S.busy=false;
      if(d && d.ok){ S.lead=d; S.ltOpen=null; S.ltDraft=null; showMsg(t('Saved')); } else showMsg(t('Could not save')); render(); },
      function(){ S.busy=false; showMsg(t('No connection — try again when you are online.')); }); };
}
/* ==================== Team → Personalities ====================
   The team's mix of the sixteen types, added up from the types people have
   shared (rosterStaff_ carries avatar.type only while "Show my type to the team"
   is on; season never leaves its owner). For the whole campus, a department or
   one ministry. The four groups, the four pairs with what the team's lean tends
   to mean — YWAM GP's own words — and who has which type. Counts only: no scores. */
var TP_LEAN = 0.65;   // this share or more on one side of a pair is a lean
var TP_LEAN_TEXT = {
  E: 'Mostly Extraverted — this team talks things through and gets its energy from people. Make room for the quieter voices to speak first.',
  I: 'Mostly Introverted — this team thinks before it speaks and does deep, focused work. Say out loud what you are thinking, so plans don’t stay in heads.',
  S: 'Mostly Sensing — practical and grounded, good with what is real today. Set aside time now and then for the bigger picture.',
  N: 'Mostly Intuitive — full of ideas and possibilities. Pin down the details and the next small step, or ideas may stay ideas.',
  T: 'Mostly Thinking — clear, honest and fair in decisions. Check how a decision lands on people, not only whether it is right.',
  F: 'Mostly Feeling — warm and people-first; everyone is cared for. Don’t put off the hard conversation — kindness includes honesty.',
  J: 'Mostly Judging — organised, plans ahead and finishes. Leave a little room for the unexpected, and for people who need it.',
  P: 'Mostly Perceiving — flexible and quick to adapt. Agree deadlines and who owns what, so things get finished.'
};
var TP_MIXED = 'Evenly mixed — the team has both. Let each side lead where it is strongest.';
function teamPScopePeople_(campus){
  if(teamOrgScope_(campus)) return teamPeopleIn_(campus);
  var sc=S.teamPScope||'', here=S.roster.filter(function(p){ return p.campus===campus; });
  if(sc.indexOf('dept:')===0){ var d=sc.slice(5); return here.filter(function(p){ return p.dept===d; }); }
  if(sc.indexOf('min:')===0){ var k=sc.slice(4), i=k.indexOf('|'); return here.filter(function(p){ return p.dept===k.slice(0,i) && p.ministry===k.slice(i+1); }); }
  return here;
}
function teamPScopeSelect_(campus){
  var here=S.roster.filter(function(p){ return p.campus===campus; }), byDept={};
  here.forEach(function(p){ if(!p.dept) return; (byDept[p.dept]=byDept[p.dept]||{}); if(p.ministry) byDept[p.dept][p.ministry]=1; });
  var sc=S.teamPScope||'';
  var opt=function(v, label){ return '<option value="'+esc(v)+'"'+(sc===v?' selected':'')+'>'+esc(label)+'</option>'; };
  var h='<select id="teamPScope" aria-label="'+esc(t('Which team'))+'">'+opt('', gpT('Everyone at {campus}',{campus:t(campusName(campus))}));
  Object.keys(byDept).sort().forEach(function(d){
    h+='<optgroup label="'+esc(t(d))+'">'+opt('dept:'+d, gpT('All of {dept}',{dept:t(d)}));
    Object.keys(byDept[d]).sort().forEach(function(m){ h+=opt('min:'+d+'|'+m, t(m)); });
    h+='</optgroup>';
  });
  return h+'</select>';
}
function teamPersonalityHtml_(campus){
  var all=teamPScopePeople_(campus);
  var people=all.filter(function(p){ return p.avatar && gpPIsType(p.avatar.type); });
  var h='<div class="card">'+(teamOrgScope_(campus) ? '' : teamPScopeSelect_(campus))+
    '<div class="pmeta"'+(teamOrgScope_(campus) ? '' : ' style="margin-top:8px"')+'>'+esc(gpT('{n} of {total} people have shared their type',{n:people.length, total:all.length}))+'</div></div>'+
    teamOrgNoteHtml_(campus);
  if(!people.length) return h+'<div class="card"><p class="sub" style="margin:4px 0">'+
    esc(t('Nobody here has shared a personality type yet. Take the test from My Home.'))+'</p></div>'+pFineHtml();
  var n=people.length;

  // the four groups
  var byGroup={}; Object.keys(GP_PGROUPS).forEach(function(g){ byGroup[g]=[]; });
  people.forEach(function(p){ var g=gpPGroupOf(p.avatar.type); if(g) byGroup[g.id].push(p); });
  h+='<h3>'+esc(t('The four groups'))+'</h3><div class="card">';
  Object.keys(GP_PGROUPS).forEach(function(gid){
    var g=GP_PGROUPS[gid], c=byGroup[gid].length, pct=Math.round(c/n*100);
    h+='<div class="pBar"><div class="pBarTop"><span style="color:'+g.ink+';font-weight:800">'+esc(t(g.name))+'</span><span><b>'+c+'</b> · '+pct+'%</span></div>'+
      '<div class="pTrack"><div class="pFill" style="left:0;width:'+pct+'%;background:'+g.color+'"></div></div>'+
      '<div class="hint" style="margin-top:4px">'+esc(t(g.blurb))+'</div></div>';
  });
  h+='</div>';

  // the four pairs
  h+='<h3>'+esc(t('How this team leans'))+'</h3><div class="card">';
  GP_PAXES.forEach(function(ax, i){
    var a=people.filter(function(p){ return p.avatar.type.charAt(i)===ax.a; }).length, b=n-a;
    var pa=Math.round(a/n*100), lean = a/n>=TP_LEAN ? ax.a : (b/n>=TP_LEAN ? ax.b : '');
    h+='<div class="pBar tpPair"><div class="pBarTop"><span><b>'+esc(t(ax.aName))+'</b> '+a+'</span><span style="color:var(--muted)">'+esc(t(ax.label))+'</span><span>'+b+' <b>'+esc(t(ax.bName))+'</b></span></div>'+
      '<div class="pTrack tpSplit"><div class="pFill" style="left:0;width:'+pa+'%;background:var(--accent)"></div><div class="pFill" style="right:0;width:'+(100-pa)+'%;background:var(--faint)"></div></div>'+
      '<div class="tpLean">'+esc(t(lean ? TP_LEAN_TEXT[lean] : TP_MIXED))+'</div></div>';
  });
  h+='</div>';

  // the sixteen types and who has them
  var byType={}; people.forEach(function(p){ (byType[p.avatar.type]=byType[p.avatar.type]||[]).push(p); });
  var codes=GP_PTYPE_CODES.slice().sort(function(x,y){ return (byType[y]||[]).length-(byType[x]||[]).length; });
  var had=codes.filter(function(c){ return byType[c]; }), none=codes.filter(function(c){ return !byType[c]; });
  h+='<h3>'+esc(t('Who has which type'))+'</h3><div class="card">';
  had.forEach(function(c){
    var g=gpPGroupOf(c);
    h+='<div class="tpTypeRow"><span class="tpArt">'+gpPAvatar(c, (byType[c][0].avatar.sex)||'', 44, true)+'</span>'+
      '<span class="tpType"><b style="color:'+g.ink+'">'+esc(c)+'</b> · '+esc(pTheName(c))+'<span class="sWho">'+
      byType[c].map(function(p){ return '<button class="sWhoBtn" data-person="'+esc(p.id)+'">'+esc(firstName_(p.name))+'</button>'; }).join('')+
      '</span></span><span class="tpN">'+byType[c].length+'</span></div>';
  });
  if(none.length) h+='<div class="hint" style="margin-top:8px">'+esc(t('Not on this team yet:'))+' '+esc(none.join(', '))+'</div>';
  h+='</div>';
  return h+pFineHtml();
}

/* ==================== GP Strengths (the free test) ====================
   YWAM GP's own strengths finder — thirty-four strengths in four groups, found
   through 102 "which is more like you?" pairs (public/gpstrengths.js has the words
   and says why it is pairs). The server works out the Top 5 from the answers.

   Screens: the Strengths card on My Home, the test (S.view 'gtest'), and the
   results page (S.view 'gstr') — yours in full, or a teammate's Top 5 when
   opened from their profile. The Team tab's Strengths map adds up GP Top 5s.
   Every word is YWAM GP's own, so it all goes through t() like everything else. */
var GS_PAGE = 5;
var GS_DRAFT_KEY = 'gp_gstr_draft';
function gsOK(){ return typeof GP_GSTRENGTHS!=='undefined' && typeof gpGSScore==='function'; }
function myGS(){ return (S.profile && S.profile.gstrengths) || null; }
function gsDraftLoad(){
  try { var d=JSON.parse(localStorage.getItem(GS_DRAFT_KEY)||'null'); return (d && typeof d==='object') ? d : {}; }
  catch(e){ return {}; }
}
function gsDraftSave(a){ try { localStorage.setItem(GS_DRAFT_KEY, JSON.stringify(a||{})); } catch(e){} }
function gsDraftClear(){ try { localStorage.removeItem(GS_DRAFT_KEY); } catch(e){} }

function gsChipHtml(id, rank){
  var s=gpGSById(id), g=gpGSGroup(id); if(!s || !g) return '';
  return '<span class="sChip" style="background:'+g.tint+';color:'+g.ink+'">'+
    (rank?'<b>'+rank+'</b> ':'')+esc(t(s.name))+'</span>';
}
/* the group that holds most of a Top 5, when one clearly does */
function gsLean(top){
  var n={}; (top||[]).forEach(function(id){ var g=gpGSGroup(id); if(g) n[g.id]=(n[g.id]||0)+1; });
  var best=null, tie=false;
  Object.keys(n).forEach(function(k){
    if(!best || n[k]>n[best]){ best=k; tie=false; } else if(n[k]===n[best]) tie=true;
  });
  if(!best || tie || n[best]<3) return null;   // five across four groups always puts two somewhere
  return GP_GSGROUPS.filter(function(g){ return g.id===best; })[0];
}
function gsFineHtml(){
  return '<p class="pFine">'+esc(t('GP Strengths is YWAM GP’s own free questionnaire.'))+' '+
    esc(gpT('A strength is what comes naturally to you — everyone can grow in all {n}.',{n:GP_GS_IDS.length}))+'</p>';
}

/* ---------- My Home ---------- */
function strengthsCardHtml(){
  if(!gsOK()) return '';
  var h='<h3 id="sec-strengths">💪 '+esc(t('Strengths'))+'</h3>';
  var g=myGS();
  if(!g){
    return h+'<button class="card pEntry" id="gsStart">'+
      '<span class="pEntryArt"><span class="pQ">5</span></span>'+
      '<span style="flex:1"><div style="font-size:15px;font-weight:800">'+esc(t('Find your top 5 strengths'))+'</div>'+
      '<div class="pmeta">'+esc(gpT('{n} quick choices · free · about 15 minutes',{n:GP_GSPAIRS.length}))+'</div></span>'+PCHEV+'</button>';
  }
  return h+'<button class="card pEntry" id="gsSeeMine" style="align-items:flex-start">'+
    '<span style="flex:1"><div class="sChips">'+g.top.map(function(id,i){ return gsChipHtml(id,i+1); }).join('')+'</div>'+
    '<div class="pmeta" style="margin-top:6px">'+esc(t('Tap to see what your strengths mean for your work.'))+'</div></span>'+PCHEV+'</button>';
}

/* On a teammate's profile: their GP Top 5, and a way into what it means. */
function personGSCardHtml(d){
  if(!gsOK() || !d || !d.gstrengths || !d.gstrengths.length) return '';
  return '<h3>💪 '+esc(t('Strengths'))+'</h3>'+
    '<button class="card pEntry" id="gsSeePerson" style="align-items:flex-start">'+
    '<span style="flex:1"><div class="sChips">'+d.gstrengths.map(function(id,i){ return gsChipHtml(id,i+1); }).join('')+'</div>'+
    '<div class="pmeta" style="margin-top:6px">'+esc(gpT('How to make the most of {name}’s strengths',{name:firstName_(d.staff.name)}))+'</div></span>'+PCHEV+'</button>';
}

/* ---------- the test ---------- */
function gtestHtml(){
  if(!gsOK()) return '<p class="sub">'+esc(t('Strengths could not load. Pull down to refresh.'))+'</p>';
  var T=S.gtest||(S.gtest={stage:'intro', answers:gsDraftLoad(), page:0});
  var total=GP_GSPAIRS.length;
  var h='<button class="linkbtn" id="gsBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>';

  if(T.stage==='intro'){
    var started=Object.keys(T.answers||{}).length;
    h+='<h2>'+esc(t('GP Strengths'))+'</h2>'+
      '<div class="card">'+
      '<p style="margin:2px 0 10px;font-size:15px;line-height:1.5">'+
        esc(gpT('{n} pairs of statements. For each pair, choose which one is more like you — even when both are.',{n:total}))+'</p>'+
      '<p class="sub" style="margin:0 0 10px">'+esc(t('Go with your first answer. Think about what you enjoy and what comes easily, not what your job needs.'))+'</p>'+
      '<p class="sub" style="margin:0 0 12px">'+esc(gpT('At the end you get your top 5 of {n} strengths, and what they mean for your work.',{n:GP_GS_IDS.length}))+'</p>'+
      '<button class="btn" id="gsBegin">'+esc(started? gpT('Carry on — {n} of {total} answered',{n:started,total:total}) : t('Start'))+'</button>'+
      '</div>'+gsFineHtml();
    return h;
  }

  var pages=Math.ceil(total/GS_PAGE);
  var page=Math.max(0, Math.min(pages-1, T.page||0));
  var answered=GP_GSPAIRS.filter(function(p,i){ return T.answers['p'+i]!==undefined; }).length;
  h+='<div class="pProg"><div class="pTrack"><div style="width:'+Math.round(answered/total*100)+'%"></div></div>'+
    '<div class="pProgTxt">'+esc(gpT('{n} of {total}',{n:answered,total:total}))+'</div></div>';
  var from=page*GS_PAGE, pageDone=true;
  for(var i=from; i<Math.min(total, from+GS_PAGE); i++){
    var p=GP_GSPAIRS[i], v=T.answers['p'+i];
    if(v===undefined) pageDone=false;
    var a=gpGSById(p[0]).statements[p[1]], b=gpGSById(p[2]).statements[p[3]];
    h+='<div class="pStmt gsPair'+(v!==undefined?' done':'')+'" id="gq_'+i+'">'+
      '<div class="gsAsk">'+esc(t('Which is more like you?'))+'</div>'+
      '<div class="gsOpts">'+
        '<div class="gsOpt'+(v<0?' lean l':'')+'">'+esc(t(a))+'</div>'+
        '<div class="gsOpt'+(v>0?' lean r':'')+'">'+esc(t(b))+'</div></div>'+
      '<div class="pScale gsScale" role="radiogroup" aria-label="'+esc(t('Which is more like you?'))+'">';
    [-2,-1,0,1,2].forEach(function(n){
      var side = n<0?'ag':(n>0?'dis':'mid');
      h+='<button class="pDot s'+(n===0?0:Math.abs(n)+1)+' '+side+(v===n?' on':'')+'" data-gsans="'+i+'|'+n+'"'+
        ' role="radio" aria-checked="'+(v===n?'true':'false')+'" aria-label="'+esc(gsScaleWord(n))+'"></button>';
    });
    h+='</div><div class="pScaleEnds gsEnds"><span class="ag">← '+esc(t('More like me'))+'</span><span class="dis">'+esc(t('More like me'))+' →</span></div></div>';
  }
  var last = page===pages-1;
  h+='<div style="display:flex;gap:10px;margin:18px 0 6px">'+
    (page>0?'<button class="btn ghost" id="gsPrev" style="flex:1">'+esc(t('Back'))+'</button>':'')+
    (last
      ? '<button class="btn" id="gsFinish" style="flex:2"'+(answered===total?'':' disabled')+'>'+esc(t('See my strengths'))+'</button>'
      : '<button class="btn" id="gsNext" style="flex:2"'+(pageDone?'':' disabled')+'>'+esc(t('Next'))+'</button>')+
    '</div>';
  return h;
}
function gsScaleWord(n){
  return t(['Much more like the first','A little more like the first','Both equally','A little more like the second','Much more like the second'][n+2]);
}

/* ---------- the results page ---------- */
function gstrHtml(){
  if(!gsOK()) return '<p class="sub">'+esc(t('Strengths could not load. Pull down to refresh.'))+'</p>';
  var other=S.gsOther, mine=!other;
  var G = mine ? myGS() : other;
  var back='<button class="linkbtn" id="gstrBack" style="text-align:left;text-decoration:none;padding-left:0">← '+
    esc(mine?t('My Home'):firstName_(other.name))+'</button>';
  if(!G || !G.top || !G.top.length) return back+'<p class="sub">'+esc(t('No strengths yet.'))+'</p>';
  var g1=gpGSGroup(G.top[0]), lean=gsLean(G.top);
  var h=back;
  h+='<div class="pHero gsHero" style="background:'+g1.tint+'">'+
    '<div class="pWho">'+esc(mine?t('Your top 5 strengths'):gpT('{name}’s top 5 strengths',{name:firstName_(other.name)}))+'</div>'+
    '<div class="gsHeroList">'+G.top.map(function(id,i){
      var s=gpGSById(id), g=gpGSGroup(id);
      return '<div class="gsHeroRow"><span class="gsRank" style="background:'+g.ink+'">'+(i+1)+'</span>'+
        '<span style="flex:1;text-align:left"><b style="color:'+g.ink+'">'+esc(t(s.name))+'</b>'+
        '<span class="gsHeroTag">'+esc(t(s.tagline))+'</span></span></div>';
    }).join('')+'</div>'+
    (lean?'<div class="pTag" style="margin-top:10px">'+esc(gpT('Mostly {group}: {blurb}',{group:t(lean.name), blurb:t(lean.blurb)}))+'</div>':'')+
    '</div>';

  G.top.forEach(function(id,i){
    var s=gpGSById(id), g=gpGSGroup(id);
    h+='<div class="card gsCard" style="border-left-color:'+g.color+'">'+
      '<div class="gsCardTop"><span class="gsRank" style="background:'+g.ink+'">'+(i+1)+'</span>'+
        '<span><div class="gsName">'+esc(t(s.name))+'</div>'+
        '<div class="gsGroup" style="color:'+g.ink+'">'+esc(t(g.name))+'</div></span></div>'+
      '<p style="margin:8px 0 6px;font-size:15px;line-height:1.55">'+esc(t(s.about))+'</p>'+
      '<ul class="pList">'+
        s.best.map(function(x){ return '<li><span class="pMark" style="background:var(--pGood)">✓</span>'+esc(t(x))+'</li>'; }).join('')+
        s.watch.map(function(x){ return '<li><span class="pMark" style="background:var(--pBad)">!</span>'+esc(t(x))+'</li>'; }).join('')+
        '<li><span class="pMark" style="background:'+g.ink+'">→</span><b>'+esc(mine?t('For the team:'):t('Working together:'))+'</b> '+esc(t(s.give))+'</li>'+
      '</ul></div>';
  });

  /* yours only: all of them, so the rest are not a mystery */
  if(mine && G.scores){
    /* the Top 5 is the server's, tie-break and all, so it leads as saved */
    var ranked=G.top.concat(GP_GS_IDS.filter(function(id){ return G.top.indexOf(id)===-1; }).sort(function(a,b){
      return (G.scores[b]-G.scores[a]) || (GP_GS_IDS.indexOf(a)-GP_GS_IDS.indexOf(b));
    }));
    /* where the top 10 fall — most people lead from one or two groups */
    var ten=ranked.slice(0,10), inG={};
    ten.forEach(function(id){ var gg=gpGSGroup(id); inG[gg.id]=(inG[gg.id]||0)+1; });
    h+='<h3>'+esc(t('Your top 10, by group'))+'</h3><div class="card">';
    GP_GSGROUPS.forEach(function(gg){
      var n=inG[gg.id]||0;
      h+='<div class="pBar"><div class="pBarTop"><span style="color:'+gg.ink+';font-weight:800">'+esc(t(gg.name))+'</span><span><b>'+n+'</b> / 10</span></div>'+
        '<div class="pTrack"><div class="pFill" style="left:0;width:'+(n*10)+'%;background:'+gg.color+'"></div></div></div>';
    });
    h+='<div class="hint">'+esc(t('Most people lead from one or two groups. No group is better than another.'))+'</div></div>';
    h+='<h3>'+esc(gpT('All {n}',{n:GP_GS_IDS.length}))+'</h3><div class="card">';
    ranked.forEach(function(id,i){
      var g=gpGSGroup(id), sc=Number(G.scores[id])||0;
      h+='<div class="gsAllRow"><span class="gsAllN">'+(i+1)+'</span>'+gsChipHtml(id)+
        '<span class="pTrack gsAllTrack"><span class="pFill" style="left:0;width:'+Math.round((sc+GP_GS_MAX)/(2*GP_GS_MAX)*100)+'%;background:'+g.color+'"></span></span></div>';
    });
    h+='<div class="hint">'+esc(t('The ones lower down are not weaknesses — just what comes less naturally.'))+'</div></div>';

    var share = G.share!==false;
    h+='<div class="card">'+
      '<label class="f">'+esc(t('Show my top 5 to the team'))+'</label>'+
      '<div class="seg" style="max-width:220px">'+
        '<button id="gsShareOn" class="'+(share?'on':'')+'">'+esc(t('Yes'))+'</button>'+
        '<button id="gsShareOff" class="'+(!share?'on':'')+'">'+esc(t('No'))+'</button></div>'+
      '<div class="hint">'+esc(t('Your answers and the full list always stay private.'))+'</div>'+
      '<button class="btn ghost" id="gsRetake">'+esc(t('Retake the test'))+'</button>'+
      '</div>';
  }
  return h+gsFineHtml();
}

function gsSave(payload, then){
  run('saveMyGStrengths',[S.auth.user,S.auth.pin,payload],function(d){
    S.busy=false;
    if(!d || !d.ok){ showMsg(t('Could not save — check your connection and try again.')); render(); return; }
    S.profile=Object.assign({}, S.profile||{}, { gstrengths:d.gstrengths });
    (S.roster||[]).forEach(function(r){ if(r.id===S.me.id){ if(d.staff && d.staff.gstrengths) r.gstrengths=d.staff.gstrengths; else delete r.gstrengths; } });
    if(then) then(d); else render();
  });
}

function bindGStrengths(){
  var st=document.getElementById('gsStart');
  if(st) st.onclick=function(){ S.gtest={stage:'intro', answers:gsDraftLoad(), page:0}; S.view='gtest'; render(); window.scrollTo(0,0); };
  var sm=document.getElementById('gsSeeMine');
  if(sm) sm.onclick=function(){ S.gsOther=null; S.gsBack='week'; S.view='gstr'; render(); window.scrollTo(0,0); };
  var sp=document.getElementById('gsSeePerson');
  if(sp) sp.onclick=function(){
    var d=S.person; if(!d || !d.gstrengths) return;
    S.gsOther={ name:d.staff.name, top:d.gstrengths.slice() };
    S.gsBack='team'; S.view='gstr'; render(); window.scrollTo(0,0);
  };
  var bk=document.getElementById('gsBack');
  if(bk) bk.onclick=function(){
    var T=S.gtest;
    if(T && T.stage==='q' && T.page>0){ T.page--; render(); window.scrollTo(0,0); return; }
    if(T && T.stage!=='intro'){ T.stage='intro'; render(); return; }
    S.view='week'; render();
  };
  var rb=document.getElementById('gstrBack');
  if(rb) rb.onclick=function(){ S.view=S.gsBack||'week'; S.gsOther=null; render(); };

  var bg=document.getElementById('gsBegin');
  if(bg) bg.onclick=function(){
    var T=S.gtest; T.stage='q';
    var first=-1;
    for(var i=0;i<GP_GSPAIRS.length;i++){ if(T.answers['p'+i]===undefined){ first=i; break; } }
    T.page = first<0 ? Math.ceil(GP_GSPAIRS.length/GS_PAGE)-1 : Math.floor(first/GS_PAGE);
    render(); window.scrollTo(0,0);
  };
  document.querySelectorAll('[data-gsans]').forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute('data-gsans').split('|');
      var T=S.gtest; T.answers['p'+parts[0]]=Number(parts[1]);
      gsDraftSave(T.answers);
      gpTap();
      render();
      var from=T.page*GS_PAGE, next=null;
      for(var i=from;i<Math.min(GP_GSPAIRS.length, from+GS_PAGE);i++){ if(T.answers['p'+i]===undefined){ next=i; break; } }
      var el = next!==null ? document.getElementById('gq_'+next) : document.getElementById(T.page===Math.ceil(GP_GSPAIRS.length/GS_PAGE)-1?'gsFinish':'gsNext');
      if(el && el.scrollIntoView) try { el.scrollIntoView({behavior:'smooth', block:'center'}); } catch(e){ el.scrollIntoView(); }
    };
  });
  var nx=document.getElementById('gsNext');
  if(nx) nx.onclick=function(){ S.gtest.page++; render(); window.scrollTo(0,0); };
  var pv=document.getElementById('gsPrev');
  if(pv) pv.onclick=function(){ S.gtest.page--; render(); window.scrollTo(0,0); };
  var fin=document.getElementById('gsFinish');
  if(fin) fin.onclick=function(){
    if(S.busy) return;
    if(!gpGSScore(S.gtest.answers)){ showMsg(t('Answer every pair first.')); return; }
    S.busy=true; fin.disabled=true; fin.textContent=t('Saving…');
    gsSave({ answers:S.gtest.answers }, function(){
      gsDraftClear(); S.gtest=null; S.gsOther=null; S.gsBack='week'; S.view='gstr'; render(); window.scrollTo(0,0);
    });
  };
  var on=document.getElementById('gsShareOn'), off=document.getElementById('gsShareOff');
  if(on) on.onclick=function(){ gsSave({ share:true }); };
  if(off) off.onclick=function(){ gsSave({ share:false }); };
  var rt=document.getElementById('gsRetake');
  if(rt) rt.onclick=function(){
    gsDraftClear();
    S.gtest={stage:'intro', answers:{}, page:0}; S.view='gtest'; render(); window.scrollTo(0,0);
  };
}

function fmtDateShort_(iso){ if(!iso) return ''; var d=new Date(iso); if(isNaN(d)) return String(iso).slice(0,10); return d.toLocaleDateString(LANG==='km'?'km-KH':'en-GB',{ day:'numeric', month:'short', year:'numeric' }); }
/* My Home: when their contract ends soon, or HR has sent a new one to sign —
   tap through to My contract. (A missing or run-out contract is already on
   the Finish your profile card.) */
function contractNoticeHtml_(){
  var R=S.required, c=R && (R.items||[]).filter(function(x){ return x.kind==='contract'; })[0];
  if(!c) return '';
  var msg = (c.done && c.soon) ? gpT('Your contract ends {date} — talk to HR about renewing',{date:teamDate_(c.ends)}) : '';
  if(!msg) return '';
  return '<button class="card contractNotice" id="goMyContract"><span class="signDueIcon">📄</span><span><b>'+esc(t('My contract'))+'</b><span class="rowSub">'+esc(msg)+'</span></span><span class="signDueGo">→</span></button>';
}
/* A student's My Home (student mode, Oct 2026): the same cards staff have — this
   week's chores and cooking, weekly goals, habits — then their mentor (chosen
   from Leadership Development) and About me (personality, strengths, Library).
   No ministry, base, health check-in or anything about other staff. */
function studentHomeHtml_(){
  var first=String((S.me && S.me.name)||'').split(' ')[0];
  var h='<div class="hero stuHero" id="stuHero"><div class="heroLabel">'+esc(t('STUDENT'))+(S.me && S.me.school ? ' · '+esc(String(S.me.school).toUpperCase()) : '')+' · '+esc(t('WEEK'))+' '+thisWeek()+'</div>'+
    '<div class="stuHello">'+esc(gpT('Hi {name}!',{name:first}))+'</div>'+
    '<p class="sub" style="margin:4px 0 0">'+esc(t('Your week at YWAM GP: your chores, goals and habits, your mentor, and more.'))+'</p>'+
    (typeof dutyHtml==='function' ? schedHomeHtml_() : '')+'</div>';
  h+=goalsCardHtml(goalsViewWeek());
  h+=habitsCardHtml();
  h+=studentMentorCardHtml_();
  h+=aboutMeHtml_();
  return h;
}
/* A student's mentor: chosen from Leadership Development (the only staff a
   student sees), who then accepts — like a staff member's mentor. */
function studentMentorCardHtml_(){
  var h='<h3 id="sec-mentor">🤝 '+esc(t('Mentorship'))+'</h3><div class="card" id="stuMentorCard">';
  var m=S.me.mentorId ? personOf(S.me.mentorId) : null;
  if(m && !S.stuMentorPick){
    h+='<div class="mentorBlock" style="padding-bottom:6px">'+avatarHtml(m,'sm')+'<div style="flex:1"><div class="mentorName">'+esc(m.name)+'</div>'+
      '<div class="mentorMeta">'+esc(t(m.ministry||m.dept||''))+'</div></div></div>'+
      '<p class="sub" style="margin:0 0 8px">'+esc(S.me.mentorStatus==='approved' ? gpT('{name} is your mentor.',{name:m.name.split(' ')[0]}) : gpT('Waiting for {name} to accept being your mentor.',{name:m.name.split(' ')[0]}))+'</p>'+
      '<button class="linkbtn inline" id="stuMentorChange">'+esc(t('Choose someone else'))+'</button>';
    return h+'</div>';
  }
  var opts=(S.roster||[]).slice().sort(function(a,b){ return a.name<b.name?-1:1; }).map(function(x){ return '<option value="'+esc(x.id)+'">'+esc(x.name)+(x.ministry?' · '+esc(t(x.ministry)):'')+'</option>'; }).join('');
  h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Choose a mentor from our Leadership Development staff — someone to meet with and pray with while you are here.'))+'</p>'+
    (opts ? '<select id="stuMentorSel"><option value="">'+esc(t('— choose a mentor —'))+'</option>'+opts+'</select>'+
      '<button class="btn" id="stuMentorAsk" style="margin-top:10px">'+esc(t('Ask them to be my mentor'))+'</button>' : '<p class="hint">'+esc(t('No mentors to choose from yet.'))+'</p>')+
    (S.stuMentorPick ? '<button class="linkbtn inline" id="stuMentorCancel">'+esc(t('Cancel'))+'</button>' : '');
  return h+'</div>';
}
function homeHtml(){
  var wk=thisWeek();
  var phase=weekPhase();
  /* Reorganised Oct 2026 (Uriah: "clean up, improve and reorganise"). One idea
     per section, most-used first, nothing said twice: the summary card on top
     (the week at a glance, with Health check-in and My Ministry — so neither
     has a section of its own below), this week's goals and habits, the
     longer view (annual goals, mentorship), and about you (personality,
     strengths). Updates live in the bell (its red dot says when there is
     something new); Leave Request and Profile & settings are in the menu.
     The quick-jump chip strip is gone; the summary card's rows jump. */
  /* The papers to sign live in My contract (☰), not on My Home (Uriah);
     a notice here only when the contract ends soon or a new one is ready. */
  var h=miniDashboardHtml();
  h+=gpQueueBannerHtml_();
  h+=phaseBanner(phase, wk);
  h += f30CardHtml_();
  h += goalsCardHtml(goalsViewWeek());
  h += habitsCardHtml();
  h += annualGoalsHtml();
  h += mentorshipCardHtml();
  h += aboutMeHtml_();
  return h;
}

/* The weekly check-in only (Uriah, Oct 2026): this week's once answered, last
   week's until then, never a week rolled up from days — for the summary card. */
function weeklyCheckin_(wk){ var c=checkinForWeek(wk); return (c && c.source==='weekly') ? c : null; }
function homeHealth_(){
  var cur=thisWeek(), row=weeklyCheckin_(cur), wk=cur;
  if(!row && cur>1 && weeklyCheckin_(cur-1)){ wk=cur-1; row=weeklyCheckin_(wk); }
  var prev=row ? weeklyCheckin_(wk-1) : null;
  return { cur:cur, wk:wk, row:row, score: row ? compositeOf(row) : null, prevScore: prev ? compositeOf(prev) : null };
}

/* --- today's habits: the daily tool --- */
/* ---------- habits: when each is due, and streaks that know it ----------
   Oct 2026 (Uriah): a habit has a schedule — every day, or the weekdays you
   pick (hb.days, 0 Sunday … 6 Saturday) — and can be one of your own (a label
   and an emoji). The card asks only about what is due today; a streak counts
   the due days alone, so a Monday-Wednesday-Friday habit is not broken by a
   Tuesday. */
var DAY_LETTERS=['S','M','T','W','T','F','S'];
var DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function habitDue(hb, d){
  if(!hb || !hb.days || !hb.days.length) return true;
  var dow = (d instanceof Date) ? d.getDay() : new Date(d+'T00:00:00').getDay();
  return hb.days.indexOf(dow)>-1;
}
function myHabitsToday(){ return myHabits().filter(function(hb){ return habitDue(hb, new Date()); }); }
function habitScheduleLabel(hb){
  var days=hb.days||[];
  if(!days.length) return t('Every day');
  if(days.join()==='1,2,3,4,5') return t('Weekdays');
  if(days.join()==='0,6') return t('Weekends');
  if(days.length===1) return gpT('Every {day}',{day:t(DAY_SHORT[days[0]])});
  return days.map(function(d){ return t(DAY_SHORT[d]); }).join(' · ');
}
/* The current run over this habit's due days — one missed day forgiven, as
   graceStreak always has; a day it is not due neither counts nor breaks. */
function habitStreak(hb){
  var pred=habitPred(hb.id);
  var have={}; S.logs.forEach(function(l){ if(pred(l)) have[l.date]=1; });
  var d=new Date();
  if(habitDue(hb,d) && !have[fmtD(d)]) d.setDate(d.getDate()-1);   // today's not due yet
  var n=0, grace=1, guard=0;
  while(guard++<4000){
    if(!habitDue(hb,d)){ d.setDate(d.getDate()-1); continue; }
    if(have[fmtD(d)]){ n++; }
    else if(grace>0 && n>0){ grace--; }
    else break;
    d.setDate(d.getDate()-1);
  }
  return n;
}
function habitBest(hb){
  var pred=habitPred(hb.id);
  var have={}, first=null;
  S.logs.forEach(function(l){ if(pred(l)){ have[l.date]=1; if(!first || l.date<first) first=l.date; } });
  if(!first) return 0;
  var d=new Date(first+'T00:00:00'), today=fmtD(new Date()), best=0, run=0, guard=0;
  while(fmtD(d)<=today && guard++<4000){
    if(habitDue(hb,d)){ run = have[fmtD(d)] ? run+1 : 0; if(run>best) best=run; }
    d.setDate(d.getDate()+1);
  }
  return best;
}

/* A little burst of confetti out of the tile you just ticked. Pure CSS
   transforms through the Web Animations API, cleaned up after itself; skipped
   when the phone asks for reduced motion. */
function gpConfetti(el){
  try {
    if(!el || !el.animate) return;
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var r=el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
    var colors=['#1F44FF','#F5B400','#2BB673','#FF5A5F','#9B5DE5','#00BBF9'];
    var wrap=document.createElement('div'); wrap.className='confettiWrap'; wrap.setAttribute('aria-hidden','true');
    document.body.appendChild(wrap);
    for(var i=0;i<16;i++){
      var p=document.createElement('span'); p.className='confettiBit';
      p.style.background=colors[i%colors.length];
      p.style.left=cx+'px'; p.style.top=cy+'px';
      if(i%3===0) p.style.borderRadius='50%';
      wrap.appendChild(p);
      var ang=(Math.PI*2)*(i/16)+(Math.random()-0.5)*0.6, dist=50+Math.random()*60;
      var dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist-30;
      p.animate([
        { transform:'translate(-50%,-50%) rotate(0deg) scale(1)', opacity:1 },
        { transform:'translate(calc(-50% + '+dx+'px), calc(-50% + '+(dy+40)+'px)) rotate('+(Math.random()*540-270)+'deg) scale(.6)', opacity:0 }
      ], { duration:650+Math.random()*250, easing:'cubic-bezier(.2,.7,.3,1)', fill:'forwards' });
    }
    setTimeout(function(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 1000);
  } catch(e){}
}

function habitsCardHtml(){
  var today=todayStr();
  var log=logForDate(today);
  var all=myHabits();
  var list=all.filter(function(hb){ return habitDue(hb, new Date()); });
  var rest=all.filter(function(hb){ return !habitDue(hb, new Date()); });
  var doneN=list.filter(function(hb){ return log && didHabit(log,hb.id); }).length;

  var h='<h3 id="sec-habits">✅ '+esc(t('Habits'))+'</h3>'+
    '<div class="card"><div class="goalCardHead"><span class="goalCardTitle">'+esc(t('Habit Tracker'))+'</span>'+
    '<span class="goalCardDate">'+esc(today)+'</span></div>';
  if(S.habitEdit) return h+habitPickerHtml_(all)+'</div>';

  h+='<div class="row" style="border:0;padding-top:0">'+
    '<span class="rowName">'+esc(list.length ? (doneN?gpT('{done} of {total} done',{done:doneN,total:list.length}):t('Tap what you’ve done today')) : t('Nothing due today — enjoy the rest.'))+
    '<div class="pmeta">'+esc(log?t('Saved — tap to change'):t('Nothing logged yet'))+'</div></span>'+
    (list.length?'<span class="pctBig">'+Math.round(doneN/list.length*100)+'%</span>':'')+'</div>';

  h+='<div class="habitGrid">';
  list.forEach(function(hb){
    var meta=habitMeta(hb);
    var on=log && didHabit(log,hb.id);
    var run=habitStreak(hb);
    h+='<button class="habitBtn'+(on?' on':'')+'" data-habit="'+esc(hb.id)+'">'+
      '<span class="hIcon">'+esc(meta.icon)+'</span>'+
      '<span class="hLabel">'+esc(t(meta.label))+'</span>'+
      '<span class="hRun">'+(run>0?'🔥 '+run:'&nbsp;')+'</span></button>';
  });
  h+='</div>';
  if(rest.length){
    h+='<button class="linkbtn inline habitRest" id="habitShowRest">'+esc(S.habitShowRest ? t('Hide the others') : (rest.length===1 ? t('1 more on other days') : gpT('{n} more on other days',{n:rest.length})))+' '+(S.habitShowRest?'▴':'▾')+'</button>';
    if(S.habitShowRest){
      h+='<div class="habitRestList">'+rest.map(function(hb){
        var meta=habitMeta(hb);
        return '<div class="habitRestRow"><span>'+esc(meta.icon)+' '+esc(t(meta.label))+'</span><span class="pmeta">'+esc(habitScheduleLabel(hb))+'</span></div>';
      }).join('')+'</div>';
    }
  }

  h+='<button class="linkbtn" id="editHabits" style="margin:8px 0 4px">'+esc(t('Choose my habits'))+'</button>';

  /* Streaks are a look-back, not something anyone needs open every visit —
     behind one button, inside the card, so the page settles sooner. */
  var runs=streaksHtml();
  if(runs) h += '<button class="linkbtn" id="habitLoadMore" style="margin:0">'+esc(t(S.habitMore ? 'Hide streaks' : 'Show streaks'))+'</button>';
  h += '</div>';
  if(runs && S.habitMore) h += runs;
  return h;
}

/* Choosing habits: tick the ones from the list or add your own, and for each
   say when it is due — every day, weekdays, or the days you pick. */
function habitDaysHtml_(hb){
  var days=hb.days||[];
  var preset = !days.length ? 'daily' : days.join()==='1,2,3,4,5' ? 'weekdays' : 'custom';
  var h='<div class="hpWhen">'+
    '<div class="hpPresets">'+
      '<button class="catChip'+(preset==='daily'?' on':'')+'" data-hpdays="'+esc(hb.id)+'|daily">'+esc(t('Every day'))+'</button>'+
      '<button class="catChip'+(preset==='weekdays'?' on':'')+'" data-hpdays="'+esc(hb.id)+'|weekdays">'+esc(t('Weekdays'))+'</button>'+
      '<button class="catChip'+(preset==='custom'?' on':'')+'" data-hpdays="'+esc(hb.id)+'|custom">'+esc(t('Pick days'))+'</button>'+
    '</div>';
  if(preset==='custom'){
    h+='<div class="hpDays">'+[1,2,3,4,5,6,0].map(function(d){
      return '<button class="hpDay'+(days.indexOf(d)>-1?' on':'')+'" data-hpday="'+esc(hb.id)+'|'+d+'" aria-label="'+esc(t(DAY_SHORT[d]))+'" aria-pressed="'+(days.indexOf(d)>-1?'true':'false')+'">'+DAY_LETTERS[d]+'</button>';
    }).join('')+'</div>';
  }
  return h+'</div>';
}
function habitPickerHtml_(list){
  var h='<p class="sub" style="margin:2px 0 8px">'+esc(gpT('Pick up to {n}, and say when each one is due.',{n:MAX_HABITS}))+'</p>';
  var byId={}; list.forEach(function(hb){ byId[hb.id]=hb; });
  HABIT_LIBRARY.forEach(function(meta){
    var on=byId[meta.id];
    h+='<div class="habitPick'+(on?' on':'')+'"><div class="hpTop">'+
      '<button class="hpBox'+(on?' on':'')+'" data-hpick="'+esc(meta.id)+'" aria-pressed="'+(on?'true':'false')+'">'+(on?'✓':'')+'</button>'+
      '<span class="hpLabel">'+meta.icon+' '+esc(t(meta.label))+'</span>'+
      (on?'<span class="hpSched">'+esc(habitScheduleLabel(on))+'</span>':'')+'</div>'+
      (on?habitDaysHtml_(on):'')+'</div>';
  });
  var custom=list.filter(function(hb){ return !!hb.label; });
  if(custom.length){
    h+='<div class="stepsHead" style="margin-top:14px">'+esc(t('Your own'))+'</div>';
    custom.forEach(function(hb){
      h+='<div class="habitPick on"><div class="hpTop">'+
        '<button class="hpBox on" data-hpick="'+esc(hb.id)+'" aria-pressed="true">✓</button>'+
        '<span class="hpLabel">'+esc(hb.icon||'⭐')+' '+esc(hb.label)+'</span>'+
        '<span class="hpSched">'+esc(habitScheduleLabel(hb))+'</span></div>'+
        habitDaysHtml_(hb)+'</div>';
    });
  }
  var d=S.habitNew||{icon:'', label:''};
  h+='<div class="stepsHead" style="margin-top:14px">'+esc(t('Add your own'))+'</div>'+
    '<div class="hpAdd"><input type="text" id="habitNewIcon" maxlength="4" value="'+esc(d.icon)+'" placeholder="⭐" aria-label="'+esc(t('Emoji'))+'">'+
    '<input type="text" id="habitNewLabel" maxlength="40" value="'+esc(d.label)+'" placeholder="'+esc(t('e.g. Call home, Journal, Run'))+'">'+
    '<button class="btn small" id="habitNewAdd">'+esc(t('Add'))+'</button></div>';
  h+='<button class="btn" id="saveHabits" style="margin-top:12px">'+esc(t('Done'))+'</button>';
  return h;
}

function streaksHtml(){
  var runs=myHabits().map(function(hb){
    var meta=habitMeta(hb);
    return { label:meta.label, icon:meta.icon, now:habitStreak(hb), best:habitBest(hb) };
  }).filter(function(r){ return r.now>0 || r.best>0; });
  if(!runs.length) return '';
  var h='<div class="card"><div class="goalCardTitle" style="margin-bottom:8px">🔥 '+esc(t('Streaks'))+'</div>';
  runs.forEach(function(r){
    h+='<div class="row"><span class="rowName">'+r.icon+' '+esc(t(r.label))+
      '<div class="pmeta">'+esc(gpT('best {n} days',{n:r.best}))+'</div></span>'+
      '<span class="pctSm">'+r.now+'d</span></div>';
  });
  return h+'</div>';
}



/* --- three weekly goals --- */
/* ---- goal progress: percentage, not a tick ----
   goalItemPct reads either shape, because rows written before this stored `done`.
   The colour walks amber → blue → green as the number climbs, so a row's state is
   legible before you read the digits; the word underneath says the same thing for
   anyone who cannot pick those colours apart. */
function goalItemPct(g){
  if(!g) return 0;
  var n = Number(g.pct);
  if(g.pct!==undefined && g.pct!==null && g.pct!=='' && isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  return g.done ? 100 : 0;
}
/* The week's own figure is the average of what's actually written — three
   goals at 60% is a 60% week, same rule saveGoals uses server-side. Needed
   client-side too now, for the record an offline save shows before there's
   been any round trip to ask the server what it thinks. */
function gpGoalsWeekPct_(items){
  var written = (items||[]).filter(function(i){ return i && i.text; });
  if(!written.length) return null;
  var sum = written.reduce(function(s,i){ return s+goalItemPct(i); },0);
  return Math.round(sum/written.length);
}
/* Thin wrappers over rollup.js, so the dashboard and this page cannot disagree
   about what 60% looks like. */
function pctColor(p){ return gpPctColor(p); }
function pctWord(p){ return gpPctWord(p); }
function ringVars(p){ return gpRingVars(p); }
function ringHtml(p, big){ return gpRingHtml(p, big ? 'lg' : ''); }

function goalsCardHtml(wk){
  var isCur = Number(wk)===Number(thisWeek());

  var rec=goalsForWeek(wk);
  var items = (rec && rec.items && rec.items.length) ? rec.items : [];
  var written = items.filter(function(i){ return i && i.text; });

  var h='<h3 id="sec-goals" class="secWithBtn">🎯 '+esc(t('Weekly Goals'))+(S.student ? '' : '<button class="secBtn" id="goGpTasksGoals">✅ '+esc(t('GP Tasks'))+' ›</button>')+'</h3>';

  /* One card for the week being looked at, with a small Last week / This week /
     Next week switch under the goals (goalsWeekSwitchHtml_): last week to mark
     how it went, next week to plan it ahead (Oct 2026, Uriah). */
  var cur=thisWeek(), isLast = Number(wk)===cur-1, isNext = Number(wk)===cur+1;
  h+='<div class="card">'+
    '<div class="goalCardHead"><span class="goalCardTitle">'+esc(isCur ? gpT('Week {n}',{n:wk}) : isLast ? t('Last week') : isNext ? t('Next week') : gpT('Week {n}',{n:wk}))+'</span>'+
    '<span class="goalCardDate">'+esc(weekRangeShort_(wk))+'</span></div>'+
    (isLast ? '<p class="hint" style="margin:0 0 8px">'+esc(t('How did last week go? Move each slider to where it ended.'))+'</p>' : '')+
    (isNext ? '<p class="hint" style="margin:0 0 8px">'+esc(t('Plan ahead: write next week’s goals now, and they’ll be waiting on Monday.'))+'</p>' : '');

  if(written.length){
    written.forEach(function(g,i){
      var gp=goalItemPct(g);
      var editing = S.goalEditIdx===i;
      h+='<div class="wgRow'+(gp>=100?' done':'')+'">'+
        ringHtml(gp)+
        '<div class="goalBody">'+
          (editing
            ? '<div class="wgTop"><input type="text" class="addGoalInput" id="editGoalText" maxlength="200" value="'+esc(g.text)+'" style="flex:1"></div>'
            : '<div class="wgTop"><span class="wgText">'+esc(g.text)+'</span>'+
              '<span class="wgPct" style="color:'+pctColor(gp)+'">'+gp+'% · '+esc(pctWord(gp))+'</span></div>')+
          (S.student ? '' :   // students have no ministry KPIs
          '<label class="goalLink'+(g.metricKey?'':' unlinked')+'" style="display:flex;align-items:center;gap:4px">📊 '+
            '<select class="goalLinkSel" data-goallink="'+i+'" style="border:0;background:none;color:inherit;font:inherit;padding:0">'+
            okrMetricOptions(g.metricKey, g.metricKey ? 'Not linked to a KPI' : 'Link to a KPI')+
            '</select></label>')+
          (isNext ? '' : '<input type="range" class="gSlide" min="0" max="100" step="5" value="'+gp+'" data-goalpct="'+i+'"'+
            ' style="'+ringVars(gp)+'"'+
            ' aria-label="'+esc(t('Progress'))+': '+esc(g.text)+'">')+
          '<div class="wgActions">'+
            (editing
              ? '<button class="linkbtn inline" data-goaleditsave="'+i+'">'+esc(t('Save'))+'</button>'+
                '<button class="linkbtn inline" data-goaleditcancel="'+i+'">'+esc(t('Cancel'))+'</button>'
              : (gp<100 && !isNext?'<button class="completePill" data-goalcomplete="'+i+'">'+esc(t('Mark Complete'))+'</button>':'')+
                '<button class="removeX" data-goaledit="'+i+'" aria-label="'+esc(t('Edit goal text'))+'">'+
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>'+
                '<button class="removeX" data-goalremove="'+i+'" aria-label="'+esc(t('Remove goal'))+'">'+
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg></button>')+
          '</div>'+
        '</div></div>';
    });
  } else {
    h+='<p class="sub" style="margin:4px 0 10px">'+
       esc(isCur ? t('No goals set for this week yet. Three is the whole point — pick the three that matter.') : isNext ? t('No goals for next week yet. Pick the three that matter, and Monday starts clear.') : t('You didn’t set goals that week.'))+'</p>';
  }

  if(written.length<3 && (isCur || isNext)){
    h+='<div class="addGoalRow">'+
      '<input type="text" class="addGoalInput" id="newGoalText" maxlength="200" placeholder="'+esc(isNext ? t('Add a goal for next week…') : t('Add a goal for this week…'))+'">'+
      '<button class="addGoalBtn" id="addGoalBtn" aria-label="'+esc(t('Add goal'))+'">'+
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>'+
    '</div>';
  }

  h+=goalsWeekSwitchHtml_(wk);
  h+='</div>';
  return h;
}

/* Last week / This week / Next week, small, under the goals. Another week (a
   link from the bell, say) shows its own name and a way back to this one. Next
   week is offered up to week 51: weeks are kept per year as 1–52, so the year's
   last week plans the new year's first on the Monday it starts. */
function goalsWeekSwitchHtml_(wk){
  var cur=thisWeek(), canLast=cur>1, canNext=cur<=51;
  if(Number(wk)!==cur && !(canLast && Number(wk)===cur-1) && !(canNext && Number(wk)===cur+1))
    return '<button class="linkbtn" style="margin:6px 0 0" id="goalsJumpCurrent">'+esc(t('Jump back to this week'))+'</button>';
  if(!canLast && !canNext) return '';
  return '<div class="goalsWeekSwitch">'+
    (canLast ? '<button data-goalswk="last" class="'+(Number(wk)===cur-1?'on':'')+'">'+esc(t('Last week'))+'</button>' : '')+
    '<button data-goalswk="this" class="'+(Number(wk)===cur?'on':'')+'">'+esc(t('This week'))+'</button>'+
    (canNext ? '<button data-goalswk="next" class="'+(Number(wk)===cur+1?'on':'')+'">'+esc(t('Next week'))+'</button>' : '')+'</div>';
}

/* --- your ministry's KPIs, editable without leaving this page --- */
/*  Everything the dashboard's log form asks of this ministry, on the person's
    own page — and split the way the numbers actually behave, because one box
    cannot serve both kinds:

      · counts (sum mode) — something that happened today. Typed per day; the
        server rolls the days into the week, so the weekly figure is never typed
        twice. The box is today's addition, and it says what the week becomes.
      · levels and scores (latest / avg) — a headcount or a 1-10 judgement about
        the whole week. Typed once for the week, and carried forward already
        filled in from the last week that has one, exactly as the dashboard does
        it, so nobody retypes 280 students every Monday.

    A level must never be written as a daily row: a headcount is not something you
    add up, and the daily roll-up owns any metric it touches (see CLAUDE.md), so
    the two would fight over the same weekly cell.

    Formats come from fmt() and modeOf() — the same two functions the dashboard
    uses — so a dollar figure, a 1-10 score and a percentage read the same in both
    places. */
/*  The last figure a level actually had, and which week it came from.

    `entries` only covers this year, which is right for totals and wrong for the
    headcounts that barely move: "Students Enrolled" last typed in week 50 of last
    year is still the enrolment in week 2 of this one, so the box came up empty and
    somebody had to remember 280 and retype it. A headcount does not reset because
    the calendar did.

    So when this year holds nothing earlier, fall back to the server's `prev` map
    (prevLevels_ in api.js), which looks across every year. Returns
    {week, value, year} — the year is carried through so the label can say week 50,
    2025 instead of implying last week. */
function prevLevel_(wks, wk, metric, prevMap){
  var p = lastBefore(wks, wk);
  if(p !== null) return { week:p.week, value:p.value, year:kpiYear_() };
  var q = prevMap && prevMap[metric];
  if(!q) return null;
  var qy=Number(q.year), qw=Number(q.week), qv=Number(q.value);
  if(!isFinite(qy) || !isFinite(qw) || !isFinite(qv)) return null;
  /* This year's earlier weeks are already in `wks`, so anything the map offers
     from this year is at or after the week on screen — not something to carry. */
  if(qy > kpiYear_() || (qy === kpiYear_() && qw >= Number(wk))) return null;
  return { week:qw, value:qv, year:qy };
}

function kpiYear_(){ return thisWeekYear(); }

/*  The " · carried from week 50, 2025 ▲ 12" tail under a level's box. Your own
    ministry's weekly card and an overseer's had drifted into two copies of this
    paragraph; they share it now so a fix lands in both. */
function levelPrevSubHtml_(p, metric, carried, typed){
  var stamp = String(p.week) + ((p.year && p.year !== kpiYear_()) ? ', '+p.year : '');
  var out = ' \u00b7 ' + (carried
    ? esc(t('carried from week'))+' '+stamp
    : esc(t('week'))+' '+stamp+': '+fmt(p.value, metric));
  var d = Number(typed) - p.value;
  if(d && !isNaN(d)) out += '<span class="trend '+(d>0?'up':'down')+'">'+(d>0?'\u25b2':'\u25bc')+' '+fmt(Math.abs(d), metric)+'</span>';
  return out;
}

/* The reverse of kr.metricKey: an OKR key result links FROM the objective TO
   a metric (dept|ministry|metric) to pull its progress live — this is a
   metric asking the question the other way, for whoever is typing the
   number: does this feed anything? Reads S.base.okrs, already on the page
   for everyone by boot time (My Home's roll-up needs it too), so no
   extra fetch. Scoped to the metric's own campus, same as krProgress(). */
function metricOkrNote_(campus, dept, ministry, metric){
  var key = dept+'|'+ministry+'|'+metric;
  var okrs = ((S.base && S.base.okrs) || []).filter(function(o){
    return o.campus===campus && (o.krs||[]).some(function(kr){ return kr.metricKey===key; });
  });
  if(!okrs.length) return '';
  var label = okrs.length===1
    ? gpT('feeds “{objective}”', {objective: okrs[0].objective})
    : gpT('feeds {n} objectives', {n: okrs.length});
  return ' · <span class="okrFeeds">🎯 '+esc(label)+'</span>';
}

/* One row of a weekly figure — latest (carries forward), avg (a score), or
   sum entered directly for the week rather than built up from daily taps
   (a BL_COMMON personal figure, a headcount, or — for a Campus Leadership
   overseer — every metric on their own page, which is weekly-only start to
   finish). Used throughout kpiCardHtml's "This week" section. */
function kpiWeekRowHtml_(metric, wk, entries, prevMap, draft, campus, dept, ministry){
  var mode=modeOf(metric);
  var wks=entries[metric]||{};
  var cur = wks[String(wk)]!==undefined ? wks[String(wk)] : '';
  var carried=false, sub='', extra='';
  if(mode==='latest'){
    var agg=aggregate(wks, mode);
    var prev=prevLevel_(wks, wk, metric, prevMap);
    carried = (cur==='' && prev!==null);
    if(carried){ cur=prev.value; extra=' data-carried="1"'; }
    sub = esc(t('now'))+' '+fmt(agg===null&&prev?prev.value:agg, metric);
    if(prev!==null){
      sub += levelPrevSubHtml_(prev, metric, carried, draft[metric]!==undefined ? draft[metric] : cur);
    } else {
      sub += ' · ' + esc(t('nothing logged before this week'));
    }
  } else if(mode==='sum'){
    sub = esc(t('week total'))+' '+fmt(cur===''?null:Number(cur), metric)+
      gpVsLastWeek(wks, wk, metric, draft[metric]!==undefined ? draft[metric] : cur);
  } else {
    var agg2=aggregate(wks, mode);
    var thisWk = wks[String(wk)];
    sub = esc(t('avg'))+' '+fmt(agg2, metric)+
      gpVsLastWeek(wks, wk, metric, draft[metric]!==undefined ? draft[metric] : thisWk);
  }
  if(campus && dept && ministry) sub += metricOkrNote_(campus, dept, ministry, metric);
  if(draft[metric]!==undefined) cur=draft[metric];
  return '<div class="row"><div>'+kpiNameHtml_(metric, ministry||(S.me&&S.me.ministry))+
    '<div class="rowSub">'+sub+'</div></div>'+
    '<input type="number" inputmode="decimal" class="kpiIn"'+kpiInputAttrs_(metric)+
    ' data-kpiweek="'+esc(metric)+'" value="'+esc(String(cur))+'"'+extra+'></div>';
}

/* One row of a monthly/quarterly-cadence metric — one number for the whole
   period, no carry-forward (a fresh month starts blank, unlike a level) and
   no day-by-day or vs-last-period breakdown, since it's typed once. attr is
   'kpimonth' or 'kpiquarter', so the two sections' inputs never collide. */
function kpiPeriodRowHtml_(metric, anchorWeek, entries, draft, attr, campus, dept, ministry){
  var wks=entries[metric]||{};
  var stored = wks[String(anchorWeek)];
  var cur = draft[metric]!==undefined ? draft[metric] : (stored!==undefined ? stored : '');
  var sub = stored!==undefined ? (esc(t('logged'))+' '+fmt(Number(stored), metric)) : esc(t('nothing logged yet'));
  if(campus && dept && ministry) sub += metricOkrNote_(campus, dept, ministry, metric);
  return '<div class="row"><div>'+kpiNameHtml_(metric, ministry||(S.me&&S.me.ministry))+
    '<div class="rowSub">'+sub+'</div></div>'+
    '<input type="number" inputmode="decimal" class="kpiIn" data-'+attr+'="'+esc(metric)+'" value="'+esc(String(cur))+'"></div>';
}

function kpiCardHtml(wk){
  if(!S.me.ministry){
    return '<div class="card"><p class="sub" style="margin:4px 0 10px">'+
      'Set your ministry on the Profile tab and your team’s KPIs will show up here, ready to log.</p>'+
      '<button class="btn ghost" id="goProfile">Choose my ministry</button></div>';
  }
  var metrics=metricsFor(S.me.campus, S.me.dept, S.me.ministry);
  if(!metrics.length){
    return '<div class="card"><p class="sub" style="margin:4px 0">'+
      'No KPIs are defined for '+esc(S.me.ministry)+' yet.</p></div>';
  }
  var entries=(S.ministry&&S.ministry.entries)||{};
  var prevMap=(S.ministry&&S.ministry.prev)||{};
  var daily=(S.ministry&&S.ministry.daily)||{};
  var pins=(S.ministry&&S.ministry.pins)||[];
  var today=todayStr();
  var isCurWk=Number(wk)===Number(thisWeek());
  /* Backfilling a past week doesn't have a "today" — daily sum-type numbers
     for that week land on its last day, same as the week's own total is one
     figure rather than a day-by-day breakdown in the section below. */
  var entryDate = kpiEntryDate_(wk);

  /* A metric an admin has set to monthly or quarterly cadence (metricEditorHtml_)
     skips the daily "Today" list entirely and gets its own "This month"/"This
     quarter" section instead — one number for the period, same idea as a
     level, but summed rather than carried forward (see kpiPeriodRowHtml_). */
  var monthlyCounts=metrics.filter(function(m){
    return modeOf(m)==='sum' && cadenceOf(S.me.campus, S.me.dept, S.me.ministry, m)==='month';
  });
  var quarterlyCounts=metrics.filter(function(m){
    return modeOf(m)==='sum' && cadenceOf(S.me.campus, S.me.dept, S.me.ministry, m)==='quarter';
  });
  /* A Campus Leadership overseer's own page is entirely weekly — no daily
     "Today" list at all (their own figures were never really daily, and
     Total Staff/Staff Debt, the two that used to sit in their own separate
     Department Headcount section, are level metrics anyway) — one "This
     week" section holds everything that isn't monthly/quarterly. Every
     other ministry keeps the daily/weekly split its own count metrics
     (Cups Sold, Days Open…) actually need. */
  var isBL = S.me.dept==='Campus Leadership';
  var counts = isBL ? [] : metrics.filter(function(m){
    return modeOf(m)==='sum' && WEEKLY_ONLY_METRICS.indexOf(m)===-1 &&
      monthlyCounts.indexOf(m)===-1 && quarterlyCounts.indexOf(m)===-1;
  });
  var levels=metrics.filter(function(m){
    if(monthlyCounts.indexOf(m)>-1 || quarterlyCounts.indexOf(m)>-1) return false;
    return counts.indexOf(m)===-1;
  });

  /* Pins are about the daily list only — how many boxes you face every day. A
     level carries itself forward, so hiding one saves nobody any typing. */
  var pinnedCounts=pins.filter(function(m){ return counts.indexOf(m)>-1; });
  var showing = (pinnedCounts.length && !S.kpiAll)
    ? counts.filter(function(m){ return pinnedCounts.indexOf(m)>-1; })
    : counts;
  var hiddenN = counts.length - showing.length;

  var h='';

  if(S.kpiPick){
    h+='<div class="card">';
    h+='<p class="sub" style="margin:2px 0 8px">Star the ones you log most days — '+
       'the rest stay one tap away under “show all”.</p>';
    counts.forEach(function(metric){
      var on=pins.indexOf(metric)>-1;
      h+='<div class="habitPick">'+
        '<button class="hpBox'+(on?' on':'')+'" data-kpipin="'+esc(metric)+'">'+(on?'★':'')+'</button>'+
        '<span class="hpLabel">'+esc(t(metric))+'</span></div>';
    });
    return h+'<button class="btn" id="saveKpiPins" style="margin-top:12px">Done</button></div>';
  }

  /* ---- what happened today / what is true of the whole week ----
     Collapsed by default: these boxes are useful when you have numbers to
     log, but sitting open on every visit to My Home pushes everything
     else below the fold. The week picker used to be a card of its own above
     this one — now it's just this box's first section, so switching weeks
     and logging numbers read as one thing instead of two. */
  /* The week picker sits in the status card above this one now (see
     ministryWeekStatusHtml_), which is also where the form is unfolded from. */
  h += '<div class="accCard">';

  if(counts.length){
    var dayTitle = isCurWk ? t('Today') : entryDate;
    var daySummary = isCurWk ? gpT('{n} to log today', {n: showing.length})
      : gpT('{n} to log for {range}', {n: showing.length, range: weekRangeShort_(wk)});
    h += accRowHtml('dbAcc', 'kpiDay', esc(dayTitle), daySummary, function(){
      var b = '<div id="kpiDayCard">';
      b += '<p class="sub" style="margin:4px 0 10px">'+
        (isCurWk
          ? esc(gpT('Log today’s numbers — week {wk} adds up on its own.',{wk:wk}))
          : esc(gpT('Backfilling week {wk} — this lands on {date}.',{wk:wk, date:entryDate})))+
        '</p>';
      showing.forEach(function(metric){
        var days=daily[metric]||{};
        var savedToday = days[entryDate];
        var cur = S.kpiDraft[metric]!==undefined ? S.kpiDraft[metric]
          : (savedToday!==undefined ? savedToday : '');
        var weekVal=(entries[metric]||{})[String(wk)];
        /* What the week is without today, so the running total below the box adds
           up to the week's real figure rather than counting today twice. */
        var base = (weekVal===undefined?0:Number(weekVal)) - (savedToday===undefined?0:Number(savedToday));
        /* Last week next to this one, because "is the cafe up or down" is the
           question anyone typing the number is really asking. */
        b+='<div class="row"><div>'+kpiNameHtml_(metric, S.me.ministry)+
          '<div class="rowSub">'+esc(t('week total'))+' '+fmt(weekVal===undefined?null:Number(weekVal), metric)+
          gpVsLastWeek(entries[metric], wk, metric, weekVal)+
          metricOkrNote_(S.me.campus, S.me.dept, S.me.ministry, metric)+
          '<span class="newTot"></span></div></div>'+
          '<input type="number" inputmode="decimal" class="kpiIn" placeholder="+0" data-kpi="'+esc(metric)+
          '" data-metric="'+esc(metric)+'" data-mode="sum" data-run="'+base+
          '" data-kpimode="sum" value="'+esc(String(cur))+'"></div>';
      });
      b+='<button class="btn" id="saveKpiBtn">'+esc(t('Save today'))+'</button>';
      if(hiddenN>0) b+='<button class="linkbtn" id="kpiShowAll">'+esc(gpT('Show all {total} ({hidden} hidden)',{total:counts.length,hidden:hiddenN}))+'</button>';
      else if(pinnedCounts.length && S.kpiAll) b+='<button class="linkbtn" id="kpiShowLess">Show just my '+pinnedCounts.length+'</button>';
      b+='<button class="linkbtn" id="pickKpis">'+esc(t(pinnedCounts.length?'Change which I log daily':'Pick the ones I log daily'))+'</button>';
      return b+'</div>';
    });
  }

  if(levels.length){
    var weekSummary = gpT('{n} for {range}', {n: levels.length, range: weekRangeShort_(wk)});
    h += accRowHtml('dbAcc', 'kpiWeek', esc(t('This week')), weekSummary, function(){
      var b = '<div id="kpiWeekCard">';
      b += '<p class="sub" style="margin:4px 0 10px">'+
        esc(t('One number per week — headcounts and scores carry forward until changed; the rest is logged fresh each week.'))+'</p>';
      levels.forEach(function(metric){
        b += kpiWeekRowHtml_(metric, wk, entries, prevMap, S.kpiWeekDraft, S.me.campus, S.me.dept, S.me.ministry);
      });
      b+='<button class="btn saveKpiWeekBtn" id="saveKpiWeekBtn">'+esc(t('Save Week'))+' '+wk+'</button>';
      return b+'</div>';
    });
  }

  /* Monthly/quarterly-cadence metrics (set by an admin in "Edit what we
     track") — their own section each, since neither is tied to the weekly
     card's week pointer at the top of this page. */
  if(monthlyCounts.length){
    var mwk = monthAnchorWeek_();
    var monthLabel = MONTH_ABBR[weekYearToday_().getMonth()];
    var mSummary = gpT('{n} for {month}', {n: monthlyCounts.length, month: monthLabel});
    h += accRowHtml('dbAcc', 'kpiMonth', esc(t('This month')), mSummary, function(){
      var b = '<div id="kpiMonthCard">';
      b += '<p class="sub" style="margin:4px 0 10px">'+
        esc(gpT('Logged once for {month}, not built up from weekly entries.',{month:monthLabel}))+'</p>';
      monthlyCounts.forEach(function(metric){
        b += kpiPeriodRowHtml_(metric, mwk, entries, S.kpiMonthDraft, 'kpimonth', S.me.campus, S.me.dept, S.me.ministry);
      });
      b+='<button class="btn" id="saveKpiMonthBtn">'+esc(t('Save Month'))+'</button>';
      return b+'</div>';
    });
  }
  if(quarterlyCounts.length){
    var qwk = quarterAnchorWeek_();
    var qNum = Math.floor(weekYearToday_().getMonth()/3)+1;
    var qSummary = gpT('{n} for Q{q}', {n: quarterlyCounts.length, q: qNum});
    h += accRowHtml('dbAcc', 'kpiQuarter', esc(t('This quarter')), qSummary, function(){
      var b = '<div id="kpiQuarterCard">';
      b += '<p class="sub" style="margin:4px 0 10px">'+
        esc(gpT('Logged once for Q{q}, not built up from weekly entries.',{q:qNum}))+'</p>';
      quarterlyCounts.forEach(function(metric){
        b += kpiPeriodRowHtml_(metric, qwk, entries, S.kpiQuarterDraft, 'kpiquarter', S.me.campus, S.me.dept, S.me.ministry);
      });
      b+='<button class="btn" id="saveKpiQuarterBtn">'+esc(t('Save Quarter'))+'</button>';
      return b+'</div>';
    });
  }

  h += '</div>';
  return h;
}

/* A ministry you oversee but don't work in day-to-day — so unlike your own
   ministry (kpiCardHtml, which keeps the daily Today log), there's no daily
   entry here at all: everything is one number a week, addressed by an
   explicit dept+ministry and keyed by ministry name in every piece of state
   and every data-* attribute so a department overseer can have several of
   these open on one page (one per ministry they oversee) without one's
   draft or week pointer clobbering another's.

   A count metric (Salvations, Teams Hosted…) is normally built up from the
   ministry's own daily logging (see kpiCardHtml/saveMyKpiDay) — this box
   is a direct overwrite of that week's total instead, for a week nobody on
   the team logged day by day. If the team later does log days for that same
   week, their daily rollup takes the week back over, the same way a
   hand-typed weekly Health check-in only holds until fresher daily logs
   roll a week up on their own.

   Saves go through saveMinistryFor, the same authorization the server
   enforces everywhere else (own ministry, or a department you lead). No
   pin-picking here: hiding a count saves nobody's time when you are not the
   one filling it in most days. */
/* The weekly boxes for a ministry that isn't your own — the overseer's, the
   admin's jump-to-any-ministry — one row per metric and a Save Week button,
   keyed by ministry name so the save handler knows which one. Weekly only:
   day by day belongs to the ministry's own team. The week itself is picked
   in the status card above this (ministryWeekStatusHtml_ with ovMin). */
function ovWeekRowsHtml_(dept, ministry, data, wk){
  S.ovDeptOf[ministry] = dept;
  var metrics = metricsFor(S.me.campus, dept, ministry);
  if(!metrics.length){
    return '<div class="card"><p class="sub" style="margin:4px 0">'+
      esc(gpT('No KPIs are defined for {ministry} yet.',{ministry:t(ministry)}))+'</p></div>';
  }
  var entries=(data&&data.entries)||{};
  var prevMap=(data&&data.prev)||{};
  var weekDraft = S.ovWeekDraft[ministry] || (S.ovWeekDraft[ministry]={});
  var b='<div class="card" id="ovWeekCard">';
  b += '<p class="sub" style="margin:0 0 6px">'+
    esc(t('Logged weekly only — day by day belongs to the ministry’s own team on their My Ministry page. The ones that rarely change are already filled in from last time.'))+'</p>';
    metrics.forEach(function(metric){
      var mode=modeOf(metric);
      var wks=entries[metric]||{};
      var cur = wks[String(wk)]!==undefined ? wks[String(wk)] : '';
      var carried=false;
      var sub='', extra='';
      if(mode==='latest'){
        var agg=aggregate(wks, mode);
        var prev=prevLevel_(wks, wk, metric, prevMap);
        carried = (cur==='' && prev!==null);
        if(carried){ cur=prev.value; extra=' data-carried="1"'; }
        sub = esc(t('now'))+' '+fmt(agg===null&&prev?prev.value:agg, metric);
        if(prev!==null){
          sub += levelPrevSubHtml_(prev, metric, carried,
            weekDraft[metric]!==undefined ? weekDraft[metric] : cur);
        } else {
          sub += ' · ' + esc(t('nothing logged before this week'));
        }
      } else if(mode==='sum'){
        // A count is this week's own figure here, not a running daily total.
        sub = esc(t('week total'))+' '+fmt(cur===''?null:Number(cur), metric)+
          gpVsLastWeek(wks, wk, metric, weekDraft[metric]!==undefined ? weekDraft[metric] : cur);
      } else {
        var agg2=aggregate(wks, mode);
        sub = esc(t('avg'))+' '+fmt(agg2, metric)+
          gpVsLastWeek(wks, wk, metric, weekDraft[metric]!==undefined ? weekDraft[metric] : cur);
      }
      if(weekDraft[metric]!==undefined) cur=weekDraft[metric];
      b+='<div class="row"><div>'+kpiNameHtml_(metric, ministry)+
        '<div class="rowSub">'+sub+'</div></div>'+
        '<input type="number" inputmode="decimal" class="kpiIn"'+kpiInputAttrs_(metric)+
        ' data-ovweek="'+esc(ministry)+'" data-ovmetric="'+esc(metric)+'" value="'+esc(String(cur))+'"'+extra+'></div>';
    });
  b+='<button class="btn" data-ovsaveweek="'+esc(ministry)+'">'+esc(t('Save Week'))+' '+wk+'</button>';
  return b+'</div>';
}

/* Entry point on My Home — a tappable card like Leave Request's, so the
   Ministry Tracker is its own full page instead of an inline accordion.
   Generic label for everyone ("My Ministry"), personalized subtitle once
   opened — same shape as Leave Request's card always saying "Leave
   Request" while the page behind it is about your own days off. */
/* A tile on My Home: icon, title, a line under it. */
function homeTile_(id, icon, title, sub){
  return '<button class="card homeTile" id="'+id+'"><span class="homeTileIcon">'+icon+'</span>'+
    '<span class="homeTileTitle">'+esc(title)+'</span>'+(sub?'<span class="homeTileSub">'+sub+'</span>':'')+'</button>';
}
function myMinistryEntryHtml(){
  return '<h3 id="sec-kpi">'+esc(t('My Ministry'))+'</h3>'+
    '<button class="card leaveEntry" id="goMinistryFromMe">'+
    '<span class="leaveEntryIcon">📊</span>'+
    '<span style="flex:1"><div style="font-size:13.5px;font-weight:700">'+esc(t('My Ministry'))+'</div>'+
    (S.me.ministry?'<div class="pmeta">'+esc(t(S.me.ministry))+'</div>':'')+'</span>'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--faint);flex:0 0 auto"><path d="M9 6l6 6-6 6"/></svg></button>';
}

/* Same "tappable card on My Home, full page behind it" shape as My
   Ministry just above — OKRs used to be an inline accordion here too,
   which made the page long whether or not you had anything to update this
   week. The department/ministry context now shows once, at the top of the
   page, instead of being implied by wherever the card happened to sit. */
function myOkrEntryHtml(){
  return '<h3 id="sec-okr">🎯 '+esc(t('OKRs'))+'</h3>'+
    '<button class="card leaveEntry" id="goOkrFromMe">'+
    '<span class="leaveEntryIcon">🎯</span>'+
    '<span style="flex:1"><div style="font-size:13.5px;font-weight:700">'+esc(t('OKRs'))+'</div>'+
    (S.me.ministry?'<div class="pmeta">'+esc(t(S.me.ministry))+'</div>':'')+'</span>'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--faint);flex:0 0 auto"><path d="M9 6l6 6-6 6"/></svg></button>';
}
/* Leadership's OKRs for everyone to see (Uriah, Oct 2026) — read only: the
   cards have no slider, no − / +, no Edit or Delete. Your own campus first.
   Not for Campus Leadership (theirs are their own, above) nor admins (they
   have every department's, editable, below). */
function leadershipOkrsHtml_(q){
  var myDept = S.me.dept==='Base Director' ? 'Campus Leadership' : S.me.dept;
  if(myDept==='Campus Leadership' || S.me.isAdmin || !S.base) return '';
  var list = (S.base.okrs||[]).filter(function(o){ return o.dept==='Campus Leadership' && Number(o.quarter)===q; });
  var camps = CAMPUSES.map(function(c){ return c.id; }).sort(function(a,b){ return a===S.me.campus ? -1 : b===S.me.campus ? 1 : 0; });
  var h='<h3 id="leadOkrs">🧭 '+esc(t('Leadership OKRs'))+'</h3><p class="sub" style="margin:0 0 6px">'+esc(t('What the leadership team is working on this quarter — to see, not to change.'))+'</p>';
  if(!list.length) return h+'<p class="sub">'+esc(t('No leadership objectives set yet this quarter.'))+'</p>';
  var R = baseR(), shown=0;
  camps.forEach(function(c){
    var mine = list.filter(function(o){ return o.campus===c; });
    if(!mine.length) return;
    h+='<div class="mentorLabel" style="margin:10px 0 6px">'+esc(campusName(c))+'</div><div data-leadokrs="'+esc(c)+'">';
    mine.forEach(function(o, i){ h+=okrCardHtml(o, R, false, i+1); shown++; });
    h+='</div>';
  });
  return h;
}
/* The OKR tab of My Ministry — what used to be its own page. */
function okrTabHtml_(){
  var wk = thisWeek(), qNow = Math.min(4, Math.floor((wk-1)/13)+1);
  var h='<h3 style="margin-top:0">🎯 Q'+qNow+' '+esc(t('OKRs'))+'</h3>';
  h+='<p class="sub" style="margin:0 0 2px">'+esc(t(S.me.dept))+(S.me.ministry?' · '+esc(t(S.me.ministry)):'')+'</p>';
  h+=okrSectionHtml(S.me, true, true);
  h+=leadershipOkrsHtml_(qNow);

  /* Admin sees — and can edit, delete and add — every department's objectives
     on both campuses, collapsed by default so the page still opens on your
     own. The server lets an admin write any campus / department. */
  if(S.me.isAdmin && S.base){
    var qOkrs = (S.base.okrs||[]).filter(function(o){ return Number(o.quarter)===qNow; });
    h += '<h3 id="adminOkrs">🗂️ '+esc(t('Every department’s OKRs'))+'</h3>';
    var pick = S.okrAdminPick || { campus:S.me.campus, dept:'' };
    var pickDepts = Object.keys(getDepartments(pick.campus));
    if(pickDepts.indexOf(pick.dept)===-1) pick.dept = pickDepts[0] || '';
    S.okrAdminPick = pick;
    if(S.okrForm && S.okrAdmin){
      var aEditing = null;
      if(S.okrEditId) (S.base.okrs||[]).forEach(function(o){ if(o.id===S.okrEditId) aEditing=o; });
      h += okrFormHtml(aEditing, S.okrAdmin);
    } else {
      h += '<div class="okrAdminNew"><label class="pick"><span>'+esc(t('Campus'))+'</span><select id="okrAdmCampus">'+CAMPUSES.map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===pick.campus?' selected':'')+'>'+esc(c.short)+'</option>'; }).join('')+'</select></label>'+
        '<label class="pick"><span>'+esc(t('Department'))+'</span><select id="okrAdmDept">'+pickDepts.map(function(d){ return '<option value="'+esc(d)+'"'+(d===pick.dept?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+'</select></label>'+
        '<button class="btn ghost" id="okrAdmNewBtn" style="width:auto;margin:0">+ '+esc(t('New objective'))+'</button></div>';
    }
    if(!qOkrs.length){
      h += '<p class="sub">'+esc(t('No objectives set anywhere yet this quarter.'))+'</p>';
    } else {
      var groups = {};
      qOkrs.forEach(function(o){
        var key = o.campus+'|'+o.dept;
        (groups[key] = groups[key] || []).push(o);
      });
      var R = baseR();
      Object.keys(groups).sort().forEach(function(key){
        var parts = key.split('|'), campus = parts[0], dept = parts[1];
        var list = groups[key];
        var title = (MIN_EMOJI[dept]?MIN_EMOJI[dept]+' ':'')+esc(t(dept))+' · '+esc(campusName(campus));
        var summary = list.length===1 ? esc(t('1 objective')) : esc(gpT('{n} objectives',{n:list.length}));
        h += accRowHtml('adminOkrAcc', key, title, summary, function(){
          var b = '';
          list.forEach(function(o){ b += okrCardHtml(o, R, true); });
          return '<div data-okradmin="1">'+b+'</div>';
        });
      });
    }
  }
  return h;
}

