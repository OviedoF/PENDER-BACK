import axios from 'axios'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'
import User from '../models/User.js'
import Subscription from '../models/Subscription.js'
import Payment from '../models/Payment.js'
import SuscriptionChange from '../models/SuscriptionChange.js'
import ScheduledTrial from '../models/ScheduledTrial.js'

const MP_API = 'https://api.mercadopago.com'
const mpHeaders = () => ({
  Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
})

const PLAN_PRICES = { free: 0, basic: 9.99, pro: 19.99 }

async function generateInvoiceNumber() {
  const year  = new Date().getFullYear()
  const count = await Payment.countDocuments({ invoiceNumber: { $regex: `^INV-${year}-` } })
  const seq   = String(count + 1).padStart(4, '0')
  return `INV-${year}-${seq}`
}

async function verifyUser(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) throw new Error('Token requerido')
  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  const user = await User.findById(decoded.id)
  if (!user) throw new Error('Usuario no encontrado')
  return user
}

const BILLING_MONTHS = { monthly: 1, annual: 12 }
const PLAN_PRICES_MP = {
  basic: { monthly: 9.99, annual: 9.99 * 10 },
  pro:   { monthly: 19.99, annual: 19.99 * 10 },
}

// ─── IAP ──────────────────────────────────────────────────────────────────────

// Product IDs must match App Store Connect and Google Play Console exactly
const IAP_PRODUCT_MAP = {
  petnder_basic_monthly: { plan: 'basic', billingCycle: 'monthly' },
  petnder_basic_annual:  { plan: 'basic', billingCycle: 'annual'  },
  petnder_pro_monthly:   { plan: 'pro',   billingCycle: 'monthly' },
  petnder_pro_annual:    { plan: 'pro',   billingCycle: 'annual'  },
}

async function verifyAppleReceipt(receiptData) {
  const payload = {
    'receipt-data': receiptData,
    password: process.env.APPLE_IAP_SHARED_SECRET,
    'exclude-old-transactions': true,
  }
  let { data } = await axios.post('https://buy.itunes.apple.com/verifyReceipt', payload)
  // Status 21007 = sandbox receipt sent to production endpoint → retry on sandbox
  if (data.status === 21007) {
    const sandbox = await axios.post('https://sandbox.itunes.apple.com/verifyReceipt', payload)
    data = sandbox.data
  }
  if (data.status !== 0) throw new Error(`Apple IAP verification failed (status ${data.status})`)
  return data
}

async function verifyAndroidPurchase(productId, purchaseToken) {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  const publisher = google.androidpublisher({ version: 'v3', auth })
  const { data } = await publisher.purchases.subscriptions.get({
    packageName: process.env.ANDROID_PACKAGE_NAME,
    subscriptionId: productId,
    token: purchaseToken,
  })
  // paymentState 1 = payment received, 2 = free trial
  if (data.paymentState !== 1 && data.paymentState !== 2) {
    throw new Error(`Google Play payment not confirmed (paymentState ${data.paymentState})`)
  }
  return data
}

async function verifyAdmin(req) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) throw new Error('Token requerido')
  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  const user = await User.findById(decoded.id)
  if (!user || user.role !== 'admin') throw new Error('No autorizado')
  return user
}

// Upsert a Subscription record from a User document
async function upsertSubscription(user, overrides = {}) {
  let sub = await Subscription.findOne({ user: user._id, deletedAt: null })
  if (sub) {
    Object.assign(sub, overrides)
    await sub.save()
  } else {
    sub = await Subscription.create({
      user:      user._id,
      plan:      overrides.plan      ?? user.suscription,
      status:    overrides.status    ?? (user.suscription === 'free' ? 'cancelled' : 'active'),
      price:     overrides.price     ?? (PLAN_PRICES[user.suscription] ?? 0),
      startDate: overrides.startDate ?? user.createdAt,
      ...overrides,
    })
  }
  return sub
}

// Synthesize a lightweight subscription object from User when no DB record exists
function syntheticSub(user) {
  return {
    _id:       null,
    user:      { _id: user._id, name: user.name, email: user.email },
    plan:      user.suscription,
    status:    user.suscription === 'free' ? 'free' : 'active',
    startDate: user.createdAt,
    price:     PLAN_PRICES[user.suscription] ?? 0,
    trialEnd:  null,
    cancelledAt: null,
    synthetic: true,
  }
}

const SubscriptionController = {

  // GET /admin/all?plan=&status=&search=&page=1&limit=20
  async adminGetAll(req, res) {
    try {
      await verifyAdmin(req)
      const { plan, status, search, page = 1, limit = 20 } = req.query

      const userFilter = { deletedAt: null }
      if (search) userFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
      if (plan) userFilter.suscription = plan

      const total = await User.countDocuments(userFilter)
      const users = await User.find(userFilter)
        .select('_id name email suscription createdAt')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))

      const userIds = users.map(u => u._id)
      const subRecords = await Subscription.find({ user: { $in: userIds }, deletedAt: null })
      const subMap = {}
      for (const s of subRecords) subMap[String(s.user)] = s

      let subscriptions = users.map(u => {
        const sub = subMap[String(u._id)]
        if (sub) {
          // attach user inline for consistent shape
          const plain = sub.toObject()
          plain.user = { _id: u._id, name: u.name, email: u.email, suscription: u.suscription }
          return plain
        }
        return syntheticSub(u)
      })

      if (status) subscriptions = subscriptions.filter(s => s.status === status)

      res.json({ subscriptions, total, page: Number(page), limit: Number(limit) })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // GET /admin/:userId/detail
  async adminGetByUser(req, res) {
    try {
      await verifyAdmin(req)
      const user = await User.findById(req.params.userId).select('_id name email suscription balance createdAt')
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

      let sub = await Subscription.findOne({ user: user._id, deletedAt: null })
      if (!sub) sub = syntheticSub(user)

      const payments = await Payment.find({ user: user._id, deletedAt: null }).sort({ createdAt: -1 }).limit(50)
      const changes  = await SuscriptionChange.find({ user: user._id }).sort({ createdAt: -1 }).limit(30)

      res.json({ subscription: sub, user, payments, changes })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // PUT /admin/:userId/plan  body: { plan }
  async adminChangePlan(req, res) {
    try {
      await verifyAdmin(req)
      const { plan, notes } = req.body
      if (!PLAN_PRICES.hasOwnProperty(plan)) return res.status(400).json({ message: 'Plan invalido' })

      const user = await User.findById(req.params.userId)
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

      const oldPlan = user.suscription
      user.suscription = plan
      await user.save()
      await SuscriptionChange.create({ user: user._id, from: oldPlan, to: plan })

      const sub = await upsertSubscription(user, {
        plan,
        price:       PLAN_PRICES[plan],
        status:      plan === 'free' ? 'cancelled' : 'active',
        cancelledAt: plan === 'free' ? new Date() : null,
        adminNotes:  notes ?? undefined,
      })

      res.json({ message: 'Plan actualizado', subscription: sub })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // PUT /admin/:id/cancel
  async adminCancel(req, res) {
    try {
      await verifyAdmin(req)
      const sub = await Subscription.findById(req.params.id).populate('user', '_id name email suscription')
      if (!sub) return res.status(404).json({ message: 'Suscripcion no encontrada' })

      const oldPlan = sub.user.suscription
      sub.status      = 'cancelled'
      sub.cancelledAt = new Date()
      sub.plan        = 'free'
      sub.price       = 0
      await sub.save()

      await User.findByIdAndUpdate(sub.user._id, { suscription: 'free' })
      await SuscriptionChange.create({ user: sub.user._id, from: oldPlan, to: 'free' })

      res.json({ message: 'Suscripcion cancelada', subscription: sub })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // PUT /admin/:id/reactivate  body: { plan? }
  async adminReactivate(req, res) {
    try {
      await verifyAdmin(req)
      const sub = await Subscription.findById(req.params.id).populate('user', '_id name email suscription')
      if (!sub) return res.status(404).json({ message: 'Suscripcion no encontrada' })

      const newPlan = req.body.plan ?? (sub.plan === 'free' ? 'basic' : sub.plan)
      const oldPlan = sub.user.suscription

      sub.plan          = newPlan
      sub.status        = 'active'
      sub.price         = PLAN_PRICES[newPlan]
      sub.reactivatedAt = new Date()
      sub.cancelledAt   = null
      sub.cancelAt      = null
      await sub.save()

      await User.findByIdAndUpdate(sub.user._id, { suscription: newPlan })
      await SuscriptionChange.create({ user: sub.user._id, from: oldPlan, to: newPlan })

      res.json({ message: 'Suscripcion reactivada', subscription: sub })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // POST /admin/:userId/trial  body: { plan, days, scheduledAt? }
  async adminActivateTrial(req, res) {
    try {
      const admin = await verifyAdmin(req)
      const { plan = 'pro', days = 7, scheduledAt } = req.body

      const user = await User.findById(req.params.userId)
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

      // Activación programada: guardar para procesamiento futuro
      if (scheduledAt) {
        const scheduledDate = new Date(scheduledAt)
        if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
          return res.status(400).json({ message: 'scheduledAt debe ser una fecha futura válida' })
        }

        const scheduled = await ScheduledTrial.create({
          user:        user._id,
          plan,
          days:        Number(days),
          scheduledAt: scheduledDate,
          createdBy:   admin._id,
        })

        return res.json({
          message:     `Prueba gratuita programada para ${scheduledDate.toISOString()}`,
          scheduledAt: scheduledDate,
          scheduled,
        })
      }

      // Activación inmediata
      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + Number(days))

      const sub = await upsertSubscription(user, {
        plan,
        status:      'trial',
        trialEnd,
        price:       0,
        cancelledAt: null,
      })

      const oldPlan = user.suscription
      user.suscription = plan
      await user.save()
      await SuscriptionChange.create({ user: user._id, from: oldPlan, to: plan })

      res.json({ message: `Prueba gratuita de ${days} dias activada`, subscription: sub, trialEnd })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // GET /admin/payments/:id/invoice
  async adminGetInvoice(req, res) {
    try {
      await verifyAdmin(req)
      const payment = await Payment.findById(req.params.id)
        .populate('user',         'name email')
        .populate('subscription', 'plan billingCycle startDate endDate')
      if (!payment) return res.status(404).json({ message: 'Pago no encontrado' })
      if (!payment.invoiceNumber) return res.status(404).json({ message: 'Este pago no tiene factura generada' })

      res.json({
        invoiceNumber: payment.invoiceNumber,
        issuedAt:      payment.paidAt ?? payment.createdAt,
        status:        payment.status,
        amount:        payment.amount,
        currency:      payment.currency,
        description:   payment.description,
        method:        payment.method,
        user: {
          name:  payment.user?.name,
          email: payment.user?.email,
        },
        subscription: {
          plan:         payment.subscription?.plan,
          billingCycle: payment.subscription?.billingCycle,
          startDate:    payment.subscription?.startDate,
          endDate:      payment.subscription?.endDate,
        },
      })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // GET /admin/metrics
  async adminGetMetrics(req, res) {
    try {
      await verifyAdmin(req)
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      const [freeCount, basicCount, proCount] = await Promise.all([
        User.countDocuments({ suscription: 'free',  deletedAt: null }),
        User.countDocuments({ suscription: 'basic', deletedAt: null }),
        User.countDocuments({ suscription: 'pro',   deletedAt: null }),
      ])

      const mrr = basicCount * PLAN_PRICES.basic + proCount * PLAN_PRICES.pro
      const arr = mrr * 12

      // Churn: users who moved from paid → free this month
      const cancelledThisMonth = await SuscriptionChange.countDocuments({
        from:      { $in: ['basic', 'pro'] },
        to:        'free',
        createdAt: { $gte: startOfMonth },
      })
      const paidAtStartOfMonth = await User.countDocuments({
        suscription: { $in: ['basic', 'pro'] },
        createdAt:   { $lt: startOfMonth },
        deletedAt:   null,
      })
      const churnRate = paidAtStartOfMonth > 0
        ? Number(((cancelledThisMonth / paidAtStartOfMonth) * 100).toFixed(2))
        : 0

      const activeTrials = await Subscription.countDocuments({
        status:   'trial',
        trialEnd: { $gte: now },
        deletedAt: null,
      })

      const newThisMonth = await SuscriptionChange.countDocuments({
        to:        { $in: ['basic', 'pro'] },
        createdAt: { $gte: startOfMonth },
      })

      // Revenue from Payment records
      const [totalRevenueAgg, monthRevenueAgg] = await Promise.all([
        Payment.aggregate([
          { $match: { status: 'approved', deletedAt: null } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Payment.aggregate([
          { $match: { status: 'approved', paidAt: { $gte: startOfMonth }, deletedAt: null } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ])

      // MRR trend (last 6 months, based on subscription plan changes)
      const mrrTrend = []
      for (let i = 5; i >= 0; i--) {
        const ms = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        const rev = await Payment.aggregate([
          { $match: { status: 'approved', paidAt: { $gte: ms, $lte: me }, deletedAt: null } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        mrrTrend.push({
          month:   ms.toLocaleString('es-ES', { month: 'short', year: '2-digit' }),
          revenue: rev[0]?.total ?? 0,
        })
      }

      res.json({
        counts:          { free: freeCount, basic: basicCount, pro: proCount },
        mrr:             Number(mrr.toFixed(2)),
        arr:             Number(arr.toFixed(2)),
        churnRate,
        activeTrials,
        newThisMonth,
        totalRevenue:    totalRevenueAgg[0]?.total ?? 0,
        revenueThisMonth: monthRevenueAgg[0]?.total ?? 0,
        mrrTrend,
      })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // GET /admin/payments?status=&method=&search=&page=1&limit=20
  async adminGetPayments(req, res) {
    try {
      await verifyAdmin(req)
      const { status, method, search, page = 1, limit = 20 } = req.query

      const filter = { deletedAt: null }
      if (status) filter.status = status
      if (method) filter.method = method

      if (search) {
        const users = await User.find({
          $or: [
            { name:  { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }).select('_id')
        filter.user = { $in: users.map(u => u._id) }
      }

      const total    = await Payment.countDocuments(filter)
      const payments = await Payment.find(filter)
        .populate('user',         'name email suscription')
        .populate('subscription', 'plan status')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))

      res.json({ payments, total, page: Number(page), limit: Number(limit) })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // PUT /admin/payments/:id/status  body: { status, description? }
  async adminUpdatePaymentStatus(req, res) {
    try {
      await verifyAdmin(req)
      const { status, description } = req.body
      const payment = await Payment.findById(req.params.id)
      if (!payment) return res.status(404).json({ message: 'Pago no encontrado' })

      payment.status = status
      if (status === 'approved') {
        payment.paidAt = new Date()
        if (!payment.invoiceNumber) payment.invoiceNumber = await generateInvoiceNumber()
      }
      if (description) payment.description = description
      await payment.save()

      // If approved, sync subscription status
      if (status === 'approved' && payment.subscription) {
        const sub = await Subscription.findById(payment.subscription)
        if (sub && sub.status !== 'active') {
          sub.status = 'active'
          await sub.save()
          await User.findByIdAndUpdate(payment.user, { suscription: sub.plan })
        }
      }

      res.json({ message: 'Estado actualizado', payment })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // ─── USER-FACING ──────────────────────────────────────────────────────────────

  // POST /  body: { plan: 'basic'|'pro', billingCycle: 'monthly'|'annual' }
  async createSubscription(req, res) {
    try {
      const user = await verifyUser(req)
      const { plan, billingCycle = 'monthly' } = req.body
      if (!['basic', 'pro'].includes(plan)) return res.status(400).json({ message: 'Plan invalido' })
      if (!['monthly', 'annual'].includes(billingCycle)) return res.status(400).json({ message: 'Ciclo invalido' })

      const amount    = PLAN_PRICES_MP[plan][billingCycle]
      const frequency = BILLING_MONTHS[billingCycle]

      const { data } = await axios.post(
        `${MP_API}/preapproval`,
        {
          auto_recurring: {
            frequency,
            frequency_type: 'months',
            transaction_amount: amount,
            currency_id: 'USD',
          },
          back_url:           process.env.FRONTEND_URL,
          payer_email:        user.email,
          reason:             `Plan ${plan} Petnder - ${billingCycle === 'annual' ? 'Anual' : 'Mensual'}`,
          notification_url:   `${process.env.API_URL}/api/subscription/webhook/mercadopago`,
          external_reference: JSON.stringify({ userId: String(user._id), plan, billingCycle }),
        },
        { headers: mpHeaders() }
      )

      res.json({ init_point: data.init_point, preapprovalId: data.id })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // POST /verify  body: { preapprovalId }
  async verifySubscription(req, res) {
    try {
      const user = await verifyUser(req)
      const { preapprovalId } = req.body
      if (!preapprovalId) return res.status(400).json({ message: 'preapprovalId requerido' })

      const { data } = await axios.get(
        `${MP_API}/preapproval/${preapprovalId}`,
        { headers: mpHeaders() }
      )

      if (data.status !== 'authorized') {
        return res.status(400).json({ message: `Estado de suscripcion en MP: ${data.status}` })
      }

      const { plan, billingCycle = 'monthly' } = JSON.parse(data.external_reference ?? '{}')
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + BILLING_MONTHS[billingCycle])

      const oldPlan = user.suscription
      const sub = await upsertSubscription(user, {
        plan,
        status:                    'active',
        billingCycle,
        price:                     PLAN_PRICES[plan],
        mercadopagoSubscriptionId: preapprovalId,
        startDate:                 new Date(),
        endDate,
        cancelledAt:               null,
      })

      user.suscription = plan
      await user.save()
      await SuscriptionChange.create({ user: user._id, from: oldPlan, to: plan })

      await Payment.create({
        user:                 user._id,
        subscription:         sub._id,
        amount:               PLAN_PRICES_MP[plan][billingCycle],
        currency:             'USD',
        status:               'approved',
        method:               'mercadopago',
        mercadopagoPaymentId: preapprovalId,
        paidAt:               new Date(),
        invoiceNumber:        await generateInvoiceNumber(),
        description:          `Suscripcion ${plan} - ${billingCycle}`,
      })

      res.json({ message: 'Suscripcion activada', subscription: sub })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // PUT /cancel
  async cancelSubscription(req, res) {
    try {
      const user = await verifyUser(req)
      const sub  = await Subscription.findOne({ user: user._id, status: { $in: ['active', 'trial'] }, deletedAt: null })
      if (!sub) return res.status(404).json({ message: 'No hay suscripcion activa' })

      if (sub.mercadopagoSubscriptionId) {
        try {
          await axios.put(
            `${MP_API}/preapproval/${sub.mercadopagoSubscriptionId}`,
            { status: 'cancelled' },
            { headers: mpHeaders() }
          )
        } catch (mpErr) {
          console.error('Error cancelando preapproval en MP:', mpErr.message)
        }
      }

      const oldPlan = user.suscription
      sub.status                    = 'cancelled'
      sub.cancelledAt               = new Date()
      sub.plan                      = 'free'
      sub.price                     = 0
      sub.mercadopagoSubscriptionId = null
      await sub.save()

      user.suscription = 'free'
      await user.save()
      await SuscriptionChange.create({ user: user._id, from: oldPlan, to: 'free' })

      res.json({ message: 'Suscripcion cancelada' })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // ─── IAP ──────────────────────────────────────────────────────────────────────

  // POST /iap/verify
  // body: { platform: 'ios'|'android', productId, receiptData? (ios), purchaseToken? (android) }
  async verifyIAP(req, res) {
    try {
      const user = await verifyUser(req)
      const { platform, productId, receiptData, purchaseToken } = req.body

      if (!platform || !productId) return res.status(400).json({ message: 'platform y productId requeridos' })

      const mapping = IAP_PRODUCT_MAP[productId]
      if (!mapping) return res.status(400).json({ message: `productId desconocido: ${productId}` })

      const { plan, billingCycle } = mapping

      if (platform === 'ios') {
        if (!receiptData) return res.status(400).json({ message: 'receiptData requerido para iOS' })
        await verifyAppleReceipt(receiptData)
      } else if (platform === 'android') {
        if (!purchaseToken) return res.status(400).json({ message: 'purchaseToken requerido para Android' })
        await verifyAndroidPurchase(productId, purchaseToken)
      } else {
        return res.status(400).json({ message: 'platform debe ser ios o android' })
      }

      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + BILLING_MONTHS[billingCycle])

      const oldPlan = user.suscription
      const sub = await upsertSubscription(user, {
        plan,
        status:      'active',
        billingCycle,
        price:       PLAN_PRICES[plan],
        startDate:   new Date(),
        endDate,
        cancelledAt: null,
        mercadopagoSubscriptionId: null,
      })

      user.suscription = plan
      await user.save()
      if (oldPlan !== plan) await SuscriptionChange.create({ user: user._id, from: oldPlan, to: plan })

      await Payment.create({
        user:          user._id,
        subscription:  sub._id,
        amount:        PLAN_PRICES[plan],
        currency:      'USD',
        status:        'approved',
        method:        'iap',
        paidAt:        new Date(),
        invoiceNumber: await generateInvoiceNumber(),
        description:   `IAP ${platform} - ${plan} ${billingCycle}`,
      })

      res.json({ message: 'Suscripción activada', plan, billingCycle })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // ─── WEBHOOK ──────────────────────────────────────────────────────────────────

  // POST /webhook/mercadopago
  async mercadopagoWebhook(req, res) {
    res.status(200).json({ received: true })
    try {
      const { type, data } = req.body
      if (!data?.id) return

      if (type === 'payment') {
        const payment = await Payment.findOne({ mercadopagoPaymentId: String(data.id) })
        if (!payment) return

        const statusMap = {
          approved:   'approved',
          rejected:   'rejected',
          cancelled:  'cancelled',
          refunded:   'refunded',
          pending:    'pending',
          in_process: 'pending',
        }
        const newStatus = statusMap[data.status] ?? payment.status
        if (newStatus === payment.status) return

        payment.status = newStatus
        if (newStatus === 'approved') payment.paidAt = new Date()
        await payment.save()

        if (newStatus === 'approved' && payment.subscription) {
          const sub = await Subscription.findById(payment.subscription)
          if (sub) {
            sub.status = 'active'
            await sub.save()
            await User.findByIdAndUpdate(sub.user, { suscription: sub.plan })
          }
        }

      } else if (type === 'subscription_preapproval') {
        const { data: preapproval } = await axios.get(
          `${MP_API}/preapproval/${data.id}`,
          { headers: mpHeaders() }
        )

        const sub = await Subscription.findOne({
          mercadopagoSubscriptionId: String(data.id),
          deletedAt: null,
        }).populate('user', '_id suscription')
        if (!sub) return

        if (preapproval.status === 'authorized') {
          const { billingCycle = 'monthly' } = JSON.parse(preapproval.external_reference ?? '{}')
          const endDate = new Date()
          endDate.setMonth(endDate.getMonth() + BILLING_MONTHS[billingCycle])

          sub.status  = 'active'
          sub.endDate = endDate
          await sub.save()

          await User.findByIdAndUpdate(sub.user._id, { suscription: sub.plan })

          await Payment.create({
            user:                 sub.user._id,
            subscription:         sub._id,
            amount:               PLAN_PRICES[sub.plan],
            currency:             'USD',
            status:               'approved',
            method:               'mercadopago',
            mercadopagoPaymentId: String(data.id),
            paidAt:               new Date(),
            invoiceNumber:        await generateInvoiceNumber(),
            description:          `Renovacion ${sub.plan} - ${billingCycle}`,
          })

        } else if (['cancelled', 'paused', 'pending'].includes(preapproval.status)) {
          const oldPlan = sub.user?.suscription ?? sub.plan
          sub.status      = preapproval.status === 'cancelled' ? 'cancelled' : 'paused'
          sub.plan        = 'free'
          sub.price       = 0
          sub.cancelledAt = preapproval.status === 'cancelled' ? new Date() : null
          sub.mercadopagoSubscriptionId = null
          await sub.save()

          await User.findByIdAndUpdate(sub.user._id, { suscription: 'free' })
          await SuscriptionChange.create({ user: sub.user._id, from: oldPlan, to: 'free' })
        }
      }
    } catch (err) {
      console.error('Webhook MP error:', err.message)
    }
  },
}

export default SubscriptionController
