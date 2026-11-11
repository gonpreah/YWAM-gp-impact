/* ==================== GPDTS's numbers, every hour ====================
   Brings GPDTS's numbers up to date from its pipeline (runDtsSync in api.js — see
   "GPDTS" there): students applied, accepted, enrolled, graduated, potential staff and
   contacted. Every DTS change already syncs at once; this catches the rest — the
   levels move with the calendar, and a change made where no sync runs.

   A scheduled function cannot be called by URL on the live site; Netlify's "Run now"
   on the function page runs it. */
import { runDtsSync } from './api.js';

export const config = { schedule: '30 * * * *' };

export default async function () {
  try {
    console.log('dts-sync', JSON.stringify(await runDtsSync()));
  } catch (e) {
    console.error('dts-sync failed', e && e.message);
  }
}
