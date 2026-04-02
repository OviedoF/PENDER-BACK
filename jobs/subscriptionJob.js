import User from '../models/User.js'
import Subscription from '../models/Subscription.js'
import SuscriptionChange from '../models/SuscriptionChange.js'

const subscriptionJob = (agenda) => {
  agenda.define('expire_trials', async () => {
    try {
      const now = new Date()

      // Expire active trials whose trialEnd has passed
      const expiredTrials = await Subscription.find({
        status:   'trial',
        trialEnd: { $lte: now },
        deletedAt: null,
      }).populate('user', '_id suscription')

      for (const sub of expiredTrials) {
        const oldPlan = sub.user?.suscription ?? sub.plan
        sub.status = 'expired'
        sub.plan   = 'free'
        sub.price  = 0
        await sub.save()

        if (sub.user?._id) {
          await User.findByIdAndUpdate(sub.user._id, { suscription: 'free' })
          await SuscriptionChange.create({ user: sub.user._id, from: oldPlan, to: 'free' })
        }
        console.log(`Trial expirado: sub ${sub._id}`)
      }

      // Expire subscriptions whose endDate has passed
      const expiredSubs = await Subscription.find({
        status:   'active',
        endDate:  { $lte: now, $ne: null },
        deletedAt: null,
      }).populate('user', '_id suscription')

      for (const sub of expiredSubs) {
        const oldPlan = sub.user?.suscription ?? sub.plan
        sub.status      = 'expired'
        sub.cancelledAt = now
        sub.plan        = 'free'
        sub.price       = 0
        await sub.save()

        if (sub.user?._id) {
          await User.findByIdAndUpdate(sub.user._id, { suscription: 'free' })
          await SuscriptionChange.create({ user: sub.user._id, from: oldPlan, to: 'free' })
        }
        console.log(`Suscripcion expirada: sub ${sub._id}`)
      }
    } catch (err) {
      console.error('Error en job expire_trials:', err.message)
    }
  })
}

export default subscriptionJob
