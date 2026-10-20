/* A stand-in for Intuit, for tests/test-qbo.mjs and tests/test-qbo-ui.mjs: its token
   endpoint, its revoke endpoint and the QuickBooks Online API for one made-up company,
   answering the way the real ones are documented to. fakeIntuit() replaces global fetch
   for intuit.com and hands back the state the tests steer and read (calls made, tokens
   handed out, revoked tokens; refreshBad, fail401 and plMismatch to make it misbehave).
   Every other URL goes to the real fetch. All names and figures are made up. */
/* ---- the months the sync asks for: the twelve finished ones (Phnom Penh time) ---- */
export const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
export const back = (n) => { let y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - n; while (m < 1) { m += 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
export const LAST = back(1), PREV = back(2);

/* ---- a stand-in Intuit ---- */
export const I = { reportDown: '', calls: [], code: 'auth-code-1', n: 0, refreshBad: false, fail401: 0, plMismatch: false, revoked: [] };
const tok = () => { I.n++; return { access_token: 'AT-secret-' + I.n, refresh_token: 'RT-secret-' + I.n, expires_in: 3600, x_refresh_token_expires_in: 8640000, token_type: 'bearer' }; };
const col = (ym) => { const [y, m] = ym.split('-').map(Number); const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { ColTitle: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + y, ColType: 'Money', MetaData: [{ Name: 'StartDate', Value: ym + '-01' }, { Name: 'EndDate', Value: end }] }; };
function plReport(q) {
  const months = []; let ym = q.get('start_date').slice(0, 7); const end = q.get('end_date').slice(0, 7);
  while (ym <= end) { months.push(ym); let [y, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } ym = y + '-' + String(m).padStart(2, '0'); }
  const narrow = q.get('department') === '7';     // the Poipet Location: half of everything
  const v = (byMonth) => months.map((k) => byMonth[k] == null ? '' : (narrow ? byMonth[k] / 2 : byMonth[k]).toFixed(2));
  const row = (label, byMonth, id) => ({ ColData: [{ value: label, id: id || '1' }, ...v(byMonth).map((x) => ({ value: x })), { value: '' }], type: 'Data' });
  const sum = (label, byMonth) => ({ ColData: [{ value: label }, ...v(byMonth).map((x) => ({ value: x })), { value: '' }] });
  const A = (a, b) => ({ [PREV]: a, [LAST]: b });
  const incTot = A(1000 + 400 + 100, 1200 + 500 + 0);
  return {
    Header: { ReportName: 'ProfitAndLoss', ReportBasis: q.get('accounting_method') },
    Columns: { Column: [{ ColTitle: '', ColType: 'Account' }, ...months.map(col), { ColTitle: 'Total', ColType: 'Money' }] },
    Rows: { Row: [
      { Header: { ColData: [{ value: 'Income' }] }, type: 'Section', group: 'Income', Rows: { Row: [
        row('41000 Donation (Income)', A(1000, 1200)),
        { Header: { ColData: [{ value: '45000 Training' }, ...months.map(() => ({ value: '' }))] }, type: 'Section', Rows: { Row: [
          row('45100 Lecture Contribution', A(400, 500)),
          row('45000 Training', A(100, null))
        ] }, Summary: { ColData: [{ value: 'Total 45000 Training' }] } }
      ] }, Summary: sum('Total Income', I.plMismatch ? A(9999, 1700) : incTot) },
      { Header: { ColData: [{ value: 'Cost of Goods Sold' }] }, type: 'Section', group: 'COGS', Rows: { Row: [row('51000 Cafe stock', A(50, 60))] }, Summary: sum('Total Cost of Goods Sold', A(50, 60)) },
      { Summary: sum('Gross Profit', A(1450, 1640)), type: 'Section', group: 'GrossProfit' },
      { Header: { ColData: [{ value: 'Expenses' }] }, type: 'Section', group: 'Expenses', Rows: { Row: [
        row('50300 Rent /Lease', A(1200, 1200)),
        { Header: { ColData: [{ value: '53000 Program Expenses' }] }, type: 'Section', Rows: { Row: [row('54000 Donations given', A(300, 250))] }, Summary: sum('Total 53000 Program Expenses', A(300, 250)) }
      ] }, Summary: sum('Total Expenses', A(1500, 1450)) },
      { Header: { ColData: [{ value: 'Other Income' }] }, type: 'Section', group: 'OtherIncome', Rows: { Row: [row('49000 Interest income', A(2.5, 3))] }, Summary: sum('Total Other Income', A(2.5, 3)) },
      { Summary: sum('Net Income', A(-47.5, 193)), type: 'Section', group: 'NetIncome' }
    ] }
  };
}
/* Any other standard report, shaped as QuickBooks does: a heading, rows, a total — and what it
   was asked for, so a test can see the choices reached QuickBooks. */
export function otherReport(name, q) {
  const asked = [...q.entries()].filter(([k]) => k !== 'minorversion').map(([k, v]) => k + '=' + v).join('&');
  const big = q.get('department') === '7' ? 50 : 100;
  return {
    Header: { ReportName: name, StartPeriod: q.get('start_date') || '', EndPeriod: q.get('end_date') || q.get('report_date') || '', ReportBasis: q.get('accounting_method') || '', Option: [{ Name: 'asked', Value: asked }] },
    Columns: { Column: [{ ColTitle: '', ColType: 'Account' }, { ColTitle: 'Total', ColType: 'Money' }] },
    Rows: { Row: [
      { Header: { ColData: [{ value: 'Assets' }, { value: '' }] }, type: 'Section', Rows: { Row: [
        { ColData: [{ value: '10100 Bank (made up)' }, { value: (big * 12).toFixed(2) }], type: 'Data' },
        { ColData: [{ value: asked }, { value: '' }], type: 'Data' }
      ] }, Summary: { ColData: [{ value: 'Total Assets' }, { value: (big * 12).toFixed(2) }] } }
    ] }
  };
}
function arReport() {
  const r = (name, vals) => ({ ColData: [{ value: name, id: '9' }, ...vals.map((x) => ({ value: x === '' ? '' : x.toFixed(2) })), { value: vals.reduce((a, b) => a + (b || 0), 0).toFixed(2) }] });
  return {
    Header: { ReportName: 'AgedReceivables' },
    Columns: { Column: ['', 'Current', '1 - 30', '31 - 60', '61 - 90', '91 and over', 'Total'].map((t, i) => ({ ColTitle: t, ColType: i ? 'Money' : 'Customer' })) },
    Rows: { Row: [
      r('Dara Sok', [10, 20, '', '', '']),
      { Header: { ColData: [{ value: 'Vanna Chan' }] }, Rows: { Row: [r('Vanna Chan', [0, 0, 50, 0, 50])] }, Summary: { ColData: [{ value: 'Total Vanna Chan' }] }, type: 'Section' },
      r('Someone Gone', [0, 0, 0, 0, 30]),
      r('Paid Up', [0, 0, 0, 0, 0]),
      { Summary: { ColData: [{ value: 'TOTAL' }, { value: '10.00' }, { value: '20.00' }, { value: '50.00' }, { value: '0.00' }, { value: '80.00' }, { value: '160.00' }] }, type: 'Section', group: 'GrandTotal' }
    ] }
  };
}
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
export function fakeIntuit() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (!/intuit\.com$/.test(new URL(url).host)) return realFetch(url, opts);
    const u = new URL(url), o = opts || {};
    I.calls.push({ url: u, opts: o });
    if (u.href === 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer') {
      const p = new URLSearchParams(o.body);
      if (o.headers.Authorization !== 'Basic ' + Buffer.from('cid-test:csecret-test').toString('base64')) return res(401, { error: 'invalid_client' });
      if (p.get('grant_type') === 'authorization_code') return p.get('code') === I.code && p.get('redirect_uri') === 'https://example-gp.netlify.app/.netlify/functions/quickbooks' ? res(200, tok()) : res(400, { error: 'invalid_grant' });
      if (p.get('grant_type') === 'refresh_token') return I.refreshBad ? res(400, { error: 'invalid_grant' }) : res(200, tok());
      return res(400, { error: 'unsupported_grant_type' });
    }
    if (u.href === 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke') { I.revoked.push(JSON.parse(o.body).token); return res(200, {}); }
    const m = /^\/v3\/company\/(\d+)\/(.+)$/.exec(u.pathname);
    if (u.host !== 'quickbooks.api.intuit.com' || !m || m[1] !== '4620816365' || u.searchParams.get('minorversion') !== '75') return res(404, {});
    if (o.headers.Authorization !== 'Bearer AT-secret-' + I.n) return res(401, {});
    if (I.fail401 > 0) { I.fail401--; return res(401, {}); }
    if (m[2] === 'companyinfo/4620816365') return res(200, { CompanyInfo: { CompanyName: 'Made-up Mission Org' } });
    if (m[2] === 'reports/ProfitAndLoss') return res(200, plReport(u.searchParams));
    if (m[2] === 'reports/AgedReceivables') return res(200, arReport());
    if (I.reportDown && m[2] === 'reports/' + I.reportDown) return res(500, {});
    if (/^reports\/(BalanceSheet|CashFlow|TrialBalance|VendorExpenses|CustomerIncome|AgedPayables)$/.test(m[2])) return res(200, otherReport(m[2].slice(8), u.searchParams));
    if (m[2] === 'query') {
      const q = u.searchParams.get('query');
      if (/from Department/i.test(q)) return res(200, { QueryResponse: { Department: [{ Id: '7', Name: 'Poipet', FullyQualifiedName: 'Poipet' }, { Id: '8', Name: 'Siem Reap', FullyQualifiedName: 'Siem Reap' }] } });
      if (/from Class/i.test(q)) return res(200, { QueryResponse: {} });
    }
    return res(404, {});
  };
  return I;
}
