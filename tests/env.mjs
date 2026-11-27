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

/* My Ministry, simpler (Nov 2026). The header is one row; where the ministry sits, who leads it, whose numbers these
   are and "This quarter's report" are behind a tap on the name. mmAbout(page) opens that fold when it is shut. */
export async function mmAbout(page) {
  if (await page.$('#mmAbout[hidden]')) { await page.click('#mmNameBtn'); await page.waitForSelector('#mmAbout:not([hidden])'); }
}

/* Three tabs (Nov 2026): Today · Our tools · Our plan. The old tabs' keys still name where things are — 'numbers' /
   'okr' / 'tasks' are the folding sections of Our plan, every other key is a big button on Our tools (with the
   attribute it always had: data-mmtab, data-cafetab) — so a test that used to click a tab says mmGo(page, key):
   it clicks the top tab if the key is one (the first tab keeps its key), opens the section of Our plan, or opens
   Our tools and taps the tool. openPlan / openTool are the same thing by name. */
export async function mmGo(page, key) {
  const top = '.mmTabs [data-mmtab="' + key + '"], .mmTabs [data-cafetab="' + key + '"]';
  if (await page.$(top)) { await page.click(top); return; }
  if (['numbers', 'okr', 'tasks'].includes(key)) {
    if (!(await page.$('#mmPlan'))) { await page.click('.mmTabs [data-mmtab="mmplan"]'); await page.waitForSelector('#mmPlan'); }
    if (await page.$('[data-mmplan="' + key + '"][aria-expanded="false"]')) await page.click('[data-mmplan="' + key + '"]');
    await page.waitForSelector('#mmPlanBody_' + key);
    return;
  }
  if (!(await page.$('#mmTools'))) { await page.click('.mmTabs [data-mmtab="mmtools"]'); await page.waitForSelector('#mmTools'); }
  await page.click('#mmTools [data-mmtab="' + key + '"], #mmTools [data-cafetab="' + key + '"]');
}
export const openPlan = (page, which) => mmGo(page, { scorecard: 'numbers', rocks: 'okr', tasks: 'tasks' }[which] || which);
export const openTool = mmGo;

/* what a ministry's page is made of now: the top tabs' labels, the tools' keys (Our tools' buttons, in order) and the
   plan's sections — it looks at each tab and comes back to the first. */
export async function mmMap(page) {
  const top = await page.$$eval('.mmTabs .gtTab', (b) => b.map((x) => x.textContent.trim()));
  let tools = [], toolNames = [], plan = [];
  if (await page.$('.mmTabs [data-mmtab="mmtools"]')) {
    await page.click('.mmTabs [data-mmtab="mmtools"]'); await page.waitForSelector('#mmTools');
    tools = await page.$$eval('#mmTools .mmTool', (b) => b.map((x) => x.getAttribute('data-mmtab') || x.getAttribute('data-cafetab') || x.id));
    toolNames = await page.$$eval('#mmTools .mmTool b', (b) => b.map((x) => x.textContent.trim()));
  }
  if (await page.$('.mmTabs [data-mmtab="mmplan"]')) {
    await page.click('.mmTabs [data-mmtab="mmplan"]'); await page.waitForSelector('#mmPlan');
    plan = await page.$$eval('[data-mmplan]', (b) => b.map((x) => x.getAttribute('data-mmplan')));
  }
  await page.click('.mmTabs .gtTab:first-child'); await page.waitForTimeout(300);
  return { top, tools, toolNames, plan };
}
