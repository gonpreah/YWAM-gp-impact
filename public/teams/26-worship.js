/* ==================== Worship: the week's rota (Nov 2026, Uriah) ====================
   "Every Monday morning they do worship, Monday night they do worship, and usually for Wednesday morning
   intercession there's a worship team, and then Thursday night there's a worship team. So they need to every
   week have those 4 worship things filled out."
   Youth Education › Worship on My Ministry: This week · Rota · Team · Songs · Dashboard (WS_TABS), then
   Numbers (Salvations only — the rest count themselves), Tasks, OKRs. ☰ → Operations → Worship rota is the
   published week, read-only, for everyone on the campus (S.view='worship'). My Home's card says when you are
   on (schedHomeHtml_ in 07-health-leave.js, from the boot's `worship`), and the bell the day before.
   Server: "Worship" in api.js (worshipBoard, worshipSaveWeek, worshipCopyWeek, worshipHeld,
   worshipSaveSettings, worshipSaveSong, worshipSaveTeam). */
var WS_TABS=['wsweek','wsrota','wsteam','wssongs','wsdash'];
var WS_DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
S.ws=null; S.wsWeek=null; S.wsLoading=null; S.wsErrKey=null; S.wsErr=''; S.wsBusy=false; S.wsPick=null; S.wsSongEdit=null; S.wsSetEdit=null; S.wsSetOpen=false; S.worship=null;
function isWorshipMinistry_(dept, min){ return dept==='Youth Education' && min==='Worship'; }
function wsTabs_(){ return [['wsweek',t('This week')],['wsrota',t('Rota')],['wsteam',t('Team')],['wssongs',t('Songs')],['wsdash',t('Dashboard')]]; }
function wsAddDays_(iso, n){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return isoDateOf_(d); }
function wsMonday_(iso){ var d=new Date((iso||todayStr())+'T00:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return isoDateOf_(d); }
function wsDayName_(day){ return t(WS_DAYS[(Number(day)||1)-1]); }
function wsShort_(iso){ var m=Number(iso.slice(5,7)), d=Number(iso.slice(8,10)); return t(MONTH_SHORT[m-1]||'')+' '+d; }
function wsRoleName_(rec, rid){ var r=((S.ws&&S.ws.roles)||[]).filter(function(x){ return x.id===rid; })[0]; return t((r && r.name) || ((rec&&rec.roleNames)||{})[rid] || rid); }
function wsWhen_(svc){ return [wsDayName_(svc.day)+(svc.date ? ' '+wsShort_(svc.date) : ''), svc.time, svc.place].filter(Boolean).join(' · '); }
function wsLoad_(week){
  var key=week||'';
  if(S.wsLoading===key) return;
  if(S.wsErr && S.wsErrKey===key) return;   // it failed: wait for Try again, not a redraw loop
  S.wsLoading=key; S.wsErr=''; S.wsErrKey=key;
  run('worshipBoard',[S.auth.user,S.auth.pin,week||''],function(d){
    if(S.wsLoading!==key) return; S.wsLoading=null;
    if(d && d.ok){ S.ws=d; S.wsWeek=d.week; } else S.wsErr=(d && d.err) || t('Could not load');
    render();
  }, function(e){ S.wsLoading=null; S.wsErr=(e && e.message) || t('Connection problem — try again.'); render(); });
}
/* the board for the week asked for, loading it when it isn't the one we have */
function wsHave_(week){
  if(S.ws && (!week || S.ws.week===week)) return true;
  wsLoad_(week); return false;
}
function wsWaitHtml_(){
  if(S.wsErr) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(S.wsErr==='not_authorized' ? t('The worship rota is for the worship team.') : t('Couldn’t load the worship rota.'))+'</p><button class="btn ghost" id="wsRetry">'+esc(t('Try again'))+'</button></div>';
  return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
}
function wsPersonName_(p){ return p.id ? (staffName_(p.id) || p.name) : p.name; }
function wsAwayOn_(id, date){ return !!(id && S.ws && S.ws.away && (S.ws.away[id]||[]).indexOf(date)>-1); }
function wsFilledSvc_(svc){
  if(!svc || svc.off) return false;
  var sl=svc.slots||{}, others=0; Object.keys(sl).forEach(function(k){ if(k!=='lead') others+=(sl[k]||[]).length; });
  return (sl.lead||[]).length>0 && others>0;
}
function wsFillLine_(rec){
  var on=(rec.services||[]).filter(function(x){ return !x.off; }), n=on.filter(wsFilledSvc_).length;
  return '<span class="wsFill'+(on.length && n===on.length?' full':'')+'" id="wsFill">'+esc(gpT('{n} of {total} services filled',{n:n, total:on.length}))+'</span>';
}
/* one service as everyone reads it */
function wsSvcReadHtml_(rec, svc, mine){
  var h='<div class="card wsSvc'+(svc.off?' off':'')+'" data-wssvc="'+esc(svc.id)+'"><div class="wsSvcHead"><b>🎵 '+esc(svc.name)+'</b>'+
    (svc.off ? '<span class="wsTag">'+esc(t('Not this week'))+'</span>' : wsFilledSvc_(svc) ? '<span class="wsTag ok">✓ '+esc(t('Filled'))+'</span>' : '<span class="wsTag warn">'+esc(t('Not filled yet'))+'</span>')+'</div>'+
    '<div class="rowSub">'+esc(wsWhen_(svc))+'</div>';
  if(svc.off) return h+'</div>';
  h+='<div class="wsRoles">'+(svc.roles||[]).map(function(rid){ var ppl=(svc.slots||{})[rid]||[];
    return '<div class="wsRoleRow"><span class="wsRoleName">'+esc(wsRoleName_(rec, rid))+'</span><span class="wsRolePeople">'+(ppl.length ? ppl.map(function(p){
      var me=mine && ((p.id && p.id===S.me.id) || (!p.id && String(p.name).toLowerCase()===String(S.me.name||'').toLowerCase()));
      return '<span class="wsPerson'+(me?' me':'')+'">'+esc(wsPersonName_(p))+'</span>'; }).join(' ') : '<span class="hint">—</span>')+'</span></div>'; }).join('')+'</div>';
  if((svc.setlist||[]).length) h+='<div class="wsSetHead">🎼 '+esc(t('Setlist'))+'</div><ol class="wsSetlist">'+svc.setlist.map(function(it){
    return '<li>'+(it.link ? '<a href="'+esc(it.link)+'" target="_blank" rel="noopener">'+esc(it.title)+'</a>' : esc(it.title))+(it.key ? ' <span class="wsKey">'+esc(it.key)+'</span>' : '')+(it.note ? ' <span class="hint">· '+esc(it.note)+'</span>' : '')+'</li>'; }).join('')+'</ol>';
  if(svc.notes) h+='<p class="wsNotes">'+esc(svc.notes)+'</p>';
  return h+'</div>';
}
/* after a service: did it happen, how many came, hours practising */
function wsHeldHtml_(svc){
  if(svc.off || !svc.date || svc.date>todayStr()) return '';
  var v=function(x){ return x==null ? '' : esc(String(x)); };
  return '<div class="wsHeld" data-wsheldbox="'+esc(svc.id)+'"><div class="wsHeldHead">'+esc(t('After the service'))+'</div>'+
    '<div class="campusSeg" style="max-width:none"><button class="campusBtn'+(svc.held===true?' on':'')+'" data-wsheld="'+esc(svc.id)+'|yes">'+esc(t('It happened'))+'</button>'+
    '<button class="campusBtn'+(svc.held===false?' on':'')+'" data-wsheld="'+esc(svc.id)+'|no">'+esc(t('It didn’t happen'))+'</button></div>'+
    '<div class="wsHeldGrid"><label>'+esc(t('How many came'))+'<input type="number" inputmode="numeric" min="0" data-wscount="'+esc(svc.id)+'" value="'+v(svc.count)+'"></label>'+
    '<label>'+esc(t('Hours practising (optional)'))+'<input type="number" inputmode="decimal" step="0.5" min="0" data-wspractice="'+esc(svc.id)+'" value="'+v(svc.practice)+'"></label></div>'+
    '<button class="btn ghost" data-wsheldsave="'+esc(svc.id)+'" style="margin-top:6px">'+esc(t('Save'))+'</button></div>';
}
function wsStatusHtml_(rec){
  return '<div class="wsStatus '+(rec.published?'pub':'draft')+'" id="wsStatus">'+(rec.published ? '📣 '+esc(t('Published — the campus can see it')) : '📝 '+esc(t('Draft — only the worship team sees it')))+' · '+wsFillLine_(rec)+'</div>';
}
/* This week: the current week as the team will live it, and after each service, how it went */
function wsThisWeekHtml_(){
  var W=S.ws, rec=W.rec;
  var h='<p class="sub">'+esc(gpT('The week of {date}',{date:teamDate_(W.week)}))+'</p>'+wsStatusHtml_(rec);
  if(W.isNew) h+='<p class="hint">'+esc(t('Nobody is on this week yet. Fill it in on the Rota tab.'))+'</p>';
  rec.services.forEach(function(svc){ h+=wsSvcReadHtml_(rec, svc, true).replace(/<\/div>$/, wsHeldHtml_(svc)+'</div>'); });
  return h+'<button class="btn ghost" data-wsgotab="wsrota">✏️ '+esc(t('Edit this week’s rota'))+'</button>'+
    '<p class="hint">'+esc(t('Services held, how many came and practice hours fill in Worship’s numbers by themselves.'))+'</p>';
}
/* who can be picked for a role: the team members who play it, the rest of the team, then everyone on the campus */
function wsPeopleFor_(rid, date){
  var team=(S.ws.team||[]), plays={}, inTeam={};
  team.forEach(function(m){ if(m.staffId){ inTeam[m.staffId]=1; if((m.roles||[]).indexOf(rid)>-1) plays[m.staffId]=1; } });
  var roleName=wsRoleName_(S.ws.rec, rid);
  return (S.roster||[]).filter(function(p){ return p.campus===S.me.campus; }).sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); }).map(function(p){
    var away=wsAwayOn_(p.id, date), g=plays[p.id] ? gpT('Plays {role}',{role:roleName}) : inTeam[p.id] ? t('Worship team') : t('Everyone else');
    return { id:p.id, name:p.name, sub:away ? '🏖 '+t('away that day') : '', first:!!(plays[p.id]||inTeam[p.id]), group:g, rank: plays[p.id] ? 0 : inTeam[p.id] ? 1 : 2 };
  }).sort(function(a,b){ return a.rank-b.rank; });
}
function wsSvcEditHtml_(rec, svc){
  var can=S.ws.canWrite;
  var h='<div class="card wsSvc edit'+(svc.off?' off':'')+'" data-wssvc="'+esc(svc.id)+'"><div class="wsSvcHead"><b>🎵 '+esc(svc.name)+'</b>'+
    (svc.off ? '' : wsFilledSvc_(svc) ? '<span class="wsTag ok">✓ '+esc(t('Filled'))+'</span>' : '<span class="wsTag warn">'+esc(t('Not filled yet'))+'</span>')+'</div>'+
    '<div class="rowSub">'+esc(wsWhen_(svc))+'</div>'+
    '<label class="wsOff"><input type="checkbox" data-wsoff="'+esc(svc.id)+'"'+(svc.off?' checked':'')+(can?'':' disabled')+'> '+esc(t('Not happening this week'))+'</label>';
  if(svc.off) return h+'</div>';
  (svc.roles||[]).forEach(function(rid){
    var ppl=(svc.slots||{})[rid]||[], role=(S.ws.roles||[]).filter(function(r){ return r.id===rid; })[0]||{}, key=svc.id+'|'+rid, open=S.wsPick===key;
    h+='<div class="wsRoleRow edit"><span class="wsRoleName">'+esc(wsRoleName_(rec, rid))+'</span><span class="wsRolePeople">'+ppl.map(function(p, i){
      var away=wsAwayOn_(p.id, svc.date);
      return '<span class="gtChip who'+(away?' wsAway':'')+'">'+esc(wsPersonName_(p))+(away ? ' 🏖' : '')+(can ? ' <button class="gptX" data-wsrm="'+esc(key)+'|'+i+'" aria-label="'+esc(t('Remove'))+'">×</button>' : '')+'</span>'; }).join('')+
      (can && (role.many || !ppl.length) ? '<button class="wsAddBtn" data-wspick="'+esc(key)+'">'+(open ? '−' : '+')+'</button>' : '')+'</span></div>';
    if(open && can){
      h+='<div class="wsPickBox">'+ppickHtml_({ key:'ws.'+svc.id+'.'+rid, people:wsPeopleFor_(rid, svc.date), chosen:[], placeholder:t('Type a name…'), onPick:function(id){ wsAddPerson_(svc.id, rid, { id:id }); } })+
        '<div class="numIn" style="margin-top:6px"><input type="text" data-wsname="'+esc(key)+'" placeholder="'+esc(t('Or type a guest’s name'))+'" maxlength="60"><button class="btn ghost" data-wsnameadd="'+esc(key)+'" style="margin:0;width:auto;padding:9px 14px">'+esc(t('Add'))+'</button></div></div>';
    }
  });
  var songs=(S.ws.songs||[]).slice().sort(function(a,b){ return String(a.title).localeCompare(String(b.title)); });
  h+='<div class="wsSetHead">🎼 '+esc(t('Setlist'))+'</div>';
  if((svc.setlist||[]).length) h+='<ol class="wsSetlist edit">'+svc.setlist.map(function(it, i){
    return '<li><span class="wsSetTitle">'+esc(it.title)+(it.key ? ' <span class="wsKey">'+esc(it.key)+'</span>' : '')+'</span>'+
      (can ? '<input type="text" class="wsSetNote" data-wssetnote="'+esc(svc.id)+'|'+i+'" value="'+esc(it.note||'')+'" placeholder="'+esc(t('Note for the team'))+'" maxlength="120">'+
      '<span class="wsSetBtns"><button data-wssetmv="'+esc(svc.id)+'|'+i+'|-1" aria-label="'+esc(t('Move up'))+'"'+(i?'':' disabled')+'>↑</button><button data-wssetmv="'+esc(svc.id)+'|'+i+'|1" aria-label="'+esc(t('Move down'))+'"'+(i<svc.setlist.length-1?'':' disabled')+'>↓</button>'+
      '<button class="lwDel" data-wssetrm="'+esc(svc.id)+'|'+i+'" aria-label="'+esc(t('Remove'))+'">×</button></span>' : (it.note ? ' <span class="hint">· '+esc(it.note)+'</span>' : ''))+'</li>'; }).join('')+'</ol>';
  if(can){
    var inSet={}; (svc.setlist||[]).forEach(function(it){ inSet[it.songId]=1; });
    h+=songs.length ? '<select data-wsaddsong="'+esc(svc.id)+'"><option value="">'+esc(t('＋ Add a song from the library'))+'</option>'+songs.filter(function(s){ return !inSet[s.id]; }).map(function(s){
        return '<option value="'+esc(s.id)+'">'+esc(s.title)+(s.key ? ' ('+esc(s.key)+')' : '')+'</option>'; }).join('')+'</select>'
      : '<p class="hint">'+esc(t('Add songs on the Songs tab, then pick them here.'))+'</p>';
    h+='<label class="f">'+esc(t('Notes for the team'))+'</label><textarea rows="2" data-wsnotes="'+esc(svc.id)+'" maxlength="600">'+esc(svc.notes||'')+'</textarea>';
  } else if(svc.notes) h+='<p class="wsNotes">'+esc(svc.notes)+'</p>';
  return h+wsHeldHtml_(svc)+'</div>';
}
function wsAheadHtml_(){
  return '<div class="wsAhead" id="wsAhead">'+(S.ws.ahead||[]).map(function(a){
    var cls=a.week===S.ws.week ? ' on' : '';
    return '<button class="wsAheadW'+cls+(a.published?' pub':'')+'" data-wsweek="'+esc(a.week)+'"><span class="wsAheadD">'+esc(wsShort_(a.week))+'</span>'+
      '<span class="wsAheadN">'+(a.made ? esc(a.filled+'/'+a.total) : '—')+'</span><span class="wsAheadS">'+esc(a.published ? t('Published') : a.made ? t('Draft') : t('Not started'))+'</span></button>'; }).join('')+'</div>';
}
/* the Rota: the weeks ahead, then one week to fill in */
function wsRotaHtml_(){
  var W=S.ws, rec=W.rec, thisW=W.thisWeek;
  var h=wsAheadHtml_();
  h+='<div class="weekNavRow"><button class="weekArrow" id="wsPrevWeek" aria-label="'+esc(t('Previous week'))+'">‹</button><div class="weekPill">'+esc(gpT('Week of {date}',{date:teamDate_(W.week)}))+(W.week===thisW?' · '+esc(t('this week')):'')+'</div>'+
    '<button class="weekArrow" id="wsNextWeek"'+(W.week>=wsAddDays_(thisW, 56)?' disabled':'')+' aria-label="'+esc(t('Next week'))+'">›</button></div>';
  h+=wsStatusHtml_(rec);
  if(!W.canWrite) h+='<p class="hint">'+esc(t('That week is too far ahead — plan up to eight weeks at a time.'))+'</p>';
  if(W.isNew && W.prevWeek && W.canWrite) h+='<button class="btn ghost" id="wsCopy">📋 '+esc(gpT('Copy the week of {date}',{date:wsShort_(W.prevWeek)}))+'</button>';
  rec.services.forEach(function(svc){ h+=wsSvcEditHtml_(rec, svc); });
  if(W.canWrite) h+='<div class="btnRow">'+(rec.published ? '<button class="btn ghost" id="wsUnpublish">'+esc(t('Take it down'))+'</button>' : '<button class="btn" id="wsPublish">📣 '+esc(t('Publish this week'))+'</button>')+'</div>'+
    '<p class="hint">'+esc(t('Every change is saved as you go. Until it is published only the worship team sees the week.'))+'</p>';
  h+=wsSettingsHtml_();
  return h;
}
/* the services and roles new weeks start from */
function wsSettingsHtml_(){
  var open=S.wsSetOpen;
  var h='<div class="accCard"><button class="accHead" id="wsSetToggle"><span><div class="accTitle">⚙️ '+esc(t('Services and roles'))+'</div><div class="accSummary">'+esc(t('The services each week starts with, and the roles on them'))+'</div></span><span class="accChevron">'+(open?'▴':'▾')+'</span></button>';
  if(!open) return h+'</div>';
  var E=S.wsSetEdit || (S.wsSetEdit=JSON.parse(JSON.stringify(S.ws.settings)));
  h+='<div class="accBody"><h3>🎵 '+esc(t('Services'))+'</h3>'+E.services.map(function(x, i){
    return '<div class="card wsSetSvc"><input type="text" data-wsset="s|'+i+'|name" value="'+esc(x.name)+'" aria-label="'+esc(t('Name'))+'" maxlength="60">'+
      '<div class="wsSetRow"><select data-wsset="s|'+i+'|day" aria-label="'+esc(t('Day'))+'">'+WS_DAYS.map(function(d, k){ return '<option value="'+(k+1)+'"'+(Number(x.day)===k+1?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+'</select>'+
      '<input type="time" data-wsset="s|'+i+'|time" value="'+esc(x.time||'')+'" aria-label="'+esc(t('Time'))+'"><input type="text" data-wsset="s|'+i+'|place" value="'+esc(x.place||'')+'" placeholder="'+esc(t('Where'))+'" maxlength="60"></div>'+
      '<div class="chips">'+E.roles.map(function(r){ var on=(x.roles||[]).indexOf(r.id)>-1;
        return '<button class="chip'+(on?' blue':'')+'" data-wssetrole="'+i+'|'+esc(r.id)+'">'+esc(t(r.name))+'</button>'; }).join('')+'</div>'+
      '<button class="linkbtn inline" data-wssetsvcrm="'+i+'">'+esc(t('Remove this service'))+'</button></div>'; }).join('')+
    (E.services.length<8 ? '<button class="linkbtn inline" id="wsSetSvcAdd">+ '+esc(t('Add a service'))+'</button>' : '');
  h+='<h3>🎸 '+esc(t('Roles'))+'</h3><div class="card">'+E.roles.map(function(r, i){
    return '<div class="wsSetRow"><input type="text" data-wsset="r|'+i+'|name" value="'+esc(r.name)+'" aria-label="'+esc(t('Name'))+'" maxlength="40">'+
      '<label class="wsMany"><input type="checkbox" data-wsset="r|'+i+'|many"'+(r.many?' checked':'')+'> '+esc(t('several people'))+'</label>'+
      (r.id==='lead' ? '' : '<button class="lwDel" data-wssetrolerm="'+i+'" aria-label="'+esc(t('Remove'))+'">×</button>')+'</div>'; }).join('')+
    (E.roles.length<16 ? '<button class="linkbtn inline" id="wsSetRoleAdd">+ '+esc(t('Add a role'))+'</button>' : '')+'</div>';
  return h+'<p class="hint">'+esc(t('Changes apply to weeks not started yet. A week already made keeps its own services.'))+'</p><button class="btn" id="wsSetSave">'+esc(t('Save'))+'</button></div></div>';
}
function wsTeamHtml_(){
  var W=S.ws, team=(W.team||[]).slice().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  var h='<p class="sub">'+esc(t('The ministry’s musicians and the roles each can play. The ones who play a role come first when you fill it.'))+'</p>';
  h+='<div class="card" id="wsTeam">'+(team.length ? team.map(function(m){
    return '<div class="wsTeamRow"><div class="wsTeamHead"><b>'+esc(m.staffId ? (staffName_(m.staffId)||m.name) : m.name)+'</b>'+
      '<label class="wsTrain"><input type="checkbox" data-wstrain="'+esc(m.id)+'"'+(m.training?' checked':'')+'> '+esc(t('in training'))+'</label>'+
      '<button class="lwDel" data-wsteamrm="'+esc(m.id)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'+
      '<div class="chips">'+(W.roles||[]).map(function(r){ var on=(m.roles||[]).indexOf(r.id)>-1;
        return '<button class="chip'+(on?' blue':'')+'" data-wsteamrole="'+esc(m.id)+'|'+esc(r.id)+'">'+esc(t(r.name))+'</button>'; }).join('')+'</div></div>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('Nobody on the team yet.'))+'</p>')+'</div>';
  var have={}; (W.team||[]).forEach(function(m){ if(m.staffId) have[m.staffId]=1; });
  h+='<h3>＋ '+esc(t('Add someone'))+'</h3><div class="card">'+ppickHtml_({ key:'wsteam', placeholder:t('Type a name…'), chosen:[],
      people:(S.roster||[]).filter(function(p){ return p.campus===S.me.campus && !have[p.id]; }).sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); })
        .map(function(p){ var f=(p.dept==='Youth Education' && p.ministry==='Worship') || (p.ministries||[]).indexOf('Youth Education|Worship')>-1;
          return { id:p.id, name:p.name, sub:t(p.ministry||p.dept||''), first:f, group:f ? t('Worship') : t('Everyone else') }; }),
      onPick:function(id){ wsCall_('worshipSaveTeam',[{ staffId:id, roles:[], training:false }]); } })+
    '<div class="numIn" style="margin-top:6px"><input type="text" id="wsTeamName" placeholder="'+esc(t('Or type a name'))+'" maxlength="60"><button class="btn ghost" id="wsTeamAdd" style="margin:0;width:auto;padding:9px 14px">'+esc(t('Add'))+'</button></div></div>';
  var nTrain=(W.team||[]).filter(function(m){ return m.training; }).length;
  return h+'<p class="hint">'+esc(gpT('{n} in training — Musicians in Training counts itself from this list.',{n:nTrain}))+'</p>';
}
function wsSongStatus_(s){
  var o=s.own; if(!o) return '';
  return o.uploaded ? '📤 '+t('Uploaded') : o.recorded ? '🎙 '+t('Recorded') : o.written ? '✍️ '+t('Written') : '✍️ '+t('Our own song');
}
function wsSongsHtml_(){
  var W=S.ws, songs=(W.songs||[]).slice().sort(function(a,b){ return String(a.title).localeCompare(String(b.title)); });
  if(S.wsSongEdit) return wsSongFormHtml_();
  var h='<div class="btnRow"><button class="btn" id="wsSongNew">＋ '+esc(t('Add a song'))+'</button></div>';
  if(songs.length>6) h+='<label class="gtFind">🔎 <input type="search" id="wsSongFind" placeholder="'+esc(t('Find a song'))+'" autocomplete="off"></label>';
  h+='<div class="card" id="wsSongs">'+(songs.length ? songs.map(function(s){
    return '<button class="wsSongRow" data-wssong="'+esc(s.id)+'" data-wsq="'+esc((s.title+' '+(s.key||'')).toLowerCase())+'"><span><b>'+esc(s.title)+'</b>'+(s.key ? ' <span class="wsKey">'+esc(s.key)+'</span>' : '')+
      (s.lang ? ' <span class="hint">· '+esc(s.lang==='km' ? t('Khmer') : t('English'))+'</span>' : '')+(s.own ? ' <span class="wsTag">'+esc(wsSongStatus_(s))+'</span>' : '')+'</span>'+(s.link ? '<span>🔗</span>' : '')+'</button>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('No songs yet. Add the ones the team plays.'))+'</p>')+'</div>';
  return h+'<p class="hint">'+esc(t('Songs of our own: when one is written, recorded or uploaded, Worship’s song numbers count it in that week.'))+'</p>';
}
function wsSongFormHtml_(){
  var E=S.wsSongEdit, o=E.own||null;
  var h='<button class="linkbtn" id="wsSongBack" style="text-align:left;padding-left:0">← '+esc(t('Songs'))+'</button><div class="card" id="wsSongForm">'+
    '<label class="f">'+esc(t('Title'))+'</label><input type="text" id="wsSgTitle" value="'+esc(E.title||'')+'" maxlength="80">'+
    '<div class="wsSetRow"><label>'+esc(t('Key'))+'<input type="text" id="wsSgKey" value="'+esc(E.key||'')+'" maxlength="12" placeholder="G"></label>'+
    '<label>'+esc(t('Language'))+'<select id="wsSgLang"><option value="">—</option><option value="km"'+(E.lang==='km'?' selected':'')+'>'+esc(t('Khmer'))+'</option><option value="en"'+(E.lang==='en'?' selected':'')+'>'+esc(t('English'))+'</option></select></label></div>'+
    '<label class="f">'+esc(t('Link to chords, lyrics or a video'))+'</label><input type="url" id="wsSgLink" value="'+esc(E.link||'')+'" placeholder="https://" maxlength="400">'+
    '<label class="f">'+esc(t('Notes'))+'</label><textarea id="wsSgNotes" rows="2" maxlength="500">'+esc(E.notes||'')+'</textarea>'+
    '<label class="wsOff"><input type="checkbox" id="wsSgOwn"'+(o?' checked':'')+'> '+esc(t('One of our own songs'))+'</label>';
  if(o) h+='<div class="wsHeldGrid three"><label>'+esc(t('Written'))+'<input type="date" id="wsSgWritten" value="'+esc(o.written||'')+'"></label>'+
    '<label>'+esc(t('Recorded'))+'<input type="date" id="wsSgRecorded" value="'+esc(o.recorded||'')+'"></label>'+
    '<label>'+esc(t('Uploaded'))+'<input type="date" id="wsSgUploaded" value="'+esc(o.uploaded||'')+'"></label></div>';
  h+='<div class="btnRow"><button class="btn" id="wsSongSave">'+esc(t('Save'))+'</button>'+(E.id ? '<button class="btn ghost" id="wsSongRm">'+esc(t('Remove'))+'</button>' : '')+'</div>';
  return h+'</div>';
}
function wsDashHtml_(){
  var D=S.ws.dash||{};
  var h='<p class="sub">'+esc(gpT('{year} so far',{year:D.year||''}))+'</p>';
  h+='<div class="mmGrid">'+[[t('Services held'), D.held||0],[t('Average attendance'), D.avg==null ? '—' : D.avg],[t('Practice hours'), D.practice||0],
    [t('Weeks fully filled'), (D.fullWeeks||0)+' / '+(D.weeks||0)]].map(function(x){ return '<div class="mmTile"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  h+='<h3>🙌 '+esc(t('Who served'))+'</h3><div class="card" id="wsServed">'+((D.served||[]).length ? D.served.map(function(p){
    return '<div class="cafeLine"><span>'+esc(p.id ? (staffName_(p.id)||p.name) : p.name)+'</span><span>'+esc(gpT('{n} times',{n:p.n}))+'</span></div>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('Nobody yet this year.'))+'</p>')+'</div>';
  h+='<h3>🎼 '+esc(t('Songs used most'))+'</h3><div class="card" id="wsTopSongs">'+((D.songs||[]).length ? D.songs.map(function(s){
    return '<div class="cafeLine"><span>'+esc(s.title)+'</span><span>'+s.n+'</span></div>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('No setlists yet this year.'))+'</p>')+'</div>';
  return h;
}
/* the pane under My Ministry's tabs */
function wsPaneHtml_(cur){
  var want = cur==='wsweek' ? (S.ws && S.ws.thisWeek) || '' : cur==='wsrota' ? (S.wsWeek || '') : '';
  if(!wsHave_(want)) return wsWaitHtml_();
  if(!S.ws.canEdit) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('The worship rota is for the worship team.'))+'</p></div>';
  if(cur==='wsrota') return wsRotaHtml_();
  if(cur==='wsteam') return wsTeamHtml_();
  if(cur==='wssongs') return wsSongsHtml_();
  if(cur==='wsdash') return wsDashHtml_();
  return wsThisWeekHtml_();
}
/* ☰ → Worship rota: the published week, for everyone on the campus */
function wsOpen_(week){ S.view='worship'; S.wsWeek=week||null; S.ws=null; S.wsErr=''; render(); window.scrollTo(0,0); }
function wsPageHtml_(){
  var h='<button class="linkbtn" id="wsHomeBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button><h2>🎵 '+esc(t('Worship rota'))+'</h2>';
  if(!wsHave_(S.wsWeek||'')) return h+wsWaitHtml_();
  var W=S.ws, rec=W.rec;
  h+='<div class="weekNavRow"><button class="weekArrow" id="wsPrevWeek" aria-label="'+esc(t('Previous week'))+'">‹</button><div class="weekPill">'+esc(gpT('Week of {date}',{date:teamDate_(W.week)}))+(W.week===W.thisWeek?' · '+esc(t('this week')):'')+'</div>'+
    '<button class="weekArrow" id="wsNextWeek"'+(W.week>=wsAddDays_(W.thisWeek, 56)?' disabled':'')+' aria-label="'+esc(t('Next week'))+'">›</button></div>';
  if(!rec || (W.canEdit && !rec.published)) h+='<div class="card" id="wsNotYet"><p class="sub" style="margin:0">'+esc(t('This week’s worship rota isn’t out yet.'))+'</p></div>';
  else rec.services.forEach(function(svc){ h+=wsSvcReadHtml_(rec, svc, true); });
  if(W.canEdit) h+='<button class="btn ghost" id="wsGoEdit">✏️ '+esc(t('Open on My Ministry'))+'</button>';
  return h;
}
/* ---- My Home and the bell ---- */
function wsHomeHtml_(){
  var mine=(S.worship && S.worship.mine)||[], today=todayStr(), wk=wsAddDays_(today, 7);
  mine=mine.filter(function(x){ return x.date>=today && x.date<=wk; });
  if(!mine.length) return '';
  var x=mine[0], roles=x.roles.map(function(r){ return t(r); }).join(', ');
  var text = mine.length===1 ? gpT('You’re on {role} — {service}',{role:roles, service:x.name}) : gpT('You’re on {n} worship services this week',{n:mine.length});
  return '<button class="heroSchedMine" data-goworship="'+esc(x.week)+'" id="wsMine">🎵 '+esc(text)+' ›</button>';
}
function wsNotifItems_(){
  var out=[], today=todayStr(), tom=wsAddDays_(today, 1);
  ((S.worship && S.worship.mine)||[]).forEach(function(x){
    if(x.date!==today && x.date!==tom) return;
    var roles=x.roles.map(function(r){ return t(r); }).join(', ');
    out.push({ when:today, text: x.date===today ? gpT('Today: you’re on {role} — {service}',{role:roles, service:x.name}) : gpT('Tomorrow: you’re on {role} — {service}',{role:roles, service:x.name}),
      actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-goworship="'+esc(x.week)+'">'+esc(t('Open'))+'</button>' });
  });
  return out;
}
/* ---- saving ---- */
function wsCall_(fn, args, then){
  if(S.wsBusy) return; S.wsBusy=true;
  run(fn,[S.auth.user,S.auth.pin].concat(args).concat(fn==='worshipSaveWeek'||fn==='worshipCopyWeek'||fn==='worshipHeld' ? [] : [S.ws ? S.ws.week : '']),function(d){
    S.wsBusy=false;
    if(d && d.ok){ S.ws=d; S.wsWeek=d.week; if(then) then(d); }
    else showMsg(d && d.err==='published' ? t('That week is already published.') : d && d.err==='already' ? t('They are on the team already.') : d && d.err==='no_title' ? t('Give the song a title.')
      : d && d.err==='not_yet' ? t('That service hasn’t happened yet.') : d && d.err==='bad_number' ? t('Check the numbers.') : d && d.err==='no_services' ? t('Keep at least one service.') : t('Could not save — try again.'));
    render();
  }, function(){ S.wsBusy=false; showMsg(t('No connection — try again when you are online.')); render(); });
}
/* the week as the server wants it back: services with their people and setlists */
function wsWeekBody_(rec){
  return { notes:rec.notes||'', services:rec.services.map(function(x){ return { id:x.id, name:x.name, day:x.day, time:x.time, place:x.place, roles:x.roles, off:!!x.off,
    slots:x.slots||{}, setlist:(x.setlist||[]).map(function(it){ return { songId:it.songId, note:it.note||'' }; }), notes:x.notes||'' }; }) };
}
function wsSaveWeek_(action){ wsCall_('worshipSaveWeek',[S.ws.week, wsWeekBody_(S.ws.rec), action||'save']); }
function wsSvc_(id){ return S.ws.rec.services.filter(function(x){ return x.id===id; })[0]; }
function wsAddPerson_(svcId, rid, p){
  var svc=wsSvc_(svcId); if(!svc) return;
  var name=p.id ? staffName_(p.id) : p.name;
  var dup=Object.keys(svc.slots||{}).some(function(k){ return (svc.slots[k]||[]).some(function(x){ return p.id ? x.id===p.id : (!x.id && String(x.name).toLowerCase()===String(name).toLowerCase()); }); });
  if(dup && !gpAsk_(gpT('{name} is already on {service}. Add them here too?',{name:name, service:svc.name}))) return;
  if(p.id && wsAwayOn_(p.id, svc.date) && !gpAsk_(gpT('{name} is away that day. Add them anyway?',{name:name}))) return;
  svc.slots=svc.slots||{}; (svc.slots[rid]=svc.slots[rid]||[]).push(p.id ? { id:p.id, name:name } : { name:name });
  var role=(S.ws.roles||[]).filter(function(r){ return r.id===rid; })[0]||{};
  if(!role.many) S.wsPick=null;
  wsSaveWeek_('save');
}
function bindWorship_(){
  document.querySelectorAll('[data-goworship]').forEach(function(b){ if(b.closest('#notifRoot')) return; b.onclick=function(){ gpTap(); wsOpen_(b.getAttribute('data-goworship')||null); }; });
  if(!(S.view==='worship' || (S.view==='ministry' && isWorshipMinistry_(S.mmBrowseDept, S.mmBrowseMinistry)))) return;
  var rt=document.getElementById('wsRetry'); if(rt) rt.onclick=function(){ S.wsErr=''; S.wsErrKey=''; render(); };
  var hb=document.getElementById('wsHomeBack'); if(hb) hb.onclick=function(){ S.view='week'; render(); };
  var ge=document.getElementById('wsGoEdit'); if(ge) ge.onclick=function(){ S.view='ministry'; S.mmBrowseDept='Youth Education'; S.mmBrowseMinistry='Worship'; S.mmTab='wsrota'; S.mmTabTouched=true; render(); };
  document.querySelectorAll('[data-wsgotab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.mmTab=b.getAttribute('data-wsgotab'); S.mmTabTouched=true; S.wsWeek=S.ws && S.ws.week; render(); }; });
  var go=function(n){ var w=wsAddDays_((S.ws && S.ws.week) || wsMonday_(), 7*n); if(S.ws && w>wsAddDays_(S.ws.thisWeek, 56)) return; S.wsWeek=w; S.wsPick=null; render(); };
  var pw=document.getElementById('wsPrevWeek'), nw=document.getElementById('wsNextWeek');
  if(pw) pw.onclick=function(){ gpTap(); go(-1); }; if(nw) nw.onclick=function(){ gpTap(); go(1); };
  document.querySelectorAll('[data-wsweek]').forEach(function(b){ b.onclick=function(){ gpTap(); S.wsWeek=b.getAttribute('data-wsweek'); S.wsPick=null; render(); }; });
  if(!S.ws || !S.ws.canEdit) return;
  var cp=document.getElementById('wsCopy'); if(cp) cp.onclick=function(){ gpTap(); wsCall_('worshipCopyWeek',[S.ws.week]); };
  var pb=document.getElementById('wsPublish'); if(pb) pb.onclick=function(){ gpTap(); wsSaveWeek_('publish'); };
  var ub=document.getElementById('wsUnpublish'); if(ub) ub.onclick=function(){ if(!gpAsk_(t('Take this week down? The campus won’t see it until it is published again.'))) return; wsSaveWeek_('unpublish'); };
  document.querySelectorAll('[data-wspick]').forEach(function(b){ b.onclick=function(){ gpTap(); var k=b.getAttribute('data-wspick'); S.wsPick=S.wsPick===k ? null : k; render(); }; });
  document.querySelectorAll('[data-wsrm]').forEach(function(b){ b.onclick=function(){ gpTap(); var v=b.getAttribute('data-wsrm').split('|'), svc=wsSvc_(v[0]); if(!svc) return;
    (svc.slots[v[1]]||[]).splice(Number(v[2]),1); wsSaveWeek_('save'); }; });
  document.querySelectorAll('[data-wsnameadd]').forEach(function(b){ b.onclick=function(){ var k=b.getAttribute('data-wsnameadd'), inp=document.querySelector('[data-wsname="'+k+'"]');
    var name=String(inp && inp.value || '').trim(); if(!name){ showMsg(t('Type a name.')); return; } var v=k.split('|'); wsAddPerson_(v[0], v[1], { name:name }); }; });
  document.querySelectorAll('[data-wsname]').forEach(function(inp){ inp.onkeydown=function(e){ if(e.key==='Enter'){ var b=document.querySelector('[data-wsnameadd="'+inp.getAttribute('data-wsname')+'"]'); if(b) b.click(); } }; });
  document.querySelectorAll('[data-wsoff]').forEach(function(c){ c.onchange=function(){ var svc=wsSvc_(c.getAttribute('data-wsoff')); if(!svc) return; svc.off=c.checked; wsSaveWeek_('save'); }; });
  document.querySelectorAll('[data-wsnotes]').forEach(function(ta){ ta.onchange=function(){ var svc=wsSvc_(ta.getAttribute('data-wsnotes')); if(!svc) return; svc.notes=ta.value; wsSaveWeek_('save'); }; });
  document.querySelectorAll('[data-wsaddsong]').forEach(function(sel){ sel.onchange=function(){ var svc=wsSvc_(sel.getAttribute('data-wsaddsong')), id=sel.value; if(!svc || !id) return;
    var s=(S.ws.songs||[]).filter(function(x){ return x.id===id; })[0]||{}; (svc.setlist=svc.setlist||[]).push({ songId:id, note:'', title:s.title, key:s.key }); wsSaveWeek_('save'); }; });
  document.querySelectorAll('[data-wssetrm]').forEach(function(b){ b.onclick=function(){ var v=b.getAttribute('data-wssetrm').split('|'), svc=wsSvc_(v[0]); if(!svc) return; svc.setlist.splice(Number(v[1]),1); wsSaveWeek_('save'); }; });
  document.querySelectorAll('[data-wssetmv]').forEach(function(b){ b.onclick=function(){ var v=b.getAttribute('data-wssetmv').split('|'), svc=wsSvc_(v[0]); if(!svc) return;
    var i=Number(v[1]), j=i+Number(v[2]); if(j<0 || j>=svc.setlist.length) return; var x=svc.setlist[i]; svc.setlist[i]=svc.setlist[j]; svc.setlist[j]=x; wsSaveWeek_('save'); }; });
  document.querySelectorAll('[data-wssetnote]').forEach(function(inp){ inp.onchange=function(){ var v=inp.getAttribute('data-wssetnote').split('|'), svc=wsSvc_(v[0]); if(!svc || !svc.setlist[Number(v[1])]) return;
    svc.setlist[Number(v[1])].note=inp.value; wsSaveWeek_('save'); }; });
  /* after a service */
  document.querySelectorAll('[data-wsheld]').forEach(function(b){ b.onclick=function(){ gpTap(); var v=b.getAttribute('data-wsheld').split('|'), svc=wsSvc_(v[0]); if(!svc) return;
    var box=b.closest('[data-wsheldbox]'), c=box && box.querySelector('[data-wscount]'), p=box && box.querySelector('[data-wspractice]');
    wsCall_('worshipHeld',[S.ws.week, svc.id, { held: v[1]==='yes', count: c ? c.value : '', practice: p ? p.value : '' }]); }; });
  document.querySelectorAll('[data-wsheldsave]').forEach(function(b){ b.onclick=function(){ var svc=wsSvc_(b.getAttribute('data-wsheldsave')); if(!svc) return;
    var box=b.closest('[data-wsheldbox]'), c=box.querySelector('[data-wscount]'), p=box.querySelector('[data-wspractice]');
    var held=svc.held===false ? false : (svc.held===true || (c && c.value!=='')) ? true : null;
    wsCall_('worshipHeld',[S.ws.week, svc.id, { held: held, count: c.value, practice: p.value }]); }; });
  /* the services and roles */
  var st=document.getElementById('wsSetToggle'); if(st) st.onclick=function(){ gpTap(); S.wsSetOpen=!S.wsSetOpen; S.wsSetEdit=null; render(); };
  var E=S.wsSetEdit;
  document.querySelectorAll('[data-wsset]').forEach(function(inp){ var v=inp.getAttribute('data-wsset').split('|'), list=v[0]==='s' ? E.services : E.roles, row=list[Number(v[1])];
    inp.onchange=inp.oninput=function(){ if(!row) return; row[v[2]] = inp.type==='checkbox' ? inp.checked : v[2]==='day' ? Number(inp.value) : inp.value; }; });
  document.querySelectorAll('[data-wssetrole]').forEach(function(b){ b.onclick=function(){ var v=b.getAttribute('data-wssetrole').split('|'), x=E.services[Number(v[0])]; if(!x) return;
    x.roles=x.roles||[]; var i=x.roles.indexOf(v[1]); if(i>-1) x.roles.splice(i,1); else x.roles.push(v[1]); render(); }; });
  document.querySelectorAll('[data-wssetsvcrm]').forEach(function(b){ b.onclick=function(){ if(!gpAsk_(t('Remove this service? Weeks already made keep it.'))) return; E.services.splice(Number(b.getAttribute('data-wssetsvcrm')),1); render(); }; });
  document.querySelectorAll('[data-wssetrolerm]').forEach(function(b){ b.onclick=function(){ var r=E.roles.splice(Number(b.getAttribute('data-wssetrolerm')),1)[0];
    if(r) E.services.forEach(function(x){ x.roles=(x.roles||[]).filter(function(id){ return id!==r.id; }); }); render(); }; });
  var sa=document.getElementById('wsSetSvcAdd'); if(sa) sa.onclick=function(){ E.services.push({ id:'', name:t('New service'), day:5, time:'19:00', place:'', roles:E.roles.map(function(r){ return r.id; }) }); render(); };
  var ra=document.getElementById('wsSetRoleAdd'); if(ra) ra.onclick=function(){ E.roles.push({ id:'', name:t('New role'), many:false }); render(); };
  var ss=document.getElementById('wsSetSave'); if(ss) ss.onclick=function(){ gpTap(); wsCall_('worshipSaveSettings',[E], function(){ S.wsSetEdit=null; S.wsSetOpen=false; showMsg(t('Saved.')); }); };
  /* the team */
  var ta=document.getElementById('wsTeamAdd'); if(ta) ta.onclick=function(){ var n=document.getElementById('wsTeamName'), name=String(n && n.value || '').trim();
    if(!name){ showMsg(t('Type a name.')); return; } wsCall_('worshipSaveTeam',[{ name:name, roles:[], training:false }]); };
  var teamOf=function(id){ return (S.ws.team||[]).filter(function(m){ return m.id===id; })[0]; };
  document.querySelectorAll('[data-wsteamrole]').forEach(function(b){ b.onclick=function(){ gpTap(); var v=b.getAttribute('data-wsteamrole').split('|'), m=teamOf(v[0]); if(!m) return;
    var roles=(m.roles||[]).slice(), i=roles.indexOf(v[1]); if(i>-1) roles.splice(i,1); else roles.push(v[1]); wsCall_('worshipSaveTeam',[Object.assign({}, m, { roles:roles })]); }; });
  document.querySelectorAll('[data-wstrain]').forEach(function(c){ c.onchange=function(){ var m=teamOf(c.getAttribute('data-wstrain')); if(!m) return; wsCall_('worshipSaveTeam',[Object.assign({}, m, { training:c.checked })]); }; });
  document.querySelectorAll('[data-wsteamrm]').forEach(function(b){ b.onclick=function(){ var m=teamOf(b.getAttribute('data-wsteamrm')); if(!m) return;
    if(!gpAsk_(gpT('Take {name} off the worship team?',{name:m.name}))) return; wsCall_('worshipSaveTeam',[{ id:m.id, remove:true }]); }; });
  /* the songs */
  var sn=document.getElementById('wsSongNew'); if(sn) sn.onclick=function(){ gpTap(); S.wsSongEdit={ title:'', key:'', link:'', lang:'', notes:'', own:null }; render(); };
  var sf=document.getElementById('wsSongFind'); if(sf) sf.oninput=function(){ var q=sf.value.trim().toLowerCase(); document.querySelectorAll('[data-wsq]').forEach(function(r){ r.hidden=!!q && r.getAttribute('data-wsq').indexOf(q)===-1; }); };
  document.querySelectorAll('[data-wssong]').forEach(function(b){ b.onclick=function(){ gpTap(); var s=(S.ws.songs||[]).filter(function(x){ return x.id===b.getAttribute('data-wssong'); })[0]; if(!s) return;
    S.wsSongEdit=JSON.parse(JSON.stringify(s)); render(); }; });
  var sb=document.getElementById('wsSongBack'); if(sb) sb.onclick=function(){ S.wsSongEdit=null; render(); };
  var keep=function(){ var E2=S.wsSongEdit; if(!E2) return; var g=function(id){ var el=document.getElementById(id); return el ? el.value : ''; };
    E2.title=g('wsSgTitle'); E2.key=g('wsSgKey'); E2.link=g('wsSgLink'); E2.lang=g('wsSgLang'); E2.notes=g('wsSgNotes');
    if(E2.own) E2.own={ written:g('wsSgWritten'), recorded:g('wsSgRecorded'), uploaded:g('wsSgUploaded') }; };
  var so=document.getElementById('wsSgOwn'); if(so) so.onchange=function(){ keep(); S.wsSongEdit.own=so.checked ? (S.wsSongEdit.own || { written:'', recorded:'', uploaded:'' }) : null; render(); };
  var sv=document.getElementById('wsSongSave'); if(sv) sv.onclick=function(){ keep(); var E2=S.wsSongEdit; if(!String(E2.title).trim()){ showMsg(t('Give the song a title.')); return; }
    wsCall_('worshipSaveSong',[E2], function(){ S.wsSongEdit=null; }); };
  var sr=document.getElementById('wsSongRm'); if(sr) sr.onclick=function(){ if(!gpAsk_(t('Remove this song from the library?'))) return; wsCall_('worshipSaveSong',[{ id:S.wsSongEdit.id, remove:true }], function(){ S.wsSongEdit=null; }); };
}
