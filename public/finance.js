/*  The Finances office's three monthly reports, read from their PDFs.

    Oct 2026 (Uriah): the accounting ministry already makes three reports
    every month, and the finance tool is built around exactly those:
      - the Profit and Loss (QuickBooks, cash basis, one month a column),
      - the Burn Rate (their own spreadsheet: the campus and new house's
        costs and contributions month by month, and the whole
        organisation's real income and spending), and
      - the A/R Ageing Summary — staff debt, by person and by how old.
    They upload the PDFs they already make; this file turns the text in them
    into numbers, and checks those numbers against the report's own totals
    so nobody saves a misread.

    The page hands it rows of text cells with their positions — from pdf.js
    (gpFinRowsFromPdf_) or from a spreadsheet paste (rowsFromTsv) — and gets
    back plain data. Nothing here stores or fetches anything. Plain script, no
    modules, no build step — the same contract as taxonomy.js and rollup.js;
    the tests load it with vm.

    How columns are found. In all three reports the numbers are right-aligned
    in their columns but the headings are not (the Burn Rate's month names sit
    at the left of theirs), so a number is never matched to a heading by
    position alone: the numbers' right edges are grouped into columns first,
    and the columns are then matched to the headings in order (or, when some
    columns are empty all the way down, to the heading that starts before the
    column ends).  */
var GP_FIN = (function(){
  var MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  /* "$1,234.56", "-$4,690.23", "(1,234.00)", "0" → a number; anything else → null. */
  function num(s){
    var x = String(s == null ? '' : s).trim().replace(/−/g, '-');
    if(!/^\(?-?\$?-?\s?[\d,]*\d(\.\d+)?\)?$/.test(x)) return null;
    var neg = /^\(.*\)$/.test(x) || /-/.test(x);
    var v = Number(x.replace(/[^\d.]/g, ''));
    if(!isFinite(v)) return null;
    return neg ? -v : v;
  }
  function r2(v){ return Math.round(v * 100) / 100; }
  function monthIdx(s){ var m = String(s || '').trim().toLowerCase().slice(0, 3); return MONTHS.indexOf(m); }
  function ym(y, i){ return y + '-' + ('0' + (i + 1)).slice(-2); }

  /* pdf.js text items → rows, top to bottom, each with its cells left to right.
     An item is { str, x, y, w } (x/y from its transform; y grows upwards). */
  function rowsFromItems(items){
    var rows = [];
    items.filter(function(it){ return String(it.str || '').trim(); })
      .sort(function(a, b){ return ((a.page || 1) - (b.page || 1)) || b.y - a.y || a.x - b.x; })
      .forEach(function(it){
        var r = null, pg = it.page || 1;
        for(var i = 0; i < rows.length; i++) if(rows[i].page === pg && Math.abs(rows[i].y - it.y) < 2.5){ r = rows[i]; break; }   // a line is on one page
        if(!r){ r = { y: it.y, page: pg, cells: [] }; rows.push(r); }
        r.cells.push({ s: String(it.str).trim(), x: it.x, w: it.w || 0 });
      });
    rows.sort(function(a, b){ return (a.page - b.page) || (b.y - a.y); });
    rows.forEach(function(r){ r.cells.sort(function(a, b){ return a.x - b.x; }); });
    return rows;
  }
  /* A spreadsheet paste (tab-separated) → the same rows: every column 100 wide,
     so a cell's column is exact and empty cells keep their place. */
  function rowsFromTsv(text){
    var out = [], y = 100000;
    String(text || '').replace(/\r/g, '').split('\n').forEach(function(line){
      y -= 10;
      if(!line.trim()) return;
      var cells = [];
      line.split('\t').forEach(function(c, i){ if(String(c).trim()) cells.push({ s: String(c).trim(), x: i * 100, w: 50 }); });
      if(cells.length) out.push({ y: y, page: 1, cells: cells });
    });
    return out;
  }
  function rowText(r){ return r.cells.map(function(c){ return c.s; }).join(' '); }
  /* A row split into its label (the text before the first number), its numbers
     (each with its right edge) and anything typed after them ("YEAR Total …"). */
  function split(r){
    var label = [], nums = [], after = [], seen = false;
    r.cells.forEach(function(c){
      var v = num(c.s);
      // pdf.js runs a long label into the number beside it ("Staff contribution$1,000.00"):
      // an amount with cents on the end of a label is its first number, right-aligned as ever
      var glued = v === null && !seen ? /^(.*?[^\d\s$(,.\-])\s*(\(?-?\$?-?[\d,]*\d\.\d\d\)?)$/.exec(c.s) : null;
      if(glued && num(glued[2]) !== null){ label.push(glued[1]); seen = true; nums.push({ v: num(glued[2]), right: c.x + c.w, left: c.x + c.w * 0.6 }); return; }
      if(v !== null && !(after.length)){ seen = true; nums.push({ v: v, right: c.x + c.w, left: c.x }); }
      else if(seen) after.push(c.s);
      else label.push(c.s);
    });
    return { label: label.join(' ').replace(/\s+/g, ' ').trim(), nums: nums, after: after.join(' ') };
  }
  /* Group right edges into columns: [{ right, left }] left to right. */
  function columnsOf(rows){
    var edges = [];
    rows.forEach(function(r){ split(r).nums.forEach(function(n){ edges.push(n); }); });
    edges.sort(function(a, b){ return a.right - b.right; });
    var cols = [];
    edges.forEach(function(e){
      var c = cols[cols.length - 1];
      if(c && e.right - c.right <= 6){ c.n++; c.left = Math.min(c.left, e.left); }
      else cols.push({ right: e.right, left: e.left, n: 1 });
    });
    return cols;
  }
  /* Which heading each column belongs to (an index into heads, or -1). */
  function matchCols(cols, heads){
    var hx = heads.map(function(h){ return h.x; });
    if(cols.length === heads.length) return cols.map(function(c, i){ return i; });
    return cols.map(function(c){
      var best = -1;
      for(var i = 0; i < hx.length; i++) if(hx[i] <= c.right) best = i;
      return best;
    });
  }
  function colOf(n, cols){
    var best = -1, d = 1e9;
    cols.forEach(function(c, i){ var dd = Math.abs(c.right - n.right); if(dd < d){ d = dd; best = i; } });
    return d <= 8 ? best : -1;
  }

  /* ---------- which report is this? ---------- */
  function detect(rows, fileName){
    var head = rows.slice(0, 12).map(rowText).join(' | ').toLowerCase();
    var all = rows.map(rowText).join(' | ').toLowerCase();
    if(/profit\s*(and|&)\s*loss|income statement/.test(head)) return 'pl';
    if(/a\/r ageing|a\/r aging|ageing summary|aging summary|accounts receivable/.test(head)) return 'debt';
    var monthRows = rows.filter(function(r){ return r.cells.filter(function(c){ return monthIdx(c.s) > -1 && c.s.length <= 9; }).length >= 6; }).length;
    if(monthRows >= 1 && /expense|income|contribution/.test(all)) return 'burn';
    var f = String(fileName || '').toLowerCase();
    if(/burn/.test(f)) return 'burn';
    if(/debt|ageing|aging/.test(f)) return 'debt';
    if(/p&l|pl[-_ ]|profit/.test(f)) return 'pl';
    return null;
  }

  /* ---------- Profit and Loss ----------
     → { months: ['2026-09'], lines: [{ sec, code, name, parent, amt: { '2026-09': n } }],
         reported: { inc, oth, exp, oexp, net } each { ym: n }, checks: [...] }
     sec: 'inc' income · 'oth' other income · 'exp' expenses · 'oexp' other expenses.
     A heading account with sub-accounts ("45000 Training") is a line too, with
     its own amount (often none); its sub-accounts carry it as `parent`, worked
     out from the "Total for …" line that closes it. */
  var PL_SECTIONS = [[/^income$/i, 'inc'], [/^other income/i, 'oth'], [/^(expenses|expense)$/i, 'exp'], [/^cost of (goods|sales)/i, 'exp'], [/^other expense/i, 'oexp']];
  function parsePL(rows){
    var out = { kind: 'pl', months: [], lines: [], reported: { inc: {}, oth: {}, exp: {}, oexp: {}, net: {} }, title: '', checks: [] };
    // the heading row: one cell per month, "Sep 2026" or "September 2026", and maybe "Total"
    // (the last such row above the first number — the title's "September 2026" is above it too)
    var hi = -1, heads = [];
    for(var i = 0; i < rows.length && !split(rows[i]).nums.length; i++){
      var hs = [];
      rows[i].cells.forEach(function(c){
        var m = /^([A-Za-z]{3,9})\.?\s+(\d{4})$/.exec(c.s);
        if(m && monthIdx(m[1]) > -1) hs.push({ x: c.x, ym: ym(Number(m[2]), monthIdx(m[1])) });
        else if(/^total$/i.test(c.s)) hs.push({ x: c.x, ym: 'total' });
      });
      if(hs.filter(function(h){ return h.ym !== 'total'; }).length) { hi = i; heads = hs; }
    }
    if(hi < 0){
      // one column, no month heading: the month is in the title ("September 2026")
      for(var j = 0; j < Math.min(rows.length, 8); j++){
        var m2 = /^([A-Za-z]{3,9})\s+(\d{4})$/.exec(rowText(rows[j]));
        if(m2 && monthIdx(m2[1]) > -1){ heads = [{ x: 0, ym: ym(Number(m2[2]), monthIdx(m2[1])) }]; hi = j; break; }
      }
    }
    if(hi < 0) return { ok: false, err: 'no_month' };
    out.title = rows.slice(0, hi).map(rowText).join(' · ');
    var body = rows.slice(hi + 1);
    var cols = columnsOf(body), map = matchCols(cols, heads);
    out.months = heads.filter(function(h){ return h.ym !== 'total'; }).map(function(h){ return h.ym; });
    var sec = null, open = [];
    var valsOf = function(nums){
      var v = {};
      nums.forEach(function(n){ var ci = colOf(n, cols), h = ci > -1 ? heads[map[ci]] : null; if(h && h.ym !== 'total') v[h.ym] = r2((v[h.ym] || 0) + n.v); });
      return v;
    };
    body.forEach(function(r){
      var p = split(r); if(!p.label) return;
      var L = p.label;
      for(var k = 0; k < PL_SECTIONS.length; k++) if(PL_SECTIONS[k][0].test(L) && !p.nums.length){ sec = PL_SECTIONS[k][1]; open = []; return; }
      var tot = /^total for (.+)$/i.exec(L) || /^total (.+)$/i.exec(L);
      if(tot){
        var what = tot[1].trim(), v = valsOf(p.nums);
        if(/^income$/i.test(what)) out.reported.inc = v;
        else if(/^other income/i.test(what)) out.reported.oth = v;
        else if(/^(expenses|expense)$/i.test(what)) out.reported.exp = v;
        else if(/^other expense/i.test(what)) out.reported.oexp = v;
        else if(/^cost of/i.test(what)) out.reported.cogs = v;
        else {
          // closes a heading account: everything since it opened is its sub-accounts
          for(var q = out.lines.length - 1; q >= 0; q--){
            var ln = out.lines[q];
            if(ln.label === what){ for(var z = q + 1; z < out.lines.length; z++) if(!out.lines[z].parent) out.lines[z].parent = ln.code || ln.name; break; }
          }
        }
        return;
      }
      if(/^net (earnings|income)$/i.test(L)){ out.reported.net = valsOf(p.nums); return; }
      if(/^(gross profit|net operating income|net other income)/i.test(L)) return;
      if(!sec) return;
      var mc = /^(\d{3,6})\s+(.+)$/.exec(L);
      if(!p.nums.length && !mc) return;        // a footer, a note — not an account
      out.lines.push({ sec: sec, code: mc ? mc[1] : '', name: mc ? mc[2] : L, label: L, parent: '', amt: valsOf(p.nums) });
    });
    out.lines.forEach(function(l){ delete l.label; });
    // the checks: our sums against the report's own totals
    out.months.forEach(function(m){
      var t = plTotals(out.lines, m);
      [['inc', 'Total for Income'], ['oth', 'Total for Other Income'], ['exp', 'Total for Expenses'], ['oexp', 'Total for Other Expenses']].forEach(function(x){
        var rep = out.reported[x[0]][m];
        if(rep === undefined && x[0] !== 'inc' && x[0] !== 'exp') return;
        out.checks.push({ month: m, what: x[1], ours: t[x[0]], theirs: rep === undefined ? null : rep, ok: rep !== undefined && Math.abs(rep - t[x[0]]) < 0.015 });
      });
      var rn = out.reported.net[m];
      if(rn !== undefined) out.checks.push({ month: m, what: 'Net Earnings', ours: t.net, theirs: rn, ok: Math.abs(rn - t.net) < 0.015 });
    });
    out.ok = out.lines.length > 0;
    if(!out.ok) out.err = 'no_lines';
    return out;
  }
  /* A month's totals from its lines (a heading account's own amount counts too). */
  function plTotals(lines, m){
    var t = { inc: 0, oth: 0, exp: 0, oexp: 0 };
    (lines || []).forEach(function(l){ var v = l.amt && typeof l.amt === 'object' ? l.amt[m] : l.amt; if(typeof v === 'number' && isFinite(v)) t[l.sec] = (t[l.sec] || 0) + v; });
    Object.keys(t).forEach(function(k){ t[k] = r2(t[k]); });
    t.income = r2(t.inc + t.oth); t.spend = r2(t.exp + t.oexp); t.net = r2(t.inc + t.oth - t.exp - t.oexp);
    return t;
  }
  /* The lines of one month rolled up to their top account, biggest first:
     [{ name, amt }] for one section group ('in' = inc+oth, 'out' = exp+oexp). */
  function plRollup(lines, m, side){
    var secs = side === 'in' ? ['inc', 'oth'] : ['exp', 'oexp'], by = {}, order = [];
    (lines || []).forEach(function(l){
      if(secs.indexOf(l.sec) < 0) return;
      var v = l.amt && typeof l.amt === 'object' ? l.amt[m] : l.amt; if(typeof v !== 'number') v = 0;
      var key = l.parent || l.code || l.name;
      if(!by[key]){ by[key] = { key: key, name: '', amt: 0 }; order.push(key); }
      if(!l.parent) by[key].name = l.name;
      by[key].amt = r2(by[key].amt + v);
    });
    return order.map(function(k){ var x = by[k]; if(!x.name) x.name = k; return x; })
      .filter(function(x){ return Math.abs(x.amt) >= 0.005; })
      .sort(function(a, b){ return b.amt - a.amt; });
  }

  /* ---------- Burn Rate ----------
     → { year, sections: [{ title, kind, rows: [{ label, kind, vals: [12 × n|null] }] }] }
     section kind: 'campusExp' · 'campusInc' · 'orgExp' · 'orgInc' (the whole
     organisation's real totals, which match the P&L's) · 'other'.
     row kind: 'item' · 'total' (the section's TOTAL) · 'diff' (DIFFERENCE) ·
     'ref' (another total kept for reference, like "TOTAL 44000"). */
  function sectionKind(title){
    var t = String(title || '').toLowerCase(), org = /whole|organi[sz]ation|real total/.test(t);
    if(/expense|cost|spend/.test(t)) return org ? 'orgExp' : 'campusExp';
    if(/income|contribution/.test(t)) return org ? 'orgInc' : 'campusInc';
    return 'other';
  }
  function rowKind(label){
    if(/^total$/i.test(label)) return 'total';
    if(/^difference/i.test(label)) return 'diff';
    if(/^total\b/i.test(label)) return 'ref';
    return 'item';
  }
  function parseBurn(rows, fileName, fallbackYear){
    var yr = /(20\d\d)/.exec(String(fileName || ''));
    if(!yr) for(var i = 0; i < Math.min(rows.length, 6) && !yr; i++) yr = /\b(20\d\d)\b/.exec(rowText(rows[i]));
    var out = { kind: 'burn', year: yr ? Number(yr[1]) : (fallbackYear || new Date().getFullYear()), yearFromFile: !!yr, sections: [], checks: [] };
    var cur = null;
    var isHead = function(r){ return r.cells.filter(function(c){ return monthIdx(c.s) > -1 && c.s.length <= 9; }).length >= 6; };
    // first pass: cut into sections at each month heading row
    var parts = [];
    rows.forEach(function(r, idx){
      if(isHead(r)){
        // the title is the nearest label-only row above it (that isn't another section's row)
        var t = '';
        for(var b = idx - 1; b >= 0 && b >= idx - 3; b--){ var pr = split(rows[b]); if(!pr.nums.length && pr.label && !isHead(rows[b])){ t = pr.label; break; } if(pr.nums.length) break; }
        cur = { title: t, head: r, rows: [] }; parts.push(cur); return;
      }
      if(cur) cur.rows.push(r);
    });
    parts.forEach(function(P){
      var heads = [];
      P.head.cells.forEach(function(c){ var mi = monthIdx(c.s); if(mi > -1 && c.s.length <= 9) heads.push({ x: c.x, i: mi }); });
      // a section's rows stop at the next section's title
      var body = [];
      for(var k = 0; k < P.rows.length; k++){
        var nx = P.rows[k + 1];
        var s0 = split(P.rows[k]);
        if(!s0.nums.length && nx && isHead(nx)) break;
        body.push(P.rows[k]);
      }
      var cols = columnsOf(body), map = matchCols(cols, heads);
      var sec = { title: P.title, kind: sectionKind(P.title), rows: [] };
      var label = '';
      body.forEach(function(r, ri){
        var p = split(r);
        if(!p.nums.length){ label = p.label; return; }        // a label on its own line, its numbers on the next
        var lab = p.label || label; label = '';
        if(!lab) return;
        var vals = []; for(var z = 0; z < 12; z++) vals.push(null);
        p.nums.forEach(function(n){ var ci = colOf(n, cols), h = ci > -1 && map[ci] > -1 ? heads[map[ci]] : null; if(h) vals[h.i] = n.v; });
        sec.rows.push({ label: lab, kind: rowKind(lab), vals: vals });
      });
      if(sec.rows.length) out.sections.push(sec);
    });
    // checks: each TOTAL against its items, each DIFFERENCE against income − expense
    out.sections.forEach(function(s){
      var tot = s.rows.filter(function(r){ return r.kind === 'total'; })[0], items = s.rows.filter(function(r){ return r.kind === 'item'; });
      if(tot && items.length){
        var bad = [];
        for(var m = 0; m < 12; m++){
          if(tot.vals[m] == null) continue;
          var sum = r2(items.reduce(function(a, r){ return a + (r.vals[m] || 0); }, 0));
          if(Math.abs(sum - tot.vals[m]) >= 0.015) bad.push(m);
        }
        out.checks.push({ what: s.title, ok: !bad.length, months: bad });
      }
    });
    out.ok = out.sections.length > 0;
    if(!out.ok) out.err = 'no_sections';
    return out;
  }
  /* The numbers a dashboard needs from a year's burn rate, month by month:
     { campusCost[12], campusIn[12], orgOut[12], orgIn[12], cats: [{ label, vals }], incCats: [...], actual[12] }
     A month is "actual" once the whole organisation's spending is in for it
     (the office fills those rows in at the month's close); the months after
     are the plan — rent and the like typed in ahead. */
  function burnSeries(b){
    var get = function(kind){ return (b && b.sections || []).filter(function(s){ return s.kind === kind; })[0] || null; };
    var tot = function(s){
      if(!s) return null;
      var t = s.rows.filter(function(r){ return r.kind === 'total'; })[0];
      if(t) return t.vals.slice();
      var items = s.rows.filter(function(r){ return r.kind === 'item'; }); if(!items.length) return null;
      var o = []; for(var m = 0; m < 12; m++){ var any = false, v = 0; items.forEach(function(r){ if(r.vals[m] != null){ any = true; v += r.vals[m]; } }); o.push(any ? r2(v) : null); }
      return o;
    };
    var ce = get('campusExp'), ci = get('campusInc'), oe = get('orgExp'), oi = get('orgInc');
    var out = { campusCost: tot(ce), campusIn: tot(ci), orgOut: tot(oe), orgIn: tot(oi),
      cats: ce ? ce.rows.filter(function(r){ return r.kind === 'item'; }) : [],
      incCats: ci ? ci.rows.filter(function(r){ return r.kind === 'item'; }) : [], actual: [] };
    for(var m = 0; m < 12; m++){
      var a;
      if(out.orgOut) a = out.orgOut[m] != null;
      else a = out.cats.length ? out.cats.every(function(r){ return r.vals[m] != null; }) : false;
      out.actual.push(!!a);
    }
    return out;
  }

  /* ---------- A/R Ageing (staff debt) ----------
     → { asOf: 'YYYY-MM-DD', cols: ['1 Month', …], rows: [{ name, vals: [n…], total }],
         reported: { vals, total }, checks } — cols leaves out the Total column. */
  function parseDate(s){
    var m = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(String(s || ''));
    if(m && monthIdx(m[1]) > -1) return m[3] + '-' + ('0' + (monthIdx(m[1]) + 1)).slice(-2) + '-' + ('0' + m[2]).slice(-2);
    m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); if(m) return m[0];
    m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '')); if(m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
    return '';
  }
  function parseDebt(rows){
    var out = { kind: 'debt', asOf: '', cols: [], rows: [], reported: null, checks: [] };
    var hi = -1, heads = [];
    rows.forEach(function(r, i){
      var t = rowText(r);
      if(!out.asOf && /^as of /i.test(t)) out.asOf = parseDate(t);
      if(hi > -1) return;
      var hs = r.cells.filter(function(c){ return /month|current|over|days|total|\d+\s*-\s*\d+|and over/i.test(c.s) && num(c.s) === null; });
      if(hs.length >= 3 && hs.length === r.cells.length){ hi = i; heads = r.cells.map(function(c){ return { x: c.x, label: c.s }; }); }
    });
    if(hi < 0) return { ok: false, err: 'no_columns' };
    var body = rows.slice(hi + 1).filter(function(r){ return split(r).nums.length; });
    var cols = columnsOf(body), map = matchCols(cols, heads);
    var totalIdx = -1; heads.forEach(function(h, i){ if(/^total$/i.test(h.label)) totalIdx = i; });
    out.cols = heads.filter(function(h, i){ return i !== totalIdx; }).map(function(h){ return h.label; });
    body.forEach(function(r){
      var p = split(r); if(!p.label) return;
      var vals = out.cols.map(function(){ return 0; }), total = null;
      p.nums.forEach(function(n){
        var ci = colOf(n, cols), hi2 = ci > -1 ? map[ci] : -1; if(hi2 < 0) return;
        if(hi2 === totalIdx) total = n.v;
        else { var vi = hi2 > totalIdx && totalIdx > -1 ? hi2 - 1 : hi2; vals[vi] = r2(vals[vi] + n.v); }
      });
      var sum = r2(vals.reduce(function(a, b){ return a + b; }, 0));
      if(total === null) total = sum;
      if(/^total$/i.test(p.label)){ out.reported = { vals: vals, total: total }; return; }
      out.rows.push({ name: p.label, vals: vals, total: r2(total), sumOk: Math.abs(sum - total) < 0.015 });
    });
    var ours = debtTotals(out.rows, out.cols.length);
    if(out.reported){
      out.checks.push({ what: 'TOTAL', ours: ours.total, theirs: out.reported.total, ok: Math.abs(ours.total - out.reported.total) < 0.015 });
      out.cols.forEach(function(c, i){ out.checks.push({ what: c, ours: ours.vals[i], theirs: out.reported.vals[i], ok: Math.abs(ours.vals[i] - out.reported.vals[i]) < 0.015 }); });
    }
    var badRows = out.rows.filter(function(r){ return !r.sumOk; });
    if(badRows.length) out.checks.push({ what: 'rows', ok: false, rows: badRows.map(function(r){ return r.name; }) });
    out.rows.forEach(function(r){ delete r.sumOk; });
    out.ok = out.rows.length > 0;
    if(!out.ok) out.err = 'no_rows';
    return out;
  }
  function debtTotals(rows, n){
    var vals = []; for(var i = 0; i < n; i++) vals.push(0);
    var total = 0;
    (rows || []).forEach(function(r){ (r.vals || []).forEach(function(v, i){ if(i < n) vals[i] = r2(vals[i] + (Number(v) || 0)); }); total = r2(total + (Number(r.total) || 0)); });
    return { vals: vals, total: total, people: (rows || []).filter(function(r){ return Math.abs(Number(r.total) || 0) >= 0.005; }).length };
  }

  /* ---------- a giving & support tracker (support raising) ----------
     Oct 2026 (Uriah): "my giving and support — can you automatically put this into my
     profile for support, and make the support tab include who we're supporting
     monthly". A staff member's own spreadsheet (a Google Sheets PDF export, or rows
     pasted from it) with two lists, each under its title:
       "Monthly Support Received" — Channel · Donor / Church · Monthly $ · Notes
       "Monthly Support Given"    — Channel · Recipient · Location · Monthly $
     → { received: [{ channel, name, amount, note }], given: [{ channel, name, location,
     amount, note }], reported: { received, given } (the sheet's TOTAL … / MONTH),
     checks }. A list may run on to the next page without its headings; it ends at its
     TOTAL line. The month-by-month trackers after them are left alone. Text columns
     are left-aligned, so a cell belongs to the heading that starts at or before it;
     an amount is whichever cell is a number. */
  function parseSupportTracker(rows){
    var out = { kind: 'support', received: [], given: [], reported: {}, checks: [] };
    var mode = null, heads = null;
    var headKey = function(t){ t = t.toLowerCase();
      if(/^channel/.test(t)) return 'channel'; if(/donor|church|recipient|name/.test(t)) return 'name';
      if(/location|place/.test(t)) return 'location'; if(/monthly|amount|\$/.test(t)) return 'amount'; if(/note/.test(t)) return 'note'; return null; };
    rows.forEach(function(r){
      var txt = rowText(r).trim(), p = split(r);
      if(!p.nums.length && /^monthly\s+support\s+received\b/i.test(txt)){ mode = 'received'; heads = null; return; }
      if(!p.nums.length && /^monthly\s+support\s+given\b/i.test(txt)){ mode = 'given'; heads = null; return; }
      if(!p.nums.length && /tracker/i.test(txt)){ mode = null; return; }
      if(!mode) return;
      var tot = /^total\b/i.test(txt) || r.cells.some(function(c){ return /^total\b/i.test(c.s); });
      if(tot){ if(p.nums.length) out.reported[mode] = p.nums[p.nums.length - 1].v; mode = null; return; }
      var keys = r.cells.map(function(c){ return headKey(c.s); });
      if(keys.indexOf('channel') > -1 && keys.indexOf('name') > -1 && !p.nums.length){
        heads = r.cells.map(function(c, i){ return { x: c.x, key: keys[i] }; }).filter(function(h){ return h.key; });
        return;
      }
      if(!heads) return;
      var row = { channel: '', name: '', location: '', amount: null, note: '' };
      r.cells.forEach(function(c){
        var v = num(c.s);
        if(v !== null){ if(row.amount === null) row.amount = v; return; }
        var best = null;
        heads.forEach(function(h){ if(h.x <= c.x + 6 && (!best || h.x > best.x)) best = h; });
        // words where the amount goes ("irregular / partnership") are a note about it
        var k = best ? (best.key === 'amount' ? 'note' : best.key) : 'name';
        row[k] = row[k] ? row[k] + ' ' + c.s : c.s;
      });
      row.name = row.name.trim();
      if(!row.name) return;
      if(mode === 'received') out.received.push({ channel: row.channel.trim(), name: row.name, amount: row.amount, note: row.note.trim() });
      else out.given.push({ channel: row.channel.trim(), name: row.name, location: row.location.trim(), amount: row.amount, note: row.note.trim() });
    });
    ['received', 'given'].forEach(function(k){
      var sum = r2(out[k].reduce(function(a, x){ return a + (x.amount || 0); }, 0));
      if(out.reported[k] !== undefined) out.checks.push({ what: k, ours: sum, theirs: out.reported[k], ok: Math.abs(sum - out.reported[k]) < 0.015 });
    });
    out.ok = out.received.length + out.given.length > 0;
    if(!out.ok) out.err = 'no_rows';
    return out;
  }

  /* One call for the page: whatever the report, parsed and labelled. */
  function parse(rows, fileName, fallbackYear){
    var kind = detect(rows, fileName);
    if(kind === 'pl') return parsePL(rows);
    if(kind === 'burn') return parseBurn(rows, fileName, fallbackYear);
    if(kind === 'debt') return parseDebt(rows);
    return { ok: false, err: 'unknown' };
  }

  return { num: num, monthIdx: monthIdx, rowsFromItems: rowsFromItems, rowsFromTsv: rowsFromTsv, detect: detect,
    parse: parse, parsePL: parsePL, parseBurn: parseBurn, parseDebt: parseDebt, parseDate: parseDate,
    plTotals: plTotals, plRollup: plRollup, burnSeries: burnSeries, debtTotals: debtTotals, parseSupportTracker: parseSupportTracker };
})();
if(typeof module !== 'undefined' && module.exports) module.exports = GP_FIN;
