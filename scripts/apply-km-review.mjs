/* Builds what the Khmer reviewers checked into the app for good.

   Khmer review (☰ → Khmer review) keeps each reviewer's answer on the server; a fix
   shows at once for everyone, but only REVIEWED_KM in public/km.js is permanent and
   counts as checked. An admin downloads the checked phrases there ("Download the
   checked phrases" → khmer-review-<date>.json), and this moves them:
     ok  → the draft from PENDING_KM, unchanged, into REVIEWED_KM
     fix → the reviewer's Khmer into REVIEWED_KM
   and takes them out of PENDING_KM. Only strings a person has read go into
   REVIEWED_KM — this file is the one way they get there in bulk.

     node scripts/apply-km-review.mjs path/to/khmer-review-2026-10-20.json
*/
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KM = path.join(REPO, 'public/km.js');
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/apply-km-review.mjs khmer-review.json'); process.exit(1); }
const review = JSON.parse(fs.readFileSync(file, 'utf8'));
const src = fs.readFileSync(KM, 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src + ';this.P=PENDING_KM;this.R=REVIEWED_KM;', ctx);
const P = ctx.P, R = ctx.R;
const slots = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join('|');
let ok = 0, fix = 0, skipped = [];
for (const [k, v] of Object.entries(review.ok || {})) {
  if (!(k in P)) { skipped.push(k + ' (not a draft any more)'); continue; }
  R[k] = P[k]; delete P[k]; ok++;
}
for (const [k, v] of Object.entries(review.fix || {})) {
  if (typeof v !== 'string' || !/[ក-៿]/.test(v)) { skipped.push(k + ' (fix is not Khmer)'); continue; }
  if (slots(v) !== slots(k)) { skipped.push(k + ' (fix changes the {placeholders})'); continue; }
  R[k] = v; delete P[k]; fix++;
}
const lines = src.split('\n');
const pi = lines.findIndex((l) => l.startsWith('var PENDING_KM = {'));
const ri = lines.findIndex((l) => l.startsWith('var REVIEWED_KM = {'));
if (pi < 0 || ri < 0) { console.error('km.js layout changed: PENDING_KM / REVIEWED_KM lines not found'); process.exit(1); }
lines[pi] = 'var PENDING_KM = ' + JSON.stringify(P) + ';';
lines[ri] = 'var REVIEWED_KM = ' + JSON.stringify(R) + ';';
fs.writeFileSync(KM, lines.join('\n'));
console.log(ok + ' read right and ' + fix + ' fixed → REVIEWED_KM. ' + Object.keys(P).length + ' drafts left, ' + Object.keys(R).length + ' checked.');
if (skipped.length) console.log('Skipped:\n  ' + skipped.join('\n  '));
