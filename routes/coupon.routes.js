import { Router } from 'express'
import CouponController from '../controllers/coupon.controller.js'
import { onlyAdmin } from '../middlewares/roleMiddleware.js'

const router = Router()

// Admin routes (must be before /:id to avoid param conflicts)
router.get('/admin/all', onlyAdmin, CouponController.adminGetAll)
router.post('/admin/create', onlyAdmin, CouponController.adminCreate)
router.get('/admin/:id/metrics', onlyAdmin, CouponController.adminGetMetrics)
router.delete('/admin/:id', onlyAdmin, CouponController.adminDelete)

// Coupon routes
router.post('/', CouponController.create) // Create a coupon
router.get('/service/:serviceId/all', CouponController.getAllByService) // Get all coupons for a service
router.get('/service/active/:serviceId', CouponController.getActive) // Get active coupons
router.get('/service/scheduled/:serviceId', CouponController.getScheduled) // Get scheduled coupons
router.get('/service/:serviceId/hidden', CouponController.getHidden) // Get hidden coupons
router.get('/:id', CouponController.getById) // Get a coupon by ID
router.put('/:id', CouponController.update) // Update a coupon
router.delete('/:id', CouponController.delete) // Delete a coupon

export default router