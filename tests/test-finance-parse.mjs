/* finance.js: reading the Finances office's three reports (made-up ones laid out like
   the real PDFs — tests/fin-fixtures.mjs). Which report it is; the P&L's lines, the
   sub-accounts under their heading account, and its totals checking out; the Burn
   Rate's sections, a label on one line with its numbers on the next, the plan months
   left empty, "YEAR Total" kept out of December; the ageing report's people, buckets
   and date; a spreadsheet paste read the same way; and a misread caught by the checks. */
import vm from 'node:vm';
import fs from 'node:fs';
import { PUBLIC } from './env.mjs';
import { plReport, burnReport, debtReport, items, PL_TOTALS, BURN_ROWS, DEBT_PEOPLE, DEBT_TOTAL } from './fin-fixtures.mjs';

const ctx = { module: { exports: {} } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(PUBLIC + '/finance.js', 'utf8'), ctx);
const F = ctx.module.exports;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const near = (a, b) => Math.abs(a - b) < 0.006;

console.log('=== numbers ===');
ok('"$1,234.56", "-$4,690.23", "(12.00)", "0" read as numbers', F.num('$1,234.56') === 1234.56 && F.num('-$4,690.23') === -4690.23 && F.num('(12.00)') === -12 && F.num('0') === 0);
ok('"1/1", "Sep 2026", "Total" don’t', F.num('1/1') === null && F.num('Sep 2026') === null && F.num('Total') === null);

console.log('=== the Profit and Loss ===');
const pl = F.parse(F.rowsFromItems(items(plReport())), 'PL-Mar-2026.pdf');
ok('known as a P&L', pl.kind === 'pl' && pl.ok);
ok('its month, from the column heading (not the title)', pl.months.length === 1 && pl.months[0] === '2026-03', pl.months.join());
ok('every account line, and none of the totals or the footer', pl.lines.length === 11 && !pl.lines.some((l) => /total|gross|net|cash basis/i.test(l.name)), pl.lines.map((l) => l.name).join(' | '));
const lec = pl.lines.find((l) => l.code === '45100'), don = pl.lines.find((l) => l.code === '54000'), prog = pl.lines.find((l) => l.code === '53000');
ok('a sub-account sits under its heading account', lec.parent === '45000' && don.parent === '53000' && !prog.parent);
ok('a heading account keeps its own amount', prog.amt['2026-03'] === 50 && !Object.keys(pl.lines.find((l) => l.code === '45000').amt).length);
ok('the Total column isn’t added into the month', lec.amt['2026-03'] === 1500);
const tt = F.plTotals(pl.lines, '2026-03');
ok('came in, went out and net add up', near(tt.income, PL_TOTALS.income) && near(tt.spend, PL_TOTALS.spend) && near(tt.net, PL_TOTALS.net), JSON.stringify(tt));
ok('… and every total checks against the report’s own', pl.checks.length >= 4 && pl.checks.every((c) => c.ok), JSON.stringify(pl.checks.filter((c) => !c.ok)));
const outs = F.plRollup(pl.lines, '2026-03', 'out');
ok('where it went: a heading account with its sub-accounts as one, biggest first', outs[0].name === 'Rent /Lease' && outs.find((x) => x.name === 'Program Expenses').amt === 650 && outs.length === 4);

console.log('=== the Burn Rate ===');
const br = F.parse(F.rowsFromItems(items(burnReport())), 'Burn-Rate-2026-Mar.pdf');
ok('known as a burn rate, the year from the file name', br.kind === 'burn' && br.ok && br.year === 2026 && br.yearFromFile);
ok('its four tables, each the right kind', br.sections.map((s) => s.kind).join() === 'campusExp,campusInc,orgExp,orgInc', br.sections.map((s) => s.kind + ':' + s.title).join(' | '));
const ce = br.sections[0], ci = br.sections[1];
ok('the cost rows, all twelve months of rent and three of the rest', ce.rows[0].label === 'Rent' && ce.rows[0].vals.every((v) => v === BURN_ROWS.rent) && ce.rows[1].vals[2] === 1600 && ce.rows[1].vals[3] === null);
const t44 = ci.rows.find((r) => r.label === 'TOTAL 44000');
ok('a label on its own line takes the numbers on the next', t44 && t44.kind === 'ref' && t44.vals[0] === 3000 && t44.vals[2] === 2500);
ok('"Divided up" is a heading, not a row', !ci.rows.some((r) => /divided/i.test(r.label)));
const diff = ci.rows.find((r) => r.kind === 'diff');
ok('"YEAR Total" stays out of December', diff && diff.vals[11] !== 1 && diff.vals[11] === 600 - 2000);
ok('the TOTAL rows check against their rows', br.checks.length === 2 && br.checks.every((c) => c.ok), JSON.stringify(br.checks));
const bs = F.burnSeries(br);
ok('the months in are the ones the whole organisation’s spending is in for', bs.actual.filter(Boolean).length === 3 && bs.actual[2] && !bs.actual[3]);
ok('March: cost to run, contributions', near(bs.campusCost[2], BURN_ROWS.campusCostMar) && near(bs.campusIn[2], BURN_ROWS.campusInMar));
ok('the whole organisation, month by month', bs.orgOut[2] === 8951 && near(bs.orgIn[2], 8625.4));

console.log('=== the A/R Ageing (staff debt) ===');
const db = F.parse(F.rowsFromItems(items(debtReport())), 'Staff-Debt-March.pdf');
ok('known as the ageing report, with its date', db.kind === 'debt' && db.ok && db.asOf === '2026-04-02');
ok('its buckets, without the Total column', db.cols.join('|') === '1 Month|2 Month|3 Month|Over 3 Months');
ok('every name, and not the TOTAL row', db.rows.length === DEBT_PEOPLE.length && !db.rows.some((r) => /^total$/i.test(r.name)));
const sl = db.rows.find((r) => r.name === 'Sopheak Long'), rm = db.rows.find((r) => r.name === 'Rith Mao');
ok('each amount in its own bucket', sl.vals.join() === '16,16,16,40.5' && sl.total === 88.5 && db.rows.find((r) => r.name === 'Someone Gone').vals.join() === '0,0,0,30');
ok('a credit stays a credit', rm.vals[1] === -10 && rm.total === 97);
ok('the totals check against the report’s own', db.checks.length === 5 && db.checks.every((c) => c.ok) && near(F.debtTotals(db.rows, 4).total, DEBT_TOTAL));

console.log('=== a spreadsheet paste ===');
const tsv = ['Campus and New house related expenses', 'Expense\tJan\tFeb\tMar\tApr\tMay\tJun\tJul\tAug\tSep\tOct\tNov\tDec',
  'Rent\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00',
  'Kitchen\t$1,500.00\t\t$1,600.00', 'TOTAL\t$3,500.00\t$2,000.00\t$3,600.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00\t$2,000.00'].join('\n');
const pt = F.parse(F.rowsFromTsv(tsv), '', 2026);
ok('rows pasted from a spreadsheet read the same way', pt.kind === 'burn' && pt.ok && pt.year === 2026 && pt.sections[0].rows.length === 3);
ok('… an empty cell stays in its month', pt.sections[0].rows[1].vals[0] === 1500 && pt.sections[0].rows[1].vals[1] === null && pt.sections[0].rows[1].vals[2] === 1600);
ok('… and its TOTAL checks out', pt.checks[0].ok);

console.log('=== a label run into its number ===');
const glued = burnReport().map((it) => it.str === 'Staff contribution' ? { ...it, str: 'Staff contribution$1,000.00' } : it).filter((it) => !(it.str === '$1,000.00' && it.y === 372));
const gb = F.parse(F.rowsFromItems(items(glued)), 'Burn-Rate-2026.pdf');
const sc = gb.sections[1].rows.find((r) => /^Staff contribution/.test(r.label));
ok('pdf.js running a label into its first number is pulled apart', sc && sc.label === 'Staff contribution' && sc.vals[0] === 1000 && sc.vals[1] === 1100 && gb.checks.every((c) => c.ok), sc && sc.label + ' ' + JSON.stringify(sc.vals.slice(0, 3)));
ok('… but "TOTAL 44000" stays a label', gb.sections[1].rows.some((r) => r.label === 'TOTAL 44000'));

console.log('=== a misread is caught ===');
const broken = plReport().filter((it) => it.str !== '50500 Food');   // a line lost: its amounts float off with no label
const bp = F.parse(F.rowsFromItems(items(broken)), 'x.pdf');
ok('a P&L that doesn’t add up says so', bp.ok && bp.checks.some((c) => !c.ok && c.what === 'Total for Expenses'));
ok('something that isn’t one of the three is not guessed at', F.parse(F.rowsFromItems(items([{ str: 'Hello', x: 10, y: 10 }, { str: '12.00', x: 50, y: 10 }])), 'notes.pdf').err === 'unknown');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
