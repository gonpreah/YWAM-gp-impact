/* The OKR pages are gone — and what was stored is not.

   Until Nov 2026 this file drove the OKR editor (objectives, key results with a slider or a count,
   headings, Paste OKRs). Uriah: "the OKRs are too complicated … across the whole app we're going to
   move away from OKRs and move to rocks and scoreboard." The screens that replaced it are tested in
   tests/test-rocks-ui.mjs; this file holds the other half of that decision, from the source:
     - the page's code no longer has the OKR editor, its bindings or its words (dead code was
       deleted, not left unreachable), and no screen calls saveObjective / deleteObjective;
     - nothing a person reads says OKR, objective(s) or key result — except the folded "Earlier
       objectives" history, which is what those words are for;
     - the stored objectives, getData's `okrs` and the two handlers are still there, so nothing
       was lost and an old phone's page still gets an answer.
   No browser: it reads the files. */
import { REPO, PUBLIC } from './env.mjs';
import fs from 'node:fs';
import path from 'node:path';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); }
}
const dir = PUBLIC + '/teams';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
const src = {}; files.forEach(f => { src[f] = fs.readFileSync(path.join(dir, f), 'utf8'); });
const all = files.map(f => src[f]).join('\n');
const code = all.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');   // comments may keep the history

console.log('=== the editor is gone from the page’s code ===');
const gone = ['okrCardHtml', 'okrKrViewHtml_', 'okrFormHtml', 'okrKrRowHtml', 'okrParsePaste_', 'okrPasteHtml_', 'okrPasteSave_', 'okrSectionHtml', 'okrSave', 'okrDelete', 'okrSetManual', 'okrSetCount',
  'okrTabHtml_', 'leadershipOkrsHtml_', 'myOkrEntryHtml', 'leadOkrDashHtml_', 'leadNoteOkrHtml_', 'leadOkrs_', 'metricOkrNote_', 'pulseOkr_', 'okrMetricOptions', 'lmOkr_'];
const still = gone.filter(n => new RegExp('\\b' + n.replace(/[$]/g, '\\$') + '\\b').test(code));
ok('none of the OKR page’s functions is left, defined or called', still.length === 0, still.join(', '));
ok('no screen calls saveObjective or deleteObjective', !/['"](saveObjective|deleteObjective)['"]/.test(code));
ok('no OKR control is drawn or bound (sliders, − / +, Paste, the key-result rows)', !/data-okr-|okrPaste|okrKrList|krSlider|krStep|okrNewBtn|okrAdmNewBtn/.test(code));
ok('the card and the meeting rock no longer offer “Moves forward which OKR?”', !/Moves forward which OKR/.test(code) && !/data-l(f|mrf)="okrId"/.test(code));
ok('the Rocks tab keeps its old keys, so everything that pointed at it still lands there', /out\.push\(\['okr',t\('Rocks'\)\]\)/.test(code) && /okrs:t\('Rocks'\)/.test(code) && /cur==='okr'\) pane=rocksTabHtml_\(sel\)/.test(code));

console.log('=== nothing a person reads says OKR ===');
/* every string literal handed to t( / gpT( in the page's code, and the plain words in teams.html */
const lits = [];
code.replace(/\b(?:t|gpT)\(\s*((?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g, (m, inner) => { inner.replace(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g, (x, a, b) => { lits.push(a !== undefined ? a : b); return x; }); return m; });
const okrWords = lits.filter(s => /\bOKRs?\b|[Kk]ey results?\b/.test(s));
ok('no translated string says OKR or key result', lits.length > 2000 && okrWords.length === 0, okrWords.slice(0, 5).join(' | '));
const objWords = lits.filter(s => /\b[Oo]bjectives?\b/.test(s));
ok('“objectives” is said only of the earlier ones, kept as history', objWords.length > 0 && objWords.every(s => /^Earlier objectives/.test(s)), objWords.join(' | '));
const kpiWords = lits.filter(s => /\bKPIs?\b/.test(s));
ok('no translated string says KPI', kpiWords.length === 0, kpiWords.slice(0, 5).join(' | '));
const tabNames = lits.filter(s => /^(Numbers|The numbers|Scorecard)$/.test(s));
ok('no tab or page is called “Numbers” or “Scorecard” — it is the Scoreboard', tabNames.length === 0 && lits.includes('Scoreboard') && lits.includes('Rocks'), tabNames.join(' | '));
const html = fs.readFileSync(PUBLIC + '/teams.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
ok('teams.html’s own words neither', !/\bOKR|\bKPI|[Kk]ey result/.test(html));
const help = fs.readFileSync(PUBLIC + '/help.html', 'utf8');
ok('the guide is the Scoreboard guide in its title and heading', /<title>[^<]*Scoreboard Guide<\/title>/.test(help) && /Ministry Scoreboard Guide/.test(help) && !/KPI Guide|your KPIs/.test(help));

console.log('=== what was stored is still there ===');
const api = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
ok('the two handlers still answer (an old page, a script)', /saveObjective: function/.test(api) && /deleteObjective: function/.test(api));
ok('getData still sends the objectives, for the “Earlier objectives” list', /okrs: okrs,/.test(api) && /rkEarlierHtml_/.test(code) && /S\.base\.okrs/.test(src['28-rocks.js']));
ok('the move reads the objectives and never writes them', !/writeJSON\('okrs'[^\n]*\n[^\n]*rocksSeed_/.test(api) && /function rocksSeed_/.test(api) && !/rocksSeed_[\s\S]{0,3000}writeJSON\('okrs'/.test(api.slice(api.indexOf('function rocksSeed_'), api.indexOf('async function rocksCtx_'))));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
