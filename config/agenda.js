import Agenda from 'agenda';
import couponsJob from '../jobs/couponsJob.js';

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI,
    collection: 'agendaJobs',
  },
});

couponsJob(agenda);

agenda.on('ready', async () => {
  console.log('✅ Agenda READY');

  await agenda.start();

  await agenda.every('1 minute', 'coupons_test');

  console.log('🕒 Job coupons_test programado');
});

agenda.on('error', (err) => {
  console.error('❌ Agenda error:', err);
});

export default agenda;
