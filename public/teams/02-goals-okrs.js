/* My YWAM GP — teams.html, part 2 of 11: My week, Goals & Tasks, weekly goals and habits.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* The OKR pages that lived here (objectives, key results, sliders, Paste OKRs) are gone: the quarter's
   priorities are Rocks now — teams/28-rocks.js. Stored objectives are kept and shown there, read only. */
/* ---------- my week: the personal page ---------- */

/* The app knows what day it is. Monday you're setting goals, midweek you're
   keeping habits, Friday you're closing the week out — so the card that matters
   today sits at the top instead of the same fixed wall every day. */
function weekPhase(){
  var dow=new Date().getDay();               // 0 Sun … 6 Sat
  if(dow===1||dow===2) return 'plan';
  if(dow===5||dow===6||dow===0) return 'review';
  return 'work';
}
function phaseBanner(phase, wk){
  var rec=goalsForWeek(wk);
  var hasGoals=!!(rec && rec.items.some(function(i){return i.text;}));
  if(phase==='plan' && !hasGoals)
    return '<div class="banner big">🎯 <strong>'+esc(t('Start of the week.'))+'</strong> Pick the three things that matter for week '+wk+'.'+
      ' <button class="linkbtn inline" id="jumpGoals">'+esc(t('Set them now'))+'</button></div>';
  /* No end-of-week "Log today" banner: there is no daily check-in any more —
     the weekly health check-in is the one thing to fill in. Goals-incomplete
     lives in the bell. */
  return '';
}

function smartYear_(){ return S.smartYear==null ? new Date().getFullYear() : S.smartYear; }
/* --- the Goals & Tasks page (Oct 2026, Uriah) ---
   Annual goals open into a page of their own, with two tabs. 🎯 Goals: the
   year and category, each goal written out as a SMART goal with a plain
   explanation of what that means, and the quarterly and monthly steps that
   lead up to it, ticked off as they're done. ✅ Tasks: a Google-Tasks-like
   list — add a line and press Enter, tick it off, give it a date, link it
   to a goal — so the goal's progress follows what actually gets done. */
var SMART_HELP = [
  ['s','Specific','Say exactly what you will do — who, what, where. “Read the whole New Testament” rather than “read more”.'],
  ['m','Measurable','How will you know it’s done? A number or a clear finish line: “27 books, one every two weeks”.'],
  ['a','Achievable','Stretching but possible with the time and resources you have. What makes this doable for you?'],
  ['r','Relevant','Why this, why now? How does it serve your walk with God, your ministry, your family?'],
  ['t','Time-bound','By when? Give it a deadline, then break the year into quarterly and monthly steps.']
];
var SMART_PLACEHOLDER = {
  s:'What exactly will you do?', m:'How will you know it’s done? A number, a finish line.',
  a:'What makes it doable for you this year?', r:'Why this, why now?', t:'By when? e.g. by 30 November'
};
function tkToday_(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function tkAddDays_(iso, n){ var d=new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function tkDateLabel_(iso){
  if(!iso) return '';
  var today=tkToday_();
  if(iso===today) return t('Today');
  if(iso===tkAddDays_(today,1)) return t('Tomorrow');
  if(iso===tkAddDays_(today,-1)) return t('Yesterday');
  var d=new Date(iso+'T00:00:00');
  return d.toLocaleDateString(LANG==='km'?'km-KH':'en-GB',{weekday:'short', day:'numeric', month:'short'});
}
function tkMonthShort_(n){ return new Date(2026, n-1, 1).toLocaleDateString(LANG==='km'?'km-KH':'en-GB',{month:'short'}); }
function stepLabel_(st){ return st.kind==='quarter' ? 'Q'+st.period : tkMonthShort_(st.period); }
/* Quarters first, each in order, then the months — the way a year reads. */
function stepsSorted_(steps){
  return (steps||[]).slice().sort(function(a,b){
    if(a.kind!==b.kind) return a.kind==='quarter' ? -1 : 1;
    return a.period-b.period;
  });
}
function goalById_(id){ return S.smartGoals.filter(function(x){ return x.id===id; })[0]; }
function goalTasks_(id){ return (S.tasks||[]).filter(function(x){ return x.goalId===id; }); }
function openTasksDue_(){
  var today=tkToday_();
  return (S.tasks||[]).filter(function(x){ return !x.done && x.due && x.due<=today; }).length;
}

/* The My Home card: the year at a glance, and a tap opens the page. */
function annualGoalsHtml(){
  var year=smartYear_();
  var yearGoals=S.smartGoals.filter(function(g){ return Number(g.year)===Number(year); });
  var avg=yearGoals.length ? Math.round(yearGoals.reduce(function(a,g){ return a+(Number(g.pct)||0); },0)/yearGoals.length) : 0;
  var due=openTasksDue_();
  var line=yearGoals.length===1 ? gpT('1 goal · {pct}%',{pct:avg}) : yearGoals.length ? gpT('{n} goals · {pct}% on average',{n:yearGoals.length, pct:avg}) : t('No goals set for this year yet.');
  if(due) line+=' · '+(due===1 ? t('1 task due') : gpT('{n} tasks due',{n:due}));
  var h='<h3 id="sec-annual">'+esc(t('Annual Goals · SMART'))+'</h3>';
  return h+'<button class="card homeFold" id="goGoalsFromMe"><span style="flex:1;min-width:0"><b>'+esc(gpT('{year} goals',{year:year}))+'</b>'+
    '<span class="pmeta" style="display:block">'+esc(line)+'</span>'+
    (yearGoals.length?'<span class="bar" style="display:block;margin-top:6px"><span class="barFill" style="display:block;width:'+avg+'%"></span></span>':'')+'</span>'+
    '<span class="chev">›</span></button>';
}

function goalsPageHtml(){
  var tab=S.goalsTab||'goals';
  var open=(S.tasks||[]).filter(function(x){ return !x.done; }).length;
  var h='<button class="linkbtn" id="goalsBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(t('My Home'))+'</button>';
  h+='<h2>'+esc(t('Goals & Tasks'))+'</h2>';
  h+='<div class="hospTabs gTabs">'+
    '<button class="hospTab'+(tab==='goals'?' on':'')+'" data-gtab="goals"><span>🎯</span>'+esc(t('Goals'))+'</button>'+
    '<button class="hospTab'+(tab==='tasks'?' on':'')+'" data-gtab="tasks"><span>✅</span>'+esc(t('Tasks'))+(open?' <span class="hospBadge">'+open+'</span>':'')+'</button></div>';
  return h+(tab==='tasks' ? tasksTabHtml_() : goalsTabHtml_());
}

function smartHelpHtml_(){
  var h='<button class="card homeFold slim" id="smartHelpToggle"><span style="flex:1"><b>'+esc(t('What is a SMART goal?'))+'</b>'+
    (S.smartHelpOpen?'':'<span class="pmeta" style="display:block">'+esc(t('Specific · Measurable · Achievable · Relevant · Time-bound'))+'</span>')+'</span>'+
    '<span class="chev">'+(S.smartHelpOpen?'▴':'▾')+'</span></button>';
  if(!S.smartHelpOpen) return h;
  h+='<div class="card smartHelp">';
  h+='<p class="sub" style="margin:0 0 10px">'+esc(t('A SMART goal is written so clearly that you can tell, any month of the year, whether you are on track. Five short answers do it:'))+'</p>';
  SMART_HELP.forEach(function(r){
    h+='<div class="smartRow"><b class="smartLetter">'+r[0].toUpperCase()+'</b><span><b>'+esc(t(r[1]))+'</b> — '+esc(t(r[2]))+'</span></div>';
  });
  h+='<p class="sub" style="margin:10px 0 0">'+esc(t('Then break the year down: what has to be true by the end of each quarter, and what gets done each month? Tick the steps off as you go and the goal’s progress follows.'))+'</p>';
  return h+'</div>';
}

function goalsTabHtml_(){
  var year=smartYear_(), cat=S.smartCategory||'Faith';
  var h='<div class="card">';
  h+='<div class="yearPick"><button class="yearBtn" id="smartPrevYear" aria-label="'+esc(t('Previous year'))+'">‹</button>'+
     '<span class="yearNum">'+year+'</span>'+
     '<button class="yearBtn" id="smartNextYear" aria-label="'+esc(t('Next year'))+'">›</button></div>';
  h+='<div class="catChips">'+SMART_CATEGORIES.map(function(c){
    var n=S.smartGoals.filter(function(g){ return Number(g.year)===Number(year) && g.category===c; }).length;
    return '<button class="catChip'+(cat===c?' on':'')+'" data-smartcat="'+c+'">'+esc(t(c))+(n?' · '+n:'')+'</button>';
  }).join('')+'</div>';
  h+='</div>';
  h+=smartHelpHtml_();

  var mine=S.smartGoals.filter(function(g){ return Number(g.year)===Number(year) && g.category===cat; });
  if(!mine.length && !(S.smartDraft && !S.smartDraft.id)){
    h+='<div class="card"><p class="sub" style="margin:4px 0 0">'+esc(t('No goals set for this category yet.'))+'</p></div>';
  }
  mine.forEach(function(g){
    if(S.smartDraft && S.smartDraft.id===g.id){ h+='<div class="card">'+smartGoalFormHtml(S.smartDraft)+'</div>'; return; }
    h+=smartGoalCardHtml_(g);
  });
  if(S.smartDraft && !S.smartDraft.id) h+='<div class="card">'+smartGoalFormHtml(S.smartDraft)+'</div>';
  else if(!S.smartDraft) h+='<button class="btn ghost" id="smartNewBtn" style="margin-top:4px">+ '+esc(t('New goal'))+'</button>';
  return h;
}

function smartProgressLine_(g){
  var steps=g.steps||[], doneSteps=steps.filter(function(x){ return x.done; }).length;
  var bits=[g.pct+'%'];
  if(steps.length) bits.push(gpT('{done} of {n} steps',{done:doneSteps, n:steps.length}));
  if(g.tasksTotal) bits.push(gpT('{done} of {n} tasks',{done:g.tasksDone||0, n:g.tasksTotal}));
  return bits.join(' · ');
}

function smartGoalCardHtml_(g){
  var h='<div class="card smartCard" data-goalcard="'+esc(g.id)+'">';
  h+='<div class="smartTitle">'+esc(g.title)+'</div>'+(g.meta?'<div class="smartMeta">'+esc(g.meta)+'</div>':'');
  h+='<div class="bar"><div class="barFill'+(g.pct>=100?' done':'')+'" style="width:'+g.pct+'%"></div></div>';
  h+='<div class="smartActions"><span class="smartPct">'+esc(smartProgressLine_(g))+'</span>'+
    '<button class="linkbtn inline" data-smartedit="'+esc(g.id)+'">'+esc(t('Edit'))+'</button>'+
    '<button class="danger" data-smartdel="'+esc(g.id)+'">'+esc(t('Delete'))+'</button></div>';
  var sm=g.smart||{}, filled=SMART_HELP.filter(function(r){ return sm[r[0]]; });
  if(filled.length){
    h+='<div class="smartGrid">'+filled.map(function(r){
      return '<div class="smartRow"><b class="smartLetter" title="'+esc(t(r[1]))+'">'+r[0].toUpperCase()+'</b><span>'+esc(sm[r[0]])+'</span></div>';
    }).join('')+'</div>';
  } else {
    h+='<p class="hint" style="margin:8px 0 0">'+esc(t('Not written as a SMART goal yet — tap Edit to fill in the five answers.'))+'</p>';
  }
  /* the steps that lead up to it */
  var steps=stepsSorted_(g.steps);
  h+='<div class="stepsHead">'+esc(t('Steps to get there'))+'</div>';
  if(!steps.length) h+='<p class="hint" style="margin:0 0 6px">'+esc(t('Break it down: what must be true by the end of each quarter, and what gets done each month?'))+'</p>';
  steps.forEach(function(st){
    h+='<div class="stepRow'+(st.done?' done':'')+'">'+
      '<button class="tkCheck'+(st.done?' on':'')+'" data-stepdone="'+esc(g.id)+'|'+esc(st.id)+'" aria-label="'+esc(t(st.done?'Not done yet':'Done'))+'">'+(st.done?'✓':'')+'</button>'+
      '<span class="stepPeriod'+(st.kind==='quarter'?' q':'')+'">'+esc(stepLabel_(st))+'</span>'+
      '<span class="stepTitle">'+esc(st.title)+'</span>'+
      '<button class="stepDel" data-stepdel="'+esc(g.id)+'|'+esc(st.id)+'" aria-label="'+esc(t('Remove step'))+'">×</button></div>';
  });
  if(S.stepAdd===g.id){
    var sd=S.stepDraft||{kind:'quarter', period:1, title:''};
    var periods=sd.kind==='quarter' ? [1,2,3,4] : [1,2,3,4,5,6,7,8,9,10,11,12];
    h+='<div class="stepAdd">'+
      '<select id="stepKind" aria-label="'+esc(t('Quarterly or monthly'))+'"><option value="quarter"'+(sd.kind==='quarter'?' selected':'')+'>'+esc(t('Quarter'))+'</option><option value="month"'+(sd.kind==='month'?' selected':'')+'>'+esc(t('Month'))+'</option></select>'+
      '<select id="stepPeriod" aria-label="'+esc(t('Which one'))+'">'+periods.map(function(p){ return '<option value="'+p+'"'+(Number(sd.period)===p?' selected':'')+'>'+esc(sd.kind==='quarter'?'Q'+p:tkMonthShort_(p))+'</option>'; }).join('')+'</select>'+
      '</div><div class="stepAdd">'+
      '<input type="text" id="stepTitle" maxlength="200" value="'+esc(sd.title||'')+'" placeholder="'+esc(sd.kind==='quarter'?t('By the end of this quarter…'):t('This month…'))+'">'+
      '<button class="btn small" id="stepSaveBtn">'+esc(t('Add'))+'</button>'+
      '<button class="linkbtn inline" id="stepCancelBtn">'+esc(t('Cancel'))+'</button></div>';
  } else if(steps.length<24){
    h+='<button class="linkbtn inline stepNew" data-stepnew="'+esc(g.id)+'">+ '+esc(t('Add a quarterly or monthly step'))+'</button>';
  }
  /* its tasks, on the other tab */
  var n=g.tasksTotal||0;
  h+='<div class="goalTasksRow"><button class="linkbtn inline" data-goaltasks="'+esc(g.id)+'">✅ '+
    esc(n ? (n===1 ? gpT('1 task · {done} done',{done:g.tasksDone||0}) : gpT('{n} tasks · {done} done',{n:n, done:g.tasksDone||0})) : t('Add tasks for this goal'))+' ›</button></div>';
  return h+'</div>';
}

function smartGoalFormHtml(draft){
  var g=draft.id ? goalById_(draft.id) : null;
  var auto=g && ((g.steps||[]).length || g.tasksTotal);
  var sm=draft.smart||{};
  var h='<div class="smartGoal">'+
    '<label class="f">'+esc(t('Goal'))+'</label>'+
    '<input type="text" id="sg_title" maxlength="200" value="'+esc(draft.title||'')+'" placeholder="'+esc(t('What are you aiming for this year?'))+'">'+
    '<label class="f">'+esc(t('Detail (optional)'))+'</label>'+
    '<input type="text" id="sg_meta" maxlength="200" value="'+esc(draft.meta||'')+'" placeholder="'+esc(t('e.g. Measurable · by Dec 2026'))+'">';
  h+='<div class="stepsHead" style="margin-top:14px">'+esc(t('Write it as a SMART goal'))+'</div>';
  SMART_HELP.forEach(function(r){
    h+='<label class="f smartF" for="sg_'+r[0]+'"><b class="smartLetter">'+r[0].toUpperCase()+'</b> '+esc(t(r[1]))+'</label>'+
      '<textarea id="sg_'+r[0]+'" maxlength="300" rows="2" placeholder="'+esc(t(SMART_PLACEHOLDER[r[0]]))+'">'+esc(sm[r[0]]||'')+'</textarea>';
  });
  if(auto){
    h+='<p class="hint" style="margin-top:12px">'+esc(gpT('Progress follows your steps and tasks: {pct}%',{pct:g.pct}))+'</p>';
  } else {
    h+='<label class="f">'+esc(t('Progress'))+'</label>'+
      '<input type="number" id="sg_pct" min="0" max="100" placeholder="0" value="'+(draft.pct ? draft.pct : '')+'"> %'+
      '<p class="hint">'+esc(t('Once the goal has steps or tasks, progress follows what you tick off.'))+'</p>';
  }
  h+='<button class="btn" id="smartSaveBtn">'+esc(t(draft.id?'Save changes':'Add goal'))+'</button>'+
    '<button class="btn ghost" id="smartCancelBtn">'+esc(t('Cancel'))+'</button>'+
  '</div>';
  return h;
}

/* ✅ Tasks — the Google-Tasks-like list. */
function taskGoalOptions_(sel){
  var year=new Date().getFullYear();
  var goals=S.smartGoals.filter(function(g){ return Number(g.year)===year; });
  var h='<option value=""'+(!sel?' selected':'')+'>'+esc(t('No goal'))+'</option>';
  goals.forEach(function(g){ h+='<option value="'+esc(g.id)+'"'+(sel===g.id?' selected':'')+'>'+esc(g.title)+'</option>'; });
  return h;
}
function taskRowHtml_(x){
  var g=x.goalId ? goalById_(x.goalId) : null;
  var today=tkToday_();
  var meta=[];
  if(x.due) meta.push('<span class="tkDue'+(!x.done && x.due<today?' late':'')+'">'+esc(tkDateLabel_(x.due))+'</span>');
  if(g) meta.push('<span class="tkGoal">🎯 '+esc(g.title)+'</span>');
  if(x.notes) meta.push('<span class="tkNote">'+esc(x.notes)+'</span>');
  return '<div class="tkRow'+(x.done?' done':'')+'" data-taskrow="'+esc(x.id)+'">'+
    '<button class="tkCheck'+(x.done?' on':'')+'" data-taskdone="'+esc(x.id)+'" aria-label="'+esc(t(x.done?'Not done yet':'Done'))+'">'+(x.done?'✓':'')+'</button>'+
    '<button class="tkBody" data-taskedit="'+esc(x.id)+'"><span class="tkTitle">'+esc(x.title)+'</span>'+
    (meta.length?'<span class="tkMeta">'+meta.join(' · ')+'</span>':'')+'</button></div>';
}
function taskFormHtml_(d){
  return '<div class="tkEdit">'+
    '<input type="text" id="tk_title" maxlength="200" value="'+esc(d.title||'')+'" placeholder="'+esc(t('Task'))+'">'+
    '<textarea id="tk_notes" maxlength="500" rows="2" placeholder="'+esc(t('Details (optional)'))+'">'+esc(d.notes||'')+'</textarea>'+
    '<div class="tkEditRow"><input type="date" id="tk_due" value="'+esc(d.due||'')+'" aria-label="'+esc(t('Due date'))+'">'+
    '<select id="tk_goal" aria-label="'+esc(t('Goal'))+'">'+taskGoalOptions_(d.goalId||'')+'</select></div>'+
    '<div class="tkEditRow"><button class="btn small" id="tkSaveBtn">'+esc(t('Save'))+'</button>'+
    '<button class="linkbtn inline" id="tkCancelBtn">'+esc(t('Cancel'))+'</button>'+
    '<span style="flex:1"></span><button class="danger" id="tkDeleteBtn">'+esc(t('Delete'))+'</button></div></div>';
}
function tasksTabHtml_(){
  var year=new Date().getFullYear();
  var filter=S.taskFilter||'all';
  var goals=S.smartGoals.filter(function(g){ return Number(g.year)===year; });
  if(filter!=='all' && filter!=='other' && !goalById_(filter)) filter='all';
  var all=S.tasks||[];
  var h='<div class="catChips tkChips">'+
    '<button class="catChip'+(filter==='all'?' on':'')+'" data-taskfilter="all">'+esc(t('All'))+'</button>'+
    goals.map(function(g){ return '<button class="catChip'+(filter===g.id?' on':'')+'" data-taskfilter="'+esc(g.id)+'">🎯 '+esc(g.title.length>22?g.title.slice(0,21)+'…':g.title)+'</button>'; }).join('')+
    (all.some(function(x){ return !x.goalId; }) ? '<button class="catChip'+(filter==='other'?' on':'')+'" data-taskfilter="other">'+esc(t('Other tasks'))+'</button>' : '')+
    '</div>';
  var list=all.filter(function(x){
    if(filter==='all') return true;
    if(filter==='other') return !x.goalId;
    return x.goalId===filter;
  });
  var fg=goalById_(filter);
  if(fg) h+='<div class="card slim tkGoalHead"><div class="smartTitle" style="margin:0">🎯 '+esc(fg.title)+'</div><div class="bar" style="margin-top:6px"><div class="barFill'+(fg.pct>=100?' done':'')+'" style="width:'+fg.pct+'%"></div></div><div class="pmeta">'+esc(smartProgressLine_(fg))+'</div></div>';

  /* add a task: type and press Enter — the date and goal are there if you want them */
  var nd=S.taskNew||{title:'', due:'', goalId:(fg?fg.id:'')};
  h+='<div class="card tkAddCard"><div class="tkAdd"><span class="tkPlus">＋</span>'+
    '<input type="text" id="taskNewTitle" maxlength="200" value="'+esc(nd.title||'')+'" placeholder="'+esc(t('Add a task'))+'" autocomplete="off">'+
    '<button class="btn small" id="taskAddBtn">'+esc(t('Add'))+'</button></div>'+
    '<div class="tkEditRow"><input type="date" id="taskNewDue" value="'+esc(nd.due||'')+'" aria-label="'+esc(t('Due date'))+'">'+
    (fg ? '' : '<select id="taskNewGoal" aria-label="'+esc(t('Goal'))+'">'+taskGoalOptions_(nd.goalId||'')+'</select>')+'</div></div>';

  var today=tkToday_();
  var open=list.filter(function(x){ return !x.done; });
  var done=list.filter(function(x){ return x.done; }).sort(function(a,b){ return (b.doneAt||'')<(a.doneAt||'') ? -1 : 1; });
  var byDue=function(a,b){ if((a.due||'')!==(b.due||'')) return (a.due||'')<(b.due||'') ? -1 : 1; return (a.order||0)-(b.order||0); };
  var secs=[
    [t('Overdue'), open.filter(function(x){ return x.due && x.due<today; }).sort(byDue), 'late'],
    [t('Today'), open.filter(function(x){ return x.due===today; }).sort(byDue), ''],
    [t('Upcoming'), open.filter(function(x){ return x.due && x.due>today; }).sort(byDue), ''],
    [t('No date'), open.filter(function(x){ return !x.due; }).sort(byDue), '']
  ];
  var any=false;
  h+='<div class="card tkList">';
  secs.forEach(function(sec){
    if(!sec[1].length) return;
    any=true;
    h+='<div class="tkSecHead'+(sec[2]?' '+sec[2]:'')+'">'+esc(sec[0])+' <span class="tkCount">'+sec[1].length+'</span></div>';
    sec[1].forEach(function(x){ h+= S.taskEdit===x.id ? taskFormHtml_(S.taskEditDraft||x) : taskRowHtml_(x); });
  });
  if(!any) h+='<p class="sub" style="margin:4px 0">'+esc(all.length ? t('All done here. Add the next thing above.') : t('Nothing here yet. Add a task above — link it to a goal and the goal moves as you tick it off.'))+'</p>';
  if(done.length){
    h+='<button class="tkDoneToggle" id="tasksDoneToggle">'+esc(gpT('Completed ({n})',{n:done.length}))+' <span class="chev">'+(S.tasksDoneOpen?'▴':'▾')+'</span></button>';
    if(S.tasksDoneOpen){
      done.forEach(function(x){ h+= S.taskEdit===x.id ? taskFormHtml_(S.taskEditDraft||x) : taskRowHtml_(x); });
      h+='<button class="linkbtn inline" id="tasksClearDone" style="margin-top:8px">'+esc(t('Clear completed'))+'</button>';
    }
  }
  h+='</div>';
  return h;
}

/* Who you mentor, and who mentors you — from the redesign mockup. The data
   already exists (S.mentees from getMyMentees, S.me.mentorId from the
   profile); this just gives it a home on My Home instead of only living
   on Team. Tapping a mentee opens their page the same way Team's directory
   does — it just also has to switch tabs to get there. */
/* A 1-on-1 icon button next to a mentor/mentee row — either side of the
   relationship can ask the other for a 1-on-1, so this shows up in both
   "You're Mentoring" and "Your Mentor". Suppressed once a request between
   these two is already pending, so the row can't be double-tapped. */
function oneOnOneBtnHtml(personId){
  var open=(S.oneOnOnes||[]).filter(function(o){ return o.otherId===personId && ooOpen_(o); })[0];
  if(open) return '<button class="openBtn ooHas" data-ooopen="'+esc(open.id)+'" aria-label="'+esc(t('Open the 1-on-1'))+'">☕<i class="ooBadge"></i></button>';
  return '<button class="openBtn" data-request121="'+esc(personId)+'" aria-label="'+esc(t('Set up a 1-on-1'))+'">☕</button>';
}

/* My Home's Mentorship card: a short summary — who mentors you, how many you
   mentor, what is waiting — that opens the Mentorship page, where everything
   about mentoring and 1-on-1s lives (Oct 2026, Uriah: "one area for easy access"). */
function mentorWaitingN_(){
  var oo=(S.oneOnOnes||[]).filter(function(o){ return !o.mine && o.status==='pending'; }).length;
  return oo+(S.mentorRequests||[]).length+(S.tripRequests||[]).length+((S.stuMentor && S.stuMentor.requests)||[]).length;
}
function mentorshipCardHtml(){
  var h='<h3 id="sec-mentor">'+esc(t('Mentorship'))+'</h3><div class="card mentorSum">';
  var waiting=mentorWaitingN_(), coming=(S.oneOnOnes||[]).filter(function(o){ return ooOpen_(o) && !(o.status==='pending' && !o.mine); }).length;
  if(S.me.mentorId){
    var m=personOf(S.me.mentorId);
    h+='<div class="mentorLabel">'+esc(t('Your Mentor'))+'</div><div class="mentorBlock" style="padding-bottom:8px">'+avatarHtml(m||{name:nameOf(S.me.mentorId)},'sm')+
      '<div style="flex:1"><div class="mentorName">'+esc(m?m.name:nameOf(S.me.mentorId))+'</div>'+ooMonthHtml_(S.me.id)+'</div></div>';
  } else h+='<div class="emptyLine" style="margin-bottom:8px">'+esc(t('No mentor set yet.'))+'</div>';
  if(S.mentees && S.mentees.length) h+='<div class="mentorSumLine">🤝 '+esc(S.mentees.length===1 ? t("You're mentoring 1 person") : gpT("You're mentoring {n} people",{n:S.mentees.length}))+'</div>';
  if(waiting) h+='<div class="mentorSumLine warn">🔔 '+esc(waiting===1 ? t('1 request waiting for you') : gpT('{n} requests waiting for you',{n:waiting}))+'</div>';
  if(coming) h+='<div class="mentorSumLine">☕ '+esc(coming===1 ? t('1 1-on-1 coming up') : gpT('{n} 1-on-1s coming up',{n:coming}))+'</div>';
  return h+'<button class="btn'+(waiting?'':' ghost')+'" id="goMentorshipHome" data-gomentorship="1" style="margin:8px 0 0">🤝 '+esc(t('Open Mentorship'))+' ›</button></div>';
}

/* ---------- 1-on-1s (Oct 2026) ----------
   Uriah: every mentee should have at least two 1-on-1s a month, and each one
   should have a little structure. The mentee fills in a short check-in when
   they ask for one (or right after accepting one): six areas of life and YWAM GP's
   five values — FIGHT: Faithful, Innovative, Generous, Humble, Tenacious —
   each 1-5, plus what they'd like help with and what they're working toward.
   The mentor sees it beside their goals and last time's follow-ups, then marks
   the 1-on-1 done with notes and things to follow up next time. A month counts
   by the day it was held (heldOn). Only the pair ever sees the words (api.js). */
var OO_AREAS=[ {id:'money',emoji:'💰',label:'Fundraising & finances'}, {id:'language',emoji:'🗣️',label:'Language study'},
  {id:'physical',emoji:'💪',label:'Physical health'}, {id:'emotional',emoji:'💛',label:'Emotional health'},
  {id:'relational',emoji:'🤝',label:'Relationships'}, {id:'spiritual',emoji:'🙏',label:'Spiritual life'} ];
/* YWAM GP's values, FIGHT — v2 (Oct 2026, with Uriah): each with its statement, three
   "I…" behaviours to rate yourself against, a verse and a guardrail (what it is
   not). English and YWAM GP's Khmer side by side rather than through t(): the Khmer
   names are YWAM GP's own and stay as they are (ការចុះចូល — submitting to and
   honouring one another). They build on each other: OO_FLOW. */
var OO_FLOW={ en:"They build on each other: start with yourself (Faithful), keep improving (Innovative), from a heart to serve (Generous), open to correction (Humble), and never give up (Tenacious).", km:"ចាប់ផ្តើមពីខ្លួនឯង (ស្មោះត្រង់) → បន្តរីកចម្រើន (គំនិតច្នៃប្រឌិត) → ឱ្យសេចក្តីស្រឡាញ់ជំរុញចិត្ត (សប្បុរស) → ទទួលយកការកែតម្រូវ (ការចុះចូល) → ស្តាប់ ស្តាប់បង្គាប់ ហើយកុំបោះបង់ (ការខិតខំប្រឹងប្រែង)។" };
var OO_VALUES=[
  { id:'faithful', letter:'F', label:"Faithful", km:"ស្មោះត្រង់",
    say:"We’re committed to living disciplined lives, responsible for how we steward our time, talents and treasures, to stay healthy for the long term. Change starts with us: we look honestly at ourselves before we judge anyone else.",
    sayKm:"យើងប្តេជ្ញាចិត្តក្នុងការរស់នៅប្រកបដោយវិន័យ និងទទួលខុសត្រូវចំពោះ ពេលវេលា សមត្ថភាព និងទ្រព្យសម្បត្តិរបស់យើង ដើម្បីរក្សាសុខភាពល្អបានយូរអង្វែង។ ការផ្លាស់ប្តូរចាប់ផ្តើមពីយើង៖ យើងពិនិត្យមើលខ្លួនឯងដោយស្មោះត្រង់ មុននឹងវិនិច្ឆ័យអ្នកដទៃ។",
    does:["I change what I can in myself before I critique others.", "I’m on time, and I finish what I said I’d do.", "I lead myself well (rest, health, self-control), even when no one is watching."],
    doesKm:["ខ្ញុំផ្លាស់ប្តូរអ្វីដែលខ្ញុំអាចផ្លាស់ប្តូរបាននៅក្នុងខ្លួនខ្ញុំ មុននឹងរិះគន់អ្នកដទៃ។", "ខ្ញុំមកទាន់ពេល ហើយខ្ញុំធ្វើឱ្យចប់ នូវអ្វីដែលខ្ញុំបាននិយាយថានឹងធ្វើ។", "ខ្ញុំដឹកនាំខ្លួនឯងបានល្អ (ការសម្រាក សុខភាព និងការគ្រប់គ្រងខ្លួនឯង) ទោះបីជាគ្មាននរណាម្នាក់មើលឃើញក៏ដោយ។"],
    verse:"Luke 16:10 — Whoever is faithful in small things will be faithful in big things.", verseKm:"លូកា ១៦:១០ — អ្នកណាដែលស្មោះត្រង់ក្នុងរឿងតូច ក៏នឹងស្មោះត្រង់ក្នុងរឿងធំដែរ។",
    not:"Not perfectionism or burnout. Faithful is steady, not frantic, and rest is part of it. Honest self-evaluation, never self-condemnation.", notKm:"មិនមែនជាការចង់បានភាពល្អឥតខ្ចោះ ឬការធ្វើការរហូតដល់អស់កម្លាំងទេ។ ស្មោះត្រង់ មានភាពនឹងនរ មិនប្រញាប់ប្រញាល់ ហើយការសម្រាកក៏ជាផ្នែកមួយរបស់វា។ ពិនិត្យខ្លួនឯងដោយស្មោះត្រង់ តែមិនដាក់ទោសខ្លួនឯងទេ។" },
  { id:'innovative', letter:'I', label:"Innovative", km:"គំនិតច្នៃប្រឌិត",
    say:"We use systems and technology, from social media to AI, to maximize organizational clarity, unity and impact, so more people are reached and discipled. We never settle for comfortable; we keep improving.",
    sayKm:"យើងប្រើប្រាស់ប្រព័ន្ធទំនើប និងបច្ចេកវិទ្យា ចាប់ពីបណ្តាញសង្គម រហូតដល់បញ្ញាសិប្បនិម្មិត ដើម្បីបង្កើនភាពច្បាស់លាស់ ការរួបរួម និងឥទ្ធិពលរបស់យើង ដើម្បីឱ្យមនុស្សកាន់តែច្រើន បានឮដំណឹងល្អ និងក្លាយជាសិស្សរបស់ព្រះយេស៊ូវ។ យើងមិនដែលស្កប់ចិត្តនឹងភាពស្រួលស្រាលទេ យើងបន្តកែលម្អជានិច្ច។",
    does:["I learn and use the tools we have (the app, social media, AI) to serve the mission.", "I don’t settle for comfortable. I look for one thing to do better.", "I try a new idea before I say no."],
    doesKm:["ខ្ញុំរៀន និងប្រើឧបករណ៍ដែលយើងមាន (កម្មវិធី បណ្តាញសង្គម និង AI) ដើម្បីបម្រើបេសកកម្ម។", "ខ្ញុំមិនស្កប់ចិត្តនឹងភាពស្រួលទេ។ ខ្ញុំរកមើលរឿងមួយ ដែលខ្ញុំអាចធ្វើបានល្អជាងមុន។", "ខ្ញុំសាកល្បងគំនិតថ្មី មុននឹងនិយាយថា ទេ។"],
    verse:"Isaiah 43:19 — See, I am doing a new thing.", verseKm:"អេសាយ ៤៣:១៩ — ព្រះមានបន្ទូលថា ទ្រង់កំពុងធ្វើការថ្មីមួយ។",
    not:"Not tech for its own sake, or change for change’s sake. Tools serve people and the mission.", notKm:"មិនមែនជាការប្រើបច្ចេកវិទ្យា ដើម្បីតែបច្ចេកវិទ្យា ឬការផ្លាស់ប្តូរ ដើម្បីតែការផ្លាស់ប្តូរទេ។ ឧបករណ៍ត្រូវបម្រើមនុស្ស និងបេសកកម្ម។" },
  { id:'generous', letter:'G', label:"Generous", km:"សប្បុរស",
    say:"We give sacrificially of our time, talents and treasures, and love others as ourselves. Nation over location: we protect unity across YWAM GP and the wider Church over growing our own ministry.",
    sayKm:"យើងលះបង់ពេលវេលា សមត្ថភាព និងទ្រព្យសម្បត្ដិរបស់យើង ហើយស្រឡាញ់អ្នកដទៃដូចស្រឡាញ់ខ្លួនយើង។ ផ្តល់អាទិភាពដល់ប្រទេសលើតំបន់៖ យើងការពារការរួបរួមនៅ YWAM GP និងនៅក្នុងពួកជំនុំរបស់ព្រះគ្រីស្ទទាំងមូល ជាជាងពង្រីកកិច្ចការបម្រើផ្ទាល់ខ្លួនរបស់យើង។",
    does:["I welcome people (guests, teams, new staff) like family.", "I put YWAM GP’s unity and the bigger mission over growing my own ministry.", "I share what I have (time, skills and money), even when it costs me."],
    doesKm:["ខ្ញុំស្វាគមន៍មនុស្ស (ភ្ញៀវ ក្រុមនានា និងបុគ្គលិកថ្មី) ដូចជាក្រុមគ្រួសារ។", "ខ្ញុំផ្តល់អាទិភាពដល់ការរួបរួមរបស់ YWAM GP និងបេសកកម្មដ៏ធំ លើការពង្រីកកិច្ចការបម្រើផ្ទាល់ខ្លួនរបស់ខ្ញុំ។", "ខ្ញុំចែករំលែកអ្វីដែលខ្ញុំមាន (ពេលវេលា ជំនាញ និងលុយ) ទោះបីជាវាធ្វើឱ្យខ្ញុំខាតក៏ដោយ។"],
    verse:"Acts 4:32 — All the believers were one in heart and mind, and shared everything they had.", verseKm:"កិច្ចការ ៤:៣២ — អ្នកជឿទាំងអស់មានចិត្ត និងគំនិតតែមួយ ហើយពួកគេចែករំលែកអ្វីៗទាំងអស់ដែលពួកគេមាន។",
    not:"Not giving to be seen, or saying yes to everything. Generous people still keep healthy limits.", notKm:"មិនមែនជាការឱ្យ ដើម្បីឱ្យគេមើលឃើញ ឬការឆ្លើយព្រមគ្រប់រឿងទេ។ មនុស្សសប្បុរស នៅតែរក្សាព្រំដែនដែលល្អ។" },
  { id:'humble', letter:'H', label:"Humble", km:"ការចុះចូល",
    say:"We submit to one another and practice radical honesty: living transparently and vulnerably, even about our sexuality and our finances, and asking for feedback regularly. We walk in the light: not hiding, but being known.",
    sayKm:"យើងចុះចូលនឹងគ្នាទៅវិញទៅមក ហើយក្លាហានក្នុងការនិយាយ និងទទួលយកការពិតនៅក្នុងជីវិត៖ យើងរស់នៅដោយបើកចំហ និងមិនលាក់បាំង សូម្បីតែអំពីផ្លូវភេទ និងហិរញ្ញវត្ថុរបស់យើង ហើយសុំមតិកែលម្អជាប្រចាំ។ ដូចនៅក្នុង ១យ៉ូហាន ជំពូក ១ យើងដើរក្នុងពន្លឺ៖ មិនលាក់ខ្លួនទេ តែឱ្យគេស្គាល់យើង។",
    does:["I’m open about my life, including my sexuality and finances, with my mentor and my community.", "I ask for feedback and receive correction without defending myself.", "I ask questions more than I give opinions, and I’d rather be real than right."],
    doesKm:["ខ្ញុំបើកចំហអំពីជីវិតរបស់ខ្ញុំ រួមទាំងផ្លូវភេទ និងហិរញ្ញវត្ថុ ជាមួយអ្នកណែនាំ និងសហគមន៍របស់ខ្ញុំ។", "ខ្ញុំសុំមតិកែលម្អ ហើយទទួលយកការកែតម្រូវ ដោយមិនការពារខ្លួន។", "ខ្ញុំសួរសំណួរច្រើនជាងឱ្យយោបល់ ហើយខ្ញុំចង់ជាខ្លួនឯងពិតៗ ជាជាងចង់ជាអ្នកត្រូវ។"],
    verse:"1 John 1:7 — If we walk in the light, we have fellowship with one another.", verseKm:"១យ៉ូហាន ១:៧ — បើយើងដើរក្នុងពន្លឺ យើងមានសេចក្តីប្រកបជាមួយគ្នាទៅវិញទៅមក។",
    not:"Not shaming, or calling people out in public, and not putting yourself down. Openness is safe, private and full of grace.", notKm:"មិនមែនជាការធ្វើឱ្យគេអាម៉ាស់ ការចង្អុលកំហុសគេនៅមុខមនុស្ស ឬការមើលងាយខ្លួនឯងទេ។ ការបើកចំហ មានសុវត្ថិភាព ជារឿងឯកជន និងពោរពេញដោយព្រះគុណ។" },
  { id:'tenacious', letter:'T', label:"Tenacious", km:"ការខិតខំប្រឹងប្រែង",
    say:"We’re driven by love to become all God has created us to be and accomplish all he’s called us to do. We hear and obey, and we don’t give up: grit, passion and perseverance for the long haul.",
    sayKm:"យើងត្រូវបានជំរុញដោយសេចក្តីស្រឡាញ់ ដើម្បីអភិវឌ្ឍខ្លួនឯង ឱ្យក្លាយជាមនុស្សដែលព្រះបានបង្កើតយើងមក និងសម្រេចបាននូវអ្វីដែលទ្រង់បានត្រាស់ហៅយើងឱ្យធ្វើ។ យើងស្តាប់ ហើយស្តាប់បង្គាប់ ហើយយើងមិនបោះបង់ទេ៖ ចិត្តតស៊ូ ចិត្តស្រឡាញ់យ៉ាងខ្លាំង និងការព្យាយាមជាប់លាប់ សម្រាប់ផ្លូវវែង។",
    does:["I listen to God and do what he says, even when it’s hard.", "I keep going through hard seasons and finish what God gave me.", "I keep growing, reading and learning, so my life bears fruit."],
    doesKm:["ខ្ញុំស្តាប់ព្រះ ហើយធ្វើតាមអ្វីដែលទ្រង់មានបន្ទូល ទោះបីជាវាពិបាកក៏ដោយ។", "ខ្ញុំបន្តទៅមុខ ឆ្លងកាត់រដូវដ៏ពិបាក ហើយបញ្ចប់អ្វីដែលព្រះបានប្រគល់ឱ្យខ្ញុំ។", "ខ្ញុំបន្តរីកលូតលាស់ អាន និងរៀន ដើម្បីឱ្យជីវិតរបស់ខ្ញុំបង្កើតផល។"],
    verse:"Galatians 6:9 — Don’t grow weary of doing good; at the right time we will reap, if we don’t give up.", verseKm:"កាឡាទី ៦:៩ — កុំណាយចិត្តក្នុងការធ្វើល្អឡើយ ព្រោះដល់ពេលកំណត់ យើងនឹងច្រូតកាត់ផល បើយើងមិនបោះបង់។",
    not:"Not stubbornness or workaholism. Grit listens to God, rests, and changes course when he says so.", notKm:"មិនមែនជាភាពរឹងរូស ឬការញៀនការងារទេ។ ចិត្តតស៊ូ ស្តាប់ព្រះ សម្រាក ហើយប្តូរទិសដៅ ពេលទ្រង់មានបន្ទូលប្រាប់។" }
];
function ooValName_(v){ return LANG==='km' ? v.km : v.label; }
var OO_PER_MONTH=2;
function ooById_(id){ return (S.oneOnOnes||[]).filter(function(o){ return o.id===id; })[0]||null; }
function ooHeldThisMonth_(menteeId){
  var m=todayStr().slice(0,7);
  return (S.oneOnOnes||[]).filter(function(o){ return o.status==='held' && o.menteeId===menteeId && String(o.heldOn||'').slice(0,7)===m; }).length;
}
/* ●○ 1 of 2 1-on-1s this month */
function ooMonthHtml_(menteeId){
  var n=ooHeldThisMonth_(menteeId), dots='', ok=n>=OO_PER_MONTH;
  for(var i=0;i<Math.max(OO_PER_MONTH,n);i++) dots+='<i class="ooDot'+(i<n?' on':'')+'"></i>';
  return '<div class="ooMonth'+(ok?' ok':'')+'">'+dots+'<span class="ooTxt">'+
    esc(ok ? gpT('{n} 1-on-1s this month ✓',{n:n}) : gpT('{n} of {target} 1-on-1s this month',{n:n,target:OO_PER_MONTH}))+'</span></div>';
}
/* How a mentee is doing with THEIR 1-on-1s (Nov 2026, Uriah): for a mentee who mentors other people, getMyMentees (and
   the boot's mentees) carries `oo` = { held, met, people:[{id, name (first name), held}] } for this month — counts and
   first names only. One quiet line on Mentorship's row; the short list on the mentee's own page. Nothing for a mentee who
   mentors nobody. */
function ooTheirsOf_(menteeId){
  var m=(S.mentees||[]).filter(function(p){ return p.id===menteeId; })[0];
  return m && m.oo && m.oo.people && m.oo.people.length ? m.oo : null;
}
function ooTheirsLineHtml_(menteeId){
  var o=ooTheirsOf_(menteeId); if(!o) return '';
  var n=o.people.length;
  return '<span class="ooTheirs" data-ootheirs="'+esc(menteeId)+'">'+esc(n===1
    ? gpT('Their 1-on-1s this month: {held} held with their 1 person',{held:o.held})
    : gpT('Their 1-on-1s this month: {held} held with {met} of {n} people',{held:o.held, met:o.met, n:n}))+'</span>';
}
function ooTheirsListHtml_(m){
  var o=ooTheirsOf_(m.id); if(!o) return '';
  var first=String(m.name||'').split(' ')[0];
  return '<h3 id="ooTheirs">🤝 '+esc(gpT('{name}’s own 1-on-1s this month',{name:first}))+' <small>· '+o.held+'</small></h3><div class="card">'+
    '<p class="sub" style="margin:0 0 6px">'+esc(gpT('The people {name} mentors, and the 1-on-1s {name} has held with each this month. Only the count — what they talked about stays between the two of them.',{name:first}))+'</p>'+
    o.people.map(function(x){
      var dots='', ok=x.held>=OO_PER_MONTH;
      for(var i=0;i<Math.max(OO_PER_MONTH, x.held);i++) dots+='<i class="ooDot'+(i<x.held?' on':'')+'"></i>';
      return '<div class="ooTheirsRow" data-ootheirsrow="'+esc(x.id)+'"><span class="ooTheirsName">'+esc(x.name)+'</span><span class="ooMonth'+(ok?' ok':'')+'" style="margin:0">'+dots+
        '<span class="ooTxt">'+esc(ok ? gpT('{n} of {target} ✓',{n:x.held, target:OO_PER_MONTH}) : gpT('{n} of {target}',{n:x.held, target:OO_PER_MONTH}))+'</span></span></div>'; }).join('')+'</div>';
}
/* A 1-on-1's day on Cambodia's calendar: the day it was held, else the day it was
   asked. heldOn is a Phnom Penh date already; `created` is a UTC timestamp, whose
   first ten characters are the UTC date — between midnight and 7am that was
   yesterday, so a request made just now sorted (and showed) before one held today. */
function ooDay_(o){
  if(o.heldOn) return o.heldOn;
  var c=String(o.created||''); if(!c) return '';
  var d=new Date(new Date(c).getTime()+7*3600000);
  return isNaN(d) ? c.slice(0,10) : d.toISOString().slice(0,10);
}
/* every 1-on-1 of one mentee, newest first (by the day held, else asked) */
function ooPairRows_(menteeId){
  var key=function(o){ return ooDay_(o)+'|'+(o.created||''); };
  return (S.oneOnOnes||[]).filter(function(o){ return o.menteeId===menteeId && o.status!=='declined'; })
    .sort(function(a,b){ return key(a)<key(b) ? 1 : -1; });
}
function ooOpen_(o){ return o.status==='pending' || o.status==='accepted'; }
function ooLastPrep_(menteeId, cur){
  var rows=ooPairRows_(menteeId), k=cur ? rows.indexOf(cur)+1 : 0;
  for(; k<rows.length; k++) if(rows[k].prep) return rows[k].prep;
  return null;
}
function ooLastFollow_(menteeId, cur){
  var rows=ooPairRows_(menteeId), k=cur ? rows.indexOf(cur)+1 : 0;
  for(; k<rows.length; k++) if(rows[k].status==='held' && (rows[k].followUps||[]).length) return rows[k];
  return null;
}
function ooGo_(id, withId, live){
  if(S.view!=='oneonone') S.ooBack=S.view;
  S.view='oneonone'; S.ooId=id||null; S.ooWith=withId||null; S.ooEditPrep=null; S.bellOpen=false;
  S.ooLive=live && id ? id : null; S.ooLogOpen=false; S.ooTimeEdit=null;
  render(); window.scrollTo(0,0);
}
/* The mentee's check-in being written — kept on S so a tap on a 1-5 button
   (which re-renders) never loses what they have typed. */
function ooDraft_(key, from){
  if(!S.ooDrafts) S.ooDrafts={};
  if(!S.ooDrafts[key]){
    var p=from||{};
    S.ooDrafts[key]={ areas:JSON.parse(JSON.stringify(p.areas||{})), values:JSON.parse(JSON.stringify(p.values||{})),
      helpWith:p.helpWith||'', workingOn:p.workingOn||'', other:p.other||'', note:'' };
  }
  return S.ooDrafts[key];
}
/* The notes being written in a 1-on-1 are kept on the phone as they are typed (`gp-oo-notes`, by 1-on-1),
   so closing the app mid-meeting loses nothing; a save that lands drops them. */
function ooNotesStore_(){ var v=null; try { v=JSON.parse(lsGet('gp-oo-notes')||'null'); } catch(e){} return (v && v.u===(S.auth&&S.auth.user) && v.k) ? v : { u:(S.auth&&S.auth.user)||'', k:{} }; }
function ooNotesKeep_(key){ var st=ooNotesStore_(); if(S.ooNotes && S.ooNotes[key]) st.k[key]=S.ooNotes[key]; lsSet('gp-oo-notes', JSON.stringify(st)); }
function ooNotesDrop_(key){ if(S.ooNotes) delete S.ooNotes[key]; var st=ooNotesStore_(); delete st.k[key]; lsSet('gp-oo-notes', JSON.stringify(st)); }
function ooNotesDraft_(key, o){
  if(!S.ooNotes) S.ooNotes={};
  if(!S.ooNotes[key]){ var kept=ooNotesStore_().k[key]; if(kept && Array.isArray(kept.followUps)) S.ooNotes[key]=kept; }
  if(!S.ooNotes[key]){
    S.ooNotes[key]={ heldOn:(o&&o.heldOn)||todayStr(), notes:(o&&o.notes)||'',
      followUps:((o&&o.followUps)||[]).map(function(f){ return f.text; }) };
    if(!S.ooNotes[key].followUps.length) S.ooNotes[key].followUps=[''];
  }
  return S.ooNotes[key];
}
function ooScaleRowHtml_(kind, id, labelHtml, val){
  var b=''; for(var n=1;n<=5;n++) b+='<button type="button" data-'+kind+'="'+id+'|'+n+'" class="'+(val===n?'on':'')+'" aria-label="'+n+'">'+n+'</button>';
  return '<div class="ooQ"><div class="ooQLabel">'+labelHtml+'</div><div class="scale ooScale">'+b+'</div></div>';
}
function ooPrepFormHtml_(key, d){
  var h='<p class="sub" style="margin:2px 0 6px">'+esc(t('A quick, honest check-in, so your 1-on-1 can focus on what matters. 1 = struggling · 5 = thriving.'))+'</p>';
  h+='<div class="mentorLabel" style="margin-top:8px">'+esc(t('How I’m doing'))+'</div>';
  OO_AREAS.forEach(function(a){ h+=ooScaleRowHtml_('ooarea', a.id, a.emoji+' '+esc(t(a.label)), d.areas[a.id]); });
  h+='<div class="mentorLabel" style="margin-top:14px">'+esc(t('Living our values — FIGHT'))+'</div>'+
    '<p class="sub ooFlow">'+esc(LANG==='km' ? OO_FLOW.km : OO_FLOW.en)+'</p>';
  OO_VALUES.forEach(function(v){
    var km=LANG==='km', b=''; for(var n=1;n<=5;n++) b+='<button type="button" data-ooval="'+v.id+'|'+n+'" class="'+(d.values[v.id]===n?'on':'')+'" aria-label="'+n+'">'+n+'</button>';
    h+='<div class="ooQ ooQv"><div class="ooQLabel"><b class="ooLetter">'+v.letter+'</b>'+esc(ooValName_(v))+'</div>'+
      '<div class="ooVSay">'+esc(km ? v.sayKm : v.say)+'</div>'+
      '<ul class="ooBeh">'+(km ? v.doesKm : v.does).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>'+
      '<details class="ooMore"><summary>📖 '+esc(t('Verse · what it isn’t'))+'</summary>'+
        '<div class="ooVerse">'+esc(km ? v.verseKm : v.verse)+'</div><div class="ooNot">🚧 '+esc(km ? v.notKm : v.not)+'</div></details>'+
      '<div class="scale ooScale">'+b+'</div></div>';
  });
  h+='<label class="f" style="margin-top:14px">'+esc(t('Is there anything specific you’d like help with?'))+'</label>'+
    '<textarea data-oodraft="helpWith" maxlength="600" rows="2">'+esc(d.helpWith)+'</textarea>'+
    '<label class="f">'+esc(t('What are you working toward right now? (your personal goals)'))+'</label>'+
    '<textarea data-oodraft="workingOn" maxlength="600" rows="2">'+esc(d.workingOn)+'</textarea>'+
    '<label class="f">'+esc(t('Anything else your mentor should know? (optional)'))+'</label>'+
    '<textarea data-oodraft="other" maxlength="600" rows="2">'+esc(d.other)+'</textarea>';
  return h;
}
function ooTrendHtml_(n, was){
  if(!was || !n || n===was) return '';
  return '<span class="ooTrend '+(n>was?'up':'down')+'">'+(n>was?'▲':'▼')+Math.abs(n-was)+'</span>';
}
function ooPrepSummaryHtml_(p, prev){
  prev=prev||{areas:{},values:{}};
  var h='<div class="mentorLabel">'+esc(t('How I’m doing'))+'</div>';
  OO_AREAS.forEach(function(a){
    var n=p.areas&&p.areas[a.id], segs='';
    for(var i=1;i<=5;i++) segs+='<i class="'+(n&&i<=n?'on s'+(n<=2?'lo':n===3?'mid':'hi'):'')+'"></i>';
    h+='<div class="ooSum"><span class="ooSumLabel">'+a.emoji+' '+esc(t(a.label))+'</span><span class="ooSegs">'+segs+'</span>'+
      '<span class="ooSumN">'+(n?n+'/5':'—')+ooTrendHtml_(n, prev.areas&&prev.areas[a.id])+'</span></div>';
  });
  h+='<div class="mentorLabel" style="margin-top:12px">'+esc(t('Living our values — FIGHT'))+'</div><div class="ooVals">';
  OO_VALUES.forEach(function(v){
    var n=p.values&&p.values[v.id];
    h+='<div class="ooVal'+(n&&n<=2?' lo':'')+'"><b>'+v.letter+'</b><span>'+(n||'—')+ooTrendHtml_(n, prev.values&&prev.values[v.id])+'</span><small>'+esc(ooValName_(v))+'</small></div>';
  });
  h+='</div>';
  [['helpWith','Would like help with'],['workingOn','Working toward'],['other','Also']].forEach(function(q){
    if(p[q[0]]) h+='<div class="ooQuoteLabel">'+esc(t(q[1]))+'</div><div class="ooQuote">'+esc(p[q[0]])+'</div>';
  });
  return h;
}
function ooNotesFormHtml_(key){
  var d=ooNotesDraft_(key, key.indexOf('new:')===0 ? null : ooById_(key));
  var h='<label class="f">'+esc(t('Date you met'))+'</label><input type="date" id="ooHeldOn" max="'+todayStr()+'" value="'+esc(d.heldOn)+'">'+
    '<label class="f">'+esc(t('Notes'))+'</label>'+
    '<textarea data-oonote="notes" maxlength="2000" rows="4" placeholder="'+esc(t('What did you talk about? What stood out?'))+'">'+esc(d.notes)+'</textarea>'+
    '<label class="f">'+esc(t('To follow up next time'))+'</label>';
  d.followUps.forEach(function(f,i){
    h+='<input type="text" class="ooFuIn" maxlength="200" data-oofu="'+i+'" value="'+esc(f)+'" placeholder="'+esc(t('Something they are growing in, or will try'))+'">';
  });
  if(d.followUps.length<10) h+='<button class="linkbtn inline" id="ooFuAdd" style="display:block;margin:4px 0 8px">＋ '+esc(t('Add another'))+'</button>';
  return h+'<p class="hint" style="margin-top:6px">🔒 '+esc(t('Only the two of you see the check-in and these notes.'))+'</p>';
}
function ooFollowUpsHtml_(o, canTick){
  return (o.followUps||[]).map(function(f,i){
    return '<button class="ooFu'+(f.done?' done':'')+'"'+(canTick?' data-ootick="'+esc(o.id)+'|'+i+'"':' disabled')+'><span class="ooTick">'+(f.done?'✓':'')+'</span>'+esc(f.text)+'</button>';
  }).join('');
}
function ooStatusHtml_(o){
  if(o.status==='held') return '<span class="pill approved">'+esc(gpT('Done · {date}',{date:fmtDateShort_(o.heldOn)}))+'</span>';
  if(o.status==='accepted') return '<span class="pill approved">'+esc(o.when ? '📅 '+ooWhenNice_(o.when) : t('Accepted'))+'</span>';
  if(o.status==='declined') return '<span class="pill denied">'+esc(t('Declined'))+'</span>';
  return '<span class="pill pending">'+esc(o.mine ? gpT('Sent · waiting for {name}',{name:String(o.otherName||'').split(' ')[0]}) : t('Waiting for you to set a time'))+'</span>';
}
function ooGoalsHtml_(goals){
  var yr=new Date().getFullYear();
  goals=(goals||[]).filter(function(g){ return Number(g.year)===yr; });
  if(!goals.length) return '<p class="sub" style="margin:4px 0">'+esc(t('No goals for this year yet.'))+'</p>';
  return goals.map(function(g){
    return '<div class="smartGoal"><div class="smartTitle">'+esc(g.title)+'</div>'+
      '<div class="bar"><div class="barFill'+(g.pct>=100?' done':'')+'" style="width:'+(g.pct||0)+'%"></div></div>'+
      '<div class="smartActions"><span class="smartPct">'+esc(smartProgressLine_(g))+'</span></div></div>';
  }).join('');
}
/* ---------- a 1-on-1, step by step (Nov 2026, Andrew: "a bit confusing … how asking for a 1 on 1 works …
   fill out the questions before coming into a 1 on 1 … press begin 1 on 1 and add in notes and follow up") ----------
   Five steps, said once on the strip at the top: Ask · Day & time · Check-in · Meet · Done. Under it one card
   says what happens next and holds its one button; the check-in comes before the meeting; and the mentor runs the
   meeting itself — Begin 1-on-1 opens notes and follow-ups (kept on the phone as they are typed), Finish counts it. */
var OO_STEPS=[['ask','Ask'],['time','Day & time'],['prep','Check-in'],['meet','Meet'],['done','Done']];
function ooStepsHtml_(o){
  var held=!!o && o.status==='held';
  var done={ ask:!!o, time:held || !!(o && o.when && o.status!=='pending'), prep:held || !!(o && o.prep), meet:held, done:held };
  var now=-1; OO_STEPS.forEach(function(s,i){ if(now<0 && !done[s[0]]) now=i; });
  return '<ol class="ooSteps" id="ooSteps">'+OO_STEPS.map(function(s,i){
    return '<li class="'+(done[s[0]]?'done':'')+(i===now?' now':'')+'" data-oostep="'+s[0]+'"><span class="ooStepN">'+(done[s[0]]?'✓':(i+1))+'</span><span class="ooStepL">'+esc(t(s[1]))+'</span></li>';
  }).join('')+'</ol>';
}
/* the few lines that say how it works — on the Mentorship page, folded */
function ooHowHtml_(){
  return '<details class="ooHow" id="ooHow"><summary>💡 '+esc(t('How a 1-on-1 works'))+'</summary><ol>'+
    '<li>☕ '+esc(t('Either of you asks, from this page.'))+'</li>'+
    '<li>📅 '+esc(t('The one asked picks a day and time — that is the yes, and the other gets a notification.'))+'</li>'+
    '<li>📝 '+esc(t('Before you meet, the one being mentored answers a short check-in.'))+'</li>'+
    '<li>▶ '+esc(t('When you sit down together, the mentor taps Begin 1-on-1, writes notes and what to follow up, then Finish.'))+'</li>'+
    '</ol><p class="hint" style="margin:6px 0 0">'+esc(t('Two a month is the aim — each one finished counts.'))+'</p></details>';
}
/* The one asking may suggest a day and time (Nov 2026, Andrew); the one asked accepts it with one tap or picks
   another. A suggestion whose day has gone by is treated as none. */
function ooSuggested_(o){ return o && o.status==='pending' && o.when && String(o.when).slice(0,10)>=todayStr() ? o.when : ''; }
function ooSuggestFieldsHtml_(d, first){
  return '<label class="f">'+esc(t('Suggest a day and time (optional)'))+'</label>'+
    '<div class="ooTime"><input type="date" data-oodraft="whenDate" id="ooSugDate" min="'+esc(todayStr())+'" value="'+esc(d.whenDate||'')+'" aria-label="'+esc(t('Day'))+'">'+
    '<input type="time" data-oodraft="whenTime" id="ooSugTime" step="900" value="'+esc(d.whenTime||'')+'" aria-label="'+esc(t('Time'))+'"></div>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(gpT('{name} can accept it, or pick another time. Leave it empty and {name} picks.',{name:first}))+'</p>';
}
/* "accept this time" or "pick another" for a 1-on-1 someone suggested a time for */
function ooSuggestTakeHtml_(o, first){
  var w=ooSuggested_(o);
  var h='<div class="ooLine ooSuggest" data-oosuggest="'+esc(o.id)+'">📅 <b>'+esc(ooWhenNice_(w))+'</b> <span class="pmeta">· '+esc(gpT('{name} suggests this time',{name:first}))+'</span></div>';
  if(S.ooTimeEdit===o.id) return h+'<div class="ooLine">'+esc(t('Pick another day and time:'))+'</div>'+ooTimePickHtml_(o.id, true, w);
  return h+'<div class="ooActsRow"><button class="btn small" data-ooacceptwhen="'+esc(o.id)+'">✓ '+esc(t('Accept this time'))+'</button>'+
    '<button class="linkbtn inline" data-oochange="'+esc(o.id)+'">'+esc(t('Pick another time'))+'</button></div>';
}
function oneOnOneHtml(){
  var o=S.ooId ? ooById_(S.ooId) : null;
  var withId=o ? o.otherId : S.ooWith;
  var who=personOf(withId), name=who ? who.name : (o ? o.otherName : nameOf(withId)), first=String(name||'').split(' ')[0];
  var iMentor=o ? o.iMentor : (S.mentees||[]).some(function(p){ return p.id===withId; });
  var menteeId=o ? o.menteeId : (iMentor ? withId : S.me.id);
  var held=!!o && o.status==='held';
  var live=!!o && iMentor && S.ooLive===o.id && o.status!=='declined' && (o.status!=='pending');
  var h='<button class="linkbtn" id="ooBack" style="text-align:left;text-decoration:none">← '+esc(t('Back'))+'</button>';
  h+='<div class="card ooHead"><div class="mentorBlock" style="padding:0">'+avatarHtml(who||{name:name},'sm')+
    '<div style="flex:1"><div class="mentorName">☕ '+esc(gpT('1-on-1 with {name}',{name:name}))+'</div>'+
    '<div class="mentorMeta">'+esc(iMentor ? gpT('You mentor {name}',{name:first}) : gpT('{name} is your mentor',{name:first}))+'</div>'+
    (o && o.note ? '<div class="mentorMeta">“'+esc(o.note)+'”</div>' : '')+'</div></div>'+
    ooMonthHtml_(menteeId)+'</div>';
  if(!o || o.status!=='declined') h+=ooStepsHtml_(o);

  var last=ooLastFollow_(menteeId, o);
  var lastHtml = last ? '<h3>🔁 '+esc(t('From last time'))+' <small>· '+esc(fmtDateShort_(last.heldOn))+'</small></h3><div class="card">'+
    '<p class="sub" style="margin:0 0 6px">'+esc(t('Things you said you’d follow up — tick what’s done.'))+'</p>'+ooFollowUpsHtml_(last, true)+'</div>' : '';
  var goalsHtml=function(){
    var g='<details class="ooFold" id="ooGoalsFold"><summary>🎯 '+esc(iMentor ? gpT('{name}’s goals this year',{name:first}) : t('Your goals this year'))+'</summary><div class="card">';
    if(iMentor) g+=(S.ooGoalsFor===menteeId && S.ooGoals) ? ooGoalsHtml_(S.ooGoals) : '<p class="sub" style="margin:4px 0">'+esc(t('Loading…'))+'</p>';
    else g+=ooGoalsHtml_(S.smartGoals);
    return g+'</div></details>';
  };

  /* ---- a new one ---- */
  if(!o){
    if(!iMentor){
      var d=ooDraft_('new:'+withId, ooLastPrep_(S.me.id));
      h+='<div class="card ooNext" id="ooNext"><div class="ooNextTitle">☕ '+esc(gpT('Asking {name} for a 1-on-1',{name:first}))+'</div>'+
        '<p class="sub" style="margin:4px 0 0">'+esc(gpT('First answer a few questions. {name} sees them with your request, so your time together can focus on what matters.',{name:first}))+'</p></div>';
      h+='<h3>📝 '+esc(t('Step 1 · Your check-in'))+'</h3><div class="card">'+ooPrepFormHtml_('new:'+withId, d)+'</div>';
      h+='<h3>☕ '+esc(t('Step 2 · Send your request'))+'</h3><div class="card">'+ooSuggestFieldsHtml_(d, first)+
        '<label class="f">'+esc(gpT('A note for {name} (optional)',{name:first}))+'</label>'+
        '<input type="text" data-oodraft="note" maxlength="300" value="'+esc(d.note)+'" placeholder="'+esc(t('e.g. Can we meet this week?'))+'">'+
        '<button class="btn" id="ooSend">☕ '+esc(gpT('Send my request to {name}',{name:first}))+'</button>'+
        '<p class="hint" style="margin:6px 0 0">'+esc(gpT('{name} says yes to the time, or picks one, and you get a notification.',{name:first}))+'</p></div>';
      return h+lastHtml;
    }
    h+='<div class="card ooNext" id="ooNext"><div class="ooNextTitle">☕ '+esc(gpT('Asking {name} for a 1-on-1',{name:first}))+'</div>'+
      '<p class="sub" style="margin:4px 0 8px">'+esc(gpT('{name} gets your request, says yes to a time, and answers a short check-in — you see it before you meet.',{name:first}))+'</p>'+
      ooSuggestFieldsHtml_(ooDraft_('new:'+withId), first)+
      '<button class="btn" id="ooAsk" style="margin:4px 0 0">☕ '+esc(gpT('Send {name} a 1-on-1 request',{name:first}))+'</button></div>';
    h+=lastHtml;
    h+='<details class="ooFold" id="ooLogFold"'+(S.ooLogOpen?' open':'')+'><summary id="ooLogHead">✍️ '+esc(t('Already met without asking here? Log it'))+'</summary><div class="card">'+
      ooNotesFormHtml_('new:'+withId)+'<button class="btn" id="ooLog">'+esc(t('Save this 1-on-1'))+'</button></div></details>';
    return h;
  }

  if(o.status==='declined') return h+'<div class="card ooNext" id="ooNext"><span class="pill denied">'+esc(t('Declined'))+'</span></div>';

  /* ---- the meeting itself (the mentor) ---- */
  if(live){
    h+='<div class="card ooNext ooLiveHead" id="ooLive"><div class="ooNextTitle">🟢 '+esc(held ? gpT('Notes from your 1-on-1 with {name}',{name:first}) : gpT('In your 1-on-1 with {name}',{name:first}))+'</div>'+
      '<p class="sub" style="margin:4px 0 0">'+esc(t('Write as you talk — it is kept on this phone until you save.'))+'</p></div>';
    /* the notes first — that is what the meeting is for — with last time's follow-ups above them and the
       check-in and goals below, to look at while you talk */
    h+=(held ? '' : lastHtml);
    h+='<h3>✍️ '+esc(t('Notes and follow-ups'))+'</h3><div class="card">'+ooNotesFormHtml_(o.id)+
      '<button class="btn" id="ooFinish">'+esc(held ? t('Save changes') : t('✓ Finish 1-on-1'))+'</button>'+
      (held ? '' : '<button class="btn ghost" id="ooSaveLater" style="margin-top:8px">'+esc(t('Save and carry on later'))+'</button>')+
      '<button class="linkbtn inline" id="ooLiveClose" style="display:block;margin:10px auto 0">'+esc(t('Close'))+'</button></div>';
    if(o.prep) h+='<details class="ooFold" id="ooPrepFold" open><summary>📝 '+esc(gpT('{name}’s check-in',{name:first}))+'</summary><div class="card">'+ooPrepSummaryHtml_(o.prep, ooLastPrep_(menteeId, o))+'</div></details>';
    return h+goalsHtml();
  }

  /* ---- what happens next, said once ---- */
  var next='';
  if(o.status==='pending' && !o.mine){
    next='<div class="ooNextTitle">🔔 '+esc(ooAskedYouText_(o))+'</div>'+
      (ooSuggested_(o) ? ooSuggestTakeHtml_(o, first) :
      '<p class="sub" style="margin:4px 0 8px">'+esc(t('Pick a day and time — that says yes, and they get a notification.'))+'</p>'+
      ooTimePickHtml_(o.id, true, ''))+
      '<button class="linkbtn inline" style="color:var(--faint)" data-121decline="'+esc(o.id)+'">'+esc(t('Can’t right now — decline'))+'</button>';
  } else if(o.status==='pending'){
    next=ooSuggested_(o) ?
      '<div class="ooNextTitle">⏳ '+esc(gpT('Waiting for {name} to say yes to your time',{name:first}))+'</div>'+
        '<div class="ooLine">📅 <b>'+esc(ooWhenNice_(o.when))+'</b> <span class="pmeta">· '+esc(t('you suggested it'))+'</span></div>'+
        '<p class="sub" style="margin:4px 0 0">'+esc(t('They can accept it or pick another time. You will get a notification.'))+'</p>' :
      '<div class="ooNextTitle">⏳ '+esc(gpT('Waiting for {name} to pick a day and time',{name:first}))+'</div>'+
      '<p class="sub" style="margin:4px 0 0">'+esc(t('You will get a notification when they do.'))+'</p>';
  } else if(held){
    next='<div class="ooNextTitle">✓ '+esc(gpT('Done · {date}',{date:fmtDateShort_(o.heldOn)}))+'</div>';
  } else {
    if(!o.when || S.ooTimeEdit===o.id){
      next='<div class="ooNextTitle">📅 '+esc(o.when ? t('Pick a new day and time') : t('Pick a day and time'))+'</div>'+ooTimePickHtml_(o.id, false, o.when);
    } else {
      next='<div class="ooNextTitle">📅 '+esc(ooWhenNice_(o.when))+'</div>'+
        '<div class="ooActsRow" style="margin:2px 0 6px"><span class="pmeta">'+esc(o.whenByMe ? t('you set it') : gpT('{name} set it',{name:first}))+'</span>'+
        '<button class="linkbtn inline" data-oochange="'+esc(o.id)+'">'+esc(t('Change the time'))+'</button></div>';
    }
    if(iMentor){
      next+='<div class="ooState">'+(o.prep ? '✓ '+esc(gpT('{name} answered the check-in — it’s below.',{name:first})) : '⏳ '+esc(gpT('{name} hasn’t answered the check-in yet.',{name:first})))+'</div>'+
        '<button class="btn ooBegin" id="ooBegin">▶ '+esc(o.notes || (o.followUps||[]).length ? t('Carry on the 1-on-1') : t('Begin 1-on-1'))+'</button>'+
        '<p class="hint" style="margin:6px 0 0">'+esc(t('When you sit down together: you’ll write notes and what to follow up as you talk.'))+'</p>';
    } else {
      next+='<div class="ooState">'+(o.prep ? '✓ '+esc(t('Your check-in is in.'))+' '+esc(gpT('When you meet, {name} takes the notes — you’ll see them here after.',{name:first})) : '📝 '+esc(t('Before you meet, answer your check-in below.')))+'</div>';
    }
  }
  h+='<div class="card ooNext" id="ooNext">'+next+'</div>';

  /* ---- the check-in ---- */
  if(!iMentor && !held && (!o.prep || S.ooEditPrep===o.id)){
    h+='<h3>📝 '+esc(t('Your check-in — before you meet'))+'</h3><div class="card">'+ooPrepFormHtml_(o.id, ooDraft_(o.id, o.prep || ooLastPrep_(S.me.id, o)))+
      '<button class="btn" id="ooSavePrep" data-id="'+esc(o.id)+'">'+esc(t('Save my check-in'))+'</button></div>';
  } else if(o.prep){
    h+='<h3>📝 '+esc(iMentor ? gpT('{name}’s check-in',{name:first}) : t('Your check-in'))+'</h3><div class="card">'+ooPrepSummaryHtml_(o.prep, ooLastPrep_(menteeId, o))+
      (!iMentor && !held ? '<button class="linkbtn inline" id="ooEditPrep" style="margin-top:10px">✏️ '+esc(t('Change my check-in'))+'</button>' : '')+'</div>';
  }

  /* ---- after: the notes and follow-ups ---- */
  if(held){
    if(o.notes || (o.followUps||[]).length){
      h+='<h3>✍️ '+esc(t('Notes and follow-ups'))+'</h3><div class="card">'+
        (o.notes ? '<div class="ooQuote">'+esc(o.notes)+'</div>' : '')+
        ((o.followUps||[]).length ? '<div class="ooQuoteLabel">'+esc(t('To follow up next time'))+'</div>'+ooFollowUpsHtml_(o, true) : '')+
        (iMentor ? '<button class="linkbtn inline" id="ooEditNotes" style="margin-top:10px">✏️ '+esc(t('Change the notes'))+'</button>' : '')+'</div>';
    } else if(iMentor) h+='<button class="btn ghost" id="ooEditNotes">✏️ '+esc(t('Add notes'))+'</button>';
    return h;
  }
  return h+lastHtml+goalsHtml();
}
/* Who asked whom, in words — "Sokha (who you mentor) is asking you for a
   1-on-1" or "Andrew, your mentor, is asking to meet you". */
function ooAskedYouText_(o){
  return o.iMentor ? gpT('{name}, who you mentor, is asking you for a 1-on-1',{name:o.otherName}) : gpT('{name}, your mentor, is asking to meet you for a 1-on-1',{name:o.otherName});
}
/* One line of a 1-on-1 history: the day, where it stands, a bit of the notes
   and how the follow-ups went. Opens its sheet. */
function ooHistRowHtml_(o){
  var when=ooDay_(o), fu=o.followUps||[], done=fu.filter(function(f){ return f.done; }).length;
  return '<button class="ooRow" data-ooopen="'+esc(o.id)+'"><span class="rowName"><b>'+esc(fmtDateShort_(when))+'</b> '+(o.status==='held' ? '<span class="pill approved">✓ '+esc(t('Done'))+'</span>' : ooStatusHtml_(o))+
    (o.notes ? '<div class="ooTodo" style="color:var(--muted)">'+esc(String(o.notes).slice(0,90))+(o.notes.length>90?'…':'')+'</div>' : '')+
    (fu.length ? '<div class="ooTodo" style="color:var(--faint)">'+esc(gpT('{done} of {n} follow-ups done',{done:done, n:fu.length}))+'</div>' : '')+
    '</span><span class="ooChev">›</span></button>';
}
/* fmtDateShort_ lives in 04-ministry-strengths.js (a second copy here was always overridden by it) */
/* On a mentee's page: this month's count, then their whole 1-on-1 history —
   what's still to happen first, then every one held, newest first. */
function ooMenteeSectionHtml_(m){ return ooMenteeSectionHtml0_(m)+ooTheirsListHtml_(m); }
function ooMenteeSectionHtml0_(m){
  var rows=ooPairRows_(m.id), first=String(m.name||'').split(' ')[0];
  var open=rows.filter(ooOpen_), held=rows.filter(function(o){ return o.status==='held'; });
  var h='<h3 id="ooHistory">☕ '+esc(t('1-on-1 history'))+' <small>· '+held.length+'</small></h3><div class="card">'+ooMonthHtml_(m.id);
  if(open.length) h+='<div class="mentorLabel" style="margin-top:10px">'+esc(t('Coming up'))+'</div>'+open.map(ooHistRowHtml_).join('');
  if(held.length){
    var all=S.ooHistAll===m.id, shown=all ? held : held.slice(0,10);
    h+='<div class="mentorLabel" style="margin-top:10px">'+esc(t('Held'))+'</div>'+shown.map(ooHistRowHtml_).join('')+
      (held.length>shown.length ? '<button class="linkbtn inline" data-oohistall="'+esc(m.id)+'" style="display:block;margin:6px 0 0">'+esc(gpT('Show all {n}',{n:held.length}))+'</button>' : '');
  } else if(!open.length) h+='<p class="sub" style="margin:10px 0 0">'+esc(gpT('No 1-on-1s with {name} yet.',{name:first}))+'</p>';
  return h+'<div class="ooActs"><button class="btn" style="margin:10px 0 0" data-request121="'+esc(m.id)+'">☕ '+esc(gpT('Ask {name} for a 1-on-1',{name:first}))+'</button>'+
    '<button class="btn ghost" style="margin:8px 0 0" data-oolog="'+esc(m.id)+'">✍️ '+esc(t('Log one you already had'))+'</button></div></div>';
}
/* yes to the time they suggested: the server keeps it as theirs, and both get it in GP Tasks */
function ooAcceptSuggested_(b){
  var id=b.getAttribute('data-ooacceptwhen'), o=ooById_(id); b.disabled=true; gpTap();
  run('respondToOneOnOne',[S.auth.user,S.auth.pin,id,true],function(r){
    if(r && r.ok){ S.oneOnOnes=r.oneOnOnes; S.ooTimeEdit=null; S.bellOpen=false;
      showMsg(gpT('Accepted — {name} will get a notification',{name:String((o&&o.otherName)||'').split(' ')[0]})); ooAfterAccept_(id); }
    else { b.disabled=false; showMsg(t('Could not save')); }
  });
}
function ooAfterAccept_(id){
  var o=ooById_(id);
  if(o && !o.iMentor && !o.prep){ ooGo_(id); showMsg(t('Accepted — now a quick check-in')); }
  else render();
}
function ooSaved_(d, msg){
  if(d && d.ok){ S.oneOnOnes=d.oneOnOnes; if(msg) showMsg(msg); return true; }
  showMsg(t('Could not save')); return false;
}
function bindOneOnOne_(){
  var back=document.getElementById('ooBack');
  if(back) back.onclick=function(){ S.view=S.ooBack||'week'; S.ooId=null; S.ooWith=null; S.ooLive=null; render(); window.scrollTo(0,0); };
  var o=S.ooId ? ooById_(S.ooId) : null;
  var key=o ? o.id : 'new:'+S.ooWith;
  document.querySelectorAll('[data-ooarea],[data-ooval]').forEach(function(b){
    b.onclick=function(){
      var area=b.hasAttribute('data-ooarea'), v=(b.getAttribute(area?'data-ooarea':'data-ooval')||'').split('|');
      var d=ooDraft_(key); (area?d.areas:d.values)[v[0]]=Number(v[1]);
      b.parentNode.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x===b); });
    };
  });
  document.querySelectorAll('[data-oodraft]').forEach(function(el){
    el.oninput=function(){ ooDraft_(key)[el.getAttribute('data-oodraft')]=el.value; };
  });
  document.querySelectorAll('[data-oonote]').forEach(function(el){
    el.oninput=function(){ ooNotesDraft_(key, o).notes=el.value; ooNotesKeep_(key); };
  });
  document.querySelectorAll('[data-oofu]').forEach(function(el){
    el.oninput=function(){ ooNotesDraft_(key, o).followUps[Number(el.getAttribute('data-oofu'))]=el.value; ooNotesKeep_(key); };
  });
  var ho=document.getElementById('ooHeldOn');
  if(ho) ho.onchange=function(){ ooNotesDraft_(key, o).heldOn=ho.value; ooNotesKeep_(key); };
  var add=document.getElementById('ooFuAdd');
  if(add) add.onclick=function(){ ooNotesDraft_(key, o).followUps.push(''); ooNotesKeep_(key); render();
    var ins=document.querySelectorAll('[data-oofu]'); if(ins.length) ins[ins.length-1].focus(); };
  var lf=document.getElementById('ooLogFold');
  if(lf) lf.ontoggle=function(){ S.ooLogOpen=lf.open; };
  var begin=document.getElementById('ooBegin');
  if(begin) begin.onclick=function(){ gpTap(); S.ooLive=o.id; render(); window.scrollTo(0,0); };
  var en=document.getElementById('ooEditNotes');
  if(en) en.onclick=function(){ S.ooLive=o.id; render(); window.scrollTo(0,0); };
  var lc=document.getElementById('ooLiveClose');
  if(lc) lc.onclick=function(){ S.ooLive=null; render(); window.scrollTo(0,0); };
  var prepOf=function(d){ return { areas:d.areas, values:d.values, helpWith:d.helpWith, workingOn:d.workingOn, other:d.other }; };
  var filled=function(d){ return Object.keys(d.areas).length===OO_AREAS.length && Object.keys(d.values).length===OO_VALUES.length; };
  /* the suggested day and time: both or neither ('' = none, null = only one of the two) */
  var suggestOf=function(d){
    var dd=d.whenDate||'', tt=d.whenTime||'';
    if(!dd && !tt) return '';
    if(!dd || !tt){ showMsg(t('Pick both a day and a time — or leave both empty')); return null; }
    return dd+'T'+tt;
  };
  var send=document.getElementById('ooSend');
  if(send) send.onclick=function(){
    var d=ooDraft_(key);
    if(!filled(d)){ showMsg(t('Please rate each area and value first')); return; }
    var sw=suggestOf(d); if(sw===null) return;
    send.disabled=true;
    run('requestOneOnOne',[S.auth.user,S.auth.pin,S.ooWith,d.note,prepOf(d),sw],function(r){
      send.disabled=false;
      if(r && r.err==='bad_when'){ showMsg(t('Pick a day from today on')); return; }
      if(ooSaved_(r, t('Request sent'))){ delete S.ooDrafts[key]; S.view=S.ooBack||'week'; S.ooWith=null; render(); window.scrollTo(0,0); }
    });
  };
  var ask=document.getElementById('ooAsk');
  if(ask) ask.onclick=function(){
    var sw=suggestOf(ooDraft_(key)); if(sw===null) return;
    ask.disabled=true;
    run('requestOneOnOne',[S.auth.user,S.auth.pin,S.ooWith,'',null,sw],function(r){
      ask.disabled=false;
      if(r && r.err==='bad_when'){ showMsg(t('Pick a day from today on')); return; }
      if(ooSaved_(r, t('Request sent'))){ if(S.ooDrafts) delete S.ooDrafts[key]; var mine=(r.oneOnOnes||[]).filter(function(x){ return x.otherId===S.ooWith && x.status==='pending' && x.mine; })[0]; if(mine){ S.ooId=mine.id; } render(); }
    });
  };
  var notesArgs=function(){
    var d=ooNotesDraft_(key, o);
    return [d.notes, d.followUps.filter(function(f){ return String(f).trim(); }), d.heldOn];
  };
  var logB=document.getElementById('ooLog');
  if(logB) logB.onclick=function(){
    var a=notesArgs();
    if(!a[2]){ showMsg(t('Pick the date you met')); return; }
    logB.disabled=true;
    run('logOneOnOne',[S.auth.user,S.auth.pin,S.ooWith,a[0],a[1],a[2]],function(r){
      logB.disabled=false;
      if(ooSaved_(r, t('Saved'))){ ooNotesDrop_(key); var row=(r.oneOnOnes||[]).filter(function(x){ return x.otherId===S.ooWith && x.status==='held'; })[0]; S.ooId=row?row.id:null; render(); window.scrollTo(0,0); }
    });
  };
  var sp=document.getElementById('ooSavePrep');
  if(sp) sp.onclick=function(){
    var d=ooDraft_(key);
    if(!filled(d)){ showMsg(t('Please rate each area and value first')); return; }
    sp.disabled=true;
    run('saveOneOnOnePrep',[S.auth.user,S.auth.pin,o.id,prepOf(d)],function(r){
      sp.disabled=false;
      if(ooSaved_(r, t('Saved — your mentor can see it now'))){ delete S.ooDrafts[key]; S.ooEditPrep=null; render(); }
    });
  };
  var ep=document.getElementById('ooEditPrep');
  if(ep) ep.onclick=function(){ S.ooEditPrep=o.id; if(S.ooDrafts) delete S.ooDrafts[key]; render(); };
  /* Finish: held on the day picked (today unless changed) — it counts toward the month */
  var fin=document.getElementById('ooFinish');
  if(fin) fin.onclick=function(){
    var a=notesArgs();
    if(!a[2]){ showMsg(t('Pick the date you met')); return; }
    var wasHeld=o.status==='held'; fin.disabled=true;
    run('saveOneOnOneNotes',[S.auth.user,S.auth.pin,o.id,a[0],a[1],a[2]],function(r){
      fin.disabled=false;
      if(ooSaved_(r, wasHeld ? t('Saved') : t('Done — counted for this month'))){ ooNotesDrop_(key); S.ooLive=null; render(); window.scrollTo(0,0);
        if(!wasHeld && typeof gpConfetti==='function') gpConfetti(); }
    });
  };
  /* Save and carry on later: the notes are kept, the 1-on-1 stays open */
  var sl=document.getElementById('ooSaveLater');
  if(sl) sl.onclick=function(){
    var a=notesArgs(); sl.disabled=true;
    run('saveOneOnOneNotes',[S.auth.user,S.auth.pin,o.id,a[0],a[1],''],function(r){
      sl.disabled=false;
      if(ooSaved_(r, t('Saved — carry on when you’re ready'))){ ooNotesDrop_(key); S.ooLive=null; render(); window.scrollTo(0,0); }
    });
  };
  document.querySelectorAll('[data-ootick]').forEach(function(b){
    b.onclick=function(){
      var v=b.getAttribute('data-ootick').split('|'), row=ooById_(v[0]);
      var done=!(row && row.followUps && row.followUps[Number(v[1])] && row.followUps[Number(v[1])].done);
      b.classList.toggle('done', done);
      run('tickOneOnOneFollowUp',[S.auth.user,S.auth.pin,v[0],Number(v[1]),done],function(r){ if(ooSaved_(r)) render(); });
    };
  });
  /* the mentee's goals, for their mentor — fetched once per mentee */
  if(S.view==='oneonone'){
    var iMentor=o ? o.iMentor : (S.mentees||[]).some(function(p){ return p.id===S.ooWith; });
    var mid=o ? o.menteeId : S.ooWith;
    if(iMentor && o && S.ooGoalsFor!==mid){
      S.ooGoalsFor=mid; S.ooGoals=null;
      run('getMenteeLogs',[S.auth.user,S.auth.pin,mid],function(r){
        if(r && r.ok && S.ooGoalsFor===mid){ S.ooGoals=r.smartGoals||[]; if(S.view==='oneonone') render(); }
      });
    }
  }
}

/* The top of My Home — Base's own hero card, styled identically and
   populated with personal figures (streak, this week's goals, today's
   habits, PTO left) instead of the base's. A gear icon above it reveals a
   hidden customize panel — a free color wheel and a background photo — for
   the one card that's actually yours; .hero's text is already the fixed
   --onDark pair regardless, so .hero.custom only has to add a gradient
   under whatever color or photo gets picked, the same trick .allowCard and
   photo-backed cards already use for contrast rather than text color. */
function miniDashboardHtml(){
  var wk=thisWeek();
  var rec=goalsForWeek(wk);
  var written=(rec && rec.items ? rec.items : []).filter(function(i){return i && i.text;});
  var goalsDone=written.filter(function(i){return goalItemPct(i)>=100;}).length;
  var goalsPct=written.length ? Math.round(goalsDone/written.length*100) : 0;
  var list=myHabitsToday();
  var log=logForDate(todayStr());
  var habitsDone=list.filter(function(hb){return habitDoneToday(hb, log);}).length;
  var habitsPct=list.length ? Math.round(habitsDone/list.length*100) : 0;
  var HH=homeHealth_();   // the weekly check-in only: this week's, or last week's until it is answered
  var score=HH.score;
  var healthPct=score!==null?Math.round(score*10):0;

  var p=S.profile||{};
  var color=p.dashboardColor||'';
  var bg=p.dashboardBg||'';
  var custom=!!(color||bg);
  var open=!!S.dbCustomize;

  /* The name-and-face greeting moved here from Base — Base is ministry
     stats, not a personal page, and this is the one card that's actually
     yours. Same .baseMe markup Base used to show it with. */
  var h='<div class="miniDashHead">'+
      '<div class="baseMe">'+avatarHtml(S.me,'')+
        '<div><div class="pmeta">'+esc(t(greeting()))+'</div>'+
        '<div class="pname">'+esc(S.me.name)+'</div>'+
        '<div class="pmeta">'+(gpHomeIs_(S.me) ? esc(gpHomeLine_(S.me)) : esc(t(S.me.role||S.me.dept))+
          (S.me.ministry?' · '+esc(t(S.me.ministry)):''))+'</div>'+
        '</div></div>'+
      '<button class="dashSettingBtn'+(open?' on':'')+'" id="dashCustomizeBtn" aria-pressed="'+(open?'true':'false')+'" aria-label="'+esc(t('Customize dashboard'))+'">'+
        '<span class="ic">⚙️</span></button>'+
    '</div>';
  h+=gameHomeHtml_();   // my streak, points and place this week — tap for the board (20-game.js)

  /* ⚙️ opens the colour / photo options right here, under the greeting —
     below the card (where they were) they opened off the bottom of a phone's
     screen, so the gear seemed to do nothing. */
  if(open){
    h+='<div class="card dashCustom" id="dashCustom">'+
      '<div class="goalCardTitle" style="margin-bottom:4px">⚙️ '+esc(t('Customize dashboard'))+'</div>'+
      '<label class="f">'+esc(t('Accent color'))+'</label>'+
      '<div style="display:flex;align-items:center;gap:12px">'+
        '<input type="color" id="dashColorInput" value="'+esc(color||'#1F44FF')+'" aria-label="'+esc(t('Choose color'))+'">'+
        (color?'<button class="linkbtn" id="dashColorReset" style="width:auto;margin:0;padding:0">'+esc(t('Match app theme'))+'</button>':'')+
      '</div>'+
      '<label class="f">'+esc(t('Background image'))+'</label>'+
      '<div style="display:flex;gap:8px">'+
        '<button class="btn ghost" id="dashBgBtn" style="width:auto;margin:0;padding:9px 14px">'+(bg?esc(t('Change image')):esc(t('Add image')))+'</button>'+
        (bg?'<button class="btn ghost" id="dashBgClearBtn" style="width:auto;margin:0;padding:9px 14px">'+esc(t('Remove'))+'</button>':'')+
      '</div>'+
      '<input type="file" accept="image/*" id="dashBgInput" style="display:none">'+
      '<button class="btn" id="dashCustomDone" style="margin-top:12px">'+esc(t('Done'))+'</button>'+
    '</div>';
  }

  /* Base's own hero, reused whole — same classes, same look, populated with
     personal figures instead of the base's. The streak leads because it's
     the one number here that's purely for the person holding the phone, the
     same reason Base leads with the campus's total staff. Each ring/sub row
     is a button now: tapping one jumps straight to the section it's about,
     the same [data-jump] the quick-jump strip already uses. */
  /* Two halves, split by a faded rule: what you're aiming at this week (the
     three goals, and the two things you most often come here to do — the
     health check-in and your ministry's numbers), then how the week is going
     (streak, habits, health score, mentor). Goals lead because sitting under
     the big streak number read as an afterthought in the middle of the card. */
  h+='<div class="hero myHero'+(custom?' custom':'')+'"'+
    (custom?' style="'+(color?'background-color:'+esc(color)+';':'')+(bg?'background-image:url(\''+esc(bg)+'\');':'')+'"':'')+'>'+
    /* the quick apps, the widgets and the rows, each in the person's own order (19-ux.js, dashBodyHtml_) */
    dashBodyHtml_({ goalsPct:goalsPct, goalsDone:goalsDone, goalsN:written.length, habitsPct:habitsPct, habitsDone:habitsDone, habitsN:list.length, healthPct:healthPct, score:score })+
  '</div>';
  h+=contractNoticeHtml_();

  return h;
}

/* The base at a glance, at the foot of My Home's card (Base itself is in the
   menu now): the staff, the base's health score and salvations this year —
   the same figures, from the same rollup, as Base's own hero. Tap → Base. */
/* The summary card, made simpler (Nov 2026, Andrew: "I don't want it to be too much to see … like the widgets on
   an iPhone"): each thing is on My Home once. Its quick apps, widgets and rows are drawn and arranged in 19-ux.js
   (dashBodyHtml_); the goals' list, habits, mentor and annual goals have their sections below. */
function homeBaseHtml_(){
  if(!S.me || !S.me.campus) return '';
  /* Drawn before the base's figures arrive too, with a dash for each — so the card is
     its full size from the first moment and doesn't grow when they land. */
  var R=S.base ? baseR() : null, ids=[S.me.campus];
  var staff=R ? R.totalStaff(ids) : null, hs=R ? R.healthScore(ids) : null, salv=R ? R.headlineFor(ids,'Salvations') : null;
  /* who is on campus right now is the fourth figure (Who's here), not a row of its own */
  var W=(S.guest || S.board || S.student) ? false : (S.whosHere && S.whosFor===(S.me.campus||'') ? S.whosHere : null);
  var cell=function(v, label){ return '<button class="homeBaseCell" data-tobase="1"><b>'+v+'</b>'+esc(label)+'</button>'; };
  return '<div class="heroDivider"></div>'+
    '<div class="homeBase">'+
      '<button class="homeBaseHead" id="dashToBase"><span>🏠 '+esc(t(campusName(S.me.campus)))+'</span><span class="homeBaseGo">'+esc(t('Base'))+' →</span></button>'+
      '<span class="homeBaseRow'+(W===false?'':' four')+'">'+
        cell(staff===null?'—':staff, t('Staff'))+
        cell(hs===null?'—':hs.toFixed(1), t('Base health'))+
        cell(salv===null?'—':fmt(salv), t('Salvations'))+
        (W===false ? '' : '<button class="homeBaseCell homeWhos" id="goWhosHereHome"><b class="homeWhosN">'+(W && W.count!=null ? W.count : '—')+'</b>'+esc(t('On campus'))+'</button>')+
      '</span>'+
    '</div>';
}
/* Recent updates for the personal dashboard — leave decisions on my own
   requests, a mentee's leave request waiting on me, and 1-on-1 activity.
   Purely computed from state already on the page (trips, tripRequests,
   oneOnOnes), the same way streaks and badges are derived rather than
   stored — there's no separate "seen/unseen" tracking, just what's recent. */
function notifActionBtnsHtml_(okAttr, okId, noAttr, noId, okLabel, noLabel){
  return '<span class="chips" style="margin:0">'+
    '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-'+okAttr+'="'+esc(okId)+'">'+esc(okLabel)+'</button>'+
    '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px;color:var(--faint)" data-'+noAttr+'="'+esc(noId)+'">'+esc(noLabel)+'</button>'+
  '</span>';
}
/* The full list, unfiltered — shared by the My Home card below and the
   header bell, so the two can never show a different set of events. Nothing
   is stored for this: it's read straight off state the page already has
   (trips, tripRequests, oneOnOnes), the same way streaks and badges are
   derived rather than stored. */
function notifItems_(){
  var items=[];
  (S.tripRequests||[]).forEach(function(r){
    var range=r.from+(r.to!==r.from?' → '+r.to:'');
    /* When this was ASKED, not when the leave itself falls — a request
       submitted today for next month must still be clearable today, the
       same way a 1-on-1 request already sorts and clears by S.created. */
    items.push({ when:r.created||r.from, text: gpT('{name} requested leave {range}', {name:r.name, range:range}),
      actions: notifActionBtnsHtml_('trok', r.id, 'trno', r.id, t('Approve'), t('Deny')) });
  });
  (S.oneOnOnes||[]).forEach(function(o){
    if(!o.mine && o.status==='pending' && ooSuggested_(o)){
      items.push({ when:o.created, text: o.iMentor ? gpT('{name} (you mentor them) asked you for a 1-on-1 on {when}', {name:o.otherName, when:ooWhenNice_(o.when)}) : gpT('{name}, your mentor, asked you for a 1-on-1 on {when}', {name:o.otherName, when:ooWhenNice_(o.when)}),
        actions: '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-ooacceptwhen="'+esc(o.id)+'">'+esc(t('Accept'))+'</button>'+
          '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-ooopen="'+esc(o.id)+'">'+esc(t('Pick another time'))+'</button>' });
    } else if(!o.mine && o.status==='pending'){
      items.push({ when:o.created, text: o.iMentor ? gpT('{name} (you mentor them) asked you for a 1-on-1', {name:o.otherName}) : gpT('{name}, your mentor, asked you for a 1-on-1', {name:o.otherName}),
        actions: '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gomentorship="1">'+esc(t('Set a time'))+'</button>'+
          '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px;color:var(--faint)" data-121decline="'+esc(o.id)+'">'+esc(t('Decline'))+'</button>' });
    } else if(o.status==='accepted' && o.when && !o.whenByMe){
      items.push({ when:o.whenAt||o.decidedAt||o.created, text: gpT('{name} set your 1-on-1 for {when}', {name:o.otherName, when:ooWhenNice_(o.when)}),
        actions: '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-ooopen="'+esc(o.id)+'">'+esc(t('Open'))+'</button>' });
    } else if(o.mine && o.status==='accepted' && o.when){
      items.push({ when:o.decidedAt||o.created, text: gpT('{name} said yes to your 1-on-1 on {when}', {name:o.otherName, when:ooWhenNice_(o.when)}),
        actions: '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-ooopen="'+esc(o.id)+'">'+esc(t('Open'))+'</button>' });
    } else if(o.mine && o.status==='accepted'){
      items.push({ when:o.decidedAt||o.created, text: gpT('{name} accepted your 1-on-1 request', {name:o.otherName}) });
    } else if(o.mine && o.status==='declined'){
      items.push({ when:o.decidedAt||o.created, text: gpT('{name} declined your 1-on-1 request', {name:o.otherName}) });
    }
    /* a mentee whose 1-on-1 is on but whose check-in isn't filled in yet */
    if(!o.iMentor && ooOpen_(o) && !o.prep && !(o.status==='pending' && !o.mine)){
      items.push({ when:o.decidedAt||o.created, text: gpT('Fill in your check-in before your 1-on-1 with {name}', {name:o.otherName}),
        actions: '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-ooopen="'+esc(o.id)+'">'+esc(t('Open'))+'</button>' });
    }
  });
  items=items.concat(gptNotifItems_());
  if(typeof wsNotifItems_==='function') items=items.concat(wsNotifItems_());   // the day before a worship service I'm on   // GP Tasks: given a task, asked for help, turned down
  (S.trips && S.trips.trips || []).forEach(function(r){
    var range=r.from+(r.to!==r.from?' → '+r.to:'');
    if(r.status==='approved'){
      items.push({ when: r.decidedAt||r.from, text: gpT('Your {range} leave request was approved', {range:range}) });
    } else if(r.status==='declined'){
      items.push({ when: r.decidedAt||r.from, text: gpT('Your {range} leave request was declined', {range:range}) });
    }
  });
  /* An admin's own words, sent to everyone — free text, so it never runs
     through t()/gpT like the rest of this list; only the "Announcement"
     label is translated. */
  (S.broadcasts||[]).forEach(function(b){
    items.push({ when:b.created, text:'📣 '+t('Announcement')+': '+b.text });
  });
  /* A nudge, not a server-tracked item — from the check-in's day, Tuesday (the staff meeting, Nov 2026,
     Andrew; it was Friday), through the end of the week, if this week's check-in is still unanswered.
     "when" is that Tuesday's own date, so clearing it only holds through the rest of THIS week: next week's
     Tuesday is a later date, past the clear cutoff, so the same nudge reappears fresh. */
  if(S.me){
    var nwk=thisWeek(), ntue=checkinDayOf_(nwk);
    if(new Date(todayStr())>=ntue && !myWeekRow(nwk)){
      items.push({ when:isoDateOf_(ntue), text:checkinIsToday_() ? t('It’s Tuesday — answer your weekly health check-in at the staff meeting.') : t('Your weekly health check-in is due'),
        actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gohealth="open">'+esc(t('Answer it'))+'</button>' });
    }
  }
  /* This week's goals not set yet (Nov 2026, Andrew: "don't forget your goals") — dated this week's Monday, so a
     Clear holds for the week and it comes back next Monday while they are still not set. */
  if(S.me && !S.student){
    var sgwk=thisWeek(), sgrec=goalsForWeek(sgwk);
    if(!(sgrec && (sgrec.items||[]).some(function(i){ return i && i.text; }))){
      items.push({ when:isoDateOf_(new Date(weekBounds_(sgwk).from)), text:t('Don’t forget to set your three goals for this week'),
        actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-jumpgoals="1">'+esc(t('Set them'))+'</button>' });
    }
  }
  /* this month's book now and then, and a teammate's recommendation (18-library-plus.js) */
  if(S.me && !S.student && typeof libNudgeItems_==='function') libNudgeItems_().forEach(function(it){ items.push(it); });
  /* the campus's fast: the day's focus for those who joined, an invitation for the rest (25-intercession.js) */
  if(S.me && !S.student && typeof fastNotifItems_==='function') fastNotifItems_().forEach(function(it){ items.push(it); });
  if(S.me && !S.student && typeof sbNotifItems_==='function') sbNotifItems_().forEach(function(it){ items.push(it); });
  if(S.me && !S.student && typeof qrNotifItems_==='function') qrNotifItems_().forEach(function(it){ items.push(it); });   // write the quarter's story (29-report.js)
  /* End of the week, goals not all the way there — used to be a big banner
     inline on My Home; it's a bell item instead now so the page isn't
     stacking two "end of the week" banners at once. Same Friday-dated
     "when" as the health nudge above, so it clears with the rest of the
     week and comes back fresh next week. */
  if(S.me && weekPhase()==='review'){
    var ggwk=thisWeek(), ggrec=goalsForWeek(ggwk);
    var ggHasGoals=!!(ggrec && ggrec.items.some(function(i){ return i.text; }));
    if(ggHasGoals && ggrec.pct!==null && ggrec.pct<100){
      var ggfri=new Date(weekBounds_(ggwk).from); ggfri.setDate(ggfri.getDate()+4);
      items.push({ when:isoDateOf_(ggfri), text:gpT('Your three goals are {pct}% of the way there.',{pct:ggrec.pct}),
        actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-jumpgoals="1">'+
          esc(gpT('Close out week {wk}',{wk:ggwk}))+'</button>' });
    }
  }
  /* Every account made before email became part of sign-up has none yet —
     "when" is always right now, computed fresh every render, so this never
     ages past a Clear the way the others above do: clearing sets
     notifClearedAt to this same instant, and the next render's "now" is
     always a moment later, so the item is straight back. It's meant to
     stay until the email is actually added, not until someone taps Clear.
     bellOnly: this is true for nearly every existing account at once, so an
     inline card on My Home would be permanent, above-the-fold clutter
     for almost everybody — the bell (and its dot) is visible enough. */
  /* HR reminders — for an admin or anyone with HR. Dated today (not now),
     so Clear hides them until tomorrow and they come back while the work
     is still waiting: a contract to renew, a candidate to follow up. */
  if(S.me && (S.me.isAdmin || S.me.hr)){
    var hrBtn='<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gohr="1">'+esc(t('Open HR'))+'</button>';
    if(S.hrDue) items.push({ when:todayStr()+'T23:59:59.000Z', text: S.hrDue===1 ? t('1 staff contract is due for renewal') : gpT('{n} staff contracts are due for renewal',{n:S.hrDue}), actions:hrBtn });
    if(S.hrFollowUps) items.push({ when:todayStr()+'T23:59:58.000Z', text: S.hrFollowUps===1 ? t('1 candidate follow-up is due') : gpT('{n} candidate follow-ups are due',{n:S.hrFollowUps}), actions:hrBtn });
  }
  /* SR Hospitality (the Hospitality ministry and admins): a team's dates changed and its booking moved,
     or someone left and their bed came free — each until someone taps Got it there (Nov 2026). */
  (S.hospNews||[]).forEach(function(c){
    items.push({ when:c.at, text: c.kind==='left' ? gpT('SR Hospitality: {name} has left — their bed is free',{name:c.name}) : gpT('SR Hospitality: {name} has new dates, {range}',{name:c.name, range:hospRangeOf_(c.now)}),
      actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gohosp="1">'+esc(t('Open'))+'</button>' });
  });
  /* The nightly backup (admins): only when a night was missed or the last run
     failed — dated today, so Clear holds until tomorrow and it comes back while
     it is still not running. */
  if(S.me && S.me.isAdmin && backupLate_()){
    items.push({ when:todayStr()+'T23:59:57.000Z', text: backupLateText_(),
      actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-goadmin="1">'+esc(t('Open Admin'))+'</button>' });
  }
  /* Ministry numbers, due Friday. Whoever is responsible (main, backup, or the
     leaders with nobody set) gets "due today" on Friday and "overdue" from
     Saturday — Friday- and Saturday-dated, so a Clear holds for that day —
     until the week has numbers in. Last week's, still missing, comes back
     each day (dated today) until it is in. A department's overseer gets the
     done / not done list on the same days. */
  if(S.me && S.numbers){
    var nw=thisWeek(), ntoday=todayStr(), nfriD=weekFriday_(nw), nfri2=isoDateOf_(nfriD);
    var nsatD=new Date(nfriD); nsatD.setDate(nsatD.getDate()+1); var nsat=isoDateOf_(nsatD);
    var goBtn=function(x){ return '<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gonumbers="'+esc(x.dept+'|'+x.ministry)+'">'+esc(t('Enter them'))+'</button>'; };
    (S.numbers.duty||[]).forEach(function(x){
      if(ntoday>=nfri2 && !numLogged_(x, nw)){
        items.push({ when: ntoday>nfri2 ? nsat : nfri2,
          text: ntoday>nfri2 ? gpT('{ministry} numbers for week {wk} are overdue',{ministry:t(x.ministry), wk:nw})
                             : gpT('{ministry} numbers for week {wk} are due today',{ministry:t(x.ministry), wk:nw}),
          actions: goBtn(x) });
      }
      if(nw>1 && !numLogged_(x, nw-1)){
        items.push({ when: ntoday, text: gpT('{ministry} numbers for week {wk} are overdue',{ministry:t(x.ministry), wk:nw-1}), actions: goBtn(x) });
      }
    });
    var ND=S.numbers.dept;
    if(ND){
      var nmins=numbersDeptMinistries_(ND.dept);
      var deptBtn='<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-gonumdept="'+esc(ND.dept)+'">'+esc(t('See them'))+'</button>';
      var missing=function(w){ var lg=ND.logged && ND.logged[w]; return lg ? nmins.filter(function(m){ return lg.indexOf(m)===-1; }) : null; };
      var listOf=function(ms){ return ms.map(function(m){ return t(m)+' ('+numbersWhoFor_(ND, m)+')'; }).join(', '); };
      var mNow=missing(nw);
      if(nmins.length && mNow && ntoday>=nfri2){
        items.push({ when: ntoday>nfri2 ? nsat : nfri2,
          text: gpT('{dept} week {wk}: {n} of {total} ministries have their numbers in.',{dept:t(ND.dept), wk:nw, n:nmins.length-mNow.length, total:nmins.length})+
            (mNow.length ? ' '+gpT('Not yet: {list}',{list:listOf(mNow)}) : ''),
          actions: deptBtn });
      }
      var mLast = nw>1 ? missing(nw-1) : null;
      if(nmins.length && mLast && mLast.length && ntoday<nfri2){
        items.push({ when: ntoday, text: gpT('{dept} week {wk}: still missing {list}',{dept:t(ND.dept), wk:nw-1, list:listOf(mLast)}), actions: deptBtn });
      }
    }
  }
  if(S.me && !(S.profile && S.profile.email)){
    items.push({ when:new Date().toISOString(), text:t('Add your email to your profile'),
      actions:'<button class="linkbtn" style="width:auto;margin:0;padding:6px 10px" data-goprofile="1">'+esc(t('Add it'))+'</button>',
      bellOnly:true });
  }
  items.sort(function(a,b){ return (b.when||'')<(a.when||'')?-1:1; });
  return items;
}

/* What's actually shown: everything since the last Clear. A single "cleared
   before" cutoff rather than a per-item read flag — Clear on the bell or on
   My Home is the same button, so both can never disagree about what's
   left. Clearing an actionable row (a mentee's leave request, an incoming
   1-on-1) only tidies this feed — the request itself is still sitting in
   Leave Request / Mentorship / Team, waiting on you, either way. */
function visibleNotifItems_(){
  var cut = S.notifClearedAt || '';
  return notifItems_().filter(function(it){ return (it.when||'') > cut; });
}

function clearNotifications(){
  S.notifClearedAt = new Date().toISOString();
  lsSet('gp-notif-cleared', S.notifClearedAt);
  S.bellOpen=false;
  render();
}



/* ---- The weekly health check-in is on Tuesdays, at the staff meeting (Nov 2026, Andrew: "we want to move to
   every Tuesday during our staff meeting") ----
   CHECKIN_DOW (0 Sunday … 6 Saturday; api.js has its own for the phone reminder): the bell's nudge starts that
   day — on the day itself as the slide-down reminder (19-ux.js) — while this week's isn't in, and the Health tab says when it is done (#checkinTueHint). Any day still works. */
var CHECKIN_DOW=2;
function checkinDayOf_(wk){ var d=new Date(weekBounds_(wk).from); d.setDate(d.getDate()+((CHECKIN_DOW+6)%7)); return d; }
function checkinIsToday_(){ return new Date().getDay()===CHECKIN_DOW; }
