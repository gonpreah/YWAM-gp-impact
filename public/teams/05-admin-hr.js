/* My YWAM GP — teams.html, part 5 of 11: Admin and HR.
   Plain script, loaded in order by teams.html; the parts share one global
   scope, exactly as when this was one inline script. A function may call any
   function in any part. Code that RUNS while a part loads (not inside a
   function) can only use what this or an earlier part has defined. */
/* ---------- Admin ----------
   Account management, not the sensitive-dashboard-numbers gate — that stays
   the leader code, exactly as it works today. isAdmin only ever goes to a
   Campus Leadership account, and only the leader code can grant it
   (grantAdmin in api.js), so this screen never has to ask "says who" about
   its own visibility.

   S.adminStaff loads once per visit, lazily, the same pattern the
   ministry-oversight cards already use — nothing here rides along on
   getMyBoot, since almost nobody who opens the app is an admin. */
/* Admin used to be one long scroll — an announcement box, the ministry KPI
   editor, approvals, merge, and the whole staff directory, all stacked on
   top of each other. Finding "did I already approve so-and-so" meant
   scrolling past the KPI picker every time. Splitting it into its own
   sub-pages (a chip row, same pattern as the campus tabs below) means each
   visit shows only the one thing you came here for. */
/* ---------- Admin ----------
   A home menu, then one page per job — Accounts, Approvals, Ministry KPIs,
   Announcements, Merge duplicates — each with its own back link, and one
   page per PERSON under Accounts. The old layout put every tool on one
   screen behind a chip row, with each account an accordion in a long list;
   the redesign is about knowing where you are: the page title says which
   tool, the person page says whose account. Every control keeps its id
   and data- attribute, so the handlers in bindAdmin() are unchanged. */
var ADMIN_SUBS = [
  { id:'accounts', label:'Accounts', emoji:'👤', blurb:'Find someone — edit their profile, reset a PIN, set their mentor or make them a ministry leader' },
  { id:'approvals', label:'Approvals', emoji:'✅', blurb:'Leadership sign-ups and moves waiting for a yes' },
  { id:'students', label:'Students', emoji:'🎓', blurb:'Everything for students: who is staying now and their invites, each school, what each one has put in, their app, and archiving a school when it finishes' },
  { id:'mentors', label:'Mentors', emoji:'🤝', blurb:'Who is walking with whom — every mentor and their people, and who has nobody yet' },
  { id:'leave', label:'Leave', emoji:'🗓️', blurb:'Everyone’s leave requests, by campus — waiting, coming up, and days used this year' },
  { id:'portal', label:'Portal access', emoji:'🛂', blurb:'Who works in applications — grant or remove access to the YWAM GP Portal' },
  { id:'kpis', label:'Ministry KPIs', emoji:'🗂️', blurb:'What each ministry tracks — add, rename, remove, re-time' },
  { id:'broadcast', label:'Announcements', emoji:'📣', blurb:'A message to everyone’s notification bell' },
  { id:'merge', label:'Merge duplicates', emoji:'🔀', blurb:'Two profiles that are really one person' },
  { id:'groups', label:'Staff sign-up link', emoji:'🔗', blurb:'One link a new group of staff opens to make their own profiles (students: 🎓 Students)' },
  { id:'leaving', label:'Archive several people', emoji:'🚪', blurb:'When a group of staff leaves: archive them in one go' },
  { id:'loose', label:'Loose ends', emoji:'🧵', blurb:'Small gaps that quietly make the totals wrong — and who to nudge' },
  { id:'board', label:'Advisory Board', emoji:'🛡️', blurb:'The YWAM GP Advisory Board — who is on it, their roles, how staff reach them, and their sign-in' },
  { id:'reminders', label:'Reminders', emoji:'🔔', blurb:'Turn on phone reminders for the app, and see how many people have them' }
];
function adminBackHtml_(to, label){
  return '<button class="linkbtn" id="adminBack" data-adminback="'+to+'" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(label)+'</button>';
}
/* The nightly backup (netlify/functions/backup.js): late when the last good
   run is more than a day and a half old, or a run failed after it. Nothing
   in the app reads or restores a backup — that is scripts/restore-backup.mjs. */
function backupLate_(){
  var b=S.backup; if(!b || b.none || !b.at) return false;
  var at=Date.parse(b.at); if(!isFinite(at)) return false;
  return (Date.now()-at > 36*3600*1000) || (!!b.errorAt && b.errorAt > b.at);
}
function backupWhen_(iso){
  var d=new Date(iso); return shortDay_(d)+', '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
}
function backupLateText_(){
  return gpT('The nightly backup has not run since {date}.',{date:backupWhen_(S.backup.at)});
}
function backupLineHtml_(){
  var b=S.backup; if(!b) return '';
  var h='<div class="card backupLine" id="backupLine">';
  if(b.none) h+='<span class="rowSub">🗄️ '+esc(t('No backup has run yet — the first one runs tonight at 3:00.'))+'</span>';
  else if(backupLate_()){
    h+='<b class="backupLate">⚠️ '+esc(backupLateText_())+'</b>';
    if(b.lastError) h+='<div class="rowSub">'+esc(gpT('Last error: {msg}',{msg:b.lastError}))+'</div>';
  } else h+='<span class="rowSub">🗄️ '+esc(gpT('Last backup: {date} · {n} items · {days} nights kept',{date:backupWhen_(b.at), n:b.items, days:b.days}))+'</span>';
  return h+'</div>';
}
function adminHtml(){
  var sub = S.adminSub;
  if(sub==='person'){
    var who=(S.adminStaff||[]).filter(function(x){ return x.id===S.adminPersonId; })[0];
    if(S.adminStaff!==null && !who) sub='accounts';
  } else if(sub==='stuone'){ if(!S.adminStuId) sub='students'; }
  else if(!ADMIN_SUBS.some(function(x){ return x.id===sub; })) sub='home';
  S.adminSub=sub;
  if(sub==='home') return adminHomeHtml_();
  if(sub==='person') return adminPersonHtml_();
  if(sub==='stuone') return adminStudentHtml_();
  var meta=ADMIN_SUBS.filter(function(x){ return x.id===sub; })[0];
  var h=adminBackHtml_('home', t('Admin'));
  h+='<h2>'+meta.emoji+' '+esc(t(meta.label))+'</h2><p class="sub">'+esc(t(meta.blurb))+'</p>';
  if(sub==='broadcast') return h+adminBroadcastHtml_();
  if(sub==='kpis') return h+adminKpisHtml_();
  if(sub==='approvals') return h+adminApprovalsHtml_();
  if(sub==='students') return h+adminStudentsHtml_();
  if(sub==='mentors') return h+adminMentorsHtml_();
  if(sub==='leave') return h+adminLeaveHtml_();
  if(sub==='portal') return h+adminPortalHtml_();
  if(sub==='merge') return h+adminMergeHtml_();
  if(sub==='loose') return h+adminLooseHtml_();
  if(sub==='groups') return h+adminGroupsHtml_('link');
  if(sub==='leaving') return h+adminGroupsHtml_('leave');
  if(sub==='board') return h+adminBoardHtml_();
  if(sub==='reminders') return h+adminRemindersHtml_();
  return h+adminAccountsHtml_();
}
/* Admin → 🎓 Students (Oct 2026): every student profile, by school — the ones
   made from SR Hospitality and the ones who applied through the portal. Tap one
   for what they have put in (mentor, weekly goals, habits, strengths, Library),
   and "See their app" opens their GP app exactly as they see it, read only
   (S.stuPreview: nothing is sent, nothing saved; leaving reloads the page as
   yourself, back on their profile). Admins only. */
S.adminStu=null; S.adminStuId=null; S.adminStuView=null;
function adminStuStatus_(r){
  return r.linked ? (r.updated ? gpT('Last active {date}',{date:shortDay_(new Date(r.updated))}) : t('Signed up'))
    : r.invite ? t('Invite sent — not joined yet') : t('No account yet');
}
function adminStudentsHtml_(){
  var h='<h3 class="adminStuH">🛏️ '+esc(t('Staying with us now'))+'</h3>'+
    '<p class="looseWhy">'+esc(t('From SR Hospitality’s student bookings. Make each a profile, then send the invite — they sign in with Google and have their own GP app.'))+'</p>'+
    stuStayingHtml_(S.stuList, false);
  h+='<h3 class="adminStuH">🏫 '+esc(t('By school'))+'</h3>';
  var L=S.adminStu;
  if(!L) return h+'<p class="sub">'+esc(t('Loading…'))+'</p>';
  if(!L.ok) return h+'<p class="sub">'+esc(t('Couldn’t load the students — pull down to try again.'))+'</p>';
  var keys=(L.order||[]).filter(function(k){ return (L.schools[k]||[]).length; });
  if(!keys.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('No student profiles yet. Make them above, or they come as students apply through the portal.'))+'</p></div>';
  return h+'<p class="looseWhy">'+esc(t('Tap a student for what they have put in and to see their app.'))+'</p>'+keys.map(function(k){
    var rows=L.schools[k], name=k==='other' ? t('No school set') : k.toUpperCase();
    var arch = S.stuArchSchool===k
      ? '<div class="banner" style="margin:8px 0 0">'+esc(gpT('Archive all {n} {school} profiles? Their GP app closes; their portal account stays. HR can bring a profile back.',{n:rows.length, school:name}))+'</div>'+
        '<div class="btnRow"><button class="btn" data-stuarchyes="'+esc(k)+'" style="background:var(--bad);border-color:var(--bad)">'+esc(gpT('Yes, archive {n}',{n:rows.length}))+'</button><button class="btn ghost" id="stuArchNo">'+esc(t('Cancel'))+'</button></div>'
      : '<button class="linkbtn" data-stuarch="'+esc(k)+'" style="width:auto;margin:6px 0 0;padding:4px 0;color:var(--bad)">'+esc(t('School finished? Archive these profiles'))+'</button>';
    return '<div class="card adminStuSchool"><div class="goalCardTitle">'+esc(name)+' <small>· '+rows.length+'</small></div>'+rows.map(function(r){
      var bits=[adminStuStatus_(r)];
      if(r.mentor) bits.push(gpT('Mentor: {name}',{name:r.mentor})+(r.mentorStatus==='pending' ? ' ('+t('asked')+')' : ''));
      if(r.linked) bits.push(gpT('{n} goals this week',{n:r.goalsThisWeek}));
      return '<button type="button" class="adminStuRow" data-adminstu="'+esc(r.candId)+'">'+avatarHtml({ name:r.name }, 'sm')+
        '<span class="stuRowTxt"><b>'+esc(r.name)+'</b><span class="rowSub">'+esc(bits.join(' · '))+'</span></span>'+
        '<span class="accChevron" style="transform:rotate(-90deg)">'+ACC_CHEVRON+'</span></button>';
    }).join('')+arch+'</div>';
  }).join('');
}
function adminStudentHtml_(){
  var h=adminBackHtml_('students', t('Students'));
  var V=S.adminStuView;
  if(!V || V.id!==S.adminStuId) return h+'<p class="sub">'+esc(t('Loading…'))+'</p>';
  if(!V.ok) return h+'<p class="sub">'+esc(t('Couldn’t load this student.'))+'</p>';
  var r=V.student, b=V.boot;
  h+='<h2>🎓 '+esc(r.name)+'</h2><p class="sub">'+esc([r.school ? r.school.toUpperCase() : '', r.email, adminStuStatus_(r)].filter(Boolean).join(' · '))+'</p>';
  if(!b) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('They haven’t joined yet, so there is nothing to see. Send them their invite from ☰ → Students.'))+'</p></div>';
  h+='<button type="button" class="btn" id="adminStuPreview" style="margin:0 0 14px">👁 '+esc(gpT('See {name}’s app',{name:firstName_(r.name)}))+'</button>';
  var card=function(title, body){ return '<div class="card adminStuCard"><div class="goalCardTitle">'+title+'</div>'+body+'</div>'; };
  var line=function(txt){ return '<p class="sub" style="margin:0">'+esc(txt)+'</p>'; };
  h+=card('🤝 '+esc(t('Mentor')), line(r.mentor ? (r.mentorStatus==='pending' ? gpT('Asked {name} — waiting for them to accept',{name:r.mentor}) : r.mentor) : t('Not chosen yet')));
  /* weekly goals: last week, this week, next week */
  var wk=thisWeek(), yr=thisWeekYear();
  var goals=[[wk-1, t('Last week')], [wk, t('This week')], [wk+1, t('Next week')]].filter(function(x){ return x[0]>=1 && x[0]<=52; }).map(function(x){
    var g=(b.goals||[]).filter(function(r2){ return Number(r2.week)===x[0] && (!r2.year || Number(r2.year)===yr); })[0], items=(g && g.items)||[];
    return '<div class="adminStuWeek"><b>'+esc(x[1])+'</b>'+(items.length ? '<ul>'+items.map(function(it){
      return '<li>'+(it.done ? '✅ ' : '')+esc(it.text)+(it.done || !it.pct ? '' : ' <span class="rowSub">· '+Math.round(it.pct)+'%</span>')+'</li>'; }).join('')+'</ul>'
      : '<span class="rowSub">'+esc(t('No goals'))+'</span>')+'</div>';
  }).join('');
  h+=card('🎯 '+esc(t('Weekly Goals')), goals);
  /* habits: how many of the last 7 days */
  var days=[]; for(var i=0;i<7;i++){ var d=new Date(); d.setDate(d.getDate()-i); days.push(d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)); }
  var habits=(b.habits||[]).map(function(hb){
    var m=habitMeta(hb), n=(b.logs||[]).filter(function(l){ return days.indexOf(l.date)>-1 && didHabit(l, hb.id); }).length;
    return '<div class="adminStuHabit"><span>'+esc(m.icon)+' '+esc(t(m.label))+'</span><span class="rowSub">'+esc(gpT('{n} of the last 7 days',{n:n}))+'</span></div>';
  }).join('');
  h+=card('✅ '+esc(t('Habits')), habits || line(t('No habits yet')));
  /* strengths */
  var P=b.profile||{}, pt=P.personality, gs=P.gstrengths, pn=pt && typeof GP_PTYPES!=='undefined' && GP_PTYPES[pt.type];
  h+=card('🧭 '+esc(t('Strengths')),
    line(t('Personality')+': '+(pt ? (pn ? t(pn.name)+' ('+pt.type+')' : pt.type) : t('Not taken yet')))+
    '<p class="sub" style="margin:6px 0 0">'+esc(t('Top strengths')+': '+(gs && gs.top && gs.top.length ? gs.top.map(function(id){ var x=gpGSById(id); return x ? t(x.name) : id; }).join(', ') : t('Not taken yet')))+'</p>');
  h+=card('📚 '+esc(t('Library')), line(gpT('{n} marked read',{n:r.libRead||0})));
  return h;
}
function stuPreviewEnter_(){
  var V=S.adminStuView; if(!V || !V.boot) return;
  var b=V.boot;
  try { sessionStorage.setItem('gp-stu-back', V.student.candId); } catch(e){}
  S.stuPreview={ name:V.student.name, candId:V.student.candId, libRead:b.libRead||{} };
  S.student=true; S.bellOpen=false; S.menuOpen=false;
  try { document.body.classList.add('studentMode'); } catch(e){}
  S.me=b.staff; S.profile=b.profile||{};
  S.roster=b.roster||[]; S.logs=b.logs||[]; S.habits=b.habits||[]; S.goals=b.goals||[];
  S.checkins=[]; S.mentees=[]; S.mentorRequests=[]; S.stuMentor=null; S.smartGoals=[]; S.tasks=[]; S.oneOnOnes=[]; S.broadcasts=[];
  S.reqDocs=[]; S.required=null; S.supSum=null; S.p3Glance=null;
  S.sched=(b.schedules && b.schedules.ok) ? b.schedules : null;
  S.view='week'; render(); window.scrollTo(0,0);
}
function stuPreviewExit_(){ location.reload(); }
function stuPreviewBarHtml_(){
  return '<div class="stuPreviewBar"><span>👁 '+esc(gpT('Viewing {name}’s app — read only',{name:S.stuPreview.name}))+'</span>'+
    '<button type="button" class="btn small" id="stuPreviewExit">'+esc(t('Back to Admin'))+'</button></div>';
}
function adminHomeHtml_(){
  var list=S.adminStaff, loading=list===null;
  var pendingN = loading ? null : list.filter(function(x){ return (!x.active && !x.archived) || (x.active && x.cltRequest); }).length;   // archived ≠ waiting
  var activeN = loading ? null : list.filter(function(x){ return x.active; }).length;
  var h=adminBackHtml_('week', t('My Home'));
  h+='<h2>'+esc(t('Admin'))+'</h2><p class="sub">'+esc(t('Approve new leadership accounts, and manage everyone’s.'))+'</p>';
  h+=backupLineHtml_();
  h+='<div class="adminMenu">'+ADMIN_SUBS.map(function(x){
    var noMentorN = loading ? null : list.filter(function(x2){ return x2.active && !x2.archived && !x2.mentorId; }).length;
    var waitingN = S.adminLeave ? S.adminLeave.trips.filter(function(tr){ return (tr.status==='pending'||tr.status==='noted') && tr.active; }).length : null;
    var badge = x.id==='approvals' ? pendingN : x.id==='accounts' ? activeN : x.id==='mentors' ? noMentorN : x.id==='leave' ? waitingN : null;
    var badgeHtml = badge===null ? (loading && (x.id==='approvals'||x.id==='accounts'||x.id==='mentors') ? '<span class="adminBadge">…</span>' : '')
      : '<span class="adminBadge'+(x.id==='approvals'&&badge?' hot':'')+'">'+badge+'</span>';
    return '<button class="card adminMenuCard" data-adminsub="'+x.id+'"><span class="adminMenuEmoji">'+x.emoji+'</span>'+
      '<span class="adminMenuText"><b>'+esc(t(x.label))+'</b><span class="rowSub">'+esc(t(x.blurb))+'</span></span>'+badgeHtml+
      '<span class="accChevron" style="transform:rotate(-90deg)">'+ACC_CHEVRON+'</span></button>';
  }).join('')+'</div>';
  return h;
}
/* Admin → Loose ends: the small gaps that quietly make the base's totals wrong,
   one campus at a time, each with who or what to tap. Built here from
   adminLooseEnds' facts and taxonomy.js's structure (the server has no copy of
   it): ministries with nobody set to enter numbers (or someone no longer
   active), ministries with no numbers for three weeks or more, people who have
   not opened the app in 30 days (once 30 days of counting exist), people with
   no department or ministry, people with no mentor, and this quarter's
   objectives nobody has edited in 30 days (not ones fed by a ministry's
   numbers — those move on their own). Reloaded each visit. */
S.adminLoose=null; S.adminLooseLoading=false;
var LOOSE_SHOW = 5;   // a long list shows its first five; the rest fold away
function looseDays_(a, b){ return Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/864e5); }
function looseAddDays_(d, n){ var x=new Date(Date.parse(d+'T00:00:00Z')+n*864e5); return shortDay_(new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())); }
function looseDay_(d){ var x=new Date(d+'T00:00:00'); return shortDay_(x); }
function loosePersonBtn_(x, sub){
  return '<button class="linkbtn" style="width:auto;margin:0;padding:6px 0;text-align:left" data-adminperson="'+esc(x.id)+'">'+esc(x.name)+'</button>'+
    (sub ? ' <span class="rowSub">· '+esc(sub)+'</span>' : '');
}
function looseSection_(emoji, title, why, rows, extra){
  /* rows === null: not countable yet — no badge, no "Nothing here", just the note in extra */
  var h='<div class="card looseCard"><div class="goalCardTitle">'+emoji+' '+esc(title)+(rows===null ? '' : rows.length ? ' <span class="adminBadge hot">'+rows.length+'</span>' : ' <span class="adminBadge">0</span>')+'</div>'+
    '<p class="looseWhy">'+esc(why)+'</p>';
  if(rows===null) {}
  else if(rows.length){
    var row=function(r){ return '<div class="looseRow">'+r+'</div>'; };
    h+=rows.slice(0, LOOSE_SHOW).map(row).join('');
    if(rows.length>LOOSE_SHOW) h+='<details class="looseMore"><summary>'+esc(gpT('Show all {n}',{n:rows.length}))+'</summary>'+rows.slice(LOOSE_SHOW).map(row).join('')+'</details>';
  }
  else h+='<div class="rowSub">✓ '+esc(t('Nothing here'))+'</div>';
  return h+(extra||'')+'</div>';
}
function adminLooseHtml_(){
  var L=S.adminLoose;
  if(L===null || S.adminStaff===null) return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  if(!L.ok) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Couldn’t load this — pull down to try again.'))+'</p></div>';
  var C = CAMPUSES.some(function(c){ return c.id===S.adminCampusTab; }) ? S.adminCampusTab : S.me.campus;
  S.adminCampusTab=C;
  var h='<div class="deptChips">'+CAMPUSES.map(function(c){
    return '<button class="deptChip'+(c.id===C?' on':'')+'" data-admincampustab="'+esc(c.id)+'">'+esc(c.short)+'</button>';
  }).join('')+'</div>';
  var staff=(S.adminStaff||[]).filter(function(x){ return x.campus===C && x.active && !x.archived; });
  var byId={}; (S.adminStaff||[]).forEach(function(x){ byId[x.id]=x; });
  var mine = C===S.me.campus;
  var minBtn=function(dept, min){
    var label=esc(t(min))+' <span class="rowSub">· '+esc(t(dept))+'</span>';
    return mine ? '<button class="linkbtn" style="width:auto;margin:0;padding:6px 0;text-align:left" data-gonumbers="'+esc(dept+'|'+min)+'">'+esc(t(min))+'</button> <span class="rowSub">· '+esc(t(dept))+'</span>' : label;
  };
  var D=(typeof getDepartments==='function') ? getDepartments(C) : {};
  var mins=[]; Object.keys(D).forEach(function(dept){ if(dept===BL_DEPT) return; Object.keys(D[dept]).forEach(function(m){ if(!numbersExempt_(dept, m)) mins.push({dept:dept, min:m}); }); });
  var total=0, out='';

  // 1. nobody set to enter the numbers
  var r1=[];
  mins.forEach(function(x){
    var p=L.people[C+'|'+x.dept+'|'+x.min];
    var gone=function(id){ var who=byId[id]; return id && (!who || !who.active || who.archived) ? (who ? who.name : t('someone')) : ''; };
    if(p && p.main){
      var g=gone(p.main) || gone(p.backup);
      if(g) r1.push(minBtn(x.dept, x.min)+'<div class="rowSub">'+esc(gpT('{name} is set to enter these but is no longer active',{name:g}))+'</div>');
      return;
    }
    var leads=staff.filter(function(s2){ return (s2.leads||[]).indexOf(x.dept+'|'+x.min)>-1; });
    r1.push(minBtn(x.dept, x.min)+'<div class="rowSub">'+esc(leads.length ? gpT('nobody set — {name} covers it as its leader',{name:leads[0].name}) : t('nobody set, and no leader to cover it'))+'</div>');
  });
  out+=looseSection_('👤', t('Nobody set to enter the numbers'), t('Each ministry needs a main person for its Friday numbers. Open the ministry and choose one.'), r1);
  total+=r1.length;

  // 2. no numbers for three weeks or more
  var r2=[];
  if(L.week>3) mins.forEach(function(x){
    var lw=L.lastWeek[C+'|'+x.dept+'|'+x.min];
    if(lw && lw>=L.week-2) return;
    r2.push(minBtn(x.dept, x.min)+'<div class="rowSub">'+esc(lw ? gpT('last numbers: week {wk}',{wk:lw}) : t('no numbers yet this year'))+'</div>');
  });
  out+=looseSection_('📉', t('No numbers for three weeks or more'), t('The base’s totals are missing these ministries.'), r2);
  total+=r2.length;

  // 3. not opened in 30 days
  var r3=[], extra='';
  var counted = L.seenSince && looseDays_(L.today, L.seenSince)>=30;
  if(counted){
    staff.forEach(function(x){
      var d=L.seen[x.id];
      if(d && looseDays_(L.today, d)<30) return;
      r3.push(loosePersonBtn_(x, d ? gpT('last opened {date}',{date:looseDay_(d)}) : gpT('not since {date}',{date:looseDay_(L.seenSince)})));
    });
  } else {
    extra='<div class="rowSub" style="margin-top:6px">'+esc(L.seenSince ? gpT('Counting since {date} — this fills in from {date2}.',{date:looseDay_(L.seenSince), date2:looseAddDays_(L.seenSince, 30)}) : t('Counting starts the next time someone opens the app.'))+'</div>';
  }
  out+=looseSection_('💤', t('Not opened the app in 30 days'), t('They may have a new phone, a forgotten PIN, or have left.'), counted ? r3 : null, counted ? '' : extra);
  total+=r3.length;

  // 4. no department or ministry
  var r4=staff.filter(function(x){ return !x.dept || !x.ministry; }).map(function(x){ return loosePersonBtn_(x, !x.dept ? t('no department') : t('no ministry')); });
  out+=looseSection_('🧭', t('No department or ministry'), t('Their numbers and check-ins count for nobody until this is set.'), r4);
  total+=r4.length;

  // 5. no mentor (the Mentors page has the detail)
  var r5=staff.filter(function(x){ return !x.mentorId; }).map(function(x){ return loosePersonBtn_(x, ''); });
  out+=looseSection_('🤝', t('No mentor'), t('Everyone should have someone walking with them.'), r5,
    r5.length ? '<button class="linkbtn" style="width:auto;margin-top:6px" data-adminsub="mentors">'+esc(t('Open Mentors'))+'</button>' : '');
  total+=r5.length;

  // 6. objectives nobody has edited in 30 days
  var r6=(L.objectives||[]).filter(function(o){
    return o.campus===C && !o.fed && (!o.updated || looseDays_(L.today, o.updated.slice(0,10))>=30);
  }).map(function(o){ return esc(o.objective)+'<div class="rowSub">'+esc(t(o.dept))+' · '+esc(o.updated ? gpT('last edited {date}',{date:looseDay_(o.updated.slice(0,10))}) : t('never edited'))+'</div>'; });
  out+=looseSection_('🎯', gpT('Q{q} objectives nobody has touched in 30 days',{q:L.quarter}), t('Ones fed by a ministry’s numbers move by themselves and are not listed.'), r6);
  total+=r6.length;

  // 7. the YWAM GP structure: Campus Directors with no International / National, and empty YWAM GP places
  var r7=staff.filter(function(x){ return x.dept===BL_DEPT && x.ministry==='Campus Director' && !x.cdKind; })
    .map(function(x){ return loosePersonBtn_(x, t('Campus Director — International or National not chosen yet')); });
  GP_ROLES.forEach(function(r){
    var held=(S.adminStaff||[]).some(function(x){ return x.active && !x.archived && (x.gpRoles||[x.gpRole]).indexOf(r[0])>-1; });
    if(!held) r7.push(esc(gpRoleLabel_(r[0]))+'<div class="rowSub">'+esc(t('nobody yet — tick it on their account under Positions'))+'</div>');
  });
  out+=looseSection_('🌏', t('The YWAM GP structure isn’t filled in'), t('So the charts, the YWAM GP page and the board see the real picture.'), r7);
  total+=r7.length;

  h+='<p class="sub" style="margin:10px 0">'+esc(total ? gpT('{n} loose ends at {campus}',{n:total, campus:campusName(C)}) : gpT('Nothing loose at {campus}',{campus:campusName(C)}))+'</p>';
  return h+out;
}
/* Admin → Arrivals & departures. A new school or team: pick where they are
   joining and share one sign-up link (gpInviteLink_) — everyone makes their own
   profile, PIN and all. Leaving: tick several people (search, then "Select all
   shown") and archive them in one go (hrArchiveMany), with the date and why, same
   as HR's archive; HR can bring anyone back one at a time. */
S.grp={ campus:'', dept:'', ministry:'', q:'', pick:{}, at:'', reason:'', confirm:false, busy:false };
function adminGroupsHtml_(part){
  var G=S.grp;
  if(!G.campus) G.campus=S.me.campus;
  var depts=deptsFor(G.campus); if(G.dept && depts.indexOf(G.dept)===-1) G.dept='';
  var mins=G.dept ? ministriesFor(G.campus, G.dept) : []; if(G.ministry && mins.indexOf(G.ministry)===-1) G.ministry='';
  var link=gpInviteLink_(G.campus, G.dept, G.ministry);
  var h='';
  if(part==='link') h+='<div class="card"><div class="goalCardTitle">👋 '+esc(t('Invite a new group'))+'</div>'+
    '<p class="looseWhy">'+esc(t('Everyone opens the link on their own phone and makes their own profile and PIN — with where they are joining already chosen.'))+'</p>'+
    '<label class="f">'+esc(t('Campus'))+'</label><select id="grpCampus">'+CAMPUSES.map(function(c){ return '<option value="'+c.id+'"'+(c.id===G.campus?' selected':'')+'>'+esc(c.name)+'</option>'; }).join('')+'</select>'+
    '<label class="f">'+esc(t('Department'))+'</label><select id="grpDept"><option value="">'+esc(t('— they choose —'))+'</option>'+depts.map(function(d){ return '<option value="'+esc(d)+'"'+(d===G.dept?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+'</select>'+
    (G.dept ? '<label class="f">'+esc(t('Ministry'))+'</label><select id="grpMin"><option value="">'+esc(t('— they choose —'))+'</option>'+mins.map(function(m){ return '<option value="'+esc(m)+'"'+(m===G.ministry?' selected':'')+'>'+esc(t(m))+'</option>'; }).join('')+'</select>' : '')+
    '<label class="f">'+esc(t('The link'))+'</label><input type="text" id="grpLink" readonly value="'+esc(link)+'">'+
    '<div class="btnRow" style="margin-top:8px"><button class="btn" id="grpCopy">'+esc(t('Copy link'))+'</button>'+
    (navigator.share ? '<button class="btn ghost" id="grpShare">'+esc(t('Share'))+'</button>' : '')+'</div>'+
    (G.dept===BL_DEPT ? '<p class="hint">'+esc(t('Campus Leadership sign-ups still wait for an admin to approve them.'))+'</p>' : '')+
    '</div>';
  if(part==='link') return h+'<p class="hint">'+esc(t('Students don’t use this link — make their profiles on 🎓 Students, and they join with Google.'))+'</p>';

  // archive several
  if(S.adminStaff===null) return h+'<p class="sub">'+esc(t('Loading…'))+'</p>';
  var C = CAMPUSES.some(function(c){ return c.id===S.adminCampusTab; }) ? S.adminCampusTab : S.me.campus;
  S.adminCampusTab=C;
  var q=G.q.trim().toLowerCase();
  var all=(S.adminStaff||[]).filter(function(x){ return x.campus===C && x.active && !x.archived && x.id!==S.me.id; })
    .sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
  var shown=all.filter(function(x){ return !q || [x.name, x.username, x.dept, x.ministry, x.role, t(x.ministry||''), t(x.dept||'')].join(' ').toLowerCase().indexOf(q)>-1; });
  var picked=Object.keys(G.pick).filter(function(id){ return G.pick[id]; });
  h+='<div class="card"><div class="goalCardTitle">🚪 '+esc(t('Archive several people'))+'</div>'+
    '<p class="looseWhy">'+esc(t('When a school or team leaves: they can no longer log in, and drop off the lists. HR can bring anyone back.'))+'</p>'+
    '<div class="deptChips">'+CAMPUSES.map(function(c){ return '<button class="deptChip'+(c.id===C?' on':'')+'" data-admincampustab="'+esc(c.id)+'">'+esc(c.short)+'</button>'; }).join('')+'</div>'+
    '<input type="search" id="grpSearch" placeholder="'+esc(t('Find by name, ministry or role…'))+'" value="'+esc(G.q)+'" style="margin:8px 0">'+
    '<div class="btnRow" style="margin-bottom:6px"><button class="btn ghost" id="grpAll">'+esc(gpT('Select all shown ({n})',{n:shown.length}))+'</button>'+
    '<button class="btn ghost" id="grpNone">'+esc(t('Clear'))+'</button></div>'+
    '<div id="grpList">'+shown.map(function(x){
      return '<label class="grpRow"><input type="checkbox" data-grppick="'+esc(x.id)+'"'+(G.pick[x.id]?' checked':'')+'> '+avatarHtml(x,'sm')+
        '<span style="min-width:0"><b>'+esc(x.name)+'</b><span class="rowSub" style="display:block">'+esc([t(x.ministry||''), x.role||''].filter(Boolean).join(' · ') || t('no ministry'))+'</span></span></label>';
    }).join('')+(shown.length ? '' : '<p class="rowSub">'+esc(t('No one matches that search.'))+'</p>')+'</div>';
  if(picked.length){
    h+='<label class="f">'+esc(t('Leaving on'))+'</label><input type="date" id="grpAt" value="'+esc(G.at||todayStr())+'">'+
      '<label class="f">'+esc(t('Why (optional)'))+'</label><input type="text" id="grpReason" value="'+esc(G.reason)+'" placeholder="'+esc(t('e.g. DTS finished'))+'">';
    if(!G.confirm) h+='<button class="btn" id="grpArchive" style="background:var(--bad);border-color:var(--bad)">'+esc(gpT('Archive {n} people',{n:picked.length}))+'</button>';
    else h+='<div class="banner" style="margin-top:10px">'+esc(gpT('Archive {n} people? They will not be able to log in.',{n:picked.length}))+'</div>'+
      '<div class="btnRow"><button class="btn" id="grpYes" style="background:var(--bad);border-color:var(--bad)">'+esc(gpT('Yes, archive {n}',{n:picked.length}))+'</button><button class="btn ghost" id="grpNo">'+esc(t('Cancel'))+'</button></div>';
  }
  return h+'</div>';
}
function bindAdminGroups_(){
  var G=S.grp, on=function(id, ev, fn){ var el=document.getElementById(id); if(el) el[ev]=fn; return el; };
  on('grpCampus','onchange',function(e){ G.campus=e.target.value; G.dept=''; G.ministry=''; render(); });
  on('grpDept','onchange',function(e){ G.dept=e.target.value; G.ministry=''; render(); });
  on('grpMin','onchange',function(e){ G.ministry=e.target.value; render(); });
  on('grpCopy','onclick',function(){
    var v=document.getElementById('grpLink').value;
    var done=function(){ showMsg(t('Link copied')); };
    try { navigator.clipboard.writeText(v).then(done, function(){ document.getElementById('grpLink').select(); document.execCommand('copy'); done(); }); }
    catch(e){ document.getElementById('grpLink').select(); try { document.execCommand('copy'); } catch(e2){} done(); }
  });
  on('grpShare','onclick',function(){ try { navigator.share({ title:'YWAM GP', url:document.getElementById('grpLink').value }); } catch(e){} });
  var sr=on('grpSearch','oninput',function(){ G.q=sr.value; var pos=sr.selectionStart; render(); var a=document.getElementById('grpSearch'); if(a){ a.focus(); try { a.setSelectionRange(pos,pos); } catch(e){} } });
  document.querySelectorAll('[data-grppick]').forEach(function(c){ c.onchange=function(){ G.pick[c.getAttribute('data-grppick')]=c.checked; G.confirm=false; render(); }; });
  on('grpAll','onclick',function(){ document.querySelectorAll('[data-grppick]').forEach(function(c){ G.pick[c.getAttribute('data-grppick')]=true; }); G.confirm=false; render(); });
  on('grpNone','onclick',function(){ G.pick={}; G.confirm=false; render(); });
  on('grpAt','onchange',function(e){ G.at=e.target.value; });
  on('grpReason','oninput',function(e){ G.reason=e.target.value; });
  on('grpArchive','onclick',function(){ G.confirm=true; render(); });
  on('grpNo','onclick',function(){ G.confirm=false; render(); });
  on('grpYes','onclick',function(){
    if(G.busy) return;
    var ids=Object.keys(G.pick).filter(function(id){ return G.pick[id]; });
    G.busy=true;
    run('hrArchiveMany',[S.auth.user,S.auth.pin,ids,{ at:G.at||todayStr(), reason:G.reason }],function(d){
      G.busy=false; G.confirm=false;
      if(d && d.ok){ G.pick={}; G.reason=''; showMsg(gpT('{n} archived',{n:d.archived})); adminRefreshQuiet_(); }
      else showMsg(t('Could not save'));
      render();
    });
  });
}
function adminApprovalsHtml_(){
  if(S.adminStaff===null) return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  var pending=S.adminStaff.filter(function(x){ return !x.active && !x.archived; });   // an archived person is not a sign-up
  var moves=S.adminStaff.filter(function(x){ return x.active && !x.archived && x.cltRequest; });
  if(!pending.length && !moves.length) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Nobody is waiting — every account is active.'))+'</p></div>';
  var h='';
  /* staff asking to move into Campus Leadership from Profile & settings */
  if(moves.length){
    h+='<h3>🧭 '+esc(t('Moving into Campus Leadership'))+'</h3><div class="card">';
    moves.forEach(function(x){
      h+='<div class="row cltMove"><div><div class="rowName">'+esc(x.name)+'</div>'+
        '<div class="rowSub">'+esc(campusShort(x.campus))+' · '+esc(t(x.dept))+(x.ministry?' · '+esc(t(x.ministry)):'')+' → <b>'+esc(cltRequestTitle_(x.cltRequest))+'</b></div></div>'+
        '<span style="display:flex;gap:6px"><button class="btn" style="width:auto;margin:0;padding:9px 14px;font-size:14px" data-cltyes="'+esc(x.id)+'">'+esc(t('Approve'))+'</button>'+
        '<button class="btn ghost" style="width:auto;margin:0;padding:9px 12px;font-size:14px" data-cltno="'+esc(x.id)+'">'+esc(t('Decline'))+'</button></span></div>';
    });
    h+='</div>';
    if(!pending.length) return h;
    h+='<h3>✅ '+esc(t('New sign-ups'))+'</h3>';
  }
  h+='<div class="card">';
  pending.forEach(function(x){
    h+='<div class="row"><div><div class="rowName">'+esc(x.name)+'</div>'+
      '<div class="rowSub">@'+esc(x.username)+' · '+esc(campusShort(x.campus))+' · '+esc(t(x.dept))+(x.ministry?' · '+esc(t(x.ministry)):'')+'</div></div>'+
      '<button class="btn" style="width:auto;margin:0;padding:9px 14px" data-adminapprove="'+esc(x.id)+'">'+esc(t('Approve'))+'</button></div>';
  });
  return h+'</div>';
}
/* Admin → Portal access. Who may work applications on the YWAM GP Portal
   (portal.html) — nobody gets it by being staff; an admin ticks it here. Two
   levels: portal staff (see every applicant, move stages, notes, owner) and
   portal admin (that, plus granting portal staff from inside the portal).
   One campus at a time, same chips as Mentors. Applicant accounts are not
   in this list at all — adminListStaff leaves them out. */
function adminPortalHtml_(){
  if(S.adminStaff===null) return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  var everyone=S.adminStaff.filter(function(x){ return x.active && !x.archived; });
  /* The Outreach Teams leader works team applications without a tick (see
     leadsTeams_ in api.js) — said on their row so the list is the whole story. */
  var leadsTeams=function(x){ return (x.leads||[]).indexOf('Community Service|Outreach Teams')>-1; };
  var tabs=CAMPUSES.map(function(c){ return { id:c.id, label:c.short, n:everyone.filter(function(x){ return x.campus===c.id && (x.portalStaff||x.portalAdmin||leadsTeams(x)); }).length }; });
  var activeTab = tabs.some(function(tb){ return tb.id===S.adminPortalCampus; }) ? S.adminPortalCampus
    : (tabs.some(function(tb){ return tb.id===S.me.campus; }) ? S.me.campus : tabs[0].id);
  S.adminPortalCampus=activeTab;
  var h='<div class="banner">🛂 '+esc(t('The portal is where students, staff, volunteers and teams apply. Only the people ticked here can see applications.'))+
    ' <a class="linkbtn inline" href="portal.html" target="_blank" rel="noopener" style="width:auto;padding:0">'+esc(t('Open the portal'))+' ↗</a></div>';
  h+='<div class="deptChips">'+tabs.map(function(tb){
    return '<button class="deptChip'+(activeTab===tb.id?' on':'')+'" data-adminportalcampus="'+esc(tb.id)+'">'+esc(tb.label)+' · '+tb.n+'</button>'; }).join('')+'</div>';
  var people=everyone.filter(function(x){ return x.campus===activeTab; }).sort(function(a,b){
    var ra=(a.isAdmin?4:0)+(a.portalAdmin?2:0)+(a.portalStaff?1:0)+(leadsTeams(a)?0.5:0), rb=(b.isAdmin?4:0)+(b.portalAdmin?2:0)+(b.portalStaff?1:0)+(leadsTeams(b)?0.5:0);
    return rb-ra || (a.name<b.name?-1:1); });
  var withN=people.filter(function(x){ return x.portalStaff||x.portalAdmin||x.isAdmin||leadsTeams(x); }).length;
  h+='<div class="mmGrid">'+[[t('Can see applications'), withN, false],[t('Portal admins'), people.filter(function(x){ return x.portalAdmin||x.isAdmin; }).length, false]]
    .map(function(x){ return '<div class="mmTile"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  if(!people.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('No accounts yet.'))+'</p></div>';
  h+='<p class="sub" style="margin:0 0 6px">'+esc(t('Portal staff see every applicant and move them along. A portal admin can also grant portal staff. App admins always have both.'))+'</p>';
  h+='<div class="accCard adminList">'+people.map(function(x){
    var isAdm=!!x.isAdmin;
    return '<div class="adminRow portalRow" data-adminrow="'+esc((x.name+' '+x.username).toLowerCase())+'">'+
      '<button class="portalWho" data-adminperson="'+esc(x.id)+'">'+avatarHtml(x,'sm')+
        '<span class="adminRowText"><span class="rowName">'+esc(x.name)+(isAdm?' <span class="hrChip active">'+esc(t('Admin'))+'</span>':'')+'</span>'+
        '<span class="rowSub">'+esc(t(x.dept))+(x.ministry?' · '+esc(t(x.ministry)):'')+'</span>'+
        (leadsTeams(x) && !x.portalStaff && !x.portalAdmin && !isAdm ? '<span class="rowSub" data-teamsleader>🌍 '+esc(t('Team applications — leads Outreach Teams'))+'</span>' : '')+
        '</span></button>'+
      '<label class="portalTick"><input type="checkbox" data-portalstaff="'+esc(x.id)+'"'+((x.portalStaff||isAdm)?' checked':'')+(isAdm?' disabled':'')+'> '+esc(t('Portal staff'))+'</label>'+
      '<label class="portalTick"><input type="checkbox" data-portaladmin="'+esc(x.id)+'"'+((x.portalAdmin||isAdm)?' checked':'')+(isAdm?' disabled':'')+'> '+esc(t('Portal admin'))+'</label>'+
    '</div>';
  }).join('')+'</div>';
  return h;
}
function adminMergeHtml_(){
  if(S.adminStaff===null) return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  var list=S.adminStaff;
  if(list.length<2) return '<div class="card"><p class="sub" style="margin:0">'+esc(t('Nothing to merge yet.'))+'</p></div>';
  var h='<div class="card">';
  h+='<p class="sub" style="margin:0 0 8px">'+esc(t('For one person who accidentally made two profiles. Pick which to keep — its history, plus whatever the other logged that doesn’t already overlap, moves onto it. The other account is then deleted.'))+'</p>';
  var mergeOpts_ = function(markSecond){
    return list.map(function(x,i){
      return '<option value="'+esc(x.id)+'"'+(markSecond && i===1?' selected':'')+'>'+
        esc(x.name)+' · '+esc(x.username)+(x.email?' · '+esc(x.email):'')+'</option>';
    }).join('');
  };
  h+='<div class="pickerRow">'+
    '<label class="pick"><span>'+esc(t('Keep'))+'</span><select id="mergeKeepSel">'+mergeOpts_(false)+'</select></label>'+
    '<label class="pick"><span>'+esc(t('Delete (merge from)'))+'</span><select id="mergeFromSel">'+mergeOpts_(true)+'</select></label>'+
  '</div>'+
  '<button class="danger" id="mergeStaffBtn">'+esc(t('Merge accounts'))+'</button></div>';
  return h;
}
/* Who is walking with whom: one card per mentor with their people (and
   whether each has accepted yet), then everyone with no mentor. Tapping a
   name opens their account page, where the mentor is set. */
function adminMentorsHtml_(){
  if(S.adminStaff===null) return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  // one campus at a time, opening on the admin's own — the two bases' pairs mixed together read as one confusing list
  var everyone=S.adminStaff.filter(function(x){ return x.active && !x.archived; });
  var tabs=CAMPUSES.map(function(c){ return { id:c.id, label:c.short, n:everyone.filter(function(x){ return x.campus===c.id; }).length }; });
  var activeTab = tabs.some(function(tb){ return tb.id===S.adminMentorCampus; }) ? S.adminMentorCampus
    : (tabs.some(function(tb){ return tb.id===S.me.campus; }) ? S.me.campus : tabs[0].id);
  S.adminMentorCampus=activeTab;
  var h='<div class="deptChips">'+tabs.map(function(tb){
    return '<button class="deptChip'+(activeTab===tb.id?' on':'')+'" data-adminmentorcampus="'+esc(tb.id)+'">'+esc(tb.label)+' · '+tb.n+'</button>'; }).join('')+'</div>';
  var people=everyone.filter(function(x){ return x.campus===activeTab; });
  var byId={}; S.adminStaff.forEach(function(x){ byId[x.id]=x; });
  var groups={}, none=[];
  people.forEach(function(x){
    if(x.mentorId && byId[x.mentorId]){ (groups[x.mentorId]=groups[x.mentorId]||[]).push(x); }
    else none.push(x);
  });
  var mentorIds=Object.keys(groups).sort(function(a,b){ return byId[a].name<byId[b].name?-1:1; });
  var withN=people.length-none.length, pendingN=people.filter(function(x){ return x.mentorId && x.mentorStatus!=='approved'; }).length;
  h+='<div class="mmGrid">'+[
      [t('Mentors'), mentorIds.length, false], [t('With a mentor'), withN+' / '+people.length, false],
      [t('Waiting to accept'), pendingN, pendingN>0], [t('No mentor yet'), none.length, none.length>0]
    ].map(function(x){ return '<div class="mmTile'+(x[2]?' hot':'')+'"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  var row=function(x, extra){
    return '<div data-adminrow="'+esc((x.name+' '+x.username).toLowerCase())+'"><button class="adminRow" data-adminperson="'+esc(x.id)+'">'+avatarHtml(x,'sm')+
      '<span class="adminRowText"><span class="rowName">'+esc(x.name)+'</span><span class="rowSub">'+esc(t(x.dept))+(x.ministry?' · '+esc(t(x.ministry)):'')+'</span></span>'+
      (extra||'')+'<span class="accChevron" style="transform:rotate(-90deg)">'+ACC_CHEVRON+'</span></button></div>';
  };
  if(!mentorIds.length && !none.length) return h+'<div class="card"><p class="sub" style="margin:0">'+esc(t('No accounts yet.'))+'</p></div>';
  mentorIds.forEach(function(id){
    var m=byId[id], kids=groups[id].slice().sort(function(a,b){ return a.name<b.name?-1:1; });
    h+='<div class="adminMentor" data-adminmentor="'+esc(id)+'"><button class="adminMentorHead" data-adminperson="'+esc(id)+'">'+avatarHtml(m,'sm')+
      '<span class="adminRowText"><span class="rowName"><b>'+esc(m.name)+'</b></span><span class="rowSub">'+(m.campus!==activeTab?'📍 '+esc(campusShort(m.campus))+' · ':'')+esc(t(m.dept))+(m.active&&!m.archived?'':' · '+esc(t('Archived')))+'</span></span>'+
      '<span class="adminBadge">'+kids.length+'</span></button>'+
      '<div class="accCard adminList" style="margin:0 0 0 18px">'+kids.map(function(k){
        return row(k, k.mentorStatus==='approved' ? '' : '<span class="hrChip due">'+esc(t('Waiting'))+'</span>'); }).join('')+'</div></div>';
  });
  if(none.length){
    h+='<h3>🙋 '+esc(t('No mentor yet'))+' <small>· '+none.length+'</small></h3>';
    h+='<p class="sub" style="margin:0 0 6px">'+esc(t('Open someone to set their mentor.'))+'</p>';
    h+='<div class="accCard adminList">'+none.sort(function(a,b){ return a.name<b.name?-1:1; }).map(function(x){ return row(x,''); }).join('')+'</div>';
  }
  return h;
}

/* Everyone's leave, one campus at a time: what is waiting for a yes (an
   admin may decide it — a mentor normally does, but a request from someone
   with no mentor has nobody else), what is coming up, this year's history,
   and each person's days used against the cap. Read from adminListTrips
   on first open. */
function adminLeaveHtml_(){
  if(S.adminLeaveError) return '<div class="card"><p class="sub" style="margin:0 0 8px">⚠️ '+esc(t('Couldn’t load the leave requests.'))+'</p><p class="hint" style="margin:0 0 8px;overflow-wrap:anywhere">'+esc(S.adminLeaveError)+'</p><button class="btn ghost" id="adminLeaveRetry" style="margin-top:0">'+esc(t('Try again'))+'</button></div>';
  var L=S.adminLeave;
  if(!L) return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  var yNow=new Date().getFullYear(), year=S.adminLeaveYear||yNow, today=todayStr();
  var tabs=CAMPUSES.map(function(c){ return { id:c.id, label:c.short, n:L.trips.filter(function(tr){ return tr.campus===c.id && String(tr.from).slice(0,4)===String(year); }).length }; });
  var activeTab = tabs.some(function(tb){ return tb.id===S.adminLeaveCampus; }) ? S.adminLeaveCampus
    : (tabs.some(function(tb){ return tb.id===S.me.campus; }) ? S.me.campus : tabs[0].id);
  S.adminLeaveCampus=activeTab;
  var years=[]; L.trips.forEach(function(tr){ var y=String(tr.from).slice(0,4); if(years.indexOf(y)===-1) years.push(y); }); if(years.indexOf(String(yNow))===-1) years.push(String(yNow)); years.sort().reverse();
  var h='<div class="deptChips">'+tabs.map(function(tb){
    return '<button class="deptChip'+(activeTab===tb.id?' on':'')+'" data-adminleavecampus="'+esc(tb.id)+'">'+esc(tb.label)+' · '+tb.n+'</button>'; }).join('')+'</div>';
  h+='<div class="pickerRow"><label class="pick" style="max-width:130px"><span>'+esc(t('Year'))+'</span><select id="adminLeaveYear">'+years.map(function(y){ return '<option value="'+y+'"'+(String(year)===y?' selected':'')+'>'+y+'</option>'; }).join('')+'</select></label></div>';
  var mine=L.trips.filter(function(tr){ return tr.campus===activeTab; });
  var inYear=mine.filter(function(tr){ return String(tr.from).slice(0,4)===String(year); });
  var waiting=mine.filter(function(tr){ return (tr.status==='pending'||tr.status==='noted') && tr.active; }).sort(function(a,b){ return a.from<b.from?-1:1; });
  var upcoming=inYear.filter(function(tr){ return tr.status==='approved' && tr.to>=today; }).sort(function(a,b){ return a.from<b.from?-1:1; });
  var away=upcoming.filter(function(tr){ return tr.from<=today; });
  var past=inYear.filter(function(tr){ return !(tr.status==='approved' && tr.to>=today) && !((tr.status==='pending'||tr.status==='noted') && tr.active); }).sort(function(a,b){ return a.from<b.from?1:-1; });
  h+='<div class="mmGrid">'+[
      [t('Waiting for a yes'), waiting.length, waiting.length>0], [t('Away right now'), away.length, false],
      [t('Coming up'), upcoming.length-away.length, false], [gpT('Requests in {year}',{year:year}), inYear.length, false]
    ].map(function(x){ return '<div class="mmTile'+(x[2]?' hot':'')+'"><div class="mmTileName">'+esc(x[0])+'</div><div class="mmTileNum">'+esc(String(x[1]))+'</div></div>'; }).join('')+'</div>';
  var statusChip=function(tr){
    var k=tr.status==='approved'?'active':tr.status==='declined'?'expired':(tr.status==='pending'||tr.status==='noted')?'due':'';
    var label=tr.status==='approved'?t('Approved'):tr.status==='declined'?t('Declined'):tr.status==='noted'?t('Noted — no mentor'):t('Waiting');
    return '<span class="hrChip '+k+'">'+esc(label)+'</span>';
  };
  var row=function(tr, actions){
    var range=teamDate_(tr.from)+(tr.to!==tr.from?' → '+teamDate_(tr.to):'');
    return '<div class="card slim leaveRow" data-adminleave="'+esc(tr.id)+'"><div class="teamHead"><div style="min-width:0">'+
      '<div class="rowName"><button class="linkbtn inline" style="font-size:inherit;font-weight:700;text-decoration:none;color:var(--ink)" data-adminperson="'+esc(tr.staffId)+'">'+esc(tr.name)+'</button> <span class="rowSub">· '+esc(t(tr.dept))+'</span></div>'+
      '<div class="rowSub">📅 '+esc(range)+' · '+esc(gpT('{n} work days',{n:tr.workDays}))+' · '+esc(t(leaveTypeLabel_(tr.type)))+'</div>'+
      (tr.reason?'<div class="rowSub">'+esc(tr.reason)+'</div>':'')+
      (tr.coverage?'<div class="rowSub">🤝 '+esc(t('Cover'))+': '+esc(tr.coverage)+'</div>':'')+
      (tr.status==='pending' && tr.mentorName ? '<div class="hint">'+esc(gpT('Waiting on {name}',{name:tr.mentorName}))+'</div>' : tr.decidedBy ? '<div class="hint">'+esc(gpT('Decided by {name}',{name:tr.decidedBy}))+'</div>' : '')+
      '</div>'+statusChip(tr)+'</div>'+(actions||'')+'</div>';
  };
  var decide=function(tr){ return '<div class="leaveActions"><button class="btn ghost" data-adminleaveok="'+esc(tr.id)+'">'+esc(t('Approve'))+'</button><button class="btn ghost" data-adminleaveno="'+esc(tr.id)+'">'+esc(t('Decline'))+'</button></div>'; };
  h+='<h3>⏳ '+esc(t('Waiting for a yes'))+' <small>· '+waiting.length+'</small></h3>';
  if(!waiting.length) h+='<div class="card slim"><p class="sub" style="margin:0">'+esc(t('Nothing waiting.'))+'</p></div>';
  waiting.forEach(function(tr){ h+=row(tr, decide(tr)); });
  h+='<h3>✈️ '+esc(t('Away now or coming up'))+' <small>· '+upcoming.length+'</small></h3>';
  if(!upcoming.length) h+='<div class="card slim"><p class="sub" style="margin:0">'+esc(t('Nobody is away or booked to be.'))+'</p></div>';
  upcoming.forEach(function(tr){ h+=row(tr); });
  // days used this year, per person on this campus
  var people={}; inYear.forEach(function(tr){ if(tr.status!=='declined') people[tr.staffId]=tr.name; });
  var ids=Object.keys(people).sort(function(a,b){ return people[a]<people[b]?-1:1; });
  if(ids.length){
    h+='<h3>📊 '+esc(gpT('Days used in {year}',{year:year}))+'</h3><div class="card slim">'+
      '<p class="hint" style="margin:0 0 6px">'+esc(gpT('Work days. Personal time off is capped at {n} a year; working outside and special condition are tracked separately.',{n:L.ptoCap}))+'</p>';
    ids.forEach(function(id){
      var tot=(L.totals[id]||{})[year]||{ outside:0, special:0, personal:0 };
      var over=tot.personal>L.ptoCap;
      h+='<div class="row"><div><div class="rowName"><button class="linkbtn inline" style="text-decoration:none;color:var(--ink);font-size:inherit" data-adminperson="'+esc(id)+'">'+esc(people[id])+'</button></div>'+
        '<div class="rowSub">'+esc(t('Personal'))+' <b'+(over?' style="color:var(--bad)"':'')+'>'+tot.personal+'</b>/'+L.ptoCap+' · '+esc(t('Outside'))+' '+tot.outside+' · '+esc(t('Special'))+' '+tot.special+'</div></div></div>';
    });
    h+='</div>';
  }
  h+='<div class="accCard" style="margin-top:12px">'+accRowHtml('adminAcc', 'holidays', '🎉 '+esc(t('National holidays')), esc(t('Not counted as leave. Khmer New Year and Christmas week come round on their own; set Pchum Ben each year.')), function(){ return adminHolidaysHtml_(L, year); })+'</div>';
  h+='<div class="accCard" style="margin-top:12px">'+accRowHtml('adminAcc', 'leavePast', '🗂️ '+esc(gpT('Earlier in {year}',{year:year}))+' · '+past.length, esc(t('Approved, declined and noted requests that are over')), function(){
    return past.length ? past.map(function(tr){ return row(tr); }).join('') : '<p class="sub" style="margin:0">'+esc(t('Nothing earlier this year.'))+'</p>'; })+'</div>';
  return h;
}

/* The holidays not counted as leave: the two that come round on their own
   (fixed, every year) and the dated ones (Pchum Ben…) an admin keeps. Saving
   recounts everyone's days at once — the server always counts from dates. */
function adminHolidaysHtml_(L, year){
  var h='<div id="adminHolidays">'+leaveHolidaysHtml_(L.holidays, year);
  var list=S.holDraft || (L.holidaysDated||[]).map(function(x){ return { id:x.id, name:x.name, from:x.from, to:x.to }; });
  h+='<p class="hint" style="margin:8px 0 4px">'+esc(t('Dated holidays (change them for each year):'))+'</p>';
  list.forEach(function(x, i){
    h+='<div class="holRow"><input type="text" data-hol="'+i+'" data-hf="name" value="'+esc(x.name)+'" maxlength="60" aria-label="'+esc(t('Name'))+'">'+
      '<input type="date" data-hol="'+i+'" data-hf="from" value="'+esc(x.from)+'" aria-label="'+esc(t('From'))+'"><input type="date" data-hol="'+i+'" data-hf="to" value="'+esc(x.to)+'" aria-label="'+esc(t('To'))+'">'+
      '<button class="linkbtn inline teamDelete" data-holdel="'+i+'" aria-label="'+esc(t('Remove'))+'">✕</button></div>';
  });
  h+='<button class="btn ghost small" id="holAdd" style="width:auto;margin:6px 8px 0 0;padding:8px 12px;font-size:14px">＋ '+esc(t('Add a holiday'))+'</button>';
  h+='<button class="btn small" id="holSave" style="width:auto;margin:6px 0 0;padding:8px 12px;font-size:14px">'+esc(t('Save holidays'))+'</button>';
  return h+'</div>';
}
/* One person's account, on its own page: who they are at the top, then the
   same sections the accordion used to hold (adminRowBodyHtml_ — reset PIN,
   profile, mentor, admin access, danger zone), unchanged. */
function adminPersonHtml_(){
  var h=adminBackHtml_('accounts', t('Accounts'));
  if(S.adminStaff===null) return h+'<p class="sub">'+esc(t('Loading…'))+'</p>';
  var x=S.adminStaff.filter(function(p){ return p.id===S.adminPersonId; })[0];
  var mine = !!x.id && x.id===S.me.id;
  var chips='';
  if(x.archived) chips+='<span class="teamStat">📦 '+esc(t('Archived'))+(x.archived.at?' · '+esc(x.archived.at):'')+'</span>';
  else if(!x.active) chips+='<span class="teamStat">⏳ '+esc(t('Pending approval'))+'</span>';
  if(x.isAdmin) chips+='<span class="teamStat">🛡️ '+esc(t('Admin'))+'</span>';
  if(x.hr) chips+='<span class="teamStat">🗂️ '+esc(t('HR'))+'</span>';
  var mentor=x.mentorId ? S.adminStaff.filter(function(p){ return p.id===x.mentorId; })[0] : null;
  if(mentor) chips+='<span class="teamStat">🤝 '+esc(gpT('Mentor: {name}',{name:mentor.name}))+(x.mentorStatus==='approved'?'':' · '+esc(t('waiting')))+'</span>';
  (x.leads||[]).forEach(function(k){ chips+='<span class="teamStat">👑 '+esc(t(k.split('|')[1]||k))+'</span>'; });
  h+='<div class="card"><div class="adminPersonHead">'+avatarHtml(x,'lg')+'<div style="min-width:0">'+
    '<div class="pname">'+esc(x.name)+(mine?' <span class="hint" style="display:inline">('+esc(t('you'))+')</span>':'')+'</div>'+
    '<div class="pmeta">@'+esc(x.username)+(x.email?' · '+esc(x.email):'')+'</div>'+
    '<div class="pmeta">'+esc(campusName(x.campus))+' · '+esc(t(x.dept))+(x.ministry?' · '+esc(t(x.ministry)):'')+(x.role?' · '+esc(x.role):'')+'</div>'+
    '</div></div>'+(chips?'<div class="teamStats">'+chips+'</div>':'')+'</div>';
  h+='<div class="card">'+adminRowBodyHtml_(x)+'</div>';
  return h;
}

function adminBroadcastHtml_(){
  return '<div class="card">'+
    '<p class="sub" style="margin:0 0 8px">'+esc(t('Goes straight to everyone’s notification bell.'))+'</p>'+
    '<div class="field"><textarea id="broadcastText" maxlength="500" placeholder="'+
      esc(t('What do you want everyone to know?'))+'">'+esc(S.broadcastDraft||'')+'</textarea></div>'+
    '<button class="btn" id="broadcastSendBtn">'+esc(t('Send to everyone'))+'</button></div>';
}

function adminKpisHtml_(){
  var h='<div class="card">';
  h+='<p class="sub" style="margin:0 0 8px">'+esc(t('Pick a ministry to edit what it tracks.'))+'</p>';
  var amCampus = CAMPUSES.some(function(c){ return c.id===S.adminMetricCampus; }) ? S.adminMetricCampus : CAMPUSES[0].id;
  var amDeps = getDepartments(amCampus);
  var amDept = amDeps[S.adminMetricDept] ? S.adminMetricDept : Object.keys(amDeps)[0];
  var amMins = Object.keys(amDeps[amDept]||{});
  var amMin = amMins.indexOf(S.adminMetricMinistry)>-1 ? S.adminMetricMinistry : (amMins[0]||'');
  S.adminMetricCampus=amCampus; S.adminMetricDept=amDept; S.adminMetricMinistry=amMin;
  h+='<div class="pickerRow">'+
    '<label class="pick"><span>'+esc(t('Campus'))+'</span><select id="adminMetricCampusSel">'+
      CAMPUSES.map(function(c){ return '<option value="'+esc(c.id)+'"'+(amCampus===c.id?' selected':'')+'>'+esc(c.short)+'</option>'; }).join('')+
    '</select></label>'+
    '<label class="pick"><span>'+esc(t('Department'))+'</span><select id="adminMetricDeptSel">'+
      Object.keys(amDeps).map(function(d){ return '<option value="'+esc(d)+'"'+(amDept===d?' selected':'')+'>'+esc(t(d))+'</option>'; }).join('')+
    '</select></label>'+
    (amMins.length ? '<label class="pick"><span>'+esc(t('Ministry'))+'</span><select id="adminMetricMinSel">'+
      amMins.map(function(m){ return '<option value="'+esc(m)+'"'+(amMin===m?' selected':'')+'>'+esc(t(m))+'</option>'; }).join('')+
    '</select></label>' : '')+
  '</div>';
  if(amMin){
    S.metricEditTarget = { campus:amCampus, dept:amDept, ministry:amMin };
    h += metricEditorHtml_(amCampus, amDept, amMin);
  } else {
    h += '<p class="sub" style="margin:0">'+esc(t('No ministries under this department.'))+'</p>';
  }
  return h+'</div>';
}

/* A campus's people in two groups by kind of staff — the ministries (cafe,
   schools, outreach, media…) and the people who carry the base itself, YAP
   and campus staff — plus a small third group for anyone whose kind was
   never set, so an admin can see who still needs sorting. Admin → Accounts
   and HR share it. */
function staffGroups_(people, campusLabel){
  return [
    { id:'ministry', label:gpT('{campus} ministries',{campus:campusLabel}), rows:people.filter(function(x){ return x.staffType==='ministry'; }) },
    { id:'campus', label:t('YAP and Campus staff'), rows:people.filter(function(x){ return x.staffType==='yap' || x.staffType==='campus'; }) },
    { id:'unset', label:t('Kind of staff not set yet'), rows:people.filter(function(x){ return x.staffType!=='ministry' && x.staffType!=='yap' && x.staffType!=='campus'; }) }
  ];
}
function adminAccountsHtml_(){
  if(S.adminStaff===null) return '<p class="sub">'+esc(t('Loading…'))+'</p>';
  var h='';
  var list=S.adminStaff;
  /* One campus's worth of accounts on screen at a time, picked by a chip row. */
  var known_=CAMPUSES.map(function(c){ return c.id; });
  var other=list.filter(function(x){ return known_.indexOf(x.campus)===-1; });
  var tabs=CAMPUSES.map(function(c){
    return {id:c.id, label:c.short, n:list.filter(function(x){ return x.campus===c.id; }).length};
  });
  if(other.length) tabs.push({id:'__other', label:t('Other'), n:other.length});
  // opens on the admin's own campus — the people they're usually looking for
  var activeTab = tabs.some(function(tb){ return tb.id===S.adminCampusTab; }) ? S.adminCampusTab
    : (tabs.some(function(tb){ return tb.id===S.me.campus; }) ? S.me.campus : tabs[0].id);
  S.adminCampusTab = activeTab;
  h+='<div class="deptChips">'+tabs.map(function(tb){
    return '<button class="deptChip'+(activeTab===tb.id?' on':'')+'" data-admincampustab="'+esc(tb.id)+'">'+
      esc(tb.label)+' · '+tb.n+'</button>';
  }).join('')+'</div>';

  /* Filters by hiding/showing the wrapper divs directly, no render() involved. */
  h+='<div class="field" style="margin:10px 0 8px"><input type="text" id="adminSearch" value="'+esc(S.adminSearch||'')+'" placeholder="'+
    esc(t('Search by name or username…'))+'"></div>'+
    '<p class="emptyLine" id="adminSearchEmpty" style="display:none">'+esc(t('No one matches that search.'))+'</p>';
  var shown = activeTab==='__other' ? other : list.filter(function(x){ return x.campus===activeTab; });
  if(!shown.length){
    h+='<p class="sub" style="margin:0 0 8px">'+esc(t('No accounts yet.'))+'</p>';
    return h;
  }
  h+='<p class="hint" style="margin:0 0 6px">'+esc(t('Tap someone to open their account.'))+'</p>';
  /* Two groups per campus, by kind of staff: the ministries (cafe, schools,
     outreach, media…) and the people who carry the base itself — YAP and
     campus staff. Anyone whose kind is not set yet gets a third, small
     group so an admin can see who still needs sorting. */
  var groups=staffGroups_(shown, activeTab==='__other' ? t('Other') : campusShort(activeTab));
  groups.forEach(function(g){
    if(!g.rows.length) return;
    h+='<div data-admingroup="'+g.id+'"><div class="mentorLabel" style="margin:12px 0 6px">'+esc(g.label)+' · '+g.rows.length+'</div>';
    h+='<div class="accCard adminList">';
    g.rows.forEach(function(x, i){
    // the row key is the id; an account that somehow has none gets its own per-row key
    var key = x.id || ('row'+i);
    var status = x.archived ? '📦 '+t('Archived') : !x.active ? '⏳ '+t('Pending approval') : (x.isAdmin ? '🛡️ '+t('Admin') : '');
    var leadsN = (x.leads||[]).length;
    var summary = '@'+x.username+' · '+t(x.dept)+(x.ministry?' · '+t(x.ministry):'')+(status?' · '+status:'')+
      (leadsN ? ' · 👑 '+x.leads.map(function(k){ return t(k.split('|')[1]||k); }).join(', ') : '');
    var mine = !!x.id && x.id===S.me.id;
    h+='<div data-adminrow="'+esc((x.name+' '+x.username).toLowerCase())+'">'+
      '<button class="adminRow" data-adminperson="'+esc(key)+'">'+avatarHtml(x,'sm')+
        '<span class="adminRowText"><span class="rowName">'+esc(x.name)+(mine?' <span class="hint" style="display:inline">('+esc(t('you'))+')</span>':'')+'</span>'+
        '<span class="rowSub">'+esc(summary)+'</span></span>'+
        '<span class="accChevron" style="transform:rotate(-90deg)">'+ACC_CHEVRON+'</span></button>'+
    '</div>';
    });
    h+='</div></div>';
  });
  return h;
}

/* Every real ministry on a campus as a checkbox — Campus Leadership's
   "ministries" are department names, not places anyone leads, so they're
   left out. */
function leadsPickHtml_(campus, selected, attr, skipKey){
  attr = attr || 'data-admlead';
  var deps=getDepartments(campus||CAMPUSES[0].id), h='';
  Object.keys(deps).forEach(function(dept){
    if(dept==='Campus Leadership') return;
    Object.keys(deps[dept]).forEach(function(min){
      var key=dept+'|'+min;
      if(key===skipKey) return;   // the main ministry is not also an "other" one
      h+='<label class="leadOpt"><input type="checkbox" '+attr+'="'+esc(key)+'"'+(selected.indexOf(key)>-1?' checked':'')+'> '+
        (MIN_EMOJI[min]?MIN_EMOJI[min]+' ':'')+esc(t(min))+'<span class="pmeta">'+esc(t(dept))+'</span></label>';
    });
  });
  return h || '<p class="sub" style="margin:0">'+esc(t('No ministries on this campus yet.'))+'</p>';
}

function adminRowBodyHtml_(s){
  var mine = !!s.id && s.id===S.me.id;
  /* Grouped under a small-caps label + divider (the same pattern the Health
     tab's monthly questions and Siem Reap's chart already use), so a row with
     five unrelated controls in it — reset PIN, fix info, mentor, admin
     access, delete — reads as five sections instead of one long unlabeled
     stack. That's what "confusing" meant more than any one control being
     broken. */
  var b='<div>';
  if(!mine){
    b+='<button class="btn ghost" style="margin-top:0" data-admintoggleactive="'+esc(s.id)+'">'+
      (s.active? esc(t('Deactivate')) : esc(t('Activate')))+'</button>';
  }

  var pinDraft = S.adminPinDraft[s.id]||'';
  b+='<div class="mentorLabel">🔑 '+esc(t('Reset PIN'))+'</div>'+
    '<div class="numIn"><input type="password" inputmode="numeric" maxlength="4" data-adminpin="'+esc(s.id)+'" value="'+esc(pinDraft)+'" placeholder="••••">'+
    '<button class="btn ghost" style="margin:0;width:auto;padding:9px 14px" data-adminresetpin="'+esc(s.id)+'">'+esc(t('Save'))+'</button></div>'+
    '<div class="mentorDivider"></div>';

  b+='<div class="mentorLabel">✏️ '+esc(t('Profile'))+'</div>';
  if(S.adminEditId!==s.id){
    b+='<button class="btn ghost" data-adminedit="'+esc(s.id)+'">'+esc(t('Edit profile details'))+'</button>';
  } else {
    /* Backed by S.adminEditDraft, not s directly — s is a snapshot from the
       moment the list last loaded, so reading straight from it would throw
       away whatever's typed the instant anything else on this long page
       re-renders (expanding a different row, approving someone, anything).
       That silent reset-to-original was the actual bug behind "it doesn't
       save what I put in": nothing crashed, the fields just quietly forgot
       what you'd typed before you got to Save. */
    var d = S.adminEditDraft || {};
    var dCampus = d.campus!==undefined ? d.campus : (s.campus||'');
    var dDept = d.dept!==undefined ? d.dept : (s.dept||'');
    b+='<label class="f">'+esc(t('Full name'))+'</label><input type="text" id="adm_name" value="'+esc(d.name!==undefined?d.name:(s.name||''))+'">'+
      '<label class="f">'+esc(t('Username'))+'</label><input type="text" id="adm_username" autocapitalize="none" maxlength="20" value="'+esc(d.username!==undefined?d.username:(s.username||''))+'">'+
      '<label class="f">'+esc(t('Campus'))+'</label><select id="adm_campus">'+
      CAMPUSES.map(function(c){return '<option value="'+c.id+'"'+(dCampus===c.id?' selected':'')+'>'+c.name+'</option>';}).join('')+'</select>'+
      '<label class="f">'+esc(t('Department'))+'</label><select id="adm_dept">'+
      deptsFor(dCampus).map(function(dp){return '<option value="'+esc(dp)+'"'+(dDept===dp?' selected':'')+'>'+esc(t(dp))+'</option>';}).join('')+'</select>'+
      '<label class="f">'+esc(t('Main ministry'))+'</label><select id="adm_ministry"></select>'+
      '<label class="f">'+esc(t('Other ministries'))+'</label>'+
      '<p class="hint" style="margin:0 0 6px">'+esc(t('The other ministries they serve in. They see and enter numbers for their main ministry and these.'))+'</p>'+
      '<div class="leadsPick" id="adm_ministries">'+leadsPickHtml_(dCampus, d.ministries!==undefined?d.ministries:(s.ministries||[]), 'data-admmin', (s.dept||'')+'|'+(s.ministry||''))+'</div>'+
      '<label class="f">'+esc(t('Role / team'))+'</label><input type="text" id="adm_role" value="'+esc(d.role!==undefined?d.role:(s.role||''))+'">'+
      staffTypeFieldHtml('adm_type', d.staffType!==undefined?d.staffType:(s.staffType||''))+
      (function(){ var ck=d.cdKind!==undefined?d.cdKind:(s.cdKind||'');
        return '<label class="f">🧭 '+esc(t('If Campus Director: which one'))+'</label><select id="adm_cdkind">'+
          [['',t('—')],['international',t('International Campus Director')],['national',t('National Campus Director')]].map(function(o){ return '<option value="'+o[0]+'"'+(ck===o[0]?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select>'; })()+
      admPositionsHtml_(s, d)+
      countryFieldHtml('adm_country', d.country!==undefined?d.country:(s.country||''))+
      '<label class="f">👑 '+esc(t('Ministry leader of'))+'</label>'+
      '<p class="hint" style="margin:0 0 6px">'+esc(t('A leader can add, rename, remove and re-time the metrics their ministry tracks. Anyone can still log the numbers.'))+'</p>'+
      '<div class="leadsPick" id="adm_leads">'+leadsPickHtml_(dCampus, d.leads!==undefined?d.leads:(s.leads||[]))+'</div>'+
      '<label class="f" style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;font-size:13px;margin-top:12px">'+
        '<input type="checkbox" id="adm_hr"'+((d.hr!==undefined?d.hr:!!s.hr)?' checked':'')+'> 🗂️ '+esc(t('HR access — staff contracts and archiving'))+'</label>'+
      '<label class="f" style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;font-size:13px;margin-top:8px">'+
        '<input type="checkbox" id="adm_kmrev"'+((d.kmReviewer!==undefined?d.kmReviewer:!!s.kmReviewer)?' checked':'')+'> 🇰🇭 '+esc(t('Khmer reviewer — checks the draft Khmer'))+'</label>'+
      '<label class="f" style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;font-size:13px;margin-top:8px">'+
        '<input type="checkbox" id="adm_portalstaff"'+((d.portalStaff!==undefined?d.portalStaff:!!s.portalStaff)?' checked':'')+'> 🛂 '+esc(t('Portal staff — sees and works every application'))+'</label>'+
      '<label class="f" style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;font-size:13px;margin-top:8px">'+
        '<input type="checkbox" id="adm_portaladmin"'+((d.portalAdmin!==undefined?d.portalAdmin:!!s.portalAdmin)?' checked':'')+'> 🛂 '+esc(t('Portal admin — can also grant portal staff'))+'</label>'+
      '<button class="btn" data-adminsave="'+esc(s.id)+'">'+esc(t('Save'))+'</button>'+
      '<button class="linkbtn" data-admincanceledit="'+esc(s.id)+'">'+esc(t('Cancel'))+'</button>';
  }

  if(!mine){
    var mentorOpts=(S.adminStaff||[]).filter(function(x){ return x.id!==s.id && x.active; })
      .map(function(x){ return '<option value="'+esc(x.id)+'"'+(s.mentorId===x.id?' selected':'')+'>'+esc(x.name)+' · '+esc(t(x.dept))+'</option>'; }).join('');
    b+='<div class="mentorDivider"></div><div class="mentorLabel">🤝 '+esc(t('Mentor'))+'</div>'+
      '<select data-adminmentor="'+esc(s.id)+'"><option value="">'+esc(t('— none —'))+'</option>'+mentorOpts+'</select>'+
      '<label class="f" style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;font-size:13px">'+
      '<input type="checkbox" data-adminmentorapproved="'+esc(s.id)+'"'+(s.mentorStatus==='approved'?' checked':'')+'> '+
      esc(t('Approved (skip the accept step)'))+'</label>'+
      '<button class="btn ghost" data-adminsetmentor="'+esc(s.id)+'">'+esc(t('Save mentor'))+'</button>';
  }

  if(!mine && s.dept==='Campus Leadership'){
    b+='<div class="mentorDivider"></div><div class="mentorLabel">👑 '+esc(t('Admin access'))+'</div>'+
      '<div class="numIn"><input type="password" id="adminCodeInput" value="'+esc(S.adminCode)+'" placeholder="'+esc(t('Admin code'))+'">'+
      '<button class="btn ghost" style="margin:0;width:auto;padding:9px 14px" data-admingrant="'+esc(s.id)+'" data-adminmake="'+(s.isAdmin?'0':'1')+'">'+
      (s.isAdmin?esc(t('Revoke admin')):esc(t('Make admin')))+'</button></div>';
  }
  /* Permanent — for a duplicate or a test account, not the normal way
     someone leaves (that's Deactivate, further up, which keeps their
     history). Set apart with its own divider so it doesn't get tapped by
     habit while reaching for something else on the row. */
  if(!mine){
    b+='<div class="mentorDivider"></div><div class="mentorLabel">⚠️ '+esc(t('Danger zone'))+'</div>'+
      '<button class="danger" data-admindelete="'+esc(s.id)+'">'+esc(t('Delete account'))+'</button>'+
      '<p class="hint" style="margin-top:4px">'+esc(t('Permanent — for a duplicate or test account, not someone leaving. Their logged history stays; only the account goes.'))+'</p>';
  }
  return b+'</div>';
}

/* Everything one person holds, in one place on their account (Oct 2026, Uriah: "select
   multiple positions … for me I'm on the board, YWAM GP & Siem Reap Leadership"): their
   campus role is the department and ministry above it; here, as many YWAM GP places as
   they hold, and their seat on the Advisory Board (made and linked to them on Save —
   its bio, photo and contact stay in Admin → Advisory Board). */
function admPositionsHtml_(s, d){
  var gps = d.gpRoles!==undefined ? d.gpRoles : (s.gpRoles || (s.gpRole ? [s.gpRole] : []));
  var seat = d.board!==undefined ? d.board : (s.board ? { on:true, role:s.board.role } : { on:false, role:'Advisor' });
  var roles=['President','Secretary','Treasurer','Advisor'];
  if(seat.role && roles.indexOf(seat.role)===-1) roles.push(seat.role);
  return '<div class="admPositions"><div class="admPosHead">🧭 '+esc(t('Positions'))+'</div>'+
    '<p class="hint" style="margin:0 0 6px">'+esc(t('One person can hold several: their campus role (the department and ministry above), YWAM GP places, and a seat on the Advisory Board.'))+'</p>'+
    '<label class="f">🌏 '+esc(t('YWAM GP leadership team'))+'</label><div class="leadsPick admGpPick">'+GP_ROLES.map(function(r){
      return '<label class="leadOpt"><input type="checkbox" data-admgp="'+r[0]+'"'+(gps.indexOf(r[0])>-1?' checked':'')+'> '+esc(t(r[1]))+'</label>'; }).join('')+'</div>'+
    '<label class="f remBox" style="margin-top:10px"><input type="checkbox" id="adm_board"'+(seat.on?' checked':'')+'> 🛡️ '+esc(t('On the YWAM GP Advisory Board'))+'</label>'+
    '<div class="admBoardRole"'+(seat.on?'':' hidden')+'><label class="f" for="adm_boardrole">'+esc(t('Their role on the board'))+'</label><select id="adm_boardrole">'+
      roles.map(function(r){ return '<option value="'+esc(r)+'"'+(seat.role===r?' selected':'')+'>'+esc(t(r))+'</option>'; }).join('')+'</select>'+
      '<p class="hint" style="margin:4px 0 0">'+esc(t('Their bio, photo and how to reach them for the board are in Admin → Advisory Board.'))+'</p></div></div>';
}
function bindAdmPositions_(admD){
  var gpBoxes=document.querySelectorAll('[data-admgp]');
  gpBoxes.forEach(function(c){ c.onchange=function(){ admD.gpRoles=[].filter.call(gpBoxes, function(x){ return x.checked; }).map(function(x){ return x.getAttribute('data-admgp'); }); }; });
  var bd=document.getElementById('adm_board'), br=document.getElementById('adm_boardrole');
  var keep=function(){ admD.board={ on:!!(bd && bd.checked), role:(br && br.value) || 'Advisor' }; };
  if(bd) bd.onchange=function(){ keep(); var w=document.querySelector('.admBoardRole'); if(w) w.hidden=!bd.checked; };
  if(br) br.onchange=keep;
}
function bindAdmLeads_(admD){
  [['data-admlead','leads'],['data-admmin','ministries']].forEach(function(pair){
    document.querySelectorAll('['+pair[0]+']').forEach(function(c){
      c.onchange=function(){
        var key=c.getAttribute(pair[0]);
        admD[pair[1]]=(admD[pair[1]]||[]).filter(function(k){ return k!==key; });
        if(c.checked) admD[pair[1]].push(key);
      };
    });
  });
}
function adminRefresh_(){ S.adminStaff=null; render(); }
/* adminRefresh_ blanks the whole list to "Loading…" while it re-fetches —
   fine after an approve/merge/delete, where the list itself changed shape.
   A plain edit doesn't need that: nuking S.adminStaff shrinks the page to a
   few lines and back, which is what "it takes you up to the top" was —
   the page didn't jump, its content just briefly got short enough that the
   browser had nowhere left to keep the scroll position. This keeps
   S.adminStaff (and the scroll position) exactly where they were and
   reconciles quietly once the real list is back. */
function adminRefreshQuiet_(){
  run('adminListStaff',[S.auth.user,S.auth.pin],function(d){
    if(d && d.ok) S.adminStaff=d.staff;
    render();
  });
}

/* ---------- HR bindings ---------- */
function hrPut_(d){
  if(!(d && d.ok && d.staff)) return;
  if(!S.hrStaff) return;
  var found=false;
  S.hrStaff=S.hrStaff.map(function(x){ if(x.id===d.staff.id){ found=true; return d.staff; } return x; });
  if(!found) S.hrStaff.push(d.staff);
  S.adminStaff=null;   // the admin's list reads the same people; let it reload
}
function hrFail_(d){ return d && d.err==='not_authorized' ? t('Only HR or an admin can do that.') : d && d.err==='too_large' ? t('That file is too big — keep it under 4 MB.') : d && d.err==='bad_type' ? t('Only a PDF or a photo can be attached.') : d && d.err==='bad_contract' ? t('Pick the month signed and how many years.') : t('Could not save'); }
function bindHr(){
  if(S.view!=='hr') return;
  if(S.hrTab==='docs') bindReqHr_();
  if(!S.hrStaff && !S.hrLoading && !S.hrError){
    S.hrLoading=true;
    run('hrList',[S.auth.user,S.auth.pin],function(d){
      S.hrLoading=false;
      if(d && d.ok){ S.hrStaff=d.staff; S.hrLegalDocs=d.legalDocs||[]; }
      else S.hrError = d && d.err==='not_authorized' ? t('Only HR or an admin can open this.') : (d && d.err) || t('The server answered without the staff list.');
      render();
    }, function(e){ S.hrLoading=false; S.hrError=(e && e.message) || t('Connection problem — try again.'); render(); });
  }
  var rt=document.getElementById('hrRetry');
  if(rt) rt.onclick=function(){ S.hrError=''; render(); };
  var back=document.getElementById('hrBack');
  if(back) back.onclick=function(){
    var to=back.getAttribute('data-hrback')||'week'; gpTap();
    if(to==='week') S.view='week';
    else if(to==='cands'){ S.hrTab='cands'; S.hrSub='home'; S.candForm=null; }
    else if(to==='cand'){ S.hrTab='cands'; S.hrSub='cand'; S.candForm=null; }
    else { S.hrSub='home'; S.hrContractForm=null; }
    render();
  };
  document.querySelectorAll('[data-hrtab]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.hrTab=b.getAttribute('data-hrtab'); S.hrSub='home'; render(); };
  });
  bindCands_();
  document.querySelectorAll('[data-hrperson]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.hrPersonId=b.getAttribute('data-hrperson'); S.hrSub='person'; S.hrContractForm=null; S.hrArchiveDraft=null; render(); };
  });
  document.querySelectorAll('[data-hrcampustab]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.hrCampusTab=b.getAttribute('data-hrcampustab'); render(); };
  });
  var sa=document.getElementById('hrShowArchived');
  if(sa) sa.onchange=function(){ S.hrShowArchived=sa.checked; render(); };
  document.querySelectorAll('[data-hrstatusf]').forEach(function(b){ b.onclick=function(){ gpTap(); S.hrStatusF=b.getAttribute('data-hrstatusf'); render(); }; });
  document.querySelectorAll('[data-hrgroupby]').forEach(function(b){ b.onclick=function(){ gpTap(); S.hrGroupBy=b.getAttribute('data-hrgroupby'); render(); }; });
  var hs=document.getElementById('hrSearch');
  var hrFilter_=function(){
    var q=(S.hrSearch||'').trim().toLowerCase(), any=false;
    document.querySelectorAll('#hrList [data-hrrow]').forEach(function(row){
      var show=!q || (row.getAttribute('data-hrrow')||'').indexOf(q)>-1;
      row.style.display=show?'':'none'; if(show) any=true;
    });
    document.querySelectorAll('[data-hrgroup]').forEach(function(g){
      var some=[].some.call(g.querySelectorAll('[data-hrrow]'), function(r){ return r.style.display!=='none'; });
      g.style.display = some ? '' : 'none';
    });
    var empty=document.getElementById('hrSearchEmpty');
    if(empty) empty.style.display=(q && !any)?'':'none';
  };
  if(hs){ hs.oninput=function(){ S.hrSearch=hs.value; hrFilter_(); }; hrFilter_(); }

  // --- one person ---
  var pid=S.hrPersonId;
  var person=(S.hrStaff||[]).filter(function(x){ return x.id===pid; })[0];
  if(S.hrSub!=='person' || !person) return;
  var sc=document.getElementById('hrSendContract');
  if(sc) sc.onclick=function(){ gpTap(); var cur=hrCurrent_(person), paper=cur && !(cur.digital && cur.digital.status==='signed');
    S.hrSendForm={ staffId:pid, from: paper ? cur.signed : todayStr().slice(0,7), years: paper ? cur.years : 2, redo: !!paper }; S.hrContractForm=null; render(); var el=document.getElementById('hrSendForm'); if(el) el.scrollIntoView({ behavior:'smooth', block:'center' }); };
  var sf=document.getElementById('hr_send_from'); if(sf) sf.onchange=sf.oninput=function(){ S.hrSendForm.from=sf.value; };
  var sy=document.getElementById('hr_send_years'); if(sy) sy.onchange=sy.oninput=function(){ S.hrSendForm.years=sy.value; };   // any length, in quarters of a year
  var sx=document.getElementById('hrSendCancel'); if(sx) sx.onclick=function(){ S.hrSendForm=null; render(); };
  var ss2=document.getElementById('hrSendSave');
  if(ss2) ss2.onclick=function(){
    if(S.busy) return; var f=S.hrSendForm; if(!f.from){ showMsg(t('Choose the month it starts.')); return; }
    var yrs=Number(f.years);
    if(!(yrs>=0.25 && yrs<=30)){ showMsg(t('Enter how many years, from 0.25 to 30.')); return; }
    S.busy=true; render();
    run('hrSendContract',[S.auth.user,S.auth.pin,pid,{ from:f.from, years:Math.round(yrs*4)/4 }],function(d){
      S.busy=false;
      if(d && d.ok){ S.hrStaff=S.hrStaff.map(function(x){ return x.id===pid ? d.staff : x; }); S.hrSendForm=null;
        location.href='portal.html?staff=1&hr='+encodeURIComponent(pid)+'&doc='+encodeURIComponent('contract:'+d.contractId); return; }
      showMsg(hrFail_(d));
      render();
    }, function(){ S.busy=false; showMsg(t('Connection problem — try again.')); render(); });
  };
  var openPdf_=function(b, fn, args){ b.disabled=true; run(fn, [S.auth.user,S.auth.pin].concat(args), function(d){ b.disabled=false; if(d && d.ok) hrOpenDataUrl_(d.dataUrl, d.name); else showMsg(hrFail_(d)); }, function(){ b.disabled=false; showMsg(t('Connection problem — try again.')); }); };
  document.querySelectorAll('[data-hrlegalpdf]').forEach(function(b){ b.onclick=function(){ openPdf_(b, 'hrLegalPdf', [pid, b.getAttribute('data-hrlegalpdf')]); }; });
  document.querySelectorAll('[data-hrcontractpdf]').forEach(function(b){ b.onclick=function(){ openPdf_(b, 'hrContractPdf', [pid, b.getAttribute('data-hrcontractpdf')]); }; });
  var ac=document.getElementById('hrAddContract');
  if(ac) ac.onclick=function(){ gpTap(); S.hrContractForm={ staffId:pid, id:'', signed:'', years:'', notes:'', campus:person.campus }; render(); var el=document.getElementById('hrContractForm'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); };
  document.querySelectorAll('[data-hredit]').forEach(function(b){
    b.onclick=function(){
      var c=(person.contracts||[]).filter(function(x){ return x.id===b.getAttribute('data-hredit'); })[0]; if(!c) return;
      S.hrContractForm={ staffId:pid, id:c.id, signed:c.signed, years:c.years, notes:c.notes||'', campus:hrContractCampus_(person, c) }; render();
    };
  });
  ['hr_signed','hr_years','hr_notes'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.oninput=el.onchange=function(){ if(!S.hrContractForm) return; S.hrContractForm[id==='hr_signed'?'signed':id==='hr_years'?'years':'notes']=el.value; };
  });
  document.querySelectorAll('[data-hrcampus]').forEach(function(b){ b.onclick=function(){ if(!S.hrContractForm) return; gpTap(); S.hrContractForm.campus=b.getAttribute('data-hrcampus'); render(); }; });
  document.querySelectorAll('[data-hrstartedit]').forEach(function(b){ b.onclick=function(){ gpTap(); var k=b.getAttribute('data-hrstartedit'), st=k==='ywam' ? null : hrStartOf_(person, k.slice(6));
    S.hrStartEdit={ staffId:pid, key:k, value: k==='ywam' ? (person.ywamSince==null?'':String(person.ywamSince)) : (st ? st.month : '') }; render();
    var el=document.getElementById('hr_start'); if(el) el.focus(); }; });
  var se=S.hrStartEdit && S.hrStartEdit.staffId===pid ? S.hrStartEdit : null;
  if(se){
    var sin=document.getElementById('hr_start');
    if(sin){ sin.oninput=sin.onchange=function(){ se.value=sin.value; }; sin.onkeydown=function(e){ if(e.key==='Enter'){ e.preventDefault(); var b=document.getElementById('hrStartSave'); if(b) b.click(); } }; }
    var scn=document.getElementById('hrStartCancel'); if(scn) scn.onclick=function(){ S.hrStartEdit=null; render(); };
    var ss=document.getElementById('hrStartSave');
    if(ss) ss.onclick=function(){
      if(S.busy) return;
      var v=String(se.value||'').trim(), body={};
      if(se.key==='ywam'){
        if(v && !(/^\d{4}$/.test(v) && Number(v)>=1960 && Number(v)<=new Date().getFullYear())){ showMsg(t('Started with YWAM: a year like 2003, or leave it empty.')); return; }
        if(v && hrPeriods_(person).some(function(x){ return x.set && Number(x.from.slice(0,4))<Number(v); })){ showMsg(t('They can’t have started here before they joined YWAM.')); return; }
        body.ywamSince = v ? Number(v) : '';
      } else {
        if(v && (!/^\d{4}-\d{2}$/.test(v) || v>todayStr().slice(0,7))){ showMsg(t('Pick the month they started here, or leave it empty.')); return; }
        if(v && person.ywamSince && Number(v.slice(0,4))<Number(person.ywamSince)){ showMsg(t('They can’t have started here before they joined YWAM.')); return; }
        body.starts={}; body.starts[se.key.slice(6)]=v;
      }
      S.busy=true; ss.disabled=true;
      run('hrSaveStart',[S.auth.user,S.auth.pin,pid,body],function(r){
        S.busy=false;
        if(r && r.ok){ hrPut_(r); S.hrStartEdit=null; showMsg(t('Start dates saved')); }
        else showMsg(r && r.err==='bad_base_since' ? t('Pick the month they started here, or leave it empty.') : r && r.err==='base_before_ywam' ? t('They can’t have started here before they joined YWAM.') : hrFail_(r));
        render();
      });
    };
  }
  var cc=document.getElementById('hrContractCancel');
  if(cc) cc.onclick=function(){ S.hrContractForm=null; render(); };
  var cs=document.getElementById('hrContractSave');
  if(cs) cs.onclick=function(){
    if(S.busy || !S.hrContractForm) return;
    var f=S.hrContractForm;
    if(!/^\d{4}-\d{2}$/.test(f.signed||'')){ showMsg(t('Pick the month the contract was signed.')); return; }
    var yrs=Number(f.years); if(!(yrs>0)){ showMsg(t('How many years did they commit to?')); return; }
    S.busy=true; cs.disabled=true; cs.textContent=t('Saving…');
    run('hrSaveContract',[S.auth.user,S.auth.pin,pid,{ id:f.id||'', signed:f.signed, years:yrs, notes:f.notes||'', campus:f.campus||person.campus }],function(d){
      S.busy=false;
      if(d && d.ok){ hrPut_(d); S.hrContractForm=null; showMsg(t('Contract saved')); } else showMsg(hrFail_(d));
      render();
    });
  };
  var cd=document.getElementById('hrContractDelete');
  if(cd) cd.onclick=function(){
    if(S.busy || !S.hrContractForm || !S.hrContractForm.id) return;
    if(!confirm(t('Delete this contract and anything attached to it?'))) return;
    S.busy=true;
    run('hrDeleteContract',[S.auth.user,S.auth.pin,pid,S.hrContractForm.id],function(d){
      S.busy=false; if(d && d.ok){ hrPut_(d); S.hrContractForm=null; showMsg(t('Contract deleted')); } else showMsg(hrFail_(d)); render();
    });
  };
  document.querySelectorAll('[data-hrattach]').forEach(function(inp){
    inp.onchange=function(){
      var file=inp.files && inp.files[0]; if(!file) return;
      var cid=inp.getAttribute('data-hrattach');
      if(file.size>4*1024*1024){ showMsg(t('That file is too big — keep it under 4 MB.')); inp.value=''; return; }
      var mime=file.type || (/\.pdf$/i.test(file.name)?'application/pdf':'');
      var reader=new FileReader();
      reader.onload=function(){
        var b64=String(reader.result||'').split(',')[1]||'';
        S.busy=true; showMsg(t('Uploading…'));
        run('hrUploadFile',[S.auth.user,S.auth.pin,pid,cid,file.name,mime,b64],function(d){
          S.busy=false; if(d && d.ok){ hrPut_(d); showMsg(t('Attached')); } else showMsg(hrFail_(d)); render();
        }, function(e){ S.busy=false; showMsg(t('Connection problem — try again.')); render(); });
      };
      reader.readAsDataURL(file);
    };
  });
  document.querySelectorAll('[data-hrfileopen]').forEach(function(b){
    b.onclick=function(){
      var fid=b.getAttribute('data-hrfileopen'); b.disabled=true; b.textContent=t('Opening…');
      run('hrGetFile',[S.auth.user,S.auth.pin,fid],function(d){
        b.disabled=false; b.textContent=t('Open');
        if(!(d && d.ok)){ showMsg(hrFail_(d)); return; }
        hrOpenDataUrl_(d.dataUrl, d.name);
      }, function(e){ b.disabled=false; b.textContent=t('Open'); showMsg(t('Connection problem — try again.')); });
    };
  });
  document.querySelectorAll('[data-hrfiledel]').forEach(function(b){
    b.onclick=function(){
      var v=b.getAttribute('data-hrfiledel'), i=v.indexOf('|'), cid=v.slice(0,i), fid=v.slice(i+1);
      if(!confirm(t('Remove this attachment?'))) return;
      S.busy=true;
      run('hrDeleteFile',[S.auth.user,S.auth.pin,pid,cid,fid],function(d){ S.busy=false; if(d && d.ok){ hrPut_(d); showMsg(t('Removed')); } else showMsg(hrFail_(d)); render(); });
    };
  });
  ['hr_left','hr_reason'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.oninput=el.onchange=function(){ S.hrArchiveDraft=S.hrArchiveDraft && S.hrArchiveDraft.staffId===pid ? S.hrArchiveDraft : { staffId:pid, at:(document.getElementById('hr_left')||{}).value||todayStr(), reason:'' }; S.hrArchiveDraft[id==='hr_left'?'at':'reason']=el.value; };
  });
  var ar=document.getElementById('hrArchive');
  if(ar) ar.onclick=function(){
    if(S.busy) return;
    var at=(document.getElementById('hr_left')||{}).value||todayStr(), reason=(document.getElementById('hr_reason')||{}).value||'';
    if(!confirm(gpT('Archive {name}? They come off the roster and the staff count, and can no longer sign in. You can bring them back later.',{name:person.name}))) return;
    S.busy=true;
    run('hrArchive',[S.auth.user,S.auth.pin,pid,{ at:at, reason:reason }],function(d){ S.busy=false; if(d && d.ok){ hrPut_(d); S.hrArchiveDraft=null; showMsg(gpT('{name} archived',{name:person.name})); } else showMsg(d && d.err==='self_archive' ? t('You can’t archive yourself.') : hrFail_(d)); render(); });
  };
  var un=document.getElementById('hrUnarchive');
  if(un) un.onclick=function(){
    if(S.busy) return; S.busy=true;
    run('hrUnarchive',[S.auth.user,S.auth.pin,pid],function(d){ S.busy=false; if(d && d.ok){ hrPut_(d); showMsg(gpT('{name} is back on the roster',{name:person.name})); } else showMsg(hrFail_(d)); render(); });
  };
}
/* ---------- Candidates bindings ---------- */
function candPut_(d){
  if(!(d && d.ok && d.candidate) || !S.cands) return;
  var found=false;
  S.cands=S.cands.map(function(x){ if(x.id===d.candidate.id){ found=true; return d.candidate; } return x; });
  if(!found) S.cands.push(d.candidate);
}
function candFail_(d){ return d && d.err==='not_authorized' ? t('Only HR or an admin can do that.') : d && d.err==='bad_candidate' ? t('Give them a name first.') : t('Could not save'); }
function bindCands_(){
  if(S.view!=='hr' || S.hrTab!=='cands') return;
  if(!S.cands && !S.candsLoading && !S.candsError){
    S.candsLoading=true;
    run('hrCandidates',[S.auth.user,S.auth.pin],function(d){
      S.candsLoading=false;
      if(d && d.ok) S.cands=d.candidates||[];
      else S.candsError = d && d.err==='not_authorized' ? t('Only HR or an admin can open this.') : (d && d.err) || t('The server answered without the candidates.');
      render();
    }, function(e){ S.candsLoading=false; S.candsError=(e && e.message) || t('Connection problem — try again.'); render(); });
  }
  var rt=document.getElementById('candsRetry');
  if(rt) rt.onclick=function(){ S.candsError=''; render(); };
  var add=document.getElementById('candAdd');
  if(add) add.onclick=function(){ gpTap(); S.candForm=candBlank_(); S.hrSub='candform'; render(); };
  document.querySelectorAll('[data-candperson]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.candPersonId=b.getAttribute('data-candperson'); S.hrSub='cand'; S.candNoteDraft=''; render(); };
  });
  document.querySelectorAll('[data-candtype]').forEach(function(b){ b.onclick=function(){ gpTap(); S.candType=b.getAttribute('data-candtype'); render(); }; });
  document.querySelectorAll('[data-candstage]').forEach(function(b){ b.onclick=function(){ gpTap(); S.candStage=b.getAttribute('data-candstage'); render(); }; });
  var sa=document.getElementById('candShowArchived');
  if(sa) sa.onchange=function(){ S.candShowArchived=sa.checked; render(); };
  var cs=document.getElementById('candSearch');
  var filter_=function(){
    var q=(S.candSearch||'').trim().toLowerCase(), any=false;
    document.querySelectorAll('#candList [data-candrow]').forEach(function(row){ var show=!q || (row.getAttribute('data-candrow')||'').indexOf(q)>-1; row.style.display=show?'':'none'; if(show) any=true; });
    var empty=document.getElementById('candSearchEmpty'); if(empty) empty.style.display=(q && !any)?'':'none';
  };
  if(cs){ cs.oninput=function(){ S.candSearch=cs.value; filter_(); }; filter_(); }

  // --- the form (add / edit details) ---
  document.querySelectorAll('[data-cf]').forEach(function(el){
    var f=function(){ if(S.candForm) S.candForm[el.getAttribute('data-cf')]=el.value; };
    el.oninput=f; el.onchange=f;
  });
  var cc=document.getElementById('candCancel');
  if(cc) cc.onclick=function(){ var wasEdit=!!(S.candForm&&S.candForm.id); S.candForm=null; S.hrSub=wasEdit?'cand':'home'; render(); };
  var sv=document.getElementById('candSave');
  if(sv) sv.onclick=function(){
    if(S.busy || !S.candForm) return;
    var f=S.candForm;
    if(!(f.name||'').trim()){ showMsg(t('Give them a name first.')); return; }
    S.busy=true; sv.disabled=true; sv.textContent=t('Saving…');
    run('hrSaveCandidate',[S.auth.user,S.auth.pin,f],function(d){
      S.busy=false;
      if(d && d.ok){ candPut_(d); S.candForm=null; S.candPersonId=d.candidate.id; S.hrSub='cand'; showMsg(t('Saved')); }
      else showMsg(candFail_(d));
      render();
    });
  };

  // --- one candidate ---
  var c=(S.cands||[]).filter(function(x){ return x.id===S.candPersonId; })[0];
  if(S.hrSub!=='cand' || !c) return;
  var save=function(patch, msg){
    if(S.busy) return; S.busy=true;
    var doc={}; for(var k in c) if(k!=='log' && k!=='archived') doc[k]=c[k];
    for(var k2 in patch) doc[k2]=patch[k2];
    run('hrSaveCandidate',[S.auth.user,S.auth.pin,doc],function(d){ S.busy=false; if(d && d.ok){ candPut_(d); if(msg) showMsg(msg); } else showMsg(candFail_(d)); render(); });
  };
  var ed=document.getElementById('candEdit');
  if(ed) ed.onclick=function(){ S.candForm={}; for(var k in c) if(k!=='log' && k!=='archived') S.candForm[k]=c[k]; S.hrSub='candform'; render(); };
  document.querySelectorAll('[data-candmove]').forEach(function(b){
    b.onclick=function(){ var st=b.getAttribute('data-candmove'); if(st===c.stage) return; gpTap(); save({ stage:st }, gpT('Moved to {stage}',{stage:candStageLabel_(st)})); };
  });
  var lk=document.getElementById('candLink');
  if(lk) lk.onchange=function(){ save({ staffId:lk.value }, lk.value ? t('Linked to their account') : t('Link removed')); };
  var os=document.getElementById('candOpenStaff');
  if(os) os.onclick=function(){ S.hrTab='staff'; S.hrSub='person'; S.hrPersonId=os.getAttribute('data-staff'); render(); };
  var ns=document.getElementById('candNextSave');
  if(ns) ns.onclick=function(){ save({ nextStep:(document.getElementById('cand_next')||{}).value||'', nextDate:(document.getElementById('cand_nextdate')||{}).value||'' }, t('Next step saved')); };
  var nt=document.getElementById('candNote');
  if(nt) nt.oninput=function(){ S.candNoteDraft=nt.value; };
  var na=document.getElementById('candNoteAdd');
  if(na) na.onclick=function(){
    var text=(nt?nt.value:'').trim(); if(!text){ showMsg(t('Write the note first.')); return; }
    if(S.busy) return; S.busy=true;
    run('hrCandidateNote',[S.auth.user,S.auth.pin,c.id,text],function(d){ S.busy=false; if(d && d.ok){ candPut_(d); S.candNoteDraft=''; } else showMsg(candFail_(d)); render(); });
  };
  var ar=document.getElementById('candArchive');
  if(ar) ar.onclick=function(){
    if(S.busy) return;
    var why=(document.getElementById('cand_why')||{}).value||'', note=(document.getElementById('cand_whynote')||{}).value||'';
    if(!confirm(gpT('Archive {name}? They stay in the list, marked archived, and can be brought back.',{name:c.name}))) return;
    S.busy=true;
    run('hrArchiveCandidate',[S.auth.user,S.auth.pin,c.id,{ reason: why+(note?' — '+note:'') }],function(d){ S.busy=false; if(d && d.ok){ candPut_(d); showMsg(gpT('{name} archived',{name:c.name})); } else showMsg(candFail_(d)); render(); });
  };
  var un=document.getElementById('candUnarchive');
  if(un) un.onclick=function(){
    if(S.busy) return; S.busy=true;
    run('hrArchiveCandidate',[S.auth.user,S.auth.pin,c.id,null],function(d){ S.busy=false; if(d && d.ok){ candPut_(d); showMsg(t('Back in the pipeline')); } else showMsg(candFail_(d)); render(); });
  };
}

/* A data: URL can't be opened as a top-level page in most browsers, so the
   bytes go into a Blob and the Blob's URL opens in a new tab. */
function hrOpenDataUrl_(dataUrl, name){
  try {
    var m=/^data:([^;]+);base64,(.*)$/.exec(dataUrl); if(!m) throw new Error('bad');
    var bin=atob(m[2]), arr=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    var url=URL.createObjectURL(new Blob([arr],{type:m[1]}));
    var a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener';
    if(!/^(application\/pdf|image\/)/.test(m[1])) a.download=name||'file';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  } catch(e){ showMsg(t('Could not open the file')); }
}

function bindAdmin(){
  if(S.view!=='admin' || !S.me || !S.me.isAdmin) return;
  var back=document.getElementById('adminBack');
  if(back) back.onclick=function(){
    var to=back.getAttribute('data-adminback')||'week';
    gpTap();
    if(to==='week') S.view='week'; else S.adminSub=to;
    render();
  };
  document.querySelectorAll('[data-adminperson]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.adminPersonId=b.getAttribute('data-adminperson'); S.adminSub='person'; S.adminEditId=null; S.adminEditDraft=null; render(); };
  });

  document.querySelectorAll('[data-adminsub]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.adminSub=b.getAttribute('data-adminsub'); if(S.adminSub==='loose') S.adminLoose=null; if(S.adminSub==='students'){ S.adminStu=null; S.stuList=null; S.stuArchSchool=null; } render(); };
  });
  // --- students ---
  if(S.adminSub==='students' && !S.stuList && !S.stuListLoading){ S.stuListLoading=true; run('studentsList',[S.auth.user,S.auth.pin],function(d){ S.stuListLoading=false; S.stuList=d||{ ok:false }; render(); }); }
  document.querySelectorAll('[data-stuarch]').forEach(function(b){ b.onclick=function(){ gpTap(); S.stuArchSchool=b.getAttribute('data-stuarch'); render(); }; });
  var san=document.getElementById('stuArchNo'); if(san) san.onclick=function(){ S.stuArchSchool=null; render(); };
  document.querySelectorAll('[data-stuarchyes]').forEach(function(b){ b.onclick=function(){
    var k=b.getAttribute('data-stuarchyes'), ids=((S.adminStu && S.adminStu.schools[k])||[]).map(function(r){ return r.candId; });
    b.disabled=true;
    run('studentsArchive',[S.auth.user,S.auth.pin,ids,'School finished'],function(d){
      S.stuArchSchool=null;
      if(d && d.ok){ S.adminStu=d; S.stuList=null; showMsg(gpT('{n} archived',{n:d.archived})); } else showMsg(t('Could not save'));
      render();
    });
  }; });
  if(S.adminSub==='students' && !S.adminStu && !S.adminStuLoading){
    S.adminStuLoading=true;
    run('studentsAdmin',[S.auth.user,S.auth.pin],function(d){ S.adminStuLoading=false; S.adminStu=d||{ ok:false }; render(); },
      function(){ S.adminStuLoading=false; S.adminStu={ ok:false }; render(); });
  }
  document.querySelectorAll('[data-adminstu]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.adminStuId=b.getAttribute('data-adminstu'); S.adminStuView=null; S.adminSub='stuone'; render(); window.scrollTo(0,0); };
  });
  if(S.adminSub==='stuone' && S.adminStuId && !(S.adminStuView && S.adminStuView.id===S.adminStuId) && S.adminStuLoading!==S.adminStuId){
    var sid=S.adminStuId; S.adminStuLoading=sid;
    run('studentAdminView',[S.auth.user,S.auth.pin,sid],function(d){ S.adminStuLoading=false; S.adminStuView=Object.assign({ id:sid }, d||{ ok:false }); render(); },
      function(){ S.adminStuLoading=false; S.adminStuView={ id:sid, ok:false }; render(); });
  }
  var asp=document.getElementById('adminStuPreview');
  if(asp) asp.onclick=function(){ gpTap(); stuPreviewEnter_(); };

  document.querySelectorAll('[data-admincampustab]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.adminCampusTab=b.getAttribute('data-admincampustab'); render(); };
  });
  document.querySelectorAll('[data-adminmentorcampus]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.adminMentorCampus=b.getAttribute('data-adminmentorcampus'); render(); };
  });
  // --- portal access ---
  document.querySelectorAll('[data-adminportalcampus]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.adminPortalCampus=b.getAttribute('data-adminportalcampus'); render(); };
  });
  var portalFlag=function(attr, key){
    document.querySelectorAll('['+attr+']').forEach(function(cb){
      cb.onchange=function(){
        var id=cb.getAttribute(attr), payload={}; payload[key]=cb.checked;
        cb.disabled=true;
        run('adminUpdateStaff',[S.auth.user,S.auth.pin,id,payload],function(d){
          if(d && d.ok){ if(S.adminStaff && d.staff) S.adminStaff=S.adminStaff.map(function(x){ return x.id===id ? d.staff : x; }); showMsg(cb.checked ? t('Access granted') : t('Access removed')); }
          else showMsg(t('Could not save'));
          render();
        });
      };
    });
  };
  portalFlag('data-portalstaff','portalStaff'); portalFlag('data-portaladmin','portalAdmin');
  // --- leave, everyone's ---
  if(S.adminSub==='leave' && !S.adminLeave && !S.adminLeaveLoading && !S.adminLeaveError){
    S.adminLeaveLoading=true;
    run('adminListTrips',[S.auth.user,S.auth.pin],function(d){
      S.adminLeaveLoading=false;
      if(d && d.ok) S.adminLeave=d; else S.adminLeaveError=(d && d.err) || t('The server answered without the leave requests.');
      render();
    }, function(e){ S.adminLeaveLoading=false; S.adminLeaveError=(e && e.message) || t('Connection problem — try again.'); render(); });
  }
  var alr=document.getElementById('adminLeaveRetry');
  if(alr) alr.onclick=function(){ S.adminLeaveError=''; render(); };
  document.querySelectorAll('[data-adminleavecampus]').forEach(function(b){
    b.onclick=function(){ gpTap(); S.adminLeaveCampus=b.getAttribute('data-adminleavecampus'); render(); };
  });
  var holDraft=function(){ if(!S.holDraft) S.holDraft=((S.adminLeave||{}).holidaysDated||[]).map(function(x){ return { id:x.id, name:x.name, from:x.from, to:x.to }; }); return S.holDraft; };
  document.querySelectorAll('[data-hol]').forEach(function(inp){ inp.onchange=inp.oninput=function(){ holDraft()[Number(inp.getAttribute('data-hol'))][inp.getAttribute('data-hf')]=inp.value; }; });
  document.querySelectorAll('[data-holdel]').forEach(function(b){ b.onclick=function(){ holDraft().splice(Number(b.getAttribute('data-holdel')),1); render(); }; });
  var hla=document.getElementById('holAdd'); if(hla) hla.onclick=function(){ holDraft().push({ id:'', name:'Pchum Ben', from:'', to:'' }); render(); };
  var hls=document.getElementById('holSave');
  if(hls) hls.onclick=function(){
    if(S.busy) return; S.busy=true; hls.disabled=true;
    run('adminSaveHolidays',[S.auth.user,S.auth.pin,holDraft().filter(function(x){ return x.from; })],function(d){
      S.busy=false;
      if(d && d.ok){ S.adminLeave=d; S.holDraft=null; run('getMyTrips',[S.auth.user,S.auth.pin],function(m){ if(m && m.ok){ S.trips=m; render(); } }); showMsg(t('Holidays saved — everyone’s days are counted again')); } else showMsg(t('Could not save'));
      render();
    });
  };
  var aly=document.getElementById('adminLeaveYear');
  if(aly) aly.onchange=function(){ S.adminLeaveYear=Number(aly.value); render(); };
  var decideLeave=function(id, approve){
    if(S.busy) return; S.busy=true;
    run('adminDecideTrip',[S.auth.user,S.auth.pin,id,approve],function(d){
      S.busy=false;
      if(d && d.ok){ S.adminLeave=d; showMsg(approve ? t('Approved') : t('Declined')); } else showMsg(d && d.err==='already_decided' ? t('Someone already decided this one.') : t('Could not save'));
      render();
    });
  };
  document.querySelectorAll('[data-adminleaveok]').forEach(function(b){ b.onclick=function(){ decideLeave(b.getAttribute('data-adminleaveok'), true); }; });
  document.querySelectorAll('[data-adminleaveno]').forEach(function(b){ b.onclick=function(){ if(confirm(t('Decline this leave request?'))) decideLeave(b.getAttribute('data-adminleaveno'), false); }; });

  /* The search survives a re-render. Tapping a row rebuilds the Admin page
     (that's how the row opens), and the box used to come back empty with
     every account showing again — the person you'd just searched for
     dropped back into the full list, which read as "selecting a staff
     bugs". The query lives in S.adminSearch, the box is refilled from it,
     and the filter is applied once here as well as on every keystroke. */
  var asr=document.getElementById('adminSearch');
  var adminFilter_=function(){
    var q=(S.adminSearch||'').trim().toLowerCase();
    var anyVisible=false;
    document.querySelectorAll('[data-adminrow]').forEach(function(row){
      var hay=row.getAttribute('data-adminrow')||'';
      var show=!q || hay.indexOf(q)>-1;
      row.style.display = show?'':'none';
      if(show) anyVisible=true;
    });
    document.querySelectorAll('[data-admingroup]').forEach(function(g){
      var any=[].some.call(g.querySelectorAll('[data-adminrow]'), function(r){ return r.style.display!=='none'; });
      g.style.display = any ? '' : 'none';
    });
    var empty=document.getElementById('adminSearchEmpty');
    if(empty) empty.style.display = (q && !anyVisible) ? '' : 'none';
  };
  if(asr){
    asr.oninput=function(){ S.adminSearch=asr.value; adminFilter_(); };
    adminFilter_();
  }


  var amc=document.getElementById('adminMetricCampusSel');
  if(amc) amc.onchange=function(){ S.adminMetricCampus=amc.value; S.adminMetricMinistry=''; render(); };
  var amd=document.getElementById('adminMetricDeptSel');
  if(amd) amd.onchange=function(){ S.adminMetricDept=amd.value; S.adminMetricMinistry=''; render(); };
  var amm=document.getElementById('adminMetricMinSel');
  if(amm) amm.onchange=function(){ S.adminMetricMinistry=amm.value; render(); };

  var bcText=document.getElementById('broadcastText');
  if(bcText) bcText.oninput=function(){ S.broadcastDraft=bcText.value; };
  var bcSend=document.getElementById('broadcastSendBtn');
  if(bcSend) bcSend.onclick=function(){
    var text=(S.broadcastDraft||'').trim();
    if(!text){ showMsg(t('Write something first.')); return; }
    bcSend.disabled=true; bcSend.textContent=t('Sending…');
    run('sendBroadcast',[S.auth.user,S.auth.pin,text],function(d){
      bcSend.disabled=false; bcSend.textContent=t('Send to everyone');
      if(d && d.ok){
        S.broadcasts=d.broadcasts||[]; S.broadcastDraft='';
        showMsg(t('Sent to everyone'));
        render();
      } else showMsg(t('That didn’t save — try again.'));
    });
  };

  if(S.adminSub==='loose' && S.adminLoose===null && !S.adminLooseLoading){
    S.adminLooseLoading=true;
    run('adminLooseEnds',[S.auth.user,S.auth.pin],function(d){
      S.adminLooseLoading=false;
      S.adminLoose=(d && d.ok) ? d : { ok:false };
      if(S.view==='admin') render();
    }, function(){ S.adminLooseLoading=false; S.adminLoose={ ok:false }; if(S.view==='admin') render(); });
  }
  if(S.adminStaff===null){
    if(S.adminLoading) return;
    S.adminLoading=true;
    run('adminListStaff',[S.auth.user,S.auth.pin],function(d){
      S.adminLoading=false;
      if(d && d.ok) S.adminStaff=d.staff; else showMsg('Could not load accounts');
      render();
    });
    return;
  }

  document.querySelectorAll('[data-cltyes],[data-cltno]').forEach(function(b){
    b.onclick=function(){
      var yes=b.hasAttribute('data-cltyes'), id=b.getAttribute(yes ? 'data-cltyes' : 'data-cltno');
      b.disabled=true;
      run('adminDecideCltRequest',[S.auth.user,S.auth.pin,id,yes],function(d){
        if(d && d.ok){ showMsg(yes ? t('Moved into Campus Leadership') : t('Request declined')); adminRefresh_(); orgLoad_(); }
        else { b.disabled=false; showMsg(t('Could not save')); }
      });
    };
  });
  document.querySelectorAll('[data-adminapprove]').forEach(function(b){
    b.onclick=function(){
      run('adminSetActive',[S.auth.user,S.auth.pin,b.getAttribute('data-adminapprove'),true],function(d){
        if(d && d.ok) adminRefresh_(); else showMsg('Could not approve');
      });
    };
  });
  var msb=document.getElementById('mergeStaffBtn');
  if(msb) msb.onclick=function(){
    var keepId=document.getElementById('mergeKeepSel').value;
    var mergeId=document.getElementById('mergeFromSel').value;
    if(keepId===mergeId){ showMsg(t('Pick two different accounts.')); return; }
    var keepS=(S.adminStaff||[]).find(function(x){ return x.id===keepId; });
    var mergeS=(S.adminStaff||[]).find(function(x){ return x.id===mergeId; });
    if(!keepS || !mergeS) return;
    if(!confirm(gpT('Merge {merge} into {keep}? {merge}’s history moves onto {keep} where it doesn’t already overlap, then {merge}’s account is permanently deleted. This can’t be undone.',
      {merge:mergeS.name, keep:keepS.name}))) return;
    msb.disabled=true;
    run('adminMergeStaff',[S.auth.user,S.auth.pin,keepId,mergeId],function(d){
      msb.disabled=false;
      if(d && d.ok){ showMsg(t('Accounts merged')); adminRefresh_(); }
      else showMsg(t('Could not merge those accounts'));
    });
  };
  document.querySelectorAll('[data-admintoggleactive]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-admintoggleactive');
      var s=(S.adminStaff||[]).find(function(x){ return x.id===id; });
      if(!s) return;
      run('adminSetActive',[S.auth.user,S.auth.pin,id,!s.active],function(d){
        if(d && d.ok) adminRefresh_(); else showMsg('Could not update');
      });
    };
  });
  document.querySelectorAll('[data-admindelete]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-admindelete');
      var s=(S.adminStaff||[]).find(function(x){ return x.id===id; });
      if(!s) return;
      if(!confirm(gpT('Permanently delete {name}’s account? This can’t be undone.',{name:s.name}))) return;
      run('adminDeleteStaff',[S.auth.user,S.auth.pin,id],function(d){
        if(d && d.ok){ showMsg(t('Account deleted')); adminRefresh_(); }
        else showMsg(t('Could not delete that account'));
      });
    };
  });
  document.querySelectorAll('[data-adminpin]').forEach(function(inp){
    inp.oninput=function(){ S.adminPinDraft[inp.getAttribute('data-adminpin')]=inp.value; };
  });
  document.querySelectorAll('[data-adminresetpin]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-adminresetpin');
      var pin=S.adminPinDraft[id]||'';
      if(!/^\d{4}$/.test(pin)){ showMsg('PIN must be 4 digits'); return; }
      run('adminResetPin',[S.auth.user,S.auth.pin,id,pin],function(d){
        if(d && d.ok){ S.adminPinDraft[id]=''; showMsg('PIN reset'); render(); }
        else showMsg('Could not reset PIN');
      });
    };
  });
  document.querySelectorAll('[data-adminedit]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-adminedit');
      var s=(S.adminStaff||[]).find(function(x){ return x.id===id; })||{};
      S.adminEditId=id;
      S.adminEditDraft={ name:s.name||'', username:s.username||'', campus:s.campus||'', dept:s.dept||'', ministry:s.ministry||'',
        role:s.role||'', staffType:s.staffType||'', country:s.country||'', leads:(s.leads||[]).slice(), ministries:(s.ministries||[]).slice(),
        gpRoles:(s.gpRoles || (s.gpRole ? [s.gpRole] : [])).slice(), board: s.board ? { on:true, role:s.board.role } : { on:false, role:'Advisor' } };
      render();
    };
  });
  document.querySelectorAll('[data-admincanceledit]').forEach(function(b){
    b.onclick=function(){ S.adminEditId=null; S.adminEditDraft=null; render(); };
  });
  if(S.adminEditId && document.getElementById('adm_campus')){
    var admD = S.adminEditDraft || {};
    fillMinistrySelect('adm_ministry','adm_campus','adm_dept', admD.ministry||'');
    bindAdmPositions_(admD);
    // Typing/picking updates the draft directly rather than calling render() —
    // same reason broadcastDraft doesn't re-render on every keystroke. That
    // keeps whatever's typed alive if anything else on the page re-renders,
    // and is what actually makes editing feel responsive instead of laggy.
    var admName=document.getElementById('adm_name');
    if(admName) admName.oninput=function(){ admD.name=admName.value; };
    var admUser=document.getElementById('adm_username');
    if(admUser) admUser.oninput=function(){ admD.username=admUser.value; };
    var admRole=document.getElementById('adm_role');
    if(admRole) admRole.oninput=function(){ admD.role=admRole.value; };
    var admType=document.getElementById('adm_type');
    if(admType) admType.onchange=function(){ admD.staffType=admType.value; };
    var admMin=document.getElementById('adm_ministry');
    if(admMin) admMin.onchange=function(){ admD.ministry=admMin.value; };
    var admCampus=document.getElementById('adm_campus');
    if(admCampus) admCampus.onchange=function(){
      admD.campus=admCampus.value;
      // The department list itself belongs to the campus — refill it rather
      // than leaving the old campus's departments on screen, which is the
      // other half of what made this "confusing": picking a new campus
      // silently kept the previous one's department names in the dropdown.
      var deptSel=document.getElementById('adm_dept');
      var deps=deptsFor(admCampus.value);
      deptSel.innerHTML=deps.map(function(dp){ return '<option value="'+esc(dp)+'">'+esc(t(dp))+'</option>'; }).join('');
      admD.dept=deptSel.value;
      fillMinistrySelect('adm_ministry','adm_campus','adm_dept','');
      admD.ministry='';
      // The ministries someone can lead belong to the campus too.
      var lp=document.getElementById('adm_leads');
      if(lp){ admD.leads=[]; lp.innerHTML=leadsPickHtml_(admCampus.value, []); }
      var mp=document.getElementById('adm_ministries');
      if(mp){ admD.ministries=[]; mp.innerHTML=leadsPickHtml_(admCampus.value, [], 'data-admmin'); }
      bindAdmLeads_(admD);
    };
    bindAdmLeads_(admD);
    var admDept=document.getElementById('adm_dept');
    if(admDept) admDept.onchange=function(){
      admD.dept=admDept.value;
      fillMinistrySelect('adm_ministry','adm_campus','adm_dept','');
      admD.ministry='';
    };
    bindCountryOther();
    var admCountry=document.getElementById('adm_country'), admCountryOther=document.getElementById('adm_country_other');
    if(admCountry) admCountry.addEventListener('change', function(){ admD.country=countryValue('adm_country'); });
    if(admCountryOther) admCountryOther.addEventListener('input', function(){ admD.country=countryValue('adm_country'); });
  }
  document.querySelectorAll('[data-adminsave]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-adminsave');
      var payload={
        name:document.getElementById('adm_name').value.trim(),
        username:document.getElementById('adm_username').value.trim(),
        campus:document.getElementById('adm_campus').value,
        dept:document.getElementById('adm_dept').value,
        ministry:(document.getElementById('adm_ministry')||{}).value||'',
        role:document.getElementById('adm_role').value.trim(),
        staffType:document.getElementById('adm_type').value,
        cdKind:(document.getElementById('adm_cdkind')||{}).value||'',
        gpRoles:[].map.call(document.querySelectorAll('[data-admgp]:checked'), function(c){ return c.getAttribute('data-admgp'); }),
        board:{ on:!!(document.getElementById('adm_board')||{}).checked, role:(document.getElementById('adm_boardrole')||{}).value||'Advisor' },
        country:countryValue('adm_country'),
        leads:[].map.call(document.querySelectorAll('[data-admlead]:checked'), function(c){ return c.getAttribute('data-admlead'); }),
        ministries:[].map.call(document.querySelectorAll('[data-admmin]:checked'), function(c){ return c.getAttribute('data-admmin'); }),
        hr:!!(document.getElementById('adm_hr')||{}).checked,
        kmReviewer:!!(document.getElementById('adm_kmrev')||{}).checked,
        portalStaff:!!(document.getElementById('adm_portalstaff')||{}).checked,
        portalAdmin:!!(document.getElementById('adm_portaladmin')||{}).checked
      };
      b.disabled=true; b.textContent=t('Saving…');
      run('adminUpdateStaff',[S.auth.user,S.auth.pin,id,payload],function(d){
        if(d && d.ok){
          /* Show what the server just confirmed it stored (cleanStaffType_/
             cleanCountry_ may have normalised it — "usa" becomes "United
             States", for instance) immediately, rather than waiting on a
             re-fetch to agree — that gap read as "had to save it twice". */
          if(S.adminStaff && d.staff) S.adminStaff=S.adminStaff.map(function(x){ return x.id===id ? d.staff : x; });
          S.adminEditId=null; S.adminEditDraft=null;
          render();
          adminRefreshQuiet_();
        }
        else {
          b.disabled=false; b.textContent=t('Save');
          showMsg(d && d.err==='username_taken' ? t('That username is already taken')
            : d && d.err==='bad_username' ? t('Usernames are letters, numbers, . _ - (2–20 characters)')
            : t('Could not save'));
        }
      });
    };
  });
  document.querySelectorAll('[data-adminsetmentor]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-adminsetmentor');
      var sel=document.querySelector('[data-adminmentor="'+id+'"]');
      var chk=document.querySelector('[data-adminmentorapproved="'+id+'"]');
      var mentorId=sel?sel.value:'';
      var approved=chk?chk.checked:false;
      run('adminSetMentor',[S.auth.user,S.auth.pin,id,mentorId,approved],function(d){
        if(d && d.ok){ showMsg('Mentor updated'); adminRefresh_(); }
        else showMsg('Could not update mentor');
      });
    };
  });
  var codeInput=document.getElementById('adminCodeInput');
  if(codeInput) codeInput.oninput=function(){ S.adminCode=codeInput.value; };
  document.querySelectorAll('[data-admingrant]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-admingrant');
      var make=b.getAttribute('data-adminmake')==='1';
      var s=(S.adminStaff||[]).find(function(x){ return x.id===id; });
      if(!s) return;
      if(!S.adminCode){ showMsg('Enter the admin code first'); return; }
      run('grantAdmin',[S.adminCode, s.username, make],function(d){
        if(d && d.ok){ S.adminCode=''; adminRefresh_(); }
        else showMsg('Could not update admin access');
      });
    };
  });
}

/* ---------- editing what a ministry tracks ----------
   Not every ministry tracks the same things, so getDepartments()'s baseline
   list is only the starting point: a ministry's own staff (or an admin, from
   the Admin page) can turn off what doesn't apply and add what does. A
   custom metric's name carries its own aggregation the same way every
   built-in one already does — "(1-10)" for a score, "(%)" for a percentage,
   plain otherwise for a running total — so modeOf() in taxonomy.js picks it
   up with no extra code, and it shows up on the GP Dashboard, the OKR metric
   picker, everywhere getDepartments() is read, the moment it's saved. */
function metricOverrideFor_(campus, dept, ministry){
  var rec = ((S.base && S.base.metricOverrides) || []).find(function(r){
    return r.campus===campus && r.dept===dept && r.ministry===ministry;
  });
  return rec ? { hidden: rec.hidden||[], custom: rec.custom||[], cadence: rec.cadence||{} } : { hidden:[], custom:[], cadence:{} };
}
/* Weekly / Monthly / Quarterly — admin-only, and only offered for a count
   (sum-mode) metric: a level or score is already "now", not something that
   piles up over a period, so a cadence on it wouldn't mean anything. */
var CADENCE_OPTIONS = [['week','Weekly'],['month','Monthly'],['quarter','Quarterly']];
function metricEditorHtml_(campus, dept, ministry){
  var baseline = (getBaselineDepartments(campus)[dept]||{})[ministry] || [];
  var ov = metricOverrideFor_(campus, dept, ministry);
  var shown = baseline.filter(function(m){ return ov.hidden.indexOf(m)===-1; });
  var hidden = baseline.filter(function(m){ return ov.hidden.indexOf(m)>-1; });

  var h = '<p class="sub" style="margin:2px 0 8px">'+
    esc(t('Turn off what this ministry doesn’t track, move a count to monthly or quarterly, or add something new below.'))+'</p>';
  shown.concat(ov.custom).forEach(function(m){
    var isCustom = ov.custom.indexOf(m)>-1;
    var isSum = modeOf(m)==='sum';
    if(isCustom && S.metricRename===m){
      /* Renaming, inline. Only a metric this ministry added itself — a
         baseline name belongs to the shared taxonomy. The server moves the
         numbers with the name (renameCustomMetric). */
      h += '<div class="row" style="flex-wrap:wrap;gap:6px">'+
        '<input type="text" id="metricRenameInput" maxlength="60" value="'+esc(S.metricRenameText||m)+'" style="flex:1;min-width:140px">'+
        '<button class="linkbtn inline" data-metricrenamesave="'+esc(m)+'">'+esc(t('Save'))+'</button>'+
        '<button class="linkbtn inline" data-metricrenamecancel="'+esc(m)+'">'+esc(t('Cancel'))+'</button></div>';
      return;
    }
    h += '<div class="row"><span class="rowName">'+esc(t(m))+
      (isCustom?' <span class="pmeta" style="display:inline">· '+esc(t('custom'))+'</span>':'')+'</span>'+
      (isSum ? '<select class="cadenceSel" data-metriccadence="'+esc(m)+'" aria-label="'+esc(t('How often'))+'">'+
        CADENCE_OPTIONS.map(function(o){ return '<option value="'+o[0]+'"'+((ov.cadence[m]||'week')===o[0]?' selected':'')+'>'+esc(t(o[1]))+'</option>'; }).join('')+
        '</select>' : '')+
      (isCustom ? '<button class="linkbtn" style="width:auto;margin:0;padding:4px 8px" data-metricrename="'+esc(m)+'">'+esc(t('Rename'))+'</button>' : '')+
      '<button class="linkbtn" style="width:auto;margin:0;padding:4px 8px" data-metricoff="'+esc(m)+'">'+
      esc(t(isCustom?'Remove':'Hide'))+'</button></div>';
  });
  if(hidden.length){
    h += '<p class="hint" style="margin:10px 0 4px">'+esc(t('Hidden'))+'</p>';
    hidden.forEach(function(m){
      h += '<div class="row"><span class="rowName">'+esc(t(m))+'</span>'+
        '<button class="linkbtn" style="width:auto;margin:0;padding:4px 8px" data-metricon="'+esc(m)+'">'+esc(t('Show'))+'</button></div>';
    });
  }
  h += '<div class="field" style="margin-top:10px"><label class="fieldLabel">'+esc(t('Add a metric'))+'</label>'+
    '<input type="text" id="metricNewName" maxlength="60" placeholder="'+esc(t('What do you want to track?'))+
    '" value="'+esc(S.metricNewName||'')+'"></div>'+
    '<div class="pickerRow"><label class="pick"><span>'+esc(t('Type'))+'</span><select id="metricNewType">'+
      [['sum','Count (adds up)'],['avg','Score out of 10'],['pct','Percentage']].map(function(o){
        return '<option value="'+o[0]+'"'+((S.metricNewType||'sum')===o[0]?' selected':'')+'>'+esc(t(o[1]))+'</option>';
      }).join('')+'</select></label></div>'+
    '<button class="btn" id="metricAddBtn" style="margin-top:6px">'+esc(t('Add'))+'</button>';
  return h;
}
/* cadence is omitted (undefined) by every caller except metricCadenceSet_ —
   the server keeps whatever cadence is already stored when it's left out,
   so hiding/adding a metric never touches anyone else's cadence choice. */
function metricEditSave_(campus, dept, ministry, hidden, custom, cadence){
  run('saveMetricOverrides',[S.auth.user,S.auth.pin,campus,dept,ministry,hidden,custom,cadence],function(d){
    if(d && d.ok){ if(S.base) S.base.metricOverrides = d.metricOverrides; render(); }
    else showMsg(t('That didn’t save — try again.'));
  });
}
function metricEditToggle_(target, metric, hide){
  if(!target) return;
  var ov = metricOverrideFor_(target.campus, target.dept, target.ministry);
  var isCustom = ov.custom.indexOf(metric)>-1;
  var hiddenList = ov.hidden.slice(), customList = ov.custom.slice();
  if(isCustom && hide) customList = customList.filter(function(m){ return m!==metric; });
  else if(hide){ if(hiddenList.indexOf(metric)===-1) hiddenList.push(metric); }
  else hiddenList = hiddenList.filter(function(m){ return m!==metric; });
  metricEditSave_(target.campus, target.dept, target.ministry, hiddenList, customList);
}
function metricCadenceSet_(target, metric, cadence){
  if(!target) return;
  var ov = metricOverrideFor_(target.campus, target.dept, target.ministry);
  var nextCadence = Object.assign({}, ov.cadence);
  if(cadence==='week') delete nextCadence[metric]; else nextCadence[metric]=cadence;
  metricEditSave_(target.campus, target.dept, target.ministry, ov.hidden, ov.custom, nextCadence);
}
function metricRenameSave_(target, oldName){
  if(!target) return;
  var newName=(S.metricRenameText||'').trim();
  if(!newName){ showMsg(t('Give it a name first.')); return; }
  if(newName===oldName){ S.metricRename=null; render(); return; }
  run('renameCustomMetric',[S.auth.user,S.auth.pin,target.campus,target.dept,target.ministry,oldName,newName],function(d){
    if(d && d.ok){
      if(S.base) S.base.metricOverrides = d.metricOverrides;
      S.metricRename=null; S.metricRenameText='';
      showMsg(t('Renamed — the numbers moved with it.'));
      /* The numbers on this page are keyed by the old name until re-read. */
      if(target.dept===S.me.dept && target.ministry===S.me.ministry){
        run('getMyMinistry',[S.auth.user,S.auth.pin],function(mn){ if(mn && mn.ok) S.ministry=mn; render(); });
      } else { delete S.oversee[target.ministry]; render(); }
    } else showMsg(d && d.err==='exists' ? t('Already tracking that.') : t('Could not rename'));
  });
}
/* Who may change what a ministry tracks — the client-side mirror of the
   server's canEditMetrics_, for deciding whether to draw the editor at all. */
function canEditMetricsClient_(campus, dept, ministry){
  if(!S.me) return false;
  if(S.me.isAdmin) return true;
  if(campus!==S.me.campus) return false;
  if(S.me.dept==='Campus Leadership') return true;
  return (S.me.leads||[]).indexOf(dept+'|'+ministry)>-1;
}
function ministryLeaders_(campus, dept, ministry){
  var key=dept+'|'+ministry;
  return S.roster.filter(function(p){ return p.campus===campus && (p.leads||[]).indexOf(key)>-1; });
}
function metricEditAdd_(target){
  if(!target) return;
  var name = (S.metricNewName||'').trim();
  if(!name){ showMsg(t('Give it a name first.')); return; }
  var type = S.metricNewType||'sum';
  if(type==='avg' && name.indexOf('(1-10)')===-1) name += ' (1-10)';
  if(type==='pct' && name.indexOf('(%)')===-1) name += ' (%)';
  var ov = metricOverrideFor_(target.campus, target.dept, target.ministry);
  if(ov.custom.indexOf(name)>-1){ showMsg(t('Already tracking that.')); return; }
  S.metricNewName=''; S.metricNewType='sum';
  metricEditSave_(target.campus, target.dept, target.ministry, ov.hidden, ov.custom.concat([name]));
}

/* The whole ministry-KPI experience — the same accCard body kpiCardHtml
   already builds, just given a real page instead of a section buried in My
   Database. Any staff member whose profile carries this ministry can log
   for it, same as before; nothing here is leader-only. What's typed here
   writes straight to the same entries/kpiDaily stores the leadership GP
   Dashboard reads (ministryDataFor_/getData in api.js) — there is no
   separate sync step. */
/* The four numbers that are a person's own, not the ministry's. Fixed for
   now at Uriah's request — "keep it simple". Stored per person in the
   personalKpi blob (saveMyPersonalWeek); never rolled into the dashboard. */
var PERSONAL_METRICS=['People I Shared My Faith With','People I Encouraged','One-on-Ones Held','Teachings Prepped'];

/* Has anything at all been logged for a ministry in a given week — any
   weekly figure, or any day that falls inside it. This is what "shows if a
   week hasn't been inputted" reads. */
function ministryWeekLogged_(data, wk){
  var entries=(data&&data.entries)||{}, daily=(data&&data.daily)||{};
  var k=String(wk), m, d, date;
  for(m in entries){ if(entries[m] && entries[m][k]!==undefined) return true; }
  var b=weekBounds_(wk);
  for(d in daily){ for(date in daily[d]){ if(date>=b.from && date<=b.to) return true; } }
  return false;
}

/* The ministry at a glance — one tile per metric, read with the same rule
   the GP Dashboard reads it: a count is this quarter's total, a level is its
   latest figure, a score is the quarter's average, each with last week
   beside this week. Every ministry's dashboard is therefore different, since
   the tiles are its own metric list. Six show by default; the rest fold. */
/* Which weeks a dashboard period covers. The ministry payload only carries
   this year's weeks, so "year" is the whole of this year so far and "year
   to date" reads the same until weeks get backfilled ahead of today — both
   are offered because that is how the team talks about the numbers. A week
   belongs to a month if its Monday or its Sunday falls in it. */
function weekInPeriod_(w, period){
  var now=thisWeek();
  if(period==='quarter') return qOf(w)===qOf(now);
  if(period==='month'){ var b=weekBounds_(w), m=isoDateOf_(weekYearToday_()).slice(0,7); return b.from.slice(0,7)===m || b.to.slice(0,7)===m; }
  if(period==='ytd') return w<=now;
  return true;
}
function periodWeeks_(wks, period){ var o={}; for(var w in wks){ if(weekInPeriod_(Number(w), period)) o[w]=wks[w]; } return o; }
var DASH_PERIODS=[['month','Month'],['quarter','Quarter'],['year','Year'],['ytd','Year to date']];
function periodChipsHtml_(attr, cur){
  return '<div class="campusSeg periodSeg">'+DASH_PERIODS.map(function(o){
    return '<button class="campusBtn'+(cur===o[0]?' on':'')+'" '+attr+'="'+o[0]+'">'+esc(t(o[1]))+'</button>'; }).join('')+'</div>';
}
function ministryDashboardHtml_(campus, dept, ministry, data){
  var metrics=metricsFor(campus, dept, ministry);
  if(!metrics.length) return '';
  var entries=(data&&data.entries)||{};
  // aggregate() takes rollup.js's 0-based quarter (qOf); people read Q1–Q4.
  var wk=thisWeek(), q0=qOf(wk), p=S.mmPeriod||'quarter', yr=thisWeekYear();
  var list = S.mmDashAll ? metrics : metrics.slice(0,6);
  var title = p==='month' ? t('This month at a glance') : p==='quarter' ? gpT('Q{q} at a glance',{q:q0+1})
    : p==='year' ? gpT('{year} at a glance',{year:yr}) : t('Year to date at a glance');
  var span = p==='month' ? t('this month') : p==='quarter' ? t('this quarter') : p==='year' ? t('this year') : t('year to date');
  var h='<h3>📈 '+esc(title)+'</h3>'+periodChipsHtml_('data-mmperiod', p)+'<div class="mmGrid">';
  list.forEach(function(m){
    var wks=entries[m]||{}, mode=modeOf(m), has=Object.keys(wks).length>0;
    var big, sub;
    if(mode==='sum'){ big=fmt(aggregate(periodWeeks_(wks,p),'sum'), m); sub=span; }
    else if(mode==='latest'){ big=fmt(aggregate(wks,'latest'), m); sub=t('now'); }
    else { big=fmt(aggregate(periodWeeks_(wks,p),'avg'), m); sub=t('avg')+' '+span; }
    var cur=wks[String(wk)];
    h+='<div class="mmTile'+(has?'':' empty')+'"><div class="mmTileName">'+esc(t(m))+'</div>'+
      '<div class="mmTileNum">'+(has?big:'—')+'</div>'+
      '<div class="mmTileSub">'+esc(sub)+(has?gpVsLastWeek(wks, wk, m, cur===undefined?'':cur):'')+'</div></div>';
  });
  h+='</div>';
  if(metrics.length>6){
    h+='<button class="linkbtn" id="mmDashAll" style="margin:-6px 0 8px">'+
      esc(S.mmDashAll ? t('Show fewer') : gpT('Show all {n} metrics',{n:metrics.length}))+'</button>';
  }
  return h;
}

/* Which week, whether it's been logged, and the one button that unfolds the
   form. The strip is the last eight weeks: filled means something was logged,
   hollow means nothing was — tap one to open it. */
