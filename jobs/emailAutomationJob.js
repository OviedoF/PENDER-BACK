import { sendAutomationEmailNow } from '../utils/emailAutomations.js';

/**
 * Job puntual: envía un email de automatización con retraso.
 * Se programa desde utils/emailAutomations.js con agenda.schedule().
 */
export default function emailAutomationJob(agenda) {
  agenda.define('send_automation_email', async (job) => {
    const { automationId, to, vars } = job.attrs.data || {};
    if (!automationId || !to) return;
    try {
      await sendAutomationEmailNow({ automationId, to, vars });
    } catch (err) {
      console.error(`Error en send_automation_email (${to}):`, err.message);
    }
  });
}
