import AutomationConfig from '../models/AutomationConfig.js'
import createUserNotification from '../utils/createUserNotification.js'

const surveyJob = (agenda) => {
  agenda.define('send_recovery_survey', async (job) => {
    try {
      const { userId, petName } = job.attrs.data
      const autoConfig = await AutomationConfig.findOne({ key: 'global' })
      if (!autoConfig?.surveyEnabled) return

      const message = (autoConfig.surveyMessage || '¡Nos alegra que {nombre} haya vuelto!')
        .replace('{nombre}', petName)

      await createUserNotification(
        userId,
        '¿Cómo fue tu experiencia?',
        message,
        'usuario/foundeMe/myReports',
        null
      )
    } catch (err) {
      console.error('Error en job send_recovery_survey:', err.message)
    }
  })
}

export default surveyJob
