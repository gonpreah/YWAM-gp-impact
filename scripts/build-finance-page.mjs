/* The finance tool in Impact (Nov 2026): public/finance.html is docs/drafts/finance-redesign.html — the
   demo the Finances office designed it in — with window.GP_FIN_APP set, which makes the same code load
   from and save to the server (fin2Get / fin2Save in api.js), drop the sample numbers and the draft bar,
   and (inside My Ministry, ?embed=1) leave the tab row to the app. Built, never edited by hand, so the
   demo and Impact can't drift. How it works: docs/drafts/finance-how-it-works.md.

   node scripts/build-finance-page.mjs           writes public/finance.html
   node scripts/build-finance-page.mjs --check   fails if public/finance.html isn't what it would write
   Run it after changing the draft (tests/test-fin2-page.mjs runs the check). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANGES = [
  ['<head>\n', '<head>\n<!-- Built from docs/drafts/finance-redesign.html by scripts/build-finance-page.mjs — edit the draft and run it again, never this file. -->\n<script>window.GP_FIN_APP=true;</script>\n'],
  ['<title>Finances Redesign Draft</title>', '<title>Finances</title>\n<link rel="icon" type="image/png" sizes="180x180" href="icon-180.png">']
];
export function buildFinancePage(draft) {
  let out = draft;
  for (const [from, to] of CHANGES) {
    const n = out.split(from).length - 1;
    if (n !== 1) throw new Error('build-finance-page: expected one "' + from.trim() + '" in the draft, found ' + n);
    out = out.replace(from, to);
  }
  // the draft reaches the app's files (fonts, pdf.js) from docs/drafts/; the page sits beside them
  return out.split('../../public/').join('');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const want = buildFinancePage(fs.readFileSync(path.join(ROOT, 'docs/drafts/finance-redesign.html'), 'utf8'));
  const f = path.join(ROOT, 'public/finance.html');
  if (process.argv.indexOf('--check') > -1) {
    const have = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (have !== want) { console.log('public/finance.html is out of date — run: node scripts/build-finance-page.mjs'); process.exit(1); }
    console.log('public/finance.html is up to date');
  } else { fs.writeFileSync(f, want); console.log('wrote public/finance.html'); }
}
