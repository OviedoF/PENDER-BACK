import { Router } from 'express'
import SubscriptionController from '../controllers/subscription.controller.js'

const router = Router()

// ─── ADMIN ────────────────────────────────────────────────────────────────────
router.get('/admin/all',                    SubscriptionController.adminGetAll)
router.get('/admin/metrics',               SubscriptionController.adminGetMetrics)
router.get('/admin/payments',              SubscriptionController.adminGetPayments)
router.put('/admin/payments/:id/status',   SubscriptionController.adminUpdatePaymentStatus)
router.get('/admin/:userId/detail',        SubscriptionController.adminGetByUser)
router.put('/admin/:userId/plan',          SubscriptionController.adminChangePlan)
router.post('/admin/:userId/trial',        SubscriptionController.adminActivateTrial)
router.put('/admin/:id/cancel',            SubscriptionController.adminCancel)
router.put('/admin/:id/reactivate',        SubscriptionController.adminReactivate)

// ─── WEBHOOK ──────────────────────────────────────────────────────────────────
router.post('/webhook/mercadopago',        SubscriptionController.mercadopagoWebhook)

export default router
