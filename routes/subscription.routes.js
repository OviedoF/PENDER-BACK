import { Router } from 'express'
import SubscriptionController from '../controllers/subscription.controller.js'
import { requirePermission } from '../middlewares/roleMiddleware.js'

const router = Router()

// ─── USER ─────────────────────────────────────────────────────────────────────
router.post('/iap/verify', SubscriptionController.verifyIAP)
router.put('/cancel',      SubscriptionController.cancelSubscription)

// ─── MERCADOPAGO (legacy / web) ───────────────────────────────────────────────
router.post('/',        SubscriptionController.createSubscription)
router.post('/verify',  SubscriptionController.verifySubscription)

// ─── ADMIN ────────────────────────────────────────────────────────────────────
const view = requirePermission('suscripciones', 'view')
const manage = requirePermission('suscripciones', 'manage')

router.get('/admin/export/subscriptions',   view,   SubscriptionController.adminExportSubscriptions)
router.get('/admin/export/payments',       view,   SubscriptionController.adminExportPayments)
router.get('/admin/all',                    view,   SubscriptionController.adminGetAll)
router.get('/admin/metrics',               view,   SubscriptionController.adminGetMetrics)
router.get('/admin/payments',              view,   SubscriptionController.adminGetPayments)
router.get('/admin/payments/:id/invoice',  view,   SubscriptionController.adminGetInvoice)
router.get('/admin/:userId/detail',        view,   SubscriptionController.adminGetByUser)
router.put('/admin/payments/:id/status',   manage, SubscriptionController.adminUpdatePaymentStatus)
router.put('/admin/:userId/plan',          manage, SubscriptionController.adminChangePlan)
router.post('/admin/:userId/trial',        manage, SubscriptionController.adminActivateTrial)
router.put('/admin/:id/cancel',            manage, SubscriptionController.adminCancel)
router.put('/admin/:id/reactivate',        manage, SubscriptionController.adminReactivate)

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
router.post('/webhook/mercadopago',        SubscriptionController.mercadopagoWebhook)

export default router
