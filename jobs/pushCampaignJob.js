import PushCampaign from '../models/PushCampaign.js';
import { dispatchPushCampaign } from '../utils/pushCampaign.js';

/**
 * Job recurrente: envía las campañas push programadas cuya fecha ya llegó.
 */
export default function pushCampaignJob(agenda) {
  agenda.define('send_scheduled_push', async () => {
    try {
      const due = await PushCampaign.find({
        status: 'scheduled',
        scheduledAt: { $ne: null, $lte: new Date() },
      });

      for (const campaign of due) {
        // Marcamos primero para evitar doble envío si el job se solapa
        const claimed = await PushCampaign.findOneAndUpdate(
          { _id: campaign._id, status: 'scheduled' },
          { status: 'sending' },
          { new: true }
        );
        if (!claimed) continue;

        try {
          const result = await dispatchPushCampaign(claimed);
          console.log(`📲 Campaña push programada enviada: "${claimed.title}" → ${result.recipients} usuarios, ${result.pushDelivered} push`);
        } catch (err) {
          console.error(`Error enviando campaña programada ${claimed._id}:`, err.message);
          await PushCampaign.findByIdAndUpdate(claimed._id, { status: 'scheduled' });
        }
      }
    } catch (err) {
      console.error('Error en job send_scheduled_push:', err.message);
    }
  });
}
