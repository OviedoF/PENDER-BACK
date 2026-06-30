import User from '../models/User.js'
import AutomationConfig from '../models/AutomationConfig.js'
import createUserNotification from '../utils/createUserNotification.js'
import sendGenericEmail from '../utils/sendGenericEmail.js'

const INACTIVITY_THRESHOLDS = [30, 45, 60]

const inactivityJob = (agenda) => {
  agenda.define('check_inactive_users', async () => {
    try {
      const autoConfig = await AutomationConfig.findOne({ key: 'global' })
      if (!autoConfig?.inactiveEnabled) return

      const maxDays = Math.max(...INACTIVITY_THRESHOLDS)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - INACTIVITY_THRESHOLDS[0])

      const repeatDays = autoConfig.inactiveRepeatDays || 15
      const repeatCutoff = new Date()
      repeatCutoff.setDate(repeatCutoff.getDate() - repeatDays)

      const users = await User.find({
        deletedAt: { $exists: false },
        role: { $in: ['usuario', 'empresa'] },
        $or: [
          { times: { $size: 0 } },
          { 'times.date': { $not: { $gte: cutoffDate } } },
        ],
      }).select('_id firstName email times lastInactivityNotif').limit(200)

      let notified = 0
      for (const user of users) {
        if (user.lastInactivityNotif && user.lastInactivityNotif > repeatCutoff) continue

        const lastSession = user.times?.length > 0
          ? user.times[user.times.length - 1].date
          : null
        const daysSince = lastSession
          ? Math.floor((Date.now() - new Date(lastSession).getTime()) / (1000 * 60 * 60 * 24))
          : maxDays

        const matchedThreshold = INACTIVITY_THRESHOLDS.find(t => daysSince >= t)
        if (!matchedThreshold) continue

        const msg = (autoConfig.inactiveMessage || '¡Te extrañamos! Han pasado {dias} días desde tu última visita.')
          .replace('{dias}', String(daysSince))

        await createUserNotification(
          user._id,
          '¡Te extrañamos!',
          msg,
          null,
          null
        )

        if (user.email) {
          try {
            await sendGenericEmail({
              to: user.email,
              subject: '¡Te extrañamos en Petnder!',
              body: `Hola ${user.firstName || ''},<br><br>${msg}<br><br>Ingresa a Petnder y descubre las novedades que te esperan.`,
            })
          } catch (emailErr) {
            console.error(`Error enviando email de inactividad a ${user.email}:`, emailErr.message)
          }
        }

        await User.findByIdAndUpdate(user._id, { lastInactivityNotif: new Date() })
        notified++
      }

      if (notified > 0) {
        console.log(`Inactividad: ${notified} usuario(s) notificado(s)`)
      }
    } catch (err) {
      console.error('Error en job check_inactive_users:', err.message)
    }
  })
}

export default inactivityJob
