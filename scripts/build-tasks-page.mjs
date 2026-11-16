/* GP Tasks, the app of its own (Nov 2026, Andrew): public/tasks.html is public/teams.html with a few
   lines changed — its title and home-screen name, its icons, its manifest, and window.GP_APP='tasks',
   which makes the same code open on Tasks / the Calendar with only those two in the bottom bar
   (gpTaRender_ in teams/01-core.js). Built, never edited by hand, so the two pages can't drift: the
   theme, the splash, the error boundary and the script list are teams.html's own.

   node scripts/build-tasks-page.mjs           writes public/tasks.html
   node scripts/build-tasks-page.mjs --check   fails if public/tasks.html isn't what it would write
   Run it after changing teams.html (tests/test-tasks-app.mjs runs the check). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const CHANGES = [
  ['<head>\n', '<head>\n<!-- Built from teams.html by scripts/build-tasks-page.mjs — edit teams.html and run it again, never this file. -->\n<script>window.GP_APP=\'tasks\';</script>\n'],
  ['<title>My YWAM GP</title>', '<title>GP Tasks</title>'],
  ['<meta name="apple-mobile-web-app-title" content="YWAM GP">', '<meta name="apple-mobile-web-app-title" content="GP Tasks">'],
  ['<link rel="apple-touch-icon" sizes="180x180" href="icon-180.png">', '<link rel="apple-touch-icon" sizes="180x180" href="tasks-180.png">'],
  ['<link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">', '<link rel="icon" type="image/png" sizes="512x512" href="tasks-512.png">'],
  ['<link rel="manifest" href="manifest.json">', '<link rel="manifest" href="tasks-manifest.json">'],
  ['<div class="brandEn">MY YWAM GP</div>', '<div class="brandEn">GP TASKS</div>']
];
export function buildTasksPage(teams) {
  let out = teams;
  for (const [from, to] of CHANGES) {
    const n = out.split(from).length - 1;
    if (n !== 1) throw new Error('build-tasks-page: expected one "' + from.trim() + '" in teams.html, found ' + n);
    out = out.replace(from, to);
  }
  return out;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const want = buildTasksPage(fs.readFileSync(path.join(PUB, 'teams.html'), 'utf8'));
  const f = path.join(PUB, 'tasks.html');
  if (process.argv.indexOf('--check') > -1) {
    const have = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (have !== want) { console.log('public/tasks.html is out of date — run: node scripts/build-tasks-page.mjs'); process.exit(1); }
    console.log('public/tasks.html is up to date');
  } else { fs.writeFileSync(f, want); console.log('wrote public/tasks.html'); }
}
