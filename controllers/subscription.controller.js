import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Subscription from '../models/Subscription.js'
import Payment from '../models/Payment.js'
import SuscriptionChange from '../models/SuscriptionChange.js'

const PLAN_PRICES = { free: 0, basic: 9.99, pro: 19.99 }

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
      await verifyAdmin(req)
      const { plan = 'pro', days = 7 } = req.body

      const user = await User.findById(req.params.userId)
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

      const trialEnd = new Date()
      trialEnd.setDate(trialEnd.getDate() + Number(days))

      const sub = await upsertSubscription(user, {
        plan,
        status:   'trial',
        trialEnd,
        price:    0,
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
      if (status === 'approved') payment.paidAt = new Date()
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

  // POST /webhook/mercadopago
  async mercadopagoWebhook(req, res) {
    // Always acknowledge immediately to prevent retries
    res.status(200).json({ received: true })
    try {
      const { type, data } = req.body
      if (type !== 'payment' || !data?.id) return

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
    } catch (err) {
      console.error('Webhook MP error:', err.message)
    }
  },
}

export default SubscriptionController
