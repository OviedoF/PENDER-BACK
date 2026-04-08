import axios from 'axios'
import User from '../models/User.js'
import Subscription from '../models/Subscription.js'
import Payment from '../models/Payment.js'
import SuscriptionChange from '../models/SuscriptionChange.js'
import ScheduledTrial from '../models/ScheduledTrial.js'

const MP_API = 'https://api.mercadopago.com'
const PLAN_PRICES = { free: 0, basic: 9.99, pro: 19.99 }
const BILLING_MONTHS = { monthly: 1, annual: 12 }

const subscriptionJob = (agenda) => {

  // Verifica preapprovals activos en MP cada 2 minutos y renueva o cancela según corresponda
  agenda.define('check_subscriptions', async () => {
    try {
      const subs = await Subscription.find({
        mercadopagoSubscriptionId: { $ne: null },
        status: { $in: ['active', 'paused'] },
        deletedAt: null,
      }).populate('user', '_id suscription')

      for (const sub of subs) {
        try {
          const { data } = await axios.get(
            `${MP_API}/preapproval/${sub.mercadopagoSubscriptionId}`,
            { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
          )

          const { billingCycle = 'monthly' } = JSON.parse(data.external_reference ?? '{}')

          if (data.status === 'authorized') {
            // Si ya venció el endDate, es una renovación
            if (sub.endDate && new Date() >= sub.endDate) {
              const endDate = new Date()
              endDate.setMonth(endDate.getMonth() + (BILLING_MONTHS[billingCycle] ?? 1))

              sub.status  = 'active'
              sub.endDate = endDate
              await sub.save()

              await User.findByIdAndUpdate(sub.user._id, { suscription: sub.plan })

              await Payment.create({
                user:                 sub.user._id,
                subscription:         sub._id,
                amount:               PLAN_PRICES[sub.plan] ?? 0,
                currency:             'USD',
                status:               'approved',
                method:               'mercadopago',
                mercadopagoPaymentId: sub.mercadopagoSubscriptionId,
                paidAt:               new Date(),
                invoiceNumber:        `INV-${new Date().getFullYear()}-${String((await Payment.countDocuments({ invoiceNumber: { $regex: `^INV-${new Date().getFullYear()}-` } })) + 1).padStart(4, '0')}`,
                description:          `Renovacion automatica ${sub.plan} - ${billingCycle}`,
              })

              console.log(`Suscripcion renovada: sub ${sub._id} (${sub.plan})`)
            }

          } else if (['cancelled', 'paused', 'pending'].includes(data.status)) {
            const oldPlan = sub.user?.suscription ?? sub.plan
            sub.status      = data.status === 'cancelled' ? 'cancelled' : 'paused'
            sub.plan        = 'free'
            sub.price       = 0
            sub.cancelledAt = data.status === 'cancelled' ? new Date() : null
            sub.mercadopagoSubscriptionId = null
            await sub.save()

            await User.findByIdAndUpdate(sub.user._id, { suscription: 'free' })
            await SuscriptionChange.create({ user: sub.user._id, from: oldPlan, to: 'free' })

            console.log(`Suscripcion degradada a free: sub ${sub._id} (estado MP: ${data.status})`)
          }
        } catch (err) {
          console.error(`Error chequeando sub ${sub._id}:`, err.message)
        }
      }
    } catch (err) {
      console.error('Error en job check_subscriptions:', err.message)
    }
  })

  // Activa pruebas gratuitas programadas cuya fecha llegó
  agenda.define('activate_scheduled_trials', async () => {
    try {
      const pending = await ScheduledTrial.find({
        scheduledAt:  { $lte: new Date() },
        activatedAt:  null,
      }).populate('user', '_id suscription')

      for (const scheduled of pending) {
        try {
          const user = scheduled.user
          if (!user) continue

          const trialEnd = new Date()
          trialEnd.setDate(trialEnd.getDate() + scheduled.days)

          let sub = await Subscription.findOne({ user: user._id, deletedAt: null })
          if (sub) {
            sub.plan        = scheduled.plan
            sub.status      = 'trial'
            sub.trialEnd    = trialEnd
            sub.price       = 0
            sub.cancelledAt = null
            await sub.save()
          } else {
            sub = await Subscription.create({
              user:     user._id,
              plan:     scheduled.plan,
              status:   'trial',
              trialEnd,
              price:    0,
            })
          }

          const oldPlan = user.suscription
          await User.findByIdAndUpdate(user._id, { suscription: scheduled.plan })
          await SuscriptionChange.create({ user: user._id, from: oldPlan, to: scheduled.plan })

          scheduled.activatedAt = new Date()
          await scheduled.save()

          console.log(`Trial programado activado: user ${user._id} → plan ${scheduled.plan} por ${scheduled.days} días`)
        } catch (err) {
          console.error(`Error activando trial programado ${scheduled._id}:`, err.message)
        }
      }
    } catch (err) {
      console.error('Error en job activate_scheduled_trials:', err.message)
    }
  })

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
