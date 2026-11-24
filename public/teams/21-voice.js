/* ===== Talk it through → tasks (Nov 2026, Uriah: "voice stream of consciousness into our tasks app and then
   have Claude build out tasks and calendar dates") =====
   GP Tasks has a microphone above the round ＋. Say (or type) everything on your mind; the words go to the
   server's `voiceTasks`, which asks Claude for tasks with days, times, lists and people; they come back as a
   list to check — untick, reword, change a day — and only "Add n tasks" saves anything, one saveGpTask each.
   Tasks with a day then show on the Calendar like any other.
   Speech becomes words on the phone (the browser's SpeechRecognition, where it has one); everywhere else the
   keyboard's own microphone does the same job in the box. Shown only when the site has its key (boot `voice`). */
S.voiceOn=false; S.gv=null;
function gvOn_(){ return !!S.voiceOn && !S.guest && !S.student && !S.stuPreview; }
/* The browser's own listening. Not offered in an iPhone / iPad Home Screen app, where it starts and then hangs
   without a word or an end (what "it just freezes" was): the keyboard's microphone works there instead. */
function gvRec_(){
  var R=window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if(R && gpIos_() && gpStandalone_()) return null;
  return R;
}
/* the language they talk in — its own choice, not the app's: people often run the app in English and think out loud
   in Khmer, or mix the two. Kept on this phone. */
function gvLang_(){ var v=lsGet('gp-gv-lang'); return v==='km' || v==='en' ? v : (LANG==='km' ? 'km' : 'en'); }
var GV_LISTEN_WAIT=9000;   // nothing heard this long after starting → stop and say so, never "Listening…" for ever
var GV_ASK_WAIT=30000;     // the answer: past this the button comes back
var GV_MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
function gvFabHtml_(){
  if(!gvOn_() || S.gtMenu) return '';
  return '<button class="gtFab gvFab" id="gvOpen" aria-label="'+esc(t('Talk it through'))+'">'+GV_MIC+'</button>';
}
function gvLists_(){ return ((S.gpt && S.gpt.lists)||[]).filter(function(L){ return L.canEdit && !L.onlyAssigned; }); }
function gvHtml_(){
  var V=S.gv; if(!V) return '';
  var h='<div class="scrim" id="gvScrim"></div><div class="gtSheet gvSheet" id="gvSheet" role="dialog" aria-label="'+esc(t('Talk it through'))+'">';
  if(V.items){
    var n=V.items.filter(function(x){ return x.on; }).length, lists=gvLists_();
    h+='<div class="gtSheetHead"><b>'+esc(V.items.length ? t('Here is what I heard') : t('I didn’t hear anything to do'))+'</b></div>';
    if(V.note) h+='<p class="hint gvNote" id="gvNote">'+esc(V.note)+'</p>';
    if(V.items.length) h+='<p class="hint">'+esc(t('Check each one. Nothing is saved until you tap Add.'))+'</p>';
    h+='<div class="gvItems" id="gvItems">'+V.items.map(function(x, i){
      return '<div class="gvItem'+(x.on?'':' off')+'" data-gvitem="'+i+'">'+
        '<button class="gvTick'+(x.on?' on':'')+'" data-gvon="'+i+'" role="checkbox" aria-checked="'+(x.on?'true':'false')+'" aria-label="'+esc(t('Add this one'))+'">'+(x.on?'✓':'')+'</button>'+
        '<div class="gvBody"><input type="text" class="gvTitle" data-gvf="'+i+'|title" maxlength="200" value="'+esc(x.title)+'" aria-label="'+esc(t('Task'))+'">'+
          (x.notes ? '<div class="gvNotes">'+esc(x.notes)+'</div>' : '')+
          (x.steps.length ? '<ul class="gvSteps">'+x.steps.map(function(s){ return '<li>'+esc(s)+'</li>'; }).join('')+'</ul>' : '')+
          '<div class="gvMeta"><input type="date" data-gvf="'+i+'|due" value="'+esc(x.due)+'" aria-label="'+esc(t('Set date'))+'">'+
            '<input type="time" step="900" data-gvf="'+i+'|time" value="'+esc(x.time)+'" aria-label="'+esc(t('Set time'))+'"'+(x.due?'':' disabled')+'>'+
            (lists.length>1 ? '<select data-gvf="'+i+'|listId" aria-label="'+esc(t('List'))+'">'+lists.map(function(L){ return '<option value="'+esc(L.id)+'"'+(L.id===x.listId?' selected':'')+'>'+esc(gptChipName_(L))+'</option>'; }).join('')+'</select>' : '')+'</div>'+
          (x.assignees.length ? '<div class="gvWho">'+x.assignees.map(function(id){ return '<button class="chip gvPerson" data-gvrm="'+i+'|'+esc(id)+'" aria-label="'+esc(gpT('Take {name} off',{name:gptPerson_(id).name}))+'">👤 '+esc(firstName_(gptPerson_(id).name))+' ✕</button>'; }).join('')+'</div>' : '')+
        '</div></div>';
    }).join('')+'</div>';
    h+='<div class="gtTools"><button class="gtTool gvBack" id="gvBack">← '+esc(t('Say more'))+'</button><span style="flex:1"></span>'+
      '<button class="btn" id="gvAdd"'+((!n || V.saving)?' disabled':'')+'>'+esc(V.saving ? t('Saving…') : n===1 ? t('Add 1 task') : gpT('Add {n} tasks',{n:n}))+'</button></div>';
    return h+'</div>';
  }
  h+='<div class="gtSheetHead"><b>'+esc(t('Talk it through'))+'</b></div>'+
    '<p class="hint">'+esc(t('Say everything on your mind — what needs doing, by when, and who should do it. I’ll turn it into tasks for you to check.'))+'</p>'+
    gvLangHtml_()+
    '<textarea id="gvText" rows="6" maxlength="6000" placeholder="'+esc(t('“Tomorrow I need to call the plumber, and Friday at two we meet about the outreach — ask Sokha to book the room…”'))+'">'+esc(V.text||'')+'</textarea>'+
    (gvRec_() ? '<button class="gvMic'+(V.listening?' on':'')+'" id="gvMic">'+GV_MIC+'<span id="gvMicText">'+esc(V.listening ? t('Listening… tap to stop') : t('Tap to talk'))+'</span></button>'
              : '<p class="hint" id="gvKeyHint">🎙 '+esc(t('Tap the box, then the microphone on your keyboard, and talk.'))+'</p>')+
    gvKmHintHtml_()+
    (V.err ? '<p class="hint gvErr" id="gvErr">'+esc(V.err)+'</p>' : '')+
    '<p class="hint gvFine">'+esc(t('Your words are sent to Claude (Anthropic) to be turned into tasks, with the names of your lists and your campus’s staff.'))+'</p>'+
    '<div class="gtTools"><button class="gtTool" id="gvClose">'+esc(t('Cancel'))+'</button><span style="flex:1"></span>'+
      '<button class="btn" id="gvGo"'+(V.busy?' disabled':'')+'>'+esc(V.busy ? t('Working it out…') : t('Make my tasks'))+'</button></div>';
  return h+'</div>';
}
function gvLangHtml_(){
  var l=gvLang_();
  return '<div class="gvLang" role="group" aria-label="'+esc(t('I’m talking in'))+'"><span>'+esc(t('I’m talking in'))+'</span>'+
    '<button class="chip'+(l==='km'?' on':'')+'" data-gvlang="km" aria-pressed="'+(l==='km')+'">ខ្មែរ</button>'+
    '<button class="chip'+(l==='en'?' on':'')+'" data-gvlang="en" aria-pressed="'+(l==='en')+'">English</button></div>';
}
/* Khmer on an iPhone: Apple's dictation has no Khmer, so the way to talk Khmer into the box is Gboard's microphone. */
function gvKmHintHtml_(){
  if(gvLang_()!=='km') return '';
  if(gpIos_()) return '<p class="hint gvKmHint" id="gvKmHint">🇰🇭 '+esc(t('iPhone dictation has no Khmer. Install the Gboard keyboard, add Khmer to it, then tap the box and Gboard’s microphone, and talk.'))+'</p>';
  return '<p class="hint gvKmHint" id="gvKmHint">'+esc(t('Mixing Khmer and English is fine. Say names and times the way you normally would.'))+'</p>';
}
function gvStop_(){ var V=S.gv; if(V) clearTimeout(V.watch); if(V && V.rec){ try{ V.rec.onend=null; V.rec.stop(); }catch(e){} V.rec=null; } if(V) V.listening=false; }
function gvClose_(){ gvStop_(); if(S.gv) clearTimeout(S.gv.askTimer); S.gv=null; render(); }
function gvListen_(){
  var V=S.gv, R=gvRec_(); if(!V || !R) return;
  if(V.listening){ gvStop_(); render(); return; }
  var rec; try{ rec=new R(); }catch(e){ V.err=t('This phone can’t listen here. Tap the box, then the microphone on your keyboard, and talk.'); render(); return; }
  rec.lang=gvLang_()==='km' ? 'km-KH' : 'en-US'; rec.continuous=true; rec.interimResults=true;
  var base=(V.text||'').trim(), heard=false;
  clearTimeout(V.watch);
  V.watch=setTimeout(function(){
    if(S.gv!==V || V.rec!==rec || heard) return;
    gvStop_(); V.err=t('I couldn’t hear anything. Tap to talk again, or use the microphone on your keyboard.'); render();
  }, S.gvListenWait || GV_LISTEN_WAIT);
  rec.onresult=function(ev){
    heard=true;
    var fin='', live='';
    for(var i=0;i<ev.results.length;i++){ var r=ev.results[i]; if(r.isFinal) fin+=r[0].transcript+' '; else live+=r[0].transcript; }
    V.text=((base ? base+' ' : '')+fin+live).replace(/\s+/g,' ').trim().slice(0, 6000);
    var el=document.getElementById('gvText'); if(el){ el.value=V.text; el.scrollTop=el.scrollHeight; }   // no redraw while talking
  };
  rec.onerror=function(ev){
    if(ev && (ev.error==='not-allowed' || ev.error==='service-not-allowed')) V.err=t('The microphone is blocked for this app. Allow it in your browser’s settings, or use the microphone on your keyboard.');
    else if(ev && ev.error==='language-not-supported') V.err=gvLang_()==='km' ? t('This phone can’t listen in Khmer. Use the Gboard keyboard’s microphone, or switch to English.') : t('This phone can’t listen in this language. Use the microphone on your keyboard.');
    else if(ev && ev.error==='no-speech') V.err=t('I couldn’t hear anything. Tap to talk again, or use the microphone on your keyboard.');
    else if(ev && (ev.error==='network' || ev.error==='audio-capture')) V.err=t('Listening stopped. Tap to talk again, or use the microphone on your keyboard.');
    if(ev && ev.error!=='aborted' && S.gv===V){ clearTimeout(V.watch); try{ rec.onend=null; rec.abort(); }catch(e){} V.rec=null; V.listening=false; render(); }
  };
  rec.onend=function(){ clearTimeout(V.watch); if(S.gv===V && V.rec===rec){ V.listening=false; V.rec=null; render(); } };
  try{ rec.start(); V.rec=rec; V.listening=true; V.err=''; }catch(e){ V.listening=false; }
  render();
}
var GV_ERR={ empty:'Say or type something first.', too_long:'That is a lot at once — send it in two parts.', day_limit:'That’s enough for today — try again tomorrow, or add the tasks by hand.',
  not_set_up:'This isn’t set up yet — an admin needs to add the key.', bad_key:'The key for this isn’t working — tell an admin.', busy:'Claude is busy right now — try again in a moment.',
  slow:'That took too long — try again, or say a little less at once.', refused:'I couldn’t make tasks from that.', ai_error:'Something went wrong making the tasks — try again.' };
function gvGo_(){
  var V=S.gv; if(!V || V.busy) return;
  gvStop_();
  var el=document.getElementById('gvText'); if(el) V.text=el.value;
  var said=(V.text||'').trim(); if(said.length<3){ V.err=t(GV_ERR.empty); render(); return; }
  V.busy=true; V.err=''; render();
  var ask=V.ask=(V.ask||0)+1;
  clearTimeout(V.askTimer);
  V.askTimer=setTimeout(function(){ if(S.gv!==V || V.ask!==ask || !V.busy) return; V.ask++; V.busy=false; V.err=t(GV_ERR.slow); render(); }, S.gvAskWait || GV_ASK_WAIT);
  run('voiceTasks',[S.auth.user,S.auth.pin,said,{ lang:LANG, spoke:gvLang_() }],function(d){
    if(S.gv!==V || V.ask!==ask) return;
    clearTimeout(V.askTimer); V.busy=false;
    if(d && d.ok){
      var open=S.gptList && gptListById_(S.gptList), main=gptMain_();
      V.note=d.note||'';
      V.items=(d.tasks||[]).map(function(x){ return { on:true, title:x.title, notes:x.notes||'', due:x.due||'', time:x.time||'', steps:x.steps||[], assignees:x.assignees||[],
        listId:(x.listId && gptListById_(x.listId) && !(main && x.listId===main.id)) ? x.listId : (S.gptPageScope && open && open.canEdit ? open.id : (x.listId || (main && main.id) || '')) }; });
    } else V.err=t(GV_ERR[d && d.err] || GV_ERR.ai_error);
    render();
  }, function(e){ if(S.gv!==V || V.ask!==ask) return; clearTimeout(V.askTimer); V.busy=false;
    V.err=t(e && /abort|time/i.test(String(e.message||e)) ? GV_ERR.slow : 'No connection — try again when you are online.'); render(); });
}
/* one at a time, in order: each save reads and writes the whole task store */
function gvAdd_(){
  var V=S.gv; if(!V || !V.items || V.saving) return;
  var todo=V.items.filter(function(x){ return x.on && (x.title||'').trim() && !x.saved; }); if(!todo.length) return;
  V.saving=true; render();
  var made=0, last=null;
  var done=function(failed){
    V.saving=false;
    if(last) gptTake_(last);
    if(failed){ showMsg(made ? gpT('Added {n} — the rest could not be saved. Try again.',{n:made}) : t('Could not save')); render(); return; }
    S.gv=null; if(typeof gpConfetti==='function') try{ gpConfetti(); }catch(e){}
    showMsg(made===1 ? t('Added 1 task') : gpT('Added {n} tasks',{n:made})); render();
  };
  var next=function(){
    var x=todo.shift(); if(!x){ done(false); return; }
    x.rid=x.rid || ('v'+Date.now().toString(36)+Math.random().toString(36).slice(2, 10));
    run('saveGpTask',[S.auth.user,S.auth.pin,{ rid:x.rid, listId:x.listId, title:x.title.trim(), notes:x.notes, due:x.due||'', time:x.due ? (x.time||'') : '', assignees:x.assignees,
      subs:x.steps.map(function(s){ return { id:'', text:s, done:false }; }) }],function(d){
        if(d && d.ok){ x.saved=true; x.on=false; made++; last=d; next(); } else done(true);
      }, function(){ done(true); });
  };
  next();
}
function bindVoice_(){
  var on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; };
  on('gvOpen', function(){ gpTap(); S.gv={ text:'', listening:false, busy:false, items:null, err:'', note:'' }; render(); if(!gvRec_()){ var el=document.getElementById('gvText'); if(el) el.focus(); } });
  var V=S.gv; if(!V) return;
  on('gvScrim', function(){ if(!V.saving) gvClose_(); });
  on('gvClose', gvClose_);
  on('gvMic', function(){ gpTap(); gvListen_(); });
  document.querySelectorAll('[data-gvlang]').forEach(function(b){ b.onclick=function(){
    var l=b.getAttribute('data-gvlang'); if(l===gvLang_()) return;
    lsSet('gp-gv-lang', l); var was=V.listening; gvStop_(); render(); if(was) gvListen_();
  }; });
  on('gvGo', gvGo_);
  var tx=document.getElementById('gvText'); if(tx) tx.oninput=function(){ V.text=tx.value; };
  on('gvBack', function(){ V.items=null; V.note=''; render(); });
  on('gvAdd', gvAdd_);
  document.querySelectorAll('[data-gvon]').forEach(function(b){ b.onclick=function(){ var x=V.items[+b.getAttribute('data-gvon')]; if(x){ x.on=!x.on; render(); } }; });
  document.querySelectorAll('[data-gvf]').forEach(function(inp){
    var p=inp.getAttribute('data-gvf').split('|'), x=V.items && V.items[+p[0]]; if(!x) return;
    inp.oninput=inp.onchange=function(){ x[p[1]]=inp.value; if(p[1]==='due'){ if(!inp.value) x.time=''; var tm=document.querySelector('[data-gvf="'+p[0]+'|time"]'); if(tm){ tm.disabled=!inp.value; if(!inp.value) tm.value=''; } } };
  });
  document.querySelectorAll('[data-gvrm]').forEach(function(b){ b.onclick=function(){ var p=b.getAttribute('data-gvrm').split('|'), x=V.items[+p[0]]; if(x){ x.assignees=x.assignees.filter(function(id){ return id!==p[1]; }); render(); } }; });
}
