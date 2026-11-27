/* ==================== The week's board (Nov 2026, Uriah) ====================
   "Gamify the app … see how active people are … a daily driver rather than a weekly check-in thing."
   Points for the week and a day streak, worked out by the server from what is already saved (api.js "The week's
   board") and carried on the boot as `game` — nothing extra is asked for on open. Two places:
   - My Home: one line under Today (gameHomeHtml_, #gameHome) — my streak, my points, my place; tap → the board.
   - Team → 🏆 This week (gameTeamHtml_, S.teamMode 'game'): the top three, everyone, the ministries, how points
     work. Everyone active on the campus is on it. 🏆 All time (S.gameTab 'all', #gameAllTime): every week since the
     board began added up — the server banks each finished week (api.js "All time").
   Others see points, a streak and which days someone was active — never what they did. */

function gameOn_(){ return !!(S.me && !S.guest && !S.student && !S.board && !S.stuPreview && !S.awaiting && !S.me.setupTodo); }
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
  if(me.parts && me.parts.streak) bits.push('<span class="gameBit gameBonus" id="gameBonus"><b>+'+Math.round(100*G.pts.streakBonus)+'%</b> '+esc(t('streak bonus'))+'</span>');
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
    (p.books?'<span class="gameStreak gameBooks">📚 '+p.books+'</span>':'')+(p.streak>=2?'<span class="gameStreak">🔥 '+p.streak+'</span>':'')+
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
  if(G.holiday || P.holiday) rows.push(['❄️', t('Snowflakes and candy canes caught'), P.holiday, gpT('{n} each, up to {m} a day',{n:G.pts.holiday, m:G.pts.holidayDayCap})]);
  if(G.santa || P.santa) rows.push(['🎅', t('Santa caught'), P.santa, gpT('{n} each time you catch him, up to {m} a day',{n:G.pts.santa, m:G.pts.santaDayCap})]);
  rows.push(['🔥', t('Streak bonus'), P.streak, gpT('+{n}% of the week while you are on a streak of {m} days or more',{n:Math.round(100*G.pts.streakBonus), m:G.pts.streakMin})]);
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
  var me=(campus===S.me.campus) ? G.me : null, tab=S.gameTab==='min' ? 'min' : S.gameTab==='books' ? 'books' : (S.gameTab==='all' && G.allTime) ? 'all' : 'people';
  /* the campus together, first: this is a team's week before it is a race */
  var pct=G.of ? Math.round(100*G.active/G.of) : 0;
  h+='<div class="card gameCampus" id="gameCampus"><div class="gameCampusTop"><b>'+esc(gpT('{a} of {n} active this week',{a:G.active, n:G.of}))+'</b><span>'+esc(gpT('{n} today',{n:G.activeToday}))+'</span></div>'+
    '<div class="gameBar"><i style="width:'+pct+'%"></i></div></div>';
  if(me){
    h+='<div class="card gameMe" id="gameMe"><div class="gameMeTop">'+
      '<div class="gameStat"><b>🔥 '+me.streak+'</b><small>'+esc(me.streak===1 ? t('day in a row') : t('days in a row'))+'</small></div>'+
      '<div class="gameStat"><b>⭐ '+me.pts+'</b><small>'+esc(t('points this week'))+'</small></div>'+
      '<div class="gameStat"><b>'+(me.rank ? '#'+me.rank : '—')+'</b><small>'+esc(gpT('of {n}',{n:G.people.length}))+'</small></div></div>'+
      (G.allTime && me.all!=null ? '<button class="gameMeAll" id="gameMeAll" data-gametab="all">🏆 <b>'+me.all+'</b> '+esc(t('points all time'))+(me.allRank ? ' · <b>#'+me.allRank+'</b>' : '')+' ›</button>' : '')+
      '<details class="gameHow" id="gameHow"'+(S.gameHowOpen?' open':'')+'><summary>'+esc(t('Where my points came from'))+'</summary>'+gamePartsHtml_(me, G)+
      '<p class="sub" style="margin:8px 0 0">'+esc(t('The weekly health check-in gives no points on purpose: it is anonymous, and points would show who answered.'))+'</p></details></div>';
  }
  h+='<div class="campusSeg gameTabs"><button class="campusBtn'+(tab==='people'?' on':'')+'" data-gametab="people">👤 '+esc(t('People'))+'</button>'+
    (G.allTime ? '<button class="campusBtn'+(tab==='all'?' on':'')+'" data-gametab="all" id="gameTabAll">🏆 '+esc(t('All time'))+'</button>' : '')+
    '<button class="campusBtn'+(tab==='books'?' on':'')+'" data-gametab="books">📚 '+esc(t('Readers'))+'</button>'+
    '<button class="campusBtn'+(tab==='min'?' on':'')+'" data-gametab="min">🤝 '+esc(t('Ministries'))+'</button></div>';
  if(tab==='all'){
    /* All time: every week since the board began, this one included (api.js "All time") */
    var ap=G.people.filter(function(p){ return p.all>0; }).sort(function(a,b){ return (a.allRank||0)-(b.allRank||0) || b.pts-a.pts; });
    var arest=G.people.length-ap.length, ashow=S.gameAll ? ap : ap.slice(0, 10);
    if(me && me.allRank && !ashow.some(function(p){ return p.id===S.me.id; })){ var amine=ap.filter(function(p){ return p.id===S.me.id; })[0]; if(amine) ashow=ashow.concat([amine]); }
    h+='<div class="card gameList" id="gameAllTime"><p class="sub" style="margin:0 0 6px">'+esc(gpT('Every point since the board began on {d} — {n} weeks, this one included.',{d:fmtDateNice_(G.allTime.from), n:G.allTime.weeks}))+'</p>'+
      (ap.length ? ashow.map(function(p){
        var who=gamePerson_(p.id), mine=p.id===S.me.id, r=p.allRank;
        return '<div class="gameRow'+(mine?' me':'')+(r<=3?' big':'')+'" data-person="'+esc(p.id)+'"><span class="gameRank">'+(r===1?'🥇':r===2?'🥈':r===3?'🥉':r)+'</span>'+avatarHtml(who,'sm')+
          '<span class="gameWho"><b>'+esc(who.name||'—')+(mine?' <small>· '+esc(t('you'))+'</small>':'')+'</b><small>'+esc(gpT('{n} points this week',{n:p.pts}))+'</small></span>'+
          '<span class="gamePts">'+p.all+'</span></div>';
      }).join('') : '<p class="sub" style="margin:0">'+esc(t('Nobody has points yet. Tick a habit and be the first.'))+'</p>')+
      (ap.length>10 && !S.gameAll ? '<button class="linkbtn" id="gameMore">'+esc(gpT('Show all {n}',{n:ap.length}))+'</button>' : '')+
      (arest>0 && ap.length ? '<p class="sub" style="margin:8px 0 0">'+esc(gpT('{n} more have no points yet.',{n:arest}))+'</p>' : '')+'</div>';
  } else if(tab==='books'){
    var rd=G.people.filter(function(p){ return p.booksYear>0; }).sort(function(a,b){ return b.booksYear-a.booksYear || b.books-a.books; });
    h+='<div class="card gameList" id="gameBooks"><p class="sub" style="margin:0 0 6px">'+esc(gpT('Books finished this year. Each one is worth {n} points the week you finish it.',{n:G.pts.book}))+'</p>'+
      (rd.length ? rd.slice(0, S.gameAll ? 999 : 15).map(function(p, i){
        var who=gamePerson_(p.id), mine=p.id===S.me.id;
        return '<div class="gameRow'+(mine?' me':'')+'" data-person="'+esc(p.id)+'"><span class="gameRank">'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1))+'</span>'+avatarHtml(who,'sm')+
          '<span class="gameWho"><b>'+esc(who.name||'—')+(mine?' <small>· '+esc(t('you'))+'</small>':'')+'</b>'+(p.books?'<small>'+esc(gpT('{n} this week',{n:p.books}))+'</small>':'')+'</span><span class="gamePts">📚 '+p.booksYear+'</span></div>';
      }).join('') : '<p class="sub" style="margin:0">'+esc(t('Nobody has finished a book yet this year. Be the first.'))+'</p>')+
      '<button class="btn" id="gameGoLib" data-libhome="" style="margin-top:10px">📚 '+esc(t('Open the Library'))+'</button></div>';
  } else if(tab==='min'){
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
  h+='<p class="sub gameFoot">'+esc(tab==='all' ? t('All time keeps adding up. Each week still starts again on Monday.') : t('The week runs Monday to Sunday and starts again each Monday.'))+'</p>';
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
    b.onclick=function(){ gpTap(); S.gameTab=b.getAttribute('data-gametab'); S.gameAll=false; render(); };
  });
  var more=document.getElementById('gameMore'); if(more) more.onclick=function(){ S.gameAll=true; render(); };
  var how=document.getElementById('gameHow'); if(how) how.addEventListener('toggle', function(){ S.gameHowOpen=how.open; });
  var retry=document.getElementById('gameRetry'); if(retry) retry.onclick=function(){ S.gameErr=''; render(); };
}

/* ---------- The holiday catch (Nov 2026, Andrew: "since it's the holiday season … every now and then a snowflake or a
   candy cane will fall down from the screen … tap on it and get 5 points … don't make it so often") ----------
   In the season (the server says so: the board's `holiday`, with how many are left today) a snowflake or a candy cane
   falls across the screen now and then while the app is open — the first a few minutes in, then every 4 to 10 minutes,
   none once today's are caught. A tap catches it (catchHoliday: the server keeps the count and the cap, 5 points each,
   three a day) and the points show at once. Not for guests, students, the board or a preview; not under a test browser
   unless localStorage 'gp-hol-test' is set (S.holMs sets the wait, for tests). */
var HOL_FIRST_MS=[90000, 240000], HOL_GAP_MS=[240000, 600000], HOL_FALL_MS=9000;
var _hol={ timer:0, el:null, started:false, busy:false };
var HOL_CANE='<svg viewBox="0 0 40 64" width="30" height="48" aria-hidden="true"><path d="M13 60V22a9 9 0 0 1 18 0v5" fill="none" stroke="white" stroke-width="8" stroke-linecap="round"/>'+
  '<path d="M13 60V22a9 9 0 0 1 18 0v5" fill="none" stroke="crimson" stroke-width="8" stroke-dasharray="5 6"/></svg>';
function holOn_(){
  var G=S.game;
  if(!gameOn_() || !S.auth || !S.auth.user || !G || !G.ok || !G.holiday || !(G.holiday.left>0)) return false;
  if(S.bootStale || S.offlineSince) return false;
  if(typeof gpTasksApp_==='function' && gpTasksApp_()) return false;
  if(navigator.webdriver && !lsGet('gp-hol-test')) return false;
  return true;
}
function holSchedule_(){
  if(_hol.timer || _hol.el || !holOn_()) return;
  var r=_hol.started ? HOL_GAP_MS : HOL_FIRST_MS; _hol.started=true;
  var ms=(typeof S.holMs==='number') ? S.holMs : r[0]+Math.random()*(r[1]-r[0]);
  _hol.timer=setTimeout(function(){
    _hol.timer=0;
    if(document.hidden || S.bellOpen || !holOn_()){ _hol.started=true; holSchedule_(); return; }
    holDrop_();
  }, ms);
}
function holDrop_(){
  if(_hol.el || !holOn_()) return;
  var cane=Math.random()<0.4, b=document.createElement('button');
  b.className='holDrop'+(cane?' cane':'');
  b.id='holDrop';
  b.setAttribute('aria-label', cane ? t('Catch the candy cane') : t('Catch the snowflake'));
  b.innerHTML=cane ? HOL_CANE : '<span aria-hidden="true">❄️</span>';
  b.style.left=(6+Math.round(Math.random()*76))+'%';
  b.style.animationDuration=(S.holFallMs||HOL_FALL_MS)+'ms';
  b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); holCatch_(b, cane); };
  b.addEventListener('animationend', function(ev){ if(ev.target===b && !b.classList.contains('caught')) holGone_(); });
  document.body.appendChild(b);
  _hol.el=b;
}
function holGone_(){
  if(_hol.el && _hol.el.parentNode) _hol.el.parentNode.removeChild(_hol.el);
  _hol.el=null;
  holSchedule_();
}
function holCatch_(b, cane){
  if(_hol.busy || b.classList.contains('caught')) return;
  _hol.busy=true; gpTap();
  var r=b.getBoundingClientRect();
  b.classList.add('caught');
  b.style.top=Math.round(r.top)+'px'; b.style.left=Math.round(r.left)+'px'; b.style.animation='holCaught .45s ease-out forwards';   // stop where it was caught
  var pop=document.createElement('div'); pop.className='holPop'; pop.textContent='+'+((S.game && S.game.pts && S.game.pts.holiday) || 5)+' ⭐';
  pop.style.left=Math.round(r.left+r.width/2)+'px'; pop.style.top=Math.round(r.top)+'px';
  document.body.appendChild(pop);
  setTimeout(function(){ if(pop.parentNode) pop.parentNode.removeChild(pop); }, 1400);
  setTimeout(function(){ if(b.parentNode) b.parentNode.removeChild(b); if(_hol.el===b) _hol.el=null; }, 450);
  run('catchHoliday',[S.auth.user,S.auth.pin],function(d){
    _hol.busy=false;
    if(d && d.ok){
      if(d.game && d.game.ok) S.game=d.game; else if(S.game && S.game.holiday) S.game.holiday.left=d.left;
      showMsg(cane ? gpT('You caught a candy cane! +{n} points',{n:d.pts}) : gpT('You caught a snowflake! +{n} points',{n:d.pts}));
      holRefresh_();
    } else if(d && d.err==='cap' && S.game && S.game.holiday){ S.game.holiday.left=0; }
    holSchedule_();
  },function(){ _hol.busy=false; holSchedule_(); });
}
/* the points line on My Home, and the board if it is open, without a full redraw (nobody loses what they typed) */
function holRefresh_(){
  var home=document.getElementById('gameHome');
  if(home){ var w=document.createElement('div'); w.innerHTML=gameHomeHtml_(); var nu=w.firstChild; if(nu){ home.parentNode.replaceChild(nu, home); bindGame_(); } }
  if(S.view==='team' && S.teamMode==='game') render();
}

/* ---------- Santa (Nov 2026, Uriah: "a little Santa Claus that flies around the screen every time you open the app,
   and when you click on him, you get … points"; then "make him fly pretty regularly") ----------
   In the holiday season (the board's `santa`, with how many are left today) Santa and his reindeer fly across the
   screen a few seconds after the app opens, then again every SANTA_GAP_MS (3–6 minutes) while it stays open, until
   today's are caught; coming back to the front after SANTA_AWAY_MS away starts over with the quick first flight (an
   iPhone Home Screen app is rarely reloaded). A tap catches him: catchSanta (the server keeps the count, santa points
   each, santaDayCap a day, not two within a minute). Not while the welcome sheet, the bell, a snowflake or another
   Santa is up; not for guests, students, the board or a preview; not under a test browser unless 'gp-santa-test' is
   set (S.santaMs sets the first wait, S.santaGapMs the ones after, S.santaFlyMs the flight). */
var SANTA_FIRST_MS=3500, SANTA_GAP_MS=[180000, 360000], SANTA_FLY_MS=8000, SANTA_AWAY_MS=10*60*1000;
var _santa={ timer:0, el:null, started:false, busy:false, hiddenAt:0 };
function santaOn_(){
  var G=S.game;
  if(!gameOn_() || !S.auth || !S.auth.user || !G || !G.ok || !G.santa || !(G.santa.left>0)) return false;
  if(S.bootStale || S.offlineSince || S.view==='login') return false;
  if(typeof gpTasksApp_==='function' && gpTasksApp_()) return false;
  if(navigator.webdriver && !lsGet('gp-santa-test')) return false;
  return true;
}
/* called on every bind and after each flight: it only sets a timer when none is waiting */
function santaSchedule_(){
  if(_santa.timer || _santa.el || !santaOn_()) return;
  var ms;
  if(!_santa.started) ms=typeof S.santaMs==='number' ? S.santaMs : SANTA_FIRST_MS;
  else ms=typeof S.santaGapMs==='number' ? S.santaGapMs : SANTA_GAP_MS[0]+Math.random()*(SANTA_GAP_MS[1]-SANTA_GAP_MS[0]);
  _santa.started=true;
  _santa.timer=setTimeout(function(){
    _santa.timer=0;
    if(!santaOn_()) return;
    if(document.hidden || S.bellOpen || _hol.el || document.getElementById('gameIntro') || document.getElementById('askRoot')){
      _santa.timer=setTimeout(function(){ _santa.timer=0; santaSchedule_(); }, 5000); return;   // busy: look again shortly
    }
    santaFly_();
  }, ms);
}
function santaFly_(){
  if(_santa.el || !santaOn_()) return;
  var b=document.createElement('button');
  b.className='santaFly'+(Math.random()<0.5?' ltr':'');
  b.id='santaFly';
  b.setAttribute('aria-label', t('Catch Santa'));
  b.innerHTML='<span class="santaSled" aria-hidden="true"><span class="santaDeer">🦌</span><span class="santaDeer">🦌</span><span class="santaMan">🎅</span><span class="santaSpark">✨</span></span>';
  b.style.top=(14+Math.round(Math.random()*46))+'%';
  b.style.animationDuration=(S.santaFlyMs||SANTA_FLY_MS)+'ms';
  b.onclick=function(e){ e.preventDefault(); e.stopPropagation(); santaCatch_(b); };
  b.addEventListener('animationend', function(ev){ if(ev.target===b && !b.classList.contains('caught')) santaGone_(); });
  document.body.appendChild(b);
  _santa.el=b;
}
function santaGone_(){
  if(_santa.el && _santa.el.parentNode) _santa.el.parentNode.removeChild(_santa.el);
  _santa.el=null;
  santaSchedule_();   // missed him: he comes round again in a few minutes
}
function santaCatch_(b){
  if(_santa.busy || b.classList.contains('caught')) return;
  _santa.busy=true; gpTap();
  var r=b.getBoundingClientRect();
  b.classList.add('caught');
  b.style.top=Math.round(r.top)+'px'; b.style.left=Math.round(r.left)+'px'; b.style.right='auto'; b.style.animation='holCaught .45s ease-out forwards';
  var pop=document.createElement('div'); pop.className='holPop'; pop.textContent='+'+((S.game && S.game.pts && S.game.pts.santa) || 5)+' ⭐';
  pop.style.left=Math.round(r.left+r.width/2)+'px'; pop.style.top=Math.round(r.top)+'px';
  document.body.appendChild(pop);
  setTimeout(function(){ if(pop.parentNode) pop.parentNode.removeChild(pop); }, 1400);
  setTimeout(function(){ if(b.parentNode) b.parentNode.removeChild(b); if(_santa.el===b) _santa.el=null; }, 450);
  if(typeof gpConfetti==='function') try { gpConfetti(b); } catch(e){}
  run('catchSanta',[S.auth.user,S.auth.pin],function(d){
    _santa.busy=false;
    if(d && d.ok){
      if(d.game && d.game.ok) S.game=d.game; else if(S.game && S.game.santa) S.game.santa.left=d.left;
      showMsg(gpT('Ho ho ho! You caught Santa! +{n} points',{n:d.pts}));
      holRefresh_();
    } else if(d && d.err==='cap' && S.game && S.game.santa){ S.game.santa.left=0; showMsg(t('Santa is all caught for today. Come back tomorrow!')); }
    else if(d && d.err==='soon') showMsg(t('Santa needs a minute to warm up — catch him next time!'));
    setTimeout(santaSchedule_, 500);
  },function(){ _santa.busy=false; setTimeout(santaSchedule_, 500); });
}
/* back to the front after a while away counts as opening the app again: the quick first flight */
document.addEventListener('visibilitychange', function(){
  if(document.hidden){ _santa.hiddenAt=Date.now(); return; }
  if(_santa.hiddenAt && Date.now()-_santa.hiddenAt>=SANTA_AWAY_MS){ clearTimeout(_santa.timer); _santa.timer=0; _santa.started=false; santaSchedule_(); }
  _santa.hiddenAt=0;
});

/* ---------- The points sheet when the app opens (Nov 2026, the rollout: "show the points when they open the app …
   that kind of explains what's what") ----------
   On My Home, on the first fresh boot of each day: my points this week, my streak and place, then what each thing is
   worth (from the server's own GAME_PTS, so it can't drift), the streak bonus, Santa and the snowflakes while it's
   the season, and a button to the board. The first time it says "Points are here!". "Don't show this when I open the
   app" turns it off on that phone (GAME_INTRO_KEY = {n, last, off}). Not under a test browser unless 'gp-intro-test'. */
var GAME_INTRO_KEY='gp-game-intro-v2';
/* Turned off (Nov 2026, Andrew: "stop the pop up about the leaderboard for points"). The code stays so it can come back:
   set this to true. How points work is still on Team → This week. */
var GAME_INTRO_ON=false;
function gameIntroState_(){
  var st={};
  try { st=JSON.parse(lsGet(GAME_INTRO_KEY)||'{}')||{}; } catch(e){ st={}; }
  return st;
}
function gameIntroOn_(){
  if(!GAME_INTRO_ON) return false;
  if(!gameOn_() || !S.auth || !S.auth.user || !S.game || !S.game.ok || !S.game.me) return false;
  if(S.bootStale || S.offlineSince || S.view!=='week') return false;
  if(typeof gpTasksApp_==='function' && gpTasksApp_()) return false;
  if(navigator.webdriver && !lsGet('gp-intro-test')) return false;
  var st=gameIntroState_();
  return !st.off && st.last!==todayStr();
}
function gameIntroHtml_(){
  var P=S.game.pts, me=S.game.me, season=!!(S.game.santa || S.game.holiday), first=!gameIntroState_().n;
  var rows=[
    ['📚', t('Finish a book'), P.book],
    ['☕', t('Hold a 1-on-1'), P.oneOnOne],
    ['🗒️', t('Set your three weekly goals'), P.goalsSet],
    ['📊', t('Enter your ministry’s numbers'), P.numbers],
    ['☑️', t('Finish a GP Task'), P.task],
    ['📱', t('Open the app'), P.open],
    ['✅', t('Tick a habit'), P.habit]
  ];
  if(season){
    rows.push(['❄️', t('Catch a snowflake or candy cane'), P.holiday]);
    rows.push(['🎅', t('Catch Santa when he flies by'), P.santa]);
  }
  return '<div class="gameIntroScrim" id="gameIntroScrim"></div>'+
    '<div class="gameIntro" id="gameIntro" role="dialog" aria-modal="true" aria-labelledby="gameIntroH">'+
    '<div class="gameIntroTop">🏆</div>'+
    '<h2 id="gameIntroH">'+esc(first ? t('Points are here!') : t('Your points this week'))+'</h2>'+
    '<div class="gameIntroMe" id="gameIntroMe"><span><b>⭐ '+me.pts+'</b><small>'+esc(t('points this week'))+'</small></span>'+
      '<span><b>🔥 '+me.streak+'</b><small>'+esc(me.streak===1 ? t('day in a row') : t('days in a row'))+'</small></span>'+
      '<span><b>'+(me.rank ? '#'+me.rank : '—')+'</b><small>'+esc(gpT('of {n}',{n:(S.game.people||[]).length}))+'</small></span></div>'+
    '<p class="sub">'+esc(t('Use the app every day and earn points for the good things you already do. Every Monday the week’s board starts again.'))+'</p>'+
    '<p class="gameIntroHow">'+esc(t('How to earn points'))+'</p>'+
    '<div class="gameIntroList">'+rows.map(function(r){
      return '<div class="gameIntroRow"><span class="gamePartIc">'+r[0]+'</span><span class="gameIntroWhat">'+esc(r[1])+'</span><b>+'+esc(String(r[2]))+'</b></div>';
    }).join('')+'</div>'+
    '<p class="sub gameIntroBonus">🔥 '+esc(gpT('Use the app {m} days in a row and get +{n}% on the whole week.',{m:P.streakMin, n:Math.round(100*P.streakBonus)}))+'</p>'+
    (season ? '<p class="sub gameIntroBonus">🎄 '+esc(t('It’s the holiday season: Santa flies across the screen every few minutes. Tap him to catch him!'))+'</p>' : '')+
    '<div class="gameIntroBtns"><button class="btn" id="gameIntroBoard">🏆 '+esc(t('See this week’s board'))+'</button>'+
    '<button class="btn ghost" id="gameIntroGo">'+esc(t('Let’s go!'))+'</button>'+
    '<button class="linkbtn gameIntroOff" id="gameIntroOff">'+esc(t('Don’t show this when I open the app'))+'</button></div></div>';
}
function gameIntroMaybe_(){
  if(document.getElementById('gameIntro') || !gameIntroOn_()) return;
  var root=document.createElement('div'); root.id='gameIntroRoot'; root.innerHTML=gameIntroHtml_();
  document.body.appendChild(root);
  var st=gameIntroState_();
  lsSet(GAME_INTRO_KEY, JSON.stringify({ n:(st.n||0)+1, last:todayStr(), off:!!st.off }));   // shown today: not again until tomorrow
  var close=function(toBoard, off){
    if(off){ var s2=gameIntroState_(); s2.off=true; lsSet(GAME_INTRO_KEY, JSON.stringify(s2)); }
    if(typeof gpConfetti==='function') try { gpConfetti(document.getElementById('gameIntroGo')); } catch(e){}
    if(root.parentNode) root.parentNode.removeChild(root);
    if(toBoard){ S.person=null; S.teamMode='game'; S.gameCampus=null; S.view='team'; render(); window.scrollTo(0,0); }
  };
  document.getElementById('gameIntroGo').onclick=function(){ gpTap(); close(false); };
  document.getElementById('gameIntroBoard').onclick=function(){ gpTap(); close(true); };
  document.getElementById('gameIntroScrim').onclick=function(){ close(false); };
  document.getElementById('gameIntroOff').onclick=function(){ gpTap(); close(false, true); showMsg(t('You can still see how points work on Team → This week.')); };
}
