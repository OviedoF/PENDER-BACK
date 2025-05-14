import app from './app.js';
import startAgenda from './config/agenda.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  startAgenda()
    .then(() => {
      console.log('Agenda started');
    })
    .catch((error) => {
      console.error('Error starting agenda:', error);
    });
  console.log(`Server running on port ${PORT}`);
});
