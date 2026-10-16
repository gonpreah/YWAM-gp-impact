/* ==================== reminders, every hour ====================
   Sends each person's reminder at the hour they chose in Profile & settings →
   Reminders (Phnom Penh time): one notification with whatever applies to them — see
   "Reminders: web push" in api.js, which does the work (runReminders). An hour that
   already ran is not sent twice. Nothing happens until an admin has turned reminders
   on (Admin → Reminders) or the VAPID keys are in Netlify's environment.

   A scheduled function cannot be called by URL on the live site; Netlify's "Run now"
   on the function page runs it. */
import { runReminders } from './api.js';

export const config = { schedule: '0 * * * *' };

export default async function () {
  try {
    const r = await runReminders();
    console.log('reminders', JSON.stringify(r));
  } catch (e) {
    console.error('reminders failed', e && e.message);
  }
}
