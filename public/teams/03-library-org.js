/* My YWAM GP — teams.html, part 3 of 11: personality, the Library, the papers everyone signs, guest mode, YWAM GP and the board, the quarter report, first 30 days, prayer, support raising, reminders, Khmer review.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ==================== personality types ====================
   Take a short questionnaire, get a four-letter type and a character to go with
   it, and read what it means — for yourself, in your ministry and in the season
   you are in, and for anyone on the team who wants to know how to work well
   with you. The words, questions and pictures live in personality.js; this is
   only the screens.

   Three screens: the card on My Home, the test (S.view 'ptest') and the type
   page (S.view 'ptype'), which shows either your own type or a teammate's.
   A teammate's page leaves out your season on purpose — see saveMyPersonality
   in api.js for who sees what. */
var P_PAGE = 5;                 // statements per screen, as on the phones this runs on
var P_DRAFT_KEY = 'gp-ptest';   // answers survive a reload or a dropped connection

function pOK(){ return typeof gpPAvatar==='function' && typeof GP_PTYPES!=='undefined'; }
function myPType(){ return (S.profile && S.profile.personality) || null; }
function mySex(){ return (S.profile && S.profile.sex) || ''; }
/* "The Guide", translated as ONE phrase: Khmer has no article, so gluing a
   translated "The" to a translated name would put a stray word on screen. */
function pTheName(code){ var ty=GP_PTYPES[code]; if(!ty) return ''; var key='The '+ty.name; return t(key); }
function firstName_(n){ return String(n||'').trim().split(/\s+/)[0] || ''; }

function pDraftLoad(){
  try { var d=JSON.parse(localStorage.getItem(P_DRAFT_KEY)||'null'); return (d && typeof d==='object') ? d : {}; }
  catch(e){ return {}; }
}
function pDraftSave(a){ try { localStorage.setItem(P_DRAFT_KEY, JSON.stringify(a||{})); } catch(e){} }
function pDraftClear(){ try { localStorage.removeItem(P_DRAFT_KEY); } catch(e){} }

/* The chip under a name in the directory — the type, in its group's tint. */
function ptChipHtml(p){
  if(!pOK() || !p || !p.avatar) return '';
  var g=gpPGroupOf(p.avatar.type);
  return g ? '<div><span class="ptChip" style="background:'+g.tint+'">'+esc(p.avatar.type)+'</span></div>' : '';
}

function personalityCardHtml(){
  if(!pOK()) return '';
  var p=myPType();
  var h='<h3 id="sec-ptype">🧭 '+esc(t('Personality'))+'</h3>';
  if(!p){
    return h+'<button class="card pEntry" id="pStart">'+
      '<span class="pEntryArt"><span class="pQ">?</span></span>'+
      '<span style="flex:1"><div style="font-size:15px;font-weight:800">'+esc(t('Discover your personality type'))+'</div>'+
      '<div class="pmeta">'+esc(t('40 quick statements · about 5 minutes'))+'</div></span>'+
      PCHEV+'</button>';
  }
  var ty=GP_PTYPES[p.type];
  return h+'<button class="card pEntry" id="pSeeMine">'+
    '<span class="pEntryArt">'+gpPAvatar(p.type, mySex(), 64)+'</span>'+
    '<span style="flex:1"><div class="pCode" style="color:'+gpPGroupOf(p.type).ink+'">'+esc(p.type)+'</div>'+
    '<div style="font-size:16px;font-weight:800">'+esc(pTheName(p.type))+'</div>'+
    '<div class="pmeta">'+esc(t(ty.tagline))+'</div></span>'+PCHEV+'</button>';
}
/* About you: personality and strengths side by side, with the same ids
   (pStart / pSeeMine, gsStart / gsSeeMine) their screens already listen for. */
function aboutMeHtml_(){
  var tiles='';
  if(pOK()){
    var p=myPType();
    tiles += p
      ? homeTile_('pSeeMine', '<span class="homeTileArt">'+gpPAvatar(p.type, mySex(), 40)+'</span>', pTheName(p.type), '<b style="color:'+gpPGroupOf(p.type).ink+'">'+esc(p.type)+'</b> · '+esc(t('Personality')))
      : homeTile_('pStart', '🧭', t('Personality'), esc(t('Discover your personality type')));
  }
  if(gsOK()){
    var g=myGS();
    tiles += g
      ? homeTile_('gsSeeMine', '💪', t('Strengths'), '<span class="sChips homeTileChips">'+g.top.map(function(id,i){ return gsChipHtml(id,i+1); }).join('')+'</span>')
      : homeTile_('gsStart', '💪', t('Strengths'), esc(t('Find your top 5 strengths')));
  }
  var ss=S.supSum;
  if(!S.student) tiles += homeTile_('supTile', '💰', t('Support raising'), esc(ss && ss.goal ? gpT('${n} of ${goal} a month',{n:fmt(ss.pledged), goal:fmt(ss.goal)}) : t('Your partners and monthly goal')));
  if(!S.student) tiles += p3TileHtml_();
  var nb=libBooksRead_();
  tiles += homeTile_('libHomeTile', '📚', t('Library'), esc(nb ? gpT('{n} books read',{n:nb}) : t('Ten-minute reads')));
  return '<h3 id="sec-ptype">🧭 '+esc(t('About me'))+'</h3><div class="homeTiles" id="sec-strengths">'+tiles+'</div>';
}
var PCHEV='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--faint);flex:0 0 auto"><path d="M9 6l6 6-6 6"/></svg>';

/* On a teammate's profile: their character and a way into their type. */
function personTypeCardHtml(d){
  if(!pOK() || !d || !d.personality || !GP_PTYPES[d.personality.type]) return '';
  var p=d.staff, ty=GP_PTYPES[d.personality.type];
  return '<h3>🧭 '+esc(t('Personality'))+'</h3>'+
    '<button class="card pEntry" id="pSeePerson">'+
    '<span class="pEntryArt">'+gpPAvatar(d.personality.type, (p.avatar&&p.avatar.sex)||'', 64)+'</span>'+
    '<span style="flex:1"><div class="pCode" style="color:'+gpPGroupOf(d.personality.type).ink+'">'+esc(d.personality.type)+'</div>'+
    '<div style="font-size:16px;font-weight:800">'+esc(pTheName(d.personality.type))+'</div>'+
    '<div class="pmeta">'+esc(gpT('How to work well with {name}',{name:firstName_(p.name)}))+'</div></span>'+PCHEV+'</button>';
}

/* ---------- the test ---------- */
function ptestHtml(){
  if(!pOK()) return '<p class="sub">'+esc(t('Personality types could not load. Pull down to refresh.'))+'</p>';
  var T=S.ptest||(S.ptest={stage:'intro', answers:pDraftLoad(), page:0, sex:mySex()});
  var h='<button class="linkbtn" id="pBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>';

  if(T.stage==='intro'){
    var started = Object.keys(T.answers||{}).length;
    h+='<h2>'+esc(t('Personality type'))+'</h2>'+
      '<div class="card">'+
      '<p style="margin:2px 0 10px;font-size:15px;line-height:1.5">'+
        esc(t('Forty short statements. Answer how you really are — not how you wish you were, or how your job needs you to be.'))+'</p>'+
      '<p class="sub" style="margin:0 0 12px">'+esc(t('There are no right answers, and no type is better than another.'))+'</p>'+
      '<label class="f">'+esc(t('Your character'))+'</label>'+
      '<div class="pSexRow">'+
        '<button data-psex="female" class="'+(T.sex==='female'?'on':'')+'">'+gpPAvatar('ENFJ','female',56)+esc(t('Female'))+'</button>'+
        '<button data-psex="male" class="'+(T.sex==='male'?'on':'')+'">'+gpPAvatar('ENFJ','male',56)+esc(t('Male'))+'</button>'+
      '</div>'+
      '<button class="btn" id="pBegin"'+(T.sex?'':' disabled')+'>'+
        esc(started? gpT('Carry on — {n} of 40 answered',{n:started}) : t('Start'))+'</button>'+
      (T.sex?'':'<div class="hint" style="text-align:center">'+esc(t('Choose one to start.'))+'</div>')+
      '<button class="linkbtn" id="pKnow">'+esc(t('I already know my type'))+'</button>'+
      '</div>'+pFineHtml();
    return h;
  }

  if(T.stage==='pick'){
    h+='<h2>'+esc(t('Choose your type'))+'</h2>'+
      '<p class="sub">'+esc(t('Already taken a test like this before? Pick the four letters you got.'))+'</p>';
    if(!T.sex){
      h+='<div class="pSexRow">'+
        '<button data-psex="female">'+esc(t('Female'))+'</button><button data-psex="male">'+esc(t('Male'))+'</button></div>'+
        '<div class="hint">'+esc(t('For your character — choose one first.'))+'</div>';
    }
    ['minds','hearts','anchors','movers'].forEach(function(gid){
      var g=GP_PGROUPS[gid];
      h+='<h3 style="color:'+g.ink+'">'+esc(t(g.name))+'</h3><div class="pPick">';
      GP_PTYPE_CODES.filter(function(c){ return gpPGroupOf(c).id===gid; }).forEach(function(c){
        h+='<button data-ppick="'+c+'"'+(T.sex?'':' disabled')+'>'+gpPAvatar(c, T.sex||'female', 64)+
          '<span class="pCode" style="color:'+g.ink+'">'+c+'</span>'+
          '<span class="pPickName">'+esc(pTheName(c))+'</span></button>';
      });
      h+='</div>';
    });
    return h+pFineHtml();
  }

  /* the questions, a page at a time */
  var pages=Math.ceil(GP_PQUESTIONS.length/P_PAGE);
  var page=Math.max(0, Math.min(pages-1, T.page||0));
  var answered=GP_PQUESTIONS.filter(function(q){ return T.answers[q.id]!==undefined; }).length;
  h+='<div class="pProg"><div class="pTrack"><div style="width:'+Math.round(answered/GP_PQUESTIONS.length*100)+'%"></div></div>'+
    '<div class="pProgTxt">'+esc(gpT('{n} of {total}',{n:answered,total:GP_PQUESTIONS.length}))+'</div></div>';
  var qs=GP_PQUESTIONS.slice(page*P_PAGE, page*P_PAGE+P_PAGE);
  var pageDone=qs.every(function(q){ return T.answers[q.id]!==undefined; });
  qs.forEach(function(q){
    var v=T.answers[q.id];
    h+='<div class="pStmt'+(v!==undefined?' done':'')+'" id="pq_'+q.id+'">'+
      '<div class="pText">'+esc(t(q.text))+'</div>'+
      '<div class="pScale" role="radiogroup" aria-label="'+esc(t(q.text))+'">';
    [3,2,1,0,-1,-2,-3].forEach(function(n){
      var side = n>0?'ag':(n<0?'dis':'mid');
      h+='<button class="pDot s'+Math.abs(n)+' '+side+(v===n?' on':'')+'" data-pans="'+q.id+'|'+n+'"'+
        ' role="radio" aria-checked="'+(v===n?'true':'false')+'"'+
        ' aria-label="'+esc(pScaleWord(n))+'"></button>';
    });
    /* the words sit under the ends rather than beside them, so seven circles
       still fit a 320px phone */
    h+='</div><div class="pScaleEnds"><span class="ag">'+esc(t('Agree'))+'</span><span class="dis">'+esc(t('Disagree'))+'</span></div></div>';
  });
  var last = page===pages-1;
  h+='<div style="display:flex;gap:10px;margin:18px 0 6px">'+
    (page>0?'<button class="btn ghost" id="pPrev" style="flex:1">'+esc(t('Back'))+'</button>':'')+
    (last
      ? '<button class="btn" id="pFinish" style="flex:2"'+(answered===GP_PQUESTIONS.length?'':' disabled')+'>'+esc(t('See my type'))+'</button>'
      : '<button class="btn" id="pNext" style="flex:2"'+(pageDone?'':' disabled')+'>'+esc(t('Next'))+'</button>')+
    '</div>';
  return h;
}
function pScaleWord(n){
  return t(['Strongly disagree','Disagree','Slightly disagree','Neutral','Slightly agree','Agree','Strongly agree'][n+3]);
}
function pFineHtml(){
  return '<p class="pFine">'+esc(t('Uses the same four letters as Myers–Briggs®. This is YWAM GP’s own short questionnaire, not the official MBTI® assessment.'))+' '+
    esc(t('A type describes what comes naturally to you — not what you are able to do.'))+'</p>';
}

/* ---------- the type page ---------- */
function ptypeHtml(){
  if(!pOK()) return '<p class="sub">'+esc(t('Personality types could not load. Pull down to refresh.'))+'</p>';
  var other=S.ptypeOther;                 // set when opened from a teammate's profile
  var mine=!other;
  var P = mine ? myPType() : other;
  var back='<button class="linkbtn" id="ptypeBack" style="text-align:left;text-decoration:none;padding-left:0">← '+
    esc(mine?t('My Home'):firstName_(other.name))+'</button>';
  if(!P || !GP_PTYPES[P.type]) return back+'<p class="sub">'+esc(t('No type chosen yet.'))+'</p>';
  var ty=GP_PTYPES[P.type], g=gpPGroupOf(P.type);
  var sex = mine ? mySex() : (other.sex||'');
  var who = mine ? '' : gpT('{name}’s type',{name:firstName_(other.name)});

  var h=back;
  h+='<div class="pHero" style="background:'+g.tint+'">'+
    (who?'<div class="pWho">'+esc(who)+'</div>':'')+
    '<div class="pHeroArt">'+gpPAvatar(P.type, sex, 132)+'</div>'+
    '<span class="pGroup" style="color:'+g.ink+'">'+esc(t(g.name))+'</span>'+
    '<div class="pBig" style="color:'+g.ink+'">'+esc(P.type)+'</div>'+
    '<div class="pName">'+esc(pTheName(P.type))+'</div>'+
    '<div class="pTag">'+esc(t(ty.tagline))+'</div></div>';

  /* the four bars — only when there are scores to show (a picked type has none) */
  if(P.scores){
    h+='<div class="card">';
    GP_PAXES.forEach(function(ax){
      var pct=Number(P.scores[ax.id]);
      var first = pct>50;
      var shown = first?pct:100-pct;
      var name = first?ax.aName:ax.bName;
      /* the fill grows from the side that won, so the bar reads the way the words do */
      var fill = first ? 'left:0;width:'+pct+'%' : 'right:0;width:'+(100-pct)+'%';
      h+='<div class="pBar"><div class="pBarTop"><span>'+esc(t(ax.label))+'</span><span><b>'+shown+'%</b> '+esc(t(name))+'</span></div>'+
        '<div class="pTrack"><div class="pFill" style="'+fill+';background:'+g.color+'"></div></div>'+
        '<div class="pEnds"><span>'+esc(t(ax.aName))+'</span><span>'+esc(t(ax.bName))+'</span></div></div>';
    });
    h+='</div>';
  }

  h+='<div class="card"><p style="margin:2px 0;font-size:15px;line-height:1.55">'+esc(t(ty.about))+'</p></div>';

  h+='<h3>'+esc(t('Strengths'))+'</h3><div class="card"><ul class="pList">'+
    ty.strengths.map(function(x){ return '<li><span class="pMark" style="background:var(--pGood)">✓</span>'+esc(t(x))+'</li>'; }).join('')+
    '</ul></div>';
  h+='<h3>'+esc(t('Watch out for'))+'</h3><div class="card"><ul class="pList">'+
    ty.watch.map(function(x){ return '<li><span class="pMark" style="background:var(--pBad)">!</span>'+esc(t(x))+'</li>'; }).join('')+
    '</ul></div>';

  /* yours only: the same type, in the ministry you are in and the season you are in */
  if(mine){
    var job=gpPJobOf(S.me.dept, S.me.ministry);
    var season=P.season||'ordinary';
    var tips=gpPTipsFor(P.type, job, season);
    h+='<h3>🌱 '+esc(t('For you, right now'))+'</h3><div class="card">'+
      '<div class="pmeta" style="margin-bottom:6px">'+esc(t(S.me.ministry||S.me.dept||''))+' · '+esc(t(GP_PJOB[job]))+'</div>'+
      '<label class="f" style="margin-top:6px">'+esc(t('What season are you in?'))+'</label>'+
      '<div class="pSeasons">'+GP_PSEASONS.map(function(se){
        return '<button data-pseason="'+se.id+'" class="'+(season===se.id?'on':'')+'">'+esc(t(se.name))+'</button>';
      }).join('')+'</div>'+
      '<div class="hint" style="margin-bottom:6px">'+esc(t((GP_PSEASONS.filter(function(se){return se.id===season;})[0]||{}).blurb||''))+
        ' · 🔒 '+esc(t('only you see this'))+'</div>'+
      '<ul class="pList">'+tips.map(function(tip){
        return '<li><span class="pMark" style="background:'+(tip.kind==='season'?g.color:'var(--accent)')+'">'+(tip.kind==='season'?'◷':'★')+'</span>'+esc(t(tip.text))+'</li>';
      }).join('')+'</ul></div>';
  }

  h+='<h3>🤝 '+esc(mine?t('How others can work well with you'):gpT('Working with {name}',{name:firstName_(other.name)}))+'</h3>'+
    '<div class="card"><ul class="pList">'+
    ty.workWith.map(function(x){ return '<li><span class="pMark" style="background:'+g.color+'">→</span>'+esc(t(x))+'</li>'; }).join('')+
    '</ul></div>';

  if(mine){
    var share = P.share!==false;
    h+='<div class="card">'+
      '<label class="f">'+esc(t('Show my type to the team'))+'</label>'+
      '<div class="seg" style="max-width:220px">'+
        '<button id="pShareOn" class="'+(share?'on':'')+'">'+esc(t('Yes'))+'</button>'+
        '<button id="pShareOff" class="'+(!share?'on':'')+'">'+esc(t('No'))+'</button></div>'+
      '<div class="hint">'+esc(t('Your season always stays private.'))+'</div>'+
      '<button class="btn ghost" id="pRetake">'+esc(t('Retake the test'))+'</button>'+
      '<button class="linkbtn" id="pChoose">'+esc(t('Choose a different type'))+'</button>'+
      '</div>';
  }
  return h+pFineHtml();
}

/* ---------- saving ---------- */
function pSave(payload, then){
  run('saveMyPersonality',[S.auth.user,S.auth.pin,payload],function(d){
    S.busy=false;
    if(!d || !d.ok){ showMsg(t('Could not save — check your connection and try again.')); render(); return; }
    S.profile=Object.assign({}, S.profile||{}, { sex:d.sex, personality:d.personality });
    /* my own directory card follows straight away, without another roster fetch */
    (S.roster||[]).forEach(function(r){ if(r.id===S.me.id){ if(d.staff && d.staff.avatar) r.avatar=d.staff.avatar; else delete r.avatar; } });
    if(then) then(d); else render();
  });
}

function bindPersonality(){
  var st=document.getElementById('pStart');
  if(st) st.onclick=function(){ S.ptest={stage:'intro', answers:pDraftLoad(), page:0, sex:mySex()}; S.view='ptest'; render(); };
  var sm=document.getElementById('pSeeMine');
  if(sm) sm.onclick=function(){ S.ptypeOther=null; S.ptypeBack='week'; S.view='ptype'; render(); };
  var sp=document.getElementById('pSeePerson');
  if(sp) sp.onclick=function(){
    var d=S.person; if(!d || !d.personality) return;
    S.ptypeOther={ name:d.staff.name, type:d.personality.type, scores:d.personality.scores,
      sex:(d.staff.avatar&&d.staff.avatar.sex)||'' };
    S.ptypeBack='team'; S.view='ptype'; render();
  };
  var pb=document.getElementById('pBack');
  if(pb) pb.onclick=function(){
    var T=S.ptest;
    /* inside the questions, Back steps a page; from the start screen it leaves */
    if(T && T.stage==='q' && T.page>0){ T.page--; render(); window.scrollTo(0,0); return; }
    if(T && T.stage!=='intro'){ T.stage='intro'; render(); return; }
    S.view='week'; render();
  };
  var tb=document.getElementById('ptypeBack');
  if(tb) tb.onclick=function(){ S.view=S.ptypeBack||'week'; S.ptypeOther=null; render(); };

  document.querySelectorAll('[data-psex]').forEach(function(b){
    b.onclick=function(){ S.ptest.sex=b.getAttribute('data-psex'); render(); };
  });
  var bg=document.getElementById('pBegin');
  if(bg) bg.onclick=function(){
    var T=S.ptest; T.stage='q';
    /* carry on where they left off: the first page with a gap in it */
    var first=GP_PQUESTIONS.findIndex(function(q){ return T.answers[q.id]===undefined; });
    T.page = first<0 ? Math.ceil(GP_PQUESTIONS.length/P_PAGE)-1 : Math.floor(first/P_PAGE);
    render(); window.scrollTo(0,0);
  };
  var kn=document.getElementById('pKnow');
  if(kn) kn.onclick=function(){ S.ptest.stage='pick'; render(); window.scrollTo(0,0); };

  document.querySelectorAll('[data-pans]').forEach(function(b){
    b.onclick=function(){
      var parts=b.getAttribute('data-pans').split('|');
      var T=S.ptest; T.answers[parts[0]]=Number(parts[1]);
      pDraftSave(T.answers);
      gpTap();
      render();
      /* bring the next unanswered statement on this page into view, as a
         thumb would expect after each answer */
      var qs=GP_PQUESTIONS.slice(T.page*P_PAGE, T.page*P_PAGE+P_PAGE);
      var next=qs.filter(function(q){ return T.answers[q.id]===undefined; })[0];
      var el = next ? document.getElementById('pq_'+next.id) : document.getElementById(T.page===Math.ceil(GP_PQUESTIONS.length/P_PAGE)-1?'pFinish':'pNext');
      if(el && el.scrollIntoView) try { el.scrollIntoView({behavior:'smooth', block:'center'}); } catch(e){ el.scrollIntoView(); }
    };
  });
  var nx=document.getElementById('pNext');
  if(nx) nx.onclick=function(){ S.ptest.page++; render(); window.scrollTo(0,0); };
  var pv=document.getElementById('pPrev');
  if(pv) pv.onclick=function(){ S.ptest.page--; render(); window.scrollTo(0,0); };
  var fin=document.getElementById('pFinish');
  if(fin) fin.onclick=function(){
    if(S.busy) return;
    var r=gpPScore(S.ptest.answers);
    if(!r){ showMsg(t('Answer every statement first.')); return; }
    S.busy=true; fin.disabled=true; fin.textContent=t('Saving…');
    pSave({ type:r.type, scores:r.scores, source:'test', sex:S.ptest.sex }, function(){
      pDraftClear(); S.ptest=null; S.ptypeOther=null; S.ptypeBack='week'; S.view='ptype'; render(); window.scrollTo(0,0);
    });
  };
  document.querySelectorAll('[data-ppick]').forEach(function(b){
    b.onclick=function(){
      if(S.busy) return; S.busy=true;
      pSave({ type:b.getAttribute('data-ppick'), source:'self', sex:S.ptest.sex }, function(){
        S.ptest=null; S.ptypeOther=null; S.ptypeBack='week'; S.view='ptype'; render(); window.scrollTo(0,0);
      });
    };
  });

  document.querySelectorAll('[data-pseason]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-pseason');
      /* shown at once, saved behind it — a season chip should feel like a switch */
      S.profile.personality=Object.assign({}, S.profile.personality, { season:id });
      render();
      pSave({ season:id });
    };
  });
  var on=document.getElementById('pShareOn'), off=document.getElementById('pShareOff');
  if(on) on.onclick=function(){ pSave({ share:true }); };
  if(off) off.onclick=function(){ pSave({ share:false }); };
  var rt=document.getElementById('pRetake');
  if(rt) rt.onclick=function(){
    pDraftClear();
    S.ptest={stage:'intro', answers:{}, page:0, sex:mySex()}; S.view='ptest'; render(); window.scrollTo(0,0);
  };
  var ch=document.getElementById('pChoose');
  if(ch) ch.onclick=function(){ S.ptest={stage:'pick', answers:{}, page:0, sex:mySex()}; S.view='ptest'; render(); window.scrollTo(0,0); };
}

/* ---------- Team tab: YWAM GP and the Advisory Board as teams ----------
   Next to the two campuses, the Team tab's views can show YWAM GP's leadership
   team and the board (Uriah, Oct 2026). Their people come from the boot's `org`
   (getYwamGp) matched against the roster, so a board member shows in Strengths
   and Personalities only when they are also on staff — the board's own records
   hold no type and no strengths. Nothing new is sent for any of it. */
function teamOrgScope_(c){ return c==='ywamgp' || c==='board'; }
function teamPeopleIn_(c){
  if(!teamOrgScope_(c)) return S.roster.filter(function(p){ return p.campus===c; });
  var O=S.org||{}, ids=c==='ywamgp' ? (O.gp||[]).map(function(p){ return p.id; }) : (O.board||[]).map(function(b){ return b.staffId; }).filter(Boolean);
  return S.roster.filter(function(p){ return ids.indexOf(p.id)>-1; });
}
function teamOrgNoteHtml_(c){
  if(c!=='board') return '';
  return '<p class="hint" style="margin:0 0 12px">'+esc(t('Only board members who are also on staff show here.'))+'</p>';
}
/* Team → Directory → YWAM GP: every place on YWAM GP's leadership team and who holds it. */
function teamGpDirectoryHtml_(){
  var O=S.org, byId={};
  S.roster.forEach(function(p){ byId[p.id]=p; });
  var h='<h3>🌏 '+esc(t('YWAM GP Leadership Team'))+' <small>· '+O.gp.length+'</small></h3>';
  GP_ROLES.forEach(function(r){
    var who=O.gp.filter(function(p){ return p.gpRole===r[0]; });
    h+='<div class="deptBlock"><div class="deptHead">'+esc(gpRoleLabel_(r[0]))+'<span class="deptN">'+who.length+'</span></div>';
    if(!who.length){ h+='<div class="minLabel">'+esc(t('Not filled yet'))+'</div></div>'; return; }
    h+='<div class="dir">';
    who.forEach(function(g){
      var p=byId[g.id]||g;
      h+='<div class="dircard" data-person="'+esc(g.id)+'">'+avatarHtml(p)+
         '<div class="pname">'+esc(p.name)+'</div>'+
         '<div class="pmeta">'+esc(t(campusName(p.campus)))+'</div>'+(byId[g.id] ? ptChipHtml(p) : '')+'</div>';
    });
    h+='</div></div>';
  });
  return h;
}

/* ---------- the team map (Team tab → Strengths) ---------- */
/* Adds up the GP Strengths Top 5 of everyone on this campus who shares it. */
function teamStrengthsHtml_(campus){
  if(!gsOK()) return '<p class="sub">'+esc(t('Strengths could not load. Pull down to refresh.'))+'</p>';
  var people=teamPeopleIn_(campus).filter(function(p){ return p.gstrengths && p.gstrengths.length; });
  var orgNote=teamOrgNoteHtml_(campus);
  if(!people.length){
    if(teamOrgScope_(campus)) return '<div class="card"><p class="sub" style="margin:4px 0">'+esc(t('Nobody here has shared their strengths yet.'))+'</p></div>'+orgNote+gsFineHtml();
    return '<div class="card"><p class="sub" style="margin:4px 0">'+
      esc(t('Nobody here has found their strengths yet. Take the free test from My Home.'))+'</p></div>'+gsFineHtml();
  }
  var byId={}, byGroup={}, total=0;
  GP_GSGROUPS.forEach(function(g){ byGroup[g.id]=0; });
  people.forEach(function(p){
    p.gstrengths.slice(0,5).forEach(function(id){
      var g=gpGSGroup(id); if(!g) return;
      (byId[id]=byId[id]||[]).push(p);
      byGroup[g.id]++; total++;
    });
  });
  var h='<div class="card"><div class="pmeta" style="margin-bottom:8px">'+
    esc(gpT('{n} people have shared their Top 5',{n:people.length}))+'</div>';
  GP_GSGROUPS.forEach(function(g){
    var pct = total ? Math.round(byGroup[g.id]/total*100) : 0;
    h+='<div class="pBar"><div class="pBarTop"><span style="color:'+g.ink+';font-weight:800">'+esc(t(g.name))+'</span><span><b>'+pct+'%</b></span></div>'+
      '<div class="pTrack"><div class="pFill" style="left:0;width:'+pct+'%;background:'+g.color+'"></div></div></div>';
  });
  h+='<div class="hint">'+esc(t('Share of the team’s Top 5 strengths in each group.'))+'</div></div>'+orgNote;

  GP_GSGROUPS.forEach(function(g){
    var ids=GP_GS_IDS.filter(function(id){ return gpGSById(id).group===g.id; })
      .sort(function(a,b){ return (byId[b]||[]).length-(byId[a]||[]).length; });
    var had=ids.filter(function(id){ return byId[id]; });
    var none=ids.filter(function(id){ return !byId[id]; });
    h+='<h3 style="color:'+g.ink+'">'+esc(t(g.name))+'</h3><div class="card">'+
      '<div class="hint" style="margin:0 0 6px">'+esc(t(g.blurb))+'</div>';
    had.forEach(function(id){
      h+='<div class="sMapRow">'+gsChipHtml(id)+'<span class="sWho">'+
        byId[id].map(function(p){
          return '<button class="sWhoBtn" data-person="'+esc(p.id)+'">'+esc(firstName_(p.name))+'</button>';
        }).join('')+'</span></div>';
    });
    if(none.length) h+='<div class="hint" style="margin-top:6px">'+esc(t('Not in anyone’s Top 5 yet:'))+' '+
      esc(none.map(function(id){ return t(gpGSById(id).name); }).join(', '))+'</div>';
    h+='</div>';
  });
  return h+gsFineHtml();
}

/* ==================== Library ====================
   Five-minute reads of the books on Craig Groeschel's leadership lists, written
   for YWAM GP in our own words (public/library.js — GP_LIBRARY). Menu → Library.
   The books load only when the Library is opened (libLoad_), so they cost the
   app's start nothing; sw.js keeps a copy for offline reading.

   Laid out the way a book-summary app is: the home is rows you swipe sideways
   (Continue reading, Start here, one per shelf, each with See all), a book page
   with its cover on a tinted panel and Start reading, and a reader that goes one
   key idea per screen (intro, the ideas, a final summary) with a progress bar,
   Back/Next and swiping. Where you are in a book and the "Read" ticks are this
   phone's only (localStorage), nothing is sent anywhere. The summaries are
   English; the screens around them are translated like everything else. */
S.libBook=null; S.libShelf='all'; S.libStep=null; S.libLoading=false; S.libError=false; S.libKmLoading=false; S.libKmError=false;
var LIB_READ_KEY='gp-lib-read', LIB_PROG_KEY='gp-lib-progress';
/* Which language the summaries are read in: the app's own unless switched on a book
   page (remembered on this phone). Khmer lives in library-km.js, loaded only when
   it is wanted; until it is there — or if it cannot load — the English shows. */
/* The Library follows the app's language (Oct 2026, Uriah): Khmer app, Khmer
   Library — summaries, titles, authors and covers. No switch of its own. */
function libLang_(){ return LANG==='km' ? 'km' : 'en'; }
function libLoadKm_(){
  if(typeof GP_LIBRARY_KM!=='undefined' || S.libKmLoading) return;
  S.libKmLoading=true; S.libKmError=false;
  var sc=document.createElement('script');
  sc.src='library-km.js';
  sc.setAttribute('data-optional','');
  sc.onload=function(){ S.libKmLoading=false; if(S.view==='library') render(); };
  sc.onerror=function(){ S.libKmLoading=false; S.libKmError=true; sc.remove(); if(S.view==='library') render(); };
  document.head.appendChild(sc);
}
function libText_(b){
  var k=(libLang_()==='km' && typeof GP_LIBRARY_KM!=='undefined') ? GP_LIBRARY_KM[b.id] : null;
  if(!k) return { km:false, vibe:b.vibe, bigIdea:b.bigIdea, insights:b.insights, tryThis:b.tryThis, forUs:b.forUs, oneLine:b.oneLine };
  return { km:true, vibe:k.vibe, bigIdea:k.bigIdea, tryThis:k.tryThis, forUs:k.forUs, oneLine:k.oneLine,
    insights:b.insights.map(function(x, i){ var y=k.insights[i]||{}; return { emoji:x.emoji, title:y.title||x.title, body:y.body||x.body }; }) };
}
/* The name shown for a book: its Khmer name when reading in Khmer and one exists
   (the GP guides have one; published books keep their own English titles). */
function libTitle_(b){
  var k=(libLang_()==='km' && typeof GP_LIBRARY_KM!=='undefined') ? GP_LIBRARY_KM[b.id] : null;
  return (k && k.title) || b.title;
}
function libAuthor_(b){
  var k=(libLang_()==='km' && typeof GP_LIBRARY_KM!=='undefined') ? GP_LIBRARY_KM[b.id] : null;
  return (k && k.author) || b.author;
}
/* Shelves in the order the home shows them: the guides made at YWAM GP first. */
function libShelvesShown_(){ return GP_LIBRARY.shelves.filter(function(x){ return x.id==='gp'; }).concat(GP_LIBRARY.shelves.filter(function(x){ return x.id!=='gp'; })); }
/* In Khmer, the Khmer library is fetched the first time it's needed; until it
   arrives everything shows in English, and a failed fetch says so. */
function libKmEnsure_(){
  if(libLang_()!=='km') return '';
  if(typeof GP_LIBRARY_KM==='undefined' && !S.libKmError) libLoadKm_();
  return S.libKmError ? '<p class="hint libKmNote">'+esc(t('The library could not load. Check your connection and try again.'))+'</p>' : '';
}
function libLoad_(){
  if(typeof GP_LIBRARY!=='undefined' || S.libLoading) return;
  S.libLoading=true; S.libError=false;
  var sc=document.createElement('script');
  sc.src='library.js';
  sc.setAttribute('data-optional','');   // a failed load says so on the Library page — never the whole-app error screen
  sc.onload=function(){ S.libLoading=false; if(S.view==='library') render(); };
  sc.onerror=function(){ S.libLoading=false; S.libError=true; sc.remove(); if(S.view==='library') render(); };
  document.head.appendChild(sc);
}
function libStore_(key){
  if(S.stuPreview) return key===LIB_READ_KEY ? Object.assign({}, S.stuPreview.libRead) : {};   // an admin seeing a student's app: their reads, not yours
  try { return JSON.parse(localStorage.getItem(key)||'{}')||{}; } catch(e){ return {}; } }
function libSave_(key, v){ if(S.stuPreview) return; try { localStorage.setItem(key, JSON.stringify(v)); } catch(e){} }
function libRead_(){ return libStore_(LIB_READ_KEY); }
function libSetRead_(id, on){
  var r=libRead_(); if(on) r[id]=todayStr(); else delete r[id]; libSave_(LIB_READ_KEY, r);
  var p=libPending_(); p[id]=on ? todayStr() : null; libSave_(LIB_PENDING_KEY, p);   // and to your account (libPush_)
  libPush_();
}
function libProg_(){ return libStore_(LIB_PROG_KEY); }
function libSetProg_(id, step){ var p=libProg_(); if(step>0) p[id]=step; else delete p[id]; libSave_(LIB_PROG_KEY, p); }
function libShelf_(id){ return (GP_LIBRARY.shelves.filter(function(x){ return x.id===id; })[0]) || GP_LIBRARY.shelves[0]; }
function libById_(id){ return GP_LIBRARY.books.filter(function(x){ return x.id===id; })[0]; }
function libPicks_(){ return (GP_LIBRARY.startHere||[]).map(libById_).filter(Boolean); }
/* Covers are drawn here, not fetched: one series look for every book — the
   shelf's colour with a pattern on top, the title in Koulen on paper below —
   so they sit well together and show at once, offline too. The pattern is
   picked by the book's place on its shelf (neighbours never repeat) and nudged
   by a hash of its id, so every cover stays the same from day to day. */
function libHash_(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function libStar_(x, y, r){ return 'M'+x+','+(y-r)+'Q'+x+','+y+' '+(x+r)+','+y+'Q'+x+','+y+' '+x+','+(y+r)+'Q'+x+','+y+' '+(x-r)+','+y+'Q'+x+','+y+' '+x+','+(y-r)+'Z'; }
function libMotif_(b){
  var C=GP_LIBRARY.cover||{}, P=C.paper||'white', A=C.accent||'gold';
  var shelfIdx=GP_LIBRARY.shelves.map(function(x){ return x.id; }).indexOf(b.shelf);
  var onShelf=GP_LIBRARY.books.filter(function(x){ return x.shelf===b.shelf; }).indexOf(b);
  var seed=libHash_(b.id), rnd=function(){ seed=(Math.imul(seed,1103515245)+12345)>>>0; return (seed>>>8)/16777216; };
  var m=(onShelf+shelfIdx*3)%10, o='', k, x, y;
  var c=function(cx,cy,r,a){ return '<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+r.toFixed(1)+'" '+a+'/>'; };
  var ring='fill="none" stroke="'+P+'" stroke-opacity=".3" stroke-width="4"';
  if(m===0){ x=22+rnd()*56; y=22+rnd()*46; for(k=1;k<=6;k++) o+=c(x,y,k*11,ring); o+=c(x,y,6,'fill="'+A+'"'); }
  else if(m===1){ x=30+rnd()*40; o+=c(x,92,30,'fill="'+A+'"'); for(k=0;k<9;k++){ var an=Math.PI*(1+k/8); o+='<line x1="'+(x+Math.cos(an)*38).toFixed(1)+'" y1="'+(92+Math.sin(an)*38).toFixed(1)+'" x2="'+(x+Math.cos(an)*70).toFixed(1)+'" y2="'+(92+Math.sin(an)*70).toFixed(1)+'" stroke="'+P+'" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>'; } }
  else if(m===2){ var pick=Math.floor(rnd()*30); for(k=0;k<30;k++){ x=12+(k%6)*15.2; y=12+Math.floor(k/6)*16.5; o+= k===pick ? c(x,y,6.5,'fill="'+A+'"') : c(x,y,2.4,'fill="'+P+'" fill-opacity=".38"'); } }
  else if(m===3){ var hot=2+Math.floor(rnd()*8); o+='<g transform="rotate(-35 50 45)">'; for(k=-4;k<14;k++) o+='<rect x="'+(k*12-40)+'" y="-80" width="5" height="250" fill="'+(k===hot?A:P)+'"'+(k===hot?'':' fill-opacity=".2"')+'/>'; o+='</g>'; }
  else if(m===4){ x=rnd()<.5?0:100; var hotA=1+Math.floor(rnd()*5); for(k=1;k<=8;k++) o+=c(x,90,k*13,'fill="none" stroke="'+(k===hotA?A:P)+'"'+(k===hotA?'':' stroke-opacity=".32"')+' stroke-width="5"'); }
  else if(m===5){ x=40+rnd()*20; o+='<path d="'+libStar_(x,46,30)+'" fill="'+A+'"/><path d="'+libStar_(x>50?20:80,18,9)+'" fill="'+P+'" fill-opacity=".7"/><path d="'+libStar_(x>50?84:16,72,6)+'" fill="'+P+'" fill-opacity=".45"/>'; }
  else if(m===6){ y=40+rnd()*10; o+=c(36,y,25,'fill="'+P+'" fill-opacity=".2"')+c(64,y,25,'fill="'+P+'" fill-opacity=".2"')+c(50,y+22,25,'fill="'+P+'" fill-opacity=".14"')+c(50,y+8,6,'fill="'+A+'"'); }
  else if(m===7){ x=18+rnd()*20; o+=c(x,24,9,'fill="'+A+'"')+'<polygon points="-5,92 34,36 74,92" fill="'+P+'" fill-opacity=".22"/><polygon points="34,92 72,24 108,74 108,92" fill="'+P+'" fill-opacity=".34"/>'; }
  else if(m===8){ o+='<path d="M-2,92V74H18V60H38V46H58V32H78V18H102V92Z" fill="'+P+'" fill-opacity=".24"/>'+c(90,9,6,'fill="'+A+'"'); }
  else { var hotW=Math.floor(rnd()*5); for(k=0;k<5;k++){ y=16+k*15; o+='<path d="M-5,'+y+' C20,'+(y-12)+' 30,'+(y+12)+' 50,'+y+' S80,'+(y-12)+' 105,'+y+'" fill="none" stroke="'+(k===hotW?A:P)+'"'+(k===hotW?'':' stroke-opacity=".34"')+' stroke-width="3.5" stroke-linecap="round"/>'; } }
  return '<svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+o+'</svg>';
}
/* Book covers that nod to each book's own (Oct 2026, Uriah: "like Blinkist —
   somewhat match the original designs, but animated and in the app's colours").
   Each book in library.js has a `cover` — background, title and accent colours
   from the app's palette (GP_LIBRARY.palette), a layout (title at the top or the
   bottom), a type style, and a motif: the one idea its real cover is known for —
   Start with Why's circle, Made to Stick's tape, The Tipping Point's match —
   drawn here as our own simple shapes, never the publisher's art. Motifs live in
   a 100×100 box placed under or over the title. Their moving parts carry cv*
   classes; they move only while the cover is on screen (libLiveCovers_), and
   not at all for someone whose phone asks for less motion. */
function cvA_(cls, extra){ return ' class="cvA '+cls+'"'+(extra?' style="'+extra+'"':''); }
var LIB_MOTIFS={
  rings:function(c){ return '<circle cx="50" cy="50" r="44" fill="none" stroke="'+c.b+'" stroke-width="5"/>'+
    '<circle cx="50" cy="50" r="29" fill="none" stroke="'+c.a+'" stroke-width="7"'+cvA_('cvPulse','animation-delay:-.6s')+'/>'+
    '<circle cx="50" cy="50" r="13" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'; },
  dotsgrow:function(c){ var o=''; for(var i=0;i<7;i++) for(var j=0;j<7;j++){ var k=i+j, r=0.9+k*0.42, hot=(i===5&&j===5);
      o+='<circle cx="'+(8+j*14)+'" cy="'+(8+i*14)+'" r="'+r.toFixed(2)+'" fill="'+(hot?c.a:c.fg)+'"'+(hot?'':' fill-opacity="'+(0.18+k*0.05).toFixed(2)+'"')+cvA_('cvGrow','animation-delay:'+(k*0.12).toFixed(2)+'s')+'/>'; } return o; },
  flywheel:function(c){ var o='<g'+cvA_('cvSpin')+'><circle cx="50" cy="50" r="40" fill="none" stroke="'+c.a+'" stroke-width="7"/>';
    for(var k=0;k<8;k++){ var an=k*Math.PI/4; o+='<line x1="50" y1="50" x2="'+(50+Math.cos(an)*38).toFixed(1)+'" y2="'+(50+Math.sin(an)*38).toFixed(1)+'" stroke="'+c.a+'" stroke-width="3"/>'; }
    return o+'</g><circle cx="50" cy="50" r="8" fill="'+c.b+'"/>'; },
  split:function(c){ return '<path d="M47 8 A42 42 0 0 0 47 92 Z" fill="'+c.fg+'"'+cvA_('cvNudgeL')+'/><path d="M53 8 A42 42 0 0 1 53 92 Z" fill="'+c.a+'"'+cvA_('cvNudgeR')+'/>'; },
  curve:function(c){ return '<path d="M4 88 C 22 86, 28 20, 50 18 S 78 70, 96 66" fill="none" stroke="'+c.b+'" stroke-width="3" stroke-opacity=".45"/>'+
    '<path d="M4 88 C 22 86, 28 20, 50 18 S 78 70, 96 66" fill="none" stroke="'+c.a+'" stroke-width="5" stroke-linecap="round" pathLength="100"'+cvA_('cvDraw')+'/>'+
    '<circle cx="50" cy="18" r="6" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'; },
  four:function(c){ var cols=[c.a, c.b, c.c, c.d]; return [[8,8],[54,8],[8,54],[54,54]].map(function(p,i){
    return '<rect x="'+p[0]+'" y="'+p[1]+'" width="38" height="38" rx="7" fill="'+cols[i]+'"'+(i===0?cvA_('cvPulse'):'')+'/>'; }).join(''); },
  tablets:function(c){ var t=function(x){ return '<path d="M'+x+' 92 V30 a17 17 0 0 1 34 0 V92 Z" fill="'+c.a+'"/>'+[44,56,68,80].map(function(y){ return '<line x1="'+(x+7)+'" y1="'+y+'" x2="'+(x+27)+'" y2="'+y+'" stroke="'+c.bg+'" stroke-width="2.4" stroke-opacity=".5"/>'; }).join(''); };
    return t(12)+t(54)+'<circle cx="50" cy="12" r="5" fill="'+c.fg+'"'+cvA_('cvPulse')+'/>'; },
  gears:function(c){ var g=function(cx,cy,r,n,col,cls){ var o='<g'+cvA_(cls)+'><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+col+'"/>';
      for(var k=0;k<n;k++){ var an=k*2*Math.PI/n; o+='<rect x="'+(cx-4)+'" y="'+(cy-r-7)+'" width="8" height="10" rx="1.5" fill="'+col+'" transform="rotate('+(an*180/Math.PI).toFixed(1)+' '+cx+' '+cy+')"/>'; }
      return o+'<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.35).toFixed(1)+'" fill="'+c.bg+'"/></g>'; };
    return g(36,40,22,9,c.a,'cvSpin')+g(70,70,16,7,c.b,'cvSpinR'); },
  match:function(c){ return '<rect x="47" y="34" width="6" height="62" rx="2" fill="'+c.b+'"/><ellipse cx="50" cy="34" rx="6" ry="8" fill="'+c.fg+'"/>'+
    '<path d="M50 4 C 60 16, 60 24, 50 30 C 40 24, 40 16, 50 4 Z" fill="'+c.a+'"'+cvA_('cvFlick')+'/>'; },
  bignum:function(c, b){ return '<text x="50" y="84" text-anchor="middle" font-family="Koulen, Impact, sans-serif" font-size="92" fill="'+c.a+'"'+cvA_('cvPulse')+'>'+esc(b.cover.text||'')+'</text>'; },
  smile:function(c){ return '<circle cx="50" cy="50" r="40" fill="'+c.a+'"/><circle cx="36" cy="42" r="5" fill="'+c.fg+'"'+cvA_('cvBlink')+'/><circle cx="64" cy="42" r="5" fill="'+c.fg+'"'+cvA_('cvBlink')+'/>'+
    '<path d="M30 58 Q50 78 70 58" fill="none" stroke="'+c.fg+'" stroke-width="5" stroke-linecap="round"/>'; },
  chevrons:function(c){ return [70,48,26].map(function(y,i){ return '<path d="M14 '+(y+16)+' L50 '+y+' L86 '+(y+16)+'" fill="none" stroke="'+(i===2?c.a:c.b)+'" stroke-width="9" stroke-linejoin="round"'+cvA_('cvRise','animation-delay:'+(i*0.3)+'s')+'/>'; }).join(''); },
  bubbles:function(c){ return '<path d="M8 14 h56 a8 8 0 0 1 8 8 v24 a8 8 0 0 1 -8 8 h-38 l-12 10 v-10 h-6 a8 8 0 0 1 -8 -8 v-24 a8 8 0 0 1 8 -8z" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'+
    '<path d="M36 48 h48 a8 8 0 0 1 8 8 v22 a8 8 0 0 1 -8 8 h-4 v10 l-12 -10 h-32 a8 8 0 0 1 -8 -8 v-22 a8 8 0 0 1 8 -8z" fill="'+c.b+'"'+cvA_('cvPulse','animation-delay:-1.6s')+'/>'; },
  pyramid:function(c){ var o='', cols=[c.a,c.b,c.a,c.b,c.a]; for(var i=0;i<5;i++){ var y=10+i*17, w1=10+i*16, w2=w1+16;
      o+='<path d="M'+(50-w1/2)+' '+y+' H'+(50+w1/2)+' L'+(50+w2/2)+' '+(y+15)+' H'+(50-w2/2)+' Z" fill="'+cols[i]+'" fill-opacity="'+(1-i*0.12).toFixed(2)+'"'+cvA_('cvGrow','animation-delay:'+(i*0.18)+'s')+'/>'; } return o; },
  pulse:function(c){ return '<path d="M50 88 C 18 66, 6 48, 10 32 C 14 14, 38 12, 50 30 C 62 12, 86 14, 90 32 C 94 48, 82 66, 50 88 Z" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'+
    '<path d="M8 52 H30 L38 36 L48 66 L56 44 L62 52 H92" fill="none" stroke="'+c.fg+'" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" pathLength="100"'+cvA_('cvDraw')+'/>'; },
  circlesafety:function(c){ var o='<circle cx="50" cy="50" r="36" fill="none" stroke="'+c.a+'" stroke-width="4" stroke-dasharray="3 5"/><g'+cvA_('cvSpin')+'>';
    for(var k=0;k<8;k++){ var an=k*Math.PI/4; o+='<circle cx="'+(50+Math.cos(an)*36).toFixed(1)+'" cy="'+(50+Math.sin(an)*36).toFixed(1)+'" r="6" fill="'+c.a+'"/>'; }
    return o+'</g><circle cx="50" cy="50" r="12" fill="'+c.b+'"/>'; },
  lean:function(c){ return '<g'+cvA_('cvSway','transform-origin:50% 100%')+'><rect x="40" y="30" width="20" height="64" rx="10" fill="'+c.a+'" transform="rotate(14 50 94)"/><circle cx="62" cy="20" r="11" fill="'+c.a+'"/></g>'+
    '<rect x="6" y="94" width="88" height="4" rx="2" fill="'+c.fg+'" fill-opacity=".35"/>'; },
  fence:function(c){ var o=''; [6,22,66,82].forEach(function(x){ o+='<path d="M'+x+' 92 V34 L'+(x+6)+' 26 L'+(x+12)+' 34 V92 Z" fill="'+c.a+'"/>'; });
    o+='<rect x="4" y="46" width="92" height="6" fill="'+c.a+'"/><rect x="4" y="74" width="92" height="6" fill="'+c.a+'"/>';
    return o+'<g'+cvA_('cvGate','transform-origin:0% 50%')+'><rect x="38" y="38" width="24" height="52" rx="3" fill="none" stroke="'+c.b+'" stroke-width="5"/></g>'; },
  spark:function(c){ var o='<g'+cvA_('cvSpin','animation-duration:24s')+'>'; for(var k=0;k<12;k++){ var an=k*Math.PI/6, r1=k%2?18:22, r2=k%2?36:46;
      o+='<line x1="'+(50+Math.cos(an)*r1).toFixed(1)+'" y1="'+(50+Math.sin(an)*r1).toFixed(1)+'" x2="'+(50+Math.cos(an)*r2).toFixed(1)+'" y2="'+(50+Math.sin(an)*r2).toFixed(1)+'" stroke="'+(k%2?c.b:c.a)+'" stroke-width="5" stroke-linecap="round"/>'; }
    return o+'</g><circle cx="50" cy="50" r="11" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'; },
  arrowup:function(c){ return '<path d="M50 6 L90 50 H66 V94 H34 V50 H10 Z" fill="'+c.a+'"'+cvA_('cvBob')+'/>'+
    [62,74,86].map(function(y){ return '<line x1="34" y1="'+y+'" x2="66" y2="'+y+'" stroke="'+c.bg+'" stroke-width="3"/>'; }).join(''); },
  multiply:function(c){ var o='', rows=[[50],[26,50,74],[10,22,34,46,58,70,82,90]]; rows[2]=[8,19,30,41,52,63,74,85,96].slice(0,9);
    rows.forEach(function(row,i){ row.forEach(function(x,j){ o+='<circle cx="'+x+'" cy="'+(18+i*32)+'" r="'+(12-i*3.5)+'" fill="'+(i===0?c.a:c.b)+'"'+cvA_('cvGrow','animation-delay:'+(i*0.35+j*0.05).toFixed(2)+'s')+'/>'; }); });
    return o; },
  venn3:function(c){ return '<g'+cvA_('cvSpin','animation-duration:30s')+'><circle cx="50" cy="34" r="26" fill="'+c.a+'" fill-opacity=".85"/><circle cx="34" cy="62" r="26" fill="'+c.b+'" fill-opacity=".8"/><circle cx="66" cy="62" r="26" fill="'+c.c+'" fill-opacity=".8"/></g>'; },
  fork:function(c){ return '<path d="M50 96 V56 C 50 40, 26 36, 18 10" fill="none" stroke="'+c.b+'" stroke-width="7" stroke-linecap="round"/>'+
    '<path d="M50 96 V56 C 50 40, 74 36, 82 10" fill="none" stroke="'+c.a+'" stroke-width="7" stroke-linecap="round" pathLength="100"'+cvA_('cvDraw')+'/><circle cx="82" cy="10" r="7" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'; },
  rise:function(c){ return [20,50,80].map(function(x,i){ var h=34+i*20, y=96-h; return '<g'+cvA_('cvRise','animation-delay:'+(i*0.4)+'s')+'><path d="M'+x+' '+y+' L'+(x+14)+' '+(y+16)+' H'+(x+6)+' V96 H'+(x-6)+' V'+(y+16)+' H'+(x-14)+' Z" fill="'+(i===2?c.a:c.b)+'"/></g>'; }).join(''); },
  checklist:function(c){ return [16,48,80].map(function(y,i){ return '<rect x="8" y="'+(y-11)+'" width="22" height="22" rx="5" fill="none" stroke="'+c.b+'" stroke-width="4"/>'+
    '<path d="M12 '+y+' l5 6 l10 -12" fill="none" stroke="'+c.a+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" pathLength="100"'+cvA_('cvDraw','animation-delay:'+(i*0.5)+'s')+'/>'+
    '<rect x="38" y="'+(y-4)+'" width="'+(54-i*10)+'" height="8" rx="4" fill="'+c.b+'" fill-opacity=".5"/>'; }).join(''); },
  mountain:function(c){ return '<path d="M4 94 L40 30 L56 56 L68 40 L96 94 Z" fill="'+c.a+'"/><path d="M40 30 L48 44 L40 40 L33 43 Z" fill="'+c.bg+'" fill-opacity=".7"/>'+
    '<line x1="40" y1="30" x2="40" y2="8" stroke="'+c.fg+'" stroke-width="2.5"/><path d="M40 8 L56 13 L40 19 Z" fill="'+c.b+'"'+cvA_('cvWave','transform-origin:0% 50%')+'/>'; },
  sprout:function(c){ return '<path d="M30 96 V74 C 18 70, 14 56, 18 44 C 22 26, 40 16, 58 18 C 76 20, 86 34, 84 50 C 82 58, 86 62, 90 68 L80 70 V84 L66 86 V96 Z" fill="'+c.b+'"/>'+
    '<g'+cvA_('cvGrowUp','transform-origin:50% 100%')+'><line x1="56" y1="44" x2="56" y2="18" stroke="'+c.a+'" stroke-width="4"/><path d="M56 26 C 44 24, 40 14, 42 8 C 50 8, 56 16, 56 26 Z" fill="'+c.a+'"/><path d="M56 22 C 66 18, 72 8, 70 2 C 62 2, 56 10, 56 22 Z" fill="'+c.a+'"/></g>'; },
  coins:function(c){ var o=''; for(var i=0;i<5;i++) o+='<ellipse cx="40" cy="'+(88-i*10)+'" rx="26" ry="8" fill="'+c.a+'" stroke="'+c.bg+'" stroke-width="2"/>';
    return o+'<g'+cvA_('cvDrop')+'><ellipse cx="74" cy="22" rx="16" ry="16" fill="'+c.a+'"/><text x="74" y="29" text-anchor="middle" font-size="20" font-weight="900" fill="'+c.bg+'" font-family="Arial, sans-serif">$</text></g>'; },
  apple:function(c){ return '<path d="M50 26 C 36 14, 10 20, 12 50 C 14 78, 34 96, 50 88 C 66 96, 86 78, 88 50 C 90 20, 64 14, 50 26 Z" fill="'+c.b+'"/>'+
    '<path d="M50 26 L50 88 C 66 96, 86 78, 88 50 C 90 20, 64 14, 50 26 Z" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'+
    [40,52,64,76].map(function(y){ return '<line x1="52" y1="'+y+'" x2="'+(80-Math.abs(58-y)*0.5).toFixed(0)+'" y2="'+(y-4)+'" stroke="'+c.bg+'" stroke-width="1.6" stroke-opacity=".7"/>'; }).join('')+
    '<path d="M50 26 C 50 18, 54 10, 60 6" fill="none" stroke="'+c.fg+'" stroke-width="3"/>'; },
  basin:function(c){ return '<path d="M12 50 H88 C 86 76, 70 90, 50 90 C 30 90, 14 76, 12 50 Z" fill="'+c.a+'"/>'+
    '<ellipse cx="50" cy="50" rx="38" ry="7" fill="'+c.b+'"/><ellipse cx="50" cy="50" rx="18" ry="3.5" fill="none" stroke="'+c.a+'" stroke-width="1.5"'+cvA_('cvRipple')+'/>'+
    '<path d="M62 8 C 62 22, 78 22, 78 36 C 78 44, 70 46, 66 42" fill="none" stroke="'+c.a+'" stroke-width="6" stroke-linecap="round" stroke-opacity=".7"/>'+
    '<circle cx="50" cy="30" r="3" fill="'+c.b+'"'+cvA_('cvDrip')+'/>'; },
  hammock:function(c){ var palm=function(x, lean){ var tx=x+lean; return '<path d="M'+x+' 96 Q'+(x+lean*0.2)+' 60 '+tx+' 30" fill="none" stroke="'+c.b+'" stroke-width="5" stroke-linecap="round"/>'+
      [-150,-100,-50,-10,30].map(function(r){ return '<ellipse cx="'+tx+'" cy="30" rx="16" ry="4.5" fill="'+c.b+'" transform="rotate('+r+' '+tx+' 30) translate(14 0)"/>'; }).join(''); };
    return '<circle cx="50" cy="18" r="11" fill="'+c.a+'"'+cvA_('cvPulse')+'/>'+palm(10,6)+palm(90,-6)+
      '<g'+cvA_('cvSway','transform-origin:50% 0%')+'><path d="M15 56 C 32 80, 68 80, 85 56" fill="'+c.a+'" fill-opacity=".9" stroke="'+c.a+'" stroke-width="3"/></g>'+
      '<path d="M0 94 Q12 90 24 94 T48 94 T72 94 T100 94" fill="none" stroke="'+c.b+'" stroke-width="2.5" stroke-opacity=".6"/>'; },
  compass:function(c){ var o='<circle cx="50" cy="50" r="42" fill="none" stroke="'+c.a+'" stroke-width="5"/>';
    for(var k=0;k<4;k++) o+='<line x1="50" y1="12" x2="50" y2="20" stroke="'+c.a+'" stroke-width="4" transform="rotate('+(k*90)+' 50 50)"/>';
    return o+'<g'+cvA_('cvSwing')+'><path d="M50 16 L58 50 L50 84 L42 50 Z" fill="'+c.b+'"/><path d="M50 16 L58 50 H42 Z" fill="'+c.a+'"/></g><circle cx="50" cy="50" r="4" fill="'+c.bg+'"/>'; },
  expo:function(c){ var o=''; for(var i=0;i<8;i++){ var h=6+Math.pow(1.48,i)*3.2; o+='<rect x="'+(6+i*11.5)+'" y="'+(94-h).toFixed(1)+'" width="8" height="'+h.toFixed(1)+'" rx="2" fill="'+(i===7?c.a:c.b)+'"'+cvA_('cvGrowUp','transform-origin:50% 100%;animation-delay:'+(i*0.12).toFixed(2)+'s')+'/>'; }
    return o+'<path d="M8 90 C 50 88, 76 70, 92 10" fill="none" stroke="'+c.a+'" stroke-width="3" stroke-dasharray="4 4"/>'; },
  loop:function(c){ var arc=function(a0,a1,col){ var r=36, x0=50+r*Math.cos(a0), y0=50+r*Math.sin(a0), x1=50+r*Math.cos(a1), y1=50+r*Math.sin(a1);
      return '<path d="M'+x0.toFixed(1)+' '+y0.toFixed(1)+' A'+r+' '+r+' 0 0 1 '+x1.toFixed(1)+' '+y1.toFixed(1)+'" fill="none" stroke="'+col+'" stroke-width="10" stroke-linecap="round"/>'+
        '<circle cx="'+x1.toFixed(1)+'" cy="'+y1.toFixed(1)+'" r="8" fill="'+col+'"/>'; };
    return '<g'+cvA_('cvSpin','animation-duration:18s')+'>'+arc(-1.4,0.5,c.a)+arc(0.75,2.65,c.b)+arc(2.9,4.6,c.c)+'</g>'; },
  depth:function(c){ var o=''; for(var i=0;i<6;i++){ var w=88-i*14; o+='<rect x="'+(50-w/2)+'" y="'+(8+i*14)+'" width="'+w+'" height="6" rx="3" fill="'+c.b+'" fill-opacity="'+(0.25+i*0.13).toFixed(2)+'"/>'; }
    return o+'<circle cx="50" cy="92" r="6" fill="'+c.a+'"'+cvA_('cvSink')+'/>'; },
  cointree:function(c){ return '<ellipse cx="50" cy="86" rx="30" ry="9" fill="'+c.b+'"/><ellipse cx="50" cy="80" rx="30" ry="9" fill="'+c.a+'"/>'+
    '<g'+cvA_('cvGrowUp','transform-origin:50% 100%')+'><path d="M50 78 V30" stroke="'+c.b+'" stroke-width="5"/><circle cx="50" cy="24" r="18" fill="'+c.c+'"/><circle cx="34" cy="38" r="12" fill="'+c.c+'"/><circle cx="66" cy="38" r="12" fill="'+c.c+'"/></g>'; },
  tape:function(c){ return '<g'+cvA_('cvWobble')+'><rect x="-10" y="34" width="120" height="32" fill="'+c.a+'" transform="rotate(-12 50 50)"/>'+
    '<path d="M-10 34 l4 4 l-4 4 l4 4 l-4 4 l4 4 l-4 4 l4 4 l-4 4" fill="none" stroke="'+c.bg+'" stroke-width="1.5" transform="rotate(-12 50 50)"/>'+
    '<line x1="-6" y1="44" x2="106" y2="44" stroke="'+c.bg+'" stroke-opacity=".25" stroke-width="1" transform="rotate(-12 50 50)"/></g>'; },
  cow:function(c){ return '<g'+cvA_('cvBob')+'><rect x="18" y="38" width="58" height="30" rx="14" fill="'+c.a+'"/>'+
    '<rect x="22" y="62" width="7" height="24" rx="3" fill="'+c.a+'"/><rect x="36" y="62" width="7" height="24" rx="3" fill="'+c.a+'"/><rect x="56" y="62" width="7" height="24" rx="3" fill="'+c.a+'"/><rect x="66" y="62" width="7" height="24" rx="3" fill="'+c.a+'"/>'+
    '<ellipse cx="80" cy="36" rx="13" ry="10" fill="'+c.a+'"/><ellipse cx="87" cy="40" rx="7" ry="5" fill="'+c.b+'"/><path d="M73 28 l-4 -8 M85 28 l4 -8" stroke="'+c.a+'" stroke-width="3" stroke-linecap="round"/>'+
    '<circle cx="78" cy="33" r="1.8" fill="'+c.fg+'"/><ellipse cx="36" cy="48" rx="8" ry="6" fill="'+c.b+'"/><ellipse cx="58" cy="54" rx="6" ry="5" fill="'+c.b+'"/>'+
    '<path d="M18 46 C 10 46, 8 56, 6 62" fill="none" stroke="'+c.a+'" stroke-width="3" stroke-linecap="round"/></g>'; },
  switchon:function(c){ return '<rect x="10" y="36" width="80" height="34" rx="17" fill="'+c.b+'"/><g'+cvA_('cvToggle')+'><circle cx="73" cy="53" r="13" fill="'+c.a+'"/></g>'+
    [0,1,2,3,4].map(function(k){ var an=-Math.PI*(0.15+k*0.17); return '<line x1="'+(73+Math.cos(an)*20).toFixed(1)+'" y1="'+(53+Math.sin(an)*20).toFixed(1)+'" x2="'+(73+Math.cos(an)*28).toFixed(1)+'" y2="'+(53+Math.sin(an)*28).toFixed(1)+'" stroke="'+c.a+'" stroke-width="3" stroke-linecap="round"'+cvA_('cvBlink','animation-delay:'+(k*0.1)+'s')+'/>'; }).join(''); },
  map:function(c){ return '<path d="M10 90 C 30 90, 20 64, 40 62 S 70 70, 68 46 S 50 22, 80 14" fill="none" stroke="'+c.b+'" stroke-width="4" stroke-dasharray="2 7" stroke-linecap="round"/>'+
    '<path d="M10 90 C 30 90, 20 64, 40 62 S 70 70, 68 46 S 50 22, 80 14" fill="none" stroke="'+c.a+'" stroke-width="4" stroke-linecap="round" pathLength="100"'+cvA_('cvDraw')+'/>'+
    '<path d="M74 8 L86 20 M86 8 L74 20" stroke="'+c.a+'" stroke-width="5" stroke-linecap="round"/><circle cx="10" cy="90" r="6" fill="'+c.fg+'"/>'; },
  brush:function(c){ return '<path d="M8 70 C 24 40, 40 76, 56 46 S 84 30, 94 22" fill="none" stroke="'+c.a+'" stroke-width="14" stroke-linecap="round" pathLength="100"'+cvA_('cvDraw')+'/>'+
    '<path d="M50 10 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill="'+c.b+'"'+cvA_('cvPulse')+'/>'; },
  steps:function(c){ return '<path d="M6 94 V78 H26 V62 H46 V46 H66 V30 H86 V94 Z" fill="'+c.b+'"/><g'+cvA_('cvBob')+'><circle cx="76" cy="10" r="7" fill="'+c.a+'"/><rect x="71" y="17" width="10" height="13" rx="4" fill="'+c.a+'"/></g>'; },
  brokenline:function(c){ return '<g'+cvA_('cvTiltL','transform-origin:100% 50%')+'><rect x="4" y="44" width="40" height="12" rx="3" fill="'+c.a+'"/>'+[12,22,32].map(function(x){ return '<line x1="'+x+'" y1="44" x2="'+x+'" y2="50" stroke="'+c.bg+'" stroke-width="2"/>'; }).join('')+'</g>'+
    '<g'+cvA_('cvTiltR','transform-origin:0% 50%')+'><rect x="56" y="44" width="40" height="12" rx="3" fill="'+c.a+'"/>'+[64,74,84].map(function(x){ return '<line x1="'+x+'" y1="44" x2="'+x+'" y2="50" stroke="'+c.bg+'" stroke-width="2"/>'; }).join('')+'</g>'+
    '<path d="M50 30 l2 8 M50 70 l-2 -8 M42 34 l4 6 M58 66 l-4 -6" stroke="'+c.b+'" stroke-width="3" stroke-linecap="round"'+cvA_('cvBlink')+'/>'; },
  bridge:function(c){ return '<path d="M4 70 Q50 10 96 70" fill="none" stroke="'+c.a+'" stroke-width="7"/><rect x="4" y="68" width="92" height="7" fill="'+c.a+'"/>'+
    [20,35,50,65,80].map(function(x){ var y=70-((1-Math.pow((x-50)/46,2))*60*0.5); return '<line x1="'+x+'" y1="'+y.toFixed(1)+'" x2="'+x+'" y2="68" stroke="'+c.a+'" stroke-width="2.5"/>'; }).join('')+
    '<g'+cvA_('cvMeetL')+'><circle cx="36" cy="54" r="5" fill="'+c.b+'"/><rect x="32" y="59" width="8" height="9" rx="3" fill="'+c.b+'"/></g>'+
    '<g'+cvA_('cvMeetR')+'><circle cx="64" cy="54" r="5" fill="'+c.fg+'"/><rect x="60" y="59" width="8" height="9" rx="3" fill="'+c.fg+'"/></g>'+
    '<path d="M0 86 Q12 82 24 86 T48 86 T72 86 T100 86" fill="none" stroke="'+c.a+'" stroke-width="2.5" stroke-opacity=".5"/>'; },
  angkor:function(c){ var tower=function(x,w,h){ return '<path d="M'+(x-w/2)+' 82 V'+(82-h*0.45)+' Q'+x+' '+(82-h*1.15)+' '+(x+w/2)+' '+(82-h*0.45)+' V82 Z" fill="'+c.b+'"/>'; };
    return '<circle cx="50" cy="40" r="20" fill="'+c.a+'"'+cvA_('cvSunrise')+'/>'+tower(18,12,34)+tower(34,14,44)+tower(50,18,62)+tower(66,14,44)+tower(82,12,34)+
      '<rect x="4" y="80" width="92" height="8" fill="'+c.b+'"/><rect x="0" y="88" width="100" height="10" fill="'+c.b+'" fill-opacity=".45"/>'; },
  /* YWAM classics (Oct 2026) */
  waves:function(c){ var o='<path d="M8 40 C 14 22, 36 20, 40 34 S 30 58, 18 56 S 4 52, 8 40 Z" fill="'+c.b+'" fill-opacity=".3"/><path d="M56 22 C 70 14, 92 22, 90 40 S 76 62, 64 56 S 46 30, 56 22 Z" fill="'+c.b+'" fill-opacity=".3"/>';
    for(var k=0;k<3;k++){ var y=62+k*12; o+='<path d="M-6 '+y+' Q 6 '+(y-9)+' 18 '+y+' T 42 '+y+' T 66 '+y+' T 90 '+y+' T 114 '+y+'" fill="none" stroke="'+c.a+'" stroke-width="'+(6-k*1.5)+'" stroke-linecap="round"'+(k===1?' stroke-opacity=".7"':k===2?' stroke-opacity=".45"':'')+cvA_(k%2?'cvNudgeL':'cvNudgeR','animation-delay:-'+(k*0.8)+'s')+'/>'; }
    return o; },
  edge:function(c){ return '<path d="M-2 98 V54 H38 L42 98 Z" fill="'+c.b+'"/><path d="M66 98 L70 64 H102 V98 Z" fill="'+c.b+'" fill-opacity=".55"/>'+
    '<path d="M36 44 Q 54 14 76 52" fill="none" stroke="'+c.a+'" stroke-width="3" stroke-dasharray="3 6" stroke-linecap="round"/>'+
    '<g'+cvA_('cvBob')+'><circle cx="28" cy="34" r="6" fill="'+c.a+'"/><rect x="23" y="41" width="10" height="13" rx="4" fill="'+c.a+'"/></g>'+
    '<circle cx="84" cy="18" r="9" fill="'+c.a+'" fill-opacity=".5"'+cvA_('cvPulse')+'/>'; },
  crown:function(c){ return '<g'+cvA_('cvBob')+'><path d="M24 54 L28 22 L40 38 L50 16 L60 38 L72 22 L76 54 Z" fill="'+c.a+'"/><rect x="24" y="54" width="52" height="8" rx="2" fill="'+c.a+'"/>'+
    '<circle cx="50" cy="44" r="4" fill="'+c.b+'"/></g>'+
    '<path d="M8 74 Q 26 96 48 80 M92 74 Q 74 96 52 80" fill="none" stroke="'+c.b+'" stroke-width="6" stroke-linecap="round"/>'; },
  openbook:function(c){ var o=''; for(var k=0;k<7;k++){ var an=Math.PI*(0.15+k*0.7/6); o+='<line x1="'+(50-Math.cos(an)*20).toFixed(1)+'" y1="'+(46-Math.sin(an)*20).toFixed(1)+'" x2="'+(50-Math.cos(an)*42).toFixed(1)+'" y2="'+(46-Math.sin(an)*42).toFixed(1)+'" stroke="'+c.a+'" stroke-width="4" stroke-linecap="round"/>'; }
    return '<g'+cvA_('cvPulse')+'>'+o+'</g><path d="M50 58 Q 30 48 8 52 V88 Q 30 84 50 94 Z" fill="'+c.b+'"/><path d="M50 58 Q 70 48 92 52 V88 Q 70 84 50 94 Z" fill="'+c.b+'" fill-opacity=".8"/>'+
      '<path d="M16 62 Q 30 60 42 66 M16 72 Q 30 70 42 76 M58 66 Q 70 60 84 62 M58 76 Q 70 70 84 72" stroke="'+c.bg+'" stroke-width="2" fill="none"/>'; },
  flame:function(c){ return '<circle cx="50" cy="58" r="38" fill="'+c.a+'" fill-opacity=".14"'+cvA_('cvPulse')+'/>'+
    '<g'+cvA_('cvFlick')+'><path d="M50 10 C 64 30, 76 42, 76 62 C 76 78, 64 90, 50 90 C 36 90, 24 78, 24 62 C 24 46, 38 38, 50 10 Z" fill="'+c.a+'"/>'+
    '<path d="M50 46 C 58 58, 64 64, 64 74 C 64 82, 58 88, 50 88 C 42 88, 36 82, 36 74 C 36 64, 44 60, 50 46 Z" fill="'+c.b+'"/></g>'; },
  incense:function(c){ var o=''; for(var k=0;k<3;k++){ var x=34+k*16; o+='<path d="M'+x+' 62 C '+(x-8)+' 50, '+(x+8)+' 40, '+x+' 28 S '+(x-6)+' 12, '+(x+2)+' 4" fill="none" stroke="'+c.a+'" stroke-width="4" stroke-linecap="round"'+(k===1?'':' stroke-opacity=".6"')+cvA_('cvRise','animation-delay:-'+(k*0.9)+'s')+'/>'; }
    return o+'<path d="M18 66 H82 Q 80 90 50 92 Q 20 90 18 66 Z" fill="'+c.b+'"/><rect x="40" y="90" width="20" height="6" rx="2" fill="'+c.b+'"/>'; },
  heart:function(c){ var h=function(x,y,r){ return 'M'+x+' '+(y+r*0.9)+' C '+(x-r*1.6)+' '+(y-r*0.2)+', '+(x-r*0.9)+' '+(y-r*1.4)+', '+x+' '+(y-r*0.55)+' C '+(x+r*0.9)+' '+(y-r*1.4)+', '+(x+r*1.6)+' '+(y-r*0.2)+', '+x+' '+(y+r*0.9)+' Z'; };
    return '<path d="'+h(50,52,34)+'" fill="'+c.a+'"'+cvA_('cvPulse')+'/><path d="'+h(50,56,12)+'" fill="'+c.b+'"/>'; },
  shield:function(c){ return '<g'+cvA_('cvSway')+'><path d="M50 8 L84 20 V48 C 84 70, 68 84, 50 92 C 32 84, 16 70, 16 48 V20 Z" fill="'+c.a+'"/>'+
    '<rect x="45" y="24" width="10" height="52" rx="2" fill="'+c.b+'"/><rect x="30" y="38" width="40" height="10" rx="2" fill="'+c.b+'"/></g>'; },
  globe:function(c){ return '<circle cx="50" cy="50" r="40" fill="'+c.a+'" fill-opacity=".18"/><circle cx="50" cy="50" r="40" fill="none" stroke="'+c.a+'" stroke-width="5"/>'+
    '<g'+cvA_('cvSpin')+'><ellipse cx="50" cy="50" rx="16" ry="40" fill="none" stroke="'+c.a+'" stroke-width="3"/><ellipse cx="50" cy="50" rx="30" ry="40" fill="none" stroke="'+c.a+'" stroke-width="2.5" stroke-opacity=".6"/></g>'+
    '<path d="M12 36 H88 M12 64 H88" stroke="'+c.a+'" stroke-width="2.5" stroke-opacity=".6"/>'+
    '<g'+cvA_('cvGrowUp','transform-origin:50% 100%')+'><path d="M50 50 V30" stroke="'+c.b+'" stroke-width="4" stroke-linecap="round"/><path d="M50 36 C 40 34, 36 26, 38 20 C 46 22, 50 28, 50 36 Z M50 32 C 58 28, 64 22, 64 16 C 56 16, 50 22, 50 32 Z" fill="'+c.b+'"/></g>'; },
  fight:function(c){ var o='', L='FIGHT';
    for(var k=0;k<5;k++){ var x=6+k*18.5, h=26+k*13;
      o+='<g'+cvA_('cvGrowUp','transform-origin:50% 100%;animation-delay:'+(k*0.18).toFixed(2)+'s')+'><rect x="'+x+'" y="'+(94-h)+'" width="14" height="'+h+'" rx="3" fill="'+(k===4?c.b:c.a)+'"/></g>'+
        '<text x="'+(x+7)+'" y="'+(94-h-4)+'" text-anchor="middle" font-family="Koulen, sans-serif" font-size="15" fill="'+c.a+'">'+L[k]+'</text>'; }
    return o; },
  pair:function(c){ var p=function(x,col,d){ return '<g'+cvA_('cvBob','animation-delay:'+d+'s')+'><circle cx="'+x+'" cy="40" r="11" fill="'+col+'"/><path d="M'+(x-16)+' 92 V70 Q '+(x-16)+' 54 '+x+' 54 Q '+(x+16)+' 54 '+(x+16)+' 70 V92 Z" fill="'+col+'"/></g>'; };
    return '<path d="M10 30 Q 50 -6 90 30" fill="none" stroke="'+c.a+'" stroke-width="4" stroke-linecap="round" stroke-opacity=".6"/>'+p(32,c.a,0)+p(68,c.b,-1.5); }
};
function libPal_(){ return GP_LIBRARY.palette || {}; }
function libCol_(k, fallback){ var p=libPal_(); return p[k] || k || fallback; }
/* A book's cover. With a `cover` spec it is the book's own (above); without
   one it falls back to the shelf's patterned series cover. */
function libCoverHtml_(b, big){
  var sp=b.cover, title=libTitle_(b), n=title.length;
  if(!sp || !LIB_MOTIFS[sp.motif]) return libCoverSeries_(b, big, title, n);
  var c={ bg:libCol_(sp.bg), fg:libCol_(sp.fg), a:libCol_(sp.a), b:libCol_(sp.b||sp.fg), c:libCol_(sp.c||sp.a), d:libCol_(sp.d||sp.b||sp.fg) };
  var top = sp.layout!=='bottom';
  var place = top ? 'translate(9,56) scale(.82)' : 'translate(9,10) scale(.82)';
  var km = /[\u1780-\u17FF]/.test(title);
  /* As big as the title allows, but never so big that its longest word has to
     break: 82% of the cover's width over that word, by the type's letter width. */
  var font=sp.font||'sans', perChar = font==='display' ? 0.46 : font==='serif' ? (sp.upper?0.66:0.53) : (sp.upper?0.68:0.57);
  var longest=Math.max.apply(null, title.split(/\s+/).map(function(w){ return w.length; }));
  var byLen = n<=8 ? (font==='display'?28:21) : n<=12 ? (font==='display'?20:15.5) : n<=22 ? (font==='display'?15:12.5) : n<=34 ? 10.5 : 9.2;
  var fs = km ? (n<=7 ? 15 : n<=12 ? 12.5 : n<=18 ? 10.5 : n<=28 ? 9.5 : 8.5) : Math.min(byLen, 82/(longest*perChar));   // Khmer: by length — wide glyphs, no spaces to break on
  return '<div class="libCover cv '+(top?'top':'bottom')+(big?' big':'')+'" style="background:'+c.bg+';color:'+c.fg+'">'+
    '<svg class="cvArt" viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g transform="'+place+'">'+LIB_MOTIFS[sp.motif](c, b)+'</g></svg>'+
    '<div class="cvText"><div class="libCoverTitle cvT-'+font+(sp.upper?' up':'')+(km?' km':'')+'" style="font-size:'+fs.toFixed(2)+'cqw">'+esc(title)+'</div>'+
    '<div class="libCoverAuthor'+(km?' km':'')+'">'+esc(libAuthor_(b))+'</div></div></div>';
}
/* A title whose longest word is still too wide in the type the phone actually
   has (the cover font may not have loaded yet, or ever, offline) steps down
   until it fits — again once the fonts arrive. */
function libFitTitles_(){
  document.querySelectorAll('.libCover.cv .libCoverTitle').forEach(function(t){
    var m=/([\d.]+)cqw/.exec(t.style.fontSize||''); if(!m) return;
    var fs=Number(m[1]), guard=0;
    while(t.scrollWidth > t.clientWidth+1 && fs>5 && guard++<20){ fs*=0.92; t.style.fontSize=fs.toFixed(2)+'cqw'; }
  });
}
if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if(S && S.view==='library') libFitTitles_(); });
/* Covers move only while they are on screen. */
var _libCoverObs=null;
function libLiveCovers_(){
  var all=document.querySelectorAll('.libCover.cv');
  if(!('IntersectionObserver' in window)){ all.forEach(function(el){ el.classList.add('live'); }); return; }
  if(!_libCoverObs) _libCoverObs=new IntersectionObserver(function(es){ es.forEach(function(e){ e.target.classList.toggle('live', e.isIntersecting); }); }, { rootMargin:'40px' });
  all.forEach(function(el){ _libCoverObs.observe(el); });
}
function libCoverSeries_(b, big, title, n){
  var sh=libShelf_(b.shelf), C=GP_LIBRARY.cover||{}, km=/[\u1780-\u17FF]/.test(title);
  return '<div class="libCover'+(big?' big':'')+'" style="background:'+(C.paper||sh.color)+';color:'+(C.ink||sh.ink)+'">'+
    '<div class="libCoverArt" style="background:linear-gradient(155deg,'+sh.color+','+sh.ink+')">'+libMotif_(b)+'</div>'+
    '<div class="libCoverText"><div class="libCoverRule" style="background:'+sh.color+'"></div>'+
    '<div class="libCoverTitle '+(n<=12?'l1':n<=22?'l2':n<=34?'l3':'l4')+(km?' km':'')+'">'+esc(title)+'</div>'+
    '<div class="libCoverAuthor'+(km?' km':'')+'">'+esc(libAuthor_(b))+'</div></div></div>';
}
function libParas_(txt){ return String(txt||'').split(/\n\s*\n/).map(function(x){ return x.trim() ? '<p>'+esc(x.trim())+'</p>' : ''; }).join(''); }
/* The colour a book's tile, page and reader take: its cover's own, else its shelf's. */
function libTint_(b){ return (b.cover && b.cover.bg) ? libCol_(b.cover.bg) : libShelf_(b.shelf).color; }
function libTileHtml_(b, read, prog){
  var sh=libShelf_(b.shelf), steps=b.insights.length+2, at=prog[b.id];
  return '<button class="libTile" data-libbook="'+esc(b.id)+'" aria-label="'+esc(libTitle_(b)+' — '+libAuthor_(b))+'" style="--libc:'+libTint_(b)+'">'+
    '<span class="libTileArt">'+libCoverHtml_(b)+(read[b.id]?'<span class="libReadTag">✓</span>':'')+'</span>'+
    '<span class="libTileTitle">'+esc(libTitle_(b))+'</span><span class="libTileAuthor">'+esc(libAuthor_(b))+'</span>'+
    '<span class="libTileMeta">⏱ '+esc(gpT('{n} min',{n:b.mins||5}))+' · 💡 '+b.insights.length+'</span>'+
    (at && !read[b.id] ? '<span class="libTileBar"><span style="width:'+Math.round(at/(steps-1)*100)+'%"></span></span>' : '')+'</button>';
}
function libRowHtml_(title, books, read, prog, seeAll){
  return '<div class="libSecHead"><h3>'+title+'</h3>'+(seeAll ? '<button class="linkbtn libSeeAll" data-libshelf="'+esc(seeAll)+'">'+esc(t('See all'))+' ('+books.length+')</button>' : '')+'</div>'+
    '<div class="libRow">'+books.map(function(b){ return libTileHtml_(b, read, prog); }).join('')+'</div>';
}
function libraryHtml(){
  var back='<button class="linkbtn" id="libBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(S.libBook ? t('Library') : S.libShelf!=='all' ? t('Library') : t('My Home'))+'</button>';
  if(typeof GP_LIBRARY==='undefined'){
    return back+'<h2>📚 '+esc(t('Library'))+'</h2>'+(S.libError
      ? '<div class="card"><p class="sub" style="margin:0 0 10px">'+esc(t('The library could not load. Check your connection and try again.'))+'</p><button class="btn ghost" id="libRetry">'+esc(t('Try again'))+'</button></div>'
      : '<p class="sub">'+esc(t('Loading…'))+'</p>');
  }
  libKmEnsure_();   // a Khmer app shows the Khmer titles, authors and covers as soon as they arrive
  if(S.libBook){
    var b=libById_(S.libBook);
    if(b) return S.libStep!=null ? libReaderHtml_(b) : back+libBookHtml_(b);
    S.libBook=null; S.libStep=null;
  }
  if(libLang_()==='km' && typeof GP_LIBRARY_KM==='undefined' && !S.libKmError) libLoadKm_();   // so Khmer names show on the shelves
  var read=libRead_(), prog=libProg_(), books=GP_LIBRARY.books, picks=libPicks_();
  if(S.libShelf==='start' && !picks.length) S.libShelf='all';
  var readN=books.filter(function(x){ return read[x.id]; }).length;
  var h=back+'<h2>📚 '+esc(t('Library'))+'</h2>'+
    '<p class="sub">'+esc(t('Ten-minute reads of the best books on leading, culture, habits and creativity, and the YWAM classics — the big ideas, made for us.'))+'</p>'+
    '<div class="libProgress"><b>'+readN+'</b> / '+books.length+' '+esc(t('read'))+'<span class="libProgressBar"><span style="width:'+Math.round(readN/Math.max(1,books.length)*100)+'%"></span></span></div>'+
    '<div class="libShelves">'+[{id:'all', name:'All'}].concat(picks.length ? [{id:'start', name:'Start here', emoji:'⭐'}] : [], libShelvesShown_()).map(function(sh){
      return '<button class="libShelfBtn'+(S.libShelf===sh.id?' on':'')+'" data-libshelf="'+esc(sh.id)+'"'+(sh.color&&S.libShelf===sh.id?' style="background:'+sh.color+';border-color:'+sh.color+'"':'')+'>'+(sh.emoji?sh.emoji+' ':'')+esc(t(sh.name))+'</button>';
    }).join('')+'</div>';
  if(S.libShelf==='all'){
    var going=books.filter(function(x){ return prog[x.id] && !read[x.id]; });
    if(going.length) h+=libRowHtml_('📖 '+esc(t('Continue reading')), going, read, prog);
    if(picks.length) h+=libRowHtml_('⭐ '+esc(t('Start here')), picks, read, prog, 'start');
    libShelvesShown_().forEach(function(sh){
      h+=libRowHtml_((sh.emoji?sh.emoji+' ':'')+esc(t(sh.name)), books.filter(function(x){ return x.shelf===sh.id; }), read, prog, sh.id);
    });
  } else {
    var shown = S.libShelf==='start' ? picks : books.filter(function(x){ return x.shelf===S.libShelf; });
    if(S.libShelf==='start') h+='<p class="sub libStartNote">'+esc(gpT('{n} books to read first for leading at YWAM GP: culture, teams, hard conversations, vision, systems and getting things done.',{n:picks.length}))+'</p>';
    h+='<div class="libGrid">'+shown.map(function(b){ return libTileHtml_(b, read, prog); }).join('')+'</div>';
  }
  return h+'<p class="pFine">'+esc(t('Summaries written for YWAM GP in our own words — not by the authors or publishers. Love one? Read the whole book.'))+'</p>';
}
function libBookHtml_(b){
  var sh=libShelf_(b.shelf), read=libRead_()[b.id], at=libProg_()[b.id], T=libText_(b);
  var list=GP_LIBRARY.books, i=list.indexOf(b), next=list[(i+1)%list.length];
  var h=libKmEnsure_()+'<div class="libHead'+(T.km?' libKm':'')+'" style="--libc:'+libTint_(b)+';--libink:'+sh.ink+'">'+libCoverHtml_(b, true)+
    '<span class="libShelfTag">'+(sh.emoji||'')+' '+esc(t(sh.name))+'</span>'+(b.original?' <span class="libShelfTag">✨ '+esc(t('Original GP guide'))+'</span>':'')+
    '<h2 class="libTitle">'+esc(libTitle_(b))+'</h2><div class="libAuthor">'+esc(libAuthor_(b))+(b.year?' · '+b.year:'')+'</div>'+
    '<div class="libVibe">'+esc(T.vibe)+'</div>'+
    '<div class="libStats"><span>⏱ '+esc(gpT('{n}-minute read',{n:b.mins||5}))+'</span><span>💡 '+esc(gpT('{n} key ideas',{n:b.insights.length}))+'</span>'+(read?'<span>✓ '+esc(t('Read'))+'</span>':'')+'</div></div>';
  h+='<button class="btn libCta" id="libStart" style="background:'+sh.color+';border-color:'+sh.color+'">'+
    esc(at && !read ? gpT('Continue — key idea {n}',{n:Math.min(at, b.insights.length)}) : read ? t('Read again') : '▶ '+t('Start reading'))+'</button>'+
    (libAudioOk_() ? '<button class="btn ghost libListenCta" id="libListenStart">🎧 '+esc(t('Listen'))+'</button>' : '');
  h+='<div class="libSec'+(T.km?' libKm':'')+'"><h3>'+esc(t('What’s it about?'))+'</h3>'+libParas_(T.bigIdea)+'</div>';
  h+='<div class="libSec'+(T.km?' libKm':'')+'"><h3>'+esc(t('What’s inside'))+'</h3><div class="libInside">'+T.insights.map(function(x, k){
    return '<button class="libInsideItem" data-libstep="'+(k+1)+'"><span class="libInsightNum" style="background:'+sh.color+'">'+(k+1)+'</span><span>'+esc(x.emoji||'')+' '+esc(x.title)+'</span><span class="libInsideGo">›</span></button>';
  }).join('')+'</div></div>';
  h+='<div class="card libForUs'+(T.km?' libKm':'')+'" style="border-left-color:'+sh.color+'"><div class="libKicker">🌏 '+esc(t('For us at YWAM GP'))+'</div>'+libParas_(T.forUs)+'</div>';
  h+='<div class="btnRow" style="margin-top:14px">'+
    '<button class="btn ghost" id="libMarkRead" data-libid="'+esc(b.id)+'">'+esc(read ? '✓ '+t('Read') : t('Mark as read'))+'</button>'+
    (next && next!==b ? '<button class="btn ghost" data-libbook="'+esc(next.id)+'">'+esc(t('Next book'))+' →</button>' : '')+'</div>';
  return h+'<p class="pFine">'+esc(b.original ? t('An original guide written for YWAM GP — not a published book. Every person is different: use it to start conversations, not to put people in boxes.')
    : t('Summary written for YWAM GP in our own words — not by the author or publisher.'))+'</p>';
}
/* The FIGHT book's first page also carries the overview the 1-on-1 check-in shows
   (Oct 2026, Uriah): how the five build (OO_FLOW), then each value — its letter,
   statement, three "I…" behaviours, and the verse and what it isn't under a fold.
   Same OO_VALUES text, so the book and the form never drift apart. */
function fightOverviewHtml_(km){
  return '<div class="fightOv" id="fightOv"><div class="libKicker">'+esc(t('FIGHT at a glance'))+'</div>'+
    '<p class="fightFlow">'+esc(km ? OO_FLOW.km : OO_FLOW.en)+'</p>'+
    OO_VALUES.map(function(v){
      return '<div class="fightVal" data-fightval="'+v.id+'"><div class="fightValHead"><b class="ooLetter">'+v.letter+'</b>'+esc(km ? v.km : v.label)+
        '<span class="fightValAlt">'+esc(km ? v.label : v.km)+'</span></div>'+
        '<p class="fightSay">'+esc(km ? v.sayKm : v.say)+'</p>'+
        '<ul class="fightBeh">'+(km ? v.doesKm : v.does).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'+
        '<details class="ooMore fightMore"><summary>📖 '+esc(t('Verse · what it isn’t'))+'</summary>'+
          '<div class="ooVerse">'+esc(km ? v.verseKm : v.verse)+'</div><div class="ooNot">🚧 '+esc(km ? v.notKm : v.not)+'</div></details></div>';
    }).join('')+'</div>';
}
/* One screen per step: 0 the intro, 1…n the key ideas, n+1 the final summary. */
function libReaderHtml_(b){
  var sh=libShelf_(b.shelf), T=libText_(b), n=b.insights.length, last=n+1, k=Math.max(0, Math.min(last, S.libStep|0));
  var segs=''; for(var j=0;j<=last;j++) segs+='<span'+(j<=k?' class="on"':'')+'></span>';
  var h='<div class="libReader" id="libReader" style="--libc:'+libTint_(b)+';--libink:'+sh.ink+'">'+
    '<div class="libReaderTop"><button class="libReaderClose" id="libClose" aria-label="'+esc(t('Close'))+'">✕</button><div class="libSegs">'+segs+'</div>'+libAudioBtnsHtml_()+'</div>'+
    '<div class="libReaderBook"><span>'+esc(libTitle_(b))+' · '+esc(libAuthor_(b))+'</span></div>'+libKmEnsure_()+
    '<div class="libReaderKicker libTurn-'+(S.libDir||'none')+'">'+esc(k===0 ? t('Intro') : k<=n ? gpT('Key idea {n} of {m}',{n:k, m:n}) : t('Final summary'))+'</div><div class="libReaderBody libTurn-'+(S.libDir||'none')+(T.km?' libKm':'')+'">';
  if(k===0) h+='<h2>'+esc(T.vibe)+'</h2>'+libParas_(T.bigIdea)+(b.overview==='fight' ? fightOverviewHtml_(T.km) : '');
  else if(k<=n){ var x=T.insights[k-1]; h+='<div class="libReaderEmoji">'+esc(x.emoji||'')+'</div><h2>'+esc(x.title)+'</h2>'+libParas_(x.body); }
  else h+='<div class="libOneLine" style="background:'+sh.color+'"><span>'+esc(t('In one line'))+'</span>'+esc(T.oneLine)+'</div>'+
    '<div class="libKicker" style="margin-top:20px">✅ '+esc(t('Try this week'))+'</div><ul class="libTry">'+T.tryThis.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'+
    '<div class="libKicker" style="margin-top:18px">🌏 '+esc(t('For us at YWAM GP'))+'</div>'+libParas_(T.forUs);
  /* Turning the page is a swipe (or a tap on the page's edge, where a quiet ‹ › sits);
     the only button is Done, on the last page. The first few books opened show how. */
  h+='</div>'+
    (k>0 ? '<button class="libEdge prev" id="libPrev" aria-label="'+esc(t('Back'))+'"><span>‹</span></button>' : '')+
    (k<last ? '<button class="libEdge next" id="libNext" aria-label="'+esc(t('Next'))+'"><span>›</span></button>' : '')+
    (k===last ? '<div class="libReaderNav"><div class="libReaderNavIn"><button class="btn" id="libFinish" style="background:'+sh.color+';border-color:'+sh.color+'">✓ '+esc(t('Done — mark as read'))+'</button></div></div>' : '')+
    (S.libHint ? '<div class="libSwipeHint" id="libSwipeHint" aria-hidden="true"><span class="libSwipeHand">👆</span><span>'+esc(t('Swipe to turn the page'))+'</span></div>' : '')+
    '</div>';
  return h;
}
/* ---------- The Library, read aloud (Oct 2026, Uriah: "an audio function
   for all the books") ----------
   The phone's own voice (speechSynthesis): nothing to download, works offline,
   free. 🎧 reads the screen that is open — its heading, then each paragraph,
   the one being read lit up — and at the end of a step turns the page by
   itself, like Blinkist's audio, until the final summary. Speed is kept on the
   phone (gp-lib-rate). A Khmer book needs a Khmer voice on the phone; without
   one it says so rather than reading Khmer with an English voice. The screen
   is kept awake while it plays where the phone allows (Wake Lock); a locked
   phone stops the voice — that is the phone, not us. */
var LIBA={ on:false, chunks:[], i:0, token:0, wake:null, key:'' };
var LIB_RATES=[0.8, 1, 1.25, 1.5];
function libSpeechOk_(){ return typeof window!=='undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance!=='undefined'; }
/* Off for now (Oct 2026, Uriah: the phone voices — iPhone's above all — are not
   good enough). The player stays, ready: when the books have recorded audio
   (scripts/record-library-audio.mjs), set this to true and 🎧 comes back,
   playing the recordings first and the phone's voice only where there is none. */
var LIB_AUDIO_ON=false;
function libAudioOk_(){ return LIB_AUDIO_ON && (libSpeechOk_() || typeof Audio!=='undefined'); }
/* Recorded audio (scripts/record-library-audio.mjs, Azure voices): which books have it, per
   language — loaded once when the Library opens; a phone without it falls back to
   its own voice. */
S.libAudioIdx=null; S.libAudioIdxLoading=false;
function libAudioIdxLoad_(){
  if(S.libAudioIdx || S.libAudioIdxLoading) return;
  S.libAudioIdxLoading=true;
  run('libAudioIndex',[],function(d){ S.libAudioIdxLoading=false; S.libAudioIdx=(d && d.ok && d.index) || { en:{}, km:{} }; },
    function(){ S.libAudioIdxLoading=false; S.libAudioIdx={ en:{}, km:{} }; });
}
function libRecFor_(b, lang){ var r=S.libAudioIdx && S.libAudioIdx[lang] && S.libAudioIdx[lang][b.id]; return (r && r.n===b.insights.length+2) ? r : null; }
function libRecUrl_(b, lang, step, rec){ return '/.netlify/functions/audio?lang='+lang+'&book='+encodeURIComponent(b.id)+'&step='+step+'&v='+encodeURIComponent(rec.v||''); }
/* iPhones only let a page start sound from a tap: the first tap plays a moment of
   silence on our one audio element, and every later play() on it is allowed. */
var LIB_SILENCE='data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
function libAudioEl_(){ if(!LIBA.el && typeof Audio!=='undefined'){ LIBA.el=new Audio(); LIBA.el.preload='auto'; } return LIBA.el; }
function libAudioUnlock_(){ var a=libAudioEl_(); if(!a || LIBA.unlocked) return; LIBA.unlocked=true; try { a.src=LIB_SILENCE; var p=a.play(); if(p && p.catch) p.catch(function(){}); } catch(e){} }
function libRate_(){ var r=Number(lsGet('gp-lib-rate')); return LIB_RATES.indexOf(r)>-1 ? r : 1; }
function libVoice_(km){
  var vs=[]; try { vs=window.speechSynthesis.getVoices()||[]; } catch(e){}
  var want=km ? /^km/i : /^en/i;
  var list=vs.filter(function(v){ return want.test(v.lang||''); });
  if(!list.length) return null;
  // a natural-sounding one where the phone has it
  return list.filter(function(v){ return /natural|enhanced|premium|google|samantha|daniel|karen/i.test(v.name||''); })[0] || list.filter(function(v){ return v.localService; })[0] || list[0];
}
function libAudioBtnsHtml_(){
  if(!libAudioOk_()) return '';
  return '<button class="libListen'+(LIBA.on?' on':'')+'" id="libListen" aria-pressed="'+(LIBA.on?'true':'false')+'" aria-label="'+esc(LIBA.on ? t('Pause') : t('Listen'))+'">'+(LIBA.on?'⏸':'🎧')+'</button>'+
    (LIBA.on ? '<button class="libRate" id="libRate" aria-label="'+esc(t('Speed'))+'">'+libRate_()+'×</button>' : '');
}
/* What's on the screen, in reading order — each piece remembers its element. */
function libAudioChunks_(){
  var root=document.getElementById('libReader'); if(!root) return [];
  var out=[], kick=root.querySelector('.libReaderKicker');
  if(kick) out.push({ el:null, text:kick.textContent });
  root.querySelectorAll('.libReaderBody h2, .libReaderBody p, .libReaderBody li, .libReaderBody .libOneLine, .libReaderBody .libKicker').forEach(function(el){
    var txt=(el.textContent||'').replace(/[✅🌏]/g,'').trim(); if(!txt) return;
    // long paragraphs in sentence-sized pieces: some phones cut a long utterance short
    var parts=txt.match(/[^.!?។៕]+[.!?។៕]*\s*/g) || [txt], cur='';
    parts.forEach(function(sn){ if((cur+sn).length>220 && cur){ out.push({ el:el, text:cur }); cur=''; } cur+=sn; });
    if(cur.trim()) out.push({ el:el, text:cur });
  });
  return out;
}
function libAudioMark_(el){
  document.querySelectorAll('.libSpeaking').forEach(function(x){ x.classList.remove('libSpeaking'); });
  if(el){ el.classList.add('libSpeaking'); var r=el.getBoundingClientRect(); if(r.top<80 || r.bottom>window.innerHeight-110) el.scrollIntoView({ block:'center', behavior:'smooth' }); }
}
function libAudioKey_(){ return S.libBook+'|'+S.libStep+'|'+libLang_(); }
function libAudioPlay_(from){
  if(!libAudioOk_()) return;
  var b=libById_(S.libBook), T=b ? libText_(b) : null;
  if(!b || S.libStep==null){ libAudioStop_(); return; }
  var rec=libRecFor_(b, T.km ? 'km' : 'en');
  if(rec && libAudioEl_() && !LIBA.noRec) return libRecPlay_(b, T.km ? 'km' : 'en', rec);
  if(!libSpeechOk_()){ libAudioStop_(); showMsg(t('This book has no recording yet, and this phone cannot read aloud.')); return; }
  var voice=libVoice_(T.km);
  if(T.km && !voice){ libAudioStop_(); showMsg(t('This phone has no Khmer voice yet. Switch the app to English to listen, or add a Khmer voice in your phone’s settings.')); return; }
  var token=++LIBA.token;
  try { window.speechSynthesis.cancel(); } catch(e){}
  LIBA.on=true; LIBA.chunks=libAudioChunks_(); LIBA.i=Math.max(0, Math.min(LIBA.chunks.length, from|0)); LIBA.key=libAudioKey_();
  if(!LIBA.wake && navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(function(w){ LIBA.wake=w; }, function(){});
  var next=function(){
    if(token!==LIBA.token || !LIBA.on) return;
    if(LIBA.i>=LIBA.chunks.length){
      // the end of this step: turn the page, or stop at the final summary
      var last=b.insights.length+1;
      if(S.libStep<last){ libGo_(S.libStep+1); } else { libAudioStop_(); render(); }
      return;
    }
    var c=LIBA.chunks[LIBA.i++], u=new SpeechSynthesisUtterance(c.text);
    u.lang=T.km ? 'km-KH' : 'en-US'; if(voice) u.voice=voice; u.rate=libRate_();
    u.onend=function(){ setTimeout(next, 120); };
    u.onerror=function(ev){ if(ev && (ev.error==='interrupted' || ev.error==='canceled')) return; setTimeout(next, 120); };
    libAudioMark_(c.el);
    window.speechSynthesis.speak(u);
  };
  next();
}
/* A recorded screen: fetched whole (iPhones play a fetched file, not a stream
   from a function), the next screen fetched ahead, the paragraph lit by how far
   through the file we are, and the lock screen / headphone buttons wired up. */
function libRecPlay_(b, lang, rec){
  var a=libAudioEl_(), token=++LIBA.token, step=S.libStep, last=b.insights.length+1;
  try { if(libSpeechOk_()) window.speechSynthesis.cancel(); } catch(e){}
  LIBA.on=true; LIBA.rec=true; LIBA.key=libAudioKey_(); LIBA.chunks=libAudioChunks_(); LIBA.i=0;
  LIBA.cache=LIBA.cache||{};
  var get=function(k){ var u=libRecUrl_(b, lang, k, rec); if(!LIBA.cache[u]) LIBA.cache[u]=fetch(u).then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.blob(); }).catch(function(e){ delete LIBA.cache[u]; throw e; }); return LIBA.cache[u]; };
  if(!LIBA.wake && navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(function(w){ LIBA.wake=w; }, function(){});
  get(step).then(function(blob){
    if(token!==LIBA.token) return;
    if(LIBA.url){ try { URL.revokeObjectURL(LIBA.url); } catch(e){} }
    LIBA.url=URL.createObjectURL(blob); a.src=LIBA.url; a.playbackRate=libRate_();
    a.onended=function(){ if(token!==LIBA.token) return; if(S.libStep<last) libGo_(S.libStep+1); else { libAudioStop_(); render(); } };
    a.ontimeupdate=function(){
      if(token!==LIBA.token || !a.duration) return;
      var total=LIBA.chunks.reduce(function(n,c){ return n+c.text.length; },0)||1, at=a.currentTime/a.duration*total, run=0;
      for(var i=0;i<LIBA.chunks.length;i++){ run+=LIBA.chunks[i].text.length; if(run>=at){ if(LIBA.i!==i+1){ LIBA.i=i+1; libAudioMark_(LIBA.chunks[i].el); } break; } }
    };
    var p=a.play(); if(p && p.catch) p.catch(function(){ if(token!==LIBA.token) return; libAudioStop_(); render(); showMsg(t('Tap 🎧 to start listening.')); });
    if(step<last) get(step+1).catch(function(){});   // the next screen, ready before it is needed
    if(navigator.mediaSession && typeof MediaMetadata!=='undefined'){
      var T=libText_(b);
      try { navigator.mediaSession.metadata=new MediaMetadata({ title: step===0 ? libTitle_(b) : step<=b.insights.length ? T.insights[step-1].title : t('Final summary'), artist: libTitle_(b)+' · '+b.author, album: t('GP Library') }); } catch(e){}
      try { navigator.mediaSession.setActionHandler('pause', function(){ libAudioStop_(); render(); });
        navigator.mediaSession.setActionHandler('play', function(){ LIBA.on=true; LIBA.key=''; render(); });
        navigator.mediaSession.setActionHandler('nexttrack', function(){ if(S.libStep<last) libGo_(S.libStep+1); });
        navigator.mediaSession.setActionHandler('previoustrack', function(){ if(S.libStep>0) libGo_(S.libStep-1); }); } catch(e){}
    }
  }, function(){
    // no file after all (deleted, offline): read this screen with the phone's voice instead
    if(token!==LIBA.token) return; LIBA.noRec=true; libAudioPlay_(0); LIBA.noRec=false;
  });
}
function libAudioStop_(){
  LIBA.on=false; LIBA.rec=false; LIBA.token++;
  if(LIBA.el){ try { LIBA.el.pause(); } catch(e){} }
  try { if(libAudioOk_()) window.speechSynthesis.cancel(); } catch(e){}
  if(LIBA.wake){ try { LIBA.wake.release(); } catch(e){} LIBA.wake=null; }
  document.querySelectorAll('.libSpeaking').forEach(function(x){ x.classList.remove('libSpeaking'); });
}
function libAudioBind_(){
  var ls=document.getElementById('libListen');
  if(ls) ls.onclick=function(){ gpTap(); if(LIBA.on){ libAudioStop_(); render(); } else { libAudioUnlock_(); LIBA.on=true; LIBA.key=''; render(); } };
  var rt=document.getElementById('libRate');
  if(rt) rt.onclick=function(){ gpTap(); var r=libRate_(), n=LIB_RATES[(LIB_RATES.indexOf(r)+1)%LIB_RATES.length]; lsSet('gp-lib-rate', String(n)); rt.textContent=n+'×';
    if(LIBA.on && LIBA.rec && LIBA.el) LIBA.el.playbackRate=n;
    else if(LIBA.on) libAudioPlay_(Math.max(0, LIBA.i-1)); };   // the same sentence again, at the new speed
  var lst=document.getElementById('libListenStart');
  if(lst) lst.onclick=function(){ gpTap(); libAudioUnlock_(); var id=S.libBook, at=libProg_()[id]; LIBA.on=true; LIBA.key=''; libGo_(at && !libRead_()[id] ? at : 0); };
  if(!LIB_AUDIO_ON) return;
  libAudioIdxLoad_();
  if(!LIBA.on || !document.getElementById('libReader')) return;
  if(LIBA.key===libAudioKey_()){
    // the same screen drawn again (a notification, a tap elsewhere): keep reading, light the new copy
    var fresh=libAudioChunks_();
    if(fresh.length===LIBA.chunks.length){ LIBA.chunks=fresh; var c=LIBA.chunks[LIBA.i-1]; libAudioMark_(c && c.el); }
  } else libAudioPlay_(0);   // a new step, or the book switched language
}
function libGo_(step){
  var b=libById_(S.libBook); if(!b) return;
  var was=S.libStep; S.libStep=Math.max(0, Math.min(b.insights.length+1, step));
  S.libDir = was==null ? 'none' : S.libStep>was ? 'next' : S.libStep<was ? 'prev' : 'none';
  /* "Swipe to turn the page": the first three times a book is opened, never again after a first swipe */
  if(was==null){ var seen=Number(lsGet('gp-lib-swipehint'))||0; S.libHint = seen<3; if(S.libHint) lsSet('gp-lib-swipehint', String(seen+1)); }
  else S.libHint=false;
  if(!libRead_()[b.id]) libSetProg_(b.id, S.libStep);
  render(); window.scrollTo(0,0);
}
function bindLibrary_(){
  var lb=document.getElementById('libBack');
  if(lb) lb.onclick=function(){ gpTap(); if(S.libBook){ S.libBook=null; S.libStep=null; render(); } else if(S.libShelf!=='all'){ S.libShelf='all'; render(); } else { S.view='week'; render(); } window.scrollTo(0,0); };
  var lr=document.getElementById('libRetry');
  if(lr) lr.onclick=function(){ libLoad_(); render(); };
  libLiveCovers_(); libFitTitles_();
  var onChip=document.querySelector('.libShelfBtn.on');   // the chosen shelf's chip in view, without moving the page
  if(onChip && onChip.parentNode) onChip.parentNode.scrollLeft=Math.max(0, onChip.offsetLeft-onChip.parentNode.offsetLeft-24);
  document.querySelectorAll('[data-libshelf]').forEach(function(b){ b.onclick=function(){ gpTap(); S.libShelf=b.getAttribute('data-libshelf'); render(); if(b.classList.contains('libSeeAll')) window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-libbook]').forEach(function(b){ b.onclick=function(){ gpTap(); S.libBook=b.getAttribute('data-libbook'); S.libStep=null; render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-libstep]').forEach(function(b){ b.onclick=function(){ gpTap(); libGo_(+b.getAttribute('data-libstep')); }; });
  libAudioBind_();
  var st=document.getElementById('libStart');
  if(st) st.onclick=function(){ gpTap(); var id=S.libBook, at=libProg_()[id]; libGo_(at && !libRead_()[id] ? at : 0); };
  var mr=document.getElementById('libMarkRead');
  if(mr) mr.onclick=function(){ var id=mr.getAttribute('data-libid'), on=!libRead_()[id]; libSetRead_(id, on); if(on) libSetProg_(id, 0); gpTap(); render(); };
  var cl=document.getElementById('libClose');
  if(cl) cl.onclick=function(){ gpTap(); S.libStep=null; render(); window.scrollTo(0,0); };
  var pv=document.getElementById('libPrev'), nx=document.getElementById('libNext'), fin=document.getElementById('libFinish');
  if(pv) pv.onclick=function(){ gpTap(); libGo_(S.libStep-1); };
  if(nx) nx.onclick=function(){ gpTap(); libGo_(S.libStep+1); };
  if(fin) fin.onclick=function(){ gpTap(); libSetRead_(S.libBook, true); libSetProg_(S.libBook, 0); S.libStep=null; render(); window.scrollTo(0,0); };
  var hint=document.getElementById('libSwipeHint');
  if(hint){ var gone=function(){ S.libHint=false; hint.classList.add('out'); };
    setTimeout(gone, 3600); var rr=document.getElementById('libReader'); if(rr) rr.addEventListener('touchstart', gone, { once:true, passive:true }); }
  var rd=document.getElementById('libReader');
  if(rd){   // swipe left for the next screen, right for the one before
    var x0=null, y0=null;
    rd.addEventListener('touchstart', function(e){ x0=e.touches[0].clientX; y0=e.touches[0].clientY; }, { passive:true });
    rd.addEventListener('touchend', function(e){
      if(x0==null) return;
      var dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
      if(Math.abs(dx)<60 || Math.abs(dx)<Math.abs(dy)*1.5) return;
      var b=libById_(S.libBook); if(!b) return;
      lsSet('gp-lib-swipehint','3');   // they know now
      if(dx<0 && S.libStep<b.insights.length+1) libGo_(S.libStep+1);
      else if(dx>0 && S.libStep>0) libGo_(S.libStep-1);
    }, { passive:true });
  }
}

/* ==================== the Library on your account ====================
   "Read" ticks used to live on the phone only; now they are kept on the staff
   record too (libSaveReads), so the count follows you to any phone and shows
   on your profile. The phone keeps a copy (LIB_READ_KEY) so the Library opens
   instantly and offline, and a list of changes not yet saved
   (LIB_PENDING_KEY) that goes up whenever there is a connection. The first
   time a phone sees the saved list, what it had marked before is sent up. */
var LIB_PENDING_KEY='gp-lib-pending', LIB_SYNCED_KEY='gp-lib-synced';
function libPending_(){ return libStore_(LIB_PENDING_KEY); }
function libAdoptServer_(server, fromCache){
  if(!server || typeof server!=='object') return;
  var pending=libPending_();
  if(!fromCache && !lsGet(LIB_SYNCED_KEY)){
    var local=libRead_();
    Object.keys(local).forEach(function(id){ if(!server[id] && !(id in pending)) pending[id]=local[id]||todayStr(); });
    lsSet(LIB_SYNCED_KEY, '1');
    libSave_(LIB_PENDING_KEY, pending);
  }
  var merged=Object.assign({}, server);
  Object.keys(pending).forEach(function(id){ if(pending[id]) merged[id]=pending[id]; else delete merged[id]; });
  libSave_(LIB_READ_KEY, merged);
  if(!fromCache) libPush_();
}
function libPush_(){
  var pending=libPending_(), keys=Object.keys(pending);
  if(!keys.length || S.libPushing || !S.auth || !S.auth.user) return;
  S.libPushing=true;
  run('libSaveReads',[S.auth.user,S.auth.pin,pending],function(d){
    S.libPushing=false;
    if(!d || !d.ok) return;
    var now=libPending_();
    keys.forEach(function(k){ if(now[k]===pending[k]) delete now[k]; });
    libSave_(LIB_PENDING_KEY, now);
    libAdoptServer_(d.libRead, true);
    if(Object.keys(now).length) libPush_();
    if(S.view==='week' || S.view==='profile') render();
  }, function(){ S.libPushing=false; });   // offline: kept, and sent with the next change or page open
}
function libBooksRead_(){ return Object.keys(libRead_()).length; }
/* The tally, wherever it shows — tap it and the Library opens. */
function libOpen_(){ S.view='library'; S.libBook=null; S.libStep=null; S.libShelf='all'; libLoad_(); render(); window.scrollTo(0,0); }

/* ==================== required: papers every staff member signs ====================
   What every profile must have done (Uriah, Oct 2026): the Child Protection
   Policy and the Staff Manual read and signed here, and a staff contract on
   file with HR. The list of papers is HR's (HR → Required); the server says
   what each person still needs (S.required, from the boot). Until it is all
   done, My Home has a card for it, and admins and HR see "Profile unfinished"
   on that person's profile.

   Signing: open the paper, tick that you have read it, type your full name,
   and draw your signature with a finger. The drawn signature is kept as a
   small picture; a new version of a paper asks everyone to sign again. */
S.reqDocs=[]; S.required=null; S.reqDocId=null; S.reqOpened={}; S.reqAgree=false; S.reqName=''; S.reqSig=null; S.reqBusy=false;
function reqItemLine_(x, other){
  if(x.kind==='legal') return x.done ? gpT('Signed {date}',{date:teamDate_(String(x.at).slice(0,10))}) : other ? t('Not signed yet') : t('Read and sign — in My contract');
  if(x.kind==='contract'){
    if(other && !x.done) return x.state==='expired' ? t('Contract has run out') : t('No contract on file');
    return x.done ? gpT('On file — runs to {date}',{date:x.ends ? teamDate_(x.ends) : ''})
      : x.state==='expired' ? t('Your contract has run out — talk to HR') : t('No contract on file yet — talk to HR');
  }
  return x.done ? gpT('Signed {date}',{date:teamDate_(String(x.at).slice(0,10))}) : x.older ? t('New version — read and sign again') : t('Read and sign');
}
function reqTitle_(x){ return x.kind==='contract' ? t('Staff contract') : x.title; }
/* The rows of one person's list. `open` makes the papers tappable (your own). */
function reqRowsHtml_(R, opts){
  opts=opts||{};
  return R.items.map(function(x){
    var mine = opts.own && (x.kind==='legal' || (x.kind==='contract' && x.done));
    var tap = mine || (x.kind==='doc' && (opts.own || (opts.staffId && x.done)));
    var attrs = !tap ? '' : mine ? ' data-reqmy="1"' : opts.own ? ' data-reqopen="'+esc(x.id)+'"' : ' data-reqsigof="'+esc(x.id)+'|'+esc(opts.staffId)+'"';
    return '<'+(tap?'button':'div')+' class="reqRow'+(x.done?' done':'')+'"'+attrs+'>'+
      '<span class="reqMark">'+(x.done?'✓':x.kind==='contract'?'📄':'✍️')+'</span>'+
      '<span class="reqText"><b>'+esc(reqTitle_(x))+'</b><span>'+esc(reqItemLine_(x, !!opts.staffId))+(tap && !opts.own ? ' · '+esc(t('View signature')) : '')+'</span></span>'+
      (tap?PCHEV:'')+'</'+(tap?'button':'div')+'>';
  }).join('');
}
/* My contract: how much of the profile is done, and the papers HR asks
   everyone to read and sign (the agreement and the contract are further down
   the same page). */
function reqMyContractCardHtml_(){
  var R=S.required;
  if(!R) return '';
  var papers={ items:(R.items||[]).filter(function(x){ return x.kind==='doc'; }) };
  if(R.finished) return '<div class="reqOk" id="reqCard">✅ '+esc(t('Profile complete'))+'</div>';
  return '<div class="card reqCard" id="reqCard"><div class="reqHead"><span class="reqHeadIcon">✍️</span><span style="flex:1"><b>'+esc(t('Finish your profile'))+'</b>'+
    '<span class="reqHeadSub">'+esc(gpT('{n} of {m} done — every staff member signs these',{n:R.done, m:R.total}))+'</span></span></div>'+
    '<div class="reqBar"><span style="width:'+Math.round(R.done/Math.max(1,R.total)*100)+'%"></span></div>'+
    (papers.items.length ? reqRowsHtml_(papers, { own:true }) : '')+'</div>';
}
/* My profile: always, done or not. */
function reqProfileCardHtml_(){
  var R=S.required;
  if(!R) return '';
  return '<div class="card reqCard"><div class="reqHead"><span class="reqHeadIcon">'+(R.finished?'✅':'✍️')+'</span><span style="flex:1"><b>'+
    esc(R.finished ? t('Profile complete') : t('Profile unfinished'))+'</b><span class="reqHeadSub">'+esc(gpT('{n} of {m} done',{n:R.done, m:R.total}))+'</span></span></div>'+
    reqRowsHtml_(R, { own:true })+'</div>';
}
/* A teammate's profile, for admins and HR (and yourself): the server only sends it to them. */
function reqPersonCardHtml_(d){
  var R=d && d.required;
  if(!R) return '';
  var mine=d.isMe;
  if(R.finished) return '<div class="reqOk">✅ '+esc(t('Profile complete'))+'</div>';
  return '<div class="card reqCard reqAlert"><div class="reqHead"><span class="reqHeadIcon">⚠️</span><span style="flex:1"><b>'+esc(t('Profile unfinished'))+'</b>'+
    '<span class="reqHeadSub">'+esc(gpT('{n} of {m} done',{n:R.done, m:R.total}))+'</span></span></div>'+
    reqRowsHtml_(R, mine ? { own:true } : { staffId:d.staff.id })+'</div>';
}
function reqDocById_(id){ return (S.reqDocs||[]).filter(function(x){ return x.id===id; })[0]; }
function reqOpenDoc_(doc, btn){
  if(!doc) return;
  S.reqOpened[doc.id]=true;
  if(doc.kind==='link'){ window.open(doc.url, '_blank', 'noopener'); render(); return; }
  if(btn){ btn.disabled=true; btn.textContent=t('Opening…'); }
  run('reqDocFile',[S.auth.user,S.auth.pin,doc.id],function(d){
    if(d && d.ok) hrOpenDataUrl_(d.dataUrl, d.name); else showMsg(t('Could not open the file'));
    render();
  });
}
/* The page for one paper: read it, agree, name, signature, sign. */
function reqSignHtml(){
  var doc=reqDocById_(S.reqDocId);
  var back='<button class="linkbtn" id="reqBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My contract'))+'</button>';
  if(!doc) return back+'<p class="sub">'+esc(t('This document is no longer on the list.'))+'</p>';
  var item=((S.required&&S.required.items)||[]).filter(function(x){ return x.id===doc.id; })[0]||{};
  var h=back+'<h2>✍️ '+esc(doc.title)+'</h2>';
  if(item.done){
    return h+'<div class="card"><p style="margin:0 0 10px;font-size:15.5px">✅ '+esc(gpT('You signed this on {date}.',{date:teamDate_(String(item.at).slice(0,10))}))+'</p>'+
      '<button class="btn ghost" id="reqRead">📄 '+esc(t('Read it again'))+'</button>'+
      '<button class="btn ghost" id="reqMine">'+esc(t('View my signature'))+'</button><div id="reqMineBox"></div></div>';
  }
  var opened=!!S.reqOpened[doc.id];
  h+='<p class="sub">'+esc(item.older ? t('There is a new version. Please read it again and sign.') : t('Every staff member reads this and signs it. It takes a few minutes.'))+'</p>';
  h+='<div class="card reqStep'+(opened?' done':'')+'"><div class="reqStepHead"><span class="reqStepNum">1</span><b>'+esc(t('Read it'))+'</b></div>'+
    '<button class="btn'+(opened?' ghost':'')+'" id="reqRead">📄 '+esc(opened ? t('Open it again') : t('Open the document'))+'</button>'+
    (doc.kind==='file' && doc.fileName ? '<div class="hint">'+esc(doc.fileName)+'</div>' : '')+'</div>';
  h+='<div class="card reqStep'+(opened?'':' off')+'"><div class="reqStepHead"><span class="reqStepNum">2</span><b>'+esc(t('Agree and sign'))+'</b></div>'+
    '<label class="reqAgree"><input type="checkbox" id="reqAgree"'+(S.reqAgree?' checked':'')+(opened?'':' disabled')+'> <span>'+
      esc(gpT('I have read and understood the {title}, and I agree to follow it.',{title:doc.title}))+'</span></label>'+
    '<label class="f">'+esc(t('Your full name'))+'</label><input type="text" id="reqName" autocomplete="name" value="'+esc(S.reqName||'')+'" placeholder="'+esc(S.me?S.me.name:'')+'"'+(opened?'':' disabled')+'>'+
    '<label class="f">'+esc(t('Your signature'))+'</label>'+
    '<div class="sigWrap'+(opened?'':' off')+'"><canvas id="reqSigPad" class="sigPad"></canvas><span class="sigLine"></span>'+
      '<span class="sigHint" id="reqSigHint"'+(S.reqSig?' style="display:none"':'')+'>'+esc(t('Sign here with your finger'))+'</span></div>'+
    '<button class="linkbtn inline" id="reqSigClear">'+esc(t('Clear'))+'</button>'+
    '<button class="btn" id="reqSignBtn"'+(S.reqBusy?' disabled':'')+'>'+esc(S.reqBusy ? t('Saving…') : t('Sign'))+'</button>'+
    '<div class="hint" id="reqSignHint"></div></div>';
  return h+'<p class="pFine">'+esc(t('Your signature is kept with the date and your name. Only you, admins and HR can see it.'))+'</p>';
}
/* A finger (or mouse) signature pad. The picture is drawn at most 2× so the
   saved PNG stays a few KB; ink is a fixed dark blue so it reads on paper in
   either theme. */
function reqSigPad_(canvas, onChange){
  var ratio=Math.min(2, window.devicePixelRatio||1), ctx=canvas.getContext('2d'), drawing=false, last=null, ink=0;
  var size=function(){ var r=canvas.getBoundingClientRect(); canvas.width=Math.round(r.width*ratio); canvas.height=Math.round(r.height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth=2.4; ctx.strokeStyle='#1B2A6B'; };
  size();
  var at=function(e){ var r=canvas.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; };
  canvas.addEventListener('pointerdown', function(e){ drawing=true; last=at(e); canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    ctx.beginPath(); ctx.arc(last.x,last.y,1.1,0,Math.PI*2); ctx.fillStyle=ctx.strokeStyle; ctx.fill(); ink++; e.preventDefault(); });
  canvas.addEventListener('pointermove', function(e){ if(!drawing) return; var p=at(e);
    ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke(); last=p; ink++; e.preventDefault(); });
  var end=function(){ if(!drawing) return; drawing=false; if(onChange) onChange(ink>8 ? canvas.toDataURL('image/png') : null); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('pointerleave', end);
  return { clear:function(){ ctx.clearRect(0,0,canvas.width,canvas.height); ink=0; if(onChange) onChange(null); } };
}
function bindReqSign_(){
  var bk=document.getElementById('reqBack');
  if(bk) bk.onclick=function(){ gpTap(); S.reqDocId=null; openMyContract_(); };
  var doc=reqDocById_(S.reqDocId); if(!doc) return;
  var rd=document.getElementById('reqRead');
  if(rd) rd.onclick=function(){ gpTap(); reqOpenDoc_(doc, rd); };
  var ag=document.getElementById('reqAgree');
  if(ag) ag.onchange=function(){ S.reqAgree=ag.checked; };
  var nm=document.getElementById('reqName');
  if(nm) nm.oninput=function(){ S.reqName=nm.value; };
  var pad=document.getElementById('reqSigPad'), hint=document.getElementById('reqSigHint');
  var sp = (pad && S.reqOpened[doc.id]) ? reqSigPad_(pad, function(img){ S.reqSig=img; if(hint) hint.style.display=img?'none':''; var w=document.getElementById('reqSignHint'); if(w && img) w.textContent=''; }) : null;
  if(pad && S.reqSig){   // drawn before a re-render: put it back
    var im=new Image(); im.onload=function(){ var c=pad.getContext('2d'); c.save(); c.setTransform(1,0,0,1,0,0); c.drawImage(im,0,0,pad.width,pad.height); c.restore(); }; im.src=S.reqSig;
  }
  var cl=document.getElementById('reqSigClear');
  if(cl) cl.onclick=function(){ if(sp) sp.clear(); S.reqSig=null; if(hint) hint.style.display=''; };
  var sb=document.getElementById('reqSignBtn'), why=document.getElementById('reqSignHint');
  if(sb) sb.onclick=function(){
    var say=function(m){ if(why) why.textContent=m; };
    if(!S.reqOpened[doc.id]) return say(t('Open the document first.'));
    if(!S.reqAgree) return say(t('Tick the box to say you have read it.'));
    if(String(S.reqName||'').trim().length<2) return say(t('Type your full name.'));
    if(!S.reqSig) return say(t('Draw your signature in the box.'));
    S.reqBusy=true; render();
    run('reqSign',[S.auth.user,S.auth.pin,doc.id,doc.version,String(S.reqName).trim(),S.reqSig],function(d){
      S.reqBusy=false;
      if(d && d.ok){ S.required=d.required; S.reqDocs=d.docs||S.reqDocs; S.reqAgree=false; S.reqName=''; S.reqSig=null; gpTap(); showMsg(t('Signed — thank you')); }
      else if(d && d.err==='new_version'){ S.reqDocs=d.docs||S.reqDocs; S.reqOpened[doc.id]=false; showMsg(t('This document was just updated — please open it again.')); }
      else showMsg(t('Could not sign — try again.'));
      render();
    }, function(){ S.reqBusy=false; showMsg(t('No connection — your signature was not sent. Try again when you are online.')); render(); });
  };
  var mine=document.getElementById('reqMine');
  if(mine) mine.onclick=function(){ reqShowSig_(doc.id, S.me.id, document.getElementById('reqMineBox')); };
}
/* A saved signature, shown in place (yours, or anyone's for admins / HR). */
function reqShowSig_(docId, staffId, box){
  if(!box) return;
  box.innerHTML='<p class="hint">'+esc(t('Loading…'))+'</p>';
  run('reqSignature',[S.auth.user,S.auth.pin,docId,staffId],function(d){
    if(!d || !d.ok){ box.innerHTML='<p class="hint">'+esc(t('Could not load the signature.'))+'</p>'; return; }
    box.innerHTML='<div class="sigShow"><img alt="" src="'+esc(d.sig)+'"><div class="hint">'+esc(d.name)+' · '+esc(teamDate_(String(d.at).slice(0,10)))+
      (d.title?' · '+esc(d.title):'')+' · v'+esc(String(d.v))+'</div></div>';
  });
}
/* Rows of a list that open the paper (yours) or a signature (admins / HR). */
function bindReqRows_(){
  document.querySelectorAll('[data-reqmy], #goMyContract').forEach(function(b){ b.onclick=function(){ gpTap(); openMyContract_(); }; });
  document.querySelectorAll('[data-reqopen]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.reqDocId=b.getAttribute('data-reqopen'); S.reqAgree=false; S.reqName=''; S.reqSig=null; S.view='required'; render(); window.scrollTo(0,0); };
  });
  document.querySelectorAll('[data-reqsigof]').forEach(function(b){
    b.onclick=function(){
      var v=b.getAttribute('data-reqsigof'), i=v.indexOf('|'), box=b.nextElementSibling;
      if(!box || !box.classList.contains('reqSigBox')){ box=document.createElement('div'); box.className='reqSigBox'; b.parentNode.insertBefore(box, b.nextSibling); }
      else if(box.innerHTML){ box.innerHTML=''; return; }
      reqShowSig_(v.slice(0,i), v.slice(i+1), box);
    };
  });
}

/* ---------- HR → Required: the papers, and everyone's progress ----------
   For admins and HR. Add a paper (a title, then a PDF or a link), replace its
   file (and choose whether everyone signs again), rename or remove it; and see
   who has finished, who is missing what, and open anyone's signature. */
S.reqAll=null; S.reqAllErr=''; S.reqFilter='open'; S.reqEdit=null; S.reqResign={}; S.reqOpenPerson=null;
function reqAllLoad_(){
  if(S.reqAllLoading) return;
  S.reqAllErr=''; S.reqAllLoading=true;
  run('reqStatusAll',[S.auth.user,S.auth.pin],function(d){
    S.reqAllLoading=false;
    if(d && d.ok){ S.reqAll=d; S.reqDocs=d.docs||S.reqDocs; } else S.reqAllErr=(d&&d.err)||'error';
    if(S.view==='hr') render();
  }, function(e){ S.reqAllLoading=false; S.reqAllErr=String((e&&e.message)||'offline'); if(S.view==='hr') render(); });
}
var REQ_SUGGEST=['Child Protection Policy','Staff Manual'];
function reqHrHtml_(){
  var h='<p class="sub">'+esc(t('Papers every staff member reads and signs in the app. With a current staff contract, they are what makes a profile complete.'))+'</p>';
  if(S.reqAllErr) return h+'<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load the list.'))+'</p><button class="btn ghost" id="reqAllRetry">'+esc(t('Try again'))+'</button></div>';
  if(!S.reqAll){ reqAllLoad_(); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'; }
  var docs=S.reqAll.docs||[], people=S.reqAll.people||[];
  h+='<h3>📄 '+esc(t('Documents'))+'</h3>';
  docs.forEach(function(doc){
    var signed=people.filter(function(p){ return p.required.items.some(function(x){ return x.id===doc.id && x.done; }); }).length;
    var editing=S.reqEdit && S.reqEdit.id===doc.id;
    h+='<div class="card reqDocCard"><div class="reqDocTop"><b>'+esc(doc.title)+'</b><span class="hrChip '+(doc.kind==='none'?'due':'active')+'">'+
      esc(doc.kind==='none' ? t('No file yet') : gpT('{n} of {m} signed',{n:signed, m:people.length}))+'</span></div>'+
      '<div class="hint">'+esc(doc.kind==='file' ? doc.fileName+' · '+Math.max(1,Math.round(doc.size/1024))+' KB' : doc.kind==='link' ? doc.url : t('Add the PDF or a link so people can read it.'))+
      ' · v'+doc.version+(doc.updated?' · '+esc(teamDate_(doc.updated.slice(0,10))):'')+'</div>';
    if(editing){
      h+='<label class="f">'+esc(t('Title'))+'</label><input type="text" id="reqEditTitle" value="'+esc(S.reqEdit.title)+'">'+
        '<label class="f">'+esc(t('Or a link instead of a file'))+'</label><input type="url" id="reqEditUrl" value="'+esc(S.reqEdit.url)+'" placeholder="https://…">'+
        '<div class="btnRow"><button class="btn" id="reqEditSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="reqEditCancel">'+esc(t('Cancel'))+'</button></div>';
    } else {
      h+='<div class="reqDocBtns">'+(doc.kind!=='none'?'<button class="linkbtn inline" data-reqhropen="'+esc(doc.id)+'">'+esc(t('Open'))+'</button>':'')+
        '<label class="linkbtn inline reqUpload">'+esc(doc.kind==='file' ? t('Replace file') : t('Upload PDF'))+
          '<input type="file" accept="application/pdf,image/*" data-requpload="'+esc(doc.id)+'" style="display:none"></label>'+
        '<button class="linkbtn inline" data-reqedit="'+esc(doc.id)+'">'+esc(t('Edit'))+'</button>'+
        '<button class="linkbtn inline" data-reqdel="'+esc(doc.id)+'">'+esc(t('Remove'))+'</button></div>'+
        (doc.kind!=='none' ? '<label class="hrToggle"><input type="checkbox" data-reqresign="'+esc(doc.id)+'"'+(S.reqResign[doc.id]!==false?' checked':'')+'> '+
          esc(t('A new file asks everyone to sign again'))+'</label>' : '');
    }
    h+='</div>';
  });
  var missing=REQ_SUGGEST.filter(function(x){ return !docs.some(function(d){ return d.title.toLowerCase()===x.toLowerCase(); }); });
  h+='<div class="card"><label class="f">'+esc(t('Add a document'))+'</label>'+
    (missing.length?'<div class="chips" style="margin:0 0 8px">'+missing.map(function(x){ return '<button class="chip blue" data-reqsuggest="'+esc(x)+'">+ '+esc(t(x))+'</button>'; }).join('')+'</div>':'')+
    '<div class="numIn"><input type="text" id="reqNewTitle" placeholder="'+esc(t('Document title'))+'">'+
    '<button class="btn ghost" style="margin:0;width:auto;padding:9px 14px" id="reqNewAdd">'+esc(t('Add'))+'</button></div></div>';

  var fin=people.filter(function(p){ return p.required.finished; }).length;
  var contracts=people.filter(function(p){ return p.required.items.some(function(x){ return x.kind==='contract' && x.done; }); }).length;
  h+='<h3>👥 '+esc(t('Everyone'))+'</h3><div class="mmGrid">'+[
      [t('Profiles complete'), fin+' / '+people.length, fin<people.length],
      [t('Contracts on file'), contracts+' / '+people.length, false]
    ].concat(docs.filter(function(d){ return d.kind!=='none'; }).map(function(doc){
      var n=people.filter(function(p){ return p.required.items.some(function(x){ return x.id===doc.id && x.done; }); }).length;
      return [doc.title, n+' / '+people.length, false];
    })).map(function(x){ return '<div class="mmTile'+(x[2]?' hot':'')+'"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  h+='<div class="seg" style="margin:8px 0 10px"><button data-reqfilter="open" class="'+(S.reqFilter==='open'?'on':'')+'">'+esc(gpT('Unfinished ({n})',{n:people.length-fin}))+'</button>'+
    '<button data-reqfilter="all" class="'+(S.reqFilter==='all'?'on':'')+'">'+esc(gpT('Everyone ({n})',{n:people.length}))+'</button></div>';
  var shown=people.filter(function(p){ return S.reqFilter==='all' || !p.required.finished; }).sort(function(a,b){ return a.name<b.name?-1:1; });
  if(!shown.length) return h+'<p class="sub">🎉 '+esc(t('Everyone is finished.'))+'</p>';
  h+='<div class="accCard adminList">'+shown.map(function(p){
    var R=p.required, open=S.reqOpenPerson===p.id;
    return '<div><button class="adminRow" data-reqperson="'+esc(p.id)+'">'+avatarHtml(p,'sm')+
      '<span class="adminRowText"><span class="rowName">'+esc(p.name)+'</span><span class="rowSub">'+esc(campusShort(p.campus)+' · '+t(p.dept))+'</span></span>'+
      '<span class="hrChip '+(R.finished?'active':'due')+'">'+esc(R.finished ? t('Complete') : gpT('{n} of {m}',{n:R.done, m:R.total}))+'</span></button>'+
      (open ? '<div class="reqPersonRows">'+reqRowsHtml_(R, { staffId:p.id })+'</div>' : '')+'</div>';
  }).join('')+'</div>';
  return h;
}
function reqReadFile_(file, cb){
  var mime=file.type || (/\.pdf$/i.test(file.name)?'application/pdf':'');
  var fr=new FileReader();
  fr.onload=function(){ var s=String(fr.result||''), i=s.indexOf(','); cb(mime, i>-1 ? s.slice(i+1) : ''); };
  fr.onerror=function(){ showMsg(t('Could not read that file')); };
  fr.readAsDataURL(file);
}
function bindReqHr_(){
  var rt=document.getElementById('reqAllRetry'); if(rt) rt.onclick=function(){ S.reqAll=null; render(); };
  var done=function(d){ if(d && d.ok){ S.reqDocs=d.docs||S.reqDocs; S.reqAll=null; S.reqEdit=null; showMsg(t('Saved')); }
    else showMsg(d && d.err==='too_large' ? t('That file is too big — up to about 4 MB. Try a smaller PDF, or a link.') : d && d.err==='bad_type' ? t('A PDF or a picture, please.') : d && d.err==='bad_link' ? t('That link does not look right — it starts with https://') : t('Could not save — try again.'));
    render(); };
  var add=function(title){ title=String(title||'').trim(); if(!title) return; run('reqDocSave',[S.auth.user,S.auth.pin,{title:title}],done); };
  var na=document.getElementById('reqNewAdd'), nt=document.getElementById('reqNewTitle');
  if(na) na.onclick=function(){ add(nt && nt.value); };
  document.querySelectorAll('[data-reqsuggest]').forEach(function(b){ b.onclick=function(){ add(b.getAttribute('data-reqsuggest')); }; });
  document.querySelectorAll('[data-reqhropen]').forEach(function(b){ b.onclick=function(){ reqOpenDoc_(reqDocById_(b.getAttribute('data-reqhropen')), b); }; });
  document.querySelectorAll('[data-reqresign]').forEach(function(c){ c.onchange=function(){ S.reqResign[c.getAttribute('data-reqresign')]=c.checked; }; });
  document.querySelectorAll('[data-requpload]').forEach(function(inp){
    inp.onchange=function(){
      var f=inp.files && inp.files[0], id=inp.getAttribute('data-requpload'); if(!f) return;
      if(f.size>4.1*1024*1024){ showMsg(t('That file is too big — up to about 4 MB. Try a smaller PDF, or a link.')); return; }
      showMsg(t('Uploading…'));
      reqReadFile_(f, function(mime, b64){ run('reqDocUpload',[S.auth.user,S.auth.pin,id,f.name,mime,b64,S.reqResign[id]!==false],done); });
    };
  });
  document.querySelectorAll('[data-reqedit]').forEach(function(b){ b.onclick=function(){ var d=reqDocById_(b.getAttribute('data-reqedit')); if(!d) return; S.reqEdit={id:d.id,title:d.title,url:d.url||''}; render(); }; });
  var es=document.getElementById('reqEditSave'), ec=document.getElementById('reqEditCancel');
  if(ec) ec.onclick=function(){ S.reqEdit=null; render(); };
  if(es) es.onclick=function(){
    var ti=document.getElementById('reqEditTitle'), ur=document.getElementById('reqEditUrl');
    run('reqDocSave',[S.auth.user,S.auth.pin,{id:S.reqEdit.id, title:ti.value, url:String(ur.value||'').trim(), resign:S.reqResign[S.reqEdit.id]!==false}],done);
  };
  document.querySelectorAll('[data-reqdel]').forEach(function(b){ b.onclick=function(){
    var d=reqDocById_(b.getAttribute('data-reqdel')); if(!d) return;
    if(!confirm(gpT('Remove “{title}”? It will no longer be asked of anyone.',{title:d.title}))) return;
    run('reqDocDelete',[S.auth.user,S.auth.pin,d.id],done);
  }; });
  document.querySelectorAll('[data-reqfilter]').forEach(function(b){ b.onclick=function(){ S.reqFilter=b.getAttribute('data-reqfilter'); render(); }; });
  document.querySelectorAll('[data-reqperson]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-reqperson'); S.reqOpenPerson = S.reqOpenPerson===id ? null : id; render(); }; });
  bindReqRows_();
}

/* ==================== looking around without an account ====================
   "Look around" on the log-in screen (Uriah, Oct 2026: people who want to see
   the app and its tools without making a username). A guest gets the app's
   shell with what is safe to show anyone:
     • the whole Library — read ticks stay on this phone, and go up to the
       account if they make a profile later (libAdoptServer_);
     • Base — the public base figures (getData with no code: the same numbers
       the front door's guest dashboard has always shown, money metrics never);
     • My Home as a tour of every tool, each saying what it does.
   Team and Health stay locked with a reason: one is people's names, photos and
   goals, the other private check-ins. Nothing a guest does calls the server
   with credentials — S.auth stays empty, so every save path is never reached.
   Kept on this phone (gp-app-guest) until they log in or make a profile. */
var GUEST_KEY='gp-app-guest';
var GUEST_VIEWS=['week','base','team','health','library'];
function gpGuestMe_(){
  return { id:'guest', name:t('Guest'), username:'', campus: lsGet('gp-guest-campus') || 'siemreap', dept:'', ministry:'', role:'',
    photo:'', staffType:'campus', country:'—', ministries:[], leads:[], guest:true };
}
function gpEnterGuest_(){
  lsSet(GUEST_KEY, '1');
  S.guest=true; S.me=gpGuestMe_(); S.profile={}; S.auth={ user:'', pin:'' }; S.regMode=false;
  S.view='week'; S.roster=[]; S.required=null; S.reqDocs=[];
  gpGuestLoadBase_();
  render(); window.scrollTo(0,0);
}
function gpGuestLoadBase_(){
  /* The staff count and its kinds come from the roster. A guest gets the public
     one with every name and photo dropped on arrival — counts only, nobody named. */
  var roster=new Promise(function(done){
    run('teamRoster', [], function(r){
      if(Array.isArray(r)) S.roster=r.map(function(p, i){ return { id:'g'+i, name:'', campus:p.campus, dept:p.dept, ministry:p.ministry||'', staffType:p.staffType||'', country:p.country||'', photo:'', leads:[], ministries:[] }; });
      done();
    }, function(){ done(); });
  });
  var base=new Promise(function(done){
    run('getData', [''], function(d){ if(d && d.entries){ S.base=Object.assign({}, d, { roster: undefined }); } done(); }, function(){ done(); });
  });
  return Promise.all([roster, base]).then(function(){ if(S.guest) render(); });
}
function gpGuestCampusHtml_(){
  return '<div class="campusSeg guestCampus">'+CAMPUSES.map(function(c){
    return '<button class="campusBtn'+(S.me.campus===c.id?' on':'')+'" data-guestcampus="'+esc(c.id)+'">'+esc(t(c.short))+'</button>'; }).join('')+'</div>';
}
function gpLeaveGuest_(toRegister){
  lsDel(GUEST_KEY);
  S.guest=false; S.me=null; S.base=null; S.regMode=!!toRegister; S.menuOpen=false; S.view='week';
  renderMenu(); render(); window.scrollTo(0,0);
}
function gpGuestButtonsHtml_(){
  return '<div class="btnRow guestBtns"><button class="btn" data-guestgo="reg">'+esc(t('Create my profile'))+'</button>'+
    '<button class="btn ghost" data-guestgo="login">'+esc(t('Log in'))+'</button></div>';
}
var GUEST_TOOLS=[
  ['🗒️','Weekly goals','Write a few goals each week and tick them off — your team can cheer you on.'],
  ['🔁','Habit tracker','Small daily habits — prayer, the Bible, exercise, rest — and your streaks.'],
  ['💚','Weekly health check-in','A few honest questions each week. Private: only you and your mentor see your answers.'],
  ['📊','My Ministry','Log your ministry’s numbers each week and watch them add up for the whole base.'],
  ['🧭','Personality type','A forty-question test, your type, and how to work well with every type on your team.'],
  ['💪','Strengths','Find your top five strengths and see the mix on your team.'],
  ['🤝','Mentorship','Choose a mentor to walk with you, and meet one-on-one.'],
  ['✈️','Leave requests','Ask for days away, and see who is covering.'],
  ['👥','Team directory','Everyone on the base: their ministries, goals, types and strengths.']
];
function gpGuestHomeHtml_(){
  var nb=libBooksRead_(), books=(typeof GP_LIBRARY!=='undefined') ? GP_LIBRARY.books.length : 0;
  var h='<div class="card guestHero"><div class="guestHeroIcon">👀</div><h2>'+esc(t('You’re looking around'))+'</h2>'+
    '<p>'+esc(t('This is the GP app, as a guest. Read the Library, see how the base is doing, and see what every tool does. Nothing here is saved to an account.'))+'</p>'+
    gpGuestButtonsHtml_()+'</div>';
  h+='<button class="card guestBig" id="guestLibrary"><span class="guestBigIcon">📚</span><span style="flex:1"><b>'+esc(t('Library'))+'</b>'+
    '<span>'+esc(nb ? gpT('{n} books read',{n:nb}) : t('Ten-minute reads of the best books on leading, culture, habits and creativity, and the YWAM classics — the big ideas, made for us.'))+'</span></span>'+PCHEV+'</button>';
  h+='<button class="card guestBig" id="guestBase"><span class="guestBigIcon">📈</span><span style="flex:1"><b>'+esc(t('Base'))+'</b>'+
    '<span>'+esc(t('How the base is doing this week — ministry numbers for Siem Reap and Poipet.'))+'</span></span>'+PCHEV+'</button>';
  h+='<h3>✨ '+esc(t('What staff use the app for'))+'</h3><div class="guestTools">'+GUEST_TOOLS.map(function(x){
    return '<div class="card guestTool"><span class="guestToolIcon">'+x[0]+'</span><span style="flex:1"><b>'+esc(t(x[1]))+'</b><span>'+esc(t(x[2]))+'</span></span><span class="guestLock" aria-label="'+esc(t('Needs a profile'))+'">🔒</span></div>';
  }).join('')+'</div>';
  h+='<div class="card guestFoot"><p>'+esc(t('Staff at YWAM GonPreah use all of this with their own profile. It takes a minute to make one.'))+'</p>'+gpGuestButtonsHtml_()+'</div>';
  return h;
}
function gpGuestLockHtml_(which){
  var team = which==='team';
  return '<div class="gate guestGate"><div class="gateIcon">'+(team?'👥':'💚')+'</div>'+
    '<h3>'+esc(t('This part is for staff with a profile'))+'</h3>'+
    '<p>'+esc(team ? t('The team directory shows people’s names, photos and goals, so it is only for people on the base.')
      : t('The weekly check-in is private — only you and your mentor ever see your answers. It needs your own profile.'))+'</p>'+
    gpGuestButtonsHtml_()+'</div>';
}
function bindGuest_(){
  document.querySelectorAll('[data-guestgo]').forEach(function(b){ b.onclick=function(){ gpTap(); gpLeaveGuest_(b.getAttribute('data-guestgo')==='reg'); }; });
  var gl=document.getElementById('guestLibrary'); if(gl) gl.onclick=function(){ gpTap(); libOpen_(); };
  var gb=document.getElementById('guestBase'); if(gb) gb.onclick=function(){ gpTap(); S.view='base'; render(); window.scrollTo(0,0); };
  document.querySelectorAll('[data-guestcampus]').forEach(function(b){ b.onclick=function(){ gpTap(); S.me.campus=b.getAttribute('data-guestcampus'); lsSet('gp-guest-campus', S.me.campus); render(); }; });
}

/* ==================== YWAM GP: titles, GP leadership, the advisory board ====================
   Oct 2026 (Uriah). YWAM GP is four parts now: YWAM Poipet, YWAM Siem Reap, YWAM GP (the
   whole organisation) and the YWAM GP Advisory Board. From getYwamGp (in the boot as
   `org`): each Campus Leadership person's title — International / National Campus
   Director, Director of <department> — the YWAM GP roles, each campus's leadership
   team, and the board, whom every staff member can see and contact. A board member
   who is not staff signs in to a board-only view (S.board): the YWAM GP page, both
   campuses as the board sees them, and the Library — nothing staff. */
function orgTitleOf_(p){
  if(!p || p.dept!==BL_DEPT) return '';
  var srv=S.org && S.org.titles && S.org.titles[p.id];
  if(p.ministry==='Campus Director') return (srv && /Campus Director$/.test(srv)) ? srv : 'Campus Director';
  return p.ministry ? 'Director of '+p.ministry : '';
}
/* YWAM GP's leadership team: its Director(s), and a lead for each of five areas. */
var GP_ROLES=[['director','YWAM GP Director'],['campuses','Campuses Lead'],['leaders','Leaders Lead'],['music','Music Lead'],['media','Media Lead'],['education','Education Lead']];
function gpRoleLabel_(id){ var r=GP_ROLES.filter(function(x){ return x[0]===id; })[0]; return r ? t(r[1]) : ''; }
function orgTitleText_(title){
  var m=/^Director of (.+)$/.exec(title||'');
  return m ? gpT('Director of {dept}',{dept:t(m[1])}) : t(title||'');
}
function orgCampus_(c){ return ((S.org && S.org.campuses) || []).filter(function(x){ return x.id===c; })[0] || null; }
function orgLoad_(){
  if(S.orgLoading) return;
  var a=S.board ? S.boardAuth : S.auth;
  if(!a || !a.user) return;
  S.orgLoading=true;
  run('getYwamGp',[a.user,a.pin],function(d){ S.orgLoading=false; if(d && d.ok){ S.org=d; render(); } else if(S.board) boardLeave_(true); },
    function(){ S.orgLoading=false; });
}
function orgPersonRowHtml_(p, sub){
  var me=S.me && !S.board && p.id===S.me.id, tag=S.board ? 'div' : 'button';
  return '<'+tag+' class="orgCltRow'+(me?' me':'')+'"'+(S.board ? '' : ' data-orgperson="'+esc(p.id)+'"')+'>'+avatarHtml(p,'sm')+
    '<span class="orgCltText"><b>'+esc(p.name)+(me ? ' · '+esc(t('you')) : '')+'</b><small>'+esc(sub)+'</small></span>'+(S.board ? '' : '<span class="ooChev">›</span>')+'</'+tag+'>';
}
/* A campus's leadership team: the two campus directors, then a director per department. */
function orgCltCardHtml_(c){
  var oc=orgCampus_(c), list=oc ? oc.clt : [];
  var h='<div class="card orgClt"><div class="mentorLabel">🧭 '+esc(t('Campus Leadership Team'))+' · '+esc(t(campusName(c)))+'</div>';
  if(!S.org) h+='<p class="sub" style="margin:4px 0">'+esc(t('Loading…'))+'</p>';
  else if(!list.length) h+='<p class="sub" style="margin:4px 0">'+esc(t('Nobody here yet'))+'</p>';
  list.forEach(function(p){ h+=orgPersonRowHtml_(p, orgTitleText_(p.title)); });
  return h+'</div>';
}
function orgBoardMemberHtml_(b){
  var acts=(b.email ? '<a class="btn ghost orgAct" href="mailto:'+encodeURIComponent(b.email)+'">✉️ '+esc(t('Email'))+'</a>' : '')+
    (b.phone ? '<a class="btn ghost orgAct" href="tel:'+esc(b.phone.replace(/[^\d+]/g,''))+'">📞 '+esc(t('Call'))+'</a>' : '');
  return '<div class="card orgMember"><div class="mentorBlock" style="padding:0">'+avatarHtml(b,'lg')+
    '<div style="flex:1;min-width:0"><div class="mentorName">'+esc(b.name)+'</div><div class="orgRole">'+esc(t(b.role))+'</div>'+
      (b.safeguarding ? '<div class="orgSafe">🛡️ '+esc(t('Safeguarding contact'))+'</div>' : '')+'</div></div>'+
    (b.bio ? '<p class="orgBio">'+esc(b.bio)+'</p>' : '')+
    (acts ? '<div class="orgActs">'+acts+'</div>' : '')+'</div>';
}
function ywamGpHtml(){
  var O=S.org;
  if(!O) orgLoad_();
  var h='';
  if(S.board && S.me) h+='<div class="card orgWelcome"><div class="mentorBlock" style="padding:0">'+avatarHtml(S.me,'lg')+
    '<div><div class="mentorName">'+esc(gpT('Welcome, {name}',{name:S.me.name}))+'</div><div class="orgRole">'+esc(t(S.me.boardRole||'Advisor'))+' · '+esc(t('YWAM GP Advisory Board'))+'</div></div></div></div>';
  h+='<h2>🌏 '+esc(t('YWAM GP'))+'</h2><p class="sub">'+esc(t('One family in four parts: YWAM Poipet, YWAM Siem Reap, YWAM GP’s own leadership, and the YWAM GP Advisory Board.'))+'</p>';
  if(!O) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  var empty=GP_ROLES.filter(function(r){ return !O.gp.some(function(p){ return p.gpRole===r[0]; }); }).length;
  if(S.me && S.me.isAdmin && !S.board && empty) h+='<div class="banner" id="orgFillIn">🧩 '+esc(gpT('{n} places on the YWAM GP Leadership Team are not filled yet.',{n:empty}))+
    ' <button class="linkbtn inline" data-adminsubgo="loose" style="width:auto;padding:0">'+esc(t('See what’s missing'))+'</button></div>';
  if(S.me && !S.board && (S.me.isAdmin || S.me.dept===BL_DEPT)) h+='<button class="btn ghost" id="orgReport">📄 '+esc(t('The quarter report the board sees'))+'</button>';
  h+='<h3>✦ '+esc(t('YWAM GP leadership'))+'</h3><div class="card">';
  GP_ROLES.forEach(function(r){
    var who=O.gp.filter(function(p){ return p.gpRole===r[0]; });
    if(who.length) who.forEach(function(p){ h+=orgPersonRowHtml_(p, gpRoleLabel_(r[0])+' · '+t(campusName(p.campus))); });
    else h+='<div class="orgCltRow orgOpen"><span class="orgOpenDot"></span><span class="orgCltText"><b>'+esc(gpRoleLabel_(r[0]))+'</b><small>'+esc(t('Not filled yet'))+'</small></span></div>';
  });
  h+='</div>';
  h+='<h3>🏠 '+esc(t('Campus leadership teams'))+'</h3>'+CAMPUSES.map(function(c){ return orgCltCardHtml_(c.id); }).join('');
  h+=orgBoardHtml_();
  return h;
}
function orgBoardHtml_(){
  var B=(S.org && S.org.board) || [];
  var emails=B.map(function(b){ return b.email; }).filter(Boolean);
  var safe=B.filter(function(b){ return b.safeguarding && b.email; });
  var h='<h3 id="orgBoard">🛡️ '+esc(t('YWAM GP Advisory Board'))+'</h3>';
  /* A serious concern goes only to the board's safeguarding contacts — YWAM GP's own
     leaders sit on the board, so "the whole board" can include the very people a
     concern is about (Uriah, Oct 2026). */
  if(!S.board && safe.length) h+='<div class="card orgBoardNote orgConcern"><p><b>'+esc(t('Raising a serious concern'))+'</b></p><p>'+
    esc(gpT('If you ever need to raise something serious — about a leader, someone’s safety, abuse or misconduct — write to {names}. They are the board’s safeguarding contacts, and your message goes only to them.',{names:safe.map(function(b){ return b.name; }).join(' & ')}))+'</p>'+
    '<a class="btn" id="orgConcern" href="mailto:'+safe.map(function(b){ return encodeURIComponent(b.email); }).join(',')+'?subject='+encodeURIComponent('A confidential concern')+'">🛡️ '+esc(t('Raise a concern'))+'</a>'+
    '<button class="linkbtn inline orgSafeGuide" data-safeguide style="width:auto;padding:0;margin-top:8px">📖 '+esc(t('Read Keeping Each Other Safe — what to do, and what happens next'))+'</button></div>';
  if(!S.board && emails.length) h+='<div class="card orgBoardNote"><p>'+esc(t('The advisory board stands alongside YWAM GP’s leaders, outside the campus structure.'))+'</p>'+
    '<a class="btn ghost" id="orgEmailBoard" href="mailto:'+emails.map(encodeURIComponent).join(',')+'?subject='+encodeURIComponent('To the YWAM GP Advisory Board')+'">✉️ '+esc(t('Email the whole board'))+'</a></div>';
  if(!B.length) h+='<div class="card"><p class="sub" style="margin:4px 0">'+esc(t('The board’s members will be listed here.'))+'</p></div>';
  B.forEach(function(b){ h+=orgBoardMemberHtml_(b); });
  return h;
}
/* Team → Structure → YWAM GP: the whole organisation as levels — the Advisory Board
   (advising, so a dashed line), YWAM GP's leadership team with every place, then
   both campuses with their leadership teams. Someone with several roles is in every
   box they belong to, with that box's title. A campus box opens its own chart. */
function ywamGpChartHtml_(){
  var O=S.org;
  if(!O){ orgLoad_(); return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>'; }
  var chip=function(p, sub){
    var tag=p.id && p.staffId!==null ? 'button' : 'div';
    return '<'+tag+' class="orgPerson orgTitled"'+(tag==='button' ? ' data-person="'+esc(p.id)+'"' : '')+'>'+avatarHtml(p,'sm')+
      '<span>'+esc(p.name)+(sub ? '<small class="orgChipTitle">'+esc(sub)+'</small>' : '')+'</span></'+tag+'>';
  };
  var h='<div class="orgChart orgGpChart">';
  /* the board */
  h+='<div class="orgLevelLabel">'+esc(t('YWAM GP Advisory Board'))+'</div><div class="orgBox orgBoardBox"><div class="orgBoxTitle">🛡️ '+esc(t('Advisory Board'))+
    '<span class="orgBoxMeta">'+esc(t('advises YWAM GP'))+'</span></div>';
  if(!O.board.length) h+='<div class="orgEmpty">'+esc(t('The board’s members will be listed here.'))+'</div>';
  else h+='<div class="orgPeople">'+O.board.map(function(b){
    return b.staffId ? chip({ id:b.staffId, name:b.name, photo:b.photo }, t(b.role)) : chip({ id:'', staffId:null, name:b.name, photo:b.photo }, t(b.role));
  }).join('')+'</div>';
  h+='</div><div class="orgConnector dashed"></div>';
  /* YWAM GP's leadership team */
  h+='<div class="orgLevelLabel">'+esc(t('YWAM GP leadership'))+'</div><div class="orgBox top"><div class="orgBoxTitle">🌏 '+esc(t('YWAM GP Leadership Team'))+'</div><div class="orgPeople">';
  GP_ROLES.forEach(function(r){
    var who=O.gp.filter(function(p){ return p.gpRole===r[0]; });
    if(who.length) who.forEach(function(p){ h+=chip(p, gpRoleLabel_(r[0])); });
    else h+='<div class="orgPerson orgTitled orgVacant"><span class="orgOpenDot"></span><span>'+esc(gpRoleLabel_(r[0]))+'<small class="orgChipTitle">'+esc(t('Not filled yet'))+'</small></span></div>';
  });
  h+='</div></div><div class="orgConnector"></div>';
  /* the campuses */
  h+='<div class="orgLevelLabel">'+esc(t('Campuses'))+' · '+CAMPUSES.length+'</div><div class="orgGrid">';
  CAMPUSES.forEach(function(c){
    var oc=orgCampus_(c.id);
    h+='<div class="orgBox dept"><div class="orgBoxTitle">🏠 '+esc(t(c.name))+(oc ? '<span class="orgBoxMeta">'+esc(gpT('{n} staff',{n:oc.staff}))+'</span>' : '')+'</div>'+
      '<div class="orgSub">'+esc(t('Campus Leadership Team'))+'</div>';
    h+=(oc && oc.clt.length) ? '<div class="orgPeople">'+oc.clt.map(function(p){ return chip(p, orgTitleText_(p.title)); }).join('')+'</div>' : '<div class="orgEmpty">'+esc(t('Nobody here yet'))+'</div>';
    h+='<button class="linkbtn inline orgOpenCampus" data-teamcampus="'+esc(c.id)+'">'+esc(gpT('Open {campus}’s chart',{campus:t(c.short)}))+' ›</button></div>';
  });
  h+='</div>';
  return h+'<p class="hint" style="margin:12px 0 0;text-align:center">'+esc(t('Someone with more than one role is in each box they belong to.'))+'</p></div>';
}
/* A campus as the board sees it: its leadership, its departments with their directors,
   each ministry and who leads it, and how many staff — then the base's figures. */
function orgCampusProfileHtml_(c){
  var oc=orgCampus_(c);
  var h=orgCltCardHtml_(c);
  if(!oc) return h;
  var deps=getDepartments(c), dirOf={};
  oc.clt.forEach(function(p){ if(p.dept) (dirOf[p.dept]=dirOf[p.dept]||[]).push(p.name); });
  h+='<div class="card"><div class="mentorLabel">🗂️ '+esc(t('Departments'))+' · '+esc(gpT('{n} staff',{n:oc.staff}))+'</div>';
  Object.keys(deps).filter(function(d){ return d!==BL_DEPT; }).forEach(function(d){
    h+='<div class="orgDept"><div class="orgDeptHead"><b>'+(MIN_EMOJI[d]?MIN_EMOJI[d]+' ':'')+esc(t(d))+'</b><span class="pmeta">'+esc(gpT('{n} staff',{n:(oc.deptStaff||{})[d]||0}))+'</span></div>'+
      (dirOf[d] ? '<div class="pmeta">'+esc(gpT('Director: {names}',{names:dirOf[d].join(', ')}))+'</div>' : '')+
      '<div class="orgDeptMins">'+Object.keys(deps[d]||{}).map(function(m){
        var ld=(oc.leaders||{})[d+'|'+m];
        return '<span>'+esc(t(m))+(ld ? ' · <b>'+esc(ld.join(', '))+'</b>' : '')+'</span>';
      }).join('')+'</div></div>';
  });
  return h+'</div>';
}
function bindOrg_(){
  document.querySelectorAll('[data-adminsubgo]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.view='admin'; S.adminSub=b.getAttribute('data-adminsubgo'); render(); window.scrollTo(0,0); };
  });
  /* the Library's safeguarding guide, from the concern card */
  document.querySelectorAll('[data-safeguide]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.person=null; S.view='library'; S.libBook='keeping-each-other-safe'; S.libStep=null; libLoad_(); render(); window.scrollTo(0,0); };
  });
  document.querySelectorAll('[data-orgperson]').forEach(function(b){
    b.onclick=function(){
      gpTap(); var id=b.getAttribute('data-orgperson');
      run('staffProfile',[S.auth.user,S.auth.pin,id],function(d){
        if(d && d.ok){ S.view='team'; S.person=d; render(); window.scrollTo(0,0); } else showMsg(t('Not available'));
      });
    };
  });
}

/* ==================== The quarter report (the board's Report tab) ====================
   One page a board member can read, or print to PDF for a board meeting: each campus
   and YWAM GP as a whole, for one quarter of this year against the one before — staff
   today, the health score (only from three check-ins or more, the same rule as
   department health), salvations, students in the leadership and community schools,
   and each campus's objectives with how far along they are. Only figures the board
   already sees on Campuses (the public getData), the roster's counts and the org's
   leadership teams: no names beyond the leaders, nothing private. Campus Leadership
   and admins open it from the YWAM GP page, to see what the board sees. */
S.repQ=null;
var REP_MIN_ANSWERS=3;
function repQ_(){ var cur=qOf(thisWeek()); return (S.repQ===null || S.repQ>cur) ? cur : S.repQ; }
/* last quarter's figure under this one: "Q3: 17", green when this one is higher */
function repDelta_(now, before, prevQ, show){
  if(before===null || before===undefined || prevQ<1) return '';
  var cls=(now===null || now===undefined || now===before) ? '' : (now>before ? ' up' : ' down');
  return '<small class="repDelta'+cls+'">Q'+prevQ+': '+(show ? show(before) : fmt(before))+'</small>';
}
function repHealth_(R, ids, q){
  if(q<0) return null;
  var rows=R.surveyRows(ids, undefined, q);
  return rows.length>=REP_MIN_ANSWERS ? Math.round(R.healthScore(ids, undefined, q)*10)/10 : null;
}
function repRow_(label, now, before, note, prevQ){
  return '<div class="repRow"><span class="repLabel">'+esc(label)+(note ? '<small>'+esc(note)+'</small>' : '')+'</span>'+
    '<span class="repVal">'+(now===null || now===undefined ? '—' : fmt(now))+repDelta_(now, before, prevQ)+'</span></div>';
}
function repFigures_(R, ids, q){
  var p=q-1, hs=repHealth_(R, ids, q), hp=repHealth_(R, ids, p), n=R.surveyRows(ids, undefined, q).length;
  return repRow_(t('Staff'), R.totalStaff(ids), null, t('today'))+
    '<div class="repRow"><span class="repLabel">'+esc(t('Staff Health Score'))+'<small>'+esc(hs===null ? gpT('needs {n} check-ins or more',{n:REP_MIN_ANSWERS}) : gpT('{n} check-ins',{n:n}))+'</small></span>'+
      '<span class="repVal">'+(hs===null ? '—' : hs.toFixed(1)+'/10')+repDelta_(hs, hp, q, function(v){ return v.toFixed(1); })+'</span></div>'+
    repRow_(t('Salvations'), R.headlineFor(ids, 'Salvations', q), p>=0 ? R.headlineFor(ids, 'Salvations', p) : null, '', q)+
    repRow_(t('Leadership school students'), R.ldStudents(ids, q), p>=0 ? R.ldStudents(ids, p) : null, '', q)+
    repRow_(t('Leadership school graduates'), R.ldGraduates(ids, q), p>=0 ? R.ldGraduates(ids, p) : null, '', q)+
    repRow_(t('Community school students'), R.communityStudents(ids, q), p>=0 ? R.communityStudents(ids, p) : null, '', q);
}
function boardReportHtml_(){
  var yr=thisWeekYear(), q=repQ_(), cur=qOf(thisWeek());   // the week year: 28–31 Dec are 2027's Q1
  var h=(S.board ? '' : '<button class="linkbtn noPrint" id="repBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('YWAM GP'))+'</button>')+
    '<div class="repHead"><h2>📄 '+esc(gpT('YWAM GP · Q{q} {year} report',{q:q+1, year:yr}))+'</h2>'+
    '<p class="sub">'+esc(gpT('Each campus and YWAM GP as a whole, compared with Q{p}. Made {date}.',{p:q>0?q:4, date:teamDate_(todayStr())}))+'</p></div>';
  h+='<div class="deptChips noPrint">'+[0,1,2,3].map(function(i){
    return '<button class="deptChip'+(i===q?' on':'')+'" data-repq="'+i+'"'+(i>cur?' disabled':'')+'>Q'+(i+1)+'</button>'; }).join('')+
    '<button class="deptChip" id="repPrint">🖨️ '+esc(t('Print or save as PDF'))+'</button></div>';
  if(!S.base) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Loading…'))+'</p></div>';
  if(!S.org) orgLoad_();
  var R=baseR(), all=CAMPUSES.map(function(c){ return c.id; });
  h+='<div class="repGrid">';
  h+='<div class="card repCard repAll"><div class="repTitle">🌏 '+esc(t('YWAM GP'))+'</div>'+repFigures_(R, all, q)+'</div>';
  CAMPUSES.forEach(function(c){
    var ids=[c.id], oc=orgCampus_(c.id);
    h+='<div class="card repCard"><div class="repTitle">🏠 '+esc(t(c.name))+'</div>'+repFigures_(R, ids, q);
    if(oc && oc.clt.length) h+='<div class="repSub">'+esc(t('Campus Leadership Team'))+'</div><div class="repLeaders">'+
      oc.clt.map(function(p){ return '<div>'+esc(p.name)+' <small>'+esc(orgTitleText_(p.title))+'</small></div>'; }).join('')+'</div>';
    var objs=((S.base && S.base.okrs)||[]).filter(function(o){ return o.campus===c.id && Number(o.quarter)===q+1; });
    h+='<div class="repSub">'+esc(gpT('Objectives for Q{q}',{q:q+1}))+(objs.length ? ' · '+esc(gpT('{n}% along on average',{n:Math.round(objs.reduce(function(a,o){ return a+R.objProgress(o); },0)/objs.length)})) : '')+'</div>';
    h+=objs.length ? objs.map(function(o){ var pc=R.objProgress(o);
        return '<div class="repObj"><span>'+esc(o.objective)+'<small>'+esc(t(o.dept))+'</small></span><b>'+pc+'%</b></div>'; }).join('')
      : '<div class="repEmpty">'+esc(t('None set for this quarter.'))+'</div>';
    h+='</div>';
  });
  h+='</div><p class="hint">'+esc(t('Health is shown only from three check-ins or more, so nobody’s answers can be picked out. Staff numbers are as of today.'))+'</p>';
  return h;
}
function bindBoardReport_(){
  var g=document.getElementById('orgReport');
  if(g) g.onclick=function(){ gpTap(); S.view='report'; render(); window.scrollTo(0,0); };
  if(S.view!=='report') return;
  document.querySelectorAll('[data-repq]').forEach(function(b){ b.onclick=function(){ S.repQ=Number(b.getAttribute('data-repq')); render(); }; });
  var pr=document.getElementById('repPrint'); if(pr) pr.onclick=function(){ window.print(); };
  var bk=document.getElementById('repBack'); if(bk) bk.onclick=function(){ S.view='ywamgp'; render(); };
}

/* ==================== Your first 30 days (My Home) ====================
   For someone new (their account is under F30_DAYS old): the handful of things that
   make a good start, ticked off by themselves as they happen — every item is read
   from what the app already knows, nothing to tick by hand. Each row takes you to
   where it is done. Gone when everything is done, after F30_DAYS, or when hidden
   ("Hide this", this phone). */
var F30_DAYS=45, F30_HIDE_KEY='gp-f30-hidden';
function f30Items_(){
  var me=S.me||{}, pr=S.profile||{}, read=libRead_();
  if(S.push) pushCheck_();
  var items=[
    { id:'profile', done:!!(me.photo && me.staffType && me.country), label:t('Add your photo, what kind of staff you are, and where you are from'), go:'profile' },
    { id:'mentor', done:pr.mentorStatus==='approved', label: me.mentorId && pr.mentorStatus!=='approved' ? t('Your mentor accepts — ask them to open the app') : t('Choose a mentor'), go:'profile' },
    { id:'papers', done:!!(S.required && S.required.finished), label:t('Read and sign the papers every staff member signs'), go:'mycontract' },
    { id:'checkin', done:(S.logs||[]).length>0, label:t('Your first daily check-in'), go:'sec-habits' },
    { id:'oneonone', done:(S.oneOnOnes||[]).some(function(o){ return o.heldOn; }), label:t('Your first 1-on-1 with your mentor'), go:'sec-mentor' },
    { id:'fight', done:!!read['fight-our-values'], label:t('Read FIGHT: Our Values'), go:'lib:fight-our-values' },
    { id:'safe', done:!!read['keeping-each-other-safe'], label:t('Read Keeping Each Other Safe'), go:'lib:keeping-each-other-safe' }
  ];
  if(gsOK()) items.push({ id:'strengths', done:!!(pr.gstrengths && pr.gstrengths.top), label:t('Find your top 5 strengths'), go:'gtest' });
  if(pOK()) items.push({ id:'type', done:!!(pr.personality && pr.personality.type), label:t('Find your personality type'), go:'ptest' });
  if(S.push && pushSupported_() && !pushNeedsInstall_()) items.push({ id:'remind', done:!!S.pushSub, label:t('Turn on reminders'), go:'profile' });
  return items;
}
function f30Show_(){
  if(!S.me || S.guest || S.board || !S.me.created) return false;
  var age=(Date.now()-new Date(S.me.created).getTime())/86400000;
  if(!(age>=0 && age<=F30_DAYS) || lsGet(F30_HIDE_KEY)===S.me.id) return false;
  return f30Items_().some(function(x){ return !x.done; });
}
function f30CardHtml_(){
  if(!f30Show_()) return '';
  var items=f30Items_(), done=items.filter(function(x){ return x.done; }).length;
  var h='<h3 id="sec-first30">🌱 '+esc(t('Your first 30 days'))+'</h3><div class="card f30Card">'+
    '<div class="pBar"><div class="pBarTop"><b>'+esc(gpT('{n} of {m} done',{n:done, m:items.length}))+'</b><span>'+Math.round(done/items.length*100)+'%</span></div>'+
    '<div class="pTrack"><div class="pFill" style="left:0;width:'+Math.round(done/items.length*100)+'%;background:var(--accent)"></div></div></div>';
  items.forEach(function(x){
    h+='<button class="f30Row'+(x.done?' done':'')+'" data-f30go="'+esc(x.go)+'"'+(x.done?' disabled':'')+'><span class="f30Tick">'+(x.done?'✓':'')+'</span><span>'+esc(x.label)+'</span>'+(x.done?'':PCHEV)+'</button>';
  });
  return h+'<button class="linkbtn inline f30Hide" id="f30Hide" style="width:auto;padding:0;margin-top:8px">'+esc(t('Hide this'))+'</button></div>';
}
function bindF30_(){
  document.querySelectorAll('[data-f30go]').forEach(function(b){
    b.onclick=function(){
      gpTap(); var g=b.getAttribute('data-f30go');
      if(g.indexOf('lib:')===0){ S.view='library'; S.libBook=g.slice(4); S.libStep=null; libLoad_(); render(); window.scrollTo(0,0); return; }
      if(g.indexOf('sec-')===0){ var el=document.getElementById(g); if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
      if(g==='gtest'){ S.gtest=null; S.view='gtest'; render(); window.scrollTo(0,0); return; }
      if(g==='ptest'){ S.ptest={stage:'intro', answers:{}, page:0, sex:mySex()}; S.view='ptest'; render(); window.scrollTo(0,0); return; }
      S.view=g; render(); window.scrollTo(0,0);
    };
  });
  var hd=document.getElementById('f30Hide');
  if(hd) hd.onclick=function(){ lsSet(F30_HIDE_KEY, S.me.id); render(); };
}

/* ==================== Prayer requests (☰ → Prayer) ====================
   Share a request with your campus, all of YWAM GP, or only your mentor; tap
   "I prayed" for someone's (a count, never a list of names); mark your own answered,
   with a line of thanks. "Prayer requests" in api.js. */
S.pr=null; S.prErr=''; S.prTab='open'; S.prAnswering=null; S.prBusy=false;
var PR_SCOPE_LABEL={ campus:'My campus', all:'All of YWAM GP', mentor:'Only my mentor' };
function prLoad_(){
  if(S.prLoading) return; S.prLoading=true;
  run('getPrayers',[S.auth.user,S.auth.pin],function(d){ S.prLoading=false; if(d && d.ok) S.pr=d.prayers||[]; else S.prErr=t('Could not load'); if(S.view==='prayer') render(); },
    function(){ S.prLoading=false; S.prErr=t('Could not load'); if(S.view==='prayer') render(); });
}
function prAgo_(iso){
  var d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);
  return d<=0 ? t('today') : d===1 ? t('yesterday') : gpT('{n} days ago',{n:d});
}
function prayerHtml_(){
  var h='<h2>🙏 '+esc(t('Prayer'))+'</h2><p class="sub">'+esc(t('Carry each other’s burdens. Share a request, and pray for each other’s.'))+'</p>';
  if(!S.pr){ prLoad_(); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.prErr||t('Loading…'))+'</p></div>'; }
  var canMentor=!!(S.me.mentorId && S.profile && S.profile.mentorStatus==='approved');
  h+='<div class="card"><label class="f" for="prText">'+esc(t('Ask for prayer'))+'</label>'+
    '<textarea id="prText" rows="3" maxlength="600" placeholder="'+esc(t('What can we pray for?'))+'"></textarea>'+
    '<label class="f" for="prScope">'+esc(t('Who sees it'))+'</label><select id="prScope">'+
      ['campus','all'].concat(canMentor?['mentor']:[]).map(function(k){ return '<option value="'+k+'">'+esc(t(PR_SCOPE_LABEL[k]))+'</option>'; }).join('')+'</select>'+
    '<button class="btn" id="prSend"'+(S.prBusy?' disabled':'')+'>🙏 '+esc(t('Share'))+'</button></div>';
  var open=S.pr.filter(function(p){ return !p.answered; }), answered=S.pr.filter(function(p){ return p.answered; }), mine=S.pr.filter(function(p){ return p.mine; });
  var chip=function(id, label, n){ return '<button class="deptChip'+(S.prTab===id?' on':'')+'" data-prtab="'+id+'">'+esc(label)+' · '+n+'</button>'; };
  h+='<div class="deptChips">'+chip('open', t('Praying'), open.length)+chip('answered', t('Answered'), answered.length)+chip('mine', t('Mine'), mine.length)+'</div>';
  var list=S.prTab==='answered' ? answered : S.prTab==='mine' ? mine : open;
  if(!list.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.prTab==='answered' ? t('Answered prayers will show here.') : S.prTab==='mine' ? t('Requests you share will show here.') : t('No requests right now. Be the first to share one.'))+'</p></div>';
  list.forEach(function(p){
    h+='<div class="card prCard'+(p.answered?' answered':'')+'"><div class="prHead">'+avatarHtml(p,'sm')+'<span class="prWho"><b>'+esc(p.mine ? t('You') : p.name)+'</b>'+
      '<small>'+esc(prAgo_(p.created))+' · '+esc(p.scope==='mentor' ? t('only their mentor') : p.scope==='all' ? t('all of YWAM GP') : t(campusName(p.campus)))+'</small></span></div>'+
      '<p class="prText">'+esc(p.text)+'</p>';
    if(p.answered) h+='<div class="prAnswered">🎉 '+esc(gpT('Answered {date}',{date:teamDate_(p.answered)}))+(p.answerNote ? '<div>'+esc(p.answerNote)+'</div>' : '')+'</div>';
    h+='<div class="prActs">';
    if(!p.mine) h+='<button class="btn '+(p.iPrayed?'':'ghost ')+'small" data-prpray="'+esc(p.id)+'" data-on="'+(p.iPrayed?'0':'1')+'">🙏 '+esc(p.iPrayed ? t('I prayed') : t('Pray'))+(p.prayedN ? ' · '+p.prayedN : '')+'</button>';
    else h+='<span class="prCount">🙏 '+esc(gpT('{n} praying',{n:p.prayedN}))+'</span>';
    if(p.mine && !p.answered && S.prAnswering!==p.id) h+='<button class="btn ghost small" data-pranswer="'+esc(p.id)+'">🎉 '+esc(t('Answered'))+'</button>';
    if(p.mine && p.answered) h+='<button class="linkbtn inline" data-prundo="'+esc(p.id)+'" style="width:auto;padding:0">'+esc(t('Not yet answered'))+'</button>';
    if(p.mine || S.me.isAdmin) h+='<button class="linkbtn inline prDel" data-prdel="'+esc(p.id)+'" style="width:auto;padding:0">'+esc(t('Delete'))+'</button>';
    h+='</div>';
    if(S.prAnswering===p.id) h+='<label class="f" for="prNote">'+esc(t('A line of thanks (optional)'))+'</label><input id="prNote" maxlength="300">'+
      '<div class="kmrActs"><button class="btn" id="prAnsSave">'+esc(t('Mark answered'))+'</button><button class="btn ghost" id="prAnsCancel">'+esc(t('Cancel'))+'</button></div>';
    h+='</div>';
  });
  return h;
}
function bindPrayer_(){
  if(S.view!=='prayer' || !S.pr) return;
  var done=function(d){ S.prBusy=false; if(d && d.ok){ if(d.prayers) S.pr=d.prayers; render(); return true; } showMsg(d && d.err==='too_many' ? t('That is a lot for one day — try again tomorrow.') : t('Could not save')); render(); return false; };
  var send=document.getElementById('prSend');
  if(send) send.onclick=function(){
    var v=(document.getElementById('prText').value||'').trim();
    if(!v){ showMsg(t('Write your request first')); return; }
    S.prBusy=true; send.disabled=true;
    run('savePrayer',[S.auth.user,S.auth.pin,{ text:v, scope:document.getElementById('prScope').value }],function(d){ if(done(d)){ S.prTab='open'; showMsg(t('Shared')); render(); } });
  };
  document.querySelectorAll('[data-prtab]').forEach(function(b){ b.onclick=function(){ S.prTab=b.getAttribute('data-prtab'); S.prAnswering=null; render(); }; });
  document.querySelectorAll('[data-prpray]').forEach(function(b){
    b.onclick=function(){
      gpTap(); var id=b.getAttribute('data-prpray'), on=b.getAttribute('data-on')==='1';
      run('prayedFor',[S.auth.user,S.auth.pin,id,on],function(d){ if(d && d.ok){ S.pr=S.pr.map(function(p){ return p.id===id ? d.prayer : p; }); render(); } });
    };
  });
  document.querySelectorAll('[data-pranswer]').forEach(function(b){ b.onclick=function(){ S.prAnswering=b.getAttribute('data-pranswer'); render(); }; });
  var c=document.getElementById('prAnsCancel'); if(c) c.onclick=function(){ S.prAnswering=null; render(); };
  var a=document.getElementById('prAnsSave');
  if(a) a.onclick=function(){ var id=S.prAnswering; S.prAnswering=null; run('answerPrayer',[S.auth.user,S.auth.pin,id,(document.getElementById('prNote')||{}).value||''],function(d){ if(done(d)) showMsg(t('Praise God!')); }); };
  document.querySelectorAll('[data-prundo]').forEach(function(b){ b.onclick=function(){ run('answerPrayer',[S.auth.user,S.auth.pin,b.getAttribute('data-prundo'),'',true],done); }; });
  document.querySelectorAll('[data-prdel]').forEach(function(b){ b.onclick=function(){ if(!confirm(t('Delete this request?'))) return; run('deletePrayer',[S.auth.user,S.auth.pin,b.getAttribute('data-prdel')],done); }; });
}

/* ==================== Support raising (My Home → Support raising) ====================
   Your ministry partners and the monthly support you are trusting God for — private,
   like staff debt: only you see the list; your mentor sees the totals, and only if you
   tick it (getMySupport / saveMySupport, "Support raising" in api.js). Since Oct 2026 also
   who you support each month ("We support"), and a tracker you already keep can be
   brought in. The whole thing is saved at once on every change; it loads only here. */
S.sup=null; S.supErr=''; S.supEdit=null; S.supGEdit=null; S.supFilter='all'; S.supBusy=false; S.supImport=null; S.supReading=false;
S.supTab=(lsGet('gp-sup-tab')==='out' ? 'out' : 'in');
var SUP_STATUS_LABEL={ toask:'To ask', asked:'Asked', giving:'Giving', paused:'Paused' };   // in the order it goes
var SUP_FREQ_LABEL={ month:'a month', year:'a year', once:'once' };
function supLoad_(){
  if(S.supLoading) return; S.supLoading=true;
  run('getMySupport',[S.auth.user,S.auth.pin],function(d){ S.supLoading=false; if(d && d.ok){ S.sup=d; S.supSum=d.summary; } else S.supErr=t('Could not load'); if(S.view==='support') render(); },
    function(){ S.supLoading=false; S.supErr=t('Could not load'); if(S.view==='support') render(); });
}
function supSave_(next, msg){
  S.supBusy=true;
  run('saveMySupport',[S.auth.user,S.auth.pin,next],function(d){
    S.supBusy=false;
    if(d && d.ok){ S.sup=d; S.supSum=d.summary; S.supEdit=null; S.supGEdit=null; render(); if(msg) showMsg(msg); }
    else { render(); showMsg(t('Could not save')); }
  });
}
function supDue_(p, days){
  if(p.status==='paused') return false;
  if(!p.last) return p.status==='asked';   // as the server: never in touch since asking
  return (new Date(todayStr())-new Date(p.last))/86400000 >= days;
}
function supMonthly_(x){ return x.freq==='month' ? (Number(x.amount)||0) : x.freq==='year' ? (Number(x.amount)||0)/12 : 0; }
function supMoney_(n){ return '$'+fmt(Math.round(n)); }
/* A list in groups by channel (a sending church, a base, via GP …), each with what it comes to a
   month; a list with no channels at all is just the list. */
function supGroupsHtml_(list, rowFn, monthlyOf){
  var chans={}, order=[];
  list.forEach(function(x){ var c=x.channel||''; if(!chans[c]){ chans[c]=[]; order.push(c); } chans[c].push(x); });
  if(order.length===1 && order[0]==='') return '<div class="card">'+list.map(rowFn).join('')+'</div>';
  var sums={}; order.forEach(function(c){ sums[c]=chans[c].reduce(function(a,x){ return a+monthlyOf(x); }, 0); });
  order.sort(function(a,b){ return a==='' ? 1 : b==='' ? -1 : (sums[b]-sums[a]) || a.localeCompare(b); });   // the biggest first
  return order.map(function(c){
    var rows=chans[c], sum=sums[c];
    return '<div class="supGroup"><span>'+esc(c || t('No channel'))+' <small>· '+rows.length+'</small></span>'+(sum ? '<b>'+esc(gpT('{money} a month',{money:supMoney_(sum)}))+'</b>' : '')+'</div>'+
      '<div class="card">'+rows.map(rowFn).join('')+'</div>';
  }).join('');
}
function supDatalist_(id, values){
  var seen={}; values.forEach(function(v){ if(v) seen[v]=1; });
  return '<datalist id="'+id+'">'+Object.keys(seen).sort().map(function(v){ return '<option value="'+esc(v)+'">'; }).join('')+'</datalist>';
}
function supportHtml_(){
  var h='<button class="linkbtn" id="supBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>'+
    '<h2>💰 '+esc(t('Support raising'))+'</h2><p class="sub">'+esc(t('Your ministry partners, who you support each month, and what you are trusting God for. Only you see these lists.'))+'</p>';
  if(!S.sup){ supLoad_(); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.supErr||t('Loading…'))+'</p></div>'; }
  var sup=S.sup.support, sm=S.sup.summary, days=S.sup.followDays||90, pct=sm.goal ? Math.min(100, sm.pct) : 0;
  var giving=sup.giving||[], gm=S.sup.givenMonthly!=null ? S.sup.givenMonthly : giving.reduce(function(a,g){ return a+supMonthly_(g); }, 0);
  h+='<div class="card"><label class="f" for="supGoal">'+esc(t('My monthly goal (US$)'))+'</label>'+
    '<input type="number" id="supGoal" inputmode="numeric" min="0" value="'+(sup.goal||'')+'" placeholder="0">'+
    '<div class="pBar" style="margin-top:12px"><div class="pBarTop"><b>'+esc(gpT('${n} a month pledged',{n:fmt(sm.pledged)}))+'</b><span>'+(sm.goal ? sm.pct+'%' : '')+'</span></div>'+
    '<div class="pTrack"><div class="pFill" style="left:0;width:'+pct+'%;background:var(--accent)"></div></div></div>'+
    (giving.length ? '<div class="supMoneyRow"><span><small>'+esc(t('Coming in'))+'</small><b>'+esc(supMoney_(sm.pledged))+'</b></span>'+
      '<span><small>'+esc(t('Going out'))+'</small><b>'+esc(supMoney_(gm))+'</b></span>'+
      '<span><small>'+esc(t('Kept'))+'</small><b class="'+(sm.pledged-gm<0?'finBad':'')+'">'+esc(supMoney_(sm.pledged-gm))+'</b></span></div>'+
      '<p class="hint" style="margin:2px 0 0">'+esc(t('A month. Going out is who you support; kept is what is left for you.'))+'</p>' : '')+
    '<div class="supStats"><span><b>'+sm.giving+'</b> '+esc(t('giving'))+'</span><span><b>'+sm.asked+'</b> '+esc(t('asked'))+'</span><span><b>'+sm.toask+'</b> '+esc(t('to ask'))+'</span>'+
      (sm.followUp ? '<span class="supDue"><b>'+sm.followUp+'</b> '+esc(t('to thank or follow up'))+'</span>' : '')+'</div>'+
    '<label class="f remBox"><input type="checkbox" id="supShare"'+(sup.mentorVisible?' checked':'')+'> '+esc(t('My mentor can see these totals — never the names'))+'</label>'+
    (giving.length ? '<p class="hint" style="margin:4px 0 0">'+esc(t('Only your partners’ totals — never who you support, or how much.'))+'</p>' : '')+'</div>';
  /* bring in a tracker you already keep */
  if(S.supImport) h+=supImportHtml_();
  else if(!sup.partners.length && !giving.length) h+=supImportCardHtml_(true);
  h+='<div class="campusSeg supTabs" style="max-width:none">'+
    '<button class="campusBtn'+(S.supTab==='in'?' on':'')+'" data-suptab="in">🤝 '+esc(t('Partners'))+' · '+sup.partners.length+'</button>'+
    '<button class="campusBtn'+(S.supTab==='out'?' on':'')+'" data-suptab="out">💝 '+esc(t('We support'))+' · '+giving.length+'</button></div>';
  h+= S.supTab==='out' ? supGivingTabHtml_(sup) : supPartnersTabHtml_(sup, sm, days);
  if(!S.supImport && (sup.partners.length || giving.length)) h+=supImportCardHtml_(false);
  return h+'<p class="hint">🔒 '+esc(gpT('Kept on your account and seen by nobody else. A partner shows under "to thank or follow up" when you have not been in touch for {n} days.',{n:days}))+'</p>';
}
function supPartnersTabHtml_(sup, sm, days){
  var chip=function(id, label, n){ return '<button class="deptChip'+(S.supFilter===id?' on':'')+'" data-supfilter="'+id+'">'+esc(label)+(n!==undefined?' · '+n:'')+'</button>'; };
  var list=sup.partners.filter(function(p){ return S.supFilter==='all' ? true : S.supFilter==='due' ? supDue_(p, days) : p.status===S.supFilter; })
    .sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  var h='<div class="deptChips">'+chip('all', t('All'))+chip('giving', t('Giving'), sm.giving)+chip('asked', t('Asked'), sm.asked)+chip('toask', t('To ask'), sm.toask)+
    (sm.followUp ? chip('due', t('To thank or follow up'), sm.followUp) : '')+'</div>';
  var editing=S.supEdit && S.supEdit!=='new' ? sup.partners.filter(function(p){ return p.id===S.supEdit; })[0] : null;
  if(S.supEdit==='new') h+=supFormHtml_({ id:'', name:'', amount:'', freq:'month', status:'toask', last:'', note:'', channel:'' }, true, sup);
  else if(editing) h+=supFormHtml_(editing, false, sup);
  else h+='<button class="btn" id="supAdd"'+(S.supBusy?' disabled':'')+'>＋ '+esc(t('Add a partner'))+'</button>';
  if(!sup.partners.length && S.supEdit!=='new') return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Add the people and churches who give to your ministry, or who you hope to ask.'))+'</p></div>';
  if(!list.length) return h;
  return h+supGroupsHtml_(list, function(p){
    return '<button class="supRow'+(S.supEdit===p.id?' editing':'')+'" data-supedit="'+esc(p.id)+'"><span class="supName">'+esc(p.name)+
      '<small>'+(p.amount ? '$'+esc(fmt(p.amount))+' '+esc(t(SUP_FREQ_LABEL[p.freq])) : '')+(p.note ? (p.amount?' · ':'')+esc(p.note) : '')+(p.last ? ' · '+esc(gpT('last in touch {date}',{date:teamDate_(p.last)})) : '')+'</small></span>'+
      '<span class="supStatus '+p.status+'">'+esc(t(SUP_STATUS_LABEL[p.status]))+'</span>'+(supDue_(p, days)?'<span class="supDueDot" title="'+esc(t('To thank or follow up'))+'"></span>':'')+'</button>';
  }, function(p){ return p.status==='giving' ? supMonthly_(p) : 0; });
}
/* Who you support each month — the people and ministries you give to. */
function supGivingTabHtml_(sup){
  var giving=sup.giving||[], h='';
  var editing=S.supGEdit && S.supGEdit!=='new' ? giving.filter(function(g){ return g.id===S.supGEdit; })[0] : null;
  if(S.supGEdit==='new') h+=supGiveFormHtml_({ id:'', name:'', amount:'', freq:'month', channel:'', location:'', note:'' }, true, sup);
  else if(editing) h+=supGiveFormHtml_(editing, false, sup);
  else h+='<button class="btn" id="supGAdd"'+(S.supBusy?' disabled':'')+'>＋ '+esc(t('Add someone you support'))+'</button>';
  if(!giving.length) return h+(S.supGEdit==='new' ? '' : '<div class="card"><p class="sub" style="margin:0">'+esc(t('The people and ministries you give to each month — a student’s fees, a family, a school.'))+'</p></div>');
  var locs={}; giving.forEach(function(g){ if(g.location) locs[g.location]=(locs[g.location]||0)+supMonthly_(g); });
  var lk=Object.keys(locs).sort();
  if(lk.length) h+='<div class="supLocs">'+esc(t('By place'))+': '+lk.map(function(l){ return '<b>'+esc(l)+'</b> '+esc(supMoney_(locs[l])); }).join(' · ')+'</div>';
  var list=giving.slice().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  return h+supGroupsHtml_(list, function(g){
    return '<button class="supRow'+(S.supGEdit===g.id?' editing':'')+'" data-supgedit="'+esc(g.id)+'"><span class="supName">'+esc(g.name)+
      '<small>'+(g.amount ? '$'+esc(fmt(g.amount))+' '+esc(t(SUP_FREQ_LABEL[g.freq])) : '')+(g.location ? ' · '+esc(g.location) : '')+(g.note ? ' · '+esc(g.note) : '')+'</small></span></button>';
  }, supMonthly_);
}
/* Adding or editing a partner: one card above the list. Where things are and how often
   are a tap each (they are only a few choices); the amount has its $; "Today" sits
   by the date. The choices live in hidden inputs, so a tap changes no typing. */
function supChoicesHtml_(name, map, cur){
  return '<div class="supChoice" role="radiogroup">'+Object.keys(map).map(function(k){
    return '<button type="button" role="radio" aria-checked="'+(k===cur)+'" class="supPick'+(k===cur?' on':'')+(name==='status'?' '+k:'')+'" data-sup'+name+'="'+k+'">'+esc(t(map[k]))+'</button>'; }).join('')+
    '</div><input type="hidden" id="sup'+(name==='status'?'Status':'Freq')+'" value="'+esc(cur)+'">';
}
function supAmtHint_(st){ return st==='toask' || st==='asked' ? t('What you hope they will give — leave it empty if you don’t know yet.') : t('What they give.'); }
function supMoneyHtml_(v){ return '<div class="supMoney"><span aria-hidden="true">$</span><input type="number" id="supAmt" inputmode="decimal" min="0" step="any" value="'+esc(v===''||!v?'':String(v))+'" placeholder="0"></div>'; }
function supFormHtml_(p, isNew, sup){
  return '<div class="card supForm" id="supForm" data-supform="'+esc(p.id)+'">'+
    '<div class="supFormHead">'+esc(isNew ? t('New partner') : gpT('Edit {name}',{name:p.name}))+'</div>'+
    '<label class="f" for="supName">'+esc(t('Name'))+'</label><input type="text" id="supName" maxlength="80" autocomplete="off" value="'+esc(p.name)+'" placeholder="'+esc(t('e.g. Grace Church, or Tom & Ann'))+'">'+
    '<label class="f">'+esc(t('Where things are'))+'</label>'+supChoicesHtml_('status', SUP_STATUS_LABEL, p.status)+
    '<label class="f" for="supAmt">'+esc(t('Amount (US$)'))+'</label>'+supMoneyHtml_(p.amount)+
    supChoicesHtml_('freq', SUP_FREQ_LABEL, p.freq)+
    '<p class="hint supAmtHint" style="margin:6px 0 0">'+esc(supAmtHint_(p.status))+'</p>'+
    '<label class="f" for="supChannel">'+esc(t('How it comes (optional)'))+'</label><input type="text" id="supChannel" list="supChannels" maxlength="40" autocomplete="off" value="'+esc(p.channel||'')+'" placeholder="'+esc(t('e.g. your sending church'))+'">'+
      supDatalist_('supChannels', sup.partners.map(function(x){ return x.channel; }))+
    '<label class="f" for="supLast">'+esc(t('Last in touch'))+'</label>'+
    '<div class="supDate"><input type="date" id="supLast" value="'+esc(p.last)+'" max="'+todayStr()+'"><button type="button" class="linkbtn inline" id="supToday">'+esc(t('Today'))+'</button></div>'+
    '<label class="f" for="supNote">'+esc(t('Note'))+'</label><textarea id="supNote" rows="2" maxlength="300" placeholder="'+esc(t('How you know them, what you last talked about…'))+'">'+esc(p.note)+'</textarea>'+
    '<div class="kmrActs"><button class="btn" id="supSave">'+esc(isNew ? t('Add') : t('Save'))+'</button><button class="btn ghost" id="supCancel">'+esc(t('Cancel'))+'</button></div>'+
    (isNew ? '' : '<button type="button" class="supRemove" id="supDel">🗑 '+esc(t('Remove this partner'))+'</button>')+'</div>';
}
function supGiveFormHtml_(g, isNew, sup){
  var all=sup.giving||[];
  return '<div class="card supForm" id="supForm" data-supgform="'+esc(g.id)+'">'+
    '<div class="supFormHead">'+esc(isNew ? t('Someone you support') : gpT('Edit {name}',{name:g.name}))+'</div>'+
    '<label class="f" for="supName">'+esc(t('Name'))+'</label><input type="text" id="supName" maxlength="80" autocomplete="off" value="'+esc(g.name)+'" placeholder="'+esc(t('e.g. a student, a family, a school'))+'">'+
    '<label class="f" for="supAmt">'+esc(t('Amount (US$)'))+'</label>'+supMoneyHtml_(g.amount)+
    supChoicesHtml_('freq', SUP_FREQ_LABEL, g.freq)+
    '<div class="supTwo"><span><label class="f" for="supChannel">'+esc(t('How it goes'))+'</label><input type="text" id="supChannel" list="supGChannels" maxlength="40" autocomplete="off" value="'+esc(g.channel||'')+'" placeholder="'+esc(t('e.g. via GP'))+'">'+
      supDatalist_('supGChannels', all.map(function(x){ return x.channel; }))+'</span>'+
    '<span><label class="f" for="supLoc">'+esc(t('Where'))+'</label><input type="text" id="supLoc" list="supGLocs" maxlength="40" autocomplete="off" value="'+esc(g.location||'')+'" placeholder="'+esc(t('e.g. Poipet'))+'">'+
      supDatalist_('supGLocs', all.map(function(x){ return x.location; }).concat([t('Poipet'), t('Siem Reap')]))+'</span></div>'+
    '<label class="f" for="supNote">'+esc(t('Note'))+'</label><textarea id="supNote" rows="2" maxlength="300">'+esc(g.note||'')+'</textarea>'+
    '<div class="kmrActs"><button class="btn" id="supGSave">'+esc(isNew ? t('Add') : t('Save'))+'</button><button class="btn ghost" id="supCancel">'+esc(t('Cancel'))+'</button></div>'+
    (isNew ? '' : '<button type="button" class="supRemove" id="supGDel">🗑 '+esc(t('Stop supporting'))+'</button>')+'</div>';
}
/* Bring in a giving & support tracker (a PDF of the sheet, or its rows pasted): it is
   read here (GP_FIN.parseSupportTracker), shown, and only added when you say so —
   a name already on a list (same channel) is updated, a new one added. */
function supImportCardHtml_(big){
  var inp='<input type="file" id="supFile" accept="application/pdf,.pdf" hidden>';
  if(!big) return '<div class="supImportLink"><label class="linkbtn inline" style="cursor:pointer">📄 '+esc(t('Bring in your giving & support tracker'))+inp+'</label></div>';
  return '<div class="card"><div class="goalCardTitle" style="margin-bottom:4px">📄 '+esc(t('Already keep a giving & support tracker?'))+'</div>'+
    '<p class="sub" style="margin:0 0 10px">'+esc(t('Bring it in: the PDF of your sheet, or its rows copied and pasted. It reads who gives to you and who you support each month, and shows you before anything is saved.'))+'</p>'+
    '<label class="btn finPickBtn" style="margin:0">📄 '+esc(S.supReading ? t('Reading…') : t('Choose the PDF'))+inp+'</label>'+
    '<details class="pulseMore"><summary>'+esc(t('Or paste the rows'))+'</summary><textarea id="supPaste" rows="4" placeholder="'+esc(t('Paste the rows here'))+'"></textarea>'+
    '<button class="btn ghost" id="supPasteRead" style="margin-top:6px">'+esc(t('Read these rows'))+'</button></details></div>';
}
function supImportHtml_(){
  var I=S.supImport, P=I.parsed;
  var h='<div class="card supImport"><div class="goalCardTitle" style="margin-bottom:2px">📄 '+esc(t('From your tracker'))+'</div><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(I.fileName)+'</p>';
  if(!P.ok) return h+'<p class="sub" style="margin:0 0 8px">'+esc(t('Couldn’t find the two lists in this — "Monthly Support Received" and "Monthly Support Given", each with its headings.'))+'</p><button class="btn ghost" id="supImpDrop" style="margin:0">'+esc(t('Leave it'))+'</button></div>';
  var sumIn=P.received.reduce(function(a,x){ return a+(x.amount||0); }, 0), sumOut=P.given.reduce(function(a,x){ return a+(x.amount||0); }, 0);
  h+='<div class="supImpLine"><b>🤝 '+esc(gpT('{n} partners',{n:P.received.length}))+'</b> <span>'+esc(gpT('{money} a month',{money:supMoney_(sumIn)}))+'</span></div>'+
    '<div class="supImpLine"><b>💝 '+esc(gpT('{n} you support',{n:P.given.length}))+'</b> <span>'+esc(gpT('{money} a month',{money:supMoney_(sumOut)}))+'</span></div>';
  var bad=P.checks.filter(function(c){ return !c.ok; });
  h+= !P.checks.length ? '' : bad.length ? '<div class="finCheck warn">⚠️ '+esc(t('The totals don’t match the sheet’s own — look the lists over after.'))+'</div>'
    : '<div class="finCheck ok">✓ '+esc(t('Both totals match the sheet’s own.'))+'</div>';
  var sup=S.sup.support, key=function(x){ return (String(x.channel||'')+'|'+String(x.name)).toLowerCase(); }, have={};
  sup.partners.concat(sup.giving||[]).forEach(function(x){ have[key(x)]=1; });
  var upd=P.received.concat(P.given).filter(function(x){ return have[key(x)]; }).length;
  if(upd) h+='<p class="hint" style="margin:8px 0 0">'+esc(gpT('{n} are already on your lists — their amounts will be updated.',{n:upd}))+'</p>';
  return h+'<div class="kmrActs"><button class="btn" id="supImpAdd">'+esc(t('Add to my lists'))+'</button><button class="btn ghost" id="supImpDrop">'+esc(t('Leave it'))+'</button></div></div>';
}
function supImportApply_(){
  var P=S.supImport.parsed, c=JSON.parse(JSON.stringify(S.sup.support)); c.giving=c.giving||[];
  var key=function(x){ return (String(x.channel||'')+'|'+String(x.name)).toLowerCase(); };
  var merge=function(list, rows, make){
    var at={}; list.forEach(function(x, i){ at[key(x)]=i; });
    rows.forEach(function(r){ var k=key(r), m=make(r);
      if(at[k]!==undefined){ var x=list[at[k]]; if(r.amount!=null) x.amount=r.amount; x.freq='month'; if(r.note && !x.note) x.note=r.note; if(m.location) x.location=m.location; }
      else { at[k]=list.length; list.push(m); } });
  };
  merge(c.partners, P.received, function(r){ return { id:'', name:r.name, amount:r.amount||0, freq:'month', status:'giving', last:'', note:r.note||'', channel:r.channel||'' }; });
  merge(c.giving, P.given, function(r){ return { id:'', name:r.name, amount:r.amount||0, freq:'month', channel:r.channel||'', location:r.location||'', note:r.note||'' }; });
  S.supImport=null;
  supSave_(c, t('Added to your lists'));
}
function supReadFile_(file){
  if(!/\.pdf$/i.test(file.name) && file.type!=='application/pdf'){ showMsg(t('That isn’t a PDF.')); return; }
  if(file.size>4*1024*1024){ showMsg(t('That file is too big — keep it under 4 MB.')); return; }
  S.supReading=true; render();
  var rd=new FileReader();
  rd.onload=function(){
    finPdfRows_(rd.result, 80, function(rows){ S.supReading=false; S.supImport={ fileName:file.name, parsed:GP_FIN.parseSupportTracker(rows) }; render(); },
      function(why){ S.supReading=false; showMsg(why==='lib' ? t('Couldn’t open the PDF reader — check the connection and try again.') : t('Couldn’t read that file.')); render(); });
  };
  rd.onerror=function(){ S.supReading=false; showMsg(t('Couldn’t read that file.')); render(); };
  rd.readAsArrayBuffer(file);
}
function bindSupport_(){
  var tile=document.getElementById('supTile');
  if(tile) tile.onclick=function(){ gpTap(); S.sup=null; S.supErr=''; S.supEdit=null; S.supGEdit=null; S.view='support'; render(); window.scrollTo(0,0); };
  if(S.view!=='support' || !S.sup) { var bk0=document.getElementById('supBack'); if(bk0) bk0.onclick=function(){ S.view='week'; render(); }; return; }
  var sup=S.sup.support;
  var copy=function(){ var c=JSON.parse(JSON.stringify(sup)); c.giving=c.giving||[]; return c; };
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  var val=function(id){ var el=document.getElementById(id); return el ? el.value : ''; };
  on('supBack', function(){ S.view='week'; render(); });
  var g=document.getElementById('supGoal');
  if(g) g.onchange=function(){ var c=copy(); c.goal=Math.max(0, Math.round(Number(g.value)||0)); supSave_(c, t('Saved')); };
  var sh=document.getElementById('supShare');
  if(sh) sh.onchange=function(){ var c=copy(); c.mentorVisible=!!sh.checked; supSave_(c, t('Saved')); };
  document.querySelectorAll('[data-suptab]').forEach(function(b){ b.onclick=function(){ gpTap(); S.supTab=b.getAttribute('data-suptab'); lsSet('gp-sup-tab', S.supTab); S.supEdit=null; S.supGEdit=null; render(); }; });
  document.querySelectorAll('[data-supfilter]').forEach(function(b){ b.onclick=function(){ S.supFilter=b.getAttribute('data-supfilter'); render(); }; });
  var toForm=function(){ var f=document.getElementById('supForm'); if(f) f.scrollIntoView({ block:'start', behavior:'smooth' }); };
  document.querySelectorAll('[data-supedit]').forEach(function(b){ b.onclick=function(){ S.supEdit=b.getAttribute('data-supedit'); render(); toForm(); }; });
  document.querySelectorAll('[data-supgedit]').forEach(function(b){ b.onclick=function(){ S.supGEdit=b.getAttribute('data-supgedit'); render(); toForm(); }; });
  on('supAdd', function(){ S.supEdit='new'; render(); var n=document.getElementById('supName'); if(n) n.focus(); });
  on('supGAdd', function(){ S.supGEdit='new'; render(); var n=document.getElementById('supName'); if(n) n.focus(); });
  ['status','freq'].forEach(function(k){
    document.querySelectorAll('[data-sup'+k+']').forEach(function(b){ b.onclick=function(){
      var v=b.getAttribute('data-sup'+k);
      document.querySelectorAll('[data-sup'+k+']').forEach(function(x){ var on2=x===b; x.classList.toggle('on', on2); x.setAttribute('aria-checked', String(on2)); });
      document.getElementById(k==='status' ? 'supStatus' : 'supFreq').value=v;
      if(k==='status'){ var hn=document.querySelector('.supAmtHint'); if(hn) hn.textContent=supAmtHint_(v); }
    }; });
  });
  on('supCancel', function(){ S.supEdit=null; S.supGEdit=null; render(); });
  on('supToday', function(){ var l=document.getElementById('supLast'); if(l) l.value=todayStr(); });
  on('supSave', function(){
    var name=val('supName').trim();
    if(!name){ showMsg(t('Add their name')); return; }
    var p={ id:S.supEdit==='new' ? '' : S.supEdit, name:name, amount:Number(val('supAmt'))||0, freq:val('supFreq'), status:val('supStatus'),
      last:val('supLast')||'', note:val('supNote')||'', channel:val('supChannel').trim() };
    var c=copy();
    if(S.supEdit==='new') c.partners.push(p);
    else c.partners=c.partners.map(function(x){ return x.id===S.supEdit ? p : x; });
    supSave_(c, t('Saved'));
  });
  on('supDel', function(){
    if(!confirm(t('Remove this partner?'))) return;
    var c=copy(); c.partners=c.partners.filter(function(x){ return x.id!==S.supEdit; }); supSave_(c, t('Removed'));
  });
  on('supGSave', function(){
    var name=val('supName').trim();
    if(!name){ showMsg(t('Add their name')); return; }
    var x={ id:S.supGEdit==='new' ? '' : S.supGEdit, name:name, amount:Number(val('supAmt'))||0, freq:val('supFreq'),
      channel:val('supChannel').trim(), location:val('supLoc').trim(), note:val('supNote')||'' };
    var c=copy();
    if(S.supGEdit==='new') c.giving.push(x);
    else c.giving=c.giving.map(function(y){ return y.id===S.supGEdit ? x : y; });
    supSave_(c, t('Saved'));
  });
  on('supGDel', function(){
    if(!confirm(t('Take them off the list of people you support?'))) return;
    var c=copy(); c.giving=c.giving.filter(function(y){ return y.id!==S.supGEdit; }); supSave_(c, t('Removed'));
  });
  var f=document.getElementById('supFile'); if(f) f.onchange=function(){ if(f.files && f.files[0]) supReadFile_(f.files[0]); f.value=''; };
  on('supPasteRead', function(){
    var txt=val('supPaste');
    if(!txt.trim()){ showMsg(t('Paste the rows first.')); return; }
    S.supImport={ fileName:t('Pasted rows'), parsed:GP_FIN.parseSupportTracker(GP_FIN.rowsFromTsv(txt)) }; render();
  });
  on('supImpAdd', function(){ if(!S.supBusy) supImportApply_(); });
  on('supImpDrop', function(){ S.supImport=null; render(); });
}
/* On a mentee's page: their totals, when they share them. Never the names. */
function supMentorCardHtml_(ss, m){
  if(!ss) return '';
  return '<div class="card"><div class="mentorLabel">💰 '+esc(t('Support raising'))+'</div>'+
    '<p style="margin:4px 0 0">'+esc(ss.goal ? gpT('${n} of ${goal} a month ({pct}%)',{n:fmt(ss.pledged), goal:fmt(ss.goal), pct:ss.pct}) : gpT('${n} a month pledged',{n:fmt(ss.pledged)}))+'</p>'+
    '<p class="hint" style="margin:4px 0 0">'+esc(gpT('{a} giving · {b} asked · {c} still to ask',{a:ss.giving, b:ss.asked, c:ss.toask}))+(ss.followUp ? ' · '+esc(gpT('{n} to thank or follow up',{n:ss.followUp})) : '')+'</p>'+
    '<p class="hint" style="margin:4px 0 0">🔒 '+esc(gpT('{name} shares these totals with you — never the names.',{name:firstName_(m.name)}))+'</p></div>';
}

/* ==================== Reminders (Profile & settings → Reminders) ====================
   Web push: one reminder a day at the hour you choose, only when there is something
   to do (see "Reminders: web push" in api.js and netlify/functions/reminders.js). This
   phone subscribes with the app's public key from the boot (S.push.key); the server
   keeps the subscription. iPhones only allow it once the app is on the Home Screen.
   An admin turns reminders on for the whole app in Admin → Reminders. */
S.pushSub=null; S.pushChecked=false; S.pushBusy=false; S.adminPush=null;
function pushSupported_(){ return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification!=='undefined'; }
function pushNeedsInstall_(){
  var ios=/iPhone|iPad|iPod/.test(navigator.userAgent||'');
  var standalone=window.navigator.standalone===true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  return ios && !standalone;
}
function pushKeyBytes_(b64){
  var s=String(b64).replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  var raw=atob(s), out=new Uint8Array(raw.length); for(var i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i); return out;
}
function pushCheck_(){
  if(S.pushChecked || !pushSupported_()) return; S.pushChecked=true;
  navigator.serviceWorker.ready.then(function(reg){ return reg.pushManager.getSubscription(); })
    .then(function(sub){ S.pushSub=sub||null; if(S.view==='profile') render(); }).catch(function(){});
}
function remindersCardHtml_(){
  var P=S.push, h='<div class="card" id="remCard"><label class="f">🔔 '+esc(t('Reminders'))+'</label>';
  if(!P) return S.me && S.me.isAdmin ? h+'<p class="hint" style="margin:0">'+esc(t('Reminders are not turned on for the app yet. Turn them on in Admin → Reminders.'))+'</p></div>' : '';
  if(!pushSupported_()) return h+'<p class="hint" style="margin:0">'+esc(t('This phone or browser can’t show reminders from the app.'))+'</p></div>';
  if(pushNeedsInstall_()) return h+'<p class="hint" style="margin:0">'+esc(t('On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), open it from there, and turn reminders on here.'))+'</p></div>';
  if(Notification.permission==='denied') return h+'<p class="hint" style="margin:0">'+esc(t('Notifications are blocked for this app in your phone’s settings. Allow them there, then come back.'))+'</p></div>';
  pushCheck_();
  if(!S.pushSub) return h+'<p class="hint" style="margin:0 0 8px">'+esc(t('One reminder a day at a time you choose — only when there is something to do.'))+'</p>'+
    '<button class="btn" id="remOn"'+(S.pushBusy?' disabled':'')+'>🔔 '+esc(t('Turn on reminders'))+'</button></div>';
  var pr=P.prefs||{}, opts='';
  for(var hr=5; hr<=22; hr++) opts+='<option value="'+hr+'"'+(pr.hour===hr?' selected':'')+'>'+(hr<10?'0':'')+hr+':00</option>';
  var box=function(id, on, label){ return '<label class="f remBox"><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'> '+esc(label)+'</label>'; };
  var mentor=(S.mentees||[]).length>0;
  h+='<p class="hint" style="margin:0 0 8px">✓ '+esc(t('Reminders are on for this phone.'))+'</p>'+
    '<label class="f" for="remHour">'+esc(t('Remind me at'))+'</label><select id="remHour">'+opts+'</select>'+
    box('remAlerts', pr.alerts!==false, t('Right away: 1-on-1 requests and times, mentor requests, leave'))+
    box('remDaily', pr.daily!==false, t('When today’s check-in isn’t in'))+
    (mentor ? box('remOne', pr.oneonone!==false, t('When my 1-on-1s with a mentee are behind (Mondays)')) : '')+
    (S.me.isAdmin ? box('remAdmin', pr.admin!==false, t('When sign-ups are waiting for approval')) : '')+
    ((S.me.isAdmin || S.me.hr) ? box('remHr', pr.hr!==false, t('When contracts end soon (Mondays)')) : '')+
    '<div class="kmrActs"><button class="btn ghost" id="remTest">'+esc(t('Send me a test'))+'</button><button class="btn ghost" id="remOff">'+esc(t('Turn off'))+'</button></div></div>';
  return h;
}
function remSavePrefs_(){
  var g=function(id, dflt){ var el=document.getElementById(id); return el ? !!el.checked : dflt; };
  var pr=Object.assign({}, (S.push && S.push.prefs)||{});
  pr.hour=Number((document.getElementById('remHour')||{}).value)||pr.hour||19;
  pr.daily=g('remDaily', pr.daily!==false); pr.oneonone=g('remOne', pr.oneonone!==false);
  pr.admin=g('remAdmin', pr.admin!==false); pr.hr=g('remHr', pr.hr!==false); pr.alerts=g('remAlerts', pr.alerts!==false);
  S.push.prefs=pr;
  run('savePushPrefs',[S.auth.user,S.auth.pin,pr],function(d){ if(d && d.ok){ S.push.prefs=d.prefs; showMsg(t('Saved')); } else showMsg(t('Could not save')); });
}
function bindReminders_(){
  var on=document.getElementById('remOn');
  if(on) on.onclick=function(){
    gpTap(); S.pushBusy=true; render();
    var fail=function(msg){ S.pushBusy=false; render(); showMsg(msg || t('Reminders could not be turned on on this phone.')); };
    Promise.resolve(Notification.permission==='granted' ? 'granted' : Notification.requestPermission()).then(function(perm){
      if(perm!=='granted'){ fail(t('Allow notifications to get reminders.')); return; }
      return navigator.serviceWorker.ready.then(function(reg){
        return reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:pushKeyBytes_(S.push.key) });
      }).then(function(sub){
        var j=sub.toJSON();
        run('savePushSub',[S.auth.user,S.auth.pin,{ endpoint:j.endpoint, keys:j.keys }, LANG],function(d){
          S.pushBusy=false;
          if(d && d.ok){ S.pushSub=sub; if(d.prefs) S.push.prefs=d.prefs; render(); showMsg(t('Reminders are on')); }
          else { sub.unsubscribe().catch(function(){}); fail(); }
        }, function(){ sub.unsubscribe().catch(function(){}); fail(); });
      });
    }).catch(function(){ fail(); });
  };
  ['remHour','remAlerts','remDaily','remOne','remAdmin','remHr'].forEach(function(id){ var el=document.getElementById(id); if(el) el.onchange=remSavePrefs_; });
  var tst=document.getElementById('remTest');
  if(tst) tst.onclick=function(){
    tst.disabled=true;
    run('sendTestPush',[S.auth.user,S.auth.pin],function(d){ tst.disabled=false; showMsg(d && d.ok ? t('Sent — it should arrive in a moment') : t('It could not be sent. Try turning reminders off and on again.')); });
  };
  var off=document.getElementById('remOff');
  if(off) off.onclick=function(){
    var sub=S.pushSub; if(!sub) return;
    run('deletePushSub',[S.auth.user,S.auth.pin,sub.endpoint],function(){});
    sub.unsubscribe().catch(function(){}); S.pushSub=null; render(); showMsg(t('Reminders are off for this phone'));
  };
}
function adminRemindersHtml_(){
  if(!S.adminPush){
    if(!S.adminPushLoading){ S.adminPushLoading=true; run('adminPushStatus',[S.auth.user,S.auth.pin],function(d){ S.adminPushLoading=false; if(d && d.ok){ S.adminPush=d; render(); } }); }
    return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  }
  var A=S.adminPush, h='<p class="sub">'+esc(t('Phone reminders: one a day at the time each person chooses, only when there is something to do — today’s check-in, 1-on-1s that are behind, approvals waiting, contracts ending.'))+'</p>';
  if(!A.ready) return h+'<div class="card"><p style="margin:0 0 10px">'+esc(t('Reminders are off for the app. Turning them on lets each person switch them on for their own phone in Profile & settings.'))+'</p>'+
    '<button class="btn" id="admPushOn">🔔 '+esc(t('Turn on reminders for the app'))+'</button></div>';
  var last=A.last||{};
  return h+'<div class="card"><div class="row"><span class="rowName">'+esc(t('Reminders'))+'</span><span class="rowVal">✓ '+esc(t('On'))+'</span></div>'+
    '<div class="row"><span class="rowName">'+esc(t('People with reminders'))+'</span><span class="rowVal">'+A.people+'</span></div>'+
    '<div class="row"><span class="rowName">'+esc(t('Phones'))+'</span><span class="rowVal">'+A.phones+'</span></div>'+
    (last.at ? '<div class="row"><span class="rowName">'+esc(t('Last sent'))+'</span><span class="rowVal">'+esc(teamDate_(String(last.at).slice(0,10)))+' · '+esc(gpT('{n} people',{n:last.people||0}))+'</span></div>' : '')+
    '</div>';
}
function bindAdminReminders_(){
  var b=document.getElementById('admPushOn');
  if(b) b.onclick=function(){
    b.disabled=true;
    run('adminSetUpPush',[S.auth.user,S.auth.pin],function(d){
      if(d && d.ok){ S.adminPush=null; showMsg(t('Reminders are on for the app')); run('getMyBoot',[S.auth.user,S.auth.pin],function(bd){ if(bd && bd.ok) S.push=bd.push||null; render(); }); render(); }
      else { b.disabled=false; showMsg(t('Could not save')); }
    });
  };
}

/* ==================== Khmer review (☰ → Khmer review) ====================
   For the Khmer reviewers an admin chooses (`kmReviewer`) and admins. One draft at
   a time from PENDING_KM (the drafts nobody has checked): the English, the draft
   Khmer, where in the app it is (km-notes.js, built from docs/khmer-needed.md by
   scripts/build-km-notes.mjs, loaded only here), and two answers — ✓ reads right,
   or ✏️ write the fix. A fix shows in the app for everyone at once (gpKmFixes_, from
   the boot); an admin's download is what scripts/apply-km-review.mjs builds into
   REVIEWED_KM. Strings already in REVIEWED_KM are not shown — they are checked. */
S.kmr=null; S.kmrErr=''; S.kmrFilter='todo'; S.kmrIdx=0; S.kmrQ=''; S.kmrEdit=false; S.kmrLoading=false;
function gpKmFixes_(fixes){ Object.keys(fixes||{}).forEach(function(k){ if(typeof fixes[k]==='string' && fixes[k]) BUILTIN_KM[k]=fixes[k]; }); }
function kmrCan_(){ return !!(S.me && !S.guest && !S.board && (S.me.isAdmin || S.me.kmReviewer)); }
function kmrRows_(){ var m={}; ((S.kmr && S.kmr.rows)||[]).forEach(function(r){ m[r.key]=r; }); return m; }
function kmrKeys_(){ return Object.keys(PENDING_KM).filter(function(k){ return !Object.prototype.hasOwnProperty.call(REVIEWED_KM, k); }); }
function kmrSlots_(str){ return (String(str).match(/\{[a-zA-Z0-9_]+\}/g)||[]).sort().join('|'); }
function kmrList_(){
  var rows=kmrRows_(), q=S.kmrQ.trim(), ql=q.toLowerCase(), f=S.kmrFilter;
  return kmrKeys_().filter(function(k){
    var r=rows[k];
    if(f==='todo' && r) return false;
    if(f==='fix' && !(r && r.verdict==='fix')) return false;
    if(f==='ok' && !(r && r.verdict==='ok')) return false;
    if(q && k.toLowerCase().indexOf(ql)===-1 && String(PENDING_KM[k]).indexOf(q)===-1 && !(r && r.km && r.km.indexOf(q)>-1)) return false;
    return true;
  });
}
function kmrLoad_(){
  if(S.kmrLoading) return; S.kmrLoading=true;
  run('getKmReview',[S.auth.user,S.auth.pin],function(d){
    S.kmrLoading=false;
    if(d && d.ok) S.kmr={ rows:d.rows||[] }; else S.kmrErr=t('Could not load');
    if(S.view==='kmreview') render();
  }, function(){ S.kmrLoading=false; S.kmrErr=t('Could not load'); if(S.view==='kmreview') render(); });
  if(typeof GP_KM_NOTES==='undefined' && !S.kmrNotesAsked){
    S.kmrNotesAsked=true;
    var sc=document.createElement('script'); sc.src='km-notes.js'; sc.setAttribute('data-optional','');
    sc.onload=function(){ if(S.view==='kmreview') render(); }; sc.onerror=function(){ sc.remove(); };
    document.head.appendChild(sc);
  }
}
/* where a string is used, from the review document's section headings */
function kmrWhere_(k){
  if(typeof GP_KM_NOTES==='undefined') return '';
  var h=5381; for(var i=0;i<k.length;i++) h=((h*33)^k.charCodeAt(i))>>>0;
  var ix=GP_KM_NOTES.k[h.toString(36)];
  return ix===undefined ? '' : GP_KM_NOTES.s[ix]||'';
}
function kmReviewHtml(){
  var h='<h2>🇰🇭 '+esc(t('Khmer review'))+'</h2><p class="sub">'+esc(t('Read each draft Khmer phrase. If it reads right, say so. If not, write it the way it should be. A fix shows in the app straight away.'))+'</p>';
  if(!kmrCan_()) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('Khmer review is for the Khmer reviewers an admin has chosen.'))+'</p></div>';
  if(!S.kmr){ kmrLoad_(); return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.kmrErr||t('Loading…'))+'</p></div>'; }
  var all=kmrKeys_(), rows=kmrRows_(), nOk=0, nFix=0;
  all.forEach(function(k){ var r=rows[k]; if(r && r.verdict==='ok') nOk++; else if(r && r.verdict==='fix') nFix++; });
  var done=nOk+nFix, pct=all.length ? Math.round(done/all.length*100) : 100;
  h+='<div class="card kmrProgress"><div class="pBar"><div class="pBarTop"><b>'+esc(gpT('{n} of {total} checked',{n:done, total:all.length}))+'</b><span>'+pct+'%</span></div>'+
    '<div class="pTrack"><div class="pFill" style="left:0;width:'+pct+'%;background:var(--accent)"></div></div></div>'+
    (S.me.isAdmin && done ? '<button class="btn ghost small" id="kmrExport" style="margin-top:10px">⬇️ '+esc(t('Download the checked phrases'))+'</button>' : '')+'</div>';
  var chip=function(id, label, n){ return '<button class="deptChip'+(S.kmrFilter===id?' on':'')+'" data-kmrfilter="'+id+'">'+esc(label)+' · '+n+'</button>'; };
  h+='<div class="deptChips">'+chip('todo', t('Not checked yet'), all.length-done)+chip('fix', t('Fixed'), nFix)+chip('ok', t('Reads right'), nOk)+chip('all', t('All'), all.length)+'</div>';
  h+='<input type="search" id="kmrSearch" class="kmrSearch" placeholder="'+esc(t('Search English or Khmer'))+'" value="'+esc(S.kmrQ)+'">';
  var list=kmrList_();
  if(!list.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(S.kmrFilter==='todo' && !S.kmrQ ? t('Every draft has been checked. Thank you!') : t('Nothing here.'))+'</p></div>';
  if(S.kmrIdx>=list.length) S.kmrIdx=list.length-1;
  if(S.kmrIdx<0) S.kmrIdx=0;
  var k=list[S.kmrIdx], r=rows[k], where=kmrWhere_(k);
  h+='<div class="card kmrCard" data-kmrkey="'+esc(k)+'">'+
    '<div class="kmrPos">'+esc(gpT('{i} of {n}',{i:S.kmrIdx+1, n:list.length}))+'</div>'+
    (where ? '<div class="kmrWhere">📍 '+esc(where)+'</div>' : '')+
    '<div class="kmrLabel">'+esc(t('English'))+'</div><div class="kmrEn">'+esc(k)+'</div>'+
    '<div class="kmrLabel">'+esc(t('Draft Khmer'))+'</div><div class="kmrKm" lang="km">'+esc(PENDING_KM[k])+'</div>';
  if(r) h+='<div class="kmrDone '+(r.verdict==='fix'?'fix':'ok')+'">'+(r.verdict==='fix'
      ? '✏️ '+esc(gpT('Fixed by {name}',{name:r.byName||'—'}))+'<div class="kmrKm" lang="km">'+esc(r.km)+'</div>'
      : '✓ '+esc(gpT('{name} says it reads right',{name:r.byName||'—'})))+
    ' <button class="linkbtn inline" id="kmrClear" style="width:auto;padding:0">'+esc(t('Undo'))+'</button></div>';
  if(S.kmrEdit){
    h+='<label class="f" for="kmrText">'+esc(t('How it should read'))+'</label>'+
      '<textarea id="kmrText" lang="km" rows="3">'+esc((r && r.km) || PENDING_KM[k])+'</textarea>'+
      (kmrSlots_(k) ? '<p class="hint">'+esc(gpT('Keep {slots} exactly as they are — the app puts names and numbers there.',{slots:kmrSlots_(k).split('|').join(' ')}))+'</p>' : '')+
      '<div class="kmrActs"><button class="btn" id="kmrSaveFix">'+esc(t('Save the fix'))+'</button><button class="btn ghost" id="kmrCancel">'+esc(t('Cancel'))+'</button></div>';
  } else {
    h+='<div class="kmrActs"><button class="btn" id="kmrOk">✓ '+esc(t('Reads right'))+'</button><button class="btn ghost" id="kmrFix">✏️ '+esc(t('Fix it'))+'</button></div>';
  }
  h+='<div class="kmrNav"><button class="linkbtn" id="kmrPrev"'+(S.kmrIdx>0?'':' disabled')+'>‹ '+esc(t('Back'))+'</button>'+
    '<button class="linkbtn" id="kmrNext"'+(S.kmrIdx<list.length-1?'':' disabled')+'>'+esc(t('Skip'))+' ›</button></div></div>';
  return h;
}
function kmrSave_(key, verdict, km){
  run('saveKmReview',[S.auth.user,S.auth.pin,key,verdict,km||''],function(d){
    if(!d || !d.ok){ showMsg(d && d.err==='placeholders' ? t('Keep the words in curly brackets exactly as they are.') : d && d.err==='not_khmer' ? t('Write the fix in Khmer.') : t('Could not save')); return; }
    var rows=(S.kmr.rows||[]).filter(function(x){ return x.key!==key; });
    if(d.row) rows.push(d.row);
    S.kmr.rows=rows;
    if(verdict==='fix') BUILTIN_KM[key]=km;
    if(verdict==='clear') BUILTIN_KM[key]=PENDING_KM[key];
    /* "Not checked yet" drops the answered one, so the next is already in place */
    if(S.kmrFilter!=='todo' && verdict!=='clear') S.kmrIdx++;
    S.kmrEdit=false; render();
  });
}
function bindKmReview_(){
  if(S.view!=='kmreview') return;
  document.querySelectorAll('[data-kmrfilter]').forEach(function(b){
    b.onclick=function(){ S.kmrFilter=b.getAttribute('data-kmrfilter'); S.kmrIdx=0; S.kmrEdit=false; render(); };
  });
  var sr=document.getElementById('kmrSearch');
  if(sr) sr.onchange=function(){ S.kmrQ=sr.value; S.kmrIdx=0; S.kmrEdit=false; render(); };
  var card=document.querySelector('.kmrCard'), key=card ? card.getAttribute('data-kmrkey') : '';
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  on('kmrOk', function(){ gpTap(); kmrSave_(key, 'ok'); });
  on('kmrFix', function(){ S.kmrEdit=true; render(); var ta=document.getElementById('kmrText'); if(ta) ta.focus(); });
  on('kmrCancel', function(){ S.kmrEdit=false; render(); });
  on('kmrSaveFix', function(){
    var v=(document.getElementById('kmrText')||{}).value||'';
    v=v.trim();
    if(!/[ក-៿]/.test(v)){ showMsg(t('Write the fix in Khmer.')); return; }
    if(kmrSlots_(v)!==kmrSlots_(key)){ showMsg(t('Keep the words in curly brackets exactly as they are.')); return; }
    if(v===PENDING_KM[key]){ kmrSave_(key, 'ok'); return; }   // unchanged is a "reads right"
    kmrSave_(key, 'fix', v);
  });
  on('kmrClear', function(){ kmrSave_(key, 'clear'); });
  on('kmrPrev', function(){ S.kmrIdx--; S.kmrEdit=false; render(); });
  on('kmrNext', function(){ S.kmrIdx++; S.kmrEdit=false; render(); });
  on('kmrExport', function(){
    var out={ ok:{}, fix:{} };
    (S.kmr.rows||[]).forEach(function(r){ if(r.verdict==='ok' && PENDING_KM[r.key]) out.ok[r.key]=PENDING_KM[r.key]; else if(r.verdict==='fix') out.fix[r.key]=r.km; });
    var blob=new Blob([JSON.stringify(out, null, 1)], { type:'application/json' });
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='khmer-review-'+todayStr()+'.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
}

/* ---------- a board member's own sign-in (not staff) ---------- */
var BOARD_KEY='gp-board';
var BOARD_VIEWS=['ywamgp','base','report','library','p360'];   // p360: a board member answers 360 reviews
function boardEnter_(member, creds){
  lsSet(BOARD_KEY, JSON.stringify(creds));
  S.board=member; S.boardAuth=creds; S.guest=true;
  S.me={ id:'board', name:member.name, photo:member.photo||'', boardRole:member.role, username:'', campus:lsGet('gp-guest-campus')||'siemreap',
    dept:'', ministry:'', role:'', staffType:'', country:'', ministries:[], leads:[], guest:true };
  S.profile={}; S.auth={ user:'', pin:'' }; S.regMode=false; S.view='ywamgp'; S.roster=[]; S.required=null; S.reqDocs=[];
  gpGuestLoadBase_(); orgLoad_();
  render(); window.scrollTo(0,0);
}
function boardLeave_(expired){
  lsDel(BOARD_KEY);
  S.board=null; S.boardAuth=null; S.guest=false; S.me=null; S.base=null; S.org=null; S.menuOpen=false; S.view='week';
  renderMenu(); render(); window.scrollTo(0,0);
  if(expired) showMsg(t('Please sign in again'));
}
function boardResume_(){
  var c=null; try { c=JSON.parse(lsGet(BOARD_KEY)||'null'); } catch(e){}
  if(!c || !c.user) return false;
  S.boardAuth=c;
  run('boardLogin',[c.user,c.pin],function(d){ if(d && d.ok) boardEnter_(d.member, c); else boardLeave_(true); }, function(){ boardLeave_(false); });
  return true;
}

/* ---------- Admin → Advisory Board ---------- */
function adminBoardHtml_(){
  if(!S.adminBoard){
    if(!S.adminBoardLoading){ S.adminBoardLoading=true; run('adminListBoard',[S.auth.user,S.auth.pin],function(d){ S.adminBoardLoading=false; if(d && d.ok){ S.adminBoard=d; render(); } }); }
    return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  }
  var B=S.adminBoard.board, ed=S.adminBoardEdit;
  var h='<p class="sub">'+esc(t('The YWAM GP Advisory Board — not staff, so never in a roster, headcount or campus chart. Every staff member can see them on the YWAM GP page and contact them. Someone already on staff is linked to their profile; anyone else gets their own username and PIN for a board-only view.'))+'</p>';
  if(!ed) h+='<button class="btn" id="bdAdd">＋ '+esc(t('Add a board member'))+'</button>';
  if(ed) h+=adminBoardFormHtml_(ed);
  B.forEach(function(b){
    h+='<div class="card"><div class="mentorBlock" style="padding:0">'+avatarHtml(b,'sm')+'<div style="flex:1;min-width:0"><div class="mentorName">'+esc(b.name)+'</div>'+
      '<div class="mentorMeta">'+esc(t(b.role))+(b.safeguarding ? ' · 🛡️' : '')+(b.staffId ? ' · '+esc(t('on staff')) : b.hasLogin ? ' · '+esc(gpT('signs in as {u}',{u:b.username})) : ' · '+esc(t('no sign-in yet')))+'</div></div>'+
      '<button class="linkbtn" style="width:auto;margin:0" data-bdedit="'+esc(b.id)+'">'+esc(t('Edit'))+'</button></div></div>';
  });
  return h;
}
function adminBoardFormHtml_(ed){
  var roles=(S.adminBoard && S.adminBoard.roles) || ['President','Secretary','Treasurer','Advisor'];
  var staffOpts=(S.adminStaff||[]).filter(function(x){ return x.active; }).sort(function(a,b){ return String(a.name).localeCompare(b.name); });
  return '<div class="card" id="bdForm"><div class="mentorLabel">'+esc(ed.id ? t('Edit board member') : t('New board member'))+'</div>'+
    '<label class="f">'+esc(t('Already on staff?'))+'</label><select id="bd_staff"><option value="">'+esc(t('No — someone outside the staff'))+'</option>'+
      staffOpts.map(function(x){ return '<option value="'+esc(x.id)+'"'+(ed.staffId===x.id?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+'</select>'+
    '<label class="f">'+esc(t('Name'))+'</label><input type="text" id="bd_name" maxlength="80" value="'+esc(ed.name||'')+'">'+
    '<label class="f">'+esc(t('Role on the board'))+'</label><input type="text" id="bd_role" maxlength="40" list="bd_roles" value="'+esc(ed.role||'Advisor')+'">'+
      '<datalist id="bd_roles">'+roles.map(function(r){ return '<option value="'+esc(r)+'">'; }).join('')+'</datalist>'+
    '<label class="f">'+esc(t('Email'))+'</label><input type="email" id="bd_email" maxlength="120" value="'+esc(ed.email||'')+'">'+
    '<label class="f">'+esc(t('Phone (optional)'))+'</label><input type="tel" id="bd_phone" maxlength="40" value="'+esc(ed.phone||'')+'">'+
    '<label class="f">'+esc(t('A short bio'))+'</label><textarea id="bd_bio" maxlength="600" rows="3">'+esc(ed.bio||'')+'</textarea>'+
    '<label class="f" style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;font-size:13px;margin-top:12px"><input type="checkbox" id="bd_safe"'+(ed.safeguarding?' checked':'')+'> 🛡️ '+esc(t('Safeguarding contact — serious concerns from staff go to them'))+'</label>'+
    (ed.safeguarding && ed.staffId ? '<p class="hint" style="margin:4px 0 0">⚠️ '+esc(t('Best someone who is not on staff — a concern may be about a staff leader.'))+'</p>' : '')+
    '<label class="f">'+esc(t('Photo'))+'</label><div class="bdPhotoRow">'+avatarHtml({ name:ed.name||'?', photo:ed.photo||'' },'sm')+'<input type="file" id="bd_photo" accept="image/*"></div>'+
    '<div id="bd_login"'+(ed.staffId?' style="display:none"':'')+'><label class="f">'+esc(t('Username for their own sign-in'))+'</label><input type="text" id="bd_user" maxlength="20" value="'+esc(ed.username||'')+'" autocapitalize="off">'+
      '<label class="f">'+esc(ed.hasLogin ? t('New 4-digit PIN (leave empty to keep it)') : t('4-digit PIN'))+'</label><input type="text" id="bd_pin" inputmode="numeric" maxlength="4"></div>'+
    '<div class="btnRow"><button class="btn" id="bdSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="bdCancel">'+esc(t('Cancel'))+'</button></div>'+
    (ed.id ? '<button class="linkbtn" id="bdDelete" style="color:var(--bad)">'+esc(t('Remove from the board'))+'</button>' : '')+'</div>';
}
function bindAdminBoard_(){
  var add=document.getElementById('bdAdd');
  if(add) add.onclick=function(){ S.adminBoardEdit={ role:'Advisor' }; render(); };
  document.querySelectorAll('[data-bdedit]').forEach(function(b){
    b.onclick=function(){ var id=b.getAttribute('data-bdedit'); S.adminBoardEdit=Object.assign({}, (S.adminBoard.board||[]).filter(function(x){ return x.id===id; })[0]); render(); window.scrollTo(0,0); };
  });
  var ed=S.adminBoardEdit; if(!ed) return;
  var keep=function(){ ['name','role','email','phone','bio'].forEach(function(k){ var el=document.getElementById('bd_'+k); if(el) ed[k]=el.value; });
    var sf=document.getElementById('bd_safe'); if(sf) ed.safeguarding=sf.checked;
    var u=document.getElementById('bd_user'); if(u) ed.username=u.value; };
  var st=document.getElementById('bd_staff');
  if(st) st.onchange=function(){ keep(); ed.staffId=st.value; if(st.value && !ed.name){ var p=(S.adminStaff||[]).filter(function(x){ return x.id===st.value; })[0]; if(p) ed.name=p.name; } render(); };
  var ph=document.getElementById('bd_photo');
  if(ph) ph.onchange=function(){
    var f=ph.files && ph.files[0]; if(!f) return; keep();
    var rd=new FileReader(); rd.onload=function(e){ var img=new Image(); img.onload=function(){
      var max=300, w=img.width, h=img.height;
      if(w>h && w>max){ h=Math.round(h*max/w); w=max; } else if(h>max){ w=Math.round(w*max/h); h=max; }
      var cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h);
      ed.photo=cv.toDataURL('image/jpeg',0.7); render();
    }; img.src=e.target.result; }; rd.readAsDataURL(f);
  };
  var cancel=document.getElementById('bdCancel'); if(cancel) cancel.onclick=function(){ S.adminBoardEdit=null; render(); };
  var save=document.getElementById('bdSave');
  if(save) save.onclick=function(){
    keep();
    var pin=(document.getElementById('bd_pin')||{}).value||'';
    var m={ id:ed.id, staffId:ed.staffId||'', name:ed.name, role:ed.role, email:ed.email, phone:ed.phone, bio:ed.bio, photo:ed.photo||'', safeguarding:!!ed.safeguarding };
    if(!ed.staffId){ m.username=ed.username||''; if(pin) m.newPin=pin; }
    save.disabled=true;
    run('adminSaveBoardMember',[S.auth.user,S.auth.pin,m],function(d){
      save.disabled=false;
      if(d && d.ok){ S.adminBoard=d; S.adminBoardEdit=null; S.org=null; showMsg(t('Saved')); render(); }
      else showMsg(t({ username_taken:'That username is already taken', bad_username:'Usernames are 2–20 letters or numbers', bad_pin:'The PIN must be 4 digits',
        bad_email:'That email doesn’t look right', name_required:'Add their name', bad_photo:'That photo didn’t work — try a smaller one' }[d && d.err] || 'Could not save'));
    });
  };
  var del=document.getElementById('bdDelete');
  if(del) del.onclick=function(){
    if(!confirm(t('Remove this person from the advisory board?'))) return;
    run('adminDeleteBoardMember',[S.auth.user,S.auth.pin,ed.id],function(d){ if(d && d.ok){ S.adminBoard=d; S.adminBoardEdit=null; S.org=null; render(); } });
  };
}

