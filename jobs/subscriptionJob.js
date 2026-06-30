import axios from 'axios'
import User from '../models/User.js'
import Subscription from '../models/Subscription.js'
import Payment from '../models/Payment.js'
import SuscriptionChange from '../models/SuscriptionChange.js'
import ScheduledTrial from '../models/ScheduledTrial.js'
import AutomationConfig from '../models/AutomationConfig.js'
import SystemConfig from '../models/SystemConfig.js'
import createUserNotification from '../utils/createUserNotification.js'
import sendGenericEmail from '../utils/sendGenericEmail.js'

const MP_API = 'https://api.mercadopago.com'
const FALLBACK_PRICES = { free: 0, basic: 9.99, pro: 19.99 }
const BILLING_MONTHS = { monthly: 1, annual: 12 }

async function getPlanPrices() {
  const config = await SystemConfig.findOne({ key: 'global' })
  if (!config || !config.premiumEnabled) return FALLBACK_PRICES
  return {
    free: 0,
    basic: config.basicMonthlyPrice ?? FALLBACK_PRICES.basic,
    pro: config.premiumMonthlyPrice ?? FALLBACK_PRICES.pro,
  }
}

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
              const prices = await getPlanPrices()
              const endDate = new Date()
              endDate.setMonth(endDate.getMonth() + (BILLING_MONTHS[billingCycle] ?? 1))

              sub.status  = 'active'
              sub.endDate = endDate
              await sub.save()

              await User.findByIdAndUpdate(sub.user._id, { suscription: sub.plan })

              await Payment.create({
                user:                 sub.user._id,
                subscription:         sub._id,
                amount:               prices[sub.plan] ?? 0,
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
      const autoConfig = await AutomationConfig.findOne({ key: 'global' })

      // Expire active trials whose trialEnd has passed
      const expiredTrials = await Subscription.find({
        status:   'trial',
        trialEnd: { $lte: now },
        deletedAt: null,
      }).populate('user', '_id suscription email firstName')

      for (const sub of expiredTrials) {
        const oldPlan = sub.user?.suscription ?? sub.plan
        sub.status = 'expired'
        sub.plan   = 'free'
        sub.price  = 0
        await sub.save()

        if (sub.user?._id) {
          await User.findByIdAndUpdate(sub.user._id, { suscription: 'free' })
          await SuscriptionChange.create({ user: sub.user._id, from: oldPlan, to: 'free' })

          if (autoConfig?.premiumExpiredEnabled) {
            const msg = (autoConfig.premiumExpiredMessage || 'Tu suscripción {plan} ha vencido.')
              .replace('{plan}', oldPlan);
            await createUserNotification(
              sub.user._id,
              'Tu suscripción ha vencido',
              msg,
              'empresa/plans',
              null
            )
            if (sub.user.email) {
              try {
                await sendGenericEmail({
                  to: sub.user.email,
                  subject: 'Tu suscripción ha vencido',
                  body: `Hola ${sub.user.firstName || ''},<br><br>${msg}<br><br>Renueva tu suscripción en Petnder para seguir disfrutando de los beneficios.`,
                })
              } catch (emailErr) {
                console.error(`Error enviando email de expiracion:`, emailErr.message)
              }
            }
          }
        }
        console.log(`Trial expirado: sub ${sub._id}`)
      }

      // Expire subscriptions whose endDate has passed
      const expiredSubs = await Subscription.find({
        status:   'active',
        endDate:  { $lte: now, $ne: null },
        deletedAt: null,
      }).populate('user', '_id suscription email firstName')

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

          if (autoConfig?.premiumExpiredEnabled) {
            const msg = (autoConfig.premiumExpiredMessage || 'Tu suscripción {plan} ha vencido.')
              .replace('{plan}', oldPlan);
            await createUserNotification(
              sub.user._id,
              'Tu suscripción ha vencido',
              msg,
              'empresa/plans',
              null
            )
            if (sub.user.email) {
              try {
                await sendGenericEmail({
                  to: sub.user.email,
                  subject: 'Tu suscripción ha vencido',
                  body: `Hola ${sub.user.firstName || ''},<br><br>${msg}<br><br>Renueva tu suscripción en Petnder para seguir disfrutando de los beneficios.`,
                })
              } catch (emailErr) {
                console.error(`Error enviando email de expiracion:`, emailErr.message)
              }
            }
          }
        }
        console.log(`Suscripcion expirada: sub ${sub._id}`)
      }

      // Reminder: subscriptions about to expire (7 days = email only, 3 days or less = email + in-app)
      if (autoConfig?.premiumReminderEnabled) {
        const sevenDaysFromNow = new Date()
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

        const aboutToExpire = await Subscription.find({
          status: 'active',
          endDate: { $lte: sevenDaysFromNow, $gt: now, $ne: null },
          deletedAt: null,
          mercadopagoSubscriptionId: null,
        }).populate('user', '_id suscription email firstName')

        for (const sub of aboutToExpire) {
          if (!sub.user?._id) continue
          const daysLeft = Math.ceil((sub.endDate - now) / (1000 * 60 * 60 * 24))
          const msg = (autoConfig.premiumReminderMessage || 'Tu suscripción {plan} vence en {dias} días.')
            .replace('{plan}', sub.plan)
            .replace('{dias}', String(daysLeft))

          if (daysLeft <= 3) {
            await createUserNotification(
              sub.user._id,
              'Tu suscripción está por vencer',
              msg,
              'empresa/plans',
              null
            )
          }

          if (sub.user.email) {
            try {
              await sendGenericEmail({
                to: sub.user.email,
                subject: 'Tu suscripción está por vencer',
                body: `Hola ${sub.user.firstName || ''},<br><br>${msg}<br><br>Ingresa a Petnder para renovar tu suscripción y no perder tus beneficios.`,
              })
            } catch (emailErr) {
              console.error(`Error enviando email de reminder a ${sub.user.email}:`, emailErr.message)
            }
          }
        }
      }
    } catch (err) {
      console.error('Error en job expire_trials:', err.message)
    }
  })
}

export default subscriptionJob
