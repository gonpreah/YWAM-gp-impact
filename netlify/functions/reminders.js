/* ==================== reminders, every hour ====================
   Sends each person's reminder at the hour they chose in Profile & settings →
   Reminders (Phnom Penh time): one notification with whatever applies to them — see
   "Reminders: web push" in api.js, which does the work (runReminders). An hour that
   already ran is not sent twice. Nothing happens until an admin has turned reminders
   on (Admin → Reminders) or the VAPID keys are in Netlify's environment.

   A scheduled function cannot be called by URL on the live site; Netlify's "Run now"
   on the function page runs it.

   The same hour also banks each finished week of the week's board for its all-time board (runGameBank). */
import { runReminders, runGameBank } from './api.js';

export const config = { schedule: '0 * * * *' };

export default async function () {
  try {
    const r = await runReminders();
    console.log('reminders', JSON.stringify(r));
  } catch (e) {
    console.error('reminders failed', e && e.message);
  }
  /* the week's board: bank each finished week's points for the all-time board (api.js "All time") */
  try {
    const g = await runGameBank();
    if (g && g.banked && g.banked.length) console.log('game weeks banked', JSON.stringify(g.banked));
  } catch (e) {
    console.error('game bank failed', e && e.message);
  }
}
