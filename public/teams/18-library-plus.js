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
function libMineS_(){ return (S.lib && S.lib.mine) || { share:false, shareAsked:false, goal:0, notes:{}, plans:{} }; }
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
function libHomeCardHtml_(){
  if(S.student) return '';
  var m=libOn_() && S.lib.month, last=libLast_(), read=libRead_(), rows='';
  if(m && m.title) rows+='<button class="libHomeRow" id="libHomeMonth" data-libhome="'+esc(m.bookId)+'"><span>📅</span><span class="libHomeText"><b>'+esc(gpT('This month: {title}',{title:m.title}))+'</b><span class="pmeta">'+
    esc(read[m.bookId] ? gpT('✓ You’ve read it · {n} of {total} have',{n:m.readers, total:m.total}) : gpT('{n} of {total} have read it — ten minutes',{n:m.readers, total:m.total}))+'</span></span><span class="libInsideGo">›</span></button>';
  if(last && last.id && !read[last.id] && !(m && m.bookId===last.id && !rows)) rows+='<button class="libHomeRow" id="libHomeLast" data-libhome="'+esc(last.id)+'"><span>📖</span><span class="libHomeText"><b>'+esc(gpT('Continue: {title}',{title:last.title}))+'</b><span class="pmeta">'+
    esc(gpT('{n} of {m} pages',{n:Math.min(last.step+1, last.total), m:last.total}))+'</span></span><span class="libInsideGo">›</span></button>';
  if(libOn_() && S.lib.recs.length) rows+='<button class="libHomeRow" id="libHomeRecs" data-libhome=""><span>💌</span><span class="libHomeText"><b>'+esc(S.lib.recs.length===1 ? gpT('{name} recommended a book to you',{name:firstName_(S.lib.recs[0].from.name)}) : gpT('{n} books recommended to you',{n:S.lib.recs.length}))+'</b></span><span class="libInsideGo">›</span></button>';
  var pts=(S.game && S.game.ok && S.game.pts && !S.guest) ? S.game.pts.book : 0;
  if(!rows && libOn_()) rows='<button class="libHomeRow" id="libHomeOpen" data-libhome=""><span>📖</span><span class="libHomeText"><b>'+esc(t('Read a book in ten minutes'))+'</b><span class="pmeta">'+
    esc(S.lib.canPick ? t('Open the Library — and pick this month’s book for your campus') : t('Open the Library and pick one'))+'</span></span><span class="libInsideGo">›</span></button>';
  if(!rows) return '';
  return '<h3 id="sec-reading">📚 '+esc(t('Reading'))+'</h3><div class="card libHome" id="libHome">'+rows+
    (pts ? '<p class="pmeta libHomePts" id="libHomePts">⭐ '+esc(gpT('A finished book is worth {n} points on this week’s board',{n:pts}))+'</p>' : '')+'</div>';
}

/* ---------- a mentor's view of a mentee's reading ---------- */
function libMenteeHtml_(m){
  var L=S.menteeLib; if(!L) return '';
  var read=L.read||{}, n=Object.keys(read).length, h='<h3>📚 '+esc(t('Reading'))+'</h3><div class="card" id="libMentee">';
  if(typeof GP_LIBRARY==='undefined'){ libLoad_(); return h+'<p class="sub" style="margin:0">'+esc(gpT('{n} books read',{n:n}))+'</p></div>'; }
  h+='<div><b>'+libYearN_(read)+'</b> '+esc(L.goal ? gpT('of {n} books this year',{n:L.goal}) : t('books this year'))+' · '+esc(gpT('{n} books read',{n:n}))+'</div>';
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
  S.libDone=id; S.libStep=null; lsDel('gp-lib-last');
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
