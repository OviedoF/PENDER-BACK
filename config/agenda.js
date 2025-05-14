import Agenda from 'agenda';
import dotenv from 'dotenv';
import couponsJob from '../jobs/couponsJob.js';
dotenv.config();

const mongoConnectionString = process.env.MONGO_URI || 'mongodb://localhost:27017/petnder';

const agenda = new Agenda({
  db: {
    address: mongoConnectionString,
    collection: 'agendaJobs',
  },
});

couponsJob(agenda);

const startAgenda = async () => {
  await agenda.start();
  await agenda.every('1 minute', 'coupons_test');
};

export default startAgenda;