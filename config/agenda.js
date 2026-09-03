import Agenda from 'agenda';
import couponsJob from '../jobs/couponsJob.js';
import subscriptionJob from '../jobs/subscriptionJob.js';
import inactivityJob from '../jobs/inactivityJob.js';
import surveyJob from '../jobs/surveyJob.js';
import backupJob from '../jobs/backupJob.js';
import pushCampaignJob from '../jobs/pushCampaignJob.js';
import emailAutomationJob from '../jobs/emailAutomationJob.js';

const agenda = new Agenda({
  db: {
    address: process.env.MONGO_URI,
    collection: 'agendaJobs',
  },
});

couponsJob(agenda);
subscriptionJob(agenda);
inactivityJob(agenda);
surveyJob(agenda);
backupJob(agenda);
pushCampaignJob(agenda);
emailAutomationJob(agenda);

agenda.on('ready', async () => {
  console.log('✅ Agenda READY');

  await agenda.start();

  await agenda.every('1 minute',  'coupons_test');
  await agenda.every('1 hour',    'expire_trials');
  await agenda.every('2 minutes', 'check_subscriptions');
  await agenda.every('1 minute',  'activate_scheduled_trials');
  await agenda.every('6 hours',   'check_inactive_users');
  await agenda.every('12 hours',  'auto_backup');
  await agenda.every('1 minute',  'send_scheduled_push');

  console.log('🕒 Job coupons_test programado');
  console.log('🕒 Job expire_trials programado');
  console.log('🕒 Job check_subscriptions programado');
  console.log('🕒 Job activate_scheduled_trials programado');
  console.log('🕒 Job check_inactive_users programado');
  console.log('🕒 Job auto_backup programado');
  console.log('🕒 Job send_scheduled_push programado');
});

agenda.on('error', (err) => {
  console.error('❌ Agenda error:', err);
});

export default agenda;
