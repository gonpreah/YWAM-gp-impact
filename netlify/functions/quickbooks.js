/* Where Intuit sends the browser back after the Finances office signs in to QuickBooks
   (Finances → Reports → Connect QuickBooks): GET ?code&state&realmId, or ?error when they
   said no. qboCallback in api.js does the work — checks the state, turns the code into
   tokens, brings the numbers in — and this answers with a small page saying how it went
   and a way back to the app. Nothing from the request is ever written into the page.

   This URL (https://<the site>/.netlify/functions/quickbooks) must be listed exactly on
   the Intuit app's Redirect URIs — see "QuickBooks" in CLAUDE.md. */
import { qboCallback } from './api.js';

const SAID = {
  ok: ['QuickBooks is connected', 'QuickBooks បានភ្ជាប់ហើយ', 'The Profit and Loss and the staff debt now come in by themselves every night. Go back to the app to see them.', 'របាយការណ៍ចំណេញ និងខាត និងបំណុលបុគ្គលិក នឹងចូលមកដោយខ្លួនឯងរៀងរាល់យប់។ សូមត្រឡប់ទៅកម្មវិធីវិញដើម្បីមើល។'],
  partly: ['QuickBooks is connected', 'QuickBooks បានភ្ជាប់ហើយ', 'The numbers didn’t come in this time. Go back to the app and press “Bring the numbers in now”.', 'លេខមិនទាន់ចូលមកលើកនេះទេ។ សូមត្រឡប់ទៅកម្មវិធីវិញ ហើយចុច “នាំលេខចូលឥឡូវនេះ”។'],
  denied: ['Not connected', 'មិនបានភ្ជាប់', 'QuickBooks wasn’t connected — nothing was shared.', 'QuickBooks មិនបានភ្ជាប់ទេ — គ្មានអ្វីត្រូវបានចែករំលែកឡើយ។'],
  expired: ['Try again from the app', 'សូមព្យាយាមម្ដងទៀតពីកម្មវិធី', 'That link has run out or was already used. Press “Connect QuickBooks” in the app again.', 'តំណនោះផុតកំណត់ ឬត្រូវបានប្រើរួចហើយ។ សូមចុច “ភ្ជាប់ QuickBooks” ក្នុងកម្មវិធីម្ដងទៀត។'],
  not_configured: ['QuickBooks isn’t set up yet', 'QuickBooks មិនទាន់បានរៀបចំនៅឡើយ', 'An admin needs to add the app’s QuickBooks keys first.', 'អ្នកគ្រប់គ្រងត្រូវបន្ថែមកូនសោ QuickBooks របស់កម្មវិធីជាមុនសិន។'],
  failed: ['Couldn’t connect', 'មិនអាចភ្ជាប់បានទេ', 'Something went wrong talking to QuickBooks. Go back to the app and try again.', 'មានបញ្ហាពេលទាក់ទងជាមួយ QuickBooks។ សូមត្រឡប់ទៅកម្មវិធីវិញ ហើយព្យាយាមម្ដងទៀត។']
};

function page(which) {
  const m = SAID[which] || SAID.failed, good = which === 'ok' || which === 'partly';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex"><title>QuickBooks · My YWAM GP</title><style>' +
    // the app's own Khmer font (public/fonts), so the Khmer reads right on a phone without one
    "@font-face{font-family:'Kantumruy Pro';font-weight:400 700;font-display:swap;src:url(/fonts/kantumruy-khmer.woff2) format('woff2');unicode-range:U+1780-17FF,U+19E0-19FF,U+200C-200D,U+25CC}" +
    ':root{--bg:#f6f7f9;--card:#fff;--ink:#1d2430;--sub:#5b6575;--accent:#2a78d6;--good:#1f8a4c;--bad:#c2410c}' +
    '@media (prefers-color-scheme:dark){:root{--bg:#12161c;--card:#1b212a;--ink:#e8ecf2;--sub:#a3adbb;--accent:#3987e5;--good:#3fb66f;--bad:#f08a4b}}' +
    'body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI","Kantumruy Pro",sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}' +
    '.c{background:var(--card);border-radius:16px;padding:24px;max-width:420px;width:100%;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center}' +
    '.i{font-size:40px}h1{font-size:20px;margin:8px 0 4px}p{color:var(--sub);margin:6px 0}.km{font-size:15px;font-family:"Kantumruy Pro",system-ui,sans-serif}' +
    'a{display:inline-block;margin-top:16px;background:var(--accent);color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600}' +
    '</style></head><body><div class="c"><div class="i">' + (good ? '✅' : '⚠️') + '</div>' +
    '<h1>' + m[0] + '</h1><p class="km" lang="km">' + m[1] + '</p><p>' + m[2] + '</p><p class="km" lang="km">' + m[3] + '</p>' +
    '<a href="/teams.html">Back to the app · <span lang="km" style="font-family:\'Kantumruy Pro\',sans-serif">ត្រឡប់ទៅកម្មវិធី</span></a></div></body></html>';
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const u = new URL(req.url), q = {};
  ['code', 'state', 'realmId', 'error'].forEach(function (k) { q[k] = u.searchParams.get(k) || ''; });
  let which = 'failed';
  try {
    const r = await qboCallback(q);
    which = r.ok ? (r.synced ? 'ok' : 'partly') : (SAID[r.err] ? r.err : 'failed');
  } catch (e) {
    console.error('quickbooks callback failed', e && e.message);
  }
  return new Response(page(which), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' } });
};
