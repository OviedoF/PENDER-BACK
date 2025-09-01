import { Router } from 'express'
import CouponCodeController from '../controllers/couponCode.controller.js'

const router = Router()

// CouponCode routes
router.post('/', CouponCodeController.create) // Crear un código de cupón
router.get('/', CouponCodeController.getAll) // Obtener todos los códigos activos (no eliminados)
router.get('/:id', CouponCodeController.getById) // Obtener un código por ID
router.put('/:id', CouponCodeController.update) // Actualizar un código
router.delete('/:id', CouponCodeController.softDelete) // Eliminar lógico (soft delete)
router.delete('/:id/force', CouponCodeController.delete) // Eliminar definitivo

export default router
