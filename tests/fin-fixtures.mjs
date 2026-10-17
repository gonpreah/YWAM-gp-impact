/* Made-up versions of the Finances office's three monthly reports, laid out the way
   the real PDFs are (QuickBooks' Profit and Loss and A/R Ageing Summary, and the
   office's Burn Rate spreadsheet): the same headings, numbers right-aligned in their
   columns, the Burn Rate's month names sitting left of their numbers. Every name and
   figure here is invented — the real reports have staff names and the base's money,
   and this repository is public.

   Each report is a list of text items { str, x, y } (PDF points, y up from the bottom)
   and makePdf() writes them as a real one-page PDF in Helvetica, so the browser test
   reads it with pdf.js exactly as the office's PDFs are read. items() gives the same
   items with their widths, for the parser test, without pdf.js. */

/* Helvetica's widths (per 1000 em) for what a number is made of; letters are near enough. */
const W = { '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556, '9': 556,
  ',': 278, '.': 278, '$': 556, '-': 333, ' ': 278, '(': 333, ')': 333, '/': 278, '&': 667 };
export function textWidth(s, size) { let w = 0; for (const ch of String(s)) w += (W[ch] || (ch === ch.toUpperCase() ? 667 : 520)); return w * size / 1000; }
const money = (v, dollar) => (v < 0 ? '-' : '') + (dollar ? '$' : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* text at x (left) or ending at right */
const L = (str, x, y, size = 8) => ({ str, x, y, size });
const R = (str, right, y, size = 8) => ({ str, x: right - textWidth(str, size), y, size });

export function plReport() {
  const out = [L('Made-up Mission', 250, 795, 10), L('Profit and Loss', 260, 782, 10), L('March 2026', 262, 770, 9),
    L('Mar 2026', 425, 716), L('Total', 549, 716), L('Income', 26, 702)];
  let y = 688;
  const line = (label, x, v, dollarTotal) => { out.push(L(label, x, y)); if (v !== null) { out.push(R(money(v), 460, y)); out.push(R(money(v, dollarTotal), 568, y)); } y -= 14; };
  line('41000 Donation (Income)', 32, 900.00);
  line('44000 Contribution', 32, 6200.40);
  line('45000 Training', 32, null);
  line('45100 Lecture Contribution', 35, 1500.00);
  line('Total for 45000 Training', 32, 1500.00, true);
  line('Sales', 32, 25.00);
  line('Total for Income', 26, 8625.40, true);
  line('Gross Profit', 26, 8625.40, true);
  out.push(L('Other Income(Loss)', 26, y)); y -= 14;
  line('49000 Interest income', 32, 4.10);
  line('Total for Other Income(Loss)', 26, 4.10, true);
  out.push(L('Expenses', 26, y)); y -= 14;
  line('50300 Rent /Lease', 32, 4000.00);
  line('50500 Food', 32, 3100.25);
  line('53000 Program Expenses', 32, 50.00);
  line('54000 Donation expenses', 35, 600.00);
  line('Total for 53000 Program Expenses', 32, 650.00, true);
  line('57500 Travel & Transportation', 32, 1200.75);
  line('Total for Expenses', 26, 8951.00, true);
  line('Net Earnings', 26, -321.50, true);
  out.push(L('Cash Basis Monday, April 06, 2026 10:00 AM GMT+07:00', 181, 21, 7), L('1/1', 556, 21, 7));
  return out;
}
/* the totals the made-up P&L adds up to (for the tests) */
export const PL_TOTALS = { income: 8629.50, spend: 8951.00, net: -321.50 };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function burnReport() {
  const out = [];
  const heads = (label, y, x0) => { out.push(L(label, 54, y)); MONTHS.forEach((m, i) => out.push(L(m, x0 + 45.3 * i, y))); };
  const right = (i) => 149 + 45.3 * i;
  const row = (label, y, vals) => { if (label) out.push(L(label, 54, y)); vals.forEach((v, i) => { if (v !== null) out.push(R(money(v, true), right(i), y)); }); };
  const n = (a, from) => MONTHS.map((_, i) => (i < (from || 3) ? a[i] : null));
  out.push(L('Campus and New house related expenses', 300, 551, 9));
  heads('Expense', 540, 111);
  const rent = MONTHS.map(() => 2000), food = n([1500, 1700, 1600]), power = n([800, 950.5, 875.25]);
  row('Rent', 526, rent); row('Kitchen', 512, food); row('Utilities', 498, power);
  row('TOTAL', 470, MONTHS.map((_, i) => rent[i] + (food[i] || 0) + (power[i] || 0)));
  out.push(L('Campus and New house related Income', 300, 440, 9));
  heads('Contributions', 428, 123);
  out.push(L('TOTAL 44000', 54, 416)); row('', 412, n([3000, 2800, 2500]));
  out.push(L('Divided up', 54, 400));
  const teams = n([2500, 2200, 2000]), staff = n([1000, 1100, 900]), students = MONTHS.map((_, i) => (i < 3 || i > 8 ? 600 : 0));
  row('Teams', 386, teams); row('Staff contribution', 372, staff); row('Students', 358, students);
  const inc = MONTHS.map((_, i) => (teams[i] || 0) + (staff[i] || 0) + students[i]);
  const cost = MONTHS.map((_, i) => rent[i] + (food[i] || 0) + (power[i] || 0));
  row('TOTAL', 330, inc);
  row('DIFFERENCE', 308, MONTHS.map((_, i) => Math.round((inc[i] - cost[i]) * 100) / 100));
  out.push(L('YEAR Total', 653, 308), L('$1.00', 711, 308));
  out.push(L('REAL TOTAL EXPENSE WHOLE ORGANISATION', 300, 280, 9));
  heads('Column 1', 268, 123);
  row('TOTAL', 254, n([9000, 9500.5, 8951]));
  out.push(L('REAL TOTAL INCOME WHOLE ORGANISATION', 300, 230, 9));
  heads('Column 1', 218, 123);
  row('TOTAL', 204, n([10000, 9000, 8625.4]));
  return out;
}
export const BURN_ROWS = { rent: 2000, campusCostMar: 2000 + 1600 + 875.25, campusInMar: 2000 + 900 + 600 };

export const DEBT_PEOPLE = [
  ['Dara Sok', [20, 10, 0, 0]],
  ['Vanna & Srey Pich', [50, 50, 25, 0]],
  ['Sopheak Long', [16, 16, 16, 40.5]],
  ['Someone Gone', [0, 0, 0, 30]],
  ['Rith Mao', [107, -10, 0, 0]]
];
export function debtReport() {
  const out = [L('Made-up Mission', 231, 726, 10), L('A/R Ageing Summary Report', 190, 711, 10), L('As of Apr 2, 2026', 230, 696, 9),
    L('1 Month', 186, 657), L('2 Month', 236, 657), L('3 Month', 287, 657), L('Over 3 Months', 332, 657), L('Total', 435, 657)];
  const rights = [230, 281, 332, 400, 497];
  let y = 642;
  const tot = [0, 0, 0, 0];
  DEBT_PEOPLE.forEach(([name, v]) => {
    out.push(L(name, 52, y));
    v.forEach((x, i) => { if (x) { out.push(R(money(x), rights[i], y)); tot[i] += x; } });
    out.push(R(money(v.reduce((a, b) => a + b, 0)), rights[4], y));
    y -= 15;
  });
  out.push(L('TOTAL', 53, y));
  tot.forEach((x, i) => out.push(R(money(x), rights[i], y)));
  out.push(R(money(tot.reduce((a, b) => a + b, 0)), rights[4], y));
  out.push(L('Thursday, April 02, 2026 02:25 PM GMT+07:00', 193, 341, 7));
  return out;
}
export const DEBT_TOTAL = DEBT_PEOPLE.reduce((a, [, v]) => a + v.reduce((x, y) => x + y, 0), 0);

/* A made-up giving & support tracker, laid out like a staff member's Google Sheets
   export: a snapshot page, "Monthly Support Received" (Channel · Donor / Church ·
   Monthly $ · Notes, with a note sitting where an amount would be), "Monthly Support
   Given" (Channel · Recipient · Location · Monthly $) running on to the next page
   without its headings, and a month-by-month tracker after them to be left alone. */
export const SUP_IN = [
  ['Hope Church', 'Grace Fellowship', 300, ''], ['Hope Church', 'Ann and Tom Field', 50, ''], ['Hope Church', 'The Barretts', null, 'irregular / partnership'],
  ['Northside', 'Northside Church', 400, ''], ['Northside', 'Kim Lowe', 25, ''], ['Other', 'Pat Rivers', null, 'BOH'], ['Other', 'Mesa Chapel', 150, '']
];
export const SUP_OUT = [
  ['via GP', 'dara', 'Poipet', 100], ['via GP', 'sophea', 'Siem Reap', 50], ['via GP', 'vanna', 'Poipet', 25],
  ['via Bank', 'Rith family', '', 75], ['via Bank', 'Hill school', '', 50], ['Other', 'Sam', '', 25]
];
export function supportTracker() {
  const out = [];
  const P = (page, it) => { it.page = page; out.push(it); return it; };
  P(1, L('Made-up Family', 68, 740, 14)); P(1, L('Giving & Support Tracker', 68, 722, 12));
  P(1, L('Support received / month', 68, 680, 9)); P(1, R('$925', 300, 680, 9));
  P(1, L('Received Tracker', 68, 640, 9)); P(1, L('Enter what actually came in each month.', 200, 640, 9));
  P(2, L('Monthly Support Received', 68, 723, 14)); P(2, L('Churches and individuals who give, grouped by giving channel.', 68, 707, 9));
  P(2, L('Channel', 68, 679)); P(2, L('Donor / Church', 163, 679)); P(2, L('Monthly $', 347, 679)); P(2, L('Notes', 467, 679));
  let y = 664;
  SUP_IN.forEach(([c, n, a, note]) => { P(2, L(c, 68, y)); P(2, L(n, 163, y)); if (a !== null) P(2, R('$' + a.toLocaleString('en-US'), 410, y)); if (note) P(2, L(note, 388, y)); y -= 15; });
  P(2, L('TOTAL RECEIVED / MONTH', 220, y)); P(2, R('$925', 410, y));
  P(3, L('Monthly Support Given', 68, 723, 14)); P(3, L('People supported each month.', 68, 707, 9));
  P(3, L('Channel', 68, 679)); P(3, L('Recipient', 152, 679)); P(3, L('Location', 278, 679)); P(3, L('Monthly $', 379, 679));
  y = 664;
  SUP_OUT.forEach(([c, n, loc, a], i) => {
    const pg = i < 4 ? 3 : 4; if (i === 4) y = 727;
    P(pg, L(c, 68, y)); P(pg, L(n, 152, y)); if (loc) P(pg, L(loc, 278, y)); P(pg, R('$' + a, 441, y)); y -= 15;
  });
  P(4, L('TOTAL GIVEN / MONTH', 165, y)); P(4, R('$325', 441, y));
  P(4, L('BY CHANNEL', 200, y - 30)); P(4, L('via GP', 200, y - 45)); P(4, R('$175', 441, y - 45));
  P(5, L('Received Tracker — money in', 52, 730, 12));
  P(5, L('Channel', 52, 706)); P(5, L('Donor / Church', 87, 706)); P(5, L('Expected/mo', 155, 706)); P(5, L('Jan', 194, 706));
  P(5, L('Hope Church', 52, 697)); P(5, L('Grace Fellowship', 87, 697)); P(5, R('$300', 185, 697)); P(5, R('$3,600', 528, 697));
  return out;
}

/* the items as pdf.js gives them, for the parser test */
export function items(list) { return list.map((it) => ({ str: it.str, x: it.x, y: it.y, w: textWidth(it.str, it.size || 8), page: it.page || 1 })); }

/* a PDF with every item placed where it says (on its `page`, 1 if none), in Helvetica */
export function makePdf(list) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const pages = Math.max(1, ...list.map((it) => it.page || 1));
  const content = (n) => list.filter((it) => (it.page || 1) === n).map((it) => `BT /F1 ${it.size || 8} Tf 1 0 0 1 ${it.x.toFixed(2)} ${it.y.toFixed(2)} Tm (${esc(it.str)}) Tj ET`).join('\n');
  // 1 catalog, 2 pages, 3 font, then a page and its content for each page
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  for (let n = 1; n <= pages; n++) {
    const c = content(n);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + (n - 1) * 2} 0 R >>`);
    objs.push(`<< /Length ${Buffer.byteLength(c, 'latin1')} >>\nstream\n${c}\nendstream`);
  }
  let pdf = '%PDF-1.4\n', offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
