/* Where things are, so no test hardcodes one machine's paths.

   REPO / PUBLIC are derived from this file's own location, so the suite runs from
   any clone. tmpDir() hands out scratch directories under the OS temp dir and
   clears them first — several server tests build a fake @netlify/blobs module in
   one. CHROMIUM points at the preinstalled browser when there is one, and
   otherwise lets Playwright find its own; set GP_CHROMIUM to override. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC = path.join(REPO, 'public');

const BASE = path.join(os.tmpdir(), 'gp-impact-tests');

/* Wipes first: the server tests build a fake @netlify/blobs module in here and
   must not inherit a previous run's. Do not use it for screenshots — a second
   caller in the same run would delete the first one's. */
export function tmpDir(name) {
  const d = path.join(BASE, name);
  if (name !== 'out') fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function findChromium() {
  if (process.env.GP_CHROMIUM) return process.env.GP_CHROMIUM;
  for (const p of ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    try { if (fs.existsSync(p)) return p; } catch (e) { /* keep looking */ }
  }
  return undefined; // let Playwright use its own download
}

export const CHROMIUM = findChromium();

/* A page as one document: the files it loads from teams/ (its styles and its code,
   split out of teams.html in Oct 2026) put back inline where the page loads them. For
   the tests that read a page's source — Khmer coverage, theme colours, the splash, the
   week helpers — rather than drive it in a browser. `root` is for GP_ROOT runs. */
export function pageSource(file, root) {
  const dir = root || PUBLIC;
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  if (!file.endsWith('.html')) return src;
  return src
    .replace(/<link rel="stylesheet" href="(teams\/[^"]+\.css)">/g, function (m, f) { return '<style>\n' + fs.readFileSync(path.join(dir, f), 'utf8') + '</style>'; })
    .replace(/<script src="(teams\/[^"]+\.js)"><\/script>/g, function (m, f) { return '<script>\n' + fs.readFileSync(path.join(dir, f), 'utf8') + '</script>'; });
}


/* "This test is about the Scorecard": a ministry's page opens on its first tab (Today), and a tab somebody picks stays
   for that visit in sessionStorage (gp-mm-tab, by 'Dept|Ministry'). SCORECARD_FIRST is an init script that starts the
   visit with the Scorecard already picked for every ministry in the taxonomy — the page's own mechanism, pre-seeded,
   as tests do for gp-lw-tab. Use: await page.addInitScript(SCORECARD_FIRST). (It replaces the October phone flag
   gp-cafe-view=numbers, which real phones no longer honour.) */
export const SCORECARD_FIRST = (() => {
  const box = {}; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(PUBLIC, 'taxonomy.js'), 'utf8') + '\n;this.__d = { poipet: getBaselineDepartments("poipet"), siemreap: getBaselineDepartments("siemreap") };', box);
  const map = {};
  for (const c of Object.keys(box.__d)) for (const d of Object.keys(box.__d[c])) for (const m of Object.keys(box.__d[c][d])) map[d + '|' + m] = 'numbers';
  return 'try { if (!sessionStorage.getItem("gp-mm-tab")) sessionStorage.setItem("gp-mm-tab", ' + JSON.stringify(JSON.stringify(map)) + '); } catch (e) {}';
})();
