/* Builds public/km-notes.js — for Khmer review (☰ → Khmer review), where in the app
   each draft string is used: the heading of the docs/khmer-needed.md section whose
   table lists it. Keys are a short hash of the English (the same djb2 as kmrWhere_ in
   teams.html), so the file stays small and is only loaded on that screen.
   Run after editing docs/khmer-needed.md:  node scripts/build-km-notes.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = fs.readFileSync(path.join(REPO, 'docs/khmer-needed.md'), 'utf8').split('\n');
const hash = (k) => { let h = 5381; for (let i = 0; i < k.length; i++) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0; return h.toString(36); };
const sections = [], keys = {};
let h2 = '', cur = -1;
for (const line of doc) {
  let m = /^##\s+(?:[0-9a-z-]+\.\s+)?(.+)$/.exec(line);
  if (m && !line.startsWith('###')) { h2 = m[1].trim(); sections.push(h2); cur = sections.length - 1; continue; }
  m = /^###\s+(.+)$/.exec(line);
  if (m) { sections.push(m[1].trim()); cur = sections.length - 1; continue; }   // the nearer heading says more
  if (cur < 0 || !line.startsWith('| ') || /^\|\s*-/.test(line)) continue;
  const cells = line.split(' | ');
  const en = cells[0].replace(/^\|\s*/, '').trim().replace(/\\\|/g, '|');
  if (!en || en === 'English') continue;
  const k = hash(en);
  if (!(k in keys)) keys[k] = cur;
}
const out = '/* Built by scripts/build-km-notes.mjs from docs/khmer-needed.md — do not edit by hand.\n' +
  '   Where each draft Khmer string is used, for Khmer review. */\n' +
  'var GP_KM_NOTES = ' + JSON.stringify({ s: sections, k: keys }) + ';\n';
fs.writeFileSync(path.join(REPO, 'public/km-notes.js'), out);
console.log(sections.length + ' sections, ' + Object.keys(keys).length + ' strings → public/km-notes.js (' + Math.round(out.length / 1024) + ' KB)');
