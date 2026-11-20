/* My YWAM GP — teams.html: "Set up my profile", the steps after sign-up (Nov 2026, Andrew).
   Plain script, loaded in order by teams.html; the parts share one global scope.

   "When you make a new account, make it simple, just … your Gmail and … your name. And then once you make the
   account and once it's been approved by the admin, then it'll go over the steps of the information that it asks
   for … what ministry are you in and what kind of campus staff are you and did you fill out your staff contract."

   A new account carries setupTodo (staffRegister) until these steps are done. One question a screen, a Back
   button, a bar showing how far along; nothing is saved until the last step, which sends it all in one
   updateProfile with setupDone — so leaving half-way just starts the steps again next time. The steps start from
   what the profile already has (an invite link's campus / department / ministry). Moving into Campus Leadership
   still waits for an admin (updateProfile keeps it as a request) and the last screen says so. */
var SU_STEPS=['hello','campus','ministry','kind','country','mentor','papers'];
function setupWanted_(){
  if(!S.me || S.guest || S.board || S.student || S.stuPreview || gpTasksApp_()) return false;
  return !!(S.me.setupTodo || (S.setup && S.setup.step==='done'));
}
function setupDraft_(){
  if(S.setup && S.setup.d) return S.setup;
  var m=S.me||{};
  S.setup={ step:'hello', d:{ campus:m.campus||'', dept:m.dept||'', ministry:m.ministry||'', cdKind:'', role:m.role||'',
    staffType:m.staffType||'', country:m.country||'', mentorId:m.mentorId||'', contract:'' } };
  return S.setup;
}
function suHead_(step){
  var i=SU_STEPS.indexOf(step), n=SU_STEPS.length-1;
  var bar=i>0 ? '<div class="suBar" aria-hidden="true"><span style="width:'+Math.round(i/n*100)+'%"></span></div>'+
    '<div class="suCount">'+esc(gpT('Step {n} of {total}',{n:i, total:n}))+'</div>' : '';
  return bar;
}
function suNav_(nextLabel){
  return '<div class="suNav"><button class="btn ghost" id="suBack">← '+esc(t('Back'))+'</button>'+
    '<button class="btn" id="suNext">'+esc(nextLabel||t('Next'))+'</button></div>';
}
function setupHtml_(){
  var su=setupDraft_(), d=su.d, step=su.step, first=String((S.me && S.me.name)||'').split(' ')[0];
  var h='<div class="suWrap" id="setup" data-sustep="'+esc(step)+'">'+suHead_(step);
  if(step==='hello'){
    h+='<div class="suHello">👋</div><h2>'+esc(gpT('Welcome to YWAM GP, {name}!',{name:first}))+'</h2>'+
      '<p class="sub">'+esc(t('An admin has said yes to your profile. A few short questions so the app fits you — about a minute.'))+'</p>'+
      '<button class="btn" id="suNext">'+esc(t('Let’s start'))+'</button>';
  } else if(step==='campus'){
    h+='<h2>'+esc(t('Which campus are you at?'))+'</h2><div class="suChoices">'+CAMPUSES.map(function(c){
      return '<button class="suChoice'+(d.campus===c.id?' on':'')+'" data-sucampus="'+esc(c.id)+'">🏠 '+esc(c.name)+'</button>'; }).join('')+'</div>'+
      suNav_();
  } else if(step==='ministry'){
    var depts=deptsFor(d.campus||'poipet');
    h+='<h2>'+esc(t('Where do you serve?'))+'</h2><p class="sub">'+esc(t('Your department and your ministry. This puts your team’s numbers and tasks on your page.'))+'</p>'+
      '<input type="hidden" id="su_campus" value="'+esc(d.campus)+'">'+
      '<label class="f">'+esc(t('Department'))+'</label><select id="su_dept"><option value="">'+esc(t('— choose —'))+'</option>'+depts.map(function(x){
        return '<option value="'+esc(x)+'"'+(d.dept===x?' selected':'')+'>'+esc(t(x))+'</option>'; }).join('')+'</select>'+
      '<label class="f">'+esc(t('Ministry'))+'</label><select id="su_ministry"></select>'+
      '<div class="hint">'+esc(t('Not sure of your ministry yet? Pick your department — you can change it any time in Profile & settings.'))+'</div>'+
      '<div class="hint" id="suCltNote"'+(d.dept===BL_DEPT?'':' style="display:none"')+'>🧭 '+esc(t('A Campus Leadership role waits for an admin to approve it.'))+'</div>'+
      '<label class="f">'+esc(t('Role / team (optional)'))+'</label><input type="text" id="su_role" value="'+esc(d.role)+'" placeholder="'+esc(t('e.g. Cafe barista, DTS staff'))+'">'+
      suNav_();
  } else if(step==='kind'){
    h+='<h2>'+esc(t('What kind of staff are you?'))+'</h2><div class="suChoices">'+STAFF_TYPES.map(function(ty){
      return '<button class="suChoice'+(d.staffType===ty.id?' on':'')+'" data-sukind="'+esc(ty.id)+'"><b>'+esc(t(ty.label))+'</b><span>'+esc(t(ty.hint))+'</span></button>'; }).join('')+'</div>'+
      suNav_();
  } else if(step==='country'){
    h+='<h2>'+esc(t('Where are you from?'))+'</h2>'+countryFieldHtml('su_country', d.country)+suNav_();
  } else if(step==='mentor'){
    var me=S.me||{}, people=(S.roster||[]).filter(function(p){ return p.id!==me.id && !p.applicant; }).sort(function(a,b){ return a.name<b.name?-1:1; });
    var here=people.filter(function(p){ return p.campus===d.campus; }), there=people.filter(function(p){ return p.campus!==d.campus; });
    var opt=function(p){ return '<option value="'+esc(p.id)+'"'+(d.mentorId===p.id?' selected':'')+'>'+esc(p.name)+(p.dept?' · '+esc(t(p.dept)):'')+'</option>'; };
    h+='<h2>'+esc(t('Who is your mentor?'))+'</h2><p class="sub">'+esc(t('Everyone at YWAM GP has a mentor — someone who meets with you twice a month. They see your private weekly check-ins, so pick someone you trust.'))+'</p>'+
      '<select id="su_mentor"><option value="">'+esc(t('I don’t know yet — choose later'))+'</option>'+
      (here.length ? '<optgroup label="'+esc(campusName(d.campus))+'">'+here.map(opt).join('')+'</optgroup>' : '')+
      (there.length ? '<optgroup label="'+esc(t('Other campus'))+'">'+there.map(opt).join('')+'</optgroup>' : '')+'</select>'+
      '<div class="hint">'+esc(t('They are asked first, and see nothing until they say yes.'))+'</div>'+suNav_();
  } else if(step==='papers'){
    h+='<h2>'+esc(t('Your staff contract'))+'</h2><p class="sub">'+esc(t('HR fills out your staff contract with you, in person, and you both sign it in the app.'))+'</p>'+
      '<p style="margin:12px 0 6px;font-weight:700">'+esc(t('Have you signed your staff contract with HR?'))+'</p><div class="suChoices two">'+
      [['yes','✅ '+t('Yes, I have')],['no','⏳ '+t('Not yet')]].map(function(o){
        return '<button class="suChoice'+(d.contract===o[0]?' on':'')+'" data-sucontract="'+o[0]+'">'+esc(o[1])+'</button>'; }).join('')+'</div>'+
      (d.contract==='no' ? '<div class="banner" id="suContractNo">💬 '+esc(t('No problem — tell HR you’re new, and they will set a time to fill it out with you.'))+'</div>' : '')+
      '<p class="hint" style="margin-top:12px">📝 '+esc(t('The Child Protection Agreement and any other papers everyone signs are in My contract — you can sign them right after this.'))+'</p>'+
      suNav_(su.saving ? t('Saving…') : t('Finish'));
  } else if(step==='done'){
    h+='<div class="suHello">🎉</div><h2>'+esc(t('You’re all set!'))+'</h2><p class="sub">'+esc(t('Your profile is ready. A couple of things to do when you can:'))+'</p>'+
      (su.clt ? '<div class="banner">🧭 '+esc(t('Your Campus Leadership role is waiting for an admin to approve it.'))+'</div>' : '')+
      '<button class="suChoice" data-sudone="profile"><b>📷 '+esc(t('Add a photo'))+'</b><span>'+esc(t('So the team knows your face.'))+'</span></button>'+
      '<button class="suChoice" data-sudone="mycontract"><b>📝 '+esc(t('Sign my papers'))+'</b><span>'+esc(t('The Child Protection Agreement and the rest, in My contract.'))+'</span></button>'+
      '<button class="btn" data-sudone="week" id="suHome">'+esc(t('Go to My Home'))+'</button>';
  }
  return h+'</div>';
}
/* read what is on the screen into the draft (before Back, Next, or a redraw) */
function suRead_(){
  var su=setupDraft_(), d=su.d, el=function(id){ return document.getElementById(id); };
  if(su.step==='ministry' && el('su_dept')){ d.dept=el('su_dept').value; var mv=minSelValue_('su_ministry','su_dept'); d.ministry=mv.ministry||''; d.cdKind=mv.cdKind||''; d.role=String(el('su_role').value||'').trim(); }
  if(su.step==='country' && el('su_country')) d.country=countryValue('su_country');
  if(su.step==='mentor' && el('su_mentor')) d.mentorId=el('su_mentor').value;
}
function suMissing_(){
  var su=setupDraft_(), d=su.d;
  if(su.step==='campus' && !d.campus) return t('Pick your campus');
  if(su.step==='ministry' && !d.dept) return t('Pick your department');
  if(su.step==='kind' && !d.staffType) return t('Pick one');
  if(su.step==='country' && !d.country) return t('Pick your country');
  if(su.step==='papers' && !d.contract) return t('Pick one');
  return '';
}
function suGo_(dir){
  var su=setupDraft_(), i=SU_STEPS.indexOf(su.step);
  suRead_();
  if(dir>0){
    var miss=suMissing_(); if(miss){ showMsg(miss); return; }
    if(su.step==='papers'){ suSave_(); return; }
  }
  su.step=SU_STEPS[Math.max(0, Math.min(SU_STEPS.length-1, i+dir))];
  render(); window.scrollTo(0,0);
}
function suSave_(){
  var su=setupDraft_(), d=su.d;
  if(su.saving) return;
  su.saving=true; render();
  run('updateProfile',[S.auth.user, S.auth.pin, { campus:d.campus, dept:d.dept, ministry:d.ministry, cdKind:d.cdKind, role:d.role,
    staffType:d.staffType, country:d.country, mentorId:d.mentorId, setupDone:true }], function(r){
    su.saving=false;
    if(r && r.ok){
      if(r.staff) S.me=Object.assign({}, S.me, r.staff); if(S.me) delete S.me.setupTodo;
      if(r.profile) S.profile=Object.assign(S.profile||{}, r.profile);
      su.step='done'; su.clt=!!r.cltPending;
      render(); window.scrollTo(0,0);
      try { if(typeof gpConfetti==='function') gpConfetti(); } catch(e){}
    } else { showMsg(t('Could not save — try again.')); render(); }
  }, function(){ su.saving=false; showMsg(t('No connection — try again when you are online.')); render(); });
}
function bindSetup_(){
  var root=document.getElementById('setup'); if(!root) return;
  var su=setupDraft_(), d=su.d;
  var nx=document.getElementById('suNext'); if(nx) nx.onclick=function(){ gpTap(); suGo_(1); };
  var bk=document.getElementById('suBack'); if(bk) bk.onclick=function(){ gpTap(); suGo_(-1); };
  root.querySelectorAll('[data-sucampus]').forEach(function(b){ b.onclick=function(){
    gpTap(); var c=b.getAttribute('data-sucampus');
    if(c!==d.campus){ d.campus=c; if(deptsFor(c).indexOf(d.dept)===-1){ d.dept=''; d.ministry=''; } }
    su.step='ministry'; render(); window.scrollTo(0,0); }; });
  root.querySelectorAll('[data-sukind]').forEach(function(b){ b.onclick=function(){ gpTap(); d.staffType=b.getAttribute('data-sukind'); su.step='country'; render(); window.scrollTo(0,0); }; });
  root.querySelectorAll('[data-sucontract]').forEach(function(b){ b.onclick=function(){ gpTap(); d.contract=b.getAttribute('data-sucontract'); render(); }; });
  if(document.getElementById('su_ministry')){
    fillMinistrySelect('su_ministry','su_campus','su_dept', d.ministry, d.cdKind);
    var sd=document.getElementById('su_dept');
    sd.onchange=function(){ document.getElementById('su_ministry').value=''; fillMinistrySelect('su_ministry','su_campus','su_dept',''); var n=document.getElementById('suCltNote'); if(n) n.style.display = sd.value===BL_DEPT ? '' : 'none'; };
  }
  var cs=document.getElementById('su_country'), cb=document.getElementById('su_country_other');
  if(cs && cb) cs.onchange=function(){ var o=cs.value==='__other'; cb.style.display=o?'':'none'; if(o) cb.focus(); };
  root.querySelectorAll('[data-sudone]').forEach(function(b){ b.onclick=function(){
    gpTap(); var v=b.getAttribute('data-sudone');
    S.setup=null;
    afterLogin();   // a fresh boot: the page is now about their campus and ministry
    if(v!=='week') S.view=v;
  }; });
}
/* the tasks app (tasks.html) has no steps of its own: it says where to finish them */
function setupTaHtml_(){
  return '<div class="card" id="setupTa"><h2 style="margin-top:0">👋 '+esc(t('Finish setting up your profile'))+'</h2><p class="sub">'+esc(t('A few short questions in the YWAM GP app first — then your tasks are here.'))+'</p>'+
    '<a class="btn" href="teams.html">'+esc(t('Open the YWAM GP app'))+'</a></div>';
}
