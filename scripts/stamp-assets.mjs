/* A deploy step (netlify.toml → [build] command): names every file teams.html loads with
   its own version, so a phone can keep each one and open the app without asking the
   network for twenty-odd files every time.

   Nov 2026 (Uriah): "when the app loads, it's getting a little slow … can you speed up the
   load time". sw.js is network first for everything — right for the page itself (a push to
   main must be live at once), but it meant each open waited on the network for the
   stylesheet, the fourteen teams/ scripts, km.js, logo.js, the fonts …, even when not one
   of them had changed. Here each of those is rewritten in teams.html as `file?v=<hash of
   its contents>`; sw.js keeps a `?v=` file the first time and from then on serves it at
   once (`versioned_`). A file that changes gets a new hash, so the new teams.html — still
   fetched from the network first — asks for the new file. Nothing can be stale: the
   version is the content.

   Rewritten: <script src="…js">, <link href="…css">, and every `fonts/….woff2` (the
   preload links and the @font-face url()s must match, or a font loads twice). Only
   local paths, only files that exist. It changes the deployed copy, never the repository
   (Netlify runs it in its build folder); run by hand it rewrites public/teams.html, so
   don't commit that. Anything that goes wrong leaves teams.html as it was and the deploy
   goes ahead — the app works the old way, just slower.

   node scripts/stamp-assets.mjs            stamps public/teams.html
   node scripts/stamp-assets.mjs --check    says what it would do, changes nothing */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PAGES = ['teams.html'];

function hashOf(root, rel) {
  const f = path.join(root, rel);
  if (!rel || rel.indexOf('..') > -1 || !fs.existsSync(f) || !fs.statSync(f).isFile()) return '';
  return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
}
const local = (u) => u && !/^[a-z]+:|^\/\/|^\/|^#/i.test(u) && u.indexOf('?') === -1;

/* teams.html's text → { html, stamped: [files], missing: [files] } */
export function stampHtml(html, root) {
  const stamped = [], missing = [];
  const tag = function (rel) {
    const h = hashOf(root, rel);
    if (!h) { if (missing.indexOf(rel) === -1) missing.push(rel); return rel; }
    if (stamped.indexOf(rel) === -1) stamped.push(rel);
    return rel + '?v=' + h;
  };
  let out = html.replace(/(<script\b[^>]*\bsrc=")([^"]+\.js)(")/g, function (m, a, u, b) { return local(u) ? a + tag(u) + b : m; });
  out = out.replace(/(<link\b[^>]*\bhref=")([^"]+\.css)(")/g, function (m, a, u, b) { return local(u) ? a + tag(u) + b : m; });
  out = out.replace(/\bfonts\/[a-z0-9-]+\.woff2(?![?\w])/gi, function (u) { return tag(u); });
  return { html: out, stamped: stamped, missing: missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.indexOf('--check') > -1;
  for (const page of PAGES) {
    try {
      const f = path.join(ROOT, page), html = fs.readFileSync(f, 'utf8');
      if (/\?v=[0-9a-f]{12}/.test(html)) { console.log('stamp-assets: ' + page + ' is stamped already — left as it is'); continue; }
      const r = stampHtml(html, ROOT);
      if (!check) { fs.writeFileSync(f + '.tmp', r.html); fs.renameSync(f + '.tmp', f); }
      console.log('stamp-assets: ' + page + ' — ' + r.stamped.length + ' files named by version' + (r.missing.length ? '; not found, left plain: ' + r.missing.join(', ') : '') + (check ? ' (check only)' : ''));
    } catch (e) {
      console.log('stamp-assets: ' + page + ' left as it was — ' + (e && e.message));   // never fail the deploy over this
    }
  }
}
