import User from '../models/User.js'
import AutomationConfig from '../models/AutomationConfig.js'
import createUserNotification from '../utils/createUserNotification.js'

const inactivityJob = (agenda) => {
  agenda.define('check_inactive_users', async () => {
    try {
      const autoConfig = await AutomationConfig.findOne({ key: 'global' })
      if (!autoConfig?.inactiveEnabled) return

      const inactiveDays = autoConfig.inactiveDays || 30
      const repeatDays = autoConfig.inactiveRepeatDays || 15
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - inactiveDays)

      const repeatCutoff = new Date()
      repeatCutoff.setDate(repeatCutoff.getDate() - repeatDays)

      const users = await User.find({
        deletedAt: { $exists: false },
        role: { $in: ['usuario', 'empresa'] },
        $or: [
          { times: { $size: 0 } },
          { 'times.date': { $not: { $gte: cutoffDate } } },
        ],
      }).select('_id firstName times lastInactivityNotif').limit(200)

      let notified = 0
      for (const user of users) {
        if (user.lastInactivityNotif && user.lastInactivityNotif > repeatCutoff) continue

        const lastSession = user.times?.length > 0
          ? user.times[user.times.length - 1].date
          : null
        const daysSince = lastSession
          ? Math.floor((Date.now() - new Date(lastSession).getTime()) / (1000 * 60 * 60 * 24))
          : inactiveDays

        const msg = (autoConfig.inactiveMessage || '¡Te extrañamos! Han pasado {dias} días desde tu última visita.')
          .replace('{dias}', String(daysSince))

        await createUserNotification(
          user._id,
          '¡Te extrañamos!',
          msg,
          null,
          null
        )

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
