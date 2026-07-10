import { Router } from 'express'
import CouponController from '../controllers/coupon.controller.js'
import { requirePermission } from '../middlewares/roleMiddleware.js'

const router = Router()

const viewCupones = requirePermission('cupones', 'view')
const createCupones = requirePermission('cupones', 'create')
const deleteCupones = requirePermission('cupones', 'delete')

// Admin routes (must be before /:id to avoid param conflicts)
router.get('/admin/export', viewCupones, CouponController.adminExport)
router.get('/admin/all', viewCupones, CouponController.adminGetAll)
router.post('/admin/create', createCupones, CouponController.adminCreate)
router.get('/admin/:id/metrics', viewCupones, CouponController.adminGetMetrics)
router.delete('/admin/:id', deleteCupones, CouponController.adminDelete)

// Coupon routes
router.post('/', CouponController.create) // Create a coupon
router.get('/global/active', CouponController.getGlobalActive) // Get active global coupons (platform promos)
router.get('/service/:serviceId/all', CouponController.getAllByService) // Get all coupons for a service
router.get('/service/active/:serviceId', CouponController.getActive) // Get active coupons
router.get('/service/scheduled/:serviceId', CouponController.getScheduled) // Get scheduled coupons
router.get('/service/:serviceId/hidden', CouponController.getHidden) // Get hidden coupons
router.get('/:id', CouponController.getById) // Get a coupon by ID
router.put('/:id', CouponController.update) // Update a coupon
router.delete('/:id', CouponController.delete) // Delete a coupon

export default router
