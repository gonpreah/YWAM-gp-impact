/* My YWAM GP — teams.html, part 10 of 11: 360 reviews.
   Oct 2026 (Uriah): "an anonymous 360 peer review option that we can send to a group of our
   peers or leadership team and then store the results and create an action plan that comes
   from it with quarterly reviews on progress."

   ☰ → 360 reviews (S.view='p360'), and a tile on My Home. Four screens (S.p3Sub):
     home    — reviews waiting for your feedback, your own reviews, ones shared with you
     new     — start one: a title, until when, a note, and who to ask (quick picks for your
               campus's leadership team, YWAM GP's, the Advisory Board, your department)
     answer  — give someone your feedback: nine areas, 1–5 or "don't know", and four
               questions in words; anonymous, said so plainly
     view    — your review: how many answered (never who), your own answers, close it; then
               the results (others' average against yours, strengths, growth areas, the
               comments), the action plan, and each quarter's review of it; who it's shared with
   Anonymity is the server's (api.js, "360 reviews"): this page is never sent who said what.
   A board member with their own login uses it too, to answer (BOARD_VIEWS). */
S.p3=null; S.p3Loading=false; S.p3Err=''; S.p3Sub='home'; S.p3Id=null; S.p3R=null; S.p3Draft=null; S.p3Ans=null; S.p3Busy=false;
S.p3PlanEdit=null; S.p3Rev=null; S.p3ShareOpen=false; S.p3Glance=null;
var P3_Q=[
  ['faith','Walks with God','Lives what they teach; prayer and the Word shape how they lead.'],
  ['vision','Vision','Shows where we are going and why, and brings people along.'],
  ['care','Cares for people','Notices people, cares for them and helps them grow.'],
  ['comms','Communication','Listens well; clear, honest and kind.'],
  ['team','Teamwork','Works well with others and is easy to work with.'],
  ['reliable','Follows through','Does what they say they will.'],
  ['humble','Humble and teachable','Receives feedback, owns mistakes, keeps learning.'],
  ['decide','Decisions','Makes timely, wise decisions and stands by them.'],
  ['culture','Across cultures','Honours Khmer culture and builds bridges between cultures.']
];
var P3_SCALE=[[1,'Rarely'],[2,'Sometimes'],[3,'Often'],[4,'Usually'],[5,'Always']];
var P3_TEXTS=[['keep','What should they keep doing?','What should I keep doing?'],['start','What could they start doing?','What could I start doing?'],
  ['stop','What could they stop doing?','What could I stop doing?'],['other','Anything else?','Anything else?']];
var P3_STATUS=[['notstarted','Not started'],['ontrack','On track'],['stuck','Stuck'],['done','Done']];
function p3Auth_(){ return S.board && S.boardAuth ? [S.boardAuth.user, S.boardAuth.pin] : [S.auth.user, S.auth.pin]; }
function p3Area_(k){ var q=P3_Q.filter(function(x){ return x[0]===k; })[0]; return q ? t(q[1]) : t('Something else'); }
function p3QName_(q){ return q ? q.replace('-Q', ' Q') : ''; }
function p3Quarters_(n){ var d=new Date(), y=d.getFullYear(), q=Math.floor(d.getMonth()/3)+1, out=[]; for(var i=0;i<n;i++){ out.push(y+'-Q'+q); q++; if(q>4){ q=1; y++; } } return out; }
function p3Date_(iso){ return iso ? teamDate_(String(iso).slice(0,10)) : ''; }
function p3Load_(){
  if(S.p3Loading) return; S.p3Loading=true;
  run('p360List', p3Auth_(), function(d){ S.p3Loading=false; if(d && d.ok){ S.p3=d; S.p3Err=''; } else S.p3Err=t('Could not load'); if(S.view==='p360') render(); },
    function(){ S.p3Loading=false; S.p3Err=t('Could not load'); if(S.view==='p360') render(); });
}
function p3Open_(id){
  S.p3Sub='view'; S.p3Id=id; S.p3R=null; S.p3PlanEdit=null; S.p3Rev=null; S.p3ShareOpen=false; render(); window.scrollTo(0,0);
  run('p360Get', p3Auth_().concat([id]), function(d){ if(d && d.ok){ S.p3R=d.review; S.p3Q=d.quarter; } else S.p3Err=t('Could not load'); if(S.view==='p360') render(); });
}
function p3Put_(d, msg){ S.p3Busy=false; if(d && d.ok){ if(d.review){ S.p3R=d.review; S.p3Q=d.quarter || S.p3Q; } S.p3=null; if(msg) showMsg(msg); return true; } showMsg(t('Could not save')); return false; }
function p3Home_(){ S.p3Sub='home'; S.p3Id=null; S.p3R=null; S.p3=null; render(); window.scrollTo(0,0); }

function p360Html_(){
  var h='<button class="linkbtn" id="p3Back" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(S.p3Sub==='home' ? (S.board ? t('YWAM GP') : t('My Home')) : t('360 reviews'))+'</button>';
  if(S.p3Sub==='view') return h+p3ViewHtml_();
  if(!S.p3){ p3Load_(); return h+'<h2>🪞 '+esc(t('360 reviews'))+'</h2><div class="card"><p class="sub" style="margin:0">'+esc(S.p3Err || t('Loading…'))+'</p></div>'; }
  if(S.p3Sub==='new') return h+p3NewHtml_();
  if(S.p3Sub==='answer'){ var a=S.p3.asked.filter(function(x){ return x.id===S.p3Id; })[0]; if(a) return h+p3AnswerHtml_(a, false); S.p3Sub='home'; }
  return h+p3HomeHtml_();
}
function p3HomeHtml_(){
  var D=S.p3, h='<h2>🪞 '+esc(t('360 reviews'))+'</h2><p class="sub">'+esc(t('Honest, anonymous feedback from the people you serve with — and a plan to grow from it, looked at again every quarter.'))+'</p>';
  if(D.asked.length){
    h+='<h3>🙏 '+esc(t('Asked for your feedback'))+' <small>· '+D.asked.length+'</small></h3>';
    D.asked.forEach(function(a){
      h+='<div class="card p3Ask"><div class="mentorBlock" style="padding:0 0 8px">'+avatarHtml(a.subject,'sm')+'<div style="flex:1"><div class="mentorName">'+esc(gpT('{name} asked for your feedback',{name:a.subject.name}))+'</div>'+
        '<div class="mentorMeta">'+esc(a.title)+(a.due ? ' · '+esc(gpT('until {date}',{date:p3Date_(a.due)})) : '')+'</div></div></div>'+
        (a.note ? '<p class="p3Note">“'+esc(a.note)+'”</p>' : '')+
        '<div class="kmrActs"><button class="btn" data-p3answer="'+esc(a.id)+'">'+esc(t('Give feedback'))+'</button><button class="btn ghost" data-p3decline="'+esc(a.id)+'">'+esc(t('Not this time'))+'</button></div></div>';
    });
  }
  if(!S.board){
    h+='<h3>🪞 '+esc(t('Your reviews'))+'</h3>';
    if(!D.mine.length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('Ask the people you lead and serve with how you are doing — your team, your peers, your leaders. You see what they say together, never who said it.'))+'</p></div>';
    D.mine.forEach(function(r){ h+=p3CardHtml_(r); });
    h+='<button class="btn" id="p3New">＋ '+esc(t('Start a 360 review'))+'</button>';
  }
  if(D.shared.length){
    h+='<h3>🤝 '+esc(t('Shared with you'))+'</h3>';
    D.shared.forEach(function(r){ h+=p3CardHtml_(r); });
  }
  return h+p3PromiseHtml_();
}
function p3PromiseHtml_(){
  return '<div class="card p3Promise"><div class="mentorLabel">🔒 '+esc(t('How it stays anonymous'))+'</div><ul>'+
    '<li>'+esc(t('Answers are kept with nothing that says whose they are. Nobody — not the person, not an admin — can see who said what.'))+'</li>'+
    '<li>'+esc(gpT('The person sees how many have answered, never who. The results open only once the review is closed, and only if {n} or more answered.',{n:(S.p3 && S.p3.minN) || 3}))+'</li>'+
    '<li>'+esc(t('Written answers are shown word for word, in a different order each time — write them the way you would say them kindly to their face.'))+'</li></ul></div>';
}
function p3CardHtml_(r){
  var st = !r.closed ? gpT('{a} of {n} answered',{a:r.answered, n:r.asked})+(r.due ? ' · '+gpT('until {date}',{date:p3Date_(r.due)}) : '')
    : r.answered >= r.minN ? t('Closed · results ready') : t('Closed · too few answers to show');
  var plan = r.plan && r.plan.actions && r.plan.actions.length ? gpT('{n} actions',{n:r.plan.actions.length})+(r.reviewDue ? ' · '+gpT('{q} review due',{q:p3QName_(S.p3 && S.p3.quarter)}) : '') : '';
  return '<button class="card p3Card" data-p3open="'+esc(r.id)+'"><span class="p3CardMain"><b>'+esc(r.mine ? r.title : r.subject.name+' — '+r.title)+'</b>'+
    '<small>'+esc(p3Date_(r.created))+' · '+esc(st)+'</small>'+(plan ? '<small class="'+(r.reviewDue?'p3Due':'')+'">🎯 '+esc(plan)+'</small>' : '')+'</span><span class="ooChev">›</span></button>';
}

/* ---------- start one ---------- */
function p3People_(){
  var me=S.me, list=(S.roster||[]).filter(function(p){ return p.id!==me.id; }).map(function(p){ return { id:p.id, name:p.name, sub:t(campusName(p.campus))+' · '+t(p.ministry||p.dept||''), p:p }; });
  ((S.p3 && S.p3.people) || []).forEach(function(b){ list.push({ id:b.id, name:b.name, sub:t('YWAM GP Advisory Board'), p:b }); });
  return list.sort(function(a,b){ return a.name.localeCompare(b.name); });
}
function p3Picks_(){
  var me=S.me, O=S.org||{}, R=S.roster||[], picks=[];
  var ids=function(f){ return R.filter(function(p){ return p.id!==me.id && f(p); }).map(function(p){ return p.id; }); };
  picks.push(['clt', gpT('{campus} leadership team',{campus:t(campusName(me.campus))}), ids(function(p){ return p.campus===me.campus && p.dept==='Campus Leadership'; })]);
  var gp={}; (O.gp||[]).forEach(function(g){ if(g.id!==me.id) gp[g.id]=1; });
  picks.push(['gp', t('YWAM GP leadership team'), Object.keys(gp)]);
  var bd=((S.p3 && S.p3.people)||[]).map(function(b){ return b.id; }); (O.board||[]).forEach(function(b){ if(b.staffId && b.staffId!==me.id) bd.push(b.staffId); });
  picks.push(['board', t('Advisory Board'), bd]);
  picks.push(['dept', gpT('My department — {dept}',{dept:t(me.dept||'')}), ids(function(p){ return p.campus===me.campus && p.dept===me.dept; })]);
  if(me.mentorId) picks.push(['mentor', t('My mentor'), [me.mentorId]]);
  return picks.filter(function(p){ return p[2].length; });
}
function p3NewHtml_(){
  var D=S.p3Draft || (S.p3Draft={ title:gpT('360 review · {month}',{month:t(MONTH_SHORT[new Date().getMonth()])+' '+new Date().getFullYear()}), due:(function(){ var d=new Date(); d.setDate(d.getDate()+14); return calIso_(d); })(), note:'', picked:{}, q:'' });
  var n=Object.keys(D.picked).length, min=(S.p3 && S.p3.minN) || 3, people=p3People_();
  var h='<h2>🪞 '+esc(t('Start a 360 review'))+'</h2><div class="card">'+
    '<label class="f" for="p3Title">'+esc(t('What to call it'))+'</label><input type="text" id="p3Title" maxlength="80" value="'+esc(D.title)+'">'+
    '<label class="f" for="p3Due">'+esc(t('Answers until'))+'</label><input type="date" id="p3Due" value="'+esc(D.due)+'" min="'+todayStr()+'">'+
    '<label class="f" for="p3NoteIn">'+esc(t('A note to the people you ask (optional)'))+'</label><textarea id="p3NoteIn" rows="2" maxlength="400" placeholder="'+esc(t('e.g. I want to grow as a leader this year — please be honest.'))+'">'+esc(D.note)+'</textarea></div>';
  h+='<h3>'+esc(t('Who to ask'))+' <small>· '+n+'</small></h3>'+
    '<p class="sub" style="margin:0 0 8px">'+esc(gpT('Pick at least {n} — the more, the more anonymous. Peers, the people you lead, and your leaders.',{n:min}))+'</p>'+
    '<div class="deptChips">'+p3Picks_().map(function(p){ var all=p[2].every(function(id){ return D.picked[id]; });
      return '<button class="deptChip'+(all?' on':'')+'" data-p3pick="'+p[0]+'">'+(all?'✓ ':'＋ ')+esc(p[1])+' · '+p[2].length+'</button>'; }).join('')+'</div>';
  var picked=people.filter(function(p){ return D.picked[p.id]; });
  if(picked.length) h+='<div class="p3Picked">'+picked.map(function(p){ return '<button class="p3Chip" data-p3unpick="'+esc(p.id)+'">'+esc(p.name)+' ×</button>'; }).join('')+'</div>';
  h+='<input type="search" id="p3Search" placeholder="'+esc(t('Search for someone'))+'" value="'+esc(D.q)+'">';
  var q=String(D.q||'').toLowerCase(), shown=people.filter(function(p){ return !D.picked[p.id] && (!q || p.name.toLowerCase().indexOf(q)>-1); }).slice(0, q ? 40 : 12);
  h+='<div class="card p3PeopleList">'+(shown.length ? shown.map(function(p){
      return '<button class="p3Person" data-p3add="'+esc(p.id)+'">'+avatarHtml(p.p,'sm')+'<span><b>'+esc(p.name)+'</b><small>'+esc(p.sub)+'</small></span><span class="p3Plus">＋</span></button>'; }).join('')
    : '<p class="sub" style="margin:0">'+esc(t('Nobody else matches.'))+'</p>')+'</div>';
  return h+'<button class="btn" id="p3Send"'+(n<min||S.p3Busy?' disabled':'')+'>'+esc(n<min ? gpT('Pick {n} more',{n:min-n}) : gpT('Ask these {n}',{n:n}))+'</button>'+
    '<button class="linkbtn" id="p3Cancel">'+esc(t('Cancel'))+'</button>';
}

/* ---------- give feedback (or your own answers, self=true) ---------- */
function p3AnswerHtml_(a, self){
  var A=S.p3Ans && S.p3Ans.id===(self?'self:':'')+a.id ? S.p3Ans : (S.p3Ans={ id:(self?'self:':'')+a.id, ratings:{}, keep:'', start:'', stop:'', other:'' });
  if(self && S.p3R && S.p3R.self && !S.p3Ans.loaded){ var s=S.p3R.self; A.ratings=Object.assign({}, s.ratings); A.keep=s.keep; A.start=s.start; A.stop=s.stop; A.other=s.other; A.loaded=true; }
  var first=String((a.subject && a.subject.name) || '').split(' ')[0];
  var h='<h2>🪞 '+esc(self ? t('About yourself') : gpT('Feedback for {name}',{name:a.subject.name}))+'</h2>';
  if(!self) h+=(a.note ? '<div class="banner">“'+esc(a.note)+'” — '+esc(first)+'</div>' : '')+
    '<div class="card p3Promise"><p class="sub" style="margin:0">🔒 '+esc(gpT('Anonymous: {name} will see what everyone said together, never who said it — and only once enough people have answered. Written answers are shown word for word.',{name:first}))+'</p></div>';
  else h+='<p class="sub">'+esc(t('The same questions, about yourself — so you can see where others see you the same, and where they don’t. Only you (and whoever you share it with) see these.'))+'</p>';
  h+='<div class="card p3Form">';
  P3_Q.forEach(function(q){
    var v=A.ratings[q[0]];
    h+='<div class="p3Q"><div class="p3QHead"><b>'+esc(t(q[1]))+'</b><small>'+esc(t(q[2]))+'</small></div><div class="supChoice p3Scale" role="radiogroup" aria-label="'+esc(t(q[1]))+'">'+
      P3_SCALE.map(function(s){ return '<button type="button" role="radio" aria-checked="'+(v===s[0])+'" class="supPick'+(v===s[0]?' on':'')+'" data-p3rate="'+q[0]+'|'+s[0]+'"><b>'+s[0]+'</b> '+esc(t(s[1]))+'</button>'; }).join('')+
      '<button type="button" role="radio" aria-checked="'+(v===null)+'" class="supPick p3DK'+(v===null?' on':'')+'" data-p3rate="'+q[0]+'|">'+esc(t('Don’t know'))+'</button></div></div>';
  });
  P3_TEXTS.forEach(function(x){ h+='<label class="f" for="p3t_'+x[0]+'">'+esc(t(self ? x[2] : x[1]))+'</label><textarea id="p3t_'+x[0]+'" data-p3text="'+x[0]+'" rows="2" maxlength="1000">'+esc(A[x[0]]||'')+'</textarea>'; });
  h+='</div>';
  return h+'<button class="btn" id="'+(self?'p3SelfSave':'p3AnsSend')+'" data-p3id="'+esc(a.id)+'"'+(S.p3Busy?' disabled':'')+'>'+esc(self ? t('Save my answers') : t('Send my feedback'))+'</button>'+
    (self ? '<button class="linkbtn" id="p3SelfCancel">'+esc(t('Cancel'))+'</button>' : '<p class="hint" style="text-align:center">'+esc(t('Once sent it can’t be changed — nothing links it to you any more.'))+'</p>');
}

/* ---------- a review ---------- */
function p3ViewHtml_(){
  var R=S.p3R;
  if(!R) return '<h2>🪞 '+esc(t('360 reviews'))+'</h2><div class="card"><p class="sub" style="margin:0">'+esc(S.p3Err || t('Loading…'))+'</p></div>';
  if(S.p3Sub==='view' && S.p3SelfOpen) return p3AnswerHtml_(R, true);
  var h='<h2>🪞 '+esc(R.title)+'</h2>';
  if(!R.mine) h+='<p class="sub">'+esc(gpT('{name}’s review, shared with you — read-only.',{name:R.subject.name}))+'</p>';
  if(!R.closed){
    var pct=R.asked ? Math.round(R.answered/R.asked*100) : 0;
    h+='<div class="card"><div class="pBar"><div class="pBarTop"><b>'+esc(gpT('{a} of {n} answered',{a:R.answered, n:R.asked}))+'</b><span>'+esc(R.due ? gpT('until {date}',{date:p3Date_(R.due)}) : '')+'</span></div>'+
      '<div class="pTrack"><div class="pFill" style="left:0;width:'+pct+'%;background:var(--accent)"></div></div></div>'+
      '<p class="hint" style="margin:8px 0 0">'+esc(gpT('You’ll never see who has answered. The results open when you close it — {n} answers at least.',{n:R.minN}))+'</p>'+
      (R.reviewers ? '<details class="pulseMore"><summary>'+esc(gpT('Who you asked · {n}',{n:R.reviewers.length}))+'</summary><p class="sub" style="margin:6px 0 0">'+esc(R.reviewers.map(function(p){ return p.name; }).join(', '))+'</p></details>' : '')+'</div>';
    if(R.mine){
      h+='<div class="card"><div class="mentorLabel">🙋 '+esc(t('Your own answers'))+'</div>'+
        '<p class="sub" style="margin:0 0 8px">'+esc(R.self ? t('Done — they show next to everyone else’s in the results.') : t('Answer the same questions about yourself, to set beside what others say.'))+'</p>'+
        '<button class="btn ghost" id="p3SelfOpen" style="margin:0">'+esc(R.self ? t('Change my answers') : t('Answer about myself'))+'</button></div>';
      h+='<button class="btn" id="p3Close"'+(S.p3Busy?' disabled':'')+'>'+esc(t('Close it and see the results'))+'</button>';
    }
  } else if(!R.results){
    h+='<div class="card"><p class="sub" style="margin:0">'+esc(gpT('Closed with {a} answers. Fewer than {n} can’t be shown without people being able to work out who said what — start a new one and ask a few more people.',{a:R.answered, n:R.minN}))+'</p></div>';
  } else h+=p3ResultsHtml_(R);
  if(R.closed && R.results) h+=p3PlanHtml_(R);
  if(R.mine) h+=p3ShareHtml_(R);
  if(R.mine) h+='<button class="linkbtn" id="p3Delete" style="color:var(--bad)">'+esc(t('Delete this review'))+'</button>';
  return h;
}
/* Others' average against yours, for each area: a bar from 1 to 5 (others) and a mark
   (you), the number at the end; a table twin underneath. */
function p3ResultsHtml_(R){
  var res=R.results, self=R.self && R.self.ratings || {};
  var rows=P3_Q.map(function(q){ var a=res.areas[q[0]]||{}; return { k:q[0], name:t(q[1]), avg:a.avg, n:a.n||0, self:self[q[0]]!=null ? self[q[0]] : null }; });
  var rated=rows.filter(function(r){ return r.avg!=null; }).slice().sort(function(a,b){ return b.avg-a.avg; });
  var h='<div class="card"><div class="goalCardTitle" style="margin-bottom:2px">📊 '+esc(t('What they said'))+'</div>'+
    '<p class="hint" style="margin:0 0 8px">'+esc(gpT('From {n} people · 1 rarely – 5 always',{n:res.n}))+'</p>'+
    '<div class="finLegend"><span><i class="finKey in"></i>'+esc(t('Others (average)'))+'</span>'+(R.self ? '<span><i class="p3SelfKey"></i>'+esc(t('You'))+'</span>' : '')+'</div>';
  rows.forEach(function(r){
    var w=r.avg!=null ? (r.avg-1)/4*100 : 0, sx=r.self!=null ? (r.self-1)/4*100 : null;
    h+='<div class="p3Row"><div class="p3RowName">'+esc(r.name)+'</div><div class="p3Track" title="'+esc(r.avg!=null ? t('Others')+' '+r.avg+(r.self!=null?' · '+t('You')+' '+r.self:'') : t('Too few ratings'))+'">'+
      (r.avg!=null ? '<i class="p3Fill" style="width:'+Math.max(2,w).toFixed(1)+'%"></i>' : '')+(sx!=null ? '<i class="p3Self" style="left:'+sx.toFixed(1)+'%"></i>' : '')+'</div>'+
      '<b class="p3Val">'+(r.avg!=null ? r.avg.toFixed(1) : '—')+'</b></div>';
  });
  h+='<details class="finTable"><summary>'+esc(t('Show as a table'))+'</summary><table><thead><tr><th></th><th>'+esc(t('Others'))+'</th><th>'+esc(t('You'))+'</th><th>'+esc(t('Ratings'))+'</th></tr></thead><tbody>'+
    rows.map(function(r){ return '<tr><th>'+esc(r.name)+'</th><td>'+(r.avg!=null?r.avg.toFixed(1):'—')+'</td><td>'+(r.self!=null?r.self:'—')+'</td><td>'+r.n+'</td></tr>'; }).join('')+'</tbody></table></details>';
  if(rated.some(function(r){ return r.avg==null; }) || rows.some(function(r){ return r.avg==null; })) h+='<p class="hint" style="margin:6px 0 0">'+esc(gpT('An area fewer than {n} people rated shows no average.',{n:R.minN}))+'</p>';
  h+='</div>';
  if(rated.length>=2){
    var top=rated.slice(0,3), low=rated.slice(-3).reverse();
    h+='<div class="mmGrid p3Two"><div class="mmTile"><div class="mmTileName">💪 '+esc(t('Strengths'))+'</div>'+top.map(function(r){ return '<div class="p3Li">'+esc(r.name)+' <b>'+r.avg.toFixed(1)+'</b></div>'; }).join('')+'</div>'+
      '<div class="mmTile"><div class="mmTileName">🌱 '+esc(t('To grow in'))+'</div>'+low.map(function(r){ return '<div class="p3Li">'+esc(r.name)+' <b>'+r.avg.toFixed(1)+'</b></div>'; }).join('')+'</div></div>';
    var gaps=rows.filter(function(r){ return r.avg!=null && r.self!=null && Math.abs(r.self-r.avg)>=1; });
    if(gaps.length) h+='<div class="card"><div class="mentorLabel">🔍 '+esc(t('Where you see yourself differently'))+'</div>'+gaps.map(function(r){
      return '<div class="p3Li">'+esc(r.name)+' — '+esc(r.self>r.avg ? gpT('you {s}, others {o}: they see less than you do',{s:r.self, o:r.avg.toFixed(1)}) : gpT('you {s}, others {o}: they see more than you do',{s:r.self, o:r.avg.toFixed(1)}))+'</div>'; }).join('')+'</div>';
  }
  h+='<div class="card"><div class="goalCardTitle" style="margin-bottom:6px">💬 '+esc(t('In their words'))+'</div>';
  P3_TEXTS.forEach(function(x){
    var list=res.comments[x[0]]||[]; if(!list.length) return;
    h+='<div class="mentorLabel" style="margin-top:8px">'+esc(t(x[1]))+' <small>· '+list.length+'</small></div><ul class="p3Quotes">'+list.map(function(c){ return '<li>'+esc(c)+'</li>'; }).join('')+'</ul>';
  });
  return h+'</div>';
}
/* The action plan, and each quarter's look at it. */
function p3PlanHtml_(R){
  var P=R.plan||{ actions:[], reviews:{} }, q=S.p3Q || p3Quarters_(1)[0], rated=[];
  if(R.results) rated=P3_Q.map(function(x){ var a=R.results.areas[x[0]]; return { k:x[0], avg:a && a.avg }; }).filter(function(r){ return r.avg!=null; }).sort(function(a,b){ return a.avg-b.avg; });
  var h='<h3>🎯 '+esc(t('Action plan'))+' <small>· '+P.actions.length+'</small></h3>';
  if(!P.actions.length) h+='<div class="card"><p class="sub" style="margin:0">'+esc(R.mine ? t('Pick one to three things to grow in — the areas to grow in are a good place to start — and say how you’ll know it’s happening.') : t('No plan yet.'))+'</p></div>';
  P.actions.forEach(function(a){
    if(R.mine && S.p3PlanEdit && S.p3PlanEdit.id===a.id){ h+=p3ActionFormHtml_(S.p3PlanEdit, rated); return; }
    var last=null; Object.keys(P.reviews||{}).sort().forEach(function(k){ var it=P.reviews[k].items[a.id]; if(it) last={ q:k, it:it }; });
    h+='<div class="card p3Action"'+(R.mine?' data-p3act="'+esc(a.id)+'" role="button" tabindex="0"':'')+'><div class="p3ActTop"><span class="p3Area">'+esc(a.area ? p3Area_(a.area) : t('Something else'))+'</span>'+
      (a.by ? '<span class="p3By">'+esc(gpT('by {q}',{q:p3QName_(a.by)}))+'</span>' : '')+'</div><b>'+esc(a.what)+'</b>'+
      (a.measure ? '<small>📏 '+esc(a.measure)+'</small>' : '')+
      (last ? '<small class="p3St '+last.it.status+'">'+esc(p3QName_(last.q))+': '+esc(t((P3_STATUS.filter(function(s){ return s[0]===last.it.status; })[0]||['',''])[1]))+(last.it.note ? ' — '+esc(last.it.note) : '')+'</small>' : '')+'</div>';
  });
  if(R.mine){
    if(S.p3PlanEdit && S.p3PlanEdit.id==='new') h+=p3ActionFormHtml_(S.p3PlanEdit, rated);
    else if(P.actions.length<12) h+='<button class="btn ghost" id="p3ActAdd">＋ '+esc(t('Add an action'))+'</button>';
  }
  if(!P.actions.length) return h;
  /* this quarter's review, then the ones before */
  var cur=(P.reviews||{})[q], editing=R.mine && (S.p3Rev || !cur);
  h+='<h3>📅 '+esc(gpT('{q} review',{q:p3QName_(q)}))+'</h3>';
  if(editing && R.mine){
    var D=S.p3Rev || (S.p3Rev={ items:{}, reflection:cur ? cur.reflection : '' });
    if(cur && !D.loaded){ Object.keys(cur.items).forEach(function(k){ D.items[k]=Object.assign({}, cur.items[k]); }); D.loaded=true; }
    h+='<div class="card p3Rev"><p class="sub" style="margin:0 0 6px">'+esc(t('Once a quarter: how is each one going? Your mentor or whoever you share this with sees it too.'))+'</p>';
    P.actions.forEach(function(a){
      var it=D.items[a.id] || (D.items[a.id]={ status:'notstarted', note:'' });
      h+='<div class="p3RevItem"><b>'+esc(a.what)+'</b><div class="supChoice">'+P3_STATUS.map(function(s){
        return '<button type="button" class="supPick'+(it.status===s[0]?' on':'')+'" data-p3st="'+esc(a.id)+'|'+s[0]+'">'+esc(t(s[1]))+'</button>'; }).join('')+'</div>'+
        '<input type="text" data-p3stnote="'+esc(a.id)+'" maxlength="400" value="'+esc(it.note||'')+'" placeholder="'+esc(t('What happened? (optional)'))+'"></div>';
    });
    h+='<label class="f" for="p3Refl">'+esc(t('Looking back on the quarter'))+'</label><textarea id="p3Refl" rows="2" maxlength="800">'+esc(D.reflection||'')+'</textarea>'+
      '<div class="kmrActs"><button class="btn" id="p3RevSave">'+esc(gpT('Save the {q} review',{q:p3QName_(q)}))+'</button>'+(cur?'<button class="btn ghost" id="p3RevCancel">'+esc(t('Cancel'))+'</button>':'')+'</div></div>';
  } else if(cur){
    h+=p3RevShowHtml_(P, q, cur)+(R.mine ? '<button class="btn ghost" id="p3RevEdit">'+esc(t('Change this review'))+'</button>' : '');
  } else h+='<div class="card"><p class="sub" style="margin:0">'+esc(t('Not looked at yet this quarter.'))+'</p></div>';
  var past=Object.keys(P.reviews||{}).filter(function(k){ return k!==q; }).sort().reverse();
  if(past.length) h+='<details class="pulseMore"><summary>'+esc(gpT('Earlier reviews · {n}',{n:past.length}))+'</summary>'+past.map(function(k){ return '<div class="mentorLabel" style="margin-top:10px">'+esc(p3QName_(k))+'</div>'+p3RevShowHtml_(P, k, P.reviews[k]); }).join('')+'</details>';
  return h;
}
function p3RevShowHtml_(P, q, rv){
  return '<div class="card p3Rev">'+P.actions.map(function(a){ var it=rv.items[a.id]; if(!it) return '';
      return '<div class="p3RevItem"><b>'+esc(a.what)+'</b><small class="p3St '+it.status+'">'+esc(t((P3_STATUS.filter(function(s){ return s[0]===it.status; })[0]||['',''])[1]))+(it.note?' — '+esc(it.note):'')+'</small></div>'; }).join('')+
    (rv.reflection ? '<p class="p3Note">“'+esc(rv.reflection)+'”</p>' : '')+'<p class="hint" style="margin:4px 0 0">'+esc(p3Date_(rv.at))+'</p></div>';
}
function p3ActionFormHtml_(E, rated){
  var qs=p3Quarters_(5);
  return '<div class="card supForm p3ActForm"><div class="supFormHead">'+esc(E.id==='new' ? t('A new action') : t('Change this action'))+'</div>'+
    (rated.length && E.id==='new' ? '<div class="hint" style="margin:4px 0 2px">'+esc(t('Your areas to grow in:'))+'</div><div class="deptChips">'+rated.slice(0,3).map(function(r){ return '<button type="button" class="deptChip'+(E.area===r.k?' on':'')+'" data-p3area="'+r.k+'">'+esc(p3Area_(r.k))+' · '+r.avg.toFixed(1)+'</button>'; }).join('')+'</div>' : '')+
    '<label class="f" for="p3ActArea">'+esc(t('Area'))+'</label><select id="p3ActArea"><option value="">'+esc(t('Something else'))+'</option>'+P3_Q.map(function(q){ return '<option value="'+q[0]+'"'+(E.area===q[0]?' selected':'')+'>'+esc(t(q[1]))+'</option>'; }).join('')+'</select>'+
    '<label class="f" for="p3ActWhat">'+esc(t('What I’ll do'))+'</label><input type="text" id="p3ActWhat" maxlength="300" value="'+esc(E.what||'')+'" placeholder="'+esc(t('e.g. Answer emails within two days'))+'">'+
    '<label class="f" for="p3ActMeasure">'+esc(t('How I’ll know'))+'</label><input type="text" id="p3ActMeasure" maxlength="300" value="'+esc(E.measure||'')+'" placeholder="'+esc(t('e.g. My inbox is under 20 every Friday'))+'">'+
    '<label class="f" for="p3ActBy">'+esc(t('By when'))+'</label><select id="p3ActBy"><option value="">—</option>'+qs.map(function(q){ return '<option value="'+q+'"'+(E.by===q?' selected':'')+'>'+esc(p3QName_(q))+'</option>'; }).join('')+'</select>'+
    '<div class="kmrActs"><button class="btn" id="p3ActSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="p3ActCancel">'+esc(t('Cancel'))+'</button></div>'+
    (E.id!=='new' ? '<button type="button" class="supRemove" id="p3ActDel">🗑 '+esc(t('Remove this action'))+'</button>' : '')+'</div>';
}
function p3ShareHtml_(R){
  var ids={}; (R.sharedWith||[]).forEach(function(p){ ids[p.id]=1; });
  var h='<h3>🤝 '+esc(t('Shared with'))+'</h3><div class="card"><p class="sub" style="margin:0 0 8px">'+esc((R.sharedWith||[]).length ? R.sharedWith.map(function(p){ return p.name; }).join(', ') : t('Nobody yet — only you see it.'))+'</p>';
  if(!S.p3ShareOpen) return h+'<button class="btn ghost" id="p3ShareOpen" style="margin:0">'+esc(t('Share the results and plan'))+'</button></div>';
  var people=p3People_(), mentor=S.me.mentorId;
  h+='<p class="hint" style="margin:0 0 6px">'+esc(t('They see the results, your own answers and your plan with its reviews — not who you asked.'))+'</p>'+
    (mentor ? '<label class="leadOpt"><input type="checkbox" data-p3share="'+esc(mentor)+'"'+(ids[mentor]?' checked':'')+'> '+esc(gpT('{name} (my mentor)',{name:staffName_(mentor)}))+'</label>' : '')+
    '<div class="leadsPick p3ShareList">'+people.filter(function(p){ return p.id!==mentor; }).filter(function(p){ return ids[p.id] || p.p.dept==='Campus Leadership' || p.sub===t('YWAM GP Advisory Board'); }).map(function(p){
      return '<label class="leadOpt"><input type="checkbox" data-p3share="'+esc(p.id)+'"'+(ids[p.id]?' checked':'')+'> '+esc(p.name)+' <span class="pmeta">'+esc(p.sub)+'</span></label>'; }).join('')+'</div>'+
    '<div class="kmrActs"><button class="btn" id="p3ShareSave">'+esc(t('Save'))+'</button><button class="btn ghost" id="p3ShareCancel">'+esc(t('Cancel'))+'</button></div></div>';
  return h;
}

/* My Home's tile: something waiting on you comes first. */
function p3TileHtml_(){
  var G=S.p3Glance; if(!G) return homeTile_('p3Tile', '🪞', t('360 reviews'), esc(t('Feedback from the people you serve with')));
  var sub = G.asked ? gpT(G.asked===1 ? '1 waiting for your feedback' : '{n} waiting for your feedback',{n:G.asked})
    : G.reviewDue ? gpT('Your plan’s {q} review is due',{q:p3QName_(G.quarter)}) : G.open ? t('Answers coming in') : t('Feedback from the people you serve with');
  return homeTile_('p3Tile', '🪞', t('360 reviews'), (G.asked || G.reviewDue ? '<b class="p3TileDue">' : '')+esc(sub)+(G.asked || G.reviewDue ? '</b>' : ''));
}

function bindP360_(){
  var tile=document.getElementById('p3Tile');
  if(tile) tile.onclick=function(){ gpTap(); S.view='p360'; S.p3Sub='home'; S.p3=null; render(); window.scrollTo(0,0); };
  if(S.view!=='p360') return;
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  var val=function(id){ var el=document.getElementById(id); return el ? el.value : ''; };
  on('p3Back', function(){ if(S.p3Sub==='home'){ S.view=S.board ? 'ywamgp' : 'week'; render(); } else if(S.p3SelfOpen){ S.p3SelfOpen=false; S.p3Ans=null; render(); } else p3Home_(); });
  on('p3New', function(){ gpTap(); S.p3Sub='new'; S.p3Draft=null; render(); window.scrollTo(0,0); });
  on('p3Cancel', function(){ S.p3Draft=null; p3Home_(); });
  document.querySelectorAll('[data-p3open]').forEach(function(b){ b.onclick=function(){ gpTap(); p3Open_(b.getAttribute('data-p3open')); }; });
  document.querySelectorAll('[data-p3answer]').forEach(function(b){ b.onclick=function(){ gpTap(); S.p3Sub='answer'; S.p3Id=b.getAttribute('data-p3answer'); S.p3Ans=null; render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-p3decline]').forEach(function(b){ b.onclick=function(){
    if(!confirm(t('Let them know you won’t be giving feedback this time?'))) return;
    run('p360Decline', p3Auth_().concat([b.getAttribute('data-p3decline')]), function(d){ if(d && d.ok){ S.p3=null; render(); } else showMsg(t('Could not save')); }); }; });
  /* starting one */
  var D=S.p3Draft;
  if(D){
    var keep=function(){ D.title=val('p3Title'); D.due=val('p3Due'); D.note=val('p3NoteIn'); };
    ['p3Title','p3Due','p3NoteIn'].forEach(function(id){ var el=document.getElementById(id); if(el) el.oninput=keep; });
    var sr=document.getElementById('p3Search'); if(sr) sr.oninput=function(){ keep(); D.q=sr.value; var pos=sr.selectionStart; render(); var s2=document.getElementById('p3Search'); if(s2){ s2.focus(); try { s2.setSelectionRange(pos, pos); } catch(e){} } };
    document.querySelectorAll('[data-p3pick]').forEach(function(b){ b.onclick=function(){ keep(); var p=p3Picks_().filter(function(x){ return x[0]===b.getAttribute('data-p3pick'); })[0]; if(!p) return;
      var all=p[2].every(function(id){ return D.picked[id]; }); p[2].forEach(function(id){ if(all) delete D.picked[id]; else D.picked[id]=1; }); render(); }; });
    document.querySelectorAll('[data-p3add]').forEach(function(b){ b.onclick=function(){ keep(); D.picked[b.getAttribute('data-p3add')]=1; render(); }; });
    document.querySelectorAll('[data-p3unpick]').forEach(function(b){ b.onclick=function(){ keep(); delete D.picked[b.getAttribute('data-p3unpick')]; render(); }; });
    on('p3Send', function(){ keep(); if(S.p3Busy) return; S.p3Busy=true;
      run('p360Create', p3Auth_().concat([{ title:D.title, due:D.due, note:D.note, reviewers:Object.keys(D.picked) }]), function(d){
        S.p3Busy=false;
        if(d && d.ok){ S.p3Draft=null; S.p3=null; showMsg(gpT('Sent to {n} people',{n:d.review.asked})); p3Open_(d.review.id); }
        else showMsg(d && d.err==='too_few' ? t('Pick at least three people.') : d && d.err==='bad_date' ? t('Pick a date from today on.') : t('Could not save'));
      }, function(){ S.p3Busy=false; showMsg(t('No connection — try again when you are online.')); }); });
  }
  /* answering (or your own answers) */
  var A=S.p3Ans;
  if(A){
    document.querySelectorAll('[data-p3rate]').forEach(function(b){ b.onclick=function(){
      var v=b.getAttribute('data-p3rate').split('|'); A.ratings[v[0]] = v[1]==='' ? null : Number(v[1]);
      b.parentNode.querySelectorAll('[data-p3rate]').forEach(function(x){ var o=x===b; x.classList.toggle('on', o); x.setAttribute('aria-checked', String(o)); }); }; });
    document.querySelectorAll('[data-p3text]').forEach(function(el){ el.oninput=function(){ A[el.getAttribute('data-p3text')]=el.value; }; });
    var pack=function(){ var o={ ratings:A.ratings }; P3_TEXTS.forEach(function(x){ o[x[0]]=A[x[0]]||''; }); return o; };
    on('p3AnsSend', function(){
      var id=this.getAttribute('data-p3id'), o=pack();
      if(!P3_Q.some(function(q){ return o.ratings[q[0]]; }) && !P3_TEXTS.some(function(x){ return String(o[x[0]]).trim(); })){ showMsg(t('Answer at least one question first.')); return; }
      if(!confirm(t('Send your feedback? Once sent it can’t be changed.'))) return;
      if(S.p3Busy) return; S.p3Busy=true;
      run('p360Answer', p3Auth_().concat([id, o]), function(d){ S.p3Busy=false;
        if(d && d.ok){ S.p3Ans=null; showMsg(t('Thank you — sent anonymously')); p3Home_(); }
        else { showMsg(d && d.err==='closed' ? t('That review has closed.') : d && d.err==='already' ? t('You’ve already answered this one.') : t('Could not save')); if(d && (d.err==='closed' || d.err==='already')) p3Home_(); } },
        function(){ S.p3Busy=false; showMsg(t('No connection — try again when you are online.')); }); });
    on('p3SelfSave', function(){ var id=this.getAttribute('data-p3id'); if(S.p3Busy) return; S.p3Busy=true;
      run('p360Self', p3Auth_().concat([id, pack()]), function(d){ if(p3Put_(d, t('Saved'))){ S.p3SelfOpen=false; S.p3Ans=null; } render(); window.scrollTo(0,0); }); });
    on('p3SelfCancel', function(){ S.p3SelfOpen=false; S.p3Ans=null; render(); });
  }
  /* a review */
  var R=S.p3R; if(!R || S.p3Sub!=='view') return;
  on('p3SelfOpen', function(){ S.p3SelfOpen=true; S.p3Ans=null; render(); window.scrollTo(0,0); });
  on('p3Close', function(){
    if(!confirm(R.answered < R.minN ? gpT('Only {a} have answered — with fewer than {n} the results can’t be shown. Close it anyway?',{a:R.answered, n:R.minN}) : t('Close it now? Nobody else can answer after this.'))) return;
    S.p3Busy=true; run('p360Close', p3Auth_().concat([R.id]), function(d){ p3Put_(d, t('Closed')); render(); window.scrollTo(0,0); }); });
  on('p3Delete', function(){ if(!confirm(t('Delete this review, its results and its plan? This can’t be undone.'))) return;
    run('p360Delete', p3Auth_().concat([R.id]), function(d){ if(d && d.ok){ showMsg(t('Deleted')); p3Home_(); } else showMsg(t('Could not save')); }); });
  var plan=function(list, msg){ S.p3Busy=true; run('p360SavePlan', p3Auth_().concat([R.id, list]), function(d){ if(p3Put_(d, msg)) S.p3PlanEdit=null; render(); }); };
  on('p3ActAdd', function(){ S.p3PlanEdit={ id:'new', area:'', what:'', measure:'', by:'' }; render(); var w=document.getElementById('p3ActWhat'); if(w) w.focus(); });
  document.querySelectorAll('[data-p3act]').forEach(function(c){ c.onclick=function(){ var a=R.plan.actions.filter(function(x){ return x.id===c.getAttribute('data-p3act'); })[0]; if(a){ S.p3PlanEdit=Object.assign({}, a); render(); } }; });
  if(S.p3PlanEdit){
    var E=S.p3PlanEdit, grab=function(){ E.area=val('p3ActArea'); E.what=val('p3ActWhat'); E.measure=val('p3ActMeasure'); E.by=val('p3ActBy'); };
    document.querySelectorAll('[data-p3area]').forEach(function(b){ b.onclick=function(){ grab(); E.area=b.getAttribute('data-p3area'); render(); }; });
    on('p3ActCancel', function(){ S.p3PlanEdit=null; render(); });
    on('p3ActSave', function(){ grab(); if(!String(E.what).trim()){ showMsg(t('Say what you’ll do')); return; }
      var list=R.plan.actions.slice(); if(E.id==='new') list.push({ area:E.area, what:E.what, measure:E.measure, by:E.by }); else list=list.map(function(a){ return a.id===E.id ? E : a; });
      plan(list, t('Saved')); });
    on('p3ActDel', function(){ if(!confirm(t('Remove this action?'))) return; plan(R.plan.actions.filter(function(a){ return a.id!==E.id; }), t('Removed')); });
  }
  var RV=S.p3Rev;
  document.querySelectorAll('[data-p3st]').forEach(function(b){ b.onclick=function(){ var v=b.getAttribute('data-p3st').split('|'); RV.items[v[0]]=RV.items[v[0]]||{ note:'' }; RV.items[v[0]].status=v[1];
    b.parentNode.querySelectorAll('[data-p3st]').forEach(function(x){ x.classList.toggle('on', x===b); }); }; });
  document.querySelectorAll('[data-p3stnote]').forEach(function(el){ el.oninput=function(){ var k=el.getAttribute('data-p3stnote'); RV.items[k]=RV.items[k]||{ status:'notstarted' }; RV.items[k].note=el.value; }; });
  var rf=document.getElementById('p3Refl'); if(rf) rf.oninput=function(){ RV.reflection=rf.value; };
  on('p3RevEdit', function(){ S.p3Rev=null; S.p3Rev={ items:{}, reflection:'' }; S.p3Rev.loaded=false; var cur=R.plan.reviews[S.p3Q]; if(cur){ Object.keys(cur.items).forEach(function(k){ S.p3Rev.items[k]=Object.assign({}, cur.items[k]); }); S.p3Rev.reflection=cur.reflection; S.p3Rev.loaded=true; } render(); });
  on('p3RevCancel', function(){ S.p3Rev=null; render(); });
  on('p3RevSave', function(){ var items=Object.keys(RV.items).map(function(k){ return { actionId:k, status:RV.items[k].status||'notstarted', note:RV.items[k].note||'' }; });
    S.p3Busy=true; run('p360Review', p3Auth_().concat([R.id, S.p3Q, items, RV.reflection||'']), function(d){ if(p3Put_(d, t('Saved'))){ S.p3Rev=null; if(S.p3Glance) S.p3Glance.reviewDue=false; } render(); }); });
  on('p3ShareOpen', function(){ S.p3ShareOpen=true; render(); });
  on('p3ShareCancel', function(){ S.p3ShareOpen=false; render(); });
  on('p3ShareSave', function(){ var ids=[].map.call(document.querySelectorAll('[data-p3share]:checked'), function(c){ return c.getAttribute('data-p3share'); });
    S.p3Busy=true; run('p360Share', p3Auth_().concat([R.id, ids]), function(d){ if(p3Put_(d, t('Saved'))) S.p3ShareOpen=false; render(); }); });
}
