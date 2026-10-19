/*  GonPreah Impact — Netlify Function backend
    Replaces the Google Apps Script backend (Code.gs). Same behavior, same
    data shapes the frontend already expects — just Netlify Blobs instead of
    a Google Sheet, and no google.script.run RPC marshalling.

    Storage: one JSON blob per "sheet" (array of row objects), in the
    "gp-data" store. Concurrency: plain read-modify-write, no locking —
    an accepted trade-off at this team's scale (see CLAUDE.md). Within one
    request, though, reads do see that request's own writes — readJSON says
    why that is not optional.

    Leadership tier: metrics in SENSITIVE are stripped unless the caller's code
    matches process.env.GP_LEADER_CODE. Fails closed — if that env var is ever
    unset, nobody gets leader access (no hardcoded fallback; this repo is public,
    so a literal in source would be a permanently known password).

    OKR writes have two doors: the leader code writes anything, and a signed-in
    staff member (username + PIN) writes their OWN campus and department only.
    See okrWriter_ for how that boundary is held.
*/

import { getStore } from '@netlify/blobs';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import TEAM_SEED from './team-seed.js';
import PORTAL_FORMS_DEFAULT from './portal-forms-default.js';
import LEGAL_DOCS_DEFAULT, { STAFF_CONTRACT } from './legal-docs-default.js';
import { buildSignedPdf, isJpeg as isJpeg_ } from './legal-pdf.js';
import { audioStore, readIndex, publicIndex } from './library-audio-lib.js';

const SENSITIVE = ['Base Finances ($)', 'Base Cash Reserve ($)'];

/* ---- lightweight input validation (reject junk, not a full taxonomy check —
   the campus/dept/ministry/metric option lists live in the frontend and
   would be costly to keep in sync here; this just stops garbage/oversized
   values from corrupting the dataset). ---- */
function str_(v, maxLen) {
  const s = String(v == null ? '' : v).trim();
  return (s && s.length <= maxLen) ? s : null;
}
function finiteNum_(v, min, max) {
  const n = Number(v);
  return (isFinite(n) && n >= min && n <= max) ? n : null;
}

/* ==================== the year a week belongs to ====================
   Every dated row used to carry a week number and nothing else, so week 33 of 2027
   would land on top of week 33 of 2026: the new year's first write would overwrite
   last year's figure for sum metrics and silently replace it for `latest` ones.
   The store was a single year's worth of data by construction, and nobody had
   noticed only because the app had not lived through a New Year yet.

   Rows now carry `year`. Reads filter to one year — the current one unless asked
   otherwise — which is what keeps rollup.js and both pages working on plain week
   numbers exactly as before: the year is resolved at this boundary and never
   leaves it.

   LEGACY: rows written before this have no `year`, and it cannot be *recovered*,
   only inferred — so yearOf_ takes the best evidence available, in order: an
   explicit year, the row's own date (kpiDaily and dailyLogs carry one), the
   timestamp of its last edit, and finally GP_LEGACY_YEAR. Set that env var to the
   year the existing data was collected in. This is an assignment, not a recovery:
   a row edited in January that describes the previous December will be attributed
   to the wrong year, which is rare and was unknowable either way. */
const YEAR_MIN = 2020, YEAR_MAX = 2100;

/* The calendar year, for things that are about dates rather than weeks — legacy
   rows, holidays, the org chart's quarters, the leadership board's objectives. A
   year that goes with a week number comes from weekYear_ / thisWeekYear_ /
   yearForWeek_ below. */
function currentYear_() { return new Date().getUTCFullYear(); }

/* ---- the week a date is in, and the year that week belongs to ----
   The app numbers weeks by its own rule, not ISO 8601's: week 1 of a year is the
   Monday–Sunday week that contains 1 January, so its Monday can fall in the
   December before. isoWeekOf in teams.html and mondayOfW1 in index.html count
   the same way — change one, change all three.

   So the last days of December can already be next year's week 1. 1 January
   2027 is a Friday, which makes Monday 28 – Thursday 31 December 2026 week 1 of
   2027; they used to count as "week 53" of 2026 and clamp onto week 52, on top of
   the real week 52. weekYear_ says which year a date's week belongs to, and every
   row keyed by a week stores that year rather than the date's.

   One case is left as it was: when next year's 1 January is a Monday (2023 into
   2024, 2029 into 2030), the last seven days of December are a 53rd week that
   holds no 1 January, so they are nobody's week 1. They still clamp onto week 52
   of their own year. It is rare, and week 53 exists nowhere else in the app.

   Dates are 'YYYY-MM-DD' and counted as whole UTC days, so neither the server's
   time zone nor a daylight-saving change can move a date into the wrong week. */
function dayNo_(dateStr) {
  const t = Date.parse(String(dateStr || '').slice(0, 10) + 'T00:00:00Z');
  return isNaN(t) ? null : Math.round(t / 86400000);
}
function mondayOfWeek1No_(y) {
  const jan1 = Date.UTC(y, 0, 1);
  return Math.round(jan1 / 86400000) - ((new Date(jan1).getUTCDay() + 6) % 7);
}
function weekYear_(dateStr) {
  const n = dayNo_(dateStr);
  if (n == null) return null;
  const y = new Date(n * 86400000).getUTCFullYear();
  return n >= mondayOfWeek1No_(y + 1) ? y + 1 : y;
}
function isoWeek_(dateStr) {
  const n = dayNo_(dateStr);
  if (n == null) return NaN;
  return Math.max(1, Math.min(52, Math.floor((n - mondayOfWeek1No_(weekYear_(dateStr))) / 7) + 1));
}
/* The week year it is now, on the base's own calendar (baseToday_, Cambodia).
   From 28 to 31 December 2026 this is already 2027. */
function thisWeekYear_() { return weekYear_(baseToday_()); }

/* The year a week number from the page belongs to. The page sends a bare week,
   worked out from its own clock, so this is the year that week most plausibly
   means right now:
   - early in the year (this is week 1 or 2), a week 51 or 52 is last year's — the
     backfill of the week just gone, which used to land on this year instead;
   - on the last day before next year's week 1 begins, a week 1 is next year's —
     a phone whose clock is a little ahead of the base's;
   - anything else is this week year's.
   The December end is deliberately narrow: a week 1 sent in mid-December is
   somebody correcting January's, not a phone a fortnight ahead. */
function yearForWeek_(week) {
  const today = baseToday_(), y = weekYear_(today), now = isoWeek_(today), wk = Number(week);
  if (now <= 2 && wk >= 51) return y - 1;
  if (wk === 1 && now >= 51 && weekYear_(addDays_(today, 1)) > y) return y + 1;
  return y;
}

function legacyYear_() {
  const n = finiteNum_(process.env.GP_LEGACY_YEAR, YEAR_MIN, YEAR_MAX);
  return n == null ? currentYear_() : n;
}

/* The year a request is asking about. Absent or junk means "this year" — the week
   year, since everything read this way is keyed by week — so every existing caller
   keeps working without passing anything. */
function askedYear_(v) {
  const n = finiteNum_(v, YEAR_MIN, YEAR_MAX);
  return n == null ? thisWeekYear_() : Math.round(n);
}

function yearFromDate_(d) {
  const n = finiteNum_(String(d || '').slice(0, 4), YEAR_MIN, YEAR_MAX);
  return n == null ? null : Math.round(n);
}

function yearOf_(row) {
  if (!row) return legacyYear_();
  const explicit = finiteNum_(row.year, YEAR_MIN, YEAR_MAX);
  if (explicit != null) return Math.round(explicit);
  return yearFromDate_(row.date) || yearFromDate_(row.updated) || legacyYear_();
}

/* The filter every year-scoped read goes through, so "which year is this row in"
   is answered in exactly one place. */
function inYear_(year) {
  return function (row) { return yearOf_(row) === year; };
}

/* Strong consistency, on purpose. Netlify Blobs default to eventual reads:
   a get() right after a setJSON() may still answer with the old value for a
   while. mutateStaff_ writes and then reads back to check the write took,
   so under eventual reads a perfectly good save could compare unequal ten
   times over and come back as 'busy' — "Could not save", though it had
   saved. Every read here goes through this one store, so the whole app
   reads its own writes. */
function store() { return getStore({ name: 'gp-data', consistency: 'strong' }); }
/* Every blob in this store is either a JSON array of rows or, for loginThrottle,
   a plain object. If one ever comes back as something else — a half-finished
   write, a hand-edit in the Netlify UI, a future schema change — the old code
   handed it straight to .forEach/.findIndex and the whole app answered 500,
   which is the "Error when loading app" screen for every user at once. Check the
   shape against the fallback the caller asked for instead: a bad blob then reads
   as empty, which shows an empty page rather than taking the app down, and the
   next successful write repairs it. */
/*  Read your own writes, for the length of one request.

    Blobs has no compare-and-swap, and a read issued straight after a write can
    still be served the older version. That matters because nearly every write
    handler answers by calling the matching read function — saveMyKpiDay ends
    with getMyMinistry, saveTrip with getMyTrips — so the answer could describe
    the data as it was BEFORE the write it just made. The client believes the
    answer and paints the old value back: a habit tile unticking itself, a week
    total that stays where it was, a leave request that does not appear. It
    looked like "the save didn't work", and it was really "the reply was stale".

    So: what a request writes, that same request reads back. This is scoped with
    AsyncLocalStorage rather than a module-level Map on purpose — module scope
    would be shared by any two invocations that ever overlap on one warm
    instance, and one request reading another's writes would be a far worse bug
    than the one being fixed here. The scope exists only inside the handler, so
    anything running outside it reads the store directly, as before.

    Cloning on the way in and out keeps a handler's own mutations (rows[i] = rec,
    rows.push, .sort in place) from reaching through the cache into what a later
    read in the same request sees. */
const requestScope = new AsyncLocalStorage();
const copy_ = function (v) { return v == null ? v : JSON.parse(JSON.stringify(v)); };

/* The shape check, applied to a cached value as well as a stored one — a
   handler that wrote junk must not get junk handed back by a different route
   than the store would have used. */
function shaped_(v, fallback) {
  if (v == null) return fallback;
  const wantArray = Array.isArray(fallback);
  if (wantArray !== Array.isArray(v)) return fallback;
  if (!wantArray && typeof v !== 'object') return fallback;
  return v;
}

/* And read each key once per request. A boot runs a dozen handlers side by side,
   and each one verifies the PIN and reads what it needs on its own — 66 blob
   reads for one page open, the staff list 19 times and loginThrottle 24, each a
   round trip to the store. Within one request the first read of a key is shared
   (the promise itself, so reads already in flight are shared too). It is kept as
   the store's raw text and each reader parses its own copy — the same work every
   read already did, without the trip. A write still wins (the map above), and
   mutateStaff_ still reads the store directly, so its check-after-write sees the
   real thing. Unparseable text reads as missing, as the shape check already
   treats a junk blob. */
function readsOf_(mine) { return mine.__reads || (mine.__reads = new Map()); }
async function readJSON(key, fallback) {
  const mine = requestScope.getStore();
  if (mine && mine.has(key)) return shaped_(copy_(mine.get(key)), fallback);
  if (!mine) return shaped_(await store().get(key, { type: 'json' }), fallback);
  const reads = readsOf_(mine);
  if (!reads.has(key)) reads.set(key, store().get(key, { type: 'text' }).catch(function (e) { reads.delete(key); throw e; }));
  const v = await reads.get(key);
  if (mine.has(key)) return shaped_(copy_(mine.get(key)), fallback);   // written while we waited
  if (typeof v !== 'string') return shaped_(copy_(v), fallback);       // a store that hands back objects (the tests' fakes)
  let parsed = null;
  try { parsed = JSON.parse(v); } catch (e) { parsed = null; }
  return shaped_(parsed, fallback);
}
/* Start reading these now, all at once, so the handlers that need them later
   find them already there instead of waiting their turn one after another. */
function prefetch_(keys) {
  keys.forEach(function (k) { readJSON(k, null).catch(function () { /* the handler that needs it will see the failure */ }); });
}
async function writeJSON(key, value) {
  await store().setJSON(key, value);
  const mine = requestScope.getStore();
  if (mine) mine.set(key, copy_(value));
  return value;
}

function isLeader_(code) {
  const real = process.env.GP_LEADER_CODE;
  if (!real) return false;
  return String(code || '') === real;
}

/* ---- password hashing (Node crypto instead of Utilities.computeDigest) ---- */
function hashPin_(pin, salt) {
  return crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
}
/* Portal applicants (Oct 2026) sign in with Google or an email and password,
   and their username is their email. A password is hashed with PBKDF2 (a PIN
   is four digits behind a login throttle; a password is worth more work). A
   Google sign-in leaves no password: the server mints a long random device
   token instead, kept hashed on the account (a few, one per phone), and the
   page holds it the way it holds a PIN — so every handler's (username, pin)
   stays as it is. credOk_ is the one place all three are checked. */
const SECRET_ITER = 30000;
const MAX_DEVICE_TOKENS = 8;
function hashSecret_(secret, salt) {
  return crypto.pbkdf2Sync(String(secret), String(salt), SECRET_ITER, 32, 'sha256').toString('hex');
}
function safeEq_(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8'), y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
function credOk_(s, pin) {
  if (!s) return false;
  if (s.secretHash) {
    if (safeEq_(hashSecret_(pin, s.secretSalt), s.secretHash)) return true;
  } else if (s.pinHash && safeEq_(hashPin_(pin, s.pinSalt), s.pinHash)) return true;
  // a device token (Google sign-in): long and random, so a plain salted hash is enough
  if (Array.isArray(s.tokens) && /^[a-f0-9]{40,}$/.test(String(pin || ''))) {
    return s.tokens.some(function (t) { return t && safeEq_(hashPin_(pin, t.salt), t.hash); });
  }
  return false;
}
function newDeviceToken_() { return crypto.randomBytes(24).toString('hex'); }
function addDeviceToken_(rec) {
  const tok = newDeviceToken_(), salt = pinSalt_();
  rec.tokens = (Array.isArray(rec.tokens) ? rec.tokens : []).concat([{ hash: hashPin_(tok, salt), salt: salt, created: new Date().toISOString() }]).slice(-MAX_DEVICE_TOKENS);
  return tok;
}
function authKindOf_(s) { return s.secretHash ? 'password' : (s.pinHash ? 'pin' : 'google'); }
function pinSalt_() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
function normUser_(u) { return String(u || '').trim().toLowerCase(); }

/* ---- login throttle (replaces CacheService's auto-expiring cache) ---- */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;

async function isLoginLocked_(username) {
  const throttle = await readJSON('loginThrottle', {});
  const rec = throttle[normUser_(username)];
  return !!(rec && rec.lockedUntil && Date.now() < rec.lockedUntil);
}
async function recordFailedLogin_(username) {
  const key = normUser_(username);
  const throttle = await readJSON('loginThrottle', {});
  let rec = throttle[key] || { attempts: 0, firstAt: Date.now() };
  if (Date.now() - (rec.firstAt || 0) > LOGIN_ATTEMPT_WINDOW_MS) rec = { attempts: 0, firstAt: Date.now() };
  rec.attempts = (rec.attempts || 0) + 1;
  if (rec.attempts >= LOGIN_MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOGIN_LOCK_MS;
  throttle[key] = rec;
  await writeJSON('loginThrottle', throttle);
}
async function clearLoginThrottle_(username) {
  const key = normUser_(username);
  const throttle = await readJSON('loginThrottle', {});
  // Nothing to clear is the normal case, and a no-op write is not free: every
  // authenticated call used to read AND write this blob, so a page open wrote it
  // once per request — several of them racing on a read-modify-write with no
  // locking. Only write when a lock actually needs lifting.
  if (!(key in throttle)) return;
  delete throttle[key];
  await writeJSON('loginThrottle', throttle);
}

/* ==================== the leadership department's names ====================
   The department has been called 'Base Director', then 'Base Leadership', and
   is 'Campus Leadership' now; its own ministry row — the campus director's
   figures — was 'Campus Leadership' and is 'Campus Director', so the two no
   longer share a name. Stored rows keep whatever name was current when they
   were written, and nothing rewrites the store in bulk: every read of a store
   that carries a department normalises the names on the way out, so the rest
   of this file and the client (which only ever sees normalised names) have a
   single name to compare against, and each ordinary write then persists the
   current name. Incoming payloads are normalised too, for a client still
   running the old taxonomy.

   A ministry that moved department is handled the same way (MINISTRY_MOVES,
   old 'dept|ministry' → the department it is in now): Intercession was under
   Community Service and is under Youth Education (Oct 2026). Rows, keys,
   leads and ministries lists written under the old department read as the
   new one, so its numbers, OKRs and people come along without a rewrite. */
const LEADERSHIP_DEPT = 'Campus Leadership';
const OLD_LEADERSHIP_DEPTS = ['Base Director', 'Base Leadership'];
const MINISTRY_MOVES = { 'Community Service|Intercession': 'Youth Education' };
function normDept_(d, ministry) {
  const dept = OLD_LEADERSHIP_DEPTS.indexOf(d) > -1 ? LEADERSHIP_DEPT : d;
  if (ministry !== undefined && ministry !== null) { const to = MINISTRY_MOVES[dept + '|' + ministry]; if (to) return to; }
  return dept;
}
function normMinistry_(dept, m) {
  return (normDept_(dept) === LEADERSHIP_DEPT && m === 'Campus Leadership') ? 'Campus Director' : m;
}
function normKey_(key, parts) {
  const p = String(key || '').split('|');
  if (p.length !== parts) return key;
  p[1] = normMinistry_(p[0], p[1]); p[0] = normDept_(p[0], p[1]);
  return p.join('|');
}
function normRow_(r) {
  if (!r || typeof r !== 'object') return r;
  if (r.dept !== undefined) { r.ministry = normMinistry_(r.dept, r.ministry); r.dept = normDept_(r.dept, r.ministry); }
  // an OKR row is one key result: its metricKey is dept|ministry|metric
  if (typeof r.metricKey === 'string' && r.metricKey) r.metricKey = normKey_(r.metricKey, 3);
  if (Array.isArray(r.leads)) r.leads = r.leads.map(function (k) { return normKey_(k, 2); });
  if (Array.isArray(r.ministries)) r.ministries = r.ministries.map(function (k) { return normKey_(k, 2); });
  return r;
}
function normRows_(rows) { return Array.isArray(rows) ? rows.map(normRow_) : rows; }

/* ==================== STAFF / TEAMS ==================== */
/* Every staff record must carry its own id — everything else is keyed on it:
   the admin's account rows, reset PIN, edit profile, mentor links, daily
   logs, goals. Accounts from before the Netlify backend (and one or two
   made by hand) have none, and a few may share one. With no id they all
   fall together: the admin's list opens the wrong row (an empty key is the
   same empty key), every one of them reads as "(you)", and adminResetPin
   can't find the person at all. So a missing id is minted here on the way
   in, a duplicate is re-minted for the LATER row (the first keeps it, along
   with whatever history points at it), and the repaired list is written
   straight back so the id is the same on the next request. */
function newStaffId_() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function ensureStaffIds_(rows) {
  if (!Array.isArray(rows)) return { rows: rows, changed: false };
  const seen = {};
  let changed = false;
  rows.forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    let id = (typeof r.id === 'string' || typeof r.id === 'number') ? String(r.id) : '';
    if (!id || seen[id]) { id = newStaffId_(); while (seen[id]) id = newStaffId_(); r.id = id; changed = true; }
    else if (r.id !== id) { r.id = id; changed = true; }
    seen[id] = 1;
  });
  return { rows: rows, changed: changed };
}
async function getStaff_() {
  const fixed = ensureStaffIds_(normRows_(await readJSON('staff', [])));
  if (fixed.changed) await writeJSON('staff', fixed.rows);
  return fixed.rows;
}
async function saveStaff_(rows) { return writeJSON('staff', rows); }

function findStaff_(rows, username) {
  const u = normUser_(username);
  return rows.find(function (s) { return s.username === u; }) || null;
}

async function verifyStaff_(username, pin, allowApplicant) {
  if (await isLoginLocked_(username)) return null;
  const rows = await getStaff_();
  const s = findStaff_(rows, username);
  if (!s || !credOk_(s, pin)) {
    await recordFailedLogin_(username);
    return null;
  }
  await clearLoginThrottle_(username);
  // `active` used to only hide someone from the roster — nothing actually
  // stopped an inactive account from authenticating, so "deactivating"
  // somebody was cosmetic. Gating the one shared verify function closes that
  // for every handler at once, and doubles as the admin-approval gate: a
  // pending Campus Leadership sign-up is created with active:false and simply
  // has no session until an admin flips it, the same switch as deactivating
  // someone later.
  if (s.active === false) return null;
  // An applicant (the portal) holds a real PIN but is not staff: every staff
  // handler is closed to them unless it asks for them by name — see the
  // YWAM GP Portal block. Failing here closes them all at once.
  if (isApplicant_(s) && !allowApplicant) return null;
  return s;
}

/* What kind of staff someone is. The three ids are duplicated from taxonomy.js
   (STAFF_TYPES) because the server must validate what it stores and cannot
   import a plain browser script — change one, change both. Anything else becomes
   '' rather than being rejected: an unknown value means "not said yet", which
   the base figures count and show as exactly that. */
const STAFF_TYPE_IDS = ['campus', 'yap', 'ministry'];
/* Trimmed and lowercased so "Sreilea@Gmail.com" and "sreilea@gmail.com" are
   the same address for the duplicate-account check below — email, not name,
   is what that check is keyed on now, since two people can share a name but
   never the same inbox. Returns null for something that isn't shaped like an
   email at all, so the caller can tell "missing" from "wrong". */
function cleanEmail_(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}
function cleanStaffType_(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return STAFF_TYPE_IDS.indexOf(s) > -1 ? s : '';
}

/* Home country, normalised on the way in.

   "How many countries are we?" is only answerable if one country is one string,
   so this folds the ways people write the same place — khmer / cambodian / KH
   all become Cambodia — and title-cases the rest so "new zealand" and
   "New Zealand" cannot count as two. Unrecognised countries are kept, not
   rejected: a nationality missing from the picker is a gap in the list, not bad
   data, and refusing it would leave the person with no country at all. */
const COUNTRY_ALIASES = {
  'khmer': 'Cambodia', 'cambodian': 'Cambodia', 'kh': 'Cambodia', 'kampuchea': 'Cambodia',
  'usa': 'United States', 'us': 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States',
  'america': 'United States', 'american': 'United States', 'united states of america': 'United States',
  'uk': 'United Kingdom', 'u.k.': 'United Kingdom', 'england': 'United Kingdom',
  'scotland': 'United Kingdom', 'wales': 'United Kingdom', 'britain': 'United Kingdom',
  'great britain': 'United Kingdom', 'british': 'United Kingdom',
  'korea': 'South Korea', 'republic of korea': 'South Korea', 'korean': 'South Korea',
  'nz': 'New Zealand', 'aussie': 'Australia', 'australian': 'Australia',
  'filipino': 'Philippines', 'the philippines': 'Philippines',
  'holland': 'Netherlands', 'dutch': 'Netherlands',
  'png': 'Papua New Guinea', 'hk': 'Hong Kong', 'viet nam': 'Vietnam', 'vietnamese': 'Vietnam',
  'burma': 'Myanmar', 'thai': 'Thailand', 'japanese': 'Japan', 'chinese': 'China',
  'german': 'Germany', 'french': 'France', 'canadian': 'Canada', 'brazilian': 'Brazil'
};
function cleanCountry_(v) {
  const raw = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
  if (!raw || raw.length > 40) return '';
  const alias = COUNTRY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  return raw.replace(/\S+/g, function (w) {
    // Joining words stay lowercase ("Trinidad and Tobago"); everything else is capitalised.
    if (/^(and|of|the|de|da)$/i.test(w)) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
}

/* ==================== personality types ====================
   A person's four-letter type, from YWAM GP's own questionnaire in personality.js
   (or picked directly by someone who already knows theirs). Stored on the staff
   record as:

     personality: { type, scores, source, takenAt, share, season }
     sex:         'male' | 'female' | ''     — a profile field; it picks the avatar

   Who sees what, and why the lines fall where they do:
     · the unauthenticated teamRoster sees NONE of it. That endpoint is public
       to the internet, and nothing new should be readable there;
     · signed-in staff see a shared type and its avatar (type + sex) on the
       directory, and the type's bars on someone's profile — only while that
       person has sharing switched on, which is the default the brief asked for;
     · season is the person's own business: it says how they are doing ("a
       stretched season"), which is not a directory fact. It never leaves their
       own boot/profile.

   The lists below mirror personality.js. tests/test-personality.mjs checks the
   two agree, the same way test-jobfocus keeps jobfocus.js and help.html in step. */
const PTYPE_CODES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const PSEASON_IDS = ['ordinary', 'school', 'outreach', 'transition', 'holidays', 'stretched'];
const PAXES = [['E', 'E', 'I'], ['S', 'S', 'N'], ['T', 'T', 'F'], ['J', 'J', 'P']];

function cleanSex_(v) { return v === 'male' || v === 'female' ? v : ''; }

/* Percentages toward each pair's first letter, whole numbers 0-100 — and they
   must agree with the type they came with. A client sending INFJ with E:80 is
   either broken or lying, and either way the bars would contradict the letters. */
function cleanPScores_(scores, type) {
  if (!scores || typeof scores !== 'object') return null;
  const out = {};
  for (let i = 0; i < PAXES.length; i++) {
    const ax = PAXES[i];
    const v = finiteNum_(scores[ax[0]], 0, 100);
    if (v == null) return null;
    out[ax[0]] = Math.round(v);
    const letter = out[ax[0]] > 50 ? ax[1] : ax[2];
    if (type.charAt(i) !== letter) return null;
  }
  return out;
}

/* ==================== GP Strengths (the free one, YWAM GP's own) ====================
   Thirty-four strengths in four groups, found by 102 "which is more like
   you?" pairs — all YWAM GP's own words, see public/gpstrengths.js. The person sends only their answers;
   the Top 5 is worked out HERE, so what teammates see always follows from the
   choices that made it.

     gstrengths: { answers: { p0: -2..2, … }, scores: { finisher: n, … },
                   top: ['listener', …5], takenAt, share }

   Answers stay with the owner (so they can look back at them). Teammates see
   the Top 5 while it is shared (the default) — never the answers or scores.
   The ids and the left/right strength of each pair mirror gpstrengths.js;
   tests/test-gpstrengths.mjs fails if they drift. */
const GS_IDS = ['hardworker', 'coordinator', 'valuesdriven', 'fairminded', 'careful', 'orderly', 'goalsetter', 'dependable', 'solver', 'starter', 'takecharge', 'voice', 'pacesetter', 'improver', 'confident', 'differencemaker', 'friendmaker', 'flexible', 'weaver', 'mentor', 'comforter', 'peacemaker', 'welcomer', 'noticer', 'optimist', 'loyalfriend', 'factfinder', 'historian', 'visionary', 'inventor', 'collector', 'deepthinker', 'curious', 'pathfinder'];
const GS_PAIRS = [
  ['mentor', 'friendmaker'], ['comforter', 'historian'], ['visionary', 'flexible'], ['curious', 'valuesdriven'],
  ['pathfinder', 'voice'], ['friendmaker', 'historian'], ['coordinator', 'starter'], ['improver', 'curious'],
  ['goalsetter', 'noticer'], ['collector', 'pacesetter'], ['takecharge', 'fairminded'], ['improver', 'peacemaker'],
  ['inventor', 'pacesetter'], ['fairminded', 'factfinder'], ['weaver', 'hardworker'], ['dependable', 'takecharge'],
  ['loyalfriend', 'improver'], ['differencemaker', 'fairminded'], ['flexible', 'coordinator'], ['inventor', 'optimist'],
  ['loyalfriend', 'voice'], ['dependable', 'comforter'], ['noticer', 'visionary'], ['goalsetter', 'pathfinder'],
  ['weaver', 'factfinder'], ['coordinator', 'comforter'], ['welcomer', 'orderly'], ['deepthinker', 'peacemaker'],
  ['confident', 'goalsetter'], ['comforter', 'takecharge'], ['welcomer', 'improver'], ['curious', 'weaver'],
  ['deepthinker', 'noticer'], ['visionary', 'confident'], ['fairminded', 'mentor'], ['starter', 'collector'],
  ['pathfinder', 'mentor'], ['friendmaker', 'careful'], ['voice', 'welcomer'], ['starter', 'goalsetter'],
  ['hardworker', 'flexible'], ['noticer', 'confident'], ['comforter', 'careful'], ['orderly', 'pacesetter'],
  ['collector', 'mentor'], ['hardworker', 'curious'], ['solver', 'inventor'], ['takecharge', 'deepthinker'],
  ['mentor', 'dependable'], ['noticer', 'collector'], ['welcomer', 'starter'], ['takecharge', 'noticer'],
  ['differencemaker', 'weaver'], ['orderly', 'pathfinder'], ['weaver', 'dependable'], ['goalsetter', 'inventor'],
  ['orderly', 'optimist'], ['flexible', 'friendmaker'], ['careful', 'confident'], ['historian', 'valuesdriven'],
  ['optimist', 'differencemaker'], ['confident', 'solver'], ['peacemaker', 'historian'], ['friendmaker', 'hardworker'],
  ['improver', 'deepthinker'], ['factfinder', 'differencemaker'], ['pacesetter', 'valuesdriven'], ['fairminded', 'peacemaker'],
  ['careful', 'pathfinder'], ['visionary', 'orderly'], ['solver', 'friendmaker'], ['confident', 'inventor'],
  ['historian', 'dependable'], ['loyalfriend', 'solver'], ['pacesetter', 'comforter'], ['differencemaker', 'coordinator'],
  ['valuesdriven', 'improver'], ['pacesetter', 'visionary'], ['optimist', 'goalsetter'], ['peacemaker', 'takecharge'],
  ['collector', 'flexible'], ['careful', 'loyalfriend'], ['flexible', 'differencemaker'], ['solver', 'factfinder'],
  ['optimist', 'voice'], ['mentor', 'curious'], ['starter', 'weaver'], ['factfinder', 'coordinator'],
  ['voice', 'hardworker'], ['valuesdriven', 'welcomer'], ['hardworker', 'collector'], ['curious', 'fairminded'],
  ['deepthinker', 'starter'], ['valuesdriven', 'loyalfriend'], ['factfinder', 'optimist'], ['coordinator', 'deepthinker'],
  ['voice', 'orderly'], ['pathfinder', 'loyalfriend'], ['inventor', 'welcomer'], ['historian', 'careful'],
  ['peacemaker', 'solver'], ['dependable', 'visionary']
];

/* the same sum and tie-break as gpGSScore in gpstrengths.js */
function gpStrengthsScore_(answers) {
  if (!answers || typeof answers !== 'object') return null;
  const score = {}, strong = {}, clean = {};
  GS_IDS.forEach(function (id) { score[id] = 0; strong[id] = 0; });
  for (let i = 0; i < GS_PAIRS.length; i++) {
    const raw = answers['p' + i];
    const v = Number(raw);
    if (raw === null || raw === undefined || raw === '' || [-2, -1, 0, 1, 2].indexOf(v) === -1) return null;
    clean['p' + i] = v;
    const a = GS_PAIRS[i][0], b = GS_PAIRS[i][1];
    score[a] -= v; score[b] += v;
    if (v === -2) strong[a]++;
    if (v === 2) strong[b]++;
  }
  const ranked = GS_IDS.slice().sort(function (x, y) {
    return (score[y] - score[x]) || (strong[y] - strong[x]) || (GS_IDS.indexOf(x) - GS_IDS.indexOf(y));
  });
  return { answers: clean, scores: score, top: ranked.slice(0, 5) };
}
function sharedGStrengths_(s) {
  const g = s && s.gstrengths;
  if (!g || !Array.isArray(g.top) || !g.top.length || g.share === false) return null;
  return g.top.slice();
}
function ownGStrengths_(s) {
  const g = s && s.gstrengths;
  if (!g || !Array.isArray(g.top) || !g.top.length) return null;
  return { top: g.top.slice(), scores: Object.assign({}, g.scores || {}), answers: Object.assign({}, g.answers || {}),
    takenAt: g.takenAt || '', share: g.share !== false };
}

async function saveMyGStrengths(username, pin, payload) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const p = payload || {};
  let result = null;
  if (p.answers !== undefined) {
    result = gpStrengthsScore_(p.answers);
    if (!result) return { ok: false, err: 'incomplete' };
  }
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const rec = rows[idx];
    if (p.clear) {
      delete rec.gstrengths;
    } else {
      if (!result && !rec.gstrengths) return { abort: true, ok: false, err: 'no_result' };
      const cur = Object.assign({}, rec.gstrengths || {});
      if (result) {
        cur.answers = result.answers; cur.scores = result.scores; cur.top = result.top;
        cur.takenAt = new Date().toISOString();
      }
      if (p.share !== undefined) cur.share = !!p.share;
      rec.gstrengths = cur;
    }
    rec.updated = new Date().toISOString();
    rows[idx] = rec;
    return { ok: true, staff: rosterStaff_(rec), gstrengths: ownGStrengths_(rec) };
  });
}

/* What a teammate may see: the type and its avatar, or nothing. */
function sharedAvatar_(s) {
  const p = s && s.personality;
  if (!p || !p.type || p.share === false) return null;
  return { type: p.type, sex: cleanSex_(s.sex) };
}
/* publicStaff_ plus the shared avatar — for signed-in readers only. */
function rosterStaff_(s) {
  const out = publicStaff_(s);
  const av = sharedAvatar_(s);
  if (av) out.avatar = av;
  /* the directory and the team map only need the Top 5 ids, in order */
  const gs = sharedGStrengths_(s);
  if (gs) out.gstrengths = gs;
  return out;
}
/* The owner's own copy: everything, including season. */
function ownPersonality_(s) {
  const p = s && s.personality;
  if (!p || !p.type) return null;
  return { type: p.type, scores: p.scores || null, source: p.source || 'test',
    takenAt: p.takenAt || '', share: p.share !== false, season: p.season || 'ordinary' };
}

/* Deliberately narrow: this is what every staff member can see about every
   other one. surveyToken must never appear here — it's what keeps weekly
   check-ins anonymous in the base survey.

   staffType and country are here because the base counts people by them — how
   many campus / YAP / ministry staff, how many Khmer, how many international,
   how many countries. They are directory facts of the same kind as department
   and role; nothing about anyone's health, money or days away travels with them. */
function publicStaff_(s) {
  return {
    id: s.id, name: s.name, username: s.username, campus: s.campus, dept: s.dept,
    ministry: s.ministry || '', role: s.role, photo: s.photo || '', mentorId: s.mentorId || '',
    staffType: cleanStaffType_(s.staffType), country: s.country || '',
    leads: leadsOf_(s), ministries: ministriesOf_(s)
  };
}

/* ==================== ministry leaders ====================
   Who may change WHAT a ministry tracks (hide/add/rename a metric, move it
   between weekly / monthly / quarterly) — as opposed to logging its numbers,
   which any of its own staff can do. Three kinds of people: an admin, anyone
   in the campus leadership department, and a ministry's own leader(s). A
   leader is assigned by an admin from the Admin screen and stored on the
   staff record as "Dept|Ministry" keys, so one person can lead more than
   one ministry — a real situation on a staff this size. */
function leadsOf_(s) { return Array.isArray(s && s.leads) ? s.leads : []; }
function isLeaderOf_(s, dept, ministry) { return leadsOf_(s).indexOf(dept + '|' + ministry) > -1; }
function isLeadership_(s) { return deptOf_(s) === 'Campus Leadership'; }
const MAX_LEADS = 20;
function cleanLeads_(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(function (k) {
    const key = str_(k, 160);
    if (!key || key.indexOf('|') === -1 || out.indexOf(key) > -1) return;
    out.push(key);
  });
  return out.slice(0, MAX_LEADS);
}

/* The other ministries someone serves in. Staff here are usually part of more
   than one: the profile's department + ministry is their MAIN one (home page,
   the one My Ministry opens on), and these are the rest, as "Dept|Ministry"
   keys. They set them on their own profile (or an admin does), and they enter
   numbers for every one of them — see canLogFor_. */
const MAX_MINISTRIES = 10;
function ministriesOf_(s) { return Array.isArray(s && s.ministries) ? s.ministries : []; }
function cleanMinistries_(list, rec) {
  const main = rec.dept + '|' + (rec.ministry || '');
  const out = [];
  (Array.isArray(list) ? list : []).forEach(function (k) {
    const raw = str_(k, 160);
    if (!raw || raw.split('|').length !== 2) return;
    const key = normKey_(raw, 2);
    if (key === main || out.indexOf(key) > -1) return;
    out.push(key);
  });
  return out.slice(0, MAX_MINISTRIES);
}
function memberOf_(s, dept, ministry) {
  return (s.dept === dept && s.ministry === ministry) || ministriesOf_(s).indexOf(dept + '|' + ministry) > -1;
}

/* Public to the internet when called with no PIN, so it answers with
   publicStaff_ and nothing more. Signed in, it adds each person's shared
   personality avatar — see sharedAvatar_. */
async function teamRoster(username, pin) {
  const rows = await getStaff_();
  const me = username ? await verifyStaff_(username, pin) : null;
  return rows.filter(function (s) { return s.active && !isApplicant_(s); }).map(me ? rosterStaff_ : publicStaff_);
}

/* Admin access only ever goes to Campus Leadership, so that is the one
   department a sign-up cannot grant itself instantly — the account is
   created inactive and an admin has to switch it on, same as approving a
   pending request anywhere else in this app. Every other department keeps
   today's instant sign-up; this is deliberately narrow rather than gating
   every new account. */
function needsApproval_(dept) { return normDept_(String(dept || '')) === LEADERSHIP_DEPT; }

async function staffRegister(payload) {
  const u = normUser_(payload.username);
  if (!/^[a-z0-9._-]{2,20}$/.test(u)) return { ok: false, err: 'bad_username' };
  if (!/^\d{4}$/.test(String(payload.pin))) return { ok: false, err: 'bad_pin' };
  if ((await getBoard_()).some(function (b) { return b.username === u; })) return { ok: false, err: 'taken' };
  // One profile per email, going forward — a name can repeat (two staff can
  // share one), an inbox can't. Existing accounts made before this may still
  // carry no email at all; those are nudged to add one, not locked out.
  const email = cleanEmail_(payload.email);
  if (email === null) return { ok: false, err: 'bad_email' };
  if (!email) return { ok: false, err: 'email_required' };
  const salt = pinSalt_();
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  const pending = needsApproval_(payload.dept);
  const rec = {
    id: id, username: u, name: payload.name || u, email: email, pinHash: hashPin_(payload.pin, salt), pinSalt: salt,
    campus: payload.campus || '', dept: normDept_(payload.dept || '', payload.ministry || ''), ministry: normMinistry_(payload.dept || '', payload.ministry || ''),
    role: payload.role || '', photo: '',
    // Asked for at sign-up, changed from Profile & settings later.
    staffType: cleanStaffType_(payload.staffType), country: cleanCountry_(payload.country),
    mentorId: payload.mentorId || '', mentorStatus: payload.mentorId ? 'pending' : '',
    phone: payload.phone || '', joined: payload.joined || '', debt: false, active: !pending,
    isAdmin: false, created: now, updated: now
  };
  if (CD_KINDS.indexOf(payload.cdKind) > -1 && rec.dept === LEADERSHIP_DEPT && rec.ministry === 'Campus Director') rec.cdKind = payload.cdKind;
  // checked and added in one write, so two sign-ups at once can't both take a username or an email
  const added = await mutateStaff_(function (rows) {
    if (findStaff_(rows, u)) return { abort: true, ok: false, err: 'taken' };
    if (rows.some(function (r) { return r.email && r.email === email; })) return { abort: true, ok: false, err: 'email_taken' };
    rows.push(rec);
    return { ok: true };
  });
  if (!added.ok) return added;
  // No staff/profile in a pending response: this account has no session yet,
  // and returning one would let the client log it straight in anyway.
  if (pending) return { ok: true, pending: true };
  return {
    ok: true, staff: publicStaff_(rec),
    profile: { phone: rec.phone, joined: rec.joined, debt: false, mentorStatus: rec.mentorStatus, dashboardColor: '', dashboardBg: '', email: rec.email }
  };
}

async function staffLogin(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (s) {
    return {
      ok: true, staff: Object.assign(publicStaff_(s), { isAdmin: !!s.isAdmin }),
      profile: {
        phone: s.phone, joined: s.joined, debt: s.debt, mentorStatus: s.mentorStatus || '',
        dashboardColor: s.dashboardColor || '', dashboardBg: s.dashboardBg || '', email: s.email || ''
      }
    };
  }
  /* verifyStaff_ already fails closed on an inactive account, same as a wrong
     PIN — right for every other handler, but a login screen owes the person
     a different message for "waiting on approval" than for "wrong PIN", so
     that one distinction is re-checked here. This never grants access on its
     own: it only decides which failure message applies. */
  if (!(await isLoginLocked_(username))) {
    const rows = await getStaff_();
    const raw = findStaff_(rows, username);
    if (raw && raw.active === false && credOk_(raw, pin)) {
      return { ok: false, err: 'pending' };
    }
    // A portal applicant signing in on the staff app: right PIN, wrong door.
    if (raw && isApplicant_(raw) && credOk_(raw, pin)) {
      return { ok: false, err: 'applicant' };
    }
  }
  return { ok: false };
}

/* ==================== admin ====================
   Deliberately narrow: account management (approve/deactivate/reset a PIN/
   fix a wrong campus or department) for whoever holds isAdmin. It does not
   touch the existing leader code, which keeps gating the sensitive dashboard
   metrics exactly as it does today and nothing else — Uriah asked for the
   two kept apart, since the dashboard is due for its own separate rework
   later and admin access shouldn't be tangled up with whatever that becomes.

   So bootstrapping isAdmin spends a second secret, GP_ADMIN_CODE, not the
   leader code — same fail-closed shape as isLeader_ (isAdminCode_ below),
   just a different door. */
function isAdminCode_(code) {
  const real = process.env.GP_ADMIN_CODE;
  if (!real) return false;
  return String(code || '') === real;
}

function adminStaffOut_(s) {
  return {
    id: s.id, name: s.name, username: s.username, campus: s.campus, dept: s.dept,
    ministry: s.ministry || '', role: s.role, active: s.active !== false, isAdmin: !!s.isAdmin, hr: !!s.hr, kmReviewer: !!s.kmReviewer,
    kind: s.kind || 'staff', portalStaff: !!s.portalStaff, portalAdmin: !!s.portalAdmin,
    staffType: s.staffType || '', country: s.country || '', email: s.email || '',
    cdKind: s.cdKind || '', gpRole: gpRolesOf_(s)[0] || '', gpRoles: gpRolesOf_(s), cltRequest: cltRequestOut_(s),
    mentorId: s.mentorId || '', mentorStatus: s.mentorStatus || '',
    leads: leadsOf_(s), ministries: ministriesOf_(s),
    archived: archivedOf_(s),
    created: s.created || ''
  };
}

async function adminGate_(username, pin) {
  const s = await verifyStaff_(username, pin);
  return (s && s.isAdmin) ? s : null;
}

/* Every one of these used to read the whole staff list once, change one
   record, and write the whole list back. Admin fires several of them in
   quick succession — reset a PIN, then rename the same person, approve the
   next one down the list — and each is its own request against a store
   with no compare-and-swap. Two in flight at once can each read before the
   other's write lands; whichever writes last silently overwrites the other
   with its own now-stale copy of everyone else. That is what "I reset the
   PIN and it didn't take" and "I changed her username and it reverted"
   both were — not a broken button, a real write a moment later undone by
   an older snapshot landing after it.

   mutate(rows) makes the one change against the freshest copy this can get;
   returning { abort: true, ...whatever } from it skips the write entirely —
   for a not-found or a validation error, there's nothing to retry.

   There is no compare-and-swap to ask the store for, so this checks after
   the fact instead of before: write, then read back, and if the store still
   holds exactly what was just written, nothing else landed in the middle
   and this write stands. If the readback differs — someone else's write
   raced past this one, either overwriting it or getting overwritten by it —
   re-read the real current data, reapply the same change on top of THAT,
   and try again, rather than declaring victory on stale grounds. A few
   rounds of this converge even when two requests are genuinely
   simultaneous: whichever call is left holding a mismatch keeps folding its
   own change onto whatever the other one most recently landed.

   Goes straight to the store, not getStaff_/saveStaff_, on purpose — a retry
   within this same request must see the real current data, including what
   an earlier attempt in this very loop just wrote and lost the race on, not
   the per-request cache that write left behind. The cache is only updated
   once, at the end, on the attempt that actually sticks.

   The random backoff before a retry matters more than it looks: two calls
   that started at the same moment and take the same shape of time to read,
   mutate and write will keep landing in lockstep and clobbering each other
   attempt after attempt otherwise — a real livelock, not a hypothetical one,
   caught by this file's own test firing two identical-shaped admin edits at
   once. A few milliseconds of jitter is enough to break that symmetry. */
async function mutateStaff_(mutate) {
  const s = store();
  /* A read straight after the write that still shows the list exactly as it was
     before it is a read that hasn't caught up yet, not someone else's write (that
     would show THEIR change). Every attempt seeing only that means our write is the
     newest one there is, so it stands rather than failing as 'busy'. */
  let lagOnly = true, last = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await new Promise(function (r) { setTimeout(r, Math.random() * 40); });
    const raw = shaped_(await s.get('staff', { type: 'json' }), []);
    const rows = ensureStaffIds_(normRows_(copy_(raw))).rows;
    const result = mutate(rows);
    if (result && result.abort) { const out = Object.assign({}, result); delete out.abort; return out; }
    await s.setJSON('staff', rows);
    const after = shaped_(await s.get('staff', { type: 'json' }), []);
    if (JSON.stringify(after) === JSON.stringify(rows)) {
      const mine = requestScope.getStore();
      if (mine) mine.set('staff', copy_(rows));
      return result;
    }
    if (JSON.stringify(after) !== JSON.stringify(raw)) lagOnly = false;
    last = { rows: rows, result: result };
  }
  if (lagOnly && last) {
    const mine = requestScope.getStore();
    if (mine) mine.set('staff', copy_(last.rows));
    return last.result;
  }
  return { ok: false, err: 'busy' };
}

async function grantAdmin(adminCode, targetUsername, makeAdmin) {
  if (!isAdminCode_(adminCode)) return { ok: false, err: 'bad_code' };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.username === normUser_(targetUsername); });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    // Admin only ever goes to Campus Leadership — encoded here too, not just in
    // the sign-up gate, so a mistaken promotion can't hand it to someone else.
    if (makeAdmin && !needsApproval_(rows[idx].dept)) return { abort: true, ok: false, err: 'not_leadership' };
    rows[idx].isAdmin = !!makeAdmin;
    return { ok: true, staff: adminStaffOut_(rows[idx]) };
  });
}

async function adminListStaff(username, pin) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const rows = await getStaff_();
  // Applicants are portal accounts, not staff — they have their own screen.
  // each person's Advisory Board seat, when it is linked to them, so one screen shows every position
  const seats = {};
  (await getBoard_()).forEach(function (b) { if (b.staffId && b.active !== false) seats[b.staffId] = { id: b.id, role: b.role || 'Advisor' }; });
  return { ok: true, staff: rows.filter(function (r) { return !isApplicant_(r); }).map(function (r) { return Object.assign(adminStaffOut_(r), { board: seats[r.id] || null }); }) };
}

/* A staff member's request to move into Campus Leadership (updateProfile), and an
   admin's yes or no. Yes moves them, with the title they picked. */
function cltRequestOut_(s) {
  const q = s && s.cltRequest;
  return q ? { ministry: q.ministry || '', cdKind: q.cdKind || '', at: q.at || '' } : null;
}
async function adminDecideCltRequest(username, pin, staffId, approve) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === staffId; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const rec = rows[idx], q = rec.cltRequest;
    if (!q) return { abort: true, ok: false, err: 'no_request' };
    if (approve) {
      rec.dept = LEADERSHIP_DEPT;
      rec.ministry = normMinistry_(LEADERSHIP_DEPT, q.ministry || '');
      rec.cdKind = rec.ministry === 'Campus Director' && CD_KINDS.indexOf(q.cdKind) > -1 ? q.cdKind : '';
      if (rec.ministries) rec.ministries = cleanMinistries_(rec.ministries, rec);
    }
    delete rec.cltRequest;
    rec.updated = new Date().toISOString();
    return { ok: true, staff: adminStaffOut_(rec) };
  });
}

/* One switch for both halves of account management: flipping a pending
   Campus Leadership sign-up on is the same operation as deactivating someone
   later, since verifyStaff_ treats active:false as "no session" either way. */
async function adminSetActive(username, pin, staffId, active) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === staffId; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    rows[idx].active = !!active;
    rows[idx].updated = new Date().toISOString();
    return { ok: true, staff: adminStaffOut_(rows[idx]) };
  });
}

/* Setting someone's mentor directly, not asking the mentor to accept —
   updateProfile's own mentor field always lands on 'pending' for that
   reason, and stays the only path for a staff member picking their own
   mentor. This is the manual override: an admin can assign (or clear) a
   pairing outright, and can mark it approved immediately so the mentor
   doesn't have to separately accept it in Team. */
async function adminSetMentor(username, pin, staffId, mentorId, approved) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === staffId; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const newMentorId = mentorId || '';
    if (newMentorId === staffId) return { abort: true, ok: false, err: 'self_mentor' };
    if (newMentorId && rows.findIndex(function (r) { return r.id === newMentorId; }) === -1) {
      return { abort: true, ok: false, err: 'mentor_not_found' };
    }
    rows[idx].mentorId = newMentorId;
    rows[idx].mentorStatus = newMentorId ? (approved ? 'approved' : 'pending') : '';
    rows[idx].updated = new Date().toISOString();
    return { ok: true, staff: adminStaffOut_(rows[idx]) };
  });
}

async function adminResetPin(username, pin, staffId, newPin) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  if (!/^\d{4}$/.test(String(newPin))) return { ok: false, err: 'bad_pin' };
  let resetUsername = '';
  const out = await mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === staffId; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const salt = pinSalt_();
    rows[idx].pinHash = hashPin_(newPin, salt);
    rows[idx].pinSalt = salt;
    rows[idx].updated = new Date().toISOString();
    resetUsername = rows[idx].username;
    return { ok: true };
  });
  // A reset PIN is exactly the kind of thing someone asks for after getting
  // locked out, so lift any lockout on the account it now belongs to.
  if (out.ok) await clearLoginThrottle_(resetUsername);
  return out;
}

/* Fixing a wrong campus/department/ministry for someone else — the same
   fields updateProfile lets a person set for themselves, just keyed by
   staffId instead of the caller's own id. PIN and isAdmin are deliberately
   not here: those go through adminResetPin and grantAdmin so each stays a
   single, obvious place to look for who changed it and why. */
async function adminUpdateStaff(username, pin, staffId, payload) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  if (payload && payload.username !== undefined && (await getBoard_()).some(function (b) { return b.username === normUser_(payload.username); })) {
    return { ok: false, err: 'username_taken' };
  }
  const r = await mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === staffId; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const rec = rows[idx];
    if (payload.name !== undefined) rec.name = payload.name;
    if (payload.campus !== undefined) rec.campus = payload.campus;
    if (payload.dept !== undefined) rec.dept = normDept_(payload.dept);
    if (payload.ministry !== undefined) rec.ministry = normMinistry_(rec.dept, payload.ministry);
    rec.dept = normDept_(rec.dept, rec.ministry);   // a ministry that moved department goes where it is now
    if (payload.role !== undefined) rec.role = payload.role;
    if (payload.staffType !== undefined) rec.staffType = cleanStaffType_(payload.staffType);
    if (payload.country !== undefined) rec.country = cleanCountry_(payload.country);
    // YWAM GP: which Campus Director (international / national), and an organisation-wide role
    if (payload.cdKind !== undefined) rec.cdKind = CD_KINDS.indexOf(payload.cdKind) > -1 ? payload.cdKind : '';
    // several YWAM GP places may be one person's (gpRoles); a single gpRole still works
    if (payload.gpRoles !== undefined || payload.gpRole !== undefined) {
      rec.gpRoles = cleanGpRoles_(payload.gpRoles !== undefined ? payload.gpRoles : [payload.gpRole]);
      rec.gpRole = rec.gpRoles[0] || '';
    }
    if (payload.username !== undefined) {
      // Same shape sign-up already enforces (staffRegister above) — a username
      // is also how someone logs in, so it can't collide with anyone else's.
      // Whoever it belongs to will need the new one (and their same PIN) next
      // time they sign in — same as adminResetPin already means a new PIN.
      const u = normUser_(payload.username);
      if (!/^[a-z0-9._-]{2,20}$/.test(u)) return { abort: true, ok: false, err: 'bad_username' };
      if (rows.some(function (r) { return r.id !== staffId && r.username === u; })) {
        return { abort: true, ok: false, err: 'username_taken' };
      }
      rec.username = u;
    }
    if (payload.email !== undefined) {
      const email = cleanEmail_(payload.email);
      if (email === null) return { abort: true, ok: false, err: 'bad_email' };
      if (email && rows.some(function (r) { return r.id !== staffId && r.email && r.email === email; })) {
        return { abort: true, ok: false, err: 'email_taken' };
      }
      rec.email = email;
    }
    if (payload.ministries !== undefined) rec.ministries = cleanMinistries_(payload.ministries, rec);
    else if (rec.ministries) rec.ministries = cleanMinistries_(rec.ministries, rec);
    // Which ministries this person leads — admin-assigned only; see leadsOf_.
    if (payload.leads !== undefined) rec.leads = cleanLeads_(payload.leads);
    // HR access — the Human Resources page (staff contracts, archiving). Admin-assigned.
    if (payload.hr !== undefined) rec.hr = !!payload.hr;
    // Khmer reviewer — checks the draft Khmer from Khmer review (kmReview_ below). Admin-assigned.
    if (payload.kmReviewer !== undefined) rec.kmReviewer = !!payload.kmReviewer;
    // Portal access — who works applications. Admin-assigned; never to an applicant account.
    if (payload.portalStaff !== undefined || payload.portalAdmin !== undefined) {
      if (isApplicant_(rec)) return { abort: true, ok: false, err: 'is_applicant' };
      if (payload.portalStaff !== undefined) rec.portalStaff = !!payload.portalStaff;
      if (payload.portalAdmin !== undefined) rec.portalAdmin = !!payload.portalAdmin;
    }
    rec.updated = new Date().toISOString();
    rows[idx] = rec;
    return { ok: true, staff: adminStaffOut_(rec) };
  });
  // their seat on the Advisory Board, set with their other positions (setStaffBoardSeat_)
  if (r.ok && payload && payload.board !== undefined && r.staff && r.staff.kind !== 'applicant') await setStaffBoardSeat_(staffId, payload.board);
  return r;
}

/* For the real mess this exists to clean up — a duplicate sign-up, a test
   account — not for the normal way someone leaves: that's adminSetActive
   (deactivate), which keeps their history intact. This is permanent, so an
   admin can't delete their own account (that would be one admin locking
   everyone out, or locking themselves out, by mistake), and anyone who had
   this person set as their mentor has that cleared rather than left
   pointing at a ghost id. Their logged numbers stay — a week someone
   answered doesn't stop being real base history just because the account
   that wrote it is gone; only the account itself goes. */
async function adminDeleteStaff(username, pin, staffId) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  if (admin.id === staffId) return { ok: false, err: 'self_delete' };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === staffId; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    rows.splice(idx, 1);
    rows.forEach(function (r) {
      if (r.mentorId === staffId) { r.mentorId = ''; r.mentorStatus = ''; r.updated = new Date().toISOString(); }
    });
    return { ok: true };
  });
}

/* For the one real duplicate this exists to fix — someone who accidentally
   made a second profile, then logged real history under both. Everything
   keyed by staffId (daily logs, weekly goals, leave requests, SMART goals)
   moves onto the kept account; the weekly health check-in moves the same
   way but by surveyToken, since that's what keeps it anonymous in the base
   average. Where BOTH accounts already have a row for the same period (the
   same day, the same week) the kept account's own row wins and the
   duplicate's is left behind rather than overwriting real data — merging
   should never make today's numbers less true than before it ran. The
   duplicate account is deleted at the end, exactly like adminDeleteStaff. */
async function adminMergeStaff(username, pin, keepId, mergeId) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  keepId = str_(keepId, 60); mergeId = str_(mergeId, 60);
  if (!keepId || !mergeId || keepId === mergeId) return { ok: false, err: 'bad_ids' };
  const rows = await getStaff_();
  const keepIdx = rows.findIndex(function (r) { return r.id === keepId; });
  const mergeIdx = rows.findIndex(function (r) { return r.id === mergeId; });
  if (keepIdx === -1 || mergeIdx === -1) return { ok: false, err: 'not_found' };
  const keep = rows[keepIdx];

  // Reassign ownership; where the kept account already has its own row for
  // the same period, leave the duplicate's row under the old id rather than
  // clobbering the kept one. keyFn returns the collision key for a row.
  async function reassignById_(storeKey, keyFn) {
    const all = await readJSON(storeKey, []);
    const keptKeys = new Set(all.filter(function (r) { return r.staffId === keepId; }).map(keyFn));
    all.forEach(function (r) {
      if (r.staffId !== mergeId) return;
      const k = keyFn(r);
      if (keptKeys.has(k)) return;
      r.staffId = keepId;
      keptKeys.add(k);
    });
    await writeJSON(storeKey, all);
  }
  await reassignById_('dailyLogs', function (r) { return r.date; });
  await reassignById_('goals', function (r) { return r.week + '|' + yearOf_(r); });
  // Leave requests and SMART goals have no per-period uniqueness — every row
  // already coexists with every other by its own id, so there is nothing to
  // leave behind.
  await reassignById_('trips', function (r) { return r.id; });
  await reassignById_('smartGoals', function (r) { return r.id; });
  await reassignById_('tasks', function (r) { return r.id; });

  // The weekly health check-in is anonymous by device token, not staffId —
  // move the duplicate's rows onto the KEPT account's own token instead.
  // surveyTokenFor_ can mint a fresh token onto `keep` right here, so this
  // save has to happen before survey rows move, or a token generated only
  // in memory would vanish along with this request.
  const mergeToken = rows[mergeIdx].surveyToken;
  if (mergeToken) {
    const keepToken = surveyTokenFor_(keep);
    await saveStaff_(rows);
    const surveyRows = await getSurvey_();
    const keptWeeks = new Set(surveyRows.filter(function (r) { return r.device === keepToken; })
      .map(function (r) { return r.week + '|' + yearOf_(r); }));
    surveyRows.forEach(function (r) {
      if (r.device !== mergeToken) return;
      const k = r.week + '|' + yearOf_(r);
      if (keptWeeks.has(k)) return;
      r.device = keepToken;
      keptWeeks.add(k);
    });
    await writeJSON('survey', surveyRows);
  }

  // 1-on-1s have no per-period uniqueness either — a pair can already have
  // several, so both directions just move straight over.
  const oneOnOnes = await getOneOnOnes_();
  oneOnOnes.forEach(function (r) {
    if (r.fromId === mergeId) r.fromId = keepId;
    if (r.toId === mergeId) r.toId = keepId;
    if (r.menteeId === mergeId) r.menteeId = keepId;
  });
  await writeJSON('oneOnOnes', oneOnOnes);

  const afterRows = await getStaff_();
  const finalIdx = afterRows.findIndex(function (r) { return r.id === mergeId; });
  if (finalIdx > -1) afterRows.splice(finalIdx, 1);
  afterRows.forEach(function (r) {
    if (r.mentorId === mergeId) { r.mentorId = ''; r.mentorStatus = ''; r.updated = new Date().toISOString(); }
  });
  await saveStaff_(afterRows);
  return { ok: true };
}

async function updateProfile(username, pin, payload) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  // one write that re-reads the list (mutateStaff_), so a save at the same moment as an admin's edit can't undo it
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    const rec = rows[idx];
    if (payload.name !== undefined) rec.name = payload.name;
    if (payload.campus !== undefined) rec.campus = payload.campus;
    /* Moving yourself INTO Campus Leadership waits for an admin (Oct 2026, Uriah) — the
       same rule as a Campus Leadership sign-up, since the department carries the
       leadership tools (the meeting board, other ministries' numbers, a title). The
       rest of the profile saves; the move is kept as a request (cltRequest) that an
       admin approves or declines in Admin → Approvals. Already in it, you move freely. */
    let cltPending = false;
    const wasLeadership = deptOf_(rec) === LEADERSHIP_DEPT;
    const wantDept = payload.dept !== undefined ? normDept_(payload.dept, payload.ministry) : rec.dept;
    if (!wasLeadership && wantDept === LEADERSHIP_DEPT) {
      rec.cltRequest = { ministry: normMinistry_(LEADERSHIP_DEPT, str_(payload.ministry, 80) || ''),
        cdKind: CD_KINDS.indexOf(payload.cdKind) > -1 ? payload.cdKind : '', at: new Date().toISOString() };
      cltPending = true;
    } else {
      if (payload.dept !== undefined) rec.dept = normDept_(payload.dept);
      if (payload.ministry !== undefined) rec.ministry = normMinistry_(rec.dept, payload.ministry);
      rec.dept = normDept_(rec.dept, rec.ministry);   // a ministry that moved department goes where it is now
      // Campus Leadership picks its own title (Oct 2026): International or National Campus Director
      if (payload.cdKind !== undefined) rec.cdKind = CD_KINDS.indexOf(payload.cdKind) > -1 ? payload.cdKind : '';
    }
    if (payload.cancelCltRequest) delete rec.cltRequest;
    if (payload.role !== undefined) rec.role = payload.role;
    if (payload.staffType !== undefined) rec.staffType = cleanStaffType_(payload.staffType);
    if (payload.country !== undefined) rec.country = cleanCountry_(payload.country);
    if (payload.sex !== undefined) rec.sex = cleanSex_(payload.sex);
    if (payload.ministries !== undefined) rec.ministries = cleanMinistries_(payload.ministries, rec);
    else if (rec.ministries) rec.ministries = cleanMinistries_(rec.ministries, rec);   // a new main one drops out of the rest
    // nor through the side door: nobody adds a Campus Leadership row as an extra ministry
    if (deptOf_(rec) !== LEADERSHIP_DEPT && rec.ministries) rec.ministries = rec.ministries.filter(function (k) { return k.split('|')[0] !== LEADERSHIP_DEPT; });
    if (payload.mentorId !== undefined) {
      const newMentorId = payload.mentorId || '';
      // Picking a new/different mentor always resets to pending — the mentor
      // must accept before they get access to this person's private data.
      if (newMentorId !== rec.mentorId) rec.mentorStatus = newMentorId ? 'pending' : '';
      rec.mentorId = newMentorId;
    }
    if (payload.phone !== undefined) rec.phone = payload.phone;
    if (payload.joined !== undefined) rec.joined = payload.joined;
    if (payload.debt !== undefined) rec.debt = !!payload.debt;
    if (payload.email !== undefined) {
      const email = cleanEmail_(payload.email);
      if (email === null) return { abort: true, ok: false, err: 'bad_email' };
      if (email && rows.some(function (r) { return r.id !== s.id && r.email && r.email === email; })) {
        return { abort: true, ok: false, err: 'email_taken' };
      }
      rec.email = email;
    }
    // A free color wheel rather than a fixed palette — any hex works, so the
    // only guard is the shape, not membership in some list.
    if (payload.dashboardColor !== undefined) {
      rec.dashboardColor = /^#[0-9a-fA-F]{6}$/.test(payload.dashboardColor) ? payload.dashboardColor : '';
    }
    rec.updated = new Date().toISOString();
    return {
      ok: true, staff: publicStaff_(rec), cltPending: cltPending,
      profile: {
        phone: rec.phone, joined: rec.joined, debt: rec.debt, mentorStatus: rec.mentorStatus || '',
        dashboardColor: rec.dashboardColor || '', dashboardBg: rec.dashboardBg || '', email: rec.email || '',
        sex: cleanSex_(rec.sex), personality: ownPersonality_(rec),
        gstrengths: ownGStrengths_(rec), cltRequest: cltRequestOut_(rec)
      }
    };
  });
}

/* Save (or clear) someone's personality type. Every field is optional, so the
   same door serves the whole flow: finishing the questionnaire (type + scores),
   picking a type you already know (type, source 'self'), switching sharing off,
   choosing a season, and setting the avatar's sex from the test's first screen.
   { clear: true } removes the type entirely — retaking starts from nothing. */
async function saveMyPersonality(username, pin, payload) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const p = payload || {};
  if (p.type !== undefined && PTYPE_CODES.indexOf(p.type) === -1) return { ok: false, err: 'bad_type' };
  if (p.season !== undefined && PSEASON_IDS.indexOf(p.season) === -1) return { ok: false, err: 'bad_season' };
  const source = p.source === 'self' ? 'self' : 'test';
  let scores = null;
  if (p.type !== undefined && source === 'test') {
    scores = cleanPScores_(p.scores, p.type);
    if (!scores) return { ok: false, err: 'bad_scores' };
  }
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const rec = rows[idx];
    if (p.sex !== undefined) rec.sex = cleanSex_(p.sex);
    if (p.clear) {
      delete rec.personality;
    } else {
      const cur = Object.assign({}, rec.personality || {});
      if (p.type !== undefined) {
        cur.type = p.type;
        cur.scores = scores;
        cur.source = source;
        cur.takenAt = new Date().toISOString();
      }
      if (p.share !== undefined) cur.share = !!p.share;
      if (p.season !== undefined) cur.season = p.season;
      /* A share or season setting with no type yet has nothing to attach to. */
      if (cur.type) rec.personality = cur;
    }
    rec.updated = new Date().toISOString();
    rows[idx] = rec;
    return { ok: true, staff: rosterStaff_(rec), sex: cleanSex_(rec.sex), personality: ownPersonality_(rec) };
  });
}

async function changePin(username, pin, newPin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!/^\d{4}$/.test(String(newPin))) return { ok: false, err: 'bad_pin' };
  const salt = pinSalt_();
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    rows[idx].pinHash = hashPin_(newPin, salt);
    rows[idx].pinSalt = salt;
    return { ok: true };
  });
}

const PHOTO_MIME_ALLOWLIST = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function uploadPhoto(username, pin, base64, mime) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (mime && PHOTO_MIME_ALLOWLIST.indexOf(mime) === -1) return { ok: false, err: 'bad_type' };
  const dataUri = 'data:' + (mime || 'image/jpeg') + ';base64,' + base64;
  if (dataUri.length > 200000) return { ok: false, err: 'too_large' };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    rows[idx].photo = dataUri;
    return { ok: true, photo: dataUri };
  });
}

async function uploadDashboardBg(username, pin, base64, mime) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (mime && PHOTO_MIME_ALLOWLIST.indexOf(mime) === -1) return { ok: false, err: 'bad_type' };
  const dataUri = 'data:' + (mime || 'image/jpeg') + ';base64,' + base64;
  if (dataUri.length > 400000) return { ok: false, err: 'too_large' };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    rows[idx].dashboardBg = dataUri;
    return { ok: true, dashboardBg: dataUri };
  });
}

async function clearDashboardBg(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    rows[idx].dashboardBg = '';
    return { ok: true };
  });
}

/* ==================== personal habits ====================
   Each person picks the handful they're actually working on. A fixed list of
   ten becomes guilt and then abandonment, so the set is per-staff and each
   habit carries its own mentorVisible flag — you choose what your mentor
   sees, which is what makes people log honestly. */
const HABIT_LIBRARY = [
  { id: 'bible',       label: 'Bible reading' },
  { id: 'quietTime',   label: 'Quiet time / prayer' },
  { id: 'workout',     label: 'Workout' },
  { id: 'ateWell',     label: 'Ate well' },
  { id: 'sleptWell',   label: 'Slept well' },
  { id: 'language',    label: 'Language study' },
  { id: 'gratitude',   label: 'Wrote down something I’m grateful for' },
  { id: 'oneOnOne',    label: 'One-on-one' },
  { id: 'sharedFaith', label: 'Shared my faith' },
  { id: 'sabbath',     label: 'Sabbath / rest' }
];
const HABIT_IDS = HABIT_LIBRARY.map(function (h) { return h.id; });
const DEFAULT_HABITS = [
  { id: 'bible',     mentorVisible: true },
  { id: 'quietTime', mentorVisible: true },
  { id: 'workout',   mentorVisible: true }
];
const MAX_HABITS = 8;
/* Oct 2026 (Uriah): a habit can be your own ("c_" + a slug, with its label and
   emoji), and each one has a schedule — `days` is the weekdays it is due
   (0 Sunday … 6 Saturday); absent means every day. The page only asks about
   a habit on its days, and its streak counts those days alone. */
const CUSTOM_HABIT_ID = /^c_[a-z0-9]{1,24}$/;
function cleanHabitDays_(v) {
  if (!Array.isArray(v)) return null;
  const out = [];
  v.forEach(function (d) { const n = Number(d); if (Number.isInteger(n) && n >= 0 && n <= 6 && out.indexOf(n) === -1) out.push(n); });
  out.sort(function (a, b) { return a - b; });
  return (out.length === 0 || out.length === 7) ? null : out;
}

function cleanHabitConfig_(list) {
  const seen = {};
  return (Array.isArray(list) ? list : []).filter(function (h) {
    if (!h || typeof h.id !== 'string' || seen[h.id]) return false;
    if (HABIT_IDS.indexOf(h.id) === -1 && !(CUSTOM_HABIT_ID.test(h.id) && str_(h.label, 40))) return false;
    seen[h.id] = 1; return true;
  }).slice(0, MAX_HABITS).map(function (h) {
    const out = { id: h.id, mentorVisible: !!h.mentorVisible };
    if (HABIT_IDS.indexOf(h.id) === -1) { out.label = str_(h.label, 40); out.icon = str_(h.icon, 8) || '⭐'; }
    const days = cleanHabitDays_(h.days);
    if (days) out.days = days;
    return out;
  });
}
function habitsOf_(s) {
  const cfg = cleanHabitConfig_(s.habits);
  return cfg.length ? cfg : DEFAULT_HABITS.slice();
}
/* Only the ids this person actually tracks get stored, so turning a habit off
   doesn't quietly keep recording it. */
function cleanHabitMap_(map, cfg) {
  const out = {};
  cfg.forEach(function (h) { if (map && map[h.id] !== undefined) out[h.id] = !!map[h.id]; });
  return out;
}

/* Which KPIs a person logs day to day. Some ministries carry 29 metrics —
   GP Media does — and a 29-row form daily gets filled in never. Pinning a
   handful keeps the daily card short; the rest stay available behind "show
   all" for the occasional ones. Empty list = show everything, which is the
   right default before anyone has chosen. */
const MAX_KPI_PINS = 8;

async function saveMyKpiPins(username, pin, pins) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const seen = {};
  const clean = (Array.isArray(pins) ? pins : [])
    .map(function (m) { return str_(m, 80); })
    .filter(function (m) {
      if (!m || seen[m] || SENSITIVE.indexOf(m) > -1) return false;
      seen[m] = 1; return true;
    })
    .slice(0, MAX_KPI_PINS);
  const r = await mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (x) { return x.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    rows[idx].kpiPins = clean;
    rows[idx].updated = new Date().toISOString();
    return { ok: true };
  });
  if (!r.ok) return r;
  return getMyMinistry(username, pin);
}

async function saveMyHabits(username, pin, habits, bibleDay) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const day = finiteNum_(bibleDay, 0, 365);
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    if (habits !== undefined) rows[idx].habits = cleanHabitConfig_(habits);
    if (day !== null) rows[idx].bibleDay = day;
    rows[idx].updated = new Date().toISOString();
    return { ok: true, habits: habitsOf_(rows[idx]), bibleDay: rows[idx].bibleDay || 0 };
  });
}

/* ---- daily log ---- (isoWeek_ and weekYear_ live with the year rules at the top) */

async function getDaily_() { return readJSON('dailyLogs', []); }

async function saveDaily(username, pin, dateStr, payload) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getDaily_();
  const idx = rows.findIndex(function (r) { return r.staffId === s.id && r.date === dateStr; });
  const b = function (v) { return !!v; };
  const n = function (v) { const x = Number(v); return isNaN(x) ? null : x; };
  const rec = {
    staffId: s.id, date: dateStr, week: isoWeek_(dateStr), year: weekYear_(dateStr) || undefined,
    langHours: n(payload.langHours) || 0, minHours: n(payload.minHours) || 0,
    workout: b(payload.workout), bible: b(payload.bible), quietTime: b(payload.quietTime),
    oneOnOne: b(payload.oneOnOne), sharedFaith: b(payload.sharedFaith), sabbath: b(payload.sabbath),
    clarity: n(payload.clarity), growth: n(payload.growth), lonely: n(payload.lonely), porn: b(payload.porn),
    habits: cleanHabitMap_(payload.habits, habitsOf_(s)),
    updated: new Date().toISOString()
  };
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('dailyLogs', rows);
  /* No health row from the days any more (Uriah, Oct 2026): the weekly check-in
     (saveMyWeek) is the only thing that scores a week. A day still records its
     habits — the Habit Tracker is unchanged — it just feeds no score. */
  /*  Answer from the rows we just wrote — never from a fresh read of the store.

      This used to end with `getMyLogs(username, pin)`, which re-reads
      `dailyLogs`. Blobs has no compare-and-swap and a read issued immediately
      after a write can still be served the older version, so that re-read could
      answer with the day as it was BEFORE this tap. The client believes the
      answer and paints the tile off again — which is exactly the "I tap a habit
      and it unticks itself" report. Worse than the flicker: the next tap is then
      computed from that stale map, so taps invert and get lost.

      The authoritative state is already in hand, so there is nothing to go and
      ask for. Two blob reads and a second PIN check saved as well. */
  return {
    ok: true, logs: logsFor_(rows, s.id), profile: { debt: s.debt },
    habits: habitsOf_(s), bibleDay: s.bibleDay || 0, week: null
  };
}

/* habitConfig: pass the person's habit config for the MENTOR view and results
   are narrowed to what they chose to share. Omit it for someone's own data and
   everything comes back.

   Several habits also have a legacy fixed column (bible, workout, quietTime…)
   from before habits were configurable, and those are written in step with the
   habit map — so the same column has to be masked too, or "keep this one
   private" would leak straight through the old field. Habits absent from the
   config aren't masked: loneliness and porn are governed by the mentor
   relationship itself, not per-habit consent. */
const LEGACY_HABIT_COLS = ['workout', 'bible', 'quietTime', 'oneOnOne', 'sharedFaith', 'sabbath'];

function logsFor_(rows, staffId, habitConfig) {
  let shared = null, hidden = [];
  if (habitConfig) {
    shared = habitConfig.filter(function (h) { return h.mentorVisible; }).map(function (h) { return h.id; });
    hidden = habitConfig.filter(function (h) { return !h.mentorVisible; }).map(function (h) { return h.id; });
  }
  return rows.filter(function (r) { return r.staffId === staffId; })
    .slice()
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
    .map(function (r) {
      let habits = r.habits || {};
      if (shared) {
        const filtered = {};
        Object.keys(habits).forEach(function (k) { if (shared.indexOf(k) > -1) filtered[k] = habits[k]; });
        habits = filtered;
      }
      const out = {
        date: r.date, week: r.week, langHours: r.langHours || 0, minHours: r.minHours || 0,
        workout: !!r.workout, bible: !!r.bible, quietTime: !!r.quietTime, oneOnOne: !!r.oneOnOne,
        sharedFaith: !!r.sharedFaith, sabbath: !!r.sabbath,
        clarity: r.clarity == null ? null : r.clarity, growth: r.growth == null ? null : r.growth,
        lonely: r.lonely == null ? null : r.lonely, porn: !!r.porn,
        habits: habits
      };
      hidden.forEach(function (id) {
        if (LEGACY_HABIT_COLS.indexOf(id) > -1) delete out[id];
      });
      return out;
    });
}

async function getMyLogs(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getDaily_();
  return {
    ok: true, logs: logsFor_(rows, s.id), profile: { debt: s.debt },
    habits: habitsOf_(s), bibleDay: s.bibleDay || 0
  };
}

/* ---- mentor requests: picking a mentor doesn't grant access by itself —
   the mentor must accept it here first. ---- */
async function getMyMentees(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getStaff_();
  const mine = rows.filter(function (x) { return x.active && x.mentorId === s.id && x.mentorStatus === 'approved'; }).map(publicStaff_);
  return { ok: true, mentees: mine };
}
async function getMenteeLogs(username, pin, menteeId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getStaff_();
  const m = rows.find(function (x) { return x.id === menteeId; });
  if (!m || m.mentorId !== s.id || m.mentorStatus !== 'approved') return { ok: false, err: 'not_your_mentee' };
  const dailyRows = await getDaily_();
  const cfg = habitsOf_(m);
  /* Their weekly check-ins, by name, to their ONE approved mentor. Survey rows
     are keyed by token, so this join — token back to person — happens nowhere
     else; the base average never sees it. */
  let checkins = [];
  if (m.surveyToken) {
    checkins = (await getSurvey_())
      .filter(function (r) { return r.device === m.surveyToken && yearOf_(r) === thisWeekYear_(); })
      .map(function (r) {
        return {
          week: Number(r.week), lonely: r.lonely, clarity: r.clarity, porn: r.porn,
          oneOnOne: r.oneOnOne, exercise: r.exercise, quietTime: r.quietTime, debt: r.debt,
          langHours: r.langHours, minHours: r.minHours, sharedFaith: r.sharedFaith,
          sabbath: r.sabbath, growth: r.growth, days: r.days || 0,
          source: r.source || 'daily',
          familyCall: r.familyCall, lonelyMonth: r.lonelyMonth,
          ministryUpdate: r.ministryUpdate, twoOneOnOnes: r.twoOneOnOnes
        };
      })
      .sort(function (a, b) { return b.week - a.week; });
  }
  /* A mentor relationship is opt-in and per-person consent to see everything
     in this database, not just the pooled figures the base gets — so once
     approved, nothing here is filtered back out: full daily logs (every
     habit, not just ones marked "shared" — that per-habit toggle no longer
     exists), the ministry numbers they log, their annual SMART goals, and
     their leave history. */
  const menteeTrips = (await getTrips_()).filter(function (r) { return r.staffId === m.id; })
    .sort(function (a, b) { return a.from < b.from ? 1 : -1; });
  const menteeSmart = (await getSmartGoals_()).filter(function (r) { return r.staffId === m.id; });
  const menteeTasks = (await getTasks_()).filter(function (r) { return r.staffId === m.id; });
  return {
    ok: true, mentee: publicStaff_(m),
    logs: logsFor_(dailyRows, m.id),
    habits: cfg,
    goals: goalsFor_(await getGoals_(), m.id),
    checkins: checkins,
    profile: { debt: m.debt },
    support: (m.support && m.support.mentorVisible) ? supportSummary_(m.support) : null,   // totals only, and only when shared
    ministry: await ministryDataFor_(m),
    trips: { trips: menteeTrips.map(tripOut_), totals: awayTotals_(menteeTrips), ptoCap: PTO_ANNUAL_CAP, holidays: holidayList_() },
    smartGoals: smartGoalsOut_(menteeSmart, menteeTasks)
  };
}
async function getMyMentorRequests(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getStaff_();
  const pending = rows.filter(function (x) { return x.active && x.mentorId === s.id && x.mentorStatus === 'pending'; }).map(publicStaff_);
  return { ok: true, requests: pending };
}
async function respondToMentorRequest(username, pin, menteeId, approve) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const r = await mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (x) { return x.id === menteeId; });
    if (idx === -1 || rows[idx].mentorId !== s.id) return { abort: true, ok: false, err: 'not_found' };
    if (approve) rows[idx].mentorStatus = 'approved';
    else { rows[idx].mentorId = ''; rows[idx].mentorStatus = ''; }
    return { ok: true };
  });
  if (!r.ok) return r;
  return getMyMentorRequests(username, pin);
}

/* ==================== DASHBOARD: entries / OKRs / survey ==================== */
async function getEntries_() { return normRows_(await readJSON('entries', [])); }
async function getOkrs_() { return normRows_(await readJSON('okrs', [])); }
async function getSurvey_() { return readJSON('survey', []); }
async function getMetricOverrides_() { return normRows_(await readJSON('metricOverrides', [])); }

async function getData(code, year) {
  const leader = isLeader_(code);
  const yr = askedYear_(year);
  const entryRows = (await withTeamRows_(await getEntries_())).filter(inYear_(yr));
  const entries = {};
  entryRows.forEach(function (r) {
    const dept = normDept_(r.dept); // rows are normalised on read; belt and braces
    if (!leader && SENSITIVE.indexOf(r.metric) > -1) return;
    const val = Number(r.value);
    if (!r.campus || isNaN(val)) return;
    const key = dept + '|' + r.ministry + '|' + r.metric;
    if (!entries[r.campus]) entries[r.campus] = {};
    if (!entries[r.campus][key]) entries[r.campus][key] = {};
    entries[r.campus][key][String(r.week)] = val;
  });

  const okrRows = await getOkrs_();
  const okrs = [], byId = {};
  okrRows.forEach(function (o) {
    if (!o.id) return;
    if (!byId[o.id]) {
      byId[o.id] = { id: o.id, campus: o.campus, quarter: Number(o.quarter), dept: o.dept, objective: o.objective, krs: [] };
      okrs.push(byId[o.id]);
    }
    byId[o.id].krs.push({ text: o.kr, metricKey: o.metricKey || '', target: Number(o.target) || 0, manual: Number(o.manualPct) || 0,
      group: o.group || '', kind: o.kind === 'count' ? 'count' : '', current: Number(o.current) || 0 });
  });

  const nn = function (v) { const n = Number(v); return (v === '' || v == null || isNaN(n)) ? null : n; };
  const surveyRows = (await getSurvey_()).filter(inYear_(yr));
  const survey = surveyRows.map(function (s) {
    return {
      campus: s.campus, week: Number(s.week), device: s.device,
      lonely: Number(s.lonely), clarity: Number(s.clarity), porn: Number(s.porn), oneOnOne: Number(s.oneOnOne),
      exercise: Number(s.exercise), quietTime: Number(s.quietTime), debt: Number(s.debt),
      langHours: Number(s.langHours) || 0, minHours: Number(s.minHours) || 0,
      sharedFaith: nn(s.sharedFaith), sabbath: nn(s.sabbath), growth: nn(s.growth),
      familyCall: nn(s.familyCall), lonelyMonth: nn(s.lonelyMonth),
      ministryUpdate: nn(s.ministryUpdate), twoOneOnOnes: nn(s.twoOneOnOnes)
    };
  });

  /* The roster rides along: the dashboard needs it for the staff headcount and was
     fetching it as a second request, and teamRoster is already unauthenticated, so
     this exposes nothing new — it just costs one invocation instead of two. */
  const roster = (await getStaff_()).filter(function (s) { return s.active && !isApplicant_(s); }).map(publicStaff_);

  /* `year` goes back so a page can tell which year it is looking at without
     recomputing it — the two pages disagree slightly about week numbering, and
     they must not also disagree about the year. */
  // Every ministry that has ever hidden a baseline metric or added a custom
  // one — both pages merge this into getDepartments() before they render a
  // single tile, so a custom metric shows up on the dashboard the same week
  // it's added, no separate sync step.
  const metricOverrides = await getMetricOverrides_();
  return { leader: leader, year: yr, entries: entries, okrs: okrs, survey: survey, roster: roster, metricOverrides: metricOverrides };
}

/* Writing ministry numbers now requires saying who you are.

   It used to accept any POST at all: the front door gated the log form in the UI
   and the endpoint itself checked nothing, so anyone who found the URL could
   rewrite any campus's figures. Two ways in now, and one of them has to hold:
     - the leadership code, which may write any campus, as before; or
     - a username + PIN, which may write ONLY that person's own campus.
   The campus lock is the one Uriah asked for — "they should only log numbers for
   the campus they're logged in as" — and it costs nobody access, because the UI
   has required an account to reach this form since the front door was added.
   A staff member with no campus on their record is refused rather than guessed at. */
async function saveEntries(campus, updates, code, username, pin) {
  const leader = isLeader_(code);
  let writer = null;
  if (!leader) {
    writer = await verifyStaff_(username, pin);
    if (!writer) return { ok: false, err: 'auth' };
    if (!writer.campus) return { ok: false, err: 'no_campus' };
  }
  const rows = await getEntries_();
  const now = new Date().toISOString();
  campus = str_(campus, 40);
  if (!campus) return getData(code);
  // Staff write their own campus whatever the request says it is.
  if (writer && campus !== writer.campus) return { ok: false, err: 'wrong_campus' };
  (updates || []).forEach(function (u) {
    const dept = str_(u.dept, 80), ministry = str_(u.ministry, 80), metric = str_(u.metric, 80);
    const week = finiteNum_(u.week, 1, 52);
    if (!dept || !ministry || !metric || week == null) return;
    const yr = yearForWeek_(week);
    // Reads are already filtered by leader status in getData(); mirror that
    // here so a non-leader can't blindly overwrite a value they can't see.
    if (!leader && SENSITIVE.indexOf(metric) > -1) return;
    const idx = rows.findIndex(function (r) {
      return r.campus === campus && r.dept === dept && r.ministry === ministry &&
        r.metric === metric && String(r.week) === String(week) && yearOf_(r) === yr;
    });
    if (u.value === null || u.value === '' || u.value === undefined) {
      if (idx > -1) rows.splice(idx, 1);
      return;
    }
    const value = finiteNum_(u.value, -1e9, 1e9);
    if (value == null) return;
    if (kpiOutOfRange_(ministry, metric, value)) return;
    if (idx > -1) {
      rows[idx].value = value; rows[idx].updated = now; rows[idx].year = yr;
      if (writer) rows[idx].by = writer.id;
    } else {
      rows.push(Object.assign({ campus: campus, dept: dept, ministry: ministry, metric: metric,
        week: week, year: yr, value: value, updated: now }, writer ? { by: writer.id } : {}));
    }
  });
  await writeJSON('entries', rows);
  return getData(code);
}

/* ---------- who may write an objective ----------
   Two callers, two rules. Leadership (the leader code, from the dashboard) may
   write any objective. A signed-in staff member (username + PIN, from their own
   Me page) may write objectives for THEIR OWN campus and department and nothing
   else — a staff member editing their team's objectives is the point of the
   feature, editing another team's is not.

   Two things make that a real boundary rather than a hopeful one:
     - the campus and department are taken from the STAFF RECORD, never from the
       payload, so a crafted request cannot claim someone else's department;
     - an existing objective is only writable if it already belongs to that
       campus and department, so an id cannot be used to hijack another team's.

   'Base Director' is the old name for what is now the Campus Leadership
   department; profiles created before the rename still carry it. */
function deptOf_(s) { return normDept_(s.dept); }

/* An app admin (isAdmin) writes every campus's and department's objectives,
   the same reach as the leader code; everyone else stays pinned to their own. */
async function okrWriter_(code, username, pin) {
  if (isLeader_(code)) return { leader: true };
  const s = await verifyStaff_(username, pin);
  if (!s) return null;
  if (s.isAdmin && s.active !== false) return { leader: true, admin: true };
  return { leader: false, campus: s.campus, dept: deptOf_(s) };
}

async function saveObjective(obj, code, username, pin) {
  const who = await okrWriter_(code, username, pin);
  if (!who) return getData(code);

  const id = str_(obj && obj.id, 100);
  const objective = str_(obj && obj.objective, 300);
  const quarter = finiteNum_(obj && obj.quarter, 1, 4);
  // Staff are pinned to their own campus and department; leaders say which.
  const campus = who.leader ? str_(obj && obj.campus, 40) : who.campus;
  const dept = who.leader ? str_(obj && obj.dept, 80) : who.dept;
  if (!id || !campus || !dept || !objective || quarter == null) return getData(code);

  let rows = await getOkrs_();
  if (!who.leader) {
    // Editing an existing objective is only allowed if it is already theirs.
    const existing = rows.filter(function (r) { return String(r.id) === id; });
    const foreign = existing.some(function (r) {
      return r.campus !== who.campus || deptOf_(r) !== who.dept;
    });
    if (foreign) return getData(code);
  }
  // The new rows go back where the old ones were, so saving a key result's
  // progress does not move its objective to the bottom of the page.
  let at = rows.findIndex(function (r) { return String(r.id) === id; });
  rows = rows.filter(function (r) { return String(r.id) !== id; });
  if (at < 0 || at > rows.length) at = rows.length;
  const fresh = [];
  const now = new Date().toISOString();
  (Array.isArray(obj.krs) ? obj.krs.slice(0, 10) : []).forEach(function (kr) {
    const text = str_(kr && kr.text, 300);
    if (!text) return;
    fresh.push({
      campus: campus, quarter: quarter, dept: dept, id: id, objective: objective,
      kr: text, metricKey: str_(kr.metricKey, 200) || '',
      target: finiteNum_(kr.target, 0, 1e9) || 0, manualPct: finiteNum_(kr.manual, 0, 100) || 0,
      // A heading the key result sits under (Money, Time…), and a count toward
      // the target ("Recruit 20 students": 3 so far) for one tracked by number.
      group: str_(kr.group, 80) || '', kind: kr.kind === 'count' ? 'count' : '',
      current: finiteNum_(kr.current, 0, 1e9) || 0, updated: now
    });
  });
  rows.splice.apply(rows, [at, 0].concat(fresh));
  await writeJSON('okrs', rows);
  return getData(code);
}

async function deleteObjective(id, code, username, pin) {
  const who = await okrWriter_(code, username, pin);
  if (!who) return getData(code);
  let rows = await getOkrs_();
  if (!who.leader) {
    const existing = rows.filter(function (r) { return String(r.id) === String(id); });
    if (!existing.length) return getData(code);
    const foreign = existing.some(function (r) {
      return r.campus !== who.campus || deptOf_(r) !== who.dept;
    });
    if (foreign) return getData(code);
  }
  rows = rows.filter(function (r) { return String(r.id) !== String(id); });
  await writeJSON('okrs', rows);
  return getData(code);
}

/* ==================== weekly goals ====================
   Three goals a week, written at the start and checked off at the end. Keyed
   by week number and the year that week belongs to, the way entries and survey
   rows are (yearForWeek_ for a week the page sends). */
const MAX_GOALS = 3;

async function getGoals_() { return readJSON('goals', []); }

/* A goal's progress is a percentage, not a tick. Ministry work rarely lands on
   "done" or "not done" — you discipled two of the three students you meant to, the
   curriculum is most of the way written — and a checkbox forced people to round
   an honest 60% to one of those two lies. Three goals used to mean the week could
   only ever read 0, 33, 67 or 100%.
   Rows written before this store `done` instead, so read through goalItemPct_:
   an old ticked goal is 100 and an unticked one is 0, which is exactly what they
   meant. `done` is still returned, derived, because a few read paths show a tick. */
function goalItemPct_(i) {
  if (!i) return 0;
  const n = finiteNum_(i.pct, 0, 100);
  if (n != null) return Math.round(n);
  return i.done ? 100 : 0;
}

function goalsFor_(rows, staffId, year) {
  const yr = askedYear_(year);
  return rows.filter(function (r) { return r.staffId === staffId && yearOf_(r) === yr; })
    .slice()
    .sort(function (a, b) { return Number(b.week) - Number(a.week); })
    .map(function (r) {
      const items = (r.items || []).map(function (i) {
        const pct = goalItemPct_(i);
        return { text: i.text || '', pct: pct, done: pct >= 100, metricKey: i.metricKey || '' };
      });
      return { week: Number(r.week), items: items, pct: goalPct_(items), updated: r.updated };
    });
}

/* The week is the average of what you actually moved, not a count of finished
   ones — three goals at 60% is a 60% week, which is the honest reading.
   null (not 0%) when nothing was written, so "no goals set" and "set them and
   moved none of them" stay distinguishable in the mentor view. */
function goalPct_(items) {
  const written = (items || []).filter(function (i) { return i && i.text; });
  if (!written.length) return null;
  const total = written.reduce(function (a, i) { return a + goalItemPct_(i); }, 0);
  return Math.round(total / written.length);
}

async function saveGoals(username, pin, week, items) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const wk = finiteNum_(week, 1, 52);
  if (wk == null) return { ok: false, err: 'bad_week' };
  const clean = (Array.isArray(items) ? items.slice(0, MAX_GOALS) : []).map(function (i) {
    return {
      text: str_(i && i.text, 200) || '',
      /* pct is the stored truth; `done` goes with it so a client reading the blob
         directly, or an older cached page, still sees something sensible. */
      pct: goalItemPct_(i), done: goalItemPct_(i) >= 100,
      // Optional "dept|ministry|metric" — links a goal to the KPI it moves, so
      // personal follow-through and ministry output read as one thing.
      metricKey: str_(i && i.metricKey, 200) || ''
    };
  });
  const rows = await getGoals_();
  const yr = yearForWeek_(wk);
  const idx = rows.findIndex(function (r) {
    return r.staffId === s.id && Number(r.week) === wk && yearOf_(r) === yr;
  });
  const rec = { staffId: s.id, week: wk, year: yr, items: clean, updated: new Date().toISOString() };
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('goals', rows);
  return { ok: true, goals: goalsFor_(rows, s.id) };
}

/* Each person's survey token: a random id on their own staff record, never in
   publicStaff_. Survey rows carry it instead of a name, so anything pooled across
   the base is nameless; only the person's own record maps it back (their one
   approved mentor's view). Made the first time it is needed. */
function surveyTokenFor_(rec) {
  if (!rec.surveyToken) rec.surveyToken = 'st' + crypto.randomBytes(9).toString('hex');
  return rec.surveyToken;
}

/* ---------- the weekly check-in, filled in by hand ----------
   The only way a week gets a health score (the daily roll-up is gone, Oct 2026).
   One survey row per person per week, keyed by their survey token; rows the old
   roll-up wrote stay as they were, and answering that week here replaces them.

   The token is what makes the base average anonymous and the mentor view
   possible at the same time: survey rows carry a token, never a name, so
   anything pooled across the base is nameless by construction; and only the
   person's own record maps their token back to them, which is how their ONE
   approved mentor — and nobody else — can be shown their answers. */
const WEEK_SCALES = ['lonely', 'clarity', 'growth'];
const WEEK_FLAGS = ['porn', 'oneOnOne', 'exercise', 'quietTime', 'debt', 'sharedFaith', 'sabbath'];
const WEEK_HOURS = ['langHours'];
// The month-end add-on (see WEEK_MONTHLY_QS in teams.html) — unlike WEEK_FLAGS,
// only written when the client actually sent one, so a week that never asked
// stays truly absent rather than recording a "No" nobody answered. That's
// what lets compositeOf() count these on the weeks they were asked and skip
// them the rest of the time, the same way it already treats growth/sabbath.
const WEEK_MONTHLY_FLAGS = ['familyCall', 'lonelyMonth', 'ministryUpdate', 'twoOneOnOnes'];

async function saveMyWeek(username, pin, week, payload) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  /* 1-52, the same bound as saveEntries and the week pickers. This used to allow
     53, which no client can offer and no screen can read back, so such a row
     would sit in the base average invisible to the person who wrote it. */
  const wk = finiteNum_(week, 1, 52);
  if (wk == null) return { ok: false, err: 'bad_week' };
  const p = payload || {};

  const minted = await mutateStaff_(function (rows) {
    const si = rows.findIndex(function (r) { return r.id === s.id; });
    if (si === -1) return { abort: true, ok: false };
    return { ok: true, token: surveyTokenFor_(rows[si]) };
  });
  if (!minted.ok) return { ok: false };
  const token = minted.token;

  const rec = { campus: s.campus, week: wk, year: yearForWeek_(wk), device: token, source: 'weekly',
    days: 7, updated: new Date().toISOString() };
  WEEK_SCALES.forEach(function (k) { rec[k] = finiteNum_(p[k], 1, 10); });
  WEEK_FLAGS.forEach(function (k) { rec[k] = p[k] ? 1 : 0; });
  WEEK_HOURS.forEach(function (k) { rec[k] = finiteNum_(p[k], 0, 168) || 0; });
  WEEK_MONTHLY_FLAGS.forEach(function (k) { if (p[k] !== undefined) rec[k] = p[k] ? 1 : 0; });
  // Every 1-10 question has to be answered, or the composite is built on gaps.
  if (WEEK_SCALES.some(function (k) { return rec[k] == null; })) return { ok: false, err: 'incomplete' };

  // Staff debt is part of the profile, not just this week's answer.
  await mutateStaff_(function (rows) {
    const si = rows.findIndex(function (r) { return r.id === s.id; });
    if (si === -1) return { abort: true, ok: false };
    rows[si].debt = !!p.debt;
    return { ok: true };
  });

  const rows = await getSurvey_();
  const idx = rows.findIndex(function (r) {
    return r.campus === s.campus && Number(r.week) === wk && r.device === token &&
      yearOf_(r) === rec.year;
  });
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('survey', rows);
  return getMyWeekly(username, pin);
}

async function deleteMyWeek(username, pin, week) {
  const s = await verifyStaff_(username, pin);
  if (!s || !s.surveyToken) return { ok: false };
  const wk = finiteNum_(week, 1, 52);
  if (wk == null) return { ok: false, err: 'bad_week' };
  let rows = await getSurvey_();
  const yr = yearForWeek_(wk);
  rows = rows.filter(function (r) {
    return !(r.device === s.surveyToken && Number(r.week) === wk && yearOf_(r) === yr);
  });
  await writeJSON('survey', rows);
  return getMyWeekly(username, pin);
}

/* One call for everything the staff home page needs beyond the daily logs. */
async function getMyWeekly(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const goals = goalsFor_(await getGoals_(), s.id);
  // Read-only now — these are derived from the daily logs, not filled in.
  let checkins = [];
  if (s.surveyToken) {
    checkins = (await getSurvey_())
      .filter(function (r) { return r.device === s.surveyToken && yearOf_(r) === thisWeekYear_(); })
      .map(function (r) {
        return {
          week: Number(r.week), lonely: r.lonely, clarity: r.clarity, porn: r.porn,
          oneOnOne: r.oneOnOne, exercise: r.exercise, quietTime: r.quietTime, debt: r.debt,
          langHours: r.langHours, minHours: r.minHours, sharedFaith: r.sharedFaith,
          sabbath: r.sabbath, growth: r.growth, days: r.days || 0,
          source: r.source || 'daily',
          familyCall: r.familyCall, lonelyMonth: r.lonelyMonth,
          ministryUpdate: r.ministryUpdate, twoOneOnOnes: r.twoOneOnOnes
        };
      })
      .sort(function (a, b) { return b.week - a.week; });
  }
  return { ok: true, goals: goals, checkins: checkins };
}

/* ==================== a staff member's own ministry KPIs ====================
   Scoped harder than the leader path on purpose: a staff member can only read
   and write their OWN campus + department + ministry, and never a SENSITIVE
   metric, regardless of what the client sends. */
/*  A level's last known figure, wherever it was recorded.

    `entries` is scoped to this year, which is right for totals and wrong for the
    headcounts that barely move: a ministry whose "Students Enrolled" was last
    touched in week 50 of last year had nothing to carry forward, so the box came
    up empty and somebody had to remember 280 and retype it. A headcount does not
    reset because the calendar did.

    So this looks across every year and returns, per metric, the most recent
    figure recorded strictly BEFORE the current week — with the year it came
    from, so the screen can say "carried from week 50, 2025" rather than
    implying it was last week.  */
function prevLevels_(rows, campus, dept, ministry, yr, wk) {
  const prev = {};
  rows.forEach(function (r) {
    if (r.campus !== campus || r.dept !== dept || r.ministry !== ministry) return;
    if (SENSITIVE.indexOf(r.metric) > -1) return;
    const y = yearOf_(r), w = Number(r.week);
    if (!isFinite(w)) return;
    if (y > yr || (y === yr && w >= wk)) return;          // not earlier than now
    const val = Number(r.value);
    if (!isFinite(val)) return;
    const best = prev[r.metric];
    if (!best || y > best.year || (y === best.year && w > best.week)) {
      prev[r.metric] = { year: y, week: w, value: val };
    }
  });
  return prev;
}

async function ministryDataFor2_(campus, dept, ministry) {
  const out = {}, daily = {};
  const yr = thisWeekYear_();
  let prev = {};
  if (ministry) {
    let rows = await getEntries_();
    if (dept === TEAM_DEPT && ministry === TEAM_MIN) rows = await withTeamRows_(rows);
    prev = prevLevels_(rows, campus, dept, ministry, yr, isoWeek_(baseToday_()));
    rows.forEach(function (r) {
      if (r.campus !== campus || r.dept !== dept || r.ministry !== ministry) return;
      if (SENSITIVE.indexOf(r.metric) > -1) return;
      if (yearOf_(r) !== yr) return;
      if (!out[r.metric]) out[r.metric] = {};
      out[r.metric][String(r.week)] = Number(r.value);
    });
    // Per-day values so the UI can show what's already logged for today and
    // for the rest of this week.
    (await getKpiDaily_()).forEach(function (r) {
      if (r.campus !== campus || r.dept !== dept || r.ministry !== ministry) return;
      if (yearOf_(r) !== yr) return;
      if (!daily[r.metric]) daily[r.metric] = {};
      daily[r.metric][r.date] = Number(r.value);
    });
  }
  return { ok: true, campus: campus, dept: dept, ministry: ministry || '',
    entries: out, daily: daily, prev: prev, pins: [] };
}

/* ==================== numbers people ====================
   Each ministry has a main person and a backup who are responsible for its
   weekly numbers, which are due by Friday of that week. Anyone on the
   ministry can still enter them (canLogFor_ is unchanged) — this says whose
   job it is, so it is somebody's. With nobody set, the ministry's leaders are
   responsible by default.

     numbersPeople: { 'campus|dept|ministry': { main: staffId, backup: staffId|'', by, at } }

   Set by the ministry's leader, its department's Campus Leadership overseer,
   or an admin (canSetNumbers_). Outreach Teams is left out: its numbers come
   from the Teams Database and work as they are.

   The reminders themselves are drawn by the page (notifItems_ in teams.html)
   from numbersStatus_, which the boot carries: whether each ministry I am
   responsible for has numbers in this week and last, and — for a department
   overseer — the same for every ministry in the department, with names. */
function numbersKey_(campus, dept, ministry) { return campus + '|' + dept + '|' + ministry; }
function isTeamsMinistry_(dept, ministry) { return dept === TEAM_DEPT && ministry === TEAM_MIN; }
/* Outreach Teams (the Teams Database) and Campus Leadership's own rows (OKRs and
   the Monday board, no weekly numbers) have no numbers people. */
function numbersExempt_(dept, ministry) { return isTeamsMinistry_(dept, ministry) || dept === 'Campus Leadership'; }
async function getNumbersPeople_() {
  const v = await readJSON('numbersPeople', {});
  if (!(v && typeof v === 'object' && !Array.isArray(v))) return {};
  // keys are campus|dept|ministry — a ministry that moved department reads under the new one
  const out = {};
  Object.keys(v).forEach(function (k) {
    const p = k.split('|');
    const nk = p.length === 3 ? p[0] + '|' + normKey_(p[1] + '|' + p[2], 2) : k;
    if (!out[nk]) out[nk] = v[k];
  });
  return out;
}
function canSetNumbers_(s, dept, ministry) {
  if (numbersExempt_(dept, ministry)) return false;
  return !!(s && (s.isAdmin || isLeaderOf_(s, dept, ministry) || (deptOf_(s) === 'Campus Leadership' && s.ministry === dept)));
}
function personOut_(rows, id) {
  const r = id ? rows.find(function (x) { return x.id === id && x.active; }) : null;
  return r ? { id: r.id, name: r.name } : null;
}
function numbersPeopleFor_(np, rows, campus, dept, ministry) {
  const rec = np[numbersKey_(campus, dept, ministry)] || {};
  const main = personOut_(rows, rec.main), backup = personOut_(rows, rec.backup);
  const leaders = rows.filter(function (r) {
    return r.active && r.campus === campus && !isApplicant_(r) && isLeaderOf_(r, dept, ministry);
  }).map(function (r) { return { id: r.id, name: r.name }; });
  return { main: main, backup: backup, leaders: leaders, defaulted: !main };
}
/* The day in Cambodia — the base's week turns over at its own midnight, not the server's. */
function baseToday_() { return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); }

async function setNumbersPeople(username, pin, dept, ministry, payload) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  dept = str_(dept, 80); ministry = str_(ministry, 80);
  if (!dept || !ministry) return { ok: false, err: 'bad_ministry' };
  if (!canSetNumbers_(s, dept, ministry)) return { ok: false, err: 'not_authorized' };
  const p = payload || {};
  const rows = await getStaff_();
  const pick = function (id) {
    if (id === null || id === undefined || id === '') return '';
    const r = rows.find(function (x) { return x.id === String(id) && x.active && x.campus === s.campus && !isApplicant_(x); });
    return r ? r.id : null;
  };
  const main = pick(p.main), backup = pick(p.backup);
  if (main === null || backup === null) return { ok: false, err: 'bad_person' };
  if (main && backup && main === backup) return { ok: false, err: 'same_person' };
  if (!main && backup) return { ok: false, err: 'backup_needs_main' };
  const np = await getNumbersPeople_();
  const key = numbersKey_(s.campus, dept, ministry);
  if (!main) delete np[key];
  else np[key] = { main: main, backup: backup || '', by: s.id, at: new Date().toISOString() };
  await writeJSON('numbersPeople', np);
  const out = numbersPeopleFor_(np, rows, s.campus, dept, ministry);
  out.canSet = true;
  return { ok: true, numbers: out };
}

/* The numbers people for one ministry, plus who last entered each week's
   numbers — attached to what My Ministry loads (getMyMinistry / getMinistryFor). */
async function withNumbers_(d, s) {
  if (!d || !d.ok || !d.ministry || numbersExempt_(d.dept, d.ministry)) return d;
  const [np, rows, entries] = await Promise.all([getNumbersPeople_(), getStaff_(), getEntries_()]);
  const n = numbersPeopleFor_(np, rows, d.campus, d.dept, d.ministry);
  n.canSet = canSetNumbers_(s, d.dept, d.ministry);
  const yr = thisWeekYear_(), last = {};
  entries.forEach(function (r) {
    if (r.campus !== d.campus || r.dept !== d.dept || r.ministry !== d.ministry || yearOf_(r) !== yr || !r.by) return;
    const w = String(r.week);
    if (!last[w] || (r.updated || '') > last[w].at) last[w] = { id: r.by, at: r.updated || '' };
  });
  n.lastBy = {};
  Object.keys(last).forEach(function (w) {
    const p = personOut_(rows, last[w].id);
    n.lastBy[w] = { name: p ? p.name : '', at: last[w].at };
  });
  d.numbers = n;
  return d;
}

/* For the boot: which ministries I am responsible for (main, backup, or a
   leader with nobody set) and whether each has numbers in this week and last;
   and for a department's overseer, every ministry in the department with its
   people. "In" means any number for the week — the same rule as the page's
   ministryWeekLogged_ (a day's figures roll up into the week's entry). */
async function numbersStatus_(s, rows) {
  const np = await getNumbersPeople_();
  const entries = await getEntries_();
  const wk = isoWeek_(baseToday_());
  const weeks = [wk]; if (wk > 1) weeks.push(wk - 1);
  const yr = thisWeekYear_();
  const logged = {};
  weeks.forEach(function (w) { logged[w] = {}; });
  entries.forEach(function (r) {
    if (r.campus !== s.campus || yearOf_(r) !== yr || !logged[Number(r.week)]) return;
    logged[Number(r.week)][r.dept + '|' + r.ministry] = true;
  });
  const loggedFor = function (dept, ministry) {
    const o = {}; weeks.forEach(function (w) { o[w] = !!logged[w][dept + '|' + ministry]; }); return o;
  };
  const duty = [], seen = {};
  Object.keys(np).forEach(function (k) {
    const parts = k.split('|');
    if (parts[0] !== s.campus || numbersExempt_(parts[1], parts[2])) return;
    const role = np[k].main === s.id ? 'main' : (np[k].backup === s.id ? 'backup' : '');
    if (!role) return;
    seen[parts[1] + '|' + parts[2]] = 1;
    duty.push({ dept: parts[1], ministry: parts[2], role: role, logged: loggedFor(parts[1], parts[2]) });
  });
  leadsOf_(s).forEach(function (k) {
    const parts = k.split('|');
    if (numbersExempt_(parts[0], parts[1]) || seen[k] || np[numbersKey_(s.campus, parts[0], parts[1])]) return;
    duty.push({ dept: parts[0], ministry: parts[1], role: 'leader', logged: loggedFor(parts[0], parts[1]) });
  });
  let dept = null;
  if (deptOf_(s) === 'Campus Leadership' && s.ministry && s.ministry !== 'Campus Director') {
    const people = {};
    Object.keys(np).forEach(function (k) {
      const parts = k.split('|');
      if (parts[0] === s.campus && parts[1] === s.ministry) people[parts[2]] = numbersPeopleFor_(np, rows, s.campus, s.ministry, parts[2]);
    });
    const leaders = {};
    rows.forEach(function (r) {
      if (!r.active || r.campus !== s.campus || isApplicant_(r)) return;
      leadsOf_(r).forEach(function (k) {
        const parts = k.split('|');
        if (parts[0] === s.ministry) (leaders[parts[1]] = leaders[parts[1]] || []).push({ id: r.id, name: r.name });
      });
    });
    const lg = {};
    weeks.forEach(function (w) {
      lg[w] = Object.keys(logged[w]).filter(function (k) { return k.split('|')[0] === s.ministry; })
        .map(function (k) { return k.split('|')[1]; });
    });
    dept = { dept: s.ministry, people: people, leaders: leaders, logged: lg };
  }
  return { week: wk, duty: duty, dept: dept };
}

/* ==================== department pulse ====================
   What a department's leader sees about the department, with nothing typed:
   whether its ministries had their numbers in on time (numbers people), its
   headcount and who is away this week, its health check-ins, its 1-on-1s
   this month, and its staff debt (entered monthly by the Finance office —
   saveStaffDebt). The Campus Director sees it for every department.

   HEALTH STAYS ANONYMOUS. Check-ins carry a token, never a name (see "Who
   sees what" in CLAUDE.md). This joins the department's staff to their
   tokens on the server and sends back only two numbers — how many answered
   and the average health score — never a row, a name or an answer, and no
   score at all when fewer than PULSE_MIN_N answered, so nobody can be
   singled out. The health score is compositeOf in taxonomy.js; compositeOf_
   mirrors it and tests/test-dept-pulse.mjs checks they agree. */
const PULSE_MIN_N = 3;
const PULSE_DEPTS = ['Community Service', 'Youth Education', 'Leadership Development', 'Skills Training'];
function compositeOf_(r) {
  const parts = [10 - (Number(r.lonely) || 0), Number(r.clarity) || 0,
    r.porn ? 0 : 10, r.oneOnOne ? 10 : 0, r.exercise ? 10 : 0, r.quietTime ? 10 : 0, r.debt ? 0 : 10];
  ['growth'].forEach(function (k) { if (r[k] !== null && r[k] !== undefined) parts.push(Number(r[k]) || 0); });
  ['sharedFaith', 'sabbath', 'familyCall', 'ministryUpdate', 'twoOneOnOnes'].forEach(function (k) {
    if (r[k] !== null && r[k] !== undefined) parts.push(r[k] ? 10 : 0);
  });
  if (r.lonelyMonth !== null && r.lonelyMonth !== undefined) parts.push(r.lonelyMonth ? 0 : 10);
  return parts.reduce(function (a, b) { return a + b; }, 0) / parts.length;
}
function canSeePulse_(s, dept) {
  if (PULSE_DEPTS.indexOf(dept) === -1) return false;
  if (s.isAdmin) return true;
  if (deptOf_(s) !== 'Campus Leadership') return false;
  return s.ministry === dept || s.ministry === 'Campus Director';
}
function canEnterStaffDebt_(s) {
  return !!(s && (s.isAdmin || memberOf_(s, 'Skills Training', 'Finances') || isLeaderOf_(s, 'Skills Training', 'Finances')));
}
function overlaps_(from, to, a, b) { return from <= b && to >= a; }

async function getDeptPulse(username, pin, dept) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  dept = str_(dept, 80);
  if (!canSeePulse_(s, dept)) return { ok: false, err: 'not_authorized' };
  const [rows, np, entries, survey, trips, ones] = await Promise.all([
    getStaff_(), getNumbersPeople_(), getEntries_(), getSurvey_(), getTrips_(), getOneOnOnes_()]);
  const today = baseToday_(), wk = isoWeek_(today);
  const campus = s.campus, yr = weekYear_(today);
  const staff = rows.filter(function (r) { return r.active && r.campus === campus && !isApplicant_(r) && deptOf_(r) === dept; });
  const ids = {}; staff.forEach(function (r) { ids[r.id] = r; });

  /* away this week: approved (or simply noted) leave overlapping Mon–Sun — names and dates, no reasons */
  const mon = new Date(today + 'T00:00:00Z'); mon.setUTCDate(mon.getUTCDate() - ((mon.getUTCDay() + 6) % 7));
  const sun = new Date(mon); sun.setUTCDate(sun.getUTCDate() + 6);
  const a = mon.toISOString().slice(0, 10), b = sun.toISOString().slice(0, 10);
  const away = trips.filter(function (t) {
    return ids[t.staffId] && (t.status === 'approved' || t.status === 'noted') && isDate_(t.from) && isDate_(t.to) && overlaps_(t.from, t.to, a, b);
  }).map(function (t) { return { name: ids[t.staffId].name, from: t.from, to: t.to }; });

  /* health, by week, as two numbers only */
  const tokens = {}; staff.forEach(function (r) { if (r.surveyToken) tokens[r.surveyToken] = 1; });
  const healthFor = function (w) {
    const got = survey.filter(function (r) { return tokens[r.device] && Number(r.week) === w && yearOf_(r) === yr; });
    const out = { week: w, answered: got.length, total: staff.length };
    if (got.length >= PULSE_MIN_N) out.score = Math.round(got.reduce(function (x, r) { return x + compositeOf_(r); }, 0) / got.length * 10) / 10;
    return out;
  };
  const health = [healthFor(wk)]; if (wk > 1) health.push(healthFor(wk - 1));

  /* 1-on-1s this month that someone in the department was part of */
  const month = today.slice(0, 7);
  const oneOnOnes = ones.filter(function (o) {
    if (!(ids[o.fromId] || ids[o.toId])) return false;
    if (o.status === 'held') return String(o.heldOn || '').slice(0, 7) === month;
    return o.status === 'accepted' && String(o.decidedAt || o.created || '').slice(0, 7) === month;
  }).length;

  /* numbers in on time, this week and last */
  const weeks = [wk]; if (wk > 1) weeks.push(wk - 1);
  const logged = {}; weeks.forEach(function (w) { logged[w] = {}; });
  entries.forEach(function (r) {
    if (r.campus !== campus || r.dept !== dept || yearOf_(r) !== yr || !logged[Number(r.week)]) return;
    logged[Number(r.week)][r.ministry] = true;
  });
  const lg = {}; weeks.forEach(function (w) { lg[w] = Object.keys(logged[w]); });
  const people = {};
  Object.keys(np).forEach(function (k) {
    const parts = k.split('|');
    if (parts[0] === campus && parts[1] === dept) people[parts[2]] = numbersPeopleFor_(np, rows, campus, dept, parts[2]);
  });
  const leaders = {};
  rows.forEach(function (r) {
    if (!r.active || r.campus !== campus || isApplicant_(r)) return;
    leadsOf_(r).forEach(function (k) { const parts = k.split('|'); if (parts[0] === dept) (leaders[parts[1]] = leaders[parts[1]] || []).push({ id: r.id, name: r.name }); });
  });

  return { ok: true, dept: dept, week: wk, staff: staff.length, away: away, health: health, minN: PULSE_MIN_N,
    oneOnOnes: oneOnOnes, staffDebt: staffDebtFor_(entries, rows, campus, dept),
    numbers: { dept: dept, people: people, leaders: leaders, logged: lg } };
}

/* ---- staff debt, entered monthly by the Finance office ----
   Stored the way it always was — the level metric "Staff Debt ($)" on each
   department's Campus Leadership row — so everything that reads it still
   does; only who types it has changed. */
function staffDebtFor_(entries, rows, campus, dept) {
  let best = null;
  entries.forEach(function (r) {
    if (r.campus !== campus || r.dept !== 'Campus Leadership' || r.ministry !== dept || r.metric !== 'Staff Debt ($)') return;
    if (!best || (r.updated || '') > (best.updated || '')) best = r;
  });
  if (!best) return null;
  const p = personOut_(rows, best.by);
  return { value: Number(best.value), at: best.updated || '', by: p ? p.name : '' };
}
async function getStaffDebt(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canEnterStaffDebt_(s)) return { ok: false, err: 'not_authorized' };
  const [entries, rows] = await Promise.all([getEntries_(), getStaff_()]);
  const out = {};
  PULSE_DEPTS.forEach(function (d) { out[d] = staffDebtFor_(entries, rows, s.campus, d); });
  return { ok: true, debt: out };
}
async function saveStaffDebt(username, pin, values) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canEnterStaffDebt_(s)) return { ok: false, err: 'not_authorized' };
  const v = values || {};
  const wk = isoWeek_(baseToday_());
  for (const d of PULSE_DEPTS) {
    if (v[d] === undefined || v[d] === null || v[d] === '') continue;
    const n = finiteNum_(v[d], 0, 1e9);
    if (n === null) return { ok: false, err: 'bad_amount' };
    await saveMinistryInternal_(s.campus, 'Campus Leadership', d, wk, [{ metric: 'Staff Debt ($)', value: n }], s.id, thisWeekYear_());
  }
  return getStaffDebt(username, pin);
}

/* ==================== Finances: the office's three monthly reports ====================
   Oct 2026 (Uriah): "Build the finance tool for the accounting ministry … build the
   finance page around [our three reports] and then give all the leadership a base
   financial dashboard in their ministry page." The Finances office (Skills Training →
   Finances, the same people as canEnterStaffDebt_) uploads the PDFs it already makes —
   the Profit and Loss, the Burn Rate and the A/R Ageing (staff debt). The page reads
   the numbers out of them (public/finance.js) and sends them here with the PDF; this
   checks their shape and keeps them, one document per campus:
     finance:<campus> = {
       pl:   { 'YYYY-MM': { lines: [{ sec, code, name, parent, amt }], cash, fileId, fileName, at, by } },
       burn: { 'YYYY': { sections: [{ title, kind, rows: [{ label, kind, vals[12] }] }], fileId, fileName, at, by } },
       debt: { asOf, cols, rows: [{ name, vals, total, staffId }], fileId, fileName, at, by },
       debtHist: [{ asOf, cols, vals, total, people }],      // the totals of each report, for the trend
       nameMap: { '<name as the report spells it>': staffId } // who a report's name is, once the office says
     }
   and each PDF as finfile:<id>.
   WHO SEES WHAT. The office sees and changes everything. Campus Leadership — everyone in
   the department, on that campus — sees the dashboard: the P&L and the burn rate in
   full, and the staff debt ONLY as totals (how much, how many people, how old, by
   department), never a name or a person's amount — debt is between a person, their
   mentor and the office (see "Who sees what" in CLAUDE.md). The ageing PDF itself has
   the names, so only the office can open it. An ageing report also fills in each
   department's Staff Debt ($) the way the office used to type it (saveStaffDebt), from
   whoever each name is on staff. */
const FIN_SECS = ['inc', 'oth', 'exp', 'oexp'];
const FIN_SECTION_KINDS = ['campusExp', 'campusInc', 'orgExp', 'orgInc', 'other'];
const FIN_ROW_KINDS = ['item', 'total', 'diff', 'ref'];
const FIN_MAX_LINES = 200, FIN_MAX_SECTIONS = 12, FIN_MAX_ROWS = 40, FIN_MAX_DEBT_ROWS = 400, FIN_MAX_HIST = 36;
function finCanEdit_(s) { return canEnterStaffDebt_(s); }
function finCanView_(s) { return !!(s && (finCanEdit_(s) || isLeadership_(s))); }
function finCampus_(s, campus) { return s.isAdmin && HR_CAMPUSES.indexOf(campus) > -1 ? campus : s.campus; }
function finKey_(c) { return 'finance:' + c; }
async function getFinDoc_(c) {
  const d = await readJSON(finKey_(c), {});
  return { pl: d.pl && typeof d.pl === 'object' ? d.pl : {}, burn: d.burn && typeof d.burn === 'object' ? d.burn : {},
    debt: d.debt && typeof d.debt === 'object' ? d.debt : null, debtHist: Array.isArray(d.debtHist) ? d.debtHist : [],
    nameMap: d.nameMap && typeof d.nameMap === 'object' ? d.nameMap : {} };
}
function finAmt_(v) { if (v === null || v === undefined || v === '') return null; const n = finiteNum_(v, -1e9, 1e9); return n === null ? undefined : Math.round(n * 100) / 100; }
const finYm_ = function (k) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(k)) ? String(k) : ''; };
/* The people a report's names can be: everyone on staff on the campus. */
function finNorm_(n) { return String(n || '').toLowerCase().normalize('NFKD').replace(/[^a-zក-៿ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function finMatch_(name, people) {
  const full = finNorm_(name); if (!full) return null;
  const exact = people.filter(function (p) { return finNorm_(p.name) === full; });
  if (exact.length === 1) return exact[0];
  // a couple ("Dara & Srey Pich"): the first of them who is one person on staff
  const parts = String(name).split(/&|\band\b|\//i).map(finNorm_).filter(Boolean);
  for (const part of parts) {
    const hit = people.filter(function (p) { const n = finNorm_(p.name); return n === part || (part.indexOf(' ') === -1 ? n.split(' ')[0] === part : n.indexOf(part) === 0); });
    if (hit.length === 1) return hit[0];
  }
  return null;
}
function finDebtView_(debt, rows, people) {
  if (!debt) return null;
  const byId = {}; people.forEach(function (p) { byId[p.id] = p; });
  const n = (debt.cols || []).length, vals = []; for (let i = 0; i < n; i++) vals.push(0);
  const depts = {}; let total = 0, unmatched = 0, peopleN = 0;
  (debt.rows || []).forEach(function (r) {
    const tt = Number(r.total) || 0; total += tt; if (Math.abs(tt) >= 0.005) peopleN++;
    (r.vals || []).forEach(function (v, i) { if (i < n) vals[i] += Number(v) || 0; });
    const p = r.staffId && byId[r.staffId];
    const d = p ? deptOf_(p) : '';
    if (d) depts[d] = (depts[d] || 0) + tt; else unmatched += tt;
  });
  const rnd = function (x) { return Math.round(x * 100) / 100; };
  Object.keys(depts).forEach(function (d) { depts[d] = rnd(depts[d]); });
  return { asOf: debt.asOf || '', cols: debt.cols || [], vals: vals.map(rnd), total: rnd(total), people: peopleN,
    byDept: depts, unmatched: rnd(unmatched), at: debt.at || '', by: debt.by ? (personOut_(rows, debt.by) || {}).name || '' : '' };
}
async function finOut_(s, c, d) {
  const rows = await getStaff_();
  const people = rows.filter(function (p) { return p.active && p.campus === c && !isApplicant_(p); });
  const nameOf = function (id) { const p = id ? personOut_(rows, id) : null; return p ? p.name : ''; };
  const edit = finCanEdit_(s);
  const pl = {}; Object.keys(d.pl).forEach(function (k) { const m = d.pl[k]; pl[k] = { lines: m.lines || [], cash: m.cash == null ? null : m.cash, fileId: m.fileId || '', fileName: m.fileName || '', at: m.at || '', by: nameOf(m.by), src: m.src || '' }; });
  const burn = {}; Object.keys(d.burn).forEach(function (k) { const b = d.burn[k]; burn[k] = { sections: b.sections || [], fileId: b.fileId || '', fileName: b.fileName || '', at: b.at || '', by: nameOf(b.by) }; });
  const p = await readJSON('finProj:' + c, {});
  const out = { ok: true, campus: c, canEdit: edit, pl: pl, burn: burn,
    debt: finDebtView_(d.debt, rows, people), debtHist: d.debtHist.slice(-FIN_MAX_HIST),
    ahead: { months: (p && p.months) || {}, updated: (p && p.updated) || '' }, qbo: await qboOut_(c, edit) };
  if (out.debt && d.debt) out.debt.src = d.debt.src || '';
  if (edit && d.debt) {
    out.debtRows = (d.debt.rows || []).map(function (r) { return { name: r.name, vals: r.vals, total: r.total, staffId: r.staffId || '', staffName: nameOf(r.staffId) }; });
    out.debtFile = { fileId: d.debt.fileId || '', fileName: d.debt.fileName || '' };
  }
  if (edit) out.nameMap = d.nameMap;
  return out;
}
async function getFinance(username, pin, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanView_(s)) return { ok: false, err: 'not_authorized' };
  const c = finCampus_(s, campus);
  return finOut_(s, c, await getFinDoc_(c));
}
/* The PDF a report came from, kept so anyone who sees the numbers can open the page
   they came from. The ageing has names, so it is the office's alone. */
async function finPutFile_(c, kind, file, by) {
  if (!file || typeof file !== 'object') return { id: '', name: '' };
  const b64 = file.base64;
  if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length < 40) return { err: 'bad_file' };
  if (b64.length > HR_FILE_MAX_B64) return { err: 'too_large' };
  const id = hrId_('ff'), name = str_(file.name, 160) || (kind + '.pdf');
  await writeJSON('finfile:' + id, { id: id, campus: c, kind: kind, name: name, mime: 'application/pdf', data: b64, added: new Date().toISOString(), by: by });
  return { id: id, name: name };
}
async function finDropFile_(d, id) {
  if (!id) return;
  const used = Object.keys(d.pl).some(function (k) { return d.pl[k].fileId === id; }) ||
    Object.keys(d.burn).some(function (k) { return d.burn[k].fileId === id; }) || (d.debt && d.debt.fileId === id);
  if (used) return;
  try { const st = store(); if (typeof st.delete === 'function') await st.delete('finfile:' + id); } catch (e) { /* only the PDF; the numbers are gone already */ }
}
function finCleanLines_(list) {
  if (!Array.isArray(list) || !list.length || list.length > FIN_MAX_LINES) return null;
  const out = [];
  for (const l of list) {
    if (!l || FIN_SECS.indexOf(l.sec) === -1) return null;
    const amt = finAmt_(l.amt); if (amt === undefined) return null;
    out.push({ sec: l.sec, code: str_(l.code, 12), name: str_(l.name, 120) || str_(l.code, 12) || '—', parent: str_(l.parent, 120), amt: amt });
  }
  return out;
}
function finCleanSections_(list) {
  if (!Array.isArray(list) || !list.length || list.length > FIN_MAX_SECTIONS) return null;
  const out = [];
  for (const sec of list) {
    if (!sec || !Array.isArray(sec.rows) || sec.rows.length > FIN_MAX_ROWS) return null;
    const rows = [];
    for (const r of sec.rows) {
      if (!r || !Array.isArray(r.vals) || r.vals.length !== 12) return null;
      const vals = r.vals.map(finAmt_); if (vals.some(function (v) { return v === undefined; })) return null;
      rows.push({ label: str_(r.label, 120) || '—', kind: FIN_ROW_KINDS.indexOf(r.kind) > -1 ? r.kind : 'item', vals: vals });
    }
    out.push({ title: str_(sec.title, 160), kind: FIN_SECTION_KINDS.indexOf(sec.kind) > -1 ? sec.kind : 'other', rows: rows });
  }
  return out;
}
/* A month's P&L into the finance document (an upload's, or QuickBooks'): each month
   replaces the saved one, keeping the cash typed for it. Gives back the PDFs no longer
   needed, for the caller to drop once the document is written. */
function finApplyPl_(d, clean, f, by, now, src) {
  const old = [];
  Object.keys(clean).forEach(function (k) {
    const prev = d.pl[k];
    if (prev && prev.fileId && prev.fileId !== f.id) old.push(prev.fileId);
    const keepFile = !src && !f.id && prev;
    d.pl[k] = { lines: clean[k].lines, cash: clean[k].cash != null ? clean[k].cash : (prev && prev.cash != null ? prev.cash : null),
      fileId: f.id || (keepFile ? prev.fileId || '' : ''), fileName: f.name || (keepFile ? prev.fileName || '' : ''), at: now, by: by, src: src || '' };
  });
  return old.filter(function (id) { return !Object.keys(d.pl).some(function (k) { return d.pl[k].fileId === id; }); });
}
/* An A/R ageing into the finance document (an upload's, or QuickBooks'): its names
   matched to staff, the newest one kept whole, the totals of every one in the history,
   and each department's Staff Debt ($) as the office used to type it. Writes it. */
async function finApplyDebt_(c, d, asOf, cols, list, file, by, src) {
  const rows = await getStaff_();
  const people = rows.filter(function (p) { return p.active && p.campus === c && !isApplicant_(p); }), ids = {};
  people.forEach(function (p) { ids[p.id] = p; });
  const out = [];
  for (const r of list) {
    const name = str_(r && r.name, 80); if (!name) return { ok: false, err: 'bad_report' };
    const vals = (Array.isArray(r.vals) ? r.vals : []).slice(0, cols.length).map(finAmt_);
    while (vals.length < cols.length) vals.push(0);
    if (vals.some(function (v) { return v === undefined; })) return { ok: false, err: 'bad_amount' };
    const total = finAmt_(r.total); if (total === undefined || total === null) return { ok: false, err: 'bad_amount' };
    let staffId = '';
    if (r.staffId === '-') d.nameMap[name] = '-';                       // "not on staff" — stop guessing
    else if (r.staffId && ids[r.staffId]) { staffId = r.staffId; d.nameMap[name] = staffId; }
    else if (d.nameMap[name] && ids[d.nameMap[name]]) staffId = d.nameMap[name];
    else if (d.nameMap[name] !== '-') { const m = finMatch_(name, people); staffId = m ? m.id : ''; }
    out.push({ name: name, vals: vals.map(function (v) { return v || 0; }), total: total, staffId: staffId });
  }
  const f = await finPutFile_(c, 'debt', file, by); if (f.err) return { ok: false, err: f.err };
  const now = new Date().toISOString();
  const prevFile = d.debt && d.debt.fileId;
  const newer = !d.debt || !d.debt.asOf || asOf >= d.debt.asOf;
  const rec = { asOf: asOf, cols: cols, rows: out, fileId: f.id || '', fileName: f.name || '', at: now, by: by, src: src || '' };
  if (newer) d.debt = rec;
  // the totals go in the history whether or not it is the newest report (an older one fills a gap)
  const view = finDebtView_(rec, rows, people);
  // (QuickBooks brings a new one every night: its history keeps the latest of each month)
  d.debtHist = d.debtHist.filter(function (h) { return h.asOf !== asOf && !(src && h.src === src && h.asOf.slice(0, 7) === asOf.slice(0, 7)); });
  d.debtHist.push({ asOf: asOf, cols: cols, vals: view.vals, total: view.total, people: view.people, src: src || '' });
  d.debtHist.sort(function (a, b) { return a.asOf < b.asOf ? -1 : 1; });
  d.debtHist = d.debtHist.slice(-FIN_MAX_HIST);
  await writeJSON(finKey_(c), d);
  if (newer && prevFile && prevFile !== rec.fileId) await finDropFile_(d, prevFile);
  if (!newer && f.id) await finDropFile_(d, f.id);
  /* each department's Staff Debt ($), as the office used to type it */
  if (newer) {
    const wk = isoWeek_(baseToday_());
    for (const dept of PULSE_DEPTS) {
      await saveMinistryInternal_(c, 'Campus Leadership', dept, wk, [{ metric: 'Staff Debt ($)', value: Math.round(view.byDept[dept] || 0) }], by, thisWeekYear_());
    }
  }
  return { ok: true };
}
/* Save one report. kind 'pl': data = { months: { 'YYYY-MM': { lines, cash } } } (a P&L
   can have a column per month; each is kept as its own month). kind 'burn': data =
   { year, sections }. kind 'debt': data = { asOf, cols, rows: [{ name, vals, total,
   staffId? }] } — a staffId the office picked is remembered for that spelling of the
   name next month; a row without one is matched to staff by name here. */
async function finSave(username, pin, kind, data, file, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanEdit_(s)) return { ok: false, err: 'not_authorized' };
  const c = finCampus_(s, campus), x = data && typeof data === 'object' ? data : {}, now = new Date().toISOString();
  const d = await getFinDoc_(c);
  if (kind === 'pl') {
    const months = x.months && typeof x.months === 'object' ? x.months : {}, keys = Object.keys(months).filter(finYm_).slice(0, 12);
    if (!keys.length) return { ok: false, err: 'bad_report' };
    const clean = {};
    for (const k of keys) {
      const lines = finCleanLines_(months[k] && months[k].lines); if (!lines) return { ok: false, err: 'bad_report' };
      const cash = finAmt_(months[k].cash); if (cash === undefined) return { ok: false, err: 'bad_amount' };
      clean[k] = { lines: lines, cash: cash };
    }
    const f = await finPutFile_(c, 'pl', file, s.id); if (f.err) return { ok: false, err: f.err };
    const old = finApplyPl_(d, clean, f, s.id, now, '');
    await writeJSON(finKey_(c), d);
    for (const id of old) await finDropFile_(d, id);
  } else if (kind === 'burn') {
    const yr = Number(x.year);
    if (!(yr >= 2000 && yr <= 2100)) return { ok: false, err: 'bad_year' };
    const sections = finCleanSections_(x.sections); if (!sections) return { ok: false, err: 'bad_report' };
    const f = await finPutFile_(c, 'burn', file, s.id); if (f.err) return { ok: false, err: f.err };
    const prev = d.burn[String(yr)];
    d.burn[String(yr)] = { sections: sections, fileId: f.id || (prev ? prev.fileId || '' : ''), fileName: f.name || (prev ? prev.fileName || '' : ''), at: now, by: s.id };
    await writeJSON(finKey_(c), d);
    if (prev && prev.fileId && prev.fileId !== d.burn[String(yr)].fileId) await finDropFile_(d, prev.fileId);
  } else if (kind === 'debt') {
    const asOf = isoDate_(x.asOf); if (!asOf) return { ok: false, err: 'bad_date' };
    const cols = (Array.isArray(x.cols) ? x.cols : []).map(function (t) { return str_(t, 40); }).filter(Boolean).slice(0, 8);
    if (!cols.length || !Array.isArray(x.rows) || x.rows.length > FIN_MAX_DEBT_ROWS) return { ok: false, err: 'bad_report' };
    const r = await finApplyDebt_(c, d, asOf, cols, x.rows, file, s.id, '');
    if (!r.ok) return r;
  } else return { ok: false, err: 'bad_kind' };
  return finOut_(s, c, d);
}
/* The office's small fixes: the cash in the bank at a month's end, a staff-debt name
   matched to the right person, or a report taken out again. */
async function finSetCash(username, pin, ym, value, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanEdit_(s)) return { ok: false, err: 'not_authorized' };
  const c = finCampus_(s, campus), d = await getFinDoc_(c), k = finYm_(ym);
  if (!k || !d.pl[k]) return { ok: false, err: 'not_found' };
  const v = finAmt_(value); if (v === undefined) return { ok: false, err: 'bad_amount' };
  d.pl[k].cash = v;
  await writeJSON(finKey_(c), d);
  return finOut_(s, c, d);
}
async function finMatchName(username, pin, name, staffId, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanEdit_(s)) return { ok: false, err: 'not_authorized' };
  const c = finCampus_(s, campus), d = await getFinDoc_(c), nm = str_(name, 80);
  if (!d.debt || !nm) return { ok: false, err: 'not_found' };
  const rows = await getStaff_();
  const people = rows.filter(function (p) { return p.active && p.campus === c && !isApplicant_(p); });
  const id = staffId === '-' ? '-' : (people.some(function (p) { return p.id === staffId; }) ? staffId : '');
  if (staffId && !id) return { ok: false, err: 'bad_person' };
  if (id) d.nameMap[nm] = id; else delete d.nameMap[nm];
  // a person picked → them; "not on staff" → nobody; cleared → back to matching by name
  const auto = (finMatch_(nm, people) || {}).id || '';
  d.debt.rows.forEach(function (r) { if (r.name === nm) r.staffId = id === '-' ? '' : (id || auto); });
  await writeJSON(finKey_(c), d);
  const view = finDebtView_(d.debt, rows, people), wk = isoWeek_(baseToday_());
  for (const dept of PULSE_DEPTS) await saveMinistryInternal_(c, 'Campus Leadership', dept, wk, [{ metric: 'Staff Debt ($)', value: Math.round(view.byDept[dept] || 0) }], s.id, thisWeekYear_());
  return finOut_(s, c, d);
}
async function finDelete(username, pin, kind, key, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanEdit_(s)) return { ok: false, err: 'not_authorized' };
  const c = finCampus_(s, campus), d = await getFinDoc_(c);
  let fileId = '';
  if (kind === 'pl' && d.pl[finYm_(key)]) { fileId = d.pl[key].fileId; delete d.pl[key]; }
  else if (kind === 'burn' && d.burn[String(key)]) { fileId = d.burn[String(key)].fileId; delete d.burn[String(key)]; }
  else if (kind === 'debt' && d.debt) { fileId = d.debt.fileId; d.debtHist = d.debtHist.filter(function (h) { return h.asOf !== d.debt.asOf; }); d.debt = null; }
  else return { ok: false, err: 'not_found' };
  await writeJSON(finKey_(c), d);
  await finDropFile_(d, fileId);
  return finOut_(s, c, d);
}
async function finFile(username, pin, fileId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanView_(s)) return { ok: false, err: 'not_authorized' };
  const f = await readJSON('finfile:' + str_(fileId, 40), null);
  if (!f || !f.data) return { ok: false, err: 'not_found' };
  if (f.campus !== finCampus_(s, f.campus)) return { ok: false, err: 'not_authorized' };
  if (f.kind === 'debt' && !finCanEdit_(s)) return { ok: false, err: 'not_authorized' };
  return { ok: true, name: f.name, mime: f.mime, dataUrl: 'data:' + f.mime + ';base64,' + f.data };
}
/* The money ahead (it was behind the leadership code; now it is Campus Leadership's
   and the office's, signed in, and starts from the cash the office enters). Same
   store as before, so what was typed there is still there. */
async function finAheadSave(username, pin, months, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanView_(s)) return { ok: false, err: 'not_authorized' };
  const c = finCampus_(s, campus), m = months && typeof months === 'object' ? months : {}, out = {};
  Object.keys(m).slice(0, 36).forEach(function (k) {
    if (!finYm_(k)) return;
    const v = m[k] || {}, blank = function (x) { return x === '' || x == null; };
    const inc = blank(v.inc) ? null : finiteNum_(v.inc, 0, 1e8), exp = blank(v.exp) ? null : finiteNum_(v.exp, 0, 1e8);
    if (inc == null && exp == null) return;
    out[k] = { inc: inc == null ? null : Math.round(inc), exp: exp == null ? null : Math.round(exp) };
  });
  await writeJSON('finProj:' + c, { months: out, updated: new Date().toISOString() });
  return finOut_(s, c, await getFinDoc_(c));
}

/* ==================== QuickBooks: the reports straight from the books ====================
   Oct 2026 (Uriah): "Can you build in interfaces where … this app can automatically connect
   to QuickBooks and pull numbers from QuickBooks directly into the finance teams … without
   having to put them in manually?"
   Two of the office's three reports come out of QuickBooks Online — the Profit and Loss and
   the A/R Ageing Summary — so once the Finances office connects their QuickBooks company
   (Intuit's own sign-in, OAuth 2.0), those two come in by themselves: every night
   (qbo-sync.js) and whenever the office presses "Bring the numbers in now". They land in the
   same finance:<campus> document an upload does, through the same code (finApplyPl_,
   finApplyDebt_), so the dashboard neither knows nor cares where they came from. The Burn
   Rate is the office's own spreadsheet, not QuickBooks', so it is still uploaded.
   - P&L: one report, a column a month, for the twelve finished months up to the end of last
     month, cash basis like theirs. Each month replaces the saved one (the cash in the bank
     typed for it stays); a month QuickBooks has nothing for is left alone. Its lines are
     checked against QuickBooks' own section totals the way a PDF's are; a mismatch is kept
     and shown to the office.
   - A/R Ageing: as of today, its names matched to staff exactly as an upload's are. Its
     history keeps one point a month (the latest), not one a night.
   - One campus, one connection. If both campuses keep their books in one QuickBooks company
     with a Location or a Class each, the office picks theirs and the P&L is that campus's
     alone. (The ageing report can't be split that way; the other campus's names just don't
     match anyone here, and the office can mark them "Not on staff".)
   SECRETS. The app's QuickBooks keys are QBO_CLIENT_ID and QBO_CLIENT_SECRET in Netlify's
   environment, never in source (the repo is public). QBO_ENV=sandbox points at Intuit's test
   companies. The tokens Intuit hands back live in a store of their own, 'gp-qbo' — not
   'gp-data', so the nightly backup never copies them — and never leave the server.
   Disconnecting revokes them at Intuit. Connecting is the office's alone (finCanEdit_): the
   state that comes back from Intuit is random, single-use, fifteen minutes long and tied
   to the person who asked, and they must still be in the office when it comes back. */
const QBO_AUTH = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_REVOKE = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const QBO_SCOPE = 'com.intuit.quickbooks.accounting';
const QBO_MINOR = '75';
const QBO_PL_MONTHS = 12, QBO_STATE_MS = 15 * 60 * 1000, QBO_MAX_LIST = 200;
const QBO_SECS = { Income: 'inc', OtherIncome: 'oth', COGS: 'exp', Expenses: 'exp', OtherExpenses: 'oexp' };
const QBO_MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function qboStore_() { return getStore({ name: 'gp-qbo', consistency: 'strong' }); }
function qboConfigured_() { return !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET); }
function qboApiBase_() { return process.env.QBO_ENV === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com'; }
/* Where Intuit sends the browser back: quickbooks.js. It has to be listed, exactly, on the
   Intuit app's Redirect URIs. */
function qboRedirect_() { return process.env.QBO_REDIRECT_URI || (String(process.env.URL || '').replace(/\/+$/, '') + '/.netlify/functions/quickbooks'); }
async function qboConn_(c) { const v = await qboStore_().get('conn:' + c, { type: 'json' }); return v && typeof v === 'object' && v.realmId ? v : null; }
async function qboPutConn_(c, v) { await qboStore_().setJSON('conn:' + c, v); }
function qboBasic_() { return 'Basic ' + Buffer.from(process.env.QBO_CLIENT_ID + ':' + process.env.QBO_CLIENT_SECRET).toString('base64'); }

async function qboToken_(params) {
  let r, j = null;
  try {
    r = await fetch(QBO_TOKEN, { method: 'POST', headers: { Authorization: qboBasic_(), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString() });
    try { j = await r.json(); } catch (e) { j = null; }
  } catch (e) { return { err: 'offline' }; }
  if (!r.ok || !j || !j.access_token || !j.refresh_token) return { err: (j && j.error === 'invalid_grant') ? 'reconnect' : 'token' };
  const now = Date.now();
  return { access: j.access_token, accessExp: now + (Number(j.expires_in) || 3600) * 1000,
    refresh: j.refresh_token, refreshExp: now + (Number(j.x_refresh_token_expires_in) || 100 * 86400) * 1000 };
}
async function qboRevoke_(token) {
  if (!token) return;
  try { await fetch(QBO_REVOKE, { method: 'POST', headers: { Authorization: qboBasic_(), Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) }); }
  catch (e) { /* gone from here either way; Intuit lets it lapse */ }
}
/* A good access token, refreshing it (and keeping the new refresh token straight away —
   Intuit may hand back a new one each time) when it is within two minutes of running out. */
async function qboAccess_(c, conn) {
  if (conn.access && conn.accessExp > Date.now() + 120000) return '';
  const tk = await qboToken_({ grant_type: 'refresh_token', refresh_token: conn.refresh });
  if (tk.err) { if (tk.err === 'reconnect') conn.broken = true; return tk.err; }
  Object.assign(conn, tk, { broken: false });
  await qboPutConn_(c, conn);
  return '';
}
async function qboGet_(c, conn, path, params) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const e = await qboAccess_(c, conn); if (e) return { err: e };
    const u = new URL(qboApiBase_() + '/v3/company/' + encodeURIComponent(conn.realmId) + path);
    Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
    u.searchParams.set('minorversion', QBO_MINOR);
    let r, j = null;
    try { r = await fetch(u.toString(), { headers: { Authorization: 'Bearer ' + conn.access, Accept: 'application/json' } }); try { j = await r.json(); } catch (x) { j = null; } }
    catch (x) { return { err: 'offline' }; }
    if (r.status === 401 && attempt === 0) { conn.accessExp = 0; continue; }   // revoked early — refresh once
    if (!r.ok || !j) return { err: r.status === 401 ? 'reconnect' : r.status === 429 ? 'busy' : 'quickbooks' };
    return { data: j };
  }
  return { err: 'reconnect' };
}

/* ---- reading QuickBooks' report JSON ---- */
function qboNum_(v) { if (v === '' || v == null) return null; const n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? Math.round(n * 100) / 100 : null; }
/* Which of a report's columns are months ('YYYY-MM'), from their StartDate/EndDate, or
   their title ("Jan 2026") when there is none; '' for the account and Total columns. */
function qboMonthCols_(rep) {
  return ((rep && rep.Columns && rep.Columns.Column) || []).map(function (col) {
    const meta = {}; (col && col.MetaData || []).forEach(function (m) { if (m) meta[m.Name] = m.Value; });
    const sd = isoDate_(meta.StartDate), ed = isoDate_(meta.EndDate);
    if (sd && ed) return sd.slice(0, 7) === ed.slice(0, 7) && sd.slice(8) === '01' ? sd.slice(0, 7) : '';
    const m = /^([A-Za-z]{3,9})\.?\s+(\d{4})$/.exec(String((col && col.ColTitle) || '').trim());
    const mi = m ? QBO_MON.indexOf(m[1].slice(0, 3).toLowerCase()) : -1;
    return mi > -1 ? m[2] + '-' + ('0' + (mi + 1)).slice(-2) : '';
  });
}
/* The P&L by month → { months, lines: [{ sec, code, name, parent, amt: { ym: n } }], checks }
   — the shape finance.js reads out of a PDF. A heading account (a Section with a Header) is
   a line of its own, its sub-accounts carry it as parent; its own amount, when QuickBooks
   gives it as a row of the same name inside, is its. */
function qboPlFromReport_(rep) {
  const ym = qboMonthCols_(rep), reported = {}, lines = [];
  const amts = function (cd) { const a = {}; (cd || []).forEach(function (x, i) { if (ym[i]) { const n = qboNum_(x && x.value); if (n !== null) a[ym[i]] = n; } }); return a; };
  const label = function (cd) { return String((cd && cd[0] && cd[0].value) || '').trim().slice(0, 120); };
  const line = function (sec, lab, amt, head) {
    const mc = /^(\d{3,6})\s+(.+)$/.exec(lab);
    const l = { sec: sec, code: mc ? mc[1] : '', name: mc ? mc[2] : lab, parent: head ? (head.code || head.name) : '', amt: amt, lab: lab };
    lines.push(l); return l;
  };
  const walk = function (rows, sec, head, depth) {
    if (depth > 8) return;
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (r.Header || r.Rows) {
        const lab = label(r.Header && r.Header.ColData);
        if (!lab) { walk(r.Rows && r.Rows.Row, sec, head, depth + 1); return; }
        walk(r.Rows && r.Rows.Row, sec, line(sec, lab, amts(r.Header.ColData), head), depth + 1);
        return;
      }
      const lab = label(r.ColData); if (!lab) return;
      const a = amts(r.ColData);
      if (head && lab === head.lab) { Object.keys(a).forEach(function (k) { head.amt[k] = Math.round(((head.amt[k] || 0) + a[k]) * 100) / 100; }); return; }
      line(sec, lab, a, head);
    });
  };
  ((rep && rep.Rows && rep.Rows.Row) || []).forEach(function (top) {
    const sec = top && QBO_SECS[top.group]; if (!sec) return;
    walk(top.Rows && top.Rows.Row, sec, null, 0);
    const t = amts(top.Summary && top.Summary.ColData);
    reported[sec] = reported[sec] || {};
    Object.keys(t).forEach(function (k) { reported[sec][k] = Math.round(((reported[sec][k] || 0) + t[k]) * 100) / 100; });
  });
  lines.forEach(function (l) { delete l.lab; });
  // a month counts once QuickBooks has anything in it
  const months = ym.filter(function (k, i) { return k && ym.indexOf(k) === i && lines.some(function (l) { return l.amt[k]; }); });
  const checks = [];
  months.forEach(function (k) {
    Object.keys(reported).forEach(function (sec) {
      const ours = Math.round(lines.reduce(function (s, l) { return s + (l.sec === sec && l.amt[k] ? l.amt[k] : 0); }, 0) * 100) / 100;
      const theirs = reported[sec][k] == null ? 0 : reported[sec][k];
      checks.push({ month: k, sec: sec, ours: ours, theirs: theirs, ok: Math.abs(ours - theirs) < 0.015 });
    });
  });
  return { months: months, lines: lines, checks: checks };
}
/* The A/R Ageing Summary → { cols, rows: [{ name, vals, total }] }: every customer row (a
   sub-customer's too), the ageing columns as QuickBooks titles them, without Total. */
function qboDebtFromReport_(rep) {
  const titles = ((rep && rep.Columns && rep.Columns.Column) || []).map(function (c) { return String((c && c.ColTitle) || '').trim(); });
  const totalAt = titles.findIndex(function (t, i) { return i > 0 && /^total$/i.test(t); });
  const idx = []; for (let i = 1; i < titles.length; i++) if (i !== totalAt) idx.push(i);
  const rows = [];
  const walk = function (list, depth) {
    if (depth > 6) return;
    (Array.isArray(list) ? list : []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (r.Rows) { walk(r.Rows.Row, depth + 1); return; }
      if (!Array.isArray(r.ColData)) return;
      const name = String((r.ColData[0] && r.ColData[0].value) || '').trim();
      if (!name || /^total\b/i.test(name)) return;
      const vals = idx.map(function (i) { return qboNum_(r.ColData[i] && r.ColData[i].value) || 0; });
      const sum = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) * 100) / 100;
      const total = totalAt > -1 ? qboNum_(r.ColData[totalAt] && r.ColData[totalAt].value) : sum;
      if (!total && !vals.some(Boolean)) return;
      rows.push({ name: name.slice(0, 80), vals: vals, total: total == null ? sum : total });
    });
  };
  walk(rep && rep.Rows && rep.Rows.Row, 0);
  return { cols: idx.map(function (i) { return titles[i].slice(0, 40) || '—'; }).slice(0, 8), rows: rows };
}
function qboList_(data, kind) {
  const list = (data && data.QueryResponse && data.QueryResponse[kind]) || [];
  return (Array.isArray(list) ? list : []).slice(0, QBO_MAX_LIST).map(function (x) {
    return { id: String((x && x.Id) || '').slice(0, 30), name: String((x && (x.FullyQualifiedName || x.Name)) || '').slice(0, 120) };
  }).filter(function (x) { return x.id && x.name; });
}

/* ---- bringing the numbers in ---- */
function qboMonthBack_(ym, n) { let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - n; while (m < 1) { m += 12; y--; } return y + '-' + ('0' + m).slice(-2); }
async function qboSyncInner_(c, conn, by) {
  const today = baseToday_(), last = qboMonthBack_(today.slice(0, 7), 1), first = qboMonthBack_(today.slice(0, 7), QBO_PL_MONTHS);
  const lastDay = new Date(Date.UTC(Number(last.slice(0, 4)), Number(last.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const plq = { start_date: first + '-01', end_date: lastDay, summarize_column_by: 'Month', accounting_method: 'Cash' };
  if (conn.filter && conn.filter.id) plq[conn.filter.type === 'class' ? 'class' : 'department'] = conn.filter.id;
  const pl = await qboGet_(c, conn, '/reports/ProfitAndLoss', plq); if (pl.err) return { ok: false, err: pl.err };
  const ar = await qboGet_(c, conn, '/reports/AgedReceivables', { report_date: today }); if (ar.err) return { ok: false, err: ar.err };
  // the Locations and Classes, for the office to say which is theirs (not needed for the numbers)
  const lc = await qboGet_(c, conn, '/query', { query: 'select * from Department where Active = true maxresults ' + QBO_MAX_LIST });
  const cl = await qboGet_(c, conn, '/query', { query: 'select * from Class where Active = true maxresults ' + QBO_MAX_LIST });
  conn.lists = { department: lc.data ? qboList_(lc.data, 'Department') : ((conn.lists && conn.lists.department) || []),
    'class': cl.data ? qboList_(cl.data, 'Class') : ((conn.lists && conn.lists['class']) || []) };

  const P = qboPlFromReport_(pl.data), D = qboDebtFromReport_(ar.data);
  const d = await getFinDoc_(c), now = new Date().toISOString(), clean = {};
  for (const k of P.months) {
    const lines = finCleanLines_(P.lines.map(function (l) { return { sec: l.sec, code: l.code, name: l.name, parent: l.parent, amt: l.amt[k] == null ? null : l.amt[k] }; }));
    if (!lines) return { ok: false, err: 'too_big' };
    clean[k] = { lines: lines, cash: null };
  }
  const old = finApplyPl_(d, clean, { id: '', name: '' }, by, now, 'qbo');
  await writeJSON(finKey_(c), d);
  for (const id of old) await finDropFile_(d, id);
  if (D.cols.length && D.rows.length <= FIN_MAX_DEBT_ROWS) {
    const r = await finApplyDebt_(c, d, today, D.cols, D.rows, null, by, 'qbo');
    if (!r.ok) return r;
  } else if (D.cols.length) return { ok: false, err: 'too_big' };
  return { ok: true, months: P.months.length, people: D.rows.length,
    warn: P.checks.filter(function (x) { return !x.ok; }).slice(0, 12) };
}
async function qboSync_(c, by) {
  if (!qboConfigured_()) return { ok: false, err: 'not_configured' };
  const conn = await qboConn_(c);
  if (!conn) return { ok: false, err: 'not_connected' };
  let r;
  try { r = await qboSyncInner_(c, conn, by || conn.by); } catch (e) { r = { ok: false, err: 'quickbooks' }; }
  conn.lastTry = new Date().toISOString();
  if (r.ok) { conn.lastSync = conn.lastTry; conn.lastErr = ''; conn.warn = r.warn; conn.months = r.months; conn.people = r.people; }
  else conn.lastErr = r.err;
  await qboPutConn_(c, conn);
  return r;
}
/* What the page is told. The office: the whole picture, never a token. Leadership: only
   that the numbers come from QuickBooks, and when they last did. */
async function qboOut_(c, edit) {
  const conn = await qboConn_(c);
  if (!edit) return conn ? { connected: true, lastSync: conn.lastSync || '' } : null;
  const out = { configured: qboConfigured_(), connected: !!conn, sandbox: process.env.QBO_ENV === 'sandbox' };
  if (!conn) return out;
  const rows = await getStaff_();
  return Object.assign(out, { company: conn.company || '', at: conn.at || '', by: (personOut_(rows, conn.by) || {}).name || '',
    lastSync: conn.lastSync || '', lastTry: conn.lastTry || '', lastErr: conn.lastErr || '', broken: !!conn.broken,
    months: conn.months || 0, people: conn.people || 0, warn: Array.isArray(conn.warn) ? conn.warn : [],
    filter: conn.filter || null, lists: conn.lists || { department: [], 'class': [] } });
}

/* The office asks to connect: a fresh state, and the Intuit sign-in page to send them to. */
async function qboConnect(username, pin, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!finCanEdit_(s)) return { ok: false, err: 'not_authorized' };
  if (!qboConfigured_()) return { ok: false, err: 'not_configured' };
  const c = finCampus_(s, campus), state = crypto.randomBytes(24).toString('hex'), st = qboStore_(), now = Date.now();
  const states = (await st.get('states', { type: 'json' })) || {};
  Object.keys(states).forEach(function (k) { if (!(states[k] && states[k].exp > now)) delete states[k]; });
  states[state] = { staffId: s.id, campus: c, exp: now + QBO_STATE_MS };
  await st.setJSON('states', states);
  const u = new URL(QBO_AUTH);
  u.searchParams.set('client_id', process.env.QBO_CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', QBO_SCOPE);
  u.searchParams.set('redirect_uri', qboRedirect_());
  u.searchParams.set('state', state);
  return { ok: true, url: u.toString() };
}
/* Intuit sends the browser back here (quickbooks.js) with ?code&state&realmId — or ?error
   when they said no. The state must be one we gave out, unused and in time, and its person
   still in the office. Then the code becomes tokens, the company's name is fetched, and the
   numbers come in straight away. */
async function qboCallback(q) {
  q = q || {};
  if (!qboConfigured_()) return { ok: false, err: 'not_configured' };
  const st = qboStore_(), now = Date.now(), key = String(q.state || '');
  const states = (await st.get('states', { type: 'json' })) || {};
  const rec = /^[0-9a-f]{48}$/.test(key) && Object.prototype.hasOwnProperty.call(states, key) ? states[key] : null;
  if (rec) delete states[key];
  Object.keys(states).forEach(function (k) { if (!(states[k] && states[k].exp > now)) delete states[k]; });
  await st.setJSON('states', states);
  if (!rec || !(rec.exp > now)) return { ok: false, err: 'expired' };
  if (q.error) return { ok: false, err: q.error === 'access_denied' ? 'denied' : 'intuit' };
  const realmId = /^\d{1,30}$/.test(String(q.realmId || '')) ? String(q.realmId) : '';
  const code = str_(q.code, 4000);
  if (!realmId || !code) return { ok: false, err: 'bad_request' };
  const rows = await getStaff_();
  const s = rows.filter(function (p) { return p.id === rec.staffId && p.active && !isApplicant_(p); })[0];
  if (!s || !finCanEdit_(s) || HR_CAMPUSES.indexOf(rec.campus) === -1) return { ok: false, err: 'not_authorized' };
  const tk = await qboToken_({ grant_type: 'authorization_code', code: code, redirect_uri: qboRedirect_() });
  if (tk.err) return { ok: false, err: 'token' };
  const old = await qboConn_(rec.campus);
  if (old && old.refresh && old.refresh !== tk.refresh) await qboRevoke_(old.refresh);
  const conn = Object.assign({ realmId: realmId, company: '', by: s.id, at: new Date().toISOString(),
    filter: old && old.realmId === realmId ? old.filter || null : null, lists: null, broken: false }, tk);
  const info = await qboGet_(rec.campus, conn, '/companyinfo/' + realmId, {});
  if (info.data && info.data.CompanyInfo) conn.company = String(info.data.CompanyInfo.CompanyName || '').slice(0, 120);
  await qboPutConn_(rec.campus, conn);
  const r = await qboSync_(rec.campus, s.id);
  return { ok: true, company: conn.company, synced: !!r.ok, syncErr: r.err || '' };
}
async function qboOffice_(username, pin, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { err: { ok: false } };
  if (!finCanEdit_(s)) return { err: { ok: false, err: 'not_authorized' } };
  return { s: s, c: finCampus_(s, campus) };
}
async function qboSyncNow(username, pin, campus) {
  const o = await qboOffice_(username, pin, campus); if (o.err) return o.err;
  const r = await qboSync_(o.c, o.s.id);
  const out = await finOut_(o.s, o.c, await getFinDoc_(o.c));
  out.synced = !!r.ok; out.syncErr = r.err || '';
  return out;
}
/* Which Location or Class is this campus's ('' type = the whole company). The numbers come
   in again at once, so the dashboard follows. */
async function qboSetFilter(username, pin, type, id, campus) {
  const o = await qboOffice_(username, pin, campus); if (o.err) return o.err;
  const conn = await qboConn_(o.c);
  if (!conn) return { ok: false, err: 'not_connected' };
  if (!type) conn.filter = null;
  else {
    const hit = (type === 'department' || type === 'class') ? ((conn.lists && conn.lists[type]) || []).filter(function (x) { return x.id === String(id); })[0] : null;
    if (!hit) return { ok: false, err: 'not_found' };
    conn.filter = { type: type, id: hit.id, name: hit.name };
  }
  await qboPutConn_(o.c, conn);
  return qboSyncNow(username, pin, campus);
}
/* Stop: Intuit is told, the tokens go. What already came in stays — it is the office's
   numbers now, like an upload's. */
async function qboDisconnect(username, pin, campus) {
  const o = await qboOffice_(username, pin, campus); if (o.err) return o.err;
  const conn = await qboConn_(o.c);
  if (conn) {
    await qboRevoke_(conn.refresh);
    const st = qboStore_();
    if (typeof st.delete === 'function') await st.delete('conn:' + o.c); else await st.setJSON('conn:' + o.c, {});
  }
  return finOut_(o.s, o.c, await getFinDoc_(o.c));
}
/* Every night (qbo-sync.js): each campus that is connected. */
async function runQboSync() {
  const out = {};
  if (!qboConfigured_()) return { skipped: 'not_configured' };
  for (const c of HR_CAMPUSES) {
    if (!(await qboConn_(c))) continue;
    const r = await qboSync_(c, '');
    out[c] = r.ok ? { ok: true, months: r.months, people: r.people, warn: (r.warn || []).length } : { ok: false, err: r.err };
  }
  return out;
}

async function ministryDataFor_(s) {
  const d = await ministryDataFor2_(s.campus, s.dept, s.ministry);
  d.pins = Array.isArray(s.kpiPins) ? s.kpiPins : [];
  return d;
}

async function getMyMinistry(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  return withNumbers_(await ministryDataFor_(s), s);
}

/* Who sees and enters a ministry's numbers on My Ministry: the people IN it.
   That is your main ministry, the other ministries on your profile
   (ministriesOf_), a ministry you lead, and — for a department's own
   "Campus Leadership" overseer (dept:'Campus Leadership', ministry: e.g.
   'Community Service') — every ministry under that department. An admin
   may open (and enter) any ministry on their own campus: everyone else's
   picker shows only the ministries they are part of, an admin's has every
   one, in a Department / Ministry dropdown. */
function canLogFor_(s, campus, dept, ministry) {
  if (campus !== s.campus) return false;
  if (s.isAdmin) return true;
  if (memberOf_(s, dept, ministry)) return true;
  if (isLeaderOf_(s, dept, ministry)) return true;
  return s.dept === 'Campus Leadership' && s.ministry === dept;
}

async function getMinistryFor(username, pin, dept, ministry) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canLogFor_(s, s.campus, dept, ministry)) return { ok: false, err: 'not_authorized' };
  return withNumbers_(await ministryDataFor2_(s.campus, dept, ministry), s);
}

/* A score is 1–10 and a percentage 0–100; anything else would be a typo that
   drags an average for the rest of the year (a 70 for a 7). Mirrors kpiRange in
   public/taxonomy.js. Outreach Teams is left exactly as it is — its numbers are
   run from the Teams Database and work as they are. */
function kpiRange_(metric) {
  if (metric.indexOf('(1-10)') > -1) return { min: 1, max: 10 };
  if (metric.indexOf('(%)') > -1) return { min: 0, max: 100 };
  return null;
}
function kpiOutOfRange_(ministry, metric, value) {
  if (ministry === 'Outreach Teams') return false;
  const r = kpiRange_(metric);
  return !!r && (value < r.min || value > r.max);
}

/* `year` is passed when the caller knows it (a tool syncing a dated week, or this
   week); a week from the page goes through yearForWeek_. */
async function saveMinistryInternal_(campus, dept, ministry, week, updates, by, year) {
  const wk = finiteNum_(week, 1, 52);
  if (wk == null) return { ok: false, err: 'bad_week' };
  const rows = await getEntries_();
  const now = new Date().toISOString();
  const yr = finiteNum_(year, YEAR_MIN, YEAR_MAX) || yearForWeek_(wk);
  const rejected = [];
  (Array.isArray(updates) ? updates : []).forEach(function (u) {
    const metric = str_(u && u.metric, 80);
    if (!metric || SENSITIVE.indexOf(metric) > -1) return;
    const idx = rows.findIndex(function (r) {
      return r.campus === campus && r.dept === dept && r.ministry === ministry &&
        r.metric === metric && String(r.week) === String(wk) && yearOf_(r) === yr;
    });
    if (u.value === null || u.value === '' || u.value === undefined) {
      if (idx > -1) rows.splice(idx, 1);
      return;
    }
    const value = finiteNum_(u.value, -1e9, 1e9);
    if (value == null) return;
    if (kpiOutOfRange_(ministry, metric, value)) { rejected.push(metric); return; }
    /* who typed it, for "last entered by" on My Ministry */
    if (idx > -1) { rows[idx].value = value; rows[idx].updated = now; if (by) rows[idx].by = by; }
    else rows.push(Object.assign({ campus: campus, dept: dept, ministry: ministry, metric: metric, week: wk, year: yr, value: value, updated: now }, by ? { by: by } : {}));
  });
  await writeJSON('entries', rows);
  return { ok: true, rejected: rejected };
}

async function saveMyMinistry(username, pin, week, updates) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!s.ministry) return { ok: false, err: 'no_ministry' };
  const saved = await saveMinistryInternal_(s.campus, s.dept, s.ministry, week, updates, s.id);
  const out = await getMyMinistry(username, pin);
  if (out && saved && saved.rejected && saved.rejected.length) out.rejected = saved.rejected;
  return out;
}

async function saveMinistryFor(username, pin, dept, ministry, week, updates) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canLogFor_(s, s.campus, dept, ministry)) return { ok: false, err: 'not_authorized' };
  const saved = await saveMinistryInternal_(s.campus, dept, ministry, week, updates, s.id);
  const out = await getMinistryFor(username, pin, dept, ministry);
  if (out && saved && saved.rejected && saved.rejected.length) out.rejected = saved.rejected;
  return out;
}

/* ==================== ministry metric overrides ====================
   Not every ministry tracks the same things — Cafe cares about cups sold,
   Outreach Teams doesn't. getDepartments() in taxonomy.js still holds the
   starting list per ministry; this is the per-(campus,dept,ministry) diff
   from it: baseline metrics a ministry has turned off, and metrics it added
   of its own. Both pages merge this into getDepartments() before rendering,
   so nothing downstream (the dashboard, My Ministry, the OKR metric picker)
   needs to know overrides exist at all.

   A custom name is expected to carry its own aggregation the same way every
   built-in metric already does — end it "(1-10)" for an average or "(%)"
   for a percentage, plain otherwise for a running total — so modeOf() picks
   it up with no new code. Only Base Finances/Cash Reserve are off limits:
   those two names are how getData() decides what a non-leader may never
   see, and a custom metric reusing one would be silently swallowed by that
   same filter, not a way around it — but the confusion isn't worth having,
   so it's refused outright. */
const MAX_CUSTOM_METRICS = 25;
const MAX_HIDDEN_METRICS = 60;

/* Logging a number and changing what gets logged are two different rights.
   Everyone on a ministry logs its numbers (canLogFor_); only an admin, the
   campus leadership department, or that ministry's own assigned leader
   changes its metric list or cadence. A ministry's ordinary staff used to be
   able to hide and add metrics too — Uriah asked for that to sit with the
   leader position instead, so the list someone logs against can't quietly
   change under the whole team. */
function canEditMetrics_(s, campus, dept, ministry) {
  if (s.isAdmin) return true;
  if (campus !== s.campus) return false;
  return isLeadership_(s) || isLeaderOf_(s, dept, ministry);
}

const CADENCE_VALUES = ['month', 'quarter'];

async function saveMetricOverrides(username, pin, campus, dept, ministry, hidden, custom, cadence) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  campus = str_(campus, 40); dept = str_(dept, 80); ministry = str_(ministry, 80);
  if (!campus || !dept || !ministry) return { ok: false, err: 'bad_target' };
  if (!canEditMetrics_(s, campus, dept, ministry)) return { ok: false, err: 'not_authorized' };

  const cleanHidden = (Array.isArray(hidden) ? hidden : [])
    .map(function (m) { return str_(m, 80); }).filter(Boolean).slice(0, MAX_HIDDEN_METRICS);
  const cleanCustom = [];
  (Array.isArray(custom) ? custom : []).forEach(function (m) {
    const name = str_(m, 80);
    if (!name || SENSITIVE.indexOf(name) > -1) return;
    if (cleanCustom.indexOf(name) === -1) cleanCustom.push(name);
  });
  if (cleanCustom.length > MAX_CUSTOM_METRICS) return { ok: false, err: 'too_many' };

  const rows = await getMetricOverrides_();
  const idx = rows.findIndex(function (r) { return r.campus === campus && r.dept === dept && r.ministry === ministry; });
  const existing = idx > -1 ? rows[idx] : null;

  // Cadence (weekly → monthly/quarterly) takes the same right as hiding or
  // adding a metric (canEditMetrics_ above) — untouched (cadence omitted)
  // just keeps whatever is already stored.
  let cleanCadence = (existing && existing.cadence) || {};
  if (cadence !== undefined && cadence !== null) {
    const nextCadence = {};
    Object.keys(cadence).forEach(function (m) {
      const name = str_(m, 80);
      const val = cadence[m];
      if (name && CADENCE_VALUES.indexOf(val) > -1) nextCadence[name] = val;
    });
    cleanCadence = nextCadence;
  }

  const rec = { campus: campus, dept: dept, ministry: ministry, hidden: cleanHidden, custom: cleanCustom, cadence: cleanCadence, updated: new Date().toISOString() };
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('metricOverrides', rows);
  return { ok: true, metricOverrides: rows };
}

/* Renaming a metric the ministry added itself. The name is the join key for
   every number ever logged under it (see the note at the top of taxonomy.js),
   so a rename that only touched the list would orphan the ministry's own
   history — the numbers, the day-by-day rows behind them, and any key result
   pointing at the metric all move with the name. Baseline metrics can't be
   renamed here: they belong to the shared taxonomy, not to one ministry. */
async function renameCustomMetric(username, pin, campus, dept, ministry, oldName, newName) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  campus = str_(campus, 40); dept = str_(dept, 80); ministry = str_(ministry, 80);
  oldName = str_(oldName, 80); newName = str_(newName, 80);
  if (!campus || !dept || !ministry || !oldName || !newName) return { ok: false, err: 'bad_target' };
  if (!canEditMetrics_(s, campus, dept, ministry)) return { ok: false, err: 'not_authorized' };
  if (SENSITIVE.indexOf(newName) > -1) return { ok: false, err: 'reserved' };

  const rows = await getMetricOverrides_();
  const idx = rows.findIndex(function (r) { return r.campus === campus && r.dept === dept && r.ministry === ministry; });
  const rec = idx > -1 ? rows[idx] : null;
  if (!rec || (rec.custom || []).indexOf(oldName) === -1) return { ok: false, err: 'not_custom' };
  if (newName === oldName) return { ok: true, metricOverrides: rows, moved: 0 };
  if ((rec.custom || []).indexOf(newName) > -1) return { ok: false, err: 'exists' };

  const now = new Date().toISOString();
  rec.custom = rec.custom.map(function (m) { return m === oldName ? newName : m; });
  if (rec.cadence && rec.cadence[oldName]) { rec.cadence[newName] = rec.cadence[oldName]; delete rec.cadence[oldName]; }
  rec.updated = now;
  await writeJSON('metricOverrides', rows);

  const same = function (r) { return r.campus === campus && r.dept === dept && r.ministry === ministry && r.metric === oldName; };
  let moved = 0;
  const entries = await getEntries_();
  entries.forEach(function (r) { if (same(r)) { r.metric = newName; r.updated = now; moved++; } });
  if (moved) await writeJSON('entries', entries);
  let movedDays = 0;
  const daily = await getKpiDaily_();
  daily.forEach(function (r) { if (same(r)) { r.metric = newName; movedDays++; } });
  if (movedDays) await writeJSON('kpiDaily', daily);
  // The okrs blob is one row per key result (see saveObjective), so the
  // metric key sits on the row itself.
  const oldKey = dept + '|' + ministry + '|' + oldName, newKey = dept + '|' + ministry + '|' + newName;
  let movedKrs = 0;
  const okrs = await getOkrs_();
  okrs.forEach(function (o) {
    if (o.campus === campus && o.metricKey === oldKey) { o.metricKey = newKey; movedKrs++; }
  });
  if (movedKrs) await writeJSON('okrs', okrs);
  return { ok: true, metricOverrides: rows, moved: moved };
}

/* ==================== personal metrics ====================
   A staff member's own week — how many people they shared their faith with,
   encouraged, met one-on-one, how many teachings they prepped — separate from
   the ministry's numbers, which belong to the team. Keyed by the person, so
   these never reach the dashboard or anyone else's page. Four fixed metrics
   for now (the client owns the list); the store doesn't care which names it
   is handed, so the list can grow without a migration. */
async function getPersonalRows_() { return readJSON('personalKpi', []); }
function personalOut_(rows, staffId) {
  const yr = thisWeekYear_();
  const out = {};
  rows.forEach(function (r) {
    if (r.staffId !== staffId || yearOf_(r) !== yr) return;
    if (!out[r.metric]) out[r.metric] = {};
    out[r.metric][String(r.week)] = Number(r.value);
  });
  return { ok: true, entries: out };
}
async function getMyPersonal(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  return personalOut_(await getPersonalRows_(), s.id);
}
async function saveMyPersonalWeek(username, pin, week, updates) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const wk = finiteNum_(week, 1, 52);
  if (wk == null) return { ok: false, err: 'bad_week' };
  const rows = await getPersonalRows_();
  const now = new Date().toISOString();
  const yr = yearForWeek_(wk);
  (Array.isArray(updates) ? updates : []).forEach(function (u) {
    const metric = str_(u && u.metric, 80);
    if (!metric) return;
    const idx = rows.findIndex(function (r) {
      return r.staffId === s.id && r.metric === metric && Number(r.week) === wk && yearOf_(r) === yr;
    });
    if (u.value === null || u.value === '' || u.value === undefined) {
      if (idx > -1) rows.splice(idx, 1);
      return;
    }
    const value = finiteNum_(u.value, -1e9, 1e9);
    if (value == null) return;
    if (idx > -1) { rows[idx].value = value; rows[idx].updated = now; }
    else rows.push({ staffId: s.id, metric: metric, week: wk, year: yr, value: value, updated: now });
  });
  await writeJSON('personalKpi', rows);
  return personalOut_(rows, s.id);
}

/* ==================== ministry KPIs, logged day by day ====================
   Staff asked to stop entering a weekly figure on top of daily work. So the
   day is what gets typed, and the week's number in `entries` — the one the
   dashboard reads — is recomputed from those days. One place to enter, and
   the weekly total follows.

   Daily rows live in their own blob so a correction to Tuesday just changes
   Tuesday. The weekly figure is always derived, never typed twice.

   Aggregation has to match how the dashboard reads each metric, and that rule
   (sum / latest / avg) lives in the frontend taxonomy, so the client sends it
   and the server validates it's one of the three. Worst case a wrong mode
   misaggregates that ministry's own metric — it can't reach anything else. */
const KPI_MODES = ['sum', 'latest', 'avg'];

async function getKpiDaily_() { return normRows_(await readJSON('kpiDaily', [])); }

function rollUpKpi_(dayRows, mode) {
  const vals = dayRows.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  if (!vals.length) return null;
  if (mode === 'latest') return Number(vals[vals.length - 1].value);
  const nums = vals.map(function (r) { return Number(r.value) || 0; });
  if (mode === 'avg') return Math.round((nums.reduce(function (a, b) { return a + b; }, 0) / nums.length) * 10) / 10;
  return nums.reduce(function (a, b) { return a + b; }, 0);
}

async function saveKpiDayInternal_(campus, dept, ministry, dateStr, updates, staffId) {
  const date = str_(dateStr, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, err: 'bad_date' };
  const wk = isoWeek_(date);
  /* The days themselves are dated, so the week they roll into belongs to the year
     that week is in — not to whatever year it happens to be when this runs, and
     not to the date's own calendar year either: 30 December 2026 is week 1 of 2027. */
  const dayYear = weekYear_(date) || thisWeekYear_();

  const daily = await getKpiDaily_();
  const touched = {};
  (Array.isArray(updates) ? updates : []).forEach(function (u) {
    const metric = str_(u && u.metric, 80);
    if (!metric || SENSITIVE.indexOf(metric) > -1) return;
    const mode = KPI_MODES.indexOf(u && u.mode) > -1 ? u.mode : 'sum';
    touched[metric] = mode;
    const idx = daily.findIndex(function (r) {
      return r.campus === campus && r.dept === dept && r.ministry === ministry &&
        r.metric === metric && r.date === date;
    });
    if (u.value === null || u.value === '' || u.value === undefined) {
      if (idx > -1) daily.splice(idx, 1);
      return;
    }
    const value = finiteNum_(u.value, -1e9, 1e9);
    if (value == null) return;
    if (kpiOutOfRange_(ministry, metric, value)) { delete touched[metric]; return; }
    const rec = {
      campus: campus, dept: dept, ministry: ministry, metric: metric,
      date: date, week: wk, year: dayYear,
      value: value, staffId: staffId, updated: new Date().toISOString()
    };
    if (idx > -1) daily[idx] = rec; else daily.push(rec);
  });
  await writeJSON('kpiDaily', daily);

  // Push the derived weekly totals into the shared entries the dashboard reads.
  const entries = await getEntries_();
  const now = new Date().toISOString();
  Object.keys(touched).forEach(function (metric) {
    const days = daily.filter(function (r) {
      return r.campus === campus && r.dept === dept && r.ministry === ministry &&
        r.metric === metric && Number(r.week) === wk && yearOf_(r) === dayYear;
    });
    const total = rollUpKpi_(days, touched[metric]);
    const ei = entries.findIndex(function (r) {
      return r.campus === campus && r.dept === dept && r.ministry === ministry &&
        r.metric === metric && String(r.week) === String(wk) && yearOf_(r) === dayYear;
    });
    if (total === null) { if (ei > -1) entries.splice(ei, 1); return; }
    if (ei > -1) { entries[ei].value = total; entries[ei].updated = now; if (staffId) entries[ei].by = staffId; }
    else entries.push(Object.assign({ campus: campus, dept: dept, ministry: ministry, metric: metric, week: wk, year: dayYear, value: total, updated: now }, staffId ? { by: staffId } : {}));
  });
  await writeJSON('entries', entries);
  return { ok: true };
}

async function saveMyKpiDay(username, pin, dateStr, updates) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!s.ministry) return { ok: false, err: 'no_ministry' };
  await saveKpiDayInternal_(s.campus, s.dept, s.ministry, dateStr, updates, s.id);
  return getMyMinistry(username, pin);
}

async function saveKpiDayFor(username, pin, dept, ministry, dateStr, updates) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canLogFor_(s, s.campus, dept, ministry)) return { ok: false, err: 'not_authorized' };
  await saveKpiDayInternal_(s.campus, dept, ministry, dateStr, updates, s.id);
  return getMinistryFor(username, pin, dept, ministry);
}

/* ==================== leave request ====================
   Staff request days off base and what for, and it doubles as the check-in
   with their mentor: if they have an approved mentor the request lands as
   'pending' for that mentor to acknowledge; if they don't, it's simply
   'noted' so nobody is blocked from recording their own days by not having a
   mentor.

   Three types, matching UofN Cambodia's own leave categories: Personal Time
   Off is capped at 30 work days a year (checked client-side as a heads-up,
   not enforced here — a mentor can still approve an over-cap request), while
   Working Outside Siem Reap and Special Condition are tracked but uncapped.

   Legacy rows written before this shipped only have `kind` ('work'/
   'personal') — leaveTypeOf_ maps those onto the new types so old data still
   reads sensibly instead of vanishing.

   Work days are Monday–Friday only, matching how the allowance is actually
   spent; `days` (whole calendar days, inclusive) is kept alongside for any
   older row that only has that. */
const LEAVE_TYPES = ['outside', 'special', 'personal'];
const PTO_ANNUAL_CAP = 30;
const MAX_TRIP_DAYS = 365;

/* ---- national holidays: the base is closed, so they are not work days ----
   Leave over a national holiday doesn't spend anyone's 30 days (nor count as
   working outside or special condition). Two come round on their own every
   year, the working week (Mon–Fri) each falls in: Khmer New Year (14 April)
   and Christmas (25 December). Pchum Ben follows the moon, so its dates are
   a list — HOLIDAY_DATED below until an admin edits it (Admin → Leave), then
   the 'holidays' blob. Work days are always counted from a request's dates
   with these taken out, never from the number stored when it was made, so
   changing a holiday puts every year on file right. */
const HOLIDAY_DATED = [
  { id: 'pb2024', name: 'Pchum Ben', from: '2024-10-01', to: '2024-10-03' },
  { id: 'pb2025', name: 'Pchum Ben', from: '2025-09-22', to: '2025-09-23' },
  { id: 'pb2026', name: 'Pchum Ben', from: '2026-10-12', to: '2026-10-14' }
];
const HOLIDAY_RULES = [{ id: 'kny', name: 'Khmer New Year', md: '04-14' }, { id: 'xmas', name: 'Christmas week', md: '12-25' }];
const HOLIDAY_MAX = 60;
let holidayCache_ = null;   // { dated, set } — refreshed by getTrips_ on every request that reads leave
function holidayWeek_(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));   // that week's Monday
  const mon = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 4);
  return { from: mon, to: d.toISOString().slice(0, 10) };
}
function holidaysFor_(year, dated) {
  const out = HOLIDAY_RULES.map(function (r) { return Object.assign({ id: r.id + year, name: r.name, rule: true }, holidayWeek_(year + '-' + r.md)); });
  (dated || HOLIDAY_DATED).forEach(function (h) { if (String(h.from).slice(0, 4) === String(year) || String(h.to).slice(0, 4) === String(year)) out.push(Object.assign({}, h)); });
  return out.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
}
function holidaySetFrom_(dated) {
  const set = {};
  const add = function (h) { for (let d = h.from; d <= h.to; d = addDays_(d, 1)) set[d] = h.name || 'Holiday'; };
  for (let y = 2020; y <= new Date().getUTCFullYear() + 3; y++) HOLIDAY_RULES.forEach(function (r) { add(Object.assign({ name: r.name }, holidayWeek_(y + '-' + r.md))); });
  (dated || HOLIDAY_DATED).forEach(add);
  return set;
}
function holidaySet_() { if (!holidayCache_) holidayCache_ = { dated: HOLIDAY_DATED, set: holidaySetFrom_(HOLIDAY_DATED) }; return holidayCache_.set; }
async function refreshHolidays_() {
  const dated = await readJSON('holidays', HOLIDAY_DATED);   // none saved yet: the defaults
  holidayCache_ = { dated: dated, set: holidaySetFrom_(dated) };
  return holidayCache_;
}
/* The holidays the leave page shows and counts with: last year to next. */
function holidayList_() {
  const y = new Date().getUTCFullYear(), dated = (holidayCache_ || { dated: HOLIDAY_DATED }).dated;
  return [y - 1, y, y + 1].reduce(function (acc, yr) { return acc.concat(holidaysFor_(yr, dated)); }, []);
}
function cleanHolidays_(list) {
  const out = [], used = {};
  (Array.isArray(list) ? list : []).slice(0, HOLIDAY_MAX).forEach(function (h) {
    h = h && typeof h === 'object' ? h : {};
    let from = isoDate_(h.from), to = isoDate_(h.to);
    const name = str_(h.name, 60);
    if (!from || !name) return;
    if (!to) to = from;
    if (to < from) { const x = from; from = to; to = x; }
    if (tripDays_(from, to) > 31) return;
    let id = String(h.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || ('h' + Math.random().toString(36).slice(2, 8));
    while (used[id]) id += 'x';
    used[id] = 1;
    out.push({ id: id, name: name, from: from, to: to });
  });
  return out.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
}
async function adminSaveHolidays(username, pin, list) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  await writeJSON('holidays', cleanHolidays_(list));
  await refreshHolidays_();
  return adminListTrips(username, pin);
}

async function getTrips_() { await refreshHolidays_(); return readJSON('trips', []); }

function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function tripDays_(from, to) {
  const a = new Date(from + 'T00:00:00Z'), b = new Date(to + 'T00:00:00Z');
  return Math.round((b - a) / 86400000) + 1;
}
function workDays_(from, to) {
  const a = new Date(from + 'T00:00:00Z'), b = new Date(to + 'T00:00:00Z'), hol = holidaySet_();
  let n = 0;
  for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !hol[d.toISOString().slice(0, 10)]) n++;
  }
  return n;
}
/* Work days for a request on file: from its dates, holidays out — the stored
   count only for a row too old to have dates. */
function tripWorkDays_(r) { return isDate_(r.from) && isDate_(r.to) ? workDays_(r.from, r.to) : (Number(r.workDays) || 0); }
function leaveTypeOf_(r) {
  if (LEAVE_TYPES.indexOf(r.type) > -1) return r.type;
  return r.kind === 'personal' ? 'personal' : 'outside';
}

/* Totals per calendar year, in work days, split by type. Declined requests
   never count; a request is attributed to the year it starts in so a New
   Year crossing lands in one place rather than being split. */
function awayTotals_(trips) {
  const out = {};
  trips.forEach(function (r) {
    if (r.status === 'declined') return;
    const year = String(r.from).slice(0, 4);
    if (!out[year]) out[year] = { outside: 0, special: 0, personal: 0, trips: 0 };
    out[year][leaveTypeOf_(r)] += tripWorkDays_(r);
    out[year].trips += 1;
  });
  return out;
}

function tripOut_(r) {
  return {
    id: r.id, from: r.from, to: r.to, days: r.days,
    type: leaveTypeOf_(r), workDays: tripWorkDays_(r),
    reason: r.reason || '', coverage: r.coverage || '',
    status: r.status, decidedAt: r.decidedAt || '', created: r.created || ''
  };
}

async function getMyTrips(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const mine = (await getTrips_()).filter(function (r) { return r.staffId === s.id; })
    .sort(function (a, b) { return a.from < b.from ? 1 : -1; });
  return {
    ok: true, trips: mine.map(tripOut_), totals: awayTotals_(mine), ptoCap: PTO_ANNUAL_CAP, holidays: holidayList_(),
    hasMentor: !!(s.mentorId && s.mentorStatus === 'approved')
  };
}

async function saveTrip(username, pin, trip) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const t = trip || {};
  if (!isDate_(t.from) || !isDate_(t.to)) return { ok: false, err: 'bad_dates' };
  if (t.to < t.from) return { ok: false, err: 'end_before_start' };
  const days = tripDays_(t.from, t.to);
  if (days < 1 || days > MAX_TRIP_DAYS) return { ok: false, err: 'bad_span' };
  const type = LEAVE_TYPES.indexOf(t.type) > -1 ? t.type : 'personal';

  const rows = await getTrips_();
  const now = new Date().toISOString();
  const mentored = !!(s.mentorId && s.mentorStatus === 'approved');
  const rec = {
    id: 'tr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    staffId: s.id, campus: s.campus,
    from: t.from, to: t.to, days: days, type: type, workDays: workDays_(t.from, t.to),
    reason: str_(t.reason, 500) || '', coverage: str_(t.coverage, 500) || '',
    mentorId: mentored ? s.mentorId : '',
    status: mentored ? 'pending' : 'noted',
    decidedBy: '', decidedAt: '',
    created: now, updated: now
  };
  rows.push(rec);
  await writeJSON('trips', rows);
  return getMyTrips(username, pin);
}

async function deleteTrip(username, pin, tripId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  let rows = await getTrips_();
  rows = rows.filter(function (r) { return !(r.id === tripId && r.staffId === s.id); });
  await writeJSON('trips', rows);
  return getMyTrips(username, pin);
}

/* Mentor side: the trips waiting on you, and each mentee's year to date. */
async function getTripRequests(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const trips = await getTrips_();
  const pending = trips.filter(function (r) { return r.mentorId === s.id && r.status === 'pending'; })
    .sort(function (a, b) { return a.from < b.from ? -1 : 1; })
    .map(function (r) {
      const who = staff.find(function (x) { return x.id === r.staffId; });
      return Object.assign(tripOut_(r), { staffId: r.staffId, name: who ? who.name : '—' });
    });
  return { ok: true, requests: pending };
}

async function respondToTrip(username, pin, tripId, approve) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getTrips_();
  const idx = rows.findIndex(function (r) { return r.id === tripId && r.mentorId === s.id; });
  if (idx === -1) return { ok: false, err: 'not_found' };
  rows[idx].status = approve ? 'approved' : 'declined';
  rows[idx].decidedBy = s.id;
  rows[idx].decidedAt = new Date().toISOString();
  rows[idx].updated = rows[idx].decidedAt;
  await writeJSON('trips', rows);
  return getTripRequests(username, pin);
}

/* Admin side: everyone's leave, both campuses, every year on file — each
   request with who asked, their campus and department and who their mentor
   is, plus each person's year-by-year totals. An admin may also decide a
   request that is still waiting (pending on a mentor, or 'noted' because
   the person has no mentor to ask) — the same fields a mentor's decision
   sets, so the person's own page reads it the same way. */
async function adminListTrips(username, pin) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const staff = await getStaff_();
  const byId = {}; staff.forEach(function (x) { byId[x.id] = x; });
  const trips = (await getTrips_()).slice().sort(function (a, b) { return a.from < b.from ? 1 : -1; });
  const totals = {};
  staff.forEach(function (x) { totals[x.id] = awayTotals_(trips.filter(function (r) { return r.staffId === x.id; })); });
  return {
    ok: true, ptoCap: PTO_ANNUAL_CAP, holidays: holidayList_(), holidaysDated: (holidayCache_ || {}).dated || HOLIDAY_DATED,
    trips: trips.map(function (r) {
      const who = byId[r.staffId], mentor = r.mentorId ? byId[r.mentorId] : null;
      return Object.assign(tripOut_(r), {
        staffId: r.staffId, name: who ? who.name : '—', campus: who ? who.campus : (r.campus || ''), dept: who ? who.dept : '', ministry: who ? (who.ministry || '') : '',
        active: who ? (who.active !== false && !who.archived) : false,
        mentorName: mentor ? mentor.name : '', decidedBy: r.decidedBy ? ((byId[r.decidedBy] || {}).name || '') : ''
      });
    }),
    totals: totals
  };
}
async function adminDecideTrip(username, pin, tripId, approve) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const rows = await getTrips_();
  const idx = rows.findIndex(function (r) { return r.id === tripId; });
  if (idx === -1) return { ok: false, err: 'not_found' };
  if (rows[idx].status !== 'pending' && rows[idx].status !== 'noted') return { ok: false, err: 'already_decided' };
  rows[idx].status = approve ? 'approved' : 'declined';
  rows[idx].decidedBy = admin.id;
  rows[idx].decidedAt = new Date().toISOString();
  rows[idx].updated = rows[idx].decidedAt;
  await writeJSON('trips', rows);
  return adminListTrips(username, pin);
}

/* ==================== 1-on-1s ====================
   Either side of an approved mentor/mentee relationship can ask the other
   for a 1-on-1 — a mentor asking a mentee, or a mentee asking their mentor.
   Nothing here is tied to a calendar; it's a request-and-respond flow living
   next to the relationship itself.

   Oct 2026 (Uriah: "formalize one-on-ones just a little bit more"): each one
   carries the mentee's short check-in (`prep`: six areas of life and the five
   FIGHT values, 1-5, plus what they want help with and are working toward),
   and once it has happened the mentor marks it held (`heldOn`) with notes and
   things to follow up next time (`followUps`). Every mentee should have two a
   month — counted by `heldOn`. A mentor can also log one that happened without
   a request (`logOneOnOne`).

   Privacy: the check-in, notes and follow-ups are the pair's alone — the
   mentee always sees their own, the mentor only while they are still that
   person's approved mentor. Leadership only ever gets a count. */
const OO_AREAS = ['money', 'language', 'physical', 'emotional', 'relational', 'spiritual'];
const OO_VALUES = ['faithful', 'innovative', 'generous', 'humble', 'tenacious'];
const OO_PER_MONTH = 2;
async function getOneOnOnes_() { return readJSON('oneOnOnes', []); }

function ooText_(v, max) { return String(v == null ? '' : v).replace(/\s+$/g, '').trim().slice(0, max); }
function ooScores_(src, keys) {
  const out = {};
  keys.forEach(function (k) { const n = Number(src && src[k]); if (Number.isInteger(n) && n >= 1 && n <= 5) out[k] = n; });
  return out;
}
/* The mentee's check-in, cleaned. Null if there is nothing in it. */
function ooPrep_(p) {
  if (!p || typeof p !== 'object') return null;
  const out = { areas: ooScores_(p.areas, OO_AREAS), values: ooScores_(p.values, OO_VALUES),
    helpWith: ooText_(p.helpWith, 600), workingOn: ooText_(p.workingOn, 600), other: ooText_(p.other, 600) };
  const any = Object.keys(out.areas).length || Object.keys(out.values).length || out.helpWith || out.workingOn || out.other;
  if (!any) return null;
  out.at = new Date().toISOString();
  return out;
}
function ooFollowUps_(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 10).map(function (f) {
    const text = ooText_(f && typeof f === 'object' ? f.text : f, 200);
    return text ? { text: text, done: !!(f && f.done) } : null;
  }).filter(Boolean);
}
/* Which side of a row is the mentee. Rows from before Oct 2026 don't say, so
   it is read off the relationship as it stands. */
function ooMenteeOf_(r, staff) {
  if (r.menteeId) return r.menteeId;
  const from = staff.find(function (x) { return x.id === r.fromId; });
  return (from && from.mentorId === r.toId) ? r.fromId : r.toId;
}
function ooPairNow_(staff, mentorId, menteeId) {
  const m = staff.find(function (x) { return x.id === menteeId; });
  return !!(m && m.mentorId === mentorId && m.mentorStatus === 'approved');
}

async function getMyOneOnOnes(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const list = (await getOneOnOnes_())
    .filter(function (r) { return r.fromId === s.id || r.toId === s.id; })
    .map(function (r) {
      const mine = r.fromId === s.id;
      const otherId = mine ? r.toId : r.fromId;
      const who = staff.find(function (x) { return x.id === otherId; });
      const menteeId = ooMenteeOf_(r, staff), mentorId = menteeId === r.fromId ? r.toId : r.fromId;
      const out = {
        id: r.id, otherId: otherId, otherName: who ? who.name : '—', mine: mine,
        status: r.status, note: r.note || '', created: r.created, decidedAt: r.decidedAt || '',
        menteeId: menteeId, iMentor: mentorId === s.id, heldOn: r.heldOn || ''
      };
      /* the pair's own words: the mentee always, the mentor while still theirs */
      if (menteeId === s.id || ooPairNow_(staff, s.id, menteeId)) {
        out.prep = r.prep || null; out.notes = r.notes || ''; out.followUps = r.followUps || [];
      }
      return out;
    })
    .sort(function (a, b) { return (b.created || '') < (a.created || '') ? -1 : 1; });
  return { ok: true, oneOnOnes: list, perMonth: OO_PER_MONTH };
}

async function requestOneOnOne(username, pin, otherId, note, prep) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const other = staff.find(function (x) { return x.id === otherId; });
  if (!other) return { ok: false, err: 'not_found' };
  const isMentee = other.mentorId === s.id && other.mentorStatus === 'approved';
  const isMentor = s.mentorId === other.id && s.mentorStatus === 'approved';
  if (!isMentee && !isMentor) return { ok: false, err: 'not_mentor_pair' };
  const rows = await getOneOnOnes_();
  const now = new Date().toISOString();
  const row = {
    id: 'oo' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fromId: s.id, toId: otherId, note: str_(note, 300) || '', status: 'pending',
    created: now, updated: now, decidedAt: '', menteeId: isMentor ? s.id : otherId
  };
  /* only the mentee's own check-in rides along with a request */
  if (isMentor) { const pp = ooPrep_(prep); if (pp) row.prep = pp; }
  rows.push(row);
  await writeJSON('oneOnOnes', rows);
  return getMyOneOnOnes(username, pin);
}

async function respondToOneOnOne(username, pin, requestId, approve) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getOneOnOnes_();
  const idx = rows.findIndex(function (r) { return r.id === requestId && r.toId === s.id && r.status === 'pending'; });
  if (idx === -1) return { ok: false, err: 'not_found' };
  rows[idx].status = approve ? 'accepted' : 'declined';
  rows[idx].decidedAt = new Date().toISOString();
  rows[idx].updated = rows[idx].decidedAt;
  await writeJSON('oneOnOnes', rows);
  return getMyOneOnOnes(username, pin);
}

/* The mentee fills in (or updates) their check-in — any time before it is held. */
async function saveOneOnOnePrep(username, pin, id, prep) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const rows = await getOneOnOnes_();
  const r = rows.find(function (x) { return x.id === id && (x.fromId === s.id || x.toId === s.id); });
  if (!r || ooMenteeOf_(r, staff) !== s.id) return { ok: false, err: 'not_found' };
  if (r.status === 'declined' || r.status === 'held') return { ok: false, err: 'closed' };
  const pp = ooPrep_(prep);
  if (!pp) return { ok: false, err: 'empty' };
  r.prep = pp; r.menteeId = s.id; r.updated = pp.at;
  await writeJSON('oneOnOnes', rows);
  return getMyOneOnOnes(username, pin);
}

/* The mentor's side: notes, what to follow up next time, and — with `held` —
   the date it happened, which is what counts toward the two a month. */
function ooHeldOn_(v) {
  const d = String(v || '');
  if (!isDate_(d)) return null;
  const today = baseToday_();
  return d <= today && d >= String(Number(today.slice(0, 4)) - 1) + today.slice(4) ? d : null;
}
async function saveOneOnOneNotes(username, pin, id, notes, followUps, heldOn) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const rows = await getOneOnOnes_();
  const r = rows.find(function (x) { return x.id === id && (x.fromId === s.id || x.toId === s.id); });
  if (!r) return { ok: false, err: 'not_found' };
  const menteeId = ooMenteeOf_(r, staff);
  if (menteeId === s.id || !ooPairNow_(staff, s.id, menteeId)) return { ok: false, err: 'not_mentor' };
  if (r.status === 'declined') return { ok: false, err: 'closed' };
  if (heldOn) {
    const d = ooHeldOn_(heldOn);
    if (!d) return { ok: false, err: 'bad_date' };
    r.heldOn = d; r.status = 'held';
    if (!r.decidedAt) r.decidedAt = new Date().toISOString();
  }
  r.notes = ooText_(notes, 2000);
  r.followUps = ooFollowUps_(followUps);
  r.menteeId = menteeId; r.updated = new Date().toISOString();
  await writeJSON('oneOnOnes', rows);
  return getMyOneOnOnes(username, pin);
}

/* A 1-on-1 that happened without a request in the app — the mentor logs it. */
async function logOneOnOne(username, pin, menteeId, notes, followUps, heldOn) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  if (!ooPairNow_(staff, s.id, menteeId)) return { ok: false, err: 'not_mentor_pair' };
  const d = ooHeldOn_(heldOn || baseToday_());
  if (!d) return { ok: false, err: 'bad_date' };
  const rows = await getOneOnOnes_();
  const now = new Date().toISOString();
  rows.push({
    id: 'oo' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fromId: s.id, toId: menteeId, menteeId: menteeId, note: '', status: 'held',
    created: now, updated: now, decidedAt: now, heldOn: d,
    notes: ooText_(notes, 2000), followUps: ooFollowUps_(followUps)
  });
  await writeJSON('oneOnOnes', rows);
  return getMyOneOnOnes(username, pin);
}

/* Either of the pair ticks off a follow-up ("we said you'd…" — done). */
async function tickOneOnOneFollowUp(username, pin, id, index, done) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const rows = await getOneOnOnes_();
  const r = rows.find(function (x) { return x.id === id && (x.fromId === s.id || x.toId === s.id); });
  if (!r) return { ok: false, err: 'not_found' };
  const menteeId = ooMenteeOf_(r, staff);
  if (menteeId !== s.id && !ooPairNow_(staff, s.id, menteeId)) return { ok: false, err: 'not_found' };
  const i = Number(index);
  if (!Array.isArray(r.followUps) || !Number.isInteger(i) || !r.followUps[i]) return { ok: false, err: 'not_found' };
  r.followUps[i].done = !!done; r.updated = new Date().toISOString();
  await writeJSON('oneOnOnes', rows);
  return getMyOneOnOnes(username, pin);
}

/* ==================== admin broadcasts ====================
   A one-way announcement from an admin to every account — nothing to
   accept or decline, it just shows up in everyone's notification bell
   (folded into the same list as leave requests and 1-on-1s) until they
   clear it. Kept newest-first and capped so the store can't grow forever
   off of one very chatty admin. */
const MAX_BROADCASTS = 50;
async function getBroadcasts_() { return readJSON('broadcasts', []); }

async function getMyBroadcasts(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getBroadcasts_();
  return { ok: true, broadcasts: rows };
}

async function sendBroadcast(username, pin, text) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const clean = str_(text, 500);
  if (!clean) return { ok: false, err: 'empty' };
  const rows = await getBroadcasts_();
  rows.unshift({
    id: 'bc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: clean, from: admin.name, created: new Date().toISOString()
  });
  await writeJSON('broadcasts', rows.slice(0, MAX_BROADCASTS));
  return getMyBroadcasts(username, pin);
}

/* ==================== annual goals (SMART) ====================
   A personal, year-and-category list — not tied to any ministry KPI or to
   the base's own figures, so it lives entirely under the staff member who
   wrote it. Six fixed categories, matching the redesign: adding a seventh
   is a code change, not a per-goal choice, so the category chips can never
   drift out of sync with what a saved goal actually holds. */
const SMART_CATEGORIES = ['Faith', 'Health', 'Finance', 'Language', 'Skills', 'Fun'];
const MAX_SMART_GOALS_PER_YEAR = 30;
/* Oct 2026 (Uriah): a goal is written out as a SMART goal — five short
   answers (Specific, Measurable, Achievable, Relevant, Time-bound) — and
   broken into the quarterly and monthly steps that lead up to it, each one
   ticked off when done. Alongside, a Google-Tasks-like to-do list where each
   task can belong to a goal. Once a goal has steps or tasks its progress is
   what's ticked off over what's there; until then it is the percent typed in. */
const SMART_KEYS = ['s', 'm', 'a', 'r', 't'];
const MAX_SMART_FIELD = 300;
const MAX_STEPS_PER_GOAL = 24;
const MAX_OPEN_TASKS = 300;

async function getSmartGoals_() { return readJSON('smartGoals', []); }
async function getTasks_() { return readJSON('tasks', []); }

function smartFieldsOf_(v) {
  const o = {}; const src = (v && typeof v === 'object') ? v : {};
  SMART_KEYS.forEach(function (k) { o[k] = str_(src[k], MAX_SMART_FIELD) || ''; });
  return o;
}
/* The steps come back whole with every save (the client holds the goal), so a
   bad one is dropped rather than failing the save; ids are kept across saves
   so a tick on the phone and a rename on another never swap places. */
function stepsOf_(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  v.forEach(function (x) {
    if (!x || typeof x !== 'object' || out.length >= MAX_STEPS_PER_GOAL) return;
    const kind = x.kind === 'quarter' ? 'quarter' : (x.kind === 'month' ? 'month' : null);
    const period = finiteNum_(x.period, 1, kind === 'quarter' ? 4 : 12);
    const title = str_(x.title, 200);
    if (!kind || period == null || !title || Math.round(period) !== period) return;
    out.push({ id: str_(x.id, 40) || ('ss' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      kind: kind, period: period, title: title, done: !!x.done });
  });
  return out;
}
/* Progress: ticked steps and done tasks over all of them when the goal has
   any; the percent the owner typed in otherwise. */
function smartPct_(r, tasks) {
  const steps = r.steps || [];
  const total = steps.length + tasks.length;
  if (!total) return Math.max(0, Math.min(100, Math.round(Number(r.pct)) || 0));
  const done = steps.filter(function (x) { return x.done; }).length + tasks.filter(function (x) { return x.done; }).length;
  return Math.round(done / total * 100);
}
function smartGoalOut_(r, allTasks) {
  const tasks = (allTasks || []).filter(function (x) { return x.goalId === r.id; });
  return { id: r.id, year: r.year, category: r.category, title: r.title, meta: r.meta || '',
    smart: smartFieldsOf_(r.smart), steps: (r.steps || []).slice(),
    pct: smartPct_(r, tasks), pctManual: Math.max(0, Math.min(100, Math.round(Number(r.pct)) || 0)),
    tasksTotal: tasks.length, tasksDone: tasks.filter(function (x) { return x.done; }).length };
}
function smartGoalsOut_(rows, allTasks) {
  return rows.map(function (r) { return smartGoalOut_(r, allTasks); });
}

async function getMySmartGoals(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const mine = (await getSmartGoals_()).filter(function (r) { return r.staffId === s.id; });
  const tasks = (await getTasks_()).filter(function (r) { return r.staffId === s.id; });
  return { ok: true, smartGoals: smartGoalsOut_(mine, tasks) };
}

async function saveSmartGoal(username, pin, goal) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const g = goal || {};
  const year = finiteNum_(g.year, 2020, 2100);
  if (year == null) return { ok: false, err: 'bad_year' };
  if (SMART_CATEGORIES.indexOf(g.category) === -1) return { ok: false, err: 'bad_category' };
  const title = str_(g.title, 200);
  if (!title) return { ok: false, err: 'bad_title' };
  const pct = Math.max(0, Math.min(100, Math.round(Number(g.pct)) || 0));

  const rows = await getSmartGoals_();
  const now = new Date().toISOString();
  const existingIdx = g.id ? rows.findIndex(function (r) { return r.id === g.id && r.staffId === s.id; }) : -1;
  if (existingIdx === -1) {
    const mineThisYear = rows.filter(function (r) { return r.staffId === s.id && Number(r.year) === year; });
    if (mineThisYear.length >= MAX_SMART_GOALS_PER_YEAR) return { ok: false, err: 'too_many' };
  }
  const rec = {
    id: existingIdx > -1 ? rows[existingIdx].id : ('sg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    staffId: s.id, year: year, category: g.category, title: title, meta: str_(g.meta, 200) || '', pct: pct,
    smart: smartFieldsOf_(g.smart), steps: stepsOf_(g.steps),
    created: existingIdx > -1 ? rows[existingIdx].created : now, updated: now
  };
  if (existingIdx > -1) rows[existingIdx] = rec; else rows.push(rec);
  await writeJSON('smartGoals', rows);
  return getMySmartGoals(username, pin);
}

async function deleteSmartGoal(username, pin, goalId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  let rows = await getSmartGoals_();
  const had = rows.some(function (r) { return r.id === goalId && r.staffId === s.id; });
  rows = rows.filter(function (r) { return !(r.id === goalId && r.staffId === s.id); });
  await writeJSON('smartGoals', rows);
  /* Its tasks stay — as "Other tasks" — rather than vanishing with the goal. */
  if (had) {
    const tasks = await getTasks_();
    let moved = false;
    tasks.forEach(function (x) { if (x.goalId === goalId && x.staffId === s.id) { x.goalId = ''; moved = true; } });
    if (moved) await writeJSON('tasks', tasks);
  }
  return getMySmartGoals(username, pin);
}

/* ==================== tasks ====================
   One flat list per person (Google Tasks-like): a title, an optional due
   date and note, done or not, and which goal it belongs to — or none. Only
   ever your own rows, by the same rule as the goals. */
function taskOut_(r) {
  return { id: r.id, goalId: r.goalId || '', title: r.title, notes: r.notes || '', due: r.due || '',
    done: !!r.done, doneAt: r.doneAt || '', order: Number(r.order) || 0, created: r.created || '' };
}
async function getMyTasks(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const mine = (await getTasks_()).filter(function (r) { return r.staffId === s.id; });
  return { ok: true, tasks: mine.map(taskOut_) };
}
/* Saving a task also hands back the goals, since a goal's progress moves
   with its tasks — the page swaps both in one go. */
async function tasksAndGoals_(username, pin) {
  const tk = await getMyTasks(username, pin);
  const sg = await getMySmartGoals(username, pin);
  return { ok: true, tasks: tk.tasks || [], smartGoals: sg.smartGoals || [] };
}
async function saveTask(username, pin, task) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const x = task || {};
  const title = str_(x.title, 200);
  if (!title) return { ok: false, err: 'bad_title' };
  const due = x.due ? isoDate_(x.due) : '';
  if (x.due && !due) return { ok: false, err: 'bad_due' };
  const notes = str_(x.notes, 500) || '';
  const rows = await getTasks_();
  const goals = await getSmartGoals_();
  /* A task can only hang off one of your own goals — anyone else's id is
     dropped to "no goal" rather than letting a row point into their list. */
  const goalId = (x.goalId && goals.some(function (g) { return g.id === x.goalId && g.staffId === s.id; })) ? x.goalId : '';
  const now = new Date().toISOString();
  const idx = x.id ? rows.findIndex(function (r) { return r.id === x.id && r.staffId === s.id; }) : -1;
  if (idx === -1) {
    const open = rows.filter(function (r) { return r.staffId === s.id && !r.done; });
    if (open.length >= MAX_OPEN_TASKS) return { ok: false, err: 'too_many' };
  }
  const prev = idx > -1 ? rows[idx] : null;
  const done = !!x.done;
  const rec = {
    id: prev ? prev.id : ('tk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    staffId: s.id, goalId: goalId, title: title, notes: notes, due: due, done: done,
    doneAt: done ? ((prev && prev.done && prev.doneAt) || now) : '',
    order: finiteNum_(x.order, 0, 1e12) != null ? Number(x.order) : (prev ? (Number(prev.order) || 0) : Date.now()),
    created: prev ? prev.created : now, updated: now
  };
  if (prev) rows[idx] = rec; else rows.push(rec);
  await writeJSON('tasks', rows);
  return tasksAndGoals_(username, pin);
}
async function deleteTask(username, pin, taskId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  let rows = await getTasks_();
  rows = rows.filter(function (r) { return !(r.id === taskId && r.staffId === s.id); });
  await writeJSON('tasks', rows);
  return tasksAndGoals_(username, pin);
}
/* Clear every finished task in one go — the tidy-up Google Tasks has. */
async function clearDoneTasks(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  let rows = await getTasks_();
  rows = rows.filter(function (r) { return !(r.staffId === s.id && r.done); });
  await writeJSON('tasks', rows);
  return tasksAndGoals_(username, pin);
}

/* ==================== a teammate's public profile ====================
   What one staff member may see about another: who they are, what ministry
   they're in, and their weekly goals — work commitments the team is meant to
   know about and cheer on.

   Everything the app treats as private stays out of here, and it's an allowlist
   rather than a blocklist so a field added to the staff record later can't leak
   by default: no loneliness, no porn, no staff debt, no clarity/growth scores,
   no health score, and no habit data — habits are governed by the per-habit
   mentor consent flag and sharing them team-wide would go behind that.

   Requires the caller's own PIN: the roster is browsable, but goals are only
   for people who are actually on the team, never anonymous visitors. */
const PUBLIC_GOAL_WEEKS = 4;

async function staffProfile(username, pin, staffId) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  const rows = await getStaff_();
  const p = rows.find(function (r) { return r.id === staffId && r.active && !isApplicant_(r); });
  if (!p) return { ok: false, err: 'not_found' };

  const goals = goalsFor_(await getGoals_(), p.id).slice(0, PUBLIC_GOAL_WEEKS);
  // Aggregate participation only — how consistently someone shows up is fair
  // encouragement; what they logged on any given day is not.
  const mine = (await getDaily_()).filter(function (r) { return r.staffId === p.id; });
  const weeks = {};
  mine.forEach(function (r) { weeks[String(r.week)] = 1; });
  const dates = mine.map(function (r) { return r.date; }).sort();

  /* Days away, work only. Whether someone travels a lot for ministry is team
     information — it explains why they're not around. Personal days (family,
     medical, fundraising) are nobody else's business, so only the count of
     WORK days crosses this line, and never the reasons or dates. */
  const myTrips = (await getTrips_()).filter(function (r) {
    return r.staffId === p.id && r.status !== 'declined' && r.kind === 'work';
  });
  const awayWork = {};
  Object.keys(awayTotals_(myTrips)).forEach(function (y) {
    awayWork[y] = awayTotals_(myTrips)[y].work;
  });

  /* Their type and its bars, while they share it. Season is theirs alone. */
  const shared = sharedAvatar_(p);
  return {
    ok: true,
    staff: rosterStaff_(p),
    personality: shared ? { type: p.personality.type, scores: p.personality.scores || null,
      source: p.personality.source || 'test' } : null,
    gstrengths: sharedGStrengths_(p),
    goals: goals,
    activity: {
      weeksTracked: Object.keys(weeks).length,
      daysLogged: mine.length,
      lastLogged: dates.length ? dates[dates.length - 1] : ''
    },
    awayWork: awayWork,
    // how many Library books they have read — the count only, never the list
    booksRead: Object.keys(cleanLibRead_(p.libRead)).length,
    // what their profile still needs — for them, and for admins / HR only
    required: (p.id === me.id || canHR_(me)) ? requiredFor_(p, await getReqDocs_()) : null,
    isMe: p.id === me.id
  };
}

/* The nightly backup's last run, for an admin's "Last backup: …" line and the
   bell warning when a night is missed. Only the run's time and counts — never
   anything from inside the backup. */
async function backupStatus_() {
  const st = await getStore({ name: 'gp-backups', consistency: 'strong' }).get('status', { type: 'json' });
  if (!st || typeof st !== 'object' || Array.isArray(st)) return { none: true };
  return {
    at: String(st.at || ''), items: Number(st.items) || 0, days: Number(st.days) || 0,
    lastError: st.lastError ? String(st.lastError).slice(0, 300) : '', errorAt: String(st.errorAt || '')
  };
}

/* ==================== Prayer requests (Oct 2026) ====================
   ☰ → Prayer. A request is shared with your campus, all of YWAM GP, or only your
   mentor (`scope` campus | all | mentor); anyone who can see it taps "I prayed" (a
   count — who prayed is not listed); the person who asked marks it answered, with a
   line of thanks if they like. One 'prayers' blob of rows { id, staffId, campus,
   scope, text, created, prayed: [staffId], answered (date) , answerNote }.
   Shown: open requests for PR_OPEN_DAYS, answered ones for PR_ANSWERED_DAYS after;
   rows older than PR_KEEP_DAYS are dropped on the next write. The asker or an admin
   can delete. Never part of the roster or any report. */
const PR_SCOPES = ['campus', 'all', 'mentor'];
const PR_MAX_TEXT = 600, PR_MAX_NOTE = 300, PR_PER_DAY = 5;
const PR_OPEN_DAYS = 60, PR_ANSWERED_DAYS = 30, PR_KEEP_DAYS = 365;
async function getPrayers_() { return readJSON('prayers', []); }
function prDays_(iso) { return (Date.now() - new Date(iso).getTime()) / 86400000; }
function prCanSee_(r, s, staff) {
  if (r.staffId === s.id) return true;
  if (r.scope === 'all') return true;
  if (r.scope === 'campus') return r.campus === s.campus;
  if (r.scope === 'mentor') { const a = staff.find(function (x) { return x.id === r.staffId; }); return !!(a && a.mentorId === s.id && a.mentorStatus === 'approved'); }
  return false;
}
function prOut_(r, s, staff) {
  const a = staff.find(function (x) { return x.id === r.staffId; });
  return { id: r.id, mine: r.staffId === s.id, name: a ? a.name : '—', photo: a ? a.photo || '' : '', campus: r.campus, scope: r.scope,
    text: r.text, created: r.created, prayedN: (r.prayed || []).length, iPrayed: (r.prayed || []).indexOf(s.id) > -1,
    answered: r.answered || '', answerNote: r.answerNote || '' };
}
async function getPrayers(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const list = (await getPrayers_()).filter(function (r) {
    if (!prCanSee_(r, s, staff)) return false;
    return r.answered ? prDays_(r.answered) <= PR_ANSWERED_DAYS || r.staffId === s.id : prDays_(r.created) <= PR_OPEN_DAYS || r.staffId === s.id;
  }).sort(function (a, b) { return a.created < b.created ? 1 : -1; }).map(function (r) { return prOut_(r, s, staff); });
  return { ok: true, prayers: list };
}
async function savePrayer(username, pin, req) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const text = String(str_(req && req.text, PR_MAX_TEXT) || '').trim();
  if (!text) return { ok: false, err: 'empty' };
  const scope = PR_SCOPES.indexOf(req && req.scope) > -1 ? req.scope : 'campus';
  if (scope === 'mentor' && !(s.mentorId && s.mentorStatus === 'approved')) return { ok: false, err: 'no_mentor' };
  const rows = (await getPrayers_()).filter(function (r) { return prDays_(r.created) <= PR_KEEP_DAYS; });
  if (rows.filter(function (r) { return r.staffId === s.id && prDays_(r.created) < 1; }).length >= PR_PER_DAY) return { ok: false, err: 'too_many' };
  rows.push({ id: 'pr' + crypto.randomBytes(6).toString('hex'), staffId: s.id, campus: s.campus, scope: scope, text: text,
    created: new Date().toISOString(), prayed: [], answered: '', answerNote: '' });
  await writeJSON('prayers', rows);
  return getPrayers(username, pin);
}
async function prayedFor(username, pin, id, on) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const staff = await getStaff_();
  const rows = await getPrayers_();
  const r = rows.find(function (x) { return x.id === id; });
  if (!r || !prCanSee_(r, s, staff)) return { ok: false, err: 'not_found' };
  const list = (r.prayed || []).filter(function (x) { return x !== s.id; });
  if (on) list.push(s.id);
  r.prayed = list;
  await writeJSON('prayers', rows);
  return { ok: true, prayer: prOut_(r, s, staff) };
}
async function answerPrayer(username, pin, id, note, undo) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getPrayers_();
  const r = rows.find(function (x) { return x.id === id; });
  if (!r || r.staffId !== s.id) return { ok: false, err: 'not_found' };
  r.answered = undo ? '' : baseToday_();
  r.answerNote = undo ? '' : String(str_(note, PR_MAX_NOTE) || '').trim();
  await writeJSON('prayers', rows);
  return getPrayers(username, pin);
}
async function deletePrayer(username, pin, id) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getPrayers_();
  const r = rows.find(function (x) { return x.id === id; });
  if (!r || !(r.staffId === s.id || s.isAdmin)) return { ok: false, err: 'not_found' };
  await writeJSON('prayers', rows.filter(function (x) { return x.id !== id; }));
  return getPrayers(username, pin);
}

/* ==================== Support raising (Oct 2026) ====================
   Living by faith: each staff member's own list of ministry partners and the monthly
   support they are aiming for — private like staff debt. The person sees and edits
   everything (getMySupport / saveMySupport); their mentor sees TOTALS only (goal,
   pledged a month, how many giving / asked / still to ask, how many to thank or follow
   up), and only while the person has ticked "my mentor can see my totals"
   (`mentorVisible`, the same consent as a habit's). Partner names never leave the
   person's own account. Leadership sees nothing. Kept on the staff record (`support`),
   never in the roster or anyone else's boot.
   Partner: { id, name, amount (USD), freq 'month'|'year'|'once', status
   'giving'|'asked'|'toask'|'paused', last (date of last contact), note, channel (how
   it reaches you — a church, a sending base) }. Monthly pledged counts giving
   partners: a month as it is, a year / 12; once is not monthly.
   We support (Oct 2026, Uriah: "make the support tab include who we're supporting
   monthly"): `giving`, the people and ministries the person gives to — { id, name,
   amount, freq, channel (e.g. via GP, via ABA), location, note }. As private as the
   partners: only the person sees it; the mentor's totals are the partners' alone, and
   what someone gives (and to whom) is in no summary anyone else gets. */
const SUP_MAX_PARTNERS = 300;
const SUP_FREQS = ['month', 'year', 'once'];
const SUP_STATUS = ['giving', 'asked', 'toask', 'paused'];
const SUP_FOLLOW_DAYS = 90;
const SUP_MAX_GIVING = 300;
function supId_(raw, seen, prefix) {
  let id = String(str_(raw, 24) || '').replace(/[^a-z0-9]/gi, '');
  if (!id || seen[id]) id = prefix + crypto.randomBytes(5).toString('hex');
  seen[id] = 1;
  return id;
}
function supAmt_(v) { const a = finiteNum_(v, 0, 1000000); return a == null ? 0 : Math.round(a * 100) / 100; }
function cleanSupport_(v) {
  const o = v || {};
  const goal = finiteNum_(o.goal, 0, 1000000);
  const seen = {};
  const partners = (Array.isArray(o.partners) ? o.partners : []).slice(0, SUP_MAX_PARTNERS).map(function (p) {
    const name = String(str_(p && p.name, 80) || '').trim();
    if (!name) return null;
    let id = String(str_(p.id, 24) || '').replace(/[^a-z0-9]/gi, '');
    if (!id || seen[id]) id = 'p' + crypto.randomBytes(5).toString('hex');
    seen[id] = 1;
    const amt = finiteNum_(p.amount, 0, 1000000);
    return { id: id, name: name, amount: amt == null ? 0 : Math.round(amt * 100) / 100,
      freq: SUP_FREQS.indexOf(p.freq) > -1 ? p.freq : 'month', status: SUP_STATUS.indexOf(p.status) > -1 ? p.status : 'toask',
      last: isDate_(p.last) ? p.last : '', note: String(str_(p.note, 300) || ''), channel: String(str_(p.channel, 40) || '').trim() };
  }).filter(Boolean);
  const gseen = {};
  const giving = (Array.isArray(o.giving) ? o.giving : []).slice(0, SUP_MAX_GIVING).map(function (g) {
    const name = String(str_(g && g.name, 80) || '').trim();
    if (!name) return null;
    return { id: supId_(g.id, gseen, 'g'), name: name, amount: supAmt_(g.amount), freq: SUP_FREQS.indexOf(g.freq) > -1 ? g.freq : 'month',
      channel: String(str_(g.channel, 40) || '').trim(), location: String(str_(g.location, 40) || '').trim(), note: String(str_(g.note, 300) || '') };
  }).filter(Boolean);
  return { goal: goal == null ? 0 : Math.round(goal), partners: partners, giving: giving, mentorVisible: !!o.mentorVisible };
}
/* What the person gives out a month — their own page only. */
function supGivenMonthly_(s) {
  return Math.round(s.giving.reduce(function (a, g) { return a + (g.freq === 'month' ? g.amount : g.freq === 'year' ? g.amount / 12 : 0); }, 0) * 100) / 100;
}
function supMonthly_(p) { return p.status !== 'giving' ? 0 : p.freq === 'month' ? p.amount : p.freq === 'year' ? p.amount / 12 : 0; }
function supportSummary_(v) {
  const s = cleanSupport_(v), today = baseToday_();
  const pledged = Math.round(s.partners.reduce(function (a, p) { return a + supMonthly_(p); }, 0));
  const count = function (st) { return s.partners.filter(function (p) { return p.status === st; }).length; };
  const follow = s.partners.filter(function (p) {
    if (p.status === 'paused') return false;
    if (!p.last) return p.status === 'asked';   // never in touch since asking; a partner brought in from a tracker has no date yet
    return (new Date(today) - new Date(p.last)) / 86400000 >= SUP_FOLLOW_DAYS;
  }).length;
  return { goal: s.goal, pledged: pledged, pct: s.goal ? Math.round(pledged / s.goal * 100) : null,
    giving: count('giving'), asked: count('asked'), toask: count('toask'), followUp: follow };
}
async function getMySupport(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const sup = cleanSupport_(s.support);
  return { ok: true, support: sup, summary: supportSummary_(sup), givenMonthly: supGivenMonthly_(sup), followDays: SUP_FOLLOW_DAYS };
}
async function saveMySupport(username, pin, support) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const clean = cleanSupport_(support);
  const r = await mutateStaff_(function (rows) {
    const i = rows.findIndex(function (x) { return x.id === s.id; });
    if (i === -1) return { abort: true, ok: false };
    rows[i].support = clean;
    return { ok: true };
  });
  if (!r.ok) return r;
  return { ok: true, support: clean, summary: supportSummary_(clean), givenMonthly: supGivenMonthly_(clean), followDays: SUP_FOLLOW_DAYS };
}

/* ==================== 360 reviews (Oct 2026) ====================
   Uriah: "an anonymous 360 peer review option that we can send to a group of our peers or
   leadership team and then store the results and create an action plan that comes from it
   with quarterly reviews on progress."
   - A staff member starts a review OF THEMSELVES and picks who to ask: anyone on staff
     (any campus) or on the Advisory Board with a board login. They answer the same
     questions about themselves (self).
   - ANONYMOUS, by construction. An answer is stored with nothing that says whose it is —
     no id, no time — at a random place in the list; who has answered is a separate,
     sorted list used only so nobody answers twice, and is never sent to anyone (the
     person sees "4 of 6 answered"). Results are only shown once the review is CLOSED
     (live results would let someone match a change to the person who just answered) and
     at least P360_MIN_N people answered; an area with fewer than that many ratings shows
     no average. Comments are shown word for word, each question's shuffled on its own,
     so one person's answers can't be read across. Not even an admin can see who said what.
   - The results are the person's. They can share them (and their plan) with people they
     choose — their mentor, a director — who see the same, read-only.
   - The action plan comes from the results: actions { id, area (a question's key), what,
     measure (how I'll know), by (YYYY-Qn) }, and each quarter a review of every action
     { status notstarted|ontrack|stuck|done, note } with a reflection, under 'YYYY-Qn'.
   Store: 'p360' — every review, one list (mutateKey_ makes a concurrent answer safe). */
const P360_MIN_N = 3, P360_MAX_REVIEWERS = 30, P360_TEXT = 1000;
const P360_QS = ['faith', 'vision', 'care', 'comms', 'team', 'reliable', 'humble', 'decide', 'culture'];
const P360_TEXTS = ['keep', 'start', 'stop', 'other'];
const P360_STATUS = ['notstarted', 'ontrack', 'stuck', 'done'];
/* The staff list's careful write (mutateStaff_), for any key: read, change, write, read
   back; someone else's write in between means try again. */
async function mutateKey_(key, fallback, mutate) {
  const s = store();
  let lagOnly = true, last = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    if (attempt > 0) await new Promise(function (r) { setTimeout(r, Math.random() * 40); });
    const raw = shaped_(await s.get(key, { type: 'json' }), fallback);
    const data = copy_(raw);
    const result = mutate(data);
    if (result && result.abort) { const out = Object.assign({}, result); delete out.abort; return out; }
    await s.setJSON(key, data);
    const after = shaped_(await s.get(key, { type: 'json' }), fallback);
    if (JSON.stringify(after) === JSON.stringify(data)) {
      const mine = requestScope.getStore(); if (mine) mine.set(key, copy_(data));
      return result;
    }
    if (JSON.stringify(after) !== JSON.stringify(raw)) lagOnly = false;
    last = { data: data, result: result };
  }
  if (lagOnly && last) { const mine = requestScope.getStore(); if (mine) mine.set(key, copy_(last.data)); return last.result; }
  return { ok: false, err: 'busy' };
}
function p360Quarter_(d) { const day = d || baseToday_(); return day.slice(0, 4) + '-Q' + (Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1); }
function p360Id_() { return 'pr' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'); }
function p360Text_(v) { return String(str_(v, P360_TEXT) || '').trim(); }
function p360Ratings_(r) {
  const o = {}; r = r && typeof r === 'object' ? r : {};
  P360_QS.forEach(function (k) { const n = Number(r[k]); o[k] = (n >= 1 && n <= 5 && Math.round(n) === n) ? n : null; });
  return o;
}
function p360Answer_(a) {
  const o = { ratings: p360Ratings_(a && a.ratings) };
  P360_TEXTS.forEach(function (k) { o[k] = p360Text_(a && a[k]); });
  return o;
}
function p360Closed_(r) { return r.status === 'closed' || (r.due && r.due < baseToday_()); }
function viewerId_(v) { return v.who.id; }
/* Who can be asked: staff (active, not applicants) and board members with their own login. */
async function p360People_() {
  const staff = (await getStaff_()).filter(function (r) { return r.active !== false && !r.archived && !isApplicant_(r); });
  const board = (await getBoard_()).filter(function (b) { return b.active !== false && !b.staffId && b.pinHash; });
  const map = {};
  staff.forEach(function (r) { map[r.id] = { id: r.id, name: r.name, photo: r.photo || '', kind: 'staff', campus: r.campus }; });
  board.forEach(function (b) { map[b.id] = { id: b.id, name: b.name, photo: b.photo || '', kind: 'board', campus: '' }; });
  return map;
}
function p360Results_(r) {
  const n = r.answers.length;
  if (n < P360_MIN_N) return null;
  const areas = {};
  P360_QS.forEach(function (k) {
    const vals = r.answers.map(function (a) { return a.ratings[k]; }).filter(function (x) { return x != null; });
    const dist = [0, 0, 0, 0, 0]; vals.forEach(function (x) { dist[x - 1]++; });
    areas[k] = vals.length >= P360_MIN_N ? { n: vals.length, avg: Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length * 10) / 10, dist: dist } : { n: vals.length, avg: null };
  });
  const shuffle = function (list) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };
  const comments = {};
  P360_TEXTS.forEach(function (k) { comments[k] = shuffle(r.answers.map(function (a) { return a[k]; }).filter(Boolean)); });
  return { n: n, areas: areas, comments: comments };
}
/* One review as `me` may see it: the person themselves, someone they shared it with, or
   (only the ask) a reviewer. */
function p360Out_(r, me, people) {
  const closed = p360Closed_(r), isSubject = r.subjectId === me;
  const subj = people[r.subjectId] || { name: '', photo: '' };
  const out = { id: r.id, title: r.title, note: r.note || '', created: r.created, due: r.due || '', closed: closed, closedAt: r.closedAt || '',
    subject: { id: r.subjectId, name: subj.name, photo: subj.photo }, asked: r.reviewers.length, answered: r.done.length,
    minN: P360_MIN_N, mine: isSubject };
  if (isSubject) {
    out.reviewers = r.reviewers.map(function (id) { const p = people[id]; return p ? { id: id, name: p.name } : { id: id, name: '' }; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });   // who was asked — never who has answered
    out.sharedWith = r.sharedWith.map(function (id) { const p = people[id]; return { id: id, name: p ? p.name : '' }; });
  }
  out.self = r.self || null;
  out.results = closed ? p360Results_(r) : null;
  out.plan = r.plan || { actions: [], reviews: {} };
  return out;
}
async function p360Ctx_(username, pin) {
  const v = await verifyViewer_(username, pin);
  if (!v) return null;
  return { v: v, me: viewerId_(v), people: await p360People_() };
}
async function p360List(username, pin) {
  const c = await p360Ctx_(username, pin); if (!c) return { ok: false };
  const rows = await readJSON('p360', []);
  const q = p360Quarter_();
  const mine = [], shared = [], asked = [];
  rows.forEach(function (r) {
    if (r.subjectId === c.me) mine.push(r);
    else if (r.sharedWith.indexOf(c.me) > -1) shared.push(r);
    if (r.reviewers.indexOf(c.me) > -1 && !p360Closed_(r) && r.done.indexOf(c.me) === -1 && (r.declined || []).indexOf(c.me) === -1) {
      const s = c.people[r.subjectId] || {};
      asked.push({ id: r.id, title: r.title, note: r.note || '', due: r.due || '', subject: { id: r.subjectId, name: s.name || '', photo: s.photo || '' } });
    }
  });
  const sum = function (r) { const o = p360Out_(r, c.me, c.people); delete o.results; o.reviewDue = !!(o.plan.actions.length && !o.plan.reviews[q]); return o; };
  return { ok: true, quarter: q, questions: P360_QS, texts: P360_TEXTS, minN: P360_MIN_N,
    mine: mine.map(sum).sort(function (a, b) { return a.created < b.created ? 1 : -1; }), shared: shared.map(sum), asked: asked,
    people: c.v.kind === 'staff' ? Object.keys(c.people).filter(function (id) { return c.people[id].kind === 'board'; }).map(function (id) { return c.people[id]; }) : [] };
}
async function p360Get(username, pin, id) {
  const c = await p360Ctx_(username, pin); if (!c) return { ok: false };
  const r = (await readJSON('p360', [])).find(function (x) { return x.id === id; });
  if (!r || !(r.subjectId === c.me || r.sharedWith.indexOf(c.me) > -1)) return { ok: false, err: 'not_found' };
  return { ok: true, quarter: p360Quarter_(), review: p360Out_(r, c.me, c.people) };
}
async function p360Create(username, pin, x) {
  const c = await p360Ctx_(username, pin); if (!c) return { ok: false };
  if (c.v.kind !== 'staff') return { ok: false, err: 'staff_only' };
  x = x && typeof x === 'object' ? x : {};
  const ids = []; (Array.isArray(x.reviewers) ? x.reviewers : []).forEach(function (id) { if (c.people[id] && id !== c.me && ids.indexOf(id) === -1) ids.push(id); });
  if (ids.length < P360_MIN_N) return { ok: false, err: 'too_few' };
  if (ids.length > P360_MAX_REVIEWERS) return { ok: false, err: 'too_many' };
  const due = isoDate_(x.due);
  if (due && due < baseToday_()) return { ok: false, err: 'bad_date' };
  const rec = { id: p360Id_(), subjectId: c.me, title: ooText_(x.title, 80) || ('360 · ' + p360Quarter_()), note: ooText_(x.note, 400),
    created: new Date().toISOString(), due: due, status: 'open', reviewers: ids, done: [], declined: [], answers: [], self: null,
    sharedWith: [], plan: { actions: [], reviews: {} } };
  const r = await mutateKey_('p360', [], function (rows) { rows.push(rec); return { ok: true }; });
  if (!r.ok) return r;
  return { ok: true, review: p360Out_(rec, c.me, c.people) };
}
/* A reviewer's answer: kept with no name, at a random place; they are added to the sorted
   list of who has answered, so they can't answer twice. */
async function p360Answer(username, pin, id, answer) {
  const c = await p360Ctx_(username, pin); if (!c) return { ok: false };
  const a = p360Answer_(answer);
  if (!P360_QS.some(function (k) { return a.ratings[k] != null; }) && !P360_TEXTS.some(function (k) { return a[k]; })) return { ok: false, err: 'empty' };
  return mutateKey_('p360', [], function (rows) {
    const r = rows.find(function (x) { return x.id === id; });
    if (!r || r.reviewers.indexOf(c.me) === -1) return { abort: true, ok: false, err: 'not_found' };
    if (p360Closed_(r)) return { abort: true, ok: false, err: 'closed' };
    if (r.done.indexOf(c.me) > -1) return { abort: true, ok: false, err: 'already' };
    r.answers.splice(crypto.randomInt(r.answers.length + 1), 0, a);
    r.done.push(c.me); r.done.sort();
    r.declined = (r.declined || []).filter(function (x) { return x !== c.me; });
    return { ok: true };
  });
}
async function p360Decline(username, pin, id) {
  const c = await p360Ctx_(username, pin); if (!c) return { ok: false };
  return mutateKey_('p360', [], function (rows) {
    const r = rows.find(function (x) { return x.id === id; });
    if (!r || r.reviewers.indexOf(c.me) === -1 || r.done.indexOf(c.me) > -1) return { abort: true, ok: false, err: 'not_found' };
    r.declined = (r.declined || []).filter(function (x) { return x !== c.me; }).concat([c.me]).sort();
    return { ok: true };
  });
}
/* Everything below is the person's own: their self-review, closing, sharing, the plan,
   the quarterly reviews, and taking the whole review out. */
async function p360Mine_(username, pin, id, fn) {
  const c = await p360Ctx_(username, pin); if (!c) return { ok: false };
  let out = null;
  const res = await mutateKey_('p360', [], function (rows) {
    const r = rows.find(function (x) { return x.id === id; });
    if (!r || r.subjectId !== c.me) return { abort: true, ok: false, err: 'not_found' };
    const e = fn(r, c, rows); if (e) return Object.assign({ abort: true, ok: false }, e);
    out = r; return { ok: true };
  });
  if (!res.ok) return res;
  return { ok: true, quarter: p360Quarter_(), review: out ? p360Out_(out, c.me, c.people) : null };
}
async function p360Self(username, pin, id, answer) {
  return p360Mine_(username, pin, id, function (r) { if (p360Closed_(r)) return { err: 'closed' }; r.self = p360Answer_(answer); });
}
async function p360Close(username, pin, id) {
  return p360Mine_(username, pin, id, function (r) { if (r.status !== 'closed') { r.status = 'closed'; r.closedAt = new Date().toISOString(); } });
}
async function p360Share(username, pin, id, ids) {
  return p360Mine_(username, pin, id, function (r, c) {
    const out = []; (Array.isArray(ids) ? ids : []).forEach(function (x) { if (c.people[x] && x !== c.me && out.indexOf(x) === -1) out.push(x); });
    r.sharedWith = out.slice(0, 10);
  });
}
async function p360SavePlan(username, pin, id, actions) {
  return p360Mine_(username, pin, id, function (r) {
    const seen = {}, out = [];
    (Array.isArray(actions) ? actions : []).slice(0, 12).forEach(function (a) {
      const what = ooText_(a && a.what, 300); if (!what) return;
      let aid = String(str_(a.id, 24) || '').replace(/[^a-z0-9]/gi, ''); if (!aid || seen[aid]) aid = 'pa' + crypto.randomBytes(4).toString('hex'); seen[aid] = 1;
      out.push({ id: aid, area: P360_QS.indexOf(a.area) > -1 ? a.area : '', what: what, measure: ooText_(a.measure, 300),
        by: /^\d{4}-Q[1-4]$/.test(String(a.by || '')) ? a.by : '' });
    });
    r.plan = r.plan || { actions: [], reviews: {} };
    r.plan.actions = out; r.plan.updated = new Date().toISOString();
  });
}
async function p360Review(username, pin, id, quarter, items, reflection) {
  return p360Mine_(username, pin, id, function (r) {
    const q = String(quarter || '');
    if (!/^\d{4}-Q[1-4]$/.test(q) || q > p360Quarter_()) return { err: 'bad_quarter' };
    const ids = {}; (r.plan && r.plan.actions || []).forEach(function (a) { ids[a.id] = 1; });
    if (!Object.keys(ids).length) return { err: 'no_plan' };
    const out = {};
    (Array.isArray(items) ? items : []).forEach(function (it) {
      if (!it || !ids[it.actionId]) return;
      out[it.actionId] = { status: P360_STATUS.indexOf(it.status) > -1 ? it.status : 'notstarted', note: ooText_(it.note, 400) };
    });
    r.plan.reviews = r.plan.reviews || {};
    r.plan.reviews[q] = { at: new Date().toISOString(), items: out, reflection: ooText_(reflection, 800) };
  });
}
async function p360Delete(username, pin, id) {
  const c = await p360Ctx_(username, pin); if (!c) return { ok: false };
  const res = await mutateKey_('p360', [], function (rows) {
    const i = rows.findIndex(function (x) { return x.id === id && x.subjectId === c.me; });
    if (i === -1) return { abort: true, ok: false, err: 'not_found' };
    rows.splice(i, 1); return { ok: true };
  });
  return res.ok ? p360List(username, pin) : res;
}
/* For My Home: how many reviews are waiting for my answer, and whether a plan's review is due this quarter. */
async function p360Glance_(s) {
  const rows = await readJSON('p360', []), q = p360Quarter_();
  const asked = rows.filter(function (r) { return r.reviewers.indexOf(s.id) > -1 && !p360Closed_(r) && r.done.indexOf(s.id) === -1 && (r.declined || []).indexOf(s.id) === -1; }).length;
  const mine = rows.filter(function (r) { return r.subjectId === s.id; });
  const due = mine.some(function (r) { return r.plan && r.plan.actions && r.plan.actions.length && !(r.plan.reviews || {})[q]; });
  const open = mine.filter(function (r) { return !p360Closed_(r); }).length;
  return { asked: asked, reviewDue: due, open: open, has: mine.length > 0, quarter: q };
}

/* ==================== Reminders: web push (Oct 2026) ====================
   One reminder a day at the hour a person chooses (Phnom Penh time), only when there
   is something to say, all in one notification:
     - today's check-in is not in yet                         (daily)
     - a mentee you have had fewer than two 1-on-1s with this month, from the 8th, Mondays (oneonone)
     - sign-ups or moves into Campus Leadership waiting       (admin, admins only)
     - contracts ending within HR_DUE_DAYS, Mondays           (hr, HR and admins)
   Sent by netlify/functions/reminders.js every hour (runReminders below).

   The signing keys (VAPID). GP_VAPID_PUBLIC / GP_VAPID_PRIVATE (base64url, the raw
   65-byte public point and 32-byte private scalar) and GP_VAPID_SUBJECT in Netlify's
   environment are used when set; otherwise an admin turns reminders on in Admin →
   Reminders, which makes a key pair once and keeps it in the 'pushKeys' blob — server
   side only, like the PIN hashes. Without keys, reminders don't exist anywhere.

   Push messages are encrypted to each phone (RFC 8291, aes128gcm) with node's crypto —
   no library. Subscriptions are in 'pushSubs' ({ staffId, endpoint, p256dh, auth, lang,
   at }); a push service only from PUSH_HOSTS is ever called, so a subscription can't
   point the server at anything else. A subscription the service says is gone (404/410)
   is dropped. Prefs are on the staff record (`push`), never in the roster. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];
const PUSH_MAX_SUBS = 5;
const PUSH_HOURS_MIN = 5, PUSH_HOURS_MAX = 22;
const PUSH_TEXT = {
  title: { en: 'My YWAM GP', km: 'My YWAM GP' },
  daily: { en: 'Your check-in for today isn’t in yet.', km: 'ការរាយការណ៍ប្រចាំថ្ងៃរបស់អ្នកសម្រាប់ថ្ងៃនេះ មិនទាន់មាននៅឡើយទេ។' },
  oneonone: { en: '{n} of 2 1-on-1s with {name} this month.', km: 'ជួបមួយទល់មួយជាមួយ {name} បាន {n} ក្នុងចំណោម 2 ដងក្នុងខែនេះ។' },
  admin: { en: '{n} waiting for your approval in Admin.', km: '{n} កំពុងរង់ចាំការអនុម័តរបស់អ្នក ក្នុងផ្នែកអ្នកគ្រប់គ្រង។' },
  p360ask: { en: 'A 360 review is waiting for your feedback ({n}).', km: 'ការវាយតម្លៃ 360 កំពុងរង់ចាំមតិរបស់អ្នក ({n})។' },
  p360plan: { en: 'Your 360 action plan’s {q} review is due.', km: 'ដល់ពេលពិនិត្យផែនការសកម្មភាព 360 របស់អ្នកសម្រាប់ {q} ហើយ។' },
  hr: { en: '{n} contracts end soon.', km: 'កិច្ចសន្យា {n} នឹងផុតកំណត់ឆាប់ៗនេះ។' },
  test: { en: 'Reminders are on. You will hear from the app at the time you chose.', km: 'ការរំលឹកត្រូវបានបើក។ កម្មវិធីនឹងរំលឹកអ្នកនៅម៉ោងដែលអ្នកបានជ្រើសរើស។' }
};
function pushText_(key, lang, params) {
  const t = PUSH_TEXT[key] || {};
  let out = (lang === 'km' && t.km) || t.en || key;
  Object.keys(params || {}).forEach(function (k) { out = out.split('{' + k + '}').join(String(params[k])); });
  return out;
}
const b64u_ = function (buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u_ = function (s) { return Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64'); };
function hkdf_(salt, ikm, info, len) { return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len)); }
async function pushKeys_() {
  if (process.env.GP_VAPID_PUBLIC && process.env.GP_VAPID_PRIVATE) {
    return { pub: process.env.GP_VAPID_PUBLIC, priv: process.env.GP_VAPID_PRIVATE, subject: process.env.GP_VAPID_SUBJECT || 'mailto:admin@gonpreah.org' };
  }
  const k = await readJSON('pushKeys', {});
  return (k && k.pub && k.priv) ? k : null;
}
function vapidKeyObject_(pub, priv) {
  const p = unb64u_(pub);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: b64u_(unb64u_(priv)), x: b64u_(p.subarray(1, 33)), y: b64u_(p.subarray(33, 65)) }, format: 'jwk' });
}
/* The VAPID token for one push service (RFC 8292): ES256 over {aud, exp, sub}. */
function vapidJwt_(endpoint, keys, nowSec) {
  const aud = new URL(endpoint).origin;
  const head = b64u_(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u_(JSON.stringify({ aud: aud, exp: (nowSec || Math.floor(Date.now() / 1000)) + 12 * 3600, sub: keys.subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: vapidKeyObject_(keys.pub, keys.priv), dsaEncoding: 'ieee-p1363' });
  return head + '.' + body + '.' + b64u_(sig);
}
/* RFC 8291 aes128gcm: one record, encrypted to the phone's key (p256dh) and secret (auth). */
function pushEncrypt_(sub, payload) {
  const uaPub = unb64u_(sub.p256dh), auth = unb64u_(sub.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPub);
  const ikm = hkdf_(auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const salt = crypto.randomBytes(16);
  const cek = hkdf_(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf_(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, body]);
}
function pushHostOk_(endpoint) {
  try { const u = new URL(endpoint); return u.protocol === 'https:' && PUSH_HOSTS.some(function (re) { return re.test(u.hostname); }); }
  catch (e) { return false; }
}
/* Sends one message to one subscription. 'gone' when the push service has dropped it. */
async function pushSend_(sub, message, keys) {
  if (!pushHostOk_(sub.endpoint)) return 'bad_host';
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '43200', Urgency: 'normal',
        Authorization: 'vapid t=' + vapidJwt_(sub.endpoint, keys) + ', k=' + keys.pub },
      body: pushEncrypt_(sub, JSON.stringify(message))
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'sent' : 'failed';
  } catch (e) { return 'failed'; }
}
function pushPrefsOf_(s) {
  const p = (s && s.push) || {};
  const h = finiteNum_(p.hour, PUSH_HOURS_MIN, PUSH_HOURS_MAX);
  return { hour: h == null ? 19 : Math.round(h), daily: p.daily !== false, oneonone: p.oneonone !== false, admin: p.admin !== false, hr: p.hr !== false };
}
async function getPushSubs_() { return readJSON('pushSubs', []); }

async function savePushSub(username, pin, sub, lang) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!(await pushKeys_())) return { ok: false, err: 'not_set_up' };
  const endpoint = sub && typeof sub.endpoint === 'string' ? sub.endpoint.slice(0, 1200) : '';
  const k = (sub && sub.keys) || {};
  if (!pushHostOk_(endpoint)) return { ok: false, err: 'bad_endpoint' };
  if (unb64u_(k.p256dh).length !== 65 || unb64u_(k.auth).length !== 16) return { ok: false, err: 'bad_keys' };
  let rows = (await getPushSubs_()).filter(function (r) { return r.endpoint !== endpoint; });
  const mine = rows.filter(function (r) { return r.staffId === s.id; });
  if (mine.length >= PUSH_MAX_SUBS) { const oldest = mine.sort(function (a, b) { return a.at < b.at ? -1 : 1; })[0]; rows = rows.filter(function (r) { return r !== oldest; }); }
  rows.push({ staffId: s.id, endpoint: endpoint, p256dh: k.p256dh, auth: k.auth, lang: lang === 'km' ? 'km' : 'en', at: new Date().toISOString() });
  await writeJSON('pushSubs', rows);
  return { ok: true, prefs: pushPrefsOf_(s) };
}
async function deletePushSub(username, pin, endpoint) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await getPushSubs_();
  const left = rows.filter(function (r) { return !(r.staffId === s.id && r.endpoint === endpoint); });
  if (left.length !== rows.length) await writeJSON('pushSubs', left);
  return { ok: true };
}
async function savePushPrefs(username, pin, prefs) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const p = prefs || {};
  const h = finiteNum_(p.hour, PUSH_HOURS_MIN, PUSH_HOURS_MAX);
  return mutateStaff_(function (rows) {
    const i = rows.findIndex(function (r) { return r.id === s.id; });
    if (i === -1) return { abort: true, ok: false };
    rows[i].push = { hour: h == null ? 19 : Math.round(h), daily: p.daily !== false, oneonone: p.oneonone !== false, admin: p.admin !== false, hr: p.hr !== false };
    return { ok: true, prefs: pushPrefsOf_(rows[i]) };
  });
}
async function sendTestPush(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const keys = await pushKeys_();
  if (!keys) return { ok: false, err: 'not_set_up' };
  const subs = (await getPushSubs_()).filter(function (r) { return r.staffId === s.id; });
  if (!subs.length) return { ok: false, err: 'no_subscription' };
  let sent = 0;
  for (const sub of subs) {
    const r = await pushSend_(sub, { title: pushText_('title', sub.lang), body: pushText_('test', sub.lang), tag: 'gp-test', url: 'teams.html' }, keys);
    if (r === 'sent') sent++;
  }
  return { ok: sent > 0, sent: sent, err: sent ? undefined : 'not_sent' };
}
/* Admin → Reminders: make the app's key pair, once. */
async function adminSetUpPush(username, pin) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const have = await pushKeys_();
  if (have) return { ok: true, ready: true, fromEnv: !!process.env.GP_VAPID_PUBLIC };
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  await writeJSON('pushKeys', { pub: b64u_(ecdh.getPublicKey()), priv: b64u_(ecdh.getPrivateKey()),
    subject: admin.email ? 'mailto:' + admin.email : 'mailto:admin@gonpreah.org', at: new Date().toISOString(), by: admin.id });
  return { ok: true, ready: true, fromEnv: false };
}
async function adminPushStatus(username, pin) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const subs = await getPushSubs_();
  return { ok: true, ready: !!(await pushKeys_()), fromEnv: !!process.env.GP_VAPID_PUBLIC,
    people: new Set(subs.map(function (r) { return r.staffId; })).size, phones: subs.length, last: await readJSON('pushRun', {}) };
}

/* What a person's reminder says right now, if anything (keys of PUSH_TEXT + params). */
function reminderItems_(s, ctx) {
  const p = pushPrefsOf_(s), out = [];
  if (p.daily && !ctx.loggedToday[s.id]) out.push({ key: 'daily' });
  if (p.oneonone && ctx.monday && ctx.dayOfMonth >= 8) {
    ctx.staff.filter(function (m) { return m.mentorId === s.id && m.mentorStatus === 'approved' && m.active !== false && !m.archived; }).forEach(function (m) {
      const n = ctx.held[s.id + '|' + m.id] || 0;
      if (n < OO_PER_MONTH) out.push({ key: 'oneonone', params: { n: n, name: String(m.name || '').split(' ')[0] } });
    });
  }
  if (p.admin && s.isAdmin && ctx.waiting) out.push({ key: 'admin', params: { n: ctx.waiting } });
  if (p.hr && canHR_(s) && ctx.monday && ctx.hrDue) out.push({ key: 'hr', params: { n: ctx.hrDue } });
  /* 360 reviews, with the daily reminder: one waiting for your feedback; on Mondays, your plan's quarterly review */
  if (p.daily && ctx.p360) {
    const asked = ctx.p360.filter(function (r) { return r.reviewers.indexOf(s.id) > -1 && !p360Closed_(r) && r.done.indexOf(s.id) === -1 && (r.declined || []).indexOf(s.id) === -1; }).length;
    if (asked) out.push({ key: 'p360ask', params: { n: asked } });
    if (ctx.monday && ctx.p360.some(function (r) { return r.subjectId === s.id && r.plan && r.plan.actions && r.plan.actions.length && !(r.plan.reviews || {})[ctx.quarter]; })) out.push({ key: 'p360plan', params: { q: ctx.quarter.replace('-Q', ' Q') } });
  }
  return out;
}
/* netlify/functions/reminders.js, every hour: everyone whose hour it is gets one
   notification with whatever applies to them. `now` is for tests. */
async function runReminders(now) {
  return requestScope.run(new Map(), async function () {
    const at = now || new Date();
    const keys = await pushKeys_();
    if (!keys) return { ok: false, err: 'not_set_up' };
    const local = new Date(at.getTime() + 7 * 3600 * 1000);
    const hour = local.getUTCHours(), today = local.toISOString().slice(0, 10), month = today.slice(0, 7);
    const subs = await getPushSubs_();
    if (!subs.length) return { ok: true, sent: 0, people: 0 };
    const run = await readJSON('pushRun', {});
    if (run.slot === today + 'T' + hour) return { ok: true, sent: 0, skipped: 'already_ran' };
    const staff = (await getStaff_()).filter(function (r) { return !isApplicant_(r); });
    const daily = await getDaily_(), loggedToday = {};
    daily.forEach(function (r) { if (r.date === today) loggedToday[r.staffId] = 1; });
    const held = {};
    (await getOneOnOnes_()).forEach(function (r) {
      if (!r.heldOn || String(r.heldOn).slice(0, 7) !== month) return;
      const menteeId = ooMenteeOf_(r, staff), mentorId = menteeId === r.fromId ? r.toId : r.fromId;
      held[mentorId + '|' + menteeId] = (held[mentorId + '|' + menteeId] || 0) + 1;
    });
    const ctx = { staff: staff, loggedToday: loggedToday, held: held, monday: local.getUTCDay() === 1, dayOfMonth: local.getUTCDate(),
      waiting: staff.filter(function (r) { return (!r.active && !r.archived) || (r.active && r.cltRequest); }).length,
      hrDue: hrDueCount_(staff), p360: await readJSON('p360', []), quarter: p360Quarter_(today) };
    let sent = 0, people = 0, gone = [];
    for (const s of staff) {
      if (s.active === false || s.archived) continue;
      const mine = subs.filter(function (r) { return r.staffId === s.id; });
      if (!mine.length || pushPrefsOf_(s).hour !== hour) continue;
      const items = reminderItems_(s, ctx);
      if (!items.length) continue;
      people++;
      for (const sub of mine) {
        const msg = { title: pushText_('title', sub.lang), body: items.map(function (x) { return pushText_(x.key, sub.lang, x.params); }).join('\n'), tag: 'gp-reminder', url: 'teams.html' };
        const r = await pushSend_(sub, msg, keys);
        if (r === 'sent') sent++;
        if (r === 'gone') gone.push(sub.endpoint);
      }
    }
    if (gone.length) await writeJSON('pushSubs', (await getPushSubs_()).filter(function (r) { return gone.indexOf(r.endpoint) === -1; }));
    await writeJSON('pushRun', { slot: today + 'T' + hour, at: at.toISOString(), sent: sent, people: people, dropped: gone.length });
    return { ok: true, sent: sent, people: people, dropped: gone.length };
  });
}
export { runReminders, pushEncrypt_, vapidJwt_ };
export { qboCallback, runQboSync, qboPlFromReport_, qboDebtFromReport_ };

/* ---------- Khmer review (Oct 2026) ----------
   About 4,000 of the app's Khmer strings are drafts nobody who speaks Khmer has read
   (PENDING_KM in km.js); 266 are checked (REVIEWED_KM). A Khmer reviewer — an admin
   ticks `kmReviewer` — goes through the drafts one by one in Khmer review (☰ → Khmer
   review) and marks each "reads right" or writes the fix. One row per string in the
   'kmReview' blob: { key (the English), verdict 'ok' | 'fix', km (the fix), by, byName, at }.
   A fix shows in the app for everyone straight away (the boot's kmFixes); the checked
   rows are later built into REVIEWED_KM with scripts/apply-km-review.mjs from an
   admin's download, which is what makes them permanent. */
const KMR_MAX_ROWS = 8000;
const KMR_KEY_MAX = 2000;
function isKmReviewer_(s) { return !!(s && s.active !== false && (s.isAdmin || s.kmReviewer)); }
async function getKmReview_() { return readJSON('kmReview', []); }
function kmFixesOf_(rows) {
  const out = {};
  (rows || []).forEach(function (r) { if (r && r.verdict === 'fix' && r.key && r.km) out[r.key] = r.km; });
  return out;
}
/* the {placeholders} a string carries, sorted, so a fix can't drop or invent one */
function kmSlots_(str) { return (String(str).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join('|'); }
async function getKmReview(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!isKmReviewer_(s)) return { ok: false, err: 'not_authorized' };
  return { ok: true, rows: await getKmReview_() };
}
async function saveKmReview(username, pin, key, verdict, km) {
  const s = await verifyStaff_(username, pin);
  if (!isKmReviewer_(s)) return { ok: false, err: 'not_authorized' };
  const k = typeof key === 'string' ? key : '';
  if (!k || k.length > KMR_KEY_MAX) return { ok: false, err: 'bad_key' };
  if (['ok', 'fix', 'clear'].indexOf(verdict) === -1) return { ok: false, err: 'bad_verdict' };
  let text = '';
  if (verdict === 'fix') {
    text = String(km || '').trim().slice(0, KMR_KEY_MAX * 3);
    if (!/[\u1780-\u17FF]/.test(text)) return { ok: false, err: 'not_khmer' };
    if (kmSlots_(text) !== kmSlots_(k)) return { ok: false, err: 'placeholders' };
  }
  const rows = await getKmReview_();
  const i = rows.findIndex(function (r) { return r.key === k; });
  if (verdict === 'clear') { if (i > -1) rows.splice(i, 1); }
  else {
    const row = { key: k, verdict: verdict, km: text, by: s.id, byName: s.name || '', at: new Date().toISOString() };
    if (i > -1) rows[i] = row;
    else { if (rows.length >= KMR_MAX_ROWS) return { ok: false, err: 'full' }; rows.push(row); }
  }
  await writeJSON('kmReview', rows);
  return { ok: true, row: verdict === 'clear' ? null : rows.find(function (r) { return r.key === k; }) };
}

/* ---------- one call for a page open ----------
   Opening the staff page used to fire ten separate function invocations —
   staffLogin, teamRoster, getMyLogs, getMyMentees, getMyMentorRequests,
   getMyWeekly, getMyTrips, getTripRequests, getMyMinistry and getData — eight of
   which verified the same PIN against the same staff blob, and each of which
   re-rendered the page when it landed.

   This is the same data in one invocation, with the PIN checked once. The
   individual handlers all stay, because everything after boot (saving a day,
   answering a week, approving a request) still uses them and should keep
   returning just the slice it changed.

   It deliberately does NOT fail as a unit: each section is caught on its own, so
   a problem reading trips cannot stop the page from having the base's figures. */
const BOOT_KEYS = ['entries', 'survey', 'okrs', 'dailyLogs', 'goals', 'holidays', 'smartGoals', 'broadcasts',
  'personalKpi', 'trips', 'kpiDaily', 'oneOnOnes', 'numbersPeople', 'metricOverrides', 'teamTrips', 'tasks', 'reqDocs', 'board', 'kmReview', 'pushKeys'];
async function getMyBoot(username, pin) {
  prefetch_(['staff', 'loginThrottle'].concat(BOOT_KEYS));   // before the PIN check, so they travel together
  const s = await verifyStaff_(username, pin);
  // `err:'auth'` on purpose: the page must be able to tell "your PIN is wrong"
  // from "the request failed", because only the first should log somebody out.
  if (!s) return { ok: false, err: 'auth' };

  const part = async function (fn) {
    try { return await fn(); } catch (e) { return null; }
  };
  const [staffRows, logs, mentees, requests, weekly, trips, tripReqs, ministry, base, smart, oneOnOnes, broadcasts, personal, teamTrips, candRows, tasks, schedules] =
    await Promise.all([
      part(function () { return getStaff_(); }),
      part(function () { return getMyLogs(username, pin); }),
      part(function () { return getMyMentees(username, pin); }),
      part(function () { return getMyMentorRequests(username, pin); }),
      part(function () { return getMyWeekly(username, pin); }),
      part(function () { return getMyTrips(username, pin); }),
      part(function () { return getTripRequests(username, pin); }),
      part(function () { return getMyMinistry(username, pin); }),
      // No leader code: the two money metrics leadership can see never reach here.
      part(function () { return getData(''); }),
      part(function () { return getMySmartGoals(username, pin); }),
      part(function () { return getMyOneOnOnes(username, pin); }),
      part(function () { return getMyBroadcasts(username, pin); }),
      part(function () { return getMyPersonal(username, pin); }),
      // Outreach Teams staff open on their teams page — bring the teams along
      part(function () { return (s.dept === TEAM_DEPT && s.ministry === TEAM_MIN) ? getTeamTrips(username, pin, s.campus) : null; }),
      part(function () { return canHR_(s) ? getCandidates_() : null; }),
      part(function () { return getMyTasks(username, pin); }),
      // this week's chores and cooking, for the line on My Home's card — in the boot so the
      // card is drawn with it, instead of growing when a second request answers (Oct 2026)
      part(function () { return getMySchedules(username, pin); })
    ]);
  const reqDocs = await part(getReqDocs_);

  return {
    ok: true,
    staff: Object.assign(publicStaff_(s), { isAdmin: !!s.isAdmin, hr: !!s.hr, portalStaff: !!s.portalStaff, portalAdmin: !!s.portalAdmin, portal: canPortal_(s), hospitality: canHosp_(s), kmReviewer: isKmReviewer_(s), created: s.created || '' }),   // created: for My Home's first 30 days
    profile: {
      phone: s.phone, joined: s.joined, debt: s.debt, mentorStatus: s.mentorStatus || '',
      dashboardColor: s.dashboardColor || '', dashboardBg: s.dashboardBg || '', email: s.email || '',
      sex: cleanSex_(s.sex), personality: ownPersonality_(s),
      gstrengths: ownGStrengths_(s), cltRequest: cltRequestOut_(s)
    },
    roster: (staffRows || []).filter(function (r) { return r.active && !isApplicant_(r); }).map(rosterStaff_),
    logs: (logs && logs.logs) || [],
    habits: (logs && logs.habits) || null,
    mentees: (mentees && mentees.mentees) || [],
    mentorRequests: (requests && requests.requests) || [],
    goals: (weekly && weekly.goals) || [],
    checkins: (weekly && weekly.checkins) || [],
    trips: trips || null,
    tripRequests: (tripReqs && tripReqs.requests) || [],
    ministry: ministry || null,
    smartGoals: (smart && smart.smartGoals) || [],
    tasks: (tasks && tasks.tasks) || [],
    oneOnOnes: (oneOnOnes && oneOnOnes.oneOnOnes) || [],
    broadcasts: (broadcasts && broadcasts.broadcasts) || [],
    personal: personal || null,
    teamTrips: teamTrips || null,
    schedules: schedules && schedules.ok ? schedules : null,
    // for the HR menu item's badge: contracts run out or running out within 90 days
    hrDue: canHR_(s) ? hrDueCount_(staffRows) : null,
    // whose numbers are due, and (for a department overseer) which ministries are in
    numbers: await part(function () { return numbersStatus_(s, staffRows || []); }),
    hrFollowUps: canHR_(s) ? candFollowUpsCount_(candRows || []) : null,
    // the books they have marked read in the Library, and the papers every staff member signs
    libRead: cleanLibRead_(s.libRead),
    stuMentor: deptOf_(s) === STU_LD_DEPT ? await part(function () { return stuMentorFor_(s.id); }) : null,   // students who chose them as mentor
    supportSummary: s.support ? supportSummary_(s.support) : null,   // support raising: your own totals, for My Home's tile
    p360: await part(function () { return p360Glance_(s); }),   // 360 reviews: waiting for my answer, a plan's quarterly review due
    reqDocs: reqDocs ? reqDocsAnswer_(reqDocs) : [],
    required: (reqDocs && !isApplicant_(s)) ? requiredFor_(s, reqDocs) : null,
    // admins only: when the nightly backup last ran (netlify/functions/backup.js)
    org: await part(function () { return getYwamGp(username, pin); }),   // titles, YWAM GP roles, the advisory board
    kmFixes: await part(async function () { return kmFixesOf_(await getKmReview_()); }),   // a Khmer reviewer's corrections, live for everyone
    push: await part(async function () { const k = await pushKeys_(); return k ? { key: k.pub, prefs: pushPrefsOf_(s) } : null; }),   // reminders: the app's public key and your times
    backup: s.isAdmin ? await part(backupStatus_) : null,
    // the roster is already top-level above; no need to ship it twice in one response
    base: base ? Object.assign({}, base, { roster: undefined }) : null
  };
}

/* ==================== org structure snapshots ====================
   The Team tab's Structure view is live from profiles. Each quarter an
   admin saves a snapshot of it — who was in which department and ministry,
   who led what — so the base can look back quarter by quarter as people
   move. A snapshot is built HERE from the staff list, never taken from the
   client, and it carries names, so it still renders after someone leaves.
   One row per campus / year / quarter in the 'structure' blob; saving the
   same quarter again replaces it. Reading a quarter nobody saved answers
   with the latest earlier snapshot, marked 'copied', or nothing. */
const STRUCT_MAX = 400;
function currentQuarter_() { return Math.floor(new Date().getUTCMonth() / 3) + 1; }
async function getStructures_() { return readJSON('structure', []); }
function structOrder_(d) { return Number(d.year) * 10 + Number(d.quarter); }
function structFind_(rows, campus, year, quarter) {
  const exact = rows.find(function (r) { return r.campus === campus && Number(r.year) === year && Number(r.quarter) === quarter; });
  if (exact) return { doc: exact, source: 'saved' };
  const earlier = rows.filter(function (r) { return r.campus === campus && structOrder_(r) < year * 10 + quarter; })
    .sort(function (a, b) { return structOrder_(b) - structOrder_(a); })[0];
  if (earlier) return { doc: earlier, source: 'copied' };
  return { doc: null, source: 'none' };
}
/* Staff who are students for a quarter (a school: DTS, DBS, BCS, SMS) —
   e.g. staff doing the BCS in Q4. Kept per campus / year / quarter in
   'structurePlans', separate from anyone's profile, so it is true for that
   quarter only. The chart moves them out of their ministry into a Students
   box, and a saved snapshot carries it. */
const STRUCT_SCHOOLS = ['dts', 'dbs', 'bcs', 'sms'];
async function getPlans_() { return readJSON('structurePlans', []); }
/* A plan also holds the quarter's arrangement: where each person sits on the
   chart (`place: {staffId: {dept, ministry}}`), separate from their profile —
   the chart is the base's structure, the profile is what the person says.
   A quarter with no plan of its own starts from the latest earlier
   arrangement (students never carry over; they are per quarter). */
function planFor_(plans, campus, y, q) {
  const p = plans.find(function (r) { return r.campus === campus && Number(r.year) === y && Number(r.quarter) === q; });
  if (p) return { students: p.students || {}, place: p.place || {}, inherited: false };
  const earlier = plans.filter(function (r) { return r.campus === campus && r.place && Object.keys(r.place).length && (Number(r.year) * 10 + Number(r.quarter)) < y * 10 + q; })
    .sort(function (a, b) { return (Number(b.year) * 10 + Number(b.quarter)) - (Number(a.year) * 10 + Number(a.quarter)); })[0];
  return { students: {}, place: (earlier && earlier.place) || {}, inherited: !!earlier, from: earlier ? { year: Number(earlier.year), quarter: Number(earlier.quarter) } : null };
}
function cleanPlace_(place, here) {
  const out = {};
  Object.keys(place && typeof place === 'object' ? place : {}).forEach(function (id) {
    const v = place[id];
    if (!here[id] || !v || typeof v !== 'object') return;
    const dept = str_(v.dept, 80), ministry = str_(v.ministry, 80);
    if (dept) out[id] = { dept: normDept_(dept, ministry), ministry: ministry || '' };
  });
  return out;
}
/* Applicant accounts (the portal) are never on the staff chart — including
   in snapshots saved before that rule. */
function structPeopleOnly_(doc, rows) {
  if (!doc || !Array.isArray(doc.people)) return doc;
  const applicants = {}; (rows || []).forEach(function (r) { if (isApplicant_(r)) applicants[r.id] = 1; });
  return Object.assign({}, doc, { people: doc.people.filter(function (p) { return p && !applicants[p.id]; }) });
}
async function getStructure(username, pin, campus, year, quarter) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  campus = str_(campus, 40) || s.campus;
  const y = finiteNum_(year, 2020, 2100) || currentYear_();
  const q = finiteNum_(quarter, 1, 4) || currentQuarter_();
  const found = structFind_(await getStructures_(), campus, y, q);
  return { ok: true, campus: campus, year: y, quarter: q, doc: structPeopleOnly_(found.doc, await getStaff_()), source: found.source, plan: planFor_(await getPlans_(), campus, y, q) };
}
async function saveStructurePlan(username, pin, campus, year, quarter, students, place) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  campus = str_(campus, 40) || admin.campus;
  const y = finiteNum_(year, 2020, 2100), q = finiteNum_(quarter, 1, 4);
  if (y == null || q == null) return { ok: false, err: 'bad_quarter' };
  const staff = await getStaff_();
  const here = {}; staff.forEach(function (r) { if (r.active && !r.archived && !isApplicant_(r) && r.campus === campus) here[r.id] = 1; });
  const clean = {};
  Object.keys(students && typeof students === 'object' ? students : {}).forEach(function (id) {
    const school = String(students[id] || '').toLowerCase();
    if (here[id] && STRUCT_SCHOOLS.indexOf(school) > -1) clean[id] = school;
  });
  const plans = await getPlans_();
  const idx = plans.findIndex(function (r) { return r.campus === campus && Number(r.year) === y && Number(r.quarter) === q; });
  const before = planFor_(plans, campus, y, q);
  // leaving one out keeps what the quarter had (an inherited arrangement becomes its own)
  const placeClean = place === undefined || place === null ? before.place : cleanPlace_(place, here);
  const studentsClean = students === undefined || students === null ? before.students : clean;
  const rec = { campus: campus, year: y, quarter: q, students: studentsClean, place: placeClean, savedAt: new Date().toISOString(), savedBy: admin.id };
  if (idx > -1) plans[idx] = rec; else plans.push(rec);
  await writeJSON('structurePlans', plans);
  // a snapshot already saved for that quarter follows
  const rows = await getStructures_();
  const snap = rows.find(function (r) { return r.campus === campus && Number(r.year) === y && Number(r.quarter) === q; });
  if (snap) {
    const byId = {}; staff.forEach(function (r) { byId[r.id] = r; });
    snap.people = snap.people.map(function (p) {
      const o = Object.assign({}, p), r = byId[p.id];
      if (studentsClean[p.id]) o.student = studentsClean[p.id]; else delete o.student;
      if (placeClean[p.id]) { o.dept = placeClean[p.id].dept; o.ministry = placeClean[p.id].ministry; }
      else if (r) { o.dept = r.dept; o.ministry = r.ministry || ''; }
      return o;
    });
    await writeJSON('structure', rows);
  }
  return { ok: true, campus: campus, year: y, quarter: q, plan: { students: studentsClean, place: placeClean, inherited: false }, doc: snap ? structPeopleOnly_(snap, staff) : null };
}
async function saveStructure(username, pin, campus, year, quarter) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  campus = str_(campus, 40) || admin.campus;
  const y = finiteNum_(year, 2020, 2100), q = finiteNum_(quarter, 1, 4);
  if (y == null || q == null) return { ok: false, err: 'bad_quarter' };
  const plan = planFor_(await getPlans_(), campus, y, q);
  const people = (await getStaff_()).filter(function (r) { return r.active && !r.archived && !isApplicant_(r) && r.campus === campus; })
    .map(function (r) { const pl = plan.place[r.id]; const o = { id: r.id, name: r.name, dept: pl ? pl.dept : r.dept, ministry: pl ? pl.ministry : (r.ministry || ''), role: r.role || '', leads: leadsOf_(r), photo: '' }; if (plan.students[r.id]) o.student = plan.students[r.id]; return o; })
    .slice(0, STRUCT_MAX);
  const rec = { campus: campus, year: y, quarter: q, people: people, savedAt: new Date().toISOString(), savedBy: admin.id };
  const rows = await getStructures_();
  const idx = rows.findIndex(function (r) { return r.campus === campus && Number(r.year) === y && Number(r.quarter) === q; });
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('structure', rows);
  return { ok: true, campus: campus, year: y, quarter: q, doc: rec, source: 'saved' };
}

/* ==================== outreach teams ====================
   Outreach Teams is the one ministry that doesn't log week by week: a team
   comes for a stretch of weeks and its numbers are gathered once, when it
   leaves. So instead of weekly entries it keeps one record per team — who
   came, when, how many, and every Outreach Teams metric as a total for the
   visit — in the 'teamTrips' blob, laid over TEAM_SEED (the records imported
   from the old Lovable hub). Editing a seeded team writes a full row under
   its id; deleting one writes a tombstone; the seed file itself is never
   rewritten.

   Everything else in the app still reads Outreach Teams as weekly rows, so
   the trips are turned into them on the way out (teamEntryRows_): a team
   counts in the week it LEAVES — 'Teams Hosted' +1 and each metric's total
   — and a derived row replaces any hand-logged row for the same campus,
   metric, year and week (withTeamRows_), so nothing is counted twice. The
   Base dashboard, the GP roll-up and the ministry's own payload all get
   these without knowing where they came from. */
const TEAM_DEPT = 'Community Service', TEAM_MIN = 'Outreach Teams';
const TEAM_COUNTS = ['size', 'males', 'females', 'couples', 'families'];
async function getTeamTripsRaw_() { return readJSON('teamTrips', []); }
/* A seed row marked `recover` carries numbers found in the hand-logged
   weekly rows for a team that may already be in the Teams Database without
   them. If a saved team is that team — same campus, its name has the
   seed's `recover` word, it left within a week of the seed's date — and
   has no numbers yet, the numbers go to it and the seed row stands down;
   otherwise the seed row is the team. Either way the team counts once. */
function recoverInto_(seedRow, saved) {
  const word = String(seedRow.recover || '').toLowerCase(), to = new Date(seedRow.to + 'T00:00:00Z');
  return saved.filter(function (t) {
    if (!t || t.deleted || t.campus !== seedRow.campus || !t.to || String(t.name || '').toLowerCase().indexOf(word) === -1) return false;
    return Math.abs(new Date(t.to + 'T00:00:00Z') - to) <= 7 * 86400000;
  })[0] || null;
}
function hasNumbers_(t) { return Object.keys((t && t.metrics) || {}).some(function (k) { return t.metrics[k] != null && t.metrics[k] !== ''; }); }
async function getTeamTrips_() {
  const byId = {}, saved = (await getTeamTripsRaw_()).filter(function (t) { return t && t.id; });
  const savedIds = {}, filled = {}; saved.forEach(function (t) { savedIds[t.id] = 1; });
  TEAM_SEED.forEach(function (t) {
    if (t.recover && !savedIds[t.id]) {
      const twin = recoverInto_(t, saved);
      if (twin) { if (!hasNumbers_(twin)) { byId[twin.id] = Object.assign({}, twin, { metrics: Object.assign({}, t.metrics) }); filled[twin.id] = 1; } return; }
    }
    byId[t.id] = t;
  });
  // what has been saved wins (an edit to a seeded team is saved under its id) — except a team just filled in above
  saved.forEach(function (t) { if (!filled[t.id]) byId[t.id] = t; });
  return Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (t) { return !t.deleted; });
}
function isoDate_(v) { const s = str_(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function cleanTrip_(t, campus) {
  const name = str_(t.name, 120);
  let from = isoDate_(t.from), to = isoDate_(t.to);
  if (!name) return null;
  /* A team that applied on the portal goes in at any stage, dates or not
     (candidateId); one added by hand still needs both, the right way round. */
  if (!t.candidateId && (!from || !to || to < from)) return null;
  if (from && to && to < from) { const x = from; from = to; to = x; }
  const rec = {
    id: str_(t.id, 60) || ('tt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
    campus: campus, name: name, org: str_(t.org, 120), country: cleanCountry_(t.country) || str_(t.country, 60), from: from, to: to,
    staff: str_(t.staff, 120), focus: str_(t.focus, 200), status: t.status === 'cancelled' ? 'cancelled' : 'active',
    notes: str_(t.notes, 1000), metrics: {}, reached: { male: null, female: null }
  };
  TEAM_COUNTS.forEach(function (k) { const n = finiteNum_(t[k], 0, 100000); rec[k] = n == null ? null : Math.round(n); });
  const m = (t.metrics && typeof t.metrics === 'object') ? t.metrics : {};
  Object.keys(m).forEach(function (k) {
    const key = str_(k, 80);
    if (!key || key === 'Teams Hosted' || SENSITIVE.indexOf(key) > -1) return;
    const n = finiteNum_(m[k], -1e9, 1e9);
    if (n != null) rec.metrics[key] = n;
  });
  const r = (t.reached && typeof t.reached === 'object') ? t.reached : {};
  rec.reached = { male: finiteNum_(r.male, 0, 1e9), female: finiteNum_(r.female, 0, 1e9) };
  return rec;
}
/* Volunteers Mobilized for a team is the team itself — everyone who came —
   so it is no longer typed in: for a team that leaves on or after
   TEAM_AUTO_FROM the figure is its head count (size), whatever was entered.
   Earlier teams keep the number logged for them, and one with none logged
   counts its head count too. */
const TEAM_AUTO_FROM = '2026-10-01';
const TEAM_AUTO_METRIC = 'Volunteers Mobilized';
function tripMetrics_(t) {
  const m = Object.assign({}, (t && t.metrics) || {});
  if (t && t.to && t.to >= TEAM_AUTO_FROM) {
    if (t.size != null && t.size !== '' && !isNaN(Number(t.size))) m[TEAM_AUTO_METRIC] = Number(t.size);
    else delete m[TEAM_AUTO_METRIC];
  } else if (t && (m[TEAM_AUTO_METRIC] == null || m[TEAM_AUTO_METRIC] === '') && t.size != null && t.size !== '' && !isNaN(Number(t.size))) m[TEAM_AUTO_METRIC] = Number(t.size);
  return m;
}
function teamEntryRows_(trips) {
  const acc = {};
  trips.forEach(function (t) {
    if (!t || t.status === 'cancelled' || !isoDate_(t.to)) return;
    const yr = weekYear_(t.to), wk = isoWeek_(t.to);
    const add = function (metric, v) {
      const k = t.campus + '|' + yr + '|' + wk + '|' + metric;
      if (!acc[k]) acc[k] = { campus: t.campus, dept: TEAM_DEPT, ministry: TEAM_MIN, metric: metric, week: wk, year: yr, value: 0, derived: true };
      acc[k].value += Number(v) || 0;
    };
    add('Teams Hosted', 1);
    const tm = tripMetrics_(t);
    Object.keys(tm).forEach(function (m) { add(m, tm[m]); });
  });
  return Object.keys(acc).map(function (k) { return acc[k]; });
}
/* ==================== a team application → the Teams Database ====================
   Every team application — at any stage, submitted or not, dates or not —
   IS a team in the Teams Database (the
   'teamTrips' blob, linked by candidateId), so Outreach Teams sees it the
   day it comes in. Its name, where it is from, its Siem Reap dates and head
   counts follow the application (syncTeamTrip_ on submit, on every answer
   change, and on close / reopen); its numbers — the Outreach Teams metrics —
   the team enters on the portal (portalSaveTeamNumbers) and staff can edit
   in the Teams Database as ever. Deleting it there keeps it deleted. */
function teamAnswers_(c) { return (c && c.portal && ((c.portal.form && c.portal.form.answers) || c.portal.draft)) || {}; }
function tripFromApp_(c, prev) {
  const a = teamAnswers_(c);
  const it = Array.isArray(a.itinerary) ? a.itinerary : [];
  let base = it.filter(function (r) { return r && r.base; })[0] || it[0] || {};
  if (!isoDate_(base.from) || !isoDate_(base.to)) {
    // an application from before the trip question: take its earliest and latest dates
    const dates = Object.keys(a).map(function (k) { return isoDate_(a[k]); }).filter(Boolean).sort();
    if (dates.length >= 2) base = { from: dates[0], to: dates[dates.length - 1] };
  }
  const cut = function (v, n) { return v == null ? '' : String(v).trim().slice(0, n); };
  // the application's answer when it has one, else what is already there (staff may have filled it in)
  const pick = function (v, was) { return v === undefined || v === null || v === '' ? (was === undefined ? null : was) : v; };
  const merged = Object.assign({ metrics: {}, reached: {} }, prev || {}, {
    id: prev ? prev.id : 'ta_' + c.id, candidateId: c.id,
    name: cut(a.teamName, 120) || c.name, org: cut(a.teamName, 120) || (prev && prev.org) || '',
    country: cut(a.location, 60) || (prev && prev.country) || c.country || '',
    from: isoDate_(base.from) || (prev && prev.from) || '', to: isoDate_(base.to) || (prev && prev.to) || '',
    size: pick(a.size, prev && prev.size), males: pick(a.males, prev && prev.males), females: pick(a.females, prev && prev.females),
    couples: pick(a.couples, prev && prev.couples),
    focus: cut(a.focus, 200) || (prev && prev.focus) || '',
    status: c.archived && !c.archived.left ? 'cancelled' : (prev && prev.status === 'cancelled' && c.archived && c.archived.left ? 'active' : (prev && prev.status) || 'active')
  });
  const rec = cleanTrip_(merged, c.campus || PORTAL_DEFAULT_CAMPUS);
  if (!rec) return null;
  rec.candidateId = c.id;
  return rec;
}
/* A team goes in the day its application exists — even one staff added in
   the CRM, or a draft with no dates yet (it waits off the calendar until it
   has them). Nothing is written when nothing changed, which keeps the draft
   autosave from rewriting the blob on every keystroke. */
async function syncTeamTrip_(c, by, status) {
  if (!c || c.type !== 'team') return null;
  const rows = await getTeamTripsRaw_();
  const idx = rows.findIndex(function (r) { return r && r.candidateId === c.id; });
  if (idx > -1 && rows[idx].deleted) return null;
  const prev = idx > -1 ? rows[idx] : null;
  const rec = tripFromApp_(c, prev);
  if (!rec) return null;   // no Siem Reap dates yet
  if (status) rec.status = status;
  const same = function (a, b) { const k = function (x) { const o = Object.assign({}, x); delete o.updated; delete o.updatedBy; return JSON.stringify(o); }; return k(a) === k(b); };
  if (prev && same(prev, rec)) return prev;
  rec.updated = new Date().toISOString(); rec.updatedBy = by;
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('teamTrips', rows);
  return rec;
}
async function linkedTrip_(c) {
  if (!c || c.type !== 'team') return null;
  return (await getTeamTripsRaw_()).find(function (r) { return r && r.candidateId === c.id && !r.deleted; }) || null;
}
function teamTripOut_(t) { return t ? { id: t.id, from: t.from, to: t.to, metrics: t.metrics || {}, reached: t.reached || {} } : null; }
/* Writes a team's numbers onto its linked team (made first if it is missing). */
async function saveTeamNumbers_(c, metrics, reached, by) {
  let trip = await linkedTrip_(c);
  if (!trip) trip = await syncTeamTrip_(c, by);
  if (!trip) return null;
  const rec = cleanTrip_(Object.assign({}, trip, { metrics: metrics && typeof metrics === 'object' ? metrics : {}, reached: reached && typeof reached === 'object' ? reached : {} }), trip.campus);
  if (!rec) return null;
  rec.candidateId = c.id; rec.updated = new Date().toISOString(); rec.updatedBy = by;
  const rows = await getTeamTripsRaw_();
  const idx = rows.findIndex(function (r) { return r && r.id === rec.id; });
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('teamTrips', rows);
  return rec;
}
/* The team's own numbers, from the portal: the same metrics the Teams
   Database form asks for, and men / women reached — once staff have ticked
   Arrived (the card is hidden before that, so it doesn't confuse them). */
async function portalSaveTeamNumbers(username, pin, metrics, reached) {
  const a = await applicantCand_(username, pin, true); if (a.out) return a.out;
  if (a.cand.type !== 'team') return { ok: false, err: 'not_team' };
  if (a.cand.stage !== 'arrived') return { ok: false, err: 'not_arrived' };
  if (!(await saveTeamNumbers_(a.cand, metrics, reached, a.s.id))) return { ok: false, err: 'no_trip' };
  return portalBoot(username, pin);
}
/* Staff put a team into the Teams Database from its record — the same sync,
   answered with why when it can't (no Siem Reap dates yet, or deleted there). */
async function portalStaffSyncTeam(username, pin, candidateId) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  if (a.cand.type !== 'team') return { ok: false, err: 'not_team' };
  const linked = (await getTeamTripsRaw_()).find(function (r) { return r && r.candidateId === a.cand.id; });
  if (linked && linked.deleted) return { ok: false, err: 'deleted' };
  const rec = await syncTeamTrip_(a.cand, a.s.id);
  if (!rec) return { ok: false, err: 'no_dates' };
  const staffRows = await getStaff_(); const byId = {}; staffRows.forEach(function (r) { byId[r.id] = r; });
  const out = portalCandOut_(a.cand, byId); out.teamTrip = teamTripOut_(rec);
  return { ok: true, candidate: out };
}
/* The same numbers from the staff side of the portal, for a team in scope. */
async function portalStaffSaveTeamNumbers(username, pin, candidateId, metrics, reached) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  if (a.cand.type !== 'team') return { ok: false, err: 'not_team' };
  const rec = await saveTeamNumbers_(a.cand, metrics, reached, a.s.id);
  if (!rec) return { ok: false, err: 'no_trip' };
  const staffRows = await getStaff_(); const byId = {}; staffRows.forEach(function (r) { byId[r.id] = r; });
  const out = portalCandOut_(a.cand, byId); out.teamTrip = teamTripOut_(rec);
  return { ok: true, candidate: out };
}
/* A team that applied on the portal is PENDING until its flights are
   confirmed — the itinerary uploaded, "flights confirmed" ticked, or the
   team past the documents stage. It shows in the Teams Database (and its
   calendar) from the day it applies, but its numbers only count on the
   dashboards once it is no longer pending. */
function teamFlightsIn_(c) {
  return hasDoc_(c, 'flights') || !!((c.portal && c.portal.visa) || {}).flightsConfirmed || portalStageIdx_(c.stage, 'team') >= portalStageIdx_('call2', 'team');
}
async function pendingTeamIds_() {
  const out = {};
  (await getCandidates_()).forEach(function (c) { if (c && c.type === 'team' && !c.archived && !teamFlightsIn_(c)) out[c.id] = c.stage; });
  return out;
}
async function withTeamRows_(rows) {
  const pend = await pendingTeamIds_();
  const derived = teamEntryRows_((await getTeamTrips_()).filter(function (t) { return !(t.candidateId && pend[t.candidateId]); }));
  if (!derived.length) return rows;
  const keyOf = function (r) { return r.campus + '|' + yearOf_(r) + '|' + Number(r.week) + '|' + r.metric; };
  const dk = {};
  derived.forEach(function (r) { dk[keyOf(r)] = 1; });
  return rows.filter(function (r) { return !(r.dept === TEAM_DEPT && r.ministry === TEAM_MIN && dk[keyOf(r)]); }).concat(derived);
}
/* Team applications from before the Teams Database link existed — or whose
   sync was missed — get their team the next time the Teams Database is read.
   Every open application with Siem Reap dates (submitted or still a draft)
   and no linked row at all: a team
   deleted there keeps its tombstone (with its candidateId), so it is not
   brought back. */
async function backfillTeamTrips_() {
  const cands = (await getCandidates_()).filter(function (c) { return c && c.type === 'team' && !c.archived; });
  if (!cands.length) return 0;
  const rows = await getTeamTripsRaw_();
  const have = {};
  rows.forEach(function (r) { if (r && r.candidateId) have[r.candidateId] = 1; });
  const now = new Date().toISOString();
  let added = 0;
  cands.forEach(function (c) {
    if (have[c.id]) return;
    const rec = tripFromApp_(c, null);
    if (!rec) return;   // no dates to put it on yet
    rec.updated = now; rec.updatedBy = 'portal';
    rows.push(rec); added++;
  });
  if (added) await writeJSON('teamTrips', rows);
  return added;
}
async function getTeamTrips(username, pin, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  campus = str_(campus, 40) || s.campus;
  await backfillTeamTrips_();
  const pend = await pendingTeamIds_();
  const trips = (await getTeamTrips_()).filter(function (t) { return t.campus === campus; })
    .map(function (t) { return t.candidateId && pend[t.candidateId] ? Object.assign({}, t, { pending: true, portalStage: pend[t.candidateId] }) : t; })
    .sort(function (a, b) { return a.from < b.from ? 1 : a.from > b.from ? -1 : 0; });
  return { ok: true, campus: campus, trips: trips, canEdit: canLogFor_(s, campus, TEAM_DEPT, TEAM_MIN) };
}
async function saveTeamTrip(username, pin, trip) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!trip || typeof trip !== 'object') return { ok: false, err: 'bad_trip' };
  const campus = str_(trip.campus, 40) || s.campus;
  if (!canLogFor_(s, campus, TEAM_DEPT, TEAM_MIN)) return { ok: false, err: 'not_authorized' };
  const rec = cleanTrip_(trip, campus);
  if (!rec) return { ok: false, err: 'bad_trip' };
  rec.updated = new Date().toISOString(); rec.updatedBy = s.id;
  const rows = await getTeamTripsRaw_();
  const idx = rows.findIndex(function (r) { return r && r.id === rec.id; });
  if (idx > -1 && rows[idx].candidateId) rec.candidateId = rows[idx].candidateId;   // still the portal application's team
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('teamTrips', rows);
  return getTeamTrips(username, pin, campus);
}
async function deleteTeamTrip(username, pin, id) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  id = str_(id, 60);
  const cur = (await getTeamTrips_()).find(function (t) { return t.id === id; });
  if (!cur) return { ok: false, err: 'not_found' };
  if (!canLogFor_(s, cur.campus, TEAM_DEPT, TEAM_MIN)) return { ok: false, err: 'not_authorized' };
  const rows = await getTeamTripsRaw_();
  const idx = rows.findIndex(function (r) { return r && r.id === id; });
  const tomb = { id: id, campus: cur.campus, deleted: true, updated: new Date().toISOString(), updatedBy: s.id };
  if (cur.candidateId) tomb.candidateId = cur.candidateId;   // so the application does not bring it back
  if (idx > -1) rows[idx] = tomb; else rows.push(tomb);
  await writeJSON('teamTrips', rows);
  return getTeamTrips(username, pin, cur.campus);
}

/* ==================== SR Hospitality ====================
   The hospitality team's booking book: the base's buildings, rooms and beds,
   and who sleeps in them when — guests, speakers, teams, students,
   volunteers, staff. One blob per campus ('hosp:<campus>') holds all of it:
     buildings [{id, name}]
     rooms     [{id, buildingId, name, style, notes, beds:[{id, label, out}]}]
     bookings  [{id, category, name, from, to, males, females, count, family,
                 bedIds, bedNames, people, notes, tripId, permanent}]
   people ([{name, sex:'m'|'f'|''}]) is everyone in a group booking — a school's
   students, a team's members — typed in or added from the team's portal.
   bedNames ({bedId: name}) says who of a team (or family) sleeps in which of
   its beds; the board shows them as "Name (Team)". A team's names come from
   its portal — leader, co-leaders and the members listed — with each
   request (`people`).
   A booking holds `count` beds from `from` (first night) to `to` (the
   morning they leave — that night is free again); a staff booking can be
   permanent (no `to`). It may name its beds (bedIds) or just hold the
   number until they are picked; a named bed can't be in two bookings on the
   same night, and a bed marked `out` (maintenance) takes nobody.

   Teams are not typed in twice: every team in the Teams Database with dates
   is a REQUEST here (getHospitality's `requests`) — the team, its dates and
   head counts, pending or not — until a booking is made for it (tripId).

   Who may open it: the Hospitality ministry (Skills Training) — its members,
   its leaders, the Skills Training overseer — and admins. Nobody else sees a
   name in it. */
const HOSP_DEPT = 'Skills Training', HOSP_MIN = 'Hospitality';
const HOSP_CATS = ['guest', 'speaker', 'team', 'student', 'volunteer', 'staff'];
const HOSP_STYLES = ['male', 'female', 'mixed', 'couple', 'family', 'guest', 'staff'];
const HOSP_MAX = { buildings: 50, rooms: 500, beds: 60, bookings: 5000 };
function canHosp_(s) {
  if (!s || isApplicant_(s) || s.active === false) return false;
  if (s.isAdmin) return true;
  return memberOf_(s, HOSP_DEPT, HOSP_MIN) || isLeaderOf_(s, HOSP_DEPT, HOSP_MIN) ||
    (deptOf_(s) === 'Campus Leadership' && s.ministry === HOSP_DEPT);
}
function hospKey_(campus) { return 'hosp:' + campus; }
/* The rooms and beds SR Hospitality starts from, taken from the base's own
   rooms sheet — layout only, no names (this repo is public; who sleeps where
   comes in through the app, by uploading the sheet or by hand). It is what a
   campus reads until its book is first saved; from then on the saved book is
   all there is. */
function hospSeedRooms_(buildingId, list) {
  return list.map(function (r) {
    return { id: 'hr_' + buildingId.replace(/^hb_/, '') + '_' + r[0].replace(/\s+/g, '').toLowerCase(), buildingId: buildingId, name: r[0], style: r[1], notes: r[3] || '',
      beds: 'ABCDEFGH'.slice(0, r[2]).split('').map(function (l) { return { id: 'bd_' + buildingId.replace(/^hb_/, '') + '_' + r[0].replace(/\s+/g, '').toLowerCase() + '_' + l, label: l, out: false }; }) };
  });
}
const HOSP_SEED = {
  siemreap: {
    buildings: [{ id: 'hb_old', name: 'Old Base' }, { id: 'hb_peace', name: 'Peace House' }],
    rooms: hospSeedRooms_('hb_old', [
      ['101', 'family', 2, 'First floor · Family room'],
      ['102', 'male', 6, 'First floor · Students'],
      ['103', 'male', 6, 'First floor · Students'],
      ['104', 'female', 8, 'First floor · Students'],
      ['201', 'family', 4, 'Family room'],
      ['202', 'family', 2, 'Family room'],
      ['203', 'male', 6, 'Second floor · Staff'],
      ['204', 'male', 6, 'Second floor · Staff'],
      ['205', 'female', 6, 'Second floor'],
      ['301', 'family', 4, 'Family room'],
      ['302', 'couple', 2, 'Couple room'],
      ['303', 'female', 6, 'Third floor'],
      ['304', 'female', 8, 'Third floor'],
      ['305', 'male', 8, 'Third floor'],
      ['401', 'guest', 1, 'Training speaker / teacher'],
      ['402', 'couple', 2, 'Couple room']
    ]).concat(hospSeedRooms_('hb_peace', [
      ['Unit 1', 'family', 2, 'Floor 0'],
      ['Unit 2', 'family', 3, 'Floor 1'],
      ['Unit 3', 'family', 3, 'Floor 1'],
      ['Unit 4', 'family', 2, 'Floor 2'],
      ['Unit 5', 'family', 2, 'Floor 2'],
      ['Unit 6', 'family', 3, 'Floor 3'],
      ['Unit 7', 'family', 3, 'Floor 3']
    ])),
    bookings: []
  }
};
async function getHosp_(campus) {
  const stored = await readJSON(hospKey_(campus), null);
  const d = stored && typeof stored === 'object' ? stored : (HOSP_SEED[campus] ? JSON.parse(JSON.stringify(HOSP_SEED[campus])) : {});
  return {
    buildings: Array.isArray(d.buildings) ? d.buildings : [],
    rooms: Array.isArray(d.rooms) ? d.rooms : [],
    bookings: Array.isArray(d.bookings) ? d.bookings : []
  };
}
function hospId_(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function hospCount_(v) { const n = finiteNum_(v, 0, 10000); return n == null ? 0 : Math.round(n); }
/* Two stays share a night when one starts before the other ends; a
   permanent one never ends. */
function hospOverlap_(a, b) {
  const aEnd = a.permanent ? '9999-12-31' : a.to, bEnd = b.permanent ? '9999-12-31' : b.to;
  return a.from < bEnd && b.from < aEnd;
}
function cleanHospBuilding_(b) {
  const name = str_(b && b.name, 80);
  if (!name) return null;
  return { id: str_(b.id, 60) || hospId_('hb'), name: name };
}
function cleanHospRoom_(r, d) {
  const name = str_(r && r.name, 60);
  const buildingId = str_(r && r.buildingId, 60);
  if (!name || !buildingId || !d.buildings.some(function (b) { return b.id === buildingId; })) return null;
  const seen = {};
  const beds = (Array.isArray(r.beds) ? r.beds : []).slice(0, HOSP_MAX.beds).map(function (b) {
    const label = str_(b && b.label, 20);
    if (!label) return null;
    let id = str_(b.id, 60) || hospId_('bd');
    if (seen[id]) id = hospId_('bd');
    seen[id] = 1;
    return { id: id, label: label, out: !!b.out };
  }).filter(Boolean);
  return {
    id: str_(r.id, 60) || hospId_('hr'), buildingId: buildingId, name: name,
    style: HOSP_STYLES.indexOf(r.style) > -1 ? r.style : 'mixed', notes: str_(r.notes, 300) || '', beds: beds
  };
}
function cleanHospBooking_(k) {
  const name = str_(k && k.name, 120);
  const category = HOSP_CATS.indexOf(k && k.category) > -1 ? k.category : null;
  const from = isoDate_(k && k.from);
  // staying until someone changes it: staff, and students and volunteers who live here
  const permanent = !!(k && k.permanent) && ['staff', 'student', 'volunteer'].indexOf(category) > -1;
  const to = permanent ? '' : isoDate_(k && k.to);
  if (!name || !category || !from || (!permanent && (!to || to <= from))) return null;
  const males = hospCount_(k.males), females = hospCount_(k.females);
  const bedIds = [];
  (Array.isArray(k.bedIds) ? k.bedIds : []).forEach(function (b) { const id = str_(b, 60); if (id && bedIds.indexOf(id) === -1) bedIds.push(id); });
  const people = [], seenP = {};
  (Array.isArray(k.people) ? k.people : []).slice(0, 300).forEach(function (p) {
    const n = str_(p && p.name, 80); if (!n || seenP[n.toLowerCase()]) return;
    seenP[n.toLowerCase()] = 1; people.push({ name: n, sex: p.sex === 'm' || p.sex === 'f' ? p.sex : '' });
  });
  const count = Math.max(hospCount_(k.count), males + females, bedIds.length, people.length, 1);
  const bedNames = {}, kept = bedIds.slice(0, count), rawNames = k.bedNames && typeof k.bedNames === 'object' ? k.bedNames : {};
  kept.forEach(function (id) { const n = str_(rawNames[id], 80); if (n) bedNames[id] = n; });
  return {
    id: str_(k.id, 60) || hospId_('hk'), category: category, name: name, from: from, to: to, permanent: permanent,
    males: males, females: females, count: count, family: !!k.family, bedIds: kept, bedNames: bedNames, people: people,
    notes: str_(k.notes, 1000) || '', tripId: str_(k.tripId, 60) || '', stayId: str_(k.stayId, 60) || ''
  };
}
/* ---- a guest or speaker asks for a room (Oct 2026, Uriah) ----
   SR Hospitality copies a link — portal.html?stay=<campus> — and sends it to
   a guest or speaker coming for a short stay. They fill in a short form (no
   account): name, guest or speaker, the dates, how many men and women, a
   phone or email, who invited them, notes. It lands in Hospitality's
   Requests like a team does; "Book beds" fills the booking in from it
   (stayId links the two) and Decline takes it off the list. One blob per
   campus, 'stayReq:<campus>' = { reqs: [...] }. */
const STAY_MAX_OPEN = 200;
function stayKey_(campus) { return 'stayReq:' + campus; }
async function getStays_(campus) { const b = await readJSON(stayKey_(campus), { reqs: [] }); return Array.isArray(b && b.reqs) ? b.reqs : []; }
async function stayRequest(campus, p) {
  campus = HR_CAMPUSES.indexOf(campus) > -1 ? campus : '';
  if (!campus) return { ok: false, err: 'bad_campus' };
  p = p && typeof p === 'object' ? p : {};
  if (p.website) return { ok: true };   // a robot filled the hidden box: say thanks, keep nothing
  const name = dutyText_(p.name, 120);
  if (!name) return { ok: false, err: 'name_required' };
  const today = new Date().toISOString().slice(0, 10), from = isoDate_(p.from), to = isoDate_(p.to);
  if (!from || !to || to <= from) return { ok: false, err: 'bad_dates' };
  if (from < addDays_(today, -1) || from > addDays_(today, 730) || to > addDays_(from, 120)) return { ok: false, err: 'bad_dates' };
  const males = Math.min(50, hospCount_(p.males)), females = Math.min(50, hospCount_(p.females));
  const count = Math.max(males + females, 1);
  const email = cleanEmail_(p.email) || '', phone = str_(p.phone, 40);
  if (!email && !phone) return { ok: false, err: 'contact_required' };
  const reqs = (await getStays_(campus)).filter(function (r) { return r.to >= addDays_(today, -30); });
  if (reqs.filter(function (r) { return r.status !== 'declined'; }).length >= STAY_MAX_OPEN) return { ok: false, err: 'too_many' };
  reqs.push({ id: hospId_('sr'), name: name, category: p.category === 'speaker' ? 'speaker' : 'guest', from: from, to: to, males: males, females: females, count: count,
    email: email, phone: phone, org: str_(p.org, 120), notes: str_(p.notes, 1000), at: new Date().toISOString(), status: 'new' });
  await writeJSON(stayKey_(campus), { reqs: reqs });
  return { ok: true };
}
/* Hospitality declines one (it goes off the list) — or brings it back */
async function hospStayStatus(username, pin, id, status) {
  const a = await hospAuth_(username, pin); if (a.out) return a.out;
  const reqs = await getStays_(a.s.campus), r = reqs.find(function (x) { return x.id === str_(id, 60); });
  if (!r) return { ok: false, err: 'not_found' };
  r.status = status === 'declined' ? 'declined' : 'new'; r.by = a.s.id; r.updated = new Date().toISOString();
  await writeJSON(stayKey_(a.s.campus), { reqs: reqs });
  return getHospitality(username, pin);
}
/* Every team in the Teams Database with dates that hasn't left yet is a bed
   request until a booking points at it. */
/* Everyone a team's leader has listed on the portal: the leader, co-leaders
   and the members — [{name, sex:'m'|'f'|''}]. */
function teamPeople_(c) {
  if (!c) return [];
  const a = teamAnswers_(c), out = [], seen = {};
  const add = function (n, sex) { n = str_(n, 80); if (!n || seen[n.toLowerCase()]) return; seen[n.toLowerCase()] = 1; out.push({ name: n, sex: sex === 'm' || sex === 'f' ? sex : '' }); };
  add(a.leaderName || c.name, '');
  (Array.isArray(a.coLeaders) ? a.coLeaders : []).forEach(function (p) { add(p && p.name, p && p.sex); });
  ((c.portal && c.portal.members) || []).forEach(function (p) { add(p && p.name, p && p.sex); });
  return out;
}
async function hospRequests_(campus, bookings) {
  const today = new Date().toISOString().slice(0, 10);
  const pend = await pendingTeamIds_();
  const byCand = {};
  (await getCandidates_()).forEach(function (c) { if (c && c.id) byCand[c.id] = c; });
  const booked = {}, bookedStay = {};
  bookings.forEach(function (k) { if (k.tripId) booked[k.tripId] = k.id; if (k.stayId) bookedStay[k.stayId] = k.id; });
  /* a team whose application was deleted in the portal is gone too */
  const goneCand = function (t) { return !!(t.candidateId && !byCand[t.candidateId]); };
  const trips = await getTeamTrips_();
  const live = trips.filter(function (t) {
    return t.campus === campus && t.status !== 'cancelled' && !goneCand(t) && t.from && t.to && t.to >= today;
  });
  /* A team cancelled (closed in the portal, or cancelled in the Teams
     Database) or deleted while its beds are booked: the booking stays until
     someone frees the beds, so it shows here as cancelled. */
  const liveIds = {}, tripById = {};
  live.forEach(function (t) { liveIds[t.id] = 1; });
  trips.forEach(function (t) { tripById[t.id] = t; });
  const raw = {}; (await getTeamTripsRaw_()).forEach(function (r) { if (r && r.id) raw[r.id] = r; });
  const gone = bookings.filter(function (k) { return k.tripId && !liveIds[k.tripId] && !k.permanent && k.to && k.to >= today; }).map(function (k) {
    const t = tripById[k.tripId], r = raw[k.tripId];
    const why = !t || (r && r.deleted) || goneCand(t) ? 'deleted' : t.status === 'cancelled' ? 'cancelled' : '';
    if (!why || (t && t.campus !== campus)) return null;
    return { tripId: k.tripId, name: (t && t.name) || k.name, country: (t && t.country) || '', from: k.from, to: k.to,
      size: null, males: k.males == null ? null : k.males, females: k.females == null ? null : k.females, couples: null,
      pending: false, portalStage: '', candidateId: t && !goneCand(t) ? t.candidateId || '' : '', bookingId: k.id, people: [],
      cancelled: why, count: Number(k.count) || 0 };
  }).filter(Boolean);
  return live.map(function (t) {
    return {
      tripId: t.id, name: t.name, country: t.country || '', from: t.from, to: t.to,
      size: t.size == null ? null : t.size, males: t.males == null ? null : t.males, females: t.females == null ? null : t.females,
      couples: t.couples == null ? null : t.couples,
      pending: !!(t.candidateId && pend[t.candidateId]), portalStage: (t.candidateId && pend[t.candidateId]) || '',
      candidateId: t.candidateId || '', bookingId: booked[t.id] || '',
      people: teamPeople_(t.candidateId && byCand[t.candidateId])
    };
  }).concat(gone, (await getStays_(campus)).filter(function (r) { return r.status !== 'declined' && r.to >= today; }).map(function (r) {
    return { stayId: r.id, kind: 'stay', category: r.category, tripId: '', name: r.name, country: '', from: r.from, to: r.to, size: r.count,
      males: r.males, females: r.females, couples: null, pending: false, portalStage: '', candidateId: '', bookingId: bookedStay[r.id] || '',
      people: [{ name: r.name, sex: '' }], email: r.email || '', phone: r.phone || '', org: r.org || '', notes: r.notes || '', at: r.at };
  })).sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
}
/* Every write of a campus's rooms and bookings goes through here, so a team's
   "Rooms booked" step in the portal (teamSteps_) keeps up: for each team trip
   with a booking, cand.portal.rooms = {beds, from, to}; null once there is
   none. A failure here never undoes the booking. */
async function saveHosp_(campus, d) {
  await writeJSON(hospKey_(campus), d);
  try { await syncTeamRooms_(campus, d.bookings); } catch (e) { console.error('rooms sync', e); }
}
async function syncTeamRooms_(campus, bookings) {
  const byTrip = {};
  (bookings || []).forEach(function (k) {
    if (!k || !k.tripId) return;
    const beds = Number(k.count) || (k.bedIds || []).length || 0, b = byTrip[k.tripId];
    if (!b) byTrip[k.tripId] = { beds: beds, from: k.from || '', to: k.to || '' };
    else { b.beds += beds; if (k.from && k.from < b.from) b.from = k.from; if (k.to && k.to > b.to) b.to = k.to; }
  });
  const trips = (await getTeamTrips_()).filter(function (t) { return t && t.campus === campus && t.candidateId; });
  if (!trips.length) return;
  const rows = await getCandidates_();
  let changed = false;
  trips.forEach(function (t) {
    const c = rows.find(function (r) { return r && r.id === t.candidateId; });
    if (!c) return;
    const want = byTrip[t.id] || null, have = (c.portal && c.portal.rooms) || null;
    if (JSON.stringify(want) === JSON.stringify(have)) return;
    c.portal = c.portal || {}; c.portal.rooms = want; changed = true;
  });
  if (changed) await writeJSON('candidates', rows);
}
/* ==================== Who's here (Oct 2026, Uriah) ====================
   Everyone on a campus tonight, for Base's "On campus now" and its page:
   - staff on the campus, each marked away when an approved (or noted) trip or
     leave covers today — the page dims them with "Off campus right now";
   - from SR Hospitality's bookings that cover tonight: teams (their people from
     the portal — the leader, co-leaders and members the leader listed), students,
     volunteers, guests and speakers.
   Staff come back as ids (the page has their names and photos already); team
   photos are a separate call per team (whosHereTeamPhotos), as they are heavy. */
const WHOS_KINDS = ['team', 'student', 'volunteer', 'guest', 'speaker'];
function whoNames_(k) {
  const names = [];
  (k.people || []).forEach(function (p) { const n = dutyText_(p && p.name, 120); if (n && names.indexOf(n) === -1) names.push(n); });
  Object.keys(k.bedNames || {}).forEach(function (b) { const n = dutyText_(k.bedNames[b], 120); if (n && names.indexOf(n) === -1) names.push(n); });
  return names;
}
async function getWhosHere(username, pin, campus) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false, err: 'auth' };
  campus = CAMPUS_IDS_.indexOf(campus) > -1 ? campus : s.campus;
  const today = baseToday_();
  const away = {};
  (await getTrips_()).forEach(function (t) {
    if (t && (t.status === 'approved' || t.status === 'noted') && t.from <= today && today <= t.to) away[t.staffId] = { type: leaveTypeOf_(t), to: t.to };
  });
  const staff = (await getStaff_()).filter(function (r) { return r && r.active !== false && !r.archived && !isApplicant_(r) && r.campus === campus; })
    .map(function (r) { return { id: r.id, away: away[r.id] || null }; });
  const groups = { team: [], student: [], volunteer: [], guest: [], speaker: [] };
  if (campus === 'siemreap' || (await readJSON(hospKey_(campus), null))) {
    const d = await getHosp_(campus), trips = await getTeamTrips_(), cands = await getCandidates_();
    d.bookings.forEach(function (k) {
      if (!k || WHOS_KINDS.indexOf(k.category) === -1) return;
      if (!(k.from && k.from <= today && (k.permanent || (k.to && k.to > today)))) return;
      const n = Math.max(Number(k.count) || 0, (k.bedIds || []).length);
      if (k.category === 'team') {
        const trip = k.tripId ? trips.find(function (t) { return t.id === k.tripId; }) : null;
        const cand = trip && trip.candidateId ? cands.find(function (c) { return c && c.id === trip.candidateId; }) : null;
        const people = cand ? teamPhotoPeople_(cand).map(function (p) { return { key: p.key, name: p.name, role: p.role }; }) : whoNames_(k).map(function (nm) { return { key: '', name: nm, role: '' }; });
        groups.team.push({ name: (trip && trip.name) || k.name, from: k.from, to: k.to || '', count: Math.max(n, people.length), people: people, candidateId: cand ? cand.id : '' });
        return;
      }
      const names = whoNames_(k);
      groups[k.category].push({ name: k.name, from: k.from, to: k.to || '', permanent: !!k.permanent, count: Math.max(n, names.length, 1), names: names });
    });
  }
  const others = WHOS_KINDS.reduce(function (sum, kind) { return sum + groups[kind].reduce(function (a, g) { return a + g.count; }, 0); }, 0);
  const staffHere = staff.filter(function (x) { return !x.away; }).length;
  return { ok: true, campus: campus, date: today, staff: staff, groups: groups, count: staffHere + others, staffHere: staffHere, staffAway: staff.length - staffHere };
}
async function whosHereTeamPhotos(username, pin, candidateId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false, err: 'auth' };
  const cand = (await getCandidates_()).find(function (c) { return c && c.id === str_(candidateId, 60) && c.type === 'team'; });
  if (!cand || (cand.campus && cand.campus !== s.campus && !s.isAdmin)) return { ok: false, err: 'not_found' };
  const store = await getTeamPhotos_(cand), out = {};
  teamPhotoPeople_(cand).forEach(function (p) { const ph = store.photos && store.photos[p.key]; if (ph && ph.data) out[p.key] = ph.data; });
  return { ok: true, photos: out };
}
async function hospAuth_(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { out: { ok: false } };
  if (!canHosp_(s)) return { out: { ok: false, err: 'not_authorized' } };
  return { s: s };
}
async function getHospitality(username, pin) {
  const a = await hospAuth_(username, pin); if (a.out) return a.out;
  const campus = a.s.campus;
  await backfillTeamTrips_();
  const d = await getHosp_(campus);
  try { await syncTeamRooms_(campus, d.bookings); } catch (e) { console.error('rooms sync', e); }   // catches up teams booked before the step existed; writes only on a change
  return { ok: true, campus: campus, buildings: d.buildings, rooms: d.rooms, bookings: d.bookings, requests: await hospRequests_(campus, d.bookings) };
}
/* One save for all three kinds — a building, a room (with its beds), a
   booking — so the page has one call to make and one answer to read. */
async function hospSave(username, pin, kind, rec) {
  const a = await hospAuth_(username, pin); if (a.out) return a.out;
  if (!rec || typeof rec !== 'object') return { ok: false, err: 'bad_record' };
  const campus = a.s.campus;
  const d = await getHosp_(campus);
  const list = kind === 'building' ? d.buildings : kind === 'room' ? d.rooms : kind === 'booking' ? d.bookings : null;
  if (!list) return { ok: false, err: 'bad_kind' };
  const clean = kind === 'building' ? cleanHospBuilding_(rec) : kind === 'room' ? cleanHospRoom_(rec, d) : cleanHospBooking_(rec);
  if (!clean) return { ok: false, err: 'bad_record' };
  const idx = list.findIndex(function (x) { return x.id === clean.id; });
  if (idx === -1 && list.length >= HOSP_MAX[kind + 's']) return { ok: false, err: 'too_many' };
  if (kind === 'booking') {
    const beds = {};
    d.rooms.forEach(function (r) { r.beds.forEach(function (b) { beds[b.id] = b; }); });
    if (clean.bedIds.some(function (id) { return !beds[id]; })) return { ok: false, err: 'no_such_bed' };
    if (clean.bedIds.some(function (id) { return beds[id].out; })) return { ok: false, err: 'bed_out' };
    const clash = d.bookings.find(function (o) {
      return o.id !== clean.id && hospOverlap_(o, clean) && (o.bedIds || []).some(function (id) { return clean.bedIds.indexOf(id) > -1; });
    });
    if (clash) return { ok: false, err: 'bed_taken', with: clash.name };
    if (clean.tripId && d.bookings.some(function (o) { return o.id !== clean.id && o.tripId === clean.tripId; })) return { ok: false, err: 'already_booked' };
    if (clean.stayId && d.bookings.some(function (o) { return o.id !== clean.id && o.stayId === clean.stayId; })) return { ok: false, err: 'already_booked' };
  }
  clean.updated = new Date().toISOString(); clean.updatedBy = a.s.id;
  if (idx > -1) list[idx] = clean; else list.push(clean);
  if (kind === 'room') {
    // a bed taken out of the room comes out of every booking that held it
    const ids = {};
    d.rooms.forEach(function (r) { r.beds.forEach(function (b) { ids[b.id] = 1; }); });
    d.bookings.forEach(function (k) { k.bedIds = (k.bedIds || []).filter(function (id) { return ids[id]; }); });
  }
  await saveHosp_(campus, d);
  const out = await getHospitality(username, pin);
  out.saved = clean;
  return out;
}
/* Staff who live here, set bed by bed. A staff bed is a permanent staff
   booking on one bed — so it is taken on every night from then on, in the
   bed picker, the board and the numbers, with nothing else to keep in step.
   The page sends who should be in each bed ({bedId: name}, '' for nobody)
   for the beds it shows; this makes the bookings match:
     same name as now      nothing changes
     a name that was in another staff bed   that booking moves (keeps its start)
     a new name            a new permanent booking from today
     emptied / replaced    the old booking ends today (or goes, if it began today)
   A bed someone else holds from today on can't be given to a staff member. */
function isStaffBed_(k) { return k && k.category === 'staff' && k.permanent && (k.bedIds || []).length === 1; }
async function hospStaffBeds(username, pin, map) {
  const a = await hospAuth_(username, pin); if (a.out) return a.out;
  if (!map || typeof map !== 'object') return { ok: false, err: 'bad_record' };
  const campus = a.s.campus, d = await getHosp_(campus);
  const today = new Date().toISOString().slice(0, 10), now = new Date().toISOString();
  const beds = {};
  d.rooms.forEach(function (r) { r.beds.forEach(function (b) { beds[b.id] = b; }); });
  const want = {};
  for (const id of Object.keys(map)) {
    if (!beds[id]) return { ok: false, err: 'no_such_bed' };
    const n = str_(map[id], 120) || '';
    if (n && beds[id].out) return { ok: false, err: 'bed_out' };
    want[id] = n;
  }
  const staff = d.bookings.filter(isStaffBed_), byBed = {}, byName = {};
  staff.forEach(function (k) { byBed[k.bedIds[0]] = k; byName[k.name.toLowerCase()] = k; });
  const end = function (k) { if (k.from >= today) d.bookings.splice(d.bookings.indexOf(k), 1); else { k.permanent = false; k.to = today; k.updated = now; k.updatedBy = a.s.id; } };
  const moved = {}, add = [];
  Object.keys(want).forEach(function (id) {
    const n = want[id], cur = byBed[id];
    if (cur && n && cur.name.toLowerCase() === n.toLowerCase()) { moved[cur.id] = 1; return; }
    if (!n) return;
    const other = byName[n.toLowerCase()];
    // the same person, from a bed that is being given to someone else (or emptied)
    if (other && other.bedIds[0] !== id && Object.prototype.hasOwnProperty.call(want, other.bedIds[0]) && (want[other.bedIds[0]] || '').toLowerCase() !== n.toLowerCase()) {
      moved[other.id] = id; return;
    }
    add.push({ bed: id, name: n });
  });
  // what is in the way: someone not a staff bed holding the bed from today on
  const check = function (bed) {
    const clash = d.bookings.find(function (o) { return !isStaffBed_(o) && hospOverlap_(o, { from: today, permanent: true }) && (o.bedIds || []).indexOf(bed) > -1; });
    return clash ? { ok: false, err: 'bed_taken', with: clash.name, bed: bed } : null;
  };
  for (const kId of Object.keys(moved)) { if (moved[kId] !== 1) { const c = check(moved[kId]); if (c) return c; } }
  for (const x of add) { const c = check(x.bed); if (c) return c; }
  // end the ones whose bed now has nobody or someone else, and who aren't moving
  staff.forEach(function (k) {
    const id = k.bedIds[0];
    if (!Object.prototype.hasOwnProperty.call(want, id) || moved[k.id]) return;
    end(k);
  });
  Object.keys(moved).forEach(function (kId) {
    if (moved[kId] === 1) return;
    const k = d.bookings.find(function (x) { return x.id === kId; });
    k.bedIds = [moved[kId]]; k.bedNames = {}; k.updated = now; k.updatedBy = a.s.id;
  });
  add.forEach(function (x) {
    if (d.bookings.length >= HOSP_MAX.bookings) return;
    d.bookings.push({ id: hospId_('hk'), category: 'staff', name: x.name, from: today, to: '', permanent: true, males: 0, females: 0, count: 1, family: false,
      bedIds: [x.bed], bedNames: {}, notes: '', tripId: '', created: now, createdBy: a.s.id, updated: now, updatedBy: a.s.id });
  });
  await saveHosp_(campus, d);
  return getHospitality(username, pin);
}
/* The bed board's one move, done in one write so a swap can't half-happen:
   booking `bookingId` gives up `fromBed` (or '' — a person not in a bed yet)
   and takes `toBed` (or '' — just take them off the bed). If someone else
   holds `toBed` on a night they share, the two swap beds — as long as that
   leaves nobody in a bed a third booking already has. A move is for the
   whole stay, not one night. */
async function hospMoveBed(username, pin, bookingId, fromBed, toBed) {
  const a = await hospAuth_(username, pin); if (a.out) return a.out;
  bookingId = str_(bookingId, 60); fromBed = str_(fromBed, 60) || ''; toBed = str_(toBed, 60) || '';
  const campus = a.s.campus;
  const d = await getHosp_(campus);
  const A = d.bookings.find(function (k) { return k.id === bookingId; });
  if (!A) return { ok: false, err: 'not_found' };
  A.bedIds = A.bedIds || [];
  if (fromBed && A.bedIds.indexOf(fromBed) === -1) return { ok: false, err: 'not_in_bed' };
  if (!fromBed && !toBed) return { ok: false, err: 'bad_move' };
  const beds = {};
  d.rooms.forEach(function (r) { r.beds.forEach(function (b) { beds[b.id] = b; }); });
  const now = new Date().toISOString();
  if (toBed) {
    if (!beds[toBed]) return { ok: false, err: 'no_such_bed' };
    if (beds[toBed].out) return { ok: false, err: 'bed_out' };
    if (toBed === fromBed || A.bedIds.indexOf(toBed) > -1) return { ok: false, err: 'same_bed' };
    if (!fromBed && A.bedIds.length >= A.count) return { ok: false, err: 'all_placed' };
    const holders = d.bookings.filter(function (o) { return o.id !== A.id && hospOverlap_(o, A) && (o.bedIds || []).indexOf(toBed) > -1; });
    if (holders.length > 1 || (holders.length && !fromBed)) return { ok: false, err: 'bed_taken', with: holders[0].name };
    if (holders.length) {
      const B = holders[0];
      // B moves into A's old bed: nobody else (but A) may hold it on B's nights
      const third = d.bookings.find(function (o) { return o.id !== A.id && o.id !== B.id && hospOverlap_(o, B) && (o.bedIds || []).indexOf(fromBed) > -1; });
      if (third) return { ok: false, err: 'bed_taken', with: third.name };
      if (B.bedIds.indexOf(fromBed) > -1) return { ok: false, err: 'same_bed' };
      B.bedIds = B.bedIds.map(function (id) { return id === toBed ? fromBed : id; });
      if (B.bedNames && B.bedNames[toBed]) { B.bedNames[fromBed] = B.bedNames[toBed]; delete B.bedNames[toBed]; }
      B.updated = now; B.updatedBy = a.s.id;
    }
  }
  A.bedIds = fromBed ? A.bedIds.map(function (id) { return id === fromBed ? toBed : id; }).filter(Boolean) : A.bedIds.concat([toBed]);
  // the person in the bed goes with it (or comes off with it)
  if (fromBed && A.bedNames && A.bedNames[fromBed]) { if (toBed) A.bedNames[toBed] = A.bedNames[fromBed]; delete A.bedNames[fromBed]; }
  A.updated = now; A.updatedBy = a.s.id;
  await saveHosp_(campus, d);
  return getHospitality(username, pin);
}
/* Bringing a whole house in at once — the rooms, beds and who sleeps where —
   from a spreadsheet, so moving off the old sheet is one upload, not an
   afternoon of tapping. The page reads the CSV and sends its rows:
     { building, room, style, bed, name, category }
   Buildings, rooms and beds are made when they are not there yet (matched by
   name, so importing twice adds nothing twice) and a name puts that person
   in that bed from today, staying until someone changes it (permanent —
   residents have no leaving date). In a family or couple room the rows with
   one name are one booking over all its beds; anywhere else each row is its
   own person (two people can share a first name). A bed someone already has
   is left alone and reported. Hospitality ministry and admins only, like the
   rest of SR Hospitality. */
const HOSP_IMPORT_MAX = 2000;
const HOSP_STAY_CATS = ['staff', 'student', 'volunteer'];
async function hospImport(username, pin, rows) {
  const a = await hospAuth_(username, pin); if (a.out) return a.out;
  if (!Array.isArray(rows) || !rows.length) return { ok: false, err: 'empty' };
  if (rows.length > HOSP_IMPORT_MAX) return { ok: false, err: 'too_many' };
  const campus = a.s.campus, d = await getHosp_(campus);
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const key = function (v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); };
  const out = { buildings: 0, rooms: 0, beds: 0, people: 0, skipped: [] };
  const groups = {}, order = [];
  rows.forEach(function (r) {
    r = r && typeof r === 'object' ? r : {};
    const bName = str_(r.building, 80), rName = str_(r.room, 60), label = str_(r.bed, 20);
    if (!bName || !rName) return;
    let b = d.buildings.find(function (x) { return key(x.name) === key(bName); });
    if (!b) {
      if (d.buildings.length >= HOSP_MAX.buildings) return;
      b = { id: hospId_('hb'), name: bName, updated: now, updatedBy: a.s.id }; d.buildings.push(b); out.buildings++;
    }
    let room = d.rooms.find(function (x) { return x.buildingId === b.id && key(x.name) === key(rName); });
    if (!room) {
      if (d.rooms.length >= HOSP_MAX.rooms) return;
      room = { id: hospId_('hr'), buildingId: b.id, name: rName, style: HOSP_STYLES.indexOf(key(r.style)) > -1 ? key(r.style) : 'mixed', notes: str_(r.notes, 300) || '', beds: [], updated: now, updatedBy: a.s.id };
      d.rooms.push(room); out.rooms++;
    }
    if (!label) return;
    let bed = room.beds.find(function (x) { return key(x.label) === key(label); });
    if (!bed) {
      if (room.beds.length >= HOSP_MAX.beds) return;
      bed = { id: hospId_('bd'), label: label, out: false }; room.beds.push(bed); out.beds++;
    }
    const name = str_(r.name, 120);
    if (!name) return;
    const cat = HOSP_STAY_CATS.indexOf(key(r.category)) > -1 ? key(r.category) : 'staff';
    const together = room.style === 'family' || room.style === 'couple';
    const g = together ? room.id + '|' + key(name) : room.id + '|' + bed.id;
    if (!groups[g]) { groups[g] = { name: name, category: cat, family: together, bedIds: [], room: room }; order.push(g); }
    if (groups[g].bedIds.indexOf(bed.id) === -1) groups[g].bedIds.push(bed.id);
  });
  order.forEach(function (g) {
    const p = groups[g];
    const holder = d.bookings.find(function (k) { return hospOverlap_(k, { from: today, to: '', permanent: true }) && (k.bedIds || []).some(function (id) { return p.bedIds.indexOf(id) > -1; }); });
    if (holder) { out.skipped.push({ name: p.name, room: p.room.name, with: holder.name }); return; }
    if (d.bookings.length >= HOSP_MAX.bookings) { out.skipped.push({ name: p.name, room: p.room.name, with: '' }); return; }
    d.bookings.push({ id: hospId_('hk'), category: p.category, name: p.name, from: today, to: '', permanent: true,
      males: 0, females: 0, count: p.bedIds.length, family: p.family && p.bedIds.length > 1, bedIds: p.bedIds, notes: '', tripId: '', updated: now, updatedBy: a.s.id });
    out.people++;
  });
  await saveHosp_(campus, d);
  const res = await getHospitality(username, pin);
  res.imported = out;
  return res;
}
async function hospDelete(username, pin, kind, id) {
  const a = await hospAuth_(username, pin); if (a.out) return a.out;
  id = str_(id, 60);
  const campus = a.s.campus;
  const d = await getHosp_(campus);
  const list = kind === 'building' ? d.buildings : kind === 'room' ? d.rooms : kind === 'booking' ? d.bookings : null;
  if (!list) return { ok: false, err: 'bad_kind' };
  const idx = list.findIndex(function (x) { return x.id === id; });
  if (idx === -1) return { ok: false, err: 'not_found' };
  if (kind === 'building' && d.rooms.some(function (r) { return r.buildingId === id; })) return { ok: false, err: 'not_empty' };
  if (kind === 'room') {
    const gone = {};
    list[idx].beds.forEach(function (b) { gone[b.id] = 1; });
    const today = new Date().toISOString().slice(0, 10);
    if (d.bookings.some(function (k) { return (k.permanent || k.to > today) && (k.bedIds || []).some(function (b) { return gone[b]; }); })) return { ok: false, err: 'in_use' };
    d.bookings.forEach(function (k) { k.bedIds = (k.bedIds || []).filter(function (b) { return !gone[b]; }); });
  }
  list.splice(idx, 1);
  await saveHosp_(campus, d);
  return getHospitality(username, pin);
}

/* ==================== weekly schedules ====================
   Two schedules the base sends out every Sunday for the week ahead: the
   Culinary team's cooking schedule (meals and dishes, day by day — a GRID of
   rows × days) and Hospitality's morning chores (places, what to do there and
   who — a LIST in sections). The ministry that owns one makes it each week on
   its My Ministry page (canLogFor_, so its members, leaders, overseer and
   admins); once published, everyone on the campus sees it on My Home, and a
   team that has arrived sees it in the portal.

   One blob per campus, 'duty:<campus>' = { kitchen: { weeks: { 'YYYY-MM-DD'
   (the Sunday it starts): sched }, extras: [names typed in by hand] },
   chores: {…} }. A week holds its own copy of the rows, so changing next
   week's rows never rewrites an old one; a week not made yet starts as a
   copy of the latest one before it, names and all (most duties carry over),
   else from the template below — rows only, no names: this repo is public.

   Names are plain strings, picked from the people here that week
   (dutyPeople_): campus staff first, other staff, every member of a team
   whose dates cover the week (from its portal application), guests booked in
   SR Hospitality, and names typed in before. */
const DUTY_KINDS = {
  kitchen: { dept: 'Skills Training', ministry: 'Culinary', layout: 'grid' },
  chores: { dept: 'Skills Training', ministry: 'Hospitality', layout: 'list' }
};
const DUTY_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DUTY_MAX = { rows: 40, sections: 8, listRows: 60, names: 24, name: 40, weeks: 60, extras: 300 };
const DUTY_TEMPLATES = {
  kitchen: {
    title: 'Cooking schedule', km: 'កាលវិភាគធ្វើម្ហូបប្រចាំសប្តាហ៍', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
    rows: [
      { id: 'bf', label: 'Breakfast 7:30', km: 'អាហារ-ព្រឹក', time: 'Cooking 6:00', off: ['sun'] },
      { id: 'md', label: 'Morning chore – Dishes', km: 'លាងចាន-ព្រឹក', time: '', off: ['sun'] },
      { id: 'lu', label: 'Lunch 12:30', km: 'អាហារ-ត្រង់', time: 'Cooking 11:00', off: ['sun'] },
      { id: 'pr', label: 'Pray – Announcements', km: 'អធិស្ឋាន-សេចក្ដីប្រកាស', time: '', off: ['sun'], span: true },
      { id: 'ld', label: 'Lunch dishes · Sweep-mop', km: 'លាងចាន-ថ្ងៃត្រង់', time: '', off: ['sun'] },
      { id: 'di', label: 'Dinner 6:30', km: 'អាហារ-ល្ងាច', time: 'Cooking 5:00' },
      { id: 'dd', label: 'Dinner dishes · Sweep-mop', km: 'លាងចាន-ល្ងាច', time: '' }
    ]
  },
  chores: {
    title: 'Morning chores (8–8:30 AM)', km: 'ការងារពេលព្រឹក (ម៉ោង ៨-៨:៣០)',
    sections: [
      { id: 'base', title: 'Base', km: 'មូលដ្ឋាន', rows: [
        { id: 'c01', place: 'Trash bags (weekend)', duty: 'Change all the trash bags around the base and sweep around the building. Saturday and Sunday.' },
        { id: 'c02', place: 'Plants (weekend)', duty: 'Water the plants around the base. Saturday and Sunday.' },
        { id: 'c03', place: 'Morning dishes', duty: 'Put away dishes, wash dishes, clean the sink, wipe all surfaces.' },
        { id: 'c04', place: 'Stairs 1–4', duty: 'Sweep and mop stairs 1–4.' },
        { id: 'c05', place: 'Office room', duty: 'Sweep and mop inside and outside the room.' },
        { id: 'c06', place: 'Media room', duty: 'Sweep and mop inside and outside the room.' },
        { id: 'c07', place: 'Bathroom on the rooftop', duty: 'Clean the toilet, sink, floor, wall and mirror, and change the trash bags.' },
        { id: 'c08', place: 'Bathroom in the coffee shop and near the kitchen', duty: 'Clean the toilet, sink, floor, wall and mirror, and change the trash bags.' },
        { id: 'c09', place: 'Classroom 2 · Worship room', duty: 'Sweep and mop. Set out tables and chairs.' },
        { id: 'c10', place: 'Rooftop', duty: 'Sweep and mop the rooftop.' },
        { id: 'c11', place: 'Kitchen towels', duty: 'Change all the kitchen towels, put out the mopping liquid and clean the buckets.' },
        { id: 'c12', place: 'Open the doors 102, 103, 104, 203, 204, 205, 303, 304, 305', duty: 'Open the doors to every room for 15 minutes.' },
        { id: 'c13', place: 'Bean bags · green stage', duty: 'Wipe all the bean bags and vacuum the green stage.' },
        { id: 'c14', place: 'Stair railings', duty: 'Wipe the stair railings in hallways 1, 2, 3 and the Media room.' },
        { id: 'c15', place: 'Hallway 3', duty: 'Sweep and mop.' },
        { id: 'c16', place: 'Hallway 2', duty: 'Sweep and mop.' },
        { id: 'c17', place: 'Hallway 1', duty: 'Sweep and mop.' },
        { id: 'c18', place: 'Courtyard and parking area', duty: 'Sweep and clean the road in front of the base, the eating area and the coffee shop.' },
        { id: 'c19', place: 'Trash bags', duty: 'Change all the trash bags around the base and sweep around the building.' },
        { id: 'c20', place: 'Glass doors, inside and outside', duty: 'Mon: classroom 2 · Tue: classroom 3, rooftop · Wed: meeting room, Media and office · Thu: classroom 2 · Fri: classroom 3, rooftop' },
        { id: 'c21', place: 'Air conditioners', duty: 'Mon: rooms 203, 204, 401 · Tue: rooms 205, 303, Media · Wed: 304, 305, office · Thu: coffee shop, worship room, classroom 1 · Fri: rooms 101–104 and the DTS classroom' },
        { id: 'c22', place: 'Plants', duty: 'Water the plants around the base.' },
        { id: 'c23', place: 'Tables outside', duty: 'Clean all tables and chairs, and put them in order.' },
        { id: 'c24', place: 'Classroom 3 (rooftop) · tables', duty: 'Wipe all tables and chairs, and change the trash bags.' },
        { id: 'c25', place: 'Classroom 3 (rooftop) · rooms', duty: 'Sweep and mop inside and outside the classroom and around rooms 401 and 402.' },
        { id: 'c26', place: 'Classroom 1 (downstairs)', duty: 'Sweep and mop the stairs and vacuum. Mon, Wed, Fri: clean the glass door · Tue, Thu: clean the sofa and table.' },
        { id: 'c27', place: 'Coffee shop', duty: 'Sweep and mop. Clean all the tables in the coffee shop.' },
        { id: 'c28', place: 'Coffee shop glass door', duty: 'Clean the glass door inside and outside.' }
      ] },
      { id: 'house', title: 'Family house', km: 'អាគារគ្រួសារ', rows: [
        { id: 'h1', place: 'Courtyard and parking area', duty: 'Sweep under the house, change the trash bags and take the trash out. Sweep and clean the road in front.' },
        { id: 'h2', place: 'Stairs 1–4', duty: 'Sweep and mop the stairs.' },
        { id: 'h3', place: 'Plants', duty: 'Water the plants around the house.' },
        { id: 'h4', place: 'Stair railings', duty: 'Wipe the stair railings in hallways 1, 2, 3.' },
        { id: 'h5', place: 'Bathroom downstairs', duty: 'Clean the toilet, sink, floor, wall and mirror, and change the trash.' }
      ] }
    ]
  }
};
function dutyKey_(campus) { return 'duty:' + campus; }
function isSunday_(w) { return !!isoDate_(w) && new Date(w + 'T00:00:00Z').getUTCDay() === 0; }
function addDays_(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/* The Sunday the current week started on, in Cambodia (UTC+7). */
function dutyThisWeek_() {
  const d = new Date(Date.now() + 7 * 3600000); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
async function getDutyDoc_(campus) {
  const d = await readJSON(dutyKey_(campus), {});
  Object.keys(DUTY_KINDS).forEach(function (k) {
    if (!d[k] || typeof d[k] !== 'object') d[k] = {};
    if (!d[k].weeks || typeof d[k].weeks !== 'object') d[k].weeks = {};
    if (!Array.isArray(d[k].extras)) d[k].extras = [];
  });
  return d;
}
function dutyNames_(v) {
  const out = [];
  (Array.isArray(v) ? v : []).forEach(function (n) {
    const s = String(n == null ? '' : n).replace(/\s+/g, ' ').trim().slice(0, DUTY_MAX.name);
    if (s && out.indexOf(s) === -1 && out.length < DUTY_MAX.names) out.push(s);
  });
  return out;
}
function dutyText_(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
function dutyId_(v, used, p) {
  let id = String(v == null ? '' : v).replace(/[^a-z0-9_-]/gi, '').slice(0, 20);
  if (!id || used[id]) { let i = 1; do { id = p + (i++); } while (used[id]); }
  used[id] = 1;
  return id;
}
/* A week as the page sent it, kept to the shape of its kind. */
function cleanSched_(raw, kind) {
  const k = DUTY_KINDS[kind];
  raw = raw && typeof raw === 'object' ? raw : {};
  const out = { layout: k.layout, title: dutyText_(raw.title, 120) || DUTY_TEMPLATES[kind].title, km: dutyText_(raw.km, 120), notes: dutyText_(raw.notes, 1000) };
  if (k.layout === 'grid') {
    let days = (Array.isArray(raw.days) ? raw.days : []).filter(function (d, i, a) { return DUTY_DAYS.indexOf(d) > -1 && a.indexOf(d) === i; });
    if (!days.length) days = DUTY_TEMPLATES.kitchen.days.slice();
    days.sort(function (a, b) { return DUTY_DAYS.indexOf(a) - DUTY_DAYS.indexOf(b); });
    out.days = days;
    const used = {};
    out.rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, DUTY_MAX.rows).map(function (r) {
      r = r && typeof r === 'object' ? r : {};
      const label = dutyText_(r.label, 80);
      if (!label) return null;
      return { id: dutyId_(r.id, used, 'r'), label: label, km: dutyText_(r.km, 80), time: dutyText_(r.time, 60), span: !!r.span,
        off: (Array.isArray(r.off) ? r.off : []).filter(function (d) { return days.indexOf(d) > -1; }) };
    }).filter(Boolean);
    const cells = {}, src = raw.cells && typeof raw.cells === 'object' ? raw.cells : {};
    out.rows.forEach(function (r) {
      (r.span ? ['all'] : days).forEach(function (d) {
        if (d !== 'all' && r.off.indexOf(d) > -1) return;
        const names = dutyNames_(src[r.id + '|' + d]);
        if (names.length) cells[r.id + '|' + d] = names;
      });
    });
    out.cells = cells;
  } else {
    const usedS = {}, usedR = {};
    out.sections = (Array.isArray(raw.sections) ? raw.sections : []).slice(0, DUTY_MAX.sections).map(function (s) {
      s = s && typeof s === 'object' ? s : {};
      return { id: dutyId_(s.id, usedS, 's'), title: dutyText_(s.title, 80), km: dutyText_(s.km, 80),
        rows: (Array.isArray(s.rows) ? s.rows : []).slice(0, DUTY_MAX.listRows).map(function (r) {
          r = r && typeof r === 'object' ? r : {};
          const place = dutyText_(r.place, 120);
          if (!place) return null;
          return { id: dutyId_(r.id, usedR, 'c'), place: place, km: dutyText_(r.km, 120), duty: dutyText_(r.duty, 400), people: dutyNames_(r.people) };
        }).filter(Boolean) };
    });
  }
  return out;
}
function dutyAllNames_(sch) {
  const out = [];
  const add = function (l) { (l || []).forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); }); };
  if (sch.layout === 'grid') Object.keys(sch.cells || {}).forEach(function (k) { add(sch.cells[k]); });
  else (sch.sections || []).forEach(function (s) { s.rows.forEach(function (r) { add(r.people); }); });
  return out;
}
/* A first name is what the sheet uses; two campus staff with the same one get an initial. */
/* Full names on the schedules (Uriah, Oct 2026) — "Sam Oun", not "Sam O.".
   Older weeks still hold the short form; the page matches either. */
function dutyShortNames_(people) {
  return people.map(function (p) { return String(p.name || '').replace(/\s+/g, ' ').trim().slice(0, DUTY_MAX.name); });
}
/* The days of the week starting `week` (Sun … Sat) each staff member is
   away on leave — any request not declined, whatever its type: on a break or
   off campus, they can't cook or clean here. */
const DUTY_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function dutyAway_(trips, week) {
  const days = []; for (let i = 0; i < 7; i++) days.push(addDays_(week, i));
  const out = {};
  trips.forEach(function (r) {
    if (!r || r.status === 'declined' || !isDate_(r.from) || !isDate_(r.to)) return;
    days.forEach(function (d, i) { if (r.from <= d && d <= r.to) { out[r.staffId] = out[r.staffId] || {}; out[r.staffId][i] = 1; } });
  });
  return out;
}
/* Who can be put on the week starting `week`: grouped, each group a label
   and names; `away` notes the days someone on leave for part of the week is
   gone. Staff away the whole working week (Mon–Fri) are left out. */
async function dutyPeople_(campus, week, extras) {
  const weekEnd = addDays_(week, 7), groups = [], away = {};
  const gone = dutyAway_(await getTrips_(), week);
  const staff = (await getStaff_()).filter(function (s) { return s && s.active !== false && !isApplicant_(s) && s.campus === campus && !s.archived; })
    .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  const shorts = dutyShortNames_(staff);
  const campusNames = [], otherNames = [];
  staff.forEach(function (s, i) {
    if (!shorts[i]) return;
    const g = gone[s.id];
    if (g && [1, 2, 3, 4, 5].every(function (d) { return g[d]; })) return;   // away all week
    if (g) away[shorts[i]] = Object.keys(g).sort().map(function (d) { return DUTY_DAY_SHORT[d]; }).join(', ');
    /* Campus staff and YAP share the chores and the cooking (Uriah), so they are one group;
       ministry staff — and anyone whose type is not set — are the other. */
    const st = cleanStaffType_(s.staffType);
    (st === 'campus' || st === 'yap' ? campusNames : otherNames).push(shorts[i]);
  });
  if (campusNames.length) groups.push({ id: 'campus', label: 'Campus staff & YAP', names: campusNames });
  if (otherNames.length) groups.push({ id: 'staff', label: 'Other staff', names: otherNames });
  // teams whose dates cover any of the week, with everyone their leader listed on the portal
  const cands = await getCandidates_(), byCand = {};
  cands.forEach(function (c) { if (c && c.id) byCand[c.id] = c; });
  (await getTeamTrips_()).filter(function (t) { return t.campus === campus && t.status !== 'cancelled' && t.from && t.to && t.from < weekEnd && t.to >= week; })
    .forEach(function (t) {
      const c = t.candidateId && byCand[t.candidateId];
      if (!c) return;
      const a = teamAnswers_(c), names = [];
      const add = function (n) { n = dutyText_(n, DUTY_MAX.name); if (n && names.indexOf(n) === -1) names.push(n); };
      add(a.leaderName || c.name);
      (Array.isArray(a.coLeaders) ? a.coLeaders : []).forEach(function (p) { add(p && p.name); });
      ((c.portal && c.portal.members) || []).forEach(function (p) { add(p && p.name); });
      if (names.length) groups.push({ id: 'team_' + t.id, label: t.name, names: names });
    });
  /* who is booked into SR Hospitality that week — by the names in their
     beds (bedNames) where Hospitality has put them in, else the booking's name:
     students in a group of their own; guests, speakers and volunteers as
     "Staying with us"; names typed in for a team join that team's list.
     Staff come in above, from the staff list, so a staff bed adds nobody. */
  const students = [], guests = [];
  const put = function (list, n) { n = dutyText_(n, DUTY_MAX.name); if (n && list.indexOf(n) === -1) list.push(n); };
  (await getHosp_(campus)).bookings.forEach(function (k) {
    if (k.category === 'staff' || !(k.from < weekEnd && (k.permanent || k.to > week))) return;
    const named = Object.keys(k.bedNames || {}).map(function (id) { return k.bedNames[id]; }).filter(Boolean)
      .concat((k.people || []).map(function (p) { return p && p.name; }).filter(Boolean));
    if (k.category === 'team') {
      if (!named.length) return;   // the team's own list (above) has them
      let g = groups.filter(function (x) { return k.tripId && x.id === 'team_' + k.tripId; })[0];
      if (!g) { g = { id: 'hteam_' + k.id, label: k.name, names: [] }; groups.push(g); }
      named.forEach(function (n) { put(g.names, n); });
      return;
    }
    const list = k.category === 'student' ? students : guests;
    if (named.length) named.forEach(function (n) { put(list, n); });
    else if (!(k.category === 'student' && k.count > 1)) put(list, k.name);   // a school's booking name isn't a person
  });
  if (students.length) groups.push({ id: 'students', label: 'Students', names: students });
  if (guests.length) groups.push({ id: 'guests', label: 'Staying with us', names: guests });
  const seen = {};
  groups.forEach(function (g) { g.names.forEach(function (n) { seen[n] = 1; }); });
  const more = (extras || []).filter(function (n) { return !seen[n]; });
  if (more.length) groups.push({ id: 'extras', label: 'Added before', names: more });
  if (Object.keys(away).length) groups.away = away;
  return groups;
}
function dutyTemplate_(kind) {
  const t = JSON.parse(JSON.stringify(DUTY_TEMPLATES[kind]));
  t.layout = DUTY_KINDS[kind].layout;
  if (t.layout === 'grid') t.cells = {}; else t.sections.forEach(function (s) { s.rows.forEach(function (r) { r.people = []; }); });
  return cleanSched_(t, kind);
}
function dutyOut_(rec, week, kind) { return rec ? Object.assign({}, rec, { kind: kind, week: week }) : null; }
async function dutyAuth_(username, pin, kind, week) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { out: { ok: false } };
  if (!DUTY_KINDS[kind]) return { out: { ok: false, err: 'bad_kind' } };
  if (!isSunday_(week)) return { out: { ok: false, err: 'bad_week' } };
  const k = DUTY_KINDS[kind];
  return { s: s, campus: s.campus, canEdit: canLogFor_(s, s.campus, k.dept, k.ministry) };
}
/* One kind for one week. The ministry that makes it gets its draft (or a new
   week started from the last one) and the names to pick from; anyone else
   only a published week. */
async function getDuty(username, pin, kind, week) {
  const a = await dutyAuth_(username, pin, kind, week); if (a.out) return a.out;
  const d = await getDutyDoc_(a.campus), box = d[kind];
  const rec = box.weeks[week] || null;
  if (!a.canEdit) return { ok: true, kind: kind, week: week, canEdit: false, sched: rec && rec.published ? dutyOut_(rec, week, kind) : null };
  let sched = rec, isNew = false, from = '';
  if (!sched) {
    isNew = true;
    const before = Object.keys(box.weeks).filter(function (w) { return w < week; }).sort().pop();
    if (before) { sched = cleanSched_(box.weeks[before], kind); from = before; } else sched = dutyTemplate_(kind);
    sched.published = false;
  }
  const people = await dutyPeople_(a.campus, week, box.extras);
  return { ok: true, kind: kind, week: week, canEdit: true, isNew: isNew, from: from, sched: dutyOut_(sched, week, kind),
    people: people, away: people.away || {} };
}
/* action: 'save' keeps it as it is (a draft stays a draft, a published week
   stays published), 'publish' shows it to everyone, 'unpublish' takes it down. */
async function saveDuty(username, pin, kind, week, sched, action) {
  const a = await dutyAuth_(username, pin, kind, week); if (a.out) return a.out;
  if (!a.canEdit) return { ok: false, err: 'not_authorized' };
  const d = await getDutyDoc_(a.campus), box = d[kind], prev = box.weeks[week];
  const rec = cleanSched_(sched, kind);
  const now = new Date().toISOString();
  rec.published = action === 'publish' ? true : action === 'unpublish' ? false : !!(prev && prev.published);
  rec.publishedAt = rec.published ? ((prev && prev.published && prev.publishedAt) || now) : null;
  rec.updated = now; rec.updatedBy = a.s.id;
  box.weeks[week] = rec;
  Object.keys(box.weeks).sort().reverse().slice(DUTY_MAX.weeks).forEach(function (w) { delete box.weeks[w]; });
  // names typed in by hand are offered again next time
  const known = {};
  (await dutyPeople_(a.campus, week, [])).forEach(function (g) { g.names.forEach(function (n) { known[n] = 1; }); });
  dutyAllNames_(rec).forEach(function (n) { if (!known[n] && box.extras.indexOf(n) === -1) box.extras.unshift(n); });
  box.extras = box.extras.slice(0, DUTY_MAX.extras);
  await writeJSON(dutyKey_(a.campus), d);
  return getDuty(username, pin, kind, week);
}
/* This week's published schedules (and next week's, once it is out), for My Home. */
async function dutyPublished_(campus, week) {
  const d = await getDutyDoc_(campus), out = {};
  Object.keys(DUTY_KINDS).forEach(function (k) { const r = d[k].weeks[week]; out[k] = r && r.published ? dutyOut_(r, week, k) : null; });
  return out;
}
/* The base's weekly schedules for an applicant — the portal's 📅 Schedule tab:
   this week's and next week's, once published, while they are here (arrived,
   or a team whose dates in Cambodia take in this week or next — not before,
   it would only confuse). mine: the names to pick out — theirs, or everyone
   on the team. */
async function applicantSchedules_(cand, trip) {
  const wk = dutyThisWeek_(), nx = addDays_(wk, 7), end = addDays_(nx, 6);
  const here = !cand.archived && (cand.stage === 'arrived' || !!(trip && trip.from && trip.to && trip.from <= end && trip.to >= wk));
  const out = { here: here, week: wk, nextWeek: nx, kitchen: null, chores: null, next: { kitchen: null, chores: null }, mine: [] };
  if (!here) return out;
  const campus = cand.campus || PORTAL_DEFAULT_CAMPUS;
  Object.assign(out, await dutyPublished_(campus, wk));
  out.next = await dutyPublished_(campus, nx);
  out.mine = cand.type === 'team' ? teamPeople_(cand).map(function (p) { return p.name; }) : [str_(cand.name, 120)].filter(Boolean);
  return out;
}
async function getMySchedules(username, pin, week) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  week = isSunday_(week) ? week : dutyThisWeek_();
  const next = addDays_(week, 7);
  const canEdit = {};
  Object.keys(DUTY_KINDS).forEach(function (k) { canEdit[k] = canLogFor_(s, s.campus, DUTY_KINDS[k].dept, DUTY_KINDS[k].ministry); });
  return { ok: true, week: week, now: await dutyPublished_(s.campus, week), next: await dutyPublished_(s.campus, next), nextWeek: next, canEdit: canEdit };
}
/* A team's own list of who is coming — names (and men / women), as many as
   it has — so the kitchen and hospitality can put them on the schedules
   while they are here. The leader keeps it up to date from the portal. */
const MEMBERS_MAX = 120;
/* Each member keeps a small id (Oct 2026) so a photo can follow a person
   through a rename; one is made when a row has none. */
const MEMBER_ID = /^m[a-z0-9]{6,24}$/;
function cleanMembers_(v) {
  const out = [], seen = {};
  (Array.isArray(v) ? v : []).slice(0, MEMBERS_MAX).forEach(function (p) {
    p = p && typeof p === 'object' ? p : { name: p };
    const name = dutyText_(p.name, 80).replace(/\s+/g, ' ');
    if (!name) return;
    let id = typeof p.id === 'string' && MEMBER_ID.test(p.id) && !seen[p.id] ? p.id : ('m' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7));
    seen[id] = 1;
    out.push({ id: id, name: name, sex: p.sex === 'm' || p.sex === 'f' ? p.sex : '' });
  });
  return out;
}
async function portalSaveTeamMembers(username, pin, members) {
  const a = await applicantCand_(username, pin); if (a.out) return a.out;
  if (a.cand.type !== 'team') return { ok: false, err: 'not_team' };
  a.cand.portal = a.cand.portal || {};
  a.cand.portal.members = cleanMembers_(members);
  await teamPhotoTally_(a.cand);   // who still needs a photo moves with the list
  teamAutoStage_(a.cand, a.s.id);
  a.cand.updated = new Date().toISOString(); a.cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  return portalBoot(username, pin);
}

/* ==================== a team's photos (Oct 2026, Uriah) ====================
   Instead of one team photo with names written on it, the leader takes a
   photo of each person in the portal — the leader, the co-leaders from the
   form, and every member listed. One blob per team, 'tphotos:<candidateId>',
   holds them by key (leader | co|<n> | the member's id), as small JPEGs the
   page already shrank. When everyone has one, the "team photo" document
   counts as in. Staff see them on the record and can lay them out as one
   picture for the staff group chat. */
const TEAM_PHOTO_MAX_B64 = 160 * 1024;
function teamPhotoPeople_(c) {
  const a = teamAnswers_(c), out = [];
  const leader = dutyText_(a.leaderName || c.name, 120);
  if (leader) out.push({ key: 'leader', name: leader, role: 'leader' });
  (Array.isArray(a.coLeaders) ? a.coLeaders : []).forEach(function (p, i) {
    const n = dutyText_(p && p.name, 120); if (n) out.push({ key: 'co|' + i, name: n, role: 'co' });
  });
  ((c.portal && c.portal.members) || []).forEach(function (m) { if (m && m.id) out.push({ key: m.id, name: m.name, role: 'member', sex: m.sex || '' }); });
  return out;
}
async function getTeamPhotos_(c) { return readJSON('tphotos:' + c.id, { photos: {} }); }
/* How many of the people have a photo, kept on the record so the timeline
   can read it without opening the photo blob. */
async function teamPhotoTally_(c) {
  const ppl = teamPhotoPeople_(c), store = await getTeamPhotos_(c);
  const have = ppl.filter(function (p) { return store.photos && store.photos[p.key]; }).length;
  c.portal = c.portal || {};
  c.portal.photos = { count: have, total: ppl.length, at: new Date().toISOString() };
  return c.portal.photos;
}
function photosDone_(c) { const p = c && c.portal && c.portal.photos; return !!(p && p.total > 0 && p.count >= p.total); }
function hasPhotoDoc_(c) { return hasDoc_(c, 'photo') || photosDone_(c); }
function teamPhotosOut_(c, store) {
  const ppl = teamPhotoPeople_(c), out = {};
  ppl.forEach(function (p) { const ph = store.photos && store.photos[p.key]; if (ph) out[p.key] = { data: ph.data, at: ph.at, fromDoc: ph.fromDoc || '' }; });
  return { people: ppl, photos: out, tally: (c.portal && c.portal.photos) || { count: Object.keys(out).length, total: ppl.length } };
}
async function portalTeamPhotos(username, pin, candidateId) {
  const a = await docCand_(username, pin, candidateId); if (a.out) return a.out;
  if (a.cand.type !== 'team') return { ok: false, err: 'not_team' };
  return Object.assign({ ok: true }, teamPhotosOut_(a.cand, await getTeamPhotos_(a.cand)));
}
/* fromDoc: the uploaded file this photo was made from (staff putting an old
   upload onto a person), so the record can stop offering that file. */
async function portalSaveTeamPhoto(username, pin, key, base64, candidateId, fromDoc) {
  const a = await docCand_(username, pin, candidateId); if (a.out) return a.out;
  const cand = a.cand;
  if (cand.type !== 'team') return { ok: false, err: 'not_team' };
  key = str_(key, 40);
  if (!key || !teamPhotoPeople_(cand).some(function (p) { return p.key === key; })) return { ok: false, err: 'bad_person' };
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(base64) || base64.length < 100) return { ok: false, err: 'bad_file' };
  if (base64.length > TEAM_PHOTO_MAX_B64) return { ok: false, err: 'too_large' };
  const store = await getTeamPhotos_(cand);
  store.photos = store.photos || {};
  store.photos[key] = { data: base64, at: new Date().toISOString(), by: a.s.id, fromDoc: str_(fromDoc, 60) || '' };
  await writeJSON('tphotos:' + cand.id, store);
  await teamPhotoTally_(cand);
  teamAutoStage_(cand, a.s.id);
  cand.updated = new Date().toISOString(); cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  return Object.assign({ ok: true, application: portalAppOut_(cand) }, teamPhotosOut_(cand, store));
}
async function portalDeleteTeamPhoto(username, pin, key, candidateId) {
  const a = await docCand_(username, pin, candidateId); if (a.out) return a.out;
  const cand = a.cand;
  if (cand.type !== 'team') return { ok: false, err: 'not_team' };
  const store = await getTeamPhotos_(cand);
  if (store.photos) delete store.photos[str_(key, 40)];
  await writeJSON('tphotos:' + cand.id, store);
  await teamPhotoTally_(cand);
  cand.updated = new Date().toISOString(); cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  return Object.assign({ ok: true, application: portalAppOut_(cand) }, teamPhotosOut_(cand, store));
}

/* ==================== the leadership meeting board ====================
   Campus Leadership meets every Monday. Its board ('leadBoard:<campus>') is
   all theirs to shape:
     cols      the columns, in order — {id, title, done}; one of them counts
               as finished (moving a card there stamps doneAt). Starts as
               Agenda / In progress / Done.
     areas     the focus areas projects belong to — for Siem Reap this
               quarter and toward 2027: Siem Reap finances, Siem Reap
               ministries, Construction.
     standing  the agenda items every Monday has — Department and ministry
               updates, Events coming up.
     cards     agenda items and projects: title, type, column, focus area,
               owner, due date, notes, and optionally the Leadership OKR
               (objective id) it moves forward. Each can hold a short list of
               tasks — {id, text, done, owner, due, meeting} — changed one at a
               time (saveLeadTask / deleteLeadTask) so two people ticking
               tasks off in the same meeting don't undo each other.
     notes     the meeting notes, one per Monday — {date, text, updated,
               updatedBy}. A line in them can become a card or a task; those
               carry the meeting's date (meeting) so they trace back to it.
   Campus Leadership on the campus and admins read and change it; nobody
   else sees it. */
const LEAD_TYPES = ['agenda', 'project'];
const LEAD_MAX = { cards: 600, cols: 8, areas: 12, standing: 12, tasks: 40, notes: 260, noteText: 8000 };
const LEAD_DEFAULT = {
  cols: [{ id: 'agenda', title: 'Agenda', done: false }, { id: 'doing', title: 'In progress', done: false }, { id: 'done', title: 'Done', done: true }],
  areas: [{ id: 'finances', title: 'Siem Reap finances' }, { id: 'ministries', title: 'Siem Reap ministries' }, { id: 'construction', title: 'Construction' }],
  standing: [{ id: 'updates', title: 'Department and ministry updates' }, { id: 'events', title: 'Events coming up' }]
};
function canLead_(s) { return !!(s && !isApplicant_(s) && s.active !== false && (s.isAdmin || deptOf_(s) === 'Campus Leadership')); }
function leadKey_(campus) { return 'leadBoard:' + campus; }
async function leadAuth_(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { out: { ok: false } };
  if (!canLead_(s)) return { out: { ok: false, err: 'not_authorized' } };
  return { s: s, campus: s.campus };
}
async function getLeadDoc_(campus) {
  const d = await readJSON(leadKey_(campus), {});
  return {
    cols: Array.isArray(d.cols) && d.cols.length ? d.cols : JSON.parse(JSON.stringify(LEAD_DEFAULT.cols)),
    areas: Array.isArray(d.areas) ? d.areas : JSON.parse(JSON.stringify(LEAD_DEFAULT.areas)),
    standing: Array.isArray(d.standing) ? d.standing : JSON.parse(JSON.stringify(LEAD_DEFAULT.standing)),
    cards: Array.isArray(d.cards) ? d.cards : [],
    notes: Array.isArray(d.notes) ? d.notes : [],
    tues: Array.isArray(d.tues) ? d.tues : []
  };
}
function leadOut_(campus, d, extra) { return Object.assign({ ok: true, campus: campus, cols: d.cols, areas: d.areas, standing: d.standing, cards: d.cards, notes: d.notes, tues: d.tues || [] }, extra || {}); }
async function getLeadBoard(username, pin) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  return leadOut_(a.campus, await getLeadDoc_(a.campus));
}
function cleanLeadTask_(t, prev) {
  const text = dutyText_(t && t.text, 200);
  if (!text) return null;
  return Object.assign({}, prev || {}, {
    id: (prev && prev.id) || ('lt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    text: text, done: !!t.done, owner: str_(t.owner, 60) || '', due: isoDate_(t.due) || '',
    meeting: isoDate_(t.meeting) || (prev && prev.meeting) || ''
  });
}
function cleanLeadCard_(c, prev, d) {
  const title = str_(c && c.title, 160);
  if (!title) return null;
  const colIds = d.cols.map(function (x) { return x.id; }), areaIds = d.areas.map(function (x) { return x.id; });
  return Object.assign({}, prev || {}, {
    id: (prev && prev.id) || str_(c.id, 60) || ('lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    title: title, notes: dutyText_(c.notes, 2000),
    type: LEAD_TYPES.indexOf(c.type) > -1 ? c.type : 'agenda',
    col: colIds.indexOf(c.col) > -1 ? c.col : colIds[0],
    area: areaIds.indexOf(c.area) > -1 ? c.area : '',
    owner: str_(c.owner, 60) || '', due: isoDate_(c.due) || '',
    okrId: str_(c.okrId, 60) || '', meeting: isoDate_(c.meeting) || '',
    fromNotes: !!(c.fromNotes || (prev && prev.fromNotes))
  });
}
/* Add or change a card (including moving it to another column). */
async function saveLeadCard(username, pin, card) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  const d = await getLeadDoc_(a.campus), cards = d.cards;
  const idx = cards.findIndex(function (c) { return c.id === str_(card && card.id, 60); });
  const rec = cleanLeadCard_(card, idx > -1 ? cards[idx] : null, d);
  if (!rec) return { ok: false, err: 'bad_card' };
  if (idx === -1 && cards.length >= LEAD_MAX.cards) return { ok: false, err: 'too_many' };
  const now = new Date().toISOString();
  const doneCol = function (id) { return d.cols.some(function (x) { return x.id === id && x.done; }); };
  if (idx === -1) {
    rec.created = now; rec.createdBy = a.s.id;
    rec.tasks = (Array.isArray(card.tasks) ? card.tasks : []).slice(0, LEAD_MAX.tasks).map(function (t) { return cleanLeadTask_(t, null); }).filter(Boolean);
  }
  if (doneCol(rec.col) && !(idx > -1 && doneCol(cards[idx].col))) rec.doneAt = now;
  if (!doneCol(rec.col)) delete rec.doneAt;
  rec.updated = now; rec.updatedBy = a.s.id;
  if (idx > -1) cards[idx] = rec; else cards.push(rec);
  await writeJSON(leadKey_(a.campus), d);
  return leadOut_(a.campus, d, { saved: rec });
}
async function deleteLeadCard(username, pin, id) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  const d = await getLeadDoc_(a.campus);
  const idx = d.cards.findIndex(function (c) { return c.id === str_(id, 60); });
  if (idx === -1) return { ok: false, err: 'not_found' };
  d.cards.splice(idx, 1);
  await writeJSON(leadKey_(a.campus), d);
  return leadOut_(a.campus, d);
}
/* One task on a card: add it (no id), change it (tick it off, rename it,
   give it an owner or a due date), or take it away. */
async function saveLeadTask(username, pin, cardId, task) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  const d = await getLeadDoc_(a.campus);
  const card = d.cards.find(function (c) { return c.id === str_(cardId, 60); });
  if (!card) return { ok: false, err: 'not_found' };
  const tasks = Array.isArray(card.tasks) ? card.tasks : [];
  const idx = tasks.findIndex(function (t) { return t.id === str_(task && task.id, 60); });
  if (task && task.id && idx === -1) return { ok: false, err: 'not_found' };
  const rec = cleanLeadTask_(task, idx > -1 ? tasks[idx] : null);
  if (!rec) return { ok: false, err: 'bad_task' };
  if (idx === -1 && tasks.length >= LEAD_MAX.tasks) return { ok: false, err: 'too_many' };
  const now = new Date().toISOString();
  if (rec.done && !(idx > -1 && tasks[idx].done)) { rec.doneAt = now; rec.doneBy = a.s.id; }
  if (!rec.done) { delete rec.doneAt; delete rec.doneBy; }
  if (idx === -1) { rec.created = now; rec.createdBy = a.s.id; tasks.push(rec); } else tasks[idx] = rec;
  card.tasks = tasks; card.updated = now; card.updatedBy = a.s.id;
  await writeJSON(leadKey_(a.campus), d);
  return leadOut_(a.campus, d, { saved: rec, card: card.id });
}
async function deleteLeadTask(username, pin, cardId, taskId) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  const d = await getLeadDoc_(a.campus);
  const card = d.cards.find(function (c) { return c.id === str_(cardId, 60); });
  const idx = card && Array.isArray(card.tasks) ? card.tasks.findIndex(function (t) { return t.id === str_(taskId, 60); }) : -1;
  if (idx === -1) return { ok: false, err: 'not_found' };
  card.tasks.splice(idx, 1);
  await writeJSON(leadKey_(a.campus), d);
  return leadOut_(a.campus, d);
}
/* A Monday's notes. Empty notes take the day away. If someone else saved
   that day's notes since this person opened them (since = the updated stamp
   they had), nothing is overwritten: they get err 'changed' with the
   latest, to put the two together. */
async function saveLeadNote(username, pin, note) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  note = note && typeof note === 'object' ? note : {};
  const date = isoDate_(note.date);
  if (!date) return { ok: false, err: 'bad_date' };
  const d = await getLeadDoc_(a.campus);
  const idx = d.notes.findIndex(function (n) { return n.date === date; });
  const prev = idx > -1 ? d.notes[idx] : null;
  const since = String(note.since == null ? '' : note.since);
  if (prev && prev.updated !== since && prev.updatedBy !== a.s.id) return leadOut_(a.campus, d, { ok: false, err: 'changed', latest: prev });
  const text = String(note.text == null ? '' : note.text).replace(/\r\n?/g, '\n').replace(/\s+$/, '').slice(0, LEAD_MAX.noteText);
  if (!text.trim()) { if (idx > -1) d.notes.splice(idx, 1); }
  else {
    const rec = { date: date, text: text, updated: new Date().toISOString(), updatedBy: a.s.id };
    if (idx > -1) d.notes[idx] = rec; else d.notes.push(rec);
    d.notes.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    if (d.notes.length > LEAD_MAX.notes) d.notes.splice(0, d.notes.length - LEAD_MAX.notes);
  }
  await writeJSON(leadKey_(a.campus), d);
  return leadOut_(a.campus, d, { saved: d.notes.find(function (n) { return n.date === date; }) || null });
}
/* The board's own shape: its columns (one counts as done), focus areas and
   standing agenda items. A card in a column that goes moves to the first
   one; a card in a focus area that goes keeps its place with no area. */
function leadList_(list, max, prefix) {
  const out = [], used = {};
  (Array.isArray(list) ? list : []).slice(0, max).forEach(function (x) {
    x = x && typeof x === 'object' ? x : {};
    const title = str_(x.title, 80);
    if (!title) return;
    let id = String(x.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 30);
    if (!id || used[id]) { let i = 1; do { id = prefix + (i++) + Math.random().toString(36).slice(2, 5); } while (used[id]); }
    used[id] = 1;
    out.push({ id: id, title: title, done: !!x.done });
  });
  return out;
}
async function saveLeadSettings(username, pin, settings) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  settings = settings && typeof settings === 'object' ? settings : {};
  const d = await getLeadDoc_(a.campus);
  const cols = leadList_(settings.cols, LEAD_MAX.cols, 'c');
  if (!cols.length) return { ok: false, err: 'no_columns' };
  const doneIdx = cols.findIndex(function (c) { return c.done; });
  cols.forEach(function (c, i) { c.done = doneIdx === -1 ? i === cols.length - 1 : i === doneIdx; });   // exactly one finished column
  const areas = leadList_(settings.areas, LEAD_MAX.areas, 'a').map(function (x) { return { id: x.id, title: x.title }; });
  const standing = leadList_(settings.standing, LEAD_MAX.standing, 's').map(function (x) { return { id: x.id, title: x.title }; });
  const colIds = cols.map(function (c) { return c.id; }), areaIds = areas.map(function (x) { return x.id; });
  const doneId = cols.filter(function (c) { return c.done; })[0].id, now = new Date().toISOString();
  d.cards.forEach(function (c) {
    if (colIds.indexOf(c.col) === -1) c.col = colIds[0];
    if (c.area && areaIds.indexOf(c.area) === -1) c.area = '';
    if (c.col === doneId && !c.doneAt) c.doneAt = now;
    if (c.col !== doneId) delete c.doneAt;
  });
  d.cols = cols; d.areas = areas; d.standing = standing;
  await writeJSON(leadKey_(a.campus), d);
  return leadOut_(a.campus, d);
}

/* ==================== human resources ====================
   The HR page: each staff member's contract(s), the papers attached to
   them, how long they have served, when the current contract runs out, and
   archiving someone who leaves. Everything lives on the staff record —
   `contracts` (one row per signing, renewals included), `archived`, `hr`
   (who may open the page) — except the attached files, which are their
   own blobs (hrfile:<id>) so the staff list never carries megabytes of PDF.

   Who may use it: an admin, or anyone an admin has given `hr`. Nobody else
   can read a contract, an attachment, or the archive reason.

   Archiving IS deactivating: `active:false` is what every read already
   uses to drop someone from the roster, the staff count, the mentor
   pickers and sign-in, so "it will update the number of staff and
   everything connected" costs nothing more than the flag. `archived`
   holds when and why, and tells the admin's Approvals page this is not a
   sign-up waiting for a yes. */
const HR_FILE_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const HR_FILE_MAX_B64 = 5.6 * 1024 * 1024;   // ~4 MB of file, once base64'd
const HR_MAX_CONTRACTS = 30, HR_MAX_FILES = 10;
/* The campus a contract was signed with — someone who signed with Poipet
   and later moved to Siem Reap keeps that Poipet contract as it was. Same
   ids as CAMPUSES in taxonomy.js. A contract from before this has none,
   which reads as the person's own campus. */
const HR_CAMPUSES = ['poipet', 'siemreap'];
function canHR_(s) { return !!(s && (s.isAdmin || s.hr)); }
function hrId_(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function archivedOf_(s) {
  const a = s && s.archived;
  if (!a || typeof a !== 'object') return null;
  return { at: isoDate_(a.at) || '', reason: str_(a.reason, 300), by: str_(a.by, 60) };
}
function isoMonth_(v) { const m = str_(v, 7); return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : ''; }
function cleanFileMeta_(f) {
  if (!f || typeof f !== 'object') return null;
  const id = str_(f.id, 60); if (!id) return null;
  return { id: id, name: str_(f.name, 160) || 'file', mime: str_(f.mime, 80), size: finiteNum_(f.size, 0, 1e9) || 0, added: str_(f.added, 40) };
}
function cleanContract_(c, keepFiles) {
  if (!c || typeof c !== 'object') return null;
  const signed = isoMonth_(c.signed), years = finiteNum_(c.years, 0.25, 30);
  if (!signed || years == null) return null;
  return { id: str_(c.id, 60) || hrId_('ct'), signed: signed, years: Math.round(years * 4) / 4, notes: str_(c.notes, 500),
    campus: HR_CAMPUSES.indexOf(c.campus) > -1 ? c.campus : '',
    files: (Array.isArray(keepFiles) ? keepFiles : []).map(cleanFileMeta_).filter(Boolean).slice(0, HR_MAX_FILES),
    added: str_(c.added, 40), addedBy: str_(c.addedBy, 60), digital: cleanDigital_(c.digital) };
}
/* A contract signed in the app: sent by HR (awaiting_staff), signed by the
   staff member (awaiting_leader), countersigned by a UofN leader (signed).
   The signatures live in blob 'scontract:<contractId>'. */
const DIGITAL_STATUS = ['awaiting_staff', 'awaiting_leader', 'signed'];
function cleanDigital_(d) {
  if (!d || typeof d !== 'object' || DIGITAL_STATUS.indexOf(d.status) === -1) return undefined;
  const o = { status: d.status };
  ['sentAt', 'sentBy', 'staffSignedAt', 'staffName', 'leaderSignedAt', 'leaderName', 'leaderId', 'approvedBy'].forEach(function (k) { if (d[k]) o[k] = str_(d[k], 120); });
  return o;
}
/* a contract counts — for "current" and the due count — once it is signed (paper ones always are) */
function contractInForce_(c) { return !c.digital || c.digital.status === 'signed'; }
function contractsOf_(s) {
  return (Array.isArray(s && s.contracts) ? s.contracts : []).map(function (c) { return cleanContract_(c, c && c.files); })
    .filter(Boolean).sort(function (a, b) { return a.signed < b.signed ? -1 : a.signed > b.signed ? 1 : 0; });
}
/* How many active people's current contract has run out or runs out within
   90 days — the number on the HR menu item. A contract ends on the first
   day of the month `years` after the month it was signed. */
const HR_DUE_DAYS = 90;
function hrContractEnd_(c) {
  const y = Number(c.signed.slice(0, 4)), m = Number(c.signed.slice(5, 7)) - 1;
  return new Date(y, m + Math.round(Number(c.years) * 12), 1);
}
function hrDueCount_(rows) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let n = 0;
  (rows || []).forEach(function (r) {
    if (!r || r.active === false || r.archived) return;
    const list = contractsOf_(r).filter(contractInForce_); if (!list.length) return;
    const days = Math.round((hrContractEnd_(list[list.length - 1]) - today) / 86400000);
    if (days <= HR_DUE_DAYS) n++;
  });
  return n;
}
function hrStaffOut_(s) {
  const out = adminStaffOut_(s);
  out.joined = s.joined || ''; out.photo = s.photo || ''; out.contracts = contractsOf_(s);
  out.legal = s.legal && typeof s.legal === 'object' ? s.legal : {};
  out.ywamSince = ywamSinceOf_(s);
  out.starts = startsOf_(s);
  out.baseSince = out.starts[s.campus] || '';
  return out;
}
/* When they started on each of our campuses — { poipet:'2020-01',
   siemreap:'2024-01' }, a month each, either may be missing. Someone who
   served in Poipet and moved to Siem Reap has both; their time in YWAM GP
   runs from the earlier. (baseSince, from before, is their own campus's.) */
function startsOf_(s) {
  const out = {}, st = s && s.starts && typeof s.starts === 'object' ? s.starts : {};
  HR_CAMPUSES.forEach(function (c) { const m = isoMonth_(st[c]); if (m) out[c] = m; });
  if (s && !out[s.campus] && isoMonth_(s.baseSince) && HR_CAMPUSES.indexOf(s.campus) > -1) out[s.campus] = isoMonth_(s.baseSince);
  return out;
}
/* A contract covers this base only; many staff served YWAM elsewhere first.
   `ywamSince` is the year they joined YWAM anywhere — a fact about the
   person, not the contract — so "Serving in Siem Reap since 2021" and "In
   YWAM since 2003" can both be true. `baseSince` (YYYY-MM) is when they
   started at this base. Both are set on their own (hrSaveStart) and no
   contract changes them; with no baseSince the page counts from the
   earliest contract or the year they joined, whichever is first. */
function ywamSinceOf_(s) {
  const y = Number(s && s.ywamSince);
  return (Number.isInteger(y) && y >= 1960 && y <= new Date().getFullYear()) ? y : null;
}
async function hrList(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  const rows = await getStaff_();
  return { ok: true, staff: rows.filter(function (r) { return !isApplicant_(r); }).map(hrStaffOut_), legalDocs: (await legalDocs_()).map(function (d) { return { id: d.id, title: d.title }; }) };
}
async function hrMutate_(username, pin, staffId, fn) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === staffId; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const res = fn(rows[idx], s, rows);
    if (res && res.abort) return res;
    rows[idx].updated = new Date().toISOString();
    return Object.assign({ ok: true, staff: hrStaffOut_(rows[idx]) }, res || {});
  });
}
async function hrSaveContract(username, pin, staffId, contract) {
  return hrMutate_(username, pin, staffId, function (rec, me) {
    const list = contractsOf_(rec);
    const existing = contract && list.filter(function (c) { return c.id === str_(contract.id, 60); })[0];
    const clean = cleanContract_(contract, existing ? existing.files : []);
    if (!clean) return { abort: true, ok: false, err: 'bad_contract' };
    if (!existing) { clean.added = new Date().toISOString(); clean.addedBy = me.id; if (list.length >= HR_MAX_CONTRACTS) return { abort: true, ok: false, err: 'too_many' }; }
    else { clean.added = existing.added; clean.addedBy = existing.addedBy; }
    rec.contracts = list.filter(function (c) { return c.id !== clean.id; }).concat([clean]);
    if (contract && contract.ywamSince !== undefined) {
      if (contract.ywamSince === '' || contract.ywamSince === null) rec.ywamSince = null;
      else { const y = ywamSinceOf_({ ywamSince: contract.ywamSince }); if (!y) return { abort: true, ok: false, err: 'bad_ywam_since' }; rec.ywamSince = y; }
    }
  });
}
/* The start dates, apart from any contract: ywamSince (a year), and the
   month they started on each campus — starts: { poipet, siemreap }, only
   the ones being changed; '' clears one. baseSince is the same as their
   own campus's start. */
async function hrSaveStart(username, pin, staffId, dates) {
  return hrMutate_(username, pin, staffId, function (rec) { return applyStart_(rec, dates); });
}
/* the person sets their own (My contract): when they joined YWAM and started on each campus */
async function mySaveStart(username, pin, dates) {
  const s = await verifyStaff_(username, pin);
  if (!s || isApplicant_(s)) return { ok: false };
  return mutateStaff_(function (rows) {
    const rec = rows.find(function (r) { return r.id === s.id; });
    if (!rec) return { abort: true, ok: false, err: 'not_found' };
    const res = applyStart_(rec, dates);
    if (res && res.abort) return res;
    rec.updated = new Date().toISOString();
    return { ok: true, staff: hrStaffOut_(rec) };
  });
}
function applyStart_(rec, dates) {
    dates = dates && typeof dates === 'object' ? dates : {};
    let ywam = rec.ywamSince == null ? null : rec.ywamSince;
    const starts = startsOf_(rec), now = new Date(), nowM = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2);
    if (dates.ywamSince !== undefined) {
      if (dates.ywamSince === '' || dates.ywamSince === null) ywam = null;
      else { ywam = ywamSinceOf_({ ywamSince: dates.ywamSince }); if (!ywam) return { abort: true, ok: false, err: 'bad_ywam_since' }; }
    }
    const change = Object.assign({}, dates.starts && typeof dates.starts === 'object' ? dates.starts : {});
    if (dates.baseSince !== undefined) change[rec.campus] = dates.baseSince;
    for (const c of Object.keys(change)) {
      if (HR_CAMPUSES.indexOf(c) === -1) return { abort: true, ok: false, err: 'bad_campus' };
      const v = change[c];
      if (v === '' || v === null) { delete starts[c]; continue; }
      const m = isoMonth_(v);
      if (!m || m > nowM || Number(m.slice(0, 4)) < 1960) return { abort: true, ok: false, err: 'bad_base_since' };
      starts[c] = m;
    }
    if (ywam && Object.keys(starts).some(function (c) { return Number(starts[c].slice(0, 4)) < ywam; })) return { abort: true, ok: false, err: 'base_before_ywam' };
    rec.ywamSince = ywam; rec.starts = starts; rec.baseSince = starts[rec.campus] || '';
}
async function hrDeleteContract(username, pin, staffId, contractId) {
  const st = store();
  let gone = [];
  const out = await hrMutate_(username, pin, staffId, function (rec) {
    const list = contractsOf_(rec), hit = list.filter(function (c) { return c.id === contractId; })[0];
    if (!hit) return { abort: true, ok: false, err: 'not_found' };
    gone = hit.files.map(function (f) { return f.id; });
    rec.contracts = list.filter(function (c) { return c.id !== contractId; });
  });
  if (out.ok) for (let i = 0; i < gone.length; i++) { try { await hrDropFile_(st, gone[i]); } catch (e) { /* the record is already clean */ } }
  return out;
}
async function hrDropFile_(st, fileId) {
  if (typeof st.delete === 'function') await st.delete('hrfile:' + fileId);
  else await st.setJSON('hrfile:' + fileId, null);
}
async function hrUploadFile(username, pin, staffId, contractId, name, mime, base64) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  mime = str_(mime, 80);
  if (HR_FILE_MIME.indexOf(mime) === -1) return { ok: false, err: 'bad_type' };
  if (typeof base64 !== 'string' || !base64) return { ok: false, err: 'bad_file' };
  if (base64.length > HR_FILE_MAX_B64) return { ok: false, err: 'too_large' };
  const meta = { id: hrId_('hf'), name: str_(name, 160) || 'file', mime: mime, size: Math.floor(base64.length * 3 / 4), added: new Date().toISOString() };
  // the record first: if this person or contract isn't there, no blob is written
  const out = await hrMutate_(username, pin, staffId, function (rec) {
    const list = contractsOf_(rec), hit = list.filter(function (c) { return c.id === contractId; })[0];
    if (!hit) return { abort: true, ok: false, err: 'not_found' };
    if (hit.files.length >= HR_MAX_FILES) return { abort: true, ok: false, err: 'too_many' };
    hit.files = hit.files.concat([meta]);
    rec.contracts = list;
  });
  if (!out.ok) return out;
  await writeJSON('hrfile:' + meta.id, { id: meta.id, staffId: staffId, contractId: contractId, name: meta.name, mime: mime, data: base64, added: meta.added, by: s.id });
  out.file = meta;
  return out;
}
async function hrGetFile(username, pin, fileId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  const f = await readJSON('hrfile:' + str_(fileId, 60), null);
  if (!f || !f.data) return { ok: false, err: 'not_found' };
  return { ok: true, id: f.id, name: f.name, mime: f.mime, dataUrl: 'data:' + f.mime + ';base64,' + f.data };
}
async function hrDeleteFile(username, pin, staffId, contractId, fileId) {
  const out = await hrMutate_(username, pin, staffId, function (rec) {
    const list = contractsOf_(rec), hit = list.filter(function (c) { return c.id === contractId; })[0];
    if (!hit || !hit.files.some(function (f) { return f.id === fileId; })) return { abort: true, ok: false, err: 'not_found' };
    hit.files = hit.files.filter(function (f) { return f.id !== fileId; });
    rec.contracts = list;
  });
  if (out.ok) { try { await hrDropFile_(store(), fileId); } catch (e) { /* the record is already clean */ } }
  return out;
}
/* ==================== the Library: books each person has read ====================
   Which Library books someone has marked read — on their own staff record as
   `libRead: { bookId: 'YYYY-MM-DD' }`, so the count follows them to any phone
   and teammates can see it. Only the count leaves through staffProfile; the
   list itself goes to its owner only. Ids are library.js slugs. */
const LIB_MAX = 300;
function cleanLibRead_(m) {
  const out = {};
  if (!m || typeof m !== 'object' || Array.isArray(m)) return out;
  Object.keys(m).slice(0, LIB_MAX).forEach(function (k) { if (/^[a-z0-9-]{1,80}$/.test(k)) out[k] = isoDate_(m[k]) || ''; });
  return out;
}
/* changes: { bookId: 'YYYY-MM-DD' } to mark read, { bookId: null } to unmark.
   The phone also sends what it marked before this was saved anywhere, once. */
async function libSaveReads(username, pin, changes) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return { ok: false, err: 'bad_changes' };
  const keys = Object.keys(changes).filter(function (k) { return /^[a-z0-9-]{1,80}$/.test(k); }).slice(0, LIB_MAX);
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === me.id; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const cur = cleanLibRead_(rows[idx].libRead);
    keys.forEach(function (k) {
      if (changes[k] === null || changes[k] === false) delete cur[k];
      else if (!cur[k]) cur[k] = isoDate_(changes[k]) || new Date().toISOString().slice(0, 10);
    });
    if (Object.keys(cur).length > LIB_MAX) return { abort: true, ok: false, err: 'too_many' };
    rows[idx].libRead = cur;
    return { ok: true, libRead: cur };
  });
}

/* ==================== required: papers every staff member signs ====================
   What every profile must have done (Uriah, Oct 2026): the Child Protection
   Policy and the Staff Manual read and signed in the app, and a staff
   contract on file — more papers can be added later from HR → Required.

   'reqDocs' is the list (title, the file or a link, a version). A file is its
   own blob (reqfile:<id>) like an HR attachment, so the list stays small. A
   signature is two things: on the staff record, `signed: { docId: {v, at,
   name} }` — small, read by everything that shows a status — and the drawn
   signature itself as reqsig:<docId>:<staffId>, read only when someone opens
   it. A new version (a replaced file, with "ask everyone to sign again") asks
   everyone again: a signature counts for the version it was given to.

   Who sees what: anyone may open the papers and sign their own; a person sees
   their own status; admins and HR see everyone's and can open a signature.
   Teammates never see anyone else's — the contract half is HR's business. */
const REQ_MAX_DOCS = 20;
const REQ_SIG_MAX = 150000;   // a drawn signature as a PNG data URL — a few KB in practice
function reqDocOut_(d) {
  return { id: d.id, title: d.title, kind: d.kind, url: d.url || '', fileName: d.fileName || '', mime: d.mime || '', size: d.size || 0,
    version: d.version, updated: d.updated || '', order: d.order || 0 };
}
function cleanReqDoc_(d) {
  if (!d || typeof d !== 'object') return null;
  const id = str_(d.id, 60), title = str_(d.title, 120);
  if (!id || !title) return null;
  const url = /^https?:\/\//i.test(String(d.url || '')) ? str_(d.url, 500) || '' : '';
  return { id: id, title: title, kind: d.fileId ? 'file' : (url ? 'link' : 'none'), url: url,
    fileId: str_(d.fileId, 60) || '', fileName: str_(d.fileName, 160) || '', mime: str_(d.mime, 80) || '', size: finiteNum_(d.size, 0, 1e9) || 0,
    version: finiteNum_(d.version, 1, 1e6) || 1, updated: str_(d.updated, 40) || '', by: str_(d.by, 60) || '', order: finiteNum_(d.order, 0, 1000) || 0 };
}
async function getReqDocs_() {
  return (await readJSON('reqDocs', [])).map(cleanReqDoc_).filter(Boolean)
    .sort(function (a, b) { return a.order - b.order || (a.title < b.title ? -1 : 1); });
}
/* The contract half, from HR's own record: done while the newest contract has
   not run out (one running out soon is still done — HR's renewals list is
   where that shows). */
function contractState_(s) {
  /* a contract HR has started but not yet signed with them doesn't count */
  const list = contractsOf_(s).filter(contractInForce_);
  if (!list.length) return { done: false, state: 'none', ends: '' };
  const end = hrContractEnd_(list[list.length - 1]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ends = end.getFullYear() + '-' + String(end.getMonth() + 1).padStart(2, '0') + '-01';
  if (end <= today) return { done: false, state: 'expired', ends: ends };
  return { done: true, state: 'current', ends: ends, soon: Math.round((end - today) / 86400000) <= HR_DUE_DAYS };
}
/* One person's list: each paper (signed for its current version?) and the
   contract. A paper with nothing to read yet (no file, no link) is not asked. */
function requiredFor_(s, docs) {
  const signed = (s && s.signed && typeof s.signed === 'object' && !Array.isArray(s.signed)) ? s.signed : {};
  const items = docs.filter(function (d) { return d.kind !== 'none'; }).map(function (d) {
    const g = signed[d.id], ok = !!(g && Number(g.v) === d.version);
    return { id: d.id, kind: 'doc', title: d.title, done: ok, at: ok ? str_(g.at, 40) || '' : '', older: !!(g && !ok) };
  });
  const cp = s && s.legal && s.legal.child;
  items.push({ id: 'legal:child', kind: 'legal', title: 'Child Protection Agreement', done: !!cp, at: cp ? str_(cp.at, 40) : '' });
  const c = contractState_(s);
  items.push({ id: 'contract', kind: 'contract', title: 'Staff contract', done: c.done, state: c.state, ends: c.ends, soon: !!c.soon });
  const done = items.filter(function (x) { return x.done; }).length;
  return { items: items, done: done, total: items.length, finished: done === items.length };
}
function reqDocsAnswer_(docs) { return docs.map(reqDocOut_); }

async function reqDocSave(username, pin, doc) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  if (!doc || typeof doc !== 'object') return { ok: false, err: 'bad_doc' };
  const title = str_(doc.title, 120);
  if (!title) return { ok: false, err: 'no_title' };
  const url = doc.url === undefined ? undefined : (doc.url === '' || doc.url === null ? '' : (/^https?:\/\//i.test(String(doc.url)) && str_(doc.url, 500)) || null);
  if (url === null) return { ok: false, err: 'bad_link' };
  const docs = await getReqDocs_();
  let hit = doc.id ? docs.filter(function (d) { return d.id === doc.id; })[0] : null;
  if (doc.id && !hit) return { ok: false, err: 'not_found' };
  const now = new Date().toISOString();
  if (!hit) {
    if (docs.length >= REQ_MAX_DOCS) return { ok: false, err: 'too_many' };
    hit = cleanReqDoc_({ id: hrId_('rd'), title: title, url: url || '', version: 1, updated: now, by: s.id, order: docs.length ? Math.max.apply(null, docs.map(function (d) { return d.order; })) + 1 : 0 });
    docs.push(hit);
  } else {
    hit.title = title;
    if (url !== undefined && url !== hit.url) { hit.url = url; if (doc.resign) hit.version++; }
    if (finiteNum_(doc.order, 0, 1000) !== null) hit.order = Number(doc.order);
    hit.updated = now; hit.by = s.id;
    Object.assign(hit, cleanReqDoc_(hit));
  }
  await writeJSON('reqDocs', docs);
  return { ok: true, doc: reqDocOut_(hit), docs: reqDocsAnswer_(docs) };
}
async function reqDocUpload(username, pin, docId, name, mime, base64, resign) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  mime = str_(mime, 80);
  if (HR_FILE_MIME.indexOf(mime) === -1) return { ok: false, err: 'bad_type' };
  if (typeof base64 !== 'string' || !base64) return { ok: false, err: 'bad_file' };
  if (base64.length > HR_FILE_MAX_B64) return { ok: false, err: 'too_large' };
  const docs = await getReqDocs_();
  const hit = docs.filter(function (d) { return d.id === docId; })[0];
  if (!hit) return { ok: false, err: 'not_found' };
  const fileId = hrId_('rf'), old = hit.fileId, now = new Date().toISOString();
  await writeJSON('reqfile:' + fileId, { id: fileId, docId: hit.id, name: str_(name, 160) || 'document', mime: mime, data: base64, added: now, by: s.id });
  const hadSomething = hit.kind !== 'none';
  hit.fileId = fileId; hit.fileName = str_(name, 160) || 'document'; hit.mime = mime; hit.size = Math.floor(base64.length * 3 / 4);
  hit.url = ''; hit.kind = 'file'; hit.updated = now; hit.by = s.id;
  if (resign && hadSomething) hit.version++;
  await writeJSON('reqDocs', docs);
  if (old) { try { await hrDropReqFile_(old); } catch (e) { /* the list already points at the new one */ } }
  return { ok: true, doc: reqDocOut_(hit), docs: reqDocsAnswer_(docs) };
}
async function hrDropReqFile_(fileId) {
  const st = store();
  if (typeof st.delete === 'function') await st.delete('reqfile:' + fileId);
  else await st.setJSON('reqfile:' + fileId, null);
}
async function reqDocDelete(username, pin, docId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  const docs = await getReqDocs_();
  const hit = docs.filter(function (d) { return d.id === docId; })[0];
  if (!hit) return { ok: false, err: 'not_found' };
  const rest = docs.filter(function (d) { return d.id !== docId; });
  await writeJSON('reqDocs', rest);
  if (hit.fileId) { try { await hrDropReqFile_(hit.fileId); } catch (e) { /* gone from the list either way */ } }
  return { ok: true, docs: reqDocsAnswer_(rest) };
}
/* Anyone signed in may open a paper — everyone has to read it. */
async function reqDocFile(username, pin, docId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const hit = (await getReqDocs_()).filter(function (d) { return d.id === docId; })[0];
  if (!hit || !hit.fileId) return { ok: false, err: 'not_found' };
  const f = await readJSON('reqfile:' + hit.fileId, null);
  if (!f || !f.data) return { ok: false, err: 'not_found' };
  return { ok: true, name: f.name, mime: f.mime, dataUrl: 'data:' + f.mime + ';base64,' + f.data };
}
async function reqSign(username, pin, docId, version, name, sig) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (isApplicant_(s)) return { ok: false, err: 'not_staff' };
  const docs = await getReqDocs_();
  const hit = docs.filter(function (d) { return d.id === docId; })[0];
  if (!hit || hit.kind === 'none') return { ok: false, err: 'not_found' };
  if (Number(version) !== hit.version) return { ok: false, err: 'new_version', docs: reqDocsAnswer_(docs) };
  const typed = str_(name, 100);
  if (!typed || typed.length < 2) return { ok: false, err: 'no_name' };
  if (typeof sig !== 'string' || sig.indexOf('data:image/png;base64,') !== 0 || sig.length < 200 || sig.length > REQ_SIG_MAX) return { ok: false, err: 'bad_signature' };
  const at = new Date().toISOString();
  await writeJSON('reqsig:' + hit.id + ':' + s.id, { docId: hit.id, staffId: s.id, v: hit.version, title: hit.title, at: at, name: typed, sig: sig });
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const signed = (rows[idx].signed && typeof rows[idx].signed === 'object' && !Array.isArray(rows[idx].signed)) ? rows[idx].signed : {};
    signed[hit.id] = { v: hit.version, at: at, name: typed };
    rows[idx].signed = signed;
    return { ok: true, required: requiredFor_(rows[idx], docs), docs: reqDocsAnswer_(docs) };
  });
}
/* The drawn signature — its owner, or an admin / HR. */
async function reqSignature(username, pin, docId, staffId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const who = str_(staffId, 60) || s.id;
  if (who !== s.id && !canHR_(s)) return { ok: false, err: 'not_authorized' };
  const g = await readJSON('reqsig:' + str_(docId, 60) + ':' + who, null);
  if (!g || !g.sig) return { ok: false, err: 'not_found' };
  return { ok: true, name: g.name, at: g.at, v: g.v, title: g.title || '', sig: g.sig };
}
/* Everyone's list, for HR → Required. */
async function reqStatusAll(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  const docs = await getReqDocs_();
  const rows = (await getStaff_()).filter(function (r) { return r.active && !r.archived && !isApplicant_(r); });
  return { ok: true, docs: reqDocsAnswer_(docs), people: rows.map(function (r) {
    return { id: r.id, name: r.name, campus: r.campus, dept: r.dept, ministry: r.ministry || '', photo: r.photo || '', required: requiredFor_(r, docs) };
  }) };
}

async function hrArchive(username, pin, staffId, info) {
  return hrMutate_(username, pin, staffId, function (rec, me) {
    if (rec.id === me.id) return { abort: true, ok: false, err: 'self_archive' };
    const at = isoDate_(info && info.at) || new Date().toISOString().slice(0, 10);
    rec.archived = { at: at, reason: str_(info && info.reason, 300), by: me.id };
    rec.active = false;
  });
}
/* Archive a group at once — a school or team that has left — in ONE write of the
   staff list, so twenty archives cannot race each other the way twenty single
   calls would. Same rules and record as hrArchive: admin or HR, never yourself,
   the date and reason on each, active off; someone already archived is left as
   they were. Bringing anyone back is still one at a time (hrUnarchive). */
const HR_ARCHIVE_MANY_MAX = 200;
async function hrArchiveMany(username, pin, ids, info) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canHR_(s)) return { ok: false, err: 'not_authorized' };
  if (!Array.isArray(ids) || !ids.length) return { ok: false, err: 'none' };
  if (ids.length > HR_ARCHIVE_MANY_MAX) return { ok: false, err: 'too_many' };
  const want = new Set(ids.map(function (x) { return str_(x, 60); }));
  if (want.has(s.id)) return { ok: false, err: 'self_archive' };
  const at = isoDate_(info && info.at) || new Date().toISOString().slice(0, 10);
  const reason = str_(info && info.reason, 300);
  return mutateStaff_(function (rows) {
    let n = 0;
    const now = new Date().toISOString();
    rows.forEach(function (r) {
      if (!want.has(r.id) || r.archived) return;
      r.archived = { at: at, reason: reason, by: s.id };
      r.active = false;
      r.updated = now;
      n++;
    });
    return { ok: true, archived: n };
  });
}
async function hrUnarchive(username, pin, staffId) {
  return hrMutate_(username, pin, staffId, function (rec) {
    if (!rec.archived) return { abort: true, ok: false, err: 'not_archived' };
    rec.archived = null;
    rec.active = true;
  });
}

/* ==================== candidates — potential staff & volunteers ====================
   The CRM side of HR: people who might join — staff, volunteers, students —
   from first contact to arrival. One record per person in the 'candidates'
   blob, with a stage (new → contacted → applied → interview → accepted →
   arrived), a next step with a date (the follow-up reminders hang on it),
   a running log of notes and stage moves, and an archive box (declined,
   withdrew, no answer). Once someone arrives and has an account, the
   record can point at it (staffId). Same gate as the rest of HR. */
const CAND_TYPES = ['staff', 'volunteer', 'student', 'team'];
const CAND_STAGES = ['new', 'contacted', 'applied', 'interview', 'accepted', 'practical', 'arrived'];
/* A short-term team moves through its own stages — there is no interview,
   only calls: a 1st call to get to know each other and go over logistics,
   then the documents and the visa, then a 2nd call for cultural orientation
   with the whole team. Team records from before this map across on read. */
const TEAM_STAGES = ['new', 'applied', 'call1', 'docs', 'call2', 'practical', 'arrived'];
const TEAM_STAGE_FROM = { contacted: 'call1', interview: 'call1', accepted: 'docs' };
function stagesFor_(type) { return type === 'team' ? TEAM_STAGES : CAND_STAGES; }
function teamStage_(stage) { return TEAM_STAGE_FROM[stage] || stage; }
const CAND_FOLLOWUP_DAYS = 7, CAND_MAX = 2000, CAND_LOG_MAX = 300;
const CAND_CALLS_MAX = 300, CAND_CALL_TEXT_MAX = 5000;
/* A member listed before members carried ids (Oct 2026) gets one on read, made
   from the name so it is the same every time until the list is next saved —
   then the photos and the strengths know them too. */
function memberKeyFor_(name, i) {
  let h = 5381; const str = String(name || '').toLowerCase() + '|' + i;
  for (let k = 0; k < str.length; k++) h = ((h << 5) + h + str.charCodeAt(k)) >>> 0;
  return 'mh' + h.toString(36);
}
async function getCandidates_() {
  return (await readJSON('candidates', [])).map(function (c) {
    if (c && c.type === 'team' && TEAM_STAGE_FROM[c.stage]) c.stage = TEAM_STAGE_FROM[c.stage];
    if (c && c.type === 'team' && c.portal && Array.isArray(c.portal.members)) {
      c.portal.members.forEach(function (m, i) { if (m && typeof m === 'object' && !m.id) m.id = memberKeyFor_(m.name, i); });
    }
    return c;
  });
}
function cleanCandidate_(c, prev, me) {
  if (!c || typeof c !== 'object') return null;
  const name = str_(c.name, 120);
  if (!name) return null;
  const type = CAND_TYPES.indexOf(c.type) > -1 ? c.type : (prev ? prev.type : 'staff');
  const wanted = type === 'team' ? teamStage_(c.stage) : c.stage;
  const stage = stagesFor_(type).indexOf(wanted) > -1 ? wanted : (prev ? (type === 'team' ? teamStage_(prev.stage) : prev.stage) : 'new');
  const now = new Date().toISOString();
  return {
    id: prev ? prev.id : hrId_('cd'), campus: str_(c.campus, 40) || (prev ? prev.campus : me.campus),
    name: name, type: type, stage: stage, subtype: str_(c.subtype, 60), school: str_(c.school, 80),
    email: str_(c.email, 120), phone: str_(c.phone, 60), country: str_(c.country, 60), source: str_(c.source, 120),
    assignedTo: str_(c.assignedTo, 60), nextStep: str_(c.nextStep, 200), nextDate: isoDate_(c.nextDate), expected: isoMonth_(c.expected),
    notes: str_(c.notes, 1000), staffId: str_(c.staffId, 60) || (prev ? (prev.staffId || '') : ''),
    // The portal's own fields ride along untouched by a CRM edit: the
    // messenger the applicant chose, and the application itself (answers,
    // documents, references), which only the portal handlers write.
    messenger: PORTAL_MESSENGERS.indexOf(c.messenger) > -1 ? c.messenger : (prev ? (prev.messenger || '') : ''),
    portal: prev ? (prev.portal || null) : null,
    calls: prev && Array.isArray(prev.calls) ? prev.calls : undefined,   // call notes: only hrCandidateCall writes them
    log: prev ? (Array.isArray(prev.log) ? prev.log : []) : [], archived: prev ? (prev.archived || null) : null, archiveOff: prev && prev.archiveOff ? true : undefined,
    created: prev ? prev.created : now, createdBy: prev ? prev.createdBy : me.id, updated: now, updatedBy: me.id
  };
}
function candFollowUpsCount_(rows) {
  const limit = new Date(); limit.setHours(0, 0, 0, 0); limit.setDate(limit.getDate() + CAND_FOLLOWUP_DAYS);
  const cut = limit.toISOString().slice(0, 10);
  return (rows || []).filter(function (c) { return c && !c.archived && c.nextDate && c.nextDate <= cut; }).length;
}
async function hrGate_(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { s: null, out: { ok: false } };
  // HR and the portal's staff work the same records.
  if (!canHR_(s) && !canPortal_(s)) return { s: null, out: { ok: false, err: 'not_authorized' } };
  return { s: s, out: null };
}
async function hrCandidates(username, pin) {
  const g = await hrGate_(username, pin); if (g.out) return g.out;
  return { ok: true, candidates: await getCandidates_() };
}
async function hrSaveCandidate(username, pin, cand) {
  const g = await hrGate_(username, pin); if (g.out) return g.out;
  const rows = await getCandidates_();
  const id = str_(cand && cand.id, 60);
  const idx = id ? rows.findIndex(function (r) { return r && r.id === id; }) : -1;
  if (id && idx === -1) return { ok: false, err: 'not_found' };
  const prev = idx > -1 ? rows[idx] : null;
  if (prev && !canHR_(g.s) && !portalMaySee_(g.s, prev)) return { ok: false, err: 'not_authorized' };
  const rec = cleanCandidate_(cand, prev, g.s);
  if (!rec) return { ok: false, err: 'bad_candidate' };
  if (!canHR_(g.s) && !portalMaySee_(g.s, rec)) return { ok: false, err: 'not_authorized' };
  if (!prev && rows.length >= CAND_MAX) return { ok: false, err: 'too_many' };
  if (prev && prev.stage !== rec.stage) rec.log = rec.log.concat([{ at: rec.updated, by: g.s.id, kind: 'stage', text: rec.stage }]).slice(-CAND_LOG_MAX);
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('candidates', rows);
  if (rec.type === 'team') await syncTeamTrip_(rec, g.s.id);   // every team application is a team in the Teams Database
  return { ok: true, candidate: rec };
}
async function hrCandidateNote(username, pin, id, text) {
  const g = await hrGate_(username, pin); if (g.out) return g.out;
  text = str_(text, 1000);
  if (!text) return { ok: false, err: 'empty' };
  const rows = await getCandidates_();
  const idx = rows.findIndex(function (r) { return r && r.id === str_(id, 60); });
  if (idx === -1) return { ok: false, err: 'not_found' };
  if (!canHR_(g.s) && !portalMaySee_(g.s, rows[idx])) return { ok: false, err: 'not_authorized' };
  const now = new Date().toISOString();
  rows[idx].log = (Array.isArray(rows[idx].log) ? rows[idx].log : []).concat([{ at: now, by: g.s.id, kind: 'note', text: text }]).slice(-CAND_LOG_MAX);
  rows[idx].updated = now; rows[idx].updatedBy = g.s.id;
  await writeJSON('candidates', rows);
  return { ok: true, candidate: rows[idx] };
}
/* Notes from a call with a team's leader (or any applicant): the day, who was
   on the call and what was said. Kept on the record as `calls`, apart from the
   short log, and never sent to the applicant (portalAppOut_ lists its fields).
   call = {date, with, text} adds one; with {id} it edits it; {id, remove:true}
   deletes it. Only the one who wrote a call note, or a portal admin, can
   change or delete it. */
async function hrCandidateCall(username, pin, id, call) {
  const g = await hrGate_(username, pin); if (g.out) return g.out;
  call = call && typeof call === 'object' ? call : {};
  const rows = await getCandidates_();
  const idx = rows.findIndex(function (r) { return r && r.id === str_(id, 60); });
  if (idx === -1) return { ok: false, err: 'not_found' };
  if (!canHR_(g.s) && !portalMaySee_(g.s, rows[idx])) return { ok: false, err: 'not_authorized' };
  const c = rows[idx], now = new Date().toISOString();
  const calls = Array.isArray(c.calls) ? c.calls.slice() : [];
  const cid = str_(call.id, 40);
  const at = cid ? calls.findIndex(function (x) { return x && x.id === cid; }) : -1;
  if (cid && at === -1) return { ok: false, err: 'not_found' };
  if (at > -1 && calls[at].by !== g.s.id && !isPortalAdmin_(g.s)) return { ok: false, err: 'not_authorized' };
  if (call.remove) {
    if (at === -1) return { ok: false, err: 'not_found' };
    calls.splice(at, 1);
  } else {
    const raw = String(call.text == null ? '' : call.text).trim();
    if (!raw) return { ok: false, err: 'empty' };
    if (raw.length > CAND_CALL_TEXT_MAX) return { ok: false, err: 'too_long' };
    const rec = { id: at > -1 ? calls[at].id : hrId_('cl'), date: isoDate_(call.date) || now.slice(0, 10), with: str_(call.with, 120) || '', text: raw,
      by: at > -1 ? calls[at].by : g.s.id, at: at > -1 ? calls[at].at : now };
    if (at > -1) { rec.edited = now; rec.editedBy = g.s.id; calls[at] = rec; }
    else { if (calls.length >= CAND_CALLS_MAX) return { ok: false, err: 'too_many' }; calls.push(rec); }
  }
  c.calls = calls;
  c.updated = now; c.updatedBy = g.s.id;
  await writeJSON('candidates', rows);
  return { ok: true, candidate: c };
}
async function hrArchiveCandidate(username, pin, id, info) {
  const g = await hrGate_(username, pin); if (g.out) return g.out;
  const rows = await getCandidates_();
  const idx = rows.findIndex(function (r) { return r && r.id === str_(id, 60); });
  if (idx === -1) return { ok: false, err: 'not_found' };
  if (!canHR_(g.s) && !portalMaySee_(g.s, rows[idx])) return { ok: false, err: 'not_authorized' };
  const now = new Date().toISOString();
  if (info === null) { if (rows[idx].archived && rows[idx].archived.left) rows[idx].archiveOff = true; rows[idx].archived = null; }
  else rows[idx].archived = { at: now.slice(0, 10), reason: str_(info && info.reason, 300), by: g.s.id };
  rows[idx].updated = now; rows[idx].updatedBy = g.s.id;
  await writeJSON('candidates', rows);
  await syncTeamTrip_(rows[idx], g.s.id, info === null ? 'active' : 'cancelled');   // a closed team application is a cancelled team (one that left is archived by itself, not here)
  return { ok: true, candidate: rows[idx] };
}

/* ==================== YWAM GP Portal ====================
   The application portal (public/portal.html): students, potential staff,
   volunteers and short-term teams apply from their phones and follow their
   application; the applications department works the same records as a
   CRM. See docs/portal-plan.md for the whole shape and the milestones.

   Accounts are ordinary staff rows with kind:'applicant' — same username +
   PIN, same throttle, same mutateStaff_ — and every ordinary handler is
   CLOSED to them: verifyStaff_ answers null for an applicant unless the
   handler opts in (the third argument), so an applicant cannot log a day,
   read a roster, or reach HR by holding a valid PIN. They are also left out
   of every roster and count. The record carries applicant:{type, school,
   candidateId}; the application itself is the candidate record in the
   'candidates' blob (the existing HR CRM), pointing back with staffId and
   source:'portal'.

   Who may work the portal is a flag an admin sets by hand — portalStaff
   (see every applicant, move stages, notes, owner) and portalAdmin (that,
   plus grant / revoke portalStaff). An app admin has both and is the only
   one who can make a portal admin. Nobody gets it by being staff. */
/* Where you apply to. Each campus runs its own schools: Poipet DTS and DBS,
   Siem Reap all four. DBS, BCS and SMS are secondary schools — a completed
   DTS is the prerequisite — which the forms ask about; here it only decides
   what can be picked where. A third campus is one more row. */
const PORTAL_CAMPUSES = { poipet: ['dts', 'dbs'], siemreap: ['dts', 'dbs', 'bcs', 'sms'] };
const PORTAL_DEFAULT_CAMPUS = 'siemreap';
const PORTAL_TYPES = ['student', 'staff', 'volunteer', 'team'];
const PORTAL_SCHOOLS = ['dts', 'dbs', 'bcs', 'sms'];
const PORTAL_SECONDARY = ['dbs', 'bcs', 'sms'];
const PORTAL_MESSENGERS = ['whatsapp', 'telegram'];
/* The applicant's own view of the CRM stages, in the order the journey runs
   (the CRM's own list keeps 'contacted' before 'applied' because a lead is
   usually contacted before they apply — on the portal it is the other way
   round, and a stage move by staff can land anywhere on this line). */
const PORTAL_STAGE_ORDER = ['new', 'applied', 'contacted', 'interview', 'accepted', 'practical', 'arrived'];
function isApplicant_(s) { return !!(s && s.kind === 'applicant'); }
/* The leader of Outreach Teams hosts the short-term teams, so they work team
   applications on the portal without anyone ticking Portal access for them:
   the admin who makes someone that ministry's leader has already said so. */
function leadsTeams_(s) { return isLeaderOf_(s, TEAM_DEPT, TEAM_MIN); }
function canPortal_(s) { return !!(s && !isApplicant_(s) && s.active !== false && (s.isAdmin || s.portalAdmin || s.portalStaff || leadsTeams_(s))); }
function isPortalAdmin_(s) { return !!(s && !isApplicant_(s) && s.active !== false && (s.isAdmin || s.portalAdmin)); }
/* Which kinds of application a portal staff member works. Outreach Teams
   hosts the short-term teams, so someone on that ministry sees team
   applications and nothing else; everyone else with access sees them all.
   null means "all". Admins and portal admins always see all. */
function portalTypes_(s) {
  if (!s || isPortalAdmin_(s)) return null;
  if (deptOf_(s) === TEAM_DEPT && s.ministry === TEAM_MIN) return ['team'];
  // in only as the Outreach Teams leader: team applications, same as its staff
  if (!s.portalStaff && leadsTeams_(s)) return ['team'];
  return null;
}
function portalMaySee_(s, c) { const ty = portalTypes_(s); return !ty || !c || ty.indexOf(c.type) > -1; }
function portalRole_(s) {
  if (isApplicant_(s)) return 'applicant';
  if (isPortalAdmin_(s)) return 'portal-admin';
  if (canPortal_(s)) return 'portal-staff';
  return null;
}
function cleanPhone_(v) {
  const s = String(str_(v, 40) || '').replace(/[^\d+ ()-]/g, '').trim();
  return /\d{6,}/.test(s.replace(/\D/g, '')) ? s : '';
}
function portalStaffOut_(s) {
  return { id: s.id, name: s.name, username: s.username, campus: s.campus, isAdmin: !!s.isAdmin, portalAdmin: !!s.portalAdmin, portalStaff: !!s.portalStaff, role: portalRole_(s) };
}
/* Khmer or international decides two things: whether a leader reference is
   asked for (Khmer students: no; teams: no — a church, not a person; everyone
   else: yes) and whether the visa guide applies (everyone not from Cambodia:
   international students, staff, volunteers, teams). Country comes from
   sign-up, which is why it is required there. */
function audienceOf_(c) { return cleanCountry_(c && c.country) === 'Cambodia' ? 'khmer' : 'international'; }
function needsVisa_(c) { return audienceOf_(c) === 'international'; }
function refNeeded_(c) { return !(c && (c.type === 'team' || (c.type === 'student' && audienceOf_(c) === 'khmer'))); }
function formKeyOf_(c) { return c.type === 'student' ? (PORTAL_SCHOOLS.indexOf(c.school) > -1 ? c.school : 'dts') : (PORTAL_FORMS_DEFAULT[c.type] ? c.type : 'staff'); }
function portalStageIdx_(stage, type) { const i = (type === 'team' ? TEAM_STAGES : PORTAL_STAGE_ORDER).indexOf(stage); return i === -1 ? 0 : i; }
/* What the applicant is told, derived on the server from the record so the
   dashboard and the staff view can never disagree about where someone is. */
function portalStatus_(c) {
  if (c.archived && c.archived.left) return 'completed';
  if (c.archived) return 'closed';
  const submitted = !!(c.portal && c.portal.submittedAt);
  if (c.type === 'team') return c.stage === 'new' ? (submitted ? 'pending' : 'draft') : c.stage === 'applied' ? 'pending' : c.stage;   // call1 | docs | call2 | practical | arrived
  if (c.stage === 'new') return submitted ? 'pending' : 'draft';
  if (c.stage === 'applied') return 'pending';
  if (c.stage === 'contacted') return 'in_review';
  return c.stage;   // interview | accepted | practical | arrived
}
/* ==================== a team's journey ====================
   A short-term team runs differently from a student: no reference and no
   interview. Its stages (TEAM_STAGES) are New → Applied → 1st call →
   Awaiting documents → 2nd call (cultural orientation) → Getting ready →
   Arrived, and inside Awaiting documents the order matters:
     1. the team uploads passport copies for everyone, a team photo with
        names, and the flight itineraries (the visa process can't start
        without flights);
     2. then the visa part opens — we send the letter of invitation and its
        supporting documents (uploaded by staff, from: 'us');
     3. the team applies, and uploads the approved e-visas.
   A team that needs no visa (from Cambodia) skips 2 and 3.
   Each step ticks itself when the portal can see it happen (a document
   uploaded, a stage reached), and by a STAFF TICK when it happens outside
   the portal (the two calls, arrival). The stage follows the steps
   forward on its own (teamAutoStage_): the 1st call done → Awaiting
   documents; everything in → 2nd call; the 2nd call done → Getting ready. */
const TEAM_TICKS = ['call1', 'call2', 'arrived'];
function teamFlags_(c) { return (c && c.portal && c.portal.team) || {}; }
function hasDoc_(c, kind) { return docsOf_(c).some(function (d) { return d && d.kind === kind; }); }
function teamDocsIn_(c) { return hasDoc_(c, 'passports') && hasPhotoDoc_(c) && (hasDoc_(c, 'flights') || !!((c.portal && c.portal.visa) || {}).flightsConfirmed); }
function teamVisaDone_(c) { return !needsVisa_(c) || hasDoc_(c, 'evisa'); }
function teamSteps_(c) {
  const idx = portalStageIdx_(c.stage, 'team');
  const at = function (stage) { return idx >= portalStageIdx_(stage, 'team'); };
  const f = teamFlags_(c), visa = (c.portal && c.portal.visa) || {}, intl = needsVisa_(c);
  const submitted = !!(c.portal && c.portal.submittedAt) || at('applied');
  const past = at('call2');   // the documents are behind them
  const steps = [
    { id: 'account', done: true, who: 'you' },
    { id: 'form', done: submitted, who: 'you', auto: true },
    { id: 'call1', done: !!f.call1 || at('docs'), who: 'us', tick: true },
    { id: 'passports', done: past || hasDoc_(c, 'passports'), who: 'you', auto: true, group: 'docs' },
    { id: 'photo', done: past || hasPhotoDoc_(c), who: 'you', auto: true, group: 'docs' },
    { id: 'flights', done: past || hasDoc_(c, 'flights') || !!visa.flightsConfirmed, who: 'you', auto: true, group: 'docs' },
    intl && { id: 'invitation', done: past || hasDoc_(c, 'invitation') || !!visa.invitationSent, who: 'us', auto: true, group: 'visa' },
    intl && { id: 'evisa', done: past || hasDoc_(c, 'evisa'), who: 'you', auto: true, group: 'visa' },
    { id: 'rooms', done: !!(c.portal && c.portal.rooms) || at('arrived'), who: 'us', auto: true, side: true },   // SR Hospitality booked their beds (syncTeamRooms_); any time, so never the current step
    { id: 'call2', done: !!f.call2 || at('practical'), who: 'us', tick: true },
    { id: 'practical', done: at('arrived'), who: 'you' },
    { id: 'arrived', done: at('arrived'), who: 'us', tick: true }
  ].filter(Boolean);
  let current = -1;
  steps.forEach(function (st, i) { if (current === -1 && !st.done && !st.side) current = i; });
  if (current === -1) current = steps.length - 1;
  steps.forEach(function (st, i) { st.state = st.done ? 'done' : (i === current ? 'current' : 'todo'); });
  if (c.archived) steps.forEach(function (st) { if (st.state === 'current') st.state = 'todo'; });
  return steps;
}
/* Moves a team's stage forward to where its steps say it is — never back.
   Returns true when it moved, and logs the move as `by`. */
function teamAutoStage_(c, by) {
  if (!c || c.type !== 'team' || c.archived) return false;
  const f = teamFlags_(c);
  const idx = function (st) { return portalStageIdx_(st, 'team'); };
  let target = c.stage;
  const forward = function (st) { if (idx(st) > idx(target)) target = st; };
  if (c.portal && c.portal.submittedAt) forward('applied');
  if (f.call1) forward('docs');
  if (idx(target) >= idx('docs') && teamDocsIn_(c) && teamVisaDone_(c)) forward('call2');
  if (f.call2) forward('practical');
  if (target === c.stage) return false;
  const now = new Date().toISOString();
  c.stage = target;
  c.log = (Array.isArray(c.log) ? c.log : []).concat([{ at: now, by: by, kind: 'stage', text: target }]).slice(-CAND_LOG_MAX);
  return true;
}
function portalSteps_(c) {
  if (c && c.type === 'team') return teamSteps_(c);
  const idx = portalStageIdx_(c.stage);
  const submitted = !!(c.portal && c.portal.submittedAt) || idx >= portalStageIdx_('applied');
  const docsDone = !!(c.portal && c.portal.docsDone);
  const refNeeded = refNeeded_(c);
  const refDone = !refNeeded || !!(c.portal && c.portal.referenceDone);
  const at = function (stage) { return idx >= portalStageIdx_(stage); };
  /* The application and the leader reference go in first, side by side —
     both are the applicant's to do — and only once BOTH are in is it
     "received" and do we get in touch. A Khmer applicant has no reference. */
  const refIn = refDone || at('contacted');
  const steps = [
    { id: 'account', done: true },
    { id: 'form', done: submitted }
  ].concat(refNeeded ? [{ id: 'reference', done: refIn }] : []).concat([
    { id: 'received', done: submitted && refIn },
    { id: 'contact', done: at('contacted') },
    { id: 'docs', done: at('interview') || docsDone || docsRequiredIn_(c) },
    { id: 'interview', done: at('accepted') },
    { id: 'accepted', done: at('practical') },
    { id: 'practical', done: at('arrived') },
    { id: 'arrived', done: at('arrived') }
  ]);
  let current = -1;
  steps.forEach(function (st, i) { if (current === -1 && !st.done) current = i; });
  if (current === -1) current = steps.length - 1;
  steps.forEach(function (st, i) { st.state = st.done ? 'done' : (i === current ? 'current' : 'todo'); });
  if (c.archived) steps.forEach(function (st) { if (st.state === 'current') st.state = 'todo'; });
  return steps;
}
function portalAppOut_(c) {
  return {
    id: c.id, campus: c.campus || '', type: c.type, school: c.school || '', stage: c.stage, status: portalStatus_(c),
    submittedAt: (c.portal && c.portal.submittedAt) || null, updated: c.updated || '',
    archived: c.archived ? { at: c.archived.at } : null,
    audience: audienceOf_(c), needsVisa: needsVisa_(c), refNeeded: refNeeded_(c), formKey: formKeyOf_(c),
    visa: (c.portal && c.portal.visa) || {},
    visaOpen: visaOpen_(c),
    rooms: c.type === 'team' ? ((c.portal && c.portal.rooms) || null) : undefined,
    photos: c.type === 'team' ? ((c.portal && c.portal.photos) || null) : undefined,
    answers: (c.portal && c.portal.form && c.portal.form.answers) || (c.portal && c.portal.draft) || {},
    draftAt: (c.portal && c.portal.draftAt) || null,
    answersUpdatedAt: (c.portal && c.portal.form && c.portal.form.updatedAt) || null,
    docKinds: docKindsFor_(c), docs: docsOf_(c).map(docMeta_),
    members: c.type === 'team' ? ((c.portal && c.portal.members) || []) : undefined,
    photos: c.type === 'team' ? ((c.portal && c.portal.photos) || null) : undefined,
    reference: (function (r) { delete r.answers; delete r.leaderEmail; return r; })(refState_(c)), // the applicant never reads the reference
    steps: portalSteps_(c)
  };
}
/* The staff side's row — the CRM record plus the applicant's contact and
   messenger, so one tap opens the chat. */
function portalCandOut_(c, byId) {
  const acct = c.staffId ? byId[c.staffId] : null;
  return Object.assign({}, c, {
    messenger: c.messenger || (acct && acct.messenger) || '',
    phone: c.phone || (acct && acct.phone) || '',
    email: c.email || (acct && acct.email) || '',
    status: portalStatus_(c),
    audience: audienceOf_(c), needsVisa: needsVisa_(c), refNeeded: refNeeded_(c), formKey: formKeyOf_(c),
    reference: refState_(c),
    docKinds: docKindsFor_(c),
    steps: portalSteps_(c),
    hasAccount: !!acct
  });
}
async function candidateFor_(rows, s) {
  const cid = s.applicant && s.applicant.candidateId;
  return rows.find(function (r) { return r && (r.id === cid || r.staffId === s.id); }) || null;
}

/* ---- Sign in with Google ----
   The page gets an ID token from Google Identity Services and sends it here.
   Google's tokeninfo endpoint checks the signature; this checks that it was
   issued for OUR client id (GP_GOOGLE_CLIENT_ID, set on Netlify), that the
   email is verified and that it has not expired. Without the env var there
   is no Google button and every token is refused. Answers {email, name} or
   null. globalThis.fetch so a test can stand in for Google. */
const GOOGLE_ISS = ['accounts.google.com', 'https://accounts.google.com'];
function googleClientId_() { return String(process.env.GP_GOOGLE_CLIENT_ID || '').trim(); }
async function verifyGoogleToken_(token) {
  const cid = googleClientId_();
  if (!cid || !token || typeof token !== 'string' || token.length > 4096) return null;
  /* Two shapes: an ID token (a JWT, from Google's own button) or an access
     token from the page's own black button (google.accounts.oauth2) — the
     tokeninfo endpoint checks either; an access token's name comes from
     userinfo, and is optional. */
  const isJwt = token.split('.').length === 3;
  let info = null;
  try {
    const res = await globalThis.fetch('https://oauth2.googleapis.com/tokeninfo?' + (isJwt ? 'id_token=' : 'access_token=') + encodeURIComponent(token));
    if (!res || !res.ok) return null;
    info = await res.json();
  } catch (e) { return null; }
  if (!info || info.aud !== cid) return null;
  if (isJwt && GOOGLE_ISS.indexOf(info.iss) === -1) return null;
  if (String(info.email_verified) !== 'true' && String(info.verified_email) !== 'true') return null;
  if (isJwt ? !(Number(info.exp) * 1000 > Date.now()) : !(Number(info.expires_in) > 0)) return null;
  const email = cleanEmail_(info.email);
  if (!email) return null;
  let name = str_(info.name, 120) || '';
  if (!isJwt && !name) {
    try {
      const ui = await globalThis.fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + token } });
      if (ui && ui.ok) { const u = await ui.json(); name = str_(u && u.name, 120) || ''; }
    } catch (e) { /* the name is a nicety */ }
  }
  return { email: email, name: name, sub: String(info.sub || '') };
}
/* What the page needs before it can draw the sign-in: whether Google is on. */
async function portalAuthConfig() {
  return { ok: true, google: googleClientId_() };
}
/* Sign in with Google: a verified token for an email that has an applicant
   account signs them in — a fresh device token comes back, which the page
   keeps as its "pin". An email without an account gets 'new' with the name
   and email, and the page opens sign-up with those filled in. A staff
   member's email is told to use the staff door. */
async function portalLoginGoogle(idToken) {
  const g = await verifyGoogleToken_(idToken);
  if (!g) return { ok: false, err: 'google' };
  const rows = await getStaff_();
  const rec = rows.find(function (r) { return r.email === g.email || r.username === g.email; });
  if (!rec) return { ok: false, err: 'new', email: g.email, name: g.name };
  if (!isApplicant_(rec)) return { ok: false, err: 'staff' };
  if (rec.active === false) return { ok: false, err: 'auth' };
  let tok = '';
  const out = await mutateStaff_(function (all) {
    const idx = all.findIndex(function (r) { return r.id === rec.id; });
    if (idx === -1) return { abort: true, ok: false };
    tok = addDeviceToken_(all[idx]);
    all[idx].google = { sub: g.sub, lastAt: new Date().toISOString() };
    all[idx].updated = new Date().toISOString();
    return { ok: true };
  });
  if (!out || !out.ok) return { ok: false };
  await clearLoginThrottle_(rec.username);
  const boot = await portalBoot(rec.username, tok);
  if (!boot.ok) return boot;
  return Object.assign(boot, { user: rec.username, token: tok });
}
/* An applicant with an email and password changes it here (their own only). */
async function portalSetPassword(username, pin, newPassword) {
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { ok: false };
  if (!isApplicant_(s)) return { ok: false, err: 'not_applicant' };
  const pw = String(newPassword || '');
  if (pw.length < 8 || pw.length > 200) return { ok: false, err: 'bad_password' };
  const salt = pinSalt_() + pinSalt_();
  let user = s.username;
  const out = await mutateStaff_(function (all) {
    const idx = all.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false };
    const rec = all[idx];
    /* An older username + PIN account switching over: from now on the email
       is the username, like every other email account — unless another
       account already holds that email as its username. */
    if (authKindOf_(rec) === 'pin' && rec.email && !all.some(function (r) { return r.id !== rec.id && r.username === rec.email; })) rec.username = rec.email;
    rec.secretSalt = salt; rec.secretHash = hashSecret_(pw, salt);
    delete rec.pinHash; delete rec.pinSalt;
    rec.updated = new Date().toISOString();
    user = rec.username;
    return { ok: true };
  });
  return out && out.ok ? { ok: true, user: user } : (out || { ok: false });
}

/* ==================== the portal as a tool (Oct 2026, Uriah) ====================
   Four tabs for an applicant: their application, Meet our team, Team
   strengths and Resources. */

/* Meet our team: the campus staff of the applicant's campus — campus staff
   and YAP as one group, "YWAM <Campus> Campus Staff" — name, role and
   ministry, with photos fetched one by one (portalStaffPhoto) so the list
   itself stays light. Nothing else about a staff member leaves here. The
   heading is "<campus> Campus Staff" — the campus name already says YWAM. */
async function portalMeetTeam(username, pin) {
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { ok: false, err: 'auth' };
  const campus = s.campus || PORTAL_DEFAULT_CAMPUS, admin = isPortalAdmin_(s);
  const blob = await getTeamBlob_(), cards = blob.cards;
  const list = (await getStaff_()).filter(function (r) {
    const st = cleanStaffType_(r.staffType);
    return r && r.active !== false && !r.archived && !isApplicant_(r) && r.campus === campus && (st === 'campus' || st === 'yap');
  }).map(function (r) { return meetCard_(r, cards[r.id]); })
    .concat(blob.extra.filter(function (c) { return c.campus === campus; }).map(meetExtraCard_))
    .filter(function (c) { return admin || !c.hidden; })   // hidden ones only for the admin
    .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  return { ok: true, campus: campus, staff: list, canEdit: admin };
}
/* The card: the GP app's staff record fills it in, and whatever a portal admin
   changed on top (the 'portalTeamCards' blob, by staff id) wins — the GP app
   itself never sees those changes. */
function meetCard_(r, ov) {
  ov = ov || {};
  /* a role written in the portal is shown as written — nothing from the GP app beside it */
  const own = ov.role !== undefined;
  return { id: r.id, name: ov.name || r.name, role: own ? ov.role : (r.role || ''), ministry: own ? '' : (r.ministry || ''), dept: own ? '' : (deptOf_(r) || ''), hidden: !!ov.hidden, hasPhoto: !!meetPhoto_(r, ov), edited: !!(ov.name || ov.role !== undefined || ov.photo !== undefined) };
}
function meetPhoto_(r, ov) { return ov && ov.photo !== undefined ? ov.photo : (r.photo || ''); }
async function getTeamCards_() { return (await getTeamBlob_()).cards; }
/* 'portalTeamCards': { cards: { <staffId>: changes }, extra: [people added by hand] } */
async function getTeamBlob_() {
  const b = (await readJSON('portalTeamCards', { cards: {} })) || {};
  return { cards: b.cards && typeof b.cards === 'object' ? b.cards : {}, extra: Array.isArray(b.extra) ? b.extra : [] };
}
/* someone a portal admin added by hand — not in the GP app at all */
function meetExtraCard_(c) { return { id: c.id, name: c.name, role: c.role || '', ministry: '', dept: '', hidden: !!c.hidden, hasPhoto: !!c.photo, edited: true, custom: true }; }
const MEET_EXTRA_MAX = 60;
function meetStaffOk_(r, s) {
  const st = r && cleanStaffType_(r.staffType);
  return !!(r && r.active !== false && !r.archived && !isApplicant_(r) && r.campus === (s.campus || PORTAL_DEFAULT_CAMPUS) && (st === 'campus' || st === 'yap'));
}
async function portalStaffPhoto(username, pin, staffId) {
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { ok: false, err: 'auth' };
  const id = str_(staffId, 60), blob = await getTeamBlob_();
  if (/^pc_/.test(id)) {
    const c = blob.extra.find(function (x) { return x.id === id && x.campus === (s.campus || PORTAL_DEFAULT_CAMPUS); });
    return c ? { ok: true, id: c.id, photo: c.photo || '' } : { ok: false, err: 'not_found' };
  }
  const r = (await getStaff_()).find(function (x) { return x.id === id; });
  if (!meetStaffOk_(r, s)) return { ok: false, err: 'not_found' };
  return { ok: true, id: r.id, photo: meetPhoto_(r, blob.cards[r.id]) };
}
/* A portal admin fixes a card from the portal's Our team page — the name, the
   role or the photo (a square jpeg the page shrank, or '' to take it off).
   The change is kept in the portal only ('portalTeamCards'), on top of the
   GP app's record, which stays as it is; { reset: true } drops the change and
   the card reads from the GP app again. Only the cards applicants see
   (campus staff and YAP of the admin's campus). */
const STAFF_CARD_PHOTO_MAX_B64 = 160 * 1024;
async function portalSaveStaffCard(username, pin, staffId, patch) {
  const s = await verifyStaff_(username, pin);
  if (!s || !isPortalAdmin_(s)) return { ok: false, err: 'not_authorized' };
  patch = patch && typeof patch === 'object' ? patch : {};
  const id = str_(staffId, 60);
  let photoUri;
  if (patch.photo !== undefined) {
    if (patch.photo === '' || patch.photo === null) photoUri = '';
    else {
      if (typeof patch.photo !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(patch.photo) || patch.photo.length < 100) return { ok: false, err: 'bad_file' };
      if (patch.photo.length > STAFF_CARD_PHOTO_MAX_B64) return { ok: false, err: 'too_large' };
      photoUri = 'data:image/jpeg;base64,' + patch.photo;
    }
  }
  const name = patch.name !== undefined ? dutyText_(patch.name, 120) : undefined;
  if (name !== undefined && !name) return { ok: false, err: 'name_required' };
  const role = patch.role !== undefined ? dutyText_(patch.role, 80) : undefined;
  const reset = patch.reset === true, hidden = typeof patch.hidden === 'boolean' ? patch.hidden : undefined, remove = patch.remove === true;
  if (!reset && !remove && name === undefined && role === undefined && photoUri === undefined && hidden === undefined) return { ok: false, err: 'nothing' };
  const blob = await getTeamBlob_(), campus = s.campus || PORTAL_DEFAULT_CAMPUS, now = new Date().toISOString();
  /* someone added by hand: '' adds a new one (a name needed), 'pc_…' changes or removes one */
  if (!id || /^pc_/.test(id)) {
    let c = id ? blob.extra.find(function (x) { return x.id === id && x.campus === campus; }) : null;
    if (id && !c) return { ok: false, err: 'not_found' };
    if (remove) { blob.extra = blob.extra.filter(function (x) { return x !== c; }); await writeJSON('portalTeamCards', blob); return { ok: true, removed: id }; }
    if (!c) {
      if (!name) return { ok: false, err: 'name_required' };
      if (blob.extra.length >= MEET_EXTRA_MAX) return { ok: false, err: 'too_many' };
      c = { id: 'pc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), campus: campus, name: name, role: '', photo: '' };
      blob.extra.push(c);
    }
    if (name !== undefined) c.name = name;
    if (role !== undefined) c.role = role;
    if (photoUri !== undefined) c.photo = photoUri;
    if (hidden !== undefined) c.hidden = hidden;
    c.at = now; c.by = s.id;
    await writeJSON('portalTeamCards', blob);
    return { ok: true, staff: meetExtraCard_(c), photo: c.photo || '' };
  }
  const r = (await getStaff_()).find(function (x) { return x.id === id; });
  if (!meetStaffOk_(r, s)) return { ok: false, err: 'not_found' };
  if (reset) delete blob.cards[id];
  else {
    const ov = Object.assign({}, blob.cards[id] || {});
    if (name !== undefined) ov.name = name;
    if (role !== undefined) ov.role = role;
    if (photoUri !== undefined) ov.photo = photoUri;
    if (hidden !== undefined) ov.hidden = hidden;
    ov.at = now; ov.by = s.id;
    blob.cards[id] = ov;
  }
  await writeJSON('portalTeamCards', blob);
  const ov2 = blob.cards[id];
  return { ok: true, staff: meetCard_(r, ov2), photo: meetPhoto_(r, ov2) };
}

/* Team strengths: the personality questionnaire from the staff app, taken
   (or the type typed in) by each person on a team — the leader, co-leaders
   and members, the same keys as the photos — or by a lone applicant ('me').
   One blob per application, 'tpers:<candidateId>', so the team can see and
   compare. The type is checked against the sixteen; scores are 0–100 per
   axis or absent (a type someone already knew). */
const P_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
function strengthsPeople_(c) {
  if (c.type === 'team') return teamPhotoPeople_(c);
  return [{ key: 'me', name: c.name, role: 'me' }];
}
async function getStrengths_(c) { return readJSON('tpers:' + c.id, { people: {} }); }
function strengthsOut_(c, store) {
  const ppl = strengthsPeople_(c), out = {};
  ppl.forEach(function (p) { const r = store.people && store.people[p.key]; if (r) out[p.key] = { type: r.type, scores: r.scores || null, source: r.source || 'test', at: r.at || '' }; });
  return { people: ppl, results: out };
}
async function portalStrengths(username, pin, candidateId) {
  const a = await docCand_(username, pin, candidateId); if (a.out) return a.out;
  return Object.assign({ ok: true }, strengthsOut_(a.cand, await getStrengths_(a.cand)));
}
async function portalSaveStrength(username, pin, key, result, candidateId) {
  const a = await docCand_(username, pin, candidateId); if (a.out) return a.out;
  const cand = a.cand;
  key = str_(key, 40);
  if (!key || !strengthsPeople_(cand).some(function (p) { return p.key === key; })) return { ok: false, err: 'bad_person' };
  result = result && typeof result === 'object' ? result : {};
  const type = String(result.type || '').toUpperCase();
  if (P_TYPES.indexOf(type) === -1) return { ok: false, err: 'bad_type' };
  let scores = null;
  if (result.scores && typeof result.scores === 'object') {
    scores = {};
    ['E', 'S', 'T', 'J'].forEach(function (k) { const n = finiteNum_(result.scores[k], 0, 100); if (n != null) scores[k] = Math.round(n); });
    if (Object.keys(scores).length !== 4) scores = null;
  }
  const store = await getStrengths_(cand);
  store.people = store.people || {};
  store.people[key] = { type: type, scores: scores, source: result.source === 'picked' ? 'picked' : 'test', at: new Date().toISOString(), by: a.s.id };
  await writeJSON('tpers:' + cand.id, store);
  return Object.assign({ ok: true }, strengthsOut_(cand, store));
}
async function portalDeleteStrength(username, pin, key, candidateId) {
  const a = await docCand_(username, pin, candidateId); if (a.out) return a.out;
  const store = await getStrengths_(a.cand);
  if (store.people) delete store.people[str_(key, 40)];
  await writeJSON('tpers:' + a.cand.id, store);
  return Object.assign({ ok: true }, strengthsOut_(a.cand, store));
}

/* Resources: what a team or applicant may need in Cambodia — guides,
   emergency numbers, places. A list a portal admin edits (blob
   'portalResources'); these are the defaults until someone does. */
const RESOURCE_KINDS = ['guide', 'link', 'phone', 'note', 'app'];
const RESOURCES_MAX = 60;
const PORTAL_RESOURCES_DEFAULT = [
  { id: 'r_leaders', kind: 'guide', title: 'Outreach Leader’s Guide', note: 'Getting here, border crossings, arrival, what things cost, and tips — for teams.', value: 'outreach' },
  { id: 'r_teams', kind: 'link', title: 'Guide for Short-Term Teams', note: 'The booklet to read with your team before you come.', value: '' },
  { id: 'r_police', kind: 'phone', title: 'Police', note: 'Emergency — Cambodia', value: '117' },
  { id: 'r_fire', kind: 'phone', title: 'Fire', note: 'Emergency — Cambodia', value: '118' },
  { id: 'r_ambulance', kind: 'phone', title: 'Ambulance', note: 'Emergency — Cambodia', value: '119' },
  { id: 'r_campus', kind: 'link', title: 'Our campus — YWAM Siem Reap', note: 'The address on Google Maps. Show it to any tuk-tuk driver.', value: 'https://maps.app.goo.gl/Mkg26hR8LP61Sp1q7' },
  { id: 'r_maps', kind: 'link', title: 'Our favourite places in Siem Reap', note: 'Cafes, shops and restaurants we like — a Google Maps list.', value: 'https://www.google.com/maps/@13.3667762,103.8419852,14z/data=!4m2!11m1!2sV30E-H3vTvO8Wrt-cPzXUg?entry=ttu' },
  { id: 'r_grab', kind: 'app', title: 'Grab', note: 'Essential: tuk-tuks and rides anywhere in the city — like Uber, but way cheaper. Works with your own number, no Cambodian SIM needed.', value: 'https://www.grab.com/kh/download/' },
  { id: 'r_passapp', kind: 'app', title: 'PassApp', note: 'The other tuk-tuk app, essential too — like Uber, but way cheaper. Needs a Cambodian phone number to sign up.', value: 'https://www.passapp.com.kh/' },
  { id: 'r_foodpanda', kind: 'app', title: 'foodpanda', note: 'Food delivered to the base — most restaurants in town are on it.', value: 'https://www.foodpanda.com.kh/' }
];
/* The list a portal admin saved, plus anything shipped since: a shipped item
   they never saw is added at the end, one they removed stays removed
   ('dropped' is written on save), and a saved item with no address yet takes
   the shipped one once there is one (the places list, the campus address). */
function mergeResources_(saved) {
  const items = cleanResources_(saved.items), have = {}, dropped = Array.isArray(saved.dropped) ? saved.dropped : [];
  items.forEach(function (r) { have[r.id] = r; });
  PORTAL_RESOURCES_DEFAULT.forEach(function (d) {
    if (have[d.id]) { if (!have[d.id].value && d.value) have[d.id].value = d.value; return; }
    if (dropped.indexOf(d.id) === -1) items.push(Object.assign({}, d));
  });
  return items;
}
function cleanResources_(list) {
  const out = [], seen = {};
  (Array.isArray(list) ? list : []).slice(0, RESOURCES_MAX).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    const kind = RESOURCE_KINDS.indexOf(r.kind) > -1 ? r.kind : 'link';
    const title = str_(r.title, 120); if (!title) return;
    let value = str_(r.value, 500) || '';
    if ((kind === 'link' || kind === 'app') && value && !/^https?:\/\//i.test(value)) value = 'https://' + value;
    if (kind === 'phone') value = value.replace(/[^\d+ ]/g, '').trim();
    let id = typeof r.id === 'string' && /^r_[a-z0-9]{1,30}$/.test(r.id) && !seen[r.id] ? r.id : ('r_' + Math.random().toString(36).slice(2, 10));
    seen[id] = 1;
    out.push({ id: id, kind: kind, title: title, note: str_(r.note, 300) || '', value: value });
  });
  return out;
}
async function getResources_() {
  const saved = await readJSON('portalResources', null);
  return saved && Array.isArray(saved.items) ? { items: mergeResources_(saved), isDefault: false, updated: saved.updated || '' } : { items: PORTAL_RESOURCES_DEFAULT.slice(), isDefault: true, updated: '' };
}
async function portalResources(username, pin) {
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { ok: false, err: 'auth' };
  return Object.assign({ ok: true }, await getResources_());
}
async function portalSaveResources(username, pin, items) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  const clean = cleanResources_(items), ids = clean.map(function (r) { return r.id; });
  const saved = { items: clean, dropped: PORTAL_RESOURCES_DEFAULT.map(function (d) { return d.id; }).filter(function (id) { return ids.indexOf(id) === -1; }), updated: new Date().toISOString(), by: me.id };
  await writeJSON('portalResources', saved);
  return Object.assign({ ok: true }, await getResources_());
}

/* Validate and create an applicant account + its candidate record. `by` is
   who made it: the applicant themself (sign-up) or a portal admin (Accounts →
   Add). Answers {ok:false, err} or {ok:true, rec, cand}. */
async function createApplicant_(payload, by) {
  payload = payload && typeof payload === 'object' ? payload : {};
  /* Three ways to make the account: with Google (a verified token — the email
     is Google's, the username is the email, no password), with an email and a
     password (username = email), or the older username + 4-digit PIN (portal
     admins adding someone by hand still use it). */
  let google = null;
  if (payload.googleToken) {
    google = await verifyGoogleToken_(payload.googleToken);
    if (!google) return { ok: false, err: 'google' };
  }
  const email = google ? google.email : cleanEmail_(payload.email);
  if (email === null) return { ok: false, err: 'bad_email' };
  if (!email) return { ok: false, err: 'email_required' };
  const password = payload.password !== undefined && payload.password !== null && payload.password !== '' ? String(payload.password) : '';
  const byEmail = !!google || !!password;
  let u = byEmail ? email : normUser_(payload.username);
  if (byEmail) {
    if (password && (password.length < 8 || password.length > 200)) return { ok: false, err: 'bad_password' };
  } else {
    if (!/^[a-z0-9._-]{2,20}$/.test(u)) return { ok: false, err: 'bad_username' };
    if (!/^\d{4}$/.test(String(payload.pin))) return { ok: false, err: 'bad_pin' };
  }
  const name = str_(payload.name, 120) || (google && google.name) || null;
  if (!name) return { ok: false, err: 'name_required' };
  const phone = cleanPhone_(payload.phone);
  if (!phone) return { ok: false, err: 'phone_required' };
  const messenger = PORTAL_MESSENGERS.indexOf(payload.messenger) > -1 ? payload.messenger : '';
  if (!messenger) return { ok: false, err: 'messenger_required' };
  const type = PORTAL_TYPES.indexOf(payload.type) > -1 ? payload.type : '';
  if (!type) return { ok: false, err: 'type_required' };
  const campus = Object.prototype.hasOwnProperty.call(PORTAL_CAMPUSES, payload.campus) ? payload.campus : '';
  if (!campus) return { ok: false, err: 'campus_required' };
  const school = type === 'student' ? (PORTAL_SCHOOLS.indexOf(payload.school) > -1 ? payload.school : '') : '';
  if (type === 'student' && !school) return { ok: false, err: 'school_required' };
  if (school && PORTAL_CAMPUSES[campus].indexOf(school) === -1) return { ok: false, err: 'school_not_at_campus' };
  const country = cleanCountry_(payload.country);
  if (!country) return { ok: false, err: 'country_required' };
  /* A team names its sending church, base or organization at sign-up, so the
     staff side shows the team — not the person — from the first day, and
     the form opens with it filled in (it is the form's first question). */
  const teamName = type === 'team' ? (str_(payload.teamName, 120) || '') : '';
  const rows = await getStaff_();
  if (rows.some(function (r) { return r.email && r.email === email; })) return { ok: false, err: 'email_taken' };
  if (findStaff_(rows, u)) return { ok: false, err: byEmail ? 'email_taken' : 'taken' };
  const cands = await getCandidates_();
  if (cands.length >= CAND_MAX) return { ok: false, err: 'too_many' };
  const salt = pinSalt_(), now = new Date().toISOString();
  const id = newStaffId_(), candId = hrId_('cd');
  const rec = {
    id: id, username: u, name: name, email: email,
    kind: 'applicant', campus: campus, dept: '', ministry: '', role: '', photo: '',
    phone: phone, messenger: messenger, country: country,
    applicant: { type: type, school: school, candidateId: candId },
    active: true, isAdmin: false, created: now, updated: now
  };
  let token = '';
  if (google) { rec.google = { sub: google.sub, lastAt: now }; token = addDeviceToken_(rec); }
  else if (password) { rec.secretSalt = salt + pinSalt_(); rec.secretHash = hashSecret_(password, rec.secretSalt); }
  else { rec.pinHash = hashPin_(payload.pin, salt); rec.pinSalt = salt; }
  const cand = {
    id: candId, campus: campus, name: name, type: type, stage: 'new',
    subtype: school ? school.toUpperCase() : '', school: school,
    email: email, phone: phone, messenger: messenger, country: country, source: 'portal',
    assignedTo: '', nextStep: '', nextDate: '', expected: '', notes: '', staffId: id,
    portal: { createdAt: now, submittedAt: null, form: null, docs: [], references: [], draft: teamName ? { teamName: teamName } : null, draftAt: teamName ? now : null },
    log: [{ at: now, by: by || id, kind: 'stage', text: 'new' }], archived: null,
    created: now, createdBy: by || id, updated: now, updatedBy: by || id
  };
  // The account first — a candidate row without an account is a loose end
  // staff can see and clean up; an account without its candidate would be a
  // person who signed up and sees nothing.
  const made = await mutateStaff_(function (all) {
    if (all.some(function (r) { return r.email && r.email === email; })) return { abort: true, ok: false, err: 'email_taken' };
    if (findStaff_(all, u)) return { abort: true, ok: false, err: byEmail ? 'email_taken' : 'taken' };
    all.push(rec);
    return { ok: true };
  });
  if (!made || !made.ok) return made || { ok: false };
  const fresh = await getCandidates_();
  fresh.push(cand);
  await writeJSON('candidates', fresh);
  return { ok: true, rec: rec, cand: cand, token: token };
}
/* ==================== Students in the GP app (Oct 2026, Uriah) ====================
   A student signs in to the portal (their application) and has a "Go to GP app"
   button: the real GP app, in a student mode — weekly goals, habits, mentorship,
   strengths, the weekly schedules and the Library. Everything a student saves
   lives in their own blob 'stu:<accountId>' and nowhere else, so nothing they do
   touches staff data or the base's figures. The page sends every call through
   studentCall, which knows only STUDENT_FNS; the staff handlers refuse an
   applicant anyway (verifyStaff_ without allowApplicant). A mentor is chosen
   from Leadership Development only, and that is the only staff a student sees.

   Students already living with us come from SR Hospitality's student bookings:
   staff make a profile (a student candidate, stage arrived) and send its invite
   link; opening it in the portal and signing in with Google makes the account,
   linked to that profile (portalJoin). */
const STU_LD_DEPT = 'Leadership Development';
const STUDENT_FNS = { getMyBoot: 1, saveGoals: 1, saveDaily: 1, saveMyHabits: 1, saveMyPersonality: 1, saveMyGStrengths: 1, libSaveReads: 1, getMySchedules: 1, getDuty: 1, studentSetMentor: 1 };
async function studentAuth_(username, pin) {
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { out: { ok: false, err: 'auth' } };
  if (!isApplicant_(s)) return { out: { ok: false, err: 'not_student' } };
  const cand = await candidateFor_(await getCandidates_(), s);
  if (!cand || cand.type !== 'student' || cand.archived) return { out: { ok: false, err: 'not_student' } };
  return { s: s, cand: cand };
}
function stuKey_(id) { return 'stu:' + id; }
async function getStu_(id) { const d = await readJSON(stuKey_(id), null); return d && typeof d === 'object' ? d : {}; }
/* the only staff a student sees: Leadership Development, names and faces */
async function stuMentors_() {
  return (await getStaff_()).filter(function (r) { return r && r.active !== false && !r.archived && !isApplicant_(r) && deptOf_(r) === STU_LD_DEPT; })
    .map(function (r) { return { id: r.id, name: r.name, photo: r.photo || '', dept: r.dept, ministry: r.ministry || '', campus: r.campus, role: r.role || '' }; });
}
function stuMe_(s, cand, d) {
  return { id: s.id, name: s.name, username: s.username, campus: cand.campus || s.campus, dept: '', ministry: '', role: 'Student', photo: '',
    mentorId: d.mentorId || '', mentorStatus: d.mentorStatus || '', student: true, school: cand.school || '', isAdmin: false };
}
async function stuSchedules_(campus) {
  const week = dutyThisWeek_(), next = addDays_(week, 7);
  return { ok: true, week: week, now: await dutyPublished_(campus, week), next: await dutyPublished_(campus, next), nextWeek: next, canEdit: {} };
}
/* who chose whom: one small index, so a mentor's boot can find their students without opening every student's blob */
async function stuIndexSet_(studentId, entry) {
  const ix = await readJSON('stuIndex', {});
  if (entry) ix[studentId] = entry; else delete ix[studentId];
  await writeJSON('stuIndex', ix);
}
/* what a student's app opens with — also what an admin's "see their app" shows */
function stuRec_(d) { return { habits: d.habits, bibleDay: d.bibleDay, personality: d.personality, gstrengths: d.gstrengths, sex: d.sex, libRead: d.libRead }; }
async function stuBootOut_(s, cand, d) {
  const mentors = await stuMentors_(), me = stuMe_(s, cand, d);
  return { ok: true, student: true, staff: me,
    profile: { email: s.email || '', mentorStatus: d.mentorStatus || '', sex: cleanSex_(d.sex), personality: ownPersonality_(stuRec_(d)), gstrengths: ownGStrengths_(stuRec_(d)) },
    roster: mentors, logs: logsFor_(d.logs || [], s.id), habits: habitsOf_(stuRec_(d)), bibleDay: d.bibleDay || 0,
    goals: goalsFor_(d.goals || [], s.id), checkins: [], mentees: [], mentorRequests: [], smartGoals: [], tasks: [], oneOnOnes: [], broadcasts: [],
    libRead: cleanLibRead_(d.libRead), schedules: await stuSchedules_(cand.campus || s.campus), reqDocs: [], required: null };
}
async function studentCall(username, pin, fn, args) {
  if (!Object.prototype.hasOwnProperty.call(STUDENT_FNS, fn)) return { ok: false, err: 'student' };
  const a = await studentAuth_(username, pin); if (a.out) return a.out;
  const s = a.s, cand = a.cand, campus = cand.campus || s.campus;
  args = Array.isArray(args) ? args : [];
  const d = await getStu_(s.id);
  const save = async function () { d.updated = new Date().toISOString(); await writeJSON(stuKey_(s.id), d); };
  const rec = function () { return { habits: d.habits, bibleDay: d.bibleDay, personality: d.personality, gstrengths: d.gstrengths, sex: d.sex, libRead: d.libRead }; };
  if (fn === 'getMyBoot') return stuBootOut_(s, cand, d);
  if (fn === 'getMySchedules') return stuSchedules_(campus);
  if (fn === 'getDuty') {   // a published week, to read — never the editor
    const kind = args[0], week = args[1];
    if (!Object.prototype.hasOwnProperty.call(DUTY_KINDS, kind) || !isSunday_(week)) return { ok: false, err: 'bad_week' };
    const rec = (await getDutyDoc_(campus))[kind].weeks[week] || null;
    return { ok: true, kind: kind, week: week, canEdit: false, sched: rec && rec.published ? dutyOut_(rec, week, kind) : null };
  }
  if (fn === 'saveGoals') {
    const wk = finiteNum_(args[0], 1, 52);
    if (wk == null) return { ok: false, err: 'bad_week' };
    const clean = (Array.isArray(args[1]) ? args[1].slice(0, MAX_GOALS) : []).map(function (i) {
      return { text: str_(i && i.text, 200) || '', pct: goalItemPct_(i), done: goalItemPct_(i) >= 100, metricKey: '' };
    });
    const yr = yearForWeek_(wk), rows = Array.isArray(d.goals) ? d.goals : [];
    const idx = rows.findIndex(function (r) { return Number(r.week) === wk && yearOf_(r) === yr; });
    const g = { staffId: s.id, week: wk, year: yr, items: clean, updated: new Date().toISOString() };
    if (idx > -1) rows[idx] = g; else rows.push(g);
    d.goals = rows.slice(-120); await save();
    return { ok: true, goals: goalsFor_(d.goals, s.id) };
  }
  if (fn === 'saveMyHabits') {
    const day = finiteNum_(args[1], 0, 365);
    if (args[0] !== undefined) d.habits = cleanHabitConfig_(args[0]);
    if (day !== null) d.bibleDay = day;
    await save();
    return { ok: true, habits: habitsOf_(rec()), bibleDay: d.bibleDay || 0 };
  }
  if (fn === 'saveDaily') {
    const dateStr = isoDate_(args[0]), p = args[1] || {};
    if (!dateStr) return { ok: false, err: 'bad_date' };
    const rows = Array.isArray(d.logs) ? d.logs : [];
    const b = function (v) { return !!v; };
    const row = { staffId: s.id, date: dateStr, week: isoWeek_(dateStr), year: weekYear_(dateStr) || undefined,
      workout: b(p.workout), bible: b(p.bible), quietTime: b(p.quietTime), habits: cleanHabitMap_(p.habits, habitsOf_(rec())), updated: new Date().toISOString() };
    const idx = rows.findIndex(function (r) { return r.date === dateStr; });
    if (idx > -1) rows[idx] = row; else rows.push(row);
    d.logs = rows.slice(-400); await save();
    return { ok: true, logs: logsFor_(d.logs, s.id), profile: {}, habits: habitsOf_(rec()), bibleDay: d.bibleDay || 0, week: null };
  }
  if (fn === 'saveMyPersonality') {
    const p = args[0] || {};
    if (p.type !== undefined && PTYPE_CODES.indexOf(p.type) === -1) return { ok: false, err: 'bad_type' };
    if (p.season !== undefined && PSEASON_IDS.indexOf(p.season) === -1) return { ok: false, err: 'bad_season' };
    const source = p.source === 'self' ? 'self' : 'test';
    let scores = null;
    if (p.type !== undefined && source === 'test') { scores = cleanPScores_(p.scores, p.type); if (!scores) return { ok: false, err: 'bad_scores' }; }
    if (p.sex !== undefined) d.sex = cleanSex_(p.sex);
    if (p.clear) delete d.personality;
    else {
      const cur = Object.assign({}, d.personality || {});
      if (p.type !== undefined) { cur.type = p.type; cur.scores = scores; cur.source = source; cur.takenAt = new Date().toISOString(); }
      if (p.share !== undefined) cur.share = !!p.share;
      if (p.season !== undefined) cur.season = p.season;
      if (cur.type) d.personality = cur;
    }
    await save();
    return { ok: true, staff: stuMe_(s, cand, d), sex: cleanSex_(d.sex), personality: ownPersonality_(rec()) };
  }
  if (fn === 'saveMyGStrengths') {
    const p = args[0] || {};
    let result = null;
    if (p.answers !== undefined) { result = gpStrengthsScore_(p.answers); if (!result) return { ok: false, err: 'incomplete' }; }
    if (p.clear) delete d.gstrengths;
    else {
      if (!result && !d.gstrengths) return { ok: false, err: 'no_result' };
      const cur = Object.assign({}, d.gstrengths || {});
      if (result) { cur.answers = result.answers; cur.scores = result.scores; cur.top = result.top; cur.takenAt = new Date().toISOString(); }
      if (p.share !== undefined) cur.share = !!p.share;
      d.gstrengths = cur;
    }
    await save();
    return { ok: true, staff: stuMe_(s, cand, d), gstrengths: ownGStrengths_(rec()) };
  }
  if (fn === 'libSaveReads') {
    const changes = args[0];
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return { ok: false, err: 'bad_changes' };
    const cur = cleanLibRead_(d.libRead);
    Object.keys(changes).filter(function (k) { return /^[a-z0-9-]{1,80}$/.test(k); }).slice(0, LIB_MAX).forEach(function (k) {
      if (changes[k] === null || changes[k] === false) delete cur[k];
      else if (!cur[k]) cur[k] = isoDate_(changes[k]) || new Date().toISOString().slice(0, 10);
    });
    d.libRead = cur; await save();
    return { ok: true, libRead: cur };
  }
  if (fn === 'studentSetMentor') {
    const id = str_(args[0], 60) || '';
    if (id && !(await stuMentors_()).some(function (m) { return m.id === id; })) return { ok: false, err: 'not_a_mentor' };
    d.mentorId = id; d.mentorStatus = id ? 'pending' : ''; await save();
    await stuIndexSet_(s.id, id ? { mentorId: id, status: 'pending', name: s.name, campus: campus } : null);
    return { ok: true, staff: stuMe_(s, cand, d), mentorStatus: d.mentorStatus };
  }
  return { ok: false, err: 'student' };
}
/* the mentor's side: students who asked them, and the ones they accepted — names only */
async function stuMentorFor_(staffId) {
  const ix = await readJSON('stuIndex', {}), out = { requests: [], students: [] };
  Object.keys(ix).forEach(function (id) {
    const e = ix[id]; if (!e || e.mentorId !== staffId) return;
    (e.status === 'approved' ? out.students : out.requests).push({ id: id, name: e.name || '' });
  });
  return out;
}
async function respondStudentMentor(username, pin, studentId, accept) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  studentId = str_(studentId, 60) || '';
  const ix = await readJSON('stuIndex', {}), e = ix[studentId];
  if (!e || e.mentorId !== s.id) return { ok: false, err: 'not_found' };
  const d = await getStu_(studentId);
  if (accept) { e.status = 'approved'; d.mentorStatus = 'approved'; }
  else { delete ix[studentId]; d.mentorId = ''; d.mentorStatus = ''; }
  await writeJSON('stuIndex', ix);
  d.updated = new Date().toISOString(); await writeJSON(stuKey_(studentId), d);
  return Object.assign({ ok: true }, await stuMentorFor_(s.id));
}

/* ---- the students staying with us, and their profiles (staff side) ---- */
function stuBookingNames_(k) {
  const names = [];
  (k.people || []).forEach(function (p) { const n = dutyText_(p && p.name, 120); if (n && names.indexOf(n) === -1) names.push(n); });
  Object.keys(k.bedNames || {}).forEach(function (b) { const n = dutyText_(k.bedNames[b], 120); if (n && names.indexOf(n) === -1) names.push(n); });
  return names;
}
function canStudents_(s) { return !!(s && (s.isAdmin || canHR_(s) || canHosp_(s) || canPortal_(s))); }
function stuNameKey_(n) { return String(n || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function stuInviteToken_() { return crypto.randomBytes(18).toString('hex'); }
async function studentsList(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canStudents_(s)) return { ok: false, err: 'not_authorized' };
  const campus = s.campus, today = baseToday_();
  const cands = (await getCandidates_()).filter(function (c) { return c && c.type === 'student' && (c.campus || campus) === campus && !c.archived; });
  const byName = {}; cands.forEach(function (c) { byName[stuNameKey_(c.name)] = c; });
  const staying = [], seen = {};
  (await getHosp_(campus)).bookings.forEach(function (k) {
    if (!k || k.category !== 'student') return;
    if (!(k.from && k.from <= today && (k.permanent || (k.to && k.to > today)))) return;
    const nm = stuBookingNames_(k);
    nm.concat(nm.length ? [] : [k.name]).forEach(function (n) {
      const key = stuNameKey_(n); if (!key || seen[key]) return; seen[key] = 1;
      staying.push({ name: n, from: k.from, to: k.to || '', permanent: !!k.permanent });
    });
  });
  const out = function (c) { return { candId: c.id, name: c.name, school: c.school || '', linked: !!c.staffId, email: c.staffId ? (c.email || '') : '', invite: (c.portal && c.portal.invite && c.portal.invite.token) || '', source: c.source || '' }; };
  return { ok: true, campus: campus,
    staying: staying.map(function (x) { const c = byName[stuNameKey_(x.name)]; return Object.assign(x, { profile: c ? out(c) : null }); }),
    others: cands.filter(function (c) { return !seen[stuNameKey_(c.name)]; }).map(out) };
}
async function studentMakeProfile(username, pin, name, school) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canStudents_(s)) return { ok: false, err: 'not_authorized' };
  name = str_(name, 120); if (!name) return { ok: false, err: 'name_required' };
  school = PORTAL_SCHOOLS.indexOf(school) > -1 ? school : 'dts';
  const rows = await getCandidates_();
  if (rows.some(function (c) { return c && c.type === 'student' && !c.archived && (c.campus || s.campus) === s.campus && stuNameKey_(c.name) === stuNameKey_(name); })) return { ok: false, err: 'exists' };
  if (rows.length >= CAND_MAX) return { ok: false, err: 'too_many' };
  const now = new Date().toISOString();
  const cand = { id: hrId_('cd'), campus: s.campus, name: name, type: 'student', stage: 'arrived', subtype: school.toUpperCase(), school: school,
    email: '', phone: '', messenger: '', country: '', source: 'hospitality', assignedTo: '', nextStep: '', nextDate: '', expected: '', notes: '', staffId: '',
    portal: { createdAt: now, submittedAt: null, form: null, docs: [], references: [], draft: null, draftAt: null, invite: { token: stuInviteToken_(), at: now, by: s.id } },
    log: [{ at: now, by: s.id, kind: 'note', text: 'Profile made from SR Hospitality — staying with us as a student' }], archived: null,
    created: now, createdBy: s.id, updated: now, updatedBy: s.id };
  rows.push(cand);
  await writeJSON('candidates', rows);
  return Object.assign({ made: cand.id }, await studentsList(username, pin));
}
/* ---- Admin → 🎓 Students: every student profile by school, what each one has
   put in, and their app as they see it (read only). Admins only — a student's
   goals and habits are theirs, so this is not opened to HR or Hospitality. */
function stuAdminRow_(c, acct, d, staffById) {
  const wk = isoWeek_(baseToday_()), yr = weekYear_(baseToday_());
  const g = (d.goals || []).find(function (r) { return Number(r.week) === wk && yearOf_(r) === yr; });
  const m = d.mentorId && staffById[d.mentorId];
  return { candId: c.id, name: c.name, school: c.school || '', campus: c.campus || '', stage: c.stage || '', source: c.source || '',
    linked: !!(c.staffId && acct), email: acct ? (acct.email || '') : '', invite: (c.portal && c.portal.invite && c.portal.invite.token) || '',
    updated: acct ? (d.updated || '') : '', goalsThisWeek: g ? (g.items || []).length : 0, habits: acct ? habitsOf_(stuRec_(d)).length : 0,
    mentor: m ? m.name : '', mentorStatus: d.mentorStatus || '', ptype: (d.personality && d.personality.type) || '',
    libRead: Object.keys(cleanLibRead_(d.libRead) || {}).length };
}
async function studentsAdmin(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!s.isAdmin) return { ok: false, err: 'not_authorized' };
  const staff = await getStaff_(), byId = {}; staff.forEach(function (r) { if (r && r.id) byId[r.id] = r; });
  const cands = (await getCandidates_()).filter(function (c) { return c && c.type === 'student' && !c.archived; });
  const rows = await Promise.all(cands.map(async function (c) {
    const acct = c.staffId ? byId[c.staffId] : null;
    return stuAdminRow_(c, acct, acct ? await getStu_(acct.id) : {}, byId);
  }));
  const schools = {};
  rows.forEach(function (r) { const k = r.school || 'other'; (schools[k] = schools[k] || []).push(r); });
  Object.keys(schools).forEach(function (k) { schools[k].sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); }); });
  return { ok: true, schools: schools, order: PORTAL_SCHOOLS.concat(['other']) };
}
async function studentAdminView(username, pin, candId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!s.isAdmin) return { ok: false, err: 'not_authorized' };
  const c = (await getCandidates_()).find(function (x) { return x && x.id === candId && x.type === 'student' && !x.archived; });
  if (!c) return { ok: false, err: 'not_found' };
  const staff = await getStaff_(), byId = {}; staff.forEach(function (r) { if (r && r.id) byId[r.id] = r; });
  const acct = c.staffId ? byId[c.staffId] : null, d = acct ? await getStu_(acct.id) : {};
  return { ok: true, student: stuAdminRow_(c, acct, d, byId), boot: acct ? await stuBootOut_(acct, c, d) : null };
}
/* the invite a student opens in the portal: ?join=<token> */
async function portalJoinInfo(token) {
  token = String(token || '').replace(/[^a-f0-9]/g, '').slice(0, 64);
  if (token.length < 20) return { ok: false, err: 'invalid' };
  const c = (await getCandidates_()).find(function (x) { return x && x.portal && x.portal.invite && x.portal.invite.token === token; });
  if (!c || c.staffId) return { ok: false, err: c ? 'used' : 'invalid' };
  return { ok: true, name: c.name, campus: c.campus || PORTAL_DEFAULT_CAMPUS, school: c.school || '' };
}
async function portalJoin(token, googleToken) {
  const info = await portalJoinInfo(token); if (!info.ok) return info;
  const g = await verifyGoogleToken_(googleToken);
  if (!g) return { ok: false, err: 'google' };
  const email = g.email, now = new Date().toISOString();
  let cand = null;
  const rec = { id: newStaffId_(), username: email, name: info.name, email: email, kind: 'applicant', campus: info.campus, dept: '', ministry: '', role: '', photo: '',
    phone: '', messenger: '', country: '', applicant: { type: 'student', school: info.school, candidateId: '' }, active: true, isAdmin: false, created: now, updated: now,
    google: { sub: g.sub, lastAt: now } };
  const tok = addDeviceToken_(rec);
  const made = await mutateStaff_(function (all) {
    if (all.some(function (r) { return (r.email && r.email === email) || r.username === email; })) return { abort: true, ok: false, err: 'email_taken' };
    all.push(rec); return { ok: true };
  });
  if (!made || !made.ok) return made || { ok: false };
  const rows = await getCandidates_();
  cand = rows.find(function (x) { return x && x.portal && x.portal.invite && x.portal.invite.token === String(token).replace(/[^a-f0-9]/g, ''); });
  if (cand) {
    cand.staffId = rec.id; cand.email = email; delete cand.portal.invite;
    cand.log = (cand.log || []).concat([{ at: now, by: rec.id, kind: 'note', text: 'Joined with Google from the invite link' }]);
    cand.updated = now; cand.updatedBy = rec.id;
    await writeJSON('candidates', rows);
    await mutateStaff_(function (all) { const r = all.find(function (x) { return x.id === rec.id; }); if (r) r.applicant.candidateId = cand.id; return { ok: true }; });
    rec.applicant.candidateId = cand.id;
  }
  const boot = await portalBoot(rec.username, tok);
  if (!boot.ok) return boot;
  return Object.assign(boot, { user: rec.username, token: tok });
}

async function portalRegister(payload) {
  const made = await createApplicant_(payload, null);
  if (!made.ok) return made;
  // the same shape portalBoot gives, form included — the dashboard opens the form straight away;
  // `user` is what the page signs in as from now on (the email, for the new ways in), and
  // `token` the device token a Google sign-up holds in place of a password
  return { ok: true, role: 'applicant', me: portalMeOut_(made.rec), application: portalAppOut_(made.cand), form: (await getForms_())[formKeyOf_(made.cand)],
    user: made.rec.username, token: made.token || '' };
}

/* ==================== accounts (staff side, portal admins) ====================
   Every applicant account, to see, fix, add or remove. Applicant accounts are
   not in Admin → Accounts (they are not staff), so this is their one place.
   Editing keeps the candidate record in step (name, contact); a new PIN is
   set here when someone is locked out; delete is portalDeleteApplicant. */
function portalAccountOut_(s, cand) {
  return { id: s.id, username: s.username, name: s.name, email: s.email || '', phone: s.phone || '', messenger: s.messenger || '', country: s.country || '',
    campus: s.campus || '', type: s.applicant ? s.applicant.type : '', school: s.applicant ? s.applicant.school : '',
    candidateId: (s.applicant && s.applicant.candidateId) || (cand && cand.id) || '', stage: cand ? cand.stage : '', status: cand ? portalStatus_(cand) : 'none',
    authKind: authKindOf_(s), created: s.created || '', updated: s.updated || '' };
}
async function portalListAccounts(username, pin) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  const rows = await getStaff_(), cands = await getCandidates_();
  const byStaff = {}; cands.forEach(function (c) { if (c && c.staffId) byStaff[c.staffId] = c; });
  return { ok: true, accounts: rows.filter(isApplicant_).map(function (s) { return portalAccountOut_(s, byStaff[s.id] || null); }) };
}
async function portalCreateApplicant(username, pin, payload) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  const made = await createApplicant_(payload, me.id);
  if (!made.ok) return made;
  return { ok: true, account: portalAccountOut_(made.rec, made.cand) };
}
async function portalUpdateAccount(username, pin, staffId, payload) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  payload = payload && typeof payload === 'object' ? payload : {};
  let changed = null;
  const out = await mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === str_(staffId, 60); });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const rec = rows[idx];
    if (!isApplicant_(rec)) return { abort: true, ok: false, err: 'not_applicant' };
    if (payload.name !== undefined) { const nm = str_(payload.name, 120); if (!nm) return { abort: true, ok: false, err: 'name_required' }; rec.name = nm; }
    if (payload.username !== undefined && authKindOf_(rec) !== 'pin') return { abort: true, ok: false, err: 'username_is_email' };
    if (payload.username !== undefined) {
      const u = normUser_(payload.username);
      if (!/^[a-z0-9._-]{2,20}$/.test(u)) return { abort: true, ok: false, err: 'bad_username' };
      if (rows.some(function (r) { return r.id !== rec.id && r.username === u; })) return { abort: true, ok: false, err: 'taken' };
      rec.username = u;
    }
    if (payload.email !== undefined) {
      const email = cleanEmail_(payload.email);
      if (email === null || !email) return { abort: true, ok: false, err: 'bad_email' };
      if (rows.some(function (r) { return r.id !== rec.id && r.email && r.email === email; })) return { abort: true, ok: false, err: 'email_taken' };
      if (rows.some(function (r) { return r.id !== rec.id && r.username === email; })) return { abort: true, ok: false, err: 'email_taken' };
      rec.email = email;
      if (authKindOf_(rec) !== 'pin') rec.username = email;   // their username IS their email
    }
    if (payload.newPassword !== undefined && payload.newPassword !== '') {
      const pw = String(payload.newPassword);
      if (pw.length < 8 || pw.length > 200) return { abort: true, ok: false, err: 'bad_password' };
      rec.secretSalt = pinSalt_() + pinSalt_(); rec.secretHash = hashSecret_(pw, rec.secretSalt);
      delete rec.pinHash; delete rec.pinSalt;
    }
    if (payload.phone !== undefined) { const ph = cleanPhone_(payload.phone); if (!ph) return { abort: true, ok: false, err: 'phone_required' }; rec.phone = ph; }
    if (payload.messenger !== undefined) { if (PORTAL_MESSENGERS.indexOf(payload.messenger) === -1) return { abort: true, ok: false, err: 'messenger_required' }; rec.messenger = payload.messenger; }
    if (payload.country !== undefined) { const co = cleanCountry_(payload.country); if (!co) return { abort: true, ok: false, err: 'country_required' }; rec.country = co; }
    if (payload.newPin !== undefined && payload.newPin !== '') {
      if (authKindOf_(rec) !== 'pin') return { abort: true, ok: false, err: 'no_pin_account' };
      if (!/^\d{4}$/.test(String(payload.newPin))) return { abort: true, ok: false, err: 'bad_pin' };
      rec.pinSalt = pinSalt_(); rec.pinHash = hashPin_(payload.newPin, rec.pinSalt);
    }
    rec.updated = new Date().toISOString();
    rows[idx] = rec; changed = rec;
    return { ok: true };
  });
  if (!out || !out.ok) return out || { ok: false };
  // the CRM record carries the same contact facts — keep them in step
  const cands = await getCandidates_();
  const cand = await candidateFor_(cands, changed);
  if (cand) {
    cand.name = changed.name; cand.email = changed.email || ''; cand.phone = changed.phone || ''; cand.messenger = changed.messenger || ''; cand.country = changed.country || '';
    cand.updated = new Date().toISOString(); cand.updatedBy = me.id;
    await writeJSON('candidates', cands);
  }
  await clearLoginThrottle_(changed.username);
  return { ok: true, account: portalAccountOut_(changed, cand) };
}
function portalMeOut_(s) {
  return { id: s.id, name: s.name, username: s.username, email: s.email || '', phone: s.phone || '', messenger: s.messenger || '', country: s.country || '',
    campus: s.campus || '', type: s.applicant ? s.applicant.type : '', school: s.applicant ? s.applicant.school : '', authKind: authKindOf_(s) };
}
/* One call per page open, same as getMyBoot: who you are, and either your own
   application or — for portal staff — everyone's. A bad PIN is 'auth' so the
   page knows to sign out; a staff member without portal access is told so
   and shown nothing. */
/* ==================== a team that has left is archived by itself ====================
   The day after a team's last date in Cambodia (the latest "to" on its
   itinerary, else its Siem Reap dates), a team that arrived is archived:
   archived.left holds that date, which files it in the archive by year and
   quarter. Nothing is removed — documents (passports, flights, e-visas), the
   names and photos, strengths and numbers all stay on the record, the Teams
   Database keeps it as a team that came (not cancelled), and the team can
   still add its final numbers. A team that never arrived is left for staff.
   Staff can reopen one; it then stays open (archiveOff). Runs whenever the
   portal boots, on Phnom Penh's date. */
function pnpToday_() { return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10); }
function teamLeaves_(c) {
  const a = teamAnswers_(c), it = Array.isArray(a.itinerary) ? a.itinerary : [];
  const ends = it.map(function (r) { return r && isoDate_(r.to); }).filter(Boolean).sort();
  if (ends.length) return ends[ends.length - 1];
  return isoDate_(a.departureKh) || isoDate_(a.departure) || '';
}
function sweepLeftTeams_(rows, today) {
  today = today || pnpToday_();
  let n = 0;
  rows.forEach(function (c) {
    if (!c || c.type !== 'team' || c.archived || c.archiveOff || c.stage !== 'arrived') return;
    const left = teamLeaves_(c);
    if (!left || left >= today) return;
    c.archived = { at: today, reason: 'Left Cambodia on ' + left + ' — archived automatically', by: 'auto', left: left };
    c.log = (Array.isArray(c.log) ? c.log : []).concat([{ at: new Date().toISOString(), by: 'auto', kind: 'note', text: 'Team left on ' + left + ' — archived automatically. Everything is kept.' }]).slice(-CAND_LOG_MAX);
    c.updated = new Date().toISOString(); c.updatedBy = 'auto';
    n++;
  });
  return n;
}
async function portalBoot(username, pin) {
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { ok: false, err: 'auth' };
  const cands = await getCandidates_();
  if (sweepLeftTeams_(cands)) await writeJSON('candidates', cands);
  if (isApplicant_(s)) {
    const cand = await candidateFor_(cands, s);
    if (!cand) return { ok: false, err: 'no_application' };
    const out = { ok: true, role: 'applicant', me: portalMeOut_(s), application: portalAppOut_(cand), form: (await getForms_())[formKeyOf_(cand)] };
    if (cand.type === 'team') {
      const trip = (await linkedTrip_(cand)) || (!cand.archived ? await syncTeamTrip_(cand, s.id) : null);
      out.application.trip = teamTripOut_(trip);
      out.metricOverrides = (await getMetricOverrides_()).filter(function (o) { return o.dept === TEAM_DEPT && o.ministry === TEAM_MIN; });
      out.schedules = await applicantSchedules_(cand, trip);
    } else out.schedules = await applicantSchedules_(cand, null);
    return out;
  }
  if (!canPortal_(s)) return { ok: false, err: 'not_authorized' };
  const rows = await getStaff_();
  const byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
  const tripOf = {};
  (await getTeamTripsRaw_()).forEach(function (t) { if (t && t.candidateId && !t.deleted) tripOf[t.candidateId] = t; });
  return {
    ok: true, role: portalRole_(s), me: portalStaffOut_(s),
    applicants: cands.filter(function (c) { return portalMaySee_(s, c); }).map(function (c) {
      const o = portalCandOut_(c, byId);
      if (c.type === 'team') o.teamTrip = teamTripOut_(tripOf[c.id]);
      return o;
    }),
    metricOverrides: (await getMetricOverrides_()).filter(function (o) { return o.dept === TEAM_DEPT && o.ministry === TEAM_MIN; }),
    scope: portalTypes_(s),
    staff: rows.filter(function (r) { return canPortal_(r); }).map(portalStaffOut_),
    stages: CAND_STAGES, teamStages: TEAM_STAGES, types: PORTAL_TYPES, schools: PORTAL_SCHOOLS, campuses: PORTAL_CAMPUSES,
    forms: await getForms_()
  };
}
/* Grant or revoke portal access. A portal admin may hand out portalStaff;
   only an app admin may make (or unmake) a portal admin. Never to an
   applicant, and never to nobody. */
async function portalSetAccess(username, pin, staffId, flags) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  flags = flags && typeof flags === 'object' ? flags : {};
  if (flags.portalAdmin !== undefined && !me.isAdmin) return { ok: false, err: 'not_authorized' };
  return mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === str_(staffId, 60); });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    const rec = rows[idx];
    if (isApplicant_(rec)) return { abort: true, ok: false, err: 'is_applicant' };
    if (flags.portalStaff !== undefined) rec.portalStaff = !!flags.portalStaff;
    if (flags.portalAdmin !== undefined) rec.portalAdmin = !!flags.portalAdmin;
    rec.updated = new Date().toISOString();
    rows[idx] = rec;
    return { ok: true, staff: adminStaffOut_(rec) };
  });
}
/* Who on staff has the portal — the Who has access page (portal admins):
   every active staff member with the two flags, and whether they have it
   anyway (a GP app admin; whoever leads Outreach Teams sees teams). Only a
   GP app admin can give or take admin access (portalSetAccess checks). */
async function portalAccessList(username, pin) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  const rows = (await getStaff_()).filter(function (r) { return r && r.active !== false && !r.archived && !isApplicant_(r); })
    .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
    .map(function (r) { return { id: r.id, name: r.name, campus: r.campus || '', dept: deptOf_(r) || '', ministry: r.ministry || '', portalStaff: !!r.portalStaff, portalAdmin: !!r.portalAdmin, isAdmin: !!r.isAdmin, leadsTeams: leadsTeams_(r) }; });
  return { ok: true, canGrantAdmin: !!me.isAdmin, staff: rows };
}
/* The staff side's writes go through the CRM's own handlers (hrSaveCandidate,
   hrCandidateNote, hrArchiveCandidate — hrGate_ admits portal staff). This
   one is the applicant's: their contact details, which they own. */
/* ==================== the application forms ====================
   One form per kind of application (portal-forms-default.js is the shipped
   set). A portal admin edits a form on the staff side — Google Forms style:
   sections, questions, a type, required, options, and which audience sees
   it — and the saved copy in the 'portalForms' blob replaces the default
   for that key; reset drops it. Answers are keyed by question id, so a
   relabelled question keeps its answers and a deleted one simply stops
   being asked. The applicant fills the form on their side: every change
   saves a draft, submit checks the required questions for THEIR audience
   and moves the record to 'applied'. */
const FORM_TYPES = ['short', 'long', 'choice', 'multi', 'yesno', 'date', 'number', 'email', 'phone', 'stays', 'people'];
const PEOPLE_MAX = 20;
/* A list of people (a team's co-leaders): rows need a name; email and phone
   are kept if given. */
function cleanPeople_(v) {
  if (!Array.isArray(v)) return null;
  const out = [];
  v.slice(0, PEOPLE_MAX).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    const name = String(r.name == null ? '' : r.name).trim().slice(0, 120);
    if (!name) return;
    out.push({ name: name, email: String(r.email == null ? '' : r.email).trim().slice(0, 160), phone: String(r.phone == null ? '' : r.phone).trim().slice(0, 40) });
  });
  return out.length ? out : null;
}
const STAYS_MAX = 8;
/* A trip: our base first, then any other places in Cambodia, each with its
   dates. Rows without both dates are dropped, except the base, which stays
   so a half-filled draft keeps its place; reversed dates are swapped. */
function cleanStays_(v) {
  if (!Array.isArray(v)) return null;
  const out = [];
  v.slice(0, STAYS_MAX).forEach(function (row, i) {
    if (!row || typeof row !== 'object') return;
    let from = isoDate_(row.from), to = isoDate_(row.to);
    if (from && to && to < from) { const x = from; from = to; to = x; }
    const place = String(row.place == null ? '' : row.place).trim().slice(0, 80);
    if (i === 0) { out.push({ place: place, from: from, to: to, base: true }); return; }
    if (!place && !from && !to) return;
    out.push({ place: place, from: from, to: to });
  });
  return out.length ? out : null;
}
function staysDone_(v) { return Array.isArray(v) && v[0] && !!v[0].from && !!v[0].to && v.slice(1).every(function (r) { return r.place && r.from && r.to; }); }
const FORM_AUDIENCES = ['all', 'khmer', 'international'];
const FORM_MAX_SECTIONS = 20, FORM_MAX_QUESTIONS = 120, FORM_MAX_OPTIONS = 30, ANSWER_MAX = 4000;
function langText_(v) {
  const o = (v && typeof v === 'object') ? v : { en: v };
  return { en: String(str_(o.en, 600) || ''), km: String(str_(o.km, 600) || '') };
}
function cleanForm_(f, key) {
  if (!f || typeof f !== 'object' || !Array.isArray(f.sections)) return null;
  const seen = {}; let nq = 0;
  const sections = f.sections.slice(0, FORM_MAX_SECTIONS).map(function (sec, si) {
    if (!sec || typeof sec !== 'object') return null;
    const sid = /^[a-z0-9_-]{1,40}$/i.test(String(sec.id || '')) ? String(sec.id) : 'sec' + (si + 1);
    const questions = (Array.isArray(sec.questions) ? sec.questions : []).map(function (qq, qi) {
      if (!qq || typeof qq !== 'object') return null;
      let id = /^[a-z0-9_-]{1,40}$/i.test(String(qq.id || '')) ? String(qq.id) : 'q' + Date.now().toString(36) + si + qi;
      while (seen[id]) id += '_';
      seen[id] = 1; nq++;
      const type = FORM_TYPES.indexOf(qq.type) > -1 ? qq.type : 'short';
      const label = langText_(qq.label);
      if (!label.en && !label.km) return null;
      const withOptions = type === 'choice' || type === 'multi' || type === 'yesno';
      return {
        id: id, type: type, label: label, help: langText_(qq.help), required: !!qq.required,
        addLabel: type === 'people' && qq.addLabel ? langText_(qq.addLabel) : undefined,
        audience: FORM_AUDIENCES.indexOf(qq.audience) > -1 ? qq.audience : 'all',
        attach: (type === 'yesno' || type === 'choice') && /^[a-z]{2,20}$/.test(String(qq.attach || '')) ? String(qq.attach) : undefined,
        options: withOptions ? (Array.isArray(qq.options) ? qq.options : []).map(langText_).filter(function (o) { return o.en || o.km; }).slice(0, FORM_MAX_OPTIONS) : []
      };
    }).filter(Boolean);
    return { id: sid, title: langText_(sec.title), help: langText_(sec.help), questions: questions };
  }).filter(Boolean);
  if (nq > FORM_MAX_QUESTIONS) return null;
  return { key: key, title: langText_(f.title), sections: sections };
}
async function getForms_() {
  const stored = await readJSON('portalForms', {});
  const out = {};
  Object.keys(PORTAL_FORMS_DEFAULT).forEach(function (k) {
    out[k] = (stored && stored[k] && Array.isArray(stored[k].sections)) ? stored[k] : Object.assign({}, PORTAL_FORMS_DEFAULT[k], { isDefault: true });
  });
  return out;
}
function askedQuestions_(form, audience) {
  const out = [];
  ((form && form.sections) || []).forEach(function (sec) { (sec.questions || []).forEach(function (qq) { if (qq.audience === 'all' || qq.audience === audience) out.push(qq); }); });
  return out;
}
function cleanAnswers_(answers, form, audience) {
  const out = {};
  if (!answers || typeof answers !== 'object') return out;
  askedQuestions_(form, audience).forEach(function (qq) {
    const v = answers[qq.id];
    if (v === undefined || v === null) return;
    if (qq.type === 'stays') { const st = cleanStays_(v); if (st) out[qq.id] = st; return; }
    if (qq.type === 'people') { const pl = cleanPeople_(v); if (pl) out[qq.id] = pl; return; }
    if (qq.type === 'multi') { if (Array.isArray(v)) { const arr = v.map(function (x) { return String(str_(x, 300) || ''); }).filter(Boolean).slice(0, FORM_MAX_OPTIONS); if (arr.length) out[qq.id] = arr; } }
    else { const str = String(v).trim().slice(0, ANSWER_MAX); if (str) out[qq.id] = str; }
  });
  return out;
}
function missingRequired_(answers, form, audience) {
  return askedQuestions_(form, audience).filter(function (qq) {
    if (!qq.required) return false;
    if (qq.type === 'stays') return !staysDone_(answers[qq.id]);
    if (qq.type === 'people') return !(Array.isArray(answers[qq.id]) && answers[qq.id].length);
    return answers[qq.id] === undefined || (Array.isArray(answers[qq.id]) && !answers[qq.id].length);
  }).map(function (qq) { return qq.id; });
}
async function portalSaveForm(username, pin, key, form) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  if (!PORTAL_FORMS_DEFAULT[key]) return { ok: false, err: 'bad_key' };
  const rec = cleanForm_(form, key);
  if (!rec) return { ok: false, err: 'bad_form' };
  const stored = await readJSON('portalForms', {});
  stored[key] = Object.assign(rec, { updated: new Date().toISOString(), updatedBy: me.id });
  await writeJSON('portalForms', stored);
  return { ok: true, form: stored[key], forms: await getForms_() };
}
async function portalResetForm(username, pin, key) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  if (!PORTAL_FORMS_DEFAULT[key]) return { ok: false, err: 'bad_key' };
  const stored = await readJSON('portalForms', {});
  delete stored[key];
  await writeJSON('portalForms', stored);
  return { ok: true, forms: await getForms_() };
}
async function applicantCand_(username, pin, leftOk) {
  const s = await verifyStaff_(username, pin, true);
  if (!s || !isApplicant_(s)) return { out: { ok: false, err: 'auth' } };
  const rows = await getCandidates_();
  const cand = await candidateFor_(rows, s);
  if (!cand) return { out: { ok: false, err: 'no_application' } };
  if (cand.archived && !(leftOk && cand.archived.left)) return { out: { ok: false, err: 'closed' } };
  return { s: s, rows: rows, cand: cand };
}
/* Every change saves — the form is long and phones lose pages. */
async function portalSaveDraft(username, pin, answers) {
  const a = await applicantCand_(username, pin); if (a.out) return a.out;
  const cand = a.cand;
  cand.portal = cand.portal || {};
  if (cand.portal.submittedAt) return { ok: false, err: 'submitted' };
  const form = (await getForms_())[formKeyOf_(cand)];
  cand.portal.draft = cleanAnswers_(answers, form, audienceOf_(cand));
  cand.portal.draftAt = new Date().toISOString();
  await writeJSON('candidates', a.rows);
  if (cand.type === 'team') await syncTeamTrip_(cand, a.s.id);
  return { ok: true, savedAt: cand.portal.draftAt, answers: cand.portal.draft };
}
async function portalSubmit(username, pin, answers) {
  const a = await applicantCand_(username, pin); if (a.out) return a.out;
  const cand = a.cand;
  cand.portal = cand.portal || {};
  if (cand.portal.submittedAt) return { ok: false, err: 'submitted' };
  const form = (await getForms_())[formKeyOf_(cand)], audience = audienceOf_(cand);
  const merged = cleanAnswers_(answers !== undefined && answers !== null ? answers : (cand.portal.draft || {}), form, audience);
  const missing = missingRequired_(merged, form, audience);
  if (missing.length) return { ok: false, err: 'missing', missing: missing };
  const now = new Date().toISOString();
  cand.portal.form = { answers: merged, submittedAt: now, audience: audience, formKey: formKeyOf_(cand) };
  cand.portal.submittedAt = now; cand.portal.draft = null; cand.portal.draftAt = null;
  if (cand.stage === 'new') {
    cand.stage = 'applied';
    cand.log = (Array.isArray(cand.log) ? cand.log : []).concat([{ at: now, by: a.s.id, kind: 'stage', text: 'applied' }]).slice(-CAND_LOG_MAX);
  }
  cand.updated = now; cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  await syncTeamTrip_(cand, a.s.id);   // a team shows up in the Teams Database the day it applies
  return portalBoot(username, pin);
}
/* After submitting, the applicant may still correct their answers — teams in
   particular apply with estimated dates and head counts and firm them up
   later. The whole answer set is replaced (required still checked), the
   record logs that the applicant changed it, and the stage is left alone. */
async function portalUpdateAnswers(username, pin, answers) {
  const a = await applicantCand_(username, pin); if (a.out) return a.out;
  const cand = a.cand;
  cand.portal = cand.portal || {};
  if (!cand.portal.submittedAt || !cand.portal.form) return { ok: false, err: 'not_submitted' };
  if (cand.archived) return { ok: false, err: 'closed' };
  const form = (await getForms_())[formKeyOf_(cand)], audience = audienceOf_(cand);
  const merged = cleanAnswers_(answers && typeof answers === 'object' ? answers : {}, form, audience);
  const missing = missingRequired_(merged, form, audience);
  if (missing.length) return { ok: false, err: 'missing', missing: missing };
  const now = new Date().toISOString();
  cand.portal.form.answers = merged; cand.portal.form.updatedAt = now;
  cand.log = (Array.isArray(cand.log) ? cand.log : []).concat([{ at: now, by: a.s.id, kind: 'note', text: 'Updated their application answers' }]).slice(-CAND_LOG_MAX);
  cand.updated = now; cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  await syncTeamTrip_(cand, a.s.id);
  return portalBoot(username, pin);
}
/* ==================== applicant documents ====================
   What an applicant sends us once they have applied, kind by kind. Teams
   for now (the base gives the list for the others later): passport copies
   and a team photo with names are needed; flight itineraries come when the
   flights are booked, and are what we arrange airport transport from.
   Each file is its own blob ('pdoc:<id>'); the record keeps only the list.
   Readable by the applicant themself and by portal staff who may see that
   record — nobody else. */
/* A team sends passport copies for everyone, a team photo with names and the
   flight itineraries first; then comes the visa part — the letter of
   invitation and its supporting documents, `from: 'us'` (staff upload them,
   the team opens them, only staff can remove them), and the team's e-visas. */
const PORTAL_DOC_KINDS = {
  team: [{ id: 'passports', required: true }, { id: 'photo', required: true }, { id: 'flights', required: true },
    { id: 'invitation', required: false, from: 'us' }, { id: 'evisa', required: false }]
};
const PORTAL_DOCS_MAX = 40;
function docKindsFor_(c) { return PORTAL_DOC_KINDS[c && c.type] || []; }
function docsOf_(c) { return (c && c.portal && Array.isArray(c.portal.docs)) ? c.portal.docs : []; }
function docsRequiredIn_(c) {
  const kinds = docKindsFor_(c).filter(function (k) { return k.required; });
  if (!kinds.length) return false;
  const have = docsOf_(c);
  return kinds.every(function (k) { return have.some(function (d) { return d && d.kind === k.id; }); });
}
function docMeta_(d) { return { id: d.id, kind: d.kind, name: d.name, mime: d.mime, size: d.size, added: d.added, by: d.by }; }
/* whose record, and may this person touch its documents */
async function docCand_(username, pin, candidateId) {
  if (candidateId) return portalStaffCand_(username, pin, candidateId);
  const a = await applicantCand_(username, pin); if (a.out) return a;
  return Object.assign(a, { own: true });
}
async function portalUploadDoc(username, pin, kind, name, mime, base64, candidateId) {
  const a = await docCand_(username, pin, candidateId); if (a.out) return a.out;
  const cand = a.cand;
  const kindDef = docKindsFor_(cand).filter(function (k) { return k.id === kind; })[0];
  if (!kindDef) return { ok: false, err: 'bad_kind' };
  if (a.own && kindDef.from === 'us') return { ok: false, err: 'from_us' };
  // documents come after applying — except one the form itself asks to attach (a team's flight itinerary)
  if (a.own && !(cand.portal && cand.portal.submittedAt)) {
    const form = (await getForms_())[formKeyOf_(cand)];
    const inForm = askedQuestions_(form, audienceOf_(cand)).some(function (qq) { return qq.attach === kind; });
    if (!inForm) return { ok: false, err: 'not_submitted' };
  }
  mime = str_(mime, 80);
  if (HR_FILE_MIME.indexOf(mime) === -1) return { ok: false, err: 'bad_type' };
  if (typeof base64 !== 'string' || !base64) return { ok: false, err: 'bad_file' };
  if (base64.length > HR_FILE_MAX_B64) return { ok: false, err: 'too_large' };
  cand.portal = cand.portal || {};
  const list = docsOf_(cand);
  if (list.length >= PORTAL_DOCS_MAX) return { ok: false, err: 'too_many' };
  const meta = { id: 'pd' + pinSalt_(), kind: kind, name: str_(name, 160) || 'file', mime: mime, size: Math.floor(base64.length * 3 / 4), added: new Date().toISOString(), by: a.s.id };
  await writeJSON('pdoc:' + meta.id, { id: meta.id, candidateId: cand.id, kind: kind, name: meta.name, mime: mime, data: base64, added: meta.added, by: a.s.id });
  cand.portal.docs = list.concat([meta]);
  cand.updated = meta.added; cand.updatedBy = a.s.id;
  teamAutoStage_(cand, a.s.id);   // the last document in moves a team on to its 2nd call
  await writeJSON('candidates', a.rows);
  return { ok: true, doc: docMeta_(meta), docs: cand.portal.docs.map(docMeta_), application: portalAppOut_(cand) };
}
async function findDoc_(username, pin, docId) {
  docId = str_(docId, 60);
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { out: { ok: false } };
  const rows = await getCandidates_();
  const cand = rows.find(function (c) { return docsOf_(c).some(function (d) { return d && d.id === docId; }); });
  if (!cand) return { out: { ok: false, err: 'not_found' } };
  if (isApplicant_(s)) {
    const mine = await candidateFor_(rows, s);
    if (!mine || mine.id !== cand.id) return { out: { ok: false, err: 'not_found' } };
  } else if (!(canPortal_(s) || canHR_(s)) || (!canHR_(s) && !portalMaySee_(s, cand))) return { out: { ok: false, err: 'not_authorized' } };
  return { s: s, rows: rows, cand: cand, docId: docId };
}
async function portalGetDoc(username, pin, docId) {
  const f = await findDoc_(username, pin, docId); if (f.out) return f.out;
  const blob = await readJSON('pdoc:' + f.docId, null);
  if (!blob || !blob.data) return { ok: false, err: 'not_found' };
  return { ok: true, id: blob.id, name: blob.name, mime: blob.mime, dataUrl: 'data:' + blob.mime + ';base64,' + blob.data };
}
async function portalDeleteDoc(username, pin, docId) {
  const f = await findDoc_(username, pin, docId); if (f.out) return f.out;
  if (isApplicant_(f.s)) {
    const doc = docsOf_(f.cand).filter(function (d) { return d.id === f.docId; })[0];
    const def = doc && docKindsFor_(f.cand).filter(function (k) { return k.id === doc.kind; })[0];
    if (def && def.from === 'us') return { ok: false, err: 'from_us' };
  }
  f.cand.portal.docs = docsOf_(f.cand).filter(function (d) { return d.id !== f.docId; });
  f.cand.updated = new Date().toISOString(); f.cand.updatedBy = f.s.id;
  await writeJSON('candidates', f.rows);
  try { await store().delete('pdoc:' + f.docId); } catch (e) { /* the record is already clean */ }
  return { ok: true, docs: f.cand.portal.docs.map(docMeta_), application: portalAppOut_(f.cand) };
}
/* ==================== view as applicant (staff side) ====================
   What a given applicant sees — their dashboard and form, built by the very
   same functions their own portalBoot uses — so staff can check what an edit
   looks like from the other side. Either one real record (scope applies) or
   a sample applicant of a chosen kind, audience and stage. Read-only: the
   reply is just data; nothing is written. */
const PREVIEW_STAGES = CAND_STAGES;
async function portalViewAs(username, pin, opts) {
  opts = opts && typeof opts === 'object' ? opts : {};
  const forms = await getForms_();
  if (opts.candidateId) {
    const a = await portalStaffCand_(username, pin, opts.candidateId); if (a.out) return a.out;
    const cand = a.cand;
    const rows = await getStaff_();
    const acct = cand.staffId ? rows.find(function (r) { return r.id === cand.staffId && isApplicant_(r); }) : null;
    const me = acct ? portalMeOut_(acct) : { id: '', name: cand.name, username: '', email: cand.email || '', phone: cand.phone || '', messenger: cand.messenger || '', country: cand.country || '', campus: cand.campus || '', type: cand.type, school: cand.school || '' };
    return { ok: true, preview: 'record', role: 'applicant', me: me, application: portalAppOut_(cand), form: forms[formKeyOf_(cand)], strengths: strengthsOut_(cand, await getStrengths_(cand)) };
  }
  const g = await hrGate_(username, pin); if (g.out) return g.out;
  const type = PORTAL_TYPES.indexOf(opts.type) > -1 ? opts.type : 'student';
  const school = type === 'student' ? (PORTAL_SCHOOLS.indexOf(opts.school) > -1 ? opts.school : 'dts') : '';
  const stage = (type === 'team' ? TEAM_STAGES : PREVIEW_STAGES).indexOf(opts.stage) > -1 ? opts.stage : 'new';
  const khmer = opts.audience === 'khmer';
  const campus = PORTAL_CAMPUSES[opts.campus] ? opts.campus : 'siemreap';
  if (school && PORTAL_CAMPUSES[campus].indexOf(school) === -1) return { ok: false, err: 'school_not_at_campus' };
  const idx = portalStageIdx_(stage, type), now = new Date().toISOString();
  const tIdx = function (st) { return portalStageIdx_(st, 'team'); };
  const cand = { id: 'preview', campus: campus, name: type === 'team' ? 'Sample Team' : 'Sample Applicant', type: type, school: school, stage: stage,
    country: khmer ? 'Cambodia' : 'Australia', email: 'sample@example.org', phone: khmer ? '+855 12 345 678' : '+61 400 000 000', messenger: 'whatsapp', source: 'portal',
    portal: { createdAt: now, submittedAt: idx >= portalStageIdx_('applied', type) ? now : null, form: idx >= portalStageIdx_('applied', type) ? { answers: {}, submittedAt: now } : null, draft: null,
      visa: type === 'team' ? { flightsConfirmed: idx >= tIdx('call2'), invitationSent: idx >= tIdx('call2') }
        : { flightsConfirmed: idx >= portalStageIdx_('practical'), invitationSent: idx >= portalStageIdx_('practical') },
      team: { call1: idx >= tIdx('docs') ? now : null, call2: idx >= tIdx('practical') ? now : null },
      members: type === 'team' && idx >= tIdx('applied') ? [{ id: 'msample01', name: 'Sam Sample', sex: 'm' }, { id: 'msample02', name: 'Mia Sample', sex: 'f' }] : [],
      referenceDone: idx >= portalStageIdx_('interview'), references: idx >= portalStageIdx_('interview') ? [{ id: 'ref_sample', usedAt: now, leaderName: 'Sample Leader', createdAt: now }] : [] },
    log: [], archived: null, created: now, updated: now };
  const me = { id: 'preview', name: cand.name, username: 'sample', email: cand.email, phone: cand.phone, messenger: 'whatsapp', country: cand.country, campus: campus, type: type, school: school };
  /* View as applicant shows this week's real schedules, as someone here would see them */
  const schedules = await applicantSchedules_(Object.assign({}, cand, { stage: 'arrived' }), null);
  return { ok: true, preview: 'sample', role: 'applicant', me: me, application: portalAppOut_(cand), form: forms[formKeyOf_(cand)], strengths: strengthsOut_(cand, { people: {} }), schedules: schedules };
}
/* ==================== the leader reference ====================
   International applicants (and every staff / volunteer applicant) send one
   reference from a pastor or leader. The applicant — or staff, from the
   record — makes a link; the leader opens portal.html?ref=<token> with no
   account and fills in the reference form (forms.reference, editable like
   the others). The token is random, kept only as a sha256 hash on the record,
   single-use, and expires after REF_TTL_DAYS; making a new link revokes the
   pending one. The two public handlers answer with the applicant's name and
   the form — nothing else about them. */
const REF_TTL_DAYS = 14;
function refHash_(token) { return hashPin_(String(token), 'reference'); }
function refs_(c) { return (c && c.portal && Array.isArray(c.portal.references)) ? c.portal.references : []; }
function refValid_(ref, now) {
  if (!ref || ref.usedAt) return 'used';
  if (ref.revokedAt || !ref.expiresAt || new Date(ref.expiresAt).getTime() < (now || Date.now())) return 'expired';
  return 'ok';
}
/* What the applicant and the staff see about the reference: nothing about the
   token itself. */
function refState_(c) {
  const list = refs_(c);
  const got = list.filter(function (r) { return r && r.usedAt; }).sort(function (a, b) { return String(b.usedAt).localeCompare(String(a.usedAt)); })[0];
  if (got) return { status: 'received', receivedAt: got.usedAt, leaderName: got.leaderName || '', leaderEmail: got.leaderEmail || '', answers: got.answers || {}, sentAt: got.createdAt || null };
  const open = list.filter(function (r) { return r && refValid_(r) === 'ok'; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })[0];
  if (open) return { status: 'pending', sentAt: open.createdAt, expiresAt: open.expiresAt };
  const last = list.filter(function (r) { return r && !r.usedAt; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })[0];
  if (last) return { status: 'expired', sentAt: last.createdAt, expiresAt: last.expiresAt };
  return { status: 'none' };
}
async function portalReferenceLink(username, pin, candidateId) {
  let a;
  if (candidateId) { a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out; }
  else { a = await applicantCand_(username, pin); if (a.out) return a.out; }
  const cand = a.cand;
  if (!refNeeded_(cand)) return { ok: false, err: 'not_needed' };
  if (cand.archived) return { ok: false, err: 'closed' };
  cand.portal = cand.portal || {};
  const list = refs_(cand);
  if (list.some(function (r) { return r && r.usedAt; })) return { ok: false, err: 'received' };
  const now = new Date();
  list.forEach(function (r) { if (r && !r.usedAt && !r.revokedAt) r.revokedAt = now.toISOString(); });
  const token = pinSalt_() + pinSalt_() + pinSalt_();
  const ref = { id: 'ref_' + pinSalt_(), hash: refHash_(token), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + REF_TTL_DAYS * 86400000).toISOString(), by: a.s.id };
  list.push(ref);
  cand.portal.references = list.slice(-10);
  cand.updated = now.toISOString(); cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  return { ok: true, token: token, expiresAt: ref.expiresAt, reference: refState_(cand) };
}
async function findRef_(token) {
  token = String(token || '');
  if (!/^[a-f0-9]{24,128}$/.test(token)) return null;
  const h = refHash_(token);
  const rows = await getCandidates_();
  for (const c of rows) {
    const ref = refs_(c).find(function (r) { return r && r.hash === h; });
    if (ref) return { rows: rows, cand: c, ref: ref };
  }
  return null;
}
function refApplyingFor_(c) { return c.type === 'student' ? String(c.school || '').toUpperCase() : c.type; }
async function portalReferenceForm(token) {
  const f = await findRef_(token);
  if (!f) return { ok: false, err: 'invalid' };
  const v = refValid_(f.ref);
  if (v !== 'ok') return { ok: false, err: v };
  return { ok: true, applicantName: f.cand.name, applyingFor: refApplyingFor_(f.cand), expiresAt: f.ref.expiresAt, form: (await getForms_()).reference };
}
async function portalReferenceSubmit(token, answers) {
  const f = await findRef_(token);
  if (!f) return { ok: false, err: 'invalid' };
  const v = refValid_(f.ref);
  if (v !== 'ok') return { ok: false, err: v };
  const form = (await getForms_()).reference;
  const clean = cleanAnswers_(answers && typeof answers === 'object' ? answers : {}, form, 'all');
  const missing = missingRequired_(clean, form, 'all');
  if (missing.length) return { ok: false, err: 'missing', missing: missing };
  const now = new Date().toISOString();
  f.ref.usedAt = now; f.ref.answers = clean;
  f.ref.leaderName = str_(clean.leaderName, 120) || ''; f.ref.leaderEmail = cleanEmail_(clean.leaderEmail) || '';
  f.cand.portal.referenceDone = true;
  f.cand.log = (Array.isArray(f.cand.log) ? f.cand.log : []).concat([{ at: now, by: 'reference', kind: 'note', text: 'Leader reference received' + (f.ref.leaderName ? ' from ' + f.ref.leaderName : '') }]).slice(-CAND_LOG_MAX);
  f.cand.updated = now; f.cand.updatedBy = 'reference';
  await writeJSON('candidates', f.rows);
  return { ok: true, applicantName: f.cand.name };
}
/* ==================== legal documents, signed on a phone (Oct 2026) ====================
   A team's people sign YWAM Siem Reap's forms (legal-docs-default.js) with no
   account: staff make the team's signing link on the record (portalSignLink —
   a random token, kept only as a sha256 hash, a new one turning the old one
   off), anyone on the team opens portal.html?sign=<token>, picks their name
   (the team's names and photos list — leader, co-leaders, members) and signs
   each document in turn. Each signature keeps the exact text signed (a
   snapshot, 'legalSnap:<hash>'), the ticks, details, initials and the
   handwritten signature JPEGs, in one blob per person
   ('tsign:<candidateId>:<key>'); the record keeps only who signed what and
   when (portal.signed) for the grid on the record's Legal tab, where each
   signed one downloads as a PDF built from those (legal-pdf.js). A portal
   admin can turn a document off ('legalDocs' {off:[ids]}). */
const SIG_MAX_B64 = 120 * 1024;
/* who signs on a record: a team's people, or the applicant alone ('me') */
function signPeople_(c) { return c.type === 'team' ? teamPhotoPeople_(c) : [{ key: 'me', name: c.name, role: 'me' }]; }
/* the Child Protection Agreement's reporting contacts, set by a portal admin */
const CONTACT_ROLES = ['Ministry leader or director', 'Alternative senior leader'];
function legalContacts_(set) {
  const got = Array.isArray(set && set.contacts) ? set.contacts : [];
  return CONTACT_ROLES.map(function (role, i) { const c = got[i] || {}; return { role: role, name: dutyText_(c.name, 120), phone: dutyText_(c.phone, 60) }; });
}
/* what the role and dates lines start with on a record */
function signPrefill_(c) {
  const fmt = function (d) { return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : ''; };
  if (c.type === 'team') {
    const trip = tripFromApp_(c, null) || {};
    return { role: 'Short-term team — ' + teamTitle_(c), dates: trip.from && trip.to ? fmt(trip.from) + ' – ' + fmt(trip.to) : '' };
  }
  return { role: c.type === 'student' ? String(c.school || '').toUpperCase() + ' student' : c.type === 'staff' ? 'Staff' : c.type === 'volunteer' ? 'Volunteer' : '', dates: '' };
}
async function legalDocs_(all) {
  const set = await readJSON('legalDocs', { off: [] });
  const off = Array.isArray(set && set.off) ? set.off : [];
  return LEGAL_DOCS_DEFAULT.map(function (d) { return Object.assign({}, d, { on: off.indexOf(d.id) === -1, hash: crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex') }); })
    .filter(function (d) { return all || d.on; });
}
function signHash_(token) { return hashPin_(String(token), 'sign'); }
function signBlobKey_(candId, key) { return 'tsign:' + candId + ':' + String(key).replace(/[^a-zA-Z0-9]/g, '_'); }
function teamTitle_(c) { return dutyText_(teamAnswers_(c).teamName, 120) || c.name; }
function pnpStamp_(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000), p = function (n) { return String(n).padStart(2, '0'); };
  return { date: p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear(), at: d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ' (Phnom Penh time)' };
}
async function signStatus_(c) {
  const docs = await legalDocs_();
  const signed = (c.portal && c.portal.signed) || {};
  return {
    link: c.portal && c.portal.signLink ? { createdAt: c.portal.signLink.createdAt } : null,
    docs: docs.map(function (d) { return { id: d.id, title: d.title }; }),
    people: signPeople_(c).map(function (p) { return { key: p.key, name: p.name, role: p.role, signed: signed[p.key] || {} }; })
  };
}
async function portalSignLink(username, pin, candidateId) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  return makeSignLink_(a, a.s.id);
}
/* an applicant signs from their own dashboard, signed in — no link, so a team
   link staff already sent keeps working */
async function signFor_(arg) {
  if (arg && typeof arg === 'object') { const a = await applicantCand_(arg.user, arg.pin); return a.out ? null : { rows: a.rows, cand: a.cand }; }
  return findSign_(arg);
}
async function makeSignLink_(a, by) {
  const c = a.cand;
  if (c.archived) return { ok: false, err: 'closed' };
  const token = pinSalt_() + pinSalt_() + pinSalt_();
  c.portal = c.portal || {};
  c.portal.signLink = { hash: signHash_(token), createdAt: new Date().toISOString(), by: by };
  c.updated = new Date().toISOString(); c.updatedBy = by;
  await writeJSON('candidates', a.rows);
  return Object.assign({ ok: true, token: token }, await signStatus_(c));
}
async function portalSignStatus(username, pin, candidateId) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  return Object.assign({ ok: true }, await signStatus_(a.cand));
}
async function findSign_(token) {
  token = String(token || '');
  if (!/^[a-f0-9]{24,128}$/.test(token)) return null;
  const h = signHash_(token);
  const rows = await getCandidates_();
  const c = rows.find(function (x) { return x && x.portal && x.portal.signLink && x.portal.signLink.hash === h; });
  return c ? { rows: rows, cand: c } : null;
}
/* the signer's side: the team, its people, the documents — nothing else about the team */
async function portalSignOpen(token) {
  const f = await signFor_(token);
  if (!f) return { ok: false, err: 'invalid' };
  if (f.cand.archived) return { ok: false, err: 'closed' };
  const signed = (f.cand.portal && f.cand.portal.signed) || {};
  const docs = await legalDocs_();
  return {
    ok: true, team: f.cand.type === 'team' ? teamTitle_(f.cand) : f.cand.name, isTeam: f.cand.type === 'team',
    contacts: legalContacts_(await readJSON('legalDocs', {})), prefill: signPrefill_(f.cand),
    people: signPeople_(f.cand).map(function (p) { const m = signed[p.key] || {}; const done = {}; docs.forEach(function (d) { if (m[d.id]) done[d.id] = true; }); return { key: p.key, name: p.name, done: done }; }),
    docs: docs.map(function (d) { return { id: d.id, title: d.title, blocks: d.blocks, sign: d.sign || {} }; })
  };
}
/* Everything a signature must have for this document — the ticks, the
   choice, the lines, initials, the handwritten signature, age, a guardian
   under 18, a witness if one was added — and the record kept for it, with a
   snapshot of the exact text signed. Shared by applicants and staff. */
async function signRecord_(doc, p, key) {
  p = p && typeof p === 'object' ? p : {};
  const sign = doc.sign || {};
  const name = dutyText_(p.name, 120);
  if (!name) return { err: 'name_required' };
  const checks = {}, fields = {}, initials = {}, choices = {};
  for (const b of doc.blocks) {
    if (b.t === 'check' || b.t === 'group') { if (!(p.checks && p.checks[b.id] === true)) return { err: 'unticked', id: b.id }; checks[b.id] = true; }
    if (b.t === 'choice') { const v = p.choices && p.choices[b.id]; if (!(b.options || []).some(function (o) { return o.id === v; })) return { err: 'choice_required', id: b.id }; choices[b.id] = v; }
    if (b.t === 'field') { const v = dutyText_(p.fields && p.fields[b.id], 120); if (!v && !b.optional) return { err: 'field_required', id: b.id }; if (v) fields[b.id] = v; }
    if (b.t === 'initial') { const v = p.initials && p.initials[b.id]; if (!isJpeg_(v) || v.length > SIG_MAX_B64) return { err: 'initials_required', id: b.id }; initials[b.id] = v; }
  }
  if (!isJpeg_(p.sig) || p.sig.length > SIG_MAX_B64) return { err: 'signature_required' };
  let age = null;
  if (sign.age) { age = finiteNum_(p.age, 1, 120); if (age == null) return { err: 'age_required' }; age = Math.round(age); }
  const under18 = !!p.under18 || (age != null && age < 18);
  let guardianName = '', guardianSig = '';
  if (sign.guardian && under18) {
    guardianName = dutyText_(p.guardianName, 120);
    guardianSig = p.guardianSig;
    if (!guardianName || !isJpeg_(guardianSig) || guardianSig.length > SIG_MAX_B64) return { err: 'guardian_required' };
  }
  let leaderName = '', leaderSig = '';
  if (sign.leader) {
    leaderName = dutyText_(p.leaderName, 120); leaderSig = p.leaderSig;
    if (!leaderName || !isJpeg_(leaderSig) || leaderSig.length > SIG_MAX_B64) return { err: 'leader_required' };
  }
  let witnessName = '', witnessSig = '';
  if (sign.witness && (p.witnessName || p.witnessSig)) {
    witnessName = dutyText_(p.witnessName, 120); witnessSig = p.witnessSig || '';
    if (!witnessName || !isJpeg_(witnessSig) || witnessSig.length > SIG_MAX_B64) return { err: 'witness_incomplete' };
  }
  const now = new Date().toISOString(), stamp = pnpStamp_(now);
  const snapKey = 'legalSnap:' + doc.hash;
  if (!(await readJSON(snapKey, null))) { const snap = Object.assign({}, doc); delete snap.on; delete snap.hash; await writeJSON(snapKey, snap); }
  return { rec: { at: now, dateText: stamp.date, atText: stamp.at, name: name, age: age, under18: under18, guardianName: guardianName, guardianSig: guardianSig, witnessName: witnessName, witnessSig: witnessSig,
    sig: p.sig, checks: checks, choices: choices, fields: fields, initials: initials, docHash: doc.hash, personKey: key,
    leaderName: leaderName || undefined, leaderSig: leaderSig || undefined, leaderDateText: leaderName ? stamp.date : undefined,
    contacts: doc.blocks.some(function (b) { return b.t === 'contacts'; }) ? legalContacts_(await readJSON('legalDocs', {})) : undefined } };
}
async function portalSignSubmit(token, key, docId, p) {
  const f = await signFor_(token);
  if (!f) return { ok: false, err: 'invalid' };
  const c = f.cand;
  if (c.archived) return { ok: false, err: 'closed' };
  key = str_(key, 40);
  const person = signPeople_(c).find(function (x) { return x.key === key; });
  if (!person) return { ok: false, err: 'bad_person' };
  const doc = (await legalDocs_()).find(function (d) { return d.id === str_(docId, 40); });
  if (!doc) return { ok: false, err: 'bad_doc' };
  const v = await signRecord_(doc, p, key);
  if (v.err) return Object.assign({ ok: false }, v);
  const now = v.rec.at, name = v.rec.name, choices = v.rec.choices;
  const blobKey = signBlobKey_(c.id, key);
  const mine = await readJSON(blobKey, { docs: {} });
  mine.docs = mine.docs || {};
  mine.docs[doc.id] = v.rec;
  await writeJSON(blobKey, mine);
  c.portal = c.portal || {};
  c.portal.signed = c.portal.signed || {};
  c.portal.signed[key] = Object.assign({}, c.portal.signed[key] || {});
  c.portal.signed[key][doc.id] = { at: now, name: name };
  if (choices.disclose === 'private') {
    c.log = (Array.isArray(c.log) ? c.log : []).concat([{ at: now, by: 'sign', kind: 'note', text: name + ' signed the Child Protection Agreement and has information to disclose privately to the director before starting.' }]).slice(-CAND_LOG_MAX);
    c.portal.signed[key][doc.id].disclose = true;
  }
  c.updated = now; c.updatedBy = 'sign';
  await writeJSON('candidates', f.rows);
  const done = {}; Object.keys(c.portal.signed[key]).forEach(function (d) { done[d] = true; });
  return { ok: true, done: done };
}
/* ==================== staff sign in the GP app (Oct 2026) ====================
   Campus and YAP staff sign the same five documents once, and a Volunteer
   Staff Contract whenever HR sends one. They sign on portal.html?staff=1 with
   their GP app sign-in (the same screens as applicants). Their records:
   staff.legal = { docId: {at, name} } and blob 'ssign:<staffId>'; a contract's
   signatures in blob 'scontract:<contractId>' { staff, leader }. */
/* Documents a staff member signed as an applicant in the portal count here too:
   their application (by account, or the same email) signed as 'me'. Copied
   onto the staff record (from: 'portal') when they open My contract, so the
   profile list sees them. */
function portalLegalFor_(s, cands) {
  const out = {}, em = String(s.email || '').toLowerCase();
  (cands || []).forEach(function (c) {
    if (!c || c.type === 'team') return;
    if (!(c.staffId === s.id || (em && String(c.email || '').toLowerCase() === em))) return;
    const m = (c.portal && c.portal.signed && c.portal.signed.me) || {};
    Object.keys(m).forEach(function (d) { if (!out[d] || m[d].at > out[d].at) out[d] = { at: m[d].at, name: m[d].name, from: 'portal', candId: c.id }; });
  });
  return out;
}
async function syncPortalLegal_(s) {
  const got = portalLegalFor_(s, await getCandidates_()), have = s.legal || {};
  const add = Object.keys(got).filter(function (d) { return !have[d]; });
  if (!add.length) return s;
  let out = s;
  await mutateStaff_(function (rows) {
    const r = rows.find(function (x) { return x.id === s.id; }); if (!r) return { abort: true, ok: false };
    r.legal = Object.assign({}, r.legal || {}); add.forEach(function (d) { r.legal[d] = got[d]; });
    out = r; return { ok: true };
  });
  return out;
}
function contractPeriod_(c) {
  const end = hrContractEnd_(c), p = function (n) { return String(n).padStart(2, '0'); };
  const yrs = Number(c.years);
  return (yrs === 1 ? '1 year' : yrs + ' years') + ' · From ' + c.signed.slice(5, 7) + '/' + c.signed.slice(0, 4) + ' to ' + p(end.getMonth() + 1) + '/' + end.getFullYear();
}
function contractDoc_(c) { return Object.assign({}, STAFF_CONTRACT, { id: 'contract:' + c.id, hash: crypto.createHash('sha256').update(JSON.stringify(STAFF_CONTRACT)).digest('hex') }); }
async function staffSignOpen(username, pin) {
  let s = await verifyStaff_(username, pin);
  if (!s || isApplicant_(s)) return { ok: false, err: 'invalid' };
  s = await syncPortalLegal_(s);
  const legal = s.legal || {}, done = {};
  const docs = (await legalDocs_()).map(function (d) { if (legal[d.id]) done[d.id] = true; return { id: d.id, title: d.title, blocks: d.blocks, sign: d.sign || {} }; });
  return { ok: true, isTeam: false, staff: true, team: s.name, contacts: legalContacts_(await readJSON('legalDocs', {})),
    prefill: { role: [s.role, s.ministry].filter(Boolean).join(' — ') || 'Staff', dates: '' },
    people: [{ key: 'me', name: s.name, done: done }], docs: docs };
}
async function staffSignSubmit(username, pin, key, docId, p) {
  const s = await verifyStaff_(username, pin);
  if (!s || isApplicant_(s)) return { ok: false, err: 'invalid' };
  docId = str_(docId, 80);
  const doc = (await legalDocs_()).find(function (d) { return d.id === docId; });
  if (!doc) return { ok: false, err: 'bad_doc' };
  const v = await signRecord_(doc, p, 'me'); if (v.err) return Object.assign({ ok: false }, v);
  const blob = await readJSON('ssign:' + s.id, { docs: {} }); blob.docs = blob.docs || {}; blob.docs[doc.id] = v.rec;
  await writeJSON('ssign:' + s.id, blob);
  return mutateStaff_(function (rows) {
    const r = rows.find(function (x) { return x.id === s.id; }); if (!r) return { abort: true, ok: false, err: 'not_found' };
    r.legal = Object.assign({}, r.legal || {}); r.legal[doc.id] = { at: v.rec.at, name: v.rec.name };
    if (v.rec.choices && v.rec.choices.disclose === 'private') r.legal[doc.id].disclose = true;
    r.updated = new Date().toISOString();
    return { ok: true, done: staffDone_(r) };
  });
}
function staffDone_(r) { const o = {}; Object.keys(r.legal || {}).forEach(function (k) { o[k] = true; }); return o; }
/* The Volunteer Staff Contract, filled out in person: HR (an admin) opens
   it on the person's HR profile with its first month and length — any time,
   also to redo a contract first signed on paper — hands their phone over,
   the person reads, fills in and signs, and HR signs to approve. Only then
   is it one of their contracts. One waits at a time; starting again changes
   its period. */
async function hrSendContract(username, pin, staffId, period) {
  period = period && typeof period === 'object' ? period : {};
  const from = isoMonth_(period.from), years = finiteNum_(period.years, 0.25, 30);
  if (!from || years == null) return { ok: false, err: 'bad_contract' };
  let cid = '';
  const out = await hrMutate_(username, pin, staffId, function (rec, me) {
    const list = contractsOf_(rec), wait = list.filter(function (c) { return c.digital && c.digital.status === 'awaiting_staff'; })[0];
    if (wait) { wait.signed = from; wait.years = Math.round(years * 4) / 4; wait.digital = Object.assign({}, wait.digital, { sentAt: new Date().toISOString(), sentBy: me.id }); rec.contracts = list; cid = wait.id; return; }
    if (list.length >= HR_MAX_CONTRACTS) return { abort: true, ok: false, err: 'too_many' };
    cid = hrId_('ct');
    rec.contracts = list.concat([{ id: cid, signed: from, years: Math.round(years * 4) / 4, notes: '', campus: HR_CAMPUSES.indexOf(rec.campus) > -1 ? rec.campus : '', files: [],
      added: new Date().toISOString(), addedBy: me.id, digital: { status: 'awaiting_staff', sentAt: new Date().toISOString(), sentBy: me.id } }]);
  });
  return out && out.ok ? Object.assign(out, { contractId: cid }) : out;
}
async function hrContractGate_(username, pin, staffId) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { out: { ok: false, err: 'invalid' } };
  if (!canHR_(me)) return { out: { ok: false, err: 'not_authorized' } };
  const r = (await getStaff_()).find(function (x) { return x.id === str_(staffId, 60); });
  if (!r) return { out: { ok: false, err: 'not_found' } };
  return { me: me, r: r, wait: contractsOf_(r).filter(function (c) { return c.digital && c.digital.status === 'awaiting_staff'; }) };
}
/* the signing page, on HR's phone: the person signs, then HR approves */
async function hrContractOpen(username, pin, staffId) {
  const g = await hrContractGate_(username, pin, staffId); if (g.out) return g.out;
  const docs = g.wait.map(function (c) { const d = contractDoc_(c); return { id: d.id, title: d.title, blocks: d.blocks, sign: d.sign, period: contractPeriod_(c) }; });
  return { ok: true, isTeam: false, staff: true, hrSign: true, team: g.r.name, approver: g.me.name, contacts: [],
    prefill: { role: [g.r.role, g.r.ministry].filter(Boolean).join(' — ') || 'Staff', dates: '' },
    people: [{ key: 'me', name: g.r.name, done: {} }], docs: docs };
}
async function hrContractSign(username, pin, staffId, key, docId, p) {
  const g = await hrContractGate_(username, pin, staffId); if (g.out) return g.out;
  const c = g.wait.find(function (x) { return 'contract:' + x.id === str_(docId, 80); });
  if (!c) return { ok: false, err: 'bad_doc' };
  const v = await signRecord_(contractDoc_(c), p, 'me'); if (v.err) return Object.assign({ ok: false }, v);
  v.rec.period = contractPeriod_(c);
  await writeJSON('scontract:' + c.id, { staff: v.rec });
  return mutateStaff_(function (rows) {
    const r = rows.find(function (x) { return x.id === g.r.id; }); if (!r) return { abort: true, ok: false, err: 'not_found' };
    r.contracts = contractsOf_(r).map(function (x) { if (x.id !== c.id) return x; x.digital = Object.assign({}, x.digital, { status: 'signed', staffSignedAt: v.rec.at, staffName: v.rec.name, leaderSignedAt: v.rec.at, leaderName: v.rec.leaderName, approvedBy: g.me.id }); return x; });
    r.updated = new Date().toISOString();
    return { ok: true, done: { [docId]: true }, staff: hrStaffOut_(r) };
  });
}
/* My contract (the ☰ menu, every staff member): their profile as HR sees it —
   time in YWAM, on each campus — their contracts and when to renew, and the
   legal documents with what they signed (here or in the portal). Read-only
   apart from their own start dates; contracts are HR's. */
async function myContract(username, pin) {
  let s = await verifyStaff_(username, pin);
  if (!s || isApplicant_(s)) return { ok: false };
  s = await syncPortalLegal_(s);
  return { ok: true, me: hrStaffOut_(s), legalDocs: (await legalDocs_()).map(function (d) { return { id: d.id, title: d.title }; }), required: requiredFor_(s, await getReqDocs_()) };
}
/* the PDFs: HR for anyone, a staff member for their own */
async function staffPdfGate_(username, pin, staffId) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { out: { ok: false } };
  const id = str_(staffId, 60) || s.id;
  if (id !== s.id && !canHR_(s)) return { out: { ok: false, err: 'not_authorized' } };
  const r = (await getStaff_()).find(function (x) { return x.id === id; });
  if (!r) return { out: { ok: false, err: 'not_found' } };
  return { s: s, r: r };
}
function pdfOut_(doc, rec, who) {
  const pdf = buildSignedPdf({ doc: doc, record: rec, teamName: who });
  const file = (doc.title + ' - ' + rec.name).replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
  return { ok: true, name: file, mime: 'application/pdf', dataUrl: 'data:application/pdf;base64,' + pdf.toString('base64') };
}
async function hrLegalPdf(username, pin, staffId, docId) {
  const g = await staffPdfGate_(username, pin, staffId); if (g.out) return g.out;
  let rec = ((await readJSON('ssign:' + g.r.id, { docs: {} })).docs || {})[str_(docId, 40)];
  const fromPortal = g.r.legal && g.r.legal[docId] && g.r.legal[docId].from === 'portal' ? g.r.legal[docId] : null;
  if (!rec && fromPortal) rec = ((await readJSON(signBlobKey_(fromPortal.candId, 'me'), { docs: {} })).docs || {})[str_(docId, 40)];
  if (!rec) return { ok: false, err: 'not_signed' };
  const doc = (await readJSON('legalSnap:' + rec.docHash, null)) || LEGAL_DOCS_DEFAULT.find(function (d) { return d.id === docId; });
  if (!doc) return { ok: false, err: 'no_doc' };
  return pdfOut_(doc, rec, 'YWAM Siem Reap staff');
}
async function hrContractPdf(username, pin, staffId, contractId) {
  const g = await staffPdfGate_(username, pin, staffId); if (g.out) return g.out;
  /* only a contract on this person's own record */
  if (!(g.r.contracts || []).some(function (c) { return c.id === contractId; })) return { ok: false, err: 'not_found' };
  const blob = await readJSON('scontract:' + str_(contractId, 60), {});
  if (!blob.staff) return { ok: false, err: 'not_signed' };
  const doc = (await readJSON('legalSnap:' + blob.staff.docHash, null)) || STAFF_CONTRACT;
  const rec = blob.staff;
  return pdfOut_(doc, rec, 'YWAM Siem Reap staff');
}
async function portalSignedPdf(username, pin, candidateId, key, docId) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  const c = a.cand;
  const rec = ((await readJSON(signBlobKey_(c.id, str_(key, 40)), { docs: {} })).docs || {})[str_(docId, 40)];
  if (!rec) return { ok: false, err: 'not_signed' };
  const doc = (await readJSON('legalSnap:' + rec.docHash, null)) || LEGAL_DOCS_DEFAULT.find(function (d) { return d.id === docId; });
  if (!doc) return { ok: false, err: 'no_doc' };
  const pdf = buildSignedPdf({ doc: doc, record: rec, teamName: teamTitle_(c) });
  const file = (doc.title + ' - ' + rec.name).replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
  return { ok: true, name: file, mime: 'application/pdf', dataUrl: 'data:application/pdf;base64,' + pdf.toString('base64') };
}
/* the documents, for the admin page: each with whether teams are asked to sign it */
async function portalLegalDocs(username, pin) {
  const g = await hrGate_(username, pin); if (g.out) return g.out;
  return { ok: true, canEdit: isPortalAdmin_(g.s), contacts: legalContacts_(await readJSON('legalDocs', {})), docs: (await legalDocs_(true)).map(function (d) { return { id: d.id, title: d.title, on: d.on, blocks: d.blocks, sign: d.sign || {} }; }) };
}
async function portalSaveLegalDocs(username, pin, on, contacts) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  const prev = await readJSON('legalDocs', {});
  const off = on && typeof on === 'object' ? LEGAL_DOCS_DEFAULT.map(function (d) { return d.id; }).filter(function (id) { return on[id] === false; }) : (Array.isArray(prev.off) ? prev.off : []);
  await writeJSON('legalDocs', { off: off, contacts: Array.isArray(contacts) ? legalContacts_({ contacts: contacts }) : legalContacts_(prev), updated: new Date().toISOString(), by: me.id });
  return portalLegalDocs(username, pin);
}
/* Staff-side writes on one record beyond the CRM's own: the visa flags the
   applicant watches for (flights confirmed, letter of invitation sent) and
   corrections to submitted answers. Same gate and scope as the CRM writes. */
async function portalStaffCand_(username, pin, candidateId) {
  const g = await hrGate_(username, pin); if (g.out) return g;
  const rows = await getCandidates_();
  const idx = rows.findIndex(function (r) { return r && r.id === str_(candidateId, 60); });
  if (idx === -1) return { out: { ok: false, err: 'not_found' } };
  if (!canHR_(g.s) && !portalMaySee_(g.s, rows[idx])) return { out: { ok: false, err: 'not_authorized' } };
  return { s: g.s, rows: rows, cand: rows[idx] };
}
/* ==================== e-visa info (per campus) ====================
   What the Cambodian e-visa form asks a visitor about us (organisation,
   address, phone, email, and any extra note) and the supporting documents
   that go with the letter of invitation. Portal admins keep it (☰ → E-visa
   info). A team sees it under its e-visa step once its letter of invitation
   is uploaded; anyone else once "Letter of invitation sent" is ticked
   (visaOpen_). The documents are big scans, so each is kept in parts
   ('vdoc:<id>:<n>', ≤ 3 MB of base64 each) and read part by part — one
   function call can't carry a 4 MB PDF. They live in Blobs, never in the
   repo (it is public). */
const VISA_INFO_DEFAULT = { siemreap: { org: 'University of the Nations', address: 'Trang Village Slorkrum Commune Siem Reap District, Siem Reap', phone: '+85595539520', email: 'info@ywamsiemreap.org', extra: '' } };
const VISA_DOCS_MAX = 12, VISA_DOC_PART_B64 = 3 * 1024 * 1024, VISA_DOC_PARTS_MAX = 8;
function visaCampus_(c) { return Object.prototype.hasOwnProperty.call(PORTAL_CAMPUSES, c) ? c : PORTAL_DEFAULT_CAMPUS; }
function visaOpen_(c) {
  if (!c || !needsVisa_(c)) return false;
  const v = (c.portal && c.portal.visa) || {};
  return c.type === 'team' ? (hasDoc_(c, 'invitation') || !!v.invitationSent) : !!v.invitationSent;
}
async function getVisaInfo_(campus) {
  campus = visaCampus_(campus);
  const saved = await readJSON('visaInfo:' + campus, null);
  const def = VISA_INFO_DEFAULT[campus] || {};
  const src = saved && saved.info ? saved.info : def;
  const info = { org: src.org || '', address: src.address || '', phone: src.phone || '', email: src.email || '', extra: src.extra || '' };
  return { campus: campus, info: info, docs: saved && Array.isArray(saved.docs) ? saved.docs : [], isDefault: !(saved && saved.info), updated: (saved && saved.updated) || null };
}
/* who is asking: staff with portal or HR access see every campus; an
   applicant only their own campus, and only once their visa part is open */
async function visaReader_(username, pin, campus) {
  const s = await verifyStaff_(username, pin, true);
  if (!s) return { out: { ok: false, err: 'auth' } };
  if (isApplicant_(s)) {
    const cand = await candidateFor_(await getCandidates_(), s);
    if (!cand || !visaOpen_(cand)) return { out: { ok: false, err: 'not_yet' } };
    return { s: s, campus: visaCampus_(cand.campus) };
  }
  if (!(canPortal_(s) || canHR_(s))) return { out: { ok: false, err: 'not_authorized' } };
  return { s: s, campus: visaCampus_(campus) };
}
async function visaAdmin_(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { out: { ok: false, err: 'auth' } };
  if (!isPortalAdmin_(s)) return { out: { ok: false, err: 'not_authorized' } };
  return { s: s };
}
async function portalVisaInfo(username, pin, campus) {
  const r = await visaReader_(username, pin, campus); if (r.out) return r.out;
  return Object.assign({ ok: true }, await getVisaInfo_(r.campus));
}
async function portalSaveVisaInfo(username, pin, campus, info) {
  const a = await visaAdmin_(username, pin); if (a.out) return a.out;
  campus = visaCampus_(campus); info = info && typeof info === 'object' ? info : {};
  const cut = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };
  const saved = (await readJSON('visaInfo:' + campus, null)) || {};
  saved.info = { org: cut(info.org, 160), address: cut(info.address, 300), phone: cut(info.phone, 60), email: cut(info.email, 120), extra: cut(info.extra, 2000) };
  saved.docs = Array.isArray(saved.docs) ? saved.docs : [];
  saved.updated = new Date().toISOString(); saved.by = a.s.id;
  await writeJSON('visaInfo:' + campus, saved);
  return Object.assign({ ok: true }, await getVisaInfo_(campus));
}
/* One part of a supporting document. Part 0 starts it (docId '') and gets
   its id back; the parts then come in order; the last one lists it. */
async function portalVisaDocPart(username, pin, campus, docId, name, mime, index, total, data) {
  const a = await visaAdmin_(username, pin); if (a.out) return a.out;
  campus = visaCampus_(campus);
  index = Number(index); total = Number(total);
  if (!(Number.isInteger(total) && total >= 1 && total <= VISA_DOC_PARTS_MAX && Number.isInteger(index) && index >= 0 && index < total)) return { ok: false, err: 'bad_part' };
  if (typeof data !== 'string' || !data || data.length > VISA_DOC_PART_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, err: 'bad_file' };
  let pend;
  if (index === 0) {
    if (str_(docId, 60)) return { ok: false, err: 'bad_part' };   // part 1 starts a new one; it has no id yet
    mime = str_(mime, 80);
    if (HR_FILE_MIME.indexOf(mime) === -1) return { ok: false, err: 'bad_type' };
    const cur = await readJSON('visaInfo:' + campus, null);
    if (cur && Array.isArray(cur.docs) && cur.docs.length >= VISA_DOCS_MAX) return { ok: false, err: 'too_many' };
    pend = { id: 'vd' + pinSalt_(), campus: campus, name: str_(name, 160) || 'document', mime: mime, total: total, next: 0, size: 0, by: a.s.id };
  } else {
    pend = await readJSON('vdocPending:' + str_(docId, 60), null);
    if (!pend || pend.campus !== campus || pend.total !== total || pend.by !== a.s.id) return { ok: false, err: 'not_found' };
  }
  if (pend.next !== index) return { ok: false, err: 'bad_part' };
  await writeJSON('vdoc:' + pend.id + ':' + index, { data: data });
  pend.next = index + 1; pend.size += Math.floor(data.length * 3 / 4);
  if (pend.next < total) { await writeJSON('vdocPending:' + pend.id, pend); return { ok: true, id: pend.id, done: false }; }
  const saved = (await readJSON('visaInfo:' + campus, null)) || {};
  saved.docs = (Array.isArray(saved.docs) ? saved.docs : []).concat([{ id: pend.id, name: pend.name, mime: pend.mime, size: pend.size, parts: total, added: new Date().toISOString(), by: a.s.id }]);
  saved.updated = new Date().toISOString(); saved.by = a.s.id;
  await writeJSON('visaInfo:' + campus, saved);
  try { await store().delete('vdocPending:' + pend.id); } catch (e) { /* only a marker */ }
  return Object.assign({ ok: true, id: pend.id, done: true }, await getVisaInfo_(campus));
}
async function portalVisaDocGet(username, pin, campus, docId, index) {
  const r = await visaReader_(username, pin, campus); if (r.out) return r.out;
  const info = await getVisaInfo_(r.campus);
  const doc = info.docs.filter(function (d) { return d.id === str_(docId, 60); })[0];
  if (!doc) return { ok: false, err: 'not_found' };
  index = Number(index) || 0;
  if (!(Number.isInteger(index) && index >= 0 && index < doc.parts)) return { ok: false, err: 'bad_part' };
  const part = await readJSON('vdoc:' + doc.id + ':' + index, null);
  if (!part || !part.data) return { ok: false, err: 'not_found' };
  return { ok: true, id: doc.id, name: doc.name, mime: doc.mime, parts: doc.parts, index: index, data: part.data };
}
async function portalVisaDocDelete(username, pin, campus, docId) {
  const a = await visaAdmin_(username, pin); if (a.out) return a.out;
  campus = visaCampus_(campus);
  const saved = (await readJSON('visaInfo:' + campus, null)) || {};
  const docs = Array.isArray(saved.docs) ? saved.docs : [];
  const doc = docs.filter(function (d) { return d.id === str_(docId, 60); })[0];
  if (!doc) return { ok: false, err: 'not_found' };
  saved.docs = docs.filter(function (d) { return d !== doc; });
  saved.updated = new Date().toISOString(); saved.by = a.s.id;
  await writeJSON('visaInfo:' + campus, saved);
  for (let i = 0; i < doc.parts; i++) { try { await store().delete('vdoc:' + doc.id + ':' + i); } catch (e) { /* the list is already clean */ } }
  return Object.assign({ ok: true }, await getVisaInfo_(campus));
}
async function portalSetVisaFlags(username, pin, candidateId, flags) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  flags = flags && typeof flags === 'object' ? flags : {};
  a.cand.portal = a.cand.portal || {};
  const visa = Object.assign({}, a.cand.portal.visa || {});
  if (flags.flightsConfirmed !== undefined) visa.flightsConfirmed = !!flags.flightsConfirmed;
  if (flags.invitationSent !== undefined) visa.invitationSent = !!flags.invitationSent;
  a.cand.portal.visa = visa;
  a.cand.updated = new Date().toISOString(); a.cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  const staffRows = await getStaff_(); const byId = {}; staffRows.forEach(function (r) { byId[r.id] = r; });
  return { ok: true, candidate: portalCandOut_(a.cand, byId) };
}
/* A staff tick on a team's journey (teamSteps_): the 1st call, the 2nd call
   (cultural orientation) and arrival. The calls are dated flags on the
   record and move the stage forward through teamAutoStage_; Arrived is the
   stage itself, and unticking it steps back to Getting ready. Every change
   is logged. */
async function portalTeamStep(username, pin, candidateId, step, done) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  const c = a.cand;
  if (c.type !== 'team') return { ok: false, err: 'not_team' };
  if (TEAM_TICKS.indexOf(step) === -1) return { ok: false, err: 'bad_step' };
  done = !!done;
  const now = new Date().toISOString();
  c.portal = c.portal || {};
  const label = { call1: '1st call', call2: '2nd call — cultural orientation', arrived: 'Arrived' }[step];
  c.log = (Array.isArray(c.log) ? c.log : []).concat([{ at: now, by: a.s.id, kind: 'note', text: (done ? '✓ ' : '✗ ') + label }]).slice(-CAND_LOG_MAX);
  if (step === 'arrived') {
    const before = c.stage;
    if (done) c.stage = 'arrived'; else if (c.stage === 'arrived') c.stage = 'practical';
    if (c.stage !== before) c.log = c.log.concat([{ at: now, by: a.s.id, kind: 'stage', text: c.stage }]).slice(-CAND_LOG_MAX);
  } else {
    const flags = Object.assign({}, teamFlags_(c));
    flags[step] = done ? now : null;
    c.portal.team = flags;
    teamAutoStage_(c, a.s.id);
  }
  c.updated = now; c.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  const staffRows = await getStaff_(); const byId = {}; staffRows.forEach(function (r) { byId[r.id] = r; });
  return { ok: true, candidate: portalCandOut_(c, byId) };
}
async function portalStaffSaveAnswers(username, pin, candidateId, answers) {
  const a = await portalStaffCand_(username, pin, candidateId); if (a.out) return a.out;
  const cand = a.cand;
  cand.portal = cand.portal || {};
  const form = (await getForms_())[formKeyOf_(cand)];
  const clean = cleanAnswers_(answers, form, audienceOf_(cand));
  const now = new Date().toISOString();
  if (cand.portal.submittedAt) { cand.portal.form = Object.assign({}, cand.portal.form || {}, { answers: clean, editedAt: now, editedBy: a.s.id }); }
  else { cand.portal.draft = clean; cand.portal.draftAt = now; }
  cand.log = (Array.isArray(cand.log) ? cand.log : []).concat([{ at: now, by: a.s.id, kind: 'note', text: 'Edited the application answers' }]).slice(-CAND_LOG_MAX);
  cand.updated = now; cand.updatedBy = a.s.id;
  await writeJSON('candidates', a.rows);
  await syncTeamTrip_(cand, a.s.id);
  const staffRows = await getStaff_(); const byId = {}; staffRows.forEach(function (r) { byId[r.id] = r; });
  return { ok: true, candidate: portalCandOut_(cand, byId) };
}

/* Delete an application and the applicant account behind it — a duplicate
   sign-up, a test account, someone who asked to be forgotten. Portal admins
   (and app admins) only; permanent. Applicant accounts are not in Admin →
   Accounts, so this is the one place they can be removed. A candidate whose
   staffId points at a real staff account (someone who arrived and got an
   account) loses only the CRM record — a staff account is never deleted here. */
async function portalDeleteApplicant(username, pin, candidateId) {
  const me = await verifyStaff_(username, pin);
  if (!me) return { ok: false };
  if (!isPortalAdmin_(me)) return { ok: false, err: 'not_authorized' };
  const rows = await getCandidates_();
  const idx = rows.findIndex(function (r) { return r && r.id === str_(candidateId, 60); });
  if (idx === -1) return { ok: false, err: 'not_found' };
  const cand = rows[idx];
  const docs = (cand.portal && Array.isArray(cand.portal.docs)) ? cand.portal.docs : [];
  for (const d of docs) { if (d && d.id) { try { await store().delete('pdoc:' + d.id); } catch (e) { /* already gone */ } try { await store().delete('hrfile:' + d.id); } catch (e) { /* already gone */ } } }
  rows.splice(idx, 1);
  await writeJSON('candidates', rows);
  /* a team: its row in the Teams Database is cancelled, so it stops counting
     and SR Hospitality shows any beds still booked for it as cancelled */
  if (cand.type === 'team') {
    const trips = await getTeamTripsRaw_();
    const tr = trips.find(function (r) { return r && r.candidateId === cand.id && !r.deleted; });
    if (tr && tr.status !== 'cancelled') { tr.status = 'cancelled'; tr.updated = new Date().toISOString(); tr.updatedBy = me.id; await writeJSON('teamTrips', trips); }
  }
  let accountRemoved = false;
  if (cand.staffId) {
    const out = await mutateStaff_(function (all) {
      const i = all.findIndex(function (r) { return r.id === cand.staffId; });
      if (i === -1 || !isApplicant_(all[i])) return { abort: true, ok: true, removed: false };
      all.splice(i, 1);
      return { ok: true, removed: true };
    });
    accountRemoved = !!(out && out.removed);
  }
  const boot = await portalBoot(username, pin);
  return Object.assign({}, boot, { deleted: cand.id, accountRemoved: accountRemoved });
}
async function portalUpdateContact(username, pin, payload) {
  const s = await verifyStaff_(username, pin, true);
  if (!s || !isApplicant_(s)) return { ok: false, err: 'auth' };
  payload = payload && typeof payload === 'object' ? payload : {};
  const phone = cleanPhone_(payload.phone);
  if (!phone) return { ok: false, err: 'phone_required' };
  const messenger = PORTAL_MESSENGERS.indexOf(payload.messenger) > -1 ? payload.messenger : '';
  if (!messenger) return { ok: false, err: 'messenger_required' };
  const country = payload.country !== undefined ? cleanCountry_(payload.country) : s.country;
  const out = await mutateStaff_(function (rows) {
    const idx = rows.findIndex(function (r) { return r.id === s.id; });
    if (idx === -1) return { abort: true, ok: false, err: 'not_found' };
    rows[idx].phone = phone; rows[idx].messenger = messenger; rows[idx].country = country;
    rows[idx].updated = new Date().toISOString();
    return { ok: true };
  });
  if (!out || !out.ok) return out || { ok: false };
  const cands = await getCandidates_();
  const cand = await candidateFor_(cands, s);
  if (cand) {
    cand.phone = phone; cand.messenger = messenger; cand.country = country; cand.updated = new Date().toISOString(); cand.updatedBy = s.id;
    await writeJSON('candidates', cands);
  }
  return portalBoot(username, pin);
}

/* ==================== dispatcher ==================== */
/* ==================== loose ends (Admin) ====================
   The small gaps that quietly make the base's totals wrong, on one page
   (Admin → Loose ends). The page builds the list — the department / ministry
   structure lives in taxonomy.js, not here — from the facts this returns: who is
   set to enter each ministry's numbers, the last week each ministry has numbers
   for this year, when each person last opened the app, and this quarter's
   objectives with when they were last edited.

   lastSeen: { started, seen: { staffId: 'YYYY-MM-DD' } }, written by markSeen —
   its own call, which the page makes at most once a day after a good boot (the
   boot itself writes nothing, on purpose; test-boot.mjs holds it to that), so "not opened in 30 days"
   means something only 30 days after 'started' — the page says so until then. A
   lost write when two people open the app at once only costs a day. Only the
   date: never what they did. */
async function touchLastSeen_(s) {
  const today = baseToday_();
  const rec = await readJSON('lastSeen', {});
  const seen = (rec.seen && typeof rec.seen === 'object') ? rec.seen : {};
  if (seen[s.id] === today) return;
  seen[s.id] = today;
  await writeJSON('lastSeen', { started: rec.started || today, seen: seen });
}
async function markSeen(username, pin) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  await touchLastSeen_(s);
  return { ok: true };
}
async function adminLooseEnds(username, pin) {
  const s = await adminGate_(username, pin);
  if (!s) return { ok: false, err: 'not_authorized' };
  const [np, entries, okrs, seenRec] = await Promise.all([getNumbersPeople_(), getEntries_(), getOkrs_(), readJSON('lastSeen', {})]);
  /* Numbers are keyed by week, so they are read in this week's year; objectives
     have no year of their own (yearOf_ reads their edit stamp) and go by the
     calendar quarter, so they keep the calendar year. */
  const yr = currentYear_(), today = baseToday_(), wk = isoWeek_(today), wkYr = weekYear_(today);
  const lastWeek = {};
  entries.forEach(function (r) {
    if (yearOf_(r) !== wkYr || r.value === null || r.value === undefined) return;
    const k = r.campus + '|' + r.dept + '|' + r.ministry, w = Number(r.week);
    if (w <= wk && !(lastWeek[k] >= w)) lastWeek[k] = w;
  });
  const people = {};
  Object.keys(np).forEach(function (k) { people[k] = { main: np[k].main || '', backup: np[k].backup || '' }; });
  const quarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const objectives = {};
  okrs.forEach(function (r) {
    if (yearOf_(r) !== yr || Number(r.quarter) !== quarter) return;
    const k = r.campus + '|' + r.dept + '|' + r.id;
    const o = objectives[k] || (objectives[k] = { campus: r.campus, dept: r.dept, objective: r.objective, updated: '', fed: false });
    if ((r.updated || '') > o.updated) o.updated = r.updated || '';
    if (r.metricKey) o.fed = true;   // fed by a ministry's numbers: it moves without anyone editing it
  });
  return {
    ok: true, today: today, week: wk, quarter: quarter, lastWeek: lastWeek, people: people,
    seenSince: seenRec.started || '', seen: (seenRec.seen && typeof seenRec.seen === 'object') ? seenRec.seen : {},
    objectives: Object.keys(objectives).map(function (k) { return objectives[k]; })
  };
}

/* ==================== ministry tools: numbers as a by-product ====================
   Uriah (Oct 2026): My Ministry should be a tool each ministry actually uses —
   the numbers fall out of it instead of being typed. Two to start: Campus
   Leadership's "My week" and the Cafe. Each keeps its own records, and after
   every change works out that week's totals and writes them into `entries`
   with by:'tool:<name>' (toolSync_), so the Base dashboard, the roll-ups and
   My Ministry's Numbers tab all read them like any logged week. A week the
   tool has nothing for is never touched; when a week's last record goes, only
   the rows the tool wrote are cleared — a number someone typed stays. */
async function toolSync_(campus, dept, ministry, week, values, tag, year) {
  const rows = await getEntries_(), yr = finiteNum_(year, YEAR_MIN, YEAR_MAX) || yearForWeek_(week);
  const updates = Object.keys(values).map(function (metric) {
    const v = values[metric];
    if (v !== null) return { metric: metric, value: v };
    const had = rows.find(function (r) { return r.campus === campus && r.dept === dept && r.ministry === ministry && r.metric === metric &&
      String(r.week) === String(week) && yearOf_(r) === yr; });
    return (had && had.by === tag) ? { metric: metric, value: null } : null;
  }).filter(Boolean);
  if (updates.length) await saveMinistryInternal_(campus, dept, ministry, week, updates, tag, yr);
}
function toolId_(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function toolDate_(v) { const d = isoDate_(v); if (!d) return ''; const t = Date.parse(d + 'T00:00:00Z'), now = Date.now();
  return (t > now + 2 * 86400000 || t < now - 120 * 86400000) ? '' : d; }

/* ---------- Campus Leadership: My week ----------
   A leader's week as it happens: tap what you did (a one-on-one and with whom,
   a partner you connected with, where you spoke, hours sharing the gospel, a
   teaching prepped, a meeting led), and the leadership numbers count it. The
   Campus Director also keeps the week's three ratings, partners and the base
   plants being prayed about and planned. */
const LEAD_KINDS = { oneonone: 'One-on-Ones Held', partner: 'Partner Connections', church: 'Spoke at Churches', base: 'Spoke at YWAM Bases',
  gospel: 'Hours Sharing the Gospel', deptmeeting: 'Department Meetings Held', teaching: 'Teachings Prepped', meeting: 'Meetings Led' };
const LEAD_RATINGS = { vision: 'Base Vision (1-10)', comms: 'Communications (1-10)', partners: 'Partner Relationships (1-10)' };
const PLANT_STAGES = ['praying', 'exploring', 'planning', 'preparing', 'launched'];
const LEAD_DIRECTOR = 'Campus Director';
function canLeadTool_(s) { return !!(s && s.dept === 'Campus Leadership' && s.ministry); }
/* `year` is the week year of `week` — the log rows carry it, so a week is synced
   into the year it belongs to whenever the change is made. */
async function leadSync_(s, week, year) {
  const yr = year;
  const mine = (await readJSON('leadLog', [])).filter(function (r) { return r.campus === s.campus && r.ministry === s.ministry && Number(r.week) === week && Number(r.year) === yr; });
  const vals = {};
  Object.keys(LEAD_KINDS).forEach(function (k) {
    const n = mine.filter(function (r) { return r.kind === k; }).reduce(function (a, r) { return a + (Number(r.qty) || 1); }, 0);
    vals[LEAD_KINDS[k]] = mine.length ? Math.round(n * 100) / 100 : null;
  });
  if (s.ministry === LEAD_DIRECTOR) {
    const rf = (await readJSON('leadReflect', [])).find(function (r) { return r.campus === s.campus && r.ministry === s.ministry && Number(r.week) === week && Number(r.year) === yr; });
    Object.keys(LEAD_RATINGS).forEach(function (k) { vals[LEAD_RATINGS[k]] = rf && rf[k] ? rf[k] : null; });
    const plants = (await readJSON('basePlants', [])).filter(function (p) { return p.campus === s.campus && p.stage !== 'launched'; });
    if (week === isoWeek_(baseToday_()) && yr === thisWeekYear_()) vals['Base Plants in Planning'] = plants.length;
  }
  await toolSync_(s.campus, 'Campus Leadership', s.ministry, week, vals, 'tool:lead', yr);
}
async function leadWeek(username, pin, week) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canLeadTool_(s)) return { ok: false, err: 'not_leadership' };
  const asked = finiteNum_(week, 1, 52);
  const wk = asked || isoWeek_(baseToday_()), yr = asked ? yearForWeek_(asked) : thisWeekYear_();
  const log = (await readJSON('leadLog', [])).filter(function (r) { return r.staffId === s.id && Number(r.week) === wk && Number(r.year) === yr; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at < b.at ? -1 : 1); });
  const rf = (await readJSON('leadReflect', [])).find(function (r) { return r.staffId === s.id && Number(r.week) === wk && Number(r.year) === yr; }) || null;
  const partners = (await readJSON('leadPartners', [])).filter(function (p) { return p.staffId === s.id; }).sort(function (a, b) { return (a.last || '') < (b.last || '') ? -1 : 1; });
  const director = s.ministry === LEAD_DIRECTOR || !!s.isAdmin;
  const plants = director ? (await readJSON('basePlants', [])).filter(function (p) { return p.campus === s.campus; }) : [];
  return { ok: true, week: wk, ministry: s.ministry, director: s.ministry === LEAD_DIRECTOR, log: log, reflect: rf, partners: partners, plants: plants };
}
async function leadLogAdd(username, pin, entry) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canLeadTool_(s)) return { ok: false, err: 'not_leadership' };
  const e = entry && typeof entry === 'object' ? entry : {};
  if (!LEAD_KINDS[e.kind]) return { ok: false, err: 'bad_kind' };
  const date = toolDate_(e.date || new Date().toISOString().slice(0, 10));
  if (!date) return { ok: false, err: 'bad_date' };
  const qty = e.kind === 'gospel' ? finiteNum_(e.qty, 0.25, 24) : 1;
  if (qty == null) return { ok: false, err: 'bad_hours' };
  const wk = isoWeek_(date), yr = weekYear_(date);
  const row = { id: toolId_('ll'), staffId: s.id, campus: s.campus, ministry: s.ministry, date: date, week: wk, year: yr, kind: e.kind, qty: qty,
    who: str_(e.who, 60) || '', whoName: str_(e.whoName, 80) || '', note: str_(e.note, 200) || '', at: new Date().toISOString() };
  const rows = await readJSON('leadLog', []); rows.push(row); await writeJSON('leadLog', rows);
  if (e.kind === 'partner' && row.who) {
    const ps = await readJSON('leadPartners', []), p = ps.find(function (x) { return x.id === row.who && x.staffId === s.id; });
    if (p && (!p.last || p.last < date)) { p.last = date; await writeJSON('leadPartners', ps); }
  }
  if (yr === thisWeekYear_()) await leadSync_(s, wk, yr);
  return leadWeek(username, pin, wk);
}
async function leadLogDelete(username, pin, id) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await readJSON('leadLog', []), hit = rows.find(function (r) { return r.id === id && r.staffId === s.id; });
  if (!hit) return { ok: false, err: 'not_found' };
  await writeJSON('leadLog', rows.filter(function (r) { return r !== hit; }));
  if (Number(hit.year) === thisWeekYear_()) await leadSync_(s, Number(hit.week), Number(hit.year));
  return leadWeek(username, pin, Number(hit.week));
}
async function leadReflectSave(username, pin, week, ratings) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canLeadTool_(s)) return { ok: false, err: 'not_leadership' };
  const wk = finiteNum_(week, 1, 52); if (wk == null) return { ok: false, err: 'bad_week' };
  const yr = yearForWeek_(wk), rows = await readJSON('leadReflect', []);
  let r = rows.find(function (x) { return x.staffId === s.id && Number(x.week) === wk && Number(x.year) === yr; });
  if (!r) { r = { staffId: s.id, campus: s.campus, ministry: s.ministry, week: wk, year: yr }; rows.push(r); }
  Object.keys(LEAD_RATINGS).forEach(function (k) { const v = finiteNum_(ratings && ratings[k], 1, 10); r[k] = v == null ? null : Math.round(v); });
  r.note = str_(ratings && ratings.note, 300) || ''; r.at = new Date().toISOString();
  await writeJSON('leadReflect', rows);
  await leadSync_(s, wk, yr);
  return leadWeek(username, pin, wk);
}
async function leadPartnerSave(username, pin, partner, week) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canLeadTool_(s)) return { ok: false, err: 'not_leadership' };
  const p = partner && typeof partner === 'object' ? partner : {};
  const name = str_(p.name, 80); if (!name) return { ok: false, err: 'no_name' };
  const rows = await readJSON('leadPartners', []);
  let hit = p.id ? rows.find(function (x) { return x.id === p.id && x.staffId === s.id; }) : null;
  if (p.id && !hit) return { ok: false, err: 'not_found' };
  if (!hit) { if (rows.filter(function (x) { return x.staffId === s.id; }).length >= 300) return { ok: false, err: 'too_many' };
    hit = { id: toolId_('lp'), staffId: s.id, campus: s.campus, created: new Date().toISOString(), last: '' }; rows.push(hit); }
  hit.name = name; hit.org = str_(p.org, 80) || ''; hit.notes = str_(p.notes, 300) || '';
  await writeJSON('leadPartners', rows);
  return leadWeek(username, pin, week);
}
async function leadPartnerDelete(username, pin, id, week) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  const rows = await readJSON('leadPartners', []);
  if (!rows.some(function (x) { return x.id === id && x.staffId === s.id; })) return { ok: false, err: 'not_found' };
  await writeJSON('leadPartners', rows.filter(function (x) { return !(x.id === id && x.staffId === s.id); }));
  return leadWeek(username, pin, week);
}
async function basePlantSave(username, pin, plant, week) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!(s.isAdmin || (s.dept === 'Campus Leadership' && s.ministry === LEAD_DIRECTOR))) return { ok: false, err: 'not_authorized' };
  const p = plant && typeof plant === 'object' ? plant : {};
  const rows = await readJSON('basePlants', []);
  let hit = p.id ? rows.find(function (x) { return x.id === p.id && x.campus === s.campus; }) : null;
  if (p.id && !hit) return { ok: false, err: 'not_found' };
  if (p.remove) { if (hit) await writeJSON('basePlants', rows.filter(function (x) { return x !== hit; })); }
  else {
    const name = str_(p.name, 80); if (!name) return { ok: false, err: 'no_name' };
    if (!hit) { hit = { id: toolId_('bp'), campus: s.campus }; rows.push(hit); }
    hit.name = name; hit.place = str_(p.place, 80) || ''; hit.stage = PLANT_STAGES.indexOf(p.stage) > -1 ? p.stage : 'praying';
    hit.notes = str_(p.notes, 300) || ''; hit.updated = new Date().toISOString(); hit.by = s.id;
    await writeJSON('basePlants', rows);
  }
  if (s.dept === 'Campus Leadership' && s.ministry === LEAD_DIRECTOR) await leadSync_(s, isoWeek_(baseToday_()), thisWeekYear_());
  return leadWeek(username, pin, week);
}

/* ---------- the Cafe: open, sell, close ----------
   A simple till and the day around it. Settings (menu, checklists, shifts,
   the rota) are cafe:<campus>; each day is its own blob cafeDay:<campus>:<date>
   — opened (and the opening list ticked), the orders, conversations and
   salvations, expenses, closed with the cash in the drawer — so a busy
   year never makes one blob heavy. Prices are the menu's, read on the server:
   the phone says what was sold, not what it cost. The week's numbers follow:
   Days Open, Cups Sold (items marked as a cup), Customers Served (orders),
   Gospel Conversations, Salvations, Weekly Expenses and Weekly Profit
   (takings less expenses). Total in Bank Account stays typed by hand. */
const CAFE_DEPT = 'Community Service', CAFE_MIN = 'Cafe';
const CAFE_DEFAULT = {
  menu: [
    { id: 'm1', name: 'Iced coffee', emoji: '🧋', price: 1.75, cup: true }, { id: 'm2', name: 'Hot coffee', emoji: '☕', price: 1.5, cup: true },
    { id: 'm3', name: 'Latte', emoji: '🥛', price: 2.25, cup: true }, { id: 'm4', name: 'Iced tea', emoji: '🍹', price: 1.25, cup: true },
    { id: 'm5', name: 'Smoothie', emoji: '🥤', price: 2.5, cup: true }, { id: 'm6', name: 'Pastry', emoji: '🥐', price: 1.5, cup: false }
  ],
  open: ['Unlock and turn on the lights and fans', 'Turn on the coffee machine and grinder', 'Check milk, ice, cups and lids', 'Count the cash float', 'Pray together for today'],
  close: ['Clean the coffee machine and grinder', 'Wash cups, jugs and tools', 'Wipe tables and sweep', 'Take out the rubbish', 'Count the cash and lock the drawer', 'Turn off the machines, lights and fans'],
  shifts: ['Morning', 'Afternoon'], roster: {}, till: 'app'
};
function canCafe_(s) { return !!(s && canLogFor_(s, s.campus, CAFE_DEPT, CAFE_MIN)); }
function canCafeSetup_(s) { return !!(s && (s.isAdmin || isLeaderOf_(s, CAFE_DEPT, CAFE_MIN))); }
async function cafeSettings_(campus) {
  const v = await readJSON('cafe:' + campus, null);
  return v && typeof v === 'object' && !Array.isArray(v) ? Object.assign({}, CAFE_DEFAULT, v) : JSON.parse(JSON.stringify(CAFE_DEFAULT));
}
function cafeDayBlank_(date) { return { date: date, opened: null, closed: null, orders: [], gospel: 0, salvations: 0, expenses: [], pos: null }; }
async function cafeDay_(campus, date) {
  const v = await readJSON('cafeDay:' + campus + ':' + date, null);
  return v && typeof v === 'object' && !Array.isArray(v) ? Object.assign(cafeDayBlank_(date), v) : cafeDayBlank_(date);
}
function cafeDayTotals_(d) {
  const cups = d.orders.reduce(function (a, o) { return a + o.items.reduce(function (b, i) { return b + (i.cup ? i.qty : 0); }, 0); }, 0);
  const takings = d.orders.reduce(function (a, o) { return a + (Number(o.total) || 0); }, 0);
  const spent = d.expenses.reduce(function (a, e) { return a + (Number(e.amount) || 0); }, 0);
  const pos = d.pos || {};   // the day's totals typed from HangPopok, when that is the till
  const touched = !!(d.opened || d.orders.length || d.gospel || d.salvations || d.expenses.length || d.closed || d.pos);
  return { open: !!d.opened, cups: cups + (Number(pos.cups) || 0), customers: d.orders.length + (Number(pos.receipts) || 0),
    takings: Math.round((takings + (Number(pos.sales) || 0)) * 100) / 100, spent: Math.round(spent * 100) / 100,
    gospel: d.gospel || 0, salvations: d.salvations || 0, touched: touched };
}
function weekDates_(date) {
  const d = new Date(date + 'T00:00:00Z'), mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000), out = [];
  for (let i = 0; i < 7; i++) out.push(new Date(mon.getTime() + i * 86400000).toISOString().slice(0, 10));
  return out;
}
async function cafeWeek_(campus, date) {
  const dates = weekDates_(date);
  const days = await Promise.all(dates.map(function (d) { return cafeDay_(campus, d); }));
  return days.map(function (d) { const t = cafeDayTotals_(d); t.date = d.date; t.best = {};
    d.orders.forEach(function (o) { o.items.forEach(function (i) { t.best[i.name] = (t.best[i.name] || 0) + i.qty; }); }); return t; });
}
async function cafeSync_(campus, date) {
  /* Only this week year's numbers follow the till, as before — compared as week
     years, so a day from 28–31 December still reaches week 1 when it is edited on
     2 January. */
  const yr = weekYear_(date);
  if (yr !== thisWeekYear_()) return;
  const wk = cafeWeekNo_(date), week = await cafeWeek_(campus, date);
  const used = week.some(function (d) { return d.touched; });
  const sum = function (k) { return week.reduce(function (a, d) { return a + d[k]; }, 0); };
  const r2 = function (n) { return Math.round(n * 100) / 100; };
  await toolSync_(campus, CAFE_DEPT, CAFE_MIN, wk, {
    'Days Open': used ? week.filter(function (d) { return d.open; }).length : null,
    'Cups Sold': used ? sum('cups') : null,
    'Customers Served': used ? sum('customers') : null,
    'Gospel Conversations': used ? sum('gospel') : null,
    'Salvations': used ? sum('salvations') : null,
    'Weekly Expenses ($)': used ? r2(sum('spent')) : null,
    'Weekly Profit ($)': used ? r2(sum('takings') - sum('spent')) : null
  }, 'tool:cafe', yr);
}
function cafeWeekNo_(date) { return isoWeek_(date); }
async function cafeAnswer_(s, date) {
  const settings = await cafeSettings_(s.campus);
  return { ok: true, date: date, settings: settings, day: await cafeDay_(s.campus, date), week: await cafeWeek_(s.campus, date),
    canSetup: canCafeSetup_(s), weekNo: cafeWeekNo_(date) };
}
async function cafeGet(username, pin, date) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canCafe_(s)) return { ok: false, err: 'not_authorized' };
  const d = toolDate_(date || new Date().toISOString().slice(0, 10)); if (!d) return { ok: false, err: 'bad_date' };
  return cafeAnswer_(s, d);
}
/* One change to one day: read it, change it, write it, then the week's numbers. */
async function cafeDayChange_(username, pin, date, fn) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canCafe_(s)) return { ok: false, err: 'not_authorized' };
  const d = toolDate_(date); if (!d) return { ok: false, err: 'bad_date' };
  const day = await cafeDay_(s.campus, d), settings = await cafeSettings_(s.campus);
  const res = fn(day, settings, s);
  if (res && res.err) return { ok: false, err: res.err };
  await writeJSON('cafeDay:' + s.campus + ':' + d, day);
  await cafeSync_(s.campus, d);
  return cafeAnswer_(s, d);
}
function cafeTicks_(list, n) { return (Array.isArray(list) ? list : []).map(Number).filter(function (i) { return i >= 0 && i < n; }).slice(0, 60); }
function cafeOpen(username, pin, date, done) {
  return cafeDayChange_(username, pin, date, function (day, st, s) { day.opened = { at: new Date().toISOString(), by: s.id, done: cafeTicks_(done, st.open.length) }; });
}
function cafeClose(username, pin, date, done, cash) {
  return cafeDayChange_(username, pin, date, function (day, st, s) {
    const c = cash === '' || cash == null ? null : finiteNum_(cash, 0, 1e6);
    if (cash !== '' && cash != null && c == null) return { err: 'bad_cash' };
    day.closed = { at: new Date().toISOString(), by: s.id, done: cafeTicks_(done, st.close.length), cash: c };
  });
}
function cafeReopen(username, pin, date) {
  return cafeDayChange_(username, pin, date, function (day) { day.closed = null; });
}
function cafeSale(username, pin, date, items) {
  return cafeDayChange_(username, pin, date, function (day, st, s) {
    const menu = {}; st.menu.forEach(function (m) { menu[m.id] = m; });
    const lines = (Array.isArray(items) ? items : []).map(function (i) { const m = menu[i && i.id], q = finiteNum_(i && i.qty, 1, 99);
      return m && q ? { id: m.id, name: m.name, price: Number(m.price) || 0, qty: Math.round(q), cup: !!m.cup } : null; }).filter(Boolean).slice(0, 40);
    if (!lines.length) return { err: 'empty' };
    if (day.orders.length >= 2000) return { err: 'too_many' };
    const total = Math.round(lines.reduce(function (a, l) { return a + l.price * l.qty; }, 0) * 100) / 100;
    day.orders.push({ id: toolId_('co'), at: new Date().toISOString(), by: s.id, items: lines, total: total });
  });
}
function cafeVoid(username, pin, date, orderId) {
  return cafeDayChange_(username, pin, date, function (day) {
    const n = day.orders.length; day.orders = day.orders.filter(function (o) { return o.id !== orderId; });
    if (day.orders.length === n) return { err: 'not_found' };
  });
}
function cafeCount(username, pin, date, kind, delta) {
  return cafeDayChange_(username, pin, date, function (day) {
    if (kind !== 'gospel' && kind !== 'salvations') return { err: 'bad_kind' };
    const d = delta === -1 ? -1 : 1; day[kind] = Math.max(0, (Number(day[kind]) || 0) + d);
  });
}
function cafeExpense(username, pin, date, amount, note, removeId) {
  return cafeDayChange_(username, pin, date, function (day, st, s) {
    if (removeId) { const n = day.expenses.length; day.expenses = day.expenses.filter(function (e) { return e.id !== removeId; }); if (day.expenses.length === n) return { err: 'not_found' }; return; }
    const a = finiteNum_(amount, 0.01, 1e5); if (a == null) return { err: 'bad_amount' };
    day.expenses.push({ id: toolId_('ce'), amount: Math.round(a * 100) / 100, note: str_(note, 120) || '', at: new Date().toISOString(), by: s.id });
  });
}
async function cafeSaveSettings(username, pin, patch, date) {
  const s = await verifyStaff_(username, pin);
  if (!s) return { ok: false };
  if (!canCafe_(s)) return { ok: false, err: 'not_authorized' };
  const st = await cafeSettings_(s.campus), p = patch && typeof patch === 'object' ? patch : {};
  if (p.roster) {   // anyone on the cafe team may fill in the rota
    const wk = str_(p.roster.week, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(wk || '')) return { ok: false, err: 'bad_week' };
    const cells = {}; Object.keys(p.roster.cells || {}).slice(0, 100).forEach(function (k) {
      if (/^\d{1,2}\|\d$/.test(k)) cells[k] = (Array.isArray(p.roster.cells[k]) ? p.roster.cells[k] : []).map(function (x) { return str_(x, 60); }).filter(Boolean).slice(0, 8); });
    st.roster = Object.assign({}, st.roster || {}); st.roster[wk] = cells;
    Object.keys(st.roster).sort().slice(0, -12).forEach(function (k) { delete st.roster[k]; });   // a quarter of weeks is plenty
  }
  if (p.menu || p.open || p.close || p.shifts || p.till) {
    if (!canCafeSetup_(s)) return { ok: false, err: 'not_leader' };
    if (p.menu) st.menu = (Array.isArray(p.menu) ? p.menu : []).map(function (m) { const name = str_(m && m.name, 40), price = finiteNum_(m && m.price, 0, 1000);
      return name && price != null ? { id: str_(m.id, 30) || toolId_('m'), name: name, emoji: str_(m.emoji, 8) || '☕', price: Math.round(price * 100) / 100, cup: m.cup !== false } : null; }).filter(Boolean).slice(0, 40);
    ['open', 'close'].forEach(function (k) { if (p[k]) st[k] = (Array.isArray(p[k]) ? p[k] : []).map(function (x) { return str_(x, 120); }).filter(Boolean).slice(0, 30); });
    if (p.till) st.till = p.till === 'hangpopok' ? 'hangpopok' : 'app';
    if (p.shifts) st.shifts = (Array.isArray(p.shifts) ? p.shifts : []).map(function (x) { return str_(x, 30); }).filter(Boolean).slice(0, 6);
  }
  await writeJSON('cafe:' + s.campus, st);
  return cafeAnswer_(s, toolDate_(date) || new Date().toISOString().slice(0, 10));
}

/* The cafe's till may be HangPopok (a Cambodian cloud POS with no public API
   yet): at closing someone copies the day's totals from its daily report —
   sales, receipts and cups — and they count exactly like sales made here. */
function cafePos(username, pin, date, totals) {
  return cafeDayChange_(username, pin, date, function (day, st, s) {
    const x = totals && typeof totals === 'object' ? totals : {};
    const blank = function (v) { return v === '' || v == null; };
    const sales = blank(x.sales) ? null : finiteNum_(x.sales, 0, 1e6), receipts = blank(x.receipts) ? null : finiteNum_(x.receipts, 0, 1e5),
      cups = blank(x.cups) ? null : finiteNum_(x.cups, 0, 1e5);
    if ((!blank(x.sales) && sales == null) || (!blank(x.receipts) && receipts == null) || (!blank(x.cups) && cups == null)) return { err: 'bad_number' };
    day.pos = (sales == null && receipts == null && cups == null) ? null
      : { sales: sales == null ? null : Math.round(sales * 100) / 100, receipts: receipts == null ? null : Math.round(receipts), cups: cups == null ? null : Math.round(cups),
          at: new Date().toISOString(), by: s.id };
  });
}

/* ---- Campus Leadership: the Tuesday morning meeting ----
   Who facilitates, who translates, the topics to hit and the announcements,
   one entry per Tuesday, on the leadership board's own doc (so the same people
   see it). A person is someone on the leadership team by id, or a typed name
   for a guest. */
function tuesPerson_(p, ids) {
  const id = str_(p && p.id, 60) || '';
  if (id) return ids[id] ? { id: id, name: '' } : null;
  const name = str_(p && p.name, 60) || '';
  return name ? { id: '', name: name } : null;
}
async function saveLeadTuesday(username, pin, m) {
  const a = await leadAuth_(username, pin); if (a.out) return a.out;
  const x = m && typeof m === 'object' ? m : {};
  const date = isoDate_(x.date);
  if (!date || new Date(date + 'T12:00:00Z').getUTCDay() !== 2) return { ok: false, err: 'bad_date' };
  /* who can be picked: the leadership team (Campus Leadership on this campus) — and whoever
     was already set for this Tuesday, so editing the topics never drops an earlier pick */
  const ids = {}; (await getStaff_()).forEach(function (p) { if (p.campus === a.campus && p.active !== false && !isApplicant_(p) && deptOf_(p) === LEADERSHIP_DEPT) ids[p.id] = 1; });
  const d = await getLeadDoc_(a.campus);
  const prev = d.tues.filter(function (t) { return t.date === date; })[0];
  if (prev) ['facilitator', 'translator'].forEach(function (k) { if (prev[k] && prev[k].id) ids[prev[k].id] = 1; });
  const lines = function (v, max) { return (Array.isArray(v) ? v : []).map(function (t) { return str_(t, max); }).filter(Boolean).slice(0, 15); };
  const rec = { date: date, facilitator: tuesPerson_(x.facilitator, ids), translator: tuesPerson_(x.translator, ids),
    topics: lines(x.topics, 160), announcements: lines(x.announcements, 200),
    updated: new Date().toISOString(), by: a.s.id };
  d.tues = d.tues.filter(function (t) { return t.date !== date; });
  if (rec.facilitator || rec.translator || rec.topics.length || rec.announcements.length) d.tues.push(rec);
  const cutoff = new Date(Date.now() - 182 * 86400000).toISOString().slice(0, 10);   // half a year back is plenty
  d.tues = d.tues.filter(function (t) { return t.date >= cutoff; }).sort(function (p, q) { return p.date < q.date ? -1 : 1; }).slice(-80);
  await writeJSON(leadKey_(a.campus), d);
  return leadOut_(a.campus, d);
}

/* ---- Campus Leadership: the money ahead ----
   The leadership code's own tier, exactly like SENSITIVE on the dashboard:
   the latest Base Finances and Cash Reserve, and a month-by-month projection
   of income and spending. Without the code there is nothing here at all. */
async function finProjGet(code, campus) {
  if (!isLeader_(code)) return { ok: false, err: 'not_leader' };
  const c = HR_CAMPUSES.indexOf(campus) > -1 ? campus : null; if (!c) return { ok: false, err: 'bad_campus' };
  const latest = {};
  (await getEntries_()).forEach(function (r) {
    if (r.campus !== c || SENSITIVE.indexOf(r.metric) === -1) return;
    const v = Number(r.value); if (r.value === '' || r.value == null || isNaN(v)) return;
    const k = (Number(r.year) || 0) * 100 + (Number(r.week) || 0);
    if (!latest[r.metric] || k > latest[r.metric].k) latest[r.metric] = { k: k, value: v, week: Number(r.week), year: Number(r.year) };
  });
  Object.keys(latest).forEach(function (m) { delete latest[m].k; });
  const p = await readJSON('finProj:' + c, {});
  return { ok: true, campus: c, latest: latest, months: (p && p.months) || {}, updated: (p && p.updated) || '' };
}
async function finProjSave(code, campus, months) {
  if (!isLeader_(code)) return { ok: false, err: 'not_leader' };
  const c = HR_CAMPUSES.indexOf(campus) > -1 ? campus : null; if (!c) return { ok: false, err: 'bad_campus' };
  const m = months && typeof months === 'object' ? months : {}, out = {};
  Object.keys(m).slice(0, 36).forEach(function (k) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)) return;
    const v = m[k] || {}, blank = function (x) { return x === '' || x == null; };
    const inc = blank(v.inc) ? null : finiteNum_(v.inc, 0, 1e8), exp = blank(v.exp) ? null : finiteNum_(v.exp, 0, 1e8);
    if (inc == null && exp == null) return;
    out[k] = { inc: inc == null ? null : Math.round(inc), exp: exp == null ? null : Math.round(exp) };
  });
  await writeJSON('finProj:' + c, { months: out, updated: new Date().toISOString() });
  return finProjGet(code, c);
}

/* ---- The Library's recorded audio ----
   Recorded by scripts/record-library-audio.mjs (not from the app); this only says
   which books have it — for every reader, guests too (the books are open to all). */
async function libAudioIndex() { return { ok: true, index: publicIndex(await readIndex(audioStore())) }; }

/* ==================== YWAM GP: titles, YWAM GP roles and the advisory board ====================
   Oct 2026 (Uriah). Four parts to YWAM GP now: YWAM Poipet, YWAM Siem Reap, YWAM GP (the
   whole organisation) and the YWAM GP Advisory Board.
   - Campus Leadership titles. The department stays as it is (its ministries are the
     Campus Director row and one row per department — the join keys for its
     numbers), and a title is read off it: an admin marks a Campus Director as the
     International or the National one (`cdKind`); everyone else on the team is
     "Director of <their department>" (`orgTitle_`).
   - YWAM GP roles: a staff member can hold an organisation-wide role on top of their
     campus one (`gpRole`, admin-set): YWAM GP's leadership team is its Director(s) and a lead
     for each of five areas — Campuses, Leaders, Music, Media, Education (GP_ROLES).
   - The advisory board is NOT staff and is kept out of the staff store altogether,
     so nobody on it ever shows up in a roster, a headcount, health, the org chart or
     any campus list. Each member has a role (President, Secretary, Treasurer,
     Advisor, or another), a photo, a short bio and how to reach them — every staff
     member can see the board and contact it (Uriah: so people know who they are and
     how to reach them, e.g. for a serious allegation). A serious concern goes only to the
     members an admin marks as safeguarding contacts (`safeguarding`) — ideally people not
     on staff, since GP's own leaders sit on the board. A member who is also staff is
     linked (`staffId`) and uses their staff login; anyone else gets their own
     username + PIN for a board-only view of both campuses (`boardLogin`).
   Served by `getYwamGp`, not by teamRoster or staffProfile, which stay as they are. */
const CD_KINDS = ['international', 'national'];
const GP_ROLE_IDS = ['director', 'campuses', 'leaders', 'music', 'media', 'education'];
const CAMPUS_IDS_ = ['poipet', 'siemreap'];
const BOARD_ROLES = ['President', 'Secretary', 'Treasurer', 'Advisor'];
const BOARD_PHOTO_MAX_B64 = 160 * 1024;
function orgTitle_(s) {
  if (!s || deptOf_(s) !== LEADERSHIP_DEPT) return '';
  if (s.ministry === 'Campus Director') {
    return s.cdKind === 'international' ? 'International Campus Director'
      : s.cdKind === 'national' ? 'National Campus Director' : 'Campus Director';
  }
  return s.ministry ? 'Director of ' + s.ministry : '';
}
async function getBoard_() { return readJSON('board', []); }
/* The YWAM GP places someone holds — several are allowed (Oct 2026, Uriah: "select multiple
   positions … for me I'm on the board, YWAM GP & Siem Reap Leadership"). Kept as gpRoles;
   gpRole is the first of them, for anything that still reads one. */
function cleanGpRoles_(list) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach(function (g) { if (GP_ROLE_IDS.indexOf(g) > -1 && out.indexOf(g) === -1) out.push(g); });
  return out;
}
function gpRolesOf_(s) {
  if (!s) return [];
  if (Array.isArray(s.gpRoles)) return cleanGpRoles_(s.gpRoles);
  return GP_ROLE_IDS.indexOf(s.gpRole) > -1 ? [s.gpRole] : [];
}
/* A staff member's seat on the Advisory Board, set from their own account in Admin with
   their other positions: on → their linked board member (made if there isn't one, brought
   back if it was taken off) with this role; off → taken off the board (kept, inactive, so
   a bio and photo aren't lost). Admin → Advisory Board still edits the rest of it. */
async function setStaffBoardSeat_(staffId, seat) {
  const rows = await getBoard_();
  const i = rows.findIndex(function (b) { return b.staffId === staffId; });
  const role = ooText_(seat && seat.role, 40) || 'Advisor';
  if (seat && seat.on) {
    if (i > -1) Object.assign(rows[i], { role: role, active: true, updated: new Date().toISOString() });
    else rows.push({ id: 'bd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: new Date().toISOString(),
      name: '', role: role, email: '', phone: '', bio: '', photo: '', staffId: staffId, order: 0, active: true, safeguarding: false, updated: new Date().toISOString() });
  } else if (i > -1 && rows[i].active !== false) Object.assign(rows[i], { active: false, updated: new Date().toISOString() });
  else return;
  await writeJSON('board', rows);
}
function boardOut_(b, staff) {
  const st = b.staffId ? (staff || []).find(function (x) { return x.id === b.staffId && x.active !== false; }) : null;
  return { id: b.id, name: b.name || (st ? st.name : ''), role: b.role || 'Advisor', photo: b.photo || (st ? st.photo || '' : ''),
    bio: b.bio || '', email: b.email || (st ? st.email || '' : ''), phone: b.phone || '', staffId: b.staffId || '', order: Number(b.order) || 0,
    safeguarding: !!b.safeguarding };
}
function boardAdminOut_(b, staff) {
  return Object.assign(boardOut_(b, staff), { username: b.username || '', hasLogin: !!b.pinHash, active: b.active !== false });
}
function boardSort_(a, b) {
  const ra = BOARD_ROLES.indexOf(a.role), rb = BOARD_ROLES.indexOf(b.role);
  const x = ra === -1 ? 3.5 : ra, y = rb === -1 ? 3.5 : rb;
  return x - y || (a.order - b.order) || String(a.name).localeCompare(String(b.name));
}
/* A board member with their own login (not a staff member). */
async function verifyBoard_(username, pin) {
  if (await isLoginLocked_(username)) return null;
  const u = normUser_(username);
  const b = (await getBoard_()).find(function (x) { return x.username && x.username === u; });
  if (!b || b.staffId || b.active === false || !credOk_(b, pin)) { await recordFailedLogin_(username); return null; }
  await clearLoginThrottle_(username);
  return b;
}
/* Staff, or a board member — decided by which list holds the username, so a board
   member's every request never counts as a failed staff login (and vice versa). */
async function verifyViewer_(username, pin) {
  const u = normUser_(username);
  if (!u) return null;
  const staff = await getStaff_();
  if (findStaff_(staff, u)) { const s = await verifyStaff_(username, pin); return s ? { kind: 'staff', who: s } : null; }
  const b = await verifyBoard_(username, pin);
  return b ? { kind: 'board', who: b } : null;
}
async function usernameTaken_(u, exceptBoardId) {
  if (findStaff_(await getStaff_(), u)) return true;
  return (await getBoard_()).some(function (b) { return b.username === u && b.id !== exceptBoardId; });
}

async function boardLogin(username, pin) {
  // the login screen tries this after a failed staff login — a staff username has
  // already counted its failure there, and must not count twice
  if (findStaff_(await getStaff_(), username)) return { ok: false };
  const b = await verifyBoard_(username, pin);
  if (!b) return { ok: false };
  return { ok: true, member: boardOut_(b, []) };
}

async function getYwamGp(username, pin) {
  const v = await verifyViewer_(username, pin);
  if (!v) return { ok: false };
  const staff = (await getStaff_()).filter(function (r) { return r.active && !r.archived && !isApplicant_(r); });
  const person = function (r) { return { id: r.id, name: r.name, photo: r.photo || '', campus: r.campus }; };
  const titles = {}, gp = [];
  staff.forEach(function (r) {
    const tl = orgTitle_(r); if (tl) titles[r.id] = tl;
    gpRolesOf_(r).forEach(function (g) { gp.push(Object.assign(person(r), { gpRole: g })); });   // a row for each place they hold
  });
  const campuses = CAMPUS_IDS_.map(function (c) {
    const here = staff.filter(function (r) { return r.campus === c; });
    const clt = here.filter(function (r) { return titles[r.id]; }).map(function (r) {
      return Object.assign(person(r), { title: titles[r.id], cd: r.ministry === 'Campus Director', dept: r.ministry === 'Campus Director' ? '' : r.ministry });
    }).sort(function (a, b) {
      const k = function (p) { return p.title === 'International Campus Director' ? 0 : p.title === 'National Campus Director' ? 1 : p.cd ? 2 : 3; };
      return k(a) - k(b) || String(a.dept).localeCompare(String(b.dept)) || String(a.name).localeCompare(String(b.name));
    });
    /* who leads each ministry, by name — the campus as the board sees it */
    const leaders = {};
    here.forEach(function (r) { leadsOf_(r).forEach(function (k) { (leaders[k] = leaders[k] || []).push(r.name); }); });
    const counts = {};
    here.forEach(function (r) { const d = deptOf_(r); if (d && d !== LEADERSHIP_DEPT) counts[d] = (counts[d] || 0) + 1; });
    return { id: c, staff: here.length, clt: clt, leaders: leaders, deptStaff: counts };
  });
  const board = (await getBoard_()).filter(function (b) { return b.active !== false; })
    .map(function (b) { return boardOut_(b, staff); }).sort(boardSort_);
  return { ok: true, viewer: v.kind, me: v.kind === 'board' ? boardOut_(v.who, staff) : null,
    titles: titles, gpRoles: GP_ROLE_IDS,
    gp: gp.sort(function (a, b) { return GP_ROLE_IDS.indexOf(a.gpRole) - GP_ROLE_IDS.indexOf(b.gpRole) || String(a.name).localeCompare(String(b.name)); }),
    campuses: campuses, board: board, boardRoles: BOARD_ROLES };
}

async function adminListBoard(username, pin) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const staff = await getStaff_();
  return { ok: true, board: (await getBoard_()).map(function (b) { return boardAdminOut_(b, staff); }).sort(boardSort_), roles: BOARD_ROLES };
}
async function adminSaveBoardMember(username, pin, m) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  m = m && typeof m === 'object' ? m : {};
  const staff = await getStaff_();
  const rows = await getBoard_();
  const idx = m.id ? rows.findIndex(function (b) { return b.id === m.id; }) : -1;
  if (m.id && idx === -1) return { ok: false, err: 'not_found' };
  const rec = idx > -1 ? rows[idx] : { id: 'bd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: new Date().toISOString() };
  const linked = m.staffId ? staff.find(function (x) { return x.id === m.staffId && !isApplicant_(x); }) : null;
  if (m.staffId && !linked) return { ok: false, err: 'no_staff' };
  const name = ooText_(m.name, 80) || (linked ? linked.name : '');
  if (!name) return { ok: false, err: 'name_required' };
  const role = ooText_(m.role, 40) || 'Advisor';
  const email = m.email ? cleanEmail_(m.email) : '';
  if (email === null) return { ok: false, err: 'bad_email' };
  let photo = rec.photo || '';
  if (m.photo !== undefined) {
    if (m.photo === '' || m.photo === null) photo = '';
    else if (typeof m.photo === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(m.photo) && m.photo.length <= BOARD_PHOTO_MAX_B64 + 40) photo = m.photo;
    else return { ok: false, err: 'bad_photo' };
  }
  Object.assign(rec, { name: name, role: role, email: email || '', phone: ooText_(m.phone, 40), bio: ooText_(m.bio, 600),
    photo: photo, staffId: linked ? linked.id : '', order: Number(m.order) || 0, active: m.active !== false,
    safeguarding: !!m.safeguarding, updated: new Date().toISOString() });
  if (linked) { delete rec.username; delete rec.pinHash; delete rec.pinSalt; }
  else if (m.username !== undefined || m.newPin) {
    const u = normUser_(m.username !== undefined ? m.username : rec.username);
    if (u) {
      if (!/^[a-z0-9._-]{2,20}$/.test(u)) return { ok: false, err: 'bad_username' };
      if (await usernameTaken_(u, rec.id)) return { ok: false, err: 'username_taken' };
      rec.username = u;
    }
    if (m.newPin) {
      if (!/^\d{4}$/.test(String(m.newPin))) return { ok: false, err: 'bad_pin' };
      if (!rec.username) return { ok: false, err: 'bad_username' };
      rec.pinSalt = pinSalt_(); rec.pinHash = hashPin_(m.newPin, rec.pinSalt);
    }
  }
  if (idx > -1) rows[idx] = rec; else rows.push(rec);
  await writeJSON('board', rows);
  return adminListBoard(username, pin);
}
async function adminDeleteBoardMember(username, pin, id) {
  const admin = await adminGate_(username, pin);
  if (!admin) return { ok: false };
  const rows = await getBoard_();
  const left = rows.filter(function (b) { return b.id !== id; });
  if (left.length === rows.length) return { ok: false, err: 'not_found' };
  await writeJSON('board', left);
  return adminListBoard(username, pin);
}

const HANDLERS = {
  getMyBoot: function (a) { return getMyBoot(a[0], a[1]); },
  libAudioIndex: function () { return libAudioIndex(); },
  cafePos: function (a) { return cafePos(a[0], a[1], a[2], a[3]); },
  saveLeadTuesday: function (a) { return saveLeadTuesday(a[0], a[1], a[2]); },
  finProjGet: function (a) { return finProjGet(a[0], a[1]); },
  finProjSave: function (a) { return finProjSave(a[0], a[1], a[2]); },
  getData: function (a) { return getData(a[0], a[1]); },
  saveEntries: function (a) { return saveEntries(a[0], a[1], a[2], a[3], a[4]); },
  saveObjective: function (a) { return saveObjective(a[0], a[1], a[2], a[3]); },
  deleteObjective: function (a) { return deleteObjective(a[0], a[1], a[2], a[3]); },
  teamRoster: function (a) { return teamRoster(a[0], a[1]); },
  saveMyPersonality: function (a) { return saveMyPersonality(a[0], a[1], a[2]); },
  saveMyGStrengths: function (a) { return saveMyGStrengths(a[0], a[1], a[2]); },
  staffRegister: function (a) { return staffRegister(a[0]); },
  staffLogin: function (a) { return staffLogin(a[0], a[1]); },
  grantAdmin: function (a) { return grantAdmin(a[0], a[1], a[2]); },
  adminListStaff: function (a) { return adminListStaff(a[0], a[1]); },
  adminSetActive: function (a) { return adminSetActive(a[0], a[1], a[2], a[3]); },
  adminDecideCltRequest: function (a) { return adminDecideCltRequest(a[0], a[1], a[2], !!a[3]); },
  adminSetMentor: function (a) { return adminSetMentor(a[0], a[1], a[2], a[3], a[4]); },
  adminResetPin: function (a) { return adminResetPin(a[0], a[1], a[2], a[3]); },
  adminDeleteStaff: function (a) { return adminDeleteStaff(a[0], a[1], a[2]); },
  adminMergeStaff: function (a) { return adminMergeStaff(a[0], a[1], a[2], a[3]); },
  adminUpdateStaff: function (a) { return adminUpdateStaff(a[0], a[1], a[2], a[3]); },
  getKmReview: function (a) { return getKmReview(a[0], a[1]); },
  savePushSub: function (a) { return savePushSub(a[0], a[1], a[2], a[3]); },
  getMySupport: function (a) { return getMySupport(a[0], a[1]); },
  getPrayers: function (a) { return getPrayers(a[0], a[1]); },
  savePrayer: function (a) { return savePrayer(a[0], a[1], a[2]); },
  prayedFor: function (a) { return prayedFor(a[0], a[1], a[2], !!a[3]); },
  answerPrayer: function (a) { return answerPrayer(a[0], a[1], a[2], a[3], !!a[4]); },
  deletePrayer: function (a) { return deletePrayer(a[0], a[1], a[2]); },
  saveMySupport: function (a) { return saveMySupport(a[0], a[1], a[2]); },
  deletePushSub: function (a) { return deletePushSub(a[0], a[1], a[2]); },
  savePushPrefs: function (a) { return savePushPrefs(a[0], a[1], a[2]); },
  sendTestPush: function (a) { return sendTestPush(a[0], a[1]); },
  adminSetUpPush: function (a) { return adminSetUpPush(a[0], a[1]); },
  adminPushStatus: function (a) { return adminPushStatus(a[0], a[1]); },
  saveKmReview: function (a) { return saveKmReview(a[0], a[1], a[2], a[3], a[4]); },
  updateProfile: function (a) { return updateProfile(a[0], a[1], a[2]); },
  changePin: function (a) { return changePin(a[0], a[1], a[2]); },
  uploadPhoto: function (a) { return uploadPhoto(a[0], a[1], a[2], a[3]); },
  uploadDashboardBg: function (a) { return uploadDashboardBg(a[0], a[1], a[2], a[3]); },
  clearDashboardBg: function (a) { return clearDashboardBg(a[0], a[1]); },
  saveDaily: function (a) { return saveDaily(a[0], a[1], a[2], a[3]); },
  getMyLogs: function (a) { return getMyLogs(a[0], a[1]); },
  getMyMentees: function (a) { return getMyMentees(a[0], a[1]); },
  getMenteeLogs: function (a) { return getMenteeLogs(a[0], a[1], a[2]); },
  getMyMentorRequests: function (a) { return getMyMentorRequests(a[0], a[1]); },
  getMyWeekly: function (a) { return getMyWeekly(a[0], a[1]); },
  saveMyHabits: function (a) { return saveMyHabits(a[0], a[1], a[2], a[3]); },
  saveGoals: function (a) { return saveGoals(a[0], a[1], a[2], a[3]); },
  getMyMinistry: function (a) { return getMyMinistry(a[0], a[1]); },
  saveMyMinistry: function (a) { return saveMyMinistry(a[0], a[1], a[2], a[3]); },
  setNumbersPeople: function (a) { return setNumbersPeople(a[0], a[1], a[2], a[3], a[4]); },
  getDeptPulse: function (a) { return getDeptPulse(a[0], a[1], a[2]); },
  getStaffDebt: function (a) { return getStaffDebt(a[0], a[1]); },
  p360List: function (a) { return p360List(a[0], a[1]); },
  p360Get: function (a) { return p360Get(a[0], a[1], a[2]); },
  p360Create: function (a) { return p360Create(a[0], a[1], a[2]); },
  p360Answer: function (a) { return p360Answer(a[0], a[1], a[2], a[3]); },
  p360Decline: function (a) { return p360Decline(a[0], a[1], a[2]); },
  p360Self: function (a) { return p360Self(a[0], a[1], a[2], a[3]); },
  p360Close: function (a) { return p360Close(a[0], a[1], a[2]); },
  p360Share: function (a) { return p360Share(a[0], a[1], a[2], a[3]); },
  p360SavePlan: function (a) { return p360SavePlan(a[0], a[1], a[2], a[3]); },
  p360Review: function (a) { return p360Review(a[0], a[1], a[2], a[3], a[4], a[5]); },
  p360Delete: function (a) { return p360Delete(a[0], a[1], a[2]); },
  getFinance: function (a) { return getFinance(a[0], a[1], a[2]); },
  finSave: function (a) { return finSave(a[0], a[1], a[2], a[3], a[4], a[5]); },
  finSetCash: function (a) { return finSetCash(a[0], a[1], a[2], a[3], a[4]); },
  finMatchName: function (a) { return finMatchName(a[0], a[1], a[2], a[3], a[4]); },
  finDelete: function (a) { return finDelete(a[0], a[1], a[2], a[3], a[4]); },
  finFile: function (a) { return finFile(a[0], a[1], a[2]); },
  finAheadSave: function (a) { return finAheadSave(a[0], a[1], a[2], a[3]); },
  saveStaffDebt: function (a) { return saveStaffDebt(a[0], a[1], a[2]); },
  adminLooseEnds: function (a) { return adminLooseEnds(a[0], a[1]); },
  markSeen: function (a) { return markSeen(a[0], a[1]); },
  hrArchiveMany: function (a) { return hrArchiveMany(a[0], a[1], a[2], a[3]); },
  saveMyKpiDay: function (a) { return saveMyKpiDay(a[0], a[1], a[2], a[3]); },
  getMinistryFor: function (a) { return getMinistryFor(a[0], a[1], a[2], a[3]); },
  saveMinistryFor: function (a) { return saveMinistryFor(a[0], a[1], a[2], a[3], a[4], a[5]); },
  saveKpiDayFor: function (a) { return saveKpiDayFor(a[0], a[1], a[2], a[3], a[4], a[5]); },
  saveMyKpiPins: function (a) { return saveMyKpiPins(a[0], a[1], a[2]); },
  staffProfile: function (a) { return staffProfile(a[0], a[1], a[2]); },
  getMyTrips: function (a) { return getMyTrips(a[0], a[1]); },
  saveTrip: function (a) { return saveTrip(a[0], a[1], a[2]); },
  deleteTrip: function (a) { return deleteTrip(a[0], a[1], a[2]); },
  getTripRequests: function (a) { return getTripRequests(a[0], a[1]); },
  respondToTrip: function (a) { return respondToTrip(a[0], a[1], a[2], a[3]); },
  respondToMentorRequest: function (a) { return respondToMentorRequest(a[0], a[1], a[2], a[3]); },
  saveMyWeek: function (a) { return saveMyWeek(a[0], a[1], a[2], a[3]); },
  deleteMyWeek: function (a) { return deleteMyWeek(a[0], a[1], a[2]); },
  getMySmartGoals: function (a) { return getMySmartGoals(a[0], a[1]); },
  saveSmartGoal: function (a) { return saveSmartGoal(a[0], a[1], a[2]); },
  deleteSmartGoal: function (a) { return deleteSmartGoal(a[0], a[1], a[2]); },
  getMyTasks: function (a) { return getMyTasks(a[0], a[1]); },
  saveTask: function (a) { return saveTask(a[0], a[1], a[2]); },
  deleteTask: function (a) { return deleteTask(a[0], a[1], a[2]); },
  clearDoneTasks: function (a) { return clearDoneTasks(a[0], a[1]); },
  getMyOneOnOnes: function (a) { return getMyOneOnOnes(a[0], a[1]); },
  getYwamGp: function (a) { return getYwamGp(a[0], a[1]); },
  boardLogin: function (a) { return boardLogin(a[0], a[1]); },
  adminListBoard: function (a) { return adminListBoard(a[0], a[1]); },
  adminSaveBoardMember: function (a) { return adminSaveBoardMember(a[0], a[1], a[2]); },
  adminDeleteBoardMember: function (a) { return adminDeleteBoardMember(a[0], a[1], a[2]); },
  requestOneOnOne: function (a) { return requestOneOnOne(a[0], a[1], a[2], a[3], a[4]); },
  saveOneOnOnePrep: function (a) { return saveOneOnOnePrep(a[0], a[1], a[2], a[3]); },
  saveOneOnOneNotes: function (a) { return saveOneOnOneNotes(a[0], a[1], a[2], a[3], a[4], a[5]); },
  logOneOnOne: function (a) { return logOneOnOne(a[0], a[1], a[2], a[3], a[4], a[5]); },
  tickOneOnOneFollowUp: function (a) { return tickOneOnOneFollowUp(a[0], a[1], a[2], a[3], a[4]); },
  respondToOneOnOne: function (a) { return respondToOneOnOne(a[0], a[1], a[2], a[3]); },
  saveMetricOverrides: function (a) { return saveMetricOverrides(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7]); },
  renameCustomMetric: function (a) { return renameCustomMetric(a[0], a[1], a[2], a[3], a[4], a[5], a[6]); },
  getMyPersonal: function (a) { return getMyPersonal(a[0], a[1]); },
  saveMyPersonalWeek: function (a) { return saveMyPersonalWeek(a[0], a[1], a[2], a[3]); },
  getTeamTrips: function (a) { return getTeamTrips(a[0], a[1], a[2]); },
  saveTeamTrip: function (a) { return saveTeamTrip(a[0], a[1], a[2]); },
  deleteTeamTrip: function (a) { return deleteTeamTrip(a[0], a[1], a[2]); },
  hrList: function (a) { return hrList(a[0], a[1]); },
  hrSaveContract: function (a) { return hrSaveContract(a[0], a[1], a[2], a[3]); },
  hrSaveStart: function (a) { return hrSaveStart(a[0], a[1], a[2], a[3]); },
  hrDeleteContract: function (a) { return hrDeleteContract(a[0], a[1], a[2], a[3]); },
  hrUploadFile: function (a) { return hrUploadFile(a[0], a[1], a[2], a[3], a[4], a[5], a[6]); },
  hrGetFile: function (a) { return hrGetFile(a[0], a[1], a[2]); },
  hrDeleteFile: function (a) { return hrDeleteFile(a[0], a[1], a[2], a[3], a[4]); },
  hrArchive: function (a) { return hrArchive(a[0], a[1], a[2], a[3]); },
  hrUnarchive: function (a) { return hrUnarchive(a[0], a[1], a[2]); },
  getStructure: function (a) { return getStructure(a[0], a[1], a[2], a[3], a[4]); },
  adminListTrips: function (a) { return adminListTrips(a[0], a[1]); },
  adminDecideTrip: function (a) { return adminDecideTrip(a[0], a[1], a[2], a[3]); },
  adminSaveHolidays: function (a) { return adminSaveHolidays(a[0], a[1], a[2]); },
  saveStructure: function (a) { return saveStructure(a[0], a[1], a[2], a[3], a[4]); },
  saveStructurePlan: function (a) { return saveStructurePlan(a[0], a[1], a[2], a[3], a[4], a[5], a[6]); },
  hrCandidates: function (a) { return hrCandidates(a[0], a[1]); },
  hrSaveCandidate: function (a) { return hrSaveCandidate(a[0], a[1], a[2]); },
  hrCandidateNote: function (a) { return hrCandidateNote(a[0], a[1], a[2], a[3]); },
  hrCandidateCall: function (a) { return hrCandidateCall(a[0], a[1], a[2], a[3]); },
  hrArchiveCandidate: function (a) { return hrArchiveCandidate(a[0], a[1], a[2], a[3]); },
  getMyBroadcasts: function (a) { return getMyBroadcasts(a[0], a[1]); },
  sendBroadcast: function (a) { return sendBroadcast(a[0], a[1], a[2]); },
  portalRegister: function (a) { return portalRegister(a[0]); },
  stayRequest: function (a) { return stayRequest(a[0], a[1]); },
  portalAuthConfig: function () { return portalAuthConfig(); },
  portalLoginGoogle: function (a) { return portalLoginGoogle(a[0]); },
  portalSetPassword: function (a) { return portalSetPassword(a[0], a[1], a[2]); },
  portalBoot: function (a) { return portalBoot(a[0], a[1]); },
  portalSetAccess: function (a) { return portalSetAccess(a[0], a[1], a[2], a[3]); },
  portalAccessList: function (a) { return portalAccessList(a[0], a[1]); },
  portalUpdateContact: function (a) { return portalUpdateContact(a[0], a[1], a[2]); },
  portalDeleteApplicant: function (a) { return portalDeleteApplicant(a[0], a[1], a[2]); },
  portalSaveForm: function (a) { return portalSaveForm(a[0], a[1], a[2], a[3]); },
  portalResetForm: function (a) { return portalResetForm(a[0], a[1], a[2]); },
  portalSaveDraft: function (a) { return portalSaveDraft(a[0], a[1], a[2]); },
  portalSubmit: function (a) { return portalSubmit(a[0], a[1], a[2]); },
  portalUpdateAnswers: function (a) { return portalUpdateAnswers(a[0], a[1], a[2]); },
  portalReferenceLink: function (a) { return portalReferenceLink(a[0], a[1], a[2]); },
  portalViewAs: function (a) { return portalViewAs(a[0], a[1], a[2]); },
  portalUploadDoc: function (a) { return portalUploadDoc(a[0], a[1], a[2], a[3], a[4], a[5], a[6]); },
  portalVisaInfo: function (a) { return portalVisaInfo(a[0], a[1], a[2]); },
  portalSaveVisaInfo: function (a) { return portalSaveVisaInfo(a[0], a[1], a[2], a[3]); },
  portalVisaDocPart: function (a) { return portalVisaDocPart(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]); },
  portalVisaDocGet: function (a) { return portalVisaDocGet(a[0], a[1], a[2], a[3], a[4]); },
  portalVisaDocDelete: function (a) { return portalVisaDocDelete(a[0], a[1], a[2], a[3]); },
  portalGetDoc: function (a) { return portalGetDoc(a[0], a[1], a[2]); },
  portalDeleteDoc: function (a) { return portalDeleteDoc(a[0], a[1], a[2]); },
  portalReferenceForm: function (a) { return portalReferenceForm(a[0]); },
  portalReferenceSubmit: function (a) { return portalReferenceSubmit(a[0], a[1]); },
  portalSignLink: function (a) { return portalSignLink(a[0], a[1], a[2]); },
  portalSignStatus: function (a) { return portalSignStatus(a[0], a[1], a[2]); },
  portalSignOpen: function (a) { return portalSignOpen(a[0]); },
  portalSignSubmit: function (a) { return portalSignSubmit(a[0], a[1], a[2], a[3]); },
  portalSignedPdf: function (a) { return portalSignedPdf(a[0], a[1], a[2], a[3], a[4]); },
  staffSignOpen: function (a) { return staffSignOpen(a[0], a[1]); },
  staffSignSubmit: function (a) { return staffSignSubmit(a[0], a[1], a[2], a[3], a[4]); },
  hrSendContract: function (a) { return hrSendContract(a[0], a[1], a[2], a[3]); },
  hrContractOpen: function (a) { return hrContractOpen(a[0], a[1], a[2]); },
  hrContractSign: function (a) { return hrContractSign(a[0], a[1], a[2], a[3], a[4], a[5]); },
  myContract: function (a) { return myContract(a[0], a[1]); },
  mySaveStart: function (a) { return mySaveStart(a[0], a[1], a[2]); },
  hrLegalPdf: function (a) { return hrLegalPdf(a[0], a[1], a[2], a[3]); },
  hrContractPdf: function (a) { return hrContractPdf(a[0], a[1], a[2], a[3]); },
  portalLegalDocs: function (a) { return portalLegalDocs(a[0], a[1]); },
  portalSaveLegalDocs: function (a) { return portalSaveLegalDocs(a[0], a[1], a[2], a[3]); },
  portalSetVisaFlags: function (a) { return portalSetVisaFlags(a[0], a[1], a[2], a[3]); },
  portalTeamStep: function (a) { return portalTeamStep(a[0], a[1], a[2], a[3], a[4]); },
  portalSaveTeamNumbers: function (a) { return portalSaveTeamNumbers(a[0], a[1], a[2], a[3]); },
  portalStaffSyncTeam: function (a) { return portalStaffSyncTeam(a[0], a[1], a[2]); },
  portalStaffSaveTeamNumbers: function (a) { return portalStaffSaveTeamNumbers(a[0], a[1], a[2], a[3], a[4]); },
  portalStaffSaveAnswers: function (a) { return portalStaffSaveAnswers(a[0], a[1], a[2], a[3]); },
  portalListAccounts: function (a) { return portalListAccounts(a[0], a[1]); },
  portalCreateApplicant: function (a) { return portalCreateApplicant(a[0], a[1], a[2]); },
  portalUpdateAccount: function (a) { return portalUpdateAccount(a[0], a[1], a[2], a[3]); },
  studentCall: function (a) { return studentCall(a[0], a[1], a[2], a[3]); },
  respondStudentMentor: function (a) { return respondStudentMentor(a[0], a[1], a[2], a[3]); },
  studentsList: function (a) { return studentsList(a[0], a[1]); },
  studentMakeProfile: function (a) { return studentMakeProfile(a[0], a[1], a[2], a[3]); },
  studentsAdmin: function (a) { return studentsAdmin(a[0], a[1]); },
  studentAdminView: function (a) { return studentAdminView(a[0], a[1], a[2]); },
  portalJoinInfo: function (a) { return portalJoinInfo(a[0]); },
  portalJoin: function (a) { return portalJoin(a[0], a[1]); },
  getHospitality: function (a) { return getHospitality(a[0], a[1]); },
  getWhosHere: function (a) { return getWhosHere(a[0], a[1], a[2]); },
  whosHereTeamPhotos: function (a) { return whosHereTeamPhotos(a[0], a[1], a[2]); },
  hospSave: function (a) { return hospSave(a[0], a[1], a[2], a[3]); },
  hospDelete: function (a) { return hospDelete(a[0], a[1], a[2], a[3]); },
  hospStayStatus: function (a) { return hospStayStatus(a[0], a[1], a[2], a[3]); },
  hospMoveBed: function (a) { return hospMoveBed(a[0], a[1], a[2], a[3], a[4]); },
  hospStaffBeds: function (a) { return hospStaffBeds(a[0], a[1], a[2]); },
  hospImport: function (a) { return hospImport(a[0], a[1], a[2]); },
  getLeadBoard: function (a) { return getLeadBoard(a[0], a[1]); },
  saveLeadCard: function (a) { return saveLeadCard(a[0], a[1], a[2]); },
  deleteLeadCard: function (a) { return deleteLeadCard(a[0], a[1], a[2]); },
  saveLeadSettings: function (a) { return saveLeadSettings(a[0], a[1], a[2]); },
  saveLeadTask: function (a) { return saveLeadTask(a[0], a[1], a[2], a[3]); },
  deleteLeadTask: function (a) { return deleteLeadTask(a[0], a[1], a[2], a[3]); },
  saveLeadNote: function (a) { return saveLeadNote(a[0], a[1], a[2]); },
  getDuty: function (a) { return getDuty(a[0], a[1], a[2], a[3]); },
  saveDuty: function (a) { return saveDuty(a[0], a[1], a[2], a[3], a[4], a[5]); },
  getMySchedules: function (a) { return getMySchedules(a[0], a[1], a[2]); },
  portalMeetTeam: function (a) { return portalMeetTeam(a[0], a[1]); },
  portalStaffPhoto: function (a) { return portalStaffPhoto(a[0], a[1], a[2]); },
  portalSaveStaffCard: function (a) { return portalSaveStaffCard(a[0], a[1], a[2], a[3]); },
  portalStrengths: function (a) { return portalStrengths(a[0], a[1], a[2]); },
  portalSaveStrength: function (a) { return portalSaveStrength(a[0], a[1], a[2], a[3], a[4]); },
  portalDeleteStrength: function (a) { return portalDeleteStrength(a[0], a[1], a[2], a[3]); },
  portalResources: function (a) { return portalResources(a[0], a[1]); },
  portalSaveResources: function (a) { return portalSaveResources(a[0], a[1], a[2]); },
  portalTeamPhotos: function (a) { return portalTeamPhotos(a[0], a[1], a[2]); },
  portalSaveTeamPhoto: function (a) { return portalSaveTeamPhoto(a[0], a[1], a[2], a[3], a[4], a[5]); },
  portalDeleteTeamPhoto: function (a) { return portalDeleteTeamPhoto(a[0], a[1], a[2], a[3]); },
  portalSaveTeamMembers: function (a) { return portalSaveTeamMembers(a[0], a[1], a[2]); },
  libSaveReads: function (a) { return libSaveReads(a[0], a[1], a[2]); },
  reqDocSave: function (a) { return reqDocSave(a[0], a[1], a[2]); },
  reqDocUpload: function (a) { return reqDocUpload(a[0], a[1], a[2], a[3], a[4], a[5], a[6]); },
  reqDocDelete: function (a) { return reqDocDelete(a[0], a[1], a[2]); },
  reqDocFile: function (a) { return reqDocFile(a[0], a[1], a[2]); },
  reqSign: function (a) { return reqSign(a[0], a[1], a[2], a[3], a[4], a[5]); },
  reqSignature: function (a) { return reqSignature(a[0], a[1], a[2], a[3]); },
  reqStatusAll: function (a) { return reqStatusAll(a[0], a[1]); },
  leadWeek: function (a) { return leadWeek(a[0], a[1], a[2]); },
  leadLogAdd: function (a) { return leadLogAdd(a[0], a[1], a[2]); },
  leadLogDelete: function (a) { return leadLogDelete(a[0], a[1], a[2]); },
  leadReflectSave: function (a) { return leadReflectSave(a[0], a[1], a[2], a[3]); },
  leadPartnerSave: function (a) { return leadPartnerSave(a[0], a[1], a[2], a[3]); },
  leadPartnerDelete: function (a) { return leadPartnerDelete(a[0], a[1], a[2], a[3]); },
  basePlantSave: function (a) { return basePlantSave(a[0], a[1], a[2], a[3]); },
  cafeGet: function (a) { return cafeGet(a[0], a[1], a[2]); },
  cafeOpen: function (a) { return cafeOpen(a[0], a[1], a[2], a[3]); },
  cafeClose: function (a) { return cafeClose(a[0], a[1], a[2], a[3], a[4]); },
  cafeReopen: function (a) { return cafeReopen(a[0], a[1], a[2]); },
  cafeSale: function (a) { return cafeSale(a[0], a[1], a[2], a[3]); },
  cafeVoid: function (a) { return cafeVoid(a[0], a[1], a[2], a[3]); },
  cafeCount: function (a) { return cafeCount(a[0], a[1], a[2], a[3], a[4]); },
  cafeExpense: function (a) { return cafeExpense(a[0], a[1], a[2], a[3], a[4], a[5]); },
  cafeSaveSettings: function (a) { return cafeSaveSettings(a[0], a[1], a[2], a[3]); },
  qboConnect: function (a) { return qboConnect(a[0], a[1], a[2]); },
  qboSyncNow: function (a) { return qboSyncNow(a[0], a[1], a[2]); },
  qboSetFilter: function (a) { return qboSetFilter(a[0], a[1], a[2], a[3], a[4]); },
  qboDisconnect: function (a) { return qboDisconnect(a[0], a[1], a[2]); }
};

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Bad JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  /* `body` can be valid JSON and still not be an object — a bare `null` parses
     fine, and reading .fn off it threw, which came back as a 500. A malformed
     request is the caller's problem, so answer 400.
     hasOwnProperty, not a plain lookup: HANDLERS is an object literal, so
     fn:"constructor" used to resolve to Object and get called. */
  const named = body && typeof body === 'object' &&
    Object.prototype.hasOwnProperty.call(HANDLERS, body.fn) ? HANDLERS[body.fn] : null;
  const fn = typeof named === 'function' ? named : null;
  if (!fn) {
    return new Response(JSON.stringify({ ok: false, error: 'Unknown function: ' + (body && body.fn) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    /* One scope per request, so this request's writes are visible to this
       request's reads and to nobody else's. See readJSON. */
    const result = await requestScope.run(new Map(), function () {
      return fn(Array.isArray(body.args) ? body.args : []);
    });
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String((err && err.message) || err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
