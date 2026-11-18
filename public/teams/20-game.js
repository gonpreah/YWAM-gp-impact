/* ==================== The week's board (Nov 2026, Uriah) ====================
   "Gamify the app … see how active people are … a daily driver rather than a weekly check-in thing."
   Points for the week and a day streak, worked out by the server from what is already saved (api.js "The week's
   board") and carried on the boot as `game` — nothing extra is asked for on open. Two places:
   - My Home: one line under Today (gameHomeHtml_, #gameHome) — my streak, my points, my place; tap → the board.
   - Team → 🏆 This week (gameTeamHtml_, S.teamMode 'game'): the top three, everyone, the ministries, how points
     work, and the switch to step off the board.
   Others see points, a streak and which days someone was active — never what they did. */

function gameOn_(){ return !!(S.me && !S.guest && !S.student && !S.board && !S.stuPreview); }
function gameMine_(){ return (S.game && S.game.ok && S.game.me) || null; }
function gamePerson_(id){ return (S.roster||[]).filter(function(p){ return p.id===id; })[0] || { id:id, name:'—' }; }

/* the seven days, Monday first: active, not, today still open, days to come */
function gameDotsHtml_(week, today, from){
  var h='<span class="gameDots" aria-hidden="true">';
  for(var i=0;i<7;i++){
    var c=week.charAt(i), isToday=false;
    if(today && from){ var d=new Date(from+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+i); isToday=d.toISOString().slice(0,10)===today; }
    h+='<i class="'+(c==='1'?'on':c==='-'?'later':'off')+(isToday?' now':'')+'"></i>';
  }
  return h+'</span>';
}
function gameDaysActive_(week){ return (String(week||'').match(/1/g)||[]).length; }

/* ---------- My Home ---------- */
function gameHomeHtml_(){
  if(!gameOn_()) return '';
  var G=S.game, me=gameMine_();
  if(!G || !G.ok || !me) return '';
  var bits=[];
  bits.push('<span class="gameBit"><b>🔥 '+me.streak+'</b> '+esc(me.streak===1 ? t('day in a row') : t('days in a row'))+'</span>');
  bits.push('<span class="gameBit"><b>⭐ '+me.pts+'</b> '+esc(t('points this week'))+'</span>');
  if(me.rank) bits.push('<span class="gameBit"><b>#'+me.rank+'</b> '+esc(gpT('of {n}',{n:G.people.length}))+'</span>');
  return '<button class="gameHome" id="gameHome" data-gogame="1" aria-label="'+esc(t('This week’s board'))+'">'+
    '<span class="gameBits">'+bits.join('')+'</span>'+gameDotsHtml_(me.week, G.today, G.from)+'<span class="gameGo">›</span></button>';
}

/* ---------- Team → This week ---------- */
function gameLoad_(campus, force){
  if(S.gameLoading) return;
  if(!force && S.game && S.game.ok && S.game.campus===campus) return;
  S.gameLoading=true; S.gameErr='';
  run('getGame',[S.auth.user,S.auth.pin,campus],function(d){
    S.gameLoading=false;
    if(d && d.ok){ if(campus===S.me.campus) S.game=d; S.gameOther=d; } else S.gameErr=t('Could not load');
    if(S.view==='team') render();
  },function(){ S.gameLoading=false; S.gameErr=t('Could not load'); if(S.view==='team') render(); });
}
function gameRowHtml_(p, G, big){
  var who=gamePerson_(p.id), mine=p.id===S.me.id;
  return '<div class="gameRow'+(mine?' me':'')+(big?' big':'')+'" data-person="'+esc(p.id)+'">'+
    '<span class="gameRank">'+(p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':p.rank)+'</span>'+avatarHtml(who,'sm')+
    '<span class="gameWho"><b>'+esc(who.name||'—')+(mine?' <small>· '+esc(t('you'))+'</small>':'')+'</b>'+gameDotsHtml_(p.week, G.today, G.from)+'</span>'+
    (p.streak>=2?'<span class="gameStreak">🔥 '+p.streak+'</span>':'')+
    '<span class="gamePts">'+p.pts+'</span></div>';
}
function gamePartsHtml_(me, G){
  var P=me.parts||{}, rows=[
    ['📱', t('Opened the app'), P.open, gpT('{n} a day',{n:G.pts.open})],
    ['✅', t('Habits ticked'), P.habits, gpT('{n} each, up to {m} a day',{n:G.pts.habit, m:G.pts.habitDayCap})],
    ['🗒️', t('Weekly goals'), P.goals, gpT('{n} for setting them, up to {m} more as they move',{n:G.pts.goalsSet, m:G.pts.goalsPct})],
    ['☑️', t('GP Tasks done'), P.tasks, gpT('{n} each, up to {m}',{n:G.pts.task, m:G.pts.taskCap})],
    ['📊', t('Ministry numbers entered'), P.numbers, gpT('{n} a day, up to {m}',{n:G.pts.numbers, m:G.pts.numbersCap})],
    ['📚', t('Books finished'), P.books, gpT('{n} each, up to {m}',{n:G.pts.book, m:G.pts.bookCap})],
    ['☕', t('1-on-1s held'), P.oneOnOnes, gpT('{n} each',{n:G.pts.oneOnOne})]
  ];
  return '<div class="gameParts">'+rows.map(function(r){
    return '<div class="gamePart'+(r[2]?'':' zero')+'"><span class="gamePartIc">'+r[0]+'</span><span class="gamePartText"><b>'+esc(r[1])+'</b><small>'+esc(r[3])+'</small></span><span class="gamePartN">'+(r[2]||0)+'</span></div>';
  }).join('')+'</div>';
}
function gameTeamHtml_(){
  var campus=(S.gameCampus && CAMPUSES.some(function(c){ return c.id===S.gameCampus; })) ? S.gameCampus : S.me.campus;
  var G=(campus===S.me.campus) ? S.game : (S.gameOther && S.gameOther.campus===campus ? S.gameOther : null);
  var h='<div class="campusSeg teamScopeSeg">'+CAMPUSES.map(function(c){
    return '<button class="campusBtn'+(campus===c.id?' on':'')+'" data-gamecampus="'+esc(c.id)+'">'+esc(t(c.name))+'</button>'; }).join('')+'</div>';
  if(!G || !G.ok){
    if(S.gameErr) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">'+esc(S.gameErr)+'</p><button class="btn ghost" id="gameRetry">'+esc(t('Try again'))+'</button></div>';
    gameLoad_(campus);
    return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  }
  var me=(campus===S.me.campus) ? G.me : null, tab=S.gameTab==='min' ? 'min' : 'people';
  /* the campus together, first: this is a team's week before it is a race */
  var pct=G.of ? Math.round(100*G.active/G.of) : 0;
  h+='<div class="card gameCampus" id="gameCampus"><div class="gameCampusTop"><b>'+esc(gpT('{a} of {n} active this week',{a:G.active, n:G.of}))+'</b><span>'+esc(gpT('{n} today',{n:G.activeToday}))+'</span></div>'+
    '<div class="gameBar"><i style="width:'+pct+'%"></i></div></div>';
  if(me){
    h+='<div class="card gameMe" id="gameMe"><div class="gameMeTop">'+
      '<div class="gameStat"><b>🔥 '+me.streak+'</b><small>'+esc(me.streak===1 ? t('day in a row') : t('days in a row'))+'</small></div>'+
      '<div class="gameStat"><b>⭐ '+me.pts+'</b><small>'+esc(t('points this week'))+'</small></div>'+
      '<div class="gameStat"><b>'+(me.rank ? '#'+me.rank : '—')+'</b><small>'+esc(me.rank ? gpT('of {n}',{n:G.people.length}) : t('not on the board'))+'</small></div></div>'+
      '<details class="gameHow" id="gameHow"'+(S.gameHowOpen?' open':'')+'><summary>'+esc(t('Where my points came from'))+'</summary>'+gamePartsHtml_(me, G)+
      '<p class="sub" style="margin:8px 0 0">'+esc(t('The weekly health check-in gives no points on purpose: it is anonymous, and points would show who answered.'))+'</p></details></div>';
  }
  h+='<div class="campusSeg gameTabs"><button class="campusBtn'+(tab==='people'?' on':'')+'" data-gametab="people">👤 '+esc(t('People'))+'</button>'+
    '<button class="campusBtn'+(tab==='min'?' on':'')+'" data-gametab="min">🤝 '+esc(t('Ministries'))+'</button></div>';
  if(tab==='min'){
    if(!G.ministries.length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('No ministry has two people on the board yet.'))+'</p></div>';
    else h+='<div class="card gameList" id="gameMins"><p class="sub" style="margin:0 0 6px">'+esc(t('Average points a person, so a small ministry can lead.'))+'</p>'+G.ministries.map(function(m, i){
      return '<div class="gameRow min"><span class="gameRank">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1))+'</span>'+
        '<span class="gameWho"><b>'+esc(t(m.ministry))+'</b><small>'+esc(gpT('{a} of {n} active',{a:m.active, n:m.n}))+'</small></span><span class="gamePts">'+m.avg+'</span></div>';
    }).join('')+'</div>';
  } else {
    var withPts=G.people.filter(function(p){ return p.pts>0; }), rest=G.people.length-withPts.length;
    if(!withPts.length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('Nobody has points yet this week. Tick a habit and be the first.'))+'</p></div>';
    else {
      var show=S.gameAll ? withPts : withPts.slice(0, 10);
      /* always show my own row, even when I am below the fold */
      if(me && me.rank && !show.some(function(p){ return p.id===S.me.id; })){ var mineRow=withPts.filter(function(p){ return p.id===S.me.id; })[0]; if(mineRow) show=show.concat([mineRow]); }
      h+='<div class="card gameList" id="gameList">'+show.map(function(p){ return gameRowHtml_(p, G, p.rank<=3); }).join('')+
        (withPts.length>10 && !S.gameAll ? '<button class="linkbtn" id="gameMore">'+esc(gpT('Show all {n}',{n:withPts.length}))+'</button>' : '')+
        (rest>0 ? '<p class="sub" style="margin:8px 0 0">'+esc(gpT('{n} more have no points yet this week.',{n:rest}))+'</p>' : '')+'</div>';
    }
  }
  if(campus===S.me.campus && G.me){
    h+='<div class="card gameHide"><label class="gameHideRow"><input type="checkbox" id="gameShowMe"'+(G.me.hidden?'':' checked')+'> <span><b>'+esc(t('Show me on the board'))+'</b><small>'+
      esc(t('Others see your points, your streak and which days you were active — never what you did. Off: you still see your own.'))+'</small></span></label></div>';
  }
  h+='<p class="sub gameFoot">'+esc(t('The week runs Monday to Sunday and starts again each Monday.'))+'</p>';
  return h;
}

function bindGame_(){
  var root=document.getElementById('main'); if(!root) return;
  Array.prototype.forEach.call(root.querySelectorAll('[data-gogame]'), function(b){
    b.onclick=function(){ gpTap(); S.person=null; S.teamMode='game'; S.gameCampus=null; S.view='team'; render(); window.scrollTo(0,0); };
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-gamecampus]'), function(b){
    b.onclick=function(){ gpTap(); S.gameCampus=b.getAttribute('data-gamecampus'); S.gameAll=false; S.gameErr=''; render(); };
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-gametab]'), function(b){
    b.onclick=function(){ gpTap(); S.gameTab=b.getAttribute('data-gametab'); render(); };
  });
  var more=document.getElementById('gameMore'); if(more) more.onclick=function(){ S.gameAll=true; render(); };
  var how=document.getElementById('gameHow'); if(how) how.addEventListener('toggle', function(){ S.gameHowOpen=how.open; });
  var retry=document.getElementById('gameRetry'); if(retry) retry.onclick=function(){ S.gameErr=''; render(); };
  var show=document.getElementById('gameShowMe');
  if(show) show.onchange=function(){
    var hide=!show.checked; show.disabled=true;
    run('gameSetHide',[S.auth.user,S.auth.pin,hide],function(d){
      if(d && d.ok){ S.game=d; S.gameOther=null; showMsg(hide ? t('You are off the board') : t('You are on the board')); } else showMsg(t('Could not save'));
      render();
    },function(){ showMsg(t('Could not save')); render(); });
  };
}
