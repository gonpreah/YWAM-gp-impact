/* ---- Learn Khmer (Oct 2026, Andrew: "incorporate the KBC vocab book — fun and easy, like Quizlet,
   by categories and difficulties") ----
   The words are in khmer-vocab.js (loaded on demand, like the Library's): three levels, each a set
   of word lists. Three ways to learn a list, like Quizlet's: Flashcards (tap to flip, "Got it" /
   "Still learning"), Quiz (four choices), Match (six pairs against the clock). What you know is
   kept on this phone (`gp-kh-progress`: per word a box 0–3 — 2 and up counts as known — and when
   you last saw it); the Daily mix picks the words that are due. Best Match times in `gp-kh-best`. */
S.kh={ level:null, cat:null, mode:null, front:'en' };
S.khLoading=false; S.khError=false;
function khLoad_(){
  if(typeof GP_KHMER_VOCAB!=='undefined' || S.khLoading) return;
  S.khLoading=true; S.khError=false;
  var sc=document.createElement('script'); sc.src='khmer-vocab.js'; sc.setAttribute('data-optional','');
  sc.onload=function(){ S.khLoading=false; if(S.view==='khmer') render(); };
  sc.onerror=function(){ S.khLoading=false; S.khError=true; sc.remove(); if(S.view==='khmer') render(); };
  document.head.appendChild(sc);
}
function khOpen_(){ S.view='khmer'; S.kh.level=null; S.kh.cat=null; S.kh.mode=null; khLoad_(); render(); window.scrollTo(0,0); }
function khCats_(level){ return GP_KHMER_VOCAB.cats.filter(function(c){ return !level || c.level===level; }); }
function khCat_(id){ return GP_KHMER_VOCAB.cats.filter(function(c){ return c.id===id; })[0] || null; }
function khKey_(c, w){ return c.id+'|'+w[0]; }
/* what you know: { key: { b: box 0–3, t: when } } */
function khProg_(){ try { var v=JSON.parse(lsGet('gp-kh-progress')||'{}'); return v && typeof v==='object' ? v : {}; } catch(e){ return {}; } }
function khBox_(c, w){ var p=khProg_()[khKey_(c, w)]; return p ? (p.b||0) : 0; }
function khMark_(c, w, right){
  var P=khProg_(), k=khKey_(c, w), b=P[k] ? (P[k].b||0) : 0;
  P[k]={ b: right ? Math.min(3, b+1) : Math.max(0, b-1), t: Date.now() };
  lsSet('gp-kh-progress', JSON.stringify(P));
}
function khKnown_(c){ var n=0; c.words.forEach(function(w){ if(khBox_(c, w)>=2) n++; }); return n; }
function khTotals_(level){ var k=0, n=0; khCats_(level).forEach(function(c){ k+=khKnown_(c); n+=c.words.length; }); return { known:k, total:n }; }
/* the words due today across every list: seen before, not yet in the top box, and old enough for their box */
function khDue_(){
  var P=khProg_(), now=Date.now(), out=[];
  GP_KHMER_VOCAB.cats.forEach(function(c){ c.words.forEach(function(w){ var p=P[khKey_(c, w)]; if(!p || p.b>=3) return; var days=[0, 1, 3][p.b]||0; if(now-(p.t||0) >= days*864e5) out.push({ c:c, w:w }); }); });
  return khShuffle_(out).slice(0, 20);
}
function khShuffle_(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)), x=a[i]; a[i]=a[j]; a[j]=x; } return a; }
function khPct_(k, n){ return n ? Math.round(k/n*100) : 0; }
function khBar_(k, n){ return '<div class="khBar"><div style="width:'+khPct_(k, n)+'%"></div></div>'; }
function khWordHtml_(w, front){   // one side of a card: the word, and its note under it
  var km = front==='km';
  return '<span class="'+(km?'khKm':'khEn')+'">'+esc(km ? w[1] : w[0])+'</span>'+(w[2] ? '<span class="khNote">'+esc(w[2])+'</span>' : '');
}
/* ---- the pages ---- */
function khmerHtml_(){
  var h='<button class="linkbtn" id="khBack" style="text-align:left;text-decoration:none;padding-left:0">← '+esc(S.kh.mode ? t('Back') : S.kh.cat ? t('Lists') : S.kh.level ? t('Learn Khmer') : t('My Home'))+'</button>';
  if(typeof GP_KHMER_VOCAB==='undefined'){ if(!S.khLoading && !S.khError) setTimeout(khLoad_, 0); return h+'<h2>'+esc(t('Learn Khmer'))+'</h2><div class="card"><p class="sub" style="margin:0">'+esc(S.khError ? t('The words could not load. Check your connection and try again.') : t('Loading…'))+'</p></div>'; }
  if(S.kh.mode) return h+khModeHtml_();
  if(S.kh.cat) return h+khCatHtml_(khCat_(S.kh.cat));
  if(S.kh.level) return h+khLevelHtml_(S.kh.level);
  var T=khTotals_(null), due=khDue_();
  h+='<h2>'+esc(t('Learn Khmer'))+'</h2><p class="sub" style="margin:-4px 0 10px">'+esc(t('The words of the KBC vocabulary book, by Phy Chum and Andrew Potter — a few minutes a day.'))+'</p>';
  h+='<div class="card khHero"><div class="khRing" style="--p:'+khPct_(T.known, T.total)+'"><b>'+khPct_(T.known, T.total)+'%</b></div><div><b>'+esc(gpT('{n} of {total} words known',{n:T.known, total:T.total}))+'</b><div class="hint">'+esc(t('A word counts as known once you have got it right twice.'))+'</div></div></div>';
  h+='<div class="card khDue"><div><b>'+esc(t('Daily mix'))+'</b><div class="hint">'+esc(due.length ? gpT('{n} words due for a look today',{n:due.length}) : T.known ? t('Nothing due — learn a new list, or come back tomorrow.') : t('Start a list below and your daily mix fills itself.'))+'</div></div>'+
    (due.length ? '<button class="btn small" id="khDaily" style="width:auto;margin:0">'+esc(t('Practise'))+'</button>' : '')+'</div>';
  GP_KHMER_VOCAB.levels.forEach(function(L){ var tl=khTotals_(L.id);
    h+='<button class="card khLevel" data-khlevel="'+L.id+'"><div class="khLevelTop"><b>'+esc(gpT('Level {n}',{n:L.id}))+' · '+esc(t(L.name))+'</b><span>'+tl.known+' / '+tl.total+'</span></div><div class="hint">'+esc(t(L.blurb))+'</div>'+khBar_(tl.known, tl.total)+'<div class="hint">'+esc(gpT('{n} lists',{n:khCats_(L.id).length}))+'</div></button>'; });
  return h;
}
function khLevelHtml_(level){
  var L=GP_KHMER_VOCAB.levels.filter(function(x){ return x.id===level; })[0], tl=khTotals_(level);
  var h='<h2>'+esc(gpT('Level {n}',{n:level}))+' · '+esc(t(L.name))+'</h2><p class="sub" style="margin:-4px 0 10px">'+esc(t(L.blurb))+'</p>'+khBar_(tl.known, tl.total);
  h+='<div class="khCats">'+khCats_(level).map(function(c){ var k=khKnown_(c);
    return '<button class="card khCatCard" data-khcat="'+esc(c.id)+'"><b>'+esc(t(c.name))+'</b><span class="hint">'+esc(gpT('{n} words',{n:c.words.length}))+(k ? ' · '+esc(gpT('{n} known',{n:k})) : '')+'</span>'+khBar_(k, c.words.length)+'</button>'; }).join('')+'</div>';
  return h;
}
function khCatHtml_(c){
  var k=khKnown_(c);
  var h='<h2>'+esc(t(c.name))+'</h2><p class="sub" style="margin:-4px 0 6px">'+esc(gpT('{n} words',{n:c.words.length}))+' · '+esc(gpT('{n} known',{n:k}))+'</p>'+khBar_(k, c.words.length);
  if(c.tip) h+='<p class="hint khTip">💡 '+esc(c.tip)+'</p>';
  h+='<div class="khModes"><button class="card khMode" data-khmode="cards"><span class="khModeIc">🗂️</span><b>'+esc(t('Flashcards'))+'</b><span class="hint">'+esc(t('Tap to flip, then say if you got it'))+'</span></button>'+
    '<button class="card khMode" data-khmode="quiz"><span class="khModeIc">❓</span><b>'+esc(t('Quiz'))+'</b><span class="hint">'+esc(t('Pick the right one of four'))+'</span></button>'+
    '<button class="card khMode" data-khmode="match"><span class="khModeIc">⚡</span><b>'+esc(t('Match'))+'</b><span class="hint">'+esc(t('Pair them up against the clock'))+'</span></button></div>';
  h+='<div class="card"><div class="khListHead"><b>'+esc(t('All the words'))+'</b><button class="linkbtn inline" id="khFront">'+esc(S.kh.front==='km' ? t('Khmer first') : t('English first'))+' ⇄</button></div>'+
    c.words.map(function(w){ var b=khBox_(c, w); return '<div class="khRow'+(b>=2?' known':'')+'"><span class="khEn">'+esc(w[0])+(w[2] ? ' <span class="khNote">'+esc(w[2])+'</span>' : '')+'</span><span class="khKm">'+esc(w[1])+'</span></div>'; }).join('')+'</div>';
  return h;
}
/* ---- the three ways to learn ---- */
function khStart_(mode, items){   // items: [{c, w}] — a list's words, or the daily mix
  var K=S.kh; K.mode=mode; K.items=khShuffle_(items); K.i=0; K.flipped=false; K.right=0; K.wrong=0; K.done=false; K.picked=null;
  if(mode==='quiz') K.items=K.items.slice(0, 12);
  if(mode==='match'){ var six=K.items.slice(0, 6); K.pairs=six; K.tiles=khShuffle_(six.map(function(x, i){ return { id:i, side:'en', text:x.w[0] }; }).concat(six.map(function(x, i){ return { id:i, side:'km', text:x.w[1] }; }))); K.sel=null; K.matched={}; K.start=Date.now(); K.wrongTile=null; }
  if(mode==='quiz') khQuizNext_();
  render(); window.scrollTo(0,0);
}
function khQuizNext_(){
  var K=S.kh, it=K.items[K.i]; if(!it) return;
  var ask = K.front==='km' ? 'km' : 'en', pool=khShuffle_(it.c.words.filter(function(w){ return w!==it.w && w[1]!==it.w[1]; })).slice(0, 3);
  if(pool.length<3){ var more=khShuffle_(GP_KHMER_VOCAB.cats.filter(function(c){ return c.level===it.c.level; }).reduce(function(a, c){ return a.concat(c.words); }, []).filter(function(w){ return w!==it.w && w[1]!==it.w[1] && pool.indexOf(w)===-1; })); pool=pool.concat(more.slice(0, 3-pool.length)); }
  K.q={ ask:ask, w:it.w, options:khShuffle_(pool.concat([it.w])) }; K.picked=null;
}
function khModeHtml_(){
  var K=S.kh, n=K.items.length, h='';
  if(K.done){
    var pct=khPct_(K.right, K.right+K.wrong);
    h+='<div class="card khSummary"><div class="khBig">'+(K.mode==='match' ? esc(gpT('{s} seconds',{s:K.secs})) : pct+'%')+'</div>';
    if(K.mode==='match') h+='<p class="sub" style="margin:0">'+esc(K.best && K.best<K.secs ? gpT('Your best is {s} seconds',{s:K.best}) : t('A new best time!'))+'</p>';
    else h+='<p class="sub" style="margin:0">'+esc(gpT('{right} right, {wrong} still learning',{right:K.right, wrong:K.wrong}))+'</p>';
    h+='<div class="btnRow" style="margin-top:12px"><button class="btn" id="khAgain">'+esc(t('Again'))+'</button><button class="btn ghost" id="khDone">'+esc(t('Done'))+'</button></div></div>';
    return h;
  }
  if(K.mode==='cards'){
    var it=K.items[K.i], side = K.flipped ? (K.front==='km' ? 'en' : 'km') : K.front;
    h+='<div class="khCount">'+(K.i+1)+' / '+n+'</div>'+khBar_(K.i, n);
    h+='<button class="khCard'+(K.flipped?' flipped':'')+'" id="khFlip" aria-label="'+esc(t('Flip'))+'">'+khWordHtml_(it.w, side)+'<span class="khFlipHint">'+esc(K.flipped ? t('Did you get it?') : t('Tap to flip'))+'</span></button>';
    h+='<div class="khAnswer'+(K.flipped?'':' hide')+'"><button class="btn ghost" id="khNo">✗ '+esc(t('Still learning'))+'</button><button class="btn" id="khYes">✓ '+esc(t('Got it'))+'</button></div>';
    h+='<p class="hint" style="text-align:center">'+esc(t(it.c.name))+'</p>';
  } else if(K.mode==='quiz'){
    var q=K.q; h+='<div class="khCount">'+(K.i+1)+' / '+n+'</div>'+khBar_(K.i, n);
    h+='<div class="card khAsk">'+khWordHtml_(q.w, q.ask)+'</div><div class="khOptions">'+q.options.map(function(w, i){
      var cls='khOpt'; if(K.picked!==null){ if(w===q.w) cls+=' right'; else if(i===K.picked) cls+=' wrong'; }
      return '<button class="'+cls+'" data-khopt="'+i+'"'+(K.picked!==null?' disabled':'')+'>'+khWordHtml_(w, q.ask==='km' ? 'en' : 'km')+'</button>'; }).join('')+'</div>';
  } else if(K.mode==='match'){
    var left=K.pairs.length-Object.keys(K.matched).length;
    h+='<div class="khCount">'+esc(gpT('{n} pairs left',{n:left}))+' · <span id="khClock">'+Math.round((Date.now()-K.start)/1000)+'</span>s</div>';
    h+='<div class="khGrid">'+K.tiles.map(function(tile, i){ var cls='khTile'+(K.matched[tile.id]?' gone':'')+(K.sel===i?' sel':'')+(K.wrongTile===i?' shake':'');
      return '<button class="'+cls+'" data-khtile="'+i+'"'+(K.matched[tile.id]?' disabled':'')+'><span class="'+(tile.side==='km'?'khKm':'khEn')+'">'+esc(tile.text)+'</span></button>'; }).join('')+'</div>';
  }
  return h;
}
function khFinish_(){
  var K=S.kh; K.done=true;
  if(K.mode==='match'){ K.secs=Math.round((Date.now()-K.start)/10)/100; var B={}; try { B=JSON.parse(lsGet('gp-kh-best')||'{}'); } catch(e){} var id=K.pairs[0].c.id; K.best=B[id]||0; if(!K.best || K.secs<K.best){ B[id]=K.secs; lsSet('gp-kh-best', JSON.stringify(B)); } }
  render(); window.scrollTo(0,0);
  if(K.mode==='match' || (K.right && !K.wrong)){ var el=document.querySelector('.khSummary'); if(el && typeof gpConfetti==='function') gpConfetti(el); }
}
function bindKhmer_(){
  if(S.view!=='khmer') return;
  var K=S.kh, on=function(id, fn){ var el=document.getElementById(id); if(el) el.onclick=fn; return el; };
  on('khBack', function(){ gpTap(); if(K.mode){ K.mode=null; } else if(K.cat){ K.cat=null; } else if(K.level){ K.level=null; } else { S.view='week'; } render(); window.scrollTo(0,0); });
  document.querySelectorAll('[data-khlevel]').forEach(function(b){ b.onclick=function(){ gpTap(); K.level=+b.getAttribute('data-khlevel'); render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-khcat]').forEach(function(b){ b.onclick=function(){ gpTap(); K.cat=b.getAttribute('data-khcat'); render(); window.scrollTo(0,0); }; });
  document.querySelectorAll('[data-khmode]').forEach(function(b){ b.onclick=function(){ gpTap(); var c=khCat_(K.cat); khStart_(b.getAttribute('data-khmode'), c.words.map(function(w){ return { c:c, w:w }; })); }; });
  on('khDaily', function(){ gpTap(); khStart_('cards', khDue_()); });
  on('khFront', function(){ gpTap(); K.front = K.front==='km' ? 'en' : 'km'; lsSet('gp-kh-front', K.front); render(); });
  on('khFlip', function(){ gpTap(); K.flipped=!K.flipped; render(); });
  var answer=function(right){ var it=K.items[K.i]; khMark_(it.c, it.w, right); if(right) K.right++; else K.wrong++; K.i++; K.flipped=false; if(K.i>=K.items.length){ khFinish_(); return; } if(K.mode==='quiz') khQuizNext_(); render(); window.scrollTo(0,0); };
  on('khYes', function(){ gpTap(); answer(true); }); on('khNo', function(){ gpTap(); answer(false); });
  document.querySelectorAll('[data-khopt]').forEach(function(b){ b.onclick=function(){ if(K.picked!==null) return; gpTap(); var i=+b.getAttribute('data-khopt'), right=K.q.options[i]===K.q.w; K.picked=i; render(); setTimeout(function(){ answer(right); }, right ? 500 : 1100); }; });
  document.querySelectorAll('[data-khtile]').forEach(function(b){ b.onclick=function(){
    var i=+b.getAttribute('data-khtile'), tile=K.tiles[i]; if(K.matched[tile.id]) return; gpTap();
    if(K.sel===null || K.sel===i){ K.sel = K.sel===i ? null : i; K.wrongTile=null; render(); return; }
    var other=K.tiles[K.sel];
    if(other.id===tile.id && other.side!==tile.side){ K.matched[tile.id]=1; K.sel=null; khMark_(K.pairs[tile.id].c, K.pairs[tile.id].w, true); if(Object.keys(K.matched).length===K.pairs.length){ khFinish_(); return; } }
    else { K.wrongTile=i; K.sel=null; khMark_(K.pairs[tile.id].c, K.pairs[tile.id].w, false); }
    render();
  }; });
  if(K.mode==='match' && !K.done){ if(S.khClock) clearInterval(S.khClock); S.khClock=setInterval(function(){ var el=document.getElementById('khClock'); if(!el || S.kh.mode!=='match' || S.kh.done){ clearInterval(S.khClock); S.khClock=null; return; } el.textContent=Math.round((Date.now()-S.kh.start)/1000); }, 500); }
  on('khAgain', function(){ gpTap(); var items=K.items.length && K.cat ? khCat_(K.cat).words.map(function(w){ return { c:khCat_(K.cat), w:w }; }) : khDue_(); khStart_(K.mode, items.length ? items : K.items); });
  on('khDone', function(){ gpTap(); K.mode=null; render(); window.scrollTo(0,0); });
}
try { S.kh.front = lsGet('gp-kh-front')==='km' ? 'km' : 'en'; } catch(e){}
