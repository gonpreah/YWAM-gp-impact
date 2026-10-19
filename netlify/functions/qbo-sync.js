/* ==================== QuickBooks, every night ====================
   Brings each connected campus's Profit and Loss and A/R Ageing in from QuickBooks
   (runQboSync in api.js — see "QuickBooks" there). 04:15 in Phnom Penh, after the
   nightly backup. Nothing happens until the app's QuickBooks keys are in Netlify's
   environment and the Finances office has connected.

   A scheduled function cannot be called by URL on the live site; Netlify's "Run now"
   on the function page runs it. */
import { runQboSync } from './api.js';

export const config = { schedule: '15 21 * * *' };   // 21:15 UTC = 04:15 in Phnom Penh

export default async function () {
  try {
    console.log('qbo-sync', JSON.stringify(await runQboSync()));
  } catch (e) {
    console.error('qbo-sync failed', e && e.message);
  }
}
