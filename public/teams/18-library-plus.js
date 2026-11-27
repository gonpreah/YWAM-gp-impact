/* My YWAM GP — teams.html: the Library, read together (Nov 2026, Uriah).
   "Suggest improvements that will motivate our team to read the books … let's do em all."
   Everything here sits around the reading the Library already had (03-library-org.js):
   - 📅 Book of the month: Campus Leadership or an admin makes any book the campus's book (on its
     page); a banner in the Library and a line on My Home say how many have read it.
   - 🗺️ Reading plans: GP_LIBRARY.plans — a few books in order, with a bar; start one yourself, or a
     mentor gives one (their mentee's page); a marriage plan ends in the couple check-up.
   - 📝 One thing I'll do: after "Done", one question; the answer is yours alone (S.lib.mine.notes),
     and can go straight onto this week's goals.
   - 👥 Together: what your campus has finished lately (only people who chose to share), the books
     read most, and "recommend this to someone".
   - 🏅 A reason to come back: books this year against your own goal, weeks in a row, badges, confetti.
   - 🔎 Search and topics (GP_LIBRARY.tags), and "read next" when a book is done.
   The server's part is S.lib (the boot's `lib`, api.js libOut_); guests and students have none, so
   they get the search, topics, plans (on the phone) and badges only. */
S.lib=null; S.libQ=''; S.libPlan=null; S.libDone=null; S.libNewBadges=[]; S.libRecOpen=false; S.libRecTo=''; S.libGoalOpen=false; S.libBusy=false;
function libOn_(){ return !!(S.lib && S.auth && S.auth.user && !S.guest && !S.student && !S.stuPreview); }
function libMineS_(){ var m=(S.lib && S.lib.mine) || { share:false, shareAsked:false, goal:0, notes:{}, plans:{} }; if(!m.quiz) m.quiz={}; return m; }
function libTake_(d, after){
  S.libBusy=false;
  if(!d || !d.ok){
    showMsg({ too_many:t('You have recommended five books today — more tomorrow.'), already:t('You already recommended this book to them.'), not_authorized:t('Only Campus Leadership can choose the book of the month.') }[d && d.err] || t('Could not save — check your connection and try again.'));
    render(); return;
  }
  if(d.lib) S.lib=d.lib;
  if(after) after(d);
  render();
}
function libCall_(fn, args, after){ S.libBusy=true; run(fn, [S.auth.user,S.auth.pin].concat(args||[]), function(d){ libTake_(d, after); }, function(){ libTake_(null); }); }

/* ---------- counting: this year, weeks in a row, badges ---------- */
function libYearN_(read){ var y=String(new Date().getFullYear()), n=0; Object.keys(read).forEach(function(k){ if(String(read[k]||'').slice(0,4)===y) n++; }); return n; }
function libWeekKey_(d){ var m=new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate()-((m.getDay()+6)%7)); return m.getFullYear()+'-'+('0'+(m.getMonth()+1)).slice(-2)+'-'+('0'+m.getDate()).slice(-2); }
/* weeks running (Monday to Sunday) with a book finished — this week counts once it has one, and
   a week not over yet doesn't break the run */
function libWeekStreak_(read){
  var weeks={}; Object.keys(read).forEach(function(k){ var v=String(read[k]||''); if(/^\d{4}-\d\d-\d\d$/.test(v)) weeks[libWeekKey_(new Date(Number(v.slice(0,4)), Number(v.slice(5,7))-1, Number(v.slice(8,10))))]=1; });
  var d=new Date(), n=0;
  if(!weeks[libWeekKey_(d)]) d.setDate(d.getDate()-7);
  while(weeks[libWeekKey_(d)]){ n++; d.setDate(d.getDate()-7); }
  return n;
}
function libPlanDone_(p, read){ return p.books.filter(function(id){ return read[id]; }).length; }
function libBadges_(read){
  var n=Object.keys(read).filter(function(id){ return libById_(id); }).length, out=[];
  [[1,'📗','First book'],[5,'📚','5 books'],[10,'🏅','10 books'],[25,'🏆','25 books']].forEach(function(x){ out.push({ id:'n'+x[0], emoji:x[1], name:t(x[2]), have:n>=x[0] }); });
  GP_LIBRARY.shelves.forEach(function(sh){
    var books=GP_LIBRARY.books.filter(function(b){ return b.shelf===sh.id; });
    out.push({ id:'shelf-'+sh.id, emoji:sh.emoji||'📚', name:gpT('Shelf finished: {name}',{name:t(sh.name)}), have:books.length>0 && books.every(function(b){ return read[b.id]; }) });
  });
  (GP_LIBRARY.plans||[]).forEach(function(p){ out.push({ id:'plan-'+p.id, emoji:p.emoji||'🗺️', name:gpT('Plan finished: {name}',{name:t(p.name)}), have:libPlanDone_(p, read)===p.books.length }); });
  out.push({ id:'all', emoji:'👑', name:t('The whole Library'), have:n>=GP_LIBRARY.books.length });
  return out;
}

/* ---------- search and topics ---------- */
function libTag_(id){ return (GP_LIBRARY.tags||[]).filter(function(x){ return x.id===id; })[0]; }
function libMatches_(q){
  q=String(q||'').trim().toLowerCase(); if(!q) return [];
  return GP_LIBRARY.books.filter(function(b){
    var hay=[b.title, b.author, libTitle_(b), libAuthor_(b), b.vibe].concat((b.tags||[]).map(function(id){ var g=libTag_(id); return g ? g.name+' '+t(g.name) : ''; })).join(' ').toLowerCase();
    return hay.indexOf(q)>-1;
  });
}
function libFindHtml_(){
  return '<label class="gtFind libFind">'+(typeof gptIc_==='function' ? gptIc_('search') : '🔎')+'<input type="search" id="libFind" value="'+esc(S.libQ)+'" placeholder="'+esc(t('Search a title, an author or a topic…'))+'" autocomplete="off"></label>';
}
function libTagsRowHtml_(){
  var tags=GP_LIBRARY.tags||[]; if(!tags.length) return '';
  return '<div class="libShelves libTags" id="libTags">'+tags.map(function(g){
    var on=S.libShelf==='tag:'+g.id;
    return '<button class="libShelfBtn libTagBtn'+(on?' on':'')+'" data-libshelf="tag:'+esc(g.id)+'">'+g.emoji+' '+esc(t(g.name))+'</button>'; }).join('')+'</div>';
}

/* ---------- the top of the Library: my reading, the month's book, recommendations, plans ---------- */
function libMineHtml_(read){
  var M=libMineS_(), yr=libYearN_(read), st=libWeekStreak_(read), badges=libBadges_(read), have=badges.filter(function(x){ return x.have; });
  var next=badges.filter(function(x){ return !x.have; })[0];
  var h='<div class="card libMine" id="libMine"><div class="libMineTop"><div><b class="libMineN">'+yr+'</b> '+esc(M.goal ? gpT('of {n} books this year',{n:M.goal}) : t('books this year'))+'</div>'+
    (st>=2 ? '<span class="libStreak" id="libStreak">🔥 '+esc(gpT('{n} weeks in a row',{n:st}))+'</span>' : '')+'</div>'+
    (M.goal ? '<div class="libProgressBar libGoalBar"><span style="width:'+Math.min(100, Math.round(yr/M.goal*100))+'%"></span></div>' : '')+
    '<div class="libBadges" id="libBadges">'+have.map(function(x){ return '<span class="libBadge" title="'+esc(x.name)+'">'+x.emoji+'</span>'; }).join('')+
      (next ? '<span class="libBadge next" title="'+esc(next.name)+'">'+next.emoji+'</span><span class="libBadgeNext">'+esc(gpT('Next: {name}',{name:next.name}))+'</span>' : '')+'</div>';
  h+=libQuizSumHtml_(M.quiz, 'libQuizSum');
  if(libOn_()){
    h+=S.libGoalOpen
      ? '<div class="libGoalPick" id="libGoalPick"><span class="pmeta">'+esc(t('How many books this year?'))+'</span> '+[6,12,24,52].map(function(n){ return '<button class="libShelfBtn'+(M.goal===n?' on':'')+'" data-libgoal="'+n+'">'+n+'</button>'; }).join('')+
        (M.goal ? '<button class="libShelfBtn" data-libgoal="0">'+esc(t('No goal'))+'</button>' : '')+'</div>'
      : '<button class="linkbtn" id="libGoalOpen" style="padding-left:0">'+esc(M.goal ? t('Change my goal') : '🎯 '+t('Set a goal for the year'))+'</button>';
  }
  return h+'</div>';
}
function libMonthHtml_(read){
  if(!libOn_()) return '';
  var m=S.lib.month, b=m && libById_(m.bookId);
  if(!b) return S.lib.canPick ? '<div class="card libMonth empty" id="libMonth"><div class="libKicker">📅 '+esc(t('Book of the month'))+'</div><p class="sub" style="margin:4px 0 0">'+esc(t('None chosen yet. Open any book and tap “Make this the book of the month” — everyone on your campus will see it here.'))+'</p></div>' : '';
  var pct=m.total ? Math.round(m.readers/m.total*100) : 0;
  return '<div class="card libMonth" id="libMonth" style="--libc:'+libTint_(b)+'"><div class="libKicker">📅 '+esc(t('Book of the month'))+'</div>'+
    '<button class="libMonthRow" data-libbook="'+esc(b.id)+'"><span class="libMonthCover">'+libCoverHtml_(b)+'</span>'+
    '<span class="libMonthText"><b>'+esc(libTitle_(b))+'</b><span class="pmeta">'+esc(libAuthor_(b))+'</span>'+(m.note ? '<span class="libMonthNote">'+esc(m.note)+'</span>' : '')+
    '<span class="libMonthCount" id="libMonthCount">'+esc(gpT('{n} of {total} at {campus} have read it',{n:m.readers, total:m.total, campus:campusName(S.me.campus)}))+'</span>'+
    '<span class="libProgressBar"><span style="width:'+pct+'%"></span></span>'+
    '<span class="libMonthCta">'+esc(read[b.id] ? '✓ '+t('You’ve read it') : '▶ '+t('Read it — ten minutes'))+'</span></span></button></div>';
}
function libRecsHtml_(){
  if(!libOn_() || !S.lib.recs.length) return '';
  return '<div class="card libRecs" id="libRecs"><div class="libKicker">💌 '+esc(t('Recommended to you'))+'</div>'+S.lib.recs.map(function(r){
    var b=libById_(r.bookId); if(!b) return '';
    return '<div class="libRecRow"><button class="libRecBook" data-libbook="'+esc(b.id)+'"><b>'+esc(libTitle_(b))+'</b><span class="pmeta">'+esc(gpT('from {name}',{name:r.from.name}))+(r.note ? ' — '+esc(r.note) : '')+'</span></button>'+
      '<button class="gptX" data-librecdone="'+esc(r.id)+'" aria-label="'+esc(t('Remove'))+'">×</button></div>'; }).join('')+'</div>';
}
function libPlanState_(p){ var M=libMineS_(); return M.plans[p.id] || libPlansLocal_()[p.id] || null; }
function libPlansLocal_(){ try { return JSON.parse(lsGet('gp-lib-plans')||'{}')||{}; } catch(e){ return {}; } }
function libPlansHtml_(read){
  var plans=GP_LIBRARY.plans||[]; if(!plans.length) return '';
  var mine=plans.filter(function(p){ return libPlanState_(p); }), rest=plans.filter(function(p){ return !libPlanState_(p); });
  return '<div class="libHead2"><h3>🗺️ '+esc(t('Reading plans'))+'</h3></div><div class="libScroll libPlanRow" id="libPlans">'+mine.concat(rest).map(function(p){
    var done=libPlanDone_(p, read), st=libPlanState_(p);
    return '<button class="card libPlanCard'+(st?' on':'')+'" data-libplan="'+esc(p.id)+'"><span class="libPlanEmoji">'+p.emoji+'</span><b>'+esc(t(p.name))+'</b>'+
      '<span class="pmeta">'+esc(gpT('{n} of {m} read',{n:done, m:p.books.length}))+(st ? ' · '+esc(st.by ? gpT('from {name}',{name:nameOf(st.by)}) : t('Started')) : '')+'</span>'+
      '<span class="libProgressBar"><span style="width:'+Math.round(done/p.books.length*100)+'%"></span></span></button>'; }).join('')+'</div>';
}
function libPlanPageHtml_(p){
  var read=libRead_(), prog=libProg_(), done=libPlanDone_(p, read), st=libPlanState_(p), all=done===p.books.length;
  var h='<button class="linkbtn" id="libPlanBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('Library'))+'</button>'+
    '<h2>'+p.emoji+' '+esc(t(p.name))+'</h2><p class="sub">'+esc(t(p.desc))+'</p>'+
    '<div class="libProgress"><b>'+done+'</b> / '+p.books.length+' '+esc(t('read'))+'<span class="libProgressBar"><span style="width:'+Math.round(done/p.books.length*100)+'%"></span></span></div>'+
    (st && st.by ? '<p class="pmeta">'+esc(gpT('{name} gave you this plan.',{name:nameOf(st.by)}))+'</p>' : '')+
    (all ? '<div class="banner" id="libPlanAll">🎉 '+esc(t('You finished this plan. Well done!'))+'</div>' : '');
  var nextIdx=-1; p.books.forEach(function(id, i){ if(nextIdx<0 && !read[id]) nextIdx=i; });
  h+='<div class="libPlanList" id="libPlanList">'+p.books.map(function(id, i){
    var b=libById_(id); if(!b) return '';
    return '<button class="card libPlanItem'+(read[id]?' done':'')+(i===nextIdx?' next':'')+'" data-libbook="'+esc(id)+'"><span class="libInsightNum">'+(read[id]?'✓':(i+1))+'</span>'+
      '<span class="libPlanItemText"><b>'+esc(libTitle_(b))+'</b><span class="pmeta">'+esc(libAuthor_(b))+' · ⏱ '+esc(gpT('{n} min',{n:b.mins||10}))+(i===nextIdx ? ' · '+esc(prog[id] ? t('Continue') : t('Read next')) : '')+'</span></span><span class="libInsideGo">›</span></button>'; }).join('');
  if(p.end==='couple' && libOn_()) h+='<button class="card libPlanItem end" id="libPlanCouple"><span class="libInsightNum">💍</span><span class="libPlanItemText"><b>'+esc(t('Then: take the couple check-up together'))+'</b><span class="pmeta">'+esc(t('In Tests — each of you answers, then you see what to talk about.'))+'</span></span><span class="libInsideGo">›</span></button>';
  h+='</div>';
  h+= st ? (st.by ? '' : '<button class="btn ghost" id="libPlanStop">'+esc(t('Take this plan off my list'))+'</button>')
         : '<button class="btn" id="libPlanStart">▶ '+esc(t('Start this plan'))+'</button>';
  return h;
}

/* ---------- the foot of the Library: what the campus is reading ---------- */
function libTeamHtml_(){
  if(!libOn_()) return '';
  var M=libMineS_(), L=S.lib, h='';
  var feed=L.feed.filter(function(f){ return libById_(f.bookId); });
  h+='<div class="libHead2"><h3>👥 '+esc(gpT('Reading at {campus}',{campus:campusName(S.me.campus)}))+'</h3></div><div class="card libTeam" id="libFeed">';
  h+= feed.length ? feed.map(function(f){ var b=libById_(f.bookId);
      return '<button class="libFeedRow" data-libbook="'+esc(b.id)+'"><span class="libFeedWho">'+esc(f.id===S.me.id ? t('You') : firstName_(f.name))+'</span> '+esc(t('finished'))+' <b>'+esc(libTitle_(b))+'</b><span class="pmeta"> · '+esc(teamDate_(f.date))+'</span></button>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('Nobody has shared a finished book yet. Be the first — it encourages others to read.'))+'</p>';
  h+='<label class="libShareRow"><input type="checkbox" id="libShare"'+(M.share?' checked':'')+'> '+esc(t('Show the books I finish to my campus'))+'</label></div>';
  var top=L.top.filter(function(x){ return libById_(x.bookId); });
  if(top.length) h+='<div class="libHead2"><h3>📈 '+esc(t('Read the most'))+'</h3></div><div class="card libTeam" id="libTop">'+top.map(function(x, i){ var b=libById_(x.bookId);
    return '<button class="libFeedRow" data-libbook="'+esc(b.id)+'"><span class="libTopN">'+(i+1)+'</span> <b>'+esc(libTitle_(b))+'</b><span class="pmeta"> · '+esc(gpT('{n} of us',{n:x.n}))+'</span></button>'; }).join('')+'</div>';
  return h;
}

/* ---------- a book's page: topics, my note, recommend, the month ---------- */
function libBookTagsHtml_(b){
  return (b.tags||[]).map(function(id){ var g=libTag_(id); return g ? '<button class="libShelfTag libTagLink" data-libshelf="tag:'+esc(id)+'" data-libleave="1">'+g.emoji+' '+esc(t(g.name))+'</button>' : ''; }).join(' ');
}
function libSuggest_(b, read){
  var out=[], add=function(x){ if(x && x.id!==b.id && !read[x.id] && out.indexOf(x)===-1) out.push(x); };
  (GP_LIBRARY.plans||[]).forEach(function(p){ if(libPlanState_(p) && p.books.indexOf(b.id)>-1) add(libById_(p.books.filter(function(id){ return !read[id] && id!==b.id; })[0])); });
  if(libOn_() && S.lib.month) add(libById_(S.lib.month.bookId));
  GP_LIBRARY.books.filter(function(x){ return (x.tags||[]).some(function(g){ return (b.tags||[]).indexOf(g)>-1; }); })
    .sort(function(x, y){ return (y.shelf===b.shelf)-(x.shelf===b.shelf); }).forEach(add);
  return out.slice(0, 3);
}
function libDoneCardHtml_(b){
  if(S.libDone!==b.id) return '';
  var read=libRead_(), M=libMineS_(), note=(M.notes[b.id]||{}).text||'', st=libWeekStreak_(read), yr=libYearN_(read);
  var h='<div class="card libDone" id="libDone"><button class="gptX libDoneX" id="libDoneClose" aria-label="'+esc(t('Close'))+'">×</button>'+
    '<div class="libDoneHead">🎉 '+esc(t('Well done — one more book finished!'))+'</div>'+
    '<div class="pmeta">'+esc(M.goal ? gpT('{n} of {goal} this year',{n:yr, goal:M.goal}) : gpT('{n} this year',{n:yr}))+(st>=2 ? ' · 🔥 '+esc(gpT('{n} weeks in a row',{n:st})) : '')+'</div>'+
    (S.libNewBadges.length ? '<div class="libBadges" id="libNewBadges">'+S.libNewBadges.map(function(x){ return '<span class="libBadge new">'+x.emoji+'</span><span class="libBadgeNext">'+esc(gpT('New badge: {name}',{name:x.name}))+'</span>'; }).join('')+'</div>' : '');
  if(libOn_()){
    var wk=(typeof thisWeek==='function') ? thisWeek() : isoWeekOf(new Date()), rec=goalsForWeek(wk), nGoals=(rec && rec.items ? rec.items.filter(function(i){ return i.text; }).length : 0);
    h+='<label class="f" for="libTakeText" style="margin-top:12px">📝 '+esc(t('What is one thing you will do this week because of this book?'))+'</label>'+
      '<textarea id="libTakeText" rows="2" maxlength="400" placeholder="'+esc(t('Only you see this.'))+'">'+esc(note)+'</textarea>'+
      (nGoals<3 ? '<label class="libShareRow"><input type="checkbox" id="libTakeGoal"> '+esc(t('Also add it to my weekly goals'))+'</label>' : '')+
      '<button class="btn" id="libTakeSave"'+(S.libBusy?' disabled':'')+'>'+esc(t('Save'))+'</button>';
    if(!M.shareAsked) h+='<div class="libAsk" id="libShareAsk"><div>'+esc(t('Show the books you finish to your campus? It encourages others to read.'))+'</div>'+
      '<div class="btnRow"><button class="btn ghost" id="libShareYes">'+esc(t('Yes, share'))+'</button><button class="btn ghost" id="libShareNo">'+esc(t('No thanks'))+'</button></div></div>';
  }
  if(b.quiz && !(S.libQuiz && S.libQuiz.id===b.id)) h+='<button class="btn ghost libQuizGo" id="libQuizGo" style="margin-top:12px">🧠 '+esc(t('Check what you remember'))+' · '+esc(gpT('{n} questions',{n:b.quiz.length}))+'</button>';
  var sug=libSuggest_(b, read), prog=libProg_();
  if(sug.length) h+='<div class="libKicker" style="margin-top:14px">📖 '+esc(t('Read next'))+'</div><div class="libScroll libNextRow" id="libNextRow">'+sug.map(function(x){ return libTileHtml_(x, read, prog); }).join('')+'</div>';
  return h+'</div>';
}
function libBookExtrasHtml_(b){
  if(!libOn_()) return '';
  var M=libMineS_(), note=M.notes[b.id], isMonth=S.lib.month && S.lib.month.bookId===b.id, h='';
  if(note && S.libDone!==b.id) h+='<div class="card libNote" id="libNote"><div class="libKicker">📝 '+esc(t('My one thing'))+'</div><p style="margin:4px 0 0">'+esc(note.text)+'</p><button class="linkbtn" id="libNoteEdit" style="padding-left:0">'+esc(t('Change'))+'</button></div>';
  h+='<div class="libActs">';
  h+='<button class="btn ghost" id="libRecOpen">💌 '+esc(t('Recommend to someone'))+'</button>';
  if(S.lib.canPick) h+= isMonth ? '<button class="btn ghost" id="libMonthClear">⭐ '+esc(t('This is the book of the month — take it down'))+'</button>'
                                : '<button class="btn ghost" id="libMonthSet">⭐ '+esc(t('Make this the book of the month'))+'</button>';
  h+='</div>';
  if(S.libRecOpen){
    var people=(S.roster||[]).filter(function(p){ return p.id!==S.me.id; }).sort(function(x,y){ return String(x.name).localeCompare(String(y.name)); })
      .map(function(p){ return { id:p.id, name:p.name, sub:t(p.ministry||p.dept||''), first:p.campus===S.me.campus, group:'' }; });
    h+='<div class="card libRecForm" id="libRecForm"><label class="f">'+esc(t('Who would like this book?'))+'</label>'+
      ppickHtml_({ key:'librec', people:people, chosen:S.libRecTo?[S.libRecTo]:[], placeholder:t('Type their name…'), onPick:function(id){ S.libRecTo=id; render(); }, onRemove:function(){ S.libRecTo=''; render(); } })+
      '<input type="text" id="libRecNote" maxlength="200" placeholder="'+esc(t('A word about why (optional)'))+'" style="margin-top:8px">'+
      '<div class="btnRow"><button class="btn" id="libRecSend"'+(!S.libRecTo||S.libBusy?' disabled':'')+'>'+esc(t('Send'))+'</button><button class="btn ghost" id="libRecCancel">'+esc(t('Cancel'))+'</button></div></div>';
  }
  return h;
}

/* ---------- My Home: this month's book, where you were, what was recommended ---------- */
function libLast_(){ try { return JSON.parse(lsGet('gp-lib-last')||'null'); } catch(e){ return null; } }
/* One small row in My Home's summary card (Nov 2026, Andrew: "move that into the little dashboard … make it small … a
   little book icon … read a book"), like the GP Tasks row: 📚 and ONE line — this month's book while it's unread, else the
   book you were in, else "Read a book" with what one is worth; "💌 n" when a book was recommended to you. A tap opens that
   book, or the Library. It used to be a card of its own under the summary card (#sec-reading). */
function libHeroRowHtml_(){
  if(S.student || S.guest || S.board || S.stuPreview) return '';
  /* this month's book is not a fixture here any more — it comes now and then as a slide-down note (libNudgeItems_) */
  var last=libLast_(), read=libRead_(), go='', main='', sub='';
  var pts=(S.game && S.game.ok && S.game.pts) ? S.game.pts.book : 0;
  if(last && last.id && !read[last.id]){ go=last.id; main=gpT('Continue: {title}',{title:last.title}); sub=gpT('{n} of {m} pages',{n:Math.min(last.step+1, last.total), m:last.total}); }
  else { main=t('Read a book'); sub=pts ? gpT('Ten minutes · {n} points',{n:pts}) : t('Ten minutes'); }
  var recs=libOn_() && S.lib.recs ? S.lib.recs.length : 0;
  return '<button class="heroRow heroRowGo libHeroRow" id="libHome" data-libhome="'+esc(go)+'" aria-label="'+esc(t('Library'))+'"><span class="gptRing">📚</span>'+
    '<div class="heroTrend libHeroText"><b class="heroFig">'+esc(main)+'</b> <span class="whoCap">· '+esc(sub)+'</span>'+
    (recs ? ' <span class="whoCap" id="libHomeRecs">· 💌 '+recs+'</span>' : '')+'</div><span class="heroGo" aria-hidden="true">›</span></button>';
}

/* This month's book and the books a teammate recommends, as notes that slide down from the top (Nov 2026, Andrew:
   "instead of it just being stationary … every now and then, like a notification … hey, read this book this month").
   Bell items like any other, so the slide-down reminder shows them and a tap opens the book: the month's book while it
   is unread, on one day in LIB_NUDGE_EVERY (3) — which day is the person's own, so a campus isn't all nudged at once —
   dated today, so Clear holds for the day; a recommendation once, dated when it came, until the book is read or the
   recommendation cleared. The phone's own weekly reminder (Profile → Reminders, push.reading) is unchanged. */
var LIB_NUDGE_EVERY=3;
function libNudgeDay_(){
  var d=Math.floor(Date.parse(todayStr()+'T00:00:00Z')/864e5), h=0, id=String((S.me && S.me.id) || '');
  for(var i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))%9973;
  return (d+h)%Math.max(1, LIB_NUDGE_EVERY)===0;
}
/* a recommendation's book by the Library's own title (in the reader's language) when the Library has loaded, else the title
   it came with, else its id tidied ("atomic-habits" → "Atomic Habits") */
function libNudgeTitle_(r){
  var b=(typeof GP_LIBRARY!=='undefined' && typeof libById_==='function') ? libById_(r.bookId) : null;
  if(b) return libTitle_(b);
  return r.title || String(r.bookId||'').split('-').map(function(w){ return w ? w.charAt(0).toUpperCase()+w.slice(1) : w; }).join(' ');
}
function libNudgeItems_(){
  var out=[]; if(typeof libOn_!=='function' || !libOn_()) return out;
  var read=libRead_(), m=S.lib.month;
  var btn=function(id){ return '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-libgo="'+esc(id)+'">'+esc(t('Read it'))+'</button>'; };
  var day=libNudgeDay_(), last=libLast_();
  if(m && m.bookId && m.title && !read[m.bookId] && day)
    out.push({ when:todayStr(), text:'📚 '+gpT('This month’s book: {title} — a ten-minute read',{title:m.title}), actions:btn(m.bookId) });
  /* the book they were in — now and then, not a fixture on My Home (Nov 2026, Andrew) */
  else if(last && last.id && last.title && !read[last.id] && day)
    out.push({ when:todayStr(), text:'📖 '+gpT('Pick up where you left off: {title}',{title:last.title}), actions:btn(last.id) });
  (S.lib.recs||[]).forEach(function(r){
    if(!r || !r.bookId || read[r.bookId]) return;
    out.push({ when:String(r.at||todayStr()), text:'💌 '+gpT('{name} recommends a book to you: {title}',{name:(r.from && r.from.name) || '', title:libNudgeTitle_(r)}), actions:btn(r.bookId) });
  });
  return out;
}

/* ---------- a mentor's view of a mentee's reading ---------- */
function libMenteeHtml_(m){
  var L=S.menteeLib; if(!L) return '';
  var read=L.read||{}, n=Object.keys(read).length, h='<h3>📚 '+esc(t('Reading'))+'</h3><div class="card" id="libMentee">';
  if(typeof GP_LIBRARY==='undefined'){ libLoad_(); return h+'<p class="sub" style="margin:0">'+esc(gpT('{n} books read',{n:n}))+'</p></div>'; }
  h+='<div><b>'+libYearN_(read)+'</b> '+esc(L.goal ? gpT('of {n} books this year',{n:L.goal}) : t('books this year'))+' · '+esc(gpT('{n} books read',{n:n}))+'</div>';
  h+=libQuizSumHtml_(L.quiz, 'libMenteeQuiz');
  var plans=GP_LIBRARY.plans||[], given=plans.filter(function(p){ return L.plans && L.plans[p.id]; });
  given.forEach(function(p){ var d=libPlanDone_(p, read), st=L.plans[p.id];
    h+='<div class="libMenteePlan" data-libmplan="'+esc(p.id)+'"><div>'+p.emoji+' <b>'+esc(t(p.name))+'</b> <span class="pmeta">'+esc(gpT('{n} of {m} read',{n:d, m:p.books.length}))+'</span>'+
      (st.by===S.me.id ? ' <button class="gptX" data-libungive="'+esc(p.id)+'" aria-label="'+esc(t('Remove'))+'">×</button>' : '')+'</div>'+
      '<span class="libProgressBar"><span style="width:'+Math.round(d/p.books.length*100)+'%"></span></span></div>'; });
  var rest=plans.filter(function(p){ return !(L.plans && L.plans[p.id]); });
  if(rest.length) h+='<label class="f" for="libGiveSel" style="margin-top:10px">'+esc(gpT('Give {name} a reading plan',{name:firstName_(m.name)}))+'</label><div class="libGiveRow"><select id="libGiveSel">'+
    rest.map(function(p){ return '<option value="'+esc(p.id)+'">'+p.emoji+' '+esc(t(p.name))+' ('+p.books.length+')</option>'; }).join('')+'</select><button class="btn ghost" id="libGive">'+esc(t('Give'))+'</button></div>';
  return h+'</div>';
}

/* ---------- finishing a book ---------- */
function libFinish_(id){
  var before=libBadges_(libRead_()).filter(function(x){ return x.have; }).map(function(x){ return x.id; });
  libSetRead_(id, true); libSetProg_(id, 0);
  S.libNewBadges=libBadges_(libRead_()).filter(function(x){ return x.have && before.indexOf(x.id)===-1; });
  S.libDone=id; S.libStep=null; S.libQuiz=null; lsDel('gp-lib-last');
  render(); window.scrollTo(0,0);
  var el=document.getElementById('libDone'); if(el && typeof gpConfetti==='function') gpConfetti(el);
}

/* ---------- binding ---------- */
function bindLibPlus_(){
  document.querySelectorAll('[data-libhome]').forEach(function(b){ b.onclick=function(){ gpTap(); var id=b.getAttribute('data-libhome'); libOpen_(); if(id){ S.libBook=id; render(); } }; });
  var on=function(id, f){ var e=document.getElementById(id); if(e) e.onclick=f; };
  on('libGive', function(){ var sel=document.getElementById('libGiveSel'); if(!sel || !S.mentee) return;
    run('libGivePlan',[S.auth.user,S.auth.pin,S.mentee.id,sel.value,true],function(d){ if(d && d.ok){ S.menteeLib=Object.assign({}, S.menteeLib, { plans:d.plans }); showMsg(t('Plan given')); } else showMsg(t('Could not save')); render(); }); });
  document.querySelectorAll('[data-libungive]').forEach(function(b){ b.onclick=function(){ if(!S.mentee) return;
    run('libGivePlan',[S.auth.user,S.auth.pin,S.mentee.id,b.getAttribute('data-libungive'),false],function(d){ if(d && d.ok) S.menteeLib=Object.assign({}, S.menteeLib, { plans:d.plans }); render(); }); }; });
  if(typeof GP_LIBRARY!=='undefined') lnSync_(); else { var lnr=document.getElementById('lnRoot'); if(lnr) lnr.innerHTML=''; }
  if(S.view!=='library' || typeof GP_LIBRARY==='undefined') return;
  var find=document.getElementById('libFind');
  if(find) find.oninput=function(){ S.libQ=find.value; render(); var f=document.getElementById('libFind'); if(f){ f.focus(); try{ f.setSelectionRange(f.value.length, f.value.length); }catch(e){} } };
  document.querySelectorAll('[data-libleave]').forEach(function(b){ var was=b.onclick; b.onclick=function(){ S.libBook=null; S.libStep=null; S.libDone=null; if(was) was.call(b); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-libplan]').forEach(function(b){ b.onclick=function(){ gpTap(); S.libPlan=b.getAttribute('data-libplan'); render(); window.scrollTo(0,0); }; });
  on('libPlanBack', function(){ S.libPlan=null; render(); window.scrollTo(0,0); });
  on('libPlanCouple', function(){ S.libPlan=null; if(typeof testsOpen_==='function'){ S.tests.mc=null; testsOpen_('home'); } });
  var planSet=function(onOff){ var id=S.libPlan, loc=libPlansLocal_();
    if(onOff) loc[id]={ at:new Date().toISOString(), by:'' }; else delete loc[id];
    lsSet('gp-lib-plans', JSON.stringify(loc));
    if(libOn_()) libCall_('libSaveMine', [{ plan:{ id:id, on:onOff } }]); else render(); };
  on('libPlanStart', function(){ gpTap(); planSet(true); });
  on('libPlanStop', function(){ planSet(false); });
  on('libGoalOpen', function(){ S.libGoalOpen=true; render(); });
  document.querySelectorAll('[data-libgoal]').forEach(function(b){ b.onclick=function(){ S.libGoalOpen=false; libCall_('libSaveMine', [{ goal:Number(b.getAttribute('data-libgoal')) }]); }; });
  var sh=document.getElementById('libShare'); if(sh) sh.onchange=function(){ libCall_('libSaveMine', [{ share:sh.checked }]); };
  on('libShareYes', function(){ libCall_('libSaveMine', [{ share:true }]); });
  on('libShareNo', function(){ libCall_('libSaveMine', [{ share:false }]); });
  document.querySelectorAll('[data-librecdone]').forEach(function(b){ b.onclick=function(){ libCall_('libRecDone', [b.getAttribute('data-librecdone')]); }; });
  on('libDoneClose', function(){ S.libDone=null; render(); });
  bindLibQuiz_();
  on('libNoteEdit', function(){ S.libDone=S.libBook; S.libNewBadges=[]; render(); var x=document.getElementById('libTakeText'); if(x) x.focus(); });
  on('libTakeSave', function(){
    var txt=(document.getElementById('libTakeText')||{}).value||'', g=document.getElementById('libTakeGoal'), id=S.libBook, text=txt.trim();
    if(g && g.checked && text){
      var wk=(typeof thisWeek==='function') ? thisWeek() : isoWeekOf(new Date()), rec=goalsForWeek(wk), written=(rec && rec.items) ? rec.items.filter(function(i){ return i.text; }).slice() : [];
      if(written.length<3){ written.push({ text:text.slice(0,120), pct:0, metricKey:'' }); gpSaveGoals_(wk, written, function(){}); }
    }
    libCall_('libSaveMine', [{ note:{ bookId:id, text:text } }], function(){ S.libDone=null; showMsg(text ? t('Saved — go and do it!') : t('Saved')); });
  });
  on('libRecOpen', function(){ S.libRecOpen=!S.libRecOpen; S.libRecTo=''; render(); });
  on('libRecCancel', function(){ S.libRecOpen=false; render(); });
  on('libRecSend', function(){ var b=libById_(S.libBook); if(!b || !S.libRecTo) return;
    libCall_('libRecommend', [S.libRecTo, b.id, b.title, (document.getElementById('libRecNote')||{}).value||''], function(){ S.libRecOpen=false; S.libRecTo=''; showMsg(t('Sent')); }); });
  on('libMonthSet', function(){ var b=libById_(S.libBook); if(!b) return;
    var note=gpAskText_(t('A line for everyone about why this book (optional):'), ''); if(note===null) return;
    libCall_('libSetMonth', [b.id, b.title, note], function(){ showMsg(t('It’s the book of the month')); }); });
  on('libMonthClear', function(){ libCall_('libSetMonth', ['', '', '']); });
  if(typeof bindPeoplePick_==='function') bindPeoplePick_();
}

/* ==================== Highlights, notes and talking about them (Nov 2026, Andrew) ====================
   "Like the Bible app … highlight things you like in the reading … write a note on it … private, or public for everyone
   in our base … people can comment on it, like it … ask for prayer from it — private, public, or just to your mentor."
   - In the reader every paragraph can be tapped (lnDecorate_ numbers them: data-lnp, in the order the page draws them):
     a bar comes up from the bottom (#lnBar) with four colours to highlight it, 📝 Note, and 💬 n when others have
     written on it. My highlights are drawn in their colour; my note shows 📝, others' 💬 n.
   - 📝 opens a sheet (#lnSheet, mode 'edit'): the words, who sees it — 🔒 only me, 🤝 my mentor, 👥 everyone at the campus
     — and 🙏 "ask for prayer" (a real prayer request on ☰ → Prayer, for the same people).
   - A shared note opens as a conversation (mode 'thread'): ❤️, comments, 🙏 I prayed.
   - The book's page lists its notes (#lnBook: mine, then the campus's); the Library's home has "What encouraged us"
     (#lnFeed, the boot's lib.notesFeed). A phone notification opens the book with the note (?view=library&book=&note=).
   The server holds the rows and decides who sees what (api.js libNotes …); one libNotes call when a book is opened.
   The sheet and bar are drawn into #lnRoot (outside #main) without a render, so typing is never lost and the reader's
   page doesn't turn. Staff only (libOn_). */
var LN_COLORS=['yellow','green','blue','pink'];
S.ln={ cache:{}, loading:{}, err:{}, sel:null, sheet:null, noteId:'', draft:null, cmt:'', open:'', busy:false };
function lnOn_(){ return libOn_() && !S.board; }
function lnLang_(b){ return libText_(b).km ? 'km' : 'en'; }
function lnRows_(bookId){ return S.ln.cache[bookId] || null; }
function lnLoad_(bookId, force){
  if(!lnOn_() || !bookId) return;
  if(!force && (S.ln.cache[bookId] || S.ln.loading[bookId] || S.ln.err[bookId])) return;
  S.ln.loading[bookId]=true;
  run('libNotes',[S.auth.user,S.auth.pin,bookId],function(d){
    S.ln.loading[bookId]=false;
    if(d && d.ok){ S.ln.cache[bookId]=d.notes||[]; lnAfterLoad_(bookId); }
    else S.ln.err[bookId]=true;
  },function(){ S.ln.loading[bookId]=false; S.ln.err[bookId]=true; });
}
function lnAfterLoad_(bookId){
  if(S.view!=='library' || S.libBook!==bookId) return;
  if(S.ln.open){ var id=S.ln.open; S.ln.open=''; var n=(lnRows_(bookId)||[]).filter(function(x){ return x.id===id; })[0]; if(n){ S.ln.noteId=id; S.ln.sheet='thread'; } }
  if(S.libStep!=null){ lnDecorate_(); lnDraw_(); } else { render(); }
}
/* every answer that changes rows comes back with the book's rows */
function lnTake_(d, bookId, after){
  S.ln.busy=false;
  if(!d || !d.ok){
    showMsg({ need_note:t('Write a few words to share it.'), no_mentor:t('You don’t have a mentor yet.'), too_many:t('That’s a lot for one day — try again tomorrow.'), empty:t('Write something first.') }[d && d.err] || t('Could not save — check your connection and try again.'));
    lnDraw_(); return;
  }
  S.ln.cache[bookId]=d.notes||[];
  if(after) after(d);
  if(S.libStep!=null) lnDecorate_(); else render();
  lnDraw_();
}
function lnCall_(fn, args, bookId, after){ if(S.ln.busy) return; S.ln.busy=true; lnDraw_(); run(fn,[S.auth.user,S.auth.pin].concat(args),function(d){ lnTake_(d, bookId, after); },function(){ lnTake_(null, bookId); }); }

/* ---------- the reader: numbered paragraphs, my colours, the marks ---------- */
function lnParas_(){
  var body=document.querySelector('#libReader .libReaderBody'); if(!body) return [];
  return Array.prototype.filter.call(body.querySelectorAll('p, li'), function(el){ return !el.closest('.fightOv'); });
}
function lnAt_(rows, step, p, lang){ return (rows||[]).filter(function(n){ return n.step===step && n.p===p && n.lang===lang; }); }
/* Sentences (Nov 2026, Andrew: "highlight specific sentences … not the whole page … and then put a note on that"): each
   paragraph's text is cut into sentences once (`lnSplit_`: after . ! ? ។ ៕ and any closing quote, before a space or the
   end), each piece a `span.lnS[data-lns=k]` — a sentence that crosses bold or italics is several spans with one k. A
   row's place is its paragraph and the sentences s…e in it; a row with no s (made before this) is the whole paragraph. */
var LN_END=/[.!?\u17D4\u17D5]+["'”’)\]]*(?=\s|$)/g;
function lnSplit_(el){
  if(el.getAttribute('data-lnsplit')) return;
  el.setAttribute('data-lnsplit','1');
  var k=0, w=document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes=[], nd;
  while((nd=w.nextNode())){ if(!nd.parentNode.closest('.lnMark')) nodes.push(nd); }
  nodes.forEach(function(tn){
    var txt=tn.nodeValue, parts=[], last=0, m; LN_END.lastIndex=0;
    while((m=LN_END.exec(txt))){ var end=m.index+m[0].length; while(end<txt.length && /\s/.test(txt.charAt(end))) end++; parts.push([txt.slice(last, end), true]); last=end; if(m[0].length===0) LN_END.lastIndex++; }
    if(last<txt.length) parts.push([txt.slice(last), false]);
    var frag=document.createDocumentFragment();
    parts.forEach(function(pc){
      if(!/\S/.test(pc[0])){ frag.appendChild(document.createTextNode(pc[0])); return; }
      var sp=document.createElement('span'); sp.className='lnS'; sp.setAttribute('data-lns', k); sp.textContent=pc[0]; frag.appendChild(sp);
      if(pc[1]) k++;
    });
    tn.parentNode.replaceChild(frag, tn);
  });
}
function lnSpans_(el, s, e){ return Array.prototype.filter.call(el.querySelectorAll('.lnS'), function(x){ var k=Number(x.getAttribute('data-lns')); return k>=s && k<=e; }); }
function lnRange_(n){ return (n && typeof n.s==='number' && n.s>=0) ? [n.s, typeof n.e==='number' && n.e>=n.s ? n.e : n.s] : null; }
function lnSame_(n, sel){ var r=lnRange_(n); return sel.s>=0 ? !!(r && r[0]===sel.s && r[1]===sel.e) : !r; }
function lnSelText_(el, s, e){ return String((s>=0 ? lnSpans_(el, s, e).map(function(x){ return x.textContent; }).join('') : el.textContent)||'').replace(/📝|💬 \d+/g,'').replace(/\s+/g,' ').trim().slice(0, 400); }
function lnDecorate_(){
  var b=libById_(S.libBook); if(!b || S.libStep==null || !lnOn_()) return;
  var rows=lnRows_(b.id), lang=lnLang_(b);
  lnParas_().forEach(function(el, i){
    el.setAttribute('data-lnp', i);
    el.classList.add('lnPara');
    Array.prototype.forEach.call(el.querySelectorAll('.lnMark'), function(m){ m.parentNode.removeChild(m); });
    lnSplit_(el);
    var sel=S.ln.sel && S.ln.sel.step===S.libStep && S.ln.sel.p===i ? S.ln.sel : null;
    LN_COLORS.forEach(function(c){ el.classList.remove('lnHl-'+c); }); el.classList.remove('lnHl'); el.classList.toggle('lnSel', !!(sel && !(sel.s>=0)));
    Array.prototype.forEach.call(el.querySelectorAll('.lnS'), function(x){ x.className='lnS'; });
    var here=lnAt_(rows, S.libStep, i, lang), mine=here.filter(function(n){ return n.mine; }), others=here.filter(function(n){ return !n.mine && n.note; });
    /* my colours: a whole-paragraph row on the paragraph, sentence rows on their sentences (the later one wins) */
    mine.forEach(function(n){ if(!n.color) return; var r=lnRange_(n);
      if(!r) el.classList.add('lnHl', 'lnHl-'+n.color);
      else lnSpans_(el, r[0], r[1]).forEach(function(x){ LN_COLORS.forEach(function(c){ x.classList.remove('lnHl-'+c); }); x.classList.add('lnHlS', 'lnHl-'+n.color); }); });
    if(sel && sel.s>=0) lnSpans_(el, sel.s, sel.e).forEach(function(x){ x.classList.add('lnSelS'); });
    var marks='';
    if(mine.some(function(n){ return n.note; })) marks+='<span class="lnMark" aria-hidden="true">📝</span>';
    if(others.length) marks+='<span class="lnMark lnMarkN" aria-label="'+esc(gpT('{n} notes from others',{n:others.length}))+'">💬 '+others.length+'</span>';
    if(marks) el.insertAdjacentHTML('beforeend', marks);
    el.onclick=function(e){ if(e.target.closest('a,button')) return; var sp=e.target.closest('.lnS'); gpTap(); lnSelect_(i, el, sp ? Number(sp.getAttribute('data-lns')) : -1); };
  });
}
/* A tap picks one sentence; more taps in the same paragraph stretch it to take in the sentences between (a tap on an
   end of the pick lets that sentence go); a tap on a sentence I already marked picks what I marked; a tap off the
   sentences picks the paragraph. */
function lnSelect_(i, el, k){
  var cur=S.ln.sel && S.ln.sel.step===S.libStep && S.ln.sel.p===i ? S.ln.sel : null;
  var b=libById_(S.libBook), lang=b ? lnLang_(b) : 'en';
  if(k<0){ S.ln.sel = cur && !(cur.s>=0) ? null : { step:S.libStep, p:i, s:-1, e:-1 }; }
  else if(cur && cur.s>=0){
    if(cur.s===k && cur.e===k) S.ln.sel=null;
    else if(k===cur.s) cur.s++;
    else if(k===cur.e) cur.e--;
    else if(k<cur.s) cur.s=k;
    else if(k>cur.e) cur.e=k;
    else { cur.s=k; cur.e=k; }
  } else {
    var mark=lnAt_(b ? lnRows_(b.id) : [], S.libStep, i, lang).filter(function(n){ var r=lnRange_(n); return n.mine && r && k>=r[0] && k<=r[1]; }).pop();
    var r=lnRange_(mark);
    S.ln.sel={ step:S.libStep, p:i, s:r ? r[0] : k, e:r ? r[1] : k };
  }
  if(S.ln.sel) S.ln.sel.quote=lnSelText_(el, S.ln.sel.s, S.ln.sel.e);
  S.ln.sheet=null; lnDecorate_(); lnDraw_();
}
function lnMineAt_(){ var b=libById_(S.libBook), s=S.ln.sel; if(!b || !s) return null; return lnAt_(lnRows_(b.id), s.step, s.p, lnLang_(b)).filter(function(n){ return n.mine && lnSame_(n, s); })[0] || null; }
/* save my row for what is picked: what is there now with these changes */
function lnSaveSel_(change, after){
  var b=libById_(S.libBook), s=S.ln.sel; if(!b || !s) return;
  var mine=lnMineAt_() || {};
  var rec=Object.assign({ id:mine.id||'', bookId:b.id, title:libTitle_(b), lang:lnLang_(b), step:s.step, p:s.p, s:s.s>=0 ? s.s : -1, e:s.s>=0 ? s.e : -1, quote:s.quote||mine.quote,
    color:mine.color||'', note:mine.note||'', vis:mine.vis||'private', prayer:!!mine.prayer }, change);
  lnCall_('libNoteSave', [rec], b.id, after);
}

/* ---------- drawing the bar and the sheet into #lnRoot ---------- */
function lnRoot_(){ var r=document.getElementById('lnRoot'); if(!r){ r=document.createElement('div'); r.id='lnRoot'; document.body.appendChild(r); } return r; }
function lnClose_(){ S.ln.sel=null; S.ln.sheet=null; S.ln.noteId=''; S.ln.draft=null; S.ln.cmt=''; var r=document.getElementById('lnRoot'); if(r) r.innerHTML=''; if(document.getElementById('libReader')) lnDecorate_(); }
function lnVisTag_(v){ return v==='campus' ? '👥 '+t('Everyone at my campus') : v==='mentor' ? '🤝 '+t('My mentor') : '🔒 '+t('Only me'); }
function lnWhen_(iso){ var d=String(iso||'').slice(0,10); return d ? teamDate_(d) : ''; }
function lnCardHtml_(n, full){
  var b=libById_(n.bookId), h='<div class="lnCard'+(full?' full':'')+'" data-lnnote="'+esc(n.id)+'">';
  h+='<div class="lnWho">'+avatarHtml({ name:n.name, photo:n.photo },'sm')+'<span><b>'+esc(n.mine ? t('You') : n.name)+'</b><span class="pmeta"> · '+esc(lnWhen_(n.at))+(n.vis!=='campus' ? ' · '+esc(lnVisTag_(n.vis)) : '')+'</span></span></div>';
  if(n.quote) h+='<blockquote class="lnQuote'+(n.color?' lnHl-'+n.color:'')+'">'+esc(n.quote)+'</blockquote>';
  if(n.note) h+='<p class="lnText">'+esc(n.note)+'</p>';
  if(n.prayer) h+='<div class="lnPrayTag">🙏 '+esc(n.prayer.answered ? t('Prayer answered') : t('Asking for prayer'))+(n.prayer.answerNote ? ' — '+esc(n.prayer.answerNote) : '')+'</div>';
  if(n.vis!=='private'){
    /* my own: how many liked and are praying (as on the Prayer page); someone else's: the buttons */
    h+='<div class="lnActs">'+(n.mine ? '<span class="lnAct static">❤️ '+n.likes+'</span>'
        : '<button class="lnAct'+(n.iLiked?' on':'')+'" data-lnlike="'+esc(n.id)+'" aria-pressed="'+(n.iLiked?'true':'false')+'">'+(n.iLiked?'❤️':'🤍')+' '+n.likes+'</button>')+
      '<button class="lnAct" data-lnthread="'+esc(n.id)+'">💬 '+n.comments.length+'</button>'+
      (n.prayer ? (n.mine ? '<span class="lnAct static">🙏 '+esc(gpT('{n} praying',{n:n.prayer.prayedN}))+'</span>'
        : '<button class="lnAct'+(n.prayer.iPrayed?' on':'')+'" data-lnpray="'+esc(n.id)+'">🙏 '+esc(n.prayer.iPrayed ? t('I prayed') : t('Pray'))+' · '+n.prayer.prayedN+'</button>') : '')+'</div>';
  }
  if(full && b && S.libStep==null) h+='<button class="linkbtn lnGo" data-lngo="'+esc(n.id)+'">📖 '+esc(t('Read it in the book'))+'</button>';
  if(n.mine) h+='<div class="lnMine"><button class="linkbtn" data-lnedit="'+esc(n.id)+'">'+esc(t('Edit'))+'</button><button class="linkbtn" data-lndel="'+esc(n.id)+'">'+esc(t('Delete'))+'</button></div>';
  else if(S.me && S.me.isAdmin && n.vis==='campus') h+='<div class="lnMine"><button class="linkbtn" data-lndel="'+esc(n.id)+'">'+esc(t('Take it down'))+'</button></div>';
  return h+'</div>';
}
function lnNote_(id){ var b=libById_(S.libBook), rows=b ? lnRows_(b.id) : null; return (rows||[]).filter(function(n){ return n.id===id; })[0] || null; }
function lnDraw_(){
  var root=lnRoot_();
  if(S.view!=='library' || !S.libBook || !lnOn_()){ root.innerHTML=''; return; }
  var b=libById_(S.libBook); if(!b){ root.innerHTML=''; return; }
  var h='';
  /* the bar under a selected paragraph (reader only) */
  if(S.ln.sel && S.libStep!=null && S.ln.sel.step===S.libStep && !S.ln.sheet){
    var mine=lnMineAt_(), others=lnAt_(lnRows_(b.id), S.ln.sel.step, S.ln.sel.p, lnLang_(b)).filter(function(n){ return !n.mine && n.note; });
    h+='<div class="lnBar" id="lnBar" role="toolbar" aria-label="'+esc(t('Highlight'))+'">'+
      LN_COLORS.map(function(c){ var on=mine && mine.color===c; return '<button class="lnDot lnHl-'+c+(on?' on':'')+'" data-lncolor="'+c+'" aria-pressed="'+(on?'true':'false')+'" aria-label="'+esc([t('Yellow'),t('Green'),t('Blue'),t('Pink')][LN_COLORS.indexOf(c)])+'">'+(on?'✓':'')+'</button>'; }).join('')+
      '<button class="lnBarBtn" id="lnNoteBtn">📝 '+esc(mine && mine.note ? t('My note') : t('Note'))+'</button>'+
      (others.length ? '<button class="lnBarBtn" id="lnParaBtn">💬 '+others.length+'</button>' : '')+
      '<button class="lnBarX" id="lnBarX" aria-label="'+esc(t('Close'))+'">×</button></div>';
  }
  if(S.ln.sheet){
    h+='<div class="lnScrim" id="lnScrim"></div><div class="lnSheet" id="lnSheet" role="dialog" aria-modal="true">';
    h+='<div class="lnSheetHead"><b>'+esc(S.ln.sheet==='edit' ? t('Your note') : S.ln.sheet==='para' ? t('Notes on this part') : t('Note'))+'</b><button class="lnBarX" id="lnSheetX" aria-label="'+esc(t('Close'))+'">×</button></div><div class="lnSheetBody">';
    if(S.ln.sheet==='edit'){
      var D=S.ln.draft || {}, hasMentor=!!(S.me.mentorId && S.me.mentorStatus==='approved');
      h+='<blockquote class="lnQuote'+(D.color?' lnHl-'+D.color:'')+'">'+esc(D.quote||'')+'</blockquote>'+
        '<label class="f" for="lnText">'+esc(t('What stood out to you?'))+'</label>'+
        '<textarea id="lnText" rows="4" maxlength="1000" placeholder="'+esc(t('What encouraged or challenged you here…'))+'">'+esc(D.note||'')+'</textarea>'+
        '<div class="f" style="margin-top:10px">'+esc(t('Who sees it'))+'</div><div class="lnVis">'+
        ['private','mentor','campus'].filter(function(v){ return v!=='mentor' || hasMentor || D.vis==='mentor'; }).map(function(v){
          return '<button class="campusBtn'+(D.vis===v?' on':'')+'" data-lnvis="'+v+'">'+esc(v==='campus' ? '👥 '+gpT('Everyone at {campus}',{campus:campusName(S.me.campus)}) : lnVisTag_(v))+'</button>'; }).join('')+'</div>'+
        '<label class="libShareRow lnPrayRow'+(D.vis==='private'?' off':'')+'"><input type="checkbox" id="lnPray"'+(D.prayer && D.vis!=='private'?' checked':'')+(D.vis==='private'?' disabled':'')+'> 🙏 '+esc(t('Ask for prayer'))+'</label>'+
        '<p class="pmeta" style="margin:2px 0 0">'+esc(D.vis==='private' ? t('Only you see it. Share it to ask for prayer.') : D.vis==='mentor' ? t('Your mentor sees it, and can comment and pray.') : t('Everyone at your campus sees it with your name, and can like it, comment and pray.'))+'</p>'+
        '<div class="btnRow" style="margin-top:12px"><button class="btn" id="lnSave"'+(S.ln.busy?' disabled':'')+'>'+esc(S.ln.busy ? t('Saving…') : t('Save'))+'</button>'+
        (D.id && D.note ? '<button class="btn ghost" id="lnClear">'+esc(t('Remove the note'))+'</button>' : '<button class="btn ghost" id="lnCancel">'+esc(t('Cancel'))+'</button>')+'</div>';
    } else if(S.ln.sheet==='para'){
      var here=lnAt_(lnRows_(b.id), S.ln.sel ? S.ln.sel.step : -1, S.ln.sel ? S.ln.sel.p : -1, lnLang_(b)).filter(function(n){ return n.note; });
      h+= here.length ? here.map(function(n){ return lnCardHtml_(n); }).join('') : '<p class="sub">'+esc(t('No notes here yet.'))+'</p>';
    } else {
      var n=lnNote_(S.ln.noteId);
      if(!n) h+='<p class="sub">'+esc(t('This note is not there any more.'))+'</p>';
      else {
        h+=lnCardHtml_(n, true);
        if(n.vis!=='private'){
          h+='<div class="lnCmts" id="lnCmts">'+(n.comments.length ? n.comments.map(function(c){
            return '<div class="lnCmt">'+avatarHtml({ name:c.name, photo:c.photo },'sm')+'<div class="lnCmtBody"><b>'+esc(c.mine ? t('You') : c.name)+'</b> <span class="pmeta">'+esc(lnWhen_(c.at))+'</span><div>'+esc(c.text)+'</div>'+
              ((c.mine || n.mine || (S.me.isAdmin && n.vis==='campus')) ? '<button class="linkbtn lnCmtDel" data-lnuncmt="'+esc(c.id)+'">'+esc(t('Delete'))+'</button>' : '')+'</div></div>'; }).join('')
            : '<p class="pmeta" style="margin:6px 0">'+esc(t('No comments yet. Say something encouraging.'))+'</p>')+'</div>'+
            '<div class="lnCmtNew"><textarea id="lnCmtText" rows="2" maxlength="500" placeholder="'+esc(t('Write a comment…'))+'">'+esc(S.ln.cmt||'')+'</textarea>'+
            '<button class="btn" id="lnCmtSend"'+(S.ln.busy?' disabled':'')+'>'+esc(t('Send'))+'</button></div>';
        }
      }
    }
    h+='</div></div>';
  }
  root.innerHTML=h;
  lnBind_(root, b);
}
function lnBind_(root, b){
  var on=function(id, f){ var e=root.querySelector('#'+id); if(e) e.onclick=f; };
  Array.prototype.forEach.call(root.querySelectorAll('[data-lncolor]'), function(x){ x.onclick=function(){ gpTap(); var c=x.getAttribute('data-lncolor'), mine=lnMineAt_();
    lnSaveSel_({ color: mine && mine.color===c ? '' : c }, function(){ S.ln.sel=null; }); }; });   // the same colour again takes it off; the pick is let go, as in a Bible app
  on('lnBarX', function(){ gpTap(); lnClose_(); });
  on('lnNoteBtn', function(){ gpTap(); var m=lnMineAt_() || {}; S.ln.draft={ id:m.id||'', quote:m.quote||S.ln.sel.quote, color:m.color||'', note:m.note||'', vis:m.vis||'private', prayer:!!m.prayer }; S.ln.sheet='edit'; lnDraw_(); var x=document.getElementById('lnText'); if(x) x.focus(); });
  on('lnParaBtn', function(){ gpTap(); S.ln.sheet='para'; lnDraw_(); });
  var shut=function(){ S.ln.sheet=null; S.ln.noteId=''; S.ln.cmt=''; if(S.ln.draft && !S.ln.sel) S.ln.draft=null; lnDraw_(); };
  on('lnSheetX', shut); on('lnScrim', shut); on('lnCancel', shut);
  var tx=root.querySelector('#lnText'); if(tx) tx.oninput=function(){ S.ln.draft.note=tx.value; };
  Array.prototype.forEach.call(root.querySelectorAll('[data-lnvis]'), function(x){ x.onclick=function(){ gpTap(); S.ln.draft.vis=x.getAttribute('data-lnvis'); if(S.ln.draft.vis==='private') S.ln.draft.prayer=false; lnDraw_(); }; });
  var pr=root.querySelector('#lnPray'); if(pr) pr.onchange=function(){ S.ln.draft.prayer=pr.checked; };
  on('lnSave', function(){
    var D=S.ln.draft; if(!D) return;
    D.note=String((root.querySelector('#lnText')||{}).value||D.note||'').trim();
    if(D.vis!=='private' && !D.note){ showMsg(t('Write a few words to share it.')); return; }
    var change={ id:D.id, note:D.note, vis:D.vis, prayer:D.vis!=='private' && D.prayer, color:D.color };
    var done=function(){ S.ln.sheet=null; S.ln.draft=null; showMsg(D.vis==='private' ? t('Saved — only you see it') : D.vis==='mentor' ? t('Shared with your mentor') : t('Shared with your campus')); };
    if(S.ln.sel) lnSaveSel_(change, done);
    else { var n=lnNote_(D.id); if(!n) return; var rg=lnRange_(n); lnCall_('libNoteSave', [Object.assign({ bookId:n.bookId, title:n.title, lang:n.lang, step:n.step, p:n.p, s:rg ? rg[0] : -1, e:rg ? rg[1] : -1, quote:n.quote }, change)], n.bookId, done); }
  });
  on('lnClear', function(){ var D=S.ln.draft; if(!D || !gpAsk_(t('Remove your note? Its comments go too.'))) return;
    var n=lnNote_(D.id); if(!n) return;
    var rg=lnRange_(n); lnCall_('libNoteSave', [{ id:n.id, bookId:n.bookId, title:n.title, lang:n.lang, step:n.step, p:n.p, s:rg ? rg[0] : -1, e:rg ? rg[1] : -1, quote:n.quote, color:n.color, note:'', vis:'private', prayer:false }], n.bookId, function(){ S.ln.sheet=null; S.ln.draft=null; }); });
  lnBindCards_(root);
  var ct=root.querySelector('#lnCmtText'); if(ct) ct.oninput=function(){ S.ln.cmt=ct.value; };
  on('lnCmtSend', function(){ var txt=String((root.querySelector('#lnCmtText')||{}).value||'').trim(); if(!txt) return; var n=lnNote_(S.ln.noteId); if(!n) return;
    lnCall_('libNoteComment', [n.id, txt], n.bookId, function(){ S.ln.cmt=''; }); });
  Array.prototype.forEach.call(root.querySelectorAll('[data-lnuncmt]'), function(x){ x.onclick=function(){ var n=lnNote_(S.ln.noteId); if(!n || !gpAsk_(t('Delete this comment?'))) return; lnCall_('libNoteUncomment', [n.id, x.getAttribute('data-lnuncmt')], n.bookId); }; });
}
/* the buttons on a note card — in the sheet, on the book's page */
function lnBindCards_(root){
  Array.prototype.forEach.call(root.querySelectorAll('[data-lnlike]'), function(x){ x.onclick=function(e){ e.stopPropagation(); gpTap(); var n=lnNote_(x.getAttribute('data-lnlike')); if(n) lnCall_('libNoteLike', [n.id, !n.iLiked], n.bookId); }; });
  Array.prototype.forEach.call(root.querySelectorAll('[data-lnpray]'), function(x){ x.onclick=function(e){ e.stopPropagation(); gpTap(); var n=lnNote_(x.getAttribute('data-lnpray')); if(n) lnCall_('libNotePray', [n.id, !n.prayer.iPrayed], n.bookId, function(){ if(!n.prayer.iPrayed) showMsg(t('Thank you for praying')); }); }; });
  Array.prototype.forEach.call(root.querySelectorAll('[data-lnthread]'), function(x){ x.onclick=function(e){ e.stopPropagation(); gpTap(); S.ln.noteId=x.getAttribute('data-lnthread'); S.ln.sheet='thread'; lnDraw_(); var c=document.getElementById('lnCmtText'); if(c && x.closest('.lnSheet')) c.focus(); }; });
  Array.prototype.forEach.call(root.querySelectorAll('[data-lnedit]'), function(x){ x.onclick=function(e){ e.stopPropagation(); gpTap(); var n=lnNote_(x.getAttribute('data-lnedit')); if(!n) return;
    S.ln.draft={ id:n.id, quote:n.quote, color:n.color, note:n.note, vis:n.vis, prayer:!!n.prayer };
    var rg=lnRange_(n); if(S.libStep!=null && n.step===S.libStep) S.ln.sel={ step:n.step, p:n.p, s:rg ? rg[0] : -1, e:rg ? rg[1] : -1, quote:n.quote }; else S.ln.sel=null;
    S.ln.sheet='edit'; lnDraw_(); }; });
  Array.prototype.forEach.call(root.querySelectorAll('[data-lndel]'), function(x){ x.onclick=function(e){ e.stopPropagation(); var n=lnNote_(x.getAttribute('data-lndel')); if(!n) return;
    if(!gpAsk_(n.mine ? t('Delete this note? Its comments and prayer request go too.') : t('Take this note down for everyone?'))) return;
    lnCall_('libNoteDelete', [n.id], n.bookId, function(){ S.ln.sheet=null; S.ln.noteId=''; }); }; });
  Array.prototype.forEach.call(root.querySelectorAll('[data-lngo]'), function(x){ x.onclick=function(e){ e.stopPropagation(); gpTap(); var n=lnNote_(x.getAttribute('data-lngo')); if(!n) return;
    var rg=lnRange_(n); S.ln.sheet=null; S.ln.noteId=''; libGo_(n.step); S.ln.sel={ step:n.step, p:n.p, s:rg ? rg[0] : -1, e:rg ? rg[1] : -1, quote:n.quote }; lnDecorate_(); lnDraw_();
    var el=document.querySelector('#libReader [data-lnp="'+n.p+'"]'); if(el && el.scrollIntoView) el.scrollIntoView({ block:'center' }); }; });
  Array.prototype.forEach.call(root.querySelectorAll('.lnCard[data-lnnote]'), function(c){ if(c.classList.contains('full')) return; c.onclick=function(e){ if(e.target.closest('button,a')) return; var n=lnNote_(c.getAttribute('data-lnnote')); if(!n || n.vis==='private') return; gpTap(); S.ln.noteId=n.id; S.ln.sheet='thread'; lnDraw_(); }; });
}

/* ---------- the book's page: my highlights and notes, then the campus's ---------- */
function lnBookHtml_(b){
  if(!lnOn_()) return '';
  var rows=lnRows_(b.id);
  if(!rows){ lnLoad_(b.id); return S.ln.err[b.id] ? '' : '<div class="libHead2"><h3>💬 '+esc(t('Notes and highlights'))+'</h3></div><p class="pmeta" id="lnBook">'+esc(t('Loading…'))+'</p>'; }
  var mine=rows.filter(function(n){ return n.mine; }), others=rows.filter(function(n){ return !n.mine && n.note; });
  var h='<div class="libHead2"><h3>💬 '+esc(t('Notes and highlights'))+'</h3></div><div id="lnBook">';
  if(!rows.length) h+='<p class="pmeta lnEmpty">'+esc(t('Tap a sentence while you read (tap more to take in the ones next to it) to highlight it or write a note — keep it to yourself, share it with your mentor, or with your campus.'))+'</p>';
  if(others.length) h+='<div class="libKicker">👥 '+esc(gpT('From {campus}',{campus:campusName(S.me.campus)}))+'</div>'+others.map(function(n){ return lnCardHtml_(n); }).join('');
  if(mine.length) h+='<div class="libKicker" style="margin-top:10px">🖍 '+esc(gpT('Mine · {n}',{n:mine.length}))+'</div>'+mine.map(function(n){ return lnCardHtml_(n, true); }).join('');
  return h+'</div>';
}
/* ---------- the Library's home: what encouraged us ---------- */
function lnFeedHtml_(){
  if(!lnOn_() || !S.lib.notesFeed || !S.lib.notesFeed.length) return '';
  var rows=S.lib.notesFeed.filter(function(n){ return libById_(n.bookId); });
  if(!rows.length) return '';
  return '<div class="libHead2"><h3>💬 '+esc(t('What encouraged us'))+'</h3></div><div class="libScroll lnFeed" id="lnFeed">'+rows.map(function(n){ var b=libById_(n.bookId);
    return '<button class="lnFeedCard" data-lnfeed="'+esc(n.bookId+'|'+n.id)+'"><span class="lnWho">'+avatarHtml({ name:n.name, photo:n.photo },'sm')+'<span><b>'+esc(firstName_(n.name))+'</b><span class="pmeta"> · '+esc(libTitle_(b))+'</span></span></span>'+
      (n.quote ? '<span class="lnFeedQuote">“'+esc(n.quote)+'”</span>' : '')+'<span class="lnFeedNote">'+esc(n.note)+'</span>'+
      '<span class="lnFeedMeta">'+(n.prayer?'🙏 · ':'')+'❤️ '+n.likes+' · 💬 '+n.comments+(n.vis==='mentor' ? ' · 🤝 '+esc(t('to you')) : '')+'</span></button>'; }).join('')+'</div>';
}
/* called on every bind: decorate the reader, keep #lnRoot in step with the page */
function lnSync_(){
  if(S.view!=='library' || !S.libBook){ if(S.ln.sel || S.ln.sheet) { S.ln.sel=null; S.ln.sheet=null; S.ln.noteId=''; S.ln.draft=null; } var r=document.getElementById('lnRoot'); if(r) r.innerHTML=''; }
  else {
    if(S.libStep!=null){ lnLoad_(S.libBook); if(S.ln.sel && S.ln.sel.step!==S.libStep) S.ln.sel=null; lnDecorate_(); }
    else S.ln.sel=null;
    if(S.ln.open && lnRows_(S.libBook)) lnAfterLoad_(S.libBook);
    lnDraw_();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-lnfeed]'), function(x){ x.onclick=function(){ gpTap(); var v=x.getAttribute('data-lnfeed').split('|');
    S.libBook=v[0]; S.libStep=null; S.libDone=null; S.ln.open=v[1]; if(S.ln.cache[v[0]]) delete S.ln.cache[v[0]]; render(); window.scrollTo(0,0); }; });
  var bk=document.getElementById('lnBook'); if(bk) lnBindCards_(bk);
}

/* ---------- a book's little quiz (Nov 2026, Uriah: "when they finish reading, a couple of multiple-choice questions to
   see if they read it, and their score") ----------
   Three questions from the book's own summary (`quiz` in library.js, its Khmer in library-km.js), offered on the finish
   card and on a read book's page. One at a time, the options in a new order each try; then the score and the right
   answers. Skippable, never needed to mark a book read, no points. The best score is kept on the person's record
   (libSaveMine {quiz}) — only the count reaches their mentor. */
function libQuizQs_(b){
  var en=b.quiz||[], k=(libLang_()==='km' && typeof GP_LIBRARY_KM!=='undefined' && GP_LIBRARY_KM[b.id]) ? GP_LIBRARY_KM[b.id].quiz : null;
  return en.map(function(x, i){ var y=(k && k[i] && k[i].a && k[i].a.length===x.a.length) ? k[i] : null; return { q:y ? y.q : x.q, a:y ? y.a : x.a, c:x.c }; });
}
function libQuizStart_(id){
  var b=libById_(id); if(!b || !b.quiz) return;
  S.libQuiz={ id:id, i:0, picks:[], order:b.quiz.map(function(x){ var o=x.a.map(function(_, j){ return j; });
    for(var j=o.length-1;j>0;j--){ var r=Math.floor(Math.random()*(j+1)), tmp=o[j]; o[j]=o[r]; o[r]=tmp; } return o; }) };
  render(); var el=document.getElementById('libQuiz'); if(el && el.scrollIntoView) el.scrollIntoView({ block:'start' });
}
function libQuizBest_(id){ var q=libMineS_().quiz[id]; return q && q.of ? q : null; }
function libQuizBtnHtml_(b){
  if(!b.quiz || (S.libQuiz && S.libQuiz.id===b.id) || S.libDone===b.id || !libRead_()[b.id]) return '';
  var best=libQuizBest_(b.id);
  return '<button class="btn ghost libQuizGo" id="libQuizGo">🧠 '+esc(best ? t('Try the quiz again') : t('Check what you remember'))+
    (best ? ' · '+esc(gpT('best {n} of {m}',{n:best.best, m:best.of})) : '')+'</button>';
}
function libQuizHtml_(b){
  var Q=S.libQuiz; if(!Q || Q.id!==b.id || !b.quiz) return '';
  var qs=libQuizQs_(b), n=qs.length, km=libLang_()==='km';
  var h='<div class="card libQuiz'+(km?' libKm':'')+'" id="libQuiz"><button class="gptX libDoneX" id="libQuizClose" aria-label="'+esc(t('Close'))+'">×</button>'+
    '<div class="libKicker">🧠 '+esc(t('Check what you remember'))+'</div>';
  if(Q.i<n){
    var x=qs[Q.i];
    h+='<div class="pmeta" id="libQuizStep">'+esc(gpT('Question {n} of {m}',{n:Q.i+1, m:n}))+'</div><p class="libQuizQ">'+esc(x.q)+'</p><div class="libQuizOpts">'+
      Q.order[Q.i].map(function(j){ return '<button class="libQuizOpt" data-libqa="'+j+'">'+esc(x.a[j])+'</button>'; }).join('')+'</div>';
    return h+'</div>';
  }
  var right=0; qs.forEach(function(x, i){ if(Q.picks[i]===x.c) right++; });
  h+='<div class="libQuizScore" id="libQuizScore">'+esc(gpT('{n} of {m} right',{n:right, m:n}))+(right===n ? ' 🎉' : '')+'</div>';
  h+='<ol class="libQuizReview">'+qs.map(function(x, i){ var ok=Q.picks[i]===x.c;
    return '<li class="'+(ok?'ok':'no')+'"><div><span aria-hidden="true">'+(ok?'✓':'✗')+'</span> '+esc(x.q)+'</div>'+
      '<div class="pmeta">'+esc(gpT('Answer: {a}',{a:x.a[x.c]}))+(ok ? '' : ' · '+esc(gpT('You chose: {a}',{a:x.a[Q.picks[i]]})))+'</div></li>'; }).join('')+'</ol>';
  return h+'<div class="btnRow"><button class="btn ghost" id="libQuizAgain">'+esc(t('Try again'))+'</button><button class="btn ghost" id="libQuizDone">'+esc(t('Done'))+'</button></div></div>';
}
function libQuizSumHtml_(quiz, id){
  var ks=Object.keys(quiz||{}); if(!ks.length) return '';
  var r=0, all=0; ks.forEach(function(k){ r+=quiz[k].best||0; all+=quiz[k].of||0; });
  return '<div class="pmeta libQuizSum" id="'+id+'">🧠 '+esc(gpT('Quizzes: {n} taken · {r} of {m} right',{n:ks.length, r:r, m:all}))+'</div>';
}
function bindLibQuiz_(){
  var on=function(id, f){ var e=document.getElementById(id); if(e) e.onclick=f; };
  on('libQuizGo', function(){ gpTap(); libQuizStart_(S.libBook); });
  on('libQuizAgain', function(){ libQuizStart_(S.libBook); });
  on('libQuizClose', function(){ S.libQuiz=null; render(); });
  on('libQuizDone', function(){ S.libQuiz=null; render(); });
  document.querySelectorAll('[data-libqa]').forEach(function(btn){ btn.onclick=function(){
    var Q=S.libQuiz, b=Q && libById_(Q.id); if(!b) return;
    gpTap(); Q.picks[Q.i]=Number(btn.getAttribute('data-libqa')); Q.i++;
    if(Q.i<b.quiz.length){ render(); return; }
    var right=0; b.quiz.forEach(function(x, i){ if(Q.picks[i]===x.c) right++; });
    render();
    var el=document.getElementById('libQuiz'); if(right===b.quiz.length && el && typeof gpConfetti==='function') gpConfetti(el);
    if(libOn_()) libCall_('libSaveMine', [{ quiz:{ bookId:b.id, score:right, of:b.quiz.length } }]);
  }; });
}
