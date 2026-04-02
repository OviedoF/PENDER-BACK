import Agenda from 'agenda';
import couponsJob from '../jobs/couponsJob.js';
import subscriptionJob from '../jobs/subscriptionJob.js';

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI,
    collection: 'agendaJobs',
  },
});

couponsJob(agenda);
subscriptionJob(agenda);

agenda.on('ready', async () => {
  console.log('✅ Agenda READY');

  await agenda.start();

  await agenda.every('1 minute', 'coupons_test');
  await agenda.every('1 hour', 'expire_trials');

  console.log('🕒 Job coupons_test programado');
  console.log('🕒 Job expire_trials programado');
});

agenda.on('error', (err) => {
  console.error('❌ Agenda error:', err);
});

export default agenda;
